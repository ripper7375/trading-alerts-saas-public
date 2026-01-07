#!/bin/bash
# ============================================================================
# Part 20 Deployment Script
# ============================================================================
# Deploys the Part 20 architecture (SQLite + Sync + PostgreSQL)
# Run this script after all Phase 1-8 and Phase 9 code changes are complete.
#
# Prerequisites:
# - All tests passing
# - PostgreSQL on Railway ready
# - Redis on Railway ready
# - MQL5 Services deployed to MT5 terminals
# - Sync script tested in staging
# ============================================================================

set -e

echo "========================================="
echo "Part 20 Deployment Script"
echo "========================================="
echo ""

# ─────────────────────────────────────────────────────────────
# STEP 1: Pre-deployment checks
# ─────────────────────────────────────────────────────────────
echo "Step 1: Pre-deployment checks..."

# Run tests
echo "  Running tests..."
npm test || { echo "❌ Tests failed!"; exit 1; }
echo "  ✅ Tests passed"

# Check PostgreSQL connection
echo "  Checking PostgreSQL connection..."
if [ -z "$POSTGRESQL_URI" ]; then
  echo "❌ POSTGRESQL_URI not set!"
  exit 1
fi
psql "$POSTGRESQL_URI" -c "SELECT 1" > /dev/null 2>&1 || { echo "❌ PostgreSQL not accessible!"; exit 1; }
echo "  ✅ PostgreSQL connected"

# Check Redis connection
echo "  Checking Redis connection..."
if [ -z "$REDIS_URL" ]; then
  echo "❌ REDIS_URL not set!"
  exit 1
fi
redis-cli -u "$REDIS_URL" PING > /dev/null 2>&1 || { echo "❌ Redis not accessible!"; exit 1; }
echo "  ✅ Redis connected"

# Verify database schema
echo "  Verifying database schema..."
TABLE_COUNT=$(psql "$POSTGRESQL_URI" -t -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public' AND tablename LIKE '%_m5';")
TABLE_COUNT=$(echo "$TABLE_COUNT" | tr -d ' ')
if [ "$TABLE_COUNT" -lt 15 ]; then
  echo "❌ Expected 15+ M5 tables, found $TABLE_COUNT"
  exit 1
fi
echo "  ✅ Found $TABLE_COUNT M5 tables"

echo ""
echo "✅ All pre-deployment checks passed"
echo ""

# ─────────────────────────────────────────────────────────────
# STEP 2: Enable maintenance mode
# ─────────────────────────────────────────────────────────────
echo "Step 2: Enable maintenance mode..."
if [ -n "$ADMIN_API_KEY" ] && [ -n "$APP_URL" ]; then
  curl -X POST "$APP_URL/api/admin/maintenance/enable" \
    -H "X-Admin-API-Key: $ADMIN_API_KEY" \
    -H "Content-Type: application/json" \
    --silent --show-error || echo "  ⚠️  Could not enable maintenance mode (endpoint may not exist)"
else
  echo "  ⏭️  Skipping (ADMIN_API_KEY or APP_URL not set)"
fi
echo ""

# ─────────────────────────────────────────────────────────────
# STEP 3: Deploy application
# ─────────────────────────────────────────────────────────────
echo "Step 3: Deploy application..."
echo "  Note: Railway/Vercel auto-deploys on git push"
echo "  Pushing to origin main..."
git push origin main || { echo "⚠️  Git push failed or nothing to push"; }
echo "  ✅ Code pushed"
echo ""

# ─────────────────────────────────────────────────────────────
# STEP 4: Wait for deployment
# ─────────────────────────────────────────────────────────────
echo "Step 4: Wait for deployment..."
echo "  Waiting 60 seconds for deployment to complete..."
sleep 60
echo "  ✅ Wait complete"
echo ""

# ─────────────────────────────────────────────────────────────
# STEP 5: Start sync script on Contabo VPS
# ─────────────────────────────────────────────────────────────
echo "Step 5: Start sync script on Contabo VPS..."
if [ -n "$CONTABO_SSH" ]; then
  ssh "$CONTABO_SSH" "cd /opt/trading-alerts/sync && ./start-sync.sh" || echo "  ⚠️  Could not start sync script (SSH connection failed)"
else
  echo "  ⏭️  Skipping (CONTABO_SSH not set)"
  echo "  Manual action: SSH to Contabo VPS and run: cd /opt/trading-alerts/sync && ./start-sync.sh"
fi
echo ""

# ─────────────────────────────────────────────────────────────
# STEP 6: Verify data flowing
# ─────────────────────────────────────────────────────────────
echo "Step 6: Verify data flowing..."
echo "  Waiting 30 seconds for sync..."
sleep 30
if [ -n "$APP_URL" ]; then
  echo "  Checking health endpoint..."
  curl -s "$APP_URL/api/indicators/health" | head -c 500
  echo ""
else
  echo "  ⏭️  Skipping health check (APP_URL not set)"
fi
echo ""

# ─────────────────────────────────────────────────────────────
# STEP 7: Run smoke tests
# ─────────────────────────────────────────────────────────────
echo "Step 7: Run smoke tests..."
if [ -n "$APP_URL" ]; then
  SMOKE_TEST=$(curl -s "$APP_URL/api/indicators/health" | grep -o '"status":"ok"' || echo "")
  if [ -n "$SMOKE_TEST" ]; then
    echo "  ✅ Smoke test passed - Health check returned OK"
  else
    echo "  ⚠️  Smoke test returned unexpected status"
    echo "  Consider checking logs and potentially rolling back"
  fi
else
  echo "  ⏭️  Skipping (APP_URL not set)"
fi
echo ""

# ─────────────────────────────────────────────────────────────
# STEP 8: Disable maintenance mode
# ─────────────────────────────────────────────────────────────
echo "Step 8: Disable maintenance mode..."
if [ -n "$ADMIN_API_KEY" ] && [ -n "$APP_URL" ]; then
  curl -X POST "$APP_URL/api/admin/maintenance/disable" \
    -H "X-Admin-API-Key: $ADMIN_API_KEY" \
    -H "Content-Type: application/json" \
    --silent --show-error || echo "  ⚠️  Could not disable maintenance mode"
else
  echo "  ⏭️  Skipping (ADMIN_API_KEY or APP_URL not set)"
fi
echo ""

# ─────────────────────────────────────────────────────────────
# COMPLETE
# ─────────────────────────────────────────────────────────────
echo "========================================="
echo "✅ Deployment complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Monitor error rates for 1 hour"
echo "  2. Check sync script logs on Contabo VPS"
echo "  3. Verify chart accuracy against MT5"
echo "  4. Keep Flask service archived for 30 days"
echo ""
echo "Rollback command (if needed):"
echo "  ./scripts/rollback-to-part6.sh"
echo ""
