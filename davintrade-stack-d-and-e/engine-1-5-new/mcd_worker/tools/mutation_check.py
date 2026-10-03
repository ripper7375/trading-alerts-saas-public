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
)
TIMEOUT_SECONDS = 600


@dataclass(frozen=True)
class Mutant:
    mutant_id: str
    path: str  # relative to the engine folder
    old: str  # must occur exactly once in the file
    new: str
    what: str


def m(mutant_id: str, path: str, old: str, new: str, what: str) -> Mutant:
    return Mutant(mutant_id, f"mcd_worker/{path}", old, new, what)


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


def run_suite(engine: Path, *, failfast: bool) -> tuple[int, str]:
    command = [sys.executable, "-B", "-m", "unittest", *(["-f"] if failfast else []), *(f"mcd_worker.tests.{name}" for name in TEST_MODULES)]
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
        code, output = run_suite(engine, failfast=True)
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
