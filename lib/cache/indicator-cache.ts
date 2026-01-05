/**
 * Part 20 - Phase 05: Indicator Data Caching
 *
 * Redis-based caching layer for indicator data.
 * Provides cache-through pattern: check cache first, fallback to PostgreSQL.
 *
 * Cache key format: indicators:{SYMBOL}:{TIMEFRAME}:latest
 * TTL: 30 seconds (matches sync interval)
 *
 * @see docs/sqlite-and-mt5service/part-20-architecture-design.md Section 7.3
 */

import * as redis from './redis';
import { getIndicatorDataFromDb } from '@/lib/db/queries';
import type { IndicatorData } from '@/lib/indicators/types';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Cache TTL in seconds (30 seconds to match sync interval)
 */
export const INDICATOR_CACHE_TTL = 30;

/**
 * Cache key prefix
 */
const CACHE_PREFIX = 'indicators';

// ============================================================================
// CACHE KEY GENERATION
// ============================================================================

/**
 * Generate cache key for indicator data
 *
 * Format: indicators:{SYMBOL}:{TIMEFRAME}:latest
 *
 * @param symbol - Trading symbol (e.g., "EURUSD")
 * @param timeframe - Timeframe (e.g., "H1")
 * @returns Cache key string
 */
export function getCacheKey(symbol: string, timeframe: string): string {
  const normalizedSymbol = symbol.toUpperCase();
  const normalizedTimeframe = timeframe.toUpperCase();
  return `${CACHE_PREFIX}:${normalizedSymbol}:${normalizedTimeframe}:latest`;
}

/**
 * Generate cache key pattern for symbol invalidation
 *
 * Format: indicators:{SYMBOL}:*
 *
 * @param symbol - Trading symbol (optional, if not provided matches all)
 * @returns Cache key pattern
 */
export function getCachePattern(symbol?: string): string {
  if (symbol) {
    const normalizedSymbol = symbol.toUpperCase();
    return `${CACHE_PREFIX}:${normalizedSymbol}:*`;
  }
  return `${CACHE_PREFIX}:*`;
}

// ============================================================================
// CACHE STATISTICS
// ============================================================================

/**
 * Cache statistics counters
 */
let statsCounters = {
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0,
  errors: 0,
};

/**
 * Cache statistics interface
 */
export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  hitRate: number;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): CacheStats {
  const total = statsCounters.hits + statsCounters.misses;
  const hitRate = total > 0 ? statsCounters.hits / total : 0;

  return {
    ...statsCounters,
    hitRate,
  };
}

/**
 * Reset cache statistics
 */
export function resetCacheStats(): void {
  statsCounters = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
  };
}

// ============================================================================
// MAIN CACHING FUNCTIONS
// ============================================================================

/**
 * Result from cached indicator data fetch
 */
export interface CachedIndicatorResult {
  data: IndicatorData;
  dataSource: 'cache' | 'postgresql';
  cached: boolean;
}

/**
 * Get indicator data with caching (cache-through pattern)
 *
 * 1. Check Redis cache first
 * 2. If cache hit, return cached data
 * 3. If cache miss, fetch from PostgreSQL
 * 4. Cache the result with TTL
 * 5. Return data with source metadata
 *
 * @param symbol - Trading symbol (e.g., "EURUSD")
 * @param timeframe - Timeframe (e.g., "H1")
 * @param limit - Number of bars to fetch (default: 1000)
 * @returns Indicator data with source metadata
 */
export async function getIndicatorDataCached(
  symbol: string,
  timeframe: string,
  limit: number = 1000
): Promise<CachedIndicatorResult> {
  const cacheKey = getCacheKey(symbol, timeframe);
  const normalizedSymbol = symbol.toUpperCase();
  const normalizedTimeframe = timeframe.toUpperCase();

  try {
    // Step 1: Check Redis cache
    const cachedData = await redis.get<IndicatorData>(cacheKey);

    if (cachedData) {
      statsCounters.hits++;
      console.log(
        `[IndicatorCache] HIT: ${normalizedSymbol}/${normalizedTimeframe}`
      );

      return {
        data: cachedData,
        dataSource: 'cache',
        cached: true,
      };
    }

    // Step 2: Cache miss - fetch from PostgreSQL
    statsCounters.misses++;
    console.log(
      `[IndicatorCache] MISS: ${normalizedSymbol}/${normalizedTimeframe}`
    );

    const data = await getIndicatorDataFromDb(
      normalizedSymbol,
      normalizedTimeframe,
      limit
    );

    // Step 3: Cache the result
    await redis.set(cacheKey, data, INDICATOR_CACHE_TTL);
    statsCounters.sets++;
    console.log(
      `[IndicatorCache] SET: ${normalizedSymbol}/${normalizedTimeframe} (TTL: ${INDICATOR_CACHE_TTL}s)`
    );

    return {
      data,
      dataSource: 'postgresql',
      cached: false,
    };
  } catch (error) {
    statsCounters.errors++;
    console.error('[IndicatorCache] Error:', error);

    // Fallback: fetch directly from PostgreSQL without caching
    console.log(
      `[IndicatorCache] Fallback to PostgreSQL: ${normalizedSymbol}/${normalizedTimeframe}`
    );

    const data = await getIndicatorDataFromDb(
      normalizedSymbol,
      normalizedTimeframe,
      limit
    );

    return {
      data,
      dataSource: 'postgresql',
      cached: false,
    };
  }
}

/**
 * Invalidate cached indicator data
 *
 * @param symbol - Trading symbol
 * @param timeframe - Timeframe (optional, if not provided invalidates all timeframes for symbol)
 * @returns Number of keys invalidated
 */
export async function invalidateIndicatorCache(
  symbol: string,
  timeframe?: string
): Promise<number> {
  try {
    if (timeframe) {
      // Invalidate specific symbol/timeframe
      const cacheKey = getCacheKey(symbol, timeframe);
      await redis.del(cacheKey);
      statsCounters.deletes++;
      console.log(`[IndicatorCache] INVALIDATED: ${symbol}/${timeframe}`);
      return 1;
    }

    // Invalidate all timeframes for symbol
    const pattern = getCachePattern(symbol);
    const count = await redis.invalidatePattern(pattern);
    statsCounters.deletes += count;
    console.log(
      `[IndicatorCache] INVALIDATED: ${count} keys for ${symbol} (pattern: ${pattern})`
    );
    return count;
  } catch (error) {
    console.error('[IndicatorCache] Invalidation error:', error);
    return 0;
  }
}

// ============================================================================
// BACKWARD COMPATIBILITY
// ============================================================================

/**
 * Get cached indicator data (backward compatible wrapper)
 *
 * @deprecated Use getIndicatorDataCached instead
 */
export async function getCachedIndicatorData(
  symbol: string,
  timeframe: string,
  _bars?: number
): Promise<unknown> {
  const cacheKey = getCacheKey(symbol, timeframe);
  return redis.get(cacheKey);
}

/**
 * Set cached indicator data (backward compatible wrapper)
 *
 * @deprecated Use getIndicatorDataCached which handles caching automatically
 */
export async function setCachedIndicatorData(
  symbol: string,
  timeframe: string,
  data: unknown,
  _bars?: number
): Promise<void> {
  const cacheKey = getCacheKey(symbol, timeframe);
  await redis.set(cacheKey, data, INDICATOR_CACHE_TTL);
  statsCounters.sets++;
}

/**
 * Check if cached data exists
 */
export async function hasCachedData(
  symbol: string,
  timeframe: string
): Promise<boolean> {
  const cacheKey = getCacheKey(symbol, timeframe);
  const data = await redis.get(cacheKey);
  return data !== null;
}

/**
 * Invalidate cached data (backward compatible wrapper)
 *
 * @deprecated Use invalidateIndicatorCache instead
 */
export async function invalidateCachedData(
  symbol: string,
  timeframe: string
): Promise<void> {
  await invalidateIndicatorCache(symbol, timeframe);
}

/**
 * Invalidate all cached data for a symbol
 *
 * @deprecated Use invalidateIndicatorCache(symbol) instead
 */
export async function invalidateSymbolCache(symbol: string): Promise<void> {
  await invalidateIndicatorCache(symbol);
}

/**
 * Clear all cached indicator data
 */
export async function clearAllCache(): Promise<number> {
  const pattern = getCachePattern();
  const count = await redis.invalidatePattern(pattern);
  console.log(`[IndicatorCache] CLEARED: ${count} keys`);
  return count;
}

/**
 * Get cache size (number of indicator cache entries)
 */
export async function getCacheSize(): Promise<number> {
  const pattern = getCachePattern();
  const matchingKeys = await redis.keys(pattern);
  return matchingKeys.length;
}
