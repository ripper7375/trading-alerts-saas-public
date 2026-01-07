# Rollback to Part 6 (Emergency Only)

> ⚠️ **EMERGENCY PROCEDURE**: Only use this guide if Part 20 has critical issues that cannot be fixed quickly.

## When to Use This Rollback

This rollback should be executed if any of the following occur:

- **Error rate > 5%** for 10+ minutes
- **Data sync failing** for 5+ minutes
- **Chart accuracy issues** affecting trading decisions
- **Database connection failures** not resolving within SLA

## Prerequisites

Before rollback, verify:

- [ ] Part 6 code exists in `archive/part6-flask-mt5/`
- [ ] MT5 terminals still running with indicators
- [ ] Flask dependencies (Python, pip packages) still available
- [ ] Docker/docker-compose available on the server

## Quick Rollback (Automated)

Run the rollback script:

```bash
./scripts/rollback-to-part6.sh
```

The script will:

1. Enable maintenance mode
2. Stop the Part 20 sync script
3. Check data consistency
4. Restore Flask service code
5. Restore API routes
6. Restore Docker configuration
7. Start Flask service
8. Verify Flask health
9. Disable maintenance mode

## Manual Rollback Steps

If the automated script fails, follow these steps manually:

### Step 1: Enable Maintenance Mode

```bash
curl -X POST https://your-app.com/api/admin/maintenance/enable \
  -H "X-Admin-API-Key: $ADMIN_API_KEY" \
  -H "Content-Type: application/json"
```

### Step 2: Stop Sync Script

SSH to Contabo VPS and stop the sync:

```bash
ssh contabo "cd /opt/trading-alerts/sync && ./stop-sync.sh"
```

### Step 3: Check Data Freshness

```bash
# Check when PostgreSQL was last updated
psql $POSTGRESQL_URI -c "SELECT MAX(timestamp) FROM eurusd_m5"
```

Note the gap - users may see stale data after rollback.

### Step 4: Restore Part 6 Code

```bash
# Restore Flask service
cp -r archive/part6-flask-mt5/mt5-service ./

# Restore Flask client files
mkdir -p lib/api
cp archive/part6-flask-mt5/lib/api/mt5-client.ts lib/api/
cp archive/part6-flask-mt5/lib/api/mt5-transform.ts lib/api/

echo "✅ Part 6 code restored"
```

### Step 5: Revert Modified Files

```bash
# Revert alert-checker to Flask version
git checkout HEAD -- lib/jobs/alert-checker.ts

# Revert system-monitor to Flask version
git checkout HEAD -- lib/monitoring/system-monitor.ts
```

### Step 6: Restore Environment Variables

Add these variables back to your `.env` and production environment:

```bash
# From archive/part6-flask-mt5/.env.part6.backup
MT5_SERVICE_URL=http://localhost:5001
MT5_API_URL=http://localhost:5000
MT5_API_KEY=your-api-key-here
```

**For Railway Production:**

1. Go to Railway dashboard
2. Navigate to your project settings
3. Add the environment variables above

### Step 7: Restore Docker Configuration

```bash
cp archive/part6-flask-mt5/docker-compose.part6.yml docker-compose.yml
```

### Step 8: Start Flask Service

```bash
docker-compose up -d mt5-service

# Wait for startup
sleep 10

# Verify health
curl http://localhost:5001/api/health
```

### Step 9: Disable Maintenance Mode

```bash
curl -X POST https://your-app.com/api/admin/maintenance/disable \
  -H "X-Admin-API-Key: $ADMIN_API_KEY" \
  -H "Content-Type: application/json"
```

## Post-Rollback Monitoring

After completing the rollback:

1. **Monitor for 2 hours** - Watch error rates, response times
2. **Check MT5 connections** - Verify all 15 terminals are connected
3. **Verify chart accuracy** - Compare charts with MT5 terminal
4. **Review alerts** - Check that price alerts are functioning

## Data Freshness Considerations

After rollback, there will be a data gap:

- **PostgreSQL** has data up to rollback time
- **Flask** has data from whenever it was last running
- **Gap** = time Part 20 was active

Recommendations:

- Display "Data refreshing" banner to users
- Temporarily disable price alerts
- Monitor Flask sync progress
- Document gap duration for analysis

## Post-Incident Actions

After stabilizing:

1. **Document the issue** - What caused the need for rollback?
2. **Create fix plan** - How will the Part 20 issue be resolved?
3. **Test in staging** - Verify fix works before re-deploying
4. **Schedule re-migration** - Plan new migration window

## Related Documentation

- Part 20 Architecture: `docs/sqlite-and-mt5service/part-20-architecture-design.md`
- Part 6 Archive: `archive/part6-flask-mt5/README.md`
- Deployment Script: `scripts/deploy-part20.sh`
- Rollback Script: `scripts/rollback-to-part6.sh`
