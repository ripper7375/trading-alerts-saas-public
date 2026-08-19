import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  LineChart,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Lock,
  Crown,
} from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { PremiumBadge } from '@/components/subscription/FeatureGate';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  ReferenceLine,
  Line,
  ComposedChart,
  Bar,
  Brush,
} from 'recharts';
import CandlestickChart from '@/components/charts/CandlestickChart';

// Generate mock OHLC data
const generatePriceData = (symbol: string, days: number = 30) => {
  const basePrice =
    symbol === 'EURUSD' ? 1.08 : symbol === 'GBPUSD' ? 1.26 : 2020;
  const volatility = symbol === 'XAUUSD' ? 15 : 0.005;
  const data = [];
  let price = basePrice;

  for (let i = 0; i < days; i++) {
    const change = (Math.random() - 0.48) * volatility;
    price = price + change;
    const high = price + Math.random() * volatility * 0.5;
    const low = price - Math.random() * volatility * 0.5;
    const open = price - change * 0.5;
    const close = price;
    const volume = Math.floor(Math.random() * 1000000) + 500000;

    // Calculate RSI (simplified mock)
    const rsi = 30 + Math.random() * 40;

    // Calculate MACD (simplified mock)
    const macd = (Math.random() - 0.5) * 0.002;
    const signal = macd * 0.8;
    const histogram = macd - signal;

    data.push({
      date: new Date(
        Date.now() - (days - i) * 24 * 60 * 60 * 1000
      ).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      open: Number(open.toFixed(symbol === 'XAUUSD' ? 2 : 4)),
      high: Number(high.toFixed(symbol === 'XAUUSD' ? 2 : 4)),
      low: Number(low.toFixed(symbol === 'XAUUSD' ? 2 : 4)),
      close: Number(close.toFixed(symbol === 'XAUUSD' ? 2 : 4)),
      volume,
      rsi: Number(rsi.toFixed(2)),
      macd: Number((macd * 10000).toFixed(2)),
      signal: Number((signal * 10000).toFixed(2)),
      histogram: Number((histogram * 10000).toFixed(2)),
      sma20: Number(
        (price - volatility * 0.1).toFixed(symbol === 'XAUUSD' ? 2 : 4)
      ),
      ema50: Number(
        (price - volatility * 0.2).toFixed(symbol === 'XAUUSD' ? 2 : 4)
      ),
      upperBand: Number(
        (price + volatility * 2).toFixed(symbol === 'XAUUSD' ? 2 : 4)
      ),
      lowerBand: Number(
        (price - volatility * 2).toFixed(symbol === 'XAUUSD' ? 2 : 4)
      ),
    });
  }
  return data;
};

const chartSymbols = [
  { symbol: 'EURUSD', name: 'EUR/USD', change: 0.15 },
  { symbol: 'GBPUSD', name: 'GBP/USD', change: -0.08 },
  { symbol: 'XAUUSD', name: 'Gold', change: 0.42 },
  { symbol: 'USDJPY', name: 'USD/JPY', change: -0.23 },
];

const timeframes = ['M1', 'M5', 'M15', 'H1', 'H4', 'D1', 'W1'];

const indicators = [
  { id: 'sma', name: 'SMA (20)', enabled: false, color: 'hsl(var(--chart-2))' },
  { id: 'ema', name: 'EMA (50)', enabled: false, color: 'hsl(var(--chart-3))' },
  {
    id: 'bollinger',
    name: 'Bollinger Bands',
    enabled: false,
    color: 'hsl(var(--chart-4))',
  },
  { id: 'rsi', name: 'RSI (14)', enabled: false, color: 'hsl(var(--chart-5))' },
  { id: 'macd', name: 'MACD', enabled: false, color: 'hsl(var(--primary))' },
];

const chartConfig = {
  close: { label: 'Price', color: 'hsl(var(--chart-1))' },
  sma20: { label: 'SMA 20', color: 'hsl(var(--chart-2))' },
  ema50: { label: 'EMA 50', color: 'hsl(var(--chart-3))' },
  upperBand: { label: 'Upper Band', color: 'hsl(var(--chart-4))' },
  lowerBand: { label: 'Lower Band', color: 'hsl(var(--chart-4))' },
  rsi: { label: 'RSI', color: 'hsl(var(--chart-5))' },
  macd: { label: 'MACD', color: 'hsl(var(--primary))' },
  signal: { label: 'Signal', color: 'hsl(var(--chart-2))' },
  histogram: { label: 'Histogram', color: 'hsl(var(--chart-3))' },
};

const Charts = () => {
  const { hasFeature } = useSubscription();
  const [selectedSymbol, setSelectedSymbol] = useState(chartSymbols[0]);
  const [selectedTimeframe, setSelectedTimeframe] = useState('H1');
  const [activeIndicators, setActiveIndicators] = useState<string[]>([]);
  const [chartType, setChartType] = useState<'line' | 'candlestick'>('line');
  const [zoomRange, setZoomRange] = useState<{
    startIndex: number;
    endIndex: number;
  } | null>(null);

  const hasTechnicalIndicators = hasFeature('technicalIndicators');

  const priceData = useMemo(
    () => generatePriceData(selectedSymbol.symbol),
    [selectedSymbol.symbol]
  );

  // Reset zoom when symbol changes
  const handleSymbolChange = useCallback((symbol: (typeof chartSymbols)[0]) => {
    setSelectedSymbol(symbol);
    setZoomRange(null);
  }, []);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    const dataLength = priceData.length;
    const currentStart = zoomRange?.startIndex ?? 0;
    const currentEnd = zoomRange?.endIndex ?? dataLength - 1;
    const range = currentEnd - currentStart;

    if (range > 5) {
      const zoomAmount = Math.max(Math.floor(range * 0.2), 1);
      setZoomRange({
        startIndex: currentStart + zoomAmount,
        endIndex: currentEnd - zoomAmount,
      });
    }
  }, [priceData.length, zoomRange]);

  const handleZoomOut = useCallback(() => {
    const dataLength = priceData.length;
    const currentStart = zoomRange?.startIndex ?? 0;
    const currentEnd = zoomRange?.endIndex ?? dataLength - 1;
    const range = currentEnd - currentStart;

    const zoomAmount = Math.floor(range * 0.25);
    const newStart = Math.max(0, currentStart - zoomAmount);
    const newEnd = Math.min(dataLength - 1, currentEnd + zoomAmount);

    setZoomRange({
      startIndex: newStart,
      endIndex: newEnd,
    });
  }, [priceData.length, zoomRange]);

  const handleResetZoom = useCallback(() => {
    setZoomRange(null);
  }, []);

  const handleBrushChange = useCallback(
    (brushState: { startIndex?: number; endIndex?: number }) => {
      if (
        brushState.startIndex !== undefined &&
        brushState.endIndex !== undefined
      ) {
        setZoomRange({
          startIndex: brushState.startIndex,
          endIndex: brushState.endIndex,
        });
      }
    },
    []
  );

  // Get visible data based on zoom range
  const visibleData = useMemo(() => {
    if (!zoomRange) return priceData;
    return priceData.slice(zoomRange.startIndex, zoomRange.endIndex + 1);
  }, [priceData, zoomRange]);

  const currentPrice = priceData[priceData.length - 1]?.close || 0;
  const previousPrice = priceData[priceData.length - 2]?.close || 0;
  const priceChange = currentPrice - previousPrice;
  const isPositive = priceChange >= 0;

  const toggleIndicator = (indicatorId: string) => {
    setActiveIndicators((prev) =>
      prev.includes(indicatorId)
        ? prev.filter((id) => id !== indicatorId)
        : [...prev, indicatorId]
    );
  };

  const showRSI = activeIndicators.includes('rsi');
  const showMACD = activeIndicators.includes('macd');
  const isZoomed = zoomRange !== null;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background px-4 py-3">
        <h1 className="text-xl font-bold text-foreground">Charts</h1>
        <p className="text-sm text-muted-foreground">Technical Analysis</p>
      </header>

      {/* Content */}
      <div className="flex-1 space-y-4 p-4 pb-24">
        {/* Symbol Selection */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {chartSymbols.map((item) => (
            <Badge
              key={item.symbol}
              variant={
                selectedSymbol.symbol === item.symbol ? 'default' : 'secondary'
              }
              className="cursor-pointer whitespace-nowrap px-3 py-1.5"
              onClick={() => handleSymbolChange(item)}
            >
              {item.symbol}
              <span
                className={`ml-1 text-xs ${item.change >= 0 ? 'text-green-400' : 'text-red-400'}`}
              >
                {item.change >= 0 ? '+' : ''}
                {item.change}%
              </span>
            </Badge>
          ))}
        </div>

        {/* Main Price Chart */}
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">{selectedSymbol.name}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {selectedSymbol.symbol}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isPositive ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <div className="text-right">
                  <span className="block font-bold text-foreground">
                    {currentPrice}
                  </span>
                  <span
                    className={`text-xs ${isPositive ? 'text-green-500' : 'text-red-500'}`}
                  >
                    {isPositive ? '+' : ''}
                    {priceChange.toFixed(
                      selectedSymbol.symbol === 'XAUUSD' ? 2 : 4
                    )}
                  </span>
                </div>
              </div>
            </div>
            {/* Chart Controls Row */}
            <div className="mt-2 flex items-center justify-between">
              {/* Chart Type Toggle */}
              <div className="flex items-center rounded-lg bg-secondary p-0.5">
                <Button
                  size="sm"
                  variant={chartType === 'line' ? 'default' : 'ghost'}
                  className="h-7 w-7 p-0"
                  onClick={() => setChartType('line')}
                >
                  <LineChart className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant={chartType === 'candlestick' ? 'default' : 'ghost'}
                  className="h-7 w-7 p-0"
                  onClick={() => setChartType('candlestick')}
                >
                  <BarChart3 className="h-4 w-4" />
                </Button>
              </div>
              {/* Zoom Controls */}
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 w-7 p-0"
                  onClick={handleZoomIn}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 w-7 p-0"
                  onClick={handleZoomOut}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant={isZoomed ? 'default' : 'secondary'}
                  className="h-7 w-7 p-0"
                  onClick={handleResetZoom}
                  disabled={!isZoomed}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Price Chart */}
            {chartType === 'candlestick' ? (
              <div className="h-48 w-full">
                <CandlestickChart
                  data={visibleData}
                  precision={selectedSymbol.symbol === 'XAUUSD' ? 2 : 4}
                />
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-48 w-full">
                <AreaChart
                  data={visibleData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="priceGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="hsl(var(--chart-1))"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="hsl(var(--chart-1))"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10 }}
                    width={50}
                    tickFormatter={(value) =>
                      value.toFixed(selectedSymbol.symbol === 'XAUUSD' ? 0 : 3)
                    }
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />

                  {/* Bollinger Bands */}
                  {activeIndicators.includes('bollinger') && (
                    <>
                      <Area
                        type="monotone"
                        dataKey="upperBand"
                        stroke="hsl(var(--chart-4))"
                        strokeWidth={1}
                        strokeDasharray="3 3"
                        fill="none"
                      />
                      <Area
                        type="monotone"
                        dataKey="lowerBand"
                        stroke="hsl(var(--chart-4))"
                        strokeWidth={1}
                        strokeDasharray="3 3"
                        fill="none"
                      />
                    </>
                  )}

                  {/* Main Price Line */}
                  <Area
                    type="monotone"
                    dataKey="close"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    fill="url(#priceGradient)"
                  />

                  {/* SMA */}
                  {activeIndicators.includes('sma') && (
                    <Area
                      type="monotone"
                      dataKey="sma20"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={1.5}
                      fill="none"
                    />
                  )}

                  {/* EMA */}
                  {activeIndicators.includes('ema') && (
                    <Area
                      type="monotone"
                      dataKey="ema50"
                      stroke="hsl(var(--chart-3))"
                      strokeWidth={1.5}
                      fill="none"
                    />
                  )}
                </AreaChart>
              </ChartContainer>
            )}

            {/* Brush Navigator */}
            <div className="mt-2 h-12 w-full">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <AreaChart
                  data={priceData}
                  margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="brushGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="hsl(var(--chart-1))"
                        stopOpacity={0.2}
                      />
                      <stop
                        offset="95%"
                        stopColor="hsl(var(--chart-1))"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="close"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={1}
                    fill="url(#brushGradient)"
                  />
                  <Brush
                    dataKey="date"
                    height={30}
                    stroke="hsl(var(--border))"
                    fill="hsl(var(--muted))"
                    startIndex={zoomRange?.startIndex}
                    endIndex={zoomRange?.endIndex}
                    onChange={handleBrushChange}
                    tickFormatter={() => ''}
                  />
                </AreaChart>
              </ChartContainer>
            </div>

            {/* Timeframe Selection */}
            <div className="mt-2 flex gap-1 overflow-x-auto">
              {timeframes.map((tf) => (
                <Button
                  key={tf}
                  size="sm"
                  variant={tf === selectedTimeframe ? 'default' : 'secondary'}
                  className="px-3 py-1.5 text-xs"
                  onClick={() => setSelectedTimeframe(tf)}
                >
                  {tf}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* RSI Chart */}
        {showRSI && (
          <Card className="bg-card">
            <CardHeader className="py-2">
              <CardTitle className="text-sm">RSI (14)</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ChartContainer config={chartConfig} className="h-24 w-full">
                <ComposedChart
                  data={priceData}
                  margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                >
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10 }}
                    width={30}
                    ticks={[30, 50, 70]}
                  />
                  <ReferenceLine
                    y={70}
                    stroke="hsl(var(--destructive))"
                    strokeDasharray="3 3"
                  />
                  <ReferenceLine
                    y={30}
                    stroke="hsl(var(--chart-2))"
                    strokeDasharray="3 3"
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="rsi"
                    stroke="hsl(var(--chart-5))"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </ComposedChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {/* MACD Chart */}
        {showMACD && (
          <Card className="bg-card">
            <CardHeader className="py-2">
              <CardTitle className="text-sm">MACD</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ChartContainer config={chartConfig} className="h-24 w-full">
                <ComposedChart
                  data={priceData}
                  margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                >
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={false}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10 }}
                    width={30}
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="histogram"
                    fill="hsl(var(--chart-3))"
                    opacity={0.5}
                  />
                  <Line
                    type="monotone"
                    dataKey="macd"
                    stroke="hsl(var(--primary))"
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="signal"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </ComposedChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {/* Technical Indicators */}
        <Card className={!hasTechnicalIndicators ? 'relative' : ''}>
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Technical Indicators</CardTitle>
              <PremiumBadge tier="pro" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {!hasTechnicalIndicators && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Crown className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  Pro Feature
                </p>
                <p className="mb-2 text-xs text-muted-foreground">
                  Upgrade to unlock indicators
                </p>
              </div>
            )}
            {indicators.map((indicator) => (
              <div
                key={indicator.id}
                className="flex items-center justify-between border-b border-border py-2.5 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: indicator.color }}
                  />
                  <span className="text-sm text-foreground">
                    {indicator.name}
                  </span>
                </div>
                <Switch
                  checked={activeIndicators.includes(indicator.id)}
                  onCheckedChange={() => toggleIndicator(indicator.id)}
                  disabled={!hasTechnicalIndicators}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Price Statistics */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Open</p>
                <p className="font-medium text-foreground">
                  {priceData[priceData.length - 1]?.open}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">High</p>
                <p className="font-medium text-green-500">
                  {priceData[priceData.length - 1]?.high}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Low</p>
                <p className="font-medium text-red-500">
                  {priceData[priceData.length - 1]?.low}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Close</p>
                <p className="font-medium text-foreground">
                  {priceData[priceData.length - 1]?.close}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Charts;
