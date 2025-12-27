/**
 * Tier System Types for V7
 *
 * V7 uses a simplified 2-tier system:
 * - FREE: 5 symbols × 3 timeframes (H1, H4, D1) = 15 combinations
 * - PRO: 15 symbols × 9 timeframes (all) = 135 combinations
 *
 * NOTE: The canonical `Tier` type is defined in `lib/tier-config.ts`.
 * This file re-exports it for convenience and provides additional types.
 */

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TIER TYPE (Re-exported from lib/tier-config)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * User tier levels - re-exported from lib/tier-config.ts
 *
 * Note: ENTERPRISE tier removed in V7
 */
export type { Tier } from '@/lib/tier-config';

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
  maxWatchlists: number;
  allowedSymbols: string[];
  allowedTimeframes: Timeframe[];
  pricing: {
    monthlyPrice: number; // in USD
    yearlyPrice?: number; // in USD (if available)
    hasFreeTrial: boolean; // 7-day free trial for PRO
    trialDays?: number; // number of trial days
  };
  features: {
    advancedCharts: boolean;
    exportData: boolean;
    apiAccess: boolean;
    prioritySupport: boolean;
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TIMEFRAME TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * All supported timeframes in V7
 *
 * FREE tier: H1, H4, D1 only
 * PRO tier: All 9 timeframes
 */
export type Timeframe =
  | 'M5' // PRO only
  | 'M15' // PRO only
  | 'M30' // PRO only
  | 'H1' // FREE + PRO
  | 'H2' // PRO only
  | 'H4' // FREE + PRO
  | 'H8' // PRO only
  | 'H12' // PRO only
  | 'D1'; // FREE + PRO

/**
 * Timeframe display labels
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
};

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SYMBOL CONSTANTS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * FREE tier symbols (5 symbols)
 */
export const FREE_TIER_SYMBOLS = [
  'BTCUSD', // Bitcoin
  'EURUSD', // Euro
  'USDJPY', // Yen
  'US30', // Dow Jones
  'XAUUSD', // Gold
] as const;

/**
 * PRO tier exclusive symbols (10 additional)
 * NOTE: This list MUST match PRO_EXCLUSIVE_SYMBOLS in lib/tier-config.ts
 */
export const PRO_TIER_EXCLUSIVE_SYMBOLS = [
  'AUDJPY', // Forex Cross - Australian Dollar/Japanese Yen
  'AUDUSD', // Forex Major - Australian Dollar/US Dollar
  'ETHUSD', // Crypto - Ethereum
  'GBPJPY', // Forex Cross - British Pound/Japanese Yen
  'GBPUSD', // Forex Major - British Pound/US Dollar
  'NDX100', // Index - Nasdaq 100
  'NZDUSD', // Forex Major - New Zealand Dollar/US Dollar
  'USDCAD', // Forex Major - US Dollar/Canadian Dollar
  'USDCHF', // Forex Major - US Dollar/Swiss Franc
  'XAGUSD', // Commodities - Silver
] as const;

/**
 * All PRO tier symbols (15 total)
 */
export const PRO_TIER_SYMBOLS = [
  ...FREE_TIER_SYMBOLS,
  ...PRO_TIER_EXCLUSIVE_SYMBOLS,
] as const;

/**
 * All available symbols (union type)
 */
export type Symbol = (typeof PRO_TIER_SYMBOLS)[number];

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TIER CONFIGURATION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * FREE tier timeframes (3 timeframes)
 */
export const FREE_TIER_TIMEFRAMES: Timeframe[] = ['H1', 'H4', 'D1'];

/**
 * PRO tier timeframes (all 9 timeframes)
 */
export const PRO_TIER_TIMEFRAMES: Timeframe[] = [
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

/**
 * Complete tier configuration
 */
export const TIER_CONFIG: Record<Tier, TierLimits> = {
  FREE: {
    maxAlerts: 5,
    maxWatchlists: 1,
    allowedSymbols: [...FREE_TIER_SYMBOLS],
    allowedTimeframes: FREE_TIER_TIMEFRAMES,
    pricing: {
      monthlyPrice: 0,
      hasFreeTrial: false,
    },
    features: {
      advancedCharts: false,
      exportData: false,
      apiAccess: false,
      prioritySupport: false,
    },
  },
  PRO: {
    maxAlerts: 20,
    maxWatchlists: 5,
    allowedSymbols: [...PRO_TIER_SYMBOLS],
    allowedTimeframes: PRO_TIER_TIMEFRAMES,
    pricing: {
      monthlyPrice: 29,
      yearlyPrice: 290,
      hasFreeTrial: true,
      trialDays: 7,
    },
    features: {
      advancedCharts: true,
      exportData: true,
      apiAccess: true,
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
  additionalSymbols: number;
  additionalTimeframes: number;
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
