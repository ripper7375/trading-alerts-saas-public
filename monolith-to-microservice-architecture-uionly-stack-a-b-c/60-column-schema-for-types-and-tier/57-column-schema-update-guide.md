# 57-Column Database Schema Update Guide

**Version:** 1.0.0
**Last Updated:** 2025-01-16
**Purpose:** Comprehensive guide for updating any part of the codebase to align with the new 57-column database schema

---

## 📋 TABLE OF CONTENTS

1. [Overview](#overview)
2. [Critical Distinctions](#critical-distinctions)
3. [Schema Structure](#schema-structure)
4. [Compliance Factors](#compliance-factors)
5. [Common Pitfalls](#common-pitfalls)
6. [Update Checklist](#update-checklist)
7. [Layer-by-Layer Guide](#layer-by-layer-guide)
8. [Testing Requirements](#testing-requirements)
9. [Examples](#examples)

---

## 🎯 Overview

### What Changed?

**OLD Schema (14-column JSON structure):**

```json
{
  "timestamp": 1705324800,
  "open": 43265,
  "high": 43300,
  "low": 43200,
  "close": 43280,
  "volume": 1234.56,
  "indicators": {
    "fractals": { "peak": 43300, "bottom": 43200 },
    "trendlines": { "ascending": 43250, "descending": 43270 },
    "momentum_candles": { "value": 0.75 },
    "tema": 43260,
    "hrma": 43255,
    "smma": 43258
  }
}
```

**NEW Schema (57-column flat structure):**

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

  // PRO tier indicators (33 columns)
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
  zigzag_trend: 1
}
```

### Migration Summary

- **From:** Nested JSON with 14 columns total (6 OHLCV + 8 indicator fields containing nested objects)
- **To:** Flat structure with 57 named columns (8 system + 49 indicator columns)
- **Tier Access:**
  - FREE tier: 24 columns (8 system + 16 FREE indicators)
  - PRO tier: 57 columns (8 system + 16 FREE + 33 PRO indicators)

---

## 🔑 Critical Distinctions

### **CRITICAL:** Three Separate Layers

Understanding this distinction is **absolutely critical** to avoid the mistakes made during Part 07 updates:

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: DATABASE SCHEMA (PostgreSQL)                      │
├─────────────────────────────────────────────────────────────┤
│ • 57 columns with NEW names                                 │
│ • diag_asc_line_1, diag_desc_line_1                        │
│ • horiz_peak_line_1, horiz_bottom_line_1                   │
│ • tema, hrma, smma, body_size, body_direction              │
│ • ha_open, ha_high, ha_low, ha_close, ha_color, etc.      │
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
│ • Reads 57-column data from PostgreSQL                     │
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
│     "diag_asc_line_1": 43250,  // Uses NEW 57-col names    │
│     "tema": 43260,              // Uses NEW 57-col names    │
│     ...all 57 columns                                       │
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
│ Example Response:                                           │
│ {                                                           │
│   "indicators": [                                           │
│     {                                                       │
│       "id": "FRACTAL_HORIZONTAL",  // UPPERCASE             │
│       "dataFields": [                                       │
│         "peak_1", "peak_2", "peak_3",  // OLD names         │
│         "bottom_1", "bottom_2", "bottom_3"                  │
│       ]                                                     │
│     }                                                       │
│   ]                                                         │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘
```

### Key Insight

**Database layer uses NEW 57-column schema names.**
**Metadata layer uses OLD field names for consumer compatibility.**

This is NOT a bug or inconsistency—it's intentional separation of concerns!

---

## 📊 Schema Structure

### 8 System Columns (Always included, all tiers)

```typescript
{
  timestamp: number; // Unix timestamp (seconds)
  open: number; // OHLC data
  high: number;
  low: number;
  close: number;
  volume: number; // Trading volume
  timeframe: string; // 'M1', 'M5', 'M15', 'H1', 'H4', 'D1'
  collected_at: string; // ISO 8601 timestamp
}
```

### FREE Tier Indicators (16 columns)

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

### PRO Tier Indicators (33 columns)

**Group 3: Moving Averages (3 columns)**

```typescript
{
  tema: number | null; // Triple Exponential Moving Average
  hrma: number | null; // Hull Moving Average
  smma: number | null; // Smoothed Moving Average
}
```

**Group 4: Body Size Momentum (2 columns)**

```typescript
{
  body_size: number | null; // Candle body size (0.0 to 1.0)
  body_direction: number | null; // 1 = bullish, -1 = bearish, 0 = neutral
}
```

**Group 5: Heiken Ashi (7 columns)**

```typescript
{
  ha_open: number | null; // Heiken Ashi open
  ha_high: number | null; // Heiken Ashi high
  ha_low: number | null; // Heiken Ashi low
  ha_close: number | null; // Heiken Ashi close
  ha_color: number | null; // 1 = green, -1 = red
  ha_trend: number | null; // 1 = uptrend, -1 = downtrend
  ha_strength: number | null; // Trend strength (0.0 to 1.0)
}
```

**Group 6: Keltner Channels (10 columns)**

```typescript
{
  kc_upper: number | null; // Upper Keltner Channel
  kc_middle: number | null; // Middle line (EMA)
  kc_lower: number | null; // Lower Keltner Channel
  kc_upper_ema: number | null; // Upper channel EMA
  kc_middle_ema: number | null; // Middle EMA
  kc_lower_ema: number | null; // Lower channel EMA
  kc_squeeze: number | null; // Squeeze indicator (0 or 1)
  kc_squeeze_pro: number | null; // Pro squeeze (0 or 1)
  kc_width: number | null; // Channel width
  kc_width_ema: number | null; // Width EMA
}
```

**Group 7: Support/Resistance (8 columns)**

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

**Group 8: ZigZag (3 columns)**

```typescript
{
  zigzag_high: number | null; // ZigZag swing high
  zigzag_low: number | null; // ZigZag swing low
  zigzag_trend: number | null; // 1 = uptrend, -1 = downtrend
}
```

---

## ✅ Compliance Factors

### 1. Indicator ID Naming Conventions

**CRITICAL:** Different layers use different ID formats!

| Layer            | ID Format            | Example              | Location                    |
| ---------------- | -------------------- | -------------------- | --------------------------- |
| TypeScript Types | lowercase_snake_case | `fractal_diagonal`   | lib/tier/constants.ts       |
| API Metadata     | UPPERCASE_SNAKE_CASE | `FRACTAL_HORIZONTAL` | app/api/indicators/route.ts |
| Database Columns | lowercase_snake_case | `diag_asc_line_1`    | PostgreSQL schema           |

**Example:**

```typescript
// ✅ CORRECT: lib/tier/constants.ts (TypeScript types)
export const FREE_TIER_INDICATORS = [
  'fractal_diagonal',      // lowercase
  'fractal_horizontal',
] as const;

// ✅ CORRECT: app/api/indicators/route.ts (API metadata)
const INDICATOR_TYPES = [
  {
    id: 'FRACTAL_HORIZONTAL',  // UPPERCASE
    name: 'Fractal Horizontal Lines',
    dataFields: ['peak_1', 'peak_2', 'peak_3', ...]  // OLD names for compatibility
  }
];

// ✅ CORRECT: Database queries
SELECT diag_asc_line_1, horiz_peak_line_1 FROM market_data;  // lowercase NEW names
```

### 2. Field Name Compatibility

**CRITICAL:** Metadata endpoints must use OLD field names for consumer compatibility!

| Indicator          | OLD Field Names (for metadata)                                                              | NEW Database Columns                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Fractal Horizontal | `peak_1`, `peak_2`, `peak_3`, `bottom_1`, `bottom_2`, `bottom_3`                            | `horiz_peak_line_1`, `horiz_peak_line_2`, `horiz_peak_line_3`, `horiz_bottom_line_1`, `horiz_bottom_line_2`, `horiz_bottom_line_3` |
| Fractal Diagonal   | `ascending_1`, `ascending_2`, `ascending_3`, `descending_1`, `descending_2`, `descending_3` | `diag_asc_line_1`, `diag_asc_line_2`, `diag_asc_line_3`, `diag_desc_line_1`, `diag_desc_line_2`, `diag_desc_line_3`                |

**Why?** Tests and frontend consumers expect the old field names. Changing metadata breaks their expectations.

### 3. Tier Access Rules

**FREE Tier:** 24 total columns

- 8 system columns
- 16 FREE indicator columns (fractal_diagonal + fractal_horizontal)

**PRO Tier:** 57 total columns

- 8 system columns
- 16 FREE indicator columns
- 33 PRO indicator columns (moving_averages, body_momentum, heiken_ashi, keltner_channels, support_resistance, zigzag)

**Implementation:**

```typescript
// Filter columns based on tier
const allowedColumns =
  tier === 'PRO' ? ALL_57_COLUMNS : SYSTEM_COLUMNS + FREE_TIER_COLUMNS; // 24 columns
```

### 4. Backward Compatibility

**CRITICAL:** Maintain legacy exports!

```typescript
// ✅ REQUIRED: Legacy alias
export const BASIC_INDICATORS = FREE_TIER_INDICATORS;

// ✅ REQUIRED: Type alias (NOT separate interface)
export type IndicatorMeta = IndicatorMetadata;

// ❌ WRONG: Creating separate interface
export interface IndicatorMeta {
  // This breaks backward compatibility!
}
```

### 5. Data Pattern Specifications

Each indicator has a data pattern that affects how it should be rendered:

```typescript
type DataPattern = 'sparse' | 'dense' | 'continuous';

// Sparse: Most values are null, only plot where data exists
// Dense: Most values are populated
// Continuous: All values populated, no gaps
```

**Examples:**

- `fractal_diagonal`: sparse (trendlines only at fractal points)
- `moving_averages`: continuous (value for every candle)
- `support_resistance`: sparse (only key S/R levels)

---

## ⚠️ Common Pitfalls

### Pitfall 1: Using NEW Field Names in Metadata

**❌ WRONG:**

```typescript
// app/api/indicators/route.ts
const INDICATOR_TYPES = [
  {
    id: 'FRACTAL_HORIZONTAL',
    dataFields: [
      'horiz_peak_line_1', // ❌ NEW name - breaks tests!
      'horiz_peak_line_2',
      'horiz_peak_line_3',
    ],
  },
];
```

**✅ CORRECT:**

```typescript
// app/api/indicators/route.ts
const INDICATOR_TYPES = [
  {
    id: 'FRACTAL_HORIZONTAL',
    dataFields: [
      'peak_1', // ✅ OLD name - matches consumer expectations
      'peak_2',
      'peak_3',
    ],
  },
];
```

### Pitfall 2: Using lowercase IDs in API Metadata

**❌ WRONG:**

```typescript
// app/api/indicators/route.ts
const INDICATOR_TYPES = [
  {
    id: 'fractal_horizontal', // ❌ lowercase - breaks tests!
  },
];
```

**✅ CORRECT:**

```typescript
// app/api/indicators/route.ts
const INDICATOR_TYPES = [
  {
    id: 'FRACTAL_HORIZONTAL', // ✅ UPPERCASE for API
  },
];
```

### Pitfall 3: Breaking IndicatorMeta Backward Compatibility

**❌ WRONG:**

```typescript
// Separate interface with old structure
export interface IndicatorMeta {
  tier: Tier;
  columns: string[];
  color?: string; // ❌ Old property, breaks new code
}
```

**✅ CORRECT:**

```typescript
// Type alias to new interface
export type IndicatorMeta = IndicatorMetadata;
```

### Pitfall 4: Not Synchronizing Frontend/Backend

**❌ WRONG:**

```typescript
// Backend updated to 57-column schema
// But frontend still using old structure
```

**✅ CORRECT:**

```typescript
// Both frontend and backend use identical constants
// Copy lib/tier/constants.ts to frontend/lib/tier/constants.ts
```

### Pitfall 5: Adding PRO Indicators to Metadata

**❌ WRONG:**

```typescript
// app/api/indicators/route.ts
const INDICATOR_TYPES = [
  { id: 'FRACTAL_HORIZONTAL' },
  { id: 'FRACTAL_DIAGONAL' },
  { id: 'MOVING_AVERAGES' }, // ❌ PRO tier - don't add to metadata!
  { id: 'BODY_MOMENTUM' }, // ❌ PRO tier - don't add to metadata!
];
```

**✅ CORRECT:**

```typescript
// app/api/indicators/route.ts
// Only include FREE tier indicators + OHLC
const INDICATOR_TYPES = [
  { id: 'FRACTAL_HORIZONTAL' },
  { id: 'FRACTAL_DIAGONAL' },
  { id: 'FRACTALS' },
  { id: 'OHLC' },
];
```

**Why?** The `/api/indicators` metadata endpoint describes what's available in the basic free tier. PRO indicators are accessed through the data fetching endpoint with proper tier validation.

---

## 📝 Update Checklist

Use this checklist when updating any part to align with 57-column schema:

### Phase 1: Type Definitions

- [ ] Update TypeScript type definitions to include all 57 columns
- [ ] Use lowercase_snake_case for internal type properties
- [ ] Add JSDoc comments describing each column
- [ ] Ensure all columns are marked as `number | null` (nullable)
- [ ] Add `timeframe` and `collected_at` system columns if missing

### Phase 2: Constants & Configuration

- [ ] Update lib/tier/constants.ts with 8 indicator groups
- [ ] Update frontend/lib/tier/constants.ts (synchronize with backend)
- [ ] Verify FREE_TIER_INDICATORS contains exactly 2 indicators
- [ ] Verify PRO_ONLY_INDICATORS contains exactly 6 indicators
- [ ] Maintain BASIC_INDICATORS legacy alias
- [ ] Use type alias for IndicatorMeta (not separate interface)
- [ ] Add color configurations using `colors: Record<string, string>`
- [ ] Specify dataPattern for each indicator

### Phase 3: API Routes

- [ ] **Metadata Endpoint** (app/api/indicators/route.ts):
  - [ ] Use UPPERCASE_SNAKE_CASE for indicator IDs
  - [ ] Use OLD field names in dataFields arrays
  - [ ] Only include FREE tier indicators + OHLC
  - [ ] Do NOT add PRO tier indicators to this endpoint
- [ ] **Data Fetching Endpoint** (app/api/indicators/[symbol]/[timeframe]/route.ts):
  - [ ] Update JSDoc to describe 57-column schema
  - [ ] Use NEW database column names in queries
  - [ ] Apply tier-based column filtering
  - [ ] Return all 57 columns for PRO tier
  - [ ] Return only 24 columns for FREE tier

### Phase 4: Tests

- [ ] Update test expectations to use new indicator IDs (lowercase)
- [ ] Update test expectations to use new indicator labels
- [ ] Verify tests check for UPPERCASE IDs in API responses
- [ ] Verify tests check for OLD field names in metadata
- [ ] Add tests for tier-based column filtering
- [ ] Update mock data to include all 57 columns

### Phase 5: Documentation

- [ ] Update JSDoc comments in type definitions
- [ ] Update API route documentation
- [ ] Update README or other docs mentioning schema
- [ ] Document any breaking changes

### Phase 6: Validation

- [ ] Run TypeScript type checking: `npm run validate:types`
- [ ] Run ESLint: `npm run validate:lint`
- [ ] Run tests: `npm test`
- [ ] Verify no compilation errors
- [ ] Verify all tests pass

---

## 🔧 Layer-by-Layer Guide

### Layer 1: Database Schema (Prisma)

**Location:** `prisma/schema.prisma`

**What to update:**

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

  // FREE tier indicators (16 columns)
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

  // PRO tier indicators (33 columns)
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

  @@index([symbol, timeframe, timestamp])
}
```

**After update:**

```bash
npx prisma generate
npx prisma db push  # or create migration
```

### Layer 2: TypeScript Type Definitions

**Location:** `lib/tier/types.ts` or similar

**What to update:**

```typescript
/**
 * 57-Column Database Schema for Market Data
 *
 * Structure:
 * - 8 system columns (OHLCV + metadata)
 * - 16 FREE tier indicator columns
 * - 33 PRO tier indicator columns
 */
export interface MarketDataRecord {
  // System columns (8) - Always included
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timeframe: string;
  collected_at: string;

  // FREE tier indicators (16 columns)
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

  // PRO tier indicators (33 columns)
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
}
```

### Layer 3: Constants & Metadata

**Location:** `lib/tier/constants.ts`

**What to update:**

```typescript
/**
 * 8 Indicator Groups in 57-Column Schema
 */
export const FREE_TIER_INDICATORS = [
  'fractal_diagonal', // 8 columns
  'fractal_horizontal', // 8 columns
] as const;

export const PRO_ONLY_INDICATORS = [
  'moving_averages', // 3 columns
  'body_momentum', // 2 columns
  'heiken_ashi', // 7 columns
  'keltner_channels', // 10 columns
  'support_resistance', // 8 columns
  'zigzag', // 3 columns
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
}

export const INDICATOR_METADATA: Record<IndicatorId, IndicatorMetadata> = {
  fractal_diagonal: {
    tier: 'FREE',
    columns: [
      'diag_asc_line_1',
      'diag_asc_line_2',
      'diag_asc_line_3',
      'diag_desc_line_1',
      'diag_desc_line_2',
      'diag_desc_line_3',
      'diag_high_map',
      'diag_low_map',
    ],
    colors: {
      ascending: '#00c853',
      descending: '#f23645',
    },
    dataPattern: 'sparse',
    description: 'Diagonal trendlines connecting fractal points',
  },
  fractal_horizontal: {
    tier: 'FREE',
    columns: [
      'horiz_peak_line_1',
      'horiz_peak_line_2',
      'horiz_peak_line_3',
      'horiz_bottom_line_1',
      'horiz_bottom_line_2',
      'horiz_bottom_line_3',
      'horiz_high_map',
      'horiz_low_map',
    ],
    colors: {
      peak: '#f23645',
      bottom: '#00c853',
    },
    dataPattern: 'sparse',
    description: 'Horizontal support/resistance lines from fractals',
  },
  moving_averages: {
    tier: 'PRO',
    columns: ['tema', 'hrma', 'smma'],
    colors: {
      tema: '#2196f3',
      hrma: '#ff9800',
      smma: '#9c27b0',
    },
    dataPattern: 'continuous',
    description: 'TEMA, HRMA, and SMMA moving averages',
  },
  // ... other 5 PRO indicators
};

// CRITICAL: Backward compatibility
export const BASIC_INDICATORS = FREE_TIER_INDICATORS;
export type IndicatorMeta = IndicatorMetadata;
```

### Layer 4: API Metadata Endpoint

**Location:** `app/api/indicators/route.ts`

**What to update:**

```typescript
/**
 * CRITICAL: This metadata endpoint uses OLD field names
 * for backward compatibility with existing consumers.
 *
 * Database uses NEW 57-column schema names, but this
 * endpoint describes the structure consumers expect.
 */
const INDICATOR_TYPES: IndicatorTypeInfo[] = [
  {
    id: 'FRACTAL_HORIZONTAL', // UPPERCASE for API
    name: 'Fractal Horizontal Lines',
    description:
      'Horizontal support and resistance lines based on fractal patterns. Shows 3 peak levels and 3 bottom levels.',
    source: 'Fractal Horizontal Line_V5.mq5',
    dataFields: [
      'peak_1', // OLD name (not horiz_peak_line_1)
      'peak_2',
      'peak_3',
      'bottom_1', // OLD name (not horiz_bottom_line_1)
      'bottom_2',
      'bottom_3',
    ],
  },
  {
    id: 'FRACTAL_DIAGONAL',
    name: 'Fractal Diagonal Lines',
    description:
      'Diagonal trend lines connecting fractal points. Shows 3 ascending and 3 descending trend lines.',
    source: 'Fractal Diagonal Line_V4.mq5',
    dataFields: [
      'ascending_1', // OLD name (not diag_asc_line_1)
      'ascending_2',
      'ascending_3',
      'descending_1', // OLD name (not diag_desc_line_1)
      'descending_2',
      'descending_3',
    ],
  },
  {
    id: 'FRACTALS',
    name: 'Fractal Points',
    description:
      'Bill Williams fractal markers showing swing highs (peaks) and swing lows (bottoms).',
    source: 'Fractal Horizontal Line_V5.mq5 (buffers 0-1)',
    dataFields: ['peaks', 'bottoms'],
  },
  {
    id: 'OHLC',
    name: 'OHLC Candlestick Data',
    description:
      'Open, High, Low, Close price data with volume for each candle.',
    source: 'MT5 Terminal (CopyRates)',
    dataFields: ['time', 'open', 'high', 'low', 'close', 'volume'],
  },
];

// NOTE: Do NOT add PRO tier indicators here!
// This endpoint describes FREE tier availability only.
```

### Layer 5: Data Fetching Endpoint

**Location:** `app/api/indicators/[symbol]/[timeframe]/route.ts`

**What to update:**

```typescript
/**
 * GET /api/indicators/[symbol]/[timeframe]
 *
 * Returns actual indicator data from PostgreSQL database.
 * Uses NEW 57-column schema names.
 *
 * Response includes 57-column database schema:
 * - System columns (8): timestamp, open, high, low, close, volume, timeframe, collected_at
 * - FREE tier indicators (16 columns): fractal_diagonal (8), fractal_horizontal (8)
 * - PRO tier indicators (33 columns): moving_averages (3), body_momentum (2),
 *   heiken_ashi (7), keltner_channels (10), support_resistance (8), zigzag (3)
 *
 * Tier-based filtering:
 * - FREE tier: Returns 24 columns (8 system + 16 FREE indicators)
 * - PRO tier: Returns 57 columns (8 system + 16 FREE + 33 PRO indicators)
 *
 * @example Response (success - PRO tier):
 * {
 *   "success": true,
 *   "data": {
 *     // System columns
 *     "timestamp": 1705324800,
 *     "open": 43265,
 *     "high": 43300,
 *     "low": 43200,
 *     "close": 43280,
 *     "volume": 1234.56,
 *     "timeframe": "M1",
 *     "collected_at": "2025-01-16T12:00:00Z",
 *
 *     // FREE tier indicators
 *     "diag_asc_line_1": 43250,
 *     "horiz_peak_line_1": 43300,
 *
 *     // PRO tier indicators
 *     "tema": 43260,
 *     "body_size": 0.75,
 *     "ha_open": 43262,
 *     // ... all 57 columns
 *   },
 *   "symbol": "BTCUSD",
 *   "timeframe": "M1"
 * }
 *
 * @example Response (success - FREE tier):
 * {
 *   "success": true,
 *   "data": {
 *     // System columns (8)
 *     "timestamp": 1705324800,
 *     // ...
 *
 *     // FREE tier indicators only (16)
 *     "diag_asc_line_1": 43250,
 *     "horiz_peak_line_1": 43300,
 *     // ... 24 columns total, NO PRO indicators
 *   }
 * }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { symbol: string; timeframe: string } }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const tier = session?.user?.tier || 'FREE';

  // Fetch data from database
  const data = await prisma.marketData.findFirst({
    where: {
      symbol: params.symbol,
      timeframe: params.timeframe,
    },
    select:
      tier === 'PRO'
        ? ALL_57_COLUMNS_SELECT // All columns
        : FREE_TIER_SELECT, // Only 24 columns
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
   - Verify 57 columns defined
   - Verify all columns nullable except system columns
   - Verify IndicatorMeta type alias works

2. **Constants Tests**
   - Verify FREE_TIER_INDICATORS has exactly 2 items
   - Verify PRO_ONLY_INDICATORS has exactly 6 items
   - Verify BASIC_INDICATORS equals FREE_TIER_INDICATORS
   - Verify INDICATOR_METADATA has entries for all 8 indicators
   - Verify column counts: fractal_diagonal=8, fractal_horizontal=8, etc.

3. **API Tests**
   - Verify /api/indicators returns UPPERCASE IDs
   - Verify /api/indicators uses OLD field names
   - Verify /api/indicators only includes FREE tier + OHLC
   - Verify data endpoint returns NEW column names
   - Verify tier-based filtering (24 cols for FREE, 57 for PRO)

4. **Component Tests**
   - Update mock data to include all 57 columns
   - Update label expectations (new indicator names)
   - Verify tier-based rendering

---

## 📚 Examples

### Example 1: Complete Type Definition Update

**Before:**

```typescript
interface IndicatorData {
  fractals?: { peak: number; bottom: number };
  trendlines?: { ascending: number; descending: number };
  momentum_candles?: { value: number };
  tema?: number;
  hrma?: number;
  smma?: number;
}
```

**After:**

```typescript
interface MarketDataRecord {
  // System columns (8)
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timeframe: string;
  collected_at: string;

  // FREE tier indicators (16)
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

  // PRO tier indicators (33)
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
}
```

### Example 2: Test Update

**Before:**

```typescript
it('should contain BASIC_INDICATORS', () => {
  expect(FREE_TIER_INDICATORS).toContain('fractals');
  expect(FREE_TIER_INDICATORS).toContain('trendlines');
});
```

**After:**

```typescript
it('should contain exactly 2 FREE tier indicators', () => {
  expect(FREE_TIER_INDICATORS).toHaveLength(2);
  expect(FREE_TIER_INDICATORS).toContain('fractal_diagonal');
  expect(FREE_TIER_INDICATORS).toContain('fractal_horizontal');
});
```

---

## ✅ Summary

### Key Takeaways

1. **Three Layers:** Database (NEW names) → Data Fetching (NEW names) → Metadata (OLD names)
2. **ID Conventions:** lowercase for TypeScript, UPPERCASE for API
3. **Field Names:** NEW in database/data, OLD in metadata
4. **Tier Access:** 24 columns (FREE) vs 57 columns (PRO)
5. **Backward Compatibility:** Maintain legacy aliases

### Quick Reference

| Aspect            | FREE Tier    | PRO Tier     |
| ----------------- | ------------ | ------------ |
| Total Columns     | 24           | 57           |
| System Columns    | 8            | 8            |
| Indicator Columns | 16           | 49           |
| Indicator Groups  | 2            | 8            |
| API Metadata IDs  | UPPERCASE    | UPPERCASE    |
| TypeScript IDs    | lowercase    | lowercase    |
| Database Names    | NEW (57-col) | NEW (57-col) |
| Metadata Names    | OLD (compat) | OLD (compat) |

---

**Document Version:** 1.0.0
**Last Updated:** 2025-01-16
**Next Review:** After completing all part updates
