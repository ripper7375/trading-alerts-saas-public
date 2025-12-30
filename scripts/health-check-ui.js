/**
 * Frontend UI Health Check Script (Cross-platform Node.js version)
 *
 * Usage:
 *   node scripts/health-check-ui.js           # Check files only
 *   node scripts/health-check-ui.js --http    # Check files + HTTP routes
 *   node scripts/health-check-ui.js --http --port 3001  # Custom port
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// Configuration
const PROJECT_ROOT = path.resolve(__dirname, '..');
let BASE_URL = 'http://localhost:3000';
let CHECK_HTTP = false;

// Parse arguments
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--http') {
    CHECK_HTTP = true;
  } else if (args[i] === '--port' && args[i + 1]) {
    BASE_URL = `http://localhost:${args[i + 1]}`;
    i++;
  }
}

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// All pages from frontend-ui-pages.md
const PAGES = [
  // Root Application
  { file: 'app/layout.tsx', route: '/', description: 'Root layout' },
  { file: 'app/error.tsx', route: '/error', description: 'Global error page' },

  // Marketing Section
  { file: 'app/(marketing)/layout.tsx', route: '/', description: 'Marketing layout' },
  { file: 'app/(marketing)/page.tsx', route: '/', description: 'Landing/Home page' },
  { file: 'app/(marketing)/pricing/page.tsx', route: '/pricing', description: 'Pricing page' },

  // Authentication Section
  { file: 'app/(auth)/layout.tsx', route: '/login', description: 'Auth layout' },
  { file: 'app/(auth)/login/page.tsx', route: '/login', description: 'User login page' },
  { file: 'app/(auth)/register/page.tsx', route: '/register', description: 'User registration page' },
  { file: 'app/(auth)/verify-email/page.tsx', route: '/verify-email', description: 'Email verification page' },
  { file: 'app/(auth)/verify-email/pending/page.tsx', route: '/verify-email/pending', description: 'Email verification pending' },
  { file: 'app/(auth)/forgot-password/page.tsx', route: '/forgot-password', description: 'Forgot password page' },
  { file: 'app/(auth)/reset-password/page.tsx', route: '/reset-password', description: 'Reset password page' },

  // Dashboard Section
  { file: 'app/(dashboard)/layout.tsx', route: '/dashboard', description: 'Dashboard layout' },
  { file: 'app/(dashboard)/dashboard/page.tsx', route: '/dashboard', description: 'Main dashboard' },

  // Charts & Visualization
  { file: 'app/(dashboard)/charts/page.tsx', route: '/charts', description: 'Charts overview' },
  { file: 'app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx', route: '/charts/EURUSD/H1', description: 'Chart detail (dynamic)' },

  // Watchlist
  { file: 'app/(dashboard)/watchlist/page.tsx', route: '/watchlist', description: 'Watchlist page' },

  // Alerts
  { file: 'app/(dashboard)/alerts/page.tsx', route: '/alerts', description: 'Alerts list' },
  { file: 'app/(dashboard)/alerts/new/page.tsx', route: '/alerts/new', description: 'Create new alert' },

  // Settings
  { file: 'app/(dashboard)/settings/layout.tsx', route: '/settings', description: 'Settings layout' },
  { file: 'app/(dashboard)/settings/profile/page.tsx', route: '/settings/profile', description: 'Profile settings' },
  { file: 'app/(dashboard)/settings/appearance/page.tsx', route: '/settings/appearance', description: 'Appearance settings' },
  { file: 'app/(dashboard)/settings/account/page.tsx', route: '/settings/account', description: 'Account settings' },
  { file: 'app/(dashboard)/settings/privacy/page.tsx', route: '/settings/privacy', description: 'Privacy settings' },
  { file: 'app/(dashboard)/settings/billing/page.tsx', route: '/settings/billing', description: 'Billing settings' },
  { file: 'app/(dashboard)/settings/language/page.tsx', route: '/settings/language', description: 'Language settings' },
  { file: 'app/(dashboard)/settings/help/page.tsx', route: '/settings/help', description: 'Help settings' },

  // Admin Section (Dashboard)
  { file: 'app/(dashboard)/admin/layout.tsx', route: '/admin', description: 'Admin layout' },
  { file: 'app/(dashboard)/admin/page.tsx', route: '/admin', description: 'Admin dashboard' },
  { file: 'app/(dashboard)/admin/users/page.tsx', route: '/admin/users', description: 'User management' },
  { file: 'app/(dashboard)/admin/api-usage/page.tsx', route: '/admin/api-usage', description: 'API usage' },
  { file: 'app/(dashboard)/admin/errors/page.tsx', route: '/admin/errors', description: 'Error logs' },

  // Admin - Fraud Alerts
  { file: 'app/(dashboard)/admin/fraud-alerts/page.tsx', route: '/admin/fraud-alerts', description: 'Fraud alerts list' },
  { file: 'app/(dashboard)/admin/fraud-alerts/[id]/page.tsx', route: '/admin/fraud-alerts/test-id', description: 'Fraud alert detail' },

  // Admin - Disbursement
  { file: 'app/(dashboard)/admin/disbursement/layout.tsx', route: '/admin/disbursement', description: 'Disbursement layout' },
  { file: 'app/(dashboard)/admin/disbursement/page.tsx', route: '/admin/disbursement', description: 'Disbursement overview' },
  { file: 'app/(dashboard)/admin/disbursement/affiliates/page.tsx', route: '/admin/disbursement/affiliates', description: 'Payable affiliates' },
  { file: 'app/(dashboard)/admin/disbursement/batches/page.tsx', route: '/admin/disbursement/batches', description: 'Payment batches' },
  { file: 'app/(dashboard)/admin/disbursement/batches/[batchId]/page.tsx', route: '/admin/disbursement/batches/test-batch', description: 'Batch details' },
  { file: 'app/(dashboard)/admin/disbursement/transactions/page.tsx', route: '/admin/disbursement/transactions', description: 'Transactions list' },
  { file: 'app/(dashboard)/admin/disbursement/audit/page.tsx', route: '/admin/disbursement/audit', description: 'Audit logs' },
  { file: 'app/(dashboard)/admin/disbursement/config/page.tsx', route: '/admin/disbursement/config', description: 'Disbursement config' },
  { file: 'app/(dashboard)/admin/disbursement/accounts/page.tsx', route: '/admin/disbursement/accounts', description: 'RiseWorks accounts' },

  // Admin Section (Standalone)
  { file: 'app/admin/login/page.tsx', route: '/admin/login', description: 'Admin login' },
  { file: 'app/admin/affiliates/page.tsx', route: '/admin/affiliates', description: 'Affiliate management' },
  { file: 'app/admin/affiliates/[id]/page.tsx', route: '/admin/affiliates/test-id', description: 'Affiliate detail' },
  { file: 'app/admin/affiliates/reports/profit-loss/page.tsx', route: '/admin/affiliates/reports/profit-loss', description: 'P&L report' },
  { file: 'app/admin/affiliates/reports/sales-performance/page.tsx', route: '/admin/affiliates/reports/sales-performance', description: 'Sales report' },
  { file: 'app/admin/affiliates/reports/commission-owings/page.tsx', route: '/admin/affiliates/reports/commission-owings', description: 'Commission report' },
  { file: 'app/admin/affiliates/reports/code-inventory/page.tsx', route: '/admin/affiliates/reports/code-inventory', description: 'Code inventory' },

  // Affiliate Section
  { file: 'app/affiliate/layout.tsx', route: '/affiliate', description: 'Affiliate layout' },
  { file: 'app/affiliate/register/page.tsx', route: '/affiliate/register', description: 'Affiliate registration' },
  { file: 'app/affiliate/verify/page.tsx', route: '/affiliate/verify', description: 'Affiliate verification' },
  { file: 'app/affiliate/dashboard/page.tsx', route: '/affiliate/dashboard', description: 'Affiliate dashboard' },
  { file: 'app/affiliate/dashboard/codes/page.tsx', route: '/affiliate/dashboard/codes', description: 'Affiliate codes' },
  { file: 'app/affiliate/dashboard/commissions/page.tsx', route: '/affiliate/dashboard/commissions', description: 'Affiliate commissions' },
  { file: 'app/affiliate/dashboard/profile/page.tsx', route: '/affiliate/dashboard/profile', description: 'Affiliate profile' },
  { file: 'app/affiliate/dashboard/profile/payment/page.tsx', route: '/affiliate/dashboard/profile/payment', description: 'Payment settings' },

  // Checkout Section
  { file: 'app/checkout/page.tsx', route: '/checkout', description: 'Unified checkout' },
];

// Results tracking
const results = {
  total: 0,
  filesExist: 0,
  filesMissing: 0,
  httpOk: 0,
  httpRedirect: 0,
  httpFail: 0,
  missingFiles: [],
  brokenRoutes: [],
  workingRoutes: [],
  redirectRoutes: [],
};

// Check if file exists
function checkFile(filePath) {
  const fullPath = path.join(PROJECT_ROOT, filePath);
  return fs.existsSync(fullPath);
}

// Check HTTP route
function checkHttp(route) {
  return new Promise((resolve) => {
    const url = new URL(route, BASE_URL);

    const req = http.get(url, { timeout: 10000 }, (res) => {
      resolve(res.statusCode);
    });

    req.on('error', () => {
      resolve(0);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(0);
    });
  });
}

// Get status color
function getStatusColor(code) {
  if (code >= 200 && code < 300) return colors.green;
  if (code >= 300 && code < 400) return colors.yellow;
  return colors.red;
}

// Main function
async function main() {
  console.log('');
  console.log(`${colors.cyan}════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}          FRONTEND UI HEALTH CHECK - Trading Alerts SaaS         ${colors.reset}`);
  console.log(`${colors.cyan}════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log('');
  console.log(`${colors.blue}Project Root:${colors.reset} ${PROJECT_ROOT}`);
  console.log(`${colors.blue}Check HTTP:${colors.reset} ${CHECK_HTTP}`);
  if (CHECK_HTTP) {
    console.log(`${colors.blue}Base URL:${colors.reset} ${BASE_URL}`);
  }
  console.log('');
  console.log(`${colors.blue}Checking ${PAGES.length} frontend pages...${colors.reset}`);
  console.log('');

  // Check each page
  for (const page of PAGES) {
    results.total++;

    // Check file existence
    const fileExists = checkFile(page.file);
    if (fileExists) {
      results.filesExist++;
    } else {
      results.filesMissing++;
      results.missingFiles.push({ file: page.file, description: page.description });
    }

    const fileStatus = fileExists
      ? `${colors.green}✓${colors.reset}`
      : `${colors.red}✗${colors.reset}`;

    // Check HTTP if enabled
    if (CHECK_HTTP) {
      const httpCode = await checkHttp(page.route);
      let httpStatus;

      if (httpCode >= 200 && httpCode < 300) {
        results.httpOk++;
        results.workingRoutes.push({ route: page.route, description: page.description, code: httpCode });
        httpStatus = `${colors.green}${httpCode}${colors.reset}`;
      } else if (httpCode >= 300 && httpCode < 400) {
        results.httpRedirect++;
        results.redirectRoutes.push({ route: page.route, description: page.description, code: httpCode });
        httpStatus = `${colors.yellow}${httpCode}${colors.reset}`;
      } else {
        results.httpFail++;
        results.brokenRoutes.push({ route: page.route, description: page.description, code: httpCode });
        httpStatus = `${colors.red}${httpCode || 'ERR'}${colors.reset}`;
      }

      console.log(`  [${fileStatus}] [${httpStatus}] ${page.route.padEnd(45)} ${page.description}`);
    } else {
      console.log(`  [${fileStatus}] ${page.file.padEnd(55)} ${page.description}`);
    }
  }

  // Print summary
  console.log('');
  console.log(`${colors.cyan}════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}                          SUMMARY                               ${colors.reset}`);
  console.log(`${colors.cyan}════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log('');

  console.log(`${colors.blue}📁 File Check Summary:${colors.reset}`);
  console.log(`   Total pages:    ${results.total}`);
  console.log(`   ${colors.green}Files exist:   ${results.filesExist}${colors.reset}`);
  console.log(`   ${colors.red}Files missing: ${results.filesMissing}${colors.reset}`);
  console.log('');

  if (CHECK_HTTP) {
    console.log(`${colors.blue}🌐 HTTP Check Summary:${colors.reset}`);
    console.log(`   ${colors.green}OK (2xx):           ${results.httpOk}${colors.reset}`);
    console.log(`   ${colors.yellow}Redirect (3xx):     ${results.httpRedirect}${colors.reset}`);
    console.log(`   ${colors.red}Failed (4xx/5xx/0): ${results.httpFail}${colors.reset}`);
    console.log('');
  }

  // Missing files report
  if (results.missingFiles.length > 0) {
    console.log(`${colors.red}❌ MISSING FILES (need to be created):${colors.reset}`);
    console.log('');
    for (const item of results.missingFiles) {
      console.log(`   • ${item.file}`);
      console.log(`     ${colors.yellow}→ ${item.description}${colors.reset}`);
    }
    console.log('');
  }

  // Broken routes report
  if (CHECK_HTTP && results.brokenRoutes.length > 0) {
    console.log(`${colors.red}❌ BROKEN ROUTES (404 or error):${colors.reset}`);
    console.log('');
    for (const item of results.brokenRoutes) {
      console.log(`   • ${item.route} ${colors.red}[${item.code || 'ERR'}]${colors.reset}`);
      console.log(`     ${colors.yellow}→ ${item.description}${colors.reset}`);
    }
    console.log('');
  }

  // Redirect routes report
  if (CHECK_HTTP && results.redirectRoutes.length > 0) {
    console.log(`${colors.yellow}⚠️  REDIRECT ROUTES (may need auth):${colors.reset}`);
    console.log('');
    for (const item of results.redirectRoutes) {
      console.log(`   • ${item.route} ${colors.yellow}[${item.code}]${colors.reset}`);
      console.log(`     ${colors.yellow}→ ${item.description}${colors.reset}`);
    }
    console.log('');
  }

  // Save JSON report
  const reportPath = path.join(PROJECT_ROOT, 'health-check-report.json');
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total_pages: results.total,
      files_exist: results.filesExist,
      files_missing: results.filesMissing,
      ...(CHECK_HTTP && {
        http_ok: results.httpOk,
        http_redirect: results.httpRedirect,
        http_fail: results.httpFail,
      }),
    },
    missing_files: results.missingFiles,
    broken_routes: results.brokenRoutes,
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`${colors.blue}📄 Report saved to:${colors.reset} ${reportPath}`);
  console.log('');

  // Final status
  const hasIssues = results.filesMissing > 0 || results.httpFail > 0;
  if (!hasIssues) {
    console.log(`${colors.green}════════════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.green}  ✅ ALL CHECKS PASSED! Frontend is healthy.                     ${colors.reset}`);
    console.log(`${colors.green}════════════════════════════════════════════════════════════════${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`${colors.red}════════════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.red}  ❌ ISSUES FOUND! Please fix the problems above.                ${colors.reset}`);
    console.log(`${colors.red}════════════════════════════════════════════════════════════════${colors.reset}`);
    console.log('');
    console.log(`${colors.yellow}Next Steps:${colors.reset}`);
    console.log('  1. Create missing page files');
    console.log('  2. Fix broken routes');
    console.log('  3. Re-run this script to verify fixes');
    console.log('');
    process.exit(1);
  }
}

main().catch(console.error);
