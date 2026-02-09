"""
Crypto Project Analysis Service.

Provides comprehensive investment analysis for crypto projects using:
- Perplexity API for web research
- CoinGecko for token/market data
- LLM for synthesis and report generation

Analysis covers:
- Team & founders (doxxed, experience, track record)
- Product status (testnet, mainnet, production)
- Market & niche analysis
- Competition landscape
- Community sentiment
- Risk assessment
- Investment recommendation
"""
import httpx
import json
from datetime import datetime, timezone
from typing import Optional, Dict, List, Any
from dataclasses import dataclass, field, asdict
from loguru import logger

from config import settings


@dataclass
class TeamAnalysis:
    """Team/founders analysis."""
    founders_known: bool = False
    founders_doxxed: bool = False
    team_size: Optional[str] = None
    key_members: List[str] = field(default_factory=list)
    previous_projects: List[str] = field(default_factory=list)
    linkedin_profiles: bool = False
    experience_score: int = 0  # 0-10
    notes: str = ""


@dataclass
class ProductAnalysis:
    """Product/technology analysis."""
    status: str = "unknown"  # idea, whitepaper, testnet, mainnet, production
    has_working_product: bool = False
    github_activity: str = "unknown"  # active, moderate, low, none
    tech_stack: List[str] = field(default_factory=list)
    unique_features: List[str] = field(default_factory=list)
    audited: bool = False
    audit_firms: List[str] = field(default_factory=list)
    product_score: int = 0  # 0-10
    notes: str = ""


@dataclass
class MarketAnalysis:
    """Market & niche analysis."""
    niche: str = ""
    niche_description: str = ""
    market_size: str = ""
    growth_potential: str = ""  # high, medium, low
    timing: str = ""  # early, growth, mature, declining
    target_audience: str = ""
    use_cases: List[str] = field(default_factory=list)
    market_score: int = 0  # 0-10
    notes: str = ""


@dataclass
class CompetitionAnalysis:
    """Competition landscape."""
    main_competitors: List[Dict[str, str]] = field(default_factory=list)
    competitive_advantages: List[str] = field(default_factory=list)
    competitive_disadvantages: List[str] = field(default_factory=list)
    market_position: str = ""  # leader, challenger, follower, niche
    moat: str = ""  # What makes it defensible
    competition_score: int = 0  # 0-10 (higher = less competition threat)
    notes: str = ""


@dataclass
class SentimentAnalysis:
    """Community & market sentiment."""
    twitter_followers: Optional[int] = None
    twitter_engagement: str = "unknown"  # high, medium, low
    discord_members: Optional[int] = None
    telegram_members: Optional[int] = None
    community_activity: str = "unknown"  # very active, active, moderate, low
    recent_news_sentiment: str = "neutral"  # positive, neutral, negative
    influencer_mentions: str = ""
    controversy: bool = False
    controversy_details: str = ""
    sentiment_score: int = 0  # 0-10
    notes: str = ""


@dataclass
class TokenomicsAnalysis:
    """Tokenomics analysis."""
    total_supply: Optional[str] = None
    circulating_supply: Optional[str] = None
    market_cap: Optional[str] = None
    fdv: Optional[str] = None  # Fully diluted valuation
    token_utility: List[str] = field(default_factory=list)
    vesting_schedule: str = ""
    team_allocation: Optional[str] = None
    investor_allocation: Optional[str] = None
    unlock_schedule: str = ""
    inflation_rate: Optional[str] = None
    tokenomics_score: int = 0  # 0-10
    notes: str = ""


@dataclass
class RiskAnalysis:
    """Risk assessment."""
    regulatory_risk: str = "medium"  # high, medium, low
    technical_risk: str = "medium"
    market_risk: str = "medium"
    team_risk: str = "medium"
    competition_risk: str = "medium"
    liquidity_risk: str = "medium"
    smart_contract_risk: str = "medium"
    key_risks: List[str] = field(default_factory=list)
    risk_mitigations: List[str] = field(default_factory=list)
    overall_risk: str = "medium"  # high, medium, low
    notes: str = ""


@dataclass
class InvestmentRecommendation:
    """Final investment recommendation."""
    recommendation: str = "NEUTRAL"  # STRONG_BUY, BUY, NEUTRAL, AVOID, STRONG_AVOID
    confidence: int = 50  # 0-100%
    time_horizon: str = ""  # short-term, medium-term, long-term
    entry_strategy: str = ""
    position_size_suggestion: str = ""  # small, medium, large
    key_catalysts: List[str] = field(default_factory=list)
    key_concerns: List[str] = field(default_factory=list)
    price_targets: Dict[str, str] = field(default_factory=dict)
    summary: str = ""


@dataclass
class ProjectReport:
    """Complete project analysis report."""
    ticker: str
    name: str
    website: Optional[str] = None
    analyzed_at: str = ""

    # Basic info
    description: str = ""
    category: str = ""
    blockchain: str = ""
    launch_date: Optional[str] = None

    # Analysis sections
    team: TeamAnalysis = field(default_factory=TeamAnalysis)
    product: ProductAnalysis = field(default_factory=ProductAnalysis)
    market: MarketAnalysis = field(default_factory=MarketAnalysis)
    competition: CompetitionAnalysis = field(default_factory=CompetitionAnalysis)
    sentiment: SentimentAnalysis = field(default_factory=SentimentAnalysis)
    tokenomics: TokenomicsAnalysis = field(default_factory=TokenomicsAnalysis)
    risk: RiskAnalysis = field(default_factory=RiskAnalysis)

    # Final recommendation
    recommendation: InvestmentRecommendation = field(default_factory=InvestmentRecommendation)

    # Overall scores
    overall_score: int = 0  # 0-100

    # Raw research data
    research_sources: List[str] = field(default_factory=list)


class ProjectAnalysisService:
    """
    Service for comprehensive crypto project analysis.

    Uses Perplexity for research and Claude for synthesis.
    """

    PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions"
    COINGECKO_URL = "https://api.coingecko.com/api/v3"
    OPENAI_URL = "https://api.openai.com/v1/chat/completions"

    def __init__(self):
        self.perplexity_key = getattr(settings, 'perplexity_api_key', None)
        self.openrouter_key = getattr(settings, 'openrouter_api_key', None)
        self.openai_key = getattr(settings, 'openai_api_key', None)

    async def search_perplexity(self, query: str, focus: str = "internet") -> dict:
        """
        Search using Perplexity API.

        Args:
            query: Search query
            focus: Search focus (internet, academic, news, etc.)

        Returns:
            Search results with citations
        """
        if not self.perplexity_key:
            logger.warning("Perplexity API key not configured")
            return {"error": "Perplexity API key not configured", "content": ""}

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.post(
                    self.PERPLEXITY_URL,
                    headers={
                        "Authorization": f"Bearer {self.perplexity_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "llama-3.1-sonar-large-128k-online",
                        "messages": [
                            {
                                "role": "system",
                                "content": "You are a crypto research analyst. Provide detailed, factual information with sources. Focus on verifiable facts and recent news."
                            },
                            {
                                "role": "user",
                                "content": query
                            }
                        ],
                        "temperature": 0.2,
                        "return_citations": True,
                    }
                )
                response.raise_for_status()
                data = response.json()

                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                citations = data.get("citations", [])

                return {
                    "content": content,
                    "citations": citations,
                }
        except Exception as e:
            logger.error(f"Perplexity search error: {e}")
            return {"error": str(e), "content": ""}

    async def get_coingecko_data(self, ticker: str) -> dict:
        """
        Fetch token data from CoinGecko.
        """
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                # First, search for the coin
                search_response = await client.get(
                    f"{self.COINGECKO_URL}/search",
                    params={"query": ticker}
                )
                search_data = search_response.json()

                coins = search_data.get("coins", [])
                if not coins:
                    return {"error": "Token not found on CoinGecko"}

                # Get the first match
                coin_id = coins[0].get("id")

                # Fetch detailed data
                coin_response = await client.get(
                    f"{self.COINGECKO_URL}/coins/{coin_id}",
                    params={
                        "localization": "false",
                        "tickers": "false",
                        "market_data": "true",
                        "community_data": "true",
                        "developer_data": "true",
                    }
                )
                coin_data = coin_response.json()

                return {
                    "id": coin_id,
                    "name": coin_data.get("name"),
                    "symbol": coin_data.get("symbol", "").upper(),
                    "description": coin_data.get("description", {}).get("en", ""),
                    "website": coin_data.get("links", {}).get("homepage", [None])[0],
                    "blockchain": coin_data.get("asset_platform_id") or coin_data.get("categories", [""])[0],
                    "categories": coin_data.get("categories", []),
                    "market_data": {
                        "current_price": coin_data.get("market_data", {}).get("current_price", {}).get("usd"),
                        "market_cap": coin_data.get("market_data", {}).get("market_cap", {}).get("usd"),
                        "total_volume": coin_data.get("market_data", {}).get("total_volume", {}).get("usd"),
                        "circulating_supply": coin_data.get("market_data", {}).get("circulating_supply"),
                        "total_supply": coin_data.get("market_data", {}).get("total_supply"),
                        "max_supply": coin_data.get("market_data", {}).get("max_supply"),
                        "ath": coin_data.get("market_data", {}).get("ath", {}).get("usd"),
                        "ath_change_percentage": coin_data.get("market_data", {}).get("ath_change_percentage", {}).get("usd"),
                        "price_change_24h": coin_data.get("market_data", {}).get("price_change_percentage_24h"),
                        "price_change_7d": coin_data.get("market_data", {}).get("price_change_percentage_7d"),
                        "price_change_30d": coin_data.get("market_data", {}).get("price_change_percentage_30d"),
                    },
                    "community_data": {
                        "twitter_followers": coin_data.get("community_data", {}).get("twitter_followers"),
                        "telegram_users": coin_data.get("community_data", {}).get("telegram_channel_user_count"),
                        "reddit_subscribers": coin_data.get("community_data", {}).get("reddit_subscribers"),
                    },
                    "developer_data": {
                        "github_repos": coin_data.get("links", {}).get("repos_url", {}).get("github", []),
                        "stars": coin_data.get("developer_data", {}).get("stars"),
                        "forks": coin_data.get("developer_data", {}).get("forks"),
                        "subscribers": coin_data.get("developer_data", {}).get("subscribers"),
                        "commit_count_4_weeks": coin_data.get("developer_data", {}).get("commit_count_4_weeks"),
                    },
                    "genesis_date": coin_data.get("genesis_date"),
                    "sentiment_votes_up": coin_data.get("sentiment_votes_up_percentage"),
                    "sentiment_votes_down": coin_data.get("sentiment_votes_down_percentage"),
                }
        except Exception as e:
            logger.error(f"CoinGecko API error: {e}")
            return {"error": str(e)}

    async def research_project(self, ticker: str, website: str = None) -> dict:
        """
        Conduct comprehensive research on a crypto project.

        Args:
            ticker: Token ticker symbol (e.g., "SOL", "ETH")
            website: Optional project website URL

        Returns:
            Raw research data from multiple sources
        """
        research = {
            "ticker": ticker.upper(),
            "website": website,
            "coingecko": {},
            "team_research": {},
            "product_research": {},
            "competition_research": {},
            "sentiment_research": {},
            "news_research": {},
        }

        # 1. Get CoinGecko data
        logger.info(f"Fetching CoinGecko data for {ticker}")
        research["coingecko"] = await self.get_coingecko_data(ticker)

        project_name = research["coingecko"].get("name", ticker)

        # 2. Research team/founders
        logger.info(f"Researching team for {project_name}")
        team_query = f"""
        Research the team and founders of {project_name} ({ticker}) cryptocurrency project:
        1. Who are the founders and key team members?
        2. Are they doxxed (publicly known identities)?
        3. What is their background and previous experience?
        4. Have they worked on other crypto projects?
        5. Do they have LinkedIn profiles or public presence?
        Provide specific names and verifiable information.
        """
        research["team_research"] = await self.search_perplexity(team_query)

        # 3. Research product/technology
        logger.info(f"Researching product for {project_name}")
        product_query = f"""
        Analyze the product and technology of {project_name} ({ticker}):
        1. What is the current product status? (testnet, mainnet, production)
        2. Is there a working product users can use?
        3. What is unique about their technology?
        4. How active is their GitHub development?
        5. Has the code been audited? By whom?
        6. What blockchain/technology stack do they use?
        Focus on verifiable technical facts.
        """
        research["product_research"] = await self.search_perplexity(product_query)

        # 4. Research competition
        logger.info(f"Researching competition for {project_name}")
        competition_query = f"""
        Analyze the competitive landscape for {project_name} ({ticker}):
        1. What niche/category does this project operate in?
        2. Who are the main competitors?
        3. What are their competitive advantages vs competitors?
        4. What are their weaknesses compared to competitors?
        5. What is their market positioning?
        Compare with specific competing projects.
        """
        research["competition_research"] = await self.search_perplexity(competition_query)

        # 5. Research sentiment
        logger.info(f"Researching sentiment for {project_name}")
        sentiment_query = f"""
        Analyze the community and market sentiment for {project_name} ({ticker}):
        1. What is the general sentiment on Twitter/X?
        2. How active is the community (Discord, Telegram)?
        3. Have any major influencers mentioned this project?
        4. Are there any controversies or red flags?
        5. What are people saying about the project recently?
        Include specific examples and recent discussions.
        """
        research["sentiment_research"] = await self.search_perplexity(sentiment_query)

        # 6. Recent news
        logger.info(f"Researching recent news for {project_name}")
        news_query = f"""
        What are the most recent news and developments for {project_name} ({ticker}) in the last 30 days?
        Include:
        1. Partnership announcements
        2. Product updates or launches
        3. Token unlocks or tokenomics changes
        4. Regulatory news
        5. Any significant events
        Focus on verified, recent news from the last month.
        """
        research["news_research"] = await self.search_perplexity(news_query)

        return research

    async def generate_report(self, research: dict) -> ProjectReport:
        """
        Generate a structured investment report from research data.

        Uses LLM to synthesize research into structured analysis.
        """
        ticker = research.get("ticker", "UNKNOWN")
        coingecko = research.get("coingecko", {})

        # Create base report
        report = ProjectReport(
            ticker=ticker,
            name=coingecko.get("name", ticker),
            website=coingecko.get("website") or research.get("website"),
            analyzed_at=datetime.now(timezone.utc).isoformat(),
            description=coingecko.get("description", "")[:500],
            category=", ".join(coingecko.get("categories", [])[:3]),
            blockchain=coingecko.get("blockchain", ""),
            launch_date=coingecko.get("genesis_date"),
        )

        # Fill in tokenomics from CoinGecko
        market_data = coingecko.get("market_data", {})
        report.tokenomics = TokenomicsAnalysis(
            total_supply=self._format_number(market_data.get("total_supply")),
            circulating_supply=self._format_number(market_data.get("circulating_supply")),
            market_cap=self._format_currency(market_data.get("market_cap")),
            fdv=self._format_currency(
                market_data.get("current_price", 0) * (market_data.get("total_supply") or 0)
            ) if market_data.get("current_price") else None,
        )

        # Fill in sentiment from CoinGecko
        community = coingecko.get("community_data", {})
        report.sentiment = SentimentAnalysis(
            twitter_followers=community.get("twitter_followers"),
            telegram_members=community.get("telegram_users"),
        )

        # Use LLM to analyze research and fill structured report
        if self.openrouter_key or self.openai_key:
            report = await self._analyze_with_llm(report, research)

        # Calculate overall score
        report.overall_score = self._calculate_overall_score(report)

        # Collect sources
        for key in ["team_research", "product_research", "competition_research", "sentiment_research", "news_research"]:
            citations = research.get(key, {}).get("citations", [])
            report.research_sources.extend(citations)

        return report

    async def _analyze_with_llm(self, report: ProjectReport, research: dict) -> ProjectReport:
        """Use LLM to analyze research and update report."""
        try:
            # Prepare research summary for LLM
            research_text = f"""
            PROJECT: {report.name} ({report.ticker})

            TEAM RESEARCH:
            {research.get('team_research', {}).get('content', 'No data')}

            PRODUCT RESEARCH:
            {research.get('product_research', {}).get('content', 'No data')}

            COMPETITION RESEARCH:
            {research.get('competition_research', {}).get('content', 'No data')}

            SENTIMENT RESEARCH:
            {research.get('sentiment_research', {}).get('content', 'No data')}

            RECENT NEWS:
            {research.get('news_research', {}).get('content', 'No data')}

            MARKET DATA:
            {json.dumps(research.get('coingecko', {}).get('market_data', {}), indent=2)}
            """

            analysis_prompt = f"""
            You are a senior crypto investment analyst. Analyze this research and provide a structured investment analysis.

            {research_text}

            Provide your analysis in the following JSON format:
            {{
                "team": {{
                    "founders_known": true/false,
                    "founders_doxxed": true/false,
                    "team_size": "estimated size",
                    "key_members": ["name1", "name2"],
                    "previous_projects": ["project1", "project2"],
                    "experience_score": 0-10,
                    "notes": "key observations"
                }},
                "product": {{
                    "status": "idea/whitepaper/testnet/mainnet/production",
                    "has_working_product": true/false,
                    "github_activity": "active/moderate/low/none",
                    "unique_features": ["feature1", "feature2"],
                    "audited": true/false,
                    "product_score": 0-10,
                    "notes": "key observations"
                }},
                "market": {{
                    "niche": "category name",
                    "niche_description": "brief description",
                    "market_size": "estimated size",
                    "growth_potential": "high/medium/low",
                    "timing": "early/growth/mature/declining",
                    "use_cases": ["use case 1", "use case 2"],
                    "market_score": 0-10,
                    "notes": "key observations"
                }},
                "competition": {{
                    "main_competitors": [{{"name": "Competitor1", "comparison": "how they compare"}}],
                    "competitive_advantages": ["advantage1", "advantage2"],
                    "competitive_disadvantages": ["disadvantage1"],
                    "market_position": "leader/challenger/follower/niche",
                    "moat": "what makes it defensible",
                    "competition_score": 0-10,
                    "notes": "key observations"
                }},
                "sentiment": {{
                    "community_activity": "very active/active/moderate/low",
                    "recent_news_sentiment": "positive/neutral/negative",
                    "controversy": true/false,
                    "controversy_details": "if any",
                    "sentiment_score": 0-10,
                    "notes": "key observations"
                }},
                "risk": {{
                    "regulatory_risk": "high/medium/low",
                    "technical_risk": "high/medium/low",
                    "team_risk": "high/medium/low",
                    "competition_risk": "high/medium/low",
                    "key_risks": ["risk1", "risk2"],
                    "overall_risk": "high/medium/low",
                    "notes": "key observations"
                }},
                "recommendation": {{
                    "recommendation": "STRONG_BUY/BUY/NEUTRAL/AVOID/STRONG_AVOID",
                    "confidence": 0-100,
                    "time_horizon": "short-term/medium-term/long-term",
                    "position_size_suggestion": "small/medium/large",
                    "key_catalysts": ["catalyst1", "catalyst2"],
                    "key_concerns": ["concern1", "concern2"],
                    "summary": "2-3 sentence investment thesis"
                }}
            }}

            Be objective, critical, and focus on verifiable facts. If information is uncertain, note it.
            Return ONLY valid JSON, no markdown or extra text.
            """

            async with httpx.AsyncClient(timeout=120) as client:
                # Choose API: prefer OpenRouter, fallback to OpenAI
                if self.openrouter_key:
                    url = "https://openrouter.ai/api/v1/chat/completions"
                    headers = {
                        "Authorization": f"Bearer {self.openrouter_key}",
                        "Content-Type": "application/json",
                    }
                    model = "anthropic/claude-3.5-sonnet"
                else:
                    url = self.OPENAI_URL
                    headers = {
                        "Authorization": f"Bearer {self.openai_key}",
                        "Content-Type": "application/json",
                    }
                    model = "gpt-4o"  # Use GPT-4o for best quality

                response = await client.post(
                    url,
                    headers=headers,
                    json={
                        "model": model,
                        "messages": [
                            {"role": "user", "content": analysis_prompt}
                        ],
                        "temperature": 0.3,
                    }
                )
                response.raise_for_status()
                data = response.json()

                content = data.get("choices", [{}])[0].get("message", {}).get("content", "{}")

                # Parse JSON response
                # Clean up potential markdown formatting
                content = content.strip()
                if content.startswith("```json"):
                    content = content[7:]
                if content.startswith("```"):
                    content = content[3:]
                if content.endswith("```"):
                    content = content[:-3]

                analysis = json.loads(content)

                # Update report with analysis
                if "team" in analysis:
                    for key, value in analysis["team"].items():
                        if hasattr(report.team, key):
                            setattr(report.team, key, value)

                if "product" in analysis:
                    for key, value in analysis["product"].items():
                        if hasattr(report.product, key):
                            setattr(report.product, key, value)

                if "market" in analysis:
                    for key, value in analysis["market"].items():
                        if hasattr(report.market, key):
                            setattr(report.market, key, value)

                if "competition" in analysis:
                    for key, value in analysis["competition"].items():
                        if hasattr(report.competition, key):
                            setattr(report.competition, key, value)

                if "sentiment" in analysis:
                    for key, value in analysis["sentiment"].items():
                        if hasattr(report.sentiment, key):
                            setattr(report.sentiment, key, value)

                if "risk" in analysis:
                    for key, value in analysis["risk"].items():
                        if hasattr(report.risk, key):
                            setattr(report.risk, key, value)

                if "recommendation" in analysis:
                    for key, value in analysis["recommendation"].items():
                        if hasattr(report.recommendation, key):
                            setattr(report.recommendation, key, value)

        except Exception as e:
            logger.error(f"LLM analysis error: {e}")
            report.recommendation.notes = f"LLM analysis failed: {str(e)}"

        return report

    def _calculate_overall_score(self, report: ProjectReport) -> int:
        """Calculate overall investment score (0-100)."""
        weights = {
            "team": 0.20,
            "product": 0.25,
            "market": 0.15,
            "competition": 0.10,
            "sentiment": 0.10,
            "tokenomics": 0.10,
            "risk_inverse": 0.10,  # Lower risk = higher score
        }

        scores = {
            "team": report.team.experience_score,
            "product": report.product.product_score,
            "market": report.market.market_score,
            "competition": report.competition.competition_score,
            "sentiment": report.sentiment.sentiment_score,
            "tokenomics": report.tokenomics.tokenomics_score,
        }

        # Convert risk to inverse score
        risk_map = {"low": 8, "medium": 5, "high": 2}
        risk_score = risk_map.get(report.risk.overall_risk.lower(), 5)
        scores["risk_inverse"] = risk_score

        # Calculate weighted average
        total = sum(scores.get(k, 0) * w for k, w in weights.items())

        # Scale to 0-100
        return int(total * 10)

    def _format_number(self, value) -> Optional[str]:
        """Format large numbers."""
        if value is None:
            return None
        if value >= 1_000_000_000:
            return f"{value / 1_000_000_000:.2f}B"
        if value >= 1_000_000:
            return f"{value / 1_000_000:.2f}M"
        if value >= 1_000:
            return f"{value / 1_000:.2f}K"
        return str(value)

    def _format_currency(self, value) -> Optional[str]:
        """Format currency values."""
        if value is None:
            return None
        if value >= 1_000_000_000:
            return f"${value / 1_000_000_000:.2f}B"
        if value >= 1_000_000:
            return f"${value / 1_000_000:.2f}M"
        if value >= 1_000:
            return f"${value / 1_000:.2f}K"
        return f"${value:.2f}"

    async def analyze_project(self, ticker: str = None, website: str = None) -> ProjectReport:
        """
        Main entry point for project analysis.

        Args:
            ticker: Token ticker symbol (e.g., "SOL")
            website: Project website URL (optional)

        Returns:
            Complete ProjectReport with investment analysis
        """
        if not ticker and not website:
            raise ValueError("Either ticker or website must be provided")

        # If only website provided, try to extract ticker
        if not ticker and website:
            # TODO: Extract ticker from website
            ticker = "UNKNOWN"

        logger.info(f"Starting analysis for {ticker}")

        # Conduct research
        research = await self.research_project(ticker, website)

        # Generate report
        report = await self.generate_report(research)

        logger.info(f"Analysis complete for {ticker}: Score {report.overall_score}/100")

        return report

    def report_to_dict(self, report: ProjectReport) -> dict:
        """Convert report to dictionary for JSON serialization."""
        return asdict(report)


# Singleton instance
_analysis_service: Optional[ProjectAnalysisService] = None


def get_project_analysis_service() -> ProjectAnalysisService:
    """Get or create ProjectAnalysisService singleton."""
    global _analysis_service
    if _analysis_service is None:
        _analysis_service = ProjectAnalysisService()
    return _analysis_service
