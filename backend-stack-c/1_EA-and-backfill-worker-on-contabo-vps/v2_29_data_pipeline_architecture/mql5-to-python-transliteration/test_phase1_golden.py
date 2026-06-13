"""Phase-1 parity tests for the MQL5 → Python calculation shift.

Golden tests run the Python ports against the MQL5-produced export files in
mock-data-from-indicators/time_series_data and require agreement at the
export's own printed precision. Fields whose computation window exceeds the
mock files' depth (the z-score classification populations) are covered by
synthetic unit tests of the exact ported formulas instead; full-window golden
verification for those happens against fresh manual exports during cutover.

Run:  python3 test_phase1_golden.py   (or pytest)
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from zigzag_metrics import (ZigZagPivot, ZigZagMetricsParams, segment_metrics,
                            pct_change_class)
from zscore_candle import ZScoreCandleParams, calculate

MOCK_DIR = Path(__file__).resolve().parents[2] / 'mock-data-from-indicators' / 'time_series_data'
PASSED = []
FAILED = []


def check(name, cond, detail=''):
    (PASSED if cond else FAILED).append(name)
    print(f"  {'✅' if cond else '❌'} {name}{(' — ' + detail) if detail and not cond else ''}")


# ============================================================
# GOLDEN: zigzag segment metrics vs ZigZag_XAUUSD_M5.txt
# ============================================================
def test_zigzag_golden():
    print("Golden: zigzag metrics vs MQL5 export")
    rows = []
    with open(MOCK_DIR / 'ZigZag_XAUUSD_M5.txt') as f:
        next(f)
        for line in f:
            p = line.rstrip('\n').split('\t')
            rows.append({'ts': int(p[0]), 'type': p[4], 'point': float(p[5]),
                         'prchg': float(p[6]), 'pct': float(p[7]), 'bars': int(p[9]),
                         'prperbar': float(p[11]), 'slope': float(p[13]), 'cat': p[14]})

    # File is oldest-first; the MQL5 collected-points array is newest-first
    pivots = [ZigZagPivot(bar=r['ts'] // 300, price=r['point'],
                          is_peak=(r['type'] == 'Peak'), timestamp=r['ts'])
              for r in reversed(rows)]

    for k in range(1, len(rows)):           # file row k has prev = row k-1
        idx = len(rows) - 1 - k             # newest-first index of that pivot
        if idx + 2 > len(pivots) - 1:
            # category needs twoPrev: pad with a dummy so arithmetic fields still run
            pivots_padded = pivots + [ZigZagPivot(bar=0, price=pivots[-1].price, is_peak=False)]
        else:
            pivots_padded = pivots
        m = segment_metrics(pivots_padded, idx)
        r = rows[k]
        check(f"row{k} price_change", abs(m.price_change - r['prchg']) < 1e-9)
        check(f"row{k} pct_change", abs(round(m.pct_change, 2) - r['pct']) < 1e-9,
              f"{m.pct_change:.4f} vs {r['pct']}")
        check(f"row{k} bars", m.bars == r['bars'], f"{m.bars} vs {r['bars']}")
        check(f"row{k} price_per_bar", abs(round(m.price_per_bar, 5) - r['prperbar']) < 1e-9,
              f"{m.price_per_bar:.6f} vs {r['prperbar']}")
        check(f"row{k} slope", abs(round(m.slope, 4) - r['slope']) < 1e-9,
              f"{m.slope:.5f} vs {r['slope']}")
        if idx + 2 <= len(pivots) - 1:      # real twoPrev exists in the file
            check(f"row{k} category", m.category == r['cat'], f"{m.category} vs {r['cat']}")


# ============================================================
# GOLDEN: zscore candle body_direction vs ZScore_XAUUSD_M5.txt
# ============================================================
def test_zscore_direction_golden():
    print("Golden: zscore candle body_direction vs MQL5 export")
    with open(MOCK_DIR / 'ZScore_XAUUSD_M5.txt') as f:
        next(f)
        for i, line in enumerate(f):
            p = line.rstrip('\n').split('\t')
            close, open_ = float(p[3]), float(p[4])
            expected_dir = int(p[7])
            got = 1 if close > open_ else (-1 if close < open_ else 0)
            check(f"row{i} body_direction", got == expected_dir)


# ============================================================
# UNIT: zscore candle math on a synthetic series (hand-computed)
# ============================================================
def test_zscore_candle_unit():
    print("Unit: zscore candle rolling sample z-score + classification")
    p = ZScoreCandleParams(zscore_length=4, threshold_z1=1.0, threshold_z2=1.5)
    # body sizes: |c-o| = [1, 1, 1, 5] for the last window; bullish final bar
    opens = [10.0, 10.0, 10.0, 10.0]
    closes = [11.0, 9.0, 11.0, 15.0]
    res = calculate(opens, closes, p)

    # warm-up: first 3 bars have no z-score (window of 4 needs 4 bars)
    check("warm-up None", all(r.zscore is None for r in res[:3]))

    # window [1,1,1,5]: mean=2, sample var=( (1+1+1+25) - 8*2 )/3 = 4, std=2, z=(5-2)/2=1.5
    z = res[3].zscore
    check("z-score value", abs(z - 1.5) < 1e-12, f"got {z}")
    check("export body_size = |z|", abs(res[3].body_size_export - 1.5) < 1e-12)
    check("classification UP_EXTREME(2)", res[3].classification == 2)
    check("direction bullish", res[3].body_direction == 1)

    # same magnitudes but bearish final bar -> DOWN_EXTREME(5)
    res2 = calculate([10.0, 10.0, 10.0, 15.0], [11.0, 9.0, 11.0, 10.0], p)
    check("bearish classification DOWN_EXTREME(5)", res2[3].classification == 5)


# ============================================================
# UNIT: zigzag classification z-score population (hand-computed)
# ============================================================
def test_zigzag_class_unit():
    print("Unit: zigzag pct-change classification population")
    p = ZigZagMetricsParams(zscore_length=50, threshold_z1=1.41, threshold_z2=1.88)
    # newest-first pivots: prices give |%chg| populations of the two trailing
    # segments: 100->110 (10%), 110->99 (10%); current segment 99->118.8 (+20%)
    pts = [ZigZagPivot(bar=30, price=118.8, is_peak=True),
           ZigZagPivot(bar=20, price=99.0, is_peak=False),
           ZigZagPivot(bar=10, price=110.0, is_peak=True),
           ZigZagPivot(bar=0, price=100.0, is_peak=False)]
    cur_pct = (118.8 - 99.0) / 99.0 * 100  # exactly 20%
    # population from index 0: segments (118.8,99)->20%, (99,110)->10%, (110,100)->10%
    # mean=40/3, var=( (400+100+100) - 40*40/3 )/2 = 33.333.., std=5.7735
    # z=(20-13.333)/5.7735 = 1.1547 -> below 1.41 -> bullish normal = 0
    check("pct class normal(0)", pct_change_class(pts, 0, cur_pct, p) == 0)
    # tighter thresholds -> large(1)
    p2 = ZigZagMetricsParams(zscore_length=50, threshold_z1=1.0, threshold_z2=1.88)
    check("pct class large(1) w/ z1=1.0", pct_change_class(pts, 0, cur_pct, p2) == 1)
    # bearish current segment maps to 3/4/5 family
    check("bearish class family", pct_change_class(pts, 0, -cur_pct, p) == 3)


if __name__ == '__main__':
    test_zigzag_golden()
    test_zscore_direction_golden()
    test_zscore_candle_unit()
    test_zigzag_class_unit()
    print(f"\n{len(PASSED)} passed, {len(FAILED)} failed")
    sys.exit(1 if FAILED else 0)
