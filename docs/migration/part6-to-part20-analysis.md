# Part 6 → Part 20 Migration Analysis

**Generated:** 2026-01-04
**Purpose:** Pre-implementation analysis for SQLite + PostgreSQL Sync migration

---

## Executive Summary

- **Total files affected:** 25+ source files (excluding documentation)
- **Critical dependencies:** 8 files with direct Flask service calls
- **Test files affected:** 6 test files with Flask mocks
- **Estimated migration effort:** 16-24 hours (phased approach recommended)

---

## File Reference Map

### Direct Imports (from mt5-service/)

The `mt5-service/` directory contains the Flask Python service that will be replaced:

| File | Purpose | Migration Action |
|------|---------|------------------|
| `mt5-service/app/__init__.py` | Flask app factory | **DELETE** - Replace with MQL5 → SQLite → Sync |
| `mt5-service/app/routes/indicators.py` | `/api/indicators` endpoint | **DELETE** - Data from PostgreSQL |
| `mt5-service/app/routes/admin.py` | Admin endpoints | **DELETE** - Admin via Next.js API |
| `mt5-service/app/services/mt5_connection_pool.py` | MT5 terminal pool | **DELETE** - MQL5 script handles connections |
| `mt5-service/app/services/indicator_reader.py` | Read from MT5 terminals | **DELETE** - MQL5 reads directly |
| `mt5-service/app/services/health_monitor.py` | Terminal health checks | **REPLACE** - New sync health monitor |
| `mt5-service/app/services/tier_service.py` | Tier validation | **MIGRATE** - Already in Next.js |
| `mt5-service/app/utils/constants.py` | MT5 constants | **MIGRATE** - Move to Part 20 config |
| `mt5-service/run.py` | Flask server entry | **DELETE** |
| `mt5-service/Dockerfile` | Flask container | **DELETE** - No container needed |
| `mt5-service/requirements.txt` | Python dependencies | **DELETE** |
| `mt5-service/config/mt5_terminals.json` | Terminal config | **REPLACE** - New SQLite config |

### Flask URL References (Next.js → Flask)

These files call the Flask service and need to switch to PostgreSQL:

| File | URL Pattern | Current Usage | Migration Action |
|------|-------------|---------------|------------------|
| `lib/api/mt5-client.ts` | `${MT5_SERVICE_URL}/api/indicators/*` | Fetch indicators from Flask | **REPLACE** - Query PostgreSQL directly via Prisma |
| `lib/api/mt5-client.ts` | `${MT5_SERVICE_URL}/api/health` | Health check | **REPLACE** - Check sync_metadata table |
| `lib/api/mt5-client.ts` | `${MT5_SERVICE_URL}/api/symbols` | Get symbols | **REPLACE** - Query PostgreSQL symbols table |
| `lib/api/mt5-client.ts` | `${MT5_SERVICE_URL}/api/timeframes` | Get timeframes | **REPLACE** - Query PostgreSQL timeframes table |
| `lib/jobs/alert-checker.ts` | `${MT5_API_URL}/api/mt5/price` | Fetch current price | **REPLACE** - Query latest OHLC from PostgreSQL |
| `lib/monitoring/system-monitor.ts` | `process.env['MT5_SERVICE_URL']` | Health check config | **REPLACE** - Check PostgreSQL sync status |

### API Routes That Call Flask

| Route File | Endpoint | What It Does | Migration Action |
|------------|----------|--------------|------------------|
| `app/api/indicators/[symbol]/[timeframe]/route.ts` | GET | Fetches indicators via `fetchIndicatorData()` | **MODIFY** - Call new PostgreSQL service |
| `app/api/indicators/route.ts` | GET | Lists indicator types | **KEEP** - Static data, no Flask call |

---

## Environment Variables

### Current Part 6 Variables

| Variable | Files Using | Current Value | Part 20 Replacement |
|----------|-------------|---------------|---------------------|
| `MT5_SERVICE_URL` | `lib/api/mt5-client.ts`, `lib/monitoring/system-monitor.ts` | `http://localhost:5001` | **DELETE** - No external service |
| `MT5_API_KEY` | `lib/api/mt5-client.ts` | API key for Flask auth | **DELETE** - Internal PostgreSQL access |
| `MT5_API_URL` | `lib/jobs/alert-checker.ts` | `http://localhost:5000` | **DELETE** - Query PostgreSQL |
| `MT5_LOGIN` | `.env.example` | MT5 terminal login | **KEEP** - Used by MQL5 script |
| `MT5_PASSWORD` | `.env.example` | MT5 terminal password | **KEEP** - Used by MQL5 script |
| `MT5_SERVER` | `.env.example` | MT5 broker server | **KEEP** - Used by MQL5 script |
| `FLASK_MT5_URL` | `docker-compose.yml` | Flask service URL | **DELETE** - Remove service |

### New Part 20 Variables (to add)

| Variable | Purpose | Example Value |
|----------|---------|---------------|
| `SQLITE_DB_PATH` | Local SQLite database path on MT5 VPS | `C:\MT5\Data\indicators.db` |
| `SYNC_INTERVAL_MS` | Sync frequency (milliseconds) | `60000` (1 minute) |
| `SYNC_BATCH_SIZE` | Records per sync batch | `1000` |

---

## Integration Points

### 1. Next.js → Flask Calls (via lib/api/mt5-client.ts)

**Current Flow:**
```
Frontend Component
    ↓
/api/indicators/[symbol]/[timeframe]
    ↓
lib/api/mt5-client.ts → fetchIndicatorData()
    ↓
HTTP GET to Flask (localhost:5001)
    ↓
Flask queries MT5 terminal
    ↓
Returns OHLC + indicators
```

**Part 20 Flow:**
```
Frontend Component
    ↓
/api/indicators/[symbol]/[timeframe]
    ↓
lib/api/indicator-service.ts → getIndicatorData()
    ↓
Prisma query to PostgreSQL
    ↓
Returns OHLC + indicators from synced data
```

### 2. Frontend → API Calls

The frontend components do NOT call Flask directly. They call Next.js API routes:

| Component | API Call | Migration Impact |
|-----------|----------|------------------|
| `components/charts/trading-chart.tsx` | `fetch('/api/indicators/${symbol}/${timeframe}')` | **NONE** - API route handles backend |
| `hooks/use-indicators.ts` | `fetch('/api/indicators/${symbol}/${timeframe}')` | **NONE** - API route handles backend |

**Key Finding:** Frontend is isolated from Flask. Only the API route layer needs modification.

### 3. Alert Checker Job

**Current (lib/jobs/alert-checker.ts):**
```typescript
const mt5ApiUrl = process.env['MT5_API_URL'] || 'http://localhost:5000';
const response = await fetch(`${mt5ApiUrl}/api/mt5/price?symbol=${symbol}`);
```

**Part 20:**
```typescript
// Query latest price from PostgreSQL OHLC table
const latestBar = await prisma.oHLC.findFirst({
  where: { symbol },
  orderBy: { timestamp: 'desc' },
});
const currentPrice = latestBar?.close || 0;
```

### 4. System Monitor Health Checks

**Current (lib/monitoring/system-monitor.ts):**
```typescript
const mt5ServiceUrl = process.env['MT5_SERVICE_URL'];
// Placeholder health check
```

**Part 20:**
```typescript
// Check sync health from sync_metadata table
const syncStatus = await prisma.syncMetadata.findFirst({
  orderBy: { lastSyncAt: 'desc' },
});
const isHealthy = syncStatus && (Date.now() - syncStatus.lastSyncAt.getTime()) < 120000;
```

---

## Test Dependencies

### Test Files with Flask Mocks

| Test File | What It Mocks | Migration Action |
|-----------|---------------|------------------|
| `__tests__/lib/api/mt5-client.test.ts` | `global.fetch` for Flask calls | **REWRITE** - Mock Prisma instead |
| `__tests__/api/indicators.test.ts` | `@/lib/api/mt5-client` module | **REWRITE** - Mock new service |
| `__tests__/components/charts/trading-chart.test.tsx` | API response format | **UPDATE** - Verify format unchanged |
| `__tests__/integration/tier2-workflows.test.ts` | MT5 integration workflows | **REWRITE** - Test PostgreSQL integration |
| `mt5-service/tests/test_indicators.py` | Flask indicators endpoint | **DELETE** - Flask removed |
| `mt5-service/tests/test_connection_pool.py` | MT5 connection pool | **DELETE** - Flask removed |

### Test Updates Required

1. **Delete Flask Python tests** (5 files in `mt5-service/tests/`)
2. **Rewrite mt5-client tests** to mock Prisma instead of fetch
3. **Add new sync service tests** for Part 20 sync logic
4. **Verify API response format** remains compatible

---

## Docker/Deployment Configuration

### docker-compose.yml Changes

**Current:**
```yaml
services:
  mt5-service:
    build: ./mt5-service
    ports:
      - '5001:5001'
    depends_on:
      - postgres
      - redis
```

**Part 20:**
```yaml
# REMOVE mt5-service entirely
# Web service no longer depends on mt5-service
services:
  web:
    depends_on:
      - postgres
      - redis
    # Remove: mt5-service dependency
```

### CI/CD Pipeline Changes

| File | Current | Migration Action |
|------|---------|------------------|
| `.github/workflows/ci-flask.yml` | Flask CI pipeline | **DELETE** - No Flask |
| `.github/workflows/dependencies-security.yml` | Scans Flask deps | **UPDATE** - Remove Flask refs |
| `.github/workflows/deploy.yml` | Deploys Flask | **UPDATE** - Remove Flask deployment |

---

## Migration Risk Assessment

### High Risk (Must change carefully)

| File | Risk Reason | Mitigation |
|------|-------------|------------|
| `lib/api/mt5-client.ts` | Core data fetching logic | Create new file, keep old as fallback |
| `app/api/indicators/[symbol]/[timeframe]/route.ts` | Public API contract | Ensure response format unchanged |
| `lib/cache/indicator-cache.ts` | Caching depends on data format | Verify cache key/value compatibility |
| `lib/jobs/alert-checker.ts` | Affects user alerts | Test thoroughly with real alerts |

### Medium Risk (Standard updates)

| File | Risk Reason | Mitigation |
|------|-------------|------------|
| `lib/monitoring/system-monitor.ts` | Internal monitoring | Add new sync health checks |
| `docker-compose.yml` | Local dev environment | Document new setup |
| `.env.example` | Developer reference | Update with new variables |
| `__tests__/**/*.test.ts` | Test coverage | Maintain coverage % |

### Low Risk (Simple replacements)

| File | Risk Reason | Mitigation |
|------|-------------|------------|
| `hooks/use-indicators.ts` | No backend changes | Verify response format |
| `components/charts/trading-chart.tsx` | No backend changes | Visual regression test |
| Documentation files | Reference only | Update after code changes |

---

## Response Format Compatibility

### Current API Response (from Flask)

```typescript
interface MT5IndicatorData {
  ohlc: OHLCBar[];
  horizontal: HorizontalLines;
  diagonal: DiagonalLines;
  fractals: Fractals;
  proIndicators?: MT5RawProIndicators;
  metadata: IndicatorMetadata;
}
```

### Part 20 Response (from PostgreSQL)

The response format MUST remain identical to ensure frontend compatibility:

```typescript
// Same interface - data source changes, format stays the same
interface IndicatorData {
  ohlc: OHLCBar[];           // From PostgreSQL ohlc_bars table
  horizontal: HorizontalLines; // From PostgreSQL horizontal_lines table
  diagonal: DiagonalLines;    // From PostgreSQL diagonal_lines table
  fractals: Fractals;         // From PostgreSQL fractals table
  proIndicators?: ProIndicators; // From PostgreSQL pro_indicators table
  metadata: IndicatorMetadata;
}
```

---

## Pre-Migration Checklist

- [ ] All Part 6 dependencies identified and documented (this file)
- [ ] All environment variables mapped to new values
- [ ] All API response formats documented for compatibility verification
- [ ] All test mocks identified for rewrite
- [ ] Rollback plan documented (below)
- [ ] New Prisma schema designed (Part 20 Phase 01)
- [ ] Sync service architecture approved (Part 20 architecture doc)

---

## Rollback Plan

If Part 20 migration fails, rollback to Part 6:

1. **Environment:** Restore `MT5_SERVICE_URL` and `MT5_API_KEY` variables
2. **Docker:** Re-add mt5-service to docker-compose.yml
3. **API Route:** Revert `app/api/indicators/[symbol]/[timeframe]/route.ts` to use `lib/api/mt5-client.ts`
4. **Tests:** Restore Flask mock tests
5. **Git:** `git revert` migration commits

**Rollback time estimate:** 15-30 minutes

---

## Recommended Migration Order

### Phase 1: Database Setup (Part 20 Phase 01-02)
1. Create PostgreSQL schema for synced data
2. Set up Prisma models for OHLC, indicators, sync_metadata
3. Test database connections

### Phase 2: Sync Service (Part 20 Phase 03-05)
4. Deploy SQLite database on MT5 VPS
5. Implement MQL5 indicator data writer
6. Create sync service (SQLite → PostgreSQL)
7. Test sync with sample data

### Phase 3: API Migration (Part 20 Phase 06-07)
8. Create `lib/api/indicator-service.ts` (PostgreSQL-based)
9. Update `app/api/indicators/[symbol]/[timeframe]/route.ts`
10. Add feature flag: `USE_SYNCED_DATA=true/false`
11. Run parallel: Flask + PostgreSQL for validation

### Phase 4: Cleanup (Part 20 Phase 08-09)
12. Remove Flask service calls
13. Delete `mt5-service/` directory
14. Update environment variables
15. Update docker-compose.yml
16. Rewrite tests
17. Update documentation

### Phase 5: Verification
18. End-to-end testing
19. Performance comparison (Flask vs PostgreSQL)
20. Monitor sync health for 48 hours
21. Remove feature flag, PostgreSQL-only

---

## Migration Metrics Tracking

Track these during migration:

| Metric | Current (Flask) | Target (Part 20) |
|--------|-----------------|------------------|
| Indicator fetch latency | ~500-800ms | <100ms (cached) |
| Data freshness | Real-time | 60s delay (acceptable) |
| Service availability | 99%+ | 99.9%+ (no external dep) |
| Test coverage | ~70% | Maintain ~70%+ |

---

## Dependencies on Other Parts

| Part | Dependency Type | Impact |
|------|-----------------|--------|
| Part 1 (Foundation) | Prisma client | Add new models |
| Part 3 (Types) | TypeScript types | Keep compatible |
| Part 7 (API) | API routes | Update indicator routes |
| Part 9 (Charts) | Frontend | No changes needed |
| Part 11 (Alerts) | Price fetching | Update to PostgreSQL |
| Part 14 (Admin) | Health monitoring | Update dashboard |
| Part 16 (Utils) | Caching | Verify compatibility |

---

## Summary

The Part 6 to Part 20 migration is well-scoped with clear boundaries:

1. **Frontend isolated** - No changes to React components
2. **API contract preserved** - Response format unchanged
3. **Clear cut-over point** - Feature flag enables parallel testing
4. **Rollback possible** - Can revert within 30 minutes

**Recommendation:** Proceed with Part 20 Phase 01 (Database Schema Setup)
