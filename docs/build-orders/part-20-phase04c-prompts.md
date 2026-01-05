# Part 20 - Phase 04c: Tier Validation

**Purpose:** Create tier validation utilities for FREE/PRO access control.

**Files:** 1 | **Dependencies:** Phase 04b | **Est. Size:** ~4 KB

---

## Dependency Validation

Before starting this phase, verify Phases 04a and 04b are complete:

```bash
# Phase 04a output must exist:
ls -la lib/indicators/types.ts

# Phase 04b outputs must exist:
ls -la lib/db/postgresql.ts
ls -la lib/db/queries.ts

# Verify all compile:
npx tsc --noEmit
```

**If any files are missing, complete the required phases first.**

---

## Phase 04 Context

Phase 04 is split into 5 smaller phases for better compilation success:

```
Phase 04a (Types) ──┬──► Phase 04b (Database) ──► Phase 04c (Tier)
        ✓          │           ✓                  ◄── YOU ARE HERE
                    └──► Phase 04d (Market Hours) ───────┘
                                                         │
                                                         ▼
                                                 Phase 04e (API Routes)
```

**This is Phase 04c** - Creates tier validation (standalone, no imports from other Phase 04 files).

---

## Usage Instructions

1. Start a fresh Claude Code (web) chat
2. Copy and paste the prompt below

---

## Phase 04c Prompt

```
# Part 20 - Phase 04c: Tier Validation

## Context
I'm implementing Part 20 of Trading Alerts SaaS. Phases 04a and 04b are complete.

Phase 04 is split into 5 sub-phases (04a → 04e). This is Phase 04c.

## Phase 04 Overview
- 04a: TypeScript Types ✓ COMPLETE
- 04b: Database Layer ✓ COMPLETE
- 04c: Tier Validation (this phase)
- 04d: Market Hours (depends on 04a)
- 04e: API Routes (depends on 04b, 04c, 04d)

## Existing Files
- `lib/indicators/types.ts` - Contains Tier type
- `lib/db/postgresql.ts` - PostgreSQL client
- `lib/db/queries.ts` - Query functions

## Your Task
Create 1 file for tier validation. This file is standalone (no imports from other Phase 04 files).

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
    return { allowed: false, message: `Symbol ${symbol} requires PRO tier` };
  }

  if (!timeframeAllowed) {
    return { allowed: false, message: `Timeframe ${timeframe} requires PRO tier` };
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
- [ ] `lib/tier/validation.ts` created
- [ ] File compiles without errors
- [ ] `npx tsc --noEmit` passes

## Commit Message
```
feat(tier): add tier validation utilities (Phase 04c)

- Add symbol and timeframe constants
- Add validateTierAccess function
- Add getAccessibleSymbols/Timeframes helpers
```
```

---

## What This Phase Produces

After completing Phase 04c, you will have:
- `lib/tier/validation.ts` - Tier access validation

This is required by:
- Phase 04e (API Routes) - for access control

---

## Next Step

After Phase 04c compiles successfully, proceed to `part-20-phase04d-prompts.md` (Market Hours).

**Note:** Phase 04d can also be done in parallel with 04c since both only depend on 04a.
