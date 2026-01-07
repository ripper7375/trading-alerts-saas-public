# Part 6 - Flask MT5 Service (ARCHIVED)

**Status:** Archived on 2026-01-07
**Replaced by:** Part 20 (SQLite + Sync to PostgreSQL)

> ⚠️ **ARCHIVED CODE**: This code is kept for rollback capability only. Do not use in production.

## Why Archived

The Python MT5 API cannot access custom indicator buffers (`iCustom()` function is not available in the Python API). Part 20 uses MQL5 Services to read indicators directly from MT5 terminals, then syncs to PostgreSQL.

## What's Included

- `mt5-service/` - Complete Flask MT5 service application
- `lib/api/mt5-client.ts` - TypeScript client for Flask service
- `lib/api/mt5-transform.ts` - Data transformation utilities
- `.env.part6.backup` - Part 6 environment variables
- `docker-compose.part6.yml` - Docker configuration with Flask service
- `LAST_COMMIT.txt` - Last verified working commit
- `FILE_LIST.txt` - Complete file inventory

## Rollback Instructions

If you need to restore Part 6 (emergency only):

### Quick Rollback

```bash
# Run the rollback script
./scripts/rollback-to-part6.sh
```

### Manual Rollback Steps

1. **Enable maintenance mode**

   ```bash
   curl -X POST https://your-app.com/api/admin/maintenance/enable \
     -H "X-Admin-API-Key: $ADMIN_API_KEY"
   ```

2. **Stop Part 20 sync script** (on Contabo VPS)

   ```bash
   ssh contabo "cd /opt/trading-alerts/sync && ./stop-sync.sh"
   ```

3. **Restore Flask service code**

   ```bash
   cp -r archive/part6-flask-mt5/mt5-service ./
   ```

4. **Restore Docker configuration**

   ```bash
   cp archive/part6-flask-mt5/docker-compose.part6.yml docker-compose.yml
   ```

5. **Restore environment variables**

   ```bash
   cat archive/part6-flask-mt5/.env.part6.backup >> .env
   ```

6. **Revert API routes** (if needed)

   ```bash
   git restore lib/jobs/alert-checker.ts
   git restore lib/monitoring/system-monitor.ts
   git restore lib/api/mt5-client.ts
   git restore lib/api/mt5-transform.ts
   ```

7. **Start Flask service**

   ```bash
   docker-compose up -d mt5-service
   ```

8. **Verify Flask health**

   ```bash
   curl http://localhost:5001/api/health
   ```

9. **Disable maintenance mode**
   ```bash
   curl -X POST https://your-app.com/api/admin/maintenance/disable \
     -H "X-Admin-API-Key: $ADMIN_API_KEY"
   ```

## Post-Rollback Monitoring

After rolling back:

- Monitor error rates for 2 hours
- Check MT5 terminal connections
- Verify chart data accuracy
- Investigate Part 20 issues
- Create fix plan before re-attempting migration

## Data Freshness After Rollback

There will be a data gap between when Part 20 was stopped and Flask starts syncing again. Be aware that:

- Users may see stale data initially
- Alerts may have been missed during the gap
- Consider displaying a "Data refreshing" banner

## Contact

For questions about this archive or rollback procedures, see:

- `docs/migration/rollback-to-part6.md`
- Part 20 architecture: `docs/sqlite-and-mt5service/part-20-architecture-design.md`
