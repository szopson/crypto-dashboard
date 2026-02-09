"""
Pydantic schemas for API request/response validation.
"""
from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field


# Enums as Literals
BiasType = Literal["BULLISH", "BEARISH", "NEUTRAL"]
ClassificationType = Literal["ACCUMULATE", "NEUTRAL", "SELL_THE_RALLY"]
TimeframeType = Literal["1H", "4H", "1D", "3D", "1W", "1M"]


# === Price Schemas ===

class PriceResponse(BaseModel):
    """Current price response."""
    symbol: str
    price: float
    bid: Optional[float] = None
    ask: Optional[float] = None
    change_24h: Optional[float] = None
    volume_24h: Optional[float] = None
    high_24h: Optional[float] = None
    low_24h: Optional[float] = None
    timestamp: Optional[int] = None


# === RADAR Schemas ===

class RadarMetric(BaseModel):
    """Individual RADAR metric."""
    value: Optional[float] = None
    signal: str
    description: Optional[str] = None
    bullish_point: float = 0


class BBWPMetric(RadarMetric):
    """BBWP metric details."""
    bbwp: Optional[float] = None
    bb_width: Optional[float] = None


class GaussianMetric(RadarMetric):
    """Gaussian Channel metric details."""
    gaussian_ma: Optional[float] = None
    upper_band: Optional[float] = None
    lower_band: Optional[float] = None
    current_price: Optional[float] = None
    position_pct: Optional[float] = None
    crossover: Optional[str] = None


class WVFMetric(RadarMetric):
    """Williams Vix Fix metric details."""
    wvf: Optional[float] = None
    upper_band: Optional[float] = None
    mid_line: Optional[float] = None


class FundingMetric(RadarMetric):
    """Funding rate metric details."""
    funding_rate: Optional[float] = None


class RadarMetrics(BaseModel):
    """All RADAR metrics."""
    bbwp: BBWPMetric
    gaussian: GaussianMetric
    wvf: WVFMetric
    funding: FundingMetric


class RadarResponse(BaseModel):
    """RADAR score response."""
    score: float = Field(..., ge=0, le=6)
    raw_score: Optional[float] = None
    max_score: int = 6
    classification: ClassificationType
    color: str
    components: list[str] = []
    metrics: Optional[dict] = None
    timestamp: str
    timeframe: str = "1D"


class RadarCurrentResponse(BaseModel):
    """Current RADAR for all timeframes."""
    timestamp: str
    radars: dict[str, RadarResponse]  # Mapping timeframe -> RadarResponse


# === Bias Schemas ===

class BiasTimeframe(BaseModel):
    """Bias for a single timeframe."""
    timeframe: TimeframeType
    structural_bias: BiasType
    secondary_swing_level: Optional[float] = None
    ss_distance_pct: Optional[float] = None
    last_swing_high: Optional[float] = None
    last_swing_low: Optional[float] = None
    swing_structure: Optional[str] = None
    radar_score: Optional[float] = None
    confidence: Optional[str] = None


class BiasCurrentResponse(BaseModel):
    """Current bias for all timeframes."""
    timestamp: str
    current_price: float
    biases: dict[str, BiasTimeframe]  # Mapping timeframe -> BiasTimeframe
    overall_bias: BiasType
    key_levels: list[dict] = []


# === Structure Schemas ===

class SwingPoint(BaseModel):
    """A swing high or low point."""
    type: Literal["HIGH", "LOW"]
    price: float
    label: Optional[str] = None  # HH, HL, LH, LL, FIRST
    index: int
    timestamp: Optional[str] = None


class SecondarySwing(BaseModel):
    """Secondary swing level for bias flipping."""
    price: Optional[float] = None
    type: Optional[Literal["HIGH", "LOW"]] = None
    distance_pct: Optional[float] = None


class StructureResponse(BaseModel):
    """Structural analysis for a timeframe."""
    timeframe: str
    bias: Literal["BULLISH", "BEARISH", "NEUTRAL", "CHOPPY"]
    structure: str  # HH_HL, LH_LL, etc.
    secondary_swing: SecondarySwing
    last_swing_high: Optional[float] = None
    last_swing_low: Optional[float] = None
    reason: str
    swings: list[SwingPoint] = []
    current_price: float


class StructureCurrentResponse(BaseModel):
    """Structure for all timeframes."""
    timestamp: str
    current_price: float
    structures: dict[str, StructureResponse]  # Mapping timeframe -> StructureResponse


# === Zone Schemas ===

ZoneType = Literal["BULLISH_OB", "BEARISH_OB", "BULLISH_FVG", "BEARISH_FVG"]


class Zone(BaseModel):
    """A trading zone (OB or FVG)."""
    type: ZoneType
    high: float
    low: float
    formed_at: Optional[str] = None
    is_active: bool = True


class NearbyZone(BaseModel):
    """Zone near current price."""
    type: ZoneType
    high: float
    low: float
    mid: float
    distance_pct: float
    formed_at: Optional[str] = None
    direction: Literal["BULLISH", "BEARISH"]


class ZonesResponse(BaseModel):
    """Zones for a timeframe."""
    timeframe: str
    fvgs: list[Zone] = []
    order_blocks: list[Zone] = []
    nearby_zones: list[NearbyZone] = []
    current_price: float


class ZonesCurrentResponse(BaseModel):
    """Zones for all timeframes."""
    timestamp: str
    current_price: float
    zones: dict[str, ZonesResponse]  # Mapping timeframe -> ZonesResponse


# === TradingView Webhook Schemas ===

class TradingViewWebhook(BaseModel):
    """
    TradingView webhook payload.
    Flexible schema to accept various alert formats.
    """
    # Standard fields
    symbol: Optional[str] = None
    action: Optional[str] = None  # BUY, SELL, ALERT, LONG, SHORT
    price: Optional[float] = None
    close: Optional[float] = None
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    volume: Optional[float] = None
    timeframe: Optional[str] = None
    time: Optional[str] = None
    timenow: Optional[str] = None

    # Alert info
    alert_name: Optional[str] = None
    alert_message: Optional[str] = None
    message: Optional[str] = None

    # Strategy fields
    strategy_order_action: Optional[str] = None
    strategy_order_price: Optional[float] = None
    strategy_position_size: Optional[float] = None

    # Custom fields (catch-all)
    class Config:
        extra = "allow"


class AlertResponse(BaseModel):
    """Single alert response."""
    id: int
    timestamp: str
    symbol: str
    action: Optional[str] = None
    price: Optional[float] = None
    message: Optional[str] = None
    timeframe: Optional[str] = None
    processed: bool = False


class AlertsListResponse(BaseModel):
    """List of alerts."""
    timestamp: str
    count: int
    alerts: list[AlertResponse]


# === SNIPER Schemas ===

class ConfluenceComponent(BaseModel):
    """Single confluence component."""
    name: str
    points: float
    max: float
    note: str


class ConfluenceResult(BaseModel):
    """Confluence score result."""
    score: float
    max_score: float = 5.0
    signal: Literal["STRONG_LONG", "LONG", "NEUTRAL", "SHORT", "STRONG_SHORT"]
    recommendation: str
    components: list[ConfluenceComponent]


class TradeSetupResponse(BaseModel):
    """Trade setup response."""
    direction: Literal["LONG", "SHORT"]
    entry_zone_type: str
    entry_zone: dict
    entry_price: float
    stop_loss: float
    take_profits: dict
    risk_reward: float
    confluence_score: float
    position_size_pct: float
    timeframe: str
    notes: list[str]


class SniperResponse(BaseModel):
    """SNIPER analysis response."""
    timestamp: str
    current_price: float
    confluence: ConfluenceResult
    setups: list[TradeSetupResponse]
    radar_score: Optional[float] = None
    radar_classification: Optional[str] = None


# === LLM Schemas ===

class ChatRequest(BaseModel):
    """Chat request."""
    message: str
    include_market_data: bool = True


class ChatResponse(BaseModel):
    """Chat response."""
    success: bool
    response: Optional[str] = None
    error: Optional[str] = None
    timestamp: str


class AnalysisResponse(BaseModel):
    """Market analysis response."""
    success: bool
    analysis: Optional[str] = None
    error: Optional[str] = None
    model: Optional[str] = None
    timestamp: str


class BriefingResponse(BaseModel):
    """Daily briefing response."""
    success: bool
    briefing: Optional[str] = None
    error: Optional[str] = None
    timestamp: str


# === Telegram Schemas ===

class TelegramMessageRequest(BaseModel):
    """Telegram message request."""
    message: str
    chat_id: Optional[str] = None


class TelegramAlertRequest(BaseModel):
    """Telegram alert request."""
    alert_type: str = "INFO"
    symbol: str = "BTC/USDT"
    message: str
    price: Optional[float] = None
    chat_id: Optional[str] = None


class TelegramResponse(BaseModel):
    """Telegram response."""
    success: bool
    error: Optional[str] = None
    message_id: Optional[int] = None
    timestamp: str


# === Trade Journal Schemas ===

TradeDirection = Literal["LONG", "SHORT"]
TradeStatus = Literal["OPEN", "CLOSED", "CANCELLED"]
TradeOutcome = Literal["WIN", "LOSS", "BREAKEVEN"]


class TradeCreate(BaseModel):
    """Create a new trade."""
    symbol: str = "BTC/USDT:USDT"
    direction: TradeDirection
    entry_price: float
    entry_time: Optional[str] = None  # ISO format, defaults to now
    entry_zone_type: Optional[str] = None

    # Position sizing
    position_size: Optional[float] = None
    position_size_pct: Optional[float] = None
    leverage: float = 1.0

    # Risk management
    stop_loss: Optional[float] = None
    take_profit_1: Optional[float] = None
    take_profit_2: Optional[float] = None
    take_profit_3: Optional[float] = None
    risk_reward: Optional[float] = None

    # Context
    confluence_score: Optional[float] = None
    radar_score: Optional[float] = None
    radar_classification: Optional[str] = None
    structural_bias: Optional[str] = None
    timeframe: Optional[str] = None

    # Notes
    notes: Optional[str] = None
    tags: Optional[str] = None
    screenshot_url: Optional[str] = None


class TradeUpdate(BaseModel):
    """Update an existing trade."""
    status: Optional[TradeStatus] = None
    exit_price: Optional[float] = None
    exit_time: Optional[str] = None
    exit_reason: Optional[str] = None
    realized_pnl: Optional[float] = None
    realized_pnl_pct: Optional[float] = None
    fees: Optional[float] = None
    outcome: Optional[TradeOutcome] = None
    notes: Optional[str] = None
    tags: Optional[str] = None
    screenshot_url: Optional[str] = None

    # Allow updating risk levels
    stop_loss: Optional[float] = None
    take_profit_1: Optional[float] = None
    take_profit_2: Optional[float] = None
    take_profit_3: Optional[float] = None


class TradeResponse(BaseModel):
    """Trade response."""
    id: int
    symbol: str
    direction: str
    status: str

    # Entry
    entry_price: float
    entry_time: str
    entry_zone_type: Optional[str] = None

    # Position
    position_size: Optional[float] = None
    position_size_pct: Optional[float] = None
    leverage: float = 1.0

    # Risk management
    stop_loss: Optional[float] = None
    take_profit_1: Optional[float] = None
    take_profit_2: Optional[float] = None
    take_profit_3: Optional[float] = None
    risk_reward: Optional[float] = None

    # Exit
    exit_price: Optional[float] = None
    exit_time: Optional[str] = None
    exit_reason: Optional[str] = None

    # P&L
    realized_pnl: Optional[float] = None
    realized_pnl_pct: Optional[float] = None
    fees: Optional[float] = None

    # Context
    confluence_score: Optional[float] = None
    radar_score: Optional[float] = None
    radar_classification: Optional[str] = None
    structural_bias: Optional[str] = None
    timeframe: Optional[str] = None

    # Notes
    notes: Optional[str] = None
    tags: Optional[str] = None
    screenshot_url: Optional[str] = None
    outcome: Optional[str] = None

    # Metadata
    created_at: str
    updated_at: str


class TradeListResponse(BaseModel):
    """List of trades."""
    timestamp: str
    count: int
    trades: list[TradeResponse]


class TradeStatsResponse(BaseModel):
    """Trade statistics response."""
    period: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None

    # Trade counts
    total_trades: int
    winning_trades: int
    losing_trades: int
    breakeven_trades: int
    win_rate: Optional[float] = None

    # P&L
    total_pnl: float
    avg_win: Optional[float] = None
    avg_loss: Optional[float] = None
    largest_win: Optional[float] = None
    largest_loss: Optional[float] = None

    # Risk metrics
    profit_factor: Optional[float] = None
    avg_risk_reward: Optional[float] = None
    expectancy: Optional[float] = None

    # Streaks
    current_streak: int = 0
    max_win_streak: int = 0
    max_loss_streak: int = 0

    # Direction breakdown
    long_trades: int = 0
    short_trades: int = 0
    long_win_rate: Optional[float] = None
    short_win_rate: Optional[float] = None

    calculated_at: str


# === Trade Export/Import Schemas ===

class TradeExportRequest(BaseModel):
    """Trade export request."""
    format: Literal["csv", "json"] = "json"
    status: Optional[str] = None  # Filter by status
    start_date: Optional[str] = None  # ISO format
    end_date: Optional[str] = None


class TradeImportItem(BaseModel):
    """Single trade for import."""
    direction: Literal["LONG", "SHORT"]
    entry_price: float
    entry_time: str  # ISO format
    status: Literal["OPEN", "CLOSED", "CANCELLED"] = "CLOSED"
    exit_price: Optional[float] = None
    exit_time: Optional[str] = None
    exit_reason: Optional[str] = None
    stop_loss: Optional[float] = None
    take_profit_1: Optional[float] = None
    position_size: Optional[float] = None
    realized_pnl: Optional[float] = None
    realized_pnl_pct: Optional[float] = None
    outcome: Optional[Literal["WIN", "LOSS", "BREAKEVEN"]] = None
    notes: Optional[str] = None
    tags: Optional[str] = None


class TradeImportRequest(BaseModel):
    """Trade import request."""
    trades: list[TradeImportItem]


class EquityPoint(BaseModel):
    """Single point on equity curve."""
    date: str
    equity: float
    drawdown: float
    drawdown_pct: float
    trade_count: int


class EquityCurveResponse(BaseModel):
    """Equity curve response."""
    timestamp: str
    starting_equity: float
    current_equity: float
    peak_equity: float
    max_drawdown: float
    max_drawdown_pct: float
    curve: list[EquityPoint]


class PerformanceByTagResponse(BaseModel):
    """Performance breakdown by tag."""
    timestamp: str
    tags: dict  # tag -> stats


# === Market Sentiment Schemas ===

class MarketMood(BaseModel):
    """Actual market mood based on F&G."""
    mood: str  # FEARFUL, CAUTIOUS, NEUTRAL, GREEDY, EUPHORIC
    color: str
    description: str


class ContrarianSignal(BaseModel):
    """Contrarian trading signal."""
    outlook: str  # STRONG_BUY, BUY, NEUTRAL, SELL, STRONG_SELL
    score: float  # -100 to +100
    color: str
    description: str


class FearGreedData(BaseModel):
    """Fear & Greed Index data."""
    value: int  # 0-100
    yesterday_value: Optional[int] = None
    change: Optional[int] = None
    classification: str  # Extreme Fear, Fear, Neutral, Greed, Extreme Greed
    signal: str
    trading_sentiment: str


class FundingData(BaseModel):
    """Funding rate data."""
    rate: float
    signal: str
    trading_sentiment: str
    next_funding: Optional[int] = None


class LongShortData(BaseModel):
    """Long/Short ratio data."""
    long_ratio: float
    short_ratio: float
    ratio: float
    signal: str
    trading_sentiment: str
    estimated: bool = False


class OpenInterestData(BaseModel):
    """Open Interest data."""
    value: Optional[float] = None
    symbol: str


class SentimentPriceData(BaseModel):
    """Price data for sentiment."""
    current: Optional[float] = None
    change_24h: Optional[float] = None


class SentimentResponse(BaseModel):
    """Market sentiment response."""
    timestamp: str
    symbol: str
    market_mood: MarketMood
    contrarian_signal: ContrarianSignal
    fear_greed: FearGreedData
    funding: FundingData
    long_short: LongShortData
    open_interest: OpenInterestData
    price: SentimentPriceData


# === Custom Alert Config Schemas ===

AlertType = Literal[
    "PRICE_ABOVE", "PRICE_BELOW",
    "RADAR_SCORE_ABOVE", "RADAR_SCORE_BELOW",
    "RADAR_CLASSIFICATION",
    "FUNDING_RATE_ABOVE", "FUNDING_RATE_BELOW",
    "FEAR_GREED_ABOVE", "FEAR_GREED_BELOW",
    "CONFLUENCE_ABOVE", "CONFLUENCE_BELOW",
    "SENTIMENT_CHANGE"
]


class AlertConfigCreate(BaseModel):
    """Create a new alert configuration."""
    name: str
    description: Optional[str] = None
    symbol: str = "BTC/USDT:USDT"
    alert_type: str
    threshold_value: Optional[float] = None
    threshold_operator: str = ">="
    timeframe: Optional[str] = None
    conditions: Optional[dict] = None
    notify_telegram: bool = True
    notify_once: bool = False
    cooldown_minutes: int = 60


class AlertConfigUpdate(BaseModel):
    """Update an alert configuration."""
    name: Optional[str] = None
    description: Optional[str] = None
    enabled: Optional[bool] = None
    threshold_value: Optional[float] = None
    threshold_operator: Optional[str] = None
    conditions: Optional[dict] = None
    notify_telegram: Optional[bool] = None
    notify_once: Optional[bool] = None
    cooldown_minutes: Optional[int] = None


class AlertConfigResponse(BaseModel):
    """Alert configuration response."""
    id: int
    name: str
    description: Optional[str] = None
    symbol: str
    enabled: bool
    alert_type: str
    threshold_value: Optional[float] = None
    threshold_operator: str
    timeframe: Optional[str] = None
    conditions: Optional[dict] = None
    notify_telegram: bool
    notify_once: bool
    cooldown_minutes: int
    last_triggered: Optional[str] = None
    trigger_count: int
    created_at: str
    updated_at: str


class AlertConfigListResponse(BaseModel):
    """List of alert configurations."""
    timestamp: str
    count: int
    alerts: list[AlertConfigResponse]


# === Project Analysis Schemas ===

class TeamAnalysisSchema(BaseModel):
    """Team/founders analysis."""
    founders_known: bool = False
    founders_doxxed: bool = False
    team_size: Optional[str] = None
    key_members: list[str] = []
    previous_projects: list[str] = []
    linkedin_profiles: bool = False
    experience_score: int = 0
    notes: str = ""


class ProductAnalysisSchema(BaseModel):
    """Product/technology analysis."""
    status: str = "unknown"
    has_working_product: bool = False
    github_activity: str = "unknown"
    tech_stack: list[str] = []
    unique_features: list[str] = []
    audited: bool = False
    audit_firms: list[str] = []
    product_score: int = 0
    notes: str = ""


class MarketAnalysisSchema(BaseModel):
    """Market & niche analysis."""
    niche: str = ""
    niche_description: str = ""
    market_size: str = ""
    growth_potential: str = ""
    timing: str = ""
    target_audience: str = ""
    use_cases: list[str] = []
    market_score: int = 0
    notes: str = ""


class CompetitionAnalysisSchema(BaseModel):
    """Competition landscape."""
    main_competitors: list[dict] = []
    competitive_advantages: list[str] = []
    competitive_disadvantages: list[str] = []
    market_position: str = ""
    moat: str = ""
    competition_score: int = 0
    notes: str = ""


class SentimentAnalysisSchema(BaseModel):
    """Community & market sentiment for project."""
    twitter_followers: Optional[int] = None
    twitter_engagement: str = "unknown"
    discord_members: Optional[int] = None
    telegram_members: Optional[int] = None
    community_activity: str = "unknown"
    recent_news_sentiment: str = "neutral"
    influencer_mentions: str = ""
    controversy: bool = False
    controversy_details: str = ""
    sentiment_score: int = 0
    notes: str = ""


class TokenomicsAnalysisSchema(BaseModel):
    """Tokenomics analysis."""
    total_supply: Optional[str] = None
    circulating_supply: Optional[str] = None
    market_cap: Optional[str] = None
    fdv: Optional[str] = None
    token_utility: list[str] = []
    vesting_schedule: str = ""
    team_allocation: Optional[str] = None
    investor_allocation: Optional[str] = None
    unlock_schedule: str = ""
    inflation_rate: Optional[str] = None
    tokenomics_score: int = 0
    notes: str = ""


class RiskAnalysisSchema(BaseModel):
    """Risk assessment."""
    regulatory_risk: str = "medium"
    technical_risk: str = "medium"
    market_risk: str = "medium"
    team_risk: str = "medium"
    competition_risk: str = "medium"
    liquidity_risk: str = "medium"
    smart_contract_risk: str = "medium"
    key_risks: list[str] = []
    risk_mitigations: list[str] = []
    overall_risk: str = "medium"
    notes: str = ""


class DefiMetricsSchema(BaseModel):
    """DeFi protocol metrics from DefiLlama."""
    tvl: Optional[float] = None
    tvl_formatted: Optional[str] = None
    tvl_change_1d: Optional[float] = None
    tvl_change_7d: Optional[float] = None
    tvl_change_30d: Optional[float] = None
    mcap_tvl_ratio: Optional[float] = None
    category: Optional[str] = None
    chains: list[str] = []
    protocol_url: Optional[str] = None


class DevelopmentActivitySchema(BaseModel):
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
    activity_score: int = 0


class OnChainMetricsSchema(BaseModel):
    """On-chain metrics from Dune Analytics."""
    token_address: Optional[str] = None
    chain: Optional[str] = None
    holder_count: Optional[int] = None
    top_10_holder_percent: Optional[float] = None
    top_100_holder_percent: Optional[float] = None
    active_addresses_7d: Optional[int] = None
    active_addresses_30d: Optional[int] = None
    transfer_count_7d: Optional[int] = None
    decentralization_score: int = 0


class InvestmentRecommendationSchema(BaseModel):
    """Final investment recommendation."""
    recommendation: str = "NEUTRAL"
    confidence: int = 50
    time_horizon: str = ""
    entry_strategy: str = ""
    position_size_suggestion: str = ""
    key_catalysts: list[str] = []
    key_concerns: list[str] = []
    price_targets: dict = {}
    summary: str = ""


class ProjectReportResponse(BaseModel):
    """Complete project analysis report."""
    ticker: str
    name: str
    website: Optional[str] = None
    analyzed_at: str

    # Basic info
    description: str = ""
    category: str = ""
    blockchain: str = ""
    launch_date: Optional[str] = None

    # Analysis sections
    team: TeamAnalysisSchema = TeamAnalysisSchema()
    product: ProductAnalysisSchema = ProductAnalysisSchema()
    market: MarketAnalysisSchema = MarketAnalysisSchema()
    competition: CompetitionAnalysisSchema = CompetitionAnalysisSchema()
    sentiment: SentimentAnalysisSchema = SentimentAnalysisSchema()
    tokenomics: TokenomicsAnalysisSchema = TokenomicsAnalysisSchema()
    risk: RiskAnalysisSchema = RiskAnalysisSchema()

    # Additional data sources
    defi_metrics: DefiMetricsSchema = DefiMetricsSchema()
    development: DevelopmentActivitySchema = DevelopmentActivitySchema()
    onchain: OnChainMetricsSchema = OnChainMetricsSchema()

    # Final recommendation
    recommendation: InvestmentRecommendationSchema = InvestmentRecommendationSchema()

    # Overall scores
    overall_score: int = 0

    # Raw research data
    research_sources: list[str] = []


class ProjectAnalysisRequest(BaseModel):
    """Request to analyze a project."""
    ticker: Optional[str] = None
    website: Optional[str] = None


# === Health Check ===

class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "ok"
    version: str = "1.0.0"
    exchange: str
    symbol: str
    timestamp: str


# === Report Generation Schemas ===

class ReportGenerateRequest(BaseModel):
    """Request to generate a PDF investment report."""
    ticker: str = Field(..., min_length=1, max_length=10, description="Token ticker symbol")
    report_type: str = Field(default="crypto", description="Type of report: crypto, defi, nft")
    send_telegram: bool = Field(default=False, description="Send PDF to Telegram after generation")
    telegram_chat_id: Optional[str] = Field(default=None, description="Override default Telegram chat ID")


class ReportGenerateResponse(BaseModel):
    """Response from report generation."""
    success: bool
    ticker: str
    report_type: str
    filename: Optional[str] = None
    telegram_sent: bool = False
    telegram_message_id: Optional[int] = None
    error: Optional[str] = None
    generation_time_seconds: float = 0
