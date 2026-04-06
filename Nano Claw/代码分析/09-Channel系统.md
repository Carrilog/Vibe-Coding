# Channel 系统

## 概述

Channel 是 NanoClaw 的消息渠道抽象层。每个消息平台（WhatsApp、Telegram、Slack 等）实现统一的 Channel 接口，通过工厂模式注册到系统中。

## Channel 接口

```typescript
interface Channel {
  name: string
  
  // 连接到消息平台
  connect(onMessage: OnInboundMessage): Promise<void>
  
  // 发送消息
  sendMessage(chatJid: string, text: string): Promise<void>
  
  // 设置"正在输入"状态
  setTyping(chatJid: string, typing: boolean): Promise<void>
  
  // 同步分组信息
  syncGroups(groups: RegisteredGroup[]): Promise<void>
  
  // 断开连接
  disconnect(): Promise<void>
}
```

## 注册机制

### 工厂模式

```typescript
// channels/registry.ts
const channelFactories = new Map<string, ChannelFactory>()

function registerChannel(name: string, factory: ChannelFactory) {
  channelFactories.set(name, factory)
}

function getChannelFactory(name: string): ChannelFactory | undefined {
  return channelFactories.get(name)
}
```

### 自注册

```typescript
// channels/index.ts — 副作用导入触发注册
import './discord'    // registerChannel('discord', discordFactory)
import './gmail'      // registerChannel('gmail', gmailFactory)
import './slack'      // registerChannel('slack', slackFactory)
import './telegram'   // registerChannel('telegram', telegramFactory)
// WhatsApp 通过 skill 加载
```

### 启动流程

```
main()
  │
  ├── import 'channels/index.ts'
  │   └── 各 Channel 自注册到 registry
  │
  ├── 遍历已注册分组，收集需要的 Channel 名称
  │
  ├── 对每个 Channel:
  │   ├── getChannelFactory(name)
  │   ├── factory.create(config)
  │   └── channel.connect(onInboundMessage)
  │
  └── channel.syncGroups(registeredGroups)
```

## 消息回调

```typescript
type OnInboundMessage = (message: {
  chatJid: string       // 聊天标识
  sender: string        // 发送者
  content: string       // 消息内容
  timestamp: string     // ISO 时间戳
  replyTo?: {           // 引用消息
    id: string
    sender: string
    content: string
  }
  channel: string       // 渠道名称
  isGroup: boolean      // 是否群组消息
}) => Promise<void>
```

## 可用渠道

### 核心渠道（通过 Skills 安装）

| 渠道 | Skill | 连接方式 | 说明 |
|------|-------|----------|------|
| WhatsApp | `add-whatsapp` | WebSocket (Baileys) | QR 码或配对码认证 |
| Telegram | `add-telegram` | Bot API (Long Polling) | Bot Token |
| Slack | `add-slack` | Socket Mode | App Token + Bot Token |
| Discord | `add-discord` | Gateway WebSocket | Bot Token |
| Gmail | `add-gmail` | Google API (OAuth) | 可作为工具或完整渠道 |

### 特殊渠道

| 渠道 | Skill | 说明 |
|------|-------|------|
| Emacs | `add-emacs` | 本地 HTTP 桥接，Emacs buffer 交互 |
| CLI (claw) | `claw` | 命令行直接与 Agent 对话 |

## Skills as Branches

渠道以 git branch 形式存在，不是核心代码的一部分：

```bash
# 安装 WhatsApp 渠道
git merge origin/skill/whatsapp

# 安装 Telegram 渠道
git merge origin/skill/telegram

# 安装 Slack 渠道
git merge origin/skill/slack
```

这种设计的优点：
- 核心代码保持精简
- 用户只安装需要的渠道
- 渠道可以独立更新
- 避免不必要的依赖

## 消息路由

```
入站路由:
  Channel.onInboundMessage()
    │
    ├── storeChatMetadata() → DB
    ├── storeMessage() → DB
    │
    └── 消息循环处理:
        ├── 按 chatJid 匹配分组
        ├── Trigger 检查
        ├── Sender Allowlist 检查
        └── GroupQueue.enqueueMessageCheck()

出站路由:
  Agent 输出 / IPC 消息
    │
    ├── routeOutbound(channel, chatJid, text)
    │   ├── findChannel(channelName)
    │   └── channel.sendMessage(chatJid, text)
    │
    └── 或: channel.setTyping(chatJid, true)
        └── ... Agent 处理中 ...
        └── channel.setTyping(chatJid, false)
```

## 分组与渠道的关系

```
一个分组绑定一个渠道:

RegisteredGroup {
  name: "Dev Team"
  folder: "dev-team"
  channel: "telegram"      ← 绑定到 Telegram
  trigger_pattern: "\\bdev\\b"
}

多个分组可以使用同一个渠道:

WhatsApp Channel
  ├── Main 分组 (main)
  ├── Family 分组 (family)
  └── Work 分组 (work)

Telegram Channel
  ├── Dev Team 分组 (dev-team)
  └── Alerts 分组 (alerts)
```

## 添加新渠道

要添加一个新的消息渠道，需要：

1. 实现 `Channel` 接口
2. 在 `channels/` 目录创建文件
3. 调用 `registerChannel()` 注册
4. 在 `channels/index.ts` 添加导入

或者使用 `/customize` skill 交互式添加。
