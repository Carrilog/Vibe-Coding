/**
 * 消息循环 — Channel 版本
 */

import { getNewMessages, getRouterState, setRouterState } from './db.js'
import { processGroupMessages } from './processor.js'
import type { RegisteredGroup, Channel } from './types.js'

const POLL_INTERVAL = 2000

let lastTimestamp: string
let running = false

export function startMessageLoop(groups: RegisteredGroup[], channel: Channel): void {
  lastTimestamp = getRouterState('last_timestamp') ?? new Date(0).toISOString()
  running = true
  console.log(`消息循环启动`)
  tick(groups, channel)
}

export function stopMessageLoop(): void {
  running = false
}

async function tick(groups: RegisteredGroup[], channel: Channel): Promise<void> {
  if (!running) return

  const messages = getNewMessages(lastTimestamp)

  if (messages.length > 0) {
    await processGroupMessages(messages, channel)
    lastTimestamp = messages[messages.length - 1].timestamp
    setRouterState('last_timestamp', lastTimestamp)
  }

  setTimeout(() => tick(groups, channel), POLL_INTERVAL)
}
