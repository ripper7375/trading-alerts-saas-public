import type { Symbol, Timeframe } from './tier';

/**
 * Indicator types from MT5
 */
export type IndicatorType = 'FRACTAL_HORIZONTAL' | 'FRACTAL_DIAGONAL';

/**
 * Candlestick data point
 */
export interface Candlestick {
  time: number; // Unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * Indicator data point
 */
export interface IndicatorPoint {
  time: number;
  value: number;
  type?: 'SUPPORT' | 'RESISTANCE';
}

/**
 * Complete indicator data response
 */
export interface IndicatorData {
  symbol: Symbol;
  timeframe: Timeframe;
  indicatorType: IndicatorType;
  candlesticks: Candlestick[];
  indicators: IndicatorPoint[];
  lastUpdate: string; // ISO timestamp
}

/**
 * Indicator request parameters
 */
export interface IndicatorRequest {
  symbol: Symbol;
  timeframe: Timeframe;
  indicatorType: IndicatorType;
  bars?: number; // Number of bars to fetch (default: 100)
}

/**
 * Chart data (candlesticks + indicators)
 */
export interface ChartData {
  symbol: Symbol;
  timeframe: Timeframe;
  data: Candlestick[];
  indicators: {
    fractalHorizontal?: IndicatorPoint[];
    fractalDiagonal?: IndicatorPoint[];
  };
  lastUpdate: Date;
}
