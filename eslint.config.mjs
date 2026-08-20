import nextConfig from 'eslint-config-next';

export default [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'dist/**',
      'build/**',
      'seed-code/**',
      'frontend/**',
      '__mocks__/**',
      'coverage/**',
      'money-service/**',
      'operation-service/**',
      'railway-gateway/**',
      'k6-tests/**',
      'davintrade-*/**',
      'backend-stack-*/**',
      'mobile-app/**',
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
    ],
  },
  ...nextConfig,
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/use-memo': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/incompatible-library': 'off',
      'react-hooks/globals': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-render': 'off',
      'react-hooks/unsupported-syntax': 'off',
      'react-hooks/config': 'off',
      'react-hooks/gating': 'off',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: [
      '__tests__/**/*',
      '*.test.ts',
      '*.test.tsx',
      'lib/**/*',
      'components/**/*',
      'app/**/*',
      'hooks/**/*',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off',
      'import/order': 'off',
    },
  },
  // Session 7-2 Step 3: ban direct fetch() calls against microservice URLs
  // outside the sanctioned typed clients. Everything must go through
  // lib/api/generated/ (operationApi/moneyApi) or the raw lib/*-service/
  // client.ts transport those generated clients themselves reuse.
  // lib/status/check-system-status.ts is allowlisted too (Session 7-2
  // Deviation 2, Davin's direction) -- its /health reachability ping is a
  // real, legitimate direct fetch that predates and is unrelated to this
  // rule's concern (un-typed domain calls creeping back in).
  {
    files: ['app/**/*.ts', 'app/**/*.tsx', 'lib/**/*.ts', 'components/**/*.ts', 'components/**/*.tsx', 'hooks/**/*.ts'],
    ignores: [
      'lib/api/generated/**',
      'lib/operation-service/client.ts',
      'lib/money-service/client.ts',
      'lib/status/check-system-status.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.name='fetch'] Identifier[name=/^(OPERATION_SERVICE_URL|MONEY_SERVICE_URL)$/]",
          message:
            'Do not call fetch() directly against microservice URLs. Use createOperationApi()/createMoneyApi() from lib/api/generated/, or the lib/*-service/client.ts transport, instead.',
        },
        {
          selector:
            "CallExpression[callee.name='fetch'] Literal[value=/OPERATION_SERVICE_URL|MONEY_SERVICE_URL|localhost:300[12]/]",
          message:
            'Do not call fetch() directly against microservice URLs. Use createOperationApi()/createMoneyApi() from lib/api/generated/, or the lib/*-service/client.ts transport, instead.',
        },
      ],
    },
  },
];
