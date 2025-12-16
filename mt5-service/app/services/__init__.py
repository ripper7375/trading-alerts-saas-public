"""
Services Package - Business Logic Layer

Exports:
- tier_service: Tier validation logic
- mt5_connection_pool: MT5 connection pool management
- indicator_reader: Thread-safe indicator data reading
- health_monitor: Background health monitoring
"""

from app.services.tier_service import (
    get_accessible_symbols,
    get_accessible_timeframes,
    validate_chart_access,
    validate_symbol_access,
    validate_timeframe_access,
)

from app.services.mt5_connection_pool import (
    MT5Connection,
    MT5ConnectionPool,
    get_connection_pool,
    init_connection_pool,
    shutdown_connection_pool,
)

from app.services.indicator_reader import (
    fetch_indicator_data,
)

from app.services.health_monitor import (
    HealthMonitor,
    is_health_monitor_running,
    start_health_monitor,
    stop_health_monitor,
)

__all__ = [
    # Tier service
    'validate_symbol_access',
    'validate_timeframe_access',
    'validate_chart_access',
    'get_accessible_symbols',
    'get_accessible_timeframes',
    # Connection pool
    'MT5Connection',
    'MT5ConnectionPool',
    'get_connection_pool',
    'init_connection_pool',
    'shutdown_connection_pool',
    # Indicator reader
    'fetch_indicator_data',
    # Health monitor
    'HealthMonitor',
    'start_health_monitor',
    'stop_health_monitor',
    'is_health_monitor_running',
]
