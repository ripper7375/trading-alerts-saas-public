# 61-Column Database Schema Update Guide

**Version:** 3.0.0
**Last Updated:** 2026-02-11
**Supersedes:** `60-column-schema-update-guide.md` (v2.0.0, 2026-02-10)
**Purpose:** Comprehensive guide for updating any part of the codebase to align with the 61-column database schema introduced in EA v2.27 / backfill worker v4

---

## 📋 TABLE OF CONTENTS

1. [What Changed in v3.0](#what-changed-in-v30)
2. [Overview](#overview)
3. [Critical Distinctions](#critical-distinctions)
4. [Schema Structure](#schema-structure)
5. [Compliance Factors](#compliance-factors)
6. [Common Pitfalls](#common-pitfalls)
7. [Update Checklist](#update-checklist)
8. [Layer-by-Layer Guide](#layer-by-layer-guide)
9. [Testing Requirements](#testing-requirements)
10. [Examples](#examples)
11. [Migration from 60-Column Schema](#migration-from-60-column-schema)

---

## 🆕 What Changed in v3.0

### Schema Changes (EA v2.27)

Two significant schema improvements were made by `SimpleDataCollector_v2_27_API_GATEWAY.mq5`:

| Change                  | Type          | Description                         | Benefit                                                      |
| ----------------------- | ------------- | ----------------------------------- | ------------------------------------------------------------ |
| **Symbol column added** | `TEXT`        | Added as column 2 (after timestamp) | Self-describing rows, enables efficient multi-symbol queries |
| **EMA renamed**         | Column rename | `ema_26` → `ema`                    | Consistency with tema/hrma/smma naming pattern               |

### Column Count Summary

| Category             | v2.0 (60-col) | v3.0 (61-col) | Delta  |
| -------------------- | ------------- | ------------- | ------ |
| System columns       | 8             | **9**         | **+1** |
| FREE tier indicators | 16            | 16            | —      |
| PRO tier indicators  | 36            | 36            | —      |
| **Total**            | **60**        | **61**        | **+1** |

### Symbol Column Details

The `symbol` column is now part of the database schema at position 2:

```sql
CREATE TABLE [xauusd] (
  timestamp INTEGER,
  symbol TEXT,        -- NEW! Position 2
  open REAL NOT NULL,
  high REAL NOT NULL,
  ...
)
```

**Value:** Sanitized symbol name (e.g., "xauusd", "eurusd", "btcusd")

**Benefits:**

1. **Self-Describing Rows:** Each row contains complete context (no need to reference table name)
2. **Multi-Symbol Queries:** Enables efficient queries across symbols in unified tables
3. **Better Indexing:** Composite indexes on (symbol, timeframe, timestamp) improve performance
4. **Future-Proof:** Easier to consolidate data from multiple symbols into single tables

### EMA Column Rename

**Old:** `ema_26` (period hardcoded in column name)
**New:** `ema` (consistent with other moving averages)

**Reasoning:**

- All moving averages (tema, hrma, smma) use period-agnostic names
- The period (26) is configurable in MQ5 via `InpEMA_Period`
- Column name should not imply a fixed period
- Makes schema consistent and future-proof

### Schema Migration

**Existing databases** (created by EA v2.26 or earlier) are automatically migrated on EA v2.27 startup:

```sql
-- Add symbol column if it doesn't exist
ALTER TABLE [symbol] ADD COLUMN symbol TEXT;

-- No migration needed for ema_26 → ema rename
-- (column is already named 'ema' in v2.27 CREATE TABLE)
```

**Backfill worker v4** (`backfill_worker_api_gateway_v4.py`) is backward compatible with v2.26 (60-col), v2.27+ (61-col), and even pre-v2.26 databases. It:

- Reads all available columns dynamically from SQLite
- Always adds `symbol` field when sending to API (line 285)
- Handles both `ema_26` and `ema` column names transparently

### Tier Classification

The `symbol` column is classified as a **system column** (not tier-restricted) because:

1. It's metadata about the row, not an indicator
2. It's required for data integrity and queries
3. It should be accessible to all tiers (FREE and PRO)

---

## 🎯 Overview

### What is the 61-Column Schema?

**NEW Schema (61-column flat structure):**

```typescript
{
  // System columns (9) — was 8 in v2.0
  timestamp: 1705324800,
  symbol: 'xauusd',          // ← NEW in v3.0
  open: 43265,
  high: 43300,
  low: 43200,
  close: 43280,
  volume: 1234.56,
  timeframe: 'M5',
  collected_at: '2025-01-16T12:00:00Z',

  // FREE tier indicators (16 columns) — unchanged
  diag_asc_line_1: 43250,
  diag_asc_line_2: 43240,
  diag_asc_line_3: 43230,
  diag_desc_line_1: 43270,
  diag_desc_line_2: 43280,
  diag_desc_line_3: 43290,
  diag_high_map: null,
  diag_low_map: null,
  horiz_peak_line_1: 43300,
  horiz_peak_line_2: 43295,
  horiz_peak_line_3: 43290,
  horiz_bottom_line_1: 43200,
  horiz_bottom_line_2: 43205,
  horiz_bottom_line_3: 43210,
  horiz_high_map: null,
  horiz_low_map: null,

  // PRO tier indicators (36 columns) — unchanged count
  tema: 43260,
  hrma: 43255,
  smma: 43258,
  ema: 43257,               // ← RENAMED from ema_26 in v3.0
  body_size: 0.75,
  body_direction: 1,
  ha_open: 43262,
  ha_high: 43300,
  ha_low: 43200,
  ha_close: 43278,
  ha_color: 1,
  ha_trend: 1,
  ha_strength: 0.85,
  kc_upper: 43350,
  kc_middle: 43265,
  kc_lower: 43180,
  kc_upper_ema: 43340,
  kc_middle_ema: 43265,
  kc_lower_ema: 43190,
  kc_squeeze: 0,
  kc_squeeze_pro: 0,
  kc_width: 170,
  kc_width_ema: 165,
  sr_1: 43300,
  sr_2: 43250,
  sr_3: 43200,
  sr_4: null,
  sr_5: null,
  sr_6: null,
  sr_7: null,
  sr_8: null,
  zigzag_high: 43300,
  zigzag_low: 43200,
  zigzag_trend: 1,
  dual_tema_high: 43285,
  dual_tema_low: 43245,
  pinbar: 0,
}
```

### Migration Summary

- **From:** 60-column flat structure (8 system + 16 FREE + 36 PRO)
- **To:** 61-column flat structure (9 system + 16 FREE + 36 PRO)
- **Tier Access:**
  - FREE tier: **25 columns** (9 system + 16 FREE indicators) — was 24
  - PRO tier: **61 columns** (9 system + 16 FREE + 36 PRO indicators) — was 60

---

## 🔑 Critical Distinctions

### **CRITICAL:** Three Separate Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: DATABASE SCHEMA (PostgreSQL)                      │
├─────────────────────────────────────────────────────────────┤
│ • 61 columns with NEW names                                 │
│ • timestamp, symbol (NEW!), open, high, low, close...      │
│ • diag_asc_line_1, diag_desc_line_1                        │
│ • horiz_peak_line_1, horiz_bottom_line_1                   │
│ • tema, hrma, smma, ema (RENAMED from ema_26)              │
│ • body_size, body_direction                                 │
│ • ha_open … ha_strength                                     │
│ • dual_tema_high, dual_tema_low, pinbar                    │
│                                                             │
│ Location: PostgreSQL database tables                       │
│ Files: prisma/schema.prisma                                │
└─────────────────────────────────────────────────────────────┘
                          ↓
                  (Data fetched from DB)
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: DATA FETCHING LAYER (Backend API Routes)          │
├─────────────────────────────────────────────────────────────┤
│ • Reads 61-column data from PostgreSQL                     │
│ • Applies tier-based filtering                             │
│ • Returns actual indicator data values                     │
│                                                             │
│ Location: app/api/indicators/[symbol]/[timeframe]/route.ts │
│ Purpose: Fetch and return actual indicator data            │
│                                                             │
│ Example Response (PRO tier):                                │
│ {                                                           │
│   "data": {                                                 │
│     "timestamp": 1705324800,                                │
│     "symbol": "xauusd",        // NEW in v3.0              │
│     "diag_asc_line_1": 43250,  // Uses NEW 61-col names    │
│     "tema": 43260,                                          │
│     "ema": 43257,              // RENAMED from ema_26      │
│     "dual_tema_high": 43285,                                │
│     "dual_tema_low": 43245,                                 │
│     "pinbar": 0,                                            │
│     ...all 61 columns                                       │
│   }                                                         │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
                  (Metadata describes structure)
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: API METADATA LAYER (Consumer-Facing Contracts)    │
├─────────────────────────────────────────────────────────────┤
│ • Describes what data structure consumers should expect    │
│ • MUST match existing consumer expectations                │
│ • Uses OLD field names for backward compatibility          │
│ • Uses UPPERCASE IDs for API/test compatibility            │
│                                                             │
│ Location: app/api/indicators/route.ts                      │
│ Purpose: Describe available indicators and their fields    │
│                                                             │
│ New columns (symbol, ema rename) affect all tiers          │
└─────────────────────────────────────────────────────────────┘
```

### Key Insight

**Database layer uses NEW 61-column schema names.**
**Symbol column is system-level (available to all tiers).**
**EMA column renamed from ema_26 to ema (period-agnostic naming).**
**Metadata layer may need updates for symbol column (system-level field).**

---

## 📊 Schema Structure

### 9 System Columns (Always included, all tiers) — was 8

```typescript
{
  timestamp: number; // Unix timestamp (seconds)
  symbol: string; // ← NEW: Trading symbol (e.g., 'xauusd', 'eurusd')
  open: number; // OHLC data
  high: number;
  low: number;
  close: number;
  volume: number; // Trading volume
  timeframe: string; // 'M1', 'M5', 'M15', 'H1', 'H4', 'D1'
  collected_at: string; // ISO 8601 timestamp
}
```

### FREE Tier Indicators (16 columns) — Unchanged

**Group 1: Fractal Diagonal Lines (8 columns)**

```typescript
{
  diag_asc_line_1: number | null; // Ascending trendline 1
  diag_asc_line_2: number | null; // Ascending trendline 2
  diag_asc_line_3: number | null; // Ascending trendline 3
  diag_desc_line_1: number | null; // Descending trendline 1
  diag_desc_line_2: number | null; // Descending trendline 2
  diag_desc_line_3: number | null; // Descending trendline 3
  diag_high_map: number | null; // High fractal mapping data
  diag_low_map: number | null; // Low fractal mapping data
}
```

**Group 2: Fractal Horizontal Lines (8 columns)**

```typescript
{
  horiz_peak_line_1: number | null; // Peak resistance line 1
  horiz_peak_line_2: number | null; // Peak resistance line 2
  horiz_peak_line_3: number | null; // Peak resistance line 3
  horiz_bottom_line_1: number | null; // Bottom support line 1
  horiz_bottom_line_2: number | null; // Bottom support line 2
  horiz_bottom_line_3: number | null; // Bottom support line 3
  horiz_high_map: number | null; // High fractal mapping data
  horiz_low_map: number | null; // Low fractal mapping data
}
```

### PRO Tier Indicators (36 columns) — Same count, 1 renamed

**Group 3: Moving Averages (4 columns) — ema renamed**

```typescript
{
  tema: number | null; // Triple Exponential Moving Average
  hrma: number | null; // Hull Moving Average
  smma: number | null; // Smoothed Moving Average
  ema: number | null; // ← RENAMED from ema_26 (Exponential Moving Average)
}
```

> **Note:** The `ema` column was previously named `ema_26` in v2.0. The period (26) is configurable in the EA via `InpEMA_Period` and should not be hardcoded in the column name.

**Groups 4-10:** (Unchanged from v2.0 — see section on PRO tier for details)

- Group 4: Body Size Momentum (2 columns)
- Group 5: Heiken Ashi (7 columns)
- Group 6: Keltner Channels (10 columns)
- Group 7: Support/Resistance (8 columns)
- Group 8: ZigZag (3 columns)
- Group 9: Dual TEMA High/Low (2 columns)
- Group 10: Pinbar Detection (1 column)

---

## ✅ Compliance Factors

### 1. Indicator ID Naming Conventions

**CRITICAL:** Different layers use different ID formats!

| Layer            | ID Format            | Example                           | Location                    |
| ---------------- | -------------------- | --------------------------------- | --------------------------- |
| TypeScript Types | lowercase_snake_case | `dual_tema_hl`                    | lib/tier/constants.ts       |
| API Metadata     | UPPERCASE_SNAKE_CASE | `FRACTAL_HORIZONTAL`              | app/api/indicators/route.ts |
| Database Columns | lowercase_snake_case | `dual_tema_high`, `symbol`, `ema` | PostgreSQL schema           |

### 2. Column Name Changes

**CRITICAL:** Handle renamed column for backward compatibility!

| Old Column Name (v2.0) | New Column Name (v3.0) | Type   | Notes                                       |
| ---------------------- | ---------------------- | ------ | ------------------------------------------- |
| (not present)          | `symbol`               | `TEXT` | NEW system column at position 2             |
| `ema_26`               | `ema`                  | `REAL` | Renamed for consistency with tema/hrma/smma |

### 3. Tier Access Rules

**FREE Tier:** **25 total columns** (was 24)

- 9 system columns (was 8) ← **symbol added**
- 16 FREE indicator columns

**PRO Tier:** **61 total columns** (was 60)

- 9 system columns (was 8) ← **symbol added**
- 16 FREE indicator columns
- 36 PRO indicator columns

**Implementation:**

```typescript
// Filter columns based on tier
const allowedColumns =
  tier === 'PRO' ? ALL_61_COLUMNS : SYSTEM_COLUMNS + FREE_TIER_COLUMNS; // 25 columns (was 24)

// Constants update required:
// Was: ALL_60_COLUMNS_SELECT
// Now: ALL_61_COLUMNS_SELECT (add symbol at position 2, rename ema_26 to ema)
```

### 4. Backward Compatibility

**CRITICAL:** Maintain legacy exports!

```typescript
// ✅ REQUIRED: Legacy alias
export const BASIC_INDICATORS = FREE_TIER_INDICATORS;

// ✅ REQUIRED: Type alias (NOT separate interface)
export type IndicatorMeta = IndicatorMetadata;

// ✅ REQUIRED: All existing columns remain — only 1 column added, 1 renamed
// Symbol column added (system-level, all tiers)
// ema_26 renamed to ema (PRO tier)
```

### 5. Data Pattern Specifications

**Unchanged from v2.0** — no new indicators in v3.0, only schema improvements.

---

## ⚠️ Common Pitfalls

### Pitfall 1: Forgetting to Add Symbol Column

**❌ WRONG:**

```typescript
const SYSTEM_COLUMNS_SELECT = {
  timestamp: true,
  open: true,
  high: true,
  // ❌ Missing symbol!
};
```

**✅ CORRECT:**

```typescript
const SYSTEM_COLUMNS_SELECT = {
  timestamp: true,
  symbol: true, // ✅ NEW in v3.0
  open: true,
  high: true,
  low: true,
  close: true,
  volume: true,
  timeframe: true,
  collected_at: true,
};
```

### Pitfall 2: Using Old Column Name (ema_26)

**❌ WRONG:**

```typescript
const ALL_61_COLUMNS_SELECT = {
  ...otherColumns,
  ema_26: true, // ❌ OLD column name!
};
```

**✅ CORRECT:**

```typescript
const ALL_61_COLUMNS_SELECT = {
  ...otherColumns,
  ema: true, // ✅ RENAMED in v3.0
};
```

### Pitfall 3: Wrong System Column Count

**❌ WRONG:**

```typescript
// System columns count
expect(SYSTEM_COLUMNS).toHaveLength(8); // ❌ Old count
```

**✅ CORRECT:**

```typescript
// System columns count
expect(SYSTEM_COLUMNS).toHaveLength(9); // ✅ Includes symbol
```

### Pitfall 4: Not Handling Symbol in Queries

**❌ WRONG:**

```sql
-- Missing symbol in WHERE clause for multi-symbol tables
SELECT * FROM market_data
WHERE timeframe = 'M5'
  AND timestamp = 1705324800;
-- ❌ Could return data for wrong symbol!
```

**✅ CORRECT:**

```sql
-- Include symbol in WHERE clause
SELECT * FROM market_data
WHERE symbol = 'xauusd'
  AND timeframe = 'M5'
  AND timestamp = 1705324800;
-- ✅ Ensures correct symbol data
```

### Pitfall 5: Missing Symbol in Mock Data

**❌ WRONG:**

```typescript
const mockData = {
  timestamp: 1705324800,
  open: 43265,
  // ❌ Missing symbol field!
};
```

**✅ CORRECT:**

```typescript
const mockData = {
  timestamp: 1705324800,
  symbol: 'xauusd', // ✅ Include symbol
  open: 43265,
  // ... rest of fields
};
```

---

## 📝 Update Checklist

Use this checklist when updating any part to align with the 61-column schema:

### Phase 0: Verify New Schema in Database

- [ ] Confirm `symbol` column exists in PostgreSQL at position 2
- [ ] Confirm `ema` column exists (not `ema_26`)
- [ ] Run `SELECT symbol, ema FROM market_data LIMIT 1;` — no error
- [ ] Verify SQLite databases were migrated (run `PRAGMA table_info(symbol)`)
- [ ] Confirm EA v2.27 is deployed
- [ ] Confirm backfill worker v4 is deployed

### Phase 1: Type Definitions

- [ ] Update `MarketDataRecord` interface to add `symbol` field (position 2)
- [ ] Rename `ema_26` to `ema` in type definitions
- [ ] Update system column count from 8 to 9
- [ ] Update total column count from 60 to 61
- [ ] Update FREE tier count from 24 to 25
- [ ] Update PRO tier count from 60 to 61
- [ ] Add JSDoc comment for `symbol` field

### Phase 2: Constants & Configuration

- [ ] Add `symbol: true` to `SYSTEM_COLUMNS_SELECT`
- [ ] Rename `ema_26` to `ema` in `ALL_61_COLUMNS_SELECT`
- [ ] Update `ALL_60_COLUMNS_SELECT` → `ALL_61_COLUMNS_SELECT`
- [ ] Verify system column count = 9 (was 8)
- [ ] Synchronize `lib/tier/constants.ts` → `frontend/lib/tier/constants.ts`
- [ ] Maintain `BASIC_INDICATORS` legacy alias
- [ ] Maintain `IndicatorMeta` type alias

### Phase 3: Database Schema (Prisma)

- [ ] Add `symbol String` to `MarketData` model (after id, before timestamp)
- [ ] Rename `ema_26` to `ema` in `MarketData` model (if present)
- [ ] Add `@@index([symbol, timeframe, timestamp])` for efficient queries
- [ ] Run `npx prisma generate`
- [ ] Run migration: `npx prisma migrate dev --name add_symbol_rename_ema`

### Phase 4: API Routes

- [ ] **Metadata Endpoint** (`app/api/indicators/route.ts`):
  - [ ] Add `symbol` to system fields description (if documented)
  - [ ] Update column count references from 60 to 61
- [ ] **Data Fetching Endpoint** (`app/api/indicators/[symbol]/[timeframe]/route.ts`):
  - [ ] Update JSDoc to reflect 61-column schema
  - [ ] Update `ALL_60_COLUMNS_SELECT` → `ALL_61_COLUMNS_SELECT`
  - [ ] Add `symbol` field to select
  - [ ] Rename `ema_26` to `ema` in select
  - [ ] Verify PRO tier returns all 61 columns
  - [ ] Verify FREE tier returns 25 columns (was 24)

### Phase 5: Tests

- [ ] Update total column count assertions: `60` → `61`
- [ ] Update system column count: `8` → `9`
- [ ] Update FREE tier count: `24` → `25`
- [ ] Update PRO tier count: `60` → `61`
- [ ] Add tests for `symbol` field presence in all responses
- [ ] Update tests referencing `ema_26` to use `ema`
- [ ] Add test: `symbol` field matches query parameter
- [ ] Update mock data to include `symbol` field
- [ ] Update mock data to use `ema` instead of `ema_26`

### Phase 6: Documentation

- [ ] Update API documentation to mention `symbol` column
- [ ] Document `ema_26` → `ema` rename
- [ ] Note EA version requirement: v2.27+ for new schema
- [ ] Note backfill worker version requirement: v4+ for new schema awareness
- [ ] Document migration path from v2.26 to v2.27

### Phase 7: Validation

- [ ] Run TypeScript type checking: `npm run validate:types`
- [ ] Run ESLint: `npm run validate:lint`
- [ ] Run tests: `npm test`
- [ ] Verify no compilation errors
- [ ] Verify all tests pass
- [ ] Test queries with symbol column
- [ ] Verify ema values (not ema_26)

---

## 🔧 Layer-by-Layer Guide

### Layer 1: Database Schema (Prisma)

**Location:** `prisma/schema.prisma`

**What to update:**

```prisma
model MarketData {
  id           String   @id @default(cuid())

  // ↓ NEW: Add symbol after id, before other system columns
  symbol       String   // Trading symbol (xauusd, eurusd, etc.)

  // System columns (9) — was 8
  timestamp    Int      // Unix timestamp (seconds)
  open         Float
  high         Float
  low          Float
  close        Float
  volume       Float
  timeframe    String   // M1, M5, M15, H1, H4, D1
  collected_at DateTime @default(now())

  // FREE tier indicators (16 columns) — unchanged
  diag_asc_line_1      Float?
  diag_asc_line_2      Float?
  diag_asc_line_3      Float?
  diag_desc_line_1     Float?
  diag_desc_line_2     Float?
  diag_desc_line_3     Float?
  diag_high_map        Float?
  diag_low_map         Float?
  horiz_peak_line_1    Float?
  horiz_peak_line_2    Float?
  horiz_peak_line_3    Float?
  horiz_bottom_line_1  Float?
  horiz_bottom_line_2  Float?
  horiz_bottom_line_3  Float?
  horiz_high_map       Float?
  horiz_low_map        Float?

  // PRO tier indicators — existing (36 columns)
  tema             Float?
  hrma             Float?
  smma             Float?
  ema              Float?  // ← RENAMED from ema_26 in v3.0
  body_size        Float?
  body_direction   Float?
  ha_open          Float?
  ha_high          Float?
  ha_low           Float?
  ha_close         Float?
  ha_color         Float?
  ha_trend         Float?
  ha_strength      Float?
  kc_upper         Float?
  kc_middle        Float?
  kc_lower         Float?
  kc_upper_ema     Float?
  kc_middle_ema    Float?
  kc_lower_ema     Float?
  kc_squeeze       Float?
  kc_squeeze_pro   Float?
  kc_width         Float?
  kc_width_ema     Float?
  sr_1             Float?
  sr_2             Float?
  sr_3             Float?
  sr_4             Float?
  sr_5             Float?
  sr_6             Float?
  sr_7             Float?
  sr_8             Float?
  zigzag_high      Float?
  zigzag_low       Float?
  zigzag_trend     Float?
  dual_tema_high   Float?  // NEW in v2.0
  dual_tema_low    Float?  // NEW in v2.0
  pinbar           Int?    // NEW in v2.0

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@unique([symbol, timeframe, timestamp])
  @@index([symbol, timeframe, timestamp])
  @@index([symbol])
  @@index([timeframe])
  @@index([timestamp])
}
```

**After update:**

```bash
npx prisma generate
npx prisma migrate dev --name add_symbol_column_rename_ema
```

### Layer 2: TypeScript Type Definitions

**Location:** `lib/tier/types.ts` or similar

**What to update:**

```typescript
/**
 * 61-Column Database Schema for Market Data
 * Updated: v3.0 — adds symbol column, renames ema_26 to ema (EA v2.27)
 *
 * Structure:
 * - 9 system columns (OHLCV + metadata + symbol) ← was 8
 * - 16 FREE tier indicator columns
 * - 36 PRO tier indicator columns
 */
export interface MarketDataRecord {
  // System columns (9) — was 8 in v2.0
  timestamp: number;
  /** Trading symbol (e.g., 'xauusd', 'eurusd'). NEW in v3.0. */
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timeframe: string;
  collected_at: string;

  // FREE tier indicators (16 columns) — unchanged
  diag_asc_line_1: number | null;
  diag_asc_line_2: number | null;
  diag_asc_line_3: number | null;
  diag_desc_line_1: number | null;
  diag_desc_line_2: number | null;
  diag_desc_line_3: number | null;
  diag_high_map: number | null;
  diag_low_map: number | null;
  horiz_peak_line_1: number | null;
  horiz_peak_line_2: number | null;
  horiz_peak_line_3: number | null;
  horiz_bottom_line_1: number | null;
  horiz_bottom_line_2: number | null;
  horiz_bottom_line_3: number | null;
  horiz_high_map: number | null;
  horiz_low_map: number | null;

  // PRO tier indicators — existing (36 columns)
  tema: number | null;
  hrma: number | null;
  smma: number | null;
  /** Exponential Moving Average. RENAMED from ema_26 in v3.0 for consistency. */
  ema: number | null;
  body_size: number | null;
  body_direction: number | null;
  ha_open: number | null;
  ha_high: number | null;
  ha_low: number | null;
  ha_close: number | null;
  ha_color: number | null;
  ha_trend: number | null;
  ha_strength: number | null;
  kc_upper: number | null;
  kc_middle: number | null;
  kc_lower: number | null;
  kc_upper_ema: number | null;
  kc_middle_ema: number | null;
  kc_lower_ema: number | null;
  kc_squeeze: number | null;
  kc_squeeze_pro: number | null;
  kc_width: number | null;
  kc_width_ema: number | null;
  sr_1: number | null;
  sr_2: number | null;
  sr_3: number | null;
  sr_4: number | null;
  sr_5: number | null;
  sr_6: number | null;
  sr_7: number | null;
  sr_8: number | null;
  zigzag_high: number | null;
  zigzag_low: number | null;
  zigzag_trend: number | null;
  dual_tema_high: number | null;
  dual_tema_low: number | null;
  pinbar: 0 | 1 | null;
}
```

### Layer 3: Constants & Metadata

**Location:** `lib/tier/constants.ts`

**What to update:**

```typescript
// Updated select objects for Prisma queries
export const ALL_61_COLUMNS_SELECT = {
  // System columns (9)
  timestamp: true,
  symbol: true, // ← NEW in v3.0
  open: true,
  high: true,
  low: true,
  close: true,
  volume: true,
  timeframe: true,
  collected_at: true,

  // FREE tier indicators (16 columns)
  diag_asc_line_1: true,
  diag_asc_line_2: true,
  diag_asc_line_3: true,
  diag_desc_line_1: true,
  diag_desc_line_2: true,
  diag_desc_line_3: true,
  diag_high_map: true,
  diag_low_map: true,
  horiz_peak_line_1: true,
  horiz_peak_line_2: true,
  horiz_peak_line_3: true,
  horiz_bottom_line_1: true,
  horiz_bottom_line_2: true,
  horiz_bottom_line_3: true,
  horiz_high_map: true,
  horiz_low_map: true,

  // PRO tier indicators (36 columns)
  tema: true,
  hrma: true,
  smma: true,
  ema: true, // ← RENAMED from ema_26 in v3.0
  body_size: true,
  body_direction: true,
  ha_open: true,
  ha_high: true,
  ha_low: true,
  ha_close: true,
  ha_color: true,
  ha_trend: true,
  ha_strength: true,
  kc_upper: true,
  kc_middle: true,
  kc_lower: true,
  kc_upper_ema: true,
  kc_middle_ema: true,
  kc_lower_ema: true,
  kc_squeeze: true,
  kc_squeeze_pro: true,
  kc_width: true,
  kc_width_ema: true,
  sr_1: true,
  sr_2: true,
  sr_3: true,
  sr_4: true,
  sr_5: true,
  sr_6: true,
  sr_7: true,
  sr_8: true,
  zigzag_high: true,
  zigzag_low: true,
  zigzag_trend: true,
  dual_tema_high: true,
  dual_tema_low: true,
  pinbar: true,
};

export const SYSTEM_COLUMNS_SELECT = {
  timestamp: true,
  symbol: true, // ← NEW in v3.0
  open: true,
  high: true,
  low: true,
  close: true,
  volume: true,
  timeframe: true,
  collected_at: true,
};

export const FREE_TIER_SELECT = {
  ...SYSTEM_COLUMNS_SELECT, // 9 columns (was 8)
  // FREE tier indicators (16 columns)
  diag_asc_line_1: true,
  diag_asc_line_2: true,
  diag_asc_line_3: true,
  diag_desc_line_1: true,
  diag_desc_line_2: true,
  diag_desc_line_3: true,
  diag_high_map: true,
  diag_low_map: true,
  horiz_peak_line_1: true,
  horiz_peak_line_2: true,
  horiz_peak_line_3: true,
  horiz_bottom_line_1: true,
  horiz_bottom_line_2: true,
  horiz_bottom_line_3: true,
  horiz_high_map: true,
  horiz_low_map: true,
};
// Total: 25 columns (was 24)
```

---

## 🧪 Testing Requirements

### Test Categories to Update

1. **Type Tests**
   - Verify 61 columns defined (was 60)
   - Verify `symbol` field present in `MarketDataRecord`
   - Verify `ema` field present (not `ema_26`)
   - Verify `symbol` typed as `string` (required)

2. **Constants Tests**
   - Verify system columns count = **9** (was 8)
   - Verify FREE tier count = **25** (was 24)
   - Verify PRO tier count = **61** (was 60)
   - Verify `ALL_61_COLUMNS_SELECT` has 61 fields (was 60)
   - Verify `symbol` field in `SYSTEM_COLUMNS_SELECT`
   - Verify `ema` field in `ALL_61_COLUMNS_SELECT` (not `ema_26`)

3. **API Tests**
   - Verify all responses include `symbol` field
   - Verify `symbol` matches query parameter
   - Verify FREE tier returns 25 columns (was 24)
   - Verify PRO tier returns 61 columns (was 60)
   - Verify responses use `ema` field (not `ema_26`)

4. **Data Integrity Tests**
   - Verify `symbol` field is never null or empty
   - Verify `symbol` values are lowercase (e.g., "xauusd" not "XAUUSD")
   - Verify `ema` values are valid numbers (same as old `ema_26`)

---

## 📚 Examples

### Example 1: Complete Type Definition Update

```typescript
// BEFORE (v2.0 — 60 columns):
export interface MarketDataRecord {
  // System (8)
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timeframe: string;
  collected_at: string;

  // ... indicators ...

  ema_26: number | null;
  zigzag_high: number | null;
  zigzag_low: number | null;
  zigzag_trend: number | null;
  dual_tema_high: number | null;
  dual_tema_low: number | null;
  pinbar: 0 | 1 | null;
}

// AFTER (v3.0 — 61 columns):
export interface MarketDataRecord {
  // System (9)
  timestamp: number;
  symbol: string; // ← NEW
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timeframe: string;
  collected_at: string;

  // ... indicators ...

  ema: number | null; // ← RENAMED from ema_26
  zigzag_high: number | null;
  zigzag_low: number | null;
  zigzag_trend: number | null;
  dual_tema_high: number | null;
  dual_tema_low: number | null;
  pinbar: 0 | 1 | null;
}
```

### Example 2: Test Update for Column Count

```typescript
// BEFORE (v2.0):
it('should have correct column counts', () => {
  expect(SYSTEM_COLUMNS).toHaveLength(8);
  expect(FREE_TIER_COLUMNS).toHaveLength(24);
  expect(PRO_TIER_COLUMNS).toHaveLength(60);
});

it('should use ema_26 field name', () => {
  expect(response.data).toHaveProperty('ema_26');
});

// AFTER (v3.0):
it('should have correct column counts', () => {
  expect(SYSTEM_COLUMNS).toHaveLength(9); // ← +1
  expect(FREE_TIER_COLUMNS).toHaveLength(25); // ← +1
  expect(PRO_TIER_COLUMNS).toHaveLength(61); // ← +1
});

it('should include symbol field', () => {
  expect(response.data).toHaveProperty('symbol');
  expect(response.data.symbol).toBe('xauusd');
});

it('should use ema field name (not ema_26)', () => {
  expect(response.data).toHaveProperty('ema');
  expect(response.data).not.toHaveProperty('ema_26');
});
```

### Example 3: Mock Data Update

```typescript
// Add symbol field and rename ema_26 to ema:
const mockMarketDataPRO: MarketDataRecord = {
  // System (9)
  timestamp: 1705324800,
  symbol: 'xauusd', // ← NEW
  open: 43265,
  high: 43300,
  low: 43200,
  close: 43280,
  volume: 1234.56,
  timeframe: 'M5',
  collected_at: '2025-01-16T12:00:00Z',

  // ... FREE tier indicators ...

  // PRO tier
  tema: 43260,
  hrma: 43255,
  smma: 43258,
  ema: 43257, // ← RENAMED from ema_26
  // ... rest of PRO indicators ...
  dual_tema_high: 43285,
  dual_tema_low: 43245,
  pinbar: 0,
};
```

---

## 🔄 Migration from 60-Column Schema

### What Requires Changes

| Component                              | Change Required | Notes                                         |
| -------------------------------------- | --------------- | --------------------------------------------- |
| `prisma/schema.prisma`                 | ✅ Yes          | Add `symbol` field, rename `ema_26` to `ema`  |
| `lib/tier/types.ts`                    | ✅ Yes          | Add `symbol`, rename `ema_26` to `ema`        |
| `lib/tier/constants.ts`                | ✅ Yes          | Add `symbol` to selects, rename `ema_26`      |
| `frontend/lib/tier/constants.ts`       | ✅ Yes          | Sync with backend                             |
| `app/api/indicators/route.ts`          | ⚠️ Maybe        | Update if column counts referenced            |
| `app/api/indicators/[s]/[tf]/route.ts` | ✅ Yes          | Update select to `ALL_61_COLUMNS_SELECT`      |
| Test files                             | ✅ Yes          | Update counts, add `symbol`, rename `ema_26`  |
| EA (.mq5 file)                         | ✅ Done         | v2.27 already implemented                     |
| backfill_worker.py                     | ✅ Done         | v4 already implemented                        |
| SQLite databases                       | ✅ Auto         | EA v2.27 adds `symbol` column on startup      |
| Existing PostgreSQL rows               | ⚠️ Migration    | Need to populate `symbol` from table metadata |

### What Does NOT Change

- FREE tier indicator columns (16 columns) — unchanged
- PRO tier indicator count (36 columns) — same count, 1 renamed
- `BASIC_INDICATORS` legacy alias — still works
- `IndicatorMeta` type alias — still works
- Indicator groups 1-10 — no structural changes

### Deployment Order

1. **Database migration** — add `symbol` column, handle `ema_26` → `ema`
2. **Backend deploy** — update types, constants, API routes
3. **Frontend deploy** — update types, constants, UI
4. **EA upgrade** — deploy v2.27 (starts populating `symbol`, uses `ema`)
5. **Backfill worker upgrade** — deploy v4 (handles both old/new schemas)

---

## ✅ Summary

### Key Takeaways

1. **61 Columns Total:** 9 system + 16 FREE + 36 PRO (was 8 + 16 + 36)
2. **Symbol Column Added:** Self-describing rows, better query performance
3. **EMA Renamed:** `ema_26` → `ema` for consistency with other MAs
4. **Three Layers:** Database (NEW names) → Data Fetching (NEW names) → Metadata
5. **Backward Compatible:** EA v2.27 / backfill worker v4 handle both schemas
6. **FREE Tier:** 25 columns (was 24) — symbol added to system columns

### Quick Reference

| Aspect            | FREE Tier    | PRO Tier     |
| ----------------- | ------------ | ------------ |
| Total Columns     | **25** (↑24) | **61** (↑60) |
| System Columns    | **9** (↑8)   | **9** (↑8)   |
| Indicator Columns | 16           | 52           |
| Symbol Column     | ✅ Yes       | ✅ Yes       |
| EMA Column        | N/A (PRO)    | ✅ `ema`     |

### Schema Changes at a Glance

| Change           | Type       | Position    | Impact                             |
| ---------------- | ---------- | ----------- | ---------------------------------- |
| **symbol added** | NEW column | Column 2    | All tiers (+1 system column)       |
| **ema_26 → ema** | Renamed    | PRO section | PRO tier only (naming consistency) |

---

**Document Version:** 3.0.0
**Last Updated:** 2026-02-11
**Replaces:** `60-column-schema-update-guide.md` v2.0.0
**Next Review:** After completing all part updates for 61-column schema
