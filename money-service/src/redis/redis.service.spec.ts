/**
 * Reconnect strategy of money-service's shared Redis client (CacheService and
 * IdempotencyStore sit on it). No live Redis in this test environment, so
 * `ioredis` is mocked and the options handed to the constructor are read back.
 * Mirrors operation-service/src/redis/redis.service.spec.ts.
 */

const quit = jest.fn().mockResolvedValue(undefined);
const on = jest.fn();

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    quit,
    on,
  }));
});

process.env['REDIS_URL'] = 'redis://localhost:6379';

import Redis, { type RedisOptions } from 'ioredis';

import { RedisService } from './redis.service';

describe('RedisService reconnect strategy', () => {
  function retryStrategy(): (times: number) => number | null {
    jest.clearAllMocks();
    new RedisService();
    const options = (Redis as unknown as jest.Mock).mock
      .calls[0]?.[1] as RedisOptions;
    return options.retryStrategy as (times: number) => number | null;
  }

  it('never returns null: ioredis stops reconnecting for good on null', () => {
    const strategy = retryStrategy();

    for (const attempt of [1, 10, 11, 12, 60, 1_000, 100_000]) {
      expect(strategy(attempt)).not.toBeNull();
      expect(Number.isFinite(strategy(attempt))).toBe(true);
    }
  });

  it('keeps retrying after the old 10-attempt cut-off (a Redis restart over ~27 s)', () => {
    const strategy = retryStrategy();

    expect(strategy(11)).toBe(5_500);
    expect(strategy(12)).toBe(6_000);
  });

  it('backs off 500 ms per attempt and caps at 30 s', () => {
    const strategy = retryStrategy();

    expect(strategy(1)).toBe(500);
    expect(strategy(2)).toBe(1_000);
    expect(strategy(59)).toBe(29_500);
    expect(strategy(60)).toBe(30_000);
    expect(strategy(61)).toBe(30_000);
    expect(strategy(100_000)).toBe(30_000);
  });

  it('hands the client to its consumers and quits it on module destroy', async () => {
    jest.clearAllMocks();
    const service = new RedisService();

    expect(service.getClient()).toBeDefined();
    await service.onModuleDestroy();
    expect(quit).toHaveBeenCalledTimes(1);
  });
});
