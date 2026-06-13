# Data Collection Pipeline — Architecture Blueprint (v2.29 / v6 Stack)

**Status:** Authoritative reference ("the bible") for the XAUUSD data-collection
pipeline. Calc stack **CERTIFIED** (§6). Pre-production: two integration items
remain (gateway migration, timestamp-conversion) — see §13.
**Last Updated:** 2026-06-13
**Scope:** Full market-data pipeline on the Contabo VPS —
MT5 chart indicators → auto-exported `.txt` files → collect / validate /
**calculate** / promote (SQLite `xauusd.db`) → push to the Railway API Gateway.
**Symbol/timeframes in scope:** XAUUSD, M5 and M15 only.

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

| File                                       | Role                                                                   | Ref   |
| ------------------------------------------ | ---------------------------------------------------------------------- | ----- |
| `mq5/` (12 indicators, see §0.4)           | Data producers: compute + auto-export admin-layer `.txt` files         | §5.1  |
| `export_collector_validator_v2.py`         | Pipeline engine: COLLECT → ADJUST → VALIDATE → **CALCULATE** → PROMOTE | §5.2  |
| `zscore_candle.py`                         | Calc module — candle body direction/size/classification                | §6    |
| `zigzag_metrics.py`                        | Calc module — zigzag segment metrics                                   | §6    |
| `fractal_lines.py`                         | Calc module — fractal / resistance / support lines                     | §6    |
| `centroid_regression.py`                   | Calc module — 6 centroid variants as one parameterized engine          | §6    |
| `sqlite_schema_v6_xauusd.sql`              | `xauusd.db` schema: staging + validation + `market_data`               | §5.3  |
| `backfill_worker_api_gateway_v5.py`        | Push worker: `market_data WHERE synced_at IS NULL` → gateway           | §5.4  |
| `gateway_contract_market_data.schema.json` | JSON-Schema of the POST body the gateway must accept                   | §9    |
| `install_services.bat`                     | Windows/NSSM installer for the VPS services                            | §8.2  |
| `replay_quarantine.py`                     | Re-POST gateway-rejected rows after a fix                              | §10.2 |

### 0.2 Legacy (retained for reference; NOT in the v6 data flow — §14)

| File                                         | Role                                                                                                      | Ref   |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----- |
| `SimpleDataCollector_v2_29_ASYNC_SOCKET.mq5` | EA socket-push producer (legacy path); on the v6 terminal its only job is keeping charts/indicators alive | §14.1 |
| `mt5_api_relay_for_v2_29.py`                 | Local async TCP relay for the legacy socket path                                                          | §14.2 |

### 0.3 Certification & tests — `mql5-to-python-transliteration/`

| File                                  | Role                                                                                                              | Ref  |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---- |
| `golden_certification.py`             | Harness: calc stack vs full 3000-bar MQL5 exports (uses each line indicator's `_Statistic.txt` for window+params) | §6.2 |
| `golden_certification_report_M5.txt`  | M5 certification evidence (39/50)                                                                                 | §6.2 |
| `golden_certification_report_M15.txt` | M15 certification evidence (50/50)                                                                                | §6.2 |
| `test_phase1_golden.py`               | 23 checks — z-score candle + zigzag metrics (golden vs mock + units)                                              | §6.3 |
| `test_phase2_lines.py`                | 30 checks — fractal/resistance/support line geometry                                                              | §6.3 |
| `test_phase3_centroid.py`             | 40 checks — centroid engine (DBSCAN, selection, WLS, EDTs, stats)                                                 | §6.3 |
| `CERTIFICATION.md`                    | The formal verdict and accepted-tolerance record                                                                  | §6.4 |
| `README.md`                           | Calc-stack overview, porting rules, phase table                                                                   | §6   |

> These also live at `backend-stack-c/2_python-calc-stack/` (original home). The
> collector resolves the calc modules from either location (§5.2).

### 0.4 The 12 export indicators — `mq5/`

Filenames are hyphen-free (MQL5 indicator names); the EA's `iCustom()` and the
collector's file-prefix map both depend on these exactly.

| `mq5/` file                                                   | Export-file prefix (`InpExportFileName`) | Collector source key |
| ------------------------------------------------------------- | ---------------------------------------- | -------------------- |
| `2EDTCentroidRegressionBestFitNonMostRecent_v2_29.mq5`        | `Centriod_Best_Fit`                      | `best_fit`           |
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

1. **Single source of truth = validated export files.** All 12 indicators
   export per-bar `.txt` files; the collector cross-validates them, computes the
   derived layer in Python, and promotes one coherent `market_data` row per bar.
2. **MQL5 computes the minimum; Python computes the configurable.** MQL5 owns
   the heavy/stable admin layer (SSA, fractal maps, OHLCV, zigzag pivots);
   Python owns every user-configurable derived value (§3). This enables the
   on-demand / user-parameterized services and collapses the 6 centroid
   indicators into one engine.
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
│  │ 12 export indicators  (§5.1) │ ───────────────►  MQL5/Files/                │
│  │  6× Centroid Regression      │                   {Prefix}_XAUUSD_{TF}.txt   │
│  │  Fractal Best-Fit v5         │                   (admin-layer columns)      │
│  │  Single Best Resist/Support  │                          │                   │
│  │  ZigZag v43 / OHLCV / ZScore │                          ▼                   │
│  └──────────────────────────────┘   ┌──────────────────────────────────────┐  │
│                                      │ export_collector_validator_v2.py(§5.2)│ │
│  every 5 min at :05, market-hours    │  COLLECT  → 12 raw_* staging tables   │  │
│  gated; M15 on 15-min boundaries     │  ADJUST   → timestamp_adj (see §7)    │  │
│                                      │  VALIDATE → keys agree across sources │  │
│                                      │             (symbol/tf/close ±0.01)   │  │
│                                      │  CALCULATE→ calc stack (§6) fills the │  │
│                                      │             Python-owned columns      │  │
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

1. **COLLECT** — read the 12 `{Prefix}_XAUUSD_{TF}.txt` files; stage admin-layer
   columns into the 12 `raw_*` tables under one `collection_cycles` row.
2. **ADJUST** — compute `timestamp_adj` (bar-grid alignment; see §7 for the
   per-source phase caveat).
3. **VALIDATE** — cross-source agreement on the keys (`timestamp_adj`, `symbol`,
   `timeframe`, `close` within `CLOSE_TOLERANCE`); zigzag checked as a pivot
   subset of the OHLCV spine. Any mismatch → reject whole cycle, log to
   `validation_failures`, purge staged rows, re-request (`attempt+1`, ≤3).
4. **CALCULATE** — the calc stack (§6) computes every Python-owned value from
   the staged admin layer + OHLCV.
5. **PROMOTE** — merge admin + calculated onto the OHLCV per-bar spine into
   `market_data` (LEFT-JOIN semantics; absent values stay `NULL`).

The push worker then drains `market_data WHERE synced_at IS NULL` to the gateway.

---

## 3. The MQL5 ↔ Python Data Split (core design)

Authoritative column lists:
`data-split-between-mql5-and-python/Export Data from MQL5 indicators.txt` and
`…/Python stacks calculation.txt`.

### 3.1 MQL5 exports (the admin layer)

| Source              | Exported columns (after the 4 keys `timestamp,symbol,timeframe,close`) |
| ------------------- | ---------------------------------------------------------------------- |
| 6 centroid variants | `horiz_high_map`, `horiz_low_map`, `ssa`, `ema_ssa`, `crossing`        |
| `Fractal_EDT`       | (keys only)                                                            |
| `Resistance_Line`   | (keys only)                                                            |
| `Support_Line`      | (keys only)                                                            |
| `OHLCV`             | `open`, `high`, `low`, `volume` — the per-bar spine                    |
| `ZigZag`            | `Type`, `CurrentPoint` (pivot events, not per-bar)                     |
| `ZScore`            | `open`, `high`, `low`                                                  |

The 4 keys appear on **every** source and are the validation contract. SSA is
exported at **8 decimals** (raised from 5 — needed for centroid-boundary
fidelity, see §6.4).

### 3.2 Python calculates (the derived layer)

| Calc module              | Produces                                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `centroid_regression.py` | per variant: `Base_FL`, `UOEDT`, `LOEDT` (+ stats buffers)                                                        |
| `fractal_lines.py`       | `Fractal_Best_FL/UOEDT/LOEDT`, `Best_Resistance`, `Best_Support`                                                  |
| `zigzag_metrics.py`      | `CurrentPrChg`, `Current%Chg`, `%ChgClass`, `Bars`, `BarsClass`, `PrPerBar`, `PrPerBarClass`, `Slope`, `Category` |
| `zscore_candle.py`       | `body_direction`, `body_size` (=\|z\|), `body_classification`                                                     |

### 3.3 Architecture decision — RESOLVED: export files are the source of truth

Cross-source validation only makes sense on the export-file path (the EA socket
path reads all buffers from one chart at one instant — nothing to
cross-validate). **Decision (June 2026): the validated export pipeline is the
source of truth for XAUUSD M5/M15.** The EA's remaining job on that terminal is
keeping the charts/indicators alive; its socket/SQLite machinery and the relay
are retained only for reference (§14).

### 3.4 Why the split (business rationale)

MQL5-computed values are effectively hard-coded (admin-configured in the
terminal). Moving the derived layer to Python lets end users configure
parameters (window dates, centroid inclusion/exclusion, min-EDT-touches,
tolerances, thresholds) and removes the Non-A/Non-B/Cherry-A/Cherry-B
redundancy — the 6 centroid indicators become 6 parameter presets of one
engine (`centroid_regression.VARIANT_PRESETS`). The same modules serve both the
pipeline (fixed presets, stored in `market_data`) and an on-demand
user-parameterized service.

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

The promoted wide table (79 columns). Field-by-field contract is
`gateway_contract_market_data.schema.json` (§9). Column families: the 4 keys,
OHLCV, the 6 centroid families (admin: `*_horiz_high_map/_horiz_low_map/_ssa/
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

### 5.1 Export indicators — `mq5/` (12 files)

One full set on the XAUUSD M5 chart, one on the M15 chart. Each computes its
buffers and auto-exports the admin-layer columns (§3.1).

- **Auto-export inputs (all 12):** `InpAutoExport=true` (1-second `EventSetTimer`
  loop), `InpExportSecond=59` — keep identical across all 12 so files are
  written in near-lockstep.
- **Manual/button export retained** in every indicator for human review
  (format/correctness vs the chart); also answer the `CHARTEVENT_CUSTOM+1000` /
  `"EXPORT_ALL"` broadcast.
- **Statistic files:** the 6 centroid variants and the 3 windowed line
  indicators emit `_Statistic.txt` (window anchors + params + resolved line);
  OHLCV/ZigZag/ZScore do not (fully reproducible from their timeseries).
- **OHLCV depth** `InpBars=3000` to match the centroid math lookback.
- ⚠️ **Windowed-anchor caveat:** Fractal-Best-Fit and both Single-Best lines use
  fixed `InpStartDateTime`/`InpEndDateTime`; re-anchor per analysis window (§13).
- ⚠️ **CPU:** each centroid variant runs an SSA engine over `InpSSAMathLookback`
  (3000) bars; six variants × two charts is moderate — avoid extra charts.

### 5.2 Collector + validator — `export_collector_validator_v2.py`

The pipeline engine. Imports the 4 calc modules (resolves them whether they sit
alongside this file or in a sibling `2_python-calc-stack/`).

| Constant                 | Default                         | Meaning                                                            |
| ------------------------ | ------------------------------- | ------------------------------------------------------------------ |
| `CLOSE_TOLERANCE`        | `0.01`                          | Close-spread tolerance (one XAUUSD point); do not widen past ~0.05 |
| `MAX_ATTEMPTS_PER_CYCLE` | `3`                             | Reject → re-request attempts per slot                              |
| `RETRY_WAIT_SEC`         | `65`                            | Wait for the next per-minute auto-export before re-reading         |
| `CYCLE_INTERVAL_SEC`     | `300`                           | Cadence; fires at :05 past each boundary                           |
| `DEFAULT_EXPORT_DIR`     | terminal `MQL5/Files`           | Where the 12 files are read — configure per VPS                    |
| `DEFAULT_DB_PATH`        | `C:/Scripts/database/xauusd.db` | v6 database (schema auto-applied on start)                         |

- **Parsing is header-name-based**, so it accepts both full (current) and
  reduced (future-slimmed) exports without code change.
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
| 12 × `raw_*`                       | per-source staging (admin-layer columns only); lead with keys `cycle_id, timestamp_raw, timestamp_adj, symbol, timeframe, close`                             |
| `v_validation_keys` (+ `…_zigzag`) | UNION view of the 11 per-bar sources' keys for the cross-source mismatch query (zigzag exposed separately as sparse pivots)                                  |
| `validation_failures`              | per-mismatch forensic log (field + per-source values as JSON)                                                                                                |
| `market_data`                      | validated wide table (79 cols); PK `(timestamp, timeframe)`; `synced_at` outbox (NULL = unsynced; rows are marked, never deleted); partial index on unsynced |

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

## 6. Calculation Stack & Certification

Four pure-Python modules, literal transliterations of the MQL5 calculation
logic (no library substitution — e.g. DBSCAN/K-means are hand-ported, not
sklearn, to preserve exact cluster membership). Full porting rules and the
phase table are in `mql5-to-python-transliteration/README.md`.

| Module                   | Source MQL5 indicators                                                   |
| ------------------------ | ------------------------------------------------------------------------ |
| `zscore_candle.py`       | `zscoreohlccandleexport` (rolling sample z-score, signed classification) |
| `zigzag_metrics.py`      | `ZigZagExportv43` metric layer (pivot detection stays in MQL5)           |
| `fractal_lines.py`       | `2EDTFractalBestFitv5`, `SingleBestResistance/Supportv3`                 |
| `centroid_regression.py` | all six `2EDTCentroidRegression*` (one engine; `VARIANT_PRESETS`)        |

### 6.1 Unit/golden test suite (run after any calc-module change)

```
python3 test_phase1_golden.py      # 23 checks — z-score candle + zigzag metrics
python3 test_phase2_lines.py       # 30 checks — fractal/resistance/support geometry
python3 test_phase3_centroid.py    # 40 checks — DBSCAN/selection/WLS/EDTs/stats
```

93/93 passing.

### 6.2 Golden certification — `golden_certification.py`

Compares every calc-stack output against the user's full 3000-bar MQL5 exports
(`mock-data-from-indicators/golden_certification/`, M5 + M15), reading each line
indicator's `_Statistic.txt` for the exact window + parameters. Evidence:
`golden_certification_report_M5.txt`, `…_M15.txt`.

```
python3 golden_certification.py  <…>/m5_timeseries  M5  <…>/m5_statistic
python3 golden_certification.py  <…>/m15_timeseries M15 <…>/m15_statistic
```

### 6.3 Result

| Timeframe | Result                                      |
| --------- | ------------------------------------------- |
| **M15**   | **50 / 50 PASS** — full stack exact (~5e-6) |
| **M5**    | 39 / 50 PASS — see §6.4                     |

Certified exact (both TFs): z-score candle set; all zigzag metrics; single-best
resistance & support; fractal flip line + EDTs; the full best_fit centroid chain
(DBSCAN → WLS subset search → baseline → EDTs → stats); cherry_b; and every
variant's baseline, slope, anchored intercept, and lower EDT.

### 6.4 Accepted bounded tolerance (the 11 M5 checks) — see `CERTIFICATION.md`

1. **most_recent / non_a upper EDT (UOEDT) only** — MQL5 selects an upper EDT
   through a fractal it counts as 3 touches but the per-bar export reconstruction
   yields 2. Lower EDT, baseline, slope, stats all exact; the same `_edts` code
   certifies for best*fit/cherry_b and the Fractal indicator. Root cause: a
   data-reconstruction fidelity limit of the per-bar `horiz*\*\_map` export — NOT
   a numeric/language difference and NOT a min-touches difference (proven).
2. **cherry_a / non_b ~0.08–0.1 price (~2e-5 rel.)** — a single crossing on the
   DBSCAN epsilon boundary flips cluster membership, nudging one centroid.
   Confirmed NOT SSA precision (export is 8-decimal). Inherent boundary
   sensitivity; lands on different variants per dataset (M15 has none → 50/50).

**Verdict (accepted):** the port is faithful — M15 100% and the exact best_fit
WLS+EDT chain prove it. M5 residuals are tiny (≤~0.1 price on a ~4200 instrument,
on overlay lines) and have no operational impact since, post-cutover, Python is
the source of truth. **Production rule:** the centroid EDT stage must keep using
the staged `horiz_high_map`/`horiz_low_map` fractals (self-detected fractals
were tested and are worse — they break best_fit).

---

## 7. Validation & the timestamp-conversion requirement

Validation compares the four keys across sources per cycle. `symbol` and
`timeframe` are constants; `close` is the strong signal (compared within
`CLOSE_TOLERANCE=0.01`, numeric). ZigZag is validated as a subset (each pivot's
keys must match the OHLCV bar at the same `timestamp_adj`).

**Open item — `timestamp_adj` normalization (owned separately).** Each indicator
exports raw bar timestamps with a **different constant sub-bar phase**
(observed `%300`: ohlcv 206, best_fit 4, cherry_a 240, cherry_b 288, …). Bars
align perfectly **by sequence** (verified 2989/2989), but simple round/floor
gridding sends the same physical bar to different slots, so cross-source close
validation cannot pass on heterogeneous exports. The collector currently fills
`timestamp_adj` with a documented placeholder (`round(raw/tf)*tf`). The
dedicated raw→adjusted conversion stack must align all sources to one canonical
grid (sequence / OHLCV-spine snap), or — the cheaper fix — the indicators must
be changed to export one consistent timestamp convention. In production all 12
auto-export the same bar simultaneously, but because they currently emit
different conventions, this must be resolved before a green end-to-end run
(§13).

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
MT5 terminal:    12 indicators on the XAUUSD M5 chart + 12 on the M15 chart;
                 exports land in <terminal>/MQL5/Files/
```

### 8.2 Service install — `install_services.bat`

Run elevated; edit the CONFIG block (Python path, ROOT, `EXPORT_DIR`, `DB`,
`BACKFILL_API_KEY`) first. It installs three auto-restarting NSSM services:
`MT5Collector` (pipeline engine), `MT5PushWorker` (outbox → gateway), and
`MT5Relay` (legacy, optional). Prereqs: NSSM on PATH; `pip install aiohttp
requests`. Verify with `nssm status MT5Collector` / `MT5PushWorker`.

### 8.3 Indicator/terminal setup

1. Compile the 12 `mq5/` indicators in MetaEditor.
2. Tools → Options → Expert Advisors: allow `127.0.0.1` (only needed if the
   legacy EA/relay is used).
3. Attach all 12 indicators to the XAUUSD **M5** chart and all 12 to the **M15**
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
   `gateway_contract_market_data.schema.json` — the 79-field `market_data`
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
| Cycles repeatedly `rejected`         | Sources disagree (often timestamp_adj — §7) or an indicator stopped exporting | Read `validation_failures`; check the 12 files' freshness |
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

1. **`timestamp_adj` normalization is a placeholder** — cross-source validation
   needs the conversion stack or consistent indicator timestamps (§7, §13).
2. **M5 UOEDT (most_recent/non_a) + cherry_a/non_b residuals** — accepted bounded
   tolerance; M15 fully exact (§6.4, `CERTIFICATION.md`).
3. **Windowed indicator anchors go stale** — re-anchor per window, or make the
   window roll automatically (§13).
4. **Indicators still export full columns** — the calc-stack-owned columns are
   ignored by the header-name parser, so slimming the exports to the §3.1 admin
   layer is optional cleanup, safe to defer.
5. **Centroid EDT must use staged horiz-map fractals** — self-detection is worse
   (§6.4).
6. **Legacy socket path retained** (§14) — not in the v6 flow; do not wire it
   into `market_data`.

---

## 13. Remaining Work to Production Cutover

1. **Timestamp-conversion stack** (§7) — align sources to one canonical grid
   (sequence/OHLCV-spine snap), or fix the indicators to export one consistent
   timestamp convention. **Gating** for a green end-to-end validation run.
2. **Gateway migration** — implement the §9 contract (nullable field set,
   idempotent upsert).
3. **Windowed-anchor handling** — operational re-anchoring procedure or a
   rolling-window indicator change.
4. (Optional) **Slim the indicator exports** to the §3.1 admin layer once the
   above are stable.

Deferred product features (separate workstreams, not pipeline-blocking):
trendline image rendering + statistical scoring/advice; parameter-revision
alerting.

---

## 14. Legacy EA Socket-Push Path (reference only — NOT in the v6 data flow)

Retained for history and for a possible future return to a low-latency push
feed. Not deployed as part of v6; if the EA runs on the XAUUSD terminal its only
purpose is keeping charts/indicators alive so they auto-export.

### 14.1 EA — `SimpleDataCollector_v2_29_ASYNC_SOCKET.mq5`

Loads 11 `iCustom` handles (the 12 indicators minus OHLCV, which it reads via
`CopyRates`). **Its `iCustom` names must exactly match the `mq5/` filenames**
(§0.4) — updated to the hyphen-free v2.29 names. In the legacy design it
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

| Item                                          | State                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| EA / indicators                               | v2.29 (hyphen-free `mq5/` names; auto-export; SSA 8-decimal)             |
| Schema                                        | v6 (`xauusd.db`: staging + validation + `market_data` outbox)            |
| Collector                                     | v2 (CALCULATE stage; header-name parsing; market-hours gate)             |
| Push worker                                   | v5 (`market_data` outbox; synced_at; quarantine+replay)                  |
| Calc stack                                    | Phases 1–3 ported; 93/93 tests; CERTIFIED (M15 50/50, M5 39/50 accepted) |
| Legacy v2.28/v2.27/v2.26 EAs, `.ex5` binaries | history only — do not deploy                                             |

The files in §0 are the deployment set; everything else in the directory is
historical.
