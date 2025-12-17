#!/usr/bin/env node
/**
 * Coverage Report Tool for Trading Alerts SaaS V7
 *
 * Provides comprehensive coverage analysis comparing actual vs target coverage
 * for both global thresholds and path-specific targets.
 *
 * Usage:
 *   npm run coverage:report          # Quick coverage report
 *   npm run test:coverage -- && npm run coverage:report  # Run tests then report
 *   node scripts/check-coverage.js   # Direct execution
 *
 * Requirements:
 *   - Run tests with coverage first: npm test -- --coverage --coverageReporters=json-summary
 *   - coverage/coverage-summary.json must exist
 */

const fs = require('fs');
const path = require('path');

// =============================================================================
// Configuration
// =============================================================================

// Global coverage thresholds (should match jest.config.js)
const GLOBAL_THRESHOLDS = {
  statements: 18,
  branches: 10,
  functions: 15,
  lines: 18,
};

// Path-specific coverage targets (Phase 1 Testing Framework)
const PATH_TARGETS = {
  // Tier 1: Critical Paths (25% minimum)
  'Path A (Auth)': { pattern: /lib\/auth/, target: 25, tier: 1 },
  'Path B (Billing)': { pattern: /lib\/stripe/, target: 25, tier: 1 },
  'Path C (Tier)': { pattern: /lib\/tier/, target: 25, tier: 1 },
  'Path D (Database)': { pattern: /lib\/db/, target: 25, tier: 1 },

  // Tier 2: Feature Paths (10% minimum)
  'Path E (MT5)': { pattern: /lib\/api/, target: 10, tier: 2 },
  'Path F (Alerts)': {
    pattern: /(lib\/jobs|app\/api\/(alerts|notifications))/,
    target: 10,
    tier: 2,
  },
  'Path G (Indicators)': {
    pattern: /app\/api\/indicators/,
    target: 10,
    tier: 2,
  },
  'Path H (Watchlist)': { pattern: /app\/api\/watchlist/, target: 10, tier: 2 },

  // Tier 3: Utility Paths (2% minimum)
  // Note: Path I (Types) excluded - TypeScript types are compile-time only, not runtime coverage
  'Path J (UI)': { pattern: /components\/ui\//, target: 2, tier: 3 },
  'Path K (Admin)': { pattern: /app\/api\/admin/, target: 2, tier: 3 },
};

// =============================================================================
// Main Execution
// =============================================================================

function main() {
  // Check if coverage file exists
  const coveragePath = path.join(
    process.cwd(),
    'coverage/coverage-summary.json'
  );

  if (!fs.existsSync(coveragePath)) {
    console.error('\n❌ ERROR: coverage/coverage-summary.json not found!');
    console.error('   Run tests with coverage first:');
    console.error(
      '   npm test -- --coverage --coverageReporters=json-summary\n'
    );
    process.exit(1);
  }

  const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
  const cwd = process.cwd();
  const total = coverage.total;

  // Print header
  console.log('\n' + '='.repeat(80));
  console.log(' COVERAGE REPORT - Trading Alerts SaaS V7');
  console.log(' Generated: ' + new Date().toISOString());
  console.log('='.repeat(80));

  // ==========================================================================
  // Section 1: Global Coverage vs Minimum Thresholds
  // ==========================================================================
  console.log('\n┌' + '─'.repeat(78) + '┐');
  console.log('│ GLOBAL COVERAGE vs MINIMUM THRESHOLDS' + ' '.repeat(39) + '│');
  console.log(
    '├' +
      '─'.repeat(15) +
      '┬' +
      '─'.repeat(12) +
      '┬' +
      '─'.repeat(18) +
      '┬' +
      '─'.repeat(12) +
      '┬' +
      '─'.repeat(16) +
      '┤'
  );
  console.log(
    '│ Metric        │ Current    │ Min Threshold    │ Status     │ Margin         │'
  );
  console.log(
    '├' +
      '─'.repeat(15) +
      '┼' +
      '─'.repeat(12) +
      '┼' +
      '─'.repeat(18) +
      '┼' +
      '─'.repeat(12) +
      '┼' +
      '─'.repeat(16) +
      '┤'
  );

  const globalResults = {};
  let allGlobalPass = true;

  for (const metric of ['statements', 'branches', 'functions', 'lines']) {
    const current = total[metric].pct;
    const threshold = GLOBAL_THRESHOLDS[metric];
    const pass = current >= threshold;
    const margin = (current - threshold).toFixed(2);
    const marginStr = margin >= 0 ? `+${margin}%` : `${margin}%`;

    globalResults[metric] = {
      current,
      threshold,
      pass,
      margin: parseFloat(margin),
    };
    if (!pass) allGlobalPass = false;

    const status = pass ? '✅ PASS' : '❌ FAIL';
    const metricName = metric.charAt(0).toUpperCase() + metric.slice(1);

    console.log(
      '│ ' +
        metricName.padEnd(13) +
        ' │ ' +
        (current.toFixed(2) + '%').padEnd(10) +
        ' │ ' +
        (threshold + '%').padEnd(16) +
        ' │ ' +
        status.padEnd(10) +
        ' │ ' +
        marginStr.padEnd(14) +
        ' │'
    );
  }

  console.log(
    '└' +
      '─'.repeat(15) +
      '┴' +
      '─'.repeat(12) +
      '┴' +
      '─'.repeat(18) +
      '┴' +
      '─'.repeat(12) +
      '┴' +
      '─'.repeat(16) +
      '┘'
  );

  // ==========================================================================
  // Section 2: Path Coverage vs Targets
  // ==========================================================================
  console.log('\n┌' + '─'.repeat(78) + '┐');
  console.log('│ PATH COVERAGE vs TARGETS (by Tier)' + ' '.repeat(42) + '│');
  console.log(
    '├' +
      '─'.repeat(25) +
      '┬' +
      '─'.repeat(8) +
      '┬' +
      '─'.repeat(10) +
      '┬' +
      '─'.repeat(10) +
      '┬' +
      '─'.repeat(10) +
      '┬' +
      '─'.repeat(11) +
      '┤'
  );
  console.log(
    '│ Path                    │ Tier   │ Target   │ Actual   │ Status   │ Margin    │'
  );
  console.log(
    '├' +
      '─'.repeat(25) +
      '┼' +
      '─'.repeat(8) +
      '┼' +
      '─'.repeat(10) +
      '┼' +
      '─'.repeat(10) +
      '┼' +
      '─'.repeat(10) +
      '┼' +
      '─'.repeat(11) +
      '┤'
  );

  const pathResults = {};
  let allPathsPass = true;
  let currentTier = 0;

  for (const [pathName, config] of Object.entries(PATH_TARGETS)) {
    // Add tier separator
    if (config.tier !== currentTier) {
      if (currentTier !== 0) {
        console.log(
          '├' +
            '─'.repeat(25) +
            '┼' +
            '─'.repeat(8) +
            '┼' +
            '─'.repeat(10) +
            '┼' +
            '─'.repeat(10) +
            '┼' +
            '─'.repeat(10) +
            '┼' +
            '─'.repeat(11) +
            '┤'
        );
      }
      currentTier = config.tier;
    }

    let totalStatements = 0;
    let coveredStatements = 0;

    for (const [file, data] of Object.entries(coverage)) {
      if (file === 'total') continue;
      const relativePath = file.startsWith(cwd)
        ? file.slice(cwd.length + 1)
        : file;

      if (config.pattern.test(relativePath)) {
        totalStatements += data.statements.total;
        coveredStatements += data.statements.covered;
      }
    }

    const actual =
      totalStatements > 0
        ? ((coveredStatements / totalStatements) * 100).toFixed(2)
        : 'N/A';
    const pass = actual !== 'N/A' && parseFloat(actual) >= config.target;
    const margin =
      actual !== 'N/A'
        ? (parseFloat(actual) - config.target).toFixed(2)
        : 'N/A';
    const marginStr =
      margin !== 'N/A' ? (margin >= 0 ? `+${margin}%` : `${margin}%`) : 'N/A';

    pathResults[pathName] = {
      tier: config.tier,
      target: config.target,
      actual,
      pass,
      margin: margin !== 'N/A' ? parseFloat(margin) : null,
    };
    if (!pass) allPathsPass = false;

    const status = pass ? '✅ PASS' : '❌ FAIL';
    const tierStr = `Tier ${config.tier}`;

    console.log(
      '│ ' +
        pathName.padEnd(23) +
        ' │ ' +
        tierStr.padEnd(6) +
        ' │ ' +
        (config.target + '%').padEnd(8) +
        ' │ ' +
        (actual + '%').padEnd(8) +
        ' │ ' +
        status.padEnd(8) +
        ' │ ' +
        marginStr.padEnd(9) +
        ' │'
    );
  }

  console.log(
    '└' +
      '─'.repeat(25) +
      '┴' +
      '─'.repeat(8) +
      '┴' +
      '─'.repeat(10) +
      '┴' +
      '─'.repeat(10) +
      '┴' +
      '─'.repeat(10) +
      '┴' +
      '─'.repeat(11) +
      '┘'
  );

  // ==========================================================================
  // Section 3: Summary
  // ==========================================================================
  console.log('\n┌' + '─'.repeat(78) + '┐');
  console.log('│ SUMMARY' + ' '.repeat(70) + '│');
  console.log('├' + '─'.repeat(78) + '┤');

  const globalStatus = allGlobalPass
    ? '✅ ALL GLOBAL THRESHOLDS MET'
    : '❌ SOME GLOBAL THRESHOLDS NOT MET';
  const pathStatus = allPathsPass
    ? '✅ ALL PATH TARGETS MET'
    : '❌ SOME PATH TARGETS NOT MET';

  console.log('│ Global Thresholds: ' + globalStatus.padEnd(57) + ' │');
  console.log('│ Path Targets:      ' + pathStatus.padEnd(57) + ' │');
  console.log('│' + ' '.repeat(78) + '│');

  // Count stats
  const tier1Pass = Object.values(pathResults).filter(
    (r) => r.tier === 1 && r.pass
  ).length;
  const tier1Total = Object.values(pathResults).filter(
    (r) => r.tier === 1
  ).length;
  const tier2Pass = Object.values(pathResults).filter(
    (r) => r.tier === 2 && r.pass
  ).length;
  const tier2Total = Object.values(pathResults).filter(
    (r) => r.tier === 2
  ).length;
  const tier3Pass = Object.values(pathResults).filter(
    (r) => r.tier === 3 && r.pass
  ).length;
  const tier3Total = Object.values(pathResults).filter(
    (r) => r.tier === 3
  ).length;

  console.log(
    '│ Tier 1 (Critical 25%): ' +
      `${tier1Pass}/${tier1Total} paths passing`.padEnd(54) +
      ' │'
  );
  console.log(
    '│ Tier 2 (Feature 10%):  ' +
      `${tier2Pass}/${tier2Total} paths passing`.padEnd(54) +
      ' │'
  );
  console.log(
    '│ Tier 3 (Utility 2%):   ' +
      `${tier3Pass}/${tier3Total} paths passing`.padEnd(54) +
      ' │'
  );

  console.log('└' + '─'.repeat(78) + '┘');

  // ==========================================================================
  // Exit Code
  // ==========================================================================
  const overallPass = allGlobalPass && allPathsPass;

  if (overallPass) {
    console.log('\n✅ COVERAGE CHECK PASSED\n');
    process.exit(0);
  } else {
    console.log('\n❌ COVERAGE CHECK FAILED\n');
    process.exit(1);
  }
}

// Run if executed directly
main();
