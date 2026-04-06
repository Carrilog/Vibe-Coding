"""Core message and type definitions."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class Role(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    TOOL = "tool"


@dataclass
class Message:
    role: Role
    content: str
    # raw_blocks: provider-specific structured content (tool_use/tool_result blocks).
    # When set, providers use this instead of content for API serialization.
    raw_blocks: list[Any] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ToolCall:
    name: str
    arguments: dict[str, Any]
    call_id: str = ""


@dataclass
class LLMResponse:
    content: str
    tool_calls: list[ToolCall] = field(default_factory=list)
    raw_blocks: list[Any] = field(default_factory=list)
    usage: dict[str, int] = field(default_factory=dict)
    model: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)
