/**
 * 消息处理器 — 收到消息后做什么
 *
 * NanoClaw 原版在这里会：
 *   1. 按分组分发消息
 *   2. 检查 Trigger 模式
 *   3. 格式化为 XML
 *   4. 启动容器执行 Agent
 *
 * 这一步我们只做最简单的事：打印消息。
 * 后续步骤会逐步替换这个处理器。
 */

import type { Message } from './types.js'

export function processMessages(messages: Message[]): void {
  for (const msg of messages) {
    console.log(`  [${msg.timestamp}] ${msg.sender}: ${msg.content}`)
  }
}
