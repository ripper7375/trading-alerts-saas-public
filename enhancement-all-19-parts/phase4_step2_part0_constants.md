# Phase 4 Part 0: Business Constants Foundation

**Project**: Trading Alerts SaaS V7  
**Phase**: 4 of 6 - Business Logic & APIs  
**Part**: 0 of 4 - Foundation Layer  
**Priority**: 🟢 HIGH - Prerequisites for all Phase 4 features  
**Estimated Time**: 30 minutes  
**Dependencies**: None (this IS the foundation)

---

## 🎯 Objective

Create a **single source of truth** for all business rules and constants that will be used across:

- Part 1: Caching layer
- Part 2: Rate limiting
- Part 3: Indicator filtering
- Part 4: Comprehensive tests

**Goal**: Prevent hardcoded values scattered across the codebase and ensure consistency between frontend, backend, and tests.

---

## ✅ Prerequisites Check

Before starting, verify:

```bash
# All tests should be passing
npm test

# Expected output:
# Test Suites: 108 passed, 108 total
# Tests:       2307 passed, 2307 total
```

**If any tests fail, STOP and fix them first.**

---

## 📋 Business Requirements

### Tier System

- **FREE Tier**: $0/month
  - Access to 5 symbols (XAUUSD, BTCUSD, EURUSD, USDJPY, US30)
  - All 9 timeframes
  - 2 basic indicators (fractals, trendlines)
  - 60 API requests per hour
- **PRO Tier**: $29/month (or $290/year)
  - Access to ALL 15 symbols
  - All 9 timeframes
  - 8 total indicators (all basic + 6 PRO-only)
  - 300 API requests per hour

### Symbols (15 Total)

**FREE Tier** (5 symbols):

- `XAUUSD` (Gold) - Primary symbol
- `BTCUSD` (Bitcoin)
- `EURUSD` (Euro/USD)
- `USDJPY` (USD/Yen)
- `US30` (Dow Jones)

**PRO Tier Additional** (10 symbols):

- `AUDJPY` (Aussie/Yen)
- `AUDUSD` (Aussie/USD)
- `ETHUSD` (Ethereum)
- `GBPJPY` (Pound/Yen)
- `GBPUSD` (Pound/USD)
- `NDX100` (Nasdaq 100)
- `NZDUSD` (Kiwi/USD)
- `USDCAD` (USD/Canadian)
- `USDCHF` (USD/Swiss)
- `XAGUSD` (Silver)

### Timeframes (9 Total)

**Intraday Short**:

- `M5` (5 minutes)
- `M15` (15 minutes)
- `M30` (30 minutes)

**Intraday Medium**:

- `H1` (1 hour)
- `H2` (2 hours)
- `H4` (4 hours)
- `H8` (8 hours)
- `H12` (12 hours)

**Daily**:

- `D1` (1 day)

**⚠️ CRITICAL**: NO M1 (1 minute) or W1 (1 week) - these are NOT supported!

### Indicators (8 Total)

**Basic Indicators** (FREE tier):

- `fractals` - Price fractals for support/resistance
- `trendlines` - Automatic trendline detection

**PRO-Only Indicators** (6 additional):

- `momentum_candles` - Momentum-colored candles
- `keltner_channels` - Keltner Channel bands
- `tema` - Triple Exponential Moving Average
- `hrma` - Hull Moving Average
- `smma` - Smoothed Moving Average
- `zigzag` - ZigZag pattern detection

### Rate Limits

- **FREE Tier**: 60 requests per hour
- **PRO Tier**: 300 requests per hour

### Cache TTL (Time-to-Live)

Cache duration should match timeframe granularity:

- `M5`: 300 seconds (5 minutes)
- `M15`: 900 seconds (15 minutes)
- `M30`: 1800 seconds (30 minutes)
- `H1`: 3600 seconds (1 hour)
- `H2`: 7200 seconds (2 hours)
- `H4`: 14400 seconds (4 hours)
- `H8`: 28800 seconds (8 hours)
- `H12`: 43200 seconds (12 hours)
- `D1`: 86400 seconds (1 day)

---

## 🏗️ Implementation Tasks

### Task 1: Create Business Constants Module

**File**: `lib/constants/business-rules.ts`

Create a new file with the following structure:

```typescript
/**
 * Business Rules and Constants
 *
 * Single source of truth for Trading Alerts SaaS V7
 *
 * Dependencies:
 * - Part 1 (Caching): Uses CACHE_TTL
 * - Part 2 (Rate Limiting): Uses RATE_LIMITS, TIER_CONFIG
 * - Part 3 (Indicator Filtering): Uses INDICATORS, SYMBOLS_BY_TIER
 * - Part 4 (Tests): Validates all constants
 */

// ============================================================================
// TIER SYSTEM
// ============================================================================

export const TIERS = ['FREE', 'PRO'] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_CONFIG = {
  FREE: {
    name: 'Free',
    price: 0,
    symbolCount: 5,
    indicatorCount: 2,
    requestsPerHour: 60,
  },
  PRO: {
    name: 'Pro',
    monthlyPrice: 29,
    yearlyPrice: 290,
    symbolCount: 15,
    indicatorCount: 8,
    requestsPerHour: 300,
    trialDays: 7,
  },
} as const;

// ============================================================================
// SYMBOLS
// ============================================================================

/**
 * FREE tier symbols (5 total)
 * All users have access to these
 */
export const FREE_SYMBOLS = [
  'XAUUSD', // Gold - Primary symbol
  'BTCUSD', // Bitcoin
  'EURUSD', // Euro/USD
  'USDJPY', // USD/Yen
  'US30', // Dow Jones
] as const;

/**
 * PRO tier exclusive symbols (10 additional)
 * Only PRO tier users can access these
 */
export const PRO_SYMBOLS = [
  'AUDJPY', // Aussie/Yen
  'AUDUSD', // Aussie/USD
  'ETHUSD', // Ethereum
  'GBPJPY', // Pound/Yen
  'GBPUSD', // Pound/USD
  'NDX100', // Nasdaq 100
  'NZDUSD', // Kiwi/USD
  'USDCAD', // USD/Canadian
  'USDCHF', // USD/Swiss
  'XAGUSD', // Silver
] as const;

/**
 * All valid symbols (15 total)
 */
export const VALID_SYMBOLS = [...FREE_SYMBOLS, ...PRO_SYMBOLS] as const;

export type Symbol = (typeof VALID_SYMBOLS)[number];
export type FreeSymbol = (typeof FREE_SYMBOLS)[number];
export type ProSymbol = (typeof PRO_SYMBOLS)[number];

/**
 * Get accessible symbols for a tier
 */
export const SYMBOLS_BY_TIER: Record<Tier, readonly string[]> = {
  FREE: FREE_SYMBOLS,
  PRO: VALID_SYMBOLS,
} as const;

// ============================================================================
// TIMEFRAMES
// ============================================================================

/**
 * Valid timeframes (9 total)
 *
 * IMPORTANT: M1 (1 minute) and W1 (1 week) are NOT supported
 */
export const VALID_TIMEFRAMES = [
  'M5', // 5 minutes
  'M15', // 15 minutes
  'M30', // 30 minutes
  'H1', // 1 hour
  'H2', // 2 hours
  'H4', // 4 hours
  'H8', // 8 hours
  'H12', // 12 hours
  'D1', // 1 day
] as const;

export type Timeframe = (typeof VALID_TIMEFRAMES)[number];

/**
 * Timeframe display names
 */
export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  M5: '5 Minutes',
  M15: '15 Minutes',
  M30: '30 Minutes',
  H1: '1 Hour',
  H2: '2 Hours',
  H4: '4 Hours',
  H8: '8 Hours',
  H12: '12 Hours',
  D1: '1 Day',
} as const;

// ============================================================================
// INDICATORS
// ============================================================================

/**
 * Basic indicators (2 total)
 * Available to FREE tier
 */
export const BASIC_INDICATORS = ['fractals', 'trendlines'] as const;

/**
 * PRO-only indicators (6 additional)
 * Requires PRO tier subscription
 */
export const PRO_INDICATORS = [
  'momentum_candles',
  'keltner_channels',
  'tema',
  'hrma',
  'smma',
  'zigzag',
] as const;

/**
 * All indicators (8 total)
 */
export const ALL_INDICATORS = [...BASIC_INDICATORS, ...PRO_INDICATORS] as const;

export type Indicator = (typeof ALL_INDICATORS)[number];
export type BasicIndicator = (typeof BASIC_INDICATORS)[number];
export type ProIndicator = (typeof PRO_INDICATORS)[number];

/**
 * Indicator display names and descriptions
 */
export const INDICATOR_INFO: Record<
  Indicator,
  { name: string; description: string }
> = {
  fractals: {
    name: 'Fractals',
    description: 'Identifies key support and resistance levels',
  },
  trendlines: {
    name: 'Trendlines',
    description: 'Automatic trendline detection',
  },
  momentum_candles: {
    name: 'Momentum Candles',
    description: 'Candles colored by momentum strength',
  },
  keltner_channels: {
    name: 'Keltner Channels',
    description: 'Volatility-based trading bands',
  },
  tema: {
    name: 'TEMA',
    description: 'Triple Exponential Moving Average',
  },
  hrma: {
    name: 'HRMA',
    description: 'Hull Moving Average for trend detection',
  },
  smma: {
    name: 'SMMA',
    description: 'Smoothed Moving Average',
  },
  zigzag: {
    name: 'ZigZag',
    description: 'Filters out market noise to show trends',
  },
} as const;

/**
 * Get accessible indicators for a tier
 */
export const INDICATORS_BY_TIER: Record<Tier, readonly Indicator[]> = {
  FREE: BASIC_INDICATORS,
  PRO: ALL_INDICATORS,
} as const;

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Rate limit configuration by tier
 * Window is always 1 hour (3600 seconds)
 */
export const RATE_LIMITS = {
  FREE: {
    requests: 60,
    window: 3600, // 1 hour in seconds
    windowLabel: 'hour',
  },
  PRO: {
    requests: 300,
    window: 3600, // 1 hour in seconds
    windowLabel: 'hour',
  },
} as const;

// ============================================================================
// CACHING
// ============================================================================

/**
 * Cache TTL (Time-to-Live) by timeframe in seconds
 *
 * Cache duration matches timeframe granularity
 * Shorter timeframes = shorter cache, longer timeframes = longer cache
 */
export const CACHE_TTL: Record<Timeframe, number> = {
  M5: 300, // 5 minutes
  M15: 900, // 15 minutes
  M30: 1800, // 30 minutes
  H1: 3600, // 1 hour
  H2: 7200, // 2 hours
  H4: 14400, // 4 hours
  H8: 28800, // 8 hours
  H12: 43200, // 12 hours
  D1: 86400, // 24 hours (1 day)
} as const;

/**
 * Default cache TTL for unknown timeframes
 */
export const DEFAULT_CACHE_TTL = 3600; // 1 hour

// ============================================================================
// HTTP STATUS CODES
// ============================================================================

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// ============================================================================
// ERROR MESSAGES
// ============================================================================

export const ERROR_MESSAGES = {
  // Symbol errors
  INVALID_SYMBOL: 'Invalid symbol',
  SYMBOL_REQUIRES_PRO: 'Symbol requires PRO tier',

  // Timeframe errors
  INVALID_TIMEFRAME: 'Invalid timeframe',
  TIMEFRAME_NOT_SUPPORTED: 'Timeframe not supported',

  // Indicator errors
  INVALID_INDICATOR: 'Invalid indicator',
  INDICATOR_REQUIRES_PRO: 'Indicator requires PRO tier',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',

  // Service errors
  MT5_SERVICE_ERROR: 'MT5 service error',
  INTERNAL_SERVER_ERROR: 'Internal server error',

  // Auth errors
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
} as const;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Check if a symbol is valid
 */
export function isValidSymbol(symbol: string): symbol is Symbol {
  return VALID_SYMBOLS.includes(symbol.toUpperCase() as Symbol);
}

/**
 * Check if a timeframe is valid
 */
export function isValidTimeframe(timeframe: string): timeframe is Timeframe {
  return VALID_TIMEFRAMES.includes(timeframe.toUpperCase() as Timeframe);
}

/**
 * Check if an indicator is valid
 */
export function isValidIndicator(indicator: string): indicator is Indicator {
  return ALL_INDICATORS.includes(indicator.toLowerCase() as Indicator);
}

/**
 * Check if a symbol is accessible for a tier
 */
export function canAccessSymbol(symbol: string, tier: Tier): boolean {
  const upperSymbol = symbol.toUpperCase();
  if (!isValidSymbol(upperSymbol)) return false;

  if (tier === 'PRO') return true;
  return FREE_SYMBOLS.includes(upperSymbol as FreeSymbol);
}

/**
 * Check if an indicator is accessible for a tier
 */
export function canAccessIndicator(indicator: string, tier: Tier): boolean {
  const lowerIndicator = indicator.toLowerCase();
  if (!isValidIndicator(lowerIndicator)) return false;

  if (tier === 'PRO') return true;
  return BASIC_INDICATORS.includes(lowerIndicator as BasicIndicator);
}

/**
 * Get upgrade message for a locked resource
 */
export function getUpgradeMessage(
  resourceType: 'symbol' | 'indicator',
  resourceName: string
): string {
  return `${resourceName} requires PRO tier. Upgrade for $29/month with 7-day free trial.`;
}
```

---

## ✅ Validation Steps

After creating the file, run these checks:

### 1. TypeScript Compilation

```bash
npm run build
# Should complete without errors
```

### 2. Type Checking

```bash
npx tsc --noEmit
# Should show no type errors
```

### 3. Import Test

Create a simple test file to verify imports work:

```typescript
// test-imports.ts (temporary file)
import {
  VALID_SYMBOLS,
  VALID_TIMEFRAMES,
  ALL_INDICATORS,
  RATE_LIMITS,
  CACHE_TTL,
  canAccessSymbol,
  canAccessIndicator,
} from '@/lib/constants/business-rules';

console.log('Symbols:', VALID_SYMBOLS.length); // Should be 15
console.log('Timeframes:', VALID_TIMEFRAMES.length); // Should be 9
console.log('Indicators:', ALL_INDICATORS.length); // Should be 8
console.log('FREE rate limit:', RATE_LIMITS.FREE.requests); // Should be 60
console.log('PRO rate limit:', RATE_LIMITS.PRO.requests); // Should be 300

// Test validation helpers
console.log('XAUUSD valid?', canAccessSymbol('XAUUSD', 'FREE')); // Should be true
console.log('GBPUSD valid for FREE?', canAccessSymbol('GBPUSD', 'FREE')); // Should be false
console.log('GBPUSD valid for PRO?', canAccessSymbol('GBPUSD', 'PRO')); // Should be true
console.log('fractals valid for FREE?', canAccessIndicator('fractals', 'FREE')); // Should be true
console.log('zigzag valid for FREE?', canAccessIndicator('zigzag', 'FREE')); // Should be false

// Delete this file after verification
```

Run it:

```bash
npx tsx test-imports.ts
# Should output correct values
# Then delete the file: rm test-imports.ts
```

### 4. Run Existing Tests

```bash
npm test
# All 2307 tests should still pass
```

---

## 🎯 Success Criteria

### Must Have:

- ✅ File created at `lib/constants/business-rules.ts`
- ✅ All constants properly exported with TypeScript types
- ✅ 15 symbols (5 FREE + 10 PRO)
- ✅ 9 timeframes (NO M1 or W1)
- ✅ 8 indicators (2 basic + 6 PRO)
- ✅ Rate limits: 60 FREE, 300 PRO
- ✅ Cache TTL includes all 9 timeframes
- ✅ Validation helpers implemented
- ✅ TypeScript compilation succeeds
- ✅ All existing tests still pass

### Quality Checks:

- ✅ Code is well-documented with JSDoc comments
- ✅ Constants use `as const` for type safety
- ✅ Type definitions are exported
- ✅ No hardcoded values (everything is a named constant)
- ✅ Helper functions have clear return types

---

## 🔗 Dependencies for Next Parts

Once Part 0 is complete, these parts can proceed:

### Part 1: Caching (depends on Part 0)

Will use:

- `CACHE_TTL` - For TTL values
- `VALID_TIMEFRAMES` - For validation
- `isValidTimeframe()` - For checking timeframes

### Part 2: Rate Limiting (depends on Part 0)

Will use:

- `RATE_LIMITS` - For tier limits
- `TIER_CONFIG` - For tier information
- `Tier` type - For typing

### Part 3: Indicator Filtering (depends on Part 0)

Will use:

- `INDICATORS_BY_TIER` - For filtering
- `canAccessIndicator()` - For validation
- `canAccessSymbol()` - For symbol validation
- `getUpgradeMessage()` - For upgrade prompts

### Part 4: Tests (depends on Parts 0-3)

Will use:

- All constants for test data
- All validation helpers for test assertions

---

## 🚫 Constraints

### DO NOT:

- ❌ Add M1 or W1 timeframes
- ❌ Add more than 15 symbols
- ❌ Change the FREE tier symbol count (must be 5)
- ❌ Change rate limits (60 FREE, 300 PRO)
- ❌ Add logic beyond constants and simple helpers
- ❌ Create separate files for each constant type (keep in one file)

### DO:

- ✅ Use TypeScript const assertions (`as const`)
- ✅ Export all types and constants
- ✅ Add comprehensive JSDoc comments
- ✅ Keep validation helpers simple
- ✅ Ensure type safety throughout

---

## 📝 Commit Message

After verification, commit with:

```bash
git add lib/constants/business-rules.ts
git commit -m "feat(phase4): add business rules constants foundation

- Add 15 valid symbols (5 FREE, 10 PRO)
- Add 9 valid timeframes (M5-D1, no M1/W1)
- Add 8 indicators (2 basic, 6 PRO)
- Add rate limits (60 FREE, 300 PRO)
- Add cache TTL mappings
- Add validation helpers
- Single source of truth for Phase 4 Parts 1-4"
```

---

## 🎯 Next Steps

After Part 0 is complete and committed:

1. ✅ Verify all tests pass
2. ✅ Verify TypeScript compiles
3. ✅ Return to user for Part 1 prompt
4. ⏭️ Part 1 will implement caching using these constants
5. ⏭️ Part 2 will implement rate limiting using these constants
6. ⏭️ Part 3 will implement indicator filtering using these constants
7. ⏭️ Part 4 will test everything together

---

## 📊 Estimated Impact

**Files Created**: 1  
**Lines of Code**: ~350-400  
**Dependencies Created**: Foundation for Parts 1-4  
**Risk Level**: LOW (constants only, no logic changes)  
**Test Impact**: None (all existing tests should still pass)

---

## 💡 Tips for Claude Code

1. **Create the file first** - Don't modify existing files yet
2. **Use TypeScript strict mode** - Ensure types are correct
3. **Test imports** - Verify the constants can be imported
4. **Keep it organized** - Use section comments to group related constants
5. **Document everything** - Future developers (and Parts 1-4) will thank you

This is the foundation for all Phase 4 work. Take time to get it right! 🏗️
