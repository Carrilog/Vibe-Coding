/**
 * 消息处理器 — 现在调用容器执行 Agent
 */

import type { Message } from './types.js'
import { formatMessages, formatOutbound } from './router.js'
import { runContainerAgent } from './container-runner.js'

export async function processMessages(messages: Message[]): Promise<void> {
  const prompt = formatMessages(messages)
  console.log('\n--- 发送 prompt 到容器 ---')

  try {
    const result = await runContainerAgent({
      prompt,
      sessionId: null,
      groupFolder: 'main',
    })

    const cleaned = formatOutbound(result.output)
    console.log(`\n[Agent 回复] ${cleaned}`)
  } catch (err) {
    console.error('[错误] 容器执行失败:', err)
  }
}
