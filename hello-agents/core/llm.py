"""HelloAgents统一LLM接口 - 最小化版本，支持Ollama"""

import os
from typing import Optional, Iterator, List, Dict, Union

from .exceptions import HelloAgentsException
from .llm_response import LLMResponse, StreamStats, LLMToolResponse
from .llm_adapters import create_adapter, BaseLLMAdapter


class HelloAgentsLLM:
    """HelloAgents统一LLM客户端

    最小化版本：
    - 统一配置：LLM_MODEL_ID、LLM_API_KEY、LLM_BASE_URL、LLM_TIMEOUT
    - 自动适配：根据base_url自动选择适配器
    - 默认指向Ollama本地服务
    """

    def __init__(
        self,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        timeout: Optional[int] = None,
        **kwargs
    ):
        self.model = model or os.getenv("LLM_MODEL_ID")
        self.api_key = api_key or os.getenv("LLM_API_KEY", "ollama")
        self.base_url = base_url or os.getenv("LLM_BASE_URL", "http://localhost:11434/v1")
        self.timeout = timeout or int(os.getenv("LLM_TIMEOUT", "60"))

        self.temperature = temperature
        self.max_tokens = max_tokens
        self.kwargs = kwargs

        if not self.model:
            raise HelloAgentsException("必须提供模型名称（model参数或LLM_MODEL_ID环境变量）")

        self._adapter: BaseLLMAdapter = create_adapter(
            api_key=self.api_key,
            base_url=self.base_url,
            timeout=self.timeout,
            model=self.model
        )

        self.last_call_stats: Optional[StreamStats] = None

    def think(self, messages: List[Dict[str, str]], temperature: Optional[float] = None) -> Iterator[str]:
        """调用大语言模型进行思考，返回流式响应"""
        print(f"🧠 正在调用 {self.model} 模型...")

        kwargs = {
            "temperature": temperature if temperature is not None else self.temperature,
        }
        if self.max_tokens:
            kwargs["max_tokens"] = self.max_tokens

        try:
            print("✅ 大语言模型响应成功:")
            for chunk in self._adapter.stream_invoke(messages, **kwargs):
                print(chunk, end="", flush=True)
                yield chunk
            print()

            if hasattr(self._adapter, 'last_stats'):
                self.last_call_stats = self._adapter.last_stats

        except Exception as e:
            print(f"❌ 调用LLM API时发生错误: {e}")
            raise

    def invoke(self, messages: List[Dict[str, str]], **kwargs) -> LLMResponse:
        """非流式调用LLM，返回完整响应对象"""
        call_kwargs = {
            "temperature": kwargs.pop("temperature", self.temperature),
        }
        if self.max_tokens:
            call_kwargs["max_tokens"] = kwargs.pop("max_tokens", self.max_tokens)
        call_kwargs.update(kwargs)

        return self._adapter.invoke(messages, **call_kwargs)

    def stream_invoke(self, messages: List[Dict[str, str]], **kwargs) -> Iterator[str]:
        """流式调用LLM"""
        temperature = kwargs.pop("temperature", None)

        call_kwargs = {}
        if self.max_tokens:
            call_kwargs["max_tokens"] = kwargs.pop("max_tokens", self.max_tokens)
        call_kwargs.update(kwargs)

        for chunk in self._adapter.stream_invoke(messages, temperature=temperature, **call_kwargs):
            yield chunk

        if hasattr(self._adapter, 'last_stats'):
            self.last_call_stats = self._adapter.last_stats

    def invoke_with_tools(
        self,
        messages: List[Dict],
        tools: List[Dict],
        tool_choice: Union[str, Dict] = "auto",
        **kwargs
    ) -> LLMToolResponse:
        """调用LLM并支持工具调用（Function Calling）"""
        call_kwargs = {
            "temperature": kwargs.pop("temperature", self.temperature),
            "tool_choice": tool_choice,
        }
        if self.max_tokens:
            call_kwargs["max_tokens"] = kwargs.pop("max_tokens", self.max_tokens)
        call_kwargs.update(kwargs)

        return self._adapter.invoke_with_tools(messages, tools, **call_kwargs)
