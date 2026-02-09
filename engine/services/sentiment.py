"""
Market Sentiment Service.

Aggregates sentiment data from multiple sources:
- Fear & Greed Index (alternative.me)
- Funding rate
- Open Interest
- Long/Short ratio
"""
import httpx
from datetime import datetime, timezone
from typing import Optional
from loguru import logger

from data.exchange import get_exchange_client


class SentimentService:
    """
    Service for fetching and aggregating market sentiment data.
    """

    FEAR_GREED_URL = "https://api.alternative.me/fng/"

    def __init__(self):
        self.exchange = get_exchange_client()
        self._cache = {}
        self._cache_ttl = 300  # 5 minutes cache

    async def fetch_fear_greed_index(self) -> dict:
        """
        Fetch Fear & Greed Index from alternative.me.
        Fetches both today and yesterday for comparison.

        Returns:
            Dictionary with Fear & Greed data:
            - value: Index value (0-100)
            - classification: Text classification (Extreme Fear, Fear, Neutral, Greed, Extreme Greed)
            - yesterday_value: Yesterday's index value
            - change: Change from yesterday
            - timestamp: Data timestamp
        """
        try:
            # Fetch last 2 days of data
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(f"{self.FEAR_GREED_URL}?limit=2")
                response.raise_for_status()
                data = response.json()

            if data.get("data") and len(data["data"]) > 0:
                today = data["data"][0]
                yesterday = data["data"][1] if len(data["data"]) > 1 else None

                value = int(today.get("value", 50))
                yesterday_value = int(yesterday.get("value", 50)) if yesterday else None
                change = value - yesterday_value if yesterday_value is not None else None

                return {
                    "value": value,
                    "classification": today.get("value_classification", "Neutral"),
                    "yesterday_value": yesterday_value,
                    "change": change,
                    "timestamp": today.get("timestamp"),
                    "time_until_update": today.get("time_until_update"),
                }
            else:
                return {"value": 50, "classification": "Neutral", "error": "No data"}

        except Exception as e:
            logger.error(f"Error fetching Fear & Greed Index: {e}")
            return {"value": 50, "classification": "Neutral", "error": str(e)}

    def _classify_funding(self, funding_rate: float) -> dict:
        """Classify funding rate sentiment."""
        # Funding rate in percentage (e.g., 0.01 = 0.01%)
        if funding_rate > 0.05:
            return {"signal": "EXTREME_LONG_BIAS", "sentiment": "bearish_signal"}
        elif funding_rate > 0.02:
            return {"signal": "LONG_BIAS", "sentiment": "slightly_bearish"}
        elif funding_rate < -0.05:
            return {"signal": "EXTREME_SHORT_BIAS", "sentiment": "bullish_signal"}
        elif funding_rate < -0.02:
            return {"signal": "SHORT_BIAS", "sentiment": "slightly_bullish"}
        else:
            return {"signal": "NEUTRAL", "sentiment": "neutral"}

    def _classify_long_short(self, long_ratio: float) -> dict:
        """Classify long/short ratio sentiment."""
        if long_ratio > 65:
            return {"signal": "EXTREME_LONG", "sentiment": "bearish_signal"}
        elif long_ratio > 55:
            return {"signal": "LONG_HEAVY", "sentiment": "slightly_bearish"}
        elif long_ratio < 35:
            return {"signal": "EXTREME_SHORT", "sentiment": "bullish_signal"}
        elif long_ratio < 45:
            return {"signal": "SHORT_HEAVY", "sentiment": "slightly_bullish"}
        else:
            return {"signal": "BALANCED", "sentiment": "neutral"}

    def _classify_fear_greed(self, value: int) -> dict:
        """Classify Fear & Greed sentiment for trading."""
        if value <= 20:
            return {"signal": "EXTREME_FEAR", "sentiment": "bullish_signal"}
        elif value <= 40:
            return {"signal": "FEAR", "sentiment": "slightly_bullish"}
        elif value >= 80:
            return {"signal": "EXTREME_GREED", "sentiment": "bearish_signal"}
        elif value >= 60:
            return {"signal": "GREED", "sentiment": "slightly_bearish"}
        else:
            return {"signal": "NEUTRAL", "sentiment": "neutral"}

    async def get_market_sentiment(self, symbol: str = None) -> dict:
        """
        Get comprehensive market sentiment data.

        Returns aggregated sentiment from all sources with
        individual metrics and overall sentiment score.
        """
        symbol = symbol or self.exchange.symbol

        # Fetch all data
        fear_greed = await self.fetch_fear_greed_index()
        funding = self.exchange.fetch_funding_rate(symbol)
        long_short = self.exchange.fetch_long_short_ratio(symbol)
        open_interest = self.exchange.fetch_open_interest(symbol)
        price = self.exchange.get_current_price(symbol)

        # Classify each metric
        fg_class = self._classify_fear_greed(fear_greed.get("value", 50))
        funding_class = self._classify_funding(funding.get("funding_rate", 0))
        ls_class = self._classify_long_short(long_short.get("long_ratio", 50))

        # Calculate overall sentiment score (-100 to +100)
        # Positive = bullish, Negative = bearish
        sentiment_score = 0

        # Fear & Greed contribution (weight: 30%)
        fg_value = fear_greed.get("value", 50)
        fg_contribution = (50 - fg_value) * 0.6  # Invert: low fear = bullish
        sentiment_score += fg_contribution

        # Funding rate contribution (weight: 35%) - contrarian
        funding_rate = funding.get("funding_rate", 0)
        funding_contribution = -funding_rate * 500  # Negative funding = bullish
        sentiment_score += max(-35, min(35, funding_contribution))

        # Long/Short ratio contribution (weight: 35%) - contrarian
        long_ratio = long_short.get("long_ratio", 50)
        ls_contribution = (50 - long_ratio) * 0.7  # More shorts = bullish
        sentiment_score += ls_contribution

        # Clamp score
        sentiment_score = max(-100, min(100, sentiment_score))

        # Contrarian trading outlook (what the indicators suggest for trading)
        if sentiment_score >= 40:
            contrarian_outlook = "STRONG_BUY"
            contrarian_color = "green"
        elif sentiment_score >= 15:
            contrarian_outlook = "BUY"
            contrarian_color = "lime"
        elif sentiment_score <= -40:
            contrarian_outlook = "STRONG_SELL"
            contrarian_color = "red"
        elif sentiment_score <= -15:
            contrarian_outlook = "SELL"
            contrarian_color = "orange"
        else:
            contrarian_outlook = "NEUTRAL"
            contrarian_color = "yellow"

        # Market mood (actual sentiment from F&G)
        fg_value = fear_greed.get("value", 50)
        if fg_value <= 25:
            market_mood = "FEARFUL"
            mood_color = "red"
        elif fg_value <= 45:
            market_mood = "CAUTIOUS"
            mood_color = "orange"
        elif fg_value >= 75:
            market_mood = "EUPHORIC"
            mood_color = "green"
        elif fg_value >= 55:
            market_mood = "GREEDY"
            mood_color = "lime"
        else:
            market_mood = "NEUTRAL"
            mood_color = "yellow"

        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "symbol": symbol,
            "market_mood": {
                "mood": market_mood,
                "color": mood_color,
                "description": f"Market is {market_mood.lower()} (F&G: {fg_value})",
            },
            "contrarian_signal": {
                "outlook": contrarian_outlook,
                "score": round(sentiment_score, 1),
                "color": contrarian_color,
                "description": "Contrarian trading signal based on sentiment extremes",
            },
            "fear_greed": {
                "value": fear_greed.get("value", 50),
                "yesterday_value": fear_greed.get("yesterday_value"),
                "change": fear_greed.get("change"),
                "classification": fear_greed.get("classification", "Neutral"),
                "signal": fg_class["signal"],
                "trading_sentiment": fg_class["sentiment"],
            },
            "funding": {
                "rate": funding.get("funding_rate", 0),
                "signal": funding_class["signal"],
                "trading_sentiment": funding_class["sentiment"],
                "next_funding": funding.get("next_funding_timestamp"),
            },
            "long_short": {
                "long_ratio": long_short.get("long_ratio", 50),
                "short_ratio": long_short.get("short_ratio", 50),
                "ratio": long_short.get("long_short_ratio", 1.0),
                "signal": ls_class["signal"],
                "trading_sentiment": ls_class["sentiment"],
                "estimated": long_short.get("estimated", False),
            },
            "open_interest": {
                "value": open_interest.get("open_interest_value"),
                "symbol": symbol,
            },
            "price": {
                "current": price.get("price"),
                "change_24h": price.get("change_24h"),
            },
        }


# Singleton instance
_sentiment_service: Optional[SentimentService] = None


def get_sentiment_service() -> SentimentService:
    """Get or create SentimentService singleton."""
    global _sentiment_service
    if _sentiment_service is None:
        _sentiment_service = SentimentService()
    return _sentiment_service
