#!/usr/bin/env node

/**
 * Custom Policy Validation Script
 *
 * This script validates code files against the project's policy requirements.
 * It checks for:
 * - TypeScript type safety
 * - Error handling
 * - Authentication checks
 * - Tier validation
 * - API contract compliance
 * - Security standards
 *
 * Usage:
 *   node scripts/validate-file.js <filepath>
 *   node scripts/validate-file.js --all
 */

const fs = require('fs');
const path = require('path');

// Severity levels
const SEVERITY = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

class PolicyValidator {
  constructor() {
    this.issues = [];
    this.filesChecked = 0;
  }

  /**
   * Add an issue to the validation report
   */
  addIssue(severity, file, line, message, rule) {
    this.issues.push({
      severity,
      file,
      line,
      message,
      rule,
    });
  }

  /**
   * Validate a single file
   */
  validateFile(filePath) {
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      return;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const relativePath = path.relative(process.cwd(), filePath);

    this.filesChecked++;
    console.log(`\n🔍 Validating: ${relativePath}`);

    // Skip non-TypeScript files
    if (!filePath.match(/\.(ts|tsx)$/)) {
      console.log('  ⏭️  Skipped (not a TypeScript file)');
      return;
    }

    // Run validation checks
    this.checkTypeScriptTypes(content, lines, relativePath);
    this.checkErrorHandling(content, lines, relativePath);
    this.checkAuthentication(content, lines, relativePath);
    this.checkTierValidation(content, lines, relativePath);
    this.checkSecurityPatterns(content, lines, relativePath);
    this.checkInputValidation(content, lines, relativePath);
  }

  /**
   * Check 1: TypeScript Type Safety
   */
  checkTypeScriptTypes(content, lines, filePath) {
    // Check for 'any' type usage
    if (content.includes(': any') || content.includes('<any>')) {
      const lineNumbers = lines
        .map((line, idx) => (line.includes('any') ? idx + 1 : null))
        .filter((num) => num !== null);

      lineNumbers.forEach((lineNum) => {
        this.addIssue(
          SEVERITY.HIGH,
          filePath,
          lineNum,
          "Avoid using 'any' type. Use specific types instead.",
          'NO_ANY_TYPE'
        );
      });
    }

    // Check for functions without return types (API routes)
    if (filePath.includes('/api/')) {
      const functionRegex = /export\s+async\s+function\s+\w+\s*\([^)]*\)\s*{/g;
      const matches = [...content.matchAll(functionRegex)];

      matches.forEach((match) => {
        const beforeMatch = content.substring(0, match.index);
        const lineNum = beforeMatch.split('\n').length;

        if (!match[0].includes(':')) {
          this.addIssue(
            SEVERITY.HIGH,
            filePath,
            lineNum,
            'API route handler missing return type annotation',
            'MISSING_RETURN_TYPE'
          );
        }
      });
    }
  }

  /**
   * Check 2: Error Handling
   */
  checkErrorHandling(content, lines, filePath) {
    // API routes must have try-catch
    if (filePath.includes('/api/') && filePath.includes('route.ts')) {
      if (!content.includes('try {') || !content.includes('catch')) {
        this.addIssue(
          SEVERITY.HIGH,
          filePath,
          1,
          'API route missing try-catch error handling',
          'MISSING_ERROR_HANDLING'
        );
      }

      // Check for generic error messages
      if (content.match(/error:\s*['"]error['"]/i)) {
        const lineNumbers = lines
          .map((line, idx) =>
            line.match(/error:\s*['"]error['"]/i) ? idx + 1 : null
          )
          .filter((num) => num !== null);

        lineNumbers.forEach((lineNum) => {
          this.addIssue(
            SEVERITY.MEDIUM,
            filePath,
            lineNum,
            'Generic error message. Use specific, user-friendly messages.',
            'GENERIC_ERROR_MESSAGE'
          );
        });
      }
    }
  }

  /**
   * Check 3: Authentication
   */
  checkAuthentication(content, lines, filePath) {
    // Protected API routes should check authentication
    const protectedPaths = ['/api/alerts', '/api/watchlist', '/api/user'];

    const needsAuth = protectedPaths.some((path) => filePath.includes(path));

    if (needsAuth && !filePath.includes('route.ts')) {
      return; // Only check route files
    }

    if (needsAuth) {
      const hasAuth =
        content.includes('getServerSession') ||
        content.includes('getSession') ||
        content.includes('req.auth') ||
        content.includes('session');

      if (!hasAuth) {
        this.addIssue(
          SEVERITY.CRITICAL,
          filePath,
          1,
          'Protected API route missing authentication check',
          'MISSING_AUTH_CHECK'
        );
      }

      // Check if session is validated before use
      if (
        content.includes('session.user') &&
        !content.includes('if (!session)')
      ) {
        this.addIssue(
          SEVERITY.HIGH,
          filePath,
          1,
          'Session used without null check. Add: if (!session) return 401',
          'MISSING_SESSION_CHECK'
        );
      }
    }
  }

  /**
   * Check 4: Tier Validation
   */
  checkTierValidation(content, lines, filePath) {
    // Routes that use symbols/timeframes should validate tier
    const needsTierValidation =
      (filePath.includes('/api/alerts') ||
        filePath.includes('/api/indicators') ||
        filePath.includes('/api/watchlist')) &&
      (content.includes('symbol') || content.includes('timeframe'));

    if (needsTierValidation) {
      const hasTierValidation =
        content.includes('validateTierAccess') ||
        content.includes('tier') ||
        content.includes('TIER_LIMITS');

      if (!hasTierValidation) {
        this.addIssue(
          SEVERITY.CRITICAL,
          filePath,
          1,
          'Endpoint accepts symbol/timeframe but missing tier validation',
          'MISSING_TIER_VALIDATION'
        );
      }
    }
  }

  /**
   * Check 5: Security Patterns
   */
  checkSecurityPatterns(content, lines, filePath) {
    // Check for hardcoded secrets
    const secretPatterns = [
      /api[_-]?key\s*=\s*['"][^'"]{10,}['"]/i,
      /secret\s*=\s*['"][^'"]{10,}['"]/i,
      /password\s*=\s*['"][^'"]+['"]/i,
      /token\s*=\s*['"][^'"]{20,}['"]/i,
    ];

    secretPatterns.forEach((pattern) => {
      if (pattern.test(content)) {
        const lineNumbers = lines
          .map((line, idx) => (pattern.test(line) ? idx + 1 : null))
          .filter((num) => num !== null);

        lineNumbers.forEach((lineNum) => {
          // Allow for test files and examples
          if (!filePath.includes('.test.') && !filePath.includes('example')) {
            this.addIssue(
              SEVERITY.CRITICAL,
              filePath,
              lineNum,
              'Potential hardcoded secret detected. Use environment variables.',
              'HARDCODED_SECRET'
            );
          }
        });
      }
    });

    // Check for SQL injection risks (raw queries)
    if (
      content.includes('prisma.$executeRaw') ||
      content.includes('prisma.$queryRaw')
    ) {
      if (!content.includes('sql`') && !content.includes('Prisma.sql`')) {
        this.addIssue(
          SEVERITY.CRITICAL,
          filePath,
          1,
          'Raw SQL query without parameterization. Use Prisma.sql`` or ORM methods.',
          'SQL_INJECTION_RISK'
        );
      }
    }
  }

  /**
   * Check 6: Input Validation
   */
  checkInputValidation(content, lines, filePath) {
    // API routes should validate input
    if (filePath.includes('/api/') && filePath.includes('route.ts')) {
      const hasPost = content.includes('export async function POST');
      const hasPatch = content.includes('export async function PATCH');
      const hasPut = content.includes('export async function PUT');

      if (hasPost || hasPatch || hasPut) {
        const hasZodValidation =
          content.includes('z.object') || content.includes('.parse(');

        if (!hasZodValidation) {
          this.addIssue(
            SEVERITY.HIGH,
            filePath,
            1,
            'POST/PATCH/PUT endpoint missing Zod input validation',
            'MISSING_INPUT_VALIDATION'
          );
        }
      }
    }
  }

  /**
   * Generate validation report
   */
  generateReport() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 VALIDATION REPORT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const criticalIssues = this.issues.filter(
      (i) => i.severity === SEVERITY.CRITICAL
    );
    const highIssues = this.issues.filter((i) => i.severity === SEVERITY.HIGH);
    const mediumIssues = this.issues.filter(
      (i) => i.severity === SEVERITY.MEDIUM
    );
    const lowIssues = this.issues.filter((i) => i.severity === SEVERITY.LOW);

    console.log(`\nFiles Checked: ${this.filesChecked}`);
    console.log(`Total Issues: ${this.issues.length}`);
    console.log(`  🔴 Critical: ${criticalIssues.length}`);
    console.log(`  🟠 High: ${highIssues.length}`);
    console.log(`  🟡 Medium: ${mediumIssues.length}`);
    console.log(`  🟢 Low: ${lowIssues.length}`);

    if (this.issues.length === 0) {
      console.log('\n✅ All policy checks passed!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return true;
    }

    // Print issues by severity
    [SEVERITY.CRITICAL, SEVERITY.HIGH, SEVERITY.MEDIUM, SEVERITY.LOW].forEach(
      (severity) => {
        const severityIssues = this.issues.filter(
          (i) => i.severity === severity
        );
        if (severityIssues.length === 0) return;

        const icon = {
          Critical: '🔴',
          High: '🟠',
          Medium: '🟡',
          Low: '🟢',
        }[severity];

        console.log(`\n${icon} ${severity} Issues (${severityIssues.length}):`);
        console.log('─'.repeat(60));

        severityIssues.forEach((issue, idx) => {
          console.log(`\n${idx + 1}. ${issue.file}:${issue.line}`);
          console.log(`   Rule: ${issue.rule}`);
          console.log(`   ${issue.message}`);
        });
      }
    );

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Approval decision based on 01-approval-policies.md
    const canApprove = criticalIssues.length === 0 && highIssues.length <= 2;

    if (canApprove) {
      console.log('\n✅ DECISION: APPROVE (with auto-fixes needed)');
      console.log('   - 0 Critical issues ✓');
      console.log(`   - ${highIssues.length} High issues (≤2 threshold) ✓`);
      console.log('\n   Next step: Run auto-fix for High/Medium issues');
    } else {
      console.log('\n🚨 DECISION: ESCALATE');
      if (criticalIssues.length > 0) {
        console.log(
          `   - ${criticalIssues.length} Critical issues (must be 0)`
        );
      }
      if (highIssues.length > 2) {
        console.log(
          `   - ${highIssues.length} High issues (exceeds threshold of 2)`
        );
      }
      console.log('\n   Next step: Review and fix issues manually');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return canApprove;
  }
}

// Main execution
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node scripts/validate-file.js <filepath>');
    console.error('       node scripts/validate-file.js --all');
    process.exit(1);
  }

  const validator = new PolicyValidator();

  if (args[0] === '--all') {
    // Validate all TypeScript files (excluding node_modules, .next, etc.)
    const glob = require('glob');
    const files = glob.sync('**/*.{ts,tsx}', {
      ignore: [
        'node_modules/**',
        '.next/**',
        'out/**',
        'dist/**',
        'build/**',
        'seed-code/**',
      ],
    });

    files.forEach((file) => validator.validateFile(file));
  } else {
    // Validate single file
    validator.validateFile(args[0]);
  }

  const passed = validator.generateReport();
  process.exit(passed ? 0 : 1);
}

// Only run if called directly
if (require.main === module) {
  main();
}

module.exports = { PolicyValidator };
