工具注册表（`ToolRegistry`）是 nanobot 工具系统的核心枢纽，负责所有工具的注册、查找、参数校验与执行调度。它将**内置工具**（文件操作、Shell 执行、Web 搜索等）与**MCP 外部工具**（模型上下文协议发现的能力）统一纳入同一个注册表中，为 Agent 主循环提供一致的调用接口。本文将深入解析注册表的架构设计、工具基类的契约约束、Schema 驱动的参数验证体系，以及 MCP 工具的动态发现与注册机制。

Sources: [registry.py](nanobot/agent/tools/registry.py#L1-L111), [base.py](nanobot/agent/tools/base.py#L1-L280)

## 整体架构：注册表在工具系统中的位置

工具注册表位于 Agent 主循环（`AgentLoop`）与 LLM Provider 之间，充当工具定义的**单一事实来源**。每当 LLM 返回 `tool_calls` 时，Runner 通过注册表完成工具的查找、参数转型、校验与执行。下图展示了注册表与周围组件的关系：

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AgentLoop                                    │
│  ┌──────────────────┐   ┌──────────────────┐   ┌────────────────┐  │
│  │ _register_default │──▶│   ToolRegistry   │◀──│ _connect_mcp() │  │
│  │     _tools()      │   │                  │   │                │  │
│  └──────────────────┘   │  _tools: dict    │   └───────┬────────┘  │
│                          │  register()      │           │            │
│  ┌──────────────────┐   │  unregister()    │           │ MCP        │
│  │   AgentRunner    │──▶│  execute()       │◀──────────┘ Discovery  │
│  │  (tool_calls)    │   │  get_definitions │                        │
│  └──────────────────┘   └────────┬─────────┘                        │
│                                  │                                   │
│                    ┌─────────────┼─────────────┐                     │
│                    ▼             ▼             ▼                     │
│             ┌──────────┐  ┌──────────┐  ┌───────────┐               │
│             │ Built-in │  │ MCP Tool │  │ MCP Res/  │               │
│             │  Tools   │  │ Wrapper  │  │ Prompt    │               │
│             └──────────┘  └──────────┘  └───────────┘               │
└─────────────────────────────────────────────────────────────────────┘
```

Sources: [loop.py](nanobot/agent/loop.py#L217-L287), [runner.py](nanobot/agent/runner.py#L14-L50)

## Tool 基类：工具的抽象契约

所有工具——无论是内置实现还是 MCP 适配器——都必须继承 `Tool` 抽象基类。该基类定义了一套严格的契约，确保每个工具都具备 LLM function calling 所需的完整信息。

### 必须实现的抽象成员

| 抽象成员 | 类型 | 说明 |
|---------|------|------|
| `name` | `@property → str` | 工具唯一标识符，用于 function call 中的 `function.name` |
| `description` | `@property → str` | 工具功能描述，帮助 LLM 理解何时调用该工具 |
| `parameters` | `@property → dict` | JSON Schema 格式的参数定义，描述 `type: "object"` 及其 `properties` |
| `execute(**kwargs)` | `async method → Any` | 异步执行方法，接收校验后的参数，返回字符串或内容块列表 |

### 并发控制属性

Tool 基类还提供了三个与并发执行相关的属性，它们共同决定了工具在并行调度时的行为：

| 属性 | 默认值 | 说明 |
|------|--------|------|
| `read_only` | `False` | 是否为只读工具（无副作用），可安全并行化 |
| `exclusive` | `False` | 是否必须独占运行（即使启用了并发） |
| `concurrency_safe` | `read_only and not exclusive` | 综合判断：只读且非独占的工具才允许并行 |

以 `ExecTool` 为例，它将 `exclusive` 设为 `True`，因为 Shell 命令可能产生文件系统副作用，不能与其他工具并行执行。而 `ReadFileTool`、`GlobTool`、`GrepTool`、`WebSearchTool`、`WebFetchTool` 等只读工具则标记 `read_only = True`，可以被批量并行执行。

Sources: [base.py](nanobot/agent/tools/base.py#L117-L173), [shell.py](nanobot/agent/tools/shell.py#L85-L87), [search.py](nanobot/agent/tools/search.py#L150-L152)

### Schema 输出格式

每个工具通过 `to_schema()` 方法生成 OpenAI function calling 兼容的定义格式：

```python
{
    "type": "function",
    "function": {
        "name": "read_file",
        "description": "Read a text file...",
        "parameters": {
            "type": "object",
            "properties": { ... },
            "required": ["path"]
        }
    }
}
```

该输出直接传递给 LLM Provider 的 `tools` 参数，使模型能够了解可用工具及其调用方式。

Sources: [base.py](nanobot/agent/tools/base.py#L234-L243)

## Schema 体系：类型安全的参数描述

nanobot 提供了一套独立的 Schema 类层次结构，用于以类型安全的方式构建工具参数定义。这些类位于 `nanobot/agent/tools/schema.py`，均继承自 `Schema` 抽象基类，核心功能是生成 JSON Schema 片段并支持值验证。

### Schema 类一览

| 类 | 对应 JSON Schema 类型 | 特有约束 |
|----|----------------------|----------|
| `StringSchema` | `"string"` | `min_length`, `max_length`, `enum` |
| `IntegerSchema` | `"integer"` | `minimum`, `maximum`, `enum` |
| `NumberSchema` | `"number"` | `minimum`, `maximum`, `enum` |
| `BooleanSchema` | `"boolean"` | `default` |
| `ArraySchema` | `"array"` | `items`（嵌套 Schema）, `min_items`, `max_items` |
| `ObjectSchema` | `"object"` | `properties`, `required`, `additional_properties` |

所有 Schema 类均支持 `nullable` 参数，当设为 `True` 时生成联合类型（如 `["string", "null"]`），表示该字段接受 `null` 值。

Sources: [schema.py](nanobot/agent/tools/schema.py#L1-L233)

### `tool_parameters_schema` 与 `tool_parameters` 装饰器

`tool_parameters_schema()` 是一个便捷工厂函数，用于快速构建根级参数对象：

```python
tool_parameters_schema(
    command=StringSchema("The shell command to execute"),
    timeout=IntegerSchema(60, description="Timeout in seconds", minimum=1, maximum=600),
    required=["command"],
)
# 输出: {"type": "object", "properties": {"command": {...}, "timeout": {...}}, "required": ["command"]}
```

`@tool_parameters` 是一个类装饰器，它将 Schema 字典附加到 `Tool` 子类上，自动注入 `parameters` 属性实现，从而免去手动编写 `@property def parameters` 的样板代码。装饰器内部使用 `deepcopy` 确保每次访问 `parameters` 都返回独立的副本，避免不同工具实例之间的 Schema 状态污染。

Sources: [base.py](nanobot/agent/tools/base.py#L246-L279), [schema.py](nanobot/agent/tools/schema.py#L221-L232)

## ToolRegistry：注册、查找与执行管线

`ToolRegistry` 是一个轻量级的字典包装器，以工具名称为键、`Tool` 实例为值，提供完整的工具生命周期管理。

### 核心 API

| 方法/属性 | 说明 |
|-----------|------|
| `register(tool)` | 将 Tool 实例注册到 `_tools` 字典中，键为 `tool.name` |
| `unregister(name)` | 按名称移除工具（静默忽略不存在的名称） |
| `get(name) → Tool \| None` | 按名称查找工具 |
| `has(name) → bool` | 检查工具是否已注册 |
| `tool_names → list[str]` | 获取所有已注册工具的名称列表 |
| `get_definitions() → list[dict]` | 生成有序的工具定义列表（内置在前，MCP 在后） |
| `prepare_call(name, params) → (Tool, dict, str\|None)` | 解析工具、转型参数、校验参数，返回三元组 |
| `execute(name, params) → Any` | 完整执行管线：解析 → 校验 → 执行 |

Sources: [registry.py](nanobot/agent/tools/registry.py#L8-L110)

### 定义排序策略：缓存友好的 Prompt 前缀

`get_definitions()` 方法采用了精心设计的排序策略，将工具定义分为两组：**内置工具**（名称不以 `mcp_` 开头）和 **MCP 工具**（以 `mcp_` 开头），各组内按名称字母序排列，最终将内置工具放在前面。这一设计确保了每次请求的工具定义列表前缀保持稳定——内置工具集在运行期间不会变化，而 MCP 工具在连接建立后也保持固定。稳定的定义前缀有助于 LLM Provider 利用 **prompt caching**（提示缓存）优化，减少重复传输和 token 消耗。

Sources: [registry.py](nanobot/agent/tools/registry.py#L45-L63)

### 参数转型与校验管线

当 LLM 返回 `tool_calls` 时，参数值可能以字符串形式传递（例如 JSON 序列化后的结果）。注册表通过 `prepare_call` 方法执行两阶段处理：

1. **参数转型**（`cast_params`）：根据 JSON Schema 类型信息，将字符串 `"3"` 转为整数 `3`，将 `"true"` 转为布尔值 `True`，递归处理嵌套对象和数组。
2. **参数校验**（`validate_params`）：根据 JSON Schema 约束（`required`、`minimum/maximum`、`minLength/maxLength`、`enum` 等）验证参数值，返回错误列表。

```
LLM tool_call arguments
        │
        ▼
  ┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
  │  cast_params │────▶│  validate_params │────▶│   execute    │
  │ "3" → 3      │     │ required? min?   │     │ tool(**params)│
  │ "true"→ True │     │ max? enum?       │     │              │
  └─────────────┘     └─────────────────┘     └──────────────┘
        │                     │
        │  转型失败: 保持原值    │  校验失败: 返回错误消息
        ▼                     ▼
   类型安全的参数          "Error: Invalid parameters..."
```

校验失败时，`prepare_call` 返回的错误消息包含具体的校验问题描述（如 `"query must be at least 2 chars"`），同时附带提示 `[Analyze the error above and try a different approach.]`，引导 LLM 自行修正参数并重试。

Sources: [base.py](nanobot/agent/tools/base.py#L180-L232), [registry.py](nanobot/agent/tools/registry.py#L65-L99)

## 内置工具的注册流程

`AgentLoop` 在构造函数中调用 `_register_default_tools()` 方法，根据当前配置有条件地注册各内置工具：

```python
def _register_default_tools(self) -> None:
    # 文件系统工具（始终注册）
    self.tools.register(ReadFileTool(...))
    self.tools.register(WriteFileTool(...))
    self.tools.register(EditFileTool(...))
    self.tools.register(ListDirTool(...))
    self.tools.register(GlobTool(...))
    self.tools.register(GrepTool(...))
    # Shell 执行（需 exec.enable=True）
    if self.exec_config.enable:
        self.tools.register(ExecTool(...))
    # Web 工具（需 web.enable=True）
    if self.web_config.enable:
        self.tools.register(WebSearchTool(...))
        self.tools.register(WebFetchTool(...))
    # 消息与子代理（始终注册）
    self.tools.register(MessageTool(...))
    self.tools.register(SpawnTool(...))
    # 定时任务（需 Cron 服务已启用）
    if self.cron_service:
        self.tools.register(CronTool(...))
```

各内置工具通过构造函数参数接收运行时配置（工作区路径、允许访问的目录、沙箱设置等），实现了**工具实例化与注册表解耦**的设计——同一个 Tool 类可以以不同配置创建多个实例。

Sources: [loop.py](nanobot/agent/loop.py#L262-L287)

## MCP 工具的动态发现与注册

MCP（模型上下文协议）集成是工具注册表动态能力的核心体现。通过 `connect_mcp_servers()` 函数，nanobot 在运行时连接到外部 MCP 服务器，发现其暴露的工具、资源和提示，并将它们包装为原生 `Tool` 实例注册到注册表中。

### 三种 MCP 能力适配器

| 包装类 | 命名规则 | 说明 |
|--------|---------|------|
| `MCPToolWrapper` | `mcp_<server>_<tool>` | 将 MCP 服务器工具包装为可执行 Tool |
| `MCPResourceWrapper` | `mcp_<server>_resource_<name>` | 将 MCP 资源 URI 包装为只读 Tool |
| `MCPPromptWrapper` | `mcp_<server>_prompt_<name>` | 将 MCP 提示模板包装为只读 Tool |

所有 MCP 包装器都内置了超时控制（默认 30 秒，可通过 `MCPServerConfig.tool_timeout` 配置）和全面的异常处理——超时、取消、服务端错误均返回描述性字符串而非抛出异常，确保 Agent 循环不会因单个 MCP 工具故障而中断。

Sources: [mcp.py](nanobot/agent/tools/mcp.py#L77-L136), [mcp.py](nanobot/agent/tools/mcp.py#L309-L456)

### Schema 规范化

MCP 服务器返回的 JSON Schema 可能包含 OpenAI 不兼容的模式（如 nullable 联合类型 `["string", "null"]` 或 `anyOf`）。`_normalize_schema_for_openai()` 函数递归处理这些模式，将 `{"type": ["string", "null"]}` 转换为 `{"type": "string", "nullable": true}`，并展平单分支的 `anyOf`/`oneOf` 结构，确保最终生成的参数定义与 OpenAI function calling 格式完全兼容。

Sources: [mcp.py](nanobot/agent/tools/mcp.py#L34-L74)

### 延迟连接与生命周期管理

MCP 连接采用**延迟初始化**策略：`_connect_mcp()` 在 Agent 循环的 `run()` 方法首次被调用时触发，且通过 `_mcp_connected` 和 `_mcp_connecting` 标志防止重复连接。所有 MCP 连接使用的资源（子进程、HTTP 客户端等）都注册到 `AsyncExitStack` 上，在 `close_mcp()` 时统一清理。连接失败不会阻止 Agent 启动，错误会被记录并在后续消息处理时重试。

Sources: [loop.py](nanobot/agent/loop.py#L289-L309), [loop.py](nanobot/agent/loop.py#L486-L496)

### 工具过滤：`enabled_tools` 配置

`MCPServerConfig.enabled_tools` 控制哪些 MCP 工具被注册到注册表中：

- `["*"]`（默认）：注册该服务器的所有工具
- `["tool_name"]`：只注册指定工具（支持原始名称和 `mcp_<server>_<tool>` 格式）
- `[]`：不注册任何工具

当指定了具体工具名称但服务器未提供对应工具时，会输出警告日志并列出可用工具名称，帮助用户修正配置。

Sources: [config/schema.py](nanobot/config/schema.py#L180-L190), [mcp.py](nanobot/agent/tools/mcp.py#L379-L419)

## 并发调度：工具批处理策略

`AgentRunner._partition_tool_batches()` 方法根据工具的 `concurrency_safe` 属性将 LLM 返回的 `tool_calls` 分成多个批次。当 `concurrent_tools=True`（默认开启）时，属于同一批次内的多个只读工具会通过 `asyncio.gather` 并行执行，而独占工具（如 `exec`）或写操作工具则各自独占一个批次串行执行：

```
tool_calls: [read_file, glob, exec, grep, read_file]
                     │
    ┌────────────────┼────────────────┐
    ▼                ▼                ▼
  Batch 1         Batch 2         Batch 3
  (parallel)      (serial)        (parallel)
  ┌─────────┐    ┌───────┐    ┌─────────┐
  │read_file│    │ exec  │    │ grep    │
  │  glob   │    └───────┘    │read_file│
  └─────────┘                 └─────────┘
```

这种**读写分离的批处理策略**在保证安全性的同时最大化了只读操作的吞吐量——当 Agent 需要同时读取多个文件或搜索多个模式时，并行执行可以显著减少等待时间。

Sources: [runner.py](nanobot/agent/runner.py#L399-L426), [runner.py](nanobot/agent/runner.py#L699-L722)

## 注册表的扩展模式

### 自定义工具的集成方式

向注册表添加自定义工具只需三个步骤：

1. **继承 `Tool` 基类**，实现 `name`、`description`、`parameters` 和 `execute` 四个抽象成员。
2. **使用 `@tool_parameters` 装饰器**定义参数 Schema（推荐），或手动实现 `parameters` 属性。
3. **调用 `registry.register()`** 注册实例——可以在 `AgentLoop` 构造后通过外部代码注入。

```python
from nanobot.agent.tools.base import Tool, tool_parameters
from nanobot.agent.tools.schema import StringSchema, tool_parameters_schema

@tool_parameters(
    tool_parameters_schema(
        query=StringSchema("Search query"),
        required=["query"],
    )
)
class MyCustomTool(Tool):
    @property
    def name(self) -> str:
        return "my_search"

    @property
    def description(self) -> str:
        return "Custom search tool"

    async def execute(self, query: str, **kwargs) -> str:
        return f"Results for: {query}"
```

Sources: [base.py](nanobot/agent/tools/base.py#L246-L279)

### 动态注销与热替换

注册表提供 `unregister(name)` 方法，支持在运行时移除工具。结合 `register()` 方法，可以实现工具的**热替换**——先注销旧工具，再注册新实例。这一特性在 MCP 连接重连场景中尤为有用：当 MCP 服务器断开并重连时，旧的工具包装器会被新的包装器替换，而 Agent 无需重启。

Sources: [registry.py](nanobot/agent/tools/registry.py#L22-L24)

## 错误处理与自愈提示

注册表的 `execute` 方法和 Runner 的 `_run_tool` 方法都采用了**容错优先**的错误处理策略：

- **工具未找到**：返回 `"Error: Tool 'xxx' not found. Available: ..."` 并附带可用工具列表
- **参数校验失败**：返回 `"Error: Invalid parameters for tool 'xxx': ..."` 并列出具体校验错误
- **执行异常**：捕获所有异常并返回 `"Error executing xxx: ..."` 形式的字符串
- **结果以 "Error" 开头**：自动附加 `[Analyze the error above and try a different approach.]` 提示

这种设计确保错误信息以**字符串形式返回给 LLM**，而非抛出异常中断循环。LLM 能够读取错误描述、分析原因并尝试修正——形成了一种隐式的**自愈闭环**。

Sources: [registry.py](nanobot/agent/tools/registry.py#L85-L99), [runner.py](nanobot/agent/runner.py#L428-L498)

## 导航建议

- 了解各内置工具的具体实现和行为约束，参阅 [内置工具概览：文件系统、Shell、搜索与 Web](9-nei-zhi-gong-ju-gai-lan-wen-jian-xi-tong-shell-sou-suo-yu-web)
- 深入 MCP 协议的连接机制和传输层细节，参阅 [MCP（模型上下文协议）集成与工具发现](10-mcp-mo-xing-shang-xia-wen-xie-yi-ji-cheng-yu-gong-ju-fa-xian)
- 了解工具执行的安全隔离机制，参阅 [沙箱安全：Bubblewrap 隔离与工作区访问控制](12-sha-xiang-an-quan-bubblewrap-ge-chi-yu-gong-zuo-qu-fang-wen-kong-zhi)
- 理解注册表在 Agent 主循环中的调用时机，参阅 [Agent 主循环与工具调用生命周期](5-agent-zhu-xun-huan-yu-gong-ju-diao-yong-sheng-ming-zhou-qi)