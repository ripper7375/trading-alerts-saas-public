# Migration Order — Session 7-1 — API Client Re-verify + Generate (Phase 7 Open)

> First session of Phase 7 (API Client Rewrite). Per the session playbook's own Session 7-1 entry ("Re-verify + generate"): re-read the `lib/api/` mismatch list against live NestJS routes, generate clean, typed service client modules (`operationApi` and `moneyApi`) from auto-emitted NestJS OpenAPI specs (`@nestjs/swagger`), and correct pre-existing OpenAPI spec drift.
> Adapted from `TEMPLATE-CONTRACT.md`, dial **MEDIUM**.

**Session:** 7-1 · **Phase:** Phase 7 (API Client Rewrite) · **Variant:** CONTRACT/PORT hybrid · **Status:** CONFIRMED · **Generated:** 2026-08-12 · **Flags touched:** none (scope decision recorded in `DECISION-LOG.md`; no backend traffic flag touched) · **Estimated time:** ~4-6h

> **CONFIRM note (Executor, 2026-08-12):** PD1 batch and this order's APPROVED status confirmed
> live by Davin as authentic before execution. All 6 entry criteria independently re-verified
> against live code/runtime (path counts, `lib/api/` mismatch list, tsc/eslint/test baselines for
> all 3 codebases) — zero failed, one flaky test noted (money-service's
> `prisma.shutdown.spec.ts`, passes in isolation and on retry). Drift-report breakdown errors
> found and reconciled — see Deviation 0.

**Surface:** `lib/api/index.ts` (the standing broken-by-design unified client, `EXECUTOR-PROTOCOL.md` §5's standing entry — finally touched here), `lib/api/generated/` (new generated client modules), `operation-service/src/` & `money-service/src/` (OpenAPI spec emission setup), and `docs/open-api-documents/` (spec correction & generated service specs).

**Feeds on:** `migration-stack-analysis.md`'s `lib/api/` appendix flag (original mismatch list); `docs/open-api-documents/OPENAPI-DRIFT-REPORT-pre-phase-7.md` (2026-08-11 drift audit); and `CLAUDE.md` Waiting-on items #132–#134.

---

## Decisions taken

> **Advisor decisions for Davin's review at BEAT 2 (APPROVED checkpoint):**

1. **Scope Decision: Option (b) — Emit specs from NestJS via `@nestjs/swagger` + Generate Typed Service Clients**
   - **Chosen:** Option (b). Add `@nestjs/swagger` spec emission to `operation-service` and `money-service` to output OpenAPI v3 schemas from live NestJS DTOs/controllers, then generate typed client SDKs (`operationApi` and `moneyApi`) into `lib/api/generated/`.
   - **Rejected:** Option (a) (hand-authoring 107 NestJS service specs — rejected due to high labor and ongoing drift risk) and Option (c) (monolith-only client generation — rejected because it leaves 107 NestJS service endpoints permanently undocumented and un-typed for server-side callers).
   - **Rationale:** Option (b) directly eliminates contract drift at the source — emitted specs cannot drift from the code because the code defines the spec. It provides end-to-end type safety from NestJS DTOs to Next.js server-side callers (`callOperationService`/`callMoneyService`).
   - **Undo Cost:** Low. Generation outputs to `lib/api/generated/` and `docs/open-api-documents/generated/`.

2. **Service Global Prefix Asymmetry Encoding**
   - **Chosen:** Explicitly configure base paths in generated client factories: `moneyApi` defaults to `/v1` prefix (excluding `/health`), while `operationApi` defaults to root `/` prefix.
   - **Rejected:** Uniform prefix assumption across services.
   - **Rationale:** `money-service` explicitly invokes `app.setGlobalPrefix('v1', { exclude: ['health', 'health-auth'] })` in `main.ts`, whereas `operation-service` uses no global prefix. The client generator must encode this asymmetry.
   - **Undo Cost:** Very low (configuration option in client setup).

3. **`token-*` Auth Bridge Liveness & Dead Route Pruning**
   - **Chosen:** Audit all 15 `token-*` auth endpoints (14 `token-*` routes + 1 `[...nextauth]`). Exclude the 6 dead `token-2fa-*` endpoints (superseded in Session 4B-22 by `/api/user/2fa/*`) from generated client methods, and treat `[...nextauth]` as internal-only.
   - **Rejected:** Spec'ing and generating client methods for dead `token-2fa-*` routes.
   - **Rationale:** Prevents cluttering the API client with obsolete, unused endpoints.
   - **Undo Cost:** Low.

4. **Correction of Genuinely-Wrong Monolith OpenAPI Specs**
   - **Chosen:** Unconditionally fix the 4 wrong paths in `docs/open-api-documents/` (`/api/auth/register` deletion in `part-05`; fix `/api/disbursement/batches` and `/api/disbursement/batches/{id}/execute` paths in `part-19.5` by removing `admin` segment; fix `/api/wise/recipients/{id}/revalidate` path in `part-19.5`), and mark `part-08-dashboard-layout-openapi.yaml` as non-REST UI page route inventory (removing obsolete `/dashboard/watchlist`).
   - **Rejected:** Leaving known invalid routes in monolith OpenAPI documents.
   - **Rationale:** Fixes client generator errors and eliminates path mismatch bugs.
   - **Undo Cost:** Low.

---

## Context

`lib/api/index.ts` has been on `EXECUTOR-PROTOCOL.md` §5's standing do-not-touch list throughout the migration — deliberately left broken-by-design until all underlying domain services were stabilized. With Phase 6 closed and all domain slices cut over, Phase 7 opens to rewrite the API client layer.

The pre-Phase 7 OpenAPI drift audit (`docs/open-api-documents/OPENAPI-DRIFT-REPORT-pre-phase-7.md`) revealed that existing specs described only monolith `/api/*` routes (112 paths), leaving 107 NestJS service routes undocumented. By adopting Option (b), Session 7-1 establishes automated spec emission from NestJS controllers/DTOs, generates clean typed service clients (`operationApi` and `moneyApi`), re-verifies historical mismatch items, and fixes monolith spec path errors.

## Entry criteria

- [ ] Session 6-12 and post-6-12 ad-hoc exit repair CONFIRMED and CLOSED (Phase 6 closed).
- [ ] Re-verify `migration-stack-analysis.md` `lib/api/` appendix flag mismatches (alerts PUT vs PATCH, notification read path, preferences PATCH vs PUT, market-data path shape) against current live NestJS controllers.
- [ ] Monolith baseline re-measured at CONFIRM (`tsc --noEmit` clean, `eslint app components lib hooks --max-warnings 0` clean [4 pre-existing warnings], `test:ci` green — last known baseline: 153/153 suites, 2344/2344 tests).
- [ ] `operation-service` baseline re-measured at CONFIRM (`tsc --noEmit` clean, 42/42 suites, 393/393 tests).
- [ ] `money-service` baseline re-measured at CONFIRM (`tsc --noEmit` clean, 62/62 suites, 522/522 tests).
- [ ] Advisor DRAFT reviewed and Davin APPROVED before execution — not fast-path eligible.

## Integration points

- **In:** Live `operation-service` (62 routes across 10 controllers) and `money-service` (45 routes across 15 controllers) NestJS DTOs/controllers; `docs/open-api-documents/` monolith specs.
- **Out:** Caller/consumer rewiring onto the new client is Session 7-2's scope (this session creates and verifies the generated client, but does not rewire existing call sites).
- **Owns:** `lib/api/index.ts`, `lib/api/generated/`, NestJS `@nestjs/swagger` spec emission scripts/configs, and OpenAPI document fixes in `docs/open-api-documents/`.

## Ordered steps

### Step 1: Re-verify Historical Mismatches & Monolith Spec Path Corrections

- **Intent:** Perform live verification of historical `lib/api/` mismatch list against current NestJS controllers, and fix the 4 genuinely-wrong spec entries.
- **Action:**
  1. Audit live controllers in `operation-service` and `money-service` against `migration-stack-analysis.md` `lib/api/` appendix flag items (alerts PUT vs PATCH, notification read path, preferences PATCH vs PUT, market-data path shape). Record findings.
  2. In `docs/open-api-documents/part-05-auth-openapi.yaml`, remove deleted `/api/auth/register` path.
  3. In `docs/open-api-documents/part-19.5-wise-disbursement-openapi.yaml`, fix `/api/admin/disbursement/batches` -> `/api/disbursement/batches`, `/api/admin/disbursement/batches/{id}/execute` -> `/api/disbursement/batches/{id}/execute`, and `/api/wise/recipients/{id}` -> `/api/wise/recipients/{id}/revalidate`.
  4. In `docs/open-api-documents/part-08-dashboard-layout-openapi.yaml`, add deprecation header noting it contains UI page routes, and remove `/dashboard/watchlist`.
- **Verification:** `tsc --noEmit` clean; inspect modified OpenAPI files for valid YAML syntax.
- **Commit:** `docs(openapi): re-verify mismatch list and fix monolith spec path errors`

### Step 2: Add OpenAPI Spec Emission to NestJS Microservices

- **Intent:** Configure `@nestjs/swagger` in `operation-service` and `money-service` to emit OpenAPI v3 specs directly from NestJS DTOs and controllers.
- **Action:**
  1. Add `@nestjs/swagger` dependency to `operation-service` and `money-service`.
  2. Create a spec generator CLI script or setup in `operation-service` and `money-service` (e.g. `scripts/generate-openapi-spec.ts` or CLI task using `SwaggerModule.createDocument`) to write output specs `docs/open-api-documents/generated/operation-service-openapi.json` and `docs/open-api-documents/generated/money-service-openapi.json`.
  3. Add npm scripts (`"openapi:generate"`) to package manifests.
- **Verification:** Run `npm run openapi:generate` in both services; verify emitted specs contain all 62 `operation-service` paths and 45 `money-service` paths; run `tsc --noEmit` in both services.
- **Commit:** `feat(api): add nestjs swagger openapi spec emission for operation and money services`

### Step 3: Generate Typed Service Clients (`operationApi` & `moneyApi`)

- **Intent:** Generate clean, strongly typed API client modules wrapping `operation-service` and `money-service` REST endpoints.
- **Action:**
  1. Run OpenAPI client generation (e.g. `openapi-typescript` or lightweight client generator) against `operation-service-openapi.json` and `money-service-openapi.json`.
  2. Output generated types and client factories into `lib/api/generated/operation-api/` and `lib/api/generated/money-api/`.
  3. Build client wrappers `operationApi` and `moneyApi` with JWT bearer token injection support, error handling matching `OperationServiceError`/`MoneyServiceError`, and correct base path prefix defaults (`/v1` for `moneyApi`, `/` for `operationApi`).
- **Verification:** `tsc --noEmit` clean in monolith.
- **Commit:** `feat(api): generate operationApi and moneyApi client SDK modules`

### Step 4: Re-architect `lib/api/index.ts` Unified Export Surface

- **Intent:** Replace the legacy broken-by-design `lib/api/index.ts` with unified, typed exports for `operationApi`, `moneyApi`, and legacy monolith endpoints.
- **Action:**
  1. Update `lib/api/index.ts` to export `operationApi` and `moneyApi` factories and types.
  2. Preserve backward-compatible type exports needed by existing modules, while deprecating direct broken legacy functions.
  3. Audit 15 `token-*` auth endpoints (14 `token-*` routes + 1 `[...nextauth]`); exclude dead `token-2fa-*` routes from `operationApi`.
- **Verification:** `tsc --noEmit` clean; `eslint app components lib hooks --max-warnings 0` clean.
- **Commit:** `refactor(api): upgrade lib/api/index.ts to export generated operationApi and moneyApi clients`

### Step 5: Unit Tests for Generated API Clients

- **Intent:** Add contract-style unit tests verifying request formatting, header injection, prefix routing, and error response handling.
- **Action:**
  1. Create `__tests__/lib/api/generated-clients.test.ts`.
  2. Write unit tests for `operationApi` (verifying root prefix, Bearer header attachment, error handling).
  3. Write unit tests for `moneyApi` (verifying `/v1` prefix handling, Bearer header attachment, error handling).
  4. Test edge cases (unauthenticated routes, 401/403/500 status mapping).
- **Verification:** Run `npm run test:ci` in monolith; confirm all tests pass cleanly.
- **Commit:** `test(api): add unit test suite for generated operationApi and moneyApi clients`

---

## Rules specific to this variant

- Ground truth priority: Live NestJS controller/DTO code > Emitted OpenAPI specs > `migration-stack-analysis.md` appendix flag.
- Every claim in the verification pass must cite a live file:line or live route path.
- Consumer rewiring is explicitly deferred to Session 7-2. No existing UI page or route handler call site should be rewired in this session.
- Both `operation-service` and `money-service` test suites must remain clean.

## Done when

- [ ] OpenAPI spec emission script added to both `operation-service` and `money-service`.
- [ ] Emitted specs generated in `docs/open-api-documents/generated/` covering 107 NestJS service routes.
- [ ] `operationApi` and `moneyApi` clients generated and exported from `lib/api/index.ts`.
- [ ] The 4 genuinely-wrong monolith spec paths corrected in `docs/open-api-documents/`.
- [ ] `tsc --noEmit` clean in monolith, `operation-service`, and `money-service`.
- [ ] `eslint app components lib hooks --max-warnings 0` clean (0 errors, max 4 pre-existing warnings).
- [ ] Monolith `test:ci` and service test suites all green.

## Rollback

- All changes are additive client SDK modules and developer tools with zero consumer rewiring. Rollback is `git revert`, with zero runtime impact on live production traffic.

## Retire

- Nothing retired this session (consumer migration and legacy client removal occur in Session 7-2/7-3).

## Deviations

_(to be filled by Executor during execution)_

## Known wrinkles / do-not-touch

- Consumer rewiring is explicitly NOT Session 7-1's scope (Session 7-2).
- `app/test-api/page.tsx` was already deleted in Session 6-12; no test API page remains to delete.
- Browser-never-calls-services invariant verified: [lib/operation-service/client.ts](file:///d:/SaaS%20Project/trading-alerts-saas-public/lib/operation-service/client.ts#L3) and [lib/money-service/client.ts](file:///d:/SaaS%20Project/trading-alerts-saas-public/lib/money-service/client.ts#L3) explicitly document server-only execution. Zero client-side REST calls to services exist in `app/`, `components/`, or `hooks/`.
- Socket.IO connection in [hooks/use-realtime-socket.ts](file:///d:/SaaS%20Project/trading-alerts-saas-public/hooks/use-realtime-socket.ts#L53-L60) is the sole exception: a direct browser WebSocket connection to `operation-service` (port 3001) using token from `GET /api/realtime/token` ([app/api/realtime/token/route.ts](file:///d:/SaaS%20Project/trading-alerts-saas-public/app/api/realtime/token/route.ts#L18-L28)); it is push-only and distinct from REST client generation.
- Open flags F49, F60, F64 remain open, non-blocking.

## Next-session handoff

`7-2-api-client-migrate-consumers.migration-order.md` (migrate Phase 6 per-domain fetch wrappers onto `operationApi`/`moneyApi`; delete `app/api-test/page.tsx`).
