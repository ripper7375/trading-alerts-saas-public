"""
Connection Pool Tests

Tests for MT5 connection pool functionality.
Can run without actual MT5 installation (mocked tests).

Reference: docs/flask-multi-mt5-implementation.md Section 7
"""

import json
import os
import sys
import tempfile
import unittest
from unittest.mock import MagicMock, patch

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestMT5ConnectionPool(unittest.TestCase):
    """Test cases for MT5ConnectionPool class."""

    def setUp(self):
        """Set up test fixtures."""
        # Create temporary config file
        self.config_data = {
            "terminals": [
                {
                    "id": "MT5_01",
                    "symbol": "XAUUSD",
                    "server": "TestServer",
                    "login": "12345",
                    "password": "testpass"
                },
                {
                    "id": "MT5_02",
                    "symbol": "EURUSD",
                    "server": "TestServer",
                    "login": "12346",
                    "password": "testpass"
                }
            ]
        }

        self.temp_config = tempfile.NamedTemporaryFile(
            mode='w',
            suffix='.json',
            delete=False
        )
        json.dump(self.config_data, self.temp_config)
        self.temp_config.close()

    def tearDown(self):
        """Clean up test fixtures."""
        os.unlink(self.temp_config.name)

    def test_pool_loads_config(self):
        """Test that connection pool loads configuration correctly."""
        from app.services.mt5_connection_pool import MT5ConnectionPool

        pool = MT5ConnectionPool(self.temp_config.name)

        self.assertEqual(len(pool.connections), 2)
        self.assertIn('MT5_01', pool.connections)
        self.assertIn('MT5_02', pool.connections)

    def test_symbol_to_connection_mapping(self):
        """Test symbol to connection mapping."""
        from app.services.mt5_connection_pool import MT5ConnectionPool

        pool = MT5ConnectionPool(self.temp_config.name)

        self.assertIn('XAUUSD', pool.symbol_to_connection)
        self.assertIn('EURUSD', pool.symbol_to_connection)

        xauusd_conn = pool.symbol_to_connection['XAUUSD']
        self.assertEqual(xauusd_conn.id, 'MT5_01')
        self.assertEqual(xauusd_conn.symbol, 'XAUUSD')

    def test_get_connection_by_symbol(self):
        """Test getting connection by symbol."""
        from app.services.mt5_connection_pool import MT5ConnectionPool

        pool = MT5ConnectionPool(self.temp_config.name)

        conn = pool.get_connection_by_symbol('XAUUSD')
        self.assertIsNotNone(conn)
        self.assertEqual(conn.symbol, 'XAUUSD')

        # Test non-existent symbol
        conn = pool.get_connection_by_symbol('INVALID')
        self.assertIsNone(conn)

    def test_get_connection_by_id(self):
        """Test getting connection by terminal ID."""
        from app.services.mt5_connection_pool import MT5ConnectionPool

        pool = MT5ConnectionPool(self.temp_config.name)

        conn = pool.get_connection_by_id('MT5_01')
        self.assertIsNotNone(conn)
        self.assertEqual(conn.id, 'MT5_01')

        # Test non-existent ID
        conn = pool.get_connection_by_id('MT5_99')
        self.assertIsNone(conn)

    def test_health_summary_all_disconnected(self):
        """Test health summary when all terminals are disconnected."""
        from app.services.mt5_connection_pool import MT5ConnectionPool

        pool = MT5ConnectionPool(self.temp_config.name)

        # All connections start disconnected
        health = pool.get_health_summary()

        self.assertEqual(health['status'], 'error')
        self.assertEqual(health['total_terminals'], 2)
        self.assertEqual(health['connected_terminals'], 0)
        self.assertIn('terminals', health)

    def test_connection_status(self):
        """Test individual connection status."""
        from app.services.mt5_connection_pool import MT5Connection

        config = {
            'id': 'MT5_TEST',
            'symbol': 'XAUUSD',
            'server': 'TestServer',
            'login': '12345',
            'password': 'testpass'
        }

        conn = MT5Connection(config)
        status = conn.get_status()

        self.assertIn('connected', status)
        self.assertIn('terminal_id', status)
        self.assertEqual(status['terminal_id'], 'MT5_TEST')
        self.assertFalse(status['connected'])

    def test_admin_status(self):
        """Test admin status includes additional metrics."""
        from app.services.mt5_connection_pool import MT5Connection

        config = {
            'id': 'MT5_TEST',
            'symbol': 'XAUUSD',
            'server': 'TestServer',
            'login': '12345',
            'password': 'testpass'
        }

        conn = MT5Connection(config)
        status = conn.get_admin_status()

        self.assertIn('reconnect_count', status)
        self.assertIn('symbol', status)
        self.assertEqual(status['reconnect_count'], 0)

    def test_env_var_resolution(self):
        """Test environment variable resolution in config."""
        from app.services.mt5_connection_pool import MT5Connection

        # Set test environment variable
        os.environ['TEST_MT5_LOGIN'] = '99999'

        config = {
            'id': 'MT5_TEST',
            'symbol': 'XAUUSD',
            'server': 'TestServer',
            'login': '${TEST_MT5_LOGIN}',
            'password': 'testpass'
        }

        conn = MT5Connection(config)
        self.assertEqual(conn.login, 99999)

        # Clean up
        del os.environ['TEST_MT5_LOGIN']

    def test_pool_stats(self):
        """Test aggregate statistics."""
        from app.services.mt5_connection_pool import MT5ConnectionPool

        pool = MT5ConnectionPool(self.temp_config.name)
        stats = pool.get_stats()

        self.assertIn('success', stats)
        self.assertIn('stats', stats)
        self.assertIn('terminals_by_status', stats['stats'])
        self.assertIn('most_problematic_terminals', stats['stats'])


class TestTierService(unittest.TestCase):
    """Test cases for tier validation service."""

    def test_validate_symbol_access_free(self):
        """Test FREE tier symbol access."""
        from app.services.tier_service import validate_symbol_access

        # FREE tier can access these symbols
        is_allowed, _ = validate_symbol_access('BTCUSD', 'FREE')
        self.assertTrue(is_allowed)
        is_allowed, _ = validate_symbol_access('EURUSD', 'FREE')
        self.assertTrue(is_allowed)
        is_allowed, _ = validate_symbol_access('USDJPY', 'FREE')
        self.assertTrue(is_allowed)
        is_allowed, _ = validate_symbol_access('US30', 'FREE')
        self.assertTrue(is_allowed)
        is_allowed, _ = validate_symbol_access('XAUUSD', 'FREE')
        self.assertTrue(is_allowed)

        # FREE tier cannot access PRO-only symbols
        is_allowed, _ = validate_symbol_access('AUDJPY', 'FREE')
        self.assertFalse(is_allowed)
        is_allowed, _ = validate_symbol_access('GBPUSD', 'FREE')
        self.assertFalse(is_allowed)

    def test_validate_symbol_access_pro(self):
        """Test PRO tier symbol access."""
        from app.services.tier_service import validate_symbol_access

        # PRO tier can access all symbols
        is_allowed, _ = validate_symbol_access('BTCUSD', 'PRO')
        self.assertTrue(is_allowed)
        is_allowed, _ = validate_symbol_access('AUDJPY', 'PRO')
        self.assertTrue(is_allowed)
        is_allowed, _ = validate_symbol_access('GBPUSD', 'PRO')
        self.assertTrue(is_allowed)
        is_allowed, _ = validate_symbol_access('XAUUSD', 'PRO')
        self.assertTrue(is_allowed)

    def test_validate_timeframe_access_free(self):
        """Test FREE tier timeframe access."""
        from app.services.tier_service import validate_timeframe_access

        # FREE tier can access these timeframes
        is_allowed, _ = validate_timeframe_access('H1', 'FREE')
        self.assertTrue(is_allowed)
        is_allowed, _ = validate_timeframe_access('H4', 'FREE')
        self.assertTrue(is_allowed)
        is_allowed, _ = validate_timeframe_access('D1', 'FREE')
        self.assertTrue(is_allowed)

        # FREE tier cannot access PRO-only timeframes
        is_allowed, _ = validate_timeframe_access('M5', 'FREE')
        self.assertFalse(is_allowed)
        is_allowed, _ = validate_timeframe_access('H12', 'FREE')
        self.assertFalse(is_allowed)

    def test_validate_timeframe_access_pro(self):
        """Test PRO tier timeframe access."""
        from app.services.tier_service import validate_timeframe_access

        # PRO tier can access all timeframes
        is_allowed, _ = validate_timeframe_access('M5', 'PRO')
        self.assertTrue(is_allowed)
        is_allowed, _ = validate_timeframe_access('H1', 'PRO')
        self.assertTrue(is_allowed)
        is_allowed, _ = validate_timeframe_access('H12', 'PRO')
        self.assertTrue(is_allowed)
        is_allowed, _ = validate_timeframe_access('D1', 'PRO')
        self.assertTrue(is_allowed)

    def test_validate_chart_access(self):
        """Test combined chart access validation."""
        from app.services.tier_service import validate_chart_access

        # FREE tier - valid combination
        allowed, error = validate_chart_access('XAUUSD', 'H1', 'FREE')
        self.assertTrue(allowed)
        self.assertIsNone(error)

        # FREE tier - invalid symbol
        allowed, error = validate_chart_access('GBPUSD', 'H1', 'FREE')
        self.assertFalse(allowed)
        self.assertIsNotNone(error)

        # FREE tier - invalid timeframe
        allowed, error = validate_chart_access('XAUUSD', 'M5', 'FREE')
        self.assertFalse(allowed)
        self.assertIsNotNone(error)

        # PRO tier - all valid
        allowed, error = validate_chart_access('GBPUSD', 'M5', 'PRO')
        self.assertTrue(allowed)


class TestHealthMonitor(unittest.TestCase):
    """Test cases for health monitor."""

    def test_monitor_creation(self):
        """Test health monitor can be created."""
        from app.services.health_monitor import HealthMonitor

        monitor = HealthMonitor(check_interval=10)
        self.assertEqual(monitor.check_interval, 10)
        self.assertFalse(monitor.running)

    def test_monitor_start_stop(self):
        """Test health monitor start and stop."""
        from app.services.health_monitor import (
            is_health_monitor_running,
            start_health_monitor,
            stop_health_monitor,
        )

        # Start monitor with short interval
        monitor = start_health_monitor(check_interval=1)
        self.assertTrue(is_health_monitor_running())

        # Stop monitor
        stop_health_monitor()
        self.assertFalse(is_health_monitor_running())


if __name__ == '__main__':
    print("=" * 60)
    print("MT5 Connection Pool Tests")
    print("=" * 60)
    unittest.main(verbosity=2)
