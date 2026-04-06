/**
 * 消息处理器 — 分组版本
 */

import type { Message, RegisteredGroup } from './types.js'
import { formatMessages, formatOutbound } from './router.js'
import { runContainerAgent } from './container-runner.js'
import { GroupQueue } from './group-queue.js'

export async function processGroupMessages(
  group: RegisteredGroup,
  messages: Message[],
  queue: GroupQueue,
): Promise<void> {
  const prompt = formatMessages(messages)
  console.log(`\n[${group.name}] 处理 ${messages.length} 条消息`)

  try {
    const result = await runContainerAgent({
      input: { prompt, sessionId: null, groupFolder: group.folder },
      onOutput: (chunk) => {
        console.log(`  [${group.name}] >> ${formatOutbound(chunk)}`)
      },
    })

    console.log(`[${group.name}] 完成`)
    queue.release(group.folder)
  } catch (err) {
    console.error(`[${group.name}] 容器执行失败:`, err)
    queue.release(group.folder)
  }
}
