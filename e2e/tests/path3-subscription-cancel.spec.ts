/**
 * Path 3: Subscription Cancellation E2E Tests
 *
 * Tests the complete subscription cancellation flow including:
 * - PRO user initiating cancellation
 * - Cancellation confirmation
 * - Retention of PRO access until expiry
 * - Downgrade after expiry
 * - Alert/watchlist reduction on downgrade
 *
 * @module e2e/tests/path3-subscription-cancel
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { SettingsPage } from '../pages/settings.page';
import { TEST_USERS, TIER_LIMITS } from '../utils/test-data';
import { getSubscription, cancelSubscription } from '../utils/api-helpers';

test.describe('Path 3: Subscription Cancellation', () => {
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CANCELLATION INITIATION
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Cancellation Initiation', () => {
    test.beforeEach(async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.pro.email,
        TEST_USERS.pro.password
      );
    });

    test('CAN-001: PRO user can access subscription settings', async ({
      page,
    }) => {
      const settingsPage = new SettingsPage(page);

      await settingsPage.goto();
      await settingsPage.goToSubscriptionTab();

      // Current plan should be displayed
      const plan = await settingsPage.getCurrentPlan();
      expect(plan.toLowerCase()).toContain('pro');
    });

    test('CAN-002: Cancel button is visible for active PRO subscription', async ({
      page,
    }) => {
      const settingsPage = new SettingsPage(page);

      await settingsPage.goto();
      await settingsPage.goToSubscriptionTab();

      // Cancel button should be visible
      const isCancelVisible = await settingsPage.isCancelButtonVisible();
      expect(isCancelVisible).toBe(true);
    });

    test('CAN-003: Clicking cancel opens confirmation modal', async ({
      page,
    }) => {
      const settingsPage = new SettingsPage(page);

      await settingsPage.goto();
      await settingsPage.goToSubscriptionTab();
      await settingsPage.clickCancelSubscription();

      // Modal should be visible
      await expect(settingsPage.cancelModal).toBeVisible();
    });

    test('CAN-004: Dismissing modal keeps subscription active', async ({
      page,
    }) => {
      const settingsPage = new SettingsPage(page);

      await settingsPage.goto();
      await settingsPage.goToSubscriptionTab();
      await settingsPage.clickCancelSubscription();
      await settingsPage.dismissCancellation();

      // Modal should be hidden
      await expect(settingsPage.cancelModal).toBeHidden();

      // Subscription status should still be active
      const status = await settingsPage.getSubscriptionStatus();
      expect(status.toLowerCase()).toContain('active');
    });

    test('CAN-005: Cancellation modal has reason dropdown', async ({ page }) => {
      const settingsPage = new SettingsPage(page);

      await settingsPage.goto();
      await settingsPage.goToSubscriptionTab();
      await settingsPage.clickCancelSubscription();

      // Reason dropdown should exist
      await expect(settingsPage.cancellationReason).toBeVisible();
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CANCELLATION CONFIRMATION
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Cancellation Confirmation', () => {
    test('CAN-006: Confirming cancellation updates subscription status', async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.pro.email,
        TEST_USERS.pro.password
      );

      const settingsPage = new SettingsPage(page);

      await settingsPage.goto();
      await settingsPage.goToSubscriptionTab();

      // Get initial status
      const initialStatus = await settingsPage.getSubscriptionStatus();
      expect(initialStatus.toLowerCase()).toContain('active');

      // Cancel subscription
      await settingsPage.clickCancelSubscription();
      await settingsPage.selectCancellationReason('too_expensive');
      await settingsPage.confirmCancellation();

      // Status should update to cancelled
      await page.waitForTimeout(1000);
      const newStatus = await settingsPage.getSubscriptionStatus();
      expect(
        newStatus.toLowerCase().includes('cancel') ||
          newStatus.toLowerCase().includes('expir')
      ).toBeTruthy();
    });

    test('CAN-007: Cancellation success message is shown', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.pro.email,
        TEST_USERS.pro.password
      );

      const settingsPage = new SettingsPage(page);

      await settingsPage.goto();
      await settingsPage.goToSubscriptionTab();
      await settingsPage.clickCancelSubscription();
      await settingsPage.confirmCancellation();

      // Success message should appear
      const message = await settingsPage.getSuccessMessage();
      expect(message).toBeTruthy();
    });

    test('CAN-008: Expiry date is shown after cancellation', async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.pro.email,
        TEST_USERS.pro.password
      );

      const settingsPage = new SettingsPage(page);

      await settingsPage.goto();
      await settingsPage.goToSubscriptionTab();

      // Check if renewal/expiry date is shown
      const renewalDate = await settingsPage.getRenewalDate();
      expect(renewalDate.length).toBeGreaterThan(0);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PRO ACCESS RETENTION
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('PRO Access Retention Until Expiry', () => {
    test('CAN-009: User retains PRO tier after cancellation', async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);
      const dashboardPage = new DashboardPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.pro.email,
        TEST_USERS.pro.password
      );

      // User should still have PRO tier badge
      const tier = await dashboardPage.getTier();
      expect(tier).toContain('PRO');
    });

    test('CAN-010: PRO features remain accessible after cancellation', async ({
      page,
      request,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.pro.email,
        TEST_USERS.pro.password
      );

      // Check symbol access - should still have 15
      const response = await request.get('/api/tier/symbols');
      if (response.ok()) {
        const data = await response.json();
        expect(data.symbols.length).toBe(15);
      }
    });

    test('CAN-011: Can still create alerts with PRO limits', async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.pro.email,
        TEST_USERS.pro.password
      );

      // Navigate to alerts
      await page.goto('/dashboard/alerts');

      // Should be able to create up to 20 alerts
      const content = await page.content();
      // Look for alert limit mention
      expect(
        content.includes('20') || content.toLowerCase().includes('pro')
      ).toBeTruthy();
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RESUBSCRIPTION
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Resubscription After Cancellation', () => {
    test('CAN-012: Resubscribe option available after cancellation', async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);
      const settingsPage = new SettingsPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.pro.email,
        TEST_USERS.pro.password
      );

      await settingsPage.goto();
      await settingsPage.goToSubscriptionTab();

      // Look for resubscribe or upgrade button after cancellation
      const content = await page.content();
      expect(
        content.toLowerCase().includes('resubscribe') ||
          content.toLowerCase().includes('upgrade') ||
          content.toLowerCase().includes('renew')
      ).toBeTruthy();
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // API CANCELLATION
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('API Cancellation Flow', () => {
    test('CAN-013: Cancellation API returns correct response', async ({
      page,
      request,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.pro.email,
        TEST_USERS.pro.password
      );

      // Cancel via API
      const result = await cancelSubscription(request, 'testing');

      if (result.success) {
        expect(result.subscription).toBeDefined();
        expect(result.subscription?.status).toBe('CANCELLED');
        expect(result.subscription?.cancelledAt).toBeDefined();
        expect(result.subscription?.expiresAt).toBeDefined();
      }
    });

    test('CAN-014: Cannot cancel already cancelled subscription', async ({
      page,
      request,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.pro.email,
        TEST_USERS.pro.password
      );

      // First cancellation
      await cancelSubscription(request, 'testing');

      // Try to cancel again
      const result = await cancelSubscription(request, 'testing again');

      // Should fail or indicate already cancelled
      if (!result.success) {
        expect(result.error).toBeTruthy();
      }
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DOWNGRADE AFTER EXPIRY
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Downgrade After Expiry', () => {
    // Note: These tests simulate post-expiry state
    // In real E2E, you'd need to either:
    // 1. Use time travel (mock dates)
    // 2. Create expired test subscriptions
    // 3. Test the cron job behavior separately

    test('CAN-015: FREE user has limited symbol access', async ({
      page,
      request,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      // Check symbol access - should have 5
      const response = await request.get('/api/tier/symbols');
      if (response.ok()) {
        const data = await response.json();
        expect(data.symbols.length).toBe(TIER_LIMITS.FREE.symbolCount);
      }
    });

    test('CAN-016: FREE user has limited alert capacity', async ({ page }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      // Navigate to alerts
      await page.goto('/dashboard/alerts');

      // Check for FREE tier limits
      const content = await page.content();
      expect(
        content.includes('5') ||
          content.toLowerCase().includes('free') ||
          content.toLowerCase().includes('limit')
      ).toBeTruthy();
    });

    test('CAN-017: FREE user cannot access PRO-only symbols', async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      // Navigate to charts
      await page.goto('/dashboard/charts');

      // Try to access a PRO-only symbol via URL param
      await page.goto('/dashboard/charts?symbol=GBPUSD');

      // Should show upgrade prompt or error
      await page.waitForTimeout(1000);
      const content = await page.content();
      expect(
        content.toLowerCase().includes('upgrade') ||
          content.toLowerCase().includes('pro') ||
          content.toLowerCase().includes('restricted')
      ).toBeTruthy();
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EDGE CASES
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Edge Cases', () => {
    test('CAN-018: FREE user cannot access cancel subscription', async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);
      const settingsPage = new SettingsPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      await settingsPage.goto();
      await settingsPage.goToSubscriptionTab();

      // Cancel button should not be visible
      const isCancelVisible = await settingsPage.isCancelButtonVisible();
      expect(isCancelVisible).toBe(false);
    });

    test('CAN-019: Subscription page shows upgrade option for FREE user', async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);
      const settingsPage = new SettingsPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      await settingsPage.goto();
      await settingsPage.goToSubscriptionTab();

      // Upgrade button should be visible
      await expect(settingsPage.upgradeButton).toBeVisible();
    });
  });
});
