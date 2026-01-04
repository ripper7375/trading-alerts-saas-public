/**
 * Indicator Data Types
 *
 * Part 20 - Phase 04: Next.js API Routes
 * TypeScript types matching the OpenAPI specification.
 *
 * @module lib/indicators/types
 */

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OHLC DATA
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * OHLC Bar data structure
 * Time is Unix timestamp for compatibility with charting libraries
 */
export interface OHLCBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FRACTAL TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Single fractal point
 */
export interface FractalPoint {
  index: number;
  time?: number;
  price: number;
}

/**
 * Fractals indicator data
 * Only contains latest MT5 values (dynamic indicator)
 */
export interface Fractals {
  peaks: FractalPoint[];
  bottoms: FractalPoint[];
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TRENDLINE TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Single line point for trendlines
 */
export interface LinePoint {
  index: number;
  value: number;
}

/**
 * Horizontal trendlines (support/resistance)
 * Only contains latest MT5 values (dynamic indicator)
 */
export interface HorizontalTrendlines {
  peak_1?: LinePoint[];
  peak_2?: LinePoint[];
  peak_3?: LinePoint[];
  bottom_1?: LinePoint[];
  bottom_2?: LinePoint[];
  bottom_3?: LinePoint[];
}

/**
 * Diagonal trendlines
 * Only contains latest MT5 values (dynamic indicator)
 */
export interface DiagonalTrendlines {
  ascending_1?: LinePoint[];
  ascending_2?: LinePoint[];
  ascending_3?: LinePoint[];
  descending_1?: LinePoint[];
  descending_2?: LinePoint[];
  descending_3?: LinePoint[];
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MOMENTUM CANDLE TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Momentum candle type enum values
 * 1: UP_LARGE, 2: UP_EXTREME, 4: DOWN_LARGE, 5: DOWN_EXTREME
 */
export type MomentumCandleType = 1 | 2 | 4 | 5;

/**
 * Single momentum candle marker
 */
export interface MomentumCandle {
  index: number;
  type: MomentumCandleType;
  zscore: number;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// KELTNER CHANNELS TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Keltner Channels (10-band volatility system)
 */
export interface KeltnerChannels {
  ultra_extreme_upper?: (number | null)[];
  extreme_upper?: (number | null)[];
  upper_most?: (number | null)[];
  upper?: (number | null)[];
  upper_middle?: (number | null)[];
  lower_middle?: (number | null)[];
  lower?: (number | null)[];
  lower_most?: (number | null)[];
  extreme_lower?: (number | null)[];
  ultra_extreme_lower?: (number | null)[];
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ZIGZAG TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Single ZigZag point
 */
export interface ZigZagPoint {
  index: number;
  price: number;
  time?: number;
}

/**
 * ZigZag indicator data
 */
export interface ZigZag {
  peaks: ZigZagPoint[];
  bottoms: ZigZagPoint[];
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MARKET STATUS TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Market status
 */
export type MarketStatus = 'OPEN' | 'CLOSED';

/**
 * Trading hours configuration for a symbol
 */
export interface TradingHours {
  open: string;
  close: string;
  timezone: string;
  days: string[];
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// METADATA TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Indicator response metadata
 */
export interface IndicatorMetadata {
  symbol: string;
  timeframe: string;
  tier: 'FREE' | 'PRO';
  bars_returned: number;
  data_source?: 'postgresql' | 'cache';
  last_sync?: string;
  pro_indicators_enabled: boolean;
  market_status?: MarketStatus;
  trading_hours?: TradingHours;
  next_market_open?: string | null;
  dst_active?: boolean;
  server_utc_offset?: 2 | 3;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPLETE INDICATOR DATA
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Complete indicator data response
 * Matches the OpenAPI IndicatorData schema
 */
export interface IndicatorData {
  ohlc: OHLCBar[];
  fractals: Fractals;
  horizontal_trendlines: HorizontalTrendlines;
  diagonal_trendlines: DiagonalTrendlines;
  momentum_candles: MomentumCandle[];
  keltner_channels: KeltnerChannels;
  tema: (number | null)[];
  hrma: (number | null)[];
  smma: (number | null)[];
  zigzag: ZigZag;
  metadata?: IndicatorMetadata;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DATABASE ROW TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Raw database row from PostgreSQL
 * JSON columns are parsed from JSONB
 */
export interface IndicatorDbRow {
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

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// API RESPONSE TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Successful indicator data response
 */
export interface IndicatorDataResponse {
  success: true;
  data: IndicatorData;
}

/**
 * Error response
 */
export interface ErrorResponse {
  success: false;
  error: string;
  message?: string;
  tier?: 'FREE' | 'PRO';
  accessible_symbols?: string[];
  accessible_timeframes?: string[];
  upgrade_required?: boolean;
}

/**
 * Health check response
 */
export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  components: {
    postgresql: {
      connected: boolean;
      tables: number;
      latency_ms: number;
    };
    redis?: {
      connected: boolean;
      hit_rate: number;
      latency_ms: number;
    };
    data_freshness?: {
      last_sync: string;
      sync_interval_seconds: number;
      symbols_updated: number;
    };
  };
}

/**
 * Symbols response
 */
export interface SymbolsResponse {
  success: true;
  tier: 'FREE' | 'PRO';
  symbols: string[];
  total_count: number;
}

/**
 * Timeframes response
 */
export interface TimeframesResponse {
  success: true;
  tier: 'FREE' | 'PRO';
  timeframes: string[];
  total_count: number;
}
