# Data Collection Pipeline — Architecture Blueprint (v2.29 / v6 Stack)

**Status:** Authoritative reference ("the bible") for the XAUUSD data-collection
pipeline. **MQL5 is the single source of every value** (2026-09-09) — the Python
calc stack was removed from the pipeline and parked; see §6.
**Last Updated:** 2026-09-09

> **2026-09-09 — two architecture changes.**
>
> **1. The MT5↔Python calculation split is gone.** All 83 `market_data` data
> fields are computed and exported by the 13 MQL5 indicators; the collector
> parses, validates and forwards them and calculates nothing. The 4 Python calc
> modules and their certification harness are parked (not deleted) in
> `calculation-split-between-mt5-and-python-PENDING-PROJECT/`, which documents
> what they did, the one capability this costs (arbitrary-parameter
> recomputation — see that folder, and the now-BLOCKED decision-layer
> blueprint), and how to revive them.
>
> **2. The `timestamp_adj` gating item is resolved at source.** It was never a
> missing "conversion stack" — it was a one-line bug present in all 13
> indicators: `gmt_offset = TimeCurrent() - TimeGMT()`. `TimeCurrent()` returns
> the _last tick's_ time, so the offset absorbed "seconds since the last tick"
> and stamped it on every exported row as a constant sub-bar phase. Fixed in all
> 16 sites to a `TimeTradeServer()` offset rounded to the hour. See §7.
>
> ⚠ **The MQL5 fix is inert until all 13 indicators are recompiled in
> MetaEditor and the `.ex5` files redeployed to the VPS terminal.**
> **Scope:** Full market-data pipeline on the Contabo VPS —
> MT5 chart indicators → auto-exported `.txt` files → collect / validate /
> **calculate** / promote (SQLite `xauusd.db`) → push to the Railway API Gateway.
> **Symbol/timeframes in scope:** XAUUSD, M5 and M15 only.

> **How to read this document.** §0 is the complete file manifest — start there.
> §1–§3 are the architecture and the MQL5↔Python data split (the core idea).
> §4–§7 are the data contract, components, calculation stack, and validation.
> §8–§10 are deployment, gateway contract, and the operations runbook.
> §11–§13 are failure modes, accepted trade-offs, and remaining work.
> §14 documents the **legacy EA socket-push path**, retained for reference but
> **not part of the v6 data flow** (decision §3.3).

---

## 0. File Manifest (single source of truth for "what is in this stack")

All paths are relative to
`backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/`
unless noted. Every file in the stack is listed here; if it's not here, it's
not part of the deployment.

### 0.1 Runtime — the pipeline that runs in production

| File                                       | Role                                                            | Ref   |
| ------------------------------------------ | --------------------------------------------------------------- | ----- |
| `mq5/` (13 indicators, see §0.4)           | Data producers: compute + auto-export **every** value as `.txt` | §5.1  |
| `export_collector_validator_v2.py`         | Pipeline engine: COLLECT → ADJUST → VALIDATE → PROMOTE          | §5.2  |
| `sqlite_schema_v6_xauusd.sql`              | `xauusd.db` schema: staging + validation + `market_data`        | §5.3  |
| `backfill_worker_api_gateway_v5.py`        | Push worker: `market_data WHERE synced_at IS NULL` → gateway    | §5.4  |
| `gateway_contract_market_data.schema.json` | JSON-Schema of the POST body the gateway must accept            | §9    |
| `install_services.bat`                     | Windows/NSSM installer for the VPS services                     | §8.2  |
| `replay_quarantine.py`                     | Re-POST gateway-rejected rows after a fix                       | §10.2 |

### 0.2 Legacy (retained for reference; NOT in the v6 data flow — §14)

| File                                         | Role                                                                                                      | Ref   |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----- |
| `SimpleDataCollector_v2_29_ASYNC_SOCKET.mq5` | EA socket-push producer (legacy path); on the v6 terminal its only job is keeping charts/indicators alive | §14.1 |
| `mt5_api_relay_for_v2_29.py`                 | Local async TCP relay for the legacy socket path                                                          | §14.2 |

### 0.3 Parked — `calculation-split-between-mt5-and-python-PENDING-PROJECT/`

Everything the removed calculation split consisted of, kept intact and revivable
(2026-09-09): the 4 calc modules (`centroid_regression.py`, `fractal_lines.py`,
`zigzag_metrics.py`, `zscore_candle.py`), the whole
`mql5-to-python-transliteration/` certification harness and its evidence, the
original "Python stacks calculation.txt" mandate, and
`CALCULATION-SPLIT-ARCHITECTURE-PENDING.md` explaining the architecture, what
parking it costs, the two open bugs to fix before any revival, and how to
restore it.

**None of this is deployed to the VPS and none of it runs.** See §6.

### 0.4 The 13 export indicators — `mq5/`

Filenames are hyphen-free (MQL5 indicator names); the EA's `iCustom()` and the
collector's file-prefix map both depend on these exactly.

> **2026-09-03 — `best_fit` split into `best_fit_a`/`best_fit_b`:** the former
> single `2EDTCentroidRegressionBestFitNonMostRecent_v2_29.mq5` indicator was
> replaced by two indicators run in **isolated coexistence** on the same
> chart (separate object namespaces, separate export buttons/corners): `A`
> ("Primary Instance") is numerically **identical** to the old `best_fit`
> (`InpRegCentroids=5`, `InpExcludeRecentCentroids=0`); `B` ("Secondary
> Instance") is a **new** preset (`InpExcludeRecentCentroids=3`, mirroring
> the existing Non-A/Non-B pair). See §3.4 and `CERTIFICATION.md` for the
> certification-status implications.

| `mq5/` file                                                   | Export-file prefix (`InpExportFileName`) | Collector source key |
| ------------------------------------------------------------- | ---------------------------------------- | -------------------- |
| `2EDTCentroidRegressionBestFitNonMostRecentA_v2_29.mq5`       | `Centriod_Best_Fit_A`                    | `best_fit_a`         |
| `2EDTCentroidRegressionBestFitNonMostRecentB_v2_29.mq5`       | `Centriod_Best_Fit_B`                    | `best_fit_b`         |
| `2EDTCentroidRegressionCherryPickA_v2_29.mq5`                 | `Cherry-Pick-A`                          | `cherry_a`           |
| `2EDTCentroidRegressionCherryPickB_v2_29.mq5`                 | `Cherry-Pick-B`                          | `cherry_b`           |
| `2EDTCentroidRegressionMostRecentLineExtension_v2_29.mq5`     | `Most-Recent`                            | `most_recent`        |
| `2EDTCentroidRegressionNonMostRecentLineExtensionA_v2_29.mq5` | `Non-Recent-A`                           | `non_a`              |
| `2EDTCentroidRegressionNonMostRecentLineExtensionB_v2_29.mq5` | `Non-Recent-B`                           | `non_b`              |
| `2EDTFractalBestFitv5_v2_29.mq5`                              | `Fractal_EDT`                            | `fractal_edt`        |
| `SingleBestResistanceLinev3_v2_29.mq5`                        | `Resistance_Line`                        | `resistance`         |
| `SingleBestSupportLinev3_v2_29.mq5`                           | `Support_Line`                           | `support`            |
| `ZigZagExportv43_v2_29.mq5`                                   | `ZigZag`                                 | `zigzag`             |
| `ohlcvexportlightweight_v2_29.mq5`                            | `OHLCV`                                  | `ohlcv`              |
| `zscoreohlccandleexport_v2_29.mq5`                            | `ZScore`                                 | `zscore`             |

> The export-file prefix is set by each indicator's `InpExportFileName` input
> and is **independent of the `.mq5` filename** — so renaming the `.mq5` files
> changed the EA's `iCustom()` names (§5.1) but NOT the collector's file map.

### 0.5 Reference data & specs

| Path                                                                      | Role                                                                        |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `data-split-between-mql5-and-python/Export Data from MQL5 indicators.txt` | The authoritative list of columns MQL5 exports (§3.1)                       |
| `data-split-between-mql5-and-python/Python stacks calculation.txt`        | The authoritative list of values Python calculates (§3.2)                   |
| `sqlite_schema_v6_xauusd_preview.txt`                                     | Excel-openable preview of every v6 table with mock rows                     |
| `mock-data-from-indicators/golden_certification/` (repo root)             | The certified 3000-bar export batch (24 timeseries + 18 stat files, M5+M15) |

---

## 1. Design Goals

1. **Single source of truth = validated export files.** All 13 indicators
   export per-bar `.txt` files; the collector cross-validates them and promotes
   one coherent `market_data` row per bar.
2. **MQL5 computes everything; the pipeline transports it.** Every value in
   `market_data` was computed inside MetaTrader and exported (§3). Nothing is
   recalculated downstream, so there is exactly one implementation of each
   indicator and no port to keep faithful. The trade-off — no
   user-parameterized recomputation — is recorded in §6.
3. **Reject incoherent cycles, never half-ingest.** If the sources disagree on
   the validation keys for a 5-minute cycle, the **whole** cycle is rejected and
   re-requested; only fully validated cycles reach `market_data`.
4. **Never lose validated data.** `market_data` is a permanent store; the push
   worker marks rows `synced_at` (never deletes); 400-rejected rows are
   quarantined for replay.
5. **Stay observable.** Cycle state, per-mismatch forensics, and quarantine
   files are all inspectable; services log to rotating files.

---

## 2. System Architecture (v6 data flow)

```
┌──────────────────────────── Windows VPS (Contabo) ────────────────────────────┐
│                                                                                │
│  MT5 terminal — XAUUSD M5 chart + XAUUSD M15 chart                             │
│  ┌──────────────────────────────┐  auto-export every minute at second :59     │
│  │ 13 export indicators  (§5.1) │ ───────────────►  MQL5/Files/                │
│  │  7× Centroid Regression      │                   {Prefix}_XAUUSD_{TF}.txt   │
│  │  Fractal Best-Fit v5         │                   (admin-layer columns)      │
│  │  Single Best Resist/Support  │                          │                   │
│  │  ZigZag v43 / OHLCV / ZScore │                          ▼                   │
│  └──────────────────────────────┘   ┌──────────────────────────────────────┐  │
│                                      │ export_collector_validator_v2.py(§5.2)│ │
│  every 5 min at :05, market-hours    │  COLLECT  → 13 raw_* staging tables   │  │
│  gated; M15 on 15-min boundaries     │             (EVERY exported column)   │  │
│                                      │  ADJUST   → timestamp_adj (see §7)    │  │
│                                      │  VALIDATE → keys agree across sources │  │
│                                      │             (symbol/tf/close ±0.01)   │  │
│                                      │  PROMOTE  → market_data  ──reject?────┼──┐
│                                      └───────────────┬──────────────────────┘  │
│                                                      │            re-request(≤3)│
│                                                      ▼  ◄────────────────────────┘
│                              xauusd.db  (schema §5.3)                          │
│                              market_data  (validated; synced_at outbox)        │
│                                                      │                         │
│                                                      ▼                         │
│                              ┌────────────────────────────────────────┐       │
│                              │ backfill_worker_api_gateway_v5.py (§5.4)│  HTTPS │
│                              │ push WHERE synced_at IS NULL;           │ ──────►│──► Railway
│                              │ stamp synced_at on 200/201 (never del.) │       │   API Gateway
│                              │ 400 → rejected_rows.jsonl (+ replay §10)│       │   /api/v1/market-data
│                              └────────────────────────────────────────┘       │
│                                                                                │
│  (Legacy socket-push path — EA → relay → gateway, §14 — NOT in v6 data flow)   │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Pipeline stages (one 5-minute cycle):**

1. **COLLECT** — read the 13 `{Prefix}_XAUUSD_{TF}.txt` files; stage **every**
   exported column into the 13 `raw_*` tables under one `collection_cycles` row.
2. **ADJUST** — snap `timestamp_adj` to the bar grid. A no-op on correct data
   since the 2026-09-09 MQL5 fix; retained as belt-and-braces (§7).
3. **VALIDATE** — cross-source agreement on the keys (`timestamp_adj`, `symbol`,
   `timeframe`, `close` within `CLOSE_TOLERANCE`); zigzag checked as a pivot
   subset of the OHLCV spine. Any mismatch → reject whole cycle, log to
   `validation_failures`, purge staged rows, re-request (`attempt+1`, ≤3).
4. **PROMOTE** — merge every staged source onto the OHLCV per-bar spine into
   `market_data` (LEFT-JOIN semantics; absent values stay `NULL`, never a
   sentinel). A straight copy: no value is computed here.

The push worker then drains `market_data WHERE synced_at IS NULL` to the gateway.

---

## 3. What MQL5 exports (the complete data contract)

Authoritative column list:
`data-split-between-mql5-and-python/Export Data from MQL5 indicators.txt`.

### 3.1 Every source's exported columns

| Source              | Exported columns (after the 4 keys `timestamp,symbol,timeframe,close`)                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7 centroid variants | `Base_FL`, `UOEDT`, `LOEDT`, `horiz_high_map`, `horiz_low_map`, `ssa`, `ema_ssa`, `crossing`                                                                                                                           |
| `Fractal_EDT`       | `Fractal_Best_FL`, `Fractal_UOEDT`, `Fractal_LOEDT`                                                                                                                                                                    |
| `Resistance_Line`   | `Best_Resistance`                                                                                                                                                                                                      |
| `Support_Line`      | `Best_Support`                                                                                                                                                                                                         |
| `OHLCV`             | `open`, `high`, `low`, `volume` — the per-bar spine                                                                                                                                                                    |
| `ZigZag`            | `Type`, `CurrentPoint`, `CurrentPrChg`, `Current%Chg`, `Current%ChgClass`, `CurrentBars`, `CurrentBarsClass`, `CurrentPrPerBar`, `CurrentPrPerBarClass`, `CurrentSlope`, `CurrentCategory` (pivot events, not per-bar) |
| `ZScore`            | `body_direction`, `body_size` (=\|z\|), `body_classification` (+ a redundant `open`/`high`/`low` copy that is deliberately not staged)                                                                                 |

That is all 83 `market_data` data fields. The 4 keys appear on **every** source
and are the validation contract. SSA is exported at **8 decimals** (raised from
5 for centroid-boundary fidelity).

Header naming is **not uniform** and must not be "tidied": centroid line values
are `Title_Case` while their admin columns are `lower_snake`; the zigzag metrics
carry no source prefix at all; and every source's export _filename_ prefix
differs from its _column_ prefix (file `Centriod_Best_Fit_A_XAUUSD_M5.txt`
contains `Best_Fit_A_*` columns). The collector's `SOURCES` registry is the
single mapping from header name → staging column.

### 3.2 What the pipeline adds

Only provenance: `cycle_id`, `collected_at`, `calculated_at` (legacy, equal to
`collected_at`), and `synced_at`. Every other column is copied unchanged.

### 3.3 Architecture decision — RESOLVED: export files are the source of truth

Cross-source validation only makes sense on the export-file path (the EA socket
path reads all buffers from one chart at one instant — nothing to
cross-validate). **Decision (June 2026): the validated export pipeline is the
source of truth for XAUUSD M5/M15.** The EA's remaining job on that terminal is
keeping the charts/indicators alive; its socket/SQLite machinery and the relay
are retained only for reference (§14).

### 3.4 Why MQL5-only (2026-09-09 decision)

One implementation per indicator, in the terminal that already computes it for
the chart. No transliteration to keep faithful, no certification to maintain, no
possibility of the pipeline and the chart disagreeing.

**What this costs:** MQL5 values are admin-fixed — parameters (window dates,
centroid inclusion/exclusion, min-EDT-touches, tolerances, thresholds) are
compiled in, so changing one means editing the `.mq5`, recompiling and
redeploying. There is no way to ask "what would this look like with different
parameters?" from stored data alone. That capability, and the statistics buffers
(R², MSE, variance-ratio, skew/kurtosis) that only ever reach the
`_Statistic.txt` companions, are what the parked calc stack provided — see
`calculation-split-between-mt5-and-python-PENDING-PROJECT/` and note that
`v2_29_davintrade_decision_layer/DAVINTRADE_DECISION_LAYER_BLUEPRINT.md` is
BLOCKED on exactly this.

The 7 centroid variants remain 7 separate indicators rather than 7 presets of
one engine. `best_fit_a`/`best_fit_b` (2026-09-03) are an isolated-coexistence
split of the former single `best_fit` — `best_fit_a` is config-identical to it
(`InpExcludeRecentCentroids=0`), `best_fit_b` is new (`=3`), mirroring the
existing `non_a`/`non_b` pair.

---

## 4. Data Contract

### 4.1 Export files (MQL5 → collector)

- One file per indicator per timeframe: `{Prefix}_XAUUSD_{M5|M15}.txt`, written
  to the terminal's `MQL5/Files/`.
- Tab-separated; first row is a header; timestamps are UTC unix seconds.
- Empty cells = "no value/line exists" → stored as `NULL` (never `0`).
- Auto-exported every minute at `InpExportSecond` (default `:59`); the collector
  reads at `:05` past each 5-minute boundary.
- The 3 windowed line indicators (Fractal, Resistance, Support) **also** emit a
  companion `{Prefix}_XAUUSD_{TF}_Statistic.txt` recording the window anchors +
  fitting parameters + the resolved line — used by certification (§6.2) and
  available to operations for auditing.

### 4.2 `market_data` (collector → gateway)

The promoted wide table (87 columns — was 79 before the 2026-09-03
`best_fit_a`/`best_fit_b` split added a 7th centroid family). Field-by-field
contract is `gateway_contract_market_data.schema.json` (§9). Column families:
the 4 keys, OHLCV, the 7 centroid families (admin: `*_horiz_high_map/_horiz_low_map/_ssa/
_ema_ssa/_crossing`; calculated: `*_base_fl/_uoedt/_loedt`), fractal/resistance/
support lines, the z-score candle set, the zigzag pivot + metrics, and
provenance (`cycle_id`, `collected_at`, `calculated_at`, `synced_at`).

### 4.3 Gateway response semantics (push worker)

| Status        | Push-worker behavior                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------- |
| 200/201       | Stamp `market_data.synced_at`                                                                                   |
| 429           | Honor `Retry-After`; backoff                                                                                    |
| 400           | Quarantine row → `rejected_rows.jsonl` **and** stamp `synced_at` (poison-row guard); replay via §10.2 after fix |
| 401/403       | Halt (operator action)                                                                                          |
| 5xx / timeout | Retry with exponential backoff                                                                                  |

Gateway **must** upsert idempotently on `(symbol, timeframe, timestamp)`.

---

## 5. Component Reference (runtime)

### 5.1 Export indicators — `mq5/` (13 files)

One full set on the XAUUSD M5 chart, one on the M15 chart. Each computes its
buffers and auto-exports the admin-layer columns (§3.1).

- **Auto-export inputs (all 13):** `InpAutoExport=true` (1-second `EventSetTimer`
  loop), `InpExportSecond=59` — keep identical across all 13 so files are
  written in near-lockstep.
- **Manual/button export retained** in every indicator for human review
  (format/correctness vs the chart); also answer the `CHARTEVENT_CUSTOM+1000` /
  `"EXPORT_ALL"` broadcast.
- **Statistic files:** the 7 centroid variants and the 3 windowed line
  indicators emit `_Statistic.txt` (window anchors + params + resolved line);
  OHLCV/ZigZag/ZScore do not (fully reproducible from their timeseries).
  **2026-09-09 — EDT Quality Metrics Suite additions**, so all 10 files carry a
  comparable field set:
  - 7 centroids gained an `[EDT CHANNEL]` block — baseline-relative `UOEDT
Offset`/`LOEDT Offset` (matching the Fractal indicator's existing
    convention) plus `Containment Sample (n)`/`Count`/`Rate`.
  - `2EDTFractalBestFitv5` gained the `[MODEL B; CLOSE PRICE]` block it was
    missing (R², MSE, Var Ratio, Skewness, Kurtosis) plus the same
    `[EDT CHANNEL]` block.
  - `SingleBestResistance/Supportv3` gained `[MODEL B; CLOSE PRICE]`. They are
    single lines, not channels, so they get no containment or symmetry fields.
    > These statistics are **residual** properties, so they are valid for any
    > resolved line — it need not have come from least squares. R² in particular
    > scores a fractal-touch line against close prices it was never fitted to, so
    > a low or negative value is expected and is not by itself a fault.
    > `Containment Rate` is the more direct measure of whether a channel is doing
    > its job.
- ⚠ **`_Statistic.txt` files are still not consumed by anything.** The collector
  reads only the timeseries exports; every statistic file is overwritten each
  minute and read by nobody. Capturing them is an open design decision — see
  §12 item 9.
- **OHLCV depth** `InpBars=3000` to match the centroid math lookback.
- ⚠️ **Windowed-anchor caveat:** Fractal-Best-Fit and both Single-Best lines use
  fixed `InpStartDateTime`/`InpEndDateTime`; re-anchor per analysis window (§13).
- ⚠️ **CPU:** each centroid variant runs an SSA engine over `InpSSAMathLookback`
  (3000) bars; seven variants × two charts is moderate — avoid extra charts.

### 5.2 Collector + validator — `export_collector_validator_v2.py`

The pipeline engine. Self-contained: its only local dependency is
`sqlite_schema_v6_xauusd.sql` beside it. It calculates nothing.

| Constant                 | Default                         | Meaning                                                            |
| ------------------------ | ------------------------------- | ------------------------------------------------------------------ |
| `CLOSE_TOLERANCE`        | `0.01`                          | Close-spread tolerance (one XAUUSD point); do not widen past ~0.05 |
| `MAX_ATTEMPTS_PER_CYCLE` | `3`                             | Reject → re-request attempts per slot                              |
| `RETRY_WAIT_SEC`         | `65`                            | Wait for the next per-minute auto-export before re-reading         |
| `CYCLE_INTERVAL_SEC`     | `300`                           | Cadence; fires at :05 past each boundary                           |
| `DEFAULT_EXPORT_DIR`     | terminal `MQL5/Files`           | Where the 13 files are read — configure per VPS                    |
| `DEFAULT_DB_PATH`        | `C:/Scripts/database/xauusd.db` | v6 database (schema auto-applied on start)                         |

- **Parsing is header-name-based** (never positional beyond the 4 keys), so a
  reordered or extended export cannot silently shift a column; a header the
  registry doesn't find simply stages `NULL`.
- **Staging-schema migration:** `CREATE TABLE IF NOT EXISTS` cannot add columns
  to a database that already exists, so `migrate_raw_tables()` runs on every
  start and `ALTER TABLE ADD COLUMN`s anything in `SOURCES` that the live
  `raw_*` tables lack. Idempotent, driven by the registry itself, and it never
  touches `market_data`.
- **Market-hours gate** (embedded XAUUSD port: Mon–Fri 01:01–23:59 server time,
  GMT+2/+3 by US DST → UTC). A closed market skips the cycle without burning
  re-request attempts.
- **CLI:** `--export-dir`, `--db`, `--timeframes M5,M15`, `--once`,
  `--no-completeness`, `--no-market-hours` (last two for mock/testing only).
- Deploy as the `MT5Collector` NSSM service (§8.2).

### 5.3 Schema — `sqlite_schema_v6_xauusd.sql`

Defines `xauusd.db`; idempotent (`CREATE … IF NOT EXISTS`) — the collector
applies it on every start, so shipping schema changes = shipping the file.

| Object                             | Purpose                                                                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `collection_cycles`                | one row per slot/timeframe/attempt; `collecting → validating → validated \| rejected`; rejected cycles keep the audit row, cascade-delete staged rows        |
| 13 × `raw_*`                       | per-source staging — **every** exported column; lead with keys `cycle_id, timestamp_raw, timestamp_adj, symbol, timeframe, close`                            |
| `v_validation_keys` (+ `…_zigzag`) | UNION view of the 11 per-bar sources' keys for the cross-source mismatch query (zigzag exposed separately as sparse pivots)                                  |
| `validation_failures`              | per-mismatch forensic log (field + per-source values as JSON)                                                                                                |
| `market_data`                      | validated wide table (87 cols); PK `(timestamp, timeframe)`; `synced_at` outbox (NULL = unsynced; rows are marked, never deleted); partial index on unsynced |

CHECK constraints enforce `symbol='XAUUSD'` and `timeframe IN ('M5','M15')`.
Empty export fields stored as `NULL`.

### 5.4 Push worker — `backfill_worker_api_gateway_v5.py`

Drains the `market_data` outbox to the gateway.

| Constant                              | Default                         | Meaning                                     |
| ------------------------------------- | ------------------------------- | ------------------------------------------- |
| `DB_PATH`                             | `C:/Scripts/database/xauusd.db` | the v6 database                             |
| `API_KEY`                             | env `BACKFILL_API_KEY`          | prefer the env var; never commit a real key |
| `MAX_ROWS_PER_CYCLE`                  | `500`                           | rows pushed per cycle, oldest first         |
| `IDLE_SLEEP_SEC` / `ACTIVE_SLEEP_SEC` | `300` / `30`                    | cadence (outbox empty vs backlog)           |
| `REJECTED_ROWS_FILE`                  | `…/rejected_rows.jsonl`         | dead-letter for 400-rejected rows           |

- Pushes `WHERE synced_at IS NULL`; stamps `synced_at` on 200/201; **never
  deletes** (`market_data` is permanent).
- 400 → quarantine + stamp `synced_at` so a poison row can't block the outbox;
  replay with `replay_quarantine.py` (§10.2).
- Connection pooling, exponential backoff, `Retry-After`, graceful shutdown,
  rotating logs. Deploy as the `MT5PushWorker` NSSM service (§8.2).

---

## 6. Calculation — where it happens, and what was removed

**All calculation happens inside MetaTrader.** Each of the 13 indicators
computes its values for the chart and exports exactly those values; the pipeline
transports them. There is no second implementation, so there is nothing to
certify and no way for the stored data to disagree with what the trader sees on
the chart.

### 6.1 The removed calculation split (parked 2026-09-09)

The pipeline previously had a **CALCULATE** stage between VALIDATE and PROMOTE,
in which four pure-Python modules — literal transliterations of the MQL5 logic —
recomputed the derived layer (centroid baselines/EDTs, fractal/resistance/
support lines, zigzag metrics, the z-score body set) from a staged "admin layer".

That stage and all four modules are now parked, intact, in
`calculation-split-between-mt5-and-python-PENDING-PROJECT/`. Its
`CALCULATION-SPLIT-ARCHITECTURE-PENDING.md` is the full record: the design and
its rationale, the certification evidence, **two open bugs found in the
2026-09-09 audit that must be fixed before any revival**, what parking it costs,
and how to restore it.

### 6.2 What the removal is worth knowing for

- **Certification is no longer a concept here.** The M15 50/50 / M5 39/50 figures
  and `CERTIFICATION.md` describe the parked port's fidelity to MQL5. They no
  longer describe anything in the running pipeline, because the running pipeline
  contains no port.
- **The 2026-09-09 audit's major finding is dissolved, not fixed.** That audit
  (`FIELD-CONSISTENCY-AUDIT-v2_29.md` §5) found that the centroid EDT stage
  self-detected fractals from raw OHLCV instead of using the staged
  `horiz_high_map`/`horiz_low_map` columns as `CERTIFICATION.md` required, and
  that the certification harness could not run at all. Both were properties of
  the Python stage; with it gone, the EDT values in `market_data` are simply the
  ones MQL5 drew on the chart.
- **What is given up:** arbitrary-parameter recomputation, and the statistics
  substrate (R², MSE, variance-ratio, skew/kurtosis, touch counts) that reaches
  only the `_Statistic.txt` companions and never `market_data`. See §3.4;
  `v2_29_davintrade_decision_layer/DAVINTRADE_DECISION_LAYER_BLUEPRINT.md` is
  BLOCKED on precisely this.

---

## 7. Validation & the timestamp-conversion requirement

Validation compares the four keys across sources per cycle. `symbol` and
`timeframe` are constants; `close` is the strong signal (compared within
`CLOSE_TOLERANCE=0.01`, numeric). ZigZag is validated as a subset (each pivot's
keys must match the OHLCV bar at the same `timestamp_adj`).

### 7.1 `timestamp_adj` — RESOLVED at source (2026-09-09)

This was the pipeline's #1 gating item for two years' worth of drafts, described
as needing "a dedicated raw→adjusted timestamp-conversion stack". It needed no
such thing. It was a one-line bug, present identically in all 13 indicators:

```mql5
datetime gmt_offset = TimeCurrent() - TimeGMT();     // WRONG
```

`TimeCurrent()` returns the time of the **last received tick**, not the clock.
`TimeGMT()` returns the real current GMT. Their difference is therefore
`(true broker offset) − (seconds since the last tick)`. Because it is computed
once per export and then subtracted from every bar time in the file, that tick
lag is stamped on **every row** as a constant sub-bar phase.

**Evidence.** Phases measured in the golden archive (`%300`): ohlcv 206,
cherry_a 240, cherry_b 288, fractal 189, non_a 43, non_b 81, best_fit 4,
most_recent 7, resistance 9, support 51, zscore 94, zigzag 76 — one constant per
file, differing per file exactly as "how quiet was the market when I clicked
export" predicts. The newer `engine-1-5` captures, taken during an active
session, show phases of only 2–3s. And the files' data is provably coherent:
aligned by sequence, every per-bar source's closes match OHLCV **100%**
(3000/3000, 1899/1899, 1440/1440, 500/500) — only the timestamps were wrong.

**Fix**, applied to all 16 sites across the 13 indicators:

```mql5
long _srv_off = (long)TimeTradeServer() - (long)TimeGMT();
datetime gmt_offset = (datetime)((long)MathRound(_srv_off / 3600.0) * 3600);
```

`TimeTradeServer()` advances with the clock instead of lagging to the last tick,
and rounding to the hour removes any residue — broker offsets are always whole
hours. Exported timestamps then land exactly on the bar grid, so the collector's
`round(raw/tf)*tf` becomes a no-op (kept as belt-and-braces against an unfixed
build being redeployed).

**A second, separate bug fixed with it:** `ZigZagExportv43` wrote its
"unconfirmed live pivot" row with `TimeGMT()` — the export wall clock — as the
timestamp. That row could never sit on the bar grid, so it never matched an
OHLCV bar and the subset rule rejected it. It now uses the current forming bar's
`iTime`.

> ⚠ **Both fixes are inert until all 13 indicators are recompiled in MetaEditor
> and the `.ex5` redeployed to the VPS terminal.** The `.mq5` sources in `mq5/`
> are fixed; the compiled binaries are not.

**Not a bug, worth knowing:** the golden archive additionally shows whole-bar
offsets between files (best_fit's newest bar is one bar behind ohlcv's). That is
an artifact of capturing it by clicking each indicator's export button in turn
over ~26 minutes. In production all 13 auto-export the same bar at the same
second, and the `check_completeness` rule ("latest bar missing in: …") exists to
reject a cycle if one ever lags.

---

## 8. Deployment Guide (Windows VPS)

### 8.1 Directory layout

```
C:/Scripts/
├── collector/   export_collector_validator_v2.py + the 4 calc .py + sqlite_schema_v6_xauusd.sql
├── backfill/    backfill_worker_api_gateway_v5.py + replay_quarantine.py
├── relay/       mt5_api_relay_for_v2_29.py            (legacy, optional)
├── database/    xauusd.db, rejected_rows.jsonl
└── logs/        collector.log, push_worker.log, relay.log (rotating)
MT5 terminal:    13 indicators on the XAUUSD M5 chart + 13 on the M15 chart;
                 exports land in <terminal>/MQL5/Files/
```

### 8.2 Service install — `install_services.bat`

Run elevated; edit the CONFIG block (Python path, ROOT, `EXPORT_DIR`, `DB`,
`BACKFILL_API_KEY`) first. It installs three auto-restarting NSSM services:
`MT5Collector` (pipeline engine), `MT5PushWorker` (outbox → gateway), and
`MT5Relay` (legacy, optional). Prereqs: NSSM on PATH; `pip install aiohttp
requests`. Verify with `nssm status MT5Collector` / `MT5PushWorker`.

### 8.3 Indicator/terminal setup

1. Compile the 13 `mq5/` indicators in MetaEditor.
2. Tools → Options → Expert Advisors: allow `127.0.0.1` (only needed if the
   legacy EA/relay is used).
3. Attach all 13 indicators to the XAUUSD **M5** chart and all 13 to the **M15**
   chart; set each windowed indicator's anchors (§5.1) and confirm lines draw.
4. Confirm `MQL5/Files/` fills with `{Prefix}_XAUUSD_{TF}.txt` (+ the 9
   `_Statistic.txt`) each minute.

### 8.4 Boot order

Collector and push worker are independent and self-healing; no strict order.
The collector recreates the schema and idles when no exports are present.

---

## 9. Gateway-Side Contract (backend team) — `gateway_contract_market_data.schema.json`

The gateway must provide:

1. `POST /api/v1/market-data` accepting a body validated by
   `gateway_contract_market_data.schema.json` — the 87-field `market_data`
   record plus `terminal_id`. **All derived/indicator fields are nullable**
   (`null` = indicator inactive on that bar; never coerce to 0).
2. **Idempotent upsert** on `(symbol, timeframe, timestamp)` — duplicate
   delivery is by design (push retries).
3. Response semantics per §4.3 (200/201, 400+`{message}`, 401/403, 429 +`Retry-After`, 5xx).
4. `GET /api/v1/health` → 200.

The schema's `x-gateway-requirements` block restates idempotency and the
response contract for the backend team.

---

## 10. Monitoring & Operations Runbook

### 10.1 Signals

**Healthy:** collector logs `✅ Cycle N validated — K bars promoted` each cycle;
push worker logs `✅ No backfill needed` / steady pushes; `rejected_rows.jsonl`
absent/empty; `market_data` unsynced count trends to 0.

| Alert-worthy                         | Meaning                                                                       | Action                                                    |
| ------------------------------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------- |
| Cycles repeatedly `rejected`         | Sources disagree (often timestamp_adj — §7) or an indicator stopped exporting | Read `validation_failures`; check the 13 files' freshness |
| `rejected_rows.jsonl` growing        | Gateway rejecting pushes                                                      | Read `gateway_error`; fix gateway/data; replay (§10.2)    |
| `CRITICAL: Authentication failed`    | Key rotated/revoked                                                           | Rotate `BACKFILL_API_KEY`                                 |
| Unsynced `market_data` rows climbing | Gateway unreachable                                                           | Check Railway; worker retries automatically               |
| Collector CPU/lag                    | SSA load / too many charts                                                    | Reduce charts or lookback (§5.1)                          |

### 10.2 Quarantine replay — `replay_quarantine.py` + `rejected_rows.jsonl`

When the push worker hits HTTP 400 it appends the row to `rejected_rows.jsonl`
(`{quarantined_at, gateway_error, row}`) and stamps `synced_at` so the outbox
keeps flowing. After fixing the gateway/data, replay:

```
BACKFILL_API_KEY=... API_GATEWAY_URL=... python3 replay_quarantine.py
python3 replay_quarantine.py --dry-run        # preview only
python3 replay_quarantine.py --file C:/Scripts/database/rejected_rows.jsonl
```

Rows that succeed (200/201) are dropped from the file; rows that still fail are
rewritten back — re-running is safe and idempotent. The file is removed when
fully cleared.

---

## 11. Failure Modes & Recovery

| Failure                      | Effect                                                                                        | Outcome                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| An indicator stops exporting | Cycle missing a source → rejected                                                             | No bad data promoted; resumes when the file returns |
| Sources disagree on keys     | Cycle rejected, logged to `validation_failures`, re-requested (≤3)                            | No incoherent bar promoted                          |
| Gateway down / 5xx           | Push worker backs off; `market_data` rows stay `synced_at IS NULL`                            | No loss; drains on recovery                         |
| Gateway 400                  | Row quarantined + stamped; outbox unblocked                                                   | Recoverable via §10.2                               |
| Market closed                | Collector skips cycles (no attempt burn)                                                      | No spurious rejects nightly/weekends                |
| VPS reboot                   | NSSM auto-restarts services; `xauusd.db` persists                                             | No loss                                             |
| Collector killed mid-cycle   | Cycle left non-`validated`; staged rows for that cycle id remain until next run reuses/cleans | `market_data` only ever holds promoted bars         |

---

## 12. Known Issues, Gaps & Accepted Trade-offs

1. ~~`timestamp_adj` normalization is a placeholder~~ — **RESOLVED 2026-09-09**
   at source in all 13 indicators (§7.1). Pending only the MetaEditor recompile.
2. ~~M5 UOEDT / cherry_a / non_b residuals~~ — **no longer applicable.** Those
   were the Python port's deviations from MQL5; there is no port (§6).
3. **Windowed indicator anchors go stale** — Fractal-Best-Fit and both
   Single-Best lines use fixed `InpStartDateTime`/`InpEndDateTime`; re-anchor per
   window, or make the window roll automatically (§13).
4. ~~Indicators still export full columns~~ — **that is now the design.** Every
   exported column is staged and promoted; do NOT slim the exports.
5. **No user-parameterized recomputation** — MQL5 values are admin-fixed, and
   the statistics buffers (R², MSE, variance-ratio, skew/kurtosis) reach only
   `_Statistic.txt`, never `market_data`. This blocks the decision layer (§3.4,
   §6.2).
6. **Legacy socket path retained** (§14) — not in the v6 flow; do not wire it
   into `market_data`. Note its v2.29.1 change deliberately sends
   `base_fl`/`uoedt`/`loedt` as NULL "because those are Python-only in v6" —
   that reasoning is now obsolete, though harmless while the path stays inert.
7. ⚠ **Push-worker throughput may not keep up** — OPEN, arithmetic only, not yet
   observed in production. Every cycle re-queues all ~6000 in-window rows
   (correct: MT5 recalculates the whole window), and the worker POSTs one row
   per HTTP request at 500/cycle + 30s sleep. Demand ~800 rows/min vs a likely
   capacity of 375–600. Because selection is oldest-first, the symptom would be
   **the newest bars arriving late or never** — not a crash or data loss. Settle
   it with the measurements in `PUSH-WORKER-THROUGHPUT-OPEN-ISSUE.md` §4 before
   changing anything; that doc also ranks the fixes and names the invariants any
   fix must preserve. Predates and is unrelated to the 2026-09-09 refactor.
8. ⚠ **Historical indicator values are not point-in-time** — OPEN, mechanism
   verified, magnitude never measured. Because the centroid/SSA window
   re-anchors to the live bar each pass (§7 above notwithstanding — different
   issue), a bar's row is refitted for ~3000 bars before it freezes, so the
   stored value for bar T was computed using data up to ~2 weeks _after_ T.
   Harmless for live alerting and charts (they want the newest fit); **invalid
   for backtesting, walk-forward or fitness scoring**, which is a second,
   independent blocker on the decision layer. ~56 of the 83 data fields drift;
   OHLCV and the z-score triple are genuinely causal and safe. Also documents a
   related nuance: the newest row is always a still-forming, partial bar. Full
   write-up, the experiment to size it, and the options:
   `HISTORICAL-VALUES-LOOK-AHEAD-BIAS-OPEN-ISSUE.md`.
9. ✅ **`_Statistic.txt` capture — BUILT** (2026-09-09), end to end, MT5 →
   SQLite → gateway → Postgres. All 10 files now carry a complete, comparable
   field set (§5.1) and are parsed into a new **append-only** `indicator_statistics`
   table keyed by `(symbol, timeframe, source, captured_at)`. Append-only is what
   makes it point-in-time honest, unlike `market_data`, which is mutable by
   design: a correction is a NEW row with a later `captured_at`, never an
   overwrite. This is the **only** source of the fit-quality substrate (R², MSE,
   variance ratio, skew/kurtosis, containment, window size) — none of it exists
   in `market_data` and none of it can be honestly reconstructed after the fact,
   which is why capture had to start before the decision layer needs it. It is
   the fitness substrate that layer requires, and it partially addresses item 8
   (each row is stamped with the moment it was observed, so a series of rows for
   one bar shows how the fit evolved rather than only its final state).
   Deliberately **isolated from `market_data` at every layer** — its own staging
   table, outbox, HTTP route, Bull queue, processor and reject file — so a
   failure in this stream can never delay or reject price data; verified by
   pointing the endpoint at a dead URL and confirming the `market_data` drain is
   unaffected. The frozen 87-field contract is untouched. Design and rationale:
   `STATISTIC-CAPTURE-SCOPE.md`. **The Postgres migration is authored but NOT
   applied** — see §13 item 5.

---

## 13. Remaining Work to Production Cutover

1. ⚠ **Recompile the 10 statistic-emitting indicators in MetaEditor, then redeploy
   all 13 `.ex5` to the VPS terminal.** **Gating** for a green end-to-end run.
   **The binaries on disk are one build behind, in a way that hides itself.** All
   13 `.ex5` were compiled 2026-09-09 ~13:45, which **does** include the timestamp
   fixes (§7.1, sources edited 12:03) — that part is built. But the EDT Quality
   Metrics blocks were added at 14:52–14:54, _after_ that compile, to the 10
   statistic-emitting files (7 centroids + fractal + resistance + support). Those
   10 binaries therefore carry the timestamp fix but **not** the statistic blocks.
   The other 3 (ZigZag, OHLCV, Z-Score) emit no statistics and are correctly
   current.
   **Why this needs calling out rather than just noting:** deploying as-is would
   look like success — timestamps correct, cycles validating, and
   `indicator_statistics` rows actually being created — but every new field would
   be NULL, because the old-format `_Statistic.txt` files simply don't contain
   them. The parser handles that correctly (missing reads as NULL, never as 0),
   which is exactly why nothing would error. Verify by checking that a fresh
   `_Statistic.txt` contains an `[EDT CHANNEL]` section before deploying.
2. **Gateway migration** — implement the §9 contract (nullable field set,
   idempotent upsert).
3. **Windowed-anchor handling** — operational re-anchoring procedure or a
   rolling-window indicator change.
4. **Restart the collector on the VPS** after deploying the updated
   `export_collector_validator_v2.py` + `sqlite_schema_v6_xauusd.sql`. Its
   `migrate_raw_tables()` will add the new staging columns to the existing
   `xauusd.db` on first start (§5.2); `market_data` is untouched. The same
   restart also creates the `indicator_statistics` outbox (§12 item 9).
5. ✅ **`20260909120000_add_indicator_statistics` — APPLIED 2026-09-09** by Davin
   via `npx prisma migrate deploy`. Purely additive (two new tables, zero changes
   to `market_data_v6`). `indicator_statistics` and `indicator_configs` now exist,
   so the gateway will accept statistics POSTs as soon as the collector and push
   worker are deployed (item 4). Three notes on that run, since `migrate deploy`
   applies **every** pending migration in history order, not only the intended one:
   - `20260909000000_market_data_v6_provenance_not_null` went in alongside it.
     That one did carry a pre-flight caution (it tightens `cycle_id`/
     `collected_at` to `NOT NULL` on live data), but a clean apply is itself the
     proof it was safe: `SET NOT NULL` fails loudly if any row violates it, so
     success means there were no NULL rows.
   - `20260904120000_default_theme_light`, unrelated to this pipeline, was also
     pending and applied.
   - ✅ **It reached the right database.** `prisma migrate status` afterwards
     reports 19 migrations and "Database schema is up to date" at
     `turntable.proxy.rlwy.net:55082`.
     ⚠ **A naming trap worth knowing about, because it has now cost three
     sessions.** That host is filed under a Railway project **named** "postgre for
     staging", which repeatedly reads as "wrong database" — it is not. Davin
     confirmed live 2026-09-09 that this is the database the codebase uses; the
     project name is historical. The corroborating evidence: the
     production-sounding `trading-alerts` project's own Postgres
     (`maglev.proxy.rlwy.net`) was queried directly on 2026-07-18 and holds **no
     `market_data` table at all** (`DECISION-LOG.md` F3, case (b)). And
     `postgres.railway.internal` is not a third instance — it is Railway's
     private-network address, unresolvable from outside Railway by design.
     **Before flagging this again, read `DECISION-LOG.md` F3.**

Deferred product features (separate workstreams, not pipeline-blocking):
trendline image rendering + statistical scoring/advice; parameter-revision
alerting.

---

## 14. Legacy EA Socket-Push Path (reference only — NOT in the v6 data flow)

Retained for history and for a possible future return to a low-latency push
feed. Not deployed as part of v6; if the EA runs on the XAUUSD terminal its only
purpose is keeping charts/indicators alive so they auto-export.

### 14.1 EA — `SimpleDataCollector_v2_29_ASYNC_SOCKET.mq5`

Loads 12 `iCustom` handles (the 13 indicators minus OHLCV, which it reads via
`CopyRates`) — including a `best_fit_a`/`best_fit_b` pair since the
2026-09-03 split (previously one `best_fit` handle). **Its `iCustom` names
must exactly match the `mq5/` filenames** (§0.4) — updated to the
hyphen-free v2.29 names. In the legacy design it
serialized a per-bar payload to the relay over TCP `127.0.0.1:5555`
(fire-and-forget, <1ms) with a circuit breaker (10 consecutive socket failures →
write to a per-symbol SQLite fallback instead). That socket/SQLite/circuit-breaker
machinery is inert in v6.

### 14.2 Relay — `mt5_api_relay_for_v2_29.py`

Schema-agnostic asyncio TCP server: bounded queue (10k), 4 upload workers, 5
retries with exponential backoff (2→16s), disk spill (`relay_spill_queue.jsonl`)
replayed every 60s, permanent-4xx drop (poison-message guard). Forwards JSON to
the gateway unchanged; only reads `terminal_id` for a header.

### 14.3 Hardening already applied to the legacy path (do not regress)

`uchar` socket payload; `SocketTimeoutMs` floor 50ms (lower trips the breaker);
full-payload send check; `FILE_SHARE_READ` on the audit CSV; relay read-to-EOF;
relay bounded-queue+spill+replay; worker `BACKFILL_API_KEY` via env var.

---

## Appendix A — Version History

| Item                                          | State                                                                                                                                                                 |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EA / indicators                               | v2.29 (hyphen-free `mq5/` names; auto-export; SSA 8-decimal). **2026-09-09: GMT-offset fix in all 13 — needs recompile (§7.1)**                                       |
| Schema                                        | v6 (`xauusd.db`: staging + validation + `market_data` outbox). **2026-09-09: staging widened to every exported column**                                               |
| Collector                                     | v2 (header-name parsing; market-hours gate). **2026-09-09: CALCULATE stage removed; `migrate_raw_tables()` added**                                                    |
| Push worker                                   | v5 (`market_data` outbox; synced_at; quarantine+replay)                                                                                                               |
| Calc stack                                    | **PARKED 2026-09-09** — `calculation-split-between-mt5-and-python-PENDING-PROJECT/`. Not deployed, not running (§6)                                                   |
| Centroid variants (2026-09-03)                | `best_fit` split into `best_fit_a` (config-identical to the old `best_fit`) + `best_fit_b` (new preset) — 6→7 variants, 12→13 indicators, `market_data` 79→87 columns |
| `market_data` shape                           | 87 columns, unchanged by the 2026-09-09 work — the gateway contract, both Prisma schemas and the DTO were untouched                                                   |
| Legacy v2.28/v2.27/v2.26 EAs, `.ex5` binaries | history only — do not deploy                                                                                                                                          |

The files in §0 are the deployment set; everything else in the directory is
historical.
