"""What the statistics package may touch (build step 3, part 6): the standard library, nothing else, and no side effect.

Pure functions over plain values: no file, no network, no clock, no randomness, no kit, no evaluator, no third-party package.
"""

from __future__ import annotations

import ast
import unittest
from pathlib import Path

from mcd_worker.statistics import outcomes
from mcd_worker.tests import support as s

PACKAGE = s.WORKER_DIR / "statistics"
FILES = {"__init__.py", "aggregate.py", "outcomes.py"}
STDLIB_ONLY = {"__future__", "dataclasses", "decimal", "types", "typing"}
FORBIDDEN_CALLS = {"open", "print", "input", "eval", "exec", "compile", "__import__", "read_text", "read_bytes", "write_text", "write_bytes", "mkdir", "unlink"}


def parse(path: Path) -> ast.Module:
    return ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


class TheFilesTests(unittest.TestCase):
    def test_the_package_is_exactly_the_documented_files(self) -> None:
        self.assertEqual({p.name for p in PACKAGE.iterdir() if p.name != "__pycache__"}, FILES)

    def test_the_readme_names_the_package_and_its_files(self) -> None:
        readme = (s.WORKER_DIR / "README.md").read_text(encoding="utf-8")
        self.assertIn("`statistics/`", readme)
        for name in ("outcomes.py", "aggregate.py"):
            self.assertIn(f"`{name}`", readme)


class ImportsTests(unittest.TestCase):
    def test_only_the_standard_library_and_its_own_modules_are_imported(self) -> None:
        for path in PACKAGE.glob("*.py"):
            for node in ast.walk(parse(path)):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        self.assertIn(alias.name.split(".")[0], STDLIB_ONLY, f"{path.name} imports {alias.name}")
                elif isinstance(node, ast.ImportFrom):
                    if node.level == 0:
                        self.assertIn((node.module or "").split(".")[0], STDLIB_ONLY, f"{path.name} imports from {node.module}")
                    else:  # a relative import stays inside this package
                        self.assertEqual(node.level, 1, path.name)
                        self.assertIn(node.module, {"aggregate", "outcomes"}, f"{path.name}: from .{node.module}")

    def test_no_clock_no_randomness_no_standard_statistics_module(self) -> None:
        # the quartiles are worked out in aggregate.py, not by `statistics`, and nothing reads the time or draws a number
        text = "\n".join(p.read_text(encoding="utf-8") for p in PACKAGE.glob("*.py"))
        for banned in ("import time", "import datetime", "import random", "import statistics", "from statistics", "import os", "import sys"):
            self.assertNotIn(banned, text, banned)


class BehaviourTests(unittest.TestCase):
    def test_nothing_is_read_written_printed_or_executed(self) -> None:
        for path in PACKAGE.glob("*.py"):
            for node in ast.walk(parse(path)):
                if isinstance(node, ast.Call):
                    func = node.func
                    name = func.id if isinstance(func, ast.Name) else func.attr if isinstance(func, ast.Attribute) else ""
                    self.assertNotIn(name, FORBIDDEN_CALLS, f"{path.name}: {name}()")

    def test_no_module_level_state_can_be_changed(self) -> None:
        with self.assertRaises(TypeError):
            outcomes.HORIZON_BARS[3] = 36  # type: ignore[index]
        self.assertEqual(dict(outcomes.HORIZON_BARS), {2: 24, 12: 144})


if __name__ == "__main__":
    unittest.main()
