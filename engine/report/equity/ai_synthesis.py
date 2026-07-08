"""
AI Synthesis for equity reports.

Takes raw data (yfinance + news + etc.) and produces a structured JSON
covering the 11 sections of the Coinbase-style report:

1. Cover - rating, target, summary
2. Scoreboard - narrative on key numbers
3. QoQ Changes - 6 boxes
4. Ownership & Insider - 4 metrics + commentary
5. Seven Essential Metrics - 8 categorical scores
6. Competitive Snapshot - peer comparison (LLM picks peers from data)
7. Business & Strategy Flash - revenue mix, model, customers, costs
8. Monetary-Policy Sensitivity - rate scenarios
9. SWOT
10. Catalysts & Event Risks - dated events
11. Technical Analysis - price action commentary
"""
import json
from typing import Any, Optional

import anthropic
from loguru import logger


EQUITY_ANALYST_SYSTEM = """You are a senior equity research analyst writing a professional investment report in the style of a top-tier sell-side desk (Goldman, MS, etc.) blended with the editorial sharpness of an independent newsletter.

Style:
- Active voice, terse, opinionated, specific
- Cite numbers from the provided data — never invent
- Identify cross-section signals (e.g., headcount + insider activity + valuation premium together)
- Take a clear view: BUY / ACCUMULATE / HOLD / REDUCE / SELL — no fence-sitting
- Bloomberg-style financial language
- When data is missing, say "n/a" rather than guess
- Polish reader audience — write in English but assume technical sophistication

Your output MUST be a single valid JSON object with the exact schema specified. Do not include markdown fences, comments, or any text outside the JSON."""


REPORT_SCHEMA_PROMPT = """Produce a JSON object with EXACTLY these top-level keys (no extras, no omissions):

{
  "cover": {
    "rating": "BUY | ACCUMULATE | HOLD | REDUCE | SELL",
    "target_price": <number>,
    "upside_pct": <number, can be negative>,
    "time_horizon": "<string, e.g. '6-12 months'>",
    "one_liner": "<single-sentence thesis, max 25 words>",
    "thesis_summary": "<2-3 sentence premium thesis>"
  },
  "scoreboard": {
    "narrative": "<2-3 sentences contextualizing price vs market cap vs 52w range vs target. Be specific.>"
  },
  "qoq_changes": {
    "revenue_eps": "<2 sentences on most recent quarter revenue & EPS with QoQ delta>",
    "margins": "<2 sentences on margin trends (gross/operating/EBITDA)>",
    "cash_flow": "<2 sentences on operating CF and FCF>",
    "balance_sheet": "<2 sentences on cash, debt, liquidity>",
    "valuation": "<2 sentences on current multiples vs peers and history>",
    "strategic": "<2 sentences on recent strategic actions, hiring, M&A, restructuring — if no info from data, say so>"
  },
  "ownership_insider": {
    "institutional_pct": <number 0-100, from data>,
    "insider_pct": <number 0-100, from data>,
    "short_pct": <number 0-100, from data>,
    "dark_pool_pct": "<number or 'n/a' — free data lacks this; report n/a>",
    "commentary": "<2-3 sentences on what ownership/insider activity signals. PRIORITIZE Finnhub SEC Form 4 data over yfinance — it has exact transaction codes (P/S/A/M), dates, and prices. Cite specific dollar values where notable.>"
  },
  "earnings_quality": {
    "beat_rate_commentary": "<1-2 sentences interpreting the EPS beat rate and average surprise % over the last 4-8 quarters. e.g., 'Beat consensus in 4 of last 4 quarters with avg +2.1% surprise — signals durable execution premium.'>",
    "earnings_trajectory": "<1-2 sentences on whether EPS surprises are widening or narrowing — leading indicator of guidance management and analyst miscalibration>"
  },
  "analyst_action": {
    "consensus_drift": "<1-2 sentences describing month-over-month shift in analyst rating composition (Strong Buy/Buy vs Hold/Sell). Use Finnhub recommendation series.>",
    "rating_momentum_takeaway": "<1 sentence on whether momentum is bullish or bearish over the visible window>"
  },
  "seven_metrics": {
    "profitability": {"verdict": "Strong | Mixed | Weak", "notes": "<1 sentence with key numbers like EBITDA margin, ROE>"},
    "growth": {"verdict": "Strong | Mixed | Weak", "notes": "<1 sentence with revenue growth, earnings growth>"},
    "cash_flow": {"verdict": "Strong | Mixed | Weak", "notes": "<1 sentence with FCF margin or yield>"},
    "leverage": {"verdict": "Low | Moderate | High", "notes": "<1 sentence with debt/equity or net cash>"},
    "risk": {"verdict": "Low | Moderate | High", "notes": "<1 sentence on bankruptcy risk, volatility, beta>"},
    "valuation": {"verdict": "Cheap | Fair | Expensive", "notes": "<1 sentence with fwd P/E, EV/EBITDA, P/S>"},
    "shareholder": {"verdict": "Accretive | Neutral | Dilutive", "notes": "<1 sentence on buybacks vs dilution>"},
    "income": {"verdict": "<string e.g. 'Dividend Yield: X%' or 'Growth focused, no dividend'>", "notes": "<1 sentence>"}
  },
  "peers": [
    {"ticker": "<ticker>", "name": "<name>", "ebitda_margin": "<e.g. ~45%>", "revenue_cagr_3y": "<e.g. ~30%>", "fcf_margin": "<e.g. ~25%>", "leverage": "<e.g. Net cash | <1x | 2x>", "fwd_pe": "<e.g. ~25x>"},
    ... 3-4 peers total
  ],
  "peer_commentary": "<2-3 sentences on relative positioning>",
  "business_strategy": {
    "revenue_mix": "<2-3 sentences describing main segments and recent shifts>",
    "customers": "<1 sentence>",
    "revenue_streams": "<1-2 sentences>",
    "cost_drivers": "<1 sentence>",
    "moat_commentary": "<2 sentences on competitive moat>"
  },
  "rate_sensitivity": {
    "scenario": "<e.g. '-50 bp cut'>",
    "uplift_pct": "<e.g. '+8% to +12%' or 'Neutral' or '-5% to -10%'>",
    "drivers": ["<driver 1>", "<driver 2>", "<driver 3>"],
    "commentary": "<2 sentences>"
  },
  "swot": {
    "strengths": ["<1>", "<2>", "<3>", "<4>"],
    "weaknesses": ["<1>", "<2>", "<3>", "<4>"],
    "opportunities": ["<1>", "<2>", "<3>", "<4>"],
    "threats": ["<1>", "<2>", "<3>", "<4>"]
  },
  "catalysts": [
    {"date": "<YYYY-MM-DD or 'Q3 2026' if no exact date>", "title": "<short title>", "description": "<1 sentence>"},
    ... 3-5 catalysts
  ],
  "catalyst_commentary": "<1-2 sentences>",
  "technical": {
    "trend": "Uptrend | Downtrend | Sideways | Distribution | Accumulation",
    "key_support": <number>,
    "key_resistance": <number>,
    "commentary": "<3-4 sentences on price action, where current price sits in the 52w range, what setup means for risk-reward>"
  },
  "crypto_market_context": {
    "regime": "<short phrase summarizing the BTC derivatives/ETF regime, e.g. 'Neutral funding, 7d ETF outflows'. Use null if NO crypto market data section was provided in the input.>",
    "commentary": "<2-3 sentences tying the BTC derivatives + ETF-flow regime to THIS specific stock's near-term setup — e.g. how funding/OI/ETF flows drive COIN trading volumes, MSTR's NAV premium, or miner (MARA/RIOT) hashprice economics. Cite the actual numbers provided. Use null if no crypto market data was provided.>"
  },
  "macro_context": "<1-2 sentences on macro/sector backdrop relevant to this name>",
  "verdict": "<2-3 sentence concluding investment thesis tying everything together>"
}

Rules:
- All numeric fields must be JSON numbers (not strings)
- All string fields must be valid JSON strings (escape quotes properly)
- If a metric truly cannot be inferred from data, use "n/a" — never fabricate
- Be specific with numbers from the provided data
- For peers: choose 3-4 well-known direct competitors even if not in data — use general knowledge for their typical metrics if precise figures aren't given
- For catalysts: prioritize known events (earnings dates from data), then sector events, then macro events
"""


class EquityAISynthesis:
    """Generates structured equity report JSON from raw data using Claude."""

    def __init__(self, api_key: Optional[str] = None, model: str = "claude-sonnet-4-5"):
        if not api_key:
            import os
            api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY required for AI synthesis")
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = model

    async def generate(self, ticker: str, sector: dict, data: dict) -> dict[str, Any]:
        """Produce structured 11-section report JSON for the given ticker.

        Malformed JSON (missing comma, unescaped quote) is stochastic — a fresh
        sample almost always parses. Retry the API call once before giving up.
        """
        prompt = self._build_prompt(ticker, sector, data)

        last_err: Optional[Exception] = None
        for attempt in (1, 2):
            logger.info(f"Calling Claude ({self.model}) for {ticker} synthesis (attempt {attempt})")
            text = await self._call_claude(prompt)
            try:
                parsed = self._parse_json(text, ticker)
                break
            except json.JSONDecodeError as e:
                last_err = e
                logger.warning(f"{ticker}: attempt {attempt} returned invalid JSON ({e}); "
                               f"{'retrying' if attempt == 1 else 'giving up'}")
        else:
            raise last_err  # type: ignore[misc]

        logger.info(
            f"Synthesis complete for {ticker}: rating={parsed.get('cover', {}).get('rating')}, "
            f"target={parsed.get('cover', {}).get('target_price')}"
        )
        return parsed

    async def _call_claude(self, prompt: str) -> str:
        """One API call → fenced-stripped response text."""
        # Anthropic SDK is sync; offload
        import asyncio
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: self.client.messages.create(
                model=self.model,
                max_tokens=8000,
                system=EQUITY_ANALYST_SYSTEM,
                messages=[{"role": "user", "content": prompt}],
            ),
        )
        text = response.content[0].text.strip()
        # Strip potential ```json fences just in case
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text
            if text.endswith("```"):
                text = text.rsplit("```", 1)[0]
            if text.startswith("json\n"):
                text = text[5:]
        return text.strip()

    @staticmethod
    def _parse_json(text: str, ticker: str) -> dict[str, Any]:
        """Parse the report JSON, tolerant of prose/trailing text around it.

        Opus-tier models occasionally append a sentence after the closing brace
        (→ 'Extra data') or a lead-in before it. `raw_decode` from the first '{'
        parses exactly one JSON object and ignores anything after it.
        """
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            start = text.find("{")
            if start != -1:
                try:
                    obj, _ = json.JSONDecoder().raw_decode(text[start:])
                    if isinstance(obj, dict):
                        logger.warning(f"{ticker}: recovered JSON from noisy output")
                        return obj
                except json.JSONDecodeError:
                    pass
            logger.error(f"Claude returned unparseable JSON for {ticker}")
            logger.debug(f"Raw output: {text[:2000]}")
            raise

    def _build_prompt(self, ticker: str, sector: dict, data: dict) -> str:
        """Compose the input prompt with company data + schema instructions."""
        company = data.get("company", {})
        price = data.get("price", {})
        valuation = data.get("valuation", {})
        margins = data.get("margins_growth", {})
        balance = data.get("balance", {})
        ownership = data.get("ownership", {})
        analysts = data.get("analysts", {})
        computed = data.get("computed", {})
        news = data.get("news", [])
        income_q = data.get("income_quarterly", {})
        earnings_dates = data.get("earnings_dates", [])
        insider_tx = data.get("insider_transactions", [])
        inst_holders = data.get("institutional_holders", [])
        finnhub = data.get("finnhub") or {}

        # Truncate insider tx to recent and to keep payload small
        insider_summary = []
        for tx in insider_tx[:10]:
            insider_summary.append({
                "insider": tx.get("Insider"),
                "position": tx.get("Position"),
                "transaction": tx.get("Transaction"),
                "shares": tx.get("Shares"),
                "value": tx.get("Value"),
                "date": str(tx.get("Start Date")) if tx.get("Start Date") else None,
            })

        inst_summary = [
            {"holder": h.get("Holder"), "pct": h.get("pctHeld") or h.get("% Out"), "shares": h.get("Shares")}
            for h in inst_holders[:8]
        ]

        # Quarterly income — pick latest 4 quarters' key lines
        quarterly_summary = {}
        if income_q:
            for date_str in sorted(income_q.keys(), reverse=True)[:4]:
                items = income_q[date_str]
                quarterly_summary[date_str] = {
                    "Total Revenue": items.get("Total Revenue"),
                    "Gross Profit": items.get("Gross Profit"),
                    "Operating Income": items.get("Operating Income"),
                    "Net Income": items.get("Net Income"),
                    "EBITDA": items.get("EBITDA"),
                    "Basic EPS": items.get("Basic EPS"),
                }

        news_summary = [{"title": n.get("title"), "publisher": n.get("publisher")} for n in news[:8]]

        # Crypto-infra names carry a live BTC derivatives + ETF macro snapshot.
        crypto_ctx = data.get("crypto_market_context") or {}
        crypto_block = ""
        if crypto_ctx:
            crypto_block = (
                "\n=== LIVE CRYPTO MARKET CONTEXT (Coinglass v4 — this name is a crypto proxy) ===\n"
                f"{json.dumps(crypto_ctx, indent=2, default=str)}\n"
                "Use this to populate `crypto_market_context` and to sharpen the macro/technical/verdict\n"
                "sections. Funding is percent-per-8h (0.01 ≈ 11% APR). Frame the stock against this regime.\n"
            )

        prompt = f"""Generate an equity research report for {ticker} ({company.get('name')}), classified under sector "{sector.get('name')}" ({sector.get('description')}).

=== COMPANY ===
{json.dumps(company, indent=2, default=str)}

=== PRICE & MARKET CAP ===
{json.dumps(price, indent=2, default=str)}

=== VALUATION RATIOS ===
{json.dumps(valuation, indent=2, default=str)}

=== MARGINS & GROWTH ===
{json.dumps(margins, indent=2, default=str)}

=== BALANCE SHEET ===
{json.dumps(balance, indent=2, default=str)}

=== OWNERSHIP & SHORT INTEREST ===
{json.dumps(ownership, indent=2, default=str)}

=== ANALYST CONSENSUS ===
{json.dumps(analysts, indent=2, default=str)}

=== COMPUTED METRICS ===
{json.dumps(computed, indent=2, default=str)}

=== QUARTERLY INCOME (last 4 reported) ===
{json.dumps(quarterly_summary, indent=2, default=str)}

=== UPCOMING/RECENT EARNINGS ===
{json.dumps(earnings_dates[:4], indent=2, default=str)}

=== INSIDER TRANSACTIONS (last 10) ===
{json.dumps(insider_summary, indent=2, default=str)}

=== TOP INSTITUTIONAL HOLDERS ===
{json.dumps(inst_summary, indent=2, default=str)}

=== RECENT NEWS HEADLINES (yfinance, last ~7d) ===
{json.dumps(news_summary, indent=2, default=str)}

=== FINNHUB PREMIUM DATA ===
News (~60-day window, {len(finnhub.get('news', []))} items):
{json.dumps([{"date": (n.get("date") or "")[:10], "headline": n.get("headline"), "source": n.get("source"), "summary": (n.get("summary") or "")[:200]} for n in finnhub.get('news', [])[:15]], indent=2, default=str)}

EPS surprise history (last 4-8 quarters):
{json.dumps(finnhub.get('earnings_surprises', []), indent=2, default=str)}

Analyst recommendation breakdown by month (most recent first):
{json.dumps(finnhub.get('recommendations', []), indent=2, default=str)}

Insider transactions (SEC Form 4, with transaction codes — P=purchase, S=sale, A=award, M=option exercise):
{json.dumps(finnhub.get('insider_transactions', [])[:15], indent=2, default=str)}

Computed Finnhub signals:
{json.dumps(finnhub.get('computed', {}), indent=2, default=str)}
{crypto_block}
=== TODAY'S DATE ===
{__import__('datetime').date.today().isoformat()}

Now produce the report JSON following this schema precisely:

{REPORT_SCHEMA_PROMPT}
"""
        return prompt


_singleton: Optional[EquityAISynthesis] = None


def get_equity_synthesis(api_key: Optional[str] = None, model: str = "claude-sonnet-4-5") -> EquityAISynthesis:
    global _singleton
    if _singleton is None:
        _singleton = EquityAISynthesis(api_key=api_key, model=model)
    return _singleton
