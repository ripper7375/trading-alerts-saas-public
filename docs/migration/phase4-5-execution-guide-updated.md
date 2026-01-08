# Phase 4 & 5 Execution Guide - Windows PowerShell

**Date:** 2026-01-08
**Estimated Time:** 15 minutes
**Working Directory:** D:\SaaS

---

## ✅ Prerequisites Check

Before starting, verify you have:

- [ ] Railway PostgreSQL connection string (from environment variables)
- [ ] Railway Redis connection string (from environment variables)
- [ ] `psql` command available (PostgreSQL client)
- [ ] `redis-cli` command available (Redis client)
- [ ] PowerShell open in `D:\SaaS` directory

---

## 📋 Phase 4: Add Test Data (10 minutes)

### Step 4.1: Create Scripts Directory (if not exists)

```powershell
# Create scripts directory
New-Item -ItemType Directory -Force -Path .\scripts

# Verify created
Test-Path .\scripts
# Should return: True
```

### Step 4.2: Copy Seed Data Script

**Action:** Copy the `seed-staging-data.sql` file to your `scripts` folder:

- Source: [Provided by Claude]
- Destination: `D:\SaaS\scripts\seed-staging-data.sql`

### Step 4.3: Get Railway PostgreSQL Connection String

**Option A: From Railway Dashboard**

1. Go to https://railway.app
2. Select your project
3. Click PostgreSQL service
4. Go to "Connect" tab
5. Copy "Postgres Connection URL"
6. Format: `postgresql://postgres:PASSWORD@HOST:PORT/railway`

**Option B: From Environment Variables (if already saved)**

```powershell
# Check if you have it saved
$env:POSTGRESQL_URI
```

**Save for this session:**

```powershell
# Replace with YOUR actual connection string from Railway
$env:POSTGRESQL_URI = "postgresql://postgres:YOUR_PASSWORD@HOST:PORT/railway"

# Verify it's set
Write-Host "PostgreSQL URI: $env:POSTGRESQL_URI"
```

### Step 4.4: Execute Seed Data Script

```powershell
# Navigate to project root
cd D:\SaaS

# Execute seed script (will insert 4 candles per symbol)
psql $env:POSTGRESQL_URI -f .\scripts\seed-staging-data.sql
```

**Expected Output:**

```
INSERT 0 4
INSERT 0 4
INSERT 0 4
              status               | eurusd_count | btcusd_count | usdjpy_count
-----------------------------------+--------------+--------------+--------------
 Sample data inserted successfully |            4 |            4 |            4
(1 row)
```

**✅ Checkpoint 1:** If you see the above output, test data is inserted successfully!

### Step 4.5: Verify Data Inserted

```powershell
# Count records in each table
psql $env:POSTGRESQL_URI -c "
SELECT
  (SELECT COUNT(*) FROM eurusd_h1) as eurusd_count,
  (SELECT COUNT(*) FROM btcusd_h1) as btcusd_count,
  (SELECT COUNT(*) FROM usdjpy_h1) as usdjpy_count;
"
```

**Expected Output:**

```
 eurusd_count | btcusd_count | usdjpy_count
--------------+--------------+--------------
            4 |            4 |            4
(1 row)
```

### Step 4.6: Verify Data with Timestamps

```powershell
# Check actual data in EURUSD H1
psql $env:POSTGRESQL_URI -c "
SELECT timestamp, open, high, low, close, volume
FROM eurusd_h1
ORDER BY timestamp DESC
LIMIT 4;
"
```

**Expected Output:**

```
        timestamp         |  open   |  high   |   low   |  close  | volume
--------------------------+---------+---------+---------+---------+--------
 2026-01-08 XX:XX:XX.XXX | 1.0859  | 1.0865  | 1.0857  | 1.0862  |   1200
 2026-01-08 XX:XX:XX.XXX | 1.0856  | 1.0860  | 1.0854  | 1.0859  |   1050
 2026-01-08 XX:XX:XX.XXX | 1.0852  | 1.0858  | 1.0850  | 1.0856  |   1100
 2026-01-08 XX:XX:XX.XXX | 1.0850  | 1.0855  | 1.0845  | 1.0852  |   1000
(4 rows)
```

**✅ Checkpoint 2:** Data verified in database!

### Step 4.7: Test API Endpoints

```powershell
# Set staging URL
$STAGING_URL = "https://trading-alerts-saas-public-go8p.vercel.app"

# Test EURUSD endpoint
$result = Invoke-RestMethod -Uri "$STAGING_URL/api/indicators/EURUSD/H1" -Method Get
$result.success
# Expected: True

# Test BTCUSD endpoint
$result = Invoke-RestMethod -Uri "$STAGING_URL/api/indicators/BTCUSD/H1" -Method Get
$result.success
# Expected: True

# Test USDJPY endpoint
$result = Invoke-RestMethod -Uri "$STAGING_URL/api/indicators/USDJPY/H1" -Method Get
$result.success
# Expected: True
```

### Step 4.8: Verify Full API Response Structure

```powershell
# Get full response for EURUSD
$response = Invoke-RestMethod -Uri "$STAGING_URL/api/indicators/EURUSD/H1" -Method Get

# Check data keys
$response.data | Get-Member -MemberType NoteProperty | Select-Object Name
```

**Expected Keys:**

```
Name
----
ohlc
fractals
horizontal_trendlines
diagonal_trendlines
momentum_candles
keltner_channels
tema
hrma
smma
zigzag
metadata
```

**✅ Checkpoint 3:** API endpoints returning data successfully!

---

## 📋 Phase 5: Set Up Monitoring (5 minutes)

### Step 5.1: Copy Monitoring Script

**Action:** Copy the `monitor-staging-phase4.ps1` file to your `scripts` folder:

- Source: [Provided by Claude]
- Destination: `D:\SaaS\scripts\monitor-staging-phase4.ps1`

**Note:** This is named `monitor-staging-phase4.ps1` to avoid overwriting your existing monitoring script.

### Step 5.2: Run Monitoring Script

```powershell
# Navigate to scripts directory
cd D:\SaaS\scripts

# Run monitoring script
.\monitor-staging-phase4.ps1
```

**Expected Output:**

```
=========================================
Staging Health Monitor - Phase 4
Time: 01/08/2026 XX:XX:XX
=========================================

1. Health Check:
   ✅ Status: ok

2. PostgreSQL Connection:
   ✅ Connected

3. Redis Connection:
   ✅ Connected

4. Sample Data Check:
   ✅ EURUSD H1 data available
   ✅ BTCUSD H1 data available
   ✅ USDJPY H1 data available

=========================================
Monitoring Complete
=========================================
```

**✅ Checkpoint 4:** Monitoring script working successfully!

---

## ✅ Final Verification Checklist

Run through these final checks:

### 1. Database Verification

```powershell
# Count all tables (should be 162)
psql $env:POSTGRESQL_URI -c "
SELECT COUNT(*)
FROM pg_tables
WHERE schemaname='public';
"
# Expected: 162
```

### 2. Test Data Verification

```powershell
# Verify test data in all 3 symbols
psql $env:POSTGRESQL_URI -c "
SELECT
  'eurusd_h1' as table_name,
  COUNT(*) as row_count
FROM eurusd_h1
UNION ALL
SELECT 'btcusd_h1', COUNT(*) FROM btcusd_h1
UNION ALL
SELECT 'usdjpy_h1', COUNT(*) FROM usdjpy_h1;
"
```

**Expected Output:**

```
 table_name  | row_count
-------------+-----------
 eurusd_h1   |         4
 btcusd_h1   |         4
 usdjpy_h1   |         4
(3 rows)
```

### 3. Application Health Verification

```powershell
# Health check
Invoke-RestMethod -Uri "$STAGING_URL/api/health" | ConvertTo-Json -Depth 5
```

### 4. Redis Verification

```powershell
# Get Redis connection string (from Railway)
$env:REDIS_URL = "redis://default:YOUR_PASSWORD@HOST:PORT"

# Test Redis connection
redis-cli -u $env:REDIS_URL PING
# Expected: PONG
```

---

## 📝 Document Completion Results

Create a verification results file:

```powershell
# Create verification results document
@"
Staging Preparation Verification - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
==========================================

Infrastructure:
✅ PostgreSQL: CONNECTED
✅ Redis: CONNECTED
✅ TimescaleDB: INSTALLED

Database:
✅ Total tables: 162
✅ Indicator tables: 136
✅ Application tables: 26
✅ Test data: PRESENT (12 rows across 3 symbols)

Application:
✅ Deployment: SUCCESS (Vercel)
✅ Staging URL: https://trading-alerts-saas-public-go8p.vercel.app
✅ Health endpoint: OK
✅ API endpoints: WORKING
✅ Cache: WORKING

Monitoring:
✅ Monitor script: WORKING (monitor-staging-phase4.ps1)

Time Taken: [FILL IN ACTUAL TIME]

Status: ✅ READY FOR ROLLBACK TESTING
==========================================
"@ | Out-File -FilePath ".\staging-verification-results.txt" -Encoding UTF8

Write-Host "✅ Verification results saved to: staging-verification-results.txt" -ForegroundColor Green
```

---

## 🎯 Completion Checklist

Mark each item as complete:

**Infrastructure Setup:**

- [x] PostgreSQL created and accessible
- [x] Redis created and accessible
- [x] TimescaleDB extension installed

**Database Setup:**

- [ ] Schema deployed (162 tables)
- [ ] Test data inserted (12 rows)
- [ ] Queries working

**Application Setup:**

- [x] Code deployed to staging (Vercel)
- [x] Environment variables configured
- [ ] Health checks passing
- [ ] API endpoints working

**Documentation:**

- [ ] Credentials saved securely
- [ ] Verification results documented
- [ ] Staging URL recorded

**Status:** ********************\_********************

**Next Step:** Proceed to Rollback Testing Guide

---

## 🚨 Troubleshooting Quick Reference

### Issue: psql command not found

```powershell
# Install PostgreSQL client
# Download from: https://www.postgresql.org/download/windows/
# Or use Chocolatey:
choco install postgresql
```

### Issue: redis-cli command not found

```powershell
# Install Redis CLI
# Download from: https://github.com/microsoftarchive/redis/releases
# Or use Chocolatey:
choco install redis-64
```

### Issue: API returns "No data found"

```powershell
# Re-run seed script
psql $env:POSTGRESQL_URI -f .\scripts\seed-staging-data.sql
```

### Issue: Connection timeout

```powershell
# Verify Railway services are running
# Check: https://railway.app/dashboard
# Restart services if needed
```

---

## 📞 Quick Commands Reference

```powershell
# Set environment variables (replace with YOUR values)
$env:POSTGRESQL_URI = "postgresql://postgres:PASSWORD@HOST:PORT/railway"
$env:REDIS_URL = "redis://default:PASSWORD@HOST:PORT"
$STAGING_URL = "https://trading-alerts-saas-public-go8p.vercel.app"

# Seed data
psql $env:POSTGRESQL_URI -f .\scripts\seed-staging-data.sql

# Check data
psql $env:POSTGRESQL_URI -c "SELECT COUNT(*) FROM eurusd_h1;"

# Test API
Invoke-RestMethod -Uri "$STAGING_URL/api/indicators/EURUSD/H1"

# Run monitoring (NEW FILENAME)
.\scripts\monitor-staging-phase4.ps1

# Check health
Invoke-RestMethod -Uri "$STAGING_URL/api/health"
```

---

## 📦 Files Required

Make sure you have downloaded and placed these files:

1. **seed-staging-data.sql** → `D:\SaaS\scripts\seed-staging-data.sql`
2. **monitor-staging-phase4.ps1** → `D:\SaaS\scripts\monitor-staging-phase4.ps1`
3. **phase4-5-execution-guide.md** → `D:\SaaS\phase4-5-execution-guide.md` (this file)

---

**Document Version:** 1.1
**Last Updated:** 2026-01-08
**Author:** Claude
**Status:** READY TO EXECUTE
**Changes:** Updated monitoring script filename to avoid conflicts
