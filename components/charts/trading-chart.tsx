'use client';

import {
  createChart,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  ColorType,
} from 'lightweight-charts';
import { useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';

import { useOhlcvSocket } from '@/hooks/use-ohlcv-socket';
import { useLocale } from '@/lib/context/locale-context';
import { useChartAppearance } from '@/components/providers/appearance-provider';

import { DrawingLayer } from './drawing/DrawingLayer';
import { useFiredAlertMarkers } from './drawing/useFiredAlertMarkers';
import { MtfToggle } from './mtf/MtfToggle';
import { useMtfOverlay } from './mtf/useMtfOverlay';

/**
 * TradingChart Props
 */
interface TradingChartProps {
  symbol: string;
  timeframe: string;
}

/** lightweight-charts renders to a <canvas> -- it can't read CSS custom
 * properties or the .dark class, so its chrome (background/text/grid/
 * borders/crosshair) has to be told the resolved theme directly and kept
 * in sync via applyOptions() whenever it changes. */
function chartChromeColors(
  theme: 'light' | 'dark',
  gridOpacityDecimal: number
) {
  return theme === 'dark'
    ? {
        background: '#0a0e17',
        text: '#94a3b8',
        grid: `rgba(148, 163, 184, ${gridOpacityDecimal})`,
        border: '#1e293b',
        crosshair: '#758696',
        crosshairLabelBg: '#1e293b',
      }
    : {
        background: '#ffffff',
        text: '#334155',
        grid: `rgba(203, 213, 225, ${gridOpacityDecimal})`,
        border: '#cbd5e1',
        crosshair: '#94a3b8',
        crosshairLabelBg: '#e2e8f0',
      };
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
  const { t } = useLocale();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const isFirstLoadRef = useRef(true);

  // Exposed once the chart + series exist, so the drawing layer can mount.
  const [chartApi, setChartApi] = useState<IChartApi | null>(null);
  const [seriesApi, setSeriesApi] = useState<ISeriesApi<'Candlestick'> | null>(
    null
  );

  const { data, isConnected, isLoading, error } = useOhlcvSocket(
    symbol,
    timeframe
  );

  const { chartUpColor, chartDownColor, gridOpacityDecimal, resolvedTheme } =
    useChartAppearance();

  // Render "alert fired here" markers when a line-touch alert fires.
  useFiredAlertMarkers(seriesApi, symbol, timeframe);

  // V8 PRO feature: multi-timeframe visualization — overlay the M5
  // equal-distance channel on the M15 chart (v2.29 design). Only offered
  // on M15 (overlaying M5 structure onto its own chart adds nothing).
  const { data: session } = useSession();
  const isPro = session?.user?.tier === 'PRO';
  const mtfAvailable = timeframe.toUpperCase() === 'M15';
  const [mtfEnabled, setMtfEnabled] = useState(false);
  const { isLoading: mtfLoading, error: mtfError } = useMtfOverlay(
    chartApi,
    isPro && mtfAvailable && mtfEnabled,
    { symbol, sourceTimeframe: 'M5' }
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

    const chrome = chartChromeColors(resolvedTheme, gridOpacityDecimal);

    const chart = createChart(chartContainerRef.current, {
      width: containerWidth,
      height: 600,
      layout: {
        background: { type: ColorType.Solid, color: chrome.background },
        textColor: chrome.text,
      },
      grid: {
        vertLines: { color: chrome.grid },
        horzLines: { color: chrome.grid },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          width: 1,
          color: chrome.crosshair,
          style: 3,
          labelBackgroundColor: chrome.crosshairLabelBg,
        },
        horzLine: {
          width: 1,
          color: chrome.crosshair,
          style: 3,
          labelBackgroundColor: chrome.crosshairLabelBg,
        },
      },
      rightPriceScale: {
        borderColor: chrome.border,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: chrome.border,
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: chartUpColor,
      downColor: chartDownColor,
      borderVisible: false,
      wickUpColor: chartUpColor,
      wickDownColor: chartDownColor,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    setChartApi(chart);
    setSeriesApi(candleSeries);

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
        setChartApi(null);
        setSeriesApi(null);
      }
    };
    // Only the initial mount value is used here -- this effect creates the
    // chart exactly once (guarded above by `if (chartRef.current) return`).
    // Live appearance changes are applied via the reactive effect below
    // instead of tearing down and recreating the whole chart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Reactively apply theme/candle-color/grid-opacity changes to the
   * already-created chart -- lightweight-charts renders to a <canvas>, so
   * picking a new Theme Mode or candle color in Settings has no effect on
   * it unless we explicitly push the new colors via applyOptions().
   */
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current) return;
    const chrome = chartChromeColors(resolvedTheme, gridOpacityDecimal);
    chartRef.current.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: chrome.background },
        textColor: chrome.text,
      },
      grid: {
        vertLines: { color: chrome.grid },
        horzLines: { color: chrome.grid },
      },
      crosshair: {
        vertLine: {
          color: chrome.crosshair,
          labelBackgroundColor: chrome.crosshairLabelBg,
        },
        horzLine: {
          color: chrome.crosshair,
          labelBackgroundColor: chrome.crosshairLabelBg,
        },
      },
      rightPriceScale: { borderColor: chrome.border },
      timeScale: { borderColor: chrome.border },
    });
    candleSeriesRef.current.applyOptions({
      upColor: chartUpColor,
      downColor: chartDownColor,
      wickUpColor: chartUpColor,
      wickDownColor: chartDownColor,
    });
  }, [resolvedTheme, gridOpacityDecimal, chartUpColor, chartDownColor]);

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
        <div className="flex items-center gap-3">
          {mtfAvailable && (
            <MtfToggle
              isPro={isPro}
              enabled={mtfEnabled}
              isLoading={mtfLoading}
              onToggle={setMtfEnabled}
            />
          )}
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            {isConnected
              ? t('charts.live', 'Live')
              : t('charts.disconnected', 'Disconnected')}
          </span>
        </div>
      </div>

      {mtfEnabled && mtfError && (
        <p className="text-sm text-destructive">{mtfError}</p>
      )}

      {/* Chart container */}
      <div className="relative rounded-lg border bg-card p-4">
        {isLoading && (
          <div className="bg-background/50 absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">
                {t('charts.connecting', 'Connecting to live data...')}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-background/50 absolute inset-0 flex items-center justify-center">
            <div className="text-center text-destructive">
              <p className="font-semibold">
                {t('charts.error_loading', 'Error loading chart')}
              </p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <div className="relative w-full">
          <div ref={chartContainerRef} className="w-full" />
          {chartApi && seriesApi && (
            <DrawingLayer
              chart={chartApi}
              series={seriesApi}
              symbol={symbol}
              timeframe={timeframe}
            />
          )}
        </div>
      </div>

      {/* Chart info */}
      <div className="text-sm text-muted-foreground">
        <p>
          {t(
            'charts.displaying_ohlcv',
            'Displaying live OHLCV candlestick data'
          )}
        </p>
        <p>
          {t('charts.updates_realtime', 'Updates in real-time via WebSocket')}
        </p>
      </div>
    </div>
  );
}
