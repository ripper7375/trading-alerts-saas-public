// ============================================================================
// ESLint Flat Config for Trading Alerts SaaS V7
// ============================================================================
// ESLint v9+ flat config format
// Migrated from .eslintrc.json for forward compatibility

import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

export default [
  // ============================================================================
  // Global Ignores
  // ============================================================================
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'dist/**',
      'build/**',
      'seed-code/**',
      '__mocks__/**',
      '*.config.js',
      '*.config.mjs',
      'postcss.config.mjs',
      'tailwind.config.ts',
    ],
  },

  // ============================================================================
  // Extend Next.js Recommended Configs
  // ============================================================================
  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  // ============================================================================
  // Main Rules for All TypeScript/JavaScript Files
  // ============================================================================
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      // ========================================================================
      // TypeScript Specific Rules (CRITICAL for Type Safety)
      // ========================================================================
      // CRITICAL: Forbids 'any' type - ensures all code is properly typed
      '@typescript-eslint/no-explicit-any': 'error',

      // CRITICAL: Requires explicit return types on all functions
      '@typescript-eslint/explicit-function-return-type': 'warn',

      // CRITICAL: Prevents unused variables/imports
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

      // ========================================================================
      // Code Quality Rules (CRITICAL for Production Code)
      // ========================================================================
      // CRITICAL: Prevents debug console.log() in production
      'no-console': [
        'warn',
        {
          allow: ['warn', 'error'],
        },
      ],

      // CRITICAL: Enforces const for immutable variables
      'prefer-const': 'error',

      // CRITICAL: Bans var keyword
      'no-var': 'error',

      // CRITICAL: Enforces strict equality (===)
      'eqeqeq': ['error', 'always'],

      // ========================================================================
      // React Specific Rules (CRITICAL for React Correctness)
      // ========================================================================
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // ========================================================================
      // Import Organization
      // ========================================================================
      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
    },
  },

  // ============================================================================
  // Test File Overrides (Relaxed Rules for Testing)
  // ============================================================================
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },

  // ============================================================================
  // App/Lib/Components Overrides (Relaxed for Development)
  // ============================================================================
  {
    files: [
      'lib/**/*.ts',
      'lib/**/*.tsx',
      'components/**/*.ts',
      'components/**/*.tsx',
      'app/**/*.ts',
      'app/**/*.tsx',
    ],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      'import/order': 'off',
    },
  },

  // ============================================================================
  // __tests__ Directory (Test Files)
  // ============================================================================
  {
    files: ['__tests__/**/*.ts', '__tests__/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      'no-console': 'off',
    },
  },
];
