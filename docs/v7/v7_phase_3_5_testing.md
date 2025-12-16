# PHASE 3.5: TESTING & QUALITY ASSURANCE

## Trading Alerts SaaS V7 - Complete Testing Implementation

**Timeline:** Week 14-16 (17 hours over 3 weeks)  
**Goal:** Implement comprehensive testing coverage with automated failure protections  
**Automation:** GitHub Actions CI/CD for all testing workflows + PR protections  
**Prerequisites:** Phase 3 complete (all 18 parts built)

---

## ⚡ QUICK REFERENCE: HANDLING TEST FAILURES

### When You Get a Failure Notification:

**1. Quick Commands (GitHub CLI):**

```bash
# View latest failed run
gh run view --log-failed

# Download artifacts
gh run download <run-id>

# Watch current run
gh run watch
```

**2. Aider Prompt Template:**

```
GitHub Actions test failed.

Test: [test name]
File: [file:line]
Error: [error message]
Expected: [value]
Received: [value]

Please fix.
```

**3. Local Verification Checklist:**

```bash
pnpm test              # Must pass ✅
pnpm test:coverage     # Check % ✅
pnpm build             # Must succeed ✅
```

**4. Never Do:**

- ❌ Push without local verification
- ❌ Skip running tests locally
- ❌ Ignore warning signs
- ❌ Commit broken code "temporarily"

**5. Always Do:**

- ✅ Read the full error message
- ✅ Copy exact error text to Aider
- ✅ Verify fix locally before pushing
- ✅ Monitor GitHub Actions after push

---

## 🎯 OVERVIEW

### What This Phase Covers:

| Testing Type            | Coverage                   | Duration | Automation               |
| ----------------------- | -------------------------- | -------- | ------------------------ |
| **Unit Tests**          | Business logic, utilities  | 4 hours  | GitHub Actions           |
| **Component Tests**     | React components           | 3 hours  | GitHub Actions           |
| **API Tests**           | All 42 endpoints           | 4 hours  | GitHub Actions + Postman |
| **Integration Tests**   | End-to-end flows           | 3 hours  | GitHub Actions           |
| **Schema Validation**   | Zod runtime checks         | 2 hours  | GitHub Actions           |
| **Failure Protections** | PR blocking, notifications | 1 hour   | GitHub Settings          |

**Total Time:** 17 hours  
**Your Time:** ~4 hours (setup + review + failure handling)  
**AI Time:** ~13 hours (test writing + configuration)

---

## 📊 CURRENT STATE vs TARGET STATE

### Before Phase 3.5 (Current):

```
✅ TypeScript compilation (static checks)
✅ ESLint code quality (static checks)
✅ Builds successfully (build verification)
✅ Development server runs (smoke tests)
❌ No unit tests
❌ No component tests
❌ No API tests
❌ No integration tests
❌ No automated CI/CD testing
```

### After Phase 3.5 (Target):

```
✅ TypeScript compilation
✅ ESLint code quality
✅ Builds successfully
✅ Development server runs
✅ Unit tests (60%+ coverage)
✅ Component tests (critical components)
✅ API tests (all 42 endpoints)
✅ Integration tests (user flows)
✅ Automated CI/CD testing on every commit
```

---

## 🚀 MILESTONE 3.5.1: UNIT TESTING SETUP

**Duration:** 4 hours  
**Goal:** Test business logic and utility functions  
**Tools:** Jest + TypeScript  
**Coverage Target:** 60%+ on core logic

---

### STEP 1: Install Jest and Dependencies (15 minutes)

**Commands:**

```bash
# Install Jest and TypeScript support
pnpm add -D jest @types/jest ts-jest

# Install Jest environment for Node
pnpm add -D jest-environment-node

# Install testing utilities
pnpm add -D @testing-library/jest-dom
```

**Expected Output:**

```
✅ jest@29.7.0
✅ @types/jest@29.5.12
✅ ts-jest@29.1.2
✅ jest-environment-node@29.7.0
```

---

### STEP 2: Configure Jest (15 minutes)

**Create:** `jest.config.js`

```javascript
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
```

---

**Create:** `jest.setup.js`

```javascript
// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock environment variables
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
```

---

**Update:** `package.json` (add test scripts)

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  }
}
```

---

### STEP 3: Create Test Directory Structure (10 minutes)

```bash
# Create test directories
mkdir -p __tests__/lib
mkdir -p __tests__/app/api
mkdir -p __tests__/components
mkdir -p __tests__/integration
```

**Expected structure:**

```
trading-alerts-saas-v7/
├── __tests__/
│   ├── lib/                 # Unit tests for utilities
│   ├── app/api/             # API route tests
│   ├── components/          # Component tests
│   └── integration/         # Integration tests
├── jest.config.js
├── jest.setup.js
└── package.json
```

---

### STEP 4: Write Core Unit Tests (2 hours)

**Prompt for Aider/Claude Code:**

```
Write unit tests for the following files using Jest:

1. lib/utils.ts
2. lib/tier-validation.ts
3. lib/api-helpers.ts
4. lib/format.ts

Requirements:
- Test all exported functions
- Cover happy path and edge cases
- Test error handling
- Aim for 80%+ coverage per file
- Use descriptive test names

Follow Jest best practices:
- Use describe() blocks for grouping
- Use test() or it() for individual tests
- Use beforeEach() for setup
- Mock external dependencies

Example test structure:
describe('functionName', () => {
  it('should handle normal case', () => {
    expect(result).toBe(expected);
  });

  it('should handle edge case', () => {
    expect(result).toBe(expected);
  });

  it('should throw error for invalid input', () => {
    expect(() => fn()).toThrow();
  });
});
```

---

**Example Test:** `__tests__/lib/utils.test.ts`

```typescript
import { cn, formatCurrency, formatDate } from '@/lib/utils';

describe('cn (className merger)', () => {
  it('should merge class names correctly', () => {
    const result = cn('base-class', 'additional-class');
    expect(result).toContain('base-class');
    expect(result).toContain('additional-class');
  });

  it('should handle conditional classes', () => {
    const result = cn('base', true && 'conditional', false && 'not-included');
    expect(result).toContain('conditional');
    expect(result).not.toContain('not-included');
  });

  it('should handle undefined and null', () => {
    const result = cn('base', undefined, null);
    expect(result).toBe('base');
  });
});

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

  it('should handle large numbers', () => {
    expect(formatCurrency(1000000)).toBe('$1,000,000.00');
  });
});

describe('formatDate', () => {
  it('should format date correctly', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    expect(formatDate(date)).toMatch(/Jan 15, 2024/);
  });

  it('should handle invalid date', () => {
    expect(() => formatDate('invalid')).toThrow();
  });
});
```

---

**Example Test:** `__tests__/lib/tier-validation.test.ts`

```typescript
import {
  validateTierAccess,
  canAccessSymbol,
  getSymbolLimit,
} from '@/lib/tier-validation';

describe('validateTierAccess', () => {
  it('should allow FREE tier to access XAUUSD', () => {
    const result = validateTierAccess('FREE', 'XAUUSD');
    expect(result.allowed).toBe(true);
  });

  it('should block FREE tier from accessing EURUSD', () => {
    const result = validateTierAccess('FREE', 'EURUSD');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('upgrade');
  });

  it('should allow PRO tier to access any symbol', () => {
    expect(validateTierAccess('PRO', 'EURUSD').allowed).toBe(true);
    expect(validateTierAccess('PRO', 'BTCUSD').allowed).toBe(true);
  });

  it('should handle invalid tier', () => {
    expect(() => validateTierAccess('INVALID', 'XAUUSD')).toThrow();
  });
});

describe('canAccessSymbol', () => {
  it('should return true for FREE tier with XAUUSD', () => {
    expect(canAccessSymbol('FREE', 'XAUUSD')).toBe(true);
  });

  it('should return false for FREE tier with other symbols', () => {
    expect(canAccessSymbol('FREE', 'EURUSD')).toBe(false);
  });
});

describe('getSymbolLimit', () => {
  it('should return 1 for FREE tier', () => {
    expect(getSymbolLimit('FREE')).toBe(1);
  });

  it('should return 10 for PRO tier', () => {
    expect(getSymbolLimit('PRO')).toBe(10);
  });
});
```

---

### STEP 5: Run Unit Tests (10 minutes)

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run in watch mode (for development)
pnpm test:watch
```

**Expected Output:**

```
PASS  __tests__/lib/utils.test.ts
PASS  __tests__/lib/tier-validation.test.ts

Test Suites: 2 passed, 2 total
Tests:       15 passed, 15 total
Snapshots:   0 total
Time:        2.5s

Coverage:
--------------------|---------|----------|---------|---------|
File                | % Stmts | % Branch | % Funcs | % Lines |
--------------------|---------|----------|---------|---------|
All files           |   68.5  |   62.3   |   71.2  |   68.5  |
 lib/utils.ts       |   85.7  |   80.0   |   90.0  |   85.7  |
 lib/tier-validation|   72.3  |   65.5   |   75.0  |   72.3  |
--------------------|---------|----------|---------|---------|
```

---

### STEP 6: Commit Unit Tests

```bash
git add __tests__/lib jest.config.js jest.setup.js package.json
git commit -m "test: add unit tests for core utilities and tier validation"
git push
```

---

## ✅ Milestone 3.5.1 Success Criteria:

- ✅ Jest configured correctly
- ✅ Test directory structure created
- ✅ Unit tests for core utilities (60%+ coverage)
- ✅ All tests passing
- ✅ Coverage reports generated
- ✅ Committed to repository

---

## 🎨 MILESTONE 3.5.2: COMPONENT TESTING SETUP

**Duration:** 3 hours  
**Goal:** Test React components  
**Tools:** React Testing Library (RTL)  
**Coverage Target:** Critical user-facing components

---

### STEP 1: Install React Testing Library (10 minutes)

```bash
# Install RTL and dependencies
pnpm add -D @testing-library/react @testing-library/user-event

# Install Next.js testing utilities
pnpm add -D @testing-library/jest-dom
```

---

### STEP 2: Update Jest Configuration (5 minutes)

**Update:** `jest.config.js` (add React environment)

```javascript
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jsdom', // ← Changed from 'jest-environment-node'
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  collectCoverageFrom: [
    'components/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
};

module.exports = createJestConfig(customJestConfig);
```

---

### STEP 3: Write Component Tests (2 hours)

**Prompt for Claude Code:**

```
Write React component tests using React Testing Library for:

1. components/ui/button.tsx
2. components/dashboard/symbol-card.tsx
3. components/watchlist/watchlist-table.tsx
4. components/alerts/alert-form.tsx

Requirements:
- Test component rendering
- Test user interactions (clicks, inputs)
- Test conditional rendering
- Test props variations
- Mock API calls and external dependencies

Follow RTL best practices:
- Query by role, label, or text (not test IDs)
- Use userEvent for interactions
- Test behavior, not implementation
- Async tests for data loading

Example test structure:
describe('ComponentName', () => {
  it('should render correctly', () => {
    render(<Component />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should handle click events', async () => {
    const handleClick = jest.fn();
    render(<Component onClick={handleClick} />);
    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

---

**Example Test:** `__tests__/components/ui/button.test.tsx`

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

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should apply variant styles', () => {
    render(<Button variant="destructive">Delete</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-destructive');
  });

  it('should render with loading state', () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });
});
```

---

**Example Test:** `__tests__/components/dashboard/symbol-card.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { SymbolCard } from '@/components/dashboard/symbol-card';

describe('SymbolCard Component', () => {
  const mockData = {
    symbol: 'XAUUSD',
    price: 2050.50,
    change: 15.25,
    changePercent: 0.75,
  };

  it('should render symbol name', () => {
    render(<SymbolCard {...mockData} />);
    expect(screen.getByText('XAUUSD')).toBeInTheDocument();
  });

  it('should render price correctly', () => {
    render(<SymbolCard {...mockData} />);
    expect(screen.getByText(/2050\.50/)).toBeInTheDocument();
  });

  it('should show positive change in green', () => {
    render(<SymbolCard {...mockData} />);
    const changeElement = screen.getByText(/\+15\.25/);
    expect(changeElement).toHaveClass('text-green-600');
  });

  it('should show negative change in red', () => {
    const negativeData = { ...mockData, change: -10.50, changePercent: -0.51 };
    render(<SymbolCard {...negativeData} />);
    const changeElement = screen.getByText(/-10\.50/);
    expect(changeElement).toHaveClass('text-red-600');
  });

  it('should render loading state', () => {
    render(<SymbolCard {...mockData} loading />);
    expect(screen.getByTestId('skeleton-loader')).toBeInTheDocument();
  });
});
```

---

**Example Test:** `__tests__/components/watchlist/watchlist-table.test.tsx`

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WatchlistTable } from '@/components/watchlist/watchlist-table';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

describe('WatchlistTable Component', () => {
  const mockSymbols = [
    { id: '1', symbol: 'XAUUSD', addedAt: new Date('2024-01-01') },
    { id: '2', symbol: 'EURUSD', addedAt: new Date('2024-01-02') },
  ];

  it('should render symbol list', () => {
    render(<WatchlistTable symbols={mockSymbols} />);
    expect(screen.getByText('XAUUSD')).toBeInTheDocument();
    expect(screen.getByText('EURUSD')).toBeInTheDocument();
  });

  it('should show empty state when no symbols', () => {
    render(<WatchlistTable symbols={[]} />);
    expect(screen.getByText(/no symbols in your watchlist/i)).toBeInTheDocument();
  });

  it('should handle delete action', async () => {
    const handleDelete = jest.fn();
    render(<WatchlistTable symbols={mockSymbols} onDelete={handleDelete} />);

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    await userEvent.click(deleteButtons[0]);

    expect(handleDelete).toHaveBeenCalledWith('1');
  });

  it('should show tier upgrade message for FREE users', () => {
    render(<WatchlistTable symbols={mockSymbols} tier="FREE" />);
    expect(screen.getByText(/upgrade to pro/i)).toBeInTheDocument();
  });

  it('should not show upgrade message for PRO users', () => {
    render(<WatchlistTable symbols={mockSymbols} tier="PRO" />);
    expect(screen.queryByText(/upgrade to pro/i)).not.toBeInTheDocument();
  });
});
```

---

### STEP 4: Run Component Tests (10 minutes)

```bash
# Run all tests (unit + component)
pnpm test

# Run only component tests
pnpm test __tests__/components

# Run with coverage
pnpm test:coverage
```

**Expected Output:**

```
PASS  __tests__/components/ui/button.test.tsx
PASS  __tests__/components/dashboard/symbol-card.test.tsx
PASS  __tests__/components/watchlist/watchlist-table.test.tsx

Test Suites: 5 passed, 5 total
Tests:       28 passed, 28 total
Time:        3.8s

Coverage:
----------------------|---------|----------|---------|---------|
File                  | % Stmts | % Branch | % Funcs | % Lines |
----------------------|---------|----------|---------|---------|
All files             |   65.2  |   61.8   |   68.5  |   65.2  |
 components/ui/       |   82.5  |   78.3   |   85.0  |   82.5  |
 components/dashboard |   71.2  |   68.5   |   72.0  |   71.2  |
----------------------|---------|----------|---------|---------|
```

---

### STEP 5: Commit Component Tests

```bash
git add __tests__/components
git commit -m "test: add component tests for UI and dashboard components"
git push
```

---

## ✅ Milestone 3.5.2 Success Criteria:

- ✅ React Testing Library configured
- ✅ Component tests for critical UI elements
- ✅ All component tests passing
- ✅ Interaction tests working (clicks, inputs)
- ✅ Loading and error states tested
- ✅ Committed to repository

---

## 🌐 MILESTONE 3.5.3: API TESTING SETUP

**Duration:** 4 hours  
**Goal:** Test all 42 API endpoints (38 Next.js + 4 Flask)  
**Tools:** Postman + Newman (CLI) + Jest  
**Coverage Target:** 100% endpoint coverage

---

### STEP 1: Install Newman (10 minutes)

```bash
# Install Newman (Postman CLI)
pnpm add -D newman newman-reporter-htmlextra
```

---

### STEP 2: Create Postman Collections (2 hours)

**Create directory structure:**

```bash
mkdir -p postman/collections
mkdir -p postman/environments
mkdir -p postman/reports
```

---

**Prompt for Claude Code:**

```
Create Postman collections for API testing:

Collections needed:
1. postman/collections/nextjs-api.postman_collection.json (38 endpoints)
2. postman/collections/flask-mt5.postman_collection.json (4 endpoints)

Requirements:
- Test all HTTP methods (GET, POST, PUT, DELETE)
- Include authentication tests
- Test tier restrictions (FREE vs PRO)
- Validate response schemas
- Test error scenarios (401, 403, 404, 500)
- Use environment variables for URLs

Endpoint groups to test:

Next.js API (38 endpoints):
- Authentication: /api/auth/* (5 endpoints)
- User: /api/user/* (6 endpoints)
- Watchlist: /api/watchlist/* (8 endpoints)
- Alerts: /api/alerts/* (7 endpoints)
- Subscription: /api/subscription/* (4 endpoints)
- Payments: /api/payments/* (5 endpoints)
- Admin: /api/admin/* (3 endpoints)

Flask MT5 API (4 endpoints):
- GET /api/indicators/{symbol}/{timeframe}
- GET /api/price/{symbol}
- GET /api/history/{symbol}
- GET /health

Use Postman tests (JavaScript) for validation:
pm.test("Status code is 200", () => {
  pm.response.to.have.status(200);
});

pm.test("Response has correct schema", () => {
  pm.expect(pm.response.json()).to.have.property("data");
});
```

---

**Example Collection:** `postman/collections/nextjs-api.postman_collection.json`

```json
{
  "info": {
    "name": "Trading Alerts SaaS - Next.js API",
    "description": "Complete API test suite for Next.js backend",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000",
      "type": "string"
    }
  ],
  "item": [
    {
      "name": "Authentication",
      "item": [
        {
          "name": "Register - Email/Password",
          "event": [
            {
              "listen": "test",
              "script": {
                "exec": [
                  "pm.test('Status code is 201', () => {",
                  "  pm.response.to.have.status(201);",
                  "});",
                  "",
                  "pm.test('Response has user object', () => {",
                  "  const json = pm.response.json();",
                  "  pm.expect(json).to.have.property('user');",
                  "  pm.expect(json.user).to.have.property('id');",
                  "  pm.expect(json.user).to.have.property('email');",
                  "});",
                  "",
                  "pm.test('Default tier is FREE', () => {",
                  "  const json = pm.response.json();",
                  "  pm.expect(json.user.tier).to.equal('FREE');",
                  "});"
                ],
                "type": "text/javascript"
              }
            }
          ],
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"test@example.com\",\n  \"password\": \"SecurePass123!\",\n  \"name\": \"Test User\"\n}"
            },
            "url": {
              "raw": "{{baseUrl}}/api/auth/register",
              "host": ["{{baseUrl}}"],
              "path": ["api", "auth", "register"]
            }
          }
        },
        {
          "name": "Login - Email/Password",
          "event": [
            {
              "listen": "test",
              "script": {
                "exec": [
                  "pm.test('Status code is 200', () => {",
                  "  pm.response.to.have.status(200);",
                  "});",
                  "",
                  "pm.test('Response has session token', () => {",
                  "  const json = pm.response.json();",
                  "  pm.expect(json).to.have.property('token');",
                  "  pm.collectionVariables.set('authToken', json.token);",
                  "});"
                ],
                "type": "text/javascript"
              }
            }
          ],
          "request": {
            "method": "POST",
            "header": [],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"test@example.com\",\n  \"password\": \"SecurePass123!\"\n}",
              "options": {
                "raw": {
                  "language": "json"
                }
              }
            },
            "url": {
              "raw": "{{baseUrl}}/api/auth/login",
              "host": ["{{baseUrl}}"],
              "path": ["api", "auth", "login"]
            }
          }
        }
      ]
    },
    {
      "name": "Watchlist",
      "item": [
        {
          "name": "Get Watchlist",
          "event": [
            {
              "listen": "test",
              "script": {
                "exec": [
                  "pm.test('Status code is 200', () => {",
                  "  pm.response.to.have.status(200);",
                  "});",
                  "",
                  "pm.test('Response is array', () => {",
                  "  pm.expect(pm.response.json()).to.be.an('array');",
                  "});"
                ],
                "type": "text/javascript"
              }
            }
          ],
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{authToken}}"
              }
            ],
            "url": {
              "raw": "{{baseUrl}}/api/watchlist",
              "host": ["{{baseUrl}}"],
              "path": ["api", "watchlist"]
            }
          }
        },
        {
          "name": "Add Symbol to Watchlist",
          "event": [
            {
              "listen": "test",
              "script": {
                "exec": [
                  "pm.test('Status code is 201', () => {",
                  "  pm.response.to.have.status(201);",
                  "});",
                  "",
                  "pm.test('Symbol added successfully', () => {",
                  "  const json = pm.response.json();",
                  "  pm.expect(json.symbol).to.equal('XAUUSD');",
                  "});"
                ],
                "type": "text/javascript"
              }
            }
          ],
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{authToken}}"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"symbol\": \"XAUUSD\"\n}",
              "options": {
                "raw": {
                  "language": "json"
                }
              }
            },
            "url": {
              "raw": "{{baseUrl}}/api/watchlist",
              "host": ["{{baseUrl}}"],
              "path": ["api", "watchlist"]
            }
          }
        },
        {
          "name": "Tier Restriction - FREE user adds EURUSD",
          "event": [
            {
              "listen": "test",
              "script": {
                "exec": [
                  "pm.test('Status code is 403', () => {",
                  "  pm.response.to.have.status(403);",
                  "});",
                  "",
                  "pm.test('Error message mentions upgrade', () => {",
                  "  const json = pm.response.json();",
                  "  pm.expect(json.error.toLowerCase()).to.include('upgrade');",
                  "});"
                ],
                "type": "text/javascript"
              }
            }
          ],
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{authToken}}"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"symbol\": \"EURUSD\"\n}",
              "options": {
                "raw": {
                  "language": "json"
                }
              }
            },
            "url": {
              "raw": "{{baseUrl}}/api/watchlist",
              "host": ["{{baseUrl}}"],
              "path": ["api", "watchlist"]
            }
          }
        }
      ]
    }
  ]
}
```

---

**Create environment file:** `postman/environments/local.postman_environment.json`

```json
{
  "name": "Local Development",
  "values": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000",
      "enabled": true
    },
    {
      "key": "flaskUrl",
      "value": "http://localhost:5000",
      "enabled": true
    },
    {
      "key": "authToken",
      "value": "",
      "enabled": true
    }
  ]
}
```

---

### STEP 3: Create Newman Test Script (15 minutes)

**Create:** `scripts/api-tests/run-newman.sh`

```bash
#!/bin/bash

echo "🚀 Starting API Tests with Newman..."

# Start Next.js server in background
echo "📦 Starting Next.js server..."
pnpm dev &
NEXT_PID=$!

# Start Flask server in background
echo "📦 Starting Flask server..."
cd mt5-service && python run.py &
FLASK_PID=$!

# Wait for servers to be ready
echo "⏳ Waiting for servers to start..."
sleep 10

# Run Newman tests
echo "🧪 Running Next.js API tests..."
npx newman run postman/collections/nextjs-api.postman_collection.json \
  --environment postman/environments/local.postman_environment.json \
  --reporters cli,htmlextra \
  --reporter-htmlextra-export postman/reports/nextjs-api-report.html

NEXTJS_EXIT=$?

echo "🧪 Running Flask API tests..."
npx newman run postman/collections/flask-mt5.postman_collection.json \
  --environment postman/environments/local.postman_environment.json \
  --reporters cli,htmlextra \
  --reporter-htmlextra-export postman/reports/flask-api-report.html

FLASK_EXIT=$?

# Cleanup: Kill background servers
echo "🧹 Cleaning up servers..."
kill $NEXT_PID $FLASK_PID

# Exit with error if any tests failed
if [ $NEXTJS_EXIT -ne 0 ] || [ $FLASK_EXIT -ne 0 ]; then
  echo "❌ API tests failed!"
  exit 1
else
  echo "✅ All API tests passed!"
  exit 0
fi
```

**Make executable:**

```bash
chmod +x scripts/api-tests/run-newman.sh
```

---

### STEP 4: Add API Test Scripts to package.json (5 minutes)

**Update:** `package.json`

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2",
    "test:api": "sh scripts/api-tests/run-newman.sh",
    "test:api:nextjs": "newman run postman/collections/nextjs-api.postman_collection.json -e postman/environments/local.postman_environment.json",
    "test:api:flask": "newman run postman/collections/flask-mt5.postman_collection.json -e postman/environments/local.postman_environment.json"
  }
}
```

---

### STEP 5: Run API Tests (10 minutes)

```bash
# Ensure servers are running
pnpm dev  # Terminal 1
cd mt5-service && python run.py  # Terminal 2

# Run API tests (Terminal 3)
pnpm test:api
```

**Expected Output:**

```
🚀 Starting API Tests with Newman...
📦 Starting Next.js server...
📦 Starting Flask server...
⏳ Waiting for servers to start...

🧪 Running Next.js API tests...
newman

Trading Alerts SaaS - Next.js API

→ Authentication / Register - Email/Password
  POST http://localhost:3000/api/auth/register [201 Created, 1.2KB, 245ms]
  ✓ Status code is 201
  ✓ Response has user object
  ✓ Default tier is FREE

→ Authentication / Login - Email/Password
  POST http://localhost:3000/api/auth/login [200 OK, 0.8KB, 156ms]
  ✓ Status code is 200
  ✓ Response has session token

→ Watchlist / Get Watchlist
  GET http://localhost:3000/api/watchlist [200 OK, 0.5KB, 89ms]
  ✓ Status code is 200
  ✓ Response is array

... (more tests)

┌─────────────────────────┬────────────┬────────────┐
│                         │   executed │     failed │
├─────────────────────────┼────────────┼────────────┤
│              iterations │          1 │          0 │
├─────────────────────────┼────────────┼────────────┤
│                requests │         38 │          0 │
├─────────────────────────┼────────────┼────────────┤
│            test-scripts │         38 │          0 │
├─────────────────────────┼────────────┼────────────┤
│      prerequest-scripts │          0 │          0 │
├─────────────────────────┼────────────┼────────────┤
│              assertions │        114 │          0 │
└─────────────────────────┴────────────┴────────────┘

✅ All API tests passed!
```

**Reports generated:**

- `postman/reports/nextjs-api-report.html`
- `postman/reports/flask-api-report.html`

---

### STEP 6: Write Jest Integration Tests (1 hour)

**Create:** `__tests__/integration/api-integration.test.ts`

```typescript
import { createMocks } from 'node-mocks-http';
import { GET, POST } from '@/app/api/watchlist/route';
import { prisma } from '@/lib/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    watchlist: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

describe('Watchlist API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/watchlist', () => {
    it('should return watchlist for authenticated user', async () => {
      // Mock user
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        tier: 'FREE',
      });

      // Mock watchlist
      (prisma.watchlist.findMany as jest.Mock).mockResolvedValue([
        { id: '1', symbol: 'XAUUSD', userId: '1' },
      ]);

      const { req } = createMocks({
        method: 'GET',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].symbol).toBe('XAUUSD');
    });

    it('should return 401 for unauthenticated request', async () => {
      const { req } = createMocks({
        method: 'GET',
      });

      const response = await GET(req);
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/watchlist', () => {
    it('should add symbol for FREE tier - XAUUSD only', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: '1',
        tier: 'FREE',
      });

      (prisma.watchlist.create as jest.Mock).mockResolvedValue({
        id: '1',
        symbol: 'XAUUSD',
        userId: '1',
      });

      const { req } = createMocks({
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
        },
        body: {
          symbol: 'XAUUSD',
        },
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.symbol).toBe('XAUUSD');
    });

    it('should reject EURUSD for FREE tier', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: '1',
        tier: 'FREE',
      });

      const { req } = createMocks({
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
        },
        body: {
          symbol: 'EURUSD',
        },
      });

      const response = await POST(req);
      expect(response.status).toBe(403);
    });
  });
});
```

---

### STEP 7: Commit API Tests

```bash
git add postman/ scripts/api-tests __tests__/integration
git commit -m "test: add comprehensive API tests with Postman and Newman"
git push
```

---

## ✅ Milestone 3.5.3 Success Criteria:

- ✅ Newman installed and configured
- ✅ Postman collections for all 42 endpoints
- ✅ Newman test script working
- ✅ All API tests passing (100% endpoint coverage)
- ✅ Jest integration tests for critical flows
- ✅ HTML reports generated
- ✅ Committed to repository

---

## 🔗 MILESTONE 3.5.4: INTEGRATION TESTING

**Duration:** 3 hours  
**Goal:** Test end-to-end user flows  
**Tools:** Jest + Prisma + Mocked APIs  
**Coverage Target:** Critical user journeys

---

### STEP 1: Write Integration Test Suites (2.5 hours)

**Prompt for Claude Code:**

```
Write integration tests for the following user flows:

1. User Registration → Email Verification → Login → Dashboard
2. FREE User: View XAUUSD → Try to add EURUSD → Blocked → Upgrade to PRO
3. PRO User: Add 10 symbols → Create alerts → Receive notifications
4. Subscription: Upgrade to PRO → Payment → Access granted
5. Affiliate: Register → Get referral link → Referred user signs up → Commission earned

Requirements:
- Test complete user journeys (multiple API calls)
- Mock external services (Stripe, email, MT5)
- Test database state changes
- Test tier enforcement throughout flow
- Clean up test data after each test

Use Jest setup/teardown:
beforeAll() - Setup test database
afterEach() - Clean up test data
afterAll() - Teardown test database
```

---

**Example Integration Test:** `__tests__/integration/user-journey.test.ts`

```typescript
import { prisma } from '@/lib/prisma';
import { registerUser, loginUser, getUserProfile } from '@/lib/auth-helpers';
import { addToWatchlist, getWatchlist } from '@/lib/watchlist-helpers';

describe('User Journey: Registration to Dashboard', () => {
  let userId: string;
  let authToken: string;

  afterEach(async () => {
    // Cleanup: Delete test user and related data
    if (userId) {
      await prisma.watchlist.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
  });

  it('should complete full user registration and login flow', async () => {
    // Step 1: User registers
    const registerResult = await registerUser({
      email: 'journey-test@example.com',
      password: 'SecurePass123!',
      name: 'Journey Test User',
    });

    expect(registerResult.success).toBe(true);
    expect(registerResult.user).toBeDefined();
    expect(registerResult.user.tier).toBe('FREE');

    userId = registerResult.user.id;

    // Step 2: User logs in
    const loginResult = await loginUser({
      email: 'journey-test@example.com',
      password: 'SecurePass123!',
    });

    expect(loginResult.success).toBe(true);
    expect(loginResult.token).toBeDefined();

    authToken = loginResult.token;

    // Step 3: Get user profile
    const profile = await getUserProfile(authToken);

    expect(profile.email).toBe('journey-test@example.com');
    expect(profile.tier).toBe('FREE');

    // Step 4: Add symbol to watchlist (FREE tier - only XAUUSD allowed)
    const addResult = await addToWatchlist(authToken, 'XAUUSD');

    expect(addResult.success).toBe(true);
    expect(addResult.symbol).toBe('XAUUSD');

    // Step 5: Verify watchlist
    const watchlist = await getWatchlist(authToken);

    expect(watchlist).toHaveLength(1);
    expect(watchlist[0].symbol).toBe('XAUUSD');
  });
});
```

---

**Example:** `__tests__/integration/tier-enforcement.test.ts`

```typescript
import { prisma } from '@/lib/prisma';
import { registerUser, loginUser } from '@/lib/auth-helpers';
import { addToWatchlist } from '@/lib/watchlist-helpers';
import { upgradeToProTier } from '@/lib/subscription-helpers';

describe('Tier Enforcement Journey', () => {
  let userId: string;
  let authToken: string;

  beforeAll(async () => {
    // Create test user
    const result = await registerUser({
      email: 'tier-test@example.com',
      password: 'SecurePass123!',
      name: 'Tier Test User',
    });

    userId = result.user.id;
    authToken = (
      await loginUser({
        email: 'tier-test@example.com',
        password: 'SecurePass123!',
      })
    ).token;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.watchlist.deleteMany({ where: { userId } });
    await prisma.subscription.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  it('should enforce FREE tier restrictions', async () => {
    // FREE tier can add XAUUSD
    const xauResult = await addToWatchlist(authToken, 'XAUUSD');
    expect(xauResult.success).toBe(true);

    // FREE tier CANNOT add EURUSD
    const eurResult = await addToWatchlist(authToken, 'EURUSD');
    expect(eurResult.success).toBe(false);
    expect(eurResult.error).toContain('upgrade');
  });

  it('should allow PRO tier access after upgrade', async () => {
    // Upgrade to PRO
    const upgradeResult = await upgradeToProTier(authToken, {
      paymentMethod: 'test-card',
    });

    expect(upgradeResult.success).toBe(true);

    // Now PRO tier can add EURUSD
    const eurResult = await addToWatchlist(authToken, 'EURUSD');
    expect(eurResult.success).toBe(true);

    // Verify user tier updated
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    expect(user?.subscription?.tier).toBe('PRO');
  });

  it('should allow PRO tier to add up to 10 symbols', async () => {
    const symbols = [
      'XAUUSD',
      'EURUSD',
      'GBPUSD',
      'USDJPY',
      'AUDUSD',
      'USDCAD',
      'NZDUSD',
      'USDCHF',
      'BTCUSD',
      'ETHUSD',
    ];

    // Add all 10 symbols
    for (const symbol of symbols) {
      const result = await addToWatchlist(authToken, symbol);
      expect(result.success).toBe(true);
    }

    // Verify watchlist count
    const watchlist = await getWatchlist(authToken);
    expect(watchlist).toHaveLength(10);
  });
});
```

---

### STEP 2: Run Integration Tests (10 minutes)

```bash
# Run all integration tests
pnpm test __tests__/integration

# Run with coverage
pnpm test:coverage
```

**Expected Output:**

```
PASS  __tests__/integration/user-journey.test.ts
PASS  __tests__/integration/tier-enforcement.test.ts
PASS  __tests__/integration/subscription-flow.test.ts

Test Suites: 3 passed, 3 total
Tests:       12 passed, 12 total
Time:        5.2s
```

---

### STEP 3: Commit Integration Tests

```bash
git add __tests__/integration
git commit -m "test: add integration tests for user journeys and tier enforcement"
git push
```

---

## ✅ Milestone 3.5.4 Success Criteria:

- ✅ Integration tests for critical user flows
- ✅ Database state verified after operations
- ✅ Tier enforcement tested across flows
- ✅ All integration tests passing
- ✅ Test cleanup working properly
- ✅ Committed to repository

---

## 🔐 MILESTONE 3.5.5: SCHEMA VALIDATION WITH ZOD

**Duration:** 2 hours  
**Goal:** Runtime validation of API requests/responses  
**Tools:** Zod + Jest  
**Coverage Target:** All API schemas validated

---

### STEP 1: Install Zod (5 minutes)

```bash
pnpm add zod
```

---

### STEP 2: Create Zod Schemas (1 hour)

**Create:** `lib/validations/schemas.ts`

```typescript
import { z } from 'zod';

// User schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[a-z]/, 'Password must contain lowercase letter')
    .regex(/[0-9]/, 'Password must contain number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain special character'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Watchlist schemas
export const addWatchlistSchema = z.object({
  symbol: z.enum(
    [
      'XAUUSD',
      'EURUSD',
      'GBPUSD',
      'USDJPY',
      'AUDUSD',
      'USDCAD',
      'NZDUSD',
      'USDCHF',
      'BTCUSD',
      'ETHUSD',
    ],
    {
      errorMap: () => ({ message: 'Invalid trading symbol' }),
    }
  ),
});

export const removeWatchlistSchema = z.object({
  id: z.string().uuid('Invalid watchlist ID'),
});

// Alert schemas
export const createAlertSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required'),
  condition: z.enum(['ABOVE', 'BELOW', 'CROSSES_ABOVE', 'CROSSES_BELOW']),
  targetPrice: z.number().positive('Price must be positive'),
  enabled: z.boolean().default(true),
});

// Subscription schemas
export const upgradeSubscriptionSchema = z.object({
  tier: z.enum(['PRO']),
  paymentMethod: z.string().min(1, 'Payment method required'),
});

// Type exports
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AddWatchlistInput = z.infer<typeof addWatchlistSchema>;
export type CreateAlertInput = z.infer<typeof createAlertSchema>;
export type UpgradeSubscriptionInput = z.infer<
  typeof upgradeSubscriptionSchema
>;
```

---

### STEP 3: Write Zod Validation Tests (30 minutes)

**Create:** `__tests__/lib/validations.test.ts`

```typescript
import {
  registerSchema,
  loginSchema,
  addWatchlistSchema,
  createAlertSchema,
} from '@/lib/validations/schemas';

describe('Zod Schema Validation', () => {
  describe('registerSchema', () => {
    it('should accept valid registration data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: 'Test User',
      };

      const result = registerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidData = {
        email: 'not-an-email',
        password: 'SecurePass123!',
        name: 'Test User',
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('email');
      }
    });

    it('should reject weak password (no uppercase)', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'weakpass123!',
        name: 'Test User',
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('uppercase');
      }
    });

    it('should reject weak password (no special char)', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'SecurePass123',
        name: 'Test User',
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('special character');
      }
    });

    it('should reject short name', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: 'T',
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('2 characters');
      }
    });
  });

  describe('addWatchlistSchema', () => {
    it('should accept valid symbols', () => {
      const validSymbols = ['XAUUSD', 'EURUSD', 'BTCUSD'];

      validSymbols.forEach((symbol) => {
        const result = addWatchlistSchema.safeParse({ symbol });
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid symbol', () => {
      const result = addWatchlistSchema.safeParse({ symbol: 'INVALID' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          'Invalid trading symbol'
        );
      }
    });
  });

  describe('createAlertSchema', () => {
    it('should accept valid alert data', () => {
      const validData = {
        symbol: 'XAUUSD',
        condition: 'ABOVE',
        targetPrice: 2050.5,
        enabled: true,
      };

      const result = createAlertSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject negative price', () => {
      const invalidData = {
        symbol: 'XAUUSD',
        condition: 'ABOVE',
        targetPrice: -100,
        enabled: true,
      };

      const result = createAlertSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('positive');
      }
    });

    it('should reject invalid condition', () => {
      const invalidData = {
        symbol: 'XAUUSD',
        condition: 'INVALID_CONDITION',
        targetPrice: 2050.5,
        enabled: true,
      };

      const result = createAlertSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});
```

---

### STEP 4: Integrate Zod into API Routes (15 minutes)

**Example:** Update `app/api/auth/register/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { registerSchema } from '@/lib/validations/schemas';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate with Zod
    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: validation.error.issues },
        { status: 400 }
      );
    }

    const { email, password, name } = validation.data;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        tier: 'FREE',
      },
    });

    return NextResponse.json(
      { user: { id: user.id, email: user.email, tier: user.tier } },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

### STEP 5: Run Zod Tests (5 minutes)

```bash
pnpm test __tests__/lib/validations.test.ts
```

**Expected Output:**

```
PASS  __tests__/lib/validations.test.ts
  Zod Schema Validation
    registerSchema
      ✓ should accept valid registration data
      ✓ should reject invalid email
      ✓ should reject weak password (no uppercase)
      ✓ should reject weak password (no special char)
      ✓ should reject short name
    addWatchlistSchema
      ✓ should accept valid symbols
      ✓ should reject invalid symbol
    createAlertSchema
      ✓ should accept valid alert data
      ✓ should reject negative price
      ✓ should reject invalid condition

Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
```

---

### STEP 6: Commit Schema Validation

```bash
git add lib/validations __tests__/lib/validations.test.ts
git commit -m "test: add Zod schema validation with comprehensive tests"
git push
```

---

## ✅ Milestone 3.5.5 Success Criteria:

- ✅ Zod installed and configured
- ✅ Schemas defined for all API inputs
- ✅ Zod validation tests passing
- ✅ Schemas integrated into API routes
- ✅ Type-safe validation working
- ✅ Committed to repository

---

## 🤖 MILESTONE 3.5.6: GITHUB ACTIONS CI/CD SETUP

**Duration:** 2 hours  
**Goal:** Automate all tests on every commit  
**Tools:** GitHub Actions  
**Coverage:** Unit, Component, API, Integration tests

---

### STEP 1: Create Test Workflow (30 minutes)

**Create:** `.github/workflows/tests.yml`

```yaml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-and-component-tests:
    name: Unit & Component Tests
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [20.x]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run TypeScript check
        run: npx tsc --noEmit

      - name: Run ESLint
        run: pnpm lint

      - name: Run unit and component tests
        run: pnpm test:ci

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: unittests
          name: codecov-umbrella

  api-tests:
    name: API Tests
    runs-on: ubuntu-latest
    needs: unit-and-component-tests

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: 'pnpm'

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Python dependencies
        run: |
          cd mt5-service
          pip install -r requirements.txt

      - name: Setup database
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db
        run: |
          npx prisma generate
          npx prisma db push

      - name: Start Next.js server
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db
          NEXTAUTH_SECRET: test-secret
          NEXTAUTH_URL: http://localhost:3000
        run: |
          pnpm build
          pnpm start &
          sleep 10

      - name: Start Flask server
        run: |
          cd mt5-service
          python run.py &
          sleep 5

      - name: Run API tests
        run: |
          npx newman run postman/collections/nextjs-api.postman_collection.json \
            --environment postman/environments/ci.postman_environment.json \
            --reporters cli,json \
            --reporter-json-export postman/reports/newman-report.json

      - name: Upload Newman reports
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: newman-reports
          path: postman/reports/

  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    needs: unit-and-component-tests

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Setup database
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db
        run: |
          npx prisma generate
          npx prisma db push

      - name: Run integration tests
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db
        run: pnpm test __tests__/integration --ci

  build-check:
    name: Production Build Check
    runs-on: ubuntu-latest
    needs: [api-tests, integration-tests]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build Next.js
        run: pnpm build

      - name: Check bundle size
        run: |
          du -sh .next/ | awk '{if ($1 ~ /[0-9]+M/ && $1+0 > 10) exit 1}'
```

---

### STEP 2: Create CI Environment File (10 minutes)

**Create:** `postman/environments/ci.postman_environment.json`

```json
{
  "name": "CI Environment",
  "values": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000",
      "enabled": true
    },
    {
      "key": "flaskUrl",
      "value": "http://localhost:5000",
      "enabled": true
    },
    {
      "key": "authToken",
      "value": "",
      "enabled": true
    },
    {
      "key": "testEmail",
      "value": "ci-test@example.com",
      "enabled": true
    }
  ]
}
```

---

### STEP 3: Update Package.json for CI (5 minutes)

**Update:** `package.json`

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2 --silent",
    "test:api": "sh scripts/api-tests/run-newman.sh",
    "test:integration": "jest __tests__/integration --ci"
  }
}
```

---

### STEP 4: Create Test Database Setup Script (15 minutes)

**Create:** `scripts/ci/setup-test-db.sh`

```bash
#!/bin/bash

# Setup test database for CI
export DATABASE_URL="postgresql://test:test@localhost:5432/test_db"

echo "🗄️  Setting up test database..."

# Generate Prisma Client
npx prisma generate

# Push schema to database
npx prisma db push --skip-generate

# Seed test data (optional)
# npx tsx prisma/seed.ts

echo "✅ Test database ready!"
```

**Make executable:**

```bash
chmod +x scripts/ci/setup-test-db.sh
```

---

### STEP 5: Create Test Summary Badge (10 minutes)

**Create:** `.github/workflows/badge.yml`

```yaml
name: Test Coverage Badge

on:
  push:
    branches: [main]

jobs:
  badge:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run tests with coverage
        run: pnpm test:coverage

      - name: Generate coverage badge
        uses: cicirello/jacoco-badge-generator@v2
        with:
          generate-coverage-badge: true
          coverage-badge-filename: coverage.svg
```

---

### STEP 6: Update README with Badges (10 minutes)

**Update:** `README.md` (add badges)

````markdown
# Trading Alerts SaaS V7

![Tests](https://github.com/yourusername/trading-alerts-saas-v7/actions/workflows/tests.yml/badge.svg)
![Coverage](https://codecov.io/gh/yourusername/trading-alerts-saas-v7/branch/main/graph/badge.svg)
![Build](https://github.com/yourusername/trading-alerts-saas-v7/actions/workflows/tests.yml/badge.svg)

## Testing

### Run Tests Locally

```bash
# Unit and component tests
pnpm test

# API tests
pnpm test:api

# Integration tests
pnpm test:integration

# All tests with coverage
pnpm test:coverage
```
````

### CI/CD

All tests run automatically on:

- Push to `main` or `develop`
- Pull requests to `main` or `develop`

Test results: [GitHub Actions](https://github.com/yourusername/trading-alerts-saas-v7/actions)

````

---

### STEP 7: Commit CI/CD Configuration

```bash
git add .github/workflows postman/environments/ci.postman_environment.json scripts/ci
git commit -m "ci: add GitHub Actions workflows for automated testing"
git push
````

**Wait for GitHub Actions to run** (~5-10 minutes)

---

### STEP 8: Verify CI/CD Pipeline (10 minutes)

1. **Go to GitHub Repository**
2. **Click "Actions" tab**
3. **Check workflow runs:**
   - ✅ Unit & Component Tests
   - ✅ API Tests
   - ✅ Integration Tests
   - ✅ Production Build Check

**Expected Result:**

```
✅ Tests workflow passed
  ✅ Unit & Component Tests (28 passed)
  ✅ API Tests (114 assertions passed)
  ✅ Integration Tests (12 passed)
  ✅ Production Build Check (success)
```

---

## ✅ Milestone 3.5.6 Success Criteria:

- ✅ GitHub Actions workflows created
- ✅ All tests run automatically on push/PR
- ✅ Database setup in CI environment
- ✅ API tests run in CI
- ✅ Integration tests run in CI
- ✅ Build verification in CI
- ✅ Coverage reports generated
- ✅ Badges added to README
- ✅ All CI checks passing

---

## 🛡️ MILESTONE 3.5.7: GITHUB ACTIONS FAILURE PROTECTIONS

**Duration:** 1 hour  
**Goal:** Configure PR protections and failure handling  
**Tools:** GitHub Settings + Branch Protection Rules  
**Coverage:** Automatic failure detection and blocking

---

### STEP 1: Configure Branch Protection Rules (15 minutes)

**Navigate to:** Repository Settings → Branches → Add rule

**Branch name pattern:** `main`

**Enable these protections:**

```yaml
✅ Require a pull request before merging
   ✅ Require approvals: 1
   ✅ Dismiss stale pull request approvals when new commits are pushed

✅ Require status checks to pass before merging
   ✅ Require branches to be up to date before merging

   Status checks required:
   ✅ Unit & Component Tests
   ✅ API Tests
   ✅ Integration Tests
   ✅ Production Build Check

✅ Require conversation resolution before merging

✅ Do not allow bypassing the above settings
```

**Result:** PRs cannot merge if any test fails! 🛡️

---

### STEP 2: Set Up Notification Channels (10 minutes)

#### **A. Email Notifications (Default - Already Active)**

GitHub automatically sends emails when:

- ✅ Workflow fails
- ✅ Workflow succeeds after previous failure
- ✅ You're mentioned in PR comments

**Configure:** Settings → Notifications → Actions

```
✅ Send notifications for failed workflows only
✅ Send notifications for workflows you triggered
```

---

#### **B. Slack Notifications (Optional)**

**Add to:** `.github/workflows/tests.yml`

```yaml
jobs:
  notify-on-failure:
    name: Notify Slack on Failure
    runs-on: ubuntu-latest
    if: failure()
    needs: [unit-and-component-tests, api-tests, integration-tests]

    steps:
      - name: Send Slack notification
        uses: slackapi/slack-github-action@v1.24.0
        with:
          payload: |
            {
              "text": "❌ Tests failed on ${{ github.repository }}",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*Tests Failed* :x:\n*Branch:* ${{ github.ref }}\n*Commit:* ${{ github.event.head_commit.message }}\n*Author:* ${{ github.actor }}"
                  }
                },
                {
                  "type": "actions",
                  "elements": [
                    {
                      "type": "button",
                      "text": {
                        "type": "plain_text",
                        "text": "View Logs"
                      },
                      "url": "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
                    }
                  ]
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

### STEP 3: Understanding Failure Behaviors (10 minutes)

**When Tests Fail, GitHub Actions Automatically:**

```
Test Failure Detected
        ↓
┌─────────────────────────────────────────────┐
│ 1. MARKS WORKFLOW AS FAILED ❌              │
│    - Red X appears on commit                │
│    - PR shows "Some checks were not successful" │
└─────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────┐
│ 2. BLOCKS PR MERGE 🛑                       │
│    - "Merge" button disabled                │
│    - Shows "Required checks failing"        │
│    - Cannot bypass (if protection enabled)  │
└─────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────┐
│ 3. SENDS NOTIFICATIONS 📧                   │
│    - Email to commit author                 │
│    - GitHub notification bell               │
│    - Slack/Discord (if configured)          │
└─────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────┐
│ 4. SAVES FAILURE EVIDENCE 💾                │
│    - Full logs preserved (90 days)          │
│    - Test reports as artifacts              │
│    - Coverage reports                       │
│    - Screenshots (if E2E tests)             │
└─────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────┐
│ 5. PREVENTS DEPLOYMENT 🚫                   │
│    - Deploy jobs have needs: [tests]        │
│    - Only run if all tests pass             │
│    - Production stays safe                  │
└─────────────────────────────────────────────┘
```

---

### STEP 4: Accessing Failure Reports (15 minutes)

#### **Method 1: GitHub Web UI (Easiest)**

**Steps:**

1. Go to **Actions** tab in repository
2. Click the **failed workflow run**
3. Click the **failed job** (e.g., "Unit & Component Tests")
4. Scroll through logs to find error

**Example failure view:**

```
❌ Tests  #123  main  2 minutes ago
   └─ Run #123: feat: add new feature

Jobs:
✅ Unit & Component Tests — Passed
❌ API Tests — Failed (click to expand)
✅ Integration Tests — Passed
```

**Clicking "API Tests" shows:**

```bash
Run npx newman run...

newman

Trading Alerts SaaS - Next.js API

→ Watchlist / Add Symbol
  POST http://localhost:3000/api/watchlist [500 Internal Server Error, 0.2KB, 145ms]
  1. Status code is 201
     AssertionError: expected 500 to equal 201
  2. Symbol added successfully
     AssertionError: Cannot read property 'symbol' of undefined

┌─────────────────────────┬────────────┬────────────┐
│                         │   executed │     failed │
├─────────────────────────┼────────────┼────────────┤
│              iterations │          1 │          0 │
├─────────────────────────┼────────────┼────────────┤
│                requests │         38 │          1 │
├─────────────────────────┼────────────┼────────────┤
│            test-scripts │         38 │          0 │
├─────────────────────────┼────────────┼────────────┤
│              assertions │        114 │          2 │
└─────────────────────────┴────────────┴────────────┘

Error: Process completed with exit code 1.
```

---

#### **Method 2: Download Artifacts**

**Steps:**

1. Go to failed workflow run
2. Scroll to **bottom** of page
3. Find **"Artifacts"** section
4. Download available reports:
   - `coverage-report.zip` (HTML coverage)
   - `newman-reports.zip` (API test results)
   - `test-results.zip` (Jest JSON output)

**Open HTML reports** in browser for detailed analysis.

---

#### **Method 3: GitHub CLI (Fastest for Developers)**

**Install GitHub CLI:**

```bash
# Windows (via winget)
winget install GitHub.cli

# macOS
brew install gh

# Authenticate
gh auth login
```

**Quick commands:**

```bash
# View recent runs
gh run list --workflow=tests.yml --limit 5

# View latest failed run
gh run view --log-failed

# Download artifacts
gh run download <run-id>

# Watch current run in real-time
gh run watch

# Re-run failed jobs
gh run rerun <run-id> --failed
```

---

### STEP 5: Fixing Failed Tests with Aider (10 minutes)

**Complete workflow for bringing failure reports to Aider:**

#### **A. Collect Error Information**

From GitHub Actions logs, copy:

1. **Test name** that failed
2. **Error message** (exact text)
3. **File and line number**
4. **Expected vs Received values**
5. **Full stack trace**

**Example to copy:**

```
Test: validateTierAccess › should block FREE tier from accessing EURUSD
File: __tests__/lib/tier-validation.test.ts:20
Error: expect(received).toBe(expected)
Expected: false
Received: true

Stack trace:
  at Object.<anonymous> (__tests__/lib/tier-validation.test.ts:20:28)
```

---

#### **B. Start Aider**

```bash
py -3.11 -m aider --model anthropic/MiniMax-M2
```

---

#### **C. Provide Failure Report to Aider**

**Use this prompt template:**

````
GitHub Actions test failed. Here's the complete failure report:

─────────────────────────────────────────────
TEST FAILURE REPORT
─────────────────────────────────────────────

Test Name: [copy from logs]
File: [copy from logs]
Line: [copy from logs]

Error Message:
[paste exact error message]

Test Code:
```[language]
[paste relevant test code]
````

Expected Behavior:
[describe what should happen]

Actual Behavior:
[describe what actually happened]

Context:
[any additional context from logs]

─────────────────────────────────────────────
ACTION REQUIRED
─────────────────────────────────────────────

Please:

1. Analyze the function being tested
2. Identify why it's failing
3. Fix the logic to match expected behavior
4. Verify fix against all related tests
5. Commit with descriptive message

Investigate and fix this issue.

```

---

#### **D. Aider Fixes Code**

Aider will:
1. ✅ Analyze the failing function
2. ✅ Identify root cause
3. ✅ Implement fix
4. ✅ Run tests locally
5. ✅ Auto-commit with clear message

**Example Aider output:**

```

[Aider - Analyzing test failure]
───────────────────────────────────────────────

📖 Reading:
✓ lib/tier-validation.ts
✓ **tests**/lib/tier-validation.test.ts

🔍 Analysis:
Found the issue in lib/tier-validation.ts line 15

Issue: Function returns `allowed: true` for all cases
Fix: Add proper tier restriction logic

🔧 Fixing...
✅ Fixed in lib/tier-validation.ts

🧪 Running tests locally...
✓ All tests passing!

💾 Committing...
✅ Committed: fix(tier-validation): enforce FREE tier restrictions

````

---

#### **E. Verify Fix Locally (CRITICAL!)**

**NEVER skip this step:**

```bash
# Run the specific failed test
pnpm test __tests__/lib/tier-validation.test.ts

# Run full test suite
pnpm test

# Run with coverage
pnpm test:coverage

# Build check
pnpm build
````

**All must pass before pushing! ✅**

---

#### **F. Push and Monitor**

```bash
# Push fix
git push

# Watch re-run
gh run watch

# Or view in browser
# Go to: https://github.com/YOUR_REPO/actions
```

**Expected result:**

```
✅ Tests  #124  main  Just now
   ✅ Unit & Component Tests
   ✅ API Tests
   ✅ Integration Tests
   ✅ Production Build Check

All checks passed! PR can be merged ✅
```

---

### STEP 6: Common Failure Scenarios (10 minutes)

#### **Scenario 1: Unit Test Failure**

**Symptom:**

```
❌ Unit & Component Tests
   FAIL __tests__/lib/utils.test.ts
   expect(received).toBe(expected)
```

**Aider prompt:**

```
Unit test failed in __tests__/lib/utils.test.ts

Error: formatCurrency returned "100.00 USD" but test expects "USD 100.00"

Please fix lib/utils.ts formatCurrency function to return format "USD X,XXX.XX"
```

---

#### **Scenario 2: API Test Failure**

**Symptom:**

```
❌ API Tests
   Newman: POST /api/watchlist returned 500 instead of 201
```

**Aider prompt:**

```
API test failed. POST /api/watchlist returns 500 error.

Error response from logs:
{
  "error": "Database connection failed",
  "details": "ECONNREFUSED"
}

File: app/api/watchlist/route.ts

Please fix database connection handling and add proper error messages.
```

---

#### **Scenario 3: Integration Test Timeout**

**Symptom:**

```
❌ Integration Tests
   Test timeout: "User can upgrade to PRO" exceeded 5000ms
```

**Aider prompt:**

```
Integration test timeout in __tests__/integration/user-journey.test.ts

Test "User can upgrade to PRO" exceeds 5000ms timeout.

Possible causes:
- Missing await on async function
- Slow database query
- Infinite loop

Please investigate and optimize the upgrade flow.
```

---

#### **Scenario 4: Build Failure**

**Symptom:**

```
❌ Production Build Check
   Error: Cannot find module '@/lib/missing-import'
```

**Aider prompt:**

```
Build failed with missing import error.

File: app/dashboard/page.tsx
Error: Cannot find module '@/lib/missing-import'

Please either:
1. Create the missing file if needed
2. Remove the import if not needed
3. Fix the import path if incorrect
```

---

## ✅ Milestone 3.5.7 Success Criteria:

- ✅ Branch protection rules configured
- ✅ Required status checks enabled
- ✅ PR merge blocked on test failure
- ✅ Notifications configured (email + optional Slack)
- ✅ Failure access methods documented
- ✅ Aider fix workflow established
- ✅ Common scenarios documented
- ✅ Team trained on failure handling

---

## 📊 PHASE 3.5 COMPLETION CHECKLIST

### Testing Coverage:

- ✅ **Unit Tests** (60%+ coverage)
  - lib/utils.ts
  - lib/tier-validation.ts
  - lib/api-helpers.ts
  - lib/format.ts

- ✅ **Component Tests**
  - components/ui/button.tsx
  - components/dashboard/symbol-card.tsx
  - components/watchlist/watchlist-table.tsx
  - components/alerts/alert-form.tsx

- ✅ **API Tests** (100% endpoint coverage)
  - All 38 Next.js endpoints
  - All 4 Flask endpoints
  - Postman collections complete
  - Newman CLI tests passing

- ✅ **Integration Tests**
  - User registration flow
  - Tier enforcement
  - Subscription upgrade
  - Affiliate program

- ✅ **Schema Validation**
  - Zod schemas for all inputs
  - Runtime validation working
  - Type-safe API routes

### Automation:

- ✅ **GitHub Actions**
  - Unit tests on every push
  - Component tests on every push
  - API tests on every push
  - Integration tests on every push
  - Build verification on every push
  - Coverage reports generated

### Failure Protections:

- ✅ **Branch Protection Rules**
  - Required status checks configured
  - PR merge blocked on test failure
  - Cannot bypass protections

- ✅ **Notifications**
  - Email alerts on failure
  - GitHub notifications
  - Optional Slack integration

- ✅ **Failure Handling**
  - Access methods documented
  - Aider fix workflow established
  - Common scenarios documented
  - Artifact downloads configured

### Documentation:

- ✅ **README Updated**
  - Test badges added
  - Test commands documented
  - CI/CD process explained
  - Failure handling workflow documented

### Files Created:

```
📦 trading-alerts-saas-v7/
├── __tests__/
│   ├── lib/
│   │   ├── utils.test.ts
│   │   ├── tier-validation.test.ts
│   │   └── validations.test.ts
│   ├── components/
│   │   ├── ui/button.test.tsx
│   │   ├── dashboard/symbol-card.test.tsx
│   │   └── watchlist/watchlist-table.test.tsx
│   ├── integration/
│   │   ├── user-journey.test.ts
│   │   ├── tier-enforcement.test.ts
│   │   └── api-integration.test.ts
├── .github/
│   └── workflows/
│       ├── tests.yml
│       └── badge.yml
├── postman/
│   ├── collections/
│   │   ├── nextjs-api.postman_collection.json
│   │   └── flask-mt5.postman_collection.json
│   ├── environments/
│   │   ├── local.postman_environment.json
│   │   └── ci.postman_environment.json
│   └── reports/
├── scripts/
│   ├── api-tests/
│   │   └── run-newman.sh
│   └── ci/
│       └── setup-test-db.sh
├── lib/
│   └── validations/
│       └── schemas.ts
├── jest.config.js
├── jest.setup.js
└── README.md (updated)
```

---

## 🔄 COMPLETE FAILURE → FIX → SUCCESS WORKFLOW

**When GitHub Actions Tests Fail:**

```
┌──────────────────────────────────────────────────┐
│ FAILURE DETECTED                                 │
│ Email: "Tests failed on main"                    │
│ GitHub: Red X on commit                          │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│ STEP 1: ACCESS LOGS (2 minutes)                  │
│ • Go to GitHub Actions tab                       │
│ • Click failed workflow                          │
│ • View failed job logs                           │
│ • Download artifacts (if needed)                 │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│ STEP 2: COLLECT ERROR INFO (2 minutes)           │
│ Copy from logs:                                  │
│ • Test name that failed                          │
│ • Error message (exact text)                     │
│ • File and line number                           │
│ • Expected vs Received values                    │
│ • Stack trace                                    │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│ STEP 3: START AIDER (1 minute)                   │
│ py -3.11 -m aider --model anthropic/MiniMax-M2   │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│ STEP 4: PROVIDE FAILURE REPORT (2 minutes)       │
│ Use prompt template:                             │
│                                                  │
│ "GitHub Actions test failed. Here's the report: │
│                                                  │
│ Test Name: [paste]                               │
│ File: [paste]                                    │
│ Error: [paste]                                   │
│                                                  │
│ Please analyze and fix."                         │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│ STEP 5: AIDER FIXES CODE (5-10 minutes)          │
│ Aider automatically:                             │
│ • Analyzes failing function                      │
│ • Identifies root cause                          │
│ • Implements fix                                 │
│ • Runs tests locally                             │
│ • Commits with clear message                     │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│ STEP 6: VERIFY LOCALLY (3 minutes) ⚠️ CRITICAL   │
│ NEVER skip this step:                            │
│ • pnpm test (must pass)                          │
│ • pnpm test:coverage (check %)                   │
│ • pnpm build (must succeed)                      │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│ STEP 7: PUSH FIX (1 minute)                      │
│ git push                                         │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│ STEP 8: GITHUB ACTIONS RE-RUNS (5-10 minutes)    │
│ • Automatically triggered by push                │
│ • Runs all test suites                           │
│ • Generates new reports                          │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│ STEP 9: VERIFY SUCCESS ✅                        │
│ • All checks passed                              │
│ • Green checkmark on commit                      │
│ • PR can be merged                               │
│ • Deploy can proceed                             │
└──────────────────────────────────────────────────┘
```

**Total Time to Fix:** 15-20 minutes per failure  
**Prevents:** Hours of debugging in production  
**Success Rate:** 95%+ (with proper verification)

---

## 🎯 READY FOR PHASE 4: DEPLOYMENT

### Pre-Deployment Verification:

```bash
# Run full test suite
pnpm test:coverage

# Run API tests
pnpm test:api

# Run integration tests
pnpm test:integration

# Build for production
pnpm build

# Check GitHub Actions
# All workflows should be green ✅
```

### Success Criteria for Phase 4 Readiness:

- ✅ All unit tests passing (60%+ coverage)
- ✅ All component tests passing
- ✅ All API tests passing (100% endpoints)
- ✅ All integration tests passing
- ✅ Schema validation working
- ✅ GitHub Actions all green
- ✅ Production build succeeds
- ✅ Bundle size < 10MB
- ✅ No TypeScript errors
- ✅ No ESLint errors

**If all checked ✅ → READY FOR PHASE 4 DEPLOYMENT!** 🚀

---

## 📈 TESTING METRICS

### Time Investment:

| Milestone         | Setup      | Writing Tests | Running Tests | Total       |
| ----------------- | ---------- | ------------- | ------------- | ----------- |
| 3.5.1 Unit        | 30 min     | 2h            | 10 min        | 2h 40m      |
| 3.5.2 Component   | 15 min     | 2h            | 10 min        | 2h 25m      |
| 3.5.3 API         | 20 min     | 2h            | 10 min        | 2h 30m      |
| 3.5.4 Integration | 0 min      | 2h 30m        | 10 min        | 2h 40m      |
| 3.5.5 Schema      | 5 min      | 1h 30m        | 5 min         | 1h 40m      |
| 3.5.6 CI/CD       | 30 min     | 1h            | 10 min        | 1h 40m      |
| 3.5.7 Protections | 15 min     | 30 min        | 15 min        | 1h          |
| **TOTAL**         | **1h 55m** | **11h 30m**   | **1h 10m**    | **14h 35m** |

**Your Active Time:** ~4-5 hours (setup + review + configuration)  
**AI Time:** ~10 hours (writing tests)  
**Handling Failures:** ~15 minutes per failure (estimate 3-5 failures during setup)

### Coverage Achieved:

- **Unit Tests:** 60%+ (core utilities and business logic)
- **Component Tests:** 100% (critical UI components)
- **API Tests:** 100% (all 42 endpoints)
- **Integration Tests:** 100% (critical user flows)
- **Schema Validation:** 100% (all API inputs)
- **Failure Protection:** 100% (all safeguards configured)

### ROI (Return on Investment):

**Time Invested:** 17 hours (including protections setup)  
**Bugs Caught Early:** Estimated 50-100 bugs  
**Debug Time Saved:** Estimated 40-60 hours  
**Production Issues Prevented:** Estimated 20-30 incidents  
**Customer Support Saved:** Estimated 100+ support tickets  
**Bad Commits Blocked:** Estimated 10-20 broken commits prevented

**Net Time Saved:** 70+ hours  
**Quality Improvement:** 80%+ bug reduction  
**Deploy Confidence:** 95%+ (from automated verification)

---

## 🔧 TROUBLESHOOTING

### Common Issues:

**Issue 1: Jest tests fail to import Next.js modules**

**Solution:**

```javascript
// Update jest.config.js
const nextJest = require('next/jest');
const createJestConfig = nextJest({ dir: './' });
```

**Issue 2: Newman cannot find collections**

**Solution:**

```bash
# Verify file paths
ls postman/collections/
# Should show .postman_collection.json files

# Use absolute paths in scripts
$(pwd)/postman/collections/nextjs-api.postman_collection.json
```

**Issue 3: GitHub Actions fails on database setup**

**Solution:**

```yaml
# Add health check to postgres service
services:
  postgres:
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

**Issue 4: Tests pass locally but fail in CI**

**Solution:**

```bash
# Run tests in CI mode locally
pnpm test:ci

# Check environment variables
# Ensure .env.test exists with test database URL
```

---

## 📚 ADDITIONAL RESOURCES

### Documentation:

- Jest: https://jestjs.io/docs/getting-started
- React Testing Library: https://testing-library.com/docs/react-testing-library/intro/
- Newman: https://learning.postman.com/docs/running-collections/using-newman-cli/
- Zod: https://zod.dev/
- GitHub Actions: https://docs.github.com/en/actions

### Best Practices:

- Write tests that test behavior, not implementation
- Mock external dependencies
- Use descriptive test names
- Clean up test data after each test
- Aim for 60%+ coverage on critical code
- Run tests before every commit

---

**Document Version:** 2.0  
**Last Updated:** 2025-11-24  
**Status:** ✅ Production Ready  
**Next Phase:** Phase 4 - Deployment  
**New in v2.0:** Complete GitHub Actions failure protection and handling workflow (Milestone 3.5.7)
