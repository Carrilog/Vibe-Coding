"""Orchestrator — routes tasks to the right agent and coordinates multi-agent workflows."""
from core.llm_interface import BaseLLMProvider
from agents.researcher import ResearcherAgent
from agents.coder import CoderAgent


class Orchestrator:
    """
    Coordinates multiple agents to complete complex tasks.

    Routing logic:
    - Tasks containing "research", "search", "find", "learn" → ResearcherAgent
    - Tasks containing "code", "implement", "write", "calculate", "backtest" → CoderAgent
    - Tasks containing "both" or ambiguous → runs Researcher first, then Coder
    """

    def __init__(self, llm: BaseLLMProvider, output_dir: str = "output"):
        self.researcher = ResearcherAgent(llm, output_dir)
        self.coder = CoderAgent(llm, output_dir)

    async def run(self, task: str) -> dict[str, str]:
        """Run the task and return results keyed by agent name."""
        task_lower = task.lower()
        results = {}

        needs_research = any(
            kw in task_lower for kw in ["research", "search", "find", "learn", "explain", "what is"]
        )
        needs_code = any(
            kw in task_lower for kw in ["code", "implement", "write", "calculate", "backtest", "strategy", "compute"]
        )

        # Default: do both if neither keyword matches
        if not needs_research and not needs_code:
            needs_research = True
            needs_code = True

        if needs_research:
            print(f"[Orchestrator] → ResearcherAgent: {task[:60]}...")
            results["research"] = await self.researcher.run(task)

        if needs_code:
            code_task = task
            if needs_research and results.get("research"):
                code_task = f"{task}\n\nContext from research:\n{results['research']}"
            print(f"[Orchestrator] → CoderAgent: {task[:60]}...")
            results["code"] = await self.coder.run(code_task)

        return results
