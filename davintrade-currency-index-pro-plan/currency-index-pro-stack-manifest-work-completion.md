# Currency Index PRO Plan Manifest — Work Completion Report

**Date:** 2026-09-12
**Status:** Code complete across all 5 phases, verified, **not yet committed** — left for Davin's
review of each phase's own `CLAUDE.md` entry first, per this repo's established
log-first-defer-commit pattern.
**Type:** Ad-hoc feature session (Davin-requested directly in chat, one phase at a time, same day)
— outside the phase/session numbering, per `docs/migration-orders/EXECUTOR-PROTOCOL.md` §6.
Recorded across five `CLAUDE.md` ad-hoc entries (Phases 1–5), all dated 2026-09-12.

> **Scope note:** this document covers the **Currency Index PRO Plan** — a PRO-gated 28-pair
> relative-strength screener (HRMA/SMMA signal engine, Stage A/B confluence detection, dashboard
> and analysis tables, a per-currency detail chart with instant what-if sliders) built entirely on
> top of the already-live **Lane 4 Currency & Gold Index Stack** (`currency_gold_indices`, the
> public landing-page widget). It is a distinct feature from Lane 4 itself — Lane 4 is a public,
> unauthenticated marketing widget; this plan is an authenticated, PRO-tier-gated trading tool
> consuming Lane 4's own data as its sole upstream source. See
> [`currency-index-manifest-work-completion.md`](currency-index-manifest-work-completion.md) in
> this same folder for Lane 4's own manifest — this document does not duplicate it, only extends
> it. Architecture spec:
> [`COMPREHENSIVE_ARCHITECTURE_DESIGN_CURRENCY_INDEX_PRO_PLAN.md`](COMPREHENSIVE_ARCHITECTURE_DESIGN_CURRENCY_INDEX_PRO_PLAN.md).

---

## 1. What was built

Five phases, each planned via `EnterPlanMode`, implemented, and verified as its own unit before
the next began, per `EXECUTOR-PROTOCOL.md`'s one-session-one-verifiable-unit discipline. Every
phase's plan was grounded in direct reads of live schema/code rather than the spec doc's own
illustrative examples, per §0's "live code wins" rule — a running list of evidence-based
corrections to the spec is threaded through the sections below.

### 1.1 Phase 1 — database foundation + the "00:00 MT5 midnight" corridor aggregator

- **New models**, split across both schema files per this repo's own per-user-vs-market-data
  convention (not the spec's own illustrative single-file placement): `DailyCurrencyIndexMetrics`,
  `DailyVolatilityCorridor`, `CurrencyIndexSignal` in `prisma/market-data/schema.prisma`;
  `UserCurrencyIndexPreference` (the one model with a real `User` FK) in
  `prisma/non-market-data/schema.prisma`. One hand-authored migration spans both files, since this
  repo's two schema files share one physical database and one migration history
  (`LESSONS-LEARNED.md` L24).
- **Three evidence-based corrections to the spec**, each found by grepping live code before
  writing anything: the spec's illustrative `market_indices_m5` table doesn't exist — Lane 4's
  real table is `currency_gold_indices` (one point value per 5-minute bar, no OHLC); every other
  business-timestamp field in `prisma/market-data/schema.prisma` is `Int` unix UTC, never
  `DateTime`/`@db.VarChar` as the spec's own code block used, so both `date` fields were switched
  to `Int` to match; and the spec's "nightly cron at 00:00:15 MT5 server time" would have required
  re-porting Eightcap's US-DST offset logic into TypeScript — that logic already lives in exactly
  one place by design (`currency_gold_index_engine.py` on the VPS, which stamps every row with
  `session_open_bar_time`). Built instead as an **idempotent `@Cron(EVERY_5_MINUTES)` tick** that
  asks the data "has a new session opened since I last finalized one?" rather than a wall-clock
  cron — a missed tick or worker restart just catches up next time, and zero new DST math exists
  anywhere in this repo.
- **New** `railway-gateway/src/worker/currency-index-corridor-aggregator.service.ts` (day-summary
  finalization + the Section 3.2 pooled `mu_basket`/`sigma_basket` corridor formula) with its pure
  math split into a separate, zero-I/O `currency-index-corridor-math.ts` module so the formulas
  could be unit-tested directly against hand-computed examples. Every edge case handled and
  covered by its own test: zero prior closed days, an index with zero bars on a day, a corridor
  pool of exactly 1 point (`std_dev: 0`, not `NaN`), and a monotonically-rising day still correctly
  reporting `peak_low_pct: 0` from the session's own real opening bar.
- **A real dependency landmine found and fixed before it could break CI:** `@nestjs/schedule`'s
  latest release line is ESM-only and fails Jest immediately under this repo's CJS `ts-jest`
  setup, the moment any test file pulls in the new aggregator service — including untouched
  existing e2e specs that boot the whole `AppModule`. Pinned to `@nestjs/schedule@6.1.3`, the last
  CJS release with matching peer dependencies.

### 1.2 Phase 2 — HRMA/SMMA signal engine, 28-pair confluence screener, 3 REST endpoints

- **A foundational architecture correction, found before writing anything:** the spec says every
  endpoint is hosted on the Railway NestJS gateway. Grepping every real controller there found
  **zero** session-authenticated, user-facing GET routes and no NextAuth capability at all — every
  existing user-facing market-data read is served from the monolith's own `app/api/market/*`.
  Built all 3 new endpoints (`chart`, `screener`, `preferences`) there instead, copying
  `indicator-statistics`'s exact PRO-gate pattern (session check, then `hasPermission()` with a DB
  tier re-check fallback for a user who just upgraded).
- **Five more evidence-based corrections:** M5→M15 "resampling" for indices is picking every 3rd
  5-minute sample (no OHLC exists to aggregate); HRMA/SMMA reset daily at each session's own 100.00
  rebase rather than rolling across the boundary (an accepted cold-start limitation — both
  indicators are genuinely unreliable for the first ~9 hours of a trading day); no
  `CurrencyIndexSignal` persistence yet (computed fresh per request, `private, max-age=30` cached,
  matching `indicator-statistics`'s own "no Redis needed" precedent); dropped the spec's own
  illustrative `dashboardTableM5.momentum` field entirely, since no formula for it exists anywhere
  in the spec or codebase — fabricating one would repeat the mistake this repo's own history
  already declined for the D5 gauge dials; and zone thresholds always use the system corridor, a
  user's custom OB/OS override is a Phase-3 client-side re-color only, never a second
  server-computed corridor.
- **A quoting-direction mistake caught during test-writing, not shipped:** while transcribing the
  spec's own worked example, first wrote the base/quote relationship backwards before re-deriving
  the invariant from first principles and finding the spec's own text actually says the opposite
  of the first draft's paraphrase. `resolvePairAction()`'s implementation was correct throughout —
  only the paraphrase was wrong, caught before it reached a test assertion.
- **A same-day follow-up gap, found by Davin asking a good question:** the original
  `detectStageBSignal()` gated only on SMMA's own null-based warm-up, but HRMA is mathematically
  defined from bar 1 — a cross could "confirm" as early as bar 13 even though HRMA's own 36-period
  smoothing hadn't converged, which is noise, not a real reversal. Added a second, independent
  `minBarsForSignal` gate tied to the user's own configured periods (`max(hrmaPeriod, smmaPeriod)`)
  rather than an arbitrary constant.

### 1.3 Phase 3 — relative-strength chart, news markers, header controls, HRMA/SMMA detail modal

- **New** `/pro/currency-index` page (page-level PRO gate, mirroring how `/terminal` itself checks
  tier rather than its layout) rendering the 8-line relative-strength chart with corridor threshold
  bands, real high-impact-news markers (reusing `EventVerticalLine`/`useEventMarkers`, built
  originally for the terminal's own news overlay, rather than forking it), and a currency legend
  strip — all colored via a categorical palette chosen with the `dataviz` skill's own validated
  8-slot theme and re-validated against this app's real chart surfaces (both light and dark passed
  every hard gate; light mode's contrast WARN on 3 slots resolved by giving every line a visible
  on-chart label, so identity never rests on hue alone).
- **Folded in at Davin's own explicit request, same session:** a per-currency HRMA/SMMA detail
  modal so a user can visually verify a `CONFIRMED_BUY`/`CONFIRMED_SELL` badge instead of trusting
  it blindly — plus, as a same-day follow-up Davin also asked for, **instant client-side "what-if"
  sliders** on the modal's HRMA/SMMA periods, redrawing the lines and re-evaluating the confirmed-
  cross marker on every tick with zero new server round-trips (the pure math functions are already
  client-safe). Deliberately session-local — exploring a different period never silently changes
  what the screener table uses elsewhere — with an explicit "Save as my default" action wired to
  the Phase 2 `/preferences` PUT route.
- **A real, live-reproduced bug found and fixed during browser verification:** the detail modal's
  chart silently never rendered on first load — 0 canvases, no console error. Root cause: the
  chart container sits inside a Radix `DialogContent`, which mounts through a portal; a plain
  `useRef` can read `null` before the portal actually attaches the node, and the creation effect's
  only dependency had already fired for that transition with no second chance to retry. Fixed with
  a state-backed callback ref keyed on `[open, container]` instead of `[open]` alone.
- **Two DRY refactors made in passing:** `buildSignalSeries()` extracted out of `screener/route.ts`
  into a shared `lib/currency-index-pro/signals.ts` function so the new `detail` route reuses the
  identical computation; the G8 currency array (independently hardcoded in 3 places) consolidated
  into `ALL_CURRENCIES`/`indexNameForCurrency()` in `lib/currency-index-pro/pairs.ts`.

### 1.4 Phase 4 — screener/analysis tables, Top-5 card, disclaimer banner, settings modal

- **A real gap found before planning further:** the spec wants a "View Chart" quick action opening
  an interactive candlestick chart for any pair — but this app has no OHLCV data for arbitrary FX
  pairs at all (only XAUUSD, via Lane 1's own alert pipeline), and Lane 4's own Phase 1 already
  flagged raw per-pair storage as deliberately not built. **Resolved by reusing an existing, proven
  pattern** rather than fabricating data or building a pipeline: `components/landing/
ticker-tape.tsx` already embeds TradingView widgets as a plain iframe for FX symbols, and this
  app's CSP already allows the TradingView widget domains — `PairChartModal` reuses that exact
  technique for the clicked pair, one iframe, theme baked in at mount (no need for ticker-tape's
  own never-unmounting dual-iframe trick, since this modal remounts fresh on every open by nature).
- **A second evidence-based correction, made while wiring the settings modal:** the spec always
  draws two corridor tiers (strike-zone + a statistically-derived "extreme" tier). A custom
  OB/OS override only ever supplies a single value — there is no statistical basis for synthesizing
  a second "extreme" tier from it, the same class of fabricated-number mistake this repo's history
  already declined for the D5 gauge dials. `RelativeStrengthChart`'s override prop takes
  `extremeZonePct: number | null`; `null` draws only the Tier 1 lines, confirmed live.
- **What shipped:** plain semantic `<table>`-based `dashboard-table-m5`/`analysis-table-m15`/
  `top5-screener-card`/`trading-advisory-banner` components (no shared `Table` primitive exists in
  this repo to build on); the `indicator-settings-modal`; a debounced preferences-write hook
  mirroring `useMtfPreference.ts`'s own optimistic-write pattern; `preferredTf` (declared since
  Phase 1, never wired) now actually drives the M5/M15 toggle's initial value.

### 1.5 Phase 5 — verification & end-to-end validation (all 7 spec §12 items addressed)

- **The reframe that made this a real session, not "blocked, nothing to do":** the spec's own
  §11/§12 assumes a live VPS deployment (real captured MT5 exports, a real 20-day history) that
  doesn't exist yet — the Lane 4 currency-index engine has never been deployed. But most of the
  7-item acceptance checklist doesn't need live data at all; it needs the _code_ proven correct,
  which is checkable today against synthetic data and the MQL5 source itself.
- **V1 (Dynamic Corridor Accuracy):** independently cross-checked `computeVolatilityCorridor`
  against a from-scratch numpy computation (pandas isn't installed in this environment; numpy's
  `ddof=1` stddev is what pandas delegates to anyway) over a synthetic 8-currency × 20-day dataset
  — now a permanent test asserting agreement within 1e-9, far tighter than the spec's own 0.001%
  bar.
- **A real bug found and fixed while building the V3 test, not a false alarm:**
  `analysisTableM15.currentPct` was reading the raw M5 "latest" bar (the same one the M5 dashboard
  table uses) instead of the M15-sampled series' own latest bar — so the displayed percentage could
  visually disagree with the zone badge shown right next to it in the same row (the badge itself
  was correctly M15-derived; only the number wasn't). A new test feeding 4 M5 bars spanning one
  M15 boundary caught it directly (failed against the original code, `0.4` instead of the expected
  `0.3`) before it was fixed to read the M15-sampled bar's own value.
- **V2/V6** already fully covered by existing Phase 2 tests, no new work. **V5 (Reactivity):**
  previously asserted from Big-O reasoning alone — a new benchmark measures the exact what-if
  recompute the detail modal's sliders run on every tick at **0.0158ms/call**, over 300x inside the
  spec's own 5ms bar. **V4 (News Timeline Alignment):** a code-review confirmation, not a new test
  — the chart/tooltip pass `event.eventTime` through with zero transformation, so correctness is
  entirely inherited from the already-live-verified economic-events pipeline. **V7 (Advisory
  Banner):** one minimal render test pinning that the disclaimer renders unconditionally.
- **The HRMA/SMMA "backtest against MQL5 indicator output" item:** no live captured MQL5 runtime
  output exists for this new lane, but `HRMA_Modified Buffers.mq5`/`SMMA_Modified Buffers.mq5`
  were re-read directly, line-by-line, against `lib/currency-index-pro/math.ts` — both functions
  match the real indicator source **exactly**, including the `i==0` seed case and the recursive
  update formulas. The one intentional difference (`computeSmma` returns `null` before its seed
  point where the real indicator writes a literal `0.0` placeholder) is a deliberate, documented
  improvement, not a math discrepancy — the strongest verification achievable without a live VPS.

---

## 2. Files changed

| File / directory                                                                                                                                                                                         | Change                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `prisma/market-data/schema.prisma`                                                                                                                                                                       | `DailyCurrencyIndexMetrics`, `DailyVolatilityCorridor`, `CurrencyIndexSignal`          |
| `prisma/non-market-data/schema.prisma`                                                                                                                                                                   | `UserCurrencyIndexPreference` + reverse relation on `User`                             |
| `prisma/migrations/20260912000000_add_currency_index_pro_tables/migration.sql`                                                                                                                           | **Added.** Authored, not applied — 4 new tables, purely additive                       |
| `railway-gateway/prisma/schema.prisma`                                                                                                                                                                   | Mirrored `DailyCurrencyIndexMetrics`/`DailyVolatilityCorridor` (byte-identical)        |
| `railway-gateway/src/worker/currency-index-corridor-aggregator.service.ts`                                                                                                                               | **Added.** Idempotent `@Cron(EVERY_5_MINUTES)` day-close/corridor finalizer            |
| `railway-gateway/src/worker/currency-index-corridor-math.ts`                                                                                                                                             | **Added.** Pure Section 3.2 corridor formulas, zero I/O                                |
| `railway-gateway/src/worker/worker.module.ts`                                                                                                                                                            | Aggregator service registered                                                          |
| `railway-gateway/src/app.module.ts`                                                                                                                                                                      | `ScheduleModule.forRoot()` registered                                                  |
| `railway-gateway/package.json`                                                                                                                                                                           | `@nestjs/schedule@6.1.3` pinned (CJS; latest is ESM-only, breaks Jest)                 |
| `railway-gateway/test/currency-index-corridor-{math,aggregator.service}.spec.ts`                                                                                                                         | **Added.**                                                                             |
| `lib/currency-index-pro/{math,signals,pairs,queries,colors}.ts`                                                                                                                                          | **Added.** HRMA/SMMA math, Stage A/B signals, 28-pair scorer, Prisma reads, palette    |
| `lib/economic-events/queries.ts`                                                                                                                                                                         | `getHighImpactEventsForDay()` added — a whole-day variant for the chart marker feed    |
| `lib/auth/permissions.ts`                                                                                                                                                                                | New `currency_index_pro` PRO permission + `requireCurrencyIndexPro`                    |
| `app/api/market/currency-index-pro/{chart,screener,detail,preferences}/route.ts`                                                                                                                         | **Added.** 4 PRO-gated REST endpoints                                                  |
| `app/pro/currency-index/{layout,page}.tsx`                                                                                                                                                               | **Added.** Page-level PRO gate                                                         |
| `components/currency-index-pro/pro-currency-index-cockpit.tsx`                                                                                                                                           | **Added.** Top-level page composition                                                  |
| `components/currency-index-pro/chart/{relative-strength-chart,chart-control-header,currency-legend-strip,hrma-smma-detail-modal,high-impact-news-tooltip,pair-chart-modal,indicator-settings-modal}.tsx` | **Added.**                                                                             |
| `components/currency-index-pro/tables/{dashboard-table-m5,analysis-table-m15,top5-screener-card,trading-advisory-banner}.tsx`                                                                            | **Added.**                                                                             |
| `components/currency-index-pro/hooks/{use-currency-index-chart,use-currency-index-screener,use-currency-index-detail,use-currency-index-preferences,use-session-countdown}.ts`                           | **Added.**                                                                             |
| `__tests__/lib/currency-index-pro/{math,signals,pairs,performance}.test.ts`                                                                                                                              | **Added.**                                                                             |
| `__tests__/api/currency-index-pro-{chart,screener,detail,preferences}.test.ts`                                                                                                                           | **Added.**                                                                             |
| `__tests__/components/currency-index-pro/trading-advisory-banner.test.tsx`                                                                                                                               | **Added.**                                                                             |
| `scratch/v1_corridor_crosscheck.py`                                                                                                                                                                      | **Added, gitignored.** Independent numpy corridor cross-check, kept for future re-runs |
| `CLAUDE.md`                                                                                                                                                                                              | 5 ad-hoc session entries (Phases 1–5), all dated 2026-09-12                            |

**~50 files touched** (~45 added, ~8 modified) across what will become 5 feature commits (one per
phase) plus this manifest, once Davin confirms the commit.

---

## 3. Test verification

| Phase | Suite                                                  | Result                                                                                                                                                                                 |
| ----- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `railway-gateway` unit (`npm test`)                    | **5/5 suites, 66/66 tests** (+2 suites/+14 tests over baseline)                                                                                                                        |
| 1     | `railway-gateway` e2e (`npm run test:e2e`)             | **4/4 suites, 40/40 tests**, unaffected                                                                                                                                                |
| 1     | `railway-gateway` `npx tsc --noEmit` / `npm run build` | Clean, exit 0                                                                                                                                                                          |
| 1     | Monolith `npm run test:ci`                             | **187/187 suites, 2563/2563 tests** — unchanged (schema + migration only, no monolith code)                                                                                            |
| 2     | Monolith `npm run test:ci`                             | **193/193 suites, 2620/2620 tests** (+6 suites/+57 tests)                                                                                                                              |
| 3     | Monolith `npm run test:ci`                             | **194/194 suites, 2632/2632 tests** (+1 suite/+12 tests), then 2633 after the what-if-slider follow-up                                                                                 |
| 4     | Monolith `npm run test:ci`                             | **194/194 suites, 2633/2633 tests** — unchanged (component wiring only, no new pure logic)                                                                                             |
| 5     | `railway-gateway` unit (`npm test`)                    | **5/5 suites, 67/67 tests** (+1 test — the V1 corridor cross-check)                                                                                                                    |
| 5     | Monolith `npm run test:ci`                             | **196/196 suites, 2636/2636 tests** (+2 suites/+3 tests)                                                                                                                               |
| All   | `npx tsc --noEmit` (monolith + `railway-gateway`)      | Clean throughout every phase                                                                                                                                                           |
| All   | ESLint (monolith)                                      | Clean, 0 warnings, every new/changed file, every phase                                                                                                                                 |
| All   | ESLint (`railway-gateway`)                             | Reproduces the pre-existing, already-documented `LESSONS-LEARNED.md` L38 gap (no ESLint config file exists there at all) — confirmed unrelated; `tsc --noEmit` is the real static gate |

Zero regressions at every checkpoint — each phase's full-suite run matched the prior baseline plus
exactly that phase's own new suites/tests, nothing else moved. Final state, confirmed by the most
recent run: **196 test suites, 2636 tests, all passing, exit code 0.**

---

## 4. Live browser verification

The Executor never authenticates (standing rule — never enters credentials, including test-account
autofill buttons), and `/pro/currency-index` is auth- and PRO-gated end to end. Every phase's real
functionality was still verified in a genuine, unmodified render of the production component tree,
using this repo's own established technique (first used for the 2026-09-03 timezone-dropdown
session, `dev-tz-preview`): a throwaway, unauthenticated preview route placed **outside**
`app/pro/` specifically to route around its layout's own auth gate, patching only `window.fetch`
client-side (that file only) to resolve the real API URLs to synthetic fixture data — no
production route, auth, hook, or component code was ever modified to make this possible. Deleted
immediately after each use, confirmed via a clean `git status` every time (only `next-env.d.ts`'s
own expected dev-server auto-regen remained alongside the real artifacts).

- **The unauthenticated redirect chain itself** (`/pro/currency-index` → `/login`) was confirmed
  directly against the real, unmodified route — no preview trick needed for this part.
- **Phase 3:** the 8-line relative-strength chart with correct per-currency colors and live-value
  labels; corridor threshold bands with correct Overbought/Oversold/Extreme labels; a news marker
  at its correct x-position; the currency legend strip's sign-colored values; the M5/M15 toggle
  switching state and re-fetching; and — after the callback-ref bug fix — the detail modal's
  HRMA/SMMA lines, corridor bands, a "SELL" confirmed-cross marker, and the warm-up caption, all
  rendering correctly for a fixture EUR `CONFIRMED_SELL` scenario. Dragging the HRMA what-if slider
  from 36 to 76 instantly redrew a visibly different, less-converged line, the caption correctly
  switched to "Still warming up — needs 76 bars (has 60)", the "Save as my default" button appeared
  exactly when the value diverged from the saved default, and clicking it sent the exact expected
  `{"hrmaPeriod":76,"smmaPeriod":13}` payload.
- **Phase 4:** the disclaimer banner and Settings button render at the top; the Top-5 card's
  "🔍 View Chart" opened a **real, live TradingView EURJPY candlestick chart** (genuine OHLC/volume
  data) within ~4s; both new tables rendered with correct sign-colored values and zone badges;
  clicking a currency inside the Analysis Table opened the same detail modal the legend strip
  opens; toggling Auto Zones off in Settings instantly redrew the main chart's corridor to the
  override value with the Extreme lines correctly disappearing, while the Settings modal stayed
  open; the debounced preferences PUT fired exactly once per settled change (one call after 10
  arrow-key presses on a slider, not ten).
- **Not verified live:** reactive dark-mode re-theming of the two new chart components — both call
  the same `useChartAppearance()` hook and follow the same pattern `trading-chart.tsx` already uses
  and has itself been live-verified for, but faking a real theme change in an unauthenticated
  preview would have needed real auth or temporarily instrumenting `AppearanceProvider`, both out
  of scope. Mobile-viewport click-through was not screenshotted in any phase (the CSS is
  responsive by construction — flex-wrap/scroll layouts throughout — but not specifically checked
  at a narrow width).

---

## 5. What you still need to do

Nothing here is a code defect — every item below is either a decision only Davin can make, a
physical/production action outside the Executor's reach, or a check the Executor is categorically
barred from performing (never authenticates, never applies a migration to a live database).

### 5.1 Decide whether to commit

All 5 phases are currently **uncommitted**, per this repo's own log-first-defer-commit pattern —
review each phase's own `CLAUDE.md` entry (Phase 1 at line ~436, Phase 2 at ~326, Phase 3 at ~189,
Phase 4 at ~107, Phase 5 at ~16, as of this writing) and this manifest, then say "commit" (or "amend
scope first") to proceed. Recommended commit boundary: one commit per phase, matching how Lane 4's
own 4 phases were committed (`b6e43625`/`8ad913fc`/`7582d660`/`bffd867b`), plus this manifest as a
final documentation commit.

### 5.2 Apply the database migration

`prisma/migrations/20260912000000_add_currency_index_pro_tables/migration.sql` is **authored, not
applied** — per this repo's unbroken standing rule that the Executor never applies a migration to a
live database. It is purely additive (4 new tables: `daily_currency_index_metrics`,
`daily_volatility_corridors`, `currency_index_signals`, `user_currency_index_preferences`) and
touches nothing existing (`currency_gold_indices`, `market_data_v6`, `indicator_statistics`,
`economic_events` are all untouched), so it carries no risk to any existing row. The hand-authored
SQL was cross-checked against Prisma's own generated DDL for both schema files (table/column/
default/index names all matched byte-for-byte) — Docker Desktop's Linux engine would not come up in
this environment for a live disposable-Postgres dry run, same recurring gap this file's history
already documents elsewhere. **Apply this before Phase 2's endpoints can serve real signals data**
(they will 500 against a database missing these tables).

### 5.3 The live-VPS blocker this entire feature inherits from Lane 4

This whole plan is built **on top of** `currency_gold_indices`, and that table has zero real rows
in production today — Lane 4's own manifest (§5.1 of
[`currency-index-manifest-work-completion.md`](currency-index-manifest-work-completion.md)) already
tracks the 2 remaining physical VPS steps: attaching the OHLCV exporter to 8 MT5 charts, and
registering the currency-index engine as a Windows service. **Nothing in this PRO Plan closes that
gap or duplicates tracking it** — until those 2 steps happen, every endpoint in this feature will
correctly return empty/neutral data (by design, the same "absent row is the honest rendering" rule
Lane 4 itself follows), and the corridor aggregator will have nothing to finalize. Once Lane 4's
own VPS items are done, this feature starts working with zero further code changes.

### 5.4 Authenticated, live-data verification once the above two items land

None of the following was performed by the Executor — it never authenticates, and no real MT5 data
has ever flowed through this feature:

- [ ] **A full authenticated click-through as a real PRO user** on `/pro/currency-index` — the
      chart, the legend strip, the detail modal (including the what-if sliders), the screener
      tables, the Top-5 card, the settings modal, and the disclaimer banner, all against real
      signals rather than fixture data.
- [ ] **Dark-mode re-theming of the two new chart components**, confirmed live (not just by code
      inspection) — see §4's own note.
- [ ] **Mobile-viewport click-through** — every layout in this feature is responsive by
      construction (flex-wrap/scroll), but none of it has been screenshotted at a narrow width.
- [ ] **A genuine backtest against real, captured MT5 HRMA/SMMA runtime output** — Phase 5's own
      line-by-line source comparison is the strongest verification achievable without live data,
      but it is still a code-level proof, not an observed real-world match.
- [ ] **A real 20-day corridor history** — V1's 1e-9 cross-check used a synthetic dataset; the
      actual `mu_basket`/`sigma_basket` values the corridor aggregator produces from 20 real
      trading days have never been observed.
- [ ] **Live news-marker-to-real-event alignment** on the actual chart, with a real high-impact
      release landing during real trading hours.
- [ ] **The daily corridor aggregator's `@Cron` tick, observed actually firing** against a live
      session-close boundary on the deployed `railway-gateway` worker — it has only ever run inside
      a fast Jest test, which never lets the cron itself fire.

### 5.5 Smaller, non-blocking follow-ups

- **Translation:** every new user-facing string in this feature (table headers, the disclaimer
  banner, tooltip copy, settings-modal labels) is English-only — no dictionary keys were added for
  any of the 15+ other locales this app supports. Matches the established precedent for
  newly-shipped marketing/feature copy elsewhere in this codebase (identity-mapped, degrades to
  English), but is a real, deliberate gap worth a future locale pass once this feature is
  confirmed working end to end.
- **`CurrencyIndexSignal` persistence:** the model exists since Phase 1 and is still unpopulated by
  design (Phase 2's own decision) — every signal is computed fresh per request. If a historical
  signal audit trail is ever wanted, that's a new, scoped piece of work, not an oversight.
- **The 32-pair PRO screener / `forex_ohlcv_m5`** (spec §9) — explicitly out of scope for this
  plan, same as it was for Lane 4; a distinct, larger future feature needing real per-pair OHLCV
  storage this codebase does not have yet.

---

## 6. Git history

**Not yet committed.** See §5.1. Once Davin confirms, the recommended commit sequence is:

| Planned commit                                                                    | Covers        |
| --------------------------------------------------------------------------------- | ------------- |
| `feat(currency-index-pro): database foundation + corridor aggregator`             | Phase 1       |
| `feat(currency-index-pro): HRMA/SMMA signal engine + 28-pair screener + REST`     | Phase 2       |
| `feat(currency-index-pro): relative-strength chart + news markers + detail modal` | Phase 3       |
| `feat(currency-index-pro): screener tables + settings modal + disclaimer banner`  | Phase 4       |
| `test(currency-index-pro): Phase 5 verification pass + fix analysisTableM15 bug`  | Phase 5       |
| `docs(ad-hoc): record Currency Index PRO Plan work-completion manifest`           | this document |

---

## 7. Explicitly out of scope

- **Any live VPS action** — see §5.3; entirely inherited from and tracked by Lane 4's own manifest,
  not duplicated here.
- **`frontend/` (SEPARATE_STACK)** — per `EXECUTOR-PROTOCOL.md` §5 this tree is out of scope for
  this migration entirely and was not touched; it has no equivalent PRO feature to mirror.
- **Full dictionary translation** of this feature's new strings — see §5.5.
- **`CurrencyIndexSignal` write path / historical audit trail** — see §5.5.
- **The 32-pair Strongest-vs-Weakest PRO screener** (spec §9) and **`forex_ohlcv_m5`** raw per-pair
  storage — depend on infrastructure this plan deliberately does not build; a distinct future
  feature.
- **Any change to Lane 4 itself** — this plan is a pure downstream consumer of
  `currency_gold_indices`; nothing in Lane 4's own engine, gateway endpoint, cache, or landing
  widget was modified.
