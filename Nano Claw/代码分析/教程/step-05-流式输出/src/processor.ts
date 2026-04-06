/**
 * 消息处理器 — 流式输出版本
 */

import type { Message } from './types.js'
import { formatMessages, formatOutbound } from './router.js'
import { runContainerAgent } from './container-runner.js'

export async function processMessages(messages: Message[]): Promise<void> {
  const prompt = formatMessages(messages)
  console.log('\n--- 发送 prompt 到容器（流式输出）---')

  try {
    const result = await runContainerAgent({
      input: { prompt, sessionId: null, groupFolder: 'main' },
      onOutput: (chunk) => {
        // 实时推送给用户（真实场景调用 channel.sendMessage）
        console.log(`  >> ${formatOutbound(chunk)}`)
      },
    })

    console.log(`\n[完成] 总输出: ${result.output.length} 字符`)
  } catch (err) {
    console.error('[错误] 容器执行失败:', err)
  }
}
