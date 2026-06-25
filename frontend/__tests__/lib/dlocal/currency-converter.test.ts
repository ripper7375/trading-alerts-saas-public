/**
 * Currency Converter Service Tests
 *
 * Tests for USD to local currency conversion.
 */

import {
  convertUSDToLocal,
  getExchangeRate,
  clearExchangeRateCache,
  getFallbackRate,
} from '@/lib/dlocal/currency-converter.service';
import type { DLocalCurrency } from '@/types/dlocal';

// Mock fetch for API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Currency Converter Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearExchangeRateCache();
  });

  describe('getExchangeRate', () => {
    it('should get exchange rate for INR', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rates: { INR: 83.12 } }),
      });

      const rate = await getExchangeRate('INR');
      expect(rate).toBe(83.12);
    });

    it('should get exchange rate for THB', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rates: { THB: 35.25 } }),
      });

      const rate = await getExchangeRate('THB');
      expect(rate).toBe(35.25);
    });

    it('should cache exchange rates', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rates: { VND: 24750.0 } }),
      });

      const rate1 = await getExchangeRate('VND');
      const rate2 = await getExchangeRate('VND');

      expect(rate1).toBe(rate2);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw error for unsupported currency', async () => {
      await expect(
        getExchangeRate('INVALID' as DLocalCurrency)
      ).rejects.toThrow('Unsupported currency');
    });

    it('should use fallback rate on API failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const rate = await getExchangeRate('INR');
      const fallbackRate = getFallbackRate('INR');

      expect(rate).toBe(fallbackRate);
    });

    it('should use fallback rate on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const rate = await getExchangeRate('NGN');
      const fallbackRate = getFallbackRate('NGN');

      expect(rate).toBe(fallbackRate);
    });
  });

  describe('convertUSDToLocal', () => {
    it('should convert USD to INR', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rates: { INR: 83.0 } }),
      });

      const result = await convertUSDToLocal(29.0, 'INR');

      expect(result.localAmount).toBe(2407.0);
      expect(result.currency).toBe('INR');
      expect(result.exchangeRate).toBe(83.0);
      expect(result.usdAmount).toBe(29.0);
    });

    it('should convert USD to THB', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rates: { THB: 35.0 } }),
      });

      const result = await convertUSDToLocal(1.99, 'THB');

      expect(result.localAmount).toBe(69.65);
      expect(result.currency).toBe('THB');
      expect(result.exchangeRate).toBe(35.0);
    });

    it('should round local amount to 2 decimal places', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rates: { INR: 83.123456 } }),
      });

      const result = await convertUSDToLocal(29.0, 'INR');
      const decimals = result.localAmount.toString().split('.')[1]?.length || 0;

      expect(decimals).toBeLessThanOrEqual(2);
    });

    it('should throw error for zero amount', async () => {
      await expect(convertUSDToLocal(0, 'INR')).rejects.toThrow(
        'Amount must be positive'
      );
    });

    it('should throw error for negative amount', async () => {
      await expect(convertUSDToLocal(-10, 'INR')).rejects.toThrow(
        'Amount must be positive'
      );
    });

    it('should work with all supported currencies', async () => {
      const currencies: DLocalCurrency[] = [
        'INR',
        'NGN',
        'PKR',
        'VND',
        'IDR',
        'THB',
        'ZAR',
        'TRY',
      ];

      for (const currency of currencies) {
        clearExchangeRateCache();
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            rates: { [currency]: getFallbackRate(currency) },
          }),
        });

        const result = await convertUSDToLocal(29.0, currency);

        expect(result.localAmount).toBeGreaterThan(0);
        expect(result.currency).toBe(currency);
        expect(result.exchangeRate).toBeGreaterThan(0);
      }
    });
  });

  describe('getFallbackRate', () => {
    it('should return fallback rate for INR', () => {
      const rate = getFallbackRate('INR');
      expect(rate).toBe(83.12);
    });

    it('should return fallback rate for all currencies', () => {
      const currencies: DLocalCurrency[] = [
        'INR',
        'NGN',
        'PKR',
        'VND',
        'IDR',
        'THB',
        'ZAR',
        'TRY',
      ];

      currencies.forEach((currency) => {
        const rate = getFallbackRate(currency);
        expect(rate).toBeGreaterThan(0);
      });
    });
  });

  describe('clearExchangeRateCache', () => {
    it('should clear the cache', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ rates: { INR: 83.12 } }),
      });

      await getExchangeRate('INR');
      clearExchangeRateCache();
      await getExchangeRate('INR');

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
