# Part 20 - Phase 04a: Library & Foundation Files

**Purpose:** Create TypeScript library files for database access, types, tier validation, and market hours handling. These files are prerequisites for the API routes in Phase 04b.

---

## Usage Instructions

1. Start a fresh Claude Code (web) chat
2. Attach these 3 documents:
   - `docs/build-orders/part-20-architecture-design.md`
   - `docs/build-orders/part-20-implementation-plan.md`
   - `docs/open-api-documents/part-20-sqlite-sync-postgresql-openapi.yaml`
3. Copy and paste the prompt below

---

## Phase 04a Prompt

```
# Part 20 - Phase 04a: Library & Foundation Files

## Context
I'm implementing Part 20 of Trading Alerts SaaS. Phases 1-3 are complete.

This phase creates the foundation library files needed for API routes. Phase 04b will create the actual API routes that depend on these files.

Please refer to the attached documents:
- `part-20-architecture-design.md` - Full architecture context
- `part-20-implementation-plan.md` - Phase 4 details
- `part-20-sqlite-sync-postgresql-openapi.yaml` - Complete API specification

## Prerequisites
- Phase 3 completed (PostgreSQL has data from sync)
- Existing Next.js app with NextAuth.js configured
- PostgreSQL connection string in environment variables

## Your Task
Create 6 library/utility files that will be used by API routes in Phase 04b.

## Files to Create

### 1. `lib/indicators/types.ts`
Create TypeScript types matching OpenAPI schemas:
```typescript
// OHLC Bar for chart data
export interface OHLCBar {
  time: number;  // Unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
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

// Trendlines
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

// Complete Indicator Data Response
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

// Metadata for API response
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

// Complete API Response
export interface IndicatorResponse {
  success: boolean;
  data?: {
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
    metadata: IndicatorMetadata;
  };
  error?: string;
}
```

### 2. `lib/db/postgresql.ts`
Create PostgreSQL client with connection pooling:
```typescript
import { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.POSTGRESQL_URI,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
}

export async function query<T>(text: string, params?: any[]): Promise<T[]> {
  const client = await getPool().connect();
  try {
    const result = await client.query(text, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function getClient(): Promise<PoolClient> {
  return getPool().connect();
}

export async function checkConnection(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export { getPool };
```

### 3. `lib/db/queries.ts`
Create database query functions:
```typescript
import { query } from './postgresql';
import { IndicatorData, OHLCBar } from '@/lib/indicators/types';

interface RawIndicatorRow {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  fractals: any;
  horizontal_trendlines: any;
  diagonal_trendlines: any;
  momentum_candles: any;
  keltner_channels: any;
  tema: number | null;
  hrma: number | null;
  smma: number | null;
  zigzag: any;
}

export async function getIndicatorData(
  symbol: string,
  timeframe: string,
  limit: number = 1000
): Promise<IndicatorData> {
  const tableName = `${symbol.toLowerCase()}_${timeframe.toLowerCase()}`;

  const rows = await query<RawIndicatorRow>(
    `SELECT timestamp, open, high, low, close,
            fractals, horizontal_trendlines, diagonal_trendlines,
            momentum_candles, keltner_channels, tema, hrma, smma, zigzag
     FROM ${tableName}
     ORDER BY timestamp DESC
     LIMIT $1`,
    [limit]
  );

  // Transform to response format
  const ohlc: OHLCBar[] = rows.map(row => ({
    time: Math.floor(new Date(row.timestamp).getTime() / 1000),
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
  })).reverse();

  return {
    ohlc,
    fractals: rows[0]?.fractals || { peaks: [], bottoms: [] },
    horizontal_trendlines: rows[0]?.horizontal_trendlines || { support: [], resistance: [] },
    diagonal_trendlines: rows[0]?.diagonal_trendlines || { support: [], resistance: [] },
    momentum_candles: rows.map(r => r.momentum_candles).filter(Boolean).flat(),
    keltner_channels: rows[0]?.keltner_channels || { upper: [], middle: [], lower: [], timestamps: [] },
    tema: rows.map(r => r.tema).filter((v): v is number => v !== null).reverse(),
    hrma: rows.map(r => r.hrma).filter((v): v is number => v !== null).reverse(),
    smma: rows.map(r => r.smma).filter((v): v is number => v !== null).reverse(),
    zigzag: rows[0]?.zigzag || { points: [] },
  };
}

export async function getDataFreshness(symbol: string, timeframe: string): Promise<Date | null> {
  const tableName = `${symbol.toLowerCase()}_${timeframe.toLowerCase()}`;
  const rows = await query<{ timestamp: Date }>(
    `SELECT timestamp FROM ${tableName} ORDER BY timestamp DESC LIMIT 1`
  );
  return rows[0]?.timestamp || null;
}

export async function getTableRowCount(symbol: string, timeframe: string): Promise<number> {
  const tableName = `${symbol.toLowerCase()}_${timeframe.toLowerCase()}`;
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM ${tableName}`
  );
  return parseInt(rows[0]?.count || '0', 10);
}

export async function getTableCount(): Promise<number> {
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
  );
  return parseInt(rows[0]?.count || '0', 10);
}
```

### 4. `lib/tier/validation.ts`
Create tier validation utilities:
```typescript
export const ALL_SYMBOLS = [
  'AUDJPY', 'AUDUSD', 'BTCUSD', 'ETHUSD', 'EURUSD',
  'GBPJPY', 'GBPUSD', 'NDX100', 'NZDUSD', 'US30',
  'USDCAD', 'USDCHF', 'USDJPY', 'XAGUSD', 'XAUUSD'
] as const;

export const ALL_TIMEFRAMES = [
  'M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'H12', 'D1'
] as const;

export const FREE_SYMBOLS = ['BTCUSD', 'EURUSD', 'USDJPY', 'US30', 'XAUUSD'] as const;
export const FREE_TIMEFRAMES = ['H1', 'H4', 'D1'] as const;

export type Symbol = typeof ALL_SYMBOLS[number];
export type Timeframe = typeof ALL_TIMEFRAMES[number];
export type Tier = 'FREE' | 'PRO';

export interface TierAccessResult {
  allowed: boolean;
  message: string;
}

export function validateTierAccess(
  symbol: string,
  timeframe: string,
  tier: Tier
): TierAccessResult {
  const upperSymbol = symbol.toUpperCase();
  const upperTimeframe = timeframe.toUpperCase();

  // Validate symbol exists
  if (!ALL_SYMBOLS.includes(upperSymbol as Symbol)) {
    return { allowed: false, message: `Invalid symbol: ${symbol}` };
  }

  // Validate timeframe exists
  if (!ALL_TIMEFRAMES.includes(upperTimeframe as Timeframe)) {
    return { allowed: false, message: `Invalid timeframe: ${timeframe}` };
  }

  // PRO tier has access to everything
  if (tier === 'PRO') {
    return { allowed: true, message: 'PRO tier access granted' };
  }

  // FREE tier restrictions
  const symbolAllowed = FREE_SYMBOLS.includes(upperSymbol as typeof FREE_SYMBOLS[number]);
  const timeframeAllowed = FREE_TIMEFRAMES.includes(upperTimeframe as typeof FREE_TIMEFRAMES[number]);

  if (!symbolAllowed) {
    return {
      allowed: false,
      message: `Symbol ${symbol} requires PRO tier. FREE tier symbols: ${FREE_SYMBOLS.join(', ')}`
    };
  }

  if (!timeframeAllowed) {
    return {
      allowed: false,
      message: `Timeframe ${timeframe} requires PRO tier. FREE tier timeframes: ${FREE_TIMEFRAMES.join(', ')}`
    };
  }

  return { allowed: true, message: 'FREE tier access granted' };
}

export function getAccessibleSymbols(tier: Tier): readonly string[] {
  return tier === 'PRO' ? ALL_SYMBOLS : FREE_SYMBOLS;
}

export function getAccessibleTimeframes(tier: Tier): readonly string[] {
  return tier === 'PRO' ? ALL_TIMEFRAMES : FREE_TIMEFRAMES;
}

export function isValidSymbol(symbol: string): boolean {
  return ALL_SYMBOLS.includes(symbol.toUpperCase() as Symbol);
}

export function isValidTimeframe(timeframe: string): boolean {
  return ALL_TIMEFRAMES.includes(timeframe.toUpperCase() as Timeframe);
}
```

### 5. `lib/market-hours/trading-sessions.ts`
Create market hours configuration:
```typescript
export interface SymbolTradingHours {
  type: 'crypto' | 'forex' | 'index' | 'metal';
  days: string[];
  open: string;  // HH:MM:SS format
  close: string; // HH:MM:SS format
}

export const SYMBOL_TRADING_HOURS: Record<string, SymbolTradingHours> = {
  // 24/7 Crypto
  BTCUSD: { type: 'crypto', days: ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'], open: '00:00:00', close: '23:59:59' },
  ETHUSD: { type: 'crypto', days: ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'], open: '00:00:00', close: '23:59:59' },

  // Forex (Mon-Fri, 00:04-23:58)
  EURUSD: { type: 'forex', days: ['monday','tuesday','wednesday','thursday','friday'], open: '00:04:00', close: '23:58:00' },
  USDJPY: { type: 'forex', days: ['monday','tuesday','wednesday','thursday','friday'], open: '00:04:00', close: '23:58:00' },
  AUDJPY: { type: 'forex', days: ['monday','tuesday','wednesday','thursday','friday'], open: '00:04:00', close: '23:58:00' },
  AUDUSD: { type: 'forex', days: ['monday','tuesday','wednesday','thursday','friday'], open: '00:04:00', close: '23:58:00' },
  GBPJPY: { type: 'forex', days: ['monday','tuesday','wednesday','thursday','friday'], open: '00:04:00', close: '23:58:00' },
  GBPUSD: { type: 'forex', days: ['monday','tuesday','wednesday','thursday','friday'], open: '00:04:00', close: '23:58:00' },
  NZDUSD: { type: 'forex', days: ['monday','tuesday','wednesday','thursday','friday'], open: '00:04:00', close: '23:58:00' },
  USDCAD: { type: 'forex', days: ['monday','tuesday','wednesday','thursday','friday'], open: '00:04:00', close: '23:58:00' },
  USDCHF: { type: 'forex', days: ['monday','tuesday','wednesday','thursday','friday'], open: '00:04:00', close: '23:58:00' },

  // Indices (Mon-Fri, 01:00-24:00)
  US30: { type: 'index', days: ['monday','tuesday','wednesday','thursday','friday'], open: '01:00:00', close: '24:00:00' },
  NDX100: { type: 'index', days: ['monday','tuesday','wednesday','thursday','friday'], open: '01:00:00', close: '24:00:00' },

  // Metals (Mon-Fri, 01:01-23:59)
  XAUUSD: { type: 'metal', days: ['monday','tuesday','wednesday','thursday','friday'], open: '01:01:00', close: '23:59:00' },
  XAGUSD: { type: 'metal', days: ['monday','tuesday','wednesday','thursday','friday'], open: '01:01:00', close: '23:59:00' },
};

// DST transitions (US-based for MT5 server)
// Standard Time: 1st Sunday of November at 02:00 AM
// Daylight Saving: 2nd Sunday of March at 02:00 AM
export function isDSTActive(date: Date = new Date()): boolean {
  const year = date.getUTCFullYear();

  // Find 2nd Sunday of March
  const marchFirst = new Date(Date.UTC(year, 2, 1));
  const marchFirstDay = marchFirst.getUTCDay();
  const secondSundayMarch = new Date(Date.UTC(year, 2, 8 + (7 - marchFirstDay) % 7));

  // Find 1st Sunday of November
  const novFirst = new Date(Date.UTC(year, 10, 1));
  const novFirstDay = novFirst.getUTCDay();
  const firstSundayNov = new Date(Date.UTC(year, 10, 1 + (7 - novFirstDay) % 7));

  // DST is active between March and November
  return date >= secondSundayMarch && date < firstSundayNov;
}

export function getServerUTCOffset(date: Date = new Date()): 2 | 3 {
  return isDSTActive(date) ? 3 : 2;
}

export function getCurrentMT5ServerTime(): Date {
  const now = new Date();
  const offset = getServerUTCOffset(now);
  return new Date(now.getTime() + offset * 60 * 60 * 1000);
}

export function unixToMT5ServerTime(unixTimestamp: number): Date {
  const date = new Date(unixTimestamp * 1000);
  const offset = getServerUTCOffset(date);
  return new Date(date.getTime() + offset * 60 * 60 * 1000);
}
```

### 6. `lib/market-hours/validator.ts`
Create market hours validation utilities:
```typescript
import { TradingHours } from '@/lib/indicators/types';
import {
  SYMBOL_TRADING_HOURS,
  SymbolTradingHours,
  isDSTActive,
  getServerUTCOffset,
  getCurrentMT5ServerTime
} from './trading-sessions';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function parseTime(timeStr: string): { hours: number; minutes: number; seconds: number } {
  const [hours, minutes, seconds] = timeStr.split(':').map(Number);
  return { hours, minutes, seconds: seconds || 0 };
}

function timeToMinutes(timeStr: string): number {
  const { hours, minutes } = parseTime(timeStr);
  return hours * 60 + minutes;
}

export function isMarketOpen(symbol: string, timestamp: Date = new Date()): boolean {
  const config = SYMBOL_TRADING_HOURS[symbol.toUpperCase()];
  if (!config) return false;

  // Crypto is always open
  if (config.type === 'crypto') return true;

  // Get MT5 server time
  const offset = getServerUTCOffset(timestamp);
  const serverTime = new Date(timestamp.getTime() + offset * 60 * 60 * 1000);

  const dayName = DAY_NAMES[serverTime.getUTCDay()];

  // Check if today is a trading day
  if (!config.days.includes(dayName)) return false;

  // Check if within trading hours
  const currentMinutes = serverTime.getUTCHours() * 60 + serverTime.getUTCMinutes();
  const openMinutes = timeToMinutes(config.open);
  let closeMinutes = timeToMinutes(config.close);

  // Handle "24:00:00" as end of day
  if (closeMinutes === 0 && config.close.startsWith('24')) {
    closeMinutes = 24 * 60;
  }

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

export function getMarketStatus(symbol: string): 'OPEN' | 'CLOSED' {
  return isMarketOpen(symbol) ? 'OPEN' : 'CLOSED';
}

export function getNextMarketOpen(symbol: string): Date | null {
  const config = SYMBOL_TRADING_HOURS[symbol.toUpperCase()];
  if (!config) return null;

  // Crypto never closes
  if (config.type === 'crypto') return null;

  const now = new Date();
  const offset = getServerUTCOffset(now);
  const serverTime = getCurrentMT5ServerTime();

  // If market is open, return null
  if (isMarketOpen(symbol)) return null;

  // Find next trading day
  for (let daysAhead = 0; daysAhead <= 7; daysAhead++) {
    const checkDate = new Date(serverTime);
    checkDate.setUTCDate(checkDate.getUTCDate() + daysAhead);

    const dayName = DAY_NAMES[checkDate.getUTCDay()];

    if (config.days.includes(dayName)) {
      const { hours, minutes } = parseTime(config.open);
      checkDate.setUTCHours(hours, minutes, 0, 0);

      // If same day, check if open time is in the future
      if (daysAhead === 0 && checkDate <= serverTime) {
        continue;
      }

      // Convert back to UTC
      const utcTime = new Date(checkDate.getTime() - offset * 60 * 60 * 1000);
      return utcTime;
    }
  }

  return null;
}

export function getTradingHoursForSymbol(symbol: string): TradingHours {
  const config = SYMBOL_TRADING_HOURS[symbol.toUpperCase()];
  const offset = getServerUTCOffset();

  if (!config) {
    return {
      open: '00:00:00',
      close: '23:59:59',
      timezone: `GMT+${offset}`,
      days: [],
    };
  }

  return {
    open: config.open,
    close: config.close,
    timezone: `GMT+${offset}`,
    days: config.days,
  };
}

export function getMarketMetadata(symbol: string): {
  market_status: 'OPEN' | 'CLOSED';
  trading_hours: TradingHours;
  next_market_open: string | null;
  dst_active: boolean;
  server_utc_offset: 2 | 3;
} {
  const nextOpen = getNextMarketOpen(symbol);

  return {
    market_status: getMarketStatus(symbol),
    trading_hours: getTradingHoursForSymbol(symbol),
    next_market_open: nextOpen ? nextOpen.toISOString() : null,
    dst_active: isDSTActive(),
    server_utc_offset: getServerUTCOffset(),
  };
}
```

## Important Notes
- These files are PREREQUISITES for Phase 04b API routes
- All types must match OpenAPI specification exactly
- Use Unix timestamps (UTC-based) throughout
- DST handling is critical for accurate market hours

## Success Criteria
- [ ] All 6 TypeScript files compile without errors
- [ ] `npm run build` passes
- [ ] Types match OpenAPI specification
- [ ] Tier validation correctly restricts FREE tier
- [ ] Market hours correctly identify open/closed for all symbol types
- [ ] DST calculation works correctly

## Testing Commands
```bash
# Type check only
npx tsc --noEmit

# Build to verify compilation
npm run build
```

## Commit Instructions
After creating all files, commit with message:
```
feat(lib): add foundation library files for indicator API

- Add TypeScript types matching OpenAPI specification
- Add PostgreSQL client with connection pooling
- Add database query functions for indicator data
- Add tier validation utilities (FREE/PRO)
- Add market hours configuration for 15 symbols
- Add market hours validation with DST handling
```
```

---

## Next Step

After Phase 04a compiles successfully, proceed to `part-20-phase04b-prompts.md` (API Routes).
