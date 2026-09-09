"""Golden certification — Python calc stack vs full MQL5 3000-bar exports.

Compares every derived value the calc stack computes against the values the
MQL5 indicators exported for the SAME window (mock-data-from-indicators/
golden_certification). Bars are aligned by rounding raw export timestamps to
the timeframe grid (sources differ by capture-seconds).

Usage:
  python3 golden_certification.py ../../mock-data-from-indicators/golden_certification/m5_timeseries  M5 [stat_dir]
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from zscore_candle import calculate as zscore_calculate
from zigzag_metrics import ZigZagPivot, segment_metrics
from fractal_lines import (FractalLinesParams, FractalPoint,
                           single_best_resistance, single_best_support,
                           flip_line_with_edts)
from centroid_regression import calculate_variant

TOL5 = 2e-5      # values printed with 5 decimals
TOL2 = 0.006     # values printed with 2 decimals
TOL4 = 6e-5      # values printed with 4 decimals

RESULTS = []


def report(section, name, n_compared, n_fail, max_diff, detail=''):
    status = 'PASS' if n_fail == 0 and n_compared > 0 else ('SKIP' if n_compared == 0 else 'FAIL')
    RESULTS.append((section, name, status, n_compared, n_fail, max_diff, detail))
    print(f"  [{status}] {section:<12} {name:<28} compared={n_compared:<6} fail={n_fail:<5} "
          f"maxdiff={max_diff:.2e}{('  ' + detail) if detail else ''}")


def load(path, tf_sec):
    """Rows as dicts keyed by header name + ts (grid-rounded)."""
    rows = []
    with open(path, encoding='utf-8') as f:
        headers = f.readline().rstrip('\n\r').split('\t')
        for line in f:
            parts = line.rstrip('\n\r').split('\t')
            if len(parts) < 4 or not parts[0].strip():
                continue
            d = dict(zip(headers, parts))
            d['_ts'] = round(int(parts[0]) / tf_sec) * tf_sec
            rows.append(d)
    return headers, rows


def fnum(v):
    v = (v or '').strip()
    return float(v) if v else None


def cmp_series(section, name, pairs, tol):
    """pairs: list of (mql5_value, python_value); None mql5 values skipped."""
    n = nf = 0
    md = 0.0
    for g, p in pairs:
        if g is None:
            continue
        n += 1
        if p is None:
            nf += 1
            md = max(md, float('inf')) if md != float('inf') else float('inf')
            continue
        d = abs(g - p)
        md = max(md, d)
        if d > tol:
            nf += 1
    report(section, name, n, nf, md if md != float('inf') else 9e9)


def certify(ts_dir: Path, timeframe: str, stat_dir: Path = None):
    tf_sec = {'M5': 300, 'M15': 900}[timeframe]
    sfx = f'XAUUSD_{timeframe}.txt'

    # ---------- OHLCV spine ----------
    _, orows = load(ts_dir / f'OHLCV_{sfx}', tf_sec)
    orows.sort(key=lambda r: r['_ts'])
    ts_list = [r['_ts'] for r in orows]
    idx = {t: i for i, t in enumerate(ts_list)}
    opens = [float(r['ohlcv_open']) for r in orows]
    highs = [float(r['ohlcv_high']) for r in orows]
    lows = [float(r['ohlcv_low']) for r in orows]
    closes = [float(r['ohlcv_close']) for r in orows]
    print(f"\n=== {timeframe}: {len(orows)} OHLCV bars "
          f"({ts_list[0]} .. {ts_list[-1]}) ===")

    # ---------- 1. Z-Score candle ----------
    zres = zscore_calculate(opens, closes)
    _, zrows = load(ts_dir / f'ZScore_{sfx}', tf_sec)
    dir_pairs, size_pairs, cls_pairs = [], [], []
    for r in zrows:
        i = idx.get(r['_ts'])
        if i is None or zres[i].zscore is None:
            continue
        dir_pairs.append((fnum(r['body_direction']), float(zres[i].body_direction)))
        size_pairs.append((fnum(r['body_size']), zres[i].body_size_export))
        cls_pairs.append((fnum(r['body_classification']), float(zres[i].classification)))
    cmp_series('zscore', 'body_direction', dir_pairs, 0)
    cmp_series('zscore', 'body_size (|z|)', size_pairs, TOL5)
    cmp_series('zscore', 'body_classification', cls_pairs, 0)

    # ---------- 2. ZigZag metrics ----------
    _, zzrows = load(ts_dir / f'ZigZag_{sfx}', tf_sec)
    zzrows.sort(key=lambda r: r['_ts'])
    zzrows = [r for r in zzrows if r['_ts'] in idx]   # chart-bar alignment
    pivots = [ZigZagPivot(bar=idx[r['_ts']], price=float(r['CurrentPoint']),
                          is_peak=(r['zigzag_Type'] == 'Peak'), timestamp=r['_ts'])
              for r in reversed(zzrows)]   # newest-first
    n_pv = len(pivots)
    arith = {k: [] for k in ('prchg', 'pct', 'bars', 'prperbar', 'slope')}
    cat_pairs = []
    cls = {k: [] for k in ('pctcls', 'barscls', 'ppbcls')}
    for k, r in enumerate(zzrows):
        i_new = n_pv - 1 - k                       # newest-first index
        if i_new + 2 > n_pv - 1 or k == len(zzrows) - 1:
            continue                               # needs prev+twoPrev; skip live/unconfirmed last row
        m = segment_metrics(pivots, i_new)
        arith['prchg'].append((fnum(r['CurrentPrChg']), m.price_change))
        arith['pct'].append((fnum(r['Current%Chg']), m.pct_change))
        arith['bars'].append((fnum(r['CurrentBars']), float(m.bars)))
        arith['prperbar'].append((fnum(r['CurrentPrPerBar']), m.price_per_bar))
        arith['slope'].append((fnum(r['CurrentSlope']), m.slope))
        cat_pairs.append((r['CurrentCategory'], m.category))
        if i_new + 1 + 50 <= n_pv - 1:             # full 50-segment population in-file
            cls['pctcls'].append((fnum(r['Current%ChgClass']), float(m.pct_change_class)))
            cls['barscls'].append((fnum(r['CurrentBarsClass']), float(m.bars_class)))
            cls['ppbcls'].append((fnum(r['CurrentPrPerBarClass']), float(m.price_per_bar_class)))
    cmp_series('zigzag', 'price_change', arith['prchg'], TOL5)
    cmp_series('zigzag', 'pct_change', arith['pct'], TOL2)
    cmp_series('zigzag', 'bars', arith['bars'], 0)
    cmp_series('zigzag', 'price_per_bar', arith['prperbar'], TOL5)
    cmp_series('zigzag', 'slope', arith['slope'], TOL4)
    nc = sum(1 for g, p in cat_pairs if g != p)
    report('zigzag', 'category', len(cat_pairs), nc, 0.0)
    cmp_series('zigzag', 'pct_change_class', cls['pctcls'], 0)
    cmp_series('zigzag', 'bars_class', cls['barscls'], 0)
    cmp_series('zigzag', 'price_per_bar_class', cls['ppbcls'], 0)

    # ---------- 3. Single best lines + fractal flip line (stat-driven) ----------
    def parse_line_stat(prefix):
        """Read a line indicator's _Statistic.txt: window (UTC ts) + params."""
        if not stat_dir:
            return None
        sf = stat_dir / f'{prefix}_XAUUSD_{timeframe}_Statistic.txt'
        if not sf.exists():
            return None
        d = {}
        for line in sf.read_text(encoding='latin-1').splitlines():
            k, _, v = line.partition(':')
            d[k.strip()] = v.strip()
        return d

    def stat_window(d):
        ws = round(int(d['Window Start TS (UTC)']) / tf_sec) * tf_sec
        we = round(int(d['Window End TS (UTC)']) / tf_sec) * tf_sec
        if ws not in idx or we not in idx:
            return None
        return (idx[ws], idx[we])

    def line_params(d, default_fb, default_mt):
        return FractalLinesParams(
            fractal_bars=int(d.get('Fractal Bars', default_fb)),
            min_touches=int(d.get('Min Touches', default_mt)),
            max_line_angle=float(d.get('Max Line Angle', 3.0)),
            tolerance_type=('atr' if d.get('Tolerance Type') == 'ATR' else 'percent'),
            tolerance_percent=float(d.get('Tolerance Percent', 0.50)),
            tolerance_atr_multiplier=float(d.get('Tolerance ATR Multiplier', 1.0)),
            edt_min_touches=int(d.get('EDT Min Touches', 3)),
            require_both_sides=(d.get('Require Both Sides', 'true') == 'true'))

    # --- Resistance ---
    _, rrows = load(ts_dir / f'Resistance_Line_{sfx}', tf_sec)
    rd = parse_line_stat('Resistance_Line')
    rl = None
    if rd and rd.get('Solution Found') == 'true':
        w = stat_window(rd)
        rl = single_best_resistance(highs, line_params(rd, 13, 2), window=w)
        if rd.get('Raw Slope (b)'):
            cmp_series('lines', 'resistance stat slope', [(float(rd['Raw Slope (b)']), rl.slope if rl else None)], TOL5)
    cmp_series('lines', 'best_resistance',
               [(fnum(r['Best_Resistance']),
                 rl.price_at(idx[r['_ts']]) if rl and r['_ts'] in idx and idx[r['_ts']] >= rl.bar_start else None)
                for r in rrows], TOL5)

    # --- Support ---
    _, srows = load(ts_dir / f'Support_Line_{sfx}', tf_sec)
    sd = parse_line_stat('Support_Line')
    sl = None
    if sd and sd.get('Solution Found') == 'true':
        w = stat_window(sd)
        sl = single_best_support(lows, line_params(sd, 13, 2), window=w)
        if sd.get('Raw Slope (b)'):
            cmp_series('lines', 'support stat slope', [(float(sd['Raw Slope (b)']), sl.slope if sl else None)], TOL5)
    cmp_series('lines', 'best_support',
               [(fnum(r['Best_Support']),
                 sl.price_at(idx[r['_ts']]) if sl and r['_ts'] in idx and idx[r['_ts']] >= sl.bar_start else None)
                for r in srows], TOL5)

    # --- Fractal flip line + EDTs ---
    _, frows = load(ts_dir / f'Fractal_EDT_{sfx}', tf_sec)
    fd = parse_line_stat('Fractal_EDT')
    fl = None
    if fd and fd.get('Solution Found') == 'true':
        w = stat_window(fd)
        fl = flip_line_with_edts(highs, lows, line_params(fd, 35, 3), window=w)
        if fl and fd.get('Raw Slope (b)'):
            cmp_series('lines', 'fractal stat slope', [(float(fd['Raw Slope (b)']), fl.base.slope)], TOL5)
    for col, get in (('Fractal_Best_FL', lambda i: fl.base.price_at(i) if fl else None),
                     ('Fractal_UOEDT', lambda i: fl.uoedt_at(i) if fl else None),
                     ('Fractal_LOEDT', lambda i: fl.loedt_at(i) if fl else None)):
        cmp_series('lines', col,
                   [(fnum(r[col]),
                     get(idx[r['_ts']]) if fl and r['_ts'] in idx and idx[r['_ts']] >= fl.base.bar_start else None)
                    for r in frows], TOL5)

    # ---------- 4. Centroid variants ----------
    # best_fit_a: 2026-09-03 isolated-coexistence split of the former single
    # 'best_fit' indicator. Its engine preset is config-identical to the old
    # best_fit (see centroid_regression.VARIANT_PRESETS), so the certified
    # mock export data — captured before the split, still filed under the
    # legacy 'Centriod_Best_Fit'/'Best_Fit' prefix — remains valid golden
    # evidence for it; the prefix intentionally does not carry an _A suffix.
    # best_fit_b is a NEW preset (exclude_recent_centroids=3) with no
    # captured MT5 export data yet — deliberately NOT added here. Add it
    # once a real 'Centriod_Best_Fit_B' export batch exists.
    variants = {'best_fit_a': ('Centriod_Best_Fit', 'Best_Fit'),
                'cherry_a': ('Cherry-Pick-A', 'Cherry_A'),
                'cherry_b': ('Cherry-Pick-B', 'Cherry_B'),
                'most_recent': ('Most-Recent', 'Most_Recent'),
                'non_a': ('Non-Recent-A', 'Non_A'),
                'non_b': ('Non-Recent-B', 'Non_B')}
    def stat_params(fpref):
        out = {}
        if not stat_dir:
            return out
        sf = stat_dir / f'{fpref}_XAUUSD_{timeframe}_Statistic.txt'
        if not sf.exists():
            return out
        for line in sf.read_text().splitlines():
            k, _, v = line.partition(':')
            k, v = k.strip(), v.strip()
            if k in ('Regression Centroids (Box B)', 'Regression Centroids'):
                out['reg_centroids'] = int(v)
            elif k == 'Excluded Recent Centroids (Box A)':
                out['exclude_recent_centroids'] = int(v)
            elif k == 'Excluded Centroids' and v not in ('None', ''):
                # MQL5 input is HUMAN 1-based; engine uses 0-based chrono indices
                out['excluded_centroids'] = [int(x) - 1 for x in v.split(',') if x.strip()]
            elif k == 'Time-Decay Lambda':
                out['time_decay_lambda'] = float(v)
            elif k == 'Raw Slope (b)':
                out['_slope'] = float(v)
            elif k == 'Anchored Y-Int':
                out['_anchored'] = float(v)
        return out

    for variant, (fpref, col) in variants.items():
        _, vrows = load(ts_dir / f'{fpref}_{sfx}', tf_sec)
        vrows.sort(key=lambda r: r['_ts'])
        vrows = [r for r in vrows if r['_ts'] in idx]
        live_i = idx[vrows[-1]['_ts']]            # this file's own live bar
        sp = stat_params(fpref)
        overrides = {k: v for k, v in sp.items() if not k.startswith('_')}
        crossings, fractals = [], []
        for r in vrows:
            i = idx.get(r['_ts'])
            if i is None:
                continue
            if (r.get(f'{col}_crossing') or '').strip() == '1' and fnum(r[f'{col}_ssa']) is not None:
                crossings.append((i, float(r[f'{col}_ssa'])))
            hm = fnum(r.get(f'{col}_horiz_high_map'))
            lm = fnum(r.get(f'{col}_horiz_low_map'))
            if hm is not None:
                fractals.append(FractalPoint(bar=i, price=hm, is_peak=True))
            if lm is not None:
                fractals.append(FractalPoint(bar=i, price=lm, is_peak=False))
        res = calculate_variant(variant, crossings, closes[:live_i + 1],
                                highs[:live_i + 1], lows[:live_i + 1],
                                fractals=fractals, **overrides)
        for suffix, get in (('Base_FL', lambda i: res.baseline_at(i)),
                            ('UOEDT', lambda i: res.uoedt_at(i)),
                            ('LOEDT', lambda i: res.loedt_at(i))):
            cmp_series(variant, suffix,
                       [(fnum(r[f'{col}_{suffix}']),
                         get(idx[r['_ts']]) if res and r['_ts'] in idx else None)
                        for r in vrows], TOL5)
        if res and '_slope' in sp:
            cmp_series(variant, 'stat slope', [(sp['_slope'], res.slope)], TOL5)
        if res and '_anchored' in sp:
            cmp_series(variant, 'stat anchored Y-int', [(sp['_anchored'], res.intercept_anchored)], TOL5)


if __name__ == '__main__':
    ts_dir = Path(sys.argv[1])
    timeframe = sys.argv[2].upper()
    stat_dir = Path(sys.argv[3]) if len(sys.argv) > 3 else None
    certify(ts_dir, timeframe, stat_dir)
    fails = [r for r in RESULTS if r[2] == 'FAIL']
    print(f"\n==== {timeframe} SUMMARY: {len([r for r in RESULTS if r[2]=='PASS'])} PASS, "
          f"{len(fails)} FAIL, {len([r for r in RESULTS if r[2]=='SKIP'])} SKIP ====")
    sys.exit(1 if fails else 0)
