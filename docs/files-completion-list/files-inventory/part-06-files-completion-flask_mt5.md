# Part 6: Flask MT5 Service - List of Files Completion

**Last Updated:** 2026-08-04
**Status:** ✅ Complete (100%)

---

## 📋 Files Built in Part 06

### Root Configuration & Build Files (5 files)

**File 1/33:** ✅ `mt5-service/.env.example`

- **Status:** Complete
- **Description:** Environment variables template (includes MT5 login credentials, Redis host/port, and `ALERT_PUBLISH_ROOMS`)

**File 2/33:** ✅ `mt5-service/Dockerfile`

- **Status:** Complete
- **Description:** Docker container configuration running Wine + MetaTrader 5 + Python microservice

**File 3/33:** ✅ `mt5-service/requirements.txt`

- **Status:** Complete
- **Description:** Production Python dependencies (Flask, flask-socketio, MetaTrader5, redis, eventlet)

**File 4/33:** ✅ `mt5-service/requirements-dev.txt`

- **Status:** Complete
- **Description:** Development and testing Python dependencies (pytest, pytest-cov, mock)

**File 5/33:** ✅ `mt5-service/run.py`

- **Status:** Complete
- **Description:** Application entry point initializing eventlet and launching Flask-SocketIO server

---

### Application Source Code (`mt5-service/app/`, 14 files)

**File 6/33:** ✅ `mt5-service/app/__init__.py`

- **Status:** Complete
- **Description:** Flask app factory (`create_app`), blueprint registration, Socket.IO initialization, and Redis publisher startup

**File 7/33:** ✅ `mt5-service/app/redis_pub.py`

- **Status:** Complete
- **Description:** Best-effort Redis publisher publishing OHLCV price events to channel `prices:{symbol}:{timeframe}` feeding Next.js line-touch alert engine

**File 8/33:** ✅ `mt5-service/app/websocket.py`

- **Status:** Complete
- **Description:** Socket.IO real-time OHLCV streaming server (0.25s background polling loop, intra-bar tick change detection, `ALERT_PUBLISH_ROOMS` support)

**File 9/33:** ✅ `mt5-service/app/routes/__init__.py`

- **Status:** Complete
- **Description:** Routes package initializer

**File 10/33:** ✅ `mt5-service/app/routes/admin.py`

- **Status:** Complete
- **Description:** Admin monitoring & management API endpoints (`/api/admin/*`)

**File 11/33:** ✅ `mt5-service/app/routes/indicators.py`

- **Status:** Complete
- **Description:** OHLCV candlestick data API endpoints (`/api/indicators/*`)

**File 12/33:** ✅ `mt5-service/app/services/__init__.py`

- **Status:** Complete
- **Description:** Services package initializer

**File 13/33:** ✅ `mt5-service/app/services/health_monitor.py`

- **Status:** Complete
- **Description:** Background terminal health monitoring & connection recovery service

**File 14/33:** ✅ `mt5-service/app/services/indicator_reader.py`

- **Status:** Complete
- **Description:** MT5 OHLCV data reader service fetching candles using `copy_rates_from_pos()`

**File 15/33:** ✅ `mt5-service/app/services/mt5_connection_pool.py`

- **Status:** Complete
- **Description:** Multi-terminal MT5 connection pool manager for terminal routing and connection lifecycle

**File 16/33:** ✅ `mt5-service/app/services/tier_service.py`

- **Status:** Complete
- **Description:** Tier validation service enforcing symbol and timeframe restrictions

**File 17/33:** ✅ `mt5-service/app/utils/__init__.py`

- **Status:** Complete
- **Description:** Utils package initializer

**File 18/33:** ✅ `mt5-service/app/utils/constants.py`

- **Status:** Complete
- **Description:** Constants module for symbols, timeframes, and tier configurations

**File 19/33:** ✅ `mt5-service/app/utils/symbol_resolver.py`

- **Status:** Complete
- **Description:** Broker-specific symbol name resolution (e.g. Eightcap `.i` suffix handling)

---

### Configuration & Documentation (5 files)

**File 20/33:** ✅ `mt5-service/config/mt5_terminals.json`

- **Status:** Complete
- **Description:** Production MT5 terminal configuration mapping

**File 21/33:** ✅ `mt5-service/config/mt5_terminals_test.json`

- **Status:** Complete
- **Description:** Test environment MT5 terminal configuration mapping

**File 22/33:** ✅ `mt5-service/indicators/README.md`

- **Status:** Complete
- **Description:** Technical documentation explaining the OHLCV-only architecture

**File 23/33:** ✅ `mt5-service/docs/symbol-resolution.md`

- **Status:** Complete
- **Description:** Comprehensive symbol resolution architecture guide

**File 24/33:** ✅ `mt5-service/REDIS-PUBLISH-SNIPPET.md`

- **Status:** Complete
- **Description:** Reference snippet and documentation for Redis publishing integration

---

### Test Suite (`mt5-service/tests/`, 8 files)

**File 25/33:** ✅ `mt5-service/tests/conftest.py`

- **Status:** Complete
- **Description:** Pytest test fixtures and configuration

**File 26/33:** ✅ `mt5-service/tests/mock_mt5_server.py`

- **Status:** Complete
- **Description:** Mock MT5 server for integration testing without a live Windows MT5 environment

**File 27/33:** ✅ `mt5-service/tests/mt5-mock-server-integration-tests-implementation.md`

- **Status:** Complete
- **Description:** Documentation and implementation guide for mock server integration tests

**File 28/33:** ✅ `mt5-service/tests/test_connection_pool.py`

- **Status:** Complete
- **Description:** Unit tests for connection pool and multi-terminal management

**File 29/33:** ✅ `mt5-service/tests/test_indicators.py`

- **Status:** Complete
- **Description:** Unit tests for indicator/OHLCV route handlers

**File 30/33:** ✅ `mt5-service/tests/test_mt5_integration.py`

- **Status:** Complete
- **Description:** Integration tests running against the mock MT5 server

**File 31/33:** ✅ `mt5-service/tests/test_redis_pub.py`

- **Status:** Complete
- **Description:** Unit tests for best-effort Redis publishing logic

**File 32/33:** ✅ `mt5-service/tests/test_symbol_resolver.py`

- **Status:** Complete
- **Description:** Unit tests for symbol resolver and broker suffix handling

---

### Part Documentation (1 file)

**File 33/33:** ✅ `docs/open-api-documents/part-06-flask_mt5_openapi.yaml`

- **Status:** Complete
- **Description:** Complete OpenAPI 3.0.3 specification for Flask MT5 Microservice API

---

## 📊 Status Summary

- **Total Production Files:** 33/33 (100%)
- **Microservice Files (`mt5-service/`):** 32 files (5 build/config + 14 app + 5 config/docs + 8 tests)
- **Documentation (`docs/`):** 1 file (`part-06-flask_mt5_openapi.yaml`)
- **Architecture:** Raw OHLCV data microservice with Socket.IO & Redis streaming

---

## 🎯 Architectural Principles & Key Features

### 1. OHLCV-Only Data Service

- Fetches raw OHLCV candlestick data via MetaTrader 5 Python API (`copy_rates_from_pos()`).
- Does NOT calculate custom indicators or run custom MT5 indicator buffers (custom indicators are handled via MQL5 EA exports / Part 20 pipeline or client-side calculation).

### 2. High-Frequency Real-Time Streaming

- **WebSocket Streaming:** Real-time Socket.IO streaming (`flask-socketio` + `eventlet`).
- **0.25s Polling Loop:** Background thread checks for timestamp advancement or intra-bar close price tick updates every 250ms per active room.
- **On-Demand Subscription Rooms:** Rooms are created dynamically when client tabs view a chart, consuming zero resources when idle.

### 3. Redis Alert Engine Publisher (`ALERT_PUBLISH_ROOMS`)

- Publishes best-effort price events to Redis channel `prices:{symbol}:{timeframe}` (`lib/auth`/`lib/alert-engine`).
- When `ALERT_PUBLISH_ROOMS` is configured in `.env`, price publishing runs continuously for line-touch alert evaluation even if no browser tabs are connected.

### 4. Multi-Terminal Connection Pooling & Fault Isolation

- Multi-terminal connection pool (`mt5_connection_pool.py`) manages MT5 terminal instances.
- Multi-terminal architecture distributes load across terminals and provides fault isolation.
- `health_monitor.py` automatically detects disconnected terminals and triggers reconnection routines.

### 5. Broker Symbol Resolution

- `symbol_resolver.py` dynamically resolves generic symbol names (e.g. `XAUUSD`) to broker-specific symbols (e.g. Eightcap `XAUUSD.i`).

---

## 🔗 Related Documentation

- **Microservice Entry Point:** `mt5-service/run.py`
- **Socket.IO Streaming Server:** `mt5-service/app/websocket.py`
- **Redis Publisher:** `mt5-service/app/redis_pub.py`
- **Symbol Resolver Guide:** `mt5-service/docs/symbol-resolution.md`
- **OpenAPI Specification:** `docs/open-api-documents/part-06-flask_mt5_openapi.yaml`

---

**Part 06 Status:** ✅ Complete and production-ready
