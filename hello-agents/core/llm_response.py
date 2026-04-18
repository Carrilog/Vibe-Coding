"""LLM响应对象定义"""

from typing import Optional, Dict, List
from dataclasses import dataclass, field


@dataclass
class ToolCall:
    """统一的工具调用对象"""
    id: str
    name: str
    arguments: str


@dataclass
class LLMToolResponse:
    """统一的工具调用响应对象"""
    content: Optional[str]
    tool_calls: List[ToolCall]
    model: str
    usage: Dict[str, int] = field(default_factory=dict)
    latency_ms: int = 0


@dataclass
class LLMResponse:
    """统一的LLM响应对象"""

    content: str
    model: str
    usage: Dict[str, int] = field(default_factory=dict)
    latency_ms: int = 0
    reasoning_content: Optional[str] = None

    def __str__(self) -> str:
        return self.content

    def __repr__(self) -> str:
        parts = [
            f"LLMResponse(model={self.model}",
            f"latency={self.latency_ms}ms",
            f"tokens={self.usage.get('total_tokens', 0)}",
        ]
        if self.reasoning_content:
            parts.append("has_reasoning=True")
        parts.append(f"content_length={len(self.content)})")
        return ", ".join(parts)

    def to_dict(self) -> Dict:
        """转换为字典格式"""
        result = {
            "content": self.content,
            "model": self.model,
            "usage": self.usage,
            "latency_ms": self.latency_ms,
        }
        if self.reasoning_content:
            result["reasoning_content"] = self.reasoning_content
        return result


@dataclass
class StreamStats:
    """流式调用的统计信息"""

    model: str
    usage: Dict[str, int] = field(default_factory=dict)
    latency_ms: int = 0
    reasoning_content: Optional[str] = None

    def to_dict(self) -> Dict:
        """转换为字典格式"""
        result = {
            "model": self.model,
            "usage": self.usage,
            "latency_ms": self.latency_ms,
        }
        if self.reasoning_content:
            result["reasoning_content"] = self.reasoning_content
        return result
