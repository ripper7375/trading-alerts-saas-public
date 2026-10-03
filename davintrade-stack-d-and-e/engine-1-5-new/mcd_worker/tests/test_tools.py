"""The mutation tool's own bookkeeping, so the list of mutants cannot drift away from the code it mutates.

This module is left out of the tool's own test run (``TEST_MODULES``): inside a mutated scratch copy a pattern no longer
matches by design, which would make every mutant look killed.
"""

from __future__ import annotations

import re
import tempfile
import unittest
from pathlib import Path

from mcd_worker.tools import mutation_check as mc


class MutantListTests(unittest.TestCase):
    def test_every_pattern_matches_exactly_once(self) -> None:
        for mutant in mc.MUTANTS:
            self.assertEqual(mc.count_matches(mutant), 1, f"{mutant.mutant_id}: {mutant.what}")

    def test_the_ids_are_unique_and_numbered(self) -> None:
        ids = [x.mutant_id for x in mc.MUTANTS]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertTrue(all(re.fullmatch(r"M\d{2,3}", i) for i in ids))
        self.assertEqual(ids, sorted(ids, key=lambda i: int(i[1:])))

    def test_a_mutant_changes_something_and_says_what(self) -> None:
        for mutant in mc.MUTANTS:
            self.assertNotEqual(mutant.old, mutant.new, mutant.mutant_id)
            self.assertTrue(mutant.what.strip(), mutant.mutant_id)
            self.assertTrue(mutant.path.startswith("mcd_worker/") and mutant.path.endswith(".py"), mutant.mutant_id)

    def test_the_tools_own_modules_are_not_in_its_test_run(self) -> None:
        self.assertNotIn("test_tools", mc.TEST_MODULES)
        for name in mc.TEST_MODULES:
            self.assertTrue((Path(__file__).parent / f"{name}.py").is_file(), name)

    def test_every_other_test_module_is_in_its_test_run(self) -> None:
        on_disk = {p.stem for p in Path(__file__).parent.glob("test_*.py")}
        self.assertEqual(on_disk - {"test_tools"}, set(mc.TEST_MODULES))


class ApplyTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.engine = Path(self._tmp.name)
        (self.engine / "mcd_worker").mkdir()
        self.file = self.engine / "mcd_worker" / "x.py"
        self.file.write_text("a = 1\nb = 2\nb = 2\n", encoding="utf-8", newline="\n")

    def test_apply_changes_one_place_and_returns_the_original(self) -> None:
        original = mc.apply(mc.Mutant("M1", "mcd_worker/x.py", "a = 1", "a = 9", "x"), self.engine)
        self.assertEqual(original, "a = 1\nb = 2\nb = 2\n")
        self.assertEqual(self.file.read_text(encoding="utf-8"), "a = 9\nb = 2\nb = 2\n")

    def test_a_pattern_that_is_missing_or_ambiguous_is_refused_and_nothing_is_written(self) -> None:
        for old in ("c = 3", "b = 2"):
            with self.assertRaises(ValueError):
                mc.apply(mc.Mutant("M1", "mcd_worker/x.py", old, "z", "x"), self.engine)
            self.assertEqual(self.file.read_text(encoding="utf-8"), "a = 1\nb = 2\nb = 2\n")

    def test_the_first_failure_is_read_from_unittest_output(self) -> None:
        output = "....F\n======\nFAIL: test_the_thing (mcd_worker.tests.test_x.Case.test_the_thing)\n---\nTraceback\n"
        self.assertEqual(mc.first_failure(output), "test_the_thing")
        self.assertEqual(mc.first_failure("ERROR: test_boom (mod.Case.test_boom)\n"), "test_boom")
        self.assertEqual(mc.first_failure("Traceback (most recent call last):\n  File x\nSyntaxError\n"), "crash on import")
        self.assertEqual(mc.first_failure("TIMEOUT"), "TIMEOUT")

    def test_tree_hashes_ignore_bytecode_and_differ_when_a_byte_differs(self) -> None:
        (self.engine / "mcd_worker" / "__pycache__").mkdir()
        (self.engine / "mcd_worker" / "__pycache__" / "x.pyc").write_bytes(b"1")
        before = mc.tree_hashes(self.engine / "mcd_worker")
        self.assertEqual(list(before), ["x.py"])
        self.file.write_text("a = 2\nb = 2\nb = 2\n", encoding="utf-8", newline="\n")
        self.assertNotEqual(mc.tree_hashes(self.engine / "mcd_worker"), before)


if __name__ == "__main__":
    unittest.main()
