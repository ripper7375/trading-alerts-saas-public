#!/bin/bash
# ============================================================================
# Frontend UI Health Check Script
# ============================================================================
# This script checks all frontend UI pages for:
# 1. File existence in the codebase
# 2. HTTP accessibility (when dev server is running)
#
# Usage:
#   ./scripts/health-check-ui.sh           # Check files only
#   ./scripts/health-check-ui.sh --http    # Check files + HTTP routes
#   ./scripts/health-check-ui.sh --http --port 3001  # Custom port
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
BASE_URL="http://localhost:3000"
CHECK_HTTP=false
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --http)
            CHECK_HTTP=true
            shift
            ;;
        --port)
            BASE_URL="http://localhost:$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

# Counters
TOTAL=0
FILES_EXIST=0
FILES_MISSING=0
HTTP_OK=0
HTTP_FAIL=0
HTTP_REDIRECT=0

# Arrays to store results
declare -a MISSING_FILES
declare -a BROKEN_ROUTES
declare -a WORKING_ROUTES
declare -a REDIRECT_ROUTES

# Function to check file existence
check_file() {
    local file_path="$1"
    local full_path="$PROJECT_ROOT/$file_path"

    if [ -f "$full_path" ]; then
        return 0
    else
        return 1
    fi
}

# Function to check HTTP route
check_http() {
    local route="$1"
    local url="${BASE_URL}${route}"

    # Get HTTP status code with timeout
    local status=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 "$url" 2>/dev/null || echo "000")

    echo "$status"
}

# Function to convert file path to route
file_to_route() {
    local file_path="$1"
    local route=""

    # Remove 'app/' prefix and '/page.tsx' or '/layout.tsx' suffix
    route="${file_path#app/}"
    route="${route%/page.tsx}"
    route="${route%/layout.tsx}"

    # Remove route groups (parentheses)
    route=$(echo "$route" | sed 's/([^)]*)//g' | sed 's#//#/#g')

    # Handle root
    if [ -z "$route" ] || [ "$route" == "/" ]; then
        echo "/"
        return
    fi

    # Add leading slash if not present
    if [[ ! "$route" =~ ^/ ]]; then
        route="/$route"
    fi

    # Remove trailing slash
    route="${route%/}"

    echo "$route"
}

echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}          FRONTEND UI HEALTH CHECK - Trading Alerts SaaS         ${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Project Root:${NC} $PROJECT_ROOT"
echo -e "${BLUE}Check HTTP:${NC} $CHECK_HTTP"
if [ "$CHECK_HTTP" = true ]; then
    echo -e "${BLUE}Base URL:${NC} $BASE_URL"
fi
echo ""

# Define all pages from frontend-ui-pages.md
declare -a PAGES=(
    # Root Application
    "app/layout.tsx|/|Root layout"
    "app/error.tsx|/error|Global error page"

    # Marketing Section
    "app/(marketing)/layout.tsx|/|Marketing layout"
    "app/(marketing)/page.tsx|/|Landing/Home page"
    "app/(marketing)/pricing/page.tsx|/pricing|Pricing page"

    # Authentication Section
    "app/(auth)/layout.tsx|/login|Auth layout"
    "app/(auth)/login/page.tsx|/login|User login page"
    "app/(auth)/register/page.tsx|/register|User registration page"
    "app/(auth)/verify-email/page.tsx|/verify-email|Email verification page"
    "app/(auth)/verify-email/pending/page.tsx|/verify-email/pending|Email verification pending"
    "app/(auth)/forgot-password/page.tsx|/forgot-password|Forgot password page"
    "app/(auth)/reset-password/page.tsx|/reset-password|Reset password page"

    # Dashboard Section
    "app/(dashboard)/layout.tsx|/dashboard|Dashboard layout"
    "app/(dashboard)/dashboard/page.tsx|/dashboard|Main dashboard"

    # Charts & Visualization
    "app/(dashboard)/charts/page.tsx|/charts|Charts overview"
    "app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx|/charts/EURUSD/H1|Chart detail (dynamic)"

    # Watchlist
    "app/(dashboard)/watchlist/page.tsx|/watchlist|Watchlist page"

    # Alerts
    "app/(dashboard)/alerts/page.tsx|/alerts|Alerts list"
    "app/(dashboard)/alerts/new/page.tsx|/alerts/new|Create new alert"

    # Settings
    "app/(dashboard)/settings/layout.tsx|/settings|Settings layout"
    "app/(dashboard)/settings/profile/page.tsx|/settings/profile|Profile settings"
    "app/(dashboard)/settings/appearance/page.tsx|/settings/appearance|Appearance settings"
    "app/(dashboard)/settings/account/page.tsx|/settings/account|Account settings"
    "app/(dashboard)/settings/privacy/page.tsx|/settings/privacy|Privacy settings"
    "app/(dashboard)/settings/billing/page.tsx|/settings/billing|Billing settings"
    "app/(dashboard)/settings/language/page.tsx|/settings/language|Language settings"
    "app/(dashboard)/settings/help/page.tsx|/settings/help|Help settings"

    # Admin Section (Dashboard)
    "app/(dashboard)/admin/layout.tsx|/admin|Admin layout"
    "app/(dashboard)/admin/page.tsx|/admin|Admin dashboard"
    "app/(dashboard)/admin/users/page.tsx|/admin/users|User management"
    "app/(dashboard)/admin/api-usage/page.tsx|/admin/api-usage|API usage"
    "app/(dashboard)/admin/errors/page.tsx|/admin/errors|Error logs"

    # Admin - Fraud Alerts
    "app/(dashboard)/admin/fraud-alerts/page.tsx|/admin/fraud-alerts|Fraud alerts list"
    "app/(dashboard)/admin/fraud-alerts/[id]/page.tsx|/admin/fraud-alerts/test-id|Fraud alert detail"

    # Admin - Disbursement
    "app/(dashboard)/admin/disbursement/layout.tsx|/admin/disbursement|Disbursement layout"
    "app/(dashboard)/admin/disbursement/page.tsx|/admin/disbursement|Disbursement overview"
    "app/(dashboard)/admin/disbursement/affiliates/page.tsx|/admin/disbursement/affiliates|Payable affiliates"
    "app/(dashboard)/admin/disbursement/batches/page.tsx|/admin/disbursement/batches|Payment batches"
    "app/(dashboard)/admin/disbursement/batches/[batchId]/page.tsx|/admin/disbursement/batches/test-batch|Batch details"
    "app/(dashboard)/admin/disbursement/transactions/page.tsx|/admin/disbursement/transactions|Transactions list"
    "app/(dashboard)/admin/disbursement/audit/page.tsx|/admin/disbursement/audit|Audit logs"
    "app/(dashboard)/admin/disbursement/config/page.tsx|/admin/disbursement/config|Disbursement config"
    "app/(dashboard)/admin/disbursement/accounts/page.tsx|/admin/disbursement/accounts|RiseWorks accounts"

    # Admin Section (Standalone)
    "app/admin/login/page.tsx|/admin/login|Admin login"
    "app/admin/affiliates/page.tsx|/admin/affiliates|Affiliate management"
    "app/admin/affiliates/[id]/page.tsx|/admin/affiliates/test-id|Affiliate detail"
    "app/admin/affiliates/reports/profit-loss/page.tsx|/admin/affiliates/reports/profit-loss|P&L report"
    "app/admin/affiliates/reports/sales-performance/page.tsx|/admin/affiliates/reports/sales-performance|Sales report"
    "app/admin/affiliates/reports/commission-owings/page.tsx|/admin/affiliates/reports/commission-owings|Commission report"
    "app/admin/affiliates/reports/code-inventory/page.tsx|/admin/affiliates/reports/code-inventory|Code inventory"

    # Affiliate Section
    "app/affiliate/layout.tsx|/affiliate|Affiliate layout"
    "app/affiliate/register/page.tsx|/affiliate/register|Affiliate registration"
    "app/affiliate/verify/page.tsx|/affiliate/verify|Affiliate verification"
    "app/affiliate/dashboard/page.tsx|/affiliate/dashboard|Affiliate dashboard"
    "app/affiliate/dashboard/codes/page.tsx|/affiliate/dashboard/codes|Affiliate codes"
    "app/affiliate/dashboard/commissions/page.tsx|/affiliate/dashboard/commissions|Affiliate commissions"
    "app/affiliate/dashboard/profile/page.tsx|/affiliate/dashboard/profile|Affiliate profile"
    "app/affiliate/dashboard/profile/payment/page.tsx|/affiliate/dashboard/profile/payment|Payment settings"

    # Checkout Section
    "app/checkout/page.tsx|/checkout|Unified checkout"
)

echo -e "${BLUE}Checking ${#PAGES[@]} frontend pages...${NC}"
echo ""

# Check each page
for page_entry in "${PAGES[@]}"; do
    IFS='|' read -r file_path route description <<< "$page_entry"
    TOTAL=$((TOTAL + 1))

    # Check file existence
    if check_file "$file_path"; then
        FILES_EXIST=$((FILES_EXIST + 1))
        file_status="${GREEN}✓${NC}"
    else
        FILES_MISSING=$((FILES_MISSING + 1))
        MISSING_FILES+=("$file_path|$description")
        file_status="${RED}✗${NC}"
    fi

    # Check HTTP if enabled
    if [ "$CHECK_HTTP" = true ]; then
        http_code=$(check_http "$route")

        if [[ "$http_code" =~ ^2 ]]; then
            HTTP_OK=$((HTTP_OK + 1))
            http_status="${GREEN}$http_code${NC}"
            WORKING_ROUTES+=("$route|$description|$http_code")
        elif [[ "$http_code" =~ ^3 ]]; then
            HTTP_REDIRECT=$((HTTP_REDIRECT + 1))
            http_status="${YELLOW}$http_code${NC}"
            REDIRECT_ROUTES+=("$route|$description|$http_code")
        else
            HTTP_FAIL=$((HTTP_FAIL + 1))
            http_status="${RED}$http_code${NC}"
            BROKEN_ROUTES+=("$route|$description|$http_code")
        fi

        printf "  [%b] [%b] %-50s %s\n" "$file_status" "$http_status" "$route" "$description"
    else
        printf "  [%b] %-55s %s\n" "$file_status" "$file_path" "$description"
    fi
done

echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}                          SUMMARY                               ${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo ""

# File Summary
echo -e "${BLUE}📁 File Check Summary:${NC}"
echo -e "   Total pages:    $TOTAL"
echo -e "   ${GREEN}Files exist:   $FILES_EXIST${NC}"
echo -e "   ${RED}Files missing: $FILES_MISSING${NC}"
echo ""

# HTTP Summary (if enabled)
if [ "$CHECK_HTTP" = true ]; then
    echo -e "${BLUE}🌐 HTTP Check Summary:${NC}"
    echo -e "   ${GREEN}OK (2xx):      $HTTP_OK${NC}"
    echo -e "   ${YELLOW}Redirect (3xx): $HTTP_REDIRECT${NC}"
    echo -e "   ${RED}Failed (4xx/5xx/000): $HTTP_FAIL${NC}"
    echo ""
fi

# Missing Files Report
if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    echo -e "${RED}❌ MISSING FILES (need to be created):${NC}"
    echo ""
    for entry in "${MISSING_FILES[@]}"; do
        IFS='|' read -r file desc <<< "$entry"
        echo -e "   • $file"
        echo -e "     ${YELLOW}→ $desc${NC}"
    done
    echo ""
fi

# Broken Routes Report
if [ "$CHECK_HTTP" = true ] && [ ${#BROKEN_ROUTES[@]} -gt 0 ]; then
    echo -e "${RED}❌ BROKEN ROUTES (404 or error):${NC}"
    echo ""
    for entry in "${BROKEN_ROUTES[@]}"; do
        IFS='|' read -r route desc code <<< "$entry"
        echo -e "   • $route ${RED}[$code]${NC}"
        echo -e "     ${YELLOW}→ $desc${NC}"
    done
    echo ""
fi

# Redirect Routes Report
if [ "$CHECK_HTTP" = true ] && [ ${#REDIRECT_ROUTES[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠️  REDIRECT ROUTES (may need auth):${NC}"
    echo ""
    for entry in "${REDIRECT_ROUTES[@]}"; do
        IFS='|' read -r route desc code <<< "$entry"
        echo -e "   • $route ${YELLOW}[$code]${NC}"
        echo -e "     ${YELLOW}→ $desc${NC}"
    done
    echo ""
fi

# Generate JSON report
REPORT_FILE="$PROJECT_ROOT/health-check-report.json"
echo "{" > "$REPORT_FILE"
echo "  \"timestamp\": \"$(date -Iseconds)\"," >> "$REPORT_FILE"
echo "  \"summary\": {" >> "$REPORT_FILE"
echo "    \"total_pages\": $TOTAL," >> "$REPORT_FILE"
echo "    \"files_exist\": $FILES_EXIST," >> "$REPORT_FILE"
echo "    \"files_missing\": $FILES_MISSING," >> "$REPORT_FILE"
if [ "$CHECK_HTTP" = true ]; then
echo "    \"http_ok\": $HTTP_OK," >> "$REPORT_FILE"
echo "    \"http_redirect\": $HTTP_REDIRECT," >> "$REPORT_FILE"
echo "    \"http_fail\": $HTTP_FAIL" >> "$REPORT_FILE"
else
echo "    \"http_checked\": false" >> "$REPORT_FILE"
fi
echo "  }," >> "$REPORT_FILE"

# Missing files JSON
echo "  \"missing_files\": [" >> "$REPORT_FILE"
first=true
for entry in "${MISSING_FILES[@]}"; do
    IFS='|' read -r file desc <<< "$entry"
    if [ "$first" = true ]; then
        first=false
    else
        echo "," >> "$REPORT_FILE"
    fi
    echo -n "    {\"file\": \"$file\", \"description\": \"$desc\"}" >> "$REPORT_FILE"
done
echo "" >> "$REPORT_FILE"
echo "  ]," >> "$REPORT_FILE"

# Broken routes JSON
echo "  \"broken_routes\": [" >> "$REPORT_FILE"
first=true
for entry in "${BROKEN_ROUTES[@]}"; do
    IFS='|' read -r route desc code <<< "$entry"
    if [ "$first" = true ]; then
        first=false
    else
        echo "," >> "$REPORT_FILE"
    fi
    echo -n "    {\"route\": \"$route\", \"description\": \"$desc\", \"status_code\": \"$code\"}" >> "$REPORT_FILE"
done
echo "" >> "$REPORT_FILE"
echo "  ]" >> "$REPORT_FILE"
echo "}" >> "$REPORT_FILE"

echo -e "${BLUE}📄 Report saved to:${NC} $REPORT_FILE"
echo ""

# Final status
if [ $FILES_MISSING -eq 0 ] && [ $HTTP_FAIL -eq 0 ]; then
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✅ ALL CHECKS PASSED! Frontend is healthy.                     ${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${RED}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  ❌ ISSUES FOUND! Please fix the problems above.                ${NC}"
    echo -e "${RED}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "  1. Create missing page files"
    echo "  2. Fix broken routes"
    echo "  3. Re-run this script to verify fixes"
    echo ""
    exit 1
fi
