"""
Report Generator Service.

Main orchestrator for PDF report generation:
1. Gather data from multiple sources in parallel (CoinGecko, DefiLlama, GitHub, Dune, Perplexity)
2. Send data to AI for synthesis (team, product, risk, investment analysis)
3. Populate HTML template with data + AI analysis
4. Render HTML to PDF with Playwright
5. Optionally send to Telegram
"""
import asyncio
import time
import httpx
from datetime import datetime
from typing import Dict, Any, Optional
from loguru import logger

from config import settings
from .template_engine import get_template_engine
from .pdf_renderer import get_pdf_renderer
from .chart_generator import (
    generate_pie_chart_paths,
    calculate_circle_offset,
    get_metric_class,
    generate_catalyst_html,
    generate_swot_items,
    generate_peer_table_rows,
    generate_risk_items,
    generate_team_badges,
)
from .data_sources.coingecko import get_coingecko_source
from .data_sources.defillama import get_defillama_source
from .data_sources.github_activity import get_github_source
from .ai_synthesis import get_ai_synthesis_service
from services.dune_service import get_dune_service


class ReportGeneratorService:
    """
    Main orchestrator for PDF report generation.

    Data sources:
    - CoinGecko: Price, market cap, supply, community
    - DefiLlama: TVL, protocol metrics
    - GitHub: Stars, commits, contributors
    - Dune Analytics: On-chain holder data
    - Perplexity: Web research (team, news, sentiment)
    """

    PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions"

    def __init__(self):
        self.template_engine = get_template_engine()
        self.pdf_renderer = get_pdf_renderer()
        self.coingecko = get_coingecko_source()
        self.defillama = get_defillama_source()
        self.github = get_github_source()
        self.dune = get_dune_service()
        self.ai_synthesis = get_ai_synthesis_service()
        self.perplexity_key = getattr(settings, 'perplexity_api_key', None)

    async def generate_report(
        self,
        ticker: str,
        report_type: str = "crypto",
        send_telegram: bool = False,
        telegram_chat_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate a complete PDF investment report.

        Args:
            ticker: Token symbol (e.g., "SOL")
            report_type: Type of report
            send_telegram: Whether to send PDF to Telegram
            telegram_chat_id: Override default chat ID

        Returns:
            Dict with success status, PDF bytes, and metadata
        """
        start_time = time.time()
        logger.info(f"Starting report generation for {ticker}")

        try:
            # Phase 1: Gather data from all sources in parallel
            logger.info(f"Phase 1: Gathering data for {ticker}")
            data = await self._gather_data(ticker)

            # Phase 2: AI synthesis
            logger.info(f"Phase 2: AI synthesis for {ticker}")
            analysis = await self.ai_synthesis.generate_analysis(ticker, data)

            # Phase 3: Prepare template data
            logger.info(f"Phase 3: Preparing template data for {ticker}")
            template_data = self._prepare_template_data(ticker, data, analysis)

            # Phase 4: Render HTML template
            logger.info(f"Phase 4: Rendering HTML template for {ticker}")
            html_content = self.template_engine.render("crypto_report.html", template_data)

            # Phase 5: Generate PDF
            logger.info(f"Phase 5: Generating PDF for {ticker}")
            pdf_bytes = await self.pdf_renderer.render(html_content)

            # Phase 6: Optional Telegram delivery
            telegram_result = None
            if send_telegram:
                logger.info(f"Phase 6: Sending PDF to Telegram for {ticker}")
                telegram_result = await self._send_to_telegram(
                    pdf_bytes, ticker, telegram_chat_id
                )

            generation_time = time.time() - start_time
            logger.info(f"Report generated for {ticker} in {generation_time:.2f}s")

            return {
                "success": True,
                "pdf_bytes": pdf_bytes,
                "telegram_sent": telegram_result is not None and telegram_result.get("success"),
                "telegram_message_id": telegram_result.get("message_id") if telegram_result else None,
                "generation_time_seconds": round(generation_time, 2),
            }

        except Exception as e:
            logger.error(f"Report generation failed for {ticker}: {e}")
            return {
                "success": False,
                "error": str(e),
                "generation_time_seconds": round(time.time() - start_time, 2),
            }

    async def _search_perplexity(self, query: str) -> Dict[str, Any]:
        """Search using Perplexity API for web research."""
        if not self.perplexity_key:
            return {"content": "", "citations": []}

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.post(
                    self.PERPLEXITY_URL,
                    headers={
                        "Authorization": f"Bearer {self.perplexity_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "sonar",
                        "messages": [
                            {
                                "role": "system",
                                "content": "You are a crypto research analyst. Provide detailed, factual information with sources."
                            },
                            {"role": "user", "content": query}
                        ],
                        "temperature": 0.2,
                    }
                )
                response.raise_for_status()
                data = response.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                citations = data.get("citations", [])
                return {"content": content, "citations": citations}
        except Exception as e:
            logger.warning(f"Perplexity search error: {e}")
            return {"content": "", "citations": []}

    async def _fetch_dune_data(self, contract_address: str, chain: str) -> Dict[str, Any]:
        """Fetch on-chain holder data from Dune Analytics."""
        if not contract_address or not self.dune.is_configured():
            return {}

        try:
            data = await self.dune.get_token_data(contract_address, chain)
            if data:
                return {
                    "holder_count": data.holder_count,
                    "top_10_percent": data.top_10_holder_percent,
                    "top_100_percent": data.top_100_holder_percent,
                    "active_addresses_7d": data.active_addresses_7d,
                }
            return {}
        except Exception as e:
            logger.warning(f"Dune fetch error: {e}")
            return {}

    async def _gather_data(self, ticker: str) -> Dict[str, Any]:
        """Gather data from all sources in parallel."""
        # Phase 1: Basic data sources
        basic_results = await asyncio.gather(
            self.coingecko.fetch(ticker),
            self.defillama.fetch(ticker),
            self.github.fetch(ticker),
            return_exceptions=True,
        )

        data = {
            "coingecko": basic_results[0] if not isinstance(basic_results[0], Exception) else {},
            "defillama": basic_results[1] if not isinstance(basic_results[1], Exception) else {},
            "github": basic_results[2] if not isinstance(basic_results[2], Exception) else {},
            "dune": {},
            "perplexity": {},
        }

        # Log any errors
        sources = ["coingecko", "defillama", "github"]
        for i, result in enumerate(basic_results):
            if isinstance(result, Exception):
                logger.warning(f"Data source {sources[i]} failed: {result}")

        # Phase 2: Get project name for research
        project_name = data["coingecko"].get("name", ticker)

        # Phase 3: Additional data sources (Dune + Perplexity)
        contract_address = data["coingecko"].get("contract_address", "")
        chain = data["coingecko"].get("asset_platform_id", "ethereum") or "ethereum"

        # Research queries
        team_query = f"""
        Research the team and founders of {project_name} ({ticker}) cryptocurrency:
        1. Who are the founders? Are they doxxed (publicly known identity)?
        2. Team size and key members
        3. Previous projects and experience
        4. Any controversies or red flags?
        Be concise and factual.
        """

        news_query = f"""
        What are the latest news and developments for {project_name} ({ticker}) in the past 3 months?
        Include: partnerships, product launches, roadmap updates, ecosystem growth.
        Be concise and factual.
        """

        additional_results = await asyncio.gather(
            self._fetch_dune_data(contract_address, chain),
            self._search_perplexity(team_query),
            self._search_perplexity(news_query),
            return_exceptions=True,
        )

        if not isinstance(additional_results[0], Exception):
            data["dune"] = additional_results[0]
        if not isinstance(additional_results[1], Exception):
            data["perplexity"]["team"] = additional_results[1]
        if not isinstance(additional_results[2], Exception):
            data["perplexity"]["news"] = additional_results[2]

        return data

    def _prepare_template_data(
        self,
        ticker: str,
        data: Dict[str, Any],
        analysis: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Prepare all template placeholders from data and analysis."""
        cg = data.get("coingecko", {})
        dl = data.get("defillama", {})
        gh = data.get("github", {})
        dune = data.get("dune", {})
        perplexity = data.get("perplexity", {})

        # Extract values with defaults
        name = cg.get("name", ticker)
        current_price = cg.get("current_price") or 0
        market_cap = cg.get("market_cap") or 0
        fdv = cg.get("fdv") or 0
        ath = cg.get("ath") or 0
        ath_change = cg.get("ath_change_percentage") or 0
        circulating = cg.get("circulating_supply") or 0
        total_supply = cg.get("total_supply") or circulating or 1
        tvl = dl.get("tvl") or dl.get("chain_tvl") or 0

        # Dune on-chain data
        holder_count = dune.get("holder_count")
        top_10_percent = dune.get("top_10_percent")

        # Calculate derived values
        supply_percent = round((circulating / total_supply) * 100) if total_supply else 0

        # Pie chart paths - use Dune data if available
        if top_10_percent:
            team_pct = min(15, top_10_percent / 3)
            whale_pct = min(35, top_10_percent - team_pct)
            community_pct = 100 - team_pct - whale_pct
            pie_paths = generate_pie_chart_paths([team_pct, whale_pct, community_pct], cx=100, cy=100, radius=80)
        else:
            pie_paths = generate_pie_chart_paths([15, 25, 60], cx=100, cy=100, radius=80)

        # Circle metric offsets (based on overall score or defaults)
        overall_score = analysis.get("overall_score", 50)
        revenue_pct = min(overall_score + 10, 100)
        tvl_growth_pct = min(overall_score, 100)
        yield_pct = min(overall_score - 5, 100) if overall_score > 5 else 0
        treasury_pct = min(overall_score + 5, 100)
        concentration_pct = 100 - min(overall_score / 2, 50)  # Lower is better
        risk_pct = 100 - overall_score  # Lower score = higher risk

        # Prepare SWOT items
        strengths = analysis.get("swot_strengths", ["Strong fundamentals"])
        opportunities = analysis.get("swot_opportunities", ["Market growth"])
        weaknesses = analysis.get("swot_weaknesses", ["Competition"])
        threats = analysis.get("swot_threats", ["Regulatory risk"])

        # Prepare catalysts
        catalysts = analysis.get("catalysts", [
            {"quarter": "Q1", "title": "Review roadmap", "description": "Check announcements"},
        ])

        # Prepare peer table (placeholder data)
        peers = [
            {"name": ticker, "market_cap": self._format_large_number(market_cap), "tvl": self._format_large_number(tvl), "mc_tvl": f"{market_cap/tvl:.1f}x" if tvl else "N/A", "volume": self._format_large_number(cg.get("total_volume", 0)), "dev_activity": "High" if (gh.get("commits_4_weeks") or 0) > 50 else "Medium", "community": "Strong"},
            {"name": "Competitor 1", "market_cap": "N/A", "tvl": "N/A", "mc_tvl": "N/A", "volume": "N/A", "dev_activity": "Medium", "community": "Medium"},
            {"name": "Competitor 2", "market_cap": "N/A", "tvl": "N/A", "mc_tvl": "N/A", "volume": "N/A", "dev_activity": "Low", "community": "Growing"},
        ]

        return {
            # Cover page
            "PROJECT_NAME": name,
            "TICKER": ticker,
            "TICKER_INITIAL": ticker[0] if ticker else "?",
            "CATEGORY": ", ".join(cg.get("categories", ["Cryptocurrency"])[:2]) or "Cryptocurrency",
            "CHAIN": self._infer_chain(ticker, cg),
            "RECOMMENDATION": analysis.get("investment_rating", "NEUTRAL"),
            "RECOMMENDATION_CLASS": analysis.get("investment_rating", "neutral").lower(),
            "TARGET_PRICE": analysis.get("target_price", f"${current_price * 1.2:.2f}"),
            "UPSIDE": analysis.get("upside_percent", "+20%"),
            "REPORT_DATE": datetime.utcnow().strftime("%m.%d.%Y"),

            # Scoreboard
            "CURRENT_PRICE": f"${current_price:,.2f}" if current_price else "N/A",
            "MARKET_CAP": self._format_large_number(market_cap),
            "FDV": self._format_large_number(fdv),
            "ATH": f"${ath:,.2f}" if ath else "N/A",
            "ATH_DISTANCE": f"{ath_change:+.1f}%" if ath_change else "N/A",
            "OVERALL_SCORE": str(overall_score),
            "RANGE_52W": f"${cg.get('atl', 0):,.2f} - ${cg.get('ath', 0):,.2f}",
            "SCOREBOARD_NOTE": analysis.get("scoreboard_note", "Review metrics for investment decision."),

            # Monthly changes
            "MOM_PRICE_ACTION": analysis.get("mom_price_action", f"Price changed {cg.get('price_change_30d', 0):.1f}% over 30 days."),
            "MOM_TVL": analysis.get("mom_tvl", f"TVL: {self._format_large_number(tvl)}" if tvl else "TVL data unavailable."),
            "MOM_VOLUME": analysis.get("mom_volume", f"24h volume: {self._format_large_number(cg.get('total_volume', 0))}"),
            "MOM_COMMUNITY": analysis.get("mom_community", "Community metrics from CoinGecko."),
            "MOM_DEV_ACTIVITY": analysis.get("mom_dev_activity", f"GitHub commits (4w): {gh.get('commits_4_weeks', 'N/A')}"),
            "MOM_STRATEGIC": analysis.get("mom_strategic", "Review project announcements."),

            # Holder & Whale Activity (enhanced with Dune data)
            "PIE_TEAM_PATH": pie_paths[0] if len(pie_paths) > 0 else "",
            "PIE_WHALES_PATH": pie_paths[1] if len(pie_paths) > 1 else "",
            "PIE_COMMUNITY_PATH": pie_paths[2] if len(pie_paths) > 2 else "",
            "HOLDER_COMMENTARY": analysis.get("holder_commentary", "Token distribution analysis based on available on-chain data."),
            "CIRCULATING_SUPPLY": self._format_large_number(circulating, prefix=""),
            "TOTAL_SUPPLY": self._format_large_number(total_supply, prefix=""),
            "PERCENT_CIRCULATING": f"{supply_percent}%",
            "TOP10_CONCENTRATION": f"~{top_10_percent:.1f}%" if top_10_percent else "~25-35%",
            "HOLDER_COUNT": f"{holder_count:,}" if holder_count else "N/A",
            "ACTIVE_ADDRESSES_7D": f"{dune.get('active_addresses_7d', 'N/A'):,}" if dune.get('active_addresses_7d') else "N/A",
            "EXCHANGE_RESERVE": "Stable",
            "NEXT_UNLOCK": "Check vesting schedule",
            "TEAM_VESTING": "Ongoing",

            # Team & Founders (from Perplexity research)
            "TEAM_ANALYSIS": analysis.get("team_analysis", "<p>Team research from web sources.</p>"),
            "TEAM_DOXXED": analysis.get("team_doxxed", "Unknown"),
            "TEAM_EXPERIENCE": analysis.get("team_experience", "Review project background"),
            "TEAM_SCORE": str(analysis.get("team_score", 50)),
            "TEAM_BADGES": generate_team_badges(analysis.get("team_badges", [])),

            # Product & Technology
            "PRODUCT_STATUS": analysis.get("product_status", "Production"),
            "PRODUCT_ANALYSIS": analysis.get("product_analysis", "<p>Product analysis from available sources.</p>"),
            "GITHUB_STARS": str(gh.get("stars", 0)),
            "GITHUB_FORKS": str(gh.get("forks", 0)),
            "GITHUB_COMMITS_4W": str(gh.get("commits_4_weeks", 0)),
            "GITHUB_CONTRIBUTORS": str(gh.get("contributors", 0)),

            # Risk Assessment
            "RISK_ANALYSIS": analysis.get("risk_analysis", "<p>Risk assessment based on available data.</p>"),
            "RISK_ITEMS": generate_risk_items(analysis.get("key_risks", ["Market volatility", "Regulatory uncertainty", "Competition"])),
            "OVERALL_RISK": analysis.get("overall_risk", "Medium"),
            "REGULATORY_RISK": analysis.get("regulatory_risk", "Medium"),
            "TECHNICAL_RISK": analysis.get("technical_risk", "Low"),
            "MARKET_RISK": analysis.get("market_risk", "Medium"),

            # Recent News (from Perplexity)
            "RECENT_NEWS": analysis.get("recent_news", "<p>Check project announcements for latest updates.</p>"),

            # Seven Essential Metrics
            "REVENUE_VALUE": f"{revenue_pct}",
            "REVENUE_CLASS": get_metric_class(revenue_pct),
            "REVENUE_OFFSET": str(calculate_circle_offset(revenue_pct)),
            "REVENUE_SUBLABEL": '<span class="metric-rating moderate">Moderate</span>',

            "TVL_GROWTH_VALUE": f"{tvl_growth_pct}",
            "TVL_GROWTH_CLASS": get_metric_class(tvl_growth_pct),
            "TVL_GROWTH_OFFSET": str(calculate_circle_offset(tvl_growth_pct)),
            "TVL_GROWTH_SUBLABEL": '<span class="metric-rating moderate">Moderate</span>',

            "YIELD_VALUE": f"{yield_pct}",
            "YIELD_CLASS": get_metric_class(yield_pct),
            "YIELD_OFFSET": str(calculate_circle_offset(yield_pct)),
            "YIELD_SUBLABEL": '<span class="metric-rating moderate">Variable</span>',

            "TREASURY_VALUE": f"{treasury_pct}",
            "TREASURY_CLASS": get_metric_class(treasury_pct),
            "TREASURY_OFFSET": str(calculate_circle_offset(treasury_pct)),
            "TREASURY_SUBLABEL": '<span class="metric-rating strong">Strong</span>',

            "CONCENTRATION_VALUE": f"{int(concentration_pct)}",
            "CONCENTRATION_CLASS": "negative" if concentration_pct > 50 else "positive",
            "CONCENTRATION_OFFSET": str(calculate_circle_offset(concentration_pct)),
            "CONCENTRATION_SUBLABEL": '<span class="metric-rating moderate">Moderate</span>',

            "RISK_VALUE": f"{int(risk_pct)}",
            "RISK_CLASS": "negative" if risk_pct > 50 else "positive",
            "RISK_OFFSET": str(calculate_circle_offset(risk_pct)),
            "RISK_SUBLABEL": '<span class="metric-rating moderate">Medium</span>',

            # Valuation sidebar
            "SUPPLY_PERCENT": str(supply_percent),
            "FDV_REVENUE": "N/A",
            "FDV_REV_BAR": "30",
            "MC_TVL": f"{market_cap/tvl:.1f}x" if tvl and market_cap else "N/A",
            "MC_TVL_BAR": str(min(int((market_cap / tvl) * 10), 100)) if tvl and market_cap else "0",
            "FDV_TVL": f"{fdv/tvl:.1f}x" if tvl and fdv else "N/A",
            "FDV_TVL_BAR": str(min(int((fdv / tvl) * 10), 100)) if tvl and fdv else "0",
            "VALUATION_NOTE": analysis.get("executive_summary", "Review valuation metrics manually.")[:200],

            # Competitive Snapshot
            "COMPETITIVE_COMMENTARY": analysis.get("competitive_commentary", "<p>Competitive analysis based on available data.</p>"),
            "PEER_TABLE_ROWS": generate_peer_table_rows(peers),

            # Business & Strategy
            "STRATEGY_LEFT_CONTENT": analysis.get("strategy_left", "<p>Business model analysis.</p>"),
            "STRATEGY_RIGHT_CONTENT": analysis.get("strategy_right", "<p>Growth strategy analysis.</p>"),

            # Monetary Policy
            "RATE_CUT_IMPACT": analysis.get("rate_cut_impact", "Typically benefits from looser monetary policy."),
            "RATE_SENSITIVITY_NOTE": analysis.get("rate_sensitivity_note", "Crypto assets are generally sensitive to liquidity conditions and risk appetite."),

            # SWOT
            "SWOT_STRENGTHS": generate_swot_items(strengths),
            "SWOT_OPPORTUNITIES": generate_swot_items(opportunities),
            "SWOT_WEAKNESSES": generate_swot_items(weaknesses),
            "SWOT_THREATS": generate_swot_items(threats),

            # Catalysts
            "CATALYST_ITEMS": generate_catalyst_html(catalysts),
            "CATALYST_COMMENTARY": analysis.get("catalyst_commentary", "Monitor project roadmap for updates."),

            # Verdict
            "VERDICT_ANALYSIS": analysis.get("verdict_analysis", f"<p>{ticker} requires further analysis. Review the data provided.</p>"),
            "TIME_HORIZON": analysis.get("time_horizon", "6-12 months"),
            "GENERATED_AT": datetime.utcnow().isoformat(),

            # Category Scores (8 categories)
            **self._generate_score_placeholders(analysis),

            # Enhanced Team Details
            "TEAM_SIZE": analysis.get("team_size", "Unknown"),
            "KEY_MEMBERS": analysis.get("key_members", "Research team backgrounds"),
            "PREVIOUS_PROJECTS": analysis.get("previous_projects", "N/A"),

            # Competition Details
            "COMPETITORS_LIST": self._generate_competitors_html(analysis.get("competitors", [])),
            "ADVANTAGES_LIST": self._generate_advantages_html(analysis.get("advantages", ["Strong technology", "Market position"])),
            "DISADVANTAGES_LIST": self._generate_disadvantages_html(analysis.get("disadvantages", ["Competition", "Regulatory uncertainty"])),
            "COMPETITIVE_MOAT": analysis.get("competitive_moat", "Review competitive advantages and market positioning."),

            # Investment Signals
            "BULLISH_SIGNALS": self._generate_signals_html(analysis.get("bullish_catalysts", ["Market growth potential", "Strong fundamentals"]), "up"),
            "BEARISH_SIGNALS": self._generate_signals_html(analysis.get("bearish_concerns", ["Market volatility", "Regulatory risk"]), "down"),
        }

    def _format_large_number(self, value: float, prefix: str = "$") -> str:
        """Format large numbers with B/M/K suffixes."""
        if not value:
            return "N/A"

        abs_value = abs(value)
        if abs_value >= 1_000_000_000:
            return f"{prefix}{value/1_000_000_000:.2f}B"
        elif abs_value >= 1_000_000:
            return f"{prefix}{value/1_000_000:.2f}M"
        elif abs_value >= 1_000:
            return f"{prefix}{value/1_000:.2f}K"
        else:
            return f"{prefix}{value:.2f}"

    def _infer_chain(self, ticker: str, cg_data: Dict) -> str:
        """Infer blockchain from ticker or categories."""
        categories = cg_data.get("categories", [])

        # Check categories for chain indicators
        for cat in categories:
            cat_lower = cat.lower()
            if "ethereum" in cat_lower:
                return "Ethereum"
            if "solana" in cat_lower:
                return "Solana"
            if "binance" in cat_lower or "bsc" in cat_lower:
                return "BNB Chain"
            if "polygon" in cat_lower:
                return "Polygon"
            if "avalanche" in cat_lower:
                return "Avalanche"
            if "arbitrum" in cat_lower:
                return "Arbitrum"
            if "optimism" in cat_lower:
                return "Optimism"

        # Check if ticker is a known chain
        chain_tickers = {
            "ETH": "Ethereum",
            "SOL": "Solana",
            "BNB": "BNB Chain",
            "MATIC": "Polygon",
            "AVAX": "Avalanche",
            "ARB": "Arbitrum",
            "OP": "Optimism",
            "DOT": "Polkadot",
            "ATOM": "Cosmos",
            "NEAR": "NEAR",
            "SUI": "Sui",
            "APT": "Aptos",
            "SEI": "Sei",
        }

        return chain_tickers.get(ticker.upper(), "Multi-chain")

    def _generate_score_placeholders(self, analysis: Dict[str, Any]) -> Dict[str, str]:
        """Generate score placeholders for 8 category scores."""
        def get_score_class(score: int) -> str:
            if score >= 7:
                return "strong"
            elif score >= 4:
                return "moderate"
            return "weak"

        def get_rating(score: int) -> str:
            if score >= 7:
                return "Strong"
            elif score >= 4:
                return "Moderate"
            return "Weak"

        # Default scores or from analysis
        scores = {
            "team": analysis.get("score_team", 5),
            "product": analysis.get("score_product", 5),
            "dev": analysis.get("score_dev", 5),
            "market": analysis.get("score_market", 5),
            "competition": analysis.get("score_competition", 5),
            "sentiment": analysis.get("score_sentiment", 5),
            "tokenomics": analysis.get("score_tokenomics", 5),
            "decentral": analysis.get("score_decentral", 5),
        }

        placeholders = {}
        for key, score in scores.items():
            score = int(score) if score else 5
            placeholders[f"SCORE_{key.upper()}"] = str(score)
            placeholders[f"SCORE_{key.upper()}_CLASS"] = get_score_class(score)
            placeholders[f"RATING_{key.upper()}"] = get_rating(score)

        return placeholders

    def _generate_competitors_html(self, competitors: list) -> str:
        """Generate HTML for competitors list."""
        if not competitors:
            return '<div class="competitor-item"><div class="competitor-name">Research competitors</div><div class="competitor-note">Analyze market positioning</div></div>'

        html_parts = []
        for comp in competitors[:4]:
            name = comp.get("name", comp) if isinstance(comp, dict) else str(comp)
            note = comp.get("note", "") if isinstance(comp, dict) else ""
            html_parts.append(f'<div class="competitor-item"><div class="competitor-name">{name}</div><div class="competitor-note">{note}</div></div>')

        return '\n'.join(html_parts)

    def _generate_advantages_html(self, advantages: list) -> str:
        """Generate HTML for competitive advantages."""
        if not advantages:
            return '<div class="advantage-item"><span class="icon">✓</span> Review competitive advantages</div>'

        return '\n'.join(f'<div class="advantage-item"><span class="icon">✓</span> {adv}</div>' for adv in advantages[:5])

    def _generate_disadvantages_html(self, disadvantages: list) -> str:
        """Generate HTML for competitive disadvantages."""
        if not disadvantages:
            return '<div class="disadvantage-item"><span class="icon">✗</span> Review competitive weaknesses</div>'

        return '\n'.join(f'<div class="disadvantage-item"><span class="icon">✗</span> {dis}</div>' for dis in disadvantages[:5])

    def _generate_signals_html(self, signals: list, direction: str = "up") -> str:
        """Generate HTML for investment signals."""
        if not signals:
            return f'<div class="signal-item"><span class="arrow {direction}">{"▲" if direction == "up" else "▼"}</span> Research market catalysts</div>'

        arrow = "▲" if direction == "up" else "▼"
        return '\n'.join(f'<div class="signal-item"><span class="arrow {direction}">{arrow}</span> {signal}</div>' for signal in signals[:5])

    async def _send_to_telegram(
        self,
        pdf_bytes: bytes,
        ticker: str,
        chat_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Send PDF to Telegram."""
        try:
            from services.telegram import get_telegram_service

            telegram = get_telegram_service()
            if not telegram.is_available():
                logger.warning("Telegram service not available")
                return None

            # Check if send_document method exists
            if hasattr(telegram, 'send_document'):
                result = await telegram.send_document(
                    document=pdf_bytes,
                    filename=f"{ticker}_Investment_Report.pdf",
                    caption=f"*{ticker} Investment Report*\n\nGenerated by Trading Command Center",
                    chat_id=chat_id,
                )
                return result
            else:
                logger.warning("Telegram send_document method not available")
                return None

        except Exception as e:
            logger.error(f"Telegram send failed: {e}")
            return None


# Singleton
_generator: Optional[ReportGeneratorService] = None


def get_report_generator_service() -> ReportGeneratorService:
    """Get or create report generator service singleton."""
    global _generator
    if _generator is None:
        _generator = ReportGeneratorService()
    return _generator
