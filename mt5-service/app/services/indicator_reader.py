"""
Indicator Data Reader

Fetches OHLC and indicator buffer data from MT5 terminal.
Thread-safe using connection locks.

Reference: docs/flask-multi-mt5-implementation.md Section 4
"""

import logging
from typing import Any, Dict, List, Optional

import pandas as pd

from app.services.mt5_connection_pool import MT5Connection
from app.utils.constants import MT5_AVAILABLE, TIMEFRAME_MAP

# Try to import MetaTrader5
try:
    import MetaTrader5 as mt5
except ImportError:
    mt5 = None

logger = logging.getLogger(__name__)

# MT5's EMPTY_VALUE constant
EMPTY_VALUE = 1.7976931348623157e+308


def fetch_indicator_data(
    connection: MT5Connection,
    symbol: str,
    timeframe: str,
    bars: int = 1000
) -> Dict[str, Any]:
    """
    Fetch indicator data from MT5 terminal.

    Args:
        connection: MT5Connection instance
        symbol: Trading symbol
        timeframe: Timeframe string (M5, M15, etc.)
        bars: Number of bars to fetch

    Returns:
        dict: Complete indicator data package with OHLC, horizontal, diagonal, fractals

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

    with connection.lock:  # Thread-safe access to MT5
        try:
            # Fetch OHLC data
            rates = mt5.copy_rates_from_pos(symbol, mt5_timeframe, 0, bars)

            if rates is None or len(rates) == 0:
                raise Exception(
                    f"Failed to fetch OHLC data for {symbol} {timeframe}"
                )

            # Convert to DataFrame
            df = pd.DataFrame(rates)
            df['time'] = pd.to_datetime(df['time'], unit='s')

            # Convert to list of OHLC bars
            ohlc_data = _convert_ohlc_to_list(df)

            # Fetch indicator data (horizontal lines)
            horizontal_lines = _fetch_horizontal_lines(
                symbol, mt5_timeframe, bars
            )

            # Fetch indicator data (diagonal lines)
            diagonal_lines = _fetch_diagonal_lines(symbol, mt5_timeframe, bars)

            # Fetch fractals
            fractals = _fetch_fractals(symbol, mt5_timeframe, bars)

            return {
                'ohlc': ohlc_data,
                'horizontal': horizontal_lines,
                'diagonal': diagonal_lines,
                'fractals': fractals
            }

        except Exception as e:
            logger.error(f"Error fetching indicator data: {e}")
            raise


def _convert_ohlc_to_list(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Convert DataFrame to list of OHLC dictionaries.

    Args:
        df: DataFrame with OHLC data

    Returns:
        List of OHLC bar dictionaries
    """
    ohlc_data = []
    for _, row in df.iterrows():
        ohlc_data.append({
            'time': int(row['time'].timestamp()),
            'open': float(row['open']),
            'high': float(row['high']),
            'low': float(row['low']),
            'close': float(row['close']),
            'volume': int(row['tick_volume'])
        })
    return ohlc_data


def _fetch_horizontal_lines(
    symbol: str,
    timeframe: int,
    bars: int
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Fetch horizontal fractal lines from indicator buffers.

    Reads from Fractal Horizontal Line_V5.mq5 indicator:
    - Buffer 4: peak_1
    - Buffer 5: peak_2
    - Buffer 6: peak_3
    - Buffer 7: bottom_1
    - Buffer 8: bottom_2
    - Buffer 9: bottom_3

    Args:
        symbol: Trading symbol
        timeframe: MT5 timeframe constant
        bars: Number of bars

    Returns:
        dict: Horizontal lines data
    """
    if not MT5_AVAILABLE or mt5 is None:
        return _empty_horizontal_lines()

    try:
        # Get indicator handle
        handle = mt5.iCustom(symbol, timeframe, "Fractal Horizontal Line_V5")

        if handle == mt5.INVALID_HANDLE:
            logger.warning(
                "Failed to get indicator handle for Fractal Horizontal Line_V5. "
                "Is the indicator attached to the chart in MT5?"
            )
            return _empty_horizontal_lines()

        # Fetch buffers 4-9 (horizontal lines)
        peak_1 = mt5.copy_buffer(handle, 4, 0, bars)
        peak_2 = mt5.copy_buffer(handle, 5, 0, bars)
        peak_3 = mt5.copy_buffer(handle, 6, 0, bars)
        bottom_1 = mt5.copy_buffer(handle, 7, 0, bars)
        bottom_2 = mt5.copy_buffer(handle, 8, 0, bars)
        bottom_3 = mt5.copy_buffer(handle, 9, 0, bars)

        return {
            'peak_1': _buffer_to_line_points(peak_1),
            'peak_2': _buffer_to_line_points(peak_2),
            'peak_3': _buffer_to_line_points(peak_3),
            'bottom_1': _buffer_to_line_points(bottom_1),
            'bottom_2': _buffer_to_line_points(bottom_2),
            'bottom_3': _buffer_to_line_points(bottom_3),
        }

    except Exception as e:
        logger.error(f"Error fetching horizontal lines: {e}")
        return _empty_horizontal_lines()


def _fetch_diagonal_lines(
    symbol: str,
    timeframe: int,
    bars: int
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Fetch diagonal fractal lines from indicator buffers.

    Reads from Fractal Diagonal Line_V4.mq5 indicator:
    - Buffer 0: ascending_1
    - Buffer 1: ascending_2
    - Buffer 2: ascending_3
    - Buffer 3: descending_1
    - Buffer 4: descending_2
    - Buffer 5: descending_3

    Args:
        symbol: Trading symbol
        timeframe: MT5 timeframe constant
        bars: Number of bars

    Returns:
        dict: Diagonal lines data
    """
    if not MT5_AVAILABLE or mt5 is None:
        return _empty_diagonal_lines()

    try:
        # Get indicator handle
        handle = mt5.iCustom(symbol, timeframe, "Fractal Diagonal Line_V4")

        if handle == mt5.INVALID_HANDLE:
            logger.warning(
                "Failed to get indicator handle for Fractal Diagonal Line_V4. "
                "Is the indicator attached to the chart in MT5?"
            )
            return _empty_diagonal_lines()

        # Fetch buffers 0-5 (diagonal lines)
        ascending_1 = mt5.copy_buffer(handle, 0, 0, bars)
        ascending_2 = mt5.copy_buffer(handle, 1, 0, bars)
        ascending_3 = mt5.copy_buffer(handle, 2, 0, bars)
        descending_1 = mt5.copy_buffer(handle, 3, 0, bars)
        descending_2 = mt5.copy_buffer(handle, 4, 0, bars)
        descending_3 = mt5.copy_buffer(handle, 5, 0, bars)

        return {
            'ascending_1': _buffer_to_line_points(ascending_1),
            'ascending_2': _buffer_to_line_points(ascending_2),
            'ascending_3': _buffer_to_line_points(ascending_3),
            'descending_1': _buffer_to_line_points(descending_1),
            'descending_2': _buffer_to_line_points(descending_2),
            'descending_3': _buffer_to_line_points(descending_3),
        }

    except Exception as e:
        logger.error(f"Error fetching diagonal lines: {e}")
        return _empty_diagonal_lines()


def _fetch_fractals(
    symbol: str,
    timeframe: int,
    bars: int
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Fetch fractal markers from indicator buffers.

    Reads from Fractal Horizontal Line_V5.mq5 indicator:
    - Buffer 0: peaks (upper fractals)
    - Buffer 1: bottoms (lower fractals)

    Args:
        symbol: Trading symbol
        timeframe: MT5 timeframe constant
        bars: Number of bars

    Returns:
        dict: Fractal markers
    """
    if not MT5_AVAILABLE or mt5 is None:
        return _empty_fractals()

    try:
        # Get indicator handle
        handle = mt5.iCustom(symbol, timeframe, "Fractal Horizontal Line_V5")

        if handle == mt5.INVALID_HANDLE:
            return _empty_fractals()

        # Fetch buffers 0-1 (fractals)
        peaks_buffer = mt5.copy_buffer(handle, 0, 0, bars)
        bottoms_buffer = mt5.copy_buffer(handle, 1, 0, bars)

        # Get rates to get timestamps
        rates = mt5.copy_rates_from_pos(symbol, timeframe, 0, bars)

        peaks = _buffer_to_fractal_points(peaks_buffer, rates)
        bottoms = _buffer_to_fractal_points(bottoms_buffer, rates)

        return {
            'peaks': peaks,
            'bottoms': bottoms
        }

    except Exception as e:
        logger.error(f"Error fetching fractals: {e}")
        return _empty_fractals()


def _buffer_to_line_points(
    buffer: Optional[Any]
) -> List[Dict[str, Any]]:
    """
    Convert indicator buffer to line points (filter EMPTY_VALUE).

    Args:
        buffer: MT5 indicator buffer (numpy array or None)

    Returns:
        List of line point dictionaries with index and value
    """
    if buffer is None:
        return []

    points = []
    for i, value in enumerate(buffer):
        if value != EMPTY_VALUE and value != 0 and value > 0:
            points.append({
                'index': i,
                'value': float(value)
            })

    return points


def _buffer_to_fractal_points(
    buffer: Optional[Any],
    rates: Optional[Any]
) -> List[Dict[str, Any]]:
    """
    Convert fractal buffer to fractal points with timestamps.

    Args:
        buffer: MT5 indicator buffer
        rates: MT5 rates array with timestamps

    Returns:
        List of fractal point dictionaries with time and price
    """
    if buffer is None or rates is None:
        return []

    points = []
    for i, value in enumerate(buffer):
        if value != EMPTY_VALUE and value != 0 and value > 0:
            if i < len(rates):
                points.append({
                    'time': int(rates[i]['time']),
                    'price': float(value)
                })

    return points


def _empty_horizontal_lines() -> Dict[str, List]:
    """Return empty horizontal lines structure."""
    return {
        'peak_1': [],
        'peak_2': [],
        'peak_3': [],
        'bottom_1': [],
        'bottom_2': [],
        'bottom_3': []
    }


def _empty_diagonal_lines() -> Dict[str, List]:
    """Return empty diagonal lines structure."""
    return {
        'ascending_1': [],
        'ascending_2': [],
        'ascending_3': [],
        'descending_1': [],
        'descending_2': [],
        'descending_3': []
    }


def _empty_fractals() -> Dict[str, List]:
    """Return empty fractals structure."""
    return {
        'peaks': [],
        'bottoms': []
    }
