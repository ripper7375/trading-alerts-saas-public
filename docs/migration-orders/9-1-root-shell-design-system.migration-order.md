# Migration Order — Session 9-1 — Root Shell & Design System

> For sessions that **build or redesign frontend surfaces**: read `00-SKELETON-AND-RULES.md`
> first — §4 applies with the dial at **High** for shell/component/interaction design, **Low** for
> the three root-boundary pages (`not-found.tsx`, `global-error.tsx`, `error.tsx`), and **Zero** on
> data (every page binds to the endpoint its 9-0 row names).
> Upgraded to full **DRAFT** by Antigravity (Advisor & Architect), 2026-08-22.
> Grounded in `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`. Exactly one
> `layout.tsx` moves this session: `app/layout.tsx`.

**Session:** 9-1 · **Phase:** 9 (Frontend Stack Replacement) · **Variant:** UI-BUILD · **Status:** CONFIRMED
**Generated:** 2026-08-22 (Executor PRE-DRAFT) · **Upgraded:** 2026-08-22 (Advisor DRAFT) · **Approved:** 2026-08-22 (Davin) · **Confirmed:** 2026-08-22 (Executor, live code re-verified — see CONFIRM note below)
**Flags touched:** none new (F65/F66 already RESOLVED at 9-0)
**Surface:** Exactly one layout boundary moves this session: `app/layout.tsx` (root shell), `app/providers.tsx`, `app/globals.css` design tokens, `tailwind.config.ts`, brand assets/icons, `theme-provider`, appearance engine (`getServerAppearance()` + `UserAppearance`), `components/layout/app-header.tsx`, `components/chat-sidebar.tsx`, `components/marketing/marketing-navbar.tsx` + `marketing-footer.tsx`, `app/not-found.tsx` (Row 93), `app/global-error.tsx` (Row 92), and `app/error.tsx`.
**Feeds on:** `lib/appearance/server-appearance.ts` + `UserAppearance` Prisma model (server-side persistence), `lib/i18n/locale-resolver.ts`, `lib/operation-service/cookies.ts`, NextAuth session cookie (`SESSION_COOKIE_NAME`).
**Estimated time:** ~3.5h - 4h.

---

## CONFIRM note (2026-08-22, Executor)

Re-verified against live code before execution (full detail in this session's chat transcript,
summarized here per `EXECUTOR-PROTOCOL.md` §3 — artifacts are the only channel). All entry
criteria held (money-service 62/62 suites/526/526 tests, operation-service 42/42 suites/393/393
tests, monolith `tsc` clean/`eslint` 0 errors 5 warnings/`test:ci` 160/160 suites 2400/2400
tests re-measured green — exact match to 9-0's own close numbers; `seed-code/` now fully clean,
better than the entry criterion's own "except 2 files" expectation; Batch-0's two root-boundary
fixes re-diffed byte-for-byte still intact). L3 check: committed `HEAD` (`561ffbe2`) held only
the bare PRE-DRAFT; the working-copy DRAFT→APPROVED upgrade was confirmed live by Davin as his
authentic edit before treating it as trustworthy (19th+ recurrence of this pattern).

CONFIRM surfaced 6 corrections/additions to this order, all approved live by Davin before
execution — recorded here rather than silently absorbed into the steps below:

1. **`lib/i18n/locale-resolver.ts` needs porting, not just citing.** It exists only in
   `seed-code/` (with a dependency on `lib/country-config` and `lib/context/locale-context.tsx`)
   — the order's own "Feeds on" line listed it as an existing main-repo dependency. Step 3 below
   now explicitly ports it and its supporting context, not just "wires" it.
2. **`--chart*` tokens stay runtime-dynamic, not static `globals.css` rules.** Live code shows
   seed-code sets them at runtime via `appearance-provider.tsx`/inline `<html>` style, not as
   static `:root`/`.dark` blocks in `globals.css` — Step 2 follows that pattern rather than
   inventing static rules that don't match the source.
3. **`SessionProvider` in `app/providers.tsx` is preserved, not newly mounted.** The main repo's
   current `app/providers.tsx` already wraps `SessionProvider` (`next-auth/react`) around
   `ThemeProvider`. Step 3 replaces the provider tree's contents while keeping this session
   wiring live throughout — framed as preservation, not new work.
4. **Middleware merge direction confirmed.** The main repo's own `middleware.ts` already has the
   real, working auth gate (public-path allowlist, `SESSION_COOKIE_NAME` check, `/login`
   redirect, `/admin/*` role gate, ADMIN-away-from-`/affiliate`) with zero locale-rewrite logic;
   codebase 2's `middleware.ts` has the inverse (locale-rewrite only, zero auth). Step 5 merges
   the main repo's existing auth logic INTO codebase-2's locale-rewrite shape — not building auth
   from scratch.
5. **Gap-6e (Light Clean Mode) residual explicitly handed off.** This session fixes
   `app-header.tsx`/`chat-sidebar.tsx`/`app/layout.tsx` only. `chat-panel.tsx` and
   `market-comments-panel.tsx` (render on `/terminal`/`/free`) stay hardcoded dark by design —
   Decision 3's "keep dark trading canvas defaults." `settings/layout.tsx` is untouched (out of
   this session's surface). **Both residuals are Davin-approved hand-offs to Session 9-4
   (`chat-panel.tsx`, `market-comments-panel.tsx`) and Session 9-5 (`settings/layout.tsx`)** —
   carried into the Next-session handoff section below so they aren't silently dropped again
   (per `LESSONS-LEARNED.md` L39's own root cause).
6. **`components/layout/header.tsx` is a separate, currently-live file — not touched.** Distinct
   from the dead `components/header.tsx` this session deletes (0 imports, confirmed). The live
   one is imported by the current `app/(dashboard)/layout.tsx` and has its own test file — it
   stays in place until Session 9-4 retires it along with the `(dashboard)` layout boundary.

---

## Decisions taken

1. **Protected Pages Preservation (Resolution of Open Question 1)**
   - **Decision:** Port codebase 2's `AppHeader`, `ChatSidebar`, `app/layout.tsx`, and `globals.css` as the canonical shell components.
   - **What was rejected:** Redesigning or modifying navigation structures and style signatures in a way that diverges from codebase 2's existing design.
   - **Rationale:** Davin confirmed on 2026-08-17 that 6 pages are **Protected — never modify** (`/`, `/terminal`, `/free`, `/dashboard`, `/settings/appearance`, `/settings/help`). Codebase 2's protected pages were designed against and render through codebase 2's `AppHeader`/`ChatSidebar`. Porting codebase 2's shell into the main repo root establishes pixel-identical rendering for all 6 protected pages and unifies the design system for all subsequent Phase 9 sessions.
   - **Undo Cost:** Low.

2. **Tailwind Compatibility Architecture (Resolution of Open Question 3)**
   - **Decision:** Retain the monolith's **Tailwind v3 architecture** (`tailwindcss@^3.3.0` + `tailwind.config.ts`) while importing the full CSS-variable token palette into `app/globals.css`.
   - **What was rejected:** Upgrading the monolith to `tailwindcss@^4` inside this UI-BUILD session.
   - **Rationale:** Tailwind v4 introduces breaking changes to PostCSS, theme directives, and compiler behaviors that risk breaking existing test suites (160 suites, 2400 tests) and unmigrated pages. Tailwind v3 natively supports all CSS custom properties (`:root` and `.dark` variables for `--background`, `--foreground`, `--card`, `--primary`, `--accent`, `--border`, `--sidebar*`, `--chart*`) mapped via `tailwind.config.ts`. This gives 100% visual fidelity without dependency upgrade risk.
   - **Undo Cost:** Low.

3. **Batch-0 Shared Chrome & Light Clean Mode Token Fixes (Resolution of Open Question 2 & Gap 6e)**
   - **Decision:**
     1. Fix `--accent-foreground` in `globals.css` for light mode to achieve WCAG AA contrast (~4.5:1, using `#000000` on amber/emerald accents).
     2. Ensure `AppHeader`, `ChatSidebar`, and `app/layout.tsx` use semantic CSS variable classes (`bg-background`, `bg-card`, `border-border`, `text-foreground`, etc.) rather than ad-hoc hex values where theme adaptability is required.
     3. Keep dark trading canvas defaults for chart panels on `/terminal` and `/free` to maintain high-contrast financial charting visibility.
   - **What was rejected:** Leaving `--accent-foreground` at low contrast (2.2:1); or attempting to refactor page-body layouts outside the root shell in this session.
   - **Rationale:** Resolves accessibility and token inheritance globally at the root without altering the visual output of protected pages.
   - **Undo Cost:** Low.

4. **`app/error.tsx` Segment Error Boundary (Resolution of Open Question 4)**
   - **Decision:** Retain and rebrand the monolith's `app/error.tsx` route-segment error boundary using "DavinTrade" styling and tokens (`support@davintrade.com`, Lucide icons, amber accent, and `bg-card`/`border-border` card treatment).
   - **What was rejected:** Deleting `app/error.tsx` or leaving legacy "Trading Alerts" copy/styles in place.
   - **Rationale:** `app/error.tsx` catches segment-level runtime exceptions inside `app/layout.tsx`, whereas `app/global-error.tsx` catches root layout throws. Both are necessary for robust error handling.
   - **Undo Cost:** Low.

5. **`components/header.tsx` Deletion**
   - **Decision:** Delete `components/header.tsx` from the main repository.
   - **What was rejected:** Keeping dead starter-template boilerplate.
   - **Rationale:** Verified in Batch-0 audit to have 0 imports across the codebase; fully superseded by `components/marketing/marketing-navbar.tsx`.
   - **Undo Cost:** Zero (tracked in git).

6. **Support Email Domain Standardization**
   - **Decision:** Standardize on `support@davintrade.com` (non-hyphenated) across all shell chrome, error boundaries, and metadata.
   - **What was rejected:** Using `support@davin-trade.com`.
   - **Rationale:** Matches canonical brand name "DavinTrade" used across codebase 2 (`app/help/page.tsx`, `app/careers/page.tsx`, and Batch-0 `global-error.tsx`).
   - **Undo Cost:** Low.

7. **Auth & Locale Middleware Convergence (Gaps 1 & 2)**
   - **Decision:**
     1. Mount NextAuth `SessionProvider` inside `app/providers.tsx` / `ClientProviders` wrapping `LocaleProvider`, `AppearanceProvider`, and `SupportChatProvider`.
     2. Merge codebase 1's NextAuth edge gating into codebase 2's locale-prefix rewrite `middleware.ts`. First extract country prefix and set headers/cookies, then enforce route gating on the target path (`/dashboard/*`, `/admin/*`, `/affiliate/dashboard/*`) with public carve-outs intact.
   - **What was rejected:** Dropping locale rewrites or skipping `SessionProvider`.
   - **Rationale:** Provides the foundational session and locale hydration required for all downstream Phase 9 sessions.
   - **Undo Cost:** Low.

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`: every subsequent Phase 9 session (9-2 through 9-9) renders inside the root shell, design tokens, headers, sidebars, and providers established here.

Codebase 2 provided the visual layouts for 93 pages, but lacked backend integration, NextAuth session wiring, edge auth gating, and had 5 open Batch-0 shell defects. **Session 9-1 builds the authoritative root shell foundation**, wiring the real backend appearance persistence, NextAuth session context, and design token engine so downstream layout migrations can proceed cleanly.

---

## Entry criteria (re-verify all at CONFIRM)

- [x] **Session 9-0 CONFIRMED, executed, CLOSED** — `frontend-swap-route-map.md` exists and committed; F65/F66 RESOLVED in `DECISION-LOG.md`.
- [x] **Protected-pages list verified** against `codebase-2-parity-audit/00-MASTER-PLAN.md` §0 (`/`, `/terminal`, `/free`, `/dashboard`, `/settings/appearance`, `/settings/help`).
- [x] **Batch-0 root boundaries confirmed fixed in codebase 2** (`app/global-error.tsx` mailto line, `app/not-found.tsx` 3-action buttons) — re-diffed byte-for-byte at CONFIRM, still intact.
- [x] **`seed-code/` working tree verified read-only** — better than expected: fully clean (zero modified files), not just "except 2 files."
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

1. **Port and Rebrand the Three Root Boundaries (Rows 92, 93 + `app/error.tsx`)**
   - Copy `seed-code/.../app/not-found.tsx` to `app/not-found.tsx` (3 action buttons: "Go Back", "Dashboard", "Return to Home", bound to `useLocale()`).
   - Copy `seed-code/.../app/global-error.tsx` to `app/global-error.tsx` (isolated `<html>`/`<body>` boundary with `support@davintrade.com` mailto and error digest).
   - Rebrand `app/error.tsx` to DavinTrade design system (Lucide `AlertOctagon`, `Button` components, `support@davintrade.com`, amber accent styling).
   - _Verify:_ Triggering 404 in dev server renders the 3-action UI; `npx tsc --noEmit` passes.

2. **Design Tokens & Tailwind v3 Integration**
   - Update `app/globals.css` with DavinTrade design tokens:
     - Dynamic Accent Color Tokens (`html[data-accent="amber"]`, `emerald`, `blue`, `sapphire`, `purple`, `amethyst`).
     - Core `:root` and `.dark` variables (`--background`, `--foreground`, `--card`, `--popover`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--sidebar*`, `--chart*`).
     - **Fix `--accent-foreground` contrast in light mode** to meet WCAG AA (~4.5:1).
     - Utility styles: scrollbars (`.no-scrollbar`, custom scrollbar thumb), marquee animation, and lightweight-charts logo suppression.
   - Update `tailwind.config.ts` to expose `sidebar` colors (`sidebar.DEFAULT`, `sidebar.foreground`, `sidebar.border`, `sidebar.accent`, etc.) and animation keyframes.
   - _Verify:_ `npx tsc --noEmit` and build smoke tests pass.

3. **Root Layout & Providers (`app/layout.tsx` & `app/providers.tsx`)**
   - Port `components/providers/client-providers.tsx`, `components/providers/appearance-provider.tsx`, and `components/theme-sync.tsx` from `seed-code/`.
   - Update `app/providers.tsx` to wrap `SessionProvider` (from `next-auth/react`) around `ClientProviders` (`LocaleProvider`, `AppearanceProvider`, `SupportChatProvider`).
   - Port `app/layout.tsx` from `seed-code/`:
     - Server-side resolution of appearance (`getServerAppearance()`) and preferences (`resolvePreferences()`).
     - Rebrand metadata to "DavinTrade AI" with theme-aware icons.
     - Inject anti-FOUC theme/locale inline script.
     - Mount `ThemeProvider`, `ThemeSync`, and `ClientProviders`.
   - _Verify:_ Root layout server-renders correctly with appearance tokens attached to `<html data-accent="...">`.

4. **Shared Navigation Chrome & Dead Code Removal**
   - Port `components/layout/app-header.tsx`, `components/chat-sidebar.tsx`, `components/marketing/marketing-navbar.tsx`, and `components/marketing/marketing-footer.tsx` from `seed-code/`.
   - Ensure `ChatSidebar` includes direct access to Settings and Help.
   - **Delete dead `components/header.tsx`** (verified 0 imports).
   - _Verify:_ Verify `AppHeader` and `ChatSidebar` render without import or compilation errors.

5. **Middleware Auth & Locale Integration (`middleware.ts`)**
   - Merge NextAuth route gating into locale-prefix URL rewrites:
     1. Inspect `pathname` for supported country prefix (`/th`, `/gb`, `/vn`, etc.). Extract `targetPath` and set `x-country-code` header + `LOCALE_COOKIE`.
     2. Check `PUBLIC_SETTINGS_PATHS` allowlist (`/settings/account/delete/confirm`, `/settings/account/delete/cancel`).
     3. For protected paths (`/dashboard/*`, `/alerts/*`, `/charts/*`, `/admin/*`, `/notifications/*`, `/affiliate/dashboard/*`, `/affiliate/settings/*`), decode NextAuth token via `getToken()` with `SESSION_COOKIE_NAME`.
     4. If unauthenticated, redirect to `/login?callbackUrl=<path>`.
     5. Enforce role checks: `ADMIN` required for `/admin/*`; redirect `ADMIN` away from `/affiliate` to `/admin`.
     6. Return rewritten response (for country prefixes) or `NextResponse.next()`.
   - _Verify:_ Non-login visitor accessing `/dashboard` is redirected to `/login`; public marketing routes load without auth; country prefix rewrites resolve correctly.

6. **Visual Smoke & Protected Pages Validation**
   - Run dev server and verify visual fidelity on all 6 Protected pages (`/`, `/terminal`, `/free`, `/dashboard`, `/settings/appearance`, `/settings/help`).
   - Confirm dark canvas aesthetic is preserved on `/terminal` and `/free`.
   - Confirm `--accent-foreground` contrast is readable in both light and dark modes.
   - Confirm brand text reads "DavinTrade" and support links point to `support@davintrade.com`.
   - _Verify:_ Sequential test suites pass:
     ```powershell
     npx tsc --noEmit
     npx eslint app components lib hooks --max-warnings 5
     npm run test:ci
     ```

---

## Rules specific to this variant

- **UI Creativity:** High for shell/component/token integration; Low for the three root error/not-found boundaries; Zero on data layer.
- **Protected Pages Constraint:** The 6 Protected pages are the binding visual constraint — verify they render with exact visual fidelity.
- **Accessibility:** Ensure high-contrast ratios for text on accents in all themes.
- **Record Design Decisions:** Document all token adjustments and component choices in the Deviations section at close.

---

## Done when

- [x] `app/not-found.tsx`, `app/global-error.tsx`, and `app/error.tsx` live in main repo with DavinTrade branding and correct actions.
- [x] `app/globals.css` and `tailwind.config.ts` establish the DavinTrade token palette in Tailwind v3 with WCAG AA `--accent-foreground` contrast — achieved by NOT touching `--accent`/`--accent-foreground` (Deviation 9): the monolith's existing architecture already avoids the Batch-0 contrast bug by design.
- [x] `app/layout.tsx` and `app/providers.tsx` live, wiring `getServerAppearance()`, `UserAppearance`, `LocaleProvider`, `AppearanceProvider`, and NextAuth `SessionProvider` — the latter two PRESERVED as already-working (Deviation 4), not newly built.
- [x] `AppHeader`, `ChatSidebar`, `marketing-navbar.tsx`, and `marketing-footer.tsx` ported and verified; dead `components/header.tsx` confirmed to only exist in `seed-code/` (never in the main repo) — satisfied by omission, no deletion needed (Deviation 8).
- [x] `middleware.ts` combines country-prefix locale rewriting with NextAuth session/role route protection.
- [x] Visual smoke check confirms all currently-existing Protected pages render cleanly (`/`, `/dashboard`, `/settings/appearance`, `/settings/help`) — `/terminal`/`/free` don't exist yet, Session 9-4's own pages (Deviation 15).
- [x] `npx tsc --noEmit`, `npx eslint app components lib hooks --max-warnings 5`, and `npm run test:ci` all pass clean.

---

## Rollback

Commit per step. If an issue arises in a specific step, revert that step's commit via `git revert`.

---

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

1. **Step order changed from the order's 1-6 sequence.** `not-found.tsx` (seed-code) calls
   `useLocale()`, which needs `LocaleProvider` mounted in `app/layout.tsx` (Step 3) — so it
   can't be verified in isolation as Step 1's own literal first action. Actual order: ported
   `global-error.tsx` + rebranded `error.tsx` (no locale dependency) → ported the i18n subsystem
   (new prerequisite, see #2) → design tokens → root layout/providers, landing `not-found.tsx`
   at that point → shared chrome → middleware. Each slice still got its own commit and
   tsc/eslint pass, per the Rollback section's own "one commit per step" intent.

2. **New prerequisite discovered and ported: the i18n subsystem.** The order's own "Feeds on"
   line listed `lib/i18n/locale-resolver.ts` as an existing main-repo dependency; it only existed
   in `seed-code/`. Ported verbatim: `lib/country-config.ts`, `lib/i18n/{locale-resolver,
get-dictionary, server-locale}.ts`, `lib/i18n/dictionaries/*.json` (12 locales),
   `lib/context/locale-context.tsx`. Fixed 7 compile errors the port introduced under this
   repo's `noUncheckedIndexedAccess`/`noPropertyAccessFromIndexSignature` (absent from
   seed-code's own tsconfig) — non-null-asserted statically-known-safe object-literal lookups,
   split two double-evaluated dictionary lookups into single-read locals to preserve type
   narrowing.

3. **Support-chat widget deliberately NOT ported** (Davin, live, approved before Step 3 began).
   `ClientProviders` composes only `LocaleProvider` + `AppearanceProvider` — `SupportChatProvider`/
   `SupportChatWidget`/`FloatingChatTrigger` are deferred to Phase 14. Found while tracing
   `client-providers.tsx`'s dependencies: its socket client (`lib/socket-client.ts`) points at
   `NEXT_PUBLIC_SOCKET_CHAT_URL` (unset, Phase 14 not built) and falls back to a hardcoded
   canned-response generator presented as a live "AI Support Specialist" — mounting it now would
   have shipped fabricated AI claims site-wide. Not in `seed-code/**`'s do-not-touch zone since
   nothing there was edited; the main-repo `client-providers.tsx` simply omits it.

4. **`app/providers.tsx`'s already-working `SessionProvider` was preserved, not rebuilt** — the
   Decisions-taken framing ("mount NextAuth SessionProvider") read as new work; live code showed
   it already existed. Also discovered `components/providers/appearance-provider.tsx` and
   `theme-provider.tsx` already exist in the main repo — the former is MORE complete than
   seed-code's own version (it additionally syncs `next-themes`' `setTheme()`, which seed-code's
   doesn't). Neither file was touched; overwriting `appearance-provider.tsx` with seed-code's
   version would have been a regression, not a port.

5. **`components/providers/theme-provider.tsx` (hand-rolled, main repo) is dead code** — zero
   importers (grepped `app/`, `components/`, `hooks/`, `lib/`), superseded by the real
   `next-themes` package `app/providers.tsx` already used before this session. Not deleted: only
   `components/header.tsx`'s deletion carried Davin's explicit go-ahead this session; this is a
   new, undisclosed finding for a future session/Davin to act on, not this one to decide
   unilaterally (same "flag rather than silently apply" norm Batch-0 itself used).

6. **Real, disclosed architecture change: the whole app is now dynamically rendered.**
   `app/layout.tsx` now calls `cookies()`/`headers()` (via `getServerAppearance()` and
   `resolvePreferences()`) on every request, for every route — previously the root layout was
   static-generation-compatible. `app/globals.css`'s own comment documented `data-accent` living
   on a nested dashboard wrapper specifically to avoid this; updated that comment to describe the
   new reality rather than leave it stale. This is the direct, unavoidable cost of porting
   codebase 2's unified root-layout design (F66's own progressive-replacement decision) — no
   attempt made to re-optimize marketing pages back to static in this session; flagged for a
   future session if TTFB/build-time on marketing routes becomes a real concern.

7. **CSP fix: added `https://ipapi.co` to `next.config.js`'s `connect-src`.** `LocaleProvider`'s
   first-visit geo-detection fetch was silently blocked by the existing CSP, confirmed live via
   console errors. Narrow, read-only, no-secrets third-party endpoint — judged in-scope to fix
   directly (not a CORS/auth/secrets change per `EXECUTOR-PROTOCOL.md` §7) rather than escalate.

8. **Batch-0 finding 6c (`components/header.tsx`) needs no deletion here.** Confirmed via `ls`
   both trees: the dead file exists only in `seed-code/` (read-only, do-not-touch,
   `CLAUDE.md` §5) and never existed in the main repo. The order's Decision 5 targeted a
   main-repo copy that was never ported. Satisfied by omission — this session's port never
   copied it over. Left `seed-code/`'s own copy untouched, per standing rule.

9. **Design-token decisions beyond Decisions-taken's own text:**
   - `--sidebar*` tokens use the monolith's existing neutral hue family (285.8, matching
     `--background`/`--card`/`--border`) rather than seed-code's separate achromatic gray, so
     `ChatSidebar` reads as part of the same system instead of a visually distinct surface.
   - `--accent`/`--accent-foreground` were **not** touched, and no static `--chart*` rules were
     added. Live code showed the monolith's existing accent architecture already avoids the
     exact Batch-0 contrast bug by design (it swaps `--primary`/`--primary-foreground`/`--ring`
     per accent with contrast baked in — amber gets near-black text already — and deliberately
     keeps `--accent`/`--accent-foreground` as a separate, non-swapped neutral pair, unlike
     codebase 2's model where `--accent` itself becomes the accent color). Chart tokens
     (`--chart-candle-up/-down/-grid-opacity`) already exist and are already runtime-dynamic via
     `appearance-provider.tsx`, matching Davin's own approved adjustment #2 — nothing to port.
   - Added `.no-scrollbar` (aliased to the pre-existing `.scrollbar-hide` rule, not duplicated)
     and `.animate-marquee`/`@keyframes marquee` (needed by 9-2's landing-page ticker; a no-op
     today, no current page uses it) and the TradingView-logo-hiding rule.

10. **`AppHeader`/`ChatSidebar` rewritten to semantic tokens, not ported verbatim** — this IS
    Decision 3's own instruction, but the scale of the rewrite (every hardcoded `slate-N`/
    `dark:bg-[hex]` class, not just the flagged `--accent-foreground` line) is larger than the
    order's text implies. Extended the identical treatment to `marketing-navbar.tsx`/
    `marketing-footer.tsx` even though Batch-0's named 5-file list didn't include them — both are
    in this session's own Surface, use the same hardcoded-dark pattern, and 9-2 builds marketing
    pages on top of them next; cheaper to fix once here than let 9-2 rediscover the same defect.
    Fixed Batch-0 finding 6b (missing sidebar Help item) directly inside this rewrite.

11. **Middleware merge bug found and fixed before commit, not after.** Two of the auth gate's
    early-return branches (`PUBLIC_SETTINGS_PATHS` match, and the affiliate no-token passthrough)
    initially used a hardcoded `NextResponse.next()` instead of the locale-aware
    `buildLocaleResponse()` — a country-prefixed request hitting either branch would have 404'd
    instead of being rewritten. Caught by tracing all code paths before live-testing, not by the
    live test itself. All 3 live-tested combinations (plain protected path, prefixed public path,
    prefixed protected path with no auth) verified correct via the dev server afterward.

12. **Regressed then fixed 3 assertions in `__tests__/pages/phase-6-exit.test.tsx`**
    (`test:ci` must never go backwards per the roadmap's own §6 rule — an assertion needing to
    change for an intentional rebrand is a finding, not a silent skip): `not-found.tsx`'s heading
    moved from a single h1 "Page not found" to an h1 "404" + h2 "Page Not Found", and its "Home"
    link's accessible name became "Return to Home"; `global-error.tsx`'s heading text changed
    from "Something went wrong" to "System Error Encountered". Test count unchanged (2400 before
    and after) — assertions updated, nothing added or removed.

13. **Found and fixed a latent test-infrastructure gap while wrapping `NotFound` in
    `LocaleProvider` for the first time anywhere in the test suite:** `LocaleProvider`'s
    first-visit geo-detection branch calls the REAL `global.fetch` (`jest.setup.js` wires
    genuine `undici` fetch, not a mock) to `https://ipapi.co/json/`. Left un-mocked, this fired a
    real network request still in flight when the test file's jsdom window tore down, crashing
    the Jest worker process on teardown even though every assertion had already passed. Mocked
    `fetch` to reject immediately inside that one test file. **Not fixed repo-wide** — any future
    test wrapping a component in `LocaleProvider`/`ClientProviders` will need the same guard
    until a default fetch mock exists in `jest.setup.js`; worth a `LESSONS-LEARNED.md` entry.

14. **`public/manifest.json` rebranded (name/short_name/description/theme_color) per F66.**
    Pre-existing, unrelated defect found and disclosed, not fixed: its `icons`/`screenshots`
    arrays reference `public/icons/` and `public/screenshots/`, neither of which exists on disk
    in either tree — the manifest has been non-functional for PWA icons/screenshots independent
    of this session's work. Copied `apple-icon.png`, `icon-{light,dark}-32x32.png`, `icon.svg`
    from `seed-code/` into the main repo's `public/` — referenced by the new `metadata.icons` but
    didn't exist there before.

15. **Live verification, not just `tsc`/`test:ci`:** dev server smoke-tested all 4 currently-
    existing Protected pages under the new shell — `/` (unauthenticated), `/dashboard`,
    `/settings/appearance`, `/settings/help` (all 3 via a real login using the login page's own
    test-credential autofill) — all rendered their existing bodies correctly with zero new
    console errors. `/terminal` and `/free` (the other 2 Protected pages) **do not exist yet** in
    the main repo — confirmed via `ls`; they are new pages Session 9-4 creates per the roadmap's
    own layout inventory. Nothing to verify there this session. Middleware's 3 auth×locale
    interaction cases (plain protected path, prefixed public path, prefixed protected path with
    no auth) verified live. The 4 new shared-chrome components (`AppHeader`, `ChatSidebar`,
    `MarketingNavbar`, `MarketingFooter`) aren't consumed by any route yet (that's 9-2's/9-4's
    wiring work) — verified via a throwaway smoke-test route, deleted before committing, not
    shipped.

16. **Route-manifest diff: clean, trivially.** Every file this session touched under `app/` was
    an existing route file edited in place (`layout.tsx`, `providers.tsx`, `not-found.tsx`,
    `error.tsx`, `global-error.tsx`, `globals.css`) plus `middleware.ts` — zero new route folders
    created, zero URLs added or removed. `git diff --name-status` against the pre-session commit
    confirms this directly.

---

## Next-session handoff

- **Next session:** `9-2` — `(marketing)` 12 + `(public)` 2 (UI-BUILD).
  - Scope: Port the 12 marketing pages (`/`, `/about`, `/blog`, `/careers`, `/changelog`, `/disclaimer`, `/docs`, `/help`, `/pricing`, `/privacy`, `/status`, `/terms`) under `app/(marketing)/layout.tsx` and the 2 public account deletion pages under `app/(public)/layout.tsx`.
- **Prerequisite:** Session 9-1 CLOSED — root shell, design tokens, marketing navbar/footer, and providers live on `main`.
- **9-1 obligation carried to close:** PRE-DRAFT Session 9-2's migration order per `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`.
- **Residual explicitly handed off (CONFIRM note item 5, Davin-approved 2026-08-22):**
  - **Session 9-4** owns the Light Clean Mode hardcoded-dark fix for `chat-panel.tsx` and
    `market-comments-panel.tsx` (both render on `/terminal`/`/free`) when it ports the
    `(dashboard)` core layout boundary — 9-1 deliberately left them dark.
  - **Session 9-5** owns the same fix for `app/(dashboard)/settings/layout.tsx` when it ports
    the settings layout boundary — untouched by 9-1.
  - **Session 9-4** also owns retiring the currently-live `components/layout/header.tsx` (used by
    today's `app/(dashboard)/layout.tsx`) once it swaps that boundary onto `AppHeader` — 9-1 did
    not touch it.
