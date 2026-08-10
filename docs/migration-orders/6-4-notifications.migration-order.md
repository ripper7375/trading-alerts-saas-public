# Migration Order — Session 6-4 — Notifications

> For a session that **builds the missing `/notifications` page** — the bell icon's own "View all"
> link (`components/notifications/notification-bell.tsx:477`) has pointed at `/notifications`
> since Session 4B-9/4B-17, and it currently 404s (no `app/(dashboard)/notifications/` or
> `app/notifications/` directory exists anywhere in the tree — confirmed via `find`). No cross-stack
> PORT, no flags, no new backend endpoints — all 5 real, live `GET`/`POST`/`DELETE`
> `/api/notifications/*` routes this session needs already exist (Session 4B-9, CUT-OVER & LIVE).
> Adapted from `TEMPLATE-UI-BUILD.md`, dial **High for the list/filter UX, Low for data** (every
> read/write this session needs is already a real, live endpoint). Sourced from
> `docs/files-completion-list/ui-page-gap-analysis.md` / `phase-6-frontend-gap-matrix.md`'s own
> notifications row (re-verify at CONFIRM — this PRE-DRAFT was authored from a direct codebase
> read, not from re-opening either gap-analysis document).

**Session:** 6-4 · **Phase:** Phase 6 (Frontend Redesign) · **Variant:** UI-BUILD (dial HIGH for
list/filter UX, LOW for data) · **Status:** PRE-DRAFT · **Generated:** 2026-08-10 (at Session 6-3
close) · **Flags touched:** none · **Estimated time:** ~3-5h
**Surface:** `app/(dashboard)/notifications/*` (new) · **Feeds on:** `GET /api/notifications`,
`POST /api/notifications` (mark-all-read), `GET`/`DELETE /api/notifications/[id]`,
`POST /api/notifications/[id]/read`.

---

## Context

- **The gap:** `components/notifications/notification-bell.tsx` (503 lines) already renders a
  dropdown preview (`fetch('/api/notifications?pageSize=10')`) with mark-read/mark-all-read/delete
  actions wired to the real API — but its own "View all" link (line 477) points at `/notifications`,
  a route that has never existed. Confirmed via `find app -iname '*notification*'`: only
  `app/api/notifications/*` exists, no page directory.
- **The backend is fully live, cut over, and already forward-referenced by this bell component** —
  all 5 routes (`GET`/`POST /api/notifications`, `GET`/`DELETE /api/notifications/[id]`,
  `POST /api/notifications/[id]/read`) shipped and cut over at Session 4B-9 (`MIGRATE_NOTIFICATIONS
=true` in production). `GET /api/notifications` supports `status` (`all`/`unread`/`read`), `type`
  (`ALERT`/`SUBSCRIPTION`/`PAYMENT`/`SYSTEM`), and `page`/`pageSize` (10-50, default 20) query
  params (`app/api/notifications/route.ts:17-21`) — real filtering/pagination this session should
  actually expose in the UI, not just read the first page.
- **A second orphaned-component finding, same shape as Session 6-3's own `AlertForm` discovery
  (`LESSONS-LEARNED.md` L57):** `components/notifications/notification-list.tsx` (667 lines) has
  **zero importers anywhere in the tree** — grepped, confirmed. This may be a ready-built,
  already-battle-tested full-list rendering component (a natural candidate for this new page's own
  body) or it may be dead/abandoned code with its own latent bugs (mirroring the
  `subscription-card.tsx` finding from Session 6-1b, `DECISION-LOG.md` F64). **Not read in full this
  session** — CONFIRM (or Step 1) must read its actual implementation before deciding whether to
  mount it, adapt it, or ignore it in favor of new code; do not assume "667 lines already written"
  means "ready to wire in" without verifying, per L57's own rule.

## User Review Required

> [!IMPORTANT]
> **No PRO gating on this page** — unlike Alerts, Notifications is not a tier-gated feature
> anywhere in the existing code (`notification-bell.tsx` renders for every logged-in user
> regardless of tier). Confirm this assumption holds before building — don't invent a PRO gate the
> real API doesn't enforce either (`app/api/notifications/route.ts` has no tier check).

> [!NOTE]
> **Open question — `notification-list.tsx`'s fate:** does the new page mount this orphaned
> component (after reading it in full), adapt parts of it, or build fresh? Needs a decision at
> DRAFT stage informed by actually reading the file, not guessed at here.

## Entry criteria

- [ ] Session 6-3 CONFIRMED, executed, closed (2026-08-10 — see `CLAUDE.md` Current entry).
- [ ] `notification-bell.tsx`'s `/notifications` link and the 5 backing API routes re-verified at
      CONFIRM against live code (file existence, line counts, query-param support).
- [ ] `notification-list.tsx` read in full at CONFIRM/DRAFT — the "orphaned, ready to mount vs.
      dead code" question above resolved with evidence, not assumed either way.
- [ ] Monolith baseline re-measured at CONFIRM (`tsc --noEmit`, `eslint app components lib hooks
--max-warnings 0`, `test:ci` — last known at 6-3's close: 133/133 suites, 2209/2209 tests, 3
      pre-existing lint warnings).
- [ ] Full Advisor DRAFT + Davin APPROVED before CONFIRM — not fast-path eligible (new page, the
      `notification-list.tsx` question above needs a real decision first).

## Ordered steps

_(sketch only — the Advisor's DRAFT should firm this up once the `notification-list.tsx` question
above is resolved)_

1. **Read `notification-list.tsx` in full** and decide its fate (mount / adapt / ignore) — record
   the decision and reasoning in Deviations regardless of which way it goes.
2. **Build `app/(dashboard)/notifications/page.tsx`** (list, filter by status/type, paginate via
   the real query params) + a client component for the interactive parts (mark-read, mark-all-read,
   delete — mirroring `notification-bell.tsx`'s own already-proven fetch calls to the same 3 mutating
   endpoints, not reinventing the request shapes).
   _Verify:_ real notifications render with real pagination/filtering; mark-read/delete round-trip
   against the live API; an empty-state renders correctly for a user with zero notifications.
3. **Confirm the bell's "View all" link now resolves** (no code change needed there — just prove
   the destination exists).
   _Verify:_ navigating from the bell dropdown to `/notifications` no longer 404s.

## Rules specific to this variant

- No new backend endpoints, no new Prisma queries — everything this session needs already exists
  and is already live (Session 4B-9).
- Real filtering/pagination via the existing query params, not a client-side-only re-slice of one
  fetched page.
- A11y from the start on the new page, not deferred to 6-12.
- Record the `notification-list.tsx` decision (and reasoning) in Deviations.

## Done when

- [ ] `/notifications` exists, renders real notifications with real filter/pagination, and no
      longer 404s from the bell's "View all" link.
- [ ] Mark-read, mark-all-read, and delete all round-trip against the real API from the new page.
- [ ] `tsc --noEmit` clean; `eslint --max-warnings 0` introduces 0 new warnings; `test:ci` green.
- [ ] Live manual check of the new page (same carried-forward gap as every Phase 6 session since
      6-1b — Waiting-on #117 — try to close it this session if a real session becomes available).

## Rollback

No flag (same as every Phase 6 session so far — same-stack UI work, not a cutover). Rollback is
`git revert`.

## Retire

N/A.

## Deviations

_(filled during execution)_

## Known wrinkles / do-not-touch

- `lib/api/index.ts` stays untouched (`EXECUTOR-PROTOCOL.md` §5).
- `frontend/` mirror tree is out of scope (`EXECUTOR-PROTOCOL.md` §5).
- `DECISION-LOG.md` **F21**, **F50**, and **F64** stay open, non-blocking.

## Next-session handoff

Session **6-5** (Settings/User — account-deletion confirm/cancel pages) is next in Phase 6, per
`CLAUDE.md`'s own Phase 6 session order.
