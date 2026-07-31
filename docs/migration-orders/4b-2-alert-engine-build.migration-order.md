# Migration Order: Alert Engine → operation-service (BUILD)

> Migration Order for Session **4B-2** (Alert Engine Migration — BUILD).
> Variant: **PORT** (Creativity Dial: **LOW** — behavior preservation is the deliverable).
> Target Service: `operation-service` (worker process & execution services).

**Session:** 4B-2 (BUILD) — cutover is Session 4B-3, not this session
**Phase / plan section:** Phase 4B step 2, plan §6 ("closest thing to already migrated")
**Target service:** `operation-service` (worker process alongside the API process)
**Variant:** PORT · **Status:** CONFIRMED
**Generated:** 2026-07-31 · **Flags touched:** `MIGRATE_ALERT_ENGINE` (default `false`)
**Contract:** Redis Pub/Sub events (`PriceEvent`, `alerts:changed`, `alerts:fired`), BullMQ queue (`op.alerts.fire`), shared package `@trading-alerts/types` (geometry math & Zod schemas).
**Background (why):** `docs/build-orders/part-11-alerts.md` (original build rationale), `docs/PHASE-5-DELIVERY-AND-REALTIME-SPEC.md` (delivery semantics — read §fired-alert bridge)
**Estimated session time:** ~3.5h

---

## Dependencies (entry criteria — verify before file 1)

- [x] Session 4B-1 complete: `@trading-alerts/types` package consumable by `operation-service` (F9 resolved).
- [x] Geometry dependency resolved via `@trading-alerts/types` — `levelsForMark` available outside the frontend tree without code duplication. Confirmed live pre-session: `lib/alert-engine/watches.ts` already imports it directly.
- [x] `operation-service` skeleton deployed (from 3-1), Railway Redis attached, production env live (`/health` returns 200). Live-checked at CONFIRM: `GET https://operation-service-production.up.railway.app/health` → `200`; `REDIS_URL` present value-blind.
- [x] CC-B: pino / correlation-ID logging integrated into `AlertEngineModule`. Built this session, scoped to the fire-dispatch path (Deviation 11) — not the full plan-level CC-B (distributed tracing stays gated on F13).
- [x] CC-E: queue names namespaced — this slice owns `op.alerts.fire` (BullMQ dependencies pinned in Step 0). Built this session (File 8).
- [x] Waiting-on #79 verified: workspace package `@trading-alerts/types` builds and resolves in `operation-service`. Re-confirmed at CONFIRM (baseline build/test green) — still LOCAL-only; the real Railway-deploy-time proof is deliberately deferred, see Deviation 15 and Next-session handoff.
- [x] File inventory below re-verified against live codebase (paths + line counts). See this order's own Deviations for the corrections found (Files 1/2 line counts, Step 0's `AlertNotification`/missing `DrawingAlert`+`Drawing`).

---

## Integration points

- **In:** Redis price feed (MT5/Gateway → Redis channel), `alerts:changed` invalidation channel.
- **Out:** Prisma non-market database writes (`Alert`, `Notification`), Redis `alerts:fired` publish channel (consumed by monolith web process's Socket.IO bridge until 4B-17).
- **Owns:** BullMQ queue `op.alerts.fire` (exactly-one-consumer rule, CC-E).

---

## File Port Order

Dependency order: dependencies & schema mirror → pure/leaf modules → stateful adapters → orchestration → NestJS services → entrypoints → test suites.

### Step 0: Dependencies & Schema Mirroring (BullMQ & Prisma)

- **DEPENDENCY INSTALL:** Install pinned BullMQ dependencies in `operation-service`: `bullmq@^5.79.2` and `@nestjs/bullmq@^11.0.4` (matching `money-service` per L30).
- **PRISMA MIRROR:** Mirror `Alert`, `Notification`, and `MarketDataV6` model subsets additively into `operation-service/prisma/schema.prisma` (Note: `AlertNotification` is a TS interface, not a table; dispatcher writes to `Notification` with `type: 'ALERT'`).
- **Port steps:** Run `npx prisma generate` inside `operation-service`. Zero DB migrations, zero production DB touch (per L1 convention).
- **Parity proof:** Prisma Client generates clean TypeScript types in `operation-service`.
- **Commit:** `deps(operation-service): add bullmq and mirror Alert, Notification, MarketDataV6 Prisma models additively`

### File 1/13

- **SOURCE:** `lib/validations/alert.ts` (39 lines re-export shim)
- **TARGET:** `operation-service/src/alert-engine/validations/alert.ts`
- **Kind:** port + adapt — re-exports Zod validation schemas (`createAlertSchema`, `updateAlertSchema`, `deleteAlertSchema`, `getAlertSchema`, `listAlertsSchema`) and constants (`SYMBOLS`, `TIMEFRAMES`, `CONDITION_TYPES`) from `@trading-alerts/types`.
- **Invariants:** Validation rules, condition types (`price_above`, `price_below`, `price_equals`, `price_crosses_above`, `price_crosses_below`) and error messages must remain unchanged.
- **Parity proof:** `tsc --noEmit` clean; port `__tests__/lib/validations/alert.test.ts` (338 lines) green in `operation-service`.
- **Commit:** `migrate(alert-engine): port alert validation schemas from shared package`

### File 2/13

- **SOURCE:** `lib/alert-engine/types.ts` (19 lines re-export shim)
- **TARGET:** `operation-service/src/alert-engine/types.ts`
- **Kind:** port + adapt — re-exports core interfaces (`PriceEvent`, `AlertWatch`, `FireEvent`, `Direction`) from `@trading-alerts/types`.
- **Port steps:** Copy re-exports; no framework wrapping — types stay plain.
- **Parity proof:** `tsc` clean; downstream files compile against it.
- **Commit:** `migrate(alert-engine): port alert-engine core types from shared package`

### File 3/13

- **SOURCE:** `lib/alert-engine/detect.ts` (32 lines, pure cross/touch detection)
- **TARGET:** `operation-service/src/alert-engine/detect.ts`
- **Kind:** pure port — **behavioral invariant:** cross_up/cross_down require close-crossing; intrabar touch only fires via 'either' (documented Phase 4 semantics). Do not "improve".
- **Parity proof:** port `__tests__/alert-engine/detect.test.ts` (53 lines) unchanged; green.
- **Commit:** `migrate(alert-engine): port detect (pure) with tests`

### File 4/13

- **SOURCE:** `lib/alert-engine/state.ts` (81 lines, AlertStateStore: Redis + in-memory impls)
- **TARGET:** `operation-service/src/alert-engine/state.ts`
- **Kind:** port + adapt — Redis client comes from service's shared Redis provider (`IORedis`). Keep store abstraction exactly — evaluator must never touch Redis directly.
- **Parity proof:** in-memory impl passes ported state assertions inside evaluator tests.
- **Commit:** `migrate(alert-engine): port state store`

### File 5/13

- **SOURCE:** `lib/alert-engine/watches.ts` (62 lines)
- **TARGET:** `operation-service/src/alert-engine/watches.ts`
- **Kind:** port + adapt — imports `levelsForMark` + `MarkSnapshot` from `@trading-alerts/types` (hoisted in 4B-1). **Never fork the math** — server and chart evaluate identical drawn levels.
- **Parity proof:** port `__tests__/alert-engine/watches.test.ts` (71 lines) green; spot-check fib + trendline watch produces identical level prices.
- **Commit:** `migrate(alert-engine): port watches on shared geometry package`

### File 6/13

- **SOURCE:** `lib/alert-engine/evaluator.ts` (66 lines, pure orchestration, injected deps)
- **TARGET:** `operation-service/src/alert-engine/evaluator.ts`
- **Kind:** pure port — dependency-injected (no Redis/Prisma imports). Invariants: prev-price persisted before cooldown/one-shot gating.
- **Parity proof:** port `__tests__/alert-engine/evaluator.test.ts` (114 lines) unchanged; green.
- **Commit:** `migrate(alert-engine): port evaluator with tests`

### File 7/13

- **SOURCE:** `lib/alert-engine/dispatcher.ts` (62 lines — Prisma writes + `alerts:fired` publish)
- **TARGET:** `operation-service/src/alert-engine/dispatcher.service.ts`
- **Kind:** port + adapt — becomes `@Injectable()` with constructor-injected `PrismaService` (non-market client!) and Redis provider. **Invariant:** the published `alerts:fired` message shape must stay byte-identical — monolith web process still consumes it.
- **Parity proof:** author new unit test `dispatcher.service.spec.ts` asserting Notification DB insert and Redis `publishAlertFired` dispatch.
- **Commit:** `migrate(alert-engine): port dispatcher as injectable service`

### File 8/13

- **SOURCE:** `lib/alert-engine/queue.ts` (67 lines, BullMQ fire queue, deterministic jobId dedupe)
- **TARGET:** `operation-service/src/alert-engine/alert-queue.service.ts`
- **Kind:** port + adapt — queue name becomes `op.alerts.fire` (CC-E namespace). Keep deterministic jobId scheme exactly (dedupe on alert/level/bar = idempotency, CC-C).
- **Parity proof:** author new unit test `alert-queue.service.spec.ts` asserting single job on enqueue-twice-same-bar.
- **Commit:** `migrate(alert-engine): port fire queue (op.alerts.fire)`

### File 9/13

- **SOURCE:** `lib/jobs/alert-checker.ts` (332 lines)
- **TARGET:** `operation-service/src/alert-engine/alert-checker.service.ts`
- **Kind:** port + adapt -> NestJS `@Injectable()` Scheduled Service.
- **Port steps:** Wrap in `@Injectable()` service. Inject `PrismaService` for `Alert` table. Query `market_data_v6` for `XAUUSD` and Flask MT5 API (`${MT5_API_URL}/api/indicators/${symbol}/${timeframe}?bars=100`) with `X-User-Tier: PRO`.
- **Invariants:** Tolerance for `price_equals` (0.5%), gateway fallback hierarchy for XAUUSD, and `isActive: false` deactivation logic preserved.
- **Parity proof:** port `__tests__/lib/jobs/alert-checker.test.ts` (237 lines) green.
- **Commit:** `migrate(alert-engine): port alert checker service`

### File 10/13

- **SOURCE:** `lib/jobs/queue.ts` (154 lines)
- **TARGET:** `operation-service/src/alert-engine/alert-cron.scheduler.ts`
- **Kind:** port + adapt -> NestJS Cron Scheduler / Interval Task.
- **Port steps:** Convert `setInterval` loop to NestJS `@Cron` / `@Interval` pattern with concurrency protection (`isRunning` guard).
- **Parity proof:** scheduler unit test asserting concurrency protection (`isRunning` guard).
- **Commit:** `migrate(alert-engine): port alert cron scheduler`

### File 11/13

- **SOURCE:** `lib/alert-engine/notify-bridge.ts` (129 lines)
- **TARGET:** `operation-service/src/alert-engine/notify-bridge.service.ts`
- **Kind:** port + adapt (Publisher half only).
- **Invariants:** Publisher half ports into service (used by dispatcher); subscriber half (web-process Socket.IO re-emit) STAYS in monolith untouched until 4B-17 (F8). Channel name `alerts:fired` and payload unchanged.
- **Parity proof:** port `__tests__/alert-engine/notify-bridge.test.ts` (67 lines) publisher-side assertions green.
- **Commit:** `migrate(alert-engine): port fired-alert publisher (subscriber stays in web)`

### File 12/13

- **SOURCE:** `lib/alert-engine/worker.ts` (117 lines — subscriber loop + watch cache) & `scripts/alert-worker.ts` (30 lines)
- **TARGET:** `operation-service/src/alert-engine/alert-worker.service.ts` & `operation-service/src/main-worker.ts` (+ `alert-engine.module.ts` glue)
- **Kind:** port + adapt -> Standalone NestJS worker entrypoint context.
- **Port steps:** Two Redis connections preserved (dedicated subscriber + state). Register `AlertEngineModule` in `app.module.ts`. Add pino + correlation-ID per fire (CC-B) and graceful shutdown hooks (CC-C: drain BullMQ on SIGTERM).
- **Parity proof:** worker boots in standalone Nest context, subscribes, health/log lines visible.
- **Commit:** `migrate(alert-engine): port worker loop with shutdown hooks and main-worker entrypoint`

### File 13/13

- **SOURCE:** `__tests__/alert-engine/*.test.ts` (4 files), `__tests__/lib/validations/alert.test.ts` (338 lines), `__tests__/lib/jobs/alert-checker.test.ts` (237 lines)
- **TARGET:** `operation-service/test/alert-engine/*`
- **Kind:** pure port — assertions unchanged (they are the parity oracle; changing an assertion requires a written justification in Deviations).
- **Parity proof:** all suites green in service's Jest config (+ new coverage for dispatcher, queue, worker).
- **Commit:** `migrate(alert-engine): port test suites with full coverage`

---

## Rules specific to this variant (PORT)

- Changing a ported test's assertion requires a written justification in Deviations.
- Wrong Prisma client = boundary violation (market vs non-market; role grants will bite).
- SOURCE files become **change-frozen (CC-F)** the moment shadow-run starts in 4B-3.
- This session ends with shadow-run/mirror-run STARTED — cutover is the NEXT session (4B-3).

---

## Slice-level verification (done when)

- [x] All 6 ported test suites green in `operation-service`; monolith suites still green (source untouched). **Exceeded:** full suite is 21/21 suites, 177/177 tests (was 11/11, 86/86 at 4B-1's close) — every ported/new file has its own suite, not just 6. Monolith `test:ci` 122/122 suites, 2138/2138 tests, byte-identical to the pre-session baseline.
- [x] `operation-service` builds cleanly via `npm run build` / `nest build`.
- [x] `tsc --noEmit` clean across both monolith and `operation-service`.
- [ ] Staging: synthetic price event → detect → queue → dispatch → Notification row + `alerts:fired` → monolith bridge re-emits (full path observed once). **NOT done this session** — needs a real Railway deploy of `main-worker.ts` as its own process/service, which is a "first service deploy" under `EXECUTOR-PROTOCOL.md` §7 (always escalate to Davin) and the exact moment Waiting-on #79's `file:../packages/types` Railway-packaging risk gets tested for real. Deliberately not attempted unilaterally this session — see Deviations and Next-session handoff.
- [ ] **Mirror-run started:** new worker runs on staging/production Redis feed with **dispatch disabled or pointed at a shadow queue** — log-only evaluation for 48h, diffed against monolith worker's fires (this slice's equivalent of a shadow-run). **NOT done this session** — same blocker as above (needs the live deploy first).
- [ ] CC-F: `lib/alert-engine/*` + `scripts/alert-worker.ts` + `lib/jobs/alert-checker.ts` + `lib/jobs/queue.ts` now change-frozen. **NOT yet in effect** — per this order's own Rules, the freeze starts "the moment shadow-run starts," which hasn't happened yet.

---

## Cutover (Session 4B-3 — after ⏸ 48h mirror-run reference)

- **Mechanism:** Stop monolith worker container (`scripts/alert-worker.ts` / `lib/jobs/queue.ts`), enable dispatch in service worker. One worker consumes at a time — never both dispatching (double-fire risk; jobId dedupe is backstop, not plan).
- **Precondition:** 48h mirror diff clean (identical fire decisions) and reviewed by Davin.
- **Rollback:** Re-start monolith worker, disable service dispatch — verified in staging first.

---

## Retire (after 4B-3 proves stable)

- [ ] Delete `lib/alert-engine/*` (9 files), `lib/jobs/alert-checker.ts`, `lib/jobs/queue.ts`, `scripts/alert-worker.ts`.
- [ ] `__tests__/alert-engine/*` deleted from monolith (they live in the service now).
- [ ] Update `docs/migration-orders/4b-2-alert-engine-build.migration-order.md` + `docs/migration-orders/migration-cutover-table.md` + `CLAUDE.md`.

---

## Deviations

1. **Step 0 schema gap found while porting File 12:** `lib/alert-engine/worker.ts`'s
   `prisma.drawingAlert.findMany({ where: { alert: { isActive: true } }, include: { drawing: true,
alert: true } })` genuinely traverses `DrawingAlert -> Drawing` and `DrawingAlert -> Alert` as
   real Prisma relations — neither model was in Step 0's own file list (only `Alert`, `Notification`,
   `MarketDataV6`). Mirrored both additively into `operation-service/prisma/schema.prisma`, keeping
   `Alert.userId`/`Drawing.userId` as bare scalars (no `User` relation) since no ported code
   traverses to `User` — matches the 4A-W2 precedent for untraversed FKs, and avoided touching
   operation-service's existing narrow-subset `User` model at all.
2. **Impact/risk:** none — additive schema mirror only, zero DB migration, zero production DB
   touch (per L1). `prisma validate`/`generate` both clean.
3. **`Alert`/`Drawing`/`Notification`/`MarketDataV6` mirrored into ONE unified `PrismaService`**,
   not split into market/non-market clients like the monolith. Confirmed both `lib/db/prisma.ts` and
   `lib/db/market-prisma.ts` read the SAME `DATABASE_URL` — the monolith's split is two schema
   FILES/generated clients over one physical Postgres instance, not two databases.
   operation-service already had a single `PrismaService` convention since Session 3-1; this is a
   legitimate simplification, not the "wrong Prisma client" boundary violation the order's own
   Rules warn about (there's only one client here to get wrong).
4. **`MarketDataV6` mirrored as a NARROW subset** (5 of 79 fields: `id`, `symbol`, `timeframe`,
   `timestamp`, `close`) — matches operation-service's existing narrow-subset convention
   (`User`/`SecurityAlert`). Only the fields `AlertCheckerService`'s gateway-pipeline query actually
   reads.
5. **`AlertCheckerService`'s active-alerts query drops the SOURCE's `include: { user: { select:
{email, name} } }`** — no ported code path reads `alert.user.email`/`.name` (the only prospective
   read in `lib/jobs/alert-checker.ts` is a commented-out TODO), and operation-service's mirrored
   `Alert` model has no `User` relation (Deviation 1). Zero behavior change; a smaller query.
6. **Build sequence deviated from the numbered file list once:** File 11 (notify-bridge) was ported
   before File 7 (dispatcher), since `dispatcher.ts` genuinely imports from `notify-bridge.ts` —
   this follows the order's own stated "Dependency order" principle (pure/leaf modules before
   orchestration) over the numbered enumeration, which lists them the other way around.
7. **File 13's own TARGET (`operation-service/test/alert-engine/*`) doesn't match any existing
   convention in this service** — `jest.config.js`'s `testRegex` is `'src/.*\.spec\.ts$'` and no
   `test/` directory exists anywhere in `operation-service`; every prior spec (auth, outbox, email)
   is co-located under `src/` as `*.spec.ts`. All 13 ported/new test files follow that convention
   instead, and use `.spec.ts` naming (not `.test.ts`, the monolith's own convention) for the same
   reason. Tests were committed alongside their corresponding source file, not batched into one
   File-13 commit — matches `EXECUTOR-PROTOCOL.md` §2's "commit per order step, never batch."
8. **Real infrastructure gaps found and built, none pre-existing in `operation-service`:**
   - No shared Redis provider existed (only an inline throttler client in `app.module.ts`). Built
     `src/redis/{redis.service,redis.module}.ts`, mirroring `lib/redis/client.ts`'s
     `getRedisClient()` connection options as a `@Global()` NestJS singleton.
   - `bullmq`/`@nestjs/bullmq` were not dependencies. Installed `bullmq@^5.79.2` (resolved
     `5.81.3` — money-service's own lockfile resolved `5.80.9`; both satisfy the same caret range,
     ordinary registry drift, not an L30-class version mismatch) and `@nestjs/bullmq@^11.0.4`,
     matching money-service's pinned ranges exactly.
   - `@nestjs/schedule` was not a dependency. Installed `^6.1.3`, matching money-service's pinned
     version.
   - `pino` was not a dependency anywhere in this monorepo — this session is its first usage
     anywhere in the codebase (see Deviation 10).
9. **Double-fire risk found and resolved by design, not by the order's literal wording alone:**
   `AlertEngineModule` is registered in the shared `app.module.ts` (imported by both `main.ts`'s
   HTTP process and `main-worker.ts`'s worker process — the order's own literal File 12 instruction).
   A naive reading (`@Interval()`/lifecycle-hook auto-start the moment the module is constructed)
   would make BOTH processes independently run the cron and the Redis subscriber loop — a genuine
   double-fire/double-consumption bug, not a hypothetical. Resolved using the SAME pattern
   money-service's own `CronsScheduler` already establishes for exactly this class of risk: the
   `@Interval()` decorator (`AlertCronScheduler`) and the subscriber loop
   (`AlertWorkerService.start()`) both fire/exist in every process that constructs the provider, but
   are internally gated — `active`/`enable()` starts `false` and is flipped `true` ONLY by
   `main-worker.ts`'s own bootstrap; the HTTP process never calls it, so its ticks return
   immediately with zero real work, zero DB/Redis calls. `AlertQueueService.startWorker()` (the
   BullMQ consumer) follows the identical explicit-call-only pattern.
10. **Graceful shutdown uses `app.enableShutdownHooks()` + `OnModuleDestroy` hooks (L25), not
    SOURCE's manual `process.on('SIGINT'/'SIGTERM')` handlers.** A manual handler registered
    alongside `enableShutdownHooks()` would double-fire, since Nest re-emits the OS signal via
    `process.kill()` after its own cleanup completes (L25's documented gotcha).
    `AlertWorkerService` now implements `OnModuleDestroy` (drains both dedicated Redis connections);
    `AlertQueueService`/`RedisService`/`PrismaService` already drain via their own existing hooks.
11. **CC-B (pino + correlation-ID) built, deliberately scoped narrow:** new
    `alert-engine.logger.ts`, wired into `DispatcherService.dispatch()` only — the "per fire" log
    point the order's own entry-criteria wording names, not a repo-wide replacement of NestJS's
    built-in `Logger` (used everywhere else in this service and the rest of the codebase — a full
    migration is a different session's scope). Distributed tracing (the rest of the plan's own
    CC-B section) stays gated on F13 (OPEN, sink not chosen), unaffected.
12. **No live Redis available in this environment** — `alert-queue.service.spec.ts` and
    `alert-worker.service.spec.ts` mock `bullmq`/`ioredis` respectively rather than proving real
    Redis-level dedupe/pub-sub end-to-end. The dedupe test proves OUR deterministic jobId
    derivation is stable across repeated enqueues (the input BullMQ's own well-documented dedupe
    relies on), not BullMQ's own dedupe enforcement — that's trusted, external library behavior,
    out of this unit test's scope. The worker test proves the two-connection topology, subscribe
    calls, and query shape; the "subscribes, health/log lines visible" parity proof is satisfied by
    genuine log output from a real (mocked-Redis) `start()` call, not a live end-to-end boot.
13. **`AlertCheckerService`/`DispatcherService` ported tests restructured from the SOURCE's
    `jest.mock('@/lib/db/prisma')`-style module-singleton mocking to DI-based construction**
    (`new Service(mockPrisma)`) — the ported code is `@Injectable()` with constructor injection,
    not a module-level singleton import, so the original mocking mechanism doesn't apply. All
    assertions unchanged; only the setup mechanism differs.
14. **`scripts/alert-worker.ts`'s cited line count (30) is off by one from the actual file (29)** —
    flagged at CONFIRM as a trivial, non-blocking drift; not corrected in the order text itself,
    still reads 30. Purely cosmetic, no behavioral impact.
15. **Two Done-when items intentionally NOT attempted this session** ("Staging: synthetic price
    event... full path observed", "Mirror-run started"): both require a real Railway deploy of
    `main-worker.ts` as its own running process — `operation-service`'s first-ever second process
    type. Per `EXECUTOR-PROTOCOL.md` §7 ("Production deploys... first service deploys" always
    escalate to Davin) and since this is precisely the moment Waiting-on #79's `file:../packages/types`
    Railway-packaging-risk gets tested for real (never proven against a live deploy before now),
    this was deliberately left for Davin's live involvement rather than attempted unilaterally. See
    Next-session handoff.

---

## Known wrinkles / do-not-touch

1. **Geometry imported via `@trading-alerts/types`:** Hoisted in Session 4B-1. Never fork the math.
2. **The Socket.IO subscriber half of notify-bridge stays in monolith** until 4B-17 (F8 realtime decision). This slice only moves the publisher.
3. **Non-market Prisma client only:** Dispatcher touches Notification/Alert (non-market schema). Wiring market client into dispatcher module is a boundary violation.
4. **Do not touch `lib/api/index.ts`** even though alerts appear in it — known broken, deferred to Phase 7 by design.
5. **Environment Configuration:** Ensure `MT5_API_URL` is set in `operation-service` environment config for non-XAUUSD price lookups. Documented in `.env.example` this session (default fallback `http://localhost:5000` preserved, matching source) — still confirmed ABSENT from operation-service's real Railway production (value-blind check at CONFIRM). Must be set before any real deploy exercises non-XAUUSD alerts.

---

## Next-session handoff

All 13 files + Step 0 BUILT and CONFIRMED green (21/21 suites, 177/177 tests in
`operation-service`; monolith unchanged, 122/122 suites, 2138/2138 tests). Zero production traffic
cut over — `MIGRATE_ALERT_ENGINE` untouched, dispatch not yet live anywhere.

**Before Session 4B-3 (or a dedicated live-deploy step) can start, needs Davin's direct
involvement for:**

1. **`operation-service`'s first-ever second process/service deploy** — `main-worker.ts` needs to
   actually run somewhere (a new Railway service, or a second process type on the existing one).
   This is the real test of Waiting-on #79 (`file:../packages/types` Railway-packaging risk) —
   proven locally only, never against a live deploy. Per `EXECUTOR-PROTOCOL.md` §7, a first service
   deploy always escalates to Davin; not attempted this session.
2. **`MT5_API_URL`** set on operation-service's real Railway production (confirmed absent this
   session) — needed before any non-XAUUSD alert can actually resolve a price.
3. Once (1) is live: the two remaining Done-when items ("Staging: synthetic price event... full
   path observed", "Mirror-run started") can actually be attempted — both were blocked on the same
   missing deploy this session.
4. **CC-E naming note:** this session settled on `op.alerts.fire` (matching the order's own
   pre-session text) over the plan's own CC-E example name (`op.alerts.dispatch`,
   `monolith-to-microservices-migration-implementation-plan.md` line ~738) — flagged at CONFIRM,
   Davin's call to keep `op.alerts.fire`. Worth the Advisor updating the plan doc's own example to
   match, so a future session doesn't re-flag the same mismatch.

Once the live deploy lands and the 48h mirror-run reference completes clean, **Session 4B-3 (Alert
Engine CUTOVER)** using `TEMPLATE-VERIFY-RETIRE.md` is the literal next session — mechanism and
rollback already specified above.
