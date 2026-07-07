"""
Equity Report Generator — orchestrator.

Steps:
1. Resolve sector for ticker
2. Fetch all data (yfinance for now; pluggable for premium sources later)
3. AI synthesis (Claude → structured JSON)
4. Render MDX output
5. (Future) Also render HTML/PDF using existing pipeline

Owner-only: designed to be run via CLI by site operator, not from public API.
"""
import asyncio
import json
import time
from pathlib import Path
from typing import Any, Optional

from loguru import logger

from .sectors import SECTORS, CRYPTO_ENRICHED_SECTORS, get_sector_for_ticker
from .yfinance_source import get_yfinance_source, EquityNotFoundError
from .finnhub_source import get_finnhub_source
from .coinglass_source import get_coinglass_source
from .ai_synthesis import get_equity_synthesis
from .mdx_renderer import get_mdx_renderer


class EquityReportGenerator:
    """Orchestrate fetch → synthesize → render for one ticker."""

    def __init__(
        self,
        output_root: str | Path = "content/reports",
        anthropic_api_key: Optional[str] = None,
        model: str = "claude-sonnet-4-5",
    ):
        self.output_root = Path(output_root)
        self.source = get_yfinance_source()
        self.finnhub = get_finnhub_source()
        self.coinglass = get_coinglass_source()
        self.synthesizer = get_equity_synthesis(api_key=anthropic_api_key, model=model)
        self.renderer = get_mdx_renderer(output_root)

    async def generate(
        self,
        ticker: str,
        sector_slug: Optional[str] = None,
        write_raw: bool = False,
    ) -> dict[str, Any]:
        """Generate one report. Returns metadata about the result."""
        ticker = ticker.upper()
        start = time.time()

        # Resolve sector
        if sector_slug:
            sector = SECTORS.get(sector_slug)
            if not sector:
                raise ValueError(f"Unknown sector slug: {sector_slug}")
        else:
            sector = get_sector_for_ticker(ticker)
            if not sector:
                raise ValueError(
                    f"Ticker {ticker} not found in any sector. "
                    f"Pass --sector explicitly or add to engine/report/equity/sectors.py"
                )

        logger.info(f"Generating equity report for {ticker} (sector: {sector['name']})")

        # Phase 1: fetch (yfinance + finnhub in parallel)
        try:
            yfin_task = asyncio.create_task(self.source.fetch_all(ticker))
            fh_task = asyncio.create_task(self.finnhub.fetch_all(ticker))
            data = await yfin_task
            finnhub_data = await fh_task
        except EquityNotFoundError:
            raise
        except Exception as e:
            logger.error(f"Data fetch failed for {ticker}: {e}")
            raise

        # Merge finnhub data under a dedicated key so prompt + renderer can use it
        data["finnhub"] = finnhub_data
        if finnhub_data:
            logger.info(
                f"Finnhub: {len(finnhub_data.get('news', []))} news, "
                f"{len(finnhub_data.get('earnings_surprises', []))} earnings, "
                f"{len(finnhub_data.get('insider_transactions', []))} insider tx, "
                f"beat rate={finnhub_data.get('computed', {}).get('beat_rate')}"
            )

        # Crypto-infra names: enrich with live BTC derivatives + ETF macro context.
        if sector["slug"] in CRYPTO_ENRICHED_SECTORS and self.coinglass.is_available():
            try:
                crypto_ctx = await self.coinglass.fetch_context()
                if crypto_ctx:
                    data["crypto_market_context"] = crypto_ctx
                    logger.info(
                        f"Coinglass: BTC ${crypto_ctx.get('price')}, "
                        f"OI 24h {crypto_ctx.get('oi_change_24h_pct')}%, "
                        f"funding {(crypto_ctx.get('funding') or {}).get('avg_pct_8h')}, "
                        f"{len(crypto_ctx.get('signals', []))} signals"
                    )
            except Exception as e:
                logger.warning(f"Coinglass enrichment failed for {ticker} (non-fatal): {e}")

        # Optionally dump raw data for debugging
        if write_raw:
            raw_dir = self.output_root / sector["slug"] / "_raw"
            raw_dir.mkdir(parents=True, exist_ok=True)
            raw_path = raw_dir / f"{ticker.lower()}.json"
            raw_path.write_text(json.dumps(data, default=str, indent=2))
            logger.info(f"Raw data dumped to {raw_path}")

        # Phase 2: synthesize
        synthesis = await self.synthesizer.generate(ticker, sector, data)

        # Phase 3: render
        out_path = self.renderer.render(ticker, sector, data, synthesis)

        elapsed = time.time() - start
        logger.info(f"Report complete for {ticker} in {elapsed:.1f}s")

        return {
            "ticker": ticker,
            "sector": sector["slug"],
            "rating": synthesis.get("cover", {}).get("rating"),
            "target_price": synthesis.get("cover", {}).get("target_price"),
            "output_path": str(out_path),
            "elapsed_seconds": round(elapsed, 1),
        }


_singleton: Optional[EquityReportGenerator] = None


def get_equity_generator(
    output_root: str | Path = "content/reports",
    anthropic_api_key: Optional[str] = None,
    model: str = "claude-sonnet-4-5",
) -> EquityReportGenerator:
    global _singleton
    if _singleton is None:
        _singleton = EquityReportGenerator(
            output_root=output_root,
            anthropic_api_key=anthropic_api_key,
            model=model,
        )
    return _singleton
