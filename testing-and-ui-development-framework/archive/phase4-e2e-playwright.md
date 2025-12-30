# Phase 4: End-to-End Testing with Playwright

## Context & Mission

You are tasked with implementing **End-to-End (E2E) testing** using Playwright for the Trading Alerts SaaS V7 platform. This is the **final testing layer** before production launch.

**Your mission:** Create 5-7 critical user journey tests that validate the entire application works correctly from the user's perspective in a real browser.

---

## Prerequisites

✅ **Phase 1 completed:** Parts 1-15 tested (Unit + Integration + Supertest)
✅ **Phase 2 completed:** Part 16 (Utilities) tested
✅ **Phase 3 completed:** Parts 17A, 17B, 18 built with TDD + Supertest

**Repository:** https://github.com/ripper7375/trading-alerts-saas-v7

---

## Why Playwright E2E Testing?

### **What E2E Tests Catch (That Other Tests Miss)**

Unit, Integration, and API tests verify backend logic, but **don't catch:**

- ❌ Button click doesn't trigger API call (JavaScript error)
- ❌ Form validation shows error but doesn't block submission
- ❌ Stripe checkout redirects but never returns to app
- ❌ Notification appears but disappears immediately
- ❌ Chart loads but displays wrong data
- ❌ Mobile layout breaks on small screens
- ❌ Browser back button breaks app state

**E2E tests simulate real users** and catch these UI/UX bugs.

---

### **Why Playwright Over Cypress?**

| Feature             | Playwright ⭐                 | Cypress                           |
| ------------------- | ----------------------------- | --------------------------------- |
| **Speed**           | Faster (parallel execution)   | Slower (serial)                   |
| **Browsers**        | Chrome, Firefox, Safari, Edge | Chrome, Firefox, Edge (no Safari) |
| **Multi-tab**       | ✅ Yes                        | ❌ No                             |
| **Mobile testing**  | ✅ Native support             | Limited                           |
| **Auto-wait**       | ✅ Smart waiting              | ✅ Yes                            |
| **Network mocking** | ✅ Built-in                   | Requires plugins                  |
| **Debugging**       | ✅ Trace viewer, screenshots  | Good                              |
| **CI/CD**           | ✅ Excellent                  | Good                              |
| **Learning curve**  | Easy (Jest-like API)          | Easy                              |

**Playwright is better for MVP** because it's faster, supports all browsers (including Safari), and handles multi-tab scenarios (important for trading dashboards).

---

## Playwright Setup

### **Installation**

```bash
npm install --save-dev @playwright/test
npx playwright install
```

### **Configuration**

Create `playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',

  // Test timeout
  timeout: 60 * 1000, // 60 seconds per test

  // Expect timeout for assertions
  expect: {
    timeout: 10 * 1000, // 10 seconds
  },

  // Run tests in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Reporter
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  // Shared settings for all tests
  use: {
    // Base URL
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    // Collect trace on first retry
    trace: 'on-first-retry',

    // Take screenshot on failure
    screenshot: 'only-on-failure',

    // Record video on failure
    video: 'retain-on-failure',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile viewports
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Run local dev server before starting tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

### **Test Helpers**

Create reusable test utilities:

```typescript
// tests/e2e/helpers/auth.ts
import { Page } from '@playwright/test';

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');
}

export async function logout(page: Page) {
  await page.click('[data-testid="user-menu"]');
  await page.click('text=Sign Out');
  await page.waitForURL('/');
}

export async function signupNewUser(page: Page) {
  const timestamp = Date.now();
  const email = `test-${timestamp}@example.com`;
  const password = 'SecurePass123!';

  await page.goto('/');
  await page.click('text=Get Started');
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.fill('[name="confirmPassword"]', password);
  await page.click('button:has-text("Sign Up")');
  await page.waitForURL('/dashboard');

  return { email, password };
}
```

```typescript
// tests/e2e/helpers/stripe.ts
import { Page } from '@playwright/test';

export async function fillStripeCheckout(page: Page) {
  // Wait for Stripe checkout iframe
  const stripeFrame = page.frameLocator('iframe[name^="stripe"]').first();

  // Fill card details (Stripe test card)
  await stripeFrame.locator('[name="cardNumber"]').fill('4242424242424242');
  await stripeFrame.locator('[name="cardExpiry"]').fill('12/34');
  await stripeFrame.locator('[name="cardCvc"]').fill('123');
  await stripeFrame.locator('[name="billingName"]').fill('Test User');

  // Submit payment
  await page.click('button:has-text("Subscribe")');
}
```

---

## 7 Critical User Journey Tests

### **Journey 1: New User Registration to First Alert**

**Test Flow:** Homepage → Signup → Create Alert → Verify Alert Created

```typescript
// tests/e2e/user-onboarding.spec.ts
import { test, expect } from '@playwright/test';
import { signupNewUser } from './helpers/auth';

test.describe('User Onboarding Journey', () => {
  test('new user can register and create first alert', async ({ page }) => {
    // STEP 1: Visit homepage
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Trading Alerts');

    // STEP 2: Sign up
    const { email, password } = await signupNewUser(page);

    // STEP 3: Verify on dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('text=Welcome')).toBeVisible();

    // STEP 4: Navigate to create alert
    await page.click('text=Create Alert');
    await expect(page).toHaveURL('/alerts/new');

    // STEP 5: Fill alert form
    await page.selectOption('[name="symbol"]', 'EURUSD');
    await page.selectOption('[name="condition"]', 'above');
    await page.fill('[name="price"]', '1.1000');
    await page.fill('[name="message"]', 'EUR hit target!');

    // STEP 6: Submit alert
    await page.click('button:has-text("Create Alert")');

    // STEP 7: Verify success
    await expect(page.locator('.toast-success')).toContainText('Alert created');
    await expect(page).toHaveURL('/alerts');

    // STEP 8: Verify alert appears in list
    await expect(page.locator('text=EURUSD')).toBeVisible();
    await expect(page.locator('text=1.1000')).toBeVisible();
    await expect(page.locator('text=above')).toBeVisible();
  });

  test('registration validates email format', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Get Started');

    // Try invalid email
    await page.fill('[name="email"]', 'invalid-email');
    await page.fill('[name="password"]', 'SecurePass123!');
    await page.click('button:has-text("Sign Up")');

    // Should show error
    await expect(page.locator('.error')).toContainText('Invalid email');
  });

  test('registration rejects weak password', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Get Started');

    // Try weak password
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'weak');
    await page.click('button:has-text("Sign Up")');

    // Should show error
    await expect(page.locator('.error')).toContainText(
      'Password must be at least 8 characters'
    );
  });
});
```

---

### **Journey 2: FREE User Upgrades to PRO via Stripe**

**Test Flow:** Login → Pricing Page → Stripe Checkout → Payment → PRO Access

```typescript
// tests/e2e/subscription-upgrade.spec.ts
import { test, expect } from '@playwright/test';
import { signupNewUser } from './helpers/auth';
import { fillStripeCheckout } from './helpers/stripe';

test.describe('Subscription Upgrade Journey', () => {
  test('FREE user upgrades to PRO via Stripe', async ({ page, context }) => {
    // STEP 1: Create FREE user
    const { email, password } = await signupNewUser(page);

    // STEP 2: Verify FREE tier badge
    await expect(page.locator('[data-testid="tier-badge"]')).toContainText(
      'FREE'
    );

    // STEP 3: Navigate to pricing
    await page.goto('/pricing');
    await expect(page.locator('h1')).toContainText('Pricing');

    // STEP 4: Click upgrade button
    await page.click('button:has-text("Upgrade to PRO")');

    // STEP 5: Wait for Stripe checkout (opens in same tab or new tab)
    const checkoutPagePromise = context.waitForEvent('page');
    await page.click('button:has-text("Continue to Payment")');
    const checkoutPage = await checkoutPagePromise;

    await checkoutPage.waitForLoadState();
    await expect(checkoutPage).toHaveURL(/checkout\.stripe\.com/);

    // STEP 6: Fill Stripe checkout
    await fillStripeCheckout(checkoutPage);

    // STEP 7: Wait for redirect back to app
    await page.waitForURL('/dashboard', { timeout: 30000 });

    // STEP 8: Verify upgrade success
    await expect(page.locator('.toast-success')).toContainText(
      'upgraded to PRO'
    );
    await expect(page.locator('[data-testid="tier-badge"]')).toContainText(
      'PRO'
    );

    // STEP 9: Verify PRO features unlocked
    await page.goto('/charts/EURUSD/H1');
    await expect(page).toHaveURL('/charts/EURUSD/H1'); // Not redirected/blocked
    await expect(page.locator('canvas')).toBeVisible(); // Chart renders
  });

  test('Stripe checkout failure is handled gracefully', async ({
    page,
    context,
  }) => {
    const { email, password } = await signupNewUser(page);

    await page.goto('/pricing');
    await page.click('button:has-text("Upgrade to PRO")');
    await page.click('button:has-text("Continue to Payment")');

    // Wait for Stripe checkout
    const checkoutPagePromise = context.waitForEvent('page');
    const checkoutPage = await checkoutPagePromise;

    // Fill with declined card
    const stripeFrame = checkoutPage
      .frameLocator('iframe[name^="stripe"]')
      .first();
    await stripeFrame.locator('[name="cardNumber"]').fill('4000000000000002'); // Declined card
    await stripeFrame.locator('[name="cardExpiry"]').fill('12/34');
    await stripeFrame.locator('[name="cardCvc"]').fill('123');

    await checkoutPage.click('button:has-text("Subscribe")');

    // Should show error
    await expect(checkoutPage.locator('.error')).toContainText(
      'card was declined'
    );

    // User should still be on checkout page
    await expect(checkoutPage).toHaveURL(/checkout\.stripe\.com/);
  });

  test('already PRO user cannot upgrade again', async ({ page }) => {
    // Create user and upgrade to PRO manually in database
    const { email, password } = await signupNewUser(page);

    // Manually set user to PRO (simulate already upgraded)
    await page.evaluate(async () => {
      await fetch('/api/test/set-tier', {
        method: 'POST',
        body: JSON.stringify({ tier: 'PRO' }),
      });
    });

    await page.reload();

    // Navigate to pricing
    await page.goto('/pricing');

    // Upgrade button should be disabled or show "Current Plan"
    await expect(page.locator('button:has-text("Current Plan")')).toBeVisible();
  });
});
```

---

### **Journey 3: Alert Triggers Real-Time Notification**

**Test Flow:** Create Alert → Price Hits Threshold → Notification Appears

```typescript
// tests/e2e/alert-notification.spec.ts
import { test, expect } from '@playwright/test';
import { signupNewUser, login } from './helpers/auth';

test.describe('Alert & Notification Journey', () => {
  test('price alert triggers real-time notification', async ({ page }) => {
    // STEP 1: Create PRO user (alerts require PRO)
    const { email, password } = await signupNewUser(page);

    // Upgrade to PRO
    await page.evaluate(async () => {
      await fetch('/api/test/set-tier', {
        method: 'POST',
        body: JSON.stringify({ tier: 'PRO' }),
      });
    });
    await page.reload();

    // STEP 2: Create alert
    await page.goto('/alerts/new');
    await page.selectOption('[name="symbol"]', 'EURUSD');
    await page.selectOption('[name="condition"]', 'above');
    await page.fill('[name="price"]', '1.0500');
    await page.click('button:has-text("Create Alert")');

    // STEP 3: Verify alert created
    await expect(page.locator('.toast-success')).toContainText('Alert created');

    // STEP 4: Open notification panel
    await page.click('[data-testid="notification-bell"]');

    // STEP 5: Simulate price update (trigger alert)
    await page.evaluate(async () => {
      // Simulate WebSocket message or API call that triggers alert
      await fetch('/api/test/trigger-alert', {
        method: 'POST',
        body: JSON.stringify({
          symbol: 'EURUSD',
          price: 1.055, // Above threshold
        }),
      });
    });

    // STEP 6: Wait for notification to appear
    await expect(page.locator('.notification')).toContainText('EURUSD', {
      timeout: 10000,
    });
    await expect(page.locator('.notification')).toContainText('1.0550');
    await expect(page.locator('.notification')).toContainText('above 1.0500');

    // STEP 7: Verify notification badge count
    await expect(
      page.locator('[data-testid="notification-badge"]')
    ).toContainText('1');

    // STEP 8: Click notification
    await page.click('.notification');

    // STEP 9: Should navigate to alerts page
    await expect(page).toHaveURL('/alerts');

    // STEP 10: Alert should show as "Triggered"
    await expect(page.locator('[data-testid="alert-status"]')).toContainText(
      'Triggered'
    );
  });

  test('notification can be marked as read', async ({ page }) => {
    const { email, password } = await signupNewUser(page);

    // Create notification
    await page.evaluate(async () => {
      await fetch('/api/notifications', {
        method: 'POST',
        body: JSON.stringify({
          type: 'price_alert',
          message: 'Test notification',
        }),
      });
    });

    // Open notifications
    await page.click('[data-testid="notification-bell"]');

    // Unread notification should be highlighted
    await expect(page.locator('.notification.unread')).toBeVisible();

    // Mark as read
    await page.click('.notification .mark-read-button');

    // Should no longer be highlighted
    await expect(page.locator('.notification.unread')).not.toBeVisible();

    // Badge count should decrease
    await expect(
      page.locator('[data-testid="notification-badge"]')
    ).toContainText('0');
  });
});
```

---

### **Journey 4: PRO User Cancels Subscription**

**Test Flow:** Login as PRO → Settings → Cancel → Downgrade to FREE

```typescript
// tests/e2e/subscription-cancel.spec.ts
import { test, expect } from '@playwright/test';
import { signupNewUser } from './helpers/auth';

test.describe('Subscription Cancellation Journey', () => {
  test('PRO user cancels and downgrades to FREE', async ({ page }) => {
    // STEP 1: Create PRO user
    const { email, password } = await signupNewUser(page);
    await page.evaluate(async () => {
      await fetch('/api/test/set-tier', {
        method: 'POST',
        body: JSON.stringify({ tier: 'PRO' }),
      });
    });
    await page.reload();

    // STEP 2: Verify PRO status
    await expect(page.locator('[data-testid="tier-badge"]')).toContainText(
      'PRO'
    );

    // STEP 3: Navigate to billing settings
    await page.goto('/settings/billing');
    await expect(page.locator('h1')).toContainText('Billing');

    // STEP 4: Verify subscription details shown
    await expect(page.locator('text=PRO Plan')).toBeVisible();
    await expect(page.locator('text=$29.00/month')).toBeVisible();

    // STEP 5: Click cancel subscription
    await page.click('button:has-text("Cancel Subscription")');

    // STEP 6: Confirm cancellation in modal
    await expect(page.locator('.modal')).toBeVisible();
    await expect(page.locator('.modal')).toContainText('Are you sure');
    await page.click('.modal button:has-text("Confirm Cancellation")');

    // STEP 7: Verify success message
    await expect(page.locator('.toast-success')).toContainText(
      'Subscription cancelled'
    );

    // STEP 8: Verify downgraded to FREE
    await expect(page.locator('[data-testid="tier-badge"]')).toContainText(
      'FREE'
    );

    // STEP 9: Verify PRO features now blocked
    await page.goto('/charts/EURUSD/H1');
    await expect(page.locator('.upgrade-prompt')).toContainText(
      'PRO subscription required'
    );

    // STEP 10: Verify FREE features still accessible
    await page.goto('/watchlist');
    await expect(page).toHaveURL('/watchlist');
    await expect(page.locator('h1')).toContainText('Watchlist');
  });

  test('cancellation sends confirmation email', async ({ page }) => {
    // Setup PRO user
    const { email, password } = await signupNewUser(page);
    await page.evaluate(async () => {
      await fetch('/api/test/set-tier', {
        method: 'POST',
        body: JSON.stringify({ tier: 'PRO' }),
      });
    });
    await page.reload();

    // Cancel subscription
    await page.goto('/settings/billing');
    await page.click('button:has-text("Cancel Subscription")');
    await page.click('.modal button:has-text("Confirm Cancellation")');

    // Check email was queued (via test endpoint)
    const emailResponse = await page.evaluate(async () => {
      const res = await fetch('/api/test/emails/latest');
      return res.json();
    });

    expect(emailResponse.to).toBe(email);
    expect(emailResponse.subject).toContain('Subscription Cancelled');
  });
});
```

---

### **Journey 5: Affiliate Earns Commission from Referral**

**Test Flow:** Affiliate Gets Code → Share Link → New User Signs Up → Upgrades → Commission Credited

```typescript
// tests/e2e/affiliate-referral.spec.ts
import { test, expect } from '@playwright/test';
import { signupNewUser, login } from './helpers/auth';
import { fillStripeCheckout } from './helpers/stripe';

test.describe('Affiliate Referral Journey', () => {
  test('affiliate earns commission from referral conversion', async ({
    page,
    context,
  }) => {
    // STEP 1: Create affiliate user
    const affiliate = await signupNewUser(page);

    // STEP 2: Register as affiliate
    await page.goto('/affiliate/register');
    await page.click('button:has-text("Become an Affiliate")');
    await expect(page.locator('.toast-success')).toContainText(
      'registered as affiliate'
    );

    // STEP 3: Get referral code
    await page.goto('/affiliate/dashboard');
    const referralCode = await page
      .locator('[data-testid="referral-code"]')
      .textContent();
    expect(referralCode).toMatch(/^[A-Z0-9]{8}$/);

    // STEP 4: Note initial balance
    const initialBalance = await page
      .locator('[data-testid="affiliate-balance"]')
      .textContent();
    expect(initialBalance).toBe('$0.00');

    // STEP 5: Open referral link in new context (simulate new user)
    const newUserPage = await context.newPage();
    await newUserPage.goto(`/?ref=${referralCode}`);

    // STEP 6: Verify referral cookie set
    const cookies = await newUserPage.context().cookies();
    const referralCookie = cookies.find((c) => c.name === 'referral_code');
    expect(referralCookie?.value).toBe(referralCode);

    // STEP 7: New user signs up
    await newUserPage.click('text=Get Started');
    await newUserPage.fill(
      '[name="email"]',
      `referred-${Date.now()}@example.com`
    );
    await newUserPage.fill('[name="password"]', 'SecurePass123!');
    await newUserPage.click('button:has-text("Sign Up")');

    // STEP 8: Verify referral tracked in affiliate dashboard
    await page.reload();
    const clickCount = await page
      .locator('[data-testid="total-clicks"]')
      .textContent();
    expect(clickCount).toBe('1');

    // STEP 9: Referred user upgrades to PRO
    await newUserPage.goto('/pricing');
    await newUserPage.click('button:has-text("Upgrade to PRO")');
    await newUserPage.click('button:has-text("Continue to Payment")');

    const checkoutPage = await context.waitForEvent('page');
    await fillStripeCheckout(checkoutPage);

    // STEP 10: Wait for upgrade confirmation
    await newUserPage.waitForURL('/dashboard', { timeout: 30000 });

    // STEP 11: Verify commission credited
    await page.reload();
    const updatedBalance = await page
      .locator('[data-testid="affiliate-balance"]')
      .textContent();
    expect(updatedBalance).toBe('$5.80'); // 20% of $29.00

    const conversionCount = await page
      .locator('[data-testid="total-conversions"]')
      .textContent();
    expect(conversionCount).toBe('1');
  });

  test('invalid referral code does not track click', async ({ page }) => {
    await page.goto('/?ref=INVALID99');

    const cookies = await page.context().cookies();
    const referralCookie = cookies.find((c) => c.name === 'referral_code');

    // Cookie should not be set for invalid code
    expect(referralCookie).toBeUndefined();
  });
});
```

---

### **Journey 6: Charts & Data Visualization (PRO Feature)**

**Test Flow:** Login as PRO → Open Chart → Verify Data Loads → Switch Timeframes

```typescript
// tests/e2e/charts-visualization.spec.ts
import { test, expect } from '@playwright/test';
import { signupNewUser } from './helpers/auth';

test.describe('Charts & Visualization Journey', () => {
  test('PRO user can view and interact with charts', async ({ page }) => {
    // STEP 1: Create PRO user
    const { email, password } = await signupNewUser(page);
    await page.evaluate(async () => {
      await fetch('/api/test/set-tier', {
        method: 'POST',
        body: JSON.stringify({ tier: 'PRO' }),
      });
    });
    await page.reload();

    // STEP 2: Navigate to charts
    await page.goto('/charts/EURUSD/H1');

    // STEP 3: Verify chart loads
    await expect(page.locator('canvas')).toBeVisible({ timeout: 10000 });

    // STEP 4: Verify symbol displayed
    await expect(page.locator('text=EURUSD')).toBeVisible();

    // STEP 5: Verify timeframe displayed
    await expect(page.locator('text=H1')).toBeVisible();

    // STEP 6: Switch timeframe
    await page.click('[data-testid="timeframe-selector"]');
    await page.click('text=H4');

    // STEP 7: Verify URL updated
    await expect(page).toHaveURL('/charts/EURUSD/H4');

    // STEP 8: Verify chart reloaded with new data
    await expect(page.locator('canvas')).toBeVisible();

    // STEP 9: Add indicator
    await page.click('[data-testid="add-indicator"]');
    await page.click('text=Moving Average');

    // STEP 10: Verify indicator appears
    await expect(page.locator('.indicator-ma')).toBeVisible();
  });

  test('FREE user is blocked from charts', async ({ page }) => {
    const { email, password } = await signupNewUser(page);

    // Try to access chart
    await page.goto('/charts/EURUSD/H1');

    // Should show upgrade prompt
    await expect(page.locator('.upgrade-prompt')).toBeVisible();
    await expect(page.locator('.upgrade-prompt')).toContainText(
      'PRO subscription required'
    );

    // Chart should not render
    await expect(page.locator('canvas')).not.toBeVisible();
  });
});
```

---

### **Journey 7: Mobile Responsive Experience**

**Test Flow:** Test Critical Flows on Mobile Viewport

```typescript
// tests/e2e/mobile-responsive.spec.ts
import { test, expect, devices } from '@playwright/test';

test.describe('Mobile Responsive Experience', () => {
  test.use({ ...devices['iPhone 12'] });

  test('mobile user can navigate and use app', async ({ page }) => {
    // STEP 1: Visit homepage on mobile
    await page.goto('/');

    // STEP 2: Open mobile menu
    await page.click('[data-testid="mobile-menu-button"]');
    await expect(page.locator('.mobile-menu')).toBeVisible();

    // STEP 3: Navigate to pricing
    await page.click('.mobile-menu a:has-text("Pricing")');
    await expect(page).toHaveURL('/pricing');

    // STEP 4: Verify pricing cards stack vertically
    const pricingCards = page.locator('.pricing-card');
    const count = await pricingCards.count();
    expect(count).toBe(2); // FREE and PRO

    // STEP 5: Sign up on mobile
    await page.click('button:has-text("Get Started")');
    await page.fill('[name="email"]', `mobile-${Date.now()}@example.com`);
    await page.fill('[name="password"]', 'SecurePass123!');
    await page.click('button:has-text("Sign Up")');

    // STEP 6: Verify dashboard is responsive
    await expect(page).toHaveURL('/dashboard');

    // STEP 7: Verify mobile navigation works
    await page.click('[data-testid="mobile-nav-button"]');
    await page.click('text=Watchlist');
    await expect(page).toHaveURL('/watchlist');
  });

  test('mobile landscape mode works correctly', async ({ page }) => {
    // Set landscape orientation
    await page.setViewportSize({ width: 812, height: 375 });

    await page.goto('/dashboard');

    // Verify layout adapts
    await expect(page.locator('.dashboard-grid')).toBeVisible();
  });
});
```

---

## Test Execution Checklist

### **7 Critical User Journeys**

- [ ] **Journey 1: User Onboarding**
  - [ ] New user registration
  - [ ] Create first alert
  - [ ] Email validation
  - [ ] Password validation

- [ ] **Journey 2: Subscription Upgrade**
  - [ ] FREE to PRO upgrade via Stripe
  - [ ] Payment success flow
  - [ ] Payment failure handling
  - [ ] Already PRO user blocked

- [ ] **Journey 3: Alert & Notification**
  - [ ] Create price alert
  - [ ] Alert triggers notification
  - [ ] Notification appears in real-time
  - [ ] Mark notification as read

- [ ] **Journey 4: Subscription Cancellation**
  - [ ] Cancel PRO subscription
  - [ ] Downgrade to FREE
  - [ ] PRO features blocked
  - [ ] Confirmation email sent

- [ ] **Journey 5: Affiliate Referral**
  - [ ] Affiliate registration
  - [ ] Referral link tracking
  - [ ] New user conversion
  - [ ] Commission credited

- [ ] **Journey 6: Charts (PRO Feature)**
  - [ ] PRO user views charts
  - [ ] Switch timeframes
  - [ ] Add indicators
  - [ ] FREE user blocked

- [ ] **Journey 7: Mobile Responsive**
  - [ ] Mobile navigation
  - [ ] Responsive layouts
  - [ ] Landscape mode

---

## Running Tests

### **Local Development**

```bash
# Run all tests
npx playwright test

# Run specific test file
npx playwright test tests/e2e/subscription-upgrade.spec.ts

# Run in headed mode (see browser)
npx playwright test --headed

# Run specific browser
npx playwright test --project=chromium

# Debug mode (pause on failure)
npx playwright test --debug

# Generate HTML report
npx playwright show-report
```

### **CI/CD Integration**

Add to `.github/workflows/e2e-tests.yml`:

```yaml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npx playwright test
        env:
          BASE_URL: ${{ secrets.STAGING_URL }}

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

---

## Best Practices

### **DO:**

- ✅ Use data-testid attributes for stable selectors
- ✅ Wait for elements explicitly (avoid arbitrary timeouts)
- ✅ Test user journeys, not individual pages
- ✅ Mock external services (Stripe in test mode)
- ✅ Run tests in parallel for speed
- ✅ Take screenshots on failure
- ✅ Use page objects for reusable components

### **DON'T:**

- ❌ Test every edge case (that's for unit tests)
- ❌ Use brittle CSS selectors (prefer test IDs)
- ❌ Make tests depend on each other
- ❌ Test implementation details
- ❌ Skip mobile testing
- ❌ Ignore flaky tests (fix them!)

---

## Timeline Estimate

| Journey              | Test Writing | Debugging | Total       |
| -------------------- | ------------ | --------- | ----------- |
| User Onboarding      | 3 hours      | 1 hour    | **4 hours** |
| Subscription Upgrade | 4 hours      | 2 hours   | **6 hours** |
| Alert Notification   | 3 hours      | 1 hour    | **4 hours** |
| Subscription Cancel  | 2 hours      | 1 hour    | **3 hours** |
| Affiliate Referral   | 4 hours      | 2 hours   | **6 hours** |
| Charts Visualization | 3 hours      | 1 hour    | **4 hours** |
| Mobile Responsive    | 2 hours      | 1 hour    | **3 hours** |

**Total: 3-5 days** for comprehensive E2E test suite.

---

## Success Criteria

✅ **Phase 4 Complete When:**

- All 7 user journeys passing on Chrome, Firefox, Safari
- Mobile tests passing on iOS and Android viewports
- Tests run in CI/CD pipeline
- Test coverage for critical user flows:
  - Registration and onboarding
  - Payment and subscription management
  - Core features (alerts, charts)
  - Affiliate system
- Screenshots captured on failures
- HTML test report generated
- All flaky tests fixed

---

## Deliverables

1. **7 test files** covering critical user journeys
2. **Test helpers** (auth, stripe, common actions)
3. **Playwright configuration** (browsers, reporters, CI)
4. **CI/CD workflow** for automated testing
5. **Test report** showing results across browsers
6. **Documentation** of test patterns and best practices

---

**Ready to begin? Start with Journey 1 (User Onboarding) as your first test.**
