# Part 23: Backend Stack C — v2.29 Data Pipeline Architecture & Market Data API - List of Files Completion

**Last Updated:** 2026-08-04
**Status:** ✅ Complete (100%)

---

## 📊 Overview

Part 23 encompasses the complete XAUUSD Market Data Pipeline and API Delivery stack:

1. **VPS Collection Pipeline (`v2_29_data_pipeline_architecture/`):** 12 MT5 MQL5 indicators exporting per-bar `.txt` files on a Contabo Windows VPS → Python collector engine (`export_collector_validator_v2.py`) cross-validating exports → 6-centroid regression engine → SQLite `xauusd.db` (79-column flat `market_data` table) → async backfill worker (`backfill_worker_api_gateway_v5.py`).
2. **Ingestion Gateway (`railway-gateway/`):** NestJS API gateway validating 79-column JSON-Schema payloads and idempotently writing into PostgreSQL `market_data_v6`.
3. **Web API Delivery (`app/api/market-data/channel/` & `app/api/candles/`):** Next.js route handlers serving PRO multi-timeframe channel overlays and public historical OHLCV candles via `marketPrisma`.
4. **Market Data OpenAPI Spec (`part-23-market-data-channel-openapi.yaml`):** OpenAPI 3.0.3 documentation.

---

## 📋 Comprehensive File Inventory By Component

### 1. VPS Pipeline Engine & Calc Stack (`v2_29_data_pipeline_architecture/`, 5 files)

| #   | File Path                             | Status   | Description                                                                 |
| --- | ------------------------------------- | -------- | --------------------------------------------------------------------------- |
| 1   | ✅ `export_collector_validator_v2.py` | Complete | Pipeline engine executing COLLECT → ADJUST → VALIDATE → CALCULATE → PROMOTE |
| 2   | ✅ `centroid_regression.py`           | Complete | Parameterized 6-centroid variant engine (DBSCAN, WLS, EDTs)                 |
| 3   | ✅ `fractal_lines.py`                 | Complete | Fractal, support, and resistance line geometry calculations                 |
| 4   | ✅ `zigzag_metrics.py`                | Complete | ZigZag segment slope and price/bar change metrics                           |
| 5   | ✅ `zscore_candle.py`                 | Complete | Z-score candle body direction and size classification                       |

---

### 2. Pipeline Schema, Push Worker & Ops (6 files)

| #   | File Path                                        | Status   | Description                                                                                            |
| --- | ------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------ |
| 6   | ✅ `sqlite_schema_v6_xauusd.sql`                 | Complete | `xauusd.db` schema (12 `raw_*` staging tables, validation views, 79-column `market_data` table)        |
| 7   | ✅ `backfill_worker_api_gateway_v5.py`           | Complete | Push worker draining un-synced `market_data` rows to Railway API gateway with startup schema assertion |
| 8   | ✅ `gateway_contract_market_data.schema.json`    | Complete | 79-field JSON-Schema contract enforced by API gateway                                                  |
| 9   | ✅ `replay_quarantine.py`                        | Complete | Re-POST helper for quarantined gateway-rejected rows (`rejected_rows.jsonl`)                           |
| 10  | ✅ `install_services.bat`                        | Complete | Windows/NSSM service installer for `MT5Collector`, `MT5PushWorker`, and `MT5Relay`                     |
| 11  | ✅ `DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md` | Complete | Authoritative architecture blueprint and operational runbook                                           |

---

### 3. MQL5 Export Indicators (`mq5/`, 12 files)

- `mq5/2EDTCentroidRegressionBestFitNonMostRecent_v2_29.mq5` (`Centriod_Best_Fit`)
- `mq5/2EDTCentroidRegressionCherryPickA_v2_29.mq5` (`Cherry-Pick-A`)
- `mq5/2EDTCentroidRegressionCherryPickB_v2_29.mq5` (`Cherry-Pick-B`)
- `mq5/2EDTCentroidRegressionMostRecentLineExtension_v2_29.mq5` (`Most-Recent`)
- `mq5/2EDTCentroidRegressionNonMostRecentLineExtensionA_v2_29.mq5` (`Non-Recent-A`)
- `mq5/2EDTCentroidRegressionNonMostRecentLineExtensionB_v2_29.mq5` (`Non-Recent-B`)
- `mq5/2EDTFractalBestFitv5_v2_29.mq5` (`Fractal_EDT`)
- `mq5/SingleBestResistanceLinev3_v2_29.mq5` (`Resistance_Line`)
- `mq5/SingleBestSupportLinev3_v2_29.mq5` (`Support_Line`)
- `mq5/ZigZagExportv43_v2_29.mq5` (`ZigZag`)
- `mq5/ohlcvexportlightweight_v2_29.mq5` (`OHLCV`)
- `mq5/zscoreohlccandleexport_v2_29.mq5` (`ZScore`)

---

### 4. Transliteration Certification & Test Suite (`mql5-to-python-transliteration/`, 8 files)

- `golden_certification.py` — Certification harness running Python calc stack vs 3000-bar MQL5 exports
- `golden_certification_report_M5.txt` — M5 certification evidence (39/50 exact pass + 11 accepted-tolerance residuals)
- `golden_certification_report_M15.txt` — M15 certification evidence (50/50 exact 100% pass)
- `test_phase1_golden.py` — 23 unit checks for z-score & zigzag metrics
- `test_phase2_lines.py` — 30 unit checks for line geometry
- `test_phase3_centroid.py` — 40 unit checks for centroid engine
- `CERTIFICATION.md` — Formal mathematical certification verdict
- `README.md` — Calc-stack porting rules and phase summary

---

### 5. Ingestion Gateway & Web App API Layer (5 files)

| #   | File Path                                                             | Status   | Description                                                                                                               |
| --- | --------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| 38  | ✅ `railway-gateway/src/worker/market-data.processor.ts`              | Complete | NestJS BullMQ worker processor idempotently upserting 79-column rows into Postgres `market_data_v6`                       |
| 39  | ✅ `app/api/market-data/channel/route.ts`                             | Complete | `GET`: PRO multi-timeframe centroid channel overlay endpoint (returns upper, mid, lower channel lines for M5/M15 overlay) |
| 40  | ✅ `app/api/candles/[symbol]/route.ts`                                | Complete | `GET`: Public unauthenticated OHLCV historical candle endpoint                                                            |
| 41  | ✅ `lib/db/market-prisma.ts`                                          | Complete | Dual Prisma client singleton (`marketPrisma` targeting PostgreSQL `market_data_v6`)                                       |
| 42  | ✅ `docs/open-api-documents/part-23-market-data-channel-openapi.yaml` | Complete | OpenAPI 3.0.3 specification for Market Data API (v1.1.0, covering `/api/market-data/channel` and `/api/candles/{symbol}`) |

---

## 📊 Status Summary

- **Total Production & Test Files:** 42 files (37 VPS pipeline files + NestJS Gateway processor + 2 Next.js API endpoints + `marketPrisma` singleton + OpenAPI spec)
- **Data Schema:** 79-column flat `MarketDataV6` schema (`symbol`, `timeframe`, `timestamp`, OHLCV, 6 centroid variants, fractal lines, Z-scores, ZigZag metrics)
- **Calc Stack Certification:** 93/93 checks passing (M15 50/50 exact, M5 39/50 exact)

---

## 🎯 Pipeline Architecture Features

### 1. Cross-Export Validation & Promotion

- The pipeline engine (`export_collector_validator_v2.py`) enforces strict validation key matching across all 12 indicator export files before running Python calculations and promoting a bar to the 79-column `market_data` table.

### 2. Zero-Data-Loss Outbox Pattern

- SQLite `market_data` table tracks sync state via `synced_at`. The push worker (`backfill_worker_api_gateway_v5.py`) drains un-synced rows to the NestJS Gateway, stamping `synced_at` only upon 200 OK confirmation. Quarantined 400 rows are saved to `rejected_rows.jsonl` for replay.

---

## 🔗 Related Documentation

- **Database Schemas:** `docs/files-completion-list/files-inventory/part-02-files-completion-database-schema.md`
- **Charts & Visualization:** `docs/files-completion-list/files-inventory/part-09-files-completion-charts-visualization.md`
- **OpenAPI Specification:** `docs/open-api-documents/part-23-market-data-channel-openapi.yaml`

---

**Part 23 Status:** ✅ Complete and production-ready
