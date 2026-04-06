# Step 06: IPC 通信 — 容器与宿主机的双向对话

## 为什么需要 IPC？

到 Step 05 为止，通信是单向的：宿主机 → 容器（stdin），容器 → 宿主机（stdout）。

但 Agent 在容器内运行时，可能需要：
1. **发送消息** — Agent 想主动给某个聊天发消息
2. **创建定时任务** — Agent 想安排一个定期执行的任务
3. **接收追加消息** — 容器运行期间，用户又发了新消息

这些都需要容器和宿主机之间的**双向通信**。

## 设计决策

**为什么用文件系统而不是 socket？**

| 方面 | 文件 IPC | Socket |
|------|---------|--------|
| 实现复杂度 | 低（读写文件） | 高（连接管理） |
| 容器配置 | 挂载目录即可 | 需要网络配置 |
| 可调试性 | 直接 `ls` 查看 | 需要抓包 |
| 延迟 | 1s（轮询） | 实时 |

NanoClaw 的消息频率很低，1 秒延迟完全可接受。

## IPC 协议

```
容器 → 宿主机（出站）:
  容器写入 JSON 文件到 ipc/messages/ 或 ipc/tasks/
  宿主机每 1s 扫描目录，处理后删除文件

宿主机 → 容器（入站）:
  宿主机写入 JSON 文件到 ipc/input/
  容器轮询读取，注入到 Agent 的 MessageStream
```

## 文件结构

```
step-06-IPC通信/
├── src/
│   ├── index.ts
│   ├── db.ts
│   ├── message-loop.ts
│   ├── router.ts
│   ├── processor.ts
│   ├── container-runner.ts
│   ├── ipc-watcher.ts       # 新增：宿主机端 IPC 监听
│   ├── mock-agent.ts         # 更新：写入 IPC 文件
│   └── types.ts
├── package.json
└── tsconfig.json
```

## 运行

```bash
cd step-06-IPC通信
npm install
npx tsx src/index.ts
```

你会看到 Agent 通过 IPC 发送消息，宿主机端接收并处理。

## 关键代码解读

### IPC Watcher (`ipc-watcher.ts`)

宿主机端的 IPC 监听器，每 1 秒扫描 IPC 目录：

```typescript
// 扫描 messages/ — Agent 想发送消息
for (const file of readdirSync(messagesDir)) {
  const msg = JSON.parse(readFileSync(file))
  console.log(`[IPC] Agent 发送消息到 ${msg.chatJid}: ${msg.content}`)
  unlinkSync(file) // 处理后删除
}

// 扫描 tasks/ — Agent 想操作任务
for (const file of readdirSync(tasksDir)) {
  const op = JSON.parse(readFileSync(file))
  processTaskIpc(op)
  unlinkSync(file)
}
```

### 容器端 IPC 写入

Agent 通过 MCP 工具写入 IPC 文件：

```typescript
// 发送消息
writeFileSync(`/workspace/ipc/messages/${uuid}.json`, JSON.stringify({
  chatJid: 'group@g.us',
  content: '这是 Agent 主动发的消息'
}))
```

### 入站 IPC（追加消息）

用户在容器运行期间发了新消息，宿主机写入 `ipc/input/`，容器轮询读取：

```typescript
// 宿主机端
writeFileSync(`ipc/input/${uuid}.json`, JSON.stringify({ content: newMessage }))

// 容器端（Agent Runner 轮询）
const files = readdirSync('/workspace/ipc/input/')
for (const file of files) {
  const msg = JSON.parse(readFileSync(file))
  messageStream.push(msg.content)
  unlinkSync(file)
}
```
