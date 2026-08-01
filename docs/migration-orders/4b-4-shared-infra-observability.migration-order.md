# Migration Order: Shared Infrastructure & Observability (Session 4B-4)

> Migration Order for Session **4B-4** (Shared Infrastructure & Observability).
> Variant: **INFRA + CONTRACT (F13)** (Creativity Dial: **MEDIUM** — standard NestJS provider design & OTel SDK setup).
> Target Services: `operation-service` and `money-service`.

**Session:** 4B-4 · **Phase / plan section:** Phase 4B step 4, plan §CC-B & §CC-E
**Target services:** `operation-service` & `money-service`
**Variant:** INFRA + CONTRACT (F13) · **Status:** CONFIRMED
**Generated:** 2026-08-01 (Advisor upgrade from PRE-DRAFT, Davin APPROVED 2026-08-01, Executor CONFIRMED 2026-08-01)
**Flags touched:** **F13** (Observability / OpenTelemetry tracing backend — RESOLVED)
**Contract:** Standardized Pino structured log format (`level`, `timestamp`, `service`, `correlationId`, `traceId`, `spanId`), `x-correlation-id` HTTP header propagation, `CacheService` get/set/del/ttl key-prefix API, standardized `AllExceptionsFilter` error JSON schema.
**Estimated session time:** ~3.0h (under Option C)

---

## Entry criteria

- [x] Session 4B-3 CONFIRMED and closed (2026-08-01) — Slice 6 Alert Engine CUT-OVER & LIVE on Railway, monolith files retired, 118/118 test suites green.
- [x] **F13 (Observability/tracing backend) resolved** — Davin confirmed Option C (OTel SDK + OTLP Exporter + Pino Correlation Logging, F13 RESOLVED in DECISION-LOG.md).
- [x] Dependencies pre-checked against live codebase: `pino` ^9.14.0 confirmed present in `operation-service`, confirmed ABSENT in `money-service`; zero `@opentelemetry/*` packages in either service. All 6 pinned versions (Step 0) confirmed resolvable on the real npm registry (L30 check).
- [x] File inventory below verified against live codebase (`operation-service/src/` and `money-service/src/`) — CONFIRM found 2 small drift notes (both corrected below, non-blocking): (1) `money-service` has no `main-worker.ts` (single HTTP-process service) — Step 1's "both services" phrasing for `main-worker.ts` only applies to `operation-service`; (2) `operation-service/src/auth/auth-error.filter.ts` already exists (`@Catch(AuthError)`, narrowly scoped, not registered as a global `APP_FILTER`) — coexists with Step 6's new global `AllExceptionsFilter`, doesn't contradict the order's "neither service has an AllExceptionsFilter" claim.

CONFIRM baseline (2026-08-01): `operation-service` 21/21 suites/177/177 tests green, `tsc --noEmit` clean. `money-service` 59/59 suites/507/507 tests green (one transient flake on `prisma.shutdown.spec.ts` on a first run, passed clean on immediate re-run and in isolation — pre-existing L25 test fragility, unrelated to this order), `tsc --noEmit` clean. Monolith `tsc --noEmit` clean, zero source files touched since 4B-3's close. `enableShutdownHooks()` confirmed present in all 3 real entrypoints.

---

## What already exists (audited from live codebase)

1. **Logging:**
   - `operation-service/src/alert-engine/alert-engine.logger.ts`: narrow pino wrapper built at Session 4B-2 for alert dispatch correlation.
   - `money-service/src/common/logger.util.ts`: custom `console.log` wrapper (not pino, no correlation IDs).
   - _Gap:_ Neither service has a NestJS Pino logging provider or structured JSON correlation-ID logger attached across HTTP request lifecycles.

2. **Redis & Cache:**
   - `operation-service/src/redis/`: `@Global()` `RedisModule` & `RedisService` wrapping `ioredis` with retry strategy and graceful shutdown (`onModuleDestroy`).
   - `money-service`: no central `RedisModule` (raw `ioredis` created independently in `app.module.ts`, `idempotency.store.ts`).
   - _Gap:_ No `CacheService` abstraction (get/set/del/ttl/flushPattern) exists in either service; `money-service` lacks a unified `RedisModule`.

3. **Errors & Exception Filters:**
   - Both services rely on NestJS default exception formatting and global `ValidationPipe`.
   - _Gap:_ Neither service has an `AllExceptionsFilter` enforcing a unified error payload shape (`statusCode`, `message`, `error`, `timestamp`, `path`, `correlationId`) or logging 5xx stack traces with correlation IDs.

4. **Correlation-ID Middleware & Context:**
   - `alertEngineLogger` has `newFireCorrelationId()` scoped strictly to alert dispatch.
   - _Gap:_ Neither service has global `x-correlation-id` request middleware or `AsyncLocalStorage` correlation context.

5. **OpenTelemetry Tracing:**
   - No `@opentelemetry/*` dependencies exist in either service's `package.json`.
   - _Gap:_ No OTel SDK auto-instrumentation (HTTP, Prisma, Redis) initialized in `main.ts` / `main-worker.ts`.

---

## Invariants & Parity Proofs

1. **Zero Breaking Changes to Existing HTTP/Cron Endpoints:**
   All current routes (`/health`, `/outbox/events`, `/v1/stripe/*`, `/v1/affiliate/*`, etc.) must maintain byte-for-byte contract compatibility.
2. **Correlation ID Propagation:**
   Incoming `x-correlation-id` header must be preserved; if absent, a new `req_<uuid>` is generated and returned in response headers (`x-correlation-id`).
3. **Graceful Shutdown & Resource Leak Prevention (L25):**
   `app.enableShutdownHooks()` must remain active in both services. OTel SDK, Redis, and Pino loggers must clean up gracefully on `SIGTERM`/`SIGINT`.
4. **Environment Safety & Secrets (L17):**
   No hardcoded secrets or API tokens. OTel exporter endpoint configured via `OTEL_EXPORTER_OTLP_ENDPOINT`.

---

## Ordered Implementation Steps

### Step 0: Dependency Installation & Package Alignment (L30)

- **TARGET:** `money-service/package.json` and `operation-service/package.json`
- **Actions:**
  - `money-service`: Install `pino@^9.14.0` (matching `operation-service`), `@opentelemetry/sdk-node@^0.57.0`, `@opentelemetry/auto-instrumentations-node@^0.56.0`, `@opentelemetry/exporter-trace-otlp-http@^0.57.0`, `@opentelemetry/resources@^1.30.0`, `@opentelemetry/semantic-conventions@^1.30.0`.
  - `operation-service`: Install `@opentelemetry/sdk-node@^0.57.0`, `@opentelemetry/auto-instrumentations-node@^0.56.0`, `@opentelemetry/exporter-trace-otlp-http@^0.57.0`, `@opentelemetry/resources@^1.30.0`, `@opentelemetry/semantic-conventions@^1.30.0`.
- **Verification:** `npm ls pino` and `npm ls @opentelemetry/sdk-node` resolve without peer dependency warnings. `nest build` clean in both services.
- **Commit:** `deps(shared-infra): add pino to money-service and opentelemetry SDK to both microservices`

---

### Step 1: OpenTelemetry SDK Bootstrap Module (`otel.ts`)

- **NEW FILE:** `operation-service/src/otel.ts`
- **NEW FILE:** `money-service/src/otel.ts`
- **Actions:**
  - Implement `initOtel(serviceName: string)` using `@opentelemetry/sdk-node` `NodeSDK`.
  - Configure `getNodeAutoInstrumentations` for Express, HTTP, ioredis, and Prisma.
  - Set resource attributes (`service.name`: `OTEL_SERVICE_NAME ?? serviceName`, `service.version`: `0.1.0`).
  - Configure `OTLPTraceExporter` to read `process.env['OTEL_EXPORTER_OTLP_ENDPOINT']`. If unset, default to silent/console exporter without throwing.
  - Import `src/otel` at the very first line of `main.ts` in both services, and additionally `main-worker.ts` in `operation-service` (money-service has no `main-worker.ts` — single HTTP-process service, corrected at CONFIRM).
- **Verification:** `nest build` clean both services. Booting service logs `[OTel] Tracing initialized for <service-name>`.
- **Commit:** `feat(shared-infra): initialize opentelemetry SDK bootstrap in operation-service and money-service`

---

### Step 2: Unified Redis Module in `money-service` & `operation-service`

- **NEW FILE:** `money-service/src/redis/redis.service.ts`
- **NEW FILE:** `money-service/src/redis/redis.module.ts`
- **MODIFY:** `money-service/src/common/idempotency/idempotency.store.ts`
- **Actions:**
  - Create `@Global()` `RedisModule` & `RedisService` in `money-service` matching `operation-service`'s implementation (retry strategy, lazy connect, `onModuleDestroy` quit).
  - Update `IdempotencyStore` to inject `RedisService` rather than calling `new Redis(...)` directly.
  - Ensure `operation-service`'s existing `RedisModule` remains unchanged and exported.
- **Verification:** `money-service` test suite 59/59 green. `IdempotencyStore` unit tests pass clean.
- **Commit:** `refactor(money-service): promote RedisService to global module and refactor idempotency store`

---

### Step 3: Shared Pino Structured Logger (`LoggingModule` & `PinoLoggerService`)

- **NEW FILE:** `operation-service/src/common/logging/logging.service.ts`
- **NEW FILE:** `operation-service/src/common/logging/logging.module.ts`
- **NEW FILE:** `money-service/src/common/logging/logging.service.ts`
- **NEW FILE:** `money-service/src/common/logging/logging.module.ts`
- **MODIFY:** `operation-service/src/alert-engine/alert-engine.logger.ts`
- **MODIFY:** `money-service/src/common/logger.util.ts`
- **Actions:**
  - Build `PinoLoggerService` implementing NestJS `LoggerService`.
  - Automatically enrich every log payload with `service`, `timestamp`, `correlationId`, `traceId`, and `spanId` (from OTel trace context / `AsyncLocalStorage`).
  - Wire `LoggingModule` into `AppModule` of both services.
  - Update `alertEngineLogger` and `money-service` `logger.util.ts` shims to delegate to `PinoLoggerService` to maintain backward compatibility for existing callers.
- **Verification:** Service boot emits structured JSON log lines containing `service` and `timestamp`.
- **Commit:** `feat(shared-infra): implement PinoLoggerService with structured correlation & trace context`

---

### Step 4: Correlation-ID Request Middleware (`CorrelationIdMiddleware`)

- **NEW FILE:** `operation-service/src/common/middleware/correlation-id.middleware.ts`
- **NEW FILE:** `money-service/src/common/middleware/correlation-id.middleware.ts`
- **Actions:**
  - Build NestJS `CorrelationIdMiddleware` implementing `NestMiddleware`.
  - Extract `x-correlation-id` header from incoming Express request, or generate `req_<uuid>`.
  - Bind correlation ID to `AsyncLocalStorage` context.
  - Set response header `res.setHeader('x-correlation-id', correlationId)`.
  - Register middleware globally in `AppModule` / `main.ts` for all routes.
- **Verification:** `curl -i http://localhost:3001/health` and `http://localhost:3002/health` return header `x-correlation-id: req_...`.
- **Commit:** `feat(shared-infra): add global CorrelationIdMiddleware and header propagation`

---

### Step 5: Shared Cache Abstraction (`CacheModule` & `CacheService`)

- **NEW FILE:** `operation-service/src/cache/cache.service.ts`
- **NEW FILE:** `operation-service/src/cache/cache.module.ts`
- **NEW FILE:** `money-service/src/cache/cache.service.ts`
- **NEW FILE:** `money-service/src/cache/cache.module.ts`
- **Actions:**
  - Implement `@Global()` `CacheModule` and `@Injectable()` `CacheService`.
  - `CacheService` injects `RedisService` and exposes structured methods:
    - `get<T>(key: string): Promise<T | null>`
    - `set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>`
    - `del(key: string): Promise<void>`
    - `ttl(key: string): Promise<number>`
    - `flushPattern(pattern: string): Promise<number>`
  - Keys automatically prefixed with service namespace (`op:cache:` vs `money:cache:`).
  - Add unit tests for `CacheService` (`cache.service.spec.ts`) in both services.
- **Verification:** `cache.service.spec.ts` green in both services.
- **Commit:** `feat(shared-infra): implement shared CacheService abstraction over Redis`

---

### Step 6: Centralized Exception Filter (`AllExceptionsFilter`)

- **NEW FILE:** `operation-service/src/common/filters/all-exceptions.filter.ts`
- **NEW FILE:** `money-service/src/common/filters/all-exceptions.filter.ts`
- **Actions:**
  - Build `AllExceptionsFilter` implementing NestJS `ExceptionFilter`.
  - Intercept HTTP exceptions & unhandled errors, returning standard JSON response:
    ```json
    {
      "statusCode": 400,
      "message": "Validation failed",
      "error": "Bad Request",
      "timestamp": "2026-08-01T06:45:00.000Z",
      "path": "/v1/stripe/checkout",
      "correlationId": "req_..."
    }
    ```
  - Log 5xx errors as `logger.error` with stack trace & correlation ID; log 4xx errors as `logger.warn`.
  - Register as `APP_FILTER` in both services' `AppModule`.
- **Verification:** Triggering a 400 validation error or 404 route returns the unified JSON response carrying `correlationId`.
- **Commit:** `feat(shared-infra): register centralized AllExceptionsFilter across both services`

---

### Step 7: Secret Matrix & Verification Documentation

- **MODIFY:** `docs/secret-matrix.md`
- **Actions:**
  - Document optional OTel env vars:
    - `OTEL_EXPORTER_OTLP_ENDPOINT` (e.g. `http://localhost:4318/v1/traces` or SaaS endpoint)
    - `OTEL_SERVICE_NAME` (`operation-service` / `money-service`)
    - `OTEL_EXPORTER_OTLP_HEADERS` (optional API keys/headers)
- **Verification:** `docs/secret-matrix.md` updated without exposing real secrets (L17 compliant).
- **Commit:** `docs(secret-matrix): document OpenTelemetry OTLP configuration environment variables`

---

## Done when

- [x] F13 recorded in `DECISION-LOG.md` (Option C: OTel SDK with OTLP HTTP exporter + Pino correlation logging).
- [ ] Both services (`operation-service` & `money-service`) compile clean (`nest build` & `tsc --noEmit`).
- [ ] All unit and integration test suites green in `operation-service` (21/21) and `money-service` (59/59).
- [ ] Monolith untouched and 100% green (118/118 test suites).
- [ ] Structured Pino logger & `CorrelationIdMiddleware` active, returning `x-correlation-id` header.
- [ ] `CacheService` built and verified via unit tests in both services.
- [ ] `AllExceptionsFilter` active and producing standardized error response format.
- [ ] `docs/secret-matrix.md` updated for OTel variables.

---

## Rollback

All changes in this session are additive provider & middleware infrastructure. In case of issues, revert git commits (`git revert`). No database schema migrations or production cutovers are performed in this session.

---

## Deviations

_(filled during execution)_

---

## Next-session handoff

Session 4B-5 (Alerts CRUD API Port to `operation-service`).
