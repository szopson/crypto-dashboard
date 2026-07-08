"""
AI Synthesis Service using Claude API.

Generates opinionated investment analysis from data.
"""
import json
from typing import Dict, Any, Optional
from loguru import logger

try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    logger.warning("anthropic not installed - AI synthesis unavailable")

from config import settings


INVESTMENT_ANALYST_PROMPT = """You are a senior crypto investment analyst writing a professional investment report. Your task is to synthesize raw data into compelling, opinionated analysis.

Style guidelines:
- Write in active voice, professional tone
- Be specific with numbers and facts
- Provide clear bullish/bearish signals
- Identify key risks and catalysts
- Compare to competitors when relevant
- Use Bloomberg-style financial language

Output format: Return a JSON object with these sections. Each text field should be 2-4 sentences unless specified:

{
    "executive_summary": "2-3 sentence high-level thesis",
    "investment_rating": "BUY | SELL | HOLD | NEUTRAL",
    "target_price": "Price target with rationale",
    "upside_percent": "Expected upside/downside percentage",
    "time_horizon": "6-12 months or similar",
    "scoreboard_note": "Brief commentary on key metrics",
    "mom_price_action": "Price movement analysis",
    "mom_tvl": "TVL/protocol changes",
    "mom_volume": "Volume and liquidity changes",
    "mom_community": "Community/holder growth",
    "mom_dev_activity": "Development activity assessment",
    "mom_strategic": "Strategic updates/partnerships",
    "holder_commentary": "Analysis of holder distribution and whale activity",
    "competitive_commentary": "How it compares to competitors (use <p> tags)",
    "strategy_left": "Business model and revenue analysis (use <p> tags)",
    "strategy_right": "Growth strategy and roadmap (use <p> tags)",
    "rate_cut_impact": "Impact summary of rate cuts on this asset",
    "rate_sensitivity_note": "Detailed monetary policy sensitivity analysis",
    "swot_strengths": ["Strength 1", "Strength 2", "Strength 3"],
    "swot_opportunities": ["Opportunity 1", "Opportunity 2", "Opportunity 3"],
    "swot_weaknesses": ["Weakness 1", "Weakness 2", "Weakness 3"],
    "swot_threats": ["Threat 1", "Threat 2", "Threat 3"],
    "catalysts": [
        {"quarter": "Q1", "title": "Catalyst title", "description": "Brief description"},
        {"quarter": "Q2", "title": "Another catalyst", "description": "Brief description"}
    ],
    "catalyst_commentary": "Overview of upcoming catalysts",
    "verdict_analysis": "Final investment thesis (use <p> tags for multiple paragraphs)",
    "overall_score": 75,

    "team_analysis": "Analysis of team background, experience, and credibility (use <p> tags)",
    "team_doxxed": "Yes/No/Partial - are founders publicly known?",
    "team_experience": "Brief summary of team's relevant experience",
    "team_score": 70,
    "team_badges": ["Doxxed", "Experienced", "VC-backed"],

    "product_status": "idea | whitepaper | testnet | mainnet | production",
    "product_analysis": "Analysis of product maturity and technology (use <p> tags)",

    "risk_analysis": "Detailed risk assessment (use <p> tags)",
    "key_risks": ["Risk 1", "Risk 2", "Risk 3", "Risk 4"],
    "overall_risk": "High | Medium | Low",
    "regulatory_risk": "High | Medium | Low",
    "technical_risk": "High | Medium | Low",
    "market_risk": "High | Medium | Low",

    "recent_news": "Summary of recent news and developments (use <p> tags)",

    "score_team": 7,
    "score_product": 8,
    "score_dev": 5,
    "score_market": 7,
    "score_competition": 6,
    "score_sentiment": 6,
    "score_tokenomics": 7,
    "score_decentral": 5,

    "team_size": "medium | small | large",
    "key_members": "Name1, Name2, Name3",
    "previous_projects": "Previous project names",

    "competitors": [
        {"name": "Competitor1", "note": "Brief comparison"},
        {"name": "Competitor2", "note": "Brief comparison"}
    ],
    "advantages": ["Advantage 1", "Advantage 2", "Advantage 3"],
    "disadvantages": ["Disadvantage 1", "Disadvantage 2"],
    "competitive_moat": "Description of competitive moat and defensibility",

    "bullish_catalysts": ["Catalyst 1", "Catalyst 2", "Catalyst 3"],
    "bearish_concerns": ["Concern 1", "Concern 2", "Concern 3"]
}
"""


class AISynthesisService:
    """
    Generate AI-powered investment analysis using Claude.
    """

    def __init__(self):
        self.api_key = settings.anthropic_api_key
        self.client = None

        if ANTHROPIC_AVAILABLE and self.api_key:
            self.client = anthropic.Anthropic(api_key=self.api_key)
            logger.info("AI Synthesis service initialized")
        else:
            logger.warning("AI synthesis unavailable - missing API key or SDK")

    def is_available(self) -> bool:
        """Check if AI service is available."""
        return self.client is not None

    async def generate_analysis(
        self,
        ticker: str,
        data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Generate comprehensive investment analysis.

        Args:
            ticker: Token symbol
            data: Aggregated data from all sources

        Returns:
            Dict with AI-generated analysis sections
        """
        if not self.is_available():
            logger.warning("AI synthesis unavailable, returning fallback analysis")
            return self._get_fallback_analysis(ticker, data)

        try:
            # Prepare data summary for Claude
            data_summary = self._prepare_data_summary(ticker, data)

            # Call Claude API (synchronous - anthropic SDK)
            message = self.client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=4000,
                system=INVESTMENT_ANALYST_PROMPT,
                messages=[
                    {
                        "role": "user",
                        "content": f"Analyze this crypto asset and provide investment analysis:\n\n{data_summary}"
                    }
                ]
            )

            # Parse response
            response_text = message.content[0].text

            # Extract JSON from response
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0]
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0]

            analysis = json.loads(response_text.strip())

            logger.info(f"AI analysis generated for {ticker}")
            return analysis

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response: {e}")
            return self._get_fallback_analysis(ticker, data)
        except Exception as e:
            logger.error(f"AI synthesis failed: {e}")
            return self._get_fallback_analysis(ticker, data)

    def _prepare_data_summary(self, ticker: str, data: Dict[str, Any]) -> str:
        """Prepare data summary for AI analysis."""
        lines = [f"# {ticker} Data Summary\n"]

        # CoinGecko data
        cg = data.get("coingecko", {})
        if cg:
            lines.append("## Market Data (CoinGecko)")
            lines.append(f"- Name: {cg.get('name', 'N/A')}")
            lines.append(f"- Symbol: {cg.get('symbol', ticker)}")
            lines.append(f"- Current Price: ${cg.get('current_price', 'N/A')}")
            lines.append(f"- Market Cap: ${cg.get('market_cap', 'N/A')}")
            lines.append(f"- FDV: ${cg.get('fdv', 'N/A')}")
            lines.append(f"- 24h Volume: ${cg.get('total_volume', 'N/A')}")
            lines.append(f"- 24h Change: {cg.get('price_change_24h', 'N/A')}%")
            lines.append(f"- 7d Change: {cg.get('price_change_7d', 'N/A')}%")
            lines.append(f"- 30d Change: {cg.get('price_change_30d', 'N/A')}%")
            lines.append(f"- ATH: ${cg.get('ath', 'N/A')}")
            lines.append(f"- ATH Change: {cg.get('ath_change_percentage', 'N/A')}%")
            lines.append(f"- Circulating Supply: {cg.get('circulating_supply', 'N/A')}")
            lines.append(f"- Total Supply: {cg.get('total_supply', 'N/A')}")
            lines.append(f"- Categories: {', '.join(cg.get('categories', []))}")

            community = cg.get("community_data", {})
            if community:
                lines.append("\n## Community")
                lines.append(f"- Twitter Followers: {community.get('twitter_followers', 'N/A')}")
                lines.append(f"- Telegram Users: {community.get('telegram_channel_user_count', 'N/A')}")

            dev = cg.get("developer_data", {})
            if dev:
                lines.append("\n## Development (CoinGecko)")
                lines.append(f"- GitHub Stars: {dev.get('stars', 'N/A')}")
                lines.append(f"- GitHub Forks: {dev.get('forks', 'N/A')}")
                lines.append(f"- Commits (4 weeks): {dev.get('commit_count_4_weeks', 'N/A')}")

        # DefiLlama data
        dl = data.get("defillama", {})
        if dl:
            lines.append("\n## DeFi Data (DefiLlama)")
            if dl.get("tvl"):
                lines.append(f"- Total Value Locked: ${dl.get('tvl', 'N/A'):,.0f}" if isinstance(dl.get('tvl'), (int, float)) else f"- TVL: {dl.get('tvl', 'N/A')}")
            if dl.get("chain_tvl"):
                lines.append(f"- Chain TVL: ${dl.get('chain_tvl', 'N/A'):,.0f}" if isinstance(dl.get('chain_tvl'), (int, float)) else f"- Chain TVL: {dl.get('chain_tvl', 'N/A')}")
            if dl.get("category"):
                lines.append(f"- Category: {dl.get('category', 'N/A')}")
            if dl.get("tvl_change_1d"):
                lines.append(f"- TVL Change 1d: {dl.get('tvl_change_1d', 'N/A')}%")
            if dl.get("tvl_change_7d"):
                lines.append(f"- TVL Change 7d: {dl.get('tvl_change_7d', 'N/A')}%")

        # GitHub data
        gh = data.get("github", {})
        if gh and gh.get("repo_name"):
            lines.append("\n## GitHub Activity")
            lines.append(f"- Repository: {gh.get('repo_name', 'N/A')}")
            lines.append(f"- Stars: {gh.get('stars', 'N/A')}")
            lines.append(f"- Forks: {gh.get('forks', 'N/A')}")
            lines.append(f"- Contributors: {gh.get('contributors', 'N/A')}")
            lines.append(f"- Commits (4 weeks): {gh.get('commits_4_weeks', 'N/A')}")

        # Dune on-chain data
        dune = data.get("dune", {})
        if dune:
            lines.append("\n## On-Chain Data (Dune Analytics)")
            if dune.get("holder_count"):
                lines.append(f"- Holder Count: {dune.get('holder_count', 'N/A'):,}")
            if dune.get("top_10_percent"):
                lines.append(f"- Top 10 Holders: {dune.get('top_10_percent', 'N/A'):.1f}%")
            if dune.get("active_addresses_7d"):
                lines.append(f"- Active Addresses (7d): {dune.get('active_addresses_7d', 'N/A'):,}")

        # Perplexity research
        perplexity = data.get("perplexity", {})
        if perplexity:
            team_research = perplexity.get("team", {})
            if team_research.get("content"):
                lines.append("\n## Team Research (Web Sources)")
                lines.append(team_research.get("content", "")[:2000])

            news_research = perplexity.get("news", {})
            if news_research.get("content"):
                lines.append("\n## Recent News & Developments")
                lines.append(news_research.get("content", "")[:2000])

        return "\n".join(lines)

    def _get_fallback_analysis(self, ticker: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Return fallback analysis when AI is unavailable."""
        cg = data.get("coingecko", {})
        price = cg.get("current_price", 0) or 0
        market_cap = cg.get("market_cap", 0) or 0

        return {
            "executive_summary": f"{ticker} is a cryptocurrency asset. Analysis unavailable - AI synthesis disabled.",
            "investment_rating": "NEUTRAL",
            "target_price": f"${price * 1.2:.2f}" if price else "N/A",
            "upside_percent": "+20%",
            "time_horizon": "6-12 months",
            "scoreboard_note": "Automated analysis unavailable. Review metrics manually.",
            "mom_price_action": "Price data available in scoreboard section.",
            "mom_tvl": "TVL data available if applicable.",
            "mom_volume": "Volume metrics shown above.",
            "mom_community": "Community data from CoinGecko.",
            "mom_dev_activity": "Development metrics from GitHub.",
            "mom_strategic": "Review project announcements manually.",
            "holder_commentary": "Token distribution data requires manual analysis.",
            "competitive_commentary": "<p>Competitive analysis unavailable. Compare with similar projects manually.</p>",
            "strategy_left": "<p>Business model analysis requires AI synthesis.</p>",
            "strategy_right": "<p>Growth strategy analysis requires AI synthesis.</p>",
            "rate_cut_impact": "Crypto assets typically benefit from looser monetary policy.",
            "rate_sensitivity_note": "Monitor Fed policy decisions for potential price impact.",
            "swot_strengths": ["Data available for manual review", "Market presence established"],
            "swot_opportunities": ["Market conditions to be analyzed", "Growth potential exists"],
            "swot_weaknesses": ["Automated analysis unavailable", "Manual review required"],
            "swot_threats": ["Market volatility", "Regulatory uncertainty"],
            "catalysts": [
                {"quarter": "Q1", "title": "Review Roadmap", "description": "Check project announcements"},
                {"quarter": "Q2", "title": "Monitor Development", "description": "Track GitHub activity"},
            ],
            "catalyst_commentary": "Review project roadmap and announcements for upcoming catalysts.",
            "verdict_analysis": f"<p>{ticker} requires manual analysis. AI synthesis is currently unavailable.</p><p>Review the quantitative data provided and conduct independent research.</p>",
            "overall_score": 50,

            # New fields
            "team_analysis": "<p>Team research requires AI synthesis. Review web sources manually.</p>",
            "team_doxxed": "Unknown",
            "team_experience": "Review project background",
            "team_score": 50,
            "team_badges": [],

            "product_status": "unknown",
            "product_analysis": "<p>Product analysis requires AI synthesis.</p>",

            "risk_analysis": "<p>Risk assessment requires AI synthesis. Conduct independent due diligence.</p>",
            "key_risks": ["Market volatility", "Regulatory uncertainty", "Competition", "Technology risk"],
            "overall_risk": "Medium",
            "regulatory_risk": "Medium",
            "technical_risk": "Medium",
            "market_risk": "Medium",

            "recent_news": "<p>Check project announcements and crypto news for latest updates.</p>",

            # Category scores
            "score_team": 5,
            "score_product": 5,
            "score_dev": 5,
            "score_market": 5,
            "score_competition": 5,
            "score_sentiment": 5,
            "score_tokenomics": 5,
            "score_decentral": 5,

            # Team details
            "team_size": "Unknown",
            "key_members": "Research team backgrounds",
            "previous_projects": "N/A",

            # Competition
            "competitors": [],
            "advantages": ["Review competitive advantages"],
            "disadvantages": ["Review competitive weaknesses"],
            "competitive_moat": "Analyze competitive positioning and market defensibility.",

            # Investment signals
            "bullish_catalysts": ["Market growth potential", "Technology development"],
            "bearish_concerns": ["Market volatility", "Regulatory uncertainty"],
        }


# Singleton
_ai_service: Optional[AISynthesisService] = None


def get_ai_synthesis_service() -> AISynthesisService:
    """Get or create AI synthesis service singleton."""
    global _ai_service
    if _ai_service is None:
        _ai_service = AISynthesisService()
    return _ai_service
