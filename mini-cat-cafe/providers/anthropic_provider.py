from __future__ import annotations
"""Anthropic Claude provider."""
import os
from typing import Any

import anthropic

from core.llm_interface import BaseLLMProvider
from core.types import LLMResponse, Message, Role, ToolCall


class AnthropicProvider(BaseLLMProvider):
    def __init__(self, model: str = "claude-opus-4-6", api_key: str | None = None):
        self.model = model
        self.client = anthropic.AsyncAnthropic(
            api_key=api_key or os.environ["ANTHROPIC_API_KEY"]
        )

    def get_model_name(self) -> str:
        return self.model

    async def complete(
        self,
        messages: list[Message],
        tools: list[dict[str, Any]] | None = None,
        **kwargs,
    ) -> LLMResponse:
        api_messages = []
        for m in messages:
            if m.role == Role.SYSTEM:
                continue
            if m.raw_blocks:
                api_messages.append({"role": m.role.value, "content": m.raw_blocks})
            else:
                api_messages.append({"role": m.role.value, "content": m.content})

        system = next(
            (m.content for m in messages if m.role == Role.SYSTEM), None
        )

        # adaptive thinking is supported on claude-*-4-6 models only
        _supports_adaptive = "4-6" in self.model
        params: dict[str, Any] = {
            "model": self.model,
            "max_tokens": kwargs.get("max_tokens", 16000),
            "messages": api_messages,
        }
        if _supports_adaptive:
            params["thinking"] = {"type": "adaptive"}
        if system:
            params["system"] = system
        if tools:
            params["tools"] = tools

        response = await self.client.messages.create(**params)

        tool_calls = []
        content_text = ""
        for block in response.content:
            if block.type == "text":
                content_text += block.text
            elif block.type == "tool_use":
                tool_calls.append(
                    ToolCall(
                        name=block.name,
                        arguments=block.input,
                        call_id=block.id,
                    )
                )

        # Preserve raw content blocks for correct tool round-trip
        raw_blocks = [
            {"type": "text", "text": b.text} if b.type == "text"
            else {"type": "tool_use", "id": b.id, "name": b.name, "input": b.input}
            for b in response.content
            if b.type in ("text", "tool_use")
        ]

        return LLMResponse(
            content=content_text,
            tool_calls=tool_calls,
            raw_blocks=raw_blocks,
            usage={
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            },
            model=self.model,
        )
