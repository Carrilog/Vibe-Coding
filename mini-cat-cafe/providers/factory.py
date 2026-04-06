"""Provider factory — create providers by name from config."""

from core.llm_interface import BaseLLMProvider


def create_provider(provider_name: str, **kwargs) -> BaseLLMProvider:
    """
    Factory function. provider_name examples:
      "anthropic", "openai", "deepseek", "qwen", "moonshot"
    """
    name = provider_name.lower()

    if name == "anthropic":
        from .anthropic_provider import AnthropicProvider

        return AnthropicProvider(**kwargs)

    elif name == "openai":
        from .openai_provider import OpenAICompatibleProvider

        return OpenAICompatibleProvider(
            model=kwargs.get("model", "gpt-4o"),
            env_key="OPENAI_API_KEY",
            **{k: v for k, v in kwargs.items() if k != "model"},
        )

    elif name == "deepseek":
        from .deepseek_provider import DeepSeekProvider

        return DeepSeekProvider(
            model=kwargs.get("model", "deepseek-chat"),
            **{k: v for k, v in kwargs.items() if k != "model"},
        )

    elif name == "qwen":
        from .openai_provider import OpenAICompatibleProvider

        return OpenAICompatibleProvider(
            model=kwargs.get("model", "qwen-plus"),
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
            env_key="DASHSCOPE_API_KEY",
        )

    elif name == "moonshot":
        from .openai_provider import OpenAICompatibleProvider

        return OpenAICompatibleProvider(
            model=kwargs.get("model", "moonshot-v1-8k"),
            base_url="https://api.moonshot.cn/v1",
            env_key="MOONSHOT_API_KEY",
        )

    else:
        raise ValueError(f"Unknown provider: {provider_name!r}")
