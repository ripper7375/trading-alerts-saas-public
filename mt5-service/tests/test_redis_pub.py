"""
Tests for app/redis_pub.py — the Flask -> Redis price publisher that feeds
lib/alert-engine/worker.ts (Node). No real Redis server is required: redis_pub
is mocked, matching this test suite's existing MockMT5-style convention of
testing against mocked externals rather than live services.
"""
import importlib
import json
from unittest.mock import MagicMock, patch


def _reload_with_env(monkeypatch, redis_url):
    """Reload app.redis_pub with REDIS_URL set (or unset) before import-time init runs."""
    if redis_url is None:
        monkeypatch.delenv("REDIS_URL", raising=False)
    else:
        monkeypatch.setenv("REDIS_URL", redis_url)
    import app.redis_pub as redis_pub_module
    importlib.reload(redis_pub_module)
    return redis_pub_module


def test_no_redis_url_disables_publishing_without_raising(monkeypatch):
    module = _reload_with_env(monkeypatch, None)
    assert module.redis_pub is None

    # Must be a safe no-op, not an exception, when REDIS_URL is unset.
    module.publish_price_event(
        "XAUUSD", "M5",
        current_timestamp=1000, current_close=2380.5,
        last_timestamp=700, last_bar={"open": 2380.0, "high": 2381.0, "low": 2379.5},
    )


def test_publishes_price_event_matching_price_event_shape(monkeypatch):
    with patch("redis.from_url") as mock_from_url:
        mock_client = MagicMock()
        mock_from_url.return_value = mock_client

        module = _reload_with_env(monkeypatch, "redis://localhost:6379")
        assert module.redis_pub is mock_client

        module.publish_price_event(
            "XAUUSD", "M5",
            current_timestamp=1751500800, current_close=2382.77,
            last_timestamp=1751500500,
            last_bar={"open": 2382.14, "high": 2383.02, "low": 2381.55, "close": 2382.77},
        )

        mock_client.publish.assert_called_once()
        channel, payload = mock_client.publish.call_args[0]
        assert channel == "prices:XAUUSD:M5"

        # Must match lib/alert-engine/types.ts's PriceEvent exactly.
        parsed = json.loads(payload)
        assert set(parsed.keys()) == {
            "symbol", "timeframe", "time", "open", "high", "low", "close", "final",
        }
        assert parsed["symbol"] == "XAUUSD"
        assert parsed["timeframe"] == "M5"
        assert parsed["time"] == 1751500800
        assert parsed["open"] == 2382.14
        assert parsed["high"] == 2383.02
        assert parsed["low"] == 2381.55
        assert parsed["close"] == 2382.77
        assert parsed["final"] is True  # current_timestamp > last_timestamp


def test_publish_failure_is_swallowed_not_raised(monkeypatch):
    with patch("redis.from_url") as mock_from_url:
        mock_client = MagicMock()
        mock_client.publish.side_effect = ConnectionError("redis unreachable")
        mock_from_url.return_value = mock_client

        module = _reload_with_env(monkeypatch, "redis://localhost:6379")

        # Must not raise — a Redis outage must never break the live Socket.IO feed.
        module.publish_price_event(
            "XAUUSD", "M5", current_timestamp=1000, current_close=2380.5,
            last_timestamp=700, last_bar={},
        )
