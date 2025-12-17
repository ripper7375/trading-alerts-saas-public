"""
Flask MT5 Service - Main Application Package
"""

from flask import Flask
from flask_cors import CORS
import os
from typing import Dict, Any


def create_app() -> Flask:
    """
    Application factory pattern for Flask MT5 service.

    Returns:
        Flask: Configured Flask application instance
    """
    app = Flask(__name__)

    # Configure CORS
    CORS(app, origins=[
        'http://localhost:3000',
        'https://*.vercel.app'
    ])

    # Load config from environment
    app.config['MT5_TERMINAL_PATH'] = os.getenv('MT5_TERMINAL_PATH', '')
    app.config['MT5_LOGIN'] = os.getenv('MT5_LOGIN', '')
    app.config['MT5_PASSWORD'] = os.getenv('MT5_PASSWORD', '')
    app.config['MT5_SERVER'] = os.getenv('MT5_SERVER', '')
    app.config['FLASK_PORT'] = int(os.getenv('FLASK_PORT', 5001))

    # Register blueprints
    from app.routes import indicators_bp
    app.register_blueprint(indicators_bp)

    @app.route('/api/health')
    def health() -> Dict[str, Any]:
        """Health check endpoint"""
        return {
            'status': 'ok',
            'message': 'MT5 service running',
            'version': '5.0.0'
        }

    return app
