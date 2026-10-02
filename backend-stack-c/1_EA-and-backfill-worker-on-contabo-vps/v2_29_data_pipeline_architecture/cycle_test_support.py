"""Shared fixtures for test_push_priority_order.py and test_cycle_manifest.py
(build step 2 part 3). Not a test file: nothing here runs on its own.

What these tests protect is easy to get wrong without any error: a worker that
sends a cycle's newest bars LAST still passes every ordinary test, because every
row eventually arrives. So the fixtures build the situation the problem lives in,
not a toy: the full 3,000-bar window of both timeframes, every row unsent (the
collector's INSERT OR REPLACE clears synced_at on all of them every cycle), and a
gateway that records the exact ORDER it was called in.
"""
import contextlib
import hashlib
import json
import logging
import sqlite3
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import backfill_worker_api_gateway_v5 as worker  # noqa: E402
import export_collector_validator_v2 as collector  # noqa: E402

SCHEMA = HERE / 'sqlite_schema_v6_xauusd.sql'

# The 18 Sep 2026 example cycle's day. SLOT_PLAIN is the 20:55 slot of the
# architecture's section 1.5 worked example: an M5-only slot. SLOT_REFRESH is
# the 21:00 slot, where M15 refreshes too (a multiple of 900).
SLOT_PLAIN = 1789764900
SLOT_REFRESH = 1789765200
assert SLOT_PLAIN % 300 == 0 and SLOT_PLAIN % 900 != 0
assert SLOT_REFRESH % 900 == 0

EXPORT_DIR = 'C:/MT5-A/MQL5/Files'
TF_SEC = {'M5': 300, 'M15': 900}
CENTROID_SOURCES = ('best_fit_a', 'best_fit_b', 'cherry_a', 'cherry_b', 'most_recent', 'non_a', 'non_b')


def fresh_db() -> sqlite3.Connection:
    conn = sqlite3.connect(':memory:')
    conn.executescript(SCHEMA.read_text(encoding='utf-8'))
    return conn


def add_cycle(conn, slot, timeframe, *, attempts=1, status='validated', export_mtime=None,
              newest_bar_ts=None, export_dir=EXPORT_DIR, finished=True, first_started_at=None) -> int:
    """Record a collection cycle for (slot, timeframe) as the collector would.

    `attempts` rows are written: the first attempts-1 rejected, the last with
    `status`. Each attempt starts 65 s after the previous, like the collector's
    retry wait. Returns the cycle_id of the LAST attempt.
    """
    started = (slot + 5) if first_started_at is None else first_started_at
    cycle_id = None
    for attempt in range(1, attempts + 1):
        last = attempt == attempts
        row_status = status if last else 'rejected'
        created_at = started + (attempt - 1) * collector.RETRY_WAIT_SEC
        facts = last and status == 'validated'
        cur = conn.execute(
            "INSERT INTO collection_cycles (cycle_time, timeframe, attempt, status, sources_received, "
            "created_at, validated_at, export_dir, export_mtime, newest_bar_ts, finished_at) "
            "VALUES (?, ?, ?, ?, 15, ?, ?, ?, ?, ?, ?)",
            (slot, timeframe, attempt, row_status, created_at,
             created_at + 20 if facts else None,
             export_dir if facts else None,
             (slot - 1 if export_mtime is None else export_mtime) if facts else None,
             newest_bar_ts if facts else None,
             created_at + 22 if (facts and finished) else None))
        cycle_id = cur.lastrowid
    conn.commit()
    return cycle_id


def add_bars(conn, timeframe, newest_ts, count, cycle_id, synced=False, synced_at=1789700000) -> list:
    """`count` consecutive bars ending at `newest_ts`, oldest to newest."""
    step = TF_SEC[timeframe]
    stamps = [newest_ts - i * step for i in range(count)][::-1]
    conn.executemany(
        "INSERT INTO market_data (timestamp, symbol, timeframe, open, high, low, close, volume, "
        "cycle_id, collected_at, synced_at) VALUES (?, 'XAUUSD', ?, 2650.0, 2651.0, 2649.0, 2650.5, 100, ?, ?, ?)",
        [(ts, timeframe, cycle_id, newest_ts, synced_at if synced else None) for ts in stamps])
    conn.commit()
    return stamps


def add_stats(conn, cycle_id, timeframe, slot, sources=None) -> None:
    """One statistics snapshot per source at the slot. `sources` maps a source to
    its Projection Mode (DYNAMIC, FROZEN) or None for a source without a mode."""
    if sources is None:
        sources = {'best_fit_a': 'DYNAMIC', 'non_b': 'FROZEN', 'sr_levels': None}
    for source, mode in sources.items():
        params = {'Observation Window': '1450'}
        if mode:
            params['Projection Mode'] = mode
        canonical = json.dumps(params, sort_keys=True, separators=(',', ':'))
        conn.execute(
            "INSERT INTO indicator_statistics (cycle_id, symbol, timeframe, source, captured_at, "
            "live_bar_ts, config_hash, config_params) VALUES (?, 'XAUUSD', ?, ?, ?, ?, ?, ?)",
            (cycle_id, timeframe, source, slot, slot,
             hashlib.sha256((source + timeframe + canonical).encode()).hexdigest(), canonical))
    conn.commit()


_WORLD_CACHE = {}


def build_world(slot=SLOT_PLAIN, **kwargs):
    """A fresh COPY of a cached world (see _build_world).

    A world is two 3,000-bar windows, and building one is the slow part of every
    test. Each test mutates its world, so it gets its own copy of the cached
    master (SQLite's backup API copies an in-memory database in milliseconds).
    """
    cache_key = (slot, tuple(sorted(kwargs.items())))
    if cache_key not in _WORLD_CACHE:
        _WORLD_CACHE[cache_key] = _build_world(slot, **kwargs)
    master, info = _WORLD_CACHE[cache_key]
    conn = sqlite3.connect(':memory:')
    master.backup(conn)
    conn.execute("PRAGMA foreign_keys = ON")           # a connection property, not copied by backup
    return conn, dict(info)


def _build_world(slot, *, m5_bars=3000, m15_bars=3000, stub=True, m5_attempts=1,
                 m15_attempts=1, with_stats=True, finished=True, m15_status='validated',
                 export_dir=EXPORT_DIR, export_mtime=None):
    """A database in the state the push worker finds it right after a cycle.

    Every row is unsent, as after the collector's INSERT OR REPLACE re-queue.
    `stub` True: the newest row is the bar that has just opened at the slot (a
    stub); False: it is the bar that is about to close / has just closed, so the
    newest row is already a closed bar. On a slot that does not refresh M15 the
    M15 rows exist but are already synced and no M15 cycle belongs to the slot.
    Returns (conn, info) with the cycle ids and newest bar times.

    trg_market_data_prune is dropped from the fixture: on every inserted row it
    re-scans up to 3,000 rows, which makes a 6,000-row world take seconds, and
    nothing in these tests is about retention. (Retention has its own coverage in
    the schema; the trigger only ever deletes rows that are already synced.)
    """
    conn = fresh_db()
    conn.execute("DROP TRIGGER IF EXISTS trg_market_data_prune")
    refresh = slot % 900 == 0
    m5_newest = slot if stub else slot - 300
    m15_forming = (slot // 900) * 900
    m15_newest = m15_forming if stub else m15_forming - 900
    info = {'slot': slot, 'refresh': refresh, 'm5_newest': m5_newest, 'm15_newest': m15_newest}

    info['m5_cycle'] = add_cycle(conn, slot, 'M5', attempts=m5_attempts, newest_bar_ts=m5_newest,
                                 export_dir=export_dir, export_mtime=export_mtime, finished=finished)
    add_bars(conn, 'M5', m5_newest, m5_bars, info['m5_cycle'])
    if with_stats:
        add_stats(conn, info['m5_cycle'], 'M5', slot)

    if refresh:
        info['m15_cycle'] = add_cycle(conn, slot, 'M15', attempts=m15_attempts, status=m15_status,
                                      newest_bar_ts=m15_newest, export_dir=export_dir,
                                      export_mtime=export_mtime, finished=finished)
        add_bars(conn, 'M15', m15_newest, m15_bars, info['m15_cycle'])
        if with_stats and m15_status == 'validated':
            add_stats(conn, info['m15_cycle'], 'M15', slot)
    else:
        # M15 was last collected at the previous refresh slot and is already synced.
        prior = slot - (slot % 900)
        info['m15_cycle'] = add_cycle(conn, prior, 'M15', newest_bar_ts=m15_newest, export_dir=export_dir)
        add_bars(conn, 'M15', m15_newest, m15_bars, info['m15_cycle'], synced=True)
    return conn, info


class FakeResponse:
    def __init__(self, status_code, text='gateway said no'):
        self.status_code = status_code
        self.text = text
        self.headers = {}

    def json(self):
        return {'message': self.text}


class FakeSession:
    """A gateway that records every POST in the order it arrived.

    `rules` is a list of callables rule(kind, n, body) -> None (answer 200), an
    int (answer with that status) or an Exception instance (raise it). `kind` is
    'row', 'stats', 'events' or 'manifest'; `n` counts the POSTs of that kind
    so far, from 0.
    """

    def __init__(self, *rules):
        self.posts = []            # (kind, body)
        self.rules = list(rules)
        self.counts = {}

    @staticmethod
    def kind_of(url):
        if url.endswith('/api/v1/market-data'):
            return 'row'
        if url.endswith('/api/v1/indicator-statistics'):
            return 'stats'
        if url.endswith('/api/v1/economic-events'):
            return 'events'
        if url.endswith('/api/v1/cycle-manifest'):
            return 'manifest'
        raise AssertionError(f'unexpected URL {url}')

    def post(self, url, json=None, timeout=None):
        kind = self.kind_of(url)
        n = self.counts.get(kind, 0)
        self.counts[kind] = n + 1
        self.posts.append((kind, json))
        for rule in self.rules:
            outcome = rule(kind, n, json)
            if outcome is None:
                continue
            if isinstance(outcome, Exception):
                raise outcome
            return FakeResponse(outcome)
        return FakeResponse(200)

    # convenience views
    def kinds(self):
        return [k for k, _ in self.posts]

    def rows(self):
        return [b for k, b in self.posts if k == 'row']

    def manifests(self):
        return [b for k, b in self.posts if k == 'manifest']


def always(kind_wanted, outcome, from_n=0):
    """Rule: answer `outcome` to every POST of `kind_wanted` from the n-th on."""
    def rule(kind, n, body):
        return outcome if kind == kind_wanted and n >= from_n else None
    return rule


@contextlib.contextmanager
def isolated_worker():
    """Run the worker without delays and without writing outside a temp folder.

    The quarantine files default to C:/Scripts/database; module-level state the
    worker keeps between calls is reset, so one test cannot leak into the next.
    """
    saved = {name: getattr(worker, name) for name in (
        'INTER_ROW_DELAY_SEC', 'REJECTED_ROWS_FILE', 'REJECTED_MANIFESTS_FILE',
        'REJECTED_STATS_FILE', 'REJECTED_EVENTS_FILE', 'shutdown_requested')}
    with tempfile.TemporaryDirectory() as d:
        tmp = Path(d)
        worker.INTER_ROW_DELAY_SEC = 0
        worker.REJECTED_ROWS_FILE = tmp / 'rejected_rows.jsonl'
        worker.REJECTED_MANIFESTS_FILE = tmp / 'rejected_manifests.jsonl'
        worker.REJECTED_STATS_FILE = tmp / 'rejected_statistics.jsonl'
        worker.REJECTED_EVENTS_FILE = tmp / 'rejected_economic_events.jsonl'
        worker.shutdown_requested = False
        worker._priority_quarantined.clear()
        worker._cycle_facts_warned = False
        worker._manifest_table_warned = False
        try:
            yield tmp
        finally:
            for name, value in saved.items():
                setattr(worker, name, value)
            worker._priority_quarantined.clear()
            worker._cycle_facts_warned = False
            worker._manifest_table_warned = False


@contextlib.contextmanager
def captured_warnings():
    """The WARNING records the worker logs inside the block."""
    records = []

    class _Handler(logging.Handler):
        def emit(self, record):
            records.append(record)

    handler = _Handler(level=logging.WARNING)
    worker.logger.addHandler(handler)
    try:
        yield records
    finally:
        worker.logger.removeHandler(handler)
