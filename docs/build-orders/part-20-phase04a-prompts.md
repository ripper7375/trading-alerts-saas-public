# Part 20 - Phase 04a: TypeScript Types

**Purpose:** Create TypeScript type definitions matching the OpenAPI specification.

---

## Usage Instructions

1. Start a fresh Claude Code (web) chat
2. Attach: `docs/open-api-documents/part-20-sqlite-sync-postgresql-openapi.yaml`
3. Copy and paste the prompt below

---

## Phase 04a Prompt

```
# Part 20 - Phase 04a: TypeScript Types

## Context
I'm implementing Part 20 of Trading Alerts SaaS. Phases 1-3 are complete.

This phase creates TypeScript type definitions for indicator data.

## Prerequisites
- Phase 3 completed (PostgreSQL has data)
- Existing Next.js app

## Your Task
Create 1 file with TypeScript types matching the OpenAPI specification.

## File to Create

### `lib/indicators/types.ts`

```typescript
// OHLC Bar for chart data
export interface OHLCBar {
  time: number;  // Unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
}

// Fractal point
export interface FractalPoint {
  index: number;
  price: number;
  time: number;
}

export interface Fractals {
  peaks: FractalPoint[];
  bottoms: FractalPoint[];
}

// Trendline types
export interface TrendlinePoint {
  time: number;
  price: number;
}

export interface HorizontalTrendline {
  price: number;
  start_time: number;
  end_time: number;
  strength: number;
}

export interface DiagonalTrendline {
  start: TrendlinePoint;
  end: TrendlinePoint;
  slope: number;
  type: 'support' | 'resistance';
}

export interface HorizontalTrendlines {
  support: HorizontalTrendline[];
  resistance: HorizontalTrendline[];
}

export interface DiagonalTrendlines {
  support: DiagonalTrendline[];
  resistance: DiagonalTrendline[];
}

// Momentum Candle
export interface MomentumCandle {
  time: number;
  type: 'bullish' | 'bearish';
  body_size: number;
  total_size: number;
  body_ratio: number;
}

// Keltner Channels
export interface KeltnerChannels {
  upper: number[];
  middle: number[];
  lower: number[];
  timestamps: number[];
}

// ZigZag
export interface ZigZagPoint {
  time: number;
  price: number;
  type: 'peak' | 'bottom';
}

export interface ZigZag {
  points: ZigZagPoint[];
}

// Trading Hours
export interface TradingHours {
  open: string;
  close: string;
  timezone: string;
  days: string[];
}

// Complete Indicator Data
export interface IndicatorData {
  ohlc: OHLCBar[];
  fractals: Fractals;
  horizontal_trendlines: HorizontalTrendlines;
  diagonal_trendlines: DiagonalTrendlines;
  momentum_candles: MomentumCandle[];
  keltner_channels: KeltnerChannels;
  tema: number[];
  hrma: number[];
  smma: number[];
  zigzag: ZigZag;
}

// API Response Metadata
export interface IndicatorMetadata {
  symbol: string;
  timeframe: string;
  tier: 'FREE' | 'PRO';
  bars_returned: number;
  last_update: string;
  pro_indicators_enabled: boolean;
  market_status: 'OPEN' | 'CLOSED';
  trading_hours: TradingHours;
  next_market_open: string | null;
  dst_active: boolean;
  server_utc_offset: 2 | 3;
}

// API Response
export interface IndicatorResponse {
  success: boolean;
  data?: IndicatorData & { metadata: IndicatorMetadata };
  error?: string;
}
```

## Success Criteria
- [ ] File compiles without errors
- [ ] `npx tsc --noEmit` passes

## Commit Message
```
feat(types): add TypeScript types for indicator data

- Add OHLC, Fractals, Trendlines types
- Add Momentum, Keltner, ZigZag types
- Add API response and metadata types
```
```

---

## Next Step

After Phase 04a, proceed to `part-20-phase04b-prompts.md` (Database Layer).
