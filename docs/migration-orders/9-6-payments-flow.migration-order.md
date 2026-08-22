# Migration Order — Session 9-6 — Payments flow (cross-boundary)

> For sessions that **build or redesign frontend surfaces**: read `00-SKELETON-AND-RULES.md`
> first — §4 applies with the dial at **High** for page-body content/layout, **Zero** on data
> (every page binds to the endpoint its 9-0 row names). Money code additionally escalates per
> `EXECUTOR-PROTOCOL.md` §7 — any change beyond this order's own explicit steps stops and asks
> Davin. **PRE-DRAFTed by the Executor at Session 9-5's close (2026-08-22)**, informed by
> `frontend-swap-route-map.md` and 9-5's own Deviations. Per PD1, `Decisions taken` below is
> deliberately left as open questions with evidence, not decisions — that's the Advisor's job at
> DRAFT.

**Session:** 9-6 · **Phase:** 9 (Frontend Stack Replacement) · **Variant:** UI-BUILD + PORT
(deliberately cross-boundary — payment is a flow, not a layout) · **Status:** PRE-DRAFT
**Generated:** 2026-08-22 (Executor, at Session 9-5's close) · **Flags touched:** **F64**
(subscription cancel/undo — full reactivation flow, deferred here by 9-5's own corrected
Decision 2) — resolution attempt scheduled this session; may also touch **F74** (payment currency
wiring, currently OPEN, owned by Session 11-1 — do NOT resolve here, flag if it's blocking).
**Surface:** No new layout boundary — `/checkout`, `/checkout/return`, `/upgrade/success` (root
commerce, no shared layout per the route map), plus a **re-verification pass** (not a rebuild) of
`/pricing` (row 69, owned by 9-2) and `/settings/billing` (row 75, owned by 9-5) as one
end-to-end journey.
**Feeds on:** `POST /api/checkout`, `POST /api/checkout/validate-code`, `GET /api/checkout`
(return/status polling), `GET /api/subscription`, webhook-driven via `POST
/api/webhooks/stripe`. **Test mode only** — this session must not touch live Stripe/dLocal
credentials or real charges.

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §3: `/checkout`, `/checkout/return`, and `/upgrade/success`
(route-map rows 60, 61, 87) are the last 3 unshipped Phase-9 pages that don't belong to any of
the remaining layout-boundary sessions (9-7 affiliate, 9-8/9-9 admin) — they're grouped here
because payment is a flow, not a layout, and money code earns its own focused session per
`EXECUTOR-PROTOCOL.md` §7 rather than being smeared across the sessions that happen to own
`/pricing` and `/settings/billing`.

This session also owes Session 9-5's own deferred obligation: 9-5's corrected order (Decision 2)
deliberately did NOT build a fake `/api/subscription/resume` endpoint or fabricate a soft-cancel
`cancelAtPeriodEnd` flow neither of which exists in live code — it scoped F64 down to
cancel-only and pointed canceled/FREE-tier users at `/pricing` → `/checkout` (already live,
verified working end-to-end at 9-5's own CONFIRM+close). Whether that satisfies F64 in full, or
whether F64 still wants something more (an explicit "reactivate my exact subscription" concept
distinct from buying a new one), is this session's own open question below — not decided by 9-5.

---

## Entry criteria (re-verify all at CONFIRM)

- [ ] **Session 9-5 CONFIRMED, executed, CLOSED** — `settings/` 11 live on `main`, route-manifest
      diff clean.
- [ ] **`DECISION-LOG.md`'s DECISION-LOG.md size gate (EXECUTOR-PROTOCOL §1 step 0) resolved or
      explicitly re-deferred** — flagged at 9-5's own close as ~101.5KB, roughly double its ~50KB
      target, predating 9-5. Do not skip this check again.
- [ ] **Route-map rows 60, 61, 69, 75, 87 re-verified directly** against
      `frontend-swap-route-map.md`.
- [ ] **`app/checkout/page.tsx`, `app/checkout/return/page.tsx`, `app/upgrade/success/page.tsx`
      confirmed existing** — all three already live at their final top-level paths (no route-group
      move needed, unlike every other Phase 9 session so far). Read each in full before assuming
      "port" means the same thing here it did in prior sessions — `app/checkout/page.tsx`'s current
      implementation (read at 9-5's own PRE-DRAFT time) is a real, detailed unified Stripe+dLocal
      flow (country detection, discount codes, 3-day dLocal trial plan) — confirm whether it is
      DavinTrade-branded already or still carries "Trading Alerts" styling before scoping this as
      a rebrand-only vs. a real gap-fill session.
- [ ] **Stripe test-mode credentials confirmed live and usable** in this environment — this
      session cannot proceed on real/live credentials per its own Test-mode-only constraint.
- [ ] **`/pricing` (9-2) and `/settings/billing` (9-5) confirmed unchanged since their own
      sessions closed** — this session re-verifies, does not rebuild, either page.
- [ ] **Sequential test suite baselines green** (`LESSONS-LEARNED.md` L24): monolith `tsc`/
      `eslint`/`test:ci`; money-service `npm test -- --maxWorkers=1`; operation-service `npm test`.

---

## Open questions (Advisor resolves at DRAFT, per PD1)

1. **Does F64 close with 9-5's own re-subscribe-via-/pricing pattern, or does it need a real
   "reactivate this exact subscription" flow distinct from a fresh purchase?** `/api/subscription/
cancel` performs an immediate, full Stripe cancellation (not a soft `cancelAtPeriodEnd`) — there
   is no "reactivate the same subscription" concept possible server-side once that's happened; a
   post-cancel user can only buy a new subscription. If that's an acceptable resolution, this
   session should formally close F64 in `DECISION-LOG.md`. If not, scope what a real reactivation
   flow would need (a genuinely new endpoint, Stripe API calls, DB writes) — this is money-adjacent
   and needs explicit Davin sign-off either way per `EXECUTOR-PROTOCOL.md` §7.
2. **Is `/checkout`'s current implementation DavinTrade-branded or still on the old design
   system?** Unverified as of this PRE-DRAFT — read the file in full at DRAFT/CONFIRM before
   assuming either way.
3. **dLocal's "Renew Now" manual-renewal flow** (referenced only in the still-unmounted
   `components/billing/subscription-card.tsx`, per 9-5's Deviation 1) — in scope for this session,
   or deferred? The real, live billing page (`app/settings/billing/page.tsx`, 9-5) does not
   currently surface this at all for dLocal PRO users.
4. **Scope boundary with F74** (payment currency wiring, owned by Session 11-1, OPEN,
   ⚠ NEEDS EXPLICIT SIGN-OFF) — confirm `/checkout`'s current currency handling doesn't require
   F74's own resolution first; if it does, this session may be partially blocked.
5. **Webhook re-verification depth** — `POST /api/webhooks/stripe` was cut over at Session 4A-13
   (dual-delivery, F60/F75 resolved). Does this session need to re-prove the live webhook path
   end-to-end (a real test-mode checkout → webhook → DB write), or is re-reading 4A-13's own
   evidence sufficient?

---

## Rules specific to this variant

- **Money/auth escalation is absolute** (`EXECUTOR-PROTOCOL.md` §7): any change to payment
  semantics, Stripe/dLocal API calls, or webhook handling beyond this order's own explicit steps
  stops and asks Davin — no exceptions, no "obviously fine" judgment calls.
- **Test mode only.** No real charges, no live credential use, this session or ever without
  Davin's own explicit go-ahead recorded in `DECISION-LOG.md`.
- **Zero Mock Data:** every payment action must execute against real Stripe/dLocal test-mode APIs.
- **Re-verification, not rebuild, for `/pricing` and `/settings/billing`** — those sessions already
  closed; this session's job is to prove the 3-page flow works end-to-end with them, not to
  re-touch their own files unless CONFIRM finds a real regression.

---

## Rollback

`git revert` of this session's commits, one commit per logical step.

---

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

---

## Next-session handoff

- **Next session:** `9-7` — `app/affiliate/*` 14 (UI-BUILD), per
  `MASTER-ROADMAP-PHASES-7-15.md` §3. Five nested layouts; expect a split into 9-7a
  (public/join/register) and 9-7b (`affiliate/dashboard/*`).
- **Prerequisite:** Session 9-6 CLOSED — payments flow live and re-verified end-to-end on `main`.
- **9-6 obligation carried to close:** PRE-DRAFT Session 9-7's migration order per
  `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`.
