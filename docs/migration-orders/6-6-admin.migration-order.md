# Migration Order — Session 6-6 — Admin

> For a session that closes the 6 ADMIN-surface gap-matrix rows assigned to it (A1-5, A1-6, A1-14,
> A1-17/A2-10, A2-5, A2-7) — the WISE disbursement provider option missing from the admin config
> UI, the RiseWorks-only accounts page's disposition, a per-code cancel action with a real,
> zero-consumer endpoint already live, a missing per-user detail page, and a real, zero-consumer
> code-flows report endpoint. Adapted from `TEMPLATE-UI-BUILD.md`, dial **High for the new
> UI (detail page, provider option, report wiring), Low for data** (every read/write this session
> needs is already a real, live endpoint per the gap matrix's own citations — re-verify at
> CONFIRM, this PRE-DRAFT was authored from the gap matrix and a direct codebase skim at Session
> 6-5's close, not from re-reading every target file in full).

**Session:** 6-6 · **Phase:** Phase 6 (Frontend Redesign) · **Variant:** UI-BUILD (dial HIGH for
new UI, LOW for data) · **Status:** PRE-DRAFT · **Generated:** 2026-08-11 (at Session 6-5 close) ·
**Flags touched:** none expected · **Estimated time:** ~4-6h (largest Phase 6 session so far by
row count)
**Surface:** `app/(dashboard)/admin/disbursement/config/page.tsx` (WISE option),
`app/(dashboard)/admin/disbursement/accounts/page.tsx` (RiseWorks disposition — exact scope TBD,
see User Review below), `app/(dashboard)/admin/affiliates/reports/code-inventory/page.tsx`
(per-code cancel action), `app/(dashboard)/admin/users/page.tsx` (link to detail page, new),
`app/(dashboard)/admin/users/[id]/page.tsx` (new), `app/(dashboard)/admin/affiliates/reports/code-flows/page.tsx`
(wire existing endpoint) ·
**Feeds on:** `POST /api/admin/codes/[code]/cancel`, `GET /api/admin/affiliates/reports/code-flows`,
a to-be-confirmed per-user detail endpoint (see Entry criteria), disbursement provider config
reads/writes (exact routes TBD at DRAFT).

---

## Context

- **Source:** `docs/migration-orders/phase-6-frontend-gap-matrix.md`, rows A1-5, A1-6, A1-14,
  A1-17/A2-10, A2-5, A2-7 — all tagged Session 6-6 in that document's own Session column. Re-verify
  every citation at CONFIRM per `LESSONS-LEARNED.md` L27 (order text drifts from its own cited
  ground truth) — this PRE-DRAFT was NOT built from re-reading every target file in full.
- **A1-5** (`/admin/disbursement/config`): the provider radio only offers `MOCK`/`RISE` (cited
  L261-291 of that file at gap-matrix time) — zero `WISE` option anywhere, despite Wise being the
  live disbursement provider as of Session 4A-W7 (`DISBURSEMENT_PROVIDER=WISE` in production).
- **A1-6** (`/admin/disbursement/accounts`): confirmed entirely RiseWorks-driven — imports
  `RiseWorksKycStatus`, its own doc comment cites `/api/disbursement/riseworks/accounts`/
  `riseworks/sync`. RiseWorks itself is archived, not deleted (F42, Session 4A-W1) — **this row's
  real disposition (rebuild for Wise recipients, or archive alongside RiseWorks, or something
  else) is a genuine product decision, not something to guess at.** See User Review below.
- **A1-14** (`/admin/affiliates/reports/code-inventory`): `POST /api/admin/codes/[code]/cancel`
  confirmed live with zero UI consumer anywhere — needs a real cancel action wired into this page.
- **A1-17/A2-10** (`/admin/users`, new `/admin/users/[id]`): confirmed no link/route pattern to a
  per-user detail page exists anywhere in the current `/admin/users` page file. The exact fields/
  actions a detail page should show (profile, tier, sessions, 2FA status, affiliate standing?) are
  **not yet scoped** — needs a DRAFT-time read of what admin-facing user data already exists via
  live endpoints before committing to a field list.
- **A2-5** (`/admin/affiliates/reports/code-flows`): `GET /api/admin/affiliates/reports/code-flows`
  confirmed live, zero UI consumer (only a self-match in the gap-matrix's own audit) — needs
  wiring into a real report view.
- **A2-7** (`/admin/disbursement/affiliates/[affiliateId]`): **not independently re-checked** in
  the gap-matrix's own audit pass (out of that session's exhaustive-sample scope, carried from the
  original source artifact) — re-verify this row's real content at DRAFT/CONFIRM before trusting
  it, more than the other 5 rows here.

## User Review Required

> [!IMPORTANT]
> **RiseWorks-accounts page disposition (A1-6):** does this session rebuild
> `/admin/disbursement/accounts` for Wise recipients (mirroring the real, live
> `AffiliateWiseRecipient` model and the `/wise/recipients` admin endpoint already built at
> Session 4A-W3a/b), or does it get archived/redirected alongside the rest of RiseWorks (matching
> F42's own archive-not-delete precedent), or something else? A real product call, not a default
> to assume either way.

> [!NOTE]
> **Admin user-detail page scope (A1-17/A2-10):** what should `/admin/users/[id]` actually show?
> Needs a DRAFT-time inventory of what admin-readable user data already has a live endpoint
> (profile, tier/subscription, sessions, 2FA status, affiliate standing, fraud flags) before
> committing to a field list — not scoped in this PRE-DRAFT.

## Entry criteria

- [ ] Session 6-5 CONFIRMED, executed, closed (2026-08-11 — see `CLAUDE.md` Current entry).
- [ ] All 6 gap-matrix rows (A1-5, A1-6, A1-14, A1-17/A2-10, A2-5, A2-7) re-verified live at
      CONFIRM — file existence, line-count citations, and (for A2-7 specifically, never
      independently re-checked) actual content.
- [ ] The RiseWorks-accounts disposition question (User Review above) resolved by Davin before
      DRAFT is finalized.
- [ ] The admin user-detail-page field scope (User Review above) resolved at DRAFT, backed by a
      real inventory of live admin-readable user endpoints.
- [ ] Monolith baseline re-measured at CONFIRM (`tsc --noEmit`, `eslint app components lib hooks
    --max-warnings 0`, `test:ci` — last known at 6-5's close: 136/136 suites, 2230/2230 tests, 3
      pre-existing lint warnings).
- [ ] Full Advisor DRAFT + Davin APPROVED before CONFIRM — not fast-path eligible (two real,
      unresolved product/scope decisions above need a human call first).

## Integration points

- **In:** `POST /api/admin/codes/[code]/cancel`, `GET /api/admin/affiliates/reports/code-flows`,
  disbursement provider config routes (TBD), a per-user detail read path (TBD — may need a new
  admin-scoped endpoint, or may already exist; re-verify before assuming either way).
- **Out:** no changes to `operation-service`/`money-service` expected, but A1-6's own disposition
  decision may require one (e.g., a Wise-recipient-list admin read) — flag at DRAFT if so.
- **Owns:** the 6 page files listed under Surface above.

## Rules specific to this variant

- **UI Creativity (Dial HIGH):** full freedom on the new user-detail page layout, the code-flows
  report view, and the cancel-action confirmation UX.
- **Data Contract (Dial LOW):** payloads for `codes/[code]/cancel` and `code-flows` must strictly
  match their real, live request/response shapes — verify each at DRAFT, don't invent fields.
- **No RiseWorks resurrection:** whatever A1-6 resolves to, it must not re-enable or re-link any
  live RiseWorks code path — F42's archive stays archived unless Davin explicitly says otherwise.

## Done when

- [ ] `/admin/disbursement/config` offers a real `WISE` provider option (or the order's own DRAFT
      records why not, if CONFIRM finds this already resolved differently).
- [ ] A1-6's resolved disposition is implemented (rebuild, archive-redirect, or the DRAFT's own
      chosen alternative).
- [ ] `POST /api/admin/codes/[code]/cancel` has a real UI consumer with a confirmation step.
- [ ] `/admin/users/[id]` exists, is linked from `/admin/users`, and renders the DRAFT-scoped field
      set from real live data.
- [ ] `GET /api/admin/affiliates/reports/code-flows` has a real UI consumer.
- [ ] A2-7 is either confirmed already-adequate or fixed, per its own CONFIRM-time re-check.
- [ ] `tsc --noEmit` clean; `eslint --max-warnings 0` introduces 0 new warnings; `test:ci` green.

## Rollback

Same-stack UI work; rollback is `git revert`.

## Retire

N/A, unless A1-6's resolution retires RiseWorks-specific admin UI — record explicitly if so.

## Deviations

_(filled during execution)_

## Known wrinkles / do-not-touch

- `lib/api/index.ts` stays untouched (`EXECUTOR-PROTOCOL.md` §5).
- `frontend/` mirror tree is out of scope (`EXECUTOR-PROTOCOL.md` §5).
- RiseWorks itself stays archived (F42) — this session may touch its own admin UI surface per
  A1-6's resolution, but must not un-archive any backend RiseWorks code path.
- `DECISION-LOG.md` **F49** (dLocal `payment_method_flow`) and **F60** (Stripe webhook cutover)
  are independent tracks, non-blocking for this session.

## Next-session handoff

Session **6-7** (Affiliate — commissions page real-data wiring, payment-setup consolidation) is
next in Phase 6, per the session playbook's own remaining order.
