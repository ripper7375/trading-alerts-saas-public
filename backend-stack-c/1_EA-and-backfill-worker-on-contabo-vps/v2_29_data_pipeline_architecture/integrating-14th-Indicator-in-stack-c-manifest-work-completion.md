# Integrating the 14th Indicator (Support & Resistance) into Stack C — Work Completion Report

**Status:** **STEPS 1, 2, AND 3 COMPLETED AND DEPLOYED LIVE; STEPS 4 & 5 REMAINING FOR VPS.**

- **Step 1 (Git Commits):** 5 structured commits executed cleanly and pushed to `main`.
- **Step 2 (Postgres Migration):** `20260916000000_add_market_data_v6_sr_levels` applied cleanly to Railway production Postgres (`maglev.proxy.rlwy.net:58290`). Columns `sr_1..sr_8` are now live on `market_data_v6`.
- **Step 3 (Railway Gateway Deploy):** Auto-deployed to Railway (`bae5908b-ee0c-4216-a43e-9733f54005a8`), status `SUCCESS` / `Online`, health checks passing (`GET /api/v1/health` 200 OK).
- **Remaining:** VPS rollout (Step 4: SQLite widening + worker restart; Step 5: attach `SupportAndResistantAutoCalibration_v2_29.mq5` to MT5 charts).
  **Type:** Ad-hoc session (Davin-requested directly in chat) — outside the phase/session
  numbering, per `docs/migration-orders/EXECUTOR-PROTOCOL.md` §6. Recorded as one `CLAUDE.md`
  ad-hoc entry dated 2026-09-16.

> **Scope note:** this document covers onboarding one new MQL5 data producer —
> `SupportAndResistantAutoCalibration_v2_29.mq5` — end to end through the v6 pipeline. It adds 8
> price-level columns and one staging table; it does not change how any existing source is
> collected, validated or promoted. It sits directly on the v6 pipeline — see
> [`DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md`](DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md),
> whose §0.1 / §0.4 / §0.5 / §2 / §4 / §5 / §8 / §13 / Appendix A this work amended.
> Architecture design, now carrying an implementation record and three inline corrections:
> [`ARCHITECTURE_DESIGN_14TH_INDICATOR_SUPPORT_AND_RESISTANCE.md`](ARCHITECTURE_DESIGN_14TH_INDICATOR_SUPPORT_AND_RESISTANCE.md).

---

## 1. What was built

### 1.0 The design document was mostly right, and the parts that were wrong were the dangerous parts

Davin supplied a complete technical specification and asked for a feasibility review plus the
implementation. Three parallel Explore passes read the live code first — the Python/SQLite layer,
the downstream TypeScript/Prisma layer, and the `.mq5` source itself — before any edit, per
`EXECUTOR-PROTOCOL.md` §0's "live code wins".

**The MQL5 half of the specification is accurate as written and was confirmed line by line.**
The filename pattern, the 12-column TSV header, the empty-string null convention and the
`_Statistic.txt` block all match the live `.mq5` exactly. Better: its timestamp already uses the
**fixed** `TimeTradeServer()`-rounded-to-the-hour form rather than the `TimeCurrent()` bug
corrected across the other 13 indicators on 2026-09-09 — so this indicator was written after,
and against, that fix.

**Three of the pipeline claims did not survive contact with the live code.** Each would have
produced a production failure if implemented as written, and each is now corrected inline in the
design document rather than quietly fixed, so the reasoning survives:

| §      | The claim                                                     | What the live code does                                                                                                                                      |
| ------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| §6.1   | `migrate_raw_tables()` handles new tables and columns on boot | It skips tables that do not yet exist, and its docstring states it deliberately never touches `market_data`. **The 8 columns had no automatic path at all.** |
| §4.2.3 | Add `'sr_levels'` to `STAT_SOURCES`                           | `STAT_SOURCES` is a _derived_ blacklist, so this is a no-op — and the auto-enrollment it describes would **break a working lane**.                           |
| §4.5   | Downstream = the railway-gateway Prisma schema                | 10 files, because the contract JSON generates the DTO and a test diffs both Prisma schemas order-sensitively.                                                |

### 1.1 The finding that would have crash-looped the collector

`sqlite_schema_v6_xauusd.sql` is entirely `CREATE TABLE IF NOT EXISTS`, which is a **silent
no-op** against a database that already exists. `open_db()` re-runs the whole schema file on
every collector start, so adding 8 columns to the `market_data` DDL does **not** widen a
deployed `xauusd.db`. And `migrate_raw_tables()` — the function the design document names as the
safety net — is staging-only by explicit design, and additionally returns early for any table
that does not yet exist.

`raw_sr_levels` itself is fine: new _tables_ do arrive, via that same `executescript`. It is
`market_data` that had nothing.

Left unhandled, `promote_cycle()` names `sr_1` in its INSERT, SQLite raises
`OperationalError: table market_data has no column named sr_1`, and **nothing in `run_cycle()`
catches it** — so the collector crash-loops on the first validated cycle after deployment rather
than degrading. A full outage from a forgotten manual step.

**Resolved by a new `migrate_market_data()`**: additive-only (`ALTER TABLE ... ADD COLUMN`, never
DROP, RENAME or backfill), derived from `SOURCES` through `market_data_column()` — the same pair
of functions `promote_cycle()` itself uses to build its INSERT, so the two cannot disagree about
what a column is called — and wired into `open_db()` beside `migrate_raw_tables()`. A nullable
`ADD COLUMN` with no default is a catalog-only change in SQLite, so existing history is untouched;
that distinction is the whole safety argument, and `migrate_raw_tables()`'s docstring was narrowed
from "market*data is never touched" to the accurate "never \_destructively* touched".

Davin chose **both** belt and braces, so `migrate_sqlite_add_sr_columns.sql` also ships for
operators who prefer to widen the database as an explicit, reviewable step before starting the
service. Running either, or both, is safe.

### 1.2 The statistics decision — a no-op that was also a regression

`STAT_SOURCES` is `[s for s in SOURCES if s not in ('ohlcv', 'zigzag', 'zscore')]`. Adding a
source to `SOURCES` therefore enrolls it automatically; there was nothing to add. **The real work
was the opposite decision**, and three independent reasons pointed the same way:

1. **The vocabulary does not match.** `indicator_statistics` and `STAT_FIELDS` speak regression
   fit quality — MODEL A / MODEL B residuals (R², MSE, Var Ratio, Skewness, Kurtosis) and
   EDT-channel containment. The SR statistic file speaks Freedman-Diaconis calibration — Q25, Q75,
   IQR, Optimal Step, Fractals Sample, Total Macro Clusters. Only the window timestamps overlap.
   Ingesting it writes a near-empty row every cycle.
2. **It would break a working lane.** `gateway_contract_indicator_statistics.schema.json` pins
   `source` to a **closed 10-value enum**, and that POST is **batched** — so one `sr_levels`
   element 400s the _entire request_ and quarantines every other snapshot in that cycle (~22 of
   them).
3. **`config_params` is not an escape hatch either.** It exists for _compiled_ configuration,
   deduplicated by `config_hash` so that a new hash **is** the "someone reconfigured this
   indicator" signal. The IQR values are re-derived observations that change every cycle; putting
   them there would mint a new hash per cycle and destroy that signal.

`sr_levels` is now **explicitly excluded** from `STAT_SOURCES`, with the reasoning inline above
that line and pinned by two tests so it cannot be silently re-enrolled. MT5 still writes the file;
nothing reads it. Capturing it properly is its own scoped piece of work (§7).

### 1.3 Full validation enrollment — a deliberate cost, now demonstrated

Adding `sr_levels` to `SOURCES` automatically enrolls it in `PER_BAR_SOURCES`, which is what the
design document intends ("+1 validated key source"). The consequence is real and was put to Davin
explicitly: a missing or stale `SR_Levels_XAUUSD_{TF}.txt` now rejects the **entire cycle** — no
`market_data` rows at all, price included.

Davin chose full enrollment. It is architecturally consistent — every per-bar source is mandatory
today, and cross-source close agreement is the pipeline's core integrity guarantee — and the cost
is no longer a hypothesis: `test_a_missing_sr_export_rejects_the_whole_cycle` pins it, and a live
`--once` run with the file removed was confirmed to reject after 3 attempts with
`missing export files: SR_Levels_XAUUSD_M5.txt`.

### 1.4 The bare header — the only source in the pipeline that does this

Every other source prefixes its export columns (`Best_Resistance`, `Resistance_timestamp`,
`Best_Fit_A_ssa`). This one writes them bare:

```
timestamp	symbol	timeframe	close	sr_1	sr_2	sr_3	sr_4	sr_5	sr_6	sr_7	sr_8
```

That parses without a special case, because `parse_export_file()` reads the four keys
**positionally** (columns 0–3) and data columns **by name**. But it works by an accident of
design rather than by intent, so it is now written down in
`data-split-between-mql5-and-python/Export Data from MQL5 indicators.txt` — the authoritative
record of literal export headers — and pinned by
`test_registry_headers_match_the_indicators_real_header`.

### 1.5 The 0.00 sentinel — why `sr_*` are listed explicitly

The indicator writes an unresolved slot as an **empty field**, which `parse_export_file()` already
maps to NULL. But a slot holding a non-positive value exports as `0.00`, and a $0.00 XAUUSD
"support level" reaching the alert engine is exactly the defect the 2026-09-08 ingestion guard
exists to prevent.

`sr_1`..`sr_8` match **neither** `PRICE_LEVEL_COLUMNS`' base set **nor** `PRICE_LEVEL_SUFFIXES` —
a numeric slot name has no suffix to key off. They are therefore listed explicitly, with a comment
saying why, and the mutation check below proves that listing is load-bearing.

---

## 2. Files changed

| File                                                                      | Change                                                                                                                                      |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `sqlite_schema_v6_xauusd.sql`                                             | `raw_sr_levels` (new table); 8 `sr_N REAL` in `market_data` (87→95); `v_validation_keys` branch + `DROP VIEW`                               |
| `export_collector_validator_v2.py`                                        | `SOURCES['sr_levels']`; `sr_*` into `PRICE_LEVEL_COLUMNS`; `STAT_SOURCES` exclusion; **new `migrate_market_data()`** wired into `open_db()` |
| `backfill_worker_api_gateway_v5.py`                                       | `EXPECTED_CONTRACT_FIELDS` +8; module-level `assert` 87 → **95**                                                                            |
| `gateway_contract_market_data.schema.json`                                | 8 optional nullable `sr_*` properties after `best_support`                                                                                  |
| `migrate_sqlite_add_sr_columns.sql`                                       | **Added.** One-off VPS `market_data` widening (the belt to `migrate_market_data()`'s braces)                                                |
| `test_sr_levels_source.py`                                                | **Added.** 28 standalone tests (no pytest infra in this stack), incl. 4 golden tests on real captures                                       |
| `test_economic_events.py`                                                 | Its `market_data` column-count guard 87 → **95**                                                                                            |
| `railway-gateway/prisma/schema.prisma`                                    | 8 `Float?` after `best_support`                                                                                                             |
| `prisma/market-data/schema.prisma`                                        | The **byte-identical** block; model doc comment 87 → 95 fields                                                                              |
| `railway-gateway/src/gateway/dto/market-data.dto.ts`                      | **Regenerated** via `npm run generate:dto` — never hand-edited                                                                              |
| `railway-gateway/test/dto-contract.spec.ts`                               | Test name and `toBe(87)` → **95**                                                                                                           |
| `railway-gateway/README.md`                                               | "87-field `MarketDataDto`" → 95                                                                                                             |
| `types/indicator.ts`                                                      | Interface +8; two "87 fields" header comments → 95                                                                                          |
| `types/prisma-stubs.d.ts`                                                 | The duplicated ambient interface +8                                                                                                         |
| `operation-service/prisma/schema.prisma`                                  | **Comment only** — the upstream model's field count. The mirror itself is deliberately unchanged (§7)                                       |
| `prisma/migrations/20260916000000_add_market_data_v6_sr_levels/`          | **Added.** 8 × `ADD COLUMN ... DOUBLE PRECISION`. **Authored, NOT applied**                                                                 |
| `SimpleDataCollector_v2_29_ASYNC_SOCKET.mq5`                              | **Comments only** — annotated as deliberately left at 87 fields (§7)                                                                        |
| `DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md`                             | §0.1, §0.4 (+1 row), §0.5, §1, §2, §4, §5.1, §5.3, §5.5, §6, §8.1, §8.3, §9, §13 item 7 (new), Appendix A                                   |
| `ARCHITECTURE_DESIGN_14TH_INDICATOR_SUPPORT_AND_RESISTANCE.md`            | Implementation-record header; §4.2.3 / §4.5 / §6.1 corrections; new §6.3 live-code findings                                                 |
| `ARCHITECTURE-SUMMARY-FOR-DECK.md`                                        | Source table +1 row, 87→95, and the Engine-1.5 column-position table (all offsets shift by 8)                                               |
| `ACTIVE-STANDBY-TERMINAL-ARCHITECTURE.md`                                 | 26 → **28** EDT attachments per alternating terminal, in all 8 places                                                                       |
| `data-split-between-mql5-and-python/Export Data from MQL5 indicators.txt` | The SR block, incl. the bare-header deviation and the look-ahead note                                                                       |
| `docs/migration-orders/migration-stack-analysis.md`                       | `market_data_v6` heading 87→95; new migration entry with the rollout-order warning                                                          |
| `integrating-14th-Indicator-in-stack-c-manifest-work-completion.md`       | **Added.** This document                                                                                                                    |
| `CLAUDE.md`                                                               | One ad-hoc session entry, dated 2026-09-16                                                                                                  |

**What needed no change, verified rather than assumed:** `railway-gateway`'s
`market-data.controller.ts`, `validation.service.ts` and `market-data.processor.ts` (whole-object
upsert, field-agnostic — proven by the e2e suite passing untouched); `app/api/market-data/channel/
route.ts` and `useMtfOverlay.ts` (variant-parametrized, and `ChannelPoint`'s `{upper, mid, lower}`
shape does not fit 8 flat levels); `operation-service`'s `MarketDataV6` model and
`market-data.schemas.ts`; the DTO generator's `TARGETS` array.

---

## 3. Test verification

| Suite / check                                         | Result                                                                                    |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `test_sr_levels_source.py` (new)                      | **28/28 passing**                                                                         |
| `test_stale_export_guard.py`                          | **Green** — registry-driven, so it covers the new source for free                         |
| `test_economic_events.py`                             | **Green** after its 87→95 column guard was updated                                        |
| `test_push_economic_events.py`                        | **Green**, unaffected                                                                     |
| `test_currency_gold_index_ohlc.py`                    | **13/13**, unaffected (separate lane)                                                     |
| `python -m py_compile` on both changed scripts        | Clean                                                                                     |
| `sqlite_schema_v6_xauusd.sql` applied fresh           | **95 `market_data` columns, 14 `raw_*` tables, 13 `v_validation_keys` branches**          |
| `verify_schema_contract()` — the pipeline's own guard | **True** against the fresh schema: SQLite ↔ worker agree at 95, none missing, none extra |
| Contract JSON ↔ worker frozenset                     | Set-equal at 95 (set-based, never count-based — the contract carries a pseudo-property)   |
| railway-gateway `tsc --noEmit`                        | Clean                                                                                     |
| railway-gateway `npm test`                            | **5/5 suites · 68/68 tests**                                                              |
| railway-gateway `npm run test:e2e`                    | **4/4 suites · 43/43 tests** — real HTTP through the live Express adapter                 |
| Monolith `tsc --noEmit` (after `prisma generate`)     | Clean                                                                                     |
| Monolith `eslint` on changed files                    | Clean                                                                                     |
| Monolith `npm run test:ci`                            | **218/218 suites · 2850/2850 tests** — exact baseline, zero regressions                   |
| `prisma migrate diff --from-empty`                    | All 8 columns generate as `DOUBLE PRECISION` — matches the hand-authored migration        |

The gateway e2e suite passing **untouched** is the load-bearing result in that list: it is what
proves the controller, validation service and worker processor are genuinely field-agnostic,
rather than merely believed to be.

### 3.1 Golden verification against real captured MT5 exports

Everything above is synthetic. A `git grep` sweep late in the session found **two genuine
captures** that an earlier search had missed (a `Glob` timed out and a `find` was inconclusive):
`excel-calculation/data-export/SR_Levels_XAUUSD_M5.txt` and
`excel-calculation/data-import-to-excel/SR_Levels_XAUUSD_M5.txt`, ~500 bars each, February 2026.
Four permanent tests now run against them, skipping rather than failing if the fixtures move.

| Check                                        | Result                                                                                  |
| -------------------------------------------- | --------------------------------------------------------------------------------------- |
| Header vs. the `SOURCES` registry            | **Byte-for-byte identical**, both files                                                 |
| Rows parsed                                  | **1,001**, zero key-column anomalies                                                    |
| Supports strictly **below** close            | **0 violations**                                                                        |
| Resistances strictly **above** close         | **0 violations**                                                                        |
| Nearest-first ordering within each group     | **0 violations**                                                                        |
| Non-positive value surviving the price guard | **0**                                                                                   |
| Unresolved slots                             | `sr_1` populated on all 501 bars; `sr_8` on only **86** — unresolved slots are the norm |

This is materially stronger than the header check alone. The ordering invariant **is** the meaning
of the slots: an off-by-one in the indicator's support loop would still produce a perfectly
well-formed file, and only a semantic check against real prices catches it.

**And one capture carries the historical timestamp bug, which turned out to be useful.**
`data-import-to-excel` has a **constant 298-second sub-bar phase across all 500 rows** — the exact
`TimeCurrent()` signature documented in the blueprint's §7.1 and in `parse_export_file()`'s own
comment. The collector's defensive grid snap repaired every one. That belt-and-braces path is now
proven on real data instead of trusted from a comment. `data-export` is on-grid at phase 0.

---

## 4. Mutation verification — proving the tests are load-bearing

This stack ships no UI, so there is no browser check to run. The equivalent proof is a mutation
check: break each guard and confirm the tests actually fail.

| Mutation                                                 | Tests failed | Result     |
| -------------------------------------------------------- | ------------ | ---------- |
| `sr_*` removed from `PRICE_LEVEL_COLUMNS`                | 3            | **KILLED** |
| `migrate_market_data()` neutered (returns 0 immediately) | 3            | **KILLED** |
| `migrate_market_data()` unwired from `open_db()`         | 1            | **KILLED** |
| `sr_levels` re-enrolled in `STAT_SOURCES`                | 1            | **KILLED** |
| `sr_*` stripped from the `market_data` DDL               | 8            | **KILLED** |

**5/5 killed.** The third is worth calling out: only `test_open_db_widens_a_pre_change_database`
catches it, and that test was added specifically because calling `migrate_market_data()` directly
proves the function works while proving nothing about whether it is actually **wired** — which is
the only thing standing between a stale database and a crash-looping collector.

**The harness could not leave a file modified.** Restores ran unconditionally in a `finally`
rather than only on success, and were verified **byte-exact by sha256** for both targets, with a
final green run afterwards — per this repo's own recorded lesson that a crashed mutation harness
leaving the target mutated is a genuinely dangerous failure mode.

### 4.1 Live end-to-end dry run

A synthetic 14-file export directory was generated from the `SOURCES` registry itself and run
through the real collector:

```
python export_collector_validator_v2.py --once --no-market-hours \
    --export-dir <tmp> --db <tmp>/xauusd.db --timeframes M5
```

**Result:** 14 sources staged, cycle `validated`, **20 bars promoted**, `market_data` at 95
columns. `sr_1`/`sr_2`/`sr_5`..`sr_8` populated; `sr_3` NULL from the empty field; `sr_4` NULL
from the `0.00` sentinel — and **zero rows with `sr_4 = 0`**, confirming the guard fired rather
than the value merely being absent.

A payload built from a **real promoted row** carried exactly **95 fields** (none missing, none
extra, 2,517 bytes) with `sr_3`/`sr_4` serialising as JSON `null`, not `0`.

The negative case was run too: with `SR_Levels_XAUUSD_M5.txt` removed, the cycle is rejected after
3 attempts — the accepted cost of full `PER_BAR_SOURCES` enrollment, demonstrated rather than
assumed.

---

## 5. ⚠ Rollout order — executed and verified

**Order followed strictly: (1) migration → (2) railway-gateway deploy → (3) VPS.**

1. **Step 2 — Postgres Migration: COMPLETED & LIVE (2026-09-16 12:49:34 +07:00)**
   Applied before Railway Gateway deployed, preventing any 400 rejection quarantine on the VPS worker.
   Columns `sr_1..sr_8` are live on `market_data_v6` in production (`maglev.proxy.rlwy.net:58290`).
2. **Step 3 — Railway Gateway Deploy: COMPLETED & ONLINE (2026-09-16 12:54:28 +07:00)**
   Triggered via `git push origin main`. Pre-push hook verified all 2,850 tests green.
   Railway built Docker image (`nest build`), deployment `bae5908b-ee0c-4216-a43e-9733f54005a8` reached `SUCCESS` / `Online`. Verified live via `/api/v1/health` (200 OK, database latency 33ms).
3. **Step 4 & 5 — VPS Rollout: PENDING**
   SQLite widening + collector + push worker + MT5 chart attachment on Contabo VPS.

---

## 6. What you still need to do

### 6.1 Apply the migration to production — **COMPLETED (2026-09-16 12:49:34 +07:00)**

Applied `prisma/migrations/20260916000000_add_market_data_v6_sr_levels/` against
`maglev.proxy.rlwy.net:58290` via `prisma.production.config.ts`.

- `prisma migrate status` verified all 23 prior migrations were already applied and only this one was pending.
- `prisma migrate deploy` applied `20260916000000_add_market_data_v6_sr_levels` cleanly.
- `market_data_v6` now carries `sr_1`..`sr_8` as `DOUBLE PRECISION` nullable columns.
- Temporary credentials in `.env.production.local` were deleted immediately after deployment.

### 6.2 Deploy Railway API Gateway — **COMPLETED (2026-09-16 12:54:28 +07:00)**

- Pushed 5 commits to `origin/main` (`2e732cf2..c35d9381`). Pre-push hooks passed all 2,850 tests across 218 test suites with 0 failures.
- Railway detected the push and built the container (`nest build` succeeded).
- Deployment `bae5908b-ee0c-4216-a43e-9733f54005a8` reached **`SUCCESS` / `Online`**.
- Live health check verified: `GET https://railway-gateway-production-3796.up.railway.app/api/v1/health` responded `{"status":"healthy", ...}`.

### 6.3 Widen the VPS SQLite `market_data` & Restart Worker — **NEXT UP (Step 4)**

Either run `migrate_sqlite_add_sr_columns.sql` by hand via `sqlite3`, or let `migrate_market_data()`
widen it automatically on boot when the updated collector starts. Then restart `backfill_worker_api_gateway_v5.py`.

### 6.4 Attach the indicator on the VPS — **NEXT UP (Step 5)**

XAUUSD **M5 and M15**, and identically on the standby terminal when it exists (§8.3's parity
rule). The binary is compiled and current (`SupportAndResistantAutoCalibration_v2_29.ex5`,
2026-09-16 06:41, newer than its source).

**⚠ Decommission the predecessor first if it is attached anywhere.**
`mql5-indicators/mlq5-indicator-export/support-resistant-export/SupportAndResistant_v2_29.mq5` —
a different, earlier indicator using ATR-based bin stepping rather than Freedman-Diaconis IQR —
**also defaults to `InpExportFileName = "SR_Levels"`**. Attached together for the same symbol and
timeframe, the two truncate each other's export and statistic files at `:59`, producing
non-deterministic content with two different statistic-file schemas. Nothing errors.

### 6.5 Diff a first real export before trusting a green cycle

**No capture of this indicator's export from the production terminal exists anywhere in the
repo.** The two golden fixtures (§3.1) are real MT5 output and are strong evidence, but they are
from February 2026 and from a different machine. Confirm a live
`SR_Levels_XAUUSD_M5.txt` header against `SOURCES['sr_levels']` before treating a validated cycle
as proof the lane is correct.

### 6.6 Smaller, non-blocking follow-ups

- **Commit & Push: COMPLETED.** All 5 commits completed and pushed to `origin/main` (see §8).
- **Post-change greps must exclude `.claude/`.** A stale, git-excluded worktree
  (`youthful-almeida-c498fa`, detached at `25dd623c`, 2026-07-20, pre-dating the `best_fit` split)
  still reads `toBe(79)`. `rg`/`git grep` skip it; plain `grep -r` does not, and will produce a
  wall of false "missed a spot" hits.

---

## 7. Explicitly out of scope

- **SR statistics capture.** Deliberately deferred (§1.2). Doing it properly means new columns in
  `indicator_statistics`, new `STAT_FIELDS` entries, both Prisma mirrors, the stats contract's
  closed `source` enum, and a second production migration — for data nothing consumes yet. MT5
  keeps writing `SR_Levels_XAUUSD_{TF}_Statistic.txt`; nothing reads it. Note for whoever builds
  it: that file's section headers use an **ASCII hyphen** where the other ten producers use an em
  dash, and `parse_statistic_file()` matches sections by prefix precisely because FILE_ANSI mangles
  the em dash — so the parser will need checking, not just extending.
- **`operation-service`'s `MarketDataV6` mirror.** A deliberately narrow 21-column projection of
  only the centroid channel triples its chart proxy reads — it carries no `best_resistance` or
  `best_support` either. On its own "mirror only what you read" precedent, `sr_*` belong there only
  if a reader appears.
- **The legacy EA (`SimpleDataCollector_v2_29_ASYNC_SOCKET.mq5`).** Left at 87 fields, and its
  comments now say so rather than carrying a number that would be false. It is not in the v6 data
  flow, and _adding_ an indicator cannot break its `OnInit` — unlike the 2026-09-03 rename, which
  genuinely could have.
- **Surfacing `sr_*` in the app.** `ChannelPoint`'s `{upper, mid, lower}` shape does not fit 8 flat
  levels; exposing these would be a new endpoint, not an edit to the existing chart route.
- **The indicator's own defects**, flagged for Davin, not fixed — the export is 3,001 rows rather
  than 3,000 (inclusive loop: 3,000 closed bars plus the forming bar, consistent with the other
  producers); `ExportSRData(bool is_backfill)` never reads its parameter, so the "Backfill" button
  is identical to "Export"; the early return on unchanged `rates_total` makes the intra-bar
  price-move trigger unreachable; and `sr_*` are hardcoded to 2 decimals while `close` uses
  `_Digits` (identical on XAUUSD, not portable to a 5-digit symbol).

**One characteristic worth stating plainly rather than leaving implicit.** `ArrayLevels` is
resolved **once** from the fixed `[InpStartDateTime, InpEndDateTime]` window, then re-bucketed
against each exported bar's own close. So a historical bar carries **today's** level set sorted
around its own price — not the levels as they stood at that time. This is the same class of
look-ahead that `HISTORICAL-VALUES-LOOK-AHEAD-BIAS-OPEN-ISSUE.md` documents for the centroid
families, and stronger, because the level set is not merely refitted but wholly external to the
bar. Fine for a live snapshot and for alerting, which is what these columns are for. **Invalid for
backtesting, walk-forward validation, or any fitness scoring** — and it must not be quietly
assumed otherwise the first time someone reaches for 3,000 bars of `sr_*` history.

---

## 8. Git history

**All changes committed and pushed to `origin/main`** (`c35d9381`).
Executed across 5 atomic commits matching `EXECUTOR-PROTOCOL.md` §2's "never batch a whole session into one commit":

| Commit     | Scope           | Description                                                                                | Files                                      |
| :--------- | :-------------- | :----------------------------------------------------------------------------------------- | :----------------------------------------- |
| `99ccc295` | `feat(stack-c)` | `add raw_sr_levels, market_data 87->95, migrate_market_data(), and SQLite widening script` | 4 (schema, collector, worker, script)      |
| `7b1ea753` | `feat(stack-c)` | `update gateway contract, DTO, Prisma schemas and migration for sr_1..sr_8`                | 9 (schema, DTO, types, migration)          |
| `33f9209e` | `test(stack-c)` | `add test_sr_levels_source.py and update column guards 87->95`                             | 3 (test suite, spec)                       |
| `b7d600fd` | `feat(mql5)`    | `add SupportAndResistantAutoCalibration_v2_29 indicator and ex5`                           | 4 (source and compiled binary)             |
| `c35d9381` | `docs(stack-c)` | `update blueprint, design doc, summary deck, and completion report for 14th indicator`     | 10 (docs, blueprint, manifests, CLAUDE.md) |

Pre-commit hooks (`lint-staged`, `eslint`, `prettier`) and pre-push hooks (TypeScript type-check and full 2,850 Jest test suite across 218 test files) passed 100% green before push to `origin/main`.

_(Note: `davintrade-stack-d-and-e/engine-1-5/engine-1-5-model.xlsx` was unmodified by this work and kept unstaged/excluded)._
