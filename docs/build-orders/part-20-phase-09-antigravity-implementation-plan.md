Part 20 - Phase 09: Migration, Integration & Cutover
Goal Description
Migrate from Part 6 (Flask MT5 Service) to Part 20 (SQLite + Sync + PostgreSQL) architecture. This involves updating remaining code that still references Flask, archiving Part 6 code, updating CI/CD pipelines, and creating deployment/rollback scripts.

Current State Analysis
After examining the codebase, the following state was identified:

Component Current State Action Needed
/api/indicators/[symbol]/[timeframe] ✅ Uses Part 20 (PostgreSQL + Redis) None
/api/indicators/health ✅ Uses Part 20 None
/api/symbols ✅ Uses Part 20 (tier validation) None
/api/timeframes ✅ Uses Part 20 (tier validation) None
lib/jobs/alert-checker.ts
❌ Uses Flask (MT5_API_URL) Update to PostgreSQL
lib/monitoring/system-monitor.ts
❌ Uses Flask (MT5_SERVICE_URL) Update to PostgreSQL/Redis
lib/api/mt5-client.ts
❌ Flask client (unused) Archive
lib/api/mt5-transform.ts
❌ Flask transform (unused) Archive
mt5-service/ ❌ Flask service Archive
.github/workflows/ci-flask.yml
❌ Flask CI pipeline Delete
.env.example
❌ Contains Flask variables Update
Proposed Changes
Component 1: Alert Checker Migration
Update the alert checker to query PostgreSQL directly instead of Flask.

[MODIFY]
alert-checker.ts
Before (Lines 95-114):

const mt5ApiUrl = process.env['MT5_API_URL'] || 'http://localhost:5000';
const response = await fetch(`${mt5ApiUrl}/api/mt5/price?symbol=${symbol}`);
const data = await response.json();
return data.price || 0;
After:

import { query } from '@/lib/db/postgresql';
// Query latest price from PostgreSQL
const tableName = `${symbol.toLowerCase()}_h1`;
const result = await query(
`SELECT close FROM ${tableName}
   ORDER BY timestamp DESC
   LIMIT 1`
);
if (!result || result.length === 0) {
console.error(`[AlertChecker] No data found for symbol ${symbol}`);
return 0;
}
return result[0].close;
Component 2: System Monitor Migration
Update system monitor to check PostgreSQL and Redis health instead of Flask.

[MODIFY]
system-monitor.ts
Changes to
checkMT5Service()
function (Lines 97-127):

Rename to checkDataService()
Check PostgreSQL connection and data freshness
Check Redis cache health
Return combined health status
Component 3: Archive Flask Client Files
[DELETE]
mt5-client.ts
Will be moved to archive/part6-flask-mt5/lib/api/ for rollback capability.

[DELETE]
mt5-transform.ts
Will be moved to archive/part6-flask-mt5/lib/api/ for rollback capability.

Component 4: Archive Flask MT5 Service
[DELETE] mt5-service/ directory
Will be moved to archive/part6-flask-mt5/mt5-service/ with git history bundle.

Component 5: CI/CD Pipeline Updates
[DELETE]
ci-flask.yml
Flask CI pipeline is no longer needed.

[MODIFY]
dependencies-security.yml
Remove Flask security scan sections.

[MODIFY]
deploy.yml
Remove Flask deployment steps, add Part 20 infrastructure verification.

Component 6: Environment Variables
[MODIFY]
.env.example
Remove these Part 6 variables:

MT5_SERVICE_URL
MT5_API_URL (if present elsewhere)
MT5_API_KEY
MT5_ADMIN_API_KEY (if present)
FLASK_PORT
Add/Verify these Part 20 variables:

POSTGRESQL_URI (or verify DATABASE_URL is used)
REDIS_URL
SYNC_INTERVAL=30
ADMIN_API_KEY
Component 7: Deployment Scripts
[NEW]
deploy-part20.sh
Pre-deployment checks, maintenance mode, deploy, verify, smoke tests.

[NEW]
rollback-to-part6.sh
Restore Flask code, revert API routes, restart Flask service.

[NEW]
rollback-to-part6.md
Detailed rollback instructions and procedures.

[NEW]
DEPLOYMENT-CHECKLIST.md
Pre-deployment and post-deployment checklist.

Component 8: Archive Structure
[NEW] archive/part6-flask-mt5/ directory structure
archive/
└── part6-flask-mt5/
├── README.md # Archive documentation
├── LAST_COMMIT.txt # Last working commit
├── FILE_LIST.txt # Complete file inventory
├── part6-history.bundle # Git history bundle
├── .env.part6.backup # Environment variables backup
├── docker-compose.part6.yml # Docker config backup
├── mt5-service/ # Complete Flask service
└── lib/api/ # Flask client files
├── mt5-client.ts
└── mt5-transform.ts
Verification Plan
Automated Tests
Run existing unit tests:

pnpm test
Run API route tests:

pnpm test -- --testPathPattern="api/indicators"
Verify no Flask imports remain:

grep -r "MT5*API_URL\|MT5_SERVICE_URL\|mt5-client" lib/ app/ --include="*.ts" --include="\_.tsx"
Manual Verification
Test health endpoint: GET /api/indicators/health
Test indicator data: GET /api/indicators/EURUSD/H1
Test alert checker job can query prices
Verify CI pipeline runs without Flask job
Risk Considerations
IMPORTANT

The rollback script and archive structure must be in place before any production cutover.

WARNING

After migration, there will be no Flask service. If Part 20 fails, manual intervention is required to restore Flask from archive.

Execution Order
Part A: Code Updates (Safe - backward compatible)

A1: Backup environment variables
A2: Update alert-checker.ts
A8: Update system-monitor.ts
Part A: Archiving (Safe - creates backups)

A3: Archive mt5-client.ts and mt5-transform.ts
A5: Backup docker-compose.yml
A6: Archive mt5-service/
Part A: CI/CD Updates (Safe - improves pipeline)

A9: Delete ci-flask.yml, update other workflows
Part A: Environment Cleanup

A1: Update .env.example
Part B: Deployment Scripts

Create all deployment and rollback scripts
Part C: Verification

Run all tests
Verify no regressions
