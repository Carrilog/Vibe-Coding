# Step 05: 流式输出 — 实时推送 Agent 响应

## 为什么需要流式输出？

Step 04 中，Agent 的回复是一次性返回的——容器执行完毕后才发送给用户。但 Claude Agent 可能需要几十秒甚至几分钟来处理复杂任务。

如果等全部完成再发送，用户体验很差（长时间无响应）。NanoClaw 的解决方案：**流式输出**——Agent 每产生一段文字就立即推送给用户。

## 设计决策

**哨兵标记 + 流式解析**

容器的 stdout 是一个持续的字节流。NanoClaw 需要区分：
- Agent 的日志/调试输出（不发给用户）
- Agent 的实际响应（发给用户）

使用哨兵标记分隔：

```
[日志] 正在处理...          ← 忽略
---NANOCLAW_OUTPUT_START--- ← 开始捕获
第一段回复...               ← 实时发送
第二段回复...               ← 实时发送
---NANOCLAW_OUTPUT_END---   ← 停止捕获
[日志] 处理完成             ← 忽略
```

**超时管理**

NanoClaw 原版有两层超时：
- 硬超时：容器最大运行时间（默认 30 分钟）
- 活动超时：收到流式输出时重置计时器

这一步我们实现活动超时。

## 架构变化

```
Step 04:                          Step 05:
Container Runner                  Container Runner
  │                                 │
  │ 等待容器结束                     │ 流式读取 stdout
  │ 一次性返回结果                   │ 实时解析哨兵标记
  │                                 │ 每段输出触发回调
  ▼                                 ▼
处理器(打印)                       处理器(流式打印)
                                     + 超时管理
```

## 文件结构

```
step-05-流式输出/
├── src/
│   ├── index.ts
│   ├── db.ts
│   ├── message-loop.ts
│   ├── router.ts
│   ├── processor.ts
│   ├── container-runner.ts   # 更新：流式输出 + 超时
│   ├── mock-agent.ts         # 更新：分段输出
│   └── types.ts
├── package.json
└── tsconfig.json
```

## 运行

```bash
cd step-05-流式输出
npm install
npx tsx src/index.ts
```

你会看到 Agent 的回复是逐段出现的，而不是一次性打印。

## 关键代码解读

### 流式输出解析 (`container-runner.ts`)

核心是一个状态机，跟踪是否在哨兵标记之间：

```typescript
let capturing = false
child.stdout.on('data', (chunk) => {
  for (const line of chunk.toString().split('\n')) {
    if (line.includes(OUTPUT_START)) { capturing = true; continue }
    if (line.includes(OUTPUT_END)) { capturing = false; continue }
    if (capturing) onOutput(line)  // 实时回调
  }
})
```

### 超时重置

每次收到流式输出时重置超时计时器：

```typescript
if (capturing) {
  clearTimeout(timer)
  timer = setTimeout(() => kill(), TIMEOUT)
}
```

NanoClaw 原版也是这个模式——只要 Agent 还在产生输出，就不会超时。
