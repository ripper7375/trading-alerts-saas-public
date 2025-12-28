# Phase 4 Part 1.1: Cache Utility (Isolated)

**Project**: Trading Alerts SaaS V7  
**Phase**: 4 of 6 - Business Logic & APIs  
**Part**: 1.1 of 5 - Cache Utility Creation  
**Priority**: 🟢 MEDIUM - Foundation Layer  
**Estimated Time**: 20 minutes  
**Dependencies**: ✅ Part 1.0 Complete (baseline established)

---

## 🎯 Objective

Create a **standalone cache utility module** for indicator data caching.

**Critical Constraint**: This part creates **ONE NEW FILE ONLY**. We do NOT modify any existing files or integrate with any APIs yet.

**Success Criteria**: Cache utility exists, can be imported, all existing tests still pass.

---

## 🚨 Critical Rules for Part 1.1

### ✅ DO:

- Create `lib/cache/indicator-cache.ts` (new file)
- Import constants from Part 0
- Implement cache operations (get, set, delete, invalidate)
- Use in-memory cache as fallback
- Add comprehensive JSDoc comments
- Export all public functions

### ❌ DO NOT:

- Modify ANY existing files
- Touch the indicators API route
- Modify any test files
- Create Redis connection (use in-memory for now)
- Add any API integration
- Change any other files in the project

**Mantra**: "Create the utility, don't use it yet"

---

## 📋 Implementation Task

### Create Cache Utility File

**File**: `lib/cache/indicator-cache.ts`

**Full Implementation**:

```typescript
/**
 * Indicator Data Caching Utility
 *
 * Provides caching layer for MT5 indicator data with intelligent TTL.
 * Uses in-memory cache with automatic cleanup (Redis can be added later).
 *
 * Features:
 * - Automatic TTL based on timeframe from Part 0 constants
 * - Cache key generation for symbol/timeframe/bars combinations
 * - Symbol-level invalidation
 * - Cache statistics tracking
 * - Safe error handling (failures don't break requests)
 *
 * Dependencies:
 * - Part 0: CACHE_TTL, VALID_TIMEFRAMES, isValidTimeframe
 *
 * @module lib/cache/indicator-cache
 */

import {
  CACHE_TTL,
  DEFAULT_CACHE_TTL,
  isValidTimeframe,
  type Timeframe,
} from '@/lib/constants/business-rules';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Cache entry with expiration
 */
interface CacheEntry {
  value: string;
  expiresAt: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
}

// ============================================================================
// IN-MEMORY CACHE IMPLEMENTATION
// ============================================================================

/**
 * In-memory cache store
 * Uses Map with expiration timestamps
 */
class MemoryCache {
  private cache = new Map<string, CacheEntry>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Get value from cache
   * Returns null if not found or expired
   */
  async get(key: string): Promise<string | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Set value in cache with TTL
   * @param key Cache key
   * @param ttl Time-to-live in seconds
   * @param value Value to cache (as JSON string)
   */
  async set(key: string, ttl: number, value: string): Promise<void> {
    const expiresAt = Date.now() + ttl * 1000;
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  /**
   * Check if key exists and is not expired
   */
  async exists(key: string): Promise<boolean> {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get all keys matching a pattern
   * Simple implementation: returns all keys containing the pattern
   */
  async keys(pattern: string): Promise<string[]> {
    const matchedKeys: string[] = [];
    const searchPattern = pattern.replace(/\*/g, '');

    for (const key of this.cache.keys()) {
      if (key.includes(searchPattern)) {
        matchedKeys.push(key);
      }
    }

    return matchedKeys;
  }

  /**
   * Start periodic cleanup of expired entries
   * Runs every minute by default
   */
  startCleanup(intervalMs = 60000): void {
    if (this.cleanupInterval) {
      return; // Already running
    }

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expiresAt) {
          this.cache.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        console.log(`[Cache] Cleanup: removed ${cleaned} expired entries`);
      }
    }, intervalMs);

    console.log('[Cache] Cleanup task started (interval: 60s)');
  }

  /**
   * Stop periodic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('[Cache] Cleanup task stopped');
    }
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }
}

// ============================================================================
// CACHE CLIENT SINGLETON
// ============================================================================

/**
 * Global cache client instance
 * Uses in-memory cache (can be replaced with Redis later)
 */
const cacheClient = new MemoryCache();

// Start cleanup on module load
cacheClient.startCleanup();

// ============================================================================
// CACHE KEY GENERATION
// ============================================================================

/**
 * Generate cache key for indicator data
 *
 * Format: indicator:{SYMBOL}:{TIMEFRAME}:{BARS}
 * Example: indicator:XAUUSD:H1:1000
 *
 * @param symbol Trading symbol (e.g., "XAUUSD")
 * @param timeframe Timeframe (e.g., "H1")
 * @param bars Number of bars (optional)
 * @returns Cache key string
 */
function generateCacheKey(
  symbol: string,
  timeframe: string,
  bars?: number
): string {
  const normalizedSymbol = symbol.toUpperCase();
  const normalizedTimeframe = timeframe.toUpperCase();

  if (bars !== undefined) {
    return `indicator:${normalizedSymbol}:${normalizedTimeframe}:${bars}`;
  }

  return `indicator:${normalizedSymbol}:${normalizedTimeframe}`;
}

/**
 * Generate cache key pattern for symbol invalidation
 *
 * Format: indicator:{SYMBOL}:*
 * Example: indicator:XAUUSD:*
 *
 * @param symbol Trading symbol
 * @returns Cache key pattern
 */
function generateSymbolPattern(symbol: string): string {
  const normalizedSymbol = symbol.toUpperCase();
  return `indicator:${normalizedSymbol}:*`;
}

// ============================================================================
// TTL CALCULATION
// ============================================================================

/**
 * Get TTL for a timeframe
 * Uses CACHE_TTL from Part 0 constants
 *
 * @param timeframe Timeframe string
 * @returns TTL in seconds
 */
function getTTL(timeframe: string): number {
  const normalizedTimeframe = timeframe.toUpperCase();

  if (isValidTimeframe(normalizedTimeframe)) {
    const ttl = CACHE_TTL[normalizedTimeframe as Timeframe];
    return ttl;
  }

  console.warn(
    `[Cache] Unknown timeframe: ${timeframe}, using default TTL (${DEFAULT_CACHE_TTL}s)`
  );
  return DEFAULT_CACHE_TTL;
}

/**
 * Format TTL for logging
 * Converts seconds to human-readable format
 *
 * @param ttlSeconds TTL in seconds
 * @returns Human-readable string (e.g., "5min", "4hr", "1day")
 */
function formatTTL(ttlSeconds: number): string {
  if (ttlSeconds < 60) {
    return `${ttlSeconds}s`;
  }
  if (ttlSeconds < 3600) {
    return `${Math.round(ttlSeconds / 60)}min`;
  }
  if (ttlSeconds < 86400) {
    return `${Math.round(ttlSeconds / 3600)}hr`;
  }
  return `${Math.round(ttlSeconds / 86400)}day`;
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
};

/**
 * Record a cache hit
 */
function recordHit(): void {
  statsCounters.hits++;
}

/**
 * Record a cache miss
 */
function recordMiss(): void {
  statsCounters.misses++;
}

/**
 * Record a cache set
 */
function recordSet(): void {
  statsCounters.sets++;
}

/**
 * Record a cache delete
 */
function recordDelete(): void {
  statsCounters.deletes++;
}

/**
 * Get cache statistics
 *
 * @returns Cache statistics object
 */
export function getCacheStats(): CacheStats {
  const total = statsCounters.hits + statsCounters.misses;
  const hitRate = total > 0 ? statsCounters.hits / total : 0;

  return {
    hits: statsCounters.hits,
    misses: statsCounters.misses,
    sets: statsCounters.sets,
    deletes: statsCounters.deletes,
    hitRate,
  };
}

/**
 * Reset cache statistics
 * Useful for testing or periodic resets
 */
export function resetCacheStats(): void {
  statsCounters = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
  };
  console.log('[Cache] Statistics reset');
}

// ============================================================================
// PUBLIC CACHE OPERATIONS
// ============================================================================

/**
 * Get cached indicator data
 *
 * Returns parsed JSON data if cache hit, null if cache miss
 * Automatically tracks hit/miss statistics
 *
 * @param symbol Trading symbol (e.g., "XAUUSD")
 * @param timeframe Timeframe (e.g., "H1")
 * @param bars Number of bars (optional)
 * @returns Parsed data object or null
 *
 * @example
 * const data = await getCachedIndicatorData('XAUUSD', 'H1', 1000);
 * if (data) {
 *   console.log('Cache hit!', data);
 * } else {
 *   console.log('Cache miss - need to fetch from MT5');
 * }
 */
export async function getCachedIndicatorData(
  symbol: string,
  timeframe: string,
  bars?: number
): Promise<any | null> {
  const key = generateCacheKey(symbol, timeframe, bars);

  try {
    const cached = await cacheClient.get(key);

    if (cached) {
      recordHit();
      console.log(
        `[Cache] HIT: ${symbol}/${timeframe}${bars ? `/${bars}` : ''}`
      );
      return JSON.parse(cached);
    }

    recordMiss();
    console.log(
      `[Cache] MISS: ${symbol}/${timeframe}${bars ? `/${bars}` : ''}`
    );
    return null;
  } catch (error) {
    console.error('[Cache] Error reading from cache:', error);
    recordMiss();
    return null;
  }
}

/**
 * Set cached indicator data
 *
 * Stores data with automatic TTL based on timeframe
 * TTL values from Part 0 constants (CACHE_TTL)
 *
 * @param symbol Trading symbol
 * @param timeframe Timeframe
 * @param data Data to cache (will be JSON.stringified)
 * @param bars Number of bars (optional)
 *
 * @example
 * await setCachedIndicatorData('XAUUSD', 'H1', indicatorData, 1000);
 * // Automatically uses 3600s (1 hour) TTL for H1
 */
export async function setCachedIndicatorData(
  symbol: string,
  timeframe: string,
  data: any,
  bars?: number
): Promise<void> {
  const key = generateCacheKey(symbol, timeframe, bars);
  const ttl = getTTL(timeframe);

  try {
    await cacheClient.set(key, ttl, JSON.stringify(data));
    recordSet();
    console.log(
      `[Cache] SET: ${symbol}/${timeframe}${bars ? `/${bars}` : ''} ` +
        `(TTL: ${ttl}s = ${formatTTL(ttl)})`
    );
  } catch (error) {
    console.error('[Cache] Error writing to cache:', error);
    // Don't throw - caching failures shouldn't break the request
  }
}

/**
 * Check if cached data exists
 *
 * @param symbol Trading symbol
 * @param timeframe Timeframe
 * @param bars Number of bars (optional)
 * @returns True if cached data exists and is not expired
 */
export async function hasCachedData(
  symbol: string,
  timeframe: string,
  bars?: number
): Promise<boolean> {
  const key = generateCacheKey(symbol, timeframe, bars);

  try {
    return await cacheClient.exists(key);
  } catch (error) {
    console.error('[Cache] Error checking cache existence:', error);
    return false;
  }
}

/**
 * Invalidate cached data for specific symbol/timeframe/bars
 *
 * @param symbol Trading symbol
 * @param timeframe Timeframe
 * @param bars Number of bars (optional)
 *
 * @example
 * await invalidateCachedData('XAUUSD', 'H1', 1000);
 */
export async function invalidateCachedData(
  symbol: string,
  timeframe: string,
  bars?: number
): Promise<void> {
  const key = generateCacheKey(symbol, timeframe, bars);

  try {
    await cacheClient.delete(key);
    recordDelete();
    console.log(
      `[Cache] INVALIDATED: ${symbol}/${timeframe}${bars ? `/${bars}` : ''}`
    );
  } catch (error) {
    console.error('[Cache] Error invalidating cache:', error);
  }
}

/**
 * Invalidate all cached data for a symbol
 *
 * Useful when symbol data needs to be refreshed across all timeframes
 *
 * @param symbol Trading symbol
 *
 * @example
 * await invalidateSymbolCache('XAUUSD');
 * // Invalidates XAUUSD data for all timeframes (M5, M15, H1, etc.)
 */
export async function invalidateSymbolCache(symbol: string): Promise<void> {
  const pattern = generateSymbolPattern(symbol);

  try {
    console.log(`[Cache] INVALIDATING SYMBOL: ${symbol} (pattern: ${pattern})`);

    // Find all matching keys
    const keys = await cacheClient.keys(pattern);

    if (keys.length === 0) {
      console.log(`[Cache] No cached data found for ${symbol}`);
      return;
    }

    // Delete all matching keys
    await Promise.all(keys.map((key) => cacheClient.delete(key)));
    recordDelete();

    console.log(
      `[Cache] INVALIDATED ${keys.length} cache entries for ${symbol}`
    );
  } catch (error) {
    console.error('[Cache] Error invalidating symbol cache:', error);
  }
}

/**
 * Clear all cached data
 *
 * WARNING: This clears ALL cache entries
 * Use with caution - typically only for testing or maintenance
 */
export async function clearAllCache(): Promise<void> {
  try {
    cacheClient.clear();
    console.log('[Cache] All cache entries cleared');
  } catch (error) {
    console.error('[Cache] Error clearing cache:', error);
  }
}

/**
 * Get cache size (number of entries)
 *
 * @returns Number of cache entries
 */
export function getCacheSize(): number {
  return cacheClient.size();
}

// ============================================================================
// EXPORT SUMMARY
// ============================================================================

/**
 * Exported functions:
 *
 * Core Operations:
 * - getCachedIndicatorData(symbol, timeframe, bars?)
 * - setCachedIndicatorData(symbol, timeframe, data, bars?)
 * - hasCachedData(symbol, timeframe, bars?)
 *
 * Invalidation:
 * - invalidateCachedData(symbol, timeframe, bars?)
 * - invalidateSymbolCache(symbol)
 * - clearAllCache()
 *
 * Statistics:
 * - getCacheStats()
 * - resetCacheStats()
 *
 * Utilities:
 * - getCacheSize()
 */
```

---

## ✅ Validation Steps

### Step 1: Verify File Creation

```bash
# Check that file was created
ls -la lib/cache/indicator-cache.ts

# Expected output:
# -rw-r--r--  1 user  staff  ~15000-18000  lib/cache/indicator-cache.ts
```

### Step 2: Verify TypeScript Compilation

```bash
npx tsc --noEmit

# Expected: No errors
# The file should compile without issues
```

### Step 3: Verify Imports Work

Create a temporary test script:

**File**: `test-cache-import.ts` (temporary)

```typescript
/**
 * Temporary test to verify cache utility can be imported
 * Will be deleted after verification
 */

import {
  getCachedIndicatorData,
  setCachedIndicatorData,
  hasCachedData,
  invalidateCachedData,
  invalidateSymbolCache,
  getCacheStats,
  resetCacheStats,
  getCacheSize,
} from './lib/cache/indicator-cache';

console.log('✅ All cache functions imported successfully');

// Quick functionality test
async function testCache() {
  console.log('\n=== Testing Cache Utility ===\n');

  // Test 1: Set data
  console.log('Test 1: Set cached data');
  await setCachedIndicatorData('XAUUSD', 'H1', { test: 'data' }, 1000);
  console.log('✅ Set successful');

  // Test 2: Get data (should hit)
  console.log('\nTest 2: Get cached data (should HIT)');
  const data = await getCachedIndicatorData('XAUUSD', 'H1', 1000);
  console.log('Data:', data);
  console.log(data ? '✅ Cache HIT' : '❌ Cache MISS');

  // Test 3: Check existence
  console.log('\nTest 3: Check cache existence');
  const exists = await hasCachedData('XAUUSD', 'H1', 1000);
  console.log('Exists:', exists ? '✅ Yes' : '❌ No');

  // Test 4: Get stats
  console.log('\nTest 4: Cache statistics');
  const stats = getCacheStats();
  console.log('Stats:', stats);
  console.log(
    `✅ Hits: ${stats.hits}, Misses: ${stats.misses}, Sets: ${stats.sets}`
  );

  // Test 5: Cache size
  console.log('\nTest 5: Cache size');
  const size = getCacheSize();
  console.log(`Cache size: ${size} entries`);
  console.log(size > 0 ? '✅ Has entries' : '❌ Empty');

  // Test 6: Invalidate
  console.log('\nTest 6: Invalidate data');
  await invalidateCachedData('XAUUSD', 'H1', 1000);
  const afterInvalidate = await hasCachedData('XAUUSD', 'H1', 1000);
  console.log(
    'After invalidation:',
    afterInvalidate ? '❌ Still exists' : '✅ Removed'
  );

  console.log('\n=== All Tests Passed ===\n');
}

testCache().catch(console.error);
```

Run the test:

```bash
npx tsx test-cache-import.ts

# Expected output:
# ✅ All cache functions imported successfully
# Test 1: Set cached data
# [Cache] SET: XAUUSD/H1/1000 (TTL: 3600s = 1hr)
# ✅ Set successful
# ...
# === All Tests Passed ===
```

Clean up:

```bash
rm test-cache-import.ts
```

### Step 4: Run Full Test Suite

**CRITICAL**: All existing tests must still pass

```bash
npm test

# Expected: Same results as Part 1.0 baseline
# Test Suites: 108 passed, 108 total
# Tests:       2307 passed, 2307 total
```

### Step 5: Verify No Files Were Modified

```bash
git status

# Expected output should show ONLY:
# Untracked files:
#   lib/cache/indicator-cache.ts
#
# NO modified existing files!
```

---

## 🎯 Success Criteria

### Must Have:

- ✅ File created: `lib/cache/indicator-cache.ts`
- ✅ TypeScript compiles without errors
- ✅ Can import all exported functions
- ✅ All existing tests still pass (2307 tests)
- ✅ No existing files were modified
- ✅ Cache utility works in isolation (test script passes)

### Quality Checks:

- ✅ Uses CACHE_TTL from Part 0 for TTL values
- ✅ Uses isValidTimeframe from Part 0 for validation
- ✅ Comprehensive JSDoc comments
- ✅ Error handling prevents cache failures from breaking calls
- ✅ Statistics tracking implemented
- ✅ Logging for debugging

### Verification:

- ✅ M5 timeframe uses 300s TTL (5 minutes)
- ✅ H1 timeframe uses 3600s TTL (1 hour)
- ✅ D1 timeframe uses 86400s TTL (24 hours)
- ✅ Cache keys follow format: `indicator:{SYMBOL}:{TIMEFRAME}:{BARS}`

---

## 🚫 Constraints

### DO NOT:

- ❌ Modify any existing files (API routes, tests, configs, etc.)
- ❌ Create Redis connection (use in-memory for now)
- ❌ Integrate with any APIs
- ❌ Create any other new files
- ❌ Install new packages
- ❌ Modify package.json

### DO:

- ✅ Create exactly ONE new file: `lib/cache/indicator-cache.ts`
- ✅ Use constants from Part 0
- ✅ Implement in-memory cache
- ✅ Add comprehensive documentation
- ✅ Test imports work
- ✅ Verify existing tests still pass

---

## 📝 Commit Message

After verification, commit with:

```bash
git add lib/cache/indicator-cache.ts

git commit -m "feat(phase4): Part 1.1 - create cache utility (isolated)

- Create lib/cache/indicator-cache.ts
- Implement in-memory cache with TTL support
- Use CACHE_TTL from Part 0 for timeframe-specific TTL
- Add cache operations: get, set, delete, invalidate
- Implement cache statistics tracking
- Add symbol-level invalidation
- Comprehensive JSDoc documentation
- Safe error handling (failures don't break requests)

TTL by timeframe (from Part 0):
- M5: 300s, M15: 900s, M30: 1800s
- H1: 3600s, H2: 7200s, H4: 14400s
- H8: 28800s, H12: 43200s, D1: 86400s

No integration yet - utility only.
All 2307 existing tests still pass."
```

---

## 🔗 Integration with Part 0

### Constants Used from Part 0:

```typescript
import {
  CACHE_TTL, // TTL mapping for all 9 timeframes
  DEFAULT_CACHE_TTL, // Fallback TTL (3600s)
  isValidTimeframe, // Validation helper
  type Timeframe, // TypeScript type
} from '@/lib/constants/business-rules';
```

### How They're Used:

1. **CACHE_TTL**: Maps timeframe to TTL in seconds

   ```typescript
   const ttl = CACHE_TTL['H1']; // 3600s
   ```

2. **isValidTimeframe**: Validates timeframe before getting TTL

   ```typescript
   if (isValidTimeframe(timeframe)) {
     return CACHE_TTL[timeframe];
   }
   ```

3. **DEFAULT_CACHE_TTL**: Fallback for unknown timeframes
   ```typescript
   return DEFAULT_CACHE_TTL; // 3600s
   ```

---

## 📊 Estimated Impact

**Files Created**: 1  
**Files Modified**: 0  
**Lines of Code**: ~450  
**Functions Exported**: 9  
**Risk Level**: VERY LOW (isolated, no integration)  
**Test Impact**: None (all existing tests should still pass)

---

## 🎯 Next Steps

After Part 1.1 is complete and committed:

1. ✅ Verify file created and compiles
2. ✅ Verify test script passes
3. ✅ Verify all 2307 tests still pass
4. ✅ Commit changes
5. ✅ Return to user for Part 1.2 prompt
6. ⏭️ **Part 1.2** will create unit tests for this cache utility
7. ⏭️ Part 1.3 will integrate with indicators API (minimal)
8. ⏭️ Part 1.4 will add cache write on success
9. ⏭️ Part 1.5 will add response metadata

---

## 💡 Tips for Claude Code

1. **Create the file exactly as specified** - All code is provided
2. **Don't modify anything else** - Resist the urge to "improve" other files
3. **Test the imports** - Create and run the test script
4. **Verify test count** - Should be exactly 2307 (same as baseline)
5. **Check git status** - Should show ONLY the new file
6. **Document any issues** - If something doesn't work, report it

**Remember**: This is just creating the utility. We're not using it yet. That comes in Part 1.3.

Success looks like: One new file, all old tests pass, ready for Part 1.2! 🎯
