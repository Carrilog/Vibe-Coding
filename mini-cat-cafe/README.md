# mini-cat-cafe

最小可用的多 Agent 量化学习框架。

## 架构分层

```
mini-cat-cafe/
├── core/           # 核心抽象（类型定义、LLM接口、Agent基类）
├── providers/      # LLM提供商适配层
├── tools/          # 工具层（搜索、写文件、跑代码）
├── agents/         # Agent实现层
├── orchestrator/   # 多Agent编排
└── cli/            # CLI入口
```

**依赖方向（单向）：** `cli → orchestrator → agents → tools + core ← providers`

## 快速开始

```bash
cd mini-cat-cafe
pip install -r requirements.txt

# 用 Anthropic（默认）
export ANTHROPIC_API_KEY=sk-ant-...
python cli/main.py --task "research momentum trading strategies"

# 用 DeepSeek
export DEEPSEEK_API_KEY=sk-...
python cli/main.py --task "write a moving average crossover backtest" --provider deepseek

# 用 OpenAI
export OPENAI_API_KEY=sk-...
python cli/main.py --task "explain Sharpe ratio" --provider openai --model gpt-4o

# 用 Qwen
export DASHSCOPE_API_KEY=sk-...
python cli/main.py --task "research factor investing" --provider qwen
```

## 支持的 Provider

| Provider   | 环境变量            | 默认模型              |
|------------|--------------------|-----------------------|
| anthropic  | ANTHROPIC_API_KEY  | claude-opus-4-6       |
| openai     | OPENAI_API_KEY     | gpt-4o                |
| deepseek   | DEEPSEEK_API_KEY   | deepseek-chat         |
| qwen       | DASHSCOPE_API_KEY  | qwen-plus             |
| moonshot   | MOONSHOT_API_KEY   | moonshot-v1-8k        |

## Agent 分工

- **ResearcherAgent** — 搜索网络，整理为 Markdown 文档
- **CoderAgent** — 编写并运行 Python 代码，保存到 .py 文件
- **Orchestrator** — 根据任务关键词自动路由，支持串联（先研究再编码）

## 扩展方法

**添加新 Provider：** 在 `providers/factory.py` 的 `if/elif` 链里加一个分支。

**添加新工具：** 继承 `tools/base_tool.py` 的 `BaseTool`，实现 `name`、`description`、`parameters_schema`、`execute`。

**添加新 Agent：** 继承 `agents/tool_using_agent.py` 的 `ToolUsingAgent`，传入工具列表和 system prompt。
