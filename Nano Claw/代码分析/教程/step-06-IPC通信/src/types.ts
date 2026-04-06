export interface Message {
  id: string
  chatJid?: string
  sender: string
  content: string
  timestamp: string
  isBot?: boolean
  replyTo?: {
    id: string
    sender: string
    content: string
  }
}
