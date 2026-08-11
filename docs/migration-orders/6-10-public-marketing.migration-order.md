# Migration Order — Session 6-10 — Public / Marketing Surface

> For a session that closes the PUBLIC/MARKETING-surface gap-matrix rows assigned to it
> (B1-3, B1-4, B1-5, B2-1 through B2-12) — builds the dead marketing-footer/nav destinations
> (`/about`, `/docs`, `/blog`, `/changelog`, `/careers`, `/help`, `/affiliate`, `/affiliate/join`,
> `/status`) and, **contingent on `DECISION-LOG.md` F63's resolution**, the 3 compliance-relevant
> public legal pages (`/terms`, `/privacy`, `/disclaimer`) plus their `/settings/{terms,privacy}`
> public duplicates. Adapted from `TEMPLATE-UI-BUILD.md`, dial **HIGH for marketing/content pages,
> LOW for the legal-page shells** (content itself is Davin's call, not the Executor's to draft).

**Session:** 6-10 · **Phase:** Phase 6 (Frontend Redesign) · **Variant:** UI-BUILD · **Status:**
PRE-DRAFT · **Generated:** 2026-08-11 (at Session 6-8 close) · **Flags touched:** none expected ·
**Estimated time:** ~4-6h (large row count; legal-page content itself is out of Executor scope)

**Surface:** `app/about/page.tsx`, `app/docs/page.tsx`, `app/blog/page.tsx`,
`app/changelog/page.tsx`, `app/careers/page.tsx`, `app/help/page.tsx`, `app/affiliate/page.tsx`
(landing, distinct from the existing `app/affiliate/register`), `app/affiliate/join` (dead link —
verify whether this should redirect to `/affiliate/register` instead of becoming its own page,
per Session 6-2's own `accounts→recipients` redirect-over-duplicate-build precedent), `app/status`
(verify: external link vs. local route, B2-12 unresolved), `app/(marketing)/settings/help`
(stub-comment closure, B1-3), and — gated on F63 — `app/terms/page.tsx`, `app/privacy/page.tsx`,
`app/disclaimer/page.tsx`.

**Feeds on:** `docs/migration-orders/phase-6-frontend-gap-matrix.md` rows B1-3/B1-4/B1-5/B2-1…12,
`DECISION-LOG.md` F63.

---

## Context

Twelve-plus rows from `phase-6-frontend-gap-matrix.md`, **re-verify every citation at CONFIRM**
per `LESSONS-LEARNED.md` L27 (order text drifts from its own cited ground truth — Sessions 6-6,
6-7, and 6-8 all hit real, material drift this way) — this PRE-DRAFT was authored from the gap
matrix at Session 6-8's close, not from re-reading every target file in full:

- **F63-gated (B1-4, B2-6, B2-7, B2-8):** `/terms`, `/privacy`, `/disclaimer` (public) plus the
  `/settings/{terms,privacy}` public-duplicate question. `register-form.tsx`'s consent checkbox
  links to `/terms`/`/privacy` today — dead links on a live signup flow. `/disclaimer` is a
  financial-risk disclaimer for a trading product; **DECISION-LOG.md F63 explicitly says this must
  not be drafted by the Executor** — Davin must supply real copy or explicitly approve placeholder
  text before any of these 3 pages ship.
- **B1-3 (`/settings/help`):** a stub comment at the confirmed line ("In a real implementation,
  this would send to a support system") — the gap matrix itself flags this row as "doesn't fit
  cleanly" between 6-10 and 6-5; confirm the real current state before assuming it's still
  unresolved.
- **B1-5 (marketing homepage anchors):** `#features`/`#affiliate` anchor targets on
  `app/(marketing)/page.tsx` — **not independently re-checked** by the gap-matrix session; verify
  both anchors actually resolve to real sections before assuming this row needs any work at all.
- **B2-1 through B2-5, B2-9, B2-10, B2-11 (marketing content pages, no F63 gate):** `/about`,
  `/docs`, `/blog`, `/changelog`, `/careers`, `/help` (public, distinct from the auth-gated
  `/settings/help`), `/affiliate` (landing — check whether this should be new content or a
  redirect to the existing `/affiliate/register`, mirroring Session 6-2's own
  `accounts→recipients` precedent), `/affiliate/join` (`register-form.tsx:617` — likely the same
  redirect-not-duplicate question as `/affiliate`).
- **B2-12 (`/status`):** flagged **not independently re-checked** — confirm whether this is meant
  to be a real local status page or an external link (e.g. a status-page.io–style third-party
  service) before building anything.

## User Review Required

> [!IMPORTANT]
> **F63 (legal-page content):** does Davin supply real `/terms`/`/privacy`/`/disclaimer` copy, or
> does this session ship Davin-reviewed placeholder text? This blocks B1-4, B2-6, B2-7, B2-8
> specifically — the rest of this order's scope (B1-3, B1-5, B2-1/2/3/4/5/9/10/11/12) does not
> depend on F63 and can proceed regardless of when/how it resolves.

> [!IMPORTANT]
> **`/affiliate` and `/affiliate/join`:** new content pages, or redirects into the existing
> `/affiliate/register` flow? Re-check `app/affiliate/register/page.tsx`'s real content before
> deciding — avoid Session 6-6's own near-miss of building a duplicate where a redirect would do.

## Entry criteria

- [ ] Session 6-8 CONFIRMED, executed, closed (see `CLAUDE.md` Current entry).
- [ ] F63 resolved by Davin (content-supply decision) — or explicitly deferred, splitting this
      session's own scope (build B1-3/B1-5/B2-1…5/B2-9…12 now, carry B1-4/B2-6/7/8 forward).
- [ ] All 12+ rows re-verified live at CONFIRM — especially B1-5 and B2-12, both flagged
      "not independently re-checked" by the gap-matrix session itself.
- [ ] `/affiliate` and `/affiliate/join` disposition (redirect vs. new page) resolved.
- [ ] Monolith baseline re-measured at CONFIRM (`tsc --noEmit`, `eslint app components lib hooks
    --max-warnings 0`, `test:ci` — last known at 6-8's close: 145/145 suites, 2278/2278 tests,
      4 pre-existing lint warnings).
- [ ] Full Advisor DRAFT + Davin APPROVED before CONFIRM — not fast-path eligible (F63 is a real,
      unresolved compliance-content decision).

## Integration points

- **In:** none — this session builds new static/near-static marketing pages, no new backend reads
  beyond what already exists.
- **Out:** no `operation-service`/`money-service` changes expected.
- **Owns:** all new page files listed under Surface above, plus whichever existing files (marketing
  footer/nav, `register-form.tsx`) need their dead links repointed once real pages exist.

## Rules specific to this variant

- **UI Creativity (Dial HIGH)** for marketing/content pages (about, docs, blog, changelog,
  careers, help, status).
- **Content Discipline (Dial LOW)** for the 3 legal pages — Davin's real copy or explicitly
  Davin-approved placeholder only, never invented compliance text.
- **No orphan creation:** once each page ships, repoint its real dead-link source(s) (marketing
  footer, `register-form.tsx` consent checkbox, etc.) — don't leave a new page unlinked the way
  `/upgrade/success` briefly would have been before Session 6-8's `successUrl` fix.

## Done when

- [ ] Every B2-1…12 row has either a real page or a documented, deliberate redirect.
- [ ] B1-3 (`/settings/help` stub) and B1-5 (marketing anchors) resolved or re-confirmed
      not-actually-broken.
- [ ] If F63 resolved: `/terms`, `/privacy`, `/disclaimer` live with Davin-sourced/approved
      content; `register-form.tsx`'s consent checkbox and the marketing footer repointed to them.
- [ ] `tsc --noEmit` clean; `eslint --max-warnings 0` introduces 0 new warnings; `test:ci` green.

## Rollback

Same-stack UI/content work; rollback is `git revert`.

## Retire

N/A — no existing code retired by this session (new pages + dead-link repointing only).

## Deviations

_(filled during execution)_

## Known wrinkles / do-not-touch

- `lib/api/index.ts` stays untouched (`EXECUTOR-PROTOCOL.md` §5).
- `frontend/` mirror tree is out of scope (`EXECUTOR-PROTOCOL.md` §5).
- RiseWorks stays archived (F42).
- `DECISION-LOG.md` **F49** (dLocal `payment_method_flow`) and **F60** (Stripe webhook cutover)
  stay open, non-blocking.
- A real, pre-existing gap found at Session 6-8 (not this session's to fix, carried forward):
  `lib/dlocal/dlocal-payment.service.ts`'s `createPayment` never sends a `return_url`/
  `success_url` to dLocal — only `notification_url` — so dLocal's own hosted payment page has no
  configured way to redirect a real customer back to `/checkout/return` today. Out of this
  session's own scope (payments-behavior, not marketing/public surface) but worth a future
  dedicated session.

## Next-session handoff

Session **6-11** (Admin System Operations — `/admin/system/{terminals,jobs,outbox}`, B2-14/15/16)
is next in Phase 6, per the session playbook's own remaining order (6-9 is retired, do not reuse
that number).
