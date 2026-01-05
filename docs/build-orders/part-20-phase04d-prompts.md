# Part 20 - Phase 04d: Market Hours

**Purpose:** Create market hours configuration and validation utilities.

---

## Usage Instructions

1. Start a fresh Claude Code (web) chat
2. Copy and paste the prompt below

---

## Phase 04d Prompt

```
# Part 20 - Phase 04d: Market Hours

## Context
I'm implementing Part 20 of Trading Alerts SaaS. Phases 04a-04c are complete.

This phase creates market hours utilities for all 15 symbols.

## Prerequisites
- Phase 04a completed (TradingHours type exists)

## Your Task
Create 2 files for market hours handling.

## Files to Create

### 1. `lib/market-hours/trading-sessions.ts`

```typescript
export interface SymbolTradingHours {
  type: 'crypto' | 'forex' | 'index' | 'metal';
  days: string[];
  open: string;
  close: string;
}

export const SYMBOL_TRADING_HOURS: Record<string, SymbolTradingHours> = {
  // Crypto 24/7
  BTCUSD: { type: 'crypto', days: ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'], open: '00:00:00', close: '23:59:59' },
  ETHUSD: { type: 'crypto', days: ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'], open: '00:00:00', close: '23:59:59' },
  // Forex
  EURUSD: { type: 'forex', days: ['monday','tuesday','wednesday','thursday','friday'], open: '00:04:00', close: '23:58:00' },
  USDJPY: { type: 'forex', days: ['monday','tuesday','wednesday','thursday','friday'], open: '00:04:00', close: '23:58:00' },
  AUDJPY: { type: 'forex', days: ['monday','tuesday','wednesday','thursday','friday'], open: '00:04:00', close: '23:58:00' },
  AUDUSD: { type: 'forex', days: ['monday','tuesday','wednesday','thursday','friday'], open: '00:04:00', close: '23:58:00' },
  GBPJPY: { type: 'forex', days: ['monday','tuesday','wednesday','thursday','friday'], open: '00:04:00', close: '23:58:00' },
  GBPUSD: { type: 'forex', days: ['monday','tuesday','wednesday','thursday','friday'], open: '00:04:00', close: '23:58:00' },
  NZDUSD: { type: 'forex', days: ['monday','tuesday','wednesday','thursday','friday'], open: '00:04:00', close: '23:58:00' },
  USDCAD: { type: 'forex', days: ['monday','tuesday','wednesday','thursday','friday'], open: '00:04:00', close: '23:58:00' },
  USDCHF: { type: 'forex', days: ['monday','tuesday','wednesday','thursday','friday'], open: '00:04:00', close: '23:58:00' },
  // Indices
  US30: { type: 'index', days: ['monday','tuesday','wednesday','thursday','friday'], open: '01:00:00', close: '24:00:00' },
  NDX100: { type: 'index', days: ['monday','tuesday','wednesday','thursday','friday'], open: '01:00:00', close: '24:00:00' },
  // Metals
  XAUUSD: { type: 'metal', days: ['monday','tuesday','wednesday','thursday','friday'], open: '01:01:00', close: '23:59:00' },
  XAGUSD: { type: 'metal', days: ['monday','tuesday','wednesday','thursday','friday'], open: '01:01:00', close: '23:59:00' },
};

export function isDSTActive(date: Date = new Date()): boolean {
  const year = date.getUTCFullYear();
  const marchFirst = new Date(Date.UTC(year, 2, 1));
  const marchFirstDay = marchFirst.getUTCDay();
  const secondSundayMarch = new Date(Date.UTC(year, 2, 8 + (7 - marchFirstDay) % 7));
  const novFirst = new Date(Date.UTC(year, 10, 1));
  const novFirstDay = novFirst.getUTCDay();
  const firstSundayNov = new Date(Date.UTC(year, 10, 1 + (7 - novFirstDay) % 7));
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
```

### 2. `lib/market-hours/validator.ts`

```typescript
import type { TradingHours } from '@/lib/indicators/types';
import { SYMBOL_TRADING_HOURS, isDSTActive, getServerUTCOffset } from './trading-sessions';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

export function isMarketOpen(symbol: string, timestamp: Date = new Date()): boolean {
  const config = SYMBOL_TRADING_HOURS[symbol.toUpperCase()];
  if (!config) return false;
  if (config.type === 'crypto') return true;

  const offset = getServerUTCOffset(timestamp);
  const serverTime = new Date(timestamp.getTime() + offset * 60 * 60 * 1000);
  const dayName = DAY_NAMES[serverTime.getUTCDay()];

  if (!config.days.includes(dayName)) return false;

  const currentMinutes = serverTime.getUTCHours() * 60 + serverTime.getUTCMinutes();
  const openMinutes = timeToMinutes(config.open);
  let closeMinutes = timeToMinutes(config.close);
  if (closeMinutes === 0 && config.close.startsWith('24')) closeMinutes = 24 * 60;

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

export function getMarketStatus(symbol: string): 'OPEN' | 'CLOSED' {
  return isMarketOpen(symbol) ? 'OPEN' : 'CLOSED';
}

export function getTradingHoursForSymbol(symbol: string): TradingHours {
  const config = SYMBOL_TRADING_HOURS[symbol.toUpperCase()];
  const offset = getServerUTCOffset();
  if (!config) return { open: '00:00:00', close: '23:59:59', timezone: `GMT+${offset}`, days: [] };
  return { open: config.open, close: config.close, timezone: `GMT+${offset}`, days: config.days };
}

export function getMarketMetadata(symbol: string) {
  return {
    market_status: getMarketStatus(symbol),
    trading_hours: getTradingHoursForSymbol(symbol),
    next_market_open: null as string | null,
    dst_active: isDSTActive(),
    server_utc_offset: getServerUTCOffset(),
  };
}
```

## Success Criteria
- [ ] Both files compile without errors
- [ ] `npx tsc --noEmit` passes

## Commit Message
```
feat(market-hours): add market hours configuration

- Add trading hours for all 15 symbols
- Add DST calculation for MT5 server time
- Add isMarketOpen and getMarketMetadata utilities
```
```

---

## Next Step

After Phase 04d, proceed to `part-20-phase04e-prompts.md` (API Routes).
