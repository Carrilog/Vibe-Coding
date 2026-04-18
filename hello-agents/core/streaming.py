"""流式输出支持（占位，后续填充）"""

from typing import Dict, Any
from dataclasses import dataclass
import json
import time
from enum import Enum


class StreamEventType(Enum):
    """流式事件类型"""
    AGENT_START = "agent_start"
    AGENT_FINISH = "agent_finish"
    STEP_START = "step_start"
    STEP_FINISH = "step_finish"
    TOOL_CALL_START = "tool_call_start"
    TOOL_CALL_FINISH = "tool_call_finish"
    LLM_CHUNK = "llm_chunk"
    THINKING = "thinking"
    ERROR = "error"


@dataclass
class StreamEvent:
    """流式事件"""
    type: StreamEventType
    timestamp: float
    agent_name: str
    data: Dict[str, Any]

    @classmethod
    def create(cls, event_type: StreamEventType, agent_name: str, **data) -> 'StreamEvent':
        return cls(type=event_type, timestamp=time.time(), agent_name=agent_name, data=data)

    def to_sse(self) -> str:
        event_dict = {
            "type": self.type.value,
            "timestamp": self.timestamp,
            "agent_name": self.agent_name,
            "data": self.data
        }
        lines = [
            f"event: {self.type.value}",
            f"data: {json.dumps(event_dict, ensure_ascii=False)}",
            ""
        ]
        return "\n".join(lines) + "\n"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type.value,
            "timestamp": self.timestamp,
            "agent_name": self.agent_name,
            "data": self.data
        }


class StreamBuffer:
    """流式输出缓冲区（占位）"""

    def __init__(self, max_buffer_size: int = 100):
        self.max_buffer_size = max_buffer_size
        self.events: list[StreamEvent] = []

    def add(self, event: StreamEvent):
        self.events.append(event)
        if len(self.events) > self.max_buffer_size:
            self.events.pop(0)

    def get_all(self) -> list[StreamEvent]:
        return self.events.copy()

    def clear(self):
        self.events.clear()

    def filter_by_type(self, event_type: StreamEventType) -> list[StreamEvent]:
        return [e for e in self.events if e.type == event_type]
