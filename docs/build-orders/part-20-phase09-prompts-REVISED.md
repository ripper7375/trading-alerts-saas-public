# Part 20 - Phase 09: Migration, Integration & Cutover (REVISED)

**Version:** 2.0 (Revised after risk validation)
**Purpose:** Execute complete migration from Part 6 to Part 20, including code updates, deployment scripts, and production cutover.
**Previous Version:** part-20-phase09-prompts.md
**Validation Report:** docs/validation/part-20-phase09-risk-validation.md

---

## ⚠️ CRITICAL CHANGES IN THIS REVISION

This revised version addresses **12 critical gaps** identified in the risk validation:

**Priority 1 Fixes (MUST FIX):**
1. ✅ Added Step A9: CI/CD Pipeline Updates
2. ✅ Fixed rollback script docker-compose references
3. ✅ Added API route reversion in rollback script
4. ✅ Added detailed environment variable restore commands
5. ✅ Added data consistency check in rollback script

**Priority 2 Fixes (SHOULD FIX):**
6. ✅ Added alert-checker.ts migration to Step A2
7. ✅ Added Step A8: System Monitor Migration
8. ✅ Fixed file path: lib/api/mt5-client.ts (not lib/services/)
9. ✅ Added git history preservation to Step A6
10. ✅ Added environment variable backup to Step A1
11. ✅ Added docker-compose backup to Step A5
12. ✅ Added Pre-Migration Rollback Testing section

---

## Usage Instructions

### For Claude Code (Web or CLI):
1. Start a fresh Claude Code session
2. Attach/provide access to these 3 documents:
   - `docs/sqlite-and-mt5service/part-20-architecture-design.md`
   - `docs/sqlite-and-mt5service/part-20-implementation-plan.md`
   - `docs/sqlite-and-mt5service/part-20-sqlite-sync-postgresql-openapi.yaml`
3. Copy and paste the prompt below

### For Antigravity (Google AI Agent):
1. Start a new Antigravity session in your local repository directory
2. Ensure Antigravity has access to the repository and can read:
   - `docs/sqlite-and-mt5service/part-20-architecture-design.md`
   - `docs/sqlite-and-mt5service/part-20-implementation-plan.md`
   - `docs/sqlite-and-mt5service/part-20-sqlite-sync-postgresql-openapi.yaml`
3. Give Antigravity the prompt below

### For Other AI Coding Agents:
1. Start a session with file system access to this repository
2. Ensure the agent can read the 3 documents listed above
3. Provide the prompt below

---

## Phase 09 Prompt (REVISED)

````
# Part 20 - Phase 09: Migration, Integration & Cutover (REVISED)

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
- **NEW:** Rollback tested in staging environment

## Your Task
Execute complete migration from Part 6 to Part 20.

---

## PART A: Code Migration

### Step A1: Update Environment Variables

**Files to modify:** `.env.example`, `.env.local.example`

**FIRST: Backup existing Part 6 variables**

```bash
# Create backup for rollback capability
mkdir -p archive/part6-flask-mt5

cat > archive/part6-flask-mt5/.env.part6.backup <<'EOF'
# Part 6 Environment Variables (Backed up for rollback)
MT5_SERVICE_URL=http://localhost:5001
MT5_API_KEY=your-api-key-here
MT5_ADMIN_API_KEY=your-admin-key-here
FLASK_PORT=5001
MT5_API_URL=http://localhost:5000
EOF

echo "✅ Part 6 environment variables backed up"
```

**Remove these Part 6 variables from .env.example:**

```bash
# REMOVE THESE:
MT5_API_URL=http://localhost:5001
MT5_API_KEY=xxx
MT5_ADMIN_API_KEY=xxx
FLASK_PORT=5001
```

**Add/verify Part 20 variables in .env.example:**

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

#### File 1: `app/api/indicators/[symbol]/[timeframe]/route.ts`

```typescript
// BEFORE (Part 6 - calling Flask)
import { fetchIndicatorData } from '@/lib/api/mt5-client';

const data = await fetchIndicatorData(symbol, timeframe, userTier, limit);

// AFTER (Part 20 - direct database via cache)
import { getIndicatorDataCached } from '@/lib/cache/indicator-cache';

const data = await getIndicatorDataCached(symbol, timeframe, limit);
```

#### File 2: `app/api/indicators/health/route.ts`

```typescript
// BEFORE (Part 6 - Flask health)
const response = await fetch(`${process.env.MT5_SERVICE_URL}/api/health`);

// AFTER (Part 20 - PostgreSQL/Redis health)
import { query } from '@/lib/db/postgresql';
import redis from '@/lib/cache/redis';

const pgHealth = await query('SELECT 1');
const redisHealth = await redis.ping();
const isHealthy = pgHealth && redisHealth === 'PONG';
```

#### File 3: `app/api/symbols/route.ts`

```typescript
// BEFORE (Part 6 - Flask symbols endpoint)
const response = await fetch(`${process.env.MT5_SERVICE_URL}/api/symbols`);

// AFTER (Part 20 - Use tier validation)
import { getAccessibleSymbols } from '@/lib/tier/validation';

const symbols = getAccessibleSymbols(userTier);
```

#### File 4: `app/api/timeframes/route.ts`

```typescript
// BEFORE (Part 6 - Flask timeframes endpoint)
const response = await fetch(`${process.env.MT5_SERVICE_URL}/api/timeframes`);

// AFTER (Part 20 - Use tier validation)
import { getAccessibleTimeframes } from '@/lib/tier/validation';

const timeframes = getAccessibleTimeframes(userTier);
```

#### File 5: `lib/jobs/alert-checker.ts` ⚠️ **CRITICAL FIX #6**

```typescript
// BEFORE (Part 6 - calling Flask for price)
const mt5ApiUrl = process.env['MT5_API_URL'] || 'http://localhost:5000';
const response = await fetch(`${mt5ApiUrl}/api/mt5/price?symbol=${symbol}`);
const data = await response.json();
const currentPrice = data.price;

// AFTER (Part 20 - query PostgreSQL directly)
import { query } from '@/lib/db/postgresql';

// Query latest price from PostgreSQL (lightweight query)
const tableName = `${symbol.toLowerCase()}_m5`;
const result = await query<{ close: number }>(
  `SELECT close FROM ${tableName}
   ORDER BY timestamp DESC
   LIMIT 1`
);

if (!result || result.length === 0) {
  throw new Error(`No data found for symbol ${symbol}`);
}

const currentPrice = result[0].close;
```

### Step A3: Update/Remove Service Layer

**Files to DELETE:**

```bash
# These Flask client files are no longer needed
rm lib/api/mt5-client.ts
rm lib/api/mt5-transform.ts
```

**⚠️ IMPORTANT:** Before deleting, ensure no other files import from these. Search first:

```bash
# Check for any remaining imports
grep -r "from '@/lib/api/mt5-client'" app/ lib/ --include="*.ts" --include="*.tsx"
grep -r "from '@/lib/api/mt5-transform'" app/ lib/ --include="*.ts" --include="*.tsx"

# If any found, update them first to use Part 20 services
```

**Files already created in Phases 1-8 (verify they exist):**

```bash
# These should exist from earlier phases
ls -la lib/cache/indicator-cache.ts      # Phase 5
ls -la lib/db/postgresql.ts              # Phase 4
ls -la lib/db/queries.ts                 # Phase 4
ls -la lib/tier/validation.ts            # Phase 4
```

### Step A4: Update Test Mocks

**Update test files to mock Part 20 instead of Part 6:**

```typescript
// BEFORE: Mock Flask
jest.mock('@/lib/api/mt5-client', () => ({
  fetchIndicatorData: jest.fn().mockResolvedValue(mockData),
}));

// AFTER: Mock Part 20
jest.mock('@/lib/cache/indicator-cache', () => ({
  getIndicatorDataCached: jest.fn().mockResolvedValue(mockData),
}));
```

**Files to update:**

- `__tests__/api/indicators.test.ts`
- `__tests__/lib/api/mt5-client.test.ts` → Rename to `indicator-service.test.ts`
- Any integration tests that reference Flask

### Step A5: Update Docker Configuration

**FIRST: Backup current docker-compose.yml** ⚠️ **FIX #11**

```bash
cp docker-compose.yml archive/part6-flask-mt5/docker-compose.part6.yml
echo "✅ Docker Compose configuration backed up for rollback"
```

**Modify `docker-compose.yml`:**

```yaml
# REMOVE this service block entirely:
# mt5-flask-service:
#   build: ./mt5-service
#   ports:
#     - "5001:5001"
#   environment:
#     - MT5_API_KEY=${MT5_API_KEY}

# UPDATE nextjs service to depend only on PostgreSQL and Redis:
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

**First: Preserve Git History** ⚠️ **FIX #9**

```bash
echo "📦 Archiving Part 6 with git history preservation..."

# Create archive directory if not exists
mkdir -p archive/part6-flask-mt5

# Record last working Part 6 commit
git log -1 --oneline mt5-service/ > archive/part6-flask-mt5/LAST_COMMIT.txt

# Record full file list
git ls-files mt5-service/ > archive/part6-flask-mt5/FILE_LIST.txt

# Create git bundle for complete history
git bundle create archive/part6-flask-mt5/part6-history.bundle HEAD mt5-service/

echo "✅ Git history preserved in part6-history.bundle"
```

**Then: Move Part 6 files**

```bash
# Move Part 6 files to archive
mv mt5-service/ archive/part6-flask-mt5/

echo "✅ Part 6 code archived to: archive/part6-flask-mt5/"
```

**Create README in archive:**

Create `archive/part6-flask-mt5/README.md`:

```markdown
# Part 6 - Flask MT5 Service (ARCHIVED)

**Status:** Archived on [DATE]
**Replaced by:** Part 20 (SQLite + Sync to PostgreSQL)

This code is kept for rollback capability only. Do not use in production.

## Why Archived

Python MT5 API cannot access custom indicator buffers (iCustom not available).
Part 20 uses MQL5 Services to read indicators directly from MT5.

## Rollback Instructions

See: `docs/migration/rollback-to-part6.md`

## Git History Restoration

To restore full git history:

```bash
git clone part6-history.bundle restored-part6/
cd restored-part6/
git log mt5-service/
```

## Files Included

See `FILE_LIST.txt` for complete file inventory.

## Last Working Commit

See `LAST_COMMIT.txt` for the last verified working commit.

## Environment Variables Backup

See `.env.part6.backup` for all Part 6 environment variables.

## Docker Configuration Backup

See `docker-compose.part6.yml` for Flask service configuration.
```

### Step A7: Update Documentation

**Add deprecation notice to `docs/build-orders/part-06-flask-mt5.md`:**

```markdown
> ⚠️ **DEPRECATED**: Part 6 has been superseded by Part 20.
>
> **Replacement:** Part 20 (SQLite + Sync to PostgreSQL)
> **Reason:** Python MT5 API lacks iCustom() support
> **Migration Date:** [DATE]
> **Architecture:** See `docs/build-orders/part-20-architecture-design.md`
> **Archived Code:** See `archive/part6-flask-mt5/`
```

**Update `README.md` if it references Part 6 architecture:**

- Replace Flask MT5 service architecture diagrams
- Update data flow diagrams to show Part 20 architecture
- Update setup instructions to remove Flask service steps

### Step A8: Update System Monitoring ⚠️ **CRITICAL FIX #7**

**File:** `lib/monitoring/system-monitor.ts`

```typescript
// BEFORE (Part 6 - Flask health check)
const mt5ServiceUrl = process.env['MT5_SERVICE_URL'];
if (!mt5ServiceUrl) {
  return {
    status: 'error',
    error: 'MT5_SERVICE_URL not configured',
  };
}

const response = await fetch(`${mt5ServiceUrl}/api/health`);
const flaskHealth = await response.json();

// AFTER (Part 20 - PostgreSQL and Redis health)
import { query } from '@/lib/db/postgresql';
import redis from '@/lib/cache/redis';

async function checkSystemHealth() {
  try {
    // Check PostgreSQL connection
    const pgResult = await query('SELECT 1 as health');
    const pgHealthy = pgResult && pgResult.length > 0;

    // Check Redis connection
    const redisResult = await redis.ping();
    const redisHealthy = redisResult === 'PONG';

    // Check sync freshness (data should be < 60s old)
    const syncStatus = await query<{ last_sync: Date }>(
      `SELECT MAX(timestamp) as last_sync
       FROM eurusd_m5`
    );

    const lastSyncAge = Date.now() - new Date(syncStatus[0].last_sync).getTime();
    const syncHealthy = lastSyncAge < 60000; // 60 seconds

    return {
      status: pgHealthy && redisHealthy && syncHealthy ? 'ok' : 'degraded',
      components: {
        postgresql: {
          connected: pgHealthy,
          latency_ms: 0, // Add actual measurement
        },
        redis: {
          connected: redisHealthy,
          latency_ms: 0, // Add actual measurement
        },
        sync: {
          last_sync: syncStatus[0].last_sync,
          age_seconds: Math.floor(lastSyncAge / 1000),
          healthy: syncHealthy,
        },
      },
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
    };
  }
}
```

### Step A9: Update CI/CD Pipelines ⚠️ **CRITICAL FIX #1**

#### 1. Delete Flask CI Workflow

```bash
# Remove Flask-specific CI pipeline
rm .github/workflows/ci-flask.yml

echo "✅ Flask CI workflow removed"
```

#### 2. Update Dependency Security Scan

**File:** `.github/workflows/dependencies-security.yml`

```yaml
# REMOVE this section:
# - name: Scan Flask dependencies
#   run: |
#     cd mt5-service
#     pip install safety
#     safety check -r requirements.txt

# ADD PostgreSQL and Redis checks instead:
- name: Verify PostgreSQL Connection
  env:
    POSTGRESQL_URI: ${{ secrets.POSTGRESQL_URI }}
  run: |
    psql $POSTGRESQL_URI -c "SELECT version();"

- name: Verify Redis Connection
  env:
    REDIS_URL: ${{ secrets.REDIS_URL }}
  run: |
    redis-cli -u $REDIS_URL PING
```

#### 3. Update Deployment Workflow

**File:** `.github/workflows/deploy.yml`

```yaml
# REMOVE Flask deployment:
# - name: Build and Deploy Flask MT5 Service
#   run: |
#     cd mt5-service
#     docker build -t mt5-service .
#     docker push $DOCKER_REGISTRY/mt5-service:latest

# UPDATE to verify Part 20 infrastructure:
- name: Verify Part 20 Infrastructure
  env:
    POSTGRESQL_URI: ${{ secrets.POSTGRESQL_URI }}
    REDIS_URL: ${{ secrets.REDIS_URL }}
  run: |
    echo "Checking PostgreSQL tables..."
    psql $POSTGRESQL_URI -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public' AND tablename LIKE '%_m5';"

    echo "Checking Redis connection..."
    redis-cli -u $REDIS_URL PING

    echo "✅ Part 20 infrastructure verified"

- name: Run Database Migrations
  env:
    POSTGRESQL_URI: ${{ secrets.POSTGRESQL_URI }}
  run: |
    npm run db:migrate
```

#### 4. Update Test Workflow

**File:** `.github/workflows/test.yml`

```yaml
# UPDATE test environment to use PostgreSQL instead of Flask mock
env:
  POSTGRESQL_URI: postgresql://test:test@localhost:5432/test_db
  REDIS_URL: redis://localhost:6379

services:
  postgres:
    image: timescale/timescaledb:latest-pg15
    env:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: test_db
    ports:
      - 5432:5432

  redis:
    image: redis:7-alpine
    ports:
      - 6379:6379
```

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
npm test || { echo "❌ Tests failed!"; exit 1; }

echo "Checking PostgreSQL connection..."
psql $POSTGRESQL_URI -c "SELECT 1" || { echo "❌ PostgreSQL not accessible!"; exit 1; }

echo "Checking Redis connection..."
redis-cli -u $REDIS_URL PING || { echo "❌ Redis not accessible!"; exit 1; }

echo "Verifying database schema..."
TABLE_COUNT=$(psql $POSTGRESQL_URI -t -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public' AND tablename LIKE '%_m5';")
if [ "$TABLE_COUNT" -lt 15 ]; then
  echo "❌ Expected 15+ tables, found $TABLE_COUNT"
  exit 1
fi

echo "✅ All pre-deployment checks passed"

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
sleep 30
curl https://your-app.com/api/health | jq .

echo "Step 7: Run smoke tests..."
SMOKE_TEST=$(curl -s https://your-app.com/api/indicators/EURUSD/H1 | jq '.success')
if [ "$SMOKE_TEST" != "true" ]; then
  echo "❌ Smoke test failed!"
  echo "⚠️  Consider rolling back"
  exit 1
fi

echo "✅ Smoke tests passed"

echo "Step 8: Disable maintenance mode..."
curl -X POST https://your-app.com/api/admin/maintenance/disable \
  -H "X-Admin-API-Key: $ADMIN_API_KEY"

echo "========================================="
echo "✅ Deployment complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Monitor error rates for 1 hour"
echo "2. Check sync script logs"
echo "3. Verify chart accuracy"
echo "4. Keep Flask service archived for 30 days"
```

### File 2: `scripts/rollback-to-part6.sh` (REVISED with Fixes #2, #3, #4, #5)

```bash
#!/bin/bash
set -e

echo "========================================="
echo "ROLLBACK: Part 20 → Part 6"
echo "========================================="

echo "⚠️  WARNING: This will restore Flask MT5 service"
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

echo "Step 2.5: Check for data consistency issues..." # ⚠️ FIX #5
# Check last Flask data timestamp
echo "Checking data freshness gap..."

# Check PostgreSQL last sync
PG_LAST_SYNC=$(psql $POSTGRESQL_URI -t -c "
  SELECT EXTRACT(EPOCH FROM MAX(timestamp))::INTEGER FROM eurusd_m5
")

echo "⚠️  Data Gap Analysis:"
echo "   PostgreSQL last sync: $(date -d @$PG_LAST_SYNC)"
echo ""
echo "   Note: Flask service will need time to catch up after restart"
echo "   Users may see data lag of up to $(( ($(date +%s) - $PG_LAST_SYNC) / 60 )) minutes"
echo ""

GAP_MINUTES=$(( ($(date +%s) - $PG_LAST_SYNC) / 60 ))
if [ $GAP_MINUTES -gt 60 ]; then
  echo "🔴 WARNING: Data gap > 1 hour!"
  echo "   Users will see stale data after rollback."
  echo "   Recommendations:"
  echo "   1. Display 'Data refreshing, please wait' banner"
  echo "   2. Disable alerts temporarily"
  echo "   3. Monitor Flask sync progress"
  echo ""
  read -p "Continue with rollback anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

echo "Step 3: Restore Part 6 code from archive..."
cp -r archive/part6-flask-mt5/mt5-service ./

echo "✅ Part 6 code restored"

echo "Step 3.5: Revert API routes to use Flask..." # ⚠️ FIX #3
git restore app/api/indicators/[symbol]/[timeframe]/route.ts
git restore app/api/indicators/health/route.ts
git restore app/api/symbols/route.ts
git restore app/api/timeframes/route.ts
git restore lib/jobs/alert-checker.ts
git restore lib/monitoring/system-monitor.ts

# Restore Flask client files if they were deleted
if [ ! -f lib/api/mt5-client.ts ]; then
  git restore lib/api/mt5-client.ts
fi

echo "✅ API routes reverted to Flask integration"

echo "Step 4: Restore environment variables..." # ⚠️ FIX #4

# Local development
if [ -f .env ]; then
  echo "Restoring environment variables to .env..."
  cat archive/part6-flask-mt5/.env.part6.backup >> .env
  echo "✅ Environment variables restored to .env"
fi

# Production (Railway) - requires manual action
echo ""
echo "⚠️  MANUAL STEP REQUIRED FOR PRODUCTION:"
echo "   1. Go to Railway dashboard: https://railway.app"
echo "   2. Navigate to your project settings"
echo "   3. Add these variables:"
echo ""
cat archive/part6-flask-mt5/.env.part6.backup
echo ""
read -p "Press Enter after adding variables to Railway..."

echo "Step 5: Restore Docker Compose configuration..." # ⚠️ FIX #2
cp archive/part6-flask-mt5/docker-compose.part6.yml docker-compose.yml
echo "✅ Docker Compose configuration restored"

echo "Step 6: Start Flask service..."
docker-compose up -d mt5-service

echo "Waiting for Flask service to start..."
sleep 10

echo "Step 7: Verify Flask responding..."
for i in {1..5}; do
  if curl -s http://localhost:5001/api/health | jq -e '.status == "ok"' > /dev/null; then
    echo "✅ Flask service is healthy"
    break
  fi
  echo "Attempt $i/5: Flask not ready yet, waiting..."
  sleep 5
done

# Verify Flask is actually working
FLASK_HEALTH=$(curl -s http://localhost:5001/api/health | jq -r '.status')
if [ "$FLASK_HEALTH" != "ok" ]; then
  echo "❌ Flask service failed to start properly"
  echo "Status: $FLASK_HEALTH"
  exit 1
fi

echo "Step 8: Test indicator endpoint..."
INDICATOR_TEST=$(curl -s http://localhost:5001/api/indicators/EURUSD/H1 | jq -r '.success')
if [ "$INDICATOR_TEST" != "true" ]; then
  echo "⚠️  Indicator endpoint test failed"
  echo "   Flask may need more time to initialize MT5 connections"
fi

echo "Step 9: Disable maintenance mode..."
curl -X POST https://your-app.com/api/admin/maintenance/disable \
  -H "X-Admin-API-Key: $ADMIN_API_KEY"

echo "========================================="
echo "✅ Rollback complete. Part 6 is active."
echo "========================================="
echo ""
echo "Post-Rollback Checklist:"
echo "  1. Monitor error rates"
echo "  2. Check MT5 terminal connections"
echo "  3. Verify chart data accuracy"
echo "  4. Investigate Part 20 issues"
echo "  5. Plan re-migration after fixes"
echo ""
echo "Data Freshness:"
echo "  Flask may take time to catch up with current data"
echo "  Expected lag: $GAP_MINUTES minutes"
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
- Flask dependencies still available
- Docker configuration backup exists

## Quick Rollback (15-30 minutes)

```bash
./scripts/rollback-to-part6.sh
```

## Manual Rollback Steps

If automated script fails:

1. Enable maintenance mode
2. Stop sync script on Contabo VPS
3. Restore Part 6 code: `cp -r archive/part6-flask-mt5/mt5-service ./`
4. Restore Docker config: `cp archive/part6-flask-mt5/docker-compose.part6.yml docker-compose.yml`
5. Restore environment variables from `archive/part6-flask-mt5/.env.part6.backup`
6. Revert API route files with `git restore`
7. Start Flask service: `docker-compose up -d mt5-service`
8. Verify Flask health endpoint: `curl http://localhost:5001/api/health`
9. Disable maintenance mode

## Post-Rollback

- Monitor system for 2 hours
- Investigate Part 20 issues
- Create fix plan
- Schedule re-migration attempt

## Data Consistency Notes

After rollback, there will be a data gap:
- PostgreSQL has data up to rollback time
- Flask has data up to when it was last running
- Gap = time Part 20 was running

Recommendations:
- Display "Data refreshing" banner to users
- Disable alerts temporarily
- Monitor Flask sync progress
- Document gap duration for analysis
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

### Critical: Rollback Testing ⚠️ FIX #12
- [ ] Rollback script tested in staging
- [ ] Rollback completes in < 15 minutes
- [ ] Flask service starts successfully after rollback
- [ ] API routes work with Flask after rollback
- [ ] Data gap documented and acceptable
- [ ] Team trained on rollback procedure

## Deployment Day

### Pre-Cutover
- [ ] Notify users of maintenance window (if needed)
- [ ] Backup current production database
- [ ] Verify rollback script works
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
- [ ] Part 6 code remains archived (don't delete yet)

### Cleanup (After 30 days stable)
- [ ] Delete archive/part6-flask-mt5/ (optional)
- [ ] Remove Part 6 references from docs
- [ ] Close migration tracking issues
```

---

## PART C: Verification

### Pre-Migration: Test Rollback in Staging ⚠️ **CRITICAL FIX #12**

**BEFORE deploying to production, complete this checklist in staging:**

#### Staging Rollback Test

```bash
# 1. Deploy Part 20 to staging
git checkout claude/implement-phase09-prompts-ZmJLD
export ENVIRONMENT=staging
./scripts/deploy-part20.sh

# 2. Verify Part 20 works
echo "Testing Part 20 endpoints..."
curl https://staging.your-app.com/api/health
curl https://staging.your-app.com/api/indicators/EURUSD/H1

# 3. Simulate failure (optional - to trigger rollback)
# docker stop postgres

# 4. Execute rollback
./scripts/rollback-to-part6.sh

# 5. Verify rollback success
curl http://localhost:5001/api/health
curl http://localhost:5001/api/indicators/EURUSD/H1

# 6. Time the rollback
# Target: < 15 minutes
```

**Rollback Test Checklist:**
- [ ] Part 20 deployed successfully
- [ ] Part 20 API returns data
- [ ] Rollback script executed without errors
- [ ] Flask service started successfully
- [ ] API endpoints work with Flask
- [ ] Charts render correctly
- [ ] No errors in logs
- [ ] Data gap documented
- [ ] Rollback completed in < 15 minutes

**⚠️ Only proceed to production after successful staging rollback test.**

### API Endpoint Verification

```bash
# Health check
curl https://your-app.com/api/health

# Expected response:
# {
#   "status": "ok",
#   "components": {
#     "postgresql": { "connected": true },
#     "redis": { "connected": true },
#     "sync": { "healthy": true }
#   }
# }

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

### Cache Compatibility Verification ⚠️ **FIX #5 (additional)**

```bash
# Clear cache before migration
redis-cli -u $REDIS_URL FLUSHALL

# Or selective clear
redis-cli -u $REDIS_URL --scan --pattern "indicators:*" | xargs redis-cli -u $REDIS_URL DEL

echo "✅ Cache cleared for fresh start"
```

---

## Success Criteria

- [ ] All Part 6 references removed from active code
- [ ] Part 6 code archived with git history (not deleted)
- [ ] All API endpoints working
- [ ] Data accuracy verified
- [ ] Performance acceptable
- [ ] Rollback script tested and works
- [ ] Documentation updated
- [ ] CI/CD pipelines updated
- [ ] System monitoring updated
- [ ] Alert system working

## Commit Instructions

After completing all migration steps:

```bash
git add -A

git commit -m "feat: migrate from Part 6 (Flask) to Part 20 (SQLite + Sync + PostgreSQL)

BREAKING CHANGE: Flask MT5 service removed

Migration includes:
- Remove Flask service and MT5 Python API dependencies
- Update API routes to use PostgreSQL directly
- Update environment variables
- Update Docker configuration
- Archive Part 6 code with git history for rollback capability
- Add deployment and rollback scripts with all safety checks
- Update CI/CD pipelines (remove Flask CI, update deploy)
- Update system monitoring (PostgreSQL/Redis health)
- Update alert checker (direct PostgreSQL queries)
- Update all documentation

Part 6 archived to: archive/part6-flask-mt5/

Validation: docs/validation/part-20-phase09-risk-validation.md
Addresses: 12 critical gaps from validation report"
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
| 09 | Migration & Cutover (REVISED) | 4 scripts + code changes + CI/CD | 6-8 hours |

**Total: ~45 files + code migration + CI/CD updates, 25-35 hours of implementation**

**Key Changes in Revision:**
- Added 3 new migration steps (A8, A9, rollback testing)
- Enhanced rollback script with 5 critical safety checks
- Added backup procedures for all critical configs
- Fixed file path errors
- Added git history preservation
- Updated CI/CD pipelines
- Added comprehensive verification steps

**⚠️ IMPORTANT:** This revised version addresses all 12 critical gaps identified in the validation report. Do not use the original phase09 prompt - use this revised version instead.
````
