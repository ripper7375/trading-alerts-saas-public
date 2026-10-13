"""The tag whitelist: `tags.yaml` plus the generated `registry-codes.json` (architecture 4.6 item 2)."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

from helpers import REPO_ROOT
from knowledge.config import CONFIG_DIR
from knowledge.errors import ConfigError
from knowledge.tags import Tags, check_tag_values, load_tags

REGISTRY = CONFIG_DIR / "registry-codes.json"


def codes_of(problems):
    return sorted(p.code for p in problems)


def check(tags: Tags, **values):
    base = dict(where="f.md", domain="D1", mcd_id=None, state_codes=[], timeframe=None)
    return check_tag_values(tags, **{**base, **values})


class TestTheRealWhitelist:
    def test_domains_are_in_rank_order(self, tags: Tags):
        assert tags.domains == ("D1", "D2", "D3", "D4", "D5")
        assert [tags.domain_rank(d) for d in tags.domains] == [0, 1, 2, 3, 4]

    def test_timeframes(self, tags: Tags):
        assert tags.timeframes == ("M5", "M15")

    def test_mcd_ids_and_state_codes_are_the_registries(self, tags: Tags):
        registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
        assert list(tags.mcd_ids) == registry["mcd_ids"]
        assert {m: list(c) for m, c in tags.state_codes.items()} == registry["state_codes"]
        # the part 1 hand-off: 4 sensors and 32 state codes
        assert len(tags.mcd_ids) == 4
        assert len(tags.all_state_codes) == 32

    def test_every_state_code_belongs_to_its_mcd(self, tags: Tags):
        for mcd, codes in tags.state_codes.items():
            assert all(code.startswith(f"{mcd}_") for code in codes)
            assert all(tags.mcd_of(code) == mcd for code in codes)

    def test_tags_yaml_does_not_type_an_mcd_id_or_a_state_code(self):
        import re

        import yaml

        # the data, not the comments: no value in the file may look like an MCD id or a state code
        data = yaml.safe_load((CONFIG_DIR / "tags.yaml").read_text(encoding="utf-8"))
        values = json.dumps(data)
        assert not re.search(r"MCD[0-9]", values), "MCD ids and state codes come from registry-codes.json, not from tags.yaml"

    def test_the_fingerprint_changes_with_the_whitelist(self, tags: Tags, tmp_path: Path):
        registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
        registry["state_codes"]["MCD1"].append("MCD1_NEW_STATE")
        changed = tmp_path / "registry-codes.json"
        changed.write_text(json.dumps(registry), encoding="utf-8")
        assert load_tags(CONFIG_DIR / "tags.yaml", changed).sha256 != tags.sha256

    @pytest.mark.skipif(
        not (REPO_ROOT / "scripts" / "intake" / "build_roster.py").is_file(), reason="the monolith's scripts are not beside the service"
    )
    def test_registry_codes_equal_a_rebuild_from_the_registries(self):
        done = subprocess.run(
            [sys.executable, "-I", str(REPO_ROOT / "scripts" / "intake" / "build_roster.py"), "--check"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            cwd=REPO_ROOT,
        )
        assert done.returncode == 0, done.stdout + done.stderr


class TestCheckTagValues:
    def test_a_clean_document_has_no_problem(self, tags: Tags):
        assert check(tags, domain="D2", mcd_id="MCD1", state_codes=["MCD1_UP_IN_CORRIDOR"], timeframe="M15") == []

    @pytest.mark.parametrize("domain", ["D6", "d1", "", None, 1, "D1 "])
    def test_an_unknown_domain(self, tags: Tags, domain):
        assert codes_of(check(tags, domain=domain)) == ["UNKNOWN_DOMAIN"]

    @pytest.mark.parametrize("mcd", ["MCD9", "MCD", "mcd1", "MCD1 ", 1, "MCD1' OR 1=1 --"])
    def test_an_unknown_mcd_id(self, tags: Tags, mcd):
        assert codes_of(check(tags, mcd_id=mcd)) == ["UNKNOWN_MCD_ID"]

    @pytest.mark.parametrize("code", ["MCD1_NOT_A_STATE", "MCD9_UP", "mcd1_up_in_corridor", "", 5])
    def test_an_unknown_state_code(self, tags: Tags, code):
        assert codes_of(check(tags, state_codes=[code])) == ["UNKNOWN_STATE_CODE"]

    def test_a_state_code_of_another_sensor(self, tags: Tags):
        problems = check(tags, mcd_id="MCD1", state_codes=["MCD2_UP_IN_CORRIDOR"])
        assert codes_of(problems) == ["STATE_CODE_NOT_OF_MCD"]

    def test_state_codes_of_several_sensors_are_fine_without_an_mcd_id(self, tags: Tags):
        assert check(tags, state_codes=["MCD1_UP_IN_CORRIDOR", "MCD3_BULL_VALUE"]) == []

    def test_a_state_code_listed_twice(self, tags: Tags):
        assert codes_of(check(tags, state_codes=["MCD3_BULL_VALUE", "MCD3_BULL_VALUE"])) == ["DUPLICATE_STATE_CODE"]

    @pytest.mark.parametrize("timeframe", ["M1", "H1", "m5", "5", 5])
    def test_an_unknown_timeframe(self, tags: Tags, timeframe):
        assert codes_of(check(tags, timeframe=timeframe)) == ["UNKNOWN_TIMEFRAME"]

    def test_every_problem_is_reported_together(self, tags: Tags):
        problems = check(tags, domain="D9", mcd_id="MCD9", state_codes=["NOPE"], timeframe="H4")
        assert codes_of(problems) == ["UNKNOWN_DOMAIN", "UNKNOWN_MCD_ID", "UNKNOWN_STATE_CODE", "UNKNOWN_TIMEFRAME"]


class TestLoadingTheWhitelist:
    def write(self, tmp_path: Path, registry: dict, tags_text: str | None = None) -> tuple[Path, Path]:
        reg = tmp_path / "registry-codes.json"
        reg.write_text(json.dumps(registry), encoding="utf-8")
        yaml_path = tmp_path / "tags.yaml"
        yaml_path.write_text(
            tags_text
            or "schema: tags/1\ndomains: [D1, D2]\ntimeframes: [M5, M15]\nregistry_codes: registry-codes.json\n",
            encoding="utf-8",
        )
        return yaml_path, reg

    def registry(self) -> dict:
        return json.loads(REGISTRY.read_text(encoding="utf-8"))

    def test_it_loads_a_consistent_pair(self, tmp_path: Path):
        yaml_path, reg = self.write(tmp_path, self.registry())
        assert load_tags(yaml_path, reg).domains == ("D1", "D2")

    def test_the_default_registry_is_the_file_tags_yaml_names(self, tmp_path: Path):
        yaml_path, _ = self.write(tmp_path, self.registry())
        assert load_tags(yaml_path).mcd_ids == ("MCD0", "MCD1", "MCD2", "MCD3")

    def test_a_wrong_schema_is_refused(self, tmp_path: Path):
        yaml_path, reg = self.write(tmp_path, self.registry(), "schema: tags/2\ndomains: [D1]\ntimeframes: [M5]\n")
        with pytest.raises(ConfigError, match="schema"):
            load_tags(yaml_path, reg)

    @pytest.mark.parametrize(
        "text",
        [
            "schema: tags/1\ndomains: []\ntimeframes: [M5]\n",
            "schema: tags/1\ndomains: [D1, D1]\ntimeframes: [M5]\n",
            "schema: tags/1\ndomains: [one]\ntimeframes: [M5]\n",
            "schema: tags/1\ndomains: [D1]\ntimeframes: []\n",
        ],
    )
    def test_bad_domains_or_timeframes_are_refused(self, tmp_path: Path, text: str):
        yaml_path, reg = self.write(tmp_path, self.registry(), text)
        with pytest.raises(ConfigError):
            load_tags(yaml_path, reg)

    def test_a_state_code_listed_under_the_wrong_sensor_is_refused(self, tmp_path: Path):
        registry = self.registry()
        registry["state_codes"]["MCD1"].append("MCD2_UP_IN_CORRIDOR")
        yaml_path, reg = self.write(tmp_path, registry)
        with pytest.raises(ConfigError, match="STATE_CODE_OF_OTHER_MCD"):
            load_tags(yaml_path, reg)

    def test_a_state_code_the_packet_would_refuse_is_refused(self, tmp_path: Path):
        registry = self.registry()
        registry["state_codes"]["MCD1"].append("MCD1_" + "X" * 60)  # over the 48 characters the packet allows
        yaml_path, reg = self.write(tmp_path, registry)
        with pytest.raises(ConfigError, match="BAD_STATE_CODE"):
            load_tags(yaml_path, reg)

    def test_a_duplicate_state_code_is_refused(self, tmp_path: Path):
        registry = self.registry()
        registry["state_codes"]["MCD1"].append(registry["state_codes"]["MCD1"][0])
        yaml_path, reg = self.write(tmp_path, registry)
        with pytest.raises(ConfigError, match="DUPLICATE_STATE_CODE"):
            load_tags(yaml_path, reg)

    def test_board_ids_must_be_registered(self, tmp_path: Path):
        registry = self.registry()
        registry["board_mcd_ids"] = ["MCD7"]
        yaml_path, reg = self.write(tmp_path, registry)
        with pytest.raises(ConfigError, match="board_mcd_ids"):
            load_tags(yaml_path, reg)

    def test_every_sensor_needs_a_state_code_entry(self, tmp_path: Path):
        registry = self.registry()
        del registry["state_codes"]["MCD2"]
        yaml_path, reg = self.write(tmp_path, registry)
        with pytest.raises(ConfigError, match="state_codes"):
            load_tags(yaml_path, reg)

    def test_two_timeframe_lists_must_agree(self, tmp_path: Path):
        registry = self.registry()
        registry["timeframes"] = ["M5"]
        yaml_path, reg = self.write(tmp_path, registry)
        with pytest.raises(ConfigError, match="TIMEFRAMES_DISAGREE"):
            load_tags(yaml_path, reg)

    def test_a_missing_file_is_a_config_error(self, tmp_path: Path):
        with pytest.raises(ConfigError):
            load_tags(tmp_path / "nope.yaml", tmp_path / "nope.json")
