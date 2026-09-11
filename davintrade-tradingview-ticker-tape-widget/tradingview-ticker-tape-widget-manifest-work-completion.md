# TradingView Ticker Tape Widget — Manifest / Work Completion Report

**Date:** 2026-09-04 -> 2026-09-05
**Status:** Code complete, verified, committed, and pushed to `origin/main`
**Type:** Ad-hoc feature session (Davin-requested directly in chat, with an annotated screenshot of
`davintrade.app` pointing at the TradingView ticker-tape widget docs), followed by a same-arc
live-bug-fixing sequence once the widget hit production. Outside the phase/session numbering, per
`docs/migration-orders/EXECUTOR-PROTOCOL.md` §6.

> **Scope note:** this document covers `components/landing/ticker-tape.tsx` and its direct
> supporting files only. Three commits landed in the middle of this same working session that are
> **not** part of the ticker tape (`bc5d4625` locale-default fix, `2b4e0fb2`/`8239cb7f` hero
> rebrand copy) — see §6 for how those were confirmed unrelated. `20414545` (hero mascot
> theme-swap) is listed because its own commit message asserted the ticker tape was "already
> theme-aware" — an assertion the very next commit in this arc (`f4747820`) found to be wrong in
> production; see §1.4.

---

## 1. What was built

Replaced a fully simulated, client-side-randomized price ticker on the public marketing landing
page with TradingView's real Ticker Tape widget (15 IC Markets instruments), then — once Davin
started exercising it live on `davintrade.app` — chased a genuine multi-round production bug
through five distinct wrong fixes before landing on the one that actually holds. The final
architecture (dual-iframe, CSS-only theme swap, no re-initialization ever) is materially different
from, and considerably more defensive than, the first version that shipped.

### 1.1 Initial build (`8536b11a`)

- Replaced the old `TickerTape` (a `setInterval`-driven fake price feed with client-side
  `Math.random()` jitter, `TrendingUp`/`TrendingDown` icons, and a CSS `animate-marquee` loop) with
  a real embed of TradingView's `embed-widget-ticker-tape.js`, injected via the standard
  `tradingview-widget-container` + `<script>` pattern this codebase already uses for
  `EconomicCalendarWidget`.
- All 15 requested IC Markets instruments (`DEFAULT_TICKER_SYMBOLS`), `showSymbolLogo: true`.
- Theme synced from `useChartAppearance().resolvedTheme` (the same `AppearanceProvider`-owned
  source `EconomicCalendarWidget`/`trading-chart.tsx` already use — **not** next-themes' own
  `useTheme()`, which the 2026-09-04 Theme Mode session had already established is no longer kept
  in sync with this app's real theme).
- **New shared `lib/utils/tradingview-locale.ts`**, extracted from a locale-code map that
  previously lived only inline in `app/(marketing)/econ-news/page.tsx` — needed by two widgets now,
  so the mapping was centralized rather than duplicated a second time (`econ-news/page.tsx` was
  refactored to import the shared helper, net behavior unchanged).
- CLS-safe `h-[46px]` skeleton while unmounted; CSP already covered `s3.tradingview.com`/
  `*.tradingview.com` from the prior EconNews session — no CSP change needed.

### 1.2 Alphabetization polish (`fa1ee786`)

- Davin asked for the 15 symbols to be sorted alphabetically. Reordered `DEFAULT_TICKER_SYMBOLS`
  by display `title` (not `proName`) — AUD/USD ... XTI/USD — matching this repo's own convention of
  sorting locale-facing lists by display label (`LanguageSelectorModal`'s `localeCompare`-on-name
  sort), plus a regression test asserting the list stays sorted.

### 1.3 `displayMode` consistency fix (`5d0579a8`)

- Davin reported, with two screenshots (mobile vs. desktop), that the ticker showed two visually
  different formats depending on device — theorized as a cookie/session bug ("first visit vs.
  subsequent visit").
- **Live-diagnosed as something else entirely, not a caching bug:** loaded the exact same
  TradingView widget config directly at both a mobile (375px) and a desktop (1280-1440px) viewport
  width. `displayMode: 'adaptive'` silently switches between two structurally different renderers
  purely on container width at load time — a continuously-scrolling single-line strip on wide
  viewports vs. a static, larger-font, periodically-rotating card grid on narrow ones. No cookie or
  session state was involved at all.
- Fix: forced `displayMode: 'compact'` as the default, so the card format renders consistently at
  every width. Verified live in the Browser pane at both widths post-fix (matching Davin's own
  first screenshot), zero console errors either way.

### 1.4 Runtime theme-toggle bug — five wrong fixes before the one that held

This is the substantial part of the session and the reason the final component looks nothing like
§1.1-§1.3's version. `20414545` (a same-day, unrelated hero-mascot commit) asserted in its own
message that the ticker tape was "already theme-aware... confirmed live by toggling the navbar
theme button." **That assertion turned out to be incomplete** — the immediate next commit found a
real production bug the mascot-swap testing hadn't exercised (a _runtime_, in-place toggle without
a full page reload, which behaves differently from a fresh load in either theme).

| #   | Commit     | Attempted fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Why it failed                                                                                                                                                                                                                                                                                                   |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `f4747820` | Split into an inner `TickerTapeWidget` remounted via a React `key` derived from every config value, instead of manually clearing `innerHTML` in place.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Verified working against a real `next build && next start` at the time — but `e3756bc5` found the _next_ layer of the same bug: TradingView's own loader script keeps state across re-executions within one SPA session, independent of the DOM-lifecycle problem this fix solved.                              |
| 2   | `e3756bc5` | Skipped the loader script entirely; rendered a plain `<iframe>` pointed directly at the URL the script itself generates (`https://www.tradingview-widget.com/embed-widget/ticker-tape/...`), updating `src` on toggle.                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Re-diagnosed live: the fragment-only URL change (`colorTheme` lives in the URL **hash**) is treated by the browser as an in-page hash navigation, not a document reload — so the iframe's own document never re-fetched.                                                                                        |
| 3   | `1e3f3cd0` | Mirrored `colorTheme` into the **query string** too (redundant with the hash), so the query string itself differs on every theme change and a real reload is forced.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Real-use reports from Davin: slow to update, and at times stuck showing the old theme — a genuine reload was happening, but TradingView's own re-embed on that path was unreliable.                                                                                                                             |
| 4   | `2a004f7e` | Locked the theme at first mount via a **module-scoped cache** (not component state — a `<Suspense>`-triggered remount from the theme-save Server Action's `cookies().set()` route refresh was proven to re-run a component-local `useState` lazy initializer, so only plain JS module scope survives it).                                                                                                                                                                                                                                                                                                                                                                 | Davin's own explicit call: correct behavior (never blank), but by definition stopped following a later theme toggle without a full page reload — an accepted trade-off, not a bug, but superseded within the hour once a better option was found.                                                               |
| 5   | `784c4eb1` | **Reframed the whole approach:** stopped trying to re-initialize the embed at all. Mounts **both** a light-configured and a dark-configured iframe simultaneously, full-size and stacked, and picks the visible one purely in CSS via complementary `opacity-100 dark:opacity-0` / `opacity-0 dark:opacity-100` classes keyed off the `.dark` class `AppearanceProvider` already sets on `<html>`. Also moved `TickerTape` outside the landing page's `<Suspense>` boundary (only `LandingPricing` needs it for `?ref=`; the theme-save Server Action's route refresh re-suspends that boundary and was the actual trigger behind the mount-locking fix's own fragility). | **This is the fix that held.** Verified on a real production build, fresh port, fresh tab: four consecutive toggles each swapped instantly and correctly; the DOM nodes were confirmed the exact same elements with byte-identical `src` values before and after — no remount, no reload, no navigation at all. |
| 6   | `23e3265f` | Cosmetic finish on top of the dual-iframe design: found the dark widget was correctly _selected_ but rendered light text on a **white** strip, because `isTransparent: true` depends on showing through ancestors that weren't reliably transparent across browsers — confirmed by inspecting a fully-transparent computed background chain that still rendered white, then reproducing the same config standalone with `isTransparent: false`. Set `isTransparent: false` (each widget now paints its own theme-matched background) and dropped a `bg-background/95` opacity modifier on the container that was computing to fully transparent rather than 95%-alpha.    | N/A — this fully resolved the visible-format bug from the two prior screenshots.                                                                                                                                                                                                                                |

The end state (`23e3265f`, current `HEAD`) is the version documented in §2: two always-mounted,
full-size, opaque iframes, CSS-only theme selection, a module-scoped locale cache, and the widget
positioned outside any `<Suspense>` boundary that could remount it.

### 1.5 PWA manifest fix (bundled into `23e3265f`)

Found while investigating why the ticker's background looked wrong in one browser during the
opacity fix above — unrelated to the ticker itself, but landed in the same commit because it was
found in the same investigation pass:

- `public/manifest.json` referenced 13 icon/screenshot assets, **none of which existed** —
  `public/icons/` and `public/screenshots/` were both entirely absent, 404ing on every page load.
- Generated all 8 standard icon sizes + 2 shortcut icons from the existing 671x671 brand icon via
  `sharp`, plus a maskable 512px variant with the logo inside an 80% safe zone on brand amber
  (sampled from the source icon, matching `theme_color`) so Android doesn't crop the mascot.
- Fixed two further manifest bugs found in the same pass: icons were declared `"maskable any"`
  despite having no safe-zone padding (would crop on Android — split into a plain `"any"` set plus
  the one padded `"maskable"` variant); the Watchlist shortcut pointed at `/watchlist`, which does
  not exist as a route (removed; `/dashboard` and `/alerts/new` verified real).
- Dropped the `screenshots` array rather than fabricate product screenshots — it's optional, and
  absent beats 404ing.

---

## 2. Final architecture (current `HEAD`, `components/landing/ticker-tape.tsx`)

- **Two `<iframe>`s, always both mounted, always both full-size** — one pointed at a
  light-configured TradingView embed URL, one at a dark-configured one. Never `display: none`
  (a classic way to get a permanently broken third-party widget that measures itself at zero
  width). Theme selection is **purely CSS**: `opacity-100 dark:opacity-0` on the light iframe,
  `opacity-0 dark:opacity-100` on the dark one. A theme toggle changes zero DOM nodes, zero
  `src` attributes, zero JavaScript — only two opacity values.
- **No loader script.** Renders a plain `<iframe src="https://www.tradingview-widget.com/
embed-widget/ticker-tape/?locale=...#<url-encoded-json-config>">` directly, bypassing
  `embed-widget-ticker-tape.js` entirely (that script was found to retain state across its own
  re-executions within one SPA session — a known failure class for "insert a script, it builds its
  own iframe" third-party embeds).
- **Locale resolved once per tab, via a module-scoped cache** (`cachedTickerLocale`, plain JS
  scope — not React state, since a `<Suspense>`-triggered remount was proven to re-run a
  component-local `useState` lazy initializer). Guarded to the client only: a server-side cache in
  a Next.js module would leak one visitor's resolved locale into another's SSR output, since the
  module is evaluated once per Node.js process, not once per request. `__resetTickerTapeCacheForTests()`
  is exported test-only, to give each test a clean "first ever page load."
- **Mounted outside the landing page's `<Suspense>` boundary** (`app/(marketing)/page.tsx`) — only
  `LandingPricing` needs that boundary (`useSearchParams()` for `?ref=`), and a theme-save Server
  Action's `cookies().set()` call causes Next.js to refresh the route, which re-suspends the
  boundary and remounts everything inside it. A third-party iframe embed that is unreliable when
  re-embedded mid-session (proven repeatedly in §1.4) must not be remounted by an unrelated
  component's suspension.
- `isTransparent: false`, `displayMode: 'compact'`, `showSymbolLogo: true`, all 15 alphabetized IC
  Markets symbols, `height: 72`.

---

## 3. Files changed

| File                                                | Change                                                                                                                 |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `components/landing/ticker-tape.tsx`                | Full rewrite across 9 commits — see §1/§2                                                                              |
| `lib/utils/tradingview-locale.ts`                   | **New.** Shared locale-code map, extracted from `econ-news/page.tsx`'s previously-inline copy                          |
| `app/(marketing)/econ-news/page.tsx`                | Switched to the shared locale helper (net behavior unchanged)                                                          |
| `app/(marketing)/page.tsx`                          | `TickerTape` moved outside the landing page's `<Suspense>` boundary                                                    |
| `__tests__/components/landing/ticker-tape.test.tsx` | **New**, then rewritten twice more as the architecture changed (script-injection assertions -> dual-iframe assertions) |
| `public/manifest.json`                              | Removed 13 dead asset references; fixed maskable-icon declaration and a dead shortcut route                            |
| `public/icons/*.png` (10 files)                     | **New.** Generated via `sharp` from the existing brand icon                                                            |
| `next-env.d.ts`                                     | Next.js dev-server auto-regen (per `CLAUDE.md`'s own "This is NOT the Next.js you know" note)                          |

**14 files touched** (9 modified, 5+10 new — icons counted as one line above), across the 9
ticker-tape-specific commits listed in §5.

---

## 4. Test verification

| Suite                                                                           | Result                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ticker-tape.test.tsx` (final, dual-iframe architecture)                        | **9/9 passed** — container/both-iframes render, CSS-only theme selection via complementary opacity classes, per-iframe `colorTheme` config with everything else identical, all 15 symbols + `showSymbolLogo`/`isTransparent`/`displayMode`, alphabetization invariant, locale resolved into the query string, custom symbol overrides on both iframes, src stability across rerender **and** full remount, clean unmount |
| `npx tsc --noEmit`                                                              | Clean at every commit in the arc, re-confirmed clean against current `HEAD` while drafting this document                                                                                                                                                                                                                                                                                                                 |
| `npx eslint`                                                                    | Clean on every changed file at every commit                                                                                                                                                                                                                                                                                                                                                                              |
| Full monolith `npm run test:ci`                                                 | **171/171 suites** at the point this arc landed (confirmed via the pre-push hook on each push in the sequence) — zero regressions introduced by any of the 9 commits                                                                                                                                                                                                                                                     |
| Production build verification (`next build && next start`, not just `next dev`) | Run explicitly for commits `f4747820`, `e3756bc5`, `2a004f7e`, `784c4eb1`, `23e3265f` — each fix in the runtime-theme-toggle saga was verified against a **real production build on a fresh port**, not dev-server HMR, after `1e3f3cd0`'s own investigation found a false lead (a heavily-reused browser tab carrying accumulated re-init state that looked like a regression but was actually stale tab state)         |

---

## 5. Live browser verification

Every commit in the runtime-theme-toggle saga (§1.4) was diagnosed and verified against live
browser behavior, not inferred from source reading alone — this was the entire nature of the bug
(it never reproduced as a type error or a failing unit test; it only manifested as a real iframe
going blank in a real browser after a real click):

- **Initial widget (`8536b11a`):** Browser-pane-verified at both mobile (375px) and desktop
  (1440px) widths; confirmed the TradingView iframe's live config (`showSymbolLogo`, `isTransparent`,
  `displayMode`, all 15 symbols) via direct DOM/script inspection, not just visual inspection.
- **`displayMode` fix (`5d0579a8`):** Loaded the exact widget config standalone via
  `tradingview-widget.com`'s own embed URL at both viewport widths to empirically confirm the
  adaptive-mode width threshold before touching any code — ruled out the cookie theory this way,
  rather than guessing.
- **Runtime-toggle saga (`f4747820` through `23e3265f`):** Each fix was reproduced live on
  `davintrade.app` production first (not assumed from the previous fix's own reasoning), confirmed
  broken with direct DOM/iframe-src inspection, then re-verified after the fix against a real
  local production build — single toggles, rapid multi-click stress tests, and (for the final
  dual-iframe design) confirming via node-identity comparison that the DOM nodes were the exact
  same elements with byte-identical `src` values before and after four consecutive toggles, i.e.
  proving **zero** re-navigation was occurring, not just that the visual result looked right.
- **Manifest/PWA fix (`23e3265f`):** All 11 referenced assets confirmed returning `200` on a
  production build; ticker confirmed readable in both modes (dark text on light, light text on
  dark) after the transparency fix.

---

## 6. A note on concurrent and interleaved work

Three commits landed in the middle of this same working session that are unrelated to the ticker
tape and are **not** covered by this document:

- `bc5d4625` — `fix(preferences): change DEFAULT_PREFERENCES locale from en-US to en-GB`, landed
  between the alphabetization polish and the `displayMode` fix. Confirmed via `git show --stat`:
  touches only `lib/preferences/defaults.ts`-adjacent files, no overlap with `ticker-tape.tsx` or
  its dependencies.
- `2b4e0fb2` / `8239cb7f` — hero copy rebrand ("Gold Trade / XAUUSD positioning"), landed the
  following day between the `displayMode` fix and the runtime-toggle saga. Touches
  `landing-hero.tsx` only.
- `20414545` — hero mascot theme-swap, landed immediately before the runtime-toggle saga began.
  Included here as context rather than excluded outright (see the note at the top of this
  document): its own commit message claimed the ticker tape was already confirmed theme-aware,
  which the very next commit in the sequence (`f4747820`) found to be incomplete — the mascot
  session's own "toggle the navbar theme button" check happened to land on a page state or timing
  that didn't surface the runtime re-init bug that a wider range of real usage did.

None of these four commits modify `ticker-tape.tsx`, `tradingview-locale.ts`, or the ticker's own
test file.

---

## 7. Git history

Landed as 9 ticker-tape-specific commits on `main` (interleaved with the 4 unrelated commits noted
in §6), each pushed individually with the pre-push hook re-running the full monolith `test:ci`
before allowing the push:

| Commit     | Date (UTC+7)     | Summary                                                                                              |
| ---------- | ---------------- | ---------------------------------------------------------------------------------------------------- |
| `8536b11a` | 2026-09-04 14:07 | `feat(landing): replace simulated ticker with live TradingView ticker tape widget` — §1.1            |
| `fa1ee786` | 2026-09-04 14:28 | `polish(landing): alphabetize ticker tape symbols by display title` — §1.2                           |
| `5d0579a8` | 2026-09-04 15:57 | `fix(landing): force ticker tape displayMode to compact for consistent format` — §1.3                |
| `f4747820` | 2026-09-05 18:27 | `fix(landing): ticker tape going blank on runtime theme toggle` — §1.4 attempt 1                     |
| `e3756bc5` | 2026-09-05 18:49 | `fix(landing): render ticker tape as a direct iframe, not a loader script` — §1.4 attempt 2          |
| `1e3f3cd0` | 2026-09-05 19:15 | `fix(landing): mirror ticker-tape colorTheme into the query string` — §1.4 attempt 3                 |
| `2a004f7e` | 2026-09-05 20:05 | `fix(landing): lock ticker-tape theme at first mount, per Davin's call` — §1.4 attempt 4             |
| `784c4eb1` | 2026-09-05 20:41 | `fix(landing): mount both ticker themes, swap in CSS instead of reloading` — §1.4 final fix          |
| `23e3265f` | 2026-09-05 21:26 | `fix(landing): make ticker opaque; add the missing PWA manifest icons` — §1.4 cosmetic finish + §1.5 |

All 9 commits are present in `origin/main`'s history as of this document's writing (confirmed via
`git merge-base --is-ancestor` against current `HEAD`, `5d013e0b`).

---

## 8. Lessons this arc is worth carrying forward

Not formally promoted into `LESSONS-LEARNED.md` (file is at its documented entry cap per several
other sessions' notes), but worth stating plainly since this codebase will likely embed other
third-party widgets:

- **A third-party "insert a script, it builds its own iframe" embed (TradingView's ticker-tape
  loader, and by extension its other embed widgets) cannot be assumed re-initializable within a
  single-page-app session.** Every incremental fix that tried to make the _existing_ embed
  mechanism re-init more reliably (remount via key, swap iframe `src`, force a real reload via the
  query string, lock and never re-init) either failed outright or traded reliability for
  responsiveness. The fix that actually held stopped trying to re-initialize anything: mount every
  variant once, on the one reliably-working path (a fresh embed on a fresh page load), and switch
  between already-mounted variants in CSS only.
- **A verification that only covers a fresh page load does not cover a runtime, in-place toggle.**
  `20414545`'s own "confirmed live by toggling the navbar theme button" check was real, but the
  bug it missed only manifested through the specific timing/DOM-lifecycle path a runtime toggle
  triggers — not a full reload with a different starting cookie. When a component reads a live app
  setting reactively, both paths need their own live check.
- **A URL that changes only in its hash fragment is not guaranteed to trigger a real navigation.**
  `colorTheme` living only in `TradingView`'s hash-fragment config meant an `src` update where only
  the hash differed was treated as an in-page fragment navigation by the browser, identical to
  `<a href="#x">` — not a document reload. Any embed that encodes config in a URL fragment needs
  its query string (or path) to differ too, if a real reload is required.
