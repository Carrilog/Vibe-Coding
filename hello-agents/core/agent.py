"""Agent基类 - 最小化版本"""

import json
from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
from .message import Message
from .llm import HelloAgentsLLM
from .config import Config


class Agent(ABC):
    """Agent基类

    最小化版本，保留核心能力：
    - 历史管理（简单列表）
    - 工具Schema构建与执行
    - 消息构建

    后续可扩展：HistoryManager、TraceLogger、SkillLoader、SessionStore 等
    """

    def __init__(
        self,
        name: str,
        llm: HelloAgentsLLM,
        system_prompt: Optional[str] = None,
        config: Optional[Config] = None,
        tool_registry=None
    ):
        self.name = name
        self.llm = llm
        self.system_prompt = system_prompt
        self.config = config or Config()
        self.tool_registry = tool_registry
        self._history: List[Message] = []

    @abstractmethod
    def run(self, input_text: str, **kwargs) -> str:
        """运行Agent（同步版本）"""
        pass

    def add_message(self, message: Message):
        """添加消息到历史记录"""
        self._history.append(message)

    def clear_history(self):
        """清空历史记录"""
        self._history.clear()

    def get_history(self) -> List[Message]:
        """获取历史记录"""
        return self._history.copy()

    def _build_messages(self, input_text: str) -> List[Dict[str, str]]:
        """构建发送给LLM的消息列表"""
        messages = []

        if self.system_prompt:
            messages.append({"role": "system", "content": self.system_prompt})

        for msg in self._history:
            messages.append({"role": msg.role, "content": msg.content})

        messages.append({"role": "user", "content": input_text})
        return messages

    # ==================== 工具调用通用能力 ====================

    def _build_tool_schemas(self) -> List[Dict[str, Any]]:
        """构建工具JSON Schema"""
        if not self.tool_registry:
            return []

        schemas: List[Dict[str, Any]] = []

        for tool in self.tool_registry.get_all_tools():
            properties: Dict[str, Any] = {}
            required: List[str] = []

            try:
                parameters = tool.get_parameters()
            except Exception:
                parameters = []

            for param in parameters:
                properties[param.name] = {
                    "type": self._map_parameter_type(param.type),
                    "description": param.description or ""
                }
                if param.default is not None:
                    properties[param.name]["default"] = param.default
                if getattr(param, "required", True):
                    required.append(param.name)

            schema: Dict[str, Any] = {
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description or "",
                    "parameters": {
                        "type": "object",
                        "properties": properties
                    }
                }
            }
            if required:
                schema["function"]["parameters"]["required"] = required
            schemas.append(schema)

        function_map = getattr(self.tool_registry, "_functions", {})
        for name, info in function_map.items():
            schemas.append({
                "type": "function",
                "function": {
                    "name": name,
                    "description": info.get("description", ""),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "input": {
                                "type": "string",
                                "description": "输入文本"
                            }
                        },
                        "required": ["input"]
                    }
                }
            })

        return schemas

    @staticmethod
    def _map_parameter_type(param_type: str) -> str:
        """将工具参数类型映射为JSON Schema允许的类型"""
        normalized = (param_type or "").lower()
        if normalized in {"string", "number", "integer", "boolean", "array", "object"}:
            return normalized
        return "string"

    def _convert_parameter_types(self, tool_name: str, param_dict: Dict[str, Any]) -> Dict[str, Any]:
        """根据工具定义转换参数类型"""
        if not self.tool_registry:
            return param_dict

        tool = self.tool_registry.get_tool(tool_name)
        if not tool:
            return param_dict

        try:
            tool_params = tool.get_parameters()
        except Exception:
            return param_dict

        type_mapping = {param.name: param.type for param in tool_params}
        converted: Dict[str, Any] = {}

        for key, value in param_dict.items():
            param_type = type_mapping.get(key)
            if not param_type:
                converted[key] = value
                continue

            try:
                normalized = param_type.lower()
                if normalized in {"number", "float"}:
                    converted[key] = float(value)
                elif normalized in {"integer", "int"}:
                    converted[key] = int(value)
                elif normalized in {"boolean", "bool"}:
                    if isinstance(value, bool):
                        converted[key] = value
                    elif isinstance(value, str):
                        converted[key] = value.lower() in {"true", "1", "yes"}
                    else:
                        converted[key] = bool(value)
                else:
                    converted[key] = value
            except (TypeError, ValueError):
                converted[key] = value

        return converted

    def _execute_tool_call(self, tool_name: str, arguments: Dict[str, Any]) -> str:
        """执行工具调用并返回字符串结果"""
        if not self.tool_registry:
            return "❌ 错误：未配置工具注册表"

        tool = self.tool_registry.get_tool(tool_name)
        if tool:
            try:
                typed_arguments = self._convert_parameter_types(tool_name, arguments)
                response = tool.run(typed_arguments)
                return str(response)
            except Exception as exc:
                return f"❌ 工具调用失败：{exc}"

        func = self.tool_registry.get_function(tool_name)
        if func:
            try:
                input_text = arguments.get("input", "")
                result = func(input_text)
                return str(result)
            except Exception as exc:
                return f"❌ 工具调用失败：{exc}"

        return f"❌ 错误：未找到工具 '{tool_name}'"

    def __str__(self) -> str:
        return f"Agent(name={self.name}, model={self.llm.model})"

    def __repr__(self) -> str:
        return self.__str__()
