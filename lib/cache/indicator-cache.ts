/**
 * Indicator Data Caching Layer
 *
 * Uses Redis for production, in-memory Map for development/fallback.
 * TTL values from business-rules.ts ensure cache freshness based on timeframe.
 *
 * Dependencies:
 * - Part 0: CACHE_TTL, DEFAULT_CACHE_TTL, isValidTimeframe
 */

import {
  CACHE_TTL,
  DEFAULT_CACHE_TTL,
  isValidTimeframe,
  type Timeframe,
} from '@/lib/constants/business-rules';

// ============================================================================
// CACHE CLIENT INTERFACE
// ============================================================================

/**
 * Cache client interface
 * Supports both Redis and in-memory implementations
 */
interface CacheClient {
  get(key: string): Promise<string | null>;
  setex(key: string, ttl: number, value: string): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

// ============================================================================
// IN-MEMORY CACHE IMPLEMENTATION
// ============================================================================

/**
 * In-memory cache implementation for development/fallback
 * Falls back to this if Redis is unavailable
 */
class MemoryCache implements CacheClient {
  private cache = new Map<string, { value: string; expiresAt: number }>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  async get(key: string): Promise<string | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  async setex(key: string, ttl: number, value: string): Promise<void> {
    const expiresAt = Date.now() + ttl * 1000;
    this.cache.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  // Cleanup expired entries periodically
  startCleanup(intervalMs = 60000): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expiresAt) {
          this.cache.delete(key);
        }
      }
    }, intervalMs);
  }

  // Get current cache size (for monitoring)
  getSize(): number {
    return this.cache.size;
  }
}

// ============================================================================
// REDIS CACHE WRAPPER
// ============================================================================

/**
 * Redis cache wrapper implementing CacheClient interface
 */
class RedisCache implements CacheClient {
  // Using 'unknown' with runtime checks for compatibility
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private redis: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(redisClient: any) {
    this.redis = redisClient;
  }

  async get(key: string): Promise<string | null> {
    return await this.redis.get(key);
  }

  async setex(key: string, ttl: number, value: string): Promise<void> {
    await this.redis.setex(key, ttl, value);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result === 1;
  }
}

// ============================================================================
// CACHE CLIENT SINGLETON
// ============================================================================

let cacheClient: CacheClient | null = null;
let isUsingMemoryCache = false;

/**
 * Get cache client
 * Uses Redis in production, memory cache in development or as fallback
 */
function getCacheClient(): CacheClient {
  if (cacheClient) {
    return cacheClient;
  }

  // Try to use Redis if available
  try {
    // Dynamic import to avoid issues if Redis is not configured
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getRedisClient } = require('@/lib/redis/client');
    const redis = getRedisClient();

    cacheClient = new RedisCache(redis);
    isUsingMemoryCache = false;

    if (process.env['NODE_ENV'] !== 'production') {
      console.log('[Indicator Cache] Using Redis cache');
    }

    return cacheClient;
  } catch (error) {
    // Redis not available, use memory cache
    if (process.env['NODE_ENV'] !== 'production') {
      console.warn(
        '[Indicator Cache] Redis unavailable, using in-memory cache:',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }

    const memCache = new MemoryCache();
    memCache.startCleanup();
    cacheClient = memCache;
    isUsingMemoryCache = true;

    return cacheClient;
  }
}

// ============================================================================
// CACHE KEY GENERATION
// ============================================================================

/**
 * Cache key prefix for indicator data
 */
const CACHE_PREFIX = 'indicator';

/**
 * Generate cache key for indicator data
 * Format: indicator:{symbol}:{timeframe}:{bars?}
 */
function getCacheKey(symbol: string, timeframe: string, bars?: number): string {
  const baseKey = `${CACHE_PREFIX}:${symbol.toUpperCase()}:${timeframe.toUpperCase()}`;
  return bars ? `${baseKey}:${bars}` : baseKey;
}

/**
 * Generate cache key pattern for symbol invalidation
 * Format: indicator:{symbol}:*
 */
function getSymbolPattern(symbol: string): string {
  return `${CACHE_PREFIX}:${symbol.toUpperCase()}:*`;
}

// ============================================================================
// TTL HELPER
// ============================================================================

/**
 * Get TTL for a timeframe
 * Uses constants from Part 0 (business-rules.ts)
 */
function getTTL(timeframe: string): number {
  const upperTimeframe = timeframe.toUpperCase();

  if (isValidTimeframe(upperTimeframe)) {
    return CACHE_TTL[upperTimeframe as Timeframe];
  }

  console.warn(
    `[Indicator Cache] Unknown timeframe: ${timeframe}, using default TTL`
  );
  return DEFAULT_CACHE_TTL;
}

// ============================================================================
// CACHE OPERATIONS
// ============================================================================

/**
 * Get cached indicator data
 *
 * @param symbol - Trading symbol (e.g., XAUUSD)
 * @param timeframe - Chart timeframe (e.g., H1)
 * @param bars - Number of bars (optional)
 * @returns Parsed data if cache hit, null if cache miss
 */
export async function getCachedIndicatorData<T = unknown>(
  symbol: string,
  timeframe: string,
  bars?: number
): Promise<T | null> {
  const key = getCacheKey(symbol, timeframe, bars);

  try {
    const client = getCacheClient();
    const cached = await client.get(key);

    if (cached) {
      if (process.env['NODE_ENV'] !== 'production') {
        console.log(
          `[Indicator Cache] HIT: ${symbol}/${timeframe}${bars ? `/${bars}` : ''}`
        );
      }
      return JSON.parse(cached) as T;
    }

    if (process.env['NODE_ENV'] !== 'production') {
      console.log(
        `[Indicator Cache] MISS: ${symbol}/${timeframe}${bars ? `/${bars}` : ''}`
      );
    }
    return null;
  } catch (error) {
    console.error('[Indicator Cache] Error reading from cache:', error);
    return null;
  }
}

/**
 * Set cached indicator data
 * Automatically applies correct TTL based on timeframe from Part 0
 *
 * @param symbol - Trading symbol
 * @param timeframe - Chart timeframe
 * @param data - Indicator data to cache
 * @param bars - Number of bars (optional)
 */
export async function setCachedIndicatorData(
  symbol: string,
  timeframe: string,
  data: unknown,
  bars?: number
): Promise<void> {
  const key = getCacheKey(symbol, timeframe, bars);
  const ttl = getTTL(timeframe);

  try {
    const client = getCacheClient();
    await client.setex(key, ttl, JSON.stringify(data));

    if (process.env['NODE_ENV'] !== 'production') {
      console.log(
        `[Indicator Cache] SET: ${symbol}/${timeframe}${bars ? `/${bars}` : ''} ` +
          `(TTL: ${ttl}s = ${Math.round(ttl / 60)}min)`
      );
    }
  } catch (error) {
    console.error('[Indicator Cache] Error writing to cache:', error);
    // Don't throw - caching failure shouldn't break the request
  }
}

/**
 * Check if cached data exists for a key
 *
 * @param symbol - Trading symbol
 * @param timeframe - Chart timeframe
 * @param bars - Number of bars (optional)
 * @returns true if cached data exists, false otherwise
 */
export async function hasCachedData(
  symbol: string,
  timeframe: string,
  bars?: number
): Promise<boolean> {
  const key = getCacheKey(symbol, timeframe, bars);

  try {
    const client = getCacheClient();
    return await client.exists(key);
  } catch (error) {
    console.error('[Indicator Cache] Error checking cache:', error);
    return false;
  }
}

/**
 * Invalidate cache for a specific symbol/timeframe/bars combination
 *
 * @param symbol - Trading symbol
 * @param timeframe - Chart timeframe
 * @param bars - Number of bars (optional)
 */
export async function invalidateCachedData(
  symbol: string,
  timeframe: string,
  bars?: number
): Promise<void> {
  const key = getCacheKey(symbol, timeframe, bars);

  try {
    const client = getCacheClient();
    await client.del(key);

    if (process.env['NODE_ENV'] !== 'production') {
      console.log(
        `[Indicator Cache] INVALIDATED: ${symbol}/${timeframe}${bars ? `/${bars}` : ''}`
      );
    }
  } catch (error) {
    console.error('[Indicator Cache] Error invalidating cache:', error);
  }
}

/**
 * Invalidate all cached data for a symbol
 * Useful when symbol data needs to be refreshed across all timeframes
 *
 * @param symbol - Trading symbol
 */
export async function invalidateSymbolCache(symbol: string): Promise<void> {
  const pattern = getSymbolPattern(symbol);

  try {
    if (process.env['NODE_ENV'] !== 'production') {
      console.log(
        `[Indicator Cache] INVALIDATE SYMBOL: ${symbol} (pattern: ${pattern})`
      );
    }

    // For both memory and Redis cache: invalidate common timeframe combinations
    // In production with Redis, you could use SCAN to find all matching keys
    const timeframes = [
      'M5',
      'M15',
      'M30',
      'H1',
      'H2',
      'H4',
      'H8',
      'H12',
      'D1',
    ];

    const commonBars = [100, 500, 1000, 2000, 5000];

    // Create all combinations and invalidate
    const invalidationPromises: Promise<void>[] = [];

    for (const tf of timeframes) {
      // Invalidate without bars param
      invalidationPromises.push(invalidateCachedData(symbol, tf));

      // Invalidate with common bar values
      for (const bars of commonBars) {
        invalidationPromises.push(invalidateCachedData(symbol, tf, bars));
      }
    }

    await Promise.all(invalidationPromises);

    if (process.env['NODE_ENV'] !== 'production') {
      console.log(
        `[Indicator Cache] INVALIDATED all timeframes for ${symbol}`
      );
    }
  } catch (error) {
    console.error('[Indicator Cache] Error invalidating symbol cache:', error);
  }
}

// ============================================================================
// CACHE STATISTICS
// ============================================================================

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  isMemoryCache: boolean;
}

// Track cache statistics
let cacheHits = 0;
let cacheMisses = 0;

/**
 * Record a cache hit
 */
export function recordCacheHit(): void {
  cacheHits++;
}

/**
 * Record a cache miss
 */
export function recordCacheMiss(): void {
  cacheMisses++;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): CacheStats {
  const total = cacheHits + cacheMisses;
  return {
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: total > 0 ? cacheHits / total : 0,
    isMemoryCache: isUsingMemoryCache,
  };
}

/**
 * Reset cache statistics
 */
export function resetCacheStats(): void {
  cacheHits = 0;
  cacheMisses = 0;
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Get the TTL for a given timeframe
 * Exported for use in response metadata
 */
export function getTimeframeTTL(timeframe: string): number {
  return getTTL(timeframe);
}

/**
 * Check if the cache is using memory (fallback) mode
 */
export function isUsingMemoryCacheMode(): boolean {
  getCacheClient(); // Ensure client is initialized
  return isUsingMemoryCache;
}
