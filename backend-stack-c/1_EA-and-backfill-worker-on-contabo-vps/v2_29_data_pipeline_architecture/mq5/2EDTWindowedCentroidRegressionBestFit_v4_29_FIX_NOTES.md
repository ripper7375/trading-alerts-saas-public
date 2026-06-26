# Centroid / Baseline / EDT "show then disappear" — investigation & DIAGNOSTIC build

**File:** `2EDTWindowedCentroidRegressionBestFit_v4_29.mq5`

## Status: diagnostic build (not the final fix yet)

The current `.mq5` is an **instrumented build**. It still runs normally, but on
every math pass it writes a readout to the chart (top-left `Comment`) and to the
**Experts** log. We use it to capture exactly what changes at the moment the
display collapses, so the real fix is certain instead of a guess.

## What was already ruled out

1. **Gemini's "asynchronous buffer corruption" theory is false.** It claimed that
   calling `PerformClusteringAndCFL()` from `OnTimer()`/`OnChartEvent()` corrupts
   indicator buffers. The working sibling in this repo,
   `2EDTCentroidRegressionBestFitNonMostRecent_v2_29.mq5`, **does exactly that**
   (see its `OnTimer` line ~288 and `OnChartEvent` line ~337) and displays fine.
   Removing those calls did not fix the bug and also disabled the per-minute
   export refresh.

2. **"Window crossings truncated to empty" is not the cause.** In the broken
   screenshot the black SSA-crossing markers are still present inside the window,
   and the user confirmed the crossing dots remain. So the clustering *input*
   exists; the clustering *result* collapses (only ~1 cluster -> fails the
   `n_reg < 3` gate -> one stray hull, no baseline/EDT).

## Leading hypothesis being tested

The sibling clusters the **recent** ~3000 bars (sliding, near the live edge) and
is stable. This indicator clusters a **fixed historical date window**. Both derive
crossings from a global SSA whose basis depends on how much history is loaded. As
MT5 streams history in after attach, the SSA basis shifts, the crossing positions
**inside the fixed window** move, and the clustering flips from "many clusters"
(what you saw) to a collapsed result (what persists). i.e. the good display is the
transient partial-history state; the collapsed one is the stable full-history state.

## How to run the diagnostic and what to send back

1. Compile and attach to the **same chart/timeframe** where the bug happens.
2. Open **Toolbox -> Experts** (the log).
3. Watch the top-left on-chart readout and the log as it transitions from the
   full display to the collapsed display.
4. Send back the **log lines around the moment it collapses** (a few `DBG ...`
   lines before and after). Each line shows:

   - `trig` = INIT / NEWBAR / TIMER59  (which event ran the math)
   - `prevc` = `prev_calculated`        (0 means a full recalc / history re-sync)
   - `rt` = rates_total                 (grows as history loads)
   - `effLB` / `ssaStart`               (SSA coverage; and whether the fixed-3000
                                          lookback *would* have truncated the window)
   - `win[start..end]`                  (window bar indices)
   - `pcount`                           (crossings gathered inside the window)
   - `raw`                              (clusters from DBSCAN/KMeans)
   - `hulls`                            (clusters with >=3 pts -> centroid_count)
   - `nreg`, `cfl`, `r2`                (regression gate + result)
   - `EXIT`                             (which branch ended the pass)

### What each pattern will tell us
- `pcount` stays high but `raw`/`hulls` drop at the collapse  -> the crossings
  shifted enough to break DBSCAN clustering (confirms the SSA-basis-shift theory).
  Fix: give the windowed clustering its own deterministic, fixed-range crossing
  computation (decoupled from total loaded history), and/or freeze the static
  window result.
- `pcount` itself drops at the collapse                       -> window losing
  crossings after all (coverage/normalisation). Fix targets coverage + an outlier
  affecting normalisation.
- collapse coincides with a specific `trig`/`prevc`           -> tells us the exact
  trigger to guard.

## Note on the SSA-coverage change already in this file
`OnCalculate` was already changed so the SSA region extends back to cover the
window start (`eff_lookback = max(InpSSAWaveLookback, bars-to-window-start + warm-up)`).
It is harmless and the diagnostic reports both `effLB` and what the fixed-3000
start *would* have been, so we can see whether coverage was ever the issue.

## Reverting the diagnostic later
All instrumentation is isolated: the `g_dbg_*` globals, the `DbgRender()` function,
the three `g_dbg_exit/DbgRender()` calls inside `PerformClusteringAndCFL`, and the
`g_dbg_*` assignments in `OnCalculate`. Removing those restores a clean build.
