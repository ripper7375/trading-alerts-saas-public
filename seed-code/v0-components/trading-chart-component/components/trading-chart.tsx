'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type Time,
  CandlestickSeries,
  createSeriesMarkers,
} from 'lightweight-charts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { RefreshCw, Lock } from 'lucide-react';

interface TradingChartProps {
  tier?: 'FREE' | 'PRO';
  initialSymbol?: string;
  initialTimeframe?: string;
}

interface CandleData {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}

const FREE_SYMBOLS = ['XAUUSD', 'BTCUSD', 'EURUSD', 'USDJPY', 'US30'];
const PRO_SYMBOLS = [
  'XAUUSD',
  'BTCUSD',
  'EURUSD',
  'USDJPY',
  'US30',
  'GBPUSD',
  'USDCHF',
  'AUDUSD',
  'NZDUSD',
  'USDCAD',
  'SPX500',
  'NAS100',
  'CRUDE',
  'SILVER',
  'COPPER',
];

const FREE_TIMEFRAMES = [
  { value: 'H1', label: 'H1' },
  { value: 'H4', label: 'H4' },
  { value: 'D1', label: 'D1' },
];

const PRO_TIMEFRAMES = [
  { value: 'M5', label: 'M5' },
  { value: 'M15', label: 'M15' },
  { value: 'M30', label: 'M30' },
  { value: 'H1', label: 'H1' },
  { value: 'H2', label: 'H2' },
  { value: 'H4', label: 'H4' },
  { value: 'H8', label: 'H8' },
  { value: 'H12', label: 'H12' },
  { value: 'D1', label: 'D1' },
];

export default function TradingChart({
  tier = 'FREE',
  initialSymbol = 'XAUUSD',
  initialTimeframe = 'H1',
}: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const [symbol, setSymbol] = useState(initialSymbol);
  const [timeframe, setTimeframe] = useState(initialTimeframe);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(5);
  const [nextUpdate, setNextUpdate] = useState(tier === 'FREE' ? 55 : 25);
  const [currentPrice, setCurrentPrice] = useState(2650.5);

  const symbols = tier === 'FREE' ? FREE_SYMBOLS : PRO_SYMBOLS;
  const timeframes = tier === 'FREE' ? FREE_TIMEFRAMES : PRO_TIMEFRAMES;
  const updateInterval = tier === 'FREE' ? 60 : 30;

  // Generate mock candlestick data
  const generateMockData = (basePrice = 2650, count = 50): CandleData[] => {
    const data: CandleData[] = [];
    let time = Math.floor(Date.now() / 1000) - count * 3600; // Start from `count` hours ago
    let price = basePrice;

    for (let i = 0; i < count; i++) {
      const change = (Math.random() - 0.5) * 10;
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * 5;
      const low = Math.min(open, close) - Math.random() * 5;

      data.push({
        time: time as UTCTimestamp,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
      });

      time += 3600; // 1 hour
      price = close;
    }

    return data;
  };

  // Initialize chart
  useEffect(() => {
    console.log('[v0] Initializing chart...');
    if (!chartContainerRef.current) {
      console.log('[v0] Chart container ref not available');
      return;
    }

    try {
      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 500,
        layout: {
          background: { color: '#ffffff' },
          textColor: '#333',
        },
        grid: {
          vertLines: { color: '#f0f0f0' },
          horzLines: { color: '#f0f0f0' },
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          borderColor: '#e0e0e0',
        },
        rightPriceScale: {
          borderColor: '#e0e0e0',
        },
        crosshair: {
          mode: 1,
          vertLine: {
            width: 1,
            color: '#9598a1',
            style: 3,
          },
          horzLine: {
            width: 1,
            color: '#9598a1',
            style: 3,
          },
        },
      });

      console.log('[v0] Chart created, adding candlestick series...');

      const candlestickSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#10b981',
        downColor: '#ef4444',
        borderUpColor: '#059669',
        borderDownColor: '#dc2626',
        wickUpColor: '#059669',
        wickDownColor: '#dc2626',
      });

      console.log('[v0] Candlestick series added successfully');

      chartRef.current = chart;
      candlestickSeriesRef.current = candlestickSeries;

      // Handle resize
      resizeObserverRef.current = new ResizeObserver((entries) => {
        if (entries.length === 0 || !chartRef.current) return;
        const { width, height } = entries[0].contentRect;
        chartRef.current.applyOptions({
          width,
          height: Math.max(400, Math.min(500, height)),
        });
      });

      resizeObserverRef.current.observe(chartContainerRef.current);

      console.log('[v0] Chart initialization complete');
    } catch (error) {
      console.error('[v0] Error initializing chart:', error);
    }

    return () => {
      console.log('[v0] Cleaning up chart...');
      resizeObserverRef.current?.disconnect();
      chartRef.current?.remove();
    };
  }, []);

  // Update data when symbol or timeframe changes
  useEffect(() => {
    console.log('[v0] Updating chart data for', symbol, timeframe);
    if (!candlestickSeriesRef.current) {
      console.log('[v0] Candlestick series not available yet');
      return;
    }

    try {
      const mockData = generateMockData(symbol === 'XAUUSD' ? 2650 : 50000, 50);
      console.log('[v0] Generated', mockData.length, 'candles');

      candlestickSeriesRef.current.setData(mockData);
      console.log('[v0] Data set successfully');

      // Update current price from last candle
      const lastCandle = mockData[mockData.length - 1];
      setCurrentPrice(lastCandle.close);

      createSeriesMarkers(candlestickSeriesRef.current, [
        {
          time: mockData[10].time as Time,
          position: 'aboveBar',
          color: '#ef4444',
          shape: 'arrowDown',
          text: 'Peak',
        },
        {
          time: mockData[35].time as Time,
          position: 'belowBar',
          color: '#10b981',
          shape: 'arrowUp',
          text: 'Bottom',
        },
      ]);
      console.log('[v0] Markers added successfully');

      // Add custom price lines
      const resistancePrice = lastCandle.close + 4.7;
      const supportPrice = lastCandle.close - 5.5;

      const resistanceLine = candlestickSeriesRef.current.createPriceLine({
        price: resistancePrice,
        color: '#ef4444',
        lineWidth: 3,
        lineStyle: 0, // solid
        axisLabelVisible: true,
        title: 'P-P1 Resistance',
      });

      const supportLine = candlestickSeriesRef.current.createPriceLine({
        price: supportPrice,
        color: '#10b981',
        lineWidth: 3,
        lineStyle: 0,
        axisLabelVisible: true,
        title: 'B-B1 Support',
      });

      const currentPriceLine = candlestickSeriesRef.current.createPriceLine({
        price: lastCandle.close,
        color: '#f59e0b',
        lineWidth: 2,
        lineStyle: 2, // dashed
        axisLabelVisible: true,
        title: 'Current',
      });

      console.log('[v0] Price lines added successfully');

      // Cleanup price lines on next update
      return () => {
        console.log('[v0] Cleaning up price lines...');
        candlestickSeriesRef.current?.removePriceLine(resistanceLine);
        candlestickSeriesRef.current?.removePriceLine(supportLine);
        candlestickSeriesRef.current?.removePriceLine(currentPriceLine);
      };
    } catch (error) {
      console.error('[v0] Error updating chart data:', error);
    }
  }, [symbol, timeframe]);

  // Update countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate((prev) => {
        if (prev >= updateInterval - 1) {
          return 0;
        }
        return prev + 1;
      });
      setNextUpdate((prev) => {
        if (prev <= 1) {
          return updateInterval - 1;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [updateInterval]);

  const handleRefresh = () => {
    setIsLoading(true);
    // Simulate refresh
    setTimeout(() => {
      setIsLoading(false);
      setLastUpdate(0);
      setNextUpdate(updateInterval - 1);
      // Trigger data regeneration by toggling state
      setSymbol((prev) => prev);
    }, 500);
  };

  const handleCreateAlert = (type: 'resistance' | 'support') => {
    console.log(`Creating alert for ${type} line on ${symbol}`);
  };

  const resistancePrice = currentPrice + 4.7;
  const supportPrice = currentPrice - 5.5;
  const resistanceDistance = resistancePrice - currentPrice;
  const supportDistance = currentPrice - supportPrice;
  const resistancePercent = ((resistanceDistance / currentPrice) * 100).toFixed(
    2
  );
  const supportPercent = ((supportDistance / currentPrice) * 100).toFixed(2);

  return (
    <div className="space-y-4 w-full max-w-7xl mx-auto p-4">
      {/* Controls Bar */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Left Controls */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Symbol Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">
                Symbol:
              </label>
              <Select value={symbol} onValueChange={setSymbol}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Select symbol" />
                </SelectTrigger>
                <SelectContent>
                  {symbols.map((sym) => (
                    <SelectItem key={sym} value={sym}>
                      {sym}
                    </SelectItem>
                  ))}
                  {tier === 'FREE' && (
                    <SelectItem value="locked" disabled>
                      <span className="flex items-center gap-2">
                        <Lock className="size-3" />
                        +10 PRO symbols
                      </span>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Timeframe Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">
                Timeframe:
              </label>
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Select timeframe" />
                </SelectTrigger>
                <SelectContent>
                  {timeframes.map((tf) => (
                    <SelectItem key={tf.value} value={tf.value}>
                      {tf.label}
                    </SelectItem>
                  ))}
                  {tier === 'FREE' && (
                    <SelectItem value="locked" disabled>
                      <span className="flex items-center gap-2">
                        <Lock className="size-3" />
                        PRO only
                      </span>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="gap-2 bg-transparent"
            >
              <RefreshCw
                className={`size-4 ${isLoading ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </div>

          {/* Right Status */}
          <div className="text-sm text-gray-600">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span>Last updated: {lastUpdate}s ago</span>
              <span className="hidden sm:inline">|</span>
              <span>Next: {nextUpdate}s</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {tier === 'FREE'
                ? '⏱️ Updates every 60s'
                : '⚡ Updates every 30s'}
            </div>
          </div>
        </div>

        {/* Free Tier Message */}
        {tier === 'FREE' && (
          <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-md">
            <p className="text-xs text-amber-800">
              <strong>Upgrade to PRO</strong> for M5-H12 timeframes, 15 symbols,
              and 30s updates
            </p>
          </div>
        )}
      </div>

      {/* TradingView Chart Container */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div
          ref={chartContainerRef}
          id="trading-chart-container"
          className="w-full"
        />
      </div>

      {/* Info Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Resistance Card */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Horizontal Resistance (P-P1)
            </CardTitle>
            <CardDescription className="text-xs">
              Upper fractal boundary
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-3xl font-bold text-gray-900">
                ${resistancePrice.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                5 touches | 8.5° | 120 bars
              </div>
              <div className="text-xs text-gray-500 mt-1">
                +${resistanceDistance.toFixed(2)} (+{resistancePercent}%)
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCreateAlert('resistance')}
              className="w-full"
            >
              Create Alert
            </Button>
          </CardContent>
        </Card>

        {/* Support Card */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Horizontal Support (B-B1)
              <span className="ml-auto px-2 py-0.5 text-xs font-semibold text-orange-800 bg-orange-100 rounded">
                NEAR
              </span>
            </CardTitle>
            <CardDescription className="text-xs">
              Lower fractal boundary
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-3xl font-bold text-gray-900">
                ${supportPrice.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                4 touches | -1.2° | 100 bars
              </div>
              <div className="text-xs text-gray-500 mt-1">
                -${supportDistance.toFixed(2)} (-{supportPercent}%)
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => handleCreateAlert('support')}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              Create Alert
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
