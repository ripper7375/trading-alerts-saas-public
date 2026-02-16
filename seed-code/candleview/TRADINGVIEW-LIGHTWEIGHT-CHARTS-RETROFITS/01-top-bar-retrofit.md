# Document 1: Top Bar — Retrofitting Guide

**Purpose:** Integrate CandleView's Top Bar functionality into Trading Alerts SaaS using TradingView Lightweight Charts v5.x
**Source Reference:** `seed-code/candleview/core/src/components/CandleView/TopPanel/`
**Date:** 2026-02-16

---

## 1. WHAT THE TOP BAR DOES

The Top Bar is a horizontal control strip above the chart providing:

| Control                 | Function                          | User Action                    |
| ----------------------- | --------------------------------- | ------------------------------ |
| **Timeframe Selector**  | Switch OHLCV candle interval      | Dropdown: 1s → 6M (24 options) |
| **Timezone Selector**   | Change time axis display timezone | Dropdown: 21 timezones         |
| **Chart Type Selector** | Switch chart visualization style  | Dropdown: 13 chart types       |
| **f(x) Indicators**     | Add/remove technical indicators   | Searchable modal               |
| **Fullscreen**          | Toggle fullscreen mode            | Button click                   |
| **Screenshot**          | Capture chart image               | Button click                   |
| **Theme Toggle**        | Switch dark/light mode            | Animated toggle                |

**Key fact:** TradingView Lightweight Charts provides NONE of this UI. It is 100% custom React code.

---

## 2. SOURCE FILE MAP

```
seed-code/candleview/core/src/components/CandleView/
├── TopPanel/
│   ├── index.tsx              # Main component (1,800+ lines)
│   ├── Config.ts              # Timeframe, indicator, timezone definitions
│   └── IndicatorProcessing.ts # Indicator add/remove logic
├── types.ts                   # Enums: TimeframeEnum, TimezoneEnum, MainChartType, etc.
├── ChartLayer/
│   ├── ChartManager.ts        # lightweight-charts createChart() wrapper
│   └── ChartTypeManager.ts    # Series type switching logic
└── Indicators/
    ├── MainChart/             # MA, EMA, Bollinger, Ichimoku, Donchian, Envelope, VWAP
    └── SubChart/              # RSI, MACD, Volume, SAR, KDJ, ATR, Stochastic, CCI, BBWidth, ADX, OBV
```

---

## 3. TOP BAR — UI LAYER

### 3.1 Component Structure

The TopPanel is a React class component receiving props from the parent CandleView:

```typescript
// TopPanel props (passed from CandleView)
interface TopPanelProps {
  chart: IChartApi; // lightweight-charts instance
  chartSeries: ChartSeries | null; // Current active series
  currentTheme: ThemeConfig; // Dark/light theme config
  currentTimeframe: TimeframeEnum; // Active timeframe
  currentTimezone: TimezoneEnum; // Active timezone
  currentMainChartType: MainChartType; // Active chart type
  mainChartIndicators: string[]; // Active main indicators
  subChartIndicators: string[]; // Active sub-chart indicators
  i18n: I18n; // Internationalization strings
  onTimeframeChange: (tf: TimeframeEnum) => void;
  onTimezoneChange: (tz: TimezoneEnum) => void;
  onMainChartTypeChange: (type: MainChartType) => void;
  onIndicatorToggle: (indicator: string, chart: 'main' | 'sub') => void;
  onFullscreen: () => void;
  onScreenshot: () => void;
  onThemeToggle: () => void;
  toppanel?: boolean; // Show/hide top panel
  fullscreen?: boolean; // Fullscreen button enabled
  screenshot?: boolean; // Screenshot button enabled
}
```

### 3.2 Layout Pattern

```
┌─────────────────────────────────────────────────────────────────────┐
│ ◀ │ [15m ▾] [Shanghai ▾] [🕯 ▾] [f(x) Indicators] [⛶] [📷] [🌓] │ ▶ │
└─────────────────────────────────────────────────────────────────────┘
     ← scrollable area with left/right arrow navigation →
```

- Horizontal scroll container with overflow detection
- Left/right navigation arrows appear when content overflows
- Each control is a `<button>` or `<div>` with click handler opening a dropdown/modal
- Dropdowns use absolute positioning relative to the button

---

## 4. TOP BAR — API LAYER (Data Definitions)

### 4.1 Timeframe Configuration

**Source:** `TopPanel/Config.ts` → `getAllTimeframes()`

```typescript
// Available timeframes organized by section
enum TimeframeEnum {
  // Seconds
  ONE_SECOND = '1s',
  FIVE_SECONDS = '5s',
  FIFTEEN_SECONDS = '15s',
  THIRTY_SECONDS = '30s',
  // Minutes
  ONE_MINUTE = '1m',
  THREE_MINUTES = '3m',
  FIVE_MINUTES = '5m',
  FIFTEEN_MINUTES = '15m',
  THIRTY_MINUTES = '30m',
  FORTY_FIVE_MINUTES = '45m',
  // Hours
  ONE_HOUR = '1H',
  TWO_HOURS = '2H',
  THREE_HOURS = '3H',
  FOUR_HOURS = '4H',
  SIX_HOURS = '6H',
  EIGHT_HOURS = '8H',
  TWELVE_HOURS = '12H',
  // Days
  ONE_DAY = '1D',
  THREE_DAYS = '3D',
  // Weeks
  ONE_WEEK = '1W',
  TWO_WEEKS = '2W',
  // Months
  ONE_MONTH = '1M',
  THREE_MONTHS = '3M',
  SIX_MONTHS = '6M',
}
```

**Dropdown sections:** Second, Minute, Hour, Day, Week, Month — each collapsible.

### 4.2 Timezone Configuration

```typescript
enum TimezoneEnum {
  NEW_YORK = 'America/New_York',
  CHICAGO = 'America/Chicago',
  DENVER = 'America/Denver',
  LOS_ANGELES = 'America/Los_Angeles',
  TORONTO = 'America/Toronto',
  LONDON = 'Europe/London',
  PARIS = 'Europe/Paris',
  FRANKFURT = 'Europe/Frankfurt',
  ZURICH = 'Europe/Zurich',
  MOSCOW = 'Europe/Moscow',
  DUBAI = 'Asia/Dubai',
  KARACHI = 'Asia/Karachi',
  KOLKATA = 'Asia/Kolkata',
  SHANGHAI = 'Asia/Shanghai',
  HONG_KONG = 'Asia/Hong_Kong',
  SINGAPORE = 'Asia/Singapore',
  TOKYO = 'Asia/Tokyo',
  SEOUL = 'Asia/Seoul',
  SYDNEY = 'Australia/Sydney',
  AUCKLAND = 'Pacific/Auckland',
  UTC = 'UTC',
}
```

### 4.3 Chart Type Configuration

```typescript
enum MainChartType {
  Candle = 'Candle', // Standard candlestick
  HollowCandle = 'HollowCandle', // Hollow body candles
  Bar = 'Bar', // OHLC bars
  BaseLine = 'BaseLine', // Baseline reference
  Line = 'Line', // Close price line
  Area = 'Area', // Filled area
  StepLine = 'StepLine', // Step/staircase line
  Histogram = 'Histogram', // Bar histogram
  HeikinAshi = 'HeikinAshi', // Smoothed candles
  LineBreak = 'LineBreak', // Line break chart
  Mountain = 'Mountain', // Mountain/gradient area
  BaselineArea = 'BaselineArea', // Baseline with fill
  HighLow = 'HighLow', // High-low range
  HLCArea = 'HLCArea', // HLC with area fill
}
```

### 4.4 Indicator Configuration

**Main chart indicators** (overlay on price chart):

```typescript
// Source: TopPanel/Config.ts → getMainIndicators()
const mainIndicators = [
  { id: 'ma', type: MainChartIndicatorType.MA },
  { id: 'ema', type: MainChartIndicatorType.EMA },
  { id: 'bollinger', type: MainChartIndicatorType.BOLLINGER },
  { id: 'ichimoku', type: MainChartIndicatorType.ICHIMOKU },
  { id: 'donchian', type: MainChartIndicatorType.DONCHIAN },
  { id: 'envelope', type: MainChartIndicatorType.ENVELOPE },
  { id: 'vwap', type: MainChartIndicatorType.VWAP },
];

// Main chart maps (special overlays)
const mainChartMaps = [
  { id: 'heatmap', type: MainChartIndicatorType.HEATMAP },
  { id: 'market-profile', type: MainChartIndicatorType.MARKETPROFILE },
];
```

**Sub-chart indicators** (separate panes below main chart):

```typescript
// Source: TopPanel/Config.ts → getSubChartIndicators()
const subChartIndicators = [
  { id: 'rsi', type: SubChartIndicatorType.RSI },
  { id: 'macd', type: SubChartIndicatorType.MACD },
  { id: 'volume', type: SubChartIndicatorType.VOLUME },
  { id: 'sar', type: SubChartIndicatorType.SAR },
  { id: 'kdj', type: SubChartIndicatorType.KDJ },
  { id: 'atr', type: SubChartIndicatorType.ATR },
  { id: 'stochastic', type: SubChartIndicatorType.STOCHASTIC },
  { id: 'cci', type: SubChartIndicatorType.CCI },
  { id: 'bbwidth', type: SubChartIndicatorType.BBWIDTH },
  { id: 'adx', type: SubChartIndicatorType.ADX },
  { id: 'obv', type: SubChartIndicatorType.OBV },
];
```

---

## 5. TOP BAR — BACKEND LOGIC (How Each Control Drives the Chart)

### 5.1 Timeframe Change Flow

```
User clicks "15m" → "1H"
    ↓
TopPanel.onTimeframeChange(TimeframeEnum.ONE_HOUR)
    ↓
CandleView receives callback
    ↓
1. Calls timeframeCallbacks['1H']() → Parent app fetches new OHLCV data
2. DataManager re-aggregates data for new timeframe
3. DataAdapter applies timeframe boundaries
4. chart series.setData(newData) → lightweight-charts re-renders
```

**Key integration point:** CandleView does NOT fetch data itself. The `timeframeCallbacks` prop delegates to the parent app. In Trading Alerts SaaS, this is where your data fetching logic connects.

### 5.2 Timezone Change Flow

```
User selects "Tokyo"
    ↓
TopPanel.onTimezoneChange(TimezoneEnum.TOKYO)
    ↓
CandleView.DataManager adjusts timestamps:
  - Converts all OHLCV time values to target timezone
  - Re-applies data to chart via series.setData()
    ↓
lightweight-charts timeScale re-renders with shifted time axis
```

### 5.3 Chart Type Switch Flow

```
User clicks candlestick icon → selects "Line"
    ↓
TopPanel.onMainChartTypeChange(MainChartType.Line)
    ↓
ChartTypeManager.switchChartType(chart, MainChartType.Line):
  1. Detach all primitives (marks) from old series
  2. Remove old series: chart.removeSeries(oldSeries)
  3. Create new series: chart.addSeries(LineSeries, options)
  4. Set data: newSeries.setData(preparedData)
  5. Re-attach all primitives (marks) to new series
  6. Re-apply all indicators to new series
```

**Critical detail:** When switching chart types, all drawing marks must be detached from the old series and re-attached to the new one, because marks are "primitives" bound to a specific series in lightweight-charts.

### 5.4 Indicator Toggle Flow

```
User clicks f(x) → toggles "RSI" ON
    ↓
TopPanel.onIndicatorToggle('rsi', 'sub')
    ↓
IndicatorProcessing handles:
  1. Creates RSI indicator instance
  2. Calculates RSI values from OHLCV data
  3. Creates new sub-chart pane (separate price scale)
  4. Adds LineSeries to sub-chart: chart.addSeries(LineSeries, { pane: 1 })
  5. Sets calculated data: rsiSeries.setData(rsiData)
```

**Indicator calculation example (RSI):**

```typescript
// Simplified from Indicators/SubChart/RSIIndicator.ts
function calculateRSI(
  data: ICandleViewDataPoint[],
  period: number
): { time: number; value: number }[] {
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  let avgGain = gains.slice(0, period).reduce((s, g) => s + g, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((s, l) => s + l, 0) / period;

  const rsiData = [];
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsiData.push({ time: data[i + 1].time, value: 100 - 100 / (1 + rs) });
  }
  return rsiData;
}
```

**Indicator rendering** uses standard lightweight-charts series API:

```typescript
// Main chart indicator (overlay) — e.g., MA
const maSeries = chart.addSeries(LineSeries, {
  color: '#FF6B6B',
  lineWidth: 2,
  title: 'MA20',
  priceScaleId: 'right', // Same scale as candles
});
maSeries.setData(maData);

// Sub-chart indicator — e.g., RSI (separate pane)
const rsiSeries = chart.addSeries(LineSeries, {
  color: '#7C4DFF',
  lineWidth: 1,
  title: 'RSI(14)',
  pane: 1, // Separate pane below main chart
});
rsiSeries.setData(rsiData);
```

### 5.5 Theme Toggle Flow

```
User clicks theme toggle
    ↓
CandleView.onThemeToggle()
    ↓
1. Switch ThemeConfig (dark ↔ light)
2. chart.applyOptions({ layout: newTheme.layout, grid: newTheme.grid })
3. Update all series colors
4. Update all indicator series colors
5. Update all mark (drawing) colors if theme-aware
6. Re-render TopPanel and LeftPanel with new theme
```

### 5.6 Screenshot Flow

```
User clicks camera icon
    ↓
1. chart.takeScreenshot() → Returns canvas element
2. canvas.toDataURL('image/png') → Base64 image
3. handleScreenshotCapture({ dataUrl, width, height }) callback to parent
```

### 5.7 Fullscreen Flow

```
User clicks fullscreen icon
    ↓
1. container.requestFullscreen() (browser API)
2. chart.resize(window.innerWidth, window.innerHeight)
3. On exit: chart.resize(originalWidth, originalHeight)
```

---

## 6. LIGHTWEIGHT-CHARTS APIs USED BY TOP BAR

| API                                    | Used For                                           |
| -------------------------------------- | -------------------------------------------------- |
| `createChart(container, options)`      | Initial chart creation                             |
| `chart.applyOptions(options)`          | Theme changes, layout updates                      |
| `chart.addSeries(SeriesType, options)` | Adding indicator series, switching chart types     |
| `chart.removeSeries(series)`           | Removing old series on chart type switch           |
| `series.setData(data)`                 | Setting OHLCV data after timeframe/timezone change |
| `series.applyOptions(options)`         | Updating series colors on theme change             |
| `chart.takeScreenshot()`               | Screenshot capture                                 |
| `chart.resize(w, h)`                   | Fullscreen toggle                                  |
| `chart.timeScale().applyOptions()`     | Timezone display changes                           |
| `series.attachPrimitive(mark)`         | Re-attaching marks after chart type switch         |
| `series.detachPrimitive(mark)`         | Detaching marks before chart type switch           |

---

## 7. RETROFITTING PLAN FOR TRADING ALERTS SAAS

### Step 1: Create TopBar React Component

Build a horizontal toolbar component that wraps your existing lightweight-charts instance:

```
<div style="position: relative">
  <TopBar
    onTimeframeChange={handleTimeframeChange}
    onTimezoneChange={handleTimezoneChange}
    onChartTypeChange={handleChartTypeChange}
    onIndicatorToggle={handleIndicatorToggle}
    currentTimeframe={timeframe}
    currentTimezone={timezone}
    currentChartType={chartType}
    activeIndicators={indicators}
    theme={theme}
  />
  <div ref={chartContainerRef}>
    <!-- lightweight-charts renders here -->
  </div>
</div>
```

### Step 2: Implement Each Control

**Priority order (most impactful first):**

1. **Timeframe Selector** — Connect to your data fetching API
2. **Chart Type Selector** — Use ChartTypeManager pattern (series swap)
3. **f(x) Indicators** — Port indicator calculation classes
4. **Theme Toggle** — Apply chart.applyOptions() with theme configs
5. **Timezone Selector** — DataManager timezone conversion
6. **Screenshot** — chart.takeScreenshot()
7. **Fullscreen** — Browser fullscreen API

### Step 3: Port Indicator Calculations

Copy and adapt from CandleView's indicator implementations:

```
Indicators/MainChart/
  MAIndicator.ts         → Moving Average (overlay)
  EMAIndicator.ts        → Exponential MA (overlay)
  BollingerIndicator.ts  → Bollinger Bands (overlay)
  IchimokuIndicator.ts   → Ichimoku Cloud (overlay)
  DonchianIndicator.ts   → Donchian Channel (overlay)
  EnvelopeIndicator.ts   → Envelope (overlay)
  VWAPIndicator.ts       → VWAP (overlay)

Indicators/SubChart/
  RSIIndicator.ts        → RSI (sub-pane)
  MACDIndicator.ts       → MACD (sub-pane)
  VolumeIndicator.ts     → Volume bars (sub-pane)
  SARIndicator.ts        → Parabolic SAR (sub-pane)
  KDJIndicator.ts        → KDJ oscillator (sub-pane)
  ATRIndicator.ts        → Average True Range (sub-pane)
  StochasticIndicator.ts → Stochastic (sub-pane)
  CCIIndicator.ts        → CCI (sub-pane)
  BBWidthIndicator.ts    → Bollinger Band Width (sub-pane)
  ADXIndicator.ts        → ADX (sub-pane)
  OBVIndicator.ts        → On-Balance Volume (sub-pane)
```

### Step 4: Adapt for Trading Alerts SaaS

Key adaptations needed:

- **Timeframe options:** Filter to only timeframes your data API supports
- **Timezone:** May simplify to fewer timezones based on your user base
- **Indicators:** Start with most common (MA, EMA, RSI, MACD, Volume, Bollinger) and add others later
- **Chart types:** Start with Candle, Line, Area and expand later
- **Data fetching:** Connect timeframe change to your actual market data API (Binance, etc.)

---

## 8. KEY FILES TO STUDY IN CANDLEVIEW

| File                              | Lines  | What to Learn                                               |
| --------------------------------- | ------ | ----------------------------------------------------------- |
| `TopPanel/index.tsx`              | ~1,800 | Full UI implementation, dropdown rendering, scroll handling |
| `TopPanel/Config.ts`              | ~97    | All configuration data (timeframes, indicators, timezones)  |
| `TopPanel/IndicatorProcessing.ts` | ~200   | Indicator add/remove/toggle logic                           |
| `types.ts`                        | ~322   | All enums and interfaces                                    |
| `ChartLayer/ChartTypeManager.ts`  | ~400   | Series switching logic                                      |
| `ChartLayer/ChartManager.ts`      | ~300   | Chart initialization and configuration                      |
| `Indicators/MainChart/*.ts`       | varies | Overlay indicator calculations                              |
| `Indicators/SubChart/*.ts`        | varies | Sub-pane indicator calculations                             |

---

_End of Document 1_
