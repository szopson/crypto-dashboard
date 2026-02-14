"""
Liquidity Sweep Detection Module.

Detects when price takes out a prior swing high/low (liquidity grab)
and then rejects, indicating smart money manipulation.

Key concepts:
- Liquidity pools exist above swing highs (stop losses for shorts)
- Liquidity pools exist below swing lows (stop losses for longs)
- When price sweeps these levels and rejects, it's often a reversal signal
"""
from datetime import datetime
from typing import Literal, Optional
from dataclasses import dataclass

import numpy as np

from calculations.structure import Swing, detect_swings


@dataclass
class LiquiditySweep:
    """Represents a liquidity sweep event."""
    direction: Literal["BULLISH", "BEARISH"]  # Direction of expected move AFTER sweep
    sweep_type: Literal["HIGH_SWEEP", "LOW_SWEEP"]
    swept_level: float  # The swing high/low that was taken
    sweep_extreme: float  # How far price went past the level
    rejection_candle_index: int
    rejection_timestamp: datetime
    wick_ratio: float  # How much of candle is rejection wick
    penetration_pct: float  # How far price penetrated past the level
    is_valid: bool  # Meets minimum criteria


def detect_liquidity_sweeps(
    ohlcv_data: list[dict],
    swings: list[Swing] = None,
    min_wick_ratio: float = 0.5,
    min_penetration_ticks: float = 0.0,
    lookback_swings: int = 5,
) -> list[LiquiditySweep]:
    """
    Detect liquidity sweep events in price data.

    A liquidity sweep occurs when:
    1. Price takes out a prior swing high/low
    2. Price rejects from that level (long wick)
    3. Closes back below/above the swept level

    Bullish sweep (sweep of lows):
    - Price trades below prior swing low
    - Wick shows rejection (close above the low)
    - Expect bullish move

    Bearish sweep (sweep of highs):
    - Price trades above prior swing high
    - Wick shows rejection (close below the high)
    - Expect bearish move

    Args:
        ohlcv_data: OHLCV candle data
        swings: Pre-computed swings (will detect if not provided)
        min_wick_ratio: Minimum wick-to-body ratio for valid rejection
        min_penetration_ticks: Minimum penetration past the level
        lookback_swings: Number of recent swings to check for sweeps

    Returns:
        List of detected liquidity sweeps
    """
    if len(ohlcv_data) < 20:
        return []

    # Detect swings if not provided
    if swings is None:
        swings = detect_swings(ohlcv_data, lookback=5)

    if len(swings) < 2:
        return []

    sweeps = []

    # Get recent swing highs and lows
    swing_highs = [s for s in swings if s.type == "HIGH"][-lookback_swings:]
    swing_lows = [s for s in swings if s.type == "LOW"][-lookback_swings:]

    # Check each candle for sweep patterns
    for i in range(len(ohlcv_data) - 1):  # Skip last candle (incomplete)
        candle = ohlcv_data[i]

        timestamp = candle.get("datetime") or candle.get("timestamp")
        if isinstance(timestamp, (int, float)):
            timestamp = datetime.utcfromtimestamp(timestamp / 1000)
        elif isinstance(timestamp, str):
            timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00").replace("+00:00", ""))

        # Calculate candle metrics
        candle_range = candle["high"] - candle["low"]
        if candle_range == 0:
            continue

        body_top = max(candle["open"], candle["close"])
        body_bottom = min(candle["open"], candle["close"])
        body_size = body_top - body_bottom

        upper_wick = candle["high"] - body_top
        lower_wick = body_bottom - candle["low"]

        # Check for sweep of highs (bearish sweep)
        for swing in swing_highs:
            if swing.index >= i:  # Only check swings formed before this candle
                continue

            # Did this candle sweep the swing high?
            if candle["high"] > swing.price and candle["close"] < swing.price:
                penetration = candle["high"] - swing.price
                penetration_pct = (penetration / swing.price) * 100

                # Calculate wick ratio (upper wick vs total range)
                wick_ratio = upper_wick / candle_range if candle_range > 0 else 0

                is_valid = (
                    wick_ratio >= min_wick_ratio and
                    penetration >= min_penetration_ticks
                )

                sweeps.append(LiquiditySweep(
                    direction="BEARISH",
                    sweep_type="HIGH_SWEEP",
                    swept_level=swing.price,
                    sweep_extreme=candle["high"],
                    rejection_candle_index=i,
                    rejection_timestamp=timestamp,
                    wick_ratio=round(wick_ratio, 3),
                    penetration_pct=round(penetration_pct, 4),
                    is_valid=is_valid,
                ))

        # Check for sweep of lows (bullish sweep)
        for swing in swing_lows:
            if swing.index >= i:  # Only check swings formed before this candle
                continue

            # Did this candle sweep the swing low?
            if candle["low"] < swing.price and candle["close"] > swing.price:
                penetration = swing.price - candle["low"]
                penetration_pct = (penetration / swing.price) * 100

                # Calculate wick ratio (lower wick vs total range)
                wick_ratio = lower_wick / candle_range if candle_range > 0 else 0

                is_valid = (
                    wick_ratio >= min_wick_ratio and
                    penetration >= min_penetration_ticks
                )

                sweeps.append(LiquiditySweep(
                    direction="BULLISH",
                    sweep_type="LOW_SWEEP",
                    swept_level=swing.price,
                    sweep_extreme=candle["low"],
                    rejection_candle_index=i,
                    rejection_timestamp=timestamp,
                    wick_ratio=round(wick_ratio, 3),
                    penetration_pct=round(penetration_pct, 4),
                    is_valid=is_valid,
                ))

    return sweeps


def get_recent_sweep(
    ohlcv_data: list[dict],
    swings: list[Swing] = None,
    direction: Literal["BULLISH", "BEARISH"] = None,
    max_candles_ago: int = 10,
) -> Optional[LiquiditySweep]:
    """
    Get the most recent valid liquidity sweep.

    Args:
        ohlcv_data: OHLCV data
        swings: Pre-computed swings
        direction: Filter by expected direction (BULLISH or BEARISH)
        max_candles_ago: Only consider sweeps within this many candles

    Returns:
        Most recent sweep or None
    """
    sweeps = detect_liquidity_sweeps(ohlcv_data, swings)

    if not sweeps:
        return None

    # Filter valid sweeps
    valid_sweeps = [s for s in sweeps if s.is_valid]

    if not valid_sweeps:
        return None

    # Filter by direction if specified
    if direction:
        valid_sweeps = [s for s in valid_sweeps if s.direction == direction]

    if not valid_sweeps:
        return None

    # Filter by recency
    current_index = len(ohlcv_data) - 1
    recent_sweeps = [
        s for s in valid_sweeps
        if current_index - s.rejection_candle_index <= max_candles_ago
    ]

    if not recent_sweeps:
        return None

    # Return most recent
    return max(recent_sweeps, key=lambda s: s.rejection_candle_index)


def analyze_liquidity(
    ohlcv_data: list[dict],
    current_price: float = None,
) -> dict:
    """
    Complete liquidity analysis for OHLCV data.

    Args:
        ohlcv_data: OHLCV data
        current_price: Current price

    Returns:
        Dictionary with liquidity analysis
    """
    if not ohlcv_data or len(ohlcv_data) < 20:
        return {
            "sweeps": [],
            "recent_bullish_sweep": None,
            "recent_bearish_sweep": None,
            "liquidity_pools": [],
        }

    if current_price is None:
        current_price = ohlcv_data[-1]["close"]

    # Detect swings and sweeps
    swings = detect_swings(ohlcv_data, lookback=5)
    sweeps = detect_liquidity_sweeps(ohlcv_data, swings)

    # Get recent sweeps by direction
    recent_bullish = get_recent_sweep(ohlcv_data, swings, direction="BULLISH")
    recent_bearish = get_recent_sweep(ohlcv_data, swings, direction="BEARISH")

    # Identify untouched liquidity pools (swing highs/lows not yet swept)
    swing_highs = [s for s in swings if s.type == "HIGH"]
    swing_lows = [s for s in swings if s.type == "LOW"]

    swept_highs = {s.swept_level for s in sweeps if s.sweep_type == "HIGH_SWEEP"}
    swept_lows = {s.swept_level for s in sweeps if s.sweep_type == "LOW_SWEEP"}

    liquidity_pools = []

    # Unswept highs above current price = bearish liquidity target
    for swing in swing_highs[-10:]:
        if swing.price not in swept_highs and swing.price > current_price:
            distance_pct = ((swing.price - current_price) / current_price) * 100
            liquidity_pools.append({
                "type": "HIGH",
                "price": swing.price,
                "distance_pct": round(distance_pct, 2),
                "direction": "ABOVE",
            })

    # Unswept lows below current price = bullish liquidity target
    for swing in swing_lows[-10:]:
        if swing.price not in swept_lows and swing.price < current_price:
            distance_pct = ((current_price - swing.price) / current_price) * 100
            liquidity_pools.append({
                "type": "LOW",
                "price": swing.price,
                "distance_pct": round(distance_pct, 2),
                "direction": "BELOW",
            })

    # Sort by distance
    liquidity_pools.sort(key=lambda x: x["distance_pct"])

    # Format sweeps for output
    sweep_list = [
        {
            "direction": s.direction,
            "type": s.sweep_type,
            "swept_level": s.swept_level,
            "sweep_extreme": s.sweep_extreme,
            "wick_ratio": s.wick_ratio,
            "penetration_pct": s.penetration_pct,
            "is_valid": s.is_valid,
            "timestamp": s.rejection_timestamp.isoformat() if s.rejection_timestamp else None,
        }
        for s in sweeps[-10:]  # Last 10 sweeps
    ]

    return {
        "sweeps": sweep_list,
        "recent_bullish_sweep": {
            "swept_level": recent_bullish.swept_level,
            "sweep_extreme": recent_bullish.sweep_extreme,
            "wick_ratio": recent_bullish.wick_ratio,
            "timestamp": recent_bullish.rejection_timestamp.isoformat(),
        } if recent_bullish else None,
        "recent_bearish_sweep": {
            "swept_level": recent_bearish.swept_level,
            "sweep_extreme": recent_bearish.sweep_extreme,
            "wick_ratio": recent_bearish.wick_ratio,
            "timestamp": recent_bearish.rejection_timestamp.isoformat(),
        } if recent_bearish else None,
        "liquidity_pools": liquidity_pools[:5],  # Top 5 nearest
        "current_price": current_price,
    }
