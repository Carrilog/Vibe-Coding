#!/usr/bin/env python3
"""
mini-cat-cafe CLI

Usage:
  python cli/main.py --task "research momentum trading strategies"
  python cli/main.py --task "write a moving average crossover backtest" --provider anthropic
  python cli/main.py --task "..." --provider deepseek --model deepseek-chat
  python cli/main.py --task "..." --provider openai --model gpt-4o
"""
import argparse
import asyncio
import sys
from pathlib import Path

# Allow running from project root
sys.path.insert(0, str(Path(__file__).parent.parent))

from providers.factory import create_provider
from orchestrator.orchestrator import Orchestrator


def parse_args():
    parser = argparse.ArgumentParser(description="mini-cat-cafe: multi-agent quant learning assistant")
    parser.add_argument("--task", required=True, help="Task to perform")
    parser.add_argument(
        "--provider",
        default="anthropic",
        choices=["anthropic", "openai", "deepseek", "qwen", "moonshot"],
        help="LLM provider (default: anthropic)",
    )
    parser.add_argument("--model", default=None, help="Model name (uses provider default if omitted)")
    parser.add_argument("--output-dir", default="output", help="Directory for output files")
    return parser.parse_args()


async def main():
    args = parse_args()

    kwargs = {}
    if args.model:
        kwargs["model"] = args.model

    print(f"[CLI] Provider: {args.provider} | Model: {args.model or 'default'}")
    llm = create_provider(args.provider, **kwargs)

    orchestrator = Orchestrator(llm, output_dir=args.output_dir)
    results = await orchestrator.run(args.task)

    print("\n" + "=" * 60)
    for agent_name, result in results.items():
        print(f"\n[{agent_name.upper()} RESULT]\n{result}")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
