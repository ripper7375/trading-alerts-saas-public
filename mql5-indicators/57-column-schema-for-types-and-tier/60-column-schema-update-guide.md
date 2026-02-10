# 60-Column Database Schema Update Guide

**Version:** 2.0.0
**Last Updated:** 2026-02-10
**Supersedes:** `57-column-schema-update-guide.md` (v1.0.0, 2025-01-16)
**Purpose:** Comprehensive guide for updating any part of the codebase to align with the 60-column database schema introduced in EA v2.26 / backfill worker v3

---

## 📋 TABLE OF CONTENTS

1. [What Changed in v2.0](#what-changed-in-v20)
2. [Overview](#overview)
3. [Critical Distinctions](#critical-distinctions)
4. [Schema Structure](#schema-structure)
5. [Compliance Factors](#compliance-factors)
6. [Common Pitfalls](#common-pitfalls)
7. [Update Checklist](#update-checklist)
8. [Layer-by-Layer Guide](#layer-by-layer-guide)
9. [Testing Requirements](#testing-requirements)
10. [Examples](#examples)
11. [Migration from 57-Column Schema](#migration-from-57-column-schema)

---

## 🆕 What Changed in v2.0

### New Columns Added (EA v2.26)

Three new PRO-tier columns were added by `SimpleDataCollector_v2_26_API_GATEWAY.mq5`:

| Column           | Type      | Source Indicator                       | Buffer | Description                                   |
| ---------------- | --------- | -------------------------------------- | ------ | --------------------------------------------- |
| `dual_tema_high` | `REAL`    | `Dual_TEMA_High_Low.mq5`               | 0      | TEMA of bar highs (Triple EMA of High prices) |
| `dual_tema_low`  | `REAL`    | `Dual_TEMA_High_Low.mq5`               | 1      | TEMA of bar lows (Triple EMA of Low prices)   |
| `pinbar`         | `INTEGER` | `Pinbar Detector_Diamond Symbol_V17.mq5` | 0+1  | 1 = pinbar detected (bull or bear), 0 = none  |

### Pinbar Detection Logic

The `pinbar` column combines two indicator buffers into a single binary flag:

```
BullishPinbars  = CopyBuffer(h_pinbar, buffer=0, shift=1)
BearishPinbars  = CopyBuffer(h_pinbar, buffer=1, shift=1)

pinbar = 1  if (BullishPinbars != EMPTY_VALUE && BullishPinbars != 0.0)
             OR (BearishPinbars != EMPTY_VALUE && BearishPinbars != 0.0)
pinbar = 0  otherwise
```

> **Important:** The Pinbar Detector must be loaded with `DisplayMode = INDICATOR_BUFFERS (0)`.
> Its default `DisplayMode = DRAWING_OBJECTS (1)` does not populate `CopyBuffer`-accessible data.

### Dual TEMA High/Low — Indicator Details

`Dual_TEMA_High_Low.mq5` computes two separate TEMA lines:

- **Buffer 0** (`TEMAHighBuffer`): TEMA of the High price series — tracks upper momentum
- **Buffer 1** (`TEMALowBuffer`): TEMA of the Low price series — tracks lower support momentum

The EMA period is configurable via `InpDualTEMA_Period` (default: 9).

### Column Count Summary

| Category              | v1.0 (57-col) | v2.0 (60-col) | Delta |
| --------------------- | ------------- | ------------- | ----- |
| System columns        | 8             | 8             | —     |
| FREE tier indicators  | 16            | 16            | —     |
| PRO tier indicators   | 33            | 36            | +3    |
| **Total**             | **57**        | **60**        | **+3** |

### Tier Classification of New Columns

The three new columns are classified as **PRO tier** because:
1. They require additional indicator instances loaded per symbol/timeframe slot
2. They depend on optional indicators not available in basic data collection
3. They add analytical depth suited to advanced/algorithmic strategies

### Schema Migration

**Existing databases** (created by EA v2.25 or earlier) are automatically migrated on EA startup via `MigrateSymbolTable()`:

```sql
ALTER TABLE [symbol] ADD COLUMN dual_tema_high REAL;
ALTER TABLE [symbol] ADD COLUMN dual_tema_low  REAL;
ALTER TABLE [symbol] ADD COLUMN pinbar         INTEGER;
```

SQLite silently ignores `ALTER TABLE ADD COLUMN` if the column already exists, making this idempotent.

**Backfill worker v3** (`backfill_worker_api_gateway_v3.py`) is backward compatible with both old (57-col) and new (60-col) SQLite databases. It reads all available columns generically — pre-v2.26 rows simply won't contain the three new fields.

---

## 🎯 Overview

### What is the 60-Column Schema?

**NEW Schema (60-column flat structure):**

```typescript
{
  // System columns (8)
  timestamp: 1705324800,
  open: 43265,
  high: 43300,
  low: 43200,
  close: 43280,
  volume: 1234.56,
  timeframe: 'M1',
  collected_at: '2025-01-16T12:00:00Z',

  // FREE tier indicators (16 columns)
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

  // PRO tier indicators (36 columns — was 33 in v1.0)
  tema: 43260,
  hrma: 43255,
  smma: 43258,
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
  // ↓ NEW in v2.0 (EA v2.26)
  dual_tema_high: 43285,
  dual_tema_low: 43245,
  pinbar: 0,
}
```

### Migration Summary

- **From:** 57-column flat structure (8 system + 16 FREE + 33 PRO)
- **To:** 60-column flat structure (8 system + 16 FREE + 36 PRO)
- **Tier Access:**
  - FREE tier: 24 columns (8 system + 16 FREE indicators) — **unchanged**
  - PRO tier: 60 columns (8 system + 16 FREE + 36 PRO indicators) — **was 57**

---

## 🔑 Critical Distinctions

### **CRITICAL:** Three Separate Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: DATABASE SCHEMA (PostgreSQL)                      │
├─────────────────────────────────────────────────────────────┤
│ • 60 columns with NEW names                                 │
│ • diag_asc_line_1, diag_desc_line_1                        │
│ • horiz_peak_line_1, horiz_bottom_line_1                   │
│ • tema, hrma, smma, body_size, body_direction              │
│ • ha_open … ha_strength                                     │
│ • NEW: dual_tema_high, dual_tema_low, pinbar               │
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
│ • Reads 60-column data from PostgreSQL                     │
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
│     "diag_asc_line_1": 43250,  // Uses NEW 60-col names    │
│     "tema": 43260,                                          │
│     "dual_tema_high": 43285,   // NEW v2.0 column          │
│     "dual_tema_low": 43245,    // NEW v2.0 column          │
│     "pinbar": 0,               // NEW v2.0 column          │
│     ...all 60 columns                                       │
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
│ New indicators (dual_tema_hl, pinbar_detection) are PRO    │
│ tier — they do NOT appear in the FREE metadata endpoint    │
└─────────────────────────────────────────────────────────────┘
```

### Key Insight

**Database layer uses NEW 60-column schema names.**
**Metadata layer uses OLD field names for consumer compatibility.**
**New v2.0 columns (dual_tema_high, dual_tema_low, pinbar) are PRO only — they never appear in FREE metadata.**

---

## 📊 Schema Structure

### 8 System Columns (Always included, all tiers) — Unchanged

```typescript
{
  timestamp: number;    // Unix timestamp (seconds)
  open: number;         // OHLC data
  high: number;
  low: number;
  close: number;
  volume: number;       // Trading volume
  timeframe: string;    // 'M1', 'M5', 'M15', 'H1', 'H4', 'D1'
  collected_at: string; // ISO 8601 timestamp
}
```

### FREE Tier Indicators (16 columns) — Unchanged

**Group 1: Fractal Diagonal Lines (8 columns)**

```typescript
{
  diag_asc_line_1: number | null;  // Ascending trendline 1
  diag_asc_line_2: number | null;  // Ascending trendline 2
  diag_asc_line_3: number | null;  // Ascending trendline 3
  diag_desc_line_1: number | null; // Descending trendline 1
  diag_desc_line_2: number | null; // Descending trendline 2
  diag_desc_line_3: number | null; // Descending trendline 3
  diag_high_map: number | null;    // High fractal mapping data
  diag_low_map: number | null;     // Low fractal mapping data
}
```

**Group 2: Fractal Horizontal Lines (8 columns)**

```typescript
{
  horiz_peak_line_1: number | null;   // Peak resistance line 1
  horiz_peak_line_2: number | null;   // Peak resistance line 2
  horiz_peak_line_3: number | null;   // Peak resistance line 3
  horiz_bottom_line_1: number | null; // Bottom support line 1
  horiz_bottom_line_2: number | null; // Bottom support line 2
  horiz_bottom_line_3: number | null; // Bottom support line 3
  horiz_high_map: number | null;      // High fractal mapping data
  horiz_low_map: number | null;       // Low fractal mapping data
}
```

### PRO Tier Indicators (36 columns) — 33 existing + 3 new

**Group 3: Moving Averages (3 columns) — Unchanged**

```typescript
{
  tema: number | null; // Triple Exponential Moving Average
  hrma: number | null; // Hull Moving Average
  smma: number | null; // Smoothed Moving Average
}
```

**Group 4: Body Size Momentum (2 columns) — Unchanged**

```typescript
{
  body_size: number | null;      // Candle body size (0.0 to 1.0)
  body_direction: number | null; // 1 = bullish, -1 = bearish, 0 = neutral
}
```

**Group 5: Heiken Ashi (7 columns) — Unchanged**

```typescript
{
  ha_open: number | null;     // Heiken Ashi open
  ha_high: number | null;     // Heiken Ashi high
  ha_low: number | null;      // Heiken Ashi low
  ha_close: number | null;    // Heiken Ashi close
  ha_color: number | null;    // 1 = green, -1 = red
  ha_trend: number | null;    // 1 = uptrend, -1 = downtrend
  ha_strength: number | null; // Trend strength (0.0 to 1.0)
}
```

**Group 6: Keltner Channels (10 columns) — Unchanged**

```typescript
{
  kc_upper: number | null;       // Upper Keltner Channel
  kc_middle: number | null;      // Middle line (EMA)
  kc_lower: number | null;       // Lower Keltner Channel
  kc_upper_ema: number | null;   // Upper channel EMA
  kc_middle_ema: number | null;  // Middle EMA
  kc_lower_ema: number | null;   // Lower channel EMA
  kc_squeeze: number | null;     // Squeeze indicator (0 or 1)
  kc_squeeze_pro: number | null; // Pro squeeze (0 or 1)
  kc_width: number | null;       // Channel width
  kc_width_ema: number | null;   // Width EMA
}
```

**Group 7: Support/Resistance (8 columns) — Unchanged**

```typescript
{
  sr_1: number | null; // Support/Resistance level 1 (strongest)
  sr_2: number | null; // Support/Resistance level 2
  sr_3: number | null; // Support/Resistance level 3
  sr_4: number | null; // Support/Resistance level 4
  sr_5: number | null; // Support/Resistance level 5
  sr_6: number | null; // Support/Resistance level 6
  sr_7: number | null; // Support/Resistance level 7
  sr_8: number | null; // Support/Resistance level 8 (weakest)
}
```

**Group 8: ZigZag (3 columns) — Unchanged**

```typescript
{
  zigzag_high: number | null;  // ZigZag swing high
  zigzag_low: number | null;   // ZigZag swing low
  zigzag_trend: number | null; // 1 = uptrend, -1 = downtrend
}
```

**Group 9: Dual TEMA High/Low (2 columns) — 🆕 NEW in v2.0**

```typescript
{
  dual_tema_high: number | null; // TEMA of bar highs (Dual_TEMA_High_Low buffer 0)
  dual_tema_low: number | null;  // TEMA of bar lows  (Dual_TEMA_High_Low buffer 1)
}
```

> Collected from `Dual_TEMA_High_Low.mq5`.
> EMA period configured via `InpDualTEMA_Period` (default: 9) in the EA.
> Both values are `0` when the indicator has not yet warmed up (first `3 × period - 3` bars).

**Group 10: Pinbar Detection (1 column) — 🆕 NEW in v2.0**

```typescript
{
  pinbar: number | null; // 1 = any pinbar on this bar, 0 = no pinbar
}
```

> Collected from `Pinbar Detector_Diamond Symbol_V17.mq5` with `DisplayMode = INDICATOR_BUFFERS`.
> Buffer 0 (BullishPinbars) OR Buffer 1 (BearishPinbars) having a non-zero value → `pinbar = 1`.
> Direction (bullish vs bearish) is not stored separately — use with `body_direction` if directionality is needed.

---

## ✅ Compliance Factors

### 1. Indicator ID Naming Conventions

**CRITICAL:** Different layers use different ID formats!

| Layer            | ID Format            | Example              | Location                    |
| ---------------- | -------------------- | -------------------- | --------------------------- |
| TypeScript Types | lowercase_snake_case | `dual_tema_hl`       | lib/tier/constants.ts       |
| API Metadata     | UPPERCASE_SNAKE_CASE | `FRACTAL_HORIZONTAL` | app/api/indicators/route.ts |
| Database Columns | lowercase_snake_case | `dual_tema_high`     | PostgreSQL schema           |

### 2. Field Name Compatibility

**CRITICAL:** Metadata endpoints must use OLD field names for consumer compatibility!

| Indicator          | OLD Field Names (for metadata)                                                              | NEW Database Columns                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Fractal Horizontal | `peak_1`, `peak_2`, `peak_3`, `bottom_1`, `bottom_2`, `bottom_3`                            | `horiz_peak_line_1`, `horiz_peak_line_2`, `horiz_peak_line_3`, `horiz_bottom_line_1`, `horiz_bottom_line_2`, `horiz_bottom_line_3` |
| Fractal Diagonal   | `ascending_1`, `ascending_2`, `ascending_3`, `descending_1`, `descending_2`, `descending_3` | `diag_asc_line_1`, `diag_asc_line_2`, `diag_asc_line_3`, `diag_desc_line_1`, `diag_desc_line_2`, `diag_desc_line_3`                |
| Dual TEMA H/L      | N/A — PRO only, no legacy name                                                              | `dual_tema_high`, `dual_tema_low`                                                                                                  |
| Pinbar Detection   | N/A — PRO only, no legacy name                                                              | `pinbar`                                                                                                                           |

### 3. Tier Access Rules

**FREE Tier:** 24 total columns — **unchanged**

- 8 system columns
- 16 FREE indicator columns (fractal_diagonal + fractal_horizontal)

**PRO Tier:** 60 total columns — **updated from 57**

- 8 system columns
- 16 FREE indicator columns
- 36 PRO indicator columns:
  - moving_averages (3)
  - body_momentum (2)
  - heiken_ashi (7)
  - keltner_channels (10)
  - support_resistance (8)
  - zigzag (3)
  - **dual_tema_hl (2) ← new**
  - **pinbar_detection (1) ← new**

**Implementation:**

```typescript
// Filter columns based on tier
const allowedColumns =
  tier === 'PRO' ? ALL_60_COLUMNS : SYSTEM_COLUMNS + FREE_TIER_COLUMNS; // 24 columns

// Constants update required:
// Was: ALL_57_COLUMNS_SELECT
// Now: ALL_60_COLUMNS_SELECT  (add dual_tema_high, dual_tema_low, pinbar)
```

### 4. Backward Compatibility

**CRITICAL:** Maintain legacy exports!

```typescript
// ✅ REQUIRED: Legacy alias
export const BASIC_INDICATORS = FREE_TIER_INDICATORS;

// ✅ REQUIRED: Type alias (NOT separate interface)
export type IndicatorMeta = IndicatorMetadata;

// ✅ REQUIRED: All existing 57 columns remain — only 3 columns added
// No existing column names changed. Zero breaking changes to FREE tier.
```

### 5. Data Pattern Specifications

```typescript
type DataPattern = 'sparse' | 'dense' | 'continuous';
```

New indicator patterns:

- `dual_tema_hl`: **continuous** — value for every bar after warmup (3 × period - 3 bars)
- `pinbar_detection`: **sparse** — most bars are 0, only pinbar bars have value 1

---

## ⚠️ Common Pitfalls

### Pitfall 1: Using NEW Field Names in Metadata — Unchanged Rule

**❌ WRONG:**

```typescript
const INDICATOR_TYPES = [
  {
    id: 'FRACTAL_HORIZONTAL',
    dataFields: ['horiz_peak_line_1'], // ❌ NEW name - breaks tests!
  },
];
```

**✅ CORRECT:**

```typescript
const INDICATOR_TYPES = [
  {
    id: 'FRACTAL_HORIZONTAL',
    dataFields: ['peak_1'], // ✅ OLD name
  },
];
```

### Pitfall 2: Adding New PRO Indicators to FREE Metadata

**❌ WRONG:**

```typescript
const INDICATOR_TYPES = [
  { id: 'FRACTAL_HORIZONTAL' },
  { id: 'FRACTAL_DIAGONAL' },
  { id: 'DUAL_TEMA_HL' },      // ❌ PRO tier — must NOT appear here!
  { id: 'PINBAR_DETECTION' },  // ❌ PRO tier — must NOT appear here!
];
```

**✅ CORRECT:**

```typescript
// FREE metadata endpoint: only FREE tier + OHLC
const INDICATOR_TYPES = [
  { id: 'FRACTAL_HORIZONTAL' },
  { id: 'FRACTAL_DIAGONAL' },
  { id: 'FRACTALS' },
  { id: 'OHLC' },
];
```

### Pitfall 3: Updating Column Count Constants Without Updating Selects

**❌ WRONG:**

```typescript
// Updated the constant name but forgot to add new columns to the select object
const ALL_60_COLUMNS_SELECT = {
  ...ALL_57_COLUMNS_SELECT, // ❌ Still missing dual_tema_high, dual_tema_low, pinbar!
};
```

**✅ CORRECT:**

```typescript
const ALL_60_COLUMNS_SELECT = {
  ...ALL_57_COLUMNS_SELECT,
  dual_tema_high: true, // ✅ Explicitly added
  dual_tema_low: true,
  pinbar: true,
};
```

### Pitfall 4: Pinbar Indicator Loaded with Wrong DisplayMode

**❌ WRONG (in EA iCustom call):**

```mql5
h_pinbar = iCustom(sym, tf, "Pinbar Detector_Diamond Symbol_V17",
   1,  // StringencyLevel
   1,  // DisplayMode = DRAWING_OBJECTS ❌ CopyBuffer() returns EMPTY_VALUE!
   ...
);
```

**✅ CORRECT:**

```mql5
h_pinbar = iCustom(sym, tf, "Pinbar Detector_Diamond Symbol_V17",
   1,  // StringencyLevel
   0,  // DisplayMode = INDICATOR_BUFFERS ✅ Required for CopyBuffer() access
   ...
);
```

### Pitfall 5: Treating pinbar as a Float Instead of Integer

**❌ WRONG:**

```typescript
// In TypeScript type definition
pinbar: number | null; // Misleading — implies float
```

**✅ CORRECT:**

```typescript
// More precise — pinbar is always 0 or 1
pinbar: 0 | 1 | null; // Binary flag: 1 = detected, 0 = not detected
```

**And in Prisma schema:**

```prisma
pinbar  Int?  // Integer, not Float
```

### Pitfall 6: Using 57-Column Count in Updated Code

After this update, any hardcoded references to `57` for total column count must become `60`:

```typescript
// ❌ WRONG: Stale count
expect(ALL_COLUMNS).toHaveLength(57);
// ✅ CORRECT:
expect(ALL_COLUMNS).toHaveLength(60);

// ❌ WRONG: PRO tier column count
expect(PRO_ONLY_COLUMNS).toHaveLength(33);
// ✅ CORRECT:
expect(PRO_ONLY_COLUMNS).toHaveLength(36);
```

---

## 📝 Update Checklist

Use this checklist when updating any part to align with the 60-column schema:

### Phase 0: Verify New Columns in Database

- [ ] Confirm `dual_tema_high`, `dual_tema_low`, `pinbar` columns exist in PostgreSQL
- [ ] Run `SELECT dual_tema_high, dual_tema_low, pinbar FROM market_data LIMIT 1;` — no error
- [ ] Verify SQLite databases were migrated (columns present via `PRAGMA table_info(symbol)`)
- [ ] Confirm backfill worker v3 is deployed (check `X-EA-Version: backfill_worker_v3.py` in API logs)

### Phase 1: Type Definitions

- [ ] Update `MarketDataRecord` interface to add 3 new fields
- [ ] Add `dual_tema_high: number | null`
- [ ] Add `dual_tema_low: number | null`
- [ ] Add `pinbar: 0 | 1 | null` (or `number | null`)
- [ ] Update any column count assertions or comments from 57 to 60
- [ ] Add JSDoc comments for the 3 new fields

### Phase 2: Constants & Configuration

- [ ] Add `dual_tema_hl` to `PRO_ONLY_INDICATORS` array
- [ ] Add `pinbar_detection` to `PRO_ONLY_INDICATORS` array
- [ ] Verify `PRO_ONLY_INDICATORS` now has exactly 8 items (was 6)
- [ ] Add `dual_tema_hl` entry to `INDICATOR_METADATA`
- [ ] Add `pinbar_detection` entry to `INDICATOR_METADATA`
- [ ] Update `ALL_60_COLUMNS_SELECT` (rename from `ALL_57_COLUMNS_SELECT` or extend)
- [ ] Synchronize `lib/tier/constants.ts` → `frontend/lib/tier/constants.ts`
- [ ] Maintain `BASIC_INDICATORS` legacy alias (no change needed)
- [ ] Maintain `IndicatorMeta` type alias (no change needed)

### Phase 3: Database Schema (Prisma)

- [ ] Add `dual_tema_high Float?` to `MarketData` model
- [ ] Add `dual_tema_low Float?` to `MarketData` model
- [ ] Add `pinbar Int?` to `MarketData` model
- [ ] Run `npx prisma generate`
- [ ] Run migration: `npx prisma migrate dev --name add_dual_tema_pinbar`

### Phase 4: API Routes

- [ ] **Metadata Endpoint** (`app/api/indicators/route.ts`):
  - [ ] Do NOT add `DUAL_TEMA_HL` or `PINBAR_DETECTION` — these are PRO only
  - [ ] No changes required to this endpoint
- [ ] **Data Fetching Endpoint** (`app/api/indicators/[symbol]/[timeframe]/route.ts`):
  - [ ] Update JSDoc to reflect 60-column schema
  - [ ] Update `ALL_57_COLUMNS_SELECT` → `ALL_60_COLUMNS_SELECT` (add 3 new fields)
  - [ ] Verify PRO tier returns all 60 columns
  - [ ] Verify FREE tier still returns 24 columns (no change)

### Phase 5: Tests

- [ ] Update total column count assertions: `57` → `60`
- [ ] Update PRO indicator column count: `33` → `36`
- [ ] Update `PRO_ONLY_INDICATORS` length: `6` → `8`
- [ ] Add tests for `dual_tema_high`, `dual_tema_low`, `pinbar` in PRO responses
- [ ] Verify `dual_tema_high/low/pinbar` absent from FREE tier responses
- [ ] Update mock data to include the 3 new PRO columns
- [ ] Add test: `pinbar` value is always 0 or 1 (never fractional)
- [ ] Add test: `dual_tema_high` ≥ `dual_tema_low` (when both non-null and non-zero)

### Phase 6: Documentation

- [ ] Update API documentation to mention new columns
- [ ] Note EA version requirement: v2.26+ for new columns
- [ ] Note backfill worker version requirement: v3+ for new column awareness
- [ ] Document `pinbar = 0` for historical rows collected before v2.26 upgrade

### Phase 7: Validation

- [ ] Run TypeScript type checking: `npm run validate:types`
- [ ] Run ESLint: `npm run validate:lint`
- [ ] Run tests: `npm test`
- [ ] Verify no compilation errors
- [ ] Verify all tests pass

---

## 🔧 Layer-by-Layer Guide

### Layer 1: Database Schema (Prisma)

**Location:** `prisma/schema.prisma`

**What to update — add 3 fields to `MarketData` model:**

```prisma
model MarketData {
  id           String   @id @default(cuid())
  symbol       String
  timeframe    String

  // System columns (8)
  timestamp    Int
  open         Float
  high         Float
  low          Float
  close        Float
  volume       Float
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

  // PRO tier indicators (33 columns) — unchanged
  tema             Float?
  hrma             Float?
  smma             Float?
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

  // PRO tier indicators — NEW in v2.0 / EA v2.26 (3 columns)
  dual_tema_high   Float?  // TEMA of bar highs
  dual_tema_low    Float?  // TEMA of bar lows
  pinbar           Int?    // 1 = pinbar detected, 0 = none (Integer, not Float)

  @@index([symbol, timeframe, timestamp])
}
```

**After update:**

```bash
npx prisma generate
npx prisma migrate dev --name add_dual_tema_hl_and_pinbar
```

### Layer 2: TypeScript Type Definitions

**Location:** `lib/tier/types.ts` or similar

**What to update — add 3 fields to `MarketDataRecord`:**

```typescript
/**
 * 60-Column Database Schema for Market Data
 * Updated: v2.0 — adds dual_tema_high, dual_tema_low, pinbar (EA v2.26)
 *
 * Structure:
 * - 8 system columns (OHLCV + metadata)
 * - 16 FREE tier indicator columns
 * - 36 PRO tier indicator columns (was 33 in v1.0)
 */
export interface MarketDataRecord {
  // System columns (8) — unchanged
  timestamp: number;
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

  // PRO tier indicators — existing (33 columns) — unchanged
  tema: number | null;
  hrma: number | null;
  smma: number | null;
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

  // PRO tier indicators — NEW in v2.0 (3 columns)
  /** TEMA of bar highs from Dual_TEMA_High_Low indicator (buffer 0). Requires EA v2.26+. */
  dual_tema_high: number | null;
  /** TEMA of bar lows from Dual_TEMA_High_Low indicator (buffer 1). Requires EA v2.26+. */
  dual_tema_low: number | null;
  /** Pinbar detection flag: 1 = pinbar on this bar (bull or bear), 0 = none. Requires EA v2.26+. */
  pinbar: 0 | 1 | null;
}
```

### Layer 3: Constants & Metadata

**Location:** `lib/tier/constants.ts`

**What to update:**

```typescript
/**
 * 10 Indicator Groups in 60-Column Schema (v2.0)
 * Groups 1-8 unchanged from v1.0.
 * Groups 9-10 are new in v2.0.
 */
export const FREE_TIER_INDICATORS = [
  'fractal_diagonal',   // 8 columns
  'fractal_horizontal', // 8 columns
] as const;

export const PRO_ONLY_INDICATORS = [
  'moving_averages',    // 3 columns
  'body_momentum',      // 2 columns
  'heiken_ashi',        // 7 columns
  'keltner_channels',   // 10 columns
  'support_resistance', // 8 columns
  'zigzag',             // 3 columns
  'dual_tema_hl',       // 2 columns ← NEW in v2.0
  'pinbar_detection',   // 1 column  ← NEW in v2.0
] as const;

export type IndicatorId =
  | (typeof FREE_TIER_INDICATORS)[number]
  | (typeof PRO_ONLY_INDICATORS)[number];

export interface IndicatorMetadata {
  tier: 'FREE' | 'PRO';
  columns: string[];
  colors: Record<string, string>;
  dataPattern: 'sparse' | 'dense' | 'continuous';
  description?: string;
  addedInVersion?: string; // Track when indicators were added
}

export const INDICATOR_METADATA: Record<IndicatorId, IndicatorMetadata> = {
  // ... existing 8 groups unchanged ...

  // NEW: Group 9 — Dual TEMA High/Low
  dual_tema_hl: {
    tier: 'PRO',
    columns: ['dual_tema_high', 'dual_tema_low'],
    colors: {
      high: '#26a69a', // Teal for TEMA high line
      low: '#ef5350',  // Red for TEMA low line
    },
    dataPattern: 'continuous',
    description: 'Separate TEMA lines for bar highs and bar lows, forming a dynamic channel',
    addedInVersion: '2.0',
  },

  // NEW: Group 10 — Pinbar Detection
  pinbar_detection: {
    tier: 'PRO',
    columns: ['pinbar'],
    colors: {
      signal: '#ff9800', // Orange marker for pinbar bars
    },
    dataPattern: 'sparse',
    description: 'Binary flag indicating a pinbar candle pattern (bullish or bearish)',
    addedInVersion: '2.0',
  },
};

// CRITICAL: Backward compatibility — no changes to these
export const BASIC_INDICATORS = FREE_TIER_INDICATORS;
export type IndicatorMeta = IndicatorMetadata;

// Updated select objects for Prisma queries
export const ALL_60_COLUMNS_SELECT = {
  ...ALL_57_COLUMNS_SELECT, // Spread existing 57 columns
  dual_tema_high: true,
  dual_tema_low: true,
  pinbar: true,
};
```

### Layer 4: API Metadata Endpoint

**Location:** `app/api/indicators/route.ts`

**What to update:** Nothing — new columns are PRO only.

```typescript
// ✅ NO CHANGES NEEDED to this endpoint.
// dual_tema_hl and pinbar_detection are PRO tier indicators.
// The FREE metadata endpoint only describes FREE tier indicators.

const INDICATOR_TYPES: IndicatorTypeInfo[] = [
  { id: 'FRACTAL_HORIZONTAL', ... },
  { id: 'FRACTAL_DIAGONAL', ... },
  { id: 'FRACTALS', ... },
  { id: 'OHLC', ... },
  // ↑ This list stays exactly the same.
];
```

### Layer 5: Data Fetching Endpoint

**Location:** `app/api/indicators/[symbol]/[timeframe]/route.ts`

**What to update:**

```typescript
/**
 * GET /api/indicators/[symbol]/[timeframe]
 *
 * Returns actual indicator data from PostgreSQL database.
 * Uses NEW 60-column schema names. (Was 57-column in v1.0)
 *
 * Response includes 60-column database schema:
 * - System columns (8): timestamp, open, high, low, close, volume, timeframe, collected_at
 * - FREE tier indicators (16 columns): fractal_diagonal (8), fractal_horizontal (8)
 * - PRO tier indicators (36 columns):
 *     moving_averages (3), body_momentum (2), heiken_ashi (7),
 *     keltner_channels (10), support_resistance (8), zigzag (3),
 *     dual_tema_hl (2) [v2.0+], pinbar_detection (1) [v2.0+]
 *
 * Tier-based filtering:
 * - FREE tier: Returns 24 columns (8 system + 16 FREE indicators) — unchanged
 * - PRO tier: Returns 60 columns (8 system + 16 FREE + 36 PRO) — was 57
 *
 * Note: dual_tema_high, dual_tema_low, pinbar will be null for rows
 * collected before EA v2.26. The EA's MigrateSymbolTable() adds these
 * columns automatically; pre-migration rows retain NULL values.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { symbol: string; timeframe: string } }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const tier = session?.user?.tier || 'FREE';

  const data = await prisma.marketData.findFirst({
    where: {
      symbol: params.symbol,
      timeframe: params.timeframe,
    },
    select:
      tier === 'PRO'
        ? ALL_60_COLUMNS_SELECT // ← was ALL_57_COLUMNS_SELECT
        : FREE_TIER_SELECT,     // 24 columns — unchanged
  });

  return NextResponse.json({
    success: true,
    data,
    symbol: params.symbol,
    timeframe: params.timeframe,
  });
}
```

---

## 🧪 Testing Requirements

### Test Categories to Update

1. **Type Tests**
   - Verify 60 columns defined (was 57)
   - Verify `dual_tema_high`, `dual_tema_low`, `pinbar` present in `MarketDataRecord`
   - Verify `pinbar` typed as `0 | 1 | null` (not generic `number`)
   - Verify all columns nullable except system columns

2. **Constants Tests**
   - Verify `FREE_TIER_INDICATORS` still has exactly 2 items (unchanged)
   - Verify `PRO_ONLY_INDICATORS` now has exactly **8** items (was 6)
   - Verify `INDICATOR_METADATA` has entries for all **10** indicators (was 8)
   - Verify `dual_tema_hl` column count = 2
   - Verify `pinbar_detection` column count = 1
   - Verify `dual_tema_hl` dataPattern = `'continuous'`
   - Verify `pinbar_detection` dataPattern = `'sparse'`
   - Verify `BASIC_INDICATORS` still equals `FREE_TIER_INDICATORS` (backward compat)

3. **API Tests**
   - Verify `/api/indicators` does NOT include `DUAL_TEMA_HL` or `PINBAR_DETECTION`
   - Verify PRO data endpoint returns `dual_tema_high`, `dual_tema_low`, `pinbar`
   - Verify FREE data endpoint does NOT return the 3 new columns
   - Verify tier-based filtering: 24 cols for FREE, **60** cols for PRO (was 57)

4. **Data Integrity Tests**
   - Verify `pinbar` value is always 0 or 1 (never fractional, never > 1)
   - Verify `dual_tema_high` ≥ `dual_tema_low` on valid rows (by definition of H/L TEMA)
   - Verify rows pre-v2.26 have `null` for all 3 new columns (not 0 — null means no data)

5. **Component Tests**
   - Update mock data to include all 60 columns
   - Update label/display expectations for new indicators
   - Verify PRO tier chart renders dual TEMA channel lines when data present

---

## 📚 Examples

### Example 1: Complete Type Definition Update

**Diff to `MarketDataRecord` (add to end of PRO section):**

```typescript
// BEFORE (v1.0 — 57 columns):
  zigzag_high: number | null;
  zigzag_low: number | null;
  zigzag_trend: number | null;
}

// AFTER (v2.0 — 60 columns):
  zigzag_high: number | null;
  zigzag_low: number | null;
  zigzag_trend: number | null;
  // NEW in v2.0
  dual_tema_high: number | null;
  dual_tema_low: number | null;
  pinbar: 0 | 1 | null;
}
```

### Example 2: Test Update for Column Count

```typescript
// BEFORE (v1.0):
it('PRO tier should return 57 columns', () => {
  expect(Object.keys(proResponse.data)).toHaveLength(57);
});

it('should have 6 PRO-only indicators', () => {
  expect(PRO_ONLY_INDICATORS).toHaveLength(6);
});

// AFTER (v2.0):
it('PRO tier should return 60 columns', () => {
  expect(Object.keys(proResponse.data)).toHaveLength(60);
});

it('should have 8 PRO-only indicators', () => {
  expect(PRO_ONLY_INDICATORS).toHaveLength(8);
  expect(PRO_ONLY_INDICATORS).toContain('dual_tema_hl');
  expect(PRO_ONLY_INDICATORS).toContain('pinbar_detection');
});
```

### Example 3: Mock Data Update

```typescript
// Add to PRO tier mock response (append after zigzag_trend):
const mockMarketDataPRO: MarketDataRecord = {
  // ... all existing 57 fields ...
  zigzag_high: 43300,
  zigzag_low: 43200,
  zigzag_trend: 1,
  // NEW v2.0 fields:
  dual_tema_high: 43285, // TEMA of bar highs
  dual_tema_low: 43245,  // TEMA of bar lows
  pinbar: 0,             // No pinbar on this bar
};

// Historical row (collected before EA v2.26 upgrade):
const mockHistoricalRow: MarketDataRecord = {
  // ... existing fields ...
  zigzag_trend: 1,
  // Null for pre-v2.26 rows — not zero, because the column was absent
  dual_tema_high: null,
  dual_tema_low: null,
  pinbar: null,
};
```

### Example 4: Prisma Migration File

```sql
-- Migration: add_dual_tema_hl_and_pinbar
-- Generated by: npx prisma migrate dev --name add_dual_tema_hl_and_pinbar

ALTER TABLE "MarketData" ADD COLUMN "dual_tema_high" DOUBLE PRECISION;
ALTER TABLE "MarketData" ADD COLUMN "dual_tema_low" DOUBLE PRECISION;
ALTER TABLE "MarketData" ADD COLUMN "pinbar" INTEGER;
```

---

## 🔄 Migration from 57-Column Schema

### What Requires Changes

| Component                              | Change Required | Notes                                          |
| -------------------------------------- | --------------- | ---------------------------------------------- |
| `prisma/schema.prisma`                 | ✅ Yes          | Add 3 new fields                               |
| `lib/tier/types.ts`                    | ✅ Yes          | Add 3 new properties to `MarketDataRecord`     |
| `lib/tier/constants.ts`                | ✅ Yes          | Add 2 new indicator groups, update select obj  |
| `frontend/lib/tier/constants.ts`       | ✅ Yes          | Sync with backend constants                    |
| `app/api/indicators/route.ts`          | ❌ No           | PRO-only — no change to FREE metadata          |
| `app/api/indicators/[s]/[tf]/route.ts` | ✅ Yes          | Update select to `ALL_60_COLUMNS_SELECT`       |
| Test files                             | ✅ Yes          | Update counts, add new column assertions       |
| `EA (.mq5 file)`                       | ✅ Done         | v2.26 already implemented                      |
| `backfill_worker.py`                   | ✅ Done         | v3 already implemented                         |
| SQLite databases                       | ✅ Auto         | `MigrateSymbolTable()` runs on EA startup      |
| Existing PostgreSQL rows               | ⚠️ NULL values  | Pre-v2.26 rows will have NULL for new columns  |

### What Does NOT Change

- FREE tier column set (24 columns) — completely unchanged
- All 57 existing column names — no renames, no removals
- API metadata endpoint — no new PRO indicators exposed here
- `BASIC_INDICATORS` legacy alias — still works
- `IndicatorMeta` type alias — still works
- Groups 1–8 of `INDICATOR_METADATA` — no changes

### Deployment Order

To minimize risk, deploy in this order:

1. **Database migration** — add nullable columns (safe, existing queries unaffected)
2. **Backend deploy** — update types, constants, and data fetching endpoint
3. **Frontend deploy** — update types, constants, UI components
4. **EA upgrade** — deploy v2.26 to MT5 terminals (starts populating new columns)
5. **Backfill worker upgrade** — deploy v3 (handles both old and new schema rows)

---

## ✅ Summary

### Key Takeaways

1. **60 Columns Total:** 8 system + 16 FREE + 36 PRO (was 33 PRO in v1.0)
2. **Three Layers:** Database (NEW names) → Data Fetching (NEW names) → Metadata (OLD names)
3. **ID Conventions:** lowercase for TypeScript, UPPERCASE for API
4. **New Columns are PRO Only:** `dual_tema_high`, `dual_tema_low`, `pinbar` never in FREE tier
5. **Backward Compatible:** All 57 existing columns unchanged, NULL for pre-v2.26 rows
6. **EA Requirement:** New columns only populated by EA v2.26+ with `Dual_TEMA_High_Low` and `Pinbar Detector_Diamond Symbol_V17` loaded

### Quick Reference

| Aspect                   | FREE Tier    | PRO Tier     |
| ------------------------ | ------------ | ------------ |
| Total Columns            | 24           | **60** (↑57) |
| System Columns           | 8            | 8            |
| Indicator Columns        | 16           | **52** (↑49) |
| Indicator Groups         | 2            | **10** (↑8)  |
| New v2.0 columns exposed | None         | 3            |
| API Metadata IDs         | UPPERCASE    | UPPERCASE    |
| TypeScript IDs           | lowercase    | lowercase    |
| Database Names           | NEW (60-col) | NEW (60-col) |
| Metadata Names           | OLD (compat) | OLD (compat) |

### New Indicator Groups at a Glance

| Group | Name              | Columns         | Pattern    | Tier | EA Indicator                           |
| ----- | ----------------- | --------------- | ---------- | ---- | -------------------------------------- |
| 9     | Dual TEMA H/L     | 2               | continuous | PRO  | `Dual_TEMA_High_Low.mq5`               |
| 10    | Pinbar Detection  | 1               | sparse     | PRO  | `Pinbar Detector_Diamond Symbol_V17.mq5` |

---

**Document Version:** 2.0.0
**Last Updated:** 2026-02-10
**Replaces:** `57-column-schema-update-guide.md` v1.0.0
**Next Review:** After completing all part updates for 60-column schema
