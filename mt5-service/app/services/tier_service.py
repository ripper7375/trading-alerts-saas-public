"""
Tier Service - Tier Validation Logic

Validates symbol and timeframe access based on user tier (FREE/PRO).
Mirrors the tier validation logic from Next.js frontend.
"""

from typing import List, Tuple

from app.utils.constants import (
    FREE_TIER_SYMBOLS,
    FREE_TIER_TIMEFRAMES,
    PRO_TIER_SYMBOLS,
    PRO_TIER_TIMEFRAMES,
)


def validate_symbol_access(symbol: str, tier: str) -> Tuple[bool, str]:
    """
    Validate if a user's tier allows access to a specific symbol.

    Args:
        symbol (str): Trading symbol (e.g., XAUUSD)
        tier (str): User tier (FREE or PRO)

    Returns:
        Tuple[bool, str]: (is_allowed, error_message)
    """
    if tier == 'PRO':
        # PRO users can access all symbols
        if symbol in PRO_TIER_SYMBOLS:
            return True, ''
        else:
            return False, f'{symbol} is not a valid symbol'

    # FREE tier validation
    if symbol in FREE_TIER_SYMBOLS:
        return True, ''
    else:
        accessible_symbols = ', '.join(FREE_TIER_SYMBOLS)
        return False, (
            f'FREE tier cannot access {symbol}. '
            f'Accessible symbols: {accessible_symbols}. '
            'Upgrade to PRO for access to all 15 symbols.'
        )


def validate_timeframe_access(timeframe: str, tier: str) -> Tuple[bool, str]:
    """
    Validate if a user's tier allows access to a specific timeframe.

    Args:
        timeframe (str): Chart timeframe (e.g., H1)
        tier (str): User tier (FREE or PRO)

    Returns:
        Tuple[bool, str]: (is_allowed, error_message)
    """
    if tier == 'PRO':
        # PRO users can access all timeframes
        if timeframe in PRO_TIER_TIMEFRAMES:
            return True, ''
        else:
            return False, f'{timeframe} is not a valid timeframe'

    # FREE tier validation
    if timeframe in FREE_TIER_TIMEFRAMES:
        return True, ''
    else:
        accessible_timeframes = ', '.join(FREE_TIER_TIMEFRAMES)
        return False, (
            f'FREE tier cannot access {timeframe} timeframe. '
            f'Accessible timeframes: {accessible_timeframes}. '
            'Upgrade to PRO for access to all 9 timeframes.'
        )


def validate_chart_access(
    symbol: str, timeframe: str, tier: str
) -> Tuple[bool, str]:
    """
    Validate if a user's tier allows access to a specific
    symbol + timeframe combination.

    Args:
        symbol (str): Trading symbol (e.g., XAUUSD)
        timeframe (str): Chart timeframe (e.g., H1)
        tier (str): User tier (FREE or PRO)

    Returns:
        Tuple[bool, str]: (is_allowed, error_message)
    """
    # Validate symbol first
    symbol_allowed, symbol_error = validate_symbol_access(symbol, tier)
    if not symbol_allowed:
        return False, symbol_error

    # Validate timeframe
    timeframe_allowed, timeframe_error = validate_timeframe_access(
        timeframe, tier
    )
    if not timeframe_allowed:
        return False, timeframe_error

    # Both validations passed
    return True, None


def get_accessible_symbols(tier: str) -> List[str]:
    """
    Get list of symbols accessible by a tier.

    Args:
        tier: User tier (FREE or PRO)

    Returns:
        List[str]: List of accessible symbol strings
    """
    if tier == 'PRO':
        return list(PRO_TIER_SYMBOLS)
    return list(FREE_TIER_SYMBOLS)


def get_accessible_timeframes(tier: str) -> List[str]:
    """
    Get list of timeframes accessible by a tier.

    Args:
        tier: User tier (FREE or PRO)

    Returns:
        List[str]: List of accessible timeframe strings
    """
    if tier == 'PRO':
        return list(PRO_TIER_TIMEFRAMES)
    return list(FREE_TIER_TIMEFRAMES)


def validate_symbol_access_simple(symbol: str, tier: str) -> bool:
    """
    Simple boolean check for symbol access.

    Args:
        symbol: Trading symbol
        tier: User tier

    Returns:
        bool: True if access allowed
    """
    allowed, _ = validate_symbol_access(symbol, tier)
    return allowed


def validate_timeframe_access_simple(timeframe: str, tier: str) -> bool:
    """
    Simple boolean check for timeframe access.

    Args:
        timeframe: Chart timeframe
        tier: User tier

    Returns:
        bool: True if access allowed
    """
    allowed, _ = validate_timeframe_access(timeframe, tier)
    return allowed
