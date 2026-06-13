"""Phase-2 parity tests: fractal_lines.py vs the MQL5 line-fitting logic.

The mock export files for Resistance/Support/Fractal-EDT contain only empty
line values (no qualifying lines in those windows), so golden-vs-mock is not
possible for Phase 2. These tests use synthetic geometric fixtures with
hand-computed expectations covering every ported rule: fractal tie-asymmetry,
10-bar pair distance, normalized-slope angle filter, touch tolerance (percent
and ATR), scoring, flip requirement, EDT selection, and window filtering.
Full golden verification happens against fresh manual MQL5 exports (window
with active lines) at cutover.

Run:  python3 test_phase2_lines.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from fractal_lines import (FractalLinesParams, detect_upper_fractals,
                           detect_lower_fractals, single_best_resistance,
                           single_best_support, flip_line_with_edts)

PASSED = []
FAILED = []


def check(name, cond, detail=''):
    (PASSED if cond else FAILED).append(name)
    print(f"  {'✅' if cond else '❌'} {name}{(' — ' + detail) if detail and not cond else ''}")


def ramp(n, base, step=0.001):
    """Monotonic ramp: produces no accidental upper/lower fractals."""
    return [base + i * step for i in range(n)]


def with_points(series, points):
    s = list(series)
    for bar, price in points.items():
        s[bar] = price
    return s


# ============================================================
# Fractal detection: asymmetric tie rules
# ============================================================
def test_fractal_tie_rules():
    print("Unit: fractal tie asymmetry (older-side tie ok, newer-side tie rejects)")
    # center bar 3 with side_bars=2; chrono: idx-i older, idx+i newer
    highs_tie_older = [100, 105, 101, 105, 102, 101, 100]   # tie at idx 1 (older side)
    highs_tie_newer = [100, 101, 102, 105, 101, 105, 100]   # tie at idx 5 (newer side)
    f1 = [f.bar for f in detect_upper_fractals(highs_tie_older, 2)]
    f2 = [f.bar for f in detect_upper_fractals(highs_tie_newer, 2)]
    check("upper: older tie still fractal", 3 in f1, str(f1))
    check("upper: newer tie rejected", 3 not in f2, str(f2))

    lows_tie_older = [100, 95, 99, 95, 98, 99, 100]
    lows_tie_newer = [100, 99, 98, 95, 99, 95, 100]
    g1 = [f.bar for f in detect_lower_fractals(lows_tie_older, 2)]
    g2 = [f.bar for f in detect_lower_fractals(lows_tie_newer, 2)]
    check("lower: older tie still fractal", 3 in g1, str(g1))
    check("lower: newer tie rejected", 3 not in g2, str(g2))


# ============================================================
# Single best resistance: 3 collinear peaks
# ============================================================
def test_resistance():
    print("Unit: single best resistance (collinear peaks, hand-computed)")
    p = FractalLinesParams(fractal_bars=5, min_touches=2, max_line_angle=10.0)
    highs = with_points(ramp(50, 90), {10: 105.0, 25: 106.5, 40: 108.0})  # slope 0.1
    line = single_best_resistance(highs, p)
    check("line found", line is not None)
    if line:
        check("slope 0.1", abs(line.slope - 0.1) < 1e-12, f"{line.slope}")
        check("intercept 104", abs(line.intercept - 104.0) < 1e-12, f"{line.intercept}")
        check("touches 3", line.touches == 3, str(line.touches))
        check("score 30030 (3 touches, dist 30)", abs(line.score - 30030.0) < 1e-9)
        check("bar_start 10", line.bar_start == 10)
        check("price_at(45) extension", abs(line.price_at(45) - 108.5) < 1e-12)

    # window excluding bar 40: only the (10, 25) pair remains
    line_w = single_best_resistance(highs, p, window=(0, 30))
    check("window: touches 2", line_w is not None and line_w.touches == 2)
    check("window: score 20015", line_w is not None and abs(line_w.score - 20015.0) < 1e-9)


# ============================================================
# Single best support: 3 collinear dips
# ============================================================
def test_support():
    print("Unit: single best support (collinear dips, hand-computed)")
    p = FractalLinesParams(fractal_bars=5, min_touches=2, max_line_angle=10.0)
    lows = with_points(ramp(50, 110), {10: 95.0, 25: 94.0, 40: 93.0})  # slope -1/15
    line = single_best_support(lows, p)
    check("line found", line is not None)
    if line:
        expected_slope = (93.0 - 95.0) / 30.0
        check("slope -1/15", abs(line.slope - expected_slope) < 1e-12, f"{line.slope}")
        check("intercept", abs(line.intercept - (95.0 - expected_slope * 10)) < 1e-12)
        check("touches 3", line.touches == 3, str(line.touches))


# ============================================================
# Flip line + EDTs (flat geometry, hand-computed)
# ============================================================
def test_flip_line_edts():
    print("Unit: flip line + symmetrical EDTs")
    p = FractalLinesParams(fractal_bars=5, min_touches=3, max_line_angle=10.0,
                           edt_min_touches=2, require_both_sides=True)
    # peaks at 105 (bars 10, 40) and 108 (bars 25, 52); bottoms at 105 (25) and 102 (18, 47)
    highs = with_points(ramp(60, 90), {10: 105.0, 40: 105.0, 25: 108.0, 52: 108.0})
    lows = with_points(ramp(60, 109), {25: 105.0, 18: 102.0, 47: 102.0})
    res = flip_line_with_edts(highs, lows, p)
    check("flip line found", res is not None)
    if res:
        check("base slope 0", abs(res.base.slope) < 1e-12, f"{res.base.slope}")
        check("base intercept 105", abs(res.base.intercept - 105.0) < 1e-12)
        check("base touches 3 (2 peaks + 1 bottom)", res.base.touches == 3, str(res.base.touches))
        check("UOEDT 108", res.uoedt_intercept is not None and abs(res.uoedt_intercept - 108.0) < 1e-12)
        check("LOEDT 102", res.loedt_intercept is not None and abs(res.loedt_intercept - 102.0) < 1e-12)
        check("uoedt_at(30)", abs(res.uoedt_at(30) - 108.0) < 1e-12)

    # remove the flip touch (bottom at 25): no 3-touch line remains -> None
    lows_no_flip = with_points(ramp(60, 109), {18: 102.0, 47: 102.0})
    res2 = flip_line_with_edts(highs, lows_no_flip, p)
    check("no flip touch -> None", res2 is None)


# ============================================================
# Tolerance modes: percent vs ATR
# ============================================================
def test_tolerance_modes():
    print("Unit: tolerance percent vs ATR")
    highs = with_points(ramp(50, 90), {10: 100.0, 25: 103.0, 40: 101.0})
    p_pct = FractalLinesParams(fractal_bars=5, min_touches=2, max_line_angle=10.0,
                               tolerance_type='percent', tolerance_percent=0.50)
    p_atr = FractalLinesParams(fractal_bars=5, min_touches=2, max_line_angle=10.0,
                               tolerance_type='atr', tolerance_atr_multiplier=1.0)
    line_pct = single_best_resistance(highs, p_pct)
    line_atr = single_best_resistance(highs, p_atr, atr=5.0)
    # (10,100)-(40,101): expected at 25 = 100.375; |103 - 100.375| = 2.625
    check("percent mode: mid point NOT a touch", line_pct is not None and line_pct.touches == 2,
          str(line_pct.touches if line_pct else None))
    check("ATR mode (5.0): mid point IS a touch", line_atr is not None and line_atr.touches == 3,
          str(line_atr.touches if line_atr else None))
    check("both pick the (10,40) pair", line_pct.bar_start == 10 and line_atr.bar_start == 10)


# ============================================================
# Angle filter
# ============================================================
def test_angle_filter():
    print("Unit: normalized-slope angle filter")
    # steep collinear peaks: %chg/dist = ((120-100)/110*100)/15 = 1.21 -> rejected at 3 deg
    highs = with_points(ramp(40, 90), {10: 100.0, 25: 120.0})
    p3 = FractalLinesParams(fractal_bars=5, min_touches=2, max_line_angle=3.0)
    p0 = FractalLinesParams(fractal_bars=5, min_touches=2, max_line_angle=0.0)  # 0 disables
    check("steep line rejected at 3°", single_best_resistance(highs, p3) is None)
    check("filter disabled (angle=0) accepts", single_best_resistance(highs, p0) is not None)


if __name__ == '__main__':
    test_fractal_tie_rules()
    test_resistance()
    test_support()
    test_flip_line_edts()
    test_tolerance_modes()
    test_angle_filter()
    print(f"\n{len(PASSED)} passed, {len(FAILED)} failed")
    sys.exit(1 if FAILED else 0)
