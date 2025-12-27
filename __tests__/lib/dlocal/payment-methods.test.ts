/**
 * Payment Methods Service Tests
 *
 * Tests for payment method retrieval and validation.
 */

import {
  getPaymentMethodsForCountry,
  isValidPaymentMethod,
  getPaymentMethodDetails,
  getDefaultPaymentMethod,
} from '@/lib/dlocal/payment-methods.service';
import type { DLocalCountry } from '@/types/dlocal';

describe('Payment Methods Service', () => {
  describe('getPaymentMethodsForCountry', () => {
    it('should return payment methods for India', async () => {
      const methods = await getPaymentMethodsForCountry('IN');

      expect(methods).toHaveLength(4);
      expect(methods).toContain('UPI');
      expect(methods).toContain('Paytm');
      expect(methods).toContain('PhonePe');
      expect(methods).toContain('Net Banking');
    });

    it('should return payment methods for Indonesia', async () => {
      const methods = await getPaymentMethodsForCountry('ID');

      expect(methods).toHaveLength(4);
      expect(methods).toContain('GoPay');
      expect(methods).toContain('OVO');
      expect(methods).toContain('Dana');
      expect(methods).toContain('ShopeePay');
    });

    it('should return payment methods for Thailand', async () => {
      const methods = await getPaymentMethodsForCountry('TH');

      expect(methods).toContain('TrueMoney');
      expect(methods).toContain('Rabbit LINE Pay');
      expect(methods).toContain('Thai QR');
    });

    it('should return payment methods for Nigeria', async () => {
      const methods = await getPaymentMethodsForCountry('NG');

      expect(methods).toContain('Bank Transfer');
      expect(methods).toContain('USSD');
      expect(methods).toContain('Paystack');
    });

    it('should return payment methods for Pakistan', async () => {
      const methods = await getPaymentMethodsForCountry('PK');

      expect(methods).toContain('JazzCash');
      expect(methods).toContain('Easypaisa');
    });

    it('should return payment methods for Vietnam', async () => {
      const methods = await getPaymentMethodsForCountry('VN');

      expect(methods).toContain('VNPay');
      expect(methods).toContain('MoMo');
      expect(methods).toContain('ZaloPay');
    });

    it('should return payment methods for South Africa', async () => {
      const methods = await getPaymentMethodsForCountry('ZA');

      expect(methods).toContain('Instant EFT');
      expect(methods).toContain('EFT');
    });

    it('should return payment methods for Turkey', async () => {
      const methods = await getPaymentMethodsForCountry('TR');

      expect(methods).toContain('Bank Transfer');
      expect(methods).toContain('Local Cards');
    });

    it('should throw error for unsupported country', async () => {
      await expect(
        getPaymentMethodsForCountry('US' as DLocalCountry)
      ).rejects.toThrow('Unsupported country');
    });

    it('should return non-empty array for all supported countries', async () => {
      const countries: DLocalCountry[] = [
        'IN',
        'NG',
        'PK',
        'VN',
        'ID',
        'TH',
        'ZA',
        'TR',
      ];

      for (const country of countries) {
        const methods = await getPaymentMethodsForCountry(country);
        expect(methods.length).toBeGreaterThan(0);
      }
    });
  });

  describe('isValidPaymentMethod', () => {
    it('should return true for valid payment method in India', () => {
      expect(isValidPaymentMethod('IN', 'UPI')).toBe(true);
      expect(isValidPaymentMethod('IN', 'Paytm')).toBe(true);
    });

    it('should return false for invalid payment method in India', () => {
      expect(isValidPaymentMethod('IN', 'GoPay')).toBe(false);
      expect(isValidPaymentMethod('IN', 'VNPay')).toBe(false);
    });

    it('should return true for valid payment method in Indonesia', () => {
      expect(isValidPaymentMethod('ID', 'GoPay')).toBe(true);
      expect(isValidPaymentMethod('ID', 'OVO')).toBe(true);
    });

    it('should return false for invalid payment method in Indonesia', () => {
      expect(isValidPaymentMethod('ID', 'UPI')).toBe(false);
      expect(isValidPaymentMethod('ID', 'Paytm')).toBe(false);
    });

    it('should be case-sensitive', () => {
      expect(isValidPaymentMethod('IN', 'upi')).toBe(false);
      expect(isValidPaymentMethod('IN', 'UPI')).toBe(true);
    });
  });

  describe('getPaymentMethodDetails', () => {
    it('should return detailed payment method info for India', async () => {
      const details = await getPaymentMethodDetails('IN');

      expect(details).toHaveLength(4);
      expect(details[0]).toHaveProperty('id');
      expect(details[0]).toHaveProperty('name');
      expect(details[0]).toHaveProperty('type');
    });

    it('should assign correct types to payment methods', async () => {
      const details = await getPaymentMethodDetails('IN');

      const upi = details.find((m) => m.name === 'UPI');
      const netBanking = details.find((m) => m.name === 'Net Banking');

      expect(upi?.type).toBe('wallet');
      expect(netBanking?.type).toBe('bank');
    });

    it('should format IDs correctly', async () => {
      const details = await getPaymentMethodDetails('TH');

      const rabbitLine = details.find((m) => m.name === 'Rabbit LINE Pay');
      expect(rabbitLine?.id).toBe('rabbit_line_pay');
    });

    it('should throw error for unsupported country', async () => {
      await expect(
        getPaymentMethodDetails('US' as DLocalCountry)
      ).rejects.toThrow('Unsupported country');
    });
  });

  describe('getDefaultPaymentMethod', () => {
    it('should return UPI for India', () => {
      expect(getDefaultPaymentMethod('IN')).toBe('UPI');
    });

    it('should return GoPay for Indonesia', () => {
      expect(getDefaultPaymentMethod('ID')).toBe('GoPay');
    });

    it('should return TrueMoney for Thailand', () => {
      expect(getDefaultPaymentMethod('TH')).toBe('TrueMoney');
    });

    it('should return Bank Transfer for Nigeria', () => {
      expect(getDefaultPaymentMethod('NG')).toBe('Bank Transfer');
    });

    it('should return default for all supported countries', () => {
      const countries: DLocalCountry[] = [
        'IN',
        'NG',
        'PK',
        'VN',
        'ID',
        'TH',
        'ZA',
        'TR',
      ];

      countries.forEach((country) => {
        const defaultMethod = getDefaultPaymentMethod(country);
        expect(defaultMethod).not.toBeNull();
      });
    });
  });
});
