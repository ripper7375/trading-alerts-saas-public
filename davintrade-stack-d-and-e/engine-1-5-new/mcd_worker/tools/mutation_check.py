"""Mutation check of the cycle runner: change one thing at a time, in a scratch copy, and require the test suite to fail.

A test suite that passes proves little until it is shown to fail when the code is wrong. Each mutant here is one small,
plausible mistake (a flipped comparison, a dropped check, two constants swapped). The tool copies the engine folders that
the runner needs (``mcd_common``, ``mcd0`` to ``mcd3``, ``mcd_worker``) into a scratch directory, confirms that the suite
passes there unmutated, then applies each mutant to the copy alone, runs the suite (the quick modules first, stopping at the
first failure) and reports whether the mutant was **killed** (a test failed) or **survived** (every test passed: a gap in the
tests, or an equivalent mutant that changes nothing).

The checkout is never edited: nothing is written outside the scratch directory, and at the end the tool proves it by comparing
the SHA-256 of every file of ``mcd_worker`` in the checkout before and after, and of every scratch copy with the checkout.

Run from ``davintrade-stack-d-and-e/engine-1-5-new/``::

    python -B -m mcd_worker.tools.mutation_check              # all mutants, 4 jobs
    python -B -m mcd_worker.tools.mutation_check --jobs 1
    python -B -m mcd_worker.tools.mutation_check --only M12 M30
    python -B -m mcd_worker.tools.mutation_check --list       # check every pattern matches exactly once, run nothing

Exit status 0 when every mutant was killed, 1 when one survived or the baseline failed, 2 for a stale pattern.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import os
import queue
import re
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path

ENGINE_DIR = Path(__file__).resolve().parents[2]
COPIED = ("mcd_common", "mcd0", "mcd1", "mcd2", "mcd3", "mcd_worker")
IGNORED = shutil.ignore_patterns("__pycache__", "legacy", "concept", ".tiktoken_cache", "*.pyc")
# Quick modules first: most mutants die in the first few seconds. The slow ones (processes, rebuilds) come last.
TEST_MODULES = (
    "test_statistics_outcomes", "test_statistics_aggregate", "test_statistics_boundaries",
    "test_inheritance", "test_registry", "test_flags_and_checklist", "test_output_guards", "test_retuning_gate",
    "test_cycle_runner", "test_boundaries", "test_fixtures", "test_cli", "test_determinism",
    "test_synthesis_fixtures", "test_synthesis_reading", "test_synthesis_engine", "test_synthesis_rules",
    "test_zones_params", "test_zones_builder", "test_zones_invariants", "test_pills",
    "test_runner_synthesis",
)
# A mutant of the synthesis package (build step 4) is run against the synthesis tests alone: they are the tests written for it, so a survivor is
# a gap in them, and the minute of unrelated tests would only slow the check down.
SYNTHESIS_MODULES = ("test_synthesis_fixtures", "test_synthesis_reading", "test_synthesis_engine", "test_synthesis_rules")
# The same for the entry-zone builder and the pills (build step 4, part 2).
ZONES_MODULES = ("test_zones_params", "test_zones_builder", "test_zones_invariants", "test_pills")
# And for synthesis inside the runner (build step 4, part 3): the SYN flag, what synthesis sees, and what it may never do to a cycle.
RUNNER_SYN_MODULES = ("test_runner_synthesis",)
FLAG_SYN_MODULES = ("test_runner_synthesis", "test_flags_and_checklist")
TIMEOUT_SECONDS = 600


@dataclass(frozen=True)
class Mutant:
    mutant_id: str
    path: str  # relative to the engine folder
    old: str  # must occur exactly once in the file
    new: str
    what: str
    modules: tuple[str, ...] | None = None  # the test modules that must kill it; ``None`` = the whole run


def m(mutant_id: str, path: str, old: str, new: str, what: str, *, modules: tuple[str, ...] | None = None) -> Mutant:
    return Mutant(mutant_id, f"mcd_worker/{path}", old, new, what, modules)


def sm(mutant_id: str, path: str, old: str, new: str, what: str) -> Mutant:
    """A mutant of ``mcd_worker/synthesis/<path>``, killed by the synthesis tests."""
    return m(mutant_id, f"synthesis/{path}", old, new, what, modules=SYNTHESIS_MODULES)


def zm(mutant_id: str, path: str, old: str, new: str, what: str) -> Mutant:
    """A mutant of ``mcd_worker/synthesis/<path>`` (the zone builder, its parameters or the pills), killed by the zone tests."""
    return m(mutant_id, f"synthesis/{path}", old, new, what, modules=ZONES_MODULES)


def rm(mutant_id: str, path: str, old: str, new: str, what: str) -> Mutant:
    """A mutant of the runner or of ``synthesis/cycle.py`` (build step 4, part 3), killed by ``test_runner_synthesis``."""
    return m(mutant_id, path, old, new, what, modules=RUNNER_SYN_MODULES)


def fm(mutant_id: str, path: str, old: str, new: str, what: str) -> Mutant:
    """A mutant of the SYN flag or its configuration (``flags.py``), killed by the runner-synthesis or the flag tests."""
    return m(mutant_id, path, old, new, what, modules=FLAG_SYN_MODULES)


MUTANTS: tuple[Mutant, ...] = (
    # ------------------------------------------------------------------ registry.py: order and graph
    m("M01", "registry.py", "return sorted(ids, key=mcd_number)", "return sorted(ids, key=mcd_number, reverse=True)", "independents run from the highest number down"),
    m("M02", "registry.py", "        for deps in waiting.values():\n            deps.difference_update(wave)\n", "", "derived MCDs never become ready"),
    m("M03", "registry.py", 'raise ConfigError("dependency cycle among derived MCDs: " + ", ".join(by_number(waiting)))', "break", "a derived cycle is silently dropped"),
    m("M04", "registry.py", "    order = by_number(i for i in chosen if registry[i].kind == KIND_GATE)\n    order += by_number(i for i in chosen if registry[i].kind == KIND_INDEPENDENT)", "    order = by_number(i for i in chosen if registry[i].kind == KIND_INDEPENDENT)\n    order += by_number(i for i in chosen if registry[i].kind == KIND_GATE)", "the gate runs after the independent MCDs"),
    m("M05", "registry.py", "            if state.get(dep) == 1:\n                return path[path.index(dep):] + [dep]", "            if state.get(dep) == 1:\n                return []", "a dependency cycle is not reported"),
    m("M06", "registry.py", "            elif dep not in sensors:", "            elif False:", "a dependency on an unknown MCD is accepted"),
    m("M07", "registry.py", "            if dep == sensor.mcd_id:", "            if False:", "a self-dependency is accepted"),
    m("M08", "registry.py", "    if gates and gates != [GATE_ID]:", "    if False:", "a second gate is accepted"),
    m("M09", "registry.py", "    if not isinstance(flag, str) or flag not in FLAG_VALUES:\n        problems.append(\n            f\"{where}: flag must be", "    if False:\n        problems.append(\n            f\"{where}: flag must be", "a registry flag outside off, shadow and live is accepted"),
    m("M10", "registry.py", "        if params.evaluator_version != version:", "        if False:", "registry and params may disagree on the version"),
    m("M11", "registry.py", "        if evaluator_version is not None and evaluator_version != version:", "        if False:", "registry and evaluator may disagree on the version"),
    m("M12", "registry.py", "    if kind in (KIND_GATE, KIND_INDEPENDENT) and depends_on:", "    if False:", "an independent MCD may have dependencies"),
    m("M13", "registry.py", "    if kind == KIND_DERIVED and not depends_on:", "    if False:", "a derived MCD may have no dependency"),
    m("M14", "registry.py", "    if kind == KIND_GATE and uses_channel:", "    if False:", "a gate may declare uses_channel"),
    m("M15", "registry.py", "            if not isinstance(code, str) or not code.startswith(f\"{mcd_id}_\"):", "            if not isinstance(code, str):", "a state code may lack the MCD prefix"),
    m("M16", "registry.py", "            if bias not in BIASES:", "            if False:", "a bias outside the four is accepted"),
    m("M17", "registry.py", "            if code in states:", "            if False:", "a state listed twice is accepted"),
    m("M18", "registry.py", "_FOLDER_RE = re.compile(r\"^mcd([0-9]|1[0-5])$\")", "_FOLDER_RE = re.compile(r\"^mcd([0-9]|1[0-9])$\")", "mcd16 is read as an MCD folder"),
    m("M19", "registry.py", "                problems.append(f\"{sensor.mcd_id} appears twice\")", "                pass", "a duplicate MCD id is accepted"),
    m("M20", "registry.py", "ordered = sorted(sensors, key=lambda s: s.number if _MCD_ID_RE.match(s.mcd_id) else 99)", "ordered = list(sensors)", "the registry keeps the order it was given"),
    m("M21", "registry.py", "    if folder_number is not None and mcd_number(mcd_id) != folder_number:", "    if False:", "an MCD may sit in another MCD's folder"),
    # ------------------------------------------------------------------ flags.py
    m("M22", "flags.py", "SHADOW_ITEMS = (1, 2, 3, 4, 5, 6)", "SHADOW_ITEMS = (1, 2, 3, 4, 5)", "shadow needs only five items"),
    m("M23", "flags.py", "        if set(LIVE_ITEMS) <= passed:\n            return FLAG_LIVE", "        if set(SHADOW_ITEMS) <= passed:\n            return FLAG_LIVE", "live needs only items 1 to 6"),
    m("M24", "flags.py", "        if set(SHADOW_ITEMS) <= passed:\n            return FLAG_SHADOW", "        if set(SHADOW_ITEMS) & passed:\n            return FLAG_SHADOW", "shadow needs any one of items 1 to 6"),
    m("M25", "flags.py", "needed = {FLAG_SHADOW: SHADOW_ITEMS, FLAG_LIVE: LIVE_ITEMS}.get(flag, ())", "needed = {FLAG_SHADOW: LIVE_ITEMS, FLAG_LIVE: SHADOW_ITEMS}.get(flag, ())", "shadow and live swap their items"),
    m("M26", "flags.py", "if other in FLAG_RANK and FLAG_RANK[other] < FLAG_RANK[flag]:", "if other in FLAG_RANK and FLAG_RANK[other] <= FLAG_RANK[flag]:", "equal flags on a dependency are refused"),
    m("M27", "flags.py", "if sensor.kind != \"gate\" and sensor.uses_channel and GATE_ID in registry and GATE_ID not in required:", "if False:", "a channel MCD may be higher than the gate"),
    m("M28", "flags.py", "        if mcd_id not in registry:\n            problems.append(f\"flag for unknown MCD {mcd_id!r}\")", "        if False:\n            problems.append(f\"flag for unknown MCD {mcd_id!r}\")", "a flag for an unknown MCD is accepted"),
    m("M29", "flags.py", "        if mcd_id not in flags:\n            problems.append(f\"{mcd_id} has no flag (add it as 'off')\")", "        if False:\n            problems.append(f\"{mcd_id} has no flag (add it as 'off')\")", "an MCD with no flag is accepted"),
    m("M30", "flags.py", "            if not (isinstance(item.get(\"evidence\"), str) and item[\"evidence\"].strip()):", "            if False:", "a passed item needs no evidence"),
    m("M31", "flags.py", "            if not (isinstance(files, list) and files and all(isinstance(f, str) and f.strip() for f in files)):", "            if False:", "a passed item needs no evidence file"),
    m("M32", "flags.py", "            if not (isinstance(item.get(\"waits_on\"), str) and item[\"waits_on\"].strip()):", "            if False:", "a pending item need not say what it waits on"),
    m("M33", "flags.py", "        if item.get(\"id\") != item_id or item.get(\"name\") != name:", "        if item.get(\"id\") != item_id:", "an item may be renamed"),
    m("M34", "flags.py", "        if checklist.mcd_id != path.stem:", "        if False:", "a checklist may carry another MCD's id"),
    m("M35", "flags.py", "    if data.get(\"schema\") != CONFIG_SCHEMA:", "    if False:", "the worker config schema is not checked"),
    m("M36", "flags.py", "        if not isinstance(value, str) or value not in FLAG_VALUES:", "        if False:", "a worker config flag outside the three values is accepted"),
    m("M37", "flags.py", "FLAG_RANK: Mapping[str, int] = MappingProxyType({FLAG_OFF: 0, FLAG_SHADOW: 1, FLAG_LIVE: 2})", "FLAG_RANK: Mapping[str, int] = MappingProxyType({FLAG_OFF: 0, FLAG_SHADOW: 2, FLAG_LIVE: 1})", "shadow ranks above live"),
    # ------------------------------------------------------------------ inheritance.py
    m("M38", "inheritance.py", "PROPAGATING_STATUSES = (rc.VALID,)", "PROPAGATING_STATUSES = (rc.VALID, rc.CAUTIONARY)", "a CAUTIONARY MCD0 passes its defect on"),
    m("M39", "inheritance.py", "PROPAGATING_STATUSES = (rc.VALID,)", "PROPAGATING_STATUSES = ()", "no MCD0 defect is passed on"),
    m("M40", "inheritance.py", '"MCD0_M5_DEFECT": ("M5",),', '"MCD0_M5_DEFECT": ("M15",),', "an M5 defect is read as M15"),
    m("M41", "inheritance.py", '"MCD0_M15_DEFECT": ("M15",),', '"MCD0_M15_DEFECT": ("M5",),', "an M15 defect is read as M5"),
    m("M42", "inheritance.py", '"MCD0_M5_M15_DEFECT": ("M5", "M15"),', '"MCD0_M5_M15_DEFECT": ("M5",),', "a defect on both is read as M5 only"),
    m("M43", "inheritance.py", '"MCD0_ALL_QUALIFIED": (),', '"MCD0_ALL_QUALIFIED": ("M5",),', "a qualified gate marks the M5 channel MCDs"),
    m("M44", "inheritance.py", "if tf in defects and tf in sensor.uses_channel", "if tf in defects", "every MCD is marked, whatever it uses"),
    m("M45", "inheritance.py", "if tf in defects and tf in sensor.uses_channel", "if tf in defects or tf in sensor.uses_channel", "an MCD is marked for a timeframe it uses even when it is fine"),
    m("M46", "inheritance.py", "return tuple(rc.mcd0_defect(tf) for tf in TIMEFRAMES if", "return tuple(rc.mcd0_defect(tf) for tf in reversed(TIMEFRAMES) if", "the defect reasons come M15 first"),
    m("M47", "inheritance.py", "reading[\"status\"] not in (rc.VALID, rc.CAUTIONARY)", "reading[\"status\"] not in (rc.VALID,)", "a CAUTIONARY channel reading is not marked"),
    m("M48", "inheritance.py", "        existing + list(added),", "        list(added) + existing,", "the defect reasons come before the evaluator's own"),
    m("M49", "inheritance.py", "added = tuple(code for code in inherited_reasons(sensor, defects) if code not in existing)", "added = tuple(code for code in inherited_reasons(sensor, defects))", "a reason already present is added twice"),
    m("M50", "inheritance.py", "    problems = [f\"{gate.mcd_id}: state {code} is not mapped to timeframes in mcd_worker.inheritance\" for code in unknown]", "    problems = []", "an unmapped gate state is accepted"),
    m("M51", "inheritance.py", "    if state not in DEFECT_TIMEFRAMES:\n        raise ConfigError(", "    if state not in DEFECT_TIMEFRAMES:\n        return ()\n        raise ConfigError(", "an unknown gate state marks nobody silently"),
    m("M52", "inheritance.py", "        bias=reading[\"bias\"],", "        bias=\"NEUTRAL\",", "marking changes the bias"),
    m("M53", "inheritance.py", "        levels=reading[\"levels\"],", "        levels=(),", "marking drops the levels"),
    m("M54", "inheritance.py", "        details=reading[\"details\"],", "        details=None,", "marking drops the details"),
    m("M55", "inheritance.py", "        regime_status=reading[\"regime_status\"],", "        regime_status=None,", "marking drops the regime word"),
    m("M56", "inheritance.py", "        commentary=reading[\"commentary\"],", "        commentary=\"\",", "marking blanks the commentary"),
    m("M57", "inheritance.py", "        last_closed_bar=reading[\"last_closed_bar\"],", "        last_closed_bar={},", "marking drops the last closed bar"),
    m("M58", "inheritance.py", "        depends_on=reading[\"depends_on\"],", "        depends_on=(),", "marking drops depends_on"),
    # ------------------------------------------------------------------ guards.py
    m("M59", "guards.py", "        if canon.get(field) != expected:", "        if False:", "identity is not checked"),
    m("M60", "guards.py", "        (\"depends_on\", list(sensor.depends_on)),\n", "", "depends_on is not checked"),
    m("M61", "guards.py", "        if entry is None:\n            problems.append(f\"REGISTER: state", "        if False:\n            problems.append(f\"REGISTER: state", "a state outside the register is accepted"),
    m("M62", "guards.py", "        elif canon.get(\"bias\") != entry.bias:", "        elif False:", "a bias other than the register's is accepted"),
    m("M63", "guards.py", "        if \"%\" in text:", "        if False:", "a percent sign is accepted"),
    m("M64", "guards.py", "        for word in wording.banned_in_text(text):", "        for word in []:", "a banned word in a text is accepted"),
    m("M65", "guards.py", "    yield from walk(canon.get(\"details\"), \"details\")", "    pass", "details are not scanned for wording"),
    m("M66", "guards.py", "    for index, level in enumerate(canon.get(\"levels\") or ()):", "    for index, level in enumerate(()):", "level names are not scanned for wording"),
    m("M67", "guards.py", "        if not rc.is_known(code):", "        if False:", "an unknown reason code is accepted"),
    m("M68", "guards.py", "    elif status == rc.CAUTIONARY and (not reasons or any(s != rc.CAUTIONARY for s in statuses)):", "    elif False:", "a CAUTIONARY reading may carry INVALID codes"),
    m("M69", "guards.py", "    if status == rc.VALID and reasons:", "    if False:", "a VALID reading may carry reasons"),
    m("M70", "guards.py", "    elif status in (rc.INVALID, rc.STALE) and status not in statuses:", "    elif False:", "an INVALID reading may carry only CAUTIONARY codes"),
    m("M71", "guards.py", "env.invalid(sensor.mcd_id, sensor.evaluator_version, inputs.cycle_slot, [rc.EVALUATOR_ERROR], depends_on=sensor.depends_on)", "env.invalid(sensor.mcd_id, sensor.evaluator_version, inputs.cycle_slot, [rc.SANITY_FAILED], depends_on=sensor.depends_on)", "the replacement carries the wrong reason"),
    m("M72", "guards.py", "[rc.EVALUATOR_ERROR], depends_on=sensor.depends_on)", "[rc.EVALUATOR_ERROR])", "the replacement drops the dependencies"),
    m("M73", "guards.py", "    problems = [f\"SCHEMA: {error}\" for error in errors]", "    problems = []", "schema errors are not reported"),
    m("M74", "guards.py", "    if not isinstance(envelope, Mapping):\n        return [f\"SCHEMA: the evaluator returned", "    if False:\n        return [f\"SCHEMA: the evaluator returned", "a non-mapping is not recognised first"),
    m("M75", "guards.py", "        return env.canonical(envelope) == expected", "        return False", "the kit's fallback envelope is never recognised"),
    # ------------------------------------------------------------------ cycle_runner.py
    m("M76", "cycle_runner.py", "    applied = observed and retuning_enforced", "    applied = observed or retuning_enforced", "RETUNING is applied when only enforced"),
    m("M77", "cycle_runner.py", "if observed and not applied else inputs", "if observed else inputs", "RETUNING is hidden even when enforced"),
    m("M78", "cycle_runner.py", "def run_cycle(self, inputs: CycleInputs, *, retuning_enforced: bool = False)", "def run_cycle(self, inputs: CycleInputs, *, retuning_enforced: bool = True)", "RETUNING is enforced by default"),
    m("M79", "cycle_runner.py", "            retuning_observed=observed,", "            retuning_observed=applied,", "the observation is recorded as the application"),
    m("M80", "cycle_runner.py", "    if not isinstance(inputs.retuning, bool):\n        raise BundleError", "    if False:\n        raise BundleError", "a non-boolean retuning is accepted"),
    m("M81", "cycle_runner.py", "    if not is_slot(inputs.cycle_slot):\n        raise BundleError", "    if False:\n        raise BundleError", "a bad slot is accepted"),
    m("M82", "cycle_runner.py", "            upstream = {dep: envelopes[dep] for dep in sensor.depends_on if dep in envelopes}", "            upstream = dict(envelopes)", "every MCD reads every earlier reading"),
    m("M83", "cycle_runner.py", "sensor.evaluate(seen, sensor.params, copy.deepcopy(dict(upstream)))", "sensor.evaluate(seen, sensor.params, dict(upstream))", "an evaluator can change an upstream reading"),
    m("M84", "cycle_runner.py", "                    evaluator_envelope_sha256=evaluator_hash,", "                    evaluator_envelope_sha256=sha256_text(text),", "the pre-inheritance hash is the final one"),
    m("M85", "cycle_runner.py", "            if sensor.kind == KIND_GATE:", "            if sensor.mcd_id == \"MCD99\":", "the gate is not recognised"),
    m("M86", "cycle_runner.py", "                defects = inheritance.defect_timeframes(reading)", "                defects = ()", "the gate's defects are dropped"),
    m("M87", "cycle_runner.py", "                if added:\n                    extra =", "                if False:\n                    extra =", "a marked reading is never kept"),
    m("M88", "cycle_runner.py", "marked, added, problems = guards.replacement(sensor, seen), (), problems + extra", "marked, added, problems = marked, added, problems + extra", "a marked reading that fails its guards is kept"),
    m("M89", "cycle_runner.py", "        if isinstance(raw, Mapping) and guards.is_kit_fallback(raw):", "        if False:", "the kit's fallback is not given the registry's dependencies"),
    m("M90", "cycle_runner.py", "        problems = guards.envelope_problems(raw, sensor, seen)\n        if problems:", "        problems = guards.envelope_problems(raw, sensor, seen)\n        if False:", "an evaluator's reading is never guarded"),
    m("M91", "cycle_runner.py", "                    flag=self.flags[mcd_id],", "                    flag=\"shadow\",", "every reading is written as shadow"),
    m("M92", "cycle_runner.py", "            inputs_sha256=_bundle_sha256(inputs),", "            inputs_sha256=_bundle_sha256(seen),", "the hash is of the bundle after the RETUNING switch"),
    m("M93", "cycle_runner.py", "return json.dumps(inputs.to_dict(), sort_keys=True, separators=(\",\", \":\"), ensure_ascii=True)", "return json.dumps(inputs.to_dict(), sort_keys=False, separators=(\",\", \":\"), ensure_ascii=True)", "the bundle hash depends on key order"),
    m("M94", "cycle_runner.py", "return json.dumps(inputs.to_dict(), sort_keys=True, separators=(\",\", \":\"), ensure_ascii=True)", "return json.dumps(inputs.to_dict(), sort_keys=True, ensure_ascii=True)", "the canonical bundle text has spaces"),
    m("M95", "cycle_runner.py", "        self.order = execution_order(registry, self.enabled)", "        self.order = tuple(self.enabled)", "the order is the numeric one"),
    m("M96", "cycle_runner.py", "        self.enabled = tuple(i for i in registry if self.flags[i] != FLAG_OFF)", "        self.enabled = tuple(i for i in registry if self.flags[i] == FLAG_LIVE)", "only live MCDs are run"),
    m("M97", "cycle_runner.py", "            problems += inheritance.gate_state_problems(registry[GATE_ID])", "            pass", "an unmappable gate is accepted"),
    m("M98", "cycle_runner.py", "        if not isinstance(retuning_enforced, bool):\n            raise ConfigError", "        if False:\n            raise ConfigError", "a non-boolean retuning_enforced is accepted"),
    m("M99", "cycle_runner.py", '            "inherited_reasons": list(self.inherited_reasons),', '            "inherited_reasons": [],', "the result hides the inherited reasons"),
    m("M100", "cycle_runner.py", '                "observed": self.retuning_observed,\n                "enforced": self.retuning_enforced,\n                "applied": self.retuning_applied,', '                "observed": self.retuning_applied,\n                "enforced": self.retuning_enforced,\n                "applied": self.retuning_observed,', "observed and applied swap in the result"),
    m("M101", "cycle_runner.py", "            gate_status, gate_state = reading[\"status\"], reading[\"state_code\"]", "            gate_status, gate_state = reading[\"state_code\"], reading[\"status\"]", "the gate summary swaps status and state"),
    # ------------------------------------------------------------------ cli.py
    m("M103", "cli.py", 'enforced = request.get("retuning_enforced", False)', 'enforced = request.get("retuning_enforced", True)', "the CLI enforces RETUNING by default"),
    m("M104", "cli.py", "    if not isinstance(enforced, bool):", "    if False:", "retuning_enforced may be any JSON value"),
    m("M105", "cli.py", "    if extra:\n        raise _RequestError(f\"request: unknown keys", "    if False:\n        raise _RequestError(f\"request: unknown keys", "unknown request keys are accepted"),
    m("M106", "cli.py", "json.loads(text, parse_constant=_reject_constant)", "json.loads(text)", "NaN and infinity are accepted"),
    m("M107", "cli.py", "    except WorkerError as exc:\n        problems = list(getattr(exc, \"problems\", ())) or [str(exc)]\n        stderr.write(json.dumps({\"error\": type(exc).__name__, \"problems\": problems}, ensure_ascii=True) + \"\\n\")\n        return 2", "    except WorkerError as exc:\n        problems = list(getattr(exc, \"problems\", ())) or [str(exc)]\n        stderr.write(json.dumps({\"error\": type(exc).__name__, \"problems\": problems}, ensure_ascii=True) + \"\\n\")\n        return 1", "a bad request exits 1"),
    m("M108", "cli.py", '    if request.get("request_version") != REQUEST_VERSION:', "    if False:", "the request version is not checked"),
    m("M109", "cli.py", "        return 1\n    if hasattr(stdout, \"buffer\"):", "        return 0\n    if hasattr(stdout, \"buffer\"):", "an unexpected error exits 0"),
    # ------------------------------------------------------------------ a second pass: the places the first pass left thin
    m("M110", "guards.py", '    for key in ("summary_line", "commentary"):', '    for key in ("summary_line",):', "the commentary is not scanned for wording"),
    m("M111", "guards.py", '    for key in ("summary_line", "commentary"):', '    for key in ("commentary",):', "the summary line is not scanned for wording"),
    m("M112", "guards.py", "            for word in wording.banned_in_code(value):", "            for word in []:", "a banned word joined by underscores in a code is accepted"),
    m("M113", "flags.py", "    required = list(sensor.depends_on)\n", "    required = []\n", "a derived MCD may be higher than its dependencies"),
    m("M114", "registry.py", "    if unknown:\n        raise ConfigError(f\"cannot order unknown MCDs {unknown}\")", "    if False:\n        raise ConfigError(f\"cannot order unknown MCDs {unknown}\")", "an unknown MCD reaches the order"),
    m("M115", "registry.py", "        problems += graph_problems(self._sensors)\n", "", "a registry is built without its graph checks"),
    m("M116", "cycle_runner.py", "            defect_timeframes=defects,", "            defect_timeframes=(),", "the result hides the defective timeframes"),
    m("M117", "cycle_runner.py", "    if not isinstance(inputs, CycleInputs):\n        raise BundleError", "    if False:\n        raise BundleError", "something that is not a bundle is accepted"),
    m("M118", "cycle_runner.py", "    if not isinstance(inputs.symbol, str) or not inputs.symbol:", "    if False:", "an empty symbol is accepted"),
    m("M119", "cycle_runner.py", "            gate_status, gate_state = reading[\"status\"], reading[\"state_code\"]", "            gate_status, gate_state = None, None", "the gate summary is empty"),
    m("M120", "cli.py", "            if key not in _LOG_RESERVED:\n                entry[key] = value", "            if False:\n                entry[key] = value", "log lines lose mcd_id and cycle_slot"),
    m("M121", "cli.py", "        stdout.buffer.write((text + \"\\n\").encode(\"ascii\"))", "        stdout.buffer.write((text + \"\\r\\n\").encode(\"ascii\"))", "the result ends in a carriage return"),
    m("M122", "cli.py", "        worker = Worker.load(engine_dir=args.engine_dir, config_path=args.config)", "        worker = Worker.load(engine_dir=args.engine_dir)", "--config is ignored"),
    m("M123", "cli.py", "        worker = Worker.load(engine_dir=args.engine_dir, config_path=args.config)", "        worker = Worker.load(config_path=args.config)", "--engine-dir is ignored"),
    # ------------------------------------------------------------------ the bundle text (part 4, Davin's option a)
    m("M124", "cycle_runner.py", "            bundle_canonical_json=_bundle_text(inputs),", "            bundle_canonical_json=_bundle_text(seen),", "the returned text is the bundle after the RETUNING switch"),
    m("M125", "cycle_runner.py", "            bundle_canonical_json=_bundle_text(inputs),", "            bundle_canonical_json=None,", "the bundle text is never returned"),
    m("M126", "cycle_runner.py", "    try:\n        return bundle_canonical_json(inputs)\n", "    try:\n        return bundle_canonical_json(inputs).replace(\",\", \", \")\n", "the returned text is not the text that was hashed"),
    m("M127", "cycle_runner.py", "        out[\"bundle_canonical_json\"] = self.bundle_canonical_json\n", "", "the serialised result lacks the bundle text"),
    m("M128", "cycle_runner.py", "malformed bundle ``_bundle_sha256`` reported\n        return None", "malformed bundle ``_bundle_sha256`` reported\n        return \"\"", "a bundle that cannot be written gets an empty text"),
    m("M129", "cycle_runner.py", "        out[\"bundle_canonical_json\"] = self.bundle_canonical_json\n", "        out[\"bundle_canonical_json\"] = self.inputs_sha256\n", "the serialised result carries the hash where the text should be"),
    # ------------------------------------------------------------------ statistics/outcomes.py (build step 3 part 6)
    m("M130", "statistics/outcomes.py", "BAR_SECONDS = 300  # one M5 bar", "BAR_SECONDS = 600  # one M5 bar", "a bar is ten minutes"),
    m("M131", "statistics/outcomes.py", "MappingProxyType({2: 24, 12: 144})", "MappingProxyType({2: 23, 12: 144})", "the 2-hour horizon is 23 bars"),
    m("M132", "statistics/outcomes.py", "MappingProxyType({2: 24, 12: 144})", "MappingProxyType({2: 24, 12: 143})", "the 12-hour horizon is 143 bars"),
    m("M133", "statistics/outcomes.py", "reference_open = check_slot(slot) - BAR_SECONDS", "reference_open = check_slot(slot)", "the reference bar is the one that opens at the slot"),
    m("M134", "statistics/outcomes.py", "reference_open = check_slot(slot) - BAR_SECONDS", "reference_open = check_slot(slot) - 2 * BAR_SECONDS", "the reference bar is two bars before the slot"),
    m("M135", "statistics/outcomes.py", "series.get(reference_open + bars_ahead * BAR_SECONDS)", "series.get(reference_open + (bars_ahead - 1) * BAR_SECONDS)", "the horizon bar is one too early"),
    m("M136", "statistics/outcomes.py", "series.get(reference_open + bars_ahead * BAR_SECONDS)", "series.get(reference_open + (bars_ahead + 1) * BAR_SECONDS)", "the horizon bar is one too late"),
    m("M137", "statistics/outcomes.py", "    if reference is None:\n        return Unavailable(NO_REFERENCE_BAR)", "    if False:\n        return Unavailable(NO_REFERENCE_BAR)", "a missing reference bar is not noticed"),
    m("M138", "statistics/outcomes.py", "    if horizon_bar is None:\n        return Unavailable(NO_HORIZON_BAR)", "    if False:\n        return Unavailable(NO_HORIZON_BAR)", "a missing horizon bar is not noticed"),
    m("M139", "statistics/outcomes.py", "for step in range(1, bars_ahead + 1)]", "for step in range(0, bars_ahead + 1)]", "the reference bar is inside the window"),
    m("M140", "statistics/outcomes.py", "for step in range(1, bars_ahead + 1)]", "for step in range(1, bars_ahead)]", "the horizon bar is outside the window"),
    m("M141", "statistics/outcomes.py", "for step in range(1, bars_ahead + 1)]", "for step in range(2, bars_ahead + 1)]", "the first bar after the reference is outside the window"),
    m("M142", "statistics/outcomes.py", "    if any(bar is None for bar in window):", "    if False:", "a hole in the window is not noticed"),
    m("M143", "statistics/outcomes.py", "forward, adverse = change, max(_ZERO, price - lowest)", "forward, adverse = -change, max(_ZERO, price - lowest)", "a LONG forward move has the wrong sign"),
    m("M144", "statistics/outcomes.py", "forward, adverse = change, max(_ZERO, price - lowest)", "forward, adverse = change, max(_ZERO, lowest - price)", "a LONG excursion is measured upward"),
    m("M145", "statistics/outcomes.py", "forward, adverse = change, max(_ZERO, price - lowest)", "forward, adverse = change, price - lowest", "a LONG excursion can be negative"),
    m("M146", "statistics/outcomes.py", "forward, adverse = price - horizon_bar.close, max(_ZERO, highest - price)", "forward, adverse = horizon_bar.close - price, max(_ZERO, highest - price)", "a SHORT forward move is not turned"),
    m("M147", "statistics/outcomes.py", "forward, adverse = price - horizon_bar.close, max(_ZERO, highest - price)", "forward, adverse = price - horizon_bar.close, max(_ZERO, price - highest)", "a SHORT excursion is measured downward"),
    m("M148", "statistics/outcomes.py", "forward, adverse = price - horizon_bar.close, max(_ZERO, highest - price)", "forward, adverse = price - horizon_bar.close, highest - price", "a SHORT excursion can be negative"),
    m("M149", "statistics/outcomes.py", "forward, adverse = change, max(abs(price - lowest), abs(highest - price))", "forward, adverse = change, min(abs(price - lowest), abs(highest - price))", "a NEUTRAL excursion is the nearer extreme"),
    m("M150", "statistics/outcomes.py", "forward, adverse = change, max(abs(price - lowest), abs(highest - price))", "forward, adverse = -change, max(abs(price - lowest), abs(highest - price))", "a NEUTRAL forward move is turned"),
    m("M151", "statistics/outcomes.py", "forward, adverse = change, max(abs(price - lowest), abs(highest - price))", "forward, adverse = change, abs(price - lowest)", "a NEUTRAL excursion looks only downward"),
    m("M152", "statistics/outcomes.py", "forward, adverse = change, max(abs(price - lowest), abs(highest - price))", "forward, adverse = change, abs(highest - price)", "a NEUTRAL excursion looks only upward"),
    m("M153", "statistics/outcomes.py", '    if bias == "LONG":', '    if bias in ("LONG", "STAND_ASIDE"):', "STAND_ASIDE is measured like LONG"),
    m("M154", "statistics/outcomes.py", '    elif bias == "SHORT":', '    elif bias in ("SHORT", "NEUTRAL"):', "NEUTRAL is measured like SHORT"),
    m("M155", "statistics/outcomes.py", "lowest = min(bar.low for bar in bars)", "lowest = max(bar.low for bar in bars)", "the lowest low is the highest low"),
    m("M156", "statistics/outcomes.py", "highest = max(bar.high for bar in bars)", "highest = min(bar.high for bar in bars)", "the highest high is the lowest high"),
    m("M157", "statistics/outcomes.py", "lowest = min(bar.low for bar in bars)", "lowest = min(bar.close for bar in bars)", "the excursion uses closes, not lows"),
    m("M158", "statistics/outcomes.py", "highest = max(bar.high for bar in bars)", "highest = max(bar.close for bar in bars)", "the excursion uses closes, not highs"),
    m("M159", "statistics/outcomes.py", "        price = reference.close", "        price = reference.low", "the reference price is the reference bar's low"),
    m("M160", "statistics/outcomes.py", "change = horizon_bar.close - price", "change = horizon_bar.low - price", "the horizon price is the horizon bar's low"),
    m("M161", "statistics/outcomes.py", "            if stamp % BAR_SECONDS:\n", "            if False:\n", "a bar off the 5-minute grid is accepted"),
    m("M162", "statistics/outcomes.py", "if previous is not None and stamp <= previous:", "if previous is not None and stamp < previous:", "a duplicate bar is accepted"),
    m("M163", "statistics/outcomes.py", "if previous is not None and stamp <= previous:", "if False:", "bars may be out of order"),
    m("M164", "statistics/outcomes.py", "            if low <= _ZERO:", "            if low < _ZERO:", "a bar with a zero low is accepted"),
    m("M165", "statistics/outcomes.py", "            elif not low <= close <= high:", "            elif not low <= high:", "a close outside the bar's range is accepted"),
    m("M166", "statistics/outcomes.py", "        return Decimal(repr(value))", "        return Decimal(value)", "a float is read as its binary value, not as the decimal it prints as"),
    m("M167", "statistics/outcomes.py", "        if value != value or value in (float(\"inf\"), float(\"-inf\")):", "        if value in (float(\"inf\"), float(\"-inf\")):", "a NaN price is accepted"),
    m("M168", "statistics/outcomes.py", "    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):", "    if not isinstance(value, (int, float, Decimal)):", "a boolean is a price"),
    m("M169", "statistics/outcomes.py", "    if not isinstance(bias, str) or bias not in BIASES:", "    if not isinstance(bias, str):", "any text is a bias"),
    m("M170", "statistics/outcomes.py", "or horizon_hours not in HORIZON_BARS:", "or False:", "any whole number of hours is a horizon"),
    m("M171", "statistics/outcomes.py", "or not isinstance(slot, int) or slot % BAR_SECONDS:", "or not isinstance(slot, int):", "a slot off the grid is accepted"),
    m("M172", "statistics/outcomes.py", "        return Unavailable(NO_HORIZON_BAR)", "        return Unavailable(GAP_IN_WINDOW)", "a missing horizon bar is reported as a gap"),
    m("M173", "statistics/outcomes.py", "        return Unavailable(GAP_IN_WINDOW)", "        return Unavailable(NO_HORIZON_BAR)", "a hole in the window is reported as a missing horizon bar"),
    m("M174", "statistics/outcomes.py", "        return Unavailable(NO_REFERENCE_BAR)", "        return Unavailable(NO_HORIZON_BAR)", "a missing reference bar is reported as a missing horizon bar"),
    m("M175", "statistics/outcomes.py", "    if len(listed) <= MAX_PROBLEMS_LISTED:", "    if len(listed) < MAX_PROBLEMS_LISTED:", "twenty problems are cut"),
    m("M176", "statistics/outcomes.py", "MAX_PROBLEMS_LISTED = 20", "MAX_PROBLEMS_LISTED = 21", "twenty-one problems are listed"),
    m("M177", "statistics/outcomes.py", "    return (*listed[:MAX_PROBLEMS_LISTED], f\"... and {len(listed) - MAX_PROBLEMS_LISTED} more\")", "    return (*listed[:MAX_PROBLEMS_LISTED], f\"... and {len(listed)} more\")", "the count of the rest includes the ones listed"),
    m("M178", "statistics/outcomes.py", "        context.prec = 50", "        context.prec = 2", "the arithmetic rounds to two digits"),
    m("M179", "statistics/outcomes.py", "    reference = series.get(reference_open)\n", "    reference = series.get(reference_open) or series.get(reference_open - BAR_SECONDS)\n", "an earlier bar stands in for a missing reference bar"),
    # ------------------------------------------------------------------ statistics/aggregate.py
    m("M180", "statistics/aggregate.py", "MIN_SAMPLE = 30  #", "MIN_SAMPLE = 29  #", "the minimum sample is 29"),
    m("M181", "statistics/aggregate.py", "MIN_SAMPLE = 30  #", "MIN_SAMPLE = 31  #", "the minimum sample is 31"),
    m("M182", "statistics/aggregate.py", "    if len(outcomes) < MIN_SAMPLE:\n        raise SampleTooSmall", "    if len(outcomes) <= MIN_SAMPLE:\n        raise SampleTooSmall", "figures are refused at exactly 30"),
    m("M183", "statistics/aggregate.py", "    if len(outcomes) < MIN_SAMPLE:\n        raise SampleTooSmall", "    if False:\n        raise SampleTooSmall", "figures are computed from any sample"),
    m("M184", "statistics/aggregate.py", "    if n >= MIN_SAMPLE:\n        metrics = measured_metrics(outcomes)", "    if n > MIN_SAMPLE:\n        metrics = measured_metrics(outcomes)", "a row at exactly 30 has no figures"),
    m("M185", "statistics/aggregate.py", "    if n >= MIN_SAMPLE:\n        metrics = measured_metrics(outcomes)", "    if n >= MIN_SAMPLE - 1:\n        metrics = measured_metrics(outcomes)", "a row at 29 has figures"),
    m("M186", "statistics/aggregate.py", "    if n >= MIN_SAMPLE:\n        metrics = measured_metrics(outcomes)", "    if n >= 0:\n        metrics = measured_metrics(outcomes)", "every row has figures"),
    m("M187", "statistics/aggregate.py", "    position = (len(ordered) - 1) * quarters", "    position = len(ordered) * quarters", "the quantile position is one rank too high"),
    m("M188", "statistics/aggregate.py", "    below, remainder = divmod(position, 4)", "    below, remainder = divmod(position, 3)", "a quartile is worked out in thirds"),
    m("M189", "statistics/aggregate.py", "    if remainder == 0:\n        return ordered[below]", "    if True:\n        return ordered[below]", "a quantile is the lower rank, never interpolated"),
    m("M190", "statistics/aggregate.py", "Decimal(remainder) / Decimal(4) *", "Decimal(remainder) / Decimal(5) *", "the interpolation weight is a fifth"),
    m("M191", "statistics/aggregate.py", "(ordered[below + 1] - ordered[below])", "(ordered[below] - ordered[below + 1])", "the interpolation runs the wrong way"),
    m("M192", "statistics/aggregate.py", "    ordered = sorted(values)", "    ordered = list(values)", "the values are not sorted"),
    m("M193", "statistics/aggregate.py", "or quarters not in (1, 2, 3):", "or quarters not in (1, 2, 3, 4):", "the fourth quartile is accepted"),
    m("M194", "statistics/aggregate.py", "    if not ordered:\n        raise ValueError", "    if False:\n        raise ValueError", "an empty list has a quantile"),
    m("M195", "statistics/aggregate.py", "    if isinstance(quarters, bool) or quarters", "    if quarters", "True is a quartile"),
    m("M196", "statistics/aggregate.py", "    return 0.0 if number == 0 else number  # no negative zero in a stored figure", "    return number  # no negative zero in a stored figure", "a stored figure can be a negative zero"),
    m("M197", "statistics/aggregate.py", '"forward_move_median": _number(quantile(moves, 2)),', '"forward_move_median": _number(quantile(moves, 1)),', "the forward move median is the first quartile"),
    m("M198", "statistics/aggregate.py", '"forward_move_q1": _number(quantile(moves, 1)),', '"forward_move_q1": _number(quantile(moves, 3)),', "the forward move first quartile is the third"),
    m("M199", "statistics/aggregate.py", '"forward_move_q3": _number(quantile(moves, 3)),', '"forward_move_q3": _number(quantile(moves, 1)),', "the forward move third quartile is the first"),
    m("M200", "statistics/aggregate.py", '"adverse_excursion_median": _number(quantile(excursions, 2)),', '"adverse_excursion_median": _number(quantile(moves, 2)),', "the excursion median is taken from the moves"),
    m("M201", "statistics/aggregate.py", '"adverse_excursion_q3": _number(quantile(excursions, 3)),', '"adverse_excursion_q3": _number(quantile(excursions, 2)),', "the excursion third quartile is its median"),
    m("M202", "statistics/aggregate.py", "    moves = [outcome.forward_move for outcome in outcomes]", "    moves = [outcome.adverse_excursion for outcome in outcomes]", "the forward moves are the excursions"),
    m("M203", "statistics/aggregate.py", '"opposing_level_rate": None,  # build step 4', '"opposing_level_rate": 0.0,  # build step 4', "the opposing-level rate is a number"),
    m("M204", "statistics/aggregate.py", "HORIZONS: tuple[int, ...] = tuple(sorted(HORIZON_BARS))", "HORIZONS: tuple[int, ...] = (2,)", "only the 2-hour horizon is measured by default"),
    m("M205", "statistics/aggregate.py", "            if isinstance(value, str) and value:", "            if isinstance(value, str):", "an empty text is an MCD, a series or a state"),
    m("M206", "statistics/aggregate.py", "        key = (occurrence.mcd_id, occurrence.series, occurrence.config_hash_key, occurrence.state_code)", "        key = (occurrence.mcd_id, occurrence.series, \"\", occurrence.state_code)", "a changed config_hash does not start a new series"),
    m("M207", "statistics/aggregate.py", "        key = (occurrence.mcd_id, occurrence.series, occurrence.config_hash_key, occurrence.state_code)", "        key = (occurrence.mcd_id, \"\", occurrence.config_hash_key, occurrence.state_code)", "a changed evaluator series does not start a new series"),
    m("M208", "statistics/aggregate.py", "        key = (occurrence.mcd_id, occurrence.series, occurrence.config_hash_key, occurrence.state_code)", "        key = (\"\", occurrence.series, occurrence.config_hash_key, occurrence.state_code)", "two MCDs share a row"),
    m("M209", "statistics/aggregate.py", "        key = (occurrence.mcd_id, occurrence.series, occurrence.config_hash_key, occurrence.state_code)", "        key = (occurrence.mcd_id, occurrence.series, occurrence.config_hash_key, \"\")", "two states share a row"),
    m("M210", "statistics/aggregate.py", "        if len(biases) > 1:", "        if len(biases) > 2:", "two biases in one row are accepted"),
    m("M211", "statistics/aggregate.py", "slot_key = (member.mcd_id, member.series, member.config_hash_key, member.slot)", "slot_key = (member.mcd_id, member.series, \"\", member.slot)", "one reading per slot is counted across config hashes"),
    m("M212", "statistics/aggregate.py", "slot_key = (member.mcd_id, member.series, member.config_hash_key, member.slot)", "slot_key = (member.mcd_id, \"\", member.config_hash_key, member.slot)", "one reading per slot is counted across evaluator series"),
    m("M213", "statistics/aggregate.py", "slot_key = (member.mcd_id, member.series, member.config_hash_key, member.slot)", "slot_key = (\"\", member.series, member.config_hash_key, member.slot)", "one reading per slot is counted across MCDs"),
    m("M214", "statistics/aggregate.py", "            if slot_key in seen_slots:", "            if False:", "a slot read twice is accepted"),
    m("M215", "statistics/aggregate.py", "                    unavailable[result.reason] += 1", "                    unavailable[result.reason] += 2", "an unavailable outcome is counted twice"),
    m("M216", "statistics/aggregate.py", "    for key in sorted(groups):", "    for key in groups:", "rows follow the input order"),
    m("M217", "statistics/aggregate.py", "wanted = sorted({check_horizon(h) for h in horizons})", "wanted = sorted(horizons)", "a repeated horizon is measured twice"),
    m("M218", "statistics/aggregate.py", "    series = bars if isinstance(bars, BarSeries) else BarSeries(bars)", "    series = BarSeries(bars)", "a prepared series of bars is refused"),
    m("M219", "statistics/aggregate.py", '                    "horizon_hours": horizon,', '                    "horizon_hours": 2,', "every row is the 2-hour horizon"),
    m("M220", "statistics/aggregate.py", '"occurrences": len(read)', '"occurrences": len(groups)', "the occurrence count is the group count"),
    m("M221", "statistics/aggregate.py", "                if isinstance(result, Outcome):\n                    outcomes.append(result)", "                if isinstance(result, Outcome):\n                    pass", "outcomes are not collected"),
    m("M222", "statistics/aggregate.py", "                result = outcome_at(series, member.slot, member.bias, horizon)", "                result = outcome_at(series, member.slot, \"LONG\", horizon)", "every occurrence is measured as LONG"),
    m("M223", "statistics/aggregate.py", "        biases = sorted({m.bias for m in members}, key=BIASES.index)", "        biases = sorted({m.bias for m in members[:1]}, key=BIASES.index)", "only the first occurrence of a group has its bias checked"),
    m("M224", "statistics/aggregate.py", "        self.problems: tuple[str, ...] = cap_problems(problems)\n        super().__init__(\"; \".join(self.problems))\n\n\nclass SampleTooSmall", "        self.problems: tuple[str, ...] = tuple(problems)\n        super().__init__(\"; \".join(self.problems))\n\n\nclass SampleTooSmall", "a long list of occurrence problems is not cut"),
    m("M225", "statistics/aggregate.py", "        super().__init__([f\"n = {n} is below {MIN_SAMPLE}: no number may be computed\"])", "        super().__init__([\"no number may be computed\"])", "the refusal does not say which n it saw"),
    m("M226", "statistics/aggregate.py", "                problems.append(f\"{where}: {error}\")\n        if len(text)", "                pass\n        if len(text)", "a bad bias or slot is dropped without a word"),
    # ------------------------------------------------------------------ guards.py: the spelled-out percent (session B finding F5)
    m("M227", "guards.py", "        found = _PERCENT_WORD_RE.search(text)\n        if found:", "        found = None\n        if found:", "a spelled-out percent is accepted"),
    m("M228", "guards.py", '_PERCENT_WORD_RE = re.compile(r"\\bpercent(?:age)?s?\\b", re.IGNORECASE)', '_PERCENT_WORD_RE = re.compile(r"\\bpercent\\b", re.IGNORECASE)', "percentage and percentages are accepted"),
    m("M229", "guards.py", '_PERCENT_WORD_RE = re.compile(r"\\bpercent(?:age)?s?\\b", re.IGNORECASE)', '_PERCENT_WORD_RE = re.compile(r"\\bpercent(?:age)?s?\\b")', "a capitalised Percent is accepted"),
    m("M230", "guards.py", '_PERCENT_WORD_RE = re.compile(r"\\bpercent(?:age)?s?\\b", re.IGNORECASE)', '_PERCENT_WORD_RE = re.compile(r"percent", re.IGNORECASE)', "percentile is refused as well"),
    m("M231", "guards.py", "{found.group(0).lower()!r}", "{found.group(0)!r}", "the word in the report keeps its capitals"),
    # ------------------------------------------------------------------ synthesis/engine.py (build step 4, part 1)
    sm("M232", "engine.py", '    if status not in rc.STATUSES:\n        return _unusable(sensor, rc.INVALID)\n    try:', '    if False:\n        return _unusable(sensor, rc.INVALID)\n    try:', "an envelope with an unknown status is accepted"),
    sm("M233", "engine.py", '    if not isinstance(reading, Mapping):\n        return _absent(sensor)', '    if not isinstance(reading, Mapping):\n        return _unusable(sensor, rc.INVALID)', "a missing reading is INVALID instead of ABSENT"),
    sm("M234", "engine.py", '    if status not in fx.AVAILABLE_STATUSES:\n        return _unusable(sensor, status, sha)', '    if False:\n        return _unusable(sensor, status, sha)', "an INVALID or STALE reading is read as if it were usable"),
    sm("M235", "engine.py", '    if not isinstance(state, str) or bias not in fx.BIASES or not (regime is None or isinstance(regime, str)):', '    if False:', "a VALID reading with no state code is accepted"),
    sm("M236", "engine.py", 'codes = tuple(c for c in reasons if isinstance(c, str)) if isinstance(reasons, (list, tuple)) else ()', 'codes = tuple(reasons or ())', "a text in the place of a list of reasons is read letter by letter"),
    sm("M237", "engine.py", 'if view is None or view.facts.get(condition.fact) not in condition.values:', 'if view is None or view.facts.get(condition.fact) in condition.values:', "a condition holds when its fact is NOT one of the values"),
    sm("M238", "engine.py", '    for condition in branch.when:\n        view = views.get(', '    for condition in branch.when[:1]:\n        view = views.get(', "only the first condition of a branch is tested"),
    sm("M239", "engine.py", 'views.get(primary if condition.sensor == PRIMARY else condition.sensor)', 'views.get(condition.sensor)', "PRIMARY is not resolved to the trader type's primary sensor"),
    sm("M240", "engine.py", '    if not rule.primary_first:\n        return rule.branches', '    if True:\n        return rule.branches', "the primary sensor's branches are never tried first"),
    sm("M241", "engine.py", 'key=lambda b: 0 if b.sensor == primary else 1', 'key=lambda b: 1 if b.sensor == primary else 0', "the other sensor's branches are tried first"),
    sm("M242", "engine.py", '        if view is None or not view.available:\n            continue', '        if view is None:\n            continue', "a modifier is applied to an unavailable sensor"),
    sm("M243", "engine.py", '        if modifier.rules is not None and rule.id not in modifier.rules:\n            continue', '        if False:\n            continue', "a modifier restricted to a row applies to every row"),
    sm("M244", "engine.py", '        if bias not in modifier.bias:\n            continue', '        if False:\n            continue', "a modifier applies whatever the result's bias"),
    sm("M245", "engine.py", '        if all(view.facts.get(c.fact) in c.values for c in modifier.when):', '        if any(view.facts.get(c.fact) in c.values for c in modifier.when):', "a modifier applies when any of its conditions holds"),
    sm("M246", "engine.py", '        if view.status == rc.CAUTIONARY:\n            cautionary = True', '        if True:\n            cautionary = True', "every sensor that was read makes the result CAUTIONARY"),
    sm("M247", "engine.py", '                if code not in bucket:\n                    bucket.append(code)', '                if True:\n                    bucket.append(code)', "a reason code repeated by two sensors is listed twice"),
    sm("M248", "engine.py", '    if extra is not None:\n        cautionary = True\n        codes.append(extra)', '    if extra is not None:\n        cautionary = False\n        codes.append(extra)', "a modifier caution alone does not make the result CAUTIONARY"),
    sm("M249", "engine.py", '        codes.append(extra)\n    if cautionary and not codes:', '        pass\n    if cautionary and not codes:', "the modifier's caution code is not carried"),
    sm("M250", "engine.py", '                stale = unavailable.status == rc.STALE', '                stale = unavailable.status != rc.STALE', "a stale primary sensor is read as invalid and the other way round"),
    sm("M251", "engine.py", 'code = rc.upstream_stale(primary) if stale else rc.upstream_unavailable(primary)', 'code = rc.upstream_unavailable(primary) if stale else rc.upstream_stale(primary)', "the data stand-aside names the wrong reason code"),
    sm("M252", "engine.py", 'status=rc.STALE if stale else rc.INVALID,', 'status=rc.INVALID if stale else rc.STALE,', "the data stand-aside has the wrong status"),
    sm("M253", "engine.py", '                if modifier.sensor not in read:\n                    read.append(modifier.sensor)', '                if False:\n                    read.append(modifier.sensor)', "a sensor a modifier used is not counted as read"),
    sm("M254", "engine.py", '                if modifier.effect == "caution":', '                if modifier.effect != "caution":', "only notes and confirmations make the result CAUTIONARY"),
    sm("M255", "engine.py", 'extra = f"{MODIFIER_CAUTION}:{views[modifier.sensor].state_code}"', 'extra = f"{MODIFIER_CAUTION}:{modifier.id}"', "the modifier caution code names the modifier instead of the state"),
    sm("M256", "engine.py", '                reasons.append(modifier.text)', '                reasons.insert(0, modifier.text)', "the modifier's text comes before the rule's"),
    sm("M257", "engine.py", '            read_sorted = tuple(s for s in fx.SENSORS if s in read)', '            read_sorted = tuple(read)', "the sensors read are not put in sensor order"),
    sm("M258", "engine.py", '    available = tuple(s for s in fx.SENSORS if s in views and views[s].available)', '    available = tuple(s for s in fx.SENSORS if s in views)', "a cycle with no match counts unavailable sensors as read"),
    sm("M259", "engine.py", '            read = list(branch.sensors_read(primary))', '            read = []', "the sensors a branch read are forgotten"),
    sm("M260", "engine.py", '    primary = rules.primary_sensor[profile]', '    primary = rules.primary_sensor["DAY_TRADER"]', "every trader type has the Day Trader's primary sensor"),
    sm("M261", "engine.py", 'return SensorView(sensor, status, state, regime, bias, codes, sha, fx.facts_of(sensor, status, state, regime, bias))', 'return SensorView(sensor, status, state, bias, regime, codes, sha, fx.facts_of(sensor, status, state, regime, bias))', "the regime word and the bias swap places in a view"),
    sm("M262", "engine.py", '            "state_code": self.state_code,', '            "state_code": self.regime_status,', "the input record shows the regime word as the state code"),
    sm("M263", "engine.py", '            "envelope_sha256": self.envelope_sha256,', '            "envelope_sha256": None,', "the input record forgets the envelope hash"),
    sm("M264", "engine.py", '                    reasons=result.reasons, summary=result.summary, status=rc.STALE if stale else rc.INVALID,', '                    reasons=(), summary=result.summary, status=rc.STALE if stale else rc.INVALID,', "the data stand-aside has no reason text"),
    # ------------------------------------------------------------------ synthesis/facts.py
    sm("M265", "facts.py", '_BREACH_OF = {"IN_CORRIDOR": "NONE", "UPPER_BREAKOUT": "UP", "LOWER_BREAKDOWN": "DOWN"}', '_BREACH_OF = {"IN_CORRIDOR": "NONE", "UPPER_BREAKOUT": "DOWN", "LOWER_BREAKDOWN": "UP"}', "an upper breakout is read as a breach down"),
    sm("M266", "facts.py", '    if state_code.startswith("MCD3_BULL_"):\n        return "UP"', '    if state_code.startswith("MCD3_BULL_"):\n        return "DOWN"', "a bullish consolidation is read as down"),
    sm("M267", "facts.py", '    if state_code.startswith("MCD3_BEAR_"):\n        return "DOWN"', '    if state_code.startswith("MCD3_BEAR_"):\n        return "UP"', "a bearish consolidation is read as up"),
    sm("M268", "facts.py", '    if state_code == "MCD3_SIDEWAYS_EQUILIBRIUM":\n        return "FLAT"', '    if state_code == "MCD3_SIDEWAYS_EQUILIBRIUM":\n        return "NONE"', "a flat consolidation is read as none"),
    sm("M269", "facts.py", '    if state_code.startswith("MCD3_NON_CONSOLIDATED_"):\n        return "NONE"', '    if state_code.startswith("MCD3_NON_CONSOLIDATED_"):\n        return "FLAT"', "no consolidation is read as flat"),
    sm("M270", "facts.py", '    if status not in AVAILABLE_STATUSES:\n        return facts', '    if False:\n        return facts', "an unavailable sensor keeps the facts it was given"),
    sm("M271", "facts.py", '    elif sensor_id in DERIVED_SENSORS:\n        facts["consolidation"] = consolidation_of(state_code)', '    elif False:\n        facts["consolidation"] = consolidation_of(state_code)', "MCD3 has no consolidation fact"),
    sm("M272", "facts.py", '(UP|DOWN|SIDEWAYS)', '(UP|DOWN)', "a sideways channel state is not read"),
    sm("M273", "facts.py", '        if sensor_id in CHANNEL_SENSORS and channel_facts(code) is None:', '        if sensor_id in CHANNEL_SENSORS and channel_facts(code) is not None:', "an unreadable channel state is not reported"),
    sm("M274", "facts.py", '        if sensor_id in DERIVED_SENSORS and consolidation_of(code) is None:', '        if sensor_id in DERIVED_SENSORS and consolidation_of(code) is not None:', "an unreadable MCD3 state is not reported"),
    sm("M275", "facts.py", '    if sensor_id in CHANNEL_SENSORS:\n        return CHANNEL_FACTS', '    if sensor_id in CHANNEL_SENSORS:\n        return DERIVED_FACTS', "the channel sensors get MCD3's facts"),
    sm("M276", "facts.py", 'trend, position = found.group(1), found.group(2)', 'trend, position = found.group(2), found.group(1)', "the trend and the position of a channel state swap places"),
    # ------------------------------------------------------------------ synthesis/rules.py
    sm("M277", "rules.py", '    if top.get("schema") != RULES_SCHEMA:', '    if False:', "the schema name of the rules file is not checked"),
    sm("M278", "rules.py", '    elif expected_version is not None and version != expected_version:', '    elif False:', "a rules file may carry another version than its name"),
    sm("M279", "rules.py", '    if status not in STATUSES:', '    if False:', "any status of the rules file is accepted"),
    sm("M280", "rules.py", '            if key in seen:', '            if False:', "a key written twice in the file is accepted"),
    sm("M281", "rules.py", '            if key not in known:', '            if False:', "an unknown key is accepted"),
    sm("M282", "rules.py", '            if key not in value:', '            if False:', "a missing key is accepted"),
    sm("M283", "rules.py", '            elif item not in allowed:', '            elif False:', "a word outside the allowed ones is accepted"),
    sm("M284", "rules.py", '        if len(set(value)) != len(value):', '        if False:', "a value listed twice is accepted"),
    sm("M285", "rules.py", '    if sensor != PRIMARY and sensor not in sensors:', '    if False:', "a condition may name an unknown sensor"),
    sm("M286", "rules.py", '        if fact != "status":', '        if False:', "PRIMARY may be tested for more than its status"),
    sm("M287", "rules.py", '    if fact not in known_facts:', '    if False:', "a condition may name a fact the sensor does not have"),
    sm("M288", "rules.py", '        if archetype is None or trend is None:', '        if archetype is None and trend is None:', "a direction may lack an archetype or a trend relation"),
    sm("M289", "rules.py", '    elif trend is not None:', '    elif False:', "a result that is not a direction may carry a trend relation"),
    sm("M290", "rules.py", '        if result.bias != "STAND_ASIDE":', '        if False:', "a data stand-aside may carry a direction"),
    sm("M291", "rules.py", '        if result.archetype is not None:', '        if False:', "a data stand-aside may carry an archetype"),
    sm("M292", "rules.py", '        if raw_when and any(c.sensor != PRIMARY or c.fact != "status" for c in conditions):', '        if False:', "a data stand-aside may test more than the primary status"),
    sm("M293", "rules.py", '    if needs_sensor and sensor is None:', '    if False:', "a primary_first branch may have no sensor"),
    sm("M294", "rules.py", '                if branch.id in seen:', '                if False:', "a branch id may be used twice in a row"),
    sm("M295", "rules.py", '            if rule.id in seen_ids:', '            if False:', "a rule id may be used twice"),
    sm("M296", "rules.py", '            if modifier.id in seen_mods:', '            if False:', "a modifier id may be used twice"),
    sm("M297", "rules.py", '            if first is not None and profile in primary and any(', '            if False and any(', "the data check need not be the first row"),
    sm("M298", "rules.py", '            if raw_rows and not any(profile in r.profiles for r in rows):', '            if False:', "a trader type may have no row"),
    sm("M299", "rules.py", '        if body.get("bias") != "NEUTRAL":', '        if False:', "no match may be anything but NEUTRAL"),
    sm("M300", "rules.py", '    if not isinstance(raw_mods, list):', '    if False:', "the modifiers need not be a list"),
    sm("M301", "rules.py", '    if effect not in EFFECTS:', '    if False:', "a modifier may have any effect"),
    sm("M302", "rules.py", '    if "rules" in body:', '    if False:', "a modifier's row restriction is ignored"),
    sm("M303", "rules.py", 'sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False)', 'sort_keys=False, separators=(",", ":"), ensure_ascii=True, allow_nan=False)', "the checksum depends on the order of the keys"),
    sm("M304", "rules.py", 'sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False)', 'sort_keys=True, separators=(", ", ": "), ensure_ascii=True, allow_nan=False)', "the checksum depends on the JSON spacing"),
    sm("M305", "rules.py", 'sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False)', 'sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)', "the checksum depends on how non-ASCII text is written"),
    sm("M306", "rules.py", '_VERSION_RE = re.compile(r"[a-z0-9][a-z0-9._-]*")', '_VERSION_RE = re.compile(r"[a-zA-Z0-9][a-zA-Z0-9._-]*")', "an upper-case version name is accepted"),
    sm("M307", "rules.py", '_RULE_ID_RE = re.compile(r"R[0-9]+S?_[A-Z0-9_]+")', '_RULE_ID_RE = re.compile(r"R[0-9]+_[A-Z0-9_]+")', "a rule id with an S suffix is refused"),
    sm("M308", "rules.py", '_ID_RE = re.compile(r"[A-Z0-9_]+")', '_ID_RE = re.compile(r"[A-Za-z0-9_]+")', "a lower-case branch or modifier id is accepted"),
    sm("M309", "rules.py", '    found = wording.check_summary_line(text) if summary else wording.check_text(where, text)', '    found = wording.check_text(where, text)', "a summary may be longer than 80 characters or show a price"),
    sm("M310", "rules.py", '        if sensor not in vocabulary:\n            chk.add("sensors"', '        if False:\n            chk.add("sensors"', "a sensor missing from the registry is accepted"),
    sm("M311", "rules.py", '            for problem in fx.register_problems(sensor, vocabulary[sensor].state_codes):', '            for problem in []:', "a register state the facts cannot read is accepted"),
    sm("M312", "rules.py", '                if sensor not in fx.CHANNEL_SENSORS or sensor not in sensors:', '                if sensor not in sensors:', "the primary sensor may be MCD3"),
    sm("M313", "rules.py", 'named = {primary if c.sensor == PRIMARY else c.sensor for c in self.when}', 'named = {c.sensor for c in self.when}', "PRIMARY is not resolved when the sensors a branch reads are listed"),
    sm("M314", "rules.py", '        return tuple(r for r in self.rules if profile in r.profiles)', '        return tuple(self.rules)', "every row applies to every trader type"),
    sm("M315", "rules.py", 'regime_words=frozenset(s.regime_status for s in states.values() if s.regime_status),', 'regime_words=frozenset(),', "no regime word is known to the loader"),
    # ------------------------------------------------------------------ synthesis/reading.py
    sm("M316", "reading.py", '        "stand_aside": decision.stand_aside,', '        "stand_aside": False,', "a stand-aside reading says it does not stand aside"),
    sm("M317", "reading.py", '        "zones": list(zones),', '        "zones": [],', "the zones are dropped from the reading"),
    sm("M318", "reading.py", '        "status_reasons": list(decision.status_reasons),', '        "status_reasons": [],', "the status reasons are dropped from the reading"),
    sm("M319", "reading.py", '        "rules_sha256": rules.sha256,', '        "rules_sha256": "0" * 64,', "the reading names no real rules checksum"),
    sm("M320", "reading.py", '    "rule_id",\n    "branch_id",\n    "status",', '    "branch_id",\n    "rule_id",\n    "status",', "two keys of the canonical form swap places"),
    sm("M321", "reading.py", 'INPUT_ORDER = ("status", "state_code", "regime_status", "bias", "envelope_sha256")', 'INPUT_ORDER = ("state_code", "status", "regime_status", "bias", "envelope_sha256")', "two keys of an input record swap places"),
    sm("M322", "reading.py", 'return json.dumps(canonical(reading), ensure_ascii=True, separators=(",", ":"))', 'return json.dumps(canonical(reading), ensure_ascii=False, separators=(",", ":"))', "the canonical text may hold non-ASCII characters"),
    sm("M323", "reading.py", 'return json.dumps(canonical(reading), ensure_ascii=True, separators=(",", ":"))', 'return json.dumps(canonical(reading), ensure_ascii=True)', "the canonical text has spaces between its tokens"),
    sm("M324", "reading.py", '    if isinstance(value, float) and (value != value or value in (float("inf"), float("-inf"))):', '    if False:', "NaN and infinity are accepted in a reading"),
    sm("M325", "reading.py", '        elif isinstance(code, str) and _MODIFIER_CAUTION_RE.fullmatch(code):', '        elif False:', "a modifier caution code is not a known reason code"),
    sm("M326", "reading.py", '_MODIFIER_CAUTION_RE = re.compile(rf"{MODIFIER_CAUTION}:MCD3_[A-Z0-9_]+")', '_MODIFIER_CAUTION_RE = re.compile(rf"{MODIFIER_CAUTION}:MCD[0-9]+_[A-Z0-9_]+")', "a modifier caution may name a state of any MCD"),
    sm("M327", "reading.py", '    if status == rc.VALID and reasons:', '    if False:', "a VALID reading may have reason codes"),
    sm("M328", "reading.py", '    elif status == rc.CAUTIONARY and (not reasons or any(s != rc.CAUTIONARY for s in statuses)):', '    elif status == rc.CAUTIONARY and (any(s != rc.CAUTIONARY for s in statuses)):', "a CAUTIONARY reading may have no reason codes"),
    sm("M329", "reading.py", '    elif status == rc.CAUTIONARY and (not reasons or any(s != rc.CAUTIONARY for s in statuses)):', '    elif status == rc.CAUTIONARY and (not reasons):', "a CAUTIONARY reading may carry a code of another status"),
    sm("M330", "reading.py", '    elif status in (rc.INVALID, rc.STALE) and status not in statuses:', '    elif False:', "an unavailable reading needs no code of its own status"),
    sm("M331", "reading.py", '    if canon.get("rules_version") != rules.version:', '    if False:', "the rules version is not checked"),
    sm("M332", "reading.py", '    if canon.get("rules_sha256") != rules.sha256:', '    if False:', "the rules checksum is not checked"),
    sm("M333", "reading.py", '    if rule_id == NO_MATCH_ID:\n        return problems', '    if False:\n        return problems', "NO_MATCH is looked up as a row"),
    sm("M334", "reading.py", '        if profile not in row.profiles:', '        if False:', "a rule that does not apply to the trader type is accepted"),
    sm("M335", "reading.py", '        if branch_id not in {b.id for b in row.branches}:', '        if False:', "a branch that is not the rule's is accepted"),
    sm("M336", "reading.py", '    for key in ("rule_id", "branch_id"):', '    for key in ("rule_id",):', "a banned word in a branch id is accepted"),
    sm("M337", "reading.py", '"details": {"reasons": canon.get("reasons")}}', '"details": {"reasons": None}}', "the reason texts are not checked for banned words"),
    sm("M338", "reading.py", '    if rules is not None:\n        problems += identity_problems(canon, rules)', '    if False:\n        problems += identity_problems(canon, rules)', "the identity guard is skipped"),
    sm("M339", "reading.py", '    if not isinstance(reading, Mapping):\n        return [f"SCHEMA: the reading is a', '    if False:\n        return [f"SCHEMA: the reading is a', "a reading that is not a mapping is not refused as such"),
    sm("M340", "reading.py", '    if not is_slot(cycle_slot):', '    if False:', "a cycle slot that is not on the 5-minute grid is accepted"),
    sm("M341", "reading.py", 'for p in problems) else ""', 'for p in problems) else "{}"', "an unwritable reading gets a text"),
    sm("M343", "reading.py", '        sha256=sha256_text(text) if text else "",', '        sha256=sha256_text(text),', "an unwritable reading gets the hash of nothing"),
    sm("M344", "reading.py", '        return not self.problems', '        return True', "a reading with problems says it is ok"),
    sm("M345", "reading.py", '            zones=(zones or {}).get(profile, ()),', '            zones=(zones or {}).get("DAY_TRADER", ()),', "every trader type gets the Day Trader's zones"),
    sm("M346", "reading.py", '        for profile in PROFILES\n    }', '        for profile in reversed(PROFILES)\n    }', "the Scalper reading comes before the Day Trader's"),
    # ------------------------------------------------------------------ synthesis/engine.py: the echoes of an upstream sensor's caution (build step 4, part 2)
    sm("M347", "engine.py", '                bucket = echoes if code.startswith(ECHO_PREFIX) else codes', '                bucket = codes', "an upstream sensor's echo is carried as a reason"),
    sm("M348", "engine.py", '                bucket = echoes if code.startswith(ECHO_PREFIX) else codes', '                bucket = echoes', "every code is treated as an echo"),
    sm("M349", "engine.py", '    if cautionary and not codes:\n        codes = echoes', '    if cautionary and not codes:\n        codes = []', "a CAUTIONARY reading with only echoes has no reason"),
    sm("M350", "engine.py", '    if cautionary and not codes:\n        codes = echoes', '    if cautionary:\n        codes = echoes', "the echoes replace the real reasons"),
    sm("M351", "engine.py", 'ECHO_PREFIX = "UPSTREAM_CAUTIONARY:"', 'ECHO_PREFIX = "UPSTREAM_STALE:"', "the wrong code is taken for an echo"),
    # ------------------------------------------------------------------ synthesis/zones.py: numbers and parameters
    zm("M352", "zones.py", '    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):', '    if not isinstance(value, (int, float, Decimal)):', "a bool is taken for a number"),
    zm("M353", "zones.py", 'number = Decimal(repr(value)) if isinstance(value, float) else Decimal(value)', 'number = Decimal(value)', "a float is read as its binary expansion"),
    zm("M354", "zones.py", '    return number if number.is_finite() else None', '    return number', "NaN and infinity are taken for numbers"),
    zm("M355", "zones.py", 'return value.quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP)', 'return value.quantize(Decimal(1).scaleb(-places), rounding="ROUND_HALF_EVEN")', "rounding goes to even instead of half up"),
    zm("M356", "zones.py", 'return value.quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP)', 'return value.quantize(Decimal(1).scaleb(-places + 1), rounding=ROUND_HALF_UP)', "a price is rounded to one decimal too few"),
    zm("M357", "zones.py", '    if top.get("schema") != ZONE_PARAMS_SCHEMA:', '    if False:', "the schema name of the zone parameters is not checked"),
    zm("M358", "zones.py", '    if not (isinstance(version, str) and re.fullmatch(r"zones-[0-9]+", version)):', '    if False:', "any version name of the zone parameters is accepted"),
    zm("M359", "zones.py", '    if status not in ("draft", "approved"):', '    if False:', "any status of the zone parameters is accepted"),
    zm("M360", "zones.py", 'if number is None or (integer and (isinstance(raw, float) or number != number.to_integral_value())):', 'if number is None:', "a whole-number parameter may be a fraction"),
    zm("M361", "zones.py", '            elif not ok(number):', '            elif False:', "a parameter out of its range is accepted"),
    zm("M362", "zones.py", '"half_width_fraction": (False, "above 0 and at most 1", lambda v: 0 < v <= 1),', '"half_width_fraction": (False, "above 0 and at most 1", lambda v: 0 <= v <= 1),', "a half-width fraction of 0 is accepted"),
    zm("M363", "zones.py", '"half_width_fraction": (False, "above 0 and at most 1", lambda v: 0 < v <= 1),', '"half_width_fraction": (False, "above 0 and at most 1", lambda v: 0 < v < 1),', "a half-width fraction of 1 is refused"),
    zm("M364", "zones.py", '"invalidation_buffer": (False, "0 or more", lambda v: v >= 0),', '"invalidation_buffer": (False, "0 or more", lambda v: v > 0),', "a buffer of 0 is refused"),
    zm("M365", "zones.py", '"min_stop_distance": (False, "above 0", lambda v: v > 0),', '"min_stop_distance": (False, "above 0", lambda v: v >= 0),', "a minimum stop of 0 is accepted"),
    zm("M366", "zones.py", '"max_zones": (True, "1 to 5 (zone ids are Z1 to Z5)", lambda v: 1 <= v <= 5),', '"max_zones": (True, "1 to 5 (zone ids are Z1 to Z5)", lambda v: 1 <= v <= 6),', "six zones are allowed"),
    zm("M367", "zones.py", '"max_zones": (True, "1 to 5 (zone ids are Z1 to Z5)", lambda v: 1 <= v <= 5),', '"max_zones": (True, "1 to 5 (zone ids are Z1 to Z5)", lambda v: 0 <= v <= 5),', "no zones at all is allowed"),
    zm("M368", "zones.py", '"price_decimals": (True, "0 to 4", lambda v: 0 <= v <= 4),', '"price_decimals": (True, "0 to 4", lambda v: 0 <= v <= 5),', "five price decimals are allowed"),
    zm("M369", "zones.py", '"ratio_decimals": (True, "0 to 4", lambda v: 0 <= v <= 4),', '"ratio_decimals": (True, "0 to 4", lambda v: -1 <= v <= 4),', "a negative number of ratio decimals is allowed"),
    zm("M370", "zones.py", '                values[name] = int(number) if integer else number', '                values[name] = number', "a whole-number parameter is kept as a decimal"),
    zm("M371", "zones.py", '            for key in ("unit", "boundary", "why"):', '            for key in ("unit", "boundary"):', "a parameter need not say why"),
    # ------------------------------------------------------------------ zones.py: the levels
    zm("M372", "zones.py", '    if not (isinstance(name, str) and name and tf in TIMEFRAMES and price is not None and price > 0):', '    if not (isinstance(name, str) and name and tf in TIMEFRAMES and price is not None):', "a level at a price of 0 or less is accepted"),
    zm("M373", "zones.py", '        if key not in seen:\n            seen.add(key)\n            out.append(level)', '        if True:\n            seen.add(key)\n            out.append(level)', "a level that appears twice is kept twice"),
    zm("M374", "zones.py", '        key = (level.tf, level.name, level.price)', '        key = (level.name, level.price)', "two lines of two timeframes with one name and price are one level"),
    zm("M375", "zones.py", '        if not view_of(sensor, reading).available:\n            continue', '        if False:\n            continue', "the levels of an unavailable sensor are used"),
    zm("M376", "zones.py", '    for sensor in fx.SENSORS:\n        reading = readings.get(sensor)', '    for sensor in reversed(fx.SENSORS):\n        reading = readings.get(sensor)', "the levels are taken from the last sensor first"),
    zm("M377", "zones.py", '            if price is None or price <= 0 or (name, price) in seen:', '            if price is None or price <= 0:', "the same support level on two timeframes is two levels"),
    zm("M378", "zones.py", 'origin="sr_levels" if int(name[3:]) <= 8 else "sr2_levels"', 'origin="sr_levels" if int(name[3:]) < 8 else "sr2_levels"', "sr_8 is taken for the second calibration"),
    zm("M379", "zones.py", '_SR_NAME = re.compile(r"sr_([1-9]|1[0-6])")', '_SR_NAME = re.compile(r"sr_([1-9]|1[0-7])")', "sr_17 is a support level"),
    zm("M380", "zones.py", '_SR_NAME = re.compile(r"sr_([1-9]|1[0-6])")', '_SR_NAME = re.compile(r"sr_([0-9]|1[0-6])")', "sr_0 is a support level"),
    zm("M381", "zones.py", '    for tf in TIMEFRAMES:\n        row = context.get(tf)', '    for tf in reversed(TIMEFRAMES):\n        row = context.get(tf)', "the support levels are read from the M15 row first"),
    zm("M382", "zones.py", '    last = max(bars, key=lambda b: b["timestamp"])', '    last = bars[-1]', "the reference bar is the last in the list, not the latest in time"),
    zm("M383", "zones.py", '    return price if price is not None and price > 0 else None', '    return price', "a reference price of 0 or less is accepted"),
    # ------------------------------------------------------------------ zones.py: building the zones
    zm("M384", "zones.py", '    if bias not in DIRECTIONAL:\n        return _empty(NOT_DIRECTIONAL, bias, p_ref, params)', '    if False:\n        return _empty(NOT_DIRECTIONAL, bias, p_ref, params)', "a bias that is not a direction builds zones"),
    zm("M385", "zones.py", '    if p_ref is None or p_ref <= 0:', '    if p_ref is None:', "a reference price of 0 or less builds zones"),
    zm("M386", "zones.py", 'structure = _dedupe(replace(level, price=quantize(level.price, places)) for level in levels)', 'structure = _dedupe(levels)', "level prices are not taken to cents"),
    zm("M387", "zones.py", 'if level.is_channel and level.name in ("UOEDT", "LOEDT"):', 'if level.is_channel and level.name in ("UOEDT", "baseline"):', "the width is measured from the baseline"),
    zm("M388", "zones.py", 'for key, pair in lines.items() if len(pair) == 2 and pair["UOEDT"] > pair["LOEDT"]}', 'for key, pair in lines.items() if len(pair) == 2 and pair["UOEDT"] >= pair["LOEDT"]}', "a channel of no width has one"),
    zm("M389", "zones.py", 'for key, pair in lines.items() if len(pair) == 2 and pair["UOEDT"] > pair["LOEDT"]}', 'for key, pair in lines.items() if len(pair) == 2}', "an upside-down channel has a width"),
    zm("M390", "zones.py", '    if level.tf == CHANNEL_TF\n        and (level.price < p_ref', '    if level.tf != CHANNEL_TF\n        and (level.price < p_ref', "the M15 levels are the zone sources"),
    zm("M391", "zones.py", 'and (level.price < p_ref if long else level.price > p_ref)', 'and (level.price <= p_ref if long else level.price >= p_ref)', "a level equal to the price is on the bias side"),
    zm("M392", "zones.py", 'and (level.price < p_ref if long else level.price > p_ref)', 'and (level.price > p_ref if long else level.price < p_ref)', "zones are made on the wrong side of the price"),
    zm("M393", "zones.py", 'for half in [quantize(params.half_width_fraction * widths[(level.origin, level.tf)], places)]', 'for half in [params.half_width_fraction * widths[(level.origin, level.tf)]]', "the half-width is not rounded to cents"),
    zm("M394", "zones.py", '        key=lambda s: (s[0], s[2].price, s[2].name),', '        key=lambda s: (s[2].name, s[0]),', "the zones are merged in the wrong order"),
    zm("M395", "zones.py", 'if groups and low <= groups[-1][1]:', 'if groups and low < groups[-1][1]:', "zones that touch do not merge"),
    zm("M396", "zones.py", 'groups[-1][1] = max(groups[-1][1], high)', 'groups[-1][1] = high', "a zone inside a bigger one shrinks it"),
    zm("M397", "zones.py", 'reference = max(m.price for m in members) if long else min(m.price for m in members)', 'reference = min(m.price for m in members) if long else max(m.price for m in members)', "a merged zone takes the member farthest from the price"),
    zm("M398", "zones.py", 'if low <= lv.price <= high)', 'if low < lv.price < high)', "a level on the edge of a zone is not confluence"),
    zm("M399", "zones.py", 'key=lambda lv: (lv.price, lv.tf, lv.name, lv.origin)))', 'key=lambda lv: (lv.name, lv.tf, lv.origin)))', "the confluence levels are not in price order"),
    zm("M400", "zones.py", '(lv.price < low if long else lv.price > high)], highest=long)', '(lv.price <= low if long else lv.price >= high)], highest=long)', "a level on the zone's edge is past the zone"),
    zm("M401", "zones.py", '(lv.price < low if long else lv.price > high)], highest=long)', '(lv.price < high if long else lv.price > low)], highest=long)', "a level inside the zone is past it"),
    zm("M402", "zones.py", '(lv.price < low if long else lv.price > high)], highest=long)', '(lv.price < low if long else lv.price > high)], highest=not long)', "the farthest level past the zone is used instead of the nearest"),
    zm("M403", "zones.py", 'invalidation = reference - params.min_stop_distance if long else reference + params.min_stop_distance', 'invalidation = reference + params.min_stop_distance if long else reference - params.min_stop_distance', "the minimum stop is on the wrong side"),
    zm("M404", "zones.py", 'from_level = past.price - params.invalidation_buffer if long else past.price + params.invalidation_buffer', 'from_level = past.price + params.invalidation_buffer if long else past.price - params.invalidation_buffer', "the buffer is on the wrong side of the level"),
    zm("M405", "zones.py", 'if (reference - from_level if long else from_level - reference) >= params.min_stop_distance:', 'if (reference - from_level if long else from_level - reference) > params.min_stop_distance:', "a stop of exactly the minimum is raised"),
    zm("M406", "zones.py", '            else:\n                basis = BASIS_MINIMUM', '            else:\n                basis = BASIS_LEVEL', "a raised stop is said to sit on a level"),
    zm("M407", "zones.py", '        invalidation = quantize(invalidation, places)', '        invalidation = invalidation', "the invalidation is not taken to cents"),
    zm("M408", "zones.py", '(lv.price > reference if long else lv.price < reference)], highest=not long)', '(lv.price >= reference if long else lv.price <= reference)], highest=not long)', "a level at the reference price is an opposing level"),
    zm("M409", "zones.py", '(lv.price > reference if long else lv.price < reference)], highest=not long)', '(lv.price > reference if long else lv.price < reference)], highest=long)', "the farthest opposing level is used instead of the nearest"),
    zm("M410", "zones.py", 'ratio = None if runway is None else quantize(runway / stop, params.ratio_decimals)', 'ratio = None if runway is None else quantize(runway / stop, params.price_decimals)', "the ratio is rounded with the price decimals"),
    zm("M411", "zones.py", '(0, Decimal(0)) if zone.runway_ratio is None else (1, -zone.runway_ratio)', '(1, Decimal(0)) if zone.runway_ratio is None else (0, -zone.runway_ratio)', "a zone with no opposing level ranks last on the ratio"),
    zm("M412", "zones.py", '(0, Decimal(0)) if zone.runway_ratio is None else (1, -zone.runway_ratio)', '(0, Decimal(0)) if zone.runway_ratio is None else (1, zone.runway_ratio)', "the smaller ratio ranks first"),
    zm("M413", "zones.py", 'return (-zone.confluence_count, ratio_key, abs(zone.reference_price - p_ref))', 'return (zone.confluence_count, ratio_key, abs(zone.reference_price - p_ref))', "the smaller confluence ranks first"),
    zm("M414", "zones.py", 'return (-zone.confluence_count, ratio_key, abs(zone.reference_price - p_ref))', 'return (-zone.confluence_count, ratio_key, -abs(zone.reference_price - p_ref))', "the zone farther from the price ranks first"),
    zm("M415", "zones.py", 'return (-zone.confluence_count, ratio_key, abs(zone.reference_price - p_ref))', 'return (-zone.confluence_count, abs(zone.reference_price - p_ref), ratio_key)', "the distance is ranked before the ratio"),
    zm("M416", "zones.py", 'ranked = sorted(built, key=key)[: params.max_zones]', 'ranked = sorted(built, key=key)[: params.max_zones + 1]', "one zone too many is kept"),
    zm("M417", "zones.py", 'for index, zone in enumerate(ranked, start=1)', 'for index, zone in enumerate(ranked, start=0)', "the zones are numbered from 0"),
    zm("M418", "zones.py", 'best = max(c.price for c in candidates) if highest else min(c.price for c in candidates)', 'best = min(c.price for c in candidates) if highest else max(c.price for c in candidates)', "the highest and the lowest candidate swap"),
    zm("M419", "zones.py", 'key=lambda c: (c.tf, c.name, c.origin))[0]', 'key=lambda c: (c.tf, c.name, c.origin))[-1]', "of two levels at one price the last by name is chosen"),
    zm("M420", "zones.py", 'source_levels=tuple(sorted(members, key=lambda m: (m.price, m.name))),', 'source_levels=tuple(sorted(members, key=lambda m: (m.price, m.name), reverse=True)),', "the source levels are listed highest first"),
    # ------------------------------------------------------------------ zones.py: the guard
    zm("M421", "zones.py", '    if missing:', '    if False:', "a zone with keys missing is accepted"),
    zm("M422", "zones.py", '    if bad:', '    if False:', "a zone with a price that is not a number is accepted"),
    zm("M423", "zones.py", '    if not (isinstance(zone["rank"], int) and not isinstance(zone["rank"], bool) and 1 <= zone["rank"] <= params.max_zones):', '    if False:', "a rank outside 1 to 5 is accepted"),
    zm("M424", "zones.py", '''    elif zone["zone_id"] != f"Z{zone['rank']}":''', '    elif False:', "a zone id that does not match its rank is accepted"),
    zm("M425", "zones.py", '    if zone["bias"] not in DIRECTIONAL:', '    if False:', "a zone with no direction is accepted"),
    zm("M426", "zones.py", '        if (_places(zone[key]) or 0) > params.price_decimals:', '        if False:', "a price with more than two decimals is accepted"),
    zm("M427", "zones.py", '    if not low <= ref <= high:', '    if False:', "a reference price outside its zone is accepted"),
    zm("M428", "zones.py", '    if zone["bias"] in DIRECTIONAL and not (inv < ref if long else inv > ref):', '    if False:', "an invalidation on the wrong side is accepted"),
    zm("M429", "zones.py", '    if stop != abs(ref - inv):', '    if False:', "a stop distance that is not the distance is accepted"),
    zm("M430", "zones.py", '    if stop < params.min_stop_distance:', '    if False:', "a stop under the minimum is accepted"),
    zm("M431", "zones.py", '    if basis not in BASES:', '    if False:', "an unknown invalidation basis is accepted"),
    zm("M432", "zones.py", '    elif basis == BASIS_NO_LEVEL and level is not None:', '    elif False:', "a zone with no level past it may name one"),
    zm("M433", "zones.py", '    elif basis != BASIS_NO_LEVEL and level is None:', '    elif False:', "a basis on a level may name none"),
    zm("M434", "zones.py", '    if basis in (BASIS_MINIMUM, BASIS_NO_LEVEL) and stop != params.min_stop_distance:', '    if False:', "a raised stop need not be the minimum"),
    zm("M435", "zones.py", '        if price is not None and inv != price - params.invalidation_buffer * (1 if long else -1):', '        if False:', "an invalidation need not be the buffer beyond its level"),
    zm("M436", "zones.py", '    if not isinstance(levels, list) or count != len(levels) or count < 1:', '    if False:', "a confluence count need not match its levels"),
    zm("M437", "zones.py", '        if zone["runway"] is not None or zone["runway_ratio"] is not None:', '        if False:', "a zone with no opposing level may have a runway"),
    zm("M438", "zones.py", '        if price is None or runway is None or ratio is None:', '        if False:', "an opposing level may have no runway"),
    zm("M439", "zones.py", '            if not (price > ref if long else price < ref):', '            if False:', "an opposing level may be on the wrong side"),
    zm("M440", "zones.py", '            if runway != abs(price - ref):', '            if False:', "a runway need not be the distance"),
    zm("M441", "zones.py", '            if ratio != quantize(runway / stop, params.ratio_decimals):', '            if False:', "a ratio need not be the runway over the stop"),
    # ------------------------------------------------------------------ synthesis/pills.py
    zm("M442", "pills.py", 'return tuple(float(zone.reference_price) for zone in sorted(zones, key=lambda z: z.rank))', 'return tuple(float(zone.reference_price) for zone in zones)', "the pills follow the list, not the rank"),
    zm("M443", "pills.py", 'return tuple(float(zone.reference_price) for zone in sorted(zones, key=lambda z: z.rank))', 'return tuple(float(zone.low) for zone in sorted(zones, key=lambda z: z.rank))', "a pill is the low edge of a zone"),
    zm("M444", "pills.py", 'return tuple(float(zone.reference_price) for zone in sorted(zones, key=lambda z: z.rank))', 'return tuple(float(zone.reference_price) for zone in sorted(zones, key=lambda z: z.rank, reverse=True))', "the pills come worst first"),
    zm("M445", "pills.py", '        and not isinstance(row.get("rank"), bool)\n', '', "a bool is a rank"),
    zm("M446", "pills.py", '        and not isinstance(row.get("reference_price"), bool)\n', '', "a bool is a price"),
    zm("M447", "pills.py", '        and isinstance(row.get("rank"), int)\n', '', "a row with no rank is a pill"),
    zm("M448", "pills.py", 'sorted(usable, key=lambda r: r["rank"])', 'sorted(usable, key=lambda r: -r["rank"])', "the pills of stored rows come worst first"),
    # ------------------------------------------------------------------ cycle_runner.py: the synthesis step (build step 4, part 3)
    rm("M449", "cycle_runner.py", "        if self.synthesizer is None or self.synthesis_flag == FLAG_OFF:\n", "        if self.synthesizer is None:\n", "a synthesizer runs although the SYN flag is off"),
    rm("M450", "cycle_runner.py", "allowed = (FLAG_SHADOW, FLAG_LIVE) if self.synthesis_flag == FLAG_SHADOW else (FLAG_LIVE,)", "allowed = (FLAG_SHADOW, FLAG_LIVE)", "a live synthesis reads shadow sensors"),
    rm("M451", "cycle_runner.py", "allowed = (FLAG_SHADOW, FLAG_LIVE) if self.synthesis_flag == FLAG_SHADOW else (FLAG_LIVE,)", "allowed = (FLAG_LIVE,)", "a shadow synthesis reads live sensors only"),
    rm("M452", "cycle_runner.py", "if self.flags[mcd_id] in allowed}", "if self.flags[mcd_id] not in allowed}", "synthesis reads the sensors it may not"),
    rm("M453", "cycle_runner.py", "result = self.synthesizer.run(self.synthesis_flag, visible, inputs)", "result = self.synthesizer.run(self.synthesis_flag, envelopes, inputs)", "synthesis reads every sensor whatever its flag"),
    rm("M454", "cycle_runner.py", "        except Exception:  # noqa: BLE001 - synthesis must never cost", "        except KeyError:  # noqa: BLE001 - synthesis must never cost", "an exception in synthesis costs the cycle its readings"),
    rm("M455", "cycle_runner.py", "            result = self.synthesizer.failed(self.synthesis_flag)\n", "            result = None\n", "a failed synthesis leaves no word that it failed"),
    rm("M456", "cycle_runner.py", "if self.synthesis is not None else {}),\n        }\n\n    def to_dict", "if self.synthesis is not None else {\"synthesis\": None}),\n        }\n\n    def to_dict", "a result with synthesis off carries a synthesis key"),
    rm("M457", "cycle_runner.py", "**({\"synthesis_ms\": self.synthesis_ms} if self.synthesis_ms is not None else {}),", "\"synthesis_ms\": self.synthesis_ms,", "a result with synthesis off carries a synthesis time"),
    rm("M458", "cycle_runner.py", "        problems += synthesis_flag_problems(synthesis_flag, flags)\n", "", "a SYN flag higher than the sensors it reads is accepted"),
    rm("M459", "cycle_runner.py", "        if synthesis_flag in (FLAG_SHADOW, FLAG_LIVE) and synthesizer is None:", "        if False:", "a SYN flag that needs a synthesizer starts without one"),
    rm("M460", "cycle_runner.py", "        if synthesis_flag in (FLAG_SHADOW, FLAG_LIVE):\n            synthesizer = Synthesizer.load(", "        if synthesis_flag != \"never\":\n            synthesizer = Synthesizer.load(", "the rules are read although synthesis is off"),
    rm("M461", "cycle_runner.py", "overrides.pop(SYN_ID, config.synthesis_flag)", "overrides.get(SYN_ID, config.synthesis_flag)", "the SYN flag is also taken for an MCD flag"),
    rm("M462", "cycle_runner.py", "Synthesizer.load(registry, rules_version=rules_version or config.rules_version)", "Synthesizer.load(registry, rules_version=config.rules_version)", "a rules version given to load is ignored"),
    rm("M463", "cycle_runner.py", "            synthesis_flag=self.synthesis_flag,\n            synthesis=synthesis,", "            synthesis_flag=FLAG_OFF,\n            synthesis=synthesis,", "a result names the wrong SYN flag"),
    rm("M464", "cycle_runner.py", "        synthesis, synthesis_ms = self._synthesize(inputs, envelopes)\n", "        synthesis, synthesis_ms = None, None\n", "synthesis never runs"),
    # ------------------------------------------------------------------ synthesis/cycle.py
    rm("M465", "synthesis/cycle.py", "levels_from_readings(readings) + sr_levels_from_context(inputs.context_levels)", "levels_from_readings(readings)", "the bundle's context levels are not zone sources"),
    rm("M466", "synthesis/cycle.py", "levels_from_readings(readings) + sr_levels_from_context(inputs.context_levels)", "sr_levels_from_context(inputs.context_levels)", "the sensors' channel lines are not zone sources"),
    rm("M467", "synthesis/cycle.py", "            if problems:  # a zone that is not consistent", "            if False:  # a zone that is not consistent", "a zone that fails its guard is kept"),
    rm("M468", "synthesis/cycle.py", "            if not reading.ok:  # a zone only means something beside its reading", "            if False:  # a zone only means something beside its reading", "zones of a refused reading are kept"),
    rm("M469", "synthesis/cycle.py", "guard_problems=(*reading.problems, *problems),", "guard_problems=(*problems,),", "a refused reading's problems are lost"),
    rm("M470", "synthesis/cycle.py", "guard_problems=(*reading.problems, *problems),", "guard_problems=(*reading.problems,),", "a refused zone's problems are lost"),
    rm("M471", "synthesis/cycle.py", "\"reading_json\": self.reading.canonical_json if self.saved else None,", "\"reading_json\": self.reading.canonical_json,", "a refused reading's text is offered for saving"),
    rm("M472", "synthesis/cycle.py", "\"reading_sha256\": self.reading.sha256 if self.saved else None,", "\"reading_sha256\": self.reading.sha256,", "a refused reading's hash is offered for saving"),
    rm("M473", "synthesis/cycle.py", "return hashlib.sha256(text.encode(\"utf-8\")).hexdigest()", "return hashlib.sha1(text.encode(\"utf-8\")).hexdigest()", "the zone rows are hashed with another function"),
    rm("M474", "synthesis/cycle.py", "return self._result(flag, None, (), SYNTHESIS_ERROR)", "return self._result(flag, None, (), None)", "a failed cycle does not say it failed"),
    rm("M475", "synthesis/cycle.py", "return cls(rules, load_zone_params(params_path))", "return cls(rules, load_zone_params())", "a parameters file given to load is ignored"),
    rm("M476", "synthesis/cycle.py", "directory=rules_dir)", "directory=None)", "a rules folder given to load is ignored"),
    rm("M477", "synthesis/cycle.py", "reference_price=None if p_ref is None else float(p_ref),", "reference_price=0.0 if p_ref is None else float(p_ref),", "a cycle with no reference price names one"),
    rm("M478", "synthesis/cycle.py", "zones_json=rows_json(zone_set.rows(profile, inputs.cycle_slot)),", "zones_json=rows_json(zone_set.rows(profile, inputs.cycle_slot)[:1]),", "only the best zone is kept"),
    rm("M479", "synthesis/cycle.py", "        for profile in PROFILES:\n            decision = decide(self.rules, profile, readings)", "        for profile in reversed(PROFILES):\n            decision = decide(self.rules, profile, readings)", "the Scalper is made before the Day Trader"),
    # ------------------------------------------------------------------ flags.py: the SYN flag and its configuration
    fm("M480", "flags.py", "        elif FLAG_RANK[other] < FLAG_RANK[synthesis_flag]:", "        elif FLAG_RANK[other] <= FLAG_RANK[synthesis_flag]:", "synthesis may not equal the flag of the sensors it reads"),
    fm("M481", "flags.py", "        elif FLAG_RANK[other] < FLAG_RANK[synthesis_flag]:", "        elif FLAG_RANK[other] > FLAG_RANK[synthesis_flag]:", "synthesis may be higher than the sensors it reads"),
    fm("M482", "flags.py", "    if synthesis_flag == FLAG_OFF:\n        return []", "    if False:\n        return []", "synthesis off needs sensors that are on"),
    fm("M483", "flags.py", "        if other not in FLAG_RANK:\n", "        if False:\n", "a sensor with no flag is not noticed"),
    fm("M484", "flags.py", "SYNTHESIS_REQUIRES = (\"MCD1\", \"MCD2\")", "SYNTHESIS_REQUIRES = (\"MCD1\",)", "synthesis does not wait for MCD2"),
    fm("M485", "flags.py", "SYNTHESIS_REQUIRES = (\"MCD1\", \"MCD2\")", "SYNTHESIS_REQUIRES = (\"MCD1\", \"MCD2\", \"MCD3\")", "synthesis waits for MCD3 too"),
    fm("M486", "flags.py", "extra = sorted(set(data) - {\"schema\", \"flags\", \"synthesis\"})", "extra = sorted(set(data) - {\"schema\", \"flags\"})", "the synthesis section is an unknown key"),
    fm("M487", "flags.py", "            if unknown:\n                problems.append(f\"worker config: synthesis has unknown keys {unknown}\")", "            if False:\n                problems.append(f\"worker config: synthesis has unknown keys {unknown}\")", "an unknown key of the synthesis section is accepted"),
    fm("M488", "flags.py", "_RULES_VERSION_RE = re.compile(r\"[a-z0-9][a-z0-9._-]*\")", "_RULES_VERSION_RE = re.compile(r\"[a-z0-9._-]*\")", "a rules version may start with a dash or be empty"),
    fm("M489", "flags.py", "if isinstance(value, str) and _RULES_VERSION_RE.fullmatch(value):", "if isinstance(value, str):", "any string is a rules version"),
    fm("M490", "flags.py", "    mcd_flags = {k: v for k, v in flags.items() if k != SYN_ID}", "    mcd_flags = dict(flags)", "the SYN flag is also an MCD flag"),
    fm("M491", "flags.py", "synthesis_flag=flags.get(SYN_ID, FLAG_OFF),", "synthesis_flag=flags.get(SYN_ID, FLAG_SHADOW),", "a configuration with no SYN flag runs synthesis"),
    fm("M492", "flags.py", "        if not isinstance(synthesis, Mapping):\n            problems.append(\"worker config: synthesis must be a mapping\")", "        if False:\n            problems.append(\"worker config: synthesis must be a mapping\")", "a synthesis section that is not a mapping is accepted"),
)


# --------------------------------------------------------------------------- the machinery


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def tree_hashes(root: Path) -> dict[str, str]:
    return {
        p.relative_to(root).as_posix(): sha256_file(p)
        for p in sorted(root.rglob("*"))
        if p.is_file() and "__pycache__" not in p.parts and p.suffix != ".pyc"
    }


def make_copy(destination: Path) -> None:
    for name in COPIED:
        shutil.copytree(ENGINE_DIR / name, destination / name, ignore=IGNORED)


def run_suite(engine: Path, *, failfast: bool, modules: tuple[str, ...] | None = None) -> tuple[int, str]:
    command = [sys.executable, "-B", "-m", "unittest", *(["-f"] if failfast else []), *(f"mcd_worker.tests.{name}" for name in (modules or TEST_MODULES))]
    env = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1", "PYTHONIOENCODING": "utf-8"}
    env.pop("PYTHONHASHSEED", None)
    try:  # utf-8 on purpose: the default Windows decoding (cp1252) can kill the reader thread on a degree sign in a failure message
        done = subprocess.run(command, cwd=engine, env=env, capture_output=True, encoding="utf-8", errors="replace", timeout=TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        return 124, "TIMEOUT"
    return done.returncode, done.stderr + done.stdout


def first_failure(output: str) -> str:
    for line in output.splitlines():
        found = re.match(r"^(FAIL|ERROR): (\S+) \(([^)]*)\)", line)
        if found:
            return f"{found.group(2)}"
    return "TIMEOUT" if "TIMEOUT" in output else "crash on import" if "Traceback" in output else "failed"


def count_matches(mutant: Mutant) -> int:
    return (ENGINE_DIR / mutant.path).read_text(encoding="utf-8").count(mutant.old)


def apply(mutant: Mutant, engine: Path) -> str:
    path = engine / mutant.path
    original = path.read_text(encoding="utf-8")
    if original.count(mutant.old) != 1:
        raise ValueError(f"{mutant.mutant_id}: pattern found {original.count(mutant.old)} times in {mutant.path}")
    path.write_text(original.replace(mutant.old, mutant.new, 1), encoding="utf-8", newline="\n")
    return original


def run_mutant(mutant: Mutant, engine: Path) -> tuple[str, str, float]:
    started = time.perf_counter()
    path = engine / mutant.path
    original = apply(mutant, engine)
    try:
        code, output = run_suite(engine, failfast=True, modules=mutant.modules)
    finally:
        path.write_text(original, encoding="utf-8", newline="\n")
    verdict = "SURVIVED" if code == 0 else "KILLED"
    return verdict, (first_failure(output) if code else ""), time.perf_counter() - started


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m mcd_worker.tools.mutation_check", description=__doc__.split("\n\n")[0])
    parser.add_argument("--jobs", type=int, default=4, help="scratch copies run in parallel (default 4)")
    parser.add_argument("--only", nargs="+", metavar="ID", help="run only these mutants")
    parser.add_argument("--list", action="store_true", help="check that every pattern matches exactly once and run nothing")
    parser.add_argument("--keep", action="store_true", help="keep the scratch directory")
    args = parser.parse_args(argv)

    chosen = [x for x in MUTANTS if not args.only or x.mutant_id in args.only]
    stale = [x for x in chosen if count_matches(x) != 1]
    for x in stale:
        print(f"STALE  {x.mutant_id}  {x.path}: the pattern matches {count_matches(x)} times, not once")
    if args.list or stale:
        print(f"{len(chosen)} mutants, {len(stale)} stale")
        return 2 if stale else 0

    before = tree_hashes(ENGINE_DIR / "mcd_worker")
    scratch = Path(tempfile.mkdtemp(prefix="mcdmut"))
    try:
        jobs = max(1, min(args.jobs, len(chosen)))
        copies = queue.Queue()
        for index in range(jobs):
            copy = scratch / f"e{index}"
            copy.mkdir()
            make_copy(copy)
            copies.put(copy)
        print(f"scratch copies: {jobs} in {scratch}")
        baseline_code, baseline_output = run_suite(scratch / "e0", failfast=False)
        if baseline_code != 0:
            print("BASELINE FAILED: the suite does not pass on the unmutated scratch copy\n" + baseline_output[-3000:])
            return 1
        print("baseline: the suite passes on the unmutated copy")

        def work(mutant: Mutant) -> tuple[Mutant, str, str, float]:
            copy = copies.get()
            try:
                verdict, by, seconds = run_mutant(mutant, copy)
            finally:
                copies.put(copy)
            return mutant, verdict, by, seconds

        results: list[tuple[Mutant, str, str, float]] = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=jobs) as pool:
            for outcome in pool.map(work, chosen):
                results.append(outcome)
                mutant, verdict, by, seconds = outcome
                print(f"{mutant.mutant_id}  {verdict:8}  {seconds:5.1f}s  {mutant.path.split('/')[-1]:17} {mutant.what}" + (f"  <- {by}" if by else ""))

        restored = all(tree_hashes(scratch / f"e{index}" / "mcd_worker") == tree_hashes(ENGINE_DIR / "mcd_worker") for index in range(jobs))
        untouched = tree_hashes(ENGINE_DIR / "mcd_worker") == before
        killed = sum(1 for _, v, _, _ in results if v == "KILLED")
        survivors = [x for x, v, _, _ in results if v == "SURVIVED"]
        print(f"\n{killed} of {len(results)} mutants killed; {len(survivors)} survived")
        for x in survivors:
            print(f"  SURVIVED {x.mutant_id}: {x.what}")
        print(f"scratch copies equal the checkout after the run: {restored}")
        print(f"checkout's mcd_worker unchanged by the run: {untouched}")
        return 0 if not survivors and restored and untouched else 1
    finally:
        if args.keep:
            print(f"scratch kept: {scratch}")
        else:
            shutil.rmtree(scratch, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
