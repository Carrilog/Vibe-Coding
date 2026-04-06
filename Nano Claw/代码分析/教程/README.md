# NanoClaw 从零搭建教程

> 从一个空目录开始，一步步搭建 NanoClaw 的核心功能。每一步都是可运行的独立项目，后一步在前一步基础上叠加。

## 前置要求

- Node.js >= 20
- npm

## 教程目录

| Step | 主题 | 新增概念 | 对应原版模块 |
|------|------|----------|-------------|
| [01](step-01-消息循环/) | **消息循环** | 轮询模式、setTimeout 递归 | `src/index.ts` startMessageLoop |
| [02](step-02-数据库/) | **SQLite 数据库** | 持久化、cursor 恢复、WAL 模式 | `src/db.ts` |
| [03](step-03-消息格式化/) | **消息格式化** | XML 格式、转义、内部标签剥离 | `src/router.ts` |
| [04](step-04-容器执行/) | **容器执行** | stdin/stdout 协议、子进程、哨兵标记 | `src/container-runner.ts` |
| [05](step-05-流式输出/) | **流式输出** | 逐行解析、onOutput 回调、活动超时 | `src/container-runner.ts` |
| [06](step-06-IPC通信/) | **IPC 通信** | 文件系统 IPC、双向通信、错误隔离 | `src/ipc.ts` |
| [07](step-07-分组队列/) | **分组队列** | 并发控制、Trigger 匹配、指数退避 | `src/group-queue.ts` |
| [08](step-08-任务调度/) | **任务调度** | cron/interval/once、context_mode | `src/task-scheduler.ts` |
| [09](step-09-Channel接入/) | **Channel 接入** | 工厂模式、自注册、Console Channel | `src/channels/` |
| [10](step-10-安全层/) | **安全层** | 发送者白名单、路径验证、挂载安全 | `src/sender-allowlist.ts` `src/mount-security.ts` `src/group-folder.ts` |

## 快速开始

```bash
# 运行任意一步
cd step-01-消息循环
npm install
npx tsx src/index.ts
```

## 架构演进路线

```
Step 01: 消息循环
  │  "每 2 秒检查有没有新消息"
  │
  ▼
Step 02: + SQLite
  │  "消息持久化，重启不丢"
  │
  ▼
Step 03: + 消息格式化
  │  "把聊天消息变成 Agent 能读的 XML"
  │
  ▼
Step 04: + 容器执行
  │  "在隔离环境中运行 Agent"
  │
  ▼
Step 05: + 流式输出
  │  "Agent 边想边说，不用等全部完成"
  │
  ▼
Step 06: + IPC 通信
  │  "容器和宿主机双向对话"
  │
  ▼
Step 07: + 分组队列
  │  "多群组并发，互不干扰"
  │
  ▼
Step 08: + 任务调度
  │  "定时执行，不只是被动回复"
  │
  ▼
Step 09: + Channel 接入
  │  "连接 WhatsApp/Telegram/Slack..."
  │
  ▼
Step 10: + 安全层
     "保护你的 Agent 不被滥用"
```

## 每步的设计哲学

每个 README 都包含三部分：
1. **为什么** — 这一步解决什么问题
2. **设计决策** — NanoClaw 为什么这样选择（而不是其他方案）
3. **关键代码** — 核心实现的解读

## 与 NanoClaw 原版的对应关系

教程代码是 NanoClaw 核心逻辑的最小化复现。主要简化：

| 教程 | 原版 |
|------|------|
| 内存模拟 → SQLite | 直接 SQLite |
| 子进程模拟容器 | Docker 容器 |
| Console Channel | WhatsApp/Telegram/Slack/Discord/Gmail |
| 固定回复 | Claude Agent SDK |
| 简化 allowlist | 外部 JSON 配置 + 符号链接解析 |

核心协议和架构模式完全一致。
