# XAUUSD Data Pipeline & Multi-Timeframe Visualisation — Combined Architecture Design Document

**Status:** Pre-production. Calc stack certified. Two integration items remain (timestamp-conversion, gateway migration) — see §11.
**Scope:** Full market-data pipeline (MT5 indicators → validated SQLite → API gateway) plus the downstream multi-timeframe chart renderer, for XAUUSD, M5 and M15 only.
**Companion deliverable:** `Combined_Architecture_Overview.pptx` (11-slide executive summary). This document is the detailed reference behind those slides — read the deck first for orientation, this document for implementation-level detail.
**Sources:** every file in `v2_29_data_pipeline_architecture/` and `v2_29_multi-timeframe-visualisation/`, including the legacy EA (`SimpleDataCollector_v2_29_ASYNC_SOCKET.mq5`, v2.29.1).

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [File Manifest](#3-file-manifest)
4. [The MQL5 ↔ Python Data Split](#4-the-mql5--python-data-split)
5. [The 12 Export Sources](#5-the-12-export-sources)
6. [Pipeline Stages in Detail](#6-pipeline-stages-in-detail)
7. [The Calculate Stage — Four Python Modules](#7-the-calculate-stage--four-python-modules)
8. [Data Contracts](#8-data-contracts)
9. [Distribution, Recovery & Deployment](#9-distribution-recovery--deployment)
10. [Two Extraction Paths: TXT Export vs. the Legacy EA](#10-two-extraction-paths-txt-export-vs-the-legacy-ea)
11. [Multi-Timeframe Visualisation (mtf_render)](#11-multi-timeframe-visualisation-mtf_render)
12. [Technology Stack](#12-technology-stack)
13. [Testing & Certification](#13-testing--certification)
14. [Known Issues, Gaps & Accepted Trade-offs](#14-known-issues-gaps--accepted-trade-offs)
15. [Remaining Work to Production Cutover](#15-remaining-work-to-production-cutover)
16. [Appendix A — market_data Column Reference](#appendix-a--market_data-column-reference)
17. [Appendix B — Glossary](#appendix-b--glossary)

---

## 1. Executive Summary

The system is two stacks that form one continuous pipeline plus one independent downstream consumer.

Twelve MQL5 sources — six centroid-regression variants, an OHLCV spine, a ZigZag pivot feed, and four validation-only heartbeats — run inside a MetaTrader 5 terminal on a Windows VPS, attached to the XAUUSD M5 and M15 charts. Each source computes its own buffers and auto-exports them to a tab-separated `.txt` file once a minute. A Python collector (`export_collector_validator_v2.py`) reads those files every five minutes, cross-validates them against each other, runs four pure-Python calculation modules to derive every user-configurable value, and promotes one coherent 79-column row per bar into a SQLite table (`market_data`).

From `market_data`, data flows two independent ways. A push worker (`backfill_worker_api_gateway_v5.py`) drains unsynced rows to a Railway-hosted API gateway over HTTPS, with a quarantine-and-replay safety net for rejected rows. Separately, a backend rendering module (`mtf_render`) reads the same table directly — never recomputing anything — to produce a three-panel PNG showing an M5 chart and two M15 charts, all three sharing the same equal-distance channel computed once on M5.

A second, independent way of reading the same 12 MQL5 sources also exists: a legacy Expert Advisor (`SimpleDataCollector_v2_29_ASYNC_SOCKET.mq5`) that attaches `iCustom()` handles to 11 of the 12 sources and pulls values directly out of indicator memory via `CopyBuffer()`, pushing over a local TCP socket or falling back to a per-symbol SQLite database. This path is **not** part of the production data flow — it predates the current architecture and is retained only in case a low-latency push-based path is needed again in the future. As of v2.29.1 its schema has been corrected to match the current contract (see §10), but it remains disconnected from `market_data`.

The system's calculation logic is deliberately split: MQL5 owns the admin layer — the heavy, stable, effectively hard-coded computations (SSA smoothing, fractal detection maps, OHLCV, ZigZag pivots) — while Python owns every value a user might want to reconfigure (centroid regression baselines and channels, fractal/resistance/support lines, ZigZag segment metrics, z-score candle classification). This collapses what were six near-duplicate MQL5 indicators into one parameterized Python engine and allows the same modules to serve both the fixed-preset production pipeline and a future on-demand, user-parameterized service.

The calc stack is certified against 3000-bar golden MQL5 exports: M15 is exact 50/50, M5 is 39/50 exact with the remaining 11 checks within an accepted, understood, sub-pixel tolerance (see §13). Two items gate full production cutover: a timestamp-normalization stack (§14.1) and the gateway-side implementation of the data contract (§15).

---

## 2. System Architecture

```
┌───────────────────────────────── Windows VPS (Contabo) ─────────────────────────────────┐
│                                                                                            │
│   MT5 Terminal — XAUUSD M5 chart + XAUUSD M15 chart                                        │
│   ┌────────────────────────────┐   auto-export every minute at second :59                 │
│   │ 12 export sources (§5)     │ ───────────────►  MQL5/Files/                             │
│   │  6× Centroid Regression    │                    {Prefix}_XAUUSD_{TF}.txt               │
│   │  Fractal Best-Fit v5       │                    (admin-layer columns only)             │
│   │  Single Best Resist/Support│                            │                              │
│   │  ZigZag v43 / OHLCV /      │                            ▼                              │
│   │  ZScore                   │   ┌──────────────────────────────────────────────────┐   │
│   └────────────────────────────┘   │ export_collector_validator_v2.py                  │   │
│    ▲ (also read directly via       │  COLLECT   → 12 raw_* staging tables              │   │
│    │  iCustom()/CopyBuffer() by    │  ADJUST    → timestamp_adj (placeholder — §14.1)  │   │
│    │  the legacy EA — §10;         │  VALIDATE  → cross-source key agreement           │   │
│    │  inert, not in this flow)     │  CALCULATE → 4 calc modules fill derived columns  │   │
│                                     │  PROMOTE   → market_data  ──reject?───────┐       │   │
│                                     └──────────────────┬─────────────────────┬─┘       │   │
│                                                        │        re-request (≤3, §6.3)  │   │
│                                                        ▼   ◄─────────────────────────────┘   │
│                              xauusd.db  (SQLite; §8.2)                                    │
│                              market_data  (validated; synced_at outbox; 79 cols)          │
│                                        │                                                  │
│                    ┌───────────────────┴───────────────────┐                              │
│                    ▼                                       ▼                              │
│   ┌──────────────────────────────┐         ┌──────────────────────────────────────┐      │
│   │ backfill_worker_api_          │  HTTPS  │ mtf_render (data_source.py +          │      │
│   │ gateway_v5.py (§9)            │────────►│ renderer.py) — reads market_data      │      │
│   │ push WHERE synced_at IS NULL; │  Railway│ directly, no recomputation            │      │
│   │ 400 → quarantine + replay     │  Gateway└──────────────────┬───────────────────┘      │
│   └────────────────────────────────┘                            ▼                          │
│                                                    3-panel PNG (Chart A: M5 + channel;      │
│                                                    Chart B/C: M15 + M5 channel overlaid)     │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

**One five-minute cycle, in one sentence:** read the 12 files, stage them, adjust and cross-validate their timestamps, compute every derived value in Python, merge admin and derived columns onto the OHLCV spine, write the row to `market_data`, and let the push worker and the renderer each independently do what they do with it.

---

## 3. File Manifest

### 3.1 Pipeline runtime — `v2_29_data_pipeline_architecture/`

| File                                       | Role                                                               |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `mq5/` (12 files)                          | Data producers — compute + auto-export admin-layer `.txt` files    |
| `export_collector_validator_v2.py`         | Pipeline engine: COLLECT → ADJUST → VALIDATE → CALCULATE → PROMOTE |
| `zscore_candle.py`                         | Calc module — candle body direction/size/classification            |
| `zigzag_metrics.py`                        | Calc module — ZigZag segment metrics                               |
| `fractal_lines.py`                         | Calc module — fractal / resistance / support lines                 |
| `centroid_regression.py`                   | Calc module — six centroid variants as one parameterized engine    |
| `sqlite_schema_v6_xauusd.sql`              | `xauusd.db` schema: staging + validation + `market_data`           |
| `backfill_worker_api_gateway_v5.py`        | Push worker: `market_data WHERE synced_at IS NULL` → gateway       |
| `gateway_contract_market_data.schema.json` | JSON Schema of the POST body the gateway must accept               |
| `install_services.bat`                     | Windows/NSSM installer for the VPS services                        |
| `replay_quarantine.py`                     | Re-POST gateway-rejected rows after a fix                          |
| `sqlite_schema_v6_xauusd_preview.txt`      | Excel-openable preview of `market_data` with mock rows             |

### 3.2 Legacy — retained for reference, not in the v6 flow

| File                                                   | Role                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------ |
| `SimpleDataCollector_v2_29_ASYNC_SOCKET.mq5` (v2.29.1) | EA socket-push producer; schema-aligned but inert (§10)      |
| `mt5_api_relay_for_v2_29.py`                           | Local async TCP relay for the legacy socket path (unchanged) |

### 3.3 The 12 export indicators — `mq5/`

See §5 for the full breakdown by function. Filenames are hyphen-free MQL5 indicator names; both the EA's `iCustom()` calls and the collector's file-prefix map depend on these exactly.

### 3.4 Visualisation — `v2_29_multi-timeframe-visualisation/`

| File                        | Role                                                                         |
| --------------------------- | ---------------------------------------------------------------------------- |
| `mtf_render/data_source.py` | Reads `market_data` into pandas DataFrames; builds the shared Channel object |
| `mtf_render/renderer.py`    | Matplotlib renderer — hand-drawn candles + channel on a real time axis       |
| `mtf_render/fixture.py`     | Synthetic golden fixture for dev/demo (no live DB needed)                    |
| `mtf_render/__main__.py`    | CLI entry point                                                              |
| `test_mtf_render.py`        | Smoke tests (channel-sharing, all-variants, PNG output)                      |
| `requirements.txt`          | `matplotlib>=3.7`, `pandas>=2.0`, `numpy>=1.24`                              |

---

## 4. The MQL5 ↔ Python Data Split

### 4.1 Design rationale

MQL5-computed values are effectively hard-coded — configuring them means editing indicator inputs and recompiling in MetaEditor. Moving every user-configurable derived value into Python lets end users reconfigure parameters (window dates, centroid inclusion/exclusion, minimum EDT touches, tolerances, thresholds) without touching MQL5, and it collapses what were six independent, largely-duplicated centroid-regression indicators into one engine with six parameter presets (`centroid_regression.VARIANT_PRESETS`). The same modules serve both the fixed-preset production pipeline (stored in `market_data`) and a possible future on-demand, user-parameterized service.

### 4.2 What MQL5 exports (the admin layer)

| Source              | Exported columns (after the 4 keys: `timestamp, symbol, timeframe, close`) |
| ------------------- | -------------------------------------------------------------------------- |
| 6 centroid variants | `horiz_high_map`, `horiz_low_map`, `ssa`, `ema_ssa`, `crossing`            |
| `Fractal_EDT`       | keys only                                                                  |
| `Resistance_Line`   | keys only                                                                  |
| `Support_Line`      | keys only                                                                  |
| `OHLCV`             | `open`, `high`, `low`, `volume` — the per-bar spine                        |
| `ZigZag`            | `Type`, `CurrentPoint` (pivot events, not per-bar)                         |
| `ZScore`            | keys only (`open`/`high`/`low` available but not staged)                   |

The four keys appear on every source and are the validation contract. SSA is exported at 8 decimals (raised from 5) for centroid-boundary fidelity.

### 4.3 What Python calculates (the derived layer)

| Calc module              | Produces                                                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `centroid_regression.py` | Per variant: `base_fl`, `uoedt`, `loedt` (+ internal stats buffers)                                                                 |
| `fractal_lines.py`       | `fractal_best_fl/uoedt/loedt`, `best_resistance`, `best_support`                                                                    |
| `zigzag_metrics.py`      | `price_change`, `pct_change`, `pct_change_class`, `bars`, `bars_class`, `price_per_bar`, `price_per_bar_class`, `slope`, `category` |
| `zscore_candle.py`       | `body_direction`, `body_size` (=\|z\|), `body_classification`                                                                       |

### 4.4 Architecture decision (resolved, June 2026)

Cross-source validation only makes sense on the export-file path — the legacy EA's socket path reads every buffer from one chart at one instant, so there is nothing to cross-validate. **The validated export-file pipeline is the source of truth for XAUUSD M5/M15.** The EA is not required for this path to function at all: each of the 12 indicators auto-exports independently of any EA (§5.6). Where the EA still runs on that terminal, it is retained for reasons that have nothing to do with keeping the indicators alive — see §10.4.

---

## 5. The 12 Export Sources

Not every source feeds a calculation. Grouped by actual function:

### 5.1 Centroid Regression admin layer — 6 sources

`best_fit`, `cherry_a`, `cherry_b`, `most_recent`, `non_a`, `non_b`. Each exports `horiz_high_map`, `horiz_low_map`, `ssa` (8 decimals), `ema_ssa`, `crossing` (0/1). These feed `centroid_regression.py` directly — the crossing bar/price pairs are the regression input. Internally, each indicator still computes and displays a full baseline/UOEDT/LOEDT on its own chart (buffers 7/8/9 in the current `mq5/` source), but that computed line is **not** part of the `.txt` export contract — Python recomputes it independently from the admin-layer inputs.

### 5.2 OHLCV spine — 1 source

`OHLCV` exports `open`, `high`, `low`, `volume` (`close` is a shared validation key). This is the per-bar backbone every other source is validated against, and the sole price input to the fractal and z-score calc modules.

### 5.3 ZigZag pivots — 1 source

`ZigZag` exports `Type` (Peak/Bottom) and `CurrentPoint` (pivot price) as sparse, non-per-bar events. Pivot detection stays entirely in MQL5; Python only derives segment metrics (slope, %change, bar counts, classification) from the sequence of pivots.

### 5.4 Keys-only heartbeats — 4 sources

`Fractal_EDT`, `Resistance_Line`, `Support_Line`, `ZScore`. Only the 4 validation keys (`timestamp`, `symbol`, `timeframe`, `close`) are staged for these — they exist purely as cross-source consistency checks. The actual fractal/resistance/support lines and the z-score candle classification are computed fresh in Python **directly from OHLC**, not from anything these four sources export. This is the single most easily-missed fact about the pipeline: four of the twelve "export indicators" contribute nothing to `market_data` except a timestamp/close heartbeat.

### 5.5 Source registry table (from `export_collector_validator_v2.py`)

| Collector key | Export-file prefix  | Staging table     | Staged columns beyond the 4 keys                      |
| ------------- | ------------------- | ----------------- | ----------------------------------------------------- |
| `best_fit`    | `Centriod_Best_Fit` | `raw_best_fit`    | horiz_high_map, horiz_low_map, ssa, ema_ssa, crossing |
| `cherry_a`    | `Cherry-Pick-A`     | `raw_cherry_a`    | (same 5)                                              |
| `cherry_b`    | `Cherry-Pick-B`     | `raw_cherry_b`    | (same 5)                                              |
| `most_recent` | `Most-Recent`       | `raw_most_recent` | (same 5)                                              |
| `non_a`       | `Non-Recent-A`      | `raw_non_a`       | (same 5)                                              |
| `non_b`       | `Non-Recent-B`      | `raw_non_b`       | (same 5)                                              |
| `fractal_edt` | `Fractal_EDT`       | `raw_fractal_edt` | none (keys only)                                      |
| `ohlcv`       | `OHLCV`             | `raw_ohlcv`       | open, high, low, volume                               |
| `resistance`  | `Resistance_Line`   | `raw_resistance`  | none (keys only)                                      |
| `support`     | `Support_Line`      | `raw_support`     | none (keys only)                                      |
| `zscore`      | `ZScore`            | `raw_zscore`      | none (keys only)                                      |
| `zigzag`      | `ZigZag`            | `raw_zigzag`      | point_type, current_point                             |

Parsing is **header-name based**, not positional, so the collector accepts both the current full MQL5 exports and a future slimmed export without a code change.

### 5.6 Indicator self-sufficiency — no EA required

Every one of the 12 `.mq5` files is itself compiled as an MQL5 **indicator** (`#property indicator_chart_window`), not an Expert Advisor, and each carries its own auto-export logic entirely self-contained:

```
input bool InpAutoExport = true;
input int  InpExportSecond = 59;

int OnInit()  { if (InpAutoExport) EventSetTimer(1); ... }
void OnTimer() {
   if (!InpAutoExport) return;
   if (time_struct.sec == InpExportSecond && time_struct.min != last_trigger_min)
      // ... write the .txt file
}
```

`EventSetTimer()`/`OnTimer()` are available to any MQL5 program type, not just Expert Advisors. Once an indicator is attached to a chart, it starts its own 1-second timer and writes its `.txt` file the moment the clock hits `InpExportSecond`, once a minute, entirely on its own. Confirmed directly in source for both the OHLCV export indicator and a centroid-regression variant, and consistent with the near-identical `InpAutoExport`/`InpExportSecond` pattern documented for all 12 sources.

**Practical consequence:** `SimpleDataCollector_v2_29_ASYNC_SOCKET.mq5` could be deleted entirely and the First Path (§10.1) would keep exporting exactly as it does today, as long as the 12 indicators stay attached to the XAUUSD M5 and M15 charts in a running terminal. The EA has no role whatsoever in the txt-export mechanism — it is a fully independent second consumer of the same indicators (§10).

---

## 6. Pipeline Stages in Detail

One five-minute cycle runs through five stages, tracked in `collection_cycles` as `collecting → validating → validated | rejected`.

### 6.1 COLLECT

Every 5 minutes at `:05` past the boundary (M15 additionally gated to 15-minute boundaries), the collector reads the 12 `{Prefix}_XAUUSD_{TF}.txt` files from the terminal's `MQL5/Files/` and stages their admin-layer columns into the 12 `raw_*` tables under one `collection_cycles` row. Empty export fields become SQL `NULL`, never `0`.

### 6.2 ADJUST

`timestamp_adj` is computed from the raw export timestamp. This stage currently uses a documented placeholder — see §14.1 for why this is the single biggest open risk in the pipeline.

### 6.3 VALIDATE

Implemented in `validate_cycle()`. Three checks run per cycle:

1. **Cross-source key agreement.** For every `timestamp_adj` present in ≥2 of the 11 per-bar sources (all except ZigZag), `symbol` and `timeframe` must match exactly, and `close` must agree within `CLOSE_TOLERANCE = 0.01` (one XAUUSD point — do not widen past ~0.05).
2. **ZigZag-as-subset check.** Every ZigZag pivot's `timestamp_adj` must exist on the OHLCV spine, and its `close` must match the OHLCV close within the same tolerance.
3. **Completeness / staleness check** (skippable via `--no-completeness`, mock/testing only). All 11 per-bar sources must have staged rows for the cycle; the latest OHLCV bar must be present in every source — this catches one indicator silently falling behind without triggering a hard failure elsewhere.

Any mismatch rejects the **whole** cycle: staged rows are purged (`purge_cycle_rows`), the reason is logged to `validation_failures` as JSON (field + per-source values), and the cycle is re-requested. `MAX_ATTEMPTS_PER_CYCLE = 3`, `RETRY_WAIT_SEC = 65` (waits for the next per-minute auto-export before re-reading).

A market-hours gate (`is_market_open_xauusd`, skippable via `--no-market-hours`) skips cycles when XAUUSD is closed (Mon–Fri 01:01–23:59 broker-server time, GMT+2/+3 with US-DST-aware conversion to UTC) without burning a retry attempt.

### 6.4 CALCULATE

`calculate_stage()` runs the four calc modules against the staged admin-layer data plus OHLCV, producing a `{timestamp_adj: {derived columns}}` map. Bars are addressed by `timestamp_adj // TF_SECONDS`, a global monotonic per-bar counter, so bar _differences_ stay exact even across gaps. Full module-by-module detail is in §7.

### 6.5 PROMOTE

`promote_cycle()` merges the admin-layer columns (read back from the `raw_*` staging tables) with the calculated columns from §6.4, onto the OHLCV per-bar spine, using LEFT-JOIN semantics — a bar with no calculated value for a given column simply gets `NULL` there. The result is written with `INSERT OR REPLACE` into `market_data`, keyed on `(timestamp, timeframe)`.

The push worker then independently drains `market_data WHERE synced_at IS NULL` to the gateway (§9), and `mtf_render` independently reads `market_data` for rendering (§11) — both downstream of this single promotion step.

---

## 7. The Calculate Stage — Four Python Modules

All four modules are literal, line-for-line transliterations of the corresponding MQL5 calculation logic — **no library substitution**. DBSCAN, K-means, and weighted least squares are hand-rolled, not imported from scikit-learn, specifically to preserve exact cluster membership against the certified MQL5 reference (§13).

### 7.1 `centroid_regression.py`

**Inputs:** MQL5 crossing points (bar index, price) read from the admin-layer `ssa`/`crossing` columns, plus OHLC closes/highs/lows.

**Algorithm, step by step:**

- _Normalization_ — min/max over crossing bars/prices; degenerate ranges are padded (+1 bar / +0.00001 price).
- _Clustering_ — either hand-rolled DBSCAN (`RegionQuery`/`ExpandCluster`, epsilon on normalized coordinates, border points adopt the cluster) or a deterministic K-means (fixed init centers at `data[k * (n // K)]`, ≤100 iterations, post-filtered by minimum points and maximum average distance to center).
- _Centroid formation_ — clusters with ≥3 points become centroids: mean of normalized coordinates, denormalized, bar rounded half-away-from-zero, sorted newest-first.
- _Selection_ (the variant axis) — `most_recent` (N newest centroids), `exclude_recent` (skip K newest, take next N — shortage shrinks the exclusion first), or `cherry_pick` (walk newest→oldest skipping excluded chronological indices).
- _Regression_ — either plain OLS over the selected centroids, or (`best_fit` variant) an exhaustive subset search over masks of ≥3 centroids, each scored by weighted R² of crossings inside the subset's cluster span using time-decay weights `exp(-lambda * bars_from_live)`; the strictly-best mask wins.
- _Statistics_ — population moments (÷n); skew = m3/var^1.5; kurtosis = m4/var² (not excess); variance ratio = sample variance of 2nd-half residuals ÷ 1st-half; angle = `atan((slope/mean_close)*100*100)` degrees; intercept anchored at the live bar.
- _EDTs_ — for every fractal in the relevant window, the parallel line through it is an EDT candidate; candidates with enough touches contribute the max intercept strictly above and the min intercept strictly below the baseline.

**Produces**, per variant: `base_fl` (baseline), `uoedt` (upper outermost EDT), `loedt` (lower outermost EDT). One engine, six presets (`VARIANT_PRESETS`) — this is what replaces six near-duplicate MQL5 indicators.

**Production rule (from certification, §13):** the centroid EDT stage must keep using the staged `horiz_high_map`/`horiz_low_map` fractals from MQL5 — self-detected fractals were tested and are measurably worse (they break `best_fit`).

### 7.2 `fractal_lines.py`

**Inputs:** OHLC highs/lows **only**. Fractal detection itself happens in this Python module, not in MQL5 — the `Fractal_EDT`/`Resistance_Line`/`Support_Line` MQL5 sources are keys-only heartbeats (§5.4); their internal buffers are never read for this calculation.

**Algorithm:**

- Fractal rules are asymmetric about the center bar: an equal extreme on the _older_ side still qualifies as a fractal; on the _newer_ side it disqualifies (mirrors MQL5's as-series array indexing).
- Candidate pairs need ≥10 bars distance (hardcoded in the MQL5 source, exposed here as a parameter with the same default).
- An angle filter compares the normalized slope between a pair against `tan(max_line_angle°)`.
- Touch tolerance per fractal is either `price × tolerance_percent/100` or `ATR × multiplier`.
- Score = `touches × 10000 + pair_bar_distance`; the highest strictly wins.
- The `best_fit` flip line additionally requires the touching set to contain at least one peak _and_ one bottom.
- EDTs (flip-line only): for every fractal, its parallel line is an EDT candidate; candidates with ≥`edt_min_touches` touches contribute the outermost intercepts above/below the base.

**Produces:** `best_resistance`, `best_support` (single-best lines), and `fractal_best_fl`/`fractal_uoedt`/`fractal_loedt` (the flip-line + EDTs).

### 7.3 `zigzag_metrics.py`

**Inputs:** the MQL5-exported pivot sequence (`point_type`, `current_point`) — pivot _detection_ stays entirely in MQL5.

**Algorithm:** for each pivot, metrics use `prev = i+1` and `twoPrev = i+2` in the newest-first pivot array. Classification of %change, bar count, and price-per-bar is a rolling z-score over up to `zscore_length` (default 50) trailing segments, using sample variance (n−1 divisor) and absolute values for pct/price-per-bar (signed for bar count). Class codes: bullish 0/1/2 (normal/large/extreme), bearish 3/4/5. Slope = `atan(price_per_bar)` in degrees. Category classification (Higher/Lower/Equal) compares the current segment against `twoPrev`, either strictly or within an equal-threshold band.

**Produces:** `price_change`, `pct_change`, `pct_change_class`, `bars`, `bars_class`, `price_per_bar`, `price_per_bar_class`, `slope`, `category`.

### 7.4 `zscore_candle.py`

**Inputs:** OHLC open/close **only**.

**Algorithm:** body size = `|close − open|`; a rolling sample z-score of body size over `zscore_length` (default 432) bars, sample variance (n−1 divisor); classification is the signed z-score against two thresholds, bullish if `close ≥ open`. The **exported** `body_size` column is `|z-score|`, not the raw body size — an export-convention detail worth remembering when reading `market_data` directly.

**Produces:** `body_direction` (1/−1/0), `body_size` (= \|z\|), `body_classification` (0–5, same bullish/bearish × normal/large/extreme scheme as ZigZag).

---

## 8. Data Contracts

### 8.1 Export files (MQL5 → collector)

One file per indicator per timeframe: `{Prefix}_XAUUSD_{M5|M15}.txt`, tab-separated, first row a header, timestamps in UTC unix seconds, written to the terminal's `MQL5/Files/`. Auto-exported every minute at `InpExportSecond` (default `:59`); the collector reads at `:05` past each 5-minute boundary. The three windowed line indicators (Fractal, Resistance, Support) also emit a companion `{Prefix}_XAUUSD_{TF}_Statistic.txt` recording window anchors, fitting parameters, and the resolved line — used for certification and operational auditing.

### 8.2 `market_data` (collector → gateway / renderer)

The promoted wide table, 79 columns, primary key `(timestamp, timeframe)`. Column families: the 4 keys, OHLCV, the six centroid families (admin: `*_horiz_high_map/_horiz_low_map/_ssa/_ema_ssa/_crossing`; calculated: `*_base_fl/_uoedt/_loedt`), fractal/resistance/support lines, the z-score candle set, the ZigZag pivot + metrics, and provenance (`cycle_id`, `collected_at`, `calculated_at`, `synced_at`). Full field list in Appendix A. Schema source: `sqlite_schema_v6_xauusd.sql`.

### 8.3 Gateway contract (push worker → API gateway)

`POST /api/v1/market-data`, validated against `gateway_contract_market_data.schema.json` (JSON Schema draft 2020-12, `additionalProperties: false`). Required fields: `terminal_id`, `timestamp`, `symbol`, `timeframe`, `open`, `high`, `low`, `close`, `volume`. Every derived/indicator field is nullable — `null` means "indicator inactive on that bar," and must never be coerced to `0`. The gateway **must** upsert idempotently on `(symbol, timeframe, timestamp)`, since duplicate delivery is by design (push retries).

Response semantics:

| Status        | Push-worker behavior                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 200/201       | Stamp `market_data.synced_at`                                                                                                   |
| 400           | Quarantine to `rejected_rows.jsonl` **and** stamp `synced_at` (poison-row guard); replay via `replay_quarantine.py` after a fix |
| 401/403       | Halt — operator action required                                                                                                 |
| 429           | Honor `Retry-After`; back off                                                                                                   |
| 5xx / timeout | Retry with exponential backoff                                                                                                  |

`GET /api/v1/health` must return 200. The schema's `x-gateway-requirements` block restates idempotency and the response contract for the backend team implementing the gateway.

---

## 9. Distribution, Recovery & Deployment

### 9.1 Push worker outbox loop — `backfill_worker_api_gateway_v5.py`

Drains `market_data WHERE synced_at IS NULL`, oldest-first, up to `MAX_ROWS_PER_CYCLE = 500` rows per cycle. Idle sleep `IDLE_SLEEP_SEC = 300` when the outbox is empty; active sleep `ACTIVE_SLEEP_SEC = 30` while a backlog remains. Uses connection pooling with exponential backoff on repeated failures, honors `Retry-After` on 429, and performs a graceful shutdown on signal. Logs rotate to `push_worker.log`.

### 9.2 Quarantine & replay — the safety net

On HTTP 400, the worker appends `{quarantined_at, gateway_error, row}` to `rejected_rows.jsonl` and stamps `synced_at` anyway, so one poison row can never block the rest of the outbox. After the gateway or data issue is fixed, `replay_quarantine.py` re-POSTs every quarantined row:

```
BACKFILL_API_KEY=... API_GATEWAY_URL=... python3 replay_quarantine.py
python3 replay_quarantine.py --dry-run        # preview only, no POST
python3 replay_quarantine.py --file C:/Scripts/database/rejected_rows.jsonl
```

Rows that succeed (200/201) are dropped from the file; rows that still fail are rewritten back — the tool is safe and idempotent to re-run, and the file is removed entirely once fully cleared.

### 9.3 Deployment — `install_services.bat`

Run elevated, after editing the CONFIG block (Python path, root directory, export dir, DB path, `BACKFILL_API_KEY`). Installs three auto-restarting NSSM services:

| Service         | Runs                                                                             | Role                                              |
| --------------- | -------------------------------------------------------------------------------- | ------------------------------------------------- |
| `MT5Collector`  | `export_collector_validator_v2.py --export-dir ... --db ... --timeframes M5,M15` | The pipeline engine (COLLECT → PROMOTE)           |
| `MT5PushWorker` | `backfill_worker_api_gateway_v5.py`                                              | Outbox → gateway                                  |
| `MT5Relay`      | `mt5_api_relay_for_v2_29.py`                                                     | Legacy socket relay, optional, not in the v6 flow |

Prerequisites: NSSM on PATH; `pip install aiohttp requests`. Each service gets its own rotating stdout/stderr log under a shared `logs/` directory and restarts automatically on crash (`AppExit Default Restart`). Collector and push worker are independent and self-healing — there is no strict boot order between them; the collector recreates the schema and idles when no exports are present.

### 9.4 Directory layout

```
C:/Scripts/
├── collector/   export_collector_validator_v2.py + the 4 calc .py + sqlite_schema_v6_xauusd.sql
├── backfill/    backfill_worker_api_gateway_v5.py + replay_quarantine.py
├── relay/       mt5_api_relay_for_v2_29.py            (legacy, optional)
├── database/    xauusd.db, rejected_rows.jsonl
└── logs/        collector.log, push_worker.log, relay.log (rotating)
```

### 9.5 Operations signals

Healthy: collector logs `✅ Cycle N validated — K bars promoted` each cycle; push worker logs steady pushes or `✅ No backfill needed`; `rejected_rows.jsonl` stays empty; unsynced-row count trends to zero.

| Alert-worthy                      | Likely meaning                                                                    | Action                                                    |
| --------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Cycles repeatedly `rejected`      | Sources disagree (often `timestamp_adj`, §14.1) or an indicator stopped exporting | Read `validation_failures`; check the 12 files' freshness |
| `rejected_rows.jsonl` growing     | Gateway rejecting pushes                                                          | Read `gateway_error`; fix and replay (§9.2)               |
| `CRITICAL: Authentication failed` | API key rotated/revoked                                                           | Rotate `BACKFILL_API_KEY`                                 |
| Unsynced rows climbing            | Gateway unreachable                                                               | Check Railway; worker retries automatically               |
| Collector CPU/lag                 | SSA load or too many charts                                                       | Reduce charts or lookback                                 |

---

## 10. Two Extraction Paths: TXT Export vs. the Legacy EA

The 12 MQL5 sources are read by two genuinely independent mechanisms that do not feed each other.

### 10.1 TXT file export (production, unchanged)

Each of the 12 indicators computes its own buffers and writes them to a `.txt` file itself, on its own internal `EventSetTimer` loop, once a minute. `export_collector_validator_v2.py` only ever reads files off disk — it never touches indicator memory directly. This is the sole source of truth for `market_data` (§4.4, §6).

### 10.2 `iCustom()` / `CopyBuffer()` — the legacy EA path

`SimpleDataCollector_v2_29_ASYNC_SOCKET.mq5` attaches an `iCustom()` handle to 11 of the 12 indicators in `InitializeIndicatorsForSlot()` (OHLCV is the only one skipped — its price data comes natively from `CopyRates`). On every new completed bar, `InsertCandle()` calls `CopyBuffer()` through a `GetIndicatorValue()` helper to pull specific buffer indices straight out of each indicator's memory. The row is then either fired over a local TCP socket to `mt5_api_relay_for_v2_29.py` (fire-and-forget, <1ms, with a circuit breaker: 10 consecutive socket failures opens the breaker for a cooldown period), or written to a per-symbol SQLite database with a `backfill_queue.csv` for later replay if the socket path is unavailable. This path is scoped more broadly than the production pipeline — up to 15 symbols across 9 timeframes (M5 through D1), a vestige of an older, more general multi-symbol architecture — versus the txt/v6 pipeline's XAUUSD M5/M15-only scope.

**This path is not wired into `market_data`, is not part of the v6 production data flow, and is not required for the First Path to function.** Each of the 12 indicators auto-exports on its own timer whether or not any EA is attached (§5.6) — the "keeps the indicators alive" framing found in earlier descriptions of this architecture does not hold up under inspection of the indicator source, and is corrected in §10.4.

### 10.3 The v2.29 → v2.29.1 schema fix

The EA's earlier version (v2.29) still assumed the _old_ v2.28 design, in which MQL5 computed the centroid regression lines directly: it read buffer indices 7/8/9 of each centroid handle as `bestfit_baseline`/`bestfit_uoedt`/`bestfit_loedt`, and its SQLite table and JSON payload used a flat, 45-column, old naming convention (`bestfit_baseline`, `candle_classification`, …) with no overlap at all with the current `gateway_contract_market_data.schema.json`.

v2.29.1 corrected this. The fix, verified directly in the source:

- **Buffer reads corrected.** `GetCentroidFields()` now reads only the genuine v6 admin-layer buffers per centroid variant: `ssa` (buffer 0), `ema_ssa` (buffer 1), `crossing` (buffer 2, collapsed to 0/1), `horiz_high_map` (buffer 3), `horiz_low_map` (buffer 4). Buffers 5/6 (the old "119" markers) and 7/8/9 (the old MQL5-computed baseline/UOEDT/LOEDT) are explicitly and permanently not read. `GetZigZagAdmin()` reads only the pivot type/price (buffers 0/1).
- **Handles for fractal/resistance/support/z-score stay attached but unread.** The EA still calls `iCustom()` for `h_fractal_bestfit`, `h_best_resistance`, `h_best_support`, and `h_zscore_candle` — this keeps those indicators computing and exporting on the chart — but `InsertCandle()` deliberately never calls `CopyBuffer()` on them for `market_data` fields, because every value they could supply (fractal/resistance/support lines, z-score classification) is Python-only in v6.
- **Every Python-only field is now sent as explicit `NULL`**, never fabricated from the old buffers. This is enforced in `CentroidToJson()`/`CentroidToSqlValues()`, which hard-code `base_fl`/`uoedt`/`loedt` to `null`/`NULL`.
- **Schema renamed to match the gateway contract field-for-field.** `CreateSymbolTable()`/`MigrateSymbolTable()` now use `best_fit_horiz_high_map`, `best_fit_base_fl`, etc., matching `gateway_contract_market_data.schema.json` exactly, plus a `terminal_id` column added because the gateway contract requires it on POST (even though the server-side `market_data` table doesn't persist it).
- **`mt5_api_relay_for_v2_29.py` required no changes** — confirmed schema-agnostic; it forwards whatever JSON the EA sends unchanged and only reads `terminal_id` for a header.

The result is internally consistent with v6 and safe to reactivate later, but it is still, deliberately, not part of the production flow today.

### 10.4 Why keep both paths?

Neither path needs the other, and only one of them is required. The First Path alone is sufficient for the architecture to function completely — everything that reaches `market_data`, the gateway, and the rendered charts flows through it, and nothing downstream ever reads the Second Path's socket relay or SQLite fallback. If the EA were deleted tomorrow, the First Path would be unaffected (§5.6).

The two paths also do not "work together" in any collaborative sense. They are two independent consumers of the same 12 upstream indicators, with no handoff, merge, or coordination between them anywhere in the code — closer to two readers of the same newspaper than two halves of one system.

Given that, the Second Path is retained for two legitimate but non-essential reasons:

1. **Historical continuity.** It is the pre-v6 (v2.28) architecture. When the file-export design replaced it, the EA was deprecated rather than deleted — cheap to keep as a reference point or rollback option during the transition.
2. **Optionality for a future low-latency path.** The socket push can reach the relay in under a millisecond of a bar closing (§10.5), versus the First Path's file-export-and-collect cadence. If a future consumer ever needs near-real-time data (e.g. alerting), that infrastructure already exists and, as of v2.29.1, is schema-correct (§10.3) — it would just need to be wired up, and would still need its own validation story built from scratch, since it inherits none of the First Path's cross-source checks (§10.5).

A third reason has circulated in earlier discussion of this architecture — that the EA's job is "keeping the indicators alive" — and it does not hold up. Each indicator is self-sufficient (§5.6): it exports on its own timer whether or not any EA is attached. If the EA is left running today, that is most likely a holdover from how the terminal was operated under the older architecture, not a functional requirement of the current one.

### 10.5 Speed vs. validation trade-off

The two paths trade speed for integrity in a way that is structural, not incidental.

**Second Path — fast, unvalidated.** `OnTick()` fires on every incoming price tick and checks whether the last-closed bar has changed; the instant it has, the row is pushed over the socket in under a millisecond — typically within a few seconds of the bar closing. But there is no cross-source key agreement (nothing to compare a single buffer read against), no completeness/staleness check, and no reject-and-retry. What it does have — null-safety (`EMPTY_VALUE` sent as an explicit `null`, never fabricated as `0`) and a circuit breaker — is network-failure resilience, not data-quality validation, and the two should not be conflated.

**First Path — validated, near-real-time in the normal case.** Each indicator auto-exports at most 60 seconds after bar-close (its own `:59` timer), and the collector wakes up just 5 seconds after every 5-minute boundary to read the files — normal-case latency is under a minute past bar-close, not the full 5-minute cycle interval that "batch pipeline" framing might suggest. That 5-minute number is the cadence at which a _new_ bar exists to promote at all — a property of the M5/M15 timeframe itself, not an artificial validation delay layered on top. Where the First Path genuinely gets slower is when a cycle fails validation: up to 3 retries × 65 seconds adds several minutes before that bar is promoted, or the cycle is abandoned (§6.3).

**Why this trade-off can't be cheaply avoided.** Cross-source validation is structurally a batch operation — it requires multiple independently-timed files to have actually landed before they can be compared, and that comparison is what costs the extra time. The Second Path's speed comes precisely from skipping that step: it reads one indicator's buffer with nothing to check it against. Making it both fast and validated would require either redesigning it to also wait for and cross-check other sources (which erases the speed advantage and effectively reinvents the First Path), or accepting a different, lesser guarantee — e.g. single-source sanity/outlier bounds instead of true cross-source agreement.

---

## 11. Multi-Timeframe Visualisation (`mtf_render`)

### 11.1 Purpose and scope

A **backend-only** Python rendering module that reads `market_data` and produces the DavinTrade three-canvas chart visualisation as a PNG: Chart A is always XAUUSD M5 with its own equal-distance channel; Charts B and C are always XAUUSD M15, each showing the **same M5-computed channel** overlaid by price and time (not recomputed on M15). The interactive "Copy M5 EDT / Paste to Chart B/C" UI shown in the target mockup is explicitly out of scope for this module — it exists only as context for which channel ends up on which chart; no UI, buttons, or API endpoints are built here.

### 11.2 Data flow, function by function

`data_source.py` — `_read_timeframe()` issues two independent SQL queries against `market_data` (one for M5, one for M15), each filtered on `symbol = 'XAUUSD' AND timeframe = ?`, pulling the OHLCV columns plus the selected variant's `{variant}_uoedt/_base_fl/_loedt`, then renaming those to canonical `uoedt`/`base_fl`/`loedt` column names. `build_panels()` constructs exactly **one** `Channel` object from the M5 frame and assigns that _same object, by reference, not a copy_, to panels `"A"`, `"B"`, and `"C"` — this is what guarantees the M5 channel is reused rather than recomputed on the M15 panels, and it is directly asserted in the test suite (§11.4).

`renderer.py` — hand-draws candlesticks (wicks as lines, bodies as rectangles, green/red by direction) and the three channel lines (`UOEDT`/`base_fl` solid+dashed/`LOEDT`) against a **real unix-time matplotlib axis**, converted via `matplotlib.dates`. This is a deliberate choice, stated directly in the module's docstring: mplfinance's categorical bar index would misalign the M5 channel against M15 bars, because the two timeframes don't share a 1:1 bar count. `render_combined()` lays out three panels side by side in one `matplotlib` figure (`constrained_layout=True`, Agg backend for headless operation) and saves one PNG at 120 dpi.

`__main__.py` — CLI entry point. `python -m mtf_render --out chart.png` with no `--db` generates a synthetic fixture automatically; `python -m mtf_render --db /path/to/xauusd.db --variant cherry_a --out chart.png` renders against a real database. `--limit` caps bars per timeframe (default 200, most recent).

### 11.3 The dev/demo fixture — `fixture.py`

The shipped real `market_data` sample has only 3 M5 bars, no M15 rows at all, and every channel column `NULL` (warm-up by design) — it cannot exercise the renderer. `fixture.py` fabricates a self-consistent synthetic `xauusd.db` instead: 96 M5 bars (8 hours) as a gentle random walk, plus a coherently-aggregated M15 series over the same window (3-bar OHLC aggregation), with a populated, genuinely parallel equal-distance channel per variant (straight `slope × t + intercept` lines with a constant offset). Because the M5 channel and M15 candles share one price/time frame by construction, the "reuse the M5 channel on M15" overlay is exact in the fixture — useful for developing and demoing the renderer without a live database. This is dev/demo data only; in production the renderer reads a real database whose channel columns come from the calc stack (§7).

### 11.4 Test coverage — `test_mtf_render.py`

Three smoke tests, all runnable via `pytest` or directly:

- `test_panels_have_expected_timeframes_and_shared_channel` — asserts `panels["B"].channel is panels["A"].channel` and `panels["C"].channel is panels["A"].channel` (Python object identity, not equality) — this is the direct proof that the M5 channel is reused, not recomputed.
- `test_all_variants_load` — all six centroid variants load and populate a non-empty channel.
- `test_render_writes_png` — the render pipeline produces a PNG file over 1KB.

### 11.5 Known carry-over dependency

Overlaying the M5 channel on M15 needs correct M5↔M15 time alignment. The pipeline's `timestamp_adj` is currently a documented placeholder (§14.1) — fine for the golden/sample fixture data, but live-data overlay fidelity depends on the timestamp-conversion stack being finished first. This is noted, not blocking, for a first render.

---

## 12. Technology Stack

| Layer              | Technology                                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data production    | MQL5 (MetaTrader 5 indicator/EA language); Windows VPS (Contabo) runtime                                                                                   |
| Backend processing | Python 3, `argparse` CLIs; hand-ported calc logic (DBSCAN, K-means, WLS) — deliberately no scikit-learn                                                    |
| Storage            | `sqlite3` (stdlib), WAL journal mode; staging tables + `market_data` outbox; schema-versioned `.sql` file, idempotent `CREATE ... IF NOT EXISTS`           |
| Distribution       | `requests` + `urllib3` (`Retry`/`HTTPAdapter` — connection pooling, exponential backoff); JSON Schema draft 2020-12 contract; Railway-hosted API gateway   |
| Visualisation      | `pandas` + `numpy` (`Generator`-seeded synthetic fixtures); `matplotlib` with the Agg backend and `matplotlib.dates` for a real time axis — not mplfinance |
| Deployment & ops   | NSSM (3 auto-restarting Windows services); rotating file logs; signal-based graceful shutdown; `pip install aiohttp requests`                              |
| Legacy path        | Native MQL5 TCP sockets (`SocketSend`, 50ms timeout floor); `CSQLite3Base` MQL5 SQLite binding; asyncio TCP relay (bounded queue, disk-spill retry)        |

---

## 13. Testing & Certification

### 13.1 Unit / golden test suite

```
python3 test_phase1_golden.py      # 23 checks — z-score candle + zigzag metrics
python3 test_phase2_lines.py       # 30 checks — fractal/resistance/support geometry
python3 test_phase3_centroid.py    # 40 checks — DBSCAN/selection/WLS/EDTs/stats
```

93/93 passing.

### 13.2 Golden certification

`golden_certification.py` compares every calc-stack output against a full 3000-bar MQL5 export batch (M5 + M15), reading each line indicator's companion `_Statistic.txt` for the exact window and parameters used.

| Timeframe | Result                                                   |
| --------- | -------------------------------------------------------- |
| M15       | **50/50 PASS** — full stack exact (≈5e-6)                |
| M5        | 39/50 PASS — 11 checks within accepted bounded tolerance |

Certified exact on both timeframes: the z-score candle set, all ZigZag metrics, the single-best resistance and support lines, the fractal flip line and its EDTs, the full `best_fit` centroid chain (DBSCAN → WLS subset search → baseline → EDTs → stats), `cherry_b`, and every variant's baseline/slope/anchored-intercept/lower-EDT.

**The 11 M5 tolerance cases, explained:**

1. _`most_recent` / `non_a` upper EDT only_ — MQL5 selects an upper EDT through a fractal it counts as 3 touches, but the per-bar export reconstruction yields 2. Lower EDT, baseline, slope, and stats are all exact for these variants; the same EDT code is exact for `best_fit`/`cherry_b` and the standalone Fractal indicator. Root cause: a data-reconstruction fidelity limit of the per-bar `horiz_*_map` export, **not** a numeric or min-touches difference (this was specifically proven, not assumed).
2. _`cherry_a` / `non_b`, ~0.08–0.1 price (~2e-5 relative)_ — a single crossing sits on the DBSCAN epsilon boundary and flips cluster membership, nudging one centroid. Confirmed not an SSA precision issue (the export is 8-decimal). This is inherent boundary sensitivity and lands on different variants depending on the dataset — M15 has none of it, hence 50/50.

**Verdict (accepted):** the port is faithful — M15's 100% pass rate and the exact `best_fit` WLS+EDT chain prove it. The M5 residuals are tiny (≤~0.1 price on a ~4200 instrument, on overlay lines) and have no operational impact, since post-cutover Python is the source of truth regardless. Production rule: the centroid EDT stage must keep using the staged `horiz_high_map`/`horiz_low_map` fractals — self-detected fractals were tested and are worse.

---

## 14. Known Issues, Gaps & Accepted Trade-offs

### 14.1 `timestamp_adj` normalization is a placeholder — the single biggest open risk

Each MQL5 source exports the same physical bar with a **different constant sub-bar timestamp phase** — observed, per 300-second bar: OHLCV at offset 206, `best_fit` at 4, `cherry_a` at 240, `cherry_b` at 288, and so on. Bars align perfectly **by sequence** (verified 2989/2989 in testing), but naive rounding/flooring sends the same physical bar to different grid slots across sources, which means simple gridding cannot pass cross-source close validation on heterogeneous exports. The collector currently fills `timestamp_adj` with a documented placeholder: `round(raw / tf) * tf`. In production, all 12 sources auto-export the same bar simultaneously, but because they currently emit different timestamp _conventions_, this must be resolved with a dedicated raw→adjusted conversion stack (sequence or OHLCV-spine snap alignment) — or, the cheaper fix, changing the indicators to emit one consistent convention — before a fully green end-to-end validation run is possible. This is the item gating both pipeline cutover (§15) and live-data fidelity in the visualisation overlay (§11.5).

### 14.2 M5 UOEDT + `cherry_a`/`non_b` residuals

Accepted bounded tolerance, fully explained in §13.2. M15 is fully exact.

### 14.3 Windowed indicator anchors go stale

`2EDT-Fractal-Best-Fit-v5` and both `Single-Best-*-Line-v3` indicators use fixed `InpStartDateTime`/`InpEndDateTime` window anchors. These need re-anchoring per analysis window — either an operational procedure, or a future rolling-window indicator change.

### 14.4 Indicators still export full columns

The calc-stack-owned columns are simply ignored by the header-name parser, so slimming the exports down to the true admin-layer set (§4.2) is optional cleanup, safe to defer indefinitely.

### 14.5 Legacy socket path retained but disconnected

Covered in full in §10. Do not wire it into `market_data` without re-validating the whole cross-source-validation rationale, since the socket path reads one chart at one instant and has nothing to cross-validate against.

---

## 15. Remaining Work to Production Cutover

1. **Timestamp-conversion stack** (§14.1) — align all sources to one canonical grid (sequence or OHLCV-spine snap), or fix the indicators to emit one consistent timestamp convention. This is the gating item for a green end-to-end validation run.
2. **Gateway migration** — the backend team implements the §8.3 contract: the nullable-field set and idempotent upsert on `(symbol, timeframe, timestamp)`.
3. **Windowed-anchor handling** (§14.3) — an operational re-anchoring procedure, or a rolling-window indicator change.
4. _(Optional)_ Slim the indicator exports to the true admin-layer column set (§4.2) once the above are stable.

Deferred product features, tracked separately and not pipeline-blocking: trendline image rendering with statistical scoring/advice, and parameter-revision alerting.

---

## Appendix A — `market_data` Column Reference

Primary key: `(timestamp, timeframe)`. `symbol` is CHECK-constrained to `'XAUUSD'`; `timeframe` to `'M5'`/`'M15'`. Empty export fields are stored as `NULL`, never `0`.

**Keys (4):** `timestamp`, `symbol`, `timeframe`, (`close` doubles as OHLCV below)

**OHLCV (5):** `open`, `high`, `low`, `close`, `volume`

**Per centroid variant (8 columns × 6 variants = 48)** — variants: `best_fit`, `cherry_a`, `cherry_b`, `most_recent`, `non_a`, `non_b`:
`{variant}_horiz_high_map`, `{variant}_horiz_low_map`, `{variant}_ssa`, `{variant}_ema_ssa`, `{variant}_crossing` (admin layer, from MQL5) — `{variant}_base_fl`, `{variant}_uoedt`, `{variant}_loedt` (calculated, `centroid_regression.py`)

**Fractal + single-best lines (5, all calculated by `fractal_lines.py`):** `fractal_best_fl`, `fractal_uoedt`, `fractal_loedt`, `best_resistance`, `best_support`

**Z-score candle (3, calculated by `zscore_candle.py`):** `body_direction` (−1/0/1), `body_size` (=\|z\|), `body_classification` (0–5)

**ZigZag (2 admin + 9 calculated by `zigzag_metrics.py`):** `zigzag_point_type` (Peak/Bottom, admin), `zigzag_current_point` (admin) — `zigzag_price_change`, `zigzag_pct_change`, `zigzag_pct_change_class`, `zigzag_bars`, `zigzag_bars_class`, `zigzag_price_per_bar`, `zigzag_price_per_bar_class`, `zigzag_slope`, `zigzag_category` (all calculated)

**Provenance (4):** `cycle_id`, `collected_at`, `calculated_at`, `synced_at` (NULL = not yet pushed to the gateway; rows are marked, never deleted)

Total: 79 columns. Full CREATE TABLE statement: `sqlite_schema_v6_xauusd.sql`. Full JSON Schema (POST body): `gateway_contract_market_data.schema.json`.

---

## Appendix B — Glossary

**Admin layer** — the MQL5-owned, effectively hard-coded computations (SSA, fractal maps, OHLCV, ZigZag pivot detection) exported to `.txt` files and staged as-is.

**Derived / calculated layer** — every user-configurable value, computed by the four Python calc modules from the admin layer + OHLCV, never by MQL5.

**Base_FL / UOEDT / LOEDT** — a centroid-regression baseline (`Base_FL`) plus its Upper and Lower Outermost Equal-Distance Trend lines, forming a three-line parallel channel.

**EDT** — Equal-Distance Trendline; a line parallel to a baseline at a fixed price offset, fit through touching fractals.

**Cycle** — one collection attempt for one 5-minute time slot and one timeframe, tracked in `collection_cycles` with states `collecting → validating → validated | rejected`.

**Admin-layer heartbeat / keys-only source** — an MQL5 export that contributes only its 4 validation keys to the pipeline, with no admin-layer payload (Fractal_EDT, Resistance_Line, Support_Line, ZScore).

**Outbox** — the `synced_at IS NULL` subset of `market_data`, drained by the push worker; rows are marked synced, never deleted.

**Channel (visualisation)** — the three-line `uoedt`/`base_fl`/`loedt` object computed once on M5 and reused, by object reference, across all three rendered chart panels.

**terminal_id** — an identifier required by the gateway POST contract to distinguish sending terminals; not persisted in the server-side `market_data` table itself.
