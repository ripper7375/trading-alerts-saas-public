/**
 * Country Detection Service
 *
 * Detects user's country from request headers or IP address.
 * Supports Cloudflare, Vercel, and fallback IP geolocation.
 */

import { logger } from '@/lib/logger';

const DEFAULT_COUNTRY = 'US';

/**
 * Detects country from IP address using free geolocation API
 */
export async function detectCountryFromIP(ip: string): Promise<string> {
  try {
    // Validate IP format (basic check)
    if (!ip || ip === '0.0.0.0' || ip === '127.0.0.1' || ip === '::1') {
      logger.debug('Local or invalid IP address', { ip });
      return DEFAULT_COUNTRY;
    }

    // Use ip-api.com (free, no API key required)
    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,countryCode`,
      {
        next: { revalidate: 86400 }, // Cache for 24 hours
      }
    );

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }

    const data = await response.json();

    if (data.status === 'success' && data.countryCode) {
      logger.info('Country detected from IP', {
        ip,
        country: data.countryCode,
      });
      return data.countryCode;
    }

    logger.warn('Failed to detect country from IP', { ip, data });
    return DEFAULT_COUNTRY;
  } catch (error) {
    logger.error('Error detecting country from IP', {
      ip,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return DEFAULT_COUNTRY;
  }
}

/**
 * Detects country from request headers
 * Tries Cloudflare, then Vercel headers, then falls back to IP detection
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

  // Fall back to IP-based detection
  const forwardedFor = headers.get('x-forwarded-for');
  const realIp = headers.get('x-real-ip');

  // Get the first IP from x-forwarded-for (client IP)
  const ip = forwardedFor?.split(',')[0]?.trim() || realIp || '0.0.0.0';

  return await detectCountryFromIP(ip);
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
