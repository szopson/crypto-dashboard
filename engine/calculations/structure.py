"""
Structural Analysis Module.

Implements:
- Swing High/Low detection
- Secondary Swing (SS) tracking
- Structural bias determination (HH/HL = Bullish, LH/LL = Bearish)
- Automatic bias flip when SS is broken
"""
import numpy as np
from datetime import datetime
from typing import Optional, Literal
from dataclasses import dataclass

from calculations.indicators import highest, lowest


@dataclass
class Swing:
    """Represents a swing point (high or low)."""
    type: Literal["HIGH", "LOW"]
    price: float
    timestamp: datetime
    index: int
    label: Optional[str] = None  # HH, HL, LH, LL


@dataclass
class StructuralBias:
    """Structural bias result."""
    bias: Literal["BULLISH", "BEARISH", "NEUTRAL", "CHOPPY"]
    structure: str  # HH_HL, LH_LL, etc.
    secondary_swing_price: Optional[float]
    secondary_swing_type: Optional[str]  # HIGH or LOW
    ss_distance_pct: Optional[float]
    last_swing_high: Optional[float]
    last_swing_low: Optional[float]
    reason: str
    swings: list[Swing]


def detect_swings(
    ohlcv_data: list[dict],
    lookback: int = 5
) -> list[Swing]:
    """
    Detect swing highs and lows in price data.

    A Swing High is a candle whose high is the maximum in the window [i-lookback, i+lookback].
    A Swing Low is a candle whose low is the minimum in the window [i-lookback, i+lookback].

    Args:
        ohlcv_data: List of OHLCV dictionaries
        lookback: Number of candles to look back/forward for swing detection

    Returns:
        List of Swing objects sorted by time
    """
    if len(ohlcv_data) < lookback * 3:
        return []

    highs = np.array([c["high"] for c in ohlcv_data])
    lows = np.array([c["low"] for c in ohlcv_data])

    swings = []

    for i in range(lookback, len(ohlcv_data) - lookback):
        # Window indices
        start = max(0, i - lookback)
        end = min(len(ohlcv_data), i + lookback + 1)

        window_highs = highs[start:end]
        window_lows = lows[start:end]

        current_high = highs[i]
        current_low = lows[i]

        # Check for swing high
        if current_high == np.max(window_highs):
            timestamp = ohlcv_data[i].get("datetime") or ohlcv_data[i].get("timestamp")
            if isinstance(timestamp, (int, float)):
                timestamp = datetime.utcfromtimestamp(timestamp / 1000)
            elif isinstance(timestamp, str):
                timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00").replace("+00:00", ""))

            swings.append(Swing(
                type="HIGH",
                price=current_high,
                timestamp=timestamp,
                index=i,
            ))

        # Check for swing low
        if current_low == np.min(window_lows):
            timestamp = ohlcv_data[i].get("datetime") or ohlcv_data[i].get("timestamp")
            if isinstance(timestamp, (int, float)):
                timestamp = datetime.utcfromtimestamp(timestamp / 1000)
            elif isinstance(timestamp, str):
                timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00").replace("+00:00", ""))

            swings.append(Swing(
                type="LOW",
                price=current_low,
                timestamp=timestamp,
                index=i,
            ))

    # Sort by index and remove duplicates at same index
    swings.sort(key=lambda x: x.index)

    # Classify swings (HH, HL, LH, LL)
    return classify_swings(swings)


def classify_swings(swings: list[Swing]) -> list[Swing]:
    """
    Classify each swing relative to the previous swing of the same type.

    HH (Higher High): New swing high > previous swing high (bullish)
    LH (Lower High): New swing high < previous swing high (bearish)
    HL (Higher Low): New swing low > previous swing low (bullish)
    LL (Lower Low): New swing low < previous swing low (bearish)
    """
    highs = [s for s in swings if s.type == "HIGH"]
    lows = [s for s in swings if s.type == "LOW"]

    # Classify highs
    for i, swing in enumerate(highs):
        if i == 0:
            swing.label = "FIRST"
        else:
            prev_high = highs[i - 1]
            swing.label = "HH" if swing.price > prev_high.price else "LH"

    # Classify lows
    for i, swing in enumerate(lows):
        if i == 0:
            swing.label = "FIRST"
        else:
            prev_low = lows[i - 1]
            swing.label = "HL" if swing.price > prev_low.price else "LL"

    # Merge and sort
    all_swings = highs + lows
    all_swings.sort(key=lambda x: x.index)

    return all_swings


def determine_structural_bias(
    swings: list[Swing],
    current_price: float,
) -> StructuralBias:
    """
    Determine structural bias based on Secondary Swing mechanism.

    BULLISH STRUCTURE (HH + HL pattern):
    - Secondary Swing = the lowest low BEFORE the last swing high
    - If price closes below SS → BIAS FLIPS TO BEARISH

    BEARISH STRUCTURE (LH + LL pattern):
    - Secondary Swing = the highest high BEFORE the last swing low
    - If price closes above SS → BIAS FLIPS TO BULLISH
    """
    if len(swings) < 4:
        return StructuralBias(
            bias="NEUTRAL",
            structure="INSUFFICIENT_DATA",
            secondary_swing_price=None,
            secondary_swing_type=None,
            ss_distance_pct=None,
            last_swing_high=None,
            last_swing_low=None,
            reason="Not enough swings for analysis",
            swings=swings,
        )

    # Get recent swings
    recent_highs = [s for s in swings if s.type == "HIGH"][-3:]
    recent_lows = [s for s in swings if s.type == "LOW"][-3:]

    if len(recent_highs) < 2 or len(recent_lows) < 2:
        return StructuralBias(
            bias="NEUTRAL",
            structure="INSUFFICIENT_DATA",
            secondary_swing_price=None,
            secondary_swing_type=None,
            ss_distance_pct=None,
            last_swing_high=recent_highs[-1].price if recent_highs else None,
            last_swing_low=recent_lows[-1].price if recent_lows else None,
            reason="Not enough highs/lows",
            swings=swings,
        )

    last_high = recent_highs[-1]
    prev_high = recent_highs[-2]
    last_low = recent_lows[-1]
    prev_low = recent_lows[-2]

    # Determine structure
    is_hh = last_high.price > prev_high.price
    is_hl = last_low.price > prev_low.price
    is_lh = last_high.price < prev_high.price
    is_ll = last_low.price < prev_low.price

    # Bullish structure: HH + HL
    if is_hh and is_hl:
        structure = "HH_HL"

        # Secondary Swing = low before last high
        ss_candidates = [s for s in swings if s.type == "LOW" and s.index < last_high.index]

        if ss_candidates:
            # Get the most recent low before the last high
            secondary_swing = max(ss_candidates, key=lambda x: x.index)
            ss_price = secondary_swing.price
            ss_distance = ((current_price - ss_price) / ss_price) * 100

            if current_price < ss_price:
                # SS broken - flip to bearish
                bias = "BEARISH"
                reason = f"Secondary Swing Low broken at {ss_price:.0f}"
            else:
                bias = "BULLISH"
                reason = f"Holding above SS Low at {ss_price:.0f}"

            return StructuralBias(
                bias=bias,
                structure=structure,
                secondary_swing_price=ss_price,
                secondary_swing_type="LOW",
                ss_distance_pct=ss_distance,
                last_swing_high=last_high.price,
                last_swing_low=last_low.price,
                reason=reason,
                swings=swings,
            )

    # Bearish structure: LH + LL
    elif is_lh and is_ll:
        structure = "LH_LL"

        # Secondary Swing = high before last low
        ss_candidates = [s for s in swings if s.type == "HIGH" and s.index < last_low.index]

        if ss_candidates:
            # Get the most recent high before the last low
            secondary_swing = max(ss_candidates, key=lambda x: x.index)
            ss_price = secondary_swing.price
            ss_distance = ((current_price - ss_price) / ss_price) * 100

            if current_price > ss_price:
                # SS broken - flip to bullish
                bias = "BULLISH"
                reason = f"Secondary Swing High reclaimed at {ss_price:.0f}"
            else:
                bias = "BEARISH"
                reason = f"Below SS High at {ss_price:.0f}"

            return StructuralBias(
                bias=bias,
                structure=structure,
                secondary_swing_price=ss_price,
                secondary_swing_type="HIGH",
                ss_distance_pct=ss_distance,
                last_swing_high=last_high.price,
                last_swing_low=last_low.price,
                reason=reason,
                swings=swings,
            )

    # Mixed/Choppy structure
    else:
        if is_hh and is_ll:
            structure = "HH_LL"
            reason = "Mixed signals - Higher High but Lower Low"
        elif is_lh and is_hl:
            structure = "LH_HL"
            reason = "Mixed signals - Lower High but Higher Low (possible reversal)"
        else:
            structure = "TRANSITION"
            reason = "Structure in transition"

        return StructuralBias(
            bias="CHOPPY",
            structure=structure,
            secondary_swing_price=None,
            secondary_swing_type=None,
            ss_distance_pct=None,
            last_swing_high=last_high.price,
            last_swing_low=last_low.price,
            reason=reason,
            swings=swings,
        )

    # Fallback
    return StructuralBias(
        bias="NEUTRAL",
        structure="UNKNOWN",
        secondary_swing_price=None,
        secondary_swing_type=None,
        ss_distance_pct=None,
        last_swing_high=last_high.price if recent_highs else None,
        last_swing_low=last_low.price if recent_lows else None,
        reason="Could not determine structure",
        swings=swings,
    )


def get_lookback_for_timeframe(timeframe: str) -> int:
    """
    Get appropriate lookback period for swing detection based on timeframe.

    Higher timeframes need fewer lookback candles.
    """
    lookback_map = {
        "1h": 7,   # ~7 hours for pivot
        "4h": 5,   # ~20 hours for pivot
        "1d": 5,   # ~5 days for pivot
        "3d": 4,   # ~12 days for pivot
        "1w": 3,   # ~3 weeks for pivot
        "1M": 3,   # ~3 months for pivot
    }
    return lookback_map.get(timeframe.lower(), 5)


def analyze_structure(
    ohlcv_data: list[dict],
    timeframe: str,
    current_price: float = None,
) -> dict:
    """
    Complete structural analysis for a timeframe.

    Args:
        ohlcv_data: OHLCV data
        timeframe: Timeframe string (1h, 4h, 1d, etc.)
        current_price: Current price (uses last close if not provided)

    Returns:
        Dictionary with structural analysis results
    """
    if not ohlcv_data or len(ohlcv_data) < 20:
        return {
            "timeframe": timeframe,
            "bias": "NEUTRAL",
            "structure": "INSUFFICIENT_DATA",
            "swings": [],
            "error": "Not enough data",
        }

    # Get current price
    if current_price is None:
        current_price = ohlcv_data[-1]["close"]

    # Detect swings
    lookback = get_lookback_for_timeframe(timeframe)
    swings = detect_swings(ohlcv_data, lookback)

    # Determine bias
    structural_bias = determine_structural_bias(swings, current_price)

    # Format swings for output
    swing_list = [
        {
            "type": s.type,
            "price": s.price,
            "label": s.label,
            "index": s.index,
            "timestamp": s.timestamp.isoformat() if s.timestamp else None,
        }
        for s in swings[-10:]  # Last 10 swings
    ]

    return {
        "timeframe": timeframe.upper(),
        "bias": structural_bias.bias,
        "structure": structural_bias.structure,
        "secondary_swing": {
            "price": structural_bias.secondary_swing_price,
            "type": structural_bias.secondary_swing_type,
            "distance_pct": round(structural_bias.ss_distance_pct, 2) if structural_bias.ss_distance_pct else None,
        },
        "last_swing_high": structural_bias.last_swing_high,
        "last_swing_low": structural_bias.last_swing_low,
        "reason": structural_bias.reason,
        "swings": swing_list,
        "current_price": current_price,
    }
