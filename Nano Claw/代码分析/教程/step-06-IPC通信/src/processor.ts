/**
 * 消息处理器 — IPC 版本
 */

import type { Message } from './types.js'
import { formatMessages, formatOutbound } from './router.js'
import { runContainerAgent } from './container-runner.js'
import path from 'node:path'

export async function processMessages(messages: Message[]): Promise<void> {
  const prompt = formatMessages(messages)
  const ipcDir = path.join(process.cwd(), 'data', 'ipc', 'main')

  console.log('\n--- 发送 prompt 到容器（IPC 启用）---')

  try {
    const result = await runContainerAgent({
      input: { prompt, sessionId: null, groupFolder: 'main' },
      ipcDir,
      onOutput: (chunk) => {
        console.log(`  >> ${formatOutbound(chunk)}`)
      },
    })

    console.log(`\n[完成] 总输出: ${result.output.length} 字符`)
  } catch (err) {
    console.error('[错误] 容器执行失败:', err)
  }
}
