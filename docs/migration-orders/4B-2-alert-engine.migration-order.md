# Migration Order: Alert Engine → operation-service (WORKED EXAMPLE)

> Fully worked example of `TEMPLATE-PORT.md` (see `00-SKELETON-AND-RULES.md` for the shared
> rules, chain protocol, and Autonomy & Deviation clause — creativity dial **Low** for PORT
> sessions), for playbook Session **4B-2**. File inventory and line counts verified against
> the codebase on 2026-07-11 — **status: DRAFT until re-verified at session start**; if the
> source files changed, this order is stale.

**Session:** 4B-2 (BUILD) — cutover is Session 4B-3, not this session
**Phase / plan section:** Phase 4B step 1, plan §6 ("closest thing to already migrated")
**Target service:** operation-service (worker process alongside the API process)
**Contract:** none HTTP-facing — this slice's "contract" is its message interfaces:
Redis price feed in (`PriceEvent`), `alerts:changed` invalidation, `alerts:fired` pub out,
BullMQ fire queue. Treat `lib/alert-engine/types.ts` as the contract file.
**Background (why):** `docs/build-orders/part-11-alerts.md` (original build rationale),
`docs/PHASE-5-DELIVERY-AND-REALTIME-SPEC.md` (delivery semantics — read §fired-alert bridge)
**Flags touched:** none directly (F8 realtime belongs to 4B-17, but note the bridge
interaction below); depends on F9 resolved in 4B-1
**Estimated session time:** ~3–4h

---

## Dependencies (entry criteria — verify before file 1)

- [ ] 4B-1 complete: `@trading-alerts/types` package consumable by operation-service
- [ ] **Geometry dependency resolved (see Wrinkle #1)** — `levelsForMark` available outside
      the frontend tree
- [ ] operation-service skeleton deployed (from 3-1), Railway Redis attached, staging env live
- [ ] CC-B: pino + correlation-ID conventions available to tag fired-alert log lines
- [ ] CC-E: queue names namespaced — this slice owns `op.alerts.fire` (BullMQ)

## Integration points

- **In:** Redis price feed (MT5→Redis channel), `alerts:changed` invalidation channel
- **Out:** Prisma writes (Notification, Alert), Redis `alerts:fired` publish → consumed by
  the monolith web process's Socket.IO bridge (STAYS in the monolith until 4B-17)
- **Owns:** BullMQ queue `op.alerts.fire` (exactly-one-consumer rule, CC-E)

---

## File Port Order

Dependency order: pure/leaf modules → stateful adapters → orchestration → process entrypoint.

### File 1/11

- **SOURCE:** `lib/alert-engine/types.ts` (48 lines)
- **TARGET:** `operation-service/src/alert-engine/types.ts`
- **Kind:** pure port (zero logic; consider re-exporting `PriceEvent`/`Direction` from
  `@trading-alerts/types` if 4B-1 already hoisted them — check first, don't duplicate)
- **Port steps:** copy verbatim; no framework wrapping — types stay plain.
- **Parity proof:** `tsc` clean; downstream files compile against it.
- **Commit:** `migrate(alert-engine): port types to operation-service`

### File 2/11

- **SOURCE:** `lib/alert-engine/detect.ts` (32 lines, pure cross/touch detection)
- **TARGET:** `operation-service/src/alert-engine/detect.ts`
- **Kind:** pure port — **behavioral invariant:** cross_up/cross_down require close-crossing;
  intrabar touch only fires via 'either' (documented Phase 4 semantics). Do not "improve".
- **Parity proof:** port `__tests__/alert-engine/detect.test.ts` unchanged; green.
- **Commit:** `migrate(alert-engine): port detect (pure) with tests`

### File 3/11

- **SOURCE:** `lib/alert-engine/state.ts` (81 lines, AlertStateStore: Redis + in-memory impls)
- **TARGET:** `operation-service/src/alert-engine/state.ts`
- **Kind:** port + adapt — Redis client comes from the service's shared Redis provider
  (4B-4 will formalize it; until then a local `getRedisClient` mirroring `lib/redis/client.ts`
  is acceptable glue). Keep the store abstraction exactly — evaluator must never touch Redis.
- **Parity proof:** in-memory impl passes the ported state assertions inside evaluator tests.
- **Commit:** `migrate(alert-engine): port state store`

### File 4/11

- **SOURCE:** `lib/alert-engine/watches.ts` (62 lines)
- **TARGET:** `operation-service/src/alert-engine/watches.ts`
- **Kind:** port + adapt — **THE WRINKLE FILE.** It imports `levelsForMark` +
  `MarkSnapshot` from `@/components/charts/drawing/geometry` (frontend tree!) so server and
  chart evaluate the identical drawn level. Resolution (from 4B-1): geometry moves to
  `@trading-alerts/types` (or a `@trading-alerts/geometry` package) consumed by BOTH the
  frontend and this service. **Never fork the math** — a duplicated geometry file that
  drifts means the server fires alerts on lines the user isn't seeing.
- **Parity proof:** ported `watches` assertions green; spot-check one fib + one trendline
  watch produces identical level prices to the monolith build (same fixture in, same numbers out).
- **Commit:** `migrate(alert-engine): port watches on shared geometry package`

### File 5/11

- **SOURCE:** `lib/alert-engine/evaluator.ts` (66 lines, pure orchestration, injected deps)
- **TARGET:** `operation-service/src/alert-engine/evaluator.ts`
- **Kind:** pure port — already dependency-injected (no Redis/Prisma imports); the cleanest
  possible port. Invariants: prev-price persisted before cooldown/one-shot gating.
- **Parity proof:** `evaluator.test.ts` ported unchanged; green.
- **Commit:** `migrate(alert-engine): port evaluator with tests`

### File 6/11

- **SOURCE:** `lib/alert-engine/dispatcher.ts` (62 lines — Prisma writes + `alerts:fired` publish)
- **TARGET:** `operation-service/src/alert-engine/dispatcher.ts`
- **Kind:** port + adapt — becomes `@Injectable()` with constructor-injected `PrismaService`
  (non-market client!) and Redis provider. **Invariant:** the published `alerts:fired`
  message shape must stay byte-identical — the monolith web process still consumes it
  (see Integration points).
- **Parity proof:** ported dispatcher assertions in `notify-bridge.test.ts`/`watches.test.ts`
  green; manual staging check: fire → Notification row + Redis message observed.
- **Commit:** `migrate(alert-engine): port dispatcher as injectable`

### File 7/11

- **SOURCE:** `lib/alert-engine/queue.ts` (67 lines, BullMQ fire queue, deterministic jobId dedupe)
- **TARGET:** `operation-service/src/alert-engine/queue.ts`
- **Kind:** port + adapt — queue name becomes `op.alerts.fire` (CC-E namespace). Keep the
  deterministic jobId scheme exactly (dedupe on alert/level/bar = idempotency, CC-C).
- **Parity proof:** enqueue-twice-same-bar test proves single job (port existing assertion).
- **Commit:** `migrate(alert-engine): port fire queue (op.alerts.fire)`

### File 8/11

- **SOURCE:** `lib/alert-engine/notify-bridge.ts` (129 lines)
- **TARGET:** split — **publisher half** ports into the service (used by dispatcher);
  **subscriber half** (web-process Socket.IO re-emit) STAYS in the monolith untouched until
  4B-17 (F8). Do not port the subscriber here.
- **Kind:** port + adapt (partial). Invariant: channel name `alerts:fired` and payload
  unchanged.
- **Parity proof:** `notify-bridge.test.ts` publisher-side assertions green; end-to-end
  staging check: fire in new worker → toast/marker appears via monolith bridge.
- **Commit:** `migrate(alert-engine): port fired-alert publisher (subscriber stays in web)`

### File 9/11

- **SOURCE:** `lib/alert-engine/worker.ts` (117 lines — subscriber loop + watch cache)
- **TARGET:** `operation-service/src/alert-engine/worker.ts` (+ `alert-engine.module.ts` glue)
- **Kind:** port + adapt — two Redis connections preserved (dedicated subscriber + state);
  env contract preserved: `REDIS_URL`, `EVAL_ON_FINAL_BAR_ONLY` (default off). Add pino +
  correlation-ID per fire (CC-B) and graceful shutdown hooks (CC-C: drain BullMQ on SIGTERM).
- **Parity proof:** `watches.test.ts` cache-invalidation assertions green; staging: publish
  synthetic PriceEvent → fire observed end-to-end.
- **Commit:** `migrate(alert-engine): port worker loop with shutdown hooks`

### File 10/11

- **SOURCE:** `scripts/alert-worker.ts` (29 lines, entrypoint)
- **TARGET:** operation-service worker entrypoint (`src/main-worker.ts` or Nest standalone
  app context) + Railway config for a second process/service
- **Kind:** new glue (justified: process bootstrap is framework-specific). Mirror
  `railway-worker.json` semantics in the service's `railway.toml`.
- **Parity proof:** worker boots on staging Railway, subscribes, health/log lines visible.
- **Commit:** `migrate(alert-engine): add worker entrypoint + railway config`

### File 11/11

- **SOURCE:** `__tests__/alert-engine/{detect,evaluator,notify-bridge,watches}.test.ts` (4 files)
- **TARGET:** `operation-service/test/alert-engine/*`
- **Kind:** pure port — assertions unchanged (they are the parity oracle; changing an
  assertion requires a written justification in this doc's Wrinkles section).
- **Parity proof:** all four suites green in the service's Jest config.
- **Commit:** `migrate(alert-engine): port test suites`

---

## Slice-level verification (ends Session 4B-2)

- [ ] All 4 ported suites green; monolith suites still green (source untouched)
- [ ] Staging: synthetic price event → detect → queue → dispatch → Notification row +
      `alerts:fired` → monolith bridge re-emits (full path observed once)
- [ ] **Mirror-run started:** new worker runs on staging/production Redis feed with
      **dispatch disabled or pointed at a shadow queue** — log-only evaluation for 48h,
      diffed against the monolith worker's fires (this slice's equivalent of a shadow-run)
- [ ] CC-F: `lib/alert-engine/*` + `scripts/alert-worker.ts` now change-frozen

## Cutover (Session 4B-3 — after ⏸ 48h mirror-run)

- **Mechanism:** stop monolith worker container (docker-compose service /
  `railway-worker.json`), enable dispatch in the service worker. One worker consumes at a
  time — never both dispatching (double-fire risk; jobId dedupe is the backstop, not the plan).
- **Precondition:** 48h mirror diff clean (identical fire decisions) and reviewed by Davin.
- **Rollback:** re-start monolith worker, disable service dispatch — verified in staging first.

## Retire (after 4B-3 proves stable)

- [ ] Delete `lib/alert-engine/*` (9 files), `scripts/alert-worker.ts`,
      `railway-worker.json`, alert-worker service in `docker-compose.yml`
- [ ] `__tests__/alert-engine/*` deleted from monolith (they live in the service now)
- [ ] Update `docs/migration-orders/migration-cutover-table.md` + CLAUDE.md

---

## Known wrinkles / do-not-touch

1. **Cross-stack geometry import** (`watches.ts` → `components/charts/drawing/geometry`):
   must be hoisted to the shared package in 4B-1. Never fork the math.
2. **The Socket.IO subscriber half of notify-bridge stays in the monolith** until 4B-17
   (F8 realtime decision). This slice only moves the publisher.
3. **Non-market Prisma client only** — dispatcher touches Notification/Alert (non-market
   schema). Wiring the market client into this module is a boundary violation.
4. **Do not touch `lib/api/index.ts`** even though alerts appear in it — known broken,
   deferred to Phase 7 by design.
