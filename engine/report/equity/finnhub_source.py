"""
Finnhub data source for equity reports.

Premium-tier endpoints we use (validated against the connected API key):
- /company-news — extensive news (~30-90 day window vs yfinance's ~7-day)
- /stock/earnings — historical EPS surprises (actual vs estimate, surprise %)
- /stock/recommendation — analyst rating breakdowns over time
- /stock/insider-transactions — granular insider activity with SEC filing IDs,
  transaction codes (S=sell, P=purchase, A=award), and transaction prices
- /stock/upgrade-downgrade — analyst action timeline (rating changes)
- /company-profile2 — country, exchange, IPO date, share-class info
- /stock/social-sentiment — Reddit/Twitter mention volume + sentiment (when in plan)

Endpoints we know are NOT in the current plan:
- /stock/price-target (returns "You don't have access to this resource")
"""
import asyncio
import os
from datetime import date, datetime, timedelta
from typing import Any, Optional

import httpx
from loguru import logger


BASE_URL = "https://finnhub.io/api/v1"


class FinnhubSource:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("FINHUB") or os.getenv("FINNHUB_API_KEY")
        if not self.api_key:
            logger.warning("FINHUB / FINNHUB_API_KEY not set — Finnhub source will be skipped")
        self.client = httpx.AsyncClient(timeout=20)

    def is_available(self) -> bool:
        return bool(self.api_key)

    async def fetch_all(self, ticker: str, news_window_days: int = 60) -> dict[str, Any]:
        """Fetch all relevant Finnhub data for a ticker. Returns empty dict if no API key."""
        if not self.is_available():
            return {}
        ticker = ticker.upper()
        from_date = (date.today() - timedelta(days=news_window_days)).isoformat()
        to_date = date.today().isoformat()

        # Fan out in parallel; individual failures yield None
        results = await asyncio.gather(
            self._safe_get("/company-profile2", {"symbol": ticker}),
            self._safe_get("/company-news", {"symbol": ticker, "from": from_date, "to": to_date}),
            self._safe_get("/stock/earnings", {"symbol": ticker, "limit": 8}),
            self._safe_get("/stock/recommendation", {"symbol": ticker}),
            self._safe_get("/stock/insider-transactions", {"symbol": ticker}),
            self._safe_get("/stock/upgrade-downgrade", {"symbol": ticker}),
            self._safe_get("/stock/social-sentiment", {"symbol": ticker, "from": from_date}),
            return_exceptions=False,
        )

        profile, news_raw, earnings, recommendations, insider_raw, upgrades, social = results

        out: dict[str, Any] = {
            "fetched_at": datetime.utcnow().isoformat(),
            "profile": profile if isinstance(profile, dict) else {},
            "news": self._compact_news(news_raw, limit=20),
            "earnings_surprises": self._compact_earnings(earnings),
            "recommendations": self._compact_recommendations(recommendations),
            "insider_transactions": self._compact_insider(insider_raw),
            "rating_changes": self._compact_upgrades(upgrades),
            "social_sentiment": social if isinstance(social, dict) else {},
        }
        out["computed"] = self._compute_derived(out)
        return out

    async def _safe_get(self, path: str, params: dict[str, Any]) -> Any:
        try:
            params = {**params, "token": self.api_key}
            resp = await self.client.get(BASE_URL + path, params=params)
            if resp.status_code != 200:
                logger.debug(f"finnhub {path} status={resp.status_code}: {resp.text[:120]}")
                return None
            data = resp.json()
            if isinstance(data, dict) and data.get("error"):
                logger.debug(f"finnhub {path} error: {data['error']}")
                return None
            return data
        except Exception as e:
            logger.warning(f"finnhub {path} failed: {e}")
            return None

    # ---------- Compactors (trim payloads, normalize shapes) ----------

    def _compact_news(self, items: Any, limit: int = 20) -> list[dict[str, Any]]:
        if not isinstance(items, list):
            return []
        out = []
        for n in items[:limit]:
            ts = n.get("datetime")
            out.append({
                "headline": n.get("headline"),
                "summary": (n.get("summary") or "")[:400],
                "source": n.get("source"),
                "url": n.get("url"),
                "date": datetime.utcfromtimestamp(ts).isoformat() if ts else None,
                "category": n.get("category"),
                "related": n.get("related"),
            })
        return out

    def _compact_earnings(self, items: Any) -> list[dict[str, Any]]:
        if not isinstance(items, list):
            return []
        return [
            {
                "period": e.get("period"),
                "quarter": e.get("quarter"),
                "year": e.get("year"),
                "actual_eps": e.get("actual"),
                "estimate_eps": e.get("estimate"),
                "surprise": e.get("surprise"),
                "surprise_pct": e.get("surprisePercent"),
            }
            for e in items[:8]
        ]

    def _compact_recommendations(self, items: Any) -> list[dict[str, Any]]:
        if not isinstance(items, list):
            return []
        return [
            {
                "period": r.get("period"),
                "strong_buy": r.get("strongBuy"),
                "buy": r.get("buy"),
                "hold": r.get("hold"),
                "sell": r.get("sell"),
                "strong_sell": r.get("strongSell"),
            }
            for r in items[:6]
        ]

    def _compact_insider(self, raw: Any) -> list[dict[str, Any]]:
        if not isinstance(raw, dict):
            return []
        items = raw.get("data") or []
        out = []
        for tx in items[:25]:
            code = tx.get("transactionCode")
            out.append({
                "name": tx.get("name"),
                "filing_date": tx.get("filingDate"),
                "transaction_date": tx.get("transactionDate"),
                "code": code,
                "code_meaning": self._interpret_tx_code(code),
                "share_delta": tx.get("change"),
                "share_balance": tx.get("share"),
                "price": tx.get("transactionPrice"),
                "value": (tx.get("change") or 0) * (tx.get("transactionPrice") or 0),
            })
        return out

    @staticmethod
    def _interpret_tx_code(code: Optional[str]) -> Optional[str]:
        """SEC Form 4 transaction codes. Source: SEC reporting instructions."""
        return {
            "P": "Open-market purchase",
            "S": "Open-market sale",
            "A": "Grant/award (compensation)",
            "M": "Option exercise",
            "F": "Tax withholding",
            "D": "Disposition to issuer",
            "G": "Gift",
            "J": "Other",
            "K": "Equity swap",
            "X": "Option exercise",
            "C": "Conversion of derivative",
        }.get(code or "")

    def _compact_upgrades(self, items: Any) -> list[dict[str, Any]]:
        if not isinstance(items, list):
            return []
        return [
            {
                "date": u.get("gradeTime"),
                "firm": u.get("company"),
                "from_grade": u.get("fromGrade"),
                "to_grade": u.get("toGrade"),
                "action": u.get("action"),
            }
            for u in items[:15]
        ]

    # ---------- Derived ----------

    def _compute_derived(self, data: dict) -> dict:
        comp: dict[str, Any] = {}

        # Earnings beat rate
        earnings = data.get("earnings_surprises") or []
        beats = [e for e in earnings if (e.get("surprise") or 0) > 0]
        misses = [e for e in earnings if (e.get("surprise") or 0) < 0]
        if earnings:
            comp["beat_rate"] = len(beats) / len(earnings)
            comp["beat_count"] = len(beats)
            comp["miss_count"] = len(misses)
            comp["avg_surprise_pct"] = sum(e.get("surprise_pct") or 0 for e in earnings) / len(earnings)

        # Net insider sentiment (last 90d)
        insider = data.get("insider_transactions") or []
        net_buys = sum(t.get("value", 0) for t in insider if (t.get("code") or "").upper() == "P")
        net_sells = sum(abs(t.get("value", 0)) for t in insider if (t.get("code") or "").upper() == "S")
        comp["insider_net_buys_usd"] = net_buys
        comp["insider_net_sells_usd"] = net_sells
        comp["insider_net_usd"] = net_buys - net_sells

        # Recommendation drift
        recs = data.get("recommendations") or []
        if len(recs) >= 2:
            latest = recs[0]
            prior = recs[-1]
            latest_bullish = (latest.get("strong_buy") or 0) + (latest.get("buy") or 0)
            prior_bullish = (prior.get("strong_buy") or 0) + (prior.get("buy") or 0)
            comp["analyst_bullish_drift"] = latest_bullish - prior_bullish

        # Rating change momentum (upgrades vs downgrades last 15 actions)
        rc = data.get("rating_changes") or []
        upg = sum(1 for r in rc if (r.get("action") or "").lower() == "up")
        dwn = sum(1 for r in rc if (r.get("action") or "").lower() == "down")
        comp["rating_upgrades_15d"] = upg
        comp["rating_downgrades_15d"] = dwn
        comp["rating_momentum"] = upg - dwn

        return comp

    async def aclose(self):
        await self.client.aclose()


_singleton: Optional[FinnhubSource] = None


def get_finnhub_source(api_key: Optional[str] = None) -> FinnhubSource:
    global _singleton
    if _singleton is None:
        _singleton = FinnhubSource(api_key=api_key)
    return _singleton
