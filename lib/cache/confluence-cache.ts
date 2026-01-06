/**
 * Part 20 - Phase 06: Confluence Caching
 *
 * Redis caching for confluence scores.
 *
 * Cache Strategy:
 * - Historical timestamps: Cache indefinitely (data doesn't change)
 * - Current timestamp: Cache 30 seconds (matches sync interval)
 *
 * @see docs/sqlite-and-mt5service/part-20-architecture-design.md Section 9
 * @see docs/sqlite-and-mt5service/part-20-implementation-plan.md Phase 6
 */

import { get, set, del } from '@/lib/cache/redis';
import type { ConfluenceResult } from '@/lib/confluence/types';

/**
 * Cache TTL for confluence scores
 */
const CURRENT_TTL = 30; // 30 seconds for current/recent timestamps
const HISTORICAL_TTL = 86400 * 30; // 30 days for historical timestamps (effectively indefinite)

/**
 * Time threshold to consider a timestamp as "historical"
 * Timestamps older than this are cached longer
 */
const HISTORICAL_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Generate cache key for confluence data
 *
 * @param symbol - Trading symbol
 * @param timestamp - Timestamp (ISO 8601 or Date)
 * @returns Redis cache key
 */
export function getCacheKey(symbol: string, timestamp: string | Date): string {
  const ts = typeof timestamp === 'string' ? timestamp : timestamp.toISOString();
  return `confluence:${symbol.toUpperCase()}:${ts}`;
}

/**
 * Check if timestamp is historical (older than threshold)
 *
 * @param timestamp - Timestamp to check
 * @returns True if timestamp is historical
 */
function isHistorical(timestamp: string | Date): boolean {
  const ts = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const ageMs = now.getTime() - ts.getTime();
  return ageMs > HISTORICAL_THRESHOLD_MS;
}

/**
 * Get TTL based on timestamp age
 *
 * @param timestamp - Timestamp
 * @returns TTL in seconds
 */
function getTTL(timestamp: string | Date): number {
  return isHistorical(timestamp) ? HISTORICAL_TTL : CURRENT_TTL;
}

/**
 * Get cached confluence result
 *
 * @param symbol - Trading symbol
 * @param timestamp - Timestamp
 * @returns Cached confluence result or null if not found
 */
export async function getCachedConfluence(
  symbol: string,
  timestamp: string | Date
): Promise<ConfluenceResult | null> {
  try {
    const cacheKey = getCacheKey(symbol, timestamp);
    const cached = await get<ConfluenceResult>(cacheKey);

    if (cached) {
      console.log(
        `[ConfluenceCache] Cache hit for ${symbol} at ${timestamp}`
      );
    }

    return cached;
  } catch (error) {
    console.error('[ConfluenceCache] Error getting cached confluence:', error);
    return null;
  }
}

/**
 * Cache confluence result
 *
 * TTL is automatically determined:
 * - Historical timestamps (>5 minutes old): 30 days
 * - Current/recent timestamps: 30 seconds
 *
 * @param symbol - Trading symbol
 * @param timestamp - Timestamp
 * @param result - Confluence result to cache
 */
export async function cacheConfluence(
  symbol: string,
  timestamp: string | Date,
  result: ConfluenceResult
): Promise<void> {
  try {
    const cacheKey = getCacheKey(symbol, timestamp);
    const ttl = getTTL(timestamp);

    await set(cacheKey, result, ttl);

    console.log(
      `[ConfluenceCache] Cached ${symbol} at ${timestamp} with TTL ${ttl}s ${isHistorical(timestamp) ? '(historical)' : '(current)'}`
    );
  } catch (error) {
    console.error('[ConfluenceCache] Error caching confluence:', error);
    // Don't throw - caching failures shouldn't break requests
  }
}

/**
 * Invalidate cached confluence for a symbol
 *
 * Useful when data is updated or corrected.
 *
 * @param symbol - Trading symbol
 * @param timestamp - Optional specific timestamp to invalidate
 */
export async function invalidateConfluence(
  symbol: string,
  timestamp?: string | Date
): Promise<void> {
  try {
    if (timestamp) {
      // Invalidate specific timestamp
      const cacheKey = getCacheKey(symbol, timestamp);
      await del(cacheKey);
      console.log(
        `[ConfluenceCache] Invalidated ${symbol} at ${timestamp}`
      );
    } else {
      // Note: invalidating all timestamps for a symbol would require
      // pattern matching (confluence:SYMBOL:*), which is expensive
      // For now, only support invalidating specific timestamps
      console.warn(
        `[ConfluenceCache] Invalidate all timestamps not implemented. Use specific timestamp.`
      );
    }
  } catch (error) {
    console.error('[ConfluenceCache] Error invalidating confluence:', error);
  }
}

/**
 * Warm up cache with pre-calculated confluence scores
 *
 * Useful for popular symbols/timeframes during off-peak hours.
 *
 * @param symbol - Trading symbol
 * @param timestamps - Array of timestamps to pre-calculate
 * @param calculateFn - Function to calculate confluence for a timestamp
 */
export async function warmUpCache(
  symbol: string,
  timestamps: (string | Date)[],
  calculateFn: (timestamp: string | Date) => Promise<ConfluenceResult>
): Promise<void> {
  console.log(
    `[ConfluenceCache] Warming up cache for ${symbol} with ${timestamps.length} timestamps`
  );

  for (const timestamp of timestamps) {
    try {
      // Check if already cached
      const cached = await getCachedConfluence(symbol, timestamp);
      if (cached) {
        continue; // Skip if already cached
      }

      // Calculate and cache
      const result = await calculateFn(timestamp);
      await cacheConfluence(symbol, timestamp, result);
    } catch (error) {
      console.error(
        `[ConfluenceCache] Error warming up ${symbol} at ${timestamp}:`,
        error
      );
      // Continue with next timestamp
    }
  }

  console.log(`[ConfluenceCache] Cache warm-up complete for ${symbol}`);
}
