/**
 * Part 20 - Phase 05: Cache Invalidation Utilities
 *
 * Utilities for invalidating Redis cache after sync operations.
 * Called by the sync script to ensure cache consistency.
 *
 * @see docs/sqlite-and-mt5service/part-20-architecture-design.md Section 7.3
 */

import * as redis from './redis';
import {
  invalidateIndicatorCache,
  clearAllCache,
  getCacheStats as getIndicatorCacheStats,
  getCachePattern,
} from './indicator-cache';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Extended cache statistics including Redis info
 */
export interface ExtendedCacheStats {
  // Indicator cache stats
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  hitRate: number;

  // Redis info
  keyCount: number;
  memoryUsage: string | null;
  memoryPeak: string | null;
  redisAvailable: boolean;
}

/**
 * Result of invalidation operation
 */
export interface InvalidationResult {
  success: boolean;
  symbolsInvalidated: string[];
  keysCleared: number;
  timestamp: string;
}

// ============================================================================
// SYNC INVALIDATION
// ============================================================================

/**
 * Invalidate cache after sync script runs
 *
 * Called by the sync script after transferring data from SQLite to PostgreSQL.
 * Invalidates cache for all synced symbols to ensure fresh data on next request.
 *
 * @param symbols - Array of symbols that were synced
 * @returns Invalidation result with count of keys cleared
 *
 * @example
 * // Called from sync script after syncing EURUSD and XAUUSD
 * const result = await invalidateOnSync(['EURUSD', 'XAUUSD']);
 * console.log(`Cleared ${result.keysCleared} cache entries`);
 */
export async function invalidateOnSync(
  symbols: string[]
): Promise<InvalidationResult> {
  const timestamp = new Date().toISOString();
  const invalidatedSymbols: string[] = [];
  let totalKeysCleared = 0;

  console.log(`[CacheInvalidation] Starting sync invalidation for ${symbols.length} symbols`);

  for (const symbol of symbols) {
    try {
      const keysCleared = await invalidateIndicatorCache(symbol);
      totalKeysCleared += keysCleared;
      invalidatedSymbols.push(symbol);
      console.log(`[CacheInvalidation] Invalidated ${keysCleared} keys for ${symbol}`);
    } catch (error) {
      console.error(`[CacheInvalidation] Failed to invalidate ${symbol}:`, error);
    }
  }

  console.log(
    `[CacheInvalidation] Sync invalidation complete: ${totalKeysCleared} keys cleared for ${invalidatedSymbols.length} symbols`
  );

  return {
    success: invalidatedSymbols.length === symbols.length,
    symbolsInvalidated: invalidatedSymbols,
    keysCleared: totalKeysCleared,
    timestamp,
  };
}

/**
 * Invalidate all indicator cache
 *
 * Clears the entire indicator cache.
 * Use with caution - this affects all symbols and timeframes.
 *
 * @returns Invalidation result
 */
export async function invalidateAll(): Promise<InvalidationResult> {
  const timestamp = new Date().toISOString();

  console.log('[CacheInvalidation] Clearing all indicator cache');

  try {
    const keysCleared = await clearAllCache();

    console.log(`[CacheInvalidation] Cleared ${keysCleared} keys`);

    return {
      success: true,
      symbolsInvalidated: ['*'], // Indicates all symbols
      keysCleared,
      timestamp,
    };
  } catch (error) {
    console.error('[CacheInvalidation] Failed to clear all cache:', error);

    return {
      success: false,
      symbolsInvalidated: [],
      keysCleared: 0,
      timestamp,
    };
  }
}

/**
 * Invalidate cache by pattern
 *
 * @param pattern - Redis key pattern (e.g., 'indicators:EURUSD:*')
 * @returns Number of keys cleared
 */
export async function invalidateByPattern(pattern: string): Promise<number> {
  console.log(`[CacheInvalidation] Invalidating pattern: ${pattern}`);

  try {
    const keysCleared = await redis.invalidatePattern(pattern);
    console.log(`[CacheInvalidation] Cleared ${keysCleared} keys for pattern: ${pattern}`);
    return keysCleared;
  } catch (error) {
    console.error(`[CacheInvalidation] Failed to invalidate pattern ${pattern}:`, error);
    return 0;
  }
}

// ============================================================================
// CACHE STATISTICS
// ============================================================================

/**
 * Get comprehensive cache statistics
 *
 * Includes hit rate, memory usage, and key count.
 *
 * @returns Extended cache statistics
 */
export async function getCacheStats(): Promise<ExtendedCacheStats> {
  // Get indicator cache stats
  const indicatorStats = getIndicatorCacheStats();

  // Get Redis info
  const redisAvailable = await redis.isRedisAvailable();
  let keyCount = 0;
  let memoryUsage: string | null = null;
  let memoryPeak: string | null = null;

  if (redisAvailable) {
    try {
      // Get key count for indicator cache only
      const pattern = getCachePattern();
      const indicatorKeys = await redis.keys(pattern);
      keyCount = indicatorKeys.length;

      // Get memory info
      const memoryInfo = await redis.getMemoryInfo();
      if (memoryInfo) {
        memoryUsage = memoryInfo.usedMemory;
        memoryPeak = memoryInfo.usedMemoryPeak;
      }
    } catch (error) {
      console.error('[CacheInvalidation] Failed to get Redis info:', error);
    }
  }

  return {
    ...indicatorStats,
    keyCount,
    memoryUsage,
    memoryPeak,
    redisAvailable,
  };
}

/**
 * Get cache health status
 *
 * Quick check of cache availability and basic stats.
 */
export async function getCacheHealth(): Promise<{
  healthy: boolean;
  redisConnected: boolean;
  keyCount: number;
  hitRate: number;
}> {
  const redisConnected = await redis.isRedisAvailable();
  const stats = getIndicatorCacheStats();

  let keyCount = 0;
  if (redisConnected) {
    const pattern = getCachePattern();
    const keys = await redis.keys(pattern);
    keyCount = keys.length;
  }

  return {
    healthy: redisConnected,
    redisConnected,
    keyCount,
    hitRate: stats.hitRate,
  };
}
