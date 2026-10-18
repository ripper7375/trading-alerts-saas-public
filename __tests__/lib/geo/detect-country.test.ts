/**
 * Country Detection Service Tests
 *
 * Tests for IP-based and header-based country detection.
 */

import {
  detectCountry,
  isValidCountryCode,
  getGeoHeaders,
} from '@/lib/geo/detect-country';

// The lookup is header-only now (Next.js remediation T1-a): any fetch is a regression.
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Country Detection Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detectCountry', () => {
    it('should detect country from Cloudflare header', async () => {
      const mockHeaders = new Headers({
        'cf-ipcountry': 'IN',
      });

      const country = await detectCountry(mockHeaders);
      expect(country).toBe('IN');
    });

    it('should detect country from Vercel header', async () => {
      const mockHeaders = new Headers({
        'x-vercel-ip-country': 'TH',
      });

      const country = await detectCountry(mockHeaders);
      expect(country).toBe('TH');
    });

    it('should detect country from custom header', async () => {
      const mockHeaders = new Headers({
        'x-country-code': 'NG',
      });

      const country = await detectCountry(mockHeaders);
      expect(country).toBe('NG');
    });

    it('should prioritize Cloudflare over Vercel header', async () => {
      const mockHeaders = new Headers({
        'cf-ipcountry': 'IN',
        'x-vercel-ip-country': 'TH',
      });

      const country = await detectCountry(mockHeaders);
      expect(country).toBe('IN');
    });

    it('should ignore Cloudflare XX (unknown) country and use the Vercel header', async () => {
      const mockHeaders = new Headers({
        'cf-ipcountry': 'XX',
        'x-vercel-ip-country': 'PK',
        'x-forwarded-for': '203.0.113.1',
      });

      const country = await detectCountry(mockHeaders);
      expect(country).toBe('PK');
    });

    it('should ignore Cloudflare T1 (Tor) country and use the Vercel header', async () => {
      const mockHeaders = new Headers({
        'cf-ipcountry': 'T1',
        'x-vercel-ip-country': 'VN',
        'x-forwarded-for': '203.0.113.1',
      });

      const country = await detectCountry(mockHeaders);
      expect(country).toBe('VN');
    });

    it('should return the default, with no network lookup, when only an IP is present', async () => {
      const mockHeaders = new Headers({
        'x-forwarded-for': '41.0.0.1, 10.0.0.1, 192.168.1.1',
        'x-real-ip': '41.0.0.1',
      });

      const country = await detectCountry(mockHeaders);
      expect(country).toBe('US');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return the default when Cloudflare says unknown and nothing else is present', async () => {
      const country = await detectCountry(
        new Headers({ 'cf-ipcountry': 'XX', 'x-forwarded-for': '203.0.113.1' })
      );
      expect(country).toBe('US');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return default for undefined headers', async () => {
      const country = await detectCountry(undefined);
      expect(country).toBe('US');
    });

    it('should return default for empty headers', async () => {
      const country = await detectCountry(new Headers());
      expect(country).toBe('US');
    });
  });

  describe('isValidCountryCode', () => {
    it('should return true for valid 2-letter codes', () => {
      expect(isValidCountryCode('IN')).toBe(true);
      expect(isValidCountryCode('US')).toBe(true);
      expect(isValidCountryCode('TH')).toBe(true);
    });

    it('should return false for lowercase codes', () => {
      expect(isValidCountryCode('in')).toBe(false);
      expect(isValidCountryCode('us')).toBe(false);
    });

    it('should return false for 3-letter codes', () => {
      expect(isValidCountryCode('IND')).toBe(false);
      expect(isValidCountryCode('USA')).toBe(false);
    });

    it('should return false for single letters', () => {
      expect(isValidCountryCode('I')).toBe(false);
    });

    it('should return false for numbers', () => {
      expect(isValidCountryCode('12')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidCountryCode('')).toBe(false);
    });
  });

  describe('getGeoHeaders', () => {
    it('should extract all geo-related headers', () => {
      const mockHeaders = new Headers({
        'cf-ipcountry': 'IN',
        'x-vercel-ip-country': 'TH',
        'x-forwarded-for': '1.2.3.4',
        'x-real-ip': '5.6.7.8',
        'x-country-code': 'NG',
      });

      const geoHeaders = getGeoHeaders(mockHeaders);

      expect(geoHeaders['cf-ipcountry']).toBe('IN');
      expect(geoHeaders['x-vercel-ip-country']).toBe('TH');
      expect(geoHeaders['x-forwarded-for']).toBe('1.2.3.4');
      expect(geoHeaders['x-real-ip']).toBe('5.6.7.8');
      expect(geoHeaders['x-country-code']).toBe('NG');
    });

    it('should return null for missing headers', () => {
      const mockHeaders = new Headers({
        'cf-ipcountry': 'IN',
      });

      const geoHeaders = getGeoHeaders(mockHeaders);

      expect(geoHeaders['cf-ipcountry']).toBe('IN');
      expect(geoHeaders['x-vercel-ip-country']).toBeNull();
      expect(geoHeaders['x-forwarded-for']).toBeNull();
    });
  });
});
