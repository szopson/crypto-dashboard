"""
Bitcoin Cycle & Altseason Analysis.

Analyzes BTC market cycle position and altseason probability
to provide macro context for investment decisions.
"""
import httpx
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from dataclasses import dataclass
from loguru import logger


@dataclass
class BitcoinCycleData:
    """Bitcoin cycle analysis data."""
    # BTC metrics
    btc_price: float
    btc_dominance: float
    btc_dominance_change_30d: float

    # Cycle position
    cycle_phase: str  # "accumulation", "markup", "distribution", "markdown"
    cycle_confidence: float  # 0-100%

    # Moving averages
    btc_200ma: float
    btc_vs_200ma_percent: float  # How far above/below 200MA

    # Altseason
    altseason_score: int  # 0-100 (75+ = altseason)
    altseason_phase: str  # "btc_season", "neutral", "altseason"

    # Fear & Greed
    fear_greed_index: int
    fear_greed_label: str

    # Halving
    days_since_halving: int
    halving_cycle_percent: float  # 0-100% through 4-year cycle

    # Summary
    macro_outlook: str  # "bullish", "neutral", "bearish"
    recommendation: str  # Brief recommendation based on cycle


class BitcoinCycleAnalyzer:
    """
    Analyzes Bitcoin market cycles for macro context.

    Data sources:
    - CoinGecko: BTC price, dominance, market data
    - Alternative.me: Fear & Greed Index
    """

    COINGECKO_URL = "https://api.coingecko.com/api/v3"

    # Bitcoin halving dates
    HALVING_DATES = [
        datetime(2012, 11, 28),  # Halving 1
        datetime(2016, 7, 9),    # Halving 2
        datetime(2020, 5, 11),   # Halving 3
        datetime(2024, 4, 20),   # Halving 4 (approximate)
    ]

    # Cycle phase thresholds (based on 200MA)
    CYCLE_THRESHOLDS = {
        "accumulation": (-50, -10),   # 10-50% below 200MA
        "markup": (-10, 100),          # Near 200MA to 100% above
        "distribution": (100, 200),    # 100-200% above 200MA
        "markdown": (-100, -50),       # More than 50% below 200MA
    }

    async def fetch(self) -> Dict[str, Any]:
        """
        Fetch Bitcoin cycle data from multiple sources.

        Returns:
            Dict with cycle analysis data
        """
        data = {
            "btc_price": None,
            "btc_dominance": None,
            "btc_dominance_change_30d": None,
            "cycle_phase": "unknown",
            "cycle_confidence": 0,
            "btc_200ma": None,
            "btc_vs_200ma_percent": None,
            "altseason_score": 50,
            "altseason_phase": "neutral",
            "fear_greed_index": 50,
            "fear_greed_label": "Neutral",
            "days_since_halving": 0,
            "halving_cycle_percent": 0,
            "macro_outlook": "neutral",
            "recommendation": "",
        }

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                # Fetch BTC data and global data in parallel
                btc_task = self._fetch_btc_data(client)
                global_task = self._fetch_global_data(client)
                fear_greed_task = self._fetch_fear_greed(client)

                btc_data, global_data, fear_greed = await asyncio.gather(
                    btc_task, global_task, fear_greed_task,
                    return_exceptions=True
                )

                # Process BTC data
                if not isinstance(btc_data, Exception) and btc_data:
                    data["btc_price"] = btc_data.get("current_price")
                    # Calculate 200MA approximation from ATH ratio
                    ath = btc_data.get("ath", 0)
                    if ath and data["btc_price"]:
                        # Rough 200MA estimate: ~40-60% of ATH during bull markets
                        data["btc_200ma"] = ath * 0.5
                        data["btc_vs_200ma_percent"] = ((data["btc_price"] / data["btc_200ma"]) - 1) * 100

                # Process global data
                if not isinstance(global_data, Exception) and global_data:
                    data["btc_dominance"] = global_data.get("btc_dominance", 0)
                    data["btc_dominance_change_30d"] = global_data.get("btc_dominance_change_30d", 0)

                # Process Fear & Greed
                if not isinstance(fear_greed, Exception) and fear_greed:
                    data["fear_greed_index"] = fear_greed.get("value", 50)
                    data["fear_greed_label"] = fear_greed.get("label", "Neutral")

                # Calculate derived metrics
                data = self._calculate_cycle_phase(data)
                data = self._calculate_altseason(data)
                data = self._calculate_halving_position(data)
                data = self._generate_outlook(data)

                logger.info(f"Bitcoin cycle data: phase={data['cycle_phase']}, altseason={data['altseason_score']}, dominance={data['btc_dominance']:.1f}%")

        except Exception as e:
            logger.error(f"Bitcoin cycle analysis failed: {e}")

        return data

    async def _fetch_btc_data(self, client: httpx.AsyncClient) -> Dict[str, Any]:
        """Fetch BTC price and market data."""
        try:
            response = await client.get(
                f"{self.COINGECKO_URL}/coins/bitcoin",
                params={
                    "localization": "false",
                    "tickers": "false",
                    "market_data": "true",
                    "community_data": "false",
                    "developer_data": "false",
                }
            )
            response.raise_for_status()
            data = response.json()

            market = data.get("market_data", {})
            return {
                "current_price": market.get("current_price", {}).get("usd"),
                "ath": market.get("ath", {}).get("usd"),
                "ath_change_percentage": market.get("ath_change_percentage", {}).get("usd"),
                "price_change_30d": market.get("price_change_percentage_30d"),
                "price_change_200d": market.get("price_change_percentage_200d"),
            }
        except Exception as e:
            logger.warning(f"Failed to fetch BTC data: {e}")
            return {}

    async def _fetch_global_data(self, client: httpx.AsyncClient) -> Dict[str, Any]:
        """Fetch global crypto market data."""
        try:
            response = await client.get(f"{self.COINGECKO_URL}/global")
            response.raise_for_status()
            data = response.json().get("data", {})

            btc_dom = data.get("market_cap_percentage", {}).get("btc", 0)
            btc_dom_change = data.get("market_cap_change_percentage_24h_usd", 0)

            return {
                "btc_dominance": btc_dom,
                "btc_dominance_change_30d": btc_dom_change,  # Approximation
                "total_market_cap": data.get("total_market_cap", {}).get("usd"),
                "total_volume": data.get("total_volume", {}).get("usd"),
            }
        except Exception as e:
            logger.warning(f"Failed to fetch global data: {e}")
            return {}

    async def _fetch_fear_greed(self, client: httpx.AsyncClient) -> Dict[str, Any]:
        """Fetch Fear & Greed Index from Alternative.me."""
        try:
            response = await client.get("https://api.alternative.me/fng/")
            response.raise_for_status()
            data = response.json().get("data", [{}])[0]

            return {
                "value": int(data.get("value", 50)),
                "label": data.get("value_classification", "Neutral"),
            }
        except Exception as e:
            logger.warning(f"Failed to fetch Fear & Greed: {e}")
            return {"value": 50, "label": "Neutral"}

    def _calculate_cycle_phase(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Determine current cycle phase based on 200MA position."""
        vs_200ma = data.get("btc_vs_200ma_percent", 0)

        if vs_200ma is None:
            data["cycle_phase"] = "unknown"
            data["cycle_confidence"] = 0
            return data

        # Determine phase
        if vs_200ma < -30:
            data["cycle_phase"] = "accumulation"
            data["cycle_confidence"] = min(90, 50 + abs(vs_200ma))
        elif vs_200ma < 20:
            data["cycle_phase"] = "early_markup"
            data["cycle_confidence"] = 70
        elif vs_200ma < 80:
            data["cycle_phase"] = "markup"
            data["cycle_confidence"] = 80
        elif vs_200ma < 150:
            data["cycle_phase"] = "late_markup"
            data["cycle_confidence"] = 75
        else:
            data["cycle_phase"] = "distribution"
            data["cycle_confidence"] = 85

        return data

    def _calculate_altseason(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculate altseason score based on BTC dominance.

        Altseason typically occurs when:
        - BTC dominance is falling (below 50%)
        - BTC has already made significant gains
        - Capital rotates to altcoins
        """
        btc_dom = data.get("btc_dominance", 50)
        btc_dom_change = data.get("btc_dominance_change_30d", 0)

        # Base score from dominance level
        # Lower dominance = higher altseason probability
        if btc_dom > 60:
            base_score = 20
        elif btc_dom > 55:
            base_score = 35
        elif btc_dom > 50:
            base_score = 50
        elif btc_dom > 45:
            base_score = 65
        elif btc_dom > 40:
            base_score = 80
        else:
            base_score = 90

        # Adjust for trend
        if btc_dom_change < -2:
            base_score += 10  # Dominance falling = more alt-friendly
        elif btc_dom_change > 2:
            base_score -= 10  # Dominance rising = less alt-friendly

        # Clamp to 0-100
        data["altseason_score"] = max(0, min(100, base_score))

        # Determine phase
        if data["altseason_score"] >= 75:
            data["altseason_phase"] = "altseason"
        elif data["altseason_score"] >= 40:
            data["altseason_phase"] = "neutral"
        else:
            data["altseason_phase"] = "btc_season"

        return data

    def _calculate_halving_position(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate position in the 4-year halving cycle."""
        now = datetime.now()

        # Find most recent halving
        last_halving = None
        for halving in self.HALVING_DATES:
            if halving <= now:
                last_halving = halving

        if last_halving:
            days_since = (now - last_halving).days
            data["days_since_halving"] = days_since

            # ~1460 days (4 years) between halvings
            cycle_length = 1460
            data["halving_cycle_percent"] = min(100, (days_since / cycle_length) * 100)

        return data

    def _generate_outlook(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate macro outlook and recommendation."""
        cycle_phase = data.get("cycle_phase", "unknown")
        altseason_phase = data.get("altseason_phase", "neutral")
        fear_greed = data.get("fear_greed_index", 50)
        halving_percent = data.get("halving_cycle_percent", 50)

        # Determine macro outlook
        bullish_signals = 0
        bearish_signals = 0

        # Cycle phase signals
        if cycle_phase in ["accumulation", "early_markup"]:
            bullish_signals += 2
        elif cycle_phase in ["markup"]:
            bullish_signals += 1
        elif cycle_phase in ["distribution"]:
            bearish_signals += 2

        # Halving cycle (typically bullish 6-18 months post-halving)
        if 10 < halving_percent < 50:
            bullish_signals += 1
        elif halving_percent > 80:
            bearish_signals += 1

        # Fear & Greed contrarian
        if fear_greed < 25:
            bullish_signals += 1  # Extreme fear = buying opportunity
        elif fear_greed > 75:
            bearish_signals += 1  # Extreme greed = caution

        # Calculate outlook
        if bullish_signals > bearish_signals + 1:
            data["macro_outlook"] = "bullish"
        elif bearish_signals > bullish_signals + 1:
            data["macro_outlook"] = "bearish"
        else:
            data["macro_outlook"] = "neutral"

        # Generate recommendation
        recommendations = []

        if cycle_phase == "accumulation":
            recommendations.append("BTC in accumulation phase - historically good entry for long-term positions")
        elif cycle_phase == "distribution":
            recommendations.append("BTC showing distribution signals - consider taking profits on positions")

        if altseason_phase == "altseason":
            recommendations.append("Altseason conditions present - altcoins may outperform BTC")
        elif altseason_phase == "btc_season":
            recommendations.append("BTC dominance rising - favor BTC over altcoins")

        if fear_greed < 25:
            recommendations.append("Extreme fear - contrarian buying opportunity")
        elif fear_greed > 75:
            recommendations.append("Extreme greed - exercise caution")

        data["recommendation"] = " | ".join(recommendations) if recommendations else "Monitor market conditions"

        return data


# Singleton
_analyzer: Optional[BitcoinCycleAnalyzer] = None


def get_bitcoin_cycle_analyzer() -> BitcoinCycleAnalyzer:
    """Get or create Bitcoin cycle analyzer singleton."""
    global _analyzer
    if _analyzer is None:
        _analyzer = BitcoinCycleAnalyzer()
    return _analyzer


# For async compatibility
import asyncio
