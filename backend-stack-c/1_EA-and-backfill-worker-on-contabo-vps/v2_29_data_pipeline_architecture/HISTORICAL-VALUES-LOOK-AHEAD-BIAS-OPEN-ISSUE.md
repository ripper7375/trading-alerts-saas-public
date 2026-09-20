# Historical Indicator Values Are Not Point-In-Time — OPEN ISSUE

**Raised:** 2026-09-09, while answering "so the newest data replaces the older data in the row with
the same timestamp?" — yes, and this is the consequence.
**Status:** **MEASURED (2026-09-20) — the drift is large. Two remedies are BUILT; both are INERT
until deployed.**

> ## ⚠ Update, 2026-09-20 — §6 has been run, on real data, for the first time
>
> **The magnitude question this document has carried since 2026-09-09 is answered, and the answer
> is not "a fraction of a tick".** New `measure_indicator_drift.py` diffed two genuine MT5
> captures taken **12 days apart** — `davintrade-stack-d-and-e/engine-1-5/` (2026-09-07) against
> `engine-1-5-new/` (2026-09-19) — over **2114 overlapping M15 bars**:
>
> | Column           | bars compared | changed           |    mean \|Δ\| |     max \|Δ\| | mean as % of channel |
> | ---------------- | ------------: | ----------------- | ------------: | ------------: | -------------------: |
> | `non_b_uoedt`    |           922 | **100.0%**        | **19.26 USD** | **22.86 USD** |           **14.0 %** |
> | `non_b_loedt`    |           922 | 99.9%             |      3.20 USD |      6.77 USD |                2.3 % |
> | `non_b_base_fl`  |           922 | **100.0%**        |      1.98 USD |      4.73 USD |                1.4 % |
> | `non_b_ssa`      |          2114 | **100.0%**        |     0.057 USD |      5.44 USD |                0.0 % |
> | `non_b_ema_ssa`  |          2114 | **100.0%**        |     0.047 USD |      4.74 USD |                0.0 % |
> | `non_b_crossing` |          2114 | 0.71% **flipped** |             — |        0 ↔ 1 |                    — |
>
> Median EDT channel width over the same bars: **137.13 USD**.
>
> **§6's own decision rule — "if it is a meaningful fraction of the EDT channel width, it decides
> how §7 gets built" — is met decisively.** The upper band of a historical bar moves by **14 % of
> the channel** on average, on **every single comparable bar**. And `*_crossing` is not a price at
> all: it is a **boolean signal flag**, and it **flipped on 15 of 2114 bars** — the indicator
> retroactively deciding a cross did or did not happen there.
>
> **The controls behaved exactly as §2 predicts, which is what makes the above trustworthy:**
> OHLCV was unchanged apart from ~3 bars of genuine broker history revision (max 0.50 USD on a
> high, a volume revision of 908 ticks); **confirmed ZigZag pivots moved on 0.0 % of 128
> overlapping bars**; `horiz_high_map` / `horiz_low_map` moved on 0.0 % of their 39/43 comparable
> bars.
>
> ### ⚠ One confound, stated rather than buried
>
> Between the two captures **`Regression Centroids (Box B)` changed from 5 to 7** (read from the
> two `_Statistic.txt` files, not inferred). So the `base_fl` / `uoedt` / `loedt` numbers above
> are a **mixture** of sliding-window refit and a deliberate reconfiguration, and the two cannot
> be separated from this pair of captures.
>
> **It does not weaken the conclusion, for two reasons.** First, `InpRegCentroids` is read at
> exactly one place in the indicator (the regression/centroid selection) and **does not touch the
> SSA decomposition at all** — verified in source. So `*_ssa`, `*_ema_ssa` and `*_crossing` are
> **confound-free**, and they still changed on **100 % of 2114 bars**. Second, from a
> backtester's point of view the two mechanisms are the same defect: the stored row was
> overwritten with a value that could not have been known at bar close. §2's own table already
> says so for the fixed-anchor families — "re-anchoring them rewrites _every_ historical value at
> once".
>
> **A clean re-run is still worth having**, and the script is kept for it: two captures with no
> input change in between isolates the pure sliding-window term. `measure_indicator_drift.py OLD
NEW` is all it takes.
>
> ### Two findings about the measurement itself
>
> - **The age-gradient prediction in §6 could not be tested here.** The overlap starts 25 % into
>   the old capture's window, so the oldest quartile has **zero** comparable bars. Within the
>   range that does exist the direction holds (`uoedt` mean 22.01 in the 50–75 % bin vs 18.40 in
>   the newest quartile), but that is partial support, not confirmation. Reported as untestable
>   rather than refuted.
> - **`base_fl`/`uoedt`/`loedt` only exist over part of the window.** 922 of 2114 bars, which is
>   **exactly** the old capture's own `Visual EDT Window (Bars): 922`. A useful internal
>   consistency check on the tooling — and it means the drift is not a gentle gradient but a
>   **wholesale repaint of the entire drawn channel**.
>
> ### What was built in response
>
> **A point-in-time snapshot lane (§7 option 1, with §7 option 2's provenance folded in).** New
> `market_data_point_in_time` table, written by the gateway the first time it sees a bar that has
> already closed, `ON CONFLICT DO NOTHING`, never updated. 69 columns — the ones that actually
> drift — plus `snapshot_age_bars`, which records how much hindsight a row contains. See §7 below,
> which is rewritten, and §9, which is new.
>
> **Status of each remedy, so neither is over-read:**
>
> | Remedy                                 | Built | Deployed | Covers                                                       |
> | -------------------------------------- | :---: | :------: | ------------------------------------------------------------ |
> | `InpProjectionMode = MODE_FROZEN_LINE` |  yes  |  **no**  | 21 of 69 drifting columns (7 variants × base_fl/uoedt/loedt) |
> | `market_data_point_in_time`            |  yes  |  **no**  | all 69, from the moment it is deployed                       |
> | Recompute offline (§7 option 3)        |  no   |    no    | everything, including history already stored                 |
>
> **Neither remedy repairs the ~3000 bars already in `market_data_v6`.** That still needs §7
> option 3 and the parked Python calc stack.

> **Update, 2026-09-18.** A remedy now exists in code for the largest part of this issue and is
> tested, but **nothing about production behaviour has changed yet** and the honest status is
> still "open". Specifics, so this is neither over- nor under-read:
>
> - **What is fixed, in code.** All 7 centroid indicators gained `InpProjectionMode`. In
>   `MODE_FROZEN_LINE` the clustering and combinatorial fit are bypassed and the approved line is
>   projected forward from a fixed, time-resolved anchor, which makes a closed bar's
>   `base_fl`/`uoedt`/`loedt` mathematically immutable. That covers ~**21 of the ~56 drifting
>   fields** (7 variants x 3 channel columns). See `ACTIVE-STANDBY-FROZEN-BASELINE-AND-CENTROID-ALERT-ARCHITECTURE.md`
>   and the pipeline blueprint §5.6.
> - **What is NOT fixed.** `fractal_*`, `best_resistance`, `best_support` and the per-variant
>   `horiz_*_map`/`ssa`/`ema_ssa` columns are untouched by this work and still rewrite. The
>   still-forming newest bar (§ below) is unchanged. Neither is the M5/M15 statistic snapshot
>   path, which was already point-in-time honest by construction.
> - **Why the status is not "RESOLVED".** `InpProjectionMode` defaults to
>   `MODE_DYNAMIC_AUTOFIT`, the `.ex5` have not been rebuilt, and no terminal has been switched
>   to frozen mode. Until an ACTIVE terminal actually runs frozen, every word below still
>   describes live production exactly. Deployment is blueprint §13 item 8.
> - **Evidence so far.** Synthetic exports driven through the REAL collector and the REAL
>   `promote_cycle()`: the frozen path repainted **0 of 44** historical bars across two cycles;
>   the dynamic path repainted **44 of 44**, largest single move **3.29 USD**. So the mechanism
>   demonstrably works and the problem demonstrably exists — but neither number came from
>   real MT5 data, and **the magnitude experiment described in §4 below has still never been
>   run**. Run it before relying on any of this for backtesting.
> - **A second, independent reason to run that experiment anyway:** it is the only way to size
>   how wrong the ~3000 bars of history already sitting in `market_data_v6` are. Freezing from
>   today forward does nothing about data already stored.
>   **Severity:** low for reporting and charting; **high for backtesting, walk-forward validation and
>   any fitness scoring** that reads `market_data_v6` history.
>   **Not a bug.** Nothing here is malfunctioning. It is an inherent property of storing a
>   sliding-window indicator's output in a mutable, timestamp-keyed table — worth recording before
>   someone builds on the assumption that it works the other way.

> **In one line:** a historical row does not hold "what the indicator said at that bar." It holds
> "what the indicator said about that bar, up to ~2 weeks later" — so the row knows about its own
> future.

---

## 1. The mechanism — three facts, all verified in code

**a. Re-pushed bars overwrite in place.** The gateway upserts on
`(symbol, timeframe, timestamp)`, and `promote_cycle()` re-queues every in-window bar each cycle
(`INSERT OR REPLACE` omits `synced_at`, so SQLite resets it to NULL — tested directly). So a given
bar's row is rewritten on every collection cycle for as long as MT5 keeps exporting it.

**b. The centroid/SSA window re-anchors to the live bar on every pass.**
`2EDTCentroidRegression*_v2_29.mq5`:

```mql5
input int InpSSAMathLookback = 3000;
int startIdx = (rates_total > InpSSAMathLookback) ? rates_total - InpSSAMathLookback : 0;
```

`rates_total` advances with every new bar, so the fitting window slides forward continuously. The
value plotted _at bar T_ is refitted against data that keeps extending past T.

**c. A bar stays in that window for 3000 bars, then freezes forever.** MT5 exports only the newest
3000 bars (`InpBars = 3000`). Once a bar scrolls out it is never re-exported, so its Postgres row
is never corrected again. The schema already documents this in its §5 RETAIN comment: rows beyond
the window are _"a frozen last-known snapshot that will never be corrected again."_

**How long is 3000 bars?** At XAUUSD market hours (~23h/day, 5 days/week):

| Timeframe | 3000 bars ≈                       |
| --------- | --------------------------------- |
| M5        | ~250 market hours ≈ **2.2 weeks** |
| M15       | ~750 market hours ≈ **6.5 weeks** |

## 2. Which fields are affected — and which are not

Not everything drifts. Established by reading the indicator sources, not assumed:

| Field group                                                                            | Behaviour                      | Why                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `*_ssa`, `*_ema_ssa`, `*_base_fl`, `*_uoedt`, `*_loedt`, `*_crossing`, `*_horiz_*_map` | **Drifts every pass**          | Sliding `InpSSAMathLookback = 3000` window re-anchored to `rates_total` (§1b). SSA is a whole-window decomposition — it is not a streaming/causal filter.                                                                                             |
| newest `zigzag_*` pivot                                                                | **Drifts until confirmed**     | The live pivot is provisional until price moves enough to confirm it. Older pivots are stable.                                                                                                                                                        |
| `open`, `high`, `low`, `close`, `volume`                                               | **Stable** once the bar closes | Facts about the bar.                                                                                                                                                                                                                                  |
| `body_direction`, `body_size`, `body_classification`                                   | **Stable**                     | `InpZScoreLength = 432` is a _trailing_ window — bar T's z-score uses T‑431…T only. The export is even trimmed by 432 bars at the old end for exactly this reason. Genuinely causal.                                                                  |
| `fractal_*`, `best_resistance`, `best_support`                                         | **Stable — but fragile**       | Fitted to **fixed** `InpStartDateTime`/`InpEndDateTime` anchors, not a sliding window, so they do not drift on their own. But re-anchoring them (which blueprint §13 says is required per analysis window) rewrites _every_ historical value at once. |

So roughly **56 of the 83 data fields** (the seven centroid families) drift continuously; the
z-score triple and OHLCV are trustworthy as point-in-time values.

## 3. Why this is look-ahead bias — worked example

Take an M5 bar that closed **2026-09-01 10:00**:

| When              | What happens to that row                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 2026-09-01 10:05  | First promoted. Centroid line fitted with a window ending ~now. **This is the honest point-in-time value.**             |
| every 5 min after | Refitted and re-pushed. The window's right edge keeps advancing. The stored value drifts.                               |
| ~2026-09-16       | Bar falls out of MT5's 3000-bar window. **Row freezes.**                                                                |
| forever after     | Postgres holds a value for `timestamp = 2026-09-01 10:00` that was computed **using price action through ~2026-09-16**. |

Ask that row "what would my centroid line have told me on 1 September?" and it answers with a line
fitted using two more weeks of data that had not happened yet. For a walk-forward test or a
fitness score, that is textbook look-ahead bias — and it will flatter results, because the line was
fitted with knowledge of where price actually went.

**The sharp part:** the honest value _is_ captured — briefly. It is the first value written after
the bar closes. Then roughly 3000 subsequent UPSERTs destroy it. The pipeline computes exactly the
number a backtest needs and then overwrites it.

## 4. A related nuance — the newest row is always a partial bar

Verified in `ohlcvexportlightweight_v2_29.mq5`: `ArraySetAsSeries(..., true)` with
`CopyTime(symbol, timeframe, 0, bars_to_export, time)` starts at shift **0** — the currently
_forming_ bar. The export loop runs down to `i = 0`, so the newest row in every export is a bar
that is still open.

The collector reads at :05 past each 5-minute boundary, so that row is a bar roughly 5 seconds old
with partial OHLC. It is promoted and pushed like any other, then corrected on the next cycle.

Consequences worth knowing:

- **The newest row in `market_data_v6` is always an incomplete candle** until the next cycle
  overwrites it. Anything doing `ORDER BY timestamp DESC LIMIT 1` gets a partial bar.
- It also means the "first-seen value" for bar T (§3) is a _partial-bar_ value. The honest
  close-of-T value is the one written on the **next** cycle, once T has closed. Any snapshot
  scheme (§6) must skip the forming bar, not just take the first write.

## 5. What this does and does not invalidate

**Fine as-is:**

- Live alerting and the terminal chart — they want the current best fit, which is exactly what the
  live zone holds.
- Reports and visualisations of recent history.
- Anything using OHLCV or the z-score set, which are point-in-time correct.

**Not safe without addressing this:**

- Backtesting a strategy over stored history.
- The Decision Layer's `fitness_scorer`, walk-forward flow and out-of-sample controls
  (`v2_29_davintrade_decision_layer/DAVINTRADE_DECISION_LAYER_BLUEPRINT.md` §2.3/§2.4). Note that
  document is **already BLOCKED** for a different reason (it needs the parked Python calc stack
  for arbitrary-parameter recomputation). **This is a second, independent reason** its scoring
  cannot simply read `market_data_v6` history and treat it as honest.
- Any claim of the form "this indicator would have caught that move."

## 6. Measure it before deciding anything — **DONE, 2026-09-20**

The mechanism was certain; the magnitude was unknown and might have been small enough not to
matter. It is not. See the banner at the top of this document for the numbers.

### The tool

`measure_indicator_drift.py`, kept beside the collector so the experiment can be repeated rather
than re-derived:

```bash
python measure_indicator_drift.py OLD_CAPTURE_DIR NEW_CAPTURE_DIR [--json out.json]
```

It compares every `.txt` export present in both directories, per column, over the timestamps
present in both, and reports `changed %`, mean / median / p95 / max absolute drift, drift as a
percentage of the median EDT channel width, and a breakdown by bar age.

**Two things it handles that a naive diff does not, both of which would otherwise produce a
confidently wrong answer:**

- **Timestamp phase.** Captures taken before the 2026-09-09 `TimeCurrent()` fix carry a constant
  sub-bar offset (blueprint §7.1). Timestamps are snapped to the bar grid before matching, exactly
  as the collector's own defensive snap does. Without this the overlap is **zero** and the script
  reports "no drift" for entirely the wrong reason. Confirmed on the real captures: the 2026-09-07
  set sits at phase 2–3 s, the 2026-09-19 set at 0–5 s.
- **Control columns.** OHLCV and the confirmed ZigZag metrics must come back unchanged. If they
  move, the two captures are not of the same series and every other number is meaningless. They
  are reported alongside, flagged `[CONTROL]`, rather than assumed.

### How to repeat it properly

The 2026-09-20 run was opportunistic — two captures that happened to exist — and carries the
`InpRegCentroids` confound described in the banner. A clean run:

1. Copy `MQL5/Files/*.txt` to a dated folder.
2. **Change no indicator input.** This is the step the first run could not honour.
3. Wait a week or more — the longer the gap, the clearer the drift (but keep it under the export
   window, or the overlap is zero: ~2.2 weeks on M5, ~6.5 weeks on M15).
4. Copy them again and run the script.

To isolate the pure sliding-window term even so, read `*_ssa` / `*_ema_ssa` / `*_crossing`: the
SSA decomposition is driven only by `InpSSAMathLookback` and `SSAWindow`, so it is unaffected by
the centroid-count input. Verified in the indicator source, not assumed.

## 7. Options — evaluated against the measurement, 2026-09-20

§6 has run and the drift matters, so these are no longer hypothetical. Each is judged here against
what was actually measured.

### Option 1 — append-only snapshot table ✅ **BUILT** (not deployed)

Alongside the mutable `market_data_v6`, write a row the _first_ time each bar is seen **after it
closes** (§4) and never update it. Gives a genuine "as of bar close" series while leaving the live
table exactly as it is.

**Built as `market_data_point_in_time`.** Details in §9.

### Option 2 — store the bar's age at write time ❌ **does not work on its own**

The original sketch was "add a column recording how many bars had elapsed when the value was
computed... a backtest could select only rows written at age 0."

**It cannot.** On a mutable row the column records the age at the time of the _latest_ write, and
every in-window bar is rewritten on every cycle — so after a day every row reads `age ≈ 288`, and
after 3000 refits every row reads ~3000. `WHERE bar_age = 0` returns the newest bar and nothing
else. The column would make the bias visible and provide no filterable honest history at all.
Making it work would mean refusing to update a row once its age exceeds 0, which is exactly the
live-zone behaviour §8 forbids breaking.

**The idea is right; the table is wrong.** Age provenance only means something on a row that is
never rewritten. It is therefore folded into option 1 as `snapshot_age_bars`, where it does real
work: it exposes how much hindsight a snapshot contains when the push worker was behind.

### Option 3 — recompute history offline ⏸ **still blocked, still the only complete fix**

Don't trust the stored series at all — re-run the indicator over each historical window with a
properly truncated dataset. Statistically correct, and the **only** option that repairs the ~3000
bars already stored; options 1 and 2 are prospective only. Cannot be done from MQL5, which only
ever computes against the live chart. Needs the parked Python calc stack
(`calculation-split-between-mt5-and-python-PENDING-PROJECT/`), which has two open bugs to fix
first.

### Option 4 — accept and document ❌ **no longer defensible**

Legitimate if §6 had shown negligible drift. It showed 14 % of the channel width on 100 % of bars,
and a boolean signal flag flipping on 0.71 %. Documentation alone is not an answer to that.

### Option 5 — freeze the ACTIVE terminal (`MODE_FROZEN_LINE`) ⚠ **necessary, not sufficient**

Built 2026-09-18 in all 7 centroid indicators and currently defaulted off. See §10.

## 8. Do not break these while addressing it

- **The live zone must keep updating in place.** Alerts and charts depend on the newest fit; this
  is a feature, not the problem. ✅ The snapshot lane writes a **second** row; `market_data_v6`'s
  upsert is untouched, and a test pins the ordering.
- **The 95-field contract is frozen** across the gateway schema, both Prisma schemas and the DTO.
  (It was 87 when this was written; the 14th indicator took it to 95 on 2026-09-16.) ✅ The
  snapshot lane **does not touch it**: the snapshot is derived server-side from the same payload,
  so no wire field was added, no DTO regenerated, and the push worker is unchanged. It still needs
  a coordinated release and sign-off, because it adds a table and a gateway write — see §9.
- **Retention interaction.** SQLite prunes only synced rows outside the 3000-bar window. A snapshot
  table must not reintroduce unbounded growth on the VPS — it belongs in Postgres, written by the
  gateway, not accumulated on the Contabo disk. ✅ Honoured exactly: **nothing on the VPS changed.**
  No new SQLite table, no new outbox, no collector change. Postgres growth is ~384 rows/day
  (288 M5 + 96 M15) ≈ **140 k rows/year**, one row per bar, never updated.

---

## 9. The point-in-time snapshot lane (§7 option 1) — BUILT 2026-09-20, NOT DEPLOYED

### What it is

`market_data_point_in_time`: one immutable row per `(symbol, timeframe, timestamp)`, holding each
indicator's reading **as it stood when the bar had just closed**.

### Where it is written, and why there

In `railway-gateway`'s `MarketDataProcessor`, immediately after the existing
`market_data_v6` upsert. Three properties follow from that placement:

- **Write-once**, via `createMany({ skipDuplicates: true })` against the unique key — an
  `INSERT ... ON CONFLICT DO NOTHING`. Re-delivery is the norm here, not an exception: the push
  worker retries by design and **every in-window bar is re-queued on every cycle**, so this runs
  thousands of times per bar and must be a no-op after the first.
- **It cannot break ingestion.** Wrapped and logged, never rethrown — the same ordering, and the
  same reason, as the collector's own statistics capture. Price data is load-bearing for live
  alerting; a snapshot is valuable telemetry.
- **Never the forming bar.** Every export ends at shift 0 because `validate_cycle()`'s
  completeness check requires it, so the newest row in every payload is a partial candle (§4).
  `buildSnapshot()` returns `null` until the bar's period has ended.

### Which columns, and why not all 95

The **69 that actually drift**: the 7 centroid variants (56), `fractal_*` / `best_resistance` /
`best_support` (5), and `sr_1..sr_8` (8).

Deliberately **absent**: the OHLCV spine, the causal z-score triple (`InpZScoreLength` is a
trailing window), and the 11 `zigzag_*` columns. All three were **measured stable** in §6, so
duplicating them would cost storage and buy nothing. A consumer needing them joins
`market_data_v6` on `(symbol, timeframe, timestamp)` — safe precisely because those are the
columns that do not move.

The list is **generated**, not hand-written: `generate_point_in_time_schema.py` derives it from
the collector's own `SOURCES` registry via the same `market_data_column()` that `promote_cycle()`
uses. A column added upstream appears here automatically or a test fails. That is deliberate —
a hand-maintained 69-column mirror across two Prisma schemas is exactly the drift this repo has
been bitten by before.

### ⚠ `snapshot_age_bars` — read it before trusting a row

Whole bar periods between the bar closing and the snapshot being taken.

| value | meaning                                                                  |
| ----- | ------------------------------------------------------------------------ |
| `1`   | **honest.** First cycle after the bar closed.                            |
| `> 1` | the push worker was behind; the row carries that many bars of hindsight. |
| `0`   | never written — the bar was still forming.                               |

**This column is not decoration.** `PUSH-WORKER-THROUGHPUT-OPEN-ISSUE.md` documents a real demand
(~800 rows/min) against a likely capacity (375–600), with **oldest-first** selection — so under
backlog the newest bars arrive late, and a snapshot lane without this column would silently
reproduce the very bias it exists to remove. A late snapshot is still recorded rather than
dropped, because a gap is indistinguishable from "the indicator had nothing to say"; the age lets
the consumer decide.

### Query guards for downstream consumers (Stack D / E, Decision Layer)

**Backtests, walk-forward validation and `fitness_scorer` must read
`market_data_point_in_time`, never `market_data_v6` history**, and must filter on the age:

```sql
-- Honest point-in-time series. The age filter is not optional.
SELECT p.*, m.open, m.high, m.low, m.close, m.volume
FROM   market_data_point_in_time p
JOIN   market_data_v6 m
       ON  m.symbol    = p.symbol
       AND m.timeframe = p.timeframe
       AND m.timestamp = p.timestamp
WHERE  p.symbol            = 'XAUUSD'
  AND  p.timeframe         = 'M15'
  AND  p.snapshot_age_bars = 1          -- 1 = captured on the first cycle after close
  AND  p.timestamp BETWEEN :from AND :to
ORDER  BY p.timestamp;
```

Joining `market_data_v6` for OHLCV is safe **only** for the spine columns — they are facts about
the bar and were measured unchanged. Never join it for an indicator column; that is the mutable
value this whole table exists to avoid.

To audit how much of a window is trustworthy before relying on it:

```sql
SELECT snapshot_age_bars, COUNT(*)
FROM   market_data_point_in_time
WHERE  symbol = 'XAUUSD' AND timeframe = 'M15'
GROUP  BY 1 ORDER BY 1;
```

**Live alerting, the terminal chart and recent-history reporting keep reading
`market_data_v6` exactly as they do today.** Nothing about that path changed.

### ⚠ Rollout order

1. Apply `prisma/migrations/20260920000000_add_market_data_point_in_time/` to production.
2. **Then** let `railway-gateway` deploy — it auto-deploys from `main`.

Reversing that order does not corrupt anything (the snapshot write is wrapped and cannot fail the
`market_data` upsert) but **every bar missed in between is gone for good**, because the honest
value exists exactly once. The migration is a single additive `CREATE TABLE` and touches no
existing row.

**The migration is authored and NOT applied** — the Executor never applies a migration to a live
database.

---

## 10. Is freezing the ACTIVE terminal enough? — no, and here is the arithmetic

`InpProjectionMode = MODE_FROZEN_LINE` exists in all 7 centroid indicators (built 2026-09-18,
compiled, currently defaulted to `MODE_DYNAMIC_AUTOFIT`). **Enabling it on the ACTIVE terminal is
viable and worth doing** — it removes the largest measured term — **but it is not a substitute for
§9.**

Read in the source: the frozen branch bypasses `PerformClusteringAndEDT()` and projects the
approved line instead. **The SSA decomposition runs before that branch and is unaffected by it.**

| Column group (× 7 variants)                |           Frozen mode            | Measured drift                                                                                 |
| ------------------------------------------ | :------------------------------: | ---------------------------------------------------------------------------------------------- |
| `*_base_fl`, `*_uoedt`, `*_loedt` (21)     |            ✅ frozen             | the largest term — up to 14 % of channel                                                       |
| `*_ssa`, `*_ema_ssa`, `*_crossing` (21)    |         ❌ still dynamic         | 100 % of bars change; `crossing` flips on 0.71 %                                               |
| `*_horiz_high_map`, `*_horiz_low_map` (14) |          ❌ not covered          | 0.0 % over the comparable sample                                                               |
| `fractal_*`, `best_resistance/support` (5) | ❌ different indicators entirely | not measurable — no capture overlap                                                            |
| `sr_1..sr_8` (8)                           |      ❌ different indicator      | not measured; structurally the strongest look-ahead of all (§6.3 of the 14th-indicator design) |

**So freezing covers 21 of 69 drifting columns.** It is the right first move and it is cheap; it
is not the fix. `*_crossing` in particular is a **signal** flag that still flips retroactively
under frozen mode, which is precisely the kind of value a fitness scorer would treat as ground
truth.

## Related open items

- `PUSH-WORKER-THROUGHPUT-OPEN-ISSUE.md` — separate concern, same subsystem. Worth reading
  together: if the newest bars are arriving late (that issue), then the "first-seen honest value"
  this document depends on may not be reliably captured in the first place.
- `calculation-split-between-mt5-and-python-PENDING-PROJECT/CALCULATION-SPLIT-ARCHITECTURE-PENDING.md`
  — option 3 above is only possible with that stack revived.
