"""
Background Health Monitor

Periodically checks and reconnects failed MT5 terminals.

Reference: docs/flask-multi-mt5-implementation.md Section 6
"""

import logging
import os
import threading
from typing import Optional

logger = logging.getLogger(__name__)


class HealthMonitor(threading.Thread):
    """Background thread that monitors MT5 connections."""

    def __init__(self, check_interval: int = 60):
        """
        Initialize health monitor.

        Args:
            check_interval: Seconds between health checks (default: 60)
        """
        super().__init__(daemon=True)
        self.check_interval = check_interval
        self.running = False
        self._stop_event = threading.Event()

    def run(self) -> None:
        """Main monitoring loop."""
        self.running = True
        logger.info(
            f"Health monitor started (check interval: {self.check_interval}s)"
        )

        while not self._stop_event.is_set():
            try:
                # Import here to avoid circular imports
                from app.services.mt5_connection_pool import get_connection_pool

                pool = get_connection_pool()

                # Check all connections
                status = pool.get_health_summary()

                # Log status
                connected = status['connected_terminals']
                total = status['total_terminals']
                logger.info(
                    f"Health check: {connected}/{total} terminals connected"
                )

                # Auto-reconnect failed terminals
                if connected < total:
                    logger.warning(
                        f"{total - connected} terminals disconnected. "
                        "Attempting auto-reconnect..."
                    )
                    reconnected = pool.auto_reconnect_failed()
                    if reconnected:
                        logger.info(
                            f"Successfully reconnected: {', '.join(reconnected)}"
                        )

            except RuntimeError:
                # Pool not initialized yet
                logger.debug("Connection pool not yet initialized")
            except Exception as e:
                logger.error(f"Error in health monitor: {e}")

            # Wait for next check or stop signal
            self._stop_event.wait(self.check_interval)

        logger.info("Health monitor stopped")

    def stop(self) -> None:
        """Stop the monitor."""
        self.running = False
        self._stop_event.set()
        logger.info("Health monitor stop requested")


# Global health monitor instance
_health_monitor: Optional[HealthMonitor] = None


def start_health_monitor(check_interval: Optional[int] = None) -> HealthMonitor:
    """
    Start background health monitoring.

    Args:
        check_interval: Seconds between checks (default: from env or 60)

    Returns:
        HealthMonitor: The monitor thread
    """
    global _health_monitor

    # Get check interval from environment or default
    if check_interval is None:
        check_interval = int(os.getenv('HEALTH_CHECK_INTERVAL', '60'))

    # Stop existing monitor if running
    if _health_monitor is not None and _health_monitor.is_alive():
        stop_health_monitor()

    _health_monitor = HealthMonitor(check_interval)
    _health_monitor.start()

    return _health_monitor


def stop_health_monitor() -> None:
    """Stop background health monitoring."""
    global _health_monitor

    if _health_monitor is not None:
        _health_monitor.stop()
        # Wait for thread to finish (with timeout)
        _health_monitor.join(timeout=5)
        _health_monitor = None


def is_health_monitor_running() -> bool:
    """
    Check if health monitor is running.

    Returns:
        bool: True if monitor is active
    """
    return _health_monitor is not None and _health_monitor.is_alive()
