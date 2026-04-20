# HelloAgents v0.1 — 架构 UML 图

> 基于 Mermaid 语法，可在 VS Code（Mermaid 插件）或 GitHub 上直接渲染

---

## 1. 类图 — 整体架构

```mermaid
classDiagram
    direction TB

    %% ==================== 异常体系 ====================
    class HelloAgentsException {
        <<Exception>>
    }
    class LLMException {
        <<Exception>>
    }
    class AgentException {
        <<Exception>>
    }
    class ConfigException {
        <<Exception>>
    }
    class ToolException {
        <<Exception>>
    }

    HelloAgentsException <|-- LLMException
    HelloAgentsException <|-- AgentException
    HelloAgentsException <|-- ConfigException
    HelloAgentsException <|-- ToolException

    %% ==================== 配置与消息 ====================
    class Config {
        <<BaseModel>>
        +str default_model
        +str default_provider
        +float temperature
        +int max_tokens
        +bool debug
        +str log_level
        +int max_history_length
        +int context_window
        +float compression_threshold
        +int min_retain_rounds
        +bool enable_smart_compression
        +from_env()$ Config
        +to_dict() Dict
    }

    class Message {
        <<BaseModel>>
        +str content
        +MessageRole role
        +datetime timestamp
        +Dict metadata
        +to_dict() Dict
        +from_dict(data)$ Message
        +to_text() str
    }

    %% ==================== LLM 响应对象 ====================
    class ToolCall {
        <<dataclass>>
        +str id
        +str name
        +str arguments
    }

    class LLMResponse {
        <<dataclass>>
        +str content
        +str model
        +Dict usage
        +int latency_ms
        +str reasoning_content
        +to_dict() Dict
    }

    class LLMToolResponse {
        <<dataclass>>
        +str content
        +List~ToolCall~ tool_calls
        +str model
        +Dict usage
        +int latency_ms
    }

    class StreamStats {
        <<dataclass>>
        +str model
        +Dict usage
        +int latency_ms
        +str reasoning_content
        +to_dict() Dict
    }

    LLMToolResponse o-- ToolCall : contains

    %% ==================== 适配器层 ====================
    class BaseLLMAdapter {
        <<ABC>>
        +str api_key
        +str base_url
        +int timeout
        +str model
        -Any _client
        +create_client()* Any
        +invoke(messages, **kwargs)* LLMResponse
        +stream_invoke(messages, **kwargs)* Iterator~str~
        +invoke_with_tools(messages, tools, **kwargs)* LLMToolResponse
        +_is_thinking_model(model_name) bool
    }

    class OpenAIAdapter {
        +StreamStats last_stats
        +create_client() OpenAI
        +invoke(messages, **kwargs) LLMResponse
        +stream_invoke(messages, **kwargs) Iterator~str~
        +invoke_with_tools(messages, tools, tool_choice, **kwargs) LLMToolResponse
    }

    BaseLLMAdapter <|-- OpenAIAdapter : 继承

    %% ==================== Facade 层 ====================
    class HelloAgentsLLM {
        +str model
        +str api_key
        +str base_url
        +int timeout
        +float temperature
        +int max_tokens
        -BaseLLMAdapter _adapter
        +StreamStats last_call_stats
        +think(messages, temperature) Iterator~str~
        +invoke(messages, **kwargs) LLMResponse
        +stream_invoke(messages, **kwargs) Iterator~str~
        +invoke_with_tools(messages, tools, tool_choice, **kwargs) LLMToolResponse
    }

    HelloAgentsLLM --> BaseLLMAdapter : _adapter
    HelloAgentsLLM ..> LLMResponse : returns
    HelloAgentsLLM ..> LLMToolResponse : returns
    HelloAgentsLLM ..> StreamStats : stores

    %% ==================== Agent 层 ====================
    class Agent {
        <<ABC>>
        +str name
        +HelloAgentsLLM llm
        +str system_prompt
        +Config config
        +Any tool_registry
        -List~Message~ _history
        +run(input_text, **kwargs)* str
        +add_message(message)
        +clear_history()
        +get_history() List~Message~
        +_build_messages(input_text) List~Dict~
        +_build_tool_schemas() List~Dict~
        +_map_parameter_type(param_type)$ str
        +_convert_parameter_types(tool_name, param_dict) Dict
        +_execute_tool_call(tool_name, arguments) str
    }

    Agent --> HelloAgentsLLM : llm
    Agent --> Config : config
    Agent o-- Message : _history
```

---

## 2. 类图 — 适配器工厂模式

```mermaid
classDiagram
    direction LR

    class BaseLLMAdapter {
        <<ABC>>
        +create_client()* Any
        +invoke()* LLMResponse
        +stream_invoke()* Iterator
        +invoke_with_tools()* LLMToolResponse
    }

    class OpenAIAdapter {
        +create_client() OpenAI
        +invoke() LLMResponse
        +stream_invoke() Iterator
        +invoke_with_tools() LLMToolResponse
    }

    class AnthropicAdapter {
        <<future>>
        +create_client() Anthropic
        +invoke() LLMResponse
        +stream_invoke() Iterator
        +invoke_with_tools() LLMToolResponse
    }

    class GeminiAdapter {
        <<future>>
        +create_client() GenAI
        +invoke() LLMResponse
        +stream_invoke() Iterator
        +invoke_with_tools() LLMToolResponse
    }

    BaseLLMAdapter <|-- OpenAIAdapter
    BaseLLMAdapter <|-- AnthropicAdapter
    BaseLLMAdapter <|-- GeminiAdapter

    class create_adapter {
        <<factory>>
        +create_adapter(api_key, base_url, timeout, model) BaseLLMAdapter
    }

    create_adapter ..> OpenAIAdapter : 当前默认
    create_adapter ..> AnthropicAdapter : 后续扩展
    create_adapter ..> GeminiAdapter : 后续扩展

    class HelloAgentsLLM {
        <<Facade>>
        -BaseLLMAdapter _adapter
        +think()
        +invoke()
        +stream_invoke()
        +invoke_with_tools()
    }

    HelloAgentsLLM --> BaseLLMAdapter : 依赖抽象，不依赖具体
    HelloAgentsLLM ..> create_adapter : 通过工厂创建适配器
```

---

## 3. 类图 — 占位模块（Lifecycle / Streaming / SessionStore）

```mermaid
classDiagram
    direction TB

    class EventType {
        <<Enum>>
        AGENT_START
        AGENT_FINISH
        AGENT_ERROR
        STEP_START
        STEP_FINISH
        LLM_START
        LLM_CHUNK
        LLM_FINISH
        TOOL_CALL
        TOOL_RESULT
        TOOL_ERROR
        THINKING
        REFLECTION
        PLAN
    }

    class AgentEvent {
        <<dataclass>>
        +EventType type
        +float timestamp
        +str agent_name
        +Dict data
        +create(event_type, agent_name, **data)$ AgentEvent
        +to_dict() Dict
    }

    class ExecutionContext {
        <<dataclass>>
        +str input_text
        +int current_step
        +int total_tokens
        +Dict metadata
        +increment_step()
        +add_tokens(tokens)
        +set_metadata(key, value)
        +get_metadata(key, default)
    }

    AgentEvent --> EventType

    class StreamEventType {
        <<Enum>>
        AGENT_START
        AGENT_FINISH
        STEP_START
        STEP_FINISH
        TOOL_CALL_START
        TOOL_CALL_FINISH
        LLM_CHUNK
        THINKING
        ERROR
    }

    class StreamEvent {
        <<dataclass>>
        +StreamEventType type
        +float timestamp
        +str agent_name
        +Dict data
        +create(event_type, agent_name, **data)$ StreamEvent
        +to_sse() str
        +to_dict() Dict
    }

    class StreamBuffer {
        +int max_buffer_size
        +List~StreamEvent~ events
        +add(event)
        +get_all() List
        +clear()
        +filter_by_type(event_type) List
    }

    StreamEvent --> StreamEventType
    StreamBuffer o-- StreamEvent

    class SessionStore {
        <<placeholder>>
        +Path session_dir
        -_generate_session_id() str
        +save(...)* str
        +load(filepath)* Dict
        +list_sessions()* List
        +delete(session_name)* bool
        +check_config_consistency(...)* Dict
        +check_tool_schema_consistency(...)* Dict
    }
```

---

## 4. 时序图 — 非流式调用（invoke）

```mermaid
sequenceDiagram
    participant User as 用户代码
    participant Agent as Agent (子类)
    participant LLM as HelloAgentsLLM
    participant Factory as create_adapter()
    participant Adapter as OpenAIAdapter
    participant API as OpenAI API / Ollama

    User ->> Agent: run(input_text)
    Agent ->> Agent: _build_messages(input_text)
    Note right of Agent: 组装 system_prompt<br/>+ _history<br/>+ user input

    Agent ->> LLM: invoke(messages)
    LLM ->> LLM: 合并 temperature / max_tokens

    alt 首次调用（_client 为 None）
        LLM ->> Factory: create_adapter(api_key, base_url, timeout, model)
        Factory -->> LLM: OpenAIAdapter 实例
    end

    LLM ->> Adapter: invoke(messages, **kwargs)

    alt _client 未初始化
        Adapter ->> Adapter: create_client()
        Note right of Adapter: from openai import OpenAI<br/>OpenAI(api_key, base_url, timeout)
    end

    Adapter ->> API: chat.completions.create(model, messages, **kwargs)
    API -->> Adapter: ChatCompletion Response

    Adapter ->> Adapter: 提取 content, usage, reasoning_content
    Adapter ->> Adapter: 计算 latency_ms
    Adapter -->> LLM: LLMResponse(content, model, usage, latency_ms)
    LLM -->> Agent: LLMResponse

    Agent ->> Agent: add_message(user_msg)
    Agent ->> Agent: add_message(assistant_msg)
    Agent -->> User: response_text
```

---

## 5. 时序图 — 流式调用（think / stream_invoke）

```mermaid
sequenceDiagram
    participant User as 用户代码
    participant LLM as HelloAgentsLLM
    participant Adapter as OpenAIAdapter
    participant API as OpenAI API / Ollama

    User ->> LLM: think(messages, temperature)
    LLM ->> LLM: print("🧠 正在调用模型...")

    LLM ->> Adapter: stream_invoke(messages, **kwargs)
    Adapter ->> API: chat.completions.create(stream=True)

    loop 逐块返回
        API -->> Adapter: chunk (delta.content)
        Adapter -->> LLM: yield chunk_text
        LLM ->> LLM: print(chunk, end="", flush=True)
        LLM -->> User: yield chunk_text
    end

    Note over API, Adapter: 最后一个 chunk 可能包含 usage 信息

    Adapter ->> Adapter: 构建 StreamStats(model, usage, latency_ms)
    Adapter -->> Adapter: self.last_stats = StreamStats

    LLM ->> LLM: self.last_call_stats = adapter.last_stats
    LLM -->> User: 流结束
```

---

## 6. 时序图 — 工具调用（Function Calling）

```mermaid
sequenceDiagram
    participant User as 用户代码
    participant Agent as Agent (子类)
    participant LLM as HelloAgentsLLM
    participant Adapter as OpenAIAdapter
    participant API as OpenAI API / Ollama
    participant Tool as ToolRegistry / Tool

    User ->> Agent: run(input_text)
    Agent ->> Agent: _build_messages(input_text)
    Agent ->> Agent: _build_tool_schemas()
    Note right of Agent: 遍历 tool_registry<br/>构建 JSON Schema 列表

    Agent ->> LLM: invoke_with_tools(messages, tools)
    LLM ->> Adapter: invoke_with_tools(messages, tools, tool_choice="auto")
    Adapter ->> API: chat.completions.create(tools=tools, tool_choice="auto")
    API -->> Adapter: Response (含 tool_calls)

    Adapter ->> Adapter: 解析 tool_calls → List[ToolCall]
    Adapter -->> LLM: LLMToolResponse(content, tool_calls, model, usage)
    LLM -->> Agent: LLMToolResponse

    loop 遍历每个 tool_call
        Agent ->> Agent: _convert_parameter_types(tool_name, arguments)
        Agent ->> Tool: tool.run(typed_arguments)
        Tool -->> Agent: result (str)
        Agent ->> Agent: 将 tool result 追加到 messages
    end

    Note over Agent: 携带工具结果再次调用 LLM

    Agent ->> LLM: invoke(messages_with_tool_results)
    LLM ->> Adapter: invoke(messages)
    Adapter ->> API: chat.completions.create(messages)
    API -->> Adapter: 最终回复
    Adapter -->> LLM: LLMResponse
    LLM -->> Agent: LLMResponse
    Agent -->> User: final_response_text
```

---

## 7. 时序图 — 对象创建流程

```mermaid
sequenceDiagram
    participant User as 用户代码
    participant LLM as HelloAgentsLLM
    participant Factory as create_adapter()
    participant Adapter as OpenAIAdapter
    participant Config as Config
    participant Agent as Agent (子类)

    User ->> Config: Config() 或 Config.from_env()
    Config -->> User: config 实例

    User ->> LLM: HelloAgentsLLM(model="deepseek-r1:32b")
    LLM ->> LLM: 读取环境变量 / 使用默认值
    Note right of LLM: api_key = "ollama"<br/>base_url = "localhost:11434/v1"<br/>timeout = 60

    LLM ->> Factory: create_adapter(api_key, base_url, timeout, model)
    Factory ->> Adapter: OpenAIAdapter(...)
    Note right of Factory: 当前始终返回 OpenAIAdapter<br/>后续按 provider 分发
    Adapter -->> Factory: adapter 实例
    Factory -->> LLM: adapter 实例
    LLM -->> User: llm 实例

    User ->> Agent: SimpleAgent(name, llm, system_prompt, config)
    Agent ->> Agent: 初始化 _history = []
    Agent -->> User: agent 实例

    User ->> Agent: agent.run("你好")
    Note right of Agent: 进入具体 Agent 的执行逻辑
```
