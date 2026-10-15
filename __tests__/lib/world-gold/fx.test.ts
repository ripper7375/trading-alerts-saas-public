/** @jest-environment node */
import {
  clearWorldGoldFxCache,
  fxQualifiesForClose,
  getFxAtClose,
  getWorldGoldFx,
  parseStoredFx,
  parseWorldGoldProvider,
  publishFx,
  RAW_RETENTION_MS,
  type WorldGoldRedis,
} from '@/lib/world-gold/fx';
import { RATES, fxFixture } from './fixtures';
import { getRedisClient } from '@/lib/redis/client';
jest.mock('@/lib/redis/client', () => ({ getRedisClient: jest.fn() }));
const now = new Date('2026-10-15T10:05:00Z');
const provider = () => ({
  meta: { code: 200 },
  response: { base: 'USD', date: '2026-10-15T10:00:00Z', rates: { ...RATES } },
});
function redisMock(): jest.Mocked<WorldGoldRedis> {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    zadd: jest.fn().mockResolvedValue(1),
    zrevrangebyscore: jest.fn().mockResolvedValue([]),
    zremrangebyscore: jest.fn().mockResolvedValue(0),
    expireat: jest.fn().mockResolvedValue(1),
  };
}
beforeEach(() => clearWorldGoldFxCache());
describe('World gold fiat validation and no future leakage', () => {
  test('accepts complete normalized USD rates including the three currencies absent from billing FX', () => {
    expect(parseWorldGoldProvider(provider(), now)?.rates).toEqual(RATES);
  });
  test.each(['AUD', 'CHF', 'HKD', 'THB'])(
    'rejects partial rates missing %s',
    (code) => {
      const data = provider();
      delete (data.response.rates as Record<string, number>)[code];
      expect(parseWorldGoldProvider(data, now)).toBeNull();
    }
  );
  test.each([0, -1, Infinity, NaN])(
    'rejects invalid positive rate %s',
    (value) => {
      const data = provider();
      data.response.rates.AUD = value;
      expect(parseWorldGoldProvider(data, now)).toBeNull();
    }
  );
  test('rejects wrong base and non-200 API envelopes', () => {
    const data = provider();
    data.response.base = 'GBP';
    expect(parseWorldGoldProvider(data, now)).toBeNull();
    const rejected = provider();
    rejected.meta.code = 403;
    expect(parseWorldGoldProvider(rejected, now)).toBeNull();
  });
  test('rejects conflicting USD identity', () => {
    const data = provider();
    Object.assign(data.response.rates, { USD: 2 });
    expect(parseWorldGoldProvider(data, now)).toBeNull();
  });
  test('does not rescue a malformed supplied date with another timestamp field', () => {
    const data = provider();
    data.response.date = '2026-02-30T10:00:00Z';
    Object.assign(data.response, {
      timestamp: Date.parse('2026-10-15T10:00:00Z') / 1000,
    });
    expect(parseWorldGoldProvider(data, now)).toBeNull();
  });
  test('allows unix provider timestamp only when its date is absent', () => {
    const data = {
      response: {
        base: 'USD',
        timestamp: Date.parse('2026-10-15T10:00:00Z') / 1000,
        rates: RATES,
      },
    };
    expect(parseWorldGoldProvider(data, now)?.updatedAt).toBe(
      '2026-10-15T10:00:00.000Z'
    );
  });
  test('rejects even slightly future publications', () => {
    const data = provider();
    data.response.date = '2026-10-15T10:05:01Z';
    expect(parseWorldGoldProvider(data, now)).toBeNull();
  });
  test('rejects raw data at its eight-hour boundary and does not reset original times on reads', () => {
    const original = fxFixture('2026-10-15T02:05:00Z', '2026-10-15T02:06:00Z');
    expect(parseStoredFx(JSON.stringify(original), now)).toBeNull();
    const fresh = fxFixture();
    expect(parseStoredFx(JSON.stringify(fresh), now)).toEqual(fresh);
    expect(
      parseStoredFx(JSON.stringify({ ...fresh, provider: 'fixed' }), now)
    ).toBeNull();
  });
  test('an observation made after close cannot retrospectively fill that close', () => {
    const cutoff = new Date('2026-10-15T10:00:00Z');
    expect(
      fxQualifiesForClose(
        fxFixture('2026-10-15T09:59:00Z', '2026-10-15T10:01:00Z'),
        cutoff,
        now
      )
    ).toBe(false);
    expect(
      fxQualifiesForClose(
        fxFixture('2026-10-15T09:59:00Z', '2026-10-15T10:00:00Z'),
        cutoff,
        now
      )
    ).toBe(true);
  });
  test('a source older than 65 minutes at cutoff cannot define a close', () => {
    expect(
      fxQualifiesForClose(
        fxFixture('2026-10-15T08:54:59Z', '2026-10-15T09:00:00Z'),
        new Date('2026-10-15T10:00:00Z'),
        now
      )
    ).toBe(false);
  });
  test('writes raw quotes using an absolute source-bound retention deadline', async () => {
    const redis = redisMock();
    const snapshot = fxFixture();
    await publishFx(snapshot, redis, now);
    const deadline = (Date.parse(snapshot.updatedAt) + RAW_RETENTION_MS) / 1000;
    expect(redis.set.mock.calls).toHaveLength(2);
    for (const call of redis.set.mock.calls)
      expect(call.slice(2)).toEqual(['EXAT', deadline]);
  });
  test('historical selector rejects late observation and chooses latest qualifying publication', async () => {
    const redis = redisMock();
    const records = {
      late: fxFixture('2026-10-15T09:59:00Z', '2026-10-15T10:01:00Z'),
      older: fxFixture('2026-10-15T09:00:00Z', '2026-10-15T09:01:00Z'),
      correct: fxFixture('2026-10-15T09:30:00Z', '2026-10-15T09:31:00Z'),
    };
    redis.zrevrangebyscore.mockResolvedValue(['late', 'older', 'correct']);
    redis.get.mockImplementation(async (key) =>
      JSON.stringify(records[key as keyof typeof records])
    );
    expect(
      (await getFxAtClose(new Date('2026-10-15T10:00:00Z'), now, redis))
        ?.updatedAt
    ).toBe(records.correct.updatedAt);
  });
  test('missing or failed observation storage produces unavailable close FX', async () => {
    const redis = redisMock();
    redis.zrevrangebyscore.mockRejectedValue(new Error('offline'));
    expect(await getFxAtClose(now, now, redis)).toBeNull();
  });
});

describe('World gold in-process raw FX retention', () => {
  const originalRedisUrl = process.env['REDIS_URL'];
  const originalApiKey = process.env['CURRENCYBEACON_API_KEY'];
  let redis: jest.Mocked<WorldGoldRedis>;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
    clearWorldGoldFxCache();
    redis = redisMock();
    process.env['REDIS_URL'] = 'redis://unused-test-provider';
    delete process.env['CURRENCYBEACON_API_KEY'];
    jest
      .mocked(getRedisClient)
      .mockReturnValue(redis as unknown as ReturnType<typeof getRedisClient>);
  });
  afterEach(() => {
    clearWorldGoldFxCache();
    jest.useRealTimers();
    jest.restoreAllMocks();
    if (originalRedisUrl === undefined) delete process.env['REDIS_URL'];
    else process.env['REDIS_URL'] = originalRedisUrl;
    if (originalApiKey === undefined)
      delete process.env['CURRENCYBEACON_API_KEY'];
    else process.env['CURRENCYBEACON_API_KEY'] = originalApiKey;
  });
  async function seedMemory(snapshot = fxFixture()): Promise<void> {
    redis.get.mockResolvedValueOnce(JSON.stringify(snapshot));
    expect(await getWorldGoldFx()).toEqual(snapshot);
    redis.get.mockResolvedValue(null);
  }
  test('actively clears the raw cache at the original source deadline without a read', async () => {
    await seedMemory();
    expect(jest.getTimerCount()).toBe(1);
    jest.advanceTimersByTime(RAW_RETENTION_MS - 5 * 60 * 1000);
    expect(jest.getTimerCount()).toBe(0);
    // A backward wall-clock jump must not resurrect the observation from memory.
    jest.setSystemTime(now);
    expect(await getWorldGoldFx()).toBeNull();
    expect(await getFxAtClose(now, now, null)).toBeNull();
  });
  test('an expired access erases memory and its timer before a backward clock jump', async () => {
    await seedMemory();
    jest.setSystemTime(new Date('2026-10-15T18:00:00Z'));
    expect(await getWorldGoldFx()).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
    jest.setSystemTime(now);
    expect(await getWorldGoldFx()).toBeNull();
  });
  test('expiry cannot be bypassed by reloading the same raw Redis observation after clock rollback', async () => {
    const snapshot = fxFixture();
    await seedMemory(snapshot);
    jest.advanceTimersByTime(RAW_RETENTION_MS - 5 * 60 * 1000);
    jest.setSystemTime(now);
    redis.get.mockResolvedValue(JSON.stringify(snapshot));
    expect(await getWorldGoldFx()).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });
  test('an invalid cached object is discarded rather than becoming valid again after later mutation', async () => {
    await seedMemory();
    const cached = await getWorldGoldFx();
    expect(cached).not.toBeNull();
    if (!cached) throw new Error('Expected cached FX');
    cached.rates.GBP = 0;
    expect(await getWorldGoldFx()).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
    cached.rates.GBP = RATES.GBP;
    expect(await getWorldGoldFx()).toBeNull();
  });
  test('retention is capped by publication time even when observation is much more recent', async () => {
    const snapshot = {
      ...fxFixture('2026-10-15T02:06:00Z', '2026-10-15T10:05:00Z'),
      expiresAt: '2026-10-15T10:06:00.000Z',
    };
    await seedMemory(snapshot);
    jest.advanceTimersByTime(60 * 1000);
    expect(jest.getTimerCount()).toBe(0);
    jest.setSystemTime(now);
    expect(await getWorldGoldFx()).toBeNull();
  });
  test('historical-close access also erases an expired raw observation', async () => {
    await seedMemory();
    const cutoff = new Date('2026-10-15T10:05:00Z');
    jest.setSystemTime(new Date('2026-10-15T18:00:00Z'));
    expect(await getFxAtClose(cutoff, new Date(), null)).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
    jest.setSystemTime(now);
    expect(await getFxAtClose(cutoff, now, null)).toBeNull();
  });
  test('a stale publication follows hourly observation refresh rather than fetching on every request', async () => {
    delete process.env['REDIS_URL'];
    process.env['CURRENCYBEACON_API_KEY'] = 'fake-test-key';
    const staleProvider = provider();
    staleProvider.response.date = '2026-10-15T08:00:00Z';
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => staleProvider,
    } as Response);
    expect((await getWorldGoldFx())?.updatedAt).toBe(
      '2026-10-15T08:00:00.000Z'
    );
    expect(await getWorldGoldFx()).not.toBeNull();
    jest.advanceTimersByTime(59 * 60 * 1000);
    expect(await getWorldGoldFx()).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(60 * 1000);
    expect(await getWorldGoldFx()).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  test('reset invalidates a late provider completion and leaves no raw expiry timer', async () => {
    delete process.env['REDIS_URL'];
    process.env['CURRENCYBEACON_API_KEY'] = 'fake-test-key';
    let finish: ((response: Response) => void) | undefined;
    jest.spyOn(global, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        })
    );
    const pending = getWorldGoldFx();
    clearWorldGoldFxCache();
    if (!finish) throw new Error('Provider request did not start');
    finish({ ok: true, json: async () => provider() } as Response);
    expect(await pending).toBeNull();
    delete process.env['CURRENCYBEACON_API_KEY'];
    expect(await getWorldGoldFx()).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });
  test('an old completion cannot clear a replacement in-flight refresh after reset', async () => {
    delete process.env['REDIS_URL'];
    process.env['CURRENCYBEACON_API_KEY'] = 'fake-test-key';
    const finishes: Array<(response: Response) => void> = [];
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finishes.push(resolve);
        })
    );
    const old = getWorldGoldFx();
    clearWorldGoldFxCache();
    const replacement = getWorldGoldFx();
    const response = { ok: true, json: async () => provider() } as Response;
    finishes[0]?.(response);
    expect(await old).toBeNull();
    const joined = getWorldGoldFx();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    finishes[1]?.(response);
    expect(await replacement).not.toBeNull();
    expect(await joined).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
