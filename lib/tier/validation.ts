/**
 * Tier Validation for Part 20
 *
 * Provides tier-based access control for symbols and timeframes.
 * Part 20 - Phase 04: Next.js API Routes
 *
 * @module lib/tier/validation
 */

import type { Tier } from '@/lib/tier-config';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FREE TIER CONSTANTS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * FREE tier symbols (5 total)
 * Based on OpenAPI spec and tier specifications
 */
export const FREE_SYMBOLS = [
  'BTCUSD',
  'EURUSD',
  'USDJPY',
  'US30',
  'XAUUSD',
] as const;

/**
 * FREE tier timeframes (3 total)
 */
export const FREE_TIMEFRAMES = ['H1', 'H4', 'D1'] as const;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PRO TIER CONSTANTS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * PRO tier symbols (15 total)
 */
export const PRO_SYMBOLS = [
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

/**
 * PRO tier timeframes (9 total)
 */
export const PRO_TIMEFRAMES = [
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

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ALL VALID CONSTANTS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * All valid symbols (same as PRO symbols)
 */
export const VALID_SYMBOLS = PRO_SYMBOLS;

/**
 * All valid timeframes (same as PRO timeframes)
 */
export const VALID_TIMEFRAMES = PRO_TIMEFRAMES;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPE DEFINITIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type Symbol = (typeof PRO_SYMBOLS)[number];
export type Timeframe = (typeof PRO_TIMEFRAMES)[number];

/**
 * Tier access validation result
 */
export interface TierAccessResult {
  allowed: boolean;
  message: string;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Check if a symbol is valid (exists in system)
 */
export function isValidSymbol(symbol: string): boolean {
  return VALID_SYMBOLS.includes(symbol.toUpperCase() as Symbol);
}

/**
 * Check if a timeframe is valid (exists in system)
 */
export function isValidTimeframe(timeframe: string): boolean {
  return VALID_TIMEFRAMES.includes(timeframe.toUpperCase() as Timeframe);
}

/**
 * Validate tier access to symbol and timeframe combination
 *
 * @param symbol - Trading symbol
 * @param timeframe - Chart timeframe
 * @param tier - User tier (FREE or PRO)
 * @returns Validation result with allowed flag and message
 *
 * @example
 * const result = validateTierAccess('EURUSD', 'H1', 'FREE');
 * // { allowed: true, message: 'Access granted' }
 *
 * const result = validateTierAccess('AUDJPY', 'H1', 'FREE');
 * // { allowed: false, message: 'FREE tier cannot access AUDJPY...' }
 */
export function validateTierAccess(
  symbol: string,
  timeframe: string,
  tier: Tier
): TierAccessResult {
  const upperSymbol = symbol.toUpperCase();
  const upperTimeframe = timeframe.toUpperCase();

  // PRO tier has access to everything
  if (tier === 'PRO') {
    return {
      allowed: true,
      message: 'Access granted',
    };
  }

  // Check FREE tier symbol access
  const symbolAllowed = (FREE_SYMBOLS as readonly string[]).includes(
    upperSymbol
  );
  if (!symbolAllowed) {
    return {
      allowed: false,
      message: `FREE tier cannot access ${upperSymbol}. Upgrade to PRO for access to all 15 symbols.`,
    };
  }

  // Check FREE tier timeframe access
  const timeframeAllowed = (FREE_TIMEFRAMES as readonly string[]).includes(
    upperTimeframe
  );
  if (!timeframeAllowed) {
    return {
      allowed: false,
      message: `FREE tier cannot access ${upperTimeframe} timeframe. Upgrade to PRO for access to all 9 timeframes.`,
    };
  }

  return {
    allowed: true,
    message: 'Access granted',
  };
}

/**
 * Get accessible symbols for a tier
 *
 * @param tier - User tier
 * @returns Array of accessible symbol strings
 */
export function getAccessibleSymbols(tier: Tier): readonly string[] {
  if (tier === 'PRO') {
    return PRO_SYMBOLS;
  }
  return FREE_SYMBOLS;
}

/**
 * Get accessible timeframes for a tier
 *
 * @param tier - User tier
 * @returns Array of accessible timeframe strings
 */
export function getAccessibleTimeframes(tier: Tier): readonly string[] {
  if (tier === 'PRO') {
    return PRO_TIMEFRAMES;
  }
  return FREE_TIMEFRAMES;
}

/**
 * Check if tier can access a specific symbol
 *
 * @param symbol - Symbol to check
 * @param tier - User tier
 * @returns True if tier can access the symbol
 */
export function canAccessSymbol(symbol: string, tier: Tier): boolean {
  const upperSymbol = symbol.toUpperCase();

  if (tier === 'PRO') {
    return (PRO_SYMBOLS as readonly string[]).includes(upperSymbol);
  }

  return (FREE_SYMBOLS as readonly string[]).includes(upperSymbol);
}

/**
 * Check if tier can access a specific timeframe
 *
 * @param timeframe - Timeframe to check
 * @param tier - User tier
 * @returns True if tier can access the timeframe
 */
export function canAccessTimeframe(timeframe: string, tier: Tier): boolean {
  const upperTimeframe = timeframe.toUpperCase();

  if (tier === 'PRO') {
    return (PRO_TIMEFRAMES as readonly string[]).includes(upperTimeframe);
  }

  return (FREE_TIMEFRAMES as readonly string[]).includes(upperTimeframe);
}

/**
 * Get count of accessible chart combinations for a tier
 *
 * @param tier - User tier
 * @returns Number of symbol × timeframe combinations
 */
export function getChartCombinationsCount(tier: Tier): number {
  const symbols = getAccessibleSymbols(tier);
  const timeframes = getAccessibleTimeframes(tier);
  return symbols.length * timeframes.length;
}
