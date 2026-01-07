# Part 20 Deployment Checklist

This checklist covers all steps for deploying Part 20 (SQLite + Sync + PostgreSQL) architecture.

## Pre-Deployment (Day Before)

### Infrastructure

- [ ] PostgreSQL on Railway with TimescaleDB extension
- [ ] Redis on Railway
- [ ] All 135 tables created (15 symbols × 9 timeframes)
- [ ] Indexes created on timestamp columns
- [ ] Retention policies configured

### MT5 Setup (Contabo VPS)

- [ ] All 15 MT5 terminals running
- [ ] MQL5 DataCollector service installed on each terminal
- [ ] SQLite database created at configured path
- [ ] SQLite receiving data (verify with DB browser)
- [ ] Sync script tested (SQLite → PostgreSQL)
- [ ] Sync script configured as Windows service or cron job

### Code Changes

- [ ] Phase 0 analysis completed (`docs/migration/part6-to-part20-analysis.md`)
- [ ] Phases 1-8 code merged to main
- [ ] Phase 9 migration code completed:
  - [ ] `lib/jobs/alert-checker.ts` updated to use PostgreSQL
  - [ ] `lib/monitoring/system-monitor.ts` updated to use PostgreSQL/Redis
  - [ ] Flask client files archived
- [ ] All tests passing in CI
- [ ] Build succeeds

### Critical: Rollback Testing ⚠️

- [ ] Rollback script tested in staging
- [ ] Rollback completes in < 15 minutes
- [ ] Flask service starts successfully after rollback
- [ ] API routes work with Flask after rollback
- [ ] Data gap documented and acceptable
- [ ] Team trained on rollback procedure

---

## Deployment Day

### Pre-Cutover Checklist

- [ ] Notify users of maintenance window (if needed)
- [ ] Backup current production database
- [ ] Verify rollback script works in staging
- [ ] Confirm team availability for monitoring
- [ ] Have rollback procedure document ready

### Cutover Steps

1. **Enable Maintenance Mode**
   - [ ] Call maintenance enable endpoint
   - [ ] Verify maintenance page shows

2. **Deploy New Code**
   - [ ] Push to main branch
   - [ ] Verify Railway/Vercel deployment started
   - [ ] Wait for deployment to complete

3. **Start Sync Script**
   - [ ] SSH to Contabo VPS
   - [ ] Start sync script
   - [ ] Verify sync is running (check logs)

4. **Verify PostgreSQL Data**
   - [ ] Query EURUSD_M5 table
   - [ ] Confirm fresh data is arriving
   - [ ] Check data freshness < 60 seconds

5. **Verify Redis Cache**
   - [ ] Check Redis connection
   - [ ] Confirm cache is being populated

6. **Verify API Endpoints**
   - [ ] `GET /api/indicators/health` returns OK
   - [ ] `GET /api/indicators/EURUSD/H1` returns data
   - [ ] `GET /api/symbols` returns symbol list
   - [ ] `GET /api/timeframes` returns timeframe list

7. **Run Smoke Tests**
   - [ ] Basic indicator request works
   - [ ] Tier restrictions work (FREE vs PRO)
   - [ ] Cache headers present (X-Cache: HIT/MISS)

8. **Disable Maintenance Mode**
   - [ ] Call maintenance disable endpoint
   - [ ] Verify app is accessible

---

## Post-Cutover (Monitor 1 hour)

### Health Metrics

- [ ] Error rate < 1%
- [ ] API response time < 500ms (uncached)
- [ ] API response time < 200ms (cached)
- [ ] No database connection errors
- [ ] Sync running every 30 seconds

### Performance Metrics

- [ ] Redis cache hit rate > 80%
- [ ] PostgreSQL query latency < 50ms
- [ ] No memory leaks detected

### Accuracy Verification

- [ ] Open MT5 terminal with EURUSD H1 chart
- [ ] Open web app with same chart
- [ ] Compare OHLC values match
- [ ] Compare indicator values match
- [ ] Fractals display correctly
- [ ] Trendlines display correctly

---

## Post-Cutover (24 hours)

- [ ] No critical errors in logs
- [ ] User feedback positive (or no complaints)
- [ ] Sync script running continuously
- [ ] Data retention policies executing
- [ ] Part 6 code remains in archive (don't delete yet)

---

## Cleanup (After 30 days stable)

- [ ] Review if Flask archive is still needed
- [ ] Consider removing `archive/part6-flask-mt5/` (optional)
- [ ] Remove Part 6 references from documentation
- [ ] Close migration tracking issues
- [ ] Update architecture diagrams

---

## Emergency Contacts

| Role             | Contact       |
| ---------------- | ------------- |
| On-call Engineer | [Add contact] |
| Database Admin   | [Add contact] |
| VPS Admin        | [Add contact] |

## Rollback Trigger Criteria

Execute rollback if ANY of these occur:

| Condition             | Threshold      | Action                         |
| --------------------- | -------------- | ------------------------------ |
| Error rate            | > 5% for 10min | Rollback                       |
| API response time     | > 2s for 5min  | Rollback                       |
| Data sync failure     | > 5min         | Rollback                       |
| Chart accuracy issues | Any reported   | Investigate, consider rollback |

## Rollback Command

```bash
./scripts/rollback-to-part6.sh
```

See `docs/migration/rollback-to-part6.md` for detailed instructions.
