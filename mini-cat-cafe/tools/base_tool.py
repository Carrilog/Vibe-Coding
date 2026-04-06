"""Abstract base class for tools."""
from abc import ABC, abstractmethod
from typing import Any


class BaseTool(ABC):
    @property
    @abstractmethod
    def name(self) -> str: ...

    @property
    @abstractmethod
    def description(self) -> str: ...

    @property
    @abstractmethod
    def parameters_schema(self) -> dict[str, Any]: ...

    @abstractmethod
    async def execute(self, **kwargs) -> str: ...

    def to_llm_schema(self) -> dict[str, Any]:
        """Convert to the schema format expected by LLM providers."""
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.parameters_schema,
        }
