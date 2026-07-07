/**
 * Trading Alerts SaaS - Tier Configuration
 * Centralized constants for tier system — SINGLE SOURCE OF TRUTH.
 *
 * V8 single-symbol architecture:
 * - One symbol (XAUUSD) and two timeframes (M5, M15) for BOTH tiers.
 * - Both tiers have full access to all market_data_v6 columns.
 * - Watchlists removed from the product entirely.
 * - Tier differentiation: Alerts (FREE 0 / PRO 100), notifications,
 *   multi-timeframe visualization, and drawing-engine line alerts (PRO only).
 */

export type Tier = 'FREE' | 'PRO';

export interface TierConfig {
  name: string;
  price: number;
  symbols: number;
  timeframes: number;
  chartCombinations: number;
  maxAlerts: number;
  rateLimit: number; // requests per hour
}

/**
 * PRO monthly price (USD).
 * Configurable via env so the marketed price can be changed without a deploy.
 * NEXT_PUBLIC_ so both server and client bundles agree on the displayed price.
 * The authoritative billing amount remains the Stripe/dLocal Price ID.
 */
export const PRO_MONTHLY_PRICE: number = Number(
  process.env['NEXT_PUBLIC_PRO_PRICE_MONTHLY'] ?? '29'
);

/**
 * The single supported symbol (V8 architecture)
 */
export const SYMBOLS = ['XAUUSD'] as const;

/**
 * The two supported timeframes (V8 architecture)
 */
export const TIMEFRAMES = ['M5', 'M15'] as const;

/**
 * FREE Tier Configuration
 * - XAUUSD only, M5 + M15
 * - Full market data column access (all 79 market_data_v6 columns)
 * - 0 alerts (Alerts are a PRO feature)
 * - 60 requests/hour
 * - $0/month
 */
export const FREE_TIER_CONFIG: TierConfig = {
  name: 'FREE',
  price: 0,
  symbols: 1,
  timeframes: 2,
  chartCombinations: 2,
  maxAlerts: 0,
  rateLimit: 60,
};

/**
 * PRO Tier Configuration
 * - XAUUSD only, M5 + M15 (same data access as FREE)
 * - 100 alerts
 * - Multi-timeframe visualization + drawing-engine line alerts
 * - 300 requests/hour
 * - Configurable price/month (env NEXT_PUBLIC_PRO_PRICE_MONTHLY, default $29)
 * - 7-day free trial with full PRO access
 */
export const PRO_TIER_CONFIG: TierConfig = {
  name: 'PRO',
  price: PRO_MONTHLY_PRICE,
  symbols: 1,
  timeframes: 2,
  chartCombinations: 2,
  maxAlerts: 100,
  rateLimit: 300,
};

/**
 * Complete tier configuration mapping
 */
export const TIER_CONFIGS: Record<Tier, TierConfig> = {
  FREE: FREE_TIER_CONFIG,
  PRO: PRO_TIER_CONFIG,
};

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SYMBOL / TIMEFRAME ALIASES
// Both tiers share identical symbol/timeframe access in V8.
// The FREE_*/PRO_* names are kept so existing imports keep working;
// they all point at the same canonical lists.
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const FREE_SYMBOLS = SYMBOLS;
export const PRO_SYMBOLS = SYMBOLS;
/** @deprecated No PRO-exclusive symbols in V8. Always empty. */
export const PRO_EXCLUSIVE_SYMBOLS = [] as const;

export const FREE_TIMEFRAMES = TIMEFRAMES;
export const PRO_TIMEFRAMES = TIMEFRAMES;
/** @deprecated No PRO-exclusive timeframes in V8. Always empty. */
export const PRO_EXCLUSIVE_TIMEFRAMES = [] as const;

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
 * Get all symbols accessible by a tier.
 * V8: identical for both tiers (XAUUSD only).
 */
export function getAccessibleSymbols(_tier: Tier): readonly string[] {
  return SYMBOLS;
}

/**
 * Get all timeframes accessible by a tier.
 * V8: identical for both tiers (M5, M15).
 */
export function getAccessibleTimeframes(_tier: Tier): readonly string[] {
  return TIMEFRAMES;
}

/**
 * Get chart combination count for a tier (V8: always 2 — XAUUSD × M5/M15)
 */
export function getChartCombinations(tier: Tier): number {
  return getTierConfig(tier).chartCombinations;
}

/**
 * Check if a tier can access a specific symbol.
 * V8: tier-independent — XAUUSD only.
 */
export function canAccessSymbol(symbol: string, _tier: Tier): boolean {
  return (SYMBOLS as readonly string[]).includes(symbol.toUpperCase());
}

/**
 * Check if a tier can access a specific timeframe.
 * V8: tier-independent — M5 and M15 only.
 */
export function canAccessTimeframe(timeframe: string, _tier: Tier): boolean {
  return (TIMEFRAMES as readonly string[]).includes(timeframe.toUpperCase());
}
