/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET as ratesGET } from '@/app/api/fx/rates/route';
import { GET as convertGET } from '@/app/api/payments/dlocal/convert/route';
import { getDisplayUsdRates } from '@/lib/fx/usd-rates';
import { convertUSDToLocal } from '@/lib/dlocal/currency-converter.service';
import { CURRENCY_USD_RATES } from '@/lib/country-config';

jest.mock('@/lib/dlocal/currency-converter.service', () => ({
  convertUSDToLocal: jest.fn(),
}));
const mockRates = jest.mocked(getDisplayUsdRates);
const mockConvert = jest.mocked(convertUSDToLocal);

describe('public FX and checkout conversion HTTP caching', () => {
  it('returns complete public provenance without an extra browser/CDN cache window', async () => {
    const snapshot = {
      rates: { ...CURRENCY_USD_RATES, GBP: 0.77 },
      provider: 'currencybeacon' as const,
      source: 'live' as const,
      fetchedAt: '2026-10-13T04:00:00Z',
      rateUpdatedAt: '2026-10-13T03:45:00Z',
    };
    mockRates.mockResolvedValueOnce(snapshot);
    const response = await ratesGET();
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(snapshot);
  });

  it.each(['THB', 'BRL'])(
    'returns a fresh %s quote with no-store caching',
    async (currency) => {
      mockConvert.mockResolvedValueOnce({
        localAmount: 100,
        exchangeRate: 5,
        usdAmount: 20,
        currency: currency as 'THB' | 'BRL',
      });
      const response = await convertGET(
        new NextRequest(
          `http://localhost/api/payments/dlocal/convert?amount=20&currency=${currency}`
        )
      );
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toEqual({
        localAmount: 100,
        exchangeRate: 5,
        usdAmount: 20,
        currency,
        timestamp: expect.any(String),
      });
      expect(mockConvert).toHaveBeenLastCalledWith(20, currency);
    }
  );
});
