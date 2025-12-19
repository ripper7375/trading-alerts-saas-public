# Part 6: Flask MT5 Service - Build Order

**From:** `docs/v5-structure-division.md` Part 6
**Total Files:** 19 files
**Estimated Time:** 6 hours
**Priority:** ⭐⭐⭐ High (Core data provider)
**Complexity:** High

---

## Overview

**Scope:** Complete Flask microservice for MT5 data retrieval with **multi-terminal connection pooling**, tier validation, indicator processing, health monitoring, and Docker deployment.

**Implementation Guide References:**

- `docs/flask-multi-mt5-implementation.md` - **PRIMARY**: Complete multi-terminal architecture implementation (connection pool, symbol routing, health monitoring)
- `docs/flask_mt5_openapi.yaml` - API contract specification (endpoints, schemas, responses)
- `docs/implementation-guides/v5_part_e.md` Section 8 - MT5 integration and data retrieval specifications

**Key Changes from V4:**

- ✅ NEW: **Multi-terminal architecture** - 15 MT5 connections (one per symbol)
- ✅ NEW: `mt5_connection_pool.py` for connection pool management
- ✅ NEW: `indicator_reader.py` for thread-safe indicator buffer reading
- ✅ NEW: `health_monitor.py` for background connection monitoring
- ✅ NEW: `config/mt5_terminals.json` for terminal configuration
- ✅ NEW: `tier_service.py` for tier validation
- ✅ NEW: Admin endpoints for terminal management
- ✅ Updated timeframe mapping: M5, H12 added (9 total timeframes)
- ✅ Tier validation for BOTH symbols AND timeframes before reading indicators
- ✅ FREE tier: 5 symbols × 3 timeframes
- ✅ PRO tier: 15 symbols × 9 timeframes
- ✅ 5 new symbols: AUDJPY, GBPJPY, NZDUSD, USDCAD, USDCHF

**Architecture:**

```
Flask Service
    ↓
MT5ConnectionPool (manages 15 connections)
    ↓
SymbolRouter (routes requests to correct MT5)
    ↓
MT5_01...MT5_15 (individual terminals)
```

**Why Multi-Terminal:**

- PRO tier requires 135 chart combinations (15 symbols × 9 timeframes)
- Single MT5 cannot efficiently handle 135 chart windows
- Solution: 15 terminals × 9 charts each = distributed load
- Fault isolation: if one terminal fails, others continue working

**Dependencies:**

- Part 4 complete (Tier constants for validation logic)
- 15 MT5 terminals running with indicators installed

**Integration Points:**

- Provides indicator data for Next.js frontend
- Called by `/api/indicators` routes
- Validates tier access before data retrieval
- Health status available at `/api/health`

**Seed Code Reference:**

- `seed-code/market_ai_engine.py` - Market AI engine logic and patterns for data processing

---

## File Build Order

### Phase A: Configuration Files (2 files)

**File 1/19:** `mt5-service/config/mt5_terminals.json`

- Terminal configuration for all 15 MT5 instances
- Symbol-to-terminal mapping (MT5_01 → AUDJPY, MT5_02 → AUDUSD, etc.)
- Server, login, password placeholders (use env vars in production)
- Reference: `flask-multi-mt5-implementation.md` Section 1
- Commit: `feat(mt5): add terminal configuration`

**File 2/19:** `mt5-service/app/utils/constants.py`

- TIMEFRAME_MAP (9 timeframes: M5, M15, M30, H1, H2, H4, H8, H12, D1)
- SYMBOL_MAP (15 symbols)
- FREE_TIER_SYMBOLS (5 symbols: BTCUSD, EURUSD, USDJPY, US30, XAUUSD)
- PRO_TIER_SYMBOLS (15 symbols)
- FREE_TIER_TIMEFRAMES (3: H1, H4, D1)
- PRO_TIER_TIMEFRAMES (9: all)
- MT5_AVAILABLE flag
- Commit: `feat(mt5): add constants for tier system`

### Phase B: Core Connection Pool (3 files)

**File 3/19:** `mt5-service/app/services/__init__.py`

- Service exports (connection_pool, tier_service, indicator_reader)
- Commit: `feat(mt5): add services init`

**File 4/19:** `mt5-service/app/services/mt5_connection_pool.py`

- `MT5Connection` class - single terminal connection with thread-safe locks
- `MT5ConnectionPool` class - manages all 15 connections
- `connect()`, `disconnect()`, `check_connection()`, `reconnect()` methods
- `get_connection_by_symbol(symbol)` - symbol-to-terminal routing
- `connect_all()`, `disconnect_all()` - bulk operations
- `get_health_summary()` - overall status (ok/degraded/error)
- `auto_reconnect_failed()` - reconnect failed terminals
- Global singleton: `get_connection_pool()`, `init_connection_pool()`, `shutdown_connection_pool()`
- Reference: `flask-multi-mt5-implementation.md` Section 2
- Commit: `feat(mt5): add MT5 connection pool manager`

**File 5/19:** `mt5-service/app/services/tier_service.py`

- `validate_symbol_access(symbol, tier)` → bool
- `validate_timeframe_access(timeframe, tier)` → bool
- `validate_chart_access(symbol, timeframe, tier)` → (bool, error_message)
- `get_accessible_symbols(tier)` → list
- `get_accessible_timeframes(tier)` → list
- Mirrors Next.js tier validation logic
- Commit: `feat(mt5): add tier validation service`

### Phase C: Indicator Data Reading (1 file)

**File 6/19:** `mt5-service/app/services/indicator_reader.py`

- `fetch_indicator_data(connection, symbol, timeframe, bars)` - main entry point
- `fetch_horizontal_lines(symbol, timeframe, bars)` - buffers 4-9 from Fractal Horizontal Line_V5
- `fetch_diagonal_lines(symbol, timeframe, bars)` - buffers 0-5 from Fractal Diagonal Line_V4
- `fetch_fractals(symbol, timeframe, bars)` - buffers 0-1 (peaks/bottoms)
- `buffer_to_line_points(buffer)` - filter EMPTY_VALUE, convert to JSON
- Thread-safe using connection.lock
- Reference: `flask-multi-mt5-implementation.md` Section 4
- Commit: `feat(mt5): add indicator data reader`

### Phase D: Health Monitoring (1 file)

**File 7/19:** `mt5-service/app/services/health_monitor.py`

- `HealthMonitor` class (threading.Thread daemon)
- Configurable check interval (default: 60 seconds)
- Auto-reconnect failed terminals
- `start_health_monitor()`, `stop_health_monitor()` functions
- Reference: `flask-multi-mt5-implementation.md` Section 6
- Commit: `feat(mt5): add background health monitor`

### Phase E: Flask Routes (3 files)

**File 8/19:** `mt5-service/app/routes/__init__.py`

- Blueprint registration (indicators_bp, admin_bp)
- Commit: `feat(mt5): add routes init`

**File 9/19:** `mt5-service/app/routes/indicators.py`

- `GET /api/indicators/<symbol>/<timeframe>` - main data endpoint
  - Tier validation before data retrieval
  - Get connection from pool by symbol
  - Return OHLC + horizontal + diagonal + fractals
  - Include terminal_id in metadata
- `GET /api/health` - health check (no auth required)
  - Returns status (ok/degraded/error)
  - Returns per-terminal connection status
- `GET /api/symbols` - get accessible symbols by tier
- `GET /api/timeframes` - get accessible timeframes by tier
- Reference: `flask-multi-mt5-implementation.md` Section 3
- Commit: `feat(mt5): add indicators route with tier validation`

**File 10/19:** `mt5-service/app/routes/admin.py`

- `GET /api/admin/terminals/health` - detailed health with metrics (admin-only)
- `POST /api/admin/terminals/<terminal_id>/restart` - restart specific terminal
- `POST /api/admin/terminals/restart-all` - restart all terminals (use with caution)
- `GET /api/admin/terminals/<terminal_id>/logs` - get terminal logs
- `GET /api/admin/terminals/stats` - aggregate statistics
- Requires X-Admin-API-Key header
- Reference: `flask_mt5_openapi.yaml` Admin endpoints
- Commit: `feat(mt5): add admin routes for terminal management`

### Phase F: Application Factory (2 files)

**File 11/19:** `mt5-service/app/__init__.py`

- `create_app(config_path)` factory function
- Initialize MT5 connection pool on startup
- Start health monitor
- Register blueprints (indicators_bp, admin_bp)
- Register shutdown handler (atexit) for cleanup
- Reference: `flask-multi-mt5-implementation.md` Section 5
- Commit: `feat(mt5): initialize Flask application with connection pool`

**File 12/19:** `mt5-service/app/utils/__init__.py`

- Utils exports
- Commit: `feat(mt5): add utils init`

### Phase G: Configuration & Deployment (5 files)

**File 13/19:** `mt5-service/requirements.txt`

- Flask==3.0.0
- Flask-CORS==4.0.0
- python-dotenv==1.0.0
- MetaTrader5==5.0.45
- pandas>=2.0.0
- Commit: `feat(mt5): add Python dependencies`

**File 14/19:** `mt5-service/run.py`

- Flask app entry point
- Run on port 5001
- Reference: `flask-multi-mt5-implementation.md` Section 5
- Commit: `feat(mt5): add Flask entry point`

**File 15/19:** `mt5-service/.env.example`

- MT5_CONFIG_PATH=config/mt5_terminals.json
- FLASK_PORT=5001
- MT5_API_KEY=your-api-key
- MT5_ADMIN_API_KEY=your-admin-api-key
- HEALTH_CHECK_INTERVAL=60
- Commit: `feat(mt5): add environment variables template`

**File 16/19:** `mt5-service/Dockerfile`

- Python 3.11 base image
- Install dependencies
- Copy config and app
- Run Flask app
- Commit: `feat(mt5): add Dockerfile`

**File 17/19:** `mt5-service/.dockerignore`

- **pycache**
- \*.pyc
- .env
- Commit: `feat(mt5): add dockerignore`

### Phase H: Testing & Documentation (2 files)

**File 18/19:** `mt5-service/tests/test_connection_pool.py`

- Test connection pool initialization
- Test symbol routing
- Test health check
- Test reconnection
- Test tier validation
- Reference: `flask-multi-mt5-implementation.md` Section 7
- Commit: `test(mt5): add connection pool tests`

**File 19/19:** `mt5-service/indicators/README.md`

- List installed indicators (Fractal Horizontal Line_V5, Fractal Diagonal Line_V4)
- Installation instructions per terminal
- Buffer mappings
- File paths
- Commit: `docs(mt5): add indicators README`

---

## Testing After Part Complete

1. **Test Connection Pool (without MT5)**

   ```bash
   cd mt5-service
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   python tests/test_connection_pool.py
   ```

2. **Start Flask Service**

   ```bash
   python run.py
   ```

3. **Test Health Endpoint**

   ```bash
   # Check all terminal status
   curl http://localhost:5001/api/health

   # Expected response:
   # {
   #   "status": "ok",
   #   "version": "v5.0.0",
   #   "total_terminals": 15,
   #   "connected_terminals": 15,
   #   "terminals": { ... }
   # }
   ```

4. **Test Indicator Endpoint**

   ```bash
   # Test FREE tier symbol
   curl -H "X-User-Tier: FREE" http://localhost:5001/api/indicators/XAUUSD/H1

   # Test PRO-only symbol
   curl -H "X-User-Tier: PRO" http://localhost:5001/api/indicators/GBPUSD/H1

   # Test FREE tier with PRO-only symbol (should fail with 403)
   curl -H "X-User-Tier: FREE" http://localhost:5001/api/indicators/GBPUSD/H1

   # Test FREE tier with PRO-only timeframe (should fail with 403)
   curl -H "X-User-Tier: FREE" http://localhost:5001/api/indicators/XAUUSD/M5
   ```

5. **Test Symbols/Timeframes Endpoints**

   ```bash
   curl -H "X-User-Tier: FREE" http://localhost:5001/api/symbols
   curl -H "X-User-Tier: PRO" http://localhost:5001/api/symbols
   curl -H "X-User-Tier: FREE" http://localhost:5001/api/timeframes
   curl -H "X-User-Tier: PRO" http://localhost:5001/api/timeframes
   ```

6. **Test Admin Endpoints**

   ```bash
   # Get detailed health (admin only)
   curl -H "X-Admin-API-Key: your-admin-key" http://localhost:5001/api/admin/terminals/health

   # Restart specific terminal
   curl -X POST -H "X-Admin-API-Key: your-admin-key" http://localhost:5001/api/admin/terminals/MT5_15/restart

   # Get terminal stats
   curl -H "X-Admin-API-Key: your-admin-key" http://localhost:5001/api/admin/terminals/stats
   ```

---

## Success Criteria

- ✅ All 19 files created
- ✅ Flask service starts without errors
- ✅ Connection pool initializes all 15 terminals
- ✅ Health endpoint shows terminal status (ok/degraded/error)
- ✅ Symbol routing works (requests go to correct terminal)
- ✅ Tier validation works (FREE: 5 symbols × 3 timeframes, PRO: 15 × 9)
- ✅ Indicator data retrieved successfully with terminal_id in metadata
- ✅ Health monitor runs in background and auto-reconnects failed terminals
- ✅ Admin endpoints work with proper authentication
- ✅ Docker image builds successfully
- ✅ PROGRESS.md updated

---

## Next Steps

- Ready for Part 7: Indicators API (Next.js routes that call this service)
- Ready for Part 9: Charts (uses indicator data)

---

## Escalation Scenarios

**Scenario 1: Single terminal connection fails**

- Check specific terminal in health endpoint
- Use admin restart endpoint for that terminal
- Health monitor will auto-reconnect within 60 seconds

**Scenario 2: All terminals disconnected**

- Health endpoint returns status: "error"
- Check MT5 broker server status
- Verify credentials in mt5_terminals.json
- Use admin restart-all endpoint

**Scenario 3: Indicator files not found**

- Check indicator installation on specific terminal
- Verify indicator is attached to chart in MT5
- Check buffer indices match documentation

**Scenario 4: Thread-safety issues**

- Connection pool uses threading.Lock per connection
- Indicator reader acquires lock before MT5 operations
- Check logs for deadlock warnings

---

## File Migration Notes

If rebuilding from existing Part 6 code:

| Old File                      | Action   | New File                                                                   |
| ----------------------------- | -------- | -------------------------------------------------------------------------- |
| `app/services/mt5_service.py` | REPLACE  | `app/services/mt5_connection_pool.py` + `app/services/indicator_reader.py` |
| `app/__init__.py`             | REFACTOR | Add connection pool init, health monitor                                   |
| `app/routes/indicators.py`    | REFACTOR | Use pool.get_connection_by_symbol()                                        |
| (none)                        | ADD      | `app/services/health_monitor.py`                                           |
| (none)                        | ADD      | `app/routes/admin.py`                                                      |
| (none)                        | ADD      | `config/mt5_terminals.json`                                                |

---

**Last Updated:** 2025-12-11
**Alignment:** (E) Phase 3 → (B) Part 6 → (C) This file
