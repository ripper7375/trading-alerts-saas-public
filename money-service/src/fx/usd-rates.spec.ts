/**
 * The USD rate table shared with the Next app through Redis (`fx:usd_rates`).
 */
import {
  FX_USD_RATES_REDIS_KEY,
  FX_USD_RATES_TTL_SECONDS,
} from './usd-fallback-rates';
import {
  clearUsdRateCache,
  getUsdRateTable,
  parseSharedUsdRates,
  USD_RATES_TTL_MS,
  type SharedRateStore,
} from './usd-rates';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const answer = (rates: Record<string, number>) => ({
  ok: true,
  json: async () => ({ rates }),
});

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
  let now = Date.parse('2026-09-26T10:00:00Z');

  beforeEach(() => {
    jest.clearAllMocks();
    clearUsdRateCache();
    now = Date.parse('2026-09-26T10:00:00Z');
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => jest.restoreAllMocks());

  it('uses the table the Next app published in Redis without calling the API', async () => {
    const { store } = fakeRedis({
      [FX_USD_RATES_REDIS_KEY]: JSON.stringify({
        rates: { THB: 36.1 },
        fetchedAt: new Date(now - 10 * 60 * 1000).toISOString(),
      }),
    });

    const table = await getUsdRateTable(store);

    expect(table.source).toBe('live');
    expect(table.rates['THB']).toBe(36.1);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('expires a Redis table with the publisher, one hour after its fetch', async () => {
    const fetchedAt = new Date(now - 50 * 60 * 1000).toISOString();
    const { store } = fakeRedis({
      [FX_USD_RATES_REDIS_KEY]: JSON.stringify({
        rates: { THB: 36.1 },
        fetchedAt,
      }),
    });
    await getUsdRateTable(store);

    now += 10 * 60 * 1000 + 1; // the table is now over an hour old
    mockFetch.mockResolvedValueOnce(answer({ THB: 36.4 }));
    const next = await getUsdRateTable(store);

    expect(next.rates['THB']).toBe(36.4);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('on a Redis miss, fetches the API and publishes the table for an hour', async () => {
    const { store, data } = fakeRedis();
    mockFetch.mockResolvedValueOnce(answer({ INR: 84.2 }));

    const table = await getUsdRateTable(store);

    expect(table.rates['INR']).toBe(84.2);
    expect(store.set).toHaveBeenCalledWith(
      FX_USD_RATES_REDIS_KEY,
      expect.any(String),
      'EX',
      FX_USD_RATES_TTL_SECONDS
    );
    expect(
      parseSharedUsdRates(data.get(FX_USD_RATES_REDIS_KEY) ?? null)
    ).toEqual({ rates: { INR: 84.2 }, fetchedAt: new Date(now).toISOString() });
  });

  it('serves its in-memory table for an hour without asking Redis again', async () => {
    const { store } = fakeRedis();
    mockFetch.mockResolvedValueOnce(answer({ INR: 84.2 }));
    await getUsdRateTable(store);

    now += USD_RATES_TTL_MS - 1;
    await getUsdRateTable(store);

    expect(store.get).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to the API when Redis fails', async () => {
    const store: SharedRateStore = {
      get: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      set: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    };
    mockFetch.mockResolvedValueOnce(answer({ AED: 3.6725 }));

    const table = await getUsdRateTable(store);

    expect(table.rates['AED']).toBe(3.6725);
  });

  it('ignores a malformed Redis value', async () => {
    const { store } = fakeRedis({ [FX_USD_RATES_REDIS_KEY]: 'not json' });
    mockFetch.mockResolvedValueOnce(answer({ AED: 3.6725 }));

    expect((await getUsdRateTable(store)).rates['AED']).toBe(3.6725);
  });

  it('reports fallback when both Redis and the API are unavailable', async () => {
    mockFetch.mockRejectedValueOnce(new Error('down'));

    const table = await getUsdRateTable(null);

    expect(table.source).toBe('fallback');
    expect(table.rates).toEqual({});
  });
});
