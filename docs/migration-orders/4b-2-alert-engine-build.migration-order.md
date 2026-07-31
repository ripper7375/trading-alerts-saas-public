# Migration Order: Session 4B-2 — Alert Engine Build

> Migration Order for Session **4B-2** (Alert Engine Migration — BUILD).
> Variant: **PORT** (Creativity Dial: **LOW** — behavior preservation is the deliverable) · **Status:** PRE-DRAFT
> Target Service: `operation-service` (worker process & execution services).

**Session:** 4B-2 (BUILD) — cutover is Session 4B-3
**Phase / plan section:** Phase 4B Step 2 — Alert Engine & Execution Services Migration
**Target service:** `operation-service`
**Contract:** Redis Pub/Sub events (`PriceEvent`, `alerts:changed`, `alerts:fired`), BullMQ queue (`op.alerts.fire`), shared package `@trading-alerts/types` (geometry math & Zod schemas).
**Flags touched:** `MIGRATE_ALERT_ENGINE` (default `false`)
**Generated:** 2026-07-31 (PRE-DRAFTed at Session 4B-1's close)
**Estimated session time:** ~3.5h

---

## Entry criteria

- [ ] Session 4B-1 (`@trading-alerts/types` package & geometry hoist, F9) complete and verified. **Session 4B-1 CONFIRMED and closed 2026-07-31** — re-verify live at this session's own CONFIRM, don't just trust this note.
- [ ] `operation-service` skeleton healthy (`/health` returns 200).
- [ ] Redis connection available and verified for `operation-service`.
- [ ] File inventory below re-verified against live codebase (paths + line counts).
- [ ] **NEW, carried forward from Session 4B-1's own Deviations/Waiting-on #79:** `@trading-alerts/types` is proven to resolve for `operation-service` at compile time and runtime **locally only**. `operation-service`'s only working Railway deploy path (`railway up --path-as-root --service operation-service`, no connected GitHub source — `LESSONS-LEARNED.md` L23/L38) uploads a flattened archive of ONLY the `operation-service/` subdirectory, which will almost certainly NOT include the sibling `packages/types` directory the `file:../packages/types` dependency needs. This session is the first to actually import the package from `operation-service`'s live alert-engine source — verify this survives a real deploy (or resolve it: connect a GitHub source for `operation-service`, or vendor/copy `packages/types/dist` into `operation-service`'s own tree as a build step) BEFORE assuming any of this session's ported code will run in production.

---

## Integration points

- **In:** MT5 / Gateway Redis price feed (`PriceEvent`), `alerts:changed` invalidation channel.
- **Out:** Prisma non-market database writes (`Alert`, `Notification`), Redis `alerts:fired` publish channel (consumed by monolith Socket.IO bridge until 4B-17).
- **Owns:** BullMQ queue `op.alerts.fire` (exactly-one-consumer execution queue).

---

## Architectural Summary & Port Strategy

The monolith Alert Engine consists of two major sub-systems:

1. **Periodic Poll/Check Engine** (`lib/jobs/alert-checker.ts`, `lib/jobs/queue.ts`, `lib/validations/alert.ts`):
   - Periodically checks active alerts against live market price data (Gateway `market_data_v6` for XAUUSD, Flask MT5 API for other symbols).
   - Validates alert conditions using Zod schemas from `@trading-alerts/types`.
   - Updates alert state (`isActive: false`, `lastTriggered`, `triggerCount`).
2. **Real-time Event-Driven Alert Engine** (`lib/alert-engine/*`):
   - Modular evaluator core (`types.ts`, `detect.ts`, `state.ts`, `watches.ts`, `evaluator.ts`, `dispatcher.ts`, `queue.ts`, `notify-bridge.ts`, `worker.ts`).
   - Uses `levelsForMark` imported cleanly from `@trading-alerts/types` (no math forking!).

In Session 4B-2, we port both sub-systems into `operation-service` as an `@Injectable()` NestJS domain module (`AlertEngineModule`) and standalone worker entrypoint (`main-worker.ts`), while preserving exact calculation invariants and data structures.

---

## File Port Order

Dependency order: schema mirror → pure/leaf modules → stateful adapters → orchestration → NestJS services & controllers → test suites.

### Step 0: Schema Mirroring (Prisma)

- Mirror `Alert`, `Notification`, `AlertNotification`, and `MarketDataV6` models additively into `operation-service/prisma/schema.prisma`.
- Run `npx prisma generate` in `operation-service`. (Zero DB migrations, zero production DB touch).
- **Commit:** `schema(operation-service): mirror Alert and Notification Prisma models additively`

### File 1/13

- **SOURCE:** `@trading-alerts/types` / `lib/validations/alert.ts` (163 lines)
- **TARGET:** `operation-service/src/alert-engine/validations/alert.ts`
- **Kind:** re-export / module wrapper for `@trading-alerts/types` validation schemas.
- **Commit:** `migrate(alert-engine): wire alert validation schemas from shared package`

### File 2/13

- **SOURCE:** `@trading-alerts/types` / `lib/alert-engine/types.ts` (48 lines)
- **TARGET:** `operation-service/src/alert-engine/types.ts`
- **Kind:** re-export / module wrapper for `@trading-alerts/types` core types.
- **Commit:** `migrate(alert-engine): wire alert-engine core types from shared package`

### File 3/13

- **SOURCE:** `lib/alert-engine/detect.ts` (32 lines)
- **TARGET:** `operation-service/src/alert-engine/detect.ts`
- **Kind:** pure port (cross_up / cross_down / touch detection logic).
- **Invariants:** Cross detection requires close crossing; intrabar touch fires via 'either'.
- **Parity proof:** Port `__tests__/alert-engine/detect.test.ts` unchanged; green.
- **Commit:** `migrate(alert-engine): port detect pure math module with tests`

### File 4/13

- **SOURCE:** `lib/alert-engine/state.ts` (81 lines)
- **TARGET:** `operation-service/src/alert-engine/state.ts`
- **Kind:** port + adapt (Redis state store & in-memory fallback).
- **Commit:** `migrate(alert-engine): port alert state store abstraction`

### File 5/13

- **SOURCE:** `lib/alert-engine/watches.ts` (62 lines)
- **TARGET:** `operation-service/src/alert-engine/watches.ts`
- **Kind:** port + adapt — imports `levelsForMark` from `@trading-alerts/types` (from 4B-1).
- **Invariants:** Geometry math imported from shared package. Zero math duplication!
- **Parity proof:** Ported `watches.test.ts` assertions green.
- **Commit:** `migrate(alert-engine): port alert watches evaluation using shared geometry`

### File 6/13

- **SOURCE:** `lib/alert-engine/evaluator.ts` (66 lines)
- **TARGET:** `operation-service/src/alert-engine/evaluator.ts`
- **Kind:** pure port (pure orchestration with injected dependencies).
- **Commit:** `migrate(alert-engine): port alert evaluator module`

### File 7/13

- **SOURCE:** `lib/alert-engine/dispatcher.ts` (62 lines)
- **TARGET:** `operation-service/src/alert-engine/dispatcher.service.ts`
- **Kind:** port + adapt -> NestJS `@Injectable()` service.
- **Commit:** `migrate(alert-engine): port dispatcher service with Prisma and Redis DI`

### File 8/13

- **SOURCE:** `lib/alert-engine/queue.ts` (67 lines)
- **TARGET:** `operation-service/src/alert-engine/alert-queue.service.ts`
- **Kind:** port + adapt -> NestJS `@Injectable()` BullMQ wrapper (`op.alerts.fire`).
- **Commit:** `migrate(alert-engine): port BullMQ alert execution queue service`

### File 9/13

- **SOURCE:** `lib/jobs/alert-checker.ts` (332 lines)
- **TARGET:** `operation-service/src/alert-engine/alert-checker.service.ts`
- **Kind:** port + adapt -> NestJS `@Injectable()` Scheduled Service.
- **Commit:** `migrate(alert-engine): port alert checker service`

### File 10/13

- **SOURCE:** `lib/jobs/queue.ts` (154 lines)
- **TARGET:** `operation-service/src/alert-engine/alert-cron.scheduler.ts`
- **Kind:** port + adapt -> NestJS Cron Scheduler.
- **Commit:** `migrate(alert-engine): port alert cron scheduler`

### File 11/13

- **SOURCE:** `lib/alert-engine/notify-bridge.ts` (129 lines)
- **TARGET:** `operation-service/src/alert-engine/notify-bridge.service.ts`
- **Kind:** port + adapt (Publisher half only).
- **Commit:** `migrate(alert-engine): port notify-bridge publisher service`

### File 12/13

- **SOURCE:** `lib/alert-engine/worker.ts` (117 lines) & `scripts/alert-worker.ts` (29 lines)
- **TARGET:** `operation-service/src/alert-engine/alert-worker.service.ts` & `operation-service/src/main-worker.ts`
- **Kind:** port + adapt -> Standalone NestJS worker process entrypoint.
- **Commit:** `migrate(alert-engine): create AlertEngineModule and main-worker entrypoint`

### File 13/13

- **SOURCE:** `__tests__/alert-engine/*.test.ts`, `__tests__/lib/validations/alert.test.ts`, `__tests__/lib/jobs/alert-checker.test.ts`
- **TARGET:** `operation-service/test/alert-engine/*`
- **Kind:** pure port + new coverage for dispatcher, queue, worker.
- **Commit:** `migrate(alert-engine): port full alert engine test suite with dispatcher/queue coverage`

---

## Rules specific to this variant (PORT)

- Changing a ported test's assertion requires a written justification in Deviations.
- Wrong Prisma client = boundary violation (market vs non-market; role grants will bite).
- SOURCE files become **change-frozen (CC-F)** the moment shadow-run starts in 4B-3.
- This session (4B-2) is BUILD only — zero production traffic is cut over.

---

## Slice-level verification (done when)

- [ ] All ported alert engine test suites pass green in `operation-service`.
- [ ] `operation-service` builds cleanly via `npm run build` / `nest build`.
- [ ] `tsc --noEmit` clean across both monolith and `operation-service`.
- [ ] Monolith test suite remains 100% green (source files untouched).

---

## Cutover & rollback (next session's order — 4B-3 reference)

- **Mechanism:** Flip `MIGRATE_ALERT_ENGINE=true` feature flag on `operation-service` & monolith. Stop monolith background worker interval, enable NestJS alert worker process.
- **Rollback:** Flip `MIGRATE_ALERT_ENGINE=false` and re-enable monolith interval scheduler.

---

## Retire (after cutover proves stable)

- [ ] Delete monolith `lib/alert-engine/*`, `lib/jobs/alert-checker.ts`, `lib/jobs/queue.ts`.
- [ ] Update `docs/migration-orders/migration-cutover-table.md` and `CLAUDE.md`.

---

## Deviations

_(filled during execution — what/why/impact)_

---

## Known wrinkles / do-not-touch

1. **Socket.IO Server (`lib/websocket/server.ts`) Subscriber Bridge:** Stays on monolith web process until Session 4B-17 (F8 Realtime Architecture).
2. **Prisma Client Separation:** `Alert` and `Notification` models use non-market `prisma`, while `market_data_v6` queries use `marketPrisma`. Respect schema boundaries.
3. **`lib/api/index.ts`:** Do not touch even though alert endpoints appear in it (deferred to Phase 7).
4. **`@trading-alerts/types` Railway packaging (Session 4B-1, F9, Waiting-on #79):** proven locally
   (compile + runtime) only — see this order's own Entry Criteria for the real gap and options.
   Do not assume it "just works" on a real `operation-service` deploy without checking.

---

## Next-session handoff

Next session will be **Session 4B-3 (Alert Engine CUTOVER)** using `TEMPLATE-VERIFY-RETIRE.md`.
