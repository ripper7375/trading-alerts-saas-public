/**
 * Canonical tier-matrix constants (F68/F74, Session 11-1).
 *
 * `PRO_TIER_CONFIG.price` here is the catalog default ($29, matching
 * `STRIPE_PRO_PRICE_ID`'s live Price object, verified at this session's
 * CONFIRM). The monolith's `lib/tier-config.ts` overrides this with its own
 * `NEXT_PUBLIC_PRO_PRICE_MONTHLY`-driven value — that env-based override is
 * Next.js/monolith-specific plumbing and does not belong in a package also
 * consumed by NestJS services.
 *
 * @module @trading-alerts/types/tier/constants
 */

import type { Tier, TierConfig } from './types';

/** The single supported symbol (V8 architecture). */
export const SYMBOLS = ['XAUUSD'] as const;

/** The two supported timeframes (V8 architecture). */
export const TIMEFRAMES = ['M5', 'M15'] as const;

export const FREE_TIER_CONFIG: TierConfig = {
  name: 'FREE',
  price: 0,
  symbols: 1,
  timeframes: 2,
  chartCombinations: 2,
  maxAlerts: 0,
  rateLimit: 60,
  drawingAlertsAllowed: false,
  aiAnalystAllowed: false,
  aiMonthlyTokenQuota: 0,
  marketCommentsFeedAllowed: false,
  marketQualityMetricsAllowed: false,
};

export const PRO_TIER_CONFIG: TierConfig = {
  name: 'PRO',
  price: 29,
  symbols: 1,
  timeframes: 2,
  chartCombinations: 2,
  maxAlerts: 100,
  rateLimit: 300,
  drawingAlertsAllowed: true,
  aiAnalystAllowed: true,
  aiMonthlyTokenQuota: 500_000,
  marketCommentsFeedAllowed: true,
  marketQualityMetricsAllowed: true,
};

export const TIER_CONFIGS: Record<Tier, TierConfig> = {
  FREE: FREE_TIER_CONFIG,
  PRO: PRO_TIER_CONFIG,
};

/** Trial period configuration — trial users get full PRO access. */
export const TRIAL_CONFIG = {
  DURATION_DAYS: 7,
  PRICE: 0,
  GRANT_PRO_ACCESS: true,
};
