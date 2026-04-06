/**
 * Mock Agent — IPC 版本
 *
 * 模拟 Agent 通过 IPC 发送消息和创建任务。
 */

import fs from 'node:fs'
import path from 'node:path'

const OUTPUT_START = '---NANOCLAW_OUTPUT_START---'
const OUTPUT_END = '---NANOCLAW_OUTPUT_END---'

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function main(): Promise<void> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk)
  }
  const input = JSON.parse(Buffer.concat(chunks).toString())

  console.error('[mock-agent] 收到 prompt，开始处理...')

  // 获取 IPC 目录（通过环境变量传入）
  const ipcDir = process.env.IPC_DIR

  // 输出主要回复
  console.log(OUTPUT_START)
  await sleep(300)
  console.log('收到你的消息，正在处理...')

  // 通过 IPC 发送一条额外消息
  if (ipcDir) {
    const messagesDir = path.join(ipcDir, 'messages')
    fs.mkdirSync(messagesDir, { recursive: true })
    fs.writeFileSync(
      path.join(messagesDir, `${crypto.randomUUID()}.json`),
      JSON.stringify({
        chatJid: 'group-demo@g.us',
        content: '（这是 Agent 通过 IPC 主动发送的消息）',
      }),
    )
    console.error('[mock-agent] 已通过 IPC 发送额外消息')
  }

  await sleep(300)
  console.log('处理完成！')
  console.log(OUTPUT_END)

  // 通过 IPC 创建一个定时任务
  if (ipcDir) {
    const tasksDir = path.join(ipcDir, 'tasks')
    fs.mkdirSync(tasksDir, { recursive: true })
    fs.writeFileSync(
      path.join(tasksDir, `${crypto.randomUUID()}.json`),
      JSON.stringify({
        operation: 'schedule_task',
        prompt: '检查系统状态',
        schedule_type: 'interval',
        schedule_value: '3600000',
      }),
    )
    console.error('[mock-agent] 已通过 IPC 创建定时任务')
  }
}

main().catch(console.error)
