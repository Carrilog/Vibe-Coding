from __future__ import annotations
"""Abstract base class for all agents."""
from abc import ABC, abstractmethod
from typing import Any

from .llm_interface import BaseLLMProvider
from .types import Message, LLMResponse


class BaseAgent(ABC):
    """Base class for all agents in the system."""

    def __init__(self, llm: BaseLLMProvider, name: str):
        self.llm = llm
        self.name = name
        self.history: list[Message] = []

    @abstractmethod
    async def run(self, task: str, context: dict[str, Any] | None = None) -> str:
        """Execute a task and return the result."""
        ...

    def _add_to_history(self, message: Message) -> None:
        self.history.append(message)

    def clear_history(self) -> None:
        self.history.clear()
