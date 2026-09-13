# XAUX vs USDX Comparison Page Manifest — Work Completion Report

**Date:** 2026-09-13
**Status:** Code complete, verified, and live-browser-checked. Not yet applied to a live database
(no migration needed — this feature adds zero new tables/columns, see §1.1) and not yet deployed;
committed and pushed to `origin/main` this session (§6).
**Type:** Ad-hoc feature session (Davin-requested directly in chat, with an annotated screenshot of
the live landing page as the spec) — outside the phase/session numbering, per
`docs/migration-orders/EXECUTOR-PROTOCOL.md` §6.

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

### 1.1 A foundational finding, established before writing any code: `currency_gold_indices` has no

timeframe column, and XAUX's own daily reopen isn't 15-minute-aligned

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
  Lane 4 VPS engine has not been deployed yet (§5.1).
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

---

## 2. Files changed

| File                                                                                               | Change                                                                                                             |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `lib/currency-gold-indices/history.ts`                                                             | **Added.** `isM15CloseBar()`, `MAX_COMPARISON_HISTORY_BARS`, `COMPARISON_CHART_INDEX_NAMES`, `ComparisonTimeframe` |
| `lib/currency-gold-indices/queries.ts`                                                             | New `getCurrencyGoldIndexHistory()` + its result types                                                             |
| `lib/cache/cache-manager.ts`                                                                       | New timeframe-keyed cache helpers for the history route                                                            |
| `app/api/market/currency-gold-indices/history/route.ts`                                            | **Added.** `GET .../history?timeframe=M5\|M15` — public, unauthenticated                                           |
| `components/market/useCurrencyIndexHistory.ts`                                                     | **Added.** SWR hook, keyed by timeframe                                                                            |
| `components/market/xaux-usdx-comparison-chart.tsx`                                                 | **Added.** 2-line `lightweight-charts` component                                                                   |
| `app/(marketing)/xaux-vs-usdx/page.tsx`                                                            | **Added.** Public comparison page + M5/M15 toggle                                                                  |
| `components/landing/landing-hero.tsx`                                                              | "XAUX vs USDX Comparison chart" button wired in                                                                    |
| `lib/i18n/dictionaries/{en-US,en-GB}.json`                                                         | 5 new identity-mapped keys (button, heading, badge, subtitle, empty state)                                         |
| `__tests__/lib/currency-gold-indices/history.test.ts`                                              | **Added.** 6 tests, pure `isM15CloseBar()` unit tests                                                              |
| `__tests__/api/currency-gold-indices-history.test.ts`                                              | **Added.** 14 tests, mirroring `currency-gold-indices.test.ts`'s own structure                                     |
| `__tests__/components/landing/landing-and-auth-navigation.test.tsx`                                | 1 new test — the button's `href` resolves to `/xaux-vs-usdx`                                                       |
| `davintrade-xaux-vs-usdx-comparison-page/xaux-vs-usdx-comparison-page-manifest-work-completion.md` | **Added.** This document                                                                                           |

**13 files touched** (7 added, 5 modified, this manifest is the 13th) across 1 feature commit plus
this documentation commit.

---

## 3. Test verification

| Suite                                                         | Result                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npx tsc --noEmit` (monolith)                                 | Clean, before and after the test-bug fixes in §1.4                                                                                                                                                                                                                                                                                                                       |
| ESLint (monolith)                                             | Clean, 0 warnings, every new/changed file                                                                                                                                                                                                                                                                                                                                |
| `isM15CloseBar` unit tests                                    | **6/6** — FX-index triplet pattern, XAUX's own non-15-min-aligned anchor, a data-gap bar, a before-session-open bar, cross-day correctness, and the FX-vs-XAUX wrong-anchor discriminating case (§1.4)                                                                                                                                                                   |
| `getCurrencyGoldIndexHistory` + `GET .../history` route tests | **14/14** — both indices queried independently; ascending output order; M15 filtering; the 3x row-limit for M15 vs. the 3000 cap for M5; one index degrading to empty on a query failure without affecting the other; no-auth; default/invalid-timeframe handling; cache hit/miss/outage (read and write) parity with the sibling snapshot route; public `Cache-Control` |
| `landing-and-auth-navigation.test.tsx`                        | **1 new test** — the button links to `/xaux-vs-usdx`; all pre-existing tests in this file unaffected                                                                                                                                                                                                                                                                     |
| Full monolith `npm run test:ci`                               | **198/198 suites, 2657/2657 tests** — up from the prior 196/2636 baseline by exactly this session's own 2 new suites/21 new tests, zero regressions elsewhere                                                                                                                                                                                                            |

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
  being swallowed.
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
— until those 2 steps happen, this page will correctly keep showing "No data available yet," by
design, the same way the Hero widget above it renders nothing today. Once Lane 4's own VPS items
land, this page starts showing real data with zero further code changes.

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

- **Translation:** the 5 new strings this page adds are English-only (identity-mapped in
  `en-US`/`en-GB` only), matching the rest of Lane 4's own established precedent for newly-shipped
  marketing copy — a future locale pass, not an oversight.
- **No navbar link:** this page is reachable only via the landing-hero button, per the feature's own
  scope (Davin's annotation named the button specifically, not a navigation entry) — a deliberate
  choice, not a gap, consistent with `/econ-news`/`/academy` both having navbar links added
  separately and explicitly when that was actually asked for.

---

## 6. Git history

Committed and pushed to `origin/main` this session:

| Commit     | Summary                                                                        |
| ---------- | ------------------------------------------------------------------------------ |
| `e793071e` | `feat(currency-index): XAUX vs USDX comparison chart + public comparison page` |
| _pending_  | `docs(ad-hoc): record XAUX vs USDX comparison page work-completion manifest`   |

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
