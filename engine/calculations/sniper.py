"""
SNIPER Execution Engine.

Implements:
- Confluence scoring (0-5 points)
- Entry detection when price approaches zone with MTF bias alignment
- Position sizing based on confluence score
- Stop-loss calculation at Secondary Swing level
"""
from datetime import datetime
from typing import Optional, Literal
from dataclasses import dataclass, field

from calculations.structure import analyze_structure, Swing
from calculations.zones import analyze_zones, Zone
from calculations.radar import calculate_full_radar


@dataclass
class ConfluenceScore:
    """Confluence score with breakdown."""
    total_score: float  # 0-5 scale
    max_score: float = 5.0
    components: list[dict] = field(default_factory=list)
    signal: Literal["STRONG_LONG", "LONG", "NEUTRAL", "SHORT", "STRONG_SHORT"] = "NEUTRAL"
    recommendation: str = ""


@dataclass
class TradeSetup:
    """Potential trade setup with entry, stop, targets."""
    direction: Literal["LONG", "SHORT"]
    entry_zone_type: str  # BULLISH_OB, BEARISH_FVG, etc.
    entry_zone_high: float
    entry_zone_low: float
    entry_price: float  # Mid of zone
    stop_loss: float  # At SS level
    take_profit_1: float  # 1:1 R:R
    take_profit_2: float  # 2:1 R:R
    take_profit_3: float  # 3:1 R:R
    risk_reward: float
    confluence: ConfluenceScore
    position_size_pct: float  # Suggested position size %
    timeframe: str
    notes: list[str] = field(default_factory=list)


def calculate_confluence(
    radar_result: dict,
    structure_results: dict[str, dict],
    zones_result: dict,
    current_price: float,
) -> ConfluenceScore:
    """
    Calculate confluence score based on multiple factors.

    Scoring (0-5 points):
    1. RADAR Score (0-1.5 points)
       - ACCUMULATE: +1.5
       - NEUTRAL: +0.5
       - SELL_THE_RALLY: +0 (for longs) or +1.5 (for shorts)

    2. Multi-Timeframe Bias Alignment (0-1.5 points)
       - All aligned: +1.5
       - 3/4 aligned: +1.0
       - 2/4 aligned: +0.5
       - <2 aligned: +0

    3. Zone Proximity (0-1 point)
       - Price at zone (<1%): +1.0
       - Price near zone (1-2%): +0.5
       - Price far from zone (>2%): +0

    4. Structure Quality (0-1 point)
       - Clear HH_HL or LH_LL: +1.0
       - Mixed/Choppy: +0.5
       - Insufficient data: +0
    """
    components = []
    total = 0.0

    # Determine dominant bias from MTF
    bullish_count = sum(
        1 for tf, s in structure_results.items()
        if s.get("bias") == "BULLISH"
    )
    bearish_count = sum(
        1 for tf, s in structure_results.items()
        if s.get("bias") == "BEARISH"
    )

    is_bullish_bias = bullish_count > bearish_count

    # 1. RADAR Score
    radar_class = radar_result.get("classification", "NEUTRAL")
    # Note copy is descriptive regime language, not trade instructions — these
    # strings render verbatim in the Confluence Check UI and Telegram alerts
    # (MiCA/KNF).
    if is_bullish_bias:
        if radar_class == "ACCUMULATE":
            radar_points = 1.5
            radar_note = "Accumulation regime — aligned with bullish structure"
        elif radar_class == "NEUTRAL":
            radar_points = 0.5
            radar_note = "RADAR neutral"
        else:
            radar_points = 0.0
            radar_note = "Distribution regime — conflicts with bullish structure"
    else:
        if radar_class == "SELL_THE_RALLY":
            radar_points = 1.5
            radar_note = "Distribution regime — aligned with bearish structure"
        elif radar_class == "NEUTRAL":
            radar_points = 0.5
            radar_note = "RADAR neutral"
        else:
            radar_points = 0.0
            radar_note = "Accumulation regime — conflicts with bearish structure"

    total += radar_points
    components.append({
        "name": "RADAR",
        "points": radar_points,
        "max": 1.5,
        "note": radar_note,
    })

    # 2. MTF Bias Alignment
    tf_count = len(structure_results)
    aligned_count = bullish_count if is_bullish_bias else bearish_count
    alignment_ratio = aligned_count / tf_count if tf_count > 0 else 0

    if alignment_ratio >= 0.9:
        mtf_points = 1.5
        mtf_note = f"Strong MTF alignment ({aligned_count}/{tf_count})"
    elif alignment_ratio >= 0.75:
        mtf_points = 1.0
        mtf_note = f"Good MTF alignment ({aligned_count}/{tf_count})"
    elif alignment_ratio >= 0.5:
        mtf_points = 0.5
        mtf_note = f"Partial MTF alignment ({aligned_count}/{tf_count})"
    else:
        mtf_points = 0.0
        mtf_note = f"Poor MTF alignment ({aligned_count}/{tf_count})"

    total += mtf_points
    components.append({
        "name": "MTF_ALIGNMENT",
        "points": mtf_points,
        "max": 1.5,
        "note": mtf_note,
    })

    # 3. Zone Proximity
    nearby_zones = zones_result.get("nearby_zones", [])
    relevant_zones = [
        z for z in nearby_zones
        if (is_bullish_bias and z["direction"] == "BULLISH") or
           (not is_bullish_bias and z["direction"] == "BEARISH")
    ]

    if relevant_zones:
        closest_zone = relevant_zones[0]  # Already sorted by distance
        distance = abs(closest_zone["distance_pct"])

        if distance < 1.0:
            zone_points = 1.0
            zone_note = f"Price at {closest_zone['type']} ({distance:.1f}% away)"
        elif distance < 2.0:
            zone_points = 0.5
            zone_note = f"Price near {closest_zone['type']} ({distance:.1f}% away)"
        else:
            zone_points = 0.0
            zone_note = f"Price far from zones ({distance:.1f}% away)"
    else:
        zone_points = 0.0
        zone_note = "No relevant zones nearby"

    total += zone_points
    components.append({
        "name": "ZONE_PROXIMITY",
        "points": zone_points,
        "max": 1.0,
        "note": zone_note,
    })

    # 4. Structure Quality
    # Check if dominant structure is clear
    clear_structures = sum(
        1 for s in structure_results.values()
        if s.get("structure") in ["HH_HL", "LH_LL"]
    )

    if clear_structures >= len(structure_results) * 0.75:
        struct_points = 1.0
        struct_note = "Clear structural patterns"
    elif clear_structures >= len(structure_results) * 0.5:
        struct_points = 0.5
        struct_note = "Mixed structural patterns"
    else:
        struct_points = 0.0
        struct_note = "Unclear structure"

    total += struct_points
    components.append({
        "name": "STRUCTURE_QUALITY",
        "points": struct_points,
        "max": 1.0,
        "note": struct_note,
    })

    # Determine signal
    if total >= 4.0:
        signal = "STRONG_LONG" if is_bullish_bias else "STRONG_SHORT"
        recommendation = "High confluence - consider full size"
    elif total >= 3.0:
        signal = "LONG" if is_bullish_bias else "SHORT"
        recommendation = "Good confluence - consider 50-75% size"
    elif total >= 2.0:
        signal = "NEUTRAL"
        recommendation = "Low confluence - consider smaller size or wait"
    else:
        signal = "NEUTRAL"
        recommendation = "Insufficient confluence - no trade"

    return ConfluenceScore(
        total_score=round(total, 1),
        components=components,
        signal=signal,
        recommendation=recommendation,
    )


def find_trade_setups(
    ohlcv_data_by_tf: dict[str, list[dict]],
    current_price: float,
    funding_rate: float = 0,
    primary_tf: str = "4h",
) -> list[TradeSetup]:
    """
    Find potential trade setups based on confluence.

    Args:
        ohlcv_data_by_tf: OHLCV data for each timeframe
        current_price: Current price
        funding_rate: Current funding rate
        primary_tf: Primary timeframe for entry

    Returns:
        List of potential trade setups sorted by confluence
    """
    setups = []

    # Calculate analysis for all timeframes
    structure_results = {}
    for tf, ohlcv in ohlcv_data_by_tf.items():
        if len(ohlcv) >= 20:
            structure_results[tf] = analyze_structure(ohlcv, tf, current_price)

    if not structure_results:
        return []

    # Get RADAR from daily
    daily_ohlcv = ohlcv_data_by_tf.get("1d", [])
    if daily_ohlcv:
        radar_result = calculate_full_radar(daily_ohlcv, funding_rate)
    else:
        radar_result = {"classification": "NEUTRAL", "score": 3.0}

    # Get zones from primary timeframe
    primary_ohlcv = ohlcv_data_by_tf.get(primary_tf, [])
    if primary_ohlcv:
        zones_result = analyze_zones(primary_ohlcv, current_price)
    else:
        return []

    # Calculate confluence
    confluence = calculate_confluence(
        radar_result, structure_results, zones_result, current_price
    )

    # Only create setups if confluence is sufficient
    if confluence.total_score < 2.0:
        return []

    # Determine direction
    is_long = confluence.signal in ["STRONG_LONG", "LONG"]
    direction: Literal["LONG", "SHORT"] = "LONG" if is_long else "SHORT"

    # Find relevant zones
    nearby_zones = zones_result.get("nearby_zones", [])
    for zone in nearby_zones:
        # Skip zones that don't match direction
        if is_long and zone["direction"] != "BULLISH":
            continue
        if not is_long and zone["direction"] != "BEARISH":
            continue

        # Skip zones that are too far
        if abs(zone["distance_pct"]) > 5.0:
            continue

        # Calculate entry at mid of zone
        entry_price = zone["mid"]

        # Find SS level for stop loss
        primary_structure = structure_results.get(primary_tf.upper(), {})
        ss = primary_structure.get("secondary_swing", {})
        ss_price = ss.get("price")

        if not ss_price:
            # Use swing low for long, swing high for short
            if is_long:
                ss_price = primary_structure.get("last_swing_low", zone["low"] * 0.98)
            else:
                ss_price = primary_structure.get("last_swing_high", zone["high"] * 1.02)

        # Calculate stop loss slightly beyond SS
        if is_long:
            stop_loss = ss_price * 0.995  # 0.5% below SS
        else:
            stop_loss = ss_price * 1.005  # 0.5% above SS

        # Calculate risk
        risk = abs(entry_price - stop_loss)
        if risk <= 0:
            continue

        # Calculate take profits
        if is_long:
            tp1 = entry_price + risk * 1.0  # 1:1
            tp2 = entry_price + risk * 2.0  # 2:1
            tp3 = entry_price + risk * 3.0  # 3:1
        else:
            tp1 = entry_price - risk * 1.0
            tp2 = entry_price - risk * 2.0
            tp3 = entry_price - risk * 3.0

        # Calculate R:R based on current price
        current_risk = abs(current_price - stop_loss)
        potential_reward = abs(tp2 - current_price)
        rr = potential_reward / current_risk if current_risk > 0 else 0

        # Position size based on confluence
        if confluence.total_score >= 4.0:
            position_size = 100.0
        elif confluence.total_score >= 3.0:
            position_size = 75.0
        elif confluence.total_score >= 2.5:
            position_size = 50.0
        else:
            position_size = 25.0

        # Generate notes
        notes = [c["note"] for c in confluence.components]
        notes.append(f"Zone: {zone['type']}")
        notes.append(f"Distance to zone: {zone['distance_pct']:.1f}%")

        setup = TradeSetup(
            direction=direction,
            entry_zone_type=zone["type"],
            entry_zone_high=zone["high"],
            entry_zone_low=zone["low"],
            entry_price=entry_price,
            stop_loss=stop_loss,
            take_profit_1=tp1,
            take_profit_2=tp2,
            take_profit_3=tp3,
            risk_reward=round(rr, 2),
            confluence=confluence,
            position_size_pct=position_size,
            timeframe=primary_tf.upper(),
            notes=notes,
        )
        setups.append(setup)

    # Sort by confluence score
    setups.sort(key=lambda x: x.confluence.total_score, reverse=True)

    return setups[:5]  # Return top 5 setups


def analyze_sniper(
    ohlcv_data_by_tf: dict[str, list[dict]],
    current_price: float,
    funding_rate: float = 0,
) -> dict:
    """
    Complete SNIPER analysis.

    Args:
        ohlcv_data_by_tf: OHLCV data for each timeframe
        current_price: Current price
        funding_rate: Funding rate

    Returns:
        Dictionary with SNIPER analysis
    """
    # Calculate structure for all timeframes
    structure_results = {}
    for tf, ohlcv in ohlcv_data_by_tf.items():
        if len(ohlcv) >= 20:
            structure_results[tf.upper()] = analyze_structure(ohlcv, tf, current_price)

    # Get RADAR
    daily_ohlcv = ohlcv_data_by_tf.get("1d", [])
    if daily_ohlcv:
        radar_result = calculate_full_radar(daily_ohlcv, funding_rate)
    else:
        radar_result = {"classification": "NEUTRAL", "score": 3.0}

    # Get zones from 4H (default primary TF)
    zones_4h = ohlcv_data_by_tf.get("4h", [])
    if zones_4h:
        zones_result = analyze_zones(zones_4h, current_price)
    else:
        zones_result = {"nearby_zones": []}

    # Calculate confluence
    confluence = calculate_confluence(
        radar_result, structure_results, zones_result, current_price
    )

    # Find setups
    setups = find_trade_setups(
        ohlcv_data_by_tf, current_price, funding_rate, "4h"
    )

    # Format setups for output
    setup_list = []
    for s in setups:
        setup_list.append({
            "direction": s.direction,
            "entry_zone_type": s.entry_zone_type,
            "entry_zone": {"high": s.entry_zone_high, "low": s.entry_zone_low},
            "entry_price": s.entry_price,
            "stop_loss": s.stop_loss,
            "take_profits": {
                "tp1": s.take_profit_1,
                "tp2": s.take_profit_2,
                "tp3": s.take_profit_3,
            },
            "risk_reward": s.risk_reward,
            "confluence_score": s.confluence.total_score,
            "position_size_pct": s.position_size_pct,
            "timeframe": s.timeframe,
            "notes": s.notes,
        })

    return {
        "timestamp": datetime.utcnow().isoformat(),
        "current_price": current_price,
        "confluence": {
            "score": confluence.total_score,
            "max_score": confluence.max_score,
            "signal": confluence.signal,
            "recommendation": confluence.recommendation,
            "components": confluence.components,
        },
        "setups": setup_list,
        "radar_score": radar_result.get("score"),
        "radar_classification": radar_result.get("classification"),
    }
