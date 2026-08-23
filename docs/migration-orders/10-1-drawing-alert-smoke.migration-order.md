# Migration Order — Session 10-1 — Drawing Engine & Line-Alert Live Smoke Test

> Read `00-SKELETON-AND-RULES.md` first — §4 applies. **Creativity dial: Medium** (the pipeline
> is already built and unit-verified; the approach to executing infra and verifying live proof is
> structured and flexible, while the end-state — a real cross-process round trip — is fixed and mandatory).
> **PRE-DRAFTed by the Executor at Session 9-10's close (2026-08-23)**, upgraded to **DRAFT by the
> Advisor / Antigravity (2026-08-23)** per `MASTER-ROADMAP-PHASES-7-15.md` §3 and `00-SKELETON-AND-RULES.md`.

**Session:** 10-1 · **Phase:** 10 (Drawing Engine & Line-Alert Closure) · **Variant:** INFRA/VERIFY · **Status:** CONFIRMED  
**Generated:** 2026-08-23 (Executor, PRE-DRAFT) · **Upgraded to DRAFT:** 2026-08-23 (Advisor / Antigravity) · **Approved:** 2026-08-23 (Davin) ·
**Confirmed:** 2026-08-23 (Executor) — codebase + runtime re-verified live; both `⚠ NEEDS EXPLICIT
SIGN-OFF` items (Decisions 1 & 2) approved by Davin explicitly, separate from the order's general
approval, per `EXECUTOR-PROTOCOL.md` §0. F67 resolved in `DECISION-LOG.md` same session.  
**Flags touched:** F67 (smoke test execution environment — resolved in Decisions taken below).  
**Estimated time:** ~2–3h (environment stand-up, live WebSocket + Redis pipeline verification, multi-layer assertion evidence).  
**Target services / components:** `operation-service` (`AlertWorkerService` via `main-worker.ts`, `RealtimeGateway` via `main.ts`), Redis, Postgres, MT5 publisher (`mt5-service/app/redis_pub.py` / deterministic feeder), Monolith frontend (`/terminal`, `useRealtimeSocket`, `useFiredAlertMarkers`).

---

## Decisions taken

> Four technical choices taken by the Advisor per `00-SKELETON-AND-RULES.md` §1.0 & `DECISION-LOG.md` PD1.
> Items touching infrastructure environments and execution parameters carry **`⚠ NEEDS EXPLICIT SIGN-OFF`**.

1. **Smoke Test Execution Environment (F67 Resolution) `⚠ NEEDS EXPLICIT SIGN-OFF`**
   - **Chosen:** **Option B (Local Environment with Redis + Postgres + `operation-service` HTTP & Worker processes + deterministic price feeder)** as the primary authoritative verification environment. Option A (Contabo VPS) or Option C (Railway scratch) are designated as optional post-verification staging rehearsals if desired.
   - **Rejected:** Sole reliance on Contabo VPS (Option A, requires remote VPS SSH/root access and market open hours, risking dirtying production state) or pure Railway scratch provisioning (Option C, unnecessary cloud egress, latency, and deployment iteration overhead for a deterministic pipeline test).
   - **Why:** Local execution is 100% reproducible, sub-second to iterate, isolates test fixtures from live production customer data, and allows simultaneous direct inspection of local Redis pub/sub streams, NestJS worker logs, Postgres transactions, and browser WebSocket DevTools frames without external network flakiness.
   - **How hard to undo:** Trivial — shutdown local processes / clean up test DB fixtures.

2. **Price Crossing Trigger Strategy (Deterministic Synthetic Feeder vs. Live MT5 Market Feed) `⚠ NEEDS EXPLICIT SIGN-OFF`**
   - **Chosen:** Execute a deterministic price feeder using `mt5-service/app/redis_pub.py`'s verified payload format (`publish_price_event`) or a direct Redis `PUBLISH prices:XAUUSD:M5` script to simulate an exact pre-cross bar (`close: 1995.0`) followed by a crossing bar (`close: 2005.0`, `final: true`) over target line level `2000.0`.
   - **Rejected:** Passively waiting for live MT5 market ticks to wander across an arbitrary drawn price level during the session.
   - **Why:** Guarantees deterministic, instant, repeatable verification regardless of market trading sessions, weekend market closures, or slow market volatility. Also enables instant testing of edge conditions (cooldown suppression, one-shot deactivation, tolerance boundary).
   - **How hard to undo:** Trivial — published messages are transient in Redis pub/sub; DB side-effects are isolated to the test user.

3. **The 4-Point Invariant Proof Standard**
   - **Chosen:** Define successful end-to-end smoke verification as satisfying all four distinct observable events:
     1. **Worker Evaluation & Dispatch Log:** `operation-service-worker` logs the watch evaluation and fire dispatch with correlation ID (`dispatching fire`, `fire dispatched`).
     2. **Database Mutation:** Postgres atomic transaction creates a `Notification` row (`type: 'ALERT'`, `priority: 'HIGH'`) and updates `Alert` (`triggerCount` incremented, `lastTriggered` set).
     3. **Realtime Gateway Relay:** `operation-service` `RealtimeGateway` receives the `alerts:fired` Redis message and delivers to the user room `user:<userId>`.
     4. **Browser UI & Chart Marker Render:** Authenticated browser session on `/terminal` receives WebSocket frames (`notification` and `alert_fired`), displaying notification state and rendering the amber circle marker on the Lightweight Charts canvas via `useFiredAlertMarkers`.
   - **Rejected:** Stopping verification at the Redis publish or database mutation layer without proving live browser WebSocket delivery and chart canvas marker rendering.
   - **Why:** Proves the complete cross-process chain across all microservices and frontend surfaces.
   - **How hard to undo:** Non-destructive observation standard.

4. **Fixture Creation via Live REST Endpoints vs. Raw DB Seeding**
   - **Chosen:** Create test fixtures (Drawing + Line Alert + DrawingAlert link) via the live authenticated HTTP endpoints `POST /api/drawings` and `POST /api/alerts/line` (proxied by monolith BFF to `operation-service`).
   - **Rejected:** Inserting rows directly via raw Prisma script without calling the API handlers.
   - **Why:** Exercises the real BFF proxy, Zod validation pipes, drawing quota checks, and confirms that `POST /api/alerts/line` triggers the `alerts:changed` Redis message to reload `AlertWorkerService`'s in-memory watch cache.
   - **How hard to undo:** Trivial — delete fixtures via `DELETE /api/drawings/:id` at session close.

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §3, Phase 10 closes the **one remaining unverified link** in
the drawing-engine/line-alert feature: a real, live, cross-process round trip:
`Draw Line (UI / API) -> Price Crosses Level -> Alert Worker Evaluates -> Notification Created + Realtime Socket Push + Chart Marker Render`.

The port itself was completed across Phase 4B:

- Geometry math & types hoisted to `@trading-alerts/types` (Session 4B-1, F9)
- Alert engine core, evaluator, queue, and worker ported to `operation-service/src/alert-engine/` with standalone `main-worker.ts` entrypoint (Sessions 4B-2/4B-3)
- Line alerts CRUD ported to `operation-service/src/alerts/line-alerts.*` (Session 4B-5)
- Drawings CRUD ported to `operation-service/src/drawings/*` (Session 4B-8)
- Realtime Gateway (Socket.IO + NextAuth JWE handshake) deployed in `operation-service/src/realtime/` (Sessions 4B-17/4B-18d)
- Phase 9 promoted the redesigned `/terminal` (4-panel workspace) with live drawing toolbar and line-alert UI bindings.

All unit test suites are 100% green (`operation-service`: 42/42 suites, 393/393 tests; monolith: 153/153 suites, 2198/2198 tests). What has never been proven end-to-end under live conditions is the real cross-process execution chain. The prior attempt (2026-07-05, monolith-era `PHASE-4-SMOKE-TEST-RUNBOOK.md`) was blocked on environment issues (no Docker, no root, unreachable Railway Postgres) and describes the legacy monolith worker (`npm run worker:alerts`, `lib/alert-engine/*`).

This session executes the live smoke test against `operation-service`'s real architecture, captures concrete proof, and resolves **F67**.

---

## Entry criteria (re-verify all at CONFIRM)

- [ ] **Phase 9 CLOSED** — Session 9-10 CONFIRMED, executed, and CLOSED SUCCESSFUL 2026-08-23.
- [ ] **F67 resolved** (`DECISION-LOG.md`) — Option B (Local Environment) approved by Davin as the primary verification environment (`⚠ NEEDS EXPLICIT SIGN-OFF`).
- [ ] **Redis instance accessible** — local Redis (or reachable dev instance via `REDIS_URL`).
- [ ] **Postgres database accessible** — `DATABASE_URL` configured and schema migrations up to date (`Drawing`, `Alert`, `DrawingAlert`, `Notification` tables present).
- [ ] **`operation-service` compilable & runnable** — `npm run build` succeeds in `operation-service`; both HTTP process (`npm run start:dev` / `node dist/main`) and worker process (`npm run start:worker` / `node dist/main-worker`) boot cleanly.
- [ ] **Test user session available** — authenticated user account (e.g. `free-test@trading-alerts.test` or PRO user) with valid NextAuth session for `/terminal` and `/api/realtime/token`.
- [ ] **Baseline test suites 100% green** — Monolith `test:ci` (153 suites, 2198 tests), `operation-service` (42 suites, 393 tests), `money-service` (62 suites, 526 tests).

---

## Ordered steps

_(each step = change → immediate verification → rollback note)_

### 1. Stand up infrastructure & boot `operation-service` processes

- **Action:** Ensure Redis is running (e.g. `redis://127.0.0.1:6379`). In `operation-service/`, ensure `.env` is configured with `DATABASE_URL`, `REDIS_URL`, `NEXTAUTH_SECRET`, and `ALLOWED_ORIGINS=http://localhost:3000`.
  1. Boot the HTTP/realtime service: `npm run start:dev` (or `node dist/main` on port 3001).
  2. Boot the alert worker service: `npm run start:worker` (or `node dist/main-worker`).
- **Verify:**
  - HTTP process logs: `[RealtimeGateway] Subscribed to alerts:fired` and `Nest application successfully started`.
  - Worker process logs: `[alert-worker] running`, `[AlertWorkerService] subscribed to prices:* and alerts:changed (queue: on)`, `[AlertWorkerService] watches loaded: N rows`, and `[AlertCronScheduler] alert checker enabled (every 60 seconds)`.
- **Rollback:** Stop worker and HTTP processes (`Ctrl+C` / kill process).

### 2. Verify `mt5-service` `redis_pub.py` payload compatibility

- **Action:** Confirm `mt5-service/app/redis_pub.py`'s `publish_price_event()` matches `@trading-alerts/types`' `PriceEvent` interface:
  ```json
  {
    "symbol": "XAUUSD",
    "timeframe": "M5",
    "time": 1700000000,
    "open": 2000.0,
    "high": 2005.0,
    "low": 1995.0,
    "close": 2005.0,
    "final": true
  }
  ```
  Run the unit test: `pytest mt5-service/tests/test_redis_pub.py`.
- **Verify:** Pytest passes (3/3 tests green). Field names and types match `operation-service/src/alert-engine/types.ts` byte-for-byte.
- **Rollback:** None (read-only verification).

### 3. Connect browser to `/terminal` and verify realtime WebSocket handshake

- **Action:** Start monolith dev server (`npm run dev`). Log in as the test user and navigate to `http://localhost:3000/terminal` (or `/charts/XAUUSD/M5`).
- **Verify (in browser DevTools):**
  - `GET /api/realtime/token` returns `{ token: "...", url: "http://localhost:3001" }` (HTTP 200).
  - Network tab -> WS filter shows a 101 Switching Protocols connection to `operation-service`.
  - `operation-service` logs: `[RealtimeGateway] Client <socketId> authenticated as user <userId>`.
  - WebSocket frames contain incoming `authenticated` message (`{"success":true,"userId":"..."}`).
- **Rollback:** Close browser tab.

### 4. Create live test fixture (Drawing + Line Alert) via API

- **Action:** Via authenticated session (or direct API call with session cookies):
  1. Create horizontal line drawing at `price: 2000.0` on `symbol: XAUUSD`, `timeframe: M5`:
     `POST /api/drawings` with payload `{ type: "HLINE", symbol: "XAUUSD", timeframe: "M5", anchors: [{ time: 0, price: 2000.0 }], style: { color: "#f59e0b", lineWidth: 2 } }`.
  2. Attach a line alert to the created drawing:
     `POST /api/alerts/line` with payload `{ drawingId: "<drawingId>", targetLevel: "line", direction: "either", tolerance: 0.1, cooldownSec: 60, oneShot: false }`.
- **Verify:**
  - `POST /api/drawings` returns 201 with generated `drawing.id`.
  - `POST /api/alerts/line` returns 201 with generated `alert.id` and `drawingAlert.id`.
  - Worker process logs: `[AlertWorkerService] watches loaded: N+1 rows` (triggered by `alerts:changed` Redis publication).
- **Rollback:** `DELETE /api/drawings/:id` (cascades to delete DrawingAlert and Alert).

### 5. Trigger live price cross and capture the 4 Invariant Proofs

- **Action:** Publish price sequence to Redis channel `prices:XAUUSD:M5` using Python (`python -c "..."` importing `mt5-service/app/redis_pub.py`) or Node Redis script:
  1. Baseline bar (below line): `{ "symbol": "XAUUSD", "timeframe": "M5", "time": 1700000300, "open": 1995.0, "high": 1996.0, "low": 1994.0, "close": 1995.0, "final": true }` -> initializes `alert:prev:<alertId>:line` in Redis state.
  2. Crossing bar (crosses 2000.0): `{ "symbol": "XAUUSD", "timeframe": "M5", "time": 1700000600, "open": 1995.0, "high": 2006.0, "low": 1995.0, "close": 2005.0, "final": true }`.
- **Verify (All 4 Proofs Required):**
  - **Proof 1 (Worker Log):** `operation-service-worker` console output records:
    `[AlertEngine] dispatching fire` with correlationId, alertId, and `fire dispatched`.
  - **Proof 2 (Database Mutation):** Query Postgres:
    - `SELECT * FROM "Notification" WHERE "userId" = '<testUserId>' ORDER BY "createdAt" DESC LIMIT 1;` -> returns row with `type = 'ALERT'`, `priority = 'HIGH'`, `title = 'XAUUSD M5 alert'`, `body` containing `Price 2005 touched line @ 2000`.
    - `SELECT "triggerCount", "lastTriggered" FROM "Alert" WHERE "id" = '<alertId>';` -> `triggerCount` = 1, `lastTriggered` matches recent timestamp.
  - **Proof 3 (Realtime Gateway Relay):** `operation-service` HTTP process receives `alerts:fired` from Redis and emits to `user:<userId>`.
  - **Proof 4 (Browser WS & Chart Marker):**
    - Browser DevTools WS frame inspector shows `["notification", {...}]` and `["alert_fired", {"symbol":"XAUUSD","timeframe":"M5","levelId":"line","levelPrice":2000,"touchPrice":2005,"time":1700000600}]`.
    - `/terminal` chart canvas mounts the amber circle marker at price 2005 / time 1700000600 via `useFiredAlertMarkers`.
- **Rollback:** Clean up test DB notifications.

### 6. Verify edge behaviors: Cooldown and One-Shot

- **Action:**
  1. Immediately publish another crossing price event (within the 60s cooldown window).
  2. Create a separate `oneShot: true` alert, cross the price once, then cross it a second time after cooldown.
- **Verify:**
  - Event 1 is suppressed by cooldown (`alert:cd:...` active in Redis state; zero new Notification row, `triggerCount` remains 1).
  - Event 2 fires once, updates `Alert.isActive = false` in Postgres, and subsequent crossings do not fire.
- **Rollback:** Delete test fixtures.

### 7. Document evidence and clean up test fixtures

- **Action:**
  1. Capture log extracts, DB records, and WS frame dumps into the session execution record / walkthrough.
  2. Delete test drawings via `DELETE /api/drawings/:id` and clean test notifications.
  3. Prepare documentation trail noting that `PHASE-4-SMOKE-TEST-RUNBOOK.md` is now superseded by this session's verified `operation-service` workflow (full doc rewrite in Session 10-3).
- **Verify:** Test fixtures removed; DB clean; baselines re-verified green.
- **Rollback:** None.

---

## Rules specific to this variant

- **No code modifications unless a genuine defect is discovered during the smoke test.** If a defect is found, apply `LESSONS-LEARNED.md` L11: isolate the exact layer (BFF proxy, worker state, Redis channel, Socket.IO room, or chart hook), patch minimally, and record the finding.
- **Strict environment isolation:** Do not run tests against production credentials or VPS without explicit sandbox/test-user separation.
- **Reproducible CLI execution:** All steps must run from documented shell commands / scripts, never undocumented manual hacks.

---

## Done when

- [ ] **F67 resolved** and recorded in `DECISION-LOG.md`, approved by Davin.
- [ ] **All 4 Invariant Proofs verified live with captured evidence:**
  1. Worker log shows evaluation and fire dispatch with correlation ID.
  2. Postgres shows `Notification` row created and `Alert.triggerCount` incremented.
  3. `RealtimeGateway` relays `alerts:fired` message to Socket.IO user room.
  4. Browser on `/terminal` receives WS frames (`notification` + `alert_fired`) and renders chart marker on canvas.
- [ ] **Cooldown and One-Shot logic verified live.**
- [ ] **Test fixtures cleaned up** and database left in clean state.
- [ ] **Full test suite baselines confirmed green:** Monolith `test:ci`, `operation-service`, `money-service`.

---

## Rollback

- Stop `operation-service` HTTP and worker processes.
- Delete test drawings, alerts, and notifications created during testing.
- Delete test Redis state keys: `redis-cli KEYS "alert:*" | xargs redis-cli DEL` (or selective pattern `alert:*:<testAlertId>*`).

---

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

---

## Next-session handoff

- **Next session:** `10-2` — e2e + API coverage (Playwright automated journey `draw → attach alert → price crosses → fire → toast + chart marker + email` on `/terminal`, plus Newman API coverage for `/api/drawings` and `/api/alerts/line`), per `MASTER-ROADMAP-PHASES-7-15.md` §3.
- **Prerequisite:** Session 10-1 CLOSED SUCCESSFUL with live end-to-end proof and F67 resolved.
