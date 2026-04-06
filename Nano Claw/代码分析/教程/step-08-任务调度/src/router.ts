/**
 * 路由器 — 消息格式化与出站处理
 *
 * 对应 NanoClaw 原版 src/router.ts。
 * 核心职责：
 *   1. formatMessages(): 将 Message[] 转为 XML 字符串
 *   2. formatOutbound(): 清理 Agent 输出（移除内部标签）
 *   3. escapeXml(): 防止用户输入破坏 XML 结构
 */

import type { Message } from './types.js'

const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone

/**
 * 将消息数组格式化为 XML，供 Agent 消费
 *
 * NanoClaw 原版的 formatMessages() 还支持 reply_to 引用，
 * 这里展示完整实现。
 */
export function formatMessages(messages: Message[]): string {
  const now = new Date().toLocaleString('zh-CN', { timeZone: TIMEZONE })

  let xml = '<context>\n'
  xml += `  <current_time timezone="${TIMEZONE}">${now}</current_time>\n`
  xml += '</context>\n'
  xml += '<messages>\n'

  for (const msg of messages) {
    const time = new Date(msg.timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: TIMEZONE,
    })

    const replyAttr = msg.replyTo ? ` reply_to="${escapeXml(msg.replyTo.sender)}"` : ''
    xml += `  <message sender="${escapeXml(msg.sender)}" time="${time}"${replyAttr}>\n`

    // 引用消息
    if (msg.replyTo) {
      xml += `    <quoted_message sender="${escapeXml(msg.replyTo.sender)}">`
      xml += escapeXml(msg.replyTo.content)
      xml += '</quoted_message>\n'
    }

    xml += `    ${escapeXml(msg.content)}\n`
    xml += '  </message>\n'
  }

  xml += '</messages>'
  return xml
}

/**
 * XML 转义 — 防止用户输入破坏 XML 结构
 */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * 剥离 Agent 输出中的内部推理标签
 *
 * Agent 可能用 <internal>...</internal> 包裹内部思考过程，
 * 这些内容不应该发送给用户。
 */
export function stripInternalTags(text: string): string {
  return text.replace(/<internal>[\s\S]*?<\/internal>/g, '').trim()
}

/**
 * 格式化出站消息 — 清理 Agent 输出
 */
export function formatOutbound(text: string): string {
  return stripInternalTags(text)
}
