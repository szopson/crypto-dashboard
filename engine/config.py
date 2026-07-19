"""
Configuration settings for Trading Command Center backend.
"""
from pydantic_settings import BaseSettings
from pydantic import computed_field
from typing import Literal


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App
    app_name: str = "Trading Command Center"
    debug: bool = False

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    @computed_field
    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins from comma-separated string."""
        if self.cors_origins.startswith("["):
            import json
            return json.loads(self.cors_origins)
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    # Database
    database_url: str = "sqlite+aiosqlite:///./trading.db"

    # Copilot (chat/analysis/briefing) — Claude calls per user per UTC day
    copilot_daily_limit: int = 30

    # Exchange (CCXT)
    exchange_id: str = "bybit"
    default_symbol: str = "BTC/USDT:USDT"  # Bybit perpetual

    # Available symbols for multi-symbol support
    available_symbols: list[str] = [
        "BTC/USDT:USDT",
        "ETH/USDT:USDT",
        "SOL/USDT:USDT",
        "XRP/USDT:USDT",
        "DOGE/USDT:USDT",
        "ADA/USDT:USDT",
        "AVAX/USDT:USDT",
        "DOT/USDT:USDT",
        "LINK/USDT:USDT",
        "MATIC/USDT:USDT",
    ]

    # Timeframes
    timeframes: list[str] = ["1h", "4h", "1d", "1w"]  # CCXT format
    radar_timeframes: list[str] = ["1d", "1w", "1M"]  # Timeframes for RADAR calculations (macro only)

    # Data fetching
    ohlcv_limit: int = 300  # Number of candles to fetch
    refresh_interval_seconds: int = 3600  # 1 hour

    # RADAR thresholds
    bbwp_low_threshold: float = 20.0
    bbwp_high_threshold: float = 80.0
    funding_rate_threshold: float = 0.01  # 0.01%

    # LLM (Claude)
    anthropic_api_key: str = ""

    # OpenAI (alternative LLM)
    openai_api_key: str = ""

    # OpenRouter (for LLM analysis)
    openrouter_api_key: str = ""

    # Perplexity (for web research)
    perplexity_api_key: str = ""

    # Groq (free LLM for portfolio chat - Llama 3.3 70B)
    groq_api_key: str = ""

    # GitHub API (optional token for higher rate limits)
    github_token: str = ""

    # Dune Analytics API
    dune_api_key: str = ""
    # Dune Query ID (combined holders + activity query)
    dune_combined_query_id: int = 0

    # Whale Alert API (for whale transaction tracking) - PAID: $29.95/month
    whale_alert_api_key: str = ""

    # Santiment API (for social sentiment) - PAID: $420+/month
    santiment_api_key: str = ""

    # Google OAuth (for future authentication)
    google_client_id: str = ""
    google_client_secret: str = ""

    # Supabase (for Wealth Dashboard auth & database)
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""

    # Static bearer token for operational control routes (/telegram/*,
    # /scheduler/*, /alerts/monitor/*). Empty = those routes always 401
    # (fail closed). Set in engine/.env on the VPS.
    admin_api_token: str = ""

    # Resend (Email)
    resend_api_key: str = ""
    resend_from_email: str = "noreply@yourdomain.com"

    # Cloudflare Turnstile (Bot Protection)
    turnstile_secret_key: str = ""

    # Wealth Dashboard - Price APIs
    finnhub_api_key: str = ""  # Backup for stock prices
    goldapi_key: str = ""  # Gold/Silver prices (free 100/month)

    # Wealth Dashboard - Settings
    wealth_price_cache_ttl: int = 300  # 5 minutes default

    # Telegram
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    telegram_channel_id: str = ""
    telegram_group_id: str = ""
    telegram_admin_chat_id: str = ""

    # n8n Webhooks
    n8n_webhook_analyze: str = ""
    n8n_webhook_alert: str = ""

    # Alert Monitor
    alert_monitor_enabled: bool = True
    alert_check_interval_seconds: int = 300  # 5 minutes
    alert_sniper_min_confluence: float = 3.5

    # Scheduler
    scheduler_enabled: bool = True
    daily_briefing_enabled: bool = True
    daily_briefing_hour: int = 8  # 8:00 AM
    daily_briefing_minute: int = 0
    daily_briefing_timezone: str = "Europe/Warsaw"

    # Cockpit daily digest (X/Telegram content export)
    # The digest reads the frontend's /api/crypto-pulse so the derivatives
    # snapshot has a single source of truth (Coinglass key + cache live there).
    # frontend_base_url = PUBLIC url (used in the post's CTA link);
    # frontend_internal_url = where the backend fetches the API from (on the
    # VPS that's the docker-network service, http://frontend:3000). Falls back
    # to frontend_base_url when empty.
    frontend_base_url: str = "http://localhost:3000"
    frontend_internal_url: str = ""
    cockpit_digest_enabled: bool = False  # opt-in; drafts to Telegram admin
    cockpit_digest_hour: int = 9
    cockpit_digest_minute: int = 0
    cockpit_digest_timezone: str = "Europe/Warsaw"

    # GeoIP region gating (affiliate compliance; see api/region.py)
    # DB is maintained by the geoipupdate sidecar (docker-compose.yml) on a
    # shared volume. Missing DB degrades to region=null → frontend fails closed.
    geoip_db_path: str = "/geoip/GeoLite2-Country.mmdb"
    geoip_stale_days: int = 14  # warn + Telegram-alert when the DB is older
    # Comma-separated ISO-3166 alpha-2 codes. MUST stay in sync with the union
    # of `restrictedRegions` in frontend/src/config/exchanges.ts.
    restricted_regions: str = "US"

    @computed_field
    @property
    def restricted_regions_set(self) -> set[str]:
        return {r.strip().upper() for r in self.restricted_regions.split(",") if r.strip()}

    # Report Generation
    report_playwright_timeout: int = 30000  # 30 seconds
    report_template_dir: str = "report/templates"
    report_output_dir: str = "/tmp/reports"
    report_ai_model: str = "claude-sonnet-4-6"
    report_ai_max_tokens: int = 4000

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"  # tolerate unknown env vars (alpaca_*, etc.) instead of crashing


# Timeframe mapping: CCXT format -> Display format
TIMEFRAME_MAP = {
    "1h": "1H",
    "4h": "4H",
    "1d": "1D",
    "3d": "3D",
    "1w": "1W",
    "1M": "1M",
}

# Reverse mapping: Display format -> CCXT format
TIMEFRAME_MAP_REVERSE = {v: k for k, v in TIMEFRAME_MAP.items()}

# Bias types
BiasType = Literal["BULLISH", "BEARISH", "NEUTRAL"]

# Signal types
SignalType = Literal["BULLISH", "BEARISH", "NEUTRAL", "EXTREME_LOW_VOL", "EXTREME_HIGH_VOL",
                     "EXTREME_FEAR", "LONG_BIAS", "SHORT_BIAS"]


settings = Settings()
