"""
Indicator Data Reader

Fetches OHLC and indicator buffer data from MT5 terminal.
Thread-safe using connection locks.

Reference: docs/flask-multi-mt5-implementation.md Section 4
"""

import logging
import math
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

            # Get latest candle time for extending horizontal lines
            latest_time = int(rates[-1]['time']) if len(rates) > 0 else None

            # Calculate horizontal lines (support/resistance from fractals)
            horizontal_lines = _calculate_horizontal_lines(fractals, latest_time)

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


def _calculate_fractals(
    rates: Any,
    side_bars: int = 35
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Calculate fractal markers from OHLC data using MQL5 algorithm.

    MQL5 Fractal Detection Logic:
    - IsUpperFractal: center high > all left bars, center high >= all right bars
    - IsLowerFractal: center low < all left bars, center low <= all right bars

    Args:
        rates: OHLC rates from MT5 (numpy structured array)
        side_bars: Number of bars on each side to check (default 35, matching MT5)

    Returns:
        dict: Fractal markers with peaks and bottoms
    """
    min_bars = side_bars * 2 + 1
    if rates is None or len(rates) < min_bars:
        logger.warning(
            f"Not enough data to calculate fractals. "
            f"Need {min_bars}, got {len(rates) if rates is not None else 0}"
        )
        return _empty_fractals()

    try:
        peaks = []
        bottoms = []

        # Calculate fractals using MQL5-style algorithm
        for i in range(side_bars, len(rates) - side_bars):
            current = rates[i]
            time_val = int(current['time'])
            center_high = float(current['high'])
            center_low = float(current['low'])

            # Check for peak (upper fractal) - MQL5 style
            # Left side: center must be strictly greater
            # Right side: center must be greater or equal
            is_peak = True
            for j in range(1, side_bars + 1):
                if center_high <= float(rates[i - j]['high']):
                    is_peak = False
                    break
            if is_peak:
                for j in range(1, side_bars + 1):
                    if center_high < float(rates[i + j]['high']):
                        is_peak = False
                        break

            if is_peak:
                peaks.append({
                    'time': time_val,
                    'value': center_high,
                    'bar_index': i
                })

            # Check for bottom (lower fractal) - MQL5 style
            # Left side: center must be strictly less
            # Right side: center must be less or equal
            is_bottom = True
            for j in range(1, side_bars + 1):
                if center_low >= float(rates[i - j]['low']):
                    is_bottom = False
                    break
            if is_bottom:
                for j in range(1, side_bars + 1):
                    if center_low > float(rates[i + j]['low']):
                        is_bottom = False
                        break

            if is_bottom:
                bottoms.append({
                    'time': time_val,
                    'value': center_low,
                    'bar_index': i
                })

        logger.info(
            f"Calculated {len(peaks)} peaks and {len(bottoms)} bottoms "
            f"(side_bars={side_bars})"
        )

        return {
            'peaks': peaks,
            'bottoms': bottoms
        }

    except Exception as e:
        logger.error(f"Error calculating fractals: {e}")
        return _empty_fractals()


def _calculate_horizontal_lines(
    fractals: Dict[str, List[Dict[str, Any]]],
    latest_time: Optional[int] = None,
    tolerance_percent: float = 1.5,
    min_touches: int = 2
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Calculate horizontal support/resistance lines from fractal points.

    MQL5 Multi-Point Trendline Algorithm:
    - Finds price levels where multiple fractals cluster within tolerance
    - Scores lines by: touch count, proximity to current price, recency
    - Returns the top 3 resistance (peak) and 3 support (bottom) lines

    Args:
        fractals: Dictionary with 'peaks' and 'bottoms' lists
        latest_time: Optional timestamp for line end (current time)
        tolerance_percent: Price tolerance for clustering (default 1.5%)
        min_touches: Minimum fractals required to form a line (default 2)

    Returns:
        dict: Horizontal lines with peak_1/2/3 and bottom_1/2/3
    """
    try:
        peaks = fractals.get('peaks', [])
        bottoms = fractals.get('bottoms', [])

        # Determine the end time for horizontal lines
        all_times = [p['time'] for p in peaks] + [b['time'] for b in bottoms]
        if latest_time:
            end_time = latest_time
        elif all_times:
            end_time = max(all_times) + 3600
        else:
            end_time = int(pd.Timestamp.now().timestamp())

        result: Dict[str, List[Dict[str, Any]]] = {
            'peak_1': [],
            'peak_2': [],
            'peak_3': [],
            'bottom_1': [],
            'bottom_2': [],
            'bottom_3': [],
        }

        # Find multi-point horizontal lines for peaks (resistance)
        peak_lines = _find_horizontal_clusters(
            peaks, tolerance_percent, min_touches, end_time
        )
        for i, line in enumerate(peak_lines[:3]):
            result[f'peak_{i + 1}'] = line

        # Find multi-point horizontal lines for bottoms (support)
        bottom_lines = _find_horizontal_clusters(
            bottoms, tolerance_percent, min_touches, end_time
        )
        for i, line in enumerate(bottom_lines[:3]):
            result[f'bottom_{i + 1}'] = line

        line_count = sum(1 for v in result.values() if v)
        logger.info(f"Calculated {line_count} horizontal lines")

        return result

    except Exception as e:
        logger.error(f"Error calculating horizontal lines: {e}")
        return _empty_horizontal_lines()


def _find_horizontal_clusters(
    points: List[Dict[str, Any]],
    tolerance_percent: float,
    min_touches: int,
    end_time: int
) -> List[List[Dict[str, Any]]]:
    """
    Find horizontal price levels where multiple fractals cluster.

    MQL5 Algorithm:
    - For each fractal, check how many other fractals are within tolerance
    - Calculate cluster score based on touch count and recency
    - Return lines sorted by score

    Args:
        points: List of fractal points
        tolerance_percent: Price tolerance percentage
        min_touches: Minimum touches required
        end_time: End timestamp for the lines

    Returns:
        List of horizontal line point pairs, sorted by score
    """
    if len(points) < min_touches:
        return []

    clusters = []
    used_indices = set()

    # Sort by time (most recent first) for recency scoring
    sorted_points = sorted(points, key=lambda x: x['time'], reverse=True)

    for i, anchor in enumerate(sorted_points):
        if i in used_indices:
            continue

        anchor_price = anchor['value']
        tolerance = anchor_price * (tolerance_percent / 100.0)

        # Find all points within tolerance of this price level
        touches = [anchor]
        touch_indices = [i]

        for j, point in enumerate(sorted_points):
            if j == i or j in used_indices:
                continue
            if abs(point['value'] - anchor_price) <= tolerance:
                touches.append(point)
                touch_indices.append(j)

        if len(touches) >= min_touches:
            # Calculate average price level
            avg_price = sum(t['value'] for t in touches) / len(touches)
            # Find earliest touch time for line start
            start_time = min(t['time'] for t in touches)

            # Score: touch count * 25 + recency (inverse of age in hours)
            max_time = max(t['time'] for t in touches)
            age_hours = (end_time - max_time) / 3600.0 if end_time > max_time else 0
            recency_score = max(0, 100 - age_hours)
            score = len(touches) * 25 + recency_score

            clusters.append({
                'line': [
                    {'time': start_time, 'value': avg_price},
                    {'time': end_time, 'value': avg_price}
                ],
                'score': score,
                'touches': len(touches)
            })

            # Mark indices as used
            for idx in touch_indices:
                used_indices.add(idx)

    # Sort by score (highest first)
    clusters.sort(key=lambda x: x['score'], reverse=True)

    return [c['line'] for c in clusters]


def _calculate_diagonal_lines(
    fractals: Dict[str, List[Dict[str, Any]]],
    tolerance_percent: float = 1.5,
    min_angle: float = 0.5,
    max_angle: float = 60.0,
    min_touches: int = 2
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Calculate diagonal trend lines from fractal points using MQL5 algorithm.

    MQL5 Diagonal Line Rules:
    - Lines can touch both peaks and bottoms (mixed touches)
    - Ascending: positive slope (support line connecting lows)
    - Descending: negative slope (resistance line connecting highs)
    - Angle constraints: min 0.5°, max 60° (relaxed for visibility)
    - Scoring: touch count, slope, length, recency

    Args:
        fractals: Dictionary with 'peaks' and 'bottoms' lists
        tolerance_percent: Price tolerance for touch detection
        min_angle: Minimum line angle in degrees
        max_angle: Maximum line angle in degrees
        min_touches: Minimum fractals to form a valid line (2 matching MT5)

    Returns:
        dict: Diagonal lines with ascending_1/2/3 and descending_1/2/3
    """
    try:
        peaks = fractals.get('peaks', [])
        bottoms = fractals.get('bottoms', [])

        result: Dict[str, List[Dict[str, Any]]] = {
            'ascending_1': [],
            'ascending_2': [],
            'ascending_3': [],
            'descending_1': [],
            'descending_2': [],
            'descending_3': [],
        }

        # Combine all fractals with type indicator
        all_fractals = []
        for p in peaks:
            all_fractals.append({**p, 'is_peak': True})
        for b in bottoms:
            all_fractals.append({**b, 'is_peak': False})

        if len(all_fractals) < 2:
            return result

        # Sort by time
        all_fractals.sort(key=lambda x: x['time'])

        ascending_lines = []
        descending_lines = []

        # Find diagonal lines by testing pairs of fractals
        recent_fractals = all_fractals[-50:] if len(all_fractals) > 50 else all_fractals

        for i in range(len(recent_fractals) - 1):
            for j in range(i + 1, len(recent_fractals)):
                p1 = recent_fractals[i]
                p2 = recent_fractals[j]

                # Calculate line properties
                time_diff = p2['time'] - p1['time']
                if time_diff <= 0:
                    continue

                price_diff = p2['value'] - p1['value']
                slope = price_diff / time_diff

                # Calculate angle (normalized by price scale)
                avg_price = (p1['value'] + p2['value']) / 2
                normalized_slope = (price_diff / avg_price) / (time_diff / 3600)
                angle_rad = math.atan(normalized_slope * 10)
                angle_deg = abs(math.degrees(angle_rad))

                # Check angle constraints
                if angle_deg < min_angle or angle_deg > max_angle:
                    continue

                # Count touches along this line
                y_intercept = p1['value'] - slope * p1['time']
                touches = []
                peak_touches = 0
                bottom_touches = 0

                for k, frac in enumerate(recent_fractals):
                    expected_price = slope * frac['time'] + y_intercept
                    tolerance = frac['value'] * (tolerance_percent / 100.0)

                    if abs(frac['value'] - expected_price) <= tolerance:
                        touches.append(k)
                        if frac['is_peak']:
                            peak_touches += 1
                        else:
                            bottom_touches += 1

                # Require minimum touches
                if len(touches) < min_touches:
                    continue

                # Calculate score
                touch_score = len(touches) * 25
                length_bars = (p2['time'] - p1['time']) / 3600
                length_score = min(length_bars, 100) * 0.1
                recency_score = 50 if j >= len(recent_fractals) - 5 else 0
                total_score = touch_score + length_score + recency_score

                line_data = {
                    'line': [
                        {'time': p1['time'], 'value': p1['value']},
                        {'time': p2['time'], 'value': p2['value']}
                    ],
                    'score': total_score,
                    'touches': len(touches),
                    'angle': angle_deg,
                    'slope': slope
                }

                if price_diff > 0:
                    ascending_lines.append(line_data)
                else:
                    descending_lines.append(line_data)

        # Sort by score and take top 3
        ascending_lines.sort(key=lambda x: x['score'], reverse=True)
        descending_lines.sort(key=lambda x: x['score'], reverse=True)

        for i, line in enumerate(ascending_lines[:3]):
            result[f'ascending_{i + 1}'] = line['line']

        for i, line in enumerate(descending_lines[:3]):
            result[f'descending_{i + 1}'] = line['line']

        line_count = sum(1 for v in result.values() if v)
        logger.info(f"Calculated {line_count} diagonal trend lines")

        return result

    except Exception as e:
        logger.error(f"Error calculating diagonal lines: {e}")
        return _empty_diagonal_lines()


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
