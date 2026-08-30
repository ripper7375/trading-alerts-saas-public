# Indexing Strategy: Search Optimization

## Trading Alerts SaaS — PostgreSQL Index Reference

**Document Version**: 1.0
**Date**: March 1, 2026
**Purpose**: Comprehensive reference for PostgreSQL indexing strategy covering Composite + Time Index and GIN Index, their roles, interactions, and optimization guidelines for the `ohlcv_5m` time-series table.

---

## Table of Contents

1. [Overview](#1-overview)
2. [The Two Indexes](#2-the-two-indexes)
3. [Two-Stage Search Strategy](#3-two-stage-search-strategy)
4. [Index Definitions](#4-index-definitions)
5. [Query Patterns and Index Behavior](#5-query-patterns-and-index-behavior)
6. [Prisma Schema](#6-prisma-schema)
7. [Performance Expectations](#7-performance-expectations)
8. [Maintenance Guidelines](#8-maintenance-guidelines)
9. [Quick Reference](#9-quick-reference)

---

## 1. Overview

### 1.1 Why Indexing Matters

The `ohlcv_5m` table grows at **38,880 rows per day** (15 symbols × 9 timeframes × 288 bars/day). Without indexes, every query performs a full table scan — reading every single row to find the data needed. At 1 year of data, that means scanning **14+ million rows** for every user query.

```
Without indexes:
User query → scan 14,000,000 rows → return 16 rows   (~2000ms)

With indexes:
User query → jump directly to 16 rows → return them  (~10ms)
```

Indexes are the single most important performance decision for your time-series database.

### 1.2 The Two-Index System

Your `ohlcv_5m` table uses exactly **two indexes** serving two completely different purposes:

| Index                             | Type             | Purpose                 | Analogy                          |
| --------------------------------- | ---------------- | ----------------------- | -------------------------------- |
| `idx_ohlcv_symbol_timeframe_time` | Composite B-Tree | Find the right **rows** | Table of contents in a book      |
| `idx_ohlcv_comments`              | GIN              | Search **inside** JSONB | Word index at the back of a book |

Together they enable a two-stage narrowing process that makes every query fast regardless of table size.

---

## 2. The Two Indexes

### 2.1 Composite + Time Index (B-Tree)

**Index name**: `idx_ohlcv_symbol_timeframe_time`
**Index type**: B-Tree (PostgreSQL default)
**Columns**: `(symbol, timeframe, timestamp DESC)`

#### What it does

A B-Tree index organizes data in a sorted tree structure. PostgreSQL can traverse this tree in milliseconds to jump directly to rows matching specific column values — instead of scanning the entire table.

The composite index on `(symbol, timeframe, timestamp)` answers the question:

> **"Where and When"** — Which symbol? Which timeframe? Which time range?

#### How it works internally

```
B-Tree Structure (simplified):

                    [EURUSD-H4-2026-01-15]
                    /                     \
     [BTCUSD-D1-...]                 [XAUUSD-H1-...]
         /    \                           /    \
   [...]    [...]              [XAUUSD-H4-2026-03-01]
                                    /          \
                         [XAUUSD-H4]       [XAUUSD-H4]
                         2026-02-28        2026-03-01
                           16 bars           16 bars
```

Query for `XAUUSD + H4 + last 16 bars` → tree traversal → direct jump to target rows. No scanning.

#### Why DESC on timestamp

```sql
-- Your most common query pattern:
ORDER BY timestamp DESC LIMIT 16   -- newest first
```

Storing timestamp in descending order in the index means PostgreSQL reads the newest rows first without needing to sort — eliminating a sort operation on every query.

#### Column order matters

The order `(symbol, timeframe, timestamp)` is deliberate:

```
symbol     → highest cardinality filter (15 symbols)
timeframe  → second filter (9 timeframes)
timestamp  → range filter (time window)
```

PostgreSQL uses leftmost columns first. A query filtering only by `symbol` still uses this index. A query filtering only by `timestamp` does not — it has no leading column context.

```sql
-- Uses index ✅ (has leading column)
WHERE symbol = 'XAUUSD'

-- Uses index ✅ (has both leading columns)
WHERE symbol = 'XAUUSD' AND timeframe = 'H4'

-- Uses index ✅ (all three columns)
WHERE symbol = 'XAUUSD' AND timeframe = 'H4'
  AND timestamp >= NOW() - INTERVAL '4 hours'

-- Does NOT use index ❌ (missing leading column)
WHERE timestamp >= NOW() - INTERVAL '4 hours'
```

---

### 2.2 GIN Index (Generalized Inverted Index)

**Index name**: `idx_ohlcv_comments`
**Index type**: GIN (Generalized Inverted Index)
**Column**: `(comments)`

#### What it does

A GIN index is purpose-built for searching **inside** complex data types — JSONB, arrays, and full-text. It builds an inverted map of every key and value inside the JSON, making it possible to search JSON content without scanning every row.

The GIN index on `comments` answers the question:

> **"What Happened"** — Which rows contain specific indicator conditions in their JSONB comments?

#### How it works internally

```
GIN builds an inverted map of JSON content:

"Price above TEMA"     → [row_id: 101, 204, 387, 502, ...]
"Over-bought"          → [row_id: 204, 389, 501, ...]
"Reversal: LIKELY"     → [row_id: 204, 503, ...]
"HRMA flat"            → [row_id: 101, 388, 390, ...]
```

Query for `"Reversal: LIKELY"` → lookup in GIN map → instantly get list of matching row IDs. No row-by-row scanning of JSON content.

#### When GIN is used vs. not used

```sql
-- GIN IS used: filtering inside JSONB content
WHERE comments @> '{"reversal": {"comment_1": "Reversal probability: LIKELY"}}'

-- GIN IS NOT used: just retrieving JSONB as a column value
SELECT *, comments FROM ohlcv_5m WHERE symbol = 'XAUUSD'
-- (comments column returned as data, not searched inside)
```

**Important**: For your primary RAG retrieval flow (fetch latest N bars and return their JSONB comments to LLM), the GIN index is NOT activated. The JSONB is simply read as a column. GIN only activates when you search _by_ JSONB content.

---

## 3. Two-Stage Search Strategy

### 3.1 The Flow

Every query that uses both indexes follows this two-stage pattern. PostgreSQL applies them automatically in the correct order.

```
┌─────────────────────────────────────────────────────────────────┐
│                  TWO-STAGE SEARCH STRATEGY                       │
└─────────────────────────────────────────────────────────────────┘

                    ┌─────────────────┐
                    │   User Query    │
                    │ "Any reversal   │
                    │  signals on     │
                    │  XAUUSD H4 in   │
                    │  last 4 hours?" │
                    └────────┬────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 1: Composite + Time Index                                 │
│                                                                  │
│  Question answered: WHERE and WHEN                               │
│  Index used:        idx_ohlcv_symbol_timeframe_time              │
│                                                                  │
│  Filters:                                                        │
│  ├── symbol    = 'XAUUSD'          ← Exact match                │
│  ├── timeframe = 'H4'              ← Exact match                │
│  └── timestamp >= NOW() - 4 hours  ← Range filter               │
│                                                                  │
│  Result: 14,000,000 rows → ~48 rows (4 hours × 12 bars/hour)    │
│  Speed:  5-15ms                                                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │  ~48 rows identified
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 2: GIN Index                                              │
│                                                                  │
│  Question answered: WHAT happened (inside JSON)                  │
│  Index used:        idx_ohlcv_comments (GIN)                    │
│                                                                  │
│  Filters:                                                        │
│  └── comments @> '{"reversal": {"comment_1": "...LIKELY..."}}'  │
│                                                                  │
│  Result: ~48 rows → rows where reversal = LIKELY                 │
│  Speed:  ~1ms (tiny dataset after Stage 1)                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Final Result    │
                    │ e.g. 3 rows     │
                    │ with reversal   │
                    │ LIKELY in the   │
                    │ last 4 hours    │
                    └─────────────────┘

Total query time: ~16ms
```

### 3.2 Why Stage Order Matters

```
WRONG order (GIN first):
GIN scans "Reversal: LIKELY" across 14,000,000 rows → returns thousands
Then filter by symbol + timeframe + time → returns 3 rows
→ Extremely slow: ~2000ms+

CORRECT order (Composite first):
Composite narrows to ~48 rows first
GIN searches inside only those 48 rows → returns 3 rows
→ Very fast: ~16ms
```

PostgreSQL's query planner is smart enough to always apply them in the correct order automatically. However, the planner relies on table statistics — keeping statistics updated ensures it makes the right decision every time (see Section 8: Maintenance).

### 3.3 Stage 1 Only (Primary RAG Flow)

For standard RAG retrieval — fetching the latest N bars and returning their JSONB comments to LLM — only Stage 1 fires. The JSONB column is returned as data, not searched inside.

```
User query: "What is XAUUSD H4 doing now?"
                    ↓
LLM extracts: symbol=XAUUSD, timeframe=H4, bars=16
                    ↓
Stage 1 only: Composite index → 16 rows
                    ↓
Each row returned with full JSONB comments column
                    ↓
LLM receives: numbers + multi-dimensional JSONB narrative
```

This is the most common query pattern — Stage 1 alone handles it in 5-15ms.

---

## 4. Index Definitions

### 4.1 SQL Definitions

```sql
-- ─────────────────────────────────────────────────────────────────────────
-- INDEX 1: Composite + Time Index (Primary)
-- Purpose:  Stage 1 — Find the right rows by symbol + timeframe + time
-- Type:     B-Tree (default)
-- Usage:    Every query that targets a specific symbol-timeframe pair
-- ─────────────────────────────────────────────────────────────────────────

CREATE INDEX idx_ohlcv_symbol_timeframe_time
    ON ohlcv_5m (symbol, timeframe, timestamp DESC);

-- Partial index for hot data (last 24 hours) — ultra-fast recent queries
CREATE INDEX idx_ohlcv_recent
    ON ohlcv_5m (symbol, timeframe, timestamp DESC)
    WHERE timestamp >= NOW() - INTERVAL '24 hours';


-- ─────────────────────────────────────────────────────────────────────────
-- INDEX 2: GIN Index (Secondary)
-- Purpose:  Stage 2 — Search inside JSONB comments after Stage 1 narrows rows
-- Type:     GIN (Generalized Inverted Index)
-- Usage:    Only when filtering by JSONB comment content
-- ─────────────────────────────────────────────────────────────────────────

CREATE INDEX idx_ohlcv_comments
    ON ohlcv_5m USING GIN (comments);


-- Unique constraint (also acts as an index)
ALTER TABLE ohlcv_5m
    ADD CONSTRAINT unique_symbol_timeframe_timestamp
    UNIQUE (symbol, timeframe, timestamp);
```

### 4.2 Index Properties Comparison

| Property            | Composite + Time Index         | GIN Index                     |
| ------------------- | ------------------------------ | ----------------------------- |
| **Type**            | B-Tree                         | GIN                           |
| **Columns**         | `symbol, timeframe, timestamp` | `comments`                    |
| **Data type**       | Text, Text, Timestamp          | JSONB                         |
| **Search style**    | Exact match + range            | Content containment (`@>`)    |
| **Insert overhead** | Very low                       | Low-medium                    |
| **Storage size**    | Small                          | Medium (maps all JSON values) |
| **Query stage**     | Stage 1 — always               | Stage 2 — conditional         |
| **Required?**       | ✅ Always essential            | 🔵 Needed for content search  |

---

## 5. Query Patterns and Index Behavior

### 5.1 Pattern 1: Standard RAG Retrieval (Stage 1 Only)

The most common pattern — fetch latest bars for LLM context. Only the composite index fires.

```sql
-- Fetch latest 16 bars with JSONB comments for LLM
SELECT
  timestamp, open, high, low, close, volume,
  tema_value, hrma_value, smma_value,
  atr_value, atr_percentile,
  trend_direction, volatility_regime, swing_momentum,
  reversal_probability,
  comments                    -- JSONB returned as data, not searched
FROM ohlcv_5m
WHERE symbol    = 'XAUUSD'   -- Stage 1 ↓
  AND timeframe = 'H4'       -- Stage 1 ↓
ORDER BY timestamp DESC       -- Stage 1 ↓ (DESC already in index)
LIMIT 16;

-- Index used:  idx_ohlcv_symbol_timeframe_time  ✅
-- GIN used:    No ❌ (JSONB not searched, only retrieved)
-- Speed:       5-15ms
```

### 5.2 Pattern 2: Time-Range RAG Retrieval (Stage 1 Only)

Fetch bars within a specific time window. Still Stage 1 only.

```sql
-- Fetch bars from last 4 hours
SELECT *, comments
FROM ohlcv_5m
WHERE symbol    = 'XAUUSD'                         -- Stage 1 ↓
  AND timeframe = 'H4'                             -- Stage 1 ↓
  AND timestamp >= NOW() - INTERVAL '4 hours'      -- Stage 1 ↓
ORDER BY timestamp DESC;

-- Index used:  idx_ohlcv_symbol_timeframe_time  ✅
-- GIN used:    No ❌
-- Speed:       8-20ms
```

### 5.3 Pattern 3: Conditional Content Search (Stage 1 + Stage 2)

Filter by specific indicator condition inside JSONB. Both indexes fire.

```sql
-- Find reversal signals on XAUUSD H4 in last 4 hours
SELECT timestamp, close, comments
FROM ohlcv_5m
WHERE symbol    = 'XAUUSD'                         -- Stage 1 ↓
  AND timeframe = 'H4'                             -- Stage 1 ↓
  AND timestamp >= NOW() - INTERVAL '4 hours'      -- Stage 1 ↓
  AND comments @> '{"reversal":
      {"comment_1": "Reversal probability: LIKELY — high-confluence reversal signal present"}}'
                                                   -- Stage 2 ↓ (GIN)
ORDER BY timestamp DESC;

-- Index used:  idx_ohlcv_symbol_timeframe_time  ✅
-- GIN used:    Yes ✅
-- Speed:       10-20ms
```

### 5.4 Pattern 4: Multi-Condition Content Search (Stage 1 + Stage 2)

Filter by multiple JSONB conditions simultaneously.

```sql
-- Find bars where momentum is Over-Bought AND reversal is LIKELY
SELECT timestamp, close, comments
FROM ohlcv_5m
WHERE symbol    = 'XAUUSD'                         -- Stage 1 ↓
  AND timeframe = 'H4'                             -- Stage 1 ↓
  AND timestamp >= NOW() - INTERVAL '24 hours'     -- Stage 1 ↓
  AND comments @> '{
    "momentum": {"comment_1": "Over-bought — exhaustion risk, watch for reversal signals"},
    "reversal": {"comment_1": "Reversal probability: LIKELY — high-confluence reversal signal present"}
  }'                                               -- Stage 2 ↓ (GIN, single @> operator)
ORDER BY timestamp DESC;

-- Index used:  Both ✅
-- Speed:       12-25ms
```

### 5.5 Pattern 5: Cross-Timeframe Comparison (Stage 1 × 2)

Two separate Stage 1 queries — one per timeframe. Runs in parallel.

```sql
-- Compare XAUUSD H4 vs H1 simultaneously
-- Query A:
SELECT *, comments FROM ohlcv_5m
WHERE symbol = 'XAUUSD' AND timeframe = 'H4'
ORDER BY timestamp DESC LIMIT 16;

-- Query B (parallel):
SELECT *, comments FROM ohlcv_5m
WHERE symbol = 'XAUUSD' AND timeframe = 'H1'
ORDER BY timestamp DESC LIMIT 16;

-- Each query uses Stage 1 independently
-- Run in parallel via Promise.all() in application layer
-- Combined speed: ~15ms (parallel, not sequential)
```

### 5.6 Pattern Summary Table

| User Query                               | Stage 1 | Stage 2 (GIN) | Approximate Speed |
| ---------------------------------------- | ------- | ------------- | ----------------- |
| "What is XAUUSD H4 doing now?"           | ✅      | ❌            | 5-15ms            |
| "Show me XAUUSD H4 last 4 hours"         | ✅      | ❌            | 8-20ms            |
| "Any reversals on XAUUSD H4 recently?"   | ✅      | ✅            | 10-20ms           |
| "Over-bought AND reversal LIKELY on H4?" | ✅      | ✅            | 12-25ms           |
| "Compare XAUUSD H4 vs H1"                | ✅ × 2  | ❌            | ~15ms (parallel)  |
| "What is RSI?" (conceptual)              | ❌      | ❌            | Vector DB only    |

---

## 6. Prisma Schema

### 6.1 Full Prisma Model with Indexes

```prisma
model OhlcvFiveMin {
  id               Int      @id @default(autoincrement())

  // ── IDENTIFIERS ──────────────────────────────────────────────
  symbol           String
  timeframe        String
  timestamp        DateTime

  // ── OHLCV (5 columns) ────────────────────────────────────────
  open             Float
  high             Float
  low              Float
  close            Float
  volume           BigInt

  // ── INDICATORS (12 columns) ──────────────────────────────────
  temaValue        Float?
  hrmaValue        Float?
  smmaValue        Float?
  atrValue         Float?
  atrPercentile    Int?
  adxValue         Float?
  rsiValue         Float?
  trendDirection   String?   // 'UP' | 'DOWN' | 'RANGING'
  volatilityRegime String?   // 'LOW' | 'MEDIUM' | 'HIGH'
  swingMomentum    String?   // 'Over-Bought' | 'Over-Sold' | 'Neutral'
  supportLevels    Json?
  resistanceLevels Json?
  reversalProb     String?   // 'Likely' | 'Possible' | '---'

  // ── JSONB COMMENTS (1 column — holds ALL indicator comments) ──
  // Auto-generated by PostgreSQL trigger at insert time.
  // Structure: { "tema": { "comment_1": "...", "comment_2": "..." }, ... }
  // Add more indicators or comments freely — no schema change needed.
  comments         Json      @default("{}")

  // ── CONSTRAINTS ──────────────────────────────────────────────
  @@unique([symbol, timeframe, timestamp])

  // ── INDEXES ──────────────────────────────────────────────────
  // INDEX 1: Composite + Time (Stage 1 — WHERE and WHEN)
  // Used by: Every query targeting a specific symbol-timeframe pair
  @@index([symbol, timeframe, timestamp(sort: Desc)])

  // Note: GIN index on comments cannot be declared in Prisma schema directly.
  // Must be created via raw SQL migration (see Section 6.2 below).

  @@map("ohlcv_5m")
}
```

**Total columns: 21**

```
3  identifiers  (symbol, timeframe, timestamp)
5  OHLCV        (open, high, low, close, volume)
12 indicators   (tema, hrma, smma, atr, atr_percentile, adx, rsi,
                 trend_direction, volatility_regime, swing_momentum,
                 support_levels, resistance_levels)
1  JSONB        (comments — contains ALL indicator descriptions)
─────────────────
21 total columns
```

### 6.2 GIN Index via Raw SQL Migration

Prisma does not natively support GIN index declaration in the schema file. Create it via a raw SQL migration:

```sql
-- Migration file: migrations/XXXXXXXX_add_gin_index/migration.sql

-- GIN Index (Stage 2 — WHAT happened inside JSONB)
-- Used by: Queries filtering by JSONB comment content
CREATE INDEX IF NOT EXISTS idx_ohlcv_comments
    ON ohlcv_5m USING GIN (comments);

-- Partial composite index for hot data (last 24 hours)
-- Ultra-fast retrieval for most recent queries
CREATE INDEX IF NOT EXISTS idx_ohlcv_recent
    ON ohlcv_5m (symbol, timeframe, timestamp DESC)
    WHERE timestamp >= NOW() - INTERVAL '24 hours';
```

Run with:

```bash
npx prisma migrate dev --name add_gin_and_partial_indexes
```

Or execute directly:

```bash
npx prisma db execute --file ./migrations/add_gin_index.sql
```

### 6.3 Verify Indexes Were Created

```sql
-- Check all indexes on ohlcv_5m
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'ohlcv_5m'
ORDER BY indexname;

-- Expected output:
-- idx_ohlcv_symbol_timeframe_time  | CREATE INDEX ... (symbol, timeframe, timestamp DESC)
-- idx_ohlcv_recent                 | CREATE INDEX ... WHERE timestamp >= NOW() - INTERVAL '24 hours'
-- idx_ohlcv_comments               | CREATE INDEX ... USING GIN (comments)
-- ohlcv_5m_symbol_timeframe_...   | CREATE UNIQUE INDEX ... (symbol, timeframe, timestamp)
```

---

## 7. Performance Expectations

### 7.1 Query Speed by Table Size

| Table Size          | Stage 1 Only | Stage 1 + Stage 2 |
| ------------------- | ------------ | ----------------- |
| 100K rows (1 week)  | ~2ms         | ~3ms              |
| 1M rows (1 month)   | ~5ms         | ~7ms              |
| 5M rows (4 months)  | ~8ms         | ~12ms             |
| 14M rows (1 year)   | ~12ms        | ~18ms             |
| 50M rows (3+ years) | ~18ms        | ~25ms             |

Indexes keep query time nearly flat regardless of table growth. Without indexes, query time grows linearly with table size (~2000ms+ at 14M rows).

### 7.2 Latency Budget Impact

```
Total response time budget: 2500ms

With indexes:
├── Stage 1 (Composite):     5-20ms     ← This document
├── Stage 2 (GIN, optional): 1-5ms      ← This document
├── Vector search:           50-150ms
├── Markdown load:           5-15ms
├── Context assembly:        10-20ms
├── LLM inference:           2000ms
└── JSONL logging:           5-10ms

Total: ~2100ms ✅ (within 2500ms budget)

Without indexes:
├── SQL query alone: 1000-3000ms ❌  (blows the entire budget)
```

### 7.3 Insert Performance Impact

Every INSERT must update both indexes. For a 5-min pipeline at 15 symbols × 9 timeframes:

```
Inserts per 5 min:  135 rows (15 × 9)
Inserts per day:    38,880 rows
Inserts per second: ~0.45 (extremely low)

Index update overhead per insert:
├── Composite index: ~0.1ms
├── GIN index:       ~0.5ms (slightly heavier — maps all JSON values)
└── Total overhead:  ~0.6ms per insert

Impact: Negligible. Pipeline easily handles this rate.
```

### 7.4 Storage Overhead

```
Table data (estimated per year):
├── OHLCV + Indicators:  ~1.1 GB
└── JSONB comments:      ~0.7 GB
    Subtotal:            ~1.8 GB per symbol

Index storage (per symbol per year):
├── Composite index:     ~150 MB
├── GIN index:           ~300 MB  (larger — maps JSON content)
└── Total index:         ~450 MB

Total per symbol per year: ~2.25 GB (data + indexes)
Total for 15 symbols:      ~33.75 GB per year
```

---

## 8. Maintenance Guidelines

### 8.1 ANALYZE — Keep Statistics Current

PostgreSQL's query planner uses table statistics to decide which index to use and in what order. Stale statistics can cause the planner to make suboptimal decisions (e.g., wrong index order, full table scan instead of index use).

```sql
-- Run manually when needed
ANALYZE ohlcv_5m;

-- Verify statistics are current
SELECT
  relname,
  last_analyze,
  last_autoanalyze,
  n_live_tup AS live_rows
FROM pg_stat_user_tables
WHERE relname = 'ohlcv_5m';
```

**When to run ANALYZE:**

- After bulk loading historical data
- After any migration or schema change
- If query performance suddenly degrades

PostgreSQL runs `autovacuum` (which includes auto-analyze) automatically. For your insert rate (~38K rows/day), auto-analyze triggers frequently enough. Manual `ANALYZE` is only needed after bulk operations.

### 8.2 REINDEX — Rebuild Bloated Indexes

Over time (months/years of inserts and updates), indexes can develop internal fragmentation (bloat), reducing their efficiency.

```sql
-- Check index bloat
SELECT
  indexrelname AS index_name,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE relname = 'ohlcv_5m'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Rebuild indexes without locking the table (PostgreSQL 12+)
REINDEX INDEX CONCURRENTLY idx_ohlcv_symbol_timeframe_time;
REINDEX INDEX CONCURRENTLY idx_ohlcv_comments;
```

**When to reindex:**

- Every 6-12 months as a routine maintenance step
- If `pg_relation_size(indexrelid)` grows disproportionately vs. table size
- After deleting or archiving large amounts of old data

### 8.3 EXPLAIN ANALYZE — Verify Index Usage

Use `EXPLAIN ANALYZE` to confirm PostgreSQL is using the correct indexes for your queries.

```sql
-- Verify Stage 1 only query
EXPLAIN ANALYZE
SELECT *, comments
FROM ohlcv_5m
WHERE symbol = 'XAUUSD'
  AND timeframe = 'H4'
ORDER BY timestamp DESC
LIMIT 16;

-- Expected output (look for these lines):
-- Index Scan using idx_ohlcv_symbol_timeframe_time on ohlcv_5m
-- Index Cond: ((symbol = 'XAUUSD') AND (timeframe = 'H4'))
-- Execution Time: X.XXX ms


-- Verify Stage 1 + Stage 2 query
EXPLAIN ANALYZE
SELECT timestamp, close, comments
FROM ohlcv_5m
WHERE symbol    = 'XAUUSD'
  AND timeframe = 'H4'
  AND timestamp >= NOW() - INTERVAL '4 hours'
  AND comments @> '{"reversal": {"comment_1": "Reversal probability: LIKELY — high-confluence reversal signal present"}}';

-- Expected output:
-- Bitmap Heap Scan on ohlcv_5m
--   Recheck Cond: (comments @> '...')
--   Filter: ((symbol = 'XAUUSD') AND (timeframe = 'H4') AND ...)
--   -> Bitmap Index Scan on idx_ohlcv_comments
-- Execution Time: X.XXX ms
```

**Warning signs in EXPLAIN output:**

- `Seq Scan` instead of `Index Scan` → index not being used (check column order, run ANALYZE)
- Very high `rows=` estimate → stale statistics (run ANALYZE)
- `cost=` unexpectedly high → consider REINDEX

### 8.4 Maintenance Schedule

| Task                 | Frequency                   | Command                          |
| -------------------- | --------------------------- | -------------------------------- |
| Auto-analyze         | Automatic (autovacuum)      | No action needed                 |
| Manual ANALYZE       | After bulk load / migration | `ANALYZE ohlcv_5m;`              |
| Check index sizes    | Monthly                     | `pg_stat_user_indexes` query     |
| REINDEX              | Every 6-12 months           | `REINDEX INDEX CONCURRENTLY ...` |
| EXPLAIN verification | After any schema change     | `EXPLAIN ANALYZE SELECT ...`     |

---

## 9. Quick Reference

### 9.1 Index Cheat Sheet

|                        | Composite + Time Index                                | GIN Index                    |
| ---------------------- | ----------------------------------------------------- | ---------------------------- |
| **What it finds**      | Which rows (by symbol/timeframe/time)                 | What's inside JSONB comments |
| **Query stage**        | Stage 1 — always                                      | Stage 2 — conditional        |
| **SQL operator**       | `=`, `>=`, `<=`, `ORDER BY`                           | `@>` (containment)           |
| **Activated by**       | `WHERE symbol = ... AND timeframe = ...`              | `WHERE comments @> '{...}'`  |
| **Primary use**        | Every RAG retrieval query                             | Condition-based searches     |
| **Prisma declaration** | `@@index([symbol, timeframe, timestamp(sort: Desc)])` | Raw SQL migration only       |

### 9.2 Operator Reference

```sql
-- Composite index operators
WHERE symbol = 'XAUUSD'                          -- exact match
WHERE timeframe = 'H4'                           -- exact match
WHERE timestamp >= NOW() - INTERVAL '4 hours'    -- range
ORDER BY timestamp DESC                           -- sort (free with DESC index)

-- GIN index operators
WHERE comments @> '{"key": "value"}'             -- containment (most common)
WHERE comments ? 'reversal'                      -- key exists
WHERE comments ?| ARRAY['reversal', 'momentum']  -- any key exists
WHERE comments ?& ARRAY['reversal', 'momentum']  -- all keys exist

-- Retrieve JSONB values (no index needed — just column access)
comments -> 'tema'                               -- get JSON object
comments -> 'tema' ->> 'comment_1'              -- get text value
comments #>> '{tema, comment_1}'                -- nested path access
```

### 9.3 Decision Tree: Which Index Fires?

```
User query arrives
      │
      ▼
Does query have symbol + timeframe?
      │
      ├── YES → Stage 1 fires (Composite index)
      │          │
      │          └── Does query also filter by comments @> {...}?
      │                    │
      │                    ├── YES → Stage 2 also fires (GIN index)
      │                    │         Both stages: ~10-25ms
      │                    │
      │                    └── NO  → Stage 1 only
      │                              JSONB returned as data column
      │                              Stage 1 only: ~5-20ms
      │
      └── NO  → SQL Engine not used
                Route to Vector DB (conceptual queries)
                or request clarification (missing symbol/timeframe)
```

### 9.4 Common Mistakes to Avoid

```sql
-- ❌ WRONG: Missing leading column — composite index not used
WHERE timestamp >= NOW() - INTERVAL '4 hours'
-- Fix: Always include symbol AND timeframe

-- ❌ WRONG: Using ->> for GIN containment search
WHERE comments ->> 'reversal' = 'some value'
-- Fix: Use @> operator for GIN
WHERE comments @> '{"reversal": {"comment_1": "..."}}'

-- ❌ WRONG: Casting JSONB — breaks GIN index
WHERE comments::text LIKE '%LIKELY%'
-- Fix: Use @> operator
WHERE comments @> '{"reversal": {"comment_1": "Reversal probability: LIKELY..."}}'

-- ✅ CORRECT: Full two-stage query
WHERE symbol    = 'XAUUSD'          -- Stage 1
  AND timeframe = 'H4'              -- Stage 1
  AND timestamp >= NOW() - INTERVAL '4 hours'  -- Stage 1
  AND comments @> '{"reversal": {"comment_1": "Reversal probability: LIKELY — high-confluence reversal signal present"}}'  -- Stage 2
```

---

## Conclusion

Your indexing strategy uses two indexes working in sequence:

**Stage 1 — Composite + Time Index**: Always fires. Narrows millions of rows to the exact symbol-timeframe-time window in 5-20ms. This is the foundation of every SQL query in the system.

**Stage 2 — GIN Index**: Fires conditionally. Once Stage 1 has narrowed to a small set of rows, GIN searches inside the JSONB comments column to find rows matching specific indicator conditions in ~1-5ms additional time.

Together they ensure:

- ✅ Standard RAG retrieval (latest N bars for LLM) → 5-20ms
- ✅ Condition-based searches (reversal signals, momentum extremes) → 10-25ms
- ✅ Performance stays flat as table grows to 50M+ rows
- ✅ Insert overhead is negligible (~0.6ms per row)

This two-index system is the query performance backbone of your entire Trading Alerts SaaS.

---

**Document Status**: Complete indexing reference for `ohlcv_5m` table

**Related Documents**:

- `RAG_ARCHITECTURE_STORAGE_AND_RETRIEVAL_STRATEGY_V3.2.md` — Full system architecture
- Prisma schema file (`schema.prisma`) — Model definition
- PostgreSQL migration files — GIN and partial index creation
