# Integrating the 15th Indicator (S-R-AutoCalibration, `sr_9..sr_16`) into Stack C — Work Completion Report

**Status:** **STEPS 1 AND 2 (MIGRATION & GATEWAY DEPLOY) COMPLETED AND PUSHED LIVE. VPS ROLLOUT REMAINING.**

- **Step 1 (Postgres Migration):** `20260922000000_add_market_data_v6_sr2_levels` applied cleanly to production Postgres (`turntable.proxy.rlwy.net:55082`). Columns `sr_9..sr_16` are live on `market_data_v6` (103 columns) and `market_data_point_in_time` (77 columns).
- **Step 2 (Git & Gateway Deploy):** Committed in `59db1b49` (`feat(stack-c): integrate 15th indicator (S-R-AutoCalibration sr_9..sr_16) into pipeline`) and pushed to `main`. Railway auto-deployment triggered.
- **Remaining:** VPS rollout (Deploy 3 files to Contabo VPS, attach `S-R-AutoCalibration_v2_29.ex5` to MT5 charts on A+B, restart `MT5Collector`).

**Type:** Ad-hoc session (2026-09-22, Davin-requested in chat, from
`CLAUDE_CODE_15TH_INDICATOR_INTEGRATION_PROMPT.md`), outside the phase/session numbering per
`docs/migration-orders/EXECUTOR-PROTOCOL.md` §6.

**What the 15th indicator is.** `mq5/S-R-AutoCalibration_v2_29.mq5` is a copy of the 14th
(`SupportAndResistantAutoCalibration_v2_29.mq5`) taken **after** its four 2026-09-20 fixes and
Davin's uncommitted comment-toggle change. It exports slots `sr_9..sr_16` under prefix
`S_R_Levels`. Apart from renames, colours, button positions and deleted comments, the diff against
the 14th has no logic changes; the test suite asserts the four fixes carried over.

| Dimension                            | Before | After                     |
| ------------------------------------ | ------ | ------------------------- |
| MQL5 export indicators               | 14     | **15**                    |
| `raw_*` staging tables               | 14     | **15** (`raw_sr2_levels`) |
| Per-bar validated sources            | 13     | **14**                    |
| `market_data` / wire contract        | 95     | **103**                   |
| Statistics `source` enum             | 11     | **12**                    |
| `market_data_point_in_time` columns  | 69     | **77**                    |
| Attachments per alternating terminal | 28     | **30**                    |

---

## 1. Where the prompt and the live code disagreed

The prompt was written before the 2026-09-20 work, so it does not know about that work. Live code
won in each case below (§0 of the executor protocol).

### 1.1 Statistics lane: the prompt recommended excluding it; Davin chose to enroll it

The prompt's Option A reasoning ("an unmapped indicator ... closed enum ... HTTP 400") described
2026-09-16. By 2026-09-20 `sr_levels` had been **re-enrolled**: ten section-scoped
`[SUPPORT-RESISTANCE` rules parse its file and the enum is 11. The 15th's statistic file matches
the 14th section for section, so enrolling it needs **no new column**, only an enum widened to 12
and a regenerated DTO. It also adds **no new rollout constraint**, because the `market_data`
contract (`additionalProperties: false`) already forces migration → gateway → VPS for `sr_9..sr_16`.
Davin was asked explicitly (`AskUserQuestion`) and chose to enroll it.

`STAT_SOURCES` is a derived blacklist, so adding the source to `SOURCES` enrolled it
automatically. Excluding it would have been the change that needed code.

### 1.2 The point-in-time lane was not in the prompt at all

Commit `0bd83d8f` (2026-09-20) added `market_data_point_in_time`, which freezes each closed bar's
drifting columns. `sr_1..sr_8` are in it because `ArrayLevels` is re-bucketed against every
exported bar's close, which is a look-ahead. The 15th inherits that code verbatim. Membership in
`DRIFTING_SOURCES` is hand-picked (it is the judgement that file exists to record), so nothing
would have added `sr_9..sr_16` automatically. Davin chose to **include them** (69 → 77). The same
migration therefore adds 8 columns to each table.

### 1.3 A generator bug that only appears with two S&R sources

`generate_point_in_time_schema.py` labelled each column group by **name prefix**
(`'sr_levels': 'sr_'`). With two sources writing bare `sr_<n>` columns, that lookup files
`sr_9..sr_16` under `sr_levels`. The source now travels with each column
(`drifting_columns_by_source()`). The existing 69 columns render **byte-identically**; that was
checked by stripping the new block and comparing against HEAD.

### 1.4 A pre-existing duplicate in both Prisma schemas, removed

At HEAD, both schemas carried the generated `MarketDataPointInTime` doc comment **twice**: a
36-line partial copy sat above the real one, left over from an earlier hand splice. Regenerating
the model replaced the whole region with the generator's output, so the stray copy is gone. It was
comment-only: `prisma migrate diff` shows no DDL beyond the 16 new columns.

### 1.5 `v_validation_keys` is not the validator

The prompt treats the view as the list of validated sources. It is an **operator diagnostic**:
`validate_cycle()` loads keys from each staging table through `PER_BAR_SOURCES`, and no code reads
the view. The view still gains its `sr2_levels` branch, and a test pins it, but validation
membership comes from registry enrolment.

### 1.6 A deployment hazard the prompt could not have seen: the 2-file VPS package

`DEPLOY_TO_CONTABO_VPS_READY/` (gitignored, Davin's local staging for the pending 09-20 VPS
rollout) ships **only the two `.py` files**. The collector reads `sqlite_schema_v6_xauusd.sql`
from beside itself, and that schema file is the **only** thing that creates `raw_sr2_levels`,
because the migrate functions only widen tables that already exist. New collector + old schema
file means the first `stage_source()` raises `no such table` inside `run_cycle()`, uncaught, and
the collector crash-loops.

**Fixed defensively:** `open_db()` now calls a new `assert_staging_tables()`, which refuses to
start and names the stale schema file. Its connection is closed on that path. **The VPS step is
now three files, not two** (§5). The staging package **predates this change** and was left
untouched.

### 1.7 Smaller notes

- **Types:** the prompt asked for `sr_9?: number | null`. The live convention in
  `types/indicator.ts` / `prisma-stubs.d.ts` is non-optional `number | null`, mirroring Prisma, so
  that was followed.
- **`indicator_configs` sharing (pre-existing, not introduced here):** the table is keyed by
  `config_hash` **alone**. Measured on the real captures, `resistance` and `support` already hash
  identically (`12a7d85e8bf6…`), so they share one row whose `source` is whichever was seen first.
  `sr_levels`/`sr2_levels` will share too, because their window anchors are measurements
  (`STAT_FIELDS`), not configuration. Statistics rows and the FK are unaffected, and the
  per-source reconfiguration signal lives in `indicator_statistics`' `(source, config_hash)`
  history. Documented, not changed: changing the hash would mint new hashes for all 11 existing
  sources at once.
- **Identical defaults.** The 15th's window anchors, calibration mode and touch filter default to
  the 14th's exactly, so as attached `sr_9..sr_16` reproduce `sr_1..sr_8`. It only adds
  information once it is given its own window.

---

## 2. What was built

| Layer       | File                                                                                                                   | Change                                                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| SQLite      | `sqlite_schema_v6_xauusd.sql`                                                                                          | `raw_sr2_levels`; `sr2_levels` view branch; `market_data` `sr_9..sr_16` (95 → 103)                                          |
| SQLite      | `migrate_sqlite_add_sr2_columns.sql` (new)                                                                             | Hand-run widening, the belt to `migrate_market_data()`'s braces                                                             |
| Collector   | `export_collector_validator_v2.py`                                                                                     | `SOURCES['sr2_levels']`; `sr_9..sr_16` in `PRICE_LEVEL_COLUMNS`; `assert_staging_tables()` wired into `open_db()`; comments |
| Push worker | `backfill_worker_api_gateway_v5.py`                                                                                    | `EXPECTED_CONTRACT_FIELDS` + 8, assertion 95 → 103                                                                          |
| Contracts   | `gateway_contract_market_data.schema.json`                                                                             | `sr_9..sr_16`, nullable, not required                                                                                       |
| Contracts   | `gateway_contract_indicator_statistics.schema.json`                                                                    | enum + `sr2_levels` (12); descriptions                                                                                      |
| PIT         | `generate_point_in_time_schema.py`                                                                                     | `sr2_levels` drifting; source-labelled rendering (§1.3)                                                                     |
| Prisma      | both `schema.prisma`                                                                                                   | `MarketDataV6` + 8; `MarketDataPointInTime` regenerated (+ 8); `IndicatorStatistic` comments; kept byte-identical           |
| Postgres    | `prisma/migrations/20260922000000_add_market_data_v6_sr2_levels/` (new)                                                | 16 nullable `ADD COLUMN`s over two tables; byte-identical to `prisma migrate diff`                                          |
| Gateway     | `market-data.dto.ts`, `indicator-statistic.dto.ts`                                                                     | Regenerated (the other two DTOs regenerate byte-identical)                                                                  |
| Gateway     | `src/worker/point-in-time-snapshot.ts`                                                                                 | `SNAPSHOT_COLUMNS` + 8                                                                                                      |
| Gateway     | `test/dto-contract.spec.ts`, `README.md`                                                                               | 95 → 103                                                                                                                    |
| Monolith    | `types/indicator.ts`, `types/prisma-stubs.d.ts`                                                                        | `sr_9..sr_16`                                                                                                               |
| Tests       | `test_sr2_levels_source.py` (new)                                                                                      | 36 tests (§3)                                                                                                               |
| Tests       | `test_sr_levels_source.py`, `test_economic_events.py`, `test_statistics_schema_sync.py`, `test_extended_statistics.py` | Pinned counts (95 → 103, 14 → 15 sources, 11 → 12 stat sources/enum)                                                        |
| Docs        | blueprint, deck summary, active/standby, MQL5 export list, `migration-stack-analysis.md`                               | Counts, manifest rows, §13 item 10 rollout                                                                                  |

The legacy EA (`SimpleDataCollector_v2_29_ASYNC_SOCKET.mq5`) was left at 87 fields and
`operation-service`'s narrow mirror was left unchanged, matching the 14th's precedent.
`frontend/` (separate stack) was not touched.

---

## 3. Verification

**`test_sr2_levels_source.py`, 36/36.** The header, the export prefix and every statistics label
are read **out of the `.mq5`**, not restated. The suite covers:

- real files through `run_cycle()`: a full valid cycle, a missing `S_R_Levels` file, each
  indicator's file unable to stand in for the other, and a close disagreement;
- no cross-talk between `sr_1..sr_8` and `sr_9..sr_16`, plus a registry-wide one-writer-per-column
  check;
- a 95-column deployed database brought to 103 by `open_db()` with history preserved and then
  promoting a cycle, the hand-run SQL migration, and the stale-schema startup guard;
- statistics staged as `sr2_levels`, the two statistic files staying separate, and enum parity;
- the point-in-time generator and both Prisma models;
- the migration being additive;
- one-chart coexistence: no object prefix, button name or export prefix is a prefix of the
  other's, and the buttons don't overlap;
- the 14th's four fixes carried over;
- a golden check, running the 14th's **real** captures (relabelled) through this registry.

**Mutation testing: 14 of 14 killed.** Every restore was verified byte-exact by sha256.

- **Python, 13:** `sr_9` dropped from the price guard; prefix collides with `SR_Levels`; staging
  order swapped; `migrate_market_data` unwired; `sr2_levels` excluded from `STAT_SOURCES`; enum
  not widened; view branch removed; `market_data` DDL missing `sr_16`; PIT not drifting; PIT
  labelled by name prefix again; contract missing `sr_12`; hand migration missing `sr_16`; startup
  guard removed.
- **TypeScript, 1:** `sr_9` dropped from `SNAPSHOT_COLUMNS` → `point-in-time-snapshot.spec.ts`
  fails.

**Live dry run.** The real collector CLI (`--once`, freshness guard **on**) ran against a
15-source export directory: 20 bars were promoted into **103** columns and the `0.00` sentinel
landed `NULL`. A payload built from a promoted row has exactly the 103 contract fields.
`verify_schema_contract()` returns True, and one statistics row was staged as `sr2_levels`.

**Cross-language checks.** That real payload validates against the **regenerated
`MarketDataDto`** under `whitelist` + `forbidNonWhitelisted`, and adding `sr_17` is rejected. The
real statistics element validates with `source: 'sr2_levels'`, and an unknown source is rejected
on `isIn`. This is the closed-contract behaviour the rollout order depends on, observed rather
than assumed.

**Suites:**

| Suite                                              | Result                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Python: `test_sr_levels_source`                    | 39/39                                                                                             |
| Python: `test_economic_events`                     | 14/14                                                                                             |
| Python: `test_push_economic_events`                | 13/13                                                                                             |
| Python: `test_stale_export_guard`                  | 9/9                                                                                               |
| Python: `test_statistics_schema_sync`              | all pass                                                                                          |
| Python: `test_centroid_watchdog`                   | 35/35                                                                                             |
| Python: `test_currency_gold_index_ohlc`            | 13/13                                                                                             |
| Python: `generate_point_in_time_schema.py --check` | OK                                                                                                |
| `railway-gateway`                                  | `tsc` clean; unit 6/6·93/93; e2e 4/4·43/43                                                        |
| Monolith                                           | `prisma validate` + `tsc` clean; `test:ci` **220/220·2881/2881**, identical to the prior baseline |

**⚠ Pre-existing failure, not caused here:** `test_extended_statistics.py` fails 15 checks
**before any edit in this session**. Its gitignored fixture folder
`davintrade-stack-d-and-e/engine-1-5-new/` was re-captured at 2026-09-20 17:12, after the test
hard-coded values from an earlier capture (committed 07:44). It fails the same 15 checks
afterwards, and the one line changed here (enum 11 → 12) passes. It needs its expected values
re-pinned against the current captures.

**Not verified:** there is no real `S_R_Levels_*` capture yet (§5e); MQL5 was not compiled here
(Davin's `.ex5`, dated 15:38, is newer than its source, 15:34); no disposable-Postgres rehearsal.
The migration is 16 nullable `ADD COLUMN`s, cross-checked byte-for-byte against `prisma migrate
diff`.

---

## 4. Rollout execution record

1. **Step 1 (Postgres Migration):** ✅ **APPLIED LIVE** (2026-09-22)
   - Executed `npx prisma migrate deploy --schema=prisma/market-data/schema.prisma`
   - Migration `20260922000000_add_market_data_v6_sr2_levels` applied cleanly to production Postgres (`turntable.proxy.rlwy.net:55082`).
   - Columns `sr_9..sr_16` are now live on `market_data_v6` (103 columns) and `market_data_point_in_time` (77 columns).
2. **Step 2 (Gateway Deploy):** ✅ **COMMITTED & PUSHED TO MAIN** (2026-09-22)
   - Pre-push validation passed all 220 test suites (2,881/2,881 tests green).
   - Committed in `59db1b49`: `feat(stack-c): integrate 15th indicator (S-R-AutoCalibration sr_9..sr_16) into pipeline`
   - Pushed to `origin/main` — triggering Railway Gateway auto-deployment.
3. **Step 3 (MT5 Charts on VPS):** ⏳ **PENDING (Davin)**
   - Attach `S-R-AutoCalibration_v2_29.ex5` to XAUUSD M5 + M15 on Terminal A and Terminal B **before** restarting the collector.
4. **Step 4 (VPS Files & Collector Restart):** ⏳ **PENDING (Davin)**
   - Deploy **three** files to VPS: `export_collector_validator_v2.py`, `backfill_worker_api_gateway_v5.py`, and `sqlite_schema_v6_xauusd.sql`.
   - Restart `MT5Collector` service (triggers `migrate_market_data()` to widen `xauusd.db` automatically).

---

## 5. What Davin still needs to do on Contabo VPS

The cloud/gateway half of this deployment is complete and live. The remaining physical steps on the Contabo VPS are:

1. **Attach Indicator 15 to MT5 charts (before restarting collector):**
   - Copy `mq5/S-R-AutoCalibration_v2_29.ex5` to `MQL5/Indicators/` on both Terminal A and Terminal B.
   - Attach to **XAUUSD M5** and **XAUUSD M15** on both terminals (4 attachments total).
   - **Give the 15th its own window:** Set distinct window anchors (`InpStartDateTime` / `InpEndDateTime` or `InpWindowMode`), because on defaults it duplicates the 14th exactly (§1.7).
   - Verify `S_R_Levels_XAUUSD_M5.txt` and `S_R_Levels_XAUUSD_M15.txt` begin exporting every minute at `:59`.
2. **Deploy THREE files to the VPS (§1.6):**
   - `export_collector_validator_v2.py`
   - `backfill_worker_api_gateway_v5.py`
   - `sqlite_schema_v6_xauusd.sql` (⚠️ **Mandatory:** contains `raw_sr2_levels` table definition; without it, `assert_staging_tables()` will refuse to start).
   - _(Optional)_ `migrate_sqlite_add_sr2_columns.sql` (if you prefer hand-running the `ALTER TABLE` beforehand).
3. **Restart Collector Service on VPS:**
   - Restart `MT5Collector`.
   - Its `migrate_market_data()` will automatically widen `market_data` in `xauusd.db` from 95 to 103 columns.
4. **Verify First Live Cycle:**
   - Confirm `S_R_Levels_XAUUSD_M5.txt` header matches `SOURCES['sr2_levels']` (12 columns: `timestamp / symbol / timeframe / close / sr_9..sr_16`).
   - Confirm `MT5Collector` logs show 14 per-bar sources validated and cycle promoted cleanly with 103 columns.
   - Confirm Railway Gateway logs show HTTP 200 OK without any quarantined payloads.
5. _(Optional)_ Re-pin `test_extended_statistics.py` to the current `engine-1-5-new` captures (§3).
