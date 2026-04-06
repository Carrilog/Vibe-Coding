import { initDatabase, storeMessage, storeChatMetadata } from './db.js'
import { startMessageLoop, stopMessageLoop } from './message-loop.js'
import { getChannelFactory } from './channels/registry.js'
import type { RegisteredGroup } from './types.js'

// 触发渠道自注册
import './channels/index.js'

const groups: RegisteredGroup[] = [
  { name: 'Main', folder: 'main', chatJid: 'console@local', isMain: true, channel: 'console' },
]

async function main(): Promise<void> {
  console.log('=== NanoClaw Step 09: Channel 接入 ===\n')
  initDatabase()

  // 初始化 Channel
  const factory = getChannelFactory('console')
  if (!factory) throw new Error('Console channel not registered')

  const channel = factory.create()

  // 连接 Channel，注册消息回调
  await channel.connect((msg) => {
    storeChatMetadata(msg.chatJid, 'Console Chat')
    storeMessage({
      id: msg.id,
      chatJid: msg.chatJid,
      sender: msg.sender,
      content: msg.content,
      timestamp: msg.timestamp,
    })
  })

  // 启动消息循环，传入 channel 用于发送回复
  startMessageLoop(groups, channel)

  process.on('SIGINT', () => {
    stopMessageLoop()
    channel.disconnect()
    process.exit(0)
  })
}

main().catch(console.error)
