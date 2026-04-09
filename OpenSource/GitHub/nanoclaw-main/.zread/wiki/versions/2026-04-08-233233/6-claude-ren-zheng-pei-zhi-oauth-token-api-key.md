NanoClaw 依赖 **Claude Agent SDK** 在容器内运行智能体，而 Claude SDK 需要有效的身份认证才能调用 Anthropic API。本文档将带你理解 NanoClaw 支持的两种认证方式、凭据如何从宿主机安全地传递到容器内的智能体，以及完整的配置与验证流程。

Sources: [container-runner.ts](src/container-runner.ts#L217-L224), [verify.ts](setup/verify.ts#L99-L107)

## 认证方式总览

NanoClaw 支持两种主要的 Claude 认证方式，以及一组用于第三方模型兼容的辅助变量：

| 环境变量 | 适用场景 | 获取方式 |
|----------|----------|----------|
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude Pro / Max 订阅用户 | 运行 `claude setup-token` |
| `ANTHROPIC_API_KEY` | Anthropic API 按量付费 | Anthropic Console 控制台 |
| `ANTHROPIC_BASE_URL` | 第三方兼容端点 | 自建代理或模型服务地址 |
| `ANTHROPIC_AUTH_TOKEN` | 自定义认证令牌 | 取决于端点提供商 |

两种主要认证方式互为补充：**订阅用户**通过 OAuth Token 获得与 Claude Code CLI 相同的模型访问权限；**开发者 / 企业用户**则可以直接使用 API Key 按量调用。你只需要配置其中一种即可正常运行。

Sources: [SKILL.md](.claude/skills/setup/SKILL.md#L78-L84), [README.md](README.md#L161-L175)

## 配置步骤

### 方式一：Claude 订阅（OAuth Token）

如果你拥有 Claude Pro 或 Max 订阅，这是最简单的认证方式：

```mermaid
flowchart TD
    A[在另一个终端运行<br><code>claude setup-token</code>] --> B[复制输出的 OAuth Token]
    B --> C[在项目根目录创建或编辑<br><code>.env</code> 文件]
    C --> D[添加一行：<br><code>CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-...</code>]
    D --> E[保存 .env 文件]
    E --> F{运行验证步骤}
    F -->|成功| G[✅ 认证完成]
    F -->|失败| H[检查 Token 是否完整粘贴<br>确认无多余空格或换行]
    H --> A
```

1. **获取 Token**：在终端中运行 `claude setup-token`，该命令会输出一个以 `sk-ant-oat01-` 开头的 OAuth Token
2. **写入配置**：将 Token 添加到项目根目录的 `.env` 文件中：
   ```bash
   CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-your-token-here
   ```
3. **安全提示**：NanoClaw 不会在聊天中收集你的 Token。请在终端中自行操作，切勿将 Token 分享给他人

> **注意**：OAuth Token 也可以从 `~/.claude/.credentials.json` 中提取（如果你已经登录了 Claude Code CLI）。但推荐使用 `claude setup-token` 获取，因为它能确保 Token 的新鲜度。

Sources: [SKILL.md](.claude/skills/setup/SKILL.md#L82-L82), [SPEC.md](docs/SPEC.md#L389-L393)

### 方式二：Anthropic API Key

如果你使用 Anthropic 的按量付费 API：

1. **获取 API Key**：前往 [Anthropic Console](https://console.anthropic.com/) 创建 API Key（以 `sk-ant-api03-` 开头）
2. **写入配置**：将 Key 添加到 `.env` 文件中：
   ```bash
   ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
   ```

Sources: [SKILL.md](.claude/skills/setup/SKILL.md#L84-L84), [SPEC.md](docs/SPEC.md#L395-L398)

### 方式三：第三方模型与兼容端点

NanoClaw 支持任何兼容 Anthropic API 格式的模型端点。配置方法：

```bash
ANTHROPIC_BASE_URL=https://your-api-endpoint.com
ANTHROPIC_AUTH_TOKEN=your-token-here
```

常见的使用场景包括：通过 Ollama 的 API 代理运行本地模型、在 Together AI / Fireworks 等平台上运行开源模型、或使用自建的 Anthropic API 兼容服务。需要注意的是，模型必须支持 Anthropic API 格式才能获得最佳兼容性。

Sources: [README.md](README.md#L161-L175)

## 凭据传递的安全架构

NanoClaw 在设计上采取了多层安全措施，确保你的认证凭据不会从宿主机泄漏到容器内部或子进程中。理解这个安全机制有助于你排查认证相关的问题。

### 三层隔离机制

```mermaid
flowchart LR
    subgraph 宿主机["宿主机（Host）"]
        ENV[".env 文件<br><code>CLAUDE_CODE_OAUTH_TOKEN<br>ANTHROPIC_API_KEY</code>"]
        READ["readSecrets()<br>仅读取认证变量"]
    end

    subgraph 传输层["安全传输"]
        STDIN["stdin JSON<br><code>input.secrets = {...}</code>"]
        SHADOW[".env 影子挂载<br><code>/dev/null → .env</code>"]
    end

    subgraph 容器["容器（Container）"]
        SDK["SDK 环境变量<br><code>sdkEnv[key] = value</code>"]
        BASH["Bash 子进程<br><code>unset ANTHROPIC_API_KEY<br>unset CLAUDE_CODE_OAUTH_TOKEN</code>"]
    end

    ENV --> READ --> STDIN --> SDK
    SHADOW -.->|"阻止容器读取 .env"| CONTAINER["容器内文件系统"]
    SDK -->|"仅 Claude SDK 可见"| BASH
    BASH -->|"凭据已被剥离"| CMD["用户命令"]
```

整个安全链路包含三个关键环节：

**第一层 — 精准提取**：宿主机的 `readSecrets()` 函数仅从 `.env` 文件中提取四条认证相关的变量（`CLAUDE_CODE_OAUTH_TOKEN`、`ANTHROPIC_API_KEY`、`ANTHROPIC_BASE_URL`、`ANTHROPIC_AUTH_TOKEN`），而不是加载全部环境变量到 `process.env`。这意味着宿主机的其他进程无法通过环境变量访问这些凭据。

Sources: [container-runner.ts](src/container-runner.ts#L217-L224), [env.ts](src/env.ts#L1-L42)

**第二层 — stdin 注入与影子挂载**：凭据通过容器进程的 stdin 以 JSON 格式传递（`input.secrets`），而非写入磁盘文件或挂载为环境变量。同时，对于主群组（main group），NanoClaw 会将 `/dev/null` 挂载到容器内的 `/workspace/project/.env` 路径，形成**影子挂载**，阻止容器内的智能体读取宿主机的 `.env` 文件。这种双重保护确保凭据只能通过预期的通道进入容器。

Sources: [container-runner.ts](src/container-runner.ts#L77-L86), [container-runner.ts](src/container-runner.ts#L312-L317)

**第三层 — 子进程净化**：在容器内部，agent-runner 将凭据注入到 `sdkEnv` 对象中仅供 Claude Agent SDK 使用，但**不会**写入 `process.env`。更进一步，通过 `PreToolUse` Hook，当智能体使用 Bash 工具执行命令时，系统会在命令前自动添加 `unset ANTHROPIC_API_KEY CLAUDE_CODE_OAUTH_TOKEN`，确保任何 Bash 子进程都无法接触到这些凭据。

Sources: [index.ts](container/agent-runner/src/index.ts#L188-L209), [index.ts](container/agent-runner/src/index.ts#L511-L516)

### 凭据流经路径详析

| 阶段 | 存储位置 | 访问方式 | 安全措施 |
|------|----------|----------|----------|
| 宿主机 `.env` 文件 | 项目根目录 `.env`（已 gitignore） | `readEnvFile()` 按需读取 | 不加载到 `process.env`，子进程不可见 |
| 传递到容器 | stdin JSON | 容器启动时一次性读取 | 不写入磁盘，读取后立即从 input 对象删除 |
| 容器内 SDK | `sdkEnv` 内存对象 | 仅传递给 `query()` 的 `env` 选项 | 不写入 `process.env` |
| Bash 子进程 | 命令前缀 `unset` | 自动注入到 Bash 工具命令 | Hook 机制拦截并改写命令 |

Sources: [container-runner.ts](src/container-runner.ts#L312-L317), [index.ts](container/agent-runner/src/index.ts#L191-L209)

## 配置验证

### 自动验证

NanoClaw 的安装验证步骤（`/setup` 流程的第 8 步）会自动检查凭据是否已正确配置。其检测逻辑非常直接：读取 `.env` 文件内容，使用正则表达式匹配 `CLAUDE_CODE_OAUTH_TOKEN=` 或 `ANTHROPIC_API_KEY=` 行：

```typescript
if (/^(CLAUDE_CODE_OAUTH_TOKEN|ANTHROPIC_API_KEY)=/m.test(envContent)) {
  credentials = 'configured';
}
```

验证结果会在状态块中以 `CREDENTIALS: configured` 或 `CREDENTIALS: missing` 呈现。如果状态为 `missing`，整个验证将标记为 `failed`。

Sources: [verify.ts](setup/verify.ts#L99-L107), [environment.test.ts](setup/environment.test.ts#L75-L96)

### 手动验证

如果你需要手动确认凭据配置是否正确，可以按以下步骤操作：

```bash
# 检查 .env 文件是否存在且包含认证变量
cat .env | grep -E "^(CLAUDE_CODE_OAUTH_TOKEN|ANTHROPIC_API_KEY)="

# 运行完整的安装验证
npx tsx setup/index.ts --step verify
```

验证通过后，你应该看到输出中 `CREDENTIALS: configured`。如果需要对认证进行更深度的调试，可以使用 `/debug` 技能，它会在容器内直接检查凭据是否可达。

Sources: [SKILL.md](.claude/skills/debug/SKILL.md#L73-L74)

## 常见问题排查

| 问题现象 | 可能原因 | 解决方案 |
|----------|----------|----------|
| `CREDENTIALS: missing` | `.env` 文件中未配置认证变量 | 添加 `CLAUDE_CODE_OAUTH_TOKEN` 或 `ANTHROPIC_API_KEY` |
| 容器内 Claude 报认证错误 | Token 过期或拼写错误 | 重新运行 `claude setup-token`，确认 Token 完整 |
| 修改 `.env` 后仍报错 | 服务未重启 | 重启服务：`launchctl kickstart -k gui/$(id -u)/com.nanoclaw`（macOS）或 `systemctl --user restart nanoclaw`（Linux） |
| 第三方端点无法连接 | `ANTHROPIC_BASE_URL` 配置错误 | 确认端点 URL 可达且兼容 Anthropic API 格式 |
| `.env` 文件不存在 | 首次安装 | 在项目根目录手动创建 `.env` 文件 |

Sources: [SKILL.md](.claude/skills/setup/SKILL.md#L163-L171)

## 安全最佳实践

1. **绝不提交 `.env` 文件**：`.env` 已被列入 `.gitignore`，确保你的凭据不会被意外提交到版本控制
2. **使用最小权限原则**：如果同时配置了多种认证方式，NanoClaw 不会选择性地使用某一种 — 请只配置你实际需要的方式
3. **定期轮换 Token**：OAuth Token 会过期，如果容器内开始出现认证失败，首先尝试重新运行 `claude setup-token`
4. **容器内隔离信任链**：即使智能体拥有 Bash 工具的完整访问权限，它也无法通过环境变量获取你的认证凭据

Sources: [.gitignore](.gitignore#L21-L23), [container-runner.ts](src/container-runner.ts#L77-L86)

---

### 下一步

凭据配置完成后，下一步是为 NanoClaw 添加消息渠道。请继续阅读 [消息渠道安装与认证（WhatsApp、Telegram、Discord、Slack）](7-xiao-xi-qu-dao-an-zhuang-yu-ren-zheng-whatsapp-telegram-discord-slack)，了解如何将你的聊天平台连接到 NanoClaw。