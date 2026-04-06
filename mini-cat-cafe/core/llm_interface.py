from __future__ import annotations
"""Abstract LLM provider interface."""
from abc import ABC, abstractmethod
from typing import Any

from .types import LLMResponse, Message


class BaseLLMProvider(ABC):
    """All LLM providers must implement this interface."""

    @abstractmethod
    async def complete(
        self,
        messages: list[Message],
        tools: list[dict[str, Any]] | None = None,
        **kwargs,
    ) -> LLMResponse:
        """Send messages and get a response."""
        ...

    @abstractmethod
    def get_model_name(self) -> str:
        """Return the model identifier."""
        ...
