"""Coder agent — writes and runs Python code for quant analysis."""
from core.llm_interface import BaseLLMProvider
from tools.code_runner import CodeRunnerTool
from tools.file_writer import FileWriterTool
from .tool_using_agent import ToolUsingAgent

SYSTEM_PROMPT = """You are a quantitative developer. Your job is to:
1. Write clean, well-commented Python code for financial analysis
2. Run the code to verify it works
3. Save the final code to a .py file

Use libraries like pandas, numpy, yfinance, and matplotlib when appropriate.
Always test your code before saving it."""


class CoderAgent(ToolUsingAgent):
    def __init__(self, llm: BaseLLMProvider, output_dir: str = "output"):
        super().__init__(
            llm=llm,
            name="Coder",
            tools=[CodeRunnerTool(), FileWriterTool(output_dir)],
            system_prompt=SYSTEM_PROMPT,
        )
