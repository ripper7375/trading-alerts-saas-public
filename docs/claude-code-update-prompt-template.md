# Claude Code Prompt Template: Update Part XX to 57-Column Schema

**Purpose:** Template prompt for updating any part of the codebase to align with the new 57-column database schema

**Usage Instructions:**
1. Replace `[XX]` with the actual part number (e.g., "03", "04", "11", etc.)
2. Replace `[PART_NAME]` with the part's descriptive name (e.g., "Types", "Tier System", "Alerts API", etc.)
3. Attach the file `docs/57-column-schema-update-guide.md` to the conversation
4. Copy the filled-in template below and paste it to Claude Code (web)

---

## PROMPT TEMPLATE

```
# Task: Update Part [XX] ([PART_NAME]) to 57-Column Database Schema

## Context

I need you to update **Part [XX] ([PART_NAME])** to align with the new 57-column database schema. This involves migrating from the old 14-column JSON structure to the new flat 57-column structure.

**CRITICAL: Please read the attached guide `docs/57-column-schema-update-guide.md` thoroughly before starting. It contains essential information about:**
- The three-layer architecture (Database, Data Fetching, Metadata)
- ID naming conventions (lowercase vs UPPERCASE)
- Field name compatibility (NEW database names vs OLD metadata names)
- Common pitfalls and how to avoid them
- Complete compliance checklist

## Part [XX] Overview

**Part Name:** [PART_NAME]
**Location:** [Provide file paths or directory, e.g., "lib/tier/*", "app/api/alerts/*", etc.]
**Current Status:** Uses old 14-column JSON structure with nested indicators

**Files in this part:** [List key files if known, e.g.:]
- lib/tier/constants.ts
- lib/tier/types.ts
- lib/tier/utils.ts
- __tests__/lib/tier/*.test.ts

## Requirements

### 1. Schema Migration

Migrate all type definitions, constants, and logic from:

**OLD Schema (14-column JSON):**
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

**NEW Schema (57-column flat):**
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
  diag_asc_line_2: null,
  diag_asc_line_3: null,
  diag_desc_line_1: 43270,
  diag_desc_line_2: null,
  diag_desc_line_3: null,
  diag_high_map: null,
  diag_low_map: null,
  horiz_peak_line_1: 43300,
  horiz_peak_line_2: null,
  horiz_peak_line_3: null,
  horiz_bottom_line_1: 43200,
  horiz_bottom_line_2: null,
  horiz_bottom_line_3: null,
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

### 2. Indicator Groups

Update all code to use the new 8 indicator groups:

**FREE Tier (2 groups, 16 columns):**
1. `fractal_diagonal` (8 columns): diag_asc_line_1/2/3, diag_desc_line_1/2/3, diag_high_map, diag_low_map
2. `fractal_horizontal` (8 columns): horiz_peak_line_1/2/3, horiz_bottom_line_1/2/3, horiz_high_map, horiz_low_map

**PRO Tier (6 groups, 33 columns):**
3. `moving_averages` (3 columns): tema, hrma, smma
4. `body_momentum` (2 columns): body_size, body_direction
5. `heiken_ashi` (7 columns): ha_open, ha_high, ha_low, ha_close, ha_color, ha_trend, ha_strength
6. `keltner_channels` (10 columns): kc_upper, kc_middle, kc_lower, kc_upper_ema, kc_middle_ema, kc_lower_ema, kc_squeeze, kc_squeeze_pro, kc_width, kc_width_ema
7. `support_resistance` (8 columns): sr_1 through sr_8
8. `zigzag` (3 columns): zigzag_high, zigzag_low, zigzag_trend

### 3. Critical Compliance Factors

**MUST follow these rules** (see attached guide for detailed explanations):

1. **Three-Layer Architecture:**
   - **Database Layer:** Use NEW 57-column names (diag_asc_line_1, horiz_peak_line_1)
   - **Data Fetching Layer:** Use NEW 57-column names, apply tier filtering
   - **Metadata Layer:** Use OLD field names (ascending_1, peak_1) for backward compatibility

2. **ID Naming Conventions:**
   - **TypeScript types/constants:** Use lowercase_snake_case (fractal_diagonal, fractal_horizontal)
   - **API metadata endpoints:** Use UPPERCASE_SNAKE_CASE (FRACTAL_HORIZONTAL, FRACTAL_DIAGONAL)
   - **Database columns:** Use lowercase_snake_case (diag_asc_line_1, horiz_peak_line_1)

3. **Field Names:**
   - **In metadata endpoints (app/api/indicators/route.ts):** Use OLD names (peak_1, ascending_1)
   - **In data endpoints (app/api/indicators/[symbol]/[timeframe]/route.ts):** Use NEW names (horiz_peak_line_1, diag_asc_line_1)
   - **In database queries:** Use NEW names (horiz_peak_line_1, diag_asc_line_1)

4. **Backward Compatibility:**
   - Maintain `BASIC_INDICATORS` as alias to `FREE_TIER_INDICATORS`
   - Use type alias for `IndicatorMeta`: `export type IndicatorMeta = IndicatorMetadata;`
   - Do NOT create separate interface for IndicatorMeta

5. **Tier Access Control:**
   - FREE tier: 24 columns total (8 system + 16 FREE indicators)
   - PRO tier: 57 columns total (8 system + 16 FREE + 33 PRO indicators)

### 4. Update Checklist

Please follow the **complete Update Checklist** from the attached guide (`docs/57-column-schema-update-guide.md`). Key phases:

**Phase 1: Type Definitions**
- [ ] Update TypeScript types to include all 57 columns
- [ ] Use lowercase_snake_case for properties
- [ ] Mark all indicator columns as `number | null`
- [ ] Add `timeframe` and `collected_at` system columns

**Phase 2: Constants & Configuration**
- [ ] Update constants with 8 indicator groups
- [ ] Verify FREE_TIER_INDICATORS has exactly 2 items
- [ ] Verify PRO_ONLY_INDICATORS has exactly 6 items
- [ ] Maintain backward compatibility aliases
- [ ] Add color configurations and dataPattern

**Phase 3: API Routes** (if applicable to this part)
- [ ] Metadata endpoints: UPPERCASE IDs, OLD field names
- [ ] Data endpoints: NEW database column names
- [ ] Apply tier-based filtering
- [ ] Update JSDoc comments

**Phase 4: Tests**
- [ ] Update test expectations for new indicator IDs (lowercase)
- [ ] Update test expectations for new labels
- [ ] Verify UPPERCASE IDs in API tests
- [ ] Update mock data to 57 columns

**Phase 5: Documentation**
- [ ] Update JSDoc comments
- [ ] Update inline comments

**Phase 6: Validation**
- [ ] Run TypeScript validation: `npm run validate:types`
- [ ] Run ESLint: `npm run validate:lint`
- [ ] Run tests: `npm test`
- [ ] Verify all tests pass

### 5. Common Pitfalls to Avoid

**DO NOT:**
- ❌ Use NEW field names in metadata endpoints (use OLD names)
- ❌ Use lowercase IDs in API metadata (use UPPERCASE)
- ❌ Create separate IndicatorMeta interface (use type alias)
- ❌ Add PRO indicators to `/api/indicators` metadata endpoint
- ❌ Break backward compatibility for BASIC_INDICATORS

**DO:**
- ✅ Use NEW 57-column names in database queries
- ✅ Use OLD field names in API metadata for compatibility
- ✅ Use UPPERCASE IDs in API responses
- ✅ Use lowercase IDs in TypeScript type definitions
- ✅ Maintain all backward compatibility aliases

## Expected Deliverables

1. **Updated Type Definitions**
   - All types reflect 57-column schema
   - All columns properly typed as nullable
   - JSDoc comments updated

2. **Updated Constants**
   - 8 indicator groups properly defined
   - Backward compatibility maintained
   - Color configurations added

3. **Updated API Routes** (if applicable)
   - Metadata endpoints use UPPERCASE IDs and OLD names
   - Data endpoints use NEW database names
   - Tier filtering implemented

4. **Updated Tests**
   - All tests pass with new schema
   - Mock data uses 57 columns
   - Expectations match new structure

5. **Validation Confirmation**
   - TypeScript validation passes: `npm run validate:types`
   - ESLint validation passes: `npm run validate:lint`
   - All tests pass: `npm test`

## Working Approach

Please follow this approach:

1. **Read the attached guide first** - Understand the three-layer architecture and naming conventions
2. **Analyze current files** - Identify what needs to be updated in Part [XX]
3. **Create a plan** - Outline the changes needed for each file
4. **Implement systematically** - Update files one by one, following the checklist
5. **Test after each change** - Run validation and tests frequently
6. **Document changes** - Update JSDoc comments and inline documentation
7. **Final validation** - Ensure all validation passes before completion

## Success Criteria

The update is complete when:

- ✅ All files use 57-column schema structure
- ✅ ID naming conventions followed correctly (lowercase in types, UPPERCASE in API)
- ✅ Field names used correctly (NEW in database/data, OLD in metadata)
- ✅ Backward compatibility maintained (BASIC_INDICATORS, IndicatorMeta)
- ✅ Tier access control implemented (24 vs 57 columns)
- ✅ TypeScript validation passes: `npm run validate:types`
- ✅ ESLint validation passes: `npm run validate:lint`
- ✅ All tests pass: `npm test`
- ✅ No compilation errors
- ✅ JSDoc comments updated

## Questions?

If you encounter any ambiguity or need clarification:
1. First, consult the attached guide `docs/57-column-schema-update-guide.md`
2. Check the "Common Pitfalls" and "Examples" sections
3. If still unclear, ask me for clarification before proceeding

## Ready to Start?

Please confirm you've read the attached guide and understand the requirements. Then proceed with the update following the checklist and best practices.

**Branch:** claude/update-database-schema-4vEMp
**Expected Outcome:** Part [XX] ([PART_NAME]) fully migrated to 57-column schema with all validation passing.
```

---

## EXAMPLE USAGE

Here's an example of how to use this template for Part 11 (Alerts API):

```
# Task: Update Part 11 (Alerts API) to 57-Column Database Schema

## Context

I need you to update **Part 11 (Alerts API)** to align with the new 57-column database schema. This involves migrating from the old 14-column JSON structure to the new flat 57-column structure.

**CRITICAL: Please read the attached guide `docs/57-column-schema-update-guide.md` thoroughly before starting. It contains essential information about:**
- The three-layer architecture (Database, Data Fetching, Metadata)
- ID naming conventions (lowercase vs UPPERCASE)
- Field name compatibility (NEW database names vs OLD metadata names)
- Common pitfalls and how to avoid them
- Complete compliance checklist

## Part 11 Overview

**Part Name:** Alerts API
**Location:** app/api/alerts/*
**Current Status:** Uses old 14-column JSON structure with nested indicators

**Files in this part:**
- app/api/alerts/route.ts (GET, POST)
- app/api/alerts/[id]/route.ts (GET, PATCH, DELETE)
- app/api/alerts/active/route.ts
- lib/alerts/types.ts
- lib/alerts/utils.ts
- __tests__/api/alerts/*.test.ts

## Requirements

[Continue with the rest of the template...]

**Branch:** claude/update-database-schema-4vEMp
**Expected Outcome:** Part 11 (Alerts API) fully migrated to 57-column schema with all validation passing.
```

---

## NOTES

1. **Always attach the guide:** The guide contains critical information that this template references
2. **Be specific:** Fill in all placeholders with actual part information
3. **One part at a time:** Use this template for each part separately
4. **Follow the checklist:** The guide's checklist is comprehensive and battle-tested
5. **Test frequently:** Don't wait until the end to run validation and tests

---

**Template Version:** 1.0.0
**Last Updated:** 2025-01-16
**Compatible With:** 57-Column Schema Update Guide v1.0.0
