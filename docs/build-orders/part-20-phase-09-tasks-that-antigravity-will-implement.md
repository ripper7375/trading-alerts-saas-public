Part 20 Phase 09 - Migration, Integration & Cutover
Overview
Migration from Part 6 (Flask MT5 Service) to Part 20 (SQLite + Sync + PostgreSQL) architecture.

Part A: Code Migration
A1. Environment Variables
Analyze current
.env.example
state
Create backup of Part 6 variables to archive/part6-flask-mt5/.env.part6.backup
Update
.env.example
to remove Flask variables and add/verify Part 20 variables
A2. Next.js API Routes (Analysis Complete)
/api/indicators/[symbol]/[timeframe] - Already uses Part 20 (PostgreSQL + Redis caching)
/api/indicators/health - Already uses Part 20 (PostgreSQL health check)
/api/symbols - Already uses Part 20 (tier validation)
/api/timeframes - Already uses Part 20 (tier validation)

lib/jobs/alert-checker.ts

- NEEDS UPDATE (still uses Flask MT5_API_URL)
  A3. Update/Remove Service Layer
  Verify no imports from
  lib/api/mt5-client.ts
  exist in active code
  Create archive directory structure
  Move
  lib/api/mt5-client.ts
  to archive
  Move
  lib/api/mt5-transform.ts
  to archive
  A4. Update Test Mocks
  Identify tests that mock Flask services
  Update mocks to use Part 20 services where needed
  A5. Update Docker Configuration
  Backup
  docker-compose.yml
  to archive
  Remove Flask/MT5 service block from
  docker-compose.yml
  A6. Archive Part 6 Code
  Create archive directory: archive/part6-flask-mt5/
  Record last working commit for mt5-service/
  Create git bundle for history preservation
  Move mt5-service/ to archive
  Create archive README.md with rollback instructions
  A7. Update Documentation
  Add deprecation notice to Part 6 documentation
  Update README.md if it references Part 6 architecture
  A8. Update System Monitoring (CRITICAL)
  Update
  lib/monitoring/system-monitor.ts
  to use PostgreSQL/Redis instead of Flask
  A9. Update CI/CD Pipelines (CRITICAL)
  Delete
  .github/workflows/ci-flask.yml
  Update
  .github/workflows/dependencies-security.yml
  (remove Flask scans)
  Update
  .github/workflows/deploy.yml
  (remove Flask steps, add Part 20 verification)
  Update
  .github/workflows/tests.yml
  (use PostgreSQL/Redis services)
  Part B: Deployment Scripts
  Create scripts/deploy-part20.sh
  Create scripts/rollback-to-part6.sh
  Create docs/migration/rollback-to-part6.md
  Create docs/DEPLOYMENT-CHECKLIST.md
  Part C: Verification
  Test that all API routes work correctly
  Verify no Flask references remain in active code
  Run all tests to ensure no regressions
  Summary
  Component Status
  API Routes ✅ Already migrated
  Alert Checker ⏳ Needs update
  System Monitor ⏳ Needs update
  Flask CI ⏳ Needs deletion
  MT5 Service Archive ⏳ Needs archiving
  Deployment Scripts ⏳ Needs creation
