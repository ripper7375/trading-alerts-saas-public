# Part 20 - Phase 04b: Database Layer

**Purpose:** Create PostgreSQL client and query functions.

**Files:** 2 | **Dependencies:** Phase 04a | **Est. Size:** ~5 KB

---

## Dependency Validation

Before starting this phase, verify Phase 04a is complete:

```bash
# Phase 04a output must exist:
ls -la lib/indicators/types.ts

# Verify it compiles:
npx tsc --noEmit lib/indicators/types.ts

# Required types from Phase 04a:
# - IndicatorData
# - OHLCBar
```

**If `lib/indicators/types.ts` doesn't exist, complete Phase 04a first.**

---

## Phase 04 Context

Phase 04 is split into 5 smaller phases for better compilation success:

```
Phase 04a (Types) ──┬──► Phase 04b (Database) ──► Phase 04c (Tier)
        ✓          │           ◄── YOU ARE HERE
                    └──► Phase 04d (Market Hours) ───────┘
                                                         │
                                                         ▼
                                                 Phase 04e (API Routes)
```

**This is Phase 04b** - Creates database access layer using types from Phase 04a.

---

## Usage Instructions

1. Start a fresh Claude Code (web) chat
2. Attach: `docs/open-api-documents/part-20-sqlite-sync-postgresql-openapi.yaml`
3. Copy and paste the prompt below

---

## Phase 04b Prompt

```
# Part 20 - Phase 04b: Database Layer

## Context
I'm implementing Part 20 of Trading Alerts SaaS. Phase 04a is complete.

Phase 04 is split into 5 sub-phases (04a → 04e). This is Phase 04b.

## Phase 04 Overview
- 04a: TypeScript Types ✓ COMPLETE
- 04b: Database Layer (this phase)
- 04c: Tier Validation (depends on 04b)
- 04d: Market Hours (depends on 04a)
- 04e: API Routes (depends on 04b, 04c, 04d)

## Existing Files from Phase 04a
- `lib/indicators/types.ts` - Contains IndicatorData, OHLCBar, etc.

## Prerequisites
- Phase 04a completed (types exist)
- PostgreSQL connection string in POSTGRESQL_URI env variable
- `pg` package installed (`npm install pg @types/pg`)

## Your Task
Create 2 database files.

## Files to Create

### 1. `lib/db/postgresql.ts`

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

export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
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

### 2. `lib/db/queries.ts`

```typescript
import { query } from './postgresql';
import type { IndicatorData, OHLCBar } from '@/lib/indicators/types';

interface RawRow {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  fractals: unknown;
  horizontal_trendlines: unknown;
  diagonal_trendlines: unknown;
  momentum_candles: unknown;
  keltner_channels: unknown;
  tema: number | null;
  hrma: number | null;
  smma: number | null;
  zigzag: unknown;
}

export async function getIndicatorData(
  symbol: string,
  timeframe: string,
  limit: number = 1000
): Promise<IndicatorData> {
  const tableName = `${symbol.toLowerCase()}_${timeframe.toLowerCase()}`;

  const rows = await query<RawRow>(
    `SELECT timestamp, open, high, low, close,
            fractals, horizontal_trendlines, diagonal_trendlines,
            momentum_candles, keltner_channels, tema, hrma, smma, zigzag
     FROM ${tableName}
     ORDER BY timestamp DESC
     LIMIT $1`,
    [limit]
  );

  const ohlc: OHLCBar[] = rows.map(row => ({
    time: Math.floor(new Date(row.timestamp).getTime() / 1000),
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
  })).reverse();

  return {
    ohlc,
    fractals: (rows[0]?.fractals as IndicatorData['fractals']) || { peaks: [], bottoms: [] },
    horizontal_trendlines: (rows[0]?.horizontal_trendlines as IndicatorData['horizontal_trendlines']) || { support: [], resistance: [] },
    diagonal_trendlines: (rows[0]?.diagonal_trendlines as IndicatorData['diagonal_trendlines']) || { support: [], resistance: [] },
    momentum_candles: rows.flatMap(r => (r.momentum_candles as IndicatorData['momentum_candles']) || []),
    keltner_channels: (rows[0]?.keltner_channels as IndicatorData['keltner_channels']) || { upper: [], middle: [], lower: [], timestamps: [] },
    tema: rows.map(r => r.tema).filter((v): v is number => v !== null).reverse(),
    hrma: rows.map(r => r.hrma).filter((v): v is number => v !== null).reverse(),
    smma: rows.map(r => r.smma).filter((v): v is number => v !== null).reverse(),
    zigzag: (rows[0]?.zigzag as IndicatorData['zigzag']) || { points: [] },
  };
}

export async function getDataFreshness(symbol: string, timeframe: string): Promise<Date | null> {
  const tableName = `${symbol.toLowerCase()}_${timeframe.toLowerCase()}`;
  const rows = await query<{ timestamp: Date }>(
    `SELECT timestamp FROM ${tableName} ORDER BY timestamp DESC LIMIT 1`
  );
  return rows[0]?.timestamp || null;
}

export async function getTableCount(): Promise<number> {
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
  );
  return parseInt(rows[0]?.count || '0', 10);
}
```

## Success Criteria
- [ ] `lib/db/postgresql.ts` created
- [ ] `lib/db/queries.ts` created
- [ ] Both files compile without errors
- [ ] `npx tsc --noEmit` passes

## Commit Message
```
feat(db): add PostgreSQL client and query functions (Phase 04b)

- Add connection pool with pg package
- Add getIndicatorData query function
- Add getDataFreshness and getTableCount utilities
```
```

---

## What This Phase Produces

After completing Phase 04b, you will have:
- `lib/db/postgresql.ts` - PostgreSQL connection pool
- `lib/db/queries.ts` - Database query functions

These are required by:
- Phase 04c (Tier Validation) - for symbol validation
- Phase 04e (API Routes) - for data fetching

---

## Next Step

After Phase 04b compiles successfully, proceed to `part-20-phase04c-prompts.md` (Tier Validation).
