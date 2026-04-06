/**
 * 消息循环 — 分组分发版本
 *
 * 与之前的区别：
 *   - 消息按 chatJid 匹配到分组
 *   - 非 main 分组需要 Trigger 匹配
 *   - 通过 GroupQueue 入队
 */

import { getNewMessages, getRouterState, setRouterState } from './db.js'
import { processGroupMessages } from './processor.js'
import { GroupQueue } from './group-queue.js'
import type { RegisteredGroup, Message } from './types.js'

const POLL_INTERVAL = 2000

let lastTimestamp: string
let running = false

const queue = new GroupQueue()

export function startMessageLoop(groups: RegisteredGroup[]): void {
  lastTimestamp = getRouterState('last_timestamp') ?? new Date(0).toISOString()
  running = true
  console.log(`消息循环启动，cursor: ${lastTimestamp}`)
  console.log(`已注册分组: ${groups.map((g) => g.name).join(', ')}\n`)
  tick(groups)
}

export function stopMessageLoop(): void {
  running = false
}

function tick(groups: RegisteredGroup[]): void {
  if (!running) return

  const messages = getNewMessages(lastTimestamp)

  if (messages.length > 0) {
    // 按分组分发消息
    for (const group of groups) {
      const groupMsgs = messages.filter((m) => m.chatJid === group.chatJid)
      if (groupMsgs.length === 0) continue

      // 非 main 分组需要 Trigger 匹配
      if (!group.isMain && group.triggerPattern) {
        const pattern = new RegExp(group.triggerPattern, 'i')
        const triggered = groupMsgs.some((m) => pattern.test(m.content))
        if (!triggered) {
          console.log(`[${group.name}] ${groupMsgs.length} 条消息，未触发 Trigger，跳过`)
          continue
        }
      }

      // 通过 GroupQueue 入队
      queue.enqueue(group.folder, () => {
        processGroupMessages(group, groupMsgs, queue)
      })
    }

    lastTimestamp = messages[messages.length - 1].timestamp
    setRouterState('last_timestamp', lastTimestamp)
  }

  setTimeout(() => tick(groups), POLL_INTERVAL)
}
