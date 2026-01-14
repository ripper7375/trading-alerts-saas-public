'use client';

import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  ColorType,
} from 'lightweight-charts';
import { useEffect, useRef, useState, useCallback } from 'react';

import type { Tier } from '@/lib/tier-config';

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
 * OHLCV data structure from API (Part 6 or Part 20)
 */
interface OHLCVData {
  ohlcv?: CandleData[];
  ohlc?: CandleData[]; // Backward compatibility
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
  data: OHLCVData;
  tier: Tier;
  requestedAt: string;
}

/**
 * TradingChart Component
 *
 * Displays a TradingView-style candlestick chart using lightweight-charts.
 * Fetches OHLCV data from the indicators API and renders with dark theme.
 *
 * Features:
 * - Candlestick chart with OHLCV data
 * - Auto-refresh based on tier (FREE: 60s, PRO: 30s)
 * - Responsive design with resize handling
 *
 * NOTE: Fractal plots and trendlines are NOT included because they were
 * calculated incorrectly from OHLCV data. Only raw OHLCV candles are displayed.
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

  const [data, setData] = useState<OHLCVData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Refresh interval based on tier (FREE: 60s, PRO: 30s)
  const refreshInterval = tier === 'PRO' ? 30000 : 60000;

  /**
   * Fetch OHLCV data from API
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

    // Add candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    // Handle window resize
    const handleResize = (): void => {
      if (chartContainerRef.current && chartRef.current) {
        const newWidth =
          chartContainerRef.current.clientWidth ||
          chartContainerRef.current.parentElement?.clientWidth ||
          800;
        chartRef.current.applyOptions({ width: newWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return (): void => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        candleSeriesRef.current = null;
      }
    };
  }, []);

  /**
   * Update chart data when data changes
   */
  useEffect(() => {
    if (!data || !candleSeriesRef.current) return;

    // Handle both ohlcv and ohlc field names (backward compatibility)
    const ohlcData = data.ohlcv || data.ohlc;

    if (ohlcData && ohlcData.length > 0) {
      // Set candlestick data
      candleSeriesRef.current.setData(ohlcData);

      // Fit content on first load
      if (isFirstLoadRef.current && chartRef.current) {
        chartRef.current.timeScale().fitContent();
        isFirstLoadRef.current = false;
      }
    }
  }, [data]);

  /**
   * Initial data fetch and periodic refresh
   */
  useEffect(() => {
    // Fetch immediately
    void fetchData();

    // Set up periodic refresh
    const intervalId = setInterval(() => {
      void fetchData();
    }, refreshInterval);

    return (): void => {
      clearInterval(intervalId);
    };
  }, [fetchData, refreshInterval]);

  return (
    <div className="w-full space-y-4">
      {/* Chart header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {symbol}/{timeframe}
        </h2>
        {lastUpdated && (
          <span className="text-sm text-muted-foreground">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Chart container */}
      <div className="relative rounded-lg border bg-card p-4">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50">
            <div className="text-center">
              <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Loading chart...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50">
            <div className="text-center text-destructive">
              <p className="font-semibold">Error loading chart</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <div ref={chartContainerRef} className="w-full" />
      </div>

      {/* Chart info */}
      <div className="text-sm text-muted-foreground">
        <p>Displaying OHLCV candlestick data only</p>
        <p>
          Refresh interval: {tier === 'PRO' ? '30' : '60'} seconds
        </p>
      </div>
    </div>
  );
}
