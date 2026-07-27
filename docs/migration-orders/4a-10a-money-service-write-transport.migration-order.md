# Migration Order — Standard Loop / UI-BUILD variant

> Read `00-SKELETON-AND-RULES.md` first. This session builds the **Monolith-side Write Transport Layer & Feature Flag Wiring** for Slice 4 (Write APIs) before cutover can occur in 4A-10b.

**Session:** 4A-10a (BUILD) · **Variant:** Standard Loop · **Status:** CONFIRMED
**Generated:** 2026-07-27 (Advisor) · **Confirmed:** 2026-07-27 (Executor, live re-verification —
provenance of this file's uncommitted APPROVED status confirmed directly by Davin, per
`LESSONS-LEARNED.md` L11) · **Estimated time:** ~2h
**Phase / plan section:** Phase 4A — money-service · Slice 4 Transport Build (Write APIs)
**Ground truth:** `4a-9-money-service-write-apis-port.migration-order.md`, `lib/money-service/routes.ts` (Slice 3 Read Transport precedent from 4A-7a).
**Flags defined/wired:** `MIGRATE_WRITE_APIS_MONEY_STRIPE`, `MIGRATE_WRITE_APIS_MONEY_DLOCAL`, `MIGRATE_WRITE_APIS_MONEY_ADMIN`, `MIGRATE_WRITE_APIS_MONEY_DISBURSEMENT` (all default `false` / `MONOLITH`).
**Contract:** Wire feature flag checks and HTTP proxy forwarding calls into the 5 monolith write routes, forwarding to `money-service` when flags are `true`. Zero live traffic affected (flags default `false`).

---

## Why this session, why now

Session 4A-9 built and verified all Slice 4 NestJS write controllers and services in `money-service`.

However, the monolith's 5 write routes (`app/api/checkout/route.ts`, `app/api/payments/dlocal/create/route.ts`, `app/api/subscription/cancel/route.ts`, `app/api/admin/affiliates/[id]/distribute-codes/route.ts`, `app/api/disbursement/batches/[batchId]/execute/route.ts`) do not yet read feature flags or forward requests to `money-service`.

Following the exact precedent of Session 4A-7a (which built `lib/money-service/routes.ts` for Slice 3 Read APIs), **Session 4A-10a builds the monolith-side Write Transport Layer** (`lib/money-service/write-routes.ts`) and wires flag checks into all 5 monolith write handlers.

Completing 4A-10a is required before 4A-10b (Cutover flag flip) can execute.

---

## Scope Discipline & Files Touched

- **Files created / modified:**
  - `lib/money-service/flags.ts` (Add `MIGRATE_WRITE_APIS_MONEY_*` flag definitions)
  - `lib/money-service/write-routes.ts` [NEW] (HTTP proxy transport forwarding `POST` requests to `MONEY_SERVICE_URL` with `Authorization` and `Idempotency-Key` headers)
  - `app/api/checkout/route.ts` (Add `MIGRATE_WRITE_APIS_MONEY_STRIPE` flag check + proxy call)
  - `app/api/subscription/cancel/route.ts` (Add `MIGRATE_WRITE_APIS_MONEY_STRIPE` flag check + proxy call)
  - `app/api/payments/dlocal/create/route.ts` (Add `MIGRATE_WRITE_APIS_MONEY_DLOCAL` flag check + proxy call)
  - `app/api/admin/affiliates/[id]/distribute-codes/route.ts` (Add `MIGRATE_WRITE_APIS_MONEY_ADMIN` flag check + proxy call)
  - `app/api/disbursement/batches/[batchId]/execute/route.ts` (Add `MIGRATE_WRITE_APIS_MONEY_DISBURSEMENT` flag check + proxy call)

---

## Entry criteria

- [x] Session 4A-9 CONFIRMED and closed (`money-service` test suite 59/59 suites, 506/506 tests green). Re-verified live at CONFIRM (2026-07-27): commit `51b837af` closes 4A-9; fresh `npm test` run in `money-service` reproduced 59/59 suites, 506/506 tests exactly.
- [x] Monolith `tsc --noEmit` and `npm run validate` clean. Re-verified live: `tsc --noEmit` clean, `eslint app components lib hooks --max-warnings 0` clean (0 errors/warnings) — the real green bar per `LESSONS-LEARNED.md` L20 (literal `validate:format`/`validate:policies` fail for pre-existing, unrelated reasons: Windows CRLF and a validator that wrongly scans `node_modules`/`railway-gateway`, same class as the L20/4A-W2 eslint-scope precedent — neither is a regression from this session).
- [x] Davin present for session authorization. Confirmed live in chat.

---

## Integration points

- **In:** Monolith Next.js route handlers (`app/api/*`).
- **Out:** `money-service` `/v1/*` endpoints via `MONEY_SERVICE_URL` HTTP transport.
- **Owns:** Monolith-side flag routing for Slice 4 write endpoints.

---

## Ordered Steps

### Step 1 — Define Slice 4 Feature Flags & Transport Helper

- Update `lib/money-service/flags.ts` to export:
  - `shouldUseMoneyServiceForStripeWrite()` (`MIGRATE_WRITE_APIS_MONEY_STRIPE`)
  - `shouldUseMoneyServiceForDlocalWrite()` (`MIGRATE_WRITE_APIS_MONEY_DLOCAL`)
  - `shouldUseMoneyServiceForAdminWrite()` (`MIGRATE_WRITE_APIS_MONEY_ADMIN`)
  - `shouldUseMoneyServiceForDisbursementWrite()` (`MIGRATE_WRITE_APIS_MONEY_DISBURSEMENT`)
- Create `lib/money-service/write-routes.ts` exporting `forwardWriteRequestToMoneyService(request, path, options)` helper, preserving raw request body, `Authorization` Bearer token, and `Idempotency-Key` header.
- **Verification:** Unit tests in `__tests__/lib/money-service/write-routes.test.ts` verifying flag checks, header propagation, and 0ms fallback on flag `false`.

### Step 2 — Wire Stripe Write Routes (`app/api/checkout/route.ts` & `app/api/subscription/cancel/route.ts`)

- In `app/api/checkout/route.ts`: if `shouldUseMoneyServiceForStripeWrite()`, forward `POST` request to `money-service/v1/stripe/checkout`.
- In `app/api/subscription/cancel/route.ts`: if `shouldUseMoneyServiceForStripeWrite()`, forward `POST` request to `money-service/v1/stripe/subscriptions/cancel`.
- **Verification:** `tsc --noEmit` clean; monolith tests green when flag is `false`.

### Step 3 — Wire dLocal Write Route (`app/api/payments/dlocal/create/route.ts`)

- In `app/api/payments/dlocal/create/route.ts`: if `shouldUseMoneyServiceForDlocalWrite()`, forward `POST` request to `money-service/v1/payments/dlocal/create`.
- **Verification:** `tsc --noEmit` clean; monolith tests green when flag is `false`.

### Step 4 — Wire Admin Code Distribution & Disbursement Execute Routes

- In `app/api/admin/affiliates/[id]/distribute-codes/route.ts`: if `shouldUseMoneyServiceForAdminWrite()`, forward `POST` request to `money-service/v1/admin/affiliates/:id/distribute-codes`.
- In `app/api/disbursement/batches/[batchId]/execute/route.ts`: if `shouldUseMoneyServiceForDisbursementWrite()`, forward `POST` request to `money-service/v1/disbursement/batches/:batchId/execute`.
- **Verification:** `tsc --noEmit` clean; monolith tests green when flag is `false`.

---

## Done when

- [x] All 5 monolith write routes wired with flag checks and proxy forwarding helpers.
- [x] Unit tests for `write-routes.ts` 100% green (11/11, plus the 4 new flag readers).
- [x] Monolith `tsc --noEmit` clean and test suites green (121/121 suites, 2133/2133 tests — was 120/120, 2122/2122 at 4A-9's close; +1 suite/+11 tests for `write-routes.test.ts`).
- [x] All 4 feature flags default to `false` (zero live production impact).

---

## Deviations

1. **`app/api/subscription/cancel/route.ts`'s `POST()` signature changed** from taking no
   parameters to `POST(request: NextRequest)`. Not spelled out in the order's own file-touched
   list, but required — the forwarding helper needs the request object (for its body and
   `Idempotency-Key` header) and this route previously never received one. Purely additive;
   Next.js always passes the request object to a route handler regardless of whether the
   exported function declares a parameter for it, so this is a safe signature widening, not a
   behavior change.
2. **`app/api/disbursement/batches/[batchId]/execute/route.ts`'s unused `_request` parameter
   renamed to `request`** (same type, now actually used) for the same reason as #1.
3. **`forwardWriteRequestToMoneyService`'s `options` parameter ended up narrower than the
   order's literal signature might imply** — only `{ method?: string }` (default `'POST'`), not
   a `hasBody` toggle. Reading the request body via `request.text()` unconditionally and
   omitting the `body` field entirely when it comes back empty turned out to handle every one
   of the 5 routes uniformly (2 have no body at all — cancel, execute; 3 have a JSON body —
   checkout, dlocal create, distribute-codes) without needing a per-call flag, so the simpler
   shape was kept.
4. **`.env.example` was NOT updated** with the 4 new `MIGRATE_WRITE_APIS_MONEY_*` var names,
   unlike 4A-7a's equivalent addition for the Slice-3 read flags. Deliberate: this order's own
   Scope Discipline file list doesn't name `.env.example`, no flag is flipped in any real
   environment this session (all 4 default `false` via `process.env[...] === 'true'`, so an
   absent var behaves identically to a `false` one), and per `LESSONS-LEARNED.md` L21,
   `.env.example` coverage was already shown to be a weak signal that doesn't substitute for
   verifying the real target environment at cutover time — 4A-10b's own entry criteria should
   value-blind-check Railway/Vercel directly rather than trust this file either way.
5. **Design confirmation, not a deviation:** verified all 5 money-service target endpoints
   (`StripeCheckoutController`, `StripeSubscriptionController`, `DlocalPaymentController`,
   `AdminAffiliatesController.distributeCodes`, `DisbursementBatchesController.execute`) are
   full 4A-9 PORTs that re-implement each route's entire business logic (auth, validation,
   provider calls) against the same schema — so each flag-ON branch forwards the raw request
   immediately after the monolith's own existing auth check and returns money-service's
   response directly, rather than layering forwarding on top of (or after) the monolith's own
   business-logic checks. Running both would risk double side effects (e.g. two Stripe API
   calls); this was confirmed by reading all 5 money-service controllers before writing any
   monolith-side branch, not assumed from the order's prose (per `LESSONS-LEARNED.md` L27).

---

## Next-session handoff

DRAFT Session 4A-10b (Slice 4 Cutover) — perform manual staging smoke tests, obtain Davin live approval per group, flip feature flags `false -> true`.
