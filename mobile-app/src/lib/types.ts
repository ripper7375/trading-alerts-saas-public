export type Symbol =
  | 'EURUSD'
  | 'GBPUSD'
  | 'USDJPY'
  | 'AUDUSD'
  | 'USDCAD'
  | 'USDCHF'
  | 'NZDUSD'
  | 'EURJPY'
  | 'GBPJPY'
  | 'EURGBP'
  | 'XAUUSD'
  | 'BTCUSD'
  | 'ETHUSD'
  | 'US30'
  | 'NAS100'
  | 'SPX500';

export type Timeframe =
  | 'M1'
  | 'M5'
  | 'M15'
  | 'M30'
  | 'H1'
  | 'H2'
  | 'H4'
  | 'D1'
  | 'W1';

export type Tier = 'FREE' | 'PRO';

/**
 * 5 External System Roles (Non-Admin):
 * NL: Non-Login (Public visitor)
 * FT: Free Tier User
 * PT: Pro Tier User
 * AF: Unified Affiliate + Free Tier
 * AP: Unified Affiliate + Pro Tier
 */
export type UserRole = 'NL' | 'FT' | 'PT' | 'AF' | 'AP';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: UserRole;
  tier: Tier;
  isAffiliate: boolean;
  affiliateCode?: string;
  tokensUsed: number;
  maxTokens: number;
  createdAt: string;
}

export type AlertCondition =
  | 'ABOVE'
  | 'BELOW'
  | 'FRACTAL_RESISTANCE'
  | 'FRACTAL_SUPPORT';
export type AlertStatus = 'ACTIVE' | 'TRIGGERED' | 'PAUSED';

export interface PriceAlert {
  id: string;
  symbol: Symbol;
  timeframe: Timeframe;
  condition: AlertCondition;
  targetPrice: number;
  currentPrice: number;
  status: AlertStatus;
  sound: string;
  note?: string;
  createdAt: string;
  triggeredAt?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  symbol?: Symbol;
  timeframe?: Timeframe;
  alertId?: string;
  url?: string;
  isRead: boolean;
  priority: 'HIGH' | 'NORMAL';
  createdAt: string;
}

export interface AffiliateStats {
  totalEarned: number;
  unpaidCommission: number;
  totalClicks: number;
  conversionRate: number;
  activeReferrals: number;
  monthlyGrowthPct: number;
}

export interface TradeSetup {
  symbol: Symbol;
  timeframe: Timeframe;
  direction: 'BUY' | 'SELL' | 'NEUTRAL';
  entryPrice: number;
  takeProfit: number;
  stopLoss: number;
  riskReward: string;
  confidence: number;
  rationale: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  chartThumbnail?: string;
  tradeSetup?: TradeSetup;
}

export interface CandlestickData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface FractalLevel {
  id: string;
  type: 'SUPPORT' | 'RESISTANCE';
  price: number;
  timeframe: Timeframe;
  isBreached?: boolean;
}
