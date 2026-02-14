"""
AMD Pattern Recognition Module.

Implements Accumulation → Manipulation → Distribution pattern detection
for ICT-style trading signals.

The AMD cycle:
1. ACCUMULATION: Consolidation phase, low volatility range
2. MANIPULATION: Liquidity sweep into key level (stop hunt)
3. DISTRIBUTION: Displacement away, MSS, FVG formation (the real move)
"""
from datetime import datetime
from typing import Literal, Optional
from dataclasses import dataclass

import numpy as np

from calculations.structure import detect_swings, Swing
from calculations.liquidity import detect_liquidity_sweeps, LiquiditySweep
from calculations.displacement import detect_displacement, calculate_atr, Displacement
from calculations.zones import Zone


AMDPhase = Literal["ACCUMULATION", "MANIPULATION", "DISTRIBUTION", "NONE"]


@dataclass
class AMDPattern:
    """Represents an AMD pattern detection."""
    phase: AMDPhase
    direction: Optional[Literal["BULLISH", "BEARISH"]]
    confidence: float  # 0-1 confidence score

    # Accumulation phase details
    accumulation_start_index: Optional[int] = None
    accumulation_end_index: Optional[int] = None
    accumulation_range_high: Optional[float] = None
    accumulation_range_low: Optional[float] = None

    # Manipulation phase details
    manipulation_index: Optional[int] = None
    sweep: Optional[LiquiditySweep] = None
    swept_level: Optional[float] = None

    # Distribution phase details
    distribution_start_index: Optional[int] = None
    displacement: Optional[Displacement] = None
    mss_confirmed: bool = False
    fvg_formed: bool = False

    # Entry zone
    entry_zone_high: Optional[float] = None
    entry_zone_low: Optional[float] = None
    stop_loss: Optional[float] = None


def detect_accumulation(
    ohlcv_data: list[dict],
    min_candles: int = 5,
    max_range_atr_mult: float = 1.0,
) -> Optional[dict]:
    """
    Detect accumulation (consolidation) phase.

    Accumulation is characterized by:
    - Low volatility (range < ATR)
    - Price contained within a narrow range
    - Multiple touches of range boundaries

    Args:
        ohlcv_data: OHLCV data
        min_candles: Minimum candles for accumulation
        max_range_atr_mult: Maximum range as multiple of ATR

    Returns:
        Accumulation zone details or None
    """
    if len(ohlcv_data) < min_candles + 14:
        return None

    atr = calculate_atr(ohlcv_data)
    if atr == 0:
        return None

    # Look for consolidation in recent candles
    for start_idx in range(len(ohlcv_data) - min_candles - 1, max(14, len(ohlcv_data) - 30), -1):
        window = ohlcv_data[start_idx:]

        # Calculate range of window
        window_high = max(c["high"] for c in window)
        window_low = min(c["low"] for c in window)
        window_range = window_high - window_low

        # Check if range is tight relative to ATR
        if window_range <= atr * max_range_atr_mult:
            return {
                "start_index": start_idx,
                "end_index": len(ohlcv_data) - 1,
                "range_high": window_high,
                "range_low": window_low,
                "range_size": window_range,
                "atr_multiple": window_range / atr,
                "candle_count": len(window),
            }

    return None


def detect_amd_pattern(
    ohlcv_data: list[dict],
    htf_bias: str = None,
    key_levels: list[Zone] = None,
) -> AMDPattern:
    """
    Detect AMD (Accumulation → Manipulation → Distribution) pattern.

    The pattern forms when:
    1. Price consolidates (accumulation)
    2. Price sweeps liquidity into a key level (manipulation)
    3. Price displaces away with MSS and FVG (distribution)

    Args:
        ohlcv_data: OHLCV candle data
        htf_bias: Higher timeframe bias (BULLISH/BEARISH)
        key_levels: Key levels from HTF (FVGs, OBs)

    Returns:
        AMDPattern with current phase and details
    """
    if len(ohlcv_data) < 30:
        return AMDPattern(phase="NONE", direction=None, confidence=0)

    # Step 1: Detect swings
    swings = detect_swings(ohlcv_data, lookback=5)

    # Step 2: Detect liquidity sweeps
    sweeps = detect_liquidity_sweeps(ohlcv_data, swings)
    valid_sweeps = [s for s in sweeps if s.is_valid]

    # Step 3: Detect displacements
    displacements = detect_displacement(ohlcv_data)

    # Step 4: Check for accumulation
    accumulation = detect_accumulation(ohlcv_data)

    # If no sweeps, check for accumulation phase
    if not valid_sweeps:
        if accumulation:
            return AMDPattern(
                phase="ACCUMULATION",
                direction=None,
                confidence=0.3,
                accumulation_start_index=accumulation["start_index"],
                accumulation_end_index=accumulation["end_index"],
                accumulation_range_high=accumulation["range_high"],
                accumulation_range_low=accumulation["range_low"],
            )
        return AMDPattern(phase="NONE", direction=None, confidence=0)

    # Get most recent valid sweep
    recent_sweep = max(valid_sweeps, key=lambda s: s.rejection_candle_index)

    # Check if sweep aligns with HTF bias
    sweep_aligns_with_bias = True
    if htf_bias:
        if htf_bias == "BULLISH" and recent_sweep.direction != "BULLISH":
            sweep_aligns_with_bias = False
        elif htf_bias == "BEARISH" and recent_sweep.direction != "BEARISH":
            sweep_aligns_with_bias = False

    # Check if sweep is into a key level
    sweep_into_key_level = False
    if key_levels:
        for level in key_levels:
            level_mid = (level.high + level.low) / 2
            sweep_price = recent_sweep.sweep_extreme

            # Check if sweep was near this level
            distance_pct = abs((sweep_price - level_mid) / level_mid) * 100
            if distance_pct < 1.0:  # Within 1%
                sweep_into_key_level = True
                break

    # Step 5: Check for displacement AFTER the sweep
    post_sweep_displacements = [
        d for d in displacements
        if d.candle_index > recent_sweep.rejection_candle_index
        and d.direction == recent_sweep.direction
    ]

    # If we have sweep but no displacement yet = MANIPULATION phase
    if not post_sweep_displacements:
        confidence = 0.5
        if sweep_aligns_with_bias:
            confidence += 0.2
        if sweep_into_key_level:
            confidence += 0.2

        return AMDPattern(
            phase="MANIPULATION",
            direction=recent_sweep.direction,
            confidence=confidence,
            manipulation_index=recent_sweep.rejection_candle_index,
            sweep=recent_sweep,
            swept_level=recent_sweep.swept_level,
            stop_loss=recent_sweep.sweep_extreme,
        )

    # Step 6: We have sweep AND displacement = check for DISTRIBUTION
    recent_displacement = max(post_sweep_displacements, key=lambda d: d.candle_index)

    # Check for MSS (Market Structure Shift)
    # Simple check: did we break the previous swing in the new direction?
    mss_confirmed = False
    swing_highs = [s for s in swings if s.type == "HIGH" and s.index < recent_displacement.candle_index]
    swing_lows = [s for s in swings if s.type == "LOW" and s.index < recent_displacement.candle_index]

    if recent_sweep.direction == "BULLISH" and swing_highs:
        # For bullish, MSS = breaking above the last lower high
        last_high = swing_highs[-1] if swing_highs else None
        if last_high and recent_displacement.close_price > last_high.price:
            mss_confirmed = True
    elif recent_sweep.direction == "BEARISH" and swing_lows:
        # For bearish, MSS = breaking below the last higher low
        last_low = swing_lows[-1] if swing_lows else None
        if last_low and recent_displacement.close_price < last_low.price:
            mss_confirmed = True

    # Determine entry zone (FVG from displacement or order block)
    entry_zone_high = None
    entry_zone_low = None

    if recent_displacement.creates_fvg:
        entry_zone_high = recent_displacement.fvg_high
        entry_zone_low = recent_displacement.fvg_low

    # Calculate confidence
    confidence = 0.6  # Base for having sweep + displacement
    if sweep_aligns_with_bias:
        confidence += 0.15
    if sweep_into_key_level:
        confidence += 0.1
    if mss_confirmed:
        confidence += 0.1
    if recent_displacement.creates_fvg:
        confidence += 0.05

    confidence = min(confidence, 1.0)

    return AMDPattern(
        phase="DISTRIBUTION",
        direction=recent_sweep.direction,
        confidence=confidence,
        accumulation_start_index=accumulation["start_index"] if accumulation else None,
        accumulation_end_index=accumulation["end_index"] if accumulation else None,
        accumulation_range_high=accumulation["range_high"] if accumulation else None,
        accumulation_range_low=accumulation["range_low"] if accumulation else None,
        manipulation_index=recent_sweep.rejection_candle_index,
        sweep=recent_sweep,
        swept_level=recent_sweep.swept_level,
        distribution_start_index=recent_displacement.candle_index,
        displacement=recent_displacement,
        mss_confirmed=mss_confirmed,
        fvg_formed=recent_displacement.creates_fvg,
        entry_zone_high=entry_zone_high,
        entry_zone_low=entry_zone_low,
        stop_loss=recent_sweep.sweep_extreme,
    )


def analyze_amd(
    ohlcv_data: list[dict],
    htf_bias: str = None,
    key_levels: list[Zone] = None,
    current_price: float = None,
) -> dict:
    """
    Complete AMD pattern analysis.

    Args:
        ohlcv_data: OHLCV data
        htf_bias: Higher timeframe bias
        key_levels: Key levels from HTF
        current_price: Current price

    Returns:
        Dictionary with AMD analysis
    """
    if not ohlcv_data or len(ohlcv_data) < 30:
        return {
            "phase": "NONE",
            "direction": None,
            "confidence": 0,
            "details": None,
        }

    if current_price is None:
        current_price = ohlcv_data[-1]["close"]

    pattern = detect_amd_pattern(ohlcv_data, htf_bias, key_levels)

    details = {
        "phase": pattern.phase,
        "direction": pattern.direction,
        "confidence": round(pattern.confidence, 2),
    }

    if pattern.phase == "ACCUMULATION":
        details["accumulation"] = {
            "start_index": pattern.accumulation_start_index,
            "end_index": pattern.accumulation_end_index,
            "range_high": pattern.accumulation_range_high,
            "range_low": pattern.accumulation_range_low,
        }

    elif pattern.phase == "MANIPULATION":
        details["manipulation"] = {
            "index": pattern.manipulation_index,
            "swept_level": pattern.swept_level,
            "sweep_extreme": pattern.sweep.sweep_extreme if pattern.sweep else None,
            "wick_ratio": pattern.sweep.wick_ratio if pattern.sweep else None,
        }
        details["stop_loss"] = pattern.stop_loss

    elif pattern.phase == "DISTRIBUTION":
        details["manipulation"] = {
            "index": pattern.manipulation_index,
            "swept_level": pattern.swept_level,
            "sweep_extreme": pattern.sweep.sweep_extreme if pattern.sweep else None,
        }
        details["distribution"] = {
            "start_index": pattern.distribution_start_index,
            "mss_confirmed": pattern.mss_confirmed,
            "fvg_formed": pattern.fvg_formed,
            "displacement_range_mult": pattern.displacement.range_multiplier if pattern.displacement else None,
        }
        if pattern.entry_zone_high and pattern.entry_zone_low:
            details["entry_zone"] = {
                "high": pattern.entry_zone_high,
                "low": pattern.entry_zone_low,
                "mid": (pattern.entry_zone_high + pattern.entry_zone_low) / 2,
            }
        details["stop_loss"] = pattern.stop_loss

    return {
        "phase": pattern.phase,
        "direction": pattern.direction,
        "confidence": round(pattern.confidence, 2),
        "htf_bias": htf_bias,
        "current_price": current_price,
        "details": details,
    }
