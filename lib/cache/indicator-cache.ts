/**
 * Indicator Data Cache
 *
 * Redis-based caching for indicator data with timeframe-based TTL.
 * Shorter timeframes have shorter cache durations since they update more frequently.
 */

import { getRedisClient } from '@/lib/redis/client';

/**
 * Cache TTL configuration based on timeframe
 * Shorter timeframes = shorter TTL (data updates more frequently)
 */
const TIMEFRAME_TTL: Record<string, number> = {
  // Very short timeframes - 30 seconds cache
  M1: 30,
  // Short timeframes - 60 seconds cache
  M5: 60,
  M15: 60,
  // Medium timeframes - 5 minutes cache
  M30: 300,
  H1: 300,
  // Long timeframes - 15 minutes cache
  H4: 900,
  // Very long timeframes - 30 minutes cache
  D1: 1800,
  W1: 1800,
  MN1: 1800,
};

/**
 * Default TTL if timeframe not found (5 minutes)
 */
const DEFAULT_TTL = 300;

/**
 * Cache key prefix
 */
const CACHE_PREFIX = 'cache:indicator';

/**
 * Generate cache key for indicator data
 *
 * @param symbol - Trading symbol
 * @param timeframe - Chart timeframe
 * @param bars - Number of bars
 * @param tier - User tier (affects data)
 * @returns Cache key string
 */
export function getCacheKey(
  symbol: string,
  timeframe: string,
  bars: number,
  tier: string
): string {
  return `${CACHE_PREFIX}:${symbol}:${timeframe}:${bars}:${tier}`.toLowerCase();
}

/**
 * Get TTL for a timeframe
 *
 * @param timeframe - Chart timeframe (e.g., 'M1', 'H1', 'D1')
 * @returns TTL in seconds
 */
export function getTimeframeTTL(timeframe: string): number {
  return TIMEFRAME_TTL[timeframe.toUpperCase()] || DEFAULT_TTL;
}

/**
 * Get cached indicator data
 *
 * @param symbol - Trading symbol
 * @param timeframe - Chart timeframe
 * @param bars - Number of bars
 * @param tier - User tier
 * @returns Cached data or null if not found
 */
export async function getCachedIndicator<T>(
  symbol: string,
  timeframe: string,
  bars: number,
  tier: string
): Promise<T | null> {
  try {
    const redis = getRedisClient();
    const key = getCacheKey(symbol, timeframe, bars, tier);
    const cached = await redis.get(key);

    if (!cached) {
      return null;
    }

    return JSON.parse(cached) as T;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
}

/**
 * Cache indicator data
 *
 * @param symbol - Trading symbol
 * @param timeframe - Chart timeframe
 * @param bars - Number of bars
 * @param tier - User tier
 * @param data - Data to cache
 */
export async function setCachedIndicator<T>(
  symbol: string,
  timeframe: string,
  bars: number,
  tier: string,
  data: T
): Promise<void> {
  try {
    const redis = getRedisClient();
    const key = getCacheKey(symbol, timeframe, bars, tier);
    const ttl = getTimeframeTTL(timeframe);

    await redis.setex(key, ttl, JSON.stringify(data));
  } catch (error) {
    console.error('Cache set error:', error);
    // Fail silently - caching is optional optimization
  }
}

/**
 * Invalidate cached indicator data
 *
 * @param symbol - Trading symbol
 * @param timeframe - Chart timeframe (optional - invalidate all timeframes if not provided)
 */
export async function invalidateCachedIndicator(
  symbol: string,
  timeframe?: string
): Promise<void> {
  try {
    const redis = getRedisClient();

    if (timeframe) {
      // Invalidate specific timeframe - need to match all bars/tier variants
      const pattern = `${CACHE_PREFIX}:${symbol}:${timeframe}:*`.toLowerCase();
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } else {
      // Invalidate all timeframes for symbol
      const pattern = `${CACHE_PREFIX}:${symbol}:*`.toLowerCase();
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

// Simple in-memory stats counter (per-process)
let cacheHits = 0;
let cacheMisses = 0;

/**
 * Record cache hit
 */
export function recordCacheHit(): void {
  cacheHits++;
}

/**
 * Record cache miss
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
  };
}
