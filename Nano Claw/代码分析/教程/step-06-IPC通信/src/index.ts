import fs from 'node:fs'
import path from 'node:path'
import { initDatabase, storeMessage, storeChatMetadata } from './db.js'
import { startMessageLoop, stopMessageLoop } from './message-loop.js'
import { startIpcWatcher } from './ipc-watcher.js'

// 初始化 IPC 目录
const ipcDir = path.join(process.cwd(), 'data', 'ipc', 'main')
for (const sub of ['messages', 'tasks', 'input', 'errors']) {
  fs.mkdirSync(path.join(ipcDir, sub), { recursive: true })
}

function simulateIncomingMessages(): void {
  const chatJid = 'group-demo@g.us'
  storeChatMetadata(chatJid, 'Demo Group')

  const scenarios = [
    { delay: 3000, sender: 'Alice', content: '你好，Andy！' },
    { delay: 8000, sender: 'Bob', content: '今天天气怎么样？' },
  ]

  for (const { delay, sender, content } of scenarios) {
    setTimeout(() => {
      console.log(`\n[模拟] ${sender} 发送了消息: "${content}"`)
      storeMessage({
        id: crypto.randomUUID(),
        chatJid,
        sender,
        content,
        timestamp: new Date().toISOString(),
      })
    }, delay)
  }
}

process.on('SIGINT', () => {
  stopMessageLoop()
  process.exit(0)
})

console.log('=== NanoClaw Step 06: IPC 通信 ===\n')
initDatabase()

// 启动 IPC 监听
startIpcWatcher(ipcDir, {
  onMessage: (msg) => {
    console.log(`\n[IPC 消息] → ${msg.chatJid}: ${msg.content}`)
  },
  onTaskOp: (op) => {
    console.log(`\n[IPC 任务] 操作: ${op.operation}`, op)
  },
})

startMessageLoop()
simulateIncomingMessages()
