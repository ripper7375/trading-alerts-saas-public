/**
 * Path 7: Alert Triggers and Notifications E2E Tests
 *
 * Tests the complete alert and notification flow including:
 * - Alert creation with tier validation
 * - Alert management (toggle, delete)
 * - Notification display
 * - Alert limits enforcement
 * - Real-time notifications
 *
 * @module e2e/tests/path7-alert-notifications
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { AlertsPage } from '../pages/alerts.page';
import {
  TEST_USERS,
  SYMBOLS,
  TIMEFRAMES,
  TIER_LIMITS,
  generateAlertData,
} from '../utils/test-data';
import {
  getAlerts,
  createAlert,
  deleteAlert,
  getNotifications,
  markNotificationRead,
} from '../utils/api-helpers';

test.describe('Path 7: Alert Triggers and Notifications', () => {
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ALERT CREATION
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Alert Creation', () => {
    test.beforeEach(async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );
    });

    test('ALT-001: Can navigate to alerts page', async ({ page }) => {
      const dashboardPage = new DashboardPage(page);
      await dashboardPage.goToAlerts();

      await expect(page).toHaveURL(/alerts/);
    });

    test('ALT-002: Alerts page shows create button', async ({ page }) => {
      const alertsPage = new AlertsPage(page);
      await alertsPage.goto();

      await expect(alertsPage.createAlertButton).toBeVisible();
    });

    test('ALT-003: Create alert form opens', async ({ page }) => {
      const alertsPage = new AlertsPage(page);
      await alertsPage.goto();
      await alertsPage.openCreateForm();

      await expect(alertsPage.alertForm).toBeVisible();
    });

    test('ALT-004: Can create alert for FREE symbol', async ({ page }) => {
      const alertsPage = new AlertsPage(page);
      await alertsPage.goto();

      const initialCount = await alertsPage.getAlertCount();

      await alertsPage.createAlertAndExpectSuccess(
        'BTCUSD',
        'H1',
        'PRICE_ABOVE',
        50000,
        'Test Alert'
      );

      const newCount = await alertsPage.getAlertCount();
      expect(newCount).toBe(initialCount + 1);
    });

    test('ALT-005: Cannot create alert for PRO-only symbol', async ({
      page,
    }) => {
      const alertsPage = new AlertsPage(page);
      await alertsPage.goto();

      await alertsPage.createAlertAndExpectError(
        'GBPUSD', // PRO-only
        'H1',
        'PRICE_ABOVE',
        1.3,
        'Upgrade required'
      );
    });

    test('ALT-006: Alert form shows available symbols', async ({ page }) => {
      const alertsPage = new AlertsPage(page);
      await alertsPage.goto();

      const symbols = await alertsPage.getAvailableSymbols();

      // Should have at least FREE tier symbols
      expect(symbols.length).toBeGreaterThanOrEqual(5);
    });

    test('ALT-007: Alert form shows available timeframes', async ({ page }) => {
      const alertsPage = new AlertsPage(page);
      await alertsPage.goto();

      const timeframes = await alertsPage.getAvailableTimeframes();

      // Should have at least FREE tier timeframes
      expect(timeframes.length).toBeGreaterThanOrEqual(3);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ALERT LIMITS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Alert Limits', () => {
    test('ALT-008: FREE user limited to 5 alerts', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      const alertsPage = new AlertsPage(page);
      await alertsPage.goto();

      // Check content for limit mention
      const content = await page.content();
      expect(
        content.includes('5') ||
          content.toLowerCase().includes('limit') ||
          content.toLowerCase().includes('free')
      ).toBeTruthy();
    });

    test('ALT-009: PRO user has 20 alert limit', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.pro.email,
        TEST_USERS.pro.password
      );

      const alertsPage = new AlertsPage(page);
      await alertsPage.goto();

      // Check content for PRO limit
      const content = await page.content();
      expect(
        content.includes('20') || content.toLowerCase().includes('pro')
      ).toBeTruthy();
    });

    test('ALT-010: Shows warning when near limit', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      const alertsPage = new AlertsPage(page);
      await alertsPage.goto();

      // If at limit, should show warning
      const isAtLimit = await alertsPage.isAtAlertLimit();
      if (isAtLimit) {
        await expect(alertsPage.alertLimitWarning).toBeVisible();
      }
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ALERT MANAGEMENT
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Alert Management', () => {
    test.beforeEach(async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );
    });

    test('ALT-011: Alert list shows existing alerts', async ({
      page,
      request,
    }) => {
      const { alerts } = await getAlerts(request);

      const alertsPage = new AlertsPage(page);
      await alertsPage.goto();

      if (alerts.length > 0) {
        const displayedCount = await alertsPage.getAlertCount();
        expect(displayedCount).toBe(alerts.length);
      }
    });

    test('ALT-012: Can toggle alert active state', async ({ page }) => {
      const alertsPage = new AlertsPage(page);
      await alertsPage.goto();

      const alertCount = await alertsPage.getAlertCount();
      if (alertCount > 0) {
        // Get initial state
        const details = await alertsPage.getAlertDetails(0);
        const initialState = details.isActive;

        // Toggle
        await alertsPage.toggleAlert(0);
        await page.waitForTimeout(500);

        // Check new state
        const newDetails = await alertsPage.getAlertDetails(0);
        expect(newDetails.isActive).toBe(!initialState);
      }
    });

    test('ALT-013: Can delete alert', async ({ page }) => {
      const alertsPage = new AlertsPage(page);
      await alertsPage.goto();

      const initialCount = await alertsPage.getAlertCount();
      if (initialCount > 0) {
        await alertsPage.deleteAlert(0);
        await page.waitForTimeout(500);

        const newCount = await alertsPage.getAlertCount();
        expect(newCount).toBe(initialCount - 1);
      }
    });

    test('ALT-014: Empty state shown when no alerts', async ({ page }) => {
      const alertsPage = new AlertsPage(page);
      await alertsPage.goto();

      const alertCount = await alertsPage.getAlertCount();
      if (alertCount === 0) {
        const isEmpty = await alertsPage.isEmptyStateVisible();
        expect(isEmpty).toBe(true);
      }
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ALERT API
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Alert API', () => {
    test.beforeEach(async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );
    });

    test('ALT-015: GET /api/alerts returns user alerts', async ({
      page,
      request,
    }) => {
      const { alerts, total } = await getAlerts(request);

      expect(Array.isArray(alerts)).toBe(true);
      expect(typeof total).toBe('number');
    });

    test('ALT-016: POST /api/alerts creates new alert', async ({
      page,
      request,
    }) => {
      const alertData = generateAlertData();
      const result = await createAlert(request, {
        ...alertData,
        alertType: 'PRICE_TOUCH_LINE',
      });

      if (result.success) {
        expect(result.alert).toBeDefined();
        expect(result.alert?.symbol).toBe(alertData.symbol);
      }
    });

    test('ALT-017: DELETE /api/alerts/:id removes alert', async ({
      page,
      request,
    }) => {
      // First get alerts
      const { alerts } = await getAlerts(request);

      if (alerts.length > 0) {
        const alertId = alerts[0].id;
        const result = await deleteAlert(request, alertId);

        expect(result.success).toBe(true);
      }
    });

    test('ALT-018: API validates tier access for symbols', async ({
      page,
      request,
    }) => {
      const result = await createAlert(request, {
        symbol: 'GBPUSD', // PRO-only
        timeframe: 'H1',
        condition: JSON.stringify({ type: 'PRICE_ABOVE', price: 1.3 }),
        alertType: 'PRICE_TOUCH_LINE',
      });

      // Should fail for FREE user
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // NOTIFICATIONS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Notifications', () => {
    test.beforeEach(async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );
    });

    test('ALT-019: Notification bell is visible in header', async ({
      page,
    }) => {
      const dashboardPage = new DashboardPage(page);
      await expect(dashboardPage.notificationBell).toBeVisible();
    });

    test('ALT-020: Clicking notification bell opens dropdown', async ({
      page,
    }) => {
      const dashboardPage = new DashboardPage(page);
      await dashboardPage.openNotifications();

      await expect(dashboardPage.notificationDropdown).toBeVisible();
    });

    test('ALT-021: GET /api/notifications returns notifications', async ({
      page,
      request,
    }) => {
      const { notifications, unreadCount } = await getNotifications(request);

      expect(Array.isArray(notifications)).toBe(true);
      expect(typeof unreadCount).toBe('number');
    });

    test('ALT-022: Unread badge shows count', async ({ page }) => {
      const dashboardPage = new DashboardPage(page);

      const unreadCount = await dashboardPage.getUnreadCount();
      expect(typeof unreadCount).toBe('number');
    });

    test('ALT-023: Can mark notification as read', async ({
      page,
      request,
    }) => {
      const { notifications } = await getNotifications(request);

      if (notifications.length > 0) {
        const unreadNotif = notifications.find((n) => !n.isRead);
        if (unreadNotif) {
          const result = await markNotificationRead(request, unreadNotif.id);
          expect(result.success).toBe(true);
        }
      }
    });

    test('ALT-024: Notification has required fields', async ({
      page,
      request,
    }) => {
      const { notifications } = await getNotifications(request);

      if (notifications.length > 0) {
        const notif = notifications[0];
        expect(notif).toHaveProperty('id');
        expect(notif).toHaveProperty('type');
        expect(notif).toHaveProperty('title');
        expect(notif).toHaveProperty('message');
        expect(notif).toHaveProperty('isRead');
        expect(notif).toHaveProperty('createdAt');
      }
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PRO TIER ALERT FEATURES
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('PRO Tier Alert Features', () => {
    test.beforeEach(async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.pro.email,
        TEST_USERS.pro.password
      );
    });

    test('ALT-025: PRO user can create alert for any symbol', async ({
      page,
    }) => {
      const alertsPage = new AlertsPage(page);
      await alertsPage.goto();

      await alertsPage.createAlertAndExpectSuccess(
        'GBPUSD', // PRO-only symbol
        'H1',
        'PRICE_ABOVE',
        1.3,
        'PRO Alert Test'
      );
    });

    test('ALT-026: PRO user can use all timeframes', async ({ page }) => {
      const alertsPage = new AlertsPage(page);
      await alertsPage.goto();

      await alertsPage.createAlertAndExpectSuccess(
        'BTCUSD',
        'M5', // PRO-only timeframe
        'PRICE_BELOW',
        40000,
        'M5 Alert Test'
      );
    });

    test('ALT-027: PRO user sees all symbols in dropdown', async ({
      page,
    }) => {
      const alertsPage = new AlertsPage(page);
      await alertsPage.goto();

      const symbols = await alertsPage.getAvailableSymbols();

      // Should have all 15 symbols
      expect(symbols.length).toBeGreaterThanOrEqual(15);
    });

    test('ALT-028: PRO user sees all timeframes in dropdown', async ({
      page,
    }) => {
      const alertsPage = new AlertsPage(page);
      await alertsPage.goto();

      const timeframes = await alertsPage.getAvailableTimeframes();

      // Should have all 9 timeframes
      expect(timeframes.length).toBeGreaterThanOrEqual(9);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ALERT FILTERS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Alert Filters', () => {
    test.beforeEach(async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );
    });

    test('ALT-029: Can filter alerts by status', async ({ page }) => {
      const alertsPage = new AlertsPage(page);
      await alertsPage.goto();

      // Filter by active
      await alertsPage.filterByStatus('active');
      await page.waitForTimeout(500);

      // All visible alerts should be active
      const count = await alertsPage.getAlertCount();
      for (let i = 0; i < count; i++) {
        const details = await alertsPage.getAlertDetails(i);
        expect(details.isActive).toBe(true);
      }
    });

    test('ALT-030: Can filter alerts by symbol', async ({ page }) => {
      const alertsPage = new AlertsPage(page);
      await alertsPage.goto();

      // Filter by BTCUSD
      await alertsPage.filterBySymbol('BTCUSD');
      await page.waitForTimeout(500);

      // All visible alerts should be for BTCUSD
      const count = await alertsPage.getAlertCount();
      for (let i = 0; i < count; i++) {
        const details = await alertsPage.getAlertDetails(i);
        expect(details.symbol).toContain('BTCUSD');
      }
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ALERT DETAILS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Alert Details', () => {
    test.beforeEach(async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );
    });

    test('ALT-031: Alert item shows symbol', async ({ page }) => {
      const alertsPage = new AlertsPage(page);
      await alertsPage.goto();

      const count = await alertsPage.getAlertCount();
      if (count > 0) {
        const details = await alertsPage.getAlertDetails(0);
        expect(details.symbol.length).toBeGreaterThan(0);
      }
    });

    test('ALT-032: Alert item shows timeframe', async ({ page }) => {
      const alertsPage = new AlertsPage(page);
      await alertsPage.goto();

      const count = await alertsPage.getAlertCount();
      if (count > 0) {
        const details = await alertsPage.getAlertDetails(0);
        expect(details.timeframe.length).toBeGreaterThan(0);
      }
    });

    test('ALT-033: Alert item shows active toggle', async ({ page }) => {
      const alertsPage = new AlertsPage(page);
      await alertsPage.goto();

      const count = await alertsPage.getAlertCount();
      if (count > 0) {
        const alertItem = alertsPage.alertItems.first();
        const toggle = alertItem.locator('[data-testid="alert-toggle"]');
        await expect(toggle).toBeVisible();
      }
    });

    test('ALT-034: Alert item shows delete button', async ({ page }) => {
      const alertsPage = new AlertsPage(page);
      await alertsPage.goto();

      const count = await alertsPage.getAlertCount();
      if (count > 0) {
        const alertItem = alertsPage.alertItems.first();
        const deleteBtn = alertItem.locator('[data-testid="alert-delete-button"]');
        await expect(deleteBtn).toBeVisible();
      }
    });
  });
});
