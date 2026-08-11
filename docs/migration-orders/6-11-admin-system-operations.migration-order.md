# Migration Order — Session 6-11 — Admin System Operations

> For a session that **closes the 4 ADMIN-SYSTEM-OPERATIONS gap-matrix rows** assigned to it
> (B2-14, B2-15, B2-16, B2-17) — builds `/admin/system/terminals`, `/admin/system/jobs`,
> `/admin/system/outbox`, and `/admin/system/config-history` under the consolidated admin
> tree (F62, Session 6-2) and wires them into `app/(dashboard)/admin/layout.tsx`. Adapted from
> `TEMPLATE-UI-BUILD.md`, dial **HIGH for system operations visual polish and layout**.

**Session:** 6-11 · **Phase:** Phase 6 (Frontend Redesign) · **Variant:** UI-BUILD · **Status:** CONFIRMED · **Generated:** 2026-08-10 ·
**Flags touched:** none · **Estimated time:** ~4-5h
**Surface:** `app/(dashboard)/admin/system/terminals/page.tsx` (new), `app/(dashboard)/admin/system/jobs/page.tsx` (new), `app/(dashboard)/admin/system/outbox/page.tsx` (new), `app/(dashboard)/admin/system/config-history/page.tsx` (new), [`app/(dashboard)/admin/layout.tsx`](<file:///d:/SaaS%20Project/trading-alerts-saas-public/app/(dashboard)/admin/layout.tsx>) (admin nav entries) ·
**Feeds on:** `flask-api` health/terminals endpoints (or graceful offline fallback), `/api/cron/*` endpoints, `OutboxEvent` Prisma model, `SystemConfigHistory` Prisma model, `phase-6-frontend-gap-matrix.md` rows B2-14..17.

---

## Context

Four rows from `phase-6-frontend-gap-matrix.md`, independently re-verified:

- **B2-14 (`/admin/system/terminals`):** Terminals and `flask-api` monitoring. Performs a live reachability check against `flask-api`; if online, displays active terminals and telemetry; if offline (Waiting-on #101), renders an honest "Service Offline / Attempting Reconnection" status alert card rather than throwing unhandled errors or fabricating metrics.
- **B2-15 (`/admin/system/jobs`):** Cron and scheduled jobs manager (`/api/cron/*`). Lists all scheduled jobs (outbox publisher, alert cleaner, subscription checker, affiliate payout batching), displaying last run timestamp, execution status, and manual "Run Now" trigger buttons.
- **B2-16 (`/admin/system/outbox`):** Outbox event queue monitor (`OutboxEvent` Prisma model). Displays event counts by status (`PENDING`, `PROCESSED`, `FAILED`), failure logs, and manual retry controls.
- **B2-17 (`/admin/system/config-history`):** System configuration audit log (`SystemConfigHistory` Prisma model). Displays audit log entries (timestamp, modified by, config key, old/new values) with an honest empty state if no edits exist.
- **Admin Nav Integration:** Integrates all 4 new pages into `adminNavItems` in `app/(dashboard)/admin/layout.tsx`.

## User Review Required

> [!IMPORTANT]
> **`flask-api` Offline Fallback (B2-14):** `/admin/system/terminals` checks `flask-api` reachability dynamically. If `flask-api` is offline, the page renders an honest "Service Unavailable — Attempting Reconnection" alert card. Fabricating fake "operational" data is strictly forbidden.

> [!NOTE]
> **Admin Navigation Integration:** All 4 new system operations routes (`/admin/system/*`) are added to `adminNavItems` in `app/(dashboard)/admin/layout.tsx` so they are accessible from the sidebar.

## Entry criteria

- [x] Session 6-10 CONFIRMED, executed, closed (2026-08-11 — see `CLAUDE.md` Current entry).
- [x] All 4 rows (B2-14..17) re-verified live at CONFIRM — B2-16 held exactly; B2-14/17 held at
      the existence level; **B2-15 was found materially wrong** (its own "outbox
      publisher/alert cleaner/subscription checker/affiliate batching" job list and "last run"
      framing don't match reality — see Deviation 1) and re-scoped with Davin's live direction
      before Step 2 was built.
- [x] `flask-api` reachability & offline alert handling resolved — dynamic check + honest
      `not_configured`/`restricted`/`offline`/`degraded`/`online` discriminant (Step 1); real
      flask-api live status not independently re-verified this session (last known OFFLINE at
      Session 4B-18d, 2026-08-03 — Waiting-on #101, unchanged, the honest-fallback design handles
      either state).
- [x] Admin navigation integration defined in `app/(dashboard)/admin/layout.tsx` — confirmed live,
      `adminNavItems` array, 8 pre-existing entries; 4 new entries added Step 4.
- [x] Monolith baseline re-measured at CONFIRM — exact match: `tsc --noEmit` clean;
      `eslint app components lib hooks --max-warnings 0` → 4 pre-existing warnings, 0 errors;
      `test:ci` 146/146 suites, 2291/2291 tests.
- [x] Davin APPROVED live in chat, 2026-08-11 — the PRE-DRAFT→APPROVED rewrite (no DRAFT-stage
      commit trail, the recurring `LESSONS-LEARNED.md` L11 pattern) confirmed as his own
      authentic authorization before execution.

## Integration points

- **In:** `flask-api` health/terminals endpoints, `/api/cron/*` endpoints, `OutboxEvent` Prisma model, `SystemConfigHistory` Prisma model.
- **Out:** No backend service changes.
- **Owns:** 4 new page files under `app/(dashboard)/admin/system/*` and `app/(dashboard)/admin/layout.tsx`.

## Ordered steps

### Step 1 — Build Terminals & Flask API Monitor Page (`/admin/system/terminals`) (B2-14)

- Create `app/(dashboard)/admin/system/terminals/page.tsx`:
  - Perform live reachability check against `flask-api`.
  - If connected, render active terminal sessions and telemetry metrics.
  - If offline, render a clean "Service Unavailable / Attempting Reconnection" status alert card.
- _Verify:_ Page renders live telemetry when online, or "Service Unavailable" alert card when `flask-api` is offline without unhandled exceptions.
- _Commit:_ `feat(6-11): build /admin/system/terminals page with live flask-api reachability check`

### Step 2 — Build Scheduled Jobs & Cron Manager Page (`/admin/system/jobs`) (B2-15)

- Create `app/(dashboard)/admin/system/jobs/page.tsx`:
  - List `/api/cron/*` scheduled jobs (outbox publisher, alert cleaner, subscription checker, affiliate batching).
  - Display last run timestamp, execution status badges, and manual "Run Now" trigger buttons calling `/api/cron/*`.
- _Verify:_ Jobs list compiles, renders status badges, and manual trigger button calls target cron API.
- _Commit:_ `feat(6-11): build /admin/system/jobs page with cron execution monitoring`

### Step 3 — Build Outbox Event Queue Monitor Page (`/admin/system/outbox`) (B2-16)

- Create `app/(dashboard)/admin/system/outbox/page.tsx` (server component querying `OutboxEvent`):
  - Render event counts grouped by status (`PENDING`, `PROCESSED`, `FAILED`).
  - Display recent failure logs table and "Retry Failed Events" action.
- _Verify:_ Outbox page compiles, displays event queue metrics, and renders failure logs.
- _Commit:_ `feat(6-11): build /admin/system/outbox page for OutboxEvent queue monitoring`

### Step 4 — Build Config Audit History Page & Wire Admin Navigation (`/admin/system/config-history`) (B2-17)

- Create `app/(dashboard)/admin/system/config-history/page.tsx` (server component querying `SystemConfigHistory` with honest empty state).
- Update [`app/(dashboard)/admin/layout.tsx`](<file:///d:/SaaS%20Project/trading-alerts-saas-public/app/(dashboard)/admin/layout.tsx>) to add System Operations navigation items to `adminNavItems`.
- _Verify:_ Config history page renders audit log or honest empty state; all 4 system ops pages are reachable from admin nav sidebar.
- _Commit:_ `feat(6-11): build /admin/system/config-history page and wire system ops into admin nav`

### Step 5 — Unit Tests for Admin System Operations Pages

- Create `__tests__/pages/admin/system-operations.test.tsx` covering:
  - Terminals page offline fallback alert.
  - Scheduled jobs listing and manual trigger.
  - Outbox event queue metrics and status badges.
  - Config history page rendering and empty state.
- _Verify:_ `test:ci` runs clean with all new and existing tests passing.
- _Commit:_ `test(6-11): add unit tests for admin system operations pages`

## Rules specific to this variant

- **UI Creativity (Dial HIGH):** High visual polish on system metrics, status badges, queue counters, and log tables.
- **Data Discipline (Dial LOW):** Real backend state only — no fabricated "operational" metrics.
- **Admin Nav Integration:** All 4 pages reachable from sidebar nav.
- **A11y Standards:** ARIA labels, semantic headings, and clean focus states.

## Done when

- [x] `/admin/system/terminals` live with `flask-api` reachability & offline alert card
      (`not_configured`/`restricted`/`offline`/`degraded`/`online`, per Davin's #4 direction).
- [x] `/admin/system/jobs` live — lists money-service's real 8 scheduled jobs (not the monolith's
      unscheduled duplicates) with an honest "Managed by Money-Service Scheduler" badge, no
      fabricated run-history timestamps, and confirmation-gated Run Now buttons forwarding to
      money-service's real `CronTriggerController`, per Davin's #2 direction.
- [x] `/admin/system/outbox` live displaying real `OutboxEvent` queue counts by status, recent
      FAILED rows, and a Retry action that resets FAILED→PENDING with a fresh attempt budget.
- [x] `/admin/system/config-history` live displaying real `SystemConfigHistory` rows or an honest
      empty state (table has zero writers anywhere in the codebase today).
- [x] All 4 pages wired into `adminNavItems` in `app/(dashboard)/admin/layout.tsx`; the
      hardcoded, always-green "All systems operational" sidebar claim replaced with a plain link
      to the real terminals check, per Davin's #3 direction.
- [x] `tsc --noEmit` clean; `eslint app components lib hooks --max-warnings 0` → same 4
      pre-existing warnings, 0 new; `test:ci` 148/148 suites, 2312/2312 tests (was 146/146,
      2291/2291 — +2 suites/+21 tests, exactly this session's own new files, zero regressions
      elsewhere).

## Rollback

Same-stack UI work; rollback is `git revert`.

## Retire

N/A.

## Deviations

1. **B2-15's own job list and "last run" framing were factually wrong, found at CONFIRM before
   writing any code.** `vercel.json`'s `crons` array has been empty since Session 4A-3 —
   `migration-cutover-table.md`'s Slice 1 row confirms "money-service's own scheduler is now the
   sole live execution path." The 8 monolith `app/api/cron/*` routes still compile and still
   contain live business logic, but are no longer scheduled by anything — a monitoring page built
   against them (as the order's own Step 2 text literally described) would show stale/dead-path
   status, not what actually runs in production. "Outbox publisher" and "alert cleaner" (named in
   the order's job list) don't correspond to any of the 8 real files at all. Separately, neither
   the monolith nor money-service persists any cron run-history anywhere — "last run timestamp"
   as literally promised had no real data source, and the order's own "Out: No backend service
   changes" ruled out adding one. Reported in full at CONFIRM; Davin's live resolution (his #2):
   display the 8 real jobs with an honest "Managed by Money-Service Scheduler / Real-Time
   Scheduled" status and no fabricated timestamps; wire Run Now to trigger the real jobs. Built
   Run Now against money-service's own `CronTriggerController` (`POST /v1/cron-trigger/<id>`, the
   real production execution surface, mirrors the "manual trigger" mechanism that controller's own
   header comment says it exists for) rather than the monolith's now-dead duplicates — reusing the
   `CRON_SECRET` value both services' guards are designed to share (money-service's own
   `cron-secret.guard.ts` header comment: "mirrors the CRON_SECRET protection every source route
   had"). Each trigger's result is rendered ephemerally (this-session-only), never persisted,
   consistent with "no fabricated run-history."
2. **The admin layout's own hardcoded "All systems operational" claim, found while reading the
   file this session was already about to edit for nav wiring.** `app/(dashboard)/admin/layout.tsx`
   (pre-existing, lines 143-152) unconditionally rendered a green pulsing dot and "All systems
   operational" — directly contradicting this same session's own Data Discipline rule on the
   pages built right next to it. Flagged and confirmed in scope (Davin's #3): replaced with a
   plain link to the real `/admin/system/terminals` check rather than adding a second live status
   computation to every admin page's own render path (would add network/DB latency to every admin
   page load for a claim the sidebar itself doesn't need to make).
3. **`/admin/system/terminals`'s admin-key handling, scoped explicitly by Davin (his #4) before
   Step 1 was written.** `MT5_ADMIN_API_KEY` is documented (`docs/secret-matrix.md`) as
   `.env.example`-only, absent from live `.env`/`.env.local` — so the route checks for its
   presence server-side FIRST and returns an honest `not_configured` state without ever calling
   flask-api, distinct from a `restricted` state (key present, rejected with 401/403) and an
   `offline` state (network-unreachable). All three render as informative, non-alarming cards, not
   generic error boundaries.
4. **Base URL env var chosen deliberately, not guessed.** `docs/secret-matrix.md` documents 3
   competing names for the same concept (`MT5_SERVICE_URL`, `MT5_API_URL`, `FLASK_MT5_URL`) as
   known drift. Used `MT5_SERVICE_URL` — the one actually present in live `.env`/`.env.local` per
   that same doc, and the one `lib/monitoring/system-monitor.ts` (an orphaned but real,
   zero-importer precursor to this session's own check) already established as the live
   convention.
5. **Beyond the order's own Step 5 scope, added a second test file** (`__tests__/api/
admin-system-operations.test.tsx`, 10 tests) covering the 3 new API routes directly (auth
   gating, the flask-api discriminant branches, the money-service trigger forward with the real
   `Authorization: Bearer <CRON_SECRET>` header, the outbox bulk reset) — closes a real
   test-coverage gap on freshly-written server-side code, matching this migration's established
   L28-class precedent, not required by the order's own literal text.

## Known wrinkles / do-not-touch

- `lib/api/index.ts` stays untouched (`EXECUTOR-PROTOCOL.md` §5).
- `frontend/` mirror tree is out of scope (`EXECUTOR-PROTOCOL.md` §5).
- RiseWorks stays archived (F42).
- `DECISION-LOG.md` **F49** (dLocal `payment_method_flow`), **F60** (Stripe webhook cutover), and **F64** (subscription-card Undo flow) stay open, non-blocking.

## Next-session handoff

Session **6-12** (a11y + responsive + Phase 6 exit review — final session before Phase 6 closes!) is next in Phase 6.
