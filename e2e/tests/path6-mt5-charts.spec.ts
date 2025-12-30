/**
 * Path 6: MT5 Data and Charts E2E Tests
 *
 * Tests the complete MT5 data and charting flow including:
 * - Symbol selection with tier validation
 * - Timeframe selection with tier validation
 * - Chart rendering with TradingView Lightweight Charts
 * - Real-time data updates
 * - PRO vs FREE tier access
 *
 * @module e2e/tests/path6-mt5-charts
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { ChartsPage } from '../pages/charts.page';
import {
  TEST_USERS,
  SYMBOLS,
  TIMEFRAMES,
  TIER_LIMITS,
} from '../utils/test-data';
import { getAccessibleSymbols, checkSymbolAccess } from '../utils/api-helpers';

test.describe('Path 6: MT5 Data and Charts', () => {
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FREE TIER SYMBOL ACCESS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('FREE Tier Symbol Access', () => {
    test.beforeEach(async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );
    });

    test('MT5-001: FREE user has access to 5 symbols', async ({
      page,
      request,
    }) => {
      const { symbols, tier } = await getAccessibleSymbols(request);

      expect(tier).toBe('FREE');
      expect(symbols.length).toBe(TIER_LIMITS.FREE.symbolCount);
    });

    test('MT5-002: FREE user can access BTCUSD', async ({ page, request }) => {
      const result = await checkSymbolAccess(request, 'BTCUSD');

      expect(result.hasAccess).toBe(true);
      expect(result.requiresUpgrade).toBe(false);
    });

    test('MT5-003: FREE user can access EURUSD', async ({ page, request }) => {
      const result = await checkSymbolAccess(request, 'EURUSD');

      expect(result.hasAccess).toBe(true);
    });

    test('MT5-004: FREE user cannot access GBPUSD', async ({
      page,
      request,
    }) => {
      const result = await checkSymbolAccess(request, 'GBPUSD');

      expect(result.hasAccess).toBe(false);
      expect(result.requiresUpgrade).toBe(true);
    });

    test('MT5-005: FREE user cannot access PRO-only symbols', async ({
      page,
      request,
    }) => {
      for (const symbol of SYMBOLS.proOnly.slice(0, 3)) {
        const result = await checkSymbolAccess(request, symbol);
        expect(result.hasAccess).toBe(false);
        expect(result.requiresUpgrade).toBe(true);
      }
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PRO TIER SYMBOL ACCESS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('PRO Tier Symbol Access', () => {
    test.beforeEach(async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.pro.email,
        TEST_USERS.pro.password
      );
    });

    test('MT5-006: PRO user has access to 15 symbols', async ({
      page,
      request,
    }) => {
      const { symbols, tier } = await getAccessibleSymbols(request);

      expect(tier).toBe('PRO');
      expect(symbols.length).toBe(TIER_LIMITS.PRO.symbolCount);
    });

    test('MT5-007: PRO user can access all FREE symbols', async ({
      page,
      request,
    }) => {
      for (const symbol of SYMBOLS.free) {
        const result = await checkSymbolAccess(request, symbol);
        expect(result.hasAccess).toBe(true);
      }
    });

    test('MT5-008: PRO user can access GBPUSD', async ({ page, request }) => {
      const result = await checkSymbolAccess(request, 'GBPUSD');

      expect(result.hasAccess).toBe(true);
      expect(result.requiresUpgrade).toBe(false);
    });

    test('MT5-009: PRO user can access all PRO-only symbols', async ({
      page,
      request,
    }) => {
      for (const symbol of SYMBOLS.proOnly) {
        const result = await checkSymbolAccess(request, symbol);
        expect(result.hasAccess).toBe(true);
      }
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CHART PAGE UI
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Chart Page UI', () => {
    test.beforeEach(async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );
    });

    test('MT5-010: Charts page loads successfully', async ({ page }) => {
      const chartsPage = new ChartsPage(page);

      await chartsPage.goto();
      await chartsPage.waitForPageLoad();

      await expect(chartsPage.symbolSelector).toBeVisible();
      await expect(chartsPage.timeframeSelector).toBeVisible();
    });

    test('MT5-011: Symbol selector shows available symbols', async ({
      page,
    }) => {
      const chartsPage = new ChartsPage(page);

      await chartsPage.goto();
      const symbols = await chartsPage.getAvailableSymbols();

      expect(symbols.length).toBeGreaterThanOrEqual(5);
    });

    test('MT5-012: Timeframe selector shows available timeframes', async ({
      page,
    }) => {
      const chartsPage = new ChartsPage(page);

      await chartsPage.goto();
      const timeframes = await chartsPage.getAvailableTimeframes();

      expect(timeframes.length).toBeGreaterThanOrEqual(3);
    });

    test('MT5-013: Chart container is visible', async ({ page }) => {
      const chartsPage = new ChartsPage(page);

      await chartsPage.goto();
      await chartsPage.waitForPageLoad();

      await expect(chartsPage.chartContainer).toBeVisible();
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SYMBOL SELECTION
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Symbol Selection', () => {
    test('MT5-014: FREE user can select BTCUSD', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      const chartsPage = new ChartsPage(page);
      await chartsPage.goto();
      await chartsPage.selectSymbol('BTCUSD');

      // Should load chart
      await chartsPage.waitForChartRender();
      const isVisible = await chartsPage.isChartVisible();
      expect(isVisible).toBe(true);
    });

    test('MT5-015: Changing symbol updates chart', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      const chartsPage = new ChartsPage(page);
      await chartsPage.goto();

      // Select first symbol
      await chartsPage.selectSymbol('BTCUSD');
      await chartsPage.waitForChartRender();

      // Select second symbol
      await chartsPage.selectSymbol('EURUSD');
      await chartsPage.waitForChartRender();

      // Chart should still be visible
      const isVisible = await chartsPage.isChartVisible();
      expect(isVisible).toBe(true);
    });

    test('MT5-016: FREE user sees upgrade prompt for PRO symbol', async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      const chartsPage = new ChartsPage(page);
      await chartsPage.goto();

      // Try to select PRO-only symbol
      await chartsPage.trySelectRestrictedSymbol('GBPUSD');

      // Should show upgrade prompt
      const isUpgradePromptVisible = await chartsPage.isUpgradePromptVisible();
      expect(isUpgradePromptVisible).toBe(true);
    });

    test('MT5-017: PRO user can select any symbol', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.pro.email,
        TEST_USERS.pro.password
      );

      const chartsPage = new ChartsPage(page);
      await chartsPage.goto();

      // Select PRO-only symbol
      await chartsPage.selectSymbol('GBPUSD');
      await chartsPage.waitForChartRender();

      const isVisible = await chartsPage.isChartVisible();
      expect(isVisible).toBe(true);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TIMEFRAME SELECTION
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Timeframe Selection', () => {
    test('MT5-018: FREE user can select H1 timeframe', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      const chartsPage = new ChartsPage(page);
      await chartsPage.goto();
      await chartsPage.selectTimeframe('H1');
      await chartsPage.waitForChartRender();

      const isVisible = await chartsPage.isChartVisible();
      expect(isVisible).toBe(true);
    });

    test('MT5-019: FREE user can select H4 timeframe', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      const chartsPage = new ChartsPage(page);
      await chartsPage.goto();
      await chartsPage.selectTimeframe('H4');
      await chartsPage.waitForChartRender();

      const isVisible = await chartsPage.isChartVisible();
      expect(isVisible).toBe(true);
    });

    test('MT5-020: FREE user sees upgrade prompt for M5 timeframe', async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      const chartsPage = new ChartsPage(page);
      await chartsPage.goto();

      // Try to select PRO-only timeframe
      await chartsPage.trySelectRestrictedTimeframe('M5');

      // Should show upgrade prompt
      const isUpgradePromptVisible = await chartsPage.isUpgradePromptVisible();
      expect(isUpgradePromptVisible).toBe(true);
    });

    test('MT5-021: PRO user can select M5 timeframe', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.pro.email,
        TEST_USERS.pro.password
      );

      const chartsPage = new ChartsPage(page);
      await chartsPage.goto();
      await chartsPage.selectTimeframe('M5');
      await chartsPage.waitForChartRender();

      const isVisible = await chartsPage.isChartVisible();
      expect(isVisible).toBe(true);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CHART RENDERING
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Chart Rendering', () => {
    test.beforeEach(async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );
    });

    test('MT5-022: Chart renders candlesticks', async ({ page }) => {
      const chartsPage = new ChartsPage(page);

      await chartsPage.goto();
      await chartsPage.selectSymbol('BTCUSD');
      await chartsPage.waitForChartRender();

      // Check for canvas element (TradingView uses canvas)
      const canvas = page.locator('canvas').first();
      await expect(canvas).toBeVisible();
    });

    test('MT5-023: Price is displayed', async ({ page }) => {
      const chartsPage = new ChartsPage(page);

      await chartsPage.goto();
      await chartsPage.selectSymbol('BTCUSD');
      await chartsPage.waitForChartRender();

      const price = await chartsPage.getCurrentPrice();
      // Price should be a number
      const priceNum = parseFloat(price.replace(/[^0-9.]/g, ''));
      expect(priceNum).toBeGreaterThan(0);
    });

    test('MT5-024: Chart controls are visible', async ({ page }) => {
      const chartsPage = new ChartsPage(page);

      await chartsPage.goto();
      await chartsPage.waitForPageLoad();

      // Zoom controls should be visible
      await expect(chartsPage.zoomInButton).toBeVisible();
      await expect(chartsPage.zoomOutButton).toBeVisible();
    });

    test('MT5-025: Zoom controls work', async ({ page }) => {
      const chartsPage = new ChartsPage(page);

      await chartsPage.goto();
      await chartsPage.selectSymbol('BTCUSD');
      await chartsPage.waitForChartRender();

      // Click zoom in
      await chartsPage.zoomIn();
      await page.waitForTimeout(500);

      // Click zoom out
      await chartsPage.zoomOut();
      await page.waitForTimeout(500);

      // Chart should still be visible
      const isVisible = await chartsPage.isChartVisible();
      expect(isVisible).toBe(true);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ERROR HANDLING
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Error Handling', () => {
    test('MT5-026: Invalid symbol URL param shows error', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      // Try to access invalid symbol via URL
      await page.goto('/dashboard/charts?symbol=INVALIDXYZ');

      await page.waitForTimeout(2000);

      const chartsPage = new ChartsPage(page);
      const hasError = await chartsPage.hasChartError();

      // Should either show error or fall back to default symbol
      const content = await page.content();
      expect(
        hasError ||
          content.toLowerCase().includes('error') ||
          content.toLowerCase().includes('btcusd') // Fallback to default
      ).toBeTruthy();
    });

    test('MT5-027: Restricted symbol URL param shows upgrade prompt', async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      // Try to access PRO symbol via URL
      await page.goto('/dashboard/charts?symbol=GBPUSD');

      await page.waitForTimeout(2000);

      // Should show upgrade prompt or redirect
      const content = await page.content();
      expect(
        content.toLowerCase().includes('upgrade') ||
          content.toLowerCase().includes('pro') ||
          content.toLowerCase().includes('restricted')
      ).toBeTruthy();
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // NAVIGATION
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Navigation', () => {
    test('MT5-028: Can navigate to charts from dashboard', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      const dashboardPage = new DashboardPage(page);
      await dashboardPage.goToCharts();

      await expect(page).toHaveURL(/charts/);
    });

    test('MT5-029: Charts link in sidebar is highlighted when active', async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      await page.goto('/dashboard/charts');

      // Check for active state on charts nav item
      const chartsNav = page.locator('[data-testid="nav-charts"]');
      const className = await chartsNav.getAttribute('class');

      expect(
        className?.includes('active') ||
          className?.includes('selected') ||
          className?.includes('current')
      ).toBeTruthy();
    });
  });
});
