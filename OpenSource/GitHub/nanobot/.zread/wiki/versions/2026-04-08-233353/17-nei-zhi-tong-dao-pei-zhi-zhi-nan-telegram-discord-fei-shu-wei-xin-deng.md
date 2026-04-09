nanobot 内置了 **12 个即时通讯通道**，覆盖了从国际主流平台（Telegram、Discord、Slack）到国内常用工具（飞书、钉钉、企业微信、微信）的完整生态。每个通道都是一个 `BaseChannel` 子类，通过统一的配置体系（`~/.nanobot/config.json` 中的 `channels` 节）进行声明式启用。本文档将逐一讲解每个通道的前置准备、配置参数、连接方式以及常见问题的排查方法。

如果你尚未了解通道的整体架构，建议先阅读 [通道架构：BaseChannel 接口与通道管理器](16-tong-dao-jia-gou-basechannel-jie-kou-yu-tong-dao-guan-li-qi)，再来本文查阅具体通道的配置细节。

Sources: [base.py](nanobot/channels/base.py#L1-L182), [registry.py](nanobot/channels/registry.py#L1-L72)

## 配置总览：所有通道的共性字段

所有通道配置都遵循一个统一的模式——嵌套在 `channels` 对象中，以通道名作为键名。全局通道设置（如重试策略、语音转写）也定义在同一层级。下面是 `ChannelsConfig` 的核心字段：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `sendProgress` | bool | `true` | 是否向通道推送 Agent 的文本处理进度 |
| `sendToolHints` | bool | `false` | 是否推送工具调用提示（如 `read_file("…")`） |
| `sendMaxRetries` | int | `3` | 每条出站消息的最大投递尝试次数（含首次发送） |
| `transcriptionProvider` | string | `"groq"` | 语音转写后端：`"groq"`（免费层）或 `"openai"` |

每个通道都共享以下核心字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `enabled` | bool | 是否启用此通道（必须显式设为 `true`） |
| `allowFrom` | list | **访问白名单**。空列表拒绝所有人；`["*"]` 允许所有人；填入具体的用户 ID 则仅允许指定用户 |

**重要安全提示**：从 v0.1.4.post4 起，空的 `allowFrom` 将**拒绝所有访问**（此前版本允许所有人）。如果希望所有用户都能使用，请显式设置 `"allowFrom": ["*"]`。通道管理器在启动时会对所有已启用通道的 `allowFrom` 执行校验，空列表将触发启动失败。

Sources: [schema.py](nanobot/config/schema.py#L18-L31), [base.py](nanobot/channels/base.py#L117-L126), [manager.py](nanobot/channels/manager.py#L76-L82)

### 通道能力对比表

不同通道在连接方式、流式输出、群聊策略等方面存在差异。下表提供了一个快速对比视图：

| 通道 | 连接方式 | 需要公网 IP | 流式输出 | 群聊策略 | 额外依赖 |
|------|----------|-------------|----------|----------|----------|
| **Telegram** | Long Polling | ❌ | ✅ (默认开启) | `mention` / `open` | 内置 |
| **Discord** | Gateway WebSocket | ❌ | ❌ | `mention` / `open` | `discord.py` |
| **飞书** | WebSocket 长连接 | ❌ | ✅ (CardKit) | `mention` / `open` | `lark-oapi` |
| **Slack** | Socket Mode | ❌ | ❌ | `mention` / `open` | `slack-sdk` |
| **WhatsApp** | Node.js Bridge + WS | ❌ | ❌ | `open` / `mention` | Node.js ≥18 |
| **微信** | HTTP Long-Poll | ❌ | ❌ | — | `nanobot-ai[weixin]` |
| **钉钉** | Stream Mode (WS) | ❌ | ❌ | — | `dingtalk-stream` |
| **Matrix** | Long-Polling Sync | ❌ | ✅ (可选) | `open` / `mention` / `allowlist` | `nanobot-ai[matrix]` |
| **Email** | IMAP 轮询 + SMTP | ❌ | ❌ | — | 内置 |
| **QQ** | botpy WebSocket | ❌ | ❌ | — | `qq-botpy` |
| **企业微信** | WebSocket 长连接 | ❌ | ❌ | — | `nanobot-ai[wecom]` |
| **Mochat** | Socket.IO + HTTP | ❌ | ❌ | 可配置 | `python-socketio` |

Sources: [telegram.py](nanobot/channels/telegram.py#L181-L195), [discord.py](nanobot/channels/discord.py#L37-L48), [feishu.py](nanobot/channels/feishu.py#L243-L256), [matrix.py](nanobot/channels/matrix.py#L202-L219), [whatsapp.py](nanobot/channels/whatsapp.py#L23-L31)

## 通道配置流程

配置任何通道的基本流程是相同的。下图展示了从创建通道应用到启动 gateway 的完整步骤：

```mermaid
flowchart TD
    A[在平台开发者控制台创建应用/机器人] --> B[获取凭证<br/>Token / App ID / Secret]
    B --> C[编辑 ~/.nanobot/config.json<br/>channels.{name} 节]
    C --> D[设置 enabled: true]
    D --> E[填写凭证字段]
    E --> F[配置 allowFrom 白名单]
    F --> G{通道需要交互式登录?}
    G -- 是 --> H[执行 nanobot channels login {name}]
    G -- 否 --> I[执行 nanobot gateway]
    H --> I
    I --> J[通道启动并监听消息]
```

以下各节将按字母顺序逐一介绍每个通道的具体配置方法。

## Telegram

Telegram 是 nanobot 中功能最完善的通道，支持流式输出、语音转写、群聊策略、命令注册等特性。它使用 Long Polling 方式连接，**无需公网 IP 或 Webhook 配置**。

### 前置准备

1. 在 Telegram 中搜索 `@BotFather`，发送 `/newbot` 按提示创建机器人
2. 复制获得的 Bot Token
3. 找到你的 **User ID**（在 Telegram 设置中显示为 `@yourUserId`，配置时去掉 `@`）

### 配置参数

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | bool | `false` | 启用通道 |
| `token` | string | `""` | Bot Token（来自 @BotFather） |
| `allowFrom` | list | `[]` | 允许的用户 ID 或用户名（支持 `id\|username` 格式匹配） |
| `proxy` | string | `null` | HTTP/SOCKS5 代理 URL（用于网络受限环境） |
| `replyToMessage` | bool | `false` | 是否以回复原消息的方式发送响应 |
| `reactEmoji` | string | `"👀"` | 收到消息时的表情回应（表示"正在处理"） |
| `groupPolicy` | string | `"mention"` | 群聊策略：`"mention"`（仅 @机器人时响应）或 `"open"`（响应所有消息） |
| `streaming` | bool | `true` | 是否启用流式输出（逐字显示 Agent 回复） |
| `streamEditInterval` | float | `0.6` | 流式编辑最小间隔秒数（≥ 0.1） |
| `connectionPoolSize` | int | `32` | HTTP 连接池大小 |
| `poolTimeout` | float | `5.0` | 连接池超时时间（秒） |

### 配置示例

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "token": "${TELEGRAM_TOKEN}",
      "allowFrom": ["YOUR_USER_ID"],
      "groupPolicy": "mention",
      "streaming": true
    }
  }
}
```

### 关键行为

Telegram 通道的 `is_allowed` 方法支持**双重匹配**：如果 `allowFrom` 中包含数字 ID 或用户名（如 `123456789` 或 `alice`），而传入的 `sender_id` 格式为 `id|username`，系统会分别匹配 ID 和用户名部分。这使得配置更加灵活。

通道启动时会自动注册 Bot 命令菜单（`/start`、`/new`、`/stop`、`/restart`、`/status`、`/dream` 等），用户可以直接在 Telegram 输入框中通过菜单选择命令。此外，通道内置了 Markdown 到 Telegram HTML 的转换器，支持代码块、表格、加粗、斜体、删除体、链接等格式的精确渲染。

Sources: [telegram.py](nanobot/channels/telegram.py#L181-L300), [telegram.py](nanobot/channels/telegram.py#L83-L164)

## Discord

Discord 通道使用 `discord.py` SDK 通过 Gateway WebSocket 接收消息，同样**无需公网 IP**。它支持 Slash 命令和表情回应功能。

### 前置准备

1. 访问 [Discord Developer Portal](https://discord.com/developers/applications)，创建应用并添加 Bot
2. 在 Bot 设置中启用 **MESSAGE CONTENT INTENT**（必须）
3. 在 OAuth2 → URL Generator 中生成邀请链接：Scopes 选 `bot`，权限选 `Send Messages` + `Read Message History`
4. 复制 Bot Token
5. 在 Discord 设置中启用开发者模式，右键点击你的头像复制 User ID

### 配置参数

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | bool | `false` | 启用通道 |
| `token` | string | `""` | Bot Token |
| `allowFrom` | list | `[]` | 允许的 Discord 用户 ID |
| `intents` | int | `37377` | Gateway Intents 位掩码（默认已包含消息内容 Intent） |
| `groupPolicy` | string | `"mention"` | 群聊策略：`"mention"` 或 `"open"` |
| `readReceiptEmoji` | string | `"👀"` | 收到消息时的表情回应 |
| `workingEmoji` | string | `"🔧"` | 处理中的表情回应 |
| `workingEmojiDelay` | float | `2.0` | 延迟多少秒后添加"处理中"表情 |

### 配置示例

```json
{
  "channels": {
    "discord": {
      "enabled": true,
      "token": "YOUR_BOT_TOKEN",
      "allowFrom": ["YOUR_USER_ID"],
      "groupPolicy": "mention"
    }
  }
}
```

### 关键行为

Discord 通道会自动注册 Slash 命令（`/new`、`/stop`、`/restart`、`/status`、`/help`），并在 `on_ready` 时同步到 Discord。消息长度超过 Discord 的 2000 字符限制时，通道会自动分段发送。文件附件最大支持 20MB，超出部分会跳过并在文本中标注失败信息。当 `groupPolicy` 设为 `"open"` 时，建议创建私有线程并在其中 @机器人，以避免在公共频道中产生大量会话。

Sources: [discord.py](nanobot/channels/discord.py#L37-L260)

## 飞书（Feishu / Lark）

飞书通道使用 `lark-oapi` SDK 的 **WebSocket 长连接**模式接收消息，无需公网 IP。它支持通过 **CardKit 流式 API** 实现逐字输出效果。

### 前置准备

1. 访问[飞书开放平台](https://open.feishu.cn/app)，创建应用并启用 **机器人** 能力
2. **权限**：添加 `im:message`（发送消息）、`im:message.p2p_msg:readonly`（接收消息）
3. **流式回复**（默认开启）：添加 `cardkit:card:write`（创建和更新卡片）权限
4. **事件订阅**：添加 `im.message.receive_v1`，选择 **长连接** 模式
5. 获取 **App ID** 和 **App Secret**
6. 发布应用

### 配置参数

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | bool | `false` | 启用通道 |
| `appId` | string | `""` | 飞书应用 App ID |
| `appSecret` | string | `""` | 飞书应用 App Secret |
| `encryptKey` | string | `""` | 事件加密密钥（长连接模式可选） |
| `verificationToken` | string | `""` | 事件验证令牌（长连接模式可选） |
| `allowFrom` | list | `[]` | 允许的用户 open_id |
| `reactEmoji` | string | `"THUMBSUP"` | 处理完成后的表情回应 |
| `groupPolicy` | string | `"mention"` | 群聊策略 |
| `replyToMessage` | bool | `false` | 是否以回复方式发送 |
| `streaming` | bool | `true` | 是否启用 CardKit 流式输出 |

### 配置示例

```json
{
  "channels": {
    "feishu": {
      "enabled": true,
      "appId": "cli_xxx",
      "appSecret": "${FEISHU_APP_SECRET}",
      "encryptKey": "",
      "verificationToken": "",
      "allowFrom": ["ou_YOUR_OPEN_ID"],
      "groupPolicy": "mention",
      "streaming": true
    }
  }
}
```

### 关键行为

飞书通道的流式输出机制与众不同：首次收到增量文本时，它会通过 CardKit API 创建一个开启了 `streaming_mode` 的交互式卡片，后续的文本增量通过 `update_streaming` 接口持续更新卡片内容，最终回复完成后关闭 `streaming_mode`。如果你的应用无法获取 `cardkit:card:write` 权限，请将 `streaming` 设为 `false`，通道会退化为使用普通交互式卡片发送回复。

通道支持解析富文本消息（post 类型），包括标题、文本、链接、@提及、代码块和内嵌图片。图片会被自动下载到本地媒体目录并作为附件传递给 Agent。

Sources: [feishu.py](nanobot/channels/feishu.py#L243-L350)

## Slack

Slack 通道使用 **Socket Mode**（WebSocket），无需公网 URL。它支持 DM 私聊和频道 @提及两种交互模式。

### 前置准备

1. 访问 [Slack API](https://api.slack.com/apps)，创建应用
2. **Socket Mode**：开启并生成 App-Level Token（`connections:write` 作用域），格式为 `xapp-...`
3. **OAuth & Permissions**：添加 Bot 作用域 `chat:write`、`reactions:write`、`app_mentions:read`
4. **Event Subscriptions**：订阅 `message.im`、`message.channels`、`app_mention`
5. **App Home**：启用 Messages Tab 并允许 Slash 命令
6. 安装应用到工作区，复制 Bot Token（`xoxb-...`）

### 配置参数

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | bool | `false` | 启用通道 |
| `mode` | string | `"socket"` | 连接模式（目前仅支持 `socket`） |
| `botToken` | string | `""` | Bot Token（`xoxb-...`） |
| `appToken` | string | `""` | App-Level Token（`xapp-...`） |
| `allowFrom` | list | `[]` | 允许的 Slack 用户 ID |
| `replyInThread` | bool | `true` | 是否在话题线程中回复 |
| `reactEmoji` | string | `"eyes"` | 收到消息时的表情回应 |
| `doneEmoji` | string | `"white_check_mark"` | 处理完成后的表情回应 |
| `groupPolicy` | string | `"mention"` | 频道策略：`"mention"` 或 `"open"` |
| `groupAllowFrom` | list | `[]` | 频道白名单 |
| `dm.enabled` | bool | `true` | 是否允许 DM 交互 |
| `dm.policy` | string | `"open"` | DM 策略 |

### 配置示例

```json
{
  "channels": {
    "slack": {
      "enabled": true,
      "botToken": "${SLACK_BOT_TOKEN}",
      "appToken": "${SLACK_APP_TOKEN}",
      "allowFrom": ["YOUR_SLACK_USER_ID"],
      "groupPolicy": "mention"
    }
  }
}
```

### 关键行为

Slack 通道在收到消息时会对 `message` 和 `app_mention` 事件进行去重处理（频道中的 @提及会同时触发两种事件，通道仅处理 `app_mention`）。回复默认以话题线程（thread）形式发送，DM 私聊中则直接回复不使用线程。通道内置了 Markdown 到 Slack mrkdwn 格式的转换（通过 `slackify_markdown` 库）。

Sources: [slack.py](nanobot/channels/slack.py#L22-L200)

## WhatsApp

WhatsApp 通道通过一个 **Node.js 桥接进程**连接 WhatsApp Web 协议（基于 `@whiskeysockets/baileys`），Python 与 Node.js 之间通过 WebSocket 通信。需要 Node.js ≥ 18。

### 前置准备

1. 确保 Node.js ≥ 18 已安装
2. 执行登录命令扫描二维码

```bash
nanobot channels login whatsapp
# 用 WhatsApp → 设置 → 关联设备 扫描二维码
```

### 配置参数

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | bool | `false` | 启用通道 |
| `bridgeUrl` | string | `"ws://localhost:3001"` | 桥接 WebSocket 地址 |
| `bridgeToken` | string | `""` | 桥接认证 Token（留空自动生成） |
| `allowFrom` | list | `[]` | 允许的手机号（如 `+1234567890`） |
| `groupPolicy` | string | `"open"` | 群聊策略：`"open"` 或 `"mention"` |

### 配置示例

```json
{
  "channels": {
    "whatsapp": {
      "enabled": true,
      "allowFrom": ["+1234567890"]
    }
  }
}
```

### 关键行为

WhatsApp 桥接进程在首次启动或认证过期时需要通过 QR 码登录。桥接 Token 如果未配置，会自动在 `~/.nanobot/whatsapp-auth/bridge-token` 中生成并持久化。桥接进程支持无限次自动重连。语音消息会自动通过 Whisper 进行转写。

**升级提示**：升级 nanobot 后，如果桥接代码有更新，需要手动重建桥接：

```bash
rm -rf ~/.nanobot/bridge && nanobot channels login whatsapp
```

Sources: [whatsapp.py](nanobot/channels/whatsapp.py#L23-L198), [whatsapp.py](nanobot/channels/whatsapp.py#L309-L358)

## 微信（WeChat / Weixin）

微信个人号通道使用 HTTP Long-Poll API（基于 `ilinkai.weixin.qq.com`），**无需本地微信客户端**，通过二维码登录获取 Token。

### 前置准备

1. 安装微信支持：

```bash
pip install "nanobot-ai[weixin]"
```

2. 执行登录命令扫描二维码：

```bash
nanobot channels login weixin
```

### 配置参数

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | bool | `false` | 启用通道 |
| `allowFrom` | list | `[]` | 允许的微信用户 ID |
| `baseUrl` | string | `"https://ilinkai.weixin.qq.com"` | API 基础 URL |
| `cdnBaseUrl` | string | `"https://novac2c.cdn.weixin.qq.com/c2c"` | CDN 基础 URL |
| `token` | string | `""` | 认证 Token（可手动设置，或通过 QR 登录自动获取） |
| `stateDir` | string | `""` | 状态持久化目录（默认 `~/.nanobot/weixin/`） |
| `pollTimeout` | int | `35` | Long-Poll 超时时间（秒） |
| `routeTag` | string | `null` | 路由标签（部署要求时使用） |

### 配置示例

```json
{
  "channels": {
    "weixin": {
      "enabled": true,
      "allowFrom": ["*"]
    }
  }
}
```

### 关键行为

微信通道会自动管理会话状态：Token、上下文令牌和 typing 票据都持久化到 `stateDir/account.json`。Token 过期后会暂停轮询 1 小时，之后需要重新登录。通道支持图片、语音、视频和文件消息的收发。使用 `--force` 参数可以强制重新认证：

```bash
nanobot channels login weixin --force
```

Sources: [weixin.py](nanobot/channels/weixin.py#L115-L200)

## 钉钉（DingTalk）

钉钉通道使用 **Stream Mode**（WebSocket），通过 `dingtalk-stream` SDK 接收消息，直接使用 HTTP API 发送消息。

### 前置准备

1. 访问[钉钉开放平台](https://open-dev.dingtalk.com/)，创建应用
2. 添加 **机器人** 能力，开启 **Stream Mode**
3. 添加必要的消息发送权限
4. 获取 **AppKey**（Client ID）和 **AppSecret**（Client Secret）
5. 发布应用

### 配置参数

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | bool | `false` | 启用通道 |
| `clientId` | string | `""` | AppKey / Client ID |
| `clientSecret` | string | `""` | AppSecret / Client Secret |
| `allowFrom` | list | `[]` | 允许的员工 Staff ID |

### 配置示例

```json
{
  "channels": {
    "dingtalk": {
      "enabled": true,
      "clientId": "YOUR_APP_KEY",
      "clientSecret": "${DINGTALK_CLIENT_SECRET}",
      "allowFrom": ["YOUR_STAFF_ID"]
    }
  }
}
```

### 关键行为

钉钉通道同时支持私聊和群聊。群聊的 `chat_id` 以 `group:` 前缀存储，确保回复能路由到正确的群组。通道支持图片、文件和富文本消息的接收，附件会自动下载到本地媒体目录。SDK 依赖需额外安装：`pip install dingtalk-stream`。

Sources: [dingtalk.py](nanobot/channels/dingtalk.py#L149-L200)

## Matrix（Element）

Matrix 通道使用 `matrix-nio` SDK 的 Long-Polling Sync 连接，**支持端到端加密（E2EE）**，是最注重隐私的通道选项。

### 前置准备

1. 安装 Matrix 依赖：

```bash
pip install "nanobot-ai[matrix]"
```

2. 在 Matrix 服务器（如 `matrix.org`）上创建或使用已有账号
3. 确认可以通过 Element 客户端登录

### 配置参数

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | bool | `false` | 启用通道 |
| `homeserver` | string | `"https://matrix.org"` | Matrix 服务器 URL |
| `userId` | string | `""` | 用户 ID（如 `@nanobot:matrix.org`） |
| `password` | string | `""` | 密码（推荐，用于可靠的加密会话） |
| `accessToken` | string | `""` | Access Token（传统方式，与密码互斥） |
| `deviceId` | string | `""` | 设备 ID（传统方式） |
| `e2eeEnabled` | bool | `true` | 是否启用端到端加密 |
| `allowFrom` | list | `[]` | 允许的用户 ID |
| `groupPolicy` | string | `"open"` | 群聊策略：`open` / `mention` / `allowlist` |
| `groupAllowFrom` | list | `[]` | 群组白名单（`allowlist` 策略时使用） |
| `allowRoomMentions` | bool | `false` | 是否响应 `@room` 提及 |
| `streaming` | bool | `false` | 是否启用流式输出 |
| `maxMediaBytes` | int | `20971520` | 最大附件大小（默认 20MB） |

### 配置示例

```json
{
  "channels": {
    "matrix": {
      "enabled": true,
      "homeserver": "https://matrix.org",
      "userId": "@nanobot:matrix.org",
      "password": "${MATRIX_PASSWORD}",
      "e2eeEnabled": true,
      "allowFrom": ["@your_user:matrix.org"],
      "groupPolicy": "open",
      "maxMediaBytes": 20971520
    }
  }
}
```

### 关键行为

**推荐使用密码登录**而非 Access Token，因为密码登录可以可靠地恢复加密会话。如果同时提供了 `password` 和 `accessToken`，系统会忽略 `accessToken` 并使用密码。加密会话状态存储在 `matrix-store` 目录中，**请勿删除此目录**，否则加密会话将丢失。

Matrix 通道的流式输出通过不断编辑（`m.replace`）同一条消息来实现，每次编辑间隔至少 2 秒以避免触发速率限制。Markdown 渲染使用 `mistune` 库，输出经过 `nh3` HTML 清理器过滤，仅保留 Matrix 兼容的 HTML 标签集合。

Sources: [matrix.py](nanobot/channels/matrix.py#L202-L290)

## Email

Email 通道使用 **IMAP 轮询**接收邮件、**SMTP** 发送回复，让 nanobot 化身为个人邮件助手。

### 前置准备

以 Gmail 为例：

1. 创建一个专用 Gmail 账号
2. 启用两步验证 → 创建[应用专用密码](https://myaccount.google.com/apppasswords)

### 配置参数

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | bool | `false` | 启用通道 |
| `consentGranted` | bool | `false` | **必须设为 `true`**（安全门控） |
| `imapHost` | string | `""` | IMAP 服务器地址 |
| `imapPort` | int | `993` | IMAP 端口 |
| `imapUsername` | string | `""` | IMAP 用户名 |
| `imapPassword` | string | `""` | IMAP 密码 |
| `imapUseSsl` | bool | `true` | 是否使用 SSL |
| `smtpHost` | string | `""` | SMTP 服务器地址 |
| `smtpPort` | int | `587` | SMTP 端口 |
| `smtpUsername` | string | `""` | SMTP 用户名 |
| `smtpPassword` | string | `""` | SMTP 密码 |
| `smtpUseTls` | bool | `true` | 是否使用 STARTTLS |
| `fromAddress` | string | `""` | 发件人地址 |
| `autoReplyEnabled` | bool | `true` | 是否自动回复收到的邮件 |
| `pollIntervalSeconds` | int | `30` | 轮询间隔（秒） |
| `markSeen` | bool | `true` | 处理后标记为已读 |
| `allowFrom` | list | `[]` | 允许的发件人邮箱地址 |
| `verifyDkim` | bool | `true` | 是否验证 DKIM 签名（防伪造） |
| `verifySpf` | bool | `true` | 是否验证 SPF 记录（防伪造） |
| `allowedAttachmentTypes` | list | `[]` | 允许的附件 MIME 类型（如 `["application/pdf", "image/*"]`，`["*"]` 全部允许） |
| `maxAttachmentSize` | int | `2000000` | 单个附件最大大小（字节） |
| `maxAttachmentsPerEmail` | int | `5` | 每封邮件最大附件数 |

### 配置示例

```json
{
  "channels": {
    "email": {
      "enabled": true,
      "consentGranted": true,
      "imapHost": "imap.gmail.com",
      "imapPort": 993,
      "imapUsername": "my-nanobot@gmail.com",
      "imapPassword": "${GMAIL_APP_PASSWORD}",
      "smtpHost": "smtp.gmail.com",
      "smtpPort": 587,
      "smtpUsername": "my-nanobot@gmail.com",
      "smtpPassword": "${GMAIL_APP_PASSWORD}",
      "fromAddress": "my-nanobot@gmail.com",
      "allowFrom": ["your-real-email@gmail.com"],
      "allowedAttachmentTypes": ["application/pdf", "image/*"]
    }
  }
}
```

### 关键行为

`consentGranted` 是一个**安全门控**——必须显式设为 `true` 才会启动 IMAP 轮询。通道默认启用 DKIM 和 SPF 验证以防止邮件伪造攻击。IMAP 连接具有自动重连机制，能够处理因不活动断开、协议错误等常见故障。回复邮件时会自动保持原邮件主题（添加 `Re:` 前缀）并设置正确的 `In-Reply-To` 和 `References` 头部。

Sources: [email.py](nanobot/channels/email.py#L30-L200)

## QQ

QQ 通道使用 `botpy` SDK 的 WebSocket 连接，目前支持**单聊消息**。需要安装额外依赖：`pip install qq-botpy`。

### 前置准备

1. 访问 [QQ 开放平台](https://q.qq.com)，注册开发者并创建机器人应用
2. 在**开发设置**中复制 AppID 和 AppSecret
3. 在**沙箱配置**中添加测试成员的 QQ 号
4. 用手机 QQ 扫描机器人二维码开始对话

### 配置参数

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | bool | `false` | 启用通道 |
| `appId` | string | `""` | QQ 应用 AppID |
| `secret` | string | `""` | QQ 应用 AppSecret |
| `allowFrom` | list | `[]` | 允许的用户 openid |
| `msgFormat` | string | `"plain"` | 消息格式：`"plain"` 或 `"markdown"` |
| `ackMessage` | string | `"⏳ Processing..."` | 收到消息时的确认回复 |
| `mediaDir` | string | `""` | 入站附件保存目录（默认自动） |

### 配置示例

```json
{
  "channels": {
    "qq": {
      "enabled": true,
      "appId": "YOUR_APP_ID",
      "secret": "${QQ_APP_SECRET}",
      "allowFrom": ["YOUR_OPENID"],
      "msgFormat": "plain"
    }
  }
}
```

### 关键行为

QQ 通道对接收到的消息去重（保留最近 1000 条消息 ID），并使用递增的 `msg_seq` 避免 QQ API 的去重机制误判。图片类文件使用 `file_type=1` 发送，其他文件使用 `file_type=4`。文件通过 base64 编码上传到 QQ 富媒体 API。

Sources: [qq.py](nanobot/channels/qq.py#L129-L200)

## 企业微信（WeCom）

企业微信通道使用 `wecom_aibot_sdk` 的 **WebSocket 长连接**，无需公网 IP。

### 前置准备

1. 安装依赖：`pip install nanobot-ai[wecom]`
2. 在企业微信管理后台 → 智能机器人 → 创建机器人 → 选择 **API 模式** + **长连接**
3. 复制 Bot ID 和 Secret

### 配置参数

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | bool | `false` | 启用通道 |
| `botId` | string | `""` | 机器人 ID |
| `secret` | string | `""` | 机器人密钥 |
| `allowFrom` | list | `[]` | 允许的用户 ID |
| `welcomeMessage` | string | `""` | 用户进入对话时的欢迎消息 |

### 配置示例

```json
{
  "channels": {
    "wecom": {
      "enabled": true,
      "botId": "your_bot_id",
      "secret": "${WECOM_SECRET}",
      "allowFrom": ["your_id"]
    }
  }
}
```

### 关键行为

企业微信通道注册了丰富的事件处理器：文本、图片、语音、文件和混合内容消息，以及 `enter_chat` 事件（用户打开与机器人的对话窗口时触发）。如果配置了 `welcomeMessage`，用户进入对话时会自动收到欢迎消息。WebSocket 配置了无限重连（`max_reconnect_attempts: -1`）和 30 秒心跳间隔，确保连接稳定性。

Sources: [wecom.py](nanobot/channels/wecom.py#L20-L200)

## Mochat（Claw IM）

Mochat 通道使用 **Socket.IO WebSocket**（带 HTTP 轮询回退）连接 Mochat 平台，是最容易配置的通道之一——可以让 nanobot 自动完成注册和配置。

### 前置准备

向 nanobot 发送以下消息即可自动完成所有设置：

```
Read https://raw.githubusercontent.com/HKUDS/MoChat/refs/heads/main/skills/nanobot/skill.md and register on MoChat. My Email account is xxx@xxx Bind me as your owner and DM me on MoChat.
```

### 配置参数

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | bool | `false` | 启用通道 |
| `baseUrl` | string | `"https://mochat.io"` | Mochat API 基础 URL |
| `socketUrl` | string | `""` | Socket.IO URL |
| `socketPath` | string | `"/socket.io"` | Socket.IO 路径 |
| `clawToken` | string | `""` | Claw 认证令牌 |
| `agentUserId` | string | `""` | Agent 的 Mochat 用户 ID |
| `sessions` | list | `[]` | 监听的会话 ID 列表（`["*"]` 监听所有） |
| `panels` | list | `[]` | 监听的面板 ID 列表 |
| `allowFrom` | list | `[]` | 允许的用户 ID |
| `mention.requireInGroups` | bool | `false` | 群组中是否需要 @提及才回复 |
| `replyDelayMode` | string | `"non-mention"` | 延迟回复模式 |
| `replyDelayMs` | int | `120000` | 延迟回复等待时间（毫秒） |

### 配置示例

```json
{
  "channels": {
    "mochat": {
      "enabled": true,
      "baseUrl": "https://mochat.io",
      "socketUrl": "https://mochat.io",
      "socketPath": "/socket.io",
      "clawToken": "claw_xxx",
      "agentUserId": "6982abcdef",
      "sessions": ["*"],
      "panels": ["*"],
      "replyDelayMode": "non-mention",
      "replyDelayMs": 120000
    }
  }
}
```

### 关键行为

Mochat 通道支持**消息缓冲合并**——当短时间内收到多条消息时，会将它们合并为一条发送给 Agent，避免产生多个并发会话。缓冲行为由 `replyDelayMode` 和 `replyDelayMs` 控制。Socket.IO 连接支持可配置的重连延迟和超时。通道通过 cursor 机制跟踪每个会话的消息读取位置，确保重启后不会遗漏消息。

Sources: [mochat.py](nanobot/channels/mochat.py#L216-L280)

## 高级主题

### 使用环境变量保护密钥

在 `config.json` 中，所有字符串值都支持 `${VAR_NAME}` 占位符语法。启动时，nanobot 会递归解析所有环境变量引用。这在生产部署中尤为重要：

```json
{
  "channels": {
    "telegram": { "token": "${TELEGRAM_TOKEN}" },
    "email": {
      "imapPassword": "${IMAP_PASSWORD}",
      "smtpPassword": "${SMTP_PASSWORD}"
    }
  }
}
```

如果引用的环境变量不存在，启动会抛出 `ValueError` 并阻止服务运行。

Sources: [loader.py](nanobot/config/loader.py#L81-L110)

### 语音消息转写

所有支持语音消息的通道（Telegram、WhatsApp）都通过 Whisper API 自动进行语音转文字。转写后端由全局 `channels.transcriptionProvider` 控制：

- `"groq"`（默认）：使用 Groq 的免费 Whisper 服务，API Key 自动从 `providers.groq` 配置中获取
- `"openai"`：使用 OpenAI Whisper，API Key 自动从 `providers.openai` 配置中获取

Sources: [base.py](nanobot/channels/base.py#L40-L54), [manager.py](nanobot/channels/manager.py#L67-L74)

### 消息投递重试策略

通道管理器（`ChannelManager`）实现了统一的**指数退避重试机制**。当某个通道的 `send()` 方法抛出异常时，管理器会按 `1s → 2s → 4s` 的间隔进行重试（上限保持 4s）。重试次数由 `channels.sendMaxRetries` 控制（默认 3 次，含首次发送）。

重试策略故意设计得简单：通道实现只需要在发送失败时抛出异常，重试逻辑完全由通道管理器统一处理。

Sources: [manager.py](nanobot/channels/manager.py#L16-L17), [manager.py](nanobot/channels/manager.py#L148-L197)

### 通道自动发现与插件扩展

nanobot 通过 `registry.py` 实现两层自动发现机制：

1. **内置通道**：扫描 `nanobot/channels/` 包，通过 `pkgutil.iter_modules` 找到所有模块，排除 `base`、`manager`、`registry` 三个内部模块
2. **外部插件**：通过 Python entry points（`nanobot.channels` 组）加载第三方通道包

内置通道名称优先级高于同名外部插件，确保插件不会覆盖内置实现。如果需要在内置通道基础上构建自定义变体，请参考 [通道插件开发：从零构建自定义通道](18-tong-dao-cha-jian-kai-fa-cong-ling-gou-jian-zi-ding-yi-tong-dao)。

Sources: [registry.py](nanobot/channels/registry.py#L40-L72)

## 下一步

- 了解通道底层的架构设计：[通道架构：BaseChannel 接口与通道管理器](16-tong-dao-jia-gou-basechannel-jie-kou-yu-tong-dao-guan-li-qi)
- 深入流式输出的实现细节：[流式输出与增量消息合并机制](19-liu-shi-shu-chu-yu-zeng-liang-xiao-xi-he-bing-ji-zhi)
- 开发自己的通道插件：[通道插件开发：从零构建自定义通道](18-tong-dao-cha-jian-kai-fa-cong-ling-gou-jian-zi-ding-yi-tong-dao)
- 生产环境部署配置：[配置体系：schema 定义、环境变量插值与多配置文件](31-pei-zhi-ti-xi-schema-ding-yi-huan-jing-bian-liang-cha-zhi-yu-duo-pei-zhi-wen-jian)