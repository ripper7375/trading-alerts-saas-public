/**
 * dLocal Types Tests
 *
 * Tests type definitions for dLocal payment integration.
 */

import type {
  DLocalCountry,
  DLocalCurrency,
  PaymentProvider,
  PlanType,
  PaymentStatus,
  DLocalPaymentRequest,
  DLocalPaymentResponse,
  CurrencyConversionResult,
} from '@/types/dlocal';

describe('dLocal Types', () => {
  describe('PaymentProvider', () => {
    it('should accept DLOCAL as valid provider', () => {
      const provider: PaymentProvider = 'DLOCAL';
      expect(provider).toBe('DLOCAL');
    });

    it('should accept STRIPE as valid provider', () => {
      const provider: PaymentProvider = 'STRIPE';
      expect(provider).toBe('STRIPE');
    });
  });

  describe('DLocalCountry', () => {
    it('should have 8 supported countries', () => {
      const countries: DLocalCountry[] = ['IN', 'NG', 'PK', 'VN', 'ID', 'TH', 'ZA', 'TR'];
      expect(countries).toHaveLength(8);
    });

    it('should include India (IN)', () => {
      const country: DLocalCountry = 'IN';
      expect(country).toBe('IN');
    });

    it('should include Nigeria (NG)', () => {
      const country: DLocalCountry = 'NG';
      expect(country).toBe('NG');
    });
  });

  describe('DLocalCurrency', () => {
    it('should have matching currencies for countries', () => {
      const currencies: DLocalCurrency[] = ['INR', 'NGN', 'PKR', 'VND', 'IDR', 'THB', 'ZAR', 'TRY'];
      expect(currencies).toHaveLength(8);
    });

    it('should include Indian Rupee (INR)', () => {
      const currency: DLocalCurrency = 'INR';
      expect(currency).toBe('INR');
    });
  });

  describe('PlanType', () => {
    it('should accept THREE_DAY plan', () => {
      const plan: PlanType = 'THREE_DAY';
      expect(plan).toBe('THREE_DAY');
    });

    it('should accept MONTHLY plan', () => {
      const plan: PlanType = 'MONTHLY';
      expect(plan).toBe('MONTHLY');
    });
  });

  describe('PaymentStatus', () => {
    it('should have all expected statuses', () => {
      const statuses: PaymentStatus[] = ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED'];
      expect(statuses).toContain('PENDING');
      expect(statuses).toContain('COMPLETED');
      expect(statuses).toContain('FAILED');
    });
  });

  describe('DLocalPaymentRequest', () => {
    it('should create valid payment request', () => {
      const request: DLocalPaymentRequest = {
        userId: 'user-123',
        amount: 29.0,
        currency: 'INR',
        country: 'IN',
        paymentMethod: 'UPI',
        planType: 'MONTHLY',
      };

      expect(request.userId).toBe('user-123');
      expect(request.amount).toBe(29.0);
      expect(request.currency).toBe('INR');
      expect(request.country).toBe('IN');
      expect(request.paymentMethod).toBe('UPI');
      expect(request.planType).toBe('MONTHLY');
    });

    it('should accept optional discount code', () => {
      const request: DLocalPaymentRequest = {
        userId: 'user-123',
        amount: 29.0,
        currency: 'INR',
        country: 'IN',
        paymentMethod: 'UPI',
        planType: 'MONTHLY',
        discountCode: 'SAVE10',
      };

      expect(request.discountCode).toBe('SAVE10');
    });
  });

  describe('DLocalPaymentResponse', () => {
    it('should create valid payment response', () => {
      const response: DLocalPaymentResponse = {
        paymentId: 'pay-123',
        orderId: 'order-456',
        paymentUrl: 'https://dlocal.com/pay/123',
        status: 'PENDING',
        amount: 2415.48,
        currency: 'INR',
      };

      expect(response.paymentId).toBe('pay-123');
      expect(response.orderId).toBe('order-456');
      expect(response.paymentUrl).toContain('dlocal');
      expect(response.status).toBe('PENDING');
    });
  });

  describe('CurrencyConversionResult', () => {
    it('should create valid conversion result', () => {
      const result: CurrencyConversionResult = {
        localAmount: 2415.48,
        currency: 'INR',
        exchangeRate: 83.29,
        usdAmount: 29.0,
      };

      expect(result.localAmount).toBeGreaterThan(result.usdAmount);
      expect(result.exchangeRate).toBeGreaterThan(0);
      expect(result.currency).toBe('INR');
    });
  });
});
