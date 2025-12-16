"""
Indicators Routes - Main data retrieval endpoints with tier validation

Endpoints:
- GET /api/indicators/<symbol>/<timeframe> - Get indicator data
- GET /api/health - Health check for all terminals
- GET /api/symbols - Get accessible symbols by tier
- GET /api/timeframes - Get accessible timeframes by tier

Reference: docs/flask-multi-mt5-implementation.md Section 3
"""

import logging
from typing import Tuple

from flask import Blueprint, Response, jsonify, request

logger = logging.getLogger(__name__)

# Blueprint will be registered in __init__.py
indicators_bp = Blueprint('indicators', __name__, url_prefix='/api')


@indicators_bp.route('/health', methods=['GET'])
def health() -> Tuple[Response, int]:
    """
    Health check endpoint - checks all MT5 terminal connections.

    Returns:
        200: Service healthy (at least 1 terminal connected)
        503: Service unavailable (all terminals disconnected)
    """
    try:
        from app.services.mt5_connection_pool import get_connection_pool

        pool = get_connection_pool()
        health_summary = pool.get_health_summary()

        if health_summary['status'] == 'error':
            return jsonify(health_summary), 503

        return jsonify(health_summary), 200

    except RuntimeError:
        # Connection pool not initialized
        return jsonify({
            'status': 'error',
            'version': 'v5.0.0',
            'total_terminals': 0,
            'connected_terminals': 0,
            'terminals': {},
            'error': 'Connection pool not initialized'
        }), 503
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return jsonify({
            'status': 'error',
            'version': 'v5.0.0',
            'error': str(e)
        }), 503


@indicators_bp.route('/symbols', methods=['GET'])
def get_symbols() -> Tuple[Response, int]:
    """
    Get accessible symbols based on user tier.

    Headers:
        X-User-Tier: FREE or PRO (defaults to FREE)

    Returns:
        200: List of accessible symbols
    """
    try:
        tier = request.headers.get('X-User-Tier', 'FREE').upper()

        from app.services.tier_service import get_accessible_symbols

        symbols = get_accessible_symbols(tier)

        return jsonify({
            'success': True,
            'tier': tier,
            'symbols': symbols
        }), 200

    except Exception as e:
        logger.error(f"Error getting symbols: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@indicators_bp.route('/timeframes', methods=['GET'])
def get_timeframes() -> Tuple[Response, int]:
    """
    Get accessible timeframes based on user tier.

    Headers:
        X-User-Tier: FREE or PRO (defaults to FREE)

    Returns:
        200: List of accessible timeframes
    """
    try:
        tier = request.headers.get('X-User-Tier', 'FREE').upper()

        from app.services.tier_service import get_accessible_timeframes

        timeframes = get_accessible_timeframes(tier)

        return jsonify({
            'success': True,
            'tier': tier,
            'timeframes': timeframes
        }), 200

    except Exception as e:
        logger.error(f"Error getting timeframes: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@indicators_bp.route(
    '/indicators/<string:symbol>/<string:timeframe>',
    methods=['GET']
)
def get_indicators(symbol: str, timeframe: str) -> Tuple[Response, int]:
    """
    Get indicator data for a specific symbol and timeframe.

    Uses connection pool to route request to correct MT5 terminal.
    Validates tier access before retrieving data.

    Args:
        symbol: Trading symbol (e.g., XAUUSD)
        timeframe: Chart timeframe (e.g., H1)

    Query params:
        bars: Number of bars to retrieve (default: 1000, max: 5000)

    Headers:
        X-User-Tier: FREE or PRO (defaults to FREE)

    Returns:
        200: Indicator data (OHLC, horizontal, diagonal, fractals)
        400: Invalid symbol or timeframe
        403: Tier cannot access this symbol/timeframe
        500: MT5 error or service unavailable
    """
    try:
        # Normalize inputs
        symbol = symbol.upper()
        timeframe = timeframe.upper()

        # Get tier from header (defaults to FREE)
        tier = request.headers.get('X-User-Tier', 'FREE').upper()

        # Get bars parameter (default: 1000, max: 5000)
        bars = min(int(request.args.get('bars', 1000)), 5000)
        bars = max(bars, 100)  # Minimum 100 bars

        # Import services
        from app.services.indicator_reader import fetch_indicator_data
        from app.services.mt5_connection_pool import get_connection_pool
        from app.services.tier_service import (
            get_accessible_symbols,
            get_accessible_timeframes,
            validate_chart_access,
        )

        # Validate tier access
        is_allowed, error_message = validate_chart_access(
            symbol, timeframe, tier
        )

        if not is_allowed:
            # Determine if it's a symbol or timeframe issue
            accessible_symbols = get_accessible_symbols(tier)
            accessible_timeframes = get_accessible_timeframes(tier)

            response = {
                'success': False,
                'error': error_message,
                'tier': tier,
                'upgrade_required': True
            }

            # Add appropriate accessible list
            if symbol not in accessible_symbols:
                response['accessible_symbols'] = accessible_symbols
            if timeframe not in accessible_timeframes:
                response['accessible_timeframes'] = accessible_timeframes

            return jsonify(response), 403

        # Get connection from pool
        pool = get_connection_pool()
        connection = pool.get_connection_by_symbol(symbol)

        if connection is None:
            return jsonify({
                'success': False,
                'error': f'No MT5 terminal configured for symbol {symbol}'
            }), 500

        if not connection.connected:
            return jsonify({
                'success': False,
                'error': f'MT5 terminal for {symbol} is disconnected'
            }), 503

        # Fetch indicator data from MT5
        data = fetch_indicator_data(connection, symbol, timeframe, bars)

        # Add metadata
        data['metadata'] = {
            'symbol': symbol,
            'timeframe': timeframe,
            'tier': tier,
            'bars_returned': len(data.get('ohlc', [])),
            'terminal_id': connection.id
        }

        return jsonify({
            'success': True,
            'data': data
        }), 200

    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400

    except RuntimeError as e:
        logger.error(f"Connection pool error: {e}")
        return jsonify({
            'success': False,
            'error': 'MT5 connection pool not initialized'
        }), 503

    except Exception as e:
        logger.error(
            f"Error retrieving indicators for {symbol}/{timeframe}: {str(e)}"
        )
        return jsonify({
            'success': False,
            'error': 'Failed to retrieve indicator data'
        }), 500
