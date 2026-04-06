# Step 01: 消息循环 — NanoClaw 的心跳

## 为什么从消息循环开始？

NanoClaw 的本质是一个**消息驱动的编排器**。它的核心工作就是：

1. 不断检查"有没有新消息"
2. 有 → 交给 Agent 处理
3. 没有 → 等一会儿再检查

这个"不断检查"的循环就是整个系统的心跳。没有它，什么都不会发生。

## 设计决策

**为什么用轮询而不是事件驱动？**

NanoClaw 选择每 2 秒轮询一次 SQLite，而不是用 WebSocket 推送或事件监听。原因：

- 消息来自多个渠道（WhatsApp、Telegram、Slack...），统一轮询 DB 比每个渠道单独监听更简单
- 人类对话速度慢，2 秒延迟完全可接受
- 轮询天然具有"批量处理"能力——2 秒内的多条消息可以一次性处理
- 实现简单，不需要复杂的事件总线

## 架构

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  消息源       │ ──→ │  消息存储     │ ──→ │  消息循环     │
│  (模拟输入)   │     │  (内存数组)   │     │  (2s 轮询)   │
└──────────────┘     └──────────────┘     └──────────────┘
                                                │
                                                ▼
                                          ┌──────────────┐
                                          │  消息处理     │
                                          │  (打印输出)   │
                                          └──────────────┘
```

这一步我们用内存数组模拟消息存储，下一步再换成 SQLite。

## 文件结构

```
step-01-消息循环/
├── src/
│   ├── index.ts          # 入口：启动消息循环
│   ├── message-store.ts  # 消息存储层（内存模拟）
│   ├── message-loop.ts   # 消息循环核心
│   ├── processor.ts      # 消息处理器
│   └── types.ts          # 类型定义
├── package.json
└── tsconfig.json
```

## 运行

```bash
cd step-01-消息循环
npm install
npx tsx src/index.ts
```

你会看到每 2 秒打印一次检查日志。按 Ctrl+C 退出。

## 关键代码解读

### 消息循环 (`message-loop.ts`)

这是 NanoClaw 最核心的模式——一个带有 `setTimeout` 递归的异步循环：

```typescript
async function tick() {
  const messages = store.getNewMessages(lastTimestamp)
  if (messages.length > 0) {
    await processor.process(messages)
    lastTimestamp = messages[messages.length - 1].timestamp
  }
  setTimeout(tick, POLL_INTERVAL)
}
```

NanoClaw 原版用的也是这个模式（见 `src/index.ts` 的 `startMessageLoop()`），只是多了分组分发、Trigger 匹配等逻辑。

### 为什么用 `setTimeout` 而不是 `setInterval`？

`setTimeout` 递归确保上一次处理完成后才开始下一次等待。如果用 `setInterval`，当处理时间超过间隔时会导致任务堆积。
