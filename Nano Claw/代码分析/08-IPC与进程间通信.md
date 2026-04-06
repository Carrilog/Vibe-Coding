# IPC 与进程间通信

## 概述

NanoClaw 使用文件系统作为宿主机与容器之间的 IPC（进程间通信）机制。容器通过写入 JSON 文件发送消息和任务操作，宿主机通过轮询目录读取这些文件。

## IPC 目录结构

```
groups/{folder}/ipc/
├── messages/           # 容器 → 宿主机：发送消息请求
│   └── {uuid}.json     # 每个消息一个文件
├── tasks/              # 容器 → 宿主机：任务操作请求
│   └── {uuid}.json     # 每个操作一个文件
├── input/              # 宿主机 → 容器：追加消息
│   └── {uuid}.json     # 容器轮询读取
├── errors/             # 处理失败的 IPC 文件
├── tasks-snapshot.json # 宿主机 → 容器：当前任务列表快照
└── groups-snapshot.json# 宿主机 → 容器：可用分组列表快照
```

## 出站 IPC（容器 → 宿主机）

### 消息发送

```json
// messages/{uuid}.json
{
  "chatJid": "group-123@g.us",
  "content": "Hello from the agent!",
  "channel": "whatsapp"
}
```

处理流程：
```
容器写入文件 → IPC Watcher 检测 → routeOutbound() → Channel.sendMessage()
```

### 任务操作

```json
// tasks/{uuid}.json — 创建任务
{
  "operation": "schedule_task",
  "prompt": "检查服务器状态",
  "schedule_type": "cron",
  "schedule_value": "0 */6 * * *",
  "context_mode": "isolated"
}

// tasks/{uuid}.json — 暂停任务
{
  "operation": "pause_task",
  "task_id": "task-xxx"
}

// tasks/{uuid}.json — 注册分组
{
  "operation": "register_group",
  "name": "dev-team",
  "folder": "dev-team",
  "trigger_pattern": "\\bdev\\b",
  "channel": "telegram"
}
```

### 支持的操作

| operation | 权限 | 说明 |
|-----------|------|------|
| `schedule_task` | main: 任意分组; 非main: 仅自己 | 创建定时任务 |
| `pause_task` | 同上 | 暂停任务 |
| `resume_task` | 同上 | 恢复任务 |
| `cancel_task` | 同上 | 删除任务 |
| `update_task` | 同上 | 更新任务参数 |
| `register_group` | 仅 main | 注册新分组 |
| `refresh_groups` | 仅 main | 同步分组元数据 |

## 入站 IPC（宿主机 → 容器）

### 追加消息

当容器处于 IDLE_WAITING 状态时，新消息通过 IPC 注入：

```
用户发送新消息
    │
    ▼
GroupQueue.sendMessage(group, formattedXml)
    │
    ▼
写入文件到 groups/{folder}/ipc/input/{uuid}.json
    │
    ▼
容器内 Agent Runner 轮询 /workspace/ipc/input/
    │
    ▼
读取文件 → MessageStream.push() → Agent 继续处理
```

### 快照文件

宿主机在启动容器前写入快照：

```json
// tasks-snapshot.json — 当前分组的任务列表
[
  {
    "id": "task-xxx",
    "prompt": "检查状态",
    "schedule_type": "cron",
    "schedule_value": "0 9 * * *",
    "status": "active",
    "next_run": "2026-04-06T01:00:00Z"
  }
]

// groups-snapshot.json — 可用分组列表
[
  { "name": "Main", "folder": "main", "isMain": true },
  { "name": "Dev Team", "folder": "dev-team", "isMain": false }
]
```

## IPC Watcher 实现

```typescript
// src/ipc.ts
startIpcWatcher(groups, callbacks)

// 每 1 秒扫描所有分组的 IPC 目录:
for (const group of groups) {
  // 扫描 messages/ 目录
  for (const file of readdir(ipcPath + '/messages/')) {
    const msg = JSON.parse(readFile(file))
    await routeOutbound(msg.channel, msg.chatJid, msg.content)
    unlink(file)  // 处理后删除
  }
  
  // 扫描 tasks/ 目录
  for (const file of readdir(ipcPath + '/tasks/')) {
    const op = JSON.parse(readFile(file))
    await processTaskIpc(op, group)
    unlink(file)  // 处理后删除
  }
}
```

## 错误处理

```
IPC 文件处理失败:
  ├── JSON 解析错误 → 移到 errors/
  ├── 权限不足 → 移到 errors/ + 日志
  ├── 操作执行失败 → 移到 errors/ + 日志
  └── 文件读取失败 → 跳过，下次重试
```

## MCP 服务器（容器内）

容器内的 `ipc-mcp-stdio.ts` 提供 MCP 工具接口，底层通过写入 IPC 文件实现：

```
Agent 调用 MCP 工具
    │
    ▼
ipc-mcp-stdio.ts 处理
    │
    ├── send_message → 写入 messages/{uuid}.json
    ├── schedule_task → 写入 tasks/{uuid}.json
    ├── list_tasks → 读取 tasks-snapshot.json
    └── ...
    │
    ▼
宿主机 IPC Watcher 处理
```

### 验证逻辑

MCP 服务器在写入 IPC 文件前进行验证：

```typescript
// Cron 表达式验证
cron-parser.parseExpression(value)

// 间隔验证
const ms = parseInt(value)
if (ms < 60000) throw Error('最小间隔 1 分钟')

// 时间戳验证
const date = new Date(value)
if (date <= new Date()) throw Error('必须是未来时间')
```

## 设计权衡

**为什么用文件系统而不是 socket/gRPC？**

| 方面 | 文件系统 IPC | Socket/gRPC |
|------|-------------|-------------|
| 实现复杂度 | 低 | 高 |
| 容器配置 | 仅需挂载目录 | 需要网络配置 |
| 可调试性 | 直接查看文件 | 需要抓包工具 |
| 可靠性 | 文件持久化 | 连接可能断开 |
| 性能 | 1s 轮询延迟 | 实时 |
| 适用场景 | 低频消息 | 高频通信 |

NanoClaw 的消息频率较低（人类对话速度），1 秒轮询延迟完全可接受。
