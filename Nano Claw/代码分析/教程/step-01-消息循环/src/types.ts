/**
 * 类型定义 — 消息的基本结构
 *
 * NanoClaw 原版在 src/types.ts 中定义了 NewMessage 接口，
 * 包含 sender、content、timestamp、replyTo 等字段。
 * 这里是最小化版本。
 */

export interface Message {
  id: string
  sender: string
  content: string
  timestamp: string // ISO 格式
}
