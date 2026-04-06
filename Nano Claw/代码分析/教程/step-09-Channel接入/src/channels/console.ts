/**
 * Console Channel — 命令行渠道
 *
 * 用 readline 读取终端输入，模拟消息平台。
 * 展示 Channel 接口的完整实现。
 */

import readline from 'node:readline'
import { registerChannel } from './registry.js'
import type { Channel, OnInboundMessage } from '../types.js'

const CHAT_JID = 'console@local'

function createConsoleChannel(): Channel {
  let rl: readline.Interface | null = null
  let onMessage: OnInboundMessage | null = null

  return {
    name: 'console',

    async connect(callback: OnInboundMessage): Promise<void> {
      onMessage = callback

      rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: '\n你> ',
      })

      rl.on('line', (line) => {
        const content = line.trim()
        if (!content) { rl?.prompt(); return }
        if (content === 'exit') { process.exit(0) }

        onMessage?.({
          id: crypto.randomUUID(),
          chatJid: CHAT_JID,
          sender: 'You',
          content,
          timestamp: new Date().toISOString(),
          channel: 'console',
          isGroup: false,
        })
      })

      console.log('[Console Channel] 已连接。输入消息与 Agent 对话，输入 exit 退出。')
      rl.prompt()
    },

    async sendMessage(_chatJid: string, text: string): Promise<void> {
      console.log(`\nAndy> ${text}`)
      rl?.prompt()
    },

    async setTyping(): Promise<void> {
      // 终端不需要输入状态
    },

    async disconnect(): Promise<void> {
      rl?.close()
    },
  }
}

// 自注册
registerChannel('console', { create: createConsoleChannel })
