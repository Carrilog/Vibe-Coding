from __future__ import annotations

"""Tool-using agent mixin — handles the tool call loop."""
from typing import Any

from core.base_agent import BaseAgent
from core.types import Message, Role
from tools.base_tool import BaseTool


class ToolUsingAgent(BaseAgent):
    """Agent that can call tools in a loop until it produces a final answer."""

    def __init__(self, llm, name: str, tools: list[BaseTool], system_prompt: str):
        super().__init__(llm, name)
        self.tools: dict[str, BaseTool] = {t.name: t for t in tools}
        self.system_prompt = system_prompt

    async def run(self, task: str, context: dict[str, Any] | None = None) -> str:
        messages = [
            Message(Role.SYSTEM, self.system_prompt),
            Message(Role.USER, task),
        ]
        tool_schemas = [t.to_llm_schema() for t in self.tools.values()]

        for _ in range(10):  # max iterations
            response = await self.llm.complete(messages, tools=tool_schemas or None)

            if not response.tool_calls:
                return response.content

            # Append assistant turn — preserve raw blocks for Anthropic protocol
            messages.append(
                Message(
                    Role.ASSISTANT,
                    response.content,
                    raw_blocks=response.raw_blocks,
                    metadata=response.metadata,
                )
            )

            # Execute tools and build tool_result blocks
            tool_result_blocks = []
            for tc in response.tool_calls:
                tool = self.tools.get(tc.name)
                result = (
                    await tool.execute(**tc.arguments)
                    if tool is not None
                    else f"Error: unknown tool '{tc.name}'"
                )
                tool_result_blocks.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": tc.call_id,
                        "content": result,
                    }
                )

            # All tool results go in a single user message
            messages.append(Message(Role.USER, "", raw_blocks=tool_result_blocks))

        return "Max iterations reached without a final answer."
