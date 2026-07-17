# `railway-gateway/` Reference Notes

**Purpose:** `railway-gateway/` is a working NestJS service already deployed on Railway,
ingesting XAUUSD market-data rows from the Push Worker/Relay into the shared Postgres
`market_data_v6` table (`railway-gateway/package.json:4`). Per plan §2 step 0.1 and
`migration-stack-analysis.md:81`, it is the reference pattern every new NestJS service in
this migration (`operation-service`, `money-service`) should copy: controller → service →
Prisma, an auth guard, a health module, BullMQ worker, Railway deploy via `railway.toml`.

Written for Session 0-1 (`docs/migration-orders/0-1-orientation-reference-study.migration-order.md`).
Every claim below cites the file + line it comes from — nothing here is inferred.

---

## 1. Project layout

```
railway-gateway/
├── railway.toml            deploy config (24 lines)
├── docker-compose.yml      local Postgres+Redis for manual verification (22 lines)
├── .env.example            required env vars (23 lines)
├── package.json            deps + npm scripts
├── prisma/
│   └── schema.prisma       generate-only client, NOT migration source of truth (122 lines)
├── scripts/
│   ├── generate-market-data-dto.js   codegens the DTO from a JSON schema
│   └── seed_local_xauusd_db.py
├── src/
│   ├── main.ts              bootstrap: helmet, CORS, compression, ValidationPipe (32 lines)
│   ├── app.module.ts        root module wiring (42 lines)
│   ├── auth/
│   │   └── api-key.guard.ts          bearer-token guard (45 lines)
│   ├── prisma/
│   │   ├── prisma.module.ts          @Global Prisma provider (9 lines)
│   │   └── prisma.service.ts         PrismaClient lifecycle wrapper (16 lines)
│   ├── health/
│   │   ├── health.controller.ts      /api/v1/health, /api/v1/queue/stats (86 lines)
│   │   └── health.module.ts          registers the Bull queue for health checks (13 lines)
│   ├── gateway/
│   │   ├── gateway.module.ts         ingest module, Bull queue + retry policy (21 lines)
│   │   ├── market-data.controller.ts POST /api/v1/market-data (60 lines)
│   │   ├── validation.service.ts     business-rule validation (176 lines)
│   │   └── dto/market-data.dto.ts    AUTO-GENERATED class-validator DTO (400 lines)
│   └── worker/
│       ├── worker.module.ts          registers the consumer (13 lines)
│       └── market-data.processor.ts  Bull @Processor, idempotent upsert (60 lines)
└── test/                    dto-contract, e2e, validation.service specs
```

Total: 30 files (`migration-stack-analysis.md:1245`), 1,141 lines across the files above
(measured this session via `wc -l`).

## 2. Module wiring (`src/app.module.ts:1-42`)

Root `AppModule` composes, in order: `ConfigModule.forRoot({ isGlobal: true })` (line 13),
the `@Global` `PrismaModule` (line 15), `BullModule.forRoot` pointed at `REDIS_HOST`/
`REDIS_PORT`/`REDIS_PASSWORD` (lines 17-23), `ThrottlerModule.forRoot` — **in-memory**
storage, deliberately (line 25-28 comment: single-instance gateway, no multi-instance
need) — then the three feature modules `GatewayModule`, `WorkerModule`, `HealthModule`
(lines 36-38). The throttler is applied **globally** via `APP_GUARD` (line 40), not
per-controller — every route gets rate-limiting for free.

**Template takeaway:** a new service's root module should follow the same order —
global config → global Prisma → Bull → global throttler guard → feature modules. Any
service that will run more than one instance must swap the in-memory throttler storage
for a Redis-backed one (the comment at line 25 names this explicitly as the multi-instance
trigger — relevant for `operation-service`/`money-service`, which will run replicas).

## 3. Prisma service wiring

Two tiny files, both meant to be copied verbatim:

- `src/prisma/prisma.module.ts:1-9` — `@Global() @Module({ providers: [PrismaService],
exports: [PrismaService] })`. Being `@Global` means every feature module gets
  `PrismaService` injected without importing `PrismaModule` itself — it's imported once,
  in `app.module.ts:15`.
- `src/prisma/prisma.service.ts:1-16` — extends `PrismaClient`, implements
  `OnModuleInit`/`OnModuleDestroy` to call `$connect()`/`$disconnect()` on the Nest
  lifecycle (lines 9-15). No custom logic beyond lifecycle wiring.

**Schema caveat (important, do not copy blindly):** `prisma/schema.prisma:1-12` states
in its header comment that this schema exists **only** to generate a typed client — it is
explicitly **not** the migration source of truth. The root Next.js app's
`prisma/schema.prisma` owns the actual `market_data_v6` table and its migration history;
this package must never run `prisma migrate`, only `prisma generate` (enforced by
convention, not tooling — `package.json:13` only exposes a `prisma:generate` script, no
`migrate` script exists). The model (`MarketDataV6`, lines 24-122) must be kept
byte-for-byte in sync with the root schema by hand (line 9-12 comment: no test enforces
this). **This is Phase 2's problem to solve properly** (F4/F5 — model census and
Prisma file-layout strategy) — money-service/operation-service will each need their own
generate-only schema pointed at Phase 2's split `market-data`/`non-market-data` schemas,
following this exact pattern, not the "two independent migrate-owning schemas" antipattern
this file's header warns against.

## 4. Guard pattern (`src/auth/api-key.guard.ts:1-45`)

A `CanActivate` implementing bearer-token auth: pulls the `Authorization` header (line
23), requires `Bearer <token>` shape (lines 29-32), and checks the token against a
comma-separated `API_KEYS` env var split into an array (lines 34-38) — no per-caller
lookup, just membership. The doc comment (lines 10-16) notes this pipeline has at most two
senders (`push_worker_v5`, `mt5_relay_v2_29`), which is why a flat env-var list is
sufficient here.

Applied at the controller level via `@UseGuards(ApiKeyGuard)`
(`market-data.controller.ts:20`) — not globally. The comment at
`market-data.controller.ts:16-18` explains the split deliberately: `ThrottlerGuard` is
global (via `APP_GUARD` in `app.module.ts`) so its DI dependencies resolve regardless of
which module a controller lives in, while the API-key check is local because it only
applies to this one write endpoint.

**Template takeaway:** this is a **service-to-service** auth pattern (shared secret list),
not a template for `operation-service`'s user-facing `JwtAuthGuard` (that's a different,
JWT-verification guard built fresh in Session 3-1 per the playbook). What _is_ reusable
here: the guard-at-controller-level-via-`@UseGuards`, throttler-at-global-level-via-
`APP_GUARD` split.

## 5. Health module

- `src/health/health.module.ts:1-13` — imports `BullModule.registerQueue({ name:
'market-data-sync' })` so it can inject that queue for health checks, and declares
  `HealthController`.
- `src/health/health.controller.ts:1-86` — two endpoints under `@Controller('api/v1')`:
  - `GET /api/v1/health` (line 13) — runs three checks in parallel (`Promise.all`, lines
    15-19): Redis ping (`checkRedis`, lines 53-61, via `queue.client.ping()`), queue depth
    (`checkQueue`, lines 63-75, via Bull's `getWaitingCount`/`getActiveCount`/etc.), and DB
    reachability (`checkDatabase`, lines 77-85, via `prisma.$queryRaw\`SELECT 1\``).
Returns `{status: 'healthy'|'degraded', services: {...}, uptime}`(lines 24-33) — never
throws; each sub-check catches its own errors into a`{status:'down', error}` shape.
  - `GET /api/v1/queue/stats` (line 36) — raw Bull job-state counts (waiting/active/
    completed/failed/delayed/paused).

**Template takeaway:** the parallel-fan-out-with-per-check-try/catch pattern (never let one
dependency's outage crash the whole health response) is exactly what `/health-auth` and
later services' `/health` endpoints should follow — Session 3-1's "protected `/health-auth`
endpoint" goal builds on this shape.

## 6. BullMQ worker

Queue is named `'market-data-sync'` everywhere it's referenced — `worker.module.ts:8`,
`gateway.module.ts:9`, `health.module.ts:8`, `market-data.processor.ts:13` — a naming
convention worth carrying forward (CC-E: queue names namespaced per service, e.g.
`op.alerts.fire` in the 4B-2 worked example).

- **Producer side** — `gateway.module.ts:6-17` configures `defaultJobOptions`: 3 attempts,
  exponential backoff starting at 2000ms, `removeOnComplete: 100`, `removeOnFail: 500`.
  `market-data.controller.ts:38-39` enqueues with an explicit `jobId` built from
  `${symbol}_${timeframe}_${timestamp}` — the **same composite key** as the Prisma
  `@@unique` constraint (`schema.prisma:119`) and the processor's upsert `where` clause
  (`market-data.processor.ts:38`). This three-way key alignment (Bull jobId ↔ Prisma
  unique constraint ↔ upsert where-clause) is the idempotency mechanism — Bull refuses to
  double-enqueue the same jobId, and even if it did, the upsert is a no-op on conflict.
- **Consumer side** — `market-data.processor.ts:29` — `@Process({ name: 'process',
concurrency: 1 })`. Two details worth flagging explicitly because they're documented
  footguns in the source comments themselves:
  - Concurrency is pinned to 1 **deliberately** (lines 19-23): avoids ordering bugs (e.g.
    an M15 row processed before the M5 row it depends on), not a throughput accident.
  - The process name `'process'` **must** match the job name the controller enqueues
    (`queue.add('process', ...)`, `market-data.controller.ts:39`) — an unnamed `@Process()`
    only handles unnamed jobs, and the mismatch was a real incident (lines 24-28 comment
    cites a 2026-07-05 audit where named jobs silently failed with "Missing process
    handler" while the controller still returned 200).

**Template takeaway:** any new BullMQ consumer should (a) pin concurrency intentionally,
not default it, (b) double-check the job-name string matches producer and consumer
literally (no shared constant currently enforces this — worth introducing one for new
services), and (c) derive the Bull jobId from the same natural key the DB upsert uses.

## 7. Validation layering (`src/gateway/validation.service.ts:1-176`)

Not explicitly named in the playbook's Session 0-1 task list, but directly relevant to any
future write-path service: validation happens in two layers here — the auto-generated DTO
(`dto/market-data.dto.ts`, regenerated from `gateway_contract_market_data.schema.json` via
`scripts/generate-market-data-dto.js`) handles per-field shape (`@IsIn`, `@IsInt`,
`@IsNumber`, `@IsOptional` — e.g. lines 8-33 of the DTO), while `ValidationService` handles
cross-field business rules the DTO can't express: OHLC consistency (lines 35-64), timestamp
freshness/future-tolerance (lines 66-86), candle-proportion sanity checks against flash
crashes (lines 103-135), and **duplicate-job detection against the live queue itself**
(`checkDuplicates`, lines 149-175 — checks Bull job state before enqueueing, separate from
the DB-level upsert idempotency). The class doc comment (lines 6-12) is explicit that this
is narrower than upstream collector-side validation and only confirms contract shape, not
market-data correctness.

## 8. Deployment (`railway.toml:1-24`, `docker-compose.yml:1-22`, `.env.example:1-23`)

- `railway.toml` declares two Railway services: `gateway` (`command = "npm run
start:prod"`, `NODE_ENV=production`, `PORT=3000` — lines 13-19) and a managed `redis`
  plan (`hobby` tier, lines 21-24). The header comment (lines 1-8) explicitly notes this is
  a **single-service deployment** — HTTP ingest and the Bull consumer run in one Nest
  process — and contrasts it with a 2-service split (separate gateway/worker Railway
  services) that a hypothetical build doc §9.1 describes for larger scale; the comment says
  to revisit the split "only if real load justifies it," i.e. don't copy the split
  pre-emptively for new services without a load-driven reason.
- `docker-compose.yml` spins up local-only Postgres 15 + Redis 7 for manual/integration
  checks — the header comment (lines 1-3) notes CI does **not** use this; Jest specs mock
  Prisma/Bull instead, matching the root repo's convention (relevant to Session 0-5's
  `docker-compose.dev.yml`, which will need to be broader — Postgres, Redis, **and**
  Next.js dev — than this service-local file).
- `.env.example` enumerates the required vars: `PORT`, `REDIS_HOST`/`REDIS_PORT`/
  `REDIS_PASSWORD`, `DATABASE_URL` (explicitly the **same** Postgres as the root app, line
  10-12 comment), `API_KEYS` (comma-separated, one per sender), `RATE_LIMIT_MAX`,
  `ALLOWED_ORIGINS` (placeholder — line 21 notes callers are server-side only today). This
  is the starting checklist for Session 0-4's per-service secret matrix.

## 9. Bootstrap (`src/main.ts:1-32`)

Standard NestJS bootstrap with three middleware layers applied in `main.ts` rather than as
Nest modules: `helmet()` (line 12), CORS from a comma-split `ALLOWED_ORIGINS` env var
falling back to `'*'` (lines 13-15), `compression()` (line 16). A single global
`ValidationPipe` (lines 18-25) with `whitelist: true`, `forbidNonWhitelisted: true`,
`transform: true`, and implicit type conversion enabled — this is what turns the DTO's
class-validator decorators into an enforced request-shape contract at the framework edge.

---

## Findings (plan/inventory discrepancies — flagged per this session's CONTRACT-variant rules)

- **NestJS major version mismatch:** plan §2 step 0.1 describes `railway-gateway/` as
  "NestJS 11 on Railway." The installed version is **NestJS 10**
  (`package.json:21,23,24,36,37` — `@nestjs/common`, `@nestjs/core`,
  `@nestjs/platform-express`, `@nestjs/cli`, `@nestjs/testing` all pinned `^10.4.15`), not 11. This matters because F2 (this session) confirms `@nestjs/core@11.1.28` exists and is
  the pin target for new services — so new services (`operation-service`, `money-service`)
  should target NestJS 11 fresh, they do **not** inherit NestJS 10 by copying this
  reference pattern's dependency versions, only its code shape. Recommend the plan's
  "NestJS 11" framing be corrected to describe the _target_ version for new services, not
  `railway-gateway`'s current version.
- **Prisma version, cross-referenced with F19 (Decision Log):** `railway-gateway`'s
  `prisma`/`@prisma/client` are `^6.19.2` (`package.json:26,44`), matching the root app —
  consistent with this session's F19 Decision Log finding that the actual Prisma jump is
  6.19.2→7.8.0, not 5→7.8.0 as plan §2 step 0.6 states.

## What's directly copyable vs. pipeline-specific

| Pattern                                      | Copy as-is                | Adapt                                                                |
| -------------------------------------------- | ------------------------- | -------------------------------------------------------------------- |
| `PrismaModule`/`PrismaService` (§3)          | Yes — verbatim            | Point at split schema (Phase 2)                                      |
| Global `ThrottlerGuard` via `APP_GUARD` (§2) | Yes                       | Swap to Redis storage if multi-instance                              |
| Health check fan-out shape (§5)              | Yes — pattern             | Swap DB/queue-specific sub-checks per service                        |
| `ApiKeyGuard` (§4)                           | No                        | Service-to-service only; user auth is `JwtAuthGuard` (Phase 3)       |
| BullMQ jobId = natural key (§6)              | Yes — pattern             | Per-domain key choice                                                |
| Single-service `railway.toml` (§8)           | Yes, until load-justified | Split gateway/worker only if real load demands it                    |
| Generate-only Prisma schema (§3)             | Yes — pattern             | Must byte-match the schema it mirrors; no automated check exists yet |
