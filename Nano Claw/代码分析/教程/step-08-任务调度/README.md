# Step 08: 任务调度 — 定时执行 Agent

## 为什么需要任务调度？

到目前为止，Agent 只在收到消息时才运行。但很多场景需要**定时执行**：

- 每天早上 9 点发送天气预报
- 每小时检查一次服务器状态
- 明天下午 3 点提醒开会

NanoClaw 内置了任务调度器，支持三种调度类型。

## 调度类型

| 类型 | 示例 | 说明 |
|------|------|------|
| `cron` | `0 9 * * 1-5` | 工作日每天 9 点 |
| `interval` | `3600000` | 每小时（毫秒） |
| `once` | `2026-04-06T09:00:00Z` | 一次性，执行后删除 |

## 设计决策

**context_mode: isolated vs group**

- `isolated`（默认）：每次执行创建新会话，无历史上下文
- `group`：复用分组的当前会话，有完整对话历史

## 文件结构

```
step-08-任务调度/
├── src/
│   ├── index.ts
│   ├── db.ts                 # 扩展：任务表
│   ├── task-scheduler.ts     # 新增：调度循环
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
cd step-08-任务调度
npm install
npx tsx src/index.ts
```

## 关键代码解读

### 调度循环 (`task-scheduler.ts`)

```typescript
// 每 10 秒检查到期任务（原版 60 秒，教程缩短方便观察）
setInterval(() => {
  const dueTasks = getDueTasks()  // next_run <= now && status = 'active'
  for (const task of dueTasks) {
    queue.enqueue(task.groupFolder, () => runTask(task))
  }
}, SCHEDULER_INTERVAL)
```

### 计算下次执行时间

```typescript
function computeNextRun(task) {
  switch (task.scheduleType) {
    case 'cron':
      return cronParser.parseExpression(task.scheduleValue).next().toISOString()
    case 'interval':
      return new Date(Date.now() + parseInt(task.scheduleValue)).toISOString()
    case 'once':
      return null  // 执行后删除
  }
}
```
