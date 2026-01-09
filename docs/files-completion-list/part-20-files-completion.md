# Part 20: SQLite + Sync to PostgreSQL - Files Completion List

**Architecture:** MQL5 Service → SQLite (local) → Python Sync → PostgreSQL (Railway) → Next.js API
**Replaces:** Part 6 (Flask MT5 Service)
**Total Files:** 52 files across 10 phases

---

## Phase 00: Migration Analysis (1 file)

| # | File Path | Type | Description | Status |
|---|-----------|------|-------------|--------|
| 1 | `docs/migration/part6-to-part20-analysis.md` | Documentation | Part 6 dependency analysis and migration plan | ⬜ |

---

## Phase 01: Database Schema Setup (4 files)

| # | File Path | Type | Description | Status |
|---|-----------|------|-------------|--------|
| 2 | `sql/sqlite_schema.sql` | SQL | SQLite schema for 15 symbol tables (local MT5 data) | ⬜ |
| 3 | `sql/postgresql_schema.sql` | SQL | PostgreSQL schema for 135 timeframe tables (cloud) | ⬜ |
| 4 | `sql/timescaledb_setup.sql` | SQL | TimescaleDB hypertables and retention policies | ⬜ |
| 5 | `sql/seed_data.sql` | SQL | Test seed data for development | ⬜ |

---

## Phase 02: MQL5 Service Development (3 files)

| # | File Path | Type | Description | Status |
|---|-----------|------|-------------|--------|
| 6 | `mql5/Services/DataCollector.mq5` | MQL5 | Main MQL5 service running in MT5 terminals | ⬜ |
| 7 | `mql5/Include/IndicatorBuffers.mqh` | MQL5 | Indicator buffer reading utilities | ⬜ |
| 8 | `mql5/Include/SymbolUtils.mqh` | MQL5 | Symbol normalization and table creation | ⬜ |

---

## Phase 03: Sync Script Development (5 files)

| # | File Path | Type | Description | Status |
|---|-----------|------|-------------|--------|
| 9 | `sync/config.py` | Backend Logic | Sync configuration (symbols, timeframes, intervals) | ⬜ |
| 10 | `sync/timeframe_filter.py` | Backend Logic | Timeframe filtering logic (M5, H1, D1, etc.) | ⬜ |
| 11 | `sync/db_connections.py` | Backend Logic | Database connection pooling (SQLite + PostgreSQL) | ⬜ |
| 12 | `sync/sync_to_postgresql.py` | Backend Logic | Main sync script with DataSyncer class | ⬜ |
| 13 | `sync/requirements.txt` | Configuration | Python dependencies for sync script | ⬜ |

---

## Phase 04a: TypeScript Types (1 file)

| # | File Path | Type | Description | Status |
|---|-----------|------|-------------|--------|
| 14 | `lib/indicators/types.ts` | Backend Logic | TypeScript type definitions from OpenAPI spec | ⬜ |

---

## Phase 04b: Database Layer (2 files)

| # | File Path | Type | Description | Status |
|---|-----------|------|-------------|--------|
| 15 | `lib/db/postgresql.ts` | Backend Logic | PostgreSQL client with connection pooling | ⬜ |
| 16 | `lib/db/queries.ts` | Backend Logic | Database query functions (getIndicatorData, etc.) | ⬜ |

---

## Phase 04c: Tier Validation (1 file)

| # | File Path | Type | Description | Status |
|---|-----------|------|-------------|--------|
| 17 | `lib/tier/validation.ts` | Backend Logic | FREE/PRO tier access validation | ⬜ |

---

## Phase 04d: Market Hours (2 files)

| # | File Path | Type | Description | Status |
|---|-----------|------|-------------|--------|
| 18 | `lib/market-hours/trading-sessions.ts` | Backend Logic | Symbol trading hours configuration | ⬜ |
| 19 | `lib/market-hours/validator.ts` | Backend Logic | Market hours validation utilities | ⬜ |

---

## Phase 04e: API Routes (4 files)

| # | File Path | Type | Description | Status |
|---|-----------|------|-------------|--------|
| 20 | `app/api/indicators/[symbol]/[timeframe]/route.ts` | Backend Logic | Main indicator data API endpoint | ⬜ |
| 21 | `app/api/health/postgresql/route.ts` | Backend Logic | PostgreSQL health check endpoint | ⬜ |
| 22 | `app/api/symbols/route.ts` | Backend Logic | Available symbols endpoint (tier-filtered) | ⬜ |
| 23 | `app/api/timeframes/route.ts` | Backend Logic | Available timeframes endpoint (tier-filtered) | ⬜ |

---

## Phase 05: Redis Caching Layer (4 files)

| # | File Path | Type | Description | Status |
|---|-----------|------|-------------|--------|
| 24 | `lib/cache/redis.ts` | Backend Logic | Redis client setup | ⬜ |
| 25 | `lib/cache/indicator-cache.ts` | Backend Logic | Indicator-specific caching logic | ⬜ |
| 26 | `lib/cache/cache-invalidation.ts` | Backend Logic | Cache invalidation utilities | ⬜ |
| 27 | `app/api/admin/cache/clear/route.ts` | Backend Logic | Admin endpoint to clear cache | ⬜ |

---

## Phase 06: Confluence Score System (6 files)

| # | File Path | Type | Description | Status |
|---|-----------|------|-------------|--------|
| 28 | `lib/confluence/types.ts` | Backend Logic | Confluence score type definitions | ⬜ |
| 29 | `lib/db/multi-timeframe-query.ts` | Backend Logic | Multi-timeframe data querying | ⬜ |
| 30 | `lib/confluence/signals.ts` | Backend Logic | Signal detection functions | ⬜ |
| 31 | `lib/confluence/calculator.ts` | Backend Logic | Confluence score calculation engine | ⬜ |
| 32 | `app/api/confluence/[symbol]/route.ts` | Backend Logic | Confluence score API endpoint (PRO only) | ⬜ |
| 33 | `app/api/confluence/[symbol]/realtime/route.ts` | Backend Logic | Real-time confluence updates (SSE) | ⬜ |

---

## Phase 07: Testing Framework (10 files)

| # | File Path | Type | Description | Status |
|---|-----------|------|-------------|--------|
| 34 | `__tests__/setup.ts` | Test | Test setup and utilities | ⬜ |
| 35 | `jest.config.js` | Configuration | Jest configuration (update) | ⬜ |
| 36 | `__tests__/unit/timeframe-filter.test.ts` | Test | Unit tests for timeframe filtering | ⬜ |
| 37 | `__tests__/unit/confluence-calculator.test.ts` | Test | Unit tests for confluence calculation | ⬜ |
| 38 | `__tests__/unit/symbol-utils.test.ts` | Test | Unit tests for symbol utilities | ⬜ |
| 39 | `__tests__/unit/tier-validation.test.ts` | Test | Unit tests for tier validation | ⬜ |
| 40 | `__tests__/integration/db-queries.test.ts` | Test | Integration tests for database queries | ⬜ |
| 41 | `__tests__/integration/cache-integration.test.ts` | Test | Integration tests for caching layer | ⬜ |
| 42 | `__tests__/api/indicators.test.ts` | Test | API tests for indicator endpoints | ⬜ |
| 43 | `__tests__/api/confluence.test.ts` | Test | API tests for confluence endpoints | ⬜ |

---

## Phase 08: E2E Testing Migration (3 files)

| # | File Path | Type | Description | Status |
|---|-----------|------|-------------|--------|
| 44 | `e2e/playwright.config.ts` | Configuration | Playwright configuration (update) | ⬜ |
| 45 | `e2e/critical-path.spec.ts` | Test | E2E tests for critical path (DB → API → Frontend) | ⬜ |
| 46 | `e2e/chart-rendering.spec.ts` | Test | E2E tests for chart rendering with indicators | ⬜ |

---

## Phase 09: Migration & Cutover (4+ files)

| # | File Path | Type | Description | Status |
|---|-----------|------|-------------|--------|
| 47 | `scripts/deploy-part20.sh` | Deployment | Production deployment script | ⬜ |
| 48 | `scripts/rollback-to-part6.sh` | Deployment | Emergency rollback script | ⬜ |
| 49 | `docs/migration/rollback-to-part6.md` | Documentation | Rollback procedures documentation | ⬜ |
| 50 | `docs/DEPLOYMENT-CHECKLIST.md` | Documentation | Pre-deployment and post-deployment checklist | ⬜ |
| 51 | `.env.example` | Configuration | Environment variables (update to add Part 20 vars) | ⬜ |
| 52 | `docker-compose.yml` | Configuration | Docker configuration (remove Flask service) | ⬜ |

**Additional Phase 09 Updates (not new files, but updates to existing files):**
- Archive `mt5-service/` directory to `archive/part6-flask-mt5/`
- Delete `lib/api/mt5-client.ts` and `lib/api/mt5-transform.ts`
- Update `lib/jobs/alert-checker.ts` (use PostgreSQL instead of Flask)
- Update `lib/monitoring/system-monitor.ts` (check PostgreSQL/Redis health)
- Update `.github/workflows/ci-flask.yml` (delete)
- Update `.github/workflows/deploy.yml` (remove Flask steps, add Part 20 verification)
- Update `.github/workflows/dependencies-security.yml` (replace Flask with PostgreSQL/Redis)
- Update `.github/workflows/test.yml` (use PostgreSQL/Redis services)
- Update `__tests__/api/indicators.test.ts` (mock Part 20 instead of Flask)
- Update `README.md` (replace Flask architecture with Part 20)

---

## File Count Summary by Type

| Type | Count | Description |
|------|-------|-------------|
| **Backend Logic (TypeScript)** | 22 | API routes, database layer, caching, business logic |
| **Backend Logic (Python)** | 4 | Sync script components |
| **Backend Logic (MQL5)** | 3 | MT5 service and utilities |
| **SQL Scripts** | 4 | Database schemas and setup |
| **Tests** | 13 | Unit, integration, API, and E2E tests |
| **Deployment Scripts** | 2 | Deploy and rollback automation |
| **Documentation** | 3 | Migration analysis, rollback guide, checklist |
| **Configuration** | 1 | Python dependencies |
| **Total New Files** | 52 | |
| **Updated Existing Files** | ~15 | (See Phase 09 Additional Updates) |

---

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 02: MQL5 Service (runs inside MT5 terminals)          │
│  - Reads custom indicators every 30 seconds                 │
│  - Writes to SQLite (15 tables, 1 per symbol)              │
│  - Location: C:\MT5Data\trading_data.db                     │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 03: Python Sync Script (runs on Contabo VPS)          │
│  - Reads from SQLite every 30 seconds                       │
│  - Filters data by timeframes (M5, M15, M30, etc.)         │
│  - Writes to PostgreSQL (135 tables, 15 symbols × 9 TFs)   │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 01: PostgreSQL + TimescaleDB (Railway cloud)          │
│  - 135 hypertables (optimized for time-series queries)     │
│  - Retention policies (auto-delete old data)               │
│  - Compression (reduce storage costs)                       │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 05: Redis Caching Layer (Railway Redis)               │
│  - 30-second TTL (matches sync interval)                    │
│  - Reduces PostgreSQL load by 70-90%                        │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 04: Next.js API Routes (Vercel)                       │
│  - GET /api/indicators/[symbol]/[timeframe]                │
│  - GET /api/confluence/[symbol]  (PRO only)                │
│  - GET /api/health/postgresql                              │
│  - Tier validation (FREE vs PRO)                           │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│ Frontend (Next.js components)                                │
│  - Charts render with indicator data                        │
│  - Confluence scores displayed (PRO users)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Status Summary

- **Completed:** 0/52 files (0%)
- **Pending:** 52 files (100%)

---

## Key Improvements Over Part 6

| Feature | Part 6 (Flask) | Part 20 (SQLite + Sync) |
|---------|----------------|-------------------------|
| **Indicator Access** | ❌ Cannot read custom indicators (Python MT5 API limitation) | ✅ Full access via MQL5 iCustom() |
| **Data Storage** | No persistence (live API calls) | ✅ PostgreSQL with TimescaleDB optimization |
| **Caching** | No caching | ✅ Redis caching (30s TTL) |
| **Performance** | Slow (multiple MT5 API calls) | ✅ Fast (cached database queries) |
| **Scalability** | Limited (Flask single process) | ✅ Horizontal scaling (Vercel + Railway) |
| **Cost** | ~$30/month (Flask hosting) | ~$25/month (Railway PostgreSQL + Redis) |
| **Multi-Timeframe Analysis** | Not possible | ✅ Confluence score across 9 timeframes |

---

## Dependencies

**External Services:**
- Railway PostgreSQL with TimescaleDB extension
- Railway Redis (caching)
- Contabo VPS (Windows with MT5 terminals)
- Vercel (Next.js hosting)

**NPM Packages:**
- `pg` - PostgreSQL client
- `ioredis` - Redis client
- `next-auth` - Authentication (tier validation)

**Python Packages:**
- `psycopg2` - PostgreSQL adapter
- `python-dotenv` - Environment variables

---

*Last Updated: 2026-01-09*
*Source: docs/build-orders/part-20-phase*.md*
*Architecture: Modular Monolith Migration*
