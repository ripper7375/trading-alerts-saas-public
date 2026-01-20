# Part 3 & Part 4 Update: Align with 57-Column Database Schema

## Context

Our database schema has been updated from the old Part 20 (14 columns with JSON) to a new **57-column flat schema**. This affects the tier-based data access control system in Part 3 (Types) and Part 4 (Tier System).

**Critical Change:**

- **OLD:** 14 columns with JSON blobs (fractals, trendlines, etc.)
- **NEW:** 57 individual columns with specific tier-based access control

---

## 🎯 Standalone Implementation Note

This update creates **self-contained TypeScript modules** that:

### ✅ What This Update Includes:

- Type definitions (interfaces, types, enums)
- Validation functions (pure logic, no I/O)
- Constants and metadata (static data)
- Unit tests (using mock data)

### ❌ What This Update Does NOT Include:

- Database queries or connections
- Prisma client usage
- API endpoints or HTTP calls
- Integration with NestJS backend
- Redis or message queue code

### 📋 Dependencies:

- TypeScript compiler only
- No external runtime dependencies
- No database required
- No backend services required

### 🎯 Usage After Implementation:

These types and validators will be imported by:

1. Frontend components (immediate use)
2. NestJS backend (when Part 20 is completed)
3. API routes (when Part 20 is completed)
4. Worker services (when Part 20 is completed)

All code in this update is **backend-agnostic** and works standalone.

---

## Your Task

Please thoroughly examine and update **all production files and test files** in Part 3 (Types) and Part 4 (Tier System) to reflect the new 57-column schema and enforce the correct FREE vs PRO data access permissions. You are required to update **all production files and test files** in Part 3 (Types) and Part 4 (Tier System) to reflect the new 57-column schema and enforce the correct FREE vs PRO data access permissions in NextJs backend (Not NestJs for now as I will later convert NextJs backend to NestJs backend later for Part 3 and Part 4 code)

---

## Files to Update

### Part 3: Type Definitions (types/)

**Production Files:**

1. `types/index.ts` - Main type exports
2. `types/tier.ts` - Tier types and constants
3. `types/user.ts` - User types
4. `types/alert.ts` - Alert types
5. `types/indicator.ts` - **CRITICAL** - Indicator types (needs major update)
6. `types/api.ts` - API response types

**Test Files (if they exist):**

- `types/__tests__/tier.test.ts`
- `types/__tests__/indicator.test.ts`
- Any other test files in `types/`

### Part 4: Tier System (lib/)

**Production Files:**

1. `lib/tier-config.ts` - Core tier configuration
2. `lib/tier-validation.ts` - Access validation functions
3. `lib/tier-helpers.ts` - Helper utilities
4. `lib/tier/constants.ts` - **CRITICAL** - Indicator constants (needs major update)
5. `lib/tier/validator.ts` - Indicator access control
6. `lib/tier/index.ts` - Module exports

**Test Files (if they exist):**

- `lib/__tests__/tier-config.test.ts`
- `lib/__tests__/tier-validation.test.ts`
- `lib/__tests__/tier-helpers.test.ts`
- `lib/tier/__tests__/constants.test.ts`
- `lib/tier/__tests__/validator.test.ts`
- Any other test files in `lib/` related to tier system

---

## New Data Access Rules (57 Columns)

### FREE Tier Access (24 columns):

**System Columns (8):**

- `timestamp` (BIGINT)
- `open` (DECIMAL)
- `high` (DECIMAL)
- `low` (DECIMAL)
- `close` (DECIMAL)
- `volume` (INTEGER)
- `timeframe` (VARCHAR)
- `collected_at` (BIGINT)

**Indicator #3: Fractal Diagonal Lines (8):**

- `diag_asc_line_1`, `diag_asc_line_2`, `diag_asc_line_3`
- `diag_desc_line_1`, `diag_desc_line_2`, `diag_desc_line_3`
- `diag_high_map`, `diag_low_map`

**Indicator #4: Fractal Horizontal Lines (8):**

- `horiz_peak_line_1`, `horiz_peak_line_2`, `horiz_peak_line_3`
- `horiz_bottom_line_1`, `horiz_bottom_line_2`, `horiz_bottom_line_3`
- `horiz_high_map`, `horiz_low_map`

---

### PRO Only Access (33 additional columns):

**Indicator #1: TEMA_HRMA_SMA-SMMA (3):**

- `tema` (DECIMAL)
- `hrma` (DECIMAL)
- `smma` (DECIMAL)

**Indicator #2: Body Size Momentum (2):**

- `z_score_of_body_size` (DECIMAL) - Note: actual column name has hyphens
- `candle_classification` (INTEGER)

**Indicator #5: Heiken Ashi (7):**

- `ha_open`, `ha_high`, `ha_low`, `ha_close` (DECIMAL)
- `ha_classification` (INTEGER)
- `ha_body_size`, `ha_body_zscore` (DECIMAL)

**Indicator #6: Keltner Channel (10):**

- `kc_ultra_extreme_upper`, `kc_extreme_upper`, `kc_uppermost`, `kc_upper`, `kc_upper_middle`
- `kc_lower_middle`, `kc_lower`, `kc_lowermost`, `kc_extreme_lower`, `kc_ultra_extreme_lower`

**Indicator #7: Support & Resistance (8):**

- `sr_support_1`, `sr_support_2`, `sr_support_3`, `sr_support_4`
- `sr_resistance_1`, `sr_resistance_2`, `sr_resistance_3`, `sr_resistance_4`

**Indicator #8: ZigZag + EMA (3):**

- `zigzag_peak` (DECIMAL)
- `zigzag_bottom` (DECIMAL)
- `ema_26` (DECIMAL)

---

## Required Changes

### 1. Update Indicator Constants (`lib/tier/constants.ts`)

**OLD (incorrect):**

```typescript
export const PRO_ONLY_INDICATORS = [
  'momentum_candles',
  'keltner_channels',
  'tema',
  'hrma',
  'smma',
  'zigzag',
] as const;

export const BASIC_INDICATORS = ['fractals', 'trendlines'] as const;
```

**NEW (correct - must match 57-column schema):**

```typescript
// FREE tier indicators (2 groups)
export const FREE_TIER_INDICATORS = [
  'fractal_diagonal', // 8 columns: diag_asc_line_1-3, diag_desc_line_1-3, diag_high/low_map
  'fractal_horizontal', // 8 columns: horiz_peak_line_1-3, horiz_bottom_line_1-3, horiz_high/low_map
] as const;

// PRO only indicators (6 groups)
export const PRO_ONLY_INDICATORS = [
  'moving_averages', // 3 columns: tema, hrma, smma
  'body_momentum', // 2 columns: z_score_of_body_size, candle_classification
  'heiken_ashi', // 7 columns: ha_open, ha_high, ha_low, ha_close, ha_classification, ha_body_size, ha_body_zscore
  'keltner_channels', // 10 columns: kc_ultra_extreme_upper → kc_ultra_extreme_lower
  'support_resistance', // 8 columns: sr_support_1-4, sr_resistance_1-4
  'zigzag', // 3 columns: zigzag_peak, zigzag_bottom, ema_26
] as const;

export const ALL_INDICATORS = [
  ...FREE_TIER_INDICATORS,
  ...PRO_ONLY_INDICATORS,
] as const;

export type FreeTierIndicator = (typeof FREE_TIER_INDICATORS)[number];
export type ProOnlyIndicator = (typeof PRO_ONLY_INDICATORS)[number];
export type IndicatorId = (typeof ALL_INDICATORS)[number];
```

### 2. Update Indicator Metadata

Add metadata for each indicator group with:

- **label**: Display name
- **description**: What it does
- **category**: Type of indicator
- **tier**: 'FREE' | 'PRO'
- **columns**: Array of database column names
- **colors**: Color scheme for visualization

**Example:**

```typescript
export const INDICATOR_METADATA: Record<IndicatorId, IndicatorMetadata> = {
  fractal_diagonal: {
    id: 'fractal_diagonal',
    label: 'Fractal Diagonal Lines',
    description: 'Dynamic trendlines based on fractal analysis',
    category: 'trendlines',
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
  },

  fractal_horizontal: {
    id: 'fractal_horizontal',
    label: 'Fractal Horizontal Lines',
    description: 'Horizontal support and resistance levels from fractals',
    category: 'support_resistance',
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
      peaks: '#f23645',
      bottoms: '#00c853',
    },
  },

  moving_averages: {
    id: 'moving_averages',
    label: 'Moving Averages (TEMA/HRMA/SMMA)',
    description: 'Triple exponential, hull-like, and smoothed moving averages',
    category: 'trend',
    tier: 'PRO',
    columns: ['tema', 'hrma', 'smma'],
    colors: {
      tema: '#808080',
      hrma: '#00CED1',
      smma: '#0000FF',
    },
  },

  body_momentum: {
    id: 'body_momentum',
    label: 'Body Size Momentum',
    description: 'Candle body size analysis with Z-score classification',
    category: 'momentum',
    tier: 'PRO',
    columns: ['z_score_of_body_size', 'candle_classification'],
    colors: {
      up_normal: '#90ee90',
      up_large: '#00c853',
      up_extreme: '#2e7d32',
      down_normal: '#ffcdd2',
      down_large: '#f23645',
      down_extreme: '#c62828',
    },
  },

  heiken_ashi: {
    id: 'heiken_ashi',
    label: 'Heiken Ashi',
    description: 'Smoothed candlesticks with body size classification',
    category: 'candlesticks',
    tier: 'PRO',
    columns: [
      'ha_open',
      'ha_high',
      'ha_low',
      'ha_close',
      'ha_classification',
      'ha_body_size',
      'ha_body_zscore',
    ],
    colors: {
      bullish: '#00c853',
      bearish: '#f23645',
    },
  },

  keltner_channels: {
    id: 'keltner_channels',
    label: 'Keltner Channels',
    description: '10-band volatility channel system',
    category: 'volatility',
    tier: 'PRO',
    columns: [
      'kc_ultra_extreme_upper',
      'kc_extreme_upper',
      'kc_uppermost',
      'kc_upper',
      'kc_upper_middle',
      'kc_lower_middle',
      'kc_lower',
      'kc_lowermost',
      'kc_extreme_lower',
      'kc_ultra_extreme_lower',
    ],
    colors: {
      ultra_extreme: '#9c27b0',
      extreme: '#ff5722',
      uppermost: '#ff9800',
      upper: '#2196f3',
      middle: '#808080',
    },
  },

  support_resistance: {
    id: 'support_resistance',
    label: 'Support & Resistance',
    description: 'Fractal-based support and resistance levels',
    category: 'support_resistance',
    tier: 'PRO',
    columns: [
      'sr_support_1',
      'sr_support_2',
      'sr_support_3',
      'sr_support_4',
      'sr_resistance_1',
      'sr_resistance_2',
      'sr_resistance_3',
      'sr_resistance_4',
    ],
    colors: {
      support: '#00c853',
      resistance: '#f23645',
    },
  },

  zigzag: {
    id: 'zigzag',
    label: 'ZigZag + EMA',
    description: 'Market structure with swing highs/lows and EMA trend',
    category: 'trend',
    tier: 'PRO',
    columns: ['zigzag_peak', 'zigzag_bottom', 'ema_26'],
    colors: {
      peaks: '#f23645',
      bottoms: '#00c853',
      ema: '#ffa726',
    },
  },
};
```

### 3. Update Validation Functions

Update all validation functions to check column-level access:

```typescript
// lib/tier/validator.ts

/**
 * Check if user's tier can access a specific database column
 */
export function canAccessColumn(tier: Tier, columnName: string): boolean {
  // System columns: Always accessible (FREE + PRO)
  const systemColumns = [
    'timestamp',
    'open',
    'high',
    'low',
    'close',
    'volume',
    'timeframe',
    'collected_at',
  ];

  if (systemColumns.includes(columnName)) {
    return true;
  }

  // FREE tier: Fractal diagonal + horizontal columns
  const freeTierColumns = [
    'diag_asc_line_1',
    'diag_asc_line_2',
    'diag_asc_line_3',
    'diag_desc_line_1',
    'diag_desc_line_2',
    'diag_desc_line_3',
    'diag_high_map',
    'diag_low_map',
    'horiz_peak_line_1',
    'horiz_peak_line_2',
    'horiz_peak_line_3',
    'horiz_bottom_line_1',
    'horiz_bottom_line_2',
    'horiz_bottom_line_3',
    'horiz_high_map',
    'horiz_low_map',
  ];

  if (tier === 'FREE' && freeTierColumns.includes(columnName)) {
    return true;
  }

  // PRO tier: All columns
  if (tier === 'PRO') {
    return true;
  }

  return false;
}

/**
 * Get list of accessible columns for a tier
 */
export function getAccessibleColumns(tier: Tier): string[] {
  const systemColumns = [
    'timestamp',
    'open',
    'high',
    'low',
    'close',
    'volume',
    'timeframe',
    'collected_at',
  ];

  const freeTierIndicatorColumns = [
    'diag_asc_line_1',
    'diag_asc_line_2',
    'diag_asc_line_3',
    'diag_desc_line_1',
    'diag_desc_line_2',
    'diag_desc_line_3',
    'diag_high_map',
    'diag_low_map',
    'horiz_peak_line_1',
    'horiz_peak_line_2',
    'horiz_peak_line_3',
    'horiz_bottom_line_1',
    'horiz_bottom_line_2',
    'horiz_bottom_line_3',
    'horiz_high_map',
    'horiz_low_map',
  ];

  const proOnlyColumns = [
    // Moving Averages
    'tema',
    'hrma',
    'smma',
    // Body Momentum
    'z_score_of_body_size',
    'candle_classification',
    // Heiken Ashi
    'ha_open',
    'ha_high',
    'ha_low',
    'ha_close',
    'ha_classification',
    'ha_body_size',
    'ha_body_zscore',
    // Keltner Channels
    'kc_ultra_extreme_upper',
    'kc_extreme_upper',
    'kc_uppermost',
    'kc_upper',
    'kc_upper_middle',
    'kc_lower_middle',
    'kc_lower',
    'kc_lowermost',
    'kc_extreme_lower',
    'kc_ultra_extreme_lower',
    // Support/Resistance
    'sr_support_1',
    'sr_support_2',
    'sr_support_3',
    'sr_support_4',
    'sr_resistance_1',
    'sr_resistance_2',
    'sr_resistance_3',
    'sr_resistance_4',
    // ZigZag
    'zigzag_peak',
    'zigzag_bottom',
    'ema_26',
  ];

  if (tier === 'FREE') {
    return [...systemColumns, ...freeTierIndicatorColumns];
  }

  // PRO tier gets everything
  return [...systemColumns, ...freeTierIndicatorColumns, ...proOnlyColumns];
}

/**
 * Filter API response data based on user's tier
 * Removes columns the user doesn't have access to
 */
export function filterDataByTier<T extends Record<string, any>>(
  tier: Tier,
  data: T
): Partial<T> {
  const accessibleColumns = getAccessibleColumns(tier);
  const filtered: Partial<T> = {};

  for (const [key, value] of Object.entries(data)) {
    if (accessibleColumns.includes(key)) {
      (filtered as any)[key] = value;
    }
  }

  return filtered;
}
```

### 4. Update Type Definitions

Update `types/indicator.ts` to reflect the new structure:

```typescript
// types/indicator.ts

/**
 * System columns - accessible by FREE + PRO
 */
export interface SystemColumns {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  timeframe: string;
  collected_at: number | null;
}

/**
 * FREE tier indicators
 */
export interface FractalDiagonalData {
  diag_asc_line_1: number | null;
  diag_asc_line_2: number | null;
  diag_asc_line_3: number | null;
  diag_desc_line_1: number | null;
  diag_desc_line_2: number | null;
  diag_desc_line_3: number | null;
  diag_high_map: number | null;
  diag_low_map: number | null;
}

export interface FractalHorizontalData {
  horiz_peak_line_1: number | null;
  horiz_peak_line_2: number | null;
  horiz_peak_line_3: number | null;
  horiz_bottom_line_1: number | null;
  horiz_bottom_line_2: number | null;
  horiz_bottom_line_3: number | null;
  horiz_high_map: number | null;
  horiz_low_map: number | null;
}

/**
 * PRO only indicators
 */
export interface MovingAveragesData {
  tema: number | null;
  hrma: number | null;
  smma: number | null;
}

export interface BodyMomentumData {
  z_score_of_body_size: number | null;
  candle_classification: number | null;
}

export interface HeikenAshiData {
  ha_open: number | null;
  ha_high: number | null;
  ha_low: number | null;
  ha_close: number | null;
  ha_classification: number | null;
  ha_body_size: number | null;
  ha_body_zscore: number | null;
}

export interface KeltnerChannelsData {
  kc_ultra_extreme_upper: number | null;
  kc_extreme_upper: number | null;
  kc_uppermost: number | null;
  kc_upper: number | null;
  kc_upper_middle: number | null;
  kc_lower_middle: number | null;
  kc_lower: number | null;
  kc_lowermost: number | null;
  kc_extreme_lower: number | null;
  kc_ultra_extreme_lower: number | null;
}

export interface SupportResistanceData {
  sr_support_1: number | null;
  sr_support_2: number | null;
  sr_support_3: number | null;
  sr_support_4: number | null;
  sr_resistance_1: number | null;
  sr_resistance_2: number | null;
  sr_resistance_3: number | null;
  sr_resistance_4: number | null;
}

export interface ZigZagData {
  zigzag_peak: number | null;
  zigzag_bottom: number | null;
  ema_26: number | null;
}

/**
 * Complete market data (all 57 columns) - PRO tier
 */
export interface CompleteMarketData
  extends SystemColumns,
    FractalDiagonalData,
    FractalHorizontalData,
    MovingAveragesData,
    BodyMomentumData,
    HeikenAshiData,
    KeltnerChannelsData,
    SupportResistanceData,
    ZigZagData {}

/**
 * FREE tier data (24 columns)
 */
export interface FreeMarketData
  extends SystemColumns,
    FractalDiagonalData,
    FractalHorizontalData {}
```

### 5. Update API Types

Update `types/api.ts` to include tier-aware response types:

```typescript
// types/api.ts

import type { Tier } from './tier';
import type { CompleteMarketData, FreeMarketData } from './indicator';

/**
 * Market data response - automatically filtered by user's tier
 */
export interface MarketDataResponse {
  symbol: string;
  timeframe: string;
  tier: Tier;
  data: CompleteMarketData | FreeMarketData; // Type depends on tier
  filteredColumns?: string[]; // Which columns were removed (for FREE tier)
}

/**
 * Indicator access info
 */
export interface IndicatorAccessInfo {
  indicator: string;
  accessible: boolean;
  tier: Tier;
  requiredTier?: Tier;
  columns: string[];
  description: string;
}
```

### 6. Update Tests

Create or update test files to verify:

1. **Column access validation:**

```typescript
describe('Column Access Validation', () => {
  it('FREE tier can access system columns', () => {
    expect(canAccessColumn('FREE', 'timestamp')).toBe(true);
    expect(canAccessColumn('FREE', 'open')).toBe(true);
    expect(canAccessColumn('FREE', 'close')).toBe(true);
  });

  it('FREE tier can access fractal columns', () => {
    expect(canAccessColumn('FREE', 'diag_asc_line_1')).toBe(true);
    expect(canAccessColumn('FREE', 'horiz_peak_line_1')).toBe(true);
  });

  it('FREE tier CANNOT access PRO-only columns', () => {
    expect(canAccessColumn('FREE', 'tema')).toBe(false);
    expect(canAccessColumn('FREE', 'kc_upper')).toBe(false);
    expect(canAccessColumn('FREE', 'zigzag_peak')).toBe(false);
  });

  it('PRO tier can access all columns', () => {
    expect(canAccessColumn('PRO', 'tema')).toBe(true);
    expect(canAccessColumn('PRO', 'kc_upper')).toBe(true);
    expect(canAccessColumn('PRO', 'zigzag_peak')).toBe(true);
  });
});
```

2. **Indicator metadata:**

```typescript
describe('Indicator Metadata', () => {
  it('FREE tier indicators have correct tier', () => {
    expect(INDICATOR_METADATA.fractal_diagonal.tier).toBe('FREE');
    expect(INDICATOR_METADATA.fractal_horizontal.tier).toBe('FREE');
  });

  it('PRO tier indicators have correct tier', () => {
    expect(INDICATOR_METADATA.moving_averages.tier).toBe('PRO');
    expect(INDICATOR_METADATA.keltner_channels.tier).toBe('PRO');
  });

  it('Each indicator has correct column count', () => {
    expect(INDICATOR_METADATA.fractal_diagonal.columns).toHaveLength(8);
    expect(INDICATOR_METADATA.moving_averages.columns).toHaveLength(3);
    expect(INDICATOR_METADATA.keltner_channels.columns).toHaveLength(10);
  });
});
```

3. **Data filtering:**

```typescript
describe('Data Filtering by Tier', () => {
  const mockData: CompleteMarketData = {
    timestamp: 1705324800,
    open: 43250,
    high: 43280,
    low: 43240,
    close: 43265,
    volume: 1250,
    timeframe: 'H1',
    collected_at: 1705324805,
    // Fractal diagonal (FREE)
    diag_asc_line_1: 43200,
    diag_asc_line_2: null,
    diag_asc_line_3: null,
    // ... other FREE columns
    // PRO only
    tema: 43260,
    hrma: 43258,
    kc_upper: 43300,
    // ... other PRO columns
  };

  it('FREE tier gets only accessible columns', () => {
    const filtered = filterDataByTier('FREE', mockData);

    expect(filtered.timestamp).toBeDefined();
    expect(filtered.diag_asc_line_1).toBeDefined();
    expect(filtered.tema).toBeUndefined(); // PRO only
    expect(filtered.kc_upper).toBeUndefined(); // PRO only
  });

  it('PRO tier gets all columns', () => {
    const filtered = filterDataByTier('PRO', mockData);

    expect(filtered.timestamp).toBeDefined();
    expect(filtered.tema).toBeDefined();
    expect(filtered.kc_upper).toBeDefined();
  });
});
```

---

## Success Criteria

After your updates, the system should:

1. ✅ **Accurately reflect 57-column schema** in all type definitions
2. ✅ **Enforce FREE tier access** to 24 columns (8 system + 16 fractal)
3. ✅ **Enforce PRO tier access** to all 57 columns
4. ✅ **Provide column-level validation** functions
5. ✅ **Include indicator metadata** with column mappings
6. ✅ **Pass all tests** (create new tests if needed)
7. ✅ **Type-safe** - TypeScript compilation without errors
8. ✅ **Backwards compatible** - Don't break existing code that uses these types

---

## Important Notes

### Column Name Special Cases

Some columns have special characters in the database:

- `z_score_of_body_size` - TypeScript: `z_score_of_body_size`
- `Z-Score of body size` - Database: actual column name with hyphens
- `candle_classification` - TypeScript: `candle_classification`
- `Candle classification` - Database: actual column name with space

Make sure to handle these correctly with Prisma `@map()` if needed.

### NULL Values

Most indicator columns are nullable. This is intentional:

- **Sparse indicators** (fractals, S/R, zigzag): 5-30% of bars have values
- **Continuous indicators** (TEMA, Keltner): Values on every bar

Types should reflect this: `number | null`

### Tier Migration

When a user upgrades from FREE → PRO:

- They gain access to 33 additional columns immediately
- Historical data queries should include newly accessible columns
- Frontend should refresh to show new indicators

---

## Verification Steps

After making changes, please verify:

1. **Run TypeScript compilation:**

   ```bash
   npm run type-check
   # or
   tsc --noEmit
   ```

2. **Run tests:**

   ```bash
   npm test types/
   npm test lib/tier
   ```

3. **Check for breaking changes:**
   - Are existing API response types still valid?
   - Do existing components need updates?
   - Is the tier system consistent across all files?

4. **Verify column counts:**
   - FREE tier: 24 columns total (8 system + 16 indicators)
   - PRO tier: 57 columns total (8 system + 49 indicators)

5. **Test validation functions:**
   ```typescript
   // Should all be true
   console.assert(getAccessibleColumns('FREE').length === 24);
   console.assert(getAccessibleColumns('PRO').length === 57);
   console.assert(canAccessIndicator('FREE', 'fractal_diagonal') === true);
   console.assert(canAccessIndicator('FREE', 'moving_averages') === false);
   console.assert(canAccessIndicator('PRO', 'moving_averages') === true);
   ```

---

## Questions to Consider

While updating, please think about:

1. **Should we create helper functions** to get column names by indicator group?

   ```typescript
   getIndicatorColumns('moving_averages'); // returns ['tema', 'hrma', 'smma']
   ```

2. **Should we add a function** to get indicator by column name?

   ```typescript
   getIndicatorByColumn('tema'); // returns 'moving_averages'
   ```

3. **Should we validate** column names against the actual database schema?

   ```typescript
   isValidColumnName('tema'); // returns true
   isValidColumnName('invalid_col'); // returns false
   ```

4. **Should we create utility types** for partial data access?
   ```typescript
   type FreeTierData = Pick<CompleteMarketData, FreeAccessibleColumns>;
   ```

---

## Summary

This is a **critical update** that affects data access control throughout the application. Please:

1. **Thoroughly examine** all 12 files listed above
2. **Update production code** to reflect 57-column schema
3. **Update or create tests** to verify correct behavior
4. **Maintain type safety** throughout
5. **Document breaking changes** (if any)
6. **Ensure backwards compatibility** where possible

The goal is to have a **rock-solid tier system** that correctly enforces data access permissions based on the new 57-column database schema.

Thank you! 🚀
