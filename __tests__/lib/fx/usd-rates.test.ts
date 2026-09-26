/**
 * @jest-environment node
 */
/**
 * Live USD rates (lib/fx/usd-rates.ts): one hourly table shared by the dLocal
 * charge and the prices pages display (formatCurrencyAmount).
 */
jest.unmock('@/lib/fx/usd-rates');

import { formatCurrencyAmount } from '@/lib/country-config';
import {
  clearUsdRateCache,
  getDisplayUsdRates,
  getUsdRateTable,
  USD_RATES_TTL_MS,
} from '@/lib/fx/usd-rates';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const answer = (rates: Record<string, number>) => ({
  ok: true,
  json: async () => ({ rates }),
});
const flush = () => new Promise((r) => setImmediate(r));

describe('shared USD rate table', () => {
  let now = Date.parse('2026-09-26T10:00:00Z');

  beforeEach(() => {
    jest.clearAllMocks();
    clearUsdRateCache();
    now = Date.parse('2026-09-26T10:00:00Z');
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => jest.restoreAllMocks());

  it('fetches the table once and serves it for an hour', async () => {
    mockFetch.mockResolvedValue(answer({ GBP: 0.74, THB: 36.1 }));

    const first = await getUsdRateTable();
    now += USD_RATES_TTL_MS - 1;
    const second = await getUsdRateTable();

    expect(first.source).toBe('live');
    expect(second.rates['GBP']).toBe(0.74);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('display callers get the old table at once and a background refresh', async () => {
    mockFetch.mockResolvedValueOnce(answer({ GBP: 0.74 }));
    await getUsdRateTable();

    now += USD_RATES_TTL_MS + 1;
    mockFetch.mockResolvedValueOnce(answer({ GBP: 0.8 }));
    const stale = await getUsdRateTable();
    expect(stale.rates['GBP']).toBe(0.74); // no waiting on the API
    await flush();
    expect((await getUsdRateTable()).rates['GBP']).toBe(0.8);
  });

  it('charges (fresh) wait for the refresh', async () => {
    mockFetch.mockResolvedValueOnce(answer({ INR: 83 }));
    await getUsdRateTable();

    now += USD_RATES_TTL_MS + 1;
    mockFetch.mockResolvedValueOnce(answer({ INR: 84.2 }));
    expect((await getUsdRateTable({ fresh: true })).rates['INR']).toBe(84.2);
  });

  it('falls back when the API fails, keeping an earlier live table', async () => {
    mockFetch.mockRejectedValueOnce(new Error('down'));
    const failed = await getUsdRateTable();
    expect(failed.source).toBe('fallback');
    expect(failed.rates).toEqual({});

    clearUsdRateCache();
    mockFetch.mockResolvedValueOnce(answer({ GBP: 0.74 }));
    await getUsdRateTable();
    now += USD_RATES_TTL_MS + 1;
    mockFetch.mockRejectedValueOnce(new Error('down again'));
    expect((await getUsdRateTable({ fresh: true })).rates['GBP']).toBe(0.74);
  });

  it('display rates cover every display currency, fixed where no live rate', async () => {
    mockFetch.mockResolvedValue(answer({ GBP: 0.74 }));

    const display = await getDisplayUsdRates();

    expect(display.source).toBe('live');
    expect(display.rates['GBP']).toBe(0.74); // live
    expect(display.rates['USD']).toBe(1);
    expect(display.rates['THB']).toBe(35.0); // fixed rate from country-config
  });
});

describe('formatCurrencyAmount with live rates', () => {
  it('uses the live rate when given, the fixed rate otherwise', () => {
    expect(
      formatCurrencyAmount(29, { currency: 'GBP', language: 'en-GB' })
    ).toBe(
      '£22.62' // fixed 0.78
    );
    expect(
      formatCurrencyAmount(29, {
        currency: 'GBP',
        language: 'en-GB',
        rates: { GBP: 0.74 },
      })
    ).toBe('£21.46');
  });
});
