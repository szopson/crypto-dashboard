"""
Coinglass v4 macro-context source for crypto-infra equity reports.

For tickers levered to crypto market structure (COIN, MARA, MSTR, RIOT, HOOD),
the single most important exogenous driver is the state of the BTC derivatives
and ETF-flow complex. This module fetches a compact snapshot of that regime so
the equity synthesis can frame the stock against the market it's a proxy for.

This is the Python counterpart of frontend/src/lib/coinglass.ts (which powers
the live CryptoMacroPulse widget). It intentionally fetches a narrower slice —
just what an equity Macro-Context section needs:
- BTC price + 24h move
- BTC open interest (level + 24h delta)
- Funding regime (cross-exchange avg, per-8h)
- BTC ETF flows (24h + cumulative 7d/30d)

Returns {} when COINGLASS_API_KEY is absent or all calls fail, so the generator
degrades gracefully to a non-enriched report.
"""
import asyncio
import os
from datetime import datetime
from typing import Any, Optional

import httpx
from loguru import logger


BASE_URL = "https://open-api-v4.coinglass.com"


class CoinglassSource:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("COINGLASS_API_KEY")
        if not self.api_key:
            logger.warning("COINGLASS_API_KEY not set — Coinglass enrichment will be skipped")
        self.client = httpx.AsyncClient(timeout=20)

    def is_available(self) -> bool:
        return bool(self.api_key)

    async def fetch_context(self, symbol: str = "BTC") -> dict[str, Any]:
        """Fetch a compact BTC derivatives + ETF macro snapshot. {} if unavailable."""
        if not self.is_available():
            return {}

        markets, funding, etf = await asyncio.gather(
            self._safe_get("/api/futures/coins-markets", {}),
            self._safe_get("/api/futures/funding-rate/exchange-list", {"symbol": symbol}),
            self._safe_get("/api/etf/bitcoin/flow-history", {"asset": "BTC"}),
        )

        coin = self._pick_coin(markets, symbol)
        out: dict[str, Any] = {
            "fetched_at": datetime.utcnow().isoformat(),
            "symbol": symbol,
            "price": coin.get("current_price") if coin else None,
            "price_change_24h_pct": coin.get("price_change_percent_24h") if coin else None,
            "open_interest_usd": coin.get("open_interest_usd") if coin else None,
            "oi_change_24h_pct": coin.get("open_interest_change_percent_24h") if coin else None,
            "oi_market_cap_ratio": coin.get("open_interest_market_cap_ratio") if coin else None,
            "long_short_ratio_24h": coin.get("long_short_ratio_24h") if coin else None,
            "funding": self._funding_summary(funding, coin, symbol),
            "etf": self._etf_summary(etf),
        }
        out["signals"] = self._signals(out)
        return out

    async def _safe_get(self, path: str, params: dict[str, Any]) -> Any:
        try:
            resp = await self.client.get(
                BASE_URL + path,
                params=params,
                headers={"CG-API-KEY": self.api_key},
            )
            if resp.status_code != 200:
                logger.debug(f"coinglass {path} status={resp.status_code}: {resp.text[:120]}")
                return None
            j = resp.json()
            # v4 returns code as a string ("0") not a number — accept both.
            if isinstance(j, dict) and j.get("code") is not None and str(j.get("code")) != "0":
                logger.debug(f"coinglass {path} code={j.get('code')}: {j.get('msg')}")
                return None
            return j.get("data") if isinstance(j, dict) else None
        except Exception as e:
            logger.warning(f"coinglass {path} failed: {e}")
            return None

    @staticmethod
    def _pick_coin(markets: Any, symbol: str) -> Optional[dict]:
        if not isinstance(markets, list):
            return None
        return next((m for m in markets if m.get("symbol") == symbol), None)

    def _funding_summary(self, funding: Any, coin: Optional[dict], symbol: str) -> dict[str, Any]:
        """Cross-exchange stablecoin-margin funding avg (per 8h), plus OI-weighted rate."""
        exchanges: list[dict] = []
        if isinstance(funding, list):
            row = next((r for r in funding if r.get("symbol") == symbol), None)
            for e in (row or {}).get("stablecoin_margin_list", [])[:8]:
                rate = e.get("funding_rate")
                if rate is not None:
                    exchanges.append({"exchange": e.get("exchange"), "rate_pct": rate})
        avg = sum(e["rate_pct"] for e in exchanges) / len(exchanges) if exchanges else None
        return {
            "avg_pct_8h": avg,
            "oi_weighted_pct_8h": coin.get("avg_funding_rate_by_oi") if coin else None,
            "exchanges": exchanges,
        }

    def _etf_summary(self, etf: Any) -> dict[str, Any]:
        """BTC ETF net flow: latest day, plus cumulative 7d and 30d."""
        if not isinstance(etf, list) or not etf:
            return {"flow_24h_usd": None, "flow_7d_usd": None, "flow_30d_usd": None}
        rows = sorted(etf, key=lambda d: d.get("timestamp", 0), reverse=True)
        last = rows[0]
        return {
            "flow_24h_usd": last.get("flow_usd"),
            "flow_7d_usd": sum(d.get("flow_usd") or 0 for d in rows[:7]),
            "flow_30d_usd": sum(d.get("flow_usd") or 0 for d in rows[:30]),
            "last_timestamp": last.get("timestamp"),
        }

    def _signals(self, ctx: dict) -> list[str]:
        """Human-readable regime tags. Funding is percent-per-8h (0.01 ≈ 11% APR)."""
        out: list[str] = []
        fund = (ctx.get("funding") or {}).get("avg_pct_8h")
        if fund is not None:
            if fund > 0.03:
                out.append(f"BTC funding hot ({fund:.4f}%/8h) — leveraged longs crowded")
            elif fund < -0.005:
                out.append(f"BTC funding negative ({fund:.4f}%/8h) — shorts paying, contrarian long")
        etf7 = (ctx.get("etf") or {}).get("flow_7d_usd")
        if etf7 is not None:
            if etf7 > 1_000_000_000:
                out.append(f"7d ETF inflow ${etf7/1e6:.0f}M — sustained institutional bid")
            elif etf7 < -500_000_000:
                out.append(f"7d ETF outflow ${etf7/1e6:.0f}M — sustained institutional supply")
        oi = ctx.get("oi_change_24h_pct")
        px = ctx.get("price_change_24h_pct")
        if oi is not None and px is not None:
            if oi > 5 and px < 0:
                out.append("OI rising while price falls — leveraged shorts building, squeeze risk")
            elif oi < -3 and px > 0:
                out.append("OI falling while price rises — short squeeze unwinding")
        return out

    async def aclose(self):
        await self.client.aclose()


_singleton: Optional[CoinglassSource] = None


def get_coinglass_source(api_key: Optional[str] = None) -> CoinglassSource:
    global _singleton
    if _singleton is None:
        _singleton = CoinglassSource(api_key=api_key)
    return _singleton
