import { initDatabase, storeMessage, storeChatMetadata } from './db.js'
import { startMessageLoop, stopMessageLoop } from './message-loop.js'

function simulateIncomingMessages(): void {
  const chatJid = 'group-demo@g.us'
  storeChatMetadata(chatJid, 'Demo Group')

  const scenarios = [
    { delay: 3000, sender: 'Alice', content: '你好，Andy！' },
    {
      delay: 5000,
      sender: 'Bob',
      content: '我也在！',
      replyTo: { id: 'msg-1', sender: 'Alice', content: '你好，Andy！' },
    },
    { delay: 8000, sender: 'Alice', content: '帮我查一下 <script>alert(1)</script>' },
  ]

  for (const { delay, sender, content, replyTo } of scenarios) {
    setTimeout(() => {
      const msg = {
        id: crypto.randomUUID(),
        chatJid,
        sender,
        content,
        timestamp: new Date().toISOString(),
        replyTo,
      }
      console.log(`\n[模拟] ${sender} 发送了消息: "${content}"`)
      storeMessage(msg)
    }, delay)
  }
}

process.on('SIGINT', () => {
  stopMessageLoop()
  process.exit(0)
})

console.log('=== NanoClaw Step 03: 消息格式化 ===\n')
initDatabase()
startMessageLoop()
simulateIncomingMessages()
