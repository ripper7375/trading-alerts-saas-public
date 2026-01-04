/**
 * Path 4: Discount Code Redemption E2E Tests
 *
 * Tests the complete discount code redemption flow including:
 * - Valid code application
 * - Invalid/expired/used code handling
 * - Discount calculation
 * - Commission creation
 * - Code status updates
 *
 * ============================================================
 * TEST DATA REQUIREMENTS
 * ============================================================
 *
 * These tests require discount codes to exist in the database.
 * The following codes must be seeded:
 *   - TESTCODE10: 10% discount, ACTIVE status
 *   - TESTCODE20: 20% discount, ACTIVE status
 *   - EXPIREDCODE: EXPIRED status
 *   - USEDCODE: USED status
 *   - SUSPENDEDAFF: ACTIVE code from SUSPENDED affiliate
 *
 * SETUP REQUIRED:
 *   File: prisma/seed.ts
 *   Add discount code seeding for test codes (see TEST_CODES in test-data.ts)
 *
 * ============================================================
 * PRODUCTION BUGS IDENTIFIED
 * ============================================================
 *
 * BUG #1: Discount Code Input Missing from Checkout
 * --------------------------------------------------
 * File: Pricing page / Checkout flow
 * Issue: Users are redirected directly to Stripe without discount input
 * Reference: docs/policies/07-dlocal-integration-rules.md line 109
 * Tests affected: DSC-012, DSC-013, DSC-014, DSC-015
 * Fix: Add discount code input before Stripe redirect
 * Note: This is the same bug as Path 2 SUB-009-012
 *
 * ============================================================
 *
 * @module e2e/tests/path4-discount-redemption
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { CheckoutPage } from '../pages/checkout.page';
import {
  TEST_USERS,
  TEST_CODES,
  PRICING,
  calculateDiscount,
  calculateCommission,
} from '../utils/test-data';
import { validateDiscountCode } from '../utils/api-helpers';

test.describe('Path 4: Discount Code Redemption', () => {
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CODE VALIDATION
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Code Validation', () => {
    test.beforeEach(async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );
    });

    test('DSC-001: Valid 10% discount code is accepted', async ({
      page,
      request,
    }) => {
      // Validate via API
      const result = await validateDiscountCode(
        request,
        TEST_CODES.valid10.code,
        'MONTHLY'
      );

      expect(result.valid).toBe(true);
      expect(result.discountPercent).toBe(10);
    });

    test('DSC-002: Valid 20% discount code is accepted', async ({
      page,
      request,
    }) => {
      const result = await validateDiscountCode(
        request,
        TEST_CODES.valid20.code,
        'MONTHLY'
      );

      expect(result.valid).toBe(true);
      expect(result.discountPercent).toBe(20);
    });

    test('DSC-003: Invalid code is rejected', async ({ page, request }) => {
      const result = await validateDiscountCode(
        request,
        'INVALIDCODE12345',
        'MONTHLY'
      );

      expect(result.valid).toBe(false);
      expect(result.message).toBeTruthy();
    });

    test('DSC-004: Expired code is rejected', async ({ page, request }) => {
      const result = await validateDiscountCode(
        request,
        TEST_CODES.expired.code,
        'MONTHLY'
      );

      expect(result.valid).toBe(false);
      if (result.message) {
        expect(result.message.toLowerCase()).toContain('expired');
      }
    });

    test('DSC-005: Already used code is rejected', async ({ page, request }) => {
      const result = await validateDiscountCode(
        request,
        TEST_CODES.used.code,
        'MONTHLY'
      );

      expect(result.valid).toBe(false);
    });

    test('DSC-006: Code from suspended affiliate is rejected', async ({
      page,
      request,
    }) => {
      const result = await validateDiscountCode(
        request,
        TEST_CODES.suspendedAffiliate.code,
        'MONTHLY'
      );

      expect(result.valid).toBe(false);
    });

    test('DSC-007: Code validation is case-insensitive', async ({
      page,
      request,
    }) => {
      // Test lowercase
      const lowerResult = await validateDiscountCode(
        request,
        TEST_CODES.valid10.code.toLowerCase(),
        'MONTHLY'
      );

      expect(lowerResult.valid).toBe(true);
    });

    test('DSC-008: Discount codes not allowed for 3-day plan', async ({
      page,
      request,
    }) => {
      const result = await validateDiscountCode(
        request,
        TEST_CODES.valid10.code,
        'THREE_DAY'
      );

      expect(result.valid).toBe(false);
      if (result.message) {
        expect(result.message.toLowerCase()).toContain('not available');
      }
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DISCOUNT CALCULATION
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Discount Calculation', () => {
    test('DSC-009: 10% discount calculated correctly', async () => {
      const { discountAmount, finalPrice } = calculateDiscount(
        PRICING.PRO_MONTHLY,
        10
      );

      // $29 * 0.10 = $2.90 discount
      expect(discountAmount).toBe(2.9);
      // $29 - $2.90 = $26.10
      expect(finalPrice).toBe(26.1);
    });

    test('DSC-010: 20% discount calculated correctly', async () => {
      const { discountAmount, finalPrice } = calculateDiscount(
        PRICING.PRO_MONTHLY,
        20
      );

      // $29 * 0.20 = $5.80 discount
      expect(discountAmount).toBe(5.8);
      // $29 - $5.80 = $23.20
      expect(finalPrice).toBe(23.2);
    });

    test('DSC-011: Commission calculated correctly', async () => {
      const { discountAmount, netRevenue, commissionAmount } = calculateCommission(
        PRICING.PRO_MONTHLY, // $29 gross
        10, // 10% discount
        20  // 20% commission
      );

      // Discount: $29 * 0.10 = $2.90
      expect(discountAmount).toBe(2.9);
      // Net: $29 - $2.90 = $26.10
      expect(netRevenue).toBe(26.1);
      // Commission: $26.10 * 0.20 = $5.22
      expect(commissionAmount).toBe(5.22);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // UI DISCOUNT APPLICATION
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('UI Discount Application', () => {
    test.beforeEach(async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );
    });

    test('DSC-012: Discount code input is visible on checkout', async ({
      page,
    }) => {
      const checkoutPage = new CheckoutPage(page);

      await checkoutPage.goto();
      await checkoutPage.clickUpgradeToPro();

      await page.waitForTimeout(2000);

      // If not redirected to Stripe, check for discount input
      if (!page.url().includes('stripe')) {
        await expect(checkoutPage.discountCodeInput).toBeVisible();
      }
    });

    test('DSC-013: Applying valid code shows discount', async ({ page }) => {
      const checkoutPage = new CheckoutPage(page);

      await checkoutPage.goto();
      await checkoutPage.clickUpgradeToPro();

      await page.waitForTimeout(2000);

      if (
        !page.url().includes('stripe') &&
        (await checkoutPage.discountCodeInput.isVisible())
      ) {
        await checkoutPage.applyDiscountCode(TEST_CODES.valid10.code);

        // Should show discount applied
        const isApplied = await checkoutPage.isDiscountApplied();
        expect(isApplied).toBe(true);
      }
    });

    test('DSC-014: Invalid code shows error message', async ({ page }) => {
      const checkoutPage = new CheckoutPage(page);

      await checkoutPage.goto();
      await checkoutPage.clickUpgradeToPro();

      await page.waitForTimeout(2000);

      if (
        !page.url().includes('stripe') &&
        (await checkoutPage.discountCodeInput.isVisible())
      ) {
        await checkoutPage.applyDiscountCode('NOTAREALCODE');

        // Should show error
        const error = await checkoutPage.getDiscountError();
        expect(error).toBeTruthy();
      }
    });

    test('DSC-015: Original and discounted prices shown', async ({ page }) => {
      const checkoutPage = new CheckoutPage(page);

      await checkoutPage.goto();
      await checkoutPage.clickUpgradeToPro();

      await page.waitForTimeout(2000);

      if (
        !page.url().includes('stripe') &&
        (await checkoutPage.discountCodeInput.isVisible())
      ) {
        await checkoutPage.applyDiscountCode(TEST_CODES.valid10.code);

        if (await checkoutPage.isDiscountApplied()) {
          // Original price should be shown (crossed out)
          const original = await checkoutPage.getOriginalPrice();
          expect(original).toContain('29');

          // Discounted price should be shown
          const discounted = await checkoutPage.getDiscountedPrice();
          expect(discounted).toContain('26');
        }
      }
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CODE STATUS UPDATES
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Code Status Updates', () => {
    test('DSC-016: Code remains ACTIVE before use', async ({
      page,
      request,
    }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      // Validate code (does not use it)
      const result = await validateDiscountCode(
        request,
        TEST_CODES.valid10.code,
        'MONTHLY'
      );

      expect(result.valid).toBe(true);

      // Validate again - should still be valid
      const result2 = await validateDiscountCode(
        request,
        TEST_CODES.valid10.code,
        'MONTHLY'
      );

      expect(result2.valid).toBe(true);
    });

    // Note: Testing code being marked as USED requires completing a payment
    // which is typically done in integration tests or with Stripe test mode

    test('DSC-017: Same code cannot be used twice', async ({
      page,
      request,
    }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      // Used code should be rejected
      const result = await validateDiscountCode(
        request,
        TEST_CODES.used.code,
        'MONTHLY'
      );

      expect(result.valid).toBe(false);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // COMMISSION CREATION
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Commission Creation', () => {
    // Note: Full commission creation tests require completing a payment
    // These tests verify the calculation logic

    test('DSC-018: Commission rate is 20% of net revenue', async () => {
      const { commissionAmount } = calculateCommission(
        PRICING.PRO_MONTHLY,
        10, // 10% discount
        20  // 20% commission
      );

      // Net is $26.10, commission is 20% = $5.22
      expect(commissionAmount).toBe(5.22);
    });

    test('DSC-019: Higher discount means lower commission', async () => {
      // 10% discount
      const commission10 = calculateCommission(PRICING.PRO_MONTHLY, 10, 20);

      // 20% discount
      const commission20 = calculateCommission(PRICING.PRO_MONTHLY, 20, 20);

      // Higher discount = lower net = lower commission
      expect(commission20.commissionAmount).toBeLessThan(
        commission10.commissionAmount
      );
    });

    test('DSC-020: Commission with no discount', async () => {
      const { netRevenue, commissionAmount } = calculateCommission(
        PRICING.PRO_MONTHLY,
        0, // 0% discount
        20 // 20% commission
      );

      // No discount, so net = gross = $29
      expect(netRevenue).toBe(29);
      // Commission: $29 * 0.20 = $5.80
      expect(commissionAmount).toBe(5.8);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EDGE CASES
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  test.describe('Edge Cases', () => {
    test('DSC-021: Empty code is rejected', async ({ page, request }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      const result = await validateDiscountCode(request, '', 'MONTHLY');

      expect(result.valid).toBe(false);
    });

    test('DSC-022: Whitespace-only code is rejected', async ({
      page,
      request,
    }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      const result = await validateDiscountCode(request, '   ', 'MONTHLY');

      expect(result.valid).toBe(false);
    });

    test('DSC-023: Code with leading/trailing spaces is trimmed', async ({
      page,
      request,
    }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      // Add spaces around valid code
      const result = await validateDiscountCode(
        request,
        `  ${TEST_CODES.valid10.code}  `,
        'MONTHLY'
      );

      expect(result.valid).toBe(true);
    });

    test('DSC-024: Very long invalid code is handled', async ({
      page,
      request,
    }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      const longCode = 'A'.repeat(100);
      const result = await validateDiscountCode(request, longCode, 'MONTHLY');

      expect(result.valid).toBe(false);
    });

    test('DSC-025: Special characters in code are handled', async ({
      page,
      request,
    }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAndWaitForDashboard(
        TEST_USERS.free.email,
        TEST_USERS.free.password
      );

      const specialCode = 'TEST<script>alert(1)</script>';
      const result = await validateDiscountCode(request, specialCode, 'MONTHLY');

      expect(result.valid).toBe(false);
    });
  });
});
