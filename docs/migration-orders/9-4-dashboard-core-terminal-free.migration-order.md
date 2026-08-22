# Migration Order — Session 9-4 — `(dashboard)` core 7 + `/terminal` + `/free`

> For sessions that **build or redesign frontend surfaces**: read `00-SKELETON-AND-RULES.md`
> first — §4 applies with the dial at **High** for page-body content/layout, **Zero** on data
> (every page binds to the endpoint its 9-0 row names).
> Upgraded to full **DRAFT** by Antigravity (Advisor & Architect), 2026-08-22.
> Grounded in `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`. Exactly one
> `layout.tsx` moves this session: `app/(dashboard)/layout.tsx`.

**Session:** 9-4 · **Phase:** 9 (Frontend Stack Replacement) · **Variant:** UI-BUILD · **Status:** CONFIRMED
**Generated:** 2026-08-22 (Executor PRE-DRAFT) · **Upgraded:** 2026-08-22 (Advisor DRAFT) · **Approved:** 2026-08-22 (Davin) · **Confirmed:** 2026-08-22 (Executor)
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

- [ ] **Session 9-3 CONFIRMED, executed, CLOSED** — `(auth)` pages and `/welcome` live on `main`, route-manifest diff clean.
- [ ] **Route-map rows 49, 50, 51, 55, 56, 57, 58, 59, 62, 68 re-verified directly** against `frontend-swap-route-map.md`.
- [ ] **`app/(dashboard)/{dashboard,alerts,alerts/new,alerts/[id]/edit,notifications}` confirmed existing** and holding legacy page bodies; `app/(dashboard)/{terminal,free}/` confirmed ready for creation; `app/(dashboard)/charts*` confirmed present for retirement.
- [ ] **Live test credentials working** (PRO, FREE, ADMIN autofill buttons verified at 9-3).
- [ ] **Backing endpoints live and functional**:
  - `GET/POST /api/alerts`, `GET/PATCH/DELETE /api/alerts/[id]`
  - `GET /api/notifications`, `PATCH /api/notifications/[id]/read`
  - `GET /api/user/profile`
  - `GET /api/candles/[symbol]`
  - `GET /api/market-data/channel`
  - `GET /api/drawings`
  - `GET /api/alerts/line`
  - `GET /api/realtime/token`
- [ ] **Sequential test suite baselines green** (`LESSONS-LEARNED.md` L24):

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

- [ ] All 5 `(dashboard)` core pages + `/terminal` + `/free` live with DavinTrade branding, consuming `app/(dashboard)/layout.tsx`.
- [ ] `/dashboard`, `/terminal`, and `/free` faithfully match Protected Pages design specifications.
- [ ] Real alert CRUD, notification read states, and real chart/drawing toolbar rendering live-verified.
- [ ] Stack D/E panels render genuine empty states with zero mock data.
- [ ] Legacy `/charts` routes retired with zero dangling internal links.
- [ ] Route-manifest diff matches this session's rows and nothing else.
- [ ] `npx tsc --noEmit`, `npx eslint app components lib hooks --max-warnings 5`, and `npm run test:ci` all pass clean.

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

6. **F21/F64 confirmed out of scope, per Davin's live resolution of the roadmap's own internal
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
