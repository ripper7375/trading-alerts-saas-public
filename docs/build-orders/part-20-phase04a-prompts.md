# Part 20 - Phase 04a: TypeScript Types

**Purpose:** Create TypeScript type definitions matching the OpenAPI specification.

**Files:** 1 | **Dependencies:** Phase 3 | **Est. Size:** ~5 KB

---

## Dependency Validation

Before starting this phase, verify Phase 3 is complete:

```bash
# Phase 3 outputs (Sync Script) should exist:
ls -la sync/sync_to_postgresql.py
ls -la sync/timeframe_filter.py
ls -la sync/db_connections.py
ls -la sync/config.py
ls -la sync/requirements.txt

# PostgreSQL should have data from sync
# (verify via database connection or health check)
```

**If any dependencies are missing, complete Phase 3 first.**

---

## Phase 04 Context

Phase 04 is split into 5 smaller phases for better compilation success:

```
Phase 04a (Types) ──┬──► Phase 04b (Database) ──► Phase 04c (Tier)
                    │                                    │
                    └──► Phase 04d (Market Hours) ───────┘
                                                         │
                                                         ▼
                                                 Phase 04e (API Routes)
```

**This is Phase 04a** - Creates foundational TypeScript types used by all subsequent phases.

---

## Usage Instructions

1. Start a fresh Claude Code (web) chat
2. Attach: `docs/sqlite-and-mt5service/part-20-sqlite-sync-postgresql-openapi.yaml`
3. Copy and paste the prompt below

---

## Phase 04a Prompt

````
# Part 20 - Phase 04a: TypeScript Types

## Context
I'm implementing Part 20 of Trading Alerts SaaS. Phases 1-3 are complete.

Phase 04 is split into 5 sub-phases (04a → 04e). This is Phase 04a.

## Phase 04 Overview
- 04a: TypeScript Types (this phase)
- 04b: Database Layer (depends on 04a)
- 04c: Tier Validation (depends on 04b)
- 04d: Market Hours (depends on 04a)
- 04e: API Routes (depends on 04b, 04c, 04d)

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

// Tier type (exported for use in other modules)
export type Tier = 'FREE' | 'PRO';
````

## Success Criteria

- [ ] File created at `lib/indicators/types.ts`
- [ ] File compiles without errors
- [ ] `npx tsc --noEmit` passes

## Commit Message

```
feat(types): add TypeScript types for indicator data (Phase 04a)

- Add OHLC, Fractals, Trendlines types
- Add Momentum, Keltner, ZigZag types
- Add API response and metadata types
- Add Tier type export
```

```

---

## What This Phase Produces

After completing Phase 04a, you will have:
- `lib/indicators/types.ts` - All TypeScript interfaces

These types are required by:
- Phase 04b (Database Layer)
- Phase 04d (Market Hours)

---

## Next Step

After Phase 04a compiles successfully, proceed to `part-20-phase04b-prompts.md` (Database Layer).
```
