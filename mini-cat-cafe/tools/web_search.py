"""Web search tool using DuckDuckGo (no API key required)."""
from typing import Any

from .base_tool import BaseTool


class WebSearchTool(BaseTool):
    @property
    def name(self) -> str:
        return "web_search"

    @property
    def description(self) -> str:
        return "Search the web for information on a topic. Returns a list of results with titles, URLs, and snippets."

    @property
    def parameters_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "The search query"},
                "max_results": {
                    "type": "integer",
                    "description": "Maximum number of results to return (default: 5)",
                    "default": 5,
                },
            },
            "required": ["query"],
        }

    async def execute(self, query: str, max_results: int = 5) -> str:
        try:
            from duckduckgo_search import DDGS
        except ImportError:
            return "Error: duckduckgo_search not installed. Run: pip install duckduckgo-search"

        results = []
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=max_results):
                results.append(
                    f"**{r['title']}**\nURL: {r['href']}\n{r['body']}\n"
                )

        if not results:
            return f"No results found for: {query}"

        return "\n---\n".join(results)
