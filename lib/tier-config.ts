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
 *
 * Canonical shape and non-configurable values now live in
 * `@trading-alerts/types/tier` (Session 11-1, F68/F74) — this file
 * re-exports from there and layers on the one piece that's genuinely
 * monolith-specific: the env-driven PRO price override (below).
 */

import {
  type Tier as SharedTier,
  type TierConfig as SharedTierConfig,
  SYMBOLS,
  TIMEFRAMES,
  FREE_TIER_CONFIG as SHARED_FREE_TIER_CONFIG,
  PRO_TIER_CONFIG as SHARED_PRO_TIER_CONFIG,
  TRIAL_CONFIG,
  canAccessSymbol as sharedCanAccessSymbol,
  canAccessTimeframe as sharedCanAccessTimeframe,
  canAccessDrawingAlerts,
  canAccessAiAnalyst,
  canAccessMarketComments,
  canAccessMarketQualityMetrics,
} from '@trading-alerts/types/tier';

export type Tier = SharedTier;
export type TierConfig = SharedTierConfig;

export { SYMBOLS, TIMEFRAMES, TRIAL_CONFIG };
export {
  canAccessDrawingAlerts,
  canAccessAiAnalyst,
  canAccessMarketComments,
  canAccessMarketQualityMetrics,
};

/**
 * PRO monthly price (USD).
 * Configurable via env so the marketed price can be changed without a deploy.
 * NEXT_PUBLIC_ so both server and client bundles agree on the displayed price.
 * The authoritative billing amount remains the Stripe/dLocal Price ID.
 *
 * This override is intentionally NOT hoisted into `@trading-alerts/types`:
 * NEXT_PUBLIC_-prefixed env vars are Next.js client-bundle plumbing with no
 * equivalent in the NestJS services that package also feeds. The shared
 * package's own `PRO_TIER_CONFIG.price` is the $29 catalog default; this
 * file layers the monolith's env override on top of it.
 */
export const PRO_MONTHLY_PRICE: number = Number(
  process.env['NEXT_PUBLIC_PRO_PRICE_MONTHLY'] ??
    String(SHARED_PRO_TIER_CONFIG.price)
);

/**
 * FREE Tier Configuration
 * - XAUUSD only, M5 + M15
 * - Full market data column access (all 79 market_data_v6 columns)
 * - 0 alerts (Alerts are a PRO feature)
 * - 60 requests/hour
 * - $0/month
 * - No drawing-alert, AI Analyst, or market-comments entitlements
 */
export const FREE_TIER_CONFIG: TierConfig = SHARED_FREE_TIER_CONFIG;

/**
 * PRO Tier Configuration
 * - XAUUSD only, M5 + M15 (same data access as FREE)
 * - 100 alerts (incl. drawing-engine line-touch alerts)
 * - Multi-timeframe visualization
 * - 300 requests/hour
 * - Configurable price/month (env NEXT_PUBLIC_PRO_PRICE_MONTHLY, default $29)
 * - 7-day free trial with full PRO access
 * - AI Analyst (Stack D, 500k monthly tokens) and Market Comments + Quality
 *   Metrics (Stack E) entitlements
 */
export const PRO_TIER_CONFIG: TierConfig = {
  ...SHARED_PRO_TIER_CONFIG,
  price: PRO_MONTHLY_PRICE,
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
export const canAccessSymbol = sharedCanAccessSymbol;

/**
 * Check if a tier can access a specific timeframe.
 * V8: tier-independent — M5 and M15 only.
 */
export const canAccessTimeframe = sharedCanAccessTimeframe;
