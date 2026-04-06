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
