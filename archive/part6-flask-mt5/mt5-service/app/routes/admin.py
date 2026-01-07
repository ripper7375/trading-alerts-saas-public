"""
Admin Routes - Terminal Management Endpoints

Provides administrative endpoints for MT5 terminal management.
Requires X-Admin-API-Key header for authentication.

Reference: docs/flask_mt5_openapi.yaml Admin endpoints
"""

import logging
import os
from functools import wraps
from typing import Callable, Tuple

from flask import Blueprint, Response, jsonify, request

logger = logging.getLogger(__name__)

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

# Admin API key from environment
ADMIN_API_KEY = os.getenv('MT5_ADMIN_API_KEY', '')


def require_admin_key(f: Callable) -> Callable:
    """
    Decorator to require admin API key for endpoint access.

    Args:
        f: Route function to wrap

    Returns:
        Wrapped function that checks admin key
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-Admin-API-Key', '')

        if not ADMIN_API_KEY:
            logger.warning("MT5_ADMIN_API_KEY not configured")
            return jsonify({
                'success': False,
                'error': 'Admin API not configured'
            }), 500

        if api_key != ADMIN_API_KEY:
            logger.warning(f"Invalid admin API key attempt from {request.remote_addr}")
            return jsonify({
                'success': False,
                'error': 'Invalid or missing admin API key'
            }), 403

        return f(*args, **kwargs)

    return decorated_function


@admin_bp.route('/terminals/health', methods=['GET'])
@require_admin_key
def get_terminals_health() -> Tuple[Response, int]:
    """
    Get detailed health status of all MT5 terminals (Admin only).

    Returns:
        200: Detailed terminal health data
        403: Admin access required
        500: Internal error
    """
    try:
        from app.services.mt5_connection_pool import get_connection_pool

        pool = get_connection_pool()
        health = pool.get_admin_health_summary()

        return jsonify(health), 200

    except RuntimeError as e:
        logger.error(f"Connection pool error: {e}")
        return jsonify({
            'success': False,
            'error': 'Connection pool not initialized'
        }), 500
    except Exception as e:
        logger.error(f"Error getting terminal health: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to get terminal health'
        }), 500


@admin_bp.route('/terminals/<string:terminal_id>/restart', methods=['POST'])
@require_admin_key
def restart_terminal(terminal_id: str) -> Tuple[Response, int]:
    """
    Restart a specific MT5 terminal (Admin only).

    Args:
        terminal_id: Terminal ID (e.g., MT5_15)

    Returns:
        200: Terminal restarted successfully
        403: Admin access required
        404: Terminal not found
        500: Restart failed
    """
    try:
        from app.services.mt5_connection_pool import get_connection_pool

        pool = get_connection_pool()
        connection = pool.get_connection_by_id(terminal_id)

        if connection is None:
            return jsonify({
                'success': False,
                'error': f'Terminal {terminal_id} not found'
            }), 404

        success, error = pool.restart_terminal(terminal_id)

        if success:
            logger.info(f"Admin restarted terminal {terminal_id}")
            return jsonify({
                'success': True,
                'message': f'Terminal {terminal_id} restarted successfully',
                'terminal_id': terminal_id,
                'symbol': connection.symbol,
                'connected': connection.connected
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': error or 'Restart failed',
                'terminal_id': terminal_id,
                'symbol': connection.symbol,
                'connected': False
            }), 500

    except RuntimeError as e:
        logger.error(f"Connection pool error: {e}")
        return jsonify({
            'success': False,
            'error': 'Connection pool not initialized'
        }), 500
    except Exception as e:
        logger.error(f"Error restarting terminal {terminal_id}: {e}")
        return jsonify({
            'success': False,
            'error': f'Failed to restart terminal: {str(e)}'
        }), 500


@admin_bp.route('/terminals/restart-all', methods=['POST'])
@require_admin_key
def restart_all_terminals() -> Tuple[Response, int]:
    """
    Restart ALL MT5 terminals (Admin only - Use with caution).

    WARNING: This will temporarily interrupt service for all users.

    Returns:
        200: Terminals restart initiated
        403: Admin access required
        500: Internal error
    """
    try:
        from app.services.mt5_connection_pool import get_connection_pool

        logger.warning("Admin initiated restart of ALL terminals")

        pool = get_connection_pool()
        results = pool.restart_all_terminals()

        return jsonify(results), 200

    except RuntimeError as e:
        logger.error(f"Connection pool error: {e}")
        return jsonify({
            'success': False,
            'error': 'Connection pool not initialized'
        }), 500
    except Exception as e:
        logger.error(f"Error restarting all terminals: {e}")
        return jsonify({
            'success': False,
            'error': f'Failed to restart terminals: {str(e)}'
        }), 500


@admin_bp.route('/terminals/<string:terminal_id>/logs', methods=['GET'])
@require_admin_key
def get_terminal_logs(terminal_id: str) -> Tuple[Response, int]:
    """
    Get recent logs for a specific terminal (Admin only).

    Args:
        terminal_id: Terminal ID (e.g., MT5_15)

    Query params:
        lines: Number of log lines to return (default: 100, max: 1000)

    Returns:
        200: Log entries retrieved
        403: Admin access required
        404: Terminal not found
    """
    try:
        from app.services.mt5_connection_pool import get_connection_pool

        pool = get_connection_pool()
        connection = pool.get_connection_by_id(terminal_id)

        if connection is None:
            return jsonify({
                'success': False,
                'error': f'Terminal {terminal_id} not found'
            }), 404

        # Get line count from query params
        lines = request.args.get('lines', default=100, type=int)
        lines = min(max(lines, 1), 1000)  # Clamp between 1 and 1000

        # Note: In a real implementation, you would read from a log file
        # or log aggregation service. This is a placeholder.
        last_check_iso = (
            connection.last_check.isoformat() if connection.last_check else None
        )
        connected_status = "connected" if connection.connected else "disconnected"
        logs = [
            {
                'timestamp': last_check_iso,
                'level': 'INFO' if connection.connected else 'WARNING',
                'message': f'Terminal {terminal_id} status: {connected_status}'
            }
        ]

        if connection.last_error:
            logs.append({
                'timestamp': last_check_iso,
                'level': 'ERROR',
                'message': connection.last_error
            })

        return jsonify({
            'success': True,
            'terminal_id': terminal_id,
            'symbol': connection.symbol,
            'logs': logs
        }), 200

    except RuntimeError as e:
        logger.error(f"Connection pool error: {e}")
        return jsonify({
            'success': False,
            'error': 'Connection pool not initialized'
        }), 500
    except Exception as e:
        logger.error(f"Error getting logs for {terminal_id}: {e}")
        return jsonify({
            'success': False,
            'error': f'Failed to get logs: {str(e)}'
        }), 500


@admin_bp.route('/terminals/stats', methods=['GET'])
@require_admin_key
def get_terminal_stats() -> Tuple[Response, int]:
    """
    Get aggregate statistics for all terminals (Admin only).

    Returns:
        200: Statistics retrieved
        403: Admin access required
        500: Internal error
    """
    try:
        from app.services.mt5_connection_pool import get_connection_pool

        pool = get_connection_pool()
        stats = pool.get_stats()

        return jsonify(stats), 200

    except RuntimeError as e:
        logger.error(f"Connection pool error: {e}")
        return jsonify({
            'success': False,
            'error': 'Connection pool not initialized'
        }), 500
    except Exception as e:
        logger.error(f"Error getting terminal stats: {e}")
        return jsonify({
            'success': False,
            'error': f'Failed to get stats: {str(e)}'
        }), 500
