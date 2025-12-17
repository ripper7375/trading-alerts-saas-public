"""
Indicators Routes - GET /api/indicators endpoint with tier validation
"""

from flask import Blueprint, request, jsonify, Response
from typing import Tuple
import logging

# Blueprint will be registered in __init__.py
indicators_bp = Blueprint('indicators', __name__, url_prefix='/api')

logger = logging.getLogger(__name__)


@indicators_bp.route('/indicators/<string:symbol>/<string:timeframe>', methods=['GET'])
def get_indicators(symbol: str, timeframe: str) -> Tuple[Response, int]:
    """
    Get indicator data for a specific symbol and timeframe.

    Validates tier access before retrieving data from MT5.

    Args:
        symbol (str): Trading symbol (e.g., XAUUSD)
        timeframe (str): Chart timeframe (e.g., H1)

    Returns:
        Tuple[Response, int]: Flask JSON response and HTTP status code
    """
    try:
        # Get tier from header (defaults to FREE)
        tier = request.headers.get('X-User-Tier', 'FREE')
        bars = int(request.args.get('bars', 1000))

        # Import services here to avoid circular imports
        from app.services.tier_service import validate_chart_access
        from app.services.mt5_service import get_indicator_data

        # Validate tier access
        is_allowed, error_message = validate_chart_access(symbol, timeframe, tier)

        if not is_allowed:
            return jsonify({
                'success': False,
                'error': error_message,
                'tier': tier
            }), 403

        # Retrieve indicator data from MT5
        data = get_indicator_data(symbol, timeframe, bars)

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

    except Exception as e:
        logger.error(f"Error retrieving indicators for {symbol}/{timeframe}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to retrieve indicator data'
        }), 500
