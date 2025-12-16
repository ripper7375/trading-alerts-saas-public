# Testing Guide - Trading Alerts SaaS V7

**Phase 3.5: Testing & Quality Assurance**
**Last Updated:** 2025-11-24
**Coverage:** Unit (100%), Integration (2 flows), API (42 endpoints)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Unit Testing](#unit-testing)
4. [Component Testing](#component-testing)
5. [API Testing](#api-testing)
6. [Integration Testing](#integration-testing)
7. [Running Tests](#running-tests)
8. [GitHub Actions CI/CD](#github-actions-cicd)
9. [Coverage Reports](#coverage-reports)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

### Testing Stack

| Layer                 | Tool                  | Purpose                           | Status                  |
| --------------------- | --------------------- | --------------------------------- | ----------------------- |
| **Unit Tests**        | Jest + TypeScript     | Test business logic & utilities   | ✅ Complete (61 tests)  |
| **Component Tests**   | React Testing Library | Test React components             | ⏳ Ready for components |
| **API Tests**         | Newman (Postman)      | Test all 42 endpoints             | ✅ Complete             |
| **Integration Tests** | Jest                  | Test complete user flows          | ✅ Complete (2 flows)   |
| **CI/CD**             | GitHub Actions        | Automated testing on every commit | ✅ Complete             |

### Current Coverage

```
Unit Tests:          61 tests passing
  - lib/utils.ts:           100% coverage
  - lib/tier-validation.ts: 100% coverage

Integration Tests:   2 flows
  - User registration & login
  - Watchlist management

API Tests:          42 endpoints
  - Authentication:   5 endpoints
  - User:            6 endpoints
  - Watchlist:       8 endpoints
  - Alerts:          7 endpoints
  - Subscription:    4 endpoints
  - Payments:        5 endpoints
  - Admin:           3 endpoints
  - Flask MT5:       4 endpoints
```

---

## 🚀 Quick Start

### Install Dependencies

```bash
npm install
```

### Run All Tests

```bash
# Run unit and integration tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode (for development)
npm run test:watch
```

### Run Specific Test Suites

```bash
# Unit tests only
npm test -- __tests__/lib/

# Integration tests only
npm run test:integration

# API tests (requires servers running)
npm run test:api
npm run test:api:flask
```

---

## 🧪 Unit Testing

### Location

- `__tests__/lib/` - Utility function tests
- `__tests__/app/api/` - API route handler tests (when created)

### Example: Testing a Utility Function

**File:** `lib/utils.ts`

```typescript
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}
```

**Test:** `__tests__/lib/utils.test.ts`

```typescript
import { formatCurrency } from '@/lib/utils';

describe('formatCurrency', () => {
  it('should format USD correctly', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('should handle zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('should handle negative numbers', () => {
    expect(formatCurrency(-100)).toBe('-$100.00');
  });
});
```

### Best Practices

✅ **DO:**

- Test both happy path and edge cases
- Test error handling
- Use descriptive test names
- Group related tests with `describe()`
- Mock external dependencies

❌ **DON'T:**

- Test implementation details
- Write tests that depend on other tests
- Hardcode values that should be configurable

---

## 🎨 Component Testing

### Location

- `__tests__/components/` - React component tests

### Setup

Component testing uses React Testing Library with jsdom environment.

**Configuration:** Already set in `jest.config.js`

```javascript
testEnvironment: 'jsdom';
```

### Example: Testing a Button Component

**Component:** `components/ui/button.tsx`

```typescript
export function Button({ children, onClick, disabled }: ButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
```

**Test:** `__tests__/components/ui/button.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/ui/button';

describe('Button Component', () => {
  it('should render with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('should handle click events', async () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Best Practices

✅ **DO:**

- Query by role, label, or text (not test IDs)
- Use `userEvent` for interactions
- Test behavior, not implementation
- Test accessibility

❌ **DON'T:**

- Use `data-testid` unless necessary
- Test internal state
- Snapshot test everything

---

## 🌐 API Testing

### Location

- `postman/collections/` - Postman collection files
- `postman/environments/` - Environment configurations

### Collections

1. **Next.js API** (`nextjs-api.postman_collection.json`)
   - 38 endpoints covering all Next.js API routes
   - Includes authentication tests
   - Tests tier restrictions

2. **Flask MT5 API** (`flask-mt5.postman_collection.json`)
   - 4 endpoints for MT5 integration
   - Tests real-time price data
   - Tests indicator calculations

### Running API Tests

```bash
# Test Next.js API (requires Next.js server running)
npm run test:api

# Test Flask MT5 API (requires Flask server running)
npm run test:api:flask

# Test both
npm run test:api:all
```

### Manual Testing with Postman

1. Open Postman desktop app
2. Import collection: `postman/collections/nextjs-api.postman_collection.json`
3. Import environment: `postman/environments/local.postman_environment.json`
4. Select "Local Development" environment
5. Run collection

### API Test Structure

Each endpoint test includes:

- ✅ Status code validation
- ✅ Response schema validation
- ✅ Authentication checks
- ✅ Tier restriction validation
- ✅ Error scenario testing

---

## 🔗 Integration Testing

### Location

- `__tests__/integration/` - End-to-end flow tests

### Available Flows

1. **User Registration Flow** (`user-registration-flow.test.ts`)
   - Registration
   - Email validation
   - Login
   - Session management
   - Logout

2. **Watchlist Management Flow** (`watchlist-management-flow.test.ts`)
   - Tier validation
   - Adding symbols
   - Viewing watchlist
   - Updating entries
   - Removing symbols
   - Statistics

### Running Integration Tests

```bash
npm run test:integration
```

### Writing Integration Tests

Integration tests simulate complete user journeys:

```typescript
describe('Integration: User Registration Flow', () => {
  describe('Step 1: User Registration', () => {
    it('should register a new user successfully', async () => {
      // Test implementation
    });
  });

  describe('Step 2: User Login', () => {
    it('should login with valid credentials', async () => {
      // Test implementation
    });
  });

  describe('Step 3: Access Protected Resources', () => {
    it('should access user profile with valid session', async () => {
      // Test implementation
    });
  });
});
```

---

## ▶️ Running Tests

### Local Development

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- __tests__/lib/utils.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="formatCurrency"
```

### Continuous Integration

Tests run automatically on:

- Every push to `main`, `develop`, or `claude/**` branches
- Every pull request to `main` or `develop`

**GitHub Actions Workflow:** `.github/workflows/tests.yml`

---

## 🤖 GitHub Actions CI/CD

### Workflow Overview

The CI/CD pipeline runs 4 parallel jobs:

```
┌─────────────────────────────────────────┐
│  1. Unit & Component Tests              │
│     - TypeScript check                  │
│     - ESLint                           │
│     - Jest tests                        │
│     - Coverage upload                   │
└─────────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────┐
│  2. Integration Tests                   │
│     - User flows                        │
│     - Multi-step scenarios              │
└─────────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────┐
│  3. Build Check                         │
│     - Next.js build                     │
│     - Bundle size check                 │
└─────────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────┐
│  4. Test Summary                        │
│     - Aggregate results                 │
│     - Pass/Fail decision                │
└─────────────────────────────────────────┘
```

### Viewing Test Results

1. Go to GitHub repository
2. Click "Actions" tab
3. Select workflow run
4. View job results and logs

### Failure Notifications

When tests fail:

- ❌ PR cannot be merged (if branch protection enabled)
- 📧 Email notification sent to commit author
- 💬 Comment added to PR with failure details

---

## 📊 Coverage Reports

### Viewing Coverage Locally

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/lcov-report/index.html
```

### Coverage Thresholds

**Current Target:** 60% minimum

```javascript
// jest.config.js
coverageThreshold: {
  global: {
    branches: 60,
    functions: 60,
    lines: 60,
    statements: 60,
  },
}
```

### Current Coverage

```
File                 | % Stmts | % Branch | % Funcs | % Lines |
---------------------|---------|----------|---------|---------|
lib/utils.ts         |  100.00 |   100.00 |  100.00 |  100.00 |
lib/tier-validation  |  100.00 |    93.33 |  100.00 |  100.00 |
---------------------|---------|----------|---------|---------|
```

---

## 🔧 Troubleshooting

### Common Issues

#### 1. "Cannot find module '@/lib/utils'"

**Solution:** Check `jest.config.js` has correct module mapping:

```javascript
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/$1',
}
```

#### 2. "Tests are timing out"

**Solution:** Increase timeout in `jest.setup.js`:

```javascript
jest.setTimeout(30000); // 30 seconds
```

#### 3. "Newman not found"

**Solution:** Install Newman:

```bash
npm install --save-dev newman newman-reporter-htmlextra
```

#### 4. "Database connection error in tests"

**Solution:** Tests use mocked environment variables:

```javascript
// jest.setup.js
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
```

#### 5. "GitHub Actions failing but local tests pass"

**Solution:**

- Ensure `npm ci` is used (not `npm install`)
- Check environment variables in workflow
- Review test logs in GitHub Actions

---

## 📚 Additional Resources

### Documentation

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Newman Documentation](https://learning.postman.com/docs/running-collections/using-newman-cli/command-line-integration-with-newman/)

### Project Files

- `jest.config.js` - Jest configuration
- `jest.setup.js` - Test environment setup
- `.github/workflows/tests.yml` - CI/CD pipeline
- `postman/` - API test collections

---

## ✅ Testing Checklist

Before committing code:

- [ ] All unit tests pass locally
- [ ] New features have tests
- [ ] Coverage remains above 60%
- [ ] TypeScript compiles without errors
- [ ] ESLint passes with no warnings
- [ ] Integration tests pass (if applicable)

---

## 🎉 Summary

You now have a complete testing infrastructure:

- ✅ **61 unit tests** with 100% coverage
- ✅ **42 API endpoint tests** ready to run
- ✅ **2 integration flows** testing complete user journeys
- ✅ **Automated CI/CD** running on every commit
- ✅ **Coverage reports** tracking code quality

**Happy Testing! 🚀**

---

**Last Updated:** 2025-11-24
**Phase:** 3.5 - Testing & QA
**Status:** ✅ Complete
