# Step 03: 消息格式化 — 把聊天变成 Agent 能读的 XML

## 为什么需要格式化？

Claude Agent SDK 接收的是一段文本 prompt。我们需要把多条聊天消息转换成一种结构化格式，让 Agent 能理解：

- 谁说了什么
- 什么时候说的
- 是否在回复某条消息
- 当前时区和时间

## 设计决策

**为什么用 XML 而不是 JSON？**

NanoClaw 选择 XML 格式，因为：
- Claude 对 XML 标签有很好的理解能力
- XML 的嵌套结构天然适合表达"引用消息"
- 比 JSON 更易读（对 LLM 来说）

**消息格式示例：**

```xml
<context>
  <current_time timezone="Asia/Shanghai">2026-04-05 20:30</current_time>
</context>
<messages>
  <message sender="Alice" time="20:25">你好，Andy！</message>
  <message sender="Bob" time="20:27" reply_to="Alice">
    <quoted_message sender="Alice">你好，Andy！</quoted_message>
    我也在！
  </message>
</messages>
```

## 架构变化

```
Step 02:                          Step 03:
消息循环                           消息循环
  │                                 │
  ▼                                 ▼
处理器(打印)                       ┌──────────┐
                                   │ 路由器    │ ← 新增
                                   │ (XML格式化)│
                                   └────┬─────┘
                                        │
                                        ▼
                                   处理器(打印XML)
```

## 文件结构

```
step-03-消息格式化/
├── src/
│   ├── index.ts
│   ├── db.ts             # 复用
│   ├── message-loop.ts   # 复用
│   ├── router.ts         # 新增：消息格式化与路由
│   ├── processor.ts      # 更新：处理 XML
│   └── types.ts          # 扩展：replyTo
├── package.json
└── tsconfig.json
```

## 运行

```bash
cd step-03-消息格式化
npm install
npx tsx src/index.ts
```

## 关键代码解读

### XML 转义 (`router.ts`)

用户消息可能包含 `<`、`>` 等字符，必须转义防止破坏 XML 结构：

```typescript
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
```

### 内部标签剥离

Agent 的输出可能包含 `<internal>` 标签（内部推理），发给用户前需要移除：

```typescript
function stripInternalTags(text: string): string {
  return text.replace(/<internal>[\s\S]*?<\/internal>/g, '')
}
```

这是 NanoClaw 原版 `router.ts` 的核心功能之一。
