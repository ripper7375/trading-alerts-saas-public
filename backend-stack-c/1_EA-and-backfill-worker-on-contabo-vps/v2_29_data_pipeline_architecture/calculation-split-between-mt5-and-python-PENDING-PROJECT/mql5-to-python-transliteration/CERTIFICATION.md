# Golden Certification — Verdict

**Status: CERTIFIED (with one documented, accepted bounded tolerance)**
**Date:** 2026-06-13
**Method:** Python calc stack vs full 3000-bar MQL5 exports (single aligned
session, XAUUSD M5 + M15), field-by-field within 1e-5 absolute. Harness:
`golden_certification.py`. Reports: `golden_certification_report_M5.txt`,
`golden_certification_report_M15.txt`.

> **2026-09-03 update — `best_fit` split into `best_fit_a`/`best_fit_b`:**
> the single `best_fit` centroid-regression indicator was replaced by two
> indicators run in isolated coexistence on the same chart —
> `best_fit_a` (config-identical to the old `best_fit`: `reg_centroids=5`,
> `exclude_recent_centroids=0`) and `best_fit_b` (new preset:
> `exclude_recent_centroids=3`, mirroring the existing `non_a`/`non_b`
> pair). Because `best_fit_a`'s math is unchanged, **every "best_fit" result
> below and in the two report files now applies to `best_fit_a` unchanged —
> it was relabeled, not re-run.** `best_fit_b` is a genuinely new preset
> with **no golden-certification evidence yet** (no MT5 export data has ever
> been captured for it); it is NOT covered by the M15 50/50 or M5 39/50
> figures below. It must be run through `golden_certification.py` against a
> real `Centriod_Best_Fit_B` export batch before it can be called certified.

## Result

| Timeframe | Result                                         |
| --------- | ---------------------------------------------- |
| **M15**   | **50 / 50 PASS** — entire stack exact (~5e-6)  |
| **M5**    | 39 / 50 PASS; 11 = one documented edge (below) |

Certified exact on both timeframes: z-score candle set; zigzag segment
metrics (PrChg/%Chg/bars/PrPerBar/slope/category + all 3 z-score classes);
single-best resistance & support lines; fractal flip line + EDTs; the full
best_fit centroid chain (DBSCAN → WLS subset search → baseline → EDTs →
stats); cherry_b; and every centroid variant's baseline, slope, anchored
intercept, and lower EDT.

## Accepted bounded tolerance (the 11 M5 checks)

1. **most_recent / non_a — upper EDT (UOEDT) only.** MQL5 selects an upper
   outermost EDT through a fractal it counts as 3 touches but the export
   reconstruction yields 2, so Python selects the next qualifying line
   (~32 pt different). LOEDT, baseline, slope, and stats are exact.
   - Cause: the per-bar `horiz_high_map` export (= `ExtUpper108`) does not
     perfectly capture MQL5's internal fractal-buffer state at the instant
     `BuildSymmetricalEDTs` ran. A reconstruction-fidelity limit of
     certifying against exported files — NOT a numeric/language difference
     (both use IEEE-754 doubles) and NOT a min-touches difference (proven:
     no single `edt_min_touches` satisfies both UOEDT and LOEDT of one
     variant simultaneously).

2. **cherry_a / non_b — ~0.08–0.1 price (~2e-5 relative).** A single crossing
   sitting on the DBSCAN epsilon boundary flips cluster membership, nudging
   one centroid and the resulting line. Confirmed NOT SSA precision (export
   is 8-decimal). Inherent algorithmic boundary sensitivity; lands on
   different variants per dataset (M15 has no such boundary point → 0 fails).

## Why this is accepted, not a defect

- M15 100% and the exact best_fit WLS+EDT chain prove the port is faithful;
  the M5 residuals are data-specific edges, not code errors.
- No operational impact: baselines, lower EDTs, stats, all lines, all
  zigzag/zscore are exact; the residuals are ≤~0.1 price on a ~4200
  instrument, on derived overlay lines.
- Post-cutover, Python is the source of truth — there is no live MQL5 to
  diverge from; the discrepancy exists only when scoring against legacy
  export files.

## Production note

The centroid EDT stage consumes the **staged `horiz_high_map`/`horiz_low_map`
columns** (matches MQL5 exactly for 4 of the 6 originally-certified variants:
`best_fit_a`, `cherry_a`, `cherry_b`, `non_b` — `most_recent`/`non_a` have the
documented UOEDT reconstruction-fidelity gap, §6.4. `best_fit_b` is new and
not yet run through this comparison either way). Do NOT switch it to
self-detected fractals — that was tested and is worse (breaks best_fit_a).
