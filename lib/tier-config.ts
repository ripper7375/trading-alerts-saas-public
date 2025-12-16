/**
 * Trading Alerts SaaS - Tier Configuration
 * Centralized constants for tier system
 * Based on 00-tier-specifications.md requirements
 */

export type Tier = 'FREE' | 'PRO';

export interface TierConfig {
  name: string;
  price: number;
  symbols: number;
  timeframes: number;
  chartCombinations: number;
  maxAlerts: number;
  maxWatchlistItems: number;
  rateLimit: number; // requests per hour
}

/**
 * FREE Tier Configuration
 * - 5 symbols: BTCUSD, EURUSD, USDJPY, US30, XAUUSD
 * - 3 timeframes: H1, H4, D1
 * - 15 chart combinations (5 × 3)
 * - 5 alerts, 5 watchlist items
 * - 60 requests/hour
 * - $0/month
 */
export const FREE_TIER_CONFIG: TierConfig = {
  name: 'FREE',
  price: 0,
  symbols: 5,
  timeframes: 3,
  chartCombinations: 15,
  maxAlerts: 5,
  maxWatchlistItems: 5,
  rateLimit: 60,
};

/**
 * PRO Tier Configuration
 * - 15 symbols: AUDJPY, AUDUSD, BTCUSD, ETHUSD, EURUSD, GBPJPY, GBPUSD, NDX100, NZDUSD, US30, USDCAD, USDCHF, USDJPY, XAGUSD, XAUUSD
 * - 9 timeframes: M5, M15, M30, H1, H2, H4, H8, H12, D1
 * - 135 chart combinations (15 × 9)
 * - 20 alerts, 50 watchlist items
 * - 300 requests/hour
 * - $29/month
 * - 7-day free trial with full PRO access
 */
export const PRO_TIER_CONFIG: TierConfig = {
  name: 'PRO',
  price: 29,
  symbols: 15,
  timeframes: 9,
  chartCombinations: 135,
  maxAlerts: 20,
  maxWatchlistItems: 50,
  rateLimit: 300,
};

/**
 * Complete tier configuration mapping
 */
export const TIER_CONFIGS: Record<Tier, TierConfig> = {
  FREE: FREE_TIER_CONFIG,
  PRO: PRO_TIER_CONFIG,
};

/**
 * FREE Tier Symbols (5 total)
 * Only these symbols can be accessed by FREE tier users
 */
export const FREE_SYMBOLS = [
  'BTCUSD', // Crypto - Bitcoin
  'EURUSD', // Forex Major - Euro/Dollar
  'USDJPY', // Forex Major - Dollar/Yen
  'US30', // Index - Dow Jones Industrial Average
  'XAUUSD', // Commodities - Gold
] as const;

/**
 * PRO Tier Exclusive Symbols (10 additional symbols)
 * These symbols are only available to PRO tier users
 * Combined with FREE_SYMBOLS makes 15 total PRO symbols
 */
export const PRO_EXCLUSIVE_SYMBOLS = [
  'AUDJPY', // Forex Cross - Australian Dollar/Japanese Yen
  'AUDUSD', // Forex Major - Australian Dollar/US Dollar
  'ETHUSD', // Crypto - Ethereum
  'GBPJPY', // Forex Cross - British Pound/Japanese Yen
  'GBPUSD', // Forex Major - British Pound/Dollar
  'NDX100', // Index - Nasdaq 100
  'NZDUSD', // Forex Major - New Zealand Dollar/US Dollar
  'USDCAD', // Forex Major - US Dollar/Canadian Dollar
  'USDCHF', // Forex Major - US Dollar/Swiss Franc
  'XAGUSD', // Commodities - Silver
] as const;

/**
 * All PRO Tier Symbols (15 total)
 * Combines FREE_SYMBOLS + PRO_EXCLUSIVE_SYMBOLS
 */
export const PRO_SYMBOLS = [...FREE_SYMBOLS, ...PRO_EXCLUSIVE_SYMBOLS] as const;

/**
 * FREE Tier Timeframes (3 total)
 * Only these timeframes can be accessed by FREE tier users
 */
export const FREE_TIMEFRAMES = [
  'H1', // 1 Hour
  'H4', // 4 Hours
  'D1', // Daily
] as const;

/**
 * PRO Tier Exclusive Timeframes (6 additional timeframes)
 * These timeframes are only available to PRO tier users
 * Combined with FREE_TIMEFRAMES makes 9 total PRO timeframes
 */
export const PRO_EXCLUSIVE_TIMEFRAMES = [
  'M5', // 5 Minutes (scalping)
  'M15', // 15 Minutes
  'M30', // 30 Minutes
  'H2', // 2 Hours
  'H8', // 8 Hours
  'H12', // 12 Hours (swing trading)
] as const;

/**
 * All PRO Tier Timeframes (9 total)
 * Combines FREE_TIMEFRAMES + PRO_EXCLUSIVE_TIMEFRAMES
 */
export const PRO_TIMEFRAMES = [
  ...FREE_TIMEFRAMES,
  ...PRO_EXCLUSIVE_TIMEFRAMES,
] as const;

/**
 * Trial Period Configuration
 */
export const TRIAL_CONFIG = {
  DURATION_DAYS: 7,
  PRICE: 0, // Free trial
  GRANT_PRO_ACCESS: true, // Trial users get full PRO tier access
};

/**
 * Get tier configuration by tier name
 * @param tier - Tier name ('FREE' or 'PRO')
 * @returns Tier configuration object
 * @throws Error if tier is invalid
 */
export function getTierConfig(tier: Tier): TierConfig {
  const config = TIER_CONFIGS[tier];
  if (!config) {
    throw new Error(
      `Invalid tier: ${tier}. Valid tiers are: ${Object.keys(TIER_CONFIGS).join(', ')}`
    );
  }
  return config;
}

/**
 * Get all symbols accessible by a tier
 * @param tier - Tier name
 * @returns Array of accessible symbols
 * @throws Error if tier is invalid
 */
export function getAccessibleSymbols(tier: Tier): readonly string[] {
  if (tier === 'FREE') {
    return FREE_SYMBOLS;
  }
  if (tier === 'PRO') {
    return PRO_SYMBOLS;
  }
  throw new Error(`Invalid tier: ${tier}`);
}

/**
 * Get all timeframes accessible by a tier
 * @param tier - Tier name
 * @returns Array of accessible timeframes
 * @throws Error if tier is invalid
 */
export function getAccessibleTimeframes(tier: Tier): readonly string[] {
  if (tier === 'FREE') {
    return FREE_TIMEFRAMES;
  }
  if (tier === 'PRO') {
    return PRO_TIMEFRAMES;
  }
  throw new Error(`Invalid tier: ${tier}`);
}

/**
 * Get chart combination count for a tier
 * @param tier - Tier name
 * @returns Number of possible symbol × timeframe combinations
 * @throws Error if tier is invalid
 */
export function getChartCombinations(tier: Tier): number {
  const config = getTierConfig(tier);
  return config.chartCombinations;
}
