/**
 * 消息处理器 — 现在格式化为 XML 并展示
 */

import type { Message } from './types.js'
import { formatMessages, formatOutbound } from './router.js'

export function processMessages(messages: Message[]): void {
  const xml = formatMessages(messages)
  console.log('\n--- Agent 收到的 XML prompt ---')
  console.log(xml)
  console.log('--- XML 结束 ---\n')

  // 模拟 Agent 回复（含内部标签）
  const agentReply =
    '<internal>用户在打招呼，我应该友好回应</internal>\n你好！有什么我可以帮你的吗？'
  const cleaned = formatOutbound(agentReply)
  console.log(`[Agent 回复] ${cleaned}`)
}
