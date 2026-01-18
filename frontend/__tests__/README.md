# Integration Tests - Multi-Backend Architecture

Comprehensive integration tests for the Trading Alerts SaaS frontend multi-backend architecture.

## 📋 Architecture Being Tested

```
Frontend (Next.js)
    ↓
    ├─→ Stack A (Railway) ✅ ALLOWED
    │   - User Management
    │   - Authentication
    │   - Subscription & Billing
    │   - Admin Portal
    │   - Affiliate System
    │   - Market Data Gateway (→ Stack C)
    │
    ├─→ Stack B (Railway) ✅ ALLOWED
    │   - Watchlist
    │   - Alerts
    │   - Notifications
    │   - Confluence Scores
    │   - Leader Board
    │   - Market Data Gateway (→ Stack C)
    │
    └─→ Stack C (Contabo VPS) ❌ FORBIDDEN
        - MT5 Market Data Collection
        - Direct MT5 Python API
```

**Key Rules:**
- ✅ Frontend → Stack A (ALLOWED)
- ✅ Frontend → Stack B (ALLOWED)
- ❌ Frontend → Stack C (FORBIDDEN)
- ✅ Stack A → Stack C (ALLOWED - proxy)
- ✅ Stack B → Stack C (ALLOWED - proxy)

---

## 🧪 Test Suites

### 1. **UI → Stack A Tests** (`stack-a.test.ts`)

Tests connection between Frontend and Backend Stack A.

**What it tests:**
- ✅ Connection & health check
- ✅ Authentication (login, register, logout)
- ✅ User management (get user, profile, update)
- ✅ Subscription & billing
- ✅ Admin operations
- ✅ Market data gateway (proxied to Stack C)
- ✅ Rate limiting & performance

**Run:**
```bash
npm test stack-a.test
```

---

### 2. **UI → Stack B Tests** (`stack-b.test.ts`)

Tests connection between Frontend and Backend Stack B.

**What it tests:**
- ✅ Connection & health check
- ✅ Watchlist management (CRUD operations)
- ✅ Alerts system (create, update, delete)
- ✅ Notifications & preferences
- ✅ Market data gateway (proxied to Stack C)
- ✅ Confluence scores & leader board
- ✅ Rate limiting & performance

**Run:**
```bash
npm test stack-b.test
```

---

### 3. **UI → Stack C Forbidden Tests** (`stack-c-forbidden.test.ts`)

Tests that Frontend CANNOT directly access Backend Stack C.

**What it tests:**
- ✅ Direct connection attempts fail
- ✅ Candles endpoint inaccessible
- ✅ Indicators endpoint inaccessible
- ✅ CORS blocks frontend access
- ✅ Environment variables validation
- ✅ Architecture rules documentation

**Run:**
```bash
npm test stack-c-forbidden.test
```

**Expected Result:** All tests should **PASS** by **FAILING** to connect to Stack C.

---

### 4. **UI → Stack A AND B Tests** (`multi-stack.test.ts`)

Tests Frontend accessing BOTH backends simultaneously.

**What it tests:**
- ✅ Concurrent access to both stacks
- ✅ Both stacks can proxy market data from Stack C
- ✅ Data consistency across stacks
- ✅ Load distribution scenarios
- ✅ Failover and redundancy
- ✅ Performance with concurrent operations

**Run:**
```bash
npm test multi-stack.test
```

---

## 🚀 Running Tests

### **Prerequisites:**

1. **Backend Stack A running:**
   ```bash
   # Should be accessible at:
   http://localhost:3001  # or your Stack A URL
   ```

2. **Backend Stack B running:**
   ```bash
   # Should be accessible at:
   http://localhost:3002  # or your Stack B URL
   ```

3. **Environment variables set:**
   ```bash
   # .env.test.local
   NEXT_PUBLIC_API_A_URL=http://localhost:3001
   NEXT_PUBLIC_API_B_URL=http://localhost:3002
   STACK_C_URL=http://localhost:5000  # For validation only
   ```

4. **Test users created:**
   - Free tier user: `test-free@example.com`
   - Pro tier user: `test-pro@example.com`
   - Premium tier user: `test-premium@example.com`

---

### **Run All Integration Tests:**

```bash
npm test -- __tests__/integration
```

---

### **Run Individual Test Suites:**

```bash
# Stack A tests
npm test -- __tests__/integration/stack-a.test.ts

# Stack B tests
npm test -- __tests__/integration/stack-b.test.ts

# Stack C forbidden tests
npm test -- __tests__/integration/stack-c-forbidden.test.ts

# Multi-stack tests
npm test -- __tests__/integration/multi-stack.test.ts
```

---

### **Run with Coverage:**

```bash
npm test -- --coverage __tests__/integration
```

---

### **Run in Watch Mode:**

```bash
npm test -- --watch __tests__/integration
```

---

## 📊 Expected Test Results

### **Successful Test Run:**

```
PASS  __tests__/integration/stack-a.test.ts
  Integration: UI → Stack A
    Connection & Health
      ✓ should be able to connect to Stack A (150ms)
      ✓ should get health status from Stack A (85ms)
    Authentication (Part 3)
      ✓ should register a new user via Stack A (320ms)
      ✓ should login with valid credentials via Stack A (280ms)
      ✓ should reject login with invalid credentials (150ms)
    ... (more tests)

PASS  __tests__/integration/stack-b.test.ts
  Integration: UI → Stack B
    ... (tests)

PASS  __tests__/integration/stack-c-forbidden.test.ts
  Integration: UI → Stack C (FORBIDDEN)
    Security: Stack C Direct Access
      ✓ should NOT be able to connect directly to Stack C (95ms)
      ✓ should fail when trying to fetch from Stack C directly (120ms)
    ... (more tests)

PASS  __tests__/integration/multi-stack.test.ts
  Integration: UI → Stack A AND Stack B (Both)
    ... (tests)

Test Suites: 4 passed, 4 total
Tests:       45 passed, 45 total
Snapshots:   0 total
Time:        25.432 s
```

---

## 🔧 Troubleshooting

### **Backend Not Available:**

```
⚠️ Backend at http://localhost:3001 is not reachable
⚠️ Skipping Stack A integration tests
```

**Solution:**
- Ensure Backend Stack A is running
- Check the URL in environment variables
- Verify network connectivity

---

### **Authentication Errors:**

```
✗ should get current user via Stack A
  User not authenticated - login first (401)
```

**Solution:**
- Run authentication tests first to get a token
- Or manually login before running user-specific tests
- Check that test users exist in the database

---

### **Tier Access Errors:**

```
✗ should get candles from Stack A
  User tier does not have access to XAUUSD H1 (403)
```

**Solution:**
- This is expected! Test user's tier may not have access to premium symbols
- Use symbols appropriate for the test user's tier:
  - Free: EURUSD, GBPUSD
  - Pro: + USDJPY, AUDUSD
  - Premium: + XAUUSD, BTCUSD

---

### **Stack C Tests Passing (Should Fail):**

```
✗ should NOT be able to connect directly to Stack C
  Expected test to fail but it passed
```

**Problem:**
Stack C is accessible from frontend - **this is a security violation!**

**Solution:**
- Check CORS configuration on Stack C
- Ensure Stack C does not have NEXT_PUBLIC_API_C_URL in frontend
- Verify firewall rules block direct frontend access to Stack C

---

## 📝 Test Data Cleanup

The tests use a `TestCleanup` utility to automatically clean up test data after each suite.

**What gets cleaned up:**
- Test watchlist items
- Test alerts
- Test users (if created during tests)

**Manual cleanup (if needed):**
```bash
# Reset test database
npm run db:reset

# Or delete specific test data
npm run cleanup:test-data
```

---

## 🎯 Success Criteria

All tests should **PASS** with the following validations:

✅ **Stack A Connection:** Can connect, authenticate, manage users, handle subscriptions
✅ **Stack B Connection:** Can connect, manage watchlist, create alerts, get analytics
✅ **Stack C Forbidden:** Cannot connect, CORS blocks, no environment variable
✅ **Multi-Stack:** Both stacks accessible, data consistent, failover works
✅ **Architecture:** 2 frontend clients, no Stack C client, both stacks proxy to Stack C

---

## 📈 Adding More Tests

### **Create a New Test Suite:**

```typescript
// __tests__/integration/my-feature.test.ts

import { api } from '@/lib/api-clients';
import { TEST_ENV, checkBackendHealth } from '../utils/test-helpers';

describe('Integration: My Feature', () => {
  beforeAll(async () => {
    const health = await checkBackendHealth(TEST_ENV.STACK_A_URL);
    if (!health.available) {
      console.warn('Stack A not available');
    }
  });

  it('should test my feature', async () => {
    const result = await api.stackA.myFeature();
    expect(result).toBeDefined();
  });
});
```

### **Use Test Helpers:**

```typescript
import {
  generate,
  createTestWatchlistItem,
  createTestAlert,
  TestCleanup,
  assertions,
} from '../utils/test-helpers';

const cleanup = new TestCleanup();

// Generate random test data
const email = generate.email('test');
const symbol = generate.symbol();

// Create test items
const watchlistItem = createTestWatchlistItem('EURUSD', 'H1');
const alert = createTestAlert('GBPUSD', 'H4', 1.2500);

// Register cleanup
cleanup.register(async () => {
  await api.stackB.removeFromWatchlist(item.id);
});

// Use assertions
assertions.isDefined(user);
assertions.hasLength(alerts, 5);
```

---

## 🔍 Continuous Integration

### **GitHub Actions Example:**

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run integration tests
        env:
          NEXT_PUBLIC_API_A_URL: http://localhost:3001
          NEXT_PUBLIC_API_B_URL: http://localhost:3002
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
        run: npm test -- __tests__/integration
```

---

## 📚 Documentation

- **Architecture Guide:** `frontend/FRONTEND-SIMPLIFIED-ARCHITECTURE.md`
- **Implementation Guide:** `frontend/IMPLEMENTATION-COMPLETE.md`
- **API Clients:** `frontend/lib/api-clients/`
- **Test Helpers:** `frontend/__tests__/utils/test-helpers.ts`

---

## ✅ Validation Checklist

Before deploying, ensure all these tests pass:

- [ ] UI → Stack A connection works
- [ ] UI → Stack B connection works
- [ ] UI → Stack C is blocked (forbidden)
- [ ] Both Stack A and B can fetch market data from Stack C
- [ ] Authentication works via Stack A
- [ ] Watchlist operations work via Stack B
- [ ] Alerts operations work via Stack B
- [ ] Multi-stack concurrent operations work
- [ ] Failover between stacks works
- [ ] No NEXT_PUBLIC_API_C_URL in frontend environment

---

**Last Updated:** 2026-01-18
**Architecture:** Simplified 2-Backend (Stack A + Stack B)
**Test Coverage:** 4 test suites, 45+ tests
