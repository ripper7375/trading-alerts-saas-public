"""Builds the cycle-level fixtures of the worker: one shared bundle per slot, and what the runner makes of it.

The per-MCD fixtures (``mcdN/fixtures/``) each hold only what one MCD reads. The worker hands **one** bundle to
every MCD, so it needs a bundle that holds what all of them read: the same closed bars and statistics, cut by
the kit's own provider from the same replica workbook. For each slot this tool writes, into
``mcd_worker/fixtures/``:

* ``<slot>.bundle.json``: the shared bundle (``CycleInputs.to_dict`` form). Its bar columns are the union of the
  columns of the per-MCD fixtures of that slot, and it holds as many closed bars per timeframe as the largest of
  them. Every other field is checked equal to the per-MCD fixtures' before anything is written;
* ``<slot>.source.md``: where it came from (workbook, SHA-256, cut-off), through the kit's own report;
* ``<slot>.cycle.json``: what ``Worker.run_cycle`` makes of the bundle with every MCD at ``shadow`` and RETUNING
  not enforced (the expected cycle: readings after MCD0 inheritance, hashes, order).

Run from ``davintrade-stack-d-and-e/engine-1-5-new/``::

    python -m mcd_worker.tools.build_fixtures            # write the three slots
    python -m mcd_worker.tools.build_fixtures --check    # rebuild in memory and compare with the stored files

The bundle needs the replica workbooks (``openpyxl``); the runner's tests only read the stored files.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from mcd_common import excel_fixture_provider as provider
from mcd_common.cycle_inputs import CycleInputs

from ..cycle_runner import Worker
from ..registry import ENGINE_DIR

STACK_DIR = ENGINE_DIR.parent
REPO_DIR = STACK_DIR.parent
FIXTURES = ENGINE_DIR / "mcd_worker" / "fixtures"
SLOTS = {"v1": "2026-09-18T20:55Z", "v3": "2026-09-28T14:15Z", "v4": "2026-09-28T23:15Z"}
WORKBOOKS = {
    "v1": ENGINE_DIR / "market_data_v6_replicated.xlsx",
    "v3": STACK_DIR / "market_data_v6_replicated_v3.xlsx",
    "v4": STACK_DIR / "market_data_v6_replicated_v4.xlsx",
}
SETTINGS = {name: ENGINE_DIR / "mcd_common" / "fixtures" / f"settings_{name}.yaml" for name in SLOTS}
MCD_FOLDERS = ("mcd0", "mcd1", "mcd2", "mcd3")
SHADOW_ALL = {f"MCD{n}": "shadow" for n in range(4)}
SCALAR_FIELDS = ("symbol", "cycle_slot", "data_status", "retuning", "statistics", "stats_slot", "active_indicator", "config_hash", "channel_mode")


def stem(name: str) -> str:
    return provider.slot_file_stem(SLOTS[name])


def per_mcd_fixtures(name: str) -> dict[str, dict]:
    """The per-MCD input fixtures that exist for this slot, by folder name (MCD1 and MCD2 have none for v3)."""
    found = {}
    for folder in MCD_FOLDERS:
        path = ENGINE_DIR / folder / "fixtures" / f"{stem(name)}.inputs.json"
        if path.is_file():
            found[folder] = json.loads(path.read_text(encoding="utf-8"))
    return found


def shared_shape(name: str) -> tuple[list[str], dict[str, int], dict[str, dict]]:
    """``(columns, max bars per timeframe, per-MCD fixtures)``: what the shared bundle must hold."""
    fixtures = per_mcd_fixtures(name)
    columns: set[str] = {"timestamp"}
    bars = {"M5": 0, "M15": 0}
    for data in fixtures.values():
        for tf in bars:
            rows = data["bars"][tf]
            bars[tf] = max(bars[tf], len(rows))
            for row in rows:
                columns.update(row)
    return sorted(columns), bars, fixtures


def build(name: str) -> dict[str, str]:
    """The text of the three files of one slot, by file name. Raises if the shared bundle differs from a per-MCD fixture."""
    columns, max_bars, fixtures = shared_shape(name)
    inputs, report = provider.build_cycle_inputs_with_report(
        WORKBOOKS[name], SETTINGS[name], columns=columns, max_bars=max_bars
    )
    bundle = inputs.to_dict()
    for folder, data in fixtures.items():
        for field in SCALAR_FIELDS:
            if data[field] != bundle[field]:
                raise SystemExit(f"{name}: the shared bundle differs from {folder}'s fixture in {field!r}")
        for tf, rows in data["bars"].items():
            if rows and not _subset(rows, bundle["bars"][tf][-len(rows):]):
                raise SystemExit(f"{name}: the shared bundle's newest {len(rows)} {tf} bars differ from {folder}'s fixture")
    bundle_text = json.dumps(bundle, separators=(",", ":"), allow_nan=False) + "\n"
    source = provider.render_source_md(report, base_dir=REPO_DIR)
    heading, _, rest = source.partition("\n")
    note = (
        "\n"
        "This is the **shared** bundle of the sensor worker's cycle runner (`mcd_worker`): the one bundle handed to every MCD.\n"
        f"Bar columns ({len(columns)}): the union of the columns of the per-MCD fixtures of this slot. Closed bars kept: "
        f"M5 {max_bars['M5']}, M15 {max_bars['M15']} (the largest of the per-MCD fixtures: {', '.join(sorted(fixtures))}). "
        "Every other field equals the per-MCD fixtures' (checked by the tool). Built by `python -m mcd_worker.tools.build_fixtures`.\n"
    )
    cycle_inputs = CycleInputs.from_dict(json.loads(bundle_text))
    worker = Worker.load(flags=SHADOW_ALL)
    cycle_text = json.dumps(worker.run_cycle(cycle_inputs).deterministic_dict(), indent=2, ensure_ascii=True) + "\n"
    return {
        f"{stem(name)}.bundle.json": bundle_text,
        f"{stem(name)}.source.md": heading + "\n" + note + rest,
        f"{stem(name)}.cycle.json": cycle_text,
    }


def normalize_markdown(text: str) -> str:
    """``text`` with the padding of table cells removed, so it compares equal before and after Prettier aligns the tables.

    The pre-commit hook formats staged ``.md`` files and re-pads every table; nothing else changes the note's words.
    """
    out = []
    for line in text.splitlines():
        if line.startswith("|"):
            cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
            cells = ["---" if cell and set(cell) <= set("-:") else cell for cell in cells]
            line = "| " + " | ".join(cells) + " |"
        out.append(line.rstrip())
    return "\n".join(out).strip() + "\n"


def same_text(file_name: str, stored: str, built: str) -> bool:
    """Whether the stored file is the freshly built one: byte for byte, except that a ``.source.md`` ignores table padding."""
    if file_name.endswith(".source.md"):
        return normalize_markdown(stored) == normalize_markdown(built)
    return stored == built


def _subset(small: list[dict], big: list[dict]) -> bool:
    """Each bar of ``small`` is the same bar of ``big`` restricted to its own columns (a per-MCD fixture keeps fewer columns)."""
    return len(small) == len(big) and all(all(b.get(k) == v for k, v in s.items()) for s, b in zip(small, big))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m mcd_worker.tools.build_fixtures", description=__doc__.split("\n\n")[0])
    parser.add_argument("--check", action="store_true", help="compare with the stored files and write nothing")
    args = parser.parse_args(argv)
    differences = 0
    for name in SLOTS:
        for file_name, text in build(name).items():
            path = FIXTURES / file_name
            if args.check:
                same = path.is_file() and same_text(file_name, path.read_text(encoding="utf-8"), text)
                print(f"{'same' if same else 'DIFFERENT'}  {file_name}")
                differences += not same
            else:
                FIXTURES.mkdir(parents=True, exist_ok=True)
                path.write_bytes(text.encode("utf-8"))
                print(f"wrote  {file_name}  ({len(text):,} characters)")
    return 1 if differences else 0


if __name__ == "__main__":
    sys.exit(main())
