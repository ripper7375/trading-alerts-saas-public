# Frontend UI Revision Recommendations — surfacing the completed backend engines

**Date:** 2026-09-10
**Status:** Recommendation only. Nothing here is built; each item states what it needs and what
blocks it.
**Author's note:** written at Davin's request after the market-session / economic-events session
(`davintrade-news-stack/market-session-and-high-impact-news-manifest-work-completion.md`).

---

## 1. The gap, in one table

Several backend engines now produce real, validated data that **nothing on the frontend renders**.
That is the whole subject of this document.

| Engine                   | Data available                                                                     | UI today                             | Gap                                   |
| ------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------- |
| Market sessions          | Computed from the clock                                                            | ✅ Banner in the right panel         | none                                  |
| **Indicator statistics** | `indicator_statistics` — 37 cols × 10 sources × 2 TF, append-only since 2026-09-09 | ❌ **NOTHING**                       | **The largest gap. §2**               |
| **Economic events**      | `economic_events` — append-only, this session                                      | Banner news row: **next event only** | Everything past one row. §3           |
| `market_data_v6`         | 87 columns, live                                                                   | Chart overlays, MTF panes            | Adequate                              |
| MTF chart render         | R2 objects                                                                         | `PNG Download` button                | Inert — needs the R2 bucket           |
| Stack E market comments  | ❌ **not built** (no `trg_generate_market_comments`)                               | Genuine empty state                  | Out of scope — needs the engine first |
| Stack D chat / Pillar 8  | ❌ **not built** (Phase 12, unstarted)                                             | —                                    | Out of scope                          |

**Verified, not assumed:** a repo-wide grep for `indicatorStatistic` / `indicator_statistics`
across `app/`, `components/` and `lib/` returns **zero hits**. That table has been accumulating a
snapshot per source per cycle since 2026-09-09 and no pixel anywhere reads it.

---

## 2. Recommendation A — the EDT Quality Metrics panel _(highest value, but gated on four decisions)_

### 2.1 Why this first

`seed-code`'s panel already specifies it (its D6 block: Bar Coverage, Regression R², EDT Fitness,
Baseline Symmetry), the monolith renders a "coming soon" empty state in its place, and **the data
to fill it already exists and is already flowing**. This is the shortest distance between stored
data and something a trader can use.

It is also the honest answer to "is this line any good?" — which is the question a channel-based
system most needs to answer and currently cannot.

### 2.2 What backs each metric

| Seed metric                          | Source in `indicator_statistics`                         | Notes                                           |
| ------------------------------------ | -------------------------------------------------------- | ----------------------------------------------- |
| **Bar Coverage**                     | `window_bars` / `math_lookback`                          | Both captured per source per cycle              |
| **Regression R²**                    | `model_a_r2` (crossings) / `model_b_r2` (close)          | ⚠ Negative in real data — see §2.3             |
| **EDT Fitness**                      | `model_b_mse`, `raw_slope`, `regression_angle`           | Formula needs a decision                        |
| **Baseline Symmetry**                | `uoedt_offset` vs `loedt_offset`                         | ⚠ Penalising asymmetry may be wrong — see §2.3 |
| _(recommended)_ **Containment Rate** | `containment_rate`, `containment_count`, `containment_n` | ✅ Already computed, no scoring needed          |

### 2.3 ⚠ Four problems that must be decided before this can be built

These were found on 2026-09-09 while reviewing the EDT Quality Metrics spec and **were never
resolved**. Building the panel without settling them ships numbers that look authoritative and are
not.

1. **Bar Coverage's formula contradicts its own bands.** The spec's worked example
   `(60 − 30) / 150` yields **20%**, while its band table calls the same input **50%**. One of the
   two is wrong and it is not clear which was intended.
2. **EDT Fitness bands are off by 5 points.** Inputs of 1.8 and 2.6 produce 80% by the formula;
   the table labels that row 85%.
3. **R² is negative in the real captured data** — measured −0.0936 (crossings) and −0.1221
   (close) in an actual export. The spec's `max(0, …)` clamps that to 0%, so the metric would
   read "0% fit" permanently. Worse, it may be **structurally** negative: these lines are fitted
   to centroids or fractal touches and then scored against closes they never attempted to fit.
   **The distribution needs checking before R² is allowed to carry 40–60% of a quality score.**
4. **Penalising channel asymmetry may be measuring the wrong thing.** EDT is constructed from the
   outermost qualifying touches, so an asymmetric channel can be a _true reading of the market_
   rather than a defect in the fit.

### 2.4 Recommended alternative — lead with Containment Rate

`containment_rate` — the percentage of the fitted window that closed inside the channel — has no
structural bias, is directly interpretable ("price stayed in this channel 94% of the time"),
requires no scoring formula at all, and is **already computed and stored**. The decision-layer
blueprint independently names EDT containment as a fitness input.

**Suggested panel:** Containment Rate as the headline figure, with Bar Coverage and Baseline
Symmetry as raw supporting readouts, and R² shown as a **raw number with its sign** rather than a
clamped percentage until §2.3 item 3 is settled.

### 2.5 Scope estimate

Small. The data layer mirrors `lib/economic-events/queries.ts` almost exactly (latest observation
per `(symbol, timeframe, source)` — the same `distinct`-on-append-only-key collapse), one
PRO-gated route, and one panel component. The hard part is entirely §2.3, and none of it is
engineering.

---

## 3. Recommendation B — the news surface beyond one row

The banner currently shows **only the next event**. The table holds a two-week window with
forecast, previous, revision history and source URL. Three uses, in descending value:

### 3.1 Event markers on the chart _(highest value)_

Vertical lines at high-impact event times on the M5/M15 panes. This is what makes a spike
legible after the fact — "that wasn't structure breaking, that was CPI" — and it is genuinely
hard to get anywhere else in one glance.

Needs a decision on **which currencies** mark the chart. The lane captures every currency; the
banner filter is `USD/EUR/GBP/JPY/CHF` and is a display choice, not a capture one.

### 3.2 Pre-event alerts

The alert engine already exists and already fires. "Notify me 15 minutes before high-impact USD
news" is a new alert _type_, not new infrastructure. Directly protective: it is the moment a
trader most wants to be told to stand aside.

### 3.3 An expandable event list

The banner row becomes a click target opening the next 5–10 events with forecast/previous. Cheap,
and it reuses the route as-is — `getUpcomingHighImpactEvents()` already returns a list and the API
already serves 10; only the banner narrows it to `[0]`.

---

## 4. Recommendation C — the D5 gauge dials _(BLOCKED, do not start)_

`seed-code`'s three circular dials — **M15 EDT Stochastic**, **M15 SSA Deviation**, **M15 Market
Momentum** — are hardcoded to 85 / 72 / 61 in the mock.

**None of the three is a stored column, and none is defined anywhere in the repo.** They are
derived scores whose formulas do not exist. The nearest specified relative is Stack D's WACS
(`WACS54`), which belongs to an engine that is not built.

**Recommendation: do not build these until the formulas are written down.** Rendering a dial
requires inventing what it measures, which is the fabrication the market-comments panel already
refuses. They are the one part of the seed panel with no data behind them.

---

## 5. Recommendation D — `/econ-news` data-source consistency _(a question, not a task)_

`/econ-news` renders TradingView's widget; the terminal banner renders our own MT5-sourced data.
**They will sometimes disagree** — MetaQuotes and TradingView do not carry identical calendars.

Three options, in order of my preference:

1. **Accept it.** They serve different jobs: `/econ-news` is a public marketing/browse surface,
   the banner is a live trading signal. Costs nothing.
2. **Add a footnote** on `/econ-news` naming its source. Nearly free, removes the surprise.
3. **Rebuild `/econ-news` on our own data.** Consistent, but discards a working widget and puts a
   public page behind a lane that depends on the VPS terminal being healthy. **Not recommended.**

---

## 6. What NOT to build yet

- **Stack E's market-comments feed.** The `trg_generate_market_comments` PL/pgSQL trigger does not
  exist; there is no data. The panel's empty state is correct and should stay.
- **The Trade Setup Card** (seed D6). Every figure in it — entry, TP, SL, RRR — is invented in the
  mock. It needs Stack D's Report 2, which is Phase 12.
- **The seed's full blur-and-lock overlay on `/free`.** Worth doing when there is content behind
  the glass; blurring an empty panel advertises nothing.
- **Anything that renders `indicator_statistics` before §2.3 is settled.**

---

## 7. Suggested sequence

| Order | Item                               | Blocked by                         |
| ----- | ---------------------------------- | ---------------------------------- |
| 1     | §3.3 expandable event list         | Nothing — route already returns 10 |
| 2     | §3.1 chart event markers           | Currency-scope decision (small)    |
| 3     | §3.2 pre-event alerts              | Alert-type design                  |
| 4     | §2 EDT Quality Metrics panel       | **§2.3's four decisions — yours**  |
| 5     | §4 gauge dials                     | Formulas do not exist              |
| —     | Stack E comments, Trade Setup Card | Engines not built                  |

Items 1–3 are all downstream of the lane completed this session and need no new backend. Item 4 is
the highest value and the only one gated on judgement rather than engineering.

**Everything above is additionally gated on the economic-events lane actually running** — see the
completion manifest's §9. Until the migration is applied and the VPS is deployed, §3's items have
an empty table to read.
