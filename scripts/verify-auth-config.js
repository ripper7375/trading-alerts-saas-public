#!/usr/bin/env node

/**
 * Authentication Configuration Verification Script
 *
 * Purpose: Verify that all required authentication configuration is in place
 * Usage: node scripts/verify-auth-config.js
 *
 * This script checks:
 * - Environment variables are properly configured
 * - NextAuth configuration is valid
 * - OAuth providers are properly set up
 * - Database connection is working
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const symbols = {
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',
};

console.log(
  `\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`
);
console.log(
  `${colors.cyan}  Authentication Configuration Verification${colors.reset}`
);
console.log(
  `${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`
);

let passCount = 0;
let failCount = 0;
let warnCount = 0;

/**
 * Log a success message
 */
function logSuccess(message) {
  console.log(`${colors.green}${symbols.success}${colors.reset} ${message}`);
  passCount++;
}

/**
 * Log an error message
 */
function logError(message) {
  console.log(`${colors.red}${symbols.error}${colors.reset} ${message}`);
  failCount++;
}

/**
 * Log a warning message
 */
function logWarning(message) {
  console.log(`${colors.yellow}${symbols.warning}${colors.reset} ${message}`);
  warnCount++;
}

/**
 * Log an info message
 */
function logInfo(message) {
  console.log(`${colors.blue}${symbols.info}${colors.reset} ${message}`);
}

/**
 * Print section header
 */
function printSection(title) {
  console.log(`\n${colors.cyan}${title}${colors.reset}`);
  console.log(`${colors.cyan}${'─'.repeat(title.length)}${colors.reset}`);
}

/**
 * Check if a file exists
 */
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Load environment variables from .env.local
 */
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const env = {};

  if (!fileExists(envPath)) {
    logWarning('.env.local file not found (this is OK for production)');
    return env;
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').replace(/^["']|["']$/g, '');
      if (key && value) {
        env[key.trim()] = value.trim();
      }
    }
  }

  return env;
}

/**
 * Check environment variable
 */
function checkEnvVar(name, required = true, validateFn = null) {
  const value = process.env[name] || localEnv[name];

  if (!value) {
    if (required) {
      logError(`${name} is not set`);
      return false;
    } else {
      logWarning(`${name} is not set (optional)`);
      return true;
    }
  }

  if (validateFn) {
    const validation = validateFn(value);
    if (!validation.valid) {
      logError(`${name} validation failed: ${validation.message}`);
      return false;
    }
  }

  logSuccess(`${name} is set`);
  return true;
}

/**
 * Validation functions
 */
const validators = {
  url: (value) => {
    try {
      const url = new URL(value);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return { valid: false, message: 'URL must use http or https protocol' };
      }
      if (value.endsWith('/')) {
        return { valid: false, message: 'URL should not have trailing slash' };
      }
      return { valid: true };
    } catch {
      return { valid: false, message: 'Invalid URL format' };
    }
  },

  minLength: (min) => (value) => {
    if (value.length < min) {
      return { valid: false, message: `Must be at least ${min} characters` };
    }
    return { valid: true };
  },

  startsWith: (prefix) => (value) => {
    if (!value.startsWith(prefix)) {
      return { valid: false, message: `Must start with ${prefix}` };
    }
    return { valid: true };
  },

  postgresUrl: (value) => {
    if (
      !value.startsWith('postgres://') &&
      !value.startsWith('postgresql://')
    ) {
      return {
        valid: false,
        message: 'Must be a PostgreSQL connection string',
      };
    }
    return { valid: true };
  },
};

/**
 * Main verification
 */
async function verifyConfiguration() {
  // Load local environment variables
  global.localEnv = loadEnvFile();

  // 1. Core Authentication Variables
  printSection('1. Core Authentication Configuration');

  checkEnvVar('NEXTAUTH_URL', true, validators.url);
  checkEnvVar('NEXTAUTH_SECRET', true, validators.minLength(32));
  checkEnvVar('DATABASE_URL', true, validators.postgresUrl);

  // 2. Google OAuth Configuration
  printSection('2. Google OAuth Configuration');

  const hasGoogleId = checkEnvVar('GOOGLE_CLIENT_ID', false);
  const hasGoogleSecret = checkEnvVar('GOOGLE_CLIENT_SECRET', false);

  if (hasGoogleId && hasGoogleSecret) {
    logInfo('Google OAuth is configured and will be available');
  } else if (!hasGoogleId && !hasGoogleSecret) {
    logInfo('Google OAuth is not configured (optional)');
  } else {
    logError(
      'Incomplete Google OAuth configuration (need both CLIENT_ID and CLIENT_SECRET)'
    );
  }

  // 3. Twitter OAuth Configuration
  printSection('3. Twitter OAuth Configuration');

  const hasTwitterId = checkEnvVar('TWITTER_CLIENT_ID', false);
  const hasTwitterSecret = checkEnvVar('TWITTER_CLIENT_SECRET', false);

  if (hasTwitterId && hasTwitterSecret) {
    logInfo('Twitter OAuth is configured and will be available');
  } else if (!hasTwitterId && !hasTwitterSecret) {
    logInfo('Twitter OAuth is not configured (optional)');
  } else {
    logError(
      'Incomplete Twitter OAuth configuration (need both CLIENT_ID and CLIENT_SECRET)'
    );
  }

  // 4. LinkedIn OAuth Configuration
  printSection('4. LinkedIn OAuth Configuration');

  const hasLinkedInId = checkEnvVar('LINKEDIN_CLIENT_ID', false);
  const hasLinkedInSecret = checkEnvVar('LINKEDIN_CLIENT_SECRET', false);

  if (hasLinkedInId && hasLinkedInSecret) {
    logInfo('LinkedIn OAuth is configured and will be available');
  } else if (!hasLinkedInId && !hasLinkedInSecret) {
    logInfo('LinkedIn OAuth is not configured (optional)');
  } else {
    logError(
      'Incomplete LinkedIn OAuth configuration (need both CLIENT_ID and CLIENT_SECRET)'
    );
  }

  // 5. Email Service Configuration
  printSection('5. Email Service Configuration');

  checkEnvVar('RESEND_API_KEY', true, validators.startsWith('re_'));
  checkEnvVar('RESEND_FROM_EMAIL', false);

  // 6. File Configuration Checks
  printSection('6. File Configuration Checks');

  const requiredFiles = [
    'lib/auth/auth-options.ts',
    'app/api/auth/[...nextauth]/route.ts',
    'app/api/auth/token-register/route.ts',
    'app/api/auth/verify-email/route.ts',
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(__dirname, '..', file);
    if (fileExists(filePath)) {
      logSuccess(`${file} exists`);
    } else {
      logError(`${file} is missing`);
    }
  }

  // 7. NextAuth Configuration Check
  printSection('7. NextAuth Configuration Check');

  try {
    const authOptionsPath = path.join(
      __dirname,
      '..',
      'lib',
      'auth',
      'auth-options.ts'
    );
    const authOptionsContent = fs.readFileSync(authOptionsPath, 'utf8');

    // Check for OAuth providers
    if (authOptionsContent.includes('GoogleProvider')) {
      logSuccess('Google OAuth provider configured in auth-options.ts');
    } else {
      logWarning('Google OAuth provider not found in auth-options.ts');
    }

    if (authOptionsContent.includes('TwitterProvider')) {
      logSuccess('Twitter OAuth provider configured in auth-options.ts');
    } else {
      logWarning('Twitter OAuth provider not found in auth-options.ts');
    }

    // Session 4B-21 (DECISION-LOG.md F56): CredentialsProvider was retired
    // from auth-options.ts once email/password auth cut over to
    // operation-service via the token-* bridge routes - its presence here
    // would now be the regression, not its absence.
    if (authOptionsContent.includes('CredentialsProvider')) {
      logError(
        'CredentialsProvider found in auth-options.ts (should be OAuth-only since Session 4B-21)'
      );
    } else {
      logSuccess(
        'auth-options.ts is OAuth-only, as expected since Session 4B-21'
      );
    }

    // Check for custom adapter
    if (authOptionsContent.includes('CustomPrismaAdapter')) {
      logSuccess('Custom Prisma adapter configured (sets tier/role defaults)');
    } else {
      logWarning('Custom Prisma adapter not found (may affect user defaults)');
    }

    // Check for security callbacks
    if (
      authOptionsContent.includes('signIn') &&
      authOptionsContent.includes('callback')
    ) {
      logSuccess('Sign-in callback configured (security checks)');
    } else {
      logWarning('Sign-in callback may not be configured');
    }
  } catch (error) {
    logError(`Failed to read auth-options.ts: ${error.message}`);
  }

  // 8. Summary
  printSection('Summary');

  console.log(`\n${colors.cyan}Results:${colors.reset}`);
  console.log(
    `  ${colors.green}${symbols.success} Passed: ${passCount}${colors.reset}`
  );
  console.log(
    `  ${colors.yellow}${symbols.warning} Warnings: ${warnCount}${colors.reset}`
  );
  console.log(
    `  ${colors.red}${symbols.error} Failed: ${failCount}${colors.reset}`
  );

  console.log(
    `\n${colors.cyan}Available Authentication Methods:${colors.reset}`
  );
  const methods = [];
  if (hasGoogleId && hasGoogleSecret) methods.push('Google OAuth');
  if (hasTwitterId && hasTwitterSecret) methods.push('Twitter OAuth');
  if (hasLinkedInId && hasLinkedInSecret) methods.push('LinkedIn OAuth');
  methods.push('Email/Password');

  methods.forEach((method) => {
    console.log(`  ${colors.green}${symbols.success}${colors.reset} ${method}`);
  });

  // Recommendations
  if (failCount > 0) {
    console.log(
      `\n${colors.red}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`
    );
    console.log(
      `${colors.red}  Action Required: Fix ${failCount} critical issue(s)${colors.reset}`
    );
    console.log(
      `${colors.red}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`
    );
    console.log(`${colors.yellow}Next steps:${colors.reset}`);
    console.log(`1. Review the errors above`);
    console.log(`2. Follow COMPLETE_AUTH_FIX_GUIDE.md to fix issues`);
    console.log(`3. Set missing environment variables in Vercel`);
    console.log(`4. Redeploy and run this script again\n`);
    process.exit(1);
  } else if (warnCount > 0) {
    console.log(
      `\n${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`
    );
    console.log(
      `${colors.yellow}  ${warnCount} warning(s) - Review recommended${colors.reset}`
    );
    console.log(
      `${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`
    );
    console.log(`${colors.cyan}Next steps:${colors.reset}`);
    console.log(`1. Review warnings above (optional OAuth providers)`);
    console.log(`2. If all required auth methods work, proceed to testing`);
    console.log(`3. Follow AUTH_TESTING_CHECKLIST.md to verify\n`);
    process.exit(0);
  } else {
    console.log(
      `\n${colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`
    );
    console.log(
      `${colors.green}  ✓ All checks passed! Configuration looks good${colors.reset}`
    );
    console.log(
      `${colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`
    );
    console.log(`${colors.cyan}Next steps:${colors.reset}`);
    console.log(`1. Deploy to Vercel (if not already deployed)`);
    console.log(`2. Ensure all environment variables are set in Vercel`);
    console.log(`3. Follow AUTH_TESTING_CHECKLIST.md to test authentication`);
    console.log(`4. Verify all auth methods work as expected\n`);
    process.exit(0);
  }
}

// Run verification
verifyConfiguration().catch((error) => {
  console.error(
    `\n${colors.red}${symbols.error} Verification failed:${colors.reset}`,
    error.message
  );
  process.exit(1);
});
