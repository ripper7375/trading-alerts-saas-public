/**
 * Country Detection Service
 *
 * Detects user's country from request headers: Cloudflare, Vercel, or a manual
 * override. There is no network lookup. The old fallback sent the visitor's IP
 * in cleartext to http://ip-api.com (the free tier has no HTTPS) with no
 * timeout; on Vercel the x-vercel-ip-country header is set on every
 * production request, so the fallback only fired off-platform.
 */

import { logger } from '@/lib/logger';

const DEFAULT_COUNTRY = 'US';

/**
 * Detects country from request headers
 * Tries Cloudflare, then Vercel, then a custom header, then the default.
 */
export async function detectCountry(headers?: Headers): Promise<string> {
  if (!headers) {
    logger.debug('No headers provided, using default country');
    return DEFAULT_COUNTRY;
  }

  // Try Cloudflare header first (most reliable in production)
  const cfCountry = headers.get('cf-ipcountry');
  if (cfCountry && cfCountry !== 'XX' && cfCountry !== 'T1') {
    logger.info('Country detected from Cloudflare header', {
      country: cfCountry,
    });
    return cfCountry;
  }

  // Try Vercel header
  const vercelCountry = headers.get('x-vercel-ip-country');
  if (vercelCountry) {
    logger.info('Country detected from Vercel header', {
      country: vercelCountry,
    });
    return vercelCountry;
  }

  // Try custom header (for manual testing)
  const customCountry = headers.get('x-country-code');
  if (customCountry) {
    logger.debug('Country detected from custom header', {
      country: customCountry,
    });
    return customCountry;
  }

  // No header named a country (local dev, or a request that bypassed the
  // edge). No IP lookup: see the module comment.
  logger.debug('No country header present, using default country');
  return DEFAULT_COUNTRY;
}

/**
 * Validates if a country code is valid (2-letter ISO code)
 */
export function isValidCountryCode(code: string): boolean {
  return /^[A-Z]{2}$/.test(code);
}

/**
 * Gets all geolocation-related headers from a request
 */
export function getGeoHeaders(headers: Headers): Record<string, string | null> {
  return {
    'cf-ipcountry': headers.get('cf-ipcountry'),
    'x-vercel-ip-country': headers.get('x-vercel-ip-country'),
    'x-forwarded-for': headers.get('x-forwarded-for'),
    'x-real-ip': headers.get('x-real-ip'),
    'x-country-code': headers.get('x-country-code'),
  };
}
