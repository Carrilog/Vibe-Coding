"""Agent 异步生命周期事件系统（占位，后续填充）"""

from dataclasses import dataclass, field
from typing import Any, Dict, Optional, Callable, Awaitable
from enum import Enum
import time


class EventType(Enum):
    """Agent 生命周期事件类型"""
    AGENT_START = "agent_start"
    AGENT_FINISH = "agent_finish"
    AGENT_ERROR = "agent_error"
    STEP_START = "step_start"
    STEP_FINISH = "step_finish"
    LLM_START = "llm_start"
    LLM_CHUNK = "llm_chunk"
    LLM_FINISH = "llm_finish"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    TOOL_ERROR = "tool_error"
    THINKING = "thinking"
    REFLECTION = "reflection"
    PLAN = "plan"


@dataclass
class AgentEvent:
    """Agent 生命周期事件"""
    type: EventType
    timestamp: float
    agent_name: str
    data: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def create(cls, event_type: EventType, agent_name: str, **data) -> 'AgentEvent':
        return cls(type=event_type, timestamp=time.time(), agent_name=agent_name, data=data)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type.value,
            "timestamp": self.timestamp,
            "agent_name": self.agent_name,
            "data": self.data
        }

    def __str__(self) -> str:
        return f"[{self.type.value}] {self.agent_name} @ {self.timestamp:.2f}: {self.data}"


LifecycleHook = Optional[Callable[[AgentEvent], Awaitable[None]]]


@dataclass
class ExecutionContext:
    """Agent 执行上下文"""
    input_text: str
    current_step: int = 0
    total_tokens: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def increment_step(self):
        self.current_step += 1

    def add_tokens(self, tokens: int):
        self.total_tokens += tokens

    def set_metadata(self, key: str, value: Any):
        self.metadata[key] = value

    def get_metadata(self, key: str, default: Any = None) -> Any:
        return self.metadata.get(key, default)
