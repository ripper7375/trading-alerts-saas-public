TASK 2: Trading Chart Component (MAJOR CHANGES)
REVISED V0.dev Prompt for Task 2:

=======================================================================

Create a complete trading chart component for a Next.js 15 app using TypeScript, Tailwind CSS, shadcn/ui, and TradingView Lightweight Charts library.

IMPORTANT: This component must use the TradingView Lightweight Charts library (https://github.com/tradingview/lightweight-charts) for professional candlestick visualization with custom fractal indicator overlays.

REQUIREMENTS:

1. DEPENDENCIES:
   - Install: npm install lightweight-charts
   - Import: import { createChart, IChartApi, ISeriesApi } from 'lightweight-charts'

2. TOP CONTROLS BAR:
   - Background: white, padding: 16px, rounded-t-lg, border-b
   - Left side controls (flex row, gap-4):
     - Symbol dropdown (Select component from shadcn/ui):
       - Options: XAUUSD, BTCUSD, EURUSD, USDJPY, US30
       - Default: XAUUSD
       - Width: 150px
       - FREE tier: Show only these 5 symbols
       - PRO tier: Show all 15 symbols (add disabled note)
     - Timeframe dropdown (Select component):
       - FREE tier options: H1, H4, D1
       - PRO tier options: M5, M15, M30, H1, H2, H4, H8, H12, D1
       - Default: H1
       - Width: 120px
       - Show 🔒 PRO badge on locked timeframes
     - Refresh button (Button component with icon):
       - Icon: ⟳
       - Variant: outline
   - Right side: Update status text:
     - "Last updated: 5 seconds ago | Next: 55s"
     - Text size: sm, color: gray-600
     - FREE tier: "Updates every 60s"
     - PRO tier: "Updates every 30s"

3. TRADINGVIEW CHART CONTAINER:
   - Container div:
     - id="trading-chart-container"
     - Width: 100% (responsive)
     - Height: 500px
     - Background: white
     - Border: border-gray-200
     - Rounded: rounded-lg
   - TradingView Chart Setup:

```typescript
const chartContainerRef = useRef<HTMLDivElement>(null);
const chartRef = useRef<IChartApi | null>(null);
const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

useEffect(() => {
  if (!chartContainerRef.current) return;

  // Create chart
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
    },
  });

  // Add candlestick series
  const candlestickSeries = chart.addCandlestickSeries({
    upColor: '#10b981',
    downColor: '#ef4444',
    borderUpColor: '#059669',
    borderDownColor: '#dc2626',
    wickUpColor: '#059669',
    wickDownColor: '#dc2626',
  });

  chartRef.current = chart;
  candlestickSeriesRef.current = candlestickSeries;

  return () => {
    chart.remove();
  };
}, []);
```

4. MOCK CANDLESTICK DATA:
   - Generate 50-100 mock OHLC data points:

```typescript
const generateMockData = () => {
  const data = [];
  let time = Math.floor(Date.now() / 1000) - 50 * 3600; // 50 hours ago
  let price = 2650;

  for (let i = 0; i < 50; i++) {
    const change = (Math.random() - 0.5) * 10;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 5;
    const low = Math.min(open, close) - Math.random() * 5;

    data.push({
      time: time as UTCTimestamp,
      open,
      high,
      low,
      close,
    });

    time += 3600; // 1 hour
    price = close;
  }

  return data;
};
```

5. CUSTOM FRACTAL OVERLAYS (Price Lines):
   - Add custom price lines for fractals using TradingView's API:

```typescript
// Horizontal Resistance Line (P-P1)
const resistanceLine = candlestickSeries.createPriceLine({
  price: 2655.2,
  color: '#ef4444',
  lineWidth: 3,
  lineStyle: 0, // solid
  axisLabelVisible: true,
  title: 'P-P1 Resistance',
});

// Horizontal Support Line (B-B1)
const supportLine = candlestickSeries.createPriceLine({
  price: 2645.0,
  color: '#10b981',
  lineWidth: 3,
  lineStyle: 0,
  axisLabelVisible: true,
  title: 'B-B1 Support',
});

// Current Price Line (dynamic)
const currentPriceLine = candlestickSeries.createPriceLine({
  price: 2650.5,
  color: '#f59e0b',
  lineWidth: 2,
  lineStyle: 2, // dashed
  axisLabelVisible: true,
  title: 'Current',
});
```

6. FRACTAL MARKERS:
   - Add markers for fractal points:

```typescript
candlestickSeries.setMarkers([
  {
    time: data[10].time,
    position: 'aboveBar',
    color: '#ef4444',
    shape: 'arrowDown',
    text: '▲ Peak (108)',
  },
  {
    time: data[35].time,
    position: 'belowBar',
    color: '#10b981',
    shape: 'arrowUp',
    text: '▼ Bottom (108)',
  },
]);
```

7. BOTTOM INFO CARDS (Grid, 2 columns):
   - Card 1: Resistance Line Info
     - Title: "🔴 Horizontal Resistance (P-P1)"
     - Price: "$2,655.20" (large, bold)
     - Details: "5 touches | 8.5° | 120 bars"
     - Distance: "+$4.70 (+0.18%)" (small, gray)
     - Button: "Create Alert" (variant: outline, size: sm)
   - Card 2: Support Line Info
     - Title: "🟢 Horizontal Support (B-B1)"
     - Price: "$2,645.00" (large, bold)
     - Details: "4 touches | -1.2° | 100 bars"
     - Distance: "-$5.50 (-0.21%)" (small, gray)
     - Badge: "⚠️ NEAR" (orange background)
     - Button: "Create Alert" (variant: default, size: sm, green)

8. INTERACTIVITY:
   - Symbol/timeframe change: Regenerate mock data and update chart
   - Refresh button: Re-fetch data (show loading spinner)
   - Chart is interactive: zoom, pan, crosshair
   - Create Alert buttons are clickable (console.log)
   - Handle window resize (update chart dimensions)

9. RESPONSIVE:
   - Chart container uses 100% width
   - Height adjusts on mobile (min: 400px, max: 500px)
   - Info cards stack vertically on mobile (< 768px)
   - Controls bar wraps on small screens

10. TIER SYSTEM (Mock Implementation):
    - Add tier prop: `tier: 'FREE' | 'PRO'`
    - FREE tier:
      - Show only H1, H4, D1 in timeframe selector
      - Show only 5 symbols
      - Show "🔒 Upgrade to PRO for M5-H12" message
    - PRO tier:
      - Show all 9 timeframes
      - Show all 15 symbols
      - Show "⚡ 30s updates" badge

11. TECHNICAL REQUIREMENTS:
    - Export as default component
    - TypeScript with proper types
    - Include TradingView chart refs and cleanup
    - Use shadcn/ui Select, Button, Card components
    - Self-contained with mock data
    - Include all imports
    - Handle chart cleanup on unmount

12. COMPONENT PROPS:

```typescript
interface TradingChartProps {
  tier: 'FREE' | 'PRO';
  initialSymbol?: string;
  initialTimeframe?: string;
}
```

EXAMPLE STRUCTURE:

```typescript
'use client'
import { useEffect, useRef, useState } from 'react'
import { createChart, IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts'
import { Select, Button, Card } from '@/components/ui'

export default function TradingChart({ tier = 'FREE', ... }: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const [symbol, setSymbol] = useState('XAUUSD')
  const [timeframe, setTimeframe] = useState('H1')

  // Chart initialization
  useEffect(() => { ... }, [])

  // Data update when symbol/timeframe changes
  useEffect(() => { ... }, [symbol, timeframe])

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="bg-white p-4 rounded-lg border">...</div>

      {/* TradingView Chart */}
      <div ref={chartContainerRef} id="trading-chart-container" />

      {/* Info Cards */}
      <div className="grid md:grid-cols-2 gap-4">...</div>
    </div>
  )
}
```

Generate complete, production-ready code with TradingView Lightweight Charts integration that I can copy and run immediately. Include proper TypeScript types, error handling, and cleanup.
