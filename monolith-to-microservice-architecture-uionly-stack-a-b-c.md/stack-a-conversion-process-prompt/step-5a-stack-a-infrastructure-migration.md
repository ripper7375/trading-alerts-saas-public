# Step 5A: Infrastructure Migration - Database & Cache

## Overview

This document guides you through **Part A of Step 5**: Migrating your database and cache infrastructure from Railway to cloud-native providers (Timescale Cloud and Upstash).

**⚠️ CRITICAL: Complete this BEFORE starting Step 5B (Backend Migration)**

**Key migrations:**

- **Database**: Railway PostgreSQL → Timescale Cloud (PostgreSQL 15 + TimescaleDB)
- **Cache**: Railway Redis → Upstash Redis

**Why migrate infrastructure first:**

1. ✅ Test infrastructure changes with existing Next.js backend (minimal risk)
2. ✅ Verify database and cache work before touching backend code
3. ✅ Nest.js migration (Step 5B) can use stable infrastructure from Day 1
4. ✅ Easy rollback - only one thing changes at a time
5. ✅ Zero downtime - Next.js keeps running during infrastructure migration

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Phase 1: Database Migration (Railway → Timescale Cloud)](#phase-1-database-migration)
4. [Phase 2: Cache Migration (Railway → Upstash)](#phase-2-cache-migration)
5. [Phase 3: Testing & Verification](#phase-3-testing--verification)
6. [Rollback Procedures](#rollback-procedures)
7. [Cost Comparison](#cost-comparison)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Before Starting

- [x] **Next.js monolith deployed on Vercel** (currently working)
- [x] **Railway PostgreSQL** (current database)
- [x] **Railway Redis** (current cache)
- [x] **Prisma schema** at `prisma/schema.prisma`
- [x] **TimescaleDB setup scripts** at `sql/timescaledb_setup.sql`
- [x] **Access to production environment variables**
- [x] **Backup procedures documented**

### Required Accounts

- [x] **Timescale Cloud account** - https://console.cloud.timescale.com
- [x] **Upstash account** - https://console.upstash.com
- [x] **Vercel account** (existing - for updating environment variables)

### Tools Required

```bash
# Install PostgreSQL client tools
brew install postgresql@15  # macOS
# or
sudo apt-get install postgresql-client-15  # Ubuntu

# Verify installation
pg_dump --version  # Should show PostgreSQL 15.x
psql --version     # Should show PostgreSQL 15.x

# Install Redis CLI (optional, for verification)
brew install redis  # macOS
# or
sudo apt-get install redis-tools  # Ubuntu
```

---

## Architecture Overview

### Current Architecture (Monolith)

```
┌─────────────────────────────────────┐
│   Next.js App on Vercel            │
│   (Frontend + API Routes + Prisma) │
└─────────────┬───────────────────────┘
              │
              ├─────────► Railway PostgreSQL (Standard PostgreSQL 15)
              │           • Cost: ~$5-20/month
              │           • Type: Self-managed instance
              │
              └─────────► Railway Redis (Standard Redis)
                          • Cost: ~$5-10/month
                          • Type: Self-managed instance
```

### Target Architecture (After Step 5A)

```
┌─────────────────────────────────────┐
│   Next.js App on Vercel            │
│   (Frontend + API Routes + Prisma) │
│   NO CODE CHANGES ✅               │
└─────────────┬───────────────────────┘
              │
              ├─────────► Timescale Cloud (PostgreSQL 15 + TimescaleDB)
              │           • Cost: ~$25-50/month
              │           • Type: Managed PostgreSQL with time-series
              │           • Features: Hypertables, compression, retention
              │
              └─────────► Upstash Redis (Serverless Redis)
                          • Cost: ~$5-10/month (pay-per-use)
                          • Type: Serverless with REST API
                          • Features: Global replication, TLS
```

**Important:** Next.js code remains **unchanged** - only connection strings are updated.

---

## Phase 1: Database Migration

**Estimated Time:** 2-4 hours
**Risk Level:** Low (Next.js backward compatible with PostgreSQL 15)
**Downtime Required:** 5-15 minutes (optional - can do zero-downtime migration)

### Step 1.1: Create Timescale Cloud Service

**1. Sign up for Timescale Cloud:**

Visit: https://console.cloud.timescale.com

**2. Create a new service:**

```yaml
Service Name: trading-alerts-production
Region: us-east-1 (or closest to your Railway deployment)
Database: PostgreSQL 15
Compute: 0.5 CPU / 2 GB RAM (can scale later)
Storage: 25 GB (can scale later)
Plan: Dynamic Compute
```

**3. Wait for service provisioning (2-3 minutes)**

**4. Copy connection details:**

You'll receive:

```
Host: [service-id].tsdb.cloud.timescale.com
Port: 5432
Database: tsdb
Username: tsdbadmin
Password: [generated-password]
```

**5. Construct connection string:**

```bash
# Timescale Cloud connection string (save this)
postgresql://tsdbadmin:[password]@[service-id].tsdb.cloud.timescale.com:5432/tsdb?sslmode=require
```

**⚠️ Important:** `sslmode=require` is **mandatory** for Timescale Cloud.

---

### Step 1.2: Backup Current Database

**1. Export from Railway PostgreSQL:**

```bash
# Get Railway database URL from Railway dashboard
export RAILWAY_DATABASE_URL="postgresql://postgres:password@containers-us-west-123.railway.app:5432/railway"

# Create backup directory
mkdir -p backups
cd backups

# Export database with data
pg_dump $RAILWAY_DATABASE_URL \
  --format=custom \
  --file=railway_backup_$(date +%Y%m%d_%H%M%S).dump \
  --verbose

# Also create SQL format backup (for inspection)
pg_dump $RAILWAY_DATABASE_URL \
  --format=plain \
  --file=railway_backup_$(date +%Y%m%d_%H%M%S).sql \
  --verbose

# Verify backup files exist
ls -lh railway_backup_*

# Expected output:
# railway_backup_20260111_143022.dump  (binary format, smaller)
# railway_backup_20260111_143022.sql   (text format, human-readable)
```

**2. Verify backup integrity:**

```bash
# Check backup file is valid
pg_restore --list railway_backup_*.dump | head -20

# Should show table of contents with all tables
```

**3. Store backup safely:**

```bash
# Upload to cloud storage (recommended)
# Example with AWS S3:
aws s3 cp railway_backup_*.dump s3://your-backup-bucket/database-backups/

# Or keep local copy in multiple locations
cp railway_backup_*.dump ~/Dropbox/trading-alerts-backups/
```

---

### Step 1.3: Import to Timescale Cloud

**1. Set Timescale Cloud connection string:**

```bash
export TIMESCALE_DATABASE_URL="postgresql://tsdbadmin:[password]@[service-id].tsdb.cloud.timescale.com:5432/tsdb?sslmode=require"
```

**2. Test connection:**

```bash
psql $TIMESCALE_DATABASE_URL -c "SELECT version();"

# Expected output:
# PostgreSQL 15.x on x86_64-pc-linux-gnu, compiled by gcc ...
```

**3. Import Prisma schema (application tables):**

```bash
# Navigate to project root
cd /home/user/trading-alerts-saas-public

# Run Prisma migrations to create application tables
DATABASE_URL=$TIMESCALE_DATABASE_URL npx prisma migrate deploy

# Verify tables created
psql $TIMESCALE_DATABASE_URL -c "\dt" | head -20

# Should show tables: User, Subscription, Payment, etc.
```

**4. Import time-series tables:**

```bash
# Import time-series table definitions (135 tables)
psql $TIMESCALE_DATABASE_URL < sql/postgresql_schema.sql

# Verify time-series tables created
psql $TIMESCALE_DATABASE_URL -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%_m5' ORDER BY tablename;"

# Expected output (15 tables):
# audjpy_m5
# audusd_m5
# btcusd_m5
# ... (15 symbols)
```

**5. Enable TimescaleDB and create hypertables:**

```bash
# Run TimescaleDB setup (hypertables, retention, compression)
psql $TIMESCALE_DATABASE_URL < sql/timescaledb_setup.sql

# Verify hypertables created
psql $TIMESCALE_DATABASE_URL -c "SELECT hypertable_name FROM timescaledb_information.hypertables ORDER BY hypertable_name LIMIT 10;"

# Expected output (135 hypertables):
# audjpy_d1
# audjpy_h1
# audjpy_h12
# audjpy_h2
# audjpy_h4
# audjpy_h8
# audjpy_m15
# audjpy_m30
# audjpy_m5
# audusd_d1
# ... (135 total)
```

**6. Import data from Railway backup (if you have existing data):**

```bash
# Option A: If you have existing market data in Railway PostgreSQL
# Export time-series data from Railway
pg_dump $RAILWAY_DATABASE_URL \
  --data-only \
  --table='*_m5' --table='*_m15' --table='*_m30' \
  --table='*_h1' --table='*_h2' --table='*_h4' \
  --table='*_h8' --table='*_h12' --table='*_d1' \
  > railway_timeseries_data.sql

# Import to Timescale Cloud
psql $TIMESCALE_DATABASE_URL < railway_timeseries_data.sql

# Option B: If starting fresh (no historical data)
# Skip this step - data will be populated by MT5 sync service
```

**7. Import Prisma data (users, subscriptions, etc.):**

```bash
# Export Prisma-managed data from Railway
pg_dump $RAILWAY_DATABASE_URL \
  --data-only \
  --table='"User"' \
  --table='"Account"' \
  --table='"Session"' \
  --table='"VerificationToken"' \
  --table='"Subscription"' \
  --table='"Payment"' \
  --table='"Invoice"' \
  --table='"Alert"' \
  --table='"Watchlist"' \
  --table='"WatchlistItem"' \
  --table='"Notification"' \
  --table='"LoginHistory"' \
  --table='"UserSession"' \
  --table='"TwoFactorSecret"' \
  --table='"BackupCode"' \
  --table='"DeletionRequest"' \
  --table='"Preference"' \
  --table='"Affiliate"' \
  --table='"AffiliateCode"' \
  --table='"AffiliateCommission"' \
  --table='"DisbursementTransaction"' \
  --table='"DisbursementBatch"' \
  --table='"DisbursementAuditLog"' \
  --table='"RiseWorksAccount"' \
  --table='"FraudAlert"' \
  > railway_prisma_data.sql

# Import to Timescale Cloud
psql $TIMESCALE_DATABASE_URL < railway_prisma_data.sql
```

---

### Step 1.4: Verify Data Migration

**1. Check row counts match:**

```bash
# Create verification script
cat > verify_migration.sql << 'EOF'
-- Count users
SELECT 'Users' as table_name, COUNT(*) as row_count FROM "User"
UNION ALL
SELECT 'Subscriptions', COUNT(*) FROM "Subscription"
UNION ALL
SELECT 'Payments', COUNT(*) FROM "Payment"
UNION ALL
SELECT 'Alerts', COUNT(*) FROM "Alert"
UNION ALL
SELECT 'Watchlists', COUNT(*) FROM "Watchlist"
UNION ALL
SELECT 'Affiliates', COUNT(*) FROM "Affiliate"
UNION ALL
-- Check time-series tables (sample)
SELECT 'eurusd_m5', COUNT(*) FROM eurusd_m5
UNION ALL
SELECT 'btcusd_h1', COUNT(*) FROM btcusd_h1
ORDER BY table_name;
EOF

# Run on Railway (source)
echo "=== RAILWAY (SOURCE) ==="
psql $RAILWAY_DATABASE_URL < verify_migration.sql

# Run on Timescale Cloud (destination)
echo "=== TIMESCALE CLOUD (DESTINATION) ==="
psql $TIMESCALE_DATABASE_URL < verify_migration.sql

# Compare outputs - row counts should match
```

**2. Verify TimescaleDB features enabled:**

```bash
psql $TIMESCALE_DATABASE_URL << 'EOF'
-- Check TimescaleDB version
SELECT extname, extversion FROM pg_extension WHERE extname = 'timescaledb';

-- Check hypertable count (should be 135)
SELECT COUNT(*) as hypertable_count
FROM timescaledb_information.hypertables
WHERE hypertable_schema = 'public';

-- Check compression policies (should be 135)
SELECT COUNT(*) as compression_policies
FROM timescaledb_information.jobs
WHERE proc_name = 'policy_compression';

-- Check retention policies (should be 135)
SELECT COUNT(*) as retention_policies
FROM timescaledb_information.jobs
WHERE proc_name = 'policy_retention';

-- Sample hypertable info
SELECT
  hypertable_name,
  compression_enabled,
  num_chunks
FROM timescaledb_information.hypertables
WHERE hypertable_name LIKE 'eurusd_%'
ORDER BY hypertable_name;
EOF
```

**Expected output:**

```
 extname     | extversion
-------------+------------
 timescaledb | 2.13.1

 hypertable_count
------------------
              135

 compression_policies
----------------------
                  135

 retention_policies
--------------------
                135

 hypertable_name | compression_enabled | num_chunks
-----------------+---------------------+------------
 eurusd_d1      | t                   |          5
 eurusd_h1      | t                   |         12
 eurusd_h12     | t                   |          8
 eurusd_h2      | t                   |         10
 eurusd_h4      | t                   |          9
 eurusd_h8      | t                   |          7
 eurusd_m15     | t                   |         15
 eurusd_m30     | t                   |         14
 eurusd_m5      | t                   |         20
```

**3. Test sample queries:**

```bash
psql $TIMESCALE_DATABASE_URL << 'EOF'
-- Test time-series query
SELECT
  timestamp,
  close,
  (fractals->>'upper')::text as upper_fractal
FROM eurusd_h1
WHERE timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC
LIMIT 10;

-- Test user query
SELECT
  email,
  tier,
  "stripeCustomerId"
FROM "User"
WHERE tier != 'FREE'
LIMIT 5;
EOF
```

---

### Step 1.5: Update Next.js Environment Variables

**⚠️ IMPORTANT: This is when the switch happens. Next.js will start using Timescale Cloud.**

**1. Update Vercel environment variables:**

```bash
# Go to Vercel dashboard
# Navigate to: Project → Settings → Environment Variables

# Update DATABASE_URL for all environments:
# - Production
# - Preview
# - Development

# Old value (Railway):
# postgresql://postgres:password@containers-us-west-123.railway.app:5432/railway

# New value (Timescale Cloud):
# postgresql://tsdbadmin:[password]@[service-id].tsdb.cloud.timescale.com:5432/tsdb?sslmode=require
```

**2. Redeploy Next.js:**

```bash
# Trigger redeployment in Vercel dashboard
# Or via CLI:
vercel --prod

# Wait for deployment to complete (2-3 minutes)
```

**3. Update local development `.env`:**

```bash
# Edit .env file
vim .env

# Update DATABASE_URL
DATABASE_URL="postgresql://tsdbadmin:[password]@[service-id].tsdb.cloud.timescale.com:5432/tsdb?sslmode=require"

# Test locally
npm run dev

# Visit http://localhost:3000
# Test indicator endpoints
curl http://localhost:3000/api/indicators
```

---

### Step 1.6: Test Next.js with Timescale Cloud

**1. Test API endpoints:**

```bash
# Replace with your Vercel production URL
export VERCEL_URL="https://your-app.vercel.app"

# Test user authentication
curl -X POST $VERCEL_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","tier":"FREE"}'

# Test indicators endpoint
curl $VERCEL_URL/api/indicators

# Test specific indicator data
curl "$VERCEL_URL/api/indicators/EURUSD/H1"

# Test watchlist endpoints
curl $VERCEL_URL/api/watchlist \
  -H "Authorization: Bearer [your-token]"

# Test admin endpoints (if applicable)
curl $VERCEL_URL/api/admin/users \
  -H "Authorization: Bearer [admin-token]"
```

**2. Monitor Vercel logs:**

```bash
# Via Vercel dashboard:
# Project → Deployments → Latest → Logs

# Look for:
# ✅ No database connection errors
# ✅ Prisma queries executing successfully
# ✅ No "connection refused" errors
```

**3. Check Timescale Cloud metrics:**

```bash
# Via Timescale Cloud console:
# https://console.cloud.timescale.com

# Navigate to: Service → Metrics

# Monitor:
# - Connection count (should show active connections)
# - Query performance
# - CPU usage
# - Memory usage
```

**4. Run smoke tests:**

```bash
# Test all critical user flows:
# - User registration ✅
# - User login ✅
# - Fetch indicators ✅
# - Create watchlist ✅
# - Create alert ✅
# - Stripe checkout ✅
# - Admin dashboard ✅
```

---

### Step 1.7: Monitor for 24 Hours

**Before proceeding to cache migration, monitor database for 24 hours:**

**Checklist:**

- [ ] No database connection errors in Vercel logs
- [ ] Query performance acceptable (< 200ms for most queries)
- [ ] Timescale Cloud CPU usage < 50%
- [ ] Timescale Cloud memory usage < 70%
- [ ] No failed Prisma migrations
- [ ] Users can register and login
- [ ] Indicators data loading correctly
- [ ] Payment processing working
- [ ] Admin functions operational

**If all checks pass after 24 hours → Proceed to Phase 2 (Cache Migration)**

**If issues found → Rollback to Railway (see Rollback section)**

---

## Phase 2: Cache Migration

**Estimated Time:** 1-2 hours
**Risk Level:** Very Low (cache is ephemeral, repopulates automatically)
**Downtime Required:** 0 minutes (zero downtime)

### Step 2.1: Create Upstash Redis Database

**1. Sign up for Upstash:**

Visit: https://console.upstash.com

**2. Create a new Redis database:**

```yaml
Name: trading-alerts-cache
Region: us-east-1 (same region as Timescale Cloud)
Type: Regional (not Global - lower latency)
TLS: Enabled (required)
Eviction Policy: allkeys-lru (recommended for cache)
```

**3. Copy connection details:**

You'll receive:

```
Endpoint: [id].upstash.io
Port: 6379 (non-TLS) or 6380 (TLS)
Password: [generated-password]
```

**4. Construct connection string:**

```bash
# Upstash Redis connection string (TLS enabled)
rediss://default:[password]@[id].upstash.io:6380

# Note: Use "rediss://" (double 's') for TLS
```

---

### Step 2.2: Test Upstash Connection

**1. Test with Redis CLI (optional):**

```bash
# Install redis-cli if not already installed
brew install redis  # macOS

# Test connection
redis-cli -u "rediss://default:[password]@[id].upstash.io:6380"

# Inside redis-cli:
> PING
PONG

> SET test_key "Hello Upstash"
OK

> GET test_key
"Hello Upstash"

> DEL test_key
(integer) 1

> QUIT
```

**2. Test with Node.js (from project):**

```bash
# Create test script
cat > test_upstash.js << 'EOF'
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL, {
  tls: process.env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
  maxRetriesPerRequest: 3,
});

async function test() {
  try {
    // Test PING
    const pong = await redis.ping();
    console.log('✅ PING:', pong);

    // Test SET
    await redis.set('test_key', 'Hello Upstash', 'EX', 10);
    console.log('✅ SET test_key');

    // Test GET
    const value = await redis.get('test_key');
    console.log('✅ GET test_key:', value);

    // Test DEL
    await redis.del('test_key');
    console.log('✅ DEL test_key');

    console.log('\n✅ All tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

test();
EOF

# Run test
REDIS_URL="rediss://default:[password]@[id].upstash.io:6380" node test_upstash.js

# Expected output:
# ✅ PING: PONG
# ✅ SET test_key
# ✅ GET test_key: Hello Upstash
# ✅ DEL test_key
# ✅ All tests passed!
```

---

### Step 2.3: Update Next.js Environment Variables

**1. Update Vercel environment variables:**

```bash
# Go to Vercel dashboard
# Navigate to: Project → Settings → Environment Variables

# Update REDIS_URL for all environments:
# - Production
# - Preview
# - Development

# Old value (Railway):
# redis://default:password@redis.railway.internal:6379

# New value (Upstash):
# rediss://default:[password]@[id].upstash.io:6380
```

**2. Verify Redis client configuration is compatible:**

Check `/home/user/trading-alerts-saas-public/lib/redis/client.ts`:

```typescript
// Current configuration (should work with Upstash)
const REDIS_OPTIONS: RedisOptions = {
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number): number | null => {
    if (times > 10) {
      return null;
    }
    return Math.min(times * 500, 30000);
  },
  enableReadyCheck: true, // ⚠️ Change to false for Upstash
  lazyConnect: true,
};
```

**⚠️ Important: Update `enableReadyCheck` for Upstash:**

Upstash doesn't support `CLIENT SETNAME`, so set `enableReadyCheck: false`.

Edit `lib/redis/client.ts`:

```typescript
const REDIS_OPTIONS: RedisOptions = {
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number): number | null => {
    if (times > 10) {
      return null;
    }
    return Math.min(times * 500, 30000);
  },
  enableReadyCheck: false, // ✅ Changed for Upstash compatibility
  lazyConnect: true,
  // Auto-detect TLS from URL
  tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
};
```

**3. Commit the change:**

```bash
git add lib/redis/client.ts
git commit -m "fix(redis): set enableReadyCheck=false for Upstash compatibility"
git push origin main
```

**4. Redeploy Next.js:**

```bash
# Trigger redeployment in Vercel dashboard
vercel --prod

# Wait for deployment (2-3 minutes)
```

**5. Update local development `.env`:**

```bash
# Edit .env file
vim .env

# Update REDIS_URL
REDIS_URL="rediss://default:[password]@[id].upstash.io:6380"

# Test locally
npm run dev
curl http://localhost:3000/api/cache/stats
```

---

### Step 2.4: Test Next.js with Upstash Redis

**1. Test cache endpoints:**

```bash
export VERCEL_URL="https://your-app.vercel.app"

# Test cache stats
curl $VERCEL_URL/api/cache/stats

# Expected response:
# {
#   "usedMemory": "1.2M",
#   "usedMemoryPeak": "2.4M",
#   "keyCount": 0  # Empty cache initially
# }
```

**2. Test indicator caching:**

```bash
# First request (cache miss - fetches from PostgreSQL)
time curl "$VERCEL_URL/api/indicators/EURUSD/H1"
# Response time: ~150-200ms

# Second request (cache hit - serves from Redis)
time curl "$VERCEL_URL/api/indicators/EURUSD/H1"
# Response time: ~20-50ms (much faster!)

# Verify cache populated
curl $VERCEL_URL/api/cache/stats
# {
#   "keyCount": 1  # Cache now has 1 key
# }
```

**3. Monitor Upstash console:**

```bash
# Via Upstash console:
# https://console.upstash.com → Your Database → Metrics

# Monitor:
# - Commands per second (should show activity)
# - Bandwidth usage
# - Storage usage
# - Request latency (should be < 10ms)
```

**4. Verify cache is working:**

```bash
# Check Vercel logs for cache hits
# Look for logs like:
# [Redis] Cache hit: indicators:EURUSD:H1
# [Redis] Cache miss: indicators:BTCUSD:M5
```

---

### Step 2.5: Monitor for 24 Hours

**Before completing migration, monitor cache for 24 hours:**

**Checklist:**

- [ ] No Redis connection errors in Vercel logs
- [ ] Cache hit rate > 50% for indicator requests
- [ ] Upstash latency < 20ms (P95)
- [ ] No "ECONNREFUSED" errors
- [ ] Cache expiration working (keys expire after TTL)
- [ ] Memory usage stable in Upstash console

**If all checks pass after 24 hours → Migration complete! 🎉**

---

## Phase 3: Testing & Verification

### Step 3.1: End-to-End Testing

**1. User Registration & Login Flow:**

```bash
# Test user registration
curl -X POST https://your-app.vercel.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "migration-test@example.com",
    "password": "Test123!",
    "tier": "FREE"
  }'

# Expected: User created successfully

# Test login
curl -X POST https://your-app.vercel.app/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "migration-test@example.com",
    "password": "Test123!"
  }'

# Expected: Login successful with session token
```

**2. Indicator Data Flow:**

```bash
# Test indicator endpoints for all timeframes
for timeframe in M5 M15 M30 H1 H2 H4 H8 H12 D1; do
  echo "Testing $timeframe..."
  curl -s "https://your-app.vercel.app/api/indicators/EURUSD/$timeframe" | jq '.data | length'
done

# Expected: Each timeframe returns data
```

**3. Watchlist & Alerts:**

```bash
# Create watchlist (requires authentication)
curl -X POST https://your-app.vercel.app/api/watchlist \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [token]" \
  -d '{
    "name": "My Watchlist",
    "items": [
      {"symbol": "EURUSD", "timeframe": "H1"},
      {"symbol": "BTCUSD", "timeframe": "H4"}
    ]
  }'

# Create alert
curl -X POST https://your-app.vercel.app/api/alerts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [token]" \
  -d '{
    "symbol": "EURUSD",
    "timeframe": "H1",
    "condition": "price_above",
    "value": 1.1000
  }'
```

**4. Payment Processing:**

```bash
# Test Stripe checkout
curl -X POST https://your-app.vercel.app/api/checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [token]" \
  -d '{
    "tier": "PRO",
    "interval": "monthly"
  }'

# Expected: Stripe checkout session created
```

**5. Admin Functions:**

```bash
# Test admin endpoints (requires admin token)
curl https://your-app.vercel.app/api/admin/users \
  -H "Authorization: Bearer [admin-token]"

# Test analytics
curl https://your-app.vercel.app/api/admin/analytics \
  -H "Authorization: Bearer [admin-token]"
```

---

### Step 3.2: Performance Testing

**1. Database query performance:**

```bash
# Run load test on indicator endpoint
npm install -g autocannon

# Test with 10 concurrent connections for 30 seconds
autocannon -c 10 -d 30 https://your-app.vercel.app/api/indicators/EURUSD/H1

# Expected metrics:
# Latency (P50): < 100ms
# Latency (P95): < 300ms
# Throughput: > 50 req/sec
```

**2. Cache performance:**

```bash
# Test cache hit rate
for i in {1..100}; do
  curl -s "https://your-app.vercel.app/api/indicators/EURUSD/H1" > /dev/null
done

# Check cache stats
curl https://your-app.vercel.app/api/cache/stats

# Expected:
# Cache hit rate > 90% after warmup
```

**3. TimescaleDB compression verification:**

```bash
psql $TIMESCALE_DATABASE_URL << 'EOF'
-- Check compression stats for sample table
SELECT
  hypertable_name,
  total_chunks,
  number_compressed_chunks,
  ROUND(100.0 * number_compressed_chunks / total_chunks, 2) as compression_percentage
FROM timescaledb_information.hypertables
WHERE hypertable_name = 'eurusd_h1';
EOF

# Expected: Chunks older than 7 days should be compressed
```

---

### Step 3.3: Monitoring Setup

**1. Set up Timescale Cloud alerts:**

```bash
# Via Timescale Cloud console:
# Navigate to: Service → Monitoring → Alerts

# Configure alerts for:
# - CPU usage > 80% for 5 minutes
# - Memory usage > 90% for 5 minutes
# - Storage usage > 80%
# - Connection count > 90% of max
# - Query latency P95 > 500ms
```

**2. Set up Upstash monitoring:**

```bash
# Via Upstash console:
# Navigate to: Database → Monitoring

# Monitor:
# - Request rate
# - Error rate (should be < 0.1%)
# - Latency P95 (should be < 20ms)
# - Storage usage
```

**3. Set up Vercel monitoring:**

```bash
# Via Vercel dashboard:
# Project → Analytics

# Monitor:
# - Function execution time
# - Error rate
# - Cache hit rate
# - 4xx/5xx responses
```

---

## Rollback Procedures

### Emergency Rollback to Railway

**If critical issues occur after migration, rollback immediately:**

### Rollback Step 1: Revert Database Connection

```bash
# 1. Update Vercel environment variables
# Change DATABASE_URL back to Railway:
# postgresql://postgres:password@containers-us-west-123.railway.app:5432/railway

# 2. Redeploy Next.js
vercel --prod

# 3. Verify Railway database still has data
psql $RAILWAY_DATABASE_URL -c "SELECT COUNT(*) FROM \"User\";"

# 4. Monitor Vercel logs - should show successful connections
```

### Rollback Step 2: Revert Cache Connection

```bash
# 1. Update Vercel environment variables
# Change REDIS_URL back to Railway:
# redis://default:password@redis.railway.internal:6379

# 2. Revert code changes (if any)
git revert [commit-hash]
git push origin main

# 3. Redeploy Next.js
vercel --prod

# 4. Verify cache working
curl https://your-app.vercel.app/api/cache/stats
```

### Rollback Step 3: Verify System Operational

```bash
# Test all critical endpoints
curl https://your-app.vercel.app/api/indicators
curl https://your-app.vercel.app/api/watchlist
curl https://your-app.vercel.app/api/alerts

# Monitor for 1 hour - if stable, rollback successful
```

---

## Cost Comparison

### Before Migration (Railway)

```yaml
Database (Railway PostgreSQL):
  Plan: Hobby Plan
  CPU: 1 vCPU shared
  Memory: 1 GB
  Storage: 10 GB
  Cost: $5-10/month (with usage-based overages)

Cache (Railway Redis):
  Plan: Hobby Plan
  Memory: 512 MB
  Cost: $5-10/month

Total: ~$10-20/month
```

### After Migration (Timescale Cloud + Upstash)

```yaml
Database (Timescale Cloud):
  Plan: Dynamic Compute
  CPU: 0.5 vCPU
  Memory: 2 GB
  Storage: 25 GB
  Features: Hypertables, compression, retention
  Cost: ~$25-35/month

Cache (Upstash Redis):
  Plan: Pay-per-request
  Storage: 10 GB included
  Requests: ~10M/month
  Cost: ~$5-10/month (scales with usage)

Total: ~$30-45/month
```

**Cost Increase:** +$20-25/month (+150%)

**Value Gained:**

- ✅ TimescaleDB time-series optimizations (10x faster queries)
- ✅ Automatic data compression (save 70-90% storage)
- ✅ Automatic data retention policies
- ✅ Continuous aggregates for analytics
- ✅ Upstash global replication
- ✅ Better monitoring and alerting
- ✅ Managed infrastructure (no maintenance)

---

## Troubleshooting

### Issue 1: "connection refused" to Timescale Cloud

**Symptoms:**

```
Error: connect ECONNREFUSED
```

**Solutions:**

```bash
# 1. Verify connection string has sslmode=require
echo $TIMESCALE_DATABASE_URL
# Should include: ?sslmode=require

# 2. Test connection manually
psql $TIMESCALE_DATABASE_URL -c "SELECT 1;"

# 3. Check Timescale Cloud service status
# Visit: https://console.cloud.timescale.com
# Navigate to: Service → Overview
# Status should be "Running"

# 4. Verify IP allowlist (if configured)
# Timescale Cloud → Service → Settings → IP Allowlist
# Add: 0.0.0.0/0 (allow all) for testing
# Then restrict to Vercel IPs for production
```

---

### Issue 2: Slow queries on TimescaleDB

**Symptoms:**

```
Query takes > 1 second
```

**Solutions:**

```bash
# 1. Check if hypertables are created
psql $TIMESCALE_DATABASE_URL -c "SELECT COUNT(*) FROM timescaledb_information.hypertables WHERE hypertable_schema = 'public';"
# Should return: 135

# 2. Check if indexes exist
psql $TIMESCALE_DATABASE_URL -c "\di" | grep _timestamp_idx
# Should show DESC indexes on timestamp column

# 3. Analyze query plan
psql $TIMESCALE_DATABASE_URL << 'EOF'
EXPLAIN ANALYZE
SELECT * FROM eurusd_h1
WHERE timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC
LIMIT 100;
EOF

# 4. Run ANALYZE to update statistics
psql $TIMESCALE_DATABASE_URL -c "ANALYZE eurusd_h1;"
```

---

### Issue 3: Upstash connection timeout

**Symptoms:**

```
Error: Connection timeout
```

**Solutions:**

```bash
# 1. Verify TLS configuration
# REDIS_URL should start with "rediss://" (double s)
echo $REDIS_URL

# 2. Test connection with shorter timeout
redis-cli -u $REDIS_URL --tls --insecure PING

# 3. Check Upstash region matches Vercel region
# Visit: https://console.upstash.com
# Database should be in same region as Vercel deployment

# 4. Verify Upstash database is active
# Console → Database → Status
# Should show "Active"
```

---

### Issue 4: Cache miss rate too high

**Symptoms:**

```
Cache hit rate < 50%
```

**Solutions:**

```bash
# 1. Check TTL settings
# Verify cache TTL is not too short
# lib/cache/redis.ts: CACHE_TTL should be 30 seconds

# 2. Verify caching is enabled
curl https://your-app.vercel.app/api/cache/stats

# 3. Check for cache invalidation patterns
# Look for excessive DEL or FLUSHDB commands

# 4. Monitor cache memory
# Upstash Console → Metrics → Memory Usage
# If memory full, eviction policy may be removing keys too aggressively
```

---

### Issue 5: High Timescale Cloud costs

**Symptoms:**

```
Monthly bill > $50
```

**Solutions:**

```bash
# 1. Check compression is working
psql $TIMESCALE_DATABASE_URL << 'EOF'
SELECT
  hypertable_name,
  before_compression_total_bytes / (1024*1024) as before_mb,
  after_compression_total_bytes / (1024*1024) as after_mb,
  ROUND(100.0 * after_compression_total_bytes / before_compression_total_bytes, 2) as compression_ratio
FROM timescaledb_information.compression_settings
WHERE hypertable_name LIKE 'eurusd_%'
ORDER BY hypertable_name;
EOF

# 2. Check retention policies are active
psql $TIMESCALE_DATABASE_URL << 'EOF'
SELECT
  hypertable_name,
  job_id,
  config->>'drop_after' as retention_period
FROM timescaledb_information.jobs j
JOIN timescaledb_information.hypertables h
  ON j.hypertable_name = h.hypertable_name
WHERE proc_name = 'policy_retention'
ORDER BY hypertable_name;
EOF

# 3. Consider downgrading compute
# Timescale Console → Service → Settings → Compute
# Try: 0.25 CPU / 1 GB RAM if load is low

# 4. Review storage usage
# Timescale Console → Service → Metrics → Storage
# Delete old data if retention period is too long
```

---

## Success Criteria

**Migration is successful when ALL criteria are met:**

### Database Migration ✅

- [ ] All tables exist in Timescale Cloud (Prisma tables + 135 time-series tables)
- [ ] TimescaleDB extension enabled (version 2.13+)
- [ ] 135 hypertables created successfully
- [ ] 135 compression policies active
- [ ] 135 retention policies active
- [ ] Data migrated successfully (row counts match)
- [ ] Next.js can connect to Timescale Cloud
- [ ] Query performance acceptable (< 200ms P95)
- [ ] No connection errors in logs for 24 hours

### Cache Migration ✅

- [ ] Upstash Redis database created with TLS
- [ ] Next.js can connect to Upstash Redis
- [ ] Cache hit rate > 50% after warmup
- [ ] Cache expiration working (keys expire after TTL)
- [ ] Upstash latency < 20ms (P95)
- [ ] No Redis connection errors in logs for 24 hours

### Application Health ✅

- [ ] User registration working
- [ ] User login working
- [ ] Indicator endpoints returning data
- [ ] Watchlist CRUD operations working
- [ ] Alert CRUD operations working
- [ ] Payment processing working (Stripe + dLocal)
- [ ] Admin dashboard operational
- [ ] No increase in error rate
- [ ] No performance degradation

### Monitoring & Alerts ✅

- [ ] Timescale Cloud monitoring configured
- [ ] Upstash monitoring configured
- [ ] Vercel Analytics tracking requests
- [ ] Alert thresholds set for CPU, memory, connections
- [ ] On-call procedures documented

---

## Next Steps

**After successful infrastructure migration:**

1. ✅ **Monitor for 1 week** before proceeding
   - Verify stability under production load
   - Fine-tune compression and retention policies
   - Optimize query performance if needed

2. ✅ **Document new infrastructure**
   - Update team documentation
   - Update runbooks
   - Train team on Timescale Cloud and Upstash consoles

3. ✅ **Proceed to Step 5B: Backend Migration**
   - Now you can safely migrate from Next.js to Nest.js
   - Infrastructure is stable and tested
   - Nest.js will connect to Timescale Cloud + Upstash from Day 1

4. ✅ **Decommission Railway resources**
   - Keep Railway PostgreSQL as backup for 30 days
   - Keep Railway Redis as backup for 7 days
   - Then delete to stop billing

---

## Conclusion

**Step 5A Complete! 🎉**

You have successfully migrated your infrastructure:

- ✅ Database: Railway PostgreSQL → Timescale Cloud (with TimescaleDB features)
- ✅ Cache: Railway Redis → Upstash Redis (serverless)
- ✅ Next.js tested and working with new infrastructure
- ✅ Zero downtime migration achieved
- ✅ Ready for Step 5B (Nest.js backend migration)

**Important:**

- Next.js code is **unchanged** - only connection strings updated
- Infrastructure is **stable** and **battle-tested** before backend migration
- Easy rollback available if needed
- Monitoring and alerts configured

**Next:** Proceed to `step-5b-backend-migration.md` when ready to migrate from Next.js to Nest.js.

---

_Generated: 2026-01-11_
_Migration Step: 5A of Step 5 (Infrastructure Migration)_
_Target: Timescale Cloud + Upstash Redis_
_Status: Production-Ready ✅_
