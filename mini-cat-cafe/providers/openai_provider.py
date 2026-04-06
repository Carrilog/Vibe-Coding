from __future__ import annotations
"""OpenAI-compatible provider (works with OpenAI, DeepSeek, Qwen, etc.)."""
import os
from typing import Any

from openai import AsyncOpenAI

from core.llm_interface import BaseLLMProvider
from core.types import LLMResponse, Message, Role, ToolCall


class OpenAICompatibleProvider(BaseLLMProvider):
    """Works with any OpenAI-compatible API: OpenAI, DeepSeek, Qwen, Moonshot, etc."""

    def __init__(
        self,
        model: str,
        api_key: str | None = None,
        base_url: str | None = None,
        env_key: str = "OPENAI_API_KEY",
    ):
        self.model = model
        self.client = AsyncOpenAI(
            api_key=api_key or os.environ[env_key],
            base_url=base_url,
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
            if m.role == Role.USER and m.raw_blocks:
                # tool_result blocks (role=USER with raw_blocks = tool results)
                for block in m.raw_blocks:
                    api_messages.append({
                        "role": "tool",
                        "tool_call_id": block["tool_use_id"],
                        "content": block["content"],
                    })
            elif m.role == Role.ASSISTANT and m.raw_blocks:
                # assistant message with tool_calls
                api_messages.append({
                    "role": "assistant",
                    "content": m.content or None,
                    "tool_calls": m.raw_blocks,
                })
            else:
                api_messages.append({"role": m.role.value, "content": m.content})

        # Convert Anthropic-style input_schema → OpenAI-style parameters
        oai_tools = None
        if tools:
            oai_tools = []
            for t in tools:
                fn = {
                    "name": t["name"],
                    "description": t.get("description", ""),
                    "parameters": t.get("input_schema", t.get("parameters", {})),
                }
                oai_tools.append({"type": "function", "function": fn})

        params: dict[str, Any] = {
            "model": self.model,
            "messages": api_messages,
            "max_tokens": kwargs.get("max_tokens", 16000),
        }
        if oai_tools:
            params["tools"] = oai_tools

        response = await self.client.chat.completions.create(**params)
        choice = response.choices[0].message

        tool_calls = []
        raw_blocks = []
        if choice.tool_calls:
            import json
            for tc in choice.tool_calls:
                args = json.loads(tc.function.arguments)
                tool_calls.append(
                    ToolCall(name=tc.function.name, arguments=args, call_id=tc.id)
                )
                # Store raw tool_calls block for assistant message round-trip
                raw_blocks.append({
                    "id": tc.id,
                    "type": "function",
                    "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                })

        return LLMResponse(
            content=choice.content or "",
            tool_calls=tool_calls,
            raw_blocks=raw_blocks,
            usage={
                "input_tokens": response.usage.prompt_tokens,
                "output_tokens": response.usage.completion_tokens,
            },
            model=self.model,
        )
