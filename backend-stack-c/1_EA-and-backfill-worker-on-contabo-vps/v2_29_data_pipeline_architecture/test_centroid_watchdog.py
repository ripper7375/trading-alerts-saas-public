"""Tests for the Centroid Watchdog's debounce automaton and stat parsing.

Run either way -- there is no pytest config in this stack, and a test nobody can
run is worse than none:

    python -m pytest test_centroid_watchdog.py -q
    python test_centroid_watchdog.py

WHAT IS BEING PROTECTED
-----------------------
Every failure mode of this daemon is SILENT. It either alerts when it should not
(alert fatigue, which trains the administrator to ignore it) or stays quiet when
it should not (a regime change nobody notices). Neither raises, neither shows up
in a log as an error, and neither can be seen by looking at the daemon running.

So the automaton is exercised directly, poll by poll, with the bar clock passed
in as data. The load-bearing tests are:

  * test_flicker_never_confirms       -- the whole reason the debounce exists
  * test_first_observation_seeds_only -- otherwise EVERY restart cries wolf
  * test_weekend_does_not_confirm     -- why bars are counted, not seconds
  * test_drift_keeps_one_candidate    -- otherwise NOTHING ever confirms
  * test_sliding_window_dropout       -- the false negative a count-based
                                         trigger cannot see

test_source_prefixes_match_collector is the one test here that reaches outside
this module: the daemon duplicates the collector's export-file prefixes on
purpose (process isolation), and this is what keeps that duplication honest.
"""
import json
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import centroid_watchdog as wd  # noqa: E402

M5 = 300
BASE = 1789012800           # an arbitrary slot aligned to both M5 and M15
assert BASE % 900 == 0


# ------------------------------------------------------------------
# helpers
# ------------------------------------------------------------------
def poll(state, bar_ts, centroids, tf='M5', source='best_fit_a'):
    """One poll. `centroids` is [(ts, price, points), ...] newest first."""
    data = {'live_bar_ts': bar_ts,
            'centroid_total': len(centroids),
            'centroids': [{'ts': t, 'price': p, 'points': n}
                          for t, p, n in centroids],
            'raw_slope': 0.1, 'anchored_y_int': 2580.0, 'model_a_r2': 0.8,
            'uoedt_offset': 18.0, 'loedt_offset': -21.0,
            'containment_rate': 94.0, 'projection_mode': None}
    return wd.process_source(state, source, tf, data)


def fresh():
    return wd._blank_source_state()


OLD = [(BASE - 3000, 2540.0, 8), (BASE - 6000, 2520.0, 7)]


# ------------------------------------------------------------------
# seeding / restart safety
# ------------------------------------------------------------------
def test_first_observation_seeds_only():
    """The centroid the admin has been staring at all week is not news."""
    st = fresh()
    out = poll(st, BASE, OLD + [(BASE, 2584.0, 9)])
    assert out == [], f'seeding must not alert, got {out}'
    assert st['seeded'] is True
    assert len(st['known']) == 3
    # ... and a second identical poll still says nothing.
    assert poll(st, BASE + M5, OLD + [(BASE, 2584.0, 9)]) == []


def test_restart_replays_state_without_realerting():
    """State survives a round-trip through JSON and does not re-fire."""
    st = fresh()
    poll(st, BASE, OLD)
    for i in range(1, 4):
        poll(st, BASE + i * M5, [(BASE + M5, 2584.0, 9)] + OLD)
    st2 = json.loads(json.dumps(st))          # what save_state/load_state do
    assert poll(st2, BASE + 9 * M5, [(BASE + M5, 2584.0, 9)] + OLD) == []


# ------------------------------------------------------------------
# the debounce itself
# ------------------------------------------------------------------
def test_new_centroid_confirms_after_two_closed_bars():
    st = fresh()
    poll(st, BASE, OLD)                                     # seed
    new = (BASE + M5, 2584.0, 7)
    assert poll(st, BASE + M5, [new] + OLD) == [], 'must not fire on first sight'
    assert poll(st, BASE + 2 * M5, [new] + OLD) == [], 'must not fire after 1 bar'
    out = poll(st, BASE + 3 * M5, [new] + OLD)
    assert len(out) == 1, f'expected confirmation on bar 2, got {out}'
    assert out[0]['centroid_time'] == BASE + M5
    assert out[0]['points_in_cluster'] == 7
    assert out[0]['confirmed_after_bars'] == 2


def test_confirms_exactly_once():
    st = fresh()
    poll(st, BASE, OLD)
    new = (BASE + M5, 2584.0, 7)
    fired = 0
    for i in range(1, 12):
        fired += len(poll(st, BASE + i * M5, [new] + OLD))
    assert fired == 1, f'a confirmed centroid must alert once, alerted {fired} times'


def test_flicker_never_confirms():
    """THE load-bearing test. A candidate that appears, vanishes, and reappears
    must never mature -- that is the whole point of the debounce. Under a
    'count total sightings' implementation this centroid is seen 4 times and
    would confirm."""
    st = fresh()
    poll(st, BASE, OLD)
    flicker = (BASE + M5, 2584.0, 7)
    seq = [True, False, True, False, True, False, True]
    fired = 0
    for i, present in enumerate(seq, start=1):
        fired += len(poll(st, BASE + i * M5, ([flicker] if present else []) + OLD))
    assert fired == 0, 'a flickering centroid must never be announced'


def test_vanishing_candidate_is_dropped():
    st = fresh()
    poll(st, BASE, OLD)
    cand = (BASE + M5, 2584.0, 7)
    poll(st, BASE + M5, [cand] + OLD)
    assert len(st['candidates']) == 1
    poll(st, BASE + 2 * M5, OLD)                            # gone
    assert st['candidates'] == {}, 'FORMING -> DORMANT on disappearance'


def test_weekend_does_not_confirm():
    """Why bars are counted and not seconds. Three days of wall clock pass with
    the bar clock frozen (market shut); nothing may mature."""
    st = fresh()
    poll(st, BASE, OLD)
    cand = (BASE + M5, 2584.0, 9)
    poll(st, BASE + M5, [cand] + OLD)
    fired = 0
    for _ in range(50):
        # Same live bar every time: no bar has closed.
        fired += len(poll(st, BASE + M5, [cand] + OLD))
    assert fired == 0, 'no bar closed, so nothing may confirm'
    # The moment two bars really do close, it confirms.
    assert len(poll(st, BASE + 3 * M5, [cand] + OLD)) == 1


def test_low_point_count_does_not_confirm_then_ages_out():
    """Section 4.3's N >= InpMinPts + 1. A cluster stuck at the DBSCAN minimum
    is still forming, and is eventually filed rather than announced."""
    st = fresh()
    poll(st, BASE, OLD)
    marginal = (BASE + M5, 2584.0, 5)                       # MIN_POINTS is 6
    fired = 0
    for i in range(1, wd.CANDIDATE_MAX_BARS + 3):
        fired += len(poll(st, BASE + i * M5, [marginal] + OLD))
    assert fired == 0, 'a 5-point cluster must not be announced'
    assert st['candidates'] == {}, 'and must not be tracked forever'
    assert any(abs(k - (BASE + M5)) <= M5 for k in st['known']), \
        'it is real, so it must be filed as known'


def test_growing_cluster_confirms_once_it_matures():
    st = fresh()
    poll(st, BASE, OLD)
    for i, pts in enumerate([4, 5, 5], start=1):
        assert poll(st, BASE + i * M5, [(BASE + M5, 2584.0, pts)] + OLD) == []
    out = poll(st, BASE + 4 * M5, [(BASE + M5, 2584.0, 7)] + OLD)
    assert len(out) == 1 and out[0]['points_in_cluster'] == 7


# ------------------------------------------------------------------
# centroid drift
# ------------------------------------------------------------------
def test_drift_keeps_one_candidate():
    """A centroid is a centre of mass, so its timestamp moves as points join.
    If each reported position were treated as a new centroid the debounce would
    reset every poll and NOTHING would ever confirm."""
    st = fresh()
    poll(st, BASE, OLD)
    poll(st, BASE + M5, [(BASE + M5, 2584.0, 7)] + OLD)
    poll(st, BASE + 2 * M5, [(BASE + 2 * M5, 2585.0, 8)] + OLD)      # drifted 1 bar
    assert len(st['candidates']) == 1, 'drift must not spawn a second candidate'
    out = poll(st, BASE + 3 * M5, [(BASE + 2 * M5, 2585.5, 8)] + OLD)
    assert len(out) == 1, 'a drifting candidate must still confirm'


def test_drift_beyond_tolerance_is_a_different_centroid():
    st = fresh()
    poll(st, BASE, OLD)
    poll(st, BASE + M5, [(BASE + M5, 2584.0, 7)] + OLD)
    poll(st, BASE + 2 * M5, [(BASE + 6 * M5, 2599.0, 7)] + OLD)      # 5 bars away
    assert len(st['candidates']) == 1, 'the first vanished, the second replaced it'
    assert st['candidates'][str(BASE + 6 * M5)]['ts'] == BASE + 6 * M5


# ------------------------------------------------------------------
# the trigger's own edge cases
# ------------------------------------------------------------------
def test_sliding_window_dropout():
    """Section 4.1's false negative: an ancient cluster leaves the 3000-bar
    window in the same cycle a new one forms, so the COUNT never changes. A
    count-based trigger sees nothing; the timestamp invariant sees it."""
    st = fresh()
    seeded = [(BASE, 2580.0, 8), (BASE - 3000, 2540.0, 8), (BASE - 6000, 2520.0, 7)]
    poll(st, BASE, seeded)
    assert len(seeded) == 3

    # Oldest drops out, a new one appears well clear of the previous newest
    # (see test_new_centroid_adjacent_to_a_known_one_is_suppressed for why the
    # distance matters): still 3 centroids.
    new_ts = BASE + 6 * M5
    after = [(new_ts, 2590.0, 7), (BASE, 2580.0, 8), (BASE - 3000, 2540.0, 8)]
    assert len(after) == len(seeded), 'fixture must hold the count constant'
    poll(st, new_ts, after)
    poll(st, new_ts + M5, after)
    out = poll(st, new_ts + 2 * M5, after)
    assert len(out) == 1, 'a constant count must not hide a new centroid'
    assert out[0]['centroid_time'] == new_ts


def test_new_centroid_adjacent_to_a_known_one_is_suppressed():
    """A DELIBERATE trade-off, pinned so it is not 'fixed' by accident.

    DRIFT_TOLERANCE_BARS is applied to the KNOWN set as well as to live
    candidates, which leaves a +/-1 bar blind spot right beside an existing
    centroid. That is the safe direction: a known centroid's own centre of mass
    drifts by about a bar between polls, and without this suppression it would
    re-announce itself forever -- the precise alert fatigue this daemon exists
    to remove. The cost is only theoretical, because two DBSCAN clusters whose
    centres sit one M5 bar apart are not two clusters.

    Widen DRIFT_TOLERANCE_BARS and this blind spot widens with it."""
    st = fresh()
    poll(st, BASE, [(BASE, 2580.0, 8)])
    adjacent = (BASE + M5, 2584.0, 9)           # exactly one bar from a known one
    fired = 0
    for i in range(1, 6):
        fired += len(poll(st, BASE + i * M5, [adjacent, (BASE, 2580.0, 8)]))
    assert fired == 0, 'within the drift window, treated as the known centroid moving'
    # Two bars away is outside the window and is a genuinely new centroid.
    st2 = fresh()
    poll(st2, BASE, [(BASE, 2580.0, 8)])
    clear = (BASE + 2 * M5, 2584.0, 9)
    out = []
    for i in range(1, 6):
        out += poll(st2, BASE + i * M5, [clear, (BASE, 2580.0, 8)])
    assert len(out) == 1 and out[0]['centroid_time'] == BASE + 2 * M5


def test_backfilled_centroid_between_known_ones_is_new():
    """'T_new > max(T_active) OR T_new not in T_active' -- the second clause.
    A cluster resolving between two known ones is new even though it is not the
    newest."""
    st = fresh()
    poll(st, BASE, [(BASE, 2580.0, 8), (BASE - 6000, 2520.0, 7)])
    gap = (BASE - 3000, 2550.0, 7)
    for i in range(1, 4):
        out = poll(st, BASE + i * M5, [(BASE, 2580.0, 8), gap, (BASE - 6000, 2520.0, 7)])
    assert len(out) == 1 and out[0]['centroid_time'] == BASE - 3000


def test_bar_clock_going_backwards_is_survived():
    """A terminal restarted against shorter history reports an OLDER live bar.
    Unguarded, (bar_ts - first_bar_ts) // tf goes negative -- or, worse, a later
    poll measures elapsed bars from a bar in the future and confirms a candidate
    that has existed for seconds.

    In-flight candidates are therefore re-based on the new clock rather than
    confirmed or silently kept: the debounce restarts from the bar actually
    being reported."""
    st = fresh()
    poll(st, BASE, OLD)
    cand = (BASE + M5, 2584.0, 9)
    poll(st, BASE + M5, [cand] + OLD)
    out = poll(st, BASE - 10 * M5, [cand] + OLD)
    assert out == [], 'a backwards clock must not confirm anything'
    tracked = list(st['candidates'].values())
    assert len(tracked) == 1, 'the candidate is re-tracked, not dropped or confirmed'
    assert tracked[0]['first_bar_ts'] == BASE - 10 * M5, \
        'the debounce must restart from the clock now being reported'
    # And it still needs a full, honest CONFIRM_BARS from there.
    assert poll(st, BASE - 9 * M5, [cand] + OLD) == []
    assert len(poll(st, BASE - 8 * M5, [cand] + OLD)) == 1


def test_m15_uses_its_own_bar_length():
    st = fresh()
    poll(st, BASE, OLD, tf='M15')
    cand = (BASE + 900, 2584.0, 9)
    poll(st, BASE + 900, [cand] + OLD, tf='M15')
    assert poll(st, BASE + 2 * 900, [cand] + OLD, tf='M15') == [], 'only 1 M15 bar'
    assert len(poll(st, BASE + 3 * 900, [cand] + OLD, tf='M15')) == 1


def test_no_centroids_at_all_is_quiet():
    st = fresh()
    poll(st, BASE, [])
    for i in range(1, 6):
        assert poll(st, BASE + i * M5, []) == []


def test_known_history_is_bounded():
    st = fresh()
    st['seeded'] = True
    st['known'] = list(range(BASE - 10_000 * M5, BASE, M5))
    poll(st, BASE, [])
    assert len(st['known']) <= wd.MAX_KNOWN_PER_SOURCE


# ------------------------------------------------------------------
# parsing
# ------------------------------------------------------------------
STAT = """Regression Centroids (Best WLS CFL): 4
Timeframe (Sec): 300
Raw Slope (b): 0.14520
Anchored Y-Int: 2584.50000

[MODEL A; CROSSINGS]
Sample (n): 37
R-Square: 0.8410

[MODEL B; CLOSE PRICE]
Sample (n): 812
R-Square: 0.6850

[EDT CHANNEL]
UOEDT Offset: 18.44000
LOEDT Offset: -21.07000
Containment Rate: 94.95

[CENTROIDS_DETAIL]
Live Bar TS (UTC): 1789012800
Centroid Count: 3
Centroid Exported (n): 3
Centroid Timestamps (UTC): 1789012800,1789009800,1789006800
Centroid Prices: 2584.50,2579.10,2566.44
Centroid Points: 7,6,9
Latest Centroid TS (UTC): 1789012800
Latest Centroid Price: 2584.50
Latest Centroid Points: 7
"""


def _write(text):
    d = Path(tempfile.mkdtemp())
    p = d / 'Centriod_Best_Fit_A_XAUUSD_M5_Statistic.txt'
    p.write_text(text, encoding='utf-8')
    return p


def test_parse_reads_the_whole_block():
    d = wd.parse_stat_file(_write(STAT))
    assert d is not None
    assert d['live_bar_ts'] == 1789012800
    assert d['centroid_total'] == 3
    assert [c['ts'] for c in d['centroids']] == [1789012800, 1789009800, 1789006800]
    assert [c['points'] for c in d['centroids']] == [7, 6, 9]
    assert d['raw_slope'] == 0.1452
    # Section-aware: MODEL A's R-Square, not MODEL B's.
    assert d['model_a_r2'] == 0.8410
    assert d['loedt_offset'] == -21.07


def test_parse_rejects_a_truncated_file():
    """MT5 opens these FILE_WRITE, which truncates first, so a poll can genuinely
    read half a file. Guessing at one is how a watchdog invents an event."""
    assert wd.parse_stat_file(_write(STAT[:len(STAT) // 2])) is None


def test_parse_rejects_misaligned_csvs():
    bad = STAT.replace('Centroid Points: 7,6,9', 'Centroid Points: 7,6')
    assert wd.parse_stat_file(bad and _write(bad)) is None


def test_parse_rejects_a_pre_upgrade_file():
    """An old binary writes no [CENTROIDS_DETAIL]. That must read as 'nothing to
    say', never as 'zero centroids' -- which would look like every centroid
    just vanished."""
    old = STAT.split('[CENTROIDS_DETAIL]')[0]
    assert wd.parse_stat_file(_write(old)) is None


def test_parse_handles_zero_centroids():
    """A FROZEN active terminal reports 0. That is a real, readable answer and
    must parse, unlike a truncated file."""
    empty = STAT.split('[CENTROIDS_DETAIL]')[0] + """[CENTROIDS_DETAIL]
Live Bar TS (UTC): 1789012800
Centroid Count: 0
Centroid Exported (n): 0
Centroid Timestamps (UTC):
Centroid Prices:
Centroid Points:
"""
    d = wd.parse_stat_file(_write(empty))
    assert d is not None and d['centroids'] == [] and d['centroid_total'] == 0


def test_parse_missing_file_is_none():
    assert wd.parse_stat_file(Path(tempfile.mkdtemp()) / 'nope.txt') is None


# ------------------------------------------------------------------
# impact analysis
# ------------------------------------------------------------------
def test_channel_width_uses_signed_offsets():
    """UOEDT is positive above the baseline and LOEDT NEGATIVE below it, which
    is what the indicator actually exports. Adding them instead of subtracting
    would report a near-zero width for a perfectly healthy channel."""
    assert wd._channel_width({'uoedt_offset': 18.0, 'loedt_offset': -21.0}) == 39.0


def test_impact_survives_a_missing_active_file():
    """Right after a fresh install there may be no active-side stat file. The
    alert must still go out -- with nulls, not a crash."""
    imp = wd.build_impact(None, {'raw_slope': 0.02, 'model_a_r2': 0.68,
                                 'uoedt_offset': 18.0, 'loedt_offset': -21.0})
    assert imp['candidate_new_slope'] == 0.02
    assert imp['slope_delta_pct'] is None
    assert imp['active_channel_width'] is None


def test_impact_computes_the_deltas():
    active = {'raw_slope': 0.1452, 'model_a_r2': 0.841,
              'uoedt_offset': 18.0, 'loedt_offset': -18.0, 'containment_rate': 95.0}
    cand = {'raw_slope': 0.0211, 'model_a_r2': 0.685,
            'uoedt_offset': 22.0, 'loedt_offset': -23.0, 'containment_rate': 91.0}
    imp = wd.build_impact(active, cand)
    assert imp['slope_delta_pct'] == -85.47          # spec section 4.4's worked example
    assert imp['active_channel_width'] == 36.0
    assert imp['candidate_channel_width'] == 45.0
    assert imp['channel_width_change_pct'] == 25.0


def test_zero_active_slope_does_not_divide_by_zero():
    imp = wd.build_impact({'raw_slope': 0.0}, {'raw_slope': 0.02})
    assert imp['slope_delta_pct'] is None


# ------------------------------------------------------------------
# state file
# ------------------------------------------------------------------
def test_state_round_trips_atomically():
    p = Path(tempfile.mkdtemp()) / 'sub' / 'state.json'
    st = {'sources': {'best_fit_a|M5': fresh()}, 'standby_stale_alerted': False}
    wd.save_state(p, st)
    assert wd.load_state(p) == st
    assert not p.with_suffix(p.suffix + '.tmp').exists(), 'temp file must be renamed away'


def test_corrupt_state_does_not_wedge_the_daemon():
    p = Path(tempfile.mkdtemp()) / 'state.json'
    p.write_text('{not json', encoding='utf-8')
    assert wd.load_state(p) == {'sources': {}, 'standby_stale_alerted': False}


def test_missing_state_starts_blank():
    assert wd.load_state(Path(tempfile.mkdtemp()) / 'none.json') == {
        'sources': {}, 'standby_stale_alerted': False}


# ------------------------------------------------------------------
# staleness
# ------------------------------------------------------------------
class _RecordingSession:
    def __init__(self):
        self.posts = []

    def post(self, *a, **kw):                                   # pragma: no cover
        raise AssertionError('dry-run must never POST')


def test_stale_standby_alerts_once_then_recovers(tmpdir=None):
    d = Path(tempfile.mkdtemp())
    state = {'sources': {}, 'standby_stale_alerted': False}
    sess = _RecordingSession()

    old_dir, wd.STANDBY_DIR = wd.STANDBY_DIR, d
    try:
        # Empty directory: nothing has ever been written.
        assert wd.check_standby_alive(state, sess, time.time(), dry_run=True) is False
        assert state['standby_stale_alerted'] is True
        # Still stale -- must not alert again (it flips no flag).
        assert wd.check_standby_alive(state, sess, time.time(), dry_run=True) is False
        assert state['standby_stale_alerted'] is True

        # A fresh export appears: watching resumes and the latch clears.
        wd.stat_path(d, 'best_fit_a', 'M5').write_text(STAT, encoding='utf-8')
        assert wd.check_standby_alive(state, sess, time.time(), dry_run=True) is True
        assert state['standby_stale_alerted'] is False
    finally:
        wd.STANDBY_DIR = old_dir


def test_stale_threshold_is_respected():
    d = Path(tempfile.mkdtemp())
    p = wd.stat_path(d, 'best_fit_a', 'M5')
    p.write_text(STAT, encoding='utf-8')
    old_dir, wd.STANDBY_DIR = wd.STANDBY_DIR, d
    try:
        now = time.time()
        # Just inside the window.
        state = {'sources': {}, 'standby_stale_alerted': False}
        assert wd.check_standby_alive(
            state, _RecordingSession(),
            now + wd.STALE_FILE_MINUTES * 60 - 30, dry_run=True) is True
        # Just outside it.
        state = {'sources': {}, 'standby_stale_alerted': False}
        assert wd.check_standby_alive(
            state, _RecordingSession(),
            now + wd.STALE_FILE_MINUTES * 60 + 30, dry_run=True) is False
    finally:
        wd.STANDBY_DIR = old_dir


# ------------------------------------------------------------------
# the one cross-module check
# ------------------------------------------------------------------
def test_source_prefixes_match_collector():
    """The daemon duplicates these prefixes so it never imports the collector.
    This is what keeps the copy honest: a prefix changed in one place and not
    the other would make the watchdog silently watch files that do not exist."""
    import export_collector_validator_v2 as collector
    for source, prefix in wd.CENTROID_SOURCES.items():
        assert source in collector.SOURCES, f'{source} is not a collector source'
        assert collector.SOURCES[source]['prefix'] == prefix, (
            f"{source}: watchdog has {prefix!r}, "
            f"collector has {collector.SOURCES[source]['prefix']!r}")
    assert set(wd.CENTROID_SOURCES) == set(collector.CENTROID_VARIANTS), (
        'the watchdog must watch exactly the 7 centroid variants')


def test_timeframes_match_collector():
    import export_collector_validator_v2 as collector
    assert wd.TF_SECONDS == collector.TF_SECONDS
    assert wd.SYMBOL == collector.SYMBOL


if __name__ == '__main__':
    failures = 0
    for name, fn in sorted(globals().items()):
        if not name.startswith('test_') or not callable(fn):
            continue
        try:
            fn()
            print(f'PASS  {name}')
        except AssertionError as exc:
            failures += 1
            print(f'FAIL  {name}: {exc}')
        except Exception as exc:                        # noqa: BLE001
            failures += 1
            print(f'ERROR {name}: {type(exc).__name__}: {exc}')
    print(f'\n{"FAILED" if failures else "OK"} - {failures} failure(s)')
    sys.exit(1 if failures else 0)
