# Step 02: SQLite 数据库 — 持久化消息

## 为什么需要数据库？

Step 01 的消息存在内存数组里，进程一重启就全丢了。NanoClaw 需要：

1. **消息持久化** — 重启后不丢消息，能从上次处理的位置继续
2. **多渠道写入** — WhatsApp、Telegram 等渠道各自写入消息，消息循环统一读取
3. **状态管理** — 路由状态（cursor）、会话 ID、分组注册信息都需要持久化

## 设计决策

**为什么用 SQLite 而不是 PostgreSQL/Redis？**

- NanoClaw 是单进程单用户系统，不需要网络数据库
- SQLite 是文件数据库，零配置，`npm install` 就能用
- `better-sqlite3` 提供同步 API，代码更简单（不需要 async/await）
- 性能对个人助手场景绰绰有余

**为什么用同步 API？**

NanoClaw 的消息频率很低（人类对话速度），同步 DB 操作不会阻塞事件循环。同步 API 让代码更直观，避免了 callback/promise 嵌套。

## 架构变化

```
Step 01:                          Step 02:
┌──────────┐                      ┌──────────┐
│ 消息源    │                      │ 消息源    │
└────┬─────┘                      └────┬─────┘
     │                                 │
     ▼                                 ▼
┌──────────┐                      ┌──────────┐
│ 内存数组  │  ──── 替换为 ────→   │  SQLite  │
└────┬─────┘                      └────┬─────┘
     │                                 │
     ▼                                 ▼
┌──────────┐                      ┌──────────┐
│ 消息循环  │                      │ 消息循环  │
└──────────┘                      └──────────┘
```

## 文件结构

```
step-02-数据库/
├── src/
│   ├── index.ts          # 入口
│   ├── db.ts             # SQLite 数据库层（新增）
│   ├── message-loop.ts   # 消息循环（复用）
│   ├── processor.ts      # 消息处理器（复用）
│   └── types.ts          # 类型定义（扩展）
├── package.json
└── tsconfig.json
```

## 运行

```bash
cd step-02-数据库
npm install
npx tsx src/index.ts
```

运行后会在当前目录生成 `data/nanoclaw.db` 文件。你可以用 `sqlite3 data/nanoclaw.db` 查看数据。

## 关键代码解读

### 数据库初始化 (`db.ts`)

NanoClaw 原版的 `initDatabase()` 创建了 7 张表。这一步我们只创建最核心的 3 张：

```sql
-- 聊天元数据
CREATE TABLE chats (jid TEXT PRIMARY KEY, name TEXT, ...)

-- 消息历史
CREATE TABLE messages (id TEXT PRIMARY KEY, chat_jid TEXT, sender TEXT, ...)

-- 路由状态（KV 存储，用于持久化 cursor）
CREATE TABLE router_state (key TEXT PRIMARY KEY, value TEXT)
```

### 路由状态持久化

Step 01 的 `lastTimestamp` 存在变量里，重启就丢。现在存到 DB：

```typescript
// 启动时恢复
const cursor = getRouterState('last_timestamp') ?? new Date(0).toISOString()

// 处理后更新
setRouterState('last_timestamp', newTimestamp)
```

这就是 NanoClaw 原版 `loadState()` 和 `router_state` 表的核心用途。

### 迁移策略

NanoClaw 用 `PRAGMA table_info()` 检查列是否存在，缺失则 `ALTER TABLE ADD COLUMN`。这比版本号迁移更简单，适合快速迭代的个人项目。
