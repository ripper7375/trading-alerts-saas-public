/**
 * Integration Test: Payment Creation Flow
 *
 * Tests the complete end-to-end payment creation flow.
 * This test validates that all services work together correctly.
 */

import { convertUSDToLocal, clearExchangeRateCache } from '@/lib/dlocal/currency-converter.service';
import { getPaymentMethodsForCountry, isValidPaymentMethod } from '@/lib/dlocal/payment-methods.service';
import { createPayment, verifyWebhookSignature, mapDLocalStatus } from '@/lib/dlocal/dlocal-payment.service';
import { detectCountry } from '@/lib/geo/detect-country';
import { isDLocalCountry, getCurrency, getPriceUSD, getPlanDuration, PRICING } from '@/lib/dlocal/constants';
import type { DLocalCountry, DLocalCurrency } from '@/types/dlocal';
import crypto from 'crypto';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Integration: Payment Creation Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearExchangeRateCache();
  });

  describe('Complete Payment Creation Flow', () => {
    it('should complete full payment creation flow for India', async () => {
      // Mock exchange rate API
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rates: { INR: 83.12 } }),
      });

      // Step 1: Detect country (from headers)
      const headers = new Headers({ 'cf-ipcountry': 'IN' });
      const country = await detectCountry(headers);
      expect(country).toBe('IN');
      expect(isDLocalCountry(country)).toBe(true);

      // Step 2: Get payment methods
      const methods = await getPaymentMethodsForCountry(country as DLocalCountry);
      expect(methods).toContain('UPI');
      expect(methods).toContain('Paytm');

      // Step 3: Validate selected payment method
      const selectedMethod = 'UPI';
      expect(isValidPaymentMethod(country as DLocalCountry, selectedMethod)).toBe(true);

      // Step 4: Get currency for country
      const currency = getCurrency(country as DLocalCountry);
      expect(currency).toBe('INR');

      // Step 5: Get pricing
      const usdPrice = getPriceUSD('MONTHLY');
      expect(usdPrice).toBe(PRICING.MONTHLY_USD);

      // Step 6: Convert to local currency
      const conversion = await convertUSDToLocal(usdPrice, currency);
      expect(conversion.localAmount).toBeGreaterThan(0);
      expect(conversion.exchangeRate).toBeGreaterThan(0);
      expect(conversion.usdAmount).toBe(usdPrice);

      // Step 7: Create payment
      const payment = await createPayment({
        userId: 'user-123',
        amount: usdPrice,
        currency,
        country: country as DLocalCountry,
        paymentMethod: selectedMethod,
        planType: 'MONTHLY',
      });

      expect(payment.paymentId).toBeDefined();
      expect(payment.orderId).toBeDefined();
      expect(payment.paymentUrl).toBeDefined();
      expect(payment.status).toBe('PENDING');

      // Step 8: Get plan duration
      const duration = getPlanDuration('MONTHLY');
      expect(duration).toBe(30);
    });

    it('should complete full payment creation flow for Thailand', async () => {
      // Mock exchange rate API
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rates: { THB: 35.25 } }),
      });

      // Step 1: Detect country
      const headers = new Headers({ 'x-vercel-ip-country': 'TH' });
      const country = await detectCountry(headers);
      expect(country).toBe('TH');

      // Step 2: Get payment methods
      const methods = await getPaymentMethodsForCountry(country as DLocalCountry);
      expect(methods).toContain('TrueMoney');

      // Step 3: Get currency and pricing
      const currency = getCurrency(country as DLocalCountry);
      const usdPrice = getPriceUSD('THREE_DAY');
      expect(usdPrice).toBe(PRICING.THREE_DAY_USD);

      // Step 4: Convert and create payment
      const conversion = await convertUSDToLocal(usdPrice, currency);
      expect(conversion.currency).toBe('THB');

      const payment = await createPayment({
        userId: 'user-456',
        amount: usdPrice,
        currency,
        country: country as DLocalCountry,
        paymentMethod: 'TrueMoney',
        planType: 'THREE_DAY',
      });

      expect(payment.status).toBe('PENDING');
      expect(getPlanDuration('THREE_DAY')).toBe(3);
    });

    it('should handle payment for all 8 supported countries', async () => {
      const countries: DLocalCountry[] = ['IN', 'NG', 'PK', 'VN', 'ID', 'TH', 'ZA', 'TR'];

      for (const country of countries) {
        clearExchangeRateCache();
        const currency = getCurrency(country);

        // Mock exchange rate for this currency
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ rates: { [currency]: 50 } }),
        });

        // Get methods
        const methods = await getPaymentMethodsForCountry(country);
        expect(methods.length).toBeGreaterThan(0);

        // Convert
        const conversion = await convertUSDToLocal(29.0, currency);
        expect(conversion.localAmount).toBeGreaterThan(0);

        // Create payment
        const payment = await createPayment({
          userId: `user-${country}`,
          amount: 29.0,
          currency,
          country,
          paymentMethod: methods[0],
          planType: 'MONTHLY',
        });

        expect(payment.paymentId).toBeDefined();
      }
    });
  });

  describe('Webhook Processing Flow', () => {
    const WEBHOOK_SECRET = 'test-secret';

    it('should process successful payment webhook', () => {
      // Simulate webhook payload
      const webhookPayload = {
        id: 'dlocal-pay-123',
        status: 'PAID',
        amount: 2415.48,
        currency: 'INR',
        order_id: 'order-user123-1702900000000',
        payment_method_id: 'UPI',
        created_date: '2024-12-18T10:30:00.000Z',
        approved_date: '2024-12-18T10:31:00.000Z',
      };

      const payload = JSON.stringify(webhookPayload);
      const signature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');

      // Verify signature
      expect(verifyWebhookSignature(payload, signature, WEBHOOK_SECRET)).toBe(true);

      // Map status
      expect(mapDLocalStatus(webhookPayload.status)).toBe('COMPLETED');
    });

    it('should process failed payment webhook', () => {
      const webhookPayload = {
        id: 'dlocal-pay-456',
        status: 'REJECTED',
        amount: 29.0,
        currency: 'USD',
        order_id: 'order-user456-1702900000000',
        payment_method_id: 'UPI',
        created_date: '2024-12-18T10:30:00.000Z',
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

    it('should reject tampered webhook', () => {
      const originalPayload = JSON.stringify({
        id: 'dlocal-pay-789',
        status: 'PAID',
        amount: 29.0,
      });

      const signature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(originalPayload)
        .digest('hex');

      const tamperedPayload = JSON.stringify({
        id: 'dlocal-pay-789',
        status: 'PAID',
        amount: 290.0, // Tampered!
      });

      expect(verifyWebhookSignature(tamperedPayload, signature, WEBHOOK_SECRET)).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle API failure gracefully with fallback rates', async () => {
      // Mock API failure
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Should still work with fallback rates
      const conversion = await convertUSDToLocal(29.0, 'INR');
      expect(conversion.localAmount).toBeGreaterThan(0);
      expect(conversion.exchangeRate).toBeGreaterThan(0);
    });

    it('should reject invalid country', async () => {
      await expect(
        getPaymentMethodsForCountry('US' as DLocalCountry)
      ).rejects.toThrow('Unsupported country');
    });

    it('should validate payment method for country', () => {
      // UPI is valid for India
      expect(isValidPaymentMethod('IN', 'UPI')).toBe(true);

      // GoPay is NOT valid for India
      expect(isValidPaymentMethod('IN', 'GoPay')).toBe(false);

      // GoPay IS valid for Indonesia
      expect(isValidPaymentMethod('ID', 'GoPay')).toBe(true);
    });
  });

  describe('Pricing Validation', () => {
    it('should have correct pricing for plans', () => {
      expect(PRICING.THREE_DAY_USD).toBe(1.99);
      expect(PRICING.MONTHLY_USD).toBe(29.0);

      expect(getPriceUSD('THREE_DAY')).toBe(1.99);
      expect(getPriceUSD('MONTHLY')).toBe(29.0);
    });

    it('should have correct duration for plans', () => {
      expect(getPlanDuration('THREE_DAY')).toBe(3);
      expect(getPlanDuration('MONTHLY')).toBe(30);
    });
  });

  describe('Country Detection', () => {
    it('should prioritize Cloudflare header', async () => {
      const headers = new Headers({
        'cf-ipcountry': 'IN',
        'x-vercel-ip-country': 'TH',
      });

      const country = await detectCountry(headers);
      expect(country).toBe('IN');
    });

    it('should fall back to Vercel header', async () => {
      const headers = new Headers({
        'x-vercel-ip-country': 'TH',
      });

      const country = await detectCountry(headers);
      expect(country).toBe('TH');
    });

    it('should fall back to IP detection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'success', countryCode: 'NG' }),
      });

      const headers = new Headers({
        'x-forwarded-for': '41.58.0.1',
      });

      const country = await detectCountry(headers);
      expect(country).toBe('NG');
    });
  });
});
