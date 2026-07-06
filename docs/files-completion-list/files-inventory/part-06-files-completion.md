# Part 6: Flask MT5 Service - List of files completion

## Root Configuration Files (5 files)

**File 1/29:** ✅ `mt5-service/.env.example` - Environment variables template
**File 2/29:** ✅ `mt5-service/Dockerfile` - Docker container configuration
**File 3/29:** ✅ `mt5-service/requirements.txt` - Production dependencies
**File 4/29:** ✅ `mt5-service/requirements-dev.txt` - Development/test dependencies
**File 5/29:** ✅ `mt5-service/run.py` - Application entry point

## Application Code (12 files)

**File 6/29:** ✅ `mt5-service/app/__init__.py` - Flask app factory (create*app)
**File 7/29:** ✅ `mt5-service/app/websocket.py` - WebSocket support for real-time OHLCV streaming
**File 8/29:** ✅ `mt5-service/app/routes/__init__.py` - Routes package init
**File 9/29:** ✅ `mt5-service/app/routes/admin.py` - Admin endpoints (/api/admin/*)
**File 10/29:** ✅ `mt5-service/app/routes/indicators.py` - Indicator endpoints (/api/indicators/\_)
**File 11/29:** ✅ `mt5-service/app/services/__init__.py` - Services package init
**File 12/29:** ✅ `mt5-service/app/services/health_monitor.py` - Background health monitoring
**File 13/29:** ✅ `mt5-service/app/services/indicator_reader.py` - MT5 OHLCV data reading (indicator support removed)
**File 14/29:** ✅ `mt5-service/app/services/mt5_connection_pool.py` - Multi-terminal connection pool
**File 15/29:** ✅ `mt5-service/app/services/tier_service.py` - FREE/PRO tier validation
**File 16/29:** ✅ `mt5-service/app/utils/__init__.py` - Utils package init
**File 17/29:** ✅ `mt5-service/app/utils/constants.py` - Tier symbols/timeframes constants
**File 18/29:** ✅ `mt5-service/app/utils/symbol_resolver.py` - Broker-specific symbol name resolution (handles Eightcap .i suffix)

## Configuration & Documentation (4 files)

**File 19/29:** ✅ `mt5-service/config/mt5_terminals.json` - MT5 terminal configurations
**File 20/29:** ✅ `mt5-service/config/mt5_terminals_test.json` - Test MT5 terminal configurations
**File 21/29:** ✅ `mt5-service/indicators/README.md` - Custom indicators documentation
**File 22/29:** ✅ `mt5-service/docs/symbol-resolution.md` - Symbol resolution guide and architecture

## Tests (7 files)

**File 23/29:** ✅ `mt5-service/tests/conftest.py` - pytest fixtures
**File 24/29:** ✅ `mt5-service/tests/mock_mt5_server.py` - Mock MT5 server for integration testing
**File 25/29:** ✅ `mt5-service/tests/mt5-mock-server-integration-tests-implementation.md` - Mock server test documentation
**File 26/29:** ✅ `mt5-service/tests/test_connection_pool.py` - Connection pool & tier tests
**File 27/29:** ✅ `mt5-service/tests/test_indicators.py` - Indicator endpoint tests
**File 28/29:** ✅ `mt5-service/tests/test_mt5_integration.py` - MT5 integration tests with mock server
**File 29/29:** ✅ `mt5-service/tests/test_symbol_resolver.py` - Symbol resolver unit tests

## Status Summary

- **Completed:** 29/29 files (100%)
- **Missing:** None
- **Architecture:** OHLCV-only data service (no custom indicators)
- **Recent Changes (2025-01-15):**
  - ✅ Removed all fractal/trendline references from documentation and tests
  - ✅ Updated `.env.example` to remove fractal indicator setup instructions
  - ✅ Rewrote `indicators/README.md` to explain OHLCV-only architecture
  - ✅ Updated `tests/mock_mt5_server.py` to remove fractal indicators from known list
  - ✅ Updated `tests/test_mt5_integration.py` to remove fractal indicator tests
  - ✅ Part 6 now correctly reflects OHLCV-only data fetching via `copy_rates_from_pos()`
  - ✅ All indicators come from Part 20 (SQLite-Sync) which processes MQL5 exports
- **Recent Changes (2026-03-05):**
  - ✅ `websocket.py` background loop check interval changed from 1s → **0.25s**
  - ✅ Change detection upgraded: now tracks `{timestamp, close}` per room instead of
    only the bar open timestamp — intra-bar close price ticks now trigger `ohlcv_update`
    pushes, so the live candle body updates in real-time as the market moves
  - ✅ Frontend chart components now consume WebSocket (see Part 09) — HTTP polling
    from `trading-chart.tsx` has been removed
- **Key Features:**
  - OHLCV data fetching via MT5 Python API `copy_rates_from_pos()`
  - Symbol resolver for broker-specific naming (Eightcap .i suffix)
  - Real-time WebSocket OHLCV streaming via Socket.IO (flask-socketio + eventlet)
  - Background loop checks every **0.25s** per active subscription room
  - Pushes on new bar open (timestamp advances) **or** intra-bar close tick change
  - Subscription rooms only exist when a browser tab is actively viewing that symbol/timeframe — idle combinations consume zero resources
  - No Redis required for single-instance deployment (eventlet handles concurrent connections)
  - Multi-terminal connection pool (15 symbols across 15 terminals)
  - FREE/PRO tier validation (symbol and timeframe restrictions)
  - Comprehensive test suite with mock MT5 server
- **Why No Custom Indicators:**
  - MT5 Python API's `iCustom()` and `copy_buffer()` are unreliable
  - Fractals and trendlines were calculated incorrectly from OHLCV data
  - Part 20 (SQLite-Sync) provides all indicator data from MQL5 expert advisor exports

## WebSocket Update Frequency (Clarification)

The 0.25s interval is the **change-detection granularity**, not a guaranteed broadcast rate:

| Trigger | What happens |
|---|---|
| New bar opens (timestamp advances) | Push `ohlcv_update` immediately |
| Current bar's close price changes (tick) | Push `ohlcv_update` immediately |
| No price movement | No push — silence is free |

Real-world push frequency depends on market activity:
- Active liquid pairs (EURUSD during London/NY session): multiple pushes per second
- Quiet pairs or off-hours: sparse pushes, possibly minutes apart
- Subscription rooms are only active when a user's browser tab is open on that chart

## Update 2026-07-05 — Cross-stack system audit

- ✅ **`ALERT_PUBLISH_ROOMS` added** (`app/websocket.py`, `app/__init__.py`, `.env.example`):
  optional comma-separated `SYMBOL_TIMEFRAME` list the background loop always polls and
  publishes to Redis, independent of browser subscriptions. Fixes the audit finding that
  line-touch alerts (`lib/alert-engine`) received no price events once the last chart tab
  closed. Default (unset) preserves the original rooms-only behavior. When set, the loop now
  starts at app boot instead of on first subscription, and the connection pool is fetched
  inside the loop so a late-initializing pool retries instead of killing the thread.
- ✅ Confirmed the `redis_pub.py` → `prices:{symbol}:{timeframe}` payload still matches
  `lib/alert-engine/types.ts` `PriceEvent` field-for-field.
- ✅ Confirmed Socket.IO event contract (`subscribe`/`initial_data`/`ohlcv_update`/`error`)
  matches `hooks/use-ohlcv-socket.ts`.
- ℹ️ For `lib/jobs/alert-checker.ts` (Next.js side), its Flask fallback previously targeted a
  nonexistent `/api/mt5/price` route — fixed to use this service's real
  `/api/indicators/{symbol}/{timeframe}` endpoint. No Flask-side change was needed.
