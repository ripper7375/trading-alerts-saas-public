/**
 * Tier-access type definitions.
 *
 * Hoisted from `lib/tier-config.ts` (Session 11-1, F68/F74) — this package is
 * now the single source of truth for tier-entitlement shapes, consumed by the
 * Next.js monolith today and staged for operation-service/money-service from
 * Phase 12/13 onward.
 *
 * @module @trading-alerts/types/tier/types
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

  // Drawing tool-set entitlements (Phase 10 deferred scope)
  drawingAlertsAllowed: boolean;

  // Stack D (AI Analyst) entitlements (Phase 12)
  aiAnalystAllowed: boolean;
  aiMonthlyTokenQuota: number; // 0 for FREE, 500_000 for PRO

  // Stack E (Market Comments & Quality Metrics) entitlements (Phase 13)
  marketCommentsFeedAllowed: boolean;
  marketQualityMetricsAllowed: boolean;
}
