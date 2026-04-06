/**
 * 消息循环 — 现在从 SQLite 读取消息
 *
 * 与 Step 01 的区别：
 *   - 消息来源从内存数组变为 SQLite
 *   - cursor (lastTimestamp) 持久化到 router_state 表
 *   - 重启后能从上次处理的位置继续
 */

import { getNewMessages, getRouterState, setRouterState } from './db.js'
import { processMessages } from './processor.js'

const POLL_INTERVAL = 2000

let lastTimestamp: string
let running = false

export function startMessageLoop(): void {
  // 从 DB 恢复 cursor，实现重启不丢进度
  lastTimestamp = getRouterState('last_timestamp') ?? new Date(0).toISOString()
  running = true
  console.log(`消息循环启动，cursor: ${lastTimestamp}`)
  tick()
}

export function stopMessageLoop(): void {
  running = false
}

function tick(): void {
  if (!running) return

  const messages = getNewMessages(lastTimestamp)

  if (messages.length > 0) {
    console.log(`\n发现 ${messages.length} 条新消息:`)
    processMessages(messages)

    // 更新 cursor 并持久化
    lastTimestamp = messages[messages.length - 1].timestamp
    setRouterState('last_timestamp', lastTimestamp)
  }

  setTimeout(tick, POLL_INTERVAL)
}
