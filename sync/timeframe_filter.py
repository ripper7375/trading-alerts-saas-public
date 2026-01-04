"""
Timeframe Filtering Logic
Part 20 - Trading Alerts SaaS

Filters SQLite rows based on timestamp matching for each timeframe.

Timeframe Categorization Rules (from architecture design):
- M5:  Minutes divisible by 5 (00, 05, 10, 15, ...)
- M15: Minutes divisible by 15 (00, 15, 30, 45)
- M30: Minutes divisible by 30 (00, 30)
- H1:  On the hour (minute == 0)
- H2:  Even hours (minute == 0 AND hour % 2 == 0)
- H4:  Hours divisible by 4 (minute == 0 AND hour % 4 == 0)
- H8:  Hours divisible by 8 (minute == 0 AND hour % 8 == 0)
- H12: Hours divisible by 12 (minute == 0 AND hour % 12 == 0)
- D1:  Midnight only (hour == 0 AND minute == 0)
"""

from datetime import datetime
from typing import List, Tuple, Dict, Any

# Timeframe divisors in minutes
TIMEFRAME_DIVISORS: Dict[str, int] = {
    "M5": 5,       # Minutes divisible by 5
    "M15": 15,     # Minutes divisible by 15
    "M30": 30,     # Minutes divisible by 30
    "H1": 60,      # On the hour
    "H2": 120,     # Every 2 hours
    "H4": 240,     # Every 4 hours
    "H8": 480,     # Every 8 hours
    "H12": 720,    # Every 12 hours
    "D1": 1440,    # Once per day (midnight)
}


def filter_by_timeframe(rows: List[Tuple], timeframe: str) -> List[Tuple]:
    """
    Filter rows to only include timestamps matching the timeframe.

    For M5: timestamps at :00, :05, :10, :15, :20, :25, :30, :35, :40, :45, :50, :55
    For M15: timestamps at :00, :15, :30, :45
    For M30: timestamps at :00, :30
    For H1: timestamps at :00:00 of each hour
    For H2: timestamps at :00:00 of even hours (0, 2, 4, 6, ...)
    For H4: timestamps at :00:00 of hours divisible by 4 (0, 4, 8, 12, 16, 20)
    For H8: timestamps at :00:00 of hours divisible by 8 (0, 8, 16)
    For H12: timestamps at :00:00 of hours divisible by 12 (0, 12)
    For D1: timestamps at 00:00:00 each day

    Args:
        rows: List of database row tuples where first element is Unix timestamp
        timeframe: Timeframe string (M5, M15, M30, H1, H2, H4, H8, H12, D1)

    Returns:
        Filtered list of rows matching the timeframe criteria
    """
    if timeframe not in TIMEFRAME_DIVISORS:
        return []

    filtered = []
    for row in rows:
        timestamp = row[0]  # First column is Unix timestamp
        dt = datetime.utcfromtimestamp(timestamp)

        if _matches_timeframe(dt, timeframe):
            filtered.append(row)

    return filtered


def _matches_timeframe(dt: datetime, timeframe: str) -> bool:
    """
    Check if a datetime matches the timeframe criteria.

    Args:
        dt: Datetime object to check
        timeframe: Timeframe string

    Returns:
        True if the datetime matches the timeframe criteria
    """
    if timeframe == "D1":
        # Daily: must be exactly midnight (00:00:00)
        return dt.hour == 0 and dt.minute == 0

    if timeframe == "H12":
        # H12: minute must be 0 and hour must be 0 or 12
        return dt.minute == 0 and dt.hour % 12 == 0

    if timeframe == "H8":
        # H8: minute must be 0 and hour must be divisible by 8 (0, 8, 16)
        return dt.minute == 0 and dt.hour % 8 == 0

    if timeframe == "H4":
        # H4: minute must be 0 and hour must be divisible by 4 (0, 4, 8, 12, 16, 20)
        return dt.minute == 0 and dt.hour % 4 == 0

    if timeframe == "H2":
        # H2: minute must be 0 and hour must be even
        return dt.minute == 0 and dt.hour % 2 == 0

    if timeframe == "H1":
        # H1: minute must be 0 (on the hour)
        return dt.minute == 0

    if timeframe == "M30":
        # M30: minute must be 0 or 30
        return dt.minute % 30 == 0

    if timeframe == "M15":
        # M15: minute must be 0, 15, 30, or 45
        return dt.minute % 15 == 0

    if timeframe == "M5":
        # M5: minute must be divisible by 5
        return dt.minute % 5 == 0

    return False


def get_latest_timeframe_timestamp(timeframe: str) -> int:
    """
    Get the most recent valid timestamp for a timeframe.

    Rounds down the current UTC time to the nearest valid timestamp
    for the specified timeframe.

    Args:
        timeframe: Timeframe string (M5, M15, M30, H1, H2, H4, H8, H12, D1)

    Returns:
        Unix timestamp of the most recent valid timeframe boundary
    """
    now = datetime.utcnow()

    if timeframe == "D1":
        # Round down to midnight
        aligned = now.replace(hour=0, minute=0, second=0, microsecond=0)

    elif timeframe == "H12":
        # Round down to 0 or 12 hours
        aligned_hour = (now.hour // 12) * 12
        aligned = now.replace(hour=aligned_hour, minute=0, second=0, microsecond=0)

    elif timeframe == "H8":
        # Round down to 0, 8, or 16 hours
        aligned_hour = (now.hour // 8) * 8
        aligned = now.replace(hour=aligned_hour, minute=0, second=0, microsecond=0)

    elif timeframe == "H4":
        # Round down to nearest 4-hour boundary
        aligned_hour = (now.hour // 4) * 4
        aligned = now.replace(hour=aligned_hour, minute=0, second=0, microsecond=0)

    elif timeframe == "H2":
        # Round down to nearest even hour
        aligned_hour = (now.hour // 2) * 2
        aligned = now.replace(hour=aligned_hour, minute=0, second=0, microsecond=0)

    elif timeframe == "H1":
        # Round down to current hour
        aligned = now.replace(minute=0, second=0, microsecond=0)

    elif timeframe == "M30":
        # Round down to 0 or 30 minutes
        aligned_minute = (now.minute // 30) * 30
        aligned = now.replace(minute=aligned_minute, second=0, microsecond=0)

    elif timeframe == "M15":
        # Round down to 0, 15, 30, or 45 minutes
        aligned_minute = (now.minute // 15) * 15
        aligned = now.replace(minute=aligned_minute, second=0, microsecond=0)

    elif timeframe == "M5":
        # Round down to nearest 5-minute boundary
        aligned_minute = (now.minute // 5) * 5
        aligned = now.replace(minute=aligned_minute, second=0, microsecond=0)

    else:
        # Default to M5 if unknown timeframe
        aligned_minute = (now.minute // 5) * 5
        aligned = now.replace(minute=aligned_minute, second=0, microsecond=0)

    return int(aligned.timestamp())


def get_timeframe_duration_seconds(timeframe: str) -> int:
    """
    Get the duration of a timeframe in seconds.

    Args:
        timeframe: Timeframe string

    Returns:
        Duration in seconds
    """
    divisor = TIMEFRAME_DIVISORS.get(timeframe, 5)
    return divisor * 60


def categorize_timestamp(timestamp: int) -> List[str]:
    """
    Determine which timeframes a timestamp belongs to.

    A timestamp can belong to multiple timeframes. For example,
    midnight belongs to all timeframes (M5, M15, M30, H1, H2, H4, H8, H12, D1).

    Args:
        timestamp: Unix timestamp

    Returns:
        List of timeframe strings this timestamp belongs to
    """
    dt = datetime.utcfromtimestamp(timestamp)
    matching_timeframes = []

    for timeframe in TIMEFRAME_DIVISORS:
        if _matches_timeframe(dt, timeframe):
            matching_timeframes.append(timeframe)

    return matching_timeframes
