import { logger } from '../common/logger.util';
import {
  FALLBACK_USD_RATES,
  FX_FAILURE_RETRY_MS,
  FX_MAX_RETAINED_AGE_MS,
  FX_SUPPORTED_CURRENCIES,
  FX_USD_RATES_REDIS_KEY,
  FX_USD_RATES_SCHEMA_VERSION,
  FX_USD_RATES_TTL_SECONDS,
} from './usd-fallback-rates';
import {
  clearUsdRateCache,
  getUsdRateTable,
  parseSharedUsdRates,
  USD_RATES_TTL_MS,
  type SharedRateStore,
} from './usd-rates';

jest.mock('../common/logger.util', () => ({
  logger: { warn: jest.fn(), info: jest.fn() },
}));
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;
const answer = (payload: unknown) => ({ ok: true, json: async () => payload });
const rates: Record<string, number> = {
  ...FALLBACK_USD_RATES,
  THB: 33.53,
  GBP: 0.756,
};

function fakeRedis(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const store = {
    get: jest.fn(async (key: string) => data.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      data.set(key, value);
      return 'OK';
    }),
  };
  return { store: store as SharedRateStore & typeof store, data };
}

describe('shared USD rate table (money-service)', () => {
  let now: number;
  const originalKey = process.env.CURRENCYBEACON_API_KEY;
  const primary = (updatedAt = now) => ({
    meta: { code: 200 },
    response: { base: 'USD', timestamp: updatedAt / 1000, rates },
  });
  const fallback = () =>
    FX_SUPPORTED_CURRENCIES.filter((code) => code !== 'USD').map((quote) => ({
      base: 'USD',
      quote,
      rate: rates[quote],
      date: '2026-10-12',
    }));
  const stored = (patch: Record<string, unknown> = {}) =>
    JSON.stringify({
      schemaVersion: FX_USD_RATES_SCHEMA_VERSION,
      rates,
      provider: 'currencybeacon',
      rateUpdatedAt: new Date(now - 10 * 60 * 1000).toISOString(),
      fetchedAt: new Date(now - 5 * 60 * 1000).toISOString(),
      expiresAt: new Date(now + 55 * 60 * 1000).toISOString(),
      ...patch,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    clearUsdRateCache();
    now = Date.parse('2026-10-13T10:00:00Z');
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    process.env.CURRENCYBEACON_API_KEY = 'test-secret';
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalKey === undefined) delete process.env.CURRENCYBEACON_API_KEY;
    else process.env.CURRENCYBEACON_API_KEY = originalKey;
  });

  it('uses the complete versioned table the Next app publishes without a provider call', async () => {
    const { store } = fakeRedis({ [FX_USD_RATES_REDIS_KEY]: stored() });
    const table = await getUsdRateTable(store);
    expect(table).toMatchObject({
      source: 'live',
      provider: 'currencybeacon',
      rates,
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('keeps fallback provenance when the Next app publishes Frankfurter data', async () => {
    const { store } = fakeRedis({
      [FX_USD_RATES_REDIS_KEY]: stored({
        provider: 'frankfurter',
        rateUpdatedAt: '2026-10-12T00:00:00.000Z',
      }),
    });
    expect(await getUsdRateTable(store)).toMatchObject({
      source: 'fallback',
      provider: 'frankfurter',
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('refreshes at the publisher expiry instead of granting another hour', async () => {
    const { store } = fakeRedis({ [FX_USD_RATES_REDIS_KEY]: stored() });
    await getUsdRateTable(store);
    now += 55 * 60 * 1000;
    mockFetch.mockResolvedValueOnce(answer(primary()));
    const table = await getUsdRateTable(store);
    expect(table.fetchedAt).toBe(new Date(now).toISOString());
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('publishes full primary metadata and one-hour expiry for the Next app', async () => {
    const { store, data } = fakeRedis();
    mockFetch.mockResolvedValueOnce(answer(primary(now - 20 * 60 * 1000)));
    await getUsdRateTable(store);
    expect(store.set).toHaveBeenCalledWith(
      FX_USD_RATES_REDIS_KEY,
      expect.any(String),
      'EX',
      FX_USD_RATES_TTL_SECONDS
    );
    expect(
      parseSharedUsdRates(data.get(FX_USD_RATES_REDIS_KEY) ?? null)
    ).toEqual({
      schemaVersion: 2,
      rates,
      provider: 'currencybeacon',
      rateUpdatedAt: new Date(now - 20 * 60 * 1000).toISOString(),
      fetchedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + USD_RATES_TTL_MS).toISOString(),
    });
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).not.toContain('test-secret');
    expect(options.headers).toEqual({ Authorization: 'Bearer test-secret' });
    expect(new URL(url).searchParams.get('symbols')?.split(',')).toEqual(
      FX_SUPPORTED_CURRENCIES
    );
  });

  it('deduplicates concurrent refreshes and serves memory until the hour expires', async () => {
    const { store } = fakeRedis();
    mockFetch.mockResolvedValueOnce(answer(primary()));
    const tables = await Promise.all([
      getUsdRateTable(store),
      getUsdRateTable(store),
      getUsdRateTable(store),
    ]);
    expect(tables[0]).toBe(tables[1]);
    now += USD_RATES_TTL_MS - 1;
    await getUsdRateTable(store);
    expect(store.get).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to providers when Redis read and write fail without logging error content', async () => {
    const store: SharedRateStore = {
      get: jest.fn().mockRejectedValue(new Error('test-secret')),
      set: jest.fn().mockRejectedValue(new Error('test-secret')),
    };
    mockFetch.mockResolvedValueOnce(answer(primary()));
    expect((await getUsdRateTable(store)).provider).toBe('currencybeacon');
    expect(JSON.stringify((logger.warn as jest.Mock).mock.calls)).not.toContain(
      'test-secret'
    );
  });

  it('prefers a complete fresh Frankfurter snapshot after primary failure and retries after 15 minutes', async () => {
    const { store, data } = fakeRedis();
    mockFetch.mockRejectedValueOnce(
      new Error('Authorization: Bearer test-secret')
    );
    mockFetch.mockResolvedValueOnce(answer(fallback()));
    const table = await getUsdRateTable(store);
    expect(table).toMatchObject({
      rates,
      provider: 'frankfurter',
      source: 'fallback',
      rateUpdatedAt: '2026-10-12T00:00:00.000Z',
    });
    expect(store.set).toHaveBeenCalledWith(
      FX_USD_RATES_REDIS_KEY,
      expect.any(String),
      'EX',
      900
    );
    expect(JSON.parse(data.get(FX_USD_RATES_REDIS_KEY)!)).toMatchObject({
      expiresAt: new Date(now + FX_FAILURE_RETRY_MS).toISOString(),
    });
    expect(JSON.stringify((logger.warn as jest.Mock).mock.calls)).not.toContain(
      'test-secret'
    );
    now += FX_FAILURE_RETRY_MS;
    mockFetch.mockResolvedValueOnce(answer(primary()));
    expect((await getUsdRateTable(store)).provider).toBe('currencybeacon');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('uses Frankfurter directly without a key and caches it for an hour', async () => {
    delete process.env.CURRENCYBEACON_API_KEY;
    const { store } = fakeRedis();
    mockFetch.mockResolvedValueOnce(answer(fallback()));
    expect((await getUsdRateTable(store)).provider).toBe('frankfurter');
    expect(mockFetch.mock.calls[0][0]).toContain(
      'api.frankfurter.dev/v2/rates'
    );
    expect(store.set).toHaveBeenCalledWith(
      FX_USD_RATES_REDIS_KEY,
      expect.any(String),
      'EX',
      3600
    );
    now += USD_RATES_TTL_MS - 1;
    await getUsdRateTable(store);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('uses retained primary only if both providers fail, and never beyond eight hours', async () => {
    mockFetch.mockResolvedValueOnce(answer(primary()));
    const original = await getUsdRateTable(null);
    now += USD_RATES_TTL_MS;
    mockFetch
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'));
    expect(await getUsdRateTable(null)).toBe(original);
    now += FX_MAX_RETAINED_AGE_MS;
    mockFetch
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'));
    expect(await getUsdRateTable(null)).toMatchObject({
      provider: 'fixed',
      rates: FALLBACK_USD_RATES,
      source: 'fallback',
      rateUpdatedAt: null,
    });
  });

  it('bounds primary source age even inside the memory TTL', async () => {
    mockFetch.mockResolvedValueOnce(
      answer(primary(now - FX_MAX_RETAINED_AGE_MS + 1))
    );
    await getUsdRateTable(null);
    now += 2;
    mockFetch
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce(answer(fallback()));
    expect((await getUsdRateTable(null)).provider).toBe('frankfurter');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('shares retained primary rates with a cold process without resetting source or retrieval time', async () => {
    const { store, data } = fakeRedis();
    mockFetch.mockResolvedValueOnce(answer(primary(now - 20 * 60 * 1000)));
    const original = await getUsdRateTable(store);
    now += USD_RATES_TTL_MS;
    mockFetch
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'));
    expect(await getUsdRateTable(store)).toBe(original);
    const retained = parseSharedUsdRates(data.get(FX_USD_RATES_REDIS_KEY)!);
    expect(retained).toMatchObject({
      provider: 'currencybeacon',
      rates,
      fetchedAt: original.fetchedAt,
      rateUpdatedAt: original.rateUpdatedAt,
      expiresAt: new Date(now + FX_FAILURE_RETRY_MS).toISOString(),
    });
    expect(store.set).toHaveBeenLastCalledWith(
      FX_USD_RATES_REDIS_KEY,
      expect.any(String),
      'EX',
      900
    );
    clearUsdRateCache();
    mockFetch.mockReset();
    expect(await getUsdRateTable(store)).toEqual(original);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('shares retained Frankfurter fallback with a cold process during a provider outage', async () => {
    delete process.env.CURRENCYBEACON_API_KEY;
    const { store, data } = fakeRedis();
    mockFetch.mockResolvedValueOnce(answer(fallback()));
    const original = await getUsdRateTable(store);
    now += USD_RATES_TTL_MS;
    mockFetch.mockRejectedValueOnce(new Error('down'));
    expect(await getUsdRateTable(store)).toBe(original);
    expect(
      parseSharedUsdRates(data.get(FX_USD_RATES_REDIS_KEY)!)
    ).toMatchObject({
      provider: 'frankfurter',
      fetchedAt: original.fetchedAt,
      rateUpdatedAt: original.rateUpdatedAt,
      expiresAt: new Date(now + USD_RATES_TTL_MS).toISOString(),
    });
    clearUsdRateCache();
    mockFetch.mockReset();
    expect(await getUsdRateTable(store)).toEqual(original);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('clips shared primary expiry to the original observation eight-hour limit', async () => {
    const { store, data } = fakeRedis();
    const sourceMs = now - FX_MAX_RETAINED_AGE_MS + 10 * 60 * 1000;
    mockFetch.mockResolvedValueOnce(answer(primary(sourceMs)));
    const original = await getUsdRateTable(store);
    expect(
      parseSharedUsdRates(data.get(FX_USD_RATES_REDIS_KEY)!)
    ).toMatchObject({
      expiresAt: new Date(sourceMs + FX_MAX_RETAINED_AGE_MS).toISOString(),
    });
    now += 9 * 60 * 1000;
    // Another process can use the snapshot only until its original source deadline.
    clearUsdRateCache();
    mockFetch.mockReset();
    expect(await getUsdRateTable(store)).toEqual(original);
    now += 60 * 1000 + 1; // past the inclusive eight-hour observation limit
    mockFetch
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'));
    expect((await getUsdRateTable(store)).provider).toBe('fixed');
  });

  it('rejects shared retry expiries that exceed source or retrieval eight-hour limits', () => {
    const oldFetchedAt = new Date(
      now - FX_MAX_RETAINED_AGE_MS + 10 * 60 * 1000
    ).toISOString();
    expect(
      parseSharedUsdRates(
        stored({
          fetchedAt: oldFetchedAt,
          rateUpdatedAt: oldFetchedAt,
          expiresAt: new Date(now + 15 * 60 * 1000).toISOString(),
        })
      )
    ).toBeNull();
    expect(
      parseSharedUsdRates(
        stored({
          provider: 'frankfurter',
          fetchedAt: oldFetchedAt,
          rateUpdatedAt: '2026-10-12T00:00:00.000Z',
          expiresAt: new Date(now + 15 * 60 * 1000).toISOString(),
        })
      )
    ).toBeNull();
    expect(
      parseSharedUsdRates(
        stored({
          rateUpdatedAt: oldFetchedAt,
          expiresAt: new Date(now + 15 * 60 * 1000).toISOString(),
        })
      )
    ).toBeNull();
  });

  it('returns one complete fixed table when both providers fail and never publishes it', async () => {
    const { store } = fakeRedis();
    mockFetch
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'));
    expect(await getUsdRateTable(store)).toMatchObject({
      provider: 'fixed',
      rates: FALLBACK_USD_RATES,
      source: 'fallback',
      rateUpdatedAt: null,
    });
    expect(store.set).not.toHaveBeenCalled();
  });

  it.each([
    { schemaVersion: 1 },
    { provider: 'fixed' },
    { rates: { USD: 1, THB: 33.53 } },
    { rates: { ...rates, USD: 0.9 } },
    { fetchedAt: 'bad' },
    { fetchedAt: '2026-10-13T10:06:00.000Z' },
    { rateUpdatedAt: '2026-10-13T10:06:00.000Z' },
    { rateUpdatedAt: '2026-10-13T01:59:59.000Z' },
    { expiresAt: '2026-10-13T10:00:00.000Z' },
    { expiresAt: '2026-10-13T12:00:00.000Z' },
    { rateUpdatedAt: null },
  ])('rejects malformed shared metadata: %j', (patch) => {
    expect(parseSharedUsdRates(stored(patch))).toBeNull();
  });

  it('does not merge a partial provider response with fixed currency values', async () => {
    mockFetch
      .mockResolvedValueOnce(
        answer({
          response: {
            base: 'USD',
            date: new Date(now).toISOString(),
            rates: { USD: 1, THB: 33.53 },
          },
        })
      )
      .mockResolvedValueOnce(answer(fallback().slice(1)));
    expect((await getUsdRateTable(null)).rates).toEqual(FALLBACK_USD_RATES);
  });
});
