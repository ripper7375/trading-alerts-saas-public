"""
Flask MT5 Service - Application Entry Point

Starts the Flask development server with WebSocket support on port 5001.
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
    print(f"🔌 WebSocket: ws://localhost:{port}/socket.io")

    # Use SocketIO's run method for WebSocket support
    if hasattr(app, 'socketio') and app.socketio:
        print(f"✅ WebSocket server enabled")
        app.socketio.run(
            app,
            host='0.0.0.0',
            port=port,
            debug=debug,
            use_reloader=debug,
            log_output=debug
        )
    else:
        print(f"⚠️  WebSocket server not initialized, running without WebSocket")
        app.run(
            host='0.0.0.0',
            port=port,
            debug=debug
        )
