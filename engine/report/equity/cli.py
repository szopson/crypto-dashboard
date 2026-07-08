"""
CLI runner for equity report generation.

Usage:
    # Single ticker
    python -m engine.report.equity.cli --ticker NVDA

    # Specific sector for ticker (if not in default sectors map)
    python -m engine.report.equity.cli --ticker NVDA --sector semiconductors

    # All tickers in seed list (60 reports)
    python -m engine.report.equity.cli --all

    # All tickers in a single sector
    python -m engine.report.equity.cli --sector quantum

    # Different output dir or model
    python -m engine.report.equity.cli --ticker NVDA --out content/reports --model claude-opus-4-7

    # Dump raw fetched data for debugging
    python -m engine.report.equity.cli --ticker NVDA --write-raw
"""
import argparse
import asyncio
import os
import sys
from pathlib import Path

from loguru import logger

# Allow running both as `python -m engine.report.equity.cli` and `python cli.py`
if __package__ is None or __package__ == "":
    sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
    from engine.report.equity.sectors import SECTORS, all_tickers
    from engine.report.equity.generator import get_equity_generator
    from engine.report.equity.sector_brief import get_sector_brief_generator
else:
    from .sectors import SECTORS, all_tickers
    from .generator import get_equity_generator
    from .sector_brief import get_sector_brief_generator


async def run_one(generator, ticker: str, sector_slug: str | None, write_raw: bool):
    try:
        result = await generator.generate(ticker, sector_slug=sector_slug, write_raw=write_raw)
        logger.info(
            f"✅ {result['ticker']} → {result['output_path']} "
            f"(rating={result['rating']}, target=${result['target_price']}, {result['elapsed_seconds']}s)"
        )
        return True
    except Exception as e:
        logger.error(f"❌ {ticker} failed: {e}")
        return False


async def main_async(args):
    output_root = Path(args.out).resolve()
    api_key = args.api_key or os.getenv("ANTHROPIC_API_KEY")
    if not api_key and args.engine == "api":
        logger.error("ANTHROPIC_API_KEY not set (use --api-key, env var, or --engine claude-cli)")
        return 1

    # Brief-only mode: regenerate sector brief(s) without touching ticker reports
    if args.brief:
        targets = [args.brief] if args.brief != "all" else list(SECTORS.keys())
        brief_gen = get_sector_brief_generator(
            reports_root=output_root,
            briefs_root=Path(args.briefs_out) if args.briefs_out else output_root.parent / "sector_briefs",
            anthropic_api_key=api_key,
            model=args.model,
        )
        ok = 0
        for slug in targets:
            try:
                p = await brief_gen.generate(slug)
                logger.info(f"✅ brief {slug} → {p}")
                ok += 1
            except Exception as e:
                logger.error(f"❌ brief {slug} failed: {e}")
        return 0 if ok == len(targets) else 1

    generator = get_equity_generator(output_root=output_root, anthropic_api_key=api_key, model=args.model, engine=args.engine)

    # Determine workload
    workload: list[tuple[str, str]] = []
    if args.all:
        workload = all_tickers()
    elif args.sector and not args.ticker:
        sec = SECTORS.get(args.sector)
        if not sec:
            logger.error(f"Unknown sector: {args.sector}")
            return 1
        workload = [(t, sec["slug"]) for t in sec["tickers"]]
    elif args.ticker:
        workload = [(args.ticker.upper(), args.sector)]
    else:
        logger.error("Provide --ticker, --sector, --all, or --brief")
        return 1

    # Resumability for long batches: skip tickers whose MDX already exists.
    if args.skip_existing:
        before = len(workload)
        workload = [
            (tk, sec_slug)
            for tk, sec_slug in workload
            if not (output_root / (sec_slug or "") / f"{tk.lower()}.mdx").exists()
        ]
        logger.info(f"--skip-existing: {before - len(workload)} already present, skipped")

    logger.info(f"Workload: {len(workload)} report(s)")

    successes = 0
    for tk, sec_slug in workload:
        ok = await run_one(generator, tk, sec_slug, args.write_raw)
        if ok:
            successes += 1

    logger.info(f"Done: {successes}/{len(workload)} successful")
    return 0 if successes == len(workload) else 1


def main():
    parser = argparse.ArgumentParser(description="Generate equity research MDX reports")
    parser.add_argument("--ticker", help="Single ticker, e.g. NVDA")
    parser.add_argument("--sector", help="Sector slug (e.g. semiconductors). With --ticker = override sector; without --ticker = generate all in sector")
    parser.add_argument("--all", action="store_true", help="Generate all 60 reports from the seed list")
    parser.add_argument("--out", default="content/reports", help="Output root (default: content/reports)")
    parser.add_argument("--model", default="claude-sonnet-4-5", help="Anthropic model id")
    parser.add_argument("--api-key", help="Anthropic API key (or set ANTHROPIC_API_KEY)")
    parser.add_argument("--write-raw", action="store_true", help="Also dump raw fetched data as JSON for debugging")
    parser.add_argument("--skip-existing", action="store_true", help="Skip tickers whose MDX already exists (resume a batch)")
    parser.add_argument("--engine", default="api", choices=["api", "claude-cli"], help="api = Anthropic API (credits); claude-cli = headless `claude -p` on the local subscription login")
    parser.add_argument("--brief", help="Generate sector brief instead of ticker reports. Pass a sector slug or 'all'.")
    parser.add_argument("--briefs-out", help="Override sector briefs output directory")
    args = parser.parse_args()

    return asyncio.run(main_async(args))


if __name__ == "__main__":
    raise SystemExit(main())
