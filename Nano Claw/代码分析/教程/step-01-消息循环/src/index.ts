/**
 * 入口文件 — 启动 NanoClaw 最小版本
 *
 * 对应 NanoClaw 原版 src/index.ts 中的 main()。
 * 原版的 main() 做了很多初始化（DB、Channel、IPC...），
 * 这里只做两件事：
 *   1. 启动消息循环
 *   2. 模拟外部消息输入
 */

import { storeMessage } from './message-store.js'
import { startMessageLoop, stopMessageLoop } from './message-loop.js'

// 模拟外部消息输入（真实场景中由 Channel 写入）
function simulateIncomingMessages(): void {
  const scenarios = [
    { delay: 3000, sender: 'Alice', content: '你好，Andy！' },
    { delay: 5000, sender: 'Bob', content: '今天天气怎么样？' },
    { delay: 8000, sender: 'Alice', content: '帮我查一下明天的日程' },
  ]

  for (const { delay, sender, content } of scenarios) {
    setTimeout(() => {
      const msg = {
        id: crypto.randomUUID(),
        sender,
        content,
        timestamp: new Date().toISOString(),
      }
      console.log(`\n[模拟] ${sender} 发送了消息: "${content}"`)
      storeMessage(msg)
    }, delay)
  }
}

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n\n正在停止...')
  stopMessageLoop()
  process.exit(0)
})

// 启动
console.log('=== NanoClaw Step 01: 消息循环 ===\n')
startMessageLoop()
simulateIncomingMessages()
