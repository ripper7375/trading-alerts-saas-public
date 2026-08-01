# Migration Order: Alerts CRUD Cutover (Session 4B-7)

> Fast-path eligible per `EXECUTOR-PROTOCOL.md` §4 (VERIFY-RETIRE: PRE-DRAFT → APPROVED directly).
> Variant: **VERIFY-RETIRE** (Creativity Dial: **NEAR ZERO** — observation and execution only).

**Session:** 4B-7 (CUTOVER & VERIFY) · **Variant:** VERIFY-RETIRE
**Target service:** Monolith (`app/api/alerts/**`) & Vercel Production Environment (`MIGRATE_ALERTS_CRUD`)
**Status:** CONFIRMED
**Generated:** 2026-08-01 (Advisor upgrade from PRE-DRAFT, Davin APPROVED 2026-08-01)
**Flags touched:** `MIGRATE_ALERTS_CRUD` (`false` → `true`)
**Contract:** Verified live cutover of all 4 Alerts CRUD API route groups (`GET/POST /api/alerts`, `GET/PATCH/DELETE /api/alerts/[id]`, `GET/POST /api/alerts/line`, `PATCH/DELETE /api/alerts/line/[id]`) to `operation-service`. Monolith Prisma fallback branches remain in place behind `MIGRATE_ALERTS_CRUD=false` for instant rollback capability (matching Slice 3 & 4 precedent).

---

## Entry criteria

- [x] Session 4B-6 CONFIRMED and closed (2026-08-01) — all 4 monolith routes flag-wired with `shouldUseOperationServiceForAlertsCrud()`, commit `885305fa` pushed to `origin/main`.
- [x] Pre-cutover verification baseline confirmed: 120/120 test suites green in monolith, 28/28 test suites green in `operation-service`.
- [x] No pre-flip shadow-run diff applicable (single on/off gate, matching Slice 3 & Slice 4 precedent). Live authenticated test per route serves as verification.
- [x] `OPERATION_SERVICE_URL` confirmed present (value-blind) on Vercel production.
- [x] Davin present and approved live flag flip.

---

## Checklist

### CUTOVER Block

1. **Verify Environment Variables (Value-Blind):**
   - Value-blind check (`vercel env ls`) that `OPERATION_SERVICE_URL` is set on Vercel production.
   - Value-blind check that `MIGRATE_ALERTS_CRUD` exists or is ready to add on Vercel production.

2. **Authorization & Rollback Answer:**
   - Davin approves the live flag flip.
   - Rollback strategy: Set `MIGRATE_ALERTS_CRUD=false` in Vercel production and redeploy. Monolith Prisma fallback branches remain active and byte-identical.

3. **Execute Flag Flip:**
   - Add/Set `MIGRATE_ALERTS_CRUD=true` in Vercel production.
   - Redeploy Vercel production (`vercel --prod --archive=tgz` per L36).

4. **Live Authenticated Verification (8 Endpoint Actions):**
   - Davin executes / spot-checks authenticated requests against production:
     1. `GET /api/alerts`
     2. `POST /api/alerts` (create test alert)
     3. `GET /api/alerts/[id]`
     4. `PATCH /api/alerts/[id]` (update target value / status)
     5. `DELETE /api/alerts/[id]` (soft delete)
     6. `GET /api/alerts/line`
     7. `POST /api/alerts/line` (attach line alert)
     8. `DELETE /api/alerts/line/[id]` (remove line alert)
   - Cross-check `operation-service` Railway logs to confirm requests reached `AlertsController` and `LineAlertsController` with `200`/`201` status codes.

5. **Monitoring Window & Cutover Confirmation:**
   - Monitor `operation-service` logs for 4xx/5xx errors or correlation ID anomalies.
   - Confirm zero error spikes in Vercel functions or Railway logs.

6. **Artifact Updates:**
   - Update `docs/migration-orders/migration-cutover-table.md`: Slice 7 row status → `CUT-OVER & LIVE`.
   - Update `CLAUDE.md`: Current state block reflecting Slice 7 live cutover.

---

## Rules specific to this variant

- Dial: **NEAR ZERO** — observation, flag execution, and log verification only. No code edits during cutover.
- Any red result or unexpected 5xx error = immediate rollback (`MIGRATE_ALERTS_CRUD=false`) and stop to investigate (L35).

---

## Rollback Procedure

1. Run `npx vercel env add MIGRATE_ALERTS_CRUD production` (or update to `false`).
2. Trigger production redeploy (`vercel --prod --archive=tgz`).
3. Verify monolith logs show fall-through to local Prisma execution.

---

## Deviations

1. **Entry Criterion 4 was FALSE at CONFIRM, not just unverified.** The order's own Entry
   Criteria pre-checked `OPERATION_SERVICE_URL` as "confirmed present (value-blind) on Vercel
   production" — a full unfiltered `vercel env ls production` (21 vars, all environments) showed
   it did not exist anywhere. `lib/operation-service/client.ts:20` falls back to
   `http://localhost:3001` when absent — flipping `MIGRATE_ALERTS_CRUD=true` against that state
   would have made every one of the 4 forwarded route branches try to reach an unreachable
   localhost address from Vercel's serverless environment, breaking 100% of Alerts CRUD traffic
   (GET/POST/PATCH/DELETE, plain + line alerts) the instant the flag went live. Same failure
   class as `LESSONS-LEARNED.md` L21/L32, and the identical incident already happened once before
   at Session 4A-7b (`MONEY_SERVICE_URL` missing) — caught there before flipping, recurred here.
   **Fixed before proceeding, per Davin's live "Go" + explicit fix instructions:** added
   `OPERATION_SERVICE_URL=https://operation-service-production.up.railway.app` (the value already
   documented in `.env.example`, matching the real live `operation-service` Railway HTTP process
   — confirmed via `railway status`, distinct from the separate `operation-service-worker`
   process) to Vercel production via `vercel env add` (value-blind). Redeployed
   (`vercel --prod --archive=tgz`, `dpl_F5VZYwL8FPUiUwJGSHUhjy9VD9R9`) to establish a genuine OFF
   baseline with the var present but `MIGRATE_ALERTS_CRUD` still `false` — verified via
   unauthenticated smoke test (`GET /api/alerts` → `401`, `GET /api/alerts/line` → `401`, site
   root → `200`) before touching the flag, confirming no regression from the env-var addition
   alone. Entry Criterion 4 re-verified true only after this fix, not assumed.
2. _(remaining deviations filled as execution continues)_

---

## Next-session handoff

Session 4B-8 (Drawings & Drawing-Alerts Domain Extraction — `operation-service` PORT).
