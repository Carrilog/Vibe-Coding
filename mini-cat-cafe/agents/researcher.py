"""Researcher agent — searches the web and saves findings to files."""
from core.llm_interface import BaseLLMProvider
from tools.web_search import WebSearchTool
from tools.file_writer import FileWriterTool
from .tool_using_agent import ToolUsingAgent

SYSTEM_PROMPT = """You are a quantitative finance researcher. Your job is to:
1. Search the web for information on the given topic
2. Synthesize findings into clear, structured notes
3. Save the notes to a markdown file using write_file

Always cite sources (URLs) in your notes. Focus on practical, actionable information
relevant to quantitative trading and investment strategies."""


class ResearcherAgent(ToolUsingAgent):
    def __init__(self, llm: BaseLLMProvider, output_dir: str = "output"):
        super().__init__(
            llm=llm,
            name="Researcher",
            tools=[WebSearchTool(), FileWriterTool(output_dir)],
            system_prompt=SYSTEM_PROMPT,
        )
