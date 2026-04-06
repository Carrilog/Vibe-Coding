from __future__ import annotations

"""DeepSeek provider — supports chat and reasoning (R1) models."""
import os
from typing import Any

from openai import AsyncOpenAI

from core.llm_interface import BaseLLMProvider
from core.types import LLMResponse, Message, Role, ToolCall

REASONING_MODELS = {"deepseek-reasoner"}


class DeepSeekProvider(BaseLLMProvider):
    """
    DeepSeek provider with first-class support for:
    - Chat models (deepseek-chat): standard tool-calling
    - Reasoning models (deepseek-reasoner): reasoning_content extraction
      and correct round-trip in multi-turn tool loops

    Reasoning models require reasoning_content to be echoed back in
    subsequent assistant messages during tool loops, otherwise the API
    returns 400.

    API reference: https://api-docs.deepseek.com/
    """

    def __init__(
        self,
        model: str = "deepseek-chat",
        api_key: str | None = None,
        base_url: str | None = None,
    ):
        self.model = model
        self.base_url = base_url or "https://api.deepseek.com/v1"
        self.client = AsyncOpenAI(
            api_key=api_key or os.environ["DEEPSEEK_API_KEY"],
            base_url=self.base_url,
        )

    def get_model_name(self) -> str:
        return self.model

    @property
    def is_reasoning_model(self) -> bool:
        return self.model in REASONING_MODELS or "reasoner" in self.model

    async def complete(
        self,
        messages: list[Message],
        tools: list[dict[str, Any]] | None = None,
        **kwargs,
    ) -> LLMResponse:
        api_messages = self._build_api_messages(messages)

        params: dict[str, Any] = {
            "model": self.model,
            "messages": api_messages,
            "max_tokens": kwargs.get("max_tokens", 8192),
        }

        if tools:
            params["tools"] = self._convert_tools(tools)

        response = await self.client.chat.completions.create(**params)
        choice = response.choices[0].message

        reasoning_content = getattr(choice, "reasoning_content", None)

        tool_calls, raw_blocks = self._parse_tool_calls(choice)

        usage = {}
        if response.usage:
            usage = {
                "input_tokens": response.usage.prompt_tokens,
                "output_tokens": response.usage.completion_tokens,
            }
            prompt_cache_hit = getattr(response.usage, "prompt_cache_hit_tokens", 0)
            if prompt_cache_hit:
                usage["cache_hit_tokens"] = prompt_cache_hit

        metadata = {}
        if reasoning_content:
            metadata["reasoning_content"] = reasoning_content

        return LLMResponse(
            content=choice.content or "",
            tool_calls=tool_calls,
            raw_blocks=raw_blocks,
            usage=usage,
            model=self.model,
            metadata=metadata,
        )

    def _build_api_messages(self, messages: list[Message]) -> list[dict[str, Any]]:
        api_messages = []
        for m in messages:
            if m.role == Role.USER and m.raw_blocks:
                for block in m.raw_blocks:
                    api_messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": block["tool_use_id"],
                            "content": block["content"],
                        }
                    )
            elif m.role == Role.ASSISTANT and (
                m.raw_blocks or m.metadata.get("reasoning_content")
            ):
                msg: dict[str, Any] = {
                    "role": "assistant",
                    "content": m.content or None,
                }
                if m.raw_blocks:
                    msg["tool_calls"] = m.raw_blocks
                if m.metadata.get("reasoning_content"):
                    msg["reasoning_content"] = m.metadata["reasoning_content"]
                api_messages.append(msg)
            else:
                api_messages.append({"role": m.role.value, "content": m.content})
        return api_messages

    def _convert_tools(self, tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
        oai_tools = []
        for t in tools:
            fn = {
                "name": t["name"],
                "description": t.get("description", ""),
                "parameters": t.get("input_schema", t.get("parameters", {})),
            }
            oai_tools.append({"type": "function", "function": fn})
        return oai_tools

    def _parse_tool_calls(self, choice) -> tuple[list[ToolCall], list[dict]]:
        import json

        tool_calls = []
        raw_blocks = []
        if choice.tool_calls:
            for tc in choice.tool_calls:
                args = json.loads(tc.function.arguments)
                tool_calls.append(
                    ToolCall(name=tc.function.name, arguments=args, call_id=tc.id)
                )
                raw_blocks.append(
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                )
        return tool_calls, raw_blocks
