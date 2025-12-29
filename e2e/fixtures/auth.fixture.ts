/**
 * Authentication Fixtures for E2E Tests
 *
 * Provides pre-authenticated browser contexts for different user types:
 * - FREE tier user
 * - PRO tier user
 * - Admin user
 * - Affiliate user
 *
 * @module e2e/fixtures/auth.fixture
 */

import { test as base, Page, BrowserContext } from '@playwright/test';

// Test user credentials (should match seeded data)
export const TEST_USERS = {
  free: {
    email: 'free-test@trading-alerts.test',
    password: 'TestPassword123!',
    tier: 'FREE' as const,
  },
  pro: {
    email: 'pro-test@trading-alerts.test',
    password: 'TestPassword123!',
    tier: 'PRO' as const,
  },
  admin: {
    email: 'admin-test@trading-alerts.test',
    password: 'AdminPassword123!',
    role: 'ADMIN' as const,
  },
  affiliate: {
    email: 'affiliate-test@trading-alerts.test',
    password: 'AffiliatePassword123!',
    isAffiliate: true,
  },
  unverified: {
    email: 'unverified@trading-alerts.test',
    password: 'TestPassword123!',
    emailVerified: false,
  },
};

// Test discount codes
export const TEST_CODES = {
  valid10: 'TESTCODE10',
  valid20: 'TESTCODE20',
  expired: 'EXPIREDCODE',
  used: 'USEDCODE',
  suspended: 'SUSPENDEDAFF',
};

// Extended test type with fixtures
type AuthFixtures = {
  // Authenticated contexts
  freeUserPage: Page;
  proUserPage: Page;
  adminPage: Page;
  affiliatePage: Page;

  // Helper functions
  loginAs: (
    page: Page,
    email: string,
    password: string
  ) => Promise<void>;
  logout: (page: Page) => Promise<void>;
  registerUser: (
    page: Page,
    email: string,
    password: string,
    name: string
  ) => Promise<void>;
};

/**
 * Custom test fixture with authentication helpers
 */
export const test = base.extend<AuthFixtures>({
  /**
   * Pre-authenticated FREE user page
   */
  freeUserPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login as FREE user
    await loginUser(page, TEST_USERS.free.email, TEST_USERS.free.password);

    await use(page);
    await context.close();
  },

  /**
   * Pre-authenticated PRO user page
   */
  proUserPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login as PRO user
    await loginUser(page, TEST_USERS.pro.email, TEST_USERS.pro.password);

    await use(page);
    await context.close();
  },

  /**
   * Pre-authenticated Admin page
   */
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login as Admin
    await loginUser(page, TEST_USERS.admin.email, TEST_USERS.admin.password);

    await use(page);
    await context.close();
  },

  /**
   * Pre-authenticated Affiliate page
   */
  affiliatePage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login as Affiliate
    await loginUser(
      page,
      TEST_USERS.affiliate.email,
      TEST_USERS.affiliate.password
    );

    await use(page);
    await context.close();
  },

  /**
   * Login helper function
   */
  loginAs: async ({}, use) => {
    const loginFn = async (
      page: Page,
      email: string,
      password: string
    ): Promise<void> => {
      await loginUser(page, email, password);
    };
    await use(loginFn);
  },

  /**
   * Logout helper function
   */
  logout: async ({}, use) => {
    const logoutFn = async (page: Page): Promise<void> => {
      // Click user menu
      await page.click('[data-testid="user-menu"]');
      // Click logout
      await page.click('[data-testid="logout-button"]');
      // Wait for redirect to login
      await page.waitForURL('**/login');
    };
    await use(logoutFn);
  },

  /**
   * Register user helper function
   */
  registerUser: async ({}, use) => {
    const registerFn = async (
      page: Page,
      email: string,
      password: string,
      name: string
    ): Promise<void> => {
      await page.goto('/register');
      await page.fill('input[name="name"]', name);
      await page.fill('input[name="email"]', email);
      await page.fill('input[name="password"]', password);
      await page.fill('input[name="confirmPassword"]', password);
      await page.click('button[type="submit"]');
    };
    await use(registerFn);
  },
});

/**
 * Internal login helper
 */
async function loginUser(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto('/login');

  // Wait for login form
  await page.waitForSelector('input[type="email"]');

  // Fill credentials
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard or error
  try {
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  } catch {
    // Check if there's an error message
    const errorMessage = page.locator('[data-testid="error-message"]');
    if (await errorMessage.isVisible()) {
      throw new Error(`Login failed: ${await errorMessage.textContent()}`);
    }
    throw new Error('Login failed: Redirect to dashboard did not occur');
  }
}

export { expect } from '@playwright/test';
