/** @jest-environment node */
jest.unmock('@/lib/fx/usd-rates');
jest.unmock('@/lib/fx/shared-rate-store');
const mockRedisData = new Map<string, string>();
const mockRedisGet = jest.fn(
  async (key: string) => mockRedisData.get(key) ?? null
);
const mockRedisSet = jest.fn(
  async (key: string, value: string, _mode?: string, _ttl?: number) => {
    mockRedisData.set(key, value);
    return 'OK';
  }
);
jest.mock('@/lib/redis/client', () => ({
  getRedisClient: () => ({ get: mockRedisGet, set: mockRedisSet }),
}));
jest.mock('@/lib/logger', () => ({ logger: { warn: jest.fn() } }));

import { CURRENCY_USD_RATES, formatCurrencyAmount } from '@/lib/country-config';
import { logger } from '@/lib/logger';
import {
  FX_FAILURE_RETRY_MS,
  FX_MAX_RETAINED_AGE_MS,
  FX_SUPPORTED_CURRENCIES,
} from '@/lib/fx/rate-contract';
import {
  FX_PROVIDER_TIMEOUT_MS,
  parseFxTimestamp,
} from '@/lib/fx/rate-providers';
import { FX_USD_RATES_REDIS_KEY } from '@/lib/fx/shared-rate-store';
import {
  clearUsdRateCache,
  getDisplayUsdRates,
  getUsdRateTable,
  USD_RATES_TTL_MS,
} from '@/lib/fx/usd-rates';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;
const initialNow = Date.parse('2026-10-13T10:00:00Z');
const originalKey = process.env['CURRENCYBEACON_API_KEY'];
const originalRedisUrl = process.env['REDIS_URL'];
const allRates = () => ({ ...CURRENCY_USD_RATES });
const answer = (data: unknown) => ({ ok: true, json: async () => data });
const beacon = (
  rates = allRates(),
  date = new Date(Date.now()).toISOString()
) => ({
  meta: { code: 200 },
  response: { base: 'USD', date, rates },
});
const frankfurter = (rates = allRates(), date = '2026-10-13') =>
  FX_SUPPORTED_CURRENCIES.filter((quote) => quote !== 'USD').map((quote) => ({
    base: 'USD',
    quote,
    rate: rates[quote],
    date,
  }));
const shared = (
  provider: 'currencybeacon' | 'frankfurter' = 'currencybeacon',
  ageMs = 0
) => ({
  schemaVersion: 2,
  rates: allRates(),
  provider,
  rateUpdatedAt:
    provider === 'frankfurter'
      ? '2026-10-12T00:00:00.000Z'
      : new Date(Date.now() - ageMs).toISOString(),
  fetchedAt: new Date(Date.now() - ageMs).toISOString(),
  expiresAt: new Date(Date.now() - ageMs + USD_RATES_TTL_MS).toISOString(),
});

beforeEach(() => {
  jest.useFakeTimers({ now: initialNow });
  jest.clearAllMocks();
  mockFetch.mockReset();
  mockRedisGet
    .mockReset()
    .mockImplementation(async (key: string) => mockRedisData.get(key) ?? null);
  mockRedisSet
    .mockReset()
    .mockImplementation(
      async (key: string, value: string, _mode?: string, _ttl?: number) => {
        mockRedisData.set(key, value);
        return 'OK';
      }
    );
  mockRedisData.clear();
  clearUsdRateCache();
  process.env['CURRENCYBEACON_API_KEY'] = 'test-server-key';
  process.env['REDIS_URL'] = 'redis://test';
});
afterEach(() => {
  jest.useRealTimers();
  if (originalKey === undefined) delete process.env['CURRENCYBEACON_API_KEY'];
  else process.env['CURRENCYBEACON_API_KEY'] = originalKey;
  if (originalRedisUrl === undefined) delete process.env['REDIS_URL'];
  else process.env['REDIS_URL'] = originalRedisUrl;
});

describe('hourly provider selection and cache', () => {
  it('rejects hour 24 rather than normalising into the next calendar day', () => {
    expect(parseFxTimestamp('2026-10-12T24:00:00Z')).toBeNull();
    expect(parseFxTimestamp('2026-10-12T23:59:59Z')).toBe(
      Date.parse('2026-10-12T23:59:59Z')
    );
  });
  it('uses server-only Bearer auth, USD symbols, no extra Next cache, and publication metadata', async () => {
    mockFetch.mockResolvedValue(
      answer(beacon(allRates(), '2026-10-13T09:55:00Z'))
    );
    const table = await getDisplayUsdRates();
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).searchParams.get('base')).toBe('USD');
    expect(new URL(url).searchParams.get('symbols')?.split(',')).toEqual([
      ...FX_SUPPORTED_CURRENCIES,
    ]);
    expect(url).not.toContain('test-server-key');
    expect(options).toMatchObject({
      cache: 'no-store',
      headers: { Authorization: 'Bearer test-server-key' },
    });
    expect(options).not.toHaveProperty('next');
    expect(table).toMatchObject({
      provider: 'currencybeacon',
      source: 'live',
      rateUpdatedAt: '2026-10-13T09:55:00.000Z',
      fetchedAt: '2026-10-13T10:00:00.000Z',
    });
    expect(Object.keys(table.rates)).toHaveLength(15);
    expect(JSON.stringify(table)).not.toContain('test-server-key');
  });

  it('normalises an omitted identity quote only when the response confirms USD base', async () => {
    const rates = allRates();
    delete rates['USD'];
    mockFetch.mockResolvedValue(answer(beacon(rates)));
    expect((await getDisplayUsdRates()).rates['USD']).toBe(1);
  });

  it('accepts Unix seconds only when the provider omits its date field', async () => {
    const data = {
      response: {
        base: 'USD',
        timestamp: Date.now() / 1000,
        rates: allRates(),
      },
    };
    mockFetch.mockResolvedValueOnce(answer(data));
    expect((await getDisplayUsdRates()).rateUpdatedAt).toBe(
      '2026-10-13T10:00:00.000Z'
    );
    clearUsdRateCache();
    mockRedisData.clear();
    mockFetch
      .mockResolvedValueOnce(
        answer({ response: { ...data.response, date: 'malformed' } })
      )
      .mockResolvedValueOnce(answer(frankfurter()));
    expect((await getDisplayUsdRates()).provider).toBe('frankfurter');
  });

  it('fetches once per hour and changes converted subscription prices after expiry', async () => {
    mockFetch.mockResolvedValueOnce(
      answer(beacon({ ...allRates(), GBP: 0.74 }))
    );
    const first = await getDisplayUsdRates();
    const oneHour = 60 * 60 * 1000; // Product requirement, independent of implementation TTL.
    jest.setSystemTime(initialNow + oneHour - 1);
    expect((await getDisplayUsdRates()).rates['GBP']).toBe(0.74);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    jest.setSystemTime(initialNow + oneHour + 1);
    mockFetch.mockResolvedValueOnce(
      answer(beacon({ ...allRates(), GBP: 0.8 }))
    );
    const second = await getDisplayUsdRates();
    expect(second.rates['GBP']).toBe(0.8);
    expect(
      formatCurrencyAmount(20, {
        currency: 'GBP',
        language: 'en-GB',
        rates: first.rates,
      })
    ).toBe('£14.80');
    expect(
      formatCurrencyAmount(20, {
        currency: 'GBP',
        language: 'en-GB',
        rates: second.rates,
      })
    ).toBe('£16.00');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('deduplicates concurrent cold display and charge requests', async () => {
    mockFetch.mockResolvedValue(answer(beacon()));
    const [display, charge] = await Promise.all([
      getDisplayUsdRates(),
      getUsdRateTable({ fresh: true }),
    ]);
    expect(display.rates).toEqual(charge.rates);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockRedisSet).toHaveBeenCalledTimes(1);
  });

  it('prefers complete daily fallback over an earlier primary on an auth failure, then retries in 15 minutes', async () => {
    mockFetch.mockResolvedValueOnce(
      answer(beacon({ ...allRates(), GBP: 0.74 }))
    );
    await getDisplayUsdRates();
    jest.setSystemTime(initialNow + USD_RATES_TTL_MS + 1);
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce(answer(frankfurter({ ...allRates(), GBP: 0.77 })));
    const fallback = await getDisplayUsdRates();
    expect(fallback).toMatchObject({
      provider: 'frankfurter',
      source: 'fallback',
      rateUpdatedAt: '2026-10-13T00:00:00.000Z',
    });
    expect(fallback.rates['GBP']).toBe(0.77);
    expect(
      mockRedisSet.mock.calls[mockRedisSet.mock.calls.length - 1]?.[3]
    ).toBe(900);
    jest.setSystemTime(initialNow + USD_RATES_TTL_MS + FX_FAILURE_RETRY_MS);
    await getDisplayUsdRates();
    expect(mockFetch).toHaveBeenCalledTimes(3);
    jest.setSystemTime(initialNow + USD_RATES_TTL_MS + FX_FAILURE_RETRY_MS + 2);
    mockFetch.mockResolvedValueOnce(
      answer(beacon({ ...allRates(), GBP: 0.79 }))
    );
    expect((await getDisplayUsdRates()).provider).toBe('currencybeacon');
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('with no key requests only Frankfurter and caches it for an hour', async () => {
    delete process.env['CURRENCYBEACON_API_KEY'];
    mockFetch.mockResolvedValueOnce(answer(frankfurter()));
    const first = await getDisplayUsdRates();
    expect(first).toMatchObject({
      provider: 'frankfurter',
      source: 'fallback',
    });
    expect(String(mockFetch.mock.calls[0]?.[0])).toContain(
      'api.frankfurter.dev/v2/rates'
    );
    expect(mockFetch.mock.calls[0]?.[1]).not.toHaveProperty('headers');
    expect(
      new URL(String(mockFetch.mock.calls[0]?.[0])).searchParams
        .get('quotes')
        ?.split(',')
    ).toHaveLength(14);
    expect(mockRedisSet.mock.calls[0]?.[3]).toBe(3600);
    jest.setSystemTime(initialNow + FX_FAILURE_RETRY_MS + 1);
    expect((await getDisplayUsdRates()).rates).toEqual(first.rates);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('retains an earlier primary only when both providers fail, preserving its original age', async () => {
    mockFetch.mockResolvedValueOnce(
      answer(beacon({ ...allRates(), THB: 33.53 }))
    );
    const first = await getDisplayUsdRates();
    jest.setSystemTime(initialNow + 3 * USD_RATES_TTL_MS);
    mockFetch
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'));
    const retained = await getDisplayUsdRates();
    expect(retained).toEqual(first);
    jest.setSystemTime(initialNow + FX_MAX_RETAINED_AGE_MS + 1);
    mockFetch
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'));
    const fixed = await getDisplayUsdRates();
    expect(fixed).toMatchObject({
      provider: 'fixed',
      source: 'fallback',
      rateUpdatedAt: null,
    });
    expect(fixed.rates).toEqual(CURRENCY_USD_RATES);
  });

  it('shares retained rates with a cold reader during an outage without resetting source or fetch age', async () => {
    mockFetch.mockResolvedValueOnce(
      answer(beacon({ ...allRates(), GBP: 0.8 }))
    );
    const first = await getDisplayUsdRates();
    jest.setSystemTime(initialNow + 2 * USD_RATES_TTL_MS);
    mockFetch
      .mockRejectedValueOnce(new Error('primary down'))
      .mockRejectedValueOnce(new Error('daily down'));
    const retained = await getDisplayUsdRates();
    const published = JSON.parse(
      mockRedisData.get(FX_USD_RATES_REDIS_KEY) as string
    );
    expect(published).toMatchObject({
      fetchedAt: first.fetchedAt,
      rateUpdatedAt: first.rateUpdatedAt,
      expiresAt: '2026-10-13T12:15:00.000Z',
    });
    const providerCalls = mockFetch.mock.calls.length;
    clearUsdRateCache();
    const coldReader = await getDisplayUsdRates();
    expect(coldReader).toEqual(retained);
    expect(coldReader.rates['GBP']).toBe(0.8);
    expect(mockFetch).toHaveBeenCalledTimes(providerCalls);
    jest.setSystemTime(initialNow + FX_MAX_RETAINED_AGE_MS + 1);
    mockFetch
      .mockRejectedValueOnce(new Error('primary down'))
      .mockRejectedValueOnce(new Error('daily down'));
    expect((await getDisplayUsdRates()).provider).toBe('fixed');
  });

  it('does not retain stale primary source data even when its retrieval was recent', async () => {
    mockFetch.mockResolvedValueOnce(
      answer(
        beacon(
          allRates(),
          new Date(initialNow - FX_MAX_RETAINED_AGE_MS + 1000).toISOString()
        )
      )
    );
    await getDisplayUsdRates();
    jest.setSystemTime(initialNow + 1001);
    mockFetch
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'));
    expect((await getDisplayUsdRates()).provider).toBe('fixed');
  });

  it('falls back on a bounded request timeout and aborts the stalled primary', async () => {
    mockFetch
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce(answer(frankfurter()));
    const pending = getDisplayUsdRates();
    await jest.advanceTimersByTimeAsync(FX_PROVIDER_TIMEOUT_MS);
    expect((await pending).provider).toBe('frankfurter');
    expect((mockFetch.mock.calls[0]?.[1] as RequestInit).signal?.aborted).toBe(
      true
    );
  });

  it('does not expose credential-bearing fetch error text in logs or fallback data', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('Authorization: Bearer test-server-key'))
      .mockRejectedValueOnce(new Error('secret'));
    const table = await getDisplayUsdRates();
    expect(table.provider).toBe('fixed');
    expect(JSON.stringify((logger.warn as jest.Mock).mock.calls)).not.toContain(
      'test-server-key'
    );
    expect(mockRedisSet).not.toHaveBeenCalled();
  });

  it('uses complete versioned money-service snapshots without fetching providers', async () => {
    mockRedisData.set(
      FX_USD_RATES_REDIS_KEY,
      JSON.stringify(shared('frankfurter', 20 * 60 * 1000))
    );
    const table = await getDisplayUsdRates();
    expect(table).toMatchObject({
      provider: 'frankfurter',
      source: 'fallback',
      rateUpdatedAt: '2026-10-12T00:00:00.000Z',
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('ignores the legacy Redis key and refreshes expired v2 records', async () => {
    mockRedisData.set(
      'fx:usd_rates',
      JSON.stringify({
        rates: allRates(),
        fetchedAt: new Date(initialNow).toISOString(),
      })
    );
    mockRedisData.set(
      FX_USD_RATES_REDIS_KEY,
      JSON.stringify(shared('currencybeacon', USD_RATES_TTL_MS))
    );
    mockFetch.mockResolvedValueOnce(answer(beacon({ ...allRates(), THB: 34 })));
    expect((await getDisplayUsdRates()).rates['THB']).toBe(34);
    expect(mockRedisGet).toHaveBeenCalledWith(FX_USD_RATES_REDIS_KEY);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to providers when Redis fails and keeps successful rates in memory', async () => {
    mockRedisGet.mockRejectedValueOnce(
      new Error('redis credentials should not be logged')
    );
    mockRedisSet.mockRejectedValueOnce(new Error('redis failure'));
    mockFetch.mockResolvedValueOnce(answer(beacon()));
    expect((await getDisplayUsdRates()).provider).toBe('currencybeacon');
    expect((await getDisplayUsdRates()).provider).toBe('currencybeacon');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe('invalid provider data never reaches subscription conversions', () => {
  it.each([
    [
      'missing currency',
      () => {
        const data = beacon();
        delete data.response.rates['THB'];
        return data;
      },
    ],
    [
      'wrong base',
      () => ({ ...beacon(), response: { ...beacon().response, base: 'EUR' } }),
    ],
    ['nonidentity USD', () => beacon({ ...allRates(), USD: 2 })],
    ['negative rate', () => beacon({ ...allRates(), GBP: -1 })],
    ['zero rate', () => beacon({ ...allRates(), GBP: 0 })],
    ['infinite rate', () => beacon({ ...allRates(), GBP: Infinity })],
    ['NaN rate', () => beacon({ ...allRates(), GBP: NaN })],
    ['malformed date', () => beacon(allRates(), 'not-a-date')],
    ['rolled calendar date', () => beacon(allRates(), '2026-02-30T10:00:00Z')],
    [
      'stale source',
      () =>
        beacon(
          allRates(),
          new Date(Date.now() - FX_MAX_RETAINED_AGE_MS - 1).toISOString()
        ),
    ],
    [
      'future source',
      () =>
        beacon(
          allRates(),
          new Date(Date.now() + 5 * 60 * 1000 + 1).toISOString()
        ),
    ],
    ['body auth error', () => ({ ...beacon(), meta: { code: 401 } })],
  ])(
    'rejects CurrencyBeacon %s and uses validated fallback',
    async (_label, data) => {
      mockFetch
        .mockResolvedValueOnce(answer((data as () => unknown)()))
        .mockResolvedValueOnce(answer(frankfurter()));
      expect((await getDisplayUsdRates()).provider).toBe('frankfurter');
    }
  );

  it.each([
    ['partial', () => frankfurter().slice(1)],
    [
      'duplicate',
      () => {
        const rows = frankfurter();
        rows[1] = rows[0]!;
        return rows;
      },
    ],
    ['wrong base', () => frankfurter().map((row) => ({ ...row, base: 'EUR' }))],
    [
      'unknown quote',
      () => {
        const rows = frankfurter();
        rows[0] = { ...rows[0]!, quote: 'AAA' as 'GBP' };
        return rows;
      },
    ],
    [
      'nonpositive rate',
      () => frankfurter().map((row) => ({ ...row, rate: 0 })),
    ],
    [
      'nonfinite rate',
      () => frankfurter().map((row) => ({ ...row, rate: Infinity })),
    ],
    ['stale date', () => frankfurter(allRates(), '2026-10-05')],
    ['future date', () => frankfurter(allRates(), '2026-10-14')],
    ['invalid calendar', () => frankfurter(allRates(), '2026-02-30')],
  ])(
    'rejects Frankfurter %s and uses process-only fixed rates',
    async (_label, data) => {
      delete process.env['CURRENCYBEACON_API_KEY'];
      mockFetch.mockResolvedValueOnce(answer((data as () => unknown)()));
      const table = await getDisplayUsdRates();
      expect(table.provider).toBe('fixed');
      expect(table.rates).toEqual(CURRENCY_USD_RATES);
      expect(mockRedisSet).not.toHaveBeenCalled();
    }
  );
});
