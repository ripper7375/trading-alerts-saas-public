/**
 * Tier Validation for Symbol and Timeframe Access
 *
 * Part 20 SQLite + PostgreSQL Architecture
 *
 * This module handles tier-based access control for symbols and timeframes.
 * - FREE tier: 5 symbols × 3 timeframes
 * - PRO tier: 15 symbols × 9 timeframes
 *
 * @module lib/tier/validation
 */

// ============================================
// ALL SYMBOLS (15 total)
// ============================================

export const ALL_SYMBOLS = [
  'AUDJPY',
  'AUDUSD',
  'BTCUSD',
  'ETHUSD',
  'EURUSD',
  'GBPJPY',
  'GBPUSD',
  'NDX100',
  'NZDUSD',
  'US30',
  'USDCAD',
  'USDCHF',
  'USDJPY',
  'XAGUSD',
  'XAUUSD',
] as const;

// ============================================
// ALL TIMEFRAMES (9 total)
// ============================================

export const ALL_TIMEFRAMES = [
  'M5',
  'M15',
  'M30',
  'H1',
  'H2',
  'H4',
  'H8',
  'H12',
  'D1',
] as const;

// ============================================
// FREE TIER ACCESS (5 symbols × 3 timeframes)
// ============================================

export const FREE_SYMBOLS = [
  'BTCUSD',
  'EURUSD',
  'USDJPY',
  'US30',
  'XAUUSD',
] as const;

export const FREE_TIMEFRAMES = ['H1', 'H4', 'D1'] as const;

// ============================================
// TYPE DEFINITIONS
// ============================================

export type Symbol = (typeof ALL_SYMBOLS)[number];
export type Timeframe = (typeof ALL_TIMEFRAMES)[number];
export type FreeSymbol = (typeof FREE_SYMBOLS)[number];
export type FreeTimeframe = (typeof FREE_TIMEFRAMES)[number];
export type Tier = 'FREE' | 'PRO';

/**
 * Result of tier access validation
 */
export interface TierAccessResult {
  allowed: boolean;
  message: string;
}

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Validate tier access for a symbol/timeframe combination
 *
 * @param symbol - Trading symbol to check
 * @param timeframe - Chart timeframe to check
 * @param tier - User tier (FREE or PRO)
 * @returns Validation result with allowed flag and message
 *
 * @example
 * ```typescript
 * validateTierAccess('EURUSD', 'H1', 'FREE');  // { allowed: true, message: 'FREE tier access granted' }
 * validateTierAccess('AUDJPY', 'H1', 'FREE'); // { allowed: false, message: 'Symbol AUDJPY requires PRO tier...' }
 * validateTierAccess('EURUSD', 'M5', 'FREE'); // { allowed: false, message: 'Timeframe M5 requires PRO tier...' }
 * validateTierAccess('AUDJPY', 'M5', 'PRO');  // { allowed: true, message: 'PRO tier access granted' }
 * ```
 */
export function validateTierAccess(
  symbol: string,
  timeframe: string,
  tier: Tier
): TierAccessResult {
  const upperSymbol = symbol.toUpperCase();
  const upperTimeframe = timeframe.toUpperCase();

  // Validate symbol exists
  if (!ALL_SYMBOLS.includes(upperSymbol as Symbol)) {
    return { allowed: false, message: `Invalid symbol: ${symbol}` };
  }

  // Validate timeframe exists
  if (!ALL_TIMEFRAMES.includes(upperTimeframe as Timeframe)) {
    return { allowed: false, message: `Invalid timeframe: ${timeframe}` };
  }

  // PRO tier has access to everything
  if (tier === 'PRO') {
    return { allowed: true, message: 'PRO tier access granted' };
  }

  // FREE tier restrictions
  const symbolAllowed = FREE_SYMBOLS.includes(upperSymbol as FreeSymbol);
  const timeframeAllowed = FREE_TIMEFRAMES.includes(
    upperTimeframe as FreeTimeframe
  );

  if (!symbolAllowed) {
    return {
      allowed: false,
      message: `Symbol ${symbol} requires PRO tier. FREE tier symbols: ${FREE_SYMBOLS.join(', ')}`,
    };
  }

  if (!timeframeAllowed) {
    return {
      allowed: false,
      message: `Timeframe ${timeframe} requires PRO tier. FREE tier timeframes: ${FREE_TIMEFRAMES.join(', ')}`,
    };
  }

  return { allowed: true, message: 'FREE tier access granted' };
}

// ============================================
// SYMBOL ACCESS FUNCTIONS
// ============================================

/**
 * Get all symbols accessible by a tier
 *
 * @param tier - User tier (FREE or PRO)
 * @returns Array of accessible symbol strings
 */
export function getAccessibleSymbols(tier: Tier): readonly string[] {
  return tier === 'PRO' ? ALL_SYMBOLS : FREE_SYMBOLS;
}

/**
 * Check if a symbol is valid (exists in the system)
 *
 * @param symbol - Symbol string to validate
 * @returns true if symbol is valid
 */
export function isValidSymbol(symbol: string): boolean {
  return ALL_SYMBOLS.includes(symbol.toUpperCase() as Symbol);
}

/**
 * Check if a symbol is FREE tier accessible
 *
 * @param symbol - Symbol string to check
 * @returns true if symbol is accessible on FREE tier
 */
export function isFreeSymbol(symbol: string): boolean {
  return FREE_SYMBOLS.includes(symbol.toUpperCase() as FreeSymbol);
}

// ============================================
// TIMEFRAME ACCESS FUNCTIONS
// ============================================

/**
 * Get all timeframes accessible by a tier
 *
 * @param tier - User tier (FREE or PRO)
 * @returns Array of accessible timeframe strings
 */
export function getAccessibleTimeframes(tier: Tier): readonly string[] {
  return tier === 'PRO' ? ALL_TIMEFRAMES : FREE_TIMEFRAMES;
}

/**
 * Check if a timeframe is valid (exists in the system)
 *
 * @param timeframe - Timeframe string to validate
 * @returns true if timeframe is valid
 */
export function isValidTimeframe(timeframe: string): boolean {
  return ALL_TIMEFRAMES.includes(timeframe.toUpperCase() as Timeframe);
}

/**
 * Check if a timeframe is FREE tier accessible
 *
 * @param timeframe - Timeframe string to check
 * @returns true if timeframe is accessible on FREE tier
 */
export function isFreeTimeframe(timeframe: string): boolean {
  return FREE_TIMEFRAMES.includes(timeframe.toUpperCase() as FreeTimeframe);
}

// ============================================
// COMBINED ACCESS FUNCTIONS
// ============================================

/**
 * Get count of accessible combinations for a tier
 *
 * @param tier - User tier
 * @returns Number of symbol/timeframe combinations accessible
 */
export function getAccessibleCombinationCount(tier: Tier): number {
  const symbols = getAccessibleSymbols(tier);
  const timeframes = getAccessibleTimeframes(tier);
  return symbols.length * timeframes.length;
}

/**
 * Get detailed tier access info for API response
 *
 * @param tier - User tier
 * @returns Object with accessible symbols, timeframes, and counts
 */
export function getTierAccessInfo(tier: Tier): {
  tier: Tier;
  symbols: readonly string[];
  timeframes: readonly string[];
  symbolCount: number;
  timeframeCount: number;
  totalCombinations: number;
} {
  const symbols = getAccessibleSymbols(tier);
  const timeframes = getAccessibleTimeframes(tier);

  return {
    tier,
    symbols,
    timeframes,
    symbolCount: symbols.length,
    timeframeCount: timeframes.length,
    totalCombinations: symbols.length * timeframes.length,
  };
}
