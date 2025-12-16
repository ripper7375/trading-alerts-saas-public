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

export interface ChartState {
  symbol: Symbol;
  timeframe: Timeframe;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}
