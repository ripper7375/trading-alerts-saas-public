# Part 6: Flask MT5 Service - Build Order

**From:** `docs/v5-structure-division.md` Part 6
**Total Files:** 15 files
**Estimated Time:** 5 hours
**Priority:** ⭐⭐⭐ High (Core data provider)
**Complexity:** High

---

## Overview

**Scope:** Complete Flask microservice for MT5 data retrieval with tier validation, indicator processing, and Docker deployment.

**Implementation Guide References:**

- `docs/implementation-guides/v5_part_e.md` Section 8 - MT5 integration and data retrieval specifications

**Key Changes from V4:**

- ✅ NEW: `tier_service.py` for tier validation
- ✅ Updated timeframe mapping: M5, H12 added (9 total timeframes)
- ✅ Tier validation for BOTH symbols AND timeframes before reading indicators
- ✅ Tier parameter in all functions
- ✅ FREE tier: 5 symbols × 3 timeframes
- ✅ PRO tier: 15 symbols × 9 timeframes
- ✅ 5 new symbols: AUDJPY, GBPJPY, NZDUSD, USDCAD, USDCHF

**Dependencies:**

- Part 4 complete (Tier constants for validation logic)
- MT5 terminal running with indicators installed

**Integration Points:**

- Provides indicator data for Next.js frontend
- Called by `/api/indicators` routes
- Validates tier access before data retrieval

**Seed Code Reference:**

- `seed-code/market_ai_engine.py` - Market AI engine logic and patterns for data processing

---

## File Build Order

### Python Application Files (8 files)

**File 1/15:** `mt5-service/app/__init__.py`

- Initialize Flask app
- Configure CORS
- Load environment variables
- Commit: `feat(mt5): initialize Flask application`

**File 2/15:** `mt5-service/app/routes/__init__.py`

- Blueprint registration
- Commit: `feat(mt5): add routes init`

**File 3/15:** `mt5-service/app/routes/indicators.py`

- GET /indicators/<symbol>/<timeframe> endpoint
- Tier validation before data retrieval
- Return fractal horizontal/diagonal data
- Commit: `feat(mt5): add indicators route with tier validation`

**File 4/15:** `mt5-service/app/services/__init__.py`

- Service exports
- Commit: `feat(mt5): add services init`

**File 5/15:** `mt5-service/app/services/tier_service.py`

- validateSymbolAccess(symbol, tier)
- validateTimeframeAccess(timeframe, tier)
- validateChartAccess(symbol, timeframe, tier)
- Mirrors Next.js tier validation logic
- Commit: `feat(mt5): add tier validation service`

**File 6/15:** `mt5-service/app/services/mt5_service.py`

- Connect to MT5 terminal
- Read indicator data from files
- Parse fractal horizontal/diagonal lines
- Map timeframes (9 total: M5, M15, M30, H1, H2, H4, H8, H12, D1)
- Return candlestick + indicator data
- Commit: `feat(mt5): add MT5 data service`

**File 7/15:** `mt5-service/app/utils/__init__.py`

- Utils exports
- Commit: `feat(mt5): add utils init`

**File 8/15:** `mt5-service/app/utils/constants.py`

- TIMEFRAME_MAP (9 timeframes)
- SYMBOL_MAP (15 symbols)
- FREE_TIER_SYMBOLS (5 symbols)
- PRO_TIER_SYMBOLS (15 symbols)
- FREE_TIER_TIMEFRAMES (3)
- PRO_TIER_TIMEFRAMES (9)
- Commit: `feat(mt5): add constants for tier system`

### Configuration & Deployment Files (7 files)

**File 9/15:** `mt5-service/requirements.txt`

- Flask==3.0.0
- Flask-CORS==4.0.0
- python-dotenv==1.0.0
- MetaTrader5==5.0.45
- Commit: `feat(mt5): add Python dependencies`

**File 10/15:** `mt5-service/run.py`

- Flask app entry point
- Run on port 5001
- Commit: `feat(mt5): add Flask entry point`

**File 11/15:** `mt5-service/.env.example`

- MT5_TERMINAL_PATH
- MT5_LOGIN
- MT5_PASSWORD
- MT5_SERVER
- FLASK_PORT=5001
- Commit: `feat(mt5): add environment variables template`

**File 12/15:** `mt5-service/Dockerfile`

- Python 3.11 base image
- Install dependencies
- Run Flask app
- Commit: `feat(mt5): add Dockerfile`

**File 13/15:** `mt5-service/.dockerignore`

- **pycache**
- \*.pyc
- .env
- Commit: `feat(mt5): add dockerignore`

**File 14/15:** `mt5-service/tests/test_indicators.py`

- Test tier validation
- Test indicator data retrieval
- Commit: `feat(mt5): add indicator tests`

**File 15/15:** `mt5-service/indicators/README.md`

- List installed indicators
- Installation instructions
- File paths
- Commit: `docs(mt5): add indicators README`

---

## Testing After Part Complete

1. **Start Flask Service**

   ```bash
   cd mt5-service
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   python run.py
   ```

2. **Test Endpoint**

   ```bash
   # Test FREE tier symbol
   curl http://localhost:5001/indicators/XAUUSD/H1?tier=FREE

   # Test PRO-only symbol
   curl http://localhost:5001/indicators/GBPUSD/H1?tier=PRO

   # Test FREE tier with PRO-only timeframe (should fail)
   curl http://localhost:5001/indicators/XAUUSD/M5?tier=FREE
   ```

3. **Test Tier Validation**

   ```bash
   # Should succeed
   curl http://localhost:5001/indicators/BTCUSD/H4?tier=FREE

   # Should fail (GBPUSD is PRO-only)
   curl http://localhost:5001/indicators/GBPUSD/H1?tier=FREE

   # Should fail (M5 is PRO-only)
   curl http://localhost:5001/indicators/XAUUSD/M5?tier=FREE
   ```

---

## Success Criteria

- ✅ All 15 files created
- ✅ Flask service starts without errors
- ✅ Tier validation works (FREE: 5 symbols, PRO: 15 symbols)
- ✅ Timeframe validation works (FREE: 3 timeframes, PRO: 9 timeframes)
- ✅ Indicator data retrieved successfully
- ✅ 9 timeframes supported (M5, M15, M30, H1, H2, H4, H8, H12, D1)
- ✅ Docker image builds successfully
- ✅ PROGRESS.md updated

---

## Next Steps

- Ready for Part 7: Indicators API (Next.js routes that call this service)
- Ready for Part 9: Charts (uses indicator data)

---

## Escalation Scenarios

**Scenario 1: MT5 connection fails**

- Check MT5 terminal is running
- Verify credentials in .env
- Check MT5 API is enabled

**Scenario 2: Indicator files not found**

- Check indicator installation
- Verify file paths in mt5_service.py
- Check MT5 data directory permissions

---

**Last Updated:** 2025-11-18
**Alignment:** (E) Phase 3 → (B) Part 6 → (C) This file
