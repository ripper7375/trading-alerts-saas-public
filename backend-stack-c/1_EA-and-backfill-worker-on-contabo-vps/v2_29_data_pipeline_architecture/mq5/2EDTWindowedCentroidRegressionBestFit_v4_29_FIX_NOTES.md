# Switched to the CENTROID-SPECIFIC approach (root-cause cure)

**File:** `2EDTWindowedCentroidRegressionBestFit_v4_29.mq5`

## Why the date-window approach could not be saved

The diagnostic proved the collapse was *not* missing data: the window had 133
crossings, but DBSCAN merged them into a single cluster (`raw=1`) -> failed the
`n_reg >= 3` gate -> no baseline/EDT. Root reason: the live SSA basis is rebuilt
from all loaded history and analyses the bars ending at the CURRENT bar. A FIXED
historical date band drifts into the stale tail of that rolling SSA as live
history accumulates, so the crossing geometry inside the band keeps shifting until
clustering degenerates. There is no cheap, robust fix for clustering a far-past
fixed date band with a forward-rolling SSA.

## The new approach (matches your AFTER mockup, mirrors the foundation)

Reference: `2EDTCentroidRegressionBestFitNonMostRecent_v2_29.mq5`
(`InpExcludeRecentCentroids` + `InpRegCentroids`).

1. **Cluster the recent `InpSSAWaveLookback` (3000) bars** — fresh, well-conditioned
   SSA, the same data region the SSA is computed on. No date window, no basis drift.
2. **All centroids are found and sorted most-recent-first** and **numbered on chart**
   (#1 = newest), exactly like your AFTER image.
3. **Select a contiguous batch by recency rank**: skip the `InpExcludeRecentCentroids`
   newest, then regress the next `InpRegCentroids`. Defaults `5 / 5` => **centroids
   #6..#10**. The WLS/combinatorial CFL + EDTs are built from that batch only.
4. Baseline is drawn over `InpCFLVisualLookback` (default 500), auto-extended back to
   the oldest selected centroid.

Because the cluster region == the SSA region (recent), the result is deterministic
and stable regardless of how much live history loads. This is the same reason your
foundation indicators are stable.

### New / changed inputs
- `InpRegCentroids = 5`  (was 9) — batch size to regress.
- `InpExcludeRecentCentroids = 5` — skip N newest centroids (max 9). 5 => start at #6.
- `InpShowCentroidNumbers = true`, `InpCentroidNumberColor = clrBlack` — on-chart ranks.
- `InpCFLVisualLookback = 500` — baseline draw length (auto-extended to fit centroids).
- Removed: `InpStartDateTime` / `InpEndDateTime` and all date-window logic
  (and the temporary `RefreshWindowSSA`).

To reproduce the AFTER picture exactly, leave the defaults (exclude 5, regress 5).
To use the 5 most-recent centroids instead, set `InpExcludeRecentCentroids = 0`.

## This build is still INSTRUMENTED — please verify

Compile, attach to XAUUSD M15, read the top-left readout / Experts log. Expected:

```
CLUSTER REGION (recent): bars [..]   crossings(p_count)= ~100+
CLUSTERS: raw= <several>   CENTROIDS found= <~10-18>
SELECTION: exclude newest=5, regress=5  => centroids #6..#10
CFL: found=YES   best_r2= ...
EXIT: OK: drew baseline + EDT + hulls
```

You should see: every centroid numbered, the GreenYellow baseline through the
selected batch, both SpringGreen EDT lines, and the picture **staying** across
INIT / TIMER59 / NEWBAR. Adjust `InpExcludeRecentCentroids` to slide which batch is
used and watch the baseline move accordingly.

## After you confirm
I will ship the clean build: remove all `g_dbg_*` instrumentation + `DbgRender()`,
and restore the `OnTimer`/`OnChartEvent` recompute Gemini removed (the foundation
keeps it; it refreshes the per-minute export even when ticks are sparse).
