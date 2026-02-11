# Indicator Schema Update Checklist

**Purpose:** Step-by-step guide for updating all codebase files when MarketData indicator columns are added, renamed, or removed.

**Last Updated:** 2026-02-11
**Schema Version:** 60-Column (EA v2.26+)
**Applies to Branch:** Any feature branch off `main`

---

## Current Schema Summary

```
MarketData = 8 system + 16 FREE indicator + 36 PRO indicator = 60 total columns

System (8):       timestamp, open, high, low, close, volume, timeframe, collected_at
FREE (16):        fractal_diagonal (8) + fractal_horizontal (8)
PRO (36):
  Group 1  moving_averages     3 cols:  tema, hrma, smma
  Group 2  body_momentum       2 cols:  body_size, body_direction
  Group 3  heiken_ashi         7 cols:  ha_open, ha_high, ha_low, ha_close, ha_color, ha_trend, ha_strength
  Group 4  keltner_channels   10 cols:  kc_upper, kc_middle, kc_lower,
                                        kc_upper_ema, kc_middle_ema, kc_lower_ema,
                                        kc_squeeze, kc_squeeze_pro, kc_width, kc_width_ema
  Group 5  support_resistance  8 cols:  sr_1, sr_2, sr_3, sr_4, sr_5, sr_6, sr_7, sr_8
  Group 6  zigzag              3 cols:  zigzag_high, zigzag_low, zigzag_trend
  Group 7  dual_tema_hl        2 cols:  dual_tema_high, dual_tema_low
  Group 8  pinbar_detection    1 col:   pinbar
```

---

## ⚠️ Critical Architecture Notes

### Two Separate Keltner Channel Type Systems

The codebase has **two distinct** Keltner Channel representations that must NOT be confused:

| Constant / Interface                            | Location                | Keys                                                                                                                                                          | Used By                                                        |
| ----------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `KeltnerChannelData`                            | `types/indicator.ts`    | camelCase: `ultraExtremeUpper`, `extremeUpper`, `upperMost`, `upper`, `upperMiddle`, `lowerMiddle`, `lower`, `lowerMost`, `extremeLower`, `ultraExtremeLower` | Chart rendering: `components/charts/pro-indicator-overlay.tsx` |
| `KeltnerChannelsData`                           | `types/indicator.ts`    | snake_case DB columns: `kc_upper`, `kc_middle`, `kc_lower`, ...                                                                                               | DB schema, tier system, hooks, tests                           |
| `KELTNER_COLORS`                                | `lib/tier/constants.ts` | Must match `KeltnerChannelData` camelCase keys                                                                                                                | Chart rendering only                                           |
| `INDICATOR_METADATA.keltner_channels.columns[]` | `lib/tier/constants.ts` | Must use DB snake_case column names                                                                                                                           | Tier validation, column counts                                 |

**Rule:** When renaming Keltner DB columns, update `KeltnerChannelsData` and `INDICATOR_METADATA.keltner_channels.columns[]`. Do **NOT** change `KELTNER_COLORS` or `KeltnerChannelData` — those are MT5 chart format and are independent of the DB schema.

---

## File Update Checklist

Work through each layer in order. Each layer depends on the one above it.

---

### Layer 1 — Database Schema (Source of Truth)

#### `prisma/schema.prisma`

- [ ] Add/rename/remove columns in the `MarketData` model
- [ ] Update the model docstring: `/// Structure: 8 system + 16 FREE tier + N PRO tier = N total columns`
- [ ] Update section header comment: `// MARKET DATA (60-COLUMN SCHEMA)`
- [ ] Verify column type (`Float`, `Int`, etc.) and nullability (`?`)

**What to change per operation:**
| Operation | Change |
|---|---|
| Add column | Add `fieldName ColumnType?` line in correct group section |
| Rename column | Change field name; add `@map("old_name")` if keeping DB column name, or create new migration |
| Remove column | Delete the field line |
| Add group | Add new comment block `// Group N — GroupName` + all fields |

---

#### `prisma/migrations/[timestamp]_init/migration.sql`

- [ ] Add column to `CREATE TABLE "MarketData"` block (for new columns)
- [ ] For renames: add `ALTER TABLE "MarketData" RENAME COLUMN "old" TO "new";`
- [ ] For removes: add `ALTER TABLE "MarketData" DROP COLUMN "col_name";`
- [ ] Verify all indexes still cover correct columns

---

### Layer 2 — Database Client & Seed

#### `lib/db/prisma.ts`

- [ ] Update JSDoc listing of indicator groups and column counts
- [ ] No logic changes required — client is auto-generated from schema

#### `lib/db/seed.ts` and `prisma/seed.ts`

- [ ] Update JSDoc header: `Schema: 60-column MarketData flat schema`
- [ ] If seed inserts sample MarketData rows: update field names in `prisma.marketData.create({ data: {...} })`
- [ ] Update any hardcoded column name strings in seed data

---

### Layer 3 — OpenAPI Specification

#### `docs/open-api-documents/part-02-database-schema-openapi.yaml`

- [ ] Add/rename/remove property under `components.schemas.MarketData.properties`
- [ ] Update description block: column counts, group listings
- [ ] Verify `required:` array is consistent with non-nullable columns
- [ ] Update `example:` values if column is included in examples

---

#### `docs/open-api-documents/part-03-types-openapi.yaml`

**Info description block:**

- [ ] Update `## V7 Architecture` line: `60-Column Database: 8 system + 16 FREE + N PRO indicator columns`
- [ ] Update `4. **Indicator Types**` bullet: `60-column database schema types`

**`CompleteMarketData` schema** (inline `allOf` properties block):

- [ ] Add/rename/remove properties for changed columns
- [ ] Update comment `# PRO tier indicators (N additional columns)`
- [ ] Update description: `PRO tier complete market data (N columns): ... N PRO tier indicator columns`

**`MarketDataResponse` schema:**

- [ ] Update `columnCount` description: `Number of columns (24 for FREE, N for PRO)`

---

#### `docs/open-api-documents/part-04-tier-system-openapi.yaml`

**Info description block:**

- [ ] Update `Technical indicators (2 for FREE, N for PRO)` in Overview bullet
- [ ] Update PRO Tier Specifications: `Indicators: N (all FREE + N PRO-only)`, `Indicator Columns: N columns`, `Total Columns: N (8 system + N indicator)`
- [ ] Update `## N-Column Database Schema` section header
- [ ] Update `### PRO-Only Indicators (N columns)` count
- [ ] Update column name listings for renamed groups
- [ ] Add/remove group entries (with column count and names)

**`IndicatorId` enum:**

- [ ] Add new group id: `- new_group_id`
- [ ] Remove deleted group id
- [ ] Update comment: `# PRO-only indicators (N)`

---

#### `docs/open-api-documents/part-08-dashboard-layout-openapi.yaml`

**Info description block:**

- [ ] Update feature bullet: `N-Column MarketData Integration`
- [ ] Update migration section: `N-column MarketData schema`, `PRO: all N columns`, `N advanced indicator groups`

**`/dashboard/charts/{symbol}/{timeframe}` path description:**

- [ ] Update: `N-column MarketData`, `PRO users: N columns (all indicators)`

**`MarketData` schema:**

- [ ] Update section comment: `# MarketData Schema (N Columns)`
- [ ] Update description: `N columns`, `PRO tier indicators (N)`, `PRO users: All N columns`
- [ ] Add/rename/remove properties for changed columns (with group comment and description)
- [ ] Add new groups as new comment blocks with their properties

---

#### `docs/open-api-documents/part-09-charts-visualization-openapi.yaml`

**Info description block:**

- [ ] Update `## Database Schema: N-Column Flat Schema` section header
- [ ] Update all group column listings under PRO Tier Indicators
- [ ] Add/remove groups with full column list, colors, and data pattern
- [ ] Update `### PRO Tier Indicators (N columns - N groups)` header
- [ ] Update `**Total Columns:**` block: `PRO Tier: 8 system + N indicator = N columns`
- [ ] Update `### PRO-Only Indicators (N groups)` in Indicator Groups section
- [ ] Add/remove group entries in that listing
- [ ] Update PRO Tier-Based Features: `Indicators: N groups`, `Database Access: N columns`
- [ ] Update Implementation Note 4: `NEW N-column flat schema`

**`IndicatorId` enum:**

- [ ] Update description: `N total groups`
- [ ] Add/remove group ids; update `# PRO Tier (N groups)` comment

**Column data schemas (`BodyMomentumData`, `HeikenAshiData`, `KeltnerChannelsData`, `SupportResistanceData`, `ZigZagColumns`):**

- [ ] Add/rename/remove properties for each affected group

**New group schemas (when adding a new indicator group):**

- [ ] Add new schema block, e.g.:
  ```yaml
  NewGroupData:
    type: object
    description: PRO tier indicator - New Group (N columns)
    properties:
      col_1:
        type: number
        nullable: true
        description: Description
  ```

**`CompleteMarketData` schema:**

- [ ] Add `$ref: '#/components/schemas/NewGroupData'` to `allOf`
- [ ] Remove deleted group ref
- [ ] Update description: `PRO tier market data (N columns total)`

**`ProTierConfig` schema:**

- [ ] Add new group id to `indicators: example: [...]`
- [ ] Update `databaseColumns: example: N`

**`IndicatorMetadata` example columns:**

- [ ] Update `example: ['kc_upper', ...]` if keltner_channels columns changed

---

### Layer 4 — TypeScript Types

#### `types/indicator.ts`

**Section: `IndicatorType` union (top of file)**

- [ ] Add new indicator group id: `| 'new_group_name'`
- [ ] Remove deleted group id from union

**Section: `NEW 60-COLUMN DATABASE SCHEMA TYPES` (mid-file)**

For renamed columns within an existing group:

- [ ] Find the group's interface (e.g., `BodyMomentumData`, `HeikenAshiData`)
- [ ] Rename the field(s) to match new DB column names

For a new indicator group:

- [ ] Add new interface:
  ```typescript
  export interface NewGroupData {
    new_col_1: number | null;
    new_col_2: number | null;
  }
  ```

For a removed group:

- [ ] Delete the group's interface

**Section: `CompleteMarketData` interface**

- [ ] Extend with new interface: `extends ... NewGroupData ...`
- [ ] Remove deleted interface from `extends` list
- [ ] Update docstring column count: `all 60 columns`

**Section: `FreeMarketData` interface** (if FREE tier group added/removed)

- [ ] Add/remove from `extends` list

> **Do NOT change:** `KeltnerChannelData` (camelCase, MT5 chart format) or `MT5ProIndicators` — these are not DB schema types.

---

#### `types/prisma-stubs.d.ts`

This file is the Prisma client fallback for environments where Prisma cannot generate the client.

**`MarketData` interface** (inside `declare module '@prisma/client'`):

- [ ] Add new field: `new_col: number | null;`
- [ ] Rename field to match DB column name
- [ ] Remove deleted field
- [ ] Update group comment block counts

**`PrismaClient` class** (if `MarketData` model is brand new — only once):

- [ ] Add: `marketData: ModelDelegate<MarketData>;`

**`Prisma` namespace** (if `MarketData` model is brand new — only once):

- [ ] Add:
  ```typescript
  export type MarketDataWhereInput = Record<string, unknown>;
  export type MarketDataCreateInput = Record<string, unknown>;
  export type MarketDataUpdateInput = Record<string, unknown>;
  ```

---

### Layer 5 — Tier System

#### `lib/tier/constants.ts`

**File header docstring:**

- [ ] Update PRO indicator count: `PRO Indicators (36 columns): ...`
- [ ] Add/remove group from the listing

**`PRO_ONLY_INDICATORS` array:**

- [ ] Add new group id: `'new_group',  // N columns: col_1, col_2`
- [ ] Remove deleted group id
- [ ] Update inline comment with column names

**`ALL_INDICATORS` docstring:**

- [ ] Update: `X groups, Y indicator columns` / `Z total columns`

**`INDICATOR_METADATA` object:**

- [ ] For new group — add full entry:
  ```typescript
  new_group: {
    id: 'new_group',
    label: 'Display Name',
    description: 'Short description',
    category: 'trend' | 'momentum' | 'candlesticks' | 'volatility' | 'support_resistance' | 'trendlines',
    tier: 'PRO',
    columns: ['col_1', 'col_2'],
    colors: { key: '#hexcolor' },
    dataPattern: 'continuous' | 'sparse',
  },
  ```
- [ ] For renamed columns — update `columns: [...]` array with new names
- [ ] For removed group — delete the entire entry
- [ ] Update section header comment: `// PRO TIER INDICATORS (N groups)`

**`getTierColumnCount` docstring:**

- [ ] Update: `PRO: 8 system + N indicator = N total columns`
- [ ] Update inline comment: `// 8 + N = N`

**`isValidColumnName` docstring:**

- [ ] Update: `60-column schema` (or new total)

> **Do NOT change:** `KELTNER_COLORS` object — its keys must stay as camelCase to match `KeltnerChannelData` (MT5 chart format). See Architecture Notes above.

---

#### `lib/tier/validator.ts`

- [ ] Update file header JSDoc: `60-Column Schema` → new total if changed
- [ ] Update comment: `PRO tier: 60 columns (8 system + 52 indicators)` → new counts
- [ ] No logic changes required — validator derives everything from `constants.ts`

---

#### `lib/tier-validation.ts`

**`TIER_LIMITS` docstring:**

- [ ] Update: `all 10 indicators (52 columns)` → new counts

**`TIER_LIMITS.PRO.indicators` array:**

- [ ] Add new group id: `'new_group',`
- [ ] Remove deleted group id

**`validateFullTierAccess` error message:**

- [ ] Update: `all 10 indicators` → new total count

---

### Layer 6 — React Hook

#### `hooks/use-indicators.ts`

**Section header:**

- [ ] Update: `60-COLUMN SCHEMA DATA STRUCTURES` → new total if column count changes

**For renamed columns in an existing group interface:**

- [ ] Find the group interface (e.g., `BodyMomentumData`, `KeltnerChannelsData`)
- [ ] Rename the field(s)

**For a new indicator group:**

- [ ] Add new interface:
  ```typescript
  interface NewGroupData {
    col_1: number | null;
    col_2: number | null;
  }
  ```
- [ ] Add optional field to `MarketDataRow`:
  ```typescript
  new_group?: NewGroupData;
  ```

**For a removed group:**

- [ ] Delete the group's interface
- [ ] Remove optional field from `MarketDataRow`

**`MarketDataRow` PRO comment:**

- [ ] Update: `PRO tier indicators (36 columns)` → new count

**`useIndicators` hook JSDoc:**

- [ ] Update column structure breakdown in JSDoc
- [ ] Update `60-Column Schema Structure:` listing

---

### Layer 7 — Tests

#### `__tests__/lib/db/prisma.test.ts`

- [ ] Add/remove `marketData` mock CRUD methods if model is brand new
- [ ] Update `Market Data Model (60-Column Schema)` describe block name if total changes
- [ ] Add/remove column field assertions

#### `__tests__/lib/db/seed.test.ts`

- [ ] Update JSDoc header with new schema version

---

#### `lib/tier/__tests__/constants.test.ts`

**Describe block header:**

- [ ] Update: `60-Column Schema` → new total

**`PRO_ONLY_INDICATORS` test:**

- [ ] Update `toHaveLength(8)` → new PRO group count
- [ ] Add `expect(PRO_ONLY_INDICATORS).toContain('new_group')`
- [ ] Remove assertion for deleted group

**`ALL_INDICATORS` test:**

- [ ] Update `toHaveLength(10)` → new total group count

**`INDICATOR_METADATA` tests:**

- [ ] Update `toHaveLength(10)` → new total
- [ ] Add PRO tier check for new group
- [ ] Remove tier check for deleted group
- [ ] Add column assertion block for new group:
  ```typescript
  it('new_group should have exactly N columns', () => {
    expect(INDICATOR_METADATA.new_group.columns).toHaveLength(N);
    expect(INDICATOR_METADATA.new_group.columns).toEqual(['col_1', 'col_2']);
  });
  ```
- [ ] Update/remove column assertion block for renamed/deleted group

**Column Counts section:**

- [ ] PRO total: `toBe(36)` → new PRO column count
- [ ] All total: `toBe(52)` → new all-indicator column count

**`getTierColumnCount` test:**

- [ ] `toBe(60)` → new PRO total column count

---

#### `lib/tier/__tests__/validator.test.ts`

**Describe block header:**

- [ ] Update: `60-Column Schema`

**`canAccessIndicator` tests:**

- [ ] FREE CANNOT access: add assertion for new PRO group
- [ ] FREE CANNOT access: remove assertion for deleted group
- [ ] PRO CAN access: add/remove assertions to match

**`getAccessibleIndicators` PRO test:**

- [ ] `toHaveLength(10)` → new total group count

**`getLockedIndicators` FREE test:**

- [ ] `toHaveLength(8)` → new PRO-only group count
- [ ] Add `toContain('new_group')`
- [ ] Remove `toContain('deleted_group')`

**`getAccessibleColumns` PRO test:**

- [ ] `toHaveLength(60)` → new total column count

**`getLockedColumns` FREE test:**

- [ ] `toHaveLength(36)` → new PRO-only column count

**`mockData` object in Data Filtering section:**

- [ ] Add new PRO columns to mock: `new_col: value,`
- [ ] Rename any renamed columns
- [ ] Remove deleted columns

---

#### `__tests__/components/charts/indicator-toggles.test.tsx`

**File header comment & describe block name:**

- [ ] Update: `60-column database schema` if it changes

**`should render PRO indicators` test:**

- [ ] Add: `expect(screen.getByText('New Group Label')).toBeInTheDocument();`
- [ ] Remove: assertion for deleted group's label

**`should render PRO indicators` comment:**

- [ ] Update: `// PRO tier indicators (8 groups)` → new count

> **Note:** `label` value must match `INDICATOR_METADATA[id].label` in `lib/tier/constants.ts`.

---

#### `__tests__/lib/tier-validation.test.ts`

**Indicator Access section comment:**

- [ ] Update: `// Indicator Access Tests (60-Column Schema)`

**`FREE tier cannot access N PRO-only indicators` test:**

- [ ] Update description: `8 PRO-only indicators` → new count
- [ ] Add/remove `canAccessIndicator` assertions

**`PRO tier can access all N indicators` test:**

- [ ] Update description: `10 indicators (2 FREE + 8 PRO)` → new counts
- [ ] Add/remove indicators in the array

**`getAccessibleIndicators('PRO')` assertion:**

- [ ] Add/remove group ids from `toEqual([...])` array

**`getLockedIndicators('FREE')` assertion:**

- [ ] Add/remove group ids from `toEqual([...])` array

**`validateFullTierAccess` indicator violation test:**

- [ ] Update: `toContain('10 indicators')` → new total

---

### Layer 8 — Documentation

#### `docs/files-completion-list/files-inventory/part-02-files-completion.md`

- [ ] Update column totals: `57` → new total everywhere
- [ ] Update PRO column count
- [ ] Add/remove group entries under Group 9, 10, etc.
- [ ] Update `Last Updated` date

#### OpenAPI Documents — Part 03 (`part-03-types-openapi.yaml`)

- [ ] Follow the checklist under **Layer 3** → `part-03-types-openapi.yaml` above

#### OpenAPI Documents — Part 04 (`part-04-tier-system-openapi.yaml`)

- [ ] Follow the checklist under **Layer 3** → `part-04-tier-system-openapi.yaml` above

#### OpenAPI Documents — Part 08 (`part-08-dashboard-layout-openapi.yaml`)

- [ ] Follow the checklist under **Layer 3** → `part-08-dashboard-layout-openapi.yaml` above

#### OpenAPI Documents — Part 09 (`part-09-charts-visualization-openapi.yaml`)

- [ ] Follow the checklist under **Layer 3** → `part-09-charts-visualization-openapi.yaml` above

#### `docs/INDICATOR-SCHEMA-UPDATE-CHECKLIST.md` ← this file

- [ ] Update `Current Schema Summary` block
- [ ] Update any counts in this document

---

## Quick Reference: Count Locations

When adding 1 new PRO group with N columns, update these numbers:

| File                                                                | What to Change                                                                                                      |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`                                              | model docstring total count                                                                                         |
| `part-02-files-completion.md`                                       | PRO count, total count, group list                                                                                  |
| `types/indicator.ts`                                                | `CompleteMarketData` docstring                                                                                      |
| `types/prisma-stubs.d.ts`                                           | group comment block                                                                                                 |
| `lib/tier/constants.ts`                                             | file header, `ALL_INDICATORS` docstring, `PRO_ONLY_INDICATORS` count, `getTierColumnCount` comment                  |
| `lib/tier/validator.ts`                                             | `PRO tier: N columns` comment                                                                                       |
| `lib/tier-validation.ts`                                            | TIER_LIMITS docstring, error message                                                                                |
| `hooks/use-indicators.ts`                                           | `MarketDataRow` comment, JSDoc listing                                                                              |
| `constants.test.ts`                                                 | 4 `toHaveLength()` calls, 1 `toBe(36)`, 1 `toBe(52)`, 1 `toBe(60)`                                                  |
| `validator.test.ts`                                                 | 4 `toHaveLength()` calls, 1 `toHaveLength(60)`, 1 `toHaveLength(36)`                                                |
| `indicator-toggles.test.tsx`                                        | 1 group count comment, 1 new `getByText()` assertion                                                                |
| `tier-validation.test.ts`                                           | 2 description strings, 2 `toEqual([...])` arrays, 1 `toContain('N indicators')`                                     |
| `docs/open-api-documents/part-02-database-schema-openapi.yaml`      | description block, new property                                                                                     |
| `docs/open-api-documents/part-03-types-openapi.yaml`                | V7 Architecture line, `CompleteMarketData` properties, `MarketDataResponse` columnCount description                 |
| `docs/open-api-documents/part-04-tier-system-openapi.yaml`          | PRO Tier Specifications, DB Schema section, PRO-Only Indicators listing, `IndicatorId` enum                         |
| `docs/open-api-documents/part-08-dashboard-layout-openapi.yaml`     | feature bullet, migration section, chart page description, `MarketData` schema properties                           |
| `docs/open-api-documents/part-09-charts-visualization-openapi.yaml` | DB Schema description, `IndicatorId` enum, column data schemas, `CompleteMarketData` allOf, `ProTierConfig` example |

---

## Files NOT in This Checklist (Separate Concerns)

| File                                          | Reason Excluded                                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `components/charts/pro-indicator-overlay.tsx` | Uses `KeltnerChannelData` (MT5 camelCase format), updated separately when chart rendering logic changes |
| `lib/tier/constants.ts > KELTNER_COLORS`      | Tied to `KeltnerChannelData` MT5 keys — NOT DB column names. Update only when MT5 buffer layout changes |
| `lib/api/mt5-transform.ts`                    | **Orphaned/dead code** in v2.0. MT5 indicator API was removed. Do not update.                           |
| `types/indicator.ts > KeltnerChannelData`     | MT5 chart format (camelCase), not DB schema                                                             |
| `types/indicator.ts > MT5ProIndicators`       | MT5 response format, not DB schema                                                                      |

---

## Operation-Specific Checklists

### Adding a New PRO Indicator Group

1. `prisma/schema.prisma` — add fields + update docstring
2. `migration.sql` — add columns to CREATE TABLE (or new ALTER TABLE)
3. `lib/db/seed.ts` + `prisma/seed.ts` — update JSDoc; add seed values if applicable
4. `docs/open-api-documents/part-02-database-schema-openapi.yaml` — add properties
5. `types/indicator.ts` — add interface + add to `IndicatorType` union + extend `CompleteMarketData`
6. `types/prisma-stubs.d.ts` — add fields to `MarketData` interface
7. `lib/tier/constants.ts` — add to `PRO_ONLY_INDICATORS` + add `INDICATOR_METADATA` entry + update counts
8. `lib/tier/validator.ts` — update count comments
9. `lib/tier-validation.ts` — add to `TIER_LIMITS.PRO.indicators` + update error message
10. `hooks/use-indicators.ts` — add interface + add to `MarketDataRow`
11. `constants.test.ts` — add assertions for new group, update counts
12. `validator.test.ts` — add to access control tests, update counts
13. `indicator-toggles.test.tsx` — add label assertion
14. `tier-validation.test.ts` — add to indicator lists, update counts
15. `part-02-files-completion.md` — update group list and totals
16. `docs/open-api-documents/part-03-types-openapi.yaml` — add property to `CompleteMarketData`, update column counts
17. `docs/open-api-documents/part-04-tier-system-openapi.yaml` — add group to PRO-Only Indicators listing, add to `IndicatorId` enum, update all counts
18. `docs/open-api-documents/part-08-dashboard-layout-openapi.yaml` — add property block to `MarketData` schema, update counts in description
19. `docs/open-api-documents/part-09-charts-visualization-openapi.yaml` — add new schema, add `$ref` to `CompleteMarketData`, add to `IndicatorId` enum, add to `ProTierConfig` example, update all counts in description
20. **This file** — update Current Schema Summary

### Renaming Columns Within an Existing Group

1. `prisma/schema.prisma` — rename field
2. `migration.sql` — add `ALTER TABLE ... RENAME COLUMN`
3. `lib/db/seed.ts` + `prisma/seed.ts` — rename in seed data if present
4. `docs/open-api-documents/part-02-database-schema-openapi.yaml` — rename property
5. `types/indicator.ts` — rename field in the group's DB interface (e.g., `KeltnerChannelsData`)
6. `types/prisma-stubs.d.ts` — rename field in `MarketData`
7. `lib/tier/constants.ts` — rename in `INDICATOR_METADATA[group].columns[]` + `PRO_ONLY_INDICATORS` inline comment
8. `hooks/use-indicators.ts` — rename field in the group's local interface
9. `constants.test.ts` — update `.toContain()` and `.toEqual([...])` assertions
10. `validator.test.ts` — update any `canAccessColumn` assertions using old name
11. `tier-validation.test.ts` — update if old column name appears in tests
12. `docs/open-api-documents/part-03-types-openapi.yaml` — rename property in `CompleteMarketData`
13. `docs/open-api-documents/part-04-tier-system-openapi.yaml` — rename column in PRO-Only Indicators description
14. `docs/open-api-documents/part-08-dashboard-layout-openapi.yaml` — rename property in `MarketData` schema
15. `docs/open-api-documents/part-09-charts-visualization-openapi.yaml` — rename property in the group's schema (e.g., `BodyMomentumData`), update column listing in description

> **Keltner-specific:** Renaming DB Keltner columns only affects `KeltnerChannelsData` and `INDICATOR_METADATA.keltner_channels.columns[]`. Do NOT touch `KeltnerChannelData` (camelCase) or `KELTNER_COLORS`.

### Removing an Indicator Group

1. `prisma/schema.prisma` — remove fields
2. `migration.sql` — add `ALTER TABLE ... DROP COLUMN` statements
3. `lib/db/seed.ts` + `prisma/seed.ts` — remove seed values
4. `docs/open-api-documents/part-02-database-schema-openapi.yaml` — remove properties
5. `types/indicator.ts` — delete interface + remove from `IndicatorType` + remove from `CompleteMarketData`
6. `types/prisma-stubs.d.ts` — remove fields from `MarketData`
7. `lib/tier/constants.ts` — remove from `PRO_ONLY_INDICATORS` + remove `INDICATOR_METADATA` entry + update counts
8. `lib/tier/validator.ts` — update count comments
9. `lib/tier-validation.ts` — remove from `TIER_LIMITS.PRO.indicators` + update error message
10. `hooks/use-indicators.ts` — delete interface + remove from `MarketDataRow`
11. All 4 test files — remove all assertions for the deleted group, update counts
12. `docs/open-api-documents/part-03-types-openapi.yaml` — remove property from `CompleteMarketData`, update counts
13. `docs/open-api-documents/part-04-tier-system-openapi.yaml` — remove group from PRO-Only Indicators listing, remove from `IndicatorId` enum, update all counts
14. `docs/open-api-documents/part-08-dashboard-layout-openapi.yaml` — remove property block from `MarketData` schema, update counts
15. `docs/open-api-documents/part-09-charts-visualization-openapi.yaml` — delete schema, remove `$ref` from `CompleteMarketData`, remove from `IndicatorId` enum and `ProTierConfig`, update all counts

### Adding a FREE Indicator Group

Same as PRO group above, except:

- Add to `FREE_TIER_INDICATORS` instead of `PRO_ONLY_INDICATORS`
- Set `tier: 'FREE'` in `INDICATOR_METADATA`
- Do NOT add to `TIER_LIMITS.PRO.indicators` (FREE groups are automatically accessible to both tiers)
- Extend `FreeMarketData` instead of (or in addition to) `CompleteMarketData` in `types/indicator.ts`
- Update FREE column count in all tests: `freeColumns.toBe(16)` → new count; `getAccessibleColumns('FREE').toHaveLength(24)` → new count
- For OpenAPI docs (parts 03, 08, 09): add properties to `FreeMarketData` schema in addition to system columns; update FREE Tier column counts throughout
- For OpenAPI doc part-04: update FREE Tier Specifications `Indicator Columns` and `Total Columns`

---

_Last verified against schema version: 60-column (EA v2.26+), PR #347_
