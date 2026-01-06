/**
 * Part 20 - Phase 07: Cache Integration Tests
 *
 * Integration tests for Redis caching layer.
 * Completely mocks Redis and PostgreSQL to avoid external dependencies.
 *
 * @see docs/sqlite-and-mt5service/part-20-implementation-plan.md Phase 7
 */

// Create mock stores for simulating Redis and database
const mockRedisStore = new Map<string, string>();

// Create mock functions before jest.mock calls
const mockRedisGet = jest.fn(async (key: string) => {
  const value = mockRedisStore.get(key);
  return value ? JSON.parse(value) : null;
});

const mockRedisSet = jest.fn(async (key: string, value: unknown) => {
  mockRedisStore.set(key, JSON.stringify(value));
  return 'OK';
});

const mockRedisDel = jest.fn(async (key: string) => {
  const existed = mockRedisStore.has(key);
  mockRedisStore.delete(key);
  return existed ? 1 : 0;
});

const mockRedisKeys = jest.fn(async (pattern: string) => {
  const regex = new RegExp(pattern.replace(/\*/g, '.*'));
  return Array.from(mockRedisStore.keys()).filter((k) => regex.test(k));
});

const mockRedisInvalidatePattern = jest.fn(async (pattern: string) => {
  const regex = new RegExp(pattern.replace(/\*/g, '.*'));
  let count = 0;
  for (const key of mockRedisStore.keys()) {
    if (regex.test(key)) {
      mockRedisStore.delete(key);
      count++;
    }
  }
  return count;
});

// Mock the Redis cache module
jest.mock('@/lib/cache/redis', () => ({
  __esModule: true,
  get: (...args: unknown[]) => mockRedisGet(...args),
  set: (...args: unknown[]) => mockRedisSet(...args),
  del: (...args: unknown[]) => mockRedisDel(...args),
  keys: (...args: unknown[]) => mockRedisKeys(...args),
  invalidatePattern: (...args: unknown[]) => mockRedisInvalidatePattern(...args),
}));

// Mock the database queries module
const mockGetIndicatorDataFromDb = jest.fn(async () => ({
  ohlc: [{ time: Date.now() / 1000, open: 1.0, high: 1.01, low: 0.99, close: 1.0 }],
  fractals: { peaks: [], bottoms: [] },
  horizontal_trendlines: { support: [], resistance: [] },
  diagonal_trendlines: { support: [], resistance: [] },
  momentum_candles: [],
  keltner_channels: { upper: [], middle: [], lower: [], timestamps: [] },
  tema: [1.0],
  hrma: [1.0],
  smma: [1.0],
  zigzag: { points: [] },
}));

jest.mock('@/lib/db/queries', () => ({
  __esModule: true,
  getIndicatorDataFromDb: (...args: unknown[]) => mockGetIndicatorDataFromDb(...args),
}));

// Mock the redis client module to prevent actual connections
jest.mock('@/lib/redis/client', () => ({
  __esModule: true,
  getRedisClient: jest.fn(() => ({
    get: jest.fn(async () => null),
    setex: jest.fn(async () => 'OK'),
    del: jest.fn(async () => 1),
    keys: jest.fn(async () => []),
    info: jest.fn(async () => 'used_memory_human:1M'),
    dbsize: jest.fn(async () => 0),
    quit: jest.fn(),
  })),
  isRedisConnected: jest.fn(async () => true),
}));

// Import after mocking
import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  getIndicatorDataCached,
  invalidateIndicatorCache,
  getCacheKey,
  getCacheStats,
  resetCacheStats,
  getCacheSize,
  clearAllCache,
} from '@/lib/cache/indicator-cache';

describe('Cache Integration', () => {
  beforeEach(() => {
    mockRedisStore.clear();
    resetCacheStats();
    jest.clearAllMocks();
  });

  describe('Cache key generation', () => {
    it('should generate correct cache key format', () => {
      const key = getCacheKey('EURUSD', 'H1', 1000);
      expect(key).toBe('indicators:EURUSD:H1:1000');
    });

    it('should normalize symbol and timeframe to uppercase', () => {
      const key = getCacheKey('eurusd', 'h1', 500);
      expect(key).toBe('indicators:EURUSD:H1:500');
    });

    it('should use default for missing bars parameter', () => {
      const key = getCacheKey('EURUSD', 'H1');
      expect(key).toBe('indicators:EURUSD:H1:default');
    });
  });

  describe('Cache-through pattern', () => {
    it('should return cached data on cache hit', async () => {
      const cacheKey = getCacheKey('EURUSD', 'H1', 100);
      const cachedData = {
        ohlc: [{ time: 123456, open: 1.08, high: 1.09, low: 1.07, close: 1.085 }],
        fractals: { peaks: [], bottoms: [] },
        horizontal_trendlines: { support: [], resistance: [] },
        diagonal_trendlines: { support: [], resistance: [] },
        momentum_candles: [],
        keltner_channels: { upper: [], middle: [], lower: [], timestamps: [] },
        tema: [1.08],
        hrma: [1.079],
        smma: [1.081],
        zigzag: { points: [] },
      };

      // Pre-populate cache
      mockRedisStore.set(cacheKey, JSON.stringify(cachedData));

      const result = await getIndicatorDataCached('EURUSD', 'H1', 100);

      expect(result.cached).toBe(true);
      expect(result.dataSource).toBe('cache');
      expect(result.data.ohlc[0].close).toBe(1.085);
    });

    it('should fetch from database on cache miss and cache result', async () => {
      const result = await getIndicatorDataCached('EURUSD', 'H1', 100);

      // Should be a cache miss
      expect(result.cached).toBe(false);
      expect(result.dataSource).toBe('postgresql');

      // Data should now be in cache
      const cacheKey = getCacheKey('EURUSD', 'H1', 100);
      expect(mockRedisStore.has(cacheKey)).toBe(true);
    });

    it('should serve cached data on subsequent requests', async () => {
      // First request - cache miss
      const firstResult = await getIndicatorDataCached('EURUSD', 'H1', 100);
      expect(firstResult.cached).toBe(false);

      // Second request - should be cache hit
      const secondResult = await getIndicatorDataCached('EURUSD', 'H1', 100);
      expect(secondResult.cached).toBe(true);
      expect(secondResult.dataSource).toBe('cache');
    });
  });

  describe('Cache invalidation', () => {
    it('should invalidate specific symbol/timeframe cache', async () => {
      // Populate cache
      await getIndicatorDataCached('EURUSD', 'H1', 100);
      await getIndicatorDataCached('EURUSD', 'H4', 100);

      const cacheKey = getCacheKey('EURUSD', 'H1', 100);
      expect(mockRedisStore.has(cacheKey)).toBe(true);

      // Invalidate H1 only
      await invalidateIndicatorCache('EURUSD', 'H1');

      // H1 should be cleared - check pattern matches
      const h1Keys = Array.from(mockRedisStore.keys()).filter(k => k.includes(':H1:'));
      expect(h1Keys.length).toBe(0);
    });

    it('should invalidate all timeframes for a symbol', async () => {
      // Populate cache for multiple timeframes
      await getIndicatorDataCached('EURUSD', 'H1', 100);
      await getIndicatorDataCached('EURUSD', 'H4', 100);
      await getIndicatorDataCached('EURUSD', 'D1', 100);

      // Invalidate all EURUSD
      await invalidateIndicatorCache('EURUSD');

      // All EURUSD should be cleared
      const keys = Array.from(mockRedisStore.keys());
      const eurusdKeys = keys.filter((k) => k.includes('EURUSD'));
      expect(eurusdKeys.length).toBe(0);
    });
  });

  describe('Cache statistics', () => {
    it('should track cache hits', async () => {
      const cacheKey = getCacheKey('EURUSD', 'H1', 100);
      mockRedisStore.set(cacheKey, JSON.stringify({ ohlc: [] }));

      await getIndicatorDataCached('EURUSD', 'H1', 100);

      const stats = getCacheStats();
      expect(stats.hits).toBe(1);
    });

    it('should track cache misses', async () => {
      await getIndicatorDataCached('EURUSD', 'H1', 100);

      const stats = getCacheStats();
      expect(stats.misses).toBe(1);
    });

    it('should calculate hit rate correctly', async () => {
      // Create 1 miss first
      await getIndicatorDataCached('EURUSD', 'H1', 100);
      // Create 1 hit (data is now cached)
      await getIndicatorDataCached('EURUSD', 'H1', 100);

      const stats = getCacheStats();
      expect(stats.hitRate).toBe(0.5);
    });

    it('should reset statistics', async () => {
      await getIndicatorDataCached('EURUSD', 'H1', 100);

      resetCacheStats();

      const stats = getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('Cache size tracking', () => {
    it('should track cache size', async () => {
      const initialSize = getCacheSize();

      await getIndicatorDataCached('EURUSD', 'H1', 100);
      await getIndicatorDataCached('EURUSD', 'H4', 100);

      const newSize = getCacheSize();
      expect(newSize).toBe(initialSize + 2);
    });
  });

  describe('Clear all cache', () => {
    it('should clear all indicator cache entries', async () => {
      // Populate cache
      await getIndicatorDataCached('EURUSD', 'H1', 100);
      await getIndicatorDataCached('XAUUSD', 'H4', 100);

      // Clear all
      await clearAllCache();

      // Verify cleared
      const keys = Array.from(mockRedisStore.keys());
      const indicatorKeys = keys.filter((k) => k.startsWith('indicators:'));
      expect(indicatorKeys.length).toBe(0);
    });
  });

  describe('Redis fallback behavior', () => {
    it('should fall back to database when Redis throws error', async () => {
      // Make the get function throw an error once
      mockRedisGet.mockRejectedValueOnce(new Error('Redis connection failed'));

      const result = await getIndicatorDataCached('EURUSD', 'H1', 100);

      // Should still return data from database
      expect(result.data).toBeDefined();
      expect(result.dataSource).toBe('postgresql');
    });
  });
});
