# Flask → Redis price publisher (for the Phase 4 alert worker)

The Node alert worker (`scripts/alert-worker.ts`) listens on the Redis channel
`prices:{symbol}:{timeframe}`. The Flask MT5 service already pushes
`ohlcv_update` over Socket.IO in `app/websocket.py`; publish the same bar to
Redis right next to that emit.

## 1. Dependency

Add to `mt5-service/requirements.txt`:

```
redis==5.0.1
```

## 2. Client (e.g. in `app/__init__.py` or a small `app/redis_pub.py`)

```python
import os, redis
_redis_url = os.environ.get("REDIS_URL")
redis_pub = redis.from_url(_redis_url) if _redis_url else None
```

## 3. Publish beside the existing `socketio.emit('ohlcv_update', ...)`

In `app/websocket.py`, where the new bar / tick is detected:

```python
# existing:
socketio.emit('ohlcv_update', {...}, room=room)

# add (best-effort — never block the feed):
if redis_pub is not None:
    try:
        last_bar = ohlcv_bars[-1] if ohlcv_bars else {}
        redis_pub.publish(
            f"prices:{symbol}:{timeframe}",
            json.dumps({
                "symbol": symbol,
                "timeframe": timeframe,
                "time": int(current_timestamp),
                "open":  last_bar.get("open", current_close),
                "high":  last_bar.get("high", current_close),
                "low":   last_bar.get("low",  current_close),
                "close": current_close,
                "final": current_timestamp > last_timestamp,  # new bar => closed prior
            })
        )
    except Exception as e:
        logger.error(f"redis publish failed: {e}")
```

The payload shape must match the Node `PriceEvent` interface
(`lib/alert-engine/types.ts`): `{ symbol, timeframe, time, open, high, low,
close, final }`.

## Alternative (no Flask change)

The worker can instead DB-tail new `MarketData` rows. Higher latency (= sync
cadence) but requires no producer change. Pub/sub is preferred.
