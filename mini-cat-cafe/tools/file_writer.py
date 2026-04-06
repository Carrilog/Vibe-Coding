from __future__ import annotations
"""File writer tool — saves content to disk."""
import os
from pathlib import Path
from typing import Any

from .base_tool import BaseTool

OUTPUT_DIR = Path("output")


class FileWriterTool(BaseTool):
    def __init__(self, output_dir: str | Path = OUTPUT_DIR):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    @property
    def name(self) -> str:
        return "write_file"

    @property
    def description(self) -> str:
        return "Write content to a file. Use this to save research notes, documents, or code."

    @property
    def parameters_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "filename": {
                    "type": "string",
                    "description": "Filename (e.g. 'quant_notes.md', 'strategy.py')",
                },
                "content": {
                    "type": "string",
                    "description": "The content to write",
                },
            },
            "required": ["filename", "content"],
        }

    async def execute(self, filename: str, content: str) -> str:
        # Prevent path traversal
        safe_name = Path(filename).name
        path = self.output_dir / safe_name
        path.write_text(content, encoding="utf-8")
        return f"Saved to {path} ({len(content)} chars)"
