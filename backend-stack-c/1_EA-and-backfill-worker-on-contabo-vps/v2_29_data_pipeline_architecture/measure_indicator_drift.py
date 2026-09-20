#!/usr/bin/env python3
"""Measure look-ahead drift between two dated captures of the MQL5 exports.

This is the experiment `HISTORICAL-VALUES-LOOK-AHEAD-BIAS-OPEN-ISSUE.md` section 6
asks for and that had never been run. It answers one question with real data
rather than reasoning:

    for a bar present in BOTH captures, how far did each of its values move
    between them?

The mechanism (section 1 of that document) is certain -- a bar stays inside the
indicator's sliding `InpSSAMathLookback = 3000` window and is refitted on every
cycle until it scrolls out. What was unknown is the MAGNITUDE, and the magnitude
is what decides whether section 7 needs building at all.

USAGE
    python measure_indicator_drift.py OLD_DIR NEW_DIR [--json OUT.json]
    python measure_indicator_drift.py OLD_DIR NEW_DIR --file Non-Recent-B_XAUUSD_M15.txt

Both directories hold `MQL5/Files/*.txt` exports captured at different times.
Only files present in both are compared; only timestamps present in both are
compared.

TWO THINGS THIS HANDLES THAT A NAIVE DIFF DOES NOT

1. Timestamp phase. Captures taken before the 2026-09-09 `TimeCurrent()` fix
   carry a constant sub-bar offset (blueprint section 7.1). Timestamps are
   therefore SNAPPED to the bar grid before matching, exactly as the collector's
   own defensive snap does. Without this the overlap is zero and the script
   would report "no drift" for entirely the wrong reason.

2. Bar age. Section 6 predicts drift is LARGEST for bars near the old edge of
   the window -- those have had the most refits behind them. The report bins by
   age so that prediction is tested rather than assumed. If drift were uniform
   across ages, the sliding-window explanation would be wrong.

SCALE. Absolute USD is not on its own interpretable. Where a file carries both
an upper and a lower EDT band the report also expresses drift as a percentage of
the median channel width, which is the comparison section 6 names ("a fraction
of a tick" vs "a meaningful fraction of the EDT channel width").
"""

from __future__ import annotations

import argparse
import json
import math
import statistics
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Columns that are facts about the bar, not fitted values. They must be
# IDENTICAL across captures; movement here means the two captures are not of the
# same series (different symbol, a broker history revision, or a bad grid snap)
# and would invalidate every other number in the report. Matched on the
# unprefixed suffix because each source prefixes its own columns.
CONTROL_SUFFIXES = ('close', 'open', 'high', 'low', 'volume')

# Suffix pair used to express drift as a percentage of channel width.
CHANNEL_PAIRS = (('UOEDT', 'LOEDT'), ('uoedt', 'loedt'))

AGE_BINS = (
    ('oldest25', 0.00, 0.25),
    ('mid25-50', 0.25, 0.50),
    ('mid50-75', 0.50, 0.75),
    ('newest25', 0.75, 1.01),
)


def timeframe_seconds(filename: str) -> Optional[int]:
    """Bar length in seconds, read off the `_M5` / `_M15` in the filename."""
    stem = Path(filename).stem
    for token in reversed(stem.split('_')):
        if len(token) > 1 and token[0] == 'M' and token[1:].isdigit():
            return int(token[1:]) * 60
        if len(token) > 1 and token[0] == 'H' and token[1:].isdigit():
            return int(token[1:]) * 3600
    return None


def load_export(path: Path, tf_seconds: int) -> Tuple[List[str], Dict[int, List[str]]]:
    """Parse one TSV export into (header, {snapped_timestamp: row}).

    Deliberately tolerant: these files are written FILE_ANSI, carry CRLF, and a
    ragged trailing field is normal. A duplicate timestamp after snapping keeps
    the LAST occurrence, matching the collector's own INSERT OR REPLACE.
    """
    rows: Dict[int, List[str]] = {}
    with path.open(encoding='latin-1') as fh:
        header = fh.readline().rstrip('\r\n').split('\t')
        for line in fh:
            parts = line.rstrip('\r\n').split('\t')
            if not parts or not parts[0].strip():
                continue
            try:
                raw_ts = int(parts[0])
            except ValueError:
                continue
            snapped = int(round(raw_ts / tf_seconds)) * tf_seconds
            if len(parts) < len(header):
                parts = parts + [''] * (len(header) - len(parts))
            rows[snapped] = parts
    return header, rows


def as_float(value: str) -> Optional[float]:
    value = value.strip()
    if not value:
        return None
    try:
        f = float(value)
    except ValueError:
        return None
    return None if math.isnan(f) or math.isinf(f) else f


def percentile(sorted_values: List[float], q: float) -> float:
    if not sorted_values:
        return 0.0
    idx = min(len(sorted_values) - 1, max(0, int(round(q * (len(sorted_values) - 1)))))
    return sorted_values[idx]


def data_columns(header: List[str]) -> List[str]:
    """Every column except the three positional key columns.

    `parse_export_file()` in the collector reads timestamp/symbol/timeframe
    POSITIONALLY -- they carry a different prefix per source, and none at all for
    sr_levels -- so they are identified here the same way rather than by name.
    """
    return header[3:] if len(header) > 3 else []


def compare_file(old_path: Path, new_path: Path) -> dict:
    tf = timeframe_seconds(old_path.name)
    if tf is None:
        return {'file': old_path.name,
                'skipped': 'cannot infer timeframe from filename'}

    old_header, old_rows = load_export(old_path, tf)
    new_header, new_rows = load_export(new_path, tf)

    if old_header != new_header:
        return {'file': old_path.name, 'rows_old': len(old_rows),
                'rows_new': len(new_rows),
                'skipped': 'header changed between captures -- not comparable'}

    overlap = sorted(set(old_rows) & set(new_rows))
    result: dict = {
        'file': old_path.name,
        'timeframe_seconds': tf,
        'rows_old': len(old_rows),
        'rows_new': len(new_rows),
        'overlap': len(overlap),
        'columns': [],
    }
    if not overlap:
        result['skipped'] = ('no overlapping bars -- the gap between captures '
                             'exceeds the export window')
        return result

    # Bar age = position within the OLD capture's window. 0.0 = the oldest bar
    # the old capture held (most refits behind it by the time of the new
    # capture), 1.0 = the newest.
    old_sorted = sorted(old_rows)
    old_min, old_max = old_sorted[0], old_sorted[-1]
    span = max(1, old_max - old_min)

    channel_width = None
    for up_suffix, lo_suffix in CHANNEL_PAIRS:
        up_col = next((c for c in old_header if c.endswith(up_suffix)), None)
        lo_col = next((c for c in old_header if c.endswith(lo_suffix)), None)
        if up_col and lo_col:
            ui, li = old_header.index(up_col), old_header.index(lo_col)
            widths = []
            for ts in overlap:
                u = as_float(old_rows[ts][ui])
                l = as_float(old_rows[ts][li])
                if u is not None and l is not None and u > l:
                    widths.append(u - l)
            if widths:
                channel_width = statistics.median(widths)
            break
    result['median_channel_width'] = channel_width

    for col in data_columns(old_header):
        ci = old_header.index(col)
        deltas: List[float] = []
        aged: List[Tuple[float, float]] = []
        n_compared = n_changed = n_appeared = n_vanished = 0
        for ts in overlap:
            ov = as_float(old_rows[ts][ci]) if ci < len(old_rows[ts]) else None
            nv = as_float(new_rows[ts][ci]) if ci < len(new_rows[ts]) else None
            if ov is None and nv is None:
                continue
            if ov is None:
                n_appeared += 1
                continue
            if nv is None:
                n_vanished += 1
                continue
            n_compared += 1
            d = abs(nv - ov)
            if d > 0:
                n_changed += 1
            deltas.append(d)
            aged.append(((ts - old_min) / span, d))

        if not (n_compared or n_appeared or n_vanished):
            continue

        deltas_sorted = sorted(deltas)
        entry = {
            'column': col,
            'is_control': col.lower().endswith(CONTROL_SUFFIXES),
            'compared': n_compared,
            'changed': n_changed,
            'changed_pct': round(100.0 * n_changed / n_compared, 2) if n_compared else 0.0,
            'appeared': n_appeared,
            'vanished': n_vanished,
            'mean_abs_drift': statistics.fmean(deltas) if deltas else 0.0,
            'median_abs_drift': statistics.median(deltas) if deltas else 0.0,
            'p95_abs_drift': percentile(deltas_sorted, 0.95),
            'max_abs_drift': max(deltas) if deltas else 0.0,
        }
        if channel_width:
            entry['mean_drift_pct_of_channel'] = round(
                100.0 * entry['mean_abs_drift'] / channel_width, 2)
            entry['max_drift_pct_of_channel'] = round(
                100.0 * entry['max_abs_drift'] / channel_width, 2)

        entry['by_bar_age'] = [
            {
                'bin': label,
                'n': len([d for age, d in aged if lo <= age < hi]),
                'mean_abs_drift': (statistics.fmean([d for age, d in aged if lo <= age < hi])
                                   if any(lo <= age < hi for age, _ in aged) else 0.0),
                'max_abs_drift': (max([d for age, d in aged if lo <= age < hi])
                                  if any(lo <= age < hi for age, _ in aged) else 0.0),
            }
            for label, lo, hi in AGE_BINS
        ]
        result['columns'].append(entry)

    return result


def render(results: List[dict]) -> str:
    out: List[str] = []
    w = out.append
    w('=' * 100)
    w('LOOK-AHEAD DRIFT MEASUREMENT')
    w('HISTORICAL-VALUES-LOOK-AHEAD-BIAS-OPEN-ISSUE.md section 6')
    w('=' * 100)

    for res in results:
        w('')
        w('FILE: ' + res['file'])
        if res.get('skipped'):
            extra = ''
            if 'rows_old' in res:
                extra = '  (old=%s, new=%s)' % (res.get('rows_old'), res.get('rows_new'))
            w('   SKIPPED -- ' + res['skipped'] + extra)
            continue
        w('   bars: old=%d  new=%d  overlapping=%d'
          % (res['rows_old'], res['rows_new'], res['overlap']))
        if res.get('median_channel_width'):
            w('   median EDT channel width: %.5f' % res['median_channel_width'])
        w('')
        w('   %-26s %6s %7s %13s %13s %13s %8s'
          % ('column', 'n', 'chg%', 'mean|d|', 'p95|d|', 'max|d|', '%chan'))
        w('   ' + '-' * 90)
        for c in res['columns']:
            flag = '  [CONTROL]' if c['is_control'] else ''
            w('   %-26s %6d %6.1f%% %13.5f %13.5f %13.5f %7.1f%%%s'
              % (c['column'][:26], c['compared'], c['changed_pct'],
                 c['mean_abs_drift'], c['p95_abs_drift'], c['max_abs_drift'],
                 c.get('mean_drift_pct_of_channel', 0.0), flag))
            if c['appeared'] or c['vanished']:
                w('   %-26s   null->value: %d, value->null: %d'
                  % ('', c['appeared'], c['vanished']))

        movers = [c for c in res['columns'] if c['changed'] and not c['is_control']]
        if movers:
            w('')
            w('   drift by bar age within the OLD capture window '
              '(section 6 predicts oldest > newest):')
            for c in movers:
                cells = '  '.join('%s=%.4f' % (b['bin'], b['mean_abs_drift'])
                                  for b in c['by_bar_age'])
                w('     %-26s %s' % (c['column'][:26], cells))
    w('')
    w('=' * 100)
    return '\n'.join(out)


def main() -> int:
    ap = argparse.ArgumentParser(
        description='Measure look-ahead drift between two dated export captures.')
    ap.add_argument('old_dir', type=Path)
    ap.add_argument('new_dir', type=Path)
    ap.add_argument('--file', action='append', default=None,
                    help='compare only this filename (repeatable)')
    ap.add_argument('--json', type=Path, default=None,
                    help='also write raw results here')
    args = ap.parse_args()

    for d in (args.old_dir, args.new_dir):
        if not d.is_dir():
            print('ERROR: not a directory: %s' % d, file=sys.stderr)
            return 2

    if args.file:
        names = list(args.file)
    else:
        old_names = {p.name for p in args.old_dir.glob('*.txt')}
        new_names = {p.name for p in args.new_dir.glob('*.txt')}
        names = sorted(n for n in old_names & new_names
                       if not n.endswith('_Statistic.txt'))

    if not names:
        print('ERROR: no comparable .txt exports present in both directories',
              file=sys.stderr)
        return 2

    results = [compare_file(args.old_dir / n, args.new_dir / n) for n in names]
    print(render(results))
    if args.json:
        args.json.write_text(json.dumps(results, indent=2), encoding='utf-8')
        print('raw results written to %s' % args.json)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
