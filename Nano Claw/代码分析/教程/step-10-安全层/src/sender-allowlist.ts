/**
 * 发送者白名单
 *
 * 对应 NanoClaw 原版 src/sender-allowlist.ts。
 * 控制哪些发送者可以触发 Agent。
 */

export interface ChatAllowlistEntry {
  allow: '*' | string[]
  mode: 'trigger' | 'drop'
}

export interface SenderAllowlistConfig {
  default: ChatAllowlistEntry
  chats: Record<string, ChatAllowlistEntry>
  logDenied: boolean
}

const DEFAULT_CONFIG: SenderAllowlistConfig = {
  default: { allow: '*', mode: 'trigger' },
  chats: {},
  logDenied: true,
}

let config: SenderAllowlistConfig = DEFAULT_CONFIG

/** 加载配置（真实场景从 ~/.config/nanoclaw/sender-allowlist.json 读取） */
export function loadSenderAllowlist(cfg?: SenderAllowlistConfig): void {
  config = cfg ?? DEFAULT_CONFIG
}

/** 检查发送者是否在白名单中 */
export function isSenderAllowed(chatJid: string, sender: string): boolean {
  const entry = config.chats[chatJid] ?? config.default
  if (entry.allow === '*') return true
  return entry.allow.includes(sender)
}

/** 检查消息是否应该被丢弃（drop 模式） */
export function shouldDropMessage(chatJid: string, sender: string): boolean {
  const entry = config.chats[chatJid] ?? config.default
  if (entry.mode !== 'drop') return false
  if (!isSenderAllowed(chatJid, sender)) {
    if (config.logDenied) console.log(`[白名单] 丢弃消息: ${sender} → ${chatJid}`)
    return true
  }
  return false
}

/** 检查发送者是否可以触发 Agent */
export function isTriggerAllowed(chatJid: string, sender: string): boolean {
  const entry = config.chats[chatJid] ?? config.default
  const allowed = isSenderAllowed(chatJid, sender)
  if (!allowed && config.logDenied) {
    console.log(`[白名单] ${sender} 的消息已存储但不触发 Agent (${entry.mode} 模式)`)
  }
  return allowed
}
