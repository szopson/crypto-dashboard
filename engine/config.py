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

    # Google OAuth (for future authentication)
    google_client_id: str = ""
    google_client_secret: str = ""

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

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


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
