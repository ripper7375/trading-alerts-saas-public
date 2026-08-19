import { Tier, Symbol, Timeframe } from './types';

export interface TierConfig {
  name: Tier;
  price: number;
  allowedSymbols: Symbol[];
  allowedTimeframes: Timeframe[];
  maxActiveAlerts: number;
  hasAiAnalyst: boolean;
  hasRealtimeTicks: boolean;
  hasCustomChimes: boolean;
  hasHighPriorityPush: boolean;
  aiMonthlyTokenQuota: number;
}

export const FREE_ALLOWED_SYMBOLS: Symbol[] = [
  'EURUSD',
  'GBPUSD',
  'USDJPY',
  'XAUUSD',
  'BTCUSD',
];

export const FREE_ALLOWED_TIMEFRAMES: Timeframe[] = ['H1', 'H4', 'D1'];

export const PRO_ALLOWED_SYMBOLS: Symbol[] = [
  'EURUSD',
  'GBPUSD',
  'USDJPY',
  'AUDUSD',
  'USDCAD',
  'USDCHF',
  'NZDUSD',
  'EURJPY',
  'GBPJPY',
  'EURGBP',
  'XAUUSD',
  'BTCUSD',
  'ETHUSD',
  'US30',
  'NAS100',
  'SPX500',
];

export const PRO_ALLOWED_TIMEFRAMES: Timeframe[] = [
  'M1',
  'M5',
  'M15',
  'M30',
  'H1',
  'H2',
  'H4',
  'D1',
  'W1',
];

export const FREE_TIER_CONFIG: TierConfig = {
  name: 'FREE',
  price: 0,
  allowedSymbols: FREE_ALLOWED_SYMBOLS,
  allowedTimeframes: FREE_ALLOWED_TIMEFRAMES,
  maxActiveAlerts: 5,
  hasAiAnalyst: false,
  hasRealtimeTicks: false,
  hasCustomChimes: false,
  hasHighPriorityPush: false,
  aiMonthlyTokenQuota: 50000,
};

export const PRO_TIER_CONFIG: TierConfig = {
  name: 'PRO',
  price: 29,
  allowedSymbols: PRO_ALLOWED_SYMBOLS,
  allowedTimeframes: PRO_ALLOWED_TIMEFRAMES,
  maxActiveAlerts: 20,
  hasAiAnalyst: true,
  hasRealtimeTicks: true,
  hasCustomChimes: true,
  hasHighPriorityPush: true,
  aiMonthlyTokenQuota: 500000,
};

export const TIER_CONFIGS: Record<Tier, TierConfig> = {
  FREE: FREE_TIER_CONFIG,
  PRO: PRO_TIER_CONFIG,
};
