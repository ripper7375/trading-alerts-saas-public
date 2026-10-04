"""The cycle fixtures: shape, provenance and agreement with the per-MCD fixtures.

The runner's tests read the stored files only. The provenance tests open the replica workbooks and skip when one is missing
(or ``openpyxl`` is not installed), as the MCD tests do.
"""

from __future__ import annotations

import hashlib
import json
import re
import unittest

from mcd_common.cycle_inputs import bar_is_closed, slot_to_epoch, stats_slot_for

from mcd_worker.tests import support as s
from mcd_worker.tools import build_fixtures as bf

FORMING_BAR_FIELDS = ("live_bar_ts", "live_close", "baseline_value", "uoedt_value", "loedt_value", "dist_to_baseline", "dist_to_uoedt", "dist_to_loedt", "channel_position")


class ShapeTests(unittest.TestCase):
    def test_each_slot_has_its_four_files(self) -> None:
        for name in s.SLOTS:
            for suffix in ("bundle.json", "source.md", "cycle.json", "synthesis.json"):
                self.assertTrue((s.FIXTURES / f"{s.stem(name)}.{suffix}").is_file(), f"{name} {suffix}")

    def test_the_bundle_belongs_to_its_slot_and_is_a_fresh_cycle(self) -> None:
        for name, slot in s.SLOTS.items():
            inputs = s.bundle(name)
            self.assertEqual((inputs.symbol, inputs.cycle_slot, inputs.data_status, inputs.retuning), ("XAUUSD", slot, "FRESH", False))
            self.assertEqual(dict(inputs.stats_slot), {tf: stats_slot_for(slot, tf) for tf in ("M5", "M15")})

    def test_every_bar_is_closed_and_ascending_and_the_forming_bar_is_absent(self) -> None:
        for name, slot in s.SLOTS.items():
            for tf, bars in s.bundle(name).bars.items():
                stamps = [bar["timestamp"] for bar in bars]
                self.assertEqual(stamps, sorted(set(stamps)), (name, tf))
                self.assertTrue(all(bar_is_closed(t, tf, slot) for t in stamps), (name, tf))
                self.assertGreater(len(stamps), 200, (name, tf))

    def test_the_statistics_are_the_rows_at_the_slot_with_no_forming_bar_field(self) -> None:
        for name in s.SLOTS:
            inputs = s.bundle(name)
            for (tf, _source), row in inputs.statistics.items():
                self.assertEqual(row["captured_at"], slot_to_epoch(inputs.stats_slot[tf]), (name, tf))
                for field in FORMING_BAR_FIELDS:
                    self.assertNotIn(field, row, (name, tf, field))

    def test_the_active_indicator_has_a_statistics_row_on_each_timeframe(self) -> None:
        for name in s.SLOTS:
            inputs = s.bundle(name)
            for tf in ("M5", "M15"):
                source = "fractal_edt" if inputs.active_indicator[tf] == "fractal" else inputs.active_indicator[tf]
                self.assertIn((tf, source), inputs.statistics, (name, tf))

    def test_the_bundle_is_in_the_sizes_the_storage_decision_needs_to_know(self) -> None:
        for name in s.SLOTS:
            raw = s.bundle_text(name).encode("utf-8")
            self.assertLess(len(raw), 2_000_000, name)

    def test_the_stored_cycle_files_are_the_deterministic_result_with_no_runtime_part(self) -> None:
        for name in s.SLOTS:
            stored = json.loads(s.stored_cycle_text(name))
            self.assertNotIn("runtime", stored)
            self.assertEqual(stored["cycle_slot"], s.SLOTS[name])
            self.assertEqual([r["mcd_id"] for r in stored["results"]], ["MCD0", "MCD1", "MCD2", "MCD3"])


class SourceNoteTests(unittest.TestCase):
    def test_the_source_note_names_the_workbook_by_a_relative_path_and_its_hash(self) -> None:
        for name in s.SLOTS:
            text = (s.FIXTURES / f"{s.stem(name)}.source.md").read_text(encoding="utf-8")
            self.assertRegex(text, r"- Workbook: `davintrade-stack-d-and-e/[^`]*market_data_v6_replicated[^`]*\.xlsx`")
            self.assertNotRegex(text, r"[A-Za-z]:[/\\]")
            self.assertRegex(text, r"- SHA-256: `[0-9a-f]{64}`")
            self.assertIn("**shared** bundle", text)
            self.assertIn(s.SLOTS[name], text)

    def test_the_hash_in_the_note_is_the_workbooks(self) -> None:
        for name in s.SLOTS:
            workbook = bf.WORKBOOKS[name]
            if not workbook.is_file():
                self.skipTest(f"{workbook.name} is not in this checkout")
            text = (s.FIXTURES / f"{s.stem(name)}.source.md").read_text(encoding="utf-8")
            expected = hashlib.sha256(workbook.read_bytes()).hexdigest()
            self.assertIn(expected, text, name)


class AgreementWithThePerMcdFixturesTests(unittest.TestCase):
    """Each MCD's own fixture is a cut of the shared bundle: same bars at the end, same other fields."""

    def test_every_per_mcd_fixture_is_contained_in_the_shared_bundle(self) -> None:
        checked = 0
        for name in s.SLOTS:
            shared = json.loads(s.bundle_text(name))
            for folder in bf.MCD_FOLDERS:
                path = s.ENGINE / folder / "fixtures" / f"{s.stem(name)}.inputs.json"
                if not path.is_file():
                    continue
                own = json.loads(path.read_text(encoding="utf-8"))
                for field in bf.SCALAR_FIELDS:
                    self.assertEqual(own[field], shared[field], (name, folder, field))
                for tf, rows in own["bars"].items():
                    tail = shared["bars"][tf][-len(rows):] if rows else []
                    self.assertEqual(len(tail), len(rows), (name, folder, tf))
                    for mine, theirs in zip(rows, tail):
                        self.assertEqual({k: theirs[k] for k in mine}, mine, (name, folder, tf))
                checked += 1
        self.assertEqual(checked, 10)  # four MCDs on v1 and v4, MCD0 and MCD3 on v3

    def test_the_shared_bundle_is_exactly_as_long_as_the_longest_per_mcd_fixture(self) -> None:
        for name in s.SLOTS:
            columns, max_bars, _ = bf.shared_shape(name)
            shared = s.bundle(name)
            self.assertEqual({tf: len(bars) for tf, bars in shared.bars.items()}, max_bars, name)
            self.assertEqual(set().union(*[set(bar) for bar in shared.bars["M5"]]), set(columns), name)


class ProvenanceTests(unittest.TestCase):
    def test_rebuilding_from_the_workbooks_gives_the_stored_files(self) -> None:
        try:
            import openpyxl  # noqa: F401
        except ImportError:
            self.skipTest("openpyxl is not installed")
        for name in s.SLOTS:
            if not bf.WORKBOOKS[name].is_file():
                self.skipTest(f"{bf.WORKBOOKS[name].name} is not in this checkout")
        for name in s.SLOTS:
            for file_name, text in bf.build(name).items():
                self.assertTrue(bf.same_text(file_name, (s.FIXTURES / file_name).read_text(encoding="utf-8"), text), file_name)


class NormalizeMarkdownTests(unittest.TestCase):
    def test_table_padding_is_ignored_and_words_are_not(self) -> None:
        loose = "# T\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n"
        padded = "# T\n\n| a   | b   |\n| --- | --- |\n| 1   | 2   |\n"
        longer = "# T\n\n| a     | b   |\n| ----- | --- |\n| 1     | 2   |\n"
        self.assertEqual(bf.normalize_markdown(loose), bf.normalize_markdown(padded))
        self.assertEqual(bf.normalize_markdown(loose), bf.normalize_markdown(longer))
        self.assertNotEqual(bf.normalize_markdown(loose), bf.normalize_markdown(loose.replace("| 2 |", "| 3 |")))
        self.assertNotEqual(bf.normalize_markdown(loose), bf.normalize_markdown(loose.replace("# T", "# U")))

    def test_only_a_source_note_is_compared_loosely(self) -> None:
        self.assertTrue(bf.same_text("x.source.md", "| a  |\n", "| a |\n"))
        self.assertFalse(bf.same_text("x.bundle.json", "{ }", "{}"))
        self.assertFalse(bf.same_text("x.cycle.json", "a\n", "a \n"))


class NamingTests(unittest.TestCase):
    def test_file_names_use_the_slot_without_a_colon(self) -> None:
        for path in s.FIXTURES.iterdir():
            self.assertRegex(path.name, r"^\d{4}-\d{2}-\d{2}T\d{4}Z\.(bundle\.json|source\.md|cycle\.json|synthesis\.json)$")


if __name__ == "__main__":
    unittest.main()
