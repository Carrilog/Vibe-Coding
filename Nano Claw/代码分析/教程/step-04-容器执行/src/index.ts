import { initDatabase, storeMessage, storeChatMetadata } from './db.js'
import { startMessageLoop, stopMessageLoop } from './message-loop.js'

function simulateIncomingMessages(): void {
  const chatJid = 'group-demo@g.us'
  storeChatMetadata(chatJid, 'Demo Group')

  const scenarios = [
    { delay: 3000, sender: 'Alice', content: '你好，Andy！' },
    { delay: 7000, sender: 'Bob', content: '今天天气怎么样？' },
    { delay: 11000, sender: 'Alice', content: '帮我查一下明天的日程' },
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

console.log('=== NanoClaw Step 04: 容器执行 ===\n')
initDatabase()
startMessageLoop()
simulateIncomingMessages()
