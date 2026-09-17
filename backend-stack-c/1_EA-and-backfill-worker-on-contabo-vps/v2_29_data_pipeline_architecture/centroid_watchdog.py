#!/usr/bin/env python3
"""Centroid Watchdog Daemon (v1.0) -- Pillar 2 of
ARCH-SPEC-2026-09-18-V2.29-FROZEN-ALERT.

Watches the HOT STANDBY terminal's `_Statistic.txt` exports and tells the
administrator, once, when a genuinely new market centroid has formed and
stabilised -- so nobody has to sit and stare at MetaTrader charts waiting for a
regime transition.

WHAT IT IS NOT
--------------
It does not touch the collector, the database, the push worker, or the active
terminal. It opens no sqlite file and holds no lock. It only READS `.txt` files
from the standby export directory and POSTs to a webhook. A crash here cannot
delay or reject a single market_data row -- the same isolation principle
currency_gold_index_engine.py follows, and the reason this is a separate service
rather than another stage inside the collector.

THE TRIGGER, AND WHY IT IS TIMESTAMPS AND NOT A COUNT
-----------------------------------------------------
In a 3000-bar sliding window an ancient cluster can drop out of the calculation
window in the SAME cycle a new one forms at the right edge. The centroid count
is then unchanged (5 -> 5) and a count-based trigger misses it entirely -- a
false negative, the worst kind, because nothing looks wrong. Bar time is
strictly monotonic, so "a centroid exists whose timestamp we have never seen"
is unambiguous. That is the invariant this daemon watches.

THE DEBOUNCE, AND WHY IT COUNTS BARS AND NOT SECONDS
----------------------------------------------------
A forming centroid flickers. The 5th SSA crossing can appear on an unclosed
candle, wobble across the DBSCAN epsilon radius, and vanish again if price pulls
back before the close. Alerting on that produces exactly the alert fatigue this
daemon exists to remove.

So a candidate must survive CONFIRM_BARS *closed bars*. That is measured from
`Live Bar TS (UTC)` inside the export -- MT5's own bar clock -- and deliberately
NOT from a wall-clock stopwatch. A stopwatch keeps running over a weekend when
no bar ever closes, so a candidate seen once on Friday evening would "mature"
against a shut market and fire on Sunday. Bar time only advances when a bar
actually forms, which is the thing being measured.

And presence must be CONSECUTIVE: any poll in which the candidate is absent
drops it back to DORMANT. Counting total sightings instead would let a candidate
that was missing for most of the window still confirm, which defeats the whole
purpose of debouncing.

CENTROID DRIFT
--------------
A centroid is a cluster's centre of mass, so its timestamp MOVES as points join
the cluster. A candidate first seen at T can legitimately be reported at T+1 bar
on the next poll. Treating that as a different centroid would reset the debounce
every cycle and nothing would ever confirm. Candidates are therefore matched to
the nearest reported centroid within DRIFT_TOLERANCE_BARS, which is the
specification's "temporal coordinate stabilises (dT <= 1 bar between cycles)"
rule made operational.

RESTART SAFETY
--------------
State is persisted. On the FIRST observation of a (source, timeframe) the
currently reported centroids are recorded as already-known and nothing is
alerted -- otherwise every restart of this service would announce the centroid
the administrator has been looking at all week as brand new.

Run:
    python centroid_watchdog.py                   # daemon
    python centroid_watchdog.py --once            # a single poll, then exit
    python centroid_watchdog.py --once --dry-run  # ... and never POST anything
"""
import argparse
import json
import logging
import os
import signal
import time
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ============================================================
# CONFIGURATION
# ============================================================
SYMBOL = 'XAUUSD'
TIMEFRAMES = ['M5', 'M15']
TF_SECONDS = {'M5': 300, 'M15': 900}

# Export-file prefixes for the 7 centroid indicators. Duplicated from
# export_collector_validator_v2.py's SOURCES registry ON PURPOSE: importing the
# collector would couple this daemon's startup to the collector's module-level
# code, and the entire point of a separate process is that neither can break the
# other. test_centroid_watchdog.py asserts these still match that registry, so
# the duplication is checked rather than merely hoped for.
CENTROID_SOURCES: Dict[str, str] = {
    'best_fit_a':  'Centriod_Best_Fit_A',
    'best_fit_b':  'Centriod_Best_Fit_B',
    'cherry_a':    'Cherry-Pick-A',
    'cherry_b':    'Cherry-Pick-B',
    'most_recent': 'Most-Recent',
    'non_a':       'Non-Recent-A',
    'non_b':       'Non-Recent-B',
}

STANDBY_DIR = Path(os.environ.get('WATCHDOG_STANDBY_DIR', 'C:/MT5-B/MQL5/Files'))
ACTIVE_DIR = Path(os.environ.get('WATCHDOG_ACTIVE_DIR', 'C:/MT5-A/MQL5/Files'))
STATE_PATH = Path(os.environ.get('WATCHDOG_STATE_PATH',
                                 'C:/Scripts/database/centroid_watchdog_state.json'))
LOG_DIR = Path(os.environ.get('WATCHDOG_LOG_DIR', 'C:/Scripts/logs'))

WEBHOOK_URL = os.environ.get('ADMIN_ALERT_WEBHOOK_URL', '')
# 'generic'  -> POST the payload below as-is (spec section 4.4)
# 'discord'  -> wrap in {"content": ...} so a Discord webhook renders it
# 'telegram' -> Bot API sendMessage form; needs ADMIN_ALERT_TELEGRAM_CHAT_ID
WEBHOOK_FORMAT = os.environ.get('ADMIN_ALERT_WEBHOOK_FORMAT', 'generic').lower()
TELEGRAM_CHAT_ID = os.environ.get('ADMIN_ALERT_TELEGRAM_CHAT_ID', '')

POLL_INTERVAL_SEC = int(os.environ.get('WATCHDOG_POLL_INTERVAL_SEC', '15'))

# Closed bars a candidate must survive before it is announced. Section 4.3's
# "2 consecutive closed bars" on M5 = 10 minutes of confirmed persistence.
CONFIRM_BARS = int(os.environ.get('WATCHDOG_CONFIRM_BARS', '2'))

# Section 4.3's point-count criterion: N >= InpMinPts + 1. A cluster sitting
# exactly ON the DBSCAN minimum is the one that flickers; one point of headroom
# is what distinguishes "formed" from "forming".
MIN_POINTS = int(os.environ.get('WATCHDOG_MIN_POINTS', '6'))

# How far a candidate's own timestamp may move between polls and still be the
# same centroid (see CENTROID DRIFT above).
DRIFT_TOLERANCE_BARS = int(os.environ.get('WATCHDOG_DRIFT_TOLERANCE_BARS', '1'))

# A candidate that never reaches MIN_POINTS is eventually filed as known rather
# than tracked forever. It is a real centroid that stayed marginal; the
# administrator does not need to be told about it.
CANDIDATE_MAX_BARS = int(os.environ.get('WATCHDOG_CANDIDATE_MAX_BARS', '12'))

# A running MT5 terminal rewrites every _Statistic.txt once a minute from
# OnTimer(), independently of ticks and of market hours. So a file that has not
# been rewritten in this long means the terminal is not exporting -- which for a
# watchdog is the dangerous state, because a frozen file looks exactly like a
# quiet market. 15 minutes matches promote_terminal.bat's own pre-flight check.
STALE_FILE_MINUTES = int(os.environ.get('WATCHDOG_STALE_FILE_MINUTES', '15'))

HTTP_TIMEOUT_SEC = 8
# Bound the persisted history so the state file cannot grow without limit.
MAX_KNOWN_PER_SOURCE = 200


# ============================================================
# LOGGING / SHUTDOWN
# ============================================================
def setup_logging() -> logging.Logger:
    lg = logging.getLogger('centroid_watchdog')
    lg.setLevel(logging.INFO)
    ch = logging.StreamHandler()
    ch.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    lg.addHandler(ch)
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        fh = RotatingFileHandler(LOG_DIR / 'centroid_watchdog.log',
                                 maxBytes=10 * 1024 * 1024, backupCount=5,
                                 encoding='utf-8')
        fh.setFormatter(logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
        lg.addHandler(fh)
    except OSError as e:                                        # noqa: BLE001
        # A watchdog that refuses to start because it cannot open a log file is
        # worse than one that logs to the console only.
        lg.warning(f"File logging disabled ({e})")
    return lg


logger = setup_logging()
shutdown_requested = False


def _signal_handler(signum, frame):
    global shutdown_requested
    logger.info("Shutdown requested...")
    shutdown_requested = True


signal.signal(signal.SIGINT, _signal_handler)
signal.signal(signal.SIGTERM, _signal_handler)


# ============================================================
# PARSING
# ============================================================
def _csv_ints(raw: str) -> List[int]:
    return [int(float(p)) for p in raw.split(',') if p.strip() != '']


def _csv_floats(raw: str) -> List[float]:
    return [float(p) for p in raw.split(',') if p.strip() != '']


def _maybe_float(raw: Optional[str]) -> Optional[float]:
    if raw is None or raw.strip() == '':
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def parse_stat_file(path: Path) -> Optional[dict]:
    """Read one `_Statistic.txt` into the subset this daemon needs.

    Deliberately its own parser rather than the collector's: that one maps into
    staging columns for the database and knows nothing about [CENTROIDS_DETAIL].
    It shares the same three real quirks of the format, handled here for the
    same reasons documented there:

      * files are written FILE_ANSI, so an em-dash in a section header arrives
        mangled -- match sections by PREFIX, never by the full literal;
      * keys contain spaces, digits and parentheses -- split on the FIRST ':';
      * a key is only unique WITHIN a section ('R-Square' appears in both model
        blocks), so the parser must be section-aware.

    Returns None rather than raising for ANY unusable file. MT5 rewrites these
    with FILE_WRITE, which truncates first, so a poll can genuinely catch a
    half-written file; the next poll will get a whole one. Guessing at a partial
    file is how a watchdog invents an event that never happened.
    """
    try:
        text = path.read_text(encoding='utf-8', errors='replace')
    except OSError as e:                                        # noqa: BLE001
        logger.debug(f"{path.name}: unreadable ({e})")
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

    def get(label: str, sect_prefix: Optional[str] = None) -> Optional[str]:
        if sect_prefix is None:
            for (_s, l), v in seen.items():
                if l == label:
                    return v
            return None
        for (s, l), v in seen.items():
            if l == label and s.startswith(sect_prefix):
                return v
        return None

    det = '[CENTROIDS_DETAIL'
    live_bar_raw = get('Live Bar TS (UTC)', det)
    if live_bar_raw is None or live_bar_raw.strip() == '':
        # Either a pre-upgrade binary or a truncated read. Both mean "do not
        # reason about this file".
        return None

    try:
        live_bar_ts = int(float(live_bar_raw))
        times = _csv_ints(get('Centroid Timestamps (UTC)', det) or '')
        prices = _csv_floats(get('Centroid Prices', det) or '')
        points = _csv_ints(get('Centroid Points', det) or '')
        total = int(float(get('Centroid Count', det) or '0'))
    except (TypeError, ValueError) as e:                        # noqa: BLE001
        logger.debug(f"{path.name}: malformed [CENTROIDS_DETAIL] ({e})")
        return None

    if not (len(times) == len(prices) == len(points)):
        # Three parallel CSVs that disagree on length is corruption, not data.
        logger.debug(f"{path.name}: centroid CSVs disagree "
                     f"({len(times)}/{len(prices)}/{len(points)}) -- skipping")
        return None

    return {
        'live_bar_ts': live_bar_ts,
        'centroid_total': total,
        # Newest first, exactly as exported.
        'centroids': [{'ts': t, 'price': p, 'points': n}
                      for t, p, n in zip(times, prices, points)],
        'raw_slope': _maybe_float(get('Raw Slope (b)')),
        'anchored_y_int': _maybe_float(get('Anchored Y-Int')),
        'model_a_r2': _maybe_float(get('R-Square', '[MODEL A')),
        'uoedt_offset': _maybe_float(get('UOEDT Offset', '[EDT CHANNEL')),
        'loedt_offset': _maybe_float(get('LOEDT Offset', '[EDT CHANNEL')),
        'containment_rate': _maybe_float(get('Containment Rate', '[EDT CHANNEL')),
        # Present only once Pillar 1 ships; None on a pre-upgrade binary.
        'projection_mode': get('Projection Mode', '[FROZEN_SNAPSHOT'),
    }


# ============================================================
# STATE (persisted; see RESTART SAFETY in the module docstring)
# ============================================================
def _blank_source_state() -> dict:
    return {'seeded': False, 'known': [], 'alerted': [], 'candidates': {},
            'last_bar_ts': 0}


def load_state(path: Path) -> dict:
    try:
        state = json.loads(path.read_text(encoding='utf-8'))
        if not isinstance(state, dict):
            raise ValueError('state root is not an object')
        state.setdefault('sources', {})
        state.setdefault('standby_stale_alerted', False)
        return state
    except FileNotFoundError:
        return {'sources': {}, 'standby_stale_alerted': False}
    except (OSError, ValueError, json.JSONDecodeError) as e:    # noqa: BLE001
        # A corrupt state file must not wedge the daemon, but silently starting
        # from blank would re-seed and therefore MISS the next centroid. Say so
        # loudly: re-seeding is a real, if brief, loss of coverage.
        logger.error(f"State file unusable ({e}) -- starting blank and RE-SEEDING. "
                     f"A centroid forming right now will be treated as known.")
        return {'sources': {}, 'standby_stale_alerted': False}


def save_state(path: Path, state: dict) -> None:
    """Write atomically. A half-written state file is a corrupt state file, and
    a corrupt state file costs a re-seed (see load_state)."""
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + '.tmp')
        tmp.write_text(json.dumps(state, indent=2, sort_keys=True), encoding='utf-8')
        os.replace(tmp, path)
    except OSError as e:                                        # noqa: BLE001
        logger.error(f"Could not persist state ({e}) -- duplicate alerts are "
                     f"possible after a restart")


# ============================================================
# THE STATE MACHINE
# ============================================================
def _near(a: int, b: int, tol_sec: int) -> bool:
    return abs(a - b) <= tol_sec


def process_source(src_state: dict, source: str, timeframe: str,
                   data: dict) -> List[dict]:
    """Advance one (source, timeframe)'s automaton by one poll.

    Returns the confirmations produced by THIS poll (usually none). Mutates
    src_state in place. Pure apart from logging -- no I/O, no clock, no network;
    everything it needs arrives in `data`. That is what makes the debounce
    testable without waiting ten real minutes for a bar to close.
    """
    tf_sec = TF_SECONDS[timeframe]
    tol = DRIFT_TOLERANCE_BARS * tf_sec
    bar_ts = data['live_bar_ts']
    reported = data['centroids']
    confirmations: List[dict] = []

    if not src_state['seeded']:
        src_state['known'] = sorted({c['ts'] for c in reported})[-MAX_KNOWN_PER_SOURCE:]
        src_state['seeded'] = True
        src_state['last_bar_ts'] = bar_ts
        logger.info(f"[{source}/{timeframe}] seeded with {len(src_state['known'])} "
                    f"existing centroid(s) -- not alerting on any of them")
        return confirmations

    # A terminal restarted against a shorter history can report an OLDER live
    # bar. Never let that drive negative elapsed-bar arithmetic.
    if bar_ts < src_state['last_bar_ts']:
        logger.warning(f"[{source}/{timeframe}] live bar went backwards "
                       f"({src_state['last_bar_ts']} -> {bar_ts}); resetting candidates")
        src_state['candidates'] = {}
    src_state['last_bar_ts'] = bar_ts

    known = list(src_state['known'])
    cands: Dict[str, dict] = src_state['candidates']
    matched_ts = set()

    # --- FORMING: match each live candidate to a reported centroid -----------
    for cid in list(cands.keys()):
        cand = cands[cid]
        best = None
        for c in reported:
            if c['ts'] in matched_ts:
                continue
            if _near(c['ts'], cand['ts'], tol):
                if best is None or abs(c['ts'] - cand['ts']) < abs(best['ts'] - cand['ts']):
                    best = c
        if best is None:
            # FORMING -> DORMANT. The crossing was invalidated before the close;
            # this is precisely the flicker the debounce exists to absorb.
            logger.info(f"[{source}/{timeframe}] candidate {cand['ts']} vanished "
                        f"after {cand['polls']} poll(s) -- discarded (flicker)")
            del cands[cid]
            continue
        matched_ts.add(best['ts'])
        cand['ts'] = best['ts']
        cand['price'] = best['price']
        cand['points'] = best['points']
        cand['peak_points'] = max(cand.get('peak_points', 0), best['points'])
        cand['polls'] += 1
        cand['last_bar_ts'] = bar_ts

    # --- DORMANT -> FORMING: anything reported that is neither known nor -----
    #     already being tracked.
    for c in reported:
        if c['ts'] in matched_ts:
            continue
        if any(_near(c['ts'], k, tol) for k in known):
            continue
        if any(_near(c['ts'], x['ts'], tol) for x in cands.values()):
            continue
        cands[str(c['ts'])] = {'ts': c['ts'], 'price': c['price'],
                               'points': c['points'], 'peak_points': c['points'],
                               'polls': 1, 'first_bar_ts': bar_ts,
                               'last_bar_ts': bar_ts}
        matched_ts.add(c['ts'])
        logger.info(f"[{source}/{timeframe}] NEW candidate centroid at {c['ts']} "
                    f"({c['points']} pts) -- debouncing for {CONFIRM_BARS} closed bar(s)")

    # --- FORMING -> CONFIRMED ------------------------------------------------
    for cid in list(cands.keys()):
        cand = cands[cid]
        bars = (bar_ts - cand['first_bar_ts']) // tf_sec
        if bars >= CONFIRM_BARS and cand['points'] >= MIN_POINTS:
            confirmations.append({
                'source': source, 'timeframe': timeframe,
                'centroid_time': cand['ts'], 'centroid_price': cand['price'],
                'points_in_cluster': cand['points'],
                'confirmed_after_bars': int(bars),
                'live_bar_ts': bar_ts,
            })
            known.append(cand['ts'])
            src_state['alerted'] = (src_state['alerted'] + [cand['ts']])[-MAX_KNOWN_PER_SOURCE:]
            logger.info(f"[{source}/{timeframe}] CONFIRMED centroid {cand['ts']} "
                        f"after {bars} closed bar(s), {cand['points']} pts")
            del cands[cid]
        elif bars >= CANDIDATE_MAX_BARS:
            # Real, but it never grew past the DBSCAN minimum. File it as known
            # rather than tracking it forever or announcing a marginal cluster.
            known.append(cand['ts'])
            logger.info(f"[{source}/{timeframe}] candidate {cand['ts']} aged out after "
                        f"{bars} bars with {cand['peak_points']} peak pts "
                        f"(< {MIN_POINTS}) -- filed as known, not alerted")
            del cands[cid]

    src_state['known'] = sorted(set(known))[-MAX_KNOWN_PER_SOURCE:]
    return confirmations


# ============================================================
# IMPACT ANALYSIS (what the administrator actually needs to decide)
# ============================================================
def _pct_delta(new: Optional[float], old: Optional[float]) -> Optional[float]:
    if new is None or old is None or old == 0:
        return None
    return round((new - old) / abs(old) * 100.0, 2)


def _channel_width(d: Optional[dict]) -> Optional[float]:
    if not d:
        return None
    uo, lo = d.get('uoedt_offset'), d.get('loedt_offset')
    if uo is None or lo is None:
        return None
    # Both offsets are SIGNED and baseline-relative -- UOEDT positive above,
    # LOEDT negative below -- so the width is their difference, never a sum.
    return round(uo - lo, 5)


def build_impact(active: Optional[dict], candidate: dict) -> dict:
    """Separate the trigger (a new centroid) from its consequences (what the
    line would become). The administrator is deciding whether to promote, and
    that decision is about the delta, not about the centroid itself."""
    aw, cw = _channel_width(active), _channel_width(candidate)
    active = active or {}
    return {
        'active_frozen_slope': active.get('raw_slope'),
        'candidate_new_slope': candidate.get('raw_slope'),
        'slope_delta_pct': _pct_delta(candidate.get('raw_slope'), active.get('raw_slope')),
        'active_r2': active.get('model_a_r2'),
        'candidate_r2': candidate.get('model_a_r2'),
        'active_containment_rate': active.get('containment_rate'),
        'candidate_containment_rate': candidate.get('containment_rate'),
        'active_channel_width': aw,
        'candidate_channel_width': cw,
        'channel_width_change_pct': _pct_delta(cw, aw),
        'active_projection_mode': active.get('projection_mode'),
    }


# ============================================================
# NOTIFICATION
# ============================================================
def create_http_session() -> requests.Session:
    session = requests.Session()
    retry = Retry(total=2, backoff_factor=0.5, status_forcelist=[502, 503, 504],
                  allowed_methods=["POST"], raise_on_status=False)
    adapter = HTTPAdapter(max_retries=retry, pool_connections=1, pool_maxsize=2)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


def _render_text(payload: dict) -> str:
    lines = [payload['title'], f"Symbol: {payload['symbol']}", ""]
    for c in payload.get('confirmations', []):
        cen = c['centroid']
        imp = c['impact_analysis']
        when = datetime.fromtimestamp(cen['centroid_time'], timezone.utc)
        lines.append(f"- {c['source']} / {c['timeframe']}: centroid at "
                     f"{when:%Y-%m-%d %H:%M} UTC, price {cen['centroid_price']}, "
                     f"{cen['points_in_cluster']} pts")
        if imp.get('slope_delta_pct') is not None:
            lines.append(f"    slope {imp['active_frozen_slope']} -> "
                         f"{imp['candidate_new_slope']} ({imp['slope_delta_pct']:+.2f}%)")
        if imp.get('channel_width_change_pct') is not None:
            lines.append(f"    channel width {imp['channel_width_change_pct']:+.2f}%")
    lines += ["", payload['action_required']]
    return "\n".join(lines)


def dispatch(session: requests.Session, payload: dict, dry_run: bool = False) -> bool:
    """POST the alert. Always log it in full FIRST: a webhook outage must not
    also lose the finding, and the log is then the administrator's fallback."""
    logger.info("ALERT PAYLOAD: " + json.dumps(payload, sort_keys=True))
    if dry_run:
        logger.info("dry-run: not dispatching")
        return True
    if not WEBHOOK_URL:
        logger.warning("ADMIN_ALERT_WEBHOOK_URL is not set -- alert logged only")
        return False

    if WEBHOOK_FORMAT == 'discord':
        body = {'content': _render_text(payload)[:1900]}
    elif WEBHOOK_FORMAT == 'telegram':
        if not TELEGRAM_CHAT_ID:
            logger.error("WEBHOOK_FORMAT=telegram but ADMIN_ALERT_TELEGRAM_CHAT_ID "
                         "is unset -- alert logged only")
            return False
        body = {'chat_id': TELEGRAM_CHAT_ID, 'text': _render_text(payload)[:4000],
                'disable_web_page_preview': True}
    else:
        body = payload

    try:
        resp = session.post(WEBHOOK_URL, json=body, timeout=HTTP_TIMEOUT_SEC)
        if 200 <= resp.status_code < 300:
            logger.info(f"Alert dispatched ({resp.status_code})")
            return True
        logger.error(f"Webhook returned HTTP {resp.status_code}: {resp.text[:300]}")
        return False
    except Exception as e:                                      # noqa: BLE001
        # Never propagate. A notification failure must not stop the watching.
        logger.error(f"Webhook dispatch failed: {e}")
        return False


# ============================================================
# POLL CYCLE
# ============================================================
def stat_path(directory: Path, source: str, timeframe: str) -> Path:
    return directory / f"{CENTROID_SOURCES[source]}_{SYMBOL}_{timeframe}_Statistic.txt"


def newest_mtime(directory: Path) -> Optional[float]:
    newest = None
    for source in CENTROID_SOURCES:
        for tf in TIMEFRAMES:
            try:
                m = stat_path(directory, source, tf).stat().st_mtime
            except OSError:
                continue
            if newest is None or m > newest:
                newest = m
    return newest


def check_standby_alive(state: dict, session: requests.Session,
                        now: float, dry_run: bool) -> bool:
    """A standby whose terminal died freezes its exports, and a frozen export
    looks exactly like a market that simply is not forming new centroids. That
    is the one failure this daemon cannot afford to be quiet about -- the same
    class of silent-staleness bug the collector's own stale-export guard exists
    for."""
    newest = newest_mtime(STANDBY_DIR)
    stale = newest is None or (now - newest) > STALE_FILE_MINUTES * 60
    was = state.get('standby_stale_alerted', False)

    if stale and not was:
        age = 'never seen' if newest is None else f"{(now - newest) / 60:.0f} min"
        logger.error(f"STANDBY EXPORTS ARE STALE (newest write: {age}). "
                     f"Centroid detection is BLIND until this is fixed.")
        dispatch(session, {
            'event': 'STANDBY_EXPORT_STALE',
            'title': 'Standby MT5 terminal is not exporting',
            'symbol': SYMBOL,
            'timestamp_utc': datetime.now(timezone.utc).isoformat(),
            'standby_dir': str(STANDBY_DIR),
            'newest_write_age_min': None if newest is None else round((now - newest) / 60, 1),
            'confirmations': [],
            'action_required': ('Centroid watching is BLIND. Check that the standby '
                                'terminal is running with charts attached and the '
                                'indicators exporting.'),
        }, dry_run)
        state['standby_stale_alerted'] = True
    elif not stale and was:
        logger.info("Standby exports are fresh again -- watching resumed")
        state['standby_stale_alerted'] = False
    return not stale


def poll_once(state: dict, session: requests.Session, dry_run: bool = False) -> int:
    """One full sweep of every watched (source, timeframe). Returns the number of
    confirmations announced."""
    now = time.time()
    if not check_standby_alive(state, session, now, dry_run):
        return 0

    confirmations: List[dict] = []
    for source in CENTROID_SOURCES:
        for tf in TIMEFRAMES:
            data = parse_stat_file(stat_path(STANDBY_DIR, source, tf))
            if data is None:
                continue
            key = f"{source}|{tf}"
            src_state = state['sources'].setdefault(key, _blank_source_state())
            for c in process_source(src_state, source, tf, data):
                active = parse_stat_file(stat_path(ACTIVE_DIR, source, tf))
                c['impact_analysis'] = build_impact(active, data)
                confirmations.append(c)

    if confirmations:
        # ONE notification, not one per source. All 7 variants watch the same
        # market, so a genuine regime change confirms in most of them within the
        # same cycle; sending 14 messages for one event is the alert fatigue this
        # daemon was built to remove.
        payload = {
            'event': 'NEW_CENTROID_CONFIRMED',
            'title': 'New Market Centroid Confirmed',
            'symbol': SYMBOL,
            'timestamp_utc': datetime.now(timezone.utc).isoformat(),
            'confirmations': [{
                'source': c['source'],
                'timeframe': c['timeframe'],
                'centroid': {
                    'centroid_time': c['centroid_time'],
                    'centroid_time_utc': datetime.fromtimestamp(
                        c['centroid_time'], timezone.utc).isoformat(),
                    'centroid_price': c['centroid_price'],
                    'points_in_cluster': c['points_in_cluster'],
                    'confirmed_after_bars': c['confirmed_after_bars'],
                },
                'impact_analysis': c['impact_analysis'],
            } for c in confirmations],
            'action_required': ('Inspect the Standby Terminal. Verify the visual fit, '
                                'then run promote_terminal.bat to promote it.'),
        }
        dispatch(session, payload, dry_run)
    return len(confirmations)


def main() -> None:
    ap = argparse.ArgumentParser(description='Centroid Watchdog Daemon')
    ap.add_argument('--once', action='store_true', help='run a single poll and exit')
    ap.add_argument('--dry-run', action='store_true', help='never POST; log only')
    args = ap.parse_args()

    logger.info("DavinTrade Centroid Watchdog starting")
    logger.info(f"Standby: {STANDBY_DIR} | Active: {ACTIVE_DIR} | State: {STATE_PATH}")
    logger.info(f"Confirm after {CONFIRM_BARS} closed bar(s), min {MIN_POINTS} pts, "
                f"drift tolerance {DRIFT_TOLERANCE_BARS} bar(s), poll {POLL_INTERVAL_SEC}s")
    if not WEBHOOK_URL and not args.dry_run:
        logger.warning("ADMIN_ALERT_WEBHOOK_URL is not set -- alerts will be LOGGED ONLY")

    state = load_state(STATE_PATH)
    session = create_http_session()

    if args.once:
        n = poll_once(state, session, args.dry_run)
        save_state(STATE_PATH, state)
        logger.info(f"Single poll complete ({n} confirmation(s))")
        return

    while not shutdown_requested:
        try:
            poll_once(state, session, args.dry_run)
            save_state(STATE_PATH, state)
        except Exception as e:                                  # noqa: BLE001
            # The loop outlives any single bad cycle. A watchdog that dies on a
            # malformed file is a watchdog that is not watching.
            logger.error(f"Poll failed: {e}", exc_info=True)
        for _ in range(POLL_INTERVAL_SEC):
            if shutdown_requested:
                break
            time.sleep(1)
    logger.info("Shutdown complete")


if __name__ == '__main__':
    main()
