"""
MT5 Connection Pool Manager

Manages connections to 15 MT5 terminals (one per symbol).
Each terminal handles a single symbol across all 9 timeframes.

Reference: docs/flask-multi-mt5-implementation.md Section 2
"""

import json
import logging
import os
from datetime import datetime
from threading import Lock
from typing import Dict, List, Optional, Tuple

from app.utils.constants import MT5_AVAILABLE

# Try to import MetaTrader5
try:
    import MetaTrader5 as mt5
except ImportError:
    mt5 = None

logger = logging.getLogger(__name__)


class MT5Connection:
    """Represents a single MT5 terminal connection."""

    def __init__(self, config: dict):
        """
        Initialize MT5 connection.

        Args:
            config: Terminal configuration dict with id, symbol, server, login, password
        """
        self.id = config['id']
        self.symbol = config['symbol']
        self.server = self._resolve_env_var(config['server'])
        self.login = int(self._resolve_env_var(str(config['login'])))
        self.password = self._resolve_env_var(config['password'])
        self.connected = False
        self.last_check: Optional[datetime] = None
        self.error_message: Optional[str] = None
        self.lock = Lock()  # Thread-safe access
        self.reconnect_count = 0
        self.last_error: Optional[str] = None

    def _resolve_env_var(self, value: str) -> str:
        """Resolve environment variable placeholders like ${VAR_NAME}."""
        if value.startswith('${') and value.endswith('}'):
            env_var = value[2:-1]
            return os.getenv(env_var, '')
        return value

    def connect(self) -> bool:
        """
        Connect to MT5 terminal.

        Returns:
            bool: True if connection successful, False otherwise
        """
        if not MT5_AVAILABLE or mt5 is None:
            self.error_message = "MetaTrader5 module not available"
            self.connected = False
            self.last_check = datetime.utcnow()
            return False

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
                logger.info(
                    f"✓ {self.id} connected successfully (Symbol: {self.symbol})"
                )
                return True

            except Exception as e:
                self.error_message = f"Exception during connection: {str(e)}"
                self.last_error = str(e)
                logger.error(f"Error connecting {self.id}: {e}")
                self.connected = False
                self.last_check = datetime.utcnow()
                return False

    def disconnect(self) -> None:
        """Disconnect from MT5 terminal."""
        if not MT5_AVAILABLE or mt5 is None:
            return

        with self.lock:
            try:
                mt5.shutdown()
                self.connected = False
                logger.info(f"✓ {self.id} disconnected")
            except Exception as e:
                logger.error(f"Error disconnecting {self.id}: {e}")

    def check_connection(self) -> bool:
        """
        Check if connection is still alive.

        Returns:
            bool: True if connected, False otherwise
        """
        if not MT5_AVAILABLE or mt5 is None:
            self.connected = False
            return False

        with self.lock:
            try:
                # Test connection by getting account info
                account_info = mt5.account_info()
                if account_info is None:
                    self.connected = False
                    self.error_message = (
                        "Connection lost - account_info() returned None"
                    )
                    return False

                self.connected = True
                self.error_message = None
                self.last_check = datetime.utcnow()
                return True

            except Exception as e:
                self.connected = False
                self.error_message = f"Connection check failed: {str(e)}"
                self.last_error = str(e)
                self.last_check = datetime.utcnow()
                return False

    def reconnect(self) -> bool:
        """
        Reconnect if connection lost.

        Returns:
            bool: True if reconnection successful
        """
        logger.info(f"Attempting to reconnect {self.id}...")
        self.disconnect()
        self.reconnect_count += 1
        return self.connect()

    def get_status(self) -> dict:
        """
        Get current connection status.

        Returns:
            dict: Status information
        """
        status = {
            'connected': self.connected,
            'terminal_id': self.id,
            'last_check': self.last_check.isoformat() if self.last_check else None
        }
        if self.error_message:
            status['error'] = self.error_message
        return status

    def get_admin_status(self) -> dict:
        """
        Get detailed status for admin endpoints.

        Returns:
            dict: Detailed status with metrics
        """
        status = self.get_status()
        status['reconnect_count'] = self.reconnect_count
        status['last_error'] = self.last_error
        status['symbol'] = self.symbol
        return status


class MT5ConnectionPool:
    """Manages pool of 15 MT5 connections (one per symbol)."""

    def __init__(self, config_path: str = 'config/mt5_terminals.json'):
        """
        Initialize connection pool.

        Args:
            config_path: Path to terminal configuration JSON file
        """
        self.config_path = config_path
        self.connections: Dict[str, MT5Connection] = {}
        self.symbol_to_connection: Dict[str, MT5Connection] = {}
        self._load_config()

    def _load_config(self) -> None:
        """Load terminal configuration from JSON file."""
        try:
            with open(self.config_path, 'r') as f:
                config = json.load(f)

            for terminal_config in config['terminals']:
                connection = MT5Connection(terminal_config)
                symbol = terminal_config['symbol']

                self.connections[terminal_config['id']] = connection
                self.symbol_to_connection[symbol] = connection

            logger.info(
                f"✓ Loaded configuration for {len(self.connections)} MT5 terminals"
            )

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
        Connect to all MT5 terminals.

        Returns:
            Tuple[int, int]: (successful_connections, total_terminals)
        """
        logger.info("Connecting to all MT5 terminals...")
        successful = 0
        total = len(self.connections)

        for terminal_id, connection in self.connections.items():
            if connection.connect():
                successful += 1

        logger.info(f"✓ Connected to {successful}/{total} MT5 terminals")
        return successful, total

    def disconnect_all(self) -> None:
        """Disconnect from all MT5 terminals."""
        logger.info("Disconnecting from all MT5 terminals...")
        for connection in self.connections.values():
            connection.disconnect()
        logger.info("✓ All terminals disconnected")

    def get_connection_by_symbol(self, symbol: str) -> Optional[MT5Connection]:
        """
        Get MT5 connection for a specific symbol.

        Args:
            symbol: Trading symbol (e.g., 'XAUUSD')

        Returns:
            MT5Connection or None if not found
        """
        connection = self.symbol_to_connection.get(symbol)

        if connection is None:
            logger.warning(f"No MT5 terminal configured for symbol: {symbol}")
            return None

        # Check if connection is alive
        if not connection.connected:
            logger.warning(
                f"Terminal for {symbol} is disconnected. Attempting reconnect..."
            )
            connection.reconnect()

        return connection

    def get_connection_by_id(self, terminal_id: str) -> Optional[MT5Connection]:
        """
        Get MT5 connection by terminal ID.

        Args:
            terminal_id: Terminal ID (e.g., 'MT5_15')

        Returns:
            MT5Connection or None if not found
        """
        return self.connections.get(terminal_id)

    def check_all_connections(self) -> Dict[str, dict]:
        """
        Check health of all connections.

        Returns:
            dict: Status of each terminal keyed by symbol
        """
        status = {}
        for symbol, connection in self.symbol_to_connection.items():
            connection.check_connection()
            status[symbol] = connection.get_status()
        return status

    def get_health_summary(self) -> dict:
        """
        Get overall health summary.

        Returns:
            dict: Overall status with terminal details
        """
        terminal_status = self.check_all_connections()

        total_terminals = len(self.connections)
        connected_terminals = sum(
            1 for s in terminal_status.values() if s['connected']
        )

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

    def get_admin_health_summary(self) -> dict:
        """
        Get detailed health summary for admin endpoints.

        Returns:
            dict: Detailed status with metrics
        """
        terminal_status = {}
        for symbol, connection in self.symbol_to_connection.items():
            connection.check_connection()
            terminal_status[symbol] = connection.get_admin_status()

        total_terminals = len(self.connections)
        connected_terminals = sum(
            1 for s in terminal_status.values() if s['connected']
        )

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

    def auto_reconnect_failed(self) -> List[str]:
        """
        Automatically reconnect failed terminals.

        Returns:
            List[str]: List of terminal IDs that were reconnected
        """
        reconnected = []
        for connection in self.connections.values():
            if not connection.connected:
                logger.info(
                    f"Auto-reconnecting {connection.id} ({connection.symbol})..."
                )
                if connection.reconnect():
                    reconnected.append(connection.id)
        return reconnected

    def restart_terminal(self, terminal_id: str) -> Tuple[bool, Optional[str]]:
        """
        Restart a specific terminal.

        Args:
            terminal_id: Terminal ID to restart

        Returns:
            Tuple[bool, Optional[str]]: (success, error_message)
        """
        connection = self.get_connection_by_id(terminal_id)
        if connection is None:
            return False, f"Terminal {terminal_id} not found"

        success = connection.reconnect()
        if success:
            return True, None
        return False, connection.error_message

    def restart_all_terminals(self) -> dict:
        """
        Restart all terminals.

        Returns:
            dict: Results of restart operation
        """
        results = []
        successful = 0
        failed = 0

        for terminal_id, connection in self.connections.items():
            success = connection.reconnect()
            results.append({
                'terminal_id': terminal_id,
                'symbol': connection.symbol,
                'success': success,
                'error': connection.error_message if not success else None
            })
            if success:
                successful += 1
            else:
                failed += 1

        return {
            'success': failed == 0,
            'message': f"Restarted {successful}/{len(self.connections)} terminals",
            'total_terminals': len(self.connections),
            'successful_restarts': successful,
            'failed_restarts': failed,
            'results': results
        }

    def get_stats(self) -> dict:
        """
        Get aggregate statistics for all terminals.

        Returns:
            dict: Aggregate statistics
        """
        total_reconnects = sum(c.reconnect_count for c in self.connections.values())
        connected = sum(1 for c in self.connections.values() if c.connected)
        disconnected = len(self.connections) - connected

        # Find most problematic terminals
        problematic = sorted(
            [
                {
                    'terminal_id': c.id,
                    'symbol': c.symbol,
                    'reconnect_count': c.reconnect_count,
                    'connected': c.connected
                }
                for c in self.connections.values()
            ],
            key=lambda x: x['reconnect_count'],
            reverse=True
        )[:5]

        return {
            'success': True,
            'stats': {
                'total_reconnects_session': total_reconnects,
                'terminals_by_status': {
                    'connected': connected,
                    'disconnected': disconnected,
                    'reconnecting': 0
                },
                'most_problematic_terminals': problematic
            }
        }


# Global connection pool instance
_connection_pool: Optional[MT5ConnectionPool] = None


def get_connection_pool() -> MT5ConnectionPool:
    """
    Get global connection pool instance (singleton).

    Returns:
        MT5ConnectionPool: The connection pool instance

    Raises:
        RuntimeError: If pool not initialized
    """
    if _connection_pool is None:
        raise RuntimeError(
            "Connection pool not initialized. Call init_connection_pool() first."
        )
    return _connection_pool


def init_connection_pool(
    config_path: str = 'config/mt5_terminals.json'
) -> MT5ConnectionPool:
    """
    Initialize global connection pool.

    Args:
        config_path: Path to terminal configuration file

    Returns:
        MT5ConnectionPool: The initialized connection pool
    """
    global _connection_pool
    _connection_pool = MT5ConnectionPool(config_path)
    _connection_pool.connect_all()
    logger.info("MT5 Connection Pool initialized")
    return _connection_pool


def shutdown_connection_pool() -> None:
    """Shutdown global connection pool."""
    global _connection_pool
    if _connection_pool:
        _connection_pool.disconnect_all()
        _connection_pool = None
        logger.info("MT5 Connection Pool shut down")
