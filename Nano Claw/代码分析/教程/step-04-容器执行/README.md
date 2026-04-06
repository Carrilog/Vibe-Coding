# Step 04: 容器执行 — 在隔离环境中运行 Agent

## 为什么需要容器？

到 Step 03 为止，消息处理只是"打印"。真正的 NanoClaw 需要把消息交给 Claude Agent 处理。

但直接在宿主机进程里运行 Agent 有严重问题：
- Agent 可以读写宿主机的任何文件
- Agent 可以执行任意命令
- 不同群组的 Agent 会互相干扰

**NanoClaw 的解决方案**：每个群组的 Agent 在独立的 Docker 容器中运行。容器只能看到挂载进去的目录。

## 设计决策

**stdin/stdout 协议**

NanoClaw 的容器通信非常简单：
- 宿主机通过 **stdin** 发送 JSON（包含 prompt、sessionId 等）
- 容器通过 **stdout** 返回结果（用哨兵标记分隔）

```
宿主机                    容器
  │                        │
  │── stdin: JSON ────────→│
  │                        │── Claude Agent SDK 处理
  │                        │
  │←── stdout: 哨兵标记 ───│
  │                        │
```

**为什么不用 HTTP/gRPC？**
- stdin/stdout 是最简单的 IPC 方式
- 不需要网络配置
- Docker 原生支持

## 本步骤的简化

由于教程环境可能没有 Docker，我们用**子进程**模拟容器行为：
- `container-runner.ts` — 启动子进程，发送 stdin，读取 stdout
- `mock-agent.ts` — 模拟容器内的 Agent（读 stdin JSON，写 stdout 结果）

协议与 NanoClaw 原版完全一致，只是把 `docker run` 换成了 `tsx mock-agent.ts`。

## 架构变化

```
Step 03:                          Step 04:
消息循环                           消息循环
  │                                 │
  ▼                                 ▼
路由器(XML)                        路由器(XML)
  │                                 │
  ▼                                 ▼
处理器(打印)                       ┌──────────────────┐
                                   │ Container Runner  │ ← 新增
                                   │ (启动子进程)       │
                                   └────────┬─────────┘
                                            │ stdin/stdout
                                            ▼
                                   ┌──────────────────┐
                                   │ Mock Agent        │ ← 新增
                                   │ (模拟容器内Agent)  │
                                   └──────────────────┘
```

## 文件结构

```
step-04-容器执行/
├── src/
│   ├── index.ts
│   ├── db.ts
│   ├── message-loop.ts
│   ├── router.ts
│   ├── processor.ts          # 更新：调用 container-runner
│   ├── container-runner.ts   # 新增：启动子进程/容器
│   ├── mock-agent.ts         # 新增：模拟容器内 Agent
│   └── types.ts
├── package.json
└── tsconfig.json
```

## 运行

```bash
cd step-04-容器执行
npm install
npx tsx src/index.ts
```

## 关键代码解读

### Container Runner (`container-runner.ts`)

NanoClaw 原版的 `runContainerAgent()` 做了很多事：
1. `buildVolumeMounts()` — 构建挂载列表
2. `buildContainerArgs()` — 构建 docker run 命令
3. 启动容器，写入 stdin
4. 监听 stdout 流，解析哨兵标记
5. 超时管理

这一步我们实现核心的 stdin/stdout 协议，挂载和超时留到后续步骤。

### 哨兵标记

容器的 stdout 可能混杂日志和其他输出。NanoClaw 用哨兵标记分隔真正的 Agent 响应：

```
[一些日志...]
---NANOCLAW_OUTPUT_START---
Agent 的实际响应
---NANOCLAW_OUTPUT_END---
[更多日志...]
```

宿主机只提取标记之间的内容。
