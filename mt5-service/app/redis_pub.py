"""
Redis publisher for the Node alert-engine worker.

Publishes each finalized bar/tick to channel prices:{symbol}:{timeframe} so
lib/alert-engine/worker.ts (which psubscribes prices:*) can evaluate
line-touch alerts. Called from app/websocket.py's background_update_loop,
right next to the existing socketio.emit('ohlcv_update', ...) call.

Best-effort by design: any failure here must never break the live Socket.IO
feed to the browser. Payload shape matches lib/alert-engine/types.ts's
PriceEvent exactly (symbol, timeframe, time, open, high, low, close, final).

REDIS_URL absent = feature disabled, not an error — the live chart feed keeps
working either way; only line-touch alerts depend on this.
"""
import json
import logging
import os
from typing import Any, Dict

import redis

logger = logging.getLogger(__name__)

_redis_url = os.environ.get("REDIS_URL")
redis_pub = redis.from_url(_redis_url) if _redis_url else None

if redis_pub is None:
    logger.warning(
        "REDIS_URL not set — price events will NOT be published to Redis; "
        "line-touch alerts cannot fire until this is configured."
    )


def publish_price_event(
    symbol: str,
    timeframe: str,
    current_timestamp: int,
    current_close: float,
    last_timestamp: int,
    last_bar: Dict[str, Any],
) -> None:
    """Best-effort publish — swallows and logs any error, never raises."""
    if redis_pub is None:
        return
    try:
        redis_pub.publish(
            f"prices:{symbol}:{timeframe}",
            json.dumps({
                "symbol": symbol,
                "timeframe": timeframe,
                "time": int(current_timestamp),
                "open": last_bar.get("open", current_close),
                "high": last_bar.get("high", current_close),
                "low": last_bar.get("low", current_close),
                "close": current_close,
                # new bar opened => the prior bar just closed
                "final": current_timestamp > last_timestamp,
            }),
        )
    except Exception as e:
        logger.error(f"redis publish failed for {symbol}_{timeframe}: {e}")
