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
from app.utils.constants import (
    MT5_AVAILABLE,
    TIMEFRAME_MAP,
    INDICATOR_MQL5_NAMES,
    INDICATOR_BUFFER_MAP,
)

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

            # Calculate fractals from OHLC data
            fractals = _calculate_fractals(rates)

            # Calculate horizontal lines (support/resistance from fractals)
            horizontal_lines = _calculate_horizontal_lines(fractals)

            # Calculate diagonal lines (trend lines from fractals)
            diagonal_lines = _calculate_diagonal_lines(fractals)

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


def _calculate_fractals(rates: Any) -> Dict[str, List[Dict[str, Any]]]:
    """
    Calculate fractal markers from OHLC data.

    A fractal is identified when:
    - Peak (Up fractal): High is higher than 2 bars on each side
    - Bottom (Down fractal): Low is lower than 2 bars on each side

    Args:
        rates: OHLC rates from MT5 (numpy structured array)

    Returns:
        dict: Fractal markers with peaks and bottoms
    """
    if rates is None or len(rates) < 5:
        logger.warning("Not enough data to calculate fractals")
        return _empty_fractals()

    try:
        peaks = []
        bottoms = []

        # Calculate fractals (need 2 bars on each side)
        for i in range(2, len(rates) - 2):
            current = rates[i]
            time_val = int(current['time'])

            # Check for peak (up fractal)
            is_peak = (
                current['high'] > rates[i - 2]['high'] and
                current['high'] > rates[i - 1]['high'] and
                current['high'] > rates[i + 1]['high'] and
                current['high'] > rates[i + 2]['high']
            )

            if is_peak:
                peaks.append({
                    'time': time_val,
                    'value': float(current['high'])
                })

            # Check for bottom (down fractal)
            is_bottom = (
                current['low'] < rates[i - 2]['low'] and
                current['low'] < rates[i - 1]['low'] and
                current['low'] < rates[i + 1]['low'] and
                current['low'] < rates[i + 2]['low']
            )

            if is_bottom:
                bottoms.append({
                    'time': time_val,
                    'value': float(current['low'])
                })

        logger.info(f"Calculated {len(peaks)} peaks and {len(bottoms)} bottoms")

        return {
            'peaks': peaks,
            'bottoms': bottoms
        }

    except Exception as e:
        logger.error(f"Error calculating fractals: {e}")
        return _empty_fractals()


def _calculate_horizontal_lines(
    fractals: Dict[str, List[Dict[str, Any]]]
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Calculate horizontal support/resistance lines from fractal points.

    Takes the most recent fractal peaks (resistance) and bottoms (support)
    and creates horizontal price levels.

    Args:
        fractals: Dictionary with 'peaks' and 'bottoms' lists

    Returns:
        dict: Horizontal lines with peak_1/2/3 and bottom_1/2/3
    """
    try:
        peaks = fractals.get('peaks', [])
        bottoms = fractals.get('bottoms', [])

        # Get the last 3 peaks (most recent first) for resistance levels
        recent_peaks = sorted(peaks, key=lambda x: x['time'], reverse=True)[:3]
        # Get the last 3 bottoms (most recent first) for support levels
        recent_bottoms = sorted(
            bottoms, key=lambda x: x['time'], reverse=True
        )[:3]

        result = {
            'peak_1': [],
            'peak_2': [],
            'peak_3': [],
            'bottom_1': [],
            'bottom_2': [],
            'bottom_3': [],
        }

        # Create horizontal lines from peaks (resistance)
        for i, peak in enumerate(recent_peaks):
            key = f'peak_{i + 1}'
            if key in result:
                result[key] = [{
                    'time': peak['time'],
                    'value': peak['value']
                }]

        # Create horizontal lines from bottoms (support)
        for i, bottom in enumerate(recent_bottoms):
            key = f'bottom_{i + 1}'
            if key in result:
                result[key] = [{
                    'time': bottom['time'],
                    'value': bottom['value']
                }]

        line_count = sum(1 for v in result.values() if v)
        logger.info(f"Calculated {line_count} horizontal lines")

        return result

    except Exception as e:
        logger.error(f"Error calculating horizontal lines: {e}")
        return _empty_horizontal_lines()


def _calculate_diagonal_lines(
    fractals: Dict[str, List[Dict[str, Any]]]
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Calculate diagonal trend lines from fractal points.

    - Ascending lines: Connect consecutive higher bottoms (uptrend)
    - Descending lines: Connect consecutive lower peaks (downtrend)

    Args:
        fractals: Dictionary with 'peaks' and 'bottoms' lists

    Returns:
        dict: Diagonal lines with ascending_1/2/3 and descending_1/2/3
    """
    try:
        peaks = fractals.get('peaks', [])
        bottoms = fractals.get('bottoms', [])

        result = {
            'ascending_1': [],
            'ascending_2': [],
            'ascending_3': [],
            'descending_1': [],
            'descending_2': [],
            'descending_3': [],
        }

        # Find ascending trend lines (connecting higher bottoms)
        if len(bottoms) >= 2:
            sorted_bottoms = sorted(bottoms, key=lambda x: x['time'])
            ascending_lines = _find_trend_lines(sorted_bottoms, ascending=True)
            for i, line in enumerate(ascending_lines[:3]):
                result[f'ascending_{i + 1}'] = line

        # Find descending trend lines (connecting lower peaks)
        if len(peaks) >= 2:
            sorted_peaks = sorted(peaks, key=lambda x: x['time'])
            descending_lines = _find_trend_lines(sorted_peaks, ascending=False)
            for i, line in enumerate(descending_lines[:3]):
                result[f'descending_{i + 1}'] = line

        line_count = sum(1 for v in result.values() if v)
        logger.info(f"Calculated {line_count} diagonal trend lines")

        return result

    except Exception as e:
        logger.error(f"Error calculating diagonal lines: {e}")
        return _empty_diagonal_lines()


def _find_trend_lines(
    points: List[Dict[str, Any]],
    ascending: bool = True
) -> List[List[Dict[str, Any]]]:
    """
    Find trend lines by connecting fractal points.

    Args:
        points: List of fractal points sorted by time
        ascending: True for uptrend (higher lows), False for downtrend

    Returns:
        List of trend lines, each containing start and end points
    """
    if len(points) < 2:
        return []

    trend_lines = []

    # Use recent points to find valid trend lines
    recent_points = points[-20:] if len(points) > 20 else points

    for i in range(len(recent_points) - 1):
        for j in range(i + 1, min(i + 5, len(recent_points))):
            p1 = recent_points[i]
            p2 = recent_points[j]

            # Check if this forms a valid trend
            if ascending:
                # For uptrend, second point should be higher
                if p2['value'] > p1['value']:
                    trend_lines.append([
                        {'time': p1['time'], 'value': p1['value']},
                        {'time': p2['time'], 'value': p2['value']}
                    ])
            else:
                # For downtrend, second point should be lower
                if p2['value'] < p1['value']:
                    trend_lines.append([
                        {'time': p1['time'], 'value': p1['value']},
                        {'time': p2['time'], 'value': p2['value']}
                    ])

    # Sort by recency (most recent first) and return top lines
    trend_lines.sort(key=lambda x: x[1]['time'], reverse=True)

    return trend_lines[:3]


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


# ============================================================================
# PRO-ONLY INDICATOR FETCH FUNCTIONS
# ============================================================================

def fetch_pro_indicators(
    connection: MT5Connection,
    symbol: str,
    timeframe: str,
    bars: int = 1000
) -> Dict[str, Any]:
    """
    Fetch all PRO-only indicator data from MT5 terminal.

    Args:
        connection: MT5Connection instance
        symbol: Trading symbol
        timeframe: Timeframe string (M5, M15, etc.)
        bars: Number of bars to fetch

    Returns:
        dict: PRO indicator data package
    """
    if not MT5_AVAILABLE or mt5 is None:
        return _empty_pro_indicators()

    if timeframe not in TIMEFRAME_MAP:
        return _empty_pro_indicators()

    mt5_timeframe = TIMEFRAME_MAP[timeframe]

    with connection.lock:
        try:
            # Fetch each PRO indicator
            momentum_candles = _fetch_momentum_candles(
                symbol, mt5_timeframe, bars
            )
            keltner_channels = _fetch_keltner_channels(
                symbol, mt5_timeframe, bars
            )
            moving_averages = _fetch_moving_averages(
                symbol, mt5_timeframe, bars
            )
            zigzag_data = _fetch_zigzag(symbol, mt5_timeframe, bars)

            return {
                'momentum_candles': momentum_candles,
                'keltner_channels': keltner_channels,
                'tema': moving_averages.get('tema', []),
                'hrma': moving_averages.get('hrma', []),
                'smma': moving_averages.get('smma', []),
                'zigzag': zigzag_data,
            }

        except Exception as e:
            logger.error(f"Error fetching PRO indicators: {e}")
            return _empty_pro_indicators()


def _fetch_momentum_candles(
    symbol: str,
    timeframe: int,
    bars: int
) -> List[Dict[str, Any]]:
    """
    Fetch Momentum Candles data from Body Size Momentum Candle_V2.mq5.

    Buffer 4: ColorBuffer (candle type 0-5)
        0 = UP_NORMAL, 1 = UP_LARGE, 2 = UP_EXTREME
        3 = DOWN_NORMAL, 4 = DOWN_LARGE, 5 = DOWN_EXTREME
    Buffer 6: ZScoreBuffer (z-score values)

    Args:
        symbol: Trading symbol
        timeframe: MT5 timeframe constant
        bars: Number of bars

    Returns:
        List of momentum candle data points
    """
    if not MT5_AVAILABLE or mt5 is None:
        return []

    try:
        indicator_name = INDICATOR_MQL5_NAMES['momentum_candles']
        handle = mt5.iCustom(symbol, timeframe, indicator_name)

        if handle == mt5.INVALID_HANDLE:
            logger.warning(
                f"Failed to get handle for {indicator_name}. "
                "Is the indicator attached to the chart in MT5?"
            )
            return []

        # Fetch color and zscore buffers
        buffer_map = INDICATOR_BUFFER_MAP['momentum_candles']
        color_buffer = mt5.copy_buffer(handle, buffer_map['color'], 0, bars)
        zscore_buffer = mt5.copy_buffer(handle, buffer_map['zscore'], 0, bars)

        if color_buffer is None or zscore_buffer is None:
            return []

        # Convert to list of candle data (only significant candles, type > 0)
        candles = []
        for i in range(len(color_buffer)):
            candle_type = int(color_buffer[i]) if color_buffer[i] != EMPTY_VALUE else -1
            zscore = float(zscore_buffer[i]) if zscore_buffer[i] != EMPTY_VALUE else 0

            # Only include candles that are Large or Extreme (type 1,2,4,5)
            # Normal candles (type 0,3) are skipped to reduce payload
            if candle_type in [1, 2, 4, 5]:
                candles.append({
                    'index': i,
                    'type': candle_type,
                    'zscore': round(zscore, 4)
                })

        return candles

    except Exception as e:
        logger.error(f"Error fetching momentum candles: {e}")
        return []


def _fetch_keltner_channels(
    symbol: str,
    timeframe: int,
    bars: int
) -> Dict[str, List[Optional[float]]]:
    """
    Fetch Keltner Channels from Keltner Channel_ATF_10 Bands.mq5.

    10 bands (Buffers 0-9):
        0: ultra_extreme_upper, 1: extreme_upper, 2: upper_most, 3: upper,
        4: upper_middle, 5: lower_middle, 6: lower, 7: lower_most,
        8: extreme_lower, 9: ultra_extreme_lower

    Args:
        symbol: Trading symbol
        timeframe: MT5 timeframe constant
        bars: Number of bars

    Returns:
        Dict with 10 band arrays
    """
    if not MT5_AVAILABLE or mt5 is None:
        return _empty_keltner_channels()

    try:
        indicator_name = INDICATOR_MQL5_NAMES['keltner_channels']
        handle = mt5.iCustom(symbol, timeframe, indicator_name)

        if handle == mt5.INVALID_HANDLE:
            logger.warning(
                f"Failed to get handle for {indicator_name}. "
                "Is the indicator attached to the chart in MT5?"
            )
            return _empty_keltner_channels()

        buffer_map = INDICATOR_BUFFER_MAP['keltner_channels']
        result = {}

        for band_name, buffer_idx in buffer_map.items():
            buffer = mt5.copy_buffer(handle, buffer_idx, 0, bars)
            result[band_name] = _buffer_to_value_array(buffer)

        return result

    except Exception as e:
        logger.error(f"Error fetching Keltner channels: {e}")
        return _empty_keltner_channels()


def _fetch_moving_averages(
    symbol: str,
    timeframe: int,
    bars: int
) -> Dict[str, List[Optional[float]]]:
    """
    Fetch TEMA, HRMA, SMMA from TEMA_HRMA_SMA-SMMA_Modified Buffers.mq5.

    Buffer 1: SMMA (Smoothed Moving Average)
    Buffer 2: HRMA (Hull-like Responsive Moving Average)
    Buffer 3: TEMA (Triple Exponential Moving Average)

    Args:
        symbol: Trading symbol
        timeframe: MT5 timeframe constant
        bars: Number of bars

    Returns:
        Dict with tema, hrma, smma arrays
    """
    if not MT5_AVAILABLE or mt5 is None:
        return {'tema': [], 'hrma': [], 'smma': []}

    try:
        indicator_name = INDICATOR_MQL5_NAMES['moving_averages']
        handle = mt5.iCustom(symbol, timeframe, indicator_name)

        if handle == mt5.INVALID_HANDLE:
            logger.warning(
                f"Failed to get handle for {indicator_name}. "
                "Is the indicator attached to the chart in MT5?"
            )
            return {'tema': [], 'hrma': [], 'smma': []}

        buffer_map = INDICATOR_BUFFER_MAP['moving_averages']

        smma_buffer = mt5.copy_buffer(handle, buffer_map['smma'], 0, bars)
        hrma_buffer = mt5.copy_buffer(handle, buffer_map['hrma'], 0, bars)
        tema_buffer = mt5.copy_buffer(handle, buffer_map['tema'], 0, bars)

        return {
            'smma': _buffer_to_value_array(smma_buffer),
            'hrma': _buffer_to_value_array(hrma_buffer),
            'tema': _buffer_to_value_array(tema_buffer),
        }

    except Exception as e:
        logger.error(f"Error fetching moving averages: {e}")
        return {'tema': [], 'hrma': [], 'smma': []}


def _fetch_zigzag(
    symbol: str,
    timeframe: int,
    bars: int
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Fetch ZigZag data from ZigZagColor & MarketStructure indicator.

    Buffer 0: ZigzagPeakBuffer (peak prices)
    Buffer 1: ZigzagBottomBuffer (bottom prices)

    Args:
        symbol: Trading symbol
        timeframe: MT5 timeframe constant
        bars: Number of bars

    Returns:
        Dict with peaks and bottoms arrays
    """
    if not MT5_AVAILABLE or mt5 is None:
        return {'peaks': [], 'bottoms': []}

    try:
        indicator_name = INDICATOR_MQL5_NAMES['zigzag']
        handle = mt5.iCustom(symbol, timeframe, indicator_name)

        if handle == mt5.INVALID_HANDLE:
            logger.warning(
                f"Failed to get handle for {indicator_name}. "
                "Is the indicator attached to the chart in MT5?"
            )
            return {'peaks': [], 'bottoms': []}

        buffer_map = INDICATOR_BUFFER_MAP['zigzag']

        peaks_buffer = mt5.copy_buffer(handle, buffer_map['peaks'], 0, bars)
        bottoms_buffer = mt5.copy_buffer(handle, buffer_map['bottoms'], 0, bars)

        # Get rates for timestamps
        rates = mt5.copy_rates_from_pos(symbol, timeframe, 0, bars)

        peaks = _buffer_to_zigzag_points(peaks_buffer, rates)
        bottoms = _buffer_to_zigzag_points(bottoms_buffer, rates)

        return {
            'peaks': peaks,
            'bottoms': bottoms
        }

    except Exception as e:
        logger.error(f"Error fetching zigzag: {e}")
        return {'peaks': [], 'bottoms': []}


def _buffer_to_value_array(
    buffer: Optional[Any]
) -> List[Optional[float]]:
    """
    Convert indicator buffer to array of values (None for EMPTY_VALUE).

    Args:
        buffer: MT5 indicator buffer (numpy array or None)

    Returns:
        List of float values or None for empty positions
    """
    if buffer is None:
        return []

    result = []
    for value in buffer:
        if value != EMPTY_VALUE and value != 0:
            result.append(round(float(value), 5))
        else:
            result.append(None)

    return result


def _buffer_to_zigzag_points(
    buffer: Optional[Any],
    rates: Optional[Any]
) -> List[Dict[str, Any]]:
    """
    Convert zigzag buffer to list of point dictionaries.

    Args:
        buffer: MT5 indicator buffer
        rates: MT5 rates array with timestamps

    Returns:
        List of zigzag point dictionaries
    """
    if buffer is None or rates is None:
        return []

    points = []
    for i, value in enumerate(buffer):
        if value != EMPTY_VALUE and value != 0 and value > 0:
            if i < len(rates):
                points.append({
                    'index': i,
                    'price': round(float(value), 5),
                    'time': int(rates[i]['time'])
                })

    return points


def _empty_pro_indicators() -> Dict[str, Any]:
    """Return empty PRO indicators structure."""
    return {
        'momentum_candles': [],
        'keltner_channels': _empty_keltner_channels(),
        'tema': [],
        'hrma': [],
        'smma': [],
        'zigzag': {'peaks': [], 'bottoms': []},
    }


def _empty_keltner_channels() -> Dict[str, List]:
    """Return empty Keltner channels structure."""
    return {
        'ultra_extreme_upper': [],
        'extreme_upper': [],
        'upper_most': [],
        'upper': [],
        'upper_middle': [],
        'lower_middle': [],
        'lower': [],
        'lower_most': [],
        'extreme_lower': [],
        'ultra_extreme_lower': [],
    }
