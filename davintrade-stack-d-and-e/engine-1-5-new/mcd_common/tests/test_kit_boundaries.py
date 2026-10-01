"""What an evaluator may import from the kit stays pure (standard R4, checklist A3, P1 'Done when')."""

import json
import re
import subprocess
import sys
import unittest
from pathlib import Path

from .support import ENGINE_DIR, KIT_DIR

# Modules an evaluator imports. The provider, budget and testing modules are for tests, workers and tooling.
EVALUATOR_FACING = ("reason_codes", "cycle_inputs", "envelope", "preflight", "wording")
HEAVY = {"openpyxl", "yaml", "jsonschema", "tiktoken", "requests", "numpy", "pandas"}


class ImportBoundaryTests(unittest.TestCase):
    def test_importing_the_evaluator_facing_modules_pulls_in_no_third_party_package(self):
        code = (
            "import sys, json\n"
            + "".join(f"import mcd_common.{m}\n" for m in EVALUATOR_FACING)
            + f"heavy = {sorted(HEAVY)!r}\n"
            + "print(json.dumps(sorted(m for m in sys.modules if m.split('.')[0] in heavy)))\n"
        )
        out = subprocess.run([sys.executable, "-c", code], cwd=ENGINE_DIR, capture_output=True, text=True, check=True)
        self.assertEqual(json.loads(out.stdout), [], "third-party packages imported at module level")

    def test_only_the_worker_side_modules_import_third_party_packages(self):
        pattern = re.compile(r"^\s*(?:import|from)\s+(openpyxl|yaml|jsonschema|tiktoken)\b", re.M)
        for name in EVALUATOR_FACING:
            text = (KIT_DIR / f"{name}.py").read_text(encoding="utf-8")
            for match in pattern.finditer(text):
                indent = len(match.group(0)) - len(match.group(0).lstrip())
                self.assertGreater(indent, 0, f"{name}.py imports {match.group(1)} at module level")


class PurityTests(unittest.TestCase):
    FORBIDDEN = {
        "wall clock": re.compile(r"\b(datetime\.now|datetime\.utcnow|time\.time|time\.monotonic|perf_counter|today\()"),
        "randomness": re.compile(r"\b(import random|random\.|uuid\.|secrets\.)"),
        "environment": re.compile(r"\bos\.(environ|getenv)\b"),
        "network": re.compile(r"\b(requests|urllib|http\.client|socket)\b"),
        "printing": re.compile(r"(^|\s)print\("),
        "database": re.compile(r"\b(psycopg|sqlalchemy|sqlite3|prisma)\b", re.I),
    }

    def strip_comments_and_docstrings(self, text):
        text = re.sub(r'""".*?"""', "", text, flags=re.S)
        return "\n".join(line.split("#", 1)[0] for line in text.splitlines())

    def test_evaluator_facing_modules_have_no_clock_randomness_environment_network_print_or_database(self):
        for name in EVALUATOR_FACING:
            code = self.strip_comments_and_docstrings((KIT_DIR / f"{name}.py").read_text(encoding="utf-8"))
            for label, pattern in self.FORBIDDEN.items():
                self.assertIsNone(pattern.search(code), f"{name}.py uses {label}: {pattern.search(code)}")

    def test_file_access_is_confined_to_params_from_yaml(self):
        for name in EVALUATOR_FACING:
            code = self.strip_comments_and_docstrings((KIT_DIR / f"{name}.py").read_text(encoding="utf-8"))
            opens = re.findall(r"\bopen\(|read_text\(|read_bytes\(|write_text\(", code)
            if name == "cycle_inputs":
                self.assertEqual(len(opens), 1, "only Params.from_yaml may open a file")
            elif name == "envelope":
                self.assertEqual(len(opens), 1, "only the schema loader may read the schema file")
            else:
                self.assertEqual(opens, [], f"{name}.py touches files")


class KitLayoutTests(unittest.TestCase):
    def test_part_b2_modules_and_files_exist(self):
        expected = [
            "cycle_inputs.py", "envelope.py", "mcd-output-1.schema.json", "preflight.py", "reason_codes.py",
            "excel_fixture_provider.py", "wording.py", "budget.py", "testing.py",
            "fixtures/settings_v1.yaml", "fixtures/settings_v4.yaml", "requirements.txt",
        ]
        for rel in expected:
            self.assertTrue((KIT_DIR / rel).is_file(), rel)

    def test_tiktoken_is_pinned_in_the_requirements(self):
        text = (KIT_DIR / "requirements.txt").read_text(encoding="utf-8")
        self.assertRegex(text, r"(?m)^tiktoken==\d+\.\d+\.\d+$")
        import tiktoken

        self.assertIn(f"tiktoken=={tiktoken.__version__}", text)

    def test_the_encoding_cache_folder_is_git_ignored_inside_the_kit(self):
        self.assertIn(".tiktoken_cache/", (KIT_DIR / ".gitignore").read_text(encoding="utf-8"))
        proc = subprocess.run(
            ["git", "check-ignore", "-q", str((KIT_DIR / ".tiktoken_cache" / "x").relative_to(ENGINE_DIR.parents[1]))],
            cwd=ENGINE_DIR.parents[1],
        )
        self.assertEqual(proc.returncode, 0, "mcd_common/.tiktoken_cache/ must be git-ignored")


if __name__ == "__main__":
    unittest.main()
