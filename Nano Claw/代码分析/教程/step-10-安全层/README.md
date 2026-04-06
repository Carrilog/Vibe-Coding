# Step 10: 安全层 — 保护你的 Agent

## 为什么需要安全层？

NanoClaw 的 Agent 运行在容器中，能读写文件、执行命令。如果没有安全措施：

- 恶意用户可能通过 prompt injection 让 Agent 读取敏感文件
- 容器可能挂载到 `.ssh`、`.aws` 等目录
- 任何人都能触发 Agent，消耗你的 API 额度

NanoClaw 用**多层防御**解决这些问题。

## 安全层次

```
┌─────────────────────────────────────────────┐
│ 第 1 层: 发送者白名单 (sender-allowlist)     │
│   谁可以触发 Agent？                         │
├─────────────────────────────────────────────┤
│ 第 2 层: 路径验证 (group-folder)             │
│   分组目录名是否合法？防止路径穿越            │
├─────────────────────────────────────────────┤
│ 第 3 层: 挂载安全 (mount-security)           │
│   容器可以访问哪些宿主机目录？               │
├─────────────────────────────────────────────┤
│ 第 4 层: 容器隔离 (Docker)                   │
│   OS 级隔离，Agent 只能看到挂载的目录         │
├─────────────────────────────────────────────┤
│ 第 5 层: 凭证隔离 (OneCLI)                   │
│   API Key 永远不进入容器                     │
└─────────────────────────────────────────────┘
```

## 文件结构

```
step-10-安全层/
├── src/
│   ├── index.ts
│   ├── sender-allowlist.ts   # 新增：发送者白名单
│   ├── group-folder.ts       # 新增：路径验证
│   ├── mount-security.ts     # 新增：挂载安全
│   ├── db.ts
│   ├── router.ts
│   ├── mock-agent.ts
│   └── types.ts
├── package.json
└── tsconfig.json
```

## 运行

```bash
cd step-10-安全层
npm install
npx tsx src/index.ts
```

## 关键代码解读

### 1. 发送者白名单 (`sender-allowlist.ts`)

控制谁可以触发 Agent：

```json
// ~/.config/nanoclaw/sender-allowlist.json
{
  "default": { "allow": "*", "mode": "trigger" },
  "chats": {
    "spam-group@g.us": {
      "allow": [],
      "mode": "drop"
    }
  }
}
```

两种模式：
- `trigger`：非白名单用户的消息存储但不触发 Agent
- `drop`：非白名单用户的消息直接丢弃

### 2. 路径验证 (`group-folder.ts`)

防止路径穿越攻击：

```typescript
isValidGroupFolder('main')        // true
isValidGroupFolder('dev-team')    // true
isValidGroupFolder('../etc')      // false — 路径穿越
isValidGroupFolder('global')      // false — 保留名
isValidGroupFolder('a/b')         // false — 包含分隔符
```

### 3. 挂载安全 (`mount-security.ts`)

验证容器挂载请求：

```typescript
validateMount({
  hostPath: '/Users/me/projects',
  containerPath: 'projects',
  readWrite: true
})
// ✓ 通过：在 allowedRoots 内

validateMount({
  hostPath: '/Users/me/.ssh',
  containerPath: 'ssh',
  readWrite: false
})
// ✗ 拒绝：匹配 blockedPatterns
```

**关键设计**：allowlist 文件存储在 `~/.config/nanoclaw/`（项目外部），容器无法篡改。
