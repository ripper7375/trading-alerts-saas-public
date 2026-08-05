export type Symbol = 'XAUUSD' | 'BTCUSD' | 'EURUSD' | 'USDJPY' | 'US30';
export type Timeframe =
  | 'M5'
  | 'M15'
  | 'M30'
  | 'H1'
  | 'H2'
  | 'H4'
  | 'H8'
  | 'H12'
  | 'D1';

export type Tier = 'FREE' | 'PRO';

export type M15ViewMode = 'SSA_EDT' | 'ZIGZAG';

export interface AiModel {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
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

export interface MarketComment {
  id: string;
  iconType:
    | 'ALERT_RESISTANCE'
    | 'ALERT_SUPPORT'
    | 'SSA_CROSS'
    | 'EDT_TOUCH'
    | 'NEUTRAL_INFO';
  timestamp: string;
  shortComment: string;
  callAction: 'BUY' | 'SELL' | 'NEUTRAL';
}

export interface QualityMetrics {
  barCoverage: number; // e.g. 92
  regressionR2: number; // e.g. 72
  edtFitness: number; // e.g. 27
  baselineSymmetry: number; // e.g. 32
  symmetryBias: string; // e.g. "LOEDT Bias"
}

export interface TokenUsage {
  used: number;
  monthlyQuota: number;
}
