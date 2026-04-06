/**
 * SQLite 数据库层
 *
 * 对应 NanoClaw 原版 src/db.ts。
 * 原版有 7 张表和大量迁移逻辑，这里只保留最核心的 3 张表：
 *   - chats: 聊天元数据
 *   - messages: 消息历史
 *   - router_state: 路由状态（KV 存储）
 *
 * 使用 better-sqlite3 的同步 API，与 NanoClaw 原版一致。
 */

import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import type { Message } from './types.js'

let db: Database.Database

export function initDatabase(dbPath?: string): void {
  const resolvedPath = dbPath ?? path.join(process.cwd(), 'data', 'nanoclaw.db')
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true })

  db = new Database(resolvedPath)
  db.pragma('journal_mode = WAL') // 写前日志，提升并发读性能

  db.exec(`
    CREATE TABLE IF NOT EXISTS chats (
      jid TEXT PRIMARY KEY,
      name TEXT,
      last_message_time TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_jid TEXT,
      sender TEXT,
      content TEXT,
      timestamp TEXT,
      is_bot_message INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS router_state (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `)

  console.log(`数据库初始化完成: ${resolvedPath}`)
}

// ── 消息操作 ──

export function storeMessage(msg: Message): void {
  db.prepare(`
    INSERT OR IGNORE INTO messages (id, chat_jid, sender, content, timestamp, is_bot_message)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(msg.id, msg.chatJid, msg.sender, msg.content, msg.timestamp, msg.isBot ? 1 : 0)
}

export function getNewMessages(since: string): Message[] {
  const rows = db.prepare(`
    SELECT id, chat_jid, sender, content, timestamp
    FROM messages
    WHERE timestamp > ? AND is_bot_message = 0
    ORDER BY timestamp ASC
  `).all(since) as Array<{ id: string; chat_jid: string; sender: string; content: string; timestamp: string }>

  return rows.map((r) => ({
    id: r.id,
    chatJid: r.chat_jid,
    sender: r.sender,
    content: r.content,
    timestamp: r.timestamp,
  }))
}

// ── 路由状态 ──

export function getRouterState(key: string): string | undefined {
  const row = db.prepare('SELECT value FROM router_state WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value
}

export function setRouterState(key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO router_state (key, value) VALUES (?, ?)').run(key, value)
}

// ── 聊天元数据 ──

export function storeChatMetadata(jid: string, name: string): void {
  db.prepare(`
    INSERT INTO chats (jid, name, last_message_time)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(jid) DO UPDATE SET
      name = excluded.name,
      last_message_time = datetime('now')
  `).run(jid, name)
}
