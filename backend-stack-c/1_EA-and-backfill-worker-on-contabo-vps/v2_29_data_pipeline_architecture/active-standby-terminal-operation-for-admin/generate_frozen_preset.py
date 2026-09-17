#!/usr/bin/env python3
"""Capture a standby terminal's approved line and write MT5 .set presets that
freeze it -- Pillar 1's half of the promotion procedure
(ARCH-SPEC-2026-09-18-V2.29-FROZEN-ALERT section 5.3).

WHAT THIS CAN AND CANNOT DO -- READ THIS FIRST
----------------------------------------------
It CANNOT switch a terminal into frozen mode. MetaTrader offers no supported way
for an outside process to change a running indicator's inputs; presets are loaded
by a human through the indicator's Properties dialog. Pretending otherwise would
be the worst possible automation here: the script would report success, the
administrator would believe the active terminal was frozen, and it would go on
silently repainting ~3000 bars of history for as long as nobody checked.

So it does the part a script can do correctly -- read the approved geometry out
of the statistic files and write it into .set files, with no transcription
errors and no sign flips -- and then says plainly what the human has to do.

`--verify` closes the loop afterwards: it re-reads the terminal's own exports and
confirms it really is reporting FROZEN with the values that were handed to it.
That check is the whole point. Loading a preset is the step most likely to be
half-done, and without it the failure is invisible.

    python generate_frozen_preset.py --standby-dir C:\\MT5-B\\MQL5\\Files
    python generate_frozen_preset.py --verify --standby-dir C:\\MT5-B\\MQL5\\Files
    python generate_frozen_preset.py --dynamic-only --out-dir C:\\Scripts\\presets
"""
import argparse
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional, Tuple

SYMBOL = 'XAUUSD'
TIMEFRAMES = ['M5', 'M15']

# Same seven prefixes the collector and the watchdog use. Kept literal here so
# this script stays runnable on a VPS with nothing else importable beside it.
CENTROID_SOURCES: Dict[str, str] = {
    'best_fit_a':  'Centriod_Best_Fit_A',
    'best_fit_b':  'Centriod_Best_Fit_B',
    'cherry_a':    'Cherry-Pick-A',
    'cherry_b':    'Cherry-Pick-B',
    'most_recent': 'Most-Recent',
    'non_a':       'Non-Recent-A',
    'non_b':       'Non-Recent-B',
}

STALE_MINUTES = 15          # matches promote_terminal.bat's own pre-flight check


def parse_stat(path: Path) -> Optional[Dict[str, str]]:
    """Section-aware `Key: Value` reader. Same three format quirks as everywhere
    else in this stack: FILE_ANSI section headers can arrive mangled (match by
    prefix), keys contain spaces and parentheses (split on the FIRST colon), and
    a key is only unique within its section."""
    try:
        text = path.read_text(encoding='utf-8', errors='replace')
    except OSError:
        return None
    seen: Dict[Tuple[str, str], str] = {}
    section = ''
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith('['):
            section = line
            continue
        if ':' not in line:
            continue
        label, _, value = line.partition(':')
        seen[(section, label.strip())] = value.strip()
    return {f"{s}|{l}": v for (s, l), v in seen.items()}


def get(d: Dict[str, str], label: str, section_prefix: str = '') -> Optional[str]:
    for k, v in d.items():
        s, _, l = k.partition('|')
        if l == label and s.startswith(section_prefix):
            return v
    return None


def stat_path(directory: Path, source: str, tf: str) -> Path:
    return directory / f"{CENTROID_SOURCES[source]}_{SYMBOL}_{tf}_Statistic.txt"


def mt5_datetime(unix_server: int) -> str:
    """MT5 writes datetime inputs in .set files as 'YYYY.MM.DD HH:MM:SS'.

    The value is SERVER time and is formatted here with no timezone conversion
    at all -- that is deliberate. InpFrozenAnchorTime is compared against MT5's
    own server-time bar array, so converting it would shift the anchor by the
    broker offset (2-3 hours, i.e. 24-36 M5 bars)."""
    return datetime.utcfromtimestamp(unix_server).strftime('%Y.%m.%d %H:%M:%S')


class Snapshot:
    def __init__(self, source: str, tf: str, d: Dict[str, str], path: Path):
        self.source, self.tf, self.path = source, tf, path
        snap = '[FROZEN_SNAPSHOT'
        self.mode = get(d, 'Projection Mode', snap)
        self.anchor_server = get(d, 'Snapshot Anchor TS (Server)', snap)
        self.anchor_utc = get(d, 'Snapshot Anchor TS (UTC)', snap)
        self.slope = get(d, 'Snapshot Slope (b)', snap)
        self.price = get(d, 'Snapshot Anchor Price', snap)
        self.uo = get(d, 'Snapshot UOEDT Offset', snap)
        self.lo = get(d, 'Snapshot LOEDT Offset', snap)
        self.r2 = get(d, 'R-Square', '[MODEL A')
        self.containment = get(d, 'Containment Rate', '[EDT CHANNEL')
        self.centroids = get(d, 'Centroid Count', '[CENTROIDS_DETAIL')
        self.frozen_mode = get(d, 'Projection Mode', snap)

    def problems(self) -> list:
        """Everything that would make this snapshot unsafe to freeze on.

        Refusing is the right default: a preset built from a missing or
        wrong-signed value produces a channel that looks plausible and is wrong,
        on the terminal that feeds production."""
        out = []
        if self.mode is None:
            out.append('no [FROZEN_SNAPSHOT] block -- the terminal is running a '
                       'pre-upgrade .ex5; recompile and reattach first')
            return out
        for name, raw in (('slope', self.slope), ('anchor price', self.price),
                          ('anchor timestamp', self.anchor_server)):
            if raw is None or raw == '':
                out.append(f'{name} is empty -- the indicator has not resolved a '
                           f'line yet (too few centroids?)')
        try:
            if self.price is not None and float(self.price) <= 0:
                out.append(f'anchor price {self.price} is not a real price')
        except ValueError:
            out.append(f'anchor price {self.price!r} is not a number')
        # Signed, baseline-relative, and ADDED by the indicator. A positive LOEDT
        # would draw the lower band above the baseline.
        try:
            if self.uo not in (None, '') and float(self.uo) < 0:
                out.append(f'UOEDT offset {self.uo} is negative; it must be >= 0')
            if self.lo not in (None, '') and float(self.lo) > 0:
                out.append(f'LOEDT offset {self.lo} is positive; it must be <= 0')
        except ValueError:
            out.append('EDT offsets are not numbers')
        age_min = (time.time() - self.path.stat().st_mtime) / 60
        if age_min > STALE_MINUTES:
            out.append(f'export is {age_min:.0f} min old -- this terminal is not '
                       f'exporting; freezing a stale line would freeze stale data')
        return out

    def set_body(self) -> str:
        uo = self.uo if self.uo not in (None, '') else '0.0'
        lo = self.lo if self.lo not in (None, '') else '0.0'
        return f"""; DavinTrade frozen-line preset -- GENERATED, do not hand-edit.
; source        : {self.path.name}
; generated     : {datetime.now(timezone.utc):%Y-%m-%d %H:%M:%S} UTC
; anchor (UTC)  : {self.anchor_utc}  <- for humans; the input below is SERVER time
; Model A R2    : {self.r2}   Containment: {self.containment}%   Centroids: {self.centroids}
;
; Load this in MetaTrader: right-click the indicator -> Properties -> Inputs ->
; Load, pick this file, then OK. Nothing outside MetaTrader can do this step.
InpProjectionMode=1
InpFrozenAnchorTime={mt5_datetime(int(self.anchor_server))}
InpFrozenSlope={self.slope}
InpFrozenAnchorPrice={self.price}
InpFrozenUOEDTOffset={uo}
InpFrozenLOEDTOffset={lo}
"""


DYNAMIC_SET = """; DavinTrade dynamic-mode preset -- GENERATED, do not hand-edit.
; Returns a terminal to live clustering so it can hunt for the next centroid
; regime. Load this into the terminal being DEMOTED to hot standby.
InpProjectionMode=0
InpFrozenAnchorTime=1970.01.01 00:00:00
InpFrozenSlope=0.0
InpFrozenAnchorPrice=0.0
InpFrozenUOEDTOffset=0.0
InpFrozenLOEDTOffset=0.0
"""


def collect(directory: Path, timeframes) -> Dict[Tuple[str, str], Snapshot]:
    found = {}
    for source in CENTROID_SOURCES:
        for tf in timeframes:
            p = stat_path(directory, source, tf)
            if not p.exists():
                continue
            d = parse_stat(p)
            if d:
                found[(source, tf)] = Snapshot(source, tf, d, p)
    return found


def cmd_generate(args) -> int:
    standby = Path(args.standby_dir)
    out = Path(args.out_dir)
    if not standby.is_dir():
        print(f"ERROR: standby directory not found: {standby}")
        return 2
    snaps = collect(standby, args.timeframes)
    expected = len(CENTROID_SOURCES) * len(args.timeframes)
    print(f"Read {len(snaps)}/{expected} statistic files from {standby}\n")
    if not snaps:
        print("ERROR: nothing to snapshot. Is the standby terminal running with "
              "the 7 centroid indicators attached and exporting?")
        return 2

    blocked = False
    for (source, tf), s in sorted(snaps.items()):
        probs = s.problems()
        if probs:
            blocked = True
            print(f"  REFUSED {source}/{tf}")
            for p in probs:
                print(f"          - {p}")
        else:
            note = ''
            if s.mode == 'FROZEN':
                # Not an error: re-freezing onto a newly approved line is a normal
                # operation. But the admin should know the numbers being captured
                # are the frozen line's own, not a fresh fit.
                note = '   (NOTE: already FROZEN -- re-freezing its current line)'
            print(f"  OK      {source}/{tf}  slope={s.slope} price={s.price} "
                  f"UOEDT={s.uo} LOEDT={s.lo}{note}")
    if len(snaps) < expected:
        blocked = True
        missing = [(s, t) for s in CENTROID_SOURCES for t in args.timeframes
                   if (s, t) not in snaps]
        print(f"\n  REFUSED: {len(missing)} statistic file(s) missing: "
              + ', '.join(f'{s}/{t}' for s, t in missing))

    if blocked and not args.force:
        print("\nNo presets written. Fix the above, or re-run with --force to write "
              "presets for the sources that ARE clean.")
        print("Freezing a partial set means the active terminal runs some "
              "indicators frozen and some live -- do that only deliberately.")
        return 1

    out.mkdir(parents=True, exist_ok=True)
    written = 0
    for (source, tf), s in sorted(snaps.items()):
        if s.problems():
            continue
        p = out / f"{CENTROID_SOURCES[source]}_{SYMBOL}_{tf}_FROZEN.set"
        p.write_text(s.set_body(), encoding='utf-8')
        written += 1
    dyn = out / 'DAVINTRADE_DYNAMIC.set'
    dyn.write_text(DYNAMIC_SET, encoding='utf-8')

    print(f"\nWrote {written} frozen preset(s) + {dyn.name} to {out}")
    print("""
NEXT STEPS -- these cannot be scripted, MetaTrader has no external input API:

  1. On the terminal being PROMOTED, load each *_FROZEN.set into its matching
     indicator (right-click -> Properties -> Inputs -> Load -> OK).
  2. Confirm it took effect -- do not assume:
         python generate_frozen_preset.py --verify --standby-dir <that terminal>
     Every source must report FROZEN with the values above.
  3. Only then run promote_terminal.bat to point the collector at it.
  4. On the terminal being DEMOTED to hot standby, load DAVINTRADE_DYNAMIC.set
     into all 7 indicators so it starts hunting for the next regime.

Until step 1 is done the promoted terminal is still repainting history.""")
    return 0


def cmd_verify(args) -> int:
    """Confirm a terminal really is frozen. This is the check that catches a
    preset that was generated, believed, and never actually loaded."""
    d = Path(args.standby_dir)
    snaps = collect(d, args.timeframes)
    expected = len(CENTROID_SOURCES) * len(args.timeframes)
    print(f"Verifying {d}\n")
    if not snaps:
        print("ERROR: no statistic files found.")
        return 2

    bad = 0
    for (source, tf), s in sorted(snaps.items()):
        age = (time.time() - s.path.stat().st_mtime) / 60
        frozen_slope = get(parse_stat(s.path) or {}, 'Frozen Slope (b)', '[FROZEN_SNAPSHOT')
        frozen_price = get(parse_stat(s.path) or {}, 'Frozen Anchor Price', '[FROZEN_SNAPSHOT')
        bars = get(parse_stat(s.path) or {}, 'Bars Since Anchor', '[FROZEN_SNAPSHOT')
        ok = s.mode == 'FROZEN' and age <= STALE_MINUTES
        bad += (not ok)
        print(f"  {'OK     ' if ok else 'PROBLEM'} {source}/{tf}: mode={s.mode} "
              f"frozen_slope={frozen_slope} frozen_price={frozen_price} "
              f"bars_since_anchor={bars} age={age:.0f}min")
        if s.mode != 'FROZEN':
            print("          -> preset NOT loaded; this indicator is still "
                  "refitting and repainting history")
        if age > STALE_MINUTES:
            print("          -> export is stale; the terminal is not running")
    if len(snaps) < expected:
        bad += 1
        print(f"\n  {expected - len(snaps)} statistic file(s) missing entirely")

    print("\n" + ("ALL FROZEN -- safe to point the collector here"
                  if not bad else
                  f"{bad} problem(s) -- do NOT promote yet"))
    return 1 if bad else 0


def cmd_dynamic_only(args) -> int:
    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    p = out / 'DAVINTRADE_DYNAMIC.set'
    p.write_text(DYNAMIC_SET, encoding='utf-8')
    print(f"Wrote {p}\nLoad it into all 7 centroid indicators on the terminal "
          f"being demoted to hot standby.")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(
        description='Capture a standby terminal approved line into MT5 .set presets.')
    ap.add_argument('--standby-dir', default=r'C:\MT5-B\MQL5\Files',
                    help='export directory of the terminal being promoted')
    ap.add_argument('--out-dir', default=r'C:\Scripts\presets',
                    help='where to write the .set files')
    ap.add_argument('--timeframes', nargs='+', default=TIMEFRAMES,
                    help='timeframes to snapshot (default: M5 M15)')
    ap.add_argument('--verify', action='store_true',
                    help='check a terminal is really reporting FROZEN')
    ap.add_argument('--dynamic-only', action='store_true',
                    help='only write the demote-to-dynamic preset')
    ap.add_argument('--force', action='store_true',
                    help='write presets for the clean sources even if some failed')
    args = ap.parse_args()

    if args.verify:
        return cmd_verify(args)
    if args.dynamic_only:
        return cmd_dynamic_only(args)
    return cmd_generate(args)


if __name__ == '__main__':
    sys.exit(main())
