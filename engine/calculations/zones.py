"""
Zone Detection Module.

Implements:
- Fair Value Gap (FVG) detection
- Order Block (OB) detection
- Zone status tracking (active, mitigated, invalidated)
"""
from datetime import datetime
from typing import Optional, Literal
from dataclasses import dataclass


@dataclass
class Zone:
    """Represents a trading zone (OB or FVG)."""
    zone_type: Literal[
        "BULLISH_OB", "BEARISH_OB",
        "BULLISH_FVG", "BEARISH_FVG",
        "BULLISH_IFVG", "BEARISH_IFVG"  # Inverse FVGs
    ]
    high: float
    low: float
    formed_at: datetime
    formed_index: int
    is_active: bool = True
    mitigated: bool = False
    mitigated_at: Optional[datetime] = None
    is_ifvg: bool = False  # True if this is an Inverse FVG
    original_type: Optional[str] = None  # Original FVG type before inversion


def detect_fvg(ohlcv_data: list[dict]) -> list[Zone]:
    """
    Detect Fair Value Gaps in price data.

    Bullish FVG: candle[i-1].high < candle[i+1].low
    - Gap up without interior retest
    - Result of strong buying (impulse up)

    Bearish FVG: candle[i-1].low > candle[i+1].high
    - Gap down without interior retest
    - Result of strong selling (impulse down)

    Args:
        ohlcv_data: List of OHLCV dictionaries

    Returns:
        List of FVG zones (only unmitigated ones)
    """
    if len(ohlcv_data) < 3:
        return []

    fvgs = []

    for i in range(1, len(ohlcv_data) - 1):
        prev_candle = ohlcv_data[i - 1]
        current_candle = ohlcv_data[i]
        next_candle = ohlcv_data[i + 1]

        timestamp = current_candle.get("datetime") or current_candle.get("timestamp")
        if isinstance(timestamp, (int, float)):
            timestamp = datetime.utcfromtimestamp(timestamp / 1000)
        elif isinstance(timestamp, str):
            timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00").replace("+00:00", ""))

        # Bullish FVG (gap up)
        if prev_candle["high"] < next_candle["low"]:
            fvgs.append(Zone(
                zone_type="BULLISH_FVG",
                high=next_candle["low"],      # Top of gap
                low=prev_candle["high"],       # Bottom of gap
                formed_at=timestamp,
                formed_index=i,
            ))

        # Bearish FVG (gap down)
        if prev_candle["low"] > next_candle["high"]:
            fvgs.append(Zone(
                zone_type="BEARISH_FVG",
                high=prev_candle["low"],       # Top of gap
                low=next_candle["high"],       # Bottom of gap
                formed_at=timestamp,
                formed_index=i,
            ))

    # Check which FVGs have been mitigated
    for fvg in fvgs:
        for j in range(fvg.formed_index + 2, len(ohlcv_data)):
            candle = ohlcv_data[j]

            # Bullish FVG mitigated when price trades into the gap
            if fvg.zone_type == "BULLISH_FVG" and candle["low"] <= fvg.high:
                fvg.mitigated = True
                fvg.is_active = False
                timestamp = candle.get("datetime") or candle.get("timestamp")
                if isinstance(timestamp, (int, float)):
                    timestamp = datetime.utcfromtimestamp(timestamp / 1000)
                elif isinstance(timestamp, str):
                    timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00").replace("+00:00", ""))
                fvg.mitigated_at = timestamp
                break

            # Bearish FVG mitigated when price trades into the gap
            if fvg.zone_type == "BEARISH_FVG" and candle["high"] >= fvg.low:
                fvg.mitigated = True
                fvg.is_active = False
                timestamp = candle.get("datetime") or candle.get("timestamp")
                if isinstance(timestamp, (int, float)):
                    timestamp = datetime.utcfromtimestamp(timestamp / 1000)
                elif isinstance(timestamp, str):
                    timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00").replace("+00:00", ""))
                fvg.mitigated_at = timestamp
                break

    # Return only active FVGs
    return [f for f in fvgs if f.is_active]


def detect_ifvg(ohlcv_data: list[dict]) -> list[Zone]:
    """
    Detect Inverse Fair Value Gaps (IFVG) in price data.

    An IFVG is a mitigated FVG that flips polarity:
    - Bullish FVG gets filled → becomes BEARISH_IFVG (resistance)
    - Bearish FVG gets filled → becomes BULLISH_IFVG (support)

    The IFVG zone is the portion of the original FVG that was traded through.

    Args:
        ohlcv_data: List of OHLCV dictionaries

    Returns:
        List of IFVG zones
    """
    if len(ohlcv_data) < 3:
        return []

    ifvgs = []

    for i in range(1, len(ohlcv_data) - 1):
        prev_candle = ohlcv_data[i - 1]
        current_candle = ohlcv_data[i]
        next_candle = ohlcv_data[i + 1]

        timestamp = current_candle.get("datetime") or current_candle.get("timestamp")
        if isinstance(timestamp, (int, float)):
            timestamp = datetime.utcfromtimestamp(timestamp / 1000)
        elif isinstance(timestamp, str):
            timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00").replace("+00:00", ""))

        # Check for Bullish FVG
        if prev_candle["high"] < next_candle["low"]:
            fvg_high = next_candle["low"]
            fvg_low = prev_candle["high"]

            # Check if this FVG gets mitigated in subsequent candles
            for j in range(i + 2, len(ohlcv_data)):
                candle = ohlcv_data[j]

                # FVG is mitigated when price trades into it
                if candle["low"] <= fvg_high:
                    # Check if it traded THROUGH the FVG (not just touched)
                    if candle["low"] < fvg_low:
                        # Full mitigation - FVG becomes IFVG (resistance)
                        mitigation_timestamp = candle.get("datetime") or candle.get("timestamp")
                        if isinstance(mitigation_timestamp, (int, float)):
                            mitigation_timestamp = datetime.utcfromtimestamp(mitigation_timestamp / 1000)
                        elif isinstance(mitigation_timestamp, str):
                            mitigation_timestamp = datetime.fromisoformat(
                                mitigation_timestamp.replace("Z", "+00:00").replace("+00:00", "")
                            )

                        ifvgs.append(Zone(
                            zone_type="BEARISH_IFVG",
                            high=fvg_high,
                            low=fvg_low,
                            formed_at=mitigation_timestamp,
                            formed_index=j,
                            is_active=True,
                            mitigated=False,
                            is_ifvg=True,
                            original_type="BULLISH_FVG",
                        ))
                    break

        # Check for Bearish FVG
        if prev_candle["low"] > next_candle["high"]:
            fvg_high = prev_candle["low"]
            fvg_low = next_candle["high"]

            # Check if this FVG gets mitigated in subsequent candles
            for j in range(i + 2, len(ohlcv_data)):
                candle = ohlcv_data[j]

                # FVG is mitigated when price trades into it
                if candle["high"] >= fvg_low:
                    # Check if it traded THROUGH the FVG (not just touched)
                    if candle["high"] > fvg_high:
                        # Full mitigation - FVG becomes IFVG (support)
                        mitigation_timestamp = candle.get("datetime") or candle.get("timestamp")
                        if isinstance(mitigation_timestamp, (int, float)):
                            mitigation_timestamp = datetime.utcfromtimestamp(mitigation_timestamp / 1000)
                        elif isinstance(mitigation_timestamp, str):
                            mitigation_timestamp = datetime.fromisoformat(
                                mitigation_timestamp.replace("Z", "+00:00").replace("+00:00", "")
                            )

                        ifvgs.append(Zone(
                            zone_type="BULLISH_IFVG",
                            high=fvg_high,
                            low=fvg_low,
                            formed_at=mitigation_timestamp,
                            formed_index=j,
                            is_active=True,
                            mitigated=False,
                            is_ifvg=True,
                            original_type="BEARISH_FVG",
                        ))
                    break

    # Check which IFVGs have been mitigated (price returned and respected)
    for ifvg in ifvgs:
        for j in range(ifvg.formed_index + 1, len(ohlcv_data)):
            candle = ohlcv_data[j]

            # BEARISH_IFVG (resistance) mitigated if price breaks above
            if ifvg.zone_type == "BEARISH_IFVG" and candle["close"] > ifvg.high:
                ifvg.mitigated = True
                ifvg.is_active = False
                break

            # BULLISH_IFVG (support) mitigated if price breaks below
            if ifvg.zone_type == "BULLISH_IFVG" and candle["close"] < ifvg.low:
                ifvg.mitigated = True
                ifvg.is_active = False
                break

    return [z for z in ifvgs if z.is_active]


def detect_order_blocks(
    ohlcv_data: list[dict],
    swings: list[dict] = None,
) -> list[Zone]:
    """
    Detect Order Blocks in price data.

    Bullish Order Block:
    - Last bearish (red) candle BEFORE a bullish impulse (series of green candles)
    - The impulse creates a swing low
    - OB = body of the previous bearish candle

    Bearish Order Block:
    - Last bullish (green) candle BEFORE a bearish impulse (series of red candles)
    - The impulse creates a swing high
    - OB = body of the previous bullish candle

    Args:
        ohlcv_data: List of OHLCV dictionaries
        swings: Optional list of detected swings

    Returns:
        List of Order Block zones
    """
    if len(ohlcv_data) < 10:
        return []

    obs = []

    # Simple OB detection based on impulse moves
    for i in range(5, len(ohlcv_data) - 1):
        current = ohlcv_data[i]
        prev = ohlcv_data[i - 1]

        timestamp = current.get("datetime") or current.get("timestamp")
        if isinstance(timestamp, (int, float)):
            timestamp = datetime.utcfromtimestamp(timestamp / 1000)
        elif isinstance(timestamp, str):
            timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00").replace("+00:00", ""))

        # Check for bullish impulse (big green candle after red candle)
        is_current_bullish = current["close"] > current["open"]
        is_prev_bearish = prev["close"] < prev["open"]

        # Calculate candle sizes
        current_body = abs(current["close"] - current["open"])
        avg_body = sum(abs(c["close"] - c["open"]) for c in ohlcv_data[i-5:i]) / 5

        # Bullish OB: previous bearish candle before a strong bullish move
        if is_current_bullish and is_prev_bearish and current_body > avg_body * 1.5:
            obs.append(Zone(
                zone_type="BULLISH_OB",
                high=max(prev["open"], prev["close"]),
                low=min(prev["open"], prev["close"]),
                formed_at=timestamp,
                formed_index=i,
            ))

        # Check for bearish impulse (big red candle after green candle)
        is_current_bearish = current["close"] < current["open"]
        is_prev_bullish = prev["close"] > prev["open"]

        # Bearish OB: previous bullish candle before a strong bearish move
        if is_current_bearish and is_prev_bullish and current_body > avg_body * 1.5:
            obs.append(Zone(
                zone_type="BEARISH_OB",
                high=max(prev["open"], prev["close"]),
                low=min(prev["open"], prev["close"]),
                formed_at=timestamp,
                formed_index=i,
            ))

    # Check which OBs have been mitigated (price returned to zone)
    for ob in obs:
        for j in range(ob.formed_index + 1, len(ohlcv_data)):
            candle = ohlcv_data[j]

            # Bullish OB mitigated when price trades into the zone
            if ob.zone_type == "BULLISH_OB":
                if candle["low"] <= ob.high and candle["low"] >= ob.low:
                    # Price touched OB but didn't break it - still active
                    pass
                elif candle["close"] < ob.low:
                    # Price broke through OB - invalidated
                    ob.is_active = False
                    ob.mitigated = True
                    break

            # Bearish OB mitigated when price trades into the zone
            if ob.zone_type == "BEARISH_OB":
                if candle["high"] >= ob.low and candle["high"] <= ob.high:
                    # Price touched OB but didn't break it - still active
                    pass
                elif candle["close"] > ob.high:
                    # Price broke through OB - invalidated
                    ob.is_active = False
                    ob.mitigated = True
                    break

    # Return only active OBs (limit to most recent)
    active_obs = [ob for ob in obs if ob.is_active]
    return active_obs[-10:]  # Last 10 active OBs


def get_zones_near_price(
    zones: list[Zone],
    current_price: float,
    proximity_pct: float = 3.0,
) -> list[dict]:
    """
    Get zones that are near the current price.

    Args:
        zones: List of Zone objects
        current_price: Current price
        proximity_pct: Percentage proximity threshold

    Returns:
        List of zone dictionaries near current price
    """
    nearby = []

    for zone in zones:
        zone_mid = (zone.high + zone.low) / 2
        distance_pct = abs((current_price - zone_mid) / zone_mid) * 100

        if distance_pct <= proximity_pct:
            nearby.append({
                "type": zone.zone_type,
                "high": zone.high,
                "low": zone.low,
                "mid": zone_mid,
                "distance_pct": round(distance_pct, 2),
                "formed_at": zone.formed_at.isoformat() if zone.formed_at else None,
                "direction": "BULLISH" if "BULLISH" in zone.zone_type else "BEARISH",
            })

    return sorted(nearby, key=lambda x: x["distance_pct"])


def analyze_zones(
    ohlcv_data: list[dict],
    current_price: float = None,
    include_ifvg: bool = True,
) -> dict:
    """
    Complete zone analysis for OHLCV data.

    Args:
        ohlcv_data: OHLCV data
        current_price: Current price
        include_ifvg: Include Inverse FVGs in analysis

    Returns:
        Dictionary with zone analysis
    """
    if not ohlcv_data or len(ohlcv_data) < 10:
        return {
            "fvgs": [],
            "ifvgs": [],
            "order_blocks": [],
            "nearby_zones": [],
        }

    if current_price is None:
        current_price = ohlcv_data[-1]["close"]

    # Detect zones
    fvgs = detect_fvg(ohlcv_data)
    obs = detect_order_blocks(ohlcv_data)
    ifvgs = detect_ifvg(ohlcv_data) if include_ifvg else []

    # Format for output
    fvg_list = [
        {
            "type": z.zone_type,
            "high": z.high,
            "low": z.low,
            "formed_at": z.formed_at.isoformat() if z.formed_at else None,
            "is_active": z.is_active,
        }
        for z in fvgs[-10:]  # Last 10
    ]

    ifvg_list = [
        {
            "type": z.zone_type,
            "high": z.high,
            "low": z.low,
            "formed_at": z.formed_at.isoformat() if z.formed_at else None,
            "is_active": z.is_active,
            "original_type": z.original_type,
        }
        for z in ifvgs[-10:]  # Last 10
    ]

    ob_list = [
        {
            "type": z.zone_type,
            "high": z.high,
            "low": z.low,
            "formed_at": z.formed_at.isoformat() if z.formed_at else None,
            "is_active": z.is_active,
        }
        for z in obs[-10:]  # Last 10
    ]

    # Get zones near current price (include IFVGs)
    all_zones = fvgs + obs + ifvgs
    nearby = get_zones_near_price(all_zones, current_price)

    return {
        "fvgs": fvg_list,
        "ifvgs": ifvg_list,
        "order_blocks": ob_list,
        "nearby_zones": nearby,
        "current_price": current_price,
    }
