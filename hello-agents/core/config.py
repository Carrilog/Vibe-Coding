"""配置管理"""

import os
from typing import Optional, Dict, Any
from pydantic import BaseModel

class Config(BaseModel):
    """HelloAgents配置类（最小化版本）"""

    # LLM配置
    default_model: str = "qwen2.5:7b"
    default_provider: str = "ollama"
    temperature: float = 0.7
    max_tokens: Optional[int] = None

    # 系统配置
    debug: bool = False
    log_level: str = "INFO"

    # 历史管理配置
    max_history_length: int = 100

    # 上下文工程配置
    context_window: int = 128000
    compression_threshold: float = 0.8
    min_retain_rounds: int = 10
    enable_smart_compression: bool = False

    @classmethod
    def from_env(cls) -> "Config":
        """从环境变量创建配置"""
        return cls(
            debug=os.getenv("DEBUG", "false").lower() == "true",
            log_level=os.getenv("LOG_LEVEL", "INFO"),
            temperature=float(os.getenv("TEMPERATURE", "0.7")),
            max_tokens=int(os.getenv("MAX_TOKENS")) if os.getenv("MAX_TOKENS") else None,
        )

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return self.dict()
