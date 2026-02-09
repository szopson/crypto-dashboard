"""
RADAR Metrics Calculation Module.

RADAR is a macro-bias scoring system (0-6) based on:
- BBWP (Bollinger Band Width Percentile)
- Gaussian Channel
- Williams Vix Fix (WVF)
- Funding Rate
- (Future: Hash Ribbons, MMD)

Score interpretation:
- 5-6: ACCUMULATE (green) - full size longs
- 3-4: NEUTRAL (yellow) - reduced size, selective
- 0-2: SELL_THE_RALLY (red) - shorts only
"""
import numpy as np
from datetime import datetime
from typing import Union, Literal

from calculations.indicators import (
    sma, stdev, percentile_rank, highest, lowest,
    gaussian_weights, weighted_average, bollinger_bands
)
from config import settings


SignalType = Literal["BULLISH", "BEARISH", "NEUTRAL"]


def calculate_bbwp(
    close: Union[list, np.ndarray],
    bb_length: int = 20,
    bbwp_lookback: int = 252
) -> dict:
    """
    Bollinger Band Width Percentile (BBWP).

    Measures current BB width relative to historical BB width.
    Low BBWP = low volatility = setup for expansion (bullish for entries)
    High BBWP = high volatility = caution

    Args:
        close: Close prices array
        bb_length: Bollinger Band period
        bbwp_lookback: Percentile lookback period

    Returns:
        Dictionary with BBWP metrics:
        - bbwp: Percentile value (0-100)
        - signal: BULLISH/BEARISH/NEUTRAL
        - bullish_point: 1 if contributing to bullish score, else 0
    """
    close = np.asarray(close, dtype=float)

    # Calculate Bollinger Band Width
    upper, middle, lower = bollinger_bands(close, bb_length)
    bb_width = (upper - lower) / middle

    # Calculate percentile of current width
    bbwp = percentile_rank(bb_width, bbwp_lookback)
    current_bbwp = bbwp[-1] if not np.isnan(bbwp[-1]) else 50.0

    # Signal interpretation
    if current_bbwp < 5:
        signal = "BULLISH"  # Extreme low volatility - expansion coming
        description = "EXTREME_LOW_VOL"
        bullish_point = 1
    elif current_bbwp < settings.bbwp_low_threshold:
        signal = "BULLISH"  # Low volatility - preparation for move
        description = "LOW_VOL"
        bullish_point = 1
    elif current_bbwp > 95:
        signal = "BEARISH"  # Extreme high volatility - caution
        description = "EXTREME_HIGH_VOL"
        bullish_point = 0
    elif current_bbwp > settings.bbwp_high_threshold:
        signal = "NEUTRAL"  # High volatility - prepare for consolidation
        description = "HIGH_VOL"
        bullish_point = 0
    else:
        signal = "NEUTRAL"  # Normal range
        description = "NORMAL_VOL"
        bullish_point = 0

    return {
        "bbwp": round(current_bbwp, 2),
        "bb_width": round(bb_width[-1], 6) if not np.isnan(bb_width[-1]) else None,
        "signal": signal,
        "description": description,
        "bullish_point": bullish_point,
    }


def calculate_gaussian_channel(
    close: Union[list, np.ndarray],
    length: int = 20,
    mult: float = 2.0
) -> dict:
    """
    Gaussian Channel indicator.

    Uses Gaussian-weighted moving average with bands.
    More responsive than SMA due to Gaussian weighting.

    Price above channel = bullish momentum
    Price below channel = bearish momentum
    Crossing MA = direction change

    Args:
        close: Close prices array
        length: Gaussian MA period
        mult: Standard deviation multiplier for bands

    Returns:
        Dictionary with Gaussian Channel metrics
    """
    close = np.asarray(close, dtype=float)

    if len(close) < length:
        return {
            "gaussian_ma": None,
            "upper_band": None,
            "lower_band": None,
            "signal": "NEUTRAL",
            "bullish_point": 0,
            "position_pct": 50.0,
        }

    # Calculate Gaussian weighted MA
    weights = gaussian_weights(length)
    gaussian_ma = weighted_average(close[-length:], weights)

    # Standard deviation for bands
    std_dev = np.std(close[-length:], ddof=1)
    upper_band = gaussian_ma + (mult * std_dev)
    lower_band = gaussian_ma - (mult * std_dev)

    current_price = close[-1]

    # Signal determination
    if current_price > upper_band:
        signal = "BULLISH"
        description = "STRONG_BULLISH"
        bullish_point = 1
    elif current_price > gaussian_ma:
        signal = "BULLISH"
        description = "BULLISH"
        bullish_point = 1
    elif current_price > lower_band:
        signal = "BEARISH"
        description = "BEARISH"
        bullish_point = 0
    else:
        signal = "BEARISH"
        description = "STRONG_BEARISH"
        bullish_point = 0

    # Position within channel (0-100%)
    if upper_band != lower_band:
        position_pct = ((current_price - lower_band) / (upper_band - lower_band)) * 100
    else:
        position_pct = 50.0

    # Detect crossover
    if len(close) >= 2:
        prev_price = close[-2]
        if prev_price < gaussian_ma and current_price > gaussian_ma:
            crossover = "UP"
        elif prev_price > gaussian_ma and current_price < gaussian_ma:
            crossover = "DOWN"
        else:
            crossover = "NONE"
    else:
        crossover = "NONE"

    return {
        "gaussian_ma": round(gaussian_ma, 2),
        "upper_band": round(upper_band, 2),
        "lower_band": round(lower_band, 2),
        "current_price": round(current_price, 2),
        "signal": signal,
        "description": description,
        "bullish_point": bullish_point,
        "position_pct": round(position_pct, 2),
        "crossover": crossover,
    }


def calculate_wvf(
    close: Union[list, np.ndarray],
    low: Union[list, np.ndarray],
    length: int = 22,
    bb_length: int = 20,
    mult: float = 2.0
) -> dict:
    """
    Williams Vix Fix (WVF).

    Identifies market bottoms through Fear Index.
    WVF spike = panic = potential bottom (bullish signal)

    Args:
        close: Close prices array
        low: Low prices array
        length: WVF lookback period
        bb_length: Bollinger Band period for WVF
        mult: Band multiplier

    Returns:
        Dictionary with WVF metrics
    """
    close = np.asarray(close, dtype=float)
    low = np.asarray(low, dtype=float)

    if len(close) < length:
        return {
            "wvf": None,
            "signal": "NEUTRAL",
            "bullish_point": 0,
        }

    # Calculate WVF: (Highest Close - Current Low) / Highest Close * 100
    highest_close = highest(close, length)
    wvf = ((highest_close - low) / highest_close) * 100

    # Calculate bands for WVF
    wvf_sma = sma(wvf, bb_length)
    wvf_std = stdev(wvf, bb_length)
    upper_band = wvf_sma + (mult * wvf_std)

    current_wvf = wvf[-1] if not np.isnan(wvf[-1]) else 0
    current_upper = upper_band[-1] if not np.isnan(upper_band[-1]) else 100
    current_mid = wvf_sma[-1] if not np.isnan(wvf_sma[-1]) else 50

    # Signal interpretation
    if current_wvf > current_upper:
        signal = "BULLISH"  # Extreme fear = potential bottom
        description = "EXTREME_FEAR"
        bullish_point = 1
    elif current_wvf > current_mid:
        signal = "NEUTRAL"  # Elevated fear
        description = "FEAR"
        bullish_point = 0.5
    else:
        signal = "NEUTRAL"  # Normal
        description = "NORMAL"
        bullish_point = 0

    return {
        "wvf": round(current_wvf, 2),
        "upper_band": round(current_upper, 2),
        "mid_line": round(current_mid, 2),
        "signal": signal,
        "description": description,
        "bullish_point": bullish_point,
    }


def calculate_funding_signal(funding_rate: float) -> dict:
    """
    Interpret funding rate for bias.

    Funding Rate > 0: Longs pay shorts (overleveraged long = bearish warning)
    Funding Rate < 0: Shorts pay longs (overleveraged short = bullish)

    Args:
        funding_rate: Current funding rate as percentage (e.g., 0.01 = 0.01%)

    Returns:
        Dictionary with funding signal
    """
    threshold = settings.funding_rate_threshold

    if funding_rate > 0.05:
        signal = "BEARISH"
        description = "EXTREME_LONG_BIAS"
        bullish_point = 0
    elif funding_rate > threshold:
        signal = "BEARISH"
        description = "LONG_BIAS"
        bullish_point = 0
    elif funding_rate < -0.05:
        signal = "BULLISH"
        description = "EXTREME_SHORT_BIAS"
        bullish_point = 1
    elif funding_rate < -threshold:
        signal = "BULLISH"
        description = "SHORT_BIAS"
        bullish_point = 1
    else:
        signal = "NEUTRAL"
        description = "NEUTRAL"
        bullish_point = 0.5  # Neutral funding is slightly bullish

    return {
        "funding_rate": round(funding_rate, 4),
        "signal": signal,
        "description": description,
        "bullish_point": bullish_point,
    }


def calculate_radar_score(
    bbwp_result: dict,
    gaussian_result: dict,
    wvf_result: dict,
    funding_result: dict,
) -> dict:
    """
    Calculate combined RADAR score (0-6).

    Each metric contributes 0-1 points toward bullish score.

    Score interpretation:
    - 5-6: ACCUMULATE (green) - full size longs
    - 3-4: NEUTRAL (yellow) - reduced size, selective
    - 0-2: SELL_THE_RALLY (red) - shorts only

    Args:
        bbwp_result: BBWP calculation result
        gaussian_result: Gaussian Channel result
        wvf_result: WVF result
        funding_result: Funding signal result

    Returns:
        Dictionary with RADAR score and components
    """
    score = 0.0
    components = []

    # Component 1: BBWP
    bbwp_points = bbwp_result.get("bullish_point", 0)
    score += bbwp_points
    if bbwp_points > 0:
        components.append(f"BBWP ({bbwp_result.get('bbwp', 0):.1f}%)")

    # Component 2: Gaussian Channel
    gaussian_points = gaussian_result.get("bullish_point", 0)
    score += gaussian_points
    if gaussian_points > 0:
        components.append(f"Gaussian ({gaussian_result.get('description', 'N/A')})")

    # Component 3: WVF
    wvf_points = wvf_result.get("bullish_point", 0)
    score += wvf_points
    if wvf_points > 0:
        components.append(f"WVF ({wvf_result.get('wvf', 0):.1f})")

    # Component 4: Funding Rate
    funding_points = funding_result.get("bullish_point", 0)
    score += funding_points
    if funding_points > 0:
        components.append(f"Funding ({funding_result.get('description', 'N/A')})")

    # Future components (Hash Ribbons, MMD) - placeholder
    # These would add additional points when implemented

    # Classification
    max_score = 4  # Currently 4 metrics, will be 6 when HR and MMD added
    normalized_score = (score / max_score) * 6  # Normalize to 0-6 scale

    if normalized_score >= 5:
        classification = "ACCUMULATE"
        color = "green"
    elif normalized_score >= 3:
        classification = "NEUTRAL"
        color = "yellow"
    else:
        classification = "SELL_THE_RALLY"
        color = "red"

    return {
        "score": round(normalized_score, 1),
        "raw_score": round(score, 1),
        "max_score": 6,
        "classification": classification,
        "color": color,
        "components": components,
        "metrics": {
            "bbwp": bbwp_result,
            "gaussian": gaussian_result,
            "wvf": wvf_result,
            "funding": funding_result,
        },
        "timestamp": datetime.utcnow().isoformat(),
    }


def calculate_full_radar(
    ohlcv_data: list[dict],
    funding_rate: float
) -> dict:
    """
    Calculate complete RADAR metrics from OHLCV data.

    Args:
        ohlcv_data: List of OHLCV dictionaries with 'open', 'high', 'low', 'close', 'volume'
        funding_rate: Current funding rate percentage

    Returns:
        Complete RADAR analysis result
    """
    if not ohlcv_data or len(ohlcv_data) < 50:
        return {
            "score": 3.0,
            "classification": "NEUTRAL",
            "color": "yellow",
            "error": "Insufficient data",
        }

    # Extract price arrays
    close = np.array([c["close"] for c in ohlcv_data])
    low = np.array([c["low"] for c in ohlcv_data])

    # Calculate all metrics
    bbwp_result = calculate_bbwp(close)
    gaussian_result = calculate_gaussian_channel(close)
    wvf_result = calculate_wvf(close, low)
    funding_result = calculate_funding_signal(funding_rate)

    # Calculate combined score
    radar_score = calculate_radar_score(
        bbwp_result,
        gaussian_result,
        wvf_result,
        funding_result
    )

    return radar_score
