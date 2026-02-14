"""
Displacement Detection Module.

Detects strong impulsive moves that indicate smart money activity.
Displacement candles show aggressive buying/selling with:
- Large body relative to average
- Creates imbalance (Fair Value Gap)
- Often accompanies Market Structure Shift

Key characteristics:
- Body > 70% of candle range (minimal wicks)
- Range > 1.5x average range (unusual size)
- Creates FVG with surrounding candles
"""
from datetime import datetime
from typing import Literal, Optional
from dataclasses import dataclass

import numpy as np


@dataclass
class Displacement:
    """Represents a displacement candle/move."""
    direction: Literal["BULLISH", "BEARISH"]
    candle_index: int
    timestamp: datetime
    open_price: float
    close_price: float
    high_price: float
    low_price: float
    body_ratio: float  # Body size / total range
    range_multiplier: float  # Range vs ATR
    creates_fvg: bool  # Does it create an imbalance?
    fvg_high: Optional[float] = None
    fvg_low: Optional[float] = None


def calculate_atr(ohlcv_data: list[dict], period: int = 14) -> float:
    """
    Calculate Average True Range.

    Args:
        ohlcv_data: OHLCV data
        period: ATR period

    Returns:
        ATR value
    """
    if len(ohlcv_data) < period + 1:
        return 0

    true_ranges = []

    for i in range(1, len(ohlcv_data)):
        high = ohlcv_data[i]["high"]
        low = ohlcv_data[i]["low"]
        prev_close = ohlcv_data[i - 1]["close"]

        tr = max(
            high - low,
            abs(high - prev_close),
            abs(low - prev_close)
        )
        true_ranges.append(tr)

    if len(true_ranges) < period:
        return np.mean(true_ranges) if true_ranges else 0

    return np.mean(true_ranges[-period:])


def detect_displacement(
    ohlcv_data: list[dict],
    min_body_ratio: float = 0.7,
    min_range_multiplier: float = 1.5,
    atr_period: int = 14,
) -> list[Displacement]:
    """
    Detect displacement candles in price data.

    A displacement candle is:
    1. Has a large body relative to its range (> min_body_ratio)
    2. Has an unusually large range (> min_range_multiplier * ATR)
    3. Often creates a Fair Value Gap

    Args:
        ohlcv_data: OHLCV candle data
        min_body_ratio: Minimum body/range ratio (0.7 = 70%)
        min_range_multiplier: Minimum range vs ATR
        atr_period: Period for ATR calculation

    Returns:
        List of detected displacements
    """
    if len(ohlcv_data) < atr_period + 3:
        return []

    displacements = []
    atr = calculate_atr(ohlcv_data, atr_period)

    if atr == 0:
        return []

    for i in range(1, len(ohlcv_data) - 1):
        candle = ohlcv_data[i]
        prev_candle = ohlcv_data[i - 1]
        next_candle = ohlcv_data[i + 1]

        # Parse timestamp
        timestamp = candle.get("datetime") or candle.get("timestamp")
        if isinstance(timestamp, (int, float)):
            timestamp = datetime.utcfromtimestamp(timestamp / 1000)
        elif isinstance(timestamp, str):
            timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00").replace("+00:00", ""))

        # Calculate candle metrics
        candle_range = candle["high"] - candle["low"]
        if candle_range == 0:
            continue

        body_size = abs(candle["close"] - candle["open"])
        body_ratio = body_size / candle_range
        range_multiplier = candle_range / atr

        # Determine direction
        is_bullish = candle["close"] > candle["open"]
        direction = "BULLISH" if is_bullish else "BEARISH"

        # Check if it meets displacement criteria
        if body_ratio < min_body_ratio or range_multiplier < min_range_multiplier:
            continue

        # Check for FVG creation
        creates_fvg = False
        fvg_high = None
        fvg_low = None

        if is_bullish:
            # Bullish FVG: prev_high < next_low
            if prev_candle["high"] < next_candle["low"]:
                creates_fvg = True
                fvg_high = next_candle["low"]
                fvg_low = prev_candle["high"]
        else:
            # Bearish FVG: prev_low > next_high
            if prev_candle["low"] > next_candle["high"]:
                creates_fvg = True
                fvg_high = prev_candle["low"]
                fvg_low = next_candle["high"]

        displacements.append(Displacement(
            direction=direction,
            candle_index=i,
            timestamp=timestamp,
            open_price=candle["open"],
            close_price=candle["close"],
            high_price=candle["high"],
            low_price=candle["low"],
            body_ratio=round(body_ratio, 3),
            range_multiplier=round(range_multiplier, 2),
            creates_fvg=creates_fvg,
            fvg_high=fvg_high,
            fvg_low=fvg_low,
        ))

    return displacements


def get_recent_displacement(
    ohlcv_data: list[dict],
    direction: Literal["BULLISH", "BEARISH"] = None,
    require_fvg: bool = False,
    max_candles_ago: int = 10,
) -> Optional[Displacement]:
    """
    Get the most recent displacement candle.

    Args:
        ohlcv_data: OHLCV data
        direction: Filter by direction
        require_fvg: Only return displacements that created an FVG
        max_candles_ago: Maximum candles back to look

    Returns:
        Most recent displacement or None
    """
    displacements = detect_displacement(ohlcv_data)

    if not displacements:
        return None

    # Filter by direction
    if direction:
        displacements = [d for d in displacements if d.direction == direction]

    # Filter by FVG requirement
    if require_fvg:
        displacements = [d for d in displacements if d.creates_fvg]

    if not displacements:
        return None

    # Filter by recency
    current_index = len(ohlcv_data) - 1
    recent = [
        d for d in displacements
        if current_index - d.candle_index <= max_candles_ago
    ]

    if not recent:
        return None

    # Return most recent
    return max(recent, key=lambda d: d.candle_index)


def detect_displacement_sequence(
    ohlcv_data: list[dict],
    min_candles: int = 2,
    max_gap: int = 1,
) -> list[dict]:
    """
    Detect sequences of displacement candles (impulse moves).

    An impulse is a series of displacement candles in the same direction.

    Args:
        ohlcv_data: OHLCV data
        min_candles: Minimum displacement candles for a sequence
        max_gap: Maximum non-displacement candles between displacements

    Returns:
        List of impulse sequences
    """
    displacements = detect_displacement(ohlcv_data)

    if len(displacements) < min_candles:
        return []

    sequences = []
    current_sequence = []

    for i, disp in enumerate(displacements):
        if not current_sequence:
            current_sequence = [disp]
            continue

        last = current_sequence[-1]

        # Check if this displacement continues the sequence
        same_direction = disp.direction == last.direction
        gap = disp.candle_index - last.candle_index - 1

        if same_direction and gap <= max_gap:
            current_sequence.append(disp)
        else:
            # End current sequence if valid
            if len(current_sequence) >= min_candles:
                sequences.append(_format_sequence(current_sequence))
            current_sequence = [disp]

    # Check final sequence
    if len(current_sequence) >= min_candles:
        sequences.append(_format_sequence(current_sequence))

    return sequences


def _format_sequence(displacements: list[Displacement]) -> dict:
    """Format a displacement sequence for output."""
    if not displacements:
        return {}

    return {
        "direction": displacements[0].direction,
        "start_index": displacements[0].candle_index,
        "end_index": displacements[-1].candle_index,
        "candle_count": len(displacements),
        "start_price": displacements[0].open_price,
        "end_price": displacements[-1].close_price,
        "total_move": abs(displacements[-1].close_price - displacements[0].open_price),
        "avg_body_ratio": round(np.mean([d.body_ratio for d in displacements]), 3),
        "creates_fvg": any(d.creates_fvg for d in displacements),
    }


def analyze_displacement(
    ohlcv_data: list[dict],
    current_price: float = None,
) -> dict:
    """
    Complete displacement analysis for OHLCV data.

    Args:
        ohlcv_data: OHLCV data
        current_price: Current price

    Returns:
        Dictionary with displacement analysis
    """
    if not ohlcv_data or len(ohlcv_data) < 20:
        return {
            "displacements": [],
            "recent_bullish": None,
            "recent_bearish": None,
            "impulse_sequences": [],
            "atr": 0,
        }

    if current_price is None:
        current_price = ohlcv_data[-1]["close"]

    atr = calculate_atr(ohlcv_data)
    displacements = detect_displacement(ohlcv_data)

    # Get recent by direction
    recent_bullish = get_recent_displacement(ohlcv_data, direction="BULLISH")
    recent_bearish = get_recent_displacement(ohlcv_data, direction="BEARISH")

    # Detect impulse sequences
    sequences = detect_displacement_sequence(ohlcv_data)

    # Format displacements for output
    disp_list = [
        {
            "direction": d.direction,
            "index": d.candle_index,
            "timestamp": d.timestamp.isoformat() if d.timestamp else None,
            "open": d.open_price,
            "close": d.close_price,
            "body_ratio": d.body_ratio,
            "range_multiplier": d.range_multiplier,
            "creates_fvg": d.creates_fvg,
            "fvg": {
                "high": d.fvg_high,
                "low": d.fvg_low,
            } if d.creates_fvg else None,
        }
        for d in displacements[-10:]
    ]

    return {
        "displacements": disp_list,
        "recent_bullish": {
            "index": recent_bullish.candle_index,
            "close": recent_bullish.close_price,
            "body_ratio": recent_bullish.body_ratio,
            "range_multiplier": recent_bullish.range_multiplier,
            "creates_fvg": recent_bullish.creates_fvg,
            "timestamp": recent_bullish.timestamp.isoformat(),
        } if recent_bullish else None,
        "recent_bearish": {
            "index": recent_bearish.candle_index,
            "close": recent_bearish.close_price,
            "body_ratio": recent_bearish.body_ratio,
            "range_multiplier": recent_bearish.range_multiplier,
            "creates_fvg": recent_bearish.creates_fvg,
            "timestamp": recent_bearish.timestamp.isoformat(),
        } if recent_bearish else None,
        "impulse_sequences": sequences[-5:],
        "atr": round(atr, 2),
        "current_price": current_price,
    }
