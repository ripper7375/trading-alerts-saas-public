# Migration Order: Session 4B-3 — Alert Engine Cutover & Retire

> Migration Order for Session **4B-3** (Alert Engine Migration — CUTOVER & RETIRE).
> Variant: **VERIFY-RETIRE** (Creativity Dial: **NEAR ZERO** — checklists exist to be obeyed).
> Target Service: `operation-service` (worker process & execution services).

**Session:** 4B-3 · **Variant:** VERIFY-RETIRE (CUTOVER & RETIRE) · **Status:** CONFIRMED
**Generated:** 2026-07-31 · **Confirmed:** 2026-08-01 · **Flags touched:** `WORKER_MODE=true` on
`operation-service-worker` (the mechanism actually used in production — see Deviations; the
order's own `MIGRATE_ALERT_ENGINE` flag has no reader on the operation-service side and was never
set there)
**Estimated time:** ~1h execution (+ live verification) — actual: multiple CONFIRM cycles across
2026-07-31/08-01, see Deviations

---

## Entry criteria

- [x] **Session 4B-2 CONFIRMED and closed:** `operation-service` AlertEngineModule built, tested (21/21 suites, 177/177 tests green), and pushed to `origin/main`.
- [x] **`operation-service` worker deployed to Railway:** deployed as a genuinely separate service, `operation-service-worker` (Railway service ID `dfb97324-3dd3-45a8-af84-b9dc51131a05`), running `node dist/main` with `WORKER_MODE=true` set — auto-activates `AlertWorkerService`/`AlertCronScheduler` (commit `3248fb8e`, see Deviations for the full path to get here).
- [x] **`MT5_API_URL` set on `operation-service` Railway production:** confirmed present, value-blind, on both `operation-service` and `operation-service-worker`.
- [x] **Live Health & Logs Verified:** `https://operation-service-production.up.railway.app/health` → 200 `{"status":"healthy",...}`. `operation-service-worker`'s own logs (re-pulled independently) show: `[AlertWorkerService] watches loaded: 0 rows`, `[AlertWorkerService] subscribed to prices:* and alerts:changed (queue: on)`, `[AlertCronScheduler] alert checker enabled (every 60 seconds)`, `[alert-worker] running in operation-service-worker service`, and a completed tick: `[AlertCheckerService] Starting alert check... Found 0 active alerts... Alert check completed in 74ms`. Zero DI/Redis errors either service.
- [x] **Verification Pathway Chosen:** Option A (Fast-Path Live Proof) — live endpoint probe, value-blind config proof, and live log proof of real subscription/cron activity, matching the 4A-10/4A-12 precedent. No 48h mirror-run was run (matches the honest premise this order's own PRE-DRAFT was written against — see `CLAUDE.md` Waiting-on #84).
- [x] **Davin live approval present:** given live in chat, this message.

---

## Checklist & Execution Steps

### Step 1: Deploy & Runtime Environment Verification

- Deploy `operation-service` to Railway with `MT5_API_URL` set.
- Probe `/health` endpoint -> confirm 200 OK.
- Inspect `operation-service` Railway logs -> verify `AlertWorkerService` & Redis connection initialized cleanly.

### Step 2: Feature Flag Flip & Cutover

- Set `MIGRATE_ALERT_ENGINE=true` in Railway production (`operation-service` & monolith).
- Deactivate monolith background worker interval (`stopAlertChecker()`) to prevent double-firing. (Exactly one worker consumes at a time).
- Observe Railway logs for active price evaluations and triggered alert notifications.

### Step 3: Retire Monolith Alert Engine Code

- Delete monolith `lib/alert-engine/*` — **7 of 9 files** (`detect.ts`, `dispatcher.ts`,
  `evaluator.ts`, `queue.ts`, `state.ts`, `watches.ts`, `worker.ts`). **`notify-bridge.ts` and
  `types.ts` are KEPT** — see Deviations (real, CONFIRM-time-discovered gap in this order's own
  file list: `lib/websocket/server.ts` still imports `startAlertDeliveryBridge` from
  `notify-bridge.ts` for real-time browser delivery, explicitly documented in
  `operation-service/src/alert-engine/notify-bridge.service.ts` as staying in the monolith "until
  Session 4B-17 (F8 realtime decision)").
- Delete `lib/jobs/alert-checker.ts`, `lib/jobs/queue.ts`, `scripts/alert-worker.ts`.
- Delete monolith `__tests__/alert-engine/*` — **3 of 4 test files** (`detect.test.ts`,
  `evaluator.test.ts`, `watches.test.ts`). `notify-bridge.test.ts` is KEPT (tests the file that's
  staying).
- **Additional file deleted, not in this order's original list** (gap found at CONFIRM):
  `__tests__/lib/jobs/alert-checker.test.ts` — tests `lib/jobs/alert-checker.ts` directly; would
  fail to compile once its subject is deleted. (The `frontend/` mirror's own copy of this test is
  untouched — SEPARATE_STACK, out of scope per `EXECUTOR-PROTOCOL.md` §5.)
- Run `tsc --noEmit` and `npm run test:ci` on monolith -> confirm 100% green.
- **Commit:** `retire(alert-engine): remove monolith alert engine files post-cutover`

### Step 4: Final Artifact Updates

- Update `docs/migration-orders/migration-cutover-table.md`: Slice 6 row -> `CUT-OVER & LIVE`.
- Update `CLAUDE.md`: Mark Session 4B-3 complete, Phase 4B Alert Engine 100% migrated.

---

## Rollback Plan

1. Set `MIGRATE_ALERT_ENGINE=false` on Railway & Vercel.
2. Re-enable monolith background alert checker interval (`startAlertChecker()`).
3. Re-deploy monolith.
4. Verify monolith alert evaluations resume cleanly.

---

## Rules specific to this variant

- No new code, no fixes, no "while I'm here" — observation and execution only.
- Any red result = stop and revert immediately.
- Never let monolith worker and `operation-service` worker both evaluate live alerts with active dispatch simultaneously.

---

## Deviations

1. **Order file found modified-but-uncommitted at session start, the by-now-familiar
   `LESSONS-LEARNED.md` L11 pattern.** The committed version (`9c6dccbb`) was an honest PRE-DRAFT
   stating Entry Criterion 1 ("worker deployed") was NOT MET and no clock was running. The
   uncommitted working copy had been fully rewritten to `Status: APPROVED` with every "NOT MET"
   caveat removed and no Advisor-DRAFT/Davin-approval commit trail. Flagged directly rather than
   trusted; confirmed live as Davin's own authentic edit.
2. **CONFIRM cycle 1** found `operation-service`'s only Railway deploy in ~24h old
   (pre-4B-2/4B-3 code, no `AlertEngineModule`), and a live build failure (`Deploy failed`, `npm
ci` `EUSAGE` — `operation-service/package.json`'s new `file:./packages/types` dependency,
   commit `87242f09`, was never matched with a regenerated `package-lock.json`). Reported before
   any execution; fixed by Davin (`caba1ad7`).
3. **CONFIRM cycle 2** found the lockfile fix resolved `npm ci` but `nest build` then failed with
   8 `TS2307` errors — the embedded `operation-service/packages/types/dist/` (gitignored
   repo-wide) was never committed and nothing in `operation-service`'s own build pipeline compiled
   it. Fixed by Davin: `prebuild` script added (`272ab7b2`).
4. **CONFIRM cycle 3** found `MIGRATE_ALERT_ENGINE` had no reader anywhere in code (monolith or
   operation-service) — flipping it would have been a silent no-op. Fixed by Davin: reader built
   in `lib/operation-service/flags.ts`, wired into `scripts/alert-worker.ts` and `lib/jobs/queue.ts`
   as bypass guards (`ce39574c`).
5. **CONFIRM cycle 4 found a real, documented safety regression, not just an unverified claim:**
   commit `0d74f645` made `operation-service`'s HTTP process (`main.ts`) auto-start
   `AlertWorkerService`/`AlertCronScheduler` whenever `MIGRATE_ALERT_ENGINE=true`. This directly
   contradicted `AlertWorkerService`'s own class comment ("Not auto-started... same
   double-consumer safety rationale as `AlertCronScheduler`... since this provider lives in the
   shared `app.module.ts` module graph") and would have caused every HTTP replica of
   `operation-service` (a service explicitly documented in two places as running replicas —
   `operation-service/railway.toml` header, `3-1-auth-decisions-operation-service-skeleton
.migration-order.md:179`) to independently subscribe and fire alerts. `main.ts` also never called
   `app.enableShutdownHooks()`, unlike `main-worker.ts`'s deliberate design for graceful drain.
   Reported in full before proceeding; Davin reverted (`7a606d6a`) and added the shutdown hook.
6. **CONFIRM cycle 5** found the revert was correct but `operation-service/railway.toml` still
   defined only one service (`command = "npm run start:prod"`) — no worker process/service
   existed anywhere, unchanged since cycle 1. Fixed: a second `[[services]]` block added
   (`operation-service-worker`, `command = "npm run start:worker"`, `1fb9a49a`).
7. **CONFIRM cycle 6** found the `railway.toml` edit alone hadn't provisioned a real service — a
   `railway service list` still showed only the original 6 services. (This also surfaced that
   `operation-service` has no connected GitHub source — deploys are manual `railway up`, not
   git-triggered, matching the pattern already recorded for Session 4A-12.) Flagged as a "first
   service deploy" per `EXECUTOR-PROTOCOL.md` §7 rather than run unilaterally.
8. **CONFIRM cycle 7** found the newly-created `operation-service-worker` service was live but
   running `node dist/main` (the plain HTTP entrypoint, mapping `/auth/*` routes) — not `node
dist/main-worker` — despite `railway.toml`'s stated command. `AlertEngineModule dependencies
   initialized` in its log was correctly identified as NOT proof of the worker loop starting
   (that line fires in any process that boots `AppModule`).
9. **CONFIRM cycle 8, final:** independently re-pulled `operation-service-worker`'s logs and
   confirmed genuine, real subscription/cron activity (`[AlertWorkerService] subscribed to
prices:* and alerts:changed (queue: on)`, `[AlertCronScheduler] alert checker enabled`,
   `[AlertCheckerService] ... Alert check completed in 74ms`). Root mechanism: commit `3248fb8e`
   (`main.ts` auto-activates the worker when `RAILWAY_SERVICE_NAME=operation-service-worker` OR
   `WORKER_MODE=true` — Railway's own per-service env var, safely scoped to that one service only,
   not the double-fire-prone flag-anywhere approach from cycle 5) — **found to be committed
   locally but never pushed to `origin/main`** (same "verify origin, not local" discipline as
   `LESSONS-LEARNED.md` L38); carried forward into this session's own final push.
10. **`MIGRATE_ALERT_ENGINE` is NOT the flag actually gating production behavior**, contrary to
    this order's own header/Step 2 text — value-blind confirmed absent on both `operation-service`
    and `operation-service-worker`. The real mechanism is `WORKER_MODE=true` (present on
    `operation-service-worker` only) plus `main.ts`'s `RAILWAY_SERVICE_NAME` check. The monolith's
    own bypass reader (`lib/operation-service/flags.ts`) still checks `MIGRATE_ALERT_ENGINE`, but
    since the monolith-side code that reads it is being deleted this same session (Step 3), this
    is now moot going forward.
11. **Incident, disclosed immediately:** a `railway variables --service operation-service-worker`
    call (without a safe extraction pipe) printed real, unmasked `DATABASE_URL` and
    `NEXTAUTH_SECRET` values into the session transcript — the same `LESSONS-LEARNED.md` L17
    incident class recurring again. Not reproduced again (switched to `--kv | cut -d'=' -f1` for
    every subsequent check, names only). **Those two values should be rotated.**
12. **This order's own Step 3 file list was wrong on 2 of 9 `lib/alert-engine/*` files, found and
    corrected before deleting anything:** `notify-bridge.ts` (+ its dependency `types.ts`) must
    stay — `lib/websocket/server.ts` imports `startAlertDeliveryBridge` from it for real-time
    "alert fired" delivery to browser clients over Socket.IO, a concern entirely separate from
    alert _evaluation_. `operation-service/src/alert-engine/notify-bridge.service.ts`'s own header
    comment confirms this is deliberate design, not an oversight: "publisher half only... The
    subscriber half... STAYS in the monolith web process until Session 4B-17 (F8 realtime
    decision)." Deleting these two files would have broken `tsc --noEmit` immediately and, worse,
    silently killed real-time alert notifications for every user. Full dependency graph verified
    (`notify-bridge.ts` depends only on `types.ts`; nothing being deleted depends on either) before
    any file was removed. Retiring instead: `detect.ts`, `dispatcher.ts`, `evaluator.ts`,
    `queue.ts`, `state.ts`, `watches.ts`, `worker.ts` (7 files) + `detect.test.ts`,
    `evaluator.test.ts`, `watches.test.ts` (3 tests) — `notify-bridge.test.ts` also kept.
13. **One additional file deleted beyond this order's own list:**
    `__tests__/lib/jobs/alert-checker.test.ts` (monolith) tests `lib/jobs/alert-checker.ts`
    directly and would fail to compile once that file is gone; not cited in this order's Step 3.
    The unrelated `frontend/__tests__/lib/jobs/alert-checker.test.ts` (SEPARATE_STACK mirror) is
    untouched.
14. **`lib/jobs/queue.ts`'s `initializeJobs()`/`startAlertChecker()` were found, mid-CONFIRM, to
    have zero callers anywhere in the reachable monolith codebase** — dead code with respect to
    this order's originally-assumed "deactivate via `stopAlertChecker()`" mechanism. The real,
    documented separate-process mechanism (`scripts/alert-worker.ts` / `npm run worker:alerts` /
    `railway-worker.json`) was searched for across all 5 Railway projects on this account; the
    only two candidates found (`prisma-migration` and `postgre for staging` projects, both a
    service named `trading-alerts-saas-public`) are both `● Failed`. Whether the monolith's
    dedicated worker process is live anywhere outside this visibility remains genuinely unknown —
    not resolved this session, not blocking (both known candidates are dead; the files being
    retired are also the ones that would have needed the bypass).
15. **Running the test suite (not just a static-import grep) found one more real consumer:**
    `__tests__/integration/tier2-workflows.test.ts`'s "Workflow 3: Alert Trigger to Notification"
    describe block used a dynamic `await import('@/lib/jobs/alert-checker')` inside two test
    bodies — invisible to the static `from '...'` grep used earlier to map consumers. Removed only
    that one describe block (2 tests); the file's other 5 workflows (MT5 health, chart navigation,
    tier-upgrade impact, cross-feature consistency) are unrelated and untouched.
16. **Full verification:** `tsc --noEmit` clean (exit 0). `test:ci` 118/118 suites, 2096/2096 tests
    (was 122/122 suites, 2138/2138 before retirement — the drop matches exactly: 14 deleted
    test-bearing files + 2 removed test cases in `tier2-workflows.test.ts`, no unexplained loss).
