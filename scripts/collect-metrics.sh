#!/bin/bash
# ============================================================================
# Shift-Left Testing Metrics Collection Script
# ============================================================================
# Purpose: Automated collection of quality and efficiency metrics
# Usage: ./scripts/collect-metrics.sh
# Output: Formatted metrics report for weekly KPI tracking

set -e  # Exit on error

echo "════════════════════════════════════════════════════════════════"
echo "📊 Shift-Left Testing Metrics Report"
echo "════════════════════════════════════════════════════════════════"
echo "Generated: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ============================================================================
# Code Quality Metrics
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 CODE QUALITY METRICS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# TypeScript 'any' usage count
echo "📝 TypeScript 'any' Usage:"
ANY_COUNT=$(grep -r ": any" --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=__tests__ \
  --exclude-dir=.next --exclude-dir=seed-code 2>/dev/null | wc -l || echo "0")
echo "   Found: $ANY_COUNT instances"
if [ "$ANY_COUNT" -eq 0 ]; then
  echo "   Status: ✅ EXCELLENT - No 'any' types"
elif [ "$ANY_COUNT" -lt 5 ]; then
  echo "   Status: 🟡 GOOD - Minimal 'any' usage"
else
  echo "   Status: 🔴 NEEDS IMPROVEMENT - Reduce 'any' usage"
fi
echo ""

# console.log statements count
echo "🖨️  Console.log Statements (Production Code):"
CONSOLE_COUNT=$(grep -r "console\.log" --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=__tests__ \
  --exclude-dir=.next --exclude-dir=seed-code 2>/dev/null | wc -l || echo "0")
echo "   Found: $CONSOLE_COUNT instances"
if [ "$CONSOLE_COUNT" -eq 0 ]; then
  echo "   Status: ✅ EXCELLENT - No debug statements"
elif [ "$CONSOLE_COUNT" -lt 3 ]; then
  echo "   Status: 🟡 GOOD - Minimal console.log usage"
else
  echo "   Status: 🔴 NEEDS IMPROVEMENT - Remove console.log"
fi
echo ""

# Package naming collisions
echo "📦 Package Naming Collisions:"
COLLISIONS=$(find . -name "package.json" -not -path "*/node_modules/*" \
  -exec jq -r '.name' {} \; 2>/dev/null | sort | uniq -d | wc -l || echo "0")
echo "   Found: $COLLISIONS collisions"
if [ "$COLLISIONS" -eq 0 ]; then
  echo "   Status: ✅ EXCELLENT - All package names unique"
else
  echo "   Status: 🔴 CRITICAL - Fix naming collisions"
  find . -name "package.json" -not -path "*/node_modules/*" \
    -exec jq -r '.name' {} \; 2>/dev/null | sort | uniq -d | sed 's/^/     - /'
fi
echo ""

# ============================================================================
# Test Coverage Metrics
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 TEST COVERAGE METRICS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Run coverage and capture summary
if npm run test:coverage --silent 2>&1 | grep -A 4 "All files"; then
  echo ""
  echo "   Status: ✅ Coverage thresholds met"
else
  echo "   Status: 🔴 Coverage thresholds not met"
fi
echo ""

# ============================================================================
# Type Safety Metrics
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📘 TYPE SAFETY METRICS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# TypeScript type check
echo "🔍 Running TypeScript type check..."
if npm run type-check --silent 2>&1 | grep -q "error"; then
  TYPE_ERRORS=$(npm run type-check 2>&1 | grep "error TS" | wc -l || echo "0")
  echo "   Found: $TYPE_ERRORS type errors"
  echo "   Status: 🔴 CRITICAL - Fix type errors"
else
  echo "   Found: 0 type errors"
  echo "   Status: ✅ EXCELLENT - All types correct"
fi
echo ""

# ============================================================================
# Linting Metrics
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 LINTING METRICS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ESLint check
echo "🔍 Running ESLint check..."
if npm run lint --silent 2>&1 | grep -q "error"; then
  ESLINT_ERRORS=$(npm run lint 2>&1 | grep "error" | wc -l || echo "0")
  echo "   Found: $ESLINT_ERRORS errors"
  echo "   Status: 🔴 CRITICAL - Fix ESLint errors"
elif npm run lint --silent 2>&1 | grep -q "warning"; then
  ESLINT_WARNINGS=$(npm run lint 2>&1 | grep "warning" | wc -l || echo "0")
  echo "   Found: $ESLINT_WARNINGS warnings"
  echo "   Status: 🟡 GOOD - Address warnings"
else
  echo "   Found: 0 errors, 0 warnings"
  echo "   Status: ✅ EXCELLENT - All linting rules passed"
fi
echo ""

# ============================================================================
# Git Metrics
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌿 GIT METRICS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Branch info
CURRENT_BRANCH=$(git branch --show-current)
echo "📌 Current Branch: $CURRENT_BRANCH"

# Recent commits
COMMITS_LAST_WEEK=$(git rev-list --count --since="1 week ago" HEAD)
echo "📝 Commits (Last 7 Days): $COMMITS_LAST_WEEK"

# Files changed recently
FILES_CHANGED=$(git diff --name-only HEAD~5 2>/dev/null | wc -l || echo "0")
echo "📄 Files Changed (Last 5 Commits): $FILES_CHANGED"
echo ""

# ============================================================================
# Summary & Recommendations
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 SUMMARY & RECOMMENDATIONS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Calculate overall health score
HEALTH_SCORE=100
if [ "$ANY_COUNT" -gt 0 ]; then HEALTH_SCORE=$((HEALTH_SCORE - 10)); fi
if [ "$CONSOLE_COUNT" -gt 0 ]; then HEALTH_SCORE=$((HEALTH_SCORE - 10)); fi
if [ "$COLLISIONS" -gt 0 ]; then HEALTH_SCORE=$((HEALTH_SCORE - 20)); fi

echo "🎯 Overall Code Health Score: $HEALTH_SCORE/100"
echo ""

if [ "$HEALTH_SCORE" -ge 90 ]; then
  echo "✅ Status: EXCELLENT - Code quality meets all standards"
elif [ "$HEALTH_SCORE" -ge 70 ]; then
  echo "🟡 Status: GOOD - Minor improvements needed"
else
  echo "🔴 Status: NEEDS IMPROVEMENT - Address issues above"
fi
echo ""

echo "📚 Recommendations:"
if [ "$ANY_COUNT" -gt 0 ]; then
  echo "   • Replace $ANY_COUNT 'any' types with proper TypeScript interfaces"
fi
if [ "$CONSOLE_COUNT" -gt 0 ]; then
  echo "   • Remove $CONSOLE_COUNT console.log statements from production code"
fi
if [ "$COLLISIONS" -gt 0 ]; then
  echo "   • Fix $COLLISIONS package naming collisions immediately"
fi
if [ "$HEALTH_SCORE" -eq 100 ]; then
  echo "   • No issues found - continue maintaining high standards! 🎉"
fi
echo ""

# ============================================================================
# Footer
# ============================================================================
echo "════════════════════════════════════════════════════════════════"
echo "📖 For detailed analysis, see: docs/metrics/shift-left-testing-kpis.md"
echo "🔗 Related: docs/principles/shift-left-testing.md"
echo "════════════════════════════════════════════════════════════════"
echo ""
