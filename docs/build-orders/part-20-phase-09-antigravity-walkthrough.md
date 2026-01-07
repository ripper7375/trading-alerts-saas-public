Part 20 Phase 09 Migration - Walkthrough
Date: 2026-01-07 Status: ✅ Complete

Summary
This migration moved the Trading Alerts SaaS from Part 6 (Flask MT5 Service) to Part 20 (SQLite + Sync + PostgreSQL) architecture. The main changes:

Updated
alert-checker.ts
to query PostgreSQL directly
Updated
system-monitor.ts
to check PostgreSQL/Redis health
Archived Flask code to archive/part6-flask-mt5/
Deleted Flask CI workflow
Created deployment and rollback scripts
Changes Made

1. Alert Checker Migration
   File:
   alert-checker.ts

The fetchCurrentPrice() function was updated from calling Flask API to querying PostgreSQL directly:

-// Fetch from MT5 service
-const mt5ApiUrl = process.env['MT5_API_URL'] || 'http://localhost:5000';
-const response = await fetch(`${mt5ApiUrl}/api/mt5/price?symbol=${symbol}`);
-const data = await response.json();
-return data.price || 0;
+// Part 20: Query latest price from PostgreSQL
+const tableName = `${symbol.toLowerCase()}_m5`;
+const result = await query<{ close: number }>(

- `SELECT close FROM ${tableName}
- ORDER BY timestamp DESC
- LIMIT 1`
  +);
  +return result[0]?.close ?? 0;

2. System Monitor Migration
   File:
   system-monitor.ts

Renamed checkMT5Service() to checkDataService()
Now checks PostgreSQL connection and data freshness
Added real Redis health check via isRedisAvailable()
import { prisma } from '@/lib/db/prisma';
import { query, checkConnection } from '@/lib/db/postgresql';
import { isRedisAvailable } from '@/lib/cache/redis';
import {
getConnectedUsersCount,
isUserConnected,
checks: {
database: HealthCheck;
redis: HealthCheck;
mt5Service: HealthCheck;
dataService: HealthCheck;
websocket: HealthCheck;
};
tierMetrics: {
/\*\*

- Check Redis connectivity
- TODO: Implement actual Redis client check when Redis is integrated
- Part 20: Uses actual Redis client check
  \*/
  async function checkRedis(): Promise<HealthCheck> {
  const start = Date.now();
  try {
  // Placeholder - implement actual Redis check when integrated
  // For now, return healthy status
  const isConnected = await isRedisAvailable();
  return {
  status: 'healthy',
  status: isConnected ? 'healthy' : 'degraded',
  responseTime: Date.now() - start,
  lastChecked: new Date(),
  error: isConnected ? undefined : 'Redis connection not available',
  };
  } catch (error) {
  console.error('Redis health check failed:', error);
  return {
  status: 'down',
  lastChecked: new Date(),
  error: error instanceof Error ? error.message : 'Unknown error',
  };
  }
  }
  /\*\*
- Check MT5 service connectivity
- TODO: Implement actual MT5 service check when integrated
- Check Part 20 Data Service (PostgreSQL indicator data + sync freshness)
- Part 20: Replaces Flask MT5 service check
  \*/
  async function checkMT5Service(): Promise<HealthCheck> {
  async function checkDataService(): Promise<HealthCheck> {
  const start = Date.now();
  try {
  // Placeholder - implement actual MT5 service check when integrated
  // Could ping the Flask MT5 service endpoint
  const mt5ServiceUrl = process.env['MT5_SERVICE_URL'];
  // Check PostgreSQL connection
  const pgConnected = await checkConnection();
  if (!mt5ServiceUrl) {
  if (!pgConnected) {
  return {
  status: 'down',
  responseTime: Date.now() - start,
  lastChecked: new Date(),
  error: 'PostgreSQL connection failed',
  };
  }
  // Check data freshness - query latest timestamp from EURUSD M5
  const syncStatus = await query<{ last_sync: Date }>(
  `SELECT MAX(timestamp) as last_sync FROM eurusd_m5`
  );
  const lastSync = syncStatus[0]?.last_sync;
  if (!lastSync) {
  return {
  status: 'degraded',
  responseTime: Date.now() - start,
  lastChecked: new Date(),
  error: 'MT5_SERVICE_URL not configured',
  error: 'No indicator data found in database',
  };
  }
  // For now, return healthy status
  // Check if data is stale (more than 60 seconds old)
  const lastSyncAge = Date.now() - new Date(lastSync).getTime();
  const isStale = lastSyncAge > 60000; // 60 seconds
  return {
  status: 'healthy',
  status: isStale ? 'degraded' : 'healthy',
  responseTime: Date.now() - start,
  lastChecked: new Date(),
  error: isStale
  ? `Data is ${Math.floor(lastSyncAge / 1000)}s old (threshold: 60s)`
  : undefined,
  };
  } catch (error) {
  console.error('MT5 service health check failed:', error);
  console.error('Data service health check failed:', error);
  return {
  status: 'down',
  lastChecked: new Date(),
  const activeSubscriptions =
  tier === 'PRO'
  ? await prisma.subscription.count({
  where: { status: 'ACTIVE' },
  })
  where: { status: 'ACTIVE' },
  })
  : 0;
  // Placeholder metrics - in production, these would come from
- Performs health checks on all system components:
- - Database (PostgreSQL via Prisma)
- - Redis (for caching/sessions)
- - MT5 Service (Flask trading service)
- - Data Service (Part 20 PostgreSQL + sync freshness)
- - WebSocket (real-time notifications)
-
- Also collects tier-specific metrics for FREE and PRO users.
  \*/
  export async function getSystemHealth(): Promise<SystemHealth> {
  // Run all health checks in parallel
  const [database, redis, mt5Service, websocket] = await Promise.all([
  const [database, redis, dataService, websocket] = await Promise.all([
  checkDatabase(),
  checkRedis(),
  checkMT5Service(),
  checkDataService(),
  checkWebSocket(),
  ]);
  // Get tier metrics in parallel
  const [freeMetrics, proMetrics] = await Promise.all([
  getTierMetrics('FREE'),
  getTierMetrics('PRO'),
  ]);
  // Determine overall system status
  const checks = { database, redis, mt5Service, websocket };
  const checks = { database, redis, dataService, websocket };
  const statuses = Object.values(checks).map((c) => c.status);
  let status: HealthStatus = 'healthy';
  export function checkUserConnection(userId: string): boolean {
  return isUserConnected(userId);
  }

3. Flask Code Archived
   The following files were moved to archive/part6-flask-mt5/:

Original Location Archive Location
mt5-service/ archive/part6-flask-mt5/mt5-service/
lib/api/mt5-client.ts archive/part6-flask-mt5/lib/api/mt5-client.ts
lib/api/mt5-transform.ts archive/part6-flask-mt5/lib/api/mt5-transform.ts
docker-compose.yml archive/part6-flask-mt5/docker-compose.part6.yml
Archive Documentation:
README.md

4. CI/CD Updates
   Deleted:

.github/workflows/ci-flask.yml - Flask CI pipeline no longer needed 5. Environment Variables Updated
File:
.env.example

Replaced Flask variables with Part 20 variables:

-# MT5 SERVICE (Required for Part 6)
-MT5_SERVICE_URL=http://localhost:5001
-MT5_API_URL=...
-MT5_API_KEY=...
+# PART 20 DATA INFRASTRUCTURE (Required)
+POSTGRESQL_URI=postgresql://...
+REDIS_URL=redis://...
+ADMIN_API_KEY=... 6. Deployment Scripts Created
Script Purpose
deploy-part20.sh
Production deployment with verification
rollback-to-part6.sh
Emergency rollback to Flask
Documentation:

rollback-to-part6.md
DEPLOYMENT-CHECKLIST.md
Verification Results
TypeScript Check
✅ No TypeScript errors found
Flask Reference Check
lib/ - No Flask references (MT5_API_URL, MT5_SERVICE_URL, mt5-client) ✅
app/ - No Flask references ✅
Files Updated
File Change Type
lib/jobs/alert-checker.ts Modified - PostgreSQL query
lib/monitoring/system-monitor.ts Modified - PostgreSQL/Redis health
lib/utils/constants.ts Modified - ENV_VARS update
.env.example Modified - Part 20 variables
.github/workflows/ci-flask.yml Deleted
lib/api/mt5-client.ts Deleted (archived)
lib/api/mt5-transform.ts Deleted (archived)
Files Created
File Purpose
archive/part6-flask-mt5/README.md Archive documentation
archive/part6-flask-mt5/.env.part6.backup Environment backup
archive/part6-flask-mt5/LAST_COMMIT.txt Git history reference
archive/part6-flask-mt5/FILE_LIST.txt File inventory
scripts/deploy-part20.sh Deployment script
scripts/rollback-to-part6.sh Rollback script
docs/migration/rollback-to-part6.md Rollback documentation
docs/DEPLOYMENT-CHECKLIST.md Deployment checklist
Next Steps
Run full test suite to verify no regressions
Test in staging with the deployment script
Test rollback in staging before production deployment
Follow deployment checklist for production cutover
Commit
Ready to commit with:

git add -A
git commit -m "feat: migrate from Part 6 (Flask) to Part 20 (SQLite + Sync + PostgreSQL)
BREAKING CHANGE: Flask MT5 service removed
Migration includes:

- Update alert-checker.ts to query PostgreSQL directly
- Update system-monitor.ts to check PostgreSQL/Redis health
- Archive Flask code to archive/part6-flask-mt5/
- Delete ci-flask.yml workflow
- Update .env.example with Part 20 variables
- Create deployment and rollback scripts
- Create deployment checklist and rollback documentation
  Part 6 archived to: archive/part6-flask-mt5/"
