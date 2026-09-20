# Data Collection Pipeline — Architecture Blueprint (v2.29 / v6 Stack)

**Status:** Authoritative reference ("the bible") for the XAUUSD data-collection
pipeline. **MQL5 is the single source of every value** (2026-09-09) — the Python
calc stack was removed from the pipeline and parked; see §6.
**Last Updated:** 2026-09-11 (Economic calendar lane, Railway Gateway integration & batching live-verified in production)

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

| File                                           | Role                                                              | Ref   |
| ---------------------------------------------- | ----------------------------------------------------------------- | ----- |
| `mq5/` (14 indicators, see §0.4)               | Data producers: compute + auto-export **every** value as `.txt`   | §5.1  |
| `mq5/EconomicCalendarExport_v2_29.mq5`         | **EA**, not an indicator: exports the built-in Economic Calendar  | §5.5  |
| `export_collector_validator_v2.py`             | Pipeline engine: COLLECT → ADJUST → VALIDATE → PROMOTE            | §5.2  |
| `sqlite_schema_v6_xauusd.sql`                  | `xauusd.db` schema: staging + validation + `market_data`          | §5.3  |
| `backfill_worker_api_gateway_v5.py`            | Push worker: `market_data WHERE synced_at IS NULL` → gateway      | §5.4  |
| `gateway_contract_market_data.schema.json`     | JSON-Schema of the POST body the gateway must accept              | §9    |
| `gateway_contract_economic_events.schema.json` | JSON-Schema for the append-only economic-events stream            | §5.5  |
| `centroid_watchdog.py`                         | **Read-only** standby watcher: alerts on a confirmed new centroid | §5.6  |
| `install_services.bat`                         | Windows/NSSM installer for the VPS services                       | §8.2  |
| `install_centroid_watchdog_service.bat`        | Separate NSSM installer for the watchdog (never touches §8.2's)   | §5.6  |
| `migrate_sqlite_add_sr_columns.sql`            | One-off `market_data` widening for the 14th indicator             | §5.3  |
| `replay_quarantine.py`                         | Re-POST gateway-rejected rows after a fix                         | §10.2 |

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

### 0.4 The 14 export indicators — `mq5/`

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
| `SupportAndResistantAutoCalibration_v2_29.mq5`                | `SR_Levels`                              | `sr_levels`          |

> The export-file prefix is set by each indicator's `InpExportFileName` input
> and is **independent of the `.mq5` filename** — so renaming the `.mq5` files
> changed the EA's `iCustom()` names (§5.1) but NOT the collector's file map.

### 0.5 Reference data & specs

| Path                                                                      | Role                                                                                  |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `data-split-between-mql5-and-python/Export Data from MQL5 indicators.txt` | The authoritative list of columns MQL5 exports (§3.1)                                 |
| `data-split-between-mql5-and-python/Python stacks calculation.txt`        | The authoritative list of values Python calculates (§3.2)                             |
| `sqlite_schema_v6_xauusd_preview.txt`                                     | Excel-openable preview of every v6 table with mock rows                               |
| `mock-data-from-indicators/golden_certification/` (repo root)             | The certified 3000-bar export batch (24 timeseries + 18 stat files, M5+M15)           |
| `ACTIVE-STANDBY-TERMINAL-ARCHITECTURE.md`                                 | Active / hot-standby terminal topology and the promote design (§8.1)                  |
| `docs/runbooks/mt5-terminal-promote.md` (repo root)                       | The promote procedure itself — preconditions, switch, verify, rollback                |
| `test_stale_export_guard.py`                                              | Guards the stale-export-directory rejection (§12 item 10); 9 tests                    |
| `test_sr_levels_source.py`                                                | Guards the 14th indicator end to end (§5.1, §13 item 7); 24 tests                     |
| `ACTIVE-STANDBY-FROZEN-BASELINE-AND-CENTROID-ALERT-ARCHITECTURE.md`       | Frozen baseline/EDT projection + the centroid watchdog (§5.6, §12 item 8)             |
| `active-standby-terminal-operation-for-admin/generate_frozen_preset.py`   | Captures an approved line into MT5 `.set` presets; `--verify` proves it took          |
| `test_centroid_watchdog.py`                                               | Guards the watchdog's debounce automaton and parsing; 35 tests                        |
| `verify_mq5_frozen_identifiers.py`                                        | Resolves every identifier the frozen-mode MQL5 code references; run before MetaEditor |

---

## 1. Design Goals

1. **Single source of truth = validated export files.** All 14 indicators
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
│  │ 14 export indicators  (§5.1) │ ───────────────►  MQL5/Files/                │
│  │  7× Centroid Regression      │                   {Prefix}_XAUUSD_{TF}.txt   │
│  │  Fractal Best-Fit v5         │                   (admin-layer columns)      │
│  │  Single Best Resist/Support  │                          │                   │
│  │  ZigZag v43 / OHLCV / ZScore │                          ▼                   │
│  └──────────────────────────────┘   ┌──────────────────────────────────────┐  │
│                                      │ export_collector_validator_v2.py(§5.2)│ │
│  every 5 min at :05, market-hours    │  COLLECT  → 14 raw_* staging tables   │  │
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
   exported column into the 14 `raw_*` tables under one `collection_cycles` row.
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

The promoted wide table (95 columns — 79 before the 2026-09-03
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

- **Auto-export inputs (all 14):** `InpAutoExport=true` (1-second `EventSetTimer`
  loop), `InpExportSecond=59` — keep identical across all 14 so files are
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

  **2026-09-20 — statistic enrichment pass.** The 2026-09-09 additions left the
  _header_ lines variant-flavoured, and that turned out to cost real data rather
  than just looking untidy. `parse_statistic_file()` matches labels **literally**
  and stores NULL on a miss, so `Observation Window (Bars)` (BestFit A/B,
  MostRecent) never matched the single rule written for `Observation Window
(Box B Bars)` (CherryPick, NonRecent) — three of the seven centroids had been
  storing NULL for `window_bars`, and BestFit A/B were also dropping
  `Regression Centroids` and `Visual CFL/EDT Window` from `config_params`, which
  is what `config_hash` is built from. Reproduced against the real captured
  exports before changing anything.
  - All 8 channel-emitting indicators (7 centroids + `2EDTFractalBestFitv5`) now
    additionally write **five ASCII-only sections with an identical label
    sequence in every file**: `[FIT WINDOW]`, `[PRICE CONTEXT]`,
    `[CHANNEL GEOMETRY]`, `[RESIDUAL DIAGNOSTICS; CROSSINGS]` and
    `[RESIDUAL DIAGNOSTICS; CLOSE PRICE]` — **40 new fields**, all captured into
    `indicator_statistics`.
  - The variant-flavoured header lines are **unchanged**; the canonical values
    are re-emitted under names that are the same everywhere. `STAT_FIELDS` now
    accepts a _tuple_ of label spellings, canonical first, so a terminal still
    running an older binary keeps populating the legacy columns.
  - `[FIT WINDOW]` finally gives the centroids `Window Start/End TS (UTC)`,
    which the line indicators always had and the centroids never did — every
    centroid row in `indicator_statistics` carries NULL for both today.
  - New in kind, not just in count: `Channel Position` (0 at LOEDT, 1 at UOEDT),
    the breach split (`Above/Below … Count` + `Max Excursion …`, which
    `Containment Rate` alone cannot express), and **Durbin-Watson** — the
    diagnostic R² cannot give on trending data, and R² is measured _negative_
    in real captured exports here.
  - The shared block is **byte-identical across all 7 centroids** (one sha256)
    and uses only identifiers declared in all seven. `g_stat_excluded` (absent
    from CherryPick A/B and MostRecent), `g_stat_lambda` (absent from CherryPick
    B and MostRecent) and `Inp*VisualLookback` (named differently in BestFit
    A/B) are deliberately untouched — that non-uniformity is what broke 5 of 7
    compiles on 2026-09-18. `verify_mq5_frozen_identifiers.py` now covers these
    regions and the fractal file too.
  - Guarded by `test_extended_statistics.py` (labels read **out of the `.mq5`
    source**, so it cannot pass by being edited in step with a mistake) and
    `test_statistics_schema_sync.py` (SQLite ↔ collector ↔ push worker ↔
    contract ↔ both Prisma mirrors ↔ migration).

  **2026-09-20, same pass — the remaining 3 statistic-emitting indicators.**
  Auditing them turned up one gap per file, all measured against the real
  captured exports rather than estimated:
  - `SingleBestResistanceLinev3` / `SingleBestSupportLinev3` carried **13
    populated columns and 55 NULLs**, and **none** of the 40 extended ones.
    They now write the same five sections, taking them to **19 of 40** — the
    other 21 stay NULL because a single line has no channel and no crossings.
    That distinction is carried by an **empty value, never a 0**: for a
    centroid `Above UOEDT Count: 0` is a measurement, whereas here it would
    make a support line look like a perfectly contained channel to anything
    reading the table without knowing the source. They also gained
    `Regression Angle` (NULL for these sources in every row to date) and
    `Timeframe (Sec)`, and their em-dash headers became ASCII.
  - `SupportAndResistantAutoCalibration` was **dropped in full** — `sr_levels`
    was excluded from `STAT_SOURCES` on 2026-09-16 for two stated reasons, and
    it is re-enrolled now that **both** are closed: its vocabulary has ten
    section-scoped rules, and the contract's closed `source` enum is widened
    10 → 11. It is deliberately **not** reshaped into the regression-fit
    schema — it measures bucket calibration, not residuals against a fitted
    line, and padding it with permanently-empty channel fields would add noise,
    not data. **10 new `sr_*` columns** capture the provenance
    (Q25/Q75, IQR, **Optimal Step**, fractal sample, macro clusters, nearest
    S/R + distances in points). `sr_1..sr_8` are **not** duplicated — those
    already reach Postgres through `market_data`; what was being lost is _why_
    those levels exist and how wide each bucket is. Real file → **18 columns
    captured, was 0**.
  - A latent defect fixed with it: `Window Bars: 67 (Max Cap: 3000)` coerces to
    **None** (verified against the real coercion, not read), so that field
    would have been silently NULL for every row the moment this source was
    ingested. The cap is now its own `Max Window Bars` field.
  - ⚠ **The `source` enum is still CLOSED and the POST is still BATCHED.** A
    sender using a value the deployed gateway does not know 400s the **whole**
    request, and the push worker quarantines every element in that batch _and_
    stamps `synced_at`. Deploy the gateway **before** the VPS starts sending
    `sr_levels`. `test_sr_levels_source.py` now asserts the enum and
    `STAT_SOURCES` agree exactly, since a source the collector stages but the
    contract omits is a latent outage for the other ten, not just for itself.
  - Totals: **50 new columns** (40 uniform + 10 `sr_*`); `indicator_statistics`
    37 → 87; all 11 statistic files now reach the database.

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
| 14 × `raw_*`                       | per-source staging — **every** exported column; lead with keys `cycle_id, timestamp_raw, timestamp_adj, symbol, timeframe, close`                            |
| `v_validation_keys` (+ `…_zigzag`) | UNION view of the 13 per-bar sources' keys for the cross-source mismatch query (zigzag exposed separately as sparse pivots)                                  |
| `validation_failures`              | per-mismatch forensic log (field + per-source values as JSON)                                                                                                |
| `market_data`                      | validated wide table (95 cols); PK `(timestamp, timeframe)`; `synced_at` outbox (NULL = unsynced; rows are marked, never deleted); partial index on unsynced |

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

### 5.5 Economic calendar — `mq5/EconomicCalendarExport_v2_29.mq5`

A **second, fully independent lane** beside `market_data` and
`indicator_statistics`: its own exporter, outbox table, JSON contract, endpoint
and queue, so a failure here can never delay or reject price data.

**Source.** MT5's own built-in Economic Calendar
(`CalendarValueHistory` → `CalendarEventById` → `CalendarCountryById`), read on
the same terminal that runs the 14 indicators. No vendor, no API key, no new
cost. Availability was measured before any of this was designed — Eightcap-Demo
build 6182: 333 events / 8 days, 333/333 id lookups resolved, 25 HIGH-impact,
server-side currency filtering functional
(`davintrade-news-stack/step-zero-calendar-availability-check/`).

**An EA, not an indicator**, because it is a timer job: attach to one chart, any
symbol — the calendar is global and this table is deliberately not
symbol-scoped. Relevance to XAUUSD is derived from `currency` at query time.

**Deliberately dumb.** It writes a full snapshot of the window every cycle and
does no change detection. Whether a row is _new_ — the append-only decision —
belongs in the collector, where it is testable in Python.

**APPEND-ONLY, keyed `(value_id, captured_at)`.** A forecast is revised and an
actual published only _after_ the event, so overwriting destroys what the market
knew beforehand — the loss §12's look-ahead-bias entry records as unrecoverable
for `market_data`. Current state is one `DISTINCT ON` query; the reverse is
impossible.

**Four format decisions, each verified rather than assumed:**

| Decision                             | Why                                                                                                                                                                                                                                           |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ids are TEXT, not INTEGER            | Upstream `ulong`; JSON has no 64-bit int. `ULONG_MAX` proven to round-trip losslessly as text, where an int truncates silently                                                                                                                |
| Written as real UTF-8, not FILE_ANSI | The collector opens every export `encoding='utf-8'`. The 13 numeric exporters get away with ANSI only because they are pure ASCII; an event name is free text, and one CP1252 byte raises `UnicodeDecodeError` and rejects the **whole file** |
| Free-text fields sanitised           | A raw TAB inside `event_name` shifts every later column on that row — reproduced: 24 fields become 25                                                                                                                                         |
| Empty field ≠ `0`                    | `LONG_MIN` upstream means _not published_. A genuine `0.0` reading is data. For forecasts, absence is the common case — rate decisions, votes and speeches carry no numeric forecast at all                                                   |

**Times are UTC.** `MqlCalendarValue.time` is _server_ time; the exporter
converts with the same hour-rounded `TimeTradeServer() - TimeGMT()` offset the
fixed indicators use, recomputed every cycle because broker offsets shift with
DST. Confirmed against two real releases (US PPI 08:30 ET, ECB 14:15 CEST)
rather than assumed — this is the same trap as §7.1's `timestamp_adj` bug.

Writes to a temp file and renames, so the collector can never read a
half-written snapshot. On a failed or empty fetch the previous export is left
intact rather than replaced with nothing.

**Collector side — `stage_economic_events()` in `export_collector_validator_v2.py`.**
This is where the append-only decision actually lives, and it is not optional
bookkeeping. The exporter re-emits ~333 rows every snapshot; appending all of
them each cycle would write ~32,000 rows/day, about **12M/year**, virtually all
byte-identical repeats. Appending only what changed brings that to roughly
**15k/year** — the same guarantee, three orders of magnitude less of it. Each
row is compared against the newest stored row for its `value_id` across every
field except `captured_at` (which differs by definition, so comparing it would
make everything look changed and defeat the mechanism).

Hooked into `run_cycle()` at the very top in its **own** try/except, decoupled
from price timeseries collection and market-hours checks (2026-09-11 update,
commit `70a79a06`). Because calendar events are global to the MT5 terminal and
not tied to a specific chart or trading hours, staging them first guarantees news
events are updated in SQLite even if market data indicators are incomplete or the
forex market is closed. Neither lane can take the other down and neither touches
`market_data`. Calling it on both the M5 and M15 cycles is harmless: change
detection makes duplicate calls a no-op.

**Push side — `push_economic_events()` in `backfill_worker_api_gateway_v5.py`.**
A third independent drain loop, isolated exactly like `push_statistics()`: its
own table, endpoint (`POST /api/v1/economic-events`) and quarantine file
(`rejected_economic_events.jsonl`), with every exception swallowed so it can
never delay or fail price ingestion. Runs **after** `market_data` and the
statistics lane on both the idle and active branches of the main loop; a return
of 0 means "nothing to do" and never feeds the backoff decision.

**Batched, with Gateway 100 KB payload constraint (HTTP 413 mitigation).**
The Railway API Gateway runs NestJS on Express, which enforces a default JSON body
parser limit of **100 KB**. In live testing, pushing 250 rows (~250 KB) caused
Express to reject the request with `HTTP 413 Payload Too Large`.

- **Capped at 120 rows/request** (`EVENT_MAX_ROWS_PER_CYCLE = 120`, commit `3cbc3534`),
  keeping payloads safely below 80 KB.
- **Loop drain per cycle**: The worker runs an inner `while True` drain loop
  per cycle until the `economic_events` outbox is completely empty, draining
  backlogs (e.g. initial 545-row sync) in consecutive 120-row chunks within seconds
  without exceeding the gateway's payload ceiling.
- **Oldest-first**: Ordered oldest-first, stamping `synced_at` on 200/201 response.

**Tests — `test_economic_events.py` (14) and `test_push_economic_events.py`
(13).** This stack has no pytest config (and pytest is not installed on the dev
box), so both run standalone:

```bash
python test_economic_events.py
python test_push_economic_events.py
```

They exist because every failure mode in this lane is **silent**. All verified
by mutation rather than assumed:

| Break this                   | And this fails                                                |
| ---------------------------- | ------------------------------------------------------------- |
| Change detection             | volume test: 3 expected rows become **192**                   |
| Empty field coerced to `0`   | 5 tests, incl. `pre-release actual was overwritten`           |
| Batching                     | `120 requests for 120 rows`                                   |
| The swallow-everything guard | 2 exceptions escape into the caller — the isolation guarantee |
| The 400 poison guard         | `poison rows left unstamped -> outbox wedged`                 |

Both collector and push changes are **additions only** — 159 and 99 insertions,
zero deletions — so the `market_data` path is provably untouched rather than
believed to be.

---

### 5.6 Frozen baseline & the Centroid Watchdog — `centroid_watchdog.py`

Two coordinated halves of ARCH-SPEC-2026-09-18-V2.29-FROZEN-ALERT, both built
2026-09-18. Full design: `ACTIVE-STANDBY-FROZEN-BASELINE-AND-CENTROID-ALERT-ARCHITECTURE.md`.

**Pillar 1 — frozen projection (MQL5).** All 7 centroid indicators gained
`InpProjectionMode`. In `MODE_FROZEN_LINE` the DBSCAN/K-Means clustering and the
combinatorial fit are bypassed entirely; the approved line is projected forward
from a fixed anchor instead:

```
base  = InpFrozenAnchorPrice + InpFrozenSlope * (bar_index - anchor_bar_index)
UOEDT = base + InpFrozenUOEDTOffset      <- signed, POSITIVE
LOEDT = base + InpFrozenLOEDTOffset      <- signed, NEGATIVE
```

Three details that are easy to get wrong and expensive to get wrong:

- **The anchor is a TIME, not a bar index.** The regression is fitted in
  bar-index space, but a bar index is not stable — MetaTrader deepening history
  shifts every index in the array. The anchor is therefore resolved by time on
  every pass. Measured on synthetic data, freezing the index instead moves the
  whole channel by **72.60 USD** the first time 500 bars of history load.
- **`InpFrozenAnchorPrice` is the baseline PRICE at the anchor** (the statistic
  file's `Anchored Y-Int`), not the raw regression intercept `c`, which is the
  price at bar index 0 and is thousands of dollars from the market.
- **Both EDT offsets are signed and ADDED.** That is the convention the fractal
  search and `[EDT CHANNEL]` already use (`LOEDT Offset` really is negative).
  Subtracting the exported value would draw the lower band _above_ the baseline
  and export `loedt > base_fl`. `OnInit` refuses to start on a wrong sign.

Frozen mode still writes the structural buffers and both fit-quality models, so
`indicator_statistics` keeps receiving complete rows — and those statistics
become a **drift signal**, because R², MSE and Containment measured against a
line that is no longer being refitted answer "is the approved line still
describing this market?".

**Pillar 2 — the Centroid Watchdog.** A standalone, read-only NSSM service that
polls the STANDBY terminal's `_Statistic.txt` files and alerts once when a new
centroid has formed and stabilised.

- **Trigger:** an unseen centroid **timestamp**, not a change in the count. In a
  sliding window an ancient cluster can leave in the same cycle a new one forms,
  leaving the count unchanged (5 → 5) — a silent false negative.
- **Debounce:** the candidate must persist across `CONFIRM_BARS` **closed bars**,
  counted from `Live Bar TS (UTC)` inside the export, and must be present in
  every poll. Wall-clock seconds would let a candidate "mature" over a weekend
  when no bar ever closed.
- **Drift:** a centroid is a centre of mass, so its timestamp moves. Candidates
  are matched within `DRIFT_TOLERANCE_BARS`, or the debounce would reset every
  poll and nothing would ever confirm.
- **Seeding:** the first observation of a source records what is already there
  and alerts nothing — otherwise every service restart would announce the
  centroid the administrator has been watching all week.
- **It also watches itself:** a standby whose terminal died freezes its exports,
  which looks exactly like a quiet market. Stale exports raise their own alert.

It holds no lock and opens no database. A crash here cannot affect the
`market_data` path.

**Two new statistic blocks** carry all of this, appended to every centroid
`_Statistic.txt`. Both are additive: `parse_statistic_file()` maps only
`STAT_FIELDS` into staging columns, so no existing column changed and
`config_hash` is unaffected by their mere presence — verified. The five
`Frozen *` keys ARE registered in `STAT_CONFIG_LABELS`, which makes the existing
`indicator_configs` mechanism a free, permanent, append-only record of every
promotion. The `Snapshot *` keys deliberately are not: they drift every cycle
and would mint a new hash each time.

```
[FROZEN_SNAPSHOT]          <- what promote captures; which mode produced this row
[CENTROIDS_DETAIL]         <- the watchdog's ground truth, newest first, UTC
```

The anchor is written in **both** server and UTC form. Everything else this
stack exports is UTC, but `InpFrozenAnchorTime` is compared against MT5's own
server-time bar array — a promote script reading only the UTC form would shift
the anchor by the broker offset (2–3 hours, i.e. 24–36 M5 bars).

---

## 6. Calculation — where it happens, and what was removed

**All calculation happens inside MetaTrader.** Each of the 14 indicators
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
over ~26 minutes. In production all 14 auto-export the same bar at the same
second, and the `check_completeness` rule ("latest bar missing in: …") exists to
reject a cycle if one ever lags.

---

## 8. Deployment Guide (Windows VPS)

> ### ⚠ The host is VULTR. "Contabo" in the path is legacy.
>
> This stack lives under `1_EA-and-backfill-worker-on-**contabo**-vps/`, and "the Contabo VPS"
> appears throughout this document and the wider repo. **That name is historical** — the project
> began on Contabo. **The active deployment target is a Vultr Windows Server instance**
> (Windows Server 2022 x64), and every deployment instruction in this section applies there.
>
> **The folder is deliberately NOT renamed** (Davin's call, 2026-09-11): the path is referenced
> across a large body of historical documents, migration orders and decision records, and renaming
> it would break those references for no functional gain. Read `contabo` in any path as "the
> production Windows VPS", nothing more.
>
> **Two operational consequences that follow from Vultr specifically**, and that a reader assuming
> a long-lived Contabo box would get wrong: instances are billed **hourly**, and the workflow is
> **snapshot-and-destroy** rather than keep-alive. So anything that must survive a teardown has to
> live in the snapshot or outside the box — `C:/Scripts/database/xauusd.db` is a **replay buffer,
> not an archive** (PostgreSQL is the archive; §5.5 and the statistics lane both depend on that
> being true), and an unsynced outbox row is the one thing a destroy would genuinely lose.

### 8.1 Directory layout

```
C:/Scripts/
├── collector/   export_collector_validator_v2.py + sqlite_schema_v6_xauusd.sql
├── backfill/    backfill_worker_api_gateway_v5.py + replay_quarantine.py
├── relay/       mt5_api_relay_for_v2_29.py            (legacy, optional)
├── database/    xauusd.db, rejected_rows.jsonl
└── logs/        collector.log, push_worker.log, relay.log (rotating)
MT5 terminals:   see below — the export directory is a SHARED BUS, not the
                 price lane's private input.
```

**Terminals (active / hot-standby topology).** Four independent lanes read from an
MT5 terminal's `MQL5/Files/`: price (14 indicators × M5/M15), fit statistics (10
`_Statistic.txt`), the economic calendar, and — via its own separate service and
its own `CGI_EXPORT_DIR` variable — the currency & gold index engine. Only the
first three are read by `MT5Collector` from its single `--export-dir`.

| Terminal       | Carries                                            | Alternates? |
| -------------- | -------------------------------------------------- | ----------- |
| **A** (EDT)    | 14 indicators on XAUUSD M5 + 14 on M15, + calendar | Yes         |
| **B** (EDT)    | identical to A                                     | Yes         |
| **S** (static) | 8 × `OHLCV_{SYMBOL}_M5.txt` exporters (Lane 4)     | **Never**   |

A and B alternate: one is **active** (its directory is what `--export-dir` points
at) and the other is a **hot standby** — running and exporting, but read by
nobody — where the administrator retunes EDT configurations. Promotion is a change
to that one argument. Each terminal needs its own installation/data folder so the
three `MQL5/Files/` paths are genuinely distinct; a shared folder defeats the
design. `CGI_EXPORT_DIR` points at S permanently and is never touched by a
promote. Full design:
`ACTIVE-STANDBY-TERMINAL-ARCHITECTURE.md`. Procedure:
`docs/runbooks/mt5-terminal-promote.md`.

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
3. Attach all 14 indicators to the XAUUSD **M5** chart and all 14 to the **M15**
   chart; set each windowed indicator's anchors (§5.1) and confirm lines draw.
   **Repeat identically on the standby terminal** (§8.1) — A and B must be
   interchangeable, or a promote changes more than the tuning that was intended.
   Attach `EconomicCalendarExport_v2_29.mq5` to **both**; it is parameterless, so
   both produce identical output and it rides along with a promote harmlessly.
   Omitting it from one terminal stops calendar capture with no error after a
   promote to that terminal.
4. Confirm `MQL5/Files/` fills with `{Prefix}_XAUUSD_{TF}.txt` (+ the 9
   `_Statistic.txt`) each minute — **on both A and B.** A standby whose terminal is
   not actually running exports nothing, and its files freeze; since 2026-09-12 the
   collector rejects such a directory (§12 item 10) rather than accepting it
   silently, but the cycle still fails until the terminal is fixed.
5. On terminal **S**, attach `ohlcvexportlightweight_v2_29.mq5` to 8 M5 charts —
   EURUSD, USDJPY, GBPUSD, AUDUSD, NZDUSD, USDCAD, USDCHF, XAUUSD. The XAUUSD chart
   here is deliberately separate from A/B's, to avoid any cross-lane file dependency.

### 8.4 Boot order

Collector and push worker are independent and self-healing; no strict order.
The collector recreates the schema and idles when no exports are present.

---

## 9. Gateway-Side Contract (backend team) — Shared Railway Gateway

The Railway API Gateway (`https://railway-gateway-production-3796.up.railway.app`) is the
**shared ingest gateway** between:

- **Stack C (`backend-stack-c`)**: Producer pushing both price timeseries (`POST /api/v1/market-data`)
  and economic events (`POST /api/v1/economic-events`) from the Windows VPS via `backfill_worker_api_gateway_v5.py`.
- **DavinTrade News Stack (`davintrade-news-stack`)**: Ingestion and consumer pipeline where Railway Gateway
  provides NestJS controllers, Redis Bull queues, and Prisma workers that persist events into PostgreSQL
  (`EconomicEvent` table), which the Next.js frontend (`app/api/market/economic-events/route.ts`) reads
  to render real-time session countdowns and news banners on `/terminal`.

Both lanes authenticate via Bearer token (`BACKFILL_API_KEY`) and share the same gateway host.

### 9.1 Market Data Ingestion — `gateway_contract_market_data.schema.json`

The gateway must provide:

1. `POST /api/v1/market-data` accepting a body validated by
   `gateway_contract_market_data.schema.json` — the 95-field `market_data`
   record plus `terminal_id`. **All derived/indicator fields are nullable**
   (`null` = indicator inactive on that bar; never coerce to 0).
2. **Idempotent upsert** on `(symbol, timeframe, timestamp)` — duplicate
   delivery is by design (push retries).
3. Response semantics per §4.3 (200/201, 400+`{message}`, 401/403, 429 +`Retry-After`, 5xx).
4. `GET /api/v1/health` → 200.

The schema's `x-gateway-requirements` block restates idempotency and the
response contract for the backend team.

### 9.2 Economic Events Ingestion — `gateway_contract_economic_events.schema.json`

1. `POST /api/v1/economic-events` accepting an array of JSON objects validated by
   `gateway_contract_economic_events.schema.json` (25 fields, `additionalProperties: false`).
2. **Asynchronous Bull Queue & Processor**:
   - `economic-events.controller.ts` validates payloads via `ParseArrayPipe({ items: EconomicEventDto })`
     and pushes them onto the `economic-events` Bull queue.
   - `economic-events.processor.ts` consumes jobs asynchronously and performs idempotent append-only
     upserts on `(value_id, captured_at)` into PostgreSQL.
3. **Payload & Express 100 KB Limit (HTTP 413 Mitigation)**:
   - Railway Gateway's Express server enforces a default JSON body parser limit of **100 KB**.
   - Economic events batches pushed by `backfill_worker_api_gateway_v5.py` must be capped at
     **120 rows per request** (`EVENT_MAX_ROWS_PER_CYCLE = 120`), keeping payloads well below the
     limit (~70-80 KB). Batches of 250 rows (~250 KB) trigger `HTTP 413 Payload Too Large`.
   - The push worker drains the outbox in consecutive 120-row batches via an inner `while True` loop,
     clearing any backlog cleanly within a single cycle.

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
8. 🟡 **Historical indicator values are not point-in-time** — the MECHANISM is
   now BUILT and code-complete (2026-09-18), **but it is inert until an
   administrator turns it on**, so this stays amber, not green.
   Because the centroid/SSA window re-anchors to the live bar each pass (§7
   above notwithstanding — different issue), a bar's row is refitted for ~3000
   bars before it freezes, so the stored value for bar T was computed using data
   up to ~2 weeks _after_ T. Harmless for live alerting and charts (they want
   the newest fit); **invalid for backtesting, walk-forward or fitness
   scoring**, which is a second, independent blocker on the decision layer.
   ~56 of the 83 data fields drift; OHLCV and the z-score triple are genuinely
   causal and safe. The newest row is always a still-forming, partial bar.
   Full write-up and the experiment to size it:
   `HISTORICAL-VALUES-LOOK-AHEAD-BIAS-OPEN-ISSUE.md`.

   **What changed:** all 7 centroid indicators gained `InpProjectionMode`. In
   `MODE_FROZEN_LINE` the clustering and combinatorial fit are bypassed entirely
   and the approved line is projected forward from a fixed anchor instead, so a
   closed bar's `base_fl`/`uoedt`/`loedt` become mathematically immutable. SSA,
   its crossings, the fractals, ZigZag and the z-score candles all keep
   calculating live — only the structural channel freezes. See §5.6 and
   `ACTIVE-STANDBY-FROZEN-BASELINE-AND-CENTROID-ALERT-ARCHITECTURE.md`.

   **Why it is still amber, stated plainly:** the mode defaults to
   `MODE_DYNAMIC_AUTOFIT`, the `.ex5` have not been rebuilt, and no terminal has
   been switched. Until a real ACTIVE terminal is running frozen, production
   behaviour is byte-for-byte what it was. Verified so far only against
   synthetic exports driven through the real collector, where the frozen path
   repainted **0 of 44** historical bars and the dynamic path repainted
   **44 of 44** (largest move 3.29 USD) — the mechanism works; the deployment is
   §13 item 8.

   **Scope, so this is not over-read:** freezing fixes the 7 centroid variants'
   channel fields. `fractal_*`, `best_resistance` and `best_support` are stable
   but still rewrite wholesale when their anchors re-set, and are NOT covered.

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
   unaffected. The then-frozen 87-field contract was untouched. Design and rationale:
   `STATISTIC-CAPTURE-SCOPE.md`. **The Postgres migration is authored but NOT
   applied** — see §13 item 5.
10. ✅ **Stale-export-directory detection — BUILT** (2026-09-12). `validate_cycle`'s
    completeness check was **relative only**: it verified that all per-bar sources
    agreed with each other on the newest bar, never that the bar was current. A
    directory frozen by a shut-down MT5 terminal is stale in every source by the
    _same_ amount, so the sources agree perfectly and the cycle **validated clean** —
    collector logs success, push worker drains, nothing rejected, while the newest
    bar silently stops advancing and the alert engine's `ORDER BY timestamp DESC
LIMIT 1` keeps evaluating a frozen bar. It looks like a quiet market.
    Now an absolute freshness assertion rejects the cycle when the newest bar lags
    the scheduled slot by more than `MAX_BAR_LAG_MULTIPLIER × TF_SECONDS[tf]`
    (2× → 600s M5 / 1800s M15), logged through the existing `log_failure()` path so
    it reaches `validation_failures` and `rejected_rows.jsonl` like any other
    rejection. `cycle_time` is now a **required** `validate_cycle` parameter —
    deliberately not defaulted, since a silent "skip the check" path is how this
    guard would stop running unnoticed. Threshold rationale (the M5 margin is a
    deliberate 105s, erring tight because a false rejection self-heals while a
    missed detection is silent) is in the constant's own comment and in
    `ACTIVE-STANDBY-TERMINAL-ARCHITECTURE.md` §4.3. Covered by
    `test_stale_export_guard.py` (9 tests), mutation-checked: disabling the
    comparison fails 4 of them, including the uniformly-stale case.
    **This matters most under the active/hot-standby topology** (§8.1), where a
    promote points the collector at the standby — precisely the terminal most
    likely to have been left closed.

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

   **Updated 2026-09-20 — the same hazard, one round further on.** The
   enrichment pass added five more sections to all 8 channel-emitting `.mq5`
   files, so the binaries must be rebuilt again. The staleness still hides
   itself for exactly the same reason: rows are created, the cycle validates,
   and the 40 new columns are simply NULL. The check is now **stronger and
   cheaper** — a fresh `_Statistic.txt` must contain the line
   `[RESIDUAL DIAGNOSTICS; CLOSE PRICE]`. If it does, the binary is current for
   both the 2026-09-09 and the 2026-09-20 additions; if `[EDT CHANNEL]` is
   present but that line is not, the terminal is on a 2026-09-11-era build.
   That single line works for **10** of the 11 files. The eleventh,
   `SR_Levels_*_Statistic.txt`, keeps its own shape by design -- check it for
   `Max Window Bars` instead, which only the rebuilt binary writes. Run
   `verify_mq5_frozen_identifiers.py` (now covering all 10 uniform files)
   before handing anything to MetaEditor.

2. **Gateway migration** — implement the §9 contract (nullable field set,
   idempotent upsert).
3. **Windowed-anchor handling** — operational re-anchoring procedure or a
   rolling-window indicator change.
4. **Restart the collector on the VPS** after deploying the updated
   `export_collector_validator_v2.py` + `sqlite_schema_v6_xauusd.sql`. Its
   `migrate_raw_tables()` will add the new staging columns to the existing
   `xauusd.db` on first start (§5.2); `market_data` is untouched. The same
   restart also creates the `indicator_statistics` outbox (§12 item 9).
5. ✅ **`20260909120000_add_indicator_statistics` — APPLIED TO PRODUCTION
   2026-09-09**, together with the three other migrations that were pending
   there (`20260903000000_split_best_fit_variant`,
   `20260904120000_default_theme_light`,
   `20260909000000_market_data_v6_provenance_not_null`).
   **Production is `maglev.proxy.rlwy.net:58290`** — the `trading-alerts`
   project's `Postgres` service, which `railway-gateway` reaches privately at
   `postgres.railway.internal`. Confirmed from the Railway dashboard and by the
   data itself (39 app tables, 7 months of real activity, the `User.profile`
   column from the 2026-09-01 OAuth fix). The `.env.local` database
   (`turntable...:55082`) is a **staging clone** — full app schema, `market_data_v6`
   present but empty. Apply migrations with `prisma.production.config.ts`, which
   refuses to run against it.
   **A prerequisite had to be handled first:** production had **never** had
   `market_data_v6`. `20260705000000_add_market_data_v6` was recorded applied with
   `steps=0` — marked applied without executing — so `migrate deploy` would have
   skipped it and then failed on the `best_fit` rename against a non-existent
   table. Resolved by running that migration's SQL directly
   (`prisma db execute --file ...`), which made the recorded state true without
   editing migration history.
   **Verified after applying:** `market_data_v6` 90 columns (`best_fit_a` ×8,
   `best_fit_b` ×8), `cycle_id`/`collected_at` both `NOT NULL`,
   `indicator_statistics` + `indicator_configs` created, 19 migrations recorded
   with 0 failed, and the live application data unchanged.
   **The corollary worth stating plainly: the v6 pipeline has never written a row
   to PostgreSQL.** The gateway was pointed at a database that had no
   `market_data_v6` in it. That is consistent with everything else — the queue
   showing `completed 0` for days, the `.ex5` never redeployed, the timestamp bug
   unresolved until 2026-09-09. The remaining work in this section is what stands
   between the pipeline and its first real row.

6. **Build the standby and static terminals (§8.1), then rehearse one promote.**
   Not pipeline-blocking — the current single-terminal setup keeps working
   unchanged — but it is what makes indicator retuning safe, and it is the only
   part of that design a development session cannot do (attaching charts, setting
   anchors and compiling all need the VPS console). The code guard (§12 item 10)
   and the procedure (`docs/runbooks/mt5-terminal-promote.md`) both shipped
   2026-09-12 and are inert until the terminals exist. **Rehearse the first
   promote during a market close**, and confirm the rollback path before it is
   needed in anger.

7. **Deploy the 14th indicator (`SupportAndResistantAutoCalibration_v2_29`).**
   The pipeline side shipped 2026-09-16 and is tested end to end against
   synthetic exports; the physical steps are Davin's, and the ORDER matters.

   **a. Apply `20260916000000_add_market_data_v6_sr_levels` to production
   Postgres FIRST, before merging to `main`.** `railway-gateway` auto-deploys
   from `main`, the contract sets `additionalProperties: false`, and the push
   worker's 400 handler quarantines a row **and stamps `synced_at`** — so rows
   posted to a gateway that predates the columns are permanently marked synced
   and recoverable only by hand via `replay_quarantine.py`. The reverse order
   is harmless: a gateway ahead of Postgres just 5xxs and the worker retries.

   **b. Attach the `.ex5` to XAUUSD M5 and M15** (and identically to the
   standby terminal when it exists — §8.1's parity rule). The binary is
   compiled and current (2026-09-16, newer than its source). ⚠ **Decommission
   the predecessor `SupportAndResistant_v2_29.mq5` first if it is attached
   anywhere:** it defaults to the same `InpExportFileName = "SR_Levels"`, so
   both would write the same `SR_Levels_XAUUSD_{TF}.txt` and truncate each
   other at `:59`, producing non-deterministic content with two different
   statistic-file schemas.

   **c. Widen the VPS SQLite `market_data`** — either run
   `migrate_sqlite_add_sr_columns.sql` by hand, or simply restart the
   collector, whose new `migrate_market_data()` does it automatically on boot.
   Either is safe; both is safe.

   **⚠ No real capture of this indicator's export exists anywhere in the
   repo.** The parser is verified against the `.mq5` source and synthetic
   fixtures only. Diff a first real `SR_Levels_XAUUSD_M5.txt` against the
   `SOURCES['sr_levels']` header list before trusting a green cycle.

8. **Turn on the frozen baseline and the Centroid Watchdog (§5.6).** Everything
   below is code-complete, tested and committed; **none of it changes production
   behaviour until these physical steps happen**, because `InpProjectionMode`
   defaults to `MODE_DYNAMIC_AUTOFIT` and the watchdog is not installed.

   **a. Recompile all 7 centroid indicators in MetaEditor and redeploy the
   `.ex5`.** Gating for everything else in this item.
   ⚠ **A first attempt failed on 5 of the 7** — the frozen routine was written
   against the reference variant and the seven are not identifier-uniform
   (`InpCFLVisualLookback` vs `InpEDTVisualLookback`; `g_stat_excluded` and
   `g_stat_lambda` are not declared everywhere). Fixed, and now guarded by
   `verify_mq5_frozen_identifiers.py` — **run it before handing these to
   MetaEditor again.** Those failed compiles deleted 5 `.ex5`, so CherryPick A/B,
   MostRecent and NonRecent A/B have **no binary at all** right now; they were
   deliberately not restored from git, because an old binary deploys indicators
   without frozen mode and looks healthy doing it. Until then the terminals
   emit no `[CENTROIDS_DETAIL]` and no `[FROZEN_SNAPSHOT]`, the watchdog
   correctly logs "pre-upgrade file" and refuses to reason about them, and
   `generate_frozen_preset.py` correctly refuses to build a preset.
   ⚠ **This is the same self-hiding staleness as item 1.** A terminal running
   old binaries looks entirely healthy — cycles validate, rows promote, nothing
   errors — while the two new blocks are simply absent. **Confirm a fresh
   `_Statistic.txt` actually contains `[FROZEN_SNAPSHOT]` before trusting a
   green cycle.**

   **b. Install the watchdog** with `install_centroid_watchdog_service.bat`
   (deliberately a separate script — running `install_services.bat` wholesale on
   a live VPS overwrites the push worker's real credentials with placeholders;
   see §8.2). Set `WATCHDOG_STANDBY_DIR` to the terminal being TUNED and
   `WATCHDOG_ACTIVE_DIR` to the one FEEDING production. With no webhook set it
   runs in log-only mode and loses nothing — every alert is written to
   `centroid_watchdog.log` in full. **Expected on first start: 14 "seeded"
   lines and no alert.** That is correct, not a fault.

   ⚠ **Swap both paths on every promote**, and note that
   `AppEnvironmentExtra` **replaces the whole variable set** — every variable
   must be repeated, not just the two that changed. Left unswapped, the watchdog
   keeps watching the terminal that is now frozen and will never see another
   centroid: silently, because a frozen terminal reports zero centroids and that
   is indistinguishable from a quiet market.

   **c. Freeze the ACTIVE terminal — the step that actually closes §12 item 8.**
   Order matters, and it is enforced by `promote_terminal.bat`'s new pre-flight:
   1. `promote_terminal.bat` → **[4]** generates `*_FROZEN.set` from the
      terminal being promoted.
   2. **Load each preset by hand in MetaTrader** (right-click the indicator →
      Properties → Inputs → Load). ⚠ **This cannot be scripted.** MetaTrader
      exposes no way for an outside process to change a running indicator's
      inputs, and pretending otherwise would be the worst failure available
      here: the script reports success, the administrator believes the terminal
      is frozen, and it goes on repainting ~3000 bars for as long as nobody
      checks.
   3. → **[5]** verifies the terminal genuinely reports `FROZEN`. **Do not skip
      this.** Loading a preset is the step most likely to be half-done, and
      without the check the failure is invisible.
   4. Only then → **[1]/[2]** to point the collector at it.
   5. Load `DAVINTRADE_DYNAMIC.set` into the terminal being demoted, so the new
      hot standby starts hunting for the next regime.

   **d. Rehearse it once during a market close**, alongside item 6's promote
   rehearsal. Nothing in this item has ever run against a live MT5 terminal;
   verification so far is synthetic exports driven through the real collector,
   the real watchdog process and the real preset generator.

   **Statistics capture is deliberately NOT part of this.** `sr_levels` is
   excluded from `STAT_SOURCES`: its `_Statistic.txt` records Freedman-Diaconis
   calibration (Q25/Q75, IQR, Optimal Step), not regression fit quality, so
   almost none of its labels exist in `STAT_FIELDS` — and
   `gateway_contract_indicator_statistics.schema.json` pins `source` to a
   closed enum while that POST is batched, so one `sr_levels` element would
   400 the whole request and quarantine every other snapshot in it. MT5 still
   writes the file. Ingesting it properly is its own scoped piece of work.

Deferred product features (separate workstreams, not pipeline-blocking):
trendline image rendering + statistical scoring/advice; parameter-revision
alerting.

---

## 14. Legacy EA Socket-Push Path (reference only — NOT in the v6 data flow)

Retained for history and for a possible future return to a low-latency push
feed. Not deployed as part of v6; if the EA runs on the XAUUSD terminal its only
purpose is keeping charts/indicators alive so they auto-export.

### 14.1 EA — `SimpleDataCollector_v2_29_ASYNC_SOCKET.mq5`

Loads 12 `iCustom` handles (the 13 indicators it was written against, minus
OHLCV, which it reads via `CopyRates`; it has no handle for the 14th,
`SupportAndResistantAutoCalibration_v2_29`, and needs none — adding an
indicator cannot break `OnInit`, unlike the 2026-09-03 rename) — including a `best_fit_a`/`best_fit_b` pair since the
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

| Item                                          | State                                                                                                                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EA / indicators                               | v2.29 (hyphen-free `mq5/` names; auto-export; SSA 8-decimal). **2026-09-09: GMT-offset fix in all 13 — needs recompile (§7.1)**                                                 |
| Schema                                        | v6 (`xauusd.db`: staging + validation + `market_data` outbox). **2026-09-09: staging widened to every exported column**                                                         |
| Collector                                     | v2 (header-name parsing; market-hours gate). **2026-09-09: CALCULATE stage removed; `migrate_raw_tables()` added**                                                              |
| Push worker                                   | v5 (`market_data` outbox; synced_at; quarantine+replay)                                                                                                                         |
| Calc stack                                    | **PARKED 2026-09-09** — `calculation-split-between-mt5-and-python-PENDING-PROJECT/`. Not deployed, not running (§6)                                                             |
| Centroid variants (2026-09-03)                | `best_fit` split into `best_fit_a` (config-identical to the old `best_fit`) + `best_fit_b` (new preset) — 6→7 variants, 12→13 indicators, `market_data` 79→87 columns           |
| `market_data` shape                           | 87 columns from the 2026-09-03 split, unchanged by the 2026-09-09 work — the contract, both Prisma schemas and the DTO were untouched then                                      |
| 14th indicator (2026-09-16)                   | `SupportAndResistantAutoCalibration_v2_29` onboarded — 13→14 indicators, 87→95 columns, new `raw_sr_levels` + `migrate_market_data()`; statistics capture deliberately deferred |
| Legacy v2.28/v2.27/v2.26 EAs, `.ex5` binaries | history only — do not deploy                                                                                                                                                    |

The files in §0 are the deployment set; everything else in the directory is
historical.
