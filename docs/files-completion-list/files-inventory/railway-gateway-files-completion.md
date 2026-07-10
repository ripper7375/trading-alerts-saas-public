# Railway Gateway (NestJS v6 Ingest) - List of files completion

**Location:** `railway-gateway/`
**Status:** Complete — implements the `gateway_contract_market_data.schema.json` contract in
full (validation, idempotent upsert, health/queue-stats endpoints).
**Scope:** The ingest layer for backend-stack-c's v6 XAUUSD pipeline. Receives POSTed
`market_data` rows from the Push Worker (`backfill_worker_api_gateway_v5.py`), validates them,
and idempotently upserts into `market_data_v6` — a new table, additive to the root Next.js app's
Postgres database, that `lib/jobs/alert-checker.ts` reads for XAUUSD.

This resolves the "gateway migration" remaining-work item from
`v2_29_data_pipeline_architecture-files-completion.md` (blueprint §13). Not part of the
Part-numbered Next.js SaaS build — a separate NestJS deployment (own `package.json`, `tsconfig.json`,
excluded from the root app's `tsconfig.json`/`jest.config.js`).

## Config & Deployment (7 files)

**File 1/30:** ✅ `.env.example` - Env template: `API_KEYS` (comma-separated bearer tokens), `DATABASE_URL`, `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD`, `RATE_LIMIT_MAX`, `ALLOWED_ORIGINS`, `PORT`
**File 2/30:** ✅ `README.md` - Setup, DTO regeneration, test commands, deployment runbook (doc §7)
**File 3/30:** ✅ `docker-compose.yml` - Local Postgres + Redis for `npm run start:dev`
**File 4/30:** ✅ `jest.config.js` - Jest config (unit tests; Prisma/Bull mocked)
**File 5/30:** ✅ `nest-cli.json` - NestJS CLI project config
**File 6/30:** ✅ `railway.toml` - Railway deployment config
**File 7/30:** ✅ `tsconfig.json` - NestJS TypeScript config (independent of the root app's)

## Package Files (2 files)

**File 8/30:** ✅ `package.json` - Deps: `@nestjs/{bull,common,config,core,platform-express,throttler}`, `bull`, `@prisma/client`, `class-validator`/`class-transformer`, `helmet`, `compression`; scripts: `generate:dto`, `start:dev`, `test`, `test:e2e`
**File 9/30:** ✅ `package-lock.json` - Lockfile

## Prisma (1 file)

**File 10/30:** ✅ `prisma/schema.prisma` - Mirrors the root app's `MarketDataV6` model for `prisma generate` (typed client) only — this service's own client never runs `prisma migrate` against `market_data_v6`; the root app's migration (`20260705000000_add_market_data_v6`) owns the table

## Scripts (2 files)

**File 11/30:** ✅ `scripts/generate-market-data-dto.js` - Generates `src/gateway/dto/market-data.dto.ts` mechanically from `gateway_contract_market_data.schema.json` (type/const/enum/required only — no invented constraints); re-run via `npm run generate:dto` whenever the schema changes
**File 12/30:** ✅ `scripts/seed_local_xauusd_db.py` - Builds a throwaway local `xauusd.db` (fresh schema + one synthetic-but-valid `market_data` row) for the manual e2e harness, so a real `backfill_worker_api_gateway_v5.py` has something to push to a locally-running Gateway

## Application Source — `src/` (13 files)

**File 13/30:** ✅ `src/main.ts` - Bootstrap: `helmet()`, CORS (`ALLOWED_ORIGINS`), `compression()`, global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`)

**File 14/30:** ✅ `src/app.module.ts` - Root module: `ConfigModule` (global), `PrismaModule`, `BullModule` (Redis connection), `ThrottlerModule` (in-memory, 100 req/min default — sufficient at this pipeline's actual volume of one POST per 5-15 min per timeframe), `GatewayModule`/`WorkerModule`/`HealthModule`; global `ThrottlerGuard` via `APP_GUARD`

**File 15/30:** ✅ `src/auth/api-key.guard.ts` - Bearer-token `CanActivate` guard; compares against a comma-separated `API_KEYS` env var (at most two senders per the schema contract: `push_worker_v5`, `mt5_relay_v2_29` — no per-terminal lookup)

**File 16/30:** ✅ `src/gateway/gateway.module.ts` - Wires `MarketDataController` + `ValidationService`; registers the `market-data-sync` Bull queue for this module
**File 17/30:** ✅ `src/gateway/market-data.controller.ts` - `POST /api/v1/market-data` (guarded by `ApiKeyGuard`): validates via `ValidationService`, enqueues with an idempotent `jobId` (`{symbol}_{timeframe}_{timestamp}` — matches the eventual DB upsert key), returns `{status:'queued', jobId, processingTime}` so the Push Worker can stamp `synced_at`
**File 18/30:** ✅ `src/gateway/validation.service.ts` - Payload validation layered on top of the DTO's own decorators: symbol must be `XAUUSD`, OHLC internal consistency (high ≥ open/close/low, all positive), timestamp freshness (rejects >5min future or >7 days old), `zigzag_point_type`/`zigzag_current_point` must both be present or both absent, candle-proportion sanity checks (zero-range, >100x body/range, spread % bounds), volume bounds (0 ≤ v ≤ 100M), and an in-flight/recently-completed duplicate check against the Bull queue by jobId
**File 19/30:** ✅ `src/gateway/dto/market-data.dto.ts` - **Auto-generated** (do not hand-edit): the 79-field + `terminal_id` DTO with `class-validator` decorators, generated from `gateway_contract_market_data.schema.json`; `test/dto-contract.spec.ts` fails CI if the two drift

**File 20/30:** ✅ `src/health/health.module.ts` - Wires `HealthController`
**File 21/30:** ✅ `src/health/health.controller.ts` - `GET /api/v1/health` (parallel Redis/queue/DB checks, `healthy`/`degraded` status + latencies) and `GET /api/v1/queue/stats` (waiting/active/completed/failed/delayed/paused job counts)

**File 22/30:** ✅ `src/prisma/prisma.module.ts` - Wires `PrismaService`
**File 23/30:** ✅ `src/prisma/prisma.service.ts` - `PrismaClient` wrapper with NestJS lifecycle hooks (connects on module init)

**File 24/30:** ✅ `src/worker/worker.module.ts` - Registers the `market-data-sync` queue consumer + `MarketDataProcessor`
**File 25/30:** ✅ `src/worker/market-data.processor.ts` - Bull consumer (`@Process({name:'process', concurrency:1})` — concurrency pinned to 1 deliberately, to avoid ordering bugs like an M15 row processing before the M5 row it depends on; the job name must match the controller's `queue.add('process', ...)` or jobs silently fail with "Missing process handler"); idempotent `upsert` into `market_data_v6` on `(symbol, timeframe, timestamp)`

## Tests — `test/` (5 files)

**File 26/30:** ✅ `test/dto-contract.spec.ts` - Fails if `market-data.dto.ts` and `gateway_contract_market_data.schema.json` drift apart
**File 27/30:** ✅ `test/jest-e2e.json` - Jest config for the e2e test project
**File 28/30:** ✅ `test/market-data.e2e-spec.ts` - Supertest e2e against the real Nest app (Prisma/Bull mocked — no live DB/Redis)
**File 29/30:** ✅ `test/validation.service.spec.ts` - Unit tests for every `ValidationService` check
**File 30/30:** ✅ `test/local-e2e-harness.md` - Manual runbook for the **real-process** verification that isn't part of the Jest suite: SQLite (via `seed_local_xauusd_db.py`) → real `backfill_worker_api_gateway_v5.py` → this Gateway → real Postgres

## Status Summary

- **Completed:** 30/30 files (100%)
- **Missing:** None
- **Excludes:** `node_modules/` and `dist/` (build output) — not part of this inventory, consistent
  with how `node_modules`/build artifacts are excluded everywhere else in this project's inventory

## Directory Structure

```
railway-gateway/
├── .env.example
├── README.md
├── docker-compose.yml
├── jest.config.js
├── nest-cli.json
├── package.json
├── package-lock.json
├── railway.toml
├── tsconfig.json
├── prisma/
│   └── schema.prisma
├── scripts/
│   ├── generate-market-data-dto.js
│   └── seed_local_xauusd_db.py
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── auth/
│   │   └── api-key.guard.ts
│   ├── gateway/
│   │   ├── gateway.module.ts
│   │   ├── market-data.controller.ts
│   │   ├── validation.service.ts
│   │   └── dto/
│   │       └── market-data.dto.ts       # auto-generated
│   ├── health/
│   │   ├── health.module.ts
│   │   └── health.controller.ts
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   └── worker/
│       ├── worker.module.ts
│       └── market-data.processor.ts
└── test/
    ├── dto-contract.spec.ts
    ├── jest-e2e.json
    ├── market-data.e2e-spec.ts
    ├── validation.service.spec.ts
    └── local-e2e-harness.md
```

## Key Features

- **Idempotent by design at every layer:** the Bull `jobId` (`{symbol}_{timeframe}_{timestamp}`)
  matches the Postgres upsert key (`@@unique([symbol, timeframe, timestamp])` on `MarketDataV6`),
  so duplicate delivery (the Push Worker's retry behavior) can never create a second row.
- **Fire-and-forget from the caller's perspective:** `POST /api/v1/market-data` returns as soon as
  the job is queued (not after DB write), so the Push Worker's `synced_at` stamping isn't coupled
  to Postgres latency.
- **Concurrency = 1 on the worker, deliberately** — no throughput need at this pipeline's volume,
  and it avoids a class of ordering bugs a parallel worker would introduce.
- **DTO is generated, not hand-maintained** — `gateway_contract_market_data.schema.json` (in
  `backend-stack-c/.../v2_29_data_pipeline_architecture/`) is the single source of truth; a
  contract test (`dto-contract.spec.ts`) fails CI on drift.
- **Two-sender auth model** — a flat comma-separated `API_KEYS` list, matching the contract's
  actual sender count (Push Worker + legacy Relay), not a per-terminal key registry.
- **Validation is narrower than the collector's,** on purpose — cross-source key agreement,
  completeness, and ZigZag-as-subset checks already happened upstream in
  `export_collector_validator_v2.py` against sources this Gateway never sees; this layer confirms
  the payload is well-formed and matches the contract, not that the market data itself is correct.

## Testing Checklist

| Test                          | Command                                | Expected Result                                                    |
| ----------------------------- | -------------------------------------- | ------------------------------------------------------------------ |
| Unit + contract specs         | `npm test`                             | `ValidationService` + DTO-contract tests pass (Prisma/Bull mocked) |
| E2E (mocked)                  | `npm run test:e2e`                     | Supertest against the real Nest app, no live DB/Redis              |
| DTO regeneration check        | `npm run generate:dto` then `git diff` | No diff if the schema file hasn't changed                          |
| Real-process harness (manual) | Follow `test/local-e2e-harness.md`     | SQLite → Push Worker → Gateway → Postgres round-trip               |

## Dependencies

### Upstream

- `backend-stack-c/.../v2_29_data_pipeline_architecture/backfill_worker_api_gateway_v5.py` — the
  sender this service receives POSTs from
- `backend-stack-c/.../v2_29_data_pipeline_architecture/gateway_contract_market_data.schema.json` —
  the payload contract; source of truth for the generated DTO

### Downstream

- `prisma/migrations/20260705000000_add_market_data_v6` (root app) — owns the `market_data_v6`
  table this service upserts into
- `lib/jobs/alert-checker.ts` (root app) — reads `market_data_v6` for XAUUSD price checks
  (gateway-first, Flask-fallback)

### External

- NestJS 10.x, Bull 4.x (Redis-backed queue), Prisma 6.x (typed client only), `class-validator`,
  `helmet`, `compression`

## Notes

### Not part of the Part-numbered SaaS build

Like `backend-stack-c/`, this is a standalone deployment (Railway), versioned and tested
independently from the root Next.js monolith's `Part 02`–`Part 19` build. It shares one thing with
the root app: the `market_data_v6` Postgres table, owned by the root app's migration.

### Two Prisma clients, one table

Both this service and the root Next.js app have their own `prisma/schema.prisma` with a
`MarketDataV6` model. This is intentional (see `railway-gateway/prisma/schema.prisma`'s own doc
comment and the root schema's matching note) — only the root app's migration is authoritative;
this service's schema exists purely so its own Prisma client can be generated with the correct
types.

---

## Update 2026-07-08

Initial inventory entry — this stack existed on disk since 2026-07-05 (added alongside the
`market_data_v6` migration) but had never been added to the project's files-completion tracking
system; its 30 rows were added directly to `backend-file-inventory.md` without a companion source
doc. Backfilling that gap now. All 30 files confirmed present and complete. Companion stacks:
`v2_29_data_pipeline_architecture-files-completion.md` (the sender),
`v2_29_multi-timeframe-visualisation-files-completion.md` (a sibling backend-stack-c consumer of
the same `market_data_v6`/`market_data` schema).
