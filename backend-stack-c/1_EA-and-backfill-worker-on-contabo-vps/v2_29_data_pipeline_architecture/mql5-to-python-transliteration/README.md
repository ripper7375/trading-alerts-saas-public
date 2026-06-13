# Python Calculation Stack — MQL5 → Python calculation shift

Moves the **user-configurable** calculation layer out of MQL5 into Python.
MQL5 keeps the admin layer (configured by the system admin in the MT5
terminal): OHLCV, fractal high/low maps, SSA / ema_ssa / crossings, zigzag
pivot detection. Python computes everything derived from those inputs, with
parameters end users can configure (window dates, centroid in/exclusion, min
EDT touches, tolerances, z-score thresholds, …). This is what enables both
the on-demand service and the user-configurable service, and collapses the
6 centroid-variant indicators into one parameterized engine.

**Porting rules (see blueprint §12.8):**

1. Literal transliteration of the MQL5 loops — no library substitution
   (sklearn KMeans/DBSCAN have different init/ordering ⇒ different clusters).
2. Sample variance (n−1) everywhere, matching the MQL5 sources.
3. `EMPTY_VALUE` ⇒ `None`; warm-up bars produce `None`, never 0.
4. Every module ships with golden tests against MQL5-produced exports
   (mock files now; fresh full-window manual exports at cutover) plus
   hand-computed unit tests for windows deeper than the fixtures.

## Phases

| Phase | Module                                                                                                                                                                                                                                                                                      | Source indicator                                                      | Status                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------- |
| 1     | `zscore_candle.py` — body direction/size, rolling z-score, classification                                                                                                                                                                                                                   | `zscore-ohlc-candle-export.mq5`                                       | ✅ ported, tests pass |
| 1     | `zigzag_metrics.py` — segment PrChg/%Chg/bars/PrPerBar/slope/category + 3 z-score classifications                                                                                                                                                                                           | `ZigZag-Export-v43.mq5` (metric layer; pivot detection stays in MQL5) | ✅ ported, tests pass |
| 2     | `fractal_lines.py` — fractal detection, single best resistance/support lines, fractal flip line + symmetrical EDTs                                                                                                                                                                          | `Single-Best-*-Line-v3.mq5`, `2EDT-Fractal-Best-Fit-v5.mq5`           | ✅ ported, tests pass |
| 3     | `centroid_regression.py` — ONE engine: crossings → normalize → DBSCAN/K-means → centroids → selection (most-recent / exclude-recent / cherry-pick) → OLS or time-decay-WLS subset search → baseline + EDTs + statistics buffers. The six MQL5 variants are `VARIANT_PRESETS` of this engine | `2EDT-Centroid-Regression-*.mq5` (all six)                            | ✅ ported, tests pass |

## Certification status

**CERTIFIED** against full 3000-bar MQL5 exports (see `CERTIFICATION.md`):
M15 50/50 exact; M5 39/50 exact with one documented, accepted bounded
tolerance (most_recent/non_a upper-EDT reconstruction edge + cherry_a/non_b
DBSCAN-boundary ~0.1px). Port verdict: faithful.

## Tests

```
python3 test_phase1_golden.py      # 23 checks: golden vs mock exports + hand-computed units
python3 test_phase2_lines.py       # 30 checks: hand-computed geometric fixtures
python3 test_phase3_centroid.py    # 40 checks: MathRound/DBSCAN units + end-to-end
                                   #   fixtures per variant path (OLS, exclusions,
                                   #   cherry-pick, WLS subset search, EDTs, stats)
```

Mock export line columns are empty for Phases 2-3, so their full golden
verification runs at cutover against fresh 3000-row manual MQL5 exports over
windows with active lines (procedure: export → feed the same raw inputs to
Python → field-by-field compare within 1e-5).

Note: the exported `body_size` column of the z-score indicator contains
`|z-score|`, not the raw body size — the port preserves this.
