"""
WebSocket Handler for Real-Time MT5 Data Streaming

Provides WebSocket endpoints for real-time indicator data streaming
to Next.js frontend (TradingView charts).

Usage:
    - Client connects to ws://host:5001/socket.io
    - Client subscribes to symbol/timeframe
    - Server pushes updates when MT5 data changes
"""

from flask_socketio import SocketIO, emit, join_room, leave_room, disconnect
from flask import request
from threading import Thread, Lock
import time
import logging
from typing import Dict, Set, Optional

# Will be initialized in __init__.py
socketio = None

# Track active subscriptions
# Format: {'EURUSD_M5': set('sid1', 'sid2'), ...}
subscriptions: Dict[str, Set[str]] = {}
subscriptions_lock = Lock()

# Background thread for pushing updates
update_thread: Optional[Thread] = None
update_thread_started = False

logger = logging.getLogger(__name__)


def init_socketio(app):
    """
    Initialize SocketIO with Flask app

    Args:
        app: Flask application instance
    """
    global socketio

    socketio = SocketIO(
        app,
        cors_allowed_origins="*",  # Allow all origins (configure in production)
        async_mode='eventlet',
        logger=True,
        engineio_logger=False,
        ping_timeout=60,
        ping_interval=25
    )

    logger.info("WebSocket server initialized")

    return socketio


# ============================================================================
# WebSocket Event Handlers
# ============================================================================

def register_handlers(socketio_instance):
    """Register WebSocket event handlers"""

    @socketio_instance.on('connect')
    def handle_connect():
        """Handle client connection"""
        logger.info(f"Client connected: {socketio_instance.server.get_session(request.sid)}")
        emit('connected', {
            'message': 'Connected to MT5 WebSocket server',
            'timestamp': time.time()
        })

    @socketio_instance.on('disconnect')
    def handle_disconnect():
        """Handle client disconnection"""
        logger.info(f"Client disconnected: {request.sid}")

        # Clean up subscriptions for this client
        with subscriptions_lock:
            for room, clients in list(subscriptions.items()):
                if request.sid in clients:
                    clients.remove(request.sid)
                    if len(clients) == 0:
                        del subscriptions[room]
                        logger.info(f"No more subscribers for {room}, removed room")

    @socketio_instance.on('subscribe')
    def handle_subscribe(data):
        """
        Handle subscription to symbol/timeframe

        Args:
            data: {'symbol': 'EURUSD', 'timeframe': 'M5'}
        """
        try:
            symbol = data.get('symbol', '').upper()
            timeframe = data.get('timeframe', '').upper()

            if not symbol or not timeframe:
                emit('error', {'message': 'Missing symbol or timeframe'})
                return

            room = f"{symbol}_{timeframe}"

            # Join room
            join_room(room)

            # Track subscription
            with subscriptions_lock:
                if room not in subscriptions:
                    subscriptions[room] = set()
                subscriptions[room].add(request.sid)

            logger.info(f"Client {request.sid} subscribed to {room}")

            emit('subscribed', {
                'symbol': symbol,
                'timeframe': timeframe,
                'room': room,
                'timestamp': time.time()
            })

            # Start background update thread if not started
            start_update_thread()

            # Send initial data immediately
            send_initial_data(symbol, timeframe, room)

        except Exception as e:
            logger.error(f"Error in subscribe: {e}")
            emit('error', {'message': str(e)})

    @socketio_instance.on('unsubscribe')
    def handle_unsubscribe(data):
        """
        Handle unsubscription from symbol/timeframe

        Args:
            data: {'symbol': 'EURUSD', 'timeframe': 'M5'}
        """
        try:
            symbol = data.get('symbol', '').upper()
            timeframe = data.get('timeframe', '').upper()

            if not symbol or not timeframe:
                emit('error', {'message': 'Missing symbol or timeframe'})
                return

            room = f"{symbol}_{timeframe}"

            # Leave room
            leave_room(room)

            # Remove from subscriptions
            with subscriptions_lock:
                if room in subscriptions and request.sid in subscriptions[room]:
                    subscriptions[room].remove(request.sid)

                    if len(subscriptions[room]) == 0:
                        del subscriptions[room]
                        logger.info(f"No more subscribers for {room}, removed room")

            logger.info(f"Client {request.sid} unsubscribed from {room}")

            emit('unsubscribed', {
                'symbol': symbol,
                'timeframe': timeframe,
                'room': room,
                'timestamp': time.time()
            })

        except Exception as e:
            logger.error(f"Error in unsubscribe: {e}")
            emit('error', {'message': str(e)})

    @socketio_instance.on('ping')
    def handle_ping():
        """Handle ping for connection keep-alive"""
        emit('pong', {'timestamp': time.time()})


# ============================================================================
# Background Update Thread
# ============================================================================

def start_update_thread():
    """Start background thread for pushing MT5 updates"""
    global update_thread, update_thread_started

    if update_thread_started:
        return

    update_thread_started = True
    update_thread = Thread(target=background_update_loop, daemon=True)
    update_thread.start()
    logger.info("Background update thread started")


def background_update_loop():
    """
    Background loop that pushes MT5 data updates to subscribed clients
    Runs every 1 second to check for new data
    """
    from app.services.indicator_reader import fetch_indicator_data

    logger.info("Starting background update loop")

    # Cache last update timestamps to avoid redundant pushes
    last_updates = {}

    while True:
        try:
            with subscriptions_lock:
                active_rooms = list(subscriptions.keys())

            for room in active_rooms:
                try:
                    # Parse room (e.g., 'EURUSD_M5' -> symbol='EURUSD', timeframe='M5')
                    parts = room.split('_')
                    if len(parts) != 2:
                        continue

                    symbol, timeframe = parts

                    # Fetch latest MT5 data
                    data = fetch_indicator_data(symbol, timeframe)

                    if data:
                        # Check if data has changed since last update
                        current_timestamp = data.get('metadata', {}).get('timestamp', 0)
                        last_timestamp = last_updates.get(room, 0)

                        if current_timestamp > last_timestamp:
                            # New data available, push to clients
                            socketio.emit('indicator_update', {
                                'symbol': symbol,
                                'timeframe': timeframe,
                                'data': data,
                                'timestamp': time.time()
                            }, room=room)

                            last_updates[room] = current_timestamp
                            logger.debug(f"Pushed update for {room}")

                except Exception as e:
                    logger.error(f"Error processing room {room}: {e}")

            # Sleep for 1 second before next update cycle
            time.sleep(1)

        except Exception as e:
            logger.error(f"Error in background update loop: {e}")
            time.sleep(5)  # Sleep longer on error


def send_initial_data(symbol: str, timeframe: str, room: str):
    """
    Send initial data immediately upon subscription

    Args:
        symbol: Trading symbol (e.g., 'EURUSD')
        timeframe: Timeframe (e.g., 'M5')
        room: Room name (e.g., 'EURUSD_M5')
    """
    from app.services.indicator_reader import fetch_indicator_data

    try:
        data = fetch_indicator_data(symbol, timeframe)

        if data:
            socketio.emit('initial_data', {
                'symbol': symbol,
                'timeframe': timeframe,
                'data': data,
                'timestamp': time.time()
            }, room=room)

            logger.info(f"Sent initial data for {room}")
        else:
            logger.warning(f"No initial data available for {room}")

    except Exception as e:
        logger.error(f"Error sending initial data for {room}: {e}")


# ============================================================================
# Health Check
# ============================================================================

def get_websocket_status():
    """
    Get WebSocket server status for health checks

    Returns:
        dict: Status information
    """
    with subscriptions_lock:
        active_rooms = list(subscriptions.keys())
        total_clients = sum(len(clients) for clients in subscriptions.values())

    return {
        'active': update_thread_started,
        'rooms': len(active_rooms),
        'clients': total_clients,
        'subscriptions': {room: len(clients) for room, clients in subscriptions.items()}
    }
