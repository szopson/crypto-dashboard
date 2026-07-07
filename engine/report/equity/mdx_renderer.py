"""
MDX renderer for equity reports.

Takes raw data + AI synthesis JSON and writes an MDX file with:
- YAML frontmatter (for listing, filtering, metadata)
- Custom JSX component placeholders for visual sections
- Plain markdown for the narrative pieces

Output path: content/reports/{sector_slug}/{ticker_lower}.mdx
"""
import json
import os
from datetime import date, datetime
from pathlib import Path
from typing import Any, Optional

import yaml
from loguru import logger


def _fmt_num(n: Optional[float], suffix: str = "", decimals: int = 2) -> str:
    if n is None:
        return "n/a"
    try:
        if abs(n) >= 1e12:
            return f"${n/1e12:.{decimals}f}T{suffix}"
        if abs(n) >= 1e9:
            return f"${n/1e9:.{decimals}f}B{suffix}"
        if abs(n) >= 1e6:
            return f"${n/1e6:.{decimals}f}M{suffix}"
        return f"${n:.{decimals}f}{suffix}"
    except Exception:
        return "n/a"


def _fmt_pct(n: Optional[float], decimals: int = 1) -> str:
    if n is None:
        return "n/a"
    try:
        return f"{n*100:.{decimals}f}%" if abs(n) < 1 else f"{n:.{decimals}f}%"
    except Exception:
        return "n/a"


def _safe_json(obj: Any) -> str:
    """Serialize obj as compact JSON suitable for embedding in JSX prop value."""
    return json.dumps(obj, default=str, ensure_ascii=False)


def _md_escape(text: Any) -> str:
    """Escape characters in plain narrative markdown text that MDX would
    otherwise parse as JSX. Concretely: any `<` followed by a non-letter
    (e.g. `<15%`, `<$80`, `< 10`) is converted to `&lt;`."""
    if text is None:
        return ""
    import re as _re
    return _re.sub(r"<(?![A-Za-z!/])", "&lt;", str(text))


def _jsx_json_prop(obj: Any) -> str:
    """
    Render a JSX prop that carries a JSON-encoded value as a plain HTML
    attribute string (double-quoted, inner `"` HTML-escaped to `&quot;`).

    This avoids relying on MDX's JSX-expression evaluation, which in practice
    silently drops expressions inside `{...}` for `next-mdx-remote/rsc` in
    some configurations. A plain string attribute is parsed identically across
    every MDX/HTML toolchain; the React component side decodes the JSON via
    `parseProp()` at render time.
    """
    raw = json.dumps(obj, default=str, ensure_ascii=False)
    safe = raw.replace("&", "&amp;").replace('"', "&quot;")
    return '"' + safe + '"'


def _jsx_num_prop(n: Any) -> str:
    """Render a numeric JSX prop as a plain string attribute (component parses)."""
    if n is None:
        return '""'
    return '"' + str(n) + '"'


class MDXRenderer:
    """Render equity report data + synthesis into MDX."""

    def __init__(self, output_root: str | Path):
        self.output_root = Path(output_root)
        self.output_root.mkdir(parents=True, exist_ok=True)

    def render(
        self,
        ticker: str,
        sector: dict,
        data: dict,
        synthesis: dict,
        slug_override: Optional[str] = None,
    ) -> Path:
        """Render and write MDX file. Returns path written."""
        ticker = ticker.upper()
        sector_slug = sector["slug"]
        slug = slug_override or ticker.lower()

        sector_dir = self.output_root / sector_slug
        sector_dir.mkdir(parents=True, exist_ok=True)
        out_path = sector_dir / f"{slug}.mdx"

        frontmatter = self._build_frontmatter(ticker, sector, data, synthesis)
        body = self._build_body(ticker, sector, data, synthesis)

        content = "---\n" + yaml.safe_dump(frontmatter, sort_keys=False, allow_unicode=True) + "---\n\n" + body
        out_path.write_text(content, encoding="utf-8")

        logger.info(f"Wrote MDX report: {out_path} ({len(content):,} chars)")
        return out_path

    # ---------- Frontmatter ----------

    def _build_frontmatter(self, ticker: str, sector: dict, data: dict, synthesis: dict) -> dict:
        cover = synthesis.get("cover", {})
        company = data.get("company", {})
        price = data.get("price", {})

        return {
            "ticker": ticker,
            "company": company.get("name"),
            "exchange": company.get("exchange"),
            "sector_slug": sector["slug"],
            "sector_name": sector["name"],
            "industry": company.get("industry"),
            "country": company.get("country"),
            "rating": cover.get("rating"),
            "target_price": cover.get("target_price"),
            "upside_pct": cover.get("upside_pct"),
            "time_horizon": cover.get("time_horizon"),
            "one_liner": cover.get("one_liner"),
            "price_at_report": price.get("current"),
            "market_cap": price.get("market_cap"),
            "currency": price.get("currency") or "USD",
            "date": date.today().isoformat(),
            "generated_at": datetime.utcnow().isoformat(),
            "data_source": "yfinance",
            "engine_version": "equity-mvp-1",
        }

    # ---------- Body ----------

    def _build_body(self, ticker: str, sector: dict, data: dict, synthesis: dict) -> str:
        sections = [
            self._section_intro(ticker, sector, data, synthesis),
            self._section_scoreboard(data, synthesis),
            self._section_crypto_market(data, synthesis),
            self._section_qoq(synthesis),
            self._section_ownership(data, synthesis),
            self._section_earnings_quality(data, synthesis),
            self._section_analyst_action(data, synthesis),
            self._section_seven_metrics(synthesis),
            self._section_peers(synthesis),
            self._section_business(synthesis),
            self._section_rates(synthesis),
            self._section_swot(synthesis),
            self._section_catalysts(synthesis),
            self._section_technical(data, synthesis),
            self._section_verdict(synthesis),
            self._section_data_notes(data),
        ]
        return "\n\n".join(s for s in sections if s)

    def _section_intro(self, ticker: str, sector: dict, data: dict, synthesis: dict) -> str:
        cover = synthesis.get("cover", {})
        company = data.get("company", {})
        target = cover.get("target_price")
        upside = cover.get("upside_pct")
        return (
            f"<ReportHeader\n"
            f"  ticker=\"{ticker}\"\n"
            f"  company={json.dumps(company.get('name'))}\n"
            f"  sector={json.dumps(sector['name'])}\n"
            f"  industry={json.dumps(company.get('industry'))}\n"
            f"  rating={json.dumps(cover.get('rating'))}\n"
            f"  targetPrice={_jsx_num_prop(target)}\n"
            f"  upsidePct={_jsx_num_prop(upside)}\n"
            f"  horizon={json.dumps(cover.get('time_horizon'))}\n"
            f"/>\n\n"
            f"**Thesis.** {_md_escape(cover.get('thesis_summary', ''))}\n"
        )

    def _section_scoreboard(self, data: dict, synthesis: dict) -> str:
        price = data.get("price", {})
        cover = synthesis.get("cover", {})
        scoreboard = synthesis.get("scoreboard", {})
        sb_data = {
            "last_close": price.get("current"),
            "previous_close": price.get("previous_close"),
            "target_price": cover.get("target_price"),
            "market_cap": price.get("market_cap"),
            "fifty_two_week_high": price.get("fifty_two_week_high"),
            "fifty_two_week_low": price.get("fifty_two_week_low"),
            "currency": price.get("currency") or "USD",
        }
        return (
            "## Scoreboard\n\n"
            f"<Scoreboard data={_jsx_json_prop(sb_data)} />\n\n"
            f"{scoreboard.get('narrative', '')}"
        )

    def _section_crypto_market(self, data: dict, synthesis: dict) -> str:
        """Live BTC derivatives + ETF regime — only for crypto-proxy names."""
        ctx = data.get("crypto_market_context")
        if not ctx:
            return ""
        section = synthesis.get("crypto_market_context") or {}
        funding = ctx.get("funding") or {}
        etf = ctx.get("etf") or {}
        strip = {
            "price": ctx.get("price"),
            "price_change_24h_pct": ctx.get("price_change_24h_pct"),
            "oi_usd": ctx.get("open_interest_usd"),
            "oi_change_24h_pct": ctx.get("oi_change_24h_pct"),
            "funding_pct_8h": funding.get("avg_pct_8h"),
            "etf_flow_24h_usd": etf.get("flow_24h_usd"),
            "etf_flow_7d_usd": etf.get("flow_7d_usd"),
            "etf_flow_30d_usd": etf.get("flow_30d_usd"),
            "regime": section.get("regime"),
            "signals": ctx.get("signals", []),
        }
        commentary = section.get("commentary") or ""
        return (
            "## Crypto Market Context\n\n"
            f"<CryptoMarketContext data={_jsx_json_prop(strip)} />\n\n"
            f"{_md_escape(commentary)}"
        )

    def _section_qoq(self, synthesis: dict) -> str:
        qoq = synthesis.get("qoq_changes", {})
        items = [
            {"label": "Revenue & EPS", "text": qoq.get("revenue_eps", "")},
            {"label": "Margins", "text": qoq.get("margins", "")},
            {"label": "Cash Flow", "text": qoq.get("cash_flow", "")},
            {"label": "Balance Sheet", "text": qoq.get("balance_sheet", "")},
            {"label": "Valuation", "text": qoq.get("valuation", "")},
            {"label": "Strategic Actions", "text": qoq.get("strategic", "")},
        ]
        return (
            "## QoQ Changes\n\n"
            f"<QoQGrid items={_jsx_json_prop(items)} />"
        )

    def _section_ownership(self, data: dict, synthesis: dict) -> str:
        own = synthesis.get("ownership_insider", {})
        own_data = {
            "institutional_pct": own.get("institutional_pct"),
            "insider_pct": own.get("insider_pct"),
            "short_pct": own.get("short_pct"),
            "dark_pool": own.get("dark_pool_pct"),
        }
        insider_tx = data.get("insider_transactions", [])
        recent_insider = [
            {
                "insider": tx.get("Insider"),
                "position": tx.get("Position"),
                "transaction": tx.get("Transaction"),
                "shares": tx.get("Shares"),
                "value": tx.get("Value"),
                "date": str(tx.get("Start Date")) if tx.get("Start Date") else None,
            }
            for tx in insider_tx[:6]
        ]
        return (
            "## Ownership & Insider Activity\n\n"
            f"<OwnershipGrid data={_jsx_json_prop(own_data)} />\n\n"
            f"{own.get('commentary', '')}\n\n"
            "### Recent Insider Transactions\n\n"
            f"<InsiderTransactions rows={_jsx_json_prop(recent_insider)} />"
        )

    def _section_earnings_quality(self, data: dict, synthesis: dict) -> str:
        finnhub = data.get("finnhub") or {}
        rows = finnhub.get("earnings_surprises") or []
        if not rows:
            return ""
        comp = finnhub.get("computed") or {}
        section = synthesis.get("earnings_quality") or {}
        summary = {
            "beat_rate": comp.get("beat_rate"),
            "avg_surprise_pct": comp.get("avg_surprise_pct"),
            "beat_count": comp.get("beat_count"),
            "miss_count": comp.get("miss_count"),
        }
        return (
            "## Earnings Quality\n\n"
            f"<EarningsHistory rows={_jsx_json_prop(rows)} summary={_jsx_json_prop(summary)} />\n\n"
            f"{_md_escape(section.get('beat_rate_commentary', ''))}\n\n"
            f"{_md_escape(section.get('earnings_trajectory', ''))}"
        )

    def _section_analyst_action(self, data: dict, synthesis: dict) -> str:
        finnhub = data.get("finnhub") or {}
        recs = finnhub.get("recommendations") or []
        if not recs:
            return ""
        section = synthesis.get("analyst_action") or {}
        return (
            "## Analyst Action\n\n"
            f"<AnalystRatings rows={_jsx_json_prop(recs)} />\n\n"
            f"{_md_escape(section.get('consensus_drift', ''))}\n\n"
            f"**{_md_escape(section.get('rating_momentum_takeaway', ''))}**"
        )

    def _section_seven_metrics(self, synthesis: dict) -> str:
        sm = synthesis.get("seven_metrics", {})
        return (
            "## Seven Essential Metrics\n\n"
            f"<SevenMetrics data={_jsx_json_prop(sm)} />"
        )

    def _section_peers(self, synthesis: dict) -> str:
        peers = synthesis.get("peers", [])
        commentary = synthesis.get("peer_commentary", "")
        return (
            "## Competitive Snapshot\n\n"
            f"<PeerTable rows={_jsx_json_prop(peers)} />\n\n"
            f"{commentary}"
        )

    def _section_business(self, synthesis: dict) -> str:
        bs = synthesis.get("business_strategy", {})
        return (
            "## Business & Strategy\n\n"
            f"<BusinessFlash data={_jsx_json_prop(bs)} />\n\n"
            f"{bs.get('moat_commentary', '')}"
        )

    def _section_rates(self, synthesis: dict) -> str:
        r = synthesis.get("rate_sensitivity", {})
        return (
            "## Monetary-Policy Sensitivity\n\n"
            f"<RateScenario data={_jsx_json_prop(r)} />\n\n"
            f"{r.get('commentary', '')}"
        )

    def _section_swot(self, synthesis: dict) -> str:
        swot = synthesis.get("swot", {})
        return (
            "## SWOT Analysis\n\n"
            f"<SWOTGrid data={_jsx_json_prop(swot)} />"
        )

    def _section_catalysts(self, synthesis: dict) -> str:
        cats = synthesis.get("catalysts", [])
        commentary = synthesis.get("catalyst_commentary", "")
        return (
            "## Catalysts & Event Risks\n\n"
            f"<CatalystsTimeline items={_jsx_json_prop(cats)} />\n\n"
            f"{commentary}"
        )

    def _section_technical(self, data: dict, synthesis: dict) -> str:
        t = synthesis.get("technical", {})
        history = data.get("history", [])
        chart_data = [{"date": h["date"], "close": h["close"]} for h in history]
        td = {
            "trend": t.get("trend"),
            "support": t.get("key_support"),
            "resistance": t.get("key_resistance"),
        }
        return (
            "## Technical Analysis\n\n"
            f"<PriceChart series={_jsx_json_prop(chart_data)} markers={_jsx_json_prop(td)} />\n\n"
            f"{t.get('commentary', '')}"
        )

    def _section_verdict(self, synthesis: dict) -> str:
        verdict = synthesis.get("verdict", "")
        macro = synthesis.get("macro_context", "")
        if not verdict and not macro:
            return ""
        out = "## Verdict\n\n"
        if macro:
            out += f"**Macro context.** {macro}\n\n"
        if verdict:
            out += verdict
        return out

    def _section_data_notes(self, data: dict) -> str:
        return (
            "---\n\n"
            f"<DataNote source=\"Yahoo Finance / yfinance\" fetched={json.dumps(data.get('fetched_at'))} />"
        )


def get_mdx_renderer(output_root: str | Path = "content/reports") -> MDXRenderer:
    return MDXRenderer(output_root)
