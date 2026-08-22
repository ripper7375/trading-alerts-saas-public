# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.**
> **Role Distinction:**
>
> - **In Antigravity Chat UI:** You act as **Antigravity (Advisor & Architect)** — planning, drafting migration orders, reviewing codebase decisions, guiding Davin.
> - **In Terminal CLI:** You act as **Claude Code (Executor)** in the three-role Development Chain Protocol — running shell commands, executing code edits, running unit tests, git commits.
>   Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` — **read it at the start of every session before doing anything else.**
>   The previous content of this file (Aider validation guide) moved to
>   `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

---

## Current state _(update at the end of EVERY session)_

> **STANDING INSTRUCTION (Davin, 2026-07-22, NARROWED 2026-07-24 — still in force
> until Davin lifts it further):** chain-length-one originally read as "webhooks cut
> over FIRST (both providers), before 4A-7 or any Slice 4 work." **Davin confirmed
> live, 2026-07-24, that this narrows to dLocal-cutover-first**: with dLocal now
> CUT-OVER (Session 4A-5, see Current below), 4A-7/Slice 4 work is unblocked — it does
> NOT need to wait for RiseWorks. RiseWorks's own cutover (`4A-5-RW`) trails
> independently, gated on RiseWorks replying with webhook/API settings (see Waiting on).
> **Session 4A-3 (below) was an explicit, scoped exception Davin asked for directly in
> chat — Slice 1 (crons) cutover, independent of this question — not itself a lifting
> of the standing instruction.** With dLocal cut over too, Slice 3/4 BUILD work (4A-7
> onward) may now proceed; RiseWorks-specific work stays gated on `4A-5-RW`'s own entry
> criteria.

- **Current:** Session 9-5 (`settings/` 11, Phase 9, UI-BUILD), CONFIRMED, executed, **CLOSED
  SUCCESSFUL** 2026-08-22. Sixth session of Phase 9 — ships all 11 route-map rows (73–83): the
  `app/settings/layout.tsx` boundary (session's own one moved layout: auth gate, `AppearanceProvider`,
  `AppHeader`, shared sub-nav) plus `settings` (hub), `account`, `appearance` (Protected #5),
  `billing`, `help` (Protected #6), `language`, `privacy`, `profile`, `security`,
  `security/activity`, `terms`. Formally documents progress on **F21** (24h account-deletion) and
  **F64** (subscription cancel) in `DECISION-LOG.md`, both left OPEN per the corrected order's own
  scoping — see below.
  **CONFIRM found real, material problems in the order Davin hadn't yet seen, escalated rather than
  silently fixed or silently trusted:** the committed PRE-DRAFT's row-73–83 mapping didn't match
  `frontend-swap-route-map.md`'s real rows at all (scrambled numbers, a fabricated `settings/
notifications` page with zero route-map row/legacy source/seed-code source, and the real row 82
  `/settings/terms` dropped from the Ordered Steps entirely); `POST /api/subscription/resume` was
  required by the entry criteria and Decision 2 but does not exist anywhere in the repo; and
  `/api/subscription/cancel` (which Decision 2 assumed sets `cancelAtPeriodEnd`) actually performs
  an immediate, full Stripe cancellation — architecturally incompatible with the "Undo" flow the
  order described. Reported all three as failing entry criteria rather than starting; **Davin (via
  Antigravity) corrected the order directly in response** — resume dropped, F64 rescoped to
  cancel-only with reactivation deferred to Session 9-6, notifications swapped for terms across all
  11 rows — the first time this session-close/PRE-DRAFT loop has visibly closed the Advisor↔Executor
  gap PD1 exists to bridge.
  **CONFIRM found the by-now-familiar L3 pattern one more time** (26th+ recurrence, one commit total
  in the order file's own history): committed HEAD held the bare PRE-DRAFT; the corrected-and-
  approved text arrived as an uncommitted working-copy edit. Davin's own chat message directly
  restated the layout-boundary decision, the Protected Pages note, and the F21/F64 framing before
  authorizing execution — treated as live confirmation, matching the established pattern.
  **`LESSONS-LEARNED.md` L15's exact failure class recurred a second time, on the opposite side of
  the same bug:** the order's own Decision 2 named `components/billing/subscription-card.tsx` as
  what to wire for F64 — reading the REAL, live `app/(dashboard)/settings/billing/page.tsx` before
  porting it found it never imports that component at all. The real billing page has its own
  inline, confirm-before-cancel flow with no optimistic "Undo" step, so it never had F64's bug to
  begin with. Ported the real live flow unchanged; `subscription-card.tsx` stays unmounted dead
  code, unchanged, still carrying its original bug — Davin's own future call, not this session's.
  **F21's real backend state read directly from source before wiring the UI, not assumed from the
  order's framing:** `deletion-request`/`deletion-confirm` routes already implement a real, DB-
  backed 7-day link-expiry + 24h post-confirm grace period — but both still have live `// TODO`
  stubs (console.log only) for the confirmation/scheduling emails, and no cron/worker exists
  anywhere in the repo (grepped) to execute the actual deletion. Wired the UI to the real endpoint
  as the corrected order's own Decision 3 asks; the backend completion gap is disclosed in
  Deviations and `DECISION-LOG.md`, not silently fixed (real email/cron infra is well outside a
  UI-BUILD session) and not silently hidden.
  **Help page (Protected Page #6) needed two real-vs-mock swaps to satisfy both the 100%-fidelity
  invariant and the Zero-Mock-Data rule at once:** seed-code's version calls a chat widget deferred
  to Phase 14 (confirmed unmounted, per 9-1's own finding) and fakes its ticket-submit with a bare
  `setTimeout` (confirmed: no `/api/support`/`/api/contact`/`/api/ticket` route exists anywhere).
  Ported the real DavinTrade visual design, swapped the chat CTA for a real
  `mailto:support@davintrade.com` link (per the order's own Step 2) and the fake ticket-submit for
  a real pre-filled `mailto:` compose, rather than shipping a "ticket submitted" success state for
  a request nothing delivers.
  **A live, reproducible instance of `DECISION-LOG.md` F77's own defect class found on this
  session's own new page, root cause now identified:** confirmed via a real `next build && next
start` production server (not dev/HMR) that `/settings/appearance` carries a second, inert copy
  of its own content in `<div id="S:0" style="display:none">` alongside React/Next's own
  `$RC`/`$RT`/`$RV` Suspense-streaming "reveal" scripts — this route's own `app/settings/loading.tsx`
  creates the Suspense boundary. Confirmed benign (`display:none`, 0×0 rect, non-interactive, zero
  console/hydration errors) and confirmed present on the unrelated, pre-existing `/login` page too,
  ruling out this session's own code as the cause. Logged as an addendum to F77 (likely its real
  root cause) rather than a new flag or further open-ended chase, matching Davin's own 9-4 call on
  the same defect class.
  **Live 2FA click-through blocked by local environment, not app code, and disclosed as such:**
  `POST /api/user/2fa/setup` is cut over to `operation-service`, which wasn't running in this
  session's local preview (only the monolith was) — server logs show a genuine `ECONNREFUSED`, not
  an app error. `operation-service`'s own 42/42 test suites pass; login history and sessions (still
  monolith-routed) verified live with real data with no issue.
  **All test baselines re-verified live, all green, exact match to entry-criterion baseline:**
  monolith `tsc` clean, `eslint` 0 errors/5 warnings (pre-existing, none in touched files), `test:ci`
  160/160 suites/2400/2400 tests; money-service 62/62 suites/526/526 tests; operation-service 42/42
  suites/393/393 tests. A real production build (`next build`) also verified clean, used for the
  F77-addendum investigation above.
  **Route-manifest diff clean:** `git diff --stat` against the session's own start commit confirms
  `app/(dashboard)/layout.tsx` and `app/(dashboard)/admin/*` show zero diff; exactly the 11 rows'
  own files moved/rewritten (mostly detected as renames), the new layout + nav component, and 5
  pre-existing test files' import paths fixed (zero assertion changes needed).
  **A real hygiene gap found at close, not silently skipped:** `DECISION-LOG.md` is 101.5KB,
  roughly double its ~50KB target — this predates this session (this session's own edits added
  only ~3KB) and was missed at this session's own OPEN (the §1 step-0 size gate check was skipped).
  Not fixed this session — a full archival pass done quickly at session-close risked more harm than
  the oversized file itself — flagged explicitly as owed at Session 9-6's own OPEN step 0 instead of
  silently deferred again.
  **Artifacts updated:** `9-5-settings.migration-order.md` (Status → CONFIRMED → CLOSED SUCCESSFUL,
  7 Deviations + checked Done-when/entry-criteria boxes), `DECISION-LOG.md` (F21/F64 register rows
  updated with this session's evidence, both still OPEN; F77 addendum), `migration-stack-analysis.md`
  (Session 9-5 entry pending below), this file (Current/Previous rotation — Session 9-3 moved to
  `history/sessions-archive.md`). `migration-cutover-table.md` correctly needs no changes (Phase 9
  is additive builds, no route/slice moved).
- **Previous:** Session 9-4 (`(dashboard)` core 7 + `/terminal` + `/free`, Phase 9, UI-BUILD),
  CONFIRMED, executed, **CLOSED SUCCESSFUL** 2026-08-22. Fifth session of Phase 9 — ships all 8
  active route-map rows (49, 50, 51, 57, 58, 62, 68 + 2 retired: 55/56, 59): the 5 `(dashboard)`
  core pages (dashboard, alerts, alerts/new, alerts/[id]/edit, notifications), the flagship
  4-panel PRO `/terminal` and 3-panel FREE `/free` quantitative workspaces, and retirement of the
  2 legacy `/charts` routes (now permanent redirects to `/terminal`).
  **CONFIRM found the by-now-familiar L3 pattern again** (24th+ recurrence): committed HEAD held
  only the bare PRE-DRAFT stub; working copy carried the full Advisor DRAFT→APPROVED upgrade (5
  numbered decisions). Davin's own chat message opening the session independently restated two of
  the five decisions verbatim, serving as live confirmation before execution began.
  **A real architecture conflict found and corrected before writing any layout code, escalated via
  `AskUserQuestion` rather than guessed:** the order's own Step 1 (and the 9-0 route map's own
  "Main-Repo Target" column) put `/terminal` and `/free` under `app/(dashboard)/`, sharing
  `app/(dashboard)/layout.tsx`'s chrome — but reading `seed-code`'s real `terminal/page.tsx` and
  `free/page.tsx` in full showed both are full-screen 4-panel workspaces that mount `ChatSidebar`
  themselves as an internal panel and never use `AppHeader`. Corrected: both moved to top-level
  routes (`app/terminal/`, `app/free/`) with their own minimal layout (auth gate only). A second,
  mechanical correction followed directly from reading all 5 core pages' own seed-code sources:
  none of them consume a shared header from a layout either — each mounts its own `AppHeader`
  directly — so `app/(dashboard)/layout.tsx` was restyled as a thin auth-gate wrapper with zero
  chrome of its own, not an `AppHeader`+`ChatSidebar` shell as Decision 3 originally described.
  **Live browser testing at Step 5 found a second, more serious architecture conflict this
  session's own earlier reasoning missed:** removing the shared layout's chrome broke `/settings/*`
  (11 pages, 9-5's scope) and `/admin/*` (19+ pages, 9-8's scope) — neither touched this session,
  both now silently rendering with **zero navigation chrome** (`tsc`/`eslint`/`test:ci` cannot
  catch this; only a real browser check can). Escalated via a second `AskUserQuestion`; Davin's
  call extended the exact same terminal/free pattern to the 5 core pages too — moved to top-level
  routes (`app/dashboard/`, `app/alerts/`, `app/notifications/`), `app/(dashboard)/layout.tsx`
  restored byte-identical to its pre-session form via `git show`, so `/settings/*`/`/admin/*` are
  now completely untouched by this session, as originally intended.
  **Pre-existing latent defects fixed in `AppHeader`/`ChatSidebar` before their first real mount,
  per `LESSONS-LEARNED.md` L15:** both were built at Session 9-1 but never mounted anywhere
  (confirmed zero importers repo-wide before this session) — reading their full implementation
  before wiring them into a real authenticated surface found both hardcoded a static "Trader
  User" identity regardless of who's actually logged in, and both "Log out" buttons were a bare
  `<Link href="/login">` that never called `signOut()`, leaving the real session cookie live
  server-side. Fixed both identically: real identity via `useSession()`, the same bridge-aware
  logout flow `components/layout/header.tsx` already uses.
  **Panel 1 of `/terminal`/`/free` reuses the real, pre-existing `components/charts/
trading-chart.tsx`** (live Socket.IO OHLCV, real drawing toolbar, PRO-gated multi-timeframe
  overlay) instead of porting seed-code's own 856-line mock chart component. `ChatPanel`/
  `MarketCommentsPanel` (Stack D/E) ship as genuine empty states, zero mock data, per Decision 2 —
  seed-code's own versions were full mock prototypes (fabricated chat history, fake token
  counters, invented market comments and a fictional trade-setup card). `ProUpgradeModal` ported
  with its fake in-place "upgrade succeeded" behavior replaced by a real `/pricing` navigation.
  **A genuine test regression found and fixed at Step 6, `LESSONS-LEARNED.md` L40's exact failure
  class, 4th occurrence:** mounting `AppHeader` broke `notifications-page.test.tsx` (7 tests) and
  `edit.test.tsx` (2 tests) — fixed forward per 9-3's own established pattern (real `LocaleProvider`
  - localStorage-seeded `defaultPreferences` + `usePathname` stub); `edit.test.tsx` also had zero
    `next-auth/react` mock at all, added one.
    **A known, unresolved, disclosed defect closed this session rather than chased indefinitely —
    see `DECISION-LOG.md` F77:** `/alerts` and `/alerts/new` duplicate their client-rendered content
    on a genuine browser reload (confirmed in a real `next build && next start` production server,
    not a dev/HMR artifact; raw SSR HTML verified clean via direct `fetch()`; zero console/hydration
    errors). Live-verified this has a real functional consequence, not just cosmetic: a test alert
    submitted through the duplicated form stored `25002500` instead of `2500` (immediately deleted).
    Extensive isolation via a throwaway diagnostic route found `AlertForm`/`CreateAlertClient`
    reproduces it standalone, but so does `AlertsClient` (zero fetch effects) — no single common
    trigger identified. Davin's live call, after reviewing the full diagnostic trail: close with it
    documented rather than open-ended further investigation.
    **All test baselines re-verified live, all green:** monolith `tsc` clean, `eslint` 0 errors/5
    warnings (pre-existing, none in touched files), `test:ci` 160/160 suites/2400/2400 tests
    (re-run three times across the session's own corrections); money-service 62/62 suites/526/526
    tests (one worker-OOM false-negative on a shared-resource run, clean on single-worker re-run —
    L24's own "re-run fresh, nothing in flight" rule); operation-service 42/42 suites/393/393 tests.
    A real production build (`next build`) also verified clean (exit 0) as part of the F77
    investigation.
    **Route-manifest diff clean:** `git diff --stat` against the session's own start commit confirms
    `app/(dashboard)/settings/*` and `app/(dashboard)/admin/*` show zero diff;
    `app/(dashboard)/layout.tsx` is byte-identical to its pre-session form; exactly the 7 active +
    2 retired rows' own files moved/changed, plus their real dependency chain (5 new/ported
    components, 2 shared-component fixes, 3 orphaned files deleted, 2 stale nav links fixed).
    **Artifacts updated:** `9-4-dashboard-core-terminal-free.migration-order.md` (Status →
    CONFIRMED → CLOSED SUCCESSFUL, CONFIRM note + 16 Deviations + checked Done-when/entry-criteria
    boxes), `DECISION-LOG.md` (F77 registered, OPEN), `migration-stack-analysis.md` (Session 9-4
    entry, 12 new files/12 modified/6 deleted, all FRONTEND), `LESSONS-LEARNED.md` (L40 recurrence
    note, 4th occurrence), this file (Current/Previous rotation — Sessions 9-1 and 9-2 moved to
    `history/sessions-archive.md`; 9-1 was already there from a hygiene gap at 9-3's own close, now
    corrected). `migration-cutover-table.md` correctly needs no changes (Phase 9 is additive
    builds, no route/slice moved).
- **Previous:** Session 9-3 (`(auth)` 7 + `welcome`, Phase 9, UI-BUILD), CONFIRMED, executed,
  **CLOSED SUCCESSFUL** 2026-08-22. Fourth session of Phase 9 — ships all 8 route-map rows (65, 67,
  71, 72, 88, 89, 90, 95): the 7 `(auth)` pages (login, register, forgot-password, reset-password,
  verify-2fa, verify-email, verify-email/pending) + the new `/welcome` post-registration onboarding
  page. `app/(auth)/layout.tsx` now renders a DavinTrade logo header + ambient amber backdrop
  instead of the bare, un-rebranded "Trading Alerts" wrapper — the one `layout.tsx` boundary this
  session moves, built from scratch (seed-code has no `(auth)/layout.tsx` counterpart at all).
  **This session unblocks live authenticated testing for every Phase 9 session after it**, per the
  roadmap's own framing.
  **CONFIRM found the by-now-familiar L3 pattern again** (22nd+ recurrence): committed HEAD held
  only the bare PRE-DRAFT stub; working copy carried the full Advisor DRAFT→APPROVED upgrade (three
  open questions resolved into four numbered decisions). Davin confirmed live it was his authentic
  edit before execution began. All three of the PRE-DRAFT's own open questions were independently
  re-verified against live code at CONFIRM before trusting the DRAFT's resolutions: `/welcome`
  placement (confirmed no guard logic exists to fight), `social-auth-buttons.tsx`'s real-vs-mock
  split (confirmed the main repo's own copy already calls real `signIn()`/`getProviders()` — only
  `seed-code`'s copy is a prototype), and the 2FA/email-verification branch order (confirmed
  `EMAIL_NOT_VERIFIED` and `TWO_FACTOR_REQUIRED:` are mutually exclusive branches on one credential
  attempt, not sequential).
  **The same "seed-code page looks like a restyle but is actually a mock prototype" pattern
  recurred twice more, at the highest stakes yet — live authentication itself:** `seed-code`'s
  `verify-2fa/page.tsx` never calls `POST /api/user/2fa/verify` at all (a bare `setTimeout` →
  `/dashboard`, no backup codes, no bridge branching); its `forgot-password/page.tsx` never calls
  any endpoint (`handleSubmit` just flips local state). Neither ported as-is — both pages instead
  restyle the monolith's own real, hardened implementations (bridge-aware fetch branching, backup
  codes, per-digit auto-advance inputs, the 4-step forgot-password state machine) with DavinTrade
  visuals borrowed from seed-code's design language. Zero mock data shipped in an auth flow.
  **`verify-email`'s success state deliberately does NOT link to `/welcome`, despite seed-code's own
  version doing exactly that:** email verification runs before any session exists (confirmed by
  reading `lib/auth/auth-options.ts` and the endpoint's own code comments), and `/welcome` is
  `SESSION REQUIRED` per its own route-map row — routing a freshly-verified, still-unauthenticated
  visitor there would strand them. Kept the real, correct target: `/login`.
  **`/welcome`'s step-1 feature copy dropped seed-code's fabricated "Davin AI Quantitative Chat
  Copilot ... floating widget" claim** (`components/chat-widget/*` was explicitly deferred to Phase
  14 at Session 9-1 and is not mounted anywhere) — replaced with two capabilities that are actually
  live today: real-time XAUUSD price alerts and the drawing-tools/line-alert engine. Its accent
  picker is wired to the real `lib/appearance/types.ts` `AccentScheme` type and calls both
  `updateSettings()` (instant) and `saveSettings()` (persists) — live-verified via a real
  `UserAppearance` Prisma write in the dev server log, not seed-code's local-only state mutation.
  Its workspace launcher links to `/terminal` and `/free` per the order's own explicit instruction,
  even though neither exists until Session 9-4 (immediately next) — a disclosed, one-session gap
  landing cleanly on the real `not-found.tsx`, not a broken link.
  **A real, pre-existing a11y gap found and fixed while restyling `reset-password/page.tsx`:** both
  password `<label>` elements (ported from seed-code's own markup) had no `htmlFor`/`id`
  association to their inputs at all — same defect class 9-2's `/docs` fix addressed. Fixed with
  proper `htmlFor`/`id` wiring, directly required by this order's own accessibility rule.
  **A genuine test regression found and fixed at Step 6, not just discovered and left:** adding
  `useLocale()` to `login-form.tsx`, `register-form.tsx`, and 5 of the 7 auth pages broke 4
  pre-existing suites (`login-form.test.tsx`, `register-form.test.tsx`, `auth-verify-2fa.test.tsx`,
  `auth-bridge-endpoint-swaps.test.tsx` — 21 tests) on the identical `useLocale must be used within
a LocaleProvider` error — `LESSONS-LEARNED.md` L40's exact failure class, now recurring a 3rd
  time (9-1, 9-2, 9-3; L40 amended with a recurrence note, not a new entry — file is at its
  40-entry cap). Fixed forward, not reverted: wrapped every render in a real `LocaleProvider`,
  pre-seeded `localStorage` with `defaultPreferences` so `LocaleProvider`'s own geo-IP `fetch()`
  never fires (safer than L40's reject-mock recipe for files whose own tests assert exact
  `global.fetch` call counts/args), and added the sibling `usePathname: () => '/'` stub
  `LocaleProvider` itself needs. Two assertions genuinely needed updating to match this session's
  own intentional design changes, not reverting: `reset-password`'s submit button reads "Update
  Password" now (was "Reset Password" pre-session), and its query switched from
  `getByPlaceholderText` to the more robust `getByLabelText` now that the a11y fix above gives it a
  real accessible label.
  **Waiting-on #117 (test credentials) confirmed de facto resolved, not still-open as the
  PRE-DRAFT's own entry criterion implied:** `components/auth/login-form.tsx` already ships real
  quick-fill buttons wired to seeded accounts (`app/api/test/seed/route.ts`), and Session 9-1's own
  CONFIRM already used them live. Never formally closed in `DECISION-LOG.md`'s own register —
  flagged as a housekeeping gap for Davin, not a blocker this session hit.
  **Live-verified via dev server, not just `tsc`/`test:ci`:** a real PRO test-user login → real
  `/dashboard` render with genuine Prisma-backed alert/appearance data; the full `/welcome` 3-step
  flow including a real accent-persist round trip; `/register`, `/forgot-password`, `/verify-2fa`
  (no-token state), `/verify-email` (missing-token state), and `/verify-email/pending` all smoke-
  tested for single-header (no double-chrome) rendering and zero new console errors; `/terminal`
  confirmed to 404 cleanly via the real `not-found.tsx`.
  **All test baselines re-verified live, all green, exact match to entry-criterion baseline:**
  monolith `tsc` clean, `eslint` 0 errors/0 warnings in touched files (5 pre-existing warnings
  elsewhere, unchanged), `test:ci` 160/160 suites/2400/2400 tests (re-run twice — once mid-session
  after the regression fix, once at close); money-service 62/62 suites/526/526 tests; operation-
  service 42/42 suites/393/393 tests, both confirmed at CONFIRM, untouched this session.
  **Route-manifest diff clean:** exactly the 8 rows' own page files + 1 layout.tsx + 3 non-route
  component dependencies + 4 test files fixed for the regression above — zero pages created or
  dropped outside scope; `app/(auth)/welcome/` is the only new route.
  **Artifacts updated:** `9-3-auth-pages.migration-order.md` (Status → CONFIRMED → CLOSED
  SUCCESSFUL, CONFIRM note + 11 Deviations + checked Done-when/entry-criteria boxes),
  `LESSONS-LEARNED.md` (L40 recurrence note — 3rd occurrence, repo-wide `jest.setup.js` default now
  flagged as owed but not added, out of this session's own scope), this file (Current/Previous
  rotation — Session 9-1 moved to `history/sessions-archive.md`), `migration-stack-analysis.md`
  (Session 9-3 entry, 1 new file/16 modified, all FRONTEND). `migration-cutover-table.md`
  correctly needs no changes (Phase 9 is additive builds, no route/slice moved).

## Key documents

| What                                 | Where                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| **Master roadmap (Phases 7–15)**     | `docs/migration-orders/MASTER-ROADMAP-PHASES-7-15.md` **(new 2026-08-20 — read at OPEN)** |
| Operating manual (YOUR rules)        | `docs/migration-orders/EXECUTOR-PROTOCOL.md`                                              |
| Migration plan (phases, flags)       | `docs/migration-orders/monolith-to-microservices-migration-implementation-plan.md` (v1.3) |
| Session playbook                     | `docs/migration-orders/monolith-to-microservices-migration-session-playbook.md`           |
| Order rules + templates              | `docs/migration-orders/00-SKELETON-AND-RULES.md` + `TEMPLATE-*.md`                        |
| Decision Log                         | `docs/migration-orders/DECISION-LOG.md`                                                   |
| Lessons learned (read at every OPEN) | `docs/migration-orders/LESSONS-LEARNED.md`                                                |
| Cutover table                        | `docs/migration-orders/migration-cutover-table.md`                                        |
| File inventory                       | `docs/migration-orders/migration-stack-analysis.md`                                       |

## Non-negotiables (short form — manual has details)

1. **Never execute an order that is not CONFIRMED.** Lifecycle: PRE-DRAFT → DRAFT →
   APPROVED (Davin) → CONFIRMED (you, after re-verifying code AND runtime state).
2. **One session = one verifiable unit of work.** Never end mid-cutover or half-deployed.
   Blocked? Document the blocker and stop — don't push into a broken state.
3. **Artifacts are the only channel.** Your session transcript dies with the session; the
   Deviations section, CLAUDE.md, Decision Log, cutover table, and file inventory are how
   the Advisor and Davin know what happened. Empty Deviations = starved next plan.
4. **Scope discipline.** No drive-by fixes to change-frozen (CC-F) or out-of-scope code.
   `lib/api/index.ts` is known-broken BY DESIGN — do not fix until Phase 7.
   _(2026-08-20: Phase 7 is CLOSED — `lib/api/index.ts` was rewritten at Session 7-1, all
   consumers migrated at Session 7-2, and `stackA`/`stackB` retired entirely at Session 7-3. The
   module now strictly exports the generated `operationApi`/`moneyApi` client surface.)_
5. **Money and auth changes escalate.** Anything touching payments, grants, secrets, CORS,
   or auth semantics beyond the order's explicit steps → stop and ask Davin.
6. **Verification is never skipped, only strengthened.**
7. **The Advisor decides from documents; you decide from live code — and you are the role that
   asks.** (Binding from 2026-08-11; full rule `00-SKELETON-AND-RULES.md` §1.0,
   `EXECUTOR-PROTOCOL.md` §0; recorded as `DECISION-LOG.md` **PD1**.) Orders now arrive
   carrying a **`Decisions taken`** section — the Advisor resolves judgment calls itself rather
   than sending questions back to Davin, and Davin's `APPROVED` is the review point. Read that
   section first at CONFIRM. **Do not re-open a settled choice on preference — but always
   re-open it on evidence: when the plan and the live code disagree, live code wins.** You hold
   the evidence the Advisor structurally cannot see, so your escalations are the system's error
   correction, not an interruption of it. An item marked `⚠ NEEDS EXPLICIT SIGN-OFF` is **not**
   covered by Davin's general approval of the order — confirm it separately.

## Security Override Policy (retained from legacy guide — still binding)

Do **NOT** modify `overrides`/`pnpm.overrides` in `package.json` on feature branches, even
if `pnpm audit` complains. Security overrides are managed centrally on `main` via dedicated
PRs (`check-overrides.yml` enforces this; 7+ documented merge-conflict incidents caused the
rule — see `errors/continuous-pr-errors/`).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
