# Hybrid Appearance Stack — Completion Report

> **Status:** COMPLETE — verified live against the real (Railway) database
> (main codebase) and against a local dev build (seed-code, §10).
> **Executed by:** Claude Code, direct chat instruction (not run through the
> `docs/migration-orders/` Executor Protocol pipeline — this work originates
> from `davintrade-ui-design-stack/`, a separate track from the
> microservices-migration order system, so it carries no PRE-DRAFT/DRAFT/
> APPROVED/CONFIRMED lifecycle and no `docs/migration-orders/CLAUDE.md`
> session entry. This file is the complete record for this piece of work.)
> **Source spec:** [`HYBRID_APPEARANCE_HANDOFF_SPECIFICATION.md`](./HYBRID_APPEARANCE_HANDOFF_SPECIFICATION.md)
> **Codebases:** `D:\SaaS Project\trading-alerts-saas-public\` (main, §§1-9)
> and `seed-code/trading-conversational-ai-ui-pages-increment/` (§10, follow-up)

---

## 1. What was requested

Four tasks from the user, on top of the hand-off spec:

1. Server-side database persistence for `UserAppearance` — Prisma, Server
   Actions, auth session resolution — built in the main codebase.
2. Default settings: Bullish `#00fbff`, Bearish `#fb00ff`, Grid Opacity `0%`,
   Theme `dark`, Accent `amber`.
3. Refactor client-side layout containers for Light Clean Mode / Dark Trading
   Terminal support without contrast regressions.
4. Verify via `npm run build` and `npm test`.

## 2. Scope decision (asked before building)

The hand-off spec's client-side pieces (`chat-sidebar.tsx`, `app-header.tsx`,
a `data-accent` CSS token engine, `trading-chart.tsx`, cookie-based
zero-FOUC injection) only exist in `seed-code/trading-conversational-ai-ui-pages-increment/`.
Main's live dashboard is a different, simpler shell
(`components/layout/{sidebar,header,footer,mobile-nav}.tsx`, `next-themes`,
plain Tailwind `dark:` classes) — and a separate, already-tracked effort
(`docs/files-completion-list/frontend-codebase-migration/`) exists for
porting the seed-code frontend wholesale.

Presented three options; user chose **"Also port the accent-token
engine"**: build the full backend persistence as specified, wire it into
main's _existing_ appearance page/shell, and additionally port the
`data-accent` CSS-variable accent-scheme engine (amber/emerald/blue/purple)
onto main's real design tokens — but do **not** transplant seed-code's
chat-sidebar/chat-panel/trading-chart shell.

## 3. What was built

### Backend persistence (Task 1 & 2)

| File                                                                                    | Purpose                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`prisma/non-market-data/schema.prisma`](../../../prisma/non-market-data/schema.prisma) | New `UserAppearance` model (`theme`, `accent`, `chartUpColor`, `chartDownColor`, `gridOpacity`, defaults `dark`/`amber`/`#00fbff`/`#fb00ff`/`0`) + `User.appearance` back-relation        |
| [`lib/appearance/types.ts`](../../../lib/appearance/types.ts)                           | Shared types, `DEFAULT_APPEARANCE_SETTINGS`, `sanitizeAppearanceSettings()` — validates/clamps every untrusted input (cookie, DB row, Server Action arg) rather than trusting any of them |
| [`lib/appearance/server-appearance.ts`](../../../lib/appearance/server-appearance.ts)   | `getServerAppearance()`: DB record → cookie → defaults resolution hierarchy                                                                                                               |
| [`app/actions/appearance.ts`](../../../app/actions/appearance.ts)                       | `saveAppearanceAction()` Server Action — always sets the cookie (guest support), upserts `UserAppearance` when a session exists                                                           |

### Client accent-token engine + settings UI (Task 2 continued, per chosen scope)

| File                                                                                                      | Purpose                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`app/globals.css`](../../../app/globals.css)                                                             | `[data-accent='amber'\|'emerald'\|'blue'\|'purple']` oklch overrides for `--primary`/`--ring`/`--primary-foreground` (light + dark variants); `--chart-candle-up`/`--chart-candle-down`/`--chart-grid-opacity` tokens                                                                                         |
| [`components/providers/appearance-provider.tsx`](../../../components/providers/appearance-provider.tsx)   | Client React context: reactive settings state, applies CSS vars/`data-accent` to the DOM, syncs `next-themes`, calls the Server Action to save                                                                                                                                                                |
| [`app/(dashboard)/layout.tsx`](<../../../app/(dashboard)/layout.tsx>)                                     | Resolves `getServerAppearance()` and injects `data-accent` + inline CSS vars on its wrapper element; wraps dashboard content in `AppearanceProvider`                                                                                                                                                          |
| [`app/(dashboard)/settings/appearance/page.tsx`](<../../../app/(dashboard)/settings/appearance/page.tsx>) | Full rebuild: Theme Mode (Dark Trading Terminal / Light Clean Mode / System Sync), Accent Color Scheme, candle color pickers, grid opacity slider, Reset Defaults, live preview, Save — built entirely from main's shadcn/oklch tokens (`bg-card`, `border-border`, etc.), not seed-code's hardcoded dark hex |

### Contrast audit (Task 3)

Audited `components/layout/{sidebar,header,mobile-nav,footer}.tsx` and the
settings layout. Found one **genuine pre-existing bug**: `mobile-nav.tsx`'s
active-nav-item and label classes had no `dark:` variants at all (unlike its
desktop sibling `sidebar.tsx`), producing a near-white `bg-blue-50`/
`text-blue-700` pill against the dark mobile-nav sheet. Fixed. Also made
active/selected-state highlighting in `sidebar.tsx`, `header.tsx`
(avatar fallback), `mobile-nav.tsx`, and the settings layout tabs
accent-reactive (`bg-primary`/`text-primary` instead of hardcoded blue), so
the chosen accent scheme now actually shows up across the real dashboard
chrome, not just the settings page itself.

### Tests

Three new files, 17 tests: `__tests__/lib/appearance/types.test.ts`,
`__tests__/lib/appearance/server-appearance.test.ts`,
`__tests__/app/actions/appearance.test.ts` — cover the resolution hierarchy
(DB → cookie → defaults, including DB-throws and malformed-cookie cases),
sanitization (invalid enum fallback, out-of-range `gridOpacity` clamping to
`[0,100]` rather than blanket rejection), and the Server Action's
cookie-always/DB-when-authenticated behavior.

## 4. Architecture decision: appearance resolution lives in `(dashboard)/layout.tsx`, not the root layout

**Original approach (reverted):** resolve `getServerAppearance()` in the
root `app/layout.tsx` and inject `data-accent`/CSS vars on `<html>`, per the
spec's literal wording.

**Problem found at build time:** calling `cookies()`/`headers()` (via
`getSession()`) anywhere in the root layout's render tree forces the
**entire app** — every marketing/auth/public page, not just the dashboard —
off static generation. Confirmed in the build output: `/about`, `/blog`,
`/careers`, `/docs`, `/pricing`, `/terms`, `/privacy`, `/disclaimer`,
`/_not-found`, etc. all flipped from `○ Static` to `ƒ Dynamic`.

**Fix:** reverted `app/layout.tsx` and `app/providers.tsx` to their
original form untouched. Moved the resolution + `AppearanceProvider` +
`data-accent`/CSS-var injection into `app/(dashboard)/layout.tsx` instead —
that layout already calls `getServerSession()` unconditionally to gate
access, so it's already 100% dynamic; adding appearance resolution there is
**zero additional cost**. Updated the `globals.css` selectors from
`:root[data-accent=...]`/`.dark[data-accent=...]` to plain
`[data-accent=...]`/`.dark [data-accent=...]` so they work on a nested
element, not just `<html>` (CSS custom properties cascade to descendants
regardless of which ancestor defines them).

**Result (re-verified in build output after the fix):** all public/marketing
routes back to `○ Static`; `/settings/appearance` and the rest of
`(dashboard)` correctly `ƒ Dynamic` (as they already were, pre-existing).

Every page that actually consumes `useAppearance()` today is inside
`(dashboard)` anyway, so this loses nothing functionally — it's a pure
performance/correctness fix, not a scope reduction.

## 5. Bug caught during live verification: Theme Mode selection didn't flip `.dark`/`.light`

Found while manually clicking through the settings page in a real browser
session (test account, `next dev`): selecting a different Theme Mode
visually showed the new selection but the page didn't actually re-theme.

**Root cause:** `AppearanceProvider`'s effect that calls `next-themes`'
`setTheme()` only ran once on mount (guarded by a ref), to reconcile the
server-resolved theme into `next-themes` at hydration. Deviated from
seed-code's reference implementation, which calls `setTheme()` directly from
the form's `handleThemeChange` on every click — I'd dropped that call
assuming the mount-effect would cover it, which it doesn't for subsequent
changes.

**Fix:** changed the effect to run on every `settings.theme` change instead
of once (`useEffect(() => setTheme(settings.theme), [settings.theme,
setTheme])`), removing the now-unnecessary mount-guard ref. Re-verified live:
clicking "Light Clean Mode" now correctly flips `<html>` to `class="...
light"`, background/text tokens update to the light palette
(`oklch(1 0 0)` bg / dark text), and clicking a different accent swatch
correctly updates `--primary` to the matching oklch value — all confirmed
via `getComputedStyle()` in the live page, not just visually.

## 6. Infrastructure bug found (pre-existing, not introduced this session): `DIRECT_URL` and `DATABASE_URL` pointed at two different Postgres servers

While verifying DB persistence live, `prisma db push` reported success but
the running app still couldn't see the new table. Investigated with a raw
`pg` client querying both connection strings directly:

- `DATABASE_URL` (`turntable.proxy.rlwy.net:55082`, what
  `lib/db/prisma.ts` actually uses at runtime) → `inet_server_addr()` =
  `10.145.101.225`
- `DIRECT_URL` (`maglev.proxy.rlwy.net:58290`, what `prisma.config.ts`
  points CLI operations at — `db push`/`migrate`/`studio`) →
  `inet_server_addr()` = `10.233.164.81`

Two different physical servers, despite both reporting `current_database()
= "railway"` (Railway's default DB name for every Postgres plugin, which is
what made this easy to miss). `POSTGRESQL_URI` in `.env.local` also pointed
at the `maglev` host, separately from `DATABASE_URL`.

This matches a documented near-miss in
`docs/migration-orders/LESSONS-ARCHIVE.md` (~line 677: a `prisma db push`
intended for local Docker instead silently hit `maglev.proxy.rlwy.net` "the
live PRODUCTION host") — so this split is a known-fragile area, not
something new.

**Confirmed with user before acting** (this touches shared DB
infrastructure). Per their explicit instruction:

1. Updated `DIRECT_URL` in `.env.local` to the same value as `DATABASE_URL`
   (`turntable.proxy.rlwy.net:55082`) — `.env.local` is gitignored, so this
   change is **local to this machine only**, not committed.
2. Re-ran `prisma db push --schema=prisma/non-market-data/schema.prisma`,
   confirmed via its own log line the datasource now resolves to
   `turntable.proxy.rlwy.net:55082`.
3. Verified with a direct query that `UserAppearance` now exists on the
   `turntable` server.
4. Left the first, mistaken `UserAppearance` table on the `maglev` server
   in place (harmless, purely additive — did not attempt to drop it without
   being asked).

**⚠️ Follow-up this report exists to flag:** I only fixed the **local**
`.env.local`. If any **deployed** environment (Railway service env vars,
CI/CD, staging) has the same `DATABASE_URL`/`DIRECT_URL` split, migrations
run there could still be silently landing on the wrong database. This needs
checking outside this session — I have no access to Railway's dashboard or
deployed env vars from here.

## 7. Verification

- `tsc --noEmit` — clean, re-checked after every change.
- `npm run build` — `✓ Compiled successfully`; confirmed marketing routes
  `○ Static`, `(dashboard)` routes `ƒ Dynamic` (see §4).
- `npm test` — **157/157 suites, 2373/2373 tests** (baseline before this
  work: 154/154, 2356/2356 — +3 suites/+17 tests, exactly this session's new
  files, zero regressions elsewhere).
- Live browser verification (real `next dev` session, existing test
  account `free-test@trading-alerts.test`, fresh tabs used to avoid stale
  console-log buffering across reloads):
  - Zero-FOUC SSR: `data-accent`/`--primary`/candle CSS vars correct on
    first paint, matching `DEFAULT_APPEARANCE_SETTINGS` exactly.
  - Theme Mode switch flips `.dark`↔`.light` and body bg/fg tokens
    correctly (post-fix, §5).
  - Accent scheme switch updates `--primary` to the correct oklch value
    live (checked amber, emerald, blue).
  - Save round-trips through the Server Action: cookie is set correctly
    (`davintrade-appearance` cookie, correct JSON), and — after the DB fix
    in §6 — a real `UserAppearance` row is created/updated in Postgres for
    the authenticated test user.
  - Reload after save: settings restore correctly from the cookie with no
    flash, confirming the resolution hierarchy's cookie tier.
  - Unauthenticated visit to `/settings/appearance` correctly redirects to
    `/login`.

## 8. Explicitly out of scope (by design, not an oversight)

- Seed-code's `chat-sidebar.tsx`/`chat-panel.tsx`/`market-comments-panel.tsx`/
  `trading-chart.tsx` shell was **not** ported into main — that's the
  separate `docs/files-completion-list/frontend-codebase-migration/` effort.
- No entry was added to `docs/migration-orders/CLAUDE.md`'s session log —
  this work didn't go through that pipeline's PRE-DRAFT/DRAFT/APPROVED/
  CONFIRMED lifecycle (no migration-order file was ever drafted for it).
  This report is the record instead.
- The existing generic `UserPreferences` JSON-blob model
  (`lib/preferences/defaults.ts`, `app/api/user/preferences/route.ts`) —
  which already has overlapping-but-different `theme`/`chartUpColor`/
  `chartDownColor`/`gridOpacity` fields with different defaults and a
  different `colorScheme` enum — was left untouched. It has no consumers
  that read those specific chart fields today, so there's no active
  conflict, but a future session should decide whether it's worth
  consolidating with `UserAppearance` or explicitly deprecating those
  fields.

## 9. Files changed

**New:**

- `lib/appearance/types.ts`, `lib/appearance/server-appearance.ts`
- `app/actions/appearance.ts`
- `components/providers/appearance-provider.tsx`
- `__tests__/lib/appearance/types.test.ts`,
  `__tests__/lib/appearance/server-appearance.test.ts`,
  `__tests__/app/actions/appearance.test.ts`
- This report.

**Modified:**

- `prisma/non-market-data/schema.prisma`
- `app/(dashboard)/layout.tsx`, `app/(dashboard)/settings/appearance/page.tsx`,
  `app/(dashboard)/settings/layout.tsx`
- `app/globals.css`, `app/providers.tsx`
- `components/layout/header.tsx`, `components/layout/mobile-nav.tsx`,
  `components/layout/sidebar.tsx`

**Not committed (gitignored, local-only):**

- `.env.local` — `DIRECT_URL` corrected to match `DATABASE_URL` (§6).

**Database:**

- `UserAppearance` table created on `turntable.proxy.rlwy.net:55082`
  (the database the live app actually reads/writes).
- A stray `UserAppearance` table also exists on
  `maglev.proxy.rlwy.net:58290` from the first, mistaken push — left in
  place, unused, harmless.

---

## 10. Follow-up: seed-code Light Clean Mode fix

**Trigger:** the user tested the live Vercel preview
(`trading-conversational-ai-ui-pages.vercel.app`) — a _different_ codebase
and deploy target than §§1-9 above — and found that switching to Light
Clean Mode only re-themed the TradingView chart canvas; the sidebar, app
header, AI Chart Analyst panel, and Market Comments panel all stayed dark.
This is precisely the "Outstanding Issue" the original hand-off spec's own
§3 documented as still-open for seed-code, and which §2 of this report
explicitly scoped _out_ of the main-codebase work (the user chose to port
the accent engine onto main's shell, not to touch seed-code's own
chat-sidebar/app-header/panels). Confirmed with the user before starting
that this is genuinely a different repo/deploy target, then proceeded per
their explicit go-ahead.

### What was found

`seed-code/trading-conversational-ai-ui-pages-increment/app/globals.css`
already had a complete shadcn-style light/dark CSS variable system
(`--background`, `--foreground`, `--card`, `--sidebar`, Tailwind v4
`@theme inline` + `@custom-variant dark`) — the infrastructure was never
the problem. The five target components simply never used it: every
background/border/text color was a **hardcoded literal** (Tailwind
arbitrary-value hex like `bg-[#06070a]`, or a bare `slate-*`/`emerald-*`
shade with no `dark:` counterpart), so they rendered identically regardless
of the active theme class.

### What was built

Rather than hand-editing ~150+ individual color utility instances across
five large files, wrote a small one-off Node script
(`convert-light-dark.mjs`, not committed — scratchpad only) that:

1. Defines a mapping table of every distinct hardcoded dark-only token
   found in the five files (e.g. `bg-[#06070a]` → `bg-slate-50`,
   `text-slate-400` → `text-slate-500`, `border-emerald-900/40` →
   `border-emerald-100`) to its light-mode Tailwind equivalent.
2. Runs a single combined regex pass (alternation of all tokens, prefix-
   aware for `hover:`/`group-hover:`/`focus:` modifiers) so each original
   class becomes `{light} dark:{original}` — e.g. `bg-slate-800` →
   `bg-slate-100 dark:bg-slate-800`, `hover:bg-slate-800` →
   `hover:bg-slate-100 dark:hover:bg-slate-800`.
3. A first version ran the replacements as N sequential passes and had a
   real bug: a later pass's _output_ (e.g. `dark:text-slate-600` inserted
   while converting `text-slate-500`) could be re-matched by an _earlier-
   in-the-map-but-later-run_ pattern (`text-slate-600` → `text-slate-400`),
   corrupting already-converted tokens. Fixed by combining every token into
   one alternation regex so each original occurrence in the source is
   visited exactly once, with no chance of matching against
   already-inserted output.

Applied to the five files named in the hand-off spec's §3:
`components/chat-sidebar.tsx`, `components/layout/app-header.tsx`,
`components/chat-panel.tsx`, `components/market-comments-panel.tsx`,
`app/(dashboard)/settings/layout.tsx` — 251 mechanical replacements total,
plus two hand-edited gradient backgrounds in the BUY/SELL trade-setup card
(`market-comments-panel.tsx`) that were too one-off for the table
(`from-[#062014] via-[#092b1b] to-[#04170e]` → light-mode
`from-emerald-50 via-emerald-50 to-white`, keeping the original dark
gradient behind `dark:`).

Accent/badge text originally sized for dark backgrounds (`text-amber-300`,
`text-emerald-400`, `text-rose-300`, etc.) got a darker light-mode
counterpart (`text-amber-700`, `text-emerald-600`, `text-rose-700`) rather
than being left as-is, since e.g. pale amber-300 text is close to
unreadable on a white card.

### Verification

- Ran the seed-code dev server (`launch.json` config `davintrade-ui`, port 3009) and confirmed zero console errors on `/settings/appearance` and
  `/terminal`.
- Grepped all five files for any remaining hex literal not gated behind
  `dark:` — zero matches, confirming no stragglers.
- Live-verified via a **real in-app client-side navigation** (clicking the
  breadcrumb `Link`, not a hard page reload) from Settings → Appearance
  (Light Clean Mode selected + saved) to `/terminal`: sidebar, chat-panel,
  and market-comments-panel backgrounds all correctly resolved to light
  tokens (`lab(98.14 …)` ≈ `#f8fafc`/slate-50), heading text correctly dark
  (`lab(7.79 …)` ≈ near-black) — confirmed via `getComputedStyle()`, not
  just visual inspection.
- Verified dark mode is pixel-identical to before: sidebar background
  reads back as `rgb(6, 7, 10)` = `#06070a` exactly, matching the spec's
  explicit "retains its exact dark trading terminal appearance" requirement.
- `npm run build` — `✓ Compiled successfully`, zero errors.

### Found and fixed in a follow-up: stale-cookie theme reversion on hard reload

While verifying via a **hard** page reload (not a Link click), found that a
freshly-selected theme could revert to the previous one. Root cause: two
independent theme-tracking mechanisms coexist in seed-code:

1. `davintrade-appearance` cookie — the JSON blob this report's own system
   uses, correctly updated by `saveAppearanceAction()`.
2. A separate `davintrade-theme` cookie/localStorage pair, driven by an
   inline FOUC-prevention `<script>` in `app/layout.tsx` — written once at
   initial page load, in a resolution order that checked the **cookie
   before localStorage**
   (`(c && c[1]) || localStorage.getItem(...) || initialAppearance.theme`).

When a user changes theme via Settings, `next-themes`' `setTheme()` updates
localStorage immediately but nothing updated the `davintrade-theme`
_cookie_ until the next full page load's inline script ran — so a stale
cookie could outlive a live theme change and win the priority check on the
next hard reload/refresh. This does **not** affect normal in-app
navigation (Next.js client-side routing never re-runs the inline script,
so the live-updated class stays correct throughout a session) — which is
why it's a distinct issue from the one the user originally reported (that
one was purely the missing `dark:` classes, fixed above).

Initially left unfixed and flagged here as a separate concern. The user
then explicitly asked whether it should be fixed. Investigated blast radius
first: `lib/theme-cookie.ts`'s `setThemeCookie`/`getThemeCookie` exports
are dead code (never imported anywhere), and `components/theme-sync.tsx`
only handles a `?theme=` URL param, calling `next-themes`' `setTheme()`
directly — it never touches the `davintrade-theme` cookie. So the entire
bug lives in the one inline script in `app/layout.tsx`, and the fix is a
one-line priority reorder (localStorage before the cookie — localStorage
is always the live value, the cookie is only ever a write-once snapshot),
not a restructure of the persistence architecture.

**Verified via direct reproduction**, not just re-reading the code: forced
theme to dark + saved (cookie still said the previous session's "light" —
confirms the stale-cookie precondition), hard-reloaded — `<html>` class
correctly stayed `dark` (previously would have reverted to the stale
cookie's `light`). Repeated in reverse (light → hard reload, cookie stale
at `dark`) — `<html>` class correctly stayed `light`. `npm run build` —
`✓ Compiled successfully`, zero errors.

### Found and fixed in a second follow-up: `trading-chart.tsx` was never touched

The user then checked `/terminal` again and pointed out the sidebar/header/
panels were correctly light now, but the chart's own overlay chrome — the
floating drawing-tool toolbar, the symbol/timeframe pills, the "EDT
Configuration" button, the model-selector-style tab bar — was still solid
black. Root cause: this control chrome lives inside
`components/trading-chart.tsx` (853 lines), which was never in the
original five-file list from the hand-off spec's §3, so the earlier pass
never touched it. Same failure mode as the rest of this task: every
background/border/text color hardcoded to a literal dark hex/slate shade,
with `dark:` variants entirely absent.

Reused the same conversion script (extended with this file's own
hex+opacity tokens, e.g. `bg-[#090c14]/90` → `bg-white/90`, and
`text-blue-300`/`text-purple-300` accent-badge text → `text-blue-700`/
`text-purple-700`) — 88 mechanical replacements, zero hand-edits needed
this time (no one-off gradients like the trade-setup card had).

**Verified live**: forced `light` class, confirmed the chart header, both
floating toolbar overlays, and the top-right control cluster all resolved
to white/`white/90` backgrounds via `getComputedStyle()` (not just visual
inspection); forced back to `dark` and confirmed the chart header reads
back as `rgb(17, 20, 30)` = `#11141e` exactly, matching the original
hardcoded value pixel-for-pixel. `npm run build` — `✓ Compiled
successfully`, zero errors. seed-code has no test suite to run (reference/
mockup frontend, not production-tested).

### Files changed (seed-code)

- `components/chat-sidebar.tsx`
- `components/layout/app-header.tsx`
- `components/chat-panel.tsx`
- `components/market-comments-panel.tsx`
- `components/trading-chart.tsx` (chart overlay chrome, second follow-up)
- `app/(dashboard)/settings/layout.tsx`
- `app/layout.tsx` (stale-cookie fix, follow-up commit)

Committed to the seed-code repo and pushed — this triggers a new Vercel
deployment of `trading-conversational-ai-ui-pages.vercel.app`.
