/**
 * Tier System Types for V8
 *
 * V8 single-symbol architecture:
 * - One symbol (XAUUSD) and two timeframes (M5, M15) for BOTH tiers.
 * - Identical market data access for both tiers (all market_data_v6 columns).
 * - Tier differentiation: Alerts (FREE 0 / PRO 100), multi-timeframe
 *   visualization, and drawing-engine line alerts (PRO only).
 *
 * NOTE: The canonical `Tier` type and tier limits are defined in
 * `lib/tier-config.ts`. This file re-exports and derives from it.
 */

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TIER TYPE (Re-exported from lib/tier-config)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { PRO_MONTHLY_PRICE, type Tier } from '@/lib/tier-config';
export type { Tier };

/**
 * Trial status for 7-day PRO trial
 */
export type TrialStatus =
  | 'NOT_STARTED' // User has not started trial yet
  | 'ACTIVE' // Trial is currently active (within 7 days)
  | 'EXPIRED' // Trial period ended, no payment method
  | 'CONVERTED' // Trial converted to paid subscription
  | 'CANCELLED'; // User cancelled trial before expiration

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TIER LIMITS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Tier-specific feature limits
 */
export interface TierLimits {
  maxAlerts: number;
  allowedSymbols: string[];
  allowedTimeframes: Timeframe[];
  pricing: {
    monthlyPrice: number; // in USD
    yearlyPrice?: number; // in USD (if available)
    hasFreeTrial: boolean; // 7-day free trial for PRO
    trialDays?: number; // number of trial days
  };
  features: {
    alerts: boolean; // Alert creation (PRO only)
    multiTimeframe: boolean; // Multi-timeframe visualization (PRO only)
    drawingLineAlerts: boolean; // Drawing-engine line alerts (PRO only)
    exportData: boolean;
    prioritySupport: boolean;
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TIMEFRAME TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Supported timeframes in V8 — M5 and M15 only, both tiers.
 */
export type Timeframe = 'M5' | 'M15';

/**
 * Timeframe display labels
 */
export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  M5: '5 Minutes',
  M15: '15 Minutes',
};

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SYMBOL CONSTANTS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * All supported symbols in V8 — XAUUSD only, both tiers.
 */
export const ALL_SYMBOLS = ['XAUUSD'] as const;

/**
 * The single supported symbol (union type)
 */
export type Symbol = (typeof ALL_SYMBOLS)[number];

/** @deprecated V8: both tiers share the same symbol list. Use ALL_SYMBOLS. */
export const FREE_TIER_SYMBOLS = ALL_SYMBOLS;
/** @deprecated V8: no PRO-exclusive symbols. Always empty. */
export const PRO_TIER_EXCLUSIVE_SYMBOLS = [] as const;
/** @deprecated V8: both tiers share the same symbol list. Use ALL_SYMBOLS. */
export const PRO_TIER_SYMBOLS = ALL_SYMBOLS;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TIER CONFIGURATION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * All supported timeframes (both tiers)
 */
export const ALL_TIMEFRAMES: Timeframe[] = ['M5', 'M15'];

/** @deprecated V8: both tiers share the same timeframes. Use ALL_TIMEFRAMES. */
export const FREE_TIER_TIMEFRAMES: Timeframe[] = ALL_TIMEFRAMES;
/** @deprecated V8: both tiers share the same timeframes. Use ALL_TIMEFRAMES. */
export const PRO_TIER_TIMEFRAMES: Timeframe[] = ALL_TIMEFRAMES;

/**
 * Complete tier configuration
 */
export const TIER_CONFIG: Record<Tier, TierLimits> = {
  FREE: {
    maxAlerts: 0, // Alerts are a PRO feature
    allowedSymbols: [...ALL_SYMBOLS],
    allowedTimeframes: ALL_TIMEFRAMES,
    pricing: {
      monthlyPrice: 0,
      hasFreeTrial: false,
    },
    features: {
      alerts: false,
      multiTimeframe: false,
      drawingLineAlerts: false,
      exportData: false,
      prioritySupport: false,
    },
  },
  PRO: {
    maxAlerts: 100,
    allowedSymbols: [...ALL_SYMBOLS],
    allowedTimeframes: ALL_TIMEFRAMES,
    pricing: {
      monthlyPrice: PRO_MONTHLY_PRICE,
      hasFreeTrial: true,
      trialDays: 7,
    },
    features: {
      alerts: true,
      multiTimeframe: true,
      drawingLineAlerts: true,
      exportData: true,
      prioritySupport: true,
    },
  },
};

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Symbol+Timeframe combination
 */
export interface ChartCombination {
  symbol: Symbol;
  timeframe: Timeframe;
}

/**
 * Tier upgrade information
 */
export interface TierUpgradeInfo {
  currentTier: Tier;
  targetTier: Tier;
  additionalAlerts: number;
  pricePerMonth: number;
}

/**
 * Tier access result
 */
export interface TierAccessResult {
  allowed: boolean;
  reason?: string;
  upgradeRequired?: boolean;
  requiredTier?: Tier;
}

/**
 * Trial information for a user
 */
export interface TrialInfo {
  status: TrialStatus;
  startDate: Date | null;
  endDate: Date | null;
  daysRemaining: number | null;
  isActive: boolean;
  hasUsedTrial: boolean;
  canStartTrial: boolean;
}

/**
 * User with trial information
 */
export interface UserWithTrial {
  id: string;
  email: string;
  tier: Tier;
  trialStatus: TrialStatus;
  trialStartDate: Date | null;
  trialEndDate: Date | null;
  trialConvertedAt: Date | null;
  trialCancelledAt: Date | null;
  hasUsedFreeTrial: boolean;
}

/**
 * Subscription status (matches Prisma enum)
 */
export type SubscriptionStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'CANCELED'
  | 'PAST_DUE'
  | 'UNPAID'
  | 'TRIALING';
