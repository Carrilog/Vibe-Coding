/**
 * 消息处理器 — Channel 版本，回复通过 Channel 发送
 */

import type { Message, Channel } from './types.js'
import { formatMessages, formatOutbound } from './router.js'
import { runContainerAgent } from './container-runner.js'

export async function processGroupMessages(
  messages: Message[],
  channel: Channel,
): Promise<void> {
  const prompt = formatMessages(messages)
  const chatJid = messages[0].chatJid ?? 'unknown'

  try {
    await channel.setTyping(chatJid, true)

    const result = await runContainerAgent({
      input: { prompt, sessionId: null, groupFolder: 'main' },
      onOutput: () => {},
    })

    await channel.setTyping(chatJid, false)
    const cleaned = formatOutbound(result.output)
    await channel.sendMessage(chatJid, cleaned)
  } catch (err) {
    await channel.setTyping(chatJid, false)
    console.error('[错误] 容器执行失败:', err)
  }
}
