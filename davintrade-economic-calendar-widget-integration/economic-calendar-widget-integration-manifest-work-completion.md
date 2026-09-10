# Economic Calendar Widget Integration Manifest — Work Completion Report

**Date:** 2026-09-04
**Status:** Code complete, verified, committed, and pushed to `origin/main`
**Type:** Ad-hoc feature session (Davin-requested directly in chat, with a fully-specified task
prompt and an annotated screenshot of the live landing page) — outside the phase/session
numbering, per `docs/migration-orders/EXECUTOR-PROTOCOL.md` §6. Recorded in `CLAUDE.md`'s matching
ad-hoc note.

> **Scope note:** this document covers the public `/econ-news` Economic Calendar page and its
> TradingView widget only. A later, separate same-day ad-hoc session
> (`feat(landing): replace simulated ticker with live TradingView ticker tape widget`, commit
> `8536b11a`) extracted this session's own inline `TRADINGVIEW_LOCALE_MAP` into a shared
> `lib/utils/tradingview-locale.ts` helper so a new Ticker Tape widget could reuse it — see §6.

---

## 1. What was built

A public, unauthenticated `/econ-news` route embedding TradingView's official
`embed-widget-events.js` Economic Calendar, reachable directly from the marketing landing page's
top navigation (desktop nav + mobile drawer, positioned between "Affiliates" and "More" exactly
per Davin's annotated screenshot) and from the footer's "Product" column.

### 1.1 One correction to the task prompt's own reference code, found before writing anything

The task prompt's own sample widget-wrapper code read the app's theme via `next-themes`' own
`useTheme()`. Checked live code first, per `EXECUTOR-PROTOCOL.md` §0 ("live code wins"): this
app's real `.dark`/`.light` DOM state is owned directly by `AppearanceProvider`
(`components/providers/appearance-provider.tsx`), and `next-themes`' own `theme`/`resolvedTheme`
is **not** kept in sync with it — confirmed against this same day's separate Theme Mode fix
session (`CLAUDE.md`'s adjacent 2026-09-04 entry, root cause 2: `next-themes` stays mounted but no
other code in this app reads its context). Using `useTheme()` as the prompt's sample code did
would have silently never matched the app's real theme. Built the widget wrapper to read
`resolvedTheme` from `useChartAppearance()` instead — the same source `components/charts/
trading-chart.tsx` already uses successfully.

### 1.2 The public page (`app/(marketing)/econ-news/page.tsx`)

Client Component (interactive filter state needs it): a hero header (`Macro Intelligence` badge,
title, description — all routed through `useLocale()`'s `t()`, not hardcoded English), an
impact-filter toolbar (`All Impact` / `Medium & High` / `High Impact Only` — maps to TradingView's
`importanceFilter` values `-1,0,1` / `0,1` / `1`), a region-preset toolbar (`Global (All)` /
`Forex Majors` / `US Only` / `Asia-Pacific` — maps to `countryFilter` strings), and the calendar
card itself. A `TRADINGVIEW_LOCALE_MAP` translates this app's own language codes into TradingView's
distinct locale codes where they diverge (Korean `ko` → `kr`, Chinese `zh`/`zh-TW` →
`zh_CN`/`zh_TW`), derived from `useLocale()`'s `language` and passed into the widget as its
`locale` prop.

### 1.3 The reusable widget wrapper (`components/calendar/economic-calendar-widget.tsx`)

Handles TradingView's script-injection lifecycle directly (no npm package exists for this
widget): on mount, clears and rebuilds its container div, injects TradingView's
`embed-widget-events.js` `<script>` tag with a JSON config blob (`colorTheme`, `isTransparent`,
`width`/`height`, `locale`, `importanceFilter`, optional `countryFilter`/`currencyFilter`), and
appends the required TradingView attribution link (its text routed through `t()` too). Re-runs
whenever `resolvedTheme`/filters/locale change, tearing down and rebuilding the script each time
so the live TradingView iframe reflects the new config. Cleanup captures `containerRef.current`
into a local variable at the top of the effect (not read again inside the returned cleanup
closure) to satisfy `react-hooks/exhaustive-deps` cleanly. Shows a themed loading skeleton
(`t('Loading Economic Calendar...')`) until the component has mounted client-side.

### 1.4 CSP widening (`next.config.js`)

TradingView's widget script and the iframe it injects needed four `Content-Security-Policy`
directives widened, scoped to TradingView's own domains only:

- `script-src`: `+ https://s3.tradingview.com` (the embed script itself)
- `frame-src`: `+ https://www.tradingview-widget.com https://*.tradingview.com` (the injected
  calendar iframe)
- `img-src`: `+ https://*.tradingview.com`
- `connect-src`: `+ https://*.tradingview.com`

### 1.5 Navigation, footer & i18n

- `components/marketing/marketing-navbar.tsx`: one line added to the shared `navLinks` array
  (`{ href: '/econ-news', label: t('EconNews') }`) — since desktop nav and the mobile drawer both
  map over the same array, this single change satisfied both surfaces at once, no separate mobile
  wiring needed.
- `components/marketing/marketing-footer.tsx`: an "Economic Calendar" link added to the "Product"
  column, ahead of "Pricing & Plans".
- `lib/i18n/dictionaries/en-US.json`: ~15 new keys added (identity mapping — the key equals the
  English text, matching this dictionary's own established convention for the large majority of
  its ~4,000+ entries). Not translated into the other 12 dictionaries this session — degrades
  safely per `docs/policies/08-locale-i18n-compliance.md`'s own documented partial-coverage
  precedent (`t()` falls back to its own fallback param or the raw key; a partial dictionary never
  breaks, it degrades to English for the untranslated languages).

### 1.6 Test coverage

New `__tests__/components/economic-calendar-widget.test.tsx` (3 tests): container + TradingView
attribution render correctly, the `importanceFilter`/`countryFilter` props reach the injected
script's JSON config unchanged, and the component unmounts without throwing. Wraps
`LocaleProvider` + `AppearanceProvider` (both hooks the widget now calls) via the same
shadow-`render()`-wrapper pattern `__tests__/components/charts/trading-chart.test.tsx` already
established, per `LESSONS-LEARNED.md` **L40**.

---

## 2. Files changed

| File                                                     | Change                                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `next.config.js`                                         | CSP `script-src`/`frame-src`/`img-src`/`connect-src` widened for TradingView domains |
| `components/calendar/economic-calendar-widget.tsx`       | **New.** Reusable TradingView Economic Calendar widget wrapper                       |
| `app/(marketing)/econ-news/page.tsx`                     | **New.** Public page: hero, impact/region filter toolbar, calendar card              |
| `components/marketing/marketing-navbar.tsx`              | `EconNews` nav link (desktop + mobile drawer, shared array)                          |
| `components/marketing/marketing-footer.tsx`              | `Economic Calendar` link under the "Product" column                                  |
| `lib/i18n/dictionaries/en-US.json`                       | ~15 new i18n keys (identity mapping)                                                 |
| `__tests__/components/economic-calendar-widget.test.tsx` | **New.** 3 tests: render/attribution, filter passthrough, clean unmount              |
| `CLAUDE.md`                                              | Ad-hoc session note                                                                  |

**8 files touched (6 modified, 2 added, 1 new test file)**, 471 insertions / 4 deletions in a
single commit.

---

## 3. Test verification

| Suite                                                                         | Result                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript — monolith (`npx tsc --noEmit`)                                    | 0 errors (after fixing two real findings: an unused default `React` import under this project's JSX-transform config, and a `noPropertyAccessFromIndexSignature`-driven `config.countryFilter`/`config.currencyFilter` assignment that needed bracket notation) |
| ESLint (`npx eslint`, all 5 changed/new source files)                         | 0 errors, 0 warnings (after fixing a real `react-hooks/exhaustive-deps` finding — see §1.3's cleanup-capture fix)                                                                                                                                               |
| Targeted Jest (`economic-calendar-widget.test.tsx` + `public-pages.test.tsx`) | **16/16 passed**                                                                                                                                                                                                                                                |
| Monolith Jest (full `npm run test:ci`)                                        | **167/167 suites · 2393/2393 tests passed** (166/2390 baseline + this session's own +1 suite/+3 tests, zero regressions elsewhere)                                                                                                                              |
| `npm run build` (production build)                                            | Clean, exit 0, `/econ-news` present in the static route manifest                                                                                                                                                                                                |
| Pre-push hook re-run (`type-check` + full `test:ci`)                          | **167/167 suites · 2393/2393 tests**, identical to the pre-commit run — clean before the push completed                                                                                                                                                         |

---

## 4. Live browser verification

Verified in **both** `next dev` (Turbopack) and a real `next start` production server on an
isolated port, not dev-mode alone:

- **A genuine, reproducible dev-only console error was found, root-caused, and confirmed not to
  reach production, rather than dismissed or silently worked around.** `next dev` (this repo's
  `reactStrictMode: true`) reliably threw `Uncaught TypeError: Cannot read properties of null
(reading 'querySelector')` immediately after the widget rendered correctly. Traced to React
  Strict Mode's dev-only mount→cleanup→mount double-invoke racing TradingView's own async
  `embed-widget-events.js`'s internal DOM lookup — a vanilla external script injecting into a
  container React's cleanup effect can tear down mid-flight. **Confirmed, not assumed, that this
  is dev-only:** built a real production bundle (`npm run build`, clean) and ran `next start` on
  an isolated port (`3099`) in a fresh browser tab — **zero console errors**, the widget rendered
  correctly with live TradingView event data, and toggling the "High Impact Only" filter (which
  tears down and rebuilds the script/iframe) also re-rendered cleanly with zero errors on the real
  production server.
- **Desktop nav** shows "EconNews" between "Affiliates" and "More", exactly matching Davin's
  annotated screenshot.
- **Mobile drawer** (375×812 viewport, real click-through via `document.currentScript`-driven DOM
  inspection after the automation harness's coordinate-based click on the hamburger button proved
  unreliable while the pane was backgrounded — confirmed unrelated to the app, same class of
  automation-timing quirk this file's other 2026-09-04 sessions independently documented) shows
  "EconNews" directly under "Affiliates", matching the desktop position.
- **Footer** "Product" column shows "Economic Calendar".
- **The widget itself** renders real TradingView event data (a live "Industrial Prod MM\*" /
  "Coming soon" row was observed on the production run), correctly dark-themed by default
  (matching `DEFAULT_APPEARANCE_SETTINGS.theme = 'dark'` for anonymous visitors), and the
  impact/region filter buttons correctly re-render it with different event sets on click.
- **Route reachability confirmed with zero auth prompt or redirect** — `/econ-news` is not in
  `middleware.ts`'s `PROTECTED_PREFIXES` list, and `app/(marketing)/layout.tsx` has no
  server-side auth gate of its own — both of `LESSONS-LEARNED.md` **L17**'s two independent auth
  gates were checked directly, neither applies to this route.

### Not verified, flagged rather than assumed

Actual **light-mode** rendering of the widget was not visually confirmed — anonymous visitors
always get `resolvedTheme: 'dark'` (no public theme toggle existed on this page at the time this
session ran; Theme Mode lived behind the authenticated Settings → Appearance page only, which the
Executor cannot click through per this repo's standing rule against entering credentials). The
underlying mechanism is proven sound (the identical `useChartAppearance()` source already
confirmed working for `/terminal`'s trading chart in this same day's separate Theme Mode fix
session), but the widget's own light-mode pixels on `/econ-news` specifically were not eyeballed
in this session. **Note:** a later, separate same-day ad-hoc session did add a public dark/light
theme toggle directly to the marketing navbar (`components/marketing/theme-toggle-button.tsx`,
commit range starting `059071a5`) — this closes the practical gap for a future verification pass,
though it postdates this session's own scope.

---

## 5. Git history

Landed as a single commit on `main` (this feature's pieces — CSP, widget, page, nav, footer,
dictionary, tests — are not independently shippable; splitting them would have left an
intermediate state where the route either 404s or references a non-existent component), then
pushed to `origin/main`:

| Commit     | Summary                                                                                            |
| ---------- | -------------------------------------------------------------------------------------------------- |
| `034f0555` | `feat(marketing): add public Economic Calendar (EconNews) page via TradingView widget` — all of §1 |

Pushed `31bf7d4d..034f0555` to `origin/main` on Davin's explicit request; the pre-push hook
re-ran the full monolith `test:ci` suite fresh (167/167 · 2393/2393) before allowing the push.

---

## 6. A note on later, related work

Two separate same-day ad-hoc sessions touched files this session created or is adjacent to, after
this session had already closed and been committed:

- **`8536b11a`** (`feat(landing): replace simulated ticker with live TradingView ticker tape
widget`) extracted this session's own inline `TRADINGVIEW_LOCALE_MAP` (defined in
  `app/(marketing)/econ-news/page.tsx`, §1.2) out into a new shared
  `lib/utils/tradingview-locale.ts` helper (`resolveTradingViewLocale()`), so a new landing-page
  Ticker Tape widget could reuse the identical TradingView-locale-code mapping without drifting
  out of sync with this page's own copy. `econ-news/page.tsx` now imports and calls that shared
  helper instead of defining the map inline — a pure refactor, no behavior change to this page.
- **`059071a5`** (`feat(marketing): add public dark/light theme toggle to navbar`) added a public
  Moon/Sun theme-toggle button to `MarketingNavbar` — the component this session's own `EconNews`
  nav link lives in — giving anonymous visitors a way to actually reach light mode on
  `/econ-news` for the first time, closing part of §4's "not verified" light-mode gap. Neither
  commit is this session's own work; both are recorded here only so a future reader tracing
  `econ-news/page.tsx`'s or `marketing-navbar.tsx`'s history understands the full picture.

---

## 7. Explicitly out of scope

- **Full parity translation of the ~15 new i18n keys into the other 12 dictionaries** (`ar`, `th`,
  `de`, `es`, `ja`, `hi`, `vi`, `id`, `tr`, `ur`, `pt`, `fr`/`ko`/`zh` where applicable) — left as
  identity-mapped English-only, degrading safely per §1.5's cited precedent. A follow-up
  translation content task, not a code change.
- **A public theme toggle on `/econ-news` itself** — at the time this session ran, no such control
  existed anywhere on the public site; building one was outside this session's own scope (a later
  session added it repo-wide to the navbar instead — see §6).
- **Currency filter (`currencyFilter` prop)** — the widget wrapper supports it (§1.3), but the
  public page's own filter toolbar only exposes impact and region presets, matching exactly what
  Davin's task prompt asked for; no UI control for currency filtering was built.
- **A CSV/export or "add to calendar" feature** — not requested, not part of TradingView's
  `embed-widget-events.js` widget surface either.
