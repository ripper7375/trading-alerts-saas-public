# Migration Order — Session 6-3 — Alerts & Charts

> For a session that **wires 3 orphan tier endpoints into the alerts UI and adds a missing
> alert-edit route** — no cross-stack PORT, no flags, no new backend endpoints (all 4 the UI
> needs already exist and are already live). Adapted from `TEMPLATE-UI-BUILD.md`, dial **High for
> the new edit-form UI/flow, Low for data** (every read this session needs is already a real,
> live endpoint). Sourced from `docs/migration-orders/phase-6-frontend-gap-matrix.md` rows A1-11
> and A2-4 — re-verify both at CONFIRM per `LESSONS-LEARNED.md` L27, the same discipline every
> prior Phase 6 session's CONFIRM used.

**Session:** 6-3 · **Phase:** Phase 6 (Frontend Redesign) · **Variant:** UI-BUILD (dial HIGH for
the new edit flow, LOW for data) · **Status:** PRE-DRAFT · **Generated:** 2026-08-10 (at Session
6-2 close) · **Flags touched:** none · **Estimated time:** ~3-5h
**Surface:** `app/(dashboard)/alerts/*` (new `[id]/edit` route), `components/alerts/*`
(`alert-form.tsx` and its tier-aware siblings) · **Feeds on:** `GET /api/tier/symbols`,
`GET /api/tier/combinations`, `GET /api/tier/check/[symbol]` (all live, currently zero UI
consumers), `GET`/`PATCH /api/alerts/[id]` (live, cut over at Slice 7/4B-7).

---

## Context

Two rows from `phase-6-frontend-gap-matrix.md`, both independently re-verified at Session 6-1's
own CONFIRM (not re-verified again since — this order's own CONFIRM must redo that per L27):

- **A1-11 (`/alerts` + `/alerts/new`):** `components/alerts/alert-form.tsx`'s own comment at line
  70 says the form is "for creating and editing price alerts," but no `alerts/[id]/edit` route
  exists anywhere in the tree (confirmed via `find`, zero matches). Separately, 3 real, live,
  already-built tier endpoints have zero UI consumers: `GET /api/tier/symbols` (137 lines),
  `GET /api/tier/combinations` (164 lines), `GET /api/tier/check/[symbol]` (144 lines) — only the
  route files themselves reference their own paths.
- **A2-4 (`/alerts/[id]/edit`):** the backing API this new route needs is already live and cut
  over — `GET`/`PATCH /api/alerts/[id]` (Slice 7 / Session 4B-7). Building the page is pure
  frontend work against an already-proven contract.

Real, live pages already exist at `app/(dashboard)/alerts/page.tsx` (list) and
`app/(dashboard)/alerts/new/page.tsx` (create) — `alert-form.tsx` (334 lines) is presumably shared
between create and the not-yet-built edit flow; confirm this at CONFIRM/Step 1, don't assume from
the matrix's own citation alone.

## User Review Required

> [!NOTE]
> **Tier-endpoint UX is not yet decided.** The 3 orphan `/api/tier/*` endpoints exist but nothing
> in the matrix or this PRE-DRAFT specifies exactly how the alert form should use them (e.g.,
> disabling unavailable symbol/timeframe combinations at the field level vs. a submit-time
> validation error vs. a dedicated upgrade-prompt state for FREE users hitting a PRO-only
> combination). This needs a design decision at DRAFT stage, informed by reading
> `lib/tier-config.ts`/`lib/tier-validation.ts` (the same tier-limit logic Slice 10's `TierGuard`
> already enforces server-side) rather than reinvented here.

## Entry criteria

- [ ] Session 6-2 CONFIRMED, executed, closed (2026-08-10 — see `CLAUDE.md` Current entry).
- [ ] A1-11 and A2-4 re-verified at CONFIRM against live code (file existence, line counts, the
      "zero UI consumers" claim on all 3 tier endpoints, `alert-form.tsx`'s own create/edit
      assumption).
- [ ] Monolith baseline re-measured at CONFIRM (`tsc --noEmit`, `eslint app components lib hooks
--max-warnings 0`, `test:ci` — last known at 6-2's close: 132/132 suites, 2202/2202 tests, 3
      pre-existing lint warnings).
- [ ] Full Advisor DRAFT + Davin APPROVED before CONFIRM — not fast-path eligible (new UI flow,
      the tier-endpoint UX question above needs a real design decision first).

## Ordered steps

_(sketch only — the Advisor's DRAFT should firm this up once the tier-endpoint UX question above
is resolved)_

1. **Wire the 3 orphan tier endpoints into the alert-creation flow** (A1-11) — likely
   `GET /api/tier/symbols` and `/combinations` populate the form's own symbol/timeframe choices
   (replacing any hardcoded list, if one exists — check first), `GET /api/tier/check/[symbol]`
   validates a selection before submit per whatever UX Davin/the Advisor pick.
   _Verify:_ a FREE-tier user seeing the real tier boundary, not a hardcoded one; existing
   alert-creation tests still pass.
2. **Build `app/(dashboard)/alerts/[id]/edit/page.tsx`** (A2-4), reusing `alert-form.tsx` in its
   existing "editing" mode (per its own line-70 comment) against `GET`/`PATCH /api/alerts/[id]`.
   _Verify:_ loading/empty/error/denial (wrong-owner) states all reachable; a real edit round-trips
   correctly.
3. **Link the new edit route from wherever it's missing** — likely the alerts list page needs an
   "Edit" action per row; confirm this doesn't already exist before adding it.
   _Verify:_ no new dead link introduced; existing list-page tests still pass.

## Rules specific to this variant

- Tier/limit data renders exactly as the live endpoints return it — no client-side re-derivation
  of what a user's tier allows (that's `lib/tier-config.ts`'s job server-side already).
- No new backend endpoints, no new Prisma queries — everything this session needs already exists
  and is already live.
- A11y from the start on the new edit route, not deferred to 6-12.
- Record every design decision (especially the tier-endpoint UX question above) in Deviations.

## Done when

- [ ] All 3 orphan `/api/tier/*` endpoints have a real UI consumer.
- [ ] `/alerts/[id]/edit` exists, reachable, and round-trips a real edit.
- [ ] `tsc --noEmit` clean; `eslint --max-warnings 0` introduces 0 new warnings; `test:ci` green.
- [ ] Live manual check of the create + edit alert flows (same carried-forward gap as 6-1b/6-2 —
      Waiting-on #117 — try to close it this session if a real session becomes available).

## Rollback

No flag (same as every Phase 6 session so far — same-stack UI work, not a cutover). Rollback is
`git revert`.

## Deviations

_(filled during execution)_

## Next-session handoff

Session **6-4** (notifications — builds the `/notifications` page the bell already links to) is
next per the Phase 6 order in `CLAUDE.md`'s own "Next session" pointer.
