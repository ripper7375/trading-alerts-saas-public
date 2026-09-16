# Architecture Design: Integrating `SupportAndResistantAutoCalibration_v2_29.mq5` as the 14th Indicator in Data Pipeline v2.29

**Document Version:** 1.0.0  
**Target System:** Backend Stack C (v2.29 / v6 Pipeline Stack)  
**Authoritative Context:** Extends `DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md`, `ARCHITECTURE-SUMMARY-FOR-DECK.md`, and `ACTIVE-STANDBY-TERMINAL-ARCHITECTURE.md`  
**Purpose:** Technical specification and feasibility assessment blueprint for **Claude Code** to review, validate feasibility, and implement end-to-end.

---

> ## ✅ IMPLEMENTED 2026-09-16 — read this before the body
>
> The pipeline side of this design is built, tested and committed. **The MQL5 export
> contract in §3 was verified line by line against the live `.mq5` and is accurate as
> written** — filename, the 12-column TSV header, empty-string nulls and the statistic-file
> block all match, and the timestamp already uses the fixed `TimeTradeServer()`-rounded
> form rather than the `TimeCurrent()` bug corrected across the other 13 on 2026-09-09.
>
> **Three of the pipeline claims did not survive contact with the live code**, and each
> would have caused a production failure if implemented as written. They are corrected
> inline below rather than quietly fixed, so the reasoning survives:
>
> | Section | Claim                                                         | Reality                                                                                                                                       |
> | ------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
> | §6.1    | `migrate_raw_tables()` handles new tables and columns on boot | It skips absent tables and never touches `market_data` — the collector would crash-loop. New `migrate_market_data()` added.                   |
> | §4.2.3  | Add `sr_levels` to `STAT_SOURCES`                             | `STAT_SOURCES` is derived, so this is a no-op — and auto-enrollment would 400 the whole batched statistics POST. Now explicitly **excluded**. |
> | §4.5    | Downstream = the railway-gateway Prisma schema                | 10 files, because the contract JSON generates the DTO and a test diffs both Prisma schemas.                                                   |
>
> **Decisions taken (Davin):** defer SR statistics capture; ship **both** an automatic
> `migrate_market_data()` and a hand-run SQL script; **full** enrollment in
> `PER_BAR_SOURCES` as this document intends — accepting that a missing or stale
> `SR_Levels_*.txt` rejects the entire price cycle, which is now demonstrated by test.
>
> Further live-code findings the document does not cover are in the new §6.3. Remaining
> physical steps, in order, are `DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md` §13 item 7.

---

## 1. Executive Summary & Context

### 1.1 Objective

Expand the production MT5 data collection pipeline from **13 indicators (87 market_data columns)** to **14 indicators (95 market_data columns)** by formally onboarding [`SupportAndResistantAutoCalibration_v2_29.mq5`](file:///D:/SaaS%20Project/trading-alerts-saas-public/backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mq5/SupportAndResistantAutoCalibration_v2_29.mq5).

### 1.2 The 14th Indicator Profile

- **Indicator File:** `SupportAndResistantAutoCalibration_v2_29.mq5`
- **Mathematical Engine:** Dynamic Support & Resistance clustering powered by the **Freedman-Diaconis Interquartile Range (IQR)** optimal bin width rule:
  $$h = 2 \cdot \text{IQR} \cdot N^{-1/3}$$
- **Window Regime:** Fixed start/end date-time anchors (`InpStartDateTime` / `InpEndDateTime`).
- **Visualization Alignment:** **Option 1 (Strict 1:1 Pipeline Alignment)** — the chart exclusively displays the exact active levels exported to the data pipeline (`sr_1` to `sr_8`), tagged with on-chart database slot labels.
- **Output Data Payload:** Exactly 8 price-level columns:
  - 4 closest Supports below close: `sr_1` (closest), `sr_2`, `sr_3`, `sr_4` (furthest below)
  - 4 closest Resistances above close: `sr_5` (closest), `sr_6`, `sr_7`, `sr_8` (furthest above)
- **Companion Audit File:** `SR_Levels_XAUUSD_{TF}_Statistic.txt` recording IQR parameters, window anchors, optimal step, and resolved slot prices.

---

## 2. Quantitative System Architecture Delta

| Architectural Metric                       | Current State (v2.29 Baseline) | Target State (With 14th Indicator) |                   Delta                    |
| :----------------------------------------- | :----------------------------: | :--------------------------------: | :----------------------------------------: |
| **MQL5 Data Producers**                    |         13 indicators          |         **14 indicators**          |                +1 indicator                |
| **Per-Chart Indicator Attachments**        |      13 on M5, 13 on M15       |      **14 on M5, 14 on M15**       |         +2 attachments / terminal          |
| **Active/Standby Attachments (A + B)**     |        26 on A, 26 on B        |        **28 on A, 28 on B**        |            +4 total attachments            |
| **Raw Staging Tables (`raw_*`)**           |           13 tables            |  **14 tables** (`raw_sr_levels`)   |              +1 staging table              |
| **`v_validation_keys` Sources**            |  11 per-bar + 1 sparse zigzag  |  **12 per-bar + 1 sparse zigzag**  |          +1 validated key source           |
| **`market_data` Total Columns**            |           87 columns           |           **95 columns**           |        +8 columns (`sr_1`..`sr_8`)         |
| **Push Worker Contract Fields**            |           87 fields            |           **95 fields**            |             +8 contract fields             |
| **Statistic Producers (`_Statistic.txt`)** |         10 indicators          |    **11 written, 10 ingested**     | +1 file written; capture deferred (§4.2.3) |

---

## 3. Data Contract Specification

### 3.1 TimeSeries Export File Contract

- **File Naming Pattern:** `{Prefix}_{Symbol}_{Timeframe}.txt`
  - Example: `SR_Levels_XAUUSD_M5.txt` and `SR_Levels_XAUUSD_M15.txt`
- **Destination Directory:** `MQL5/Files/` on the active MT5 terminal.
- **Cadence:** Auto-exported every minute at second `:59` via timer loop (`InpAutoExport=true`, `InpExportSecond=59`), in lockstep with the existing 13 producers.
- **Depth:** 3,000 historical bars (`InpExportBars=3000`), matching pipeline lookback.
- **TSV Header (Exactly 12 Columns):**
  ```tsv
  timestamp\tsymbol\ttimeframe\tclose\tsr_1\tsr_2\tsr_3\tsr_4\tsr_5\tsr_6\tsr_7\tsr_8\r\n
  ```
- **Column Definitions:**
  - `timestamp`: Adjusted UTC Unix timestamp (integer seconds on the bar grid).
  - `symbol`: Asset identifier (`XAUUSD`).
  - `timeframe`: Bar interval (`M5` or `M15`).
  - `close`: Bar close price (2 decimal precision, e.g., `4285.68`).
  - `sr_1`..`sr_4`: Supports strictly `< close`, sorted nearest-first (`sr_1` closest below close).
  - `sr_5`..`sr_8`: Resistances strictly `> close`, sorted nearest-first (`sr_5` closest above close).
- **Null Safety Contract:** Unresolved/inactive slots must export as empty string tabs `""` (staged cleanly as SQL `NULL`, never numeric `0.0`).

### 3.2 Companion Statistic File Contract

- **File Naming Pattern:** `SR_Levels_XAUUSD_{Timeframe}_Statistic.txt`
- **Encoding:** ANSI / ASCII compatible text.
- **Structure:**

  ```ini
  [SUPPORT-RESISTANCE AUTO-CALIBRATION - PARAMETERS]
  Calculation Mode: Freedman-Diaconis IQR (Auto-Calibrated)
  Window Start TS (UTC): 1789372800
  Window End TS (UTC): 1789503300
  Window Bars: 142
  Fractals Sample (N): 30
  Q25 (25th percentile): 4279.29
  Q75 (75th percentile): 4298.89
  IQR: 19.60
  Optimal Step: 12.62
  Min Touches Filter: 1
  Highest High: 4318.21
  Lowest Low: 4253.61

  [SUPPORT-RESISTANCE AUTO-CALIBRATION - RESOLVED LEVELS]
  Total Macro Clusters: 6
  Pipeline 1:1 Slots: 8 (sr_1..sr_8)
  sr_1 (Support 1): 4275.36
  sr_2 (Support 2): 4260.71
  sr_3 (Support 3): NULL
  sr_4 (Support 4): NULL
  sr_5 (Resistance 1): 4285.60
  sr_6 (Resistance 2): 4297.28
  sr_7 (Resistance 3): 4311.48
  sr_8 (Resistance 4): 4317.52
  Nearest Resistance: 4285.60
  Nearest Support: 4275.36
  Distance to Resistance: 93
  Distance to Support: 931
  ```

---

## 4. Pipeline Component Impact & Required Code Modifications

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 PIPELINE FLOW DELTA                                    │
│                                                                                        │
│  MT5: SupportAndResistantAutoCalibration_v2_29.mq5 (M5 & M15)                          │
│       │ exports SR_Levels_XAUUSD_{TF}.txt (:59 sec)                                    │
│       ▼                                                                                │
│  Stage 1: COLLECT   ──► raw_sr_levels (new SQLite staging table)                       │
│       │                                                                                │
│  Stage 2: ADJUST    ──► timestamp_adj (hour-rounded broker offset verification)        │
│       │                                                                                │
│  Stage 3: VALIDATE  ──► v_validation_keys (cross-checks close ±0.01 against OHLCV)     │
│       │                                                                                │
│  Stage 4: PROMOTE   ──► market_data (95 columns: adds sr_1..sr_8)                      │
│       │                                                                                │
│  Push Worker        ──► HTTP POST /api/v1/market-data (JSON payload: 95 fields)        │
│       │                                                                                │
│  Railway Gateway    ──► Prisma / PostgreSQL (market_data_v6 table)                     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Component 1: SQLite Schema (`sqlite_schema_v6_xauusd.sql`)

#### 1. New Staging Table `raw_sr_levels`

```sql
CREATE TABLE IF NOT EXISTS raw_sr_levels (
    cycle_id        INTEGER NOT NULL REFERENCES collection_cycles (cycle_id) ON DELETE CASCADE,
    timestamp_raw   INTEGER NOT NULL,
    timestamp_adj   INTEGER,
    symbol          TEXT    NOT NULL CHECK (symbol = 'XAUUSD'),
    timeframe       TEXT    NOT NULL CHECK (timeframe IN ('M5', 'M15')),
    close           REAL    NOT NULL,
    sr_1            REAL,
    sr_2            REAL,
    sr_3            REAL,
    sr_4            REAL,
    sr_5            REAL,
    sr_6            REAL,
    sr_7            REAL,
    sr_8            REAL,
    PRIMARY KEY (cycle_id, timeframe, timestamp_raw)
);
```

#### 2. Update Union View `v_validation_keys`

Append `raw_sr_levels` into `v_validation_keys` so its timestamps and close prices participate in cross-source validation:

```sql
UNION ALL
SELECT cycle_id, 'sr_levels' AS source, timestamp_adj, symbol, timeframe, close
FROM raw_sr_levels
```

#### 3. Expand `market_data` Table

Add 8 nullable `REAL` columns to the `market_data` schema definition:

```sql
    -- Support & Resistance Auto-Calibrated Levels (from SupportAndResistantAutoCalibration_v2_29)
    sr_1                REAL,                        -- Closest Support below close
    sr_2                REAL,                        -- 2nd Closest Support
    sr_3                REAL,                        -- 3rd Closest Support
    sr_4                REAL,                        -- 4th Closest Support
    sr_5                REAL,                        -- Closest Resistance above close
    sr_6                REAL,                        -- 2nd Closest Resistance
    sr_7                REAL,                        -- 3rd Closest Resistance
    sr_8                REAL,                        -- 4th Closest Resistance
```

---

### 4.2 Component 2: Pipeline Collector & Validator (`export_collector_validator_v2.py`)

#### 1. Add to `SOURCES` Registry

```python
SOURCES['sr_levels'] = {
    'prefix': 'SR_Levels',
    'table': 'raw_sr_levels',
    'columns': [
        ('sr_1', 'real', 'sr_1'),
        ('sr_2', 'real', 'sr_2'),
        ('sr_3', 'real', 'sr_3'),
        ('sr_4', 'real', 'sr_4'),
        ('sr_5', 'real', 'sr_5'),
        ('sr_6', 'real', 'sr_6'),
        ('sr_7', 'real', 'sr_7'),
        ('sr_8', 'real', 'sr_8'),
    ]
}
```

_Because `PER_BAR_SOURCES` is defined as `[s for s in SOURCES if s != 'zigzag']`, `'sr_levels'` is automatically enrolled into cross-source validation and completeness checks._

#### 2. Register Null Sentinel Price Guards

Add `sr_1` through `sr_8` to `PRICE_LEVEL_COLUMNS`:

```python
PRICE_LEVEL_COLUMNS.update({
    'sr_1', 'sr_2', 'sr_3', 'sr_4', 'sr_5', 'sr_6', 'sr_7', 'sr_8'
})
```

_Ensures that any inactive slot exported as `<= 0.0` or empty string is strictly stored as SQL `NULL`._

#### 3. ~~Add to `STAT_SOURCES` for Fit-Quality Capture~~ — **CORRECTED, NOT IMPLEMENTED**

> **This step is both a no-op and actively harmful as written, and was reversed during
> implementation.**
>
> `STAT_SOURCES` is a _derived blacklist_ — `[s for s in SOURCES if s not in ('ohlcv',
'zigzag', 'zscore')]` — so adding the source to `SOURCES` enrolls it automatically.
> There is nothing to add. The real work is the opposite decision, and the opposite
> decision is the correct one:
>
> 1. **The vocabulary does not match.** `indicator_statistics` and `STAT_FIELDS` speak
>    regression fit quality — MODEL A / MODEL B residuals (R², MSE, Var Ratio, Skewness,
>    Kurtosis) and EDT-channel containment. The SR statistic file speaks
>    Freedman-Diaconis calibration — Q25, Q75, IQR, Optimal Step, Fractals Sample, Total
>    Macro Clusters. Only the window timestamps overlap. Ingesting it writes a
>    near-empty row every cycle.
> 2. **It would break a working lane.** `gateway_contract_indicator_statistics.schema.json`
>    pins `source` to a **closed 10-value enum**, and that POST is **batched** — so one
>    `sr_levels` element 400s the _entire request_ and quarantines every other snapshot
>    in that cycle (~22 of them).
> 3. **`config_params` is not an escape hatch either.** It exists for _compiled_
>    configuration, deduplicated by `config_hash` so that a new hash IS the "someone
>    reconfigured this indicator" signal. The IQR values are re-derived observations that
>    change every cycle; putting them there would mint a new hash per cycle and destroy
>    that signal.
>
> **Implemented instead:** `sr_levels` is explicitly excluded from `STAT_SOURCES`, with the
> reasoning inline above that line and pinned by `test_sr_levels_source.py` so it cannot be
> silently re-enrolled. MT5 still writes `SR_Levels_XAUUSD_{TF}_Statistic.txt`; nothing
> reads it. Capturing it properly — new columns in `indicator_statistics`, `STAT_FIELDS`,
> both Prisma mirrors and that contract's enum, plus a second production migration — is its
> own scoped piece of work, for data nothing consumes yet.

---

### 4.3 Component 3: Push Worker (`backfill_worker_api_gateway_v5.py`)

#### 1. Expand `EXPECTED_CONTRACT_FIELDS`

Update the field set and increment the assertion count from 87 to 95:

```python
EXPECTED_CONTRACT_FIELDS = frozenset({
    'terminal_id', 'timestamp', 'symbol', 'timeframe',
    'open', 'high', 'low', 'close', 'volume',
    *(f'{variant}_{suffix}'
      for variant in ('best_fit_a', 'best_fit_b', 'cherry_a', 'cherry_b', 'most_recent', 'non_a', 'non_b')
      for suffix in ('horiz_high_map', 'horiz_low_map', 'ssa', 'ema_ssa',
                     'crossing', 'base_fl', 'uoedt', 'loedt')),
    'fractal_best_fl', 'fractal_uoedt', 'fractal_loedt',
    'best_resistance', 'best_support',
    'sr_1', 'sr_2', 'sr_3', 'sr_4', 'sr_5', 'sr_6', 'sr_7', 'sr_8',  # 14th indicator fields
    'body_direction', 'body_size', 'body_classification',
    'zigzag_point_type', 'zigzag_current_point', 'zigzag_price_change',
    'zigzag_pct_change', 'zigzag_pct_change_class', 'zigzag_bars',
    'zigzag_bars_class', 'zigzag_price_per_bar', 'zigzag_price_per_bar_class',
    'zigzag_slope', 'zigzag_category',
    'cycle_id', 'collected_at', 'calculated_at',
})
assert len(EXPECTED_CONTRACT_FIELDS) == 95, len(EXPECTED_CONTRACT_FIELDS)
```

---

### 4.4 Component 4: Gateway JSON Schema (`gateway_contract_market_data.schema.json`)

Add properties for `sr_1` through `sr_8`:

```json
    "sr_1": { "type": ["number", "null"], "description": "Support 1: Closest Support level below close." },
    "sr_2": { "type": ["number", "null"], "description": "Support 2: 2nd closest Support level below close." },
    "sr_3": { "type": ["number", "null"], "description": "Support 3: 3rd closest Support level below close." },
    "sr_4": { "type": ["number", "null"], "description": "Support 4: 4th closest Support level below close." },
    "sr_5": { "type": ["number", "null"], "description": "Resistance 1: Closest Resistance level above close." },
    "sr_6": { "type": ["number", "null"], "description": "Resistance 2: 2nd closest Resistance level above close." },
    "sr_7": { "type": ["number", "null"], "description": "Resistance 3: 3rd closest Resistance level above close." },
    "sr_8": { "type": ["number", "null"], "description": "Resistance 4: 4th closest Resistance level above close." },
```

---

### 4.5 Component 5: Downstream API Gateway & Database (NestJS / Prisma)

> **SCOPE CORRECTION — this section names only the railway-gateway Prisma schema; the real
> blast radius is 10 files.** `gateway_contract_market_data.schema.json` is the generator
> input for `market-data.dto.ts`, and `test/schema-sync.spec.ts` diffs the two Prisma
> schemas field-for-field with an order-sensitive comparison. Touching the contract
> therefore forces the whole propagation the 2026-09-03 `best_fit` split established: the
> contract JSON, both Prisma schemas (identical block, identical position), the
> regenerated DTO, `test/dto-contract.spec.ts` (87 → 95), `railway-gateway/README.md`,
> `types/indicator.ts`, `types/prisma-stubs.d.ts`, the new migration, and
> `docs/migration-orders/migration-stack-analysis.md`.
>
> **Verified to need no change:** the gateway's controller, validation service and worker
> processor (whole-object upsert, field-agnostic — proven by the e2e suite passing
> untouched); `app/api/market-data/channel/route.ts` and `useMtfOverlay.ts`
> (variant-parametrized, and `ChannelPoint`'s `{upper, mid, lower}` shape does not fit 8
> flat levels — surfacing `sr_*` would be a new endpoint, not an edit);
> `operation-service`'s Prisma schema (a narrow mirror of only the 21 channel columns it
> reads — it carries no `best_resistance`/`best_support` either); and
> `SimpleDataCollector_v2_29_ASYNC_SOCKET.mq5` (legacy EA — _adding_ an indicator cannot
> break its `OnInit`, unlike the 2026-09-03 rename).
>
> **⚠ ROLLOUT ORDER.** Apply the migration **before** `railway-gateway` deploys. The
> contract sets `additionalProperties: false`, the NestJS global pipe sets
> `forbidNonWhitelisted: true`, and the push worker's 400 handler quarantines a row **and
> stamps `synced_at`** — so rows posted to a gateway that predates the columns are
> permanently marked synced and recoverable only by hand via `replay_quarantine.py`. The
> reverse order merely 5xxs and retries.

- **Prisma Schema (`schema.prisma` in Railway API Gateway):**
  Add columns to `MarketDataV6` model:
  ```prisma
  sr_1  Float?
  sr_2  Float?
  sr_3  Float?
  sr_4  Float?
  sr_5  Float?
  sr_6  Float?
  sr_7  Float?
  sr_8  Float?
  ```
- **Database Migration:** Generate and apply PostgreSQL migration:
  `ALTER TABLE market_data_v6 ADD COLUMN sr_1 DOUBLE PRECISION, ...;`

---

## 5. Active / Hot-Standby Terminal Architecture Compliance

In accordance with [`ACTIVE-STANDBY-TERMINAL-ARCHITECTURE.md`](file:///D:/SaaS%20Project/trading-alerts-saas-public/backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/ACTIVE-STANDBY-TERMINAL-ARCHITECTURE.md):

1. **Attachment Symmetry Across Alternating Terminals:**
   - **Terminal A (Active):** Attach `SupportAndResistantAutoCalibration_v2_29.mq5` to both XAUUSD M5 chart and XAUUSD M15 chart (14 indicators total per chart).
   - **Terminal B (Hot Standby):** Attach identically to both charts with the exact same window parameters.
   - **Terminal S (Static):** Untouched (runs 8 currency index OHLCV exporters).
2. **Promote Safety:**
   - Both terminals export `SR_Levels_XAUUSD_M5.txt` and `SR_Levels_XAUUSD_M15.txt` concurrently.
   - Switching `--export-dir` between Terminal A and Terminal B during routine anchor retuning will seamlessly pick up the 14th indicator without missing bars or schema divergence.
3. **Stale Export Guard Integration:**
   - The collector's `MAX_BAR_LAG_MULTIPLIER` guard automatically monitors `SR_Levels_XAUUSD_{TF}.txt`. If the standby terminal is ever stopped, the freshness check prevents silent stale ingestion.

---

## 6. Implementation Feasibility & Risk Analysis

### 6.1 Feasibility Verdict

**FEASIBLE & LOW RISK.**

- **MQL5-Only Architecture Conformance:** No Python transliteration needed. MQL5 computes and exports every value; the pipeline strictly transports them.
- **Idempotent Schema Migration:** ~~`migrate_raw_tables()` in
  `export_collector_validator_v2.py` automatically detects new tables and columns upon
  service boot.~~
  > **CORRECTED — it does neither of those things.** `migrate_raw_tables()` skips a table
  > that does not yet exist (`if not existing: continue`), and its docstring states it
  > deliberately never touches `market_data`. `CREATE TABLE IF NOT EXISTS market_data` is
  > likewise a silent no-op against a deployed `xauusd.db`. So the 8 new columns had **no**
  > automatic path: `promote_cycle()` names `sr_1`, SQLite raises `OperationalError: table
market_data has no column named sr_1`, and nothing in `run_cycle()` catches it — the
  > collector crash-loops on the first validated cycle.
  >
  > `raw_sr_levels` itself is fine: new _tables_ do arrive, via `open_db()`'s
  > `executescript` of the schema file. It is `market_data` that had no path.
  >
  > **Implemented:** a new `migrate_market_data()` — additive-only (`ALTER TABLE ... ADD
COLUMN`, never DROP, RENAME or backfill), derived from `SOURCES` through
  > `market_data_column()` so it cannot disagree with what `promote_cycle()` writes, and
  > wired into `open_db()` — plus `migrate_sqlite_add_sr_columns.sql` for operators who
  > prefer an explicit pre-start step. Running either, or both, is safe.
- **Payload Size Margins:** Adding 8 floating-point numbers per row increases JSON payload by ~160 bytes (~80 KB per 500 rows), well below Railway Gateway's 100 KB payload constraint.
- **CPU / Memory Overhead:** The Freedman-Diaconis clustering runs over 30–50 fractals per 5-minute cycle, requiring negligible CPU (< 2ms per execution).

### 6.3 Other findings from the live code (recorded during implementation)

- **The TSV header is bare.** `timestamp / symbol / timeframe / close / sr_1 ... sr_8` — no
  source prefix on the keys _or_ the data columns. Every other source prefixes at least
  its line values (`Best_Resistance`, `Resistance_timestamp`). This parses without a
  special case because `parse_export_file()` reads the 4 keys **positionally** and data
  columns **by name**, but it is the only source that does it — so it is now written down
  in `data-split-between-mql5-and-python/Export Data from MQL5 indicators.txt` and pinned
  by a test.
- **The export is 3001 rows, not 3000.** The loop runs `shift = MathMin(InpExportBars,
bars-1) ... 0`, inclusive at both ends — 3000 closed bars plus the still-forming bar.
  Harmless, and consistent with the other producers, which also export shift 0.
- **Output-filename collision with the predecessor.** `SupportAndResistant_v2_29.mq5` (in
  `mql5-indicators/mlq5-indicator-export/support-resistant-export/`) also defaults to
  `InpExportFileName = "SR_Levels"`. Attached together they would truncate each other's
  export and statistic files at `:59`, with two different statistic schemas. Decommission
  it before attaching the new one.
- **Static levels are back-projected across the whole export.** `ArrayLevels` is resolved
  once from the fixed `[InpStartDateTime, InpEndDateTime]` window, then re-bucketed
  against each bar's own close — so a historical bar carries today's level set. Same class
  of look-ahead as `HISTORICAL-VALUES-LOOK-AHEAD-BIAS-OPEN-ISSUE.md` documents for the
  centroid families, and stronger. Fine for a live snapshot; invalid for backtesting.
- **Two dead code paths in the indicator** (flagged, not fixed — indicator-side, outside
  this change's scope): `ExportSRData(bool is_backfill)` never reads its parameter, so the
  "Backfill" button is identical to "Export"; and the early return on unchanged
  `rates_total` means the intra-bar price-move trigger can never fire.
- **`sr_*` are written to 2 decimals** while `close` uses `_Digits`. Identical on XAUUSD;
  not portable to a 5-digit symbol.
- **The statistic file uses ASCII hyphens** in its section headers where the other ten
  producers use an em dash. Moot while `sr_levels` is excluded from statistics capture; it
  matters whenever that is built.

### 6.4 Pre-Implementation Safety Checklist for Claude Code

- [ ] Ensure `SupportAndResistantAutoCalibration_v2_29.mq5` is compiled into `.ex5` on the VPS.
- [ ] Ensure `InpAutoExport=true`, `InpExportSecond=59`, and `InpExportBars=3000` are configured.
- [ ] Execute `python test_stale_export_guard.py` before and after modifying `export_collector_validator_v2.py`.
- [ ] Execute schema update script on SQLite `xauusd.db` before starting the collector.
- [ ] Run a test dry-run with `--once` flag to confirm 14 sources stage and promote cleanly into `market_data`.
- [ ] Verify `backfill_worker_api_gateway_v5.py` drains 95-column rows with HTTP 200/201 responses.
