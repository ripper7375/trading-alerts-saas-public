'use client';

import { useCallback, useEffect, useState } from 'react';

import type { Tier } from '@/lib/tier-config';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 63-COLUMN SCHEMA DATA STRUCTURES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * OHLCV candlestick data (from system columns)
 */
interface CandleData {
  time: number; // timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
}

/**
 * FREE tier: Fractal Diagonal Lines data (8 columns)
 */
interface FractalDiagonalData {
  diag_asc_line_1: number | null;
  diag_asc_line_2: number | null;
  diag_asc_line_3: number | null;
  diag_desc_line_1: number | null;
  diag_desc_line_2: number | null;
  diag_desc_line_3: number | null;
  diag_high_map: number | null;
  diag_low_map: number | null;
}

/**
 * FREE tier: Fractal Horizontal Lines data (8 columns)
 */
interface FractalHorizontalData {
  horiz_peak_line_1: number | null;
  horiz_peak_line_2: number | null;
  horiz_peak_line_3: number | null;
  horiz_bottom_line_1: number | null;
  horiz_bottom_line_2: number | null;
  horiz_bottom_line_3: number | null;
  horiz_high_map: number | null;
  horiz_low_map: number | null;
}

/**
 * PRO tier: Moving Averages data (3 columns)
 */
interface MovingAveragesData {
  tema: number | null;
  hrma: number | null;
  smma: number | null;
}


/**
 * PRO tier: Body Momentum data (3 columns)
 */
interface BodyMomentumData {
  body_size: number | null;
  body_direction: number | null;
  body_classification: number | null;
}

/**
 * PRO tier: Heiken Ashi data (8 columns)
 */
interface HeikenAshiData {
  ha_open: number | null;
  ha_high: number | null;
  ha_low: number | null;
  ha_close: number | null;
  ha_color: number | null;
  ha_trend: number | null;
  ha_body_size: number | null;
  ha_body_zscore: number | null;
}

/**
 * PRO tier: Keltner Channels data (10 columns)
 */
interface KeltnerChannelsData {
  kc_ultra_extreme_upper: number | null;
  kc_extreme_upper: number | null;
  kc_uppermost: number | null;
  kc_upper: number | null;
  kc_upper_middle: number | null;
  kc_lower_middle: number | null;
  kc_lower: number | null;
  kc_lowermost: number | null;
  kc_extreme_lower: number | null;
  kc_ultra_extreme_lower: number | null;
}

/**
 * PRO tier: Support & Resistance data (8 columns)
 */
interface SupportResistanceData {
  sr_1: number | null;
  sr_2: number | null;
  sr_3: number | null;
  sr_4: number | null;
  sr_5: number | null;
  sr_6: number | null;
  sr_7: number | null;
  sr_8: number | null;
}

/**
 * PRO tier: ZigZag + EMA data (3 columns)
 */
interface ZigZagData {
  zigzag_high: number | null;
  zigzag_low: number | null;
  /** Exponential Moving Average (renamed from ema_26 in v3.0) */
  ema: number | null;
}

/**
 * PRO tier: Dual TEMA High/Low data (2 columns)
 */
interface DualTemaHighLowData {
  dual_tema_high: number | null;
  dual_tema_low: number | null;
}

/**
 * PRO tier: Pinbar Detection data (1 column)
 */
interface PinbarData {
  pinbar: number | null;
}

/**
 * Single market data row from 61-column schema
 */
export interface MarketDataRow extends CandleData {
  // FREE tier indicators (16 columns)
  fractal_diagonal?: FractalDiagonalData;
  fractal_horizontal?: FractalHorizontalData;
  // PRO tier indicators (38 columns)
  moving_averages?: MovingAveragesData;
  body_momentum?: BodyMomentumData;
  heiken_ashi?: HeikenAshiData;
  keltner_channels?: KeltnerChannelsData;
  support_resistance?: SupportResistanceData;
  zigzag?: ZigZagData;
  dual_tema_hl?: DualTemaHighLowData;
  pinbar_detection?: PinbarData;
}

/**
 * Indicator data structure from API (63-column schema)
 * Replaces old nested JSON structure with flat column data
 */
export interface IndicatorData {
  /** OHLCV candlestick data */
  ohlc: CandleData[];
  /** Market data rows with indicator columns based on tier */
  rows: MarketDataRow[];
  /** Metadata about the response */
  metadata?: {
    symbol: string;
    timeframe: string;
    bars: number;
    tier: Tier;
    columns: string[]; // List of columns included based on tier
  };
}

/**
 * API Response structure
 */
interface ApiResponse {
  success: boolean;
  data: IndicatorData;
  tier: Tier;
  requestedAt: string;
}

/**
 * API Error Response structure
 */
interface ApiErrorResponse {
  success: false;
  error: string;
  message: string;
  upgradeRequired?: boolean;
  upgradeUrl?: string;
}

/**
 * useIndicators hook return type
 */
interface UseIndicatorsResult {
  data: IndicatorData | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  lastUpdated: Date | null;
}

/**
 * useIndicators Hook
 *
 * React hook for fetching indicator data from the 63-column schema API.
 * Handles loading, error, and success states with automatic refetch.
 *
 * 63-Column Schema Structure:
 * - System columns (9): timestamp, symbol, open, high, low, close, volume, timeframe, collected_at
 * - FREE tier indicators (16 columns): fractal_diagonal (8) + fractal_horizontal (8)
 * - PRO tier indicators (38 columns): moving_averages (3) + body_momentum (3) + heiken_ashi (8) + keltner_channels (10) + support_resistance (8) + zigzag (3) + dual_tema_hl (2) + pinbar_detection (1)
 *
 * Features:
 * - Fetches OHLC data and tier-appropriate indicator columns
 * - Auto-refetch based on tier (FREE: 60s, PRO: 30s)
 * - Error handling with user-friendly messages
 * - Tier validation before fetch
 *
 * @param symbol - Trading symbol (e.g., 'XAUUSD')
 * @param timeframe - Timeframe (e.g., 'H1')
 * @param tier - User tier ('FREE' or 'PRO')
 * @returns Indicator data, loading state, error, refetch function, and last updated time
 *
 * @example
 * const { data, isLoading, error, refetch } = useIndicators('XAUUSD', 'H1', 'FREE');
 * // FREE tier: data.rows includes fractal_diagonal & fractal_horizontal
 * // PRO tier: data.rows includes all indicator groups
 */
export function useIndicators(
  symbol: string,
  timeframe: string,
  tier: Tier = 'FREE'
): UseIndicatorsResult {
  const [data, setData] = useState<IndicatorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Refresh interval based on tier (FREE: 60s, PRO: 30s)
  const refetchInterval = tier === 'PRO' ? 30000 : 60000;

  /**
   * Fetch indicator data from API
   */
  const fetchIndicators = useCallback(async (): Promise<void> => {
    try {
      setError(null);

      const response = await fetch(`/api/indicators/${symbol}/${timeframe}`);
      const result = (await response.json()) as ApiResponse | ApiErrorResponse;

      if (!response.ok || !result.success) {
        const errorResult = result as ApiErrorResponse;
        throw new Error(
          errorResult.message ||
            errorResult.error ||
            'Failed to fetch indicator data'
        );
      }

      const successResult = result as ApiResponse;
      setData(successResult.data);
      setLastUpdated(new Date());
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch indicator data';
      setError(new Error(errorMessage));
      console.error('useIndicators fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [symbol, timeframe]);

  /**
   * Manual refetch function
   */
  const refetch = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    await fetchIndicators();
  }, [fetchIndicators]);

  /**
   * Fetch data on mount and when symbol/timeframe changes
   */
  useEffect(() => {
    setIsLoading(true);
    setData(null);
    setError(null);
    fetchIndicators();
  }, [fetchIndicators]);

  /**
   * Set up auto-refetch interval
   */
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchIndicators();
    }, refetchInterval);

    return () => clearInterval(intervalId);
  }, [fetchIndicators, refetchInterval]);

  return {
    data,
    isLoading,
    error,
    refetch,
    lastUpdated,
  };
}

/**
 * Helper function to check if indicator data has valid OHLC
 */
export function hasValidOHLC(data: IndicatorData | null): boolean {
  return Boolean(data?.ohlc && data.ohlc.length > 0);
}

/**
 * Helper function to check if indicator data has valid rows
 */
export function hasValidRows(data: IndicatorData | null): boolean {
  return Boolean(data?.rows && data.rows.length > 0);
}

/**
 * Helper function to get specific indicator data from rows
 * @param data - The indicator data response
 * @param indicator - The indicator group to extract (e.g., 'fractal_diagonal')
 */
export function getIndicatorFromRows<K extends keyof MarketDataRow>(
  data: IndicatorData | null,
  indicator: K
): Array<MarketDataRow[K]> {
  if (!data?.rows) return [];
  return data.rows.map((row) => row[indicator]).filter((v) => v !== undefined);
}

/**
 * Helper function to get the latest price from OHLC data
 */
export function getLatestPrice(data: IndicatorData | null): number | null {
  if (!data?.ohlc || data.ohlc.length === 0) return null;
  const lastCandle = data.ohlc[data.ohlc.length - 1];
  return lastCandle?.close ?? null;
}

/**
 * Helper function to get price change from OHLC data
 */
export function getPriceChange(data: IndicatorData | null): {
  value: number;
  percent: number;
  isPositive: boolean;
} | null {
  if (!data?.ohlc || data.ohlc.length < 2) return null;

  const latest = data.ohlc[data.ohlc.length - 1];
  const previous = data.ohlc[data.ohlc.length - 2];

  if (!latest || !previous) return null;

  const change = latest.close - previous.close;
  const percentChange = (change / previous.close) * 100;

  return {
    value: change,
    percent: percentChange,
    isPositive: change >= 0,
  };
}

/**
 * Helper function to format time since last update
 */
export function formatTimeSince(date: Date | null): string {
  if (!date) return 'Never';

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;

  return `${Math.floor(seconds / 86400)}d ago`;
}
