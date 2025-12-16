#!/bin/bash

# ============================================================================
# Alignment Verification Script
# ============================================================================
# Verifies that (E) Phase → (B) Part Orders → (C) File Orders are aligned
#
# Usage: ./scripts/verify-alignment.sh
# ============================================================================

set -e

echo "🔍 Verifying Aider Framework Alignment..."
echo "=========================================="
echo ""

# Colors
GREEN='\033[0.32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# ============================================================================
# Check 1: Verify all build-order files exist
# ============================================================================
echo "📁 Check 1: Verifying build-order files exist..."

EXPECTED_FILES=(
  "docs/build-orders/README.md"
  "docs/build-orders/TEMPLATE.md"
  "docs/build-orders/part-01-foundation.md"
  "docs/build-orders/part-02-database.md"
  "docs/build-orders/part-03-types.md"
  "docs/build-orders/part-04-tier-system.md"
  "docs/build-orders/part-05-authentication.md"
  "docs/build-orders/part-06-flask-mt5.md"
  "docs/build-orders/part-07-indicators-api.md"
  "docs/build-orders/part-08-dashboard.md"
  "docs/build-orders/part-09-charts.md"
  "docs/build-orders/part-10-watchlist.md"
  "docs/build-orders/part-11-alerts.md"
  "docs/build-orders/part-12-ecommerce.md"
  "docs/build-orders/part-13-settings.md"
  "docs/build-orders/part-14-admin.md"
  "docs/build-orders/part-15-notifications.md"
  "docs/build-orders/part-16-utilities.md"
  "docs/build-orders/part-17-affiliate.md"
  "docs/build-orders/part-18-dlocal.md"
)

for file in "${EXPECTED_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo -e "  ${RED}❌ MISSING: $file${NC}"
    ((ERRORS++))
  fi
done

echo ""

# ============================================================================
# Check 2: Verify .aider.conf.yml references build-orders
# ============================================================================
echo "⚙️  Check 2: Verifying .aider.conf.yml references build-orders..."

if grep -q "docs/build-orders/part-01-foundation.md" .aider.conf.yml; then
  echo "  ✅ .aider.conf.yml loads build-order files"
else
  echo -e "  ${RED}❌ .aider.conf.yml does NOT reference build-orders${NC}"
  ((ERRORS++))
fi

echo ""

# ============================================================================
# Check 3: Verify constitutions (policies) exist
# ============================================================================
echo "📜 Check 3: Verifying constitution files (policies)..."

POLICY_FILES=(
  "docs/policies/00-tier-specifications.md"
  "docs/policies/01-approval-policies.md"
  "docs/policies/02-quality-standards.md"
  "docs/policies/03-architecture-rules.md"
  "docs/policies/04-escalation-triggers.md"
  "docs/policies/05-coding-patterns.md"
  "docs/policies/06-aider-instructions.md"
  "docs/policies/07-dlocal-integration-rules.md"
  "docs/policies/08-google-oauth-implementation-rules.md"
)

for file in "${POLICY_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo -e "  ${RED}❌ MISSING: $file${NC}"
    ((ERRORS++))
  fi
done

echo ""

# ============================================================================
# Check 4: Verify OpenAPI specs exist
# ============================================================================
echo "🔌 Check 4: Verifying OpenAPI specification files..."

OPENAPI_FILES=(
  "docs/trading_alerts_openapi.yaml"
  "docs/flask_mt5_openapi.yaml"
  "docs/dlocal-openapi-endpoints.yaml"
)

for file in "${OPENAPI_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo -e "  ${YELLOW}⚠️  MISSING: $file (may need to be created)${NC}"
    ((WARNINGS++))
  fi
done

echo ""

# ============================================================================
# Check 5: Verify structure documentation exists
# ============================================================================
echo "📖 Check 5: Verifying structure documentation..."

STRUCTURE_FILES=(
  "docs/v5-structure-division.md"
  "docs/v7/v7_phase_3_building.md"
)

for file in "${STRUCTURE_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo -e "  ${RED}❌ MISSING: $file${NC}"
    ((ERRORS++))
  fi
done

echo ""

# ============================================================================
# Check 6: Verify alignment references
# ============================================================================
echo "🔗 Check 6: Verifying alignment references..."

# Check if Part 1 build order references v5-structure-division
if grep -q "docs/v5-structure-division.md" docs/build-orders/part-01-foundation.md 2>/dev/null; then
  echo "  ✅ Part 1 build order references v5-structure-division.md"
else
  echo -e "  ${YELLOW}⚠️  Part 1 build order missing reference to v5-structure-division.md${NC}"
  ((WARNINGS++))
fi

# Check if Part 1 build order references v5_part_a.md
if grep -q "v5_part_a.md" docs/build-orders/part-01-foundation.md 2>/dev/null; then
  echo "  ✅ Part 1 build order references implementation guide"
else
  echo -e "  ${YELLOW}⚠️  Part 1 build order missing reference to implementation guide${NC}"
  ((WARNINGS++))
fi

# Check if Part 1 build order references patterns
if grep -q "05-coding-patterns.md" docs/build-orders/part-01-foundation.md 2>/dev/null; then
  echo "  ✅ Part 1 build order references coding patterns"
else
  echo -e "  ${YELLOW}⚠️  Part 1 build order missing reference to coding patterns${NC}"
  ((WARNINGS++))
fi

echo ""

# ============================================================================
# Summary
# ============================================================================
echo "=========================================="
echo "📊 Verification Summary"
echo "=========================================="

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}✅ PERFECT ALIGNMENT!${NC}"
  echo ""
  echo "All checks passed:"
  echo "  ✅ All 20 build-order files exist"
  echo "  ✅ All 9 constitution files exist"
  echo "  ✅ .aider.conf.yml properly configured"
  echo "  ✅ Structure documentation present"
  echo "  ✅ Cross-references validated"
  echo ""
  echo "Your Aider framework is ready for maximum autonomy!"
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo -e "${YELLOW}⚠️  ALIGNMENT OK WITH WARNINGS${NC}"
  echo ""
  echo "Errors: $ERRORS"
  echo "Warnings: $WARNINGS"
  echo ""
  echo "System is functional but could be improved."
  exit 0
else
  echo -e "${RED}❌ ALIGNMENT ISSUES DETECTED${NC}"
  echo ""
  echo "Errors: $ERRORS"
  echo "Warnings: $WARNINGS"
  echo ""
  echo "Please fix the errors above before proceeding."
  exit 1
fi
