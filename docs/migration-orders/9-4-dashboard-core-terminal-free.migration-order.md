# Migration Order — Session 9-4 — `(dashboard)` core 7 + `/terminal` + `/free`

> For sessions that **build or redesign frontend surfaces**: read `00-SKELETON-AND-RULES.md`
> first — §4 applies with the dial at **High** for page-body content/layout, **Zero** on data
> (every page binds to the endpoint its 9-0 row names).
> Upgraded to full **DRAFT** by Antigravity (Advisor & Architect), 2026-08-22.
> Grounded in `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`. Exactly one
> `layout.tsx` moves this session: `app/(dashboard)/layout.tsx`.

**Session:** 9-4 · **Phase:** 9 (Frontend Stack Replacement) · **Variant:** UI-BUILD · **Status:** CLOSED SUCCESSFUL
**Generated:** 2026-08-22 (Executor PRE-DRAFT) · **Upgraded:** 2026-08-22 (Advisor DRAFT) · **Approved:** 2026-08-22 (Davin) · **Confirmed:** 2026-08-22 (Executor) · **Closed:** 2026-08-22 (Executor)
**Flags touched:** none new (Stack D/E panels are flag-gated empty states pending F69/F71 in Phases 12/13)
**Surface:** Exactly one layout boundary moves this session: `app/(dashboard)/layout.tsx` (consuming `AppHeader` and `ChatSidebar` from Session 9-1) + 5 core dashboard pages (`dashboard`, `alerts`, `alerts/new`, `alerts/[id]/edit`, `notifications`) + 2 new chart workspaces (`app/(dashboard)/terminal/page.tsx` [PRO], `app/(dashboard)/free/page.tsx` [FREE]) + 2 retired `/charts` routes (`app/(dashboard)/charts/page.tsx` and `app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx`).
**Feeds on:** `GET /api/alerts` (+ `POST`, `GET/PATCH /api/alerts/[id]`), `GET /api/notifications` (+ `/[id]/read`), `GET /api/user/profile`, `GET /api/drawings`, `GET /api/alerts/line`, `GET /api/candles/[symbol]`, `GET /api/market-data/channel`, `GET /api/realtime/token`, `components/alerts/alert-form.tsx`, `components/notifications/notification-bell.tsx`.
**Estimated time:** ~3.5h - 4h (Core dashboard pages + 2 quantitative chart workspaces under single layout boundary).

---

## Decisions taken

1. **Keep Session 9-4 Unified as Single Session (Resolution of Open Question 1)**
   - **Decision:** Execute Session 9-4 as a single unified UI-BUILD session covering both the `(dashboard)` core pages and the two quantitative workspaces (`/terminal` and `/free`), rather than splitting into 9-4a/9-4b.
   - **What was rejected:** Splitting into two separate micro-sessions.
   - **Rationale:** All 7 active routes share the identical `app/(dashboard)/layout.tsx` layout boundary and component dependencies (`AppHeader`, `ChatSidebar`, `TradingChart`). Splitting would double the layout verification overhead without reducing technical complexity.
   - **Undo Cost:** Low.

2. **Stack D/E Panels Empty-State Architecture (Resolution of Open Question 2)**
   - **Decision:** On `/terminal` and `/free`, Panel 1 (`TradingChart`) binds to real market data (`/api/candles/[symbol]`, `/api/market-data/channel`, `/api/drawings`, `/api/alerts/line`), while Panel 2 (`ChatPanel` / AI Copilot) and Panel 3 (`MarketCommentsPanel`) render styled DavinTrade empty states ("AI Copilot & Live Feed backend connects in Phases 12-14 — Chart and Line Alerts active") with ZERO mock data or fake socket simulations.
   - **What was rejected:** Shipping fake canned chatbot strings or mock simulated commentary.
   - **Rationale:** Strictly upholds the Phase 9 zero-mock-data non-negotiable and foundational Rule 1.
   - **Undo Cost:** Low.

3. **`app/(dashboard)/layout.tsx` In-Place Restyling (Resolution of Open Question 3)**
   - **Decision:** Restyle `app/(dashboard)/layout.tsx` in place: preserve the server-side `getServerSession(authOptions)` authentication gate, `LoginTracker`, and `TokenRefreshProvider`, while replacing the legacy header/sidebar with `<AppHeader />` and `<ChatSidebar />` (ported and theme-tokenized in Session 9-1).
   - **What was rejected:** Stripping server-side auth checks or re-implementing client-only layout wrappers.
   - **Rationale:** Guarantees that unauthenticated users are intercepted before reaching any dashboard surface while ensuring zero-FOUC theme/accent rendering via `AppearanceProvider`.
   - **Undo Cost:** Low.

4. **Gap-6e Residual Allocation (Resolution of Open Question 4)**
   - **Decision:** Fix semantic tokens and Light Clean Mode contrast in `components/chat-panel.tsx` and `components/market-comments-panel.tsx` during Session 9-4. Defer `app/(dashboard)/settings/layout.tsx` and settings sub-pages token fixes to Session 9-5 (which owns the Settings layout boundary).
   - **What was rejected:** Leaving terminal panel tokens hardcoded dark or overflowing 9-4 scope into the settings directory.
   - **Rationale:** Cleanly scopes each file to the session that owns its layout boundary.
   - **Undo Cost:** Low.

5. **Protected Pages Constraint Integrity (6 Protected Pages Invariant)**
   - **Decision:** `/dashboard`, `/terminal`, and `/free` are Protected Pages per `codebase-2-parity-audit/00-MASTER-PLAN.md` §0. Their visual hierarchy, panel split-ratios, widget cards, and typography must match Codebase 2's approved design with 100% fidelity.
   - **What was rejected:** Redesigning or altering the established layout structure of Protected pages.
   - **Rationale:** Non-negotiable architectural invariant set by Davin.
   - **Undo Cost:** High if violated; zero with faithful porting.

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §3: this session replaces all legacy dashboard views with DavinTrade's core workspace, alerts management, notification center, and the flagship 4-panel PRO `/terminal` and 3-panel FREE `/free` charting environments.

`frontend-swap-route-map.md` assigns this session 10 rows (49, 50, 51, 55, 56, 57, 58, 59, 62, 68), collapsing to 8 distinct URLs after retiring the 3 legacy `/charts` routes.

---

## Entry criteria (re-verify all at CONFIRM)

- [x] **Session 9-3 CONFIRMED, executed, CLOSED** — `(auth)` pages and `/welcome` live on `main`, route-manifest diff clean.
- [x] **Route-map rows 49, 50, 51, 55, 56, 57, 58, 59, 62, 68 re-verified directly** against `frontend-swap-route-map.md`.
- [x] **`app/(dashboard)/{dashboard,alerts,alerts/new,alerts/[id]/edit,notifications}` confirmed existing** and holding legacy page bodies; `app/(dashboard)/{terminal,free}/` confirmed ready for creation; `app/(dashboard)/charts*` confirmed present for retirement.
- [x] **Live test credentials working** (PRO, FREE, ADMIN autofill buttons verified at 9-3).
- [x] **Backing endpoints live and functional**:
  - `GET/POST /api/alerts`, `GET/PATCH/DELETE /api/alerts/[id]`
  - `GET /api/notifications`, `PATCH /api/notifications/[id]/read`
  - `GET /api/user/profile`
  - `GET /api/candles/[symbol]`
  - `GET /api/market-data/channel`
  - `GET /api/drawings`
  - `GET /api/alerts/line`
  - `GET /api/realtime/token`
- [x] **Sequential test suite baselines green** (`LESSONS-LEARNED.md` L24):

  ```powershell
  # 1. Monolith
  npx tsc --noEmit
  npx eslint app components lib hooks --max-warnings 5
  npm run test:ci

  # 2. Money service
  cd money-service; npm test; cd ..

  # 3. Operation service
  cd operation-service; npm test; cd ..
  ```

---

## Ordered steps

1. **Restyle `app/(dashboard)/layout.tsx`**
   - Preserve server session authentication check (`getServerSession(authOptions)` $\rightarrow$ `redirect('/login')`).
   - Preserve `LoginTracker` and `TokenRefreshProvider`.
   - Replace legacy header/sidebar/footer with `<AppHeader />` and `<ChatSidebar />` from `components/layout/`.
   - _Verify:_ `npx tsc --noEmit` clean; renders cleanly around existing dashboard pages without double chrome.

2. **Port Core Dashboard Pages (Rows 49, 50, 51, 55, 56)**
   - `app/(dashboard)/dashboard/page.tsx` (Row 55, Protected Page #4): Port DavinTrade dashboard overview with summary metrics, active alerts list, and workspace jump-links bound to real `/api/alerts` and `/api/user/profile`.
   - `app/(dashboard)/alerts/page.tsx` (Row 49): Port DavinTrade alerts table, bound to real `GET /api/alerts` and toggle/delete actions.
   - `app/(dashboard)/alerts/new/page.tsx` (Row 50) & `alerts/[id]/edit/page.tsx` (Row 51): Restyle `components/alerts/alert-form.tsx` with DavinTrade tokens while preserving full validation and `POST/PATCH /api/alerts` handlers.
   - `app/(dashboard)/notifications/page.tsx` (Row 56): Port notification feed, bound to `GET /api/notifications` and `PATCH /api/notifications/[id]/read`.
   - _Verify:_ `npx tsc --noEmit` clean; alert CRUD and notifications function with real database records.

3. **Port Quantitative Workspaces `/terminal` & `/free` (Rows 62, 68)**
   - Create `app/(dashboard)/terminal/page.tsx` (Row 68, Protected Page #2 - PRO Tier):
     - Mount `TradingChart` with real candle data, M5/M15 timeframe selector, channel overlay, and drawing toolbar.
     - Mount `ChatPanel` and `MarketCommentsPanel` with DavinTrade empty states (zero mock socket data).
     - Apply Gap-6e semantic tokens fix so Light Clean Mode renders with proper WCAG AA contrast.
   - Create `app/(dashboard)/free/page.tsx` (Row 62, Protected Page #3 - FREE Tier):
     - Mount Free workspace with sample chart, feature blur gate, and `ProUpgradeModal`.
   - _Verify:_ `npx tsc --noEmit` clean; charts render real data, toolbars respond to clicks, modals open/close.

4. **Retire Legacy `/charts` Routes (Rows 57, 58, 59)**
   - Remove or set permanent redirects on legacy routes:
     - `app/(dashboard)/charts/page.tsx` $\rightarrow$ redirects to `/terminal`.
     - `app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx` $\rightarrow$ redirects to `/terminal`.
     - `app/(dashboard)/charts/simple` $\rightarrow$ redirects to `/free`.
   - Audit and update all internal links across the codebase to ensure zero remaining links point to `/charts`.
   - _Verify:_ No dead links remain in repo; visiting legacy URLs redirects smoothly.

5. **Live Authenticated Click-Through & Verification**
   - Log in with PRO test user: Verify `/dashboard`, `/alerts`, `/notifications`, and `/terminal` render cleanly with real data.
   - Test alert creation, edit, and deletion cycle.
   - Log in with FREE test user: Verify `/free` renders with appropriate tier gates.
   - Verify Light Clean Mode and Dark Mode token switching across all 7 pages.

6. **Route-Manifest Diff & Test Suites Verification**
   - Verify route-manifest diff: exactly the 8 active URLs + 2 retired redirects matching route map.
   - Run sequential test baselines:
     ```powershell
     npx tsc --noEmit
     npx eslint app components lib hooks --max-warnings 5
     npm run test:ci
     ```

---

## Rules specific to this variant

- **UI Creativity:** High for dashboard widgets, alerts layout, and notification cards, subject to the **6 Protected Pages Invariant** for `/dashboard`, `/terminal`, and `/free`.
- **Zero Mock Data:** Real market data, candles, alerts, and notifications must be used — Stack D/E panels must render as clean empty states, never mock responses.
- **Accessibility:** Form labels, keyboard navigability on alert tables, `aria-expanded` on collapsible terminal panels.
- **Record Design Decisions:** Document all layout token adaptations in the Deviations section at close.

---

## Done when

- [x] All 5 `(dashboard)` core pages + `/terminal` + `/free` live with DavinTrade branding. Corrected from "consuming `app/(dashboard)/layout.tsx`" per Deviation 13 — each now has its own minimal top-level layout; `app/(dashboard)/layout.tsx` was restored to serve only `/settings/*` and `/admin/*`.
- [x] `/dashboard`, `/terminal`, and `/free` faithfully match Protected Pages design specifications.
- [x] Real alert CRUD, notification read states, and real chart/drawing toolbar rendering live-verified.
- [x] Stack D/E panels render genuine empty states with zero mock data.
- [x] Legacy `/charts` routes retired with zero dangling internal links.
- [x] Route-manifest diff matches this session's rows and nothing else — confirmed via `git diff --stat` against the session's start commit; `settings/`/`admin/` show zero diff.
- [x] `npx tsc --noEmit`, `npx eslint app components lib hooks --max-warnings 5`, and `npm run test:ci` all pass clean. **Not fully green: `DECISION-LOG.md` F77 (OPEN)** — a live, reproducible defect (`/alerts`, `/alerts/new` client-side double-render on reload, confirmed functional impact) was found and is being closed as a disclosed, unresolved item per Davin's live direction rather than blocking session close.

---

## Rollback

`git revert` of this session's commits. Prefer one commit per logical step (layout update, core pages, terminal/free, charts retirement) so individual changes can be isolated cleanly.

---

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

1. **L3 pattern recurred again at CONFIRM (24th+ recurrence).** Committed `HEAD` held only the
   bare Executor PRE-DRAFT (4 open questions, no decisions, `Status: PRE-DRAFT`); the working copy
   carried the full Advisor DRAFT → Davin APPROVED upgrade (5 numbered `Decisions taken`). Davin's
   own chat message opening this session independently restated Decisions 3 and 5 verbatim, serving
   as live confirmation before execution began.

2. **Decision 4's "fix `chat-panel.tsx`/`market-comments-panel.tsx`" framing corrected to
   "port + build empty state."** Neither file exists anywhere in the main repo — only in
   `seed-code` (read-only). Same for `components/ui/pro-upgrade-modal.tsx` (Step 3's
   `ProUpgradeModal`). All three ported fresh from `seed-code`, tokenized to DavinTrade semantics,
   with Panels 2/3 built as genuine empty states per Decision 2 — not a token patch on an existing
   file. Davin approved this correction live at CONFIRM.

3. **Step 1's `ChatSidebar` import path corrected.** The order cites
   `components/layout/` for both `AppHeader` and `ChatSidebar`; only `AppHeader` lives there
   (`components/layout/app-header.tsx`). `ChatSidebar` is at `components/chat-sidebar.tsx` (built
   Session 9-1). Davin approved this correction live at CONFIRM.

4. **Step 4's `charts/simple` retirement target dropped — no such file exists.** Neither the live
   tree, `seed-code`, nor `frontend-swap-route-map.md` name a `charts/simple` route. Only 2 real
   legacy files exist to retire: `app/(dashboard)/charts/page.tsx` and
   `app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx` — both redirect to `/terminal` per
   Davin's live approval (matches the Surface line's own "2 retired routes," not the "Why this
   session exists" section's uncorrected "3 legacy `/charts` routes" — that figure traces to a
   duplicate row (55/56, both `/charts/[symbol]/[timeframe]`) in `frontend-swap-route-map.md`
   itself, a 9-0 artifact defect, not this session's own error).

5. **Step 2's row citations for `/dashboard` and `/notifications` don't match
   `frontend-swap-route-map.md`.** The order cites Rows 55/56 for these two pages; the route map's
   own Rows 55/56 are actually the retired `/charts/[symbol]/[timeframe]` duplicate (see Deviation
   4). The correct citations, re-verified directly against the route map at CONFIRM, are **Row 62**
   (`/dashboard`) and **Row 68** (`/notifications`) — the target file paths, seed-code sources, and
   backing APIs the order names for both pages are otherwise correct; only the parenthetical row
   numbers were wrong.

6. **Architecture correction: `/terminal` and `/free` moved out of the `(dashboard)` route group
   entirely — Davin's live decision, `AskUserQuestion`.** Reading `seed-code`'s actual
   `app/terminal/page.tsx` and `app/free/page.tsx` in full (not just their route-map citation)
   showed both are full-screen `h-screen` 4-panel resizable workspaces that mount `ChatSidebar`
   themselves as an internal Panel A and never use `AppHeader` at all. The order's own Step 1 and
   the 9-0 route map's "Main-Repo Target" column both put these two pages under
   `app/(dashboard)/terminal|free/page.tsx`, sharing `app/(dashboard)/layout.tsx`'s chrome — which
   would have doubled `ChatSidebar` (once from the shared layout, once as the page's own Panel A)
   and added an `AppHeader` bar neither page's real design has, violating Decision 5's
   100%-fidelity invariant. Corrected to top-level `app/terminal/page.tsx` + `app/free/page.tsx`,
   each with its own minimal `layout.tsx` (auth gate + `AppearanceProvider` only, no shared
   chrome) — matching both seed-code's real file location and its real, chrome-free design. URLs
   are unaffected (route groups are URL-neutral). This deviates from the 9-0 route map's own
   "Main-Repo Target" citation for rows 57/58, written before that file's source was read in full
   — a `LESSONS-LEARNED.md` L39 recurrence in the 9-0 contract itself, not this session's error.

7. **Step 1 corrected: `app/(dashboard)/layout.tsx` does not render `AppHeader`/`ChatSidebar`
   chrome at all.** Reading all 5 core-page source files in `seed-code` (`dashboard/
_components/dashboard-content.tsx`, `alerts/page.tsx`, `alerts/new/page.tsx`,
   `alerts/[id]/edit/page.tsx`, `notifications/page.tsx`) shows every one of them mounts its own
   `<AppHeader title=... subtitle=... />` directly — none consume a shared header from a parent
   layout, and none import `ChatSidebar` (which is workspace-only, per Deviation 6). Decision 3's
   "replace legacy header/sidebar with `<AppHeader />` and `<ChatSidebar />`" language described
   the swap at the wrong layer. Corrected: `app/(dashboard)/layout.tsx` stays a thin auth-gate +
   `AppearanceProvider` wrapper (session gate, `LoginTracker`, `TokenRefreshProvider` all
   preserved per Decision 3's own rationale); each of the 5 core pages mounts its own `AppHeader`
   in Step 2, matching seed-code exactly. This is a mechanical correction (unanimous, zero
   exceptions across all 5 source files) rather than a judgment call, so executed directly per
   EXECUTOR-PROTOCOL.md §0 ("you decide from live code") rather than re-escalated.

8. **Pre-existing latent defects fixed in `AppHeader`/`ChatSidebar` before their first real
   mount, per `LESSONS-LEARNED.md` L15.** Both components were built at Session 9-1 but never
   mounted anywhere (confirmed: zero importers repo-wide before this session) — reading their full
   implementation, not just their prop signatures, before wiring them into a real authenticated
   surface found two real bugs: (a) both hardcoded a static "Trader User" / "TU" avatar / `/
placeholder-user.jpg` regardless of who is actually logged in — would have shown every real PRO/
   FREE/Admin/Affiliate test user the same fake identity on every one of the 7 pages this session
   ships; (b) both "Log out" menu items were a bare `<Link href="/login">` — navigates away
   without ever calling `signOut()` or clearing the session cookie, leaving the NextAuth session
   fully live server-side. Fixed both components identically: real identity via `useSession()`
   (name/email/avatar/tier/initials, admin-menu-item gated on `session.user.role === 'ADMIN'`
   matching the legacy `Header`'s own established pattern) and the same bridge-aware logout flow
   `components/layout/header.tsx` (the file this session retires) already uses —
   `/api/auth/token-logout` + `signOut({redirect:false})` + `getSession()` + hard navigation when
   `isAuthBridgeEnabled()`, plain `signOut()` otherwise. `npx tsc --noEmit` clean after the fix.

9. **Step 2: `CreateAlertClient` consolidated onto the shared `AlertForm` instead of keeping its
   own duplicate hand-rolled form.** `app/(dashboard)/alerts/new/create-alert-client.tsx` had its
   own separate form markup (radio-card condition-type picker, no tier-endpoint validation) rather
   than using `components/alerts/alert-form.tsx` (only `EditAlertClient` used it) — despite the
   order's own Step 2 text citing `alert-form.tsx` as feeding both `/alerts/new` and
   `/alerts/[id]/edit`. `AlertForm` already fully supports create mode (`isEditing=false`) and adds
   real functionality the old duplicate lacked (`GET /api/tier/symbols`,
   `/api/tier/combinations`, `/api/tier/check/[symbol]` — Session 6-3/A1-11). Consolidated:
   `CreateAlertClient` now renders `<AlertForm isEditing={false} onSubmit={...} />`, preserving its
   own real server-computed `canCreate`/`limit`/`currentCount` gate and the `AlertsProUpgrade`
   FREE-tier landing. `AlertForm`, `AlertsClient`, `AlertsProUpgrade`, and both alert page shells
   restyled to DavinTrade semantic tokens (amber primary actions, `bg-card`/`text-foreground`/
   `border-border` throughout) — all real handlers (optimistic toggle/delete/undo, PATCH/POST/
   DELETE `/api/alerts*`) preserved byte-for-byte. Also fixed a stale reference:
   `AlertsClient`'s "View Chart" button called `router.push('/charts/[symbol]/[timeframe]')` —
   this session retires that route in Step 4, so it now routes to `/terminal` (the component only
   ever renders for PRO users, who always see `/terminal`).
   `app/(dashboard)/dashboard/page.tsx` and `app/(dashboard)/notifications/page.tsx` restyled the
   same way (AppHeader mounted per-page per Deviation 7, real Prisma-fetched data and the real
   `NotificationList` component — pagination, realtime socket, optimistic mutations — both
   untouched). **Known pre-existing gap, not fixed this session (scope discipline,
   `EXECUTOR-PROTOCOL.md` non-negotiable #4):** `dashboard/page.tsx`'s "API Usage 42/60" and
   "Chart Views 156" stat cards are hardcoded placeholders that predate this session (present,
   identical values, in the live app before Session 9-4 touched anything — confirmed at CONFIRM's
   live browser check) — no real usage-tracking/analytics endpoint exists to bind them to.
   Preserved as-is, not newly introduced; flagged for a future session, not silently hidden.

10. **Step 3: reused the real, pre-existing `components/charts/trading-chart.tsx` for Panel 1
    instead of porting seed-code's own 856-line `trading-chart.tsx`.** The real component (259
    lines) already does everything the order's own Panel 1 requirement asks for — live Socket.IO
    OHLCV data (`useOhlcvSocket`), a real drawing toolbar (`DrawingLayer`), fired-alert markers
    (`useFiredAlertMarkers`), and a real PRO-gated multi-timeframe overlay (`MtfToggle`,
    `useMtfOverlay`, already checks `session.user.tier === 'PRO'`) — none of which seed-code's
    own mock version has. **Order text correction (L22):** the order's `Feeds on` line cites
    `GET /api/candles/[symbol]` and `GET /api/market-data/channel` for Panel 1; the real component
    uses neither — it's Socket.IO-only (confirmed: `useOhlcvSocket` makes zero `fetch()` calls).
    `/api/drawings` and `/api/alerts/line` are correctly cited (used by `DrawingLayer`).
    `components/chat-panel.tsx`, `components/market-comments-panel.tsx`, and
    `components/ui/pro-upgrade-modal.tsx` ported fresh per Deviation 2 as genuine empty
    states/real-navigation, not seed-code's mock chat history / fabricated comment feed / fake
    in-place upgrade. `components/ui/resizable.tsx` ported verbatim (generic shadcn wrapper, no
    seed-code-specific logic) plus `react-resizable-panels@^2.1.7` added
    (`pnpm add -w`, matching seed-code's own pinned version per `LESSONS-LEARNED.md` L9).

11. **Step 4: retired the 2 real legacy `/charts` files as permanent redirects to `/terminal`,
    deleted 3 now-orphaned dependency files.** `app/(dashboard)/charts/page.tsx` and
    `app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx` both now just `redirect('/terminal')`
    (a FREE session gets a second hop to `/free` from `/terminal`'s own tier gate). Deleted
    `trading-chart-client.tsx`, `components/charts/chart-controls.tsx`, and
    `components/ui/upgrade-button.tsx` after confirming (grep, whole tree) each had zero
    importers left anywhere outside the 2 retired page files. Fixed the 2 remaining `/charts` nav
    links repo-wide (`components/layout/sidebar.tsx`, `components/layout/mobile-nav.tsx` → both
    now point at `/terminal`) — zero remaining internal links to `/charts`, confirmed by a
    whole-tree grep after the fix.
    **Found but NOT deleted this session (scope discipline):** `components/layout/{header,
sidebar,footer,mobile-nav}.tsx` are now fully orphaned (zero importers anywhere in `app/`) as a
    direct consequence of Step 1 removing their only mount point. `MASTER-ROADMAP-PHASES-7-15.md`
    §3 explicitly scopes "dead codebase-1 components deleted" to Session 9-10 (Phase 9 exit), not
    per-session — left in place, flagged here rather than deleted unilaterally, matching Session
    9-1's own precedent for incidentally-discovered dead code (`theme-provider.tsx`, flagged not
    deleted absent explicit go-ahead).

12. **Genuine test regression found and fixed at Step 6, `LESSONS-LEARNED.md` L40 recurrence
    (4th occurrence).** Mounting `AppHeader` into `app/(dashboard)/notifications/page.tsx` and
    `app/(dashboard)/alerts/[id]/edit/page.tsx` broke `notifications-page.test.tsx` (7 tests) and
    `edit.test.tsx` (2 tests) — `AppHeader` calls `usePathname()` (unmocked in both files) and
    `useLocale()` (needs a `LocaleProvider` ancestor). Fixed forward per the exact pattern L40's
    Session 9-3 recurrence established: added a `usePathname` stub to each file's `next/navigation`
    mock, wrapped every affected `render()` call in a real `LocaleProvider` with `localStorage`
    pre-seeded from `defaultPreferences` (both files assert exact `global.fetch` call counts/args,
    the same reason 9-3 chose the real-`LocaleProvider` route over a reject-mock). `edit.test.tsx`
    additionally had no `next-auth/react` mock at all — added one (`useSession`/`getSession`/
    `signOut`, matching `AppHeader`'s own imports) so `useSession()` doesn't fall through to the
    real module's own `fetch('/api/auth/session')` during a render test. `test:ci` re-run clean
    afterward: 160/160 suites, 2400/2400 tests — same count as this session's own CONFIRM baseline,
    no tests dropped. Not written as a new L41 (repo is at its 40-entry cap per the file's own
    header; this is a straightforward recurrence of L40 itself, which already documents the fix).

13. **Architecture correction discovered live: restoring `app/(dashboard)/layout.tsx` and moving
    the 5 core pages to top-level routes, Davin's live decision, `AskUserQuestion`.** Step 1's
    original restyle removed the legacy `Header`/`Sidebar`/`Footer` from `app/(dashboard)/
layout.tsx` entirely (since the 5 core pages now mount their own `AppHeader`, Deviation 7) — but
    that layout also wraps `/settings/*` (11 pages, 9-5's own scope) and `/admin/*` (19+ pages,
    9-8's own scope), neither touched this session. Live-verified via a real browser check:
    `/settings/appearance` rendered with **zero navigation chrome at all** (0 `<main>`,
    0 `<header>`) — a real regression on ~30 out-of-scope pages, not caught by `tsc`/`eslint`/
    `test:ci` (none of which render the actual DOM). Corrected by extending the exact pattern
    already approved for `/terminal`/`/free` (Deviation 6): `app/(dashboard)/dashboard/`,
    `app/(dashboard)/alerts/{,new,[id]/edit}/`, and `app/(dashboard)/notifications/` all moved to
    top-level routes (`app/dashboard/`, `app/alerts/`, `app/notifications/`), each with its own
    minimal `layout.tsx` (auth gate + `AppearanceProvider`, no chrome — identical shape to
    `app/terminal/layout.tsx`). `app/(dashboard)/layout.tsx` restored to its exact original,
    pre-session form (`git show` against the commit before Step 1) so `/settings/*` and
    `/admin/*` are completely untouched by this session, as originally intended. URLs unaffected
    (route groups are URL-neutral). Two test files' import paths updated to match
    (`__tests__/pages/alerts/edit.test.tsx`, `__tests__/pages/notifications/
notifications-page.test.tsx`); `test:ci` re-run clean after (160/160, 2400/2400).
    Live-reverified: `/settings/appearance` chrome restored (1 main/1 header); `/dashboard`,
    `/alerts`, `/alerts/new`, `/notifications` all still render correctly under their new minimal
    layouts.

14. **Known, unresolved, disclosed defect — see `DECISION-LOG.md` F77 (OPEN).** `/alerts` and
    `/alerts/new` duplicate their client-rendered content on a genuine browser reload (2×`<main>`/
    `<header>`/`<form>` in the live DOM) — confirmed in a real production build
    (`next build && next start`), not a dev-mode/HMR/Turbopack artifact. Raw SSR HTML is verified
    clean (exactly one copy) via direct `fetch()` inspection; zero console or hydration errors at
    any point. Extensive isolation via a throwaway diagnostic route (`app/zzdiag/`, deleted before
    commit) found the real `AlertForm`/`CreateAlertClient` component reproduces it standalone, but
    so does `AlertsClient` (the `/alerts` list, which has zero fetch effects) — no single common
    trigger identified across both. Ruled out as sole causes: the tier-branching return pattern
    (fixed to a single-return ternary independently on `/alerts/new`, did not resolve it),
    `AppHeader` alone, a generic client component with one fetch effect, `loading.tsx` alone.
    **Live-verified this has a real functional consequence, not just a cosmetic one:** a test
    alert submitted through the duplicated `/alerts/new` form stored target price `25002500`
    instead of the entered `2500` — immediately deleted via the real DELETE flow, which itself
    worked correctly. Davin's live call, `AskUserQuestion`, after reviewing the full diagnostic
    trail: close this session with the defect documented rather than open-ended further
    investigation. Owner: next session touching `/alerts`, or a dedicated repair session — should
    re-verify the price-corruption finding isn't specific to this session's own testing
    methodology before treating it as a proven data-integrity risk, then continue the isolation
    process this session started (candidates: bisect `AlertForm`'s 3 `useEffect`s one at a time;
    determine what `AlertsClient` and `AlertForm` actually share since neither "tier branching"
    nor "fetch effects" cleanly explains both).

15. **`DECISION-LOG.md` crossed its ~50KB size-gate target during this session's own F77
    registration (50,308 bytes).** Not archived this session — flagged as a housekeeping item for
    the next session's own OPEN step 0, matching `LESSONS-LEARNED.md`'s L3-adjacent precedent of
    disclosing a housekeeping gap rather than silently absorbing the time cost mid-session.

16. **F21/F64 confirmed out of scope, per Davin's live resolution of the roadmap's own internal
    contradiction.** `MASTER-ROADMAP-PHASES-7-15.md`'s "Already-open flags" table lists both as
    "owed by 9-4," but its own Phase 9 session breakdown assigns closure of both to 9-5 (correctly —
    both are settings/billing surface, which 9-4 does not touch). Davin confirmed live: 9-5 closes
    them. This session's own `Flags touched: none new` stands unchanged; the roadmap document's
    table is a drafting error at its source, flagged for Davin to fix independent of this session.

---

## Next-session handoff

- **Next session:** `9-5` — `(dashboard)/settings/` 11 (UI-BUILD).
  - Scope: Port the settings layout boundary (`app/(dashboard)/settings/layout.tsx`) and all 11 settings sub-pages (account, appearance, billing, help, language, notifications, privacy, profile, security, security/activity, 2fa).
  - Owns the Protected Pages `/settings/appearance` (Protected #5) and `/settings/help` (Protected #6).
  - Owns the `settings/layout.tsx` Light Clean Mode token fixes from Gap-6e.
- **Prerequisite:** Session 9-4 CLOSED — dashboard core and workspaces live on `main`.
- **9-4 obligation carried to close:** PRE-DRAFT Session 9-5's migration order per `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`.
