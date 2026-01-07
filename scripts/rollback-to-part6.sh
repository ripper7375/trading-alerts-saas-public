#!/bin/bash
# ============================================================================
# ROLLBACK: Part 20 → Part 6
# ============================================================================
# Emergency rollback script to restore Flask MT5 service.
# Only use if Part 20 has critical issues that cannot be fixed quickly.
#
# Prerequisites:
# - Part 6 code exists in archive/part6-flask-mt5/
# - MT5 terminals still running with indicators
# - Flask dependencies still available
# ============================================================================

set -e

echo "========================================="
echo "ROLLBACK: Part 20 → Part 6"
echo "========================================="
echo ""
echo "⚠️  WARNING: This will restore Flask MT5 service"
echo ""

read -p "Are you sure you want to rollback? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Rollback cancelled."
    exit 0
fi

echo ""

# ─────────────────────────────────────────────────────────────
# STEP 1: Enable maintenance mode
# ─────────────────────────────────────────────────────────────
echo "Step 1: Enable maintenance mode..."
if [ -n "$ADMIN_API_KEY" ] && [ -n "$APP_URL" ]; then
  curl -X POST "$APP_URL/api/admin/maintenance/enable" \
    -H "X-Admin-API-Key: $ADMIN_API_KEY" \
    -H "Content-Type: application/json" \
    --silent --show-error || echo "  ⚠️  Could not enable maintenance mode"
else
  echo "  ⏭️  Skipping (ADMIN_API_KEY or APP_URL not set)"
fi
echo ""

# ─────────────────────────────────────────────────────────────
# STEP 2: Stop sync script
# ─────────────────────────────────────────────────────────────
echo "Step 2: Stop sync script..."
if [ -n "$CONTABO_SSH" ]; then
  ssh "$CONTABO_SSH" "cd /opt/trading-alerts/sync && ./stop-sync.sh" || echo "  ⚠️  Could not stop sync script"
else
  echo "  ⏭️  Skipping (CONTABO_SSH not set)"
  echo "  Manual action: SSH to Contabo and stop the sync script"
fi
echo ""

# ─────────────────────────────────────────────────────────────
# STEP 2.5: Check data consistency
# ─────────────────────────────────────────────────────────────
echo "Step 2.5: Check data consistency..."
if [ -n "$POSTGRESQL_URI" ]; then
  PG_LAST_SYNC=$(psql "$POSTGRESQL_URI" -t -c "SELECT EXTRACT(EPOCH FROM MAX(timestamp))::INTEGER FROM eurusd_m5" 2>/dev/null || echo "0")
  PG_LAST_SYNC=$(echo "$PG_LAST_SYNC" | tr -d ' ')
  
  if [ "$PG_LAST_SYNC" != "0" ] && [ -n "$PG_LAST_SYNC" ]; then
    CURRENT_TIME=$(date +%s)
    GAP_SECONDS=$((CURRENT_TIME - PG_LAST_SYNC))
    GAP_MINUTES=$((GAP_SECONDS / 60))
    
    echo "  Last PostgreSQL sync: $GAP_SECONDS seconds ago ($GAP_MINUTES minutes)"
    
    if [ "$GAP_MINUTES" -gt 60 ]; then
      echo "  🔴 WARNING: Data gap > 1 hour!"
      echo "  Users will see stale data after rollback."
      read -p "  Continue anyway? (y/n) " -n 1 -r
      echo
      if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Rollback cancelled."
        exit 0
      fi
    fi
  else
    echo "  ⚠️  Could not determine data freshness"
  fi
else
  echo "  ⏭️  Skipping (POSTGRESQL_URI not set)"
fi
echo ""

# ─────────────────────────────────────────────────────────────
# STEP 3: Restore Part 6 code from archive
# ─────────────────────────────────────────────────────────────
echo "Step 3: Restore Part 6 code from archive..."

if [ -d "archive/part6-flask-mt5/mt5-service" ]; then
  cp -r archive/part6-flask-mt5/mt5-service ./
  echo "  ✅ mt5-service/ restored"
else
  echo "  ❌ archive/part6-flask-mt5/mt5-service not found!"
  exit 1
fi
echo ""

# ─────────────────────────────────────────────────────────────
# STEP 3.5: Revert API routes to use Flask
# ─────────────────────────────────────────────────────────────
echo "Step 3.5: Revert API routes to use Flask..."

# Check if these files exist in git history
git show HEAD:lib/jobs/alert-checker.ts > /dev/null 2>&1 && {
  git checkout HEAD -- lib/jobs/alert-checker.ts 2>/dev/null || echo "  ⚠️  Could not restore alert-checker.ts from git"
}

git show HEAD:lib/monitoring/system-monitor.ts > /dev/null 2>&1 && {
  git checkout HEAD -- lib/monitoring/system-monitor.ts 2>/dev/null || echo "  ⚠️  Could not restore system-monitor.ts from git"
}

# Restore Flask client files if archived
if [ -f "archive/part6-flask-mt5/lib/api/mt5-client.ts" ]; then
  mkdir -p lib/api
  cp archive/part6-flask-mt5/lib/api/mt5-client.ts lib/api/
  cp archive/part6-flask-mt5/lib/api/mt5-transform.ts lib/api/
  echo "  ✅ Flask client files restored"
else
  echo "  ⚠️  Could not find Flask client files in archive"
fi
echo ""

# ─────────────────────────────────────────────────────────────
# STEP 4: Restore environment variables
# ─────────────────────────────────────────────────────────────
echo "Step 4: Restore environment variables..."
if [ -f "archive/part6-flask-mt5/.env.part6.backup" ]; then
  echo "  Environment variables to add to .env:"
  echo ""
  cat archive/part6-flask-mt5/.env.part6.backup
  echo ""
  echo "  ⚠️  MANUAL STEP REQUIRED:"
  echo "  Add the above variables to your .env and production environment"
  read -p "  Press Enter after adding variables..."
else
  echo "  ⚠️  No .env.part6.backup found"
fi
echo ""

# ─────────────────────────────────────────────────────────────
# STEP 5: Restore Docker configuration
# ─────────────────────────────────────────────────────────────
echo "Step 5: Restore Docker configuration..."
if [ -f "archive/part6-flask-mt5/docker-compose.part6.yml" ]; then
  cp archive/part6-flask-mt5/docker-compose.part6.yml docker-compose.yml
  echo "  ✅ docker-compose.yml restored"
else
  echo "  ⚠️  No docker-compose.part6.yml found"
fi
echo ""

# ─────────────────────────────────────────────────────────────
# STEP 6: Start Flask service
# ─────────────────────────────────────────────────────────────
echo "Step 6: Start Flask service..."
docker-compose up -d mt5-service 2>/dev/null || echo "  ⚠️  Could not start Flask service via docker-compose"

echo "  Waiting for Flask service to start..."
sleep 10
echo ""

# ─────────────────────────────────────────────────────────────
# STEP 7: Verify Flask responding
# ─────────────────────────────────────────────────────────────
echo "Step 7: Verify Flask responding..."
for i in {1..5}; do
  FLASK_STATUS=$(curl -s http://localhost:5001/api/health 2>/dev/null | grep -o '"status":"ok"' || echo "")
  if [ -n "$FLASK_STATUS" ]; then
    echo "  ✅ Flask service is healthy"
    break
  fi
  echo "  Attempt $i/5: Flask not ready yet, waiting..."
  sleep 5
done
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
echo "✅ Rollback complete. Part 6 is active."
echo "========================================="
echo ""
echo "Post-Rollback Checklist:"
echo "  1. Monitor error rates"
echo "  2. Check MT5 terminal connections"
echo "  3. Verify chart data accuracy"
echo "  4. Investigate Part 20 issues"
echo "  5. Plan re-migration after fixes"
echo ""
echo "Documentation:"
echo "  See docs/migration/rollback-to-part6.md for more details"
echo ""
