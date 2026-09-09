# Calculation Split (MT5 ↔ Python) — PARKED PROJECT

**Status:** PARKED 2026-09-09. Not deployed, not running, not on the VPS.
**Superseded by:** the MQL5-only pipeline — all 87 `market_data` values now come straight from the
13 MQL5 indicators; Python parses, validates, and forwards, and calculates nothing.
**Everything in this folder is intact and revivable.** It is parked because it is not needed today,
not because it was wrong.

---

## 1. The idea

MQL5 indicators compute their values with **admin-fixed, compiled-in parameters**. Changing a
window, a touch count, or a tolerance means editing the `.mq5`, recompiling in MetaEditor, and
redeploying to the terminal. That is fine for a fixed product, and useless for anything
user-configurable.

The split moved the _derived_ layer out of MQL5 and into Python:

| Layer                                             | Owner  | Contents                                                                                                                                                                                      |
| ------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Admin layer** (stable, heavy, not user-tunable) | MQL5   | SSA trend/signal + crossings, fractal maps (`horiz_high_map`/`horiz_low_map`), OHLCV, ZigZag pivot points, the raw z-score candle buffers                                                     |
| **Derived layer** (cheap, configurable)           | Python | Centroid baselines + upper/lower EDTs per variant, fractal flip line + EDTs, single-best resistance/support lines, ZigZag segment metrics, the z-score body direction/size/classification set |

Two payoffs justified it:

1. **User-parameterizable indicators.** The same modules serve the fixed-preset production pipeline
   _and_ an on-demand service answering "what would this line look like with `min_touches=4` and a
   different window?" — without recompiling anything.
2. **Collapsing redundancy.** The seven centroid indicators are not seven algorithms; they are seven
   _parameter presets_ of one algorithm. `centroid_regression.VARIANT_PRESETS` expresses that
   directly — `best_fit_a`/`best_fit_b` differ only in `exclude_recent_centroids` (0 vs 3), exactly
   as `non_a`/`non_b` do. One engine, seven configs, instead of seven near-duplicate 60 KB `.mq5`
   files.

---

## 2. What was actually built (all present in this folder)

| File                              | Role                                                                                                                                                                                                                   |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `centroid_regression.py`          | All seven centroid variants as one parameterized engine (`CentroidRegressionParams`, `VARIANT_PRESETS`). Hand-ported DBSCAN → centroid build → selection → WLS subset search → baseline → symmetric EDTs → statistics. |
| `fractal_lines.py`                | Fractal detection, single-best resistance/support line fitting, flip line + EDTs.                                                                                                                                      |
| `zigzag_metrics.py`               | ZigZag segment metrics (price change, % change + class, bars + class, price/bar + class, slope, HH/HL/LH/LL/EQH/EQL category).                                                                                         |
| `zscore_candle.py`                | Rolling sample z-score, signed body classification, `body_size = \|z\|`.                                                                                                                                               |
| `mql5-to-python-transliteration/` | The certification harness and its evidence — `golden_certification.py`, `CERTIFICATION.md`, `golden_certification_report_M{5,15}.txt`, and the three unit-test phases (94 checks).                                     |
| `Python stacks calculation.txt`   | The original mandate: the authoritative list of values Python was to compute instead of MQL5.                                                                                                                          |

**Porting discipline used throughout (preserve it if reviving):** these are literal
transliterations, not reimplementations. DBSCAN and K-means are hand-rolled rather than taken from
scikit-learn, specifically so cluster membership matches MQL5 exactly — a library substitution with
different tie-breaking silently shifts a centroid and moves the whole regression line.

---

## 3. Verified state at the moment of parking

From `test_phase1_golden.py` / `test_phase2_lines.py` / `test_phase3_centroid.py`: **94/94 passing**
(23 + 30 + 41).

From `golden_certification.py` against the real 3000-bar MQL5 export archive:

| Section                                       | M15            | M5             |
| --------------------------------------------- | -------------- | -------------- |
| Z-score candle set                            | PASS           | PASS           |
| ZigZag metrics (all 9)                        | PASS           | PASS           |
| Fractal flip line + EDTs, resistance, support | PASS           | PASS           |
| **Centroid variants**                         | **cannot run** | **cannot run** |

The non-centroid sections are genuinely certified — reproduced first-hand on 2026-09-09, 20/20
checks per timeframe, max deviation ~5e-6.

### ⚠ Two open bugs — fix these BEFORE trusting any revival

Both found by the 2026-09-09 field-consistency audit (`../FIELD-CONSISTENCY-AUDIT-v2_29.md` §5).

**Bug 1 — `golden_certification.py` cannot run the centroid section at all.**
It builds a `fractals` list from the real captured `{variant}_horiz_high_map` / `_horiz_low_map`
columns and passes `fractals=fractals` into `calculate_variant()`. That parameter has **never
existed** — confirmed across the full git history of both files since their first commit
(2026-06-13). The result is an immediate crash on the first variant:

```
TypeError: CentroidRegressionParams.__init__() got an unexpected keyword argument 'fractals'
```

Consequence: the "M15 50/50 / M5 39/50" figures in `CERTIFICATION.md` and the two report files
**cannot be reproduced by the code in this folder** and must be treated as unverified for the
centroid variants specifically. The z-score / zigzag / lines figures are fine.

**Bug 2 — the production rule in `CERTIFICATION.md` was never actually implemented.**
That document states the centroid EDT stage must use MQL5's _staged_ `horiz_high_map`/`horiz_low_map`
fractals, and that self-detected fractals "were tested and are worse — they break best_fit". But
`centroid_regression.calculate()` unconditionally self-detects fractals from raw OHLCV highs/lows
(`detect_upper_fractals(highs, side) + detect_lower_fractals(lows, side)`), and the collector that
called it never passed anything else. So the shipped behaviour was always the one the certification
document says is wrong.

These two are the same root cause: `calculate()` needs an optional injected-fractals parameter, and
both the harness and the collector need to pass the staged columns into it. That is the **first
task** of any revival.

---

## 4. What parking this costs

Everything MQL5 exports is a **single fixed parameterization**. The pipeline keeps working and every
`market_data` column keeps its value — but these capabilities go away:

1. **Arbitrary-parameter recomputation.** No answering "what would this look like with different
   inputs?" without a MetaEditor recompile and redeploy.
2. **The statistics substrate.** R², MSE, variance ratio, skewness, kurtosis, touch counts, EDT
   containment, line angle. These are computed inside the calc modules and appear in MQL5 only in
   the `_Statistic.txt` companion files — **one resolved line per export, not per bar**. They are
   not in `market_data` and never have been.
3. **Historical/walk-forward re-scoring.** Re-running the math over past sub-windows with different
   configs is impossible when the only values available are what the terminal happened to export at
   the time.

### The concrete downstream dependency

`../../v2_29_davintrade_decision_layer/DAVINTRADE_DECISION_LAYER_BLUEPRINT.md` is built directly on
all three. Its §1 lists the calc stack as the foundation ("a **parameterized** engine — the
prerequisite for dynamic selection"; the statistics buffers as "the **fitness substrate**"), and its
§2/§3/§8 core components — `param_search`, `fitness_scorer`, drift detection — each require
recomputation with arbitrary parameters over arbitrary windows. **That project cannot proceed while
this one is parked**, and a BLOCKED banner has been added to its blueprint pointing here.

---

## 5. How to revive it

The code is intact and the pipeline is deliberately structured so this slots back in.

1. **Fix the fractal-injection gap first** (§3 above). Add an optional `fractals` parameter to
   `centroid_regression.calculate()` / `calculate_variant()`, threaded through to `_edts()`. Then
   `golden_certification.py` runs as written, with no change to the harness.
2. **Re-run certification** against a real MQL5 export batch and record honest numbers. Note that no
   captured export exists for the post-split `best_fit_a`/`best_fit_b` naming — the archive only has
   the pre-split `Centriod_Best_Fit` files — so `best_fit_b` needs a fresh capture before it can be
   certified at all.
3. **Re-point the collector.** `export_collector_validator_v2.py` in the parent folder used to have a
   `calculate_stage()` between VALIDATE and PROMOTE; it now goes straight from VALIDATE to PROMOTE.
   Reviving means reinstating that stage — either instead of the parsed MQL5 columns, or (better)
   alongside them, writing to distinct column names so the two can be compared live.
4. **Decide the coexistence model.** The most useful revival is probably _not_ "Python replaces
   MQL5" but "MQL5 gives the admin-fixed baseline, Python serves user-parameterized variants
   on demand" — the pipeline stores the MQL5 values, and the modules answer ad-hoc queries. That
   gets the Decision Layer unblocked without putting unverified math back on the production path.

### Git history

Nothing was rewritten. `git log --follow` on any file here reaches its full pre-archive history;
the move was done with `git mv`.
