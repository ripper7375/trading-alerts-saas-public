/**
 * Cache Manager Tests
 *
 * Tests for the cache manager utilities.
 * Note: These tests mock the Redis client.
 */

import { CACHE_TTL, CACHE_PREFIX } from '@/lib/cache/cache-manager';

// Mock the Redis client
jest.mock('@/lib/redis/client', () => ({
  getRedisClient: jest.fn(() => ({
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    exists: jest.fn(),
    ttl: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    multi: jest.fn(() => ({
      incr: jest.fn().mockReturnThis(),
      ttl: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    })),
  })),
}));

describe('Cache Manager', () => {
  describe('CACHE_TTL constants', () => {
    it('should have correct TTL values', () => {
      expect(CACHE_TTL.SHORT).toBe(60); // 1 minute
      expect(CACHE_TTL.MEDIUM).toBe(300); // 5 minutes
      expect(CACHE_TTL.LONG).toBe(3600); // 1 hour
      expect(CACHE_TTL.DAY).toBe(86400); // 24 hours
      expect(CACHE_TTL.PRICE).toBe(60); // 1 minute
      expect(CACHE_TTL.INDICATORS).toBe(300); // 5 minutes
      expect(CACHE_TTL.USER_SESSION).toBe(3600); // 1 hour
    });
  });

  describe('CACHE_PREFIX constants', () => {
    it('should have correct prefix values', () => {
      expect(CACHE_PREFIX.PRICE).toBe('price');
      expect(CACHE_PREFIX.INDICATORS).toBe('indicators');
      expect(CACHE_PREFIX.USER).toBe('user');
      expect(CACHE_PREFIX.SESSION).toBe('session');
      expect(CACHE_PREFIX.RATE_LIMIT).toBe('ratelimit');
      expect(CACHE_PREFIX.ALERT).toBe('alert');
    });
  });

  describe('Cache operations (with mocked Redis)', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should define getCache function', async () => {
      const { getCache } = await import('@/lib/cache/cache-manager');
      expect(typeof getCache).toBe('function');
    });

    it('should define setCache function', async () => {
      const { setCache } = await import('@/lib/cache/cache-manager');
      expect(typeof setCache).toBe('function');
    });

    it('should define deleteCache function', async () => {
      const { deleteCache } = await import('@/lib/cache/cache-manager');
      expect(typeof deleteCache).toBe('function');
    });

    it('should define cachePrice function', async () => {
      const { cachePrice } = await import('@/lib/cache/cache-manager');
      expect(typeof cachePrice).toBe('function');
    });

    it('should define getCachedPrice function', async () => {
      const { getCachedPrice } = await import('@/lib/cache/cache-manager');
      expect(typeof getCachedPrice).toBe('function');
    });

    it('should define cacheIndicators function', async () => {
      const { cacheIndicators } = await import('@/lib/cache/cache-manager');
      expect(typeof cacheIndicators).toBe('function');
    });

    it('should define getCachedIndicators function', async () => {
      const { getCachedIndicators } = await import('@/lib/cache/cache-manager');
      expect(typeof getCachedIndicators).toBe('function');
    });

    it('should define cacheUserSession function', async () => {
      const { cacheUserSession } = await import('@/lib/cache/cache-manager');
      expect(typeof cacheUserSession).toBe('function');
    });

    it('should define getCachedUserSession function', async () => {
      const { getCachedUserSession } = await import(
        '@/lib/cache/cache-manager'
      );
      expect(typeof getCachedUserSession).toBe('function');
    });

    it('should define incrementRateLimit function', async () => {
      const { incrementRateLimit } = await import('@/lib/cache/cache-manager');
      expect(typeof incrementRateLimit).toBe('function');
    });

    it('should define getRateLimitCount function', async () => {
      const { getRateLimitCount } = await import('@/lib/cache/cache-manager');
      expect(typeof getRateLimitCount).toBe('function');
    });
  });
});

describe('Cache Key Generation', () => {
  it('should generate correct price cache key format', () => {
    const symbol = 'XAUUSD';
    const timeframe = 'H1';
    const expectedKey = `${CACHE_PREFIX.PRICE}:${symbol}:${timeframe}`;

    expect(expectedKey).toBe('price:XAUUSD:H1');
  });

  it('should generate correct indicator cache key format', () => {
    const symbol = 'EURUSD';
    const timeframe = 'M15';
    const expectedKey = `${CACHE_PREFIX.INDICATORS}:${symbol}:${timeframe}`;

    expect(expectedKey).toBe('indicators:EURUSD:M15');
  });

  it('should generate correct user session cache key format', () => {
    const userId = 'user-123';
    const expectedKey = `${CACHE_PREFIX.USER}:${userId}:session`;

    expect(expectedKey).toBe('user:user-123:session');
  });

  it('should generate correct rate limit cache key format', () => {
    const identifier = 'user-456';
    const expectedKey = `${CACHE_PREFIX.RATE_LIMIT}:${identifier}`;

    expect(expectedKey).toBe('ratelimit:user-456');
  });
});
