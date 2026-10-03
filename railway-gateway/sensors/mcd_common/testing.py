"""Shared tests any MCD can call (standard section 12): T4, T5, T6, T7, T8, T9, T10, T11, T12.

Each ``check_*`` function raises ``AssertionError`` with a plain message when the evaluator breaks
the rule, and returns something small when it does not. ``SharedSensorChecks`` is a ``unittest``
mixin that runs all of them from one hook, so an MCD's test file adds them like this::

    class TestShared(SharedSensorChecks, unittest.TestCase):
        def sensor(self):
            return SensorUnderTest(evaluate, inputs, params, upstream={}, timeframes=("M5",))

T1 (one test per state), T2 (boundaries), T3 (one test per pre-flight failure), T13 (real data) and
T14 (derived MCDs) are about one MCD's own logic and are written in its own test file.
"""

from __future__ import annotations

import dataclasses
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping, Sequence

from . import budget, wording
from . import reason_codes as rc
from .cycle_inputs import (
    CANDIDATES,
    TF_SECONDS,
    CycleInputs,
    closed_bars,
    floor_epoch,
    is_number,
    is_populated,
    slot_to_epoch,
    statistics_source,
    thaw,
)
from .envelope import assert_valid, canonical_json

Evaluate = Callable[[CycleInputs, Any, Mapping[str, Any]], Mapping[str, Any]]


@dataclass(frozen=True)
class SensorUnderTest:
    """What the shared checks need to know about one MCD and one cycle."""

    evaluate: Evaluate
    inputs: CycleInputs
    params: Any
    upstream: Mapping[str, Any]
    timeframes: Sequence[str]
    """Timeframes the MCD reads; the checks corrupt or remove things on these only."""


def _with(inputs: CycleInputs, **changes: Any) -> CycleInputs:
    return dataclasses.replace(inputs, **changes)


def _run(sensor: SensorUnderTest, inputs: CycleInputs | None = None) -> Mapping[str, Any]:
    return sensor.evaluate(inputs if inputs is not None else sensor.inputs, sensor.params, sensor.upstream)


def _describe(envelope: Mapping[str, Any]) -> str:
    return f"status={envelope.get('status')} reasons={envelope.get('status_reasons')} state={envelope.get('state_code')}"


def _source(inputs: CycleInputs, timeframe: str) -> tuple[str, str]:
    return timeframe, statistics_source(inputs.active_indicator[timeframe])


# --------------------------------------------------------------------------- T4 forming bar


def append_forming_bar(inputs: CycleInputs, timeframe: str, *, scale: float = 1.5) -> CycleInputs:
    """A copy of the bundle with an open (forming) bar appended for ``timeframe``.

    The bar opens on the timeframe's grid at or before the slot, so it is still open at the slot.
    Its numbers are the last closed bar's, scaled and shifted, so any evaluator that reads it
    produces a different result.
    """
    closed = closed_bars(inputs, timeframe)
    if not closed:
        raise ValueError(f"no closed {timeframe} bar to copy")
    slot = slot_to_epoch(inputs.cycle_slot)
    opens = floor_epoch(slot, timeframe)
    if opens + TF_SECONDS[timeframe] <= slot:
        raise AssertionError("internal: the appended bar would be closed")
    forming = {
        k: (v * scale + 7.0 if is_number(v) and k != "timestamp" else v) for k, v in closed[-1].items()
    }
    forming["timestamp"] = opens
    bars = thaw(inputs.bars)
    bars[timeframe] = list(bars[timeframe]) + [forming]
    return _with(inputs, bars=bars)


def check_forming_bar_ignored(sensor: SensorUnderTest) -> None:
    """T4: appending an open bar to the fixture changes nothing (R1)."""
    baseline = canonical_json(_run(sensor))
    for tf in sensor.timeframes:
        changed = canonical_json(_run(sensor, append_forming_bar(sensor.inputs, tf)))
        if changed != baseline:
            raise AssertionError(f"T4: a forming {tf} bar changed the envelope (the evaluator read an open bar)")


# --------------------------------------------------------------------------- T5 wrong-slot statistics


def check_wrong_slot_statistics(sensor: SensorUnderTest) -> None:
    """T5: a statistics row from another slot, or none, gives STALE + NO_STATS_AT_SLOT (R2)."""
    for tf in sensor.timeframes:
        key = _source(sensor.inputs, tf)
        if key not in sensor.inputs.statistics:
            raise AssertionError(f"T5: the fixture has no statistics row {key} to make wrong")
        stats = thaw(dict(sensor.inputs.statistics))
        stats[key] = dict(stats[key], captured_at=stats[key]["captured_at"] - TF_SECONDS[tf])
        earlier = _run(sensor, _with(sensor.inputs, statistics=stats))
        del stats[key]
        missing = _run(sensor, _with(sensor.inputs, statistics=stats))
        for label, envelope in (("a row one period earlier", earlier), ("no row", missing)):
            if envelope.get("status") != rc.STALE or rc.NO_STATS_AT_SLOT not in envelope.get("status_reasons", ()):
                raise AssertionError(f"T5 ({tf}, {label}): expected STALE + NO_STATS_AT_SLOT, got {_describe(envelope)}")


# --------------------------------------------------------------------------- T6 setting


def _unpopulated_candidate(inputs: CycleInputs, timeframe: str) -> str | None:
    bars = closed_bars(inputs, timeframe)
    last = bars[-1] if bars else {}
    for name in CANDIDATES[timeframe]:
        if not is_populated(last, name):
            return name
    return None


def check_setting(sensor: SensorUnderTest) -> None:
    """T6: no setting -> INVALID + NO_SETTING; a setting the data contradicts -> DETECTION_MISMATCH (R3).

    The mismatch case points the setting at a candidate with no value on the last closed bar while
    the real one still has one. The reading may then end CAUTIONARY, or STALE / INVALID from a later
    check (the wrong indicator has no statistics), but DETECTION_MISMATCH must be among its reasons.
    """
    for tf in sensor.timeframes:
        settings = thaw(sensor.inputs.active_indicator)
        del settings[tf]
        envelope = _run(sensor, _with(sensor.inputs, active_indicator=settings))
        if envelope.get("status") != rc.INVALID or rc.NO_SETTING not in envelope.get("status_reasons", ()):
            raise AssertionError(f"T6 ({tf}, no setting): expected INVALID + NO_SETTING, got {_describe(envelope)}")

        wrong = _unpopulated_candidate(sensor.inputs, tf)
        if wrong is None:
            raise AssertionError(f"T6: every {tf} candidate is populated in the fixture; cannot build a mismatch")
        settings = thaw(sensor.inputs.active_indicator)
        settings[tf] = wrong
        envelope = _run(sensor, _with(sensor.inputs, active_indicator=settings))
        if envelope.get("status") == rc.VALID or rc.DETECTION_MISMATCH not in envelope.get("status_reasons", ()):
            raise AssertionError(f"T6 ({tf}, mismatch): expected DETECTION_MISMATCH among the reasons, got {_describe(envelope)}")


# --------------------------------------------------------------------------- T7 determinism


def check_determinism(sensor: SensorUnderTest) -> None:
    """T7: two runs on the same bundle, and one on a rebuilt copy, give byte-identical JSON (R4)."""
    first = canonical_json(_run(sensor))
    second = canonical_json(_run(sensor))
    if first != second:
        raise AssertionError("T7: two runs on the same bundle differ")
    rebuilt = CycleInputs.from_dict(json.loads(json.dumps(sensor.inputs.to_dict())))
    if canonical_json(_run(sensor, rebuilt)) != first:
        raise AssertionError("T7: a bundle rebuilt from its JSON gives a different envelope")


# --------------------------------------------------------------------------- T8 schema


def check_schema(envelope: Mapping[str, Any]) -> None:
    """T8: the output validates against ``mcd-output/1`` (R5)."""
    assert_valid(envelope)


# --------------------------------------------------------------------------- T9 replay


def check_replay(
    evaluate: Evaluate,
    params: Any,
    fixtures_dir: str | Path,
    upstream: Mapping[str, Any] | None = None,
) -> int:
    """T9: every stored ``<slot>.inputs.json`` reproduces its ``<slot>.envelope.json`` byte for byte.

    Returns how many fixtures were replayed. Reads the JSON, never a workbook.
    """
    from .excel_fixture_provider import load_inputs

    replayed = 0
    for inputs_path in sorted(Path(fixtures_dir).glob("*.inputs.json")):
        expected_path = inputs_path.with_name(inputs_path.name.replace(".inputs.json", ".envelope.json"))
        if not expected_path.exists():
            continue
        actual = canonical_json(evaluate(load_inputs(inputs_path), params, upstream or {}), pretty=True)
        if actual != expected_path.read_text(encoding="utf-8"):
            raise AssertionError(f"T9: replay of {inputs_path.name} differs from {expected_path.name}")
        replayed += 1
    if replayed == 0:
        raise AssertionError(f"T9: no <slot>.inputs.json with a matching .envelope.json in {fixtures_dir}")
    return replayed


# --------------------------------------------------------------------------- T10 never throws


def corrupted_bundles(inputs: CycleInputs, timeframes: Sequence[str]) -> dict[str, CycleInputs]:
    """Named corruptions of a bundle, for T10."""
    tf = timeframes[0]
    junk_last = thaw(inputs.bars)
    junk_last[tf][-1] = {k: ("x" if is_number(v) else v) for k, v in junk_last[tf][-1].items()}
    stats = thaw(dict(inputs.statistics))
    junk_stats = {key: {k: "x" for k in row} for key, row in stats.items()}
    return {
        "bars is None": _with(inputs, bars=None),
        "bar rows are strings": _with(inputs, bars={t: ("garbage",) for t in inputs.bars}),
        "last bar numbers are strings": _with(inputs, bars=junk_last),
        "statistics is None": _with(inputs, statistics=None),
        "statistics values are strings": _with(inputs, statistics=junk_stats),
        "stats_slot is None": _with(inputs, stats_slot=None),
        "active_indicator is None": _with(inputs, active_indicator=None),
        "cycle_slot is garbage": _with(inputs, cycle_slot="not-a-slot"),
        "data_status is unknown": _with(inputs, data_status="Stale"),
    }


def check_never_throws(sensor: SensorUnderTest, *, skip: Iterable[str] = ()) -> None:
    """T10: a corrupted bundle never raises and always yields a valid INVALID or STALE envelope (R7).

    The reason is a known code from Appendix D; a corruption no pre-flight check catches must end
    as ``EVALUATOR_ERROR`` (use ``never_throws``). ``skip`` names corruptions this MCD does not read
    (for example a gate that reads no bars).
    """
    skipped = set(skip)
    for name, bundle in corrupted_bundles(sensor.inputs, sensor.timeframes).items():
        if name in skipped:
            continue
        try:
            envelope = _run(sensor, bundle)
        except Exception as error:  # noqa: BLE001
            raise AssertionError(f"T10 ({name}): the evaluator raised {type(error).__name__}: {error}") from error
        assert_valid(envelope)
        if envelope.get("status") not in (rc.INVALID, rc.STALE):
            raise AssertionError(f"T10 ({name}): expected INVALID or STALE, got {_describe(envelope)}")
        if not all(rc.is_known(code) for code in envelope.get("status_reasons", ())):
            raise AssertionError(f"T10 ({name}): reason code outside Appendix D in {envelope.get('status_reasons')}")


# --------------------------------------------------------------------------- T11 wording


def assert_wording_clean(**kwargs: Any) -> None:
    """T11: no banned word in codes or templates, no ``%`` in summary or commentary, summary rules.

    Keyword arguments are those of ``wording.check_wording``.
    """
    problems = wording.check_wording(**kwargs)
    if problems:
        raise AssertionError("T11 wording:\n  " + "\n  ".join(problems))


# --------------------------------------------------------------------------- T12 size and time


@dataclass(frozen=True)
class SizeResult:
    largest_tokens: int
    method: str
    budget: int
    pending: bool

    @property
    def passed(self) -> bool:
        return self.largest_tokens <= self.budget


def check_size(envelopes: Iterable[Mapping[str, Any]], *, token_budget: int = budget.TOKEN_BUDGET) -> SizeResult:
    """T12: the largest envelope stays within the token budget (R15).

    When ``o200k_base`` is not cached the count is the documented estimate; the result is then
    "pending" and does not fail. With the real encoding, an envelope over budget raises.
    """
    counts = [budget.count_envelope_tokens(e) for e in envelopes]
    if not counts:
        raise ValueError("check_size needs at least one envelope")
    worst = max(counts, key=lambda c: c.tokens)
    result = SizeResult(worst.tokens, worst.method, token_budget, pending=worst.pending)
    if worst.exact and worst.tokens > token_budget:
        raise AssertionError(f"T12: largest envelope is {worst.tokens} tokens ({worst.method}), budget {token_budget}")
    return result


def check_time(sensor: SensorUnderTest, *, limit: float = budget.TIME_BUDGET_SECONDS) -> float:
    """R15: one evaluation takes at most ``limit`` seconds (slowest of several runs)."""
    slowest = budget.time_evaluation(lambda: _run(sensor))
    if slowest > limit:
        raise AssertionError(f"R15: one evaluation took {slowest:.3f} s, limit {limit} s")
    return slowest


# --------------------------------------------------------------------------- unittest mixin


class SharedSensorChecks:
    """Mixin for ``unittest.TestCase``: runs the shared checks against ``self.sensor()``."""

    def sensor(self) -> SensorUnderTest:  # pragma: no cover - overridden
        raise NotImplementedError

    def test_t4_forming_bar_is_ignored(self) -> None:
        check_forming_bar_ignored(self.sensor())

    def test_t5_wrong_slot_statistics_are_stale(self) -> None:
        check_wrong_slot_statistics(self.sensor())

    def test_t6_setting_and_detection_mismatch(self) -> None:
        check_setting(self.sensor())

    def test_t7_determinism(self) -> None:
        check_determinism(self.sensor())

    def test_t8_schema(self) -> None:
        sensor = self.sensor()
        check_schema(_run(sensor))

    def test_t10_corrupted_bundle_never_throws(self) -> None:
        check_never_throws(self.sensor())

    def test_t12_size_and_r15_time(self) -> None:
        sensor = self.sensor()
        result = check_size([_run(sensor)])
        check_time(sensor)
        if result.pending:
            self.skipTest(
                f"T12 pending: o200k_base is not cached, estimate {result.largest_tokens} tokens "
                "(run: python -m mcd_common.budget --fetch)"
            )
