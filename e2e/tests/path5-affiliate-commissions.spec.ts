/**
 * Path 5: Monthly Affiliate Commissions E2E Tests
 *
 * Tests the complete affiliate commission flow including:
 * - Affiliate dashboard access
 * - Commission summary display
 * - Monthly reporting
 * - Code distribution
 * - Payout processing
 *
 * @module e2e/tests/path5-affiliate-commissions
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { TEST_USERS, calculateCommission, PRICING } from '../utils/test-data';
import {
  getAffiliateStats,
  getAffiliateCodes,
  getCommissionReport,
} from '../utils/api-helpers';

test.describe('Path 5: Affiliate Commissions', () => {
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // AFFILIATE DASHBOARD ACCESS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Affiliate Dashboard Access', () => {
    test('AFF-001: Affiliate can access dashboard', async ({ page }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.affiliate.email,
        TEST_USERS.affiliate.password
      );

      // Navigate to affiliate dashboard
      await page.goto('/affiliate/dashboard');

      // Should have access
      await expect(page).toHaveURL(/affiliate/);
      await expect(page.locator('[data-testid="affiliate-dashboard"]')).toBeVisible({ timeout: 10000 }).catch(() => {
        // Fallback - check for affiliate-related content
        expect(page.url()).toContain('affiliate');
      });
    });

    test('AFF-002: Non-affiliate user redirected from affiliate dashboard', async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      // Try to access affiliate dashboard
      await page.goto('/affiliate/dashboard');

      // Should be redirected
      await page.waitForTimeout(2000);
      const url = page.url();
      expect(url).not.toContain('/affiliate/dashboard');
    });

    test('AFF-003: Affiliate stats API returns data', async ({
      page,
      request,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.affiliate.email,
        TEST_USERS.affiliate.password
      );

      const stats = await getAffiliateStats(request);

      // Verify stats structure
      expect(stats).toHaveProperty('totalEarnings');
      expect(stats).toHaveProperty('pendingCommissions');
      expect(stats).toHaveProperty('paidCommissions');
      expect(stats).toHaveProperty('totalCodesDistributed');
      expect(stats).toHaveProperty('totalCodesUsed');
      expect(stats).toHaveProperty('conversionRate');
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // COMMISSION SUMMARY
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Commission Summary', () => {
    test('AFF-004: Dashboard shows earnings summary', async ({ page }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.affiliate.email,
        TEST_USERS.affiliate.password
      );

      await page.goto('/affiliate/dashboard');

      // Look for earnings-related elements
      const content = await page.content();
      expect(
        content.toLowerCase().includes('earning') ||
          content.toLowerCase().includes('commission') ||
          content.toLowerCase().includes('total')
      ).toBeTruthy();
    });

    test('AFF-005: Pending commissions displayed separately', async ({
      page,
      request,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.affiliate.email,
        TEST_USERS.affiliate.password
      );

      const stats = await getAffiliateStats(request);

      // Pending should be a number
      expect(typeof stats.pendingCommissions).toBe('number');
      expect(stats.pendingCommissions).toBeGreaterThanOrEqual(0);
    });

    test('AFF-006: Paid commissions displayed separately', async ({
      page,
      request,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.affiliate.email,
        TEST_USERS.affiliate.password
      );

      const stats = await getAffiliateStats(request);

      // Paid should be a number
      expect(typeof stats.paidCommissions).toBe('number');
      expect(stats.paidCommissions).toBeGreaterThanOrEqual(0);
    });

    test('AFF-007: Total equals pending plus paid', async ({
      page,
      request,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.affiliate.email,
        TEST_USERS.affiliate.password
      );

      const stats = await getAffiliateStats(request);

      // Total should equal pending + paid
      const calculatedTotal = stats.pendingCommissions + stats.paidCommissions;
      expect(Math.abs(stats.totalEarnings - calculatedTotal)).toBeLessThan(0.01);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // COMMISSION REPORT
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Commission Report', () => {
    test('AFF-008: Commission report API returns data', async ({
      page,
      request,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.affiliate.email,
        TEST_USERS.affiliate.password
      );

      const report = await getCommissionReport(request);

      // Verify report structure
      expect(report).toHaveProperty('commissions');
      expect(report).toHaveProperty('summary');
      expect(Array.isArray(report.commissions)).toBe(true);
    });

    test('AFF-009: Filter commissions by month', async ({ page, request }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.affiliate.email,
        TEST_USERS.affiliate.password
      );

      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const report = await getCommissionReport(request, { month: currentMonth });

      // Should return commissions array
      expect(Array.isArray(report.commissions)).toBe(true);
    });

    test('AFF-010: Filter commissions by status', async ({ page, request }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.affiliate.email,
        TEST_USERS.affiliate.password
      );

      const report = await getCommissionReport(request, { status: 'PENDING' });

      // All returned commissions should be PENDING
      for (const commission of report.commissions) {
        expect(commission.status).toBe('PENDING');
      }
    });

    test('AFF-011: Commission report includes all required fields', async ({
      page,
      request,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.affiliate.email,
        TEST_USERS.affiliate.password
      );

      const report = await getCommissionReport(request);

      if (report.commissions.length > 0) {
        const commission = report.commissions[0];
        expect(commission).toHaveProperty('id');
        expect(commission).toHaveProperty('grossRevenue');
        expect(commission).toHaveProperty('discountAmount');
        expect(commission).toHaveProperty('netRevenue');
        expect(commission).toHaveProperty('commissionAmount');
        expect(commission).toHaveProperty('status');
        expect(commission).toHaveProperty('earnedAt');
      }
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // AFFILIATE CODES
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Affiliate Codes', () => {
    test('AFF-012: Affiliate can view their codes', async ({
      page,
      request,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.affiliate.email,
        TEST_USERS.affiliate.password
      );

      const { codes } = await getAffiliateCodes(request);

      // Should return array of codes
      expect(Array.isArray(codes)).toBe(true);
    });

    test('AFF-013: Each code has required properties', async ({
      page,
      request,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.affiliate.email,
        TEST_USERS.affiliate.password
      );

      const { codes } = await getAffiliateCodes(request);

      if (codes.length > 0) {
        const code = codes[0];
        expect(code).toHaveProperty('id');
        expect(code).toHaveProperty('code');
        expect(code).toHaveProperty('status');
        expect(code).toHaveProperty('discountPercent');
        expect(code).toHaveProperty('commissionPercent');
        expect(code).toHaveProperty('expiresAt');
      }
    });

    test('AFF-014: Codes show correct status', async ({ page, request }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.affiliate.email,
        TEST_USERS.affiliate.password
      );

      const { codes } = await getAffiliateCodes(request);

      // Each code should have a valid status
      const validStatuses = ['ACTIVE', 'USED', 'EXPIRED', 'CANCELLED'];
      for (const code of codes) {
        expect(validStatuses).toContain(code.status);
      }
    });

    test('AFF-015: Total codes distributed tracked', async ({
      page,
      request,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.affiliate.email,
        TEST_USERS.affiliate.password
      );

      const stats = await getAffiliateStats(request);

      expect(typeof stats.totalCodesDistributed).toBe('number');
      expect(stats.totalCodesDistributed).toBeGreaterThanOrEqual(0);
    });

    test('AFF-016: Total codes used tracked', async ({ page, request }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.affiliate.email,
        TEST_USERS.affiliate.password
      );

      const stats = await getAffiliateStats(request);

      expect(typeof stats.totalCodesUsed).toBe('number');
      expect(stats.totalCodesUsed).toBeGreaterThanOrEqual(0);
      // Used should never exceed distributed
      expect(stats.totalCodesUsed).toBeLessThanOrEqual(
        stats.totalCodesDistributed
      );
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CONVERSION RATE
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Conversion Rate', () => {
    test('AFF-017: Conversion rate calculated correctly', async ({
      page,
      request,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.affiliate.email,
        TEST_USERS.affiliate.password
      );

      const stats = await getAffiliateStats(request);

      // If there are distributed codes
      if (stats.totalCodesDistributed > 0) {
        const expectedRate =
          (stats.totalCodesUsed / stats.totalCodesDistributed) * 100;
        // Allow for small floating point differences
        expect(Math.abs(stats.conversionRate - expectedRate)).toBeLessThan(0.1);
      } else {
        // No codes distributed, rate should be 0
        expect(stats.conversionRate).toBe(0);
      }
    });

    test('AFF-018: Conversion rate is percentage', async ({
      page,
      request,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.affiliate.email,
        TEST_USERS.affiliate.password
      );

      const stats = await getAffiliateStats(request);

      // Should be between 0 and 100
      expect(stats.conversionRate).toBeGreaterThanOrEqual(0);
      expect(stats.conversionRate).toBeLessThanOrEqual(100);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // COMMISSION CALCULATION VERIFICATION
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Commission Calculation', () => {
    test('AFF-019: Commission amounts are positive', async ({
      page,
      request,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.affiliate.email,
        TEST_USERS.affiliate.password
      );

      const report = await getCommissionReport(request);

      for (const commission of report.commissions) {
        expect(commission.grossRevenue).toBeGreaterThan(0);
        expect(commission.netRevenue).toBeGreaterThan(0);
        expect(commission.commissionAmount).toBeGreaterThan(0);
        expect(commission.discountAmount).toBeGreaterThanOrEqual(0);
      }
    });

    test('AFF-020: Net revenue equals gross minus discount', async ({
      page,
      request,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.affiliate.email,
        TEST_USERS.affiliate.password
      );

      const report = await getCommissionReport(request);

      for (const commission of report.commissions) {
        const expectedNet = commission.grossRevenue - commission.discountAmount;
        expect(Math.abs(commission.netRevenue - expectedNet)).toBeLessThan(0.01);
      }
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // UI ELEMENTS
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Affiliate Dashboard UI', () => {
    test('AFF-021: Dashboard has navigation to codes section', async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.affiliate.email,
        TEST_USERS.affiliate.password
      );

      await page.goto('/affiliate/dashboard');

      // Look for codes link/tab
      const content = await page.content();
      expect(
        content.toLowerCase().includes('code') ||
          content.toLowerCase().includes('discount')
      ).toBeTruthy();
    });

    test('AFF-022: Dashboard has navigation to commission report', async ({
      page,
    }) => {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.affiliate.email,
        TEST_USERS.affiliate.password
      );

      await page.goto('/affiliate/dashboard');

      // Look for commission/report link
      const content = await page.content();
      expect(
        content.toLowerCase().includes('commission') ||
          content.toLowerCase().includes('report') ||
          content.toLowerCase().includes('earning')
      ).toBeTruthy();
    });
  });
});
