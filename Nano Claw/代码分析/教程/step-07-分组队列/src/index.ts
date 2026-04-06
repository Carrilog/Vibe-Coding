import { initDatabase, storeMessage, storeChatMetadata } from './db.js'
import { startMessageLoop, stopMessageLoop } from './message-loop.js'
import type { RegisteredGroup } from './types.js'

// 注册分组（对应 NanoClaw 的 registered_groups 表）
const groups: RegisteredGroup[] = [
  { name: 'Main', folder: 'main', chatJid: 'main@s.whatsapp.net', isMain: true },
  {
    name: 'Dev Team',
    folder: 'dev-team',
    chatJid: 'dev@g.us',
    triggerPattern: '\\bAndy\\b',
    isMain: false,
  },
  {
    name: 'Family',
    folder: 'family',
    chatJid: 'family@g.us',
    triggerPattern: '\\bAndy\\b',
    isMain: false,
  },
]

function simulateIncomingMessages(): void {
  for (const g of groups) storeChatMetadata(g.chatJid, g.name)

  const scenarios = [
    // Main 分组：直接触发
    { delay: 3000, chatJid: 'main@s.whatsapp.net', sender: 'Me', content: '查看系统状态' },
    // Dev Team：包含 Trigger 词
    { delay: 4000, chatJid: 'dev@g.us', sender: 'Alice', content: 'Andy 帮我看看这个 bug' },
    // Family：不包含 Trigger 词（不触发）
    { delay: 5000, chatJid: 'family@g.us', sender: 'Mom', content: '今晚吃什么？' },
    // Family：包含 Trigger 词（触发）
    { delay: 7000, chatJid: 'family@g.us', sender: 'Dad', content: 'Andy 明天天气怎么样？' },
  ]

  for (const { delay, chatJid, sender, content } of scenarios) {
    setTimeout(() => {
      console.log(`\n[模拟] ${sender} → ${chatJid}: "${content}"`)
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

console.log('=== NanoClaw Step 07: 分组队列 ===\n')
initDatabase()
startMessageLoop(groups)
simulateIncomingMessages()
