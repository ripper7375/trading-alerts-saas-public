"""Tests for the MT5Renderer upload worker (rule 8, ADR-014).

Run: python -m pytest test_mtf_render_upload_worker.py   (or: python test_mtf_render_upload_worker.py)

What matters here, in order:

  1. the LAST GOOD IMAGE IS KEPT: no render, no upload; a failed render, a missing
     variant, a truncated file, a failed upload, all leave the objects in R2 exactly
     as they were;
  2. the image is stamped with the slot it was drawn for, in the R2 metadata;
  3. rendering is driven by the cycle (a new validated M5 slot), not by the clock;
  4. the gateway decides the indicators when it can, FOR THE SLOT BEING RENDERED,
     and every way it can fail falls back cleanly to RENDER_OVERLAYS and says so.

R2 is replaced by an in-memory fake that behaves like S3 where it matters: an upload
either replaces the whole object or leaves the old one untouched.
"""

from __future__ import annotations

import hashlib
import importlib
import json
import os
import re
import socket
import sqlite3
import subprocess
import sys
import tempfile
import urllib.error
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest import mock

import mtf_render_upload_worker as w
from mtf_render.fixture import build_fixture_db
from mtf_render.overlays import OVERLAY_KEYS
from mtf_render.stamp import METADATA_KEYS, SLOT_SECONDS, parse_metadata

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
LIVE_SCHEMA = HERE.parent / "v2_29_data_pipeline_architecture" / "sqlite_schema_v6_xauusd.sql"
GATEWAY_FIXTURES = REPO / "railway-gateway" / "test" / "fixtures"

SLOT = 1789764900
GATEWAY_URL = "https://gateway.example.test"
GATEWAY_KEY = "k" * 32


# ------------------------------------------------------------------- test doubles


def good_png(size: int = 4096) -> bytes:
    body = w.PNG_SIGNATURE + b"\x00" * (size - len(w.PNG_SIGNATURE) - len(w.PNG_IEND))
    return body + w.PNG_IEND


class FakeS3:
    """R2 as far as the worker uses it. A failed upload leaves the old object whole."""

    def __init__(self) -> None:
        self.objects: dict[str, dict] = {}
        self.upload_calls: list[dict] = []
        self.deleted: list[str] = []
        self.fail_keys: set[str] = set()

    def seed(self, key: str, body: bytes, metadata: dict, age_hours: float = 0.0) -> None:
        self.objects[key] = {
            "body": body,
            "meta": dict(metadata),
            "modified": datetime.now(timezone.utc) - timedelta(hours=age_hours),
        }

    def upload_file(self, filename, bucket, key, ExtraArgs=None):  # noqa: N803 - boto3's name
        self.upload_calls.append({"filename": filename, "bucket": bucket, "key": key, "extra": dict(ExtraArgs or {})})
        if key in self.fail_keys:
            raise RuntimeError("simulated R2 failure")  # before anything is replaced: a PUT is atomic
        self.objects[key] = {
            "body": Path(filename).read_bytes(),
            "meta": dict((ExtraArgs or {}).get("Metadata", {})),
            "modified": datetime.now(timezone.utc),
        }

    def get_paginator(self, name):
        assert name == "list_objects_v2"
        store = self

        class Paginator:
            def paginate(self, Bucket, Prefix):  # noqa: N803
                yield {"Contents": [
                    {"Key": k, "LastModified": v["modified"]}
                    for k, v in store.objects.items() if k.startswith(Prefix)
                ]}

        return Paginator()

    def delete_object(self, Bucket, Key):  # noqa: N803
        self.deleted.append(Key)
        self.objects.pop(Key, None)

    def snapshot(self) -> dict:
        return {k: (v["body"], dict(v["meta"])) for k, v in self.objects.items()}


class FakeResponse:
    def __init__(self, body: bytes, status: int = 200) -> None:
        self._body = body
        self.status = status

    def read(self) -> bytes:
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def gateway(body=None, status=200, raises=None):
    """A stand-in for urllib's urlopen that records what it was asked."""
    calls: list[dict] = []

    def urlopen(request, timeout=None):
        calls.append({"url": request.full_url, "headers": dict(request.header_items()), "timeout": timeout})
        if raises is not None:
            raise raises
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        return FakeResponse(data, status)

    urlopen.calls = calls  # type: ignore[attr-defined]
    return urlopen


@contextmanager
def configured(url: str = GATEWAY_URL, key: str = GATEWAY_KEY, overlays: str = "best_fit_a"):
    with mock.patch.multiple(w, API_GATEWAY_URL=url, GATEWAY_API_KEY=key, OVERLAYS=overlays):
        yield


def gateway_answer(slot: int = SLOT, m5: str | None = "cherry_a", m15: str | None = "non_b", **overrides) -> dict:
    def record(timeframe, source):
        if source is None:
            return None
        return {"settingId": f"s_{timeframe}", "timeframe": timeframe, "source": source,
                "effectiveSlot": 0, "setBy": "migration", "reason": None, "createdAt": 1700000000}

    body = {
        "contract": "cycles-current/1",
        "now": slot + 20,
        "cycle": None,
        "dataStatus": {"status": "FRESH", "reason": "CYCLE_READY_IN_TIME", "dataAsOfSlot": slot - 300, "secondsSinceReady": 7},
        "activeIndicators": {
            "resolvedAtSlot": slot,
            "basis": "REQUESTED_SLOT",
            "byTimeframe": {"M5": record("M5", m5), "M15": record("M15", m15)},
        },
    }
    body.update(overrides)
    return body


def make_db(cycles: list[tuple]) -> str:
    """A temp xauusd.db with the REAL collection_cycles table and the given rows
    (cycle_time, timeframe, status[, attempt])."""
    sql = LIVE_SCHEMA.read_text(encoding="utf-8", errors="replace")
    match = re.search(r"CREATE TABLE IF NOT EXISTS collection_cycles\s*\((.*?)\n\);", sql, re.S | re.I)
    assert match, "could not find collection_cycles in the live schema"
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    conn = sqlite3.connect(path)
    conn.execute(f"CREATE TABLE collection_cycles ({match.group(1)}\n)")
    for row in cycles:
        cycle_time, timeframe, status = row[0], row[1], row[2]
        attempt = row[3] if len(row) > 3 else 1
        conn.execute(
            "INSERT INTO collection_cycles (cycle_time, timeframe, attempt, status, created_at) VALUES (?,?,?,?,?)",
            (cycle_time, timeframe, attempt, status, cycle_time + 5),
        )
    conn.commit()
    conn.close()
    return path


def remove(path: str) -> None:
    try:
        os.remove(path)
    except OSError:
        pass


def overlays(m5="best_fit_a", m15="non_b", source="setting") -> "w.ChosenOverlays":
    return w.ChosenOverlays(m5=m5, m15=m15, source=source)


def fake_render(calls: list | None = None, variants=("overlay", "standard"), body: bytes | None = None):
    def render(out_dir, slot, chosen, rendered_at):
        if calls is not None:
            calls.append((out_dir, slot, chosen, rendered_at))
        out = {}
        for variant in variants:
            path = Path(out_dir) / f"{w.OUT_STEM}_{variant}.png"
            path.write_bytes(good_png() if body is None else body)
            out[variant] = path
        return out

    return render


def seeded_s3(slot: int = SLOT - 300) -> FakeS3:
    """R2 holding the previous good pair, stamped for `slot`."""
    s3 = FakeS3()
    for variant in w.VARIANTS:
        stamp = w.build_stamps(slot, overlays(), slot + 70)[variant]
        s3.seed(w.object_key(variant), b"OLD-" + variant.encode(), stamp.object_metadata())
    return s3


def raises(exc_type, fn) -> bool:
    try:
        fn()
    except exc_type:
        return True
    return False


# ============================================================ the trigger (SQLite)


def test_the_trigger_query_is_exactly_the_agreed_one() -> None:
    assert w.LATEST_VALIDATED_SQL == (
        "SELECT cycle_time FROM collection_cycles "
        "WHERE timeframe = 'M5' AND status = 'validated' "
        "ORDER BY cycle_time DESC LIMIT 1"
    )


def test_latest_validated_slot_is_the_newest_validated_m5_cycle() -> None:
    db = make_db([(SLOT - 600, "M5", "validated"), (SLOT - 300, "M5", "validated"), (SLOT, "M5", "validated")])
    try:
        assert w.latest_validated_slot(db) == SLOT
    finally:
        remove(db)


def test_cycles_that_are_not_validated_do_not_count() -> None:
    db = make_db([
        (SLOT - 300, "M5", "validated"),
        (SLOT, "M5", "rejected"),
        (SLOT + 300, "M5", "validating"),
        (SLOT + 600, "M5", "collecting"),
    ])
    try:
        assert w.latest_validated_slot(db) == SLOT - 300
    finally:
        remove(db)


def test_m15_cycles_do_not_trigger_a_render() -> None:
    db = make_db([(SLOT - 300, "M5", "validated"), (SLOT, "M15", "validated"), (SLOT + 300, "M15", "validated")])
    try:
        assert w.latest_validated_slot(db) == SLOT - 300
    finally:
        remove(db)


def test_a_slot_that_validated_on_a_retry_counts_once_as_that_slot() -> None:
    db = make_db([(SLOT, "M5", "rejected", 1), (SLOT, "M5", "rejected", 2), (SLOT, "M5", "validated", 3)])
    try:
        assert w.latest_validated_slot(db) == SLOT
    finally:
        remove(db)


def test_no_validated_cycle_is_none() -> None:
    db = make_db([(SLOT, "M5", "rejected"), (SLOT, "M15", "validated")])
    empty = make_db([])
    try:
        assert w.latest_validated_slot(db) is None
        assert w.latest_validated_slot(empty) is None
    finally:
        remove(db)
        remove(empty)


def test_the_database_is_opened_read_only_and_never_changed() -> None:
    db = make_db([(SLOT, "M5", "validated")])
    try:
        before = hashlib.sha256(Path(db).read_bytes()).hexdigest()
        with mock.patch.object(w.sqlite3, "connect", wraps=sqlite3.connect) as spy:
            w.latest_validated_slot(db)
        (uri,), kwargs = spy.call_args
        assert "mode=ro" in uri and uri.startswith("file:") and kwargs.get("uri") is True
        assert hashlib.sha256(Path(db).read_bytes()).hexdigest() == before
        # and a connection opened the way the worker opens it cannot write
        conn = sqlite3.connect(uri, uri=True)
        try:
            assert raises(sqlite3.OperationalError, lambda: conn.execute(
                "INSERT INTO collection_cycles (cycle_time, timeframe, status, created_at) VALUES (1,'M5','validated',1)"))
        finally:
            conn.close()
    finally:
        remove(db)


def test_a_missing_database_raises_instead_of_creating_one() -> None:
    missing = os.path.join(tempfile.gettempdir(), "does_not_exist_mtf_test.db")
    assert not os.path.exists(missing)
    assert raises(sqlite3.OperationalError, lambda: w.latest_validated_slot(missing))
    assert not os.path.exists(missing)


# ====================================================== the loop: what it renders


class Recorder:
    def __init__(self, fail_slots: set | None = None) -> None:
        self.published: list[int] = []
        self.fail_slots = fail_slots if fail_slots is not None else set()

    def __call__(self, client, slot):
        if slot in self.fail_slots:
            raise RuntimeError("render failed")
        self.published.append(slot)


def poll(state, slots, publish, now=lambda: 1000.0):
    """poll_once with the database replaced by a list of what it would answer."""
    answers = iter(slots)
    return w.poll_once(object(), state, now=now, latest=lambda _path: next(answers), publish=publish)


def test_with_no_prior_slot_it_renders_the_newest_validated_cycle_once() -> None:
    rec = Recorder()
    state = w.RenderState()
    assert poll(state, [SLOT], rec) == "rendered"
    assert rec.published == [SLOT]
    assert state.last_rendered_slot == SLOT


def test_it_renders_only_the_newest_when_several_validated_while_it_was_down() -> None:
    db = make_db([(SLOT - 900, "M5", "validated"), (SLOT - 600, "M5", "validated"), (SLOT, "M5", "validated")])
    rec = Recorder()
    try:
        with mock.patch.object(w, "DB_PATH", db):
            assert w.poll_once(object(), w.RenderState(), publish=rec) == "rendered"
        assert rec.published == [SLOT]  # not three renders: one picture of the newest cycle
    finally:
        remove(db)


def test_the_same_slot_is_not_rendered_twice() -> None:
    rec = Recorder()
    state = w.RenderState()
    assert poll(state, [SLOT, SLOT, SLOT], rec) == "rendered"
    assert poll(state, [SLOT], rec) == "idle"
    assert poll(state, [SLOT], rec) == "idle"
    assert rec.published == [SLOT]


def test_a_new_slot_triggers_a_render_and_an_older_one_never_does() -> None:
    rec = Recorder()
    state = w.RenderState()
    assert poll(state, [SLOT], rec) == "rendered"
    assert poll(state, [SLOT + 300], rec) == "rendered"
    assert poll(state, [SLOT], rec) == "idle"  # an older cycle (a clock or a database oddity) is not "new"
    assert poll(state, [SLOT + 300 - 600], rec) == "idle"
    assert poll(state, [SLOT + 600], rec) == "rendered"
    assert rec.published == [SLOT, SLOT + 300, SLOT + 600]


def test_cycle_time_greater_than_last_rendered_is_the_whole_rule() -> None:
    rec = Recorder()
    state = w.RenderState(last_rendered_slot=SLOT)
    assert poll(state, [SLOT], rec) == "idle"  # equal: not new
    assert poll(state, [SLOT + 300], rec) == "rendered"  # greater: new
    assert rec.published == [SLOT + 300]


def test_no_validated_cycle_yet_does_nothing() -> None:
    rec = Recorder()
    state = w.RenderState()
    assert poll(state, [None], rec) == "no-cycle"
    assert rec.published == [] and state.last_rendered_slot is None


def test_an_unreadable_database_is_reported_and_the_loop_survives() -> None:
    rec = Recorder()
    state = w.RenderState(last_rendered_slot=SLOT)

    def broken(_path):
        raise sqlite3.OperationalError("database is locked")

    assert w.poll_once(object(), state, latest=broken, publish=rec) == "db-error"
    assert state.last_rendered_slot == SLOT and rec.published == []


def test_a_failed_render_is_retried_after_the_backoff_not_every_poll() -> None:
    clock = {"t": 1000.0}
    rec = Recorder(fail_slots={SLOT})
    state = w.RenderState()
    now = lambda: clock["t"]  # noqa: E731
    assert poll(state, [SLOT], rec, now) == "failed"
    assert state.last_rendered_slot is None  # not advanced: the slot is still owed
    assert poll(state, [SLOT], rec, now) == "backoff"
    clock["t"] += w.RENDER_RETRY_SEC - 1
    assert poll(state, [SLOT], rec, now) == "backoff"
    rec.fail_slots.clear()
    clock["t"] += 1
    assert poll(state, [SLOT], rec, now) == "rendered"
    assert rec.published == [SLOT]
    assert state.failed_slot is None


def test_a_still_failing_render_keeps_waiting_between_attempts() -> None:
    clock = {"t": 1000.0}
    rec = Recorder(fail_slots={SLOT})
    state = w.RenderState()
    now = lambda: clock["t"]  # noqa: E731
    assert poll(state, [SLOT], rec, now) == "failed"
    clock["t"] += w.RENDER_RETRY_SEC
    assert poll(state, [SLOT], rec, now) == "failed"
    assert poll(state, [SLOT], rec, now) == "backoff"  # the second failure restarts the wait


def test_a_newer_slot_is_rendered_at_once_even_while_the_old_one_is_backing_off() -> None:
    rec = Recorder(fail_slots={SLOT})
    state = w.RenderState()
    assert poll(state, [SLOT], rec) == "failed"
    assert poll(state, [SLOT + 300], rec) == "rendered"  # a different slot: no backoff applies
    assert rec.published == [SLOT + 300]


def test_poll_passes_the_slot_and_the_client_to_publish() -> None:
    seen = []

    def publish(client, slot):
        seen.append((client, slot))

    client = object()
    w.poll_once(client, w.RenderState(), latest=lambda _p: SLOT, publish=publish)
    assert seen == [(client, SLOT)]


# ================================================ indicators from the gateway


def test_it_asks_the_gateway_for_the_setting_at_the_slot_it_is_rendering() -> None:
    urlopen = gateway(gateway_answer())
    with configured(url=GATEWAY_URL + "/"):
        chosen = w.fetch_active_indicators(SLOT, urlopen=urlopen)
    assert chosen == w.ChosenOverlays(m5="cherry_a", m15="non_b", source="setting")
    (call,) = urlopen.calls
    assert call["url"] == f"{GATEWAY_URL}/api/v1/cycles/current?slot={SLOT}"
    assert call["headers"]["Authorization"] == f"Bearer {GATEWAY_KEY}"
    assert call["timeout"] == w.GATEWAY_TIMEOUT_SEC


def test_it_reads_the_gateways_own_contract_fixture() -> None:
    body = json.loads((GATEWAY_FIXTURES / "cycles-current-renderer-before-ready.json").read_text(encoding="utf-8"))
    slot = body["activeIndicators"]["resolvedAtSlot"]
    with configured():
        chosen = w.fetch_active_indicators(slot, urlopen=gateway(body))
    # the cycle-before-ready case: the setting AT the slot, not at the gateway's newest READY cycle
    assert chosen == w.ChosenOverlays(m5="cherry_a", m15="non_b", source="setting")
    assert body["cycle"]["slot"] == slot - SLOT_SECONDS


def test_every_indicator_the_gateway_can_set_is_one_the_renderer_can_draw() -> None:
    text = (REPO / "railway-gateway" / "src" / "cycle" / "active-indicator" / "channel-sources.ts").read_text(encoding="utf-8")
    block = text[text.index("export const CHANNEL_SOURCES"):]
    sources = re.findall(r"'([a-z_]+)'", block[: block.index("] as const")])
    assert len(sources) == 8
    assert set(sources) <= set(OVERLAY_KEYS), set(sources) - set(OVERLAY_KEYS)


def test_the_contract_name_is_the_gateways() -> None:
    text = (REPO / "railway-gateway" / "src" / "cycle" / "active-indicator" / "current-cycle.ts").read_text(encoding="utf-8")
    assert f"CURRENT_CYCLE_CONTRACT = '{w.GATEWAY_CONTRACT}'" in text


def _falls_back(urlopen) -> None:
    with configured(overlays="cherry_a,resistance"):
        assert w.fetch_active_indicators(SLOT, urlopen=urlopen) is None
        with mock.patch.object(w.urllib.request, "urlopen", urlopen):
            chosen = w.choose_overlays(SLOT)
    assert chosen == w.ChosenOverlays(m5="cherry_a,resistance", m15="cherry_a,resistance", source="default")


def test_unreachable_gateway_falls_back() -> None:
    _falls_back(gateway(raises=urllib.error.URLError("connection refused")))


def test_a_gateway_that_times_out_falls_back() -> None:
    _falls_back(gateway(raises=socket.timeout("timed out")))
    _falls_back(gateway(raises=TimeoutError("timed out")))


def test_http_errors_fall_back() -> None:
    for code in (401, 403, 404, 429, 500, 502, 503):
        err = urllib.error.HTTPError(f"{GATEWAY_URL}/x", code, "err", {}, None)  # type: ignore[arg-type]
        _falls_back(gateway(raises=err))


def test_a_non_200_status_falls_back() -> None:
    _falls_back(gateway(gateway_answer(), status=204))


def test_an_answer_that_is_not_json_falls_back() -> None:
    _falls_back(gateway(b"<html>bad gateway</html>"))
    _falls_back(gateway(b""))


def test_an_answer_that_is_not_the_contract_falls_back() -> None:
    bad = gateway_answer()
    for mutate in (
        lambda b: b.update(contract="cycles-current/2"),
        lambda b: b.pop("contract"),
        lambda b: b.pop("activeIndicators"),
        lambda b: b["activeIndicators"].pop("byTimeframe"),
        lambda b: b["activeIndicators"]["byTimeframe"].pop("M15"),
        lambda b: b["activeIndicators"]["byTimeframe"]["M5"].pop("source"),
        lambda b: b.update(activeIndicators="x"),
        lambda b: b.update(activeIndicators=None),
    ):
        body = json.loads(json.dumps(bad))
        mutate(body)
        _falls_back(gateway(body))
    _falls_back(gateway([1, 2, 3]))


def test_a_timeframe_with_no_setting_falls_back() -> None:
    _falls_back(gateway(gateway_answer(m5=None)))
    _falls_back(gateway(gateway_answer(m15=None)))


def test_a_timeframe_with_no_setting_is_named_in_the_log() -> None:
    # an operator reading renderer.log needs to know WHICH timeframe has no setting
    for timeframe, answer in (("M5", gateway_answer(m5=None)), ("M15", gateway_answer(m15=None))):
        with configured(), mock.patch.object(w.logger, "warning") as warn:
            assert w.fetch_active_indicators(SLOT, urlopen=gateway(answer)) is None
        assert warn.call_count == 1
        message, *args = warn.call_args.args
        assert "no active indicator" in message and args == [timeframe]


def test_an_indicator_the_renderer_does_not_know_falls_back() -> None:
    _falls_back(gateway(gateway_answer(m5="brand_new_indicator")))
    _falls_back(gateway(gateway_answer(m15="")))


def test_an_answer_for_another_slot_is_not_believed() -> None:
    # a gateway that predates ?slot= ignores it and answers at its own newest cycle
    old = gateway_answer()
    old["activeIndicators"]["resolvedAtSlot"] = SLOT - 300
    old["activeIndicators"]["basis"] = "CYCLE"
    _falls_back(gateway(old))
    wrong_slot = gateway_answer()
    wrong_slot["activeIndicators"]["resolvedAtSlot"] = SLOT - 300
    _falls_back(gateway(wrong_slot))
    wrong_basis = gateway_answer()
    wrong_basis["activeIndicators"]["basis"] = "WALL_CLOCK"
    _falls_back(gateway(wrong_basis))


def test_not_configured_never_touches_the_network() -> None:
    def boom(*_a, **_k):
        raise AssertionError("the network must not be touched when unconfigured")

    for url, key in (
        ("", GATEWAY_KEY),
        (GATEWAY_URL, ""),
        ("", ""),
        ("https://your-api.railway.app", GATEWAY_KEY),  # the push worker's placeholder
        (GATEWAY_URL, "your_api_key_here"),
    ):
        with configured(url=url, key=key, overlays="cherry_b"):
            assert w.gateway_configured() is False
            assert w.fetch_active_indicators(SLOT, urlopen=boom) is None
            with mock.patch.object(w.urllib.request, "urlopen", boom):
                assert w.choose_overlays(SLOT) == w.ChosenOverlays("cherry_b", "cherry_b", "default")


def test_the_default_comes_from_render_overlays_for_both_timeframes() -> None:
    with configured(url="", key="", overlays=" best_fit_a , cherry_a "):
        assert w.default_overlays() == w.ChosenOverlays("best_fit_a,cherry_a", "best_fit_a,cherry_a", "default")


def test_when_the_gateway_answers_the_setting_wins_over_render_overlays() -> None:
    with configured(overlays="cherry_b"):
        with mock.patch.object(w.urllib.request, "urlopen", gateway(gateway_answer(m5="non_a", m15="best_fit_b"))):
            assert w.choose_overlays(SLOT) == w.ChosenOverlays("non_a", "best_fit_b", "setting")


def _reload_with_env(env: dict) -> None:
    clean = {k: v for k, v in os.environ.items() if k not in ("BACKFILL_API_KEY", "API_KEY", "API_GATEWAY_URL")}
    clean.update(env)
    with mock.patch.dict(os.environ, clean, clear=True):
        importlib.reload(w)


def test_the_gateway_key_is_backfill_api_key_else_api_key() -> None:
    try:
        _reload_with_env({"BACKFILL_API_KEY": "primary" + "p" * 20, "API_KEY": "secondary" + "s" * 20})
        assert w.GATEWAY_API_KEY.startswith("primary")
        _reload_with_env({"API_KEY": "secondary" + "s" * 20})
        assert w.GATEWAY_API_KEY.startswith("secondary")
        _reload_with_env({})
        assert w.GATEWAY_API_KEY == ""
        _reload_with_env({"API_GATEWAY_URL": GATEWAY_URL, "BACKFILL_API_KEY": GATEWAY_KEY})
        assert w.API_GATEWAY_URL == GATEWAY_URL and w.gateway_configured()
    finally:
        importlib.reload(w)


# ============================================================ what is uploaded


def test_upload_sends_the_stamp_as_object_metadata_for_each_variant() -> None:
    s3 = FakeS3()
    stamps = w.build_stamps(SLOT, overlays("best_fit_a", "non_b"), SLOT + 70)
    with tempfile.TemporaryDirectory() as tmp:
        rendered = {}
        for variant in w.VARIANTS:
            path = Path(tmp) / f"{variant}.png"
            path.write_bytes(good_png())
            rendered[variant] = path
        w.upload(s3, rendered, stamps)

    assert [c["key"] for c in s3.upload_calls] == [w.object_key("overlay"), w.object_key("standard")]
    for call in s3.upload_calls:
        extra = call["extra"]
        variant = "overlay" if call["key"].endswith("_overlay.png") else "standard"
        meta = extra["Metadata"]
        assert call["bucket"] == w.R2_BUCKET
        assert set(meta) == set(METADATA_KEYS)
        assert all(isinstance(v, str) for v in meta.values())
        assert meta["cycle-slot"] == str(SLOT)
        assert meta["last-closed-bar"] == str(SLOT - 300)
        assert meta["overlay"] == "best_fit_a"
        assert meta["overlay-m15"] == "non_b"
        assert meta["overlay-source"] == "setting"
        assert meta["variant"] == variant
        assert meta["rendered-at"] == str(SLOT + 70)
        assert extra["ContentType"] == "image/png"
        assert extra["CacheControl"] == "no-store"
        assert "ACL" not in extra  # private bucket: no public-read, ever


def test_each_object_carries_its_own_variant_and_both_the_same_slot() -> None:
    s3 = FakeS3()
    publish_args = []
    w.publish_slot(s3, SLOT, now=lambda: SLOT + 70, choose=lambda s: overlays(),
                   render=fake_render(publish_args))
    metas = {k: v["meta"] for k, v in s3.objects.items()}
    assert metas[w.object_key("overlay")]["variant"] == "overlay"
    assert metas[w.object_key("standard")]["variant"] == "standard"
    assert {m["cycle-slot"] for m in metas.values()} == {str(SLOT)}
    assert {m["rendered-at"] for m in metas.values()} == {str(SLOT + 70)}
    # and what was stored reads back as the stamp that was meant
    for variant in w.VARIANTS:
        parsed = parse_metadata(metas[w.object_key(variant)])
        assert parsed is not None and parsed.slot == SLOT and parsed.variant == variant


def test_the_renderer_is_given_the_same_time_the_metadata_states() -> None:
    s3 = FakeS3()
    calls: list = []
    w.publish_slot(s3, SLOT, now=lambda: SLOT + 77.9, choose=lambda s: overlays(), render=fake_render(calls))
    ((_dir, slot, chosen, rendered_at),) = calls
    assert (slot, chosen, rendered_at) == (SLOT, overlays(), SLOT + 77)
    assert {v["meta"]["rendered-at"] for v in s3.objects.values()} == {str(rendered_at)}


def test_object_keys_are_unchanged() -> None:
    assert w.object_key("overlay") == "xauusd/mtf_render_xauusd_m5_m15_overlay.png"
    assert w.object_key("standard") == "xauusd/mtf_render_xauusd_m5_m15_standard.png"


def test_after_a_publish_prune_still_removes_only_old_objects_and_never_the_current_keys() -> None:
    s3 = FakeS3()
    s3.seed(f"{w.KEY_PREFIX}/old_1.png", b"x", {}, age_hours=w.RETENTION_HOURS + 1)
    s3.seed(f"{w.KEY_PREFIX}/recent.png", b"x", {}, age_hours=1)
    s3.seed(w.object_key("overlay"), b"ancient", {}, age_hours=w.RETENTION_HOURS + 100)
    w.publish_slot(s3, SLOT, now=lambda: SLOT + 70, choose=lambda s: overlays(), render=fake_render())
    assert s3.deleted == [f"{w.KEY_PREFIX}/old_1.png"]
    assert f"{w.KEY_PREFIX}/recent.png" in s3.objects
    assert s3.objects[w.object_key("overlay")]["body"] == good_png()  # replaced, not pruned


def test_a_prune_failure_after_the_upload_does_not_fail_the_slot() -> None:
    s3 = seeded_s3()

    def broken_paginator(_name):
        raise RuntimeError("simulated R2 listing failure")

    s3.get_paginator = broken_paginator  # type: ignore[method-assign]

    def publish(client, slot):
        w.publish_slot(client, slot, now=lambda: SLOT + 70, choose=lambda s: overlays(), render=fake_render())

    state = w.RenderState()
    assert w.poll_once(s3, state, now=lambda: 1000.0, latest=lambda _p: SLOT, publish=publish) == "rendered"
    # published once, and the loop moved on: it does not draw and upload the pair again
    assert len(s3.upload_calls) == len(w.VARIANTS)
    assert state.last_rendered_slot == SLOT and state.failed_slot is None
    assert w.poll_once(s3, state, now=lambda: 1000.0, latest=lambda _p: SLOT, publish=publish) == "idle"
    assert len(s3.upload_calls) == len(w.VARIANTS)


def test_prune_never_deletes_the_two_current_keys_however_old_the_clock_says_they_are() -> None:
    s3 = FakeS3()
    ancient = w.RETENTION_HOURS + 1000
    for variant in w.VARIANTS:
        s3.seed(w.object_key(variant), b"x", {}, age_hours=ancient)
    s3.seed(f"{w.KEY_PREFIX}/older.png", b"x", {}, age_hours=ancient)
    s3.seed(f"{w.KEY_PREFIX}/just_inside.png", b"x", {}, age_hours=w.RETENTION_HOURS - 1)
    assert w.prune(s3) == 1
    assert s3.deleted == [f"{w.KEY_PREFIX}/older.png"]
    assert {w.object_key(v) for v in w.VARIANTS} <= set(s3.objects)
    assert f"{w.KEY_PREFIX}/just_inside.png" in s3.objects


def test_prune_only_looks_under_its_own_prefix() -> None:
    s3 = FakeS3()
    s3.seed("other/old.png", b"x", {}, age_hours=w.RETENTION_HOURS + 10)
    assert w.prune(s3) == 0
    assert "other/old.png" in s3.objects


def test_the_overlays_are_chosen_for_the_slot_being_published() -> None:
    asked: list[int] = []

    def choose(slot):
        asked.append(slot)
        return overlays()

    w.publish_slot(FakeS3(), SLOT, now=lambda: SLOT + 70, choose=choose, render=fake_render())
    assert asked == [SLOT]


def test_the_stamp_says_where_the_overlays_came_from() -> None:
    for source in ("setting", "default"):
        s3 = FakeS3()
        w.publish_slot(s3, SLOT, now=lambda: SLOT + 70, choose=lambda s, source=source: overlays(source=source),
                       render=fake_render())
        for variant in w.VARIANTS:
            meta = s3.objects[w.object_key(variant)]["meta"]
            assert meta["overlay-source"] == source
            parsed = parse_metadata(meta)
            assert parsed is not None and parsed.overlay_source == source


def test_the_stamp_carries_each_timeframes_own_indicator() -> None:
    s3 = FakeS3()
    w.publish_slot(s3, SLOT, now=lambda: SLOT + 70, choose=lambda s: overlays(m5="cherry_a", m15="non_b"),
                   render=fake_render())
    for variant in w.VARIANTS:
        meta = s3.objects[w.object_key(variant)]["meta"]
        assert meta["overlay"] == "cherry_a" and meta["overlay-m15"] == "non_b"


def test_retention_is_still_forty_eight_hours_by_default() -> None:
    assert w.RETENTION_HOURS == 48


# ================================================= the last good image is kept


def _assert_untouched(s3: FakeS3, before: dict) -> None:
    assert s3.upload_calls == [], "nothing may be uploaded"
    assert s3.deleted == []
    assert s3.snapshot() == before


def test_a_failed_render_uploads_nothing_and_keeps_the_old_pair() -> None:
    s3 = seeded_s3()
    before = s3.snapshot()

    def failing(_dir, _slot, _chosen, _at):
        raise subprocess.CalledProcessError(1, ["python", "-m", "mtf_render"], stderr="boom")

    assert raises(subprocess.CalledProcessError, lambda: w.publish_slot(
        s3, SLOT, now=lambda: SLOT + 70, choose=lambda s: overlays(), render=failing))
    _assert_untouched(s3, before)


def test_poll_reports_the_failure_and_leaves_r2_alone() -> None:
    s3 = seeded_s3()
    before = s3.snapshot()

    def failing(_dir, _slot, _chosen, _at):
        raise subprocess.CalledProcessError(1, ["python"], stderr="matplotlib exploded")

    def publish(client, slot):
        w.publish_slot(client, slot, now=lambda: SLOT + 70, choose=lambda s: overlays(), render=failing)

    state = w.RenderState()
    assert w.poll_once(s3, state, latest=lambda _p: SLOT, publish=publish) == "failed"
    assert state.last_rendered_slot is None and state.failed_slot == SLOT
    _assert_untouched(s3, before)


def test_a_render_that_produced_only_one_variant_uploads_nothing() -> None:
    s3 = seeded_s3()
    before = s3.snapshot()
    for variants in (("overlay",), ("standard",), ()):
        assert raises(w.RenderError, lambda variants=variants: w.publish_slot(
            s3, SLOT, now=lambda: SLOT + 70, choose=lambda s: overlays(),
            render=fake_render(variants=variants)))
    _assert_untouched(s3, before)


def test_a_variant_that_is_not_a_complete_png_uploads_nothing() -> None:
    s3 = seeded_s3()
    before = s3.snapshot()
    truncated = good_png()[:-5]  # the end marker is missing: a write that did not finish
    bad_bodies = {
        "empty": b"",
        "tiny": w.PNG_SIGNATURE,
        # long enough, and ends like a PNG: only the signature says it is not one
        "not a png": b"GIF89a" + b"\x00" * 4096 + w.PNG_IEND,
        "truncated": truncated,
        "text": b"error: renderer crashed" * 200,
    }
    for label, body in bad_bodies.items():
        assert raises(w.RenderError, lambda body=body: w.publish_slot(
            s3, SLOT, now=lambda: SLOT + 70, choose=lambda s: overlays(),
            render=fake_render(body=body))), label
    _assert_untouched(s3, before)


def test_verify_png_names_the_problem() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        p = Path(tmp) / "x.png"
        assert raises(w.RenderError, lambda: w.verify_png(p))  # missing
        p.write_bytes(b"")
        assert raises(w.RenderError, lambda: w.verify_png(p))
        p.write_bytes(good_png())
        w.verify_png(p)  # complete: no error
        p.write_bytes(good_png(w.MIN_PNG_BYTES))
        w.verify_png(p)  # exactly the smallest accepted size
        p.write_bytes(b"GIF89a" + b"\x00" * 4096 + w.PNG_IEND)
        assert raises(w.RenderError, lambda: w.verify_png(p))  # wrong signature, right trailer
        p.write_bytes(good_png()[:-1])
        assert raises(w.RenderError, lambda: w.verify_png(p))  # one byte short of the trailer


def test_a_failed_upload_keeps_the_old_object_whole() -> None:
    s3 = seeded_s3()
    old_standard = s3.snapshot()[w.object_key("standard")]
    s3.fail_keys.add(w.object_key("standard"))
    assert raises(RuntimeError, lambda: w.publish_slot(
        s3, SLOT, now=lambda: SLOT + 70, choose=lambda s: overlays(), render=fake_render()))
    # the pair is briefly mixed (overlay is new) but every object is whole and carries its own stamp
    assert s3.objects[w.object_key("overlay")]["meta"]["cycle-slot"] == str(SLOT)
    assert s3.snapshot()[w.object_key("standard")] == old_standard
    assert s3.deleted == []  # and prune did not run


def test_after_a_failed_upload_the_slot_is_retried_and_then_both_are_new() -> None:
    clock = {"t": 1000.0}
    s3 = seeded_s3()
    s3.fail_keys.add(w.object_key("standard"))

    def publish(client, slot):
        w.publish_slot(client, slot, now=lambda: SLOT + 70, choose=lambda s: overlays(), render=fake_render())

    state = w.RenderState()
    now = lambda: clock["t"]  # noqa: E731
    assert w.poll_once(s3, state, now=now, latest=lambda _p: SLOT, publish=publish) == "failed"
    s3.fail_keys.clear()
    assert w.poll_once(s3, state, now=now, latest=lambda _p: SLOT, publish=publish) == "backoff"
    clock["t"] += w.RENDER_RETRY_SEC
    assert w.poll_once(s3, state, now=now, latest=lambda _p: SLOT, publish=publish) == "rendered"
    assert {v["meta"]["cycle-slot"] for v in s3.objects.values()} == {str(SLOT)}


def test_a_bug_in_choosing_the_overlays_uploads_nothing_either() -> None:
    s3 = seeded_s3()
    before = s3.snapshot()

    def broken(_slot):
        raise KeyError("boom")

    state = w.RenderState()
    publish = lambda c, s: w.publish_slot(c, s, now=lambda: SLOT + 70, choose=broken, render=fake_render())  # noqa: E731
    assert w.poll_once(s3, state, latest=lambda _p: SLOT, publish=publish) == "failed"
    _assert_untouched(s3, before)


def test_the_temporary_render_folder_is_removed_whether_or_not_the_render_worked() -> None:
    seen: list[Path] = []

    def render_ok(out_dir, slot, chosen, at):
        seen.append(Path(out_dir))
        return fake_render()(out_dir, slot, chosen, at)

    def render_bad(out_dir, slot, chosen, at):
        seen.append(Path(out_dir))
        raise RuntimeError("no")

    s3 = FakeS3()
    w.publish_slot(s3, SLOT, now=lambda: SLOT + 70, choose=lambda s: overlays(), render=render_ok)
    raises(RuntimeError, lambda: w.publish_slot(s3, SLOT, now=lambda: SLOT + 70, choose=lambda s: overlays(), render=render_bad))
    assert len(seen) == 2 and not any(p.exists() for p in seen)


def test_an_upload_never_happens_before_the_render_finished() -> None:
    order: list[str] = []
    s3 = FakeS3()
    original = s3.upload_file

    def upload_file(*a, **k):
        order.append("upload")
        return original(*a, **k)

    s3.upload_file = upload_file  # type: ignore[method-assign]

    def render(out_dir, slot, chosen, at):
        order.append("render")
        return fake_render()(out_dir, slot, chosen, at)

    w.publish_slot(s3, SLOT, now=lambda: SLOT + 70, choose=lambda s: overlays(), render=render)
    assert order == ["render", "upload", "upload"]


# ================================================ the real renderer, end to end


def _fixture_world():
    fd, db = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    build_fixture_db(db)
    conn = sqlite3.connect(db)
    slot = conn.execute("SELECT timestamp FROM market_data WHERE timeframe='M5' ORDER BY timestamp").fetchall()[-4][0]
    conn.close()
    return db, slot


def test_render_both_runs_the_real_renderer_and_returns_two_complete_pngs() -> None:
    db, slot = _fixture_world()
    try:
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(w, "DB_PATH", db):
            with mock.patch.object(w.subprocess, "run", wraps=subprocess.run) as spy:
                rendered = w.render_both(Path(tmp), slot, overlays("best_fit_a", "non_b"), slot + 70)
            argv = spy.call_args.args[0]
            assert argv[:3] == [sys.executable, "-m", "mtf_render"]
            for flag, value in (("--slot", str(slot)), ("--m5-overlays", "best_fit_a"), ("--m15-overlays", "non_b"),
                                ("--overlay-source", "setting"), ("--rendered-at", str(slot + 70)), ("--db", db)):
                assert argv[argv.index(flag) + 1] == value, flag
            assert "--both-variants" in argv
            assert set(rendered) == set(w.VARIANTS)
            for path in rendered.values():
                w.verify_png(path)
    finally:
        remove(db)


def _fake_renderer_process(calls: list, bodies: dict | None = None):
    """Stands in for `python -m mtf_render`: records the command, writes the files it is told to."""
    bodies = bodies if bodies is not None else {v: good_png() for v in w.VARIANTS}

    def run(argv, **kwargs):
        calls.append({"argv": list(argv), "kwargs": kwargs})
        out = Path(argv[argv.index("--out") + 1])
        for variant, body in bodies.items():
            (out.parent / f"{w.OUT_STEM}_{variant}.png").write_bytes(body)
        return subprocess.CompletedProcess(argv, 0, "", "")

    return run


def test_render_both_tells_the_renderer_where_the_overlays_came_from() -> None:
    for source in ("setting", "default"):
        calls: list = []
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(w.subprocess, "run", _fake_renderer_process(calls)):
            w.render_both(Path(tmp), SLOT, overlays("best_fit_a", "non_b", source), SLOT + 70)
        argv = calls[0]["argv"]
        assert argv[argv.index("--overlay-source") + 1] == source
        assert argv[argv.index("--m5-overlays") + 1] == "best_fit_a"
        assert argv[argv.index("--m15-overlays") + 1] == "non_b"
        assert argv[argv.index("--slot") + 1] == str(SLOT)
        assert argv[argv.index("--rendered-at") + 1] == str(SLOT + 70)
        assert calls[0]["kwargs"].get("check") is True


def test_render_both_checks_every_variant_itself() -> None:
    # not left to publish_slot's second look: a replacement caller must get the same guarantee
    truncated = good_png()[:-5]
    cases = {
        "overlay truncated": {"overlay": truncated, "standard": good_png()},
        "standard truncated": {"overlay": good_png(), "standard": truncated},
        "standard missing": {"overlay": good_png()},
        "overlay missing": {"standard": good_png()},
        "not a png": {"overlay": good_png(), "standard": b"GIF89a" + b"\x00" * 4096 + w.PNG_IEND},
    }
    for label, bodies in cases.items():
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(
            w.subprocess, "run", _fake_renderer_process([], bodies)
        ):
            assert raises(w.RenderError, lambda: w.render_both(Path(tmp), SLOT, overlays(), SLOT + 70)), label


def test_render_both_returns_both_variants_when_the_renderer_did() -> None:
    with tempfile.TemporaryDirectory() as tmp, mock.patch.object(w.subprocess, "run", _fake_renderer_process([])):
        rendered = w.render_both(Path(tmp), SLOT, overlays(), SLOT + 70)
        assert set(rendered) == set(w.VARIANTS)
        assert all(p.parent == Path(tmp) and p.name == f"{w.OUT_STEM}_{v}.png" for v, p in rendered.items())


def test_publish_end_to_end_with_the_real_renderer_stamps_both_objects() -> None:
    db, slot = _fixture_world()
    s3 = FakeS3()
    try:
        with mock.patch.object(w, "DB_PATH", db):
            w.publish_slot(s3, slot, now=lambda: slot + 70, choose=lambda s: overlays("best_fit_a", "non_b"))
        assert set(s3.objects) == {w.object_key(v) for v in w.VARIANTS}
        for variant in w.VARIANTS:
            obj = s3.objects[w.object_key(variant)]
            assert obj["body"].startswith(w.PNG_SIGNATURE) and obj["body"].endswith(w.PNG_IEND)
            assert obj["meta"]["cycle-slot"] == str(slot)
            assert obj["meta"]["last-closed-bar"] == str(slot - 300)
            assert obj["meta"]["variant"] == variant
            assert obj["meta"]["overlay"] == "best_fit_a" and obj["meta"]["overlay-m15"] == "non_b"
    finally:
        remove(db)


def test_a_real_render_that_fails_keeps_the_old_pair() -> None:
    s3 = seeded_s3()
    before = s3.snapshot()
    missing = os.path.join(tempfile.gettempdir(), "no_such_xauusd_mtf_test.db")
    with mock.patch.object(w, "DB_PATH", missing):
        assert raises(subprocess.CalledProcessError, lambda: w.publish_slot(
            s3, SLOT, now=lambda: SLOT + 70, choose=lambda s: overlays()))
    _assert_untouched(s3, before)


if __name__ == "__main__":
    failures = 0
    names = [n for n in sorted(globals()) if n.startswith("test_")]
    for name in names:
        try:
            globals()[name]()
            print(f"PASS {name}")
        except Exception as exc:  # noqa: BLE001
            failures += 1
            print(f"FAIL {name}: {exc!r}")
    print(f"\n{len(names) - failures} passed, {failures} failed")
    sys.exit(1 if failures else 0)
