"""
Opportunity Engine — daily "what to watch" cards (design: docs/research/OPPORTUNITY_ENGINE.md).

Once a day (same job as the cockpit digest), turn the crypto-pulse snapshot into
ranked watch cards per coin: a deterministic 0-100 attention score computed from
the pre-structured `deviations[]`, plus a Claude-written narration (headline /
why / risks). Cards end in the frontend's ExchangeCTA — the affiliate
conversion point — so this service never builds ref links itself.

NOT signals: PRODUCT_VISION.md locks "bez sygnałów kup/sprzedaj". The score
measures how UNUSUAL a coin's derivatives configuration is, not which way to
trade it. The narration prompt forbids directional recommendations and a
post-generation check falls back to deterministic card text if one slips
through (same belt-and-suspenders pattern as the digest CTA check).
"""
from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Optional

import anthropic
from loguru import logger

from config import settings


# Persisted under ./data — mounted as a named volume in docker-compose so the
# cards survive container recreates on deploy (the container FS does not).
CARDS_STATE_FILE = Path("./data/opportunity_cards_latest.json")

# Universe = whatever coins the crypto-pulse snapshot returns (BTC/ETH/SOL
# today — see `symbols` in frontend/src/lib/coinglass.ts). Market-wide
# deviations ("MKT") contribute to every coin at half weight.

SEVERITY_POINTS = {"alert": 3.0, "watch": 1.5, "info": 0.5}

# Typical busy day ≈ 2 alerts + a watch (7.5 pts) → ~94. Calmer days scale down.
SCORE_PER_POINT = 12.5

# Recommendation phrasings that must never appear in generated card text.
# Deliberately NOT banning bare "long"/"short" — "long/short ratio" and
# "long liquidations" are legitimate data terms the cards need.
RECOMMENDATION_RE = re.compile(
    r"\b("
    r"go (long|short)|open (a )?(long|short)|enter (a )?(long|short)|"
    r"buy|sell|longing|shorting|"
    r"take profits?|stop[- ]loss|price target|"
    r"we recommend|you should (buy|sell|long|short|enter|exit)"
    r")\b",
    re.IGNORECASE,
)

NARRATION_SYSTEM_PROMPT = """You annotate daily derivatives "watch cards" for \
experienced perpetual-futures traders. Audience is NOT retail beginners.

HARD RULES:
- NEVER recommend a trade or a direction. No buy/sell/go long/go short/targets/\
stop losses. You describe what the data shows; the reader decides.
- Use ONLY numbers present in the provided snapshot. Never invent data.
- Terse desk-note tone. No hype, no education, no emojis.

For each card you receive (symbol, attention score, deviations, coin metrics),
write:
- "headline": one line naming the most notable configuration (e.g. "Funding \
reset while OI holds — positioning washed out").
- "why": 3-5 short bullets, each anchored to a concrete number from the data.
- "risks": 1-3 short bullets with opposing datapoints or reasons the setup can \
resolve either way. Be honest; if the picture is mixed, say so.

Return ONLY a JSON array (no prose, no code fences), one object per input card:
[{"symbol": "...", "headline": "...", "why": ["..."], "risks": ["..."]}]"""


class OpportunityEngineService:
    """Builds, narrates and persists the daily opportunity cards."""

    def __init__(self):
        self.model = settings.report_ai_model
        self._client: Optional[anthropic.Anthropic] = (
            anthropic.Anthropic(api_key=settings.anthropic_api_key)
            if settings.anthropic_api_key
            else None
        )

    async def fetch_snapshot(self) -> Optional[dict]:
        """
        Fetch the shared derivatives snapshot — delegated to the digest
        service, which validates against the all-zero cold-cache snapshot
        and retries past it.
        """
        from services.cockpit_digest import get_cockpit_digest_service

        return await get_cockpit_digest_service().fetch_snapshot()

    # === Stage 1: deterministic attention score ===

    @staticmethod
    def _coin_deviations(deviations: list[dict], symbol: str) -> list[tuple[dict, float]]:
        """Deviations relevant to a coin with their weight (MKT counts half)."""
        out: list[tuple[dict, float]] = []
        for d in deviations or []:
            if d.get("symbol") == symbol:
                out.append((d, 1.0))
            elif d.get("symbol") == "MKT":
                out.append((d, 0.5))
        return out

    def _btc_radar_modifier(self) -> float:
        """
        Attention bonus when RADAR 1D is far from neutral — a strong regime
        makes any derivatives deviation more worth watching. Direction-blind
        by design. Fails quietly to 0 (score must never depend on Bybit uptime).
        """
        try:
            from data.exchange import get_exchange_client
            from calculations.radar import calculate_full_radar

            exchange = get_exchange_client()
            ohlcv = exchange.fetch_ohlcv(symbol=None, timeframe="1d", limit=300)
            funding = exchange.fetch_funding_rate(None).get("funding_rate", 0)
            radar = calculate_full_radar(ohlcv, funding)
            score = float(radar.get("score", 3.0))
            return min(15.0, abs(score - 3.0) * 7.5)
        except Exception as e:
            logger.warning(f"Opportunity engine: RADAR modifier unavailable: {e}")
            return 0.0

    def score_coin(
        self, symbol: str, deviations: list[dict], radar_bonus: float = 0.0
    ) -> tuple[int, str]:
        """Return (attention score 0-100, direction_pressure)."""
        weighted = self._coin_deviations(deviations, symbol)
        points = sum(
            SEVERITY_POINTS.get(d.get("severity", "info"), 0.5) * w
            for d, w in weighted
        )
        score = min(100, round(points * SCORE_PER_POINT + radar_bonus))

        # direction_pressure describes which way the deviations lean — a
        # property of the data (display-only), not advice.
        lean = 0.0
        for d, w in weighted:
            pts = SEVERITY_POINTS.get(d.get("severity", "info"), 0.5) * w
            if d.get("direction") == "bullish":
                lean += pts
            elif d.get("direction") == "bearish":
                lean -= pts
        if points > 0 and abs(lean) / points >= 0.35:
            pressure = "bullish" if lean > 0 else "bearish"
        else:
            pressure = "neutral"
        return score, pressure

    # === Stage 2: narration (Claude, deterministic fallback) ===

    @staticmethod
    def _fallback_narration(symbol: str, devs: list[dict]) -> dict:
        """Card text straight from the structured deviations — no LLM."""
        ranked = sorted(
            devs,
            key=lambda d: SEVERITY_POINTS.get(d.get("severity", "info"), 0.5),
            reverse=True,
        )
        headline = ranked[0]["headline"] if ranked else "Derivatives near baseline"
        why = [f"{d.get('headline', '')} — {d.get('detail', '')}" for d in ranked[:4]]
        majority = {"bullish": 0, "bearish": 0}
        for d in ranked:
            if d.get("direction") in majority:
                majority[d["direction"]] += 1
        opposing = "bearish" if majority["bullish"] >= majority["bearish"] else "bullish"
        risks = [
            f"{d.get('headline', '')} — {d.get('detail', '')}"
            for d in ranked
            if d.get("direction") == opposing
        ][:2] or ["Mixed configuration — can resolve either way."]
        return {"symbol": symbol, "headline": headline, "why": why, "risks": risks}

    @staticmethod
    def _narration_is_clean(card: dict) -> bool:
        text = " ".join(
            [card.get("headline", ""), *card.get("why", []), *card.get("risks", [])]
        )
        return not RECOMMENDATION_RE.search(text)

    def narrate(self, snap: dict, scored: list[dict]) -> dict[str, dict]:
        """
        Narrate all cards in one Claude call. Returns {symbol: narration}.
        Any card that fails parsing or the recommendation check gets the
        deterministic fallback instead.
        """
        deviations = snap.get("deviations") or []
        fallbacks = {
            c["symbol"]: self._fallback_narration(
                c["symbol"], [d for d, _ in self._coin_deviations(deviations, c["symbol"])]
            )
            for c in scored
        }
        if not self._client or not scored:
            return fallbacks

        coins_by_symbol = {c.get("symbol"): c for c in (snap.get("coins") or [])}
        payload = [
            {
                "symbol": c["symbol"],
                "attention_score": c["score"],
                "deviations": [d for d, _ in self._coin_deviations(deviations, c["symbol"])],
                "metrics": coins_by_symbol.get(c["symbol"]),
            }
            for c in scored
        ]
        context = {
            "funding_aggregate": snap.get("funding_aggregate"),
            "etf": snap.get("etf"),
            "positioning": snap.get("positioning"),
        }
        try:
            message = self._client.messages.create(
                model=self.model,
                max_tokens=1500,
                system=NARRATION_SYSTEM_PROMPT,
                messages=[
                    {
                        "role": "user",
                        "content": (
                            f"Market context:\n{json.dumps(context)}\n\n"
                            f"Cards:\n{json.dumps(payload)}"
                        ),
                    }
                ],
            )
            raw = message.content[0].text.strip()
            raw = re.sub(r"^```(json)?|```$", "", raw, flags=re.MULTILINE).strip()
            parsed = json.loads(raw)
            out = dict(fallbacks)
            for card in parsed if isinstance(parsed, list) else []:
                sym = card.get("symbol")
                if sym not in out:
                    continue
                if not card.get("headline") or not card.get("why"):
                    continue
                if not self._narration_is_clean(card):
                    logger.warning(
                        f"Opportunity engine: {sym} narration tripped the "
                        f"recommendation check — using fallback"
                    )
                    continue
                out[sym] = {
                    "symbol": sym,
                    "headline": str(card["headline"]),
                    "why": [str(b) for b in card.get("why", [])][:5],
                    "risks": [str(b) for b in card.get("risks", [])][:3]
                    or fallbacks[sym]["risks"],
                }
            return out
        except Exception as e:
            logger.error(f"Opportunity engine: LLM narration failed, using fallback: {e}")
            return fallbacks

    # === Persistence ===

    def save_latest(self, date: str, cards: list[dict]) -> None:
        try:
            CARDS_STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
            CARDS_STATE_FILE.write_text(
                json.dumps(
                    {
                        "date": date,
                        "generated_at": datetime.utcnow().isoformat() + "Z",
                        "cards": cards,
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
        except Exception as e:
            logger.error(f"Opportunity engine: failed to persist cards: {e}")

    @staticmethod
    def load_latest() -> Optional[dict]:
        try:
            return json.loads(CARDS_STATE_FILE.read_text(encoding="utf-8"))
        except FileNotFoundError:
            return None
        except Exception as e:
            logger.error(f"Opportunity engine: failed to read persisted cards: {e}")
            return None

    # === Orchestration ===

    async def generate(self) -> dict:
        """Build today's cards and persist them. Returns {success, date, cards}."""
        snap = await self.fetch_snapshot()
        if not snap:
            return {"success": False, "error": "snapshot unavailable"}
        from services.cockpit_digest import CockpitDigestService

        if not CockpitDigestService.snapshot_has_data(snap):
            # Keep the previous good card set; the frontend hides stale data.
            return {"success": False, "error": "snapshot empty (all-zero)"}

        deviations = snap.get("deviations") or []
        radar_bonus = self._btc_radar_modifier()

        universe = [
            c["symbol"] for c in snap.get("coins") or [] if c.get("symbol")
        ]
        scored: list[dict] = []
        for symbol in universe:
            bonus = radar_bonus if symbol == "BTC" else 0.0
            score, pressure = self.score_coin(symbol, deviations, bonus)
            scored.append(
                {"symbol": symbol, "score": score, "direction_pressure": pressure}
            )
        scored.sort(key=lambda c: c["score"], reverse=True)

        narrations = self.narrate(snap, scored)
        now = datetime.utcnow()
        date = now.strftime("%Y-%m-%d")
        cards = [
            {
                **c,
                "headline": narrations[c["symbol"]]["headline"],
                "why": narrations[c["symbol"]]["why"],
                "risks": narrations[c["symbol"]]["risks"],
                "date": date,
                "generated_at": now.isoformat() + "Z",
            }
            for c in scored
        ]
        self.save_latest(date, cards)
        logger.info(
            "Opportunity engine: cards ready — "
            + ", ".join(f"{c['symbol']}:{c['score']}" for c in cards)
        )
        return {"success": True, "date": date, "cards": cards}


_opportunity_engine_service: Optional[OpportunityEngineService] = None


def get_opportunity_engine_service() -> OpportunityEngineService:
    global _opportunity_engine_service
    if _opportunity_engine_service is None:
        _opportunity_engine_service = OpportunityEngineService()
    return _opportunity_engine_service
