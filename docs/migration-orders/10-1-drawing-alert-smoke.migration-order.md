# Migration Order — Session 10-1 — Drawing Engine & Line-Alert Live Smoke Test

> Read `00-SKELETON-AND-RULES.md` first — §4 applies. **Creativity dial: Medium** (the pipeline
> is already built and unit-verified; the approach to reaching real infra to prove it live is
> flexible, the end-state — a real cross-process round trip — is fixed).
> **PRE-DRAFTed by the Executor at Session 9-10's close (2026-08-23)**, per
> `MASTER-ROADMAP-PHASES-7-15.md` §3's own obligation (Phase 9's last session writes Phase 10's
> first order).

**Session:** 10-1 · **Phase:** 10 (Drawing Engine & Line-Alert Closure) · **Variant:** INFRA/VERIFY
· **Status:** PRE-DRAFT
**Generated:** 2026-08-23 (Executor, at Session 9-10's close) · **Flags touched:** F67 (must be
resolved before or during this session — see Entry criteria).
**Estimated time:** ~2–4h (highly dependent on which F67 option Davin picks; provisioning a fresh
environment costs more than reusing one that already exists).

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §3, Phase 10 closes the **one remaining unverified link** in
the drawing-engine/line-alert feature: a real, live, cross-process round trip — draw a line, have
a real price cross it, confirm a notification actually fires. The port itself (drawings CRUD,
line alerts, the alert-engine evaluator/dispatcher) shipped in Sessions 4B-2/4B-3/4B-5/4B-6/4B-7/
4B-8 and is unit-tested (`operation-service/src/alert-engine/*.spec.ts`,
`operation-service/src/drawings/*.spec.ts`, all green per Session 9-10's own final baseline: 42/42
suites, 393/393 tests). What has **never** been proven is the real Flask → Redis → NestJS →
Notification chain, live. The one prior attempt (2026-07-05, monolith-era, pre-dating the
`operation-service` port) was blocked purely on environment — no Docker, no root, an unreachable
Railway Postgres — not on code, per its own runbook
(`davintrade-draw-engine-and-line-alerts-stack/architecture-design-blueprint/
PHASE-4-SMOKE-TEST-RUNBOOK.md`).

**That runbook is now stale and must not be followed literally.** It describes the monolith-era
layout (`npm run worker:alerts`, `lib/alert-engine/*`) — Sessions 4B-2/4B-3 moved all of this to
`operation-service/src/alert-engine/*` (a dedicated worker process, `WORKER_MODE=true` on
`operation-service-worker`, per `migration-cutover-table.md`'s Slice 6 row) and 4B-8 moved
drawings CRUD to `operation-service/src/drawings/*`. Session 10-3 is explicitly scoped to rewrite
the blueprint's own stale status callouts; **this session should re-derive the real steps from
live `operation-service` code** (its own `main-worker.ts` entrypoint, `alert-engine.module.ts`,
`AlertWorkerService`), not from the runbook's literal commands — per this migration's own PD1
doctrine, live code wins over stale docs.

---

## Entry criteria (re-verify all at CONFIRM)

- [ ] **Phase 9 CLOSED** — Session 9-10 CONFIRMED, executed, CLOSED SUCCESSFUL (this order's own
      predecessor).
- [ ] **F67 resolved** (`DECISION-LOG.md`) — **where does this smoke test actually run?** Three
      options, per the roadmap's own framing, none of which the Executor can pick alone:
  - **(a) Contabo VPS** — the real production-adjacent MT5/Flask host. Closest to real
    production behavior; requires Davin granting access/credentials if not already held.
  - **(b) Local Docker** — `docker compose up -d postgres redis` per the stale runbook's own
    §1, adapted to point `operation-service-worker` at the local Redis/Postgres instead of
    `npm run worker:alerts`. Fastest to set up, least production-representative.
  - **(c) A Railway scratch environment** — spin up throwaway Postgres/Redis on Railway,
    point a local `operation-service-worker` + local `mt5-service` (or `USE_MOCK_MT5=true`)
    at them. Matches production's real Postgres/Redis provider without touching the real
    Contabo VPS or production data.
    **This is an infrastructure/access decision, not a technical one — ⚠ NEEDS EXPLICIT
    SIGN-OFF per `EXECUTOR-PROTOCOL.md` §7 (RPO/RTO, staging-data class).** The Advisor should
    resolve this into a `Decisions taken` entry before DRAFT is upgraded to APPROVED; if it
    reaches CONFIRM still open, STOP and ask Davin directly rather than picking one.
- [ ] **`operation-service-worker` deployability confirmed** — the dedicated worker process
      (`WORKER_MODE=true`, per Slice 6) must be runnable in whichever environment F67 picks,
      either as the real Railway service or a local equivalent pointed at the same Redis/Postgres
      the test uses.
- [ ] **Test fixtures identified** — a real `User` + `Drawing` (type `HLINE`, symbol `XAUUSD`,
      timeframe from the live-verified set) + `Alert` (`PRICE_TOUCH_LINE`) + `DrawingAlert` link,
      seeded or created live through the real `/api/drawings` + `/api/alerts/line` endpoints
      (Session 9-4's `/terminal` UI now provides a real drawing toolbar + line-alert UI bound to
      these — prefer creating fixtures through the live UI over direct DB seeding, since that
      also exercises Panel 1's real binding named in `frontend-swap-route-map.md` row 57).

---

## Ordered steps

_(each step = change → immediate verification → rollback note)_

1. **Resolve F67, stand up the picked environment.**
   _Verify:_ `operation-service-worker` boots against it, logs its own real subscribe
   confirmation (the current equivalent of the stale runbook's `"[alert-worker] subscribed to
prices:* and alerts:changed"` line — re-derive the exact log line from
   `AlertWorkerService`'s live source, don't assume the runbook's string still matches).
   _Rollback:_ tear down the scratch environment (option b/c) or simply stop touching the Contabo
   VPS (option a) — no production state is created by standing this up alone.
2. **Point `mt5-service`'s `redis_pub.py` at the same Redis the worker subscribes to.** Confirm
   `mt5-service/tests/test_redis_pub.py` (3/3 passing per the 2026-07-05 finding) still reflects
   the real `PriceEvent` payload shape `operation-service/src/alert-engine/types.ts` expects — a
   schema drift here would silently break the whole test with no error on either side.
   _Verify:_ a real Redis `PUBLISH` on `prices:{symbol}:{tf}` from `mt5-service` is actually
   received by `operation-service-worker` (not just acknowledged at the Redis layer — the prior
   attempt's `fakeredis` limitation was exactly this gap, a real Redis instance shouldn't have it,
   confirm directly).
3. **Create the real fixture chain live** (Drawing + Alert + DrawingAlert) through
   `/terminal`'s own drawing toolbar + line-alert UI, as a real authenticated PRO-tier session.
   _Verify:_ `GET /api/drawings` and `GET /api/alerts/line` both show the new rows for real.
4. **Cross the price, live.** Either a real MT5 feed reaching the test symbol/level, or
   `USE_MOCK_MT5=true` (per the stale runbook's own note this exists) driving a synthetic cross —
   Davin's call which is more convincing evidence for closing this gap permanently.
   _Verify (all four, not just the first that succeeds):_
   - `operation-service-worker`'s own log shows the watch evaluated and fired.
   - A new `Notification` row exists for the test user (`type: ALERT`), `Alert.triggerCount`
     incremented, `lastTriggered` set.
   - A real Socket.IO push reaches a live browser tab on `/terminal` (F8's realtime
     architecture, already proven for other event types at 4B-17/18b/18c/18d) — confirm via
     DevTools Network WS frames, not just an in-app toast appearing.
   - The chart marker actually renders on `/terminal`'s own chart (Panel 1,
     `components/charts/trading-chart.tsx`) — this is the one piece of the chain no prior
     session has ever exercised end-to-end.
5. **Document the real result**, pass or fail, with the actual evidence gathered (log lines,
   screenshots/DOM state, DB rows) — this session's entire deliverable is proof, not code.

## Rules specific to this variant

- **No code changes unless the smoke test surfaces a real defect.** If it does, follow
  `LESSONS-LEARNED.md` L11's own precedent (a live cutover attempt that reveals a real bug is
  itself the deliverable — a new, correctly-scoped finding, not a license to keep patching deeper
  live).
- **Never point this test at real production Contabo/Railway data** if option (a) or (c) is
  picked without an explicit scratch/test-data boundary — confirm the isolation before step 3.
- **Nothing dashboard-only** — whichever environment F67 picks, its setup must be reproducible
  from a committed script or documented command sequence, not manual dashboard clicks alone.

## Done when

- [ ] F67 resolved and recorded in `DECISION-LOG.md`, approved by Davin.
- [ ] A real price cross produced a real `Notification` row, a real Socket.IO push, and a real
      chart marker — all three, live, with evidence.
- [ ] `PHASE-4-SMOKE-TEST-RUNBOOK.md` superseded by this session's own real runbook (or a dated
      addendum noting what changed from the stale monolith-era version) — full rewrite is 10-3's
      job, but 10-1 should leave an honest trail of what it actually ran.
- [ ] `migration-cutover-table.md` Slice 6/7 rows re-verified against this session's live proof
      (they already say CUT-OVER; this session either confirms that's now backed by live-fire
      evidence or finds it isn't).

---

## Rollback

Whichever environment F67 picked: tear it down (scratch Docker/Railway) or simply stop touching
it (Contabo VPS, if it's the real production-adjacent host — nothing about running this test
against it is destructive as long as step 3's fixtures are cleaned up after).

---

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

---

## Next-session handoff

- **Next session:** `10-2` — e2e + API coverage (Playwright `draw → attach alert → price crosses
→ fire → toast + chart marker + email`, Newman coverage for `/api/drawings` and
  `/api/alerts/line`), per `MASTER-ROADMAP-PHASES-7-15.md` §3.
- **Prerequisite:** Session 10-1 CLOSED — the live round trip proven for real, F67 resolved.
