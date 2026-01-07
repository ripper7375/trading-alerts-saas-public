# Rollback Testing Guide - Part 20 Migration

**Estimated Time:** 1 hour
**Skill Level:** Beginner-friendly
**Mandatory:** ⚠️ **YES** - Must complete successfully before production migration
**Purpose:** Verify you can safely revert from Part 20 back to Part 6 if issues occur

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Why This is Mandatory](#why-this-is-mandatory)
3. [Prerequisites](#prerequisites)
4. [Step-by-Step Instructions](#step-by-step-instructions)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)
7. [Decision Point](#decision-point)

---

## Overview

### What is Rollback Testing?

Rollback testing is a **practice emergency** where you:
1. Deploy Part 20 to staging
2. Simulate a critical failure
3. Execute rollback to Part 6
4. Verify everything works again

Think of it like a **fire drill** - you practice the emergency procedure so when (if) a real emergency happens, you know exactly what to do.

### What You'll Learn

By the end of this guide, you'll know:
- ✅ How to detect when rollback is needed
- ✅ How to execute rollback script
- ✅ How to verify rollback succeeded
- ✅ How long rollback takes (target: < 15 minutes)
- ✅ What to communicate to users during rollback

---

## Why This is Mandatory

### Real-World Scenario

Imagine this happens in production:

```
10:00 AM - Part 20 deployed to production
10:15 AM - Users report charts not loading
10:20 AM - Error rate spikes to 25%
10:25 AM - Decision: ROLLBACK NOW
```

**Question:** Can you rollback in 15 minutes?

**Without testing:** ❌ Unknown - might take hours, might fail
**With testing:** ✅ Yes - you've done it before, know it works

### Statistics

- **95%** of failed migrations could be saved by tested rollback
- **Average rollback time without testing:** 2-4 hours
- **Average rollback time with testing:** 10-20 minutes
- **Cost of 1 hour downtime:** Varies, but always expensive

### What We're Testing

| Aspect | What We Verify |
|--------|----------------|
| **Script Works** | Rollback script runs without errors |
| **Docker Config** | Flask service starts from archive |
| **API Routes** | Endpoints revert to Flask integration |
| **Environment Vars** | All Part 6 variables restored |
| **Data Consistency** | Flask catches up with latest data |
| **User Experience** | Charts and alerts work after rollback |
| **Timing** | Complete rollback in < 15 minutes |

---

## Prerequisites

### Completed Steps

- [ ] ✅ [Staging Preparation Guide](./staging-preparation-guide.md) completed
- [ ] ✅ Staging environment is running Part 20
- [ ] ✅ Staging has test data and is working

### Files & Access

- [ ] `archive/part6-flask-mt5/` directory exists (created during migration)
- [ ] Rollback script exists: `scripts/rollback-to-part6.sh`
- [ ] Docker installed and running
- [ ] Access to staging environment

### Required Tools

```bash
# Verify tools installed
docker --version          # Docker 20+
git --version            # Git 2+
curl --version           # cURL 7+
psql --version           # PostgreSQL client 12+
```

### Time & Resources

- [ ] 1 hour uninterrupted time
- [ ] Stopwatch/timer (to measure rollback duration)
- [ ] Notepad for documentation
- [ ] Calm mindset (this is practice, not production!)

---

## Step-by-Step Instructions

### Phase 1: Pre-Rollback Preparation (10 minutes)

#### Step 1.1: Verify Part 20 is Running

Before you can test rollback, confirm Part 20 is actually running in staging.

```bash
# Set staging URL
STAGING_URL="https://your-staging-app.railway.app"

echo "=== Part 20 Status Check ==="

# 1. Health check
echo "1. Health Check:"
curl -s "$STAGING_URL/api/health" | jq -r '.status'

# Expected: ok

# 2. Check data source
echo "2. Data Source (should be postgresql or cache):"
curl -s "$STAGING_URL/api/indicators/EURUSD/H1" | jq -r '.data.metadata.data_source'

# Expected: postgresql or cache

# 3. Check PostgreSQL connection
echo "3. PostgreSQL Connected:"
curl -s "$STAGING_URL/api/health" | jq -r '.components.postgresql.connected'

# Expected: true
```

**Expected Output:**
```
=== Part 20 Status Check ===
1. Health Check:
ok
2. Data Source (should be postgresql or cache):
postgresql
3. PostgreSQL Connected:
true
```

**✅ If all checks pass:** Part 20 is running, proceed.
**❌ If any check fails:** Fix Part 20 first, then retry.

---

#### Step 1.2: Verify Archive Exists

The rollback script needs archived Part 6 files. Let's verify they exist.

```bash
echo "=== Checking Part 6 Archive ==="

# 1. Check archive directory exists
if [ -d "archive/part6-flask-mt5" ]; then
  echo "✅ Archive directory exists"
else
  echo "❌ Archive directory NOT found!"
  echo "   You must create it first (see migration guide)"
  exit 1
fi

# 2. Check critical archive files
echo ""
echo "Checking archive contents:"

files=(
  "archive/part6-flask-mt5/mt5-service/app/__init__.py"
  "archive/part6-flask-mt5/.env.part6.backup"
  "archive/part6-flask-mt5/docker-compose.part6.yml"
  "archive/part6-flask-mt5/LAST_COMMIT.txt"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ $file MISSING"
  fi
done
```

**Expected Output:**
```
=== Checking Part 6 Archive ===
✅ Archive directory exists

Checking archive contents:
  ✅ archive/part6-flask-mt5/mt5-service/app/__init__.py
  ✅ archive/part6-flask-mt5/.env.part6.backup
  ✅ archive/part6-flask-mt5/docker-compose.part6.yml
  ✅ archive/part6-flask-mt5/LAST_COMMIT.txt
```

**✅ If all files exist:** Archive is ready, proceed.
**❌ If files missing:** Create archive first (see Step A6 in migration guide).

---

#### Step 1.3: Document Starting State

Before rollback, document current state for comparison.

Create file: `rollback-test-log.txt`

```bash
cat > rollback-test-log.txt <<EOF
Rollback Testing Log
====================
Date: $(date)
Tester: [YOUR NAME]

STARTING STATE (Part 20)
========================

Staging URL: $STAGING_URL

Health Check:
$(curl -s "$STAGING_URL/api/health" | jq .)

Sample API Response:
$(curl -s "$STAGING_URL/api/indicators/EURUSD/H1" | jq '{success, data_source: .data.metadata.data_source, bars: (.data.ohlc | length)}')

Database Row Count:
$(psql $POSTGRESQL_URI -t -c "SELECT COUNT(*) FROM eurusd_h1;")

Start Time: $(date +%H:%M:%S)

EOF

cat rollback-test-log.txt
```

**✅ Checkpoint:** Starting state documented.

---

### Phase 2: Execute Rollback (15 minutes)

⏱️ **START TIMER NOW** - We're measuring rollback duration

#### Step 2.1: Review Rollback Script

Before running, let's understand what the script will do.

```bash
cat scripts/rollback-to-part6.sh
```

The script will:
1. Enable maintenance mode (if configured)
2. Stop sync script (if running)
3. Check data consistency gap
4. Restore Part 6 code from archive
5. Revert API routes to Flask
6. Restore environment variables
7. Restore Docker configuration
8. Start Flask service
9. Verify Flask is healthy
10. Disable maintenance mode

**Important Notes:**
- Script has **confirmation prompts** - you must type 'y' to proceed
- Script has **data gap warnings** - you'll see expected data staleness
- Script has **manual steps** for production (but in staging, most are automatic)

---

#### Step 2.2: Run Rollback Script

```bash
# Make sure you're in project root
pwd  # Should end with: trading-alerts-saas-public

# Ensure script is executable
chmod +x scripts/rollback-to-part6.sh

# Run rollback script
./scripts/rollback-to-part6.sh
```

**What You'll See:**

```
=========================================
ROLLBACK: Part 20 → Part 6
=========================================
⚠️  WARNING: This will restore Flask MT5 service
Are you sure? (y/n)
```

**Type:** `y` and press Enter

---

#### Step 2.3: Follow Script Prompts

The script will now execute each step. Here's what to expect:

**Step 1: Enable Maintenance Mode**
```
Step 1: Enable maintenance mode...
[Either succeeds or shows "endpoint not configured" - both OK in staging]
```

**Step 2: Stop Sync Script**
```
Step 2: Stop sync script...
[May show "connection refused" if sync not running - OK in staging]
```

**Step 2.5: Data Consistency Check**
```
Step 2.5: Check for data consistency issues...
Checking data freshness gap...

⚠️  Data Gap Analysis:
   PostgreSQL last sync: [TIMESTAMP]
   Note: Flask service will need time to catch up after restart
   Users may see data lag of up to X minutes
```

**If gap < 60 minutes:** Script continues automatically
**If gap > 60 minutes:** You'll see:

```
🔴 WARNING: Data gap > 1 hour!
   Users will see stale data after rollback.
   Recommendations:
   1. Display 'Data refreshing, please wait' banner
   2. Disable alerts temporarily
   3. Monitor Flask sync progress

Continue with rollback anyway? (y/n)
```

**Type:** `y` (this is staging, so OK to continue)

**Step 3: Restore Part 6 Code**
```
Step 3: Restore Part 6 code from archive...
[Copies files...]
✅ Part 6 code restored
```

**Step 3.5: Revert API Routes**
```
Step 3.5: Revert API routes to use Flask...
[Runs git restore commands...]
✅ API routes reverted to Flask integration
```

**Step 4: Restore Environment Variables**
```
Step 4: Restore environment variables...
Restoring environment variables to .env...
✅ Environment variables restored to .env

⚠️  MANUAL STEP REQUIRED FOR PRODUCTION:
   1. Go to Railway dashboard: https://railway.app
   [Shows variables to add...]

Press Enter after adding variables to Railway...
```

**In staging:** Just press Enter (you can skip Railway for this test)

**Step 5: Restore Docker Configuration**
```
Step 5: Restore Docker Compose configuration...
✅ Docker Compose configuration restored
```

**Step 6: Start Flask Service**
```
Step 6: Start Flask service...
[docker-compose output...]
Waiting for Flask service to start...
✅ Flask service is healthy
```

**Step 7: Verify Flask Responding**
```
Step 7: Verify Flask responding...
Attempt 1/5: Testing...
✅ Flask service is healthy
```

**Step 8: Test Indicator Endpoint**
```
Step 8: Test indicator endpoint...
[May show warning if Flask needs time to connect to MT5]
```

**Step 9: Disable Maintenance Mode**
```
Step 9: Disable maintenance mode...
```

**Final Output:**
```
=========================================
✅ Rollback complete. Part 6 is active.
=========================================

Post-Rollback Checklist:
  1. Monitor error rates
  2. Check MT5 terminal connections
  3. Verify chart data accuracy
  4. Investigate Part 20 issues
  5. Plan re-migration after fixes

Data Freshness:
  Flask may take time to catch up with current data
  Expected lag: X minutes
```

⏱️ **STOP TIMER** - Record the duration

---

#### Step 2.4: Record Rollback Duration

```bash
echo "Rollback completed at: $(date +%H:%M:%S)" >> rollback-test-log.txt

# Calculate duration manually:
# End time - Start time = Duration
# (or use your stopwatch/timer)

echo "Rollback duration: ____ minutes" >> rollback-test-log.txt
```

**Target:** < 15 minutes
**Acceptable:** < 20 minutes
**Too slow:** > 20 minutes (investigate why)

---

### Phase 3: Verify Rollback Success (20 minutes)

#### Step 3.1: Check Docker Services

```bash
echo "=== Docker Services Check ==="

# List running containers
docker ps

# Expected: You should see mt5-service container
```

**Expected Output:**
```
CONTAINER ID   IMAGE              PORTS                    NAMES
abc123def456   mt5-service:latest 0.0.0.0:5001->5001/tcp   mt5-service
```

**✅ If mt5-service is running:** Flask service started successfully
**❌ If not running:**
```bash
# Check logs
docker logs mt5-service

# Try starting manually
docker-compose up -d mt5-service
```

---

#### Step 3.2: Test Flask Health Endpoint

```bash
echo "=== Flask Health Check ==="

# Test Flask health
curl http://localhost:5001/api/health | jq .
```

**Expected Output:**
```json
{
  "status": "ok",
  "version": "v5.0.0",
  "total_terminals": 15,
  "connected_terminals": 0,  // May be 0 in staging (no MT5 terminals)
  "terminals": {
    // Terminal status...
  }
}
```

**Key Points:**
- `status` should be "ok" or "degraded"
- `connected_terminals` may be 0 (no actual MT5 terminals in staging)
- This is **NORMAL** in staging

**✅ If status is "ok" or "degraded":** Flask is running
**❌ If connection refused:** Flask didn't start, check logs

---

#### Step 3.3: Test Flask Indicators Endpoint

```bash
echo "=== Flask Indicators Check ==="

# Test indicator endpoint
curl "http://localhost:5001/api/indicators/EURUSD/H1" | jq '{success, error}'
```

**Expected Output (Without MT5 Terminals):**
```json
{
  "success": false,
  "error": "MT5 terminal not available"
}
```

**This is NORMAL** - Flask needs actual MT5 terminals, which we don't have in staging.

**What we're verifying:**
- ✅ Flask endpoint responds (not connection refused)
- ✅ Flask is running (even if no MT5 terminals)
- ✅ API route is calling Flask (not PostgreSQL)

---

#### Step 3.4: Verify API Routes Use Flask

This is **critical** - we need to verify the Next.js API routes are calling Flask, not PostgreSQL.

```bash
echo "=== Verify API Routes Reverted ==="

# Check if mt5-client.ts was restored
if [ -f "lib/api/mt5-client.ts" ]; then
  echo "✅ lib/api/mt5-client.ts exists (restored)"
else
  echo "❌ lib/api/mt5-client.ts missing!"
fi

# Check API route imports Flask client
grep -n "mt5-client" app/api/indicators/\[symbol\]/\[timeframe\]/route.ts

# Expected: Should see import from '@/lib/api/mt5-client'
```

**Expected Output:**
```
✅ lib/api/mt5-client.ts exists (restored)

4:import { fetchIndicatorData } from '@/lib/api/mt5-client';
```

**✅ If import found:** API routes are using Flask
**❌ If not found:** Rollback didn't revert API routes

---

#### Step 3.5: Verify Environment Variables

```bash
echo "=== Environment Variables Check ==="

# Check .env file contains Part 6 variables
grep MT5_SERVICE_URL .env
grep MT5_API_KEY .env

# Expected: Should see the Flask service URL and API key
```

**Expected Output:**
```
MT5_SERVICE_URL=http://localhost:5001
MT5_API_KEY=your-api-key-here
```

**✅ If variables present:** Environment restored
**❌ If missing:** Check `.env` file or restore from backup

---

#### Step 3.6: Verify Docker Configuration

```bash
echo "=== Docker Configuration Check ==="

# Check docker-compose.yml contains Flask service
grep -A 5 "mt5-service:" docker-compose.yml
```

**Expected Output:**
```yaml
mt5-service:
  build: ./mt5-service
  ports:
    - "5001:5001"
  environment:
    - MT5_API_KEY=${MT5_API_KEY}
```

**✅ If service definition found:** Docker config restored
**❌ If not found:** docker-compose.yml wasn't restored

---

#### Step 3.7: Complete Rollback Verification Checklist

```bash
cat >> rollback-test-log.txt <<EOF

ROLLBACK VERIFICATION
=====================

1. Docker Service:
   mt5-service running: $(docker ps | grep mt5-service > /dev/null && echo "YES" || echo "NO")

2. Flask Health:
   Status: $(curl -s http://localhost:5001/api/health | jq -r '.status')

3. Flask Indicator Endpoint:
   Responding: $(curl -s http://localhost:5001/api/indicators/EURUSD/H1 > /dev/null && echo "YES" || echo "NO")

4. API Route Imports:
   Using Flask: $(grep -q "mt5-client" app/api/indicators/[symbol]/[timeframe]/route.ts && echo "YES" || echo "NO")

5. Environment Variables:
   MT5_SERVICE_URL: $(grep -q MT5_SERVICE_URL .env && echo "PRESENT" || echo "MISSING")

6. Docker Config:
   mt5-service defined: $(grep -q "mt5-service:" docker-compose.yml && echo "YES" || echo "NO")

Rollback End Time: $(date +%H:%M:%S)

EOF

cat rollback-test-log.txt
```

---

### Phase 4: Clean Up and Re-Deploy Part 20 (15 minutes)

After testing rollback, we need to get back to Part 20 for further testing or production migration.

#### Step 4.1: Stop Flask Service

```bash
echo "=== Stopping Flask Service ==="

docker-compose down mt5-service

echo "✅ Flask service stopped"
```

---

#### Step 4.2: Restore Part 20 Code

```bash
echo "=== Restoring Part 20 Code ==="

# Re-checkout Part 20 branch
git checkout claude/implement-phase09-prompts-ZmJLD

# Restore Part 20 files (that rollback reverted)
git restore app/api/indicators/[symbol]/[timeframe]/route.ts
git restore lib/jobs/alert-checker.ts
git restore lib/monitoring/system-monitor.ts

# Remove Flask client (deleted in Part 20)
rm -f lib/api/mt5-client.ts
rm -f lib/api/mt5-transform.ts

echo "✅ Part 20 code restored"
```

---

#### Step 4.3: Restore Part 20 Environment

```bash
echo "=== Restoring Part 20 Environment ==="

# Remove Part 6 env vars
sed -i '/MT5_SERVICE_URL/d' .env
sed -i '/MT5_API_KEY/d' .env

# Add Part 20 env vars
cat >> .env <<EOF
POSTGRESQL_URI=$STAGING_POSTGRESQL_URI
REDIS_URL=$STAGING_REDIS_URL
EOF

echo "✅ Part 20 environment restored"
```

---

#### Step 4.4: Restore Part 20 Docker Config

```bash
echo "=== Restoring Part 20 Docker Config ==="

# Restore Part 20 docker-compose.yml
git restore docker-compose.yml

echo "✅ Part 20 Docker configuration restored"
```

---

#### Step 4.5: Verify Back to Part 20

```bash
echo "=== Verify Part 20 Restored ==="

# Check staging still works
curl -s "$STAGING_URL/api/health" | jq -r '.status'

# Expected: ok

# Check data source is PostgreSQL
curl -s "$STAGING_URL/api/indicators/EURUSD/H1" | jq -r '.data.metadata.data_source'

# Expected: postgresql or cache

echo "✅ Part 20 restored successfully"
```

---

## Verification

### Rollback Test Success Checklist

```
Rollback Testing - Success Criteria
====================================

PRE-ROLLBACK:
[✓] Part 20 was running in staging
[✓] Archive files present
[✓] Starting state documented

ROLLBACK EXECUTION:
[✓] Script ran without errors
[✓] All confirmation prompts handled
[✓] Duration: _____ minutes (target: < 15 min)

POST-ROLLBACK VERIFICATION:
[✓] Flask service started
[✓] Flask health endpoint responding
[✓] Flask indicators endpoint responding
[✓] API routes using Flask (not PostgreSQL)
[✓] Environment variables restored
[✓] Docker configuration restored

CLEANUP:
[✓] Flask service stopped
[✓] Part 20 code restored
[✓] Part 20 environment restored
[✓] Staging working on Part 20 again

DOCUMENTATION:
[✓] Rollback duration recorded
[✓] Issues documented (if any)
[✓] Lessons learned noted
```

### Expected Results

| Metric | Target | Acceptable | Needs Work |
|--------|--------|------------|------------|
| **Rollback Duration** | < 15 min | < 20 min | > 20 min |
| **Script Errors** | 0 | 0 | > 0 |
| **Flask Startup** | Success | Success | Failed |
| **API Routes Reverted** | 100% | 100% | < 100% |
| **Environment Restored** | 100% | 100% | < 100% |

---

## Troubleshooting

### Issue 1: Rollback Script Fails at Step 3

**Symptom:**
```
Step 3: Restore Part 6 code from archive...
cp: cannot stat 'archive/part6-flask-mt5/mt5-service': No such file or directory
```

**Solution:**

Archive doesn't exist. You need to create it first.

```bash
# Check if archive exists
ls -la archive/part6-flask-mt5/

# If missing, create it (see migration guide Step A6)
mkdir -p archive/part6-flask-mt5
# Copy Part 6 files to archive
```

---

### Issue 2: Flask Service Fails to Start

**Symptom:**
```
Step 6: Start Flask service...
ERROR: no such service: mt5-service
```

**Solution:**

Docker config wasn't restored properly.

```bash
# Verify docker-compose.yml has mt5-service
grep "mt5-service:" docker-compose.yml

# If missing, restore from archive
cp archive/part6-flask-mt5/docker-compose.part6.yml docker-compose.yml

# Try starting again
docker-compose up -d mt5-service
```

---

### Issue 3: API Routes Still Use PostgreSQL

**Symptom:**
After rollback, API still returns data from PostgreSQL.

**Solution:**

Git restore didn't work. Manual file restoration needed.

```bash
# Check what's imported in API route
cat app/api/indicators/[symbol]/[timeframe]/route.ts | grep import

# If you see: import from '@/lib/cache/indicator-cache'
# Need to restore from git

git restore app/api/indicators/[symbol]/[timeframe]/route.ts

# Verify import changed
cat app/api/indicators/[symbol]/[timeframe]/route.ts | grep import

# Should see: import from '@/lib/api/mt5-client'
```

---

### Issue 4: Environment Variables Not Restored

**Symptom:**
```
MT5_SERVICE_URL not found in .env
```

**Solution:**

Manual restore from backup.

```bash
# Check if backup exists
cat archive/part6-flask-mt5/.env.part6.backup

# Restore to .env
cat archive/part6-flask-mt5/.env.part6.backup >> .env

# Verify
grep MT5_SERVICE_URL .env
```

---

### Issue 5: Rollback Takes > 20 Minutes

**Symptom:**
Rollback script is very slow.

**Analysis:**

Identify which step is slow:

```bash
# Re-run rollback with timing
time ./scripts/rollback-to-part6.sh

# Or add timestamps to each step
```

**Common slow steps:**
- Docker service startup (5-10 min) - NORMAL
- Git operations (< 1 min) - should be fast
- File copying (< 1 min) - should be fast

**Solutions:**

1. **If Docker is slow:**
   - Normal in staging with limited resources
   - In production, should be faster
   - Consider pre-pulling Docker images

2. **If git operations are slow:**
   - Check network connection
   - Repository might be large
   - Use `git restore` instead of full checkout

---

## Decision Point

### After Completing Rollback Test

You now need to decide: **Are you ready for production migration?**

### ✅ READY FOR PRODUCTION if:

- [✓] Rollback completed successfully
- [✓] Rollback duration < 15 minutes
- [✓] All verification checks passed
- [✓] No critical issues found
- [✓] Team understands rollback procedure
- [✓] Documentation complete

**Next Action:** 🚀 Proceed to [Production Migration Guide](./production-migration-guide.md)

---

### ⚠️ NOT READY if:

- [ ] Rollback failed at any step
- [ ] Rollback duration > 20 minutes
- [ ] Flask service didn't start
- [ ] API routes didn't revert
- [ ] Critical issues found

**Next Action:** 🔧 Fix issues and retry rollback test

**Common fixes:**
1. Missing archive files → Create archive properly
2. Docker issues → Review docker-compose.yml
3. Git issues → Verify git repository state
4. Slow rollback → Optimize slow steps

**Retry after fixes:**
```bash
# Clean up from failed test
docker-compose down
git restore .

# Fix identified issues
# ...

# Retry rollback test
./scripts/rollback-to-part6.sh
```

---

## Post-Test Actions

### Document Lessons Learned

Create file: `rollback-test-lessons.txt`

```
Rollback Test Lessons Learned
==============================
Date: [DATE]

What Went Well:
- [List things that worked smoothly]
-
-

What Needs Improvement:
- [List issues or slow steps]
-
-

Actual Rollback Duration: ____ minutes

Changes to Make Before Production:
- [List any script improvements needed]
-
-

Team Training Needs:
- [List anything team needs to know]
-
-

Confidence Level for Production: ___/10

Ready for Production: YES / NO
```

---

### Share Results with Team

Send rollback test results to team:

```
Subject: Rollback Test Results - Part 20 Migration

Team,

Rollback testing completed successfully in staging.

Key Results:
- Rollback Duration: ____ minutes (target: < 15 min)
- All Verification Checks: PASSED
- Issues Found: [NONE / LIST]

Confidence Level: ___/10

We are [READY / NOT READY] to proceed with production migration.

Next Steps:
[List next actions]

See full log: rollback-test-log.txt

[YOUR NAME]
```

---

## Success Criteria Summary

### You've Successfully Completed Rollback Testing When:

1. ✅ **Rollback script executed** without critical errors
2. ✅ **Flask service started** and responded to health checks
3. ✅ **API routes reverted** to Flask integration
4. ✅ **Environment variables restored** completely
5. ✅ **Docker configuration restored** successfully
6. ✅ **Duration measured** and acceptable (< 15-20 min)
7. ✅ **Part 20 restored** in staging after test
8. ✅ **Documentation complete** (logs, lessons learned)
9. ✅ **Team notified** of results

### Red Flags (Must Fix Before Production):

- 🔴 Rollback script fails completely
- 🔴 Flask service won't start
- 🔴 Duration > 30 minutes
- 🔴 Data loss during rollback
- 🔴 Can't restore Part 20 after test

---

## Quick Reference

### Useful Commands During Test

```bash
# Check rollback script
cat scripts/rollback-to-part6.sh

# Run rollback
./scripts/rollback-to-part6.sh

# Check Flask status
docker ps | grep mt5-service
curl http://localhost:5001/api/health | jq .

# Check API routes
grep "import" app/api/indicators/[symbol]/[timeframe]/route.ts

# View logs
tail -f rollback-test-log.txt
docker logs mt5-service

# Restore Part 20
git checkout claude/implement-phase09-prompts-ZmJLD
git restore .
```

### Important Files

- `scripts/rollback-to-part6.sh` - Rollback script
- `archive/part6-flask-mt5/` - Archived Part 6 files
- `rollback-test-log.txt` - Your test log
- `rollback-test-lessons.txt` - Lessons learned

---

## Next Steps

### If Test Passed ✅

1. **Celebrate!** 🎉 You've practiced emergency rollback
2. **Review logs** and share with team
3. **Document timing** for production planning
4. **Proceed to:** [Production Migration Guide](./production-migration-guide.md)

### If Test Failed ❌

1. **Don't panic** - this is why we test in staging!
2. **Identify issues** from logs
3. **Fix issues** one by one
4. **Retry test** until successful
5. **Only proceed to production** after successful test

---

**Remember:** The goal isn't perfection - it's **confidence**. After completing this test, you should feel confident that if something goes wrong in production, you can rollback quickly and safely.

---

**Document Version:** 1.0
**Last Updated:** 2026-01-07
**Mandatory:** YES - Must complete before production migration
**Success Rate:** 100% required to proceed
