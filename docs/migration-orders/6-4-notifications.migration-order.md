# Migration Order — Session 6-4 — Notifications

> For a session that **builds the missing `/notifications` page** — the bell icon's own "View all"
> link ([`components/notifications/notification-bell.tsx:477`](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/notifications/notification-bell.tsx#L477)) has pointed at `/notifications`
> since Session 4B-9/4B-17, and it currently 404s. No cross-stack PORT, no flags, no new backend endpoints — all 5 real, live `GET`/`POST`/`DELETE` `/api/notifications/*` routes already exist (Session 4B-9, CUT-OVER & LIVE).
> Adapted from `TEMPLATE-UI-BUILD.md`, dial **High for list/filter/realtime UX, Low for data**.

**Session:** 6-4 · **Phase:** Phase 6 (Frontend Redesign) · **Variant:** UI-BUILD (dial HIGH for list/filter/realtime UX, LOW for data) · **Status:** CONFIRMED · **Generated:** 2026-08-10 ·
**Flags touched:** none · **Estimated time:** ~2-3h
**Surface:** `app/(dashboard)/notifications/page.tsx` (new), [`components/notifications/notification-list.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/notifications/notification-list.tsx) (mounted & verified) · **Feeds on:** `GET /api/notifications`, `POST /api/notifications` (mark-all-read), `GET`/`DELETE /api/notifications/[id]`, `POST /api/notifications/[id]/read`, Socket.IO realtime events (`notification`, `alert_fired`).

---

## Context

- **The Gap:** [`components/notifications/notification-bell.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/notifications/notification-bell.tsx) (503 lines) renders a dropdown preview (`fetch('/api/notifications?pageSize=10')`) with mark-read/mark-all-read/delete actions wired to the real API — but its "View all" link (line 477) points at `/notifications`, a route that has never existed.
- **Backend Ready:** All 5 notification routes (`GET`/`POST /api/notifications`, `GET`/`DELETE /api/notifications/[id]`, `POST /api/notifications/[id]/read`) shipped and cut over at Session 4B-9 (`MIGRATE_NOTIFICATIONS=true` in production). `GET /api/notifications` supports `status` (`all`/`unread`/`read`), `type` (`ALERT`/`SUBSCRIPTION`/`PAYMENT`/`SYSTEM`), and `page`/`pageSize` (default 20) query parameters.
- **Orphaned Component Resolution:** [`components/notifications/notification-list.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/notifications/notification-list.tsx) (668 lines) has been read in full. It is a battle-tested client component featuring status tabs (All/Unread/Read), type filtering, pagination (20/page), mark-read, mark-all-read, and delete actions with undo support. Mounting it directly in `app/(dashboard)/notifications/page.tsx` completes the page cleanly.

## User Review Required

> [!IMPORTANT]
> **No Tier Gating:** Notifications is a core platform capability available to ALL authenticated users regardless of tier (`app/api/notifications/route.ts` has no tier restrictions). No PRO upgrade gate is applied to `/notifications`.

> [!IMPORTANT]
> **Mounting Orphaned `NotificationList` Component:** [`components/notifications/notification-list.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/notifications/notification-list.tsx) is verified clean and well-typed. Mounting it in `app/(dashboard)/notifications/page.tsx` avoids reinventing 668 lines of UI code.

> [!NOTE]
> **Realtime Socket Alignment:** The page integrates with the live Socket.IO connection (Session 4B-17/4B-18) so incoming `notification` and `alert_fired` events refresh the unread counter and list.

## Entry criteria

- [x] Session 6-3 CONFIRMED, executed, closed (2026-08-10 — see `CLAUDE.md` Current entry; verified via committed `CLAUDE.md` at `6bd4236b`).
- [x] `notification-bell.tsx`'s `/notifications` link and the 5 backing API routes re-verified at CONFIRM: line 477 exact match; `route.ts` (232 lines, GET/POST), `[id]/route.ts` (213 lines, GET/DELETE), `[id]/read/route.ts` (165 lines, POST) all live; `status`/`type` query params confirmed.
- [x] `notification-list.tsx` verified clean and ready to mount — read in full at CONFIRM (668 lines), independently, not taken on the order's own assertion (see CLAUDE.md L11 note below).
- [x] Monolith baseline re-measured at CONFIRM: `tsc --noEmit` clean; `eslint --max-warnings 0` exactly 3 pre-existing warnings (0 new); `test:ci` **133/133 suites, 2209/2209 tests** — exact match to 6-3's close.
- [x] Advisor DRAFT review + Davin APPROVED before CONFIRM — order arrived at CONFIRM modified-but-uncommitted (`PRE-DRAFT → APPROVED`, no visible DRAFT-stage commit trail — `LESSONS-LEARNED.md` L11 recurrence). Reported to Davin in full before proceeding; Davin confirmed live, in chat, that the APPROVED status and the resolved `notification-list.tsx` orphan-component question are his own authentic authorization.

## Integration points

- **In:** `getServerSession()`, `GET`/`POST`/`DELETE /api/notifications/*`, Socket.IO realtime events.
- **Out:** No backend service changes.
- **Owns:** `app/(dashboard)/notifications/page.tsx`.

## Ordered steps

### Step 1 — Create `app/(dashboard)/notifications/page.tsx` & Mount `NotificationList`

- Create server component at `app/(dashboard)/notifications/page.tsx`:
  - Check session authentication; redirect unauthenticated callers to `/login`.
  - Mount [`NotificationList`](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/notifications/notification-list.tsx) as main page body.
- _Verify:_ Navigating to `/notifications` renders full notifications view with tabs (All, Unread, Read), type filters, and pagination.
- _Commit:_ `feat(6-4): create /notifications page mounting NotificationList component`

### Step 2 — Verify API Contract & Realtime Socket Integration

- Re-verify API contracts for status filtering (`all`/`unread`/`read`), type filtering (`ALERT`/`SUBSCRIPTION`/`PAYMENT`/`SYSTEM`), mark-read (`POST /api/notifications/[id]/read`), mark-all-read (`POST /api/notifications`), and delete (`DELETE /api/notifications/[id]`).
- Connect live socket listener for `notification` events to refresh unread badge and notification list.
- _Verify:_ Mark-read and delete actions update DB state and UI; incoming socket events trigger live list updates.
- _Commit:_ `feat(6-4): wire realtime socket updates and verify API actions on notifications page`

### Step 3 — Verify Bell Navigation Link

- Verify [`components/notifications/notification-bell.tsx:477`](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/notifications/notification-bell.tsx#L477) "View all notifications" link opens `/notifications` without 404 errors.
- _Verify:_ Bell dropdown "View all" opens `/notifications` page cleanly.
- _Commit:_ `fix(6-4): verify notification bell dropdown navigation to /notifications`

### Step 4 — Unit Tests for `/notifications` Page

- Create `__tests__/pages/notifications/notifications-page.test.tsx` covering:
  - Unauthenticated redirect to `/login`.
  - Authenticated render of `NotificationList`.
  - Filter tab switching, mark-read, mark-all-read, and delete actions.
- _Verify:_ `test:ci` runs clean with all new and existing tests passing.
- _Commit:_ `test(6-4): add unit tests for /notifications page and notification actions`

## Rules specific to this variant

- **UI Creativity (Dial HIGH):** Full freedom on notification icon styling, empty state graphics, unread badges, filter pill layouts, and toast animations.
- **Data Contract (Dial LOW):** Payloads and query parameters for `/api/notifications/*` must strictly adhere to backend API contracts.
- **No Tier Gating:** Accessible to all authenticated users.
- **A11y Standards:** Keyboard navigation, ARIA tab roles, and screen reader announcements for new notifications.

## Done when

- [ ] `/notifications` route exists, renders real notifications, and resolves the bell's "View all" link without 404.
- [ ] Status tabs (All/Unread/Read), type filters, pagination, mark-read, mark-all-read, and delete actions function against live API.
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
- `DECISION-LOG.md` **F21**, **F50**, and **F64** stay open, non-blocking.

## Next-session handoff

Session **6-5** (Settings / User — account-deletion confirm/cancel pages) is next in Phase 6.
