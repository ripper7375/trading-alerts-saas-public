'use client';

import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type Time,
  ColorType,
} from 'lightweight-charts';
import { useEffect, useRef, useState, useCallback } from 'react';

import type { Tier } from '@/lib/tier-config';

import { IndicatorOverlay } from './indicator-overlay';

/**
 * TradingChart Props
 */
interface TradingChartProps {
  symbol: string;
  timeframe: string;
  tier: Tier;
}

/**
 * Candlestick data structure
 */
interface CandleData {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * Indicator data structure from API
 */
interface IndicatorData {
  ohlc: CandleData[];
  horizontal: Record<string, Array<{ time: number; value: number }>>;
  diagonal: Record<string, Array<{ time: number; value: number }>>;
  fractals: {
    peaks: Array<{ time: number; value: number }>;
    bottoms: Array<{ time: number; value: number }>;
  };
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
 * TradingChart Component
 *
 * Displays a TradingView-style candlestick chart using lightweight-charts.
 * Fetches data from the indicators API and renders with dark theme.
 *
 * Features:
 * - Candlestick chart with OHLC data
 * - Indicator overlays (horizontal/diagonal lines, fractals)
 * - Auto-refresh based on tier (FREE: 60s, PRO: 30s)
 * - Responsive design with resize handling
 */
export function TradingChart({
  symbol,
  timeframe,
  tier,
}: TradingChartProps): React.JSX.Element {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const isFirstLoadRef = useRef(true);

  const [data, setData] = useState<IndicatorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Refresh interval based on tier (FREE: 60s, PRO: 30s)
  const refreshInterval = tier === 'PRO' ? 30000 : 60000;

  /**
   * Fetch indicator data from API
   */
  const fetchData = useCallback(async (): Promise<void> => {
    try {
      setError(null);

      const response = await fetch(`/api/indicators/${symbol}/${timeframe}`);
      const result:
        | ApiResponse
        | { success: false; error: string; message: string } =
        await response.json();

      if (!response.ok || !result.success) {
        const errorResult = result as {
          success: false;
          error: string;
          message: string;
        };
        throw new Error(
          errorResult.message || errorResult.error || 'Failed to fetch data'
        );
      }

      const successResult = result as ApiResponse;
      setData(successResult.data);
      setLastUpdated(new Date());
    } catch (err) {
      let errorMessage = 'Failed to fetch chart data';

      if (err instanceof Error) {
        // Handle network errors specifically
        if (
          err.message === 'fetch failed' ||
          err.message.includes('NetworkError') ||
          err.message.includes('Failed to fetch')
        ) {
          errorMessage =
            'Unable to connect to the data service. Please check your connection and try again.';
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
      console.error('Chart data fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [symbol, timeframe]);

  /**
   * Initialize chart when container is available
   */
  useEffect(() => {
    if (!chartContainerRef.current) return;
    // Don't re-create if already exists
    if (chartRef.current) return;

    // Get container width, fallback to parent width or default
    const containerWidth =
      chartContainerRef.current.clientWidth ||
      chartContainerRef.current.parentElement?.clientWidth ||
      800;

    console.log('Initializing chart with width:', containerWidth);

    // Create chart with dark TradingView theme
    const chart = createChart(chartContainerRef.current, {
      width: containerWidth,
      height: 600,
      layout: {
        background: { type: ColorType.Solid, color: '#1e222d' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2a2e39' },
        horzLines: { color: '#2a2e39' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          width: 1,
          color: '#758696',
          style: 3,
          labelBackgroundColor: '#2a2e39',
        },
        horzLine: {
          width: 1,
          color: '#758696',
          style: 3,
          labelBackgroundColor: '#2a2e39',
        },
      },
      rightPriceScale: {
        borderColor: '#2a2e39',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: '#2a2e39',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // Add candlestick series with TradingView colors
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#00c853',
      downColor: '#f23645',
      borderUpColor: '#00c853',
      borderDownColor: '#f23645',
      wickUpColor: '#00c853',
      wickDownColor: '#f23645',
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    // Handle window resize
    const handleResize = (): void => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    // Use ResizeObserver for container resize
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !chartRef.current) return;
      const { width } = entry.contentRect;
      chartRef.current.applyOptions({ width });
    });

    resizeObserver.observe(chartContainerRef.current);
    window.addEventListener('resize', handleResize);

    // Cleanup
    return (): void => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
    };
  }, []);

  /**
   * Fetch data on mount and symbol/timeframe change
   */
  useEffect(() => {
    setIsLoading(true);
    fetchData();
  }, [fetchData]);

  /**
   * Set up auto-refresh interval
   */
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchData();
    }, refreshInterval);

    return (): void => {
      clearInterval(intervalId);
    };
  }, [fetchData, refreshInterval]);

  /**
   * Update chart data when data changes
   */
  useEffect(() => {
    if (!data?.ohlc || !candleSeriesRef.current || !chartRef.current) {
      console.log('Chart update skipped:', {
        hasData: !!data?.ohlc,
        ohlcLength: data?.ohlc?.length,
        hasCandleSeries: !!candleSeriesRef.current,
        hasChart: !!chartRef.current,
      });
      return;
    }

    console.log('Setting chart data:', data.ohlc.length, 'candles');
    // Set candlestick data
    candleSeriesRef.current.setData(data.ohlc);

    // Add fractal markers
    if (data.fractals) {
      const markers: Array<{
        time: Time;
        position: 'aboveBar' | 'belowBar';
        color: string;
        shape: 'arrowDown' | 'arrowUp';
        text: string;
      }> = [];

      // Peak markers (red, above bar)
      if (data.fractals.peaks) {
        data.fractals.peaks.forEach((peak) => {
          markers.push({
            time: peak.time as Time,
            position: 'aboveBar',
            color: '#f23645',
            shape: 'arrowDown',
            text: 'P',
          });
        });
      }

      // Bottom markers (green, below bar)
      if (data.fractals.bottoms) {
        data.fractals.bottoms.forEach((bottom) => {
          markers.push({
            time: bottom.time as Time,
            position: 'belowBar',
            color: '#00c853',
            shape: 'arrowUp',
            text: 'B',
          });
        });
      }

      // Sort markers by time and set them
      markers.sort((a, b) => (a.time as number) - (b.time as number));
      candleSeriesRef.current.setMarkers(markers);
    }

    // Only fit content on first load to avoid disrupting user's view
    if (isFirstLoadRef.current) {
      chartRef.current.timeScale().fitContent();
      isFirstLoadRef.current = false;
    }

    // Log last candle price for debugging
    const lastCandle = data.ohlc[data.ohlc.length - 1];
    if (lastCandle) {
      console.log('Latest candle:', {
        time: new Date(lastCandle.time * 1000).toLocaleString(),
        close: lastCandle.close,
      });
    }
  }, [data]);

  /**
   * Format time ago string
   */
  const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="relative">
      {/* Loading overlay */}
      {isLoading && !data && (
        <div className="absolute inset-0 z-10 flex h-[600px] items-center justify-center rounded-lg bg-[#1e222d]">
          <div className="text-center">
            <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
            <p className="text-[#d1d4dc]">Loading chart data...</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && !data && (
        <div className="absolute inset-0 z-10 flex h-[600px] items-center justify-center rounded-lg bg-[#1e222d]">
          <div className="max-w-md px-6 text-center">
            <div className="mb-3 text-4xl">⚠️</div>
            <p className="mb-2 font-semibold text-red-400">
              Failed to load chart
            </p>
            <p className="mb-4 text-sm text-gray-400">{error}</p>
            <button
              onClick={fetchData}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
      {/* Status bar */}
      <div className="mb-2 flex items-center justify-between px-2">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {symbol}/{timeframe}
          </span>
          {data?.ohlc &&
            data.ohlc.length > 0 &&
            ((): React.JSX.Element | null => {
              const lastCandle = data.ohlc[data.ohlc.length - 1];
              if (!lastCandle) return null;
              return (
                <span className="font-mono text-sm text-gray-800">
                  {lastCandle.close.toFixed(symbol.includes('JPY') ? 3 : 5)}
                </span>
              );
            })()}
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          {lastUpdated && <span>Updated: {formatTimeAgo(lastUpdated)}</span>}
          <span>Auto-refresh: {tier === 'PRO' ? '30s' : '60s'}</span>
          {isLoading && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500"></span>
              Updating...
            </span>
          )}
        </div>
      </div>

      {/* Chart container */}
      <div
        ref={chartContainerRef}
        className="min-h-[600px] w-full overflow-hidden rounded-lg border border-gray-700"
      />

      {/* Indicator overlay component for price lines */}
      {data && chartRef.current && candleSeriesRef.current && (
        <IndicatorOverlay
          chart={chartRef.current}
          candleSeries={candleSeriesRef.current}
          horizontal={data.horizontal}
          diagonal={data.diagonal}
        />
      )}

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 px-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#f23645]"></span>
          <span className="text-gray-600">Resistance (P-P1)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#00c853]"></span>
          <span className="text-gray-600">Support (B-B1)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#1e88e5]"></span>
          <span className="text-gray-600">Ascending Trend</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#ff6b35]"></span>
          <span className="text-gray-600">Descending Trend</span>
        </div>
      </div>
    </div>
  );
}
