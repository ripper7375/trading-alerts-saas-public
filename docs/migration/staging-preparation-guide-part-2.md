# Staging Preparation Guide - Part 20 Migration

**Estimated Time:** 1 hour
**Skill Level:** Beginner-friendly
**Prerequisites:** Basic terminal/command line knowledge
**Purpose:** Set up a staging environment to safely test Part 20 migration and rollback

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites Checklist](#prerequisites-checklist)
3. [Step-by-Step Instructions](#step-by-step-instructions)
4. [Verification](#verification)
5. [Troubleshooting](#troubleshooting)
6. [Success Criteria](#success-criteria)

---

## Overview

### What is Staging?

Staging is a **copy of your production environment** where you can safely test changes without affecting real users. Think of it as a "practice run" before the real migration.

### Why Test in Staging?

- ✅ Catch issues before production
- ✅ Verify rollback works
- ✅ Practice the migration steps
- ✅ Measure actual timing
- ✅ Reduce production risk to near-zero

### What You'll Do

1. Create staging infrastructure (PostgreSQL, Redis)
2. Deploy current code to staging
3. Set up monitoring
4. Verify staging works like production
5. Prepare for rollback testing

---

## Prerequisites Checklist

Before starting, ensure you have:

### Access & Accounts

- [ ] Railway account (or your cloud provider)
- [ ] GitHub repository access
- [ ] SSH access to Contabo VPS (if using MT5 terminals)
- [ ] Admin credentials for your app

### Local Setup

- [ ] Git installed (`git --version`)
- [ ] Node.js installed (`node --version` - should be 18+)
- [ ] PostgreSQL client installed (`psql --version`)
- [ ] Redis CLI installed (`redis-cli --version`)
- [ ] Terminal/command prompt open

### Code Ready

- [ ] Latest code pulled from main branch
- [ ] All tests passing locally (`npm test`)
- [ ] Build succeeds (`npm run build`)

### Time & Resources

- [ ] 1 hour of uninterrupted time
- [ ] Notepad to document results
- [ ] Internet connection stable

**⚠️ If ANY checkbox is unchecked, complete it before proceeding.**

---

## Step-by-Step Instructions

### Phase 1: Create Staging Infrastructure (20 minutes) (DONE)

### Phase 2: Deploy Database Schema to Staging (15 minutes) (DONE)

---

ANTIGRAVITY IMPLEMENTATION : code migration from Part 6 to Part 20

---

### Phase 3: Deploy Application to Staging (15 minutes) (WE NEED TO START PHASE 3 AFTER COMMIT AND PUSH)

#### Step 3.1: Create Staging Deployment on Railway

1. **Connect GitHub Repository**
   - In Railway project
   - Click "+ New"
   - Select "GitHub Repo"
   - Choose your repository
   - Select branch: `claude/implement-phase09-prompts-ZmJLD`

2. **Configure Environment Variables**
   - Click on the web service
   - Go to "Variables" tab
   - Add these variables:

   ```
   POSTGRESQL_URI=(use value from staging PostgreSQL)
   REDIS_URL=(use value from staging Redis)
   NODE_ENV=staging
   NEXTAUTH_URL=https://your-staging-app.railway.app
   NEXTAUTH_SECRET=(generate with: openssl rand -base64 32)
   ```

3. **Set Build Command**
   - In "Settings" tab
   - Build Command: `npm run build`
   - Start Command: `npm start`

4. **Deploy**
   - Click "Deploy"
   - Wait 3-5 minutes
   - Check deployment logs for errors

**✅ Checkpoint:** Application deployed to staging.

---

#### Step 3.2: Verify Staging Application

1. **Get Staging URL**
   - In Railway web service
   - Go to "Settings" → "Domains"
   - Copy the generated URL (e.g., `https://trading-alerts-staging.up.railway.app`)

2. **Test Health Endpoint**

   ```bash
   STAGING_URL="https://your-staging-app.railway.app"

   curl $STAGING_URL/api/health | jq .
   ```

   **Expected Output:**

   ```json
   {
     "status": "ok",
     "components": {
       "postgresql": {
         "connected": true
       },
       "redis": {
         "connected": true
       }
     }
   }
   ```

   **If error:** Check deployment logs in Railway

3. **Test Indicators Endpoint (Will Fail - Expected)**

   ```bash
   curl $STAGING_URL/api/indicators/EURUSD/H1 | jq .
   ```

   **Expected Output:**

   ```json
   {
     "success": false,
     "error": "No data found"
   }
   ```

   **This is NORMAL** - No data in database yet. We'll add test data next.

**✅ Checkpoint:** Staging application is running and accessible.

---

### Phase 4: Add Test Data to Staging (10 minutes)

#### Step 4.1: Create Sample Indicator Data

We'll add minimal test data to verify the system works.

1. **Create Test Data Script**

   Create file: `scripts/seed-staging-data.sql`

   ```sql
   -- Insert sample OHLC data for EURUSD H1
   INSERT INTO eurusd_h1 (timestamp, open, high, low, close, volume)
   VALUES
     (CURRENT_TIMESTAMP - INTERVAL '3 hours', 1.0850, 1.0855, 1.0845, 1.0852, 1000),
     (CURRENT_TIMESTAMP - INTERVAL '2 hours', 1.0852, 1.0858, 1.0850, 1.0856, 1100),
     (CURRENT_TIMESTAMP - INTERVAL '1 hour', 1.0856, 1.0860, 1.0854, 1.0859, 1050),
     (CURRENT_TIMESTAMP, 1.0859, 1.0865, 1.0857, 1.0862, 1200);

   -- Insert sample data for BTCUSD H1 (FREE tier)
   INSERT INTO btcusd_h1 (timestamp, open, high, low, close, volume)
   VALUES
     (CURRENT_TIMESTAMP - INTERVAL '3 hours', 45000.00, 45100.00, 44950.00, 45050.00, 10),
     (CURRENT_TIMESTAMP - INTERVAL '2 hours', 45050.00, 45150.00, 45000.00, 45100.00, 12),
     (CURRENT_TIMESTAMP - INTERVAL '1 hour', 45100.00, 45200.00, 45050.00, 45150.00, 11),
     (CURRENT_TIMESTAMP, 45150.00, 45250.00, 45100.00, 45200.00, 13);

   -- Insert sample data for USDJPY H1 (FREE tier)
   INSERT INTO usdjpy_h1 (timestamp, open, high, low, close, volume)
   VALUES
     (CURRENT_TIMESTAMP - INTERVAL '3 hours', 148.50, 148.60, 148.40, 148.55, 800),
     (CURRENT_TIMESTAMP - INTERVAL '2 hours', 148.55, 148.65, 148.50, 148.60, 850),
     (CURRENT_TIMESTAMP - INTERVAL '1 hour', 148.60, 148.70, 148.55, 148.65, 820),
     (CURRENT_TIMESTAMP, 148.65, 148.75, 148.60, 148.70, 900);

   SELECT 'Sample data inserted successfully' as status;
   ```

2. **Execute Test Data Script**

   ```bash
   psql $POSTGRESQL_URI < scripts/seed-staging-data.sql
   ```

   **Expected Output:**

   ```
   INSERT 0 4
   INSERT 0 4
   INSERT 0 4
        status
   -------------------------------
    Sample data inserted successfully
   ```

3. **Verify Data Inserted**

   ```bash
   psql $POSTGRESQL_URI -c "
   SELECT
     (SELECT COUNT(*) FROM eurusd_h1) as eurusd_count,
     (SELECT COUNT(*) FROM btcusd_h1) as btcusd_count,
     (SELECT COUNT(*) FROM usdjpy_h1) as usdjpy_count;
   "
   ```

   **Expected Output:**

   ```
    eurusd_count | btcusd_count | usdjpy_count
   --------------|--------------|-------------
               4 |            4 |            4
   ```

**✅ Checkpoint:** Test data added to staging database.

---

#### Step 4.2: Test Indicators API with Data

```bash
# Test EURUSD endpoint
curl "$STAGING_URL/api/indicators/EURUSD/H1" | jq '.success'

# Expected: true

# Test BTCUSD endpoint
curl "$STAGING_URL/api/indicators/BTCUSD/H1" | jq '.success'

# Expected: true

# Test full response structure
curl "$STAGING_URL/api/indicators/EURUSD/H1" | jq '.data | keys'
```

**Expected Output:**

```json
[
  "ohlc",
  "fractals",
  "horizontal_trendlines",
  "diagonal_trendlines",
  "momentum_candles",
  "keltner_channels",
  "tema",
  "hrma",
  "smma",
  "zigzag",
  "metadata"
]
```

**✅ Checkpoint:** API returns data successfully.

---

### Phase 5: Set Up Monitoring (5 minutes)

#### Step 5.1: Create Monitoring Dashboard

1. **Create Simple Monitoring Script**

   Create file: `scripts/monitor-staging.sh`

   ```bash
   #!/bin/bash

   STAGING_URL="https://your-staging-app.railway.app"

   echo "========================================="
   echo "Staging Health Monitor"
   echo "========================================="

   # Health check
   echo "1. Health Check:"
   curl -s "$STAGING_URL/api/health" | jq -r '.status'

   # PostgreSQL check
   echo ""
   echo "2. PostgreSQL Connection:"
   curl -s "$STAGING_URL/api/health" | jq -r '.components.postgresql.connected'

   # Redis check
   echo ""
   echo "3. Redis Connection:"
   curl -s "$STAGING_URL/api/health" | jq -r '.components.redis.connected'

   # Data availability
   echo ""
   echo "4. Sample Data Check:"
   INDICATOR_SUCCESS=$(curl -s "$STAGING_URL/api/indicators/EURUSD/H1" | jq -r '.success')
   echo "EURUSD H1 data available: $INDICATOR_SUCCESS"

   echo ""
   echo "========================================="
   echo "Monitoring complete"
   echo "========================================="
   ```

2. **Make Script Executable**

   ```bash
   chmod +x scripts/monitor-staging.sh
   ```

3. **Run Monitor**

   ```bash
   ./scripts/monitor-staging.sh
   ```

   **Expected Output:**

   ```
   =========================================
   Staging Health Monitor
   =========================================
   1. Health Check:
   ok

   2. PostgreSQL Connection:
   true

   3. Redis Connection:
   true

   4. Sample Data Check:
   EURUSD H1 data available: true

   =========================================
   Monitoring complete
   =========================================
   ```

**✅ Checkpoint:** Monitoring set up and working.

---

## Verification

### Final Verification Checklist

Run through this checklist to confirm staging is ready:

```bash
# 1. PostgreSQL accessible
psql $POSTGRESQL_URI -c "SELECT version();"
# ✅ Should return PostgreSQL version

# 2. Redis accessible
redis-cli -u $REDIS_URL PING
# ✅ Should return: PONG

# 3. Tables created (135 indicator tables)
psql $POSTGRESQL_URI -c "
  SELECT COUNT(*)
  FROM pg_tables
  WHERE schemaname='public';
"
# ✅ Should return count > 135

# 4. Application responding
curl "$STAGING_URL/api/health"
# ✅ Should return: {"status":"ok",...}

# 5. API endpoints working
curl "$STAGING_URL/api/indicators/EURUSD/H1" | jq '.success'
# ✅ Should return: true

# 6. Test data present
psql $POSTGRESQL_URI -c "SELECT COUNT(*) FROM eurusd_h1;"
# ✅ Should return: 4

# 7. Redis cache working
curl "$STAGING_URL/api/cache/stats"
# ✅ Should return cache statistics
```

### Verification Result Document

Create file: `staging-verification-results.txt`

```
Staging Preparation Verification - [DATE]
==========================================

Infrastructure:
✅ PostgreSQL: CONNECTED
✅ Redis: CONNECTED
✅ TimescaleDB: INSTALLED

Database:
✅ Total tables: [COUNT]
✅ Indicator tables: 135
✅ Test data: PRESENT

Application:
✅ Deployment: SUCCESS
✅ Health endpoint: OK
✅ API endpoints: WORKING
✅ Cache: WORKING

Monitoring:
✅ Monitor script: WORKING

Time Taken: [ACTUAL TIME]

Status: READY FOR ROLLBACK TESTING
==========================================
```

---

## Troubleshooting

### Issue 1: PostgreSQL Connection Failed

**Symptom:**

```
psql: error: connection to server failed
```

**Solutions:**

1. **Check connection string format**

   ```bash
   echo $POSTGRESQL_URI
   # Should be: postgresql://user:pass@host:port/db
   ```

2. **Verify credentials in Railway**
   - Go to Railway PostgreSQL service
   - "Connect" tab
   - Copy fresh connection string

3. **Test with verbose output**
   ```bash
   psql $POSTGRESQL_URI -c "SELECT 1;" -v ON_ERROR_STOP=1
   ```

---

### Issue 2: Redis Connection Failed

**Symptom:**

```
Could not connect to Redis
```

**Solutions:**

1. **Check Redis URL format**

   ```bash
   echo $REDIS_URL
   # Should be: redis://default:pass@host:port
   ```

2. **Test with authentication**

   ```bash
   redis-cli -u $REDIS_URL --no-auth-warning PING
   ```

3. **Verify Redis service running**
   - Check Railway dashboard
   - Ensure Redis service shows "Active"

---

### Issue 3: Application Deployment Failed

**Symptom:**

```
Build failed or application crashes
```

**Solutions:**

1. **Check Railway deployment logs**
   - Railway dashboard → Web service → "Deployments"
   - Click latest deployment
   - Review logs for errors

2. **Common issues:**
   - Missing environment variables
   - Build command incorrect
   - Node version mismatch

3. **Verify build locally first**
   ```bash
   npm run build
   # Should complete without errors
   ```

---

### Issue 4: No Data in Indicators API

**Symptom:**

```json
{ "success": false, "error": "No data found" }
```

**Solutions:**

1. **Verify test data inserted**

   ```bash
   psql $POSTGRESQL_URI -c "SELECT COUNT(*) FROM eurusd_h1;"
   ```

2. **Re-run seed script**

   ```bash
   psql $POSTGRESQL_URI < scripts/seed-staging-data.sql
   ```

3. **Check table names**
   ```bash
   psql $POSTGRESQL_URI -c "\dt"
   # Verify table names are lowercase (eurusd_h1, not EURUSD_H1)
   ```

---

### Issue 5: TimescaleDB Extension Not Found

**Symptom:**

```
ERROR: extension "timescaledb" does not exist
```

**Solutions:**

1. **Verify PostgreSQL version**

   ```bash
   psql $POSTGRESQL_URI -c "SELECT version();"
   # Must be PostgreSQL 12+
   ```

2. **Use Railway PostgreSQL template**
   - Delete current database
   - Create new from "PostgreSQL" template
   - Railway templates include common extensions

3. **Manual installation**
   ```bash
   psql $POSTGRESQL_URI -c "CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;"
   ```

---

## Success Criteria

### You're Ready to Proceed When:

- ✅ **All verification checks pass** (see Verification section)
- ✅ **Staging URL accessible** and returns data
- ✅ **Test data present** in all 3 test tables
- ✅ **Monitoring script works** without errors
- ✅ **Documentation complete** (saved credentials, verification results)
- ✅ **Total time < 1 hour** (if longer, note why for production)

### Completion Checklist

```
Staging Preparation Complete
=============================

Infrastructure Setup:
[ ] PostgreSQL created and accessible
[ ] Redis created and accessible
[ ] TimescaleDB extension installed

Database Setup:
[ ] Schema deployed (135+ tables)
[ ] Test data inserted
[ ] Queries working

Application Setup:
[ ] Code deployed to staging
[ ] Environment variables configured
[ ] Health checks passing
[ ] API endpoints working

Documentation:
[ ] Credentials saved securely
[ ] Verification results documented
[ ] Staging URL recorded

Status: READY FOR ROLLBACK TESTING
Next Step: Proceed to Rollback Testing Guide
```

---

## Next Steps

Once all success criteria are met:

1. ✅ **Save all credentials** to secure location
2. ✅ **Document verification results**
3. ✅ **Notify team** staging is ready
4. 🚀 **Proceed to:** [Rollback Testing Guide](./rollback-testing-guide.md)

---

## Quick Reference

### Useful Commands

```bash
# Check staging health
curl $STAGING_URL/api/health | jq .

# Monitor staging
./scripts/monitor-staging.sh

# Check database
psql $POSTGRESQL_URI -c "\dt"

# Check Redis
redis-cli -u $REDIS_URL INFO

# Re-run seed data
psql $POSTGRESQL_URI < scripts/seed-staging-data.sql

# Tail Railway logs
# (Go to Railway dashboard → Service → Logs)
```

### Important URLs

- **Railway Dashboard:** https://railway.app
- **Staging App:** [YOUR_STAGING_URL]
- **GitHub Branch:** claude/implement-phase09-prompts-ZmJLD

### Emergency Contacts

- **Technical Lead:** [NAME/CONTACT]
- **DevOps:** [NAME/CONTACT]
- **Railway Support:** https://help.railway.app

---

**Document Version:** 1.0
**Last Updated:** 2026-01-07
**Next Review:** After rollback testing
