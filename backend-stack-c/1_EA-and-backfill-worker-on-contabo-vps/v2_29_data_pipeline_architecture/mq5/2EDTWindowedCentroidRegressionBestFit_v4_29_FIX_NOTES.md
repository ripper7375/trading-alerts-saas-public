# Centroid / Baseline / EDT "show then disappear" — ROOT CAUSE FOUND + FIX

**File:** `2EDTWindowedCentroidRegressionBestFit_v4_29.mq5`

## Confirmed root cause (from the diagnostic run)

Diagnostic readout at the collapse (XAUUSD M15):

```
rates_total=100001   ssa_start=97001   (fixed-3000 start)
WINDOW: start_idx=97256  end_idx=98533   | start<ssa_start? no
POINTS in window (p_count)=133   (MinPts=5)
CLUSTERS: raw=1  with_hull(centroid_count)=1  n_reg=1
EXIT: RETURN: n_reg < 3 (only drew hulls, no baseline/EDT)
```

So:
- The window is fully covered and has **133 crossings** — data is fine (this is why
  the black crossing dots stay visible). Truncation/coverage was NOT the cause.
- **DBSCAN collapses all 133 window crossings into a single cluster** (`raw=1`),
  which fails the `n_reg >= 3` gate, so no baseline/EDT and one stray hull. That is
  exactly the broken screenshot.

### Why it happens
The live SSA analyses the last `InpSSAWaveLookback` (3000) bars **ending at the
current bar**, and its basis is rebuilt from whatever history is loaded. With
`rates_total=100001` the fixed historical window sits ~1,467–2,745 bars away from
the live edge and only ~255 bars from the old edge of the rolling SSA range. As you
accumulate live history, the SSA basis drifts and the crossing geometry **inside
the fixed window** shifts until the points chain into one DBSCAN blob. The good
multi-cluster display you saw was when the live edge was still near the window end
(just after June 4); it degraded as history piled up.

The foundation indicators
(`2EDTCentroidRegressionBestFitNonMostRecent_v2_29`, `2EDTFractalBestFitv5_v2_29`)
never hit this because they cluster the **recent** 3000 bars — their clustered
region and their SSA region are the same fresh data.

## The fix — window-anchored SSA

New function `RefreshWindowSSA()` runs a **separate SSA over a FIXED range that ENDS
at the window's last bar** (not at the current bar). The window therefore always
sits in the reliable/recent part of *that* decomposition, and the basis is
determined solely by data up to the window end — so the crossings inside the window
are **deterministic and stable no matter how much live history is loaded**. It
overwrites trend/signal/cross only inside the window (the lead-in is computed
locally so the EMA signal is seeded correctly entering the window). It is called in
`OnCalculate` immediately before `PerformClusteringAndCFL`, so clustering reads the
stabilized crossings.

This both (a) makes the result permanent/stable and (b) reproduces the basis from
"data ending at the window" — i.e. the good multi-cluster state you originally saw.

The earlier defensive change (don't wipe a good display on a pass with too few
points) and the SSA-coverage guard remain in place; they are harmless.

## This build is still INSTRUMENTED — please verify

Compile, attach to the same XAUUSD M15 chart, and read the top-left readout / the
Experts log. **Expected after the fix:**

- `POINTS in window (p_count)` still healthy (~100+),
- `CLUSTERS: raw=` **now > 1** (several), `with_hull` >= 3, `n_reg >= 3`,
- `CFL: found=YES`,
- `EXIT: OK: drew baseline + EDT + hulls`,
- baseline (GreenYellow) + both EDT lines (SpringGreen) + multiple centroids visible
  and **staying** put across `INIT` / `TIMER59` / `NEWBAR` passes.

If `raw` is still `1`, send me the new readout — that would mean the window basis is
genuinely single-cluster for this data and we tune clustering (e.g. cluster on price
levels / adjust epsilon) instead.

## After you confirm
I will ship a clean build: remove all `g_dbg_*` instrumentation and `DbgRender()`,
and restore the `OnTimer`/`OnChartEvent` recompute that Gemini wrongly removed (the
foundation indicators keep it; it refreshes your per-minute export even when ticks
are sparse).
