#!/bin/bash
#
# Comprehensive Test Suite for Prisma 5.x Upgrade Validation
# Run with: ./scripts/run-all-tests.sh
#

set -e

echo ""
echo "========================================"
echo "  Running Comprehensive Test Suite"
echo "========================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

FAILED_TESTS=()
PASSED_TESTS=()
SKIPPED_TESTS=()

run_test() {
  local name="$1"
  local command="$2"

  echo -e "${BLUE}> Running: ${name}${NC}"

  if eval "$command" > /tmp/test-output-$$.log 2>&1; then
    echo -e "${GREEN}  [PASS] ${name}${NC}"
    PASSED_TESTS+=("$name")
    return 0
  else
    echo -e "${RED}  [FAIL] ${name}${NC}"
    echo "  Output (last 20 lines):"
    tail -20 /tmp/test-output-$$.log | sed 's/^/    /'
    FAILED_TESTS+=("$name")
    return 1
  fi
}

skip_test() {
  local name="$1"
  local reason="$2"
  echo -e "${YELLOW}  [SKIP] ${name} - ${reason}${NC}"
  SKIPPED_TESTS+=("$name")
}

# Test 1: TypeScript Compilation
echo ""
echo "----------------------------------------"
echo "  Phase 1: TypeScript Compilation"
echo "----------------------------------------"
if command -v pnpm &> /dev/null; then
  run_test "TypeScript Check" "pnpm tsc --noEmit" || true
else
  skip_test "TypeScript Check" "pnpm not found"
fi

# Test 2: ESLint
echo ""
echo "----------------------------------------"
echo "  Phase 2: Code Quality (ESLint)"
echo "----------------------------------------"
if command -v pnpm &> /dev/null && pnpm run lint --help &> /dev/null 2>&1; then
  run_test "ESLint" "pnpm lint" || true
else
  skip_test "ESLint" "lint command not configured"
fi

# Test 3: Build
echo ""
echo "----------------------------------------"
echo "  Phase 3: Production Build"
echo "----------------------------------------"
if command -v pnpm &> /dev/null; then
  run_test "Next.js Build" "pnpm build" || true
else
  skip_test "Next.js Build" "pnpm not found"
fi

# Test 4: Prisma Validation
echo ""
echo "----------------------------------------"
echo "  Phase 4: Prisma Schema Validation"
echo "----------------------------------------"
if [ -f "prisma/schema.prisma" ]; then
  run_test "Prisma Validate" "npx prisma validate" || true
else
  skip_test "Prisma Validate" "prisma/schema.prisma not found"
fi

# Test 5: Unit Tests (if available)
echo ""
echo "----------------------------------------"
echo "  Phase 5: Unit Tests"
echo "----------------------------------------"
if command -v pnpm &> /dev/null; then
  if pnpm run test:unit --help &> /dev/null 2>&1; then
    run_test "Unit Tests" "pnpm test:unit" || true
  elif pnpm run test --help &> /dev/null 2>&1; then
    run_test "Tests" "pnpm test" || true
  else
    skip_test "Unit Tests" "test command not configured"
  fi
else
  skip_test "Unit Tests" "pnpm not found"
fi

# Test 6: Prisma 5.x Specific Validation
echo ""
echo "----------------------------------------"
echo "  Phase 6: Prisma 5.x Feature Validation"
echo "----------------------------------------"
if [ -f "scripts/test-prisma5-upgrade.ts" ]; then
  if command -v npx &> /dev/null; then
    run_test "Prisma 5.x Features" "npx tsx scripts/test-prisma5-upgrade.ts" || true
  else
    skip_test "Prisma 5.x Features" "npx not found"
  fi
else
  skip_test "Prisma 5.x Features" "validation script not found"
fi

# Summary
echo ""
echo "========================================"
echo "  TEST SUMMARY"
echo "========================================"
echo ""

TOTAL=$((${#PASSED_TESTS[@]} + ${#FAILED_TESTS[@]} + ${#SKIPPED_TESTS[@]}))

echo "Total Tests: ${TOTAL}"
echo -e "${GREEN}Passed:  ${#PASSED_TESTS[@]}${NC}"
echo -e "${RED}Failed:  ${#FAILED_TESTS[@]}${NC}"
echo -e "${YELLOW}Skipped: ${#SKIPPED_TESTS[@]}${NC}"
echo ""

if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
  echo -e "${RED}Failed Tests:${NC}"
  for test in "${FAILED_TESTS[@]}"; do
    echo -e "${RED}  - ${test}${NC}"
  done
  echo ""
fi

if [ ${#SKIPPED_TESTS[@]} -gt 0 ]; then
  echo -e "${YELLOW}Skipped Tests:${NC}"
  for test in "${SKIPPED_TESTS[@]}"; do
    echo -e "${YELLOW}  - ${test}${NC}"
  done
  echo ""
fi

echo "========================================"

# Cleanup
rm -f /tmp/test-output-$$.log

# Exit with appropriate code
if [ ${#FAILED_TESTS[@]} -eq 0 ]; then
  echo -e "${GREEN}All tests passed! Safe to proceed with deployment.${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed. Please review before deployment.${NC}"
  exit 1
fi
