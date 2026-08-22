# Migration Order — Session 9-5 — `settings/` 11

> For sessions that **build or redesign frontend surfaces**: read `00-SKELETON-AND-RULES.md`
> first — §4 applies with the dial at **High** for page-body content/layout, **Zero** on data
> (every page binds to the endpoint its 9-0 row names).
> Corrected & upgraded to full **DRAFT** by Antigravity (Advisor & Architect), 2026-08-22.
> Grounded in `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`. Exactly one
> `layout.tsx` moves this session: `app/settings/layout.tsx`.

**Session:** 9-5 · **Phase:** 9 (Frontend Stack Replacement) · **Variant:** UI-BUILD · **Status:** CLOSED SUCCESSFUL
**Generated:** 2026-08-22 (Executor PRE-DRAFT) · **Upgraded & Corrected:** 2026-08-22 (Advisor DRAFT) · **Approved:** 2026-08-22 (Davin) · **Confirmed:** 2026-08-22 (Executor — resume-endpoint drop, F64 rescoping, and row 73-83 correction re-verified live against code; tsc clean; `/admin/*` chrome live-verified intact pre-session) · **Closed:** 2026-08-22 (Executor — all 7 steps executed, live-verified in a real `next build && next start` production server, all 3 test baselines green, route-manifest diff clean)
**Flags touched:** **F21** (24h account-deletion UI wired; backend async worker trails in Phase 10) $\rightarrow$ OPEN/DOCUMENTED; **F64** (subscription cancel UI wired; reactivation handed to Session 9-6 Payments) $\rightarrow$ OPEN/DEFERRED TO 9-6.
**Surface:** Exactly one layout boundary moves this session: `app/settings/layout.tsx` (top-level settings layout shell consuming `AppHeader` and sub-navigation tabs) + 11 settings pages: `settings` [Row 83, overview hub], `settings/account` [Row 73], `settings/appearance` [Row 74, Protected Page #5], `settings/billing` [Row 75], `settings/help` [Row 76, Protected Page #6], `settings/language` [Row 77], `settings/privacy` [Row 78], `settings/profile` [Row 79], `settings/security/activity` [Row 80], `settings/security` [Row 81], `settings/terms` [Row 82].
**Feeds on:** `GET/PATCH /api/user/profile`, `POST /api/user/password`, `POST /api/user/account/deletion-request`, `GET/PATCH /api/user/preferences` (appearance/language/timezone/privacy), `GET /api/subscription` (+ `POST /api/subscription/cancel`), `GET /api/invoices`, `GET/POST /api/user/2fa/{setup,verify-setup,disable,backup-codes}`, `GET /api/user/sessions` (+ `DELETE /[id]`), `GET /api/user/login-history`.
**Estimated time:** ~3.5h - 4h (11 settings sub-pages + layout shell under unified top-level `app/settings/` boundary).

---

## Decisions taken

1. **Top-Level `app/settings/` Layout Architecture (Resolution of Open Question 1)**
   - **Decision:** Relocate settings from `app/(dashboard)/settings/` to top-level `app/settings/` (with its own dedicated `app/settings/layout.tsx`), mirroring the proven architecture established in Session 9-4 (`app/dashboard/`, `app/alerts/`, `app/terminal/`, `app/free/`).
   - **What was rejected:** Keeping settings nested under `app/(dashboard)/layout.tsx` (which would create double-header nesting or break `/admin/*`).
   - **Rationale:** URLs are 100% identical (`/settings`, `/settings/profile`, `/settings/appearance`, etc.). `app/settings/layout.tsx` renders the server session check (`getServerSession` $\rightarrow$ `/login`), `AppearanceProvider`, `<AppHeader />`, breadcrumbs, and the 2-column desktop sub-sidebar / mobile horizontal tabs. Leaves `app/(dashboard)/layout.tsx` completely untouched to continue serving `/admin/*` until Session 9-8.
   - **Undo Cost:** Low.

2. **Resolution of F64 & Billing Subscription Scope (Resolution of Open Question 2)**
   - **Decision:** In `settings/billing` (`components/billing/subscription-card.tsx`), bind to real `GET /api/subscription`, `GET /api/invoices`, and `POST /api/subscription/cancel`. Do NOT call a non-existent `/resume` endpoint. For canceled subscriptions, render a clear "Re-subscribe" link pointing to `/pricing` / checkout. Hand the full Stripe reactivation / payment portal flow to **Session 9-6** (dedicated Payments session).
   - **What was rejected:** Trying to fabricate a fake backend reactivation endpoint during a UI-BUILD session or leaving a broken "Undo" button.
   - **Rationale:** Strictly follows UI-BUILD boundaries and keeps F64 cleanly scoped to Session 9-6.
   - **Undo Cost:** Low.

3. **Resolution of F21 — Account Deletion UI Binding (Resolution of Open Question 3)**
   - **Decision:** In `settings/account`, wire the "Request Account Deletion" button to the real `POST /api/user/account/deletion-request` endpoint. Upon success, display a clear confirmation banner ("Deletion request submitted. Your account is scheduled for deletion."). Acknowledge the backend email queue / cron worker as a known documented gap trailing into Phase 10.
   - **What was rejected:** Immediate destructive hard-delete without confirmation or inventing email transport in a frontend session.
   - **Rationale:** Safely connects the real frontend deletion flow without overstepping frontend scope.
   - **Undo Cost:** Low.

4. **Corrected Route Census: Real 11 Rows (Including `/settings/terms`, Dropping Phantom `/settings/notifications`)**
   - **Decision:** Align the 11 ported pages with exact `frontend-swap-route-map.md` rows 73–83:
     - Row 73: `/settings/account`
     - Row 74: `/settings/appearance` (Protected Page #5)
     - Row 75: `/settings/billing`
     - Row 76: `/settings/help` (Protected Page #6)
     - Row 77: `/settings/language`
     - Row 78: `/settings/privacy`
     - Row 79: `/settings/profile`
     - Row 80: `/settings/security/activity`
     - Row 81: `/settings/security`
     - Row 82: `/settings/terms`
     - Row 83: `/settings` (overview hub)
       _(Note: `/settings/notifications` was a typo in earlier drafts — dropped; `/settings/terms` is correctly assigned to Step 2)._
   - **Undo Cost:** Low.

5. **Protected Pages Constraint Integrity (6 Protected Pages Invariant)**
   - **Decision:** `/settings/appearance` (Protected Page #5) and `/settings/help` (Protected Page #6) are Protected Pages per `codebase-2-parity-audit/00-MASTER-PLAN.md` §0. Their visual presentation, theme accent pickers, and support channels must match Codebase 2's approved design with 100% fidelity.
   - **What was rejected:** Modifying the appearance palette or help center layout.
   - **Rationale:** Non-negotiable architectural invariant set by Davin.
   - **Undo Cost:** High if violated; zero with faithful porting.

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §3: this session ports all 11 settings sub-pages to DavinTrade's design system under a clean layout boundary, binding directly to real user profile, preferences, appearance, security (2FA/sessions), and billing APIs.

`frontend-swap-route-map.md` assigns this session 11 rows (73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83).

---

## Entry criteria (re-verify all at CONFIRM)

- [x] **Session 9-4 CONFIRMED, executed, CLOSED** — `(dashboard)` core pages and `/terminal`/`/free` live on `main`, route-manifest diff clean.
- [x] **Route-map rows 73–83 re-verified directly** against `frontend-swap-route-map.md`.
- [x] **`app/(dashboard)/settings/*` confirmed existing** with legacy page bodies; `app/settings/` confirmed ready for creation.
- [x] **`app/(dashboard)/layout.tsx` confirmed untouched and serving `/admin/*`**.
- [x] **Live test credentials working** (PRO, FREE, ADMIN autofill buttons).
- [x] **Backing endpoints live and functional**:
  - `GET/PATCH /api/user/profile`, `POST /api/user/password`
  - `POST /api/user/account/deletion-request`
  - `GET/PATCH /api/user/preferences`
  - `GET /api/subscription`, `POST /api/subscription/cancel`
  - `GET /api/invoices`
  - `GET/POST /api/user/2fa/setup`, `POST /api/user/2fa/verify-setup`, `POST /api/user/2fa/disable`
  - `GET /api/user/sessions`, `DELETE /api/user/sessions/[id]`
  - `GET /api/user/login-history`
- [x] **Sequential test suite baselines green** (`LESSONS-LEARNED.md` L24):

  ```powershell
  # 1. Monolith
  npx tsc --noEmit
  npx eslint app components lib hooks --max-warnings 5
  npm run test:ci

  # 2. Money service (use --maxWorkers=1 if shared resource)
  cd money-service; npm test -- --maxWorkers=1; cd ..

  # 3. Operation service
  cd operation-service; npm test; cd ..
  ```

---

## Ordered steps

1. **Create Top-Level `app/settings/layout.tsx`**
   - Implement server-side session authentication check (`getServerSession(authOptions)` $\rightarrow$ `redirect('/login')`).
   - Wrap with `AppearanceProvider` for zero-FOUC accent variables.
   - Mount `<AppHeader />` with dynamic breadcrumbs.
   - Render 2-column responsive layout: desktop sticky sub-sidebar navigation + mobile horizontal scrollable tabs.
   - _Verify:_ `npx tsc --noEmit` clean; renders cleanly across settings tabs without double chrome.

2. **Port Profile, Appearance, Help, Language, Privacy, Terms & Hub (Rows 74, 76, 77, 78, 79, 82, 83)**
   - `app/settings/page.tsx` (Row 83): Settings overview hub linking to sub-sections.
   - `app/settings/profile/page.tsx` (Row 79): Port profile editor, bound to `GET/PATCH /api/user/profile`.
   - `app/settings/appearance/page.tsx` (Row 74, Protected Page #5): Port DavinTrade appearance studio (theme, accentScheme, chartCandle colors, chartGrid opacity), bound to `useAppearance()` + `saveSettings()`.
   - `app/settings/help/page.tsx` (Row 76, Protected Page #6): Port help center with FAQs and real support mailto link (`support@davintrade.com`).
   - `app/settings/language/page.tsx` (Row 77): Port language & region preferences, bound to `useLocale()` and `/api/user/preferences`.
   - `app/settings/privacy/page.tsx` (Row 78): Port privacy & telemetry toggles, bound to `/api/user/preferences`.
   - `app/settings/terms/page.tsx` (Row 82): Port terms & legal policies view.
   - _Verify:_ `npx tsc --noEmit` clean; appearance settings persist across reloads.

3. **Port Account & Billing Pages (Rows 73, 75)**
   - `app/settings/account/page.tsx` (Row 73): Port account settings; wire "Delete Account" button to `POST /api/user/account/deletion-request`. Document backend email/cron trail in Deviations (F21).
   - `app/settings/billing/page.tsx` (Row 75): Port billing & invoices dashboard; wire `subscription-card.tsx` cancel action to real `/api/subscription/cancel`, and render a re-subscribe button pointing to `/pricing` for canceled tiers (F64 handoff to 9-6).
   - _Verify:_ `npx tsc --noEmit` clean; billing status and invoices render real Stripe data.

4. **Port Security & Security Activity Pages (Rows 80, 81)**
   - `app/settings/security/page.tsx` (Row 81): Port 2FA management (TOTP QR code setup, verification modal, disable button), password change form, and active sessions manager with revoke buttons (`DELETE /api/user/sessions/[id]`).
   - `app/settings/security/activity/page.tsx` (Row 80): Port security activity audit log, bound to `GET /api/user/login-history` and `GET /api/user/security-alerts`.
   - _Verify:_ `npx tsc --noEmit` clean; 2FA setup and session revoking execute against real APIs.

5. **Clean up Legacy `app/(dashboard)/settings`**
   - Remove legacy `app/(dashboard)/settings` directory now that top-level `app/settings` is fully live.
   - Ensure `app/(dashboard)/layout.tsx` remains in place to support `/admin/*`.
   - _Verify:_ No duplicate route collisions; visiting `/settings/*` resolves to `app/settings/*`.

6. **Live Authenticated Click-Through & Verification**
   - Log in with PRO test user: Click through all 11 settings pages.
   - Verify appearance accent changes update UI in real-time and persist in DB.
   - Test 2FA setup modal and password change validation.
   - Test billing cancellation modal.
   - Verify unauthenticated visitor to `/settings` is redirected to `/login`.
   - **Browser-check `/admin/*`** to confirm admin chrome is 100% unaffected.

7. **Route-Manifest Diff & Test Suites Verification**
   - Verify route-manifest diff: exactly 11 settings routes migrated to `app/settings/`.
   - Run sequential test baselines:
     ```powershell
     npx tsc --noEmit
     npx eslint app components lib hooks --max-warnings 5
     npm run test:ci
     ```

---

## Rules specific to this variant

- **UI Creativity:** High for settings forms, badge indicators, and sub-nav cards, subject to the **6 Protected Pages Invariant** for `/settings/appearance` and `/settings/help`.
- **Zero Mock Data:** All form submissions, 2FA operations, and billing actions must execute against real APIs.
- **Browser-Check `/admin/*`:** Explicitly verify that `/admin/*` navigation chrome remains intact in the browser before closing.
- **Accessibility:** Ensure every input has associated `<label htmlFor="...">`, validation errors announce via `aria-live`, and tabs support keyboard navigation.
- **Record Design Decisions:** Document all F21/F64 resolutions and component adaptations in Deviations at close.

---

## Done when

- [x] All 11 settings pages live under top-level `app/settings/layout.tsx` with DavinTrade branding.
- [x] `/settings/appearance` and `/settings/help` match Protected Pages design specifications with 100% fidelity.
- [x] F21 (account deletion request UI binding) and F64 (billing cancel UI + handoff to 9-6) documented in `DECISION-LOG.md`.
- [x] Session revoke, password update, and profile editing live-verified end-to-end. **2FA setup live-verify blocked by local environment** (`operation-service` not running this session — `ECONNREFUSED`, not an app bug; see Deviation 6). `operation-service`'s own 42/42 test suites pass.
- [x] No double-chrome on any settings page, and `/admin/*` confirmed completely unaffected.
- [x] Route-manifest diff matches this session's 11 rows and nothing else.
- [x] `npx tsc --noEmit`, `npx eslint app components lib hooks --max-warnings 5`, and `npm run test:ci` all pass clean.

---

## Rollback

`git revert` of this session's commits. Prefer one commit per logical step (layout creation, profile/appearance/help pages, account/billing with F21/F64, security pages, legacy settings cleanup) so changes can be isolated cleanly.

---

## Deviations

1. **`components/billing/subscription-card.tsx` (named in Decision 2) deliberately NOT wired
   in.** Reading the real `app/(dashboard)/settings/billing/page.tsx` before porting it showed it
   never imported that component at all — it has its own inline `AlertDialog`-based cancel flow
   (confirm-before-cancel, no post-cancel "Undo" step) that is what has actually been live. That
   flow doesn't have F64's original bug (an optimistic-cancel "Undo" that only reverted local
   state) because it doesn't do optimistic UI in the first place. Ported the real, live flow as-is
   into `app/settings/billing/page.tsx`; `subscription-card.tsx` stays unmounted dead code, still
   carrying its original bug, unchanged — Davin's own future call per F64's original note.
2. **F21 and F64 close only their UI-binding scope, exactly as the corrected order's own Decisions
   2–3 specify — neither flag is marked RESOLVED.** `POST /api/user/account/deletion-request` and
   `POST /api/subscription/cancel` are both real, live endpoints now wired to real buttons. Reading
   the account-deletion routes' own source before wiring them found two pre-existing TODO stubs
   this session does not touch: `deletion-request/route.ts` and `deletion-confirm/route.ts` both
   log to console instead of sending the confirmation/scheduling emails, and no cron/worker exists
   anywhere in the repo to execute the actual deletion 24h after confirmation (grepped for
   `AccountDeletionRequest` outside the API routes themselves — zero hits). The 7-day
   link-expiry + 24h post-confirm grace period are both real and DB-backed; only the email
   dispatch and the final deletion job are still stubs. `DECISION-LOG.md`'s F21 entry updated to
   reflect this, still OPEN.
3. **Privacy page's "Request Data Export" button and Profile page's photo-upload button are
   pre-existing mocks, carried forward unchanged, not fixed.** Neither is in this session's scope
   (`app/api` has no export-job or file-storage route for either); flagged rather than silently
   shipped as if real or silently disabled.
4. **Help page (Protected Page #6) — two real-vs-mock swaps vs. seed-code, both required by the
   "Zero Mock Data" rule.** seed-code's version calls `useSupportChat()` from
   `components/chat-widget/chat-context` — that widget was explicitly deferred to Phase 14 at
   Session 9-1 and is not mounted anywhere in the main repo. Its ticket-submit form is also a bare
   `setTimeout` with no real endpoint (confirmed: no `/api/support`, `/api/contact`, or
   `/api/ticket` route exists in this repo). Replaced both with real actions: the chat CTA links to
   `mailto:support@davintrade.com` (per the order's own Step 2 instruction), and the ticket form
   composes a real pre-filled `mailto:` link instead of faking a "ticket submitted" success state
   for a request nothing actually delivers.
5. **A genuine, reproducible client-side double-render defect found live on `/settings/appearance`
   — confirmed benign, not fixed, and not new.** Live-verified in a real `next build && next start`
   production server (not dev/HMR): the DOM briefly/persistently carries a second, inert copy of
   the page's content in `<div id="S:0" style="display:none">` alongside `$RC`/`$RT`/`$RV`
   inline scripts — this is React/Next's own Suspense-streaming "reveal" mechanism (this route's
   own `app/settings/loading.tsx` creates the Suspense boundary), not application code duplicating
   anything. Confirmed inert: `display:none`, 0×0 bounding rect, non-interactive, zero console/
   hydration errors. The same pattern was independently confirmed present on the pre-existing
   `/login` page too (unrelated to this session), so it is not something this session's own code
   introduced. This is very likely the same underlying mechanism behind `DECISION-LOG.md` F77
   (`/alerts` double-render, Session 9-4) — F77's own diagnostic notes ("SSR HTML verified clean via
   direct `fetch()`") are consistent with this exact artifact. Logged as an addendum to F77 rather
   than a new flag; not root-caused further this session, consistent with Davin's own 9-4 call to
   close F77 documented rather than open-ended-investigate.
6. **Live E2E verification of 2FA setup (Step 6) blocked by local environment, not by app code.**
   `POST /api/user/2fa/setup` (and `/api/user/security-alerts`) are cut over to
   `operation-service` (`shouldUseOperationServiceForUserProfile()`); this session's local preview
   only ran the Next.js monolith, not `operation-service`, so the live click-through hit a real
   `ECONNREFUSED` (server logs confirm), not an app bug. `operation-service`'s own test suite
   (42/42 suites, 393/393 tests) passed clean, and the monolith's forwarding logic is pre-existing
   and untouched this session. Login history and sessions (still monolith-routed) verified live
   with real data with no issue.
7. **5 existing unit test suites' import paths updated, zero assertion changes.**
   `account-settings-page`, `billing`, `security-login-history-pagination`, `security-activity`,
   and `overview` test files imported page components from the now-retired
   `@/app/(dashboard)/settings/*` path; updated to `@/app/settings/*`. Component logic is
   unchanged (retheme-only port), so no test file needed an assertion change — all 6 suites/31
   tests green both before and after.

---

## Next-session handoff

- **Next session:** `9-6` — Payments flow cross-boundary (UI-BUILD + PORT).
  - Scope: End-to-end checkout flow (`/checkout`), Stripe portal integration, pricing tier upgrade modals, payment webhook verification, and F64 subscription reactivation.
  - Formally re-verifies `/pricing` (row 69) and `/settings/billing` (row 75) across the full payment lifecycle.
- **Prerequisite:** Session 9-5 CLOSED — settings pages live on `main`.
- **9-5 obligation carried to close:** PRE-DRAFT Session 9-6's migration order per `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`.
