/**
 * @jest-environment node
 *
 * Geolocation in lib/security/device-detection.ts (Next.js remediation T1-a).
 *
 * The lookup used to send the visitor's IP in cleartext to http://ip-api.com
 * (no HTTPS on the free tier, no timeout) on the login, password and 2FA
 * paths. It now reads the platform's edge headers and never touches the
 * network, so it cannot delay or block a login.
 */

const mockHeaders = jest.fn();
jest.mock('next/headers', () => ({
  __esModule: true,
  headers: () => mockHeaders(),
}));
jest.mock('@/lib/db/prisma', () => ({ __esModule: true, prisma: {} }));
jest.mock('@/lib/email/email', () => ({
  __esModule: true,
  sendNewDeviceLoginEmail: jest.fn(),
}));

import {
  getGeoLocation,
  getLoginContext,
} from '@/lib/security/device-detection';

const mockFetch = jest.fn();
const realFetch = global.fetch;

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
});

afterAll(() => {
  global.fetch = realFetch;
});

describe('getGeoLocation', () => {
  it('reads Vercel country, city and region', () => {
    const location = getGeoLocation(
      new Headers({
        'x-vercel-ip-country': 'US',
        'x-vercel-ip-city': 'San%20Francisco',
        'x-vercel-ip-country-region': 'CA',
      })
    );

    expect(location).toEqual({
      country: 'United States',
      city: 'San Francisco',
      region: 'CA',
    });
  });

  it('falls back to the Cloudflare country header', () => {
    expect(getGeoLocation(new Headers({ 'cf-ipcountry': 'th' })).country).toBe(
      'Thailand'
    );
  });

  it('prefers Vercel over Cloudflare', () => {
    expect(
      getGeoLocation(
        new Headers({ 'x-vercel-ip-country': 'IN', 'cf-ipcountry': 'TH' })
      ).country
    ).toBe('India');
  });

  it('is Unknown when no header is present', () => {
    expect(getGeoLocation(new Headers())).toEqual({
      country: 'Unknown',
      city: 'Unknown',
      region: 'Unknown',
    });
  });

  it.each(['XX', 'T1', '', 'USA', '12'])(
    'is Unknown for the non-country value %j',
    (value) => {
      expect(
        getGeoLocation(new Headers({ 'cf-ipcountry': value })).country
      ).toBe('Unknown');
    }
  );

  it('keeps a city that is not valid percent-encoding as it came', () => {
    expect(
      getGeoLocation(new Headers({ 'x-vercel-ip-city': '100%' })).city
    ).toBe('100%');
  });

  it('never calls fetch', () => {
    getGeoLocation(new Headers({ 'x-vercel-ip-country': 'US' }));
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('getLoginContext', () => {
  it('builds the context from the request headers without any network call', async () => {
    mockHeaders.mockResolvedValue(
      new Headers({
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0',
        'x-forwarded-for': '203.0.113.9, 10.0.0.1',
        'x-vercel-ip-country': 'DE',
        'x-vercel-ip-city': 'Berlin',
      })
    );

    const context = await getLoginContext();

    expect(context.ipAddress).toBe('203.0.113.9');
    expect(context.location).toEqual({
      country: 'Germany',
      city: 'Berlin',
      region: 'Unknown',
    });
    expect(context.device.browser).toBe('Chrome');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('still resolves, with an Unknown location, for a request that bypassed the edge', async () => {
    mockHeaders.mockResolvedValue(new Headers({ 'user-agent': 'curl/8' }));

    const context = await getLoginContext();

    expect(context.ipAddress).toBe('Unknown');
    expect(context.location.country).toBe('Unknown');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
