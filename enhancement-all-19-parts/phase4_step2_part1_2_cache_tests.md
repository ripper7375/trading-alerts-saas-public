# Phase 4 Part 1.2: Cache Unit Tests

**Project**: Trading Alerts SaaS V7  
**Phase**: 4 of 6 - Business Logic & APIs  
**Part**: 1.2 of 5 - Cache Unit Tests  
**Priority**: 🟢 MEDIUM - Quality Assurance  
**Estimated Time**: 15 minutes  
**Dependencies**: ✅ Part 1.1 Complete (cache utility exists)

---

## 🎯 Objective

Create **comprehensive unit tests** for the cache utility created in Part 1.1.

**Critical Constraint**: This part creates **ONE NEW TEST FILE ONLY**. We do NOT modify any existing files.

**Success Criteria**: Cache utility has full test coverage, all tests pass (existing + new).

---

## 🚨 Critical Rules for Part 1.2

### ✅ DO:

- Create `__tests__/lib/cache/indicator-cache.test.ts` (new file)
- Test all cache operations (get, set, delete, invalidate, stats)
- Test TTL behavior with Part 0 timeframes
- Test cache key generation
- Test error handling
- Use Jest best practices

### ❌ DO NOT:

- Modify ANY existing test files
- Modify the cache utility itself
- Touch any API routes or other source files
- Change any test configurations
- Modify jest.config.js or setup files

**Mantra**: "Test the utility thoroughly, don't change anything else"

---

## 📋 Implementation Task

### Create Cache Utility Test File

**File**: `__tests__/lib/cache/indicator-cache.test.ts`

**Full Implementation**:

```typescript
/**
 * Unit tests for indicator cache utility
 *
 * Tests:
 * - Cache operations (get, set, delete, exists)
 * - TTL behavior with Part 0 timeframes
 * - Cache key generation
 * - Symbol invalidation
 * - Statistics tracking
 * - Error handling
 *
 * @module __tests__/lib/cache/indicator-cache.test.ts
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
  clearAllCache,
} from '@/lib/cache/indicator-cache';

import { CACHE_TTL } from '@/lib/constants/business-rules';

describe('Indicator Cache Utility', () => {
  // Reset cache and stats before each test
  beforeEach(async () => {
    await clearAllCache();
    resetCacheStats();
  });

  // Clean up after all tests
  afterAll(async () => {
    await clearAllCache();
    resetCacheStats();
  });

  describe('Cache Operations', () => {
    describe('setCachedIndicatorData', () => {
      it('should store data in cache', async () => {
        const testData = { prices: [100, 101, 102], indicators: {} };

        await setCachedIndicatorData('XAUUSD', 'H1', testData, 1000);

        const cached = await getCachedIndicatorData('XAUUSD', 'H1', 1000);
        expect(cached).toEqual(testData);
      });

      it('should handle different symbols', async () => {
        const data1 = { symbol: 'XAUUSD', value: 100 };
        const data2 = { symbol: 'EURUSD', value: 200 };

        await setCachedIndicatorData('XAUUSD', 'H1', data1);
        await setCachedIndicatorData('EURUSD', 'H1', data2);

        const cached1 = await getCachedIndicatorData('XAUUSD', 'H1');
        const cached2 = await getCachedIndicatorData('EURUSD', 'H1');

        expect(cached1).toEqual(data1);
        expect(cached2).toEqual(data2);
      });

      it('should handle different timeframes', async () => {
        const data1 = { timeframe: 'M5', value: 100 };
        const data2 = { timeframe: 'H1', value: 200 };

        await setCachedIndicatorData('XAUUSD', 'M5', data1);
        await setCachedIndicatorData('XAUUSD', 'H1', data2);

        const cached1 = await getCachedIndicatorData('XAUUSD', 'M5');
        const cached2 = await getCachedIndicatorData('XAUUSD', 'H1');

        expect(cached1).toEqual(data1);
        expect(cached2).toEqual(data2);
      });

      it('should handle different bar counts', async () => {
        const data1 = { bars: 500, value: 100 };
        const data2 = { bars: 1000, value: 200 };

        await setCachedIndicatorData('XAUUSD', 'H1', data1, 500);
        await setCachedIndicatorData('XAUUSD', 'H1', data2, 1000);

        const cached1 = await getCachedIndicatorData('XAUUSD', 'H1', 500);
        const cached2 = await getCachedIndicatorData('XAUUSD', 'H1', 1000);

        expect(cached1).toEqual(data1);
        expect(cached2).toEqual(data2);
      });

      it('should overwrite existing cache entry', async () => {
        const data1 = { value: 'old' };
        const data2 = { value: 'new' };

        await setCachedIndicatorData('XAUUSD', 'H1', data1);
        await setCachedIndicatorData('XAUUSD', 'H1', data2);

        const cached = await getCachedIndicatorData('XAUUSD', 'H1');
        expect(cached).toEqual(data2);
      });
    });

    describe('getCachedIndicatorData', () => {
      it('should return null for cache miss', async () => {
        const cached = await getCachedIndicatorData('XAUUSD', 'H1', 1000);
        expect(cached).toBeNull();
      });

      it('should return cached data for cache hit', async () => {
        const testData = { test: 'data' };
        await setCachedIndicatorData('XAUUSD', 'H1', testData);

        const cached = await getCachedIndicatorData('XAUUSD', 'H1');
        expect(cached).toEqual(testData);
      });

      it('should normalize symbol case', async () => {
        const testData = { test: 'data' };
        await setCachedIndicatorData('xauusd', 'H1', testData);

        const cached1 = await getCachedIndicatorData('XAUUSD', 'H1');
        const cached2 = await getCachedIndicatorData('xauusd', 'H1');

        expect(cached1).toEqual(testData);
        expect(cached2).toEqual(testData);
      });

      it('should normalize timeframe case', async () => {
        const testData = { test: 'data' };
        await setCachedIndicatorData('XAUUSD', 'h1', testData);

        const cached1 = await getCachedIndicatorData('XAUUSD', 'H1');
        const cached2 = await getCachedIndicatorData('XAUUSD', 'h1');

        expect(cached1).toEqual(testData);
        expect(cached2).toEqual(testData);
      });
    });

    describe('hasCachedData', () => {
      it('should return false for non-existent cache entry', async () => {
        const exists = await hasCachedData('XAUUSD', 'H1', 1000);
        expect(exists).toBe(false);
      });

      it('should return true for existing cache entry', async () => {
        await setCachedIndicatorData('XAUUSD', 'H1', { test: 'data' }, 1000);

        const exists = await hasCachedData('XAUUSD', 'H1', 1000);
        expect(exists).toBe(true);
      });
    });

    describe('invalidateCachedData', () => {
      it('should remove specific cache entry', async () => {
        await setCachedIndicatorData('XAUUSD', 'H1', { test: 'data' }, 1000);

        let exists = await hasCachedData('XAUUSD', 'H1', 1000);
        expect(exists).toBe(true);

        await invalidateCachedData('XAUUSD', 'H1', 1000);

        exists = await hasCachedData('XAUUSD', 'H1', 1000);
        expect(exists).toBe(false);
      });

      it('should not affect other cache entries', async () => {
        await setCachedIndicatorData('XAUUSD', 'H1', { test: 'data1' }, 1000);
        await setCachedIndicatorData('XAUUSD', 'H1', { test: 'data2' }, 500);

        await invalidateCachedData('XAUUSD', 'H1', 1000);

        const exists1000 = await hasCachedData('XAUUSD', 'H1', 1000);
        const exists500 = await hasCachedData('XAUUSD', 'H1', 500);

        expect(exists1000).toBe(false);
        expect(exists500).toBe(true);
      });
    });

    describe('invalidateSymbolCache', () => {
      it('should remove all cache entries for a symbol', async () => {
        // Add cache entries for XAUUSD with different timeframes
        await setCachedIndicatorData('XAUUSD', 'M5', { test: 'data1' });
        await setCachedIndicatorData('XAUUSD', 'H1', { test: 'data2' });
        await setCachedIndicatorData('XAUUSD', 'D1', { test: 'data3' });

        // Add cache entry for different symbol
        await setCachedIndicatorData('EURUSD', 'H1', { test: 'data4' });

        // Invalidate XAUUSD
        await invalidateSymbolCache('XAUUSD');

        // XAUUSD entries should be gone
        expect(await hasCachedData('XAUUSD', 'M5')).toBe(false);
        expect(await hasCachedData('XAUUSD', 'H1')).toBe(false);
        expect(await hasCachedData('XAUUSD', 'D1')).toBe(false);

        // EURUSD entry should still exist
        expect(await hasCachedData('EURUSD', 'H1')).toBe(true);
      });

      it('should handle non-existent symbol gracefully', async () => {
        // Should not throw error
        await expect(
          invalidateSymbolCache('NONEXISTENT')
        ).resolves.not.toThrow();
      });
    });

    describe('clearAllCache', () => {
      it('should remove all cache entries', async () => {
        await setCachedIndicatorData('XAUUSD', 'H1', { test: 'data1' });
        await setCachedIndicatorData('EURUSD', 'H1', { test: 'data2' });
        await setCachedIndicatorData('USDJPY', 'M5', { test: 'data3' });

        expect(getCacheSize()).toBeGreaterThan(0);

        await clearAllCache();

        expect(getCacheSize()).toBe(0);
        expect(await hasCachedData('XAUUSD', 'H1')).toBe(false);
        expect(await hasCachedData('EURUSD', 'H1')).toBe(false);
        expect(await hasCachedData('USDJPY', 'M5')).toBe(false);
      });
    });
  });

  describe('TTL Behavior', () => {
    it('should use correct TTL for M5 timeframe', async () => {
      const testData = { test: 'data' };
      await setCachedIndicatorData('XAUUSD', 'M5', testData);

      // Should exist immediately
      expect(await hasCachedData('XAUUSD', 'M5')).toBe(true);

      // M5 TTL from Part 0 is 300s (5 minutes)
      // We can't wait that long in tests, but we can verify it was set
      const cached = await getCachedIndicatorData('XAUUSD', 'M5');
      expect(cached).toEqual(testData);
    });

    it('should use correct TTL for H1 timeframe', async () => {
      const testData = { test: 'data' };
      await setCachedIndicatorData('XAUUSD', 'H1', testData);

      const cached = await getCachedIndicatorData('XAUUSD', 'H1');
      expect(cached).toEqual(testData);
      // H1 TTL from Part 0 is 3600s (1 hour)
    });

    it('should use correct TTL for D1 timeframe', async () => {
      const testData = { test: 'data' };
      await setCachedIndicatorData('XAUUSD', 'D1', testData);

      const cached = await getCachedIndicatorData('XAUUSD', 'D1');
      expect(cached).toEqual(testData);
      // D1 TTL from Part 0 is 86400s (24 hours)
    });

    it('should handle all Part 0 timeframes', async () => {
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
      const testData = { test: 'data' };

      for (const timeframe of timeframes) {
        await setCachedIndicatorData('XAUUSD', timeframe, testData);
        const cached = await getCachedIndicatorData('XAUUSD', timeframe);
        expect(cached).toEqual(testData);
      }
    });

    it('should use default TTL for unknown timeframe', async () => {
      const testData = { test: 'data' };
      // 'M1' is not a valid timeframe in our system
      await setCachedIndicatorData('XAUUSD', 'M1', testData);

      const cached = await getCachedIndicatorData('XAUUSD', 'M1');
      expect(cached).toEqual(testData);
      // Should use DEFAULT_CACHE_TTL (3600s)
    });
  });

  describe('Cache Statistics', () => {
    it('should track cache hits', async () => {
      resetCacheStats();

      await setCachedIndicatorData('XAUUSD', 'H1', { test: 'data' });
      await getCachedIndicatorData('XAUUSD', 'H1'); // Hit

      const stats = getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(0);
    });

    it('should track cache misses', async () => {
      resetCacheStats();

      await getCachedIndicatorData('XAUUSD', 'H1'); // Miss

      const stats = getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(1);
    });

    it('should track multiple hits and misses', async () => {
      resetCacheStats();

      await setCachedIndicatorData('XAUUSD', 'H1', { test: 'data' });

      await getCachedIndicatorData('XAUUSD', 'H1'); // Hit
      await getCachedIndicatorData('XAUUSD', 'H1'); // Hit
      await getCachedIndicatorData('EURUSD', 'H1'); // Miss
      await getCachedIndicatorData('USDJPY', 'M5'); // Miss

      const stats = getCacheStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
    });

    it('should calculate hit rate correctly', async () => {
      resetCacheStats();

      await setCachedIndicatorData('XAUUSD', 'H1', { test: 'data' });

      await getCachedIndicatorData('XAUUSD', 'H1'); // Hit
      await getCachedIndicatorData('XAUUSD', 'H1'); // Hit
      await getCachedIndicatorData('EURUSD', 'H1'); // Miss
      await getCachedIndicatorData('USDJPY', 'M5'); // Miss

      const stats = getCacheStats();
      expect(stats.hitRate).toBeCloseTo(0.5, 2); // 2 hits / 4 total = 50%
    });

    it('should track cache sets', async () => {
      resetCacheStats();

      await setCachedIndicatorData('XAUUSD', 'H1', { test: 'data' });
      await setCachedIndicatorData('EURUSD', 'H1', { test: 'data' });

      const stats = getCacheStats();
      expect(stats.sets).toBe(2);
    });

    it('should track cache deletes', async () => {
      resetCacheStats();

      await setCachedIndicatorData('XAUUSD', 'H1', { test: 'data' });
      await invalidateCachedData('XAUUSD', 'H1');

      const stats = getCacheStats();
      expect(stats.deletes).toBe(1);
    });

    it('should reset statistics', async () => {
      await setCachedIndicatorData('XAUUSD', 'H1', { test: 'data' });
      await getCachedIndicatorData('XAUUSD', 'H1');

      let stats = getCacheStats();
      expect(stats.hits).toBeGreaterThan(0);

      resetCacheStats();

      stats = getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);
      expect(stats.deletes).toBe(0);
      expect(stats.hitRate).toBe(0);
    });

    it('should handle zero operations gracefully', async () => {
      resetCacheStats();

      const stats = getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('Cache Size', () => {
    it('should return 0 for empty cache', () => {
      expect(getCacheSize()).toBe(0);
    });

    it('should return correct size after adding entries', async () => {
      await setCachedIndicatorData('XAUUSD', 'H1', { test: 'data1' });
      await setCachedIndicatorData('EURUSD', 'H1', { test: 'data2' });
      await setCachedIndicatorData('USDJPY', 'M5', { test: 'data3' });

      expect(getCacheSize()).toBe(3);
    });

    it('should update size after deletion', async () => {
      await setCachedIndicatorData('XAUUSD', 'H1', { test: 'data1' });
      await setCachedIndicatorData('EURUSD', 'H1', { test: 'data2' });

      expect(getCacheSize()).toBe(2);

      await invalidateCachedData('XAUUSD', 'H1');

      expect(getCacheSize()).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed data gracefully', async () => {
      // Should not throw when caching complex objects
      const complexData = {
        nested: { deep: { object: { with: ['arrays', 'and', 'objects'] } } },
        numbers: [1, 2, 3, 4, 5],
        nullValue: null,
        undefinedValue: undefined,
      };

      await expect(
        setCachedIndicatorData('XAUUSD', 'H1', complexData)
      ).resolves.not.toThrow();

      const cached = await getCachedIndicatorData('XAUUSD', 'H1');
      // undefined values are lost in JSON serialization
      expect(cached).toEqual({
        nested: { deep: { object: { with: ['arrays', 'and', 'objects'] } } },
        numbers: [1, 2, 3, 4, 5],
        nullValue: null,
      });
    });

    it('should handle empty symbol gracefully', async () => {
      // Should not throw
      await expect(
        setCachedIndicatorData('', 'H1', { test: 'data' })
      ).resolves.not.toThrow();
    });

    it('should handle empty timeframe gracefully', async () => {
      // Should not throw
      await expect(
        setCachedIndicatorData('XAUUSD', '', { test: 'data' })
      ).resolves.not.toThrow();
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate consistent keys for same inputs', async () => {
      const data1 = { value: 1 };
      const data2 = { value: 2 };

      await setCachedIndicatorData('XAUUSD', 'H1', data1, 1000);
      await setCachedIndicatorData('XAUUSD', 'H1', data2, 1000);

      // Second set should overwrite first
      const cached = await getCachedIndicatorData('XAUUSD', 'H1', 1000);
      expect(cached).toEqual(data2);
    });

    it('should generate different keys for different symbols', async () => {
      const data1 = { symbol: 'XAUUSD' };
      const data2 = { symbol: 'EURUSD' };

      await setCachedIndicatorData('XAUUSD', 'H1', data1, 1000);
      await setCachedIndicatorData('EURUSD', 'H1', data2, 1000);

      const cached1 = await getCachedIndicatorData('XAUUSD', 'H1', 1000);
      const cached2 = await getCachedIndicatorData('EURUSD', 'H1', 1000);

      expect(cached1).toEqual(data1);
      expect(cached2).toEqual(data2);
    });

    it('should generate different keys for different timeframes', async () => {
      const data1 = { timeframe: 'M5' };
      const data2 = { timeframe: 'H1' };

      await setCachedIndicatorData('XAUUSD', 'M5', data1, 1000);
      await setCachedIndicatorData('XAUUSD', 'H1', data2, 1000);

      const cached1 = await getCachedIndicatorData('XAUUSD', 'M5', 1000);
      const cached2 = await getCachedIndicatorData('XAUUSD', 'H1', 1000);

      expect(cached1).toEqual(data1);
      expect(cached2).toEqual(data2);
    });

    it('should generate different keys for different bars', async () => {
      const data1 = { bars: 500 };
      const data2 = { bars: 1000 };

      await setCachedIndicatorData('XAUUSD', 'H1', data1, 500);
      await setCachedIndicatorData('XAUUSD', 'H1', data2, 1000);

      const cached1 = await getCachedIndicatorData('XAUUSD', 'H1', 500);
      const cached2 = await getCachedIndicatorData('XAUUSD', 'H1', 1000);

      expect(cached1).toEqual(data1);
      expect(cached2).toEqual(data2);
    });

    it('should handle optional bars parameter', async () => {
      const dataWithBars = { bars: 'with' };
      const dataWithoutBars = { bars: 'without' };

      await setCachedIndicatorData('XAUUSD', 'H1', dataWithBars, 1000);
      await setCachedIndicatorData('XAUUSD', 'H1', dataWithoutBars);

      const cached1 = await getCachedIndicatorData('XAUUSD', 'H1', 1000);
      const cached2 = await getCachedIndicatorData('XAUUSD', 'H1');

      expect(cached1).toEqual(dataWithBars);
      expect(cached2).toEqual(dataWithoutBars);
    });
  });

  describe('Integration with Part 0 Constants', () => {
    it('should respect CACHE_TTL values from Part 0', () => {
      // Verify CACHE_TTL is imported and has expected values
      expect(CACHE_TTL.M5).toBe(300); // 5 minutes
      expect(CACHE_TTL.M15).toBe(900); // 15 minutes
      expect(CACHE_TTL.M30).toBe(1800); // 30 minutes
      expect(CACHE_TTL.H1).toBe(3600); // 1 hour
      expect(CACHE_TTL.H2).toBe(7200); // 2 hours
      expect(CACHE_TTL.H4).toBe(14400); // 4 hours
      expect(CACHE_TTL.H8).toBe(28800); // 8 hours
      expect(CACHE_TTL.H12).toBe(43200); // 12 hours
      expect(CACHE_TTL.D1).toBe(86400); // 24 hours
    });
  });
});
```

---

## ✅ Validation Steps

### Step 1: Verify File Creation

```bash
# Check that test file was created
ls -la __tests__/lib/cache/indicator-cache.test.ts

# Expected output:
# -rw-r--r--  1 user  staff  ~20000-25000  __tests__/lib/cache/indicator-cache.test.ts
```

### Step 2: Run the New Tests

```bash
# Run only the new cache tests
npm test -- indicator-cache.test.ts

# Expected output:
# PASS __tests__/lib/cache/indicator-cache.test.ts
#   Indicator Cache Utility
#     Cache Operations
#       setCachedIndicatorData
#         ✓ should store data in cache
#         ✓ should handle different symbols
#         ... (all tests passing)
#
# Test Suites: 1 passed, 1 total
# Tests:       XX passed, XX total (should be ~50+ tests)
```

### Step 3: Run Full Test Suite

**CRITICAL**: All tests must pass (existing + new)

```bash
npm test

# Expected: All existing tests + new cache tests pass
# Test Suites: 109 passed, 109 total (was 108, now +1)
# Tests:       2350+ passed (was 2307, now +40-50 more)
```

### Step 4: Verify No Files Were Modified

```bash
git status

# Expected output should show ONLY:
# Untracked files:
#   __tests__/lib/cache/indicator-cache.test.ts
#
# Modified files from Part 1.1:
#   lib/cache/indicator-cache.ts (already committed)
#
# NO other modified files!
```

### Step 5: Check Test Coverage (Optional)

```bash
# Run tests with coverage for cache utility
npm test -- indicator-cache.test.ts --coverage

# Should show high coverage for lib/cache/indicator-cache.ts
# Expected: >90% coverage
```

---

## 🎯 Success Criteria

### Must Have:

- ✅ File created: `__tests__/lib/cache/indicator-cache.test.ts`
- ✅ All new cache tests pass (50+ tests)
- ✅ All existing tests still pass (2307 tests)
- ✅ No existing files modified
- ✅ Test coverage is comprehensive

### Test Coverage:

- ✅ Cache operations: get, set, delete, exists
- ✅ Symbol invalidation
- ✅ Full cache invalidation
- ✅ Statistics tracking (hits, misses, sets, deletes, hit rate)
- ✅ Cache size tracking
- ✅ TTL behavior for all 9 timeframes from Part 0
- ✅ Cache key generation
- ✅ Case normalization
- ✅ Error handling
- ✅ Edge cases (empty values, complex objects)

### Quality Checks:

- ✅ Tests use descriptive names
- ✅ Tests are isolated (use beforeEach to reset state)
- ✅ Tests verify both positive and negative cases
- ✅ Tests use Part 0 constants (CACHE_TTL)
- ✅ Tests follow Jest best practices

---

## 🚫 Constraints

### DO NOT:

- ❌ Modify the cache utility itself (`lib/cache/indicator-cache.ts`)
- ❌ Modify any existing test files
- ❌ Modify any API routes
- ❌ Change test configurations (jest.config.js)
- ❌ Modify any other source files

### DO:

- ✅ Create exactly ONE new file: `__tests__/lib/cache/indicator-cache.test.ts`
- ✅ Test all public functions
- ✅ Use Part 0 constants in tests
- ✅ Follow Jest conventions
- ✅ Ensure all tests pass
- ✅ Add comprehensive coverage

---

## 📝 Commit Message

After verification, commit with:

```bash
git add __tests__/lib/cache/indicator-cache.test.ts

git commit -m "test(phase4): Part 1.2 - add cache utility unit tests

- Create comprehensive test suite for cache utility
- Test all cache operations (get, set, delete, exists)
- Test symbol and full cache invalidation
- Test statistics tracking (hits, misses, sets, deletes)
- Test TTL behavior with all 9 Part 0 timeframes
- Test cache key generation and normalization
- Test error handling and edge cases
- 50+ test cases with high coverage

All tests passing:
- New cache tests: ~50+ passing
- Existing tests: 2307 still passing
- Total: 2350+ tests passing"
```

---

## 📊 Test Statistics

### Expected Test Count by Category:

- **Cache Operations**: ~20 tests
  - setCachedIndicatorData: 5 tests
  - getCachedIndicatorData: 4 tests
  - hasCachedData: 2 tests
  - invalidateCachedData: 2 tests
  - invalidateSymbolCache: 2 tests
  - clearAllCache: 1 test

- **TTL Behavior**: ~6 tests
  - Timeframe-specific TTL tests
  - Default TTL test

- **Statistics**: ~9 tests
  - Hit tracking, miss tracking
  - Set tracking, delete tracking
  - Hit rate calculation
  - Statistics reset

- **Cache Size**: ~3 tests

- **Error Handling**: ~3 tests

- **Cache Key Generation**: ~6 tests

- **Part 0 Integration**: ~1 test

**Total**: ~48 tests for cache utility

---

## 🎯 Next Steps

After Part 1.2 is complete and committed:

1. ✅ Verify test file created
2. ✅ Verify all new tests pass (~50+ tests)
3. ✅ Verify all existing tests still pass (2307 tests)
4. ✅ Commit changes
5. ✅ Return to user for Part 1.3 prompt
6. ⏭️ **Part 1.3** will integrate cache with indicators API (minimal, careful)
7. ⏭️ Part 1.4 will add cache write on success
8. ⏭️ Part 1.5 will add response metadata

---

## 💡 Tips for Claude Code

1. **Create the test file exactly as specified** - All code is provided
2. **Run the new tests first** - Verify they pass in isolation
3. **Then run full suite** - Ensure nothing broke
4. **Check test count** - Should be 2307 + ~50 = 2350+
5. **Don't modify cache utility** - Only test it, don't change it
6. **Document any failures** - If tests fail, report which ones

**Remember**: We're testing the utility we built in Part 1.1. The utility shouldn't change, only the tests are new.

Success looks like: One new test file, 50+ new passing tests, all old tests still pass! 🎯
