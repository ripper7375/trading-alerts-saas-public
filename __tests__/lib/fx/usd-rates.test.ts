/**
 * @jest-environment node
 */
/**
 * Live USD rates (lib/fx/usd-rates.ts): one hourly table shared by the dLocal
 * charge and the prices pages display (formatCurrencyAmount).
 */
jest.unmock('@/lib/fx/usd-rates');
jest.unmock('@/lib/fx/shared-rate-store');

// In-memory stand-in for the Redis instance shared with money-service
const mockRedisData = new Map<string, string>();
const mockRedisGet = jest.fn(
  async (key: string) => mockRedisData.get(key) ?? null
);
const mockRedisSet = jest.fn(async (key: string, value: string) => {
  mockRedisData.set(key, value);
  return 'OK';
});
jest.mock('@/lib/redis/client', () => ({
  __esModule: true,
  getRedisClient: () => ({
    get: (key: string) => mockRedisGet(key),
    set: (key: string, value: string) => mockRedisSet(key, value),
  }),
}));

import { formatCurrencyAmount } from '@/lib/country-config';
import {
  FX_USD_RATES_REDIS_KEY,
  FX_USD_RATES_TTL_SECONDS,
} from '@/lib/fx/shared-rate-store';
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
    mockRedisData.clear();
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

  it('uses a table money-service published in Redis without calling the API', async () => {
    mockRedisData.set(
      FX_USD_RATES_REDIS_KEY,
      JSON.stringify({
        rates: { THB: 36.1 },
        fetchedAt: new Date(now - 20 * 60 * 1000).toISOString(),
      })
    );

    const table = await getUsdRateTable({ fresh: true });

    expect(table.source).toBe('live');
    expect(table.rates['THB']).toBe(36.1);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('expires a Redis table one hour after its fetch, like the publisher', async () => {
    mockRedisData.set(
      FX_USD_RATES_REDIS_KEY,
      JSON.stringify({
        rates: { THB: 36.1 },
        fetchedAt: new Date(now - 50 * 60 * 1000).toISOString(),
      })
    );
    await getUsdRateTable({ fresh: true });

    now += 10 * 60 * 1000 + 1;
    mockFetch.mockResolvedValueOnce(answer({ THB: 36.4 }));
    const next = await getUsdRateTable({ fresh: true });

    expect(next.rates['THB']).toBe(36.4);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('on a Redis miss, fetches the API and publishes the table for an hour', async () => {
    mockFetch.mockResolvedValueOnce(answer({ INR: 84.2 }));

    await getUsdRateTable({ fresh: true });

    expect(mockRedisSet).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mockRedisData.get(FX_USD_RATES_REDIS_KEY) ?? '')).toEqual(
      { rates: { INR: 84.2 }, fetchedAt: new Date(now).toISOString() }
    );
    expect(FX_USD_RATES_TTL_SECONDS).toBe(3600);
  });

  it('goes to the API when Redis is unreachable', async () => {
    mockRedisGet.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    mockRedisSet.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    mockFetch.mockResolvedValueOnce(answer({ AED: 3.6725 }));

    const table = await getUsdRateTable({ fresh: true });

    expect(table.rates['AED']).toBe(3.6725);
  });

  it('never publishes a fallback table', async () => {
    mockFetch.mockRejectedValueOnce(new Error('down'));

    await getUsdRateTable({ fresh: true });

    expect(mockRedisSet).not.toHaveBeenCalled();
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
