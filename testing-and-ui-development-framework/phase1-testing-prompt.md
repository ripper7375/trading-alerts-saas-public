# Phase 1: Comprehensive Testing for Existing Parts 1-15

## Context & Mission

You are tasked with implementing comprehensive Jest testing for **existing code** (Parts 1-15) in the Trading Alerts SaaS V7 platform. The current test coverage is **~2%**, which is critically insufficient, especially for money-handling and authentication systems.

**Your mission:** Achieve tier-appropriate test coverage across existing parts by following a structured 6-step methodology.

---

## Current State

- ✅ **Parts 1-15 are built and functional** (code exists in repository)
- ❌ **Test coverage is ~2%** (critically low)
- ⏸️ **Parts 16-18 not built yet** (skip these for now)

**Repository:** https://github.com/ripper7375/trading-alerts-saas-v7

---

## Testing Strategy Overview

### Coverage Targets by Tier

| Tier                  | Coverage Target | Parts to Test             | Priority   |
| --------------------- | --------------- | ------------------------- | ---------- |
| **Tier 1 (Critical)** | **25% minimum** | Parts 2, 4, 5, 12         | 🔴 HIGHEST |
| **Tier 2 (Feature)**  | **10% minimum** | Parts 6, 7, 9, 10, 11, 15 | 🟡 MEDIUM  |
| **Tier 3 (Utility)**  | **2% minimum**  | Parts 1, 3, 8, 13, 14     | 🟢 LOW     |

---

## 6-Step Testing Methodology

Execute these steps systematically for each tier:

### **Step 1: Tier Identification**

Classify parts into appropriate tiers based on criticality:

**Tier 1 (Critical - Money/Auth):**

- Part 2: Database (Prisma schema, user/subscription models)
- Part 4: Tier System (FREE/PRO access control)
- Part 5: Authentication (NextAuth.js, session management)
- Part 12: E-commerce & Billing (Stripe integration, webhooks)

**Tier 2 (Feature - Core Value):**

- Part 6: Flask MT5 Service (MetaTrader 5 integration)
- Part 7: Indicators API (Technical indicators)
- Part 9: Charts & Visualization (Trading charts)
- Part 10: Watchlist System (Symbol tracking)
- Part 11: Alerts System (Price alerts)
- Part 15: Notifications & Real-time (WebSocket, notifications)

**Tier 3 (Utility - UI/Admin):**

- Part 1: Foundation (Project setup, dependencies)
- Part 3: Types (TypeScript definitions)
- Part 8: Dashboard & Layout (UI structure)
- Part 13: Settings System (User preferences)
- Part 14: Admin Dashboard (Admin tools)

---

### **Step 2: Paths and Files Identification**

For each tier, identify critical paths and their files:

#### **Tier 1: Critical Paths**

**Path A: Authentication Flow**

```
lib/auth/*
app/api/auth/[...nextauth]/route.ts
middleware.ts (route protection)
```

**Path B: Money & Billing Flow**

```
lib/stripe/stripe.ts
lib/stripe/webhook-handlers.ts
app/api/checkout/route.ts
app/api/subscription/route.ts
app/api/subscription/cancel/route.ts
app/api/webhooks/stripe/route.ts
app/api/invoices/route.ts
```

**Path C: Tier & Access Control**

```
lib/tier-limits.ts
lib/access-control.ts (if exists)
Prisma schema validation for tier field
```

**Path D: Database Layer**

```
prisma/schema.prisma (validation)
Any database utility functions in lib/db/*
```

#### **Tier 2: Feature Paths**

**Path E: MT5 Integration**

```
lib/mt5/* (Flask service client)
app/api/mt5/* (API routes)
```

**Path F: Alerts & Notifications**

```
lib/alerts/*
app/api/alerts/*
lib/notifications/*
app/api/notifications/*
hooks/use-websocket.ts
lib/websocket/server.ts
```

**Path G: Charts & Indicators**

```
lib/indicators/*
app/api/indicators/*
components/charts/* (logic only, not UI rendering)
```

**Path H: Watchlist**

```
lib/watchlist/* (if exists)
app/api/watchlist/*
```

#### **Tier 3: Utility Paths**

**Path I: TypeScript Types**

```
types/* (type validation tests)
```

**Path J: UI Components & Layout**

```
components/ui/* (basic smoke tests)
app/(dashboard)/layout.tsx (rendering test)
```

**Path K: Admin Tools**

```
app/api/admin/* (access control tests)
```

---

### **Step 3: Create Tests for Existing Code**

Write Jest tests for identified paths. Focus on:

#### **Testing Priorities:**

**For Tier 1 (25% target):**

- ✅ **Happy path:** Core functionality works
- ✅ **Critical failures:** Payment fails, auth rejects invalid tokens
- ✅ **Edge cases:** Duplicate subscriptions, expired sessions
- ⏸️ **Skip:** Extensive mocking of third-party services (keep tests simple)

**For Tier 2 (10% target):**

- ✅ **Happy path only:** Basic feature works
- ⏸️ **Skip:** Edge cases, error scenarios (defer to post-MVP)

**For Tier 3 (2% target):**

- ✅ **Smoke tests only:** Component renders, types are valid
- ⏸️ **Skip:** Detailed UI testing, visual regression

#### **Example Test Structure:**

```typescript
// __tests__/lib/stripe/stripe.test.ts
import { createCheckoutSession, cancelSubscription } from '@/lib/stripe/stripe';

describe('Stripe Integration', () => {
  describe('createCheckoutSession', () => {
    it('should create session with correct PRO price', async () => {
      const userId = 'test-user-123';
      const session = await createCheckoutSession(userId, 'PRO');

      expect(session).toBeDefined();
      expect(session.amount_total).toBe(2900); // $29.00
      expect(session.mode).toBe('subscription');
    });

    it('should reject if user is already PRO', async () => {
      const userId = 'pro-user-123'; // Assume this user is PRO

      await expect(createCheckoutSession(userId, 'PRO')).rejects.toThrow(
        'User already has PRO subscription'
      );
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel active subscription', async () => {
      const userId = 'pro-user-123';
      const result = await cancelSubscription(userId);

      expect(result.success).toBe(true);
      expect(result.tier).toBe('FREE');
    });
  });
});
```

```typescript
// __tests__/lib/auth/session.test.ts
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

describe('Authentication', () => {
  it('should return session for authenticated user', async () => {
    // Mock authenticated request
    const session = await getServerSession(authOptions);

    expect(session).toBeDefined();
    expect(session?.user?.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });

  it('should return null for unauthenticated user', async () => {
    // Mock unauthenticated request
    const session = await getServerSession(authOptions);

    expect(session).toBeNull();
  });
});
```

```typescript
// __tests__/api/alerts/route.test.ts
import { GET, POST } from '@/app/api/alerts/route';
import { NextRequest } from 'next/server';

describe('Alerts API', () => {
  it('GET should return user alerts', async () => {
    const request = new NextRequest('http://localhost:3000/api/alerts');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data.alerts)).toBe(true);
  });

  it('POST should create new alert', async () => {
    const request = new NextRequest('http://localhost:3000/api/alerts', {
      method: 'POST',
      body: JSON.stringify({
        symbol: 'EURUSD',
        condition: 'above',
        price: 1.1,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.alert).toBeDefined();
    expect(data.alert.symbol).toBe('EURUSD');
  });
});
```

---

### **Step 4: Run Tests Against Existing Code**

Execute tests to identify code quality:

```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run specific test suite
npm run test __tests__/lib/stripe/stripe.test.ts
```

**Expected Outcomes:**

✅ **Tests PASS:**

- Code works correctly
- Move to next file/path
- Document passing tests

❌ **Tests FAIL:**

- Investigate why (Step 5a or 5b)

---

### **Step 5a: Fix Code (If Tests Reveal Bugs)**

**ONLY modify code if tests reveal actual bugs or for better testability.**

#### **Scenario 1: Tests Reveal Actual Bugs**

```typescript
// Test fails
it('should send notification on payment failure', async () => {
  const result = await handleFailedPayment('user-123');
  expect(result.notificationSent).toBe(true); // ❌ FAILS
});

// Bug found: Missing notification logic
// Fix: lib/stripe/webhook-handlers.ts
export async function handleFailedPayment(userId: string) {
  // ... existing code ...

  // ✅ ADD: Send notification
  await sendNotification(userId, {
    type: 'payment_failed',
    message: 'Your payment failed. Please update payment method.',
  });

  return { success: true, notificationSent: true };
}
```

#### **Scenario 2: Refactoring for Better Testability**

```typescript
// Before: Hard to test (tightly coupled)
export async function processPayment(userId: string) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!); // ❌ Can't mock
  // ...
}

// After: Easy to test (dependency injection)
export async function processPayment(
  userId: string,
  stripeClient: Stripe = getStripeClient() // ✅ Can mock in tests
) {
  // ...
}
```

**CRITICAL:** Only refactor if:

- Tests are impossible to write otherwise
- Code quality improves significantly
- Tests remain green after refactoring

---

### **Step 5b: Fix Tests (If Tests Are Wrong)**

Sometimes the **test itself** is incorrect, not the code:

```typescript
// ❌ WRONG: Hardcoded expectation
it('should return user email', async () => {
  const user = await getUser('user-123');
  expect(user.email).toBe('test@example.com'); // Hardcoded
});

// ✅ CORRECT: Validates behavior
it('should return user email', async () => {
  const user = await getUser('user-123');
  expect(user.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  expect(typeof user.email).toBe('string');
});
```

```typescript
// ❌ WRONG: Testing implementation details
it('should use bcrypt with 10 rounds', async () => {
  const hash = await hashPassword('password123');
  expect(hash).toContain('$2b$10$'); // Testing internal implementation
});

// ✅ CORRECT: Testing public behavior
it('should hash passwords securely', async () => {
  const hash = await hashPassword('password123');
  expect(await verifyPassword('password123', hash)).toBe(true);
  expect(await verifyPassword('wrongpassword', hash)).toBe(false);
});
```

---

### **Step 6: Achieve Coverage Target**

Iterate Steps 3-5 until coverage thresholds are met:

```bash
npm run test:coverage
```

**Check coverage report:**

```
-------------------|---------|----------|---------|---------|
File               | % Stmts | % Branch | % Funcs | % Lines |
-------------------|---------|----------|---------|---------|
Tier 1 (Critical)  |   28.5  |   25.2   |   30.1  |   27.8  | ✅
Tier 2 (Feature)   |   12.3  |   10.5   |   11.8  |   12.1  | ✅
Tier 3 (Utility)   |    3.2  |    2.8   |    2.5  |    3.1  | ✅
-------------------|---------|----------|---------|---------|
```

**Update `jest.config.js` with final thresholds:**

```javascript
// jest.config.js
module.exports = {
  // ... existing config ...
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      statements: 15, // Average across all tiers
      branches: 12,
      functions: 15,
      lines: 15,
    },
    // Tier 1: Critical paths (stricter)
    './lib/stripe/**/*.ts': {
      statements: 25,
      branches: 20,
      functions: 25,
      lines: 25,
    },
    './lib/auth/**/*.ts': {
      statements: 25,
      branches: 20,
      functions: 25,
      lines: 25,
    },
    './app/api/checkout/**/*.ts': {
      statements: 25,
      branches: 20,
      functions: 25,
      lines: 25,
    },
    './app/api/webhooks/stripe/**/*.ts': {
      statements: 25,
      branches: 20,
      functions: 25,
      lines: 25,
    },
    // Tier 2: Feature paths (moderate)
    './lib/alerts/**/*.ts': {
      statements: 10,
      branches: 8,
      functions: 10,
      lines: 10,
    },
    './lib/notifications/**/*.ts': {
      statements: 10,
      branches: 8,
      functions: 10,
      lines: 10,
    },
    // Tier 3: Utility (minimal)
    './components/ui/**/*.tsx': {
      statements: 2,
      branches: 1,
      functions: 2,
      lines: 2,
    },
  },
};
```

---

## Execution Checklist

Use this checklist to track progress:

### **Tier 1: Critical (25% coverage minimum)**

- [ ] **Path A: Authentication**
  - [ ] Tests for `lib/auth/*`
  - [ ] Tests for `app/api/auth/[...nextauth]/route.ts`
  - [ ] Tests for `middleware.ts`
  - [ ] Coverage: 25%+ achieved

- [ ] **Path B: Money & Billing**
  - [ ] Tests for `lib/stripe/stripe.ts`
  - [ ] Tests for `lib/stripe/webhook-handlers.ts`
  - [ ] Tests for `app/api/checkout/route.ts`
  - [ ] Tests for `app/api/subscription/route.ts`
  - [ ] Tests for `app/api/webhooks/stripe/route.ts`
  - [ ] Coverage: 25%+ achieved

- [ ] **Path C: Tier System**
  - [ ] Tests for tier validation logic
  - [ ] Tests for access control
  - [ ] Coverage: 25%+ achieved

- [ ] **Path D: Database**
  - [ ] Schema validation tests
  - [ ] Database utility function tests
  - [ ] Coverage: 25%+ achieved

### **Tier 2: Feature (10% coverage minimum)**

- [ ] **Path E: MT5 Integration**
  - [ ] Tests for `lib/mt5/*`
  - [ ] Tests for `app/api/mt5/*`
  - [ ] Coverage: 10%+ achieved

- [ ] **Path F: Alerts & Notifications**
  - [ ] Tests for `lib/alerts/*`
  - [ ] Tests for `app/api/alerts/*`
  - [ ] Tests for `lib/notifications/*`
  - [ ] Tests for `hooks/use-websocket.ts`
  - [ ] Coverage: 10%+ achieved

- [ ] **Path G: Charts & Indicators**
  - [ ] Tests for `lib/indicators/*`
  - [ ] Tests for `app/api/indicators/*`
  - [ ] Coverage: 10%+ achieved

- [ ] **Path H: Watchlist**
  - [ ] Tests for watchlist API
  - [ ] Coverage: 10%+ achieved

### **Tier 3: Utility (2% coverage minimum)**

- [ ] **Path I: Types**
  - [ ] Basic type validation tests
  - [ ] Coverage: 2%+ achieved

- [ ] **Path J: UI Components**
  - [ ] Smoke tests for components
  - [ ] Coverage: 2%+ achieved

- [ ] **Path K: Admin**
  - [ ] Basic admin access tests
  - [ ] Coverage: 2%+ achieved

---

## Constraints & Guidelines

### **DO:**

- ✅ Test **public API behavior**, not implementation details
- ✅ Use **realistic test data** (e.g., valid Stripe webhook payloads)
- ✅ Mock **external services** (Stripe API, database in some cases)
- ✅ Write **clear test descriptions** (it should read like documentation)
- ✅ Focus on **critical paths first** (Tier 1 → Tier 2 → Tier 3)
- ✅ Fix **actual bugs** revealed by tests
- ✅ Refactor **only for testability** when necessary

### **DON'T:**

- ❌ Aim for 100% coverage (diminishing returns)
- ❌ Test implementation details (e.g., internal function calls)
- ❌ Write tests that always pass (dummy tests)
- ❌ Modify working code unnecessarily
- ❌ Over-mock (keep tests realistic)
- ❌ Test UI rendering extensively (Tier 3 is low priority)
- ❌ Create new features (only test existing code)

---

## Deliverables

Upon completion, provide:

1. **Test files** in `__tests__/` directory matching source structure
2. **Coverage report** showing tier-specific coverage
3. **Updated `jest.config.js`** with appropriate thresholds
4. **Bug fixes** (if any) for issues revealed by tests
5. **Refactored code** (if necessary for testability)
6. **Summary report** listing:
   - Total tests created
   - Coverage achieved per tier
   - Bugs found and fixed
   - Code refactored (with justification)

---

## Success Criteria

✅ **Phase 1 Complete When:**

- Tier 1 (Parts 2, 4, 5, 12): **≥25% coverage**
- Tier 2 (Parts 6, 7, 9, 10, 11, 15): **≥10% coverage**
- Tier 3 (Parts 1, 3, 8, 13, 14): **≥2% coverage**
- All tests passing
- CI/CD pipeline succeeds with new coverage thresholds
- No critical bugs remaining in Tier 1 paths

---

## Notes for Claude Code

- **Current coverage is ~2%** - you're building from near zero
- **Focus on Tier 1 first** - money and auth bugs are catastrophic
- **Use existing test patterns** in `__tests__/hooks/` as reference
- **Leverage Prisma's testing utilities** for database tests
- **Mock Stripe API** using `stripe-mock` or similar
- **Keep tests fast** - use `jest.mock()` for external services
- **Document any bugs found** in code comments before fixing

---

---

## Step 7: Integration Testing (Critical Addition)

**CRITICAL:** Unit tests alone are insufficient. Integration tests validate that **entire workflows** function correctly across multiple components.

### **Why Integration Tests Are Essential**

Unit tests verify individual functions work, but **don't catch:**

- ❌ Stripe webhook updates database but middleware still blocks PRO access
- ❌ Alert creation succeeds but notification never sends
- ❌ User logs in but session doesn't persist across requests
- ❌ Payment succeeds but email confirmation fails

**Integration tests catch these cross-component failures.**

---

### **5 Critical Integration Test Paths (Must Implement)**

#### **Integration Path 1: Complete Authentication Flow (Tier 1)**

**Test the entire auth journey from registration to logout.**

```typescript
// __tests__/integration/auth-flow.test.ts
import { signIn, signOut } from 'next-auth/react';

describe('Integration: Authentication Flow', () => {
  it('should complete full authentication cycle', async () => {
    // 1. REGISTER: Create new user
    const signupRes = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'integration-test@example.com',
        password: 'SecurePass123!',
        name: 'Test User',
      }),
    });

    expect(signupRes.status).toBe(201);
    const { userId } = await signupRes.json();
    expect(userId).toBeDefined();

    // 2. LOGIN: Authenticate user
    const loginResult = await signIn('credentials', {
      email: 'integration-test@example.com',
      password: 'SecurePass123!',
      redirect: false,
    });

    expect(loginResult?.ok).toBe(true);
    expect(loginResult?.error).toBeNull();

    // 3. ACCESS PROTECTED ROUTE: Verify session works
    const protectedRes = await fetch('/api/alerts', {
      headers: {
        cookie: loginResult?.session?.cookie || '',
      },
    });

    expect(protectedRes.status).toBe(200);

    // 4. VERIFY USER DATA: Check database state
    const userRes = await fetch('/api/user/profile');
    const userData = await userRes.json();
    expect(userData.email).toBe('integration-test@example.com');
    expect(userData.tier).toBe('FREE'); // New users start as FREE

    // 5. LOGOUT: End session
    await signOut({ redirect: false });

    // 6. VERIFY PROTECTION: Ensure protected routes now blocked
    const afterLogoutRes = await fetch('/api/alerts');
    expect(afterLogoutRes.status).toBe(401);
  });

  it('should prevent access with invalid credentials', async () => {
    const loginResult = await signIn('credentials', {
      email: 'invalid@example.com',
      password: 'WrongPassword',
      redirect: false,
    });

    expect(loginResult?.ok).toBe(false);
    expect(loginResult?.error).toBe('Invalid credentials');
  });
});
```

---

#### **Integration Path 2: Payment to PRO Access Flow (Tier 1)**

**Test complete payment journey from checkout to PRO feature access.**

```typescript
// __tests__/integration/payment-flow.test.ts
import { prisma } from '@/lib/db';

describe('Integration: Payment to PRO Access Flow', () => {
  let testUserId: string;

  beforeEach(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'payment-test@example.com',
        name: 'Payment Test User',
        tier: 'FREE',
      },
    });
    testUserId = user.id;
  });

  it('should grant PRO access after successful Stripe payment', async () => {
    // STEP 1: FREE user cannot access PRO features
    const beforePaymentRes = await fetch('/api/charts/EURUSD/H1', {
      headers: { 'x-user-id': testUserId },
    });
    expect(beforePaymentRes.status).toBe(403);
    const beforeData = await beforePaymentRes.json();
    expect(beforeData.error).toContain('PRO subscription required');

    // STEP 2: User creates checkout session
    const checkoutRes = await fetch('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': testUserId,
      },
      body: JSON.stringify({ tier: 'PRO' }),
    });

    expect(checkoutRes.status).toBe(200);
    const { sessionId, url } = await checkoutRes.json();
    expect(sessionId).toBeDefined();
    expect(url).toContain('stripe.com');

    // STEP 3: Simulate successful Stripe webhook
    const webhookPayload = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: sessionId,
          customer: 'cus_test123',
          subscription: 'sub_test123',
          metadata: { userId: testUserId },
        },
      },
    };

    const webhookRes = await fetch('/api/webhooks/stripe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': generateTestSignature(webhookPayload),
      },
      body: JSON.stringify(webhookPayload),
    });

    expect(webhookRes.status).toBe(200);

    // STEP 4: Verify user tier upgraded in database
    const updatedUser = await prisma.user.findUnique({
      where: { id: testUserId },
    });
    expect(updatedUser?.tier).toBe('PRO');
    expect(updatedUser?.stripeCustomerId).toBe('cus_test123');
    expect(updatedUser?.stripeSubscriptionId).toBe('sub_test123');

    // STEP 5: User can now access PRO features
    const afterPaymentRes = await fetch('/api/charts/EURUSD/H1', {
      headers: { 'x-user-id': testUserId },
    });
    expect(afterPaymentRes.status).toBe(200);
    const chartData = await afterPaymentRes.json();
    expect(chartData).toHaveProperty('data');

    // STEP 6: Verify notification was sent
    const notifications = await prisma.notification.findMany({
      where: { userId: testUserId },
    });
    expect(notifications.length).toBeGreaterThan(0);
    expect(notifications[0].type).toBe('subscription_upgraded');
  });

  it('should handle failed payment correctly', async () => {
    // Simulate failed payment webhook
    const webhookPayload = {
      type: 'invoice.payment_failed',
      data: {
        object: {
          customer: 'cus_test123',
          subscription: 'sub_test123',
        },
      },
    };

    await fetch('/api/webhooks/stripe', {
      method: 'POST',
      headers: {
        'stripe-signature': generateTestSignature(webhookPayload),
      },
      body: JSON.stringify(webhookPayload),
    });

    // Verify payment failed notification
    const notifications = await prisma.notification.findMany({
      where: {
        userId: testUserId,
        type: 'payment_failed',
      },
    });
    expect(notifications.length).toBe(1);
  });
});
```

---

#### **Integration Path 3: Alert Creation to Notification Flow (Tier 2)**

**Test alert triggers notification when price condition met.**

```typescript
// __tests__/integration/alert-notification-flow.test.ts
import { prisma } from '@/lib/db';

describe('Integration: Alert to Notification Flow', () => {
  let testUserId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: 'alert-test@example.com',
        tier: 'PRO',
      },
    });
    testUserId = user.id;
  });

  it('should send notification when price alert triggers', async () => {
    // STEP 1: Create price alert
    const alertRes = await fetch('/api/alerts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': testUserId,
      },
      body: JSON.stringify({
        symbol: 'EURUSD',
        condition: 'above',
        price: 1.1,
        message: 'EUR hit target',
      }),
    });

    expect(alertRes.status).toBe(201);
    const { alert } = await alertRes.json();
    expect(alert.id).toBeDefined();
    expect(alert.status).toBe('active');

    // STEP 2: Verify alert saved in database
    const dbAlert = await prisma.alert.findUnique({
      where: { id: alert.id },
    });
    expect(dbAlert).toBeDefined();
    expect(dbAlert?.status).toBe('active');

    // STEP 3: Simulate price update from MT5 service
    const priceUpdateRes = await fetch('/api/mt5/price-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: 'EURUSD',
        bid: 1.105, // Above threshold
        ask: 1.1052,
        timestamp: new Date().toISOString(),
      }),
    });

    expect(priceUpdateRes.status).toBe(200);

    // STEP 4: Verify alert was triggered
    const triggeredAlert = await prisma.alert.findUnique({
      where: { id: alert.id },
    });
    expect(triggeredAlert?.status).toBe('triggered');
    expect(triggeredAlert?.triggeredAt).toBeDefined();

    // STEP 5: Verify notification was created
    const notifications = await prisma.notification.findMany({
      where: {
        userId: testUserId,
        type: 'price_alert',
      },
    });

    expect(notifications.length).toBeGreaterThan(0);
    expect(notifications[0].message).toContain('EURUSD');
    expect(notifications[0].message).toContain('1.1050');

    // STEP 6: Verify user can retrieve notification via API
    const notifRes = await fetch('/api/notifications', {
      headers: { 'x-user-id': testUserId },
    });
    const { notifications: apiNotifs } = await notifRes.json();
    expect(apiNotifs[0].type).toBe('price_alert');
  });

  it('should NOT trigger alert when price does not meet condition', async () => {
    // Create alert for "above 1.1000"
    const alertRes = await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'x-user-id': testUserId },
      body: JSON.stringify({
        symbol: 'EURUSD',
        condition: 'above',
        price: 1.1,
      }),
    });
    const { alert } = await alertRes.json();

    // Price update BELOW threshold
    await fetch('/api/mt5/price-update', {
      method: 'POST',
      body: JSON.stringify({
        symbol: 'EURUSD',
        bid: 1.095, // Below threshold
      }),
    });

    // Alert should still be active (not triggered)
    const stillActiveAlert = await prisma.alert.findUnique({
      where: { id: alert.id },
    });
    expect(stillActiveAlert?.status).toBe('active');

    // No notification created
    const notifications = await prisma.notification.findMany({
      where: { userId: testUserId },
    });
    expect(notifications.length).toBe(0);
  });
});
```

---

#### **Integration Path 4: Tier-Based Access Control (Tier 1)**

**Test middleware properly enforces FREE vs PRO access.**

```typescript
// __tests__/integration/tier-gating-flow.test.ts
import { prisma } from '@/lib/db';

describe('Integration: Tier-Based Access Control', () => {
  let freeUserId: string;
  let proUserId: string;

  beforeEach(async () => {
    const freeUser = await prisma.user.create({
      data: { email: 'free@example.com', tier: 'FREE' },
    });
    freeUserId = freeUser.id;

    const proUser = await prisma.user.create({
      data: { email: 'pro@example.com', tier: 'PRO' },
    });
    proUserId = proUser.id;
  });

  it('should enforce tier-based access across all endpoints', async () => {
    const proOnlyEndpoints = [
      '/api/charts/EURUSD/H1',
      '/api/indicators/advanced',
      '/api/alerts/advanced',
    ];

    // TEST: FREE user blocked from PRO endpoints
    for (const endpoint of proOnlyEndpoints) {
      const res = await fetch(endpoint, {
        headers: { 'x-user-id': freeUserId },
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('PRO subscription required');
    }

    // TEST: PRO user can access PRO endpoints
    for (const endpoint of proOnlyEndpoints) {
      const res = await fetch(endpoint, {
        headers: { 'x-user-id': proUserId },
      });

      expect(res.status).not.toBe(403);
    }

    // TEST: Both tiers can access FREE endpoints
    const freeEndpoints = ['/api/watchlist', '/api/alerts'];

    for (const endpoint of freeEndpoints) {
      const freeRes = await fetch(endpoint, {
        headers: { 'x-user-id': freeUserId },
      });
      const proRes = await fetch(endpoint, {
        headers: { 'x-user-id': proUserId },
      });

      expect(freeRes.status).toBe(200);
      expect(proRes.status).toBe(200);
    }
  });

  it('should enforce rate limits per tier', async () => {
    // FREE user: 100 requests/hour limit
    const freeUserRequests = [];
    for (let i = 0; i < 101; i++) {
      freeUserRequests.push(
        fetch('/api/alerts', { headers: { 'x-user-id': freeUserId } })
      );
    }
    const freeResults = await Promise.all(freeUserRequests);

    // First 100 should succeed
    expect(freeResults.slice(0, 100).every((r) => r.status === 200)).toBe(true);
    // 101st should be rate limited
    expect(freeResults[100].status).toBe(429);

    // PRO user: 1000 requests/hour limit (should handle 200 easily)
    const proUserRequests = [];
    for (let i = 0; i < 200; i++) {
      proUserRequests.push(
        fetch('/api/charts/EURUSD/H1', { headers: { 'x-user-id': proUserId } })
      );
    }
    const proResults = await Promise.all(proUserRequests);

    // All 200 should succeed
    expect(proResults.every((r) => r.status === 200)).toBe(true);
  });
});
```

---

#### **Integration Path 5: Subscription Cancellation Flow (Tier 1)**

**Test subscription cancellation downgrades user and removes access.**

```typescript
// __tests__/integration/subscription-cancel-flow.test.ts
import { prisma } from '@/lib/db';

describe('Integration: Subscription Cancellation Flow', () => {
  let proUserId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: 'cancel-test@example.com',
        tier: 'PRO',
        stripeSubscriptionId: 'sub_test123',
      },
    });
    proUserId = user.id;
  });

  it('should complete full cancellation workflow', async () => {
    // STEP 1: PRO user can access PRO features
    const beforeCancelRes = await fetch('/api/charts/EURUSD/H1', {
      headers: { 'x-user-id': proUserId },
    });
    expect(beforeCancelRes.status).toBe(200);

    // STEP 2: User requests cancellation
    const cancelRes = await fetch('/api/subscription/cancel', {
      method: 'POST',
      headers: { 'x-user-id': proUserId },
    });

    expect(cancelRes.status).toBe(200);
    const { success, message } = await cancelRes.json();
    expect(success).toBe(true);
    expect(message).toContain('cancelled');

    // STEP 3: Verify user downgraded to FREE in database
    const downgradedUser = await prisma.user.findUnique({
      where: { id: proUserId },
    });
    expect(downgradedUser?.tier).toBe('FREE');
    expect(downgradedUser?.stripeSubscriptionId).toBeNull();

    // STEP 4: PRO features now blocked
    const afterCancelRes = await fetch('/api/charts/EURUSD/H1', {
      headers: { 'x-user-id': proUserId },
    });
    expect(afterCancelRes.status).toBe(403);

    // STEP 5: FREE features still accessible
    const freeFeatureRes = await fetch('/api/watchlist', {
      headers: { 'x-user-id': proUserId },
    });
    expect(freeFeatureRes.status).toBe(200);

    // STEP 6: Cancellation notification sent
    const notifications = await prisma.notification.findMany({
      where: {
        userId: proUserId,
        type: 'subscription_cancelled',
      },
    });
    expect(notifications.length).toBe(1);
    expect(notifications[0].message).toContain('downgraded to FREE');

    // STEP 7: Cancellation email queued
    // (Check email queue or mock email service)
    const emailLogs = await prisma.emailLog.findMany({
      where: {
        userId: proUserId,
        type: 'subscription_cancelled',
      },
    });
    expect(emailLogs.length).toBe(1);
  });

  it('should handle Stripe webhook for subscription deletion', async () => {
    // Simulate Stripe subscription deleted webhook
    const webhookPayload = {
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_test123',
          customer: 'cus_test123',
        },
      },
    };

    const webhookRes = await fetch('/api/webhooks/stripe', {
      method: 'POST',
      headers: {
        'stripe-signature': generateTestSignature(webhookPayload),
      },
      body: JSON.stringify(webhookPayload),
    });

    expect(webhookRes.status).toBe(200);

    // User should be downgraded
    const user = await prisma.user.findUnique({
      where: { id: proUserId },
    });
    expect(user?.tier).toBe('FREE');
  });
});
```

---

### **Integration Test Execution Checklist**

Add this to your Phase 1 checklist:

#### **Integration Tests (5 Critical Paths)**

- [ ] **Path 1: Auth Flow**
  - [ ] Registration → Login → Protected Access → Logout
  - [ ] Invalid credentials rejected
  - [ ] Session persists across requests

- [ ] **Path 2: Payment Flow**
  - [ ] Checkout → Webhook → Tier Upgrade → Access Granted
  - [ ] Failed payment handled correctly
  - [ ] Notifications sent

- [ ] **Path 3: Alert Flow**
  - [ ] Create Alert → Price Update → Trigger → Notification
  - [ ] Alerts don't trigger on wrong conditions
  - [ ] Multiple alerts handled correctly

- [ ] **Path 4: Tier Gating**
  - [ ] FREE blocked from PRO features
  - [ ] PRO can access all features
  - [ ] Rate limits enforced per tier

- [ ] **Path 5: Cancellation Flow**
  - [ ] Cancel → Downgrade → Access Removed → Notification Sent
  - [ ] Stripe webhook handles cancellation
  - [ ] Email sent on cancellation

---

### **Updated Coverage Requirements**

```javascript
// jest.config.js - Add integration test coverage
module.exports = {
  // ... existing config ...

  // Separate coverage for unit vs integration tests
  projects: [
    {
      displayName: 'unit',
      testMatch: ['**/__tests__/**/*.test.ts', '!**/__tests__/integration/**'],
      coverageThreshold: {
        global: {
          statements: 15,
          branches: 12,
          functions: 15,
          lines: 15,
        },
      },
    },
    {
      displayName: 'integration',
      testMatch: ['**/__tests__/integration/**/*.test.ts'],
      // Integration tests focus on workflows, not coverage %
      coverageThreshold: {
        global: {
          statements: 0, // No minimum for integration
          branches: 0,
          functions: 0,
          lines: 0,
        },
      },
    },
  ],
};
```

---

---

## Step 8: API Testing with Supertest (Critical Addition)

**CRITICAL:** Integration tests call functions directly, but **don't test actual HTTP endpoints**. Supertest validates real API contracts.

### **Why Supertest is Essential**

Integration tests verify internal workflows, but **don't catch:**

- ❌ Route handler forgot to `await` async operation
- ❌ Middleware not applied to endpoint
- ❌ Wrong HTTP status code returned (200 instead of 201)
- ❌ Response body doesn't match API specification
- ❌ Missing authentication headers
- ❌ CORS configuration issues

**Supertest catches these HTTP-layer failures.**

---

### **Integration Tests vs Supertest**

| Aspect      | Integration Tests                | Supertest API Tests                 |
| ----------- | -------------------------------- | ----------------------------------- |
| **What**    | Internal workflows               | **Actual HTTP APIs**                |
| **How**     | Direct function calls            | Real HTTP requests                  |
| **Example** | `upgradeUser('user-123', 'PRO')` | `POST /api/subscription` → `200 OK` |
| **Catches** | Logic bugs                       | API contract violations             |

**Example:**

```typescript
// ✅ Integration test PASSES
it('should upgrade user tier', async () => {
  await upgradeUserTier('user-123', 'PRO');
  const user = await getUser('user-123');
  expect(user.tier).toBe('PRO'); // ✅ PASS
});

// ❌ But API test FAILS (forgot to await in route handler!)
it('POST /api/subscription should upgrade tier', async () => {
  const response = await request(app)
    .post('/api/subscription')
    .set('Authorization', 'Bearer valid-token')
    .send({ tier: 'PRO' });

  expect(response.status).toBe(200); // ❌ FAILS - returns 500
  // Bug: Route handler has unhandled promise rejection
});
```

---

### **Supertest Setup**

Install dependencies:

```bash
npm install --save-dev supertest @types/supertest
```

Create test helper:

```typescript
// __tests__/helpers/supertest-setup.ts
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import request from 'supertest';

const app = next({ dev: true, dir: process.cwd() });
const handle = app.getRequestHandler();

let server: any;

export async function setupSupertestApp() {
  await app.prepare();

  server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  return request(server);
}

export async function teardownSupertestApp() {
  await app.close();
  server?.close();
}
```

---

### **15 Critical API Endpoint Tests (Tier 1)**

#### **API Test Group 1: Authentication APIs**

```typescript
// __tests__/api/auth.supertest.ts
import {
  setupSupertestApp,
  teardownSupertestApp,
} from '../helpers/supertest-setup';

describe('API Tests: Authentication', () => {
  let request: any;

  beforeAll(async () => {
    request = await setupSupertestApp();
  });

  afterAll(async () => {
    await teardownSupertestApp();
  });

  describe('POST /api/auth/signup', () => {
    it('should create new user with valid data', async () => {
      const response = await request
        .post('/api/auth/signup')
        .send({
          email: 'newuser@example.com',
          password: 'SecurePass123!',
          name: 'Test User',
        })
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        userId: expect.any(String),
        email: 'newuser@example.com',
      });
    });

    it('should reject invalid email format', async () => {
      const response = await request
        .post('/api/auth/signup')
        .send({
          email: 'invalid-email',
          password: 'SecurePass123!',
          name: 'Test User',
        })
        .expect(400);

      expect(response.body.error).toContain('Invalid email');
    });

    it('should reject weak password', async () => {
      const response = await request
        .post('/api/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'weak',
          name: 'Test User',
        })
        .expect(400);

      expect(response.body.error).toContain('Password must');
    });

    it('should reject duplicate email', async () => {
      // Create user first
      await request.post('/api/auth/signup').send({
        email: 'duplicate@example.com',
        password: 'SecurePass123!',
        name: 'First User',
      });

      // Try to create duplicate
      const response = await request
        .post('/api/auth/signup')
        .send({
          email: 'duplicate@example.com',
          password: 'SecurePass123!',
          name: 'Second User',
        })
        .expect(409);

      expect(response.body.error).toContain('already exists');
    });
  });

  describe('POST /api/auth/signin', () => {
    it('should return session token with valid credentials', async () => {
      // Create user first
      await request.post('/api/auth/signup').send({
        email: 'signin-test@example.com',
        password: 'SecurePass123!',
        name: 'Test User',
      });

      // Sign in
      const response = await request
        .post('/api/auth/signin')
        .send({
          email: 'signin-test@example.com',
          password: 'SecurePass123!',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        token: expect.any(String),
        user: {
          email: 'signin-test@example.com',
          tier: 'FREE',
        },
      });
    });

    it('should reject invalid credentials', async () => {
      const response = await request
        .post('/api/auth/signin')
        .send({
          email: 'nonexistent@example.com',
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body.error).toContain('Invalid credentials');
    });
  });
});
```

---

#### **API Test Group 2: Subscription & Billing APIs**

```typescript
// __tests__/api/subscription.supertest.ts
import {
  setupSupertestApp,
  teardownSupertestApp,
} from '../helpers/supertest-setup';

describe('API Tests: Subscription & Billing', () => {
  let request: any;
  let authToken: string;

  beforeAll(async () => {
    request = await setupSupertestApp();

    // Create and authenticate test user
    await request.post('/api/auth/signup').send({
      email: 'subscription-test@example.com',
      password: 'SecurePass123!',
      name: 'Test User',
    });

    const loginResponse = await request.post('/api/auth/signin').send({
      email: 'subscription-test@example.com',
      password: 'SecurePass123!',
    });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await teardownSupertestApp();
  });

  describe('GET /api/subscription', () => {
    it('should return current subscription status', async () => {
      const response = await request
        .get('/api/subscription')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        tier: 'FREE',
        status: 'active',
        nextBillingDate: null,
      });
    });

    it('should reject unauthenticated request', async () => {
      const response = await request.get('/api/subscription').expect(401);

      expect(response.body.error).toContain('Authentication required');
    });
  });

  describe('POST /api/checkout', () => {
    it('should create Stripe checkout session', async () => {
      const response = await request
        .post('/api/checkout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ tier: 'PRO' })
        .expect(200);

      expect(response.body).toMatchObject({
        sessionId: expect.any(String),
        url: expect.stringContaining('stripe.com'),
      });
    });

    it('should reject if user already PRO', async () => {
      // First upgrade user to PRO
      await prisma.user.update({
        where: { email: 'subscription-test@example.com' },
        data: { tier: 'PRO' },
      });

      // Try to checkout again
      const response = await request
        .post('/api/checkout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ tier: 'PRO' })
        .expect(400);

      expect(response.body.error).toContain('already PRO');
    });

    it('should reject invalid tier', async () => {
      const response = await request
        .post('/api/checkout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ tier: 'INVALID_TIER' })
        .expect(400);

      expect(response.body.error).toContain('Invalid tier');
    });
  });

  describe('POST /api/subscription/cancel', () => {
    it('should cancel PRO subscription', async () => {
      // Setup: User is PRO
      await prisma.user.update({
        where: { email: 'subscription-test@example.com' },
        data: {
          tier: 'PRO',
          stripeSubscriptionId: 'sub_test123',
        },
      });

      const response = await request
        .post('/api/subscription/cancel')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('cancelled'),
        tier: 'FREE',
      });

      // Verify user downgraded in database
      const user = await prisma.user.findUnique({
        where: { email: 'subscription-test@example.com' },
      });
      expect(user?.tier).toBe('FREE');
    });

    it('should reject if user is FREE', async () => {
      const response = await request
        .post('/api/subscription/cancel')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toContain('No active subscription');
    });
  });

  describe('GET /api/invoices', () => {
    it('should return user invoices', async () => {
      const response = await request
        .get('/api/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        invoices: expect.any(Array),
        hasMore: expect.any(Boolean),
      });
    });

    it('should support pagination', async () => {
      const response = await request
        .get('/api/invoices?limit=5&startingAfter=inv_123')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.invoices.length).toBeLessThanOrEqual(5);
    });
  });

  describe('POST /api/webhooks/stripe', () => {
    it('should handle checkout.session.completed event', async () => {
      const webhookPayload = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_123',
            customer: 'cus_test_123',
            subscription: 'sub_test_123',
            metadata: { userId: 'user-123' },
          },
        },
      };

      const response = await request
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'test-signature')
        .send(webhookPayload)
        .expect(200);

      expect(response.body).toMatchObject({
        received: true,
      });
    });

    it('should reject invalid signature', async () => {
      const response = await request
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'invalid-signature')
        .send({ type: 'test.event' })
        .expect(400);

      expect(response.body.error).toContain('Invalid signature');
    });
  });
});
```

---

#### **API Test Group 3: Tier-Based Access Control**

```typescript
// __tests__/api/access-control.supertest.ts
describe('API Tests: Tier-Based Access Control', () => {
  let request: any;
  let freeUserToken: string;
  let proUserToken: string;

  beforeAll(async () => {
    request = await setupSupertestApp();

    // Create FREE user
    await request.post('/api/auth/signup').send({
      email: 'free@example.com',
      password: 'SecurePass123!',
      name: 'Free User',
    });
    const freeLogin = await request.post('/api/auth/signin').send({
      email: 'free@example.com',
      password: 'SecurePass123!',
    });
    freeUserToken = freeLogin.body.token;

    // Create PRO user
    await request.post('/api/auth/signup').send({
      email: 'pro@example.com',
      password: 'SecurePass123!',
      name: 'Pro User',
    });
    await prisma.user.update({
      where: { email: 'pro@example.com' },
      data: { tier: 'PRO' },
    });
    const proLogin = await request.post('/api/auth/signin').send({
      email: 'pro@example.com',
      password: 'SecurePass123!',
    });
    proUserToken = proLogin.body.token;
  });

  describe('PRO-only endpoints', () => {
    const proOnlyEndpoints = [
      '/api/charts/EURUSD/H1',
      '/api/indicators/advanced',
      '/api/alerts/advanced',
    ];

    proOnlyEndpoints.forEach((endpoint) => {
      it(`${endpoint} should block FREE users`, async () => {
        const response = await request
          .get(endpoint)
          .set('Authorization', `Bearer ${freeUserToken}`)
          .expect(403);

        expect(response.body.error).toContain('PRO subscription required');
      });

      it(`${endpoint} should allow PRO users`, async () => {
        const response = await request
          .get(endpoint)
          .set('Authorization', `Bearer ${proUserToken}`);

        expect(response.status).not.toBe(403);
      });
    });
  });

  describe('FREE-accessible endpoints', () => {
    const freeEndpoints = [
      '/api/watchlist',
      '/api/alerts',
      '/api/notifications',
    ];

    freeEndpoints.forEach((endpoint) => {
      it(`${endpoint} should allow FREE users`, async () => {
        const response = await request
          .get(endpoint)
          .set('Authorization', `Bearer ${freeUserToken}`);

        expect(response.status).toBe(200);
      });

      it(`${endpoint} should allow PRO users`, async () => {
        const response = await request
          .get(endpoint)
          .set('Authorization', `Bearer ${proUserToken}`);

        expect(response.status).toBe(200);
      });
    });
  });
});
```

---

### **API Test Execution Checklist**

Add this to your Phase 1 checklist:

#### **Supertest API Tests (15 Critical Endpoints)**

- [ ] **Auth APIs (5 tests)**
  - [ ] POST /api/auth/signup - Valid data
  - [ ] POST /api/auth/signup - Validation errors
  - [ ] POST /api/auth/signin - Valid credentials
  - [ ] POST /api/auth/signin - Invalid credentials
  - [ ] POST /api/auth/signout

- [ ] **Subscription APIs (6 tests)**
  - [ ] GET /api/subscription
  - [ ] POST /api/checkout - Create session
  - [ ] POST /api/checkout - Already PRO
  - [ ] POST /api/subscription/cancel
  - [ ] GET /api/invoices
  - [ ] POST /api/webhooks/stripe

- [ ] **Access Control (4 tests)**
  - [ ] PRO endpoints block FREE users
  - [ ] PRO endpoints allow PRO users
  - [ ] FREE endpoints allow both tiers
  - [ ] Unauthenticated requests blocked

---

## Timeline Estimate (Updated with Supertest)

| Phase             | Unit Tests | Integration Tests | **Supertest API** | Total         |
| ----------------- | ---------- | ----------------- | ----------------- | ------------- |
| Tier 1 (Critical) | 5-6 days   | 2-3 days          | **2-3 days**      | **9-12 days** |
| Tier 2 (Feature)  | 3-4 days   | 1-2 days          | **1-2 days**      | **5-8 days**  |
| Tier 3 (Utility)  | 1-2 days   | 0.5-1 day         | **0.5-1 day**     | **2-4 days**  |

**Total: 16-24 days** for comprehensive Phase 1 testing (unit + integration + API).

---

## Success Criteria (Updated)

✅ **Phase 1 Complete When:**

- **Unit Tests:**
  - Tier 1: ≥25% coverage, Tier 2: ≥10%, Tier 3: ≥2%
- **Integration Tests:**
  - All 5 critical paths passing
- **Supertest API Tests:**
  - 15+ critical endpoints tested
  - All API contracts validated
  - Auth, Subscription, Access Control verified
- All tests passing
- CI/CD pipeline succeeds

---

**Ready to begin? Start with Tier 1 unit tests → integration tests → then add Supertest API tests.**
