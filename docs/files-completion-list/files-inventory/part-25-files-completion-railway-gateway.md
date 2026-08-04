# Part 25: Railway Gateway (NestJS v6 Ingest) - List of Files Completion

**Last Updated:** 2026-08-04
**Status:** ✅ Complete (100%)

---

## 📊 Overview

Part 25 encompasses the standalone NestJS API Gateway deployed on Railway (`railway-gateway/`). It acts as the production ingestion engine for the XAUUSD market data pipeline:

1. **Ingest Endpoint (`POST /api/v1/market-data`):** Receives 79-column `market_data` POST requests from the Part 23 push worker (`backfill_worker_api_gateway_v5.py`).
2. **Schema & DTO Contract Enforcement:** Validates payloads against `gateway_contract_market_data.schema.json` via auto-generated Class-Validator DTOs (`market-data.dto.ts`).
3. **Async BullMQ Queue Processing:** Queues payloads with an idempotent job key (`{symbol}_{timeframe}_{timestamp}`) and asynchronously upserts rows into PostgreSQL `market_data_v6`.
4. **Data Provider for Part 24:** Populates the `market_data_v6` table used by Part 24's PRO multi-timeframe channel overlay endpoints (`/api/market-data/channel`).

---

## 🔗 Architecture Connection to Part 23 & Part 24

```
┌─────────────────────────────────────────────────────────────────────────┐
│ PART 23: Contabo VPS Pipeline Engine                                    │
│ 12 MQL5 Indicators → Python Collector → SQLite xauusd.db (79 columns)   │
│ Push Worker (backfill_worker_api_gateway_v5.py)                         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTP POST (79 columns JSON)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ PART 25: NestJS Railway Ingest Gateway (railway-gateway/)              │
│ • POST /api/v1/market-data (ApiKeyGuard)                                │
│ • Validates payload against gateway_contract_market_data.schema.json   │
│ • Enqueues to BullMQ queue with jobId: {symbol}_{timeframe}_{timestamp} │
│ • MarketDataProcessor idempotently upserts to PostgreSQL market_data_v6│
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ PostgreSQL (market_data_v6)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ PART 24: Multi-Timeframe Channel Visualization & Web APIs               │
│ • /api/market-data/channel queries market_data_v6 via marketPrisma     │
│ • TradingChartClient renders M5 centroid channel overlay on M15 chart  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Production Files Inventory (30 Files)

### 1. Configuration & Deployment Files (7 files)

| #   | File Path                               | Status   | Description                                                                       |
| --- | --------------------------------------- | -------- | --------------------------------------------------------------------------------- |
| 1   | ✅ `railway-gateway/.env.example`       | Complete | Env template (`API_KEYS`, `DATABASE_URL`, `REDIS_HOST`, `RATE_LIMIT_MAX`, `PORT`) |
| 2   | ✅ `railway-gateway/README.md`          | Complete | Setup instructions, DTO regeneration commands, and deployment runbook             |
| 3   | ✅ `railway-gateway/docker-compose.yml` | Complete | Local Postgres and Redis environment for development                              |
| 4   | ✅ `railway-gateway/jest.config.js`     | Complete | Jest configuration for unit and contract specs                                    |
| 5   | ✅ `railway-gateway/nest-cli.json`      | Complete | NestJS CLI workspace configuration                                                |
| 6   | ✅ `railway-gateway/railway.toml`       | Complete | Railway deployment configuration                                                  |
| 7   | ✅ `railway-gateway/tsconfig.json`      | Complete | Independent NestJS TypeScript configuration                                       |

---

### 2. Package & Schema Files (3 files)

| #   | File Path                                 | Status   | Description                                                                                        |
| --- | ----------------------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| 8   | ✅ `railway-gateway/package.json`         | Complete | NestJS dependencies (`@nestjs/bull`, `@prisma/client`, `class-validator`, `helmet`, `compression`) |
| 9   | ✅ `railway-gateway/package-lock.json`    | Complete | Node package lockfile                                                                              |
| 10  | ✅ `railway-gateway/prisma/schema.prisma` | Complete | Mirrors the root app's `MarketDataV6` model for typed Prisma client generation                     |

---

### 3. Utility Scripts (2 files)

| #   | File Path                                                | Status   | Description                                                                            |
| --- | -------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| 11  | ✅ `railway-gateway/scripts/generate-market-data-dto.js` | Complete | Script generating `market-data.dto.ts` from `gateway_contract_market_data.schema.json` |
| 12  | ✅ `railway-gateway/scripts/seed_local_xauusd_db.py`     | Complete | Local SQLite seed helper for testing end-to-end push worker ingestion                  |

---

### 4. NestJS Application Source (`railway-gateway/src/`, 13 files)

| #   | File Path                                                  | Status   | Description                                                                                                         |
| --- | ---------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| 13  | ✅ `railway-gateway/src/main.ts`                           | Complete | Application bootstrap with Helmet, CORS, Compression, and global ValidationPipe                                     |
| 14  | ✅ `railway-gateway/src/app.module.ts`                     | Complete | Root module wiring ConfigModule, PrismaModule, BullModule, ThrottlerModule, and sub-modules                         |
| 15  | ✅ `railway-gateway/src/auth/api-key.guard.ts`             | Complete | Guard enforcing Bearer token authentication against `API_KEYS` environment variable                                 |
| 16  | ✅ `railway-gateway/src/gateway/gateway.module.ts`         | Complete | Gateway module registering `MarketDataController` and Bull queue                                                    |
| 17  | ✅ `railway-gateway/src/gateway/market-data.controller.ts` | Complete | `POST /api/v1/market-data`: Ingests and enqueues payload with idempotent `{symbol}_{timeframe}_{timestamp}` job key |
| 18  | ✅ `railway-gateway/src/gateway/validation.service.ts`     | Complete | Validates payload internal consistency (OHLC order, timestamps, Z-score bounds, duplicate queue check)              |
| 19  | ✅ `railway-gateway/src/gateway/dto/market-data.dto.ts`    | Complete | Auto-generated 79-field + `terminal_id` Class-Validator DTO                                                         |
| 20  | ✅ `railway-gateway/src/health/health.module.ts`           | Complete | Health module registration                                                                                          |
| 21  | ✅ `railway-gateway/src/health/health.controller.ts`       | Complete | `GET /api/v1/health` (DB/Redis health status) and `GET /api/v1/queue/stats` (BullMQ queue metrics)                  |
| 22  | ✅ `railway-gateway/src/prisma/prisma.module.ts`           | Complete | Prisma service module registration                                                                                  |
| 23  | ✅ `railway-gateway/src/prisma/prisma.service.ts`          | Complete | PrismaClient wrapper with NestJS lifecycle hooks                                                                    |
| 24  | ✅ `railway-gateway/src/worker/worker.module.ts`           | Complete | Worker module registering `market-data-sync` queue consumer                                                         |
| 25  | ✅ `railway-gateway/src/worker/market-data.processor.ts`   | Complete | BullMQ processor (`@Process({name: 'process', concurrency: 1})`) idempotently upserting into `market_data_v6`       |

---

### 5. Test Suite & E2E Harness (`railway-gateway/test/`, 5 files)

| #   | File Path                                            | Status   | Description                                                                     |
| --- | ---------------------------------------------------- | -------- | ------------------------------------------------------------------------------- |
| 26  | ✅ `railway-gateway/test/dto-contract.spec.ts`       | Complete | Contract spec asserting zero drift between DTO and Part 23 JSON-Schema contract |
| 27  | ✅ `railway-gateway/test/jest-e2e.json`              | Complete | Jest configuration for E2E tests                                                |
| 28  | ✅ `railway-gateway/test/market-data.e2e-spec.ts`    | Complete | Supertest integration tests for NestJS endpoints (Prisma/Bull mocked)           |
| 29  | ✅ `railway-gateway/test/validation.service.spec.ts` | Complete | Unit test suite for `ValidationService` rules                                   |
| 30  | ✅ `railway-gateway/test/local-e2e-harness.md`       | Complete | Runbook for live push-worker → gateway → Postgres end-to-end verification       |

---

## 📊 Status Summary

- **Total Production Files:** 30/30 (100%)
- **Target Table:** `market_data_v6` (PostgreSQL, 79 columns)
- **Ingest Latency:** Immediate 200 OK return upon queuing; async single-concurrency BullMQ worker upsert

---

## 🎯 Technical Ingestion Features

### 1. Zero-Drift DTO Contract

- `scripts/generate-market-data-dto.js` generates `market-data.dto.ts` directly from Part 23's `gateway_contract_market_data.schema.json`. CI fails if the schema and NestJS DTO drift.

### 2. Single-Concurrency Idempotent Upsert

- BullMQ worker processor is explicitly configured with `concurrency: 1` to ensure strict chronological ordering of M5/M15 bars, using unique key `(symbol, timeframe, timestamp)` for idempotent upserts.

---

## 🔗 Related Documentation

- **Data Pipeline:** `docs/files-completion-list/files-inventory/part-23-files-completion-v2_29_data_pipeline_architecture.md`
- **MTF Visualization:** `docs/files-completion-list/files-inventory/part-24-files-completion-v2_29_multi-timeframe-visualisation.md`

---

**Part 25 Status:** ✅ Complete and production-ready
