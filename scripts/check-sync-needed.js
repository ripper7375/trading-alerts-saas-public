#!/usr/bin/env node

/**
 * Check if frontend sync is needed based on changed files
 * Usage: node scripts/check-sync-needed.js
 */

const { execSync } = require('child_process');
const path = require('path');

// Files/directories that require frontend sync when modified
const SYNC_TRIGGERS = [
  'types/',
  'lib/tier-config.ts',
  'lib/tier-helpers.ts',
  'lib/tier-validation.ts',
  'lib/utils.ts',
  'lib/constants/business-rules.ts',
  'lib/tier/constants.ts',
  'lib/tier/validator.ts',
  'prisma/schema.prisma',
];

// Get changed files from git
function getChangedFiles() {
  try {
    // Check staged files
    const staged = execSync('git diff --cached --name-only', {
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean);

    // Check unstaged files
    const unstaged = execSync('git diff --name-only', { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);

    return [...new Set([...staged, ...unstaged])];
  } catch (error) {
    console.error('Error getting changed files:', error.message);
    return [];
  }
}

// Check if any changed file triggers sync
function checkSyncNeeded(changedFiles) {
  const triggerMatches = [];

  for (const file of changedFiles) {
    for (const trigger of SYNC_TRIGGERS) {
      if (file.startsWith(trigger) || file === trigger.replace('/', '')) {
        triggerMatches.push({ file, trigger });
      }
    }
  }

  return triggerMatches;
}

// Main
function main() {
  console.log('🔍 Checking if frontend sync is needed...\n');

  const changedFiles = getChangedFiles();

  if (changedFiles.length === 0) {
    console.log('No changed files detected.');
    process.exit(0);
  }

  console.log(`Found ${changedFiles.length} changed file(s):`);
  changedFiles.forEach((f) => console.log(`  - ${f}`));
  console.log('');

  const matches = checkSyncNeeded(changedFiles);

  if (matches.length === 0) {
    console.log('✅ No sync required - changes do not affect frontend.');
    process.exit(0);
  }

  console.log('⚠️  SYNC REQUIRED - The following changes affect frontend:\n');
  matches.forEach(({ file, trigger }) => {
    console.log(`  📁 ${file}`);
    console.log(`     └── Matches trigger: ${trigger}`);
  });

  console.log('\n📋 Action needed:');
  console.log('   Run: npm run sync:frontend');
  console.log('   Or:  bash scripts/sync-frontend.sh');

  process.exit(1); // Exit with error to fail CI if sync needed but not done
}

main();
