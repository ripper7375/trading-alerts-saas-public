'use client';

import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  ColorType,
} from 'lightweight-charts';
import { useEffect, useRef } from 'react';

import { useOhlcvSocket } from '@/hooks/use-ohlcv-socket';

/**
 * TradingChart Props
 */
interface TradingChartProps {
  symbol: string;
  timeframe: string;
}

/**
 * TradingChart Component
 *
 * Displays a TradingView-style candlestick chart using lightweight-charts.
 * Receives OHLCV data via Socket.IO from the Flask MT5 service — no HTTP
 * polling. The backend pushes updates when the bar timestamp advances (new
 * candle) or the current bar's close price changes (live tick), checked
 * every 0.25s. Both FREE and PRO tiers receive real-time updates.
 */
export function TradingChart({
  symbol,
  timeframe,
}: TradingChartProps): React.JSX.Element {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const isFirstLoadRef = useRef(true);

  const { data, isConnected, isLoading, error } = useOhlcvSocket(
    symbol,
    timeframe
  );

  /**
   * Initialize chart when container is available
   */
  useEffect(() => {
    if (!chartContainerRef.current) return;
    if (chartRef.current) return;

    const containerWidth =
      chartContainerRef.current.clientWidth ||
      chartContainerRef.current.parentElement?.clientWidth ||
      800;

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
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: '#2a2e39',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

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
   * Update chart data whenever Socket.IO delivers new OHLCV data
   */
  useEffect(() => {
    if (!data || !candleSeriesRef.current) return;

    const ohlcvData = data.ohlcv;
    if (!ohlcvData || ohlcvData.length === 0) return;

    // Cast timestamps to UTCTimestamp as required by lightweight-charts
    const chartData = ohlcvData.map((bar) => ({
      time: bar.time as UTCTimestamp,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }));

    candleSeriesRef.current.setData(chartData);

    if (isFirstLoadRef.current && chartRef.current) {
      chartRef.current.timeScale().fitContent();
      isFirstLoadRef.current = false;
    }
  }, [data]);

  return (
    <div className="w-full space-y-4">
      {/* Chart header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {symbol}/{timeframe}
        </h2>
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          {isConnected ? 'Live' : 'Disconnected'}
        </span>
      </div>

      {/* Chart container */}
      <div className="relative rounded-lg border bg-card p-4">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50">
            <div className="text-center">
              <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">
                Connecting to live data...
              </p>
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
        <p>Displaying live OHLCV candlestick data</p>
        <p>Updates in real-time via WebSocket</p>
      </div>
    </div>
  );
}
