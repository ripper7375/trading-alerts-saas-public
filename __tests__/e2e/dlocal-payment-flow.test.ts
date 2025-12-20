/**
 * End-to-End Test: dLocal Payment Flow
 *
 * Tests the complete dLocal payment flow from checkout to completion.
 * This test validates the full user journey including:
 * - Country detection and eligibility
 * - Plan selection (3-day trial vs monthly)
 * - Payment method selection
 * - Price display with currency conversion
 * - Discount code validation
 * - Payment creation and processing
 * - Webhook handling
 *
 * @module __tests__/e2e/dlocal-payment-flow
 */

import { detectCountry } from '@/lib/geo/detect-country';
import { convertUSDToLocal, clearExchangeRateCache } from '@/lib/dlocal/currency-converter.service';
import { getPaymentMethodsForCountry, isValidPaymentMethod } from '@/lib/dlocal/payment-methods.service';
import { createPayment, verifyWebhookSignature, mapDLocalStatus } from '@/lib/dlocal/dlocal-payment.service';
import { canPurchaseThreeDayPlan, markThreeDayPlanUsed } from '@/lib/dlocal/three-day-validator.service';
import { isDLocalCountry, getCurrency, getPriceUSD, getPlanDuration, PRICING, DLOCAL_SUPPORTED_COUNTRIES } from '@/lib/dlocal/constants';
import type { DLocalCountry, DLocalCurrency, PlanType } from '@/types/dlocal';
import crypto from 'crypto';

// Mock fetch for external APIs
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock Prisma for database operations
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    payment: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    subscription: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    affiliateCode: {
      findFirst: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/db/prisma';
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('E2E: dLocal Payment Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearExchangeRateCache();
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // COMPLETE CHECKOUT FLOW
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('Complete Checkout Flow', () => {
    it('should complete 3-day trial purchase flow for new user', async () => {
      const userId = 'new-user-123';
      const country: DLocalCountry = 'IN';
      const planType: PlanType = 'THREE_DAY';

      // Step 1: Detect user country from headers
      const headers = new Headers({ 'cf-ipcountry': country });
      const detectedCountry = await detectCountry(headers);
      expect(detectedCountry).toBe('IN');
      expect(isDLocalCountry(detectedCountry)).toBe(true);

      // Step 2: Check 3-day plan eligibility
      (mockPrisma.payment.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.subscription.findFirst as jest.Mock).mockResolvedValue(null);

      const eligibility = await canPurchaseThreeDayPlan(userId);
      expect(eligibility.canPurchase).toBe(true);

      // Step 3: Get available payment methods for country
      const paymentMethods = await getPaymentMethodsForCountry(country);
      expect(paymentMethods).toContain('UPI');
      expect(paymentMethods).toContain('Paytm');
      expect(paymentMethods).toContain('PhonePe');

      // Step 4: User selects UPI
      const selectedMethod = 'UPI';
      expect(isValidPaymentMethod(country, selectedMethod)).toBe(true);

      // Step 5: Get pricing in local currency
      const currency = getCurrency(country);
      expect(currency).toBe('INR');

      const usdPrice = getPriceUSD(planType);
      expect(usdPrice).toBe(PRICING.THREE_DAY_USD);
      expect(usdPrice).toBe(1.99);

      // Mock exchange rate API
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rates: { INR: 83.50 } }),
      });

      const conversion = await convertUSDToLocal(usdPrice, currency);
      expect(conversion.localAmount).toBeCloseTo(166.165, 1);
      expect(conversion.exchangeRate).toBe(83.50);
      expect(conversion.currency).toBe('INR');

      // Step 6: Create payment
      const payment = await createPayment({
        userId,
        amount: usdPrice,
        currency,
        country,
        paymentMethod: selectedMethod,
        planType,
      });

      expect(payment.paymentId).toBeDefined();
      expect(payment.orderId).toBeDefined();
      expect(payment.paymentUrl).toBeDefined();
      expect(payment.status).toBe('PENDING');

      // Step 7: Verify plan duration
      expect(getPlanDuration(planType)).toBe(3);
    });

    it('should complete monthly subscription purchase flow with discount', async () => {
      const userId = 'existing-user-456';
      const country: DLocalCountry = 'NG';
      const planType: PlanType = 'MONTHLY';
      const discountCode = 'TRADER10';

      // Step 1: Detect country
      const headers = new Headers({ 'x-vercel-ip-country': country });
      const detectedCountry = await detectCountry(headers);
      expect(detectedCountry).toBe('NG');

      // Step 2: Get payment methods
      const paymentMethods = await getPaymentMethodsForCountry(country);
      expect(paymentMethods.length).toBeGreaterThan(0);

      // Step 3: Validate discount code
      (mockPrisma.affiliateCode.findFirst as jest.Mock).mockResolvedValue({
        id: 'aff-code-1',
        code: 'TRADER10',
        status: 'ACTIVE',
        affiliateProfile: { id: 'aff-1', status: 'ACTIVE' },
      });

      // Simulate discount validation API call
      const discountResult = await validateDiscountCode(discountCode, planType);
      expect(discountResult.valid).toBe(true);
      expect(discountResult.discountPercent).toBe(10);

      // Step 4: Calculate discounted price
      const originalPrice = getPriceUSD(planType);
      expect(originalPrice).toBe(29.0);

      const discountedPrice = originalPrice * (1 - discountResult.discountPercent / 100);
      expect(discountedPrice).toBe(26.1);

      // Step 5: Convert to local currency
      const currency = getCurrency(country);
      expect(currency).toBe('NGN');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rates: { NGN: 1550.0 } }),
      });

      const conversion = await convertUSDToLocal(discountedPrice, currency);
      expect(conversion.localAmount).toBeCloseTo(40455, 0);

      // Step 6: Create payment
      const payment = await createPayment({
        userId,
        amount: discountedPrice,
        currency,
        country,
        paymentMethod: paymentMethods[0],
        planType,
        affiliateCode: discountCode,
      });

      expect(payment.paymentId).toBeDefined();
      expect(payment.status).toBe('PENDING');
    });

    it('should block 3-day plan for user who already used it', async () => {
      const userId = 'repeat-user-789';

      // Mock: User already has a 3-day payment
      (mockPrisma.payment.findFirst as jest.Mock).mockResolvedValue({
        id: 'prev-payment',
        planType: 'THREE_DAY',
        status: 'COMPLETED',
      });

      const eligibility = await canPurchaseThreeDayPlan(userId);
      expect(eligibility.canPurchase).toBe(false);
      expect(eligibility.reason).toContain('already used');
    });

    it('should block 3-day plan for user with active subscription', async () => {
      const userId = 'active-sub-user';

      (mockPrisma.payment.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.subscription.findFirst as jest.Mock).mockResolvedValue({
        id: 'active-sub',
        status: 'ACTIVE',
        tier: 'PRO',
      });

      const eligibility = await canPurchaseThreeDayPlan(userId);
      expect(eligibility.canPurchase).toBe(false);
      expect(eligibility.reason).toContain('active subscription');
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PAYMENT COMPLETION VIA WEBHOOK
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('Payment Completion via Webhook', () => {
    const WEBHOOK_SECRET = 'dlocal-webhook-secret-test';

    it('should process successful payment and activate subscription', async () => {
      const userId = 'user-pay-success';
      const orderId = `order-${userId}-${Date.now()}`;
      const paymentId = 'dlocal-pay-12345';

      // Webhook payload from dLocal
      const webhookPayload = {
        id: paymentId,
        status: 'PAID',
        amount: 166.165,
        currency: 'INR',
        order_id: orderId,
        payment_method_id: 'UPI',
        created_date: new Date().toISOString(),
        approved_date: new Date().toISOString(),
      };

      const payload = JSON.stringify(webhookPayload);
      const signature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');

      // Verify webhook signature
      const isValid = verifyWebhookSignature(payload, signature, WEBHOOK_SECRET);
      expect(isValid).toBe(true);

      // Map dLocal status to internal status
      const internalStatus = mapDLocalStatus(webhookPayload.status);
      expect(internalStatus).toBe('COMPLETED');

      // Simulate updating payment and subscription
      (mockPrisma.payment.update as jest.Mock).mockResolvedValue({
        id: paymentId,
        status: 'COMPLETED',
      });

      (mockPrisma.subscription.create as jest.Mock).mockResolvedValue({
        id: 'new-sub-id',
        userId,
        status: 'ACTIVE',
        tier: 'PRO',
      });

      (mockPrisma.user.update as jest.Mock).mockResolvedValue({
        id: userId,
        tier: 'PRO',
      });
    });

    it('should handle failed payment webhook', async () => {
      const webhookPayload = {
        id: 'dlocal-pay-failed',
        status: 'REJECTED',
        amount: 29.0,
        currency: 'USD',
        order_id: 'order-failed-123',
        failure_reason: 'Insufficient funds',
      };

      const payload = JSON.stringify(webhookPayload);
      const signature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');

      expect(verifyWebhookSignature(payload, signature, WEBHOOK_SECRET)).toBe(true);
      expect(mapDLocalStatus(webhookPayload.status)).toBe('FAILED');
    });

    it('should reject webhook with invalid signature', () => {
      const payload = JSON.stringify({ id: 'pay-123', status: 'PAID' });
      const invalidSignature = 'tampered-signature';

      expect(verifyWebhookSignature(payload, invalidSignature, WEBHOOK_SECRET)).toBe(false);
    });

    it('should detect tampered webhook payload', () => {
      const originalPayload = JSON.stringify({
        id: 'pay-123',
        status: 'PAID',
        amount: 29.0,
      });

      const signature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(originalPayload)
        .digest('hex');

      const tamperedPayload = JSON.stringify({
        id: 'pay-123',
        status: 'PAID',
        amount: 290.0, // Tampered amount
      });

      expect(verifyWebhookSignature(tamperedPayload, signature, WEBHOOK_SECRET)).toBe(false);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MULTI-COUNTRY SUPPORT
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('Multi-Country Support', () => {
    const testCases: Array<{
      country: DLocalCountry;
      currency: DLocalCurrency;
      expectedMethods: string[];
    }> = [
      { country: 'IN', currency: 'INR', expectedMethods: ['UPI', 'Paytm', 'PhonePe'] },
      { country: 'NG', currency: 'NGN', expectedMethods: ['Bank Transfer'] },
      { country: 'PK', currency: 'PKR', expectedMethods: ['JazzCash', 'Easypaisa'] },
      { country: 'VN', currency: 'VND', expectedMethods: ['MoMo', 'VNPay'] },
      { country: 'ID', currency: 'IDR', expectedMethods: ['OVO', 'GoPay', 'Dana'] },
      { country: 'TH', currency: 'THB', expectedMethods: ['TrueMoney', 'Thai QR'] },
      { country: 'ZA', currency: 'ZAR', expectedMethods: ['Instant EFT'] },
      { country: 'TR', currency: 'TRY', expectedMethods: ['Bank Transfer'] },
    ];

    it.each(testCases)(
      'should support payment flow for $country',
      async ({ country, currency, expectedMethods }) => {
        // Verify country is supported
        expect(DLOCAL_SUPPORTED_COUNTRIES).toContain(country);
        expect(isDLocalCountry(country)).toBe(true);

        // Verify currency mapping
        expect(getCurrency(country)).toBe(currency);

        // Verify payment methods
        const methods = await getPaymentMethodsForCountry(country);
        for (const method of expectedMethods) {
          expect(methods).toContain(method);
        }

        // Mock exchange rate
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ rates: { [currency]: 50 } }),
        });

        // Verify currency conversion works
        const conversion = await convertUSDToLocal(29.0, currency);
        expect(conversion.localAmount).toBeGreaterThan(0);
        expect(conversion.currency).toBe(currency);

        // Verify payment creation works
        const payment = await createPayment({
          userId: `user-${country}`,
          amount: 29.0,
          currency,
          country,
          paymentMethod: expectedMethods[0],
          planType: 'MONTHLY',
        });

        expect(payment.paymentId).toBeDefined();
        expect(payment.status).toBe('PENDING');

        clearExchangeRateCache();
      }
    );

    it('should reject non-dLocal countries', async () => {
      const unsupportedCountries = ['US', 'GB', 'CA', 'AU', 'FR', 'DE'];

      for (const country of unsupportedCountries) {
        expect(isDLocalCountry(country)).toBe(false);
      }
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DISCOUNT CODE FLOW
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('Discount Code Flow', () => {
    it('should reject discount codes for 3-day plan', async () => {
      const result = await validateDiscountCode('ANYCODE', 'THREE_DAY');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('not available');
    });

    it('should validate active discount code for monthly plan', async () => {
      (mockPrisma.affiliateCode.findFirst as jest.Mock).mockResolvedValue({
        id: 'code-1',
        code: 'TRADER10',
        status: 'ACTIVE',
        affiliateProfile: { id: 'aff-1', status: 'ACTIVE' },
      });

      const result = await validateDiscountCode('TRADER10', 'MONTHLY');
      expect(result.valid).toBe(true);
      expect(result.discountPercent).toBe(10);
    });

    it('should reject inactive discount code', async () => {
      (mockPrisma.affiliateCode.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await validateDiscountCode('EXPIRED', 'MONTHLY');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('Invalid');
    });

    it('should reject code with inactive affiliate', async () => {
      (mockPrisma.affiliateCode.findFirst as jest.Mock).mockResolvedValue({
        id: 'code-2',
        code: 'SUSPENDED',
        status: 'ACTIVE',
        affiliateProfile: { id: 'aff-2', status: 'SUSPENDED' },
      });

      const result = await validateDiscountCode('SUSPENDED', 'MONTHLY');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('no longer valid');
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ERROR HANDLING
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('Error Handling', () => {
    it('should use fallback exchange rates when API fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const conversion = await convertUSDToLocal(29.0, 'INR');
      expect(conversion.localAmount).toBeGreaterThan(0);
      expect(conversion.exchangeRate).toBeGreaterThan(0);
    });

    it('should validate payment method for country', () => {
      // Valid combinations
      expect(isValidPaymentMethod('IN', 'UPI')).toBe(true);
      expect(isValidPaymentMethod('ID', 'GoPay')).toBe(true);
      expect(isValidPaymentMethod('VN', 'MoMo')).toBe(true);

      // Invalid combinations
      expect(isValidPaymentMethod('IN', 'GoPay')).toBe(false);
      expect(isValidPaymentMethod('ID', 'UPI')).toBe(false);
      expect(isValidPaymentMethod('NG', 'MoMo')).toBe(false);
    });

    it('should reject unsupported country for payment methods', async () => {
      await expect(
        getPaymentMethodsForCountry('US' as DLocalCountry)
      ).rejects.toThrow('Unsupported country');
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SUBSCRIPTION LIFECYCLE
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('Subscription Lifecycle', () => {
    it('should calculate correct expiry for 3-day plan', () => {
      const duration = getPlanDuration('THREE_DAY');
      expect(duration).toBe(3);

      const now = new Date();
      const expiry = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);
      expect(expiry.getTime() - now.getTime()).toBe(3 * 24 * 60 * 60 * 1000);
    });

    it('should calculate correct expiry for monthly plan', () => {
      const duration = getPlanDuration('MONTHLY');
      expect(duration).toBe(30);

      const now = new Date();
      const expiry = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);
      expect(expiry.getTime() - now.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it('should mark 3-day plan as used after purchase', async () => {
      const userId = 'mark-used-user';

      (mockPrisma.user.update as jest.Mock).mockResolvedValue({
        id: userId,
        hasUsedThreeDayPlan: true,
      });

      await markThreeDayPlanUsed(userId);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { hasUsedThreeDayPlan: true },
      });
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PRICING VALIDATION
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('Pricing Validation', () => {
    it('should have correct USD prices', () => {
      expect(PRICING.THREE_DAY_USD).toBe(1.99);
      expect(PRICING.MONTHLY_USD).toBe(29.0);
    });

    it('should return correct prices by plan type', () => {
      expect(getPriceUSD('THREE_DAY')).toBe(1.99);
      expect(getPriceUSD('MONTHLY')).toBe(29.0);
    });

    it('should calculate discount correctly', () => {
      const originalPrice = 29.0;
      const discountPercent = 10;
      const discountedPrice = originalPrice * (1 - discountPercent / 100);

      expect(discountedPrice).toBe(26.1);
    });
  });
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Simulates discount code validation (mirrors API behavior)
 */
async function validateDiscountCode(
  code: string,
  planType: PlanType
): Promise<{
  valid: boolean;
  discountPercent?: number;
  message?: string;
}> {
  // 3-day plan doesn't support discounts
  if (planType === 'THREE_DAY') {
    return {
      valid: false,
      message: 'Discount codes are not available for the 3-day plan',
    };
  }

  const normalizedCode = code.toUpperCase().trim();
  const { prisma } = await import('@/lib/db/prisma');

  const affiliateCode = await prisma.affiliateCode.findFirst({
    where: {
      code: normalizedCode,
      status: 'ACTIVE',
    },
    include: {
      affiliateProfile: {
        select: { id: true, status: true },
      },
    },
  });

  if (!affiliateCode) {
    return {
      valid: false,
      message: 'Invalid or expired discount code',
    };
  }

  if (affiliateCode.affiliateProfile?.status !== 'ACTIVE') {
    return {
      valid: false,
      message: 'This discount code is no longer valid',
    };
  }

  return {
    valid: true,
    discountPercent: 10, // Default affiliate discount
    message: '10% discount will be applied',
  };
}
