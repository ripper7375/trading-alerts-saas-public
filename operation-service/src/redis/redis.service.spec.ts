/**
 * Session 11-3: unit coverage for RedisService.trackAiTokenUsage() (Core
 * Area 4). No live Redis in this test environment, so `ioredis` is mocked —
 * same pattern as alert-worker.service.spec.ts (mock the client's methods,
 * assert against them directly).
 */

const incrby = jest.fn();
const ttl = jest.fn();
const expire = jest.fn();
const quit = jest.fn().mockResolvedValue(undefined);
const on = jest.fn();

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    incrby,
    ttl,
    expire,
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
});

describe('RedisService.trackAiTokenUsage', () => {
  let service: RedisService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RedisService();
  });

  it('allows usage under quota and returns correct remaining balance', async () => {
    incrby.mockResolvedValue(100_000);
    ttl.mockResolvedValue(-1);

    const result = await service.trackAiTokenUsage('user-1', 100_000, 500_000);

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(500_000);
    expect(result.currentUsage).toBe(100_000);
    expect(result.remaining).toBe(400_000);
  });

  it('blocks usage once cumulative tokens reach or exceed the quota', async () => {
    incrby.mockResolvedValue(500_000);
    ttl.mockResolvedValue(-1);

    const result = await service.trackAiTokenUsage('user-2', 500_000, 500_000);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('always blocks a 0 monthly quota (FREE tier)', async () => {
    incrby.mockResolvedValue(1);
    ttl.mockResolvedValue(-1);

    const result = await service.trackAiTokenUsage('user-3', 1, 0);

    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(0);
  });

  it('sets a 35-day TTL on the key on first write', async () => {
    incrby.mockResolvedValue(1_000);
    ttl.mockResolvedValue(-1);

    await service.trackAiTokenUsage('user-4', 1_000, 500_000);

    expect(expire).toHaveBeenCalledWith(
      expect.stringContaining('ratelimit:ai_tokens:user-4:'),
      35 * 24 * 60 * 60
    );
  });

  it('does not re-set the TTL when the key already has one', async () => {
    incrby.mockResolvedValue(2_000);
    ttl.mockResolvedValue(3_000_000); // already has a live TTL

    await service.trackAiTokenUsage('user-5', 1_000, 500_000);

    expect(expire).not.toHaveBeenCalled();
  });

  it('uses the shared monthly key pattern (ratelimit:ai_tokens:{userId}:{yearMonth})', async () => {
    incrby.mockResolvedValue(1);
    ttl.mockResolvedValue(-1);
    const yearMonth = new Date().toISOString().slice(0, 7);

    await service.trackAiTokenUsage('user-6', 1, 500_000);

    expect(incrby).toHaveBeenCalledWith(
      `ratelimit:ai_tokens:user-6:${yearMonth}`,
      1
    );
  });
});
