"""
MT5 Integration Tests

Tests MT5 connectivity, indicator data fetching, and error handling
using the MockMT5 server for reliable, reproducible tests.

Reference: MT5 Integration Tests for reliable MT5 connectivity
"""

import os
import sys
import json
import tempfile
import pytest
import numpy as np
from unittest.mock import patch, MagicMock
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tests.mock_mt5_server import (
    MockMT5,
    MockMT5ErrorScenarios,
    MT5Constants,
    get_mock_mt5,
    reset_mock_mt5,
    install_mock_mt5,
    uninstall_mock_mt5,
    generate_ohlc_data,
    generate_indicator_buffer,
)


# =============================================================================
# FIXTURES
# =============================================================================

@pytest.fixture
def mock_mt5():
    """Provide a fresh MockMT5 instance for each test."""
    mock = get_mock_mt5()
    mock.reset()
    yield mock
    mock.reset()


@pytest.fixture
def connected_mock_mt5():
    """Provide an initialized and logged-in MockMT5."""
    mock = get_mock_mt5()
    mock.reset()
    mock.initialize()
    mock.login(login=12345, password="testpass", server="TestServer")
    yield mock
    mock.reset()


@pytest.fixture
def error_scenarios():
    """Provide pre-configured error scenarios."""
    return MockMT5ErrorScenarios()


@pytest.fixture
def temp_config_file():
    """Create a temporary MT5 terminals config file."""
    config = {
        "terminals": [
            {
                "id": "MT5_TEST_01",
                "symbol": "XAUUSD",
                "server": "TestServer",
                "login": "12345",
                "password": "testpass"
            },
            {
                "id": "MT5_TEST_02",
                "symbol": "EURUSD",
                "server": "TestServer",
                "login": "12346",
                "password": "testpass"
            }
        ]
    }

    with tempfile.NamedTemporaryFile(
        mode='w', suffix='.json', delete=False
    ) as f:
        json.dump(config, f)
        config_path = f.name

    yield config_path
    os.unlink(config_path)


# =============================================================================
# CONNECTION TESTS
# =============================================================================

class TestMT5Connection:
    """Test MT5 connection lifecycle."""

    def test_initialize_success(self, mock_mt5):
        """Test successful MT5 initialization."""
        result = mock_mt5.initialize()
        assert result is True
        assert mock_mt5._initialized is True

    def test_initialize_failure(self, error_scenarios):
        """Test MT5 initialization failure."""
        mock = error_scenarios.connection_failure()
        result = mock.initialize()
        assert result is False
        error_code, error_msg = mock.last_error()
        assert error_code != 0
        assert "Failed to initialize" in error_msg

    def test_login_success(self, mock_mt5):
        """Test successful login."""
        mock_mt5.initialize()
        result = mock_mt5.login(
            login=12345,
            password="testpass",
            server="TestServer"
        )
        assert result is True
        assert mock_mt5._logged_in is True

    def test_login_without_initialize(self, mock_mt5):
        """Test login fails without initialization."""
        result = mock_mt5.login(12345, "pass", "Server")
        assert result is False
        error_code, _ = mock_mt5.last_error()
        assert error_code != 0

    def test_login_failure(self, error_scenarios):
        """Test login authentication failure."""
        mock = error_scenarios.auth_failure()
        mock.initialize()
        result = mock.login(12345, "wrongpass", "Server")
        assert result is False
        error_code, error_msg = mock.last_error()
        assert "Invalid login" in error_msg or error_code != 0

    def test_shutdown(self, connected_mock_mt5):
        """Test graceful shutdown."""
        assert connected_mock_mt5._initialized is True
        assert connected_mock_mt5._logged_in is True

        connected_mock_mt5.shutdown()

        assert connected_mock_mt5._initialized is False
        assert connected_mock_mt5._logged_in is False

    def test_account_info_when_connected(self, connected_mock_mt5):
        """Test account info retrieval when connected."""
        info = connected_mock_mt5.account_info()
        assert info is not None
        assert info.login == 12345
        assert info.server == "TestServer"
        assert info.balance > 0

    def test_account_info_when_disconnected(self, mock_mt5):
        """Test account info returns None when not connected."""
        info = mock_mt5.account_info()
        assert info is None

    def test_connection_lost_scenario(self, error_scenarios):
        """Test connection lost mid-session."""
        mock = error_scenarios.connection_lost()
        # Was connected, but now lost
        info = mock.account_info()
        assert info is None


# =============================================================================
# OHLC DATA TESTS
# =============================================================================

class TestOHLCData:
    """Test OHLC data retrieval."""

    def test_copy_rates_success(self, connected_mock_mt5):
        """Test successful OHLC data fetch."""
        rates = connected_mock_mt5.copy_rates_from_pos(
            "XAUUSD",
            MT5Constants.TIMEFRAME_H1,
            0,
            100
        )

        assert rates is not None
        assert len(rates) == 100
        assert 'time' in rates.dtype.names
        assert 'open' in rates.dtype.names
        assert 'high' in rates.dtype.names
        assert 'low' in rates.dtype.names
        assert 'close' in rates.dtype.names

    def test_copy_rates_different_symbols(self, connected_mock_mt5):
        """Test OHLC data for different symbols."""
        symbols = ['XAUUSD', 'EURUSD', 'BTCUSD', 'US30']

        for symbol in symbols:
            rates = connected_mock_mt5.copy_rates_from_pos(
                symbol, MT5Constants.TIMEFRAME_H1, 0, 50
            )
            assert rates is not None, f"Failed for {symbol}"
            assert len(rates) == 50

    def test_copy_rates_different_timeframes(self, connected_mock_mt5):
        """Test OHLC data for different timeframes."""
        timeframes = [
            MT5Constants.TIMEFRAME_M5,
            MT5Constants.TIMEFRAME_M15,
            MT5Constants.TIMEFRAME_H1,
            MT5Constants.TIMEFRAME_H4,
            MT5Constants.TIMEFRAME_D1,
        ]

        for tf in timeframes:
            rates = connected_mock_mt5.copy_rates_from_pos(
                "XAUUSD", tf, 0, 50
            )
            assert rates is not None, f"Failed for timeframe {tf}"

    def test_copy_rates_when_disconnected(self, mock_mt5):
        """Test OHLC fetch fails when not connected."""
        rates = mock_mt5.copy_rates_from_pos(
            "XAUUSD", MT5Constants.TIMEFRAME_H1, 0, 100
        )
        assert rates is None

    def test_copy_rates_failure(self, error_scenarios):
        """Test OHLC fetch failure scenario."""
        mock = error_scenarios.data_fetch_failure()
        mock.initialize()
        mock.login(12345, "pass", "Server")

        rates = mock.copy_rates_from_pos(
            "XAUUSD", MT5Constants.TIMEFRAME_H1, 0, 100
        )
        assert rates is None

    def test_ohlc_data_structure(self, connected_mock_mt5):
        """Test OHLC data has correct structure."""
        rates = connected_mock_mt5.copy_rates_from_pos(
            "XAUUSD", MT5Constants.TIMEFRAME_H1, 0, 10
        )

        for bar in rates:
            # High should be >= Open, Close
            assert bar['high'] >= bar['open']
            assert bar['high'] >= bar['close']
            # Low should be <= Open, Close
            assert bar['low'] <= bar['open']
            assert bar['low'] <= bar['close']
            # Timestamps should be positive
            assert bar['time'] > 0
            # Volume should be positive
            assert bar['tick_volume'] > 0

    def test_ohlc_timestamps_are_sequential(self, connected_mock_mt5):
        """Test OHLC bars have sequential timestamps."""
        rates = connected_mock_mt5.copy_rates_from_pos(
            "XAUUSD", MT5Constants.TIMEFRAME_H1, 0, 100
        )

        for i in range(1, len(rates)):
            assert rates[i]['time'] > rates[i-1]['time'], \
                f"Bar {i} timestamp not sequential"


# =============================================================================
# INDICATOR BUFFER TESTS
# =============================================================================

class TestIndicatorBuffers:
    """Test indicator buffer retrieval."""

    def test_icustom_returns_valid_handle(self, connected_mock_mt5):
        """Test iCustom returns valid handle."""
        handle = connected_mock_mt5.iCustom(
            "XAUUSD",
            MT5Constants.TIMEFRAME_H1,
            "Fractal Horizontal Line_V5"
        )

        assert handle != MT5Constants.INVALID_HANDLE
        assert handle > 0

    def test_icustom_different_indicators(self, connected_mock_mt5):
        """Test iCustom with different indicators."""
        indicators = [
            "Fractal Horizontal Line_V5",
            "Fractal Diagonal Line_V4",
            "Body Size Momentum Candle_V2",
            "Keltner Channel_ATF_10 Bands",
            "TEMA_HRMA_SMA-SMMA_Modified Buffers",
            "ZigZagColor & MarketStructure_JSON Export_V27_TXT Input",
        ]

        handles = set()
        for indicator in indicators:
            handle = connected_mock_mt5.iCustom(
                "XAUUSD", MT5Constants.TIMEFRAME_H1, indicator
            )
            assert handle != MT5Constants.INVALID_HANDLE
            handles.add(handle)

        # Each indicator should have unique handle
        assert len(handles) == len(indicators)

    def test_copy_buffer_success(self, connected_mock_mt5):
        """Test successful buffer copy."""
        handle = connected_mock_mt5.iCustom(
            "XAUUSD",
            MT5Constants.TIMEFRAME_H1,
            "Fractal Horizontal Line_V5"
        )

        buffer = connected_mock_mt5.copy_buffer(handle, 4, 0, 100)

        assert buffer is not None
        assert len(buffer) == 100
        assert buffer.dtype == np.float64

    def test_copy_buffer_invalid_handle(self, connected_mock_mt5):
        """Test copy_buffer with invalid handle."""
        buffer = connected_mock_mt5.copy_buffer(
            MT5Constants.INVALID_HANDLE, 0, 0, 100
        )
        assert buffer is None

    def test_copy_buffer_failure(self, error_scenarios):
        """Test buffer copy failure scenario."""
        mock = error_scenarios.indicator_failure()
        mock.initialize()
        mock.login(12345, "pass", "Server")

        handle = mock.iCustom("XAUUSD", MT5Constants.TIMEFRAME_H1, "Test")
        buffer = mock.copy_buffer(handle, 0, 0, 100)
        assert buffer is None

    def test_horizontal_line_buffers(self, connected_mock_mt5):
        """Test Fractal Horizontal Line buffers."""
        handle = connected_mock_mt5.iCustom(
            "XAUUSD",
            MT5Constants.TIMEFRAME_H1,
            "Fractal Horizontal Line_V5"
        )

        # Buffers 4-9 are horizontal line levels
        for buf_num in [4, 5, 6, 7, 8, 9]:
            buffer = connected_mock_mt5.copy_buffer(handle, buf_num, 0, 100)
            assert buffer is not None, f"Buffer {buf_num} failed"

    def test_diagonal_line_buffers(self, connected_mock_mt5):
        """Test Fractal Diagonal Line buffers."""
        handle = connected_mock_mt5.iCustom(
            "XAUUSD",
            MT5Constants.TIMEFRAME_H1,
            "Fractal Diagonal Line_V4"
        )

        # Buffers 0-5 are diagonal lines
        for buf_num in [0, 1, 2, 3, 4, 5]:
            buffer = connected_mock_mt5.copy_buffer(handle, buf_num, 0, 100)
            assert buffer is not None, f"Buffer {buf_num} failed"

    def test_momentum_candle_buffers(self, connected_mock_mt5):
        """Test Momentum Candle indicator buffers."""
        handle = connected_mock_mt5.iCustom(
            "XAUUSD",
            MT5Constants.TIMEFRAME_H1,
            "Body Size Momentum Candle_V2"
        )

        # Buffer 4: color (candle type)
        color_buf = connected_mock_mt5.copy_buffer(handle, 4, 0, 100)
        assert color_buf is not None

        # Buffer 6: zscore
        zscore_buf = connected_mock_mt5.copy_buffer(handle, 6, 0, 100)
        assert zscore_buf is not None

    def test_keltner_channel_buffers(self, connected_mock_mt5):
        """Test Keltner Channel 10-band buffers."""
        handle = connected_mock_mt5.iCustom(
            "XAUUSD",
            MT5Constants.TIMEFRAME_H1,
            "Keltner Channel_ATF_10 Bands"
        )

        # All 10 bands (buffers 0-9)
        for buf_num in range(10):
            buffer = connected_mock_mt5.copy_buffer(handle, buf_num, 0, 100)
            assert buffer is not None, f"Keltner buffer {buf_num} failed"
            # Keltner bands should have values (not all empty)
            non_empty = sum(1 for v in buffer if v < 1e308)
            assert non_empty > 0, f"Keltner buffer {buf_num} is empty"

    def test_moving_average_buffers(self, connected_mock_mt5):
        """Test TEMA/HRMA/SMMA buffers."""
        handle = connected_mock_mt5.iCustom(
            "XAUUSD",
            MT5Constants.TIMEFRAME_H1,
            "TEMA_HRMA_SMA-SMMA_Modified Buffers"
        )

        # Buffer 1: SMMA, 2: HRMA, 3: TEMA
        for buf_num in [1, 2, 3]:
            buffer = connected_mock_mt5.copy_buffer(handle, buf_num, 0, 100)
            assert buffer is not None, f"MA buffer {buf_num} failed"

    def test_zigzag_buffers(self, connected_mock_mt5):
        """Test ZigZag indicator buffers."""
        handle = connected_mock_mt5.iCustom(
            "XAUUSD",
            MT5Constants.TIMEFRAME_H1,
            "ZigZagColor & MarketStructure_JSON Export_V27_TXT Input"
        )

        # Buffer 0: peaks, 1: bottoms
        peaks = connected_mock_mt5.copy_buffer(handle, 0, 0, 100)
        bottoms = connected_mock_mt5.copy_buffer(handle, 1, 0, 100)

        assert peaks is not None
        assert bottoms is not None


# =============================================================================
# ERROR SCENARIO TESTS
# =============================================================================

class TestErrorScenarios:
    """Test various error scenarios."""

    def test_connection_failure_recovery(self, error_scenarios):
        """Test recovery from connection failure."""
        mock = error_scenarios.connection_failure()

        # First attempt fails
        assert mock.initialize() is False

        # Reset and retry succeeds
        mock.set_fail_initialize(False)
        assert mock.initialize() is True

    def test_auth_failure_recovery(self, error_scenarios):
        """Test recovery from auth failure."""
        mock = error_scenarios.auth_failure()
        mock.initialize()

        # First login fails
        assert mock.login(12345, "wrong", "Server") is False

        # Retry with correct creds succeeds
        mock.set_fail_login(False)
        assert mock.login(12345, "correct", "Server") is True

    def test_reconnect_after_connection_lost(self, error_scenarios):
        """Test reconnection after connection lost."""
        mock = error_scenarios.connection_lost()

        # Connection is lost
        assert mock.account_info() is None

        # Shutdown and reconnect
        mock.shutdown()
        mock.set_connection_lost(False)
        mock.initialize()
        mock.login(12345, "pass", "Server")

        # Now connected again
        assert mock.account_info() is not None

    def test_data_fetch_retry(self, connected_mock_mt5):
        """Test data fetch with retry after failure."""
        # First fetch succeeds
        rates = connected_mock_mt5.copy_rates_from_pos(
            "XAUUSD", MT5Constants.TIMEFRAME_H1, 0, 50
        )
        assert rates is not None

        # Set failure
        connected_mock_mt5.set_fail_copy_rates(True)
        rates = connected_mock_mt5.copy_rates_from_pos(
            "XAUUSD", MT5Constants.TIMEFRAME_H1, 0, 50
        )
        assert rates is None

        # Clear failure, retry succeeds
        connected_mock_mt5.set_fail_copy_rates(False)
        rates = connected_mock_mt5.copy_rates_from_pos(
            "XAUUSD", MT5Constants.TIMEFRAME_H1, 0, 50
        )
        assert rates is not None

    def test_multiple_error_types(self, mock_mt5):
        """Test handling multiple sequential error types."""
        # Start with initialize failure
        mock_mt5.set_fail_initialize(True)
        assert mock_mt5.initialize() is False

        # Fix and continue
        mock_mt5.set_fail_initialize(False)
        assert mock_mt5.initialize() is True

        # Login failure
        mock_mt5.set_fail_login(True)
        assert mock_mt5.login(12345, "pass", "Server") is False

        # Fix login
        mock_mt5.set_fail_login(False)
        assert mock_mt5.login(12345, "pass", "Server") is True

        # Data fetch works
        rates = mock_mt5.copy_rates_from_pos(
            "XAUUSD", MT5Constants.TIMEFRAME_H1, 0, 10
        )
        assert rates is not None


# =============================================================================
# INTEGRATION WITH CONNECTION POOL TESTS
# =============================================================================

class TestConnectionPoolIntegration:
    """Test MockMT5 integration with connection pool."""

    def test_pool_with_mock_mt5(self, temp_config_file):
        """Test connection pool uses mock MT5."""
        # Install mock
        mock = install_mock_mt5()

        try:
            # Skip if Flask not installed (CI environment)
            try:
                from app.services.mt5_connection_pool import MT5ConnectionPool
            except ImportError as e:
                pytest.skip(f"Flask/app dependencies not installed: {e}")

            pool = MT5ConnectionPool(temp_config_file)

            assert len(pool.connections) == 2
            assert 'XAUUSD' in pool.symbol_to_connection
            assert 'EURUSD' in pool.symbol_to_connection

        finally:
            uninstall_mock_mt5()

    def test_pool_connection_status(self, temp_config_file):
        """Test pool health with mock MT5."""
        mock = install_mock_mt5()

        try:
            # Skip if Flask not installed (CI environment)
            try:
                from app.services.mt5_connection_pool import MT5ConnectionPool
            except ImportError as e:
                pytest.skip(f"Flask/app dependencies not installed: {e}")

            pool = MT5ConnectionPool(temp_config_file)

            # Without connecting, all should be disconnected
            health = pool.get_health_summary()
            assert health['status'] in ('error', 'degraded')
            assert health['connected_terminals'] == 0

        finally:
            uninstall_mock_mt5()


# =============================================================================
# DATA GENERATOR TESTS
# =============================================================================

class TestDataGenerators:
    """Test sample data generators."""

    def test_ohlc_generator_default(self):
        """Test OHLC data generation with defaults."""
        data = generate_ohlc_data("XAUUSD", MT5Constants.TIMEFRAME_H1, 100)

        assert len(data) == 100
        assert data.dtype.names == (
            'time', 'open', 'high', 'low', 'close',
            'tick_volume', 'spread', 'real_volume'
        )

    def test_ohlc_generator_symbol_prices(self):
        """Test OHLC generates appropriate prices for symbols."""
        # Gold should be around 2000
        gold = generate_ohlc_data("XAUUSD", MT5Constants.TIMEFRAME_H1, 10)
        assert 1500 < gold[-1]['close'] < 2500

        # EURUSD should be around 1.0
        eurusd = generate_ohlc_data("EURUSD", MT5Constants.TIMEFRAME_H1, 10)
        assert 0.5 < eurusd[-1]['close'] < 1.5

        # Bitcoin should be much higher
        btc = generate_ohlc_data("BTCUSD", MT5Constants.TIMEFRAME_H1, 10)
        assert btc[-1]['close'] > 10000

    def test_indicator_buffer_generator(self):
        """Test indicator buffer generation."""
        buffer = generate_indicator_buffer(
            bars=100,
            fill_ratio=0.1,
            value_range=(1900, 2100)
        )

        assert len(buffer) == 100

        # Count non-empty values
        empty_value = 1.7976931348623157e+308
        non_empty = sum(1 for v in buffer if v != empty_value)

        # Should be approximately 10% filled
        assert 5 <= non_empty <= 15

    def test_indicator_buffer_empty(self):
        """Test indicator buffer with no fill."""
        buffer = generate_indicator_buffer(
            bars=100,
            fill_ratio=0
        )

        empty_value = 1.7976931348623157e+308
        assert all(v == empty_value for v in buffer)


# =============================================================================
# SYMBOL AND TERMINAL INFO TESTS
# =============================================================================

class TestSymbolInfo:
    """Test symbol information retrieval."""

    def test_symbol_info_known_symbol(self, connected_mock_mt5):
        """Test symbol info for known symbols."""
        info = connected_mock_mt5.symbol_info("XAUUSD")
        assert info is not None
        assert info.name == "XAUUSD"
        assert info.bid > 0
        assert info.ask > 0

    def test_symbol_info_unknown_symbol(self, connected_mock_mt5):
        """Test symbol info returns None for unknown symbols."""
        info = connected_mock_mt5.symbol_info("INVALID_SYMBOL")
        assert info is None

    def test_terminal_info(self, connected_mock_mt5):
        """Test terminal info retrieval."""
        info = connected_mock_mt5.terminal_info()
        assert info is not None
        assert info.connected is True

    def test_terminal_info_disconnected(self, mock_mt5):
        """Test terminal info when not initialized."""
        info = mock_mt5.terminal_info()
        assert info is None


# =============================================================================
# RUN TESTS
# =============================================================================

if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
