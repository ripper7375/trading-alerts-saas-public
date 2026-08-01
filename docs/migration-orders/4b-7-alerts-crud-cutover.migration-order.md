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
   - **Status: PARTIAL — 1 of 8 actions verified live.** Action 4 (`PATCH /api/alerts/[id]`) is
     confirmed working end-to-end post-fix, via the Pause toggle, persisting across a hard reload
     (see Deviation 6). Actions 1-3 and 5-8 have **not** been individually exercised since the fix.
     Indirect coverage only: the Alerts page renders its list server-side via Prisma rather than
     through `GET /api/alerts`, so that route's forwarded path is still unproven; the 4 line-alert
     actions have no live evidence at all. The `operation-service` boot log confirms all 8 routes
     are _mapped_ and the guard rejects unauthenticated calls, but mapping is not traffic.
     **Carry forward:** exercise the remaining 7 before treating Slice 7 as fully proven.

5. **Monitoring Window & Cutover Confirmation:**
   - Monitor `operation-service` logs for 4xx/5xx errors or correlation ID anomalies.
   - Confirm zero error spikes in Vercel functions or Railway logs.
   - **Status: DONE for the observed window (`11:43Z` onward).** Zero `400`s and zero 5xx since
     deployment `a6d9274c` went active; the only 4xx entries are two deliberate unauthenticated
     `401` probes from this session. Note the success path is **silent by design** (no log line on
     `200`), so log silence alone is not proof of traffic — the positive evidence is Davin's
     hard-reload-persisted Pause plus the pre-fix `400` stream that proves forwarding was active.

6. **Artifact Updates:**
   - Update `docs/migration-orders/migration-cutover-table.md`: Slice 7 row status → `CUT-OVER & LIVE`.
   - Update `CLAUDE.md`: Current state block reflecting Slice 7 live cutover.
   - **Status: DONE** (this session).

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
2. **A second, more severe gap found DURING the flag-flip redeploy itself — `operation-service`'s
   HTTP process had never actually been redeployed with the 4B-5/4B-6 code.** While the first
   `MIGRATE_ALERTS_CRUD=true` redeploy (`dpl_DyGRTzdFA7EVNe6nB1KX2D5zZWrx`) was still building, a
   direct probe of `https://operation-service-production.up.railway.app/alerts` returned
   `404 {"message":"Cannot GET /alerts",...}` — a generic Nest "no matching route" 404, not an
   auth-guard 401. Cross-checked via `railway service list --json`: `operation-service` has
   `"source": null` (no GitHub auto-deploy, confirmed via `railway up`'s only viable manual path,
   `LESSONS-LEARNED.md` L7/L23) and its `latestDeployment.createdAt` was `2026-07-31T17:28:49Z` —
   predating both Session 4B-5 (2026-08-01, added `AlertsModule`/`AlertsController` to
   `app.module.ts`) and 4B-6. Boot-log grep for "alerts" across the last 300 log lines of that
   deployment found nothing. **The code was committed and pushed to `origin/main` (confirmed at
   CONFIRM) but never actually deployed to the running Railway process** — a variant of
   `LESSONS-LEARNED.md` L38 (undeployed-code class), except on the deploy side rather than the
   push side.
   Raced a fix (`railway up . --path-as-root --service operation-service`) against the
   already-in-flight Vercel deploy rather than trying to abort it (Vercel builds cannot be
   cancelled mid-flight once triggered). **The Vercel deploy won the race** — it aliased to
   production (`created` `2026-08-01T05:36:26Z`/`12:36:26 +0700`) before `operation-service`'s own
   redeploy (`created` `2026-08-01T05:38:03Z`) had finished becoming healthy (re-probe at
   `05:40:13Z` was the first to return the correct `401 Missing bearer token` instead of `404`).
   **This means `MIGRATE_ALERTS_CRUD=true` was live in production for approximately 4 minutes
   (`05:36:26`–`05:40:13` UTC) while `operation-service` would have 404'd every forwarded Alerts
   CRUD request.** Per the variant's own rule ("any red result or unexpected 5xx error = immediate
   rollback... L35"), reverted the instant this was understood — removed `MIGRATE_ALERTS_CRUD`
   from Vercel production and redeployed (`dpl_4h4rfB5R3JRMjH4fxKykmntS7muu`,
   `created` `05:46:00Z`) rather than waiting to see if the (by-then-fixed) `operation-service`
   would have made the remaining live window safe — the session's own re-verification discipline
   takes priority over minimizing redeploy count.
   **Evidence checked for real customer impact during the ~4-minute bad window:** grepped the
   PRE-redeploy `operation-service` deployment's own application logs (`railway logs --deployment
6104429e-48da-4497-a27c-c6ed54c0f188 --lines 1000`) for any `alerts`/`404`/`Cannot GET` entry —
   zero matches. Vercel's own `vercel logs <deployment>` CLI command in this environment behaves
   as a live tail rather than a historical query and returned nothing to inspect after the fact —
   inconclusive on the monolith side specifically, so real customer impact during the ~4-minute
   window cannot be ruled out with full certainty, only judged unlikely given no matching
   operation-service log evidence. Recorded here in full rather than glossed over.
   **Root cause, not yet fixed as a systemic gap:** `operation-service` has no CI/CD trigger tied
   to `origin/main` merges — every session that changes its code must remember to also run a
   manual `railway up` deploy, and nothing catches a session that forgets (as 4B-5/4B-6 did here).
   Recorded as a new `LESSONS-LEARNED.md` candidate below; consider proposing a GitHub-source
   connection for `operation-service` (closing this gap and the separately-tracked
   Waiting-on #77 `railway up`-reliability gap in the same move) as a future INFRA session's scope.
3. **The flag was re-enabled after Deviation 2's revert, and the cutover then ran BROKEN in
   production for roughly 5 hours before anyone noticed.** Deviation 2 records
   `MIGRATE_ALERTS_CRUD` being removed from Vercel production at `05:46:00Z`
   (`dpl_4h4rfB5R3JRMjH4fxKykmntS7muu`). It was subsequently re-added — `vercel env ls production`
   shows `MIGRATE_ALERTS_CRUD` created ~`06:20Z` and `OPERATION_SERVICE_URL` ~`05:20Z`. No order
   step, Deviation, or commit records that re-enable; it is reconstructed here from the live Vercel
   env listing plus `operation-service`'s own request logs. **From that point every real
   authenticated `PATCH /api/alerts/[id]` returned `400`** — see Deviation 4. The user-visible
   symptom was the Alerts page's Pause/Resume button: `alerts-client.tsx`'s `handleTogglePause`
   applies an optimistic update, gets `!response.ok`, and calls `setAlerts(previousAlerts)`, so the
   card flipped to "Paused" and snapped back to "Active" ~200ms later. Reported by Davin as a UI
   bug, diagnosed in this session as the cutover's own failure.

4. **Root cause of the `400`s: a NestJS pipe-binding scope bug in the DEPLOYED
   `AlertsController`, not the request body.** The deployed controller (Session 4B-5's original
   `d34a2fdc`) bound validation at the METHOD level:
   `@Patch(':id') @UsePipes(new ZodValidationPipe(updatePlainAlertSchema))`. A method-level
   `@UsePipes` binds to **every** parameter of the handler, including `@Param('id') id: string` —
   so Zod ran `z.object().safeParse("cmsa66etf00010fpg4qypdlyx")` against the route id and threw
   `400 "Expected object, received string"`. Confirmed two ways rather than asserted: (a) live
   Railway logs show that exact message, hundreds of times, **only** on `/alerts/<id>` paths and
   never on `POST /alerts` (which has no `:id` parameter); (b) a throwaway local reproduction
   (two controllers, method-level vs. `@Body`-level, real `Test.createTestingModule` +
   `supertest`) returned `400 {"error":"Invalid input","message":"Expected object, received
string",...}` vs `200` respectively — a byte-for-byte match to production. The reproduction spec
   was deleted after use (`git status` on `operation-service/` verified clean).
   This also explains why the three prior in-pipe band-aids did not help: `7356ccda`
   ("validate request body only"), `b212af71` ("parse JSON string bodies"), and `59692fbe`
   ("recursively unwrap double-stringified JSON") all patched the pipe's _value handling_, but
   `JSON.parse("cmsa66etf…")` throws, the unwrap loop breaks, and the raw string still fails
   `z.object()`. The correct fix — `ad0f50c2`, moving the pipe to
   `@Body(new ZodValidationPipe(...))` — was already committed and pushed at `10:36:18Z`.
   **`LESSONS-LEARNED.md` candidate:** a method-level `@UsePipes` applies to every handler
   parameter, not just `@Body` — never attach a body-shaped schema at method level on a route
   that also takes `@Param`/`@Query`.

5. **The real blocker was that `ad0f50c2` had never been deployed — 8 consecutive
   `operation-service` deploys FAILED, from `10:09Z` through `11:33Z`, for TWO independent
   reasons introduced hours apart.** The last SUCCESS was `c0639a86` at `05:38:03Z`; Railway kept
   serving it, so production ran pre-`ad0f50c2` code the whole time. Causes:
   (a) **Healthcheck** — `operation-service` had no `railway.json` of its own, so deploys
   inherited the repo-root one: `healthcheckPath: "/"` and `startCommand: "pnpm run start"`.
   Verified live: `GET /` → `404`, `GET /health` → `200` (only `HealthController` maps `/`-level
   routes, at `/health`). The container is built with `npm ci`, so `pnpm run start` is also wrong.
   This accounts for the `10:09Z` and `10:13Z` failures.
   (b) **Source code stripped from the upload** — commit `fa72fe44` (nominally a tier-lookup fix)
   also expanded the repo-root `.railwayignore` from 7 lines to 58 at `10:29:03Z`, adding bare
   `docs`, `public`, `frontend`, and **`src`**. `.railwayignore` uses gitignore semantics, so a
   bare name matches at ANY depth, and `railway up --path-as-root` indexes from the _project
   directory_ (repo root), not the path argument. This silently excluded `operation-service/src`,
   `operation-service/packages/types/src`, and `src/common/middleware` from the archive, leaving
   `nest build` nothing to compile. Accounts for every failure from `10:29Z` onward.
   **A diagnostic trap worth recording:** `railway logs --build` repeatedly returned a _stale
   cached_ build log — container image digest `7427c9bf…`, `created: 2026-08-01T05:38:22Z` —
   which made the failing builds look successful. The tell was the image digest and its embedded
   creation timestamp; the eventual good build produced a genuinely new digest, `7bcd8acb…` at
   `11:42:56Z`. Do not trust `railway logs --build` output without checking the digest/timestamp.
   `railway logs --deployment <failed-id>` returns nothing at all for FAILED deployments, and the
   deployment record exposes no error/reason field, so neither is a usable discriminator.

6. **Fix applied and verified (commit `e68a244e`).** Two changes, both minimal and
   intent-preserving: created `operation-service/railway.json`
   (`healthcheckPath: "/health"`, `startCommand: "npm run start"`, `healthcheckTimeout: 300`,
   `restartPolicyType: "ON_FAILURE"`); and anchored the two colliding root-`.railwayignore`
   entries to repo-root-only (`src` → `/src`, `middleware` → `/middleware`). Both are real
   repo-root directories, so anchoring preserves the original exclusion intent exactly while no
   longer matching nested paths in sub-service uploads — this also protects `money-service`, which
   has its own `src/`. Verified before editing that these were the only two entries colliding with
   `operation-service`'s tree (`dist`/`node_modules` also collide but are correctly excluded, being
   regenerated by `npm ci` + `prebuild`).
   **Verification, all live:** deployment `a6d9274c` **SUCCESS** and now the ACTIVE deployment
   (replacing `c0639a86`); new image `7bcd8acb…` built `11:42:56Z`; `GET /health` → `200`;
   `Nest application successfully started` with zero errors; `AlertsController {/alerts}` and
   `LineAlertsController {/alerts/line}` both resolved, with `{/alerts/:id, PATCH}` mapped;
   unauthenticated `PATCH /alerts/testid` → `401` (route registered, `JwtAuthGuard` intact);
   `operation-service` `tsc --noEmit` clean (exit 0) and a clean-state `npm run build` (both
   `dist/` trees removed first) green locally. **Live end-to-end confirmed by Davin:** clicking
   Pause on production moves the alert to the Paused tab and it REMAINS paused across a Ctrl+F5
   hard reload — the hard reload is the load-bearing part, since `app/(dashboard)/alerts/page.tsx`
   is `force-dynamic` and re-reads from Postgres, so persistence proves a real DB write rather
   than surviving optimistic state. Zero `400`s in `operation-service` logs since `11:43Z`.
   Production was never degraded during any of the four deploy attempts this session — the old
   deployment kept serving throughout.

7. **Residual gap, NOT closed this session:** `operation-service` still has no GitHub source
   (`railway service list --json` → `"source": null`), so `git push` can never deploy it and every
   future session touching its code must remember a manual `railway up`. This is the same systemic
   root cause Deviation 2 already identified, and it is what allowed 4B-5/4B-6's code to sit
   undeployed. Now compounded by a second finding: `railway up` must be run as
   `railway up ./operation-service --path-as-root --service operation-service` **from the repo
   root**, and it silently honours the repo-root `.railwayignore` — so the ignore file and the
   deploy command are coupled in a non-obvious way. Connecting a GitHub source would close this,
   Waiting-on #77, and the `railway up`-reliability gap (L23) in one move. Recommended as a future
   INFRA session's scope; deliberately not attempted here (deploy-topology change,
   `EXECUTOR-PROTOCOL.md` §7).

---

## Next-session handoff

Session 4B-8 (Drawings & Drawing-Alerts Domain Extraction — `operation-service` PORT).
