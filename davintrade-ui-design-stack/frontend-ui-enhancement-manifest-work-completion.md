# Frontend UI Enhancement Manifest — Work Completion Report

**Date:** 2026-09-11
**Status:** Code complete, verified, committed, and pushed to `origin/main`
**Type:** Ad-hoc feature session (Davin-requested directly in chat) — outside the phase/session
numbering, per `docs/migration-orders/EXECUTOR-PROTOCOL.md` §6. Recorded in `CLAUDE.md`'s matching
ad-hoc note.

> **Scope note:** this document covers the four frontend slices scoped out of
> `davintrade-stack-d-and-e/FRONTEND-UI-REVISION-RECOMMENDATIONS.md` (2026-09-10) that were judged
> buildable in one session. It does not cover the two items that document also named and this
> session explicitly declined — see §6 for why, and §8 for the rest of that document's scope.

---

## 0. How this session was scoped

Davin asked for an implementation plan covering everything in
`FRONTEND-UI-REVISION-RECOMMENDATIONS.md` that could "possibly be implemented today," in priority
order, with a go/no-go call on each — not a request to build blind from that document's own
recommendations. Planned via `EnterPlanMode`, grounded in three parallel Explore passes against
live code before any plan was written:

1. The economic-events data layer and banner (queries, route, existing hooks) — found the API
   route already returns up to 10 events; the banner's own hook was the only thing discarding 9 of
   them.
2. `indicator_statistics` and the PRO-gating pattern — confirmed (again) zero frontend consumers via
   repo-wide grep, and found the exact `distinct`-collapse pattern to mirror from
   `lib/economic-events/queries.ts`.
3. Chart-marker feasibility and alert-type feasibility — found lightweight-charts' v5 primitive API
   (`attachPrimitive`) is unused anywhere in this codebase, but a ready-made vertical-line plugin
   example is vendored at `seed-code/lightweight-charts/plugin-examples/`; separately found no
   time-based alert evaluation mechanism exists anywhere, which is what turned pre-event alerts into
   a NO-GO for this session (§6).

The plan that came out of this — priority order, file-level detail, and a go/no-go call per item —
was approved before any code was written, then executed the same session, one commit per item.

---

## 1. What was built

Four independent, additive slices, each verified and committed on its own before starting the next.

### 1.1 `/econ-news` source footnote

`/econ-news` renders TradingView's own calendar widget; the `/terminal` banner renders our
own MT5-sourced economic-events lane. The two vendors do not carry identical release data, so they
can disagree. Added a small caption naming the source, so a visitor who later sees the terminal
show a different time or forecast for the same event isn't left thinking one of the two is simply
wrong (`FRONTEND-UI-REVISION-RECOMMENDATIONS.md` §5, option 2 — the doc's own preferred choice).

### 1.2 Expandable economic-events list

The banner showed only the next upcoming high-impact event, even though
`getUpcomingHighImpactEvents()` and its API route already return up to 10. **No backend change was
needed at all** — re-verifying the route during planning found it already serves the full list; the
gap was purely `useUpcomingEvent`'s own `data.events?.[0] ?? null`, which silently discarded
everything past index 0.

- Renamed `useUpcomingEvent` → `useUpcomingEvents`, now returning the full array.
- `session-status-banner.tsx`'s news row is now clickable (only when there is something to expand
  into — a lone event still renders exactly as before, no affordance shown) to reveal the rest of
  the window.
- Rendered **inline**, not as an absolutely-positioned popover: the parent card is
  `overflow-hidden` for its rounded corners, which would clip an overlay panel. Found by reading the
  actual JSX before building, not assumed from the general dropdown pattern
  (`timeframe-selector.tsx`) the plan had originally pointed at.

### 1.3 Chart event markers

Vertical lines at upcoming HIGH-impact economic-event times on both the M5 and M15 candlestick
panes (`FRONTEND-UI-REVISION-RECOMMENDATIONS.md` §3.1 — named the highest-value item in that
section).

- New `EventVerticalLine` — a `lightweight-charts` v5 series primitive
  (`ISeriesPrimitive<Time>`, `attachPrimitive`/`detachPrimitive`) adapted from the vendored plugin
  example at `seed-code/lightweight-charts/plugin-examples/src/plugins/vertical-line/vertical-line.ts`,
  trimmed to a line only — no time-axis label, since closely-spaced events would collide on the
  axis, and a hover tooltip is a natural follow-up rather than something the line itself needs.
- New `useEventMarkers` hook — fetches the same already-PRO-gated `/api/market/economic-events`
  route the session banner's news row uses, so "which currencies mark the chart" reuses the
  banner's own `XAU_RELEVANT_CURRENCIES` default rather than inventing a second, possibly-diverging
  filter. This resolves the one decision the source document flagged as open (§3.1).
- Wired into `TradingChart` itself, not the MTF stacked-layout wrapper, so it applies to both panes
  automatically with no extra plumbing. Gated client-side on `isPro`, purely to skip a request the
  route would 403 anyway — the route itself is the real entitlement boundary.

**A real type-resolution problem found and solved, not routed around:** the vendored plugin
imports `CanvasRenderingTarget2D` from `fancy-canvas` directly. `fancy-canvas` is a transitive
dependency of `lightweight-charts` only, not a direct one of this app, and confirmed (via `Glob`,
not assumed) **not** hoisted to the top-level `node_modules/` under this workspace's pnpm layout —
a direct import would have been unresolvable from application code. Solved by deriving the type
instead of importing it: `Parameters<IPrimitivePaneRenderer['draw']>[0]`. `lightweight-charts`' own
`.d.ts` still resolves the real type correctly via pnpm's per-package `node_modules` when `tsc`
type-checks the derivation — confirmed clean, not assumed.

### 1.4 Containment Rate panel — the first `indicator_statistics` consumer

`indicator_statistics` has been accumulating a snapshot per source per cycle since 2026-09-09 with
**zero frontend consumers** (confirmed via repo-wide grep both before planning and again during
it). Ships only `containment_rate` — a raw, already-computed percentage — deliberately **not** a
composite "quality score."

`FRONTEND-UI-REVISION-RECOMMENDATIONS.md` §2.3 named four unresolved problems with the seed's own
EDT Quality Metrics scoring formulas: contradictory Bar Coverage bands, an EDT Fitness table off by
5 points, R² that measured negative in real captured data, and an asymmetry-penalty rule that may
be measuring the wrong thing. Rather than wait on all four being settled (the doc's own suggested
sequence), this session shipped the one metric with **no formula and no structural bias** —
`containment_rate` is already computed and stored, and needs no scoring decision to be meaningful
on its own ("price stayed in this channel N% of the time").

- New `lib/indicator-statistics/queries.ts` — `getLatestContainmentRates()`, mirroring
  `lib/economic-events/queries.ts`'s `distinct`-on-append-only-key collapse exactly
  (`orderBy: [symbol, timeframe, source, captured_at desc]` + `distinct: [symbol, timeframe,
source]`), same degrade-to-`[]` contract on any query failure.
- New `app/api/market/indicator-statistics/route.ts` — mirrors `/api/market/economic-events`'s
  PRO-gate line for line (JWT check first, DB tier re-check fallback for a user who just upgraded).
- New `useContainmentRates` hook + `ContainmentRateStrip` component, rendered inside
  `market-comments-panel.tsx` alongside `SessionStatusBanner`, inside the same `tier !== 'FREE'`
  guard. Renders **nothing at all** when there is nothing to show — no rows yet, the lane not
  deployed, or FREE tier — the same "an absent row is the honest rendering of we do not know" rule
  the news row already follows, rather than a placeholder or an error state.
- Tightened `market-comments-panel.tsx`'s own header comment, which described the PRO gate as
  applying to "the banner" singular; it now covers two real-content blocks.

### 1.5 Investigated, no change needed: the "stale Coming Soon copy" finding

An earlier pass of this session (before implementation began) flagged
`market-comments-panel.tsx`'s empty-state copy as bundling "Live Market Comments, Session
Countdowns, Gauges, and EDT Quality Metrics" as all still unbuilt, even though Session Countdowns
shipped 2026-09-10. **Reading the full file before editing showed this was wrong** — the actual
rendered "Live Market Comments Coming Soon" text already scopes to comments only; the "Session
Countdowns" mention lives only inside a code **comment** quoting `seed-code`'s own mock for
historical context, never in anything a user sees. The original finding was based on a partial
grep, not the full file. No change was made; recorded here rather than silently dropped, since it
corrects an earlier claim made in this same session's own planning conversation.

---

## 2. Files changed

| File                                                                      | Change                                                                    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `app/(marketing)/econ-news/page.tsx`                                      | New source-attribution footnote                                           |
| `components/market-sessions/useUpcomingEvent.ts` → `useUpcomingEvents.ts` | Renamed; returns the full event array instead of `[0]`                    |
| `components/market-sessions/session-status-banner.tsx`                    | Clickable news row, inline expand panel for the rest of the window        |
| `__tests__/components/market-sessions/session-status-banner.test.tsx`     | +3 tests (expand affordance, hide/reveal on click)                        |
| `components/charts/drawing/EventVerticalLine.ts`                          | **Added.** `lightweight-charts` v5 series primitive                       |
| `components/charts/drawing/useEventMarkers.ts`                            | **Added.** Fetches events, attaches/detaches primitives                   |
| `components/charts/trading-chart.tsx`                                     | Wires `useEventMarkers` in, gated on `isPro`                              |
| `__tests__/drawing/useEventMarkers.test.ts`                               | **Added.** 7 tests against a fake chart/series pair                       |
| `__tests__/components/charts/trading-chart.test.tsx`                      | Isolates `useEventMarkers` the same way `useFiredAlertMarkers` already is |
| `lib/indicator-statistics/queries.ts`                                     | **Added.** `getLatestContainmentRates()`                                  |
| `app/api/market/indicator-statistics/route.ts`                            | **Added.** PRO-gated route, mirrors economic-events route                 |
| `components/market-sessions/useContainmentRates.ts`                       | **Added.** Client fetch/poll hook                                         |
| `components/market-sessions/containment-rate-strip.tsx`                   | **Added.** Renders nothing when there is nothing to show                  |
| `components/market-comments-panel.tsx`                                    | Mounts `ContainmentRateStrip`; header comment tightened                   |
| `__tests__/api/indicator-statistics.test.ts`                              | **Added.** 9 tests (query layer + route)                                  |
| `__tests__/components/market-sessions/containment-rate-strip.test.tsx`    | **Added.** 5 tests                                                        |
| `CLAUDE.md`                                                               | Ad-hoc session note                                                       |

**17 files touched (10 modified, 7 added — including 1 rename)**, 1264 insertions / 30 deletions
across 5 commits.

---

## 3. Test verification

| Suite                                                                                           | Result                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session-status-banner.test.tsx` (targeted)                                                     | **18/18 passed** (15 baseline + 3 new)                                                                                                                              |
| `useEventMarkers.test.ts` + `trading-chart.test.tsx` + `mtf-stacked-charts.test.tsx` (targeted) | **32/32 passed**                                                                                                                                                    |
| `indicator-statistics.test.ts` + `containment-rate-strip.test.tsx` (targeted)                   | **14/14 passed**                                                                                                                                                    |
| `market-comments-panel.test.tsx` (pre-existing, unaffected)                                     | **4/4 passed**                                                                                                                                                      |
| Monolith full `npm run test:ci`                                                                 | **184/184 suites · 2537/2537 tests passed** — up from the prior 181/2513 baseline by exactly this session's 3 new suites / 24 new tests, zero regressions elsewhere |
| TypeScript — monolith                                                                           | `tsc --noEmit`, 0 errors, re-run after every item                                                                                                                   |
| ESLint                                                                                          | Clean on every changed/added file, checked per item before each commit                                                                                              |

---

## 4. Live browser verification

Started the real dev server (`next dev`, Turbopack) rather than relying on unit tests alone for the
chart-marker wiring, since that code path only compiles when a real route pulls in the full
`TradingChart` module graph:

- Navigated to `http://localhost:3000/terminal`. Server logs confirmed **`Compiling /terminal ...`**
  completed with **zero build errors** — this compiles the entire module graph including
  `trading-chart.tsx` → `useEventMarkers.ts` → `EventVerticalLine.ts`, so a bundler-level problem
  with the new primitive (e.g. the `fancy-canvas` type-resolution question in §1.3) would have
  surfaced here even though `tsc --noEmit` alone would not have caught a Turbopack-specific issue.
- The unauthenticated visitor correctly redirected to `/login` (`GET /terminal 307`), matching this
  repo's established auth-gate behavior — not itself new, but confirms the route change didn't
  break the gate.
- `preview_logs` with `level: error` returned **no server errors**.

**Not verified by the Executor, flagged rather than assumed:** full authenticated click-through of
all four features against real PRO-gated data on `/terminal` — the Executor never enters
credentials, the same boundary as every other authenticated surface in this repo's history. The
Containment Rate panel specifically has one open data question, not a correctness risk: whether the
VPS has emitted a fresh capture with the `[EDT CHANNEL]` fields populated since the 2026-09-11
indicator recompile. The panel degrades to rendering nothing if not, so this is a "will it show
anything yet" question rather than a bug.

---

## 5. Git history

Landed as 5 scoped commits on `main`, then pushed to `origin/main`:

| Commit     | Summary                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------- |
| `49a6f28d` | `feat(econ-news): note that the calendar is TradingView's, not the terminal's` — §1.1               |
| `471a6313` | `feat(terminal): show the rest of the economic-events window, not just the next one` — §1.2         |
| `e82c8c96` | `feat(terminal): mark high-impact economic-event times on the chart` — §1.3                         |
| `79e05eb3` | `feat(terminal): show EDT Channel Containment Rate, the first indicator_statistics consumer` — §1.4 |
| `f2a6b3ef` | `docs: log the 2026-09-11 frontend-catch-up ad-hoc session` — `CLAUDE.md`                           |

---

## 6. Declined this session, with reasons

`FRONTEND-UI-REVISION-RECOMMENDATIONS.md` named two more items; both were re-evaluated against live
code during planning rather than restated from the doc, and both came back NO-GO for a same-day
slot:

- **Pre-event alerts (§3.2)** — "notify me N minutes before high-impact [currency] news." Live-code
  research found **no time-based or scheduled alert evaluation mechanism exists anywhere** in this
  codebase: both existing alert types (`PRICE_ALERT`, `PRICE_TOUCH_LINE`) are keyed off live price
  ticks, one polled every 60s, one pushed via Redis on every tick — neither has any notion of
  "check again at a future wall-clock time." Building this needs a new scheduler in
  `operation-service/src/alert-engine/`, a new market-data Prisma client wired into that service (the
  `EconomicEvent` model currently only exists on the monolith's Prisma client), a dedup/fired-state
  mechanism, a dispatcher branch for news-alert copy, and real design decisions (which
  minutes-before options to offer, global vs. per-alert) that are Davin's call, not this session's.
  Five to six files across two services — a legitimate scope for its own session, not a fifth slot
  in this one.
- **D5 gauge dials (§4)** — the seed's three circular dials (M15 EDT Stochastic, M15 SSA Deviation,
  M15 Market Momentum) are hardcoded to 85/72/61 in the mock. **No formula for any of the three
  exists anywhere in the repo or in any document.** Building them would mean inventing what they
  measure — the same fabrication `market-comments-panel.tsx`'s own zero-mock-data rule already
  refuses elsewhere in this codebase. Declined outright, not deferred to a future session, unless
  Davin supplies the formulas.

---

## 7. A note on the planning approach

Unlike a session that receives a fully-specified task order, this one started from a recommendation
document and Davin's own request for a prioritized, go/no-go implementation plan. The plan itself
was produced from three parallel Explore passes against live code (§0), not from restating the
source document — which is what caught that item 1.2 needed **no backend change at all** (the
document's own suggested sequence implied a route change), that item 1.3's "which currencies"
decision the document flagged as open could be resolved by reuse rather than a new choice, and that
item 1.4's four blocking formula questions could be sidestepped entirely by shipping the one
sub-metric that never depended on them. All three of those simplifications reduced the actual
session's scope below what the source document's own language would have suggested.

---

## 8. Explicitly out of scope

- **Stack E's market-comments feed and the Trade Setup Card** — both need engines that do not exist
  yet (`trg_generate_market_comments`, Stack D's Report 2 / Phase 12). Named in
  `FRONTEND-UI-REVISION-RECOMMENDATIONS.md` §6 as "what NOT to build yet"; unchanged by this
  session.
- **`/econ-news` rebuilt on our own data** (the doc's §5 option 3) — explicitly not the doc's own
  recommendation; the footnote (option 2, §1.1 above) was built instead.
- **A hover tooltip on the chart event markers** — deliberately deferred to a follow-up, per §1.3;
  v1 ships a line only.
- **Full authenticated click-through verification** — see §4's boundary note.
