# Part 20 - Phase 04c: Tier Validation

**Purpose:** Create tier validation utilities for FREE/PRO access control.

---

## Usage Instructions

1. Start a fresh Claude Code (web) chat
2. Copy and paste the prompt below

---

## Phase 04c Prompt

```
# Part 20 - Phase 04c: Tier Validation

## Context
I'm implementing Part 20 of Trading Alerts SaaS. Phases 04a-04b are complete.

This phase creates tier validation for symbol/timeframe access control.

## Prerequisites
- Phase 04b completed

## Your Task
Create 1 file for tier validation.

## File to Create

### `lib/tier/validation.ts`

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

export function isValidSymbol(symbol: string): boolean {
  return ALL_SYMBOLS.includes(symbol.toUpperCase() as Symbol);
}

export function isValidTimeframe(timeframe: string): boolean {
  return ALL_TIMEFRAMES.includes(timeframe.toUpperCase() as Timeframe);
}

export function validateTierAccess(
  symbol: string,
  timeframe: string,
  tier: Tier
): TierAccessResult {
  const upperSymbol = symbol.toUpperCase();
  const upperTimeframe = timeframe.toUpperCase();

  if (!isValidSymbol(upperSymbol)) {
    return { allowed: false, message: `Invalid symbol: ${symbol}` };
  }

  if (!isValidTimeframe(upperTimeframe)) {
    return { allowed: false, message: `Invalid timeframe: ${timeframe}` };
  }

  if (tier === 'PRO') {
    return { allowed: true, message: 'PRO tier access granted' };
  }

  const symbolAllowed = FREE_SYMBOLS.includes(upperSymbol as typeof FREE_SYMBOLS[number]);
  const timeframeAllowed = FREE_TIMEFRAMES.includes(upperTimeframe as typeof FREE_TIMEFRAMES[number]);

  if (!symbolAllowed) {
    return {
      allowed: false,
      message: `Symbol ${symbol} requires PRO tier`
    };
  }

  if (!timeframeAllowed) {
    return {
      allowed: false,
      message: `Timeframe ${timeframe} requires PRO tier`
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
```

## Success Criteria
- [ ] File compiles without errors
- [ ] `npx tsc --noEmit` passes

## Commit Message
```
feat(tier): add tier validation utilities

- Add symbol and timeframe constants
- Add validateTierAccess function
- Add getAccessibleSymbols/Timeframes helpers
```
```

---

## Next Step

After Phase 04c, proceed to `part-20-phase04d-prompts.md` (Market Hours).
