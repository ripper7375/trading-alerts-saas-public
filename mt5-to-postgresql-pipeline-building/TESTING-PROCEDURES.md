# MT5 to PostgreSQL Pipeline Testing Procedures

**Part 20 - Post-Deployment Testing & Verification**
**Last Updated:** 2026-01-11
**Status:** ✅ READY FOR USE

---

## Overview

This document provides step-by-step procedures for testing and verifying the MT5 to PostgreSQL data pipeline deployment. These procedures should be followed after deploying the sync script (Step 5) to ensure the system is working correctly.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Testing Scripts Overview](#testing-scripts-overview)
3. [Running Tests](#running-tests)
4. [Test Procedures](#test-procedures)
5. [Interpreting Results](#interpreting-results)
6. [Troubleshooting](#troubleshooting)
7. [Production Readiness Checklist](#production-readiness-checklist)

---

## Prerequisites

### Environment Setup

Ensure the following environment variables are configured:

```bash
# PostgreSQL connection
DATABASE_URL="postgresql://user:password@host:5432/database"
POSTGRESQL_URI="postgresql://user:password@host:5432/database"

# Redis connection
REDIS_URL="redis://default:password@host:6379"

# Optional
ENABLE_REDIS_SYNC="true"
LOG_LEVEL="info"
```

### Dependencies

Install required dependencies:

```bash
npm install
# or
pnpm install
```

Ensure you have the following packages:
- `redis` - Redis client
- `@prisma/client` - PostgreSQL client
- `tsx` - TypeScript executor

---

## Testing Scripts Overview

### 1. **verify-sync-deployment.ts**

**Purpose:** Verifies that the sync package is properly deployed and configured.

**What it checks:**
- Local sync package files exist
- Environment variables are configured
- Database connections work
- Database schema is correct
- Redis data structure is valid

**When to run:** After initial deployment, before running sync script.

---

### 2. **test-mt5-deployment.ts**

**Purpose:** Comprehensive testing of the entire data pipeline.

**What it tests:**
- Redis hot tier (250 candles per symbol)
- PostgreSQL warm tier (135 tables)
- Data freshness (<2 minutes)
- End-to-end data flow
- Query performance (Redis <5ms, PostgreSQL <50ms)

**When to run:** After sync script has been running for at least 5 minutes.

---

### 3. **monitor-mt5-pipeline.ts**

**Purpose:** Continuous health monitoring of the pipeline.

**What it monitors:**
- Redis health and latency
- PostgreSQL health and query performance
- Data freshness
- Data integrity (NULL values, anomalies)

**When to run:** Periodically (every 5-15 minutes) for ongoing monitoring.

---

## Running Tests

### Quick Start

```bash
# 1. Verify deployment
npm run test:mt5:verify

# 2. Test complete pipeline
npm run test:mt5:deployment

# 3. Monitor health
npm run test:mt5:monitor
```

### Detailed Commands

#### 1. Verify Sync Deployment

```bash
npx tsx scripts/verify-sync-deployment.ts
```

**Expected output:**
```
╔═══════════════════════════════════════════════════════╗
║  Sync Package Deployment Verification                ║
║  Part 20 - MT5 to PostgreSQL Pipeline                ║
╚═══════════════════════════════════════════════════════╝

━━━ Verifying Local Sync Package ━━━
✅ config.py: File exists
✅ db_connections.py: File exists
✅ sync_to_postgresql.py: File exists
✅ timeframe_filter.py: File exists
✅ requirements.txt: File exists

━━━ Verifying Environment Configuration ━━━
✅ POSTGRESQL_URI: Set (postgresql://...)
✅ REDIS_URL: Set (redis://...)
✅ DATABASE_URL: Set (postgresql://...)

━━━ Testing Database Connections ━━━
✅ PostgreSQL: Connected: PostgreSQL 15.x...
✅ Redis: Connected: Redis 7.x

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 DEPLOYMENT VERIFICATION SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Overall: 15/15 checks passed
✅ All checks passed - Deployment verified
```

---

#### 2. Test MT5 Deployment

```bash
npx tsx scripts/test-mt5-deployment.ts
```

**Expected output:**
```
╔═══════════════════════════════════════════════════════╗
║  MT5 to PostgreSQL Deployment Testing Suite          ║
║  Part 20 - Post-Sync Script Deployment               ║
╚═══════════════════════════════════════════════════════╝

━━━ Testing Redis Hot Tier ━━━
✅ Redis PING: Response: PONG (2ms)
✅ Redis EURUSD: 250 candles (TTL: 604800s)
✅ Redis BTCUSD: 250 candles (TTL: 604800s)
...
✅ Redis Hot Tier Summary: 15/15 symbols populated
✅ Redis Candle Format: All required fields present
✅ Redis Query Performance: Average: 2.34ms (target: <5ms)

━━━ Testing PostgreSQL Warm Tier ━━━
✅ PostgreSQL Connection: Connection successful
✅ PostgreSQL Tables: Found 135/135 tables
✅ PostgreSQL eurusd_m5: 1200 rows
...
✅ Data Integrity (NULL check): No NULL values found
✅ Data Integrity (Anomaly check): No anomalies found
✅ PostgreSQL Query Performance: Query time: 23ms (target: <50ms)

━━━ Testing Data Freshness ━━━
✅ Data Freshness: Latest candle: 2026-01-11T15:30:00Z (45s old)

━━━ Testing End-to-End Data Flow ━━━
✅ E2E Data Flow: Data present in both Redis and PostgreSQL

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 DEPLOYMENT TEST SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Tests: 45
Passed: 45 ✅
Failed: 0 ❌
Pass Rate: 100%

✅ All tests passed! Deployment is successful.
```

---

#### 3. Monitor Pipeline Health

```bash
npx tsx scripts/monitor-mt5-pipeline.ts
```

**Expected output:**
```
═══════════════════════════════════════════════════════
Health Check - 2026-01-11T15:35:00.000Z
═══════════════════════════════════════════════════════

🔴 Redis: HEALTHY - All systems operational (250 avg candles, 2ms latency)
   Metrics: {"latency_ms":2,"avg_candles":250,"symbols_ok":3,"total_symbols":3}

🐘 PostgreSQL: HEALTHY - All systems operational (1200 rows, 23ms latency)
   Metrics: {"latency_ms":23,"row_count":1200,"tables_found":3}

⏰ Data Freshness: HEALTHY - Data is fresh (45s old)
   Metrics: {"age_seconds":45,"last_update":"2026-01-11T15:34:15.000Z"}

✓  Data Integrity: HEALTHY - Data integrity verified
   Metrics: {"null_count":0,"anomaly_count":0}

───────────────────────────────────────────────────────
Overall Status: HEALTHY
═══════════════════════════════════════════════════════
```

---

## Test Procedures

### Procedure 1: Initial Deployment Verification

**Timeline:** 30 minutes
**Run after:** Sync script deployment (Step 5)

```bash
# Step 1: Verify deployment
npx tsx scripts/verify-sync-deployment.ts

# Step 2: Wait for first sync cycle (60 seconds)
echo "Waiting for sync to run..."
sleep 60

# Step 3: Run comprehensive tests
npx tsx scripts/test-mt5-deployment.ts
```

**Success criteria:**
- All deployment checks pass
- All pipeline tests pass
- Data exists in both Redis and PostgreSQL
- Query performance meets targets

---

### Procedure 2: 24-Hour Stability Test

**Timeline:** 24 hours
**Run after:** Initial deployment verification

```bash
# Create monitoring script
cat > monitor-24h.sh << 'EOF'
#!/bin/bash
for i in {1..288}; do  # Every 5 minutes for 24 hours
  echo "=== Check $i/288 - $(date) ==="
  npx tsx scripts/monitor-mt5-pipeline.ts
  if [ $? -ne 0 ]; then
    echo "❌ Health check failed at iteration $i"
  fi
  sleep 300  # 5 minutes
done
EOF

chmod +x monitor-24h.sh
./monitor-24h.sh > monitor-24h.log 2>&1
```

**Success criteria:**
- No critical failures during 24 hours
- Data freshness maintained (<2 minutes)
- No data gaps
- System resources stable

---

### Procedure 3: Performance Benchmarking

**Timeline:** 1 hour
**Run after:** 24-hour stability test

```bash
# Run multiple iterations to get average performance
for i in {1..10}; do
  echo "=== Iteration $i ==="
  npx tsx scripts/test-mt5-deployment.ts | grep "Performance"
  sleep 60
done
```

**Success criteria:**
- Redis average <5ms
- PostgreSQL average <50ms
- Sync time <10 seconds
- No performance degradation over time

---

## Interpreting Results

### Test Status Icons

- ✅ **Green check:** Test passed
- ❌ **Red X:** Test failed (needs attention)
- ⚠️  **Yellow warning:** Non-critical issue
- 🔴 **Red circle:** Critical failure

### Health Status Levels

1. **HEALTHY** ✅
   - All systems operational
   - Performance within targets
   - No alerts

2. **DEGRADED** ⚠️
   - Some warnings present
   - Performance slightly degraded
   - Non-critical issues

3. **CRITICAL** 🔴
   - Critical failures detected
   - Service unavailable or severely degraded
   - Immediate action required

### Common Test Failures

#### Redis Connection Failed

**Symptom:**
```
❌ Redis Connection: Connection failed: ECONNREFUSED
```

**Solutions:**
1. Check REDIS_URL is correct
2. Verify Redis is running on Railway
3. Check network connectivity
4. Verify credentials

---

#### PostgreSQL Tables Missing

**Symptom:**
```
❌ PostgreSQL Tables: Found 50/135 tables
```

**Solutions:**
1. Run database migrations: `npm run db:push`
2. Check sync script created all tables
3. Verify table creation in sync logs

---

#### Data is Stale

**Symptom:**
```
⚠️  Data Freshness: WARNING - Data is aging (180s old)
```

**Solutions:**
1. Check if sync script is running
2. Verify SQLite is updating (Contabo VPS)
3. Check DataCollector services active in MT5
4. Review sync script logs

---

## Troubleshooting

### Debug Mode

Run tests with verbose output:

```bash
DEBUG=* npx tsx scripts/test-mt5-deployment.ts
```

### Check Individual Components

```bash
# Test only Redis
npx tsx -e "
import { createClient } from 'redis';
const client = createClient({ url: process.env.REDIS_URL });
await client.connect();
console.log(await client.ping());
await client.disconnect();
"

# Test only PostgreSQL
npx tsx -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const result = await prisma.\$queryRaw\`SELECT 1\`;
console.log('PostgreSQL OK');
await prisma.\$disconnect();
"
```

### Review Logs

```bash
# Check sync script logs (on Contabo VPS)
# Location: C:\Scripts\sync_package\sync.log

# Check Railway logs
# Visit: https://railway.app/dashboard
```

---

## Production Readiness Checklist

Use this checklist before declaring the system production-ready:

### Deployment Verification ✅

```
[ ] All sync package files deployed
[ ] Environment variables configured
[ ] Database connections working
[ ] Database schema complete (135 tables)
[ ] Redis data structure valid
```

### Pipeline Testing ✅

```
[ ] Redis hot tier operational (250 candles/symbol)
[ ] PostgreSQL warm tier operational (all 135 tables)
[ ] Data freshness <2 minutes
[ ] End-to-end data flow verified
[ ] Query performance meets targets:
    [ ] Redis <5ms
    [ ] PostgreSQL <50ms
```

### Stability Testing ✅

```
[ ] 24-hour stability test completed
[ ] No data gaps detected
[ ] No critical failures
[ ] System resources stable
```

### Performance Validation ✅

```
[ ] Sync time <10 seconds
[ ] Redis throughput >1000 ops/sec
[ ] Hot path faster than warm path
[ ] Load testing passed
```

### Monitoring Setup ✅

```
[ ] Health check scripts deployed
[ ] Monitoring scheduled (every 5 minutes)
[ ] Alert rules configured
[ ] Logs rotating properly
```

### Documentation ✅

```
[ ] All procedures documented
[ ] Runbooks created
[ ] Team trained
[ ] Emergency procedures tested
```

---

## Automated Testing with CI/CD

Add to your GitHub Actions workflow:

```yaml
# .github/workflows/test-mt5-pipeline.yml
name: MT5 Pipeline Tests

on:
  schedule:
    - cron: '*/15 * * * *'  # Every 15 minutes
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Monitor pipeline health
        env:
          REDIS_URL: ${{ secrets.REDIS_URL }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: npx tsx scripts/monitor-mt5-pipeline.ts

      - name: Send alerts on failure
        if: failure()
        run: |
          # Send notification (email, Slack, etc.)
          echo "Pipeline health check failed!"
```

---

## Summary

These testing procedures ensure your MT5 to PostgreSQL pipeline is:

✅ **Deployed correctly** - All components in place
✅ **Functioning properly** - Data flowing end-to-end
✅ **Performing well** - Meeting performance targets
✅ **Stable** - No issues over 24 hours
✅ **Production-ready** - All checks passed

**Next Steps:**

1. Run `verify-sync-deployment.ts` ✓
2. Run `test-mt5-deployment.ts` ✓
3. Start 24-hour stability test ✓
4. Set up continuous monitoring ✓
5. Deploy to production 🚀

---

**Document Version:** 1.0.0
**Last Updated:** 2026-01-11
**Author:** Claude Code
**Related:** 06-post-sync-script-deployment.md
