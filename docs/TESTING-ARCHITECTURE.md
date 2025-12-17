# Testing Architecture Documentation

**Trading Alerts SaaS V7**
**Last Updated:** December 2024
**Purpose:** Reference document for testing architecture design used in Phase 1 Testing Framework

---

## Table of Contents

1. [Overview](#overview)
2. [Testing Pyramid](#testing-pyramid)
3. [Unit Testing Architecture](#unit-testing-architecture)
4. [Integration Testing Architecture](#integration-testing-architecture)
5. [E2E Testing Architecture](#e2e-testing-architecture)
6. [Coverage Strategy](#coverage-strategy)
7. [Test File Organization](#test-file-organization)
8. [Mocking Patterns](#mocking-patterns)
9. [Running Tests](#running-tests)
10. [Scaling Guidelines](#scaling-guidelines)

---

## Overview

This document describes the testing architecture implemented for Trading Alerts SaaS V7 following the Phase 1 Testing Framework defined in `testing-and-ui-development-framework/Claude Code Operation to Phase 1.png`.

### Testing Framework Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Test Runner | Jest 29.x | Execute tests, collect coverage |
| Assertion Library | Jest + @testing-library/jest-dom | Assertions and DOM matchers |
| Component Testing | @testing-library/react | React component rendering |
| User Events | @testing-library/user-event | Simulate user interactions |
| API Testing | Newman (Postman) | API endpoint validation |
| Environment | jsdom | Browser environment simulation |

### Architecture Philosophy

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TESTING PYRAMID                               │
│                                                                      │
│                           ┌─────────┐                               │
│                           │   E2E   │  ← Slowest, Most Integration  │
│                          ─┴─────────┴─                              │
│                         ┌─────────────┐                             │
│                         │ Integration │  ← Cross-component flows    │
│                        ─┴─────────────┴─                            │
│                       ┌─────────────────┐                           │
│                       │   Unit Tests    │  ← Fast, Isolated         │
│                      ─┴─────────────────┴─                          │
│                                                                      │
│  Unit > Integration > E2E (by quantity)                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Testing Pyramid

### Layer 1: Unit Tests (Primary Focus - Steps 1-6)

**What:** Test individual functions, modules, and components in isolation.

**Characteristics:**
- Fast execution (< 100ms per test)
- No external dependencies (mocked)
- High coverage, low cost
- Run on every commit

**Coverage Target:**
- Tier 1 (Critical): 25% minimum
- Tier 2 (Feature): 10% minimum
- Tier 3 (Utility): 2% minimum

### Layer 2: Integration Tests (Step 7)

**What:** Test interactions between multiple components/services.

**Characteristics:**
- Medium execution time
- Some mocking, some real integration
- Tests workflows and data flow
- Run on PR merge

### Layer 3: E2E Tests (Step 8 - Future)

**What:** Test complete user journeys through the application.

**Characteristics:**
- Slowest execution
- Real browser, real database
- Critical user paths only
- Run before deployment

---

## Unit Testing Architecture

### Directory Structure

```
__tests__/
├── api/                          # API Route Tests
│   ├── admin.test.ts            # Admin API (Path K)
│   ├── alerts.test.ts           # Alerts API (Path F)
│   ├── indicators.test.ts       # Indicators API (Path G)
│   ├── notifications.test.ts    # Notifications API (Path F)
│   ├── tier.test.ts             # Tier API (Path C)
│   └── watchlist.test.ts        # Watchlist API (Path H)
│
├── components/                   # Component Tests
│   └── ui/                      # UI Components (Path J)
│       ├── button.test.tsx
│       └── card.test.tsx
│
├── hooks/                        # React Hooks Tests
│   ├── use-toast.test.ts
│   └── use-websocket.test.ts
│
├── lib/                          # Library Tests
│   ├── api/
│   │   └── mt5-client.test.ts   # MT5 Integration (Path E)
│   ├── auth/                    # Auth Tests (Path A)
│   │   ├── errors.test.ts
│   │   ├── permissions.test.ts
│   │   └── session.test.ts
│   ├── db/                      # Database Tests (Path D)
│   │   ├── prisma.test.ts
│   │   └── seed.test.ts
│   ├── jobs/
│   │   └── alert-checker.test.ts # Alerts (Path F)
│   ├── stripe/                  # Billing Tests (Path B)
│   │   ├── stripe.test.ts
│   │   └── webhook-handlers.test.ts
│   ├── tier-config.test.ts      # Tier Tests (Path C)
│   ├── tier-helpers.test.ts
│   ├── tier-validation.test.ts
│   └── utils.test.ts
│
├── types/                        # Type Tests (Path I)
│   └── types.test.ts
│
└── integration/                  # Integration Tests (Step 7)
    ├── tier1-workflows.test.ts
    ├── tier2-workflows.test.ts
    ├── user-registration-flow.test.ts
    └── watchlist-management-flow.test.ts
```

### Path Coverage Mapping

| Path | Target | Files Covered | Test Files |
|------|--------|---------------|------------|
| A (Auth) | 25% | `lib/auth/*` | `errors.test.ts`, `permissions.test.ts`, `session.test.ts` |
| B (Billing) | 25% | `lib/stripe/*` | `stripe.test.ts`, `webhook-handlers.test.ts` |
| C (Tier) | 25% | `lib/tier*` | `tier-config.test.ts`, `tier-helpers.test.ts`, `tier-validation.test.ts`, `tier.test.ts` |
| D (Database) | 25% | `lib/db/*` | `prisma.test.ts`, `seed.test.ts` |
| E (MT5) | 10% | `lib/api/*` | `mt5-client.test.ts` |
| F (Alerts) | 10% | `lib/jobs/*`, `app/api/alerts/*`, `app/api/notifications/*` | `alert-checker.test.ts`, `alerts.test.ts`, `notifications.test.ts` |
| G (Indicators) | 10% | `app/api/indicators/*` | `indicators.test.ts` |
| H (Watchlist) | 10% | `app/api/watchlist/*` | `watchlist.test.ts` |
| I (Types) | 2% | `types/*` | `types.test.ts` |
| J (UI) | 2% | `components/ui/*` | `button.test.tsx`, `card.test.tsx` |
| K (Admin) | 2% | `app/api/admin/*` | `admin.test.ts` |

### Unit Test Pattern: API Routes

```typescript
/**
 * API Route Test Template
 * File: __tests__/api/{endpoint}.test.ts
 */

// 1. Mock dependencies
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: mockPrisma,
}));

jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: jest.fn(),
}));

// 2. Create mock request/response helpers
class MockRequest {
  url: string;
  method: string;
  headers: Map<string, string>;
  private body: string | null;

  constructor(url: string, init?: RequestInit) {
    this.url = url;
    this.method = init?.method || 'GET';
    this.headers = new Map(Object.entries(init?.headers || {}));
    this.body = init?.body as string || null;
  }

  async json() {
    return JSON.parse(this.body || '{}');
  }
}

// 3. Test structure
describe('API Route: /api/{endpoint}', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 if not authenticated', async () => {
      // Test unauthenticated access
    });
  });

  describe('GET /{endpoint}', () => {
    it('should return data for authenticated user', async () => {
      // Test successful GET
    });
  });

  describe('POST /{endpoint}', () => {
    it('should create resource with valid data', async () => {
      // Test successful POST
    });

    it('should return 400 for invalid data', async () => {
      // Test validation
    });
  });
});
```

### Unit Test Pattern: Library Functions

```typescript
/**
 * Library Function Test Template
 * File: __tests__/lib/{module}.test.ts
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock external dependencies
jest.mock('external-library', () => ({
  someFunction: jest.fn(),
}));

describe('Module: {moduleName}', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  describe('functionName', () => {
    it('should handle normal input', () => {
      const result = functionName('input');
      expect(result).toBe('expected');
    });

    it('should handle edge cases', () => {
      expect(() => functionName(null)).toThrow();
    });

    it('should handle async operations', async () => {
      const result = await asyncFunction();
      expect(result).toMatchObject({ key: 'value' });
    });
  });
});
```

### Unit Test Pattern: React Components

```typescript
/**
 * React Component Test Template
 * File: __tests__/components/{component}.test.tsx
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, jest } from '@jest/globals';
import { ComponentName } from '@/components/path/ComponentName';

describe('Component: ComponentName', () => {
  describe('rendering', () => {
    it('should render with default props', () => {
      render(<ComponentName />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should render with custom className', () => {
      render(<ComponentName className="custom" />);
      expect(screen.getByRole('button')).toHaveClass('custom');
    });
  });

  describe('interactions', () => {
    it('should call onClick when clicked', async () => {
      const handleClick = jest.fn();
      render(<ComponentName onClick={handleClick} />);

      await userEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<ComponentName aria-label="Action" />);
      expect(screen.getByLabelText('Action')).toBeInTheDocument();
    });
  });
});
```

---

## Integration Testing Architecture

### Purpose

Integration tests verify that multiple components work together correctly. They test:
- Data flow between services
- API endpoint chains
- Authentication + Authorization flows
- Cross-feature interactions

### Implementation Status

| Test Suite | Status | Coverage |
|------------|--------|----------|
| Tier 1 Workflows | ✅ Implemented | Auth + Billing + Tier flows |
| Tier 2 Workflows | ✅ Implemented | MT5 + Alerts + Watchlist flows |
| User Registration | ✅ Implemented | Complete signup flow |
| Watchlist Management | ✅ Implemented | CRUD + tier validation |

### Integration Test Pattern

```typescript
/**
 * Integration Test Template
 * File: __tests__/integration/{workflow}.test.ts
 */

describe('Integration: {Workflow Name}', () => {
  // Setup shared mocks for multiple components
  beforeAll(() => {
    // Initialize test database/mocks
  });

  afterAll(() => {
    // Cleanup
  });

  describe('Complete Workflow', () => {
    it('should complete full user journey', async () => {
      // Step 1: User action
      const step1Result = await firstAction();
      expect(step1Result).toBeDefined();

      // Step 2: System response triggers next component
      const step2Result = await secondAction(step1Result.id);
      expect(step2Result.status).toBe('processed');

      // Step 3: Verify final state
      const finalState = await getFinalState();
      expect(finalState).toMatchObject({
        step1Complete: true,
        step2Complete: true,
      });
    });
  });

  describe('Error Handling Across Components', () => {
    it('should rollback on failure', async () => {
      // Test error propagation between components
    });
  });
});
```

### Current Integration Test Suites

#### 1. Tier 1 Workflows (`tier1-workflows.test.ts`)
- Authentication flow validation
- Billing webhook processing
- Tier upgrade/downgrade flows
- Permission enforcement

#### 2. Tier 2 Workflows (`tier2-workflows.test.ts`)
- MT5 data fetching with tier validation
- Alert creation and triggering
- Watchlist management with symbols
- Cross-feature data consistency

---

## E2E Testing Architecture

### Status: Planned (Step 8)

E2E tests are designed but not yet implemented. They will use:

### Recommended Stack

| Tool | Purpose |
|------|---------|
| Playwright | Browser automation |
| Test containers | Database isolation |
| MSW | API mocking when needed |

### Planned E2E Test Suites

```
e2e/
├── auth/
│   ├── login.spec.ts           # Login flow
│   ├── register.spec.ts        # Registration flow
│   └── password-reset.spec.ts  # Password reset
│
├── billing/
│   ├── subscription.spec.ts    # Subscribe/cancel
│   └── payment.spec.ts         # Payment processing
│
├── features/
│   ├── alerts.spec.ts          # Alert CRUD
│   ├── watchlist.spec.ts       # Watchlist management
│   └── charts.spec.ts          # Chart interactions
│
└── critical-paths/
    ├── new-user-journey.spec.ts
    └── upgrade-path.spec.ts
```

### E2E Test Pattern (Future)

```typescript
/**
 * E2E Test Template (Playwright)
 * File: e2e/{feature}.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Feature: User Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should allow user to login', async ({ page }) => {
    // Navigate to login
    await page.click('[data-testid="login-button"]');

    // Fill credentials
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password123');

    // Submit
    await page.click('[type="submit"]');

    // Verify redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });
});
```

---

## Coverage Strategy

### Global Thresholds (jest.config.js)

```javascript
coverageThreshold: {
  global: {
    statements: 18,  // Minimum 18% statement coverage
    branches: 10,    // Minimum 10% branch coverage
    functions: 15,   // Minimum 15% function coverage
    lines: 18,       // Minimum 18% line coverage
  },
},
```

### Path-Specific Targets

| Tier | Paths | Target | Rationale |
|------|-------|--------|-----------|
| 1 (Critical) | A, B, C, D | 25% | Core business logic, security |
| 2 (Feature) | E, F, G, H | 10% | User-facing features |
| 3 (Utility) | I, J, K | 2% | Support code, UI primitives |

### Checking Coverage

```bash
# Quick coverage check
npm run test:coverage

# Full report with path analysis
npm run coverage:full

# View detailed report
npm run coverage:report
```

---

## Test File Organization

### Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Unit Tests | `{module}.test.ts` | `stripe.test.ts` |
| Component Tests | `{Component}.test.tsx` | `button.test.tsx` |
| Integration Tests | `{workflow}-flow.test.ts` | `user-registration-flow.test.ts` |
| E2E Tests | `{feature}.spec.ts` | `login.spec.ts` |

### File Location Rules

1. **Mirror source structure**: `lib/auth/session.ts` → `__tests__/lib/auth/session.test.ts`
2. **Group by feature for integration**: `__tests__/integration/{feature}-flow.test.ts`
3. **Separate E2E directory**: `e2e/{feature}.spec.ts`

---

## Mocking Patterns

### 1. Prisma Client Mocking

```typescript
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  // ... other models
};

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: mockPrisma,
}));
```

### 2. Next-Auth Mocking

```typescript
jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: jest.fn(),
}));

// In tests:
(getServerSession as jest.Mock).mockResolvedValue({
  user: { id: 'user-123', email: 'test@example.com', tier: 'PRO' },
});
```

### 3. External API Mocking (fetch)

```typescript
global.fetch = jest.fn().mockImplementation((url) => {
  if (url.includes('/api/data')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ data: 'mocked' }),
    });
  }
  return Promise.reject(new Error('Unknown URL'));
});
```

### 4. AbortSignal.timeout Polyfill

```typescript
// Required for Jest environment
if (!AbortSignal.timeout) {
  AbortSignal.timeout = (ms: number) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  };
}
```

---

## Running Tests

### Available Commands

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- path/to/test.ts

# Run tests matching pattern
npm test -- --testNamePattern="should authenticate"

# Run in watch mode
npm run test:watch

# Run integration tests only
npm run test:integration

# Generate coverage report
npm run coverage:report

# Full coverage with report
npm run coverage:full

# Run CI tests (parallel, silent)
npm run test:ci
```

### CI/CD Integration

```yaml
# Example GitHub Actions workflow
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:ci
      - run: npm run coverage:report
```

---

## Scaling Guidelines

### When Adding New Features

1. **Create unit tests first** (TDD recommended)
2. **Follow path mapping** - place tests in correct directory
3. **Maintain coverage** - new code should have tests
4. **Update integration tests** if feature affects workflows

### When Scaling to More Tests

1. **Parallelize** - Jest runs tests in parallel by default
2. **Split large suites** - Keep test files focused (< 500 lines)
3. **Use test.each** - For parameterized tests
4. **Cache dependencies** - Use jest-haste-map effectively

### Coverage Maintenance

1. **Monitor coverage:report** after each PR
2. **Block merges** if coverage drops below thresholds
3. **Update thresholds** as coverage improves
4. **Focus on critical paths** for new tests

---

## Quick Reference

### Test Command Cheatsheet

| Command | Purpose |
|---------|---------|
| `npm test` | Run all tests |
| `npm run test:coverage` | Run with coverage |
| `npm run coverage:report` | View coverage by path |
| `npm run coverage:full` | Tests + report |
| `npm run test:watch` | Watch mode |
| `npm run test:integration` | Integration only |

### File Location Reference

| What to Test | Where to Put Test |
|--------------|-------------------|
| API route | `__tests__/api/{route}.test.ts` |
| Library function | `__tests__/lib/{module}.test.ts` |
| React component | `__tests__/components/{path}/{Component}.test.tsx` |
| Hook | `__tests__/hooks/{hook}.test.ts` |
| Integration flow | `__tests__/integration/{flow}.test.ts` |
| E2E scenario | `e2e/{feature}.spec.ts` |

---

**Document Version:** 1.0
**Maintained By:** Development Team
**Related Docs:**
- `testing-and-ui-development-framework/phase1-testing-prompt.md`
- `testing-and-ui-development-framework/Claude Code Operation to Phase 1.png`
- `jest.config.js`
- `scripts/check-coverage.js`
