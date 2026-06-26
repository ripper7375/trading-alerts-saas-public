# Centroid-Specific CFL — PRODUCTION build

**File:** `2EDTWindowedCentroidRegressionBestFit_v4_29.mq5`
**Status:** verified working on XAUUSD M15 (raw=18 clusters, 18 centroids,
selection #6..#10, CFL found, baseline + EDT + hulls drawn and stable).

## What this indicator now does
1. **Clusters the recent `InpSSAWaveLookback` (3000) bars** on a fresh, well-
   conditioned SSA (the proven foundation pattern). No fixed date window, so the
   SSA basis no longer drifts the clustering into collapse.
2. **Finds all centroids, sorts them most-recent-first, and numbers them on chart**
   (#1 = newest), per `InpShowCentroidNumbers` / `InpCentroidNumberColor`.
3. **Selects a contiguous batch by recency rank**: skip `InpExcludeRecentCentroids`
   newest, then take `InpRegCentroids`. Defaults `5 / 5` => centroids **#6..#10**.
4. **Force-fits the baseline to ALL selected centroids** (WLS through the whole
   batch — no best-subset search), then builds the two outermost EDTs around it.
5. Baseline drawn over `InpCFLVisualLookback` (500), auto-extended to the oldest
   selected centroid; optionally extended to the current bar.

## Key inputs
- `InpRegCentroids = 5` — batch size to regress.
- `InpExcludeRecentCentroids = 5` — skip N newest centroids (max 9). 0 = use newest.
- `InpCFLVisualLookback = 500` — baseline draw length (auto-extended to fit the batch).
- `InpShowCentroidNumbers = true`, `InpCentroidNumberColor = clrBlack`.

## Changes from the broken date-window version
- Removed the fixed date window (`InpStartDateTime` / `InpEndDateTime`) and all
  windowing logic — that was the root cause of the collapse (clustering a far-past
  date band with a forward-rolling SSA degenerated DBSCAN to a single cluster).
- Replaced best-subset CFL search with a **force-fit over all selected centroids**.
- Restored the `OnTimer` (per-minute) and `OnChartEvent` (button) recompute that
  the earlier "Gemini fix" wrongly removed — these refresh the math/export even
  when ticks are sparse. (The working foundation indicators do exactly this; it is
  safe — buffers are still only written from inside MT5 event handlers.)
- Removed all temporary diagnostic instrumentation (`g_dbg_*`, `DbgRender`,
  on-chart readout, Experts-log trace).

## Behaviour notes
- `g_stat_centroids` (exported) now equals the number of centroids regressed
  (= the selected batch size), since all selected centroids are used.
- The export filename (`InpExportFileName = "Centriod_Windowed"`) was left
  unchanged for downstream-pipeline compatibility; change it in inputs if desired.
- Centroid rank numbers are anchored on the centroid markers. If you want them
  lifted just above the dots, say so and I'll switch the anchor.
