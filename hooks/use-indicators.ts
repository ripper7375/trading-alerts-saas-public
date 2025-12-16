'use client';

import { useCallback, useEffect, useState } from 'react';

import type { Tier } from '@/lib/tier-config';

/**
 * Candlestick data structure
 */
interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * Line point data structure
 */
interface LinePoint {
  time: number;
  value: number;
}

/**
 * Fractal data structure
 */
interface FractalData {
  peaks: LinePoint[];
  bottoms: LinePoint[];
}

/**
 * Indicator data structure from API
 */
export interface IndicatorData {
  ohlc: CandleData[];
  horizontal: Record<string, LinePoint[]>;
  diagonal: Record<string, LinePoint[]>;
  fractals: FractalData;
  metadata?: {
    symbol: string;
    timeframe: string;
    bars: number;
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
 * React hook for fetching indicator data from the API.
 * Handles loading, error, and success states with automatic refetch.
 *
 * Features:
 * - Fetches OHLC data, horizontal lines, diagonal lines, and fractals
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
