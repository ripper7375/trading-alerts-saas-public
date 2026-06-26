# Fix Notes — Centroid / Baseline / EDT "show then disappear" bug

**File:** `2EDTWindowedCentroidRegressionBestFit_v4_29.mq5`

## Symptom
On attach, all clusters/centroids, the CFL baseline and both EDT lines draw
correctly for a few seconds, then collapse — leaving a single stray hull
(`ClusterHull_V3_0_0`) and no baseline / EDT lines.

## Why the previous (Gemini) fix did not work
The earlier diagnosis blamed "asynchronous buffer corruption" from calling
`PerformClusteringAndCFL()` inside `OnTimer()` / `OnChartEvent()`, and removed
those calls. That change is fine to keep, but it was **not** the cause: the math
already runs only inside `OnCalculate()`, and the display still collapses.

## Actual root cause — SSA lookback truncates the analysis window
The crossings that feed clustering (`ExtSSACross`) are only computed for bars in
`[ssa_start_idx, rates_total)`; older bars are forced to `EMPTY_VALUE`.

```c
int ssa_start_idx = (rates_total > InpSSAWaveLookback) ? rates_total - InpSSAWaveLookback : 0;
```

The analysis window (`InpStartDateTime .. InpEndDateTime`) is a **fixed
historical range**, and `InpSSAWaveLookback` is fixed at 3000. Sequence of events:

1. On attach, MT5 calls `OnCalculate` with `prev_calculated == 0` and a *limited*
   `rates_total`. The window fits inside the last 3000 bars → all crossings
   exist → many clusters → **full display.**
2. A few seconds later MT5 finishes syncing history and calls `OnCalculate`
   **again with `prev_calculated == 0` and a much larger `rates_total`.** Now
   `ssa_start_idx` jumps forward and the window falls before it → window bars
   become `EMPTY_VALUE`.
3. `PerformClusteringAndCFL` re-runs, deletes the hull/centroid objects and
   clears the line buffers, then finds too few crossings → only ~1 cluster
   survives → it hits the `n_reg < 3` gate and returns. Result: one stray hull,
   no baseline, no EDT.

It is not a rendering bug — the *second* recalculation genuinely produces an
empty result because the window data was truncated out of the SSA region.

## Fixes applied

**Fix 1 — guarantee SSA always covers the window (root cause).**
In `OnCalculate`, the SSA start index is extended so the computed region always
reaches back past the window start (plus SSA warm-up), regardless of how much
history loads:

```c
int win_start_idx = rates_total - 1;
for(int i = 0; i < rates_total; i++)
   if(time[i] >= InpStartDateTime) { win_start_idx = i; break; }
int cover_lookback = (rates_total - win_start_idx) + SSAWindow + 10;
int eff_lookback   = MathMax(InpSSAWaveLookback, cover_lookback);
int ssa_start_idx  = (rates_total > eff_lookback) ? rates_total - eff_lookback : 0;
```

**Fix 2 — don't wipe a good display on a bad pass (defensive).**
In `PerformClusteringAndCFL`, the destructive `ObjectsDeleteAll` /
`ArrayInitialize` calls were moved to run only **after** the window points have
been gathered and `p_count >= InpMinPts` is confirmed. If a pass has too little
data it now returns early **without** clearing the previously drawn objects/lines.

## Note
After history sync the SSA basis spans more bars, so crossing positions (and
therefore the chosen clusters) can shift slightly versus the first limited-history
render. That is expected and more accurate; the lines no longer disappear. If you
need the render to be byte-for-byte identical across reloads, anchor the SSA start
to a fixed index instead of `rates_total - eff_lookback`.
