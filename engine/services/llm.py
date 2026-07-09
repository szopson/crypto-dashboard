"""
LLM Service for Claude API integration.

Provides:
- Market analysis using Claude
- Daily briefing generation
- Trading copilot chat
"""
from datetime import datetime
from typing import Optional
import anthropic
from loguru import logger

from config import settings


# System prompt for trading analysis
TRADING_SYSTEM_PROMPT = """You are a professional crypto trading analyst assistant for the Trading Command Center.

Your role is to analyze BTC market data and provide actionable insights based on the three-layer trading system:

## TRADING SYSTEM LAYERS

### 1. RADAR (Macro Bias Engine)
- BBWP (Bollinger Band Width Percentile): Low = accumulation, High = distribution
- Gaussian Channel: Price position relative to channel
- Williams Vix Fix (WVF): Fear spikes = buying opportunities
- Funding Rate: Extreme values indicate crowded trades
- Score 5-6: ACCUMULATE (full size longs)
- Score 3-4: NEUTRAL (reduced size)
- Score 0-2: SELL THE RALLY (shorts only)

### 2. MAP (Structural Analysis)
- Swing High/Low detection (HH, HL, LH, LL patterns)
- Secondary Swing (SS): Key invalidation level
- HH_HL pattern = Bullish structure
- LH_LL pattern = Bearish structure
- SS break = Bias flip

### 3. SNIPER (Execution Engine)
- Confluence scoring (0-5 points)
- Entry at Order Blocks (OB) or Fair Value Gaps (FVG)
- Stop loss at Secondary Swing level
- Position sizing based on confluence

### 4. LIVE DERIVATIVES (Cockpit)
When the context includes a "Live Derivatives" section (Coinglass/Velo data),
treat it as the source of truth for questions about open interest, funding,
basis, liquidations, ETF flows and positioning. It carries: OI with 1h/4h/24h
deltas per coin (BTC/ETH/SOL), funding across venues plus the
Binance↔Hyperliquid spread, perp basis vs spot with 24h context, liquidation
totals split long/short, spot ETF flows (24h/7d), retail vs top-trader
positioning, and pre-computed deviations ranked by severity. Quote concrete
numbers from it; never invent values that are not in the context. Funding is
percent per 8h; basis is percent vs spot.

## RESPONSE GUIDELINES
- Be concise and actionable
- Focus on the current market context
- Highlight key levels and potential trade setups
- Warn about conflicting signals
- Use bullet points for clarity
- Include specific price levels when relevant
- Mention timeframe alignment

You will receive market data in JSON format. Analyze it and provide insights.
"""


class LLMService:
    """Service for Claude API interactions."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.anthropic_api_key
        self.client = None
        if self.api_key:
            self.client = anthropic.Anthropic(api_key=self.api_key)
            logger.info("Claude API client initialized")
        else:
            logger.warning("No ANTHROPIC_API_KEY found - LLM features disabled")

    def is_available(self) -> bool:
        """Check if LLM service is available."""
        return self.client is not None

    async def analyze_market(
        self,
        market_data: dict,
        question: Optional[str] = None,
    ) -> dict:
        """
        Analyze market data using Claude.

        Args:
            market_data: Dictionary with bias, radar, structure, zones, sniper data
            question: Optional specific question from user

        Returns:
            Dictionary with analysis result
        """
        if not self.is_available():
            return {
                "success": False,
                "error": "LLM service not configured. Set ANTHROPIC_API_KEY.",
                "analysis": None,
            }

        try:
            # Build context message
            context = self._build_market_context(market_data)

            # Build user message
            if question:
                user_message = f"""Based on the current market data:

{context}

User question: {question}

Please provide a focused analysis addressing the user's question."""
            else:
                user_message = f"""Analyze the current BTC market conditions:

{context}

Provide:
1. Overall market assessment (bullish/bearish/neutral)
2. Key observations from each layer (RADAR, Structure, SNIPER)
3. Actionable trading recommendations
4. Risk warnings if any"""

            # Call Claude API
            message = self.client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=1024,
                system=TRADING_SYSTEM_PROMPT,
                messages=[
                    {"role": "user", "content": user_message}
                ]
            )

            analysis = message.content[0].text

            return {
                "success": True,
                "analysis": analysis,
                "model": message.model,
                "usage": {
                    "input_tokens": message.usage.input_tokens,
                    "output_tokens": message.usage.output_tokens,
                },
                "timestamp": datetime.utcnow().isoformat(),
            }

        except anthropic.APIError as e:
            logger.error(f"Claude API error: {e}")
            return {
                "success": False,
                "error": str(e),
                "analysis": None,
            }
        except Exception as e:
            logger.error(f"LLM analysis error: {e}")
            return {
                "success": False,
                "error": str(e),
                "analysis": None,
            }

    async def generate_daily_briefing(self, market_data: dict) -> dict:
        """
        Generate daily market briefing.

        Args:
            market_data: Full market data

        Returns:
            Dictionary with briefing
        """
        if not self.is_available():
            return {
                "success": False,
                "error": "LLM service not configured",
                "briefing": None,
            }

        try:
            context = self._build_market_context(market_data)

            user_message = f"""Generate a concise daily briefing for BTC trading.

Current Market Data:
{context}

Format the briefing as:

# Daily BTC Briefing - {datetime.utcnow().strftime('%Y-%m-%d')}

## Market Snapshot
[Current price, 24h change, key levels]

## RADAR Assessment
[Score, classification, key signals]

## Structural Bias
[MTF bias alignment, SS levels to watch]

## Today's Game Plan
[Specific actionable items: what to watch, potential setups]

## Risk Notes
[Warnings, conflicting signals, key invalidation levels]

Keep it concise but comprehensive. Use bullet points."""

            message = self.client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=1500,
                system=TRADING_SYSTEM_PROMPT,
                messages=[
                    {"role": "user", "content": user_message}
                ]
            )

            return {
                "success": True,
                "briefing": message.content[0].text,
                "model": message.model,
                "timestamp": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            logger.error(f"Briefing generation error: {e}")
            return {
                "success": False,
                "error": str(e),
                "briefing": None,
            }

    async def chat(
        self,
        message: str,
        market_data: Optional[dict] = None,
        history: Optional[list] = None,
    ) -> dict:
        """
        Chat with the trading copilot.

        Args:
            message: User message
            market_data: Optional current market data
            history: Optional conversation history

        Returns:
            Dictionary with response
        """
        if not self.is_available():
            return {
                "success": False,
                "error": "LLM service not configured",
                "response": None,
            }

        try:
            messages = []

            # Add history if provided
            if history:
                for h in history[-10:]:  # Last 10 messages
                    messages.append({
                        "role": h.get("role", "user"),
                        "content": h.get("content", ""),
                    })

            # Build current message with optional market context
            if market_data:
                context = self._build_market_context(market_data)
                user_content = f"""Current market context:
{context}

User: {message}"""
            else:
                user_content = message

            messages.append({"role": "user", "content": user_content})

            # Call API
            response = self.client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=1024,
                system=TRADING_SYSTEM_PROMPT,
                messages=messages,
            )

            return {
                "success": True,
                "response": response.content[0].text,
                "model": response.model,
                "timestamp": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            logger.error(f"Chat error: {e}")
            return {
                "success": False,
                "error": str(e),
                "response": None,
            }

    def _build_market_context(self, data: dict) -> str:
        """Build formatted market context string."""
        lines = []

        # Price
        if "price" in data:
            p = data["price"]
            lines.append(f"**Current Price:** ${p.get('price', 0):,.2f}")
            if p.get("change_24h"):
                lines.append(f"**24h Change:** {p['change_24h']:.2f}%")

        # RADAR
        if "radar" in data:
            r = data["radar"]
            lines.append(f"\n**RADAR Score:** {r.get('score', 'N/A')}/6 ({r.get('classification', 'N/A')})")
            if r.get("components"):
                for comp in r["components"]:
                    lines.append(f"  - {comp}")

        # Bias
        if "bias" in data:
            b = data["bias"]
            lines.append(f"\n**Overall Bias:** {b.get('overall_bias', 'N/A')}")
            if "biases" in b:
                for tf, bias in b["biases"].items():
                    ss = bias.get("secondary_swing_level")
                    ss_str = f" (SS: ${ss:,.0f})" if ss else ""
                    lines.append(f"  - {tf}: {bias.get('structural_bias', 'N/A')}{ss_str}")

        # SNIPER
        if "sniper" in data:
            s = data["sniper"]
            conf = s.get("confluence", {})
            lines.append(f"\n**SNIPER Confluence:** {conf.get('score', 0)}/5 ({conf.get('signal', 'N/A')})")
            if s.get("setups"):
                lines.append(f"**Trade Setups:** {len(s['setups'])} available")
                for setup in s["setups"][:2]:
                    lines.append(f"  - {setup.get('direction')} at {setup.get('entry_zone_type')}")

        # Zones
        if "zones" in data:
            z = data["zones"]
            nearby = z.get("nearby_zones", [])
            if nearby:
                lines.append(f"\n**Nearby Zones:** {len(nearby)}")
                for zone in nearby[:3]:
                    lines.append(f"  - {zone.get('type')}: ${zone.get('mid', 0):,.0f} ({zone.get('distance_pct', 0):.1f}% away)")

        # Live derivatives (cockpit snapshot: Coinglass + Velo). Rendered
        # selectively — the raw snapshot never reaches the prompt.
        if data.get("derivatives"):
            d = data["derivatives"]
            lines.append("\n**Live Derivatives (Coinglass/Velo):**")
            for c in (d.get("coins") or [])[:3]:
                oi_b = (c.get("oi_usd") or 0) / 1e9
                lines.append(
                    f"  - {c.get('symbol')}: ${c.get('price', 0):,.2f} | "
                    f"funding {c.get('funding_rate_oi', 0):.4f}%/8h | "
                    f"OI ${oi_b:.2f}B (1h {c.get('oi_change_1h_pct', 0):+.2f}%, "
                    f"4h {c.get('oi_change_4h_pct', 0):+.2f}%, 24h {c.get('oi_change_24h_pct', 0):+.2f}%) | "
                    f"L/S {c.get('long_short_24h', 0):.2f} | "
                    f"liq 24h ${(c.get('liquidation_24h_usd') or 0)/1e6:.0f}M "
                    f"(L ${(c.get('long_liq_24h_usd') or 0)/1e6:.0f}M / S ${(c.get('short_liq_24h_usd') or 0)/1e6:.0f}M)"
                )
                if c.get("basis_pct") is not None:
                    prev = c.get("basis_24h_ago_pct")
                    prev_str = f" (24h ago {prev:+.3f}%)" if prev is not None else ""
                    lines.append(f"    basis vs spot {c['basis_pct']:+.3f}%{prev_str}")
            fa = d.get("funding_aggregate") or {}
            if fa.get("btc_exchanges"):
                venues = ", ".join(
                    f"{e.get('exchange')} {e.get('rate_pct', 0):.4f}%" for e in fa["btc_exchanges"]
                )
                spread = fa.get("btc_spread_pct")
                spread_str = f" (spread {spread:.4f}%)" if spread is not None else ""
                lines.append(f"  - BTC funding by venue: {venues}{spread_str}")
            vf = d.get("velo_funding") or {}
            if vf.get("spread_pct_8h") is not None:
                lines.append(
                    f"  - Binance↔Hyperliquid funding spread: {vf['spread_pct_8h']:+.4f}%/8h (Velo)"
                )
            etf = d.get("etf") or {}
            if etf.get("btc_24h_flow_usd") is not None:
                flow7 = (etf.get("btc_7d_flow_usd") or 0) / 1e6
                lines.append(
                    f"  - BTC spot ETF flow: 24h ${etf['btc_24h_flow_usd']/1e6:+,.0f}M, 7d ${flow7:+,.0f}M"
                )
            pos = d.get("positioning") or {}
            if pos.get("retail_long_pct") is not None:
                top = pos.get("top_trader_long_pct")
                top_str = f" vs top traders {top:.1f}% long" if top is not None else ""
                lines.append(f"  - Positioning: retail {pos['retail_long_pct']:.1f}% long{top_str}")
            devs = d.get("deviations") or []
            if devs:
                lines.append("  - Notable deviations:")
                for x in devs[:5]:
                    lines.append(
                        f"    [{x.get('severity')}] {x.get('symbol')}: {x.get('headline')} — {x.get('detail')}"
                    )

        return "\n".join(lines)


# Singleton instance
_llm_service: Optional[LLMService] = None


def get_llm_service() -> LLMService:
    """Get or create LLM service instance."""
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service
