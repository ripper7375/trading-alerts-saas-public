# Backend Stack C — v2.29 Data Pipeline Architecture - List of files completion

**Location:** `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/`
**Status:** Calc stack CERTIFIED. Pre-production — gateway migration (now implemented by
`railway-gateway/`, see reconciliation note in `backend-file-inventory.md`) and
timestamp-conversion (`timestamp_adj` normalization) remain open.
**Authoritative reference:** `DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md` (this stack's own
file manifest is §0 of that document — this file mirrors it into the project's inventory system).

This is a separate deployment target (Windows VPS on Contabo) from the Part-numbered Next.js
SaaS build — not part of `app/`, `lib/`, or the other Part 02–19 stacks. It is the XAUUSD
market-data collection pipeline: MT5 chart indicators → auto-exported `.txt` files → collect /
validate / calculate / promote (SQLite `xauusd.db`) → push to the Railway API Gateway.

## Runtime — Pipeline Engine & Calc Stack (5 files)

**File 1/37:** ✅ `export_collector_validator_v2.py` - Pipeline engine: COLLECT → ADJUST → VALIDATE → CALCULATE → PROMOTE
**File 2/37:** ✅ `centroid_regression.py` - Calc module: 6 centroid variants as one parameterized engine (DBSCAN, WLS, EDTs)
**File 3/37:** ✅ `fractal_lines.py` - Calc module: fractal / resistance / support lines
**File 4/37:** ✅ `zigzag_metrics.py` - Calc module: zigzag segment metrics (price/bar change, slope, category)
**File 5/37:** ✅ `zscore_candle.py` - Calc module: candle body direction/size/classification

## Runtime — Schema, Push Worker & Ops (6 files)

**File 6/37:** ✅ `sqlite_schema_v6_xauusd.sql` - `xauusd.db` schema: 12 `raw_*` staging tables + validation views + `market_data` (79-col promoted table)
**File 7/37:** ✅ `backfill_worker_api_gateway_v5.py` - Push worker: drains `market_data WHERE synced_at IS NULL` to the gateway; verifies the 79-field schema contract at startup
**File 8/37:** ✅ `gateway_contract_market_data.schema.json` - JSON-Schema of the POST body the gateway must accept (79 fields + `terminal_id`)
**File 9/37:** ✅ `replay_quarantine.py` - Re-POSTs gateway-rejected rows (`rejected_rows.jsonl`) after a fix
**File 10/37:** ✅ `install_services.bat` - Windows/NSSM installer for `MT5Collector`, `MT5PushWorker`, `MT5Relay` services
**File 11/37:** ✅ `DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md` - Authoritative architecture doc (the "bible") — design goals, data contract, deployment guide, ops runbook, failure modes, remaining work

## MQL5 Export Indicators — `mq5/` (12 files, one set on M5 + one on M15)

**File 12/37:** ✅ `mq5/2EDTCentroidRegressionBestFitNonMostRecent_v2_29.mq5` - Centroid variant: `best_fit` (export prefix `Centriod_Best_Fit`)
**File 13/37:** ✅ `mq5/2EDTCentroidRegressionCherryPickA_v2_29.mq5` - Centroid variant: `cherry_a` (export prefix `Cherry-Pick-A`)
**File 14/37:** ✅ `mq5/2EDTCentroidRegressionCherryPickB_v2_29.mq5` - Centroid variant: `cherry_b` (export prefix `Cherry-Pick-B`)
**File 15/37:** ✅ `mq5/2EDTCentroidRegressionMostRecentLineExtension_v2_29.mq5` - Centroid variant: `most_recent` (export prefix `Most-Recent`)
**File 16/37:** ✅ `mq5/2EDTCentroidRegressionNonMostRecentLineExtensionA_v2_29.mq5` - Centroid variant: `non_a` (export prefix `Non-Recent-A`)
**File 17/37:** ✅ `mq5/2EDTCentroidRegressionNonMostRecentLineExtensionB_v2_29.mq5` - Centroid variant: `non_b` (export prefix `Non-Recent-B`)
**File 18/37:** ✅ `mq5/2EDTFractalBestFitv5_v2_29.mq5` - Fractal Best-Fit indicator (export prefix `Fractal_EDT`)
**File 19/37:** ✅ `mq5/SingleBestResistanceLinev3_v2_29.mq5` - Single-best resistance line (export prefix `Resistance_Line`)
**File 20/37:** ✅ `mq5/SingleBestSupportLinev3_v2_29.mq5` - Single-best support line (export prefix `Support_Line`)
**File 21/37:** ✅ `mq5/ZigZagExportv43_v2_29.mq5` - ZigZag pivot export (export prefix `ZigZag`)
**File 22/37:** ✅ `mq5/ohlcvexportlightweight_v2_29.mq5` - OHLCV per-bar spine export (export prefix `OHLCV`)
**File 23/37:** ✅ `mq5/zscoreohlccandleexport_v2_29.mq5` - Z-score candle export (export prefix `ZScore`)

## Legacy — Retained for Reference, NOT in the v6 Data Flow (2 files)

**File 24/37:** ✅ `SimpleDataCollector_v2_29_ASYNC_SOCKET.mq5` - Legacy EA socket-push producer; on the v6 terminal its only job is keeping charts/indicators alive
**File 25/37:** ✅ `SimpleDataCollector_v2_29_ASYNC_SOCKET.ex5` - Compiled binary of the legacy EA (not deployed as part of v6)

## Certification & Tests — `mql5-to-python-transliteration/` (8 files)

**File 26/37:** ✅ `mql5-to-python-transliteration/golden_certification.py` - Harness: calc stack vs full 3000-bar MQL5 exports (per-indicator `_Statistic.txt` for window+params)
**File 27/37:** ✅ `mql5-to-python-transliteration/golden_certification_report_M5.txt` - M5 certification evidence (39/50 pass; 11 accepted-tolerance residuals)
**File 28/37:** ✅ `mql5-to-python-transliteration/golden_certification_report_M15.txt` - M15 certification evidence (50/50 pass — full stack exact)
**File 29/37:** ✅ `mql5-to-python-transliteration/test_phase1_golden.py` - 23 checks: z-score candle + zigzag metrics (golden vs mock + units)
**File 30/37:** ✅ `mql5-to-python-transliteration/test_phase2_lines.py` - 30 checks: fractal/resistance/support line geometry
**File 31/37:** ✅ `mql5-to-python-transliteration/test_phase3_centroid.py` - 40 checks: centroid engine (DBSCAN, selection, WLS, EDTs, stats)
**File 32/37:** ✅ `mql5-to-python-transliteration/CERTIFICATION.md` - Formal verdict and accepted-tolerance record
**File 33/37:** ✅ `mql5-to-python-transliteration/README.md` - Calc-stack overview, porting rules, phase table

## Legacy Relay & Reference Data (4 files)

**File 34/37:** ✅ `mt5_api_relay_for_v2_29.py` - Legacy local async TCP relay for the socket-push path (not part of the v6 data flow)
**File 35/37:** ✅ `data-split-between-mql5-and-python/Export Data from MQL5 indicators.txt` - Authoritative list of columns MQL5 exports (the admin layer)
**File 36/37:** ✅ `data-split-between-mql5-and-python/Python stacks calculation.txt` - Authoritative list of values Python calculates (the derived layer)
**File 37/37:** ✅ `sqlite_schema_v6_xauusd_preview.txt` - Excel-openable preview of every v6 table with mock rows

## Status Summary

- **Completed:** 37/37 files (100%)
- **Missing:** None
- **Calc stack:** CERTIFIED — 93/93 unit/golden checks passing; M15 50/50 exact (~5e-6); M5 39/50
  exact + 11 accepted-bounded-tolerance residuals (DBSCAN epsilon-boundary sensitivity and a
  per-bar export reconstruction limit — both documented in `CERTIFICATION.md`, not a
  numeric/language porting error).
- **Pre-production remaining work (blueprint §13):**
  1. **Timestamp-conversion stack** — `timestamp_adj` is currently a documented placeholder
     (`round(raw/tf)*tf`); each of the 12 exporters emits a different constant sub-bar phase, so
     cross-source `close` validation cannot pass on heterogeneous exports until this is resolved.
     Gating for a green end-to-end validation run.
  2. **Gateway migration** — ✅ now implemented by `railway-gateway/` (NestJS, added
     2026-07-05; see the reconciliation note in `../../backend-file-inventory.md`), which
     validates against `gateway_contract_market_data.schema.json` and idempotently upserts into
     the new `market_data_v6` Postgres table.
  3. **Windowed-anchor handling** — Fractal-Best-Fit and both Single-Best lines use fixed
     `InpStartDateTime`/`InpEndDateTime`; need an operational re-anchoring procedure or a rolling
     window.
  4. (Optional) Slim the indicator exports to the admin-layer columns once the above are stable.
- **2026-07-05 changes in this batch:**
  - `backfill_worker_api_gateway_v5.py` — `API_GATEWAY_URL` now read from env (was hardcoded
    placeholder); added a startup self-check (`verify_schema_contract`) that asserts
    `market_data`'s columns match the 79-field `gateway_contract_market_data.schema.json` exactly,
    refusing to start on drift instead of surfacing as silent gateway 400s; dropped the custom
    `X-Terminal-ID`/`X-EA-Version` headers now that `terminal_id` travels in the POST body.
  - `install_services.bat` — wires `API_GATEWAY_URL` into the `MT5PushWorker` NSSM service
    environment alongside `BACKFILL_API_KEY`.
  - `sqlite_schema_v6_xauusd.sql` — trivial cleanup (removed 3 duplicated trailing lines from a
    copy/paste artifact); no schema/semantic change.
- **Deferred product features (not pipeline-blocking):** trendline image rendering + statistical
  scoring/advice (see the companion `v2_29_multi-timeframe-visualisation-files-completion.md` for
  the rendering half of this); parameter-revision alerting.

## Directory Structure

```
v2_29_data_pipeline_architecture/
├── DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md
├── export_collector_validator_v2.py         # pipeline engine
├── centroid_regression.py                   # calc module
├── fractal_lines.py                         # calc module
├── zigzag_metrics.py                        # calc module
├── zscore_candle.py                         # calc module
├── sqlite_schema_v6_xauusd.sql
├── sqlite_schema_v6_xauusd_preview.txt
├── backfill_worker_api_gateway_v5.py        # push worker
├── gateway_contract_market_data.schema.json
├── replay_quarantine.py
├── install_services.bat
├── SimpleDataCollector_v2_29_ASYNC_SOCKET.mq5   # legacy
├── SimpleDataCollector_v2_29_ASYNC_SOCKET.ex5   # legacy (compiled)
├── mt5_api_relay_for_v2_29.py                   # legacy
├── mq5/                                     # 12 export indicators (M5 + M15 charts)
│   ├── 2EDTCentroidRegressionBestFitNonMostRecent_v2_29.mq5
│   ├── 2EDTCentroidRegressionCherryPickA_v2_29.mq5
│   ├── 2EDTCentroidRegressionCherryPickB_v2_29.mq5
│   ├── 2EDTCentroidRegressionMostRecentLineExtension_v2_29.mq5
│   ├── 2EDTCentroidRegressionNonMostRecentLineExtensionA_v2_29.mq5
│   ├── 2EDTCentroidRegressionNonMostRecentLineExtensionB_v2_29.mq5
│   ├── 2EDTFractalBestFitv5_v2_29.mq5
│   ├── SingleBestResistanceLinev3_v2_29.mq5
│   ├── SingleBestSupportLinev3_v2_29.mq5
│   ├── ZigZagExportv43_v2_29.mq5
│   ├── ohlcvexportlightweight_v2_29.mq5
│   └── zscoreohlccandleexport_v2_29.mq5
├── mql5-to-python-transliteration/          # certification & tests
│   ├── golden_certification.py
│   ├── golden_certification_report_M5.txt
│   ├── golden_certification_report_M15.txt
│   ├── test_phase1_golden.py
│   ├── test_phase2_lines.py
│   ├── test_phase3_centroid.py
│   ├── CERTIFICATION.md
│   └── README.md
└── data-split-between-mql5-and-python/      # reference specs
    ├── Export Data from MQL5 indicators.txt
    └── Python stacks calculation.txt
```

## Key Features

- **Single source of truth = validated export files.** All 12 indicators export per-bar `.txt`
  files; the collector cross-validates them, computes the derived layer in Python, and promotes
  one coherent `market_data` row per bar.
- **MQL5 computes the minimum; Python computes the configurable** — the split collapses the 6
  centroid indicators into one parameterized engine and enables future user-configurable
  parameters (window dates, centroid inclusion/exclusion, thresholds).
- **Reject incoherent cycles, never half-ingest** — if the 12 sources disagree on the validation
  keys for a 5-minute cycle, the whole cycle is rejected and re-requested (≤3 attempts); only
  fully validated cycles reach `market_data`.
- **Never lose validated data** — `market_data` is a permanent, append/update-only store;
  `synced_at` is an outbox marker (never deletes); 400-rejected rows are quarantined for replay.
- **Observable** — cycle state, per-mismatch forensics (`validation_failures`), and quarantine
  files are all inspectable; services log to rotating files.
- **Deployed as three NSSM services** on the Contabo Windows VPS: `MT5Collector`,
  `MT5PushWorker`, `MT5Relay` (legacy/optional).

## Testing Checklist

| Test                              | Command                                                          | Expected Result           |
| ---------------------------------- | ----------------------------------------------------------------| -------------------------- |
| Calc-stack unit/golden suite       | `python3 test_phase1_golden.py` / `test_phase2_lines.py` / `test_phase3_centroid.py` | 93/93 passing |
| Golden certification vs MQL5       | `python3 golden_certification.py <exports> <TF> <statistics>`   | M15 50/50, M5 39/50 (accepted) |
| Quarantine replay (dry run)        | `python3 replay_quarantine.py --dry-run`                        | Previews rows without POSTing |
| Collector one-shot (mock/testing)  | `export_collector_validator_v2.py --once --no-market-hours`     | Runs a single cycle |

## Dependencies

### Runtime
- Python 3.x, `aiohttp`, `requests` (per `install_services.bat` prereqs)
- SQLite (`xauusd.db`, schema in `sqlite_schema_v6_xauusd.sql`)
- NSSM (Windows service manager) for the three VPS services

### Downstream
- `railway-gateway/` (NestJS) — the gateway this stack's push worker posts to (see
  `backend-file-inventory.md` reconciliation note, 2026-07-05)
- `prisma/migrations/20260705000000_add_market_data_v6` — the root Next.js app's Postgres table
  that the gateway's queue consumer writes into
- `lib/jobs/alert-checker.ts` — reads `market_data_v6` for XAUUSD price checks (gateway-first,
  Flask-fallback)

## Notes

### Not part of the Part-numbered SaaS build

This stack (`backend-stack-c/`) is a standalone deployment on a separate VPS, versioned
independently (`v2.29`) from the `Part 02`–`Part 19` Next.js application build. It is documented
here for inventory completeness but does not follow the app's `app/`/`lib/`/`components/`
conventions.

### Legacy path — do not wire into `market_data`

The EA socket-push path (`SimpleDataCollector_v2_29_ASYNC_SOCKET.mq5/.ex5` +
`mt5_api_relay_for_v2_29.py`) is retained for history and a possible future low-latency push
feed, but is explicitly **not** part of the v6 data flow (decision, June 2026 — blueprint §3.3,
§14). Do not resurrect it into the validated pipeline without an explicit architecture decision.

---

## Update 2026-07-05

Initial inventory entry — this stack existed on disk prior to this date but had never been added
to the project's files-completion tracking system. All 37 files confirmed present and complete.
Companion stack: `v2_29_multi-timeframe-visualisation-files-completion.md`.

### Addendum — legacy decommission note

The sibling `../architecture-document/old-architecture/README.md` (backend-file-inventory.md row
623) was added the same day, formally marking the pre-v6 EA lineage
(`SimpleDataCollector_v2_25/26/27_API_GATEWAY.mq5/.ex5`, `backfill_worker_api_gateway_v2/v3.py` —
the tema/hrma/smma/Keltner/Heiken-Ashi/8-level-S-R/zigzag_high-low/pinbar/fractal indicator set) as
decommissioned, superseded by this stack. The other 8 legacy files in that folder are pre-existing
and untouched by this reconciliation — only the new `README.md` got an inventory row. The matching
Postgres-side decommission (`MarketData` → `MarketDataV6`) is covered in
`backend-file-inventory.md`'s main 2026-07-05 note.
