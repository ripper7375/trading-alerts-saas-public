# Migration Order — Session 7-3 — API Client Contract Tests, Documentation & stackA/stackB Retirement (Phase 7 Exit Review)

> Third and final session of Phase 7 (API Client Rewrite). Per the session playbook's own Session
> 7-3 entry ("Contract tests + docs (phase exit)") and Session 7-1/7-2's own Next-session handoffs:
> build comprehensive contract tests against recorded real responses (L1/L31 compliant), retire
> `stackA`/`stackB` and legacy client tests, annotate stale design docs, author canonical API
> client architecture documentation, and execute the final Phase 7 exit review.
> Adapted from `TEMPLATE-PORT.md` / `TEMPLATE-CONTRACT.md` hybrid — dial **LOW**: behavior
> preservation, dead code elimination, and high-fidelity contract verification.

**Session:** 7-3 · **Phase:** Phase 7 (API Client Rewrite — Phase Exit) · **Variant:** PORT/CONTRACT hybrid (exit-review flavor) · **Status:** CONFIRMED (Executor, 2026-08-20 — re-verified against live code/runtime, Davin confirmed the APPROVED batch authentic live) · **Generated:** 2026-08-20 (Advisor upgrade from PRE-DRAFT) · **Flags touched:** none (pure test/doc/retirement cleanup) · **Estimated time:** 2–3h

**Surface:**

- `lib/api/index.ts` (retire `stackA`, `stackB`, `api`, and legacy type definitions).
- `__tests__/lib/api/` (delete `stack-a-client.test.ts`, `stack-b-client.test.ts`, and expand `generated-clients.test.ts` into a full contract test suite against recorded real responses; delete `__tests__/integration/api-client-workflow.test.ts`).
- `backend-stack-a/api-client-between-frontend-and-stack-b/` (annotate 5 stale design docs with deprecation/retirement notices).
- `docs/architecture/api-client-architecture.md` (author canonical documentation for the generated API client system).

**Feeds on:** `7-2-api-client-migrate-consumers.migration-order.md` (CLOSED SUCCESSFUL 2026-08-20); `lib/api/generated/{operation-api,money-api}/{schema.ts,client.ts}` (Session 7-1); consumer migrations completed in Session 7-2.

---

## Decisions taken

1. **Retirement of `stackA`, `stackB`, `api`, and legacy type interfaces from `lib/api/index.ts`**
   - **Chosen:** **RETIRE (delete)** `stackA`, `stackB`, the default/named `api` object export, and unused legacy type definitions (`AlertData`, `UserData`, `SubscriptionData`, `PaymentData`, `SettingsData`, `QueryParams`) from `lib/api/index.ts`. The module will strictly export `createOperationApi`, `createMoneyApi`, `unwrapOperationApi`, `unwrapMoneyApi`, `getOperationServiceToken`, `getMoneyServiceToken`, and their generated TypeScript interfaces.
   - **Rejected:** Retaining `stackA`/`stackB` as `@deprecated` stubs.
   - **Rationale:** All monolith route handlers were rewired to `operationApi`/`moneyApi` in Session 7-2. A fresh grep confirms ZERO real consumers across `app/`, `components/`, and `hooks/`. Deleting them fulfills Phase 7's core objective, removes 200+ lines of dead, known-broken legacy code, and permanently eliminates the drift surface.
   - **Undo cost:** Low (`git revert`).

2. **Retirement of legacy client tests (`stack-a-client.test.ts`, `stack-b-client.test.ts`, `api-client-workflow.test.ts`)**
   - **Chosen:** **DELETE** `__tests__/lib/api/stack-a-client.test.ts`, `__tests__/lib/api/stack-b-client.test.ts`, and `__tests__/integration/api-client-workflow.test.ts`.
   - **Rejected:** Attempting to patch tests that only assert obsolete, deleted methods.
   - **Rationale:** These test files exclusively test the deleted `api.stackA`/`api.stackB` methods. Retiring them cleans the test harness. They are superseded by the new contract test suite covering `operationApi` and `moneyApi`.
   - **Undo cost:** Low (`git revert`).

3. **Contract test design & recorded real response strategy (`LESSONS-LEARNED.md` L1, L31, L32)**
   - **Chosen:** Expand `__tests__/lib/api/generated-clients.test.ts` into a comprehensive contract test suite covering core domain operations across both services (alerts, auth, drawings, notifications, user preferences, affiliates, wise disbursement, cron triggers) using recorded realistic response fixtures. Mocks must comply with **L31** (use real `new Response(JSON.stringify(fixture), { status, headers })` and real `Request` object assertions). Respect **L1** (never run database migrations or schema mutations from test runners or `money-service`).
   - **Rejected:** Relying on live network round-trips against staging containers during unit test execution.
   - **Rationale:** Verifies URL construction, path parameter interpolation, query string serialization (L32 cast pattern), `/v1` prefix routing, Bearer token injection/omission, status code fidelity (200, 201, 204), and error unwrapping (`OperationServiceError`/`MoneyServiceError` on 4xx/500) against authentic payload schemas with fast, deterministic CI execution.
   - **Undo cost:** Low.

4. **Treatment of legacy design docs in `backend-stack-a/` & new architecture reference**
   - **Chosen:** Prepend a standard deprecation/retirement notice to the 5 files in `backend-stack-a/api-client-between-frontend-and-stack-b/` (marking them historical and superseded by Phase 7 generated OpenAPI clients), and create a unified, authoritative documentation document at `docs/architecture/api-client-architecture.md`.
   - **Rejected:** Silently deleting historical design records without leaving an audit trail or updated architecture reference.
   - **Rationale:** Preserves historical git/design context while providing a single, truthful architectural guide for the generated client system.
   - **Undo cost:** Low.

5. **Handling of generated-spec query-param / body gaps (`LESSONS-LEARNED.md` L32 / Waiting-on #136)**
   - **Chosen:** Formally document the known `@nestjs/swagger` limitations (generic body schemas and `parameters.query?: never` for Zod-validated routes) and the standard workaround pattern (the single-cast `pathWithQuery` / `buildQuery` helper proven in Session 7-2) in `docs/architecture/api-client-architecture.md`. Defer full Zod-to-OpenAPI decorator conversion to a future stack hardening session (e.g. before Session 12-0 OpenAPI freeze).
   - **Rejected:** Attempting a massive 107-route Zod-to-OpenAPI decorator overhaul inside a LOW-dial exit review session.
   - **Rationale:** Session 7-2 proved the cast pattern works reliably with 100% test coverage and zero runtime defects; a full schema decorator refactor across two microservices is a large BUILD session in its own right.
   - **Undo cost:** Low.

---

## Context

Session 7-1 generated the typed OpenAPI clients (`lib/api/generated/`). Session 7-2 migrated all live monolith consumers (8 auth bridge routes, admin cron trigger, 18 money-service helper wrappers), enforced direct microservice fetch prohibition via ESLint, and retired the 6 dead `token-2fa-*` routes. Session 7-3 is the final session of Phase 7, closing the phase by retiring legacy `stackA`/`stackB` code, establishing high-fidelity contract tests, and updating documentation.

### Established ground truth:

- **Zero consumers:** `stackA`/`stackB` have 0 importers across `app/`, `components/`, and `hooks/`.
- **Baseline test suite:** Monolith baseline is **163/163 suites, 2412/2412 tests** (post Session 7-2).
- **ESLint baseline:** 0 errors, **5** pre-existing routing-method warnings in `app/`.

---

## Entry criteria

- [x] Session 7-2 CONFIRMED, executed, CLOSED SUCCESSFUL (confirmed in `CLAUDE.md`, 2026-08-20).
- [x] `lib/api/index.ts` re-read at CONFIRM — confirm zero real consumers of `stackA`/`stackB` across `app/`, `components/`, `hooks/`. **Fresh grep 2026-08-20: zero matches outside `lib/api/index.ts` itself.**
- [x] Monolith baseline re-measured at CONFIRM (`tsc --noEmit` clean, `eslint app components lib hooks --max-warnings 0` clean [0 errors, 5 pre-existing warnings], `test:ci` green — last known: 163/163 suites, 2412/2412 tests). **Re-measured live 2026-08-20: all three exact matches.**
- [x] Step 0 discovery pass executed fresh at CONFIRM (confirm exact files to delete, update, and test). **Done at CONFIRM — see Deviations.**
- [x] Advisor DRAFT reviewed and Davin APPROVED before execution (2026-08-20). **Uncommitted-order finding (L3) reported to Davin at CONFIRM; Davin confirmed live 2026-08-20 the APPROVED batch (Decisions taken + 5 Ordered Steps) is his authentic edit.**

---

## Integration points

- **In:** `lib/api/generated/{operation-api,money-api}/client.ts` (Session 7-1).
- **Out:** None — external HTTP contracts of route handlers remain 100% byte-for-byte identical.
- **Owns:** `lib/api/index.ts` export cleanup, `__tests__/lib/api/generated-clients.test.ts` expansion, deletion of 3 obsolete test files, annotation of 5 legacy docs, authoring of `docs/architecture/api-client-architecture.md`.

---

## Ordered steps

### Step 0: Discovery & Surface Audit (no code changes)

- **Intent:** Confirm the exact inventory of legacy exports, obsolete test files, and documentation files to modify.
- **Action:**
  - Verify zero importers of `stackA`, `stackB`, or `api` in `app/`, `components/`, `hooks/`, `lib/`.
  - Confirm the 3 obsolete test files to delete:
    - `__tests__/lib/api/stack-a-client.test.ts`
    - `__tests__/lib/api/stack-b-client.test.ts`
    - `__tests__/integration/api-client-workflow.test.ts`
  - Confirm the 5 legacy design doc paths in `backend-stack-a/api-client-between-frontend-and-stack-b/`.
- **Verification:** Inventory recorded in session transcript / Deviations table; zero uncommitted code edits.

### Step 1: Retire `stackA` / `stackB` from `lib/api/index.ts` & Delete Obsolete Test Files

- **Intent:** Clean `lib/api/index.ts` to export only the modern generated client surface, and remove tests for deleted legacy exports.
- **Action:**
  - Edit `lib/api/index.ts`:
    - Remove `stackA`, `stackB`, `api`, `apiCall`, `BASE_URL`, and unused legacy interfaces (`AlertData`, `UserData`, `SubscriptionData`, `PaymentData`, `SettingsData`, `QueryParams`).
    - Keep clean re-exports of `createOperationApi`, `createMoneyApi`, `unwrapOperationApi`, `unwrapMoneyApi`, `getOperationServiceToken`, `getMoneyServiceToken`, and types.
  - Delete obsolete test files:
    - `__tests__/lib/api/stack-a-client.test.ts`
    - `__tests__/lib/api/stack-b-client.test.ts`
    - `__tests__/integration/api-client-workflow.test.ts`
- **Verification:** `tsc --noEmit` clean; `npm test` passes with -3 suites and -37 tests from the deleted obsolete files.
- **Commit:** `refactor(api): retire legacy stackA/stackB from lib/api/index.ts and delete obsolete tests`

### Step 2: Build Comprehensive Contract Tests with Recorded Real Responses

- **Intent:** Expand `__tests__/lib/api/generated-clients.test.ts` into a complete contract test suite verifying client behavior against recorded realistic response fixtures.
- **Action:**
  - In `__tests__/lib/api/generated-clients.test.ts`, add contract test suites covering:
    - **`operationApi` routes:**
      - Alerts: `GET /alerts`, `POST /alerts`, `GET /alerts/{id}`, `PATCH /alerts/{id}`, `DELETE /alerts/{id}`
      - Auth: `POST /auth/login`, `POST /auth/register`, `POST /auth/refresh`, `POST /auth/logout`
      - Users / Settings: `GET /user/preferences`, `PUT /user/preferences`, `GET /user/profile`, `PATCH /user/profile`
      - Drawings: `GET /drawings`, `POST /drawings`
      - Notifications: `GET /notifications`, `POST /notifications/{id}/read`
    - **`moneyApi` routes (with `/v1` prefix & excluded `/health`):**
      - Affiliates: `GET /v1/affiliate/dashboard/stats`, `GET /v1/affiliate/dashboard/codes`
      - Admin: `GET /v1/admin/affiliates`, `GET /v1/admin/analytics`
      - Wise Disbursement: `GET /v1/wise/recipients`, `POST /v1/wise/recipients`, `POST /v1/wise/recipients/{id}/revalidate`
      - Cron Trigger: `POST /v1/cron-trigger/{jobId}`
      - Health checks: `GET /health` (no `/v1` prefix)
    - **Contract checks per endpoint:**
      - Correct URL construction & path parameter interpolation.
      - Query parameter serialization (with `buildQuery`/cast per L32).
      - Authorization header attachment (Bearer token) or omission.
      - Correct unwrapping of 200, 201 Created, 204 No Content responses using recorded real response fixtures.
      - Error handling: throwing `OperationServiceError` or `MoneyServiceError` with status code and body on 400, 401, 403, 404, and 500 responses.
    - **Compliance:** Full compliance with **L31** (real `new Response(JSON.stringify(fixture), { status, headers })` and real `Request` assertions) and **L1** (no DB migrations or mutation calls).
- **Verification:** `tsc --noEmit` clean; `npm test -- __tests__/lib/api/` passes 100%.
- **Commit:** `test(api): add comprehensive contract tests against recorded real responses for generated clients`

### Step 3: Stale Documentation Retirement & Authoritative API Client Architecture Doc

- **Intent:** Update documentation to reflect the modern generated OpenAPI client architecture and mark historical design documents as superseded.
- **Action:**
  - Prepend a deprecation notice header to all 5 files in `backend-stack-a/api-client-between-frontend-and-stack-b/`:
    - `BENEFITS-OF-API-CLIENT.md`
    - `api-client-design.md`
    - `api-client-maintenance-and-updates.md`
    - `api-client-testing.md`
    - `stack-b-integration.md`
      Notice text: `> ⚠️ **HISTORICAL / SUPERSEDED (2026-08-20, Phase 7):** This document describes the legacy Stack A/Stack B API client architecture, which was retired in Phase 7 (Session 7-3). See `docs/architecture/api-client-architecture.md` for the modern generated OpenAPI client system.`
  - Author `docs/architecture/api-client-architecture.md` documenting:
    1. Overview of `operationApi` and `moneyApi`.
    2. Code generation workflow (`npm run generate:api-client` chaining `@nestjs/swagger` emitters + `openapi-typescript`).
    3. Server-only constraint (L6) and error unwrapping conventions (`unwrapOperationApi`/`unwrapMoneyApi`).
    4. ESLint rule prohibiting direct `fetch()` to microservice URLs.
    5. Handling of `/v1` prefix asymmetry and query parameter cast pattern (L32).
- **Verification:** `prettier --check` clean on changed markdown files; no broken internal documentation links.
- **Commit:** `docs(api): document unified api client architecture and mark legacy design docs superseded`

### Step 4: Phase 7 Exit Review & Final Verification Sweep

- **Intent:** Perform the complete phase-exit verification sweep to confirm Phase 7 is clean and ready to close.
- **Action:**
  - Run full test suite (`npm run test:ci`).
  - Run type checker (`npx tsc --noEmit`).
  - Run linter (`npx eslint app components lib hooks --max-warnings 0`).
  - Verify zero remaining references to `stackA`, `stackB`, or deprecated API types in the repo.
- **Verification:** `tsc --noEmit` clean; `eslint` clean (0 errors, 5 pre-existing warnings); `test:ci` clean (160 suites, ~2390+ tests, zero regressions).
- **Commit:** `chore(api): complete phase 7 exit review and verify clean test baseline`

---

## Rules specific to this variant

- **L1 Strict Compliance:** Never run Prisma migrations or schema push commands (`prisma db push`, `prisma migrate deploy`) from `money-service` or test runners.
- **L31 Strict Compliance:** All mocks must use real `new Response(JSON.stringify(body), { status, headers })` and assertions must inspect real `Request` instances.
- **L32 Awareness:** Query parameters on generated clients require the established `buildQuery` / single-cast pattern.
- **Server-Only Invariant (`LESSONS-LEARNED.md` L6):** `lib/api/index.ts` is server-only. Never import into `'use client'` files.
- **No Assertion Alterations on Business Logic:** Existing route tests must pass unmodified.

---

## Done when

- [ ] `stackA`, `stackB`, `api`, and legacy type interfaces deleted from `lib/api/index.ts`.
- [ ] 3 obsolete test files (`stack-a-client.test.ts`, `stack-b-client.test.ts`, `api-client-workflow.test.ts`) deleted.
- [ ] Comprehensive contract test suite in `__tests__/lib/api/generated-clients.test.ts` passing against recorded real responses (L1/L31 compliant).
- [ ] 5 legacy design docs in `backend-stack-a/api-client-between-frontend-and-stack-b/` annotated with retirement headers.
- [ ] `docs/architecture/api-client-architecture.md` authored and complete.
- [ ] `tsc --noEmit` clean across all workspaces.
- [ ] `eslint app components lib hooks --max-warnings 0` clean (0 errors, max 5 pre-existing warnings).
- [ ] `test:ci` green with 160 suites passing.
- [ ] Phase 7 exit review completed.

---

## Rollback

- `git revert` on the session commits restores `stackA`/`stackB` and legacy test files. Zero database or cross-stack impact.

---

## Retire

- Legacy `stackA`, `stackB`, `api`, and legacy types in `lib/api/index.ts`.
- `__tests__/lib/api/stack-a-client.test.ts`.
- `__tests__/lib/api/stack-b-client.test.ts`.
- `__tests__/integration/api-client-workflow.test.ts`.

---

## Deviations

**Deviation 0 (CONFIRM, before Step 0):** the order file itself arrived modified-but-uncommitted
relative to git HEAD — committed HEAD (`80244c43`) is a bare `PRE-DRAFT` stub with no Ordered
Steps; the working copy carried the full Advisor DRAFT→APPROVED upgrade (`Decisions taken`, 5
Ordered Steps, entry criteria, done-when). `LESSONS-LEARNED.md` L3 pattern, recurring. Reported in
full to Davin before CONFIRM; Davin confirmed live 2026-08-20 the batch is his authentic edit.
Two unrelated files showed the same uncommitted state (`HANDOVER-PROMPT-phase-7.md`, a Phase-9
tracking xlsx) — neither intersects this session's surface, left as-is.

**Deviation 1 (Step 0 discovery, 2026-08-20):** all files the order names were confirmed to exist
exactly as described — 3 obsolete test files (17/13/19 raw occurrences of
`api.stackA`/`api.stackB`/`@/lib/api` respectively, confirming they exclusively test the legacy
exports), 5 legacy docs in `backend-stack-a/api-client-between-frontend-and-stack-b/`,
`docs/architecture/api-client-architecture.md` correctly absent (new file). One citation-drift
note: Step 1's verification text predicts "-3 suites and -37 tests"; actual static `it(`/`test(`
count across the 3 files is **44** (18+18+8), not 37 — no `.each()` blocks to explain the gap.
Corrected expected post-Step-1 baseline: **160 suites, 2368 tests** (2412 − 44).

---

## Known wrinkles / do-not-touch

- `money-service` path prefix asymmetry: `/v1` prefix is required for all routes except `/health` and `/health-auth`.
- Query parameter cast pattern (L32): Documented in the new architecture guide and used where `parameters.query` is typed `never`.
- Do not touch `lib/operation-service/write-routes.ts` or `lib/money-service/write-routes.ts` (streaming gateway forwarders remain intact).

---

## Next-session handoff

Phase 7 (API Client Rewrite) closes with Session 7-3. Next is **Phase 4X** (Carry-Forward Money Cutovers): **Session 4A-13** (`4a-13-stripe-webhook-cutover.migration-order.md` — Stripe Webhook Cutover to `money-service`).
