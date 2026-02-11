# INDICATOR SCHEMA UPDATE CHECKLIST

**Version:** 3.0.0 (61-Column Schema)
**Last Updated:** 2026-02-11
**EA Version:** v2.27
**Backfill Worker:** v4
**Schema:** 61 columns (9 system + 16 FREE + 36 PRO)

---

## 📋 PURPOSE

This checklist ensures that all parts of the codebase are properly updated when the indicator schema changes. Use this when:

- Adding new indicators
- Modifying existing indicators
- Renaming columns
- Adding system columns
- Changing tier access rules

---

## 🎯 CURRENT SCHEMA (v3.0 - EA v2.27)

### Schema Changes from v2.0 (60-column)

| Change | Detail |
|--------|--------|
| **Symbol column** | Added as column 2 (after timestamp) |
| **EMA renamed** | `ema_26` → `ema` for consistency |
| **Total columns** | 60 → **61** |
| **System columns** | 8 → **9** |
| **FREE tier** | 24 → **25** columns |
| **PRO tier** | 60 → **61** columns |

### Column Breakdown

| Category | Count | Details |
|----------|-------|---------|
| **Total** | 61 | All columns |
| **System** | 9 | timestamp, **symbol**, open, high, low, close, volume, timeframe, collected_at |
| **FREE indicators** | 16 | Fractal Diagonal (8) + Fractal Horizontal (8) |
| **PRO indicators** | 36 | Moving Averages (4), Body Momentum (2), Heiken Ashi (7), Keltner (10), S/R (8), ZigZag (2), Dual TEMA (2), Pinbar (1) |

---

## ✅ UPDATE CHECKLIST

### PHASE 1: EA / MQ5 Updates

- [ ] **1.1 SimpleDataCollector_v2_27_API_GATEWAY.mq5**
  - [ ] `symbol` column added to CREATE TABLE (position 2)
  - [ ] `symbol` added to INSERT column list
  - [ ] `symbol` value added to INSERT VALUES (using `sanitizedName`)
  - [ ] `ema_26` renamed to `ema` in CREATE TABLE
  - [ ] `ema_26` renamed to `ema` in INSERT statement
  - [ ] Version updated to "2.27"
  - [ ] Changelog updated

- [ ] **1.2 Schema Migration**
  - [ ] `MigrateSymbolTable()` function adds `symbol` column if missing
  - [ ] Old `ema_26` data compatible with new `ema` column name
  - [ ] Test migration on existing SQLite databases

---

### PHASE 2: Backfill Worker Updates

- [ ] **2.1 backfill_worker_api_gateway_v4.py**
  - [ ] Version updated from v3 to v4
  - [ ] Changelog documents v2.27 schema changes
  - [ ] `symbol` field always added to payload (line 285: `data['symbol'] = symbol`)
  - [ ] Dynamic column reading handles both `ema_26` and `ema`
  - [ ] `X-EA-Version` header updated to "backfill_worker_v4.py"
  - [ ] Backward compatible with v2.26 databases

- [ ] **2.2 Testing**
  - [ ] Test with v2.26 database (60 columns, no symbol, has ema_26)
  - [ ] Test with v2.27 database (61 columns, has symbol, has ema)
  - [ ] Verify `symbol` always sent to API
  - [ ] Verify `ema` data sent correctly

---

### PHASE 3: Database Schema (Prisma)

- [ ] **3.1 prisma/schema.prisma**
  - [ ] Add `symbol String` field after `id`, before `timestamp`
  - [ ] Add `@@index([symbol])` for performance
  - [ ] Update composite index to `@@index([symbol, timeframe, timestamp])`
  - [ ] Rename `ema_26 Float?` to `ema Float?` (if it exists)
  - [ ] Add JSDoc comment for `symbol` field
  - [ ] Update schema version comment to v3.0

- [ ] **3.2 Migration**
  - [ ] Run `npx prisma generate`
  - [ ] Create migration: `npx prisma migrate dev --name add_symbol_rename_ema`
  - [ ] Verify migration applies successfully
  - [ ] Test rollback if needed

- [ ] **3.3 Data Population**
  - [ ] Backfill `symbol` column for existing rows (if needed)
  - [ ] Verify symbol values are lowercase (e.g., "xauusd" not "XAUUSD")

---

### PHASE 4: TypeScript Type Definitions

- [ ] **4.1 lib/tier/types.ts (Backend)**
  - [ ] Add `symbol: string;` to `MarketDataRecord` interface (after timestamp)
  - [ ] Rename `ema_26: number | null;` to `ema: number | null;`
  - [ ] Update JSDoc comment: total columns 60 → 61
  - [ ] Update JSDoc comment: system columns 8 → 9
  - [ ] Add JSDoc for `symbol` field

- [ ] **4.2 frontend/lib/tier/types.ts (Frontend)**
  - [ ] Sync changes from backend types
  - [ ] Ensure `symbol: string;` field present
  - [ ] Ensure `ema: number | null;` (not `ema_26`)

---

### PHASE 5: Constants & Configuration

- [ ] **5.1 lib/tier/constants.ts (Backend)**
  - [ ] Update `SYSTEM_COLUMNS_SELECT`:
    - [ ] Add `symbol: true,` (position 2)
  - [ ] Update `ALL_61_COLUMNS_SELECT`:
    - [ ] Rename from `ALL_60_COLUMNS_SELECT`
    - [ ] Add `symbol: true,`
    - [ ] Rename `ema_26: true,` to `ema: true,`
  - [ ] Update `FREE_TIER_SELECT`:
    - [ ] Add `symbol: true,`
  - [ ] Update column count constants:
    - [ ] `SYSTEM_COLUMN_COUNT = 9` (was 8)
    - [ ] `FREE_TIER_COUNT = 25` (was 24)
    - [ ] `PRO_TIER_COUNT = 61` (was 60)

- [ ] **5.2 frontend/lib/tier/constants.ts (Frontend)**
  - [ ] Sync all changes from backend constants
  - [ ] Update column count references

- [ ] **5.3 Mock Data**
  - [ ] Add `symbol` field to all mock data objects
  - [ ] Rename `ema_26` to `ema` in mock data
  - [ ] Ensure symbol values are lowercase

---

### PHASE 6: API Routes

- [ ] **6.1 app/api/indicators/route.ts (Metadata Endpoint)**
  - [ ] Update documentation comments (if any reference to column counts)
  - [ ] No changes to indicator list needed (symbol is system column)

- [ ] **6.2 app/api/indicators/[symbol]/[timeframe]/route.ts (Data Endpoint)**
  - [ ] Update JSDoc to reflect 61-column schema
  - [ ] Update select object:
    - [ ] Use `ALL_61_COLUMNS_SELECT` (was `ALL_60_COLUMNS_SELECT`)
  - [ ] Verify `symbol` field included in all tier responses
  - [ ] Update column count comments: 60 → 61
  - [ ] Update FREE tier count: 24 → 25
  - [ ] Update PRO tier count: 60 → 61

- [ ] **6.3 app/api/mq5/data/route.ts (MQ5 Data Ingestion)**
  - [ ] Handle `symbol` field from MQ5 payload
  - [ ] Handle both `ema_26` and `ema` field names (backward compatibility)
  - [ ] Validate `symbol` field is present and non-empty
  - [ ] Store symbol value as lowercase

---

### PHASE 7: Tests

- [ ] **7.1 Update Test Constants**
  - [ ] System column count: 8 → 9
  - [ ] FREE tier count: 24 → 25
  - [ ] PRO tier count: 60 → 61
  - [ ] Total column count: 60 → 61

- [ ] **7.2 Type Tests**
  - [ ] Add test: `MarketDataRecord` has `symbol` field
  - [ ] Add test: `MarketDataRecord` has `ema` field (not `ema_26`)
  - [ ] Update test: Total columns = 61
  - [ ] Update test: System columns = 9

- [ ] **7.3 API Tests**
  - [ ] Add test: All responses include `symbol` field
  - [ ] Add test: `symbol` value matches query parameter (if applicable)
  - [ ] Add test: `symbol` values are lowercase
  - [ ] Add test: `ema` field present in PRO tier response
  - [ ] Update test: FREE tier returns 25 columns
  - [ ] Update test: PRO tier returns 61 columns

- [ ] **7.4 Data Integrity Tests**
  - [ ] Add test: `symbol` is never null or empty
  - [ ] Add test: `symbol` format is valid (lowercase, alphanumeric)
  - [ ] Add test: `ema` values are valid numbers (same as old `ema_26`)

- [ ] **7.5 Backward Compatibility Tests**
  - [ ] Test: System can read old data (without `symbol`, with `ema_26`)
  - [ ] Test: System can read new data (with `symbol`, with `ema`)
  - [ ] Test: API handles missing `symbol` gracefully

---

### PHASE 8: Documentation

- [ ] **8.1 Schema Documentation**
  - [ ] Update `61-column-schema-update-guide.md` ✅ (created)
  - [ ] Update `free-vs-pro-plan-data-access.md` ✅ (updated)
  - [ ] Update OpenAPI spec (if exists) with symbol field

- [ ] **8.2 Migration Guides**
  - [ ] Document v2.26 → v2.27 migration steps
  - [ ] Document backward compatibility approach
  - [ ] Note required EA version (v2.27+) for new schema

- [ ] **8.3 Code Comments**
  - [ ] Update inline comments referencing 60 columns → 61
  - [ ] Update inline comments referencing `ema_26` → `ema`
  - [ ] Add comments explaining `symbol` column purpose

- [ ] **8.4 README Updates**
  - [ ] Update project README with schema version
  - [ ] Update mock-data README with 61-column schema ✅ (done earlier)

---

### PHASE 9: Validation

- [ ] **9.1 Code Validation**
  - [ ] Run TypeScript type checking: `npm run validate:types`
  - [ ] Run ESLint: `npm run validate:lint`
  - [ ] Run Prettier: `npm run validate:format`
  - [ ] No compilation errors

- [ ] **9.2 Test Validation**
  - [ ] All unit tests pass: `npm test`
  - [ ] All integration tests pass
  - [ ] No test failures related to schema change

- [ ] **9.3 Database Validation**
  - [ ] Schema migration successful
  - [ ] All tables have `symbol` column
  - [ ] All tables have `ema` column (not `ema_26`)
  - [ ] Indexes created successfully

- [ ] **9.4 API Validation**
  - [ ] Test FREE tier endpoint: returns 25 columns with `symbol`
  - [ ] Test PRO tier endpoint: returns 61 columns with `symbol` and `ema`
  - [ ] Test MQ5 data ingestion: accepts data with `symbol`
  - [ ] Verify backward compatibility with old payloads

---

### PHASE 10: Deployment

- [ ] **10.1 Pre-Deployment**
  - [ ] All tests pass
  - [ ] Database migration ready
  - [ ] Backup existing database
  - [ ] Backup existing code

- [ ] **10.2 Deployment Order**
  1. [ ] Database migration (add `symbol` column, handle `ema` rename)
  2. [ ] Backend deployment (API with 61-column support)
  3. [ ] Frontend deployment (UI with 61-column support)
  4. [ ] EA v2.27 deployment to MT5 terminals
  5. [ ] Backfill worker v4 deployment

- [ ] **10.3 Post-Deployment Verification**
  - [ ] Verify MQ5 terminals sending data with `symbol` field
  - [ ] Verify API storing `symbol` correctly
  - [ ] Verify `symbol` appears in API responses
  - [ ] Verify `ema` data collected (not `ema_26`)
  - [ ] Check logs for errors related to schema
  - [ ] Monitor database query performance

- [ ] **10.4 Rollback Plan**
  - [ ] Document rollback steps if issues occur
  - [ ] Keep v2.26 EA binaries available
  - [ ] Keep backfill worker v3 available
  - [ ] Database rollback script ready

---

## 📊 VALIDATION MATRIX

### Column Count Validation

| Component | Expected Count | Validated |
|-----------|---------------|-----------|
| Total Columns | 61 | [ ] |
| System Columns | 9 | [ ] |
| FREE Tier Columns | 25 | [ ] |
| PRO Tier Columns | 61 | [ ] |
| FREE Indicators | 16 | [ ] |
| PRO Indicators | 36 | [ ] |

### Field Presence Validation

| Field | Component | Present | Validated |
|-------|-----------|---------|-----------|
| `symbol` | Prisma Schema | Required | [ ] |
| `symbol` | TypeScript Types | Required | [ ] |
| `symbol` | API Response | Required | [ ] |
| `symbol` | Mock Data | Required | [ ] |
| `ema` | Prisma Schema | Optional | [ ] |
| `ema` | TypeScript Types | Optional | [ ] |
| `ema` | API Response (PRO) | Optional | [ ] |

### Backward Compatibility Validation

| Scenario | Expected Behavior | Validated |
|----------|------------------|-----------|
| v2.26 data ingestion | Accepts without `symbol` | [ ] |
| v2.26 data with `ema_26` | Maps to `ema` | [ ] |
| v2.27 data ingestion | Accepts with `symbol` | [ ] |
| v2.27 data with `ema` | Stores correctly | [ ] |
| Old API clients | Still work (no breaking changes) | [ ] |

---

## 🎯 COMMON ISSUES & SOLUTIONS

### Issue 1: Missing `symbol` Field

**Symptom:** API errors when accessing data without `symbol`

**Solution:**
```typescript
// Ensure symbol is included in all select objects
const select = {
  symbol: true,  // ← Add this
  timestamp: true,
  ...
};
```

### Issue 2: `ema_26` Still Referenced

**Symptom:** TypeScript errors about unknown property `ema_26`

**Solution:**
```typescript
// WRONG:
data.ema_26

// CORRECT:
data.ema
```

### Issue 3: Column Count Mismatch

**Symptom:** Tests fail with "expected 60, got 61"

**Solution:**
```typescript
// Update all column count assertions
expect(columns).toHaveLength(61);  // Was 60
expect(systemColumns).toHaveLength(9);  // Was 8
expect(freeColumns).toHaveLength(25);  // Was 24
```

### Issue 4: Symbol Not Lowercase

**Symptom:** Inconsistent symbol values (XAUUSD vs xauusd)

**Solution:**
```typescript
// Always lowercase symbol values
const symbol = rawSymbol.toLowerCase();
```

---

## 📝 NOTES

### Schema Evolution History

| Version | EA Version | Changes | Date |
|---------|-----------|---------|------|
| v1.0 | v2.25 | 57 columns (8 system + 16 FREE + 33 PRO) | 2025-01-16 |
| v2.0 | v2.26 | 60 columns (+3 PRO: dual_tema_high, dual_tema_low, pinbar) | 2026-02-10 |
| v3.0 | v2.27 | 61 columns (+1 system: symbol; ema_26 → ema) | 2026-02-11 |

### Breaking Changes

**v3.0 Introduces:**
- NEW: `symbol` field (system column) - **all tiers affected**
- RENAMED: `ema_26` → `ema` (PRO tier only)

**Migration Required:**
- [ ] Update all code referencing 60 columns → 61
- [ ] Update all code using `ema_26` → `ema`
- [ ] Ensure `symbol` field present in all queries

---

## ✅ FINAL VERIFICATION

Before marking migration complete, verify:

- [ ] All items in this checklist completed
- [ ] All tests pass
- [ ] Database migration successful
- [ ] API endpoints return correct column count
- [ ] MQ5 sending data with `symbol` field
- [ ] Backfill worker handling both old and new schemas
- [ ] Documentation updated
- [ ] Team notified of changes

---

**Checklist Version:** 3.0.0
**Last Updated:** 2026-02-11
**Next Review:** After completing 61-column migration
**Maintained By:** Trading Alerts SaaS Development Team
