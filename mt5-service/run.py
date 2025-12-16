"""
Flask MT5 Service - Application Entry Point

Starts the Flask development server on port 5001.
"""

import os
from dotenv import load_dotenv
from app import create_app

# Load environment variables from .env
load_dotenv()

# Create Flask app
app = create_app()

if __name__ == '__main__':
    # Get port from environment or default to 5001
    port = int(os.getenv('FLASK_PORT', 5001))
    debug = os.getenv('FLASK_ENV', 'development') == 'development'

    print(f"🚀 Starting Flask MT5 Service on port {port}")
    print(f"📊 Debug mode: {debug}")
    print(f"🔗 Health check: http://localhost:{port}/api/health")

    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug
    )
