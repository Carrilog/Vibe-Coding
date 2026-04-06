# Step 09: Channel 接入 — 连接真实消息平台

## 为什么需要 Channel 抽象？

到目前为止，消息都是模拟的。真实的 NanoClaw 需要连接 WhatsApp、Telegram、Slack 等平台。

每个平台的 API 完全不同，但 NanoClaw 的核心逻辑不应该关心消息来自哪里。**Channel 接口**就是这个抽象层。

## 设计决策

**工厂模式 + 自注册**

```typescript
// 每个渠道实现 Channel 接口
interface Channel {
  name: string
  connect(onMessage): Promise<void>
  sendMessage(chatJid, text): Promise<void>
  disconnect(): Promise<void>
}

// 渠道自注册到全局注册表
registerChannel('telegram', telegramFactory)
registerChannel('slack', slackFactory)
```

**Skills as Branches**

渠道以 git branch 形式存在，不是核心代码：
```bash
git merge origin/skill/whatsapp   # 安装 WhatsApp
git merge origin/skill/telegram   # 安装 Telegram
```

这样核心代码保持精简，用户只安装需要的渠道。

## 本步骤的实现

我们实现一个 **Console Channel**（命令行渠道），让你可以在终端直接与 Agent 对话。这展示了 Channel 接口的完整工作方式，无需配置任何外部服务。

## 架构

```
┌──────────────────────────────────────────────┐
│              Channel Registry                 │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Console  │  │ WhatsApp │  │ Telegram │  │
│  │ Channel  │  │ (skill)  │  │ (skill)  │  │
│  └────┬─────┘  └──────────┘  └──────────┘  │
│       │                                      │
│       │ 统一的 Channel 接口                   │
│       │                                      │
└───────┼──────────────────────────────────────┘
        │
        ▼
  消息循环 → 分组队列 → 容器执行
```

## 文件结构

```
step-09-Channel接入/
├── src/
│   ├── index.ts
│   ├── channels/
│   │   ├── registry.ts       # 新增：渠道注册表
│   │   ├── console.ts        # 新增：命令行渠道
│   │   └── index.ts          # 新增：自注册入口
│   ├── db.ts
│   ├── message-loop.ts
│   ├── router.ts
│   ├── processor.ts
│   ├── container-runner.ts
│   ├── group-queue.ts
│   ├── mock-agent.ts
│   └── types.ts
├── package.json
└── tsconfig.json
```

## 运行

```bash
cd step-09-Channel接入
npm install
npx tsx src/index.ts
```

然后在终端输入消息，Agent 会回复。输入 `exit` 退出。

## 关键代码解读

### Channel 接口 (`types.ts`)

```typescript
interface Channel {
  name: string
  connect(onMessage: OnInboundMessage): Promise<void>
  sendMessage(chatJid: string, text: string): Promise<void>
  setTyping(chatJid: string, typing: boolean): Promise<void>
  disconnect(): Promise<void>
}
```

### 注册表 (`channels/registry.ts`)

```typescript
const factories = new Map()
function registerChannel(name, factory) { factories.set(name, factory) }
function getChannelFactory(name) { return factories.get(name) }
```

### Console Channel

用 `readline` 读取终端输入，模拟消息平台的行为。
