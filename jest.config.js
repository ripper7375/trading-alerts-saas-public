// ============================================================================
// Jest Configuration for Trading Alerts SaaS V7
// ============================================================================
// IMPORTANT: This file defines quality gates for testing
// Changes here affect CI/CD pipeline - update shift-left-testing docs if modified

const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
});

// Add any custom config to be passed to Jest
const config = {
  // ============================================================================
  // Test Environment Setup
  // ============================================================================
  // jsdom: Simulates browser environment for React component testing
  testEnvironment: 'jsdom',

  // Setup file runs before each test suite (configures testing-library, etc.)
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // ============================================================================
  // Module Resolution (Matches TypeScript paths)
  // ============================================================================
  // CRITICAL: Must match tsconfig.json paths for @ alias
  // Allows imports like: import { Button } from '@/components/Button'
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },

  // ============================================================================
  // Test Collection Filters
  // ============================================================================
  // Ignore build outputs, dependencies, and coverage reports
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/coverage/',
  ],

  // ============================================================================
  // Coverage Collection (What Files to Measure)
  // ============================================================================
  // Collects coverage from all production code (components, lib, app, pages)
  // Excludes: type definitions, dependencies, build outputs
  collectCoverageFrom: [
    'components/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    'app/**/*.{js,jsx,ts,tsx}',
    'pages/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/coverage/**',
  ],

  // ============================================================================
  // Coverage Thresholds (QUALITY GATE - Blocks CI/CD if not met)
  // ============================================================================
  // These thresholds are enforced by Jest and will fail the build if not met.
  // Thresholds updated after Phase 1 Testing Framework implementation.
  //
  // Current coverage (as of Phase 1 completion):
  //   - statements: 21.41%
  //   - branches: 13.75%
  //   - functions: 18.68%
  //   - lines: 21.72%
  //
  // Thresholds set with ~3-4% safety margin to allow for new code additions
  // while maintaining quality. If adding new features causes coverage to drop
  // below thresholds, add tests for the new code before merging.
  //
  // Long-term target: statements: 45%, branches: 50%, lines: 45%, functions: 60%
  // WHY THIS MATTERS: Low coverage = untested code = production bugs
  //
  // To check detailed coverage by path: npm run coverage:report
  coverageThreshold: {
    global: {
      statements: 18, // Current: 21.41%, Margin: +3.41%
      branches: 10,   // Current: 13.75%, Margin: +3.75%
      functions: 15,  // Current: 18.68%, Margin: +3.68%
      lines: 18,      // Current: 21.72%, Margin: +3.72%
    },
  },

  // ============================================================================
  // Test File Patterns (Where Jest Looks for Tests)
  // ============================================================================
  // CRITICAL: Must follow pattern ComponentName.test.tsx in __tests__/ folder
  // Prevents Haste Map collisions by organizing tests properly
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],

  // ============================================================================
  // Module File Extensions (Import Resolution Order)
  // ============================================================================
  // Jest tries these extensions in order when resolving imports
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};

// Create Jest configuration with Next.js
module.exports = createJestConfig(config);
