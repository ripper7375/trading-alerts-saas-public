# Claude Chat Testing Guide
**MT5 to PostgreSQL Pipeline - Step 6 Testing**

---

## Purpose

This document provides all necessary information for Claude Chat to assist you in testing the MT5 to PostgreSQL data pipeline deployment (Step 6: Post-Sync Script Deployment Testing).

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CONTABO VPS (Windows)                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  MT5 Terminal #1-15 (15 instances)                   │   │
│  │  └─ DataCollector.mq5 (MQL5 Service)                │   │
│  │     └─ Writes to SQLite (trading_data.db)           │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Python Sync Script (runs every 30s)                │   │
│  │  Location: C:\Scripts\sync_package\                 │   │
│  │  └─ Reads SQLite                                     │   │
│  │  └─ Syncs to Railway (PostgreSQL + Redis)           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    RAILWAY (Cloud)                          │
│  ┌──────────────────────┐  ┌──────────────────────────┐    │
│  │  Redis (Hot Tier)    │  │  PostgreSQL (Warm Tier) │    │
│  │  • 250 candles       │  │  • 135 timeframe tables │    │
│  │  • <1ms latency      │  │  • 10,000 rows max      │    │
│  │  • Real-time data    │  │  • Historical data      │    │
│  └──────────────────────┘  └──────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Environment Information

### Infrastructure

**Contabo VPS:**
- Location: Remote Windows Server
- MT5 Terminals: 15 instances running
- SQLite Database: `C:\MT5Data\trading_data.db`
- Sync Script: `C:\Scripts\sync_package\`

**Railway (Cloud):**
- PostgreSQL: Warm tier storage (135 tables)
- Redis: Hot tier cache (250 candles per symbol)
- Connection: Via environment variables

### Symbols (15 total)

```
Currency Pairs: AUDJPY, AUDUSD, EURUSD, GBPJPY, GBPUSD, NZDUSD, USDCAD, USDCHF, USDJPY
Crypto: BTCUSD, ETHUSD
Indices: NDX100, US30
Metals: XAGUSD, XAUUSD
```

### Timeframes (9 total)

```
M5, M15, M30, H1, H2, H4, H8, H12, D1
```

### Expected Data Structure

**Redis Hot Tier:**
- **Keys:** `{symbol}:realtime` (e.g., `eurusd:realtime`)
- **Data Type:** Sorted Set (ZSET)
- **Candle Count:** ~250 per symbol
- **Format:** `{"t": timestamp, "o": open, "h": high, "l": low, "c": close}`
- **TTL:** 7 days (604800 seconds)

**PostgreSQL Warm Tier:**
- **Tables:** 135 total (15 symbols × 9 timeframes)
- **Table Names:** `{symbol}_{timeframe}` (e.g., `eurusd_m5`)
- **Columns:** `timestamp`, `open`, `high`, `low`, `close`
- **Max Rows:** 10,000 per table

---

## Testing Scripts

### 1. Verify Sync Deployment
**Command:** `npm run test:mt5:verify`

**What it checks:**
- ✅ Sync package files exist locally
- ✅ Environment variables configured
- ✅ Database connections working
- ✅ Database schema (135 tables)
- ✅ Redis data structure

### 2. Test Complete Pipeline
**Command:** `npm run test:mt5:deployment`

**What it tests:**
- ✅ Redis hot tier (250 candles per symbol, <5ms queries)
- ✅ PostgreSQL warm tier (135 tables, <50ms queries)
- ✅ Data freshness (<2 minutes)
- ✅ End-to-end data flow
- ✅ Performance benchmarks

### 3. Monitor Pipeline Health
**Command:** `npm run test:mt5:monitor`

**What it monitors:**
- ✅ Redis latency and availability
- ✅ PostgreSQL performance
- ✅ Data freshness
- ✅ Data integrity (no NULLs, no anomalies)

---

## Performance Targets

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| Redis query time | <5ms | >10ms |
| PostgreSQL query | <50ms | >100ms |
| Data freshness | <120s | >300s |
| Sync frequency | 30s | >60s |
| Error rate | <1% | >5% |
| Uptime | >99.9% | <99% |

---

## Environment Variables Required

```bash
# PostgreSQL (Railway)
DATABASE_URL="postgresql://user:password@host:5432/database"
POSTGRESQL_URI="postgresql://user:password@host:5432/database"

# Redis (Railway)
REDIS_URL="redis://default:password@host:6379"

# Optional
ENABLE_REDIS_SYNC="true"
LOG_LEVEL="info"
```

---

## Testing Workflow

### Phase 1: Initial Verification (30 minutes)

```bash
# Step 1: Verify deployment
npm run test:mt5:verify

# Step 2: Wait for sync cycle (60 seconds)
# The sync script runs every 30 seconds on Contabo VPS

# Step 3: Test complete pipeline
npm run test:mt5:deployment
```

**Success Criteria:**
- ✅ All deployment checks pass
- ✅ All pipeline tests pass
- ✅ Data exists in both Redis and PostgreSQL
- ✅ Query performance meets targets

### Phase 2: 24-Hour Stability Test (automated)

```bash
# Run health check every 5 minutes for 24 hours
for i in {1..288}; do
  echo "=== Check $i/288 - $(date) ==="
  npm run test:mt5:monitor
  sleep 300
done > stability-test.log 2>&1
```

**Success Criteria:**
- ✅ No critical failures during 24 hours
- ✅ Data freshness maintained (<2 minutes)
- ✅ No data gaps
- ✅ System resources stable

### Phase 3: Performance Benchmarking (1 hour)

```bash
# Run multiple iterations to get averages
for i in {1..10}; do
  echo "=== Iteration $i ==="
  npm run test:mt5:deployment | grep "Performance"
  sleep 60
done
```

**Success Criteria:**
- ✅ Redis average <5ms
- ✅ PostgreSQL average <50ms
- ✅ No performance degradation over time

---

## Common Issues & Solutions

### Issue 1: "REDIS_URL not configured"

**Symptoms:**
```
❌ Redis Connection: Redis not available
```

**Solutions:**
1. Check `.env.local` or `.env` file exists
2. Verify REDIS_URL is set: `echo $REDIS_URL`
3. Test connection manually:
   ```bash
   npx tsx -e "
   import { createClient } from 'redis';
   const client = createClient({ url: process.env['REDIS_URL'] });
   await client.connect();
   console.log(await client.ping());
   await client.disconnect();
   "
   ```

### Issue 2: PostgreSQL tables missing

**Symptoms:**
```
❌ PostgreSQL Tables: Found 50/135 tables
```

**Solutions:**
1. Check sync script has run: `C:\Scripts\sync_package\sync.log` (on Contabo)
2. Run database migrations: `npm run db:push`
3. Verify sync script is scheduled (Task Scheduler on Contabo VPS)

### Issue 3: Data is stale

**Symptoms:**
```
⚠️ Data Freshness: WARNING - Data is aging (180s old)
```

**Solutions:**
1. Check sync script is running (Task Scheduler on Contabo VPS)
2. Verify SQLite is updating: Check `C:\MT5Data\trading_data.db` modified time
3. Check DataCollector services active in all 15 MT5 instances
4. Review sync logs: `C:\Scripts\sync_package\sync.log`

### Issue 4: Sync script errors

**Location:** `C:\Scripts\sync_package\sync.log` (on Contabo VPS)

**Common errors:**
- Database connection failures
- Network timeouts
- Insufficient permissions
- Missing Python dependencies

---

## Test Result Interpretation

### Health Status Levels

**HEALTHY** ✅
- All systems operational
- Performance within targets
- No alerts

**DEGRADED** ⚠️
- Some warnings present
- Performance slightly degraded
- Non-critical issues

**CRITICAL** 🔴
- Critical failures detected
- Service unavailable or severely degraded
- Immediate action required

### Exit Codes

Scripts return these exit codes:
- `0` - Success (all tests passed / HEALTHY)
- `1` - Warning (some non-critical issues / DEGRADED)
- `2` - Critical failure (CRITICAL)
- `3` - Fatal error (script crashed)

---

## Checklist for Claude Chat

When assisting with testing, guide the user through:

### Pre-Testing Checklist
```
[ ] Environment variables configured (.env.local)
[ ] Dependencies installed (npm install)
[ ] Prisma generated (npm run db:generate)
[ ] Contabo VPS accessible
[ ] MT5 instances running (15 total)
[ ] MQL5 indicators installed (6 indicators in all 15 instances)
[ ] DataCollector services active in all MT5 instances
[ ] SQLite database updating (<60s old)
[ ] Sync script deployed (C:\Scripts\sync_package\)
[ ] Task Scheduler configured (30-second intervals)
```

### Testing Execution Checklist
```
[ ] Run test:mt5:verify - All checks pass
[ ] Wait 60 seconds for sync cycle
[ ] Run test:mt5:deployment - All tests pass
[ ] Review results - No critical failures
[ ] Run test:mt5:monitor - Status HEALTHY
[ ] Check performance metrics - Within targets
```

### Post-Testing Checklist
```
[ ] Document test results
[ ] Save logs if any issues found
[ ] Schedule 24-hour stability test
[ ] Set up continuous monitoring
[ ] Train team on procedures
```

---

## Quick Reference Commands

```bash
# Run all tests
npm run test:mt5:all

# Individual tests
npm run test:mt5:verify       # Verify deployment
npm run test:mt5:deployment   # Test complete pipeline
npm run test:mt5:monitor      # Monitor health

# Debug commands
npx tsx scripts/verify-sync-deployment.ts
npx tsx scripts/test-mt5-deployment.ts
npx tsx scripts/monitor-mt5-pipeline.ts
```

---

## Expected Test Output Examples

### Successful Deployment Verification

```
╔═══════════════════════════════════════════════════════╗
║  Sync Package Deployment Verification                ║
╚═══════════════════════════════════════════════════════╝

━━━ Verifying Local Sync Package ━━━
✅ config.py: File exists
✅ db_connections.py: File exists
✅ sync_to_postgresql.py: File exists

━━━ Verifying Environment Configuration ━━━
✅ POSTGRESQL_URI: Set (postgresql://...)
✅ REDIS_URL: Set (redis://...)

━━━ Testing Database Connections ━━━
✅ PostgreSQL: Connected
✅ Redis: Connected

Overall: 15/15 checks passed
✅ All checks passed - Deployment verified
```

### Successful Pipeline Test

```
━━━ Testing Redis Hot Tier ━━━
✅ Redis PING: Response: PONG (2ms)
✅ Redis EURUSD: 250 candles (TTL: 604800s)
✅ Redis Query Performance: Average: 2.34ms (target: <5ms)

━━━ Testing PostgreSQL Warm Tier ━━━
✅ PostgreSQL Tables: Found 135/135 tables
✅ PostgreSQL Query Performance: Query time: 23ms (target: <50ms)

Total Tests: 45
Passed: 45 ✅
Pass Rate: 100%
✅ All tests passed! Deployment is successful.
```

### Successful Health Check

```
Health Check - 2026-01-11T15:35:00.000Z

🔴 Redis: HEALTHY - All systems operational (250 avg candles, 2ms latency)
🐘 PostgreSQL: HEALTHY - All systems operational (1200 rows, 23ms latency)
⏰ Data Freshness: HEALTHY - Data is fresh (45s old)
✓  Data Integrity: HEALTHY - Data integrity verified

Overall Status: HEALTHY
```

---

## Support Resources

- [TESTING-PROCEDURES.md](./TESTING-PROCEDURES.md) - Detailed testing guide
- [06-post-sync-script-deployment.md](./06-post-sync-script-deployment.md) - Comprehensive reference
- [README.md](./README.md) - Overview and quick start
- [IMPLEMENTATION-SUMMARY.md](./IMPLEMENTATION-SUMMARY.md) - Implementation details

---

**Last Updated:** 2026-01-11
**Version:** 1.1.0
**Purpose:** Claude Chat Testing Assistant Guide
