/**
 * Indicator Types for Part 20 SQLite + PostgreSQL Architecture
 *
 * TypeScript types matching the OpenAPI specification for indicator data.
 * All timestamps are Unix timestamps (UTC-based) for consistency.
 *
 * @module lib/indicators/types
 */

// ============================================
// OHLC DATA TYPES
// ============================================

/**
 * OHLC Bar for chart data
 */
export interface OHLCBar {
  time: number; // Unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// ============================================
// FRACTAL TYPES
// ============================================

/**
 * Fractal point (peak or bottom)
 */
export interface FractalPoint {
  index: number;
  price: number;
  time: number;
}

/**
 * Fractals data structure
 */
export interface Fractals {
  peaks: FractalPoint[];
  bottoms: FractalPoint[];
}

// ============================================
// TRENDLINE TYPES
// ============================================

/**
 * Point on a trendline
 */
export interface TrendlinePoint {
  time: number;
  price: number;
}

/**
 * Horizontal trendline (support/resistance)
 */
export interface HorizontalTrendline {
  price: number;
  start_time: number;
  end_time: number;
  strength: number;
}

/**
 * Diagonal trendline (ascending/descending)
 */
export interface DiagonalTrendline {
  start: TrendlinePoint;
  end: TrendlinePoint;
  slope: number;
  type: 'support' | 'resistance';
}

/**
 * Collection of horizontal trendlines
 */
export interface HorizontalTrendlines {
  support: HorizontalTrendline[];
  resistance: HorizontalTrendline[];
}

/**
 * Collection of diagonal trendlines
 */
export interface DiagonalTrendlines {
  support: DiagonalTrendline[];
  resistance: DiagonalTrendline[];
}

// ============================================
// MOMENTUM CANDLE TYPES
// ============================================

/**
 * Momentum candle classification
 */
export interface MomentumCandle {
  time: number;
  type: 'bullish' | 'bearish';
  body_size: number;
  total_size: number;
  body_ratio: number;
}

// ============================================
// KELTNER CHANNEL TYPES
// ============================================

/**
 * Keltner Channels data (10-band system)
 */
export interface KeltnerChannels {
  upper: number[];
  middle: number[];
  lower: number[];
  timestamps: number[];
}

// ============================================
// ZIGZAG TYPES
// ============================================

/**
 * ZigZag point (peak or bottom in market structure)
 */
export interface ZigZagPoint {
  time: number;
  price: number;
  type: 'peak' | 'bottom';
}

/**
 * ZigZag indicator data
 */
export interface ZigZag {
  points: ZigZagPoint[];
}

// ============================================
// TRADING HOURS TYPES
// ============================================

/**
 * Trading hours configuration for a symbol
 */
export interface TradingHours {
  open: string; // HH:MM:SS format
  close: string; // HH:MM:SS format
  timezone: string; // e.g., "GMT+2" or "GMT+3"
  days: string[]; // e.g., ["monday", "tuesday", ...]
}

// ============================================
// COMPLETE INDICATOR DATA
// ============================================

/**
 * Complete Indicator Data from database
 */
export interface IndicatorData {
  ohlc: OHLCBar[];
  fractals: Fractals;
  horizontal_trendlines: HorizontalTrendlines;
  diagonal_trendlines: DiagonalTrendlines;
  momentum_candles: MomentumCandle[];
  keltner_channels: KeltnerChannels;
  tema: number[];
  hrma: number[];
  smma: number[];
  zigzag: ZigZag;
}

// ============================================
// API RESPONSE METADATA
// ============================================

/**
 * Metadata for API response
 */
export interface IndicatorMetadata {
  symbol: string;
  timeframe: string;
  tier: 'FREE' | 'PRO';
  bars_returned: number;
  last_update: string;
  pro_indicators_enabled: boolean;
  market_status: 'OPEN' | 'CLOSED';
  trading_hours: TradingHours;
  next_market_open: string | null;
  dst_active: boolean;
  server_utc_offset: 2 | 3;
}

// ============================================
// COMPLETE API RESPONSE
// ============================================

/**
 * Complete API Response for indicator endpoint
 */
export interface IndicatorResponse {
  success: boolean;
  data?: {
    ohlc: OHLCBar[];
    fractals: Fractals;
    horizontal_trendlines: HorizontalTrendlines;
    diagonal_trendlines: DiagonalTrendlines;
    momentum_candles: MomentumCandle[];
    keltner_channels: KeltnerChannels;
    tema: number[];
    hrma: number[];
    smma: number[];
    zigzag: ZigZag;
    metadata: IndicatorMetadata;
  };
  error?: string;
}

// ============================================
// DATABASE ROW TYPES
// ============================================

/**
 * Raw indicator row from PostgreSQL database
 */
export interface RawIndicatorRow {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  fractals: Fractals | null;
  horizontal_trendlines: HorizontalTrendlines | null;
  diagonal_trendlines: DiagonalTrendlines | null;
  momentum_candles: MomentumCandle[] | null;
  keltner_channels: KeltnerChannels | null;
  tema: number | null;
  hrma: number | null;
  smma: number | null;
  zigzag: ZigZag | null;
}
