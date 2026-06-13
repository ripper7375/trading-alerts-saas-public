"""Phase-3 parity tests: centroid_regression.py vs the MQL5 centroid-chain logic.

Mock exports carry empty Base_FL/UOEDT/LOEDT (no qualifying lines in those
windows), so like Phase 2 these are hand-computed synthetic fixtures pinning
every ported rule; full golden verification runs at cutover against fresh
3000-row MQL5 exports.

Run:  python3 test_phase3_centroid.py
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from centroid_regression import (CrossingPoint, CentroidRegressionParams,
                                 _math_round, run_dbscan, calculate,
                                 calculate_variant)

PASSED = []
FAILED = []


def check(name, cond, detail=''):
    (PASSED if cond else FAILED).append(name)
    print(f"  {'✅' if cond else '❌'} {name}{(' — ' + detail) if detail and not cond else ''}")


def make_cluster(bar_start, price, n=5):
    """5 consecutive-bar crossings at one price -> one DBSCAN cluster whose
    centroid lands exactly at (bar_start + 2, price)."""
    return [(bar_start + i, price) for i in range(n)]


def ramp(n, base, step=0.001):
    return [base + i * step for i in range(n)]


# ============================================================
# MathRound: half away from zero
# ============================================================
def test_math_round():
    print("Unit: MQL5 MathRound semantics")
    check("2.5 -> 3", _math_round(2.5) == 3)
    check("-2.5 -> -3", _math_round(-2.5) == -3)
    check("2.4 -> 2", _math_round(2.4) == 2)
    check("3.5 -> 4", _math_round(3.5) == 4)


# ============================================================
# DBSCAN: literal port behavior
# ============================================================
def test_dbscan():
    print("Unit: DBSCAN clusters and noise")
    pts = []
    for i in range(5):       # tight group A
        pts.append(CrossingPoint(bar=i, price=0, norm_x=0.0 + i * 0.002, norm_y=0.1))
    for i in range(5):       # tight group B
        pts.append(CrossingPoint(bar=i, price=0, norm_x=0.5 + i * 0.002, norm_y=0.9))
    pts.append(CrossingPoint(bar=99, price=0, norm_x=0.25, norm_y=0.5))  # isolated noise
    assignments, n_clusters = run_dbscan(pts, eps=0.015, min_pts=5)
    check("two clusters found", n_clusters == 2, str(n_clusters))
    check("group A one cluster", len({assignments[i] for i in range(5)}) == 1)
    check("group B one cluster", len({assignments[i] for i in range(5, 10)}) == 1)
    check("groups distinct", assignments[0] != assignments[5])
    check("noise = -1", assignments[10] == -1)


# ============================================================
# End-to-end: most_recent OLS + window + stats + EDTs
# ============================================================
def test_most_recent_with_edts():
    print("Unit: most_recent OLS, window binding, stats, EDTs")
    n = 600
    closes = [99.0 + 0.01 * i for i in range(n)]            # exactly the expected line
    crossings = (make_cluster(98, 100.0) + make_cluster(298, 102.0)
                 + make_cluster(498, 104.0))                # centroids (100,100),(300,102),(500,104)
    highs = ramp(n, 90)
    lows = ramp(n, 200)
    # EDT geometry: peaks on the +5 parallel, dips on the -5 parallel
    highs[200], highs[400] = 106.0, 108.0                    # line+5 at bars 200/400
    lows[250], lows[450] = 96.5, 98.5                        # line-5 at bars 250/450

    p = CentroidRegressionParams(selection='most_recent', regression='ols',
                                 reg_centroids=3, edt_min_touches=2)
    r = calculate(crossings, closes, highs, lows, p)
    check("result found", r is not None)
    if r:
        check("slope 0.01", abs(r.slope - 0.01) < 1e-9, f"{r.slope}")
        check("intercept 99", abs(r.intercept - 99.0) < 1e-9, f"{r.intercept}")
        check("window [98, 502]", (r.leftmost, r.rightmost) == (98, 502),
              f"{(r.leftmost, r.rightmost)}")
        check("anchored intercept 104.99", abs(r.intercept_anchored - 104.99) < 1e-9)
        check("centroid prices newest-first", r.centroid_prices[:3] == [104.0, 102.0, 100.0],
              str(r.centroid_prices[:3]))
        check("r2_cross ~ 1", r.r2_cross > 0.99, f"{r.r2_cross}")
        check("r2_close ~ 1 (closes on the line)", r.r2_close > 0.999, f"{r.r2_close}")
        expected_angle = math.atan((0.01 / (sum(closes[98:503]) / 405)) * 100.0 * 100.0) * 180 / math.pi
        check("angle formula", abs(r.angle - expected_angle) < 1e-9, f"{r.angle}")
        check("UOEDT intercept 104 (base+5)", r.uoedt_intercept is not None
              and abs(r.uoedt_intercept - 104.0) < 1e-9, str(r.uoedt_intercept))
        check("LOEDT intercept 94 (base-5)", r.loedt_intercept is not None
              and abs(r.loedt_intercept - 94.0) < 1e-9, str(r.loedt_intercept))
        check("baseline_at(300) = 102", abs(r.baseline_at(300) - 102.0) < 1e-9)

    # no fractals -> no EDTs
    r2 = calculate(crossings, closes, ramp(n, 90), ramp(n, 200), p)
    check("no fractals -> EDTs None", r2 is not None and r2.uoedt_intercept is None
          and r2.loedt_intercept is None)


# ============================================================
# exclude_recent (Non-B style): newest centroid skipped
# ============================================================
def test_exclude_recent():
    print("Unit: exclude_recent skips the newest centroid")
    n = 800
    closes = [99.0 + 0.01 * i for i in range(n)]
    crossings = (make_cluster(98, 100.0) + make_cluster(298, 102.0)
                 + make_cluster(498, 104.0) + make_cluster(698, 120.0))  # newest off-line
    p = CentroidRegressionParams(selection='exclude_recent', regression='ols',
                                 reg_centroids=3, exclude_recent_centroids=1)
    r = calculate(crossings, closes, ramp(n, 90), ramp(n, 200), p)
    check("result found", r is not None)
    if r:
        check("outlier excluded: slope 0.01", abs(r.slope - 0.01) < 1e-9, f"{r.slope}")
        check("window excludes newest cluster", (r.leftmost, r.rightmost) == (98, 502),
              f"{(r.leftmost, r.rightmost)}")
        check("export slots = used centroids (newest-first after exclusion)",
              r.centroid_prices[:3] == [104.0, 102.0, 100.0], str(r.centroid_prices[:3]))


# ============================================================
# cherry_pick: explicit chrono-index exclusion
# ============================================================
def test_cherry_pick():
    print("Unit: cherry_pick skips excluded chrono index")
    n = 800
    closes = [99.0 + 0.01 * i for i in range(n)]
    # chrono idx: 0=(700,106 on-line), 1=(500,150 OUTLIER), 2=(300,102), 3=(100,100)
    crossings = (make_cluster(98, 100.0) + make_cluster(298, 102.0)
                 + make_cluster(498, 150.0) + make_cluster(698, 106.0))
    p = CentroidRegressionParams(selection='cherry_pick', regression='ols',
                                 reg_centroids=3, excluded_centroids=[1])
    r = calculate(crossings, closes, ramp(n, 90), ramp(n, 200), p)
    check("result found", r is not None)
    if r:
        check("slope 0.01 (outlier index skipped)", abs(r.slope - 0.01) < 1e-9, f"{r.slope}")
        check("excluded slot stays 0.0 in export feed", r.centroid_prices[1] == 0.0,
              str(r.centroid_prices[:4]))
        check("window spans used clusters [98, 702]", (r.leftmost, r.rightmost) == (98, 702),
              f"{(r.leftmost, r.rightmost)}")


# ============================================================
# best_fit_wls: subset search rejects the outlier centroid
# ============================================================
def test_best_fit_wls():
    print("Unit: best_fit_wls subset search (lambda=0 -> OLS per subset)")
    n = 800
    closes = [99.0 + 0.01 * i for i in range(n)]
    crossings = (make_cluster(98, 100.0) + make_cluster(298, 102.0)
                 + make_cluster(498, 104.0) + make_cluster(698, 130.0))  # outlier newest
    p = CentroidRegressionParams(selection='exclude_recent', regression='best_fit_wls',
                                 reg_centroids=4, exclude_recent_centroids=0,
                                 time_decay_lambda=0.0)
    r = calculate(crossings, closes, ramp(n, 90), ramp(n, 200), p)
    check("result found", r is not None)
    if r:
        check("best subset = 3 collinear centroids", r.centroids_used == 3, str(r.centroids_used))
        check("slope 0.01", abs(r.slope - 0.01) < 1e-9, f"{r.slope}")
        check("window from winning subset [98, 502]", (r.leftmost, r.rightmost) == (98, 502),
              f"{(r.leftmost, r.rightmost)}")


# ============================================================
# Variant presets
# ============================================================
def test_variant_presets():
    print("Unit: variant preset entry point")
    n = 800
    closes = [99.0 + 0.01 * i for i in range(n)]
    crossings = (make_cluster(98, 100.0) + make_cluster(198, 101.0) + make_cluster(298, 102.0)
                 + make_cluster(398, 103.0) + make_cluster(498, 104.0) + make_cluster(598, 105.0)
                 + make_cluster(698, 106.0))
    for v in ('best_fit', 'cherry_a', 'cherry_b', 'most_recent', 'non_a', 'non_b'):
        r = calculate_variant(v, crossings, closes, ramp(n, 90), ramp(n, 200))
        check(f"{v}: runs and finds the collinear line",
              r is not None and abs(r.slope - 0.01) < 1e-9,
              f"{None if r is None else r.slope}")


if __name__ == '__main__':
    test_math_round()
    test_dbscan()
    test_most_recent_with_edts()
    test_exclude_recent()
    test_cherry_pick()
    test_best_fit_wls()
    test_variant_presets()
    print(f"\n{len(PASSED)} passed, {len(FAILED)} failed")
    sys.exit(1 if FAILED else 0)
