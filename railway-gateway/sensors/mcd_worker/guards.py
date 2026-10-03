"""Output guards: nothing reaches ``mcd_outputs`` unless it passes these (architecture 2.2 rule 5, 2.11 items 1 and 8).

The evaluators already build their envelopes through the kit and are tested against the schema, the
register and the wording rules. These guards run again on what comes out at run time because the worker
must never save a reading it cannot stand behind: an evaluator can have a bug that its tests missed, and a
registry can drift from its evaluator. A reading that fails is **replaced** by INVALID with
``EVALUATOR_ERROR`` (standard 11.2: an unexpected error inside the evaluator), so every enabled MCD still
yields exactly one row, and the problems are returned so the worker can log them and the measurement kit
can count them.

What is checked, in order:

1. ``SCHEMA``: the envelope validates against ``mcd-output/1`` (R5);
2. ``IDENTITY``: ``mcd_id``, ``evaluator_version`` and ``cycle_slot`` are the registry's and the bundle's,
   and ``depends_on`` is the registry's;
3. ``REASONS``: every reason code is in Appendix D and the reasons explain the status (section 6);
4. ``REGISTER``: a VALID or CAUTIONARY reading names a state of the MCD's register, with that state's bias;
5. ``WORDING``: no banned word in the state code or the regime word; no banned word, no ``%`` and no spelled-out
   "percent" or "percentage" in the summary, the commentary, any text inside ``details`` and the level names (R9;
   architecture 2.11 "no percentage or confidence word unless it comes from ``state_statistics``").

The advice-word heuristic of the kit is not repeated here: it has per-MCD allowances that live in each MCD's
spec, so it stays a test (T11), not a run-time refusal. Neither are the summary's length (the schema has it)
nor the no-prices rule (a heuristic on digits).
"""

from __future__ import annotations

import re
from typing import Any, Iterator, Mapping

from mcd_common import envelope as env
from mcd_common import reason_codes as rc
from mcd_common import wording
from mcd_common.cycle_inputs import CycleInputs

from .registry import Sensor

# The spelled-out twin of the ``%`` rule (session B finding F5, Davin 2026-10-03): "up 70 percent" must not pass because
# the sign is missing. Whole words, so "percentile" stays clean, as MEASURE and UPGRADE do for the kit's banned words. This
# is a run-time backstop only: the kit's list (standard 7.4) is unchanged, and no evaluator or template emits the word.
_PERCENT_WORD_RE = re.compile(r"\bpercent(?:age)?s?\b", re.IGNORECASE)


def _texts(canon: Mapping[str, Any]) -> Iterator[tuple[str, str]]:
    """Every free text a trader or the model could read, with a label for the report.

    State codes and regime words are not here: the schema limits them to ``[A-Z0-9_]`` and ``wording_problems`` reads them
    part by part, which is the only way to see a banned word joined to others by underscores.
    """
    for key in ("summary_line", "commentary"):
        value = canon.get(key)
        if isinstance(value, str):
            yield key, value
    for index, level in enumerate(canon.get("levels") or ()):
        if isinstance(level, Mapping) and isinstance(level.get("name"), str):
            yield f"levels[{index}].name", level["name"]

    def walk(node: Any, path: str) -> Iterator[tuple[str, str]]:
        if isinstance(node, str):
            yield path, node
        elif isinstance(node, Mapping):
            for key in sorted(node, key=str):
                yield from walk(node[key], f"{path}.{key}")
        elif isinstance(node, (list, tuple)):
            for index, value in enumerate(node):
                yield from walk(value, f"{path}[{index}]")

    yield from walk(canon.get("details"), "details")


def wording_problems(canon: Mapping[str, Any]) -> list[str]:
    problems: list[str] = []
    for label, text in _texts(canon):
        for word in wording.banned_in_text(text):
            problems.append(f"WORDING: {label} contains the banned word {word}")
        if "%" in text:
            problems.append(f"WORDING: {label} contains '%'")
        found = _PERCENT_WORD_RE.search(text)
        if found:
            problems.append(f"WORDING: {label} contains the percentage word {found.group(0).lower()!r}")
    for key in ("state_code", "regime_status"):
        value = canon.get(key)
        if isinstance(value, str):
            for word in wording.banned_in_code(value):
                problems.append(f"WORDING: {key} contains the banned word {word}")
    return problems


def reason_problems(canon: Mapping[str, Any]) -> list[str]:
    status = canon.get("status")
    reasons = canon.get("status_reasons")
    if not isinstance(reasons, list):
        return ["REASONS: status_reasons is not a list"]
    problems: list[str] = []
    statuses: list[str] = []
    for code in reasons:
        if not rc.is_known(code):
            problems.append(f"REASONS: {code!r} is not a reason code of standard Appendix D")
        else:
            statuses.append(rc.status_for(code))
    if problems:
        return problems
    if status == rc.VALID and reasons:
        problems.append("REASONS: a VALID reading has reasons")
    elif status == rc.CAUTIONARY and (not reasons or any(s != rc.CAUTIONARY for s in statuses)):
        problems.append("REASONS: a CAUTIONARY reading needs CAUTIONARY reason codes only")
    elif status in (rc.INVALID, rc.STALE) and status not in statuses:
        problems.append(f"REASONS: a {status} reading needs at least one {status} reason code")
    return problems


def envelope_problems(envelope: Any, sensor: Sensor, inputs: CycleInputs) -> list[str]:
    """Every way ``envelope`` may not be saved for ``sensor`` in this cycle. Empty list = it may. Never raises."""
    if not isinstance(envelope, Mapping):
        return [f"SCHEMA: the evaluator returned {type(envelope).__name__}, not a mapping"]
    try:
        canon = env.canonical(envelope)
        errors = env.schema_errors(envelope)
    except Exception as exc:  # noqa: BLE001 - NaN, a set, a bytes value: it cannot be saved either way
        return [f"SCHEMA: the envelope cannot be serialised ({type(exc).__name__}: {exc})"]
    problems = [f"SCHEMA: {error}" for error in errors]
    for field, expected in (
        ("mcd_id", sensor.mcd_id),
        ("evaluator_version", sensor.evaluator_version),
        ("cycle_slot", inputs.cycle_slot),
        ("depends_on", list(sensor.depends_on)),
    ):
        if canon.get(field) != expected:
            problems.append(f"IDENTITY: {field} is {canon.get(field)!r}, expected {expected!r}")
    problems += reason_problems(canon)
    if canon.get("status") in (rc.VALID, rc.CAUTIONARY):
        entry = sensor.states.get(canon.get("state_code"))
        if entry is None:
            problems.append(f"REGISTER: state {canon.get('state_code')!r} is not in the register of {sensor.mcd_id}")
        elif canon.get("bias") != entry.bias:
            problems.append(
                f"REGISTER: bias of {entry.code} is {canon.get('bias')!r}, the register says {entry.bias!r}"
            )
    problems += wording_problems(canon)
    return problems


def replacement(sensor: Sensor, inputs: CycleInputs) -> dict[str, Any]:
    """The reading saved instead of one that failed its guards: INVALID with ``EVALUATOR_ERROR`` (standard 11.2)."""
    return env.canonical(
        env.invalid(sensor.mcd_id, sensor.evaluator_version, inputs.cycle_slot, [rc.EVALUATOR_ERROR], depends_on=sensor.depends_on)
    )


def is_kit_fallback(envelope: Mapping[str, Any]) -> bool:
    """True for exactly the envelope ``mcd_common.envelope.never_throws`` returns after an exception inside an evaluator.

    It names no dependency (the decorator does not know them); the runner rebuilds it with the registry's. Anything else
    that merely carries ``EVALUATOR_ERROR`` (extra details, a dependency) is not this envelope and is left as it is.
    """
    try:
        expected = env.canonical(
            env.invalid(envelope["mcd_id"], envelope["evaluator_version"], envelope["cycle_slot"], [rc.EVALUATOR_ERROR])
        )
        return env.canonical(envelope) == expected
    except Exception:  # noqa: BLE001 - not an envelope the kit could have made
        return False
