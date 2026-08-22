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

- [ ] **Session 9-0 CONFIRMED, executed, CLOSED** — `frontend-swap-route-map.md` exists and committed; F65/F66 RESOLVED in `DECISION-LOG.md`.
- [ ] **Protected-pages list verified** against `codebase-2-parity-audit/00-MASTER-PLAN.md` §0 (`/`, `/terminal`, `/free`, `/dashboard`, `/settings/appearance`, `/settings/help`).
- [ ] **Batch-0 root boundaries confirmed fixed in codebase 2** (`app/global-error.tsx` mailto line, `app/not-found.tsx` 3-action buttons).
- [ ] **`seed-code/` working tree verified read-only** except the two confirmed intentional edits (`affiliate/dashboard/payouts` and `statements`).
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

- [ ] `app/not-found.tsx`, `app/global-error.tsx`, and `app/error.tsx` live in main repo with DavinTrade branding and correct actions.
- [ ] `app/globals.css` and `tailwind.config.ts` establish the full DavinTrade token palette in Tailwind v3 with WCAG AA `--accent-foreground` contrast.
- [ ] `app/layout.tsx` and `app/providers.tsx` live, wiring `getServerAppearance()`, `UserAppearance`, `LocaleProvider`, `AppearanceProvider`, and NextAuth `SessionProvider`.
- [ ] `AppHeader`, `ChatSidebar`, `marketing-navbar.tsx`, and `marketing-footer.tsx` ported and verified; dead `components/header.tsx` removed.
- [ ] `middleware.ts` combines country-prefix locale rewriting with NextAuth session/role route protection.
- [ ] Visual smoke check confirms all 6 Protected pages render cleanly.
- [ ] `npx tsc --noEmit`, `npx eslint app components lib hooks --max-warnings 5`, and `npm run test:ci` all pass clean.

---

## Rollback

Commit per step. If an issue arises in a specific step, revert that step's commit via `git revert`.

---

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

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
