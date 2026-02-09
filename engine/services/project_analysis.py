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
import asyncio
from datetime import datetime, timezone
from typing import Optional, Dict, List, Any
from dataclasses import dataclass, field, asdict
from loguru import logger

from config import settings
from services.defillama_service import get_defillama_service, DefiLlamaData
from services.github_service import get_github_service, GitHubData
from services.dune_service import get_dune_service, DuneData


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
class DefiMetrics:
    """DeFi protocol metrics from DefiLlama."""
    tvl: Optional[float] = None
    tvl_formatted: Optional[str] = None
    tvl_change_1d: Optional[float] = None
    tvl_change_7d: Optional[float] = None
    tvl_change_30d: Optional[float] = None
    mcap_tvl_ratio: Optional[float] = None
    category: Optional[str] = None
    chains: List[str] = field(default_factory=list)
    protocol_url: Optional[str] = None


@dataclass
class DevelopmentActivity:
    """GitHub development metrics."""
    github_url: Optional[str] = None
    stars: int = 0
    forks: int = 0
    watchers: int = 0
    contributors: int = 0
    open_issues: int = 0
    last_commit_date: Optional[str] = None
    commits_last_30d: int = 0
    commits_last_year: int = 0
    created_at: Optional[str] = None
    primary_language: Optional[str] = None
    license: Optional[str] = None
    is_archived: bool = False
    activity_score: int = 0  # 0-10


@dataclass
class OnChainMetrics:
    """On-chain metrics from Dune Analytics."""
    token_address: Optional[str] = None
    chain: Optional[str] = None
    holder_count: Optional[int] = None
    top_10_holder_percent: Optional[float] = None
    top_100_holder_percent: Optional[float] = None
    active_addresses_7d: Optional[int] = None
    active_addresses_30d: Optional[int] = None
    transfer_count_7d: Optional[int] = None
    decentralization_score: int = 0  # 0-10


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

    # Additional data sources
    defi_metrics: DefiMetrics = field(default_factory=DefiMetrics)
    development: DevelopmentActivity = field(default_factory=DevelopmentActivity)
    onchain: OnChainMetrics = field(default_factory=OnChainMetrics)

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
        self.n8n_webhook_analyze = getattr(settings, 'n8n_webhook_analyze', None)
        self.n8n_webhook_alert = getattr(settings, 'n8n_webhook_alert', None)

        # Additional data services
        self.defillama = get_defillama_service()
        self.github = get_github_service()
        self.dune = get_dune_service()

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
                        "model": "sonar",
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

                # Prefer exact symbol match (case-insensitive)
                ticker_upper = ticker.upper()
                coin_id = None
                for coin in coins:
                    if coin.get("symbol", "").upper() == ticker_upper:
                        coin_id = coin.get("id")
                        break

                # Fallback to first result if no exact match
                if not coin_id:
                    coin_id = coins[0].get("id")
                    logger.warning(f"No exact symbol match for {ticker}, using first result: {coin_id}")

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
                    "links": coin_data.get("links", {}),
                    "contract_address": coin_data.get("contract_address"),
                    "asset_platform_id": coin_data.get("asset_platform_id"),
                }
        except Exception as e:
            logger.error(f"CoinGecko API error: {e}")
            return {"error": str(e)}

    async def get_defillama_data(self, name: str) -> Optional[DefiLlamaData]:
        """Fetch DeFi protocol data from DefiLlama."""
        try:
            data = await self.defillama.get_protocol_by_name(name)
            if data:
                logger.info(f"DefiLlama data found for {name}: TVL=${data.tvl:,.0f}" if data.tvl else f"DefiLlama data found for {name}")
            return data
        except Exception as e:
            logger.error(f"DefiLlama fetch error: {e}")
            return None

    async def get_github_data(self, links: dict) -> Optional[GitHubData]:
        """Fetch GitHub repository data from CoinGecko links."""
        try:
            data = await self.github.get_repo_from_links(links)
            if data:
                logger.info(f"GitHub data found: {data.owner}/{data.repo_name} - {data.stars} stars")
            return data
        except Exception as e:
            logger.error(f"GitHub fetch error: {e}")
            return None

    async def get_dune_data(self, contract_address: str, chain: str = "ethereum") -> Optional[DuneData]:
        """Fetch on-chain data from Dune Analytics."""
        if not self.dune.is_configured():
            logger.debug("Dune Analytics not configured, skipping")
            return None

        try:
            data = await self.dune.get_token_data(contract_address, chain)
            if data and data.holder_count:
                logger.info(f"Dune data found: {data.holder_count} holders")
            return data
        except Exception as e:
            logger.error(f"Dune fetch error: {e}")
            return None

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
            "defillama": None,
            "github": None,
            "dune": None,
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

        # 2. Fetch additional data sources in parallel
        logger.info(f"Fetching DefiLlama, GitHub, and Dune data for {project_name}")
        additional_tasks = []

        # DefiLlama
        additional_tasks.append(self.get_defillama_data(project_name))

        # GitHub (from CoinGecko links)
        links = research["coingecko"].get("links", {})
        additional_tasks.append(self.get_github_data(links))

        # Dune (if contract address available)
        contract_address = research["coingecko"].get("contract_address")
        chain = research["coingecko"].get("asset_platform_id", "ethereum")
        if contract_address:
            additional_tasks.append(self.get_dune_data(contract_address, chain))
        else:
            async def return_none():
                return None
            additional_tasks.append(return_none())

        # Run all additional data fetches in parallel
        additional_results = await asyncio.gather(*additional_tasks, return_exceptions=True)

        # Process results
        if not isinstance(additional_results[0], Exception):
            research["defillama"] = additional_results[0]
        if not isinstance(additional_results[1], Exception):
            research["github"] = additional_results[1]
        if len(additional_results) > 2 and not isinstance(additional_results[2], Exception):
            research["dune"] = additional_results[2]

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

        # Calculate tokenomics score based on available data
        report.tokenomics.tokenomics_score = self._calculate_tokenomics_score(market_data)

        # Fill in sentiment from CoinGecko
        community = coingecko.get("community_data", {})
        report.sentiment = SentimentAnalysis(
            twitter_followers=community.get("twitter_followers"),
            telegram_members=community.get("telegram_users"),
        )

        # Fill in DeFi metrics from DefiLlama
        defillama_data: Optional[DefiLlamaData] = research.get("defillama")
        if defillama_data:
            report.defi_metrics = DefiMetrics(
                tvl=defillama_data.tvl,
                tvl_formatted=self._format_currency(defillama_data.tvl),
                tvl_change_1d=defillama_data.tvl_change_1d,
                tvl_change_7d=defillama_data.tvl_change_7d,
                tvl_change_30d=defillama_data.tvl_change_30d,
                mcap_tvl_ratio=defillama_data.mcap_tvl_ratio,
                category=defillama_data.category,
                chains=defillama_data.chains or [],
                protocol_url=defillama_data.url,
            )

        # Fill in development activity from GitHub
        github_data: Optional[GitHubData] = research.get("github")
        if github_data:
            report.development = DevelopmentActivity(
                github_url=github_data.repo_url,
                stars=github_data.stars,
                forks=github_data.forks,
                watchers=github_data.watchers,
                contributors=github_data.contributors_count,
                open_issues=github_data.open_issues,
                last_commit_date=github_data.last_commit_date,
                commits_last_30d=github_data.commits_last_30d,
                commits_last_year=github_data.commits_last_year,
                created_at=github_data.created_at,
                primary_language=github_data.language,
                license=github_data.license,
                is_archived=github_data.is_archived,
                activity_score=self._calculate_github_score(github_data),
            )

        # Fill in on-chain metrics from Dune
        dune_data: Optional[DuneData] = research.get("dune")
        if dune_data:
            report.onchain = OnChainMetrics(
                token_address=dune_data.token_address,
                chain=dune_data.chain,
                holder_count=dune_data.holder_count,
                top_10_holder_percent=dune_data.top_10_holder_percent,
                top_100_holder_percent=dune_data.top_100_holder_percent,
                active_addresses_7d=dune_data.active_addresses_7d,
                active_addresses_30d=dune_data.active_addresses_30d,
                transfer_count_7d=dune_data.transfer_count_7d,
                decentralization_score=self._calculate_decentralization_score(dune_data),
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

    def _calculate_tokenomics_score(self, market_data: dict) -> int:
        """Calculate tokenomics score based on market data (0-10)."""
        score = 5  # Base score

        # Market cap scoring (larger = more established)
        market_cap = market_data.get("market_cap")
        if market_cap:
            if market_cap >= 1_000_000_000:  # > $1B
                score += 2
            elif market_cap >= 100_000_000:  # > $100M
                score += 1
            elif market_cap < 10_000_000:  # < $10M (micro cap - risky)
                score -= 1

        # Circulating supply ratio (higher circulating = better for investors)
        circulating = market_data.get("circulating_supply")
        total = market_data.get("total_supply")
        if circulating and total and total > 0:
            ratio = circulating / total
            if ratio >= 0.8:  # 80%+ circulating
                score += 2
            elif ratio >= 0.5:  # 50-80% circulating
                score += 1
            elif ratio < 0.2:  # < 20% - high dilution risk
                score -= 2

        # Price performance (recent trend)
        price_change_30d = market_data.get("price_change_30d")
        if price_change_30d is not None:
            if price_change_30d > 50:
                score += 1  # Strong momentum
            elif price_change_30d < -50:
                score -= 1  # Significant decline

        # Distance from ATH (value opportunity or distress?)
        ath_change = market_data.get("ath_change_percentage")
        if ath_change is not None:
            if ath_change > -20:  # Near ATH
                score += 1
            elif ath_change < -90:  # 90%+ from ATH - potential distress
                score -= 1

        # Clamp to 0-10
        return max(0, min(10, score))

    def _calculate_github_score(self, github_data: GitHubData) -> int:
        """Calculate development activity score based on GitHub data (0-10)."""
        score = 5  # Base score

        # Stars (popularity indicator)
        if github_data.stars >= 10000:
            score += 2
        elif github_data.stars >= 1000:
            score += 1
        elif github_data.stars < 100:
            score -= 1

        # Recent activity (commits in last 30 days)
        if github_data.commits_last_30d >= 50:
            score += 2
        elif github_data.commits_last_30d >= 10:
            score += 1
        elif github_data.commits_last_30d == 0:
            score -= 2

        # Contributors (team size indicator)
        if github_data.contributors_count >= 50:
            score += 1
        elif github_data.contributors_count < 5:
            score -= 1

        # Archived repos are bad
        if github_data.is_archived:
            score -= 3

        # Clamp to 0-10
        return max(0, min(10, score))

    def _calculate_decentralization_score(self, dune_data: DuneData) -> int:
        """Calculate decentralization score based on holder distribution (0-10)."""
        score = 5  # Base score

        # Top 10 holder concentration
        if dune_data.top_10_holder_percent is not None:
            if dune_data.top_10_holder_percent < 30:
                score += 2  # Good distribution
            elif dune_data.top_10_holder_percent < 50:
                score += 1
            elif dune_data.top_10_holder_percent > 80:
                score -= 2  # Very concentrated

        # Holder count
        if dune_data.holder_count is not None:
            if dune_data.holder_count >= 100000:
                score += 2
            elif dune_data.holder_count >= 10000:
                score += 1
            elif dune_data.holder_count < 1000:
                score -= 1

        # Active addresses (network usage)
        if dune_data.active_addresses_7d is not None:
            if dune_data.active_addresses_7d >= 10000:
                score += 1
            elif dune_data.active_addresses_7d < 100:
                score -= 1

        # Clamp to 0-10
        return max(0, min(10, score))

    def _calculate_overall_score(self, report: ProjectReport) -> int:
        """Calculate overall investment score (0-100)."""
        weights = {
            "team": 0.15,
            "product": 0.20,
            "market": 0.12,
            "competition": 0.08,
            "sentiment": 0.08,
            "tokenomics": 0.10,
            "development": 0.12,  # GitHub activity
            "decentralization": 0.07,  # On-chain metrics
            "risk_inverse": 0.08,  # Lower risk = higher score
        }

        scores = {
            "team": report.team.experience_score,
            "product": report.product.product_score,
            "market": report.market.market_score,
            "competition": report.competition.competition_score,
            "sentiment": report.sentiment.sentiment_score,
            "tokenomics": report.tokenomics.tokenomics_score,
            "development": report.development.activity_score,
            "decentralization": report.onchain.decentralization_score,
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

    async def analyze_via_n8n(self, ticker: str, website: str = None) -> Optional[dict]:
        """
        Send project analysis request to n8n webhook.

        Args:
            ticker: Token ticker symbol
            website: Optional project website URL

        Returns:
            Analysis result from n8n, or None if failed
        """
        if not self.n8n_webhook_analyze:
            logger.warning("n8n analyze webhook not configured")
            return None

        try:
            async with httpx.AsyncClient(timeout=120) as client:
                response = await client.post(
                    self.n8n_webhook_analyze,
                    json={
                        "ticker": ticker.upper(),
                        "website": website,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                )
                response.raise_for_status()
                result = response.json()
                logger.info(f"n8n analysis completed for {ticker}")
                return result
        except Exception as e:
            logger.error(f"n8n webhook error: {e}")
            return None

    async def send_project_alert(self, ticker: str, report: ProjectReport) -> bool:
        """
        Send a new project alert to n8n webhook.

        Args:
            ticker: Token ticker symbol
            report: Analysis report to send

        Returns:
            True if alert sent successfully
        """
        if not self.n8n_webhook_alert:
            logger.warning("n8n alert webhook not configured")
            return False

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    self.n8n_webhook_alert,
                    json={
                        "ticker": ticker.upper(),
                        "name": report.name,
                        "overall_score": report.overall_score,
                        "recommendation": report.recommendation.recommendation,
                        "summary": report.recommendation.summary,
                        "key_catalysts": report.recommendation.key_catalysts,
                        "key_concerns": report.recommendation.key_concerns,
                        "website": report.website,
                        "category": report.category,
                        "analyzed_at": report.analyzed_at,
                    }
                )
                response.raise_for_status()
                logger.info(f"Project alert sent to n8n for {ticker}")
                return True
        except Exception as e:
            logger.error(f"n8n alert webhook error: {e}")
            return False

    async def analyze_project(
        self,
        ticker: str = None,
        website: str = None,
        use_n8n: bool = False,
        send_alert: bool = False
    ) -> ProjectReport:
        """
        Main entry point for project analysis.

        Args:
            ticker: Token ticker symbol (e.g., "SOL")
            website: Project website URL (optional)
            use_n8n: If True, use n8n webhook for analysis
            send_alert: If True, send alert to n8n after analysis

        Returns:
            Complete ProjectReport with investment analysis
        """
        if not ticker and not website:
            raise ValueError("Either ticker or website must be provided")

        # If only website provided, try to extract ticker
        if not ticker and website:
            # TODO: Extract ticker from website
            ticker = "UNKNOWN"

        logger.info(f"Starting analysis for {ticker} (use_n8n={use_n8n})")

        # Try n8n first if enabled
        if use_n8n and self.n8n_webhook_analyze:
            n8n_result = await self.analyze_via_n8n(ticker, website)
            if n8n_result:
                # Convert n8n result to ProjectReport if needed
                # For now, n8n returns the same format
                logger.info(f"Got analysis from n8n for {ticker}")

        # Conduct research (local)
        research = await self.research_project(ticker, website)

        # Generate report
        report = await self.generate_report(research)

        logger.info(f"Analysis complete for {ticker}: Score {report.overall_score}/100")

        # Send alert to n8n if enabled
        if send_alert:
            await self.send_project_alert(ticker, report)

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
