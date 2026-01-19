# Part 20 - Phase 04e: API Routes

**Purpose:** Create Next.js API routes for indicator data.

**Files:** 4 | **Dependencies:** Phases 04b, 04c, 04d | **Est. Size:** ~6 KB

---

## Dependency Validation

Before starting this phase, verify ALL previous Phase 04 sub-phases are complete:

```bash
# Phase 04a outputs:
ls -la lib/indicators/types.ts

# Phase 04b outputs:
ls -la lib/db/postgresql.ts
ls -la lib/db/queries.ts

# Phase 04c output:
ls -la lib/tier/validation.ts

# Phase 04d outputs:
ls -la lib/market-hours/trading-sessions.ts
ls -la lib/market-hours/validator.ts

# Verify ALL compile together:
npx tsc --noEmit
```

**Required exports from each phase:**

| Phase | File                            | Required Exports                                                                                                                                                                         |
| ----- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 04a   | `lib/indicators/types.ts`       | `IndicatorResponse`, `Tier`                                                                                                                                                              |
| 04b   | `lib/db/postgresql.ts`          | `checkConnection`                                                                                                                                                                        |
| 04b   | `lib/db/queries.ts`             | `getIndicatorData`, `getDataFreshness`, `getTableCount`                                                                                                                                  |
| 04c   | `lib/tier/validation.ts`        | `validateTierAccess`, `isValidSymbol`, `isValidTimeframe`, `getAccessibleSymbols`, `getAccessibleTimeframes`, `ALL_SYMBOLS`, `ALL_TIMEFRAMES`, `FREE_SYMBOLS`, `FREE_TIMEFRAMES`, `Tier` |
| 04d   | `lib/market-hours/validator.ts` | `getMarketMetadata`                                                                                                                                                                      |

**If any files are missing, complete the required phases first.**

---

## Phase 04 Context

Phase 04 is split into 5 smaller phases for better compilation success:

```
Phase 04a (Types) ──┬──► Phase 04b (Database) ──► Phase 04c (Tier)
        ✓          │           ✓                        ✓
                    └──► Phase 04d (Market Hours) ───────┘
                                    ✓                    │
                                                         ▼
                                                 Phase 04e (API Routes)
                                                   ◄── YOU ARE HERE
```

**This is Phase 04e** - Creates API routes that combine all previous Phase 04 modules.

---

## Usage Instructions

1. Start a fresh Claude Code (web) chat
2. Copy and paste the prompt below

---

## Phase 04e Prompt

````
# Part 20 - Phase 04e: API Routes

## Context
I'm implementing Part 20 of Trading Alerts SaaS. Phases 04a-04d are complete.

Phase 04 is split into 5 sub-phases (04a → 04e). This is Phase 04e (final).

## Phase 04 Overview
- 04a: TypeScript Types ✓ COMPLETE
- 04b: Database Layer ✓ COMPLETE
- 04c: Tier Validation ✓ COMPLETE
- 04d: Market Hours ✓ COMPLETE
- 04e: API Routes (this phase - FINAL)

## Existing Files from Previous Phases
- `lib/indicators/types.ts` - IndicatorResponse, Tier types
- `lib/db/postgresql.ts` - checkConnection
- `lib/db/queries.ts` - getIndicatorData, getDataFreshness, getTableCount
- `lib/tier/validation.ts` - validateTierAccess, isValidSymbol, etc.
- `lib/market-hours/validator.ts` - getMarketMetadata

## Prerequisites
- Phases 04a-04d completed (all library files exist)
- NextAuth.js configured (authOptions at @/lib/auth)

## Your Task
Create 4 API route files that import from the Phase 04a-04d libraries.

## Files to Create

### 1. `app/api/indicators/[symbol]/[timeframe]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getIndicatorData, getDataFreshness } from '@/lib/db/queries';
import { validateTierAccess, isValidSymbol, isValidTimeframe, Tier } from '@/lib/tier/validation';
import { getMarketMetadata } from '@/lib/market-hours/validator';
import type { IndicatorResponse } from '@/lib/indicators/types';

interface RouteParams {
  params: { symbol: string; timeframe: string };
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<IndicatorResponse>> {
  try {
    const { symbol, timeframe } = params;
    const upperSymbol = symbol.toUpperCase();
    const upperTimeframe = timeframe.toUpperCase();

    if (!isValidSymbol(upperSymbol)) {
      return NextResponse.json({ success: false, error: `Invalid symbol: ${symbol}` }, { status: 400 });
    }

    if (!isValidTimeframe(upperTimeframe)) {
      return NextResponse.json({ success: false, error: `Invalid timeframe: ${timeframe}` }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    const userTier = ((session?.user as Record<string, unknown>)?.tier as Tier) || 'FREE';

    const accessResult = validateTierAccess(upperSymbol, upperTimeframe, userTier);
    if (!accessResult.allowed) {
      return NextResponse.json({ success: false, error: accessResult.message }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '1000', 10), 1), 10000);

    const data = await getIndicatorData(upperSymbol, upperTimeframe, limit);
    const lastUpdate = await getDataFreshness(upperSymbol, upperTimeframe);
    const marketMetadata = getMarketMetadata(upperSymbol);

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        metadata: {
          symbol: upperSymbol,
          timeframe: upperTimeframe,
          tier: userTier,
          bars_returned: data.ohlc.length,
          last_update: lastUpdate?.toISOString() || new Date().toISOString(),
          pro_indicators_enabled: userTier === 'PRO',
          ...marketMetadata,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching indicator data:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
````

### 2. `app/api/indicators/health/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { checkConnection } from '@/lib/db/postgresql';
import { getTableCount } from '@/lib/db/queries';

interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  version: string;
  database: { connected: boolean; tables: number };
  timestamp: string;
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  try {
    const connected = await checkConnection();
    const tableCount = connected ? await getTableCount() : 0;

    return NextResponse.json(
      {
        status: connected ? 'healthy' : 'unhealthy',
        version: '2.0.0',
        database: { connected, tables: tableCount },
        timestamp: new Date().toISOString(),
      },
      { status: connected ? 200 : 503 }
    );
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        version: '2.0.0',
        database: { connected: false, tables: 0 },
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
```

### 3. `app/api/symbols/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getAccessibleSymbols,
  ALL_SYMBOLS,
  FREE_SYMBOLS,
  Tier,
} from '@/lib/tier/validation';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userTier =
      ((session?.user as Record<string, unknown>)?.tier as Tier) || 'FREE';

    return NextResponse.json({
      success: true,
      symbols: getAccessibleSymbols(userTier),
      tier: userTier,
      total_available: ALL_SYMBOLS.length,
      free_symbols: FREE_SYMBOLS,
    });
  } catch (error) {
    console.error('Error fetching symbols:', error);
    return NextResponse.json(
      {
        success: false,
        symbols: FREE_SYMBOLS,
        tier: 'FREE',
        total_available: ALL_SYMBOLS.length,
        free_symbols: FREE_SYMBOLS,
      },
      { status: 500 }
    );
  }
}
```

### 4. `app/api/timeframes/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getAccessibleTimeframes,
  ALL_TIMEFRAMES,
  FREE_TIMEFRAMES,
  Tier,
} from '@/lib/tier/validation';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userTier =
      ((session?.user as Record<string, unknown>)?.tier as Tier) || 'FREE';

    return NextResponse.json({
      success: true,
      timeframes: getAccessibleTimeframes(userTier),
      tier: userTier,
      total_available: ALL_TIMEFRAMES.length,
      free_timeframes: FREE_TIMEFRAMES,
    });
  } catch (error) {
    console.error('Error fetching timeframes:', error);
    return NextResponse.json(
      {
        success: false,
        timeframes: FREE_TIMEFRAMES,
        tier: 'FREE',
        total_available: ALL_TIMEFRAMES.length,
        free_timeframes: FREE_TIMEFRAMES,
      },
      { status: 500 }
    );
  }
}
```

## Success Criteria

- [ ] All 4 API route files created
- [ ] All files compile without errors
- [ ] `npm run build` passes
- [ ] GET /api/indicators/health returns status
- [ ] GET /api/symbols returns symbol list
- [ ] GET /api/timeframes returns timeframe list

## Testing Commands

```bash
npm run build
npm run dev
curl http://localhost:3000/api/indicators/health
curl http://localhost:3000/api/symbols
curl http://localhost:3000/api/timeframes
```

## Commit Message

```
feat(api): add Next.js API routes for indicators (Phase 04e)

- Add indicators endpoint with tier validation
- Add health check endpoint
- Add symbols and timeframes endpoints
```

```

---

## What This Phase Produces

After completing Phase 04e, you will have:
- `app/api/indicators/[symbol]/[timeframe]/route.ts` - Main data endpoint
- `app/api/indicators/health/route.ts` - Health check
- `app/api/symbols/route.ts` - Symbol list
- `app/api/timeframes/route.ts` - Timeframe list

**Phase 04 is now COMPLETE!**

---

## Phase 04 Complete File Summary

| Sub-Phase | Files Created |
|-----------|---------------|
| 04a | `lib/indicators/types.ts` |
| 04b | `lib/db/postgresql.ts`, `lib/db/queries.ts` |
| 04c | `lib/tier/validation.ts` |
| 04d | `lib/market-hours/trading-sessions.ts`, `lib/market-hours/validator.ts` |
| 04e | `app/api/indicators/[symbol]/[timeframe]/route.ts`, `app/api/indicators/health/route.ts`, `app/api/symbols/route.ts`, `app/api/timeframes/route.ts` |

**Total: 10 files**

---

## Next Step

After Phase 04e compiles successfully, proceed to `part-20-phase05-prompts.md` (Redis Caching Layer).
```
