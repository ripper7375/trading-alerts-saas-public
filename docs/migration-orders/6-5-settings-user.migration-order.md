# Migration Order — Session 6-5 — Settings / User

> For a session that **builds the missing account-deletion confirm/cancel pages** — the real
> `POST /api/user/account/deletion-request|confirm|cancel` routes already exist and are live
> (Session 4B-11 PORT — `UsersController`/`shouldUseOperationServiceForUserProfile()`), but no
> page anywhere in the tree exists for a user to land on after clicking the confirm or cancel link
> in their deletion email (`find app -iname '*delet*' -name 'page.tsx'` returns nothing).
> Adapted from `TEMPLATE-UI-BUILD.md`, dial **High for the confirm/cancel flow UX, Low for data**.

**Session:** 6-5 · **Phase:** Phase 6 (Frontend Redesign) · **Variant:** UI-BUILD (dial HIGH for confirm/cancel flow UX, LOW for data) · **Status:** CONFIRMED · **Generated:** 2026-08-10 ·
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

- [ ] Session 6-4 CONFIRMED, executed, closed (2026-08-10 — see `CLAUDE.md` Current entry).
- [ ] All 3 `app/api/user/account/deletion-*` routes re-verified live at CONFIRM.
- [ ] `app/(dashboard)/settings/account/page.tsx` verified (deletion request trigger exists; session-based cancel banner scope defined).
- [ ] Monolith baseline re-measured at CONFIRM (`tsc --noEmit`, `eslint app components lib hooks --max-warnings 0`, `test:ci` — last known at 6-4's close: 134/134 suites, 2217/2217 tests, 3 pre-existing lint warnings).
- [ ] Advisor DRAFT review + Davin APPROVED before CONFIRM.

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

- [ ] `/settings/account/delete/confirm` and `/settings/account/delete/cancel` routes exist and handle email token links.
- [ ] Human confirmation step enforced on confirm page before firing deletion endpoint.
- [ ] 7-day grace period copy standardized across deletion UI components.
- [ ] Pending deletion banner and session-based cancel button added to `settings/account/page.tsx`.
- [ ] `tsc --noEmit` clean; `eslint --max-warnings 0` introduces 0 new warnings; `test:ci` green.

## Rollback

Same-stack UI work; rollback is `git revert`.

## Retire

N/A.

## Deviations

_(filled during execution)_

## Known wrinkles / do-not-touch

- `lib/api/index.ts` stays untouched (`EXECUTOR-PROTOCOL.md` §5).
- `frontend/` mirror tree is out of scope (`EXECUTOR-PROTOCOL.md` §5).
- `DECISION-LOG.md` **F21** (GDPR deletion policy), **F50**, and **F64** stay open, non-blocking.

## Next-session handoff

Session **6-6** (Admin — WISE provider option, RiseWorks disposition, per-code cancel, user detail) is next in Phase 6.
