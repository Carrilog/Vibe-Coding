/**
 * 消息循环 — 异步版本（processor 现在是 async）
 */

import { getNewMessages, getRouterState, setRouterState } from './db.js'
import { processMessages } from './processor.js'

const POLL_INTERVAL = 2000

let lastTimestamp: string
let running = false
let processing = false

export function startMessageLoop(): void {
  lastTimestamp = getRouterState('last_timestamp') ?? new Date(0).toISOString()
  running = true
  console.log(`消息循环启动，cursor: ${lastTimestamp}`)
  tick()
}

export function stopMessageLoop(): void {
  running = false
}

async function tick(): Promise<void> {
  if (!running) return

  // 防止并发处理（上一次还没完成时跳过）
  if (!processing) {
    const messages = getNewMessages(lastTimestamp)

    if (messages.length > 0) {
      processing = true
      console.log(`\n发现 ${messages.length} 条新消息`)
      await processMessages(messages)
      lastTimestamp = messages[messages.length - 1].timestamp
      setRouterState('last_timestamp', lastTimestamp)
      processing = false
    }
  }

  setTimeout(tick, POLL_INTERVAL)
}
