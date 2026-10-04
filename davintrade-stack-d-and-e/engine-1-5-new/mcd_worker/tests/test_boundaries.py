"""What the runner may touch (standard 11.2, R4; the part 1 order: no change to ``mcd_common`` or to any evaluator).

The runtime files are the ones the gateway's sensor worker will copy (part 4), so their list is pinned here: a new
runtime file must be added on purpose, to this test and to the README.
"""

from __future__ import annotations

import ast
import unittest
from pathlib import Path

from mcd_worker.tests import support as s

RUNTIME_PY = {"__init__.py", "cli.py", "cycle_runner.py", "errors.py", "flags.py", "guards.py", "inheritance.py", "registry.py"}
RUNTIME_DATA = {"worker_config.yaml", "README.md"}
ALLOWED_IMPORTS = {
    "__future__", "argparse", "copy", "dataclasses", "hashlib", "importlib", "json", "logging", "pathlib", "re", "sys", "time",
    "types", "typing", "yaml", "mcd_common",
}
ALLOWED_KIT_MODULES = {"cycle_inputs", "envelope", "reason_codes", "wording"}
READS_FILES = {"flags.py", "registry.py", "rules.py", "reading.py", "zones.py"}  # the configuration, the checklists, the registries and the evaluators; the rules file and the SYN schema

# Synthesis (build step 4) is runtime too: the same guards apply to it (the imports below, nothing written, no clock). Its files are pinned
# like the runner's, and ``jsonschema`` (the kit's own dependency, ``mcd_common/requirements.txt``) and ``functools`` (the cached validator) are
# allowed in ``reading.py`` only, and ``decimal`` (exact prices) in ``zones.py`` only.
SYNTHESIS_DIR = s.WORKER_DIR / "synthesis"
SYNTHESIS_PY = {"__init__.py", "cycle.py", "engine.py", "facts.py", "pills.py", "reading.py", "rules.py", "zones.py"}
SYNTHESIS_DATA = {"syn-output-1.schema.json"}


def runtime_files() -> list[Path]:
    return sorted(s.WORKER_DIR.glob("*.py")) + sorted(SYNTHESIS_DIR.glob("*.py"))


def parse(path: Path) -> ast.Module:
    return ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


class TheFilesTests(unittest.TestCase):
    def test_the_runtime_files_are_exactly_the_documented_ones(self) -> None:
        self.assertEqual({p.name for p in s.WORKER_DIR.glob("*.py")}, RUNTIME_PY)
        top_level_files = {p.name for p in s.WORKER_DIR.iterdir() if p.is_file() and p.suffix != ".py"}
        self.assertEqual(top_level_files, RUNTIME_DATA)
        self.assertEqual({p.name for p in s.WORKER_DIR.iterdir() if p.is_dir() and p.name != "__pycache__"}, {"checklists", "fixtures", "statistics", "synthesis", "tests", "tools"})

    def test_the_synthesis_files_are_exactly_the_documented_ones(self) -> None:
        self.assertEqual({p.name for p in SYNTHESIS_DIR.glob("*.py")}, SYNTHESIS_PY)
        self.assertEqual({p.name for p in SYNTHESIS_DIR.iterdir() if p.is_file() and p.suffix == ".json"}, SYNTHESIS_DATA)
        self.assertEqual({p.name for p in SYNTHESIS_DIR.iterdir() if p.is_file() and p.suffix == ".md"}, {"synthesis.md"})
        self.assertEqual({p.name for p in SYNTHESIS_DIR.iterdir() if p.is_file() and p.suffix == ".yaml"}, {"zone_params.yaml"})
        self.assertEqual({p.name for p in SYNTHESIS_DIR.iterdir() if p.is_dir() and p.name != "__pycache__"}, {"rules"})

    def test_the_readme_lists_every_runtime_file(self) -> None:
        readme = (s.WORKER_DIR / "README.md").read_text(encoding="utf-8")
        for name in sorted(RUNTIME_PY | RUNTIME_DATA):
            self.assertIn(f"`{name}`", readme, name)
        self.assertIn("`checklists/`", readme)
        self.assertIn("`synthesis/`", readme)


class ImportsTests(unittest.TestCase):
    def imports(self, path: Path) -> set[tuple[str, str | None]]:
        found: set[tuple[str, str | None]] = set()
        for node in ast.walk(parse(path)):
            if isinstance(node, ast.Import):
                found |= {(alias.name.split(".")[0], None) for alias in node.names}
            elif isinstance(node, ast.ImportFrom) and node.level == 0:
                top = (node.module or "").split(".")[0]
                found |= {(top, (node.module or "").partition(".")[2] or alias.name) for alias in node.names}
        return found

    def test_only_the_standard_library_yaml_and_four_kit_modules_are_imported(self) -> None:
        for path in runtime_files():
            allowed = ALLOWED_IMPORTS | ({"jsonschema", "functools"} if path == SYNTHESIS_DIR / "reading.py" else set())
            allowed |= {"decimal"} if path == SYNTHESIS_DIR / "zones.py" else set()  # exact prices
            for top, sub in self.imports(path):
                self.assertIn(top, allowed, f"{path.name} imports {top}")
                if top == "mcd_common" and sub is not None:
                    self.assertIn(sub.split(".")[0], ALLOWED_KIT_MODULES | {"cycle_inputs", "Params"}, f"{path.name} imports mcd_common.{sub}")


class BehaviourTests(unittest.TestCase):
    def calls(self, path: Path) -> list[str]:
        names = []
        for node in ast.walk(parse(path)):
            if isinstance(node, ast.Call):
                func = node.func
                names.append(func.id if isinstance(func, ast.Name) else func.attr if isinstance(func, ast.Attribute) else "")
        return names

    def test_nothing_is_written_to_a_file_or_printed(self) -> None:
        for path in runtime_files():
            called = set(self.calls(path))
            self.assertFalse(called & {"open", "write_text", "write_bytes", "print", "mkdir", "unlink", "remove", "rename"}, f"{path.name}: {called}")

    def test_only_the_loaders_read_files(self) -> None:
        for path in runtime_files():
            if "read_text" in self.calls(path) or "read_bytes" in self.calls(path):
                self.assertIn(path.name, READS_FILES, path.name)

    def test_the_clock_is_read_only_for_durations(self) -> None:
        for path in runtime_files():
            for node in ast.walk(parse(path)):
                if isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name) and node.value.id == "time":
                    self.assertEqual(node.attr, "perf_counter", f"{path.name}: time.{node.attr}")

    def test_durations_never_reach_the_deterministic_result(self) -> None:
        source = (s.WORKER_DIR / "cycle_runner.py").read_text(encoding="utf-8")
        start = source.index("def deterministic_dict")
        end = source.index("def to_dict(self) -> dict[str, Any]:\n        out = ")
        self.assertNotIn("duration", source[start:end])


class ReadOnlyKitTests(unittest.TestCase):
    """The worker uses the kit and the evaluators as they are. It does not copy or patch them."""

    def test_the_evaluators_are_loaded_from_their_own_folders(self) -> None:
        import sys

        s.real_worker()  # loads the four evaluators
        for number in range(4):
            module = sys.modules[f"mcd{number}_evaluator"]
            self.assertEqual(Path(module.__file__).resolve(), (s.ENGINE / f"mcd{number}" / f"mcd{number}_evaluator.py").resolve())

    def test_the_worker_package_holds_no_copy_of_an_evaluator_or_of_the_kit(self) -> None:
        for path in s.WORKER_DIR.rglob("*.py"):
            self.assertFalse(path.name.endswith("_evaluator.py"), path)
        self.assertFalse((s.WORKER_DIR / "mcd_common").exists())


if __name__ == "__main__":
    unittest.main()
