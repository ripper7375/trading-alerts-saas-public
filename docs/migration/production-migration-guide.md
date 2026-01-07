# Production Migration Guide - Part 20 Migration

**Estimated Time:** 8 hours (includes buffer for monitoring)
**Skill Level:** Beginner-friendly with team support
**Risk Level:** Medium (mitigated by tested rollback)
**Purpose:** Execute complete migration from Part 6 to Part 20 in production

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Pre-Migration Checklist](#pre-migration-checklist)
4. [Migration Timeline](#migration-timeline)
5. [Team Roles & Responsibilities](#team-roles--responsibilities)
6. [Step-by-Step Execution](#step-by-step-execution)
7. [Monitoring & Verification](#monitoring--verification)
8. [Post-Migration Tasks](#post-migration-tasks)
9. [Emergency Rollback](#emergency-rollback)
10. [Communication Templates](#communication-templates)

---

## Overview

### What This Guide Covers

This guide walks you through the **actual production migration** from Part 6 (Flask MT5 service) to Part 20 (SQLite + Sync to PostgreSQL). Unlike staging testing, this affects **real users**.

### Migration Strategy

We're using a **blue-green deployment** approach:

```
Current State (Blue):
Production → Flask → MT5 Terminals → Live Data

Migration:
Production → PostgreSQL ← SQLite ← MT5 Terminals

Final State (Green):
Production → PostgreSQL → Live Data
(Flask archived as backup)
```

### Key Principles

1. **Safety First:** Multiple verification points
2. **Rollback Ready:** Can revert in < 15 minutes
3. **User Impact:** Minimize disruption
4. **Communication:** Keep users informed
5. **Monitoring:** Watch metrics closely

---

## Prerequisites

### Completed Previous Guides

- [✓] [Staging Preparation Guide](./staging-preparation-guide.md) - 100% complete
- [✓] [Rollback Testing Guide](./rollback-testing-guide.md) - PASSED
- [✓] Rollback tested and < 15 minutes
- [✓] Team trained on rollback procedure

### Production Infrastructure Ready

- [ ] Production PostgreSQL (Railway/AWS) - accessible
- [ ] Production Redis (Railway/AWS) - accessible
- [ ] TimescaleDB extension installed
- [ ] Database schema deployed (135+ tables)
- [ ] Indexes created
- [ ] Retention policies configured

### MT5 & Sync Ready (Contabo VPS)

- [ ] 15 MT5 terminals running with indicators
- [ ] MQL5 DataCollector service on each terminal
- [ ] SQLite database created and receiving data
- [ ] Sync script tested (SQLite → PostgreSQL)
- [ ] SSH access to Contabo VPS
- [ ] Sync script configured with production PostgreSQL URI

### Code & Deployment Ready

- [ ] Part 20 code merged to main branch
- [ ] All tests passing in CI
- [ ] Build succeeds
- [ ] Docker images built (if using)
- [ ] Railway/deployment platform configured
- [ ] Environment variables documented

### Team Ready

- [ ] Technical lead available
- [ ] DevOps engineer available
- [ ] Support team notified
- [ ] Rollback procedure reviewed
- [ ] Communication plan approved
- [ ] Migration window scheduled

### Documentation Ready

- [ ] Migration runbook (this document)
- [ ] Rollback script verified
- [ ] Communication templates ready
- [ ] Monitoring dashboard URLs ready
- [ ] Contact list for escalations

---

## Pre-Migration Checklist

### 24 Hours Before Migration

#### Infrastructure Verification

```bash
# Production PostgreSQL Check
psql $PRODUCTION_POSTGRESQL_URI -c "SELECT version();"
# ✓ Should return PostgreSQL 12+ with TimescaleDB

# Production Redis Check
redis-cli -u $PRODUCTION_REDIS_URL PING
# ✓ Should return: PONG

# Count tables
psql $PRODUCTION_POSTGRESQL_URI -c "
  SELECT COUNT(*) FROM pg_tables WHERE schemaname='public';
"
# ✓ Should return: 135+

# Check database size
psql $PRODUCTION_POSTGRESQL_URI -c "
  SELECT pg_size_pretty(pg_database_size(current_database()));
"
# ✓ Should be reasonable size

# Check indexes
psql $PRODUCTION_POSTGRESQL_URI -c "
  SELECT COUNT(*) FROM pg_indexes WHERE schemaname='public';
"
# ✓ Should have indexes on all tables
```

**✅ All checks must pass before proceeding.**

---

#### Backup Current Production

```bash
echo "=== Creating Production Backups ==="

# 1. Backup production database
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="production_backup_${DATE}.sql"

pg_dump $PRODUCTION_POSTGRESQL_URI > $BACKUP_FILE
gzip $BACKUP_FILE

echo "✅ Database backup: ${BACKUP_FILE}.gz"

# 2. Backup environment variables
cp .env.production .env.production.backup.$DATE

echo "✅ Environment backup: .env.production.backup.$DATE"

# 3. Backup current code
git tag "pre-part20-migration-$DATE"
git push origin "pre-part20-migration-$DATE"

echo "✅ Code tagged: pre-part20-migration-$DATE"

# 4. Archive Part 6 (if not done already)
if [ ! -d "archive/part6-flask-mt5" ]; then
  echo "⚠️  Creating Part 6 archive..."
  mkdir -p archive/part6-flask-mt5
  # Follow Step A6 from revised migration plan
fi

echo "✅ All backups complete"
```

**Store backups securely** - you may need them for rollback.

---

#### Sync Script Verification (Contabo VPS)

```bash
# SSH to Contabo VPS
ssh user@contabo-vps-ip

# Check sync script status
cd /opt/trading-alerts/sync
./sync-status.sh

# Expected output:
# Sync Status: Running
# Last sync: < 60 seconds ago
# Errors: 0
# Symbols syncing: 15/15
```

**If sync not running or has errors:** Fix before migration.

---

#### Notify Stakeholders

Send email using template from [Communication Templates](#communication-templates):

**Subject:** Trading Alerts - System Upgrade Scheduled [DATE]

**Recipients:**
- Internal team
- Key users (if applicable)
- Support team

**Content:** Migration announcement (24-hour notice)

---

### 1 Hour Before Migration

#### Final Pre-Flight Checks

```bash
echo "=== Pre-Flight Checklist ===" > preflight-check.log

# 1. Team availability
echo "Team Status:" >> preflight-check.log
echo "  Technical Lead: [AVAILABLE/UNAVAILABLE]" >> preflight-check.log
echo "  DevOps: [AVAILABLE/UNAVAILABLE]" >> preflight-check.log
echo "  Support: [NOTIFIED/NOT NOTIFIED]" >> preflight-check.log

# 2. Current production status
echo "" >> preflight-check.log
echo "Production Status:" >> preflight-check.log
curl -s $PRODUCTION_URL/api/health >> preflight-check.log

# 3. Error rate baseline
echo "" >> preflight-check.log
echo "Current Error Rate: [CHECK MONITORING DASHBOARD]" >> preflight-check.log

# 4. User count
echo "Active Users: [CHECK ANALYTICS]" >> preflight-check.log

# 5. Rollback script ready
echo "" >> preflight-check.log
echo "Rollback Script:" >> preflight-check.log
ls -la scripts/rollback-to-part6.sh >> preflight-check.log

cat preflight-check.log
```

**GO/NO-GO Decision Point**

| Check | Status | Required |
|-------|--------|----------|
| Team Available | ✓/✗ | YES |
| Production Healthy | ✓/✗ | YES |
| Backups Complete | ✓/✗ | YES |
| Sync Running | ✓/✗ | YES |
| Rollback Tested | ✓/✗ | YES |

**If ALL ✓:** Proceed
**If ANY ✗:** Delay migration, fix issues

---

## Migration Timeline

### Recommended Schedule

**Best Time:** Saturday/Sunday 2:00 AM (lowest traffic)

**Duration Breakdown:**

| Phase | Task | Duration | Time |
|-------|------|----------|------|
| **Preparation** | Pre-checks & backups | 30 min | 02:00-02:30 |
| **Migration** | Code deployment | 15 min | 02:30-02:45 |
| **Sync Start** | Start sync script | 10 min | 02:45-02:55 |
| **Verification** | Smoke tests | 15 min | 02:55-03:10 |
| **Monitoring** | Initial monitoring | 30 min | 03:10-03:40 |
| **Buffer** | Issue resolution | 30 min | 03:40-04:10 |
| **Extended Monitoring** | Watch metrics | 3 hours | 04:10-07:10 |
| **Sign-off** | Final approval | 10 min | 07:10-07:20 |

**Total:** ~5.5 hours (with 30-min buffer)
**Extended Monitoring:** Continue for 24 hours

---

## Team Roles & Responsibilities

### Migration Team

| Role | Name | Responsibilities | Contact |
|------|------|------------------|---------|
| **Migration Lead** | [NAME] | Execute migration, make decisions | [PHONE/SLACK] |
| **DevOps Engineer** | [NAME] | Infrastructure, deployments | [PHONE/SLACK] |
| **Backend Developer** | [NAME] | Code issues, API debugging | [PHONE/SLACK] |
| **QA/Tester** | [NAME] | Verification testing | [PHONE/SLACK] |
| **Support Lead** | [NAME] | Monitor user reports | [PHONE/SLACK] |

### Decision Authority

**Rollback Decision:** Migration Lead + DevOps Engineer (2-person approval)

**Proceed Decision:** Migration Lead (final say)

---

## Step-by-Step Execution

### Phase 1: Preparation (30 minutes)

#### Step 1.1: Enable Monitoring

Set up real-time monitoring dashboard:

```bash
# Start monitoring script (in separate terminal)
./scripts/monitor-production.sh

# This will show:
# - API response times
# - Error rates
# - Database connections
# - Redis cache stats
# - User sessions
```

**Keep this running throughout migration.**

---

#### Step 1.2: Create Migration Log

```bash
cat > production-migration-log.txt <<EOF
Production Migration Log - Part 20
===================================
Date: $(date)
Migration Lead: [YOUR NAME]

Timeline:
---------
$(date +%H:%M:%S) - Migration started

Pre-Migration State:
--------------------
Production URL: $PRODUCTION_URL
PostgreSQL: $PRODUCTION_POSTGRESQL_URI
Redis: $PRODUCTION_REDIS_URL

Current Health:
$(curl -s $PRODUCTION_URL/api/health | jq .)

Baseline Metrics:
- Error Rate: [FROM DASHBOARD]
- Response Time: [FROM DASHBOARD]
- Active Users: [FROM ANALYTICS]

EOF

cat production-migration-log.txt
```

---

#### Step 1.3: Enable Maintenance Mode (Optional)

**Decision:** Do you want to show a "maintenance" message during migration?

**Option A: No Maintenance Mode** (Recommended)
- Migration happens in background
- Users may not notice
- Small risk of confused error messages if issues occur

**Option B: Enable Maintenance Mode**
- Shows "System upgrading" message
- No user traffic during critical period
- Requires maintenance page setup

**If using Option B:**

```bash
# Enable maintenance mode
curl -X POST $PRODUCTION_URL/api/admin/maintenance/enable \
  -H "X-Admin-API-Key: $ADMIN_API_KEY"

# Verify
curl $PRODUCTION_URL/
# Should show maintenance page
```

---

#### Step 1.4: Notify Users (Final Notice)

Send 15-minute warning using template from [Communication Templates](#communication-templates).

---

### Phase 2: Code Migration (15 minutes)

#### Step 2.1: Deploy Part 20 Code to Production

**Platform: Railway (example)**

```bash
echo "$(date +%H:%M:%S) - Starting code deployment" >> production-migration-log.txt

# Ensure you're on the right branch
git checkout main

# Verify Part 20 code is merged
git log --oneline -5

# Push to production (Railway auto-deploys)
git push production main

# Or trigger manual deployment in Railway dashboard
```

**Expected:** Railway starts building and deploying.

**Deployment will:**
1. Build Next.js application
2. Run database migrations (Prisma)
3. Start new application instance
4. Health check
5. Route traffic to new instance

**Monitor deployment:**
- Railway dashboard → Deployments → Watch logs
- Look for: "✓ Compiled successfully"
- Look for: "Ready on port 3000"

---

#### Step 2.2: Wait for Deployment

```bash
echo "Waiting for deployment to complete..."

# Poll health endpoint (wait for new version)
for i in {1..30}; do
  STATUS=$(curl -s $PRODUCTION_URL/api/health | jq -r '.status')
  if [ "$STATUS" == "ok" ]; then
    echo "✅ Deployment successful"
    echo "$(date +%H:%M:%S) - Deployment complete" >> production-migration-log.txt
    break
  fi
  echo "Attempt $i/30: Waiting for deployment..."
  sleep 10
done
```

**Expected:** Health endpoint returns "ok" within 5 minutes.

**If deployment fails:**
- Check Railway logs
- Look for build errors
- Verify environment variables
- Consider rollback if critical

---

#### Step 2.3: Verify New Code Deployed

```bash
echo "=== Verifying Part 20 Deployed ==="

# Check health endpoint includes PostgreSQL
curl -s $PRODUCTION_URL/api/health | jq '.components.postgresql'

# Expected: {"connected": true}

# Check API route uses PostgreSQL (not Flask)
curl -s $PRODUCTION_URL/api/indicators/EURUSD/H1 | jq '{success, data_source: .data.metadata.data_source}'

# Expected: {"success": true, "data_source": "postgresql" or "cache"}
```

**✅ If PostgreSQL and not Flask:** Part 20 is deployed
**❌ If still showing Flask:** Deployment didn't work, investigate

---

### Phase 3: Start Sync Script (10 minutes)

#### Step 3.1: SSH to Contabo VPS

```bash
# Connect to Contabo VPS
ssh user@contabo-vps-ip

# Navigate to sync script directory
cd /opt/trading-alerts/sync
```

---

#### Step 3.2: Configure Sync Script for Production

```bash
# Update sync configuration
nano config/sync.conf

# Verify these settings:
# POSTGRESQL_URI=postgresql://user:pass@production-host:5432/db
# SYNC_INTERVAL=30  # 30 seconds
# LOG_LEVEL=INFO

# Save and exit
```

---

#### Step 3.3: Start Sync Script

```bash
echo "Starting sync script..."

# Start sync as background service
./start-sync.sh

# Expected output:
# Starting SQLite → PostgreSQL sync service...
# ✓ Sync service started (PID: 12345)
# ✓ Logging to: /var/log/trading-sync.log

# Verify it's running
./sync-status.sh

# Expected:
# Sync Status: Running
# Process ID: 12345
# Uptime: 5 seconds
# Last sync: Just now
# Symbols syncing: 15/15
# Errors: 0
```

**✅ If running:** Sync started successfully
**❌ If failed:** Check logs at `/var/log/trading-sync.log`

---

#### Step 3.4: Monitor Initial Sync

```bash
# Watch sync logs in real-time
tail -f /var/log/trading-sync.log

# Look for:
# [INFO] Syncing EURUSD M5: 245 rows updated
# [INFO] Syncing BTCUSD H1: 189 rows updated
# [INFO] Sync cycle completed in 12.5 seconds
```

**Watch for 2-3 sync cycles** to ensure it's working.

**Record in migration log:**

```bash
echo "$(date +%H:%M:%S) - Sync script started on Contabo VPS" >> production-migration-log.txt
echo "  First sync completed at: $(date +%H:%M:%S)" >> production-migration-log.txt
```

---

### Phase 4: Verification & Smoke Tests (15 minutes)

#### Step 4.1: API Endpoint Verification

```bash
echo "=== API Endpoint Smoke Tests ===" >> production-migration-log.txt

# Test 1: Health Check
echo "Test 1: Health Check" >> production-migration-log.txt
curl -s $PRODUCTION_URL/api/health | jq . >> production-migration-log.txt

# Test 2: FREE tier symbol (EURUSD)
echo "" >> production-migration-log.txt
echo "Test 2: EURUSD H1 (FREE tier)" >> production-migration-log.txt
curl -s "$PRODUCTION_URL/api/indicators/EURUSD/H1" | jq '{success, bars: (.data.ohlc | length), data_source: .data.metadata.data_source}' >> production-migration-log.txt

# Test 3: FREE tier symbol (BTCUSD)
echo "" >> production-migration-log.txt
echo "Test 3: BTCUSD H1 (FREE tier)" >> production-migration-log.txt
curl -s "$PRODUCTION_URL/api/indicators/BTCUSD/H1" | jq '{success, bars: (.data.ohlc | length)}' >> production-migration-log.txt

# Test 4: FREE tier symbol (USDJPY)
echo "" >> production-migration-log.txt
echo "Test 4: USDJPY H1 (FREE tier)" >> production-migration-log.txt
curl -s "$PRODUCTION_URL/api/indicators/USDJPY/H1" | jq '{success, bars: (.data.ohlc | length)}' >> production-migration-log.txt

# Test 5: PRO tier symbol (GBPUSD)
echo "" >> production-migration-log.txt
echo "Test 5: GBPUSD H1 (PRO tier)" >> production-migration-log.txt
curl -s "$PRODUCTION_URL/api/indicators/GBPUSD/H1" | jq '{success, bars: (.data.ohlc | length)}' >> production-migration-log.txt

# Test 6: Confluence (PRO feature)
echo "" >> production-migration-log.txt
echo "Test 6: Confluence for EURUSD" >> production-migration-log.txt
curl -s "$PRODUCTION_URL/api/confluence/EURUSD" | jq '{success, score: .confluence_score}' >> production-migration-log.txt

cat production-migration-log.txt
```

**Expected Results:**
- Test 1: Health = "ok"
- Test 2-5: success = true, bars > 0
- Test 6: success = true, score = 0-10

**✅ All tests pass:** API working correctly
**❌ Any test fails:** Investigate immediately

---

#### Step 4.2: Cache Verification

```bash
echo "=== Cache Verification ===" >> production-migration-log.txt

# Test cache working
curl -s "$PRODUCTION_URL/api/cache/stats" | jq . >> production-migration-log.txt

# Make same request twice (second should be cached)
echo "First request (uncached):" >> production-migration-log.txt
TIME1=$(date +%s%N)
curl -s "$PRODUCTION_URL/api/indicators/EURUSD/H1" > /dev/null
TIME2=$(date +%s%N)
DURATION1=$(( ($TIME2 - $TIME1) / 1000000 ))
echo "  Duration: ${DURATION1}ms" >> production-migration-log.txt

sleep 1

echo "Second request (should be cached):" >> production-migration-log.txt
TIME1=$(date +%s%N)
curl -s "$PRODUCTION_URL/api/indicators/EURUSD/H1" > /dev/null
TIME2=$(date +%s%N)
DURATION2=$(( ($TIME2 - $TIME1) / 1000000 ))
echo "  Duration: ${DURATION2}ms" >> production-migration-log.txt

echo "Cache speedup: $(( $DURATION1 - $DURATION2 ))ms" >> production-migration-log.txt
```

**Expected:** Second request significantly faster (< 50ms).

---

#### Step 4.3: Data Accuracy Verification

**Manual Check (Important!):**

1. **Open MT5 Terminal**
   - Connect to broker
   - Open EURUSD H1 chart
   - Note the current close price

2. **Open Production App**
   - Navigate to EURUSD H1 chart
   - Compare the current close price

3. **Verify Match**
   ```bash
   # MT5 Terminal shows: 1.08625
   # Production app shows: 1.08625
   # ✓ Prices match
   ```

**✅ If prices match within 1 pip:** Data accuracy confirmed
**❌ If prices differ significantly:** Check sync script logs

---

#### Step 4.4: Frontend Verification

**Manual Testing Checklist:**

```
Frontend Smoke Tests
====================

[ ] Homepage loads without errors
[ ] Login works
[ ] Dashboard loads
[ ] Charts render (pick 3 random symbols)
    [ ] EURUSD H1
    [ ] BTCUSD H4
    [ ] USDJPY D1
[ ] Chart data matches MT5
[ ] Trendlines visible
[ ] Indicators visible
[ ] Zoom/pan works
[ ] No console errors (F12 → Console)
[ ] No missing images
[ ] Alerts page loads
[ ] Settings page loads
```

**Assign this to QA/Tester if available.**

---

### Phase 5: Monitoring (30 minutes + 3 hours)

#### Step 5.1: Immediate Monitoring (First 30 Minutes)

**Watch these metrics every 5 minutes:**

```bash
# Create monitoring script
cat > scripts/migration-monitor.sh <<'EOF'
#!/bin/bash

while true; do
  clear
  echo "========================================="
  echo "Production Migration Monitoring"
  echo "$(date)"
  echo "========================================="

  # Health
  echo ""
  echo "Health Status:"
  curl -s $PRODUCTION_URL/api/health | jq -r '.status'

  # Error rate (from application logs or monitoring service)
  echo ""
  echo "Recent Errors (last 5 min):"
  # Add your error checking command here
  # Example: curl monitoring service API

  # Response time
  echo ""
  echo "API Response Time:"
  TIME1=$(date +%s%N)
  curl -s "$PRODUCTION_URL/api/indicators/EURUSD/H1" > /dev/null
  TIME2=$(date +%s%N)
  DURATION=$(( ($TIME2 - $TIME1) / 1000000 ))
  echo "  ${DURATION}ms"

  # Active database connections
  echo ""
  echo "Database Connections:"
  psql $PRODUCTION_POSTGRESQL_URI -t -c "
    SELECT count(*) FROM pg_stat_activity
    WHERE datname = current_database();
  "

  # Redis memory
  echo ""
  echo "Redis Memory:"
  redis-cli -u $PRODUCTION_REDIS_URL INFO MEMORY | grep used_memory_human

  # Sync status (Contabo)
  echo ""
  echo "Sync Status:"
  ssh user@contabo-vps-ip "cd /opt/trading-alerts/sync && ./sync-status.sh | grep 'Last sync'"

  echo ""
  echo "========================================="
  echo "Next check in 5 minutes..."
  echo "Press Ctrl+C to stop"
  echo "========================================="

  sleep 300  # 5 minutes
done
EOF

chmod +x scripts/migration-monitor.sh

# Run monitoring
./scripts/migration-monitor.sh
```

**What to Look For:**

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| **Health Status** | ok | degraded | error |
| **Response Time** | < 200ms | 200-500ms | > 500ms |
| **Error Rate** | < 0.1% | 0.1-1% | > 1% |
| **DB Connections** | < 20 | 20-50 | > 50 |
| **Sync Lag** | < 60s | 60-120s | > 120s |

**If any CRITICAL metric:** Escalate immediately, consider rollback.

---

#### Step 5.2: Extended Monitoring (Next 3 Hours)

After the first 30 minutes, reduce monitoring frequency to every 30 minutes.

```bash
# Less frequent monitoring
# Change sleep time in script: sleep 1800  # 30 minutes
```

**Also Monitor:**
- Error tracking dashboard (Sentry, Rollbar, etc.)
- Analytics (user activity)
- Support tickets (user reports)

---

#### Step 5.3: Disable Maintenance Mode

After 30 minutes of stable operation:

```bash
# Disable maintenance mode (if enabled)
curl -X POST $PRODUCTION_URL/api/admin/maintenance/disable \
  -H "X-Admin-API-Key: $ADMIN_API_KEY"

echo "$(date +%H:%M:%S) - Maintenance mode disabled" >> production-migration-log.txt
```

---

### Phase 6: Migration Completion (10 minutes)

#### Step 6.1: Final Verification

```bash
echo "=== Final Migration Verification ===" >> production-migration-log.txt
echo "Time: $(date +%H:%M:%S)" >> production-migration-log.txt

# All critical checks
CHECKS=(
  "Health:$(curl -s $PRODUCTION_URL/api/health | jq -r '.status')"
  "PostgreSQL:$(curl -s $PRODUCTION_URL/api/health | jq -r '.components.postgresql.connected')"
  "Redis:$(curl -s $PRODUCTION_URL/api/health | jq -r '.components.redis.connected')"
  "API_Working:$(curl -s $PRODUCTION_URL/api/indicators/EURUSD/H1 | jq -r '.success')"
  "Sync_Running:$(ssh user@contabo-vps-ip 'cd /opt/trading-alerts/sync && ./sync-status.sh' | grep -q 'Running' && echo 'true' || echo 'false')"
)

for check in "${CHECKS[@]}"; do
  echo "  $check" >> production-migration-log.txt
done

# Final metrics
echo "" >> production-migration-log.txt
echo "Final Metrics:" >> production-migration-log.txt
echo "  Error Rate: [FROM DASHBOARD]" >> production-migration-log.txt
echo "  Response Time: [FROM DASHBOARD]" >> production-migration-log.txt
echo "  Active Users: [FROM ANALYTICS]" >> production-migration-log.txt

# Migration duration
echo "" >> production-migration-log.txt
echo "Migration Duration: [CALCULATE FROM LOG]" >> production-migration-log.txt

cat production-migration-log.txt
```

---

#### Step 6.2: Sign-Off Decision

**Migration Lead + DevOps Review:**

```
Migration Sign-Off Checklist
=============================

Technical Checks:
[ ] All API endpoints working
[ ] Health status: ok
[ ] Error rate < 1%
[ ] Response time < 500ms
[ ] Sync script running
[ ] Data accuracy verified
[ ] Frontend working

User Impact:
[ ] No critical user reports
[ ] Support tickets normal
[ ] Analytics normal

Monitoring:
[ ] 3+ hours stable operation
[ ] No anomalies detected

Decision: APPROVE / ROLLBACK
Signed: [NAME], [TIMESTAMP]
```

**If APPROVE:** Proceed to Post-Migration Tasks
**If ROLLBACK:** Follow [Emergency Rollback](#emergency-rollback)

---

## Post-Migration Tasks

### Immediate (Same Day)

#### Task 1: Notify Stakeholders

Send "Migration Complete" email (see [Communication Templates](#communication-templates)).

---

#### Task 2: Archive Flask Service (Don't Delete!)

```bash
# Ensure Flask service is still in archive
ls -la archive/part6-flask-mt5/

# Add "ARCHIVED" notice to README
cat >> archive/part6-flask-mt5/README.md <<EOF

===================================
MIGRATION COMPLETED: $(date)
===================================

Part 20 successfully deployed to production.
This archive is kept for rollback capability.

DO NOT DELETE for at least 30 days.

Archive will be deleted on: $(date -d "+30 days")

===================================
EOF
```

**Keep Flask archive for 30 days minimum.**

---

#### Task 3: Update Documentation

```bash
# Add deprecation notice to Part 6 docs
cat >> docs/build-orders/part-06-flask-mt5.md <<EOF

> ⚠️ **DEPRECATED AS OF $(date)**
>
> This Part has been replaced by Part 20 (SQLite + Sync to PostgreSQL).
> Archived at: archive/part6-flask-mt5/
> Production migration completed: $(date)
> Migration lead: [NAME]
>
> For current architecture, see: docs/sqlite-and-mt5service/part-20-architecture-design.md
EOF

# Update README architecture diagram
# (Update manually)

# Commit documentation updates
git add docs/
git commit -m "docs: mark Part 6 as deprecated, migration completed"
git push origin main
```

---

### Within 24 Hours

#### Task 4: 24-Hour Monitoring Report

```bash
cat > migration-24hr-report.txt <<EOF
Part 20 Migration - 24-Hour Report
===================================
Migration Date: [DATE]
Report Date: $(date)

Stability Metrics:
------------------
Uptime: [XX.XX%]
Error Rate: [X.XX%]
Avg Response Time: [XXX ms]

Issues Encountered:
-------------------
[List any issues, even minor ones]

Rollbacks: [YES/NO]
If yes, details: [DETAILS]

User Feedback:
--------------
Support Tickets: [COUNT]
Critical Issues: [COUNT]
User Complaints: [COUNT]
Positive Feedback: [COUNT]

Performance Comparison:
-----------------------
                  Part 6    Part 20    Change
Response Time:    XXXms     XXXms      ±XX%
Error Rate:       X.X%      X.X%       ±X.X%
Cache Hit Rate:   XX%       XX%        ±XX%

Sync Script Health:
-------------------
Uptime: [XX.XX%]
Avg Sync Duration: [XX.X seconds]
Errors: [COUNT]

Conclusion:
-----------
Migration Status: [SUCCESS/PARTIAL/FAILED]

Next Steps:
-----------
[List any follow-up actions needed]

Signed: [MIGRATION LEAD NAME]
Date: $(date)
EOF
```

Send this report to team and stakeholders.

---

### Within 1 Week

#### Task 5: Post-Migration Optimization

- [ ] Review slow queries in PostgreSQL
- [ ] Optimize cache TTLs based on actual usage
- [ ] Review sync script performance
- [ ] Check for any memory leaks
- [ ] Validate retention policies are working

---

#### Task 6: Team Retrospective

Hold a team meeting to discuss:
- What went well?
- What could be improved?
- Any unexpected issues?
- Lessons learned for future migrations

Document findings in: `migration-retrospective.md`

---

### After 30 Days

#### Task 7: Delete Flask Archive (Optional)

**Only if:**
- ✅ 30+ days since migration
- ✅ Zero rollback incidents
- ✅ All issues resolved
- ✅ Part 20 fully stable
- ✅ Team approval

```bash
# Final backup before deletion
tar -czf part6-final-archive-$(date +%Y%m%d).tar.gz archive/part6-flask-mt5/

# Move to secure storage
# (Upload to S3, backup drive, etc.)

# Delete from repository
rm -rf archive/part6-flask-mt5/

git commit -m "chore: remove Part 6 archive after 30-day stability period"
```

**Or keep indefinitely** - archive storage is cheap!

---

## Emergency Rollback

### When to Rollback

**Immediate Rollback Triggers:**

- 🔴 Error rate > 5% for 10+ minutes
- 🔴 API completely unresponsive
- 🔴 Data accuracy issues (prices wrong)
- 🔴 Critical security vulnerability
- 🔴 Database corruption

**Consider Rollback:**

- 🟡 Error rate 1-5% sustained for 30+ minutes
- 🟡 Response time > 1 second sustained
- 🟡 Sync script failing repeatedly
- 🟡 Multiple user reports of issues

---

### Rollback Procedure

**You tested this in staging - you know it works!**

#### Step 1: Make Rollback Decision

**Required:** 2-person approval (Migration Lead + DevOps)

```
Rollback Decision Record
========================
Time: $(date)
Decision: ROLLBACK TO PART 6

Reason: [DESCRIBE ISSUE]

Approved By:
1. [MIGRATION LEAD NAME] - [TIME]
2. [DEVOPS NAME] - [TIME]

Estimated Rollback Duration: 15 minutes
========================
```

---

#### Step 2: Notify Team

**Immediate notification:**

```
URGENT: Rolling back Part 20 migration

Reason: [BRIEF REASON]
Expected Duration: 15 minutes
Status Updates: Every 5 minutes

Migration Lead: [NAME]
```

---

#### Step 3: Execute Rollback Script

```bash
# You practiced this in staging!

# Run the rollback script
./scripts/rollback-to-part6.sh

# Follow all prompts
# Accept data gap warnings (expected)
# Confirm manual Railway steps
```

**Target:** Complete in < 15 minutes

---

#### Step 4: Verify Rollback Success

```bash
# Flask service running
docker ps | grep mt5-service

# Flask health
curl http://localhost:5001/api/health | jq '.status'
# Expected: "ok" or "degraded"

# API routes using Flask
curl $PRODUCTION_URL/api/indicators/EURUSD/H1 | jq .
# Should work (even if no MT5 terminals in staging)
```

---

#### Step 5: Post-Rollback Actions

1. **Notify users** - "Issues resolved, service restored"
2. **Document rollback** - What happened, why, duration
3. **Root cause analysis** - Why did Part 20 fail?
4. **Fix issues** - Address root cause
5. **Re-test in staging** - Verify fix works
6. **Schedule re-migration** - Try again after fixes

---

## Communication Templates

### Template 1: 24-Hour Notice

```
Subject: Trading Alerts - System Upgrade Scheduled

Dear Users,

We're excited to announce a major system upgrade scheduled for:

Date: [DAY, DATE]
Time: [TIME] - [TIME] (approximately 2 hours)
Expected Impact: Minimal - service will remain available

What's Changing:
- Improved data accuracy (reading directly from MT5)
- Faster response times (new caching layer)
- Better reliability (redundant data sources)

What You'll Experience:
- Brief service interruption (< 5 minutes)
- Faster chart loading after upgrade
- More accurate indicator data

No Action Required:
Your account, settings, and data are safe. No changes needed on your end.

Questions?
Contact support: support@tradingalerts.com

Thank you for your patience!

Trading Alerts Team
```

---

### Template 2: 15-Minute Warning

```
Subject: System Upgrade Starting in 15 Minutes

Quick reminder: Our system upgrade begins in 15 minutes.

Time: [TIME]
Duration: ~2 hours
Impact: Service remains available

You may see a brief "connecting" message while we switch to the new system.

Thank you!
Trading Alerts Team
```

---

### Template 3: Migration Complete

```
Subject: System Upgrade Complete - Faster & More Accurate!

Great news! Our system upgrade is complete.

What's New:
✓ 40% faster chart loading
✓ 100% accurate indicator values
✓ Improved reliability

Everything should work as before, but better!

Notice anything different or have questions?
Contact us: support@tradingalerts.com

Thank you for your patience!
Trading Alerts Team
```

---

### Template 4: Rollback Notification

```
Subject: Brief Service Issue - Now Resolved

We experienced a brief technical issue during our system upgrade and rolled back to ensure continuous service.

Status: RESOLVED
Duration: [XX] minutes
Impact: Service is now stable

What Happened:
[BRIEF EXPLANATION]

What We're Doing:
- Investigating root cause
- Testing fixes
- Planning re-attempt

Your Data:
100% safe - no data lost

Apologies for any inconvenience.

Trading Alerts Team
```

---

## Success Criteria

### Migration is Successful When:

- ✅ All API endpoints working
- ✅ Health status: "ok" consistently
- ✅ Error rate < 1%
- ✅ Response time < 500ms
- ✅ Data accuracy matches MT5
- ✅ Sync script running stable
- ✅ Frontend working correctly
- ✅ 24 hours without critical issues
- ✅ User feedback positive/neutral
- ✅ Zero rollbacks needed

### Final Sign-Off

```
Part 20 Production Migration - APPROVED
========================================

All success criteria met.

Migration Lead: [NAME]
Date: [DATE]
Time: [TIME]

Signature: ___________________

Migration Status: COMPLETE ✓
========================================
```

---

## Appendix

### Useful Commands Reference

```bash
# Health check
curl $PRODUCTION_URL/api/health | jq .

# Test indicator endpoint
curl "$PRODUCTION_URL/api/indicators/EURUSD/H1" | jq .

# Check PostgreSQL
psql $PRODUCTION_POSTGRESQL_URI -c "SELECT COUNT(*) FROM eurusd_h1;"

# Check Redis
redis-cli -u $PRODUCTION_REDIS_URL PING

# Check sync (Contabo)
ssh user@contabo-vps-ip "cd /opt/trading-alerts/sync && ./sync-status.sh"

# View logs
tail -f /var/log/trading-alerts.log  # Application
ssh user@contabo-vps-ip "tail -f /var/log/trading-sync.log"  # Sync

# Rollback
./scripts/rollback-to-part6.sh
```

---

### Emergency Contacts

| Role | Name | Phone | Slack | Email |
|------|------|-------|-------|-------|
| Technical Lead | [NAME] | [PHONE] | @[username] | [EMAIL] |
| DevOps | [NAME] | [PHONE] | @[username] | [EMAIL] |
| CEO/CTO | [NAME] | [PHONE] | @[username] | [EMAIL] |

**External Support:**
- Railway: https://help.railway.app
- PostgreSQL: [DBA contact]
- Contabo: [Support ticket system]

---

**Document Version:** 1.0
**Last Updated:** 2026-01-07
**Tested in Staging:** YES / NO (must be YES to proceed)
**Team Training Complete:** YES / NO (must be YES to proceed)
**Rollback Tested:** YES / NO (must be YES to proceed)

---

## Final Checklist Before Starting

```
Pre-Migration Final Checklist
==============================

Preparation:
[ ] Staging testing complete
[ ] Rollback tested and < 15 min
[ ] Team trained and available
[ ] Communication templates ready
[ ] Backups complete
[ ] Monitoring dashboard open

Infrastructure:
[ ] PostgreSQL accessible
[ ] Redis accessible
[ ] Sync script ready
[ ] All 15 MT5 terminals running

Code:
[ ] Part 20 merged to main
[ ] All tests passing
[ ] Build succeeds
[ ] Environment variables documented

Team:
[ ] Migration Lead present
[ ] DevOps present
[ ] Support notified
[ ] Users notified (24-hr notice sent)

Timing:
[ ] Low-traffic time selected
[ ] 8-hour window available
[ ] Rollback tested

Decision: GO / NO-GO
Signed: [MIGRATION LEAD]
Date/Time: [TIMESTAMP]
==============================
```

**Only proceed if ALL checkboxes are checked.**

---

**Remember:** You've practiced this in staging. You tested the rollback. You're ready. Stay calm, follow the steps, and trust the process. Good luck! 🚀