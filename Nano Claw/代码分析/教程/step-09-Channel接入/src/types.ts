export interface Message {
  id: string
  chatJid?: string
  sender: string
  content: string
  timestamp: string
  isBot?: boolean
  replyTo?: { id: string; sender: string; content: string }
}

export interface RegisteredGroup {
  name: string
  folder: string
  chatJid: string
  triggerPattern?: string
  isMain: boolean
  channel: string
}

export interface ScheduledTask {
  id: string
  groupFolder: string
  prompt: string
  scheduleType: 'cron' | 'interval' | 'once'
  scheduleValue: string
  contextMode: 'isolated' | 'group'
  nextRun: string
  lastRun?: string
  status: 'active' | 'paused'
}

export interface Channel {
  name: string
  connect(onMessage: OnInboundMessage): Promise<void>
  sendMessage(chatJid: string, text: string): Promise<void>
  setTyping(chatJid: string, typing: boolean): Promise<void>
  disconnect(): Promise<void>
}

export type OnInboundMessage = (message: {
  id: string
  chatJid: string
  sender: string
  content: string
  timestamp: string
  channel: string
  isGroup: boolean
}) => void
