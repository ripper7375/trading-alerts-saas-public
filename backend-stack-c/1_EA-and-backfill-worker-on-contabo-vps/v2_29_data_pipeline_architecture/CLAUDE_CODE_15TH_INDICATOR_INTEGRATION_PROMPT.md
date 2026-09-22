# Claude Code Mission Prompt: Feasibility Study & Full Implementation of the 15th Indicator (`S-R-AutoCalibration_v2_29`) into Stack C Data Pipeline

> **Instructions for Operator / Davin:** Copy the complete prompt block below and run it directly in **Claude Code**. It contains full context, file paths, architectural deltas, lessons learned from the 14th indicator onboarding, and step-by-step implementation instructions.

---

````markdown
# TASK: Feasibility Assessment and End-to-End Implementation of the 15th Indicator (`S-R-AutoCalibration_v2_29.mq5`) in Backend Stack C Data Pipeline (v2.29)

## 1. Executive Summary & Objective

You are tasked with conducting a feasibility study and executing the complete, production-grade implementation to onboard the **15th indicator** into Backend Stack C (v2.29 data pipeline / v6 pipeline architecture).

- **Indicator Name:** `S-R-AutoCalibration_v2_29.mq5` (specification: `S-R-AutoCalibration_v2_29.md`)
- **Origin / Source Template:** Replicated from the 14th indicator (`SupportAndResistantAutoCalibration_v2_29.mq5`)
- **Mathematical Engine:** Dynamic Support & Resistance clustering using Freedman-Diaconis Interquartile Range (IQR) optimal bin width:
  $$h = 2 \cdot \text{IQR} \cdot N^{-1/3}$$
- **Data Payload:** Exactly 8 price-level columns:
  - 4 closest Supports below close: `sr_9` (closest), `sr_10`, `sr_11`, `sr_12` (furthest below)
  - 4 closest Resistances above close: `sr_13` (closest), `sr_14`, `sr_15`, `sr_16` (furthest above)
- **Architectural Delta:**
  - Total MQL5 data producers: **14 → 15 indicators**
  - Per-chart indicator attachments: **14 on M5 / 14 on M15 → 15 on M5 / 15 on M15** (+2 attachments per terminal)
  - Total Active / Standby attachments (A + B): **28 + 28 = 56 → 30 + 30 = 60**
  - Raw SQLite staging tables: **14 → 15** (new `raw_sr2_levels`)
  - Validated key sources in `v_validation_keys`: **13 → 14** (+1 validated source)
  - `market_data` total columns: **95 → 103 columns** (+8 columns: `sr_9..sr_16`)
  - Push Worker contract fields: **95 → 103 fields**
  - Downstream Prisma Postgres (`market_data_v6`): **95 → 103 fields**

---

## 2. Authoritative Context & Reference Files

Per `docs/migration-orders/EXECUTOR-PROTOCOL.md` §0, **"live code wins"**. Read and inspect these files thoroughly before making any edits:

### 2.1 The 14th Indicator Blueprint & Completion Record (Crucial Precedent)

- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/ARCHITECTURE_DESIGN_14TH_INDICATOR_SUPPORT_AND_RESISTANCE.md`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/integrating-14th-Indicator-in-stack-c-manifest-work-completion.md`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/ARCHITECTURE-SUMMARY-FOR-DECK.md`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/ACTIVE-STANDBY-TERMINAL-ARCHITECTURE.md`

### 2.2 Indicator Source Code & Specification

- **15th Indicator Source:** `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mq5/S-R-AutoCalibration_v2_29.mq5`
- **15th Indicator Spec:** `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mq5/S-R-AutoCalibration_v2_29.md`
- **14th Indicator Baseline:** `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mq5/SupportAndResistantAutoCalibration_v2_29.mq5`

### 2.3 Stack C Python / SQLite Layer

- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/export_collector_validator_v2.py`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/sqlite_schema_v6_xauusd.sql`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/backfill_worker_api_gateway_v5.py`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/gateway_contract_market_data.schema.json`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/gateway_contract_indicator_statistics.schema.json`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/migrate_sqlite_add_sr_columns.sql`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/test_sr_levels_source.py`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/test_economic_events.py`

### 2.4 Downstream Gateway, Prisma, and TypeScript Layer

- `railway-gateway/prisma/schema.prisma`
- `prisma/market-data/schema.prisma`
- `railway-gateway/src/gateway/dto/market-data.dto.ts`
- `railway-gateway/test/dto-contract.spec.ts`
- `types/indicator.ts`
- `types/prisma-stubs.d.ts`

---

## 3. Critical Architectural Pitfalls & Lessons Learned from Indicator 14

During the 14th indicator rollout, three critical issues were uncovered and resolved. You **MUST** take them into account:

### 3.1 Automatic vs. Manual SQLite Widening (`migrate_market_data()`)

- `sqlite_schema_v6_xauusd.sql` uses `CREATE TABLE IF NOT EXISTS`, which is a silent no-op against an existing `xauusd.db`.
- Simply editing the DDL in `sqlite_schema_v6_xauusd.sql` does NOT widen deployed databases.
- When `promote_cycle()` executes an `INSERT INTO market_data` naming columns that do not exist, SQLite throws `OperationalError: table market_data has no column named sr_9` and crash-loops the collector.
- **Solution:** `export_collector_validator_v2.py` contains `migrate_market_data(conn)`. It automatically reads `PROMOTE_SOURCES` and `market_data_column(source, col)` to issue `ALTER TABLE market_data ADD COLUMN ...` on boot.
- You must ensure `sr2_levels` is enrolled in `PROMOTE_SOURCES` so `migrate_market_data()` handles it cleanly, AND ship a standalone `migrate_sqlite_add_sr2_columns.sql` for operators who want an explicit pre-run widening.

### 3.2 Inactive Level Coercion (`PRICE_LEVEL_COLUMNS`)

- Slots `sr_9..sr_16` have numeric names that match neither base names (`best_support`) nor suffixes (`_resistance`, `_support`).
- If an unpopulated or inactive slot outputs `0.0` or `0.00`, downstream alert bots could interpret this as an active support/resistance line at `$0.00`.
- The indicator exports empty strings `""` for inactive slots, which `parse_export_file()` turns into `None` (`NULL`).
- However, if `0.0` is ever output, `PRICE_LEVEL_COLUMNS` must explicitly contain `'sr_9'..'sr_16'` so they are coerced to `None` (`NULL`).

### 3.3 The Statistic File Scope (`STAT_SOURCES`)

- In the initial 14th indicator design, enrolling `sr_levels` in `STAT_SOURCES` would have sent an unmapped indicator to `gateway_contract_indicator_statistics.schema.json`, which had a closed enum, causing HTTP 400 and quarantining the entire batched statistics payload!
- Check whether the companion statistic file for the 15th indicator (`S_R_Levels_XAUUSD_{TF}_Statistic.txt`) should be:
  - **Option A (Recommended for Phase 1):** Excluded from `STAT_SOURCES` (or ignored by the ingestion loop), ensuring zero risk to the batched statistics HTTP POST lane.
  - **Option B:** Fully enrolled with expanded contract enum and Prisma fields.

### 3.4 Full Cycle Rejection on Missing File (`PER_BAR_SOURCES`)

- Enrolling `'sr2_levels'` into `SOURCES` puts it into `PER_BAR_SOURCES = [s for s in SOURCES if s != 'zigzag']`.
- This means if `S_R_Levels_XAUUSD_M5.txt` is missing or stale, the collector will reject the **entire cycle**.
- This is intentional: cross-source close agreement and complete pipeline synchronization are core guarantees of Stack C.

---

## 4. Detailed Data Contracts for Indicator 15

### 4.1 Export File Naming

- **Default Prefix:** `S_R_Levels` (defined in `S-R-AutoCalibration_v2_29.mq5` via `InpExportFileName = "S_R_Levels"`)
- **TimeSeries Files:**
  - `MQL5/Files/S_R_Levels_XAUUSD_M5.txt`
  - `MQL5/Files/S_R_Levels_XAUUSD_M15.txt`
- **Companion Statistic Files:**
  - `MQL5/Files/S_R_Levels_XAUUSD_M5_Statistic.txt`
  - `MQL5/Files/S_R_Levels_XAUUSD_M15_Statistic.txt`

### 4.2 TSV File Layout (Strictly 12 Columns, Tab-Separated)

```tsv
timestamp\tsymbol\ttimeframe\tclose\tsr_9\tsr_10\tsr_11\tsr_12\tsr_13\tsr_14\tsr_15\tsr_16\r\n
```
````

- `timestamp`: Integer Unix timestamp in seconds (hour-rounded UTC adjusted)
- `symbol`: `XAUUSD`
- `timeframe`: `M5` or `M15`
- `close`: Price close formatted to `_Digits` (e.g. `2350.50`)
- `sr_9..sr_12`: Supports strictly `< close` sorted nearest-first (`sr_9` is closest below close)
- `sr_13..sr_16`: Resistances strictly `> close` sorted nearest-first (`sr_13` is closest above close)
- Unresolved slots: Empty string `""` between tabs (parsed as SQL `NULL`)

---

## 5. Phase 1: Feasibility Study & Codebase Pre-Flight Check

Before making code edits, perform a comprehensive inspection:

1. **Verify `S-R-AutoCalibration_v2_29.mq5`:**
   - Confirm filename, TSV header, empty string formatting, and slot mapping `sr_9..sr_16`.
   - Confirm button names and object prefixes (`MQLTA-S-R-Auto-v2_29`) are isolated from Indicator 14 (`MQLTA-SR-Auto-v2_29`).
2. **Examine `export_collector_validator_v2.py`:**
   - Verify how `SOURCES` dictionary entries map to staging tables and promote columns.
   - Verify `market_data_column('sr2_levels', col)` output.
   - Verify `migrate_market_data()` logic and ensure it automatically adds columns `sr_9..sr_16`.
   - Verify `PRICE_LEVEL_COLUMNS` set.
3. **Examine `backfill_worker_api_gateway_v5.py`:**
   - Check `EXPECTED_CONTRACT_FIELDS` and the module-level assertion count (currently 95).
4. **Examine Downstream Prisma & Gateway:**
   - Check `railway-gateway/prisma/schema.prisma` and `prisma/market-data/schema.prisma`.
   - Check `npm run generate:dto` script in `railway-gateway/package.json`.
   - Check `railway-gateway/test/dto-contract.spec.ts` (currently asserting 95 fields).
5. **Formulate Feasibility Findings Report:** Document any edge cases or schema mismatches before proceeding to Phase 2.

---

## 6. Phase 2: Implementation Steps

### Step 1: Update SQLite Schema (`sqlite_schema_v6_xauusd.sql`)

1. Create staging table `raw_sr2_levels`:
   ```sql
   CREATE TABLE IF NOT EXISTS raw_sr2_levels (
       cycle_id        INTEGER NOT NULL REFERENCES collection_cycles (cycle_id) ON DELETE CASCADE,
       timestamp_raw   INTEGER NOT NULL,
       timestamp_adj   INTEGER,
       symbol          TEXT    NOT NULL CHECK (symbol = 'XAUUSD'),
       timeframe       TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),
       close           REAL    NOT NULL,
       sr_9            REAL,
       sr_10           REAL,
       sr_11           REAL,
       sr_12           REAL,
       sr_13           REAL,
       sr_14           REAL,
       sr_15           REAL,
       sr_16           REAL,
       PRIMARY KEY (cycle_id, timeframe, timestamp_raw)
   );
   ```
2. Update `v_validation_keys` view:
   Add:
   ```sql
   UNION ALL
   SELECT cycle_id, 'sr2_levels' AS source, timestamp_adj, symbol, timeframe, close
   FROM raw_sr2_levels
   ```
3. Update `market_data` table definition:
   Add columns `sr_9` through `sr_16` as nullable `REAL` (bringing total columns from 95 to 103).
4. Update comments and column counts in schema documentation.

### Step 2: Update Python Validator & Collector (`export_collector_validator_v2.py`)

1. In `SOURCES` dictionary, add `'sr2_levels'`:
   ```python
   'sr2_levels':   {'prefix': 'S_R_Levels', 'table': 'raw_sr2_levels',
                    'columns': [('sr_9', 'real', 'sr_9'), ('sr_10', 'real', 'sr_10'),
                                ('sr_11', 'real', 'sr_11'), ('sr_12', 'real', 'sr_12'),
                                ('sr_13', 'real', 'sr_13'), ('sr_14', 'real', 'sr_14'),
                                ('sr_15', 'real', 'sr_15'), ('sr_16', 'real', 'sr_16')]},
   ```
2. In `PRICE_LEVEL_COLUMNS`, add `'sr_9', 'sr_10', 'sr_11', 'sr_12', 'sr_13', 'sr_14', 'sr_15', 'sr_16'`.
3. Handle `STAT_SOURCES`: Ensure `'sr2_levels'` does not trigger unwanted unmapped statistic ingestion into a closed schema.
4. Verify that `migrate_market_data()` will pick up the new columns dynamically.

### Step 3: Create Standalone SQLite Widening Script

- Create `migrate_sqlite_add_sr2_columns.sql` with idempotent `ALTER TABLE market_data ADD COLUMN sr_9 REAL;` ... `sr_16 REAL;` for operator convenience.

### Step 4: Update Push Worker (`backfill_worker_api_gateway_v5.py`)

1. In `EXPECTED_CONTRACT_FIELDS`, add `'sr_9', 'sr_10', 'sr_11', 'sr_12', 'sr_13', 'sr_14', 'sr_15', 'sr_16'` directly after `sr_8`.
2. Update the contract assertion:
   ```python
   assert len(EXPECTED_CONTRACT_FIELDS) == 103, (
       f"Expected 103 contract fields, got {len(EXPECTED_CONTRACT_FIELDS)}"
   )
   ```
3. Update docstrings and comments from 95 to 103 fields.

### Step 5: Update JSON Gateway Contract Schema (`gateway_contract_market_data.schema.json`)

1. Under `properties`, add definitions for `sr_9` through `sr_16`:
   ```json
   "sr_9":  { "type": ["number", "null"], "description": "Support 1: Closest Support level below close (Indicator 15)." },
   "sr_10": { "type": ["number", "null"], "description": "Support 2: 2nd Closest Support level below close (Indicator 15)." },
   "sr_11": { "type": ["number", "null"], "description": "Support 3: 3rd Closest Support level below close (Indicator 15)." },
   "sr_12": { "type": ["number", "null"], "description": "Support 4: 4th Closest Support level below close (Indicator 15)." },
   "sr_13": { "type": ["number", "null"], "description": "Resistance 1: Closest Resistance level above close (Indicator 15)." },
   "sr_14": { "type": ["number", "null"], "description": "Resistance 2: 2nd Closest Resistance level above close (Indicator 15)." },
   "sr_15": { "type": ["number", "null"], "description": "Resistance 3: 3rd Closest Resistance level above close (Indicator 15)." },
   "sr_16": { "type": ["number", "null"], "description": "Resistance 4: 4th Closest Resistance level above close (Indicator 15)." }
   ```

### Step 6: Update Prisma Schemas & Database Migration

1. **`railway-gateway/prisma/schema.prisma`**:
   Add 8 nullable fields to `model market_data_v6`:
   ```prisma
   sr_9   Float?
   sr_10  Float?
   sr_11  Float?
   sr_12  Float?
   sr_13  Float?
   sr_14  Float?
   sr_15  Float?
   sr_16  Float?
   ```
2. **`prisma/market-data/schema.prisma`**:
   Apply the **exact byte-identical** block to maintain parity between both schemas. Update model doc comments (95 → 103 fields).
3. **Generate Postgres Migration**:
   Create `prisma/migrations/20260922000000_add_market_data_v6_sr2_levels/migration.sql` with:
   ```sql
   ALTER TABLE "market_data_v6" ADD COLUMN "sr_9" DOUBLE PRECISION;
   ALTER TABLE "market_data_v6" ADD COLUMN "sr_10" DOUBLE PRECISION;
   ALTER TABLE "market_data_v6" ADD COLUMN "sr_11" DOUBLE PRECISION;
   ALTER TABLE "market_data_v6" ADD COLUMN "sr_12" DOUBLE PRECISION;
   ALTER TABLE "market_data_v6" ADD COLUMN "sr_13" DOUBLE PRECISION;
   ALTER TABLE "market_data_v6" ADD COLUMN "sr_14" DOUBLE PRECISION;
   ALTER TABLE "market_data_v6" ADD COLUMN "sr_15" DOUBLE PRECISION;
   ALTER TABLE "market_data_v6" ADD COLUMN "sr_16" DOUBLE PRECISION;
   ```

### Step 7: Regenerate DTO and Update TypeScript Types

1. Run `npm run generate:dto` in `railway-gateway` to regenerate `market-data.dto.ts` from `gateway_contract_market_data.schema.json`. (Do NOT edit this DTO manually).
2. In `railway-gateway/test/dto-contract.spec.ts`, update field count test from 95 to 103:
   ```typescript
   expect(dtoFields.length).toBe(103);
   ```
3. In `types/indicator.ts`, update `MarketDataDto` and `MarketDataRecord` interfaces with `sr_9?: number | null;` ... `sr_16?: number | null;` and update comments from 95 to 103 fields.
4. In `types/prisma-stubs.d.ts`, mirror the interface additions.

### Step 8: Create / Expand Tests

1. Update `test_economic_events.py`: update column count guard assertion from 95 to 103.
2. Create `test_sr2_levels_source.py` (patterned after `test_sr_levels_source.py`) covering:
   - Header parsing for `S_R_Levels`
   - Real price floats parsing
   - Empty strings coerced to SQL `None`/`NULL`
   - `0.00` sentinel coerced to `None`/`NULL`
   - Ingestion rejection when `S_R_Levels_XAUUSD_{TF}.txt` is missing (full cycle enrollment guarantee)
   - Schema sync verification (`verify_schema_contract()`)

---

## 7. Phase 3: Comprehensive Verification & Test Commands

Run and verify the following commands:

```bash
# 1. Compile all modified Python files
python -m py_compile backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/export_collector_validator_v2.py
python -m py_compile backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/backfill_worker_api_gateway_v5.py

# 2. Run Python test suites
cd backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture
python test_sr_levels_source.py
python test_sr2_levels_source.py
python test_economic_events.py
python test_push_economic_events.py
python test_stale_export_guard.py

# 3. Regenerate DTO and run Gateway tests
cd ../../../railway-gateway
npm run generate:dto
npm test
npm run test:e2e
npx tsc --noEmit

# 4. Check root TypeScript / Prisma
cd ..
npx prisma generate --schema=prisma/market-data/schema.prisma
npx tsc --noEmit
```

---

## 8. Phase 4: Production Deployment Runbook

Record the recommended production rollout order:

1. **Apply Postgres Migration:** Apply `20260922000000_add_market_data_v6_sr2_levels` to Railway production Postgres.
2. **Deploy Gateway:** Push Gateway changes so `MarketDataDto` accepts 103 fields.
3. **Deploy VPS Stack C:** Update `sqlite_schema_v6_xauusd.sql`, `export_collector_validator_v2.py`, and `backfill_worker_api_gateway_v5.py`. Restart `MT5Collector` (which auto-runs `migrate_market_data()`).
4. **Attach Indicator 15 on MT5 Charts:**
   - Compile `S-R-AutoCalibration_v2_29.mq5` to `.ex5`.
   - Attach to XAUUSD M5 and M15 on Terminal A and Terminal B.
   - Verify `S_R_Levels_XAUUSD_M5.txt` is exported at second `:59` with 12 columns.
   - Verify cycles are validated and promoted cleanly with 103 columns into `market_data`.

```

```
