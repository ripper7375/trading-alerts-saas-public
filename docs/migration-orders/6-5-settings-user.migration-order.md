# Migration Order — Session 6-5 — Settings / User

> For a session that **builds the missing account-deletion confirm/cancel pages** — the real
> `POST /api/user/account/deletion-request|confirm|cancel` routes already exist and are live
> (Session 4B-11 PORT — `UsersController`/`shouldUseOperationServiceForUserProfile()`), but no
> page anywhere in the tree exists for a user to land on after clicking the confirm or cancel link
> in their deletion email (`find app -iname '*delet*' -name 'page.tsx'` returns nothing).
> Adapted from `TEMPLATE-UI-BUILD.md`, dial **High for the confirm/cancel flow UX, Low for data**.

**Session:** 6-5 · **Phase:** Phase 6 (Frontend Redesign) · **Variant:** UI-BUILD (dial HIGH for confirm/cancel flow UX, LOW for data) · **Status:** CONFIRMED, executed, CLOSED SUCCESSFUL 2026-08-11 · **Generated:** 2026-08-10 ·
**Flags touched:** none · **Estimated time:** ~3-4h
**Surface:** `app/(dashboard)/settings/account/delete/confirm/page.tsx` (new), `app/(dashboard)/settings/account/delete/cancel/page.tsx` (new), [`app/(dashboard)/settings/account/page.tsx`](<file:///d:/SaaS%20Project/trading-alerts-saas-public/app/(dashboard)/settings/account/page.tsx>) (pending deletion banner & 2FA verification) ·
**Feeds on:** `POST /api/user/account/deletion-request`, `POST /api/user/account/deletion-confirm`, `POST /api/user/account/deletion-cancel`, `/api/user/2fa/*`.

---

## Context

- **The Gap:** All 3 account-deletion API routes exist and are live (`deletion-request`, 123 lines; `deletion-confirm`, 153 lines; `deletion-cancel`, 157 lines — all under `app/api/user/account/`) — but zero pages exist anywhere for a user to land on after clicking the confirm or cancel link in a deletion email.
- **Contract Requirement:** `deletion-confirm` accepts a `POST` request with `{ token }` in the body. Landing on `?token=...` must extract the token from search parameters and fire the `POST` from the client after user interaction.
- **Empirical Code Base Check (`settings/account/page.tsx`):** Direct codebase inspection confirms `app/(dashboard)/settings/account/page.tsx` (lines 315–350) **already has** a working deletion-request trigger (`POST /api/user/account/deletion-request`) inside its Danger Zone dialog. However, it currently lacks a session-based pending-deletion status banner and cancel action.
- **Grace Window Copy Realignment:** `deletion-confirm/route.ts` comments mention 24 hours, but `DECISION-LOG.md` **F21** and `AccountDeletionRequest.expiresAt` define the actual grace period as **7 days**. All UI copy must state 7 days.

## User Review Required

> [!IMPORTANT]
> **Human-in-the-Loop Confirmation Step:** The confirmation landing page (`app/(dashboard)/settings/account/delete/confirm/page.tsx`) MUST require an explicit user action (clicking "Confirm Account Deletion") before firing `POST /api/user/account/deletion-confirm`. Hitting `deletion-confirm` automatically on page load is forbidden to prevent email preview prefetchers or security scanners from deleting accounts.

> [!IMPORTANT]
> **7-Day Grace Period Copy:** All deletion UI copy (confirm page, cancel page, account settings banner) must explicitly state the **7-day grace window** (`AccountDeletionRequest.expiresAt`), overriding stale 24-hour route comments.

> [!NOTE]
> **Session-Based Cancellation Banner:** `deletion-cancel` supports cancellation via token OR logged-in session. Step 3 adds a "Pending Deletion" alert banner to `app/(dashboard)/settings/account/page.tsx` with a session-based "Cancel Deletion Request" button.

## Entry criteria

- [x] Session 6-4 CONFIRMED, executed, closed (2026-08-10 — see `CLAUDE.md` Current entry).
- [x] All 3 `app/api/user/account/deletion-*` routes re-verified live at CONFIRM — line counts
      corrected (152/123/156, not the order's cited 153/123/157, a +1 citation drift on 2 of the
      3 files, non-blocking).
- [x] `app/(dashboard)/settings/account/page.tsx` verified — deletion-request trigger confirmed at
      lines 315-350; the order's own related 2FA claim about this file did NOT hold (Deviation 2b).
- [x] Monolith baseline re-measured at CONFIRM: `tsc --noEmit` clean, `eslint --max-warnings 0` 3
      pre-existing warnings/0 new, `test:ci` 134/134 suites, 2217/2217 tests — exact match.
- [x] Order's own PRE-DRAFT→APPROVED provenance (no DRAFT-stage commit trail) confirmed live by
      Davin as his own authentic authorization (Deviation 1, L11 recurrence).

## Integration points

- **In:** `POST /api/user/account/deletion-confirm`, `POST /api/user/account/deletion-cancel`, `POST /api/user/account/deletion-request`, `/api/user/2fa/*`.
- **Out:** No backend service changes.
- **Owns:** `app/(dashboard)/settings/account/delete/confirm/page.tsx`, `app/(dashboard)/settings/account/delete/cancel/page.tsx`, `app/(dashboard)/settings/account/page.tsx` pending-deletion banner.

## Ordered steps

### Step 1 — Build Account Deletion Confirmation Page (`/settings/account/delete/confirm`)

- Create `app/(dashboard)/settings/account/delete/confirm/page.tsx` & client component:
  - Read `?token=` from search parameters. If missing or invalid, display an error card ("Invalid or Missing Token").
  - Render an interactive confirmation card explaining that account deletion will occur after 7 days.
  - Require an explicit user click on "Confirm Account Deletion" before executing `POST /api/user/account/deletion-confirm` with `{ token }`.
  - On success, render a success confirmation card ("Account Scheduled for Deletion — You have 7 days to cancel").
- _Verify:_ Missing token renders error card; clicking confirm button fires `POST /api/user/account/deletion-confirm` and displays 7-day grace window message.
- _Commit:_ `feat(6-5): build /settings/account/delete/confirm page with human-in-the-loop gate`

### Step 2 — Build Account Deletion Cancellation Page (`/settings/account/delete/cancel`)

- Create `app/(dashboard)/settings/account/delete/cancel/page.tsx` & client component:
  - Read `?token=` from search parameters (optional for session fallback).
  - Execute `POST /api/user/account/deletion-cancel` with `{ token }`.
  - Display success confirmation card ("Account Deletion Cancelled — Your account remains active").
- _Verify:_ Navigating to cancel page with valid token executes cancellation and renders confirmation.
- _Commit:_ `feat(6-5): build /settings/account/delete/cancel page for email token link`

### Step 3 — Add Pending Deletion Banner & Session Cancel to Account Settings

- Update [`app/(dashboard)/settings/account/page.tsx`](<file:///d:/SaaS%20Project/trading-alerts-saas-public/app/(dashboard)/settings/account/page.tsx>):
  - Check user deletion status on load.
  - If a deletion request is pending, render a prominent warning banner at top of page ("Account Deletion Pending — Scheduled for deletion in N days").
  - Provide a "Cancel Deletion Request" button firing `POST /api/user/account/deletion-cancel` (session-based).
- _Verify:_ Logged-in user with active deletion request sees pending deletion banner and can cancel request directly from account settings.
- _Commit:_ `feat(6-5): add pending deletion status banner and cancel button to account settings`

### Step 4 — Re-verify 2FA Flow & Build Unit Tests

- Re-verify 2FA toggle, setup modal, and disable flows on `settings/account/page.tsx` against live `/api/user/2fa/*` endpoints.
- Create `__tests__/pages/settings/account-deletion.test.tsx` covering confirm page, cancel page, missing token handling, and valid submit flow.
- _Verify:_ `test:ci` runs clean with all new and existing tests passing.
- _Commit:_ `test(6-5): add unit tests for account deletion confirm/cancel pages and 2FA flow`

## Rules specific to this variant

- **UI Creativity (Dial HIGH):** Full freedom on landing page design, warning cards, countdown displays, success/error banners, and button states.
- **Data Contract (Dial LOW):** Payloads for `deletion-confirm` and `deletion-cancel` must strictly match API route schemas.
- **7-Day Grace Window:** All copy must accurately reference the 7-day grace window.
- **A11y Standards:** Semantic HTML, focus management, and screen reader announcements for confirmation states.

## Done when

- [x] `/settings/account/delete/confirm` and `/settings/account/delete/cancel` routes exist and
      handle email token links (live-verified unauthenticated, 200 OK, correct content — see
      Deviation 4).
- [x] Human confirmation step enforced on confirm page before firing deletion endpoint (never
      auto-fires; unit-tested).
- [x] Grace-period copy standardized and _correct_ per Deviation 2 — 7-day link-expiry on
      pre-confirm/pending-banner copy, 24-hour execution window on post-confirm/CONFIRMED-banner
      copy, both noting cancellation is still possible.
- [x] Pending deletion banner and session-based cancel button added to `settings/account/page.tsx`
      (via the server/client restructure, Deviation 6).
- [x] `tsc --noEmit` clean; `eslint app components lib hooks --max-warnings 0` — same 3
      pre-existing warnings tracked since Session 6-1, 0 new; `test:ci` **136/136 suites,
      2230/2230 tests** (was 134/134, 2217/2217 at 6-4's close — +2 suites/+13 tests, exactly this
      session's own new files, zero regressions elsewhere).

## Rollback

Same-stack UI work; rollback is `git revert`.

## Retire

N/A.

## Deviations

1. **L11 recurrence (12th+):** the order arrived modified-but-uncommitted, `PRE-DRAFT →
APPROVED`, with 4 concrete Ordered Steps and the human-in-the-loop question resolved, no
   DRAFT-stage commit trail against the committed PRE-DRAFT (`9990d63c`). Reported in full at
   CONFIRM; Davin confirmed live it was his own authentic authorization before execution began.
2. **Two real content bugs found in the order's own Context/Step-1 text, both resolved by Davin
   live before writing code:** (a) the order's "All UI copy must state 7 days" instruction
   conflated two genuinely different, both-live deadlines — `AccountDeletionRequest.expiresAt`
   (7 days, the token/link-expiry window between REQUEST and CONFIRM) and
   `deletion-confirm/route.ts`'s own live response (`scheduledDeletionTime = now + 24h`, the
   window between CONFIRM and actual execution) — `DECISION-LOG.md` F21's own register title
   ("24h Account-Deletion GDPR gap") directly contradicted the order's claim that F21 "defines
   the actual grace period as 7 days." Resolved: pre-confirmation/pending-banner copy states the
   7-day link deadline; the post-confirmation success state and the CONFIRMED banner state both
   state the real 24-hour execution window, noting cancellation is still possible during it. (b)
   Step 4's "re-verify 2FA toggle, setup modal, and disable flows on `settings/account/page.tsx`"
   assumed a real integration existed there to re-verify — `handleTwoFactorToggle` was a bare
   `useState` flip with zero calls to any `/api/user/2fa/*` endpoint, its own comment reading "In
   a real implementation, this would open a 2FA setup flow." The real, fully-wired implementation
   (setup/verify-setup/disable/backup-codes, all live, gap-matrix row A1-9) already exists at
   `settings/security/page.tsx`. Resolved (Davin, option a): replaced the dummy widget with a
   "Manage 2FA" link to that page; Step 4's actual re-verification target became
   `settings/security/page.tsx` (confirmed correct by direct code read, unmodified this session —
   deep interactive click-through blocked by the same standing no-test-credentials gap as every
   Phase 6 session since 6-1b, Waiting-on #117).
3. **A real invariant conflict found before Step 1 could be built, resolved via `AskUserQuestion`
   before any code was written:** `middleware.ts`'s `/settings/:path*` matcher would hard-redirect
   any logged-out visitor away from the new pages before they ever rendered — directly breaking
   the deliberately-unauthenticated/optional-auth email-link flow both routes are built for.
   Presented 3 options; Davin chose an exact-pathname allow-list in `middleware.ts` (not a broader
   prefix carve-out, not relocating the URL outside `/settings`).
4. **A second, deeper layer of the same invariant conflict, found only by live browser
   verification (per the standing UI-change verification rule) after Steps 1-2 were built and
   committed:** `app/(dashboard)/layout.tsx` performs its own server-side
   `getServerSession()`+`redirect` on every page it wraps, entirely independent of
   `middleware.ts` — the middleware allow-list alone was not sufficient, since the new page files
   physically lived inside that route group. A logged-out visitor still landed on `/login`.
   Fixed same-session (own addition, not a further Davin check-in — the direct, necessary
   technical consequence of the already-approved "keep these two exact URLs public" decision, not
   a new decision in its own right): relocated both pages to a new `app/(public)/` route group
   (route groups are transparent to the URL, so `/settings/account/delete/{confirm,cancel}` are
   unchanged; no `layout.tsx` needed, since each page already renders its own full-screen
   container). `middleware.ts`'s allow-list is unaffected and still the necessary edge-level half.
   Confirmed live, unauthenticated: both new pages 200 OK with correct content;
   `/settings/account` and `/settings/security` both still correctly redirect to
   `/login?callbackUrl=...`, unaffected. Harvested as `LESSONS-LEARNED.md` **L60**.
5. **Own addition beyond the order's literal file list, found reading `deletion-request/route.ts`
   in full:** its `confirmationUrl`/`cancelUrl` construction pointed at `/account/confirm-deletion`
   and `/account/cancel-deletion` — neither this session's real page paths nor any path that ever
   existed. Currently dormant (email sending is still a `// TODO` — `console.log` only, both on
   the monolith and on `operation-service`'s identical ported mirror in `users.service.ts`), so
   zero live behavior change today, but would have 404'd every deletion email once sending is
   wired up. Fixed the monolith route's two URL strings only (zero request/response contract
   change); left `operation-service`'s own mirror untouched (a genuine backend-service file, out
   of this UI-BUILD session's stated "no backend service changes" scope) — flagged below.
6. **Step 3's own literal text ("check user deletion status on load") assumed a mechanism that
   doesn't exist:** none of the 3 real `deletion-*` routes exposes a side-effect-free status
   check — `deletion-request` itself CREATES a row when none exists, so it's unsafe to call just
   to "check." Restructured `settings/account/page.tsx` into a server component (`page.tsx`,
   direct `prisma.accountDeletionRequest.findFirst` read) + client component
   (`account-settings-client.tsx`), mirroring the `alerts/[id]/edit` precedent (Session 6-3)
   rather than adding a new API endpoint — a bigger refactor than the order's one-line
   description implied, but the only way to satisfy it without a backend change.
7. **Own addition, not in the order's text:** the "Delete Account" trigger button is now disabled
   (label changes to "Deletion Already Requested") whenever a deletion is already pending or
   confirmed — the backend already 400s a duplicate request, this just reflects that in the UI
   given the banner is already showing the same state.
8. **Test coverage split across 2 files, not the order's literal single-file citation:**
   `account-deletion.test.tsx` (the order's own named file, confirm/cancel pages) plus
   `account-settings-page.test.tsx` (new coverage for the server-component restructure and banner
   logic Deviation 6 required — no prior test existed for this page at all).

**Not fixed, flagged for a future session:** `operation-service/src/users/users.service.ts`'s own
`requestDeletion()` has the identical stale `/account/confirm-deletion` / `/account/cancel-deletion`
URL construction (Deviation 5) — out of scope for this UI-only session, but should be fixed
alongside whichever future session actually wires up real deletion-email sending (both `TODO`s,
monolith and operation-service, are still open).

## Known wrinkles / do-not-touch

- `lib/api/index.ts` stays untouched (`EXECUTOR-PROTOCOL.md` §5).
- `frontend/` mirror tree is out of scope (`EXECUTOR-PROTOCOL.md` §5).
- `DECISION-LOG.md` **F21** (GDPR deletion policy), **F50**, and **F64** stay open, non-blocking.

## Next-session handoff

Session **6-6** (Admin — WISE provider option, RiseWorks disposition, per-code cancel, user detail) is next in Phase 6.
