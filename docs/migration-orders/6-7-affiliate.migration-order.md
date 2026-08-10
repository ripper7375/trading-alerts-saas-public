# Migration Order — Session 6-7 — Affiliate

> For a session that closes the ~6 AFFILIATE-surface gap-matrix rows assigned to it (A1-15, A1-16,
> A2-6, A2-11, plus B2-19/B2-20 flagged as "doesn't fit cleanly, recommend 6-7" by the gap matrix's
> own Step 3 table) — the commissions page's real-data wiring, the payment-setup consolidation
> between two live un-consolidated surfaces, a zero-consumer code-inventory endpoint, and two
> unclear rows (statements, resources) needing Davin/Advisor triage before DRAFT. Adapted from
> `TEMPLATE-UI-BUILD.md`, dial **High for consolidated payment-setup UI, Low for data** (every
> read this session needs is already a real, live endpoint per the gap matrix's own citations —
> re-verify at CONFIRM per `LESSONS-LEARNED.md` L27, this PRE-DRAFT was authored from the gap
> matrix at Session 6-6's close, not from re-reading every target file in full).

**Session:** 6-7 · **Phase:** Phase 6 (Frontend Redesign) · **Variant:** UI-BUILD (dial HIGH for
payment-setup consolidation UI, LOW for data) · **Status:** PRE-DRAFT · **Generated:** 2026-08-11
(at Session 6-6 close) · **Flags touched:** none expected · **Estimated time:** ~3-5h
**Surface:** `app/affiliate/dashboard/commissions/page.tsx` (real-data wiring — replace the
static "Ready for payout" string with real `WiseTransfer`/`WiseBatchGroup`/
`DisbursementTransaction`/`PaymentBatch`-backed status), `app/affiliate/dashboard/profile/payment/page.tsx`

- `app/affiliate/settings/payout/page.tsx` (consolidation — two live, un-consolidated
  payment-setup surfaces, exact resolution TBD, see User Review below),
  `app/affiliate/dashboard/code-inventory/page.tsx` (wire existing endpoint),
  `app/affiliate/dashboard/payouts/page.tsx` (same root cause as A1-15, see Context) ·
  **Feeds on:** real Wise/disbursement data sources (exact query shape TBD at DRAFT — direct Prisma
  vs. a `GET /api/disbursement/affiliates/[affiliateId]`-style self-service endpoint, need to check
  whether one already exists scoped to the CALLING affiliate rather than admin-only),
  `GET /api/affiliate/dashboard/code-inventory`.

---

## Context

- **Source:** `docs/migration-orders/phase-6-frontend-gap-matrix.md`, rows A1-15, A1-16, A2-6,
  A2-11 (all tagged Session 6-7 in that document's own Session column), plus B2-19/B2-20 (flagged
  "doesn't fit cleanly... recommend 6-7", not firmly assigned). Re-verify every citation at
  CONFIRM per `LESSONS-LEARNED.md` L27 (order text drifts from its own cited ground truth) — this
  PRE-DRAFT was NOT built from re-reading every target file in full. Session 6-6 hit this exact
  gap 3 times (two target pages the order assumed existed didn't; one sibling page the order
  didn't know about already existed) — re-verify file existence for every row here before
  assuming "wire" vs. "build new" for any of them.
- **A1-15** (`/affiliate/dashboard/commissions`): confirmed at gap-matrix time — page shows only a
  static "Ready for payout" string (cited L233), no reference to
  `WiseTransfer`/`WiseBatchGroup`/`DisbursementTransaction`/`PaymentBatch` anywhere in the file.
  Needs real-data wiring using the REAL `PaymentBatchStatus`/`DisbursementTransactionStatus`/
  `WiseBatchGroupStatus` enum values (Session 6-6 corrected a fabricated vocabulary for the admin
  side of this exact domain — re-check the real enum values fresh rather than assuming Session
  6-6's own admin-page badge classes transfer directly, since this is an affiliate-facing page
  with different tone/detail needs).
- **A2-11** (`/affiliate/dashboard/payouts`): "See A1-15" per the gap matrix's own text — same
  underlying gap, not independently re-scoped. Needs its own file-existence + content check at
  CONFIRM; may turn out to be the same page as A1-15 under a different route, or a genuinely
  separate one.
- **A1-16** (`/affiliate/dashboard/profile/payment` vs `/affiliate/settings/payout`): BOTH
  confirmed to exist as of the gap matrix's own re-verification — two live, un-consolidated
  payment-setup surfaces. `app/affiliate/dashboard/layout.tsx`'s nav links to
  `/affiliate/dashboard/profile` (parent of the legacy page) and to `/affiliate/settings/payout`
  separately — the legacy page is reached via Profile, not directly from top nav. **This row's
  real disposition (consolidate into one, redirect one to the other, or something else) is a
  genuine product decision** — see User Review below, matching Session 6-6's own A1-6 precedent
  (RiseWorks-accounts vs. Wise-recipients consolidation, resolved the same way: redirect the
  older/duplicate surface to the newer/canonical one).
- **A2-6** (`/affiliate/dashboard/code-inventory`): `GET /api/affiliate/dashboard/code-inventory`
  confirmed live, zero UI consumer — needs wiring into a real view, mirroring the admin-side
  `code-flows` precedent from Session 6-6 (a new page consuming an already-live endpoint).
- **B2-19/B2-20** (`/affiliate/dashboard/statements`, `/affiliate/resources`): explicitly flagged
  by the gap matrix's own Step 3 table as not fitting cleanly into any session's scope, "not
  independently re-checked" — needs Davin/Advisor triage (per Waiting-on #116) before DRAFT
  decides whether these are genuinely in this session's scope, a future session's, or out of
  scope entirely.

## User Review Required

> [!IMPORTANT]
> **Payment-setup consolidation (A1-16):** does this session consolidate
> `/affiliate/dashboard/profile/payment` and `/affiliate/settings/payout` into one canonical
> surface (redirect the older to the newer, matching Session 6-6's own A1-6 resolution pattern),
> or keep both with a clearer nav distinction, or something else? A real product call, not a
> default to assume either way.

> [!NOTE]
> **B2-19/B2-20 scope (statements, resources):** are these in this session's scope at all? The
> gap matrix's own Step 3 table doesn't cleanly assign either row anywhere — needs a decision
> before DRAFT, not silently included or silently dropped.

## Entry criteria

- [ ] Session 6-6 CONFIRMED, executed, closed (2026-08-11 — see `CLAUDE.md` Current entry).
- [ ] All rows (A1-15, A1-16, A2-6, A2-11, and the disposition of B2-19/B2-20) re-verified live
      at CONFIRM — file existence, line-count citations, and actual content, per
      `LESSONS-LEARNED.md` L27's own recurring pattern (3 fresh instances at Session 6-6 alone).
- [ ] The payment-setup consolidation question (User Review above) resolved by Davin before DRAFT
      is finalized.
- [ ] The B2-19/B2-20 scope question (User Review above) resolved before DRAFT.
- [ ] Monolith baseline re-measured at CONFIRM (`tsc --noEmit`, `eslint app components lib hooks
  --max-warnings 0`, `test:ci` — last known at 6-6's close: 138/138 suites, 2238/2238 tests, 4
      pre-existing lint warnings, one of which — `admin/page.tsx:308` — appeared without any
      corresponding edit in Session 6-6's own history; worth a fresh check whether it's still
      there and whether its cause has become any clearer).
- [ ] Full Advisor DRAFT + Davin APPROVED before CONFIRM — not fast-path eligible (two real,
      unresolved product/scope decisions above need a human call first, matching Session 6-6's
      own precedent).

## Integration points

- **In:** `GET /api/affiliate/dashboard/code-inventory`; a real data source for A1-15/A2-11
  (exact endpoint TBD — check whether a self-service, affiliate-scoped disbursement/commission
  status endpoint already exists before assuming one needs to be built, mirroring Session 6-6's
  own discovery that `GET /api/disbursement/affiliates/[affiliateId]` already existed for the
  admin side).
- **Out:** no `operation-service`/`money-service` changes expected, but re-verify — Session 6-6
  found it needed 2 small, narrow monolith-side backend fixes (`lib/disbursement/constants.ts`
  WISE wiring, `/api/disbursement/config`'s `available` list) despite starting from an identical
  "no backend changes" assumption; don't assume this session is different without checking.
- **Owns:** the ~4-6 page files listed under Surface above (exact count depends on the User
  Review resolutions and whether A1-15/A2-11 turn out to be the same page).

## Rules specific to this variant

- **UI Creativity (Dial HIGH):** full freedom on the consolidated payment-setup UX and the
  commissions/code-inventory page layouts.
- **Data Contract (Dial LOW):** payloads must strictly match real, live request/response shapes —
  verify each at DRAFT, don't invent fields. Any batch/transaction status vocabulary shown MUST
  use the real Prisma `PaymentBatchStatus`/`DisbursementTransactionStatus`/`WiseBatchGroupStatus`
  enum values (Session 6-6 found and corrected a fabricated vocabulary in its own order text —
  don't assume any status vocabulary named in a future order is correct without checking the
  schema directly).
- **No RiseWorks resurrection:** RiseWorks stays archived (F42) — any commission/payout display
  should reflect the live Wise provider, not reintroduce RiseWorks-specific UI.

## Done when

- [ ] A1-15/A2-11's commissions/payouts page(s) show real Wise/disbursement data, not the static
      placeholder string.
- [ ] A1-16's payment-setup consolidation is implemented per the resolved User Review decision.
- [ ] `GET /api/affiliate/dashboard/code-inventory` has a real UI consumer.
- [ ] B2-19/B2-20 are either explicitly out of scope (per the resolved User Review decision) or
      built.
- [ ] `tsc --noEmit` clean; `eslint --max-warnings 0` introduces 0 new warnings; `test:ci` green.

## Rollback

Same-stack UI work; rollback is `git revert`.

## Retire

N/A, unless A1-16's resolution retires one of the two payment-setup pages — record explicitly if
so (mirroring Session 6-6's own `accounts/page.tsx` → `recipients/page.tsx` redirect precedent).

## Deviations

_(filled during execution)_

## Known wrinkles / do-not-touch

- `lib/api/index.ts` stays untouched (`EXECUTOR-PROTOCOL.md` §5).
- `frontend/` mirror tree is out of scope (`EXECUTOR-PROTOCOL.md` §5).
- RiseWorks stays archived (F42).
- `DECISION-LOG.md` **F49** (dLocal `payment_method_flow`), **F60** (Stripe webhook cutover), and
  **F63** (public legal pages, blocks 6-10) are independent tracks, non-blocking for this session.
- The `admin/page.tsx:308` lint-warning mystery from Session 6-6 (Deviation #7 there) is
  unrelated to this session's own surface — don't chase it here either, unless it's grown or its
  cause has become clearer.

## Next-session handoff

Session **6-8** (Payments/Checkout — resolves F61, the missing `/api/geo/detect` endpoint) is
next in Phase 6, per the session playbook's own remaining order.
