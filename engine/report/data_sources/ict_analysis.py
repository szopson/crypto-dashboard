"""
ICT Analysis Data Source for PDF Reports.

Aggregates Smart Money Concept (SMC) data for investment reports:
- Market Structure (BOS, CHoCH, bias per timeframe)
- Liquidity Mapping (BSL, SSL levels)
- Fair Value Gaps (active FVGs)
- Open Interest analysis (OI correlation with price)
- Actionable signal summary

Note: This is for REPORTS, not real-time signals.
Session/killzone filtering is NOT applied here.
"""
import httpx
from datetime import datetime
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from loguru import logger

from calculations.structure import analyze_structure, detect_swings
from calculations.zones import analyze_zones
from calculations.liquidity import analyze_liquidity
from calculations.amd import analyze_amd


@dataclass
class StructureSummary:
    """Summary of market structure for a timeframe."""
    timeframe: str
    bias: str  # BULLISH, BEARISH, NEUTRAL
    last_swing_high: Optional[float]
    last_swing_low: Optional[float]
    bos_detected: bool  # Break of Structure
    choch_detected: bool  # Change of Character
    structure_pattern: str  # HH_HL, LH_LL, etc.


@dataclass
class LiquidityLevel:
    """A significant liquidity level."""
    price: float
    direction: str  # BSL (Buy Side Liquidity) or SSL (Sell Side Liquidity)
    strength: str  # HIGH, MEDIUM, LOW
    distance_pct: float  # Distance from current price
    swept: bool  # Has been taken


class ICTAnalysisDataSource:
    """
    ICT/SMC Analysis data aggregator for PDF reports.

    Provides structured market analysis data including:
    - Multi-timeframe structure analysis
    - Liquidity pool mapping
    - Fair Value Gap identification
    - Open Interest correlation
    """

    # Bybit API for OI data
    BYBIT_OI_URL = "https://api.bybit.com/v5/market/open-interest"
    BYBIT_KLINE_URL = "https://api.bybit.com/v5/market/kline"

    # Ticker mapping to Bybit symbols
    TICKER_TO_BYBIT = {
        "BTC": "BTCUSDT",
        "ETH": "ETHUSDT",
        "SOL": "SOLUSDT",
        "AAVE": "AAVEUSDT",
        "UNI": "UNIUSDT",
        "LINK": "LINKUSDT",
        "ARB": "ARBUSDT",
        "OP": "OPUSDT",
        "AVAX": "AVAXUSDT",
        "MATIC": "MATICUSDT",
        "DOGE": "DOGEUSDT",
        "XRP": "XRPUSDT",
        "ADA": "ADAUSDT",
        "DOT": "DOTUSDT",
        "ATOM": "ATOMUSDT",
        "NEAR": "NEARUSDT",
        "APT": "APTUSDT",
        "SUI": "SUIUSDT",
        "SEI": "SEIUSDT",
        "INJ": "INJUSDT",
        "TIA": "TIAUSDT",
        "JUP": "JUPUSDT",
        "PENDLE": "PENDLEUSDT",
        "GMX": "GMXUSDT",
        "DYDX": "DYDXUSDT",
        "MKR": "MKRUSDT",
        "CRV": "CRVUSDT",
        "LDO": "LDOUSDT",
        "FTM": "FTMUSDT",
        "PEPE": "PEPEUSDT",
        "WIF": "WIFUSDT",
        "BONK": "BONKUSDT",
    }

    async def fetch(self, ticker: str, ohlcv_4h: List[dict] = None, ohlcv_1h: List[dict] = None) -> Dict[str, Any]:
        """
        Fetch ICT analysis data for a token.

        Args:
            ticker: Token symbol (e.g., "AAVE", "SOL")
            ohlcv_4h: Optional 4H OHLCV data (will fetch if not provided)
            ohlcv_1h: Optional 1H OHLCV data (will fetch if not provided)

        Returns:
            Dict with ICT analysis data formatted for reports
        """
        result = {
            "has_ict_data": False,
            "market_structure": {},
            "liquidity_map": {},
            "fvg_zones": {},
            "oi_analysis": {},
            "signal_summary": {},
        }

        try:
            bybit_symbol = self.TICKER_TO_BYBIT.get(ticker.upper())
            if not bybit_symbol:
                logger.debug(f"No Bybit mapping for {ticker}, skipping ICT analysis")
                return result

            # Fetch OHLCV data if not provided
            if ohlcv_4h is None or ohlcv_1h is None:
                ohlcv_4h, ohlcv_1h = await self._fetch_ohlcv(bybit_symbol)

            if not ohlcv_4h or len(ohlcv_4h) < 50:
                logger.warning(f"Insufficient OHLCV data for {ticker}")
                return result

            current_price = ohlcv_4h[-1]["close"] if ohlcv_4h else 0

            # 1. Market Structure Analysis
            result["market_structure"] = self._analyze_market_structure(
                ohlcv_4h, ohlcv_1h, current_price
            )

            # 2. Liquidity Mapping
            result["liquidity_map"] = self._analyze_liquidity_levels(
                ohlcv_4h, current_price
            )

            # 3. FVG Zones
            result["fvg_zones"] = self._analyze_fvg_zones(
                ohlcv_4h, ohlcv_1h, current_price
            )

            # 4. Open Interest Analysis
            result["oi_analysis"] = await self._fetch_oi_analysis(
                bybit_symbol, current_price
            )

            # 5. Signal Summary
            result["signal_summary"] = self._generate_signal_summary(
                result["market_structure"],
                result["liquidity_map"],
                result["fvg_zones"],
                result["oi_analysis"],
                current_price,
            )

            result["has_ict_data"] = True
            result["current_price"] = current_price
            result["timestamp"] = datetime.utcnow().isoformat()

            logger.info(f"ICT analysis completed for {ticker}")

        except Exception as e:
            logger.error(f"ICT analysis failed for {ticker}: {e}")

        return result

    async def _fetch_ohlcv(self, symbol: str) -> tuple:
        """Fetch OHLCV data from Bybit."""
        ohlcv_4h = []
        ohlcv_1h = []

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                # Fetch 4H data (200 candles = ~33 days)
                response_4h = await client.get(
                    self.BYBIT_KLINE_URL,
                    params={
                        "category": "linear",
                        "symbol": symbol,
                        "interval": "240",  # 4 hours
                        "limit": 200,
                    }
                )
                if response_4h.status_code == 200:
                    data = response_4h.json()
                    if data.get("retCode") == 0:
                        ohlcv_4h = self._parse_bybit_klines(data.get("result", {}).get("list", []))

                # Fetch 1H data (200 candles = ~8 days)
                response_1h = await client.get(
                    self.BYBIT_KLINE_URL,
                    params={
                        "category": "linear",
                        "symbol": symbol,
                        "interval": "60",  # 1 hour
                        "limit": 200,
                    }
                )
                if response_1h.status_code == 200:
                    data = response_1h.json()
                    if data.get("retCode") == 0:
                        ohlcv_1h = self._parse_bybit_klines(data.get("result", {}).get("list", []))

        except Exception as e:
            logger.warning(f"Failed to fetch OHLCV for {symbol}: {e}")

        return ohlcv_4h, ohlcv_1h

    def _parse_bybit_klines(self, klines: List) -> List[dict]:
        """Parse Bybit kline response to OHLCV format."""
        result = []
        for k in reversed(klines):  # Bybit returns newest first
            try:
                result.append({
                    "timestamp": int(k[0]),
                    "datetime": datetime.utcfromtimestamp(int(k[0]) / 1000),
                    "open": float(k[1]),
                    "high": float(k[2]),
                    "low": float(k[3]),
                    "close": float(k[4]),
                    "volume": float(k[5]),
                })
            except (IndexError, ValueError):
                continue
        return result

    def _analyze_market_structure(
        self,
        ohlcv_4h: List[dict],
        ohlcv_1h: List[dict],
        current_price: float,
    ) -> Dict[str, Any]:
        """Analyze market structure on multiple timeframes."""
        result = {
            "htf_bias": "NEUTRAL",  # 4H bias
            "ltf_bias": "NEUTRAL",  # 1H bias
            "alignment": False,
            "htf_structure": {},
            "ltf_structure": {},
            "bos_levels": [],
            "choch_levels": [],
        }

        # 4H Structure (Higher Timeframe)
        if ohlcv_4h and len(ohlcv_4h) >= 50:
            htf_analysis = analyze_structure(ohlcv_4h, "4h", current_price)
            result["htf_bias"] = htf_analysis.get("bias", "NEUTRAL")
            result["htf_structure"] = {
                "structure": htf_analysis.get("structure", ""),
                "last_swing_high": htf_analysis.get("last_swing_high"),
                "last_swing_low": htf_analysis.get("last_swing_low"),
                "ss_price": htf_analysis.get("secondary_swing_price"),
                "ss_distance_pct": htf_analysis.get("ss_distance_pct"),
            }

            # Detect BOS/CHoCH levels
            swings = htf_analysis.get("swings", [])
            for swing in swings[-10:]:  # Last 10 swings
                if hasattr(swing, "label"):
                    if swing.label in ("HH", "LL"):
                        result["bos_levels"].append({
                            "price": swing.price,
                            "type": swing.label,
                            "direction": "BULLISH" if swing.label == "HH" else "BEARISH",
                        })
                    elif swing.label in ("LH", "HL"):
                        # CHoCH is when we get opposite swing after trend
                        result["choch_levels"].append({
                            "price": swing.price,
                            "type": swing.label,
                            "direction": "BEARISH" if swing.label == "LH" else "BULLISH",
                        })

        # 1H Structure (Lower Timeframe)
        if ohlcv_1h and len(ohlcv_1h) >= 50:
            ltf_analysis = analyze_structure(ohlcv_1h, "1h", current_price)
            result["ltf_bias"] = ltf_analysis.get("bias", "NEUTRAL")
            result["ltf_structure"] = {
                "structure": ltf_analysis.get("structure", ""),
                "last_swing_high": ltf_analysis.get("last_swing_high"),
                "last_swing_low": ltf_analysis.get("last_swing_low"),
            }

        # Check alignment
        result["alignment"] = (
            result["htf_bias"] == result["ltf_bias"] and
            result["htf_bias"] != "NEUTRAL"
        )

        return result

    def _analyze_liquidity_levels(
        self,
        ohlcv_4h: List[dict],
        current_price: float,
    ) -> Dict[str, Any]:
        """Map significant liquidity levels (BSL/SSL)."""
        result = {
            "bsl_levels": [],  # Buy Side Liquidity (above price)
            "ssl_levels": [],  # Sell Side Liquidity (below price)
            "nearest_bsl": None,
            "nearest_ssl": None,
            "liquidity_bias": "NEUTRAL",
        }

        if not ohlcv_4h or len(ohlcv_4h) < 30:
            return result

        # Use existing liquidity analysis
        liquidity_data = analyze_liquidity(ohlcv_4h, current_price)
        pools = liquidity_data.get("liquidity_pools", [])

        for pool in pools:
            level = {
                "price": pool.get("price", 0),
                "strength": pool.get("strength", "MEDIUM"),
                "distance_pct": abs(pool.get("price", current_price) - current_price) / current_price * 100 if current_price else 0,
                "swept": pool.get("swept", False),
            }

            if pool.get("direction") == "ABOVE":
                result["bsl_levels"].append(level)
            else:
                result["ssl_levels"].append(level)

        # Sort by distance
        result["bsl_levels"].sort(key=lambda x: x["distance_pct"])
        result["ssl_levels"].sort(key=lambda x: x["distance_pct"])

        # Get nearest levels
        if result["bsl_levels"]:
            result["nearest_bsl"] = result["bsl_levels"][0]
        if result["ssl_levels"]:
            result["nearest_ssl"] = result["ssl_levels"][0]

        # Determine liquidity bias (which side is closer/more attractive)
        if result["nearest_bsl"] and result["nearest_ssl"]:
            bsl_dist = result["nearest_bsl"]["distance_pct"]
            ssl_dist = result["nearest_ssl"]["distance_pct"]
            if bsl_dist < ssl_dist * 0.7:
                result["liquidity_bias"] = "BEARISH"  # BSL closer = likely to sweep up first
            elif ssl_dist < bsl_dist * 0.7:
                result["liquidity_bias"] = "BULLISH"  # SSL closer = likely to sweep down first

        return result

    def _analyze_fvg_zones(
        self,
        ohlcv_4h: List[dict],
        ohlcv_1h: List[dict],
        current_price: float,
    ) -> Dict[str, Any]:
        """Identify active Fair Value Gaps."""
        result = {
            "htf_fvgs": [],
            "ltf_fvgs": [],
            "nearest_bullish_fvg": None,
            "nearest_bearish_fvg": None,
            "fvg_count": 0,
        }

        # 4H FVGs
        if ohlcv_4h and len(ohlcv_4h) >= 30:
            htf_zones = analyze_zones(ohlcv_4h, current_price, include_ifvg=True)
            for fvg in htf_zones.get("fvgs", [])[:5]:  # Top 5 FVGs
                result["htf_fvgs"].append({
                    "type": fvg.get("type", ""),
                    "high": fvg.get("high", 0),
                    "low": fvg.get("low", 0),
                    "mid": (fvg.get("high", 0) + fvg.get("low", 0)) / 2,
                    "direction": "BULLISH" if "BULLISH" in fvg.get("type", "") else "BEARISH",
                    "mitigated": fvg.get("mitigated", False),
                })

        # 1H FVGs
        if ohlcv_1h and len(ohlcv_1h) >= 30:
            ltf_zones = analyze_zones(ohlcv_1h, current_price, include_ifvg=True)
            for fvg in ltf_zones.get("fvgs", [])[:5]:
                result["ltf_fvgs"].append({
                    "type": fvg.get("type", ""),
                    "high": fvg.get("high", 0),
                    "low": fvg.get("low", 0),
                    "mid": (fvg.get("high", 0) + fvg.get("low", 0)) / 2,
                    "direction": "BULLISH" if "BULLISH" in fvg.get("type", "") else "BEARISH",
                    "mitigated": fvg.get("mitigated", False),
                })

        # Find nearest FVGs
        all_fvgs = result["htf_fvgs"] + result["ltf_fvgs"]
        bullish_fvgs = [f for f in all_fvgs if f["direction"] == "BULLISH" and f["high"] < current_price]
        bearish_fvgs = [f for f in all_fvgs if f["direction"] == "BEARISH" and f["low"] > current_price]

        if bullish_fvgs:
            bullish_fvgs.sort(key=lambda x: current_price - x["high"])
            result["nearest_bullish_fvg"] = bullish_fvgs[0]

        if bearish_fvgs:
            bearish_fvgs.sort(key=lambda x: x["low"] - current_price)
            result["nearest_bearish_fvg"] = bearish_fvgs[0]

        result["fvg_count"] = len(all_fvgs)

        return result

    async def _fetch_oi_analysis(
        self,
        symbol: str,
        current_price: float,
    ) -> Dict[str, Any]:
        """Fetch and analyze Open Interest data from Bybit."""
        result = {
            "has_oi_data": False,
            "current_oi": None,
            "oi_change_24h": None,
            "oi_change_7d": None,
            "oi_price_divergence": None,  # OI up + price down = bearish divergence
            "funding_rate": None,
            "oi_signal": "NEUTRAL",
        }

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                # Fetch current OI
                response = await client.get(
                    self.BYBIT_OI_URL,
                    params={
                        "category": "linear",
                        "symbol": symbol,
                        "intervalTime": "1h",
                        "limit": 168,  # 7 days of hourly data
                    }
                )

                if response.status_code != 200:
                    return result

                data = response.json()
                if data.get("retCode") != 0:
                    return result

                oi_list = data.get("result", {}).get("list", [])
                if not oi_list:
                    return result

                # Parse OI data (newest first)
                current_oi = float(oi_list[0].get("openInterest", 0))
                oi_24h_ago = float(oi_list[23].get("openInterest", 0)) if len(oi_list) > 23 else current_oi
                oi_7d_ago = float(oi_list[-1].get("openInterest", 0)) if len(oi_list) >= 168 else current_oi

                result["has_oi_data"] = True
                result["current_oi"] = current_oi
                result["oi_change_24h"] = ((current_oi - oi_24h_ago) / oi_24h_ago * 100) if oi_24h_ago else 0
                result["oi_change_7d"] = ((current_oi - oi_7d_ago) / oi_7d_ago * 100) if oi_7d_ago else 0

                # Fetch funding rate
                funding_response = await client.get(
                    "https://api.bybit.com/v5/market/funding/history",
                    params={
                        "category": "linear",
                        "symbol": symbol,
                        "limit": 1,
                    }
                )
                if funding_response.status_code == 200:
                    funding_data = funding_response.json()
                    if funding_data.get("retCode") == 0:
                        funding_list = funding_data.get("result", {}).get("list", [])
                        if funding_list:
                            result["funding_rate"] = float(funding_list[0].get("fundingRate", 0)) * 100

                # Determine OI signal
                oi_change = result["oi_change_24h"] or 0
                funding = result["funding_rate"] or 0

                if oi_change > 5 and funding > 0.02:
                    result["oi_signal"] = "OVERBOUGHT"  # High OI + positive funding = crowded long
                elif oi_change > 5 and funding < -0.02:
                    result["oi_signal"] = "OVERSOLD"  # High OI + negative funding = crowded short
                elif oi_change < -5:
                    result["oi_signal"] = "DELEVERAGING"
                elif abs(oi_change) < 2:
                    result["oi_signal"] = "NEUTRAL"
                else:
                    result["oi_signal"] = "BUILDING"

                logger.debug(f"OI analysis for {symbol}: OI={current_oi:,.0f}, 24h change={oi_change:.1f}%")

        except Exception as e:
            logger.warning(f"OI fetch failed for {symbol}: {e}")

        return result

    def _generate_signal_summary(
        self,
        structure: Dict[str, Any],
        liquidity: Dict[str, Any],
        fvg: Dict[str, Any],
        oi: Dict[str, Any],
        current_price: float,
    ) -> Dict[str, Any]:
        """Generate actionable signal summary from ICT analysis."""
        result = {
            "bias": "NEUTRAL",
            "confidence": 0,
            "setup_type": None,
            "entry_zone": None,
            "stop_loss": None,
            "targets": [],
            "key_level": None,
            "narrative": "",
        }

        # Count bullish/bearish signals
        bullish_signals = 0
        bearish_signals = 0

        # Structure bias
        htf_bias = structure.get("htf_bias", "NEUTRAL")
        ltf_bias = structure.get("ltf_bias", "NEUTRAL")
        alignment = structure.get("alignment", False)

        if htf_bias == "BULLISH":
            bullish_signals += 2
        elif htf_bias == "BEARISH":
            bearish_signals += 2

        if ltf_bias == "BULLISH":
            bullish_signals += 1
        elif ltf_bias == "BEARISH":
            bearish_signals += 1

        if alignment:
            if htf_bias == "BULLISH":
                bullish_signals += 1
            elif htf_bias == "BEARISH":
                bearish_signals += 1

        # Liquidity bias
        liq_bias = liquidity.get("liquidity_bias", "NEUTRAL")
        if liq_bias == "BULLISH":
            bullish_signals += 1
        elif liq_bias == "BEARISH":
            bearish_signals += 1

        # OI signal
        oi_signal = oi.get("oi_signal", "NEUTRAL")
        if oi_signal == "OVERSOLD":
            bullish_signals += 1
        elif oi_signal == "OVERBOUGHT":
            bearish_signals += 1

        # Determine overall bias
        total_signals = bullish_signals + bearish_signals
        if total_signals == 0:
            result["bias"] = "NEUTRAL"
            result["confidence"] = 0
        elif bullish_signals > bearish_signals:
            result["bias"] = "BULLISH"
            result["confidence"] = int((bullish_signals / (total_signals + 2)) * 100)
        else:
            result["bias"] = "BEARISH"
            result["confidence"] = int((bearish_signals / (total_signals + 2)) * 100)

        # Determine setup type and levels
        if result["bias"] == "BULLISH":
            # Look for bullish FVG as entry
            if fvg.get("nearest_bullish_fvg"):
                nearest_fvg = fvg["nearest_bullish_fvg"]
                result["setup_type"] = "FVG_RETEST"
                result["entry_zone"] = {
                    "low": nearest_fvg["low"],
                    "high": nearest_fvg["high"],
                    "mid": nearest_fvg["mid"],
                }
            # Use SSL as stop loss area
            if liquidity.get("nearest_ssl"):
                ssl = liquidity["nearest_ssl"]
                result["stop_loss"] = ssl["price"] * 0.99  # Slightly below SSL

            # Use BSL as targets
            for bsl in liquidity.get("bsl_levels", [])[:3]:
                result["targets"].append(bsl["price"])

            result["key_level"] = structure.get("htf_structure", {}).get("last_swing_low")

        elif result["bias"] == "BEARISH":
            # Look for bearish FVG as entry
            if fvg.get("nearest_bearish_fvg"):
                nearest_fvg = fvg["nearest_bearish_fvg"]
                result["setup_type"] = "FVG_RETEST"
                result["entry_zone"] = {
                    "low": nearest_fvg["low"],
                    "high": nearest_fvg["high"],
                    "mid": nearest_fvg["mid"],
                }
            # Use BSL as stop loss area
            if liquidity.get("nearest_bsl"):
                bsl = liquidity["nearest_bsl"]
                result["stop_loss"] = bsl["price"] * 1.01  # Slightly above BSL

            # Use SSL as targets
            for ssl in liquidity.get("ssl_levels", [])[:3]:
                result["targets"].append(ssl["price"])

            result["key_level"] = structure.get("htf_structure", {}).get("last_swing_high")

        # Generate narrative
        result["narrative"] = self._generate_narrative(
            result, structure, liquidity, oi, current_price
        )

        return result

    def _generate_narrative(
        self,
        summary: Dict[str, Any],
        structure: Dict[str, Any],
        liquidity: Dict[str, Any],
        oi: Dict[str, Any],
        current_price: float,
    ) -> str:
        """Generate human-readable narrative for the signal."""
        bias = summary.get("bias", "NEUTRAL")
        confidence = summary.get("confidence", 0)
        htf_bias = structure.get("htf_bias", "NEUTRAL")
        alignment = structure.get("alignment", False)

        if bias == "NEUTRAL":
            return "Market structure is unclear. Wait for clear directional bias before taking positions."

        direction = "bullish" if bias == "BULLISH" else "bearish"
        action = "long" if bias == "BULLISH" else "short"

        narrative_parts = []

        # Structure context
        if alignment:
            narrative_parts.append(f"HTF (4H) and LTF (1H) structure are aligned {direction.upper()}.")
        else:
            narrative_parts.append(f"HTF (4H) shows {htf_bias} bias.")

        # Liquidity context
        if bias == "BULLISH" and liquidity.get("nearest_ssl"):
            ssl = liquidity["nearest_ssl"]
            narrative_parts.append(f"SSL at ${ssl['price']:,.2f} ({ssl['distance_pct']:.1f}% below) may be swept before reversal.")
        elif bias == "BEARISH" and liquidity.get("nearest_bsl"):
            bsl = liquidity["nearest_bsl"]
            narrative_parts.append(f"BSL at ${bsl['price']:,.2f} ({bsl['distance_pct']:.1f}% above) may be swept before reversal.")

        # OI context
        oi_signal = oi.get("oi_signal", "NEUTRAL")
        if oi_signal == "OVERBOUGHT":
            narrative_parts.append("OI analysis shows crowded longs - potential for squeeze.")
        elif oi_signal == "OVERSOLD":
            narrative_parts.append("OI analysis shows crowded shorts - potential for squeeze.")
        elif oi.get("funding_rate"):
            funding = oi["funding_rate"]
            if abs(funding) > 0.01:
                narrative_parts.append(f"Funding rate at {funding:.3f}% indicates {'long' if funding > 0 else 'short'}-heavy positioning.")

        # Entry zone
        if summary.get("entry_zone"):
            zone = summary["entry_zone"]
            narrative_parts.append(f"Look for {action} entry in FVG zone ${zone['low']:,.2f} - ${zone['high']:,.2f}.")

        # Confidence
        if confidence >= 70:
            narrative_parts.append(f"High confidence setup ({confidence}%).")
        elif confidence >= 50:
            narrative_parts.append(f"Moderate confidence ({confidence}%). Wait for confirmation.")
        else:
            narrative_parts.append(f"Low confidence ({confidence}%). Exercise caution.")

        return " ".join(narrative_parts)


# Singleton
_ict_analysis_source: Optional[ICTAnalysisDataSource] = None


def get_ict_analysis_source() -> ICTAnalysisDataSource:
    """Get or create ICT analysis data source singleton."""
    global _ict_analysis_source
    if _ict_analysis_source is None:
        _ict_analysis_source = ICTAnalysisDataSource()
    return _ict_analysis_source
