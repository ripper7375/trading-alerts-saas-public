# Part 20: Migration Prompts (Part 6 → Part 20)

**This document contains two prompts:**
1. **Phase 0: Pre-Implementation Analysis** - Run BEFORE starting Part 20
2. **Phase 9-Migration: Integration & Cutover** - Run AFTER Part 20 Phases 1-8

---

## Phase 0 Prompt: Pre-Implementation Migration Analysis

**When to Run:** BEFORE starting Part 20 Phase 1

```
# Part 20 - Phase 0: Migration Analysis (Part 6 → Part 20)

## Context
Before implementing Part 20 (SQLite + Sync to PostgreSQL), I need to analyze the current Part 6 (Flask MT5 Service) dependencies to understand what will need to change during migration.

Part 6 currently provides:
- Flask service running on port 5001
- API endpoints: /api/indicators, /api/health, /api/symbols, /api/timeframes, /api/admin/*
- Python MT5 API for indicator data retrieval
- Connection pooling for 15 MT5 terminals

Part 20 will replace Part 6 with:
- MQL5 Service → SQLite → Sync → PostgreSQL → Next.js API
- No Flask service needed
- Indicator data from database instead of live MT5 connection

Please refer to the attached documents for Part 20 architecture.

## Your Task
Analyze the codebase to identify ALL Part 6 dependencies and create a migration plan.

## Analysis Required

### 1. Find All Part 6 File References
Search for files that:
- Import from `mt5-service/` directory
- Reference Flask service URL (localhost:5001 or mt5-service:5001)
- Use MT5_API_URL or similar environment variables
- Call Flask endpoints (/api/indicators, /api/health, etc.)

Output a table:
| File Path | Reference Type | What It Does | Migration Action |
|-----------|---------------|--------------|------------------|

### 2. Find All Environment Variables
Search for Part 6 related env vars:
- MT5_API_URL
- MT5_API_KEY
- MT5_ADMIN_API_KEY
- FLASK_PORT
- Any MT5_* variables

Output a table:
| Variable | Used In | Current Value | Part 20 Replacement |
|----------|---------|---------------|---------------------|

### 3. Analyze Next.js API Routes (Part 7)
Examine how Next.js calls Flask:
- Which routes proxy to Flask?
- What data transformations happen?
- What error handling exists?

Files to check:
- app/api/indicators/**
- app/api/mt5/**
- lib/services/mt5*.ts
- lib/api/indicators*.ts

### 4. Analyze Frontend Dependencies (Part 9)
Examine chart components:
- How does frontend fetch indicator data?
- What response format is expected?
- Any direct Flask calls from client?

Files to check:
- components/charts/**
- hooks/useIndicators*.ts
- lib/api/client*.ts

### 5. Analyze Test Dependencies
Find tests that:
- Mock Flask endpoints
- Use Flask test fixtures
- Reference MT5 service

Files to check:
- __tests__/**
- e2e/**
- *.test.ts, *.spec.ts

### 6. Analyze Docker/Deployment
Check deployment configurations:
- docker-compose.yml
- Dockerfile references
- Kubernetes/Railway configs
- CI/CD pipelines

### 7. Analyze Documentation
Find docs referencing Part 6:
- README files
- API documentation
- Architecture docs
- Build orders

## Output Required

Create a file `docs/migration/part6-to-part20-analysis.md` with:

```markdown
# Part 6 → Part 20 Migration Analysis

## Executive Summary
- Total files affected: X
- Critical dependencies: X
- Estimated migration effort: X hours

## File Reference Map

### Direct Imports (from mt5-service/)
| File | Import | Migration Action |
|------|--------|------------------|
| ... | ... | ... |

### Flask URL References
| File | URL Pattern | Migration Action |
|------|-------------|------------------|
| ... | ... | ... |

### Environment Variables
| Variable | Files Using | Replacement |
|----------|-------------|-------------|
| ... | ... | ... |

## Integration Points

### Next.js → Flask Calls
[List each API route that calls Flask]

### Frontend → API Calls
[List frontend fetch patterns]

### Test Mocks
[List test files with Flask mocks]

## Migration Risk Assessment

### High Risk (Must change carefully)
- [List critical files]

### Medium Risk (Standard updates)
- [List affected files]

### Low Risk (Simple replacements)
- [List trivial changes]

## Pre-Migration Checklist
- [ ] All Part 6 dependencies identified
- [ ] All environment variables mapped
- [ ] All API response formats documented
- [ ] All test mocks identified
- [ ] Rollback plan documented

## Recommended Migration Order
1. [First thing to migrate]
2. [Second thing to migrate]
...
```

## Success Criteria
- [ ] All Part 6 references found and documented
- [ ] Migration analysis file created
- [ ] No hidden dependencies missed
- [ ] Clear migration path identified

## Commit Instructions
```
docs: add Part 6 to Part 20 migration analysis

- Identify all files referencing Part 6 Flask service
- Map environment variables for migration
- Document integration points and risks
- Create migration checklist
```
```

---

## Phase 9-Migration Prompt: Integration & Cutover

**When to Run:** AFTER Part 20 Phases 1-8 are complete

```
# Part 20 - Phase 9: Migration, Integration & Cutover

## Context
Part 20 Phases 1-8 are complete. The new system is built and tested:
- ✅ PostgreSQL with 135 tables (Phase 1)
- ✅ MQL5 Services collecting data (Phase 2)
- ✅ Sync script transferring to PostgreSQL (Phase 3)
- ✅ New Next.js API routes (Phase 4)
- ✅ Redis caching (Phase 5)
- ✅ Confluence score system (Phase 6)
- ✅ Unit/integration tests (Phase 7)
- ✅ E2E tests (Phase 8)

Now we need to:
1. Update all Part 6 references to use Part 20
2. Remove Flask service dependencies
3. Deploy and verify
4. Archive Part 6 code

Please refer to:
- Attached Part 20 documents
- `docs/migration/part6-to-part20-analysis.md` (created in Phase 0)

## Your Task
Execute the migration from Part 6 to Part 20.

## Migration Steps

### Step 1: Update Environment Variables

**Remove these variables:**
```bash
# .env and .env.example - REMOVE
MT5_API_URL=http://localhost:5001
MT5_API_KEY=xxx
MT5_ADMIN_API_KEY=xxx
FLASK_PORT=5001
```

**Add/verify these variables:**
```bash
# .env and .env.example - ADD/VERIFY
POSTGRESQL_URI=postgresql://...
REDIS_URL=redis://...
SQLITE_PATH=C:\MT5Data\trading_data.db  # Contabo VPS only
SYNC_INTERVAL=30
```

Update files:
- `.env.example`
- `.env.local.example`
- `docker-compose.yml` (environment section)
- Railway/Vercel environment settings documentation

### Step 2: Update Next.js API Routes

**Files to modify in `app/api/`:**

For each file that currently calls Flask, update to use Part 20:

```typescript
// BEFORE (Part 6 - calling Flask)
const response = await fetch(`${process.env.MT5_API_URL}/api/indicators/${symbol}/${timeframe}`);
const data = await response.json();

// AFTER (Part 20 - direct database)
import { getIndicatorDataCached } from '@/lib/cache/indicator-cache';
const data = await getIndicatorDataCached(symbol, timeframe, limit);
```

**Specific routes to update:**
- `app/api/indicators/[symbol]/[timeframe]/route.ts` - Already created in Phase 4, verify it's active
- `app/api/mt5/health/route.ts` - Update to check PostgreSQL/Redis instead of Flask
- `app/api/mt5/symbols/route.ts` - Use Part 20 implementation
- `app/api/mt5/timeframes/route.ts` - Use Part 20 implementation
- Any admin routes that called Flask

### Step 3: Update Service Layer

**Files to modify in `lib/`:**

Remove Flask client code:
```typescript
// DELETE or deprecate these files:
// lib/services/mt5-client.ts
// lib/services/flask-api.ts
// lib/api/mt5-service.ts
```

Update any shared utilities:
```typescript
// lib/services/indicators.ts
// BEFORE: Calls Flask
// AFTER: Uses getIndicatorDataCached from Part 20
```

### Step 4: Update Frontend Components

**Files to check in `components/`:**

Verify API calls go to correct endpoints:
```typescript
// components/charts/TradingChart.tsx
// Verify it calls /api/indicators/[symbol]/[timeframe]
// The endpoint URL stays same, but backend changed to Part 20

// No frontend changes needed if API contract unchanged
// Just verify response format matches
```

### Step 5: Update Tests

**Update test mocks:**

```typescript
// BEFORE: Mock Flask responses
jest.mock('@/lib/services/mt5-client', () => ({
  fetchIndicators: jest.fn().mockResolvedValue(mockData)
}));

// AFTER: Mock Part 20 cache/db
jest.mock('@/lib/cache/indicator-cache', () => ({
  getIndicatorDataCached: jest.fn().mockResolvedValue(mockData)
}));
```

**Files to update:**
- `__tests__/api/indicators.test.ts` - Update mocks
- `__tests__/integration/*.test.ts` - Update integration tests
- `e2e/*.spec.ts` - Verify E2E still works

### Step 6: Update Docker Configuration

**docker-compose.yml:**
```yaml
# REMOVE this service:
# mt5-flask-service:
#   build: ./mt5-service
#   ports:
#     - "5001:5001"
#   ...

# KEEP these services:
services:
  nextjs:
    # ... existing config
    environment:
      - POSTGRESQL_URI=${POSTGRESQL_URI}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - postgres
      - redis

  postgres:
    image: timescale/timescaledb:latest-pg15
    # ...

  redis:
    image: redis:7-alpine
    # ...

# ADD sync service (for local dev):
  sync:
    build: ./sync
    environment:
      - SQLITE_PATH=/data/trading_data.db
      - POSTGRESQL_URI=${POSTGRESQL_URI}
    volumes:
      - ./mt5-data:/data
```

### Step 7: Update CI/CD Pipeline

**GitHub Actions / CI config:**
```yaml
# REMOVE Flask-related steps:
# - name: Build Flask service
#   run: docker build -t mt5-flask ./mt5-service

# REMOVE Flask health checks:
# - name: Wait for Flask
#   run: curl --retry 10 http://localhost:5001/api/health

# ADD Part 20 checks:
- name: Verify PostgreSQL
  run: |
    psql $POSTGRESQL_URI -c "SELECT COUNT(*) FROM eurusd_h1;"

- name: Verify Redis
  run: |
    redis-cli -u $REDIS_URL PING
```

### Step 8: Archive Part 6 Code

**Move to archive (don't delete yet):**
```bash
# Create archive directory
mkdir -p archive/part6-flask-mt5

# Move Part 6 files
mv mt5-service/ archive/part6-flask-mt5/

# Add README to archive
cat > archive/part6-flask-mt5/README.md << 'EOF'
# Part 6 - Flask MT5 Service (ARCHIVED)

**Status:** Archived on YYYY-MM-DD
**Replaced by:** Part 20 (SQLite + Sync to PostgreSQL)

This code is kept for reference only. Do not use in production.

## Why Archived
- Python MT5 API cannot access custom indicator buffers (iCustom not available)
- Part 20 uses MQL5 Services to read indicators directly from MT5

## Restoration
If rollback needed, see docs/migration/rollback-to-part6.md
EOF
```

### Step 9: Update Documentation

**Files to update:**
- `README.md` - Update architecture section
- `docs/build-orders/part-06-flask-mt5.md` - Add deprecation notice
- `CLAUDE.md` - Update if it references Part 6
- `docs/architecture/*.md` - Update diagrams

**Add deprecation notice to Part 6 docs:**
```markdown
> ⚠️ **DEPRECATED**: Part 6 has been superseded by Part 20 (SQLite + Sync to PostgreSQL).
> See `docs/build-orders/part-20-architecture-design.md` for the current architecture.
```

### Step 10: Create Rollback Documentation

**Create `docs/migration/rollback-to-part6.md`:**
```markdown
# Rollback to Part 6 (Emergency Only)

## When to Use
Only if Part 20 has critical issues that cannot be fixed quickly.

## Prerequisites
- Part 6 code in archive/part6-flask-mt5/
- MT5 terminals still running with indicators

## Steps
1. Restore Part 6 code: `cp -r archive/part6-flask-mt5/mt5-service ./`
2. Restore environment variables
3. Start Flask service: `cd mt5-service && python run.py`
4. Update Next.js routes to call Flask
5. Verify data flowing

## Post-Rollback
- Investigate Part 20 issues
- Create fix plan
- Schedule re-migration
```

### Step 11: Deploy & Verify

**Deployment checklist:**
- [ ] All code changes committed
- [ ] Environment variables updated in production
- [ ] PostgreSQL has recent data (check sync)
- [ ] Redis connected
- [ ] Deploy Next.js application
- [ ] Verify /api/health returns ok
- [ ] Verify /api/indicators/EURUSD/H1 returns data
- [ ] Verify frontend charts display correctly
- [ ] Verify confluence score works (PRO users)
- [ ] Monitor error rates for 1 hour
- [ ] Check Sentry/logging for errors

### Step 12: Post-Migration Cleanup

**After 30 days of stable operation:**
- [ ] Delete archive/part6-flask-mt5/ directory
- [ ] Remove any remaining Part 6 references
- [ ] Update all documentation to remove Part 6 mentions
- [ ] Close migration tracking issues

## Migration Verification Checklist

### API Endpoints
- [ ] GET /api/indicators/{symbol}/{timeframe} - Returns data
- [ ] GET /api/health - Returns PostgreSQL/Redis status
- [ ] GET /api/symbols - Returns tier-filtered symbols
- [ ] GET /api/timeframes - Returns tier-filtered timeframes
- [ ] GET /api/confluence/{symbol} - Returns score (PRO only)

### Data Accuracy
- [ ] OHLC data matches MT5 terminal
- [ ] Fractals match MT5 terminal
- [ ] Trendlines match MT5 terminal
- [ ] All 13 indicators present

### Performance
- [ ] API response time < 200ms (cached)
- [ ] API response time < 500ms (uncached)
- [ ] Redis cache hit rate > 80%

### Error Handling
- [ ] Invalid symbol returns 400
- [ ] Invalid timeframe returns 400
- [ ] FREE tier blocked from PRO content (403)
- [ ] Database errors return 500 with message

## Files Changed Summary

### Deleted/Archived
- `mt5-service/` → `archive/part6-flask-mt5/`

### Modified
- `.env.example` - Remove MT5_*, add POSTGRESQL_URI, REDIS_URL
- `docker-compose.yml` - Remove Flask service
- `app/api/indicators/**` - Use Part 20 implementation
- `app/api/mt5/**` - Update or remove
- `lib/services/mt5*.ts` - Remove Flask client
- `__tests__/**` - Update mocks
- `docs/**` - Update documentation

### Added (from Phases 1-8)
- `sql/` - Database schemas
- `mql5/` - MQL5 Service
- `sync/` - Sync script
- `lib/db/postgresql.ts` - PostgreSQL client
- `lib/cache/` - Redis caching
- `lib/confluence/` - Confluence system

## Commit Instructions
After completing all migration steps:

```
feat: migrate from Part 6 (Flask) to Part 20 (SQLite + Sync + PostgreSQL)

BREAKING CHANGE: Flask MT5 service removed

Migration includes:
- Remove Flask service and MT5 Python API dependencies
- Update API routes to use PostgreSQL directly
- Update environment variables
- Update Docker configuration
- Archive Part 6 code for rollback capability
- Update all documentation

Part 6 archived to: archive/part6-flask-mt5/
```
```

---

## Migration Checklist Summary

### Before Starting Part 20 (Phase 0)
- [ ] Run Phase 0 analysis prompt
- [ ] Create migration analysis document
- [ ] Identify all Part 6 dependencies
- [ ] Document all environment variables
- [ ] Map all file references

### During Part 20 (Phases 1-8)
- [ ] Part 6 continues running (no changes)
- [ ] Part 20 built in parallel
- [ ] Both systems can coexist
- [ ] Test Part 20 independently

### After Part 20 (Phase 9-Migration)
- [ ] Update environment variables
- [ ] Update Next.js API routes
- [ ] Update service layer
- [ ] Update tests
- [ ] Update Docker config
- [ ] Archive Part 6 code
- [ ] Deploy and verify
- [ ] Monitor for 24 hours
- [ ] Complete post-migration cleanup (after 30 days)

---

## Risk Mitigation

### Data Loss Prevention
- Part 20 PostgreSQL is NEW database (doesn't modify Part 6 data)
- SQLite on Contabo is separate from any Part 6 storage
- Can run both systems in parallel during testing

### Rollback Capability
- Part 6 code archived (not deleted)
- Rollback script available
- Environment can be reverted
- Takes ~15 minutes to rollback

### Zero Downtime
- Deploy Part 20 API routes first (dormant)
- Switch environment variables
- Traffic automatically uses new routes
- Old Flask service can stay running until verified

---

## Answers to Your Questions

**Q: Should Phase 0 be done before starting Part 20?**

**A: YES.** Run Phase 0 (Migration Analysis) BEFORE starting Phase 1. This ensures:
1. You understand the full scope before building
2. No surprises during migration
3. You can plan the migration alongside implementation
4. Risk assessment is done upfront

**Recommended sequence:**
```
Phase 0 (Analysis) → Phase 1-8 (Build) → Phase 9 (Migration/Cutover)
```
