/**
 * 消息存储层 — 模拟 NanoClaw 的 DB 层
 *
 * NanoClaw 原版用 SQLite（src/db.ts），这里先用内存数组。
 * 关键接口：
 *   - storeMessage()    写入消息
 *   - getNewMessages()  获取指定时间戳之后的新消息
 *
 * 这个"按时间戳查询新消息"的模式是 NanoClaw 消息循环的基础。
 */

import type { Message } from './types.js'

const messages: Message[] = []

export function storeMessage(msg: Message): void {
  messages.push(msg)
}

export function getNewMessages(since: string): Message[] {
  return messages.filter((m) => m.timestamp > since)
}
