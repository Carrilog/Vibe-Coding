/**
 * 类型定义 — 扩展了 chatJid 和 isBot 字段
 *
 * 相比 Step 01，新增：
 *   - chatJid: 消息所属的聊天标识（NanoClaw 用 WhatsApp 的 JID 格式）
 *   - isBot: 是否是 bot 自己发的消息（避免自己触发自己）
 */

export interface Message {
  id: string
  chatJid?: string
  sender: string
  content: string
  timestamp: string
  isBot?: boolean
}
