"""
Flask MT5 Service - Main Application Package

Initializes MT5 connection pool on startup with health monitoring.

Reference: docs/flask-multi-mt5-implementation.md Section 5
"""

import atexit
import logging
import os

from flask import Flask
from flask_cors import CORS

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)

logger = logging.getLogger(__name__)


def create_app(config_path: str = 'config/mt5_terminals.json') -> Flask:
    """
    Application factory pattern for Flask MT5 service.

    Initializes MT5 connection pool and starts health monitoring.

    Args:
        config_path: Path to terminal configuration file

    Returns:
        Flask: Configured Flask application instance
    """
    app = Flask(__name__)

    # Configure CORS from environment variable or use defaults
    cors_origins_env = os.getenv('CORS_ORIGINS', '')
    if cors_origins_env:
        # Parse comma-separated origins from environment
        cors_origins = [origin.strip() for origin in cors_origins_env.split(',')]
    else:
        # Default origins for development
        cors_origins = [
            'http://localhost:3000',
            'https://*.vercel.app'
        ]

    CORS(app, origins=cors_origins, supports_credentials=True)

    # Load config from environment
    app.config['MT5_CONFIG_PATH'] = os.getenv('MT5_CONFIG_PATH', config_path)
    app.config['FLASK_PORT'] = int(os.getenv('FLASK_PORT', 5001))
    app.config['MT5_API_KEY'] = os.getenv('MT5_API_KEY', '')
    app.config['MT5_ADMIN_API_KEY'] = os.getenv('MT5_ADMIN_API_KEY', '')
    app.config['HEALTH_CHECK_INTERVAL'] = int(
        os.getenv('HEALTH_CHECK_INTERVAL', 60)
    )

    # Initialize MT5 connection pool
    logger.info("Initializing MT5 connection pool...")
    try:
        from app.services.mt5_connection_pool import init_connection_pool
        init_connection_pool(app.config['MT5_CONFIG_PATH'])
    except FileNotFoundError:
        logger.warning(
            f"Config file not found: {app.config['MT5_CONFIG_PATH']}. "
            "Connection pool not initialized."
        )
    except Exception as e:
        logger.error(f"Failed to initialize connection pool: {e}")

    # Start health monitor
    logger.info("Starting health monitor...")
    try:
        from app.services.health_monitor import start_health_monitor
        start_health_monitor(app.config['HEALTH_CHECK_INTERVAL'])
    except Exception as e:
        logger.error(f"Failed to start health monitor: {e}")

    # Register blueprints
    from app.routes import admin_bp, indicators_bp
    app.register_blueprint(indicators_bp)
    app.register_blueprint(admin_bp)

    # Register shutdown handler
    @atexit.register
    def cleanup():
        """Clean up resources on shutdown."""
        logger.info("Shutting down MT5 service...")
        try:
            from app.services.health_monitor import stop_health_monitor
            stop_health_monitor()
        except Exception as e:
            logger.error(f"Error stopping health monitor: {e}")

        try:
            from app.services.mt5_connection_pool import shutdown_connection_pool
            shutdown_connection_pool()
        except Exception as e:
            logger.error(f"Error shutting down connection pool: {e}")

        logger.info("MT5 service shutdown complete")

    logger.info("Flask application initialized successfully")

    return app
