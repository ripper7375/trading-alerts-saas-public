"""
OHLCV Data Reader for MT5

Fetches OHLCV (Open, High, Low, Close, Volume) data from MT5 terminal.
Thread-safe using connection locks.

NOTE: MT5 Python API's iCustom() does not work reliably, therefore this service
ONLY fetches raw OHLCV data using copy_rates_from_pos().

For indicators and technical analysis, use Part 20 (SQLite-Sync Script).

Reference: docs/flask-multi-mt5-implementation.md Section 4
"""

import logging
from typing import Any, Dict, List

import pandas as pd

from app.services.mt5_connection_pool import MT5Connection
from app.utils.constants import MT5_AVAILABLE, TIMEFRAME_MAP
from app.utils.symbol_resolver import get_symbol_resolver

# Try to import MetaTrader5
try:
    import MetaTrader5 as mt5
except ImportError:
    mt5 = None

logger = logging.getLogger(__name__)


def fetch_ohlcv_data(
    connection: MT5Connection,
    symbol: str,
    timeframe: str,
    bars: int = 1000
) -> Dict[str, Any]:
    """
    Fetch OHLCV data from MT5 terminal.

    NOTE: This function ONLY fetches raw OHLCV data. It does NOT fetch custom
    indicators because MT5 Python API's iCustom() is unreliable.

    Args:
        connection: MT5Connection instance
        symbol: Trading symbol (e.g., 'EURUSD')
        timeframe: Timeframe string (M5, M15, H1, H4, D1, etc.)
        bars: Number of bars to fetch (default: 1000)

    Returns:
        dict: OHLCV data package with metadata
        {
            'symbol': str,
            'timeframe': str,
            'bars': int,
            'ohlcv': [
                {
                    'time': int (unix timestamp),
                    'open': float,
                    'high': float,
                    'low': float,
                    'close': float,
                    'volume': int (tick_volume)
                },
                ...
            ],
            'metadata': {
                'timestamp': int (unix timestamp),
                'bars_requested': int,
                'bars_received': int
            }
        }

    Raises:
        ValueError: If timeframe is invalid
        Exception: If data retrieval fails
    """
    if not MT5_AVAILABLE or mt5 is None:
        raise Exception(
            "MetaTrader5 is not installed. "
            "This service requires Windows with MT5 installed."
        )

    # Validate timeframe
    if timeframe not in TIMEFRAME_MAP:
        valid_tfs = ', '.join(TIMEFRAME_MAP.keys())
        raise ValueError(
            f"Invalid timeframe: {timeframe}. Valid: {valid_tfs}"
        )

    mt5_timeframe = TIMEFRAME_MAP[timeframe]

    # Resolve symbol to broker-specific name (e.g., EURUSD -> EURUSD.i for Eightcap)
    resolver = get_symbol_resolver()
    resolved_symbol = resolver.resolve(symbol)

    if resolved_symbol != symbol:
        logger.info(f"Symbol '{symbol}' resolved to '{resolved_symbol}'")

    with connection.lock:  # Thread-safe access to MT5
        try:
            # Fetch OHLCV data using resolved symbol
            rates = mt5.copy_rates_from_pos(resolved_symbol, mt5_timeframe, 0, bars)

            if rates is None or len(rates) == 0:
                raise Exception(
                    f"Failed to fetch OHLCV data for {symbol} {timeframe}. "
                    f"Check that symbol exists in MT5 terminal."
                )

            # Convert to DataFrame for easier manipulation
            df = pd.DataFrame(rates)
            df['time'] = pd.to_datetime(df['time'], unit='s')

            # Convert to list of OHLCV dictionaries
            ohlcv_data = _convert_ohlcv_to_list(df)

            # Get metadata
            latest_timestamp = int(rates[-1]['time']) if len(rates) > 0 else 0

            return {
                'symbol': symbol,
                'timeframe': timeframe,
                'bars': len(ohlcv_data),
                'ohlcv': ohlcv_data,
                'metadata': {
                    'timestamp': latest_timestamp,
                    'bars_requested': bars,
                    'bars_received': len(ohlcv_data)
                }
            }

        except Exception as e:
            logger.error(f"Error fetching OHLCV data: {e}")
            raise


def _convert_ohlcv_to_list(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Convert DataFrame to list of OHLCV dictionaries.

    Args:
        df: DataFrame with OHLCV data

    Returns:
        List of OHLCV bar dictionaries
    """
    ohlcv_data = []
    for _, row in df.iterrows():
        ohlcv_data.append({
            'time': int(row['time'].timestamp()),
            'open': float(row['open']),
            'high': float(row['high']),
            'low': float(row['low']),
            'close': float(row['close']),
            'volume': int(row['tick_volume'])
        })
    return ohlcv_data


# Alias for backward compatibility
fetch_indicator_data = fetch_ohlcv_data
