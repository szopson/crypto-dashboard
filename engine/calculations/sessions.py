"""
Trading Sessions Module.

Defines trading session time windows and utilities for
filtering signals by session.
"""
from datetime import datetime, time, timezone
from typing import Literal, Optional
from dataclasses import dataclass
from zoneinfo import ZoneInfo


SessionType = Literal["ASIAN", "LONDON", "NY", "NY_AM", "NY_PM", "OVERLAP", "OFF_HOURS"]


@dataclass
class TradingSession:
    """Represents a trading session."""
    name: SessionType
    start_utc: time
    end_utc: time
    description: str
    is_high_volume: bool = True


# Trading session definitions (all times in UTC)
SESSIONS = {
    "ASIAN": TradingSession(
        name="ASIAN",
        start_utc=time(0, 0),
        end_utc=time(8, 0),
        description="Asian Session (Tokyo/Sydney)",
        is_high_volume=False,
    ),
    "LONDON": TradingSession(
        name="LONDON",
        start_utc=time(7, 0),
        end_utc=time(16, 0),
        description="London Session",
        is_high_volume=True,
    ),
    "NY": TradingSession(
        name="NY",
        start_utc=time(13, 0),
        end_utc=time(22, 0),
        description="New York Session",
        is_high_volume=True,
    ),
    "NY_AM": TradingSession(
        name="NY_AM",
        start_utc=time(13, 0),
        end_utc=time(17, 0),
        description="New York AM (ICT Killzone)",
        is_high_volume=True,
    ),
    "NY_PM": TradingSession(
        name="NY_PM",
        start_utc=time(18, 0),
        end_utc=time(21, 0),
        description="New York PM Session",
        is_high_volume=True,
    ),
    "OVERLAP": TradingSession(
        name="OVERLAP",
        start_utc=time(13, 0),
        end_utc=time(16, 0),
        description="London/NY Overlap (Highest Volume)",
        is_high_volume=True,
    ),
}


def get_current_session(dt: datetime = None) -> SessionType:
    """
    Determine which trading session is currently active.

    Args:
        dt: Datetime to check (defaults to now UTC)

    Returns:
        Current session type
    """
    if dt is None:
        dt = datetime.now(timezone.utc)

    # Ensure UTC
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)

    current_time = dt.time()

    # Check overlap first (highest priority)
    if _time_in_range(current_time, SESSIONS["OVERLAP"].start_utc, SESSIONS["OVERLAP"].end_utc):
        return "OVERLAP"

    # Check NY AM (ICT Killzone)
    if _time_in_range(current_time, SESSIONS["NY_AM"].start_utc, SESSIONS["NY_AM"].end_utc):
        return "NY_AM"

    # Check NY PM
    if _time_in_range(current_time, SESSIONS["NY_PM"].start_utc, SESSIONS["NY_PM"].end_utc):
        return "NY_PM"

    # Check broader sessions
    if _time_in_range(current_time, SESSIONS["NY"].start_utc, SESSIONS["NY"].end_utc):
        return "NY"

    if _time_in_range(current_time, SESSIONS["LONDON"].start_utc, SESSIONS["LONDON"].end_utc):
        return "LONDON"

    if _time_in_range(current_time, SESSIONS["ASIAN"].start_utc, SESSIONS["ASIAN"].end_utc):
        return "ASIAN"

    return "OFF_HOURS"


def _time_in_range(check_time: time, start: time, end: time) -> bool:
    """Check if time is within range, handling midnight crossover."""
    if start <= end:
        return start <= check_time <= end
    else:
        # Crosses midnight
        return check_time >= start or check_time <= end


def is_killzone(dt: datetime = None) -> bool:
    """
    Check if current time is in an ICT Killzone.

    ICT Killzones are high-probability trading windows:
    - London Open: 07:00-10:00 UTC
    - NY AM: 13:00-16:00 UTC (highest probability)
    - NY PM: 18:00-21:00 UTC

    Args:
        dt: Datetime to check (defaults to now UTC)

    Returns:
        True if in a killzone
    """
    if dt is None:
        dt = datetime.now(timezone.utc)

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)

    current_time = dt.time()

    # London Open Killzone
    if _time_in_range(current_time, time(7, 0), time(10, 0)):
        return True

    # NY AM Killzone (highest probability)
    if _time_in_range(current_time, time(13, 0), time(16, 0)):
        return True

    # NY PM Killzone
    if _time_in_range(current_time, time(18, 0), time(21, 0)):
        return True

    return False


def get_session_info(dt: datetime = None) -> dict:
    """
    Get detailed session information for a given time.

    Args:
        dt: Datetime to check (defaults to now UTC)

    Returns:
        Dictionary with session details
    """
    if dt is None:
        dt = datetime.now(timezone.utc)

    session = get_current_session(dt)
    in_killzone = is_killzone(dt)

    session_data = SESSIONS.get(session)

    return {
        "session": session,
        "description": session_data.description if session_data else "Off-Hours",
        "is_high_volume": session_data.is_high_volume if session_data else False,
        "in_killzone": in_killzone,
        "timestamp": dt.isoformat(),
        "utc_time": dt.strftime("%H:%M UTC"),
    }


def should_trade(dt: datetime = None, require_killzone: bool = False) -> bool:
    """
    Determine if trading should be active based on session.

    Args:
        dt: Datetime to check
        require_killzone: If True, only trade during killzones

    Returns:
        True if trading is recommended
    """
    session = get_current_session(dt)

    if session == "OFF_HOURS":
        return False

    if require_killzone:
        return is_killzone(dt)

    # Trade during any active session
    return session in ("LONDON", "NY", "NY_AM", "NY_PM", "OVERLAP")


def get_next_killzone(dt: datetime = None) -> dict:
    """
    Get information about the next upcoming killzone.

    Args:
        dt: Current datetime (defaults to now UTC)

    Returns:
        Dictionary with next killzone info
    """
    if dt is None:
        dt = datetime.now(timezone.utc)

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    current_time = dt.time()

    killzones = [
        ("LONDON_OPEN", time(7, 0), time(10, 0)),
        ("NY_AM", time(13, 0), time(16, 0)),
        ("NY_PM", time(18, 0), time(21, 0)),
    ]

    for name, start, end in killzones:
        if current_time < start:
            # This killzone is upcoming today
            next_dt = dt.replace(hour=start.hour, minute=start.minute, second=0, microsecond=0)
            return {
                "name": name,
                "starts_at": next_dt.isoformat(),
                "ends_at": dt.replace(hour=end.hour, minute=end.minute).isoformat(),
                "hours_until": (next_dt - dt).total_seconds() / 3600,
            }

    # All killzones passed today, return tomorrow's London Open
    from datetime import timedelta
    tomorrow = dt + timedelta(days=1)
    next_dt = tomorrow.replace(hour=7, minute=0, second=0, microsecond=0)

    return {
        "name": "LONDON_OPEN",
        "starts_at": next_dt.isoformat(),
        "ends_at": tomorrow.replace(hour=10, minute=0).isoformat(),
        "hours_until": (next_dt - dt).total_seconds() / 3600,
    }
