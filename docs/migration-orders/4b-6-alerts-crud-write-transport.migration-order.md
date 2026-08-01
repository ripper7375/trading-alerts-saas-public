# Migration Order: Alerts CRUD Monolith Transport Layer (Session 4B-6)

> Migration Order for Session **4B-6** (Alerts CRUD Monolith Transport & Flag Wiring — BUILD).
> Variant: **PORT / UI-BUILD** (Creativity Dial: **LOW** — transport/flag forwarding logic preserving historical API shapes).
> Target Service: Monolith (`lib/operation-service/` & `app/api/alerts/` routes).

**Session:** 4B-6 (BUILD) · **Phase / plan section:** Phase 4B step 6, plan §6
**Target service:** Monolith Next.js App Router (`lib/operation-service/` & `app/api/alerts/**`)
**Variant:** PORT / UI-BUILD · **Status:** CONFIRMED
**Generated:** 2026-08-01 (Advisor upgrade from PRE-DRAFT) · **CONFIRMED:** 2026-08-01 (Davin, live in chat — "Go, approved!")
**Flags touched:** `MIGRATE_ALERTS_CRUD` (default `false` / routes fall back to monolith Prisma logic)
**Contract:** Transport forwarding layer for all 4 Alerts CRUD API endpoints: `GET/POST /api/alerts`, `GET/PATCH/DELETE /api/alerts/[id]`, `GET/POST /api/alerts/line`, `PATCH/DELETE /api/alerts/line/[id]`. Forwards session Bearer tokens, request query params, and raw JSON bodies to `operation-service` when `MIGRATE_ALERTS_CRUD=true`.
**Estimated session time:** ~2.0h

---

## Entry criteria

- [x] Session 4B-5 CONFIRMED and closed (2026-08-01) — all 4 routes live and tested in `operation-service` (`AlertsController` and `LineAlertsController`), commit `4d0c7532` pushed to `origin/main`. Independently re-verified at this CONFIRM: `4d0c7532` IS `origin/main`'s HEAD, and all 4 real 4B-5 code commits (`e6aee8ec`, `d34a2fdc`, `75038d2f`, `463eefbf`) are ancestors of `origin/main` (L38 discipline).
- [x] `MIGRATE_ALERTS_CRUD` verified still unused anywhere in code (`grep` confirmation) — repo-wide grep hits only 3 doc files (this order, `CLAUDE.md`, `migration-stack-analysis.md`), zero code matches.
- [x] `lib/operation-service/client.ts` and `lib/operation-service/cookies.ts` reviewed as the token & HTTP transport baseline — `callOperationServiceWithToken()`/`SESSION_COOKIE_NAME` already exist and match the exact pattern 5 existing 2FA routes use today (verified via `token-2fa-status/route.ts` as a live reference).
- [x] All 4 monolith SOURCE routes (`app/api/alerts/route.ts`, `app/api/alerts/[id]/route.ts`, `app/api/alerts/line/route.ts`, `app/api/alerts/line/[id]/route.ts`) verified clean at 971 lines total — `wc -l`: 244+304+235+188=971, exact match.

**CONFIRM note (2026-08-01):** order arrived at `Status: DRAFT` (not APPROVED) — genuinely, consistently (no L11-style self-contradiction; header matches its own commit trail, `9e36ed18`). Reported this gap to Davin directly rather than silently promoting it; Davin gave live explicit approval in chat ("Go, approved!") before this CONFIRM. Zero codebase drift found between drafting (`4d0c7532`/`9e36ed18`, both 2026-08-01) and this CONFIRM — no intervening commits touch `app/api/alerts/**`, `lib/operation-service/**`, or `operation-service/src/alerts/**`. Baseline `tsc --noEmit` clean. One real gap found in the order's own text, not a blocker but noted for execution: Steps 4-5's cited "Verification" file (`__tests__/drawing/alertsApi.test.ts`) only tests a CLIENT-side fetch wrapper (`components/charts/drawing/alertsApi.ts`), never the server route handlers — repo-wide search confirms zero existing tests import from `app/api/alerts/line/*` at all (same L27/L28-class gap 4B-5 already hit on this identical file). New tests will be authored directly against the real route handlers during Steps 4-5 execution instead of relying on that citation.

---

## Integration points & Scope

- **In:** Monolith App Router Next.js route handlers (`app/api/alerts/**`).
- **Out:** HTTP fetch calls to `operation-service` (`${OPERATION_SERVICE_URL}/alerts/*`) carrying NextAuth JWE `Bearer` tokens.
- **Scope:**
  - **In:** Feature flag declaration `shouldUseOperationServiceForAlertsCrud()`, transport helper `forwardRequestToOperationService()`, and flag-check wiring in all 4 monolith route handlers.
  - **Out:** Flipping flag to `true` (Session 4B-7 Cutover), modifying `operation-service` code, or deleting monolith routes.

---

## Ordered Implementation Steps

### Step 0: Feature Flag & Operation-Service Token Helper

- **MODIFY:** `lib/operation-service/flags.ts`
- **MODIFY:** `lib/operation-service/client.ts` or `lib/operation-service/routes.ts`
- **Actions:**
  - Add `shouldUseOperationServiceForAlertsCrud(): boolean` checking `process.env['MIGRATE_ALERTS_CRUD'] === 'true'`.
  - Add `getOperationServiceToken(): Promise<string | null>` reading `SESSION_COOKIE_NAME` from Next.js `cookies()`.
- **Verification:** `tsc --noEmit` clean.
- **Commit:** `feat(operation-service): add MIGRATE_ALERTS_CRUD feature flag and token helper`

---

### Step 1: Forwarding Transport Helper (`forwardRequestToOperationService`)

- **NEW FILE:** `lib/operation-service/write-routes.ts` (or add to `lib/operation-service/routes.ts`)
- **Actions:**
  - Implement `forwardRequestToOperationService<T>(request: NextRequest, path: string, options?: { method?: string; body?: string }): Promise<T>`.
  - Extract session Bearer token via `getOperationServiceToken()`. Return 401 if unauthenticated.
  - Forward raw request body, headers (including `x-correlation-id` if present), and HTTP method to `${OPERATION_SERVICE_URL}${path}` via `callOperationServiceWithToken()`.
  - Catch `OperationServiceError` and return standardized `NextResponse.json(error.body, { status: error.status })`.
- **Verification:** `tsc --noEmit` clean.
- **Commit:** `feat(operation-service): build forwardRequestToOperationService transport helper`

---

### Step 2: Wire Plain Alerts List & Create (GET / POST /api/alerts)

- **MODIFY:** `app/api/alerts/route.ts` (244 lines)
- **Actions:**
  - At the start of `GET` and `POST` handlers (after auth verification), check `if (shouldUseOperationServiceForAlertsCrud())`.
  - When flag is `true`, delegate to `forwardRequestToOperationService()` passing path `/alerts` (and query params for `GET`).
  - Fall through to existing Prisma logic when flag is `false` (default).
- **Verification:** `npm run test:ci` (or `__tests__/api/alerts.test.ts`) passes clean with flag `false`.
- **Commit:** `feat(alerts): wire MIGRATE_ALERTS_CRUD flag check in GET and POST /api/alerts`

---

### Step 3: Wire Plain Alert Detail, Update & Delete (GET / PATCH / DELETE /api/alerts/[id])

- **MODIFY:** `app/api/alerts/[id]/route.ts` (304 lines)
- **Actions:**
  - At top of `GET`, `PATCH`, and `DELETE` handlers (after auth verification), check `if (shouldUseOperationServiceForAlertsCrud())`.
  - When flag is `true`, delegate to `forwardRequestToOperationService()` passing `/alerts/${id}`.
  - Fall through to existing Prisma logic when flag is `false` (default).
- **Verification:** `__tests__/api/alerts.test.ts` passes clean with flag `false`.
- **Commit:** `feat(alerts): wire MIGRATE_ALERTS_CRUD flag check in GET, PATCH, DELETE /api/alerts/[id]`

---

### Step 4: Wire Line Alerts List & Attach (GET / POST /api/alerts/line)

- **MODIFY:** `app/api/alerts/line/route.ts` (235 lines)
- **Actions:**
  - At top of `GET` and `POST` handlers (after auth verification), check `if (shouldUseOperationServiceForAlertsCrud())`.
  - When flag is `true`, delegate to `forwardRequestToOperationService()` passing `/alerts/line` (and query params for `GET`).
  - Fall through to existing Prisma logic when flag is `false` (default).
- **Verification:** `__tests__/drawing/alertsApi.test.ts` passes clean with flag `false`.
- **Commit:** `feat(alerts): wire MIGRATE_ALERTS_CRUD flag check in GET and POST /api/alerts/line`

---

### Step 5: Wire Line Alert Update & Delete (PATCH / DELETE /api/alerts/line/[id])

- **MODIFY:** `app/api/alerts/line/[id]/route.ts` (188 lines)
- **Actions:**
  - At top of `PATCH` and `DELETE` handlers (after auth verification), check `if (shouldUseOperationServiceForAlertsCrud())`.
  - When flag is `true`, delegate to `forwardRequestToOperationService()` passing `/alerts/line/${id}`.
  - Fall through to existing Prisma logic when flag is `false` (default).
- **Verification:** `__tests__/drawing/alertsApi.test.ts` passes clean with flag `false`.
- **Commit:** `feat(alerts): wire MIGRATE_ALERTS_CRUD flag check in PATCH and DELETE /api/alerts/line/[id]`

---

## Slice-level verification (done when)

- [x] All 4 monolith alert route files (`app/api/alerts/**`) wired with `shouldUseOperationServiceForAlertsCrud()` check.
- [x] `MIGRATE_ALERTS_CRUD` defaults `false` everywhere (zero production traffic cut over) — grep confirms it is set nowhere (code or environment).
- [x] Monolith `tsc --noEmit` and `eslint --max-warnings 0` clean.
- [x] Monolith test suite 100% green — grew 118/118 suites, 2096/2096 tests (4B-3's baseline, last time
      the monolith suite was independently re-run — 4B-4/4B-5 were operation-service-only sessions) to
      **120/120 suites, 2129/2129 tests** this session (+2 new suites: `write-routes.test.ts`,
      `alerts-line.test.ts`; +33 tests across those 2 new files + additions to the existing
      `alerts.test.ts`). `npm run test:ci` exit 0.
- [x] `operation-service` untouched this session (verified via `git status`, checked repeatedly throughout).

---

## Rollback

Revert transport commits in monolith. `MIGRATE_ALERTS_CRUD` remains `false` / un-set in production so zero runtime behavior changes.

---

## Deviations

1. **Order arrived `Status: DRAFT`, not `APPROVED`, at CONFIRM** — genuinely, consistently (header
   matched its own commit trail, `9e36ed18`; no L11-style self-contradiction). Reported to Davin
   directly rather than silently promoting it; Davin gave live explicit approval in chat
   ("Go, approved!") before execution began. See the Entry criteria CONFIRM note above.
2. **Steps 4-5's own cited "Verification" file doesn't test what it claims.**
   `__tests__/drawing/alertsApi.test.ts` only imports `components/charts/drawing/alertsApi.ts`'s
   CLIENT-side fetch wrapper — it never touches `app/api/alerts/line/route.ts` or
   `app/api/alerts/line/[id]/route.ts` at all (verified: repo-wide search found ZERO existing test
   files importing from `app/api/alerts/line/*` before this session). Same L27/L28-class gap
   Session 4B-5 already hit on this identical file (operation-service side). Authored real coverage
   instead: new `__tests__/api/alerts-line.test.ts` (16 tests — auth/tier baseline behavior, one
   real Prisma-path happy case per handler, and both flag-on forwarding + `OperationServiceError`
   mapping for all 4 line-alert handlers), plus 12 new tests added to the existing
   `__tests__/api/alerts.test.ts` for the 2 plain-alert route files.
3. **Step 0's alternate target (`lib/operation-service/routes.ts`) doesn't exist.** Added
   `getOperationServiceToken()` to `client.ts` instead (the file the order's own Step 0 line named
   first). No `routes.ts` was created — `write-routes.ts` (Step 1) is a self-contained, generic
   forwarder rather than a set of per-endpoint typed wrappers, so nothing needed it.
4. **`forwardRequestToOperationService()` returns `{status, body}`, not the order's literal
   `Promise<T>` (body-only).** Two of the four forwarded routes (`POST /alerts` create, `POST
/alerts/line` attach) have an existing, documented `201 Created` contract
   (`app/api/alerts/route.ts`'s original `POST` handler, `app/api/alerts/line/route.ts`'s original
   `POST` handler) — a body-only passthrough (`NextResponse.json(body)`, defaulting to `200`) would
   have silently downgraded every forwarded create response from `201` to `200`. Added a new
   `callOperationServiceWithTokenStatus()` to `client.ts` (mirrors `callOperationServiceWithToken()`
   but also returns the real `response.status`) so the forwarder can preserve it. Every route
   handler now does `NextResponse.json(body, { status: opStatus })` on the flag-on path — verified
   with a dedicated test (`POST /api/alerts forwards to operation-service and preserves a 201
Created`, and the line-alert equivalent).
5. **Flag-check placement: consistently right after the existing auth check, before any other
   monolith business logic** (tier gates, input validation, alert-limit/quota checks) — mirrors
   `app/api/checkout/route.ts`'s already-established Session 4A-10a precedent, since
   operation-service's `AlertsController`/`LineAlertsController` (Session 4B-5) already re-implement
   every one of those checks against the identical schema; running them twice would be pure waste,
   not extra safety.
6. **Two safe signature widenings**, same precedent as Session 4A-10a: `app/api/alerts/[id]/route.ts`'s
   `GET` and `DELETE`, and `app/api/alerts/line/[id]/route.ts`'s `DELETE`, had a previously-unused
   `_request: NextRequest` parameter — renamed to `request` since the forwarder needs it. Next.js
   always passes the request object regardless of whether the handler declares a parameter for it,
   so this is zero-risk.
7. **A real `tsc --noEmit` gap the order's own text didn't anticipate.** Unlike the two plain-alert
   route files (`Promise<NextResponse>`, unconstrained), both line-alert route files declare the
   stricter `Promise<NextResponse<ApiResponse>>`. A bare, type-unconstrained
   `forwardRequestToOperationService()` call returns `body: unknown`, and a raw `error.body`
   passthrough (`OperationServiceErrorBody`, which has no `success` field) both failed to typecheck
   against that contract. Fixed with an explicit `<ApiResponse>` type argument on the forward call
   and an `as ApiResponse` cast on the error-passthrough branch — compile-time only, the JSON body
   is still forwarded byte-for-byte, never reshaped or given a synthetic `success` field at runtime.
8. **Incident, disclosed in full, not silently absorbed into a later diff.** A background
   `tsc --noEmit` check launched to verify Step 3 was still running while Step 4's first two edits
   (imports + `GET` flag-check on `line/route.ts`) were made to a different, unrelated-to-Step-3
   file — harmless for Step 3's own commit (which never touched that file), but it meant a LATER
   background check, launched only after every Step 4 edit had been saved and a Step 4 test file
   had already passed, still returned a false "clean" exit 0. Step 4 was committed (`02917e9e`) on
   that basis, with the real type break (Deviation 7, above) already present in it. Caught during
   Step 5's own verification pass (a fresh, uncontaminated `tsc --noEmit` run). Independently
   confirmed the break was genuine and present at `02917e9e` specifically — not just in the
   Step-5-in-progress working tree — by stashing Step 5's uncommitted changes and re-running
   `tsc --noEmit` directly against that commit alone (4 real `TS2322` errors reproduced). Fixed as
   part of Step 5's own commit (`29ab43c5`), which necessarily also carries the corrected
   `line/route.ts`. Root cause and rule for next time: never trust a background verification
   result if ANY edit to a file inside its scan scope happened after the check was launched, even
   if that edit seems unrelated to the step being verified — `tsc --noEmit` scans the whole
   program, not just the files a commit is about to stage. Re-run fresh, immediately before
   trusting a result, with no edits in flight. Recorded as an unpromoted `LESSONS-LEARNED.md`
   candidate (see this file's own header note) rather than a new numbered entry, per the file's
   documented "pause before adding another" instruction while past the active-lessons cap.
9. **Full final verification, this session's own numbers:** `tsc --noEmit` clean, `eslint app
components lib hooks --max-warnings 0` clean (0 errors, 0 warnings), full `npm run test:ci` clean —
   120/120 suites, 2129/2129 tests (was 118/118, 2096/2096 at 4B-3's close, the last time the
   monolith suite was independently re-run). `operation-service` confirmed untouched via `git
status` throughout (zero files changed under `operation-service/`).

---

## Next-session handoff

Session 4B-7 (Alerts CRUD CUTOVER & RETIRE, VERIFY-RETIRE variant) — flip `MIGRATE_ALERTS_CRUD=true` in production, verify end-to-end, retire 4 monolith route files.
