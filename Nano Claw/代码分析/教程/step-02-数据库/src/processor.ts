/**
 * 消息处理器 — 与 Step 01 相同
 */

import type { Message } from './types.js'

export function processMessages(messages: Message[]): void {
  for (const msg of messages) {
    console.log(`  [${msg.timestamp}] ${msg.sender}: ${msg.content}`)
  }
}
