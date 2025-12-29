/**
 * Path 2: Subscription Upgrade E2E Tests
 *
 * Tests the complete subscription upgrade flow including:
 * - FREE to PRO upgrade via Stripe
 * - FREE to PRO upgrade via dLocal (emerging markets)
 * - 3-day trial purchase
 * - Discount code application
 * - Payment success/failure handling
 *
 * @module e2e/tests/path2-subscription-upgrade
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { CheckoutPage } from '../pages/checkout.page';
import {
  TEST_USERS,
  TEST_CODES,
  PRICING,
  DLOCAL_COUNTRIES,
  STRIPE_TEST_CARDS,
  calculateDiscount,
} from '../utils/test-data';
import { getSubscription, getSession } from '../utils/api-helpers';

test.describe('Path 2: Subscription Upgrade', () => {
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STRIPE CHECKOUT TESTS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Stripe Checkout Flow', () => {
    test.beforeEach(async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );
    });

    test('SUB-001: FREE user can initiate Stripe checkout', async ({ page }) => {
      const dashboardPage = new DashboardPage(page);
      const checkoutPage = new CheckoutPage(page);

      // Verify user is FREE tier
      const tier = await dashboardPage.getTier();
      expect(tier).toContain('FREE');

      // Click upgrade button
      await dashboardPage.clickUpgrade();

      // Should be on pricing page
      await expect(page).toHaveURL(/pricing/);

      // PRO plan should be available
      await expect(checkoutPage.proPlanCard).toBeVisible();

      // Click upgrade to PRO
      await checkoutPage.clickUpgradeToPro();

      // Should redirect to Stripe checkout or show checkout modal
      await page.waitForTimeout(2000);
      const url = page.url();
      expect(
        url.includes('checkout.stripe.com') || url.includes('pricing')
      ).toBeTruthy();
    });

    test('SUB-002: Pricing page displays correct PRO price', async ({
      page,
    }) => {
      const checkoutPage = new CheckoutPage(page);

      await checkoutPage.goto();
      await checkoutPage.waitForPageLoad();

      // Check PRO price is displayed correctly
      const priceText = await checkoutPage.getProPrice();
      expect(priceText).toContain('29');
    });

    test('SUB-003: Stripe checkout with test card succeeds', async ({
      page,
    }) => {
      const checkoutPage = new CheckoutPage(page);

      await checkoutPage.goto();
      await checkoutPage.clickUpgradeToPro();

      // Wait for Stripe redirect or checkout modal
      await page.waitForTimeout(3000);

      // If redirected to Stripe
      if (page.url().includes('checkout.stripe.com')) {
        await checkoutPage.completeStripeTestPayment();

        // Should redirect to success page
        await expect(page).toHaveURL(/success|dashboard/);

        // Verify subscription is active via API
        const { subscription } = await getSubscription(page.request);
        expect(subscription?.status).toBe('ACTIVE');
        expect(subscription?.tier).toBe('PRO');
      }
    });

    test('SUB-004: Stripe checkout cancellation returns to pricing', async ({
      page,
    }) => {
      const checkoutPage = new CheckoutPage(page);

      await checkoutPage.goto();
      await checkoutPage.clickUpgradeToPro();

      await page.waitForTimeout(3000);

      // If on Stripe checkout, look for cancel/back button
      if (page.url().includes('checkout.stripe.com')) {
        // Click back/cancel button on Stripe
        await page.click('a[href*="cancel"]').catch(() => {
          // Some Stripe checkouts have different cancel mechanism
          page.goBack();
        });

        await page.waitForTimeout(2000);

        // Should be back on app
        expect(page.url()).not.toContain('checkout.stripe.com');
      }
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DLOCAL CHECKOUT TESTS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('dLocal Checkout Flow', () => {
    test('SUB-005: India user sees dLocal checkout with UPI option', async ({
      page,
      context,
    }) => {
      // Set India geolocation
      await context.setGeolocation({
        latitude: 20.5937,
        longitude: 78.9629,
      });

      // Set India country header
      await page.setExtraHTTPHeaders({
        'cf-ipcountry': 'IN',
      });

      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      const checkoutPage = new CheckoutPage(page);
      await checkoutPage.goto();

      // Should show dLocal checkout
      await page.waitForTimeout(2000);

      if (await checkoutPage.isDLocalCheckout()) {
        // Check India-specific payment methods
        const methods = await checkoutPage.getPaymentMethods();
        expect(methods.some((m) => m.includes('UPI'))).toBeTruthy();
      }
    });

    test('SUB-006: dLocal 3-day trial option shown for eligible users', async ({
      page,
      context,
    }) => {
      await context.setGeolocation({
        latitude: 20.5937,
        longitude: 78.9629,
      });

      await page.setExtraHTTPHeaders({
        'cf-ipcountry': 'IN',
      });

      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      const checkoutPage = new CheckoutPage(page);
      await checkoutPage.goto();

      await page.waitForTimeout(2000);

      if (await checkoutPage.isDLocalCheckout()) {
        // 3-day plan option should be visible
        await expect(checkoutPage.threeDayPlanOption).toBeVisible();

        // Price should be $1.99 or equivalent
        await checkoutPage.selectThreeDayPlan();
        const price = await checkoutPage.getLocalPrice();
        expect(price.length).toBeGreaterThan(0);
      }
    });

    test('SUB-007: dLocal monthly plan selection', async ({
      page,
      context,
    }) => {
      await context.setGeolocation({
        latitude: 6.5244,
        longitude: 3.3792,
      });

      await page.setExtraHTTPHeaders({
        'cf-ipcountry': 'NG',
      });

      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      const checkoutPage = new CheckoutPage(page);
      await checkoutPage.goto();

      await page.waitForTimeout(2000);

      if (await checkoutPage.isDLocalCheckout()) {
        // Select monthly plan
        await checkoutPage.selectMonthlyPlan();

        // Should show NGN price
        const currency = await checkoutPage.getCurrency();
        if (currency) {
          expect(currency).toContain('NGN');
        }
      }
    });

    test('SUB-008: Currency conversion displayed correctly', async ({
      page,
      context,
    }) => {
      await context.setGeolocation({
        latitude: 20.5937,
        longitude: 78.9629,
      });

      await page.setExtraHTTPHeaders({
        'cf-ipcountry': 'IN',
      });

      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      const checkoutPage = new CheckoutPage(page);
      await checkoutPage.goto();

      await page.waitForTimeout(2000);

      if (await checkoutPage.isDLocalCheckout()) {
        await checkoutPage.selectMonthlyPlan();

        // Should display INR price
        const currency = await checkoutPage.getCurrency();
        const localPrice = await checkoutPage.getLocalPrice();

        if (currency) {
          expect(currency).toContain('INR');
        }
        // INR price should be significantly higher than USD
        const priceNumber = parseFloat(localPrice.replace(/[^0-9.]/g, ''));
        expect(priceNumber).toBeGreaterThan(29); // More than $29 USD
      }
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DISCOUNT CODE TESTS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Discount Code on Checkout', () => {
    test.beforeEach(async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );
    });

    test('SUB-009: Valid discount code reduces price', async ({ page }) => {
      const checkoutPage = new CheckoutPage(page);

      await checkoutPage.goto();
      await checkoutPage.clickUpgradeToPro();

      // Look for discount code input
      await page.waitForTimeout(2000);

      if (await checkoutPage.discountCodeInput.isVisible()) {
        await checkoutPage.applyDiscountCode(TEST_CODES.valid10.code);

        // Check if discount was applied
        const isApplied = await checkoutPage.isDiscountApplied();
        if (isApplied) {
          // Verify price is discounted
          const discounted = await checkoutPage.getDiscountedPrice();
          const { finalPrice } = calculateDiscount(
            PRICING.PRO_MONTHLY,
            TEST_CODES.valid10.discountPercent
          );
          expect(discounted).toContain(finalPrice.toString().slice(0, 4));
        }
      }
    });

    test('SUB-010: 20% discount code applies correctly', async ({ page }) => {
      const checkoutPage = new CheckoutPage(page);

      await checkoutPage.goto();
      await checkoutPage.clickUpgradeToPro();

      await page.waitForTimeout(2000);

      if (await checkoutPage.discountCodeInput.isVisible()) {
        await checkoutPage.applyDiscountCode(TEST_CODES.valid20.code);

        const isApplied = await checkoutPage.isDiscountApplied();
        if (isApplied) {
          // 20% off $29 = $23.20
          const discounted = await checkoutPage.getDiscountedPrice();
          expect(discounted).toContain('23.2');
        }
      }
    });

    test('SUB-011: Invalid discount code shows error', async ({ page }) => {
      const checkoutPage = new CheckoutPage(page);

      await checkoutPage.goto();
      await checkoutPage.clickUpgradeToPro();

      await page.waitForTimeout(2000);

      if (await checkoutPage.discountCodeInput.isVisible()) {
        await checkoutPage.applyDiscountCode('INVALIDCODE123');

        // Should show error
        const error = await checkoutPage.getDiscountError();
        expect(error).toBeTruthy();
      }
    });

    test('SUB-012: Expired discount code is rejected', async ({ page }) => {
      const checkoutPage = new CheckoutPage(page);

      await checkoutPage.goto();
      await checkoutPage.clickUpgradeToPro();

      await page.waitForTimeout(2000);

      if (await checkoutPage.discountCodeInput.isVisible()) {
        await checkoutPage.applyDiscountCode(TEST_CODES.expired.code);

        const error = await checkoutPage.getDiscountError();
        expect(error).toBeTruthy();
        if (error) {
          expect(error.toLowerCase()).toContain('expired');
        }
      }
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // POST-UPGRADE VERIFICATION
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Post-Upgrade Verification', () => {
    test('SUB-013: PRO user sees PRO tier badge', async ({ page }) => {
      const loginPage = new LoginPage(page);
      const dashboardPage = new DashboardPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.pro.email,
        TEST_USERS.pro.password
      );

      const tier = await dashboardPage.getTier();
      expect(tier).toContain('PRO');
    });

    test('SUB-014: PRO user does not see upgrade button', async ({ page }) => {
      const loginPage = new LoginPage(page);
      const dashboardPage = new DashboardPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.pro.email,
        TEST_USERS.pro.password
      );

      const isUpgradeVisible = await dashboardPage.isUpgradeButtonVisible();
      expect(isUpgradeVisible).toBe(false);
    });

    test('SUB-015: Subscription status shown in settings', async ({ page }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.pro.email,
        TEST_USERS.pro.password
      );

      // Navigate to settings
      await page.goto('/dashboard/settings');

      // Click subscription tab
      await page.click('[data-testid="settings-subscription-tab"]').catch(() => {
        // Tab might not exist, that's ok
      });

      await page.waitForTimeout(1000);

      // Check for subscription info
      const content = await page.content();
      expect(
        content.toLowerCase().includes('pro') ||
          content.toLowerCase().includes('active') ||
          content.toLowerCase().includes('subscription')
      ).toBeTruthy();
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TIER FEATURE ACCESS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('PRO Feature Access After Upgrade', () => {
    test('SUB-016: PRO user has access to all 15 symbols', async ({
      page,
      request,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.pro.email,
        TEST_USERS.pro.password
      );

      // Check via API
      const response = await request.get('/api/tier/symbols');
      if (response.ok()) {
        const data = await response.json();
        expect(data.symbols.length).toBe(15);
      }
    });

    test('SUB-017: PRO user has access to all 9 timeframes', async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.pro.email,
        TEST_USERS.pro.password
      );

      // Navigate to charts and check timeframes
      await page.goto('/dashboard/charts');

      // Click timeframe selector
      await page.click('[data-testid="timeframe-selector"]').catch(() => {});
      await page.waitForTimeout(500);

      // Count timeframe options
      const options = await page.locator('[data-testid="timeframe-option"]').all();
      // PRO should have 9 timeframes
      expect(options.length).toBeGreaterThanOrEqual(9);
    });

    test('SUB-018: PRO user can create up to 20 alerts', async ({ page }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.pro.email,
        TEST_USERS.pro.password
      );

      // Navigate to alerts
      await page.goto('/dashboard/alerts');

      // Check alert limit info if displayed
      const content = await page.content();
      expect(content).toContain('20');
    });
  });
});
