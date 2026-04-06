/**
 * 入口文件 — 使用 SQLite 的版本
 *
 * 与 Step 01 的区别：
 *   - 先初始化数据库
 *   - 模拟消息写入 SQLite 而非内存
 *   - 重启后能继续处理
 */

import { initDatabase, storeMessage, storeChatMetadata } from './db.js'
import { startMessageLoop, stopMessageLoop } from './message-loop.js'

// 模拟外部消息输入
function simulateIncomingMessages(): void {
  const chatJid = 'group-demo@g.us'
  storeChatMetadata(chatJid, 'Demo Group')

  const scenarios = [
    { delay: 3000, sender: 'Alice', content: '你好，Andy！' },
    { delay: 5000, sender: 'Bob', content: '今天天气怎么样？' },
    { delay: 8000, sender: 'Alice', content: '帮我查一下明天的日程' },
  ]

  for (const { delay, sender, content } of scenarios) {
    setTimeout(() => {
      const msg = {
        id: crypto.randomUUID(),
        chatJid,
        sender,
        content,
        timestamp: new Date().toISOString(),
      }
      console.log(`\n[模拟] ${sender} 发送了消息: "${content}"`)
      storeMessage(msg)
    }, delay)
  }
}

process.on('SIGINT', () => {
  console.log('\n\n正在停止...')
  stopMessageLoop()
  process.exit(0)
})

console.log('=== NanoClaw Step 02: SQLite 数据库 ===\n')
initDatabase()
startMessageLoop()
simulateIncomingMessages()
