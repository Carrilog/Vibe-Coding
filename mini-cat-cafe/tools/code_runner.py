"""Python code execution tool (sandboxed via subprocess)."""
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

from .base_tool import BaseTool


class CodeRunnerTool(BaseTool):
    @property
    def name(self) -> str:
        return "run_python"

    @property
    def description(self) -> str:
        return "Execute Python code and return stdout/stderr. Use for data analysis, backtesting, calculations."

    @property
    def parameters_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "code": {"type": "string", "description": "Python code to execute"},
                "timeout": {
                    "type": "integer",
                    "description": "Timeout in seconds (default: 30)",
                    "default": 30,
                },
            },
            "required": ["code"],
        }

    async def execute(self, code: str, timeout: int = 30) -> str:
        with tempfile.NamedTemporaryFile(suffix=".py", mode="w", delete=False) as f:
            f.write(code)
            tmp_path = f.name

        try:
            result = subprocess.run(
                [sys.executable, tmp_path],
                capture_output=True,
                text=True,
                timeout=timeout,
            )
            output = result.stdout
            if result.stderr:
                output += f"\n[stderr]\n{result.stderr}"
            return output or "(no output)"
        except subprocess.TimeoutExpired:
            return f"Error: execution timed out after {timeout}s"
        finally:
            Path(tmp_path).unlink(missing_ok=True)
