/**
 * 消息循环 — NanoClaw 的心跳
 *
 * 对应 NanoClaw 原版 src/index.ts 中的 startMessageLoop()。
 *
 * 核心模式：
 *   1. 记录上次处理的时间戳 (cursor)
 *   2. 每隔 POLL_INTERVAL 查询新消息
 *   3. 处理消息后更新 cursor
 *   4. 用 setTimeout 递归实现循环
 */

import { getNewMessages } from './message-store.js'
import { processMessages } from './processor.js'

const POLL_INTERVAL = 2000 // 2 秒，与 NanoClaw 原版一致

let lastTimestamp = new Date(0).toISOString() // cursor: 从最早开始
let running = false

export function startMessageLoop(): void {
  running = true
  console.log(`消息循环启动，轮询间隔 ${POLL_INTERVAL}ms`)
  tick()
}

export function stopMessageLoop(): void {
  running = false
  console.log('消息循环停止')
}

function tick(): void {
  if (!running) return

  const messages = getNewMessages(lastTimestamp)

  if (messages.length > 0) {
    console.log(`\n发现 ${messages.length} 条新消息:`)
    processMessages(messages)
    lastTimestamp = messages[messages.length - 1].timestamp
  } else {
    console.log('.')  // 心跳指示
  }

  setTimeout(tick, POLL_INTERVAL)
}
