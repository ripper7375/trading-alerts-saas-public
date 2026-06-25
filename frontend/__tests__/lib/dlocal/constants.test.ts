/**
 * dLocal Constants Tests
 *
 * Tests country, currency, and pricing constants.
 */

import {
  isDLocalCountry,
  getCurrency,
  getPaymentMethods,
  getCountryName,
  getCountryConfig,
  getPriceUSD,
  getPlanDuration,
  DLOCAL_SUPPORTED_COUNTRIES,
  COUNTRY_CURRENCY_MAP,
  COUNTRY_NAMES,
  PAYMENT_METHODS,
  PRICING,
  PLAN_DURATION,
  COUNTRY_CONFIGS,
} from '@/lib/dlocal/constants';

describe('dLocal Constants', () => {
  describe('DLOCAL_SUPPORTED_COUNTRIES', () => {
    it('should have exactly 8 supported countries', () => {
      expect(DLOCAL_SUPPORTED_COUNTRIES).toHaveLength(8);
    });

    it('should include all required countries', () => {
      expect(DLOCAL_SUPPORTED_COUNTRIES).toContain('IN');
      expect(DLOCAL_SUPPORTED_COUNTRIES).toContain('NG');
      expect(DLOCAL_SUPPORTED_COUNTRIES).toContain('PK');
      expect(DLOCAL_SUPPORTED_COUNTRIES).toContain('VN');
      expect(DLOCAL_SUPPORTED_COUNTRIES).toContain('ID');
      expect(DLOCAL_SUPPORTED_COUNTRIES).toContain('TH');
      expect(DLOCAL_SUPPORTED_COUNTRIES).toContain('ZA');
      expect(DLOCAL_SUPPORTED_COUNTRIES).toContain('TR');
    });
  });

  describe('isDLocalCountry', () => {
    it('should return true for valid dLocal countries', () => {
      expect(isDLocalCountry('IN')).toBe(true);
      expect(isDLocalCountry('NG')).toBe(true);
      expect(isDLocalCountry('TH')).toBe(true);
    });

    it('should return false for unsupported countries', () => {
      expect(isDLocalCountry('US')).toBe(false);
      expect(isDLocalCountry('GB')).toBe(false);
      expect(isDLocalCountry('CA')).toBe(false);
    });

    it('should return false for invalid inputs', () => {
      expect(isDLocalCountry('')).toBe(false);
      expect(isDLocalCountry('invalid')).toBe(false);
    });
  });

  describe('getCurrency', () => {
    it('should return correct currency for India', () => {
      expect(getCurrency('IN')).toBe('INR');
    });

    it('should return correct currency for Nigeria', () => {
      expect(getCurrency('NG')).toBe('NGN');
    });

    it('should return correct currency for Thailand', () => {
      expect(getCurrency('TH')).toBe('THB');
    });

    it('should return correct currency for all countries', () => {
      expect(getCurrency('PK')).toBe('PKR');
      expect(getCurrency('VN')).toBe('VND');
      expect(getCurrency('ID')).toBe('IDR');
      expect(getCurrency('ZA')).toBe('ZAR');
      expect(getCurrency('TR')).toBe('TRY');
    });
  });

  describe('COUNTRY_CURRENCY_MAP', () => {
    it('should have mapping for all 8 countries', () => {
      expect(Object.keys(COUNTRY_CURRENCY_MAP)).toHaveLength(8);
    });
  });

  describe('getPaymentMethods', () => {
    it('should return payment methods for India', () => {
      const methods = getPaymentMethods('IN');
      expect(methods).toContain('UPI');
      expect(methods).toContain('Paytm');
      expect(methods).toContain('PhonePe');
      expect(methods).toContain('Net Banking');
    });

    it('should return payment methods for Indonesia', () => {
      const methods = getPaymentMethods('ID');
      expect(methods).toContain('GoPay');
      expect(methods).toContain('OVO');
      expect(methods).toContain('Dana');
      expect(methods).toContain('ShopeePay');
    });

    it('should return payment methods for Thailand', () => {
      const methods = getPaymentMethods('TH');
      expect(methods).toContain('TrueMoney');
      expect(methods).toContain('Thai QR');
    });

    it('should return payment methods for all countries', () => {
      DLOCAL_SUPPORTED_COUNTRIES.forEach((country) => {
        const methods = getPaymentMethods(country);
        expect(methods.length).toBeGreaterThan(0);
      });
    });
  });

  describe('PAYMENT_METHODS', () => {
    it('should have payment methods for all countries', () => {
      expect(Object.keys(PAYMENT_METHODS)).toHaveLength(8);
    });
  });

  describe('getCountryName', () => {
    it('should return India for IN', () => {
      expect(getCountryName('IN')).toBe('India');
    });

    it('should return Nigeria for NG', () => {
      expect(getCountryName('NG')).toBe('Nigeria');
    });

    it('should return South Africa for ZA', () => {
      expect(getCountryName('ZA')).toBe('South Africa');
    });
  });

  describe('COUNTRY_NAMES', () => {
    it('should have names for all 8 countries', () => {
      expect(Object.keys(COUNTRY_NAMES)).toHaveLength(8);
    });
  });

  describe('PRICING', () => {
    it('should have correct 3-day plan price', () => {
      expect(PRICING.THREE_DAY_USD).toBe(1.99);
    });

    it('should have correct monthly plan price', () => {
      expect(PRICING.MONTHLY_USD).toBe(29.0);
    });
  });

  describe('getPriceUSD', () => {
    it('should return correct price for THREE_DAY plan', () => {
      expect(getPriceUSD('THREE_DAY')).toBe(1.99);
    });

    it('should return correct price for MONTHLY plan', () => {
      expect(getPriceUSD('MONTHLY')).toBe(29.0);
    });
  });

  describe('PLAN_DURATION', () => {
    it('should have 3 days for THREE_DAY plan', () => {
      expect(PLAN_DURATION.THREE_DAY).toBe(3);
    });

    it('should have 30 days for MONTHLY plan', () => {
      expect(PLAN_DURATION.MONTHLY).toBe(30);
    });
  });

  describe('getPlanDuration', () => {
    it('should return 3 for THREE_DAY plan', () => {
      expect(getPlanDuration('THREE_DAY')).toBe(3);
    });

    it('should return 30 for MONTHLY plan', () => {
      expect(getPlanDuration('MONTHLY')).toBe(30);
    });
  });

  describe('getCountryConfig', () => {
    it('should return full config for India', () => {
      const config = getCountryConfig('IN');
      expect(config).toBeDefined();
      expect(config?.code).toBe('IN');
      expect(config?.name).toBe('India');
      expect(config?.currency).toBe('INR');
      expect(config?.paymentMethods).toContain('UPI');
    });

    it('should return full config for all countries', () => {
      DLOCAL_SUPPORTED_COUNTRIES.forEach((country) => {
        const config = getCountryConfig(country);
        expect(config).toBeDefined();
        expect(config?.code).toBe(country);
        expect(config?.currency).toBe(COUNTRY_CURRENCY_MAP[country]);
      });
    });
  });

  describe('COUNTRY_CONFIGS', () => {
    it('should have configs for all 8 countries', () => {
      expect(COUNTRY_CONFIGS).toHaveLength(8);
    });

    it('should have valid structure for each config', () => {
      COUNTRY_CONFIGS.forEach((config) => {
        expect(config.code).toBeDefined();
        expect(config.name).toBeDefined();
        expect(config.currency).toBeDefined();
        expect(config.paymentMethods).toBeDefined();
        expect(Array.isArray(config.paymentMethods)).toBe(true);
      });
    });
  });
});
