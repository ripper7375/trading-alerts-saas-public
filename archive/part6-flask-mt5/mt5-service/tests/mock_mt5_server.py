"""
Mock MT5 Server for Integration Testing

Simulates MT5 terminal connections and returns sample indicator data.
Supports various error scenarios for comprehensive testing.

Usage:
    # As a mock in tests
    from tests.mock_mt5_server import MockMT5, install_mock_mt5

    install_mock_mt5()  # Patches MetaTrader5 module

    # Or use MockMT5 directly
    mock = MockMT5()
    mock.initialize()
    mock.login(login=12345, password="test", server="TestServer")
    rates = mock.copy_rates_from_pos("XAUUSD", 16385, 0, 100)

Reference: MT5 Integration Tests for reliable MT5 connectivity
"""

import logging
import sys
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union
from unittest.mock import MagicMock, patch

import numpy as np

logger = logging.getLogger(__name__)


# =============================================================================
# MT5 CONSTANTS (mirrors MetaTrader5 module constants)
# =============================================================================

class MT5Constants:
    """MT5 timeframe and error constants."""
    # Timeframes
    TIMEFRAME_M5 = 5
    TIMEFRAME_M15 = 15
    TIMEFRAME_M30 = 30
    TIMEFRAME_H1 = 16385
    TIMEFRAME_H2 = 16386
    TIMEFRAME_H4 = 16388
    TIMEFRAME_H8 = 32769
    TIMEFRAME_H12 = 49153
    TIMEFRAME_D1 = 16408

    # Invalid handle for failed indicator loads
    INVALID_HANDLE = -1

    # Error codes
    RES_S_OK = 1
    RES_E_FAIL = -1
    RES_E_INVALID_PARAMS = -2
    RES_E_NO_MEMORY = -3
    RES_E_NOT_FOUND = -4
    RES_E_INVALID_VERSION = -5
    RES_E_AUTH_FAILED = -6
    RES_E_UNSUPPORTED = -7
    RES_E_AUTO_TRADING_DISABLED = -8
    RES_E_INTERNAL_FAIL = -10000

    # Copy ticks flags
    COPY_TICKS_ALL = 0
    COPY_TICKS_INFO = 1
    COPY_TICKS_TRADE = 2


# =============================================================================
# SAMPLE DATA GENERATORS
# =============================================================================

def generate_ohlc_data(
    symbol: str,
    timeframe: int,
    bars: int = 100,
    base_price: float = 2000.0,
    volatility: float = 0.002
) -> np.ndarray:
    """
    Generate realistic OHLC sample data.

    Args:
        symbol: Trading symbol (affects base price)
        timeframe: MT5 timeframe constant
        bars: Number of bars to generate
        base_price: Starting price level
        volatility: Price volatility factor

    Returns:
        Numpy structured array with OHLC data
    """
    # Set base price based on symbol
    symbol_base_prices = {
        'XAUUSD': 2000.0,
        'XAGUSD': 25.0,
        'EURUSD': 1.08,
        'GBPUSD': 1.26,
        'USDJPY': 150.0,
        'BTCUSD': 45000.0,
        'ETHUSD': 2500.0,
        'US30': 38000.0,
        'NDX100': 17500.0,
        'AUDUSD': 0.65,
        'NZDUSD': 0.60,
        'USDCAD': 1.35,
        'USDCHF': 0.88,
        'AUDJPY': 97.0,
        'GBPJPY': 189.0,
    }
    base_price = symbol_base_prices.get(symbol, base_price)

    # Calculate timeframe in seconds
    timeframe_seconds = {
        MT5Constants.TIMEFRAME_M5: 300,
        MT5Constants.TIMEFRAME_M15: 900,
        MT5Constants.TIMEFRAME_M30: 1800,
        MT5Constants.TIMEFRAME_H1: 3600,
        MT5Constants.TIMEFRAME_H2: 7200,
        MT5Constants.TIMEFRAME_H4: 14400,
        MT5Constants.TIMEFRAME_H8: 28800,
        MT5Constants.TIMEFRAME_H12: 43200,
        MT5Constants.TIMEFRAME_D1: 86400,
    }
    tf_seconds = timeframe_seconds.get(timeframe, 3600)

    # Generate timestamps (working backwards from now)
    end_time = int(datetime.utcnow().timestamp())
    end_time = end_time - (end_time % tf_seconds)  # Align to timeframe
    timestamps = [end_time - (i * tf_seconds) for i in range(bars - 1, -1, -1)]

    # Generate price data with random walk
    np.random.seed(42)  # Reproducible for testing
    returns = np.random.normal(0, volatility, bars)
    prices = base_price * np.cumprod(1 + returns)

    # Create OHLC from prices
    dtype = [
        ('time', 'i8'),
        ('open', 'f8'),
        ('high', 'f8'),
        ('low', 'f8'),
        ('close', 'f8'),
        ('tick_volume', 'i8'),
        ('spread', 'i4'),
        ('real_volume', 'i8')
    ]

    data = np.zeros(bars, dtype=dtype)

    for i in range(bars):
        close_price = prices[i]
        # Generate OHLC with realistic relationships
        range_pct = volatility * np.random.uniform(0.5, 1.5)
        high_price = close_price * (1 + range_pct)
        low_price = close_price * (1 - range_pct)
        open_price = np.random.uniform(low_price, high_price)

        data[i] = (
            timestamps[i],
            open_price,
            high_price,
            low_price,
            close_price,
            int(np.random.uniform(1000, 10000)),  # tick_volume
            int(np.random.uniform(1, 5)),  # spread
            int(np.random.uniform(100, 1000))  # real_volume
        )

    return data


def generate_indicator_buffer(
    bars: int,
    fill_ratio: float = 0.1,
    value_range: Tuple[float, float] = (1900.0, 2100.0),
    empty_value: float = 1.7976931348623157e+308
) -> np.ndarray:
    """
    Generate sample indicator buffer data.

    Args:
        bars: Number of data points
        fill_ratio: Ratio of non-empty values (0.0 to 1.0)
        value_range: Range of valid values
        empty_value: MT5 EMPTY_VALUE constant

    Returns:
        Numpy array with indicator values
    """
    buffer = np.full(bars, empty_value, dtype='f8')

    # Fill some values
    num_values = int(bars * fill_ratio)
    indices = np.random.choice(bars, num_values, replace=False)
    values = np.random.uniform(value_range[0], value_range[1], num_values)

    buffer[indices] = values
    return buffer


def generate_momentum_candle_buffers(
    bars: int
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Generate momentum candle color and zscore buffers.

    Returns:
        Tuple of (color_buffer, zscore_buffer)
    """
    empty_value = 1.7976931348623157e+308

    color_buffer = np.full(bars, empty_value, dtype='f8')
    zscore_buffer = np.full(bars, empty_value, dtype='f8')

    # Generate some momentum candles (type 0-5)
    # 0=UP_NORMAL, 1=UP_LARGE, 2=UP_EXTREME, 3=DOWN_NORMAL, 4=DOWN_LARGE, 5=DOWN_EXTREME
    num_candles = int(bars * 0.15)  # 15% have momentum signals
    indices = np.random.choice(bars, num_candles, replace=False)

    for idx in indices:
        candle_type = np.random.randint(0, 6)
        zscore = np.random.uniform(1.0, 4.0) if candle_type in [1, 2, 4, 5] else 0.5
        color_buffer[idx] = candle_type
        zscore_buffer[idx] = zscore

    return color_buffer, zscore_buffer


def generate_keltner_channel_buffers(
    bars: int,
    base_price: float = 2000.0
) -> Dict[str, np.ndarray]:
    """
    Generate 10-band Keltner channel buffers.

    Returns:
        Dict with band names as keys and buffers as values
    """
    bands = {}
    band_names = [
        'ultra_extreme_upper', 'extreme_upper', 'upper_most', 'upper',
        'upper_middle', 'lower_middle', 'lower', 'lower_most',
        'extreme_lower', 'ultra_extreme_lower'
    ]

    # Generate center line with slight trend
    np.random.seed(42)
    trend = np.linspace(0, 0.02, bars)
    center = base_price * (1 + trend + np.random.normal(0, 0.001, bars).cumsum())

    # ATR-based band widths
    atr = base_price * 0.005  # 0.5% ATR

    multipliers = {
        'ultra_extreme_upper': 4.0,
        'extreme_upper': 3.0,
        'upper_most': 2.5,
        'upper': 2.0,
        'upper_middle': 1.0,
        'lower_middle': -1.0,
        'lower': -2.0,
        'lower_most': -2.5,
        'extreme_lower': -3.0,
        'ultra_extreme_lower': -4.0,
    }

    for name in band_names:
        mult = multipliers[name]
        bands[name] = (center + mult * atr).astype('f8')

    return bands


def generate_moving_average_buffers(
    bars: int,
    base_price: float = 2000.0
) -> Dict[str, np.ndarray]:
    """
    Generate TEMA, HRMA, SMMA buffers.

    Returns:
        Dict with 'tema', 'hrma', 'smma' buffers
    """
    np.random.seed(42)

    # Generate base price series
    trend = np.linspace(0, 0.02, bars)
    noise = np.random.normal(0, 0.001, bars).cumsum()
    prices = base_price * (1 + trend + noise)

    # Different MA smoothing characteristics
    def ema(data: np.ndarray, period: int) -> np.ndarray:
        alpha = 2 / (period + 1)
        result = np.zeros_like(data)
        result[0] = data[0]
        for i in range(1, len(data)):
            result[i] = alpha * data[i] + (1 - alpha) * result[i - 1]
        return result

    # TEMA = 3*EMA1 - 3*EMA2 + EMA3
    ema1 = ema(prices, 20)
    ema2 = ema(ema1, 20)
    ema3 = ema(ema2, 20)
    tema = 3 * ema1 - 3 * ema2 + ema3

    # HRMA (Hull-like) - faster response
    hrma = ema(prices, 10)

    # SMMA (Smoothed) - slower response
    smma = ema(prices, 30)

    return {
        'tema': tema.astype('f8'),
        'hrma': hrma.astype('f8'),
        'smma': smma.astype('f8'),
    }


def generate_zigzag_buffers(
    bars: int,
    base_price: float = 2000.0
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Generate zigzag peak and bottom buffers.

    Returns:
        Tuple of (peaks_buffer, bottoms_buffer)
    """
    empty_value = 1.7976931348623157e+308

    peaks = np.full(bars, empty_value, dtype='f8')
    bottoms = np.full(bars, empty_value, dtype='f8')

    # Generate alternating peaks and bottoms
    num_pivots = int(bars * 0.05)  # 5% are pivot points
    pivot_indices = np.sort(np.random.choice(bars, num_pivots, replace=False))

    is_peak = True
    for idx in pivot_indices:
        if is_peak:
            peaks[idx] = base_price * np.random.uniform(1.01, 1.03)
        else:
            bottoms[idx] = base_price * np.random.uniform(0.97, 0.99)
        is_peak = not is_peak

    return peaks, bottoms


# =============================================================================
# MOCK MT5 CLASS
# =============================================================================

class MockMT5:
    """
    Mock MetaTrader5 module for testing without actual MT5 installation.

    Simulates:
    - Connection lifecycle (initialize, login, shutdown)
    - Account information
    - OHLC data retrieval
    - Indicator buffer reading
    - Error scenarios
    """

    def __init__(self):
        """Initialize mock MT5 state."""
        self._initialized = False
        self._logged_in = False
        self._login_info: Dict[str, Any] = {}
        self._last_error: Tuple[int, str] = (0, "")
        self._indicator_handles: Dict[str, int] = {}
        self._next_handle = 1

        # Error simulation flags
        self._fail_initialize = False
        self._fail_login = False
        self._fail_copy_rates = False
        self._fail_copy_buffer = False
        self._connection_lost = False

        # Expose constants
        self.TIMEFRAME_M5 = MT5Constants.TIMEFRAME_M5
        self.TIMEFRAME_M15 = MT5Constants.TIMEFRAME_M15
        self.TIMEFRAME_M30 = MT5Constants.TIMEFRAME_M30
        self.TIMEFRAME_H1 = MT5Constants.TIMEFRAME_H1
        self.TIMEFRAME_H2 = MT5Constants.TIMEFRAME_H2
        self.TIMEFRAME_H4 = MT5Constants.TIMEFRAME_H4
        self.TIMEFRAME_H8 = MT5Constants.TIMEFRAME_H8
        self.TIMEFRAME_H12 = MT5Constants.TIMEFRAME_H12
        self.TIMEFRAME_D1 = MT5Constants.TIMEFRAME_D1
        self.INVALID_HANDLE = MT5Constants.INVALID_HANDLE

    def reset(self) -> None:
        """Reset mock state for fresh test."""
        self._initialized = False
        self._logged_in = False
        self._login_info = {}
        self._last_error = (0, "")
        self._indicator_handles = {}
        self._next_handle = 1
        self._fail_initialize = False
        self._fail_login = False
        self._fail_copy_rates = False
        self._fail_copy_buffer = False
        self._connection_lost = False

    # -------------------------------------------------------------------------
    # Error simulation methods
    # -------------------------------------------------------------------------

    def set_fail_initialize(self, fail: bool = True) -> None:
        """Configure initialize() to fail."""
        self._fail_initialize = fail

    def set_fail_login(self, fail: bool = True) -> None:
        """Configure login() to fail."""
        self._fail_login = fail

    def set_fail_copy_rates(self, fail: bool = True) -> None:
        """Configure copy_rates_from_pos() to return None."""
        self._fail_copy_rates = fail

    def set_fail_copy_buffer(self, fail: bool = True) -> None:
        """Configure copy_buffer() to return None."""
        self._fail_copy_buffer = fail

    def set_connection_lost(self, lost: bool = True) -> None:
        """Simulate connection lost (account_info returns None)."""
        self._connection_lost = lost

    # -------------------------------------------------------------------------
    # Connection lifecycle
    # -------------------------------------------------------------------------

    def initialize(
        self,
        path: Optional[str] = None,
        login: Optional[int] = None,
        password: Optional[str] = None,
        server: Optional[str] = None,
        timeout: Optional[int] = None,
        portable: bool = False
    ) -> bool:
        """
        Initialize connection to MT5 terminal.

        Returns:
            True if successful, False otherwise
        """
        if self._fail_initialize:
            self._last_error = (
                MT5Constants.RES_E_FAIL,
                "Failed to initialize MT5 terminal"
            )
            return False

        self._initialized = True
        self._last_error = (0, "")
        logger.info("MockMT5: Initialized successfully")
        return True

    def login(
        self,
        login: int,
        password: str = "",
        server: str = "",
        timeout: int = 60000
    ) -> bool:
        """
        Login to MT5 trading account.

        Returns:
            True if successful, False otherwise
        """
        if not self._initialized:
            self._last_error = (
                MT5Constants.RES_E_FAIL,
                "MT5 not initialized"
            )
            return False

        if self._fail_login:
            self._last_error = (
                MT5Constants.RES_E_AUTH_FAILED,
                "Invalid login credentials"
            )
            return False

        self._logged_in = True
        self._login_info = {
            'login': login,
            'server': server,
        }
        self._last_error = (0, "")
        logger.info(f"MockMT5: Logged in as {login} on {server}")
        return True

    def shutdown(self) -> None:
        """Shutdown MT5 connection."""
        self._initialized = False
        self._logged_in = False
        self._login_info = {}
        self._indicator_handles = {}
        logger.info("MockMT5: Shutdown complete")

    def last_error(self) -> Tuple[int, str]:
        """Get last error code and description."""
        return self._last_error

    # -------------------------------------------------------------------------
    # Account information
    # -------------------------------------------------------------------------

    def account_info(self) -> Optional[MagicMock]:
        """
        Get account information.

        Returns:
            Account info object or None if not connected
        """
        if not self._initialized or not self._logged_in:
            return None

        if self._connection_lost:
            return None

        info = MagicMock()
        info.login = self._login_info.get('login', 12345)
        info.server = self._login_info.get('server', 'TestServer')
        info.balance = 10000.0
        info.equity = 10000.0
        info.margin = 0.0
        info.margin_free = 10000.0
        info.currency = "USD"
        info.leverage = 100
        return info

    def terminal_info(self) -> Optional[MagicMock]:
        """Get terminal information."""
        if not self._initialized:
            return None

        info = MagicMock()
        info.connected = self._logged_in and not self._connection_lost
        info.trade_allowed = True
        info.trade_expert = True
        info.dlls_allowed = True
        info.path = "C:\\Program Files\\MetaTrader 5"
        info.data_path = "C:\\Users\\Test\\AppData\\Roaming\\MetaTrader 5"
        return info

    # -------------------------------------------------------------------------
    # Market data
    # -------------------------------------------------------------------------

    def copy_rates_from_pos(
        self,
        symbol: str,
        timeframe: int,
        start_pos: int,
        count: int
    ) -> Optional[np.ndarray]:
        """
        Copy OHLC rates from position.

        Returns:
            Numpy structured array with OHLC data or None on failure
        """
        if not self._initialized or not self._logged_in:
            self._last_error = (MT5Constants.RES_E_FAIL, "Not connected")
            return None

        if self._fail_copy_rates:
            self._last_error = (MT5Constants.RES_E_FAIL, "Failed to copy rates")
            return None

        return generate_ohlc_data(symbol, timeframe, count)

    def copy_rates_from(
        self,
        symbol: str,
        timeframe: int,
        date_from: datetime,
        count: int
    ) -> Optional[np.ndarray]:
        """Copy OHLC rates from specific date."""
        return self.copy_rates_from_pos(symbol, timeframe, 0, count)

    def copy_rates_range(
        self,
        symbol: str,
        timeframe: int,
        date_from: datetime,
        date_to: datetime
    ) -> Optional[np.ndarray]:
        """Copy OHLC rates for date range."""
        # Estimate bar count
        tf_seconds = {
            MT5Constants.TIMEFRAME_M5: 300,
            MT5Constants.TIMEFRAME_H1: 3600,
            MT5Constants.TIMEFRAME_D1: 86400,
        }.get(timeframe, 3600)

        count = int((date_to - date_from).total_seconds() / tf_seconds)
        count = max(1, min(count, 1000))  # Limit

        return self.copy_rates_from_pos(symbol, timeframe, 0, count)

    # -------------------------------------------------------------------------
    # Indicator data
    # -------------------------------------------------------------------------

    def iCustom(
        self,
        symbol: str,
        timeframe: int,
        indicator_name: str,
        *params
    ) -> int:
        """
        Get handle for custom indicator.

        Returns:
            Indicator handle (positive int) or INVALID_HANDLE (-1)
        """
        if not self._initialized or not self._logged_in:
            return MT5Constants.INVALID_HANDLE

        # Check for known indicators
        known_indicators = [
            'Fractal Horizontal Line_V5',
            'Fractal Diagonal Line_V4',
            'Body Size Momentum Candle_V2',
            'Keltner Channel_ATF_10 Bands',
            'TEMA_HRMA_SMA-SMMA_Modified Buffers',
            'ZigZagColor & MarketStructure_JSON Export_V27_TXT Input',
        ]

        # Allow partial matching
        is_known = any(
            known in indicator_name or indicator_name in known
            for known in known_indicators
        )

        if not is_known:
            logger.warning(f"MockMT5: Unknown indicator '{indicator_name}'")
            # Still return handle but warn

        # Create unique handle for this indicator
        key = f"{symbol}_{timeframe}_{indicator_name}"
        if key not in self._indicator_handles:
            self._indicator_handles[key] = self._next_handle
            self._next_handle += 1

        return self._indicator_handles[key]

    def copy_buffer(
        self,
        indicator_handle: int,
        buffer_num: int,
        start_pos: int,
        count: int
    ) -> Optional[np.ndarray]:
        """
        Copy indicator buffer data.

        Returns:
            Numpy array with buffer data or None on failure
        """
        if not self._initialized or not self._logged_in:
            return None

        if self._fail_copy_buffer:
            return None

        if indicator_handle == MT5Constants.INVALID_HANDLE:
            return None

        # Find which indicator this handle belongs to
        indicator_key = None
        for key, handle in self._indicator_handles.items():
            if handle == indicator_handle:
                indicator_key = key
                break

        if indicator_key is None:
            return None

        # Generate appropriate buffer data based on indicator type
        base_price = 2000.0  # Default for XAUUSD

        if 'Fractal Horizontal Line' in indicator_key:
            # Buffers 0-1: fractals, 4-9: horizontal lines
            if buffer_num in [0, 1]:
                return generate_indicator_buffer(
                    count, fill_ratio=0.05, value_range=(1950, 2050)
                )
            elif buffer_num in [4, 5, 6, 7, 8, 9]:
                return generate_indicator_buffer(
                    count, fill_ratio=0.08, value_range=(1950, 2050)
                )
            return generate_indicator_buffer(count, fill_ratio=0)

        elif 'Fractal Diagonal Line' in indicator_key:
            # Buffers 0-5: diagonal lines
            if buffer_num in [0, 1, 2, 3, 4, 5]:
                return generate_indicator_buffer(
                    count, fill_ratio=0.1, value_range=(1950, 2050)
                )
            return generate_indicator_buffer(count, fill_ratio=0)

        elif 'Momentum Candle' in indicator_key:
            color_buf, zscore_buf = generate_momentum_candle_buffers(count)
            if buffer_num == 4:
                return color_buf
            elif buffer_num == 6:
                return zscore_buf
            return generate_indicator_buffer(count, fill_ratio=0)

        elif 'Keltner Channel' in indicator_key:
            bands = generate_keltner_channel_buffers(count, base_price)
            band_map = {
                0: 'ultra_extreme_upper',
                1: 'extreme_upper',
                2: 'upper_most',
                3: 'upper',
                4: 'upper_middle',
                5: 'lower_middle',
                6: 'lower',
                7: 'lower_most',
                8: 'extreme_lower',
                9: 'ultra_extreme_lower',
            }
            band_name = band_map.get(buffer_num)
            if band_name and band_name in bands:
                return bands[band_name]
            return generate_indicator_buffer(count, fill_ratio=0)

        elif 'TEMA_HRMA' in indicator_key:
            mas = generate_moving_average_buffers(count, base_price)
            ma_map = {1: 'smma', 2: 'hrma', 3: 'tema'}
            ma_name = ma_map.get(buffer_num)
            if ma_name and ma_name in mas:
                return mas[ma_name]
            return generate_indicator_buffer(count, fill_ratio=0)

        elif 'ZigZag' in indicator_key:
            peaks, bottoms = generate_zigzag_buffers(count, base_price)
            if buffer_num == 0:
                return peaks
            elif buffer_num == 1:
                return bottoms
            return generate_indicator_buffer(count, fill_ratio=0)

        # Default: return sparse buffer
        return generate_indicator_buffer(count, fill_ratio=0.1)

    # -------------------------------------------------------------------------
    # Symbol information
    # -------------------------------------------------------------------------

    def symbol_info(self, symbol: str) -> Optional[MagicMock]:
        """Get symbol information."""
        if not self._initialized:
            return None

        known_symbols = [
            'XAUUSD', 'XAGUSD', 'EURUSD', 'GBPUSD', 'USDJPY',
            'BTCUSD', 'ETHUSD', 'US30', 'NDX100', 'AUDUSD',
            'NZDUSD', 'USDCAD', 'USDCHF', 'AUDJPY', 'GBPJPY'
        ]

        if symbol not in known_symbols:
            return None

        info = MagicMock()
        info.name = symbol
        info.visible = True
        info.select = True
        info.bid = 2000.0
        info.ask = 2000.5
        info.spread = 5
        info.digits = 2 if 'JPY' not in symbol else 3
        info.point = 0.01 if 'JPY' not in symbol else 0.001
        info.trade_mode = 4  # SYMBOL_TRADE_MODE_FULL
        return info

    def symbol_select(self, symbol: str, enable: bool = True) -> bool:
        """Enable/disable symbol in Market Watch."""
        return True

    def symbols_get(self, group: str = "") -> Optional[tuple]:
        """Get all symbols."""
        symbols = [
            'XAUUSD', 'XAGUSD', 'EURUSD', 'GBPUSD', 'USDJPY',
            'BTCUSD', 'ETHUSD', 'US30', 'NDX100', 'AUDUSD',
            'NZDUSD', 'USDCAD', 'USDCHF', 'AUDJPY', 'GBPJPY'
        ]
        return tuple(MagicMock(name=s) for s in symbols)


# =============================================================================
# MOCK INSTALLATION HELPERS
# =============================================================================

_mock_mt5_instance: Optional[MockMT5] = None


def get_mock_mt5() -> MockMT5:
    """Get or create the global mock MT5 instance."""
    global _mock_mt5_instance
    if _mock_mt5_instance is None:
        _mock_mt5_instance = MockMT5()
    return _mock_mt5_instance


def reset_mock_mt5() -> None:
    """Reset the global mock MT5 instance."""
    global _mock_mt5_instance
    if _mock_mt5_instance is not None:
        _mock_mt5_instance.reset()


def install_mock_mt5() -> MockMT5:
    """
    Install MockMT5 as the MetaTrader5 module.

    This patches sys.modules so that `import MetaTrader5 as mt5`
    returns our mock.

    Returns:
        The installed MockMT5 instance
    """
    mock = get_mock_mt5()
    sys.modules['MetaTrader5'] = mock
    return mock


def uninstall_mock_mt5() -> None:
    """Remove MockMT5 from sys.modules."""
    if 'MetaTrader5' in sys.modules:
        if isinstance(sys.modules['MetaTrader5'], MockMT5):
            del sys.modules['MetaTrader5']


# =============================================================================
# PYTEST FIXTURES
# =============================================================================

def pytest_mock_mt5():
    """
    Pytest fixture for MockMT5.

    Usage in tests:
        def test_something(pytest_mock_mt5):
            mock = pytest_mock_mt5
            mock.initialize()
            mock.login(login=12345, password="test", server="Server")
            ...
    """
    mock = get_mock_mt5()
    mock.reset()
    install_mock_mt5()
    yield mock
    mock.reset()
    uninstall_mock_mt5()


# =============================================================================
# ERROR SCENARIO TESTS
# =============================================================================

class MockMT5ErrorScenarios:
    """
    Pre-configured error scenarios for testing.

    Usage:
        scenarios = MockMT5ErrorScenarios()
        mock = scenarios.connection_failure()
        assert mock.initialize() is False
    """

    def connection_failure(self) -> MockMT5:
        """Scenario: MT5 terminal fails to initialize."""
        mock = get_mock_mt5()
        mock.reset()
        mock.set_fail_initialize(True)
        return mock

    def auth_failure(self) -> MockMT5:
        """Scenario: Login authentication fails."""
        mock = get_mock_mt5()
        mock.reset()
        mock.set_fail_login(True)
        return mock

    def data_fetch_failure(self) -> MockMT5:
        """Scenario: OHLC data fetch fails."""
        mock = get_mock_mt5()
        mock.reset()
        mock.set_fail_copy_rates(True)
        return mock

    def indicator_failure(self) -> MockMT5:
        """Scenario: Indicator buffer fetch fails."""
        mock = get_mock_mt5()
        mock.reset()
        mock.set_fail_copy_buffer(True)
        return mock

    def connection_lost(self) -> MockMT5:
        """Scenario: Connection drops mid-session."""
        mock = get_mock_mt5()
        mock.reset()
        mock.initialize()
        mock.login(12345, "test", "Server")
        mock.set_connection_lost(True)
        return mock

    def healthy_connection(self) -> MockMT5:
        """Scenario: Normal healthy connection."""
        mock = get_mock_mt5()
        mock.reset()
        mock.initialize()
        mock.login(12345, "test", "TestServer")
        return mock


# =============================================================================
# STANDALONE TEST RUNNER
# =============================================================================

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)

    print("=" * 60)
    print("Mock MT5 Server - Integration Test")
    print("=" * 60)

    # Test basic connection
    print("\n1. Testing basic connection...")
    mock = MockMT5()
    assert mock.initialize() is True, "Initialize failed"
    assert mock.login(12345, "password", "TestServer") is True, "Login failed"
    info = mock.account_info()
    assert info is not None, "Account info failed"
    print(f"   Connected as: {info.login} on {info.server}")

    # Test OHLC data
    print("\n2. Testing OHLC data fetch...")
    rates = mock.copy_rates_from_pos("XAUUSD", MT5Constants.TIMEFRAME_H1, 0, 100)
    assert rates is not None, "Rates fetch failed"
    assert len(rates) == 100, f"Expected 100 bars, got {len(rates)}"
    print(f"   Fetched {len(rates)} bars")
    print(f"   Last bar: O={rates[-1]['open']:.2f} H={rates[-1]['high']:.2f} "
          f"L={rates[-1]['low']:.2f} C={rates[-1]['close']:.2f}")

    # Test indicator data
    print("\n3. Testing indicator data fetch...")
    handle = mock.iCustom("XAUUSD", MT5Constants.TIMEFRAME_H1,
                          "Fractal Horizontal Line_V5")
    assert handle != MT5Constants.INVALID_HANDLE, "Invalid handle"
    buffer = mock.copy_buffer(handle, 4, 0, 100)
    assert buffer is not None, "Buffer fetch failed"
    non_empty = sum(1 for v in buffer if v < 1e308)
    print(f"   Handle: {handle}, Buffer points: {non_empty}")

    # Test PRO indicators
    print("\n4. Testing PRO indicator data...")
    keltner_handle = mock.iCustom("XAUUSD", MT5Constants.TIMEFRAME_H1,
                                   "Keltner Channel_ATF_10 Bands")
    upper_band = mock.copy_buffer(keltner_handle, 0, 0, 100)
    assert upper_band is not None, "Keltner fetch failed"
    print(f"   Keltner upper band: first={upper_band[0]:.2f}, "
          f"last={upper_band[-1]:.2f}")

    # Test error scenarios
    print("\n5. Testing error scenarios...")
    scenarios = MockMT5ErrorScenarios()

    # Connection failure
    error_mock = scenarios.connection_failure()
    assert error_mock.initialize() is False, "Should fail initialize"
    print("   Connection failure: OK")

    # Auth failure
    error_mock = scenarios.auth_failure()
    error_mock.initialize()
    assert error_mock.login(12345, "wrong", "Server") is False, "Should fail login"
    print("   Auth failure: OK")

    # Connection lost
    error_mock = scenarios.connection_lost()
    assert error_mock.account_info() is None, "Should return None"
    print("   Connection lost: OK")

    print("\n" + "=" * 60)
    print("All tests passed!")
    print("=" * 60)
