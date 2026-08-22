# Migration Order — Session 9-2 — `(marketing)` 12 + `(public)` 2

> For sessions that **build or redesign frontend surfaces**: read `00-SKELETON-AND-RULES.md`
> first — §4 applies with the dial at **High** for page-body content/layout, **Zero** on data
> (every page binds to the endpoint its 9-0 row names).
> Upgraded to full **DRAFT** by Antigravity (Advisor & Architect), 2026-08-22.
> Grounded in `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`. Exactly one
> `layout.tsx` moves this session: `app/(marketing)/layout.tsx`.

**Session:** 9-2 · **Phase:** 9 (Frontend Stack Replacement) · **Variant:** UI-BUILD · **Status:** CLOSED SUCCESSFUL
**Generated:** 2026-08-22 (Executor PRE-DRAFT) · **Upgraded:** 2026-08-22 (Advisor DRAFT) · **Approved:** 2026-08-22 (Davin) ·
**Confirmed:** 2026-08-22 (Executor — codebase/runtime/flag state re-verified live; Davin confirmed the
working-copy DRAFT→APPROVED upgrade as his authentic edit, per the recurring L3 check) ·
**Closed:** 2026-08-22 (Executor — all 14 rows live, route-manifest diff clean, full baselines green)
**Final baselines:** monolith `tsc` clean · `eslint` 0 errors/5 warnings (pre-existing, none in touched files) ·
`test:ci` 160/160 suites, 2400/2400 tests · money-service 62/62 suites, 526/526 tests (1 known
`prisma.shutdown.spec.ts` SIGTERM flake, reproduced clean in isolation — same flake documented at
Session 9-0's own CONFIRM, money-service untouched this session) · operation-service 42/42 suites,
393/393 tests. Exact match to Session 9-1's own closing numbers.
**Flags touched:** none new (F65/F66 already RESOLVED at 9-0)
**Surface:** Exactly one layout boundary moves this session: `app/(marketing)/layout.tsx` (consuming `MarketingNavbar` and `MarketingFooter` from Session 9-1) + 12 marketing page bodies (`/`, `about`, `blog`, `careers`, `changelog`, `disclaimer`, `docs`, `help`, `pricing`, `privacy`, `status`, `terms`) + 2 public account deletion pages (`app/(public)/settings/account/delete/{cancel,confirm}/page.tsx`).
**Feeds on:** `MarketingNavbar`/`MarketingFooter` (built in Session 9-1), `getSystemStatus()` / `GET /api/status` (rows 84/91), `GET /api/subscription` + `STRIPE_PRO_MONTHLY_PRICE_ID` (row 69), `GET/POST /api/user/account/deletion-{cancel,confirm}` (rows 3-4), `PUBLIC_SETTINGS_PATHS` allowlist in `middleware.ts`.
**Estimated time:** ~3h - 3.5h (9S / 5M pages, comfortably under the ~4h playbook split threshold).

---

## Decisions taken

1. **Public Account Deletion Canonical Path (Resolution of Open Question 1)**
   - **Decision:** Port codebase 2's deletion page bodies into the canonical main-repo paths: `app/(public)/settings/account/delete/cancel/page.tsx` and `app/(public)/settings/account/delete/confirm/page.tsx`.
   - **What was rejected:** Creating a new un-nested `app/account/deletion-*` route outside `(public)` or changing the URLs.
   - **Rationale:** Preserves the exact public URL contract of Codebase 1 (`/settings/account/delete/confirm`, `/settings/account/delete/cancel`), matches `middleware.ts`'s `PUBLIC_SETTINGS_PATHS` allowlist, and guarantees that existing deletion links in flight in user emails resolve correctly. Record a dated addendum in `frontend-swap-route-map.md` for rows 3 & 4.
   - **Undo Cost:** Low.

2. **Pricing Page Scope & Stripe Alignment (Resolution of Open Question 2)**
   - **Decision:** Port the `/pricing` page and `TierComparison` component with its complete DavinTrade feature comparison, annual/monthly toggle, and CTAs pointing to `/register` (Free) and `/checkout` (Pro, feeding on `STRIPE_PRO_MONTHLY_PRICE_ID`).
   - **What was rejected:** Attempting full end-to-end checkout / customer portal billing verification in this session.
   - **Rationale:** Session 9-2 ships the public pricing presentation cleanly. End-to-end payment lifecycle, active plan recognition, and Stripe customer portal flows are formally cross-verified in Session 9-6 (Payments Flow Cross-Boundary).
   - **Undo Cost:** Low.

3. **Single Layout-Level Navbar/Footer Invariant (Containment of Double-Header Bug)**
   - **Decision:** `app/(marketing)/layout.tsx` exclusively renders `<MarketingNavbar />` and `<MarketingFooter />` around `{children}`. The 12 individual page bodies ported from `seed-code/` must strip their inner `<MarketingNavbar />` and `<MarketingFooter />` JSX tags.
   - **What was rejected:** Allowing individual marketing pages to render their own inner navbars/footers inside a layout that already renders them.
   - **Rationale:** Codebase 2 had flat, ungrouped marketing pages that each embedded the navbar and footer. In the main repo's layout boundary architecture, having the layout own the chrome prevents duplicate header/footer rendering (the Batch-3 defect).
   - **Undo Cost:** Low.

4. **`/status` Live Telemetry Binding (Zero Mock Data)**
   - **Decision:** Port codebase 2's telemetry UI for `/status` and bind it directly to the real `getSystemStatus()` backend function (or `GET /api/status`).
   - **What was rejected:** Shipping hardcoded mock uptime/latency numbers.
   - **Rationale:** Satisfies the Phase 9 non-negotiable (zero mock data) while delivering DavinTrade's telemetry design.
   - **Undo Cost:** Low.

5. **Account Deletion Human-in-the-Loop Safety Gate**
   - **Decision:** Retain the explicit button-click confirmation gate on `/settings/account/delete/confirm` before issuing `POST /api/user/account/deletion-confirm`.
   - **What was rejected:** Auto-executing account deletion in `useEffect` on page load.
   - **Rationale:** Prevents automated email security scanners, antivirus crawlers, and link-preview generators from accidentally deleting user accounts upon visiting the confirmation link.
   - **Undo Cost:** Low.

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §3: these 14 pages (12 marketing + 2 public) are the only pages in the application that render without an active user session. Shipping them immediately after the root shell (Session 9-1) allows complete end-to-end verification of public guest access before Session 9-3 introduces live authenticated flows.

`frontend-swap-route-map.md` assigns this session 14 rows (1-2, 3-4, 52-54, 63-64, 66, 69-70, 84-85, 91), 9 of which are static marketing content, making this session low risk and well within playbook thresholds.

---

## Entry criteria (re-verify all at CONFIRM)

- [x] **Session 9-1 CONFIRMED, executed, CLOSED** — root shell, `MarketingNavbar`/`MarketingFooter`, design tokens, and providers live on `main`.
- [x] **Route-map rows 1-2, 3-4, 52-54, 63-64, 66, 69-70, 84-85, 91 re-verified directly** against `frontend-swap-route-map.md`.
- [x] **`app/(marketing)/*` and `app/(public)/settings/account/delete/*` confirmed existing** and holding legacy page bodies.
- [x] **Backing endpoints live and functional**:
  - `GET /api/status` (or `getSystemStatus()`)
  - `GET/POST /api/user/account/deletion-confirm`
  - `GET/POST /api/user/account/deletion-cancel`
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

1. **Update `app/(marketing)/layout.tsx`**
   - Replace legacy header/footer in `app/(marketing)/layout.tsx` with `<MarketingNavbar />` and `<MarketingFooter />` from `components/marketing/`.
   - Wrap `{children}` inside `<main className="flex-1">`.
   - _Verify:_ `npx tsc --noEmit` clean; layout renders single navbar and footer.

2. **Port the 9 Static Marketing Pages (Rows 1, 2, 52, 53, 54, 63, 64, 66, 70)**
   - Port page bodies from `seed-code/` into existing route files:
     - `app/(marketing)/page.tsx` (`/` — Landing page content)
     - `app/(marketing)/about/page.tsx` (`/about`)
     - `app/(marketing)/blog/page.tsx` (`/blog`)
     - `app/(marketing)/careers/page.tsx` (`/careers`)
     - `app/(marketing)/changelog/page.tsx` (`/changelog`)
     - `app/(marketing)/disclaimer/page.tsx` (`/disclaimer`)
     - `app/(marketing)/docs/page.tsx` (`/docs`)
     - `app/(marketing)/help/page.tsx` (`/help`)
     - `app/(marketing)/privacy/page.tsx` (`/privacy`)
     - `app/(marketing)/terms/page.tsx` (`/terms`)
   - Remove any duplicate inner `<MarketingNavbar />` / `<MarketingFooter />` tags from the ported page bodies.
   - _Verify:_ All 9 pages compile cleanly with `npx tsc --noEmit` and render DavinTrade brand copy.

3. **Port and Bind `/status` (Rows 84, 91)**
   - Port codebase 2's telemetry status UI into `app/(marketing)/status/page.tsx`.
   - Bind component health checks to real data from `getSystemStatus()` / `GET /api/status` (database, Redis, microservice health).
   - _Verify:_ Visiting `/status` renders real system health status, not static mock values; refresh button triggers telemetry reload.

4. **Port `/pricing` (Row 69)**
   - Port `components/pricing/tier-comparison.tsx` and `app/(marketing)/pricing/page.tsx`.
   - Ensure Free tier CTA links to `/register` and Pro tier CTA links to `/checkout`.
   - Ensure pricing values and feature lists reflect DavinTrade tier limits (`lib/tier-config.ts`).
   - _Verify:_ `/pricing` renders monthly/annual toggle with correct currency formatting via `useLocale()`.

5. **Port the 2 `(public)` Account Deletion Pages (Rows 3, 4)**
   - Port codebase 2's page styling into `app/(public)/settings/account/delete/cancel/page.tsx` and `app/(public)/settings/account/delete/confirm/page.tsx`.
   - Ensure human-in-the-loop button gate is preserved on confirmation page.
   - Bind actions to `POST /api/user/account/deletion-cancel` and `POST /api/user/account/deletion-confirm`.
   - _Verify:_ Pages render cleanly unauthenticated without session redirects (`PUBLIC_SETTINGS_PATHS` in `middleware.ts`).

6. **Route-Manifest Diff & Non-Login Verification**
   - Verify route-manifest diff: exactly the 14 routes in scope are modified, zero stray routes created or dropped.
   - Run live dev server smoke test across all 14 routes for `NON-LOGIN` guest visitors.
   - _Verify:_ Sequential test suites pass:
     ```powershell
     npx tsc --noEmit
     npx eslint app components lib hooks --max-warnings 5
     npm run test:ci
     ```

---

## Rules specific to this variant

- **UI Creativity:** High for page-body layout, typography, and interactive presentation.
- **Zero Mock Data:** Every page with dynamic data (`/status`, deletion pages) binds to its real backing API/function.
- **No Protected Pages in Scope:** None of the 6 Protected pages are touched in this session.
- **Accessibility:** Semantic HTML tags, accessible form controls, and WCAG AA contrast on all marketing surfaces.
- **Record Design Decisions:** Document all layout adaptations and component adjustments in the Deviations section at close.

---

## Done when

- [x] All 12 `(marketing)` pages and 2 `(public)` account deletion pages live with DavinTrade branding, consuming `MarketingNavbar`/`MarketingFooter` from `app/(marketing)/layout.tsx`.
- [x] No double-navbar or double-footer rendering exists on any marketing page.
- [x] `/status` renders real system telemetry from `getSystemStatus()`.
- [x] `/pricing` renders DavinTrade tier comparisons with functioning `/register` and `/checkout` CTAs.
- [x] Both account deletion pages verified accessible to unauthenticated guests and bound to real deletion endpoints.
- [x] Route-manifest diff matches this session's 14 rows and nothing else.
- [x] `npx tsc --noEmit`, `npx eslint app components lib hooks --max-warnings 5`, and `npm run test:ci` all pass clean.

---

## Rollback

`git revert` of this session's commits. Prefer one commit per logical step (layout update, static pages, status, pricing, deletion pages) so individual steps can be isolated if needed.

---

## Deviations

1. **L3 pattern recurrence (21st+), confirmed benign.** Committed `HEAD` at CONFIRM held the
   bare PRE-DRAFT stub (`Status: PRE-DRAFT`, two open questions); working copy held the full
   DRAFT→APPROVED text. Davin confirmed live it was his authentic edit before any of it was
   trusted, same as every prior recurrence.

2. **Route-map addendum for rows 3-4, in scope per Davin's go-ahead.** `frontend-swap-route-
map.md` §3 now carries a dated addendum recording `app/(public)/settings/account/delete/
   {cancel,confirm}/page.tsx` as the canonical main-repo target — the table's own stale
   `app/account/deletion-*` citation (from Session 9-0's build) is left as historical record,
   not edited.

3. **Landing page (row 1) needed far more than a content swap — found and resolved live,
   with Davin's explicit sign-off before touching any file.** Seed-code's landing page is a
   6-component composition (`TickerTape`/`LandingHero`/`LandingFeatures`/`LandingPricing`,
   ~43KB, none of it in the main repo yet) using its OWN `LandingNavbar`/`LandingFooter` —
   different components from the `MarketingNavbar`/`MarketingFooter` the other 11 pages use and
   the layout now renders. Porting it as literally described would have quadruple-stacked
   chrome, the exact bug Decision 3 exists to prevent, from the opposite direction (a page
   bringing its own distinct navbar, not a duplicate of the shared one). Escalated via
   `AskUserQuestion`; Davin chose "strip chrome, keep affiliate pricing." Implemented as
   `components/landing/*` (no `LandingNavbar`/`LandingFooter`), `TickerTape`/`LandingHero`/
   `LandingFeatures` ported near-verbatim as page-body content.

4. **Real, database-backed affiliate pricing found on the CURRENT landing page, entirely
   absent from seed-code's replacement — grafted forward, not dropped.** The live
   `app/(marketing)/landing-content.tsx` (retired this session) called `useAffiliateConfig()`
   (SWR-backed, `SystemConfig`-sourced) to render a `?ref=CODE`-driven discount banner +
   discounted price + commission calc — a genuine, revenue-linked feature affiliate links in
   circulation depend on. Seed-code's `LandingPricing` component had zero equivalent wiring:
   fully static `$0`/hardcoded-PRO-price cards. Grafted the real wiring into the new
   `LandingPricing` component's visual design. Live-verified via dev server: plain `/` shows
   $29.00/mo (the live `SystemConfig` default, not seed-code's hardcoded $49); `/?ref=TESTCODE`
   shows the discount banner and correct strikethrough $29.00 → $23.20 (live 20% default).

5. **`components/chat-widget/*`-dependent UI dropped from 3 ported surfaces, not just
   `/help`'s own step.** Session 9-1 deliberately deferred the seed-code support-chat widget to
   Phase 14 (its socket client points at an unset env var and falls back to a canned-response
   generator) and shipped `ClientProviders` without it. That decision's consequence reached
   further than 9-1's own order anticipated: seed-code's `/help` page and `landing-hero.tsx`
   BOTH call `useSupportChat()`/`openChatWithMessage()` — a hook with no provider in the tree.
   Neither was ported as-is. `/help`'s "Live Conversational AI Support" card is replaced with a
   second real `mailto:` channel; `landing-hero.tsx`'s entire chat-wired "Support Centre" input
   sandbox (textarea + quick-reply chips + launch button) is dropped, keeping the headline/CTA/
   trust-indicator/hero-image content around it.

6. **Missing asset found and copied, not just referenced.** `landing-hero.tsx` requires
   `/davintrade-landing-page_home.png` — present in `seed-code/public/` (10.3 MB) but never
   copied into the main repo's `public/`. Copied as-is; no re-compression attempted (out of
   scope).

7. **`/status`: seed-code's visual design ported, its data was not — a second, more serious
   Zero-Mock-Data catch than Decision 4 anticipated.** Decision 4 already flagged the risk of
   shipping mock uptime/latency; live reading of seed-code's `status/page.tsx` showed it goes
   further than a generic risk — it hardcodes 6 fabricated components (MT5 Feed Gateway,
   WebSocket Pipeline, Davin AI Engine, Postgres/TimescaleDB, Stripe/dLocal, Wise/RiseWorks),
   each with an invented static latency/uptime number, all permanently "OPERATIONAL," behind a
   refresh button that only faked a spinner. Bound instead to the real 4 components
   `getSystemStatus()` actually checks (API/Database/Realtime/Payment Gateways) and their real
   `detail` strings; new `StatusRefreshButton` calls `router.refresh()` for a genuine reload.
   Live-verified: this dev environment's real status correctly renders "Some Systems Are
   Degraded" (operation-service unreachable, one payment provider unconfigured) — not a
   fabricated "All Systems Operational" — and the refresh click re-ran a real `SELECT 1` +
   server re-fetch.

8. **`/pricing` + `TierComparison`: same fabricated-data pattern found a third time this
   session, at higher stakes (a paid feature list, not a status page).** Seed-code's
   `tier-comparison.tsx` hardcoded PRO at $39/$49 with zero live binding, and its detailed
   feature-comparison table advertised Stack D/E capabilities (multi-model AI chat, quad-RAG
   queries, a 500,000-token quota, a live market-comments feed) that are Phase 12/13 work —
   this repo has "zero LLM SDKs, no VANNA, no txtai" per `MASTER-ROADMAP-PHASES-7-15.md`.
   Shipping that table would have advertised non-existent product capabilities to paying
   customers. Per Davin's explicit instruction at CONFIRM, bound price to `lib/tier-config.ts`'s
   `PRO_MONTHLY_PRICE` (the tier system's own single source of truth) via
   `useLocale().formatCurrency`, and replaced the feature list with the real V8 single-symbol
   entitlements (0/100 alerts, 60/300 req-hr, drawing-engine line alerts, multi-timeframe
   visualization, notifications, export, support) — the same substance the component this
   replaces already had. No separate annual Stripe Price ID exists (`app/api/checkout/route.ts`
   has no billing-cycle parameter), same as the component this replaces — the annual figure
   stays informational (price × 10 months); fixed its "SAVE 20%" badge to a dynamically computed
   percentage (17%) rather than a number that didn't match the underlying math. FREE/PRO CTAs
   route to `/register`/`/checkout` per Decision 2, not seed-code's own `/free` link choice.

9. **Account-deletion pages: visuals restyled, safety-critical logic byte-for-byte
   preserved.** Both existing pages already correctly implement Decision 5's own requirement
   (confirm has a human-in-the-loop button gate; cancel's dual-mode token-or-session auto-fire
   is safe because cancellation is non-destructive) — this predates the order and needed no
   fixing, only restyling. Seed-code's own confirm page auto-executes the deletion in a
   `useEffect` on mount with zero confirmation step; explicitly NOT ported. Live-verified: the
   confirm page renders the gate and fires ZERO `deletion-confirm` calls until clicked; the
   cancel page's auto-fire still POSTs (observed failing gracefully to a styled error state in
   this dev environment only because `operation-service` isn't running — `ECONNREFUSED`, not a
   page defect).

10. **Route-manifest diff: clean.** `git diff --stat` across every code commit this session
    shows only the 14 route-map rows' own page files (about/blog/careers/changelog/disclaimer/
    docs/help/privacy/terms/status/pricing/`/`/2 account-deletion pages) plus their non-route
    component/asset dependencies (`components/landing/*`, `components/pricing/tier-
comparison.tsx`, `components/marketing/status-refresh-button.tsx`,
    `davintrade-landing-page_home.png`). Zero page files created or dropped outside this
    session's own 14 rows.

11. **Candidate lesson, not written to `LESSONS-LEARNED.md` — file is at its 40-entry cap and
    the header itself says the next lesson needs a consolidation pass first.** The same pattern
    recurred 3 times in this single session (landing pricing, `/status`, `/pricing` tier
    comparison): a seed-code page that reads as "just needs restyling" turns out to either lack
    live-data wiring (`useAffiliateConfig`/`SystemConfig`) the main repo's existing version has,
    or fabricate entirely new dynamic-looking content (status telemetry, AI feature claims) with
    no backing implementation. Candidate rule: **before treating any seed-code page as a visual-
    only port, grep both trees for `useSWR`/`fetch(`/`useSearchParams`/hook imports the target
    page's CURRENT main-repo version has and seed-code's replacement doesn't (or vice versa) —
    a "prettier" page can silently regress real functionality or fabricate fake functionality in
    either direction.** Flagging for the Advisor's attention at the next `LESSONS-LEARNED.md`
    consolidation pass rather than writing a 41st entry over the file's own hard cap.

---

## Next-session handoff

- **Next session:** `9-3` — `(auth)` 7 + `welcome` (UI-BUILD).
  - Scope: Port the 7 auth pages (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-2fa`, `/verify-email`, `/verify-email/pending`) and `/welcome` under `app/(auth)/layout.tsx`.
  - Binds to live NextAuth credentials/Google providers, 2FA endpoints, and onboarding profile APIs.
  - **Unblocks live authenticated testing for all subsequent Phase 9 sessions.**
- **Prerequisite:** Session 9-2 CLOSED — all 14 marketing/public pages live on `main`.
- **9-2 obligation carried to close:** PRE-DRAFT Session 9-3's migration order per `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`.
