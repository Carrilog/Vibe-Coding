# Step 07: 分组队列 — 并发控制

## 为什么需要分组队列？

到 Step 06 为止，消息是串行处理的——一条处理完才处理下一条。但 NanoClaw 支持多个群组，每个群组需要独立的容器。

问题来了：
- 如果同时有 10 个群组收到消息，启动 10 个容器会耗尽资源
- 同一个群组的消息应该排队，不能并发处理（会话冲突）
- 容器空闲时应该复用，不是每次都重启

**GroupQueue 解决这些问题**：每个群组一个队列，全局限制并发容器数。

## 设计决策

**每组一个队列 + 全局并发限制**

```
全局并发限制: MAX_CONCURRENT = 3

Group-main:  [ACTIVE]  ← 容器运行中
Group-A:     [IDLE]    ← 容器空闲，等待新消息
Group-B:     [QUEUED]  ← 等待槽位
Group-C:     [QUEUED]  ← 等待槽位
```

**容器状态机**

```
IDLE → ACTIVE → IDLE_WAITING → ACTIVE (收到新消息)
                              → IDLE (超时关闭)
```

**指数退避重试**

容器启动失败时：`5s → 10s → 20s → 40s → 80s`，最多 5 次。

## 文件结构

```
step-07-分组队列/
├── src/
│   ├── index.ts
│   ├── db.ts
│   ├── message-loop.ts      # 更新：按分组分发
│   ├── router.ts
│   ├── processor.ts
│   ├── container-runner.ts
│   ├── group-queue.ts        # 新增：分组队列管理
│   ├── mock-agent.ts
│   ├── ipc-watcher.ts
│   └── types.ts              # 扩展：RegisteredGroup
├── package.json
└── tsconfig.json
```

## 运行

```bash
cd step-07-分组队列
npm install
npx tsx src/index.ts
```

## 关键代码解读

### GroupQueue 核心逻辑

```typescript
class GroupQueue {
  // 每个分组的状态
  groups: Map<string, {
    active: boolean       // 容器是否运行中
    idleWaiting: boolean  // 容器是否空闲等待
    pending: Function[]   // 待处理回调队列
    retryCount: number    // 重试计数
  }>

  // 入队：如果有空闲容器就复用，否则排队
  enqueue(groupFolder, callback) {
    if (idleWaiting) → sendIpcInput() // 复用空闲容器
    else if (activeCount < MAX) → callback() // 启动新容器
    else → pending.push(callback) // 排队等待
  }

  // 容器完成后：释放槽位，处理下一个排队的分组
  release(groupFolder) {
    activeCount--
    // 找到下一个有待处理任务的分组
    for (const [folder, state] of groups) {
      if (state.pending.length > 0) {
        state.pending.shift()() // 启动
        break
      }
    }
  }
}
```

### 与 NanoClaw 原版的对应

NanoClaw 原版 `src/group-queue.ts` 的 `GroupQueue` 类更复杂，还包括：
- 任务优先级（任务 > 消息）
- `closeStdin()` 信号容器收尾
- `shutdown()` 优雅关闭（分离容器而非杀死）
- 进程注册和跟踪

这一步实现核心的并发控制逻辑。
