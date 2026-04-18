"""LLM适配器 - 最小化版本，仅支持Ollama（OpenAI兼容协议）"""

import time
from abc import ABC, abstractmethod
from typing import Optional, Iterator, List, Dict, Any, Union

from .llm_response import LLMResponse, StreamStats, LLMToolResponse, ToolCall
from .exceptions import HelloAgentsException


class BaseLLMAdapter(ABC):
    """LLM适配器基类"""

    def __init__(self, api_key: str, base_url: Optional[str], timeout: int, model: str):
        self.api_key = api_key
        self.base_url = base_url
        self.timeout = timeout
        self.model = model
        self._client = None

    @abstractmethod
    def create_client(self) -> Any:
        """创建客户端实例"""
        pass

    @abstractmethod
    def invoke(self, messages: List[Dict], **kwargs) -> LLMResponse:
        """非流式调用"""
        pass

    @abstractmethod
    def stream_invoke(self, messages: List[Dict], **kwargs) -> Iterator[str]:
        """流式调用，返回生成器"""
        pass

    @abstractmethod
    def invoke_with_tools(self, messages: List[Dict], tools: List[Dict], **kwargs) -> LLMToolResponse:
        """工具调用（Function Calling）"""
        pass

    def _is_thinking_model(self, model_name: str) -> bool:
        """判断是否为thinking model"""
        thinking_keywords = ["reasoner", "o1", "o3", "thinking"]
        model_lower = model_name.lower()
        return any(keyword in model_lower for keyword in thinking_keywords)


class OpenAIAdapter(BaseLLMAdapter):
    """OpenAI兼容接口适配器（默认）

    支持：
    - OpenAI官方API
    - 所有OpenAI兼容接口（DeepSeek、Qwen、Ollama等）
    """

    def create_client(self) -> Any:
        """创建OpenAI客户端"""
        from openai import OpenAI

        return OpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
            timeout=self.timeout
        )

    def invoke(self, messages: List[Dict], **kwargs) -> LLMResponse:
        """非流式调用"""
        if not self._client:
            self._client = self.create_client()

        start_time = time.time()

        try:
            response = self._client.chat.completions.create(
                model=self.model,
                messages=messages,
                **kwargs
            )

            latency_ms = int((time.time() - start_time) * 1000)

            choice = response.choices[0]
            content = choice.message.content or ""
            reasoning_content = None

            if self._is_thinking_model(self.model):
                if hasattr(choice.message, 'reasoning_content'):
                    reasoning_content = choice.message.reasoning_content

            usage = {}
            if hasattr(response, 'usage') and response.usage:
                usage = {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens,
                }

            return LLMResponse(
                content=content,
                model=self.model,
                usage=usage,
                latency_ms=latency_ms,
                reasoning_content=reasoning_content
            )

        except Exception as e:
            raise HelloAgentsException(f"OpenAI API调用失败: {str(e)}")

    def stream_invoke(self, messages: List[Dict], **kwargs) -> Iterator[str]:
        """流式调用"""
        if not self._client:
            self._client = self.create_client()

        start_time = time.time()

        try:
            response = self._client.chat.completions.create(
                model=self.model,
                messages=messages,
                stream=True,
                **kwargs
            )

            usage = {}

            for chunk in response:
                if chunk.choices and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta
                    if delta.content:
                        yield delta.content

                if hasattr(chunk, 'usage') and chunk.usage:
                    usage = {
                        "prompt_tokens": chunk.usage.prompt_tokens,
                        "completion_tokens": chunk.usage.completion_tokens,
                        "total_tokens": chunk.usage.total_tokens,
                    }

            latency_ms = int((time.time() - start_time) * 1000)

            self.last_stats = StreamStats(
                model=self.model,
                usage=usage,
                latency_ms=latency_ms
            )

        except Exception as e:
            raise HelloAgentsException(f"OpenAI API流式调用失败: {str(e)}")

    def invoke_with_tools(self, messages: List[Dict], tools: List[Dict],
                         tool_choice: Union[str, Dict] = "auto", **kwargs) -> LLMToolResponse:
        """工具调用（Function Calling）"""
        if not self._client:
            self._client = self.create_client()

        start_time = time.time()
        try:
            response = self._client.chat.completions.create(
                model=self.model,
                messages=messages,
                tools=tools,
                tool_choice=tool_choice,
                **kwargs
            )

            latency_ms = int((time.time() - start_time) * 1000)
            message = response.choices[0].message

            tool_calls = []
            if message.tool_calls:
                for tc in message.tool_calls:
                    tool_calls.append(ToolCall(
                        id=tc.id,
                        name=tc.function.name,
                        arguments=tc.function.arguments
                    ))

            usage = {}
            if response.usage:
                usage = {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens
                }

            return LLMToolResponse(
                content=message.content,
                tool_calls=tool_calls,
                model=response.model,
                usage=usage,
                latency_ms=latency_ms
            )

        except Exception as e:
            raise HelloAgentsException(f"OpenAI Function Calling调用失败: {str(e)}")


def create_adapter(
    api_key: str,
    base_url: Optional[str],
    timeout: int,
    model: str
) -> BaseLLMAdapter:
    """根据base_url自动选择适配器

    最小化版本：仅支持OpenAI兼容接口（含Ollama）
    后续可扩展 AnthropicAdapter、GeminiAdapter 等
    """
    return OpenAIAdapter(api_key, base_url, timeout, model)
