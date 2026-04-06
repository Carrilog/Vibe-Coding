/**
 * SQLite 数据库层 — 扩展任务表
 */

import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import type { Message, ScheduledTask } from './types.js'

let db: Database.Database

export function initDatabase(dbPath?: string): void {
  const resolvedPath = dbPath ?? path.join(process.cwd(), 'data', 'nanoclaw.db')
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true })

  db = new Database(resolvedPath)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS chats (
      jid TEXT PRIMARY KEY, name TEXT, last_message_time TEXT
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, chat_jid TEXT, sender TEXT,
      content TEXT, timestamp TEXT, is_bot_message INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS router_state (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id TEXT PRIMARY KEY,
      group_folder TEXT,
      prompt TEXT,
      schedule_type TEXT,
      schedule_value TEXT,
      context_mode TEXT DEFAULT 'isolated',
      next_run TEXT,
      last_run TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS task_run_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT, started_at TEXT, finished_at TEXT,
      duration_ms INTEGER, status TEXT, result TEXT, error TEXT
    );
  `)

  console.log(`数据库初始化完成: ${resolvedPath}`)
}

// ── 消息操作 ──

export function storeMessage(msg: Message): void {
  db.prepare(`INSERT OR IGNORE INTO messages (id, chat_jid, sender, content, timestamp, is_bot_message) VALUES (?, ?, ?, ?, ?, ?)`).run(
    msg.id, msg.chatJid, msg.sender, msg.content, msg.timestamp, msg.isBot ? 1 : 0,
  )
}

export function getNewMessages(since: string): Message[] {
  return (db.prepare(`SELECT id, chat_jid, sender, content, timestamp FROM messages WHERE timestamp > ? AND is_bot_message = 0 ORDER BY timestamp ASC`).all(since) as Array<{ id: string; chat_jid: string; sender: string; content: string; timestamp: string }>).map((r) => ({
    id: r.id, chatJid: r.chat_jid, sender: r.sender, content: r.content, timestamp: r.timestamp,
  }))
}

export function getRouterState(key: string): string | undefined {
  return (db.prepare('SELECT value FROM router_state WHERE key = ?').get(key) as { value: string } | undefined)?.value
}

export function setRouterState(key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO router_state (key, value) VALUES (?, ?)').run(key, value)
}

export function storeChatMetadata(jid: string, name: string): void {
  db.prepare(`INSERT INTO chats (jid, name, last_message_time) VALUES (?, ?, datetime('now')) ON CONFLICT(jid) DO UPDATE SET name = excluded.name, last_message_time = datetime('now')`).run(jid, name)
}

// ── 任务操作 ──

export function createTask(task: Omit<ScheduledTask, 'lastRun'>): void {
  db.prepare(`INSERT INTO scheduled_tasks (id, group_folder, prompt, schedule_type, schedule_value, context_mode, next_run, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    task.id, task.groupFolder, task.prompt, task.scheduleType, task.scheduleValue,
    task.contextMode, task.nextRun, task.status, new Date().toISOString(),
  )
}

export function getDueTasks(): ScheduledTask[] {
  const now = new Date().toISOString()
  return (db.prepare(`SELECT * FROM scheduled_tasks WHERE next_run <= ? AND status = 'active'`).all(now) as Array<Record<string, string>>).map((r) => ({
    id: r.id, groupFolder: r.group_folder, prompt: r.prompt,
    scheduleType: r.schedule_type as ScheduledTask['scheduleType'],
    scheduleValue: r.schedule_value, contextMode: r.context_mode as ScheduledTask['contextMode'],
    nextRun: r.next_run, lastRun: r.last_run, status: r.status as ScheduledTask['status'],
  }))
}

export function updateTaskNextRun(taskId: string, nextRun: string): void {
  db.prepare(`UPDATE scheduled_tasks SET next_run = ?, last_run = datetime('now') WHERE id = ?`).run(nextRun, taskId)
}

export function deleteTask(taskId: string): void {
  db.prepare('DELETE FROM scheduled_tasks WHERE id = ?').run(taskId)
}

export function logTaskRun(taskId: string, startedAt: string, status: string, result?: string, error?: string): void {
  const finishedAt = new Date().toISOString()
  const duration = new Date(finishedAt).getTime() - new Date(startedAt).getTime()
  db.prepare(`INSERT INTO task_run_logs (task_id, started_at, finished_at, duration_ms, status, result, error) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    taskId, startedAt, finishedAt, duration, status, result ?? null, error ?? null,
  )
}
