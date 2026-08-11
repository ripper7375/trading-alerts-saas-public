# Migration Order — Session 6-8 — Payments / Checkout

> For a session that **closes the 4 PAYMENTS-surface gap-matrix rows** assigned to it (A1-7, A1-8,
> A2-8, A2-9) — resolves `DECISION-LOG.md` **F61** (`GET /api/geo/detect` 404 on every pricing-page
> load), decides the fate of 2-3 orphaned dLocal endpoints on `/checkout`, and builds the two
> missing post-checkout landing pages. Adapted from `TEMPLATE-UI-BUILD.md`, dial **High for the two
> new landing pages, Low for data** (every read this session needs is either an already-live
> endpoint or a thin wrapper around already-live logic — re-verify at CONFIRM per
> `LESSONS-LEARNED.md` L27, this PRE-DRAFT was authored from the gap matrix at Session 6-7's close,
> not from re-reading every target file in full).

**Session:** 6-8 · **Phase:** Phase 6 (Frontend Redesign) · **Variant:** UI-BUILD (dial HIGH for the
2 new landing pages, LOW for data) · **Status:** PRE-DRAFT · **Generated:** 2026-08-11 (at Session
6-7 close) · **Flags touched:** none expected · **Estimated time:** ~3-4h
**Surface:** `app/api/geo/detect/route.ts` (new — thin wrapper), `app/(marketing)/pricing/page.tsx`
(unaffected, already calls it), `components/payments/CountrySelector.tsx` (unaffected, already
calls it), `app/checkout/page.tsx` (orphaned-endpoint disposition, exact resolution TBD, see User
Review below), `app/checkout/return/page.tsx` (new), `app/upgrade/success/page.tsx` (new) ·
**Feeds on:** `lib/geo/detect-country.ts` (existing, 100%-covered, zero importers today),
`GET /api/payments/dlocal/[paymentId]`, `GET /api/payments/dlocal/exchange-rate`,
`POST /api/checkout/validate-code` (all confirmed live, zero UI consumers), `app/api/checkout/
route.ts`'s `successUrl`/`cancelUrl` construction (the `upgrade` query param source).

---

## Context

- **Source:** `docs/migration-orders/phase-6-frontend-gap-matrix.md`, rows A1-7, A1-8, A2-8, A2-9
  (all tagged Session 6-8 in that document's own Session column). Re-verify every citation at
  CONFIRM per `LESSONS-LEARNED.md` L27 (order text drifts from its own cited ground truth) — this
  PRE-DRAFT was NOT built from re-reading every target file in full. Sessions 6-6 and 6-7 both hit
  real, material drift between the gap matrix's own characterization and live code (6-7's own
  CONFIRM found A1-15's "shows only a static string" claim was flatly wrong against the real
  file) — re-verify file existence, line counts, and actual page content for every row here before
  trusting any of it.
- **F61** (`DECISION-LOG.md`, OPEN, owner Davin, due this session): `GET /api/geo/detect` is called
  by `pricing/page.tsx:155` and `CountrySelector.tsx:69` but doesn't exist anywhere in `app/api/` —
  a 404 on every pricing-page load. The gap matrix's own re-verification found the fix is narrower
  than it looks: `lib/geo/detect-country.ts` already implements `detectCountry(headers)`/
  `detectCountryFromIP(ip)`, 100%-line-covered by its own existing test, with zero importers
  anywhere — this session likely needs only a thin route wrapper, not new detection logic. Confirm
  this is still true at CONFIRM (function signatures, header/IP extraction contract) before
  assuming the route is a pure pass-through.
- **A1-8** (`/checkout`): 3 real orphaned endpoints found — `GET /api/payments/dlocal/[paymentId]`
  (zero UI consumers), `POST /api/checkout/validate-code` (zero UI consumers),
  `GET /api/payments/dlocal/exchange-rate` (zero UI consumers, gap matrix's own text flags this
  explicitly as "orphan, decide wire-or-delete"). **This row's real disposition for all 3 is a
  genuine product/scope decision, not a default to assume either way** — see User Review below.
  `validate-code` in particular may already be functionally covered by `/checkout`'s own inline
  code-validation UX (not independently re-checked this PRE-DRAFT) — verify before assuming it
  needs wiring rather than retiring.
- **A2-8** (`/checkout/return`): needs `GET /api/payments/dlocal/[paymentId]` wired in as its data
  source — depends on A1-8's own disposition for that endpoint (wire, not delete) landing first.
- **A2-9** (`/upgrade/success`): `app/api/checkout/route.ts:147-148`'s `successUrl`/`cancelUrl`
  construction (byte-identical pattern in `money-service/src/stripe/stripe-checkout.controller.ts:
95-96`) already redirects Stripe-completed checkouts to a URL carrying an `upgrade` query param —
  confirmed zero page anywhere reads it today. This is the more straightforward of the two new
  pages (no orphaned-endpoint decision blocking it).

## User Review Required

> [!IMPORTANT]
> **Orphaned dLocal/checkout endpoints (A1-8):** for each of `GET /api/payments/dlocal/[paymentId]`,
> `POST /api/checkout/validate-code`, and `GET /api/payments/dlocal/exchange-rate` — wire a real UI
> consumer, or retire the endpoint? The gap matrix's own text explicitly declines to default either
> way for the exchange-rate endpoint ("orphan, decide wire-or-delete"); the other two need the same
> explicit call. `[paymentId]` is very likely "wire" (A2-8's own `/checkout/return` page needs it
> as its data source) — `validate-code` and `exchange-rate` are genuinely open.

## Entry criteria

- [ ] Session 6-7 CONFIRMED, executed, closed (see `CLAUDE.md` Current entry).
- [ ] All 4 rows (A1-7, A1-8, A2-8, A2-9) re-verified live at CONFIRM — file existence, line-count
      citations, and actual content, per `LESSONS-LEARNED.md` L27's own recurring pattern (found
      twice more at Sessions 6-6 and 6-7 alone).
- [ ] `lib/geo/detect-country.ts`'s real function signatures/contract re-verified before assuming
      the new route is a pure wrapper.
- [ ] The 3-endpoint wire-vs-delete question (User Review above) resolved by Davin before DRAFT is
      finalized.
- [ ] Monolith baseline re-measured at CONFIRM (`tsc --noEmit`, `eslint app components lib hooks
--max-warnings 0`, `test:ci` — last known at 6-7's close: 142/142 suites, 2261/2261 tests, 4
      pre-existing lint warnings, unchanged since 6-6's close).
- [ ] Full Advisor DRAFT + Davin APPROVED before CONFIRM — not fast-path eligible (a real,
      unresolved product/scope decision above needs a human call first, matching Sessions 6-6/6-7's
      own precedent).

## Integration points

- **In:** `lib/geo/detect-country.ts`, `GET /api/payments/dlocal/[paymentId]`,
  `GET /api/payments/dlocal/exchange-rate`, `POST /api/checkout/validate-code` (pending User Review
  resolution), `app/api/checkout/route.ts`'s existing `upgrade` query param.
- **Out:** no `operation-service`/`money-service` changes expected, but re-verify — Sessions 6-6
  and 6-7 both found small monolith-side backend touches were needed despite starting from an
  identical "no backend changes" assumption; don't assume this session is different without
  checking.
- **Owns:** `app/api/geo/detect/route.ts` (new), `app/checkout/return/page.tsx` (new),
  `app/upgrade/success/page.tsx` (new), plus whichever of the 3 orphaned endpoints' consumers the
  User Review resolution requires.

## Rules specific to this variant

- **UI Creativity (Dial HIGH):** full freedom on the two new landing pages' layout/copy/interaction.
- **Data Contract (Dial LOW):** payloads must strictly match real, live request/response shapes —
  verify each at DRAFT, don't invent fields.
- **No speculative geo logic:** `app/api/geo/detect/route.ts` should call the existing
  `detectCountry`/`detectCountryFromIP` functions, not reimplement detection.

## Done when

- [ ] F61 resolved — `GET /api/geo/detect` live, `/pricing` and `CountrySelector` load without a 404.
- [ ] A1-8's 3-endpoint disposition implemented per the resolved User Review decision (wired or
      explicitly retired, not left silently orphaned).
- [ ] `/checkout/return` renders real dLocal payment status (if `[paymentId]` was resolved "wire").
- [ ] `/upgrade/success` reads and displays the real `upgrade` query param from Stripe's completed
      checkout redirect.
- [ ] `tsc --noEmit` clean; `eslint --max-warnings 0` introduces 0 new warnings; `test:ci` green.

## Rollback

Same-stack UI/route work; rollback is `git revert`.

## Retire

Whichever of the 3 orphaned endpoints the resolved User Review decision marks "delete" — record
explicitly which, mirroring Session 6-6's own `accounts/page.tsx` → `recipients/page.tsx` redirect
precedent for documenting a retirement decision rather than silently dropping a route.

## Deviations

_(filled during execution)_

## Known wrinkles / do-not-touch

- `lib/api/index.ts` stays untouched (`EXECUTOR-PROTOCOL.md` §5).
- `frontend/` mirror tree is out of scope (`EXECUTOR-PROTOCOL.md` §5).
- RiseWorks stays archived (F42).
- `DECISION-LOG.md` **F49** (dLocal `payment_method_flow`), **F60** (Stripe webhook cutover), and
  **F63** (public legal pages, Session 6-10) stay open, non-blocking.
- Session 6-7's own new `commissionAmount`-vs-`amount` fix (a real, previously-live-breaking bug
  found and fixed while touching `commissions/page.tsx`) is unrelated to this session's own
  surface — no action needed here, flagged only so the pattern (test mocks matching a fictional
  field name rather than the real Prisma shape) is on this session's radar if similar Decimal
  fields are touched.

## Next-session handoff

Session **6-10** (Public/Marketing surface — resolves F63, the missing `/terms`/`/privacy`/
`/disclaimer` pages) is next in Phase 6, per the session playbook's own remaining order (6-9 is
retired, do not reuse that number).
