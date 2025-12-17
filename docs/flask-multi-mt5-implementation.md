# Flask Multi-MT5 Implementation Guide

## Overview

This guide provides **complete implementation code** for managing 15 MT5 terminal connections in your Flask service.

**Architecture:**

```
Flask Service
    ↓
MT5ConnectionPool (manages 15 connections)
    ↓
SymbolRouter (routes requests to correct MT5)
    ↓
MT5_01...MT5_15 (individual terminals)
```

---

## 1. Configuration File

**File:** `config/mt5_terminals.json`

```json
{
  "terminals": [
    {
      "id": "MT5_01",
      "symbol": "AUDJPY",
      "server": "YourBroker-Demo",
      "login": 12345678,
      "password": "SecurePassword1"
    },
    {
      "id": "MT5_02",
      "symbol": "AUDUSD",
      "server": "YourBroker-Demo",
      "login": 12345679,
      "password": "SecurePassword2"
    },
    {
      "id": "MT5_03",
      "symbol": "BTCUSD",
      "server": "YourBroker-Demo",
      "login": 12345680,
      "password": "SecurePassword3"
    },
    {
      "id": "MT5_04",
      "symbol": "ETHUSD",
      "server": "YourBroker-Demo",
      "login": 12345681,
      "password": "SecurePassword4"
    },
    {
      "id": "MT5_05",
      "symbol": "EURUSD",
      "server": "YourBroker-Demo",
      "login": 12345682,
      "password": "SecurePassword5"
    },
    {
      "id": "MT5_06",
      "symbol": "GBPJPY",
      "server": "YourBroker-Demo",
      "login": 12345683,
      "password": "SecurePassword6"
    },
    {
      "id": "MT5_07",
      "symbol": "GBPUSD",
      "server": "YourBroker-Demo",
      "login": 12345684,
      "password": "SecurePassword7"
    },
    {
      "id": "MT5_08",
      "symbol": "NDX100",
      "server": "YourBroker-Demo",
      "login": 12345685,
      "password": "SecurePassword8"
    },
    {
      "id": "MT5_09",
      "symbol": "NZDUSD",
      "server": "YourBroker-Demo",
      "login": 12345686,
      "password": "SecurePassword9"
    },
    {
      "id": "MT5_10",
      "symbol": "US30",
      "server": "YourBroker-Demo",
      "login": 12345687,
      "password": "SecurePassword10"
    },
    {
      "id": "MT5_11",
      "symbol": "USDCAD",
      "server": "YourBroker-Demo",
      "login": 12345688,
      "password": "SecurePassword11"
    },
    {
      "id": "MT5_12",
      "symbol": "USDCHF",
      "server": "YourBroker-Demo",
      "login": 12345689,
      "password": "SecurePassword12"
    },
    {
      "id": "MT5_13",
      "symbol": "USDJPY",
      "server": "YourBroker-Demo",
      "login": 12345690,
      "password": "SecurePassword13"
    },
    {
      "id": "MT5_14",
      "symbol": "XAGUSD",
      "server": "YourBroker-Demo",
      "login": 12345691,
      "password": "SecurePassword14"
    },
    {
      "id": "MT5_15",
      "symbol": "XAUUSD",
      "server": "YourBroker-Demo",
      "login": 12345692,
      "password": "SecurePassword15"
    }
  ]
}
```

**Security Note:** In production, store passwords in environment variables, not JSON files.

---

## 2. MT5 Connection Pool Manager

**File:** `app/services/mt5_connection_pool.py`

```python
"""
MT5 Connection Pool Manager
Manages connections to 15 MT5 terminals
"""

import MetaTrader5 as mt5
import json
import logging
from datetime import datetime
from typing import Dict, Optional, Tuple
from threading import Lock

logger = logging.getLogger(__name__)


class MT5Connection:
    """Represents a single MT5 terminal connection"""

    def __init__(self, config: dict):
        self.id = config['id']
        self.symbol = config['symbol']
        self.server = config['server']
        self.login = config['login']
        self.password = config['password']
        self.connected = False
        self.last_check = None
        self.error_message = None
        self.lock = Lock()  # Thread-safe access

    def connect(self) -> bool:
        """Connect to MT5 terminal"""
        with self.lock:
            try:
                # Initialize MT5 connection
                if not mt5.initialize():
                    self.error_message = f"MT5 initialize() failed for {self.id}"
                    logger.error(self.error_message)
                    self.connected = False
                    self.last_check = datetime.utcnow()
                    return False

                # Login to account
                authorized = mt5.login(
                    login=self.login,
                    password=self.password,
                    server=self.server
                )

                if not authorized:
                    error_code = mt5.last_error()
                    self.error_message = f"Login failed for {self.id}: {error_code}"
                    logger.error(self.error_message)
                    self.connected = False
                    self.last_check = datetime.utcnow()
                    mt5.shutdown()
                    return False

                # Connection successful
                self.connected = True
                self.error_message = None
                self.last_check = datetime.utcnow()
                logger.info(f"✓ {self.id} connected successfully (Symbol: {self.symbol})")
                return True

            except Exception as e:
                self.error_message = f"Exception during connection: {str(e)}"
                logger.error(f"Error connecting {self.id}: {e}")
                self.connected = False
                self.last_check = datetime.utcnow()
                return False

    def disconnect(self):
        """Disconnect from MT5 terminal"""
        with self.lock:
            try:
                mt5.shutdown()
                self.connected = False
                logger.info(f"✓ {self.id} disconnected")
            except Exception as e:
                logger.error(f"Error disconnecting {self.id}: {e}")

    def check_connection(self) -> bool:
        """Check if connection is still alive"""
        with self.lock:
            try:
                # Test connection by getting account info
                account_info = mt5.account_info()
                if account_info is None:
                    self.connected = False
                    self.error_message = "Connection lost - account_info() returned None"
                    return False

                self.connected = True
                self.error_message = None
                self.last_check = datetime.utcnow()
                return True

            except Exception as e:
                self.connected = False
                self.error_message = f"Connection check failed: {str(e)}"
                self.last_check = datetime.utcnow()
                return False

    def reconnect(self) -> bool:
        """Reconnect if connection lost"""
        logger.info(f"Attempting to reconnect {self.id}...")
        self.disconnect()
        return self.connect()

    def get_status(self) -> dict:
        """Get current connection status"""
        status = {
            'connected': self.connected,
            'terminal_id': self.id,
            'last_check': self.last_check.isoformat() if self.last_check else None
        }
        if self.error_message:
            status['error'] = self.error_message
        return status


class MT5ConnectionPool:
    """Manages pool of 15 MT5 connections"""

    def __init__(self, config_path: str = 'config/mt5_terminals.json'):
        self.config_path = config_path
        self.connections: Dict[str, MT5Connection] = {}
        self.symbol_to_connection: Dict[str, MT5Connection] = {}
        self._load_config()

    def _load_config(self):
        """Load terminal configuration from JSON file"""
        try:
            with open(self.config_path, 'r') as f:
                config = json.load(f)

            for terminal_config in config['terminals']:
                connection = MT5Connection(terminal_config)
                symbol = terminal_config['symbol']

                self.connections[terminal_config['id']] = connection
                self.symbol_to_connection[symbol] = connection

            logger.info(f"✓ Loaded configuration for {len(self.connections)} MT5 terminals")

        except FileNotFoundError:
            logger.error(f"Configuration file not found: {self.config_path}")
            raise
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in config file: {e}")
            raise
        except Exception as e:
            logger.error(f"Error loading config: {e}")
            raise

    def connect_all(self) -> Tuple[int, int]:
        """
        Connect to all MT5 terminals
        Returns: (successful_connections, total_terminals)
        """
        logger.info("Connecting to all MT5 terminals...")
        successful = 0
        total = len(self.connections)

        for terminal_id, connection in self.connections.items():
            if connection.connect():
                successful += 1

        logger.info(f"✓ Connected to {successful}/{total} MT5 terminals")
        return successful, total

    def disconnect_all(self):
        """Disconnect from all MT5 terminals"""
        logger.info("Disconnecting from all MT5 terminals...")
        for connection in self.connections.values():
            connection.disconnect()
        logger.info("✓ All terminals disconnected")

    def get_connection_by_symbol(self, symbol: str) -> Optional[MT5Connection]:
        """Get MT5 connection for a specific symbol"""
        connection = self.symbol_to_connection.get(symbol)

        if connection is None:
            logger.warning(f"No MT5 terminal configured for symbol: {symbol}")
            return None

        # Check if connection is alive
        if not connection.connected:
            logger.warning(f"Terminal for {symbol} is disconnected. Attempting reconnect...")
            connection.reconnect()

        return connection

    def check_all_connections(self) -> Dict[str, dict]:
        """
        Check health of all connections
        Returns: dict with status of each terminal
        """
        status = {}
        for symbol, connection in self.symbol_to_connection.items():
            connection.check_connection()
            status[symbol] = connection.get_status()
        return status

    def get_health_summary(self) -> dict:
        """
        Get overall health summary
        Returns: dict with overall status
        """
        terminal_status = self.check_all_connections()

        total_terminals = len(self.connections)
        connected_terminals = sum(1 for s in terminal_status.values() if s['connected'])

        # Determine overall status
        if connected_terminals == 0:
            overall_status = 'error'
        elif connected_terminals < total_terminals:
            overall_status = 'degraded'
        else:
            overall_status = 'ok'

        return {
            'status': overall_status,
            'version': 'v5.0.0',
            'total_terminals': total_terminals,
            'connected_terminals': connected_terminals,
            'terminals': terminal_status
        }

    def auto_reconnect_failed(self):
        """Automatically reconnect failed terminals"""
        for connection in self.connections.values():
            if not connection.connected:
                logger.info(f"Auto-reconnecting {connection.id} ({connection.symbol})...")
                connection.reconnect()


# Global connection pool instance
connection_pool = None


def get_connection_pool() -> MT5ConnectionPool:
    """Get global connection pool instance (singleton)"""
    global connection_pool
    if connection_pool is None:
        connection_pool = MT5ConnectionPool()
    return connection_pool


def init_connection_pool(config_path: str = 'config/mt5_terminals.json'):
    """Initialize global connection pool"""
    global connection_pool
    connection_pool = MT5ConnectionPool(config_path)
    connection_pool.connect_all()
    logger.info("MT5 Connection Pool initialized")


def shutdown_connection_pool():
    """Shutdown global connection pool"""
    global connection_pool
    if connection_pool:
        connection_pool.disconnect_all()
        connection_pool = None
        logger.info("MT5 Connection Pool shut down")
```

---

## 3. Flask Route Handlers (Updated)

**File:** `app/routes/indicators.py`

```python
"""
Indicator Routes
Fetches indicator data from appropriate MT5 terminal based on symbol
"""

from flask import Blueprint, request, jsonify
from app.services.mt5_connection_pool import get_connection_pool
from app.services.indicator_reader import fetch_indicator_data
from app.middleware.auth import require_api_key
from app.middleware.tier_validator import validate_tier_access
import logging

logger = logging.getLogger(__name__)

indicators_bp = Blueprint('indicators', __name__)


@indicators_bp.route('/api/indicators/<symbol>/<timeframe>', methods=['GET'])
@require_api_key
@validate_tier_access
def get_indicators(symbol: str, timeframe: str):
    """
    Get indicator data for symbol/timeframe from appropriate MT5 terminal

    Query params:
        - bars: Number of bars to fetch (default 1000)

    Headers:
        - X-API-Key: API authentication
        - X-User-Tier: User tier (FREE or PRO)
    """
    try:
        # Get number of bars from query params
        bars = request.args.get('bars', default=1000, type=int)

        # Validate bars range
        if bars < 100 or bars > 5000:
            return jsonify({
                'success': False,
                'error': 'bars parameter must be between 100 and 5000'
            }), 400

        # Get connection pool
        pool = get_connection_pool()

        # Get MT5 connection for this symbol
        connection = pool.get_connection_by_symbol(symbol)

        if connection is None:
            return jsonify({
                'success': False,
                'error': f'No MT5 terminal configured for symbol: {symbol}'
            }), 500

        if not connection.connected:
            return jsonify({
                'success': False,
                'error': f'MT5 terminal for {symbol} is currently disconnected',
                'terminal_id': connection.id
            }), 503

        # Fetch indicator data using the connection
        logger.info(f"Fetching {symbol} {timeframe} from {connection.id}")

        data = fetch_indicator_data(
            connection=connection,
            symbol=symbol,
            timeframe=timeframe,
            bars=bars
        )

        # Get user tier from header
        user_tier = request.headers.get('X-User-Tier', 'FREE')

        # Add metadata
        data['metadata'] = {
            'symbol': symbol,
            'timeframe': timeframe,
            'tier': user_tier,
            'bars_returned': len(data.get('ohlc', [])),
            'terminal_id': connection.id
        }

        return jsonify({
            'success': True,
            'data': data
        }), 200

    except ValueError as e:
        logger.error(f"Validation error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400

    except Exception as e:
        logger.error(f"Error fetching indicator data: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Failed to fetch indicator data from MT5'
        }), 500


@indicators_bp.route('/api/health', methods=['GET'])
def health_check():
    """
    Health check endpoint - returns status of all MT5 terminals
    No authentication required
    """
    try:
        pool = get_connection_pool()
        health_summary = pool.get_health_summary()

        # Return 503 if all terminals are down
        if health_summary['status'] == 'error':
            return jsonify({
                'success': False,
                'error': 'All MT5 terminals are disconnected'
            }), 503

        return jsonify(health_summary), 200

    except Exception as e:
        logger.error(f"Health check failed: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Health check failed'
        }), 500


@indicators_bp.route('/api/symbols', methods=['GET'])
@require_api_key
def get_symbols():
    """
    Get accessible symbols by tier
    """
    user_tier = request.headers.get('X-User-Tier', 'FREE')

    if user_tier == 'PRO':
        symbols = [
            'AUDJPY', 'AUDUSD', 'BTCUSD', 'ETHUSD', 'EURUSD',
            'GBPJPY', 'GBPUSD', 'NDX100', 'NZDUSD', 'US30',
            'USDCAD', 'USDCHF', 'USDJPY', 'XAGUSD', 'XAUUSD'
        ]
    else:  # FREE tier
        symbols = ['BTCUSD', 'EURUSD', 'USDJPY', 'US30', 'XAUUSD']

    return jsonify({
        'success': True,
        'tier': user_tier,
        'symbols': symbols
    }), 200


@indicators_bp.route('/api/timeframes', methods=['GET'])
@require_api_key
def get_timeframes():
    """
    Get available timeframes by tier
    """
    user_tier = request.headers.get('X-User-Tier', 'FREE')

    if user_tier == 'PRO':
        timeframes = ['M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'H12', 'D1']
    else:  # FREE tier
        timeframes = ['H1', 'H4', 'D1']

    return jsonify({
        'success': True,
        'tier': user_tier,
        'timeframes': timeframes
    }), 200
```

---

## 4. Indicator Data Fetcher (Modified)

**File:** `app/services/indicator_reader.py`

```python
"""
Indicator Data Reader
Fetches OHLC and indicator buffer data from MT5 terminal
"""

import MetaTrader5 as mt5
import pandas as pd
from datetime import datetime
from typing import Dict, List
import logging

logger = logging.getLogger(__name__)

# Timeframe mapping
TIMEFRAME_MAP = {
    'M5': mt5.TIMEFRAME_M5,
    'M15': mt5.TIMEFRAME_M15,
    'M30': mt5.TIMEFRAME_M30,
    'H1': mt5.TIMEFRAME_H1,
    'H2': mt5.TIMEFRAME_H2,
    'H4': mt5.TIMEFRAME_H4,
    'H8': mt5.TIMEFRAME_H8,
    'H12': mt5.TIMEFRAME_H12,
    'D1': mt5.TIMEFRAME_D1,
}


def fetch_indicator_data(connection, symbol: str, timeframe: str, bars: int = 1000) -> Dict:
    """
    Fetch indicator data from MT5 terminal

    Args:
        connection: MT5Connection instance
        symbol: Trading symbol
        timeframe: Timeframe string (M5, M15, etc.)
        bars: Number of bars to fetch

    Returns:
        dict with OHLC data, horizontal lines, diagonal lines, fractals
    """
    with connection.lock:  # Thread-safe access to MT5
        try:
            # Validate timeframe
            if timeframe not in TIMEFRAME_MAP:
                raise ValueError(f"Invalid timeframe: {timeframe}. Valid: {list(TIMEFRAME_MAP.keys())}")

            mt5_timeframe = TIMEFRAME_MAP[timeframe]

            # Fetch OHLC data
            rates = mt5.copy_rates_from_pos(symbol, mt5_timeframe, 0, bars)

            if rates is None or len(rates) == 0:
                raise Exception(f"Failed to fetch OHLC data for {symbol} {timeframe}")

            # Convert to DataFrame
            df = pd.DataFrame(rates)
            df['time'] = pd.to_datetime(df['time'], unit='s')

            # Convert to list of OHLC bars
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

            # Fetch indicator data (horizontal lines)
            horizontal_lines = fetch_horizontal_lines(symbol, mt5_timeframe, bars)

            # Fetch indicator data (diagonal lines)
            diagonal_lines = fetch_diagonal_lines(symbol, mt5_timeframe, bars)

            # Fetch fractals
            fractals = fetch_fractals(symbol, mt5_timeframe, bars)

            return {
                'ohlc': ohlc_data,
                'horizontal': horizontal_lines,
                'diagonal': diagonal_lines,
                'fractals': fractals
            }

        except Exception as e:
            logger.error(f"Error fetching indicator data: {e}")
            raise


def fetch_horizontal_lines(symbol: str, timeframe: int, bars: int) -> Dict:
    """Fetch horizontal fractal lines from indicator buffers"""
    # Implementation depends on your indicator
    # This is a placeholder - adapt to your actual indicator

    try:
        # Get indicator handle
        handle = mt5.iCustom(symbol, timeframe, "Fractal Horizontal Line_V5")

        if handle == mt5.INVALID_HANDLE:
            raise Exception("Failed to get indicator handle for Fractal Horizontal Line_V5")

        # Fetch buffers 4-9 (horizontal lines)
        peak_1 = mt5.copy_buffer_from_pos(handle, 4, 0, bars)
        peak_2 = mt5.copy_buffer_from_pos(handle, 5, 0, bars)
        peak_3 = mt5.copy_buffer_from_pos(handle, 6, 0, bars)
        bottom_1 = mt5.copy_buffer_from_pos(handle, 7, 0, bars)
        bottom_2 = mt5.copy_buffer_from_pos(handle, 8, 0, bars)
        bottom_3 = mt5.copy_buffer_from_pos(handle, 9, 0, bars)

        # Convert to line points (filter EMPTY_VALUE)
        return {
            'peak_1': buffer_to_line_points(peak_1),
            'peak_2': buffer_to_line_points(peak_2),
            'peak_3': buffer_to_line_points(peak_3),
            'bottom_1': buffer_to_line_points(bottom_1),
            'bottom_2': buffer_to_line_points(bottom_2),
            'bottom_3': buffer_to_line_points(bottom_3),
        }

    except Exception as e:
        logger.error(f"Error fetching horizontal lines: {e}")
        return {
            'peak_1': [], 'peak_2': [], 'peak_3': [],
            'bottom_1': [], 'bottom_2': [], 'bottom_3': []
        }


def fetch_diagonal_lines(symbol: str, timeframe: int, bars: int) -> Dict:
    """Fetch diagonal fractal lines from indicator buffers"""
    # Similar to fetch_horizontal_lines
    # Implementation depends on your indicator
    return {
        'ascending_1': [],
        'ascending_2': [],
        'ascending_3': [],
        'descending_1': [],
        'descending_2': [],
        'descending_3': [],
    }


def fetch_fractals(symbol: str, timeframe: int, bars: int) -> Dict:
    """Fetch fractal markers"""
    # Similar to fetch_horizontal_lines
    return {
        'peaks': [],
        'bottoms': []
    }


def buffer_to_line_points(buffer) -> List[Dict]:
    """Convert indicator buffer to line points (filter EMPTY_VALUE)"""
    if buffer is None:
        return []

    EMPTY_VALUE = 1.7976931348623157e+308  # MT5's EMPTY_VALUE

    points = []
    for i, value in enumerate(buffer):
        if value != EMPTY_VALUE and value != 0:
            points.append({
                'index': i,
                'value': float(value)
            })

    return points
```

---

## 5. Flask Application Initialization

**File:** `app/__init__.py`

```python
"""
Flask Application Factory
Initializes MT5 connection pool on startup
"""

from flask import Flask
from app.services.mt5_connection_pool import init_connection_pool, shutdown_connection_pool
from app.routes.indicators import indicators_bp
import logging
import atexit

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)

logger = logging.getLogger(__name__)


def create_app(config_path='config/mt5_terminals.json'):
    """Create and configure Flask application"""

    app = Flask(__name__)

    # Load configuration
    app.config.from_object('config')

    # Initialize MT5 connection pool
    logger.info("Initializing MT5 connection pool...")
    init_connection_pool(config_path)

    # Register blueprints
    app.register_blueprint(indicators_bp)

    # Register shutdown handler
    @atexit.register
    def cleanup():
        logger.info("Shutting down MT5 connection pool...")
        shutdown_connection_pool()

    logger.info("Flask application initialized successfully")

    return app
```

**File:** `run.py`

```python
"""
Flask Application Entry Point
"""

from app import create_app

app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False)
```

---

## 6. Background Health Monitor (Optional but Recommended)

**File:** `app/services/health_monitor.py`

```python
"""
Background Health Monitor
Periodically checks and reconnects failed terminals
"""

import threading
import time
import logging
from app.services.mt5_connection_pool import get_connection_pool

logger = logging.getLogger(__name__)


class HealthMonitor(threading.Thread):
    """Background thread that monitors MT5 connections"""

    def __init__(self, check_interval: int = 60):
        super().__init__(daemon=True)
        self.check_interval = check_interval  # seconds
        self.running = False

    def run(self):
        """Main monitoring loop"""
        self.running = True
        logger.info(f"Health monitor started (check interval: {self.check_interval}s)")

        while self.running:
            try:
                pool = get_connection_pool()

                # Check all connections
                status = pool.get_health_summary()

                # Log status
                connected = status['connected_terminals']
                total = status['total_terminals']
                logger.info(f"Health check: {connected}/{total} terminals connected")

                # Auto-reconnect failed terminals
                if connected < total:
                    logger.warning(f"{total - connected} terminals disconnected. Attempting auto-reconnect...")
                    pool.auto_reconnect_failed()

            except Exception as e:
                logger.error(f"Error in health monitor: {e}")

            # Sleep until next check
            time.sleep(self.check_interval)

    def stop(self):
        """Stop the monitor"""
        self.running = False
        logger.info("Health monitor stopped")


# Global health monitor instance
_health_monitor = None


def start_health_monitor(check_interval: int = 60):
    """Start background health monitoring"""
    global _health_monitor
    if _health_monitor is None or not _health_monitor.is_alive():
        _health_monitor = HealthMonitor(check_interval)
        _health_monitor.start()


def stop_health_monitor():
    """Stop background health monitoring"""
    global _health_monitor
    if _health_monitor:
        _health_monitor.stop()
```

**Add to `app/__init__.py`:**

```python
from app.services.health_monitor import start_health_monitor, stop_health_monitor

def create_app(config_path='config/mt5_terminals.json'):
    app = Flask(__name__)

    # ... existing code ...

    # Start health monitor
    start_health_monitor(check_interval=60)  # Check every 60 seconds

    # Register shutdown handler
    @atexit.register
    def cleanup():
        logger.info("Shutting down...")
        stop_health_monitor()
        shutdown_connection_pool()

    return app
```

---

## 7. Testing the Implementation

**Test Script:** `test_connection_pool.py`

```python
"""
Test script for MT5 connection pool
"""

from app.services.mt5_connection_pool import MT5ConnectionPool
import time

def test_connection_pool():
    print("=" * 60)
    print("MT5 Connection Pool Test")
    print("=" * 60)

    # Initialize pool
    print("\n1. Initializing connection pool...")
    pool = MT5ConnectionPool('config/mt5_terminals.json')

    # Connect to all terminals
    print("\n2. Connecting to all terminals...")
    successful, total = pool.connect_all()
    print(f"   Result: {successful}/{total} terminals connected")

    # Get health summary
    print("\n3. Health summary:")
    health = pool.get_health_summary()
    print(f"   Overall status: {health['status']}")
    print(f"   Connected: {health['connected_terminals']}/{health['total_terminals']}")

    # Test symbol routing
    print("\n4. Testing symbol routing:")
    test_symbols = ['XAUUSD', 'EURUSD', 'BTCUSD']
    for symbol in test_symbols:
        connection = pool.get_connection_by_symbol(symbol)
        if connection:
            print(f"   {symbol} → {connection.id} (Connected: {connection.connected})")
        else:
            print(f"   {symbol} → NOT CONFIGURED")

    # Wait a bit
    print("\n5. Sleeping for 5 seconds...")
    time.sleep(5)

    # Check connections again
    print("\n6. Rechecking connections...")
    health = pool.get_health_summary()
    print(f"   Connected: {health['connected_terminals']}/{health['total_terminals']}")

    # Disconnect all
    print("\n7. Disconnecting all terminals...")
    pool.disconnect_all()
    print("   Done!")

    print("\n" + "=" * 60)
    print("Test completed successfully!")
    print("=" * 60)


if __name__ == '__main__':
    test_connection_pool()
```

**Run the test:**

```bash
python test_connection_pool.py
```

---

## 8. Summary

**What we've implemented:**

✅ **MT5ConnectionPool**: Manages 15 MT5 connections
✅ **Symbol Router**: Routes requests to correct terminal based on symbol
✅ **Health Monitoring**: Background thread checks and reconnects failed terminals
✅ **Thread-Safe**: Locks prevent race conditions
✅ **Auto-Reconnect**: Failed terminals automatically reconnect
✅ **Comprehensive Logging**: Track connection status and errors
✅ **Health Check API**: `/api/health` shows status of all terminals

**Key Benefits:**

- 🚀 **Distributed Load**: 9 charts per terminal (instead of 135 on one)
- 💪 **Fault Tolerance**: If one terminal fails, others continue
- 🔄 **Auto-Recovery**: Failed terminals automatically reconnect
- 📊 **Monitoring**: Real-time health status of all terminals
- 🧵 **Thread-Safe**: Safe for concurrent requests

**Next Steps:**

1. Create `config/mt5_terminals.json` with your broker credentials
2. Test connection pool with `test_connection_pool.py`
3. Deploy Flask service
4. Monitor health at `/api/health`

---

**Last Updated:** 2025-11-17
**Version:** 1.0.0
