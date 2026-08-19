# Hybrid Appearance Stack — Completion Report

> **Status:** COMPLETE — verified live against the real (Railway) database.
> **Executed by:** Claude Code, direct chat instruction (not run through the
> `docs/migration-orders/` Executor Protocol pipeline — this work originates
> from `davintrade-ui-design-stack/`, a separate track from the
> microservices-migration order system, so it carries no PRE-DRAFT/DRAFT/
> APPROVED/CONFIRMED lifecycle and no `docs/migration-orders/CLAUDE.md`
> session entry. This file is the complete record for this piece of work.)
> **Source spec:** [`HYBRID_APPEARANCE_HANDOFF_SPECIFICATION.md`](./HYBRID_APPEARANCE_HANDOFF_SPECIFICATION.md)
> **Codebase:** `D:\SaaS Project\trading-alerts-saas-public\` (main, not seed-code)

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
