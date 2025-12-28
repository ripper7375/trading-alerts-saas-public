# Phase 4 Part 1: Caching Layer Implementation

**Project**: Trading Alerts SaaS V7  
**Phase**: 4 of 6 - Business Logic & APIs  
**Part**: 1 of 4 - Caching Layer  
**Priority**: 🟢 MEDIUM - Performance optimization  
**Estimated Time**: 1 hour  
**Dependencies**: ✅ Part 0 Complete (business-rules.ts exists)

---

## 🎯 Objective

Implement a **Redis-based caching layer** for indicator data to:

- Reduce load on MT5 service
- Improve API response times
- Use intelligent TTL based on timeframe granularity
- Provide cache invalidation capabilities

**Performance Goal**: Cache hit rate >70% for repeated requests within TTL window.

---

## ✅ Prerequisites Check

### Verify Part 0 is Complete

```bash
# Check that business-rules.ts exists
ls -la lib/constants/business-rules.ts

# Expected output:
# -rw-r--r--  1 user  staff  XXXXX  lib/constants/business-rules.ts
```

### Verify Redis is Available

```bash
# Check if Redis client is configured in your project
# Look for existing Redis setup or connection string

# Common locations:
# - lib/redis.ts
# - lib/db/redis.ts
# - .env.local (REDIS_URL)
```

**If Redis is not configured**, we'll create a simple in-memory cache fallback for development.

### Run Tests

```bash
npm test

# All tests should pass
# Test Suites: 108 passed, 108 total
# Tests:       2307 passed, 2307 total
```

---

## 🏗️ Implementation Tasks

### Task 1: Create Cache Utility Module

**File**: `lib/cache/indicator-cache.ts`

```typescript
/**
 * Indicator Data Caching Layer
 *
 * Uses Redis for production, in-memory Map for development
 * TTL values from business-rules.ts ensure cache freshness
 *
 * Dependencies:
 * - Part 0: CACHE_TTL, VALID_TIMEFRAMES, isValidTimeframe
 */

import {
  CACHE_TTL,
  DEFAULT_CACHE_TTL,
  isValidTimeframe,
  type Timeframe,
} from '@/lib/constants/business-rules';

// ============================================================================
// CACHE CLIENT
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

/**
 * In-memory cache implementation for development
 * Falls back to this if Redis is unavailable
 */
class MemoryCache implements CacheClient {
  private cache = new Map<string, { value: string; expiresAt: number }>();

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
  startCleanup(intervalMs = 60000) {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expiresAt) {
          this.cache.delete(key);
        }
      }
    }, intervalMs);
  }
}

/**
 * Get cache client
 * Uses Redis in production, memory cache in development
 */
function getCacheClient(): CacheClient {
  // Try to use Redis if available
  try {
    // If you have Redis configured, import and use it here
    // import { redis } from '@/lib/redis';
    // return redis;

    // For now, use memory cache
    console.log('[Cache] Using in-memory cache (Redis not configured)');
    const memCache = new MemoryCache();
    memCache.startCleanup();
    return memCache;
  } catch (error) {
    console.warn('[Cache] Redis unavailable, using in-memory cache');
    const memCache = new MemoryCache();
    memCache.startCleanup();
    return memCache;
  }
}

const cacheClient = getCacheClient();

// ============================================================================
// CACHE KEY GENERATION
// ============================================================================

/**
 * Generate cache key for indicator data
 * Format: indicator:{symbol}:{timeframe}:{bars?}
 */
function getCacheKey(symbol: string, timeframe: string, bars?: number): string {
  const baseKey = `indicator:${symbol.toUpperCase()}:${timeframe.toUpperCase()}`;
  return bars ? `${baseKey}:${bars}` : baseKey;
}

/**
 * Generate cache key pattern for symbol invalidation
 * Format: indicator:{symbol}:*
 */
function getSymbolPattern(symbol: string): string {
  return `indicator:${symbol.toUpperCase()}:*`;
}

// ============================================================================
// CACHE OPERATIONS
// ============================================================================

/**
 * Get TTL for a timeframe
 * Uses constants from Part 0
 */
function getTTL(timeframe: string): number {
  const upperTimeframe = timeframe.toUpperCase();

  if (isValidTimeframe(upperTimeframe)) {
    return CACHE_TTL[upperTimeframe as Timeframe];
  }

  console.warn(`[Cache] Unknown timeframe: ${timeframe}, using default TTL`);
  return DEFAULT_CACHE_TTL;
}

/**
 * Get cached indicator data
 *
 * @returns Parsed data if cache hit, null if cache miss
 */
export async function getCachedIndicatorData(
  symbol: string,
  timeframe: string,
  bars?: number
): Promise<any | null> {
  const key = getCacheKey(symbol, timeframe, bars);

  try {
    const cached = await cacheClient.get(key);

    if (cached) {
      console.log(
        `[Cache] HIT: ${symbol}/${timeframe}${bars ? `/${bars}` : ''}`
      );
      return JSON.parse(cached);
    }

    console.log(
      `[Cache] MISS: ${symbol}/${timeframe}${bars ? `/${bars}` : ''}`
    );
    return null;
  } catch (error) {
    console.error('[Cache] Error reading from cache:', error);
    return null;
  }
}

/**
 * Set cached indicator data
 * Automatically applies correct TTL based on timeframe
 */
export async function setCachedIndicatorData(
  symbol: string,
  timeframe: string,
  data: any,
  bars?: number
): Promise<void> {
  const key = getCacheKey(symbol, timeframe, bars);
  const ttl = getTTL(timeframe);

  try {
    await cacheClient.setex(key, ttl, JSON.stringify(data));
    console.log(
      `[Cache] SET: ${symbol}/${timeframe}${bars ? `/${bars}` : ''} ` +
        `(TTL: ${ttl}s = ${Math.round(ttl / 60)}min)`
    );
  } catch (error) {
    console.error('[Cache] Error writing to cache:', error);
    // Don't throw - caching failure shouldn't break the request
  }
}

/**
 * Check if cached data exists for a key
 */
export async function hasCachedData(
  symbol: string,
  timeframe: string,
  bars?: number
): Promise<boolean> {
  const key = getCacheKey(symbol, timeframe, bars);

  try {
    return await cacheClient.exists(key);
  } catch (error) {
    console.error('[Cache] Error checking cache:', error);
    return false;
  }
}

/**
 * Invalidate cache for a specific symbol/timeframe/bars combination
 */
export async function invalidateCachedData(
  symbol: string,
  timeframe: string,
  bars?: number
): Promise<void> {
  const key = getCacheKey(symbol, timeframe, bars);

  try {
    await cacheClient.del(key);
    console.log(
      `[Cache] INVALIDATED: ${symbol}/${timeframe}${bars ? `/${bars}` : ''}`
    );
  } catch (error) {
    console.error('[Cache] Error invalidating cache:', error);
  }
}

/**
 * Invalidate all cached data for a symbol
 * Useful when symbol data needs to be refreshed across all timeframes
 */
export async function invalidateSymbolCache(symbol: string): Promise<void> {
  const pattern = getSymbolPattern(symbol);

  try {
    // For memory cache, we need to manually find and delete matching keys
    // For Redis, you would use SCAN with pattern matching
    console.log(`[Cache] INVALIDATE SYMBOL: ${symbol} (pattern: ${pattern})`);

    // Simple implementation: invalidate common timeframes
    // In production with Redis, use SCAN to find all matching keys
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

    await Promise.all(timeframes.map((tf) => invalidateCachedData(symbol, tf)));

    console.log(`[Cache] INVALIDATED all timeframes for ${symbol}`);
  } catch (error) {
    console.error('[Cache] Error invalidating symbol cache:', error);
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
}

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
  };
}

/**
 * Reset cache statistics
 */
export function resetCacheStats(): void {
  cacheHits = 0;
  cacheMisses = 0;
}
```

---

### Task 2: Integrate Caching with Indicators API

**File**: `app/api/indicators/[symbol]/[timeframe]/route.ts`

Find the GET handler and add caching logic:

```typescript
import {
  getCachedIndicatorData,
  setCachedIndicatorData,
  recordCacheHit,
  recordCacheMiss,
} from '@/lib/cache/indicator-cache';

export async function GET(
  req: NextRequest,
  { params }: { params: { symbol: string; timeframe: string } }
) {
  try {
    const { symbol, timeframe } = params;
    const searchParams = req.nextUrl.searchParams;
    const bars = parseInt(searchParams.get('bars') || '1000', 10);

    // Get user session and tier
    const session = await getServerSession(authOptions);
    const userTier = session?.user?.tier || 'FREE';

    // Validate symbol and timeframe (using Part 0 constants)
    // ... existing validation logic ...

    // ✅ CHECK CACHE FIRST
    const cached = await getCachedIndicatorData(symbol, timeframe, bars);

    if (cached) {
      recordCacheHit();

      return NextResponse.json(
        {
          success: true,
          data: cached,
          tier: userTier,
          cached: true,
          cacheHit: true,
          requestedAt: new Date().toISOString(),
        },
        {
          status: 200,
          headers: {
            'X-Cache': 'HIT',
            'X-Cache-Tier': userTier,
          },
        }
      );
    }

    recordCacheMiss();

    // ✅ CACHE MISS - FETCH FROM MT5 SERVICE
    const data = await fetchIndicatorData(symbol, timeframe, bars);

    // ✅ STORE IN CACHE (async, don't wait)
    // Uses automatic TTL based on timeframe from Part 0
    setCachedIndicatorData(symbol, timeframe, data, bars).catch((err) => {
      console.error('[API] Failed to cache indicator data:', err);
      // Don't fail the request if caching fails
    });

    return NextResponse.json(
      {
        success: true,
        data,
        tier: userTier,
        cached: false,
        cacheHit: false,
        requestedAt: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          'X-Cache': 'MISS',
          'X-Cache-Tier': userTier,
        },
      }
    );
  } catch (error) {
    // ... existing error handling ...
  }
}
```

---

### Task 3: Add Cache Statistics Endpoint (Optional)

**File**: `app/api/cache/stats/route.ts`

Create a new endpoint to monitor cache performance:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getCacheStats } from '@/lib/cache/indicator-cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    // Optional: Require authentication
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = getCacheStats();

    return NextResponse.json({
      success: true,
      stats: {
        hits: stats.hits,
        misses: stats.misses,
        total: stats.hits + stats.misses,
        hitRate: `${(stats.hitRate * 100).toFixed(2)}%`,
        hitRateDecimal: stats.hitRate,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cache Stats] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## ✅ Validation Steps

### Step 1: Verify TypeScript Compilation

```bash
npm run build
# Should complete without errors
```

### Step 2: Run Existing Tests

```bash
npm test
# All tests should still pass
# Test Suites: 108 passed
# Tests:       2307 passed
```

### Step 3: Test Cache Functionality Manually

Start your dev server:

```bash
npm run dev
```

Test cache behavior:

```bash
# First request - should be cache MISS
curl http://localhost:3000/api/indicators/XAUUSD/H1

# Look for in response:
# "cached": false
# "cacheHit": false
# Headers: X-Cache: MISS

# Second request (within TTL) - should be cache HIT
curl http://localhost:3000/api/indicators/XAUUSD/H1

# Look for in response:
# "cached": true
# "cacheHit": true
# Headers: X-Cache: HIT
```

Check cache stats (if implemented):

```bash
curl http://localhost:3000/api/cache/stats

# Expected response:
# {
#   "success": true,
#   "stats": {
#     "hits": X,
#     "misses": Y,
#     "hitRate": "ZZ.ZZ%"
#   }
# }
```

### Step 4: Verify Cache TTL

Test different timeframes have different TTLs:

```bash
# M5 should have 5 minute TTL (300s)
curl http://localhost:3000/api/indicators/XAUUSD/M5

# H4 should have 4 hour TTL (14400s)
curl http://localhost:3000/api/indicators/XAUUSD/H4

# D1 should have 1 day TTL (86400s)
curl http://localhost:3000/api/indicators/XAUUSD/D1
```

Check server logs for TTL confirmation:

```
[Cache] SET: XAUUSD/M5 (TTL: 300s = 5min)
[Cache] SET: XAUUSD/H4 (TTL: 14400s = 240min)
[Cache] SET: XAUUSD/D1 (TTL: 86400s = 1440min)
```

---

## 🎯 Success Criteria

### Must Have:

- ✅ Cache utility created at `lib/cache/indicator-cache.ts`
- ✅ Caching integrated into indicators API GET handler
- ✅ Cache keys follow format: `indicator:{symbol}:{timeframe}:{bars?}`
- ✅ TTL automatically applied based on timeframe from Part 0
- ✅ Cache hit/miss properly tracked
- ✅ Response headers include `X-Cache: HIT/MISS`
- ✅ Response body includes `cached` and `cacheHit` flags
- ✅ All existing tests still pass
- ✅ TypeScript compiles without errors

### Quality Checks:

- ✅ Cache failures don't break API requests
- ✅ Proper error handling for cache operations
- ✅ Console logging for cache operations (HIT/MISS/SET)
- ✅ TTL values match expectations from CACHE_TTL
- ✅ In-memory fallback works if Redis unavailable

### Performance Indicators:

- ✅ Second request to same endpoint returns faster (cached)
- ✅ Cache hit rate >0% after repeated requests
- ✅ Different timeframes have different TTL values
- ✅ No memory leaks in in-memory cache implementation

---

## 🔗 Integration with Part 0

### Constants Used:

```typescript
import {
  CACHE_TTL, // TTL mapping for each timeframe
  DEFAULT_CACHE_TTL, // Fallback TTL
  isValidTimeframe, // Validation helper
  type Timeframe, // Type safety
} from '@/lib/constants/business-rules';
```

### How They're Used:

- `CACHE_TTL[timeframe]` → Determines how long to cache data
- `isValidTimeframe()` → Validates timeframe before caching
- `DEFAULT_CACHE_TTL` → Fallback if timeframe unknown
- `Timeframe` type → Ensures type safety in cache operations

---

## 🚫 Constraints

### DO NOT:

- ❌ Cache authentication tokens or session data
- ❌ Cache error responses
- ❌ Use hardcoded TTL values (use CACHE_TTL from Part 0)
- ❌ Let cache failures break API requests
- ❌ Cache data indefinitely (always use TTL)
- ❌ Modify Part 0 constants

### DO:

- ✅ Use constants from Part 0 for TTL values
- ✅ Handle cache errors gracefully
- ✅ Log cache operations for debugging
- ✅ Add `cached` flag to response body
- ✅ Add `X-Cache` header to responses
- ✅ Implement cache invalidation functions

---

## 📝 Commit Message

After verification, commit with:

```bash
git add lib/cache/indicator-cache.ts
git add app/api/indicators/[symbol]/[timeframe]/route.ts
git add app/api/cache/stats/route.ts  # if created

git commit -m "feat(phase4): implement caching layer with intelligent TTL

- Create indicator-cache.ts with Redis/memory support
- Integrate caching into indicators API endpoint
- Use CACHE_TTL from Part 0 for timeframe-specific TTL
- Add cache hit/miss tracking and statistics
- Add X-Cache headers and cached flags in responses
- Implement cache invalidation utilities
- Support in-memory fallback if Redis unavailable

Cache TTL by timeframe:
- M5: 5 min, M15: 15 min, M30: 30 min
- H1: 1 hr, H2: 2 hr, H4: 4 hr, H8: 8 hr, H12: 12 hr
- D1: 24 hr"
```

---

## 🎯 Next Steps

After Part 1 is complete and committed:

1. ✅ Verify caching works (HIT/MISS behavior)
2. ✅ Verify TTL values are correct per timeframe
3. ✅ Verify all tests pass
4. ✅ Return to user for Part 2 prompt
5. ⏭️ **Part 2** will implement rate limiting using RATE_LIMITS from Part 0
6. ⏭️ Part 3 will implement indicator filtering
7. ⏭️ Part 4 will test everything together

---

## 📊 Estimated Impact

**Files Created**: 2-3  
**Files Modified**: 1 (indicators API route)  
**Lines of Code**: ~300-400  
**Dependencies Used**: Part 0 (CACHE_TTL, isValidTimeframe)  
**Performance Gain**: 50-80% faster response time for cached requests  
**Risk Level**: LOW (caching failures don't break requests)

---

## 💡 Tips for Claude Code

1. **Start with cache utility** - Create `indicator-cache.ts` first
2. **Test cache operations** - Verify get/set work before integration
3. **Integrate incrementally** - Add to API route after cache utility works
4. **Check logs** - Verify HIT/MISS/SET messages appear
5. **Test different timeframes** - Ensure M5 has 5min TTL, D1 has 24hr TTL
6. **Don't break existing behavior** - All current tests must still pass

The caching layer should be invisible to users but improve performance significantly! 🚀
