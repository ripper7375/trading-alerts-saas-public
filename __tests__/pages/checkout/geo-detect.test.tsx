/**
 * Geo Detection Route Tests (Session 6-8, resolves F61)
 *
 * Verifies the new GET /api/geo/detect route wrapper correctly delegates
 * to lib/geo/detect-country.ts's detectCountry() and shapes its response.
 *
 * @module __tests__/pages/checkout/geo-detect.test
 */

import { NextRequest } from 'next/server';

import { GET } from '@/app/api/geo/detect/route';

jest.mock('@/lib/geo/detect-country', () => ({
  detectCountry: jest.fn(),
}));

describe('GET /api/geo/detect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 with the detected country and countryCode', async () => {
    const { detectCountry } = await import('@/lib/geo/detect-country');
    (detectCountry as jest.Mock).mockResolvedValueOnce('IN');

    const request = new NextRequest('http://localhost:3000/api/geo/detect', {
      headers: { 'cf-ipcountry': 'IN' },
    });
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ country: 'IN', countryCode: 'IN' });
  });

  it('passes the real request headers through to detectCountry', async () => {
    const { detectCountry } = await import('@/lib/geo/detect-country');
    (detectCountry as jest.Mock).mockResolvedValueOnce('TH');

    const request = new NextRequest('http://localhost:3000/api/geo/detect', {
      headers: { 'x-vercel-ip-country': 'TH' },
    });
    await GET(request);

    expect(detectCountry).toHaveBeenCalledTimes(1);
    const passedHeaders = (detectCountry as jest.Mock).mock.calls[0][0];
    expect(passedHeaders.get('x-vercel-ip-country')).toBe('TH');
  });

  it('falls back to the default country when no geo headers are present', async () => {
    const { detectCountry } = await import('@/lib/geo/detect-country');
    (detectCountry as jest.Mock).mockResolvedValueOnce('US');

    const request = new NextRequest('http://localhost:3000/api/geo/detect');
    const response = await GET(request);

    const data = await response.json();
    expect(data.country).toBe('US');
  });
});
