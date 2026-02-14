"""
ICT Signal Generator Module.

Combines all ICT components to generate actionable trading signals:
- HTF bias (4H structure)
- Liquidity sweep detection
- Displacement confirmation
- MSS (Market Structure Shift)
- FVG/OB entry zones
- Session filtering

Produces signals with entry, stop loss, and take profit levels.
"""
from datetime import datetime
from typing import Literal, Optional
from dataclasses import dataclass, field

from calculations.structure import analyze_structure, detect_swings
from calculations.zones import analyze_zones, detect_fvg, detect_order_blocks, detect_ifvg, Zone
from calculations.liquidity import analyze_liquidity, detect_liquidity_sweeps, get_recent_sweep
from calculations.displacement import analyze_displacement, get_recent_displacement
from calculations.amd import analyze_amd, detect_amd_pattern
from calculations.sessions import get_session_info, is_killzone, should_trade


@dataclass
class ICTSignal:
    """Represents an ICT trading signal."""
    direction: Literal["LONG", "SHORT"]
    signal_type: Literal["AMD_DISTRIBUTION", "SWEEP_REVERSAL", "DISPLACEMENT_ENTRY"]
    confidence: float  # 0-1

    # Entry details
    entry_type: Literal["FVG_RETEST", "IFVG_RETEST", "OB_RETEST", "IMMEDIATE", "LIMIT"]
    entry_zone_high: float
    entry_zone_low: float
    entry_price: float  # Mid of zone or specific price

    # Risk management
    stop_loss: float
    take_profit_1: float  # 1:1 R:R or first liquidity
    take_profit_2: float  # 2:1 R:R or second liquidity
    take_profit_3: Optional[float] = None  # 3:1 R:R

    # Risk/Reward
    risk_amount: float = 0
    reward_1: float = 0
    reward_2: float = 0
    rr_ratio: float = 0

    # Context
    htf_bias: str = ""
    session: str = ""
    in_killzone: bool = False
    timestamp: datetime = field(default_factory=datetime.utcnow)

    # Pattern components (what triggered)
    components: dict = field(default_factory=dict)


def calculate_take_profits(
    entry: float,
    stop_loss: float,
    direction: str,
    liquidity_targets: list[dict] = None,
) -> tuple[float, float, Optional[float]]:
    """
    Calculate take profit levels.

    Uses either R:R multiples or liquidity targets.

    Args:
        entry: Entry price
        stop_loss: Stop loss price
        direction: LONG or SHORT
        liquidity_targets: Nearby liquidity pools

    Returns:
        Tuple of (TP1, TP2, TP3)
    """
    risk = abs(entry - stop_loss)

    if direction == "LONG":
        # Default R:R targets
        tp1 = entry + risk * 1.0  # 1:1
        tp2 = entry + risk * 2.0  # 2:1
        tp3 = entry + risk * 3.0  # 3:1

        # Override with liquidity targets if available
        if liquidity_targets:
            above_targets = sorted(
                [t for t in liquidity_targets if t["direction"] == "ABOVE"],
                key=lambda x: x["price"]
            )
            if len(above_targets) >= 1 and above_targets[0]["price"] > entry:
                tp1 = above_targets[0]["price"]
            if len(above_targets) >= 2 and above_targets[1]["price"] > tp1:
                tp2 = above_targets[1]["price"]

    else:  # SHORT
        tp1 = entry - risk * 1.0
        tp2 = entry - risk * 2.0
        tp3 = entry - risk * 3.0

        if liquidity_targets:
            below_targets = sorted(
                [t for t in liquidity_targets if t["direction"] == "BELOW"],
                key=lambda x: x["price"],
                reverse=True
            )
            if len(below_targets) >= 1 and below_targets[0]["price"] < entry:
                tp1 = below_targets[0]["price"]
            if len(below_targets) >= 2 and below_targets[1]["price"] < tp1:
                tp2 = below_targets[1]["price"]

    return tp1, tp2, tp3


def generate_ict_signal(
    ltf_ohlcv: list[dict],
    htf_ohlcv: list[dict] = None,
    current_price: float = None,
    require_killzone: bool = False,
) -> Optional[ICTSignal]:
    """
    Generate an ICT trading signal.

    The signal is generated when all conditions align:
    1. HTF bias is clear (from 4H structure)
    2. LTF shows liquidity sweep into key level
    3. Displacement confirms reversal
    4. MSS confirms direction change
    5. Entry zone (FVG/OB) is available

    Args:
        ltf_ohlcv: Lower timeframe OHLCV data (1m/5m/15m)
        htf_ohlcv: Higher timeframe OHLCV data (4H)
        current_price: Current market price
        require_killzone: Only generate signals during killzones

    Returns:
        ICTSignal or None if no valid setup
    """
    if not ltf_ohlcv or len(ltf_ohlcv) < 50:
        return None

    if current_price is None:
        current_price = ltf_ohlcv[-1]["close"]

    # Check session
    session_info = get_session_info()

    if require_killzone and not session_info["in_killzone"]:
        return None

    if not should_trade():
        return None

    # Step 1: Get HTF bias
    htf_bias = "NEUTRAL"
    htf_zones = []

    if htf_ohlcv and len(htf_ohlcv) >= 50:
        htf_structure = analyze_structure(htf_ohlcv, "4h", current_price)
        htf_bias = htf_structure.get("bias", "NEUTRAL")

        # Get HTF zones as key levels
        htf_zone_analysis = analyze_zones(htf_ohlcv, current_price)
        for fvg in htf_zone_analysis.get("fvgs", []):
            htf_zones.append(Zone(
                zone_type=fvg["type"],
                high=fvg["high"],
                low=fvg["low"],
                formed_at=datetime.now(),
                formed_index=0,
            ))
        for ob in htf_zone_analysis.get("order_blocks", []):
            htf_zones.append(Zone(
                zone_type=ob["type"],
                high=ob["high"],
                low=ob["low"],
                formed_at=datetime.now(),
                formed_index=0,
            ))

    # Step 2: Analyze AMD pattern on LTF
    amd_result = analyze_amd(ltf_ohlcv, htf_bias, htf_zones, current_price)

    # Step 3: Check for valid signal conditions
    if amd_result["phase"] != "DISTRIBUTION":
        # Not in distribution phase - no signal yet
        return None

    if amd_result["confidence"] < 0.6:
        # Low confidence - skip
        return None

    direction = amd_result["direction"]
    if direction not in ("BULLISH", "BEARISH"):
        return None

    # Map to LONG/SHORT
    signal_direction = "LONG" if direction == "BULLISH" else "SHORT"

    # Step 4: Check HTF alignment
    htf_aligned = (
        (htf_bias == "BULLISH" and signal_direction == "LONG") or
        (htf_bias == "BEARISH" and signal_direction == "SHORT") or
        htf_bias == "NEUTRAL"
    )

    if not htf_aligned:
        # Counter-trend - reduce confidence
        amd_result["confidence"] *= 0.7

    # Step 5: Determine entry zone
    details = amd_result.get("details", {})
    entry_zone = details.get("entry_zone", {})

    entry_zone_high = entry_zone.get("high")
    entry_zone_low = entry_zone.get("low")
    entry_type = "FVG_RETEST"

    # If no entry zone from AMD, look for IFVG or OB
    if not entry_zone_high or not entry_zone_low:
        ltf_zones = analyze_zones(ltf_ohlcv, current_price, include_ifvg=True)

        # Find relevant zone
        for zone in ltf_zones.get("nearby_zones", []):
            zone_direction = zone.get("direction", "")

            # Match zone direction to signal
            if signal_direction == "LONG" and zone_direction == "BULLISH":
                entry_zone_high = zone["high"]
                entry_zone_low = zone["low"]
                if "IFVG" in zone["type"]:
                    entry_type = "IFVG_RETEST"
                elif "OB" in zone["type"]:
                    entry_type = "OB_RETEST"
                break

            elif signal_direction == "SHORT" and zone_direction == "BEARISH":
                entry_zone_high = zone["high"]
                entry_zone_low = zone["low"]
                if "IFVG" in zone["type"]:
                    entry_type = "IFVG_RETEST"
                elif "OB" in zone["type"]:
                    entry_type = "OB_RETEST"
                break

    # Still no entry zone? Use immediate entry
    if not entry_zone_high or not entry_zone_low:
        entry_zone_high = current_price * 1.001
        entry_zone_low = current_price * 0.999
        entry_type = "IMMEDIATE"

    entry_price = (entry_zone_high + entry_zone_low) / 2

    # Step 6: Determine stop loss
    stop_loss = details.get("stop_loss")

    if not stop_loss:
        # Fallback: use sweep extreme or ATR-based stop
        if signal_direction == "LONG":
            stop_loss = entry_zone_low * 0.99  # 1% below zone
        else:
            stop_loss = entry_zone_high * 1.01  # 1% above zone

    # Step 7: Get liquidity targets for TPs
    liquidity_analysis = analyze_liquidity(ltf_ohlcv, current_price)
    liquidity_targets = liquidity_analysis.get("liquidity_pools", [])

    tp1, tp2, tp3 = calculate_take_profits(entry_price, stop_loss, signal_direction, liquidity_targets)

    # Calculate R:R
    risk = abs(entry_price - stop_loss)
    reward_1 = abs(tp1 - entry_price)
    reward_2 = abs(tp2 - entry_price)
    rr_ratio = reward_2 / risk if risk > 0 else 0

    # Build components dict
    components = {
        "htf_bias": htf_bias,
        "htf_aligned": htf_aligned,
        "amd_phase": amd_result["phase"],
        "amd_confidence": amd_result["confidence"],
        "mss_confirmed": details.get("distribution", {}).get("mss_confirmed", False),
        "fvg_formed": details.get("distribution", {}).get("fvg_formed", False),
        "swept_level": details.get("manipulation", {}).get("swept_level"),
        "sweep_extreme": details.get("manipulation", {}).get("sweep_extreme"),
    }

    return ICTSignal(
        direction=signal_direction,
        signal_type="AMD_DISTRIBUTION",
        confidence=round(amd_result["confidence"], 2),
        entry_type=entry_type,
        entry_zone_high=entry_zone_high,
        entry_zone_low=entry_zone_low,
        entry_price=round(entry_price, 2),
        stop_loss=round(stop_loss, 2),
        take_profit_1=round(tp1, 2),
        take_profit_2=round(tp2, 2),
        take_profit_3=round(tp3, 2) if tp3 else None,
        risk_amount=round(risk, 2),
        reward_1=round(reward_1, 2),
        reward_2=round(reward_2, 2),
        rr_ratio=round(rr_ratio, 2),
        htf_bias=htf_bias,
        session=session_info["session"],
        in_killzone=session_info["in_killzone"],
        timestamp=datetime.utcnow(),
        components=components,
    )


def analyze_ict_setup(
    ltf_ohlcv: list[dict],
    htf_ohlcv: list[dict] = None,
    current_price: float = None,
    timeframe: str = "15m",
) -> dict:
    """
    Complete ICT setup analysis.

    Returns all components and signals in a structured format.

    Args:
        ltf_ohlcv: Lower timeframe data
        htf_ohlcv: Higher timeframe data (4H)
        current_price: Current price
        timeframe: LTF timeframe string

    Returns:
        Dictionary with complete ICT analysis
    """
    if not ltf_ohlcv or len(ltf_ohlcv) < 30:
        return {
            "signal": None,
            "amd": {"phase": "NONE", "direction": None, "confidence": 0},
            "structure": {},
            "zones": {},
            "liquidity": {},
            "displacement": {},
            "session": {},
        }

    if current_price is None:
        current_price = ltf_ohlcv[-1]["close"]

    # Get HTF bias
    htf_bias = "NEUTRAL"
    htf_structure = {}
    if htf_ohlcv and len(htf_ohlcv) >= 30:
        htf_structure = analyze_structure(htf_ohlcv, "4h", current_price)
        htf_bias = htf_structure.get("bias", "NEUTRAL")

    # Analyze LTF structure
    ltf_structure = analyze_structure(ltf_ohlcv, timeframe, current_price)

    # Analyze zones
    zones = analyze_zones(ltf_ohlcv, current_price, include_ifvg=True)

    # Analyze liquidity
    liquidity = analyze_liquidity(ltf_ohlcv, current_price)

    # Analyze displacement
    displacement = analyze_displacement(ltf_ohlcv, current_price)

    # Analyze AMD pattern
    htf_zones = []
    if htf_ohlcv:
        htf_zone_analysis = analyze_zones(htf_ohlcv, current_price)
        for z in htf_zone_analysis.get("fvgs", []) + htf_zone_analysis.get("order_blocks", []):
            htf_zones.append(Zone(
                zone_type=z["type"],
                high=z["high"],
                low=z["low"],
                formed_at=datetime.now(),
                formed_index=0,
            ))

    amd = analyze_amd(ltf_ohlcv, htf_bias, htf_zones, current_price)

    # Generate signal
    signal = generate_ict_signal(ltf_ohlcv, htf_ohlcv, current_price)

    # Get session info
    session = get_session_info()

    # Format signal for output
    signal_dict = None
    if signal:
        signal_dict = {
            "direction": signal.direction,
            "signal_type": signal.signal_type,
            "confidence": signal.confidence,
            "entry_type": signal.entry_type,
            "entry_zone": {
                "high": signal.entry_zone_high,
                "low": signal.entry_zone_low,
                "mid": signal.entry_price,
            },
            "stop_loss": signal.stop_loss,
            "take_profits": {
                "tp1": signal.take_profit_1,
                "tp2": signal.take_profit_2,
                "tp3": signal.take_profit_3,
            },
            "risk_reward": {
                "risk": signal.risk_amount,
                "reward_1": signal.reward_1,
                "reward_2": signal.reward_2,
                "rr_ratio": signal.rr_ratio,
            },
            "context": {
                "htf_bias": signal.htf_bias,
                "session": signal.session,
                "in_killzone": signal.in_killzone,
            },
            "components": signal.components,
            "timestamp": signal.timestamp.isoformat(),
        }

    return {
        "signal": signal_dict,
        "amd": amd,
        "htf_structure": htf_structure,
        "ltf_structure": ltf_structure,
        "zones": zones,
        "liquidity": liquidity,
        "displacement": displacement,
        "session": session,
        "current_price": current_price,
    }
