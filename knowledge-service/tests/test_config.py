"""The configuration files, the copies synced from the monolith, and the packaging."""

from __future__ import annotations

import ast
import copy
import json
import re
import subprocess
import sys
from pathlib import Path

import pytest
import yaml

from helpers import REPO_ROOT, SERVICE_ROOT
from knowledge.config import (
    CONFIG_DIR,
    IndexConfig,
    Matrix,
    Settings,
    check_templates,
    default_matrix_path,
    load_glossary_version,
    load_index_config,
    load_matrix,
    parse_index_config,
    parse_matrix,
)
from knowledge.errors import ConfigError
from knowledge.tags import Tags


def raw_index() -> dict:
    return yaml.safe_load((CONFIG_DIR / "index.yaml").read_text(encoding="utf-8"))


def raw_matrix() -> dict:
    return json.loads(default_matrix_path().read_text(encoding="utf-8"))


class TestIndexConfig:
    def test_the_real_file_loads(self, index_config: IndexConfig):
        assert index_config.model_repo == "sentence-transformers/all-MiniLM-L6-v2"
        assert re.fullmatch(r"[0-9a-f]{40}", index_config.model_revision)
        assert index_config.chunker.min_tokens == 200 and index_config.chunker.max_tokens == 450
        assert index_config.chunker.max_chars == 4000
        assert (index_config.candidates, index_config.limit, index_config.expansions_max) == (40, 4, 6)

    def test_the_model_revision_is_a_hash_not_a_branch(self):
        raw = raw_index()
        raw["model"]["revision"] = "main"
        with pytest.raises(ConfigError, match="40-character"):
            parse_index_config(raw)

    def test_the_embeddings_configuration_gets_the_local_model_path(self, index_config: IndexConfig, tmp_path: Path):
        config = index_config.embeddings_config(tmp_path)
        assert config["path"] == str(tmp_path)
        assert config["content"] is True
        assert config["scoring"] == {"method": "bm25", "terms": True, "normalize": True}
        config["scoring"]["normalize"] = False  # a copy: the configuration itself does not change
        assert index_config.embeddings["scoring"]["normalize"] is True

    @pytest.mark.parametrize(
        "change",
        [
            {"normalize": False},
            {"terms": False},
            {"method": "tfidf"},
        ],
    )
    def test_scoring_that_would_change_what_the_weights_mean_is_refused(self, change):
        raw = raw_index()
        raw["embeddings"]["scoring"].update(change)
        with pytest.raises(ConfigError, match="rank"):
            parse_index_config(raw)

    def test_a_missing_normalize_is_refused_too(self):
        raw = raw_index()
        del raw["embeddings"]["scoring"]["normalize"]
        with pytest.raises(ConfigError):
            parse_index_config(raw)

    @pytest.mark.parametrize("weights", [0, 1, 1.5, -0.2, "0.7", True, None])
    def test_weights_must_leave_both_scores_a_say(self, weights):
        raw = raw_index()
        raw["search"]["weights"] = weights
        with pytest.raises(ConfigError, match="weights"):
            parse_index_config(raw)

    def test_other_bad_values_are_all_reported(self):
        raw = raw_index()
        raw["search"]["limit"] = 0
        raw["search"]["candidates"] = "forty"
        raw["chunker"]["min_tokens"] = 2000
        raw["embeddings"]["path"] = "/somewhere/else"
        with pytest.raises(ConfigError) as caught:
            parse_index_config(raw)
        text = str(caught.value)
        for key in ("search.limit", "search.candidates", "chunker.min_tokens", "embeddings.path"):
            assert key in text

    def test_the_window_cannot_be_smaller_than_the_pack(self):
        raw = raw_index()
        raw["search"]["candidates"] = 3
        raw["search"]["limit"] = 4
        with pytest.raises(ConfigError, match="search.candidates"):
            parse_index_config(raw)
        raw["search"]["candidates"] = 4  # equal is fine
        assert parse_index_config(raw).candidates == 4

    def test_the_hash_follows_every_value(self, index_config: IndexConfig):
        changed = raw_index()
        changed["search"]["weights"] = 0.6
        assert parse_index_config(changed).sha256 != index_config.sha256
        same = copy.deepcopy(raw_index())
        assert parse_index_config(same).sha256 == index_config.sha256

    def test_a_wrong_schema_is_refused(self):
        with pytest.raises(ConfigError, match="schema"):
            parse_index_config({"schema": "index-config/9"})

    def test_a_missing_file_is_a_config_error(self, tmp_path: Path):
        with pytest.raises(ConfigError):
            load_index_config(tmp_path / "nope.yaml")


class TestTheDispatchMatrix:
    def test_the_matrix_is_routing_v1_with_the_ten_intents(self, matrix: Matrix):
        assert matrix.version == "routing-v1"
        assert sorted(matrix.intents) == sorted(
            [
                "DIRECTION",
                "ENTRY_TIMING",
                "EXIT_TARGETS",
                "RISK_SIZING",
                "EXPLAIN",
                "NEWS",
                "REPORT_2",
                "OUT_OF_SCOPE",
                "INSTANT_M5_INSPECT",
                "INSTANT_M15_INSPECT",
            ]
        )

    def test_domains_and_playbook_scoping_are_read_from_the_file(self, matrix: Matrix):
        direction = matrix.intents["DIRECTION"]
        assert direction.domains == ("D3", "D5") and direction.playbooks == "M_STAR"
        assert matrix.intents["RISK_SIZING"].playbooks == "NONE"
        assert matrix.intents["EXPLAIN"].domains == ("D1",)
        assert matrix.intents["REPORT_2"].domains == () and matrix.intents["OUT_OF_SCOPE"].domains == ()
        # D2 enters only through the playbook scoping, never as a general domain
        assert all("D2" not in rule.domains for rule in matrix.intents.values())

    def test_every_intent_has_a_retrieval_template(self, matrix: Matrix, index_config: IndexConfig):
        check_templates(index_config, matrix)  # does not raise
        assert set(index_config.intent_templates) == set(matrix.intents)

    def test_a_template_missing_for_an_intent_is_refused(self, matrix: Matrix):
        raw = raw_index()
        del raw["search"]["intent_templates"]["NEWS"]
        with pytest.raises(ConfigError, match="NEWS"):
            check_templates(parse_index_config(raw), matrix)

    @pytest.mark.parametrize(
        "mutate",
        [
            lambda m: m.update(schema="dispatch-matrix/2"),
            lambda m: m.update(version="v1"),
            lambda m: m.update(intents={}),
            lambda m: m["intents"]["DIRECTION"].update(domains=["D3", "D3"]),
            lambda m: m["intents"]["DIRECTION"].update(domains=["D9"]),
            lambda m: m["intents"]["DIRECTION"].update(domains=["D2", "D3"]),
            lambda m: m["intents"]["DIRECTION"].update(playbooks="ALL"),
            lambda m: m["intents"]["DIRECTION"].update(domains="D3"),
        ],
    )
    def test_a_matrix_that_is_not_what_it_must_be_is_refused(self, tags: Tags, mutate):
        raw = raw_matrix()
        mutate(raw)
        with pytest.raises(ConfigError):
            parse_matrix(raw, tags)

    def test_domains_are_ordered_by_rank_whatever_the_file_order(self, tags: Tags):
        raw = raw_matrix()
        raw["intents"]["DIRECTION"]["domains"] = ["D5", "D3"]
        assert parse_matrix(raw, tags).intents["DIRECTION"].domains == ("D3", "D5")

    def test_a_missing_file_is_a_config_error(self, tags: Tags, tmp_path: Path):
        with pytest.raises(ConfigError):
            load_matrix(tags, tmp_path / "nope.json")


class TestCopiesFromTheMonolith:
    """The service is built alone on Railway, so it holds copies of two intake files. They must not drift."""

    MONOLITH_MATRIX = REPO_ROOT / "config" / "intake" / "dispatch-matrix.v1.json"
    MONOLITH_GLOSSARY = REPO_ROOT / "config" / "intake" / "glossary.v1.json"

    def test_the_service_holds_its_own_copy_and_prefers_it(self):
        assert default_matrix_path() == CONFIG_DIR / "intake" / "dispatch-matrix.v1.json"
        assert default_matrix_path().is_file()

    @pytest.mark.skipif(not MONOLITH_MATRIX.is_file(), reason="the monolith's config is not beside the service")
    def test_the_matrix_copy_is_the_monolith_file(self):
        monolith = json.loads(self.MONOLITH_MATRIX.read_text(encoding="utf-8"))
        assert raw_matrix() == monolith

    @pytest.mark.skipif(not MONOLITH_GLOSSARY.is_file(), reason="the monolith's config is not beside the service")
    def test_the_glossary_version_is_the_glossary_s(self):
        glossary = json.loads(self.MONOLITH_GLOSSARY.read_text(encoding="utf-8"))
        assert load_glossary_version() == glossary["version"]

    @pytest.mark.skipif(not (REPO_ROOT / "scripts" / "intake").is_dir(), reason="the monolith's scripts are not beside the service")
    def test_the_sync_tool_agrees(self):
        done = subprocess.run(
            [sys.executable, "-I", str(REPO_ROOT / "scripts" / "intake" / "sync_knowledge_config.py"), "--check"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            cwd=REPO_ROOT,
        )
        assert done.returncode == 0, done.stdout + done.stderr

    def test_a_bad_glossary_version_file_is_refused(self, tmp_path: Path):
        bad = tmp_path / "glossary-version.json"
        bad.write_text('{"schema": "glossary-version/1"}', encoding="utf-8")
        with pytest.raises(ConfigError):
            load_glossary_version(bad)


class TestSettings:
    def test_defaults_sit_beside_the_service(self):
        settings = Settings.from_env({})
        assert settings.service_key is None
        assert settings.index_dir == SERVICE_ROOT / "index"
        assert settings.model_dir == SERVICE_ROOT / "models" / "all-MiniLM-L6-v2"
        assert settings.matrix_path is None

    def test_the_environment_overrides_them(self):
        settings = Settings.from_env(
            {
                "KNOWLEDGE_SERVICE_KEY": "secret",
                "KNOWLEDGE_INDEX_DIR": "/data/index",
                "KNOWLEDGE_MODEL_DIR": "/data/model",
                "KNOWLEDGE_MATRIX_PATH": "/data/matrix.json",
            }
        )
        assert settings.service_key == "secret"
        assert settings.index_dir == Path("/data/index") and settings.model_dir == Path("/data/model")
        assert settings.matrix_path == Path("/data/matrix.json")

    def test_an_empty_key_is_no_key(self):
        assert Settings.from_env({"KNOWLEDGE_SERVICE_KEY": ""}).service_key is None


class TestPackaging:
    def lines(self) -> list[str]:
        text = (SERVICE_ROOT / "requirements.txt").read_text(encoding="utf-8")
        return [ln.strip() for ln in text.splitlines() if ln.strip() and not ln.strip().startswith("#")]

    def test_every_requirement_is_pinned_to_one_version(self):
        packages = [ln for ln in self.lines() if not ln.startswith("--")]
        assert packages
        for line in packages:
            assert re.fullmatch(r"[A-Za-z0-9_.-]+==[0-9][A-Za-z0-9.+]*", line), f"not pinned exactly: {line}"

    def test_the_packages_the_order_lists_are_there(self):
        names = {ln.split("==")[0].lower() for ln in self.lines() if "==" in ln}
        assert {
            "txtai",
            "torch",
            "transformers",
            "faiss-cpu",
            "fastapi",
            "uvicorn",
            "pyyaml",
            "jsonschema",
            "pytest",
            "httpx",
        } <= names
        assert "txtai==9.5.0" in self.lines()
        assert "pyyaml==6.0.3" in self.lines() and "jsonschema==4.25.0" in self.lines()

    def test_torch_comes_from_the_cpu_index(self):
        assert "--extra-index-url https://download.pytorch.org/whl/cpu" in self.lines()

    def test_the_dockerfile_does_what_decision_d12_and_d3_say(self):
        text = (SERVICE_ROOT / "Dockerfile").read_text(encoding="utf-8")
        assert re.search(r"^FROM python:3\.11-slim", text, re.M)
        assert "pip install" in text and "requirements.txt" in text
        # the model is fetched at image build, at the pinned revision, and never at start
        assert "knowledge.gate fetch-model" in text
        assert re.search(r"HF_HUB_OFFLINE=1", text)
        # the index is built from the real corpus only, then checked: a failed gate is a failed build
        assert "knowledge.gate build" in text and "--require-real" in text
        assert "knowledge.gate check" in text
        assert re.search(r"uvicorn knowledge\.api:app --host 0\.0\.0\.0 --port \$\{PORT:-8000\}", text)
        assert not re.search(r"^USER root", text, re.M)

    def test_the_build_artifacts_are_not_committed(self):
        ignore = (SERVICE_ROOT / ".gitignore").read_text(encoding="utf-8").split()
        assert {"index/", "models/"} <= set(ignore)

    def test_the_corpus_and_the_fixtures_are_kept_out_of_prettier(self):
        # a reformatted corpus file is a new build id, and an approval holds the hash of what was read
        text = (REPO_ROOT / ".prettierignore").read_text(encoding="utf-8")
        assert "knowledge-service/corpus/**" in text
        assert "knowledge-service/tests/fixtures/**" in text

    @pytest.mark.parametrize("folder", ["knowledge", "tests"])
    def test_the_code_is_valid_python_3_11(self, folder):
        """The image runs 3.11; the tests may run on a newer Python, so syntax newer than 3.11 must not creep in."""
        for path in (SERVICE_ROOT / folder).rglob("*.py"):
            ast.parse(path.read_text(encoding="utf-8"), filename=str(path), feature_version=(3, 11))

    @pytest.mark.parametrize("folder", ["knowledge", "tests"])
    def test_no_f_string_needs_python_3_12(self, folder):
        """PEP 701 (3.12) allows an f-string to reuse its own quote and to hold a backslash inside `{}`; 3.11 does not,
        and `ast.parse(feature_version=...)` does not look for it. Python 3.11 is the image's."""
        for path in (SERVICE_ROOT / folder).rglob("*.py"):
            source = path.read_text(encoding="utf-8")
            for node in ast.walk(ast.parse(source)):
                if not isinstance(node, ast.JoinedStr):
                    continue
                whole = ast.get_source_segment(source, node) or ""
                body = whole.lstrip("fFrRbBuU")
                quote = body[:3] if body[:3] in ('"""', "'''") else body[:1]
                for part in node.values:
                    if isinstance(part, ast.FormattedValue):
                        inner = ast.get_source_segment(source, part.value) or ""
                        assert quote not in inner, f"{path.name}:{node.lineno} reuses its quote inside an f-string field"
                        assert "\\" not in inner, f"{path.name}:{node.lineno} has a backslash inside an f-string field"
