# HelloAgents v0.1 — 快速上手指南

## 环境准备

### 1. 激活虚拟环境

```bash
cd hello-agents
source .venv/bin/activate
```

### 2. 确认 Ollama 正在运行

```bash
# 检查 Ollama 服务是否启动
curl http://localhost:11434/v1/models

# 如果未启动，运行：
ollama serve
```

### 3. 确认模型已下载

```bash
ollama list
# 应能看到 deepseek-r1:32b（或你安装的其他模型）
```

---

## 使用方式

### 方式一：直接在 Python 中调用

在 `hello-agents/` 目录下启动 Python：

```bash
source .venv/bin/activate
python
```

```python
from core import HelloAgentsLLM

# 创建 LLM 客户端（默认连接本地 Ollama）
llm = HelloAgentsLLM(model="deepseek-r1:32b")

# 非流式调用
response = llm.invoke([{"role": "user", "content": "你好，介绍一下你自己"}])
print(response)

# 流式调用（带控制台输出）
for chunk in llm.think([{"role": "user", "content": "什么是 Agent？"}]):
    pass  # think() 会自动打印到控制台
```

### 方式二：编写脚本

在 `hello-agents/` 目录下创建脚本，例如 `demo.py`：

```python
from core import HelloAgentsLLM, Message, Config

# 初始化
llm = HelloAgentsLLM(model="deepseek-r1:32b")

# 多轮对话
messages = [
    {"role": "system", "content": "你是一个有帮助的助手"},
    {"role": "user", "content": "用一句话解释什么是设计模式"},
]

response = llm.invoke(messages)
print(f"回复: {response}")
print(f"耗时: {response.latency_ms}ms")
print(f"Token: {response.usage}")
```

运行：

```bash
source .venv/bin/activate
python demo.py
```

### 方式三：使用其他模型

```python
from core import HelloAgentsLLM

# Ollama 上的其他模型
llm = HelloAgentsLLM(model="qwen2.5:7b")

# 连接 OpenAI 兼容的中转站
llm = HelloAgentsLLM(
    model="gpt-4o",
    api_key="your-api-key",
    base_url="https://your-relay-site.com/v1"
)
```

### 方式四：通过环境变量配置

创建 `.env` 文件或直接 export：

```bash
export LLM_MODEL_ID="deepseek-r1:32b"
export LLM_API_KEY="ollama"
export LLM_BASE_URL="http://localhost:11434/v1"
export LLM_TIMEOUT="120"
```

```python
from core import HelloAgentsLLM

# 自动读取环境变量，无需传参
llm = HelloAgentsLLM()
```

---

## 注意事项

- 所有脚本必须在 `hello-agents/` 目录下运行，否则 `from core import ...` 会找不到模块
- 首次调用 deepseek-r1:32b 可能需要 30 秒以上，这是正常的（模型较大）
- 如果遇到 `ModuleNotFoundError: pydantic`，确认已激活 `.venv` 虚拟环境
