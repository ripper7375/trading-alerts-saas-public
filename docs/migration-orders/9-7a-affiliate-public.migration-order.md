# Migration Order — Session 9-7a — `app/affiliate/*` public onboarding

> For sessions that **build or redesign frontend surfaces**: read `00-SKELETON-AND-RULES.md`
> first — §4 applies with the dial at **High** for page-body content/layout, **Zero** on data
> (every page binds to the endpoint its 9-0 row names). **PRE-DRAFTed by the Executor at Session
> 9-6's close (2026-08-22)**, informed by `frontend-swap-route-map.md` and 9-6's own Deviations.
> Per PD1, `Decisions taken` below is deliberately left as open questions with evidence, not
> decisions — that's the Advisor's job at DRAFT.

**Session:** 9-7a · **Phase:** 9 (Frontend Stack Replacement) · **Variant:** UI-BUILD · **Status:** PRE-DRAFT
**Generated:** 2026-08-22 (Executor, at Session 9-6's close) · **Flags touched:** none identified
at PRE-DRAFT time — flag if 9-7a's own build surfaces one.
**Surface:** `app/affiliate/*` — the public/pre-affiliate cluster only, one of the two splits
`MASTER-ROADMAP-PHASES-7-15.md` §3 and 9-6's own Next-session handoff both anticipated for the
5-nested-layout, 14-page Session 9-7. Rows 43 (`/affiliate/join`), 44 (`/affiliate/register`),
48 (`/affiliate`, landing), and the retirement of row 47 (`/affiliate/verify`, no CB2
counterpart — folds into `/affiliate/register`'s own flow).
**Feeds on:** `POST /api/affiliate/auth/register` (row 44); rows 43/48 are static, no API.

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §3: `app/affiliate/*` has **5 nested layouts**, and the
roadmap explicitly expects "this to split into 9-7a (public/join/register) and 9-7b
(`affiliate/dashboard/*`)" rather than one 14-page session. This order covers only the
non-authenticated half — `/affiliate/join`, `/affiliate/register`, and the `/affiliate` landing
page — none of which require a session, so they're verifiable end-to-end without the
authenticated-affiliate test-account gap 9-7b will need to check.

`frontend-swap-route-map.md` assigns this session rows 43, 44, 47 (retired), 48. Rows 45
(`/affiliate/resources`) and 46 (`/affiliate/settings/payout`) are marked `NON-LOGIN / SESSION
mixed (see override)` in the route map with an `AFFILIATE (+FREE or +PRO)` tier gate — they read
as authenticated-affiliate surfaces despite the map's own auth-gate column wording, and are
scoped to 9-7b below as an open question rather than assumed here.

---

## Entry criteria (re-verify all at CONFIRM)

- [ ] **Session 9-6 CONFIRMED, executed, CLOSED** — payments flow live on `main`, route-manifest
      diff clean.
- [ ] **Route-map rows 43, 44, 47, 48 re-verified directly** against `frontend-swap-route-map.md`.
- [ ] **`app/affiliate/page.tsx`, `app/affiliate/join/page.tsx`, `app/affiliate/register/page.tsx`
      confirmed existing** and read in full — confirm whether any of the 3 already carry
      DavinTrade branding or still need a real gap-fill (not just a restyle), same check every
      Phase 9 session has needed at its own CONFIRM.
- [ ] **`POST /api/affiliate/auth/register` confirmed existing and its real request/response
      shape read** before wiring `/affiliate/register`'s form to it.
- [ ] **Row 47's retirement confirmed safe:** verify `app/affiliate/verify` (if it exists on
      disk at all) has zero live inbound links/redirects depending on it before removing it, and
      confirm what "folds into `/affiliate/register`'s own verification step" concretely means by
      reading `register`'s real flow first (the route map itself says "confirm exact UX at 9-7a").
- [ ] **Sequential test suite baselines green** (`LESSONS-LEARNED.md` L24): monolith `tsc`/
      `eslint`/`test:ci`; money-service `npm test -- --maxWorkers=1`; operation-service `npm test`
      — each run in isolation per L24, not in parallel (Session 9-6's own CONFIRM hit two
      worker-OOM/SIGTERM false negatives running all three at once).

---

## Open questions (Advisor resolves at DRAFT, per PD1)

1. **Do rows 45/46 (`/affiliate/resources`, `/affiliate/settings/payout`) belong in 9-7a or
   9-7b?** The route map's own auth-gate column reads "NON-LOGIN / SESSION mixed (see override)"
   but both carry an `AFFILIATE (+FREE or +PRO)` tier gate, which reads as authenticated-only.
   Resolve which cluster owns them before either 9-7a or 9-7b starts, so neither session silently
   assumes the other has it.
2. **What does row 47's "folds into `/affiliate/register`'s own verification step" mean
   concretely?** Is there a distinct email/identity-verification step `/affiliate/register`
   needs to gain, or does "verify" collapse into something `/affiliate/register` already does
   post-signup? The route map defers this exact question to 9-7a's own build time.
3. **Is `/affiliate/join` a real distinct page or a thin landing that just links to
   `/affiliate/register`?** Read seed-code's real `join/page.tsx` before assuming either — this
   order's own entry criteria requires reading it in full, but the Advisor may already have
   evidence from the 9-0 route-map production pass worth citing here.

---

## Rules specific to this variant

- **Zero Mock Data:** `/affiliate/register`'s submit must hit the real
  `POST /api/affiliate/auth/register`, not a fabricated success state.
- **100%-fidelity invariant:** restyle to DavinTrade tokens (per the pattern established on
  `/checkout`, `/checkout/return`, `/upgrade/success` at Session 9-6) while preserving any real
  validation/error-handling logic already in the live page, if one already exists at a different
  path.
- **Scope discipline:** this order does not touch `app/affiliate/dashboard/*`,
  `app/affiliate/settings/*`, or any authenticated-affiliate surface — those are 9-7b's, pending
  Open Question 1's resolution.

## Done when

- [ ] `/affiliate`, `/affiliate/join`, `/affiliate/register` live with DavinTrade branding,
      real registration logic, zero mock data.
- [ ] Row 47 retirement resolved per Open Question 2 — either a real verification step is added
      or its absence is explicitly justified in Deviations.
- [ ] Route-manifest diff matches this session's scope and nothing else.
- [ ] `npx tsc --noEmit`, `npx eslint app components lib hooks --max-warnings 5`, and
      `npm run test:ci` all pass clean.

## Rollback

`git revert` of this session's commits. Prefer one commit per page/step.

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

## Next-session handoff

- **Next session:** `9-7b` — `app/affiliate/dashboard/*` + `/affiliate/settings/payout` (pending
  Open Question 1) (UI-BUILD), per `MASTER-ROADMAP-PHASES-7-15.md` §3.
  - Scope: rows 35–42 (dashboard cluster: code-inventory, codes, commissions, payouts,
    profile/payment, profile, statements, dashboard root) plus rows 45/46 if Open Question 1
    resolves them here.
  - Known gaps to carry forward from the route map: row 38 (`/affiliate/dashboard/payouts`) and
    row 41 (`/affiliate/dashboard/statements`) both have **no self-service backend endpoint** —
    only admin-side `/api/disbursement/*` exists. 9-7b cannot ship real data for these two rows
    without either a new endpoint or an explicit Davin-approved scope cut; flag at 9-7b's own
    CONFIRM, don't silently mock.
- **Prerequisite:** Session 9-7a CLOSED.
