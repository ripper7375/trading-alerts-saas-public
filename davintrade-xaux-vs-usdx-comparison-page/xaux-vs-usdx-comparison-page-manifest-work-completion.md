# XAUX vs USDX Comparison Page Manifest — Work Completion Report

**Date:** 2026-09-13
**Status:** Code complete, verified, and live-browser-checked, across three rounds, all committed
and pushed to `origin/main`. Round 1 is the page itself (chart, route, button). Round 2 added chart
drawing tools, the rebase-for-display controls, and the DavinTrade watermark. Round 3 is a bugfix:
Davin caught, from the real production page, that the drawing tools he'd just gotten in Round 2 had
already disappeared — see §1.8 for the root cause and §4's account of two further bugs found while
fixing it. No database migration is needed for anything in this document, in any round — see §1.1
and §5.2.
**Type:** Ad-hoc feature session (Davin-requested directly in chat, across several follow-up
messages, each with its own annotated screenshot or diagram as the spec) — outside the
phase/session numbering, per `docs/migration-orders/EXECUTOR-PROTOCOL.md` §6.

> **Scope note:** this document covers the **XAUX vs USDX Comparison Page** — a small, single-page
> extension of the already-live **Lane 4 Currency & Gold Index Stack**
> (`currency_gold_indices`, the public landing-page widget). It is a distinct, much smaller feature
> from the **Currency Index PRO Plan** documented in
> `davintrade-currency-index-pro-plan/currency-index-pro-stack-manifest-work-completion.md`: this
> page is **public and unauthenticated** (both FREE-tier and PRO visitors, and anonymous ones, can
> reach it), shows only 2 of the 9 Lane 4 indices, spans a genuine multi-day history rather than
> "today's session only," and adds no new database table, migration, or PRO gate. See
> [`davintrade-currency-index-stack/currency-index-manifest-work-completion.md`](../davintrade-currency-index-stack/currency-index-manifest-work-completion.md)
> for Lane 4's own manifest — this document does not duplicate it, only extends it, reusing the
> same `CurrencyGoldIndex` Prisma model and reading from it directly.

---

## 1. What was built

Davin supplied a screenshot of the live `davintrade.app` landing page
(`landing-page-with-currency-index-XAUX-vs-USDX-page.png`, in this same folder) with a red
annotation specifying the requirement directly: add a "XAUX vs USDX Comparison chart" button below
the landing-page Hero widget; clicking it navigates to a page showing XAUX and USDX as two line
plots; both FREE and PRO users can reach it; both indices are capped at 3000 bars; both M5 and M15
timeframes are available via a toggle. Planned and implemented in one session — this is a single
verifiable unit of work, not a multi-phase build like the PRO Plan.

### 1.1 A foundational finding: no timeframe column, and XAUX's reopen isn't 15-minute-aligned

`CurrencyGoldIndex` (Lane 4's Phase 1 schema) stores exactly **one point value per 5-minute bar**
per index — there is no OHLC to resample and no `timeframe` column at all, the identical
"M15 means sampling, not aggregating" finding the Currency Index PRO Plan's own Phase 2 already
made for its own (today-only) chart. That plan's `sampleM15Bars()` (`lib/currency-index-pro/
math.ts`) solves this for a **single day**, taking one `sessionOpenBarTime` for the whole array —
correct for "today only," but this comparison chart needs up to 3000 bars, which spans many days
(a M15 view can span 4-6+ weeks of trading days). Re-deriving each day's session boundary in
TypeScript would have meant re-porting the Eightcap DST-offset logic a second time, which
`currency_gold_index_engine.py`'s own architecture deliberately keeps in exactly one place (per
Lane 4's Phase 1 manifest).

**Resolved without any new DST logic and without a per-day loop**, because every row in
`currency_gold_indices` already carries **its own day's** `session_open_bar_time` (stamped by the
VPS engine at push time, per Lane 4's own schema). A new pure function,
`isM15CloseBar(barTime, sessionOpenBarTime)` (`lib/currency-gold-indices/history.ts`), tests each
row against its own stored anchor directly — no grouping, no per-day boundary re-derivation needed.

**This mattered concretely, not just in theory, because XAUX's own daily reopen (01:01 server time,
per Lane 4's Phase 1) is genuinely NOT a clean 15-minute offset from midnight the way the 8 FX-based
indices' 00:00 reopen is.** `01:01` is 3660 seconds past midnight; `3660 mod 900 = 60`, not `0`. A
single global "every bar where `bar_time mod 900 === 600`" shortcut — which would have worked
correctly for USDX — silently gives the wrong answer for XAUX specifically. Per-row anchoring
sidesteps this correctly for both indices without needing to special-case XAUX at all.

### 1.2 Read layer + public API route

- **New** `lib/currency-gold-indices/history.ts`: `isM15CloseBar()` (above), plus
  `MAX_COMPARISON_HISTORY_BARS = 3000` and `COMPARISON_CHART_INDEX_NAMES = ['XAUX', 'USDX']` as
  named constants rather than magic numbers/a generic `indices=` query param — this route has
  exactly one purpose (this one comparison), not a general-purpose history API, matching the
  feature's own precisely-scoped request.
- **New** `getCurrencyGoldIndexHistory(timeframe)` in `lib/currency-gold-indices/queries.ts`: queries
  XAUX and USDX **independently** (one index's query failure or data gap can never suppress the
  other's), ordered `bar_time desc` + `take` to bound the query, then reversed to ascending for chart
  consumers. An M15 request reads **3x** the row limit (9000 raw M5 rows) before filtering down to
  M15-close bars, since there is nothing to aggregate — the same "M15 is a subset of M5, not a
  computed thing" fact this stack's math already established.
- **New** `GET /api/market/currency-gold-indices/history?timeframe=M5|M15` — the **second** genuinely
  public, unauthenticated route in this lane (the first being the existing snapshot route the Hero
  widget already uses). Same cache-aside shape as that route: Redis via `lib/cache/cache-manager.ts`
  (60s TTL, now keyed by timeframe since M5/M15 are genuinely different queries/payloads, unlike the
  snapshot route's single always-"today" key), falling back to Postgres gracefully on a Redis outage,
  `public, s-maxage=60` response caching (no session, same response for every visitor).

### 1.3 Frontend: chart, hook, page, and the landing-page button

- **New** `components/market/xaux-usdx-comparison-chart.tsx` — a 2-line `lightweight-charts` v5
  component, deliberately mirroring `components/currency-index-pro/chart/
relative-strength-chart.tsx`'s exact lifecycle split (one mount-only effect creates the chart +
  series, separate reactive effects push appearance/height/data changes via `applyOptions()`/
  `setData()` without ever tearing the chart down) rather than inventing a new pattern — the proven
  shape for a line chart in this codebase. Deliberately simpler than that component: 2 fixed series,
  no corridor lines, no news markers, no PRO gating, since this is a public marketing page, not the
  PRO screener. Gold/amber for XAUX (this app's own brand accent), blue for USDX (the same USD slot
  `lib/currency-index-pro/colors.ts` already uses for its own USD line) — both themed correctly for
  light/dark, each carrying a visible on-chart title + last-value label so identity never rests on
  hue alone.
- **New** `components/market/useCurrencyIndexHistory.ts` — an SWR hook mirroring
  `useCurrencyGoldIndices.ts`'s own reasoning for using SWR at all (this route is genuinely public
  and cached, unlike every session-gated sibling), keyed by timeframe so switching the M5/M15 toggle
  fetches its own series independently.
- **New** `app/(marketing)/xaux-vs-usdx/page.tsx` — public page under the `(marketing)` route group
  (same group as `/econ-news`/`/academy`), which `middleware.ts`'s `PROTECTED_PREFIXES` never
  covers, so it needs no auth check of its own to satisfy "both FREE and PRO users could access this
  page" — anonymous visitors reach it too, same as every other page in that group. M5/M15 toggle
  buttons, the 2-line chart, and the two indices' existing tooltip definitions
  (`CURRENCY_GOLD_INDEX_METADATA`) reused as a legend, rather than writing new copy. Renders
  "No data available yet" when both series are empty (Lane 4's own "an absent row is the honest
  rendering" rule, not a placeholder or broken-looking chart) — the honest state today, since the
  Lane 4 VPS engine has not been deployed yet (§5.1). **As originally built, this REPLACED the
  chart entirely; §1.8 (Round 3) changed this to an overlay once drawing tools made that a real
  problem — the honest-rendering intent is unchanged, only the mechanism.**
- **`components/landing/landing-hero.tsx`** — the "XAUX vs USDX Comparison chart" button added
  directly below `<CurrencyIndexHeroWidget />`, per Davin's own annotated screenshot. Shown
  **unconditionally**, unlike the widget above it (which renders nothing with no live data yet) —
  a deliberate choice: the button is a static marketing entry point, not itself data-dependent, and
  the destination page owns its own loading/empty state.
- **Dictionary entries** — 5 new identity-mapped keys added to `en-US.json`/`en-GB.json`, matching
  Lane 4's own established convention for this feature's copy (not yet translated into other
  dictionaries, degrades to English elsewhere, same precedent as the rest of Lane 4).

### 1.4 Two real bugs caught in the Executor's own test-writing, not shipped

- **A flawed test assertion, caught by the arithmetic rather than assumed correct:** an early draft
  of `isM15CloseBar`'s test suite asserted that testing a bar against "the wrong day's anchor" must
  return `false`. It does not, and correctly so — a whole day (86400s) is itself an exact multiple
  of 900s, so shifting both the bar and a same-time-of-day anchor by one full day changes nothing
  about the modulo result. The assertion was replaced with a genuinely discriminating one: testing
  an XAUX bar (anchor offset 60s past the hour) against an **FX index's** anchor (offset 0) — a
  difference that is _not_ a multiple of 900 — which correctly flips the answer, proving the
  function actually depends on which anchor it is given rather than only on time-of-day.
- **A mock-ordering bug in the query test, caught by a failing assertion rather than left silently
  wrong:** a test for the M15 filter built its mocked Prisma rows in **ascending** time order, but
  the real query expects Prisma to return rows **descending** (`orderBy: bar_time: 'desc'`) and
  reverses them itself — feeding it already-ascending data caused the reversal to invert the order a
  second time, and the test failed with the two M15-close bars swapped. Fixed by building the mock
  in descending order, matching what a real `findMany` call actually returns.

### 1.5 Round 2 — chart drawing tools (all 6 terminal drawing tools, reused)

Davin asked, with a screenshot of the target toolbar overlaid on this exact page, to add chart
drawing functionality, naming the existing terminal drawing-engine codebase
(`docs/../DRAWING-ENGINE-AND-LINE-ALERTS-ARCHITECTURE.md`, `components/charts/drawing/*`) as the
reference to study, and explicitly scoping it down: "Just drawing functions that I need. No need to
do any alert creation on lines drawn."

- **Read the terminal's own drawing-engine architecture doc and every file under
  `components/charts/drawing/` before writing anything**, confirming the engine layer
  (`DrawingEngine`, `PointerController`, `coords.ts`, all 6 `Mark` classes, `tools/index.ts`,
  `StyleEditor.tsx`) is already fully series-type- and auth-agnostic — no `useSession()`/tier check,
  no DB call, anywhere below the existing `DrawingLayer.tsx` wiring layer itself. This meant the
  entire engine, all 6 tools, and the style editor could be reused byte-for-byte; only a new, much
  thinner wiring layer was needed for this page.
- **New** `components/market/comparison-drawing-layer.tsx` — a scoped-down sibling of
  `components/charts/drawing/DrawingLayer.tsx`, not a modification of it: no `useSession()`/PRO-tier
  gating, no DB-backed persistence via `/api/drawings` (this page has no signed-in user to own a
  row), and no `AlertDialog`/`AlertsPanel`/"Add alert" wiring at all, per Davin's own explicit
  instruction. Drawings live only in the `DrawingEngine`'s in-memory state for as long as the chart
  stays mounted — they survive the M5/M15 toggle (which only swaps data, not the chart/series
  instances) and are lost on a page reload, by design, not by oversight.
- **New** `components/market/comparison-chart-toolbar.tsx` — a separate, smaller toolbar (Select,
  the 6 tools, Style, Delete) rather than adding a "hide the alert buttons" branch to the terminal's
  own `Toolbar.tsx`; keeps a well-tested, shared component untouched for a page that has nothing to
  do with alerts.
- `components/market/xaux-usdx-comparison-chart.tsx` now exposes `chartApi` and the XAUX line
  series via state (mirroring `relative-strength-chart.tsx`'s own reason for doing the same) so
  `ComparisonDrawingLayer` can attach once both exist.
- **A real investigation during verification, not a shrug** — see §4 for the full account of a
  canvas-click automation false alarm and a single dev-only "Object is disposed" console error,
  both traced to their actual root cause rather than assumed harmless.

### 1.6 Round 2 — "Rebase for display" (visual separation controls)

Davin flagged, with an annotated before/after diagram, that both indices share the same 100.00
inception value, so their overlaid lines can sit very close together, and asked for a way to spread
them apart visually by letting a visitor set each index's own display "base" between 50 and 150
(his own worked example: XAUX based at 115, USDX based at 85).

- **A pure display transform, applied at the last possible moment — deliberately not a change to
  any upstream value.** `XauxUsdxComparisonChart` takes an optional
  `rebase: Partial<Record<string, number>>` prop; each bar's plotted value becomes
  `bar.value + (base - 100)` right before `setData()` — a constant, shape-preserving vertical shift,
  not a rescale, so a rebased curve's shape and amplitude stay pixel-identical to the real one, just
  translated. The `series` prop itself, the API route, the cache, and the database all still carry
  the real, un-rebased value at all times — confirmed live (§4) by checking the last-value label
  reverts to the real number (103.67) the instant Reset is pressed.
- **New "Rebase for display" panel** on the page: two `Slider`s (the existing shared
  `components/ui/slider.tsx` — the same component the Currency Index PRO Plan's own HRMA/SMMA
  what-if sliders already use, reused rather than building a new range control), range 50-150 per
  Davin's own spec, defaulting to 100/100, plus a Reset button (disabled once both are already at
  default) and an explanatory caption stating plainly that this is display-only and does not change
  the real XAUX/USDX values.
- Changing a rebase value re-runs the chart's data-push effect (now depending on `rebase` too) but
  never re-triggers `fitContent()` — the existing `isFirstLoadRef` guard (built for the 60s
  data-refresh case) already covers this, so dragging a slider can never reset a visitor's own
  zoom/pan.

### 1.7 Round 2 — "DavinTrade" background watermark, theme-reactive

Davin asked for a "DavinTrade" watermark on the chart background, since this page is open to any
visitor as a marketing surface, with an explicit requirement that it must follow the light/dark
theme toggle correctly.

- Uses Lightweight Charts v5's own official plugin API, `createTextWatermark(pane, options)`
  (confirmed present in the installed `lightweight-charts@^5.2.0` by reading its own type
  definitions before using it, not assumed from a v4-era memory of the library) attached to
  `chart.panes()[0]` — a real pane primitive, not a CSS overlay or a 3rd series, so it can never
  intercept pointer events meant for the drawing layer or the chart's own pan/zoom, and it repaints
  correctly on resize/theme change like any other primitive.
- Deliberately faint: `rgba(148, 163, 184, 0.12)` in dark mode, `rgba(51, 65, 85, 0.08)` in light —
  the SAME muted tone `chartChromeColors()` already uses for axis-label text in each theme, just at
  much lower opacity, so the mark ties into the chart's existing palette rather than introducing a
  third color, and never competes with the two data lines.
- Created once at chart-mount time with the initial theme's color, then re-applied wholesale (the
  full `lines` array, not just `color`, since a pane primitive's `applyOptions` array fields are not
  guaranteed to deep-merge element-by-element) inside the SAME reactive effect that already pushes
  background/grid/line-color changes on every `resolvedTheme` change — confirmed correct in both
  directions with a live theme toggle (§4), and detached in the chart's own unmount cleanup
  alongside `chart.remove()`.

### 1.8 Round 3 — bugfix: drawing tools were unreachable in production

Davin reported, from a screenshot of the real `davintrade.app` page, that the drawing toolbar he'd
seen "float on chart" had disappeared.

**Root cause: not a regression in the drawing feature itself — a pre-existing conditional that
predates it.** Confirmed directly against production first, not assumed:
`GET https://www.davintrade.app/api/market/currency-gold-indices/history?timeframe=M15` returns
`{"series":[{"symbol":"XAUX","bars":[]},{"symbol":"USDX","bars":[]}]}` — genuinely empty, because
Lane 4's VPS engine still isn't deployed (§5.1, unchanged since Round 1). The page's own
`{!isLoading && !hasData ? <p>No data...</p> : <XauxUsdxComparisonChart .../>}` ternary — written in
Round 1, before drawing tools existed — swaps the ENTIRE chart out for a plain text message whenever
there are no bars. Since Round 2's toolbar/watermark only exist once `XauxUsdxComparisonChart`
mounts, they were never reachable in production at all, on any page load, regardless of the drawing
feature's own code being correct. Davin most likely saw the toolbar during the Round 2 verification
session itself (live-browser-checked with a temporarily-injected, since-reverted mock series), not
against the real, always-empty production data.

**Fix:** the chart now mounts unconditionally; the "No data available yet." message floats on top as
a small, non-blocking hint (`pointer-events-none`) instead of replacing the chart, mirroring
`trading-chart.tsx`'s own established pattern of overlaying a status message over an
already-mounted chart. The toolbar, the watermark, and all 6 drawing tools are now usable
immediately, independent of whether Lane 4 has ever pushed a single row — drawing was never a
consumer of price data in the first place. Once Lane 4's VPS goes live, the hint disappears and
lines appear, with zero further code change.

**Two more real bugs found and fixed while building this fix — see §4 for the full investigation
of both:**

- `bg-background/80` (the hint's first backdrop) silently rendered fully transparent in this app's
  Tailwind setup.
- Even after fixing the color, the hint still didn't render at all until given an **explicit
  `z-10`** — a plain `z-index: auto` sibling does not reliably paint above the chart's own
  `<canvas>` layers here, the same reason the drawing toolbar itself already carries `z-10`.

---

## 2. Files changed

| File                                                                                               | Change                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/currency-gold-indices/history.ts`                                                             | **Added.** `isM15CloseBar()`, `MAX_COMPARISON_HISTORY_BARS`, `COMPARISON_CHART_INDEX_NAMES`, `ComparisonTimeframe`                                                                                                                                                           |
| `lib/currency-gold-indices/queries.ts`                                                             | New `getCurrencyGoldIndexHistory()` + its result types                                                                                                                                                                                                                       |
| `lib/cache/cache-manager.ts`                                                                       | New timeframe-keyed cache helpers for the history route                                                                                                                                                                                                                      |
| `app/api/market/currency-gold-indices/history/route.ts`                                            | **Added.** `GET .../history?timeframe=M5\|M15` — public, unauthenticated                                                                                                                                                                                                     |
| `components/market/useCurrencyIndexHistory.ts`                                                     | **Added.** SWR hook, keyed by timeframe                                                                                                                                                                                                                                      |
| `components/market/xaux-usdx-comparison-chart.tsx`                                                 | **Added** (Round 1), **further modified** (Round 2): exposes `chartApi`/the XAUX series so `ComparisonDrawingLayer` can attach (§1.5); new `rebase` prop + additive display-shift transform (§1.6); "DavinTrade" `createTextWatermark` pane primitive, theme-reactive (§1.7) |
| `app/(marketing)/xaux-vs-usdx/page.tsx`                                                            | **Added** (Round 1), **further modified** (Round 2 rebase panel; Round 3 bugfix): chart now mounts unconditionally with a floating, `z-10`, `pointer-events-none` "no data" hint instead of replacing the chart (§1.8)                                                       |
| `components/landing/landing-hero.tsx`                                                              | "XAUX vs USDX Comparison chart" button wired in                                                                                                                                                                                                                              |
| `lib/i18n/dictionaries/{en-US,en-GB}.json`                                                         | 5 keys Round 1 (button, heading, badge, subtitle, empty state) + 4 keys Round 2 (rebase panel title/caption/Reset/two slider labels) — 9 new identity-mapped keys total                                                                                                      |
| `components/market/comparison-chart-toolbar.tsx`                                                   | **Added** (Round 2). Scoped-down drawing toolbar — no alert buttons (§1.5)                                                                                                                                                                                                   |
| `components/market/comparison-drawing-layer.tsx`                                                   | **Added** (Round 2). Wires the terminal's own `DrawingEngine` with no auth/persistence/alerts (§1.5)                                                                                                                                                                         |
| `__tests__/lib/currency-gold-indices/history.test.ts`                                              | **Added.** 6 tests, pure `isM15CloseBar()` unit tests                                                                                                                                                                                                                        |
| `__tests__/api/currency-gold-indices-history.test.ts`                                              | **Added.** 14 tests, mirroring `currency-gold-indices.test.ts`'s own structure                                                                                                                                                                                               |
| `__tests__/components/landing/landing-and-auth-navigation.test.tsx`                                | 1 new test — the button's `href` resolves to `/xaux-vs-usdx`                                                                                                                                                                                                                 |
| `davintrade-xaux-vs-usdx-comparison-page/xaux-vs-usdx-comparison-page-manifest-work-completion.md` | **Added** (Round 1), **updated** (Round 2, this update)                                                                                                                                                                                                                      |

**Round 1: 13 files touched** (7 added, 5 modified, the manifest the 13th). **Round 2 adds 2 new
files** (`comparison-chart-toolbar.tsx`, `comparison-drawing-layer.tsx`) **and further modifies 3
already-listed files** (`xaux-usdx-comparison-chart.tsx`, the page, both dictionaries) — no new
automated test files this round; see §3 for why. **Round 3 touches only the page** — a
same-file bugfix, no new files.

---

## 3. Test verification

| Suite                                                         | Result                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npx tsc --noEmit` (monolith)                                 | Clean, before and after the test-bug fixes in §1.4                                                                                                                                                                                                                                                                                                                       |
| ESLint (monolith)                                             | Clean, 0 warnings, every new/changed file                                                                                                                                                                                                                                                                                                                                |
| `isM15CloseBar` unit tests                                    | **6/6** — FX-index triplet pattern, XAUX's own non-15-min-aligned anchor, a data-gap bar, a before-session-open bar, cross-day correctness, and the FX-vs-XAUX wrong-anchor discriminating case (§1.4)                                                                                                                                                                   |
| `getCurrencyGoldIndexHistory` + `GET .../history` route tests | **14/14** — both indices queried independently; ascending output order; M15 filtering; the 3x row-limit for M15 vs. the 3000 cap for M5; one index degrading to empty on a query failure without affecting the other; no-auth; default/invalid-timeframe handling; cache hit/miss/outage (read and write) parity with the sibling snapshot route; public `Cache-Control` |
| `landing-and-auth-navigation.test.tsx`                        | **1 new test** — the button links to `/xaux-vs-usdx`; all pre-existing tests in this file unaffected                                                                                                                                                                                                                                                                     |
| Full monolith `npm run test:ci` (Round 1)                     | **198/198 suites, 2657/2657 tests** — up from the prior 196/2636 baseline by exactly this session's own 2 new suites/21 new tests, zero regressions elsewhere                                                                                                                                                                                                            |
| `npx tsc --noEmit` / ESLint (Round 2, all 3 sub-features)     | Clean throughout — checked after drawing tools, again after rebase, again after the watermark                                                                                                                                                                                                                                                                            |
| Full monolith `npm run test:ci` (Round 2, all 3 sub-features) | **198/198 suites, 2657/2657 tests** — identical count after each of the 3 sub-features, confirming zero regressions from any of them                                                                                                                                                                                                                                     |
| `npx tsc --noEmit` / ESLint (Round 3 bugfix)                  | Clean, re-checked after each of the 3 iterations (the ternary fix, the `bg-background/80`→`amber-500` fix, the `z-10` fix)                                                                                                                                                                                                                                               |
| Full monolith `npm run test:ci` (Round 3 bugfix)              | **198/198 suites, 2657/2657 tests** — unchanged, zero regressions                                                                                                                                                                                                                                                                                                        |

**Round 2 deliberately added no new automated test files.** Drawing tools, the rebase transform,
and the watermark are all chart-canvas rendering/interaction concerns — this codebase's own
established precedent (`components/currency-index-pro/chart/relative-strength-chart.tsx` has zero
dedicated test file either, and `CLAUDE.md`'s own history notes jsdom's `ResizeObserver` stub gives
canvas-sizing logic "no meaningful coverage" even where a test file does exist) is to verify these
via a real browser rather than jsdom, which is what §4 below is. The one genuinely pure, easily unit-
testable piece Round 2 added — the rebase additive-offset arithmetic — is a one-line expression
(`bar.value + (base - 100)`) with no branching to exercise; live-verifying the actual rendered
separation (§4) is stronger evidence for it than a unit test asserting `115 - 100 === 15` would be.
**Round 3 is the same story again, more so** — a conditional-rendering and CSS-stacking bug that
only a real browser paint could have caught at all; a jsdom test asserting the JSX tree would never
have seen either the transparent-background bug or the missing-`z-10` bug, since jsdom performs no
actual layout, paint, or canvas compositing.

---

## 4. Live browser verification

Ran a real `next dev` (Turbopack) server and drove it directly, per this repo's own standing rule
that UI changes are checked in a browser before being reported complete.

- **The button:** renders on the live landing page directly below the Hero widget, at both mobile
  (375px) and desktop viewports, matching Davin's own annotated screenshot's placement and styling
  (amber-bordered, full-width of the widget column).
- **Navigation:** clicking the button navigates to `/xaux-vs-usdx`; the page renders the header,
  badge, subtitle, M5/M15 toggle, and both index definitions correctly — including confirming live
  that the corrected XAUX definition (5-currency gold basket, per the 2026-09-13 XAUX formula fix
  in Lane 4's own manifest) renders on this new page too, since it reuses the same
  `CURRENCY_GOLD_INDEX_METADATA` source.
- **Empty state, confirmed genuine, not simulated:** with no live VPS data (Lane 4's own still-open
  Phase 5 blocker), the chart card correctly shows "No data available yet" rather than a broken or
  placeholder chart — the network tab confirmed a real `200 OK` to
  `/api/market/currency-gold-indices/history?timeframe=M15` returning empty series, not an error
  being swallowed. **(As originally built here in Round 1, this replaced the chart entirely — the
  correct behavior at the time, since drawing tools didn't exist yet. Round 3's own §4 account
  covers the Round 3 fix that turned this into a non-blocking overlay instead.)**
- **The M5/M15 toggle:** clicking `M5` fires a new, independent request
  (`...history?timeframe=M5`) rather than re-using the M15 response; both requests returned `200`.
- **With data (temporarily injected synthetic sine-wave series directly into
  `getCurrencyGoldIndexHistory()`, screenshotted, then fully reverted — confirmed via `git diff
--stat` showing a pure `+81/-0` addition, matching the intended function exactly, nothing left
  behind):** the chart rendered two clearly distinguishable, correctly colored, correctly labeled
  lines (`XAUX` in gold with a live value label, `USDX` in blue with a live value label), a price
  scale, and a time scale. Toggling the app's own theme to dark live re-themed the chart's
  background, grid, and both line colors correctly, with zero teardown/flicker (confirming the
  reactive-appearance effect, copied from `relative-strength-chart.tsx`'s own proven pattern, works
  here too). Clicking M5 while data was present re-rendered cleanly with the new series.
- **Console:** zero new errors. The one console warning present throughout (`allowTransparency`) is
  the same pre-existing, already-documented, unrelated warning from `ticker-tape.tsx`'s TradingView
  embed that Lane 4's own Phase 4 manifest already traced and ruled out.

### Round 2 — drawing tools

- **Toolbar:** renders exactly matching Davin's own screenshot — Select highlighted, the 6 tool
  icons in the same order, then Style and Delete, with no Bell/Alerts-panel buttons (correctly
  absent, per the scope in §1.5).
- **⚠ A real investigation, not a shrug — canvas-click automation initially appeared to make
  drawing fail entirely.** Two clicks on the chart canvas (via the standard `computer` click tool)
  produced nothing but the chart's own default crosshair, with the Trendline button staying
  "armed." Rather than assume a code defect, isolated the cause by calling `DrawingEngine`'s own
  public methods directly through a temporary `window.__debugEngine` hook (removed before commit,
  confirmed via a clean `git diff` afterward): the exact same two-anchor sequence succeeded
  immediately and rendered a correctly-positioned, correctly-selected trendline with handles —
  proving the engine itself was never the problem. Further probing found the real cause: the
  temporary verification mock's own `Date.now()` anchor was reshuffling every bar's absolute time
  on each 60-second SWR poll (an artifact of the throwaway mock, since real production data is
  append-only and never reshuffles existing bar times), which had left the chart's fitted visible
  range briefly out of sync with what was plotted. Confirmed the fix by reloading fresh and testing
  coordinates across the full chart width immediately after load — every one resolved correctly
  except the price-axis gutter itself, which correctly rejects a click (there's no time/price to
  anchor to there). Also live-verified: the Style editor (color swatch, line-width, line-style,
  matching the exact terminal `StyleEditor.tsx` component), Delete, and drawing 5 horizontal lines
  at once, all via real UI clicks once the above was understood.
- **⚠ One dev-only console error, investigated and ruled unrelated, not silently ignored.** A
  single "Object is disposed" error surfaced from the charting library's internal
  `DevicePixelContentBoxObserver`. Located its exact position in the console log: sandwiched
  between a burst of unusually slow "[Fast Refresh] done in 7546ms" lines and a brand-new HMR
  websocket id — i.e. it coincided precisely with a Next.js Fast-Refresh rebuild triggered by the
  Executor's own file edit while the tab stayed open mid-session, not with any user interaction. It
  occurred exactly once across the entire verification session and never recurred across any
  subsequent fresh page load, theme toggle, slider drag, or draw/delete/style-edit action — the
  same class of dev-mode-only React/Fast-Refresh teardown race this codebase's own history already
  documents elsewhere (the EconNews TradingView-widget Strict-Mode race). A real visitor's page
  loads once and never Fast-Refreshes mid-session, so this cannot reach production.

### Round 2 — rebase for display

- Dragged XAUX to 115 and USDX to 85 (Davin's own worked example) via keyboard (arrow-key
  increments on the focused `Slider` thumb, chosen deliberately over pixel-drag given the
  canvas-coordinate caveat above): the two curves visually separated exactly as intended (XAUX
  ~112-118, USDX ~84-88), and the last-value labels updated to show the REBASED numbers (e.g. real
  103.67 → displayed 118.67).
- Reset correctly snapped both back to 100.00, the curves rejoined, the Reset button itself
  correctly disabled once both were back at default, and the last-value label reverted to the real,
  un-rebased 103.67 — direct visual proof that the underlying value was never touched.
- Confirmed a rebase change never resets the chart's own zoom/pan (the `isFirstLoadRef` guard, per
  §1.6), and that the M5/M15 toggle and drawing tools both keep working correctly with a rebase
  active.

### Round 2 — DavinTrade watermark

- Confirmed rendering centered behind both data lines in dark mode (faint light-slate text), then
  toggled the app's REAL theme switch (not a simulated `prefers-color-scheme` media query) and
  confirmed the SAME watermark re-rendered correctly in light mode (faint dark-slate text) with zero
  flicker or teardown — the existing reactive-appearance effect, already proven for chart chrome,
  now also correctly covers the watermark.
- Confirmed the watermark does not block or interfere with the drawing toolbar/tools — armed the
  Trendline tool with the watermark visible on screen, no errors, toolbar responded normally.

### Round 3 — bugfix verification

- **Confirmed the actual production symptom first, not assumed.** Hit
  `GET https://www.davintrade.app/api/market/currency-gold-indices/history?timeframe=M15` directly
  and read back a genuinely empty `{"XAUX":[],"USDX":[]}` — the report was real, and its cause was
  data availability, not a code regression in Round 2's drawing feature.
- **⚠ Bug #1, found and fixed: `bg-background/80` renders fully transparent.** After making the
  chart mount unconditionally, the "No data available yet." hint still didn't visually appear.
  Isolated this precisely rather than guessing: injected a test element with `bg-black/50` via
  `javascript_tool` and confirmed it computed to a real `rgba(0,0,0,0.5)`, then checked the hint's
  own element and found `background-color: rgba(0, 0, 0, 0)` — fully transparent — despite an
  identical opacity-modifier syntax. Confirmed the difference is CSS-variable-based tokens
  specifically: `bg-background` (no modifier) works correctly elsewhere in this exact app (checked
  the M5/M15 toggle's own active-state background), so the failure is isolated to applying a `/NN`
  opacity modifier on top of a custom-property-based color, not opacity modifiers in general.
  Switched to the same `amber-500/15` + `amber-500/40` literal-palette-color pattern this page's
  own header badge already uses successfully.
- **⚠ Bug #2, found and fixed: still invisible even with a working color.** With the transparency
  bug fixed, the hint STILL didn't render. Forced a `3px solid red` outline directly onto the live
  element via `javascript_tool` and re-screenshotted — nothing changed, definitively ruling out a
  subtle-contrast explanation. Cross-checked against a deliberately unmistakable diagnostic (a
  `position: fixed`, bright-red, `z-index: 99999` test div), which DID render correctly, proving the
  Browser pane's screenshot mechanism itself was not at fault. The one concrete difference between
  what worked and what didn't: the drawing toolbar (visible in every screenshot throughout this
  entire manifest) carries an explicit `z-10`; the hint's container did not (`z-index: auto`).
  Setting `zIndex = '10'` on the live element via `javascript_tool` made it appear immediately,
  confirming the diagnosis before touching source code. Applied `z-10` in
  `app/(marketing)/xaux-vs-usdx/page.tsx` and confirmed in three separate fresh browser tabs
  (avoiding this environment's own documented dev-HMR staleness artifact) that the hint, the
  watermark, and the toolbar all now render correctly together, with no source changes left
  uncommitted (`javascript_tool` edits never touch the file on disk).
- **Confirmed in both themes, per Davin's own explicit ask this round.** Toggled the app's real
  theme switch with the chart in its genuine, always-empty production state: the toolbar, the
  "DavinTrade" watermark, and the amber "No data available yet." hint all render correctly and with
  good contrast in both light and dark mode, together, in the same screenshot.
- Confirmed the drawing overlay's own pointer-capture element (`pointer-events: auto`) is
  unaffected by the new `z-10` hint (`pointer-events: none`) sitting visually above it — armed the
  Trendline tool and confirmed the toolbar still responds normally with the hint on screen.

---

## 5. What you still need to do

Nothing here is a code defect — every item below is either inherited from Lane 4's own still-open
physical deployment items, or a live/authenticated check the Executor is categorically barred from
performing on its own (never authenticates as a real user).

### 5.1 The live-VPS blocker this page inherits from Lane 4

This page reads `currency_gold_indices` directly, and that table has zero real rows in production
today — Lane 4's own manifest (§5.1 of `currency-index-manifest-work-completion.md`) already tracks
the 2 remaining physical VPS steps: attaching the OHLCV exporter to 8 MT5 charts, and registering
the currency-index engine as a Windows service. **This page does not duplicate tracking that gap**
— until those 2 steps happen, this page will correctly keep showing a "No data available yet." hint
floating over an otherwise-empty, but fully drawable, chart (§1.8's Round 3 fix), the same honest-
rendering intent the Hero widget above it follows by rendering nothing at all. Once Lane 4's own
VPS items land, this page starts showing real data with zero further code changes.

### 5.2 No database migration needed, and none was authored

Unlike Lane 4's own Phase 2 or the Currency Index PRO Plan's Phase 1, this feature adds **zero** new
Prisma models, columns, or migrations — it only adds a new read pattern (a bar-capped, multi-day
history query) against the `CurrencyGoldIndex` table Lane 4 already created and migrated to
production on 2026-09-11. There is nothing for Davin to apply here.

### 5.3 Authenticated/real-data verification once Lane 4's VPS items land

- [ ] **A real multi-day chart render** — every check in §4 with real data used a temporarily
      injected synthetic series, reverted before commit; the actual visual shape of 3000 real bars
      of XAUX/USDX (including the daily reset-to-100 sawtooth pattern both indices exhibit by
      construction) has never been observed.
- [ ] **Formula correctness of the underlying values at scale** — this page is a pure consumer of
      `CurrencyGoldIndex.value`; any correctness question about the values themselves belongs to
      Lane 4's own still-open "formula correctness against real market data" item, not this page.
- [ ] **A cache-TTL sanity check under real traffic** — same open item as Lane 4's own Hero widget
      (§5.2 of that manifest), now doubled by this page's own second, timeframe-keyed cache key.
- [ ] **Mobile-viewport click-through with real data** — the empty-state and layout were confirmed
      responsive by construction and checked at both viewports in §4, but a real multi-line chart's
      legibility at 375px width with genuine data has not been screenshotted.

### 5.4 Smaller, non-blocking follow-ups

- **Translation:** all 9 strings this page adds (5 Round 1 + 4 Round 2) are English-only
  (identity-mapped in `en-US`/`en-GB` only), matching the rest of Lane 4's own established
  precedent for newly-shipped marketing copy — a future locale pass, not an oversight.
- **No navbar link:** this page is reachable only via the landing-hero button, per the feature's own
  scope (Davin's annotation named the button specifically, not a navigation entry) — a deliberate
  choice, not a gap, consistent with `/econ-news`/`/academy` both having navbar links added
  separately and explicitly when that was actually asked for.
- **No automated test coverage for the drawing tools, the rebase transform, or the watermark** —
  deliberate, not an oversight; see §3's own note on why this matches established precedent for
  chart-canvas features in this codebase. If this page's drawing/rebase/watermark behavior ever
  needs to be pinned by CI (e.g. before a larger refactor of the shared `components/charts/
drawing/` engine), a Playwright spec would be the right tool, not a jsdom unit test.
- **Drawn lines are not saved.** By Davin's own explicit scope ("just drawing functions," no alert
  creation), drawings live only in memory for the page's current visit and vanish on reload. If a
  future ask wants them to persist for a returning anonymous visitor, the natural mechanism is
  `localStorage` keyed by symbol/timeframe (a per-viewer convenience, matching this codebase's own
  established use of `localStorage` for exactly that class of preference) — not the terminal's
  authenticated `/api/drawings` route, which has no anonymous-visitor concept at all.

---

## 6. Git history

Committed and pushed to `origin/main`:

| Commit     | Summary                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------- |
| `e793071e` | `feat(currency-index): XAUX vs USDX comparison chart + public comparison page`                  |
| `ecc44268` | `docs(ad-hoc): record XAUX vs USDX comparison page work-completion manifest`                    |
| `fc56a4e7` | `docs(ad-hoc): fix heading mangled by pre-commit prettier wrap`                                 |
| `a45c9d76` | `feat(currency-index): add drawing tools, rebase controls, and watermark to XAUX vs USDX chart` |
| `63c809b9` | `docs(ad-hoc): record Round 2 (drawing tools, rebase, watermark) in this manifest`              |
| `ab9f0533` | `fix(currency-index): make chart always mount so drawing tools work with no data`               |
| _pending_  | `docs(ad-hoc): record Round 3 bugfix (drawing tools unreachable) in this manifest`              |

---

## 7. Explicitly out of scope

- **Any live VPS action** — see §5.1; entirely inherited from and tracked by Lane 4's own manifest,
  not duplicated here.
- **Any change to Lane 4 itself** — this page is a pure downstream consumer of
  `currency_gold_indices`; nothing in Lane 4's own engine, gateway endpoint, snapshot cache, snapshot
  route, or landing-page Hero widget was modified.
- **Any change to the Currency Index PRO Plan** — a separate, PRO-gated, session-authenticated
  feature with its own manifest; this page shares no route, component, or query function with it.
- **`frontend/` (SEPARATE_STACK)** — per `EXECUTOR-PROTOCOL.md` §5 this tree is out of scope for this
  migration entirely and was not touched; it has no equivalent comparison page to mirror.
- **A generic multi-index history API** — the new route is deliberately hardcoded to XAUX + USDX
  only, matching the feature's own precisely-scoped request rather than building a general-purpose
  `indices=` query-param endpoint nothing yet needs.
- **Full dictionary translation** of this page's new strings — see §5.4.
- **A navbar entry for this page** — see §5.4.
- **Line-touch alerts on drawn lines** — Davin's own explicit instruction ("No need to do any alert
  creation on lines drawn"); the terminal's `AlertDialog`/`AlertsPanel`/`/api/alerts/line` were
  never wired into this page's drawing layer at all, not merely hidden behind a flag.
- **Any change to `components/charts/drawing/*` itself** — this page's drawing feature is a pure
  consumer of that existing engine/marks/geometry/tools/style-editor code; not one file under that
  path was modified, matching Lane 4's own "pure downstream consumer" discipline applied to a
  second shared subsystem.
- **Server-side or database persistence of drawings** — see §5.4; ephemeral/in-memory only, by
  Davin's own scope.
- **A generic, index-agnostic rebase configuration API** — the rebase sliders are wired directly to
  this one chart's own two named series (XAUX/USDX); no new endpoint or schema was added for it,
  matching this page's own single-purpose design (§7's "generic multi-index history API" entry
  above, applied to the same reasoning).
