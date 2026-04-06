import { initDatabase, storeMessage, storeChatMetadata, createTask } from './db.js'
import { startMessageLoop, stopMessageLoop } from './message-loop.js'
import { startSchedulerLoop } from './task-scheduler.js'
import type { RegisteredGroup } from './types.js'

const groups: RegisteredGroup[] = [
  { name: 'Main', folder: 'main', chatJid: 'main@s.whatsapp.net', isMain: true },
]

function seedTasks(): void {
  // 创建一个 interval 任务（每 15 秒执行一次，方便观察）
  createTask({
    id: crypto.randomUUID(),
    groupFolder: 'main',
    prompt: '报告当前系统状态',
    scheduleType: 'interval',
    scheduleValue: '15000',
    contextMode: 'isolated',
    nextRun: new Date(Date.now() + 5000).toISOString(), // 5 秒后首次执行
    status: 'active',
  })

  // 创建一个 once 任务（8 秒后执行一次）
  createTask({
    id: crypto.randomUUID(),
    groupFolder: 'main',
    prompt: '发送一次性提醒：该喝水了！',
    scheduleType: 'once',
    scheduleValue: new Date(Date.now() + 8000).toISOString(),
    contextMode: 'isolated',
    nextRun: new Date(Date.now() + 8000).toISOString(),
    status: 'active',
  })

  console.log('已创建 2 个示例任务\n')
}

function simulateIncomingMessages(): void {
  storeChatMetadata('main@s.whatsapp.net', 'Main')
  setTimeout(() => {
    console.log(`\n[模拟] Me 发送了消息: "你好"`)
    storeMessage({
      id: crypto.randomUUID(),
      chatJid: 'main@s.whatsapp.net',
      sender: 'Me',
      content: '你好',
      timestamp: new Date().toISOString(),
    })
  }, 3000)
}

process.on('SIGINT', () => {
  stopMessageLoop()
  process.exit(0)
})

console.log('=== NanoClaw Step 08: 任务调度 ===\n')
initDatabase()
seedTasks()
startSchedulerLoop()
startMessageLoop(groups)
simulateIncomingMessages()
