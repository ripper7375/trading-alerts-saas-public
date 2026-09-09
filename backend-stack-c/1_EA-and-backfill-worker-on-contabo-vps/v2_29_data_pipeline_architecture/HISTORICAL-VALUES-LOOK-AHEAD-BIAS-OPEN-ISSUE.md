# Historical Indicator Values Are Not Point-In-Time — OPEN ISSUE

**Raised:** 2026-09-09, while answering "so the newest data replaces the older data in the row with
the same timestamp?" — yes, and this is the consequence.
**Status:** **OPEN — mechanism verified in code, magnitude never measured.**
**Severity:** low for reporting and charting; **high for backtesting, walk-forward validation and
any fitness scoring** that reads `market_data_v6` history.
**Not a bug.** Nothing here is malfunctioning. It is an inherent property of storing a
sliding-window indicator's output in a mutable, timestamp-keyed table — worth recording before
someone builds on the assumption that it works the other way.

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

## 6. Measure it before deciding anything

The mechanism is certain; **the magnitude is unknown and might be small enough not to matter.**
Cheap experiment, no code changes:

1. Copy today's `MQL5/Files/*.txt` exports to a dated folder.
2. Wait a week (or longer — the longer the gap, the clearer the drift).
3. Copy them again.
4. For timestamps present in both, diff the values per field.

```python
# per field: how far did the SAME bar's value move between the two captures?
# report max / mean absolute drift for *_base_fl, *_uoedt, *_loedt, *_ssa
```

Expected pattern if §1 is right: OHLCV and `body_*` identical; centroid/SSA fields differ, with
drift **largest for bars near the old edge** of the window (most refits behind them) and smallest
for recent bars. If the drift is a fraction of a tick, this is a footnote. If it is a meaningful
fraction of the EDT channel width, it decides how §7 gets built.

## 7. Options, if point-in-time history is needed

Not recommendations — none of these should be built before §6 says the drift matters.

**1. Append-only snapshot table (most faithful).** Alongside the mutable `market_data_v6`, write a
row the _first_ time each bar is seen after it closes (§4) and never update it. Gives a genuine
"as of bar close" series for backtesting while leaving the live table exactly as it is. Cost: a
second table with the same row count, and a rule for which fields are worth snapshotting (only the
~56 drifting ones).

**2. Store the bar's age at write time.** Add a column recording how many bars had elapsed when the
value was computed. Doesn't fix the bias but makes it _visible_ and filterable — a backtest could
select only rows written at age 0. Cheaper than option 1; changes the frozen 87-field contract, so
it needs sign-off.

**3. Recompute history offline for backtests.** Don't trust the stored series at all — re-run the
indicator over each historical window with a properly truncated dataset. This is the statistically
correct approach and it is exactly what the **parked Python calc stack** was for; it cannot be done
from MQL5, which only ever computes against the live chart. See
`calculation-split-between-mt5-and-python-PENDING-PROJECT/`.

**4. Accept and document.** Legitimate if §6 shows the drift is negligible, or if nobody ever
backtests on stored history. Requires the limitation to be stated wherever the data is consumed,
so it is not silently assumed away later.

## 8. Do not break these while addressing it

- **The live zone must keep updating in place.** Alerts and charts depend on the newest fit; this
  is a feature, not the problem.
- **The 87-field contract is frozen** across the gateway schema, both Prisma schemas and the DTO.
  Options 1 and 2 touch it and need coordinated releases plus Davin's sign-off.
- **Retention interaction.** SQLite prunes only synced rows outside the 3000-bar window. A snapshot
  table must not reintroduce unbounded growth on the VPS — it belongs in Postgres, written by the
  gateway, not accumulated on the Contabo disk.

## Related open items

- `PUSH-WORKER-THROUGHPUT-OPEN-ISSUE.md` — separate concern, same subsystem. Worth reading
  together: if the newest bars are arriving late (that issue), then the "first-seen honest value"
  this document depends on may not be reliably captured in the first place.
- `calculation-split-between-mt5-and-python-PENDING-PROJECT/CALCULATION-SPLIT-ARCHITECTURE-PENDING.md`
  — option 3 above is only possible with that stack revived.
