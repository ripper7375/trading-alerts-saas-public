import { Tier } from './types';

export interface TierConfig {
  name: Tier;
  price: number;
  symbols: number;
  timeframes: number;
  maxAlerts: number;
  rateLimit: number;
  aiAnalystAllowed: boolean;
  aiMonthlyTokenQuota: number;
  marketCommentsFeedAllowed: boolean;
  marketQualityMetricsAllowed: boolean;
  mtfOverlayAllowed: boolean;
}

export const PRO_MONTHLY_PRICE = 29;

export const FREE_TIER_CONFIG: TierConfig = {
  name: 'FREE',
  price: 0,
  symbols: 1, // XAUUSD
  timeframes: 2, // M5 + M15
  maxAlerts: 0,
  rateLimit: 60,
  aiAnalystAllowed: false,
  aiMonthlyTokenQuota: 0,
  marketCommentsFeedAllowed: false,
  marketQualityMetricsAllowed: false,
  mtfOverlayAllowed: false,
};

export const PRO_TIER_CONFIG: TierConfig = {
  name: 'PRO',
  price: PRO_MONTHLY_PRICE,
  symbols: 1, // XAUUSD
  timeframes: 2, // M5 + M15
  maxAlerts: 100,
  rateLimit: 300,
  aiAnalystAllowed: true,
  aiMonthlyTokenQuota: 500000,
  marketCommentsFeedAllowed: true,
  marketQualityMetricsAllowed: true,
  mtfOverlayAllowed: true,
};

export const TIER_CONFIGS: Record<Tier, TierConfig> = {
  FREE: FREE_TIER_CONFIG,
  PRO: PRO_TIER_CONFIG,
};
