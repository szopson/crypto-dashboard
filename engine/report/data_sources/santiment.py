"""
Santiment API Data Source.

Provides social sentiment, on-chain metrics, and trending data.
API Documentation: https://academy.santiment.net/sanapi/

IMPORTANT: This is a PAID service (Business Pro starts at $420/month).
If SANTIMENT_API_KEY is not configured, this data source will be skipped gracefully.
"""
import httpx
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from loguru import logger

from config import settings


class SantimentDataSource:
    """
    Santiment GraphQL API client for social sentiment data.

    Requires PAID API key (Business Pro: $420/mo+). See: https://santiment.net/pricing
    """

    BASE_URL = "https://api.santiment.net/graphql"

    # Map common tickers to Santiment slugs
    TICKER_TO_SLUG = {
        "BTC": "bitcoin",
        "ETH": "ethereum",
        "SOL": "solana",
        "AVAX": "avalanche",
        "MATIC": "matic-network",
        "ARB": "arbitrum",
        "OP": "optimism",
        "LINK": "chainlink",
        "UNI": "uniswap",
        "AAVE": "aave",
        "MKR": "maker",
        "CRV": "curve-dao-token",
        "LDO": "lido-dao",
        "DOGE": "dogecoin",
        "XRP": "ripple",
        "ADA": "cardano",
        "DOT": "polkadot-new",
        "ATOM": "cosmos",
        "NEAR": "near-protocol",
        "FTM": "fantom",
        "INJ": "injective-protocol",
        "SUI": "sui",
        "APT": "aptos",
        "SEI": "sei-network",
        "JUP": "jupiter-exchange-solana",
        "PENDLE": "pendle",
        "GMX": "gmx",
    }

    def __init__(self):
        self.api_key = getattr(settings, 'santiment_api_key', None)

    def is_configured(self) -> bool:
        """Check if Santiment API key is configured."""
        return bool(self.api_key)

    async def fetch(self, ticker: str) -> Dict[str, Any]:
        """
        Fetch social sentiment data for a token.

        Args:
            ticker: Token symbol (e.g., "BTC", "ETH")

        Returns:
            Dict with sentiment metrics
        """
        data = {
            "has_sentiment_data": False,
            "social_volume_24h": None,
            "social_volume_change": None,
            "sentiment_score": None,
            "sentiment_label": "neutral",
            "social_dominance": None,
            "trending_rank": None,
            "dev_activity": None,
            "positive_sentiment": None,
            "negative_sentiment": None,
        }

        if not self.is_configured():
            logger.debug("Santiment API key not configured")
            return data

        slug = self.TICKER_TO_SLUG.get(ticker.upper(), ticker.lower())

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                # Fetch social volume
                social_data = await self._fetch_social_volume(client, slug)
                if social_data:
                    data.update(social_data)
                    data["has_sentiment_data"] = True

                # Fetch sentiment
                sentiment_data = await self._fetch_sentiment(client, slug)
                if sentiment_data:
                    data.update(sentiment_data)

                # Fetch social dominance
                dominance_data = await self._fetch_social_dominance(client, slug)
                if dominance_data:
                    data.update(dominance_data)

                # Fetch dev activity
                dev_data = await self._fetch_dev_activity(client, slug)
                if dev_data:
                    data.update(dev_data)

                if data["has_sentiment_data"]:
                    logger.info(f"Santiment: sentiment={data.get('sentiment_score')}, social_vol={data.get('social_volume_24h')}")

        except Exception as e:
            logger.warning(f"Santiment fetch failed for {ticker}: {e}")

        return data

    async def _fetch_social_volume(
        self,
        client: httpx.AsyncClient,
        slug: str,
    ) -> Optional[Dict[str, Any]]:
        """Fetch social volume metrics."""
        now = datetime.utcnow()
        yesterday = now - timedelta(days=1)
        week_ago = now - timedelta(days=7)

        query = """
        {
          getMetric(metric: "social_volume_total") {
            timeseriesData(
              slug: "%s"
              from: "%s"
              to: "%s"
              interval: "1d"
            ) {
              datetime
              value
            }
          }
        }
        """ % (slug, week_ago.strftime("%Y-%m-%dT%H:%M:%SZ"), now.strftime("%Y-%m-%dT%H:%M:%SZ"))

        try:
            response = await client.post(
                self.BASE_URL,
                json={"query": query},
                headers={"Authorization": f"Apikey {self.api_key}"},
            )
            response.raise_for_status()
            result = response.json()

            timeseries = result.get("data", {}).get("getMetric", {}).get("timeseriesData", [])
            if not timeseries:
                return None

            # Get last 24h and 7d average
            values = [point["value"] for point in timeseries if point.get("value")]
            if not values:
                return None

            social_volume_24h = values[-1] if values else 0
            avg_7d = sum(values) / len(values) if values else 0

            # Calculate change vs average
            change = 0
            if avg_7d > 0:
                change = ((social_volume_24h - avg_7d) / avg_7d) * 100

            return {
                "social_volume_24h": int(social_volume_24h),
                "social_volume_change": round(change, 1),
            }

        except Exception as e:
            logger.debug(f"Santiment social volume fetch failed: {e}")
            return None

    async def _fetch_sentiment(
        self,
        client: httpx.AsyncClient,
        slug: str,
    ) -> Optional[Dict[str, Any]]:
        """Fetch sentiment metrics."""
        now = datetime.utcnow()
        day_ago = now - timedelta(days=1)

        query = """
        {
          getMetric(metric: "sentiment_positive_total") {
            positive: timeseriesData(
              slug: "%s"
              from: "%s"
              to: "%s"
              interval: "1d"
            ) {
              value
            }
          }
          negative: getMetric(metric: "sentiment_negative_total") {
            timeseriesData(
              slug: "%s"
              from: "%s"
              to: "%s"
              interval: "1d"
            ) {
              value
            }
          }
        }
        """ % (slug, day_ago.strftime("%Y-%m-%dT%H:%M:%SZ"), now.strftime("%Y-%m-%dT%H:%M:%SZ"),
               slug, day_ago.strftime("%Y-%m-%dT%H:%M:%SZ"), now.strftime("%Y-%m-%dT%H:%M:%SZ"))

        try:
            response = await client.post(
                self.BASE_URL,
                json={"query": query},
                headers={"Authorization": f"Apikey {self.api_key}"},
            )
            response.raise_for_status()
            result = response.json()

            positive_data = result.get("data", {}).get("getMetric", {}).get("positive", [])
            negative_data = result.get("data", {}).get("negative", {}).get("timeseriesData", [])

            positive = positive_data[-1]["value"] if positive_data else 0
            negative = negative_data[-1]["value"] if negative_data else 0

            # Calculate sentiment score (0-100)
            total = positive + negative
            if total > 0:
                sentiment_score = int((positive / total) * 100)
            else:
                sentiment_score = 50

            # Determine label
            if sentiment_score >= 65:
                label = "bullish"
            elif sentiment_score >= 55:
                label = "slightly_bullish"
            elif sentiment_score <= 35:
                label = "bearish"
            elif sentiment_score <= 45:
                label = "slightly_bearish"
            else:
                label = "neutral"

            return {
                "sentiment_score": sentiment_score,
                "sentiment_label": label,
                "positive_sentiment": int(positive),
                "negative_sentiment": int(negative),
            }

        except Exception as e:
            logger.debug(f"Santiment sentiment fetch failed: {e}")
            return None

    async def _fetch_social_dominance(
        self,
        client: httpx.AsyncClient,
        slug: str,
    ) -> Optional[Dict[str, Any]]:
        """Fetch social dominance metric."""
        now = datetime.utcnow()
        day_ago = now - timedelta(days=1)

        query = """
        {
          getMetric(metric: "social_dominance_total") {
            timeseriesData(
              slug: "%s"
              from: "%s"
              to: "%s"
              interval: "1d"
            ) {
              value
            }
          }
        }
        """ % (slug, day_ago.strftime("%Y-%m-%dT%H:%M:%SZ"), now.strftime("%Y-%m-%dT%H:%M:%SZ"))

        try:
            response = await client.post(
                self.BASE_URL,
                json={"query": query},
                headers={"Authorization": f"Apikey {self.api_key}"},
            )
            response.raise_for_status()
            result = response.json()

            timeseries = result.get("data", {}).get("getMetric", {}).get("timeseriesData", [])
            if timeseries:
                dominance = timeseries[-1]["value"]
                return {"social_dominance": round(dominance, 2)}

            return None

        except Exception as e:
            logger.debug(f"Santiment social dominance fetch failed: {e}")
            return None

    async def _fetch_dev_activity(
        self,
        client: httpx.AsyncClient,
        slug: str,
    ) -> Optional[Dict[str, Any]]:
        """Fetch development activity metric."""
        now = datetime.utcnow()
        week_ago = now - timedelta(days=7)

        query = """
        {
          getMetric(metric: "dev_activity") {
            timeseriesData(
              slug: "%s"
              from: "%s"
              to: "%s"
              interval: "1d"
            ) {
              value
            }
          }
        }
        """ % (slug, week_ago.strftime("%Y-%m-%dT%H:%M:%SZ"), now.strftime("%Y-%m-%dT%H:%M:%SZ"))

        try:
            response = await client.post(
                self.BASE_URL,
                json={"query": query},
                headers={"Authorization": f"Apikey {self.api_key}"},
            )
            response.raise_for_status()
            result = response.json()

            timeseries = result.get("data", {}).get("getMetric", {}).get("timeseriesData", [])
            if timeseries:
                # Average dev activity over the week
                values = [p["value"] for p in timeseries if p.get("value")]
                if values:
                    avg_dev = sum(values) / len(values)
                    return {"dev_activity": round(avg_dev, 1)}

            return None

        except Exception as e:
            logger.debug(f"Santiment dev activity fetch failed: {e}")
            return None


# Singleton
_santiment_source: Optional[SantimentDataSource] = None


def get_santiment_source() -> SantimentDataSource:
    """Get or create Santiment data source singleton."""
    global _santiment_source
    if _santiment_source is None:
        _santiment_source = SantimentDataSource()
    return _santiment_source
