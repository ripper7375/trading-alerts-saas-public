"""
Constants - Tier System Configuration

Defines symbol access, timeframe access, and MT5 timeframe mappings.
"""

from typing import Dict, List

# Try to import MetaTrader5, but provide fallback constants for testing/CI
try:
    import MetaTrader5 as mt5
    MT5_AVAILABLE = True
except ImportError:
    # Fallback constants for testing on non-Windows systems
    MT5_AVAILABLE = False

    class MT5Fallback:
        """Fallback MT5 constants for testing"""
        TIMEFRAME_M5 = 5
        TIMEFRAME_M15 = 15
        TIMEFRAME_M30 = 30
        TIMEFRAME_H1 = 16385
        TIMEFRAME_H2 = 16386
        TIMEFRAME_H4 = 16388
        TIMEFRAME_H8 = 32769
        TIMEFRAME_H12 = 49153
        TIMEFRAME_D1 = 16408

    mt5 = MT5Fallback()

# ============================================================================
# TIMEFRAME MAPPING (9 timeframes total)
# ============================================================================
TIMEFRAME_MAP: Dict[str, int] = {
    'M5': mt5.TIMEFRAME_M5,      # 5 minutes (PRO only)
    'M15': mt5.TIMEFRAME_M15,    # 15 minutes
    'M30': mt5.TIMEFRAME_M30,    # 30 minutes
    'H1': mt5.TIMEFRAME_H1,      # 1 hour
    'H2': mt5.TIMEFRAME_H2,      # 2 hours
    'H4': mt5.TIMEFRAME_H4,      # 4 hours
    'H8': mt5.TIMEFRAME_H8,      # 8 hours
    'H12': mt5.TIMEFRAME_H12,    # 12 hours (PRO only)
    'D1': mt5.TIMEFRAME_D1       # 1 day
}

# ============================================================================
# FREE TIER CONFIGURATION (5 symbols × 3 timeframes)
# ============================================================================
FREE_TIER_SYMBOLS: List[str] = [
    'BTCUSD',   # Bitcoin
    'EURUSD',   # Euro/US Dollar
    'USDJPY',   # US Dollar/Japanese Yen
    'US30',     # Dow Jones Industrial Average
    'XAUUSD'    # Gold/US Dollar
]

FREE_TIER_TIMEFRAMES: List[str] = [
    'H1',   # 1 hour
    'H4',   # 4 hours
    'D1'    # 1 day
]

# ============================================================================
# PRO TIER CONFIGURATION (15 symbols × 9 timeframes)
# ============================================================================
PRO_TIER_SYMBOLS: List[str] = [
    'AUDJPY',   # Australian Dollar/Japanese Yen
    'AUDUSD',   # Australian Dollar/US Dollar
    'BTCUSD',   # Bitcoin
    'ETHUSD',   # Ethereum
    'EURUSD',   # Euro/US Dollar
    'GBPJPY',   # British Pound/Japanese Yen
    'GBPUSD',   # British Pound/US Dollar
    'NDX100',   # NASDAQ 100
    'NZDUSD',   # New Zealand Dollar/US Dollar
    'US30',     # Dow Jones Industrial Average
    'USDCAD',   # US Dollar/Canadian Dollar
    'USDCHF',   # US Dollar/Swiss Franc
    'USDJPY',   # US Dollar/Japanese Yen
    'XAGUSD',   # Silver/US Dollar
    'XAUUSD'    # Gold/US Dollar
]

PRO_TIER_TIMEFRAMES: List[str] = [
    'M5',   # 5 minutes
    'M15',  # 15 minutes
    'M30',  # 30 minutes
    'H1',   # 1 hour
    'H2',   # 2 hours
    'H4',   # 4 hours
    'H8',   # 8 hours
    'H12',  # 12 hours
    'D1'    # 1 day
]
