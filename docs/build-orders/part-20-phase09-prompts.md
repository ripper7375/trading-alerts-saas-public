# Part 20 - Phase 09: Migration, Integration & Cutover

**Purpose:** Execute complete migration from Part 6 to Part 20, including code updates, deployment scripts, and production cutover.

---

## Usage Instructions

1. Start a fresh Claude Code (web) chat
2. Attach these 3 documents:
   - `docs/build-orders/part-20-architecture-design.md`
   - `docs/build-orders/part-20-implementation-plan.md`
   - `docs/open-api-documents/part-20-sqlite-sync-postgresql-openapi.yaml`
3. Copy and paste the prompt below

---

## Phase 09 Prompt

```
# Part 20 - Phase 09: Migration, Integration & Cutover

## Context
I'm implementing Part 20 of Trading Alerts SaaS. Phases 1-8 are complete and all tests passing.

This phase handles:
1. Code migration - Update all Part 6 references to use Part 20
2. Deployment scripts - Create scripts for deployment and rollback
3. Production cutover - Execute the migration

Please refer to the attached documents:
- `part-20-architecture-design.md` - Architecture context
- `part-20-implementation-plan.md` - Phase 9 details
- `part-20-sqlite-sync-postgresql-openapi.yaml` - API specification

## Prerequisites
- Phases 1-8 completed with all tests passing
- Production PostgreSQL on Railway ready
- Production Redis on Railway ready
- MQL5 Services deployed to all 15 MT5 terminals
- Sync script tested in staging
- Phase 0 analysis completed (docs/migration/part6-to-part20-analysis.md)

## Your Task
Execute complete migration from Part 6 to Part 20.

---

## PART A: Code Migration

### Step A1: Update Environment Variables

**Files to modify:** `.env.example`, `.env.local.example`

**Remove these Part 6 variables:**
```bash
# REMOVE THESE:
MT5_API_URL=http://localhost:5001
MT5_API_KEY=xxx
MT5_ADMIN_API_KEY=xxx
FLASK_PORT=5001
```

**Add/verify Part 20 variables:**
```bash
# ADD THESE:
POSTGRESQL_URI=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379
SQLITE_PATH=C:\MT5Data\trading_data.db  # Contabo VPS only
SYNC_INTERVAL=30
ADMIN_API_KEY=your-admin-key
```

### Step A2: Update Next.js API Routes

**For any file that calls Flask, update to use Part 20:**

```typescript
// BEFORE (Part 6 - calling Flask)
const response = await fetch(`${process.env.MT5_API_URL}/api/indicators/${symbol}/${timeframe}`);
const data = await response.json();

// AFTER (Part 20 - direct database via cache)
import { getIndicatorDataCached } from '@/lib/cache/indicator-cache';
const data = await getIndicatorDataCached(symbol, timeframe, limit);
```

**Files to check and update:**
- `app/api/indicators/[symbol]/[timeframe]/route.ts` - Should use Part 20 implementation
- `app/api/mt5/health/route.ts` - Update to check PostgreSQL/Redis
- `app/api/mt5/symbols/route.ts` - Use Part 20 tier validation
- `app/api/mt5/timeframes/route.ts` - Use Part 20 tier validation

### Step A3: Update/Remove Service Layer

**Files to DELETE or mark deprecated:**
```
lib/services/mt5-client.ts      → DELETE
lib/services/flask-api.ts       → DELETE
lib/api/mt5-service.ts          → DELETE
```

**Files to UPDATE (if they import from deleted files):**
```typescript
// Update any file that imported from mt5-client.ts
// to use Part 20 modules instead:
import { getIndicatorDataCached } from '@/lib/cache/indicator-cache';
import { validateTierAccess } from '@/lib/tier/validation';
```

### Step A4: Update Test Mocks

**Update test files to mock Part 20 instead of Part 6:**

```typescript
// BEFORE: Mock Flask
jest.mock('@/lib/services/mt5-client', () => ({
  fetchIndicators: jest.fn().mockResolvedValue(mockData)
}));

// AFTER: Mock Part 20
jest.mock('@/lib/cache/indicator-cache', () => ({
  getIndicatorDataCached: jest.fn().mockResolvedValue(mockData)
}));
```

**Files to update:**
- All test files in `__tests__/` that mock MT5/Flask
- Update E2E tests if they reference Flask URLs

### Step A5: Update Docker Configuration

**Modify `docker-compose.yml`:**

```yaml
# REMOVE this service block entirely:
# mt5-flask-service:
#   build: ./mt5-service
#   ports:
#     - "5001:5001"
#   environment:
#     - MT5_API_KEY=${MT5_API_KEY}

# UPDATE nextjs service:
services:
  nextjs:
    environment:
      - POSTGRESQL_URI=${POSTGRESQL_URI}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - postgres
      - redis

  postgres:
    image: timescale/timescaledb:latest-pg15
    environment:
      - POSTGRES_DB=trading_alerts
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
```

### Step A6: Archive Part 6 Code

**DO NOT DELETE - Archive for rollback capability:**

```bash
# Create archive directory
mkdir -p archive/part6-flask-mt5

# Move Part 6 files
mv mt5-service/ archive/part6-flask-mt5/

# Create README in archive
```

**Create `archive/part6-flask-mt5/README.md`:**
```markdown
# Part 6 - Flask MT5 Service (ARCHIVED)

**Status:** Archived on [DATE]
**Replaced by:** Part 20 (SQLite + Sync to PostgreSQL)

This code is kept for rollback capability only. Do not use in production.

## Why Archived
Python MT5 API cannot access custom indicator buffers (iCustom not available).
Part 20 uses MQL5 Services to read indicators directly from MT5.

## Rollback Instructions
See: docs/migration/rollback-to-part6.md
```

### Step A7: Update Documentation

**Add deprecation notice to `docs/build-orders/part-06-flask-mt5.md`:**
```markdown
> ⚠️ **DEPRECATED**: Part 6 has been superseded by Part 20.
> See `docs/build-orders/part-20-architecture-design.md` for current architecture.
```

**Update `README.md` if it references Part 6 architecture.**

---

## PART B: Deployment Scripts

### File 1: `scripts/deploy-part20.sh`

```bash
#!/bin/bash
set -e

echo "========================================="
echo "Part 20 Deployment Script"
echo "========================================="

# Pre-deployment checks
echo "Step 1: Pre-deployment checks..."
npm test || { echo "Tests failed!"; exit 1; }
psql $POSTGRESQL_URI -c "SELECT 1" || { echo "PostgreSQL not accessible!"; exit 1; }
redis-cli -u $REDIS_URL PING || { echo "Redis not accessible!"; exit 1; }

echo "Step 2: Enable maintenance mode..."
curl -X POST https://your-app.com/api/admin/maintenance/enable \
  -H "X-Admin-API-Key: $ADMIN_API_KEY"

echo "Step 3: Deploy application..."
# Railway/Vercel auto-deploys on git push
git push origin main

echo "Step 4: Wait for deployment..."
sleep 60

echo "Step 5: Start sync script on Contabo VPS..."
ssh contabo "cd /opt/trading-alerts/sync && ./start-sync.sh"

echo "Step 6: Verify data flowing..."
curl https://your-app.com/api/health | jq .

echo "Step 7: Run smoke tests..."
curl https://your-app.com/api/indicators/EURUSD/H1 | jq '.success'

echo "Step 8: Disable maintenance mode..."
curl -X POST https://your-app.com/api/admin/maintenance/disable \
  -H "X-Admin-API-Key: $ADMIN_API_KEY"

echo "========================================="
echo "Deployment complete!"
echo "========================================="
```

### File 2: `scripts/rollback-to-part6.sh`

```bash
#!/bin/bash
set -e

echo "========================================="
echo "ROLLBACK: Part 20 → Part 6"
echo "========================================="

echo "WARNING: This will restore Flask MT5 service"
read -p "Are you sure? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

echo "Step 1: Enable maintenance mode..."
curl -X POST https://your-app.com/api/admin/maintenance/enable \
  -H "X-Admin-API-Key: $ADMIN_API_KEY"

echo "Step 2: Stop sync script..."
ssh contabo "cd /opt/trading-alerts/sync && ./stop-sync.sh"

echo "Step 3: Restore Part 6 code..."
cp -r archive/part6-flask-mt5/mt5-service ./

echo "Step 4: Restore environment variables..."
# Restore MT5_API_URL, MT5_API_KEY in production env

echo "Step 5: Start Flask service..."
docker-compose up -d mt5-flask-service

echo "Step 6: Verify Flask responding..."
curl http://localhost:5001/api/health | jq .

echo "Step 7: Disable maintenance mode..."
curl -X POST https://your-app.com/api/admin/maintenance/disable \
  -H "X-Admin-API-Key: $ADMIN_API_KEY"

echo "========================================="
echo "Rollback complete. Part 6 is active."
echo "Please investigate Part 20 issues."
echo "========================================="
```

### File 3: `docs/migration/rollback-to-part6.md`

```markdown
# Rollback to Part 6 (Emergency Only)

## When to Use
Only if Part 20 has critical issues that cannot be fixed quickly:
- Error rate > 5% for 10+ minutes
- Data sync failing for 5+ minutes
- Chart accuracy issues
- Database connection failures

## Prerequisites
- Part 6 code exists in `archive/part6-flask-mt5/`
- MT5 terminals still running with indicators
- Flask dependencies still in requirements

## Quick Rollback (15 minutes)
```bash
./scripts/rollback-to-part6.sh
```

## Manual Rollback Steps
1. Enable maintenance mode
2. Stop sync script on Contabo VPS
3. Restore Part 6 code: `cp -r archive/part6-flask-mt5/mt5-service ./`
4. Restore environment variables (MT5_API_URL, etc.)
5. Start Flask service
6. Verify Flask health endpoint
7. Disable maintenance mode

## Post-Rollback
- Investigate Part 20 issues
- Create fix plan
- Schedule re-migration attempt
```

### File 4: `docs/DEPLOYMENT-CHECKLIST.md`

```markdown
# Part 20 Deployment Checklist

## Pre-Deployment (Day Before)

### Infrastructure
- [ ] PostgreSQL on Railway with TimescaleDB
- [ ] Redis on Railway
- [ ] All 135 tables created with indexes
- [ ] Retention policies configured

### MT5 Setup (Contabo VPS)
- [ ] All 15 MT5 terminals running
- [ ] MQL5 DataCollector service on each terminal
- [ ] SQLite database created and receiving data
- [ ] Sync script tested (SQLite → PostgreSQL)

### Code
- [ ] Phase 0 analysis completed
- [ ] Phases 1-8 code merged to main
- [ ] All Part 6 references updated (Part A steps)
- [ ] All tests passing in CI
- [ ] Build succeeds

## Deployment Day

### Pre-Cutover
- [ ] Notify users of maintenance window (if needed)
- [ ] Backup current production database
- [ ] Test rollback script in staging
- [ ] Confirm team availability

### Cutover
- [ ] Enable maintenance mode
- [ ] Deploy new code
- [ ] Start sync script
- [ ] Verify PostgreSQL has data
- [ ] Verify Redis cache working
- [ ] Verify API endpoints responding
- [ ] Run smoke tests
- [ ] Disable maintenance mode

### Post-Cutover (Monitor 1 hour)
- [ ] Error rate < 1%
- [ ] API response time < 500ms
- [ ] Chart accuracy matches MT5
- [ ] Sync running every 30s
- [ ] Redis cache hit rate > 80%

### Post-Cutover (24 hours)
- [ ] No critical errors
- [ ] User feedback positive
- [ ] Part 6 code archived

### Cleanup (After 30 days stable)
- [ ] Delete archive/part6-flask-mt5/
- [ ] Remove Part 6 references from docs
- [ ] Close migration tracking issues
```

---

## PART C: Verification

### API Endpoint Verification
```bash
# Health check
curl https://your-app.com/api/health

# Indicators (should return data from PostgreSQL)
curl https://your-app.com/api/indicators/EURUSD/H1

# Symbols (tier-filtered)
curl https://your-app.com/api/symbols

# Timeframes (tier-filtered)
curl https://your-app.com/api/timeframes

# Confluence (PRO only)
curl https://your-app.com/api/confluence/EURUSD
```

### Data Accuracy Verification
- [ ] Open MT5 terminal with EURUSD H1 chart
- [ ] Open web app with same chart
- [ ] Compare: OHLC values match
- [ ] Compare: Fractals match
- [ ] Compare: Trendlines match

### Performance Verification
- [ ] API response time < 200ms (cached)
- [ ] API response time < 500ms (uncached)
- [ ] Redis cache hit rate > 80%

---

## Success Criteria
- [ ] All Part 6 references removed from active code
- [ ] Part 6 code archived (not deleted)
- [ ] All API endpoints working
- [ ] Data accuracy verified
- [ ] Performance acceptable
- [ ] Rollback script tested
- [ ] Documentation updated

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
- Add deployment and rollback scripts
- Update all documentation

Part 6 archived to: archive/part6-flask-mt5/
```
```

---

## Summary

| Phase | Focus | Files | Est. Time |
|-------|-------|-------|-----------|
| 00 | Migration Analysis | 1 analysis doc | 1-2 hours |
| 01 | Database Schema Setup | 4 SQL files | 1-2 hours |
| 02 | MQL5 Service Development | 3 MQL5 files | 2-3 hours |
| 03 | Sync Script Development | 5 Python files | 2-3 hours |
| 04 | Next.js API Routes | 8 TypeScript files | 3-4 hours |
| 05 | Redis Caching Layer | 4 TypeScript files | 2 hours |
| 06 | Confluence Score System | 6 TypeScript files | 3-4 hours |
| 07 | Testing Framework | 10 test files | 3-4 hours |
| 08 | E2E Testing Migration | 3 E2E test files | 2-3 hours |
| 09 | Migration & Cutover | 4 scripts + code changes | 3-4 hours |

**Total: ~45 files + code migration, 22-31 hours of implementation**
