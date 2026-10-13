"""The real corpus, domains D3, D4 and D5 (build step 6 part 8): coverage, size, figures, wording, retrieval, the gate.

D3 explains the synthesis rules and the entry zones, D4 explains Engine 4 (sizing, stops, caution, the profile, the underflow
help, the badge), D5 explains the invariants, the single-order scope, the news blackouts and the assistant's role. These tests
read `corpus/` (never the TEST ONLY fixtures) on the real tokenizer and the real txtai index.

What is NOT tested here, on purpose: whether the prose is right. That is Davin's approval (ADR-042). What is tested is what a
machine can show about it: that every rule of `draft-1` is explained, that every figure D4 quotes is the engine's (worked
examples, profile defaults, zone parameters), that D5's blackout windows are `blackout.ts`'s, that no chunk is out of its bounds,
that no forbidden phrase is in it, and that the index finds it.
"""

from __future__ import annotations

import json
import re
import shutil
import statistics
from decimal import ROUND_HALF_UP, Decimal
from fractions import Fraction
from pathlib import Path

import pytest
import yaml

from helpers import REPO_ROOT, SERVICE_ROOT
from knowledge.approval import APPROVAL_DIR, APPROVED, PENDING, REVIEW_DIR, area_files, area_hashes, load_approvals
from knowledge.build import check_chunks, read_corpus
from knowledge.chunker import Chunk
from knowledge.config import PLAYBOOKS_M_STAR, IndexConfig, Matrix
from knowledge.frontmatter import parse_document
from knowledge.gate import main
from knowledge.model import TokenCounter
from knowledge.review import SOURCE_MAP_FILE, run_review
from knowledge.search import Retriever, SearchRequest, plan_search
from knowledge.tags import Tags
from knowledge.wording import scan

CORPUS = SERVICE_ROOT / "corpus"
ENGINE = REPO_ROOT / "davintrade-stack-d-and-e" / "engine-1-5-new"
SYNTHESIS = ENGINE / "mcd_worker" / "synthesis"
RULES_FILE = SYNTHESIS / "rules" / "draft-1.yaml"
ZONE_PARAMS = SYNTHESIS / "zone_params.yaml"
EXAMPLES = REPO_ROOT / "__tests__" / "lib" / "engine4" / "worked-examples"
ENGINE4 = REPO_ROOT / "lib" / "engine4"
ARCHITECTURE = REPO_ROOT / "docs" / "STACK-D-ARCHITECTURE.md"

PART8 = ("D3", "D4", "D5")
FILES = {
    "d3-synthesis-rules": "D3/synthesis-rules.md",
    "d3-archetypes": "D3/archetypes.md",
    "d3-sensor-conflicts": "D3/sensor-conflicts.md",
    "d3-zones-and-runway": "D3/zones-and-runway.md",
    "d4-position-sizing": "D4/position-sizing.md",
    "d4-structural-stops": "D4/structural-stops.md",
    "d4-caution-sizing": "D4/caution-sizing.md",
    "d4-profile-and-underflow": "D4/profile-and-underflow.md",
    "d5-system-invariants": "D5/system-invariants.md",
    "d5-single-order-scope": "D5/single-order-scope.md",
    "d5-news-blackouts": "D5/news-blackouts.md",
    "d5-decision-support-role": "D5/decision-support-role.md",
}
PART7_AREAS = {"D1", "D2-MCD0", "D2-MCD1", "D2-MCD2", "D2-MCD3"}
MIN_TOKENS, MAX_TOKENS, MAX_CHARS = 200, 450, 4000
MCDS = ("MCD0", "MCD1", "MCD2", "MCD3")


# ---------------------------------------------------------------------------
# fixtures and helpers
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def documents(tags: Tags):
    found = {}
    from knowledge.build import corpus_files

    for path in corpus_files(CORPUS):
        rel = path.relative_to(CORPUS).as_posix()
        document, problems = parse_document(path.read_bytes().decode("utf-8"), rel, tags)
        assert problems == [], f"{rel}: {problems}"
        found[document.front_matter.id] = document
    return found


@pytest.fixture(scope="module")
def texts():
    """relative path -> the file's text with LF endings, for the files of D3, D4 and D5."""
    return {rel: (CORPUS / rel).read_bytes().decode("utf-8").replace("\r\n", "\n") for rel in FILES.values()}


@pytest.fixture(scope="module")
def bodies(texts):
    """relative path -> the text after the front matter."""
    return {rel: text.split("\n---\n", 1)[1] for rel, text in texts.items()}


@pytest.fixture(scope="module")
def all_chunks(tags: Tags, index_config: IndexConfig, counter: TokenCounter) -> list[Chunk]:
    made, problems = read_corpus(CORPUS, tags, index_config, counter.count)
    assert problems == [], problems
    return made


@pytest.fixture(scope="module")
def chunks(all_chunks) -> list[Chunk]:
    return [c for c in all_chunks if c.domain in PART8]


@pytest.fixture(scope="module")
def retriever(real_corpus_retriever) -> Retriever:
    return real_corpus_retriever


def of_domain(chunks: list[Chunk], domain: str) -> list[Chunk]:
    return [c for c in chunks if c.domain == domain]


def with_token(chunks: list[Chunk], token: str) -> list[Chunk]:
    return [c for c in chunks if re.search(rf"(?<![A-Za-z0-9_]){re.escape(token)}(?![A-Za-z0-9_])", c.text)]


def squash(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()


def read_text(path: Path) -> str:
    if not path.is_file():
        pytest.skip(f"{path} is not beside the service")
    return path.read_text(encoding="utf-8").replace("\r\n", "\n")


def read_json(path: Path):
    return json.loads(read_text(path))


def read_yaml(path: Path):
    return yaml.safe_load(read_text(path))


# exact money and number formatting, for quoting a source's figure the way the corpus writes it
D = Decimal


def frac(text: str) -> Fraction:
    """'50000/254500', '2947.5/100' and '0.06' as exact fractions."""
    numerator, _, denominator = text.partition("/")
    return Fraction(D(numerator)) / Fraction(D(denominator or "1"))


def rounded(value: Fraction | Decimal, places: int) -> Decimal:
    exact = D(value.numerator) / D(value.denominator) if isinstance(value, Fraction) else value
    return exact.quantize(D(1).scaleb(-places), rounding=ROUND_HALF_UP)


def usd(value: Fraction | Decimal | str, places: int = 2) -> str:
    if isinstance(value, str):
        value = D(value)
    return f"${rounded(value, places):,.{places}f}"


def num(value: Fraction | Decimal | str, places: int = 2, *, commas: bool = True) -> str:
    if isinstance(value, str):
        value = D(value)
    return f"{rounded(value, places):,.{places}f}" if commas else f"{rounded(value, places):.{places}f}"


def pct(value: Fraction | Decimal | str, places: int = 2) -> str:
    if isinstance(value, str):
        value = D(value)
    return f"{rounded(value, places):.{places}f}%"


def ratio(value: Fraction | Decimal | str) -> str:
    if isinstance(value, str):
        value = D(value)
    return f"{rounded(value, 2):.2f}x"


# ---------------------------------------------------------------------------
# what is in the folder
# ---------------------------------------------------------------------------


class TestWhatIsInTheFolder:
    def test_every_file_of_the_order_is_there_with_its_id(self, documents):
        for doc_id, rel in FILES.items():
            assert doc_id in documents, doc_id
            assert documents[doc_id].path == rel

    def test_each_file_is_tagged_as_the_order_says(self, documents):
        for doc_id in FILES:
            fm = documents[doc_id].front_matter
            assert (fm.domain, fm.mcd_id, fm.state_codes, fm.timeframe, fm.version) == (
                doc_id[:2].upper(), None, (), None, "1.0.0",
            ), doc_id
            assert len(fm.related) >= 3, f"{doc_id} points to too little"

    def test_related_names_chunks_that_exist(self, documents, all_chunks):
        ids = {c.id for c in all_chunks}
        for doc_id in FILES:
            for ref in documents[doc_id].front_matter.related:
                assert ref in ids, f"{doc_id} relates to {ref}, which is not a chunk"

    def test_no_file_relates_to_itself(self, documents):
        for doc_id in FILES:
            assert not any(r.startswith(doc_id + ".") for r in documents[doc_id].front_matter.related), doc_id

    def test_a_chunk_belongs_to_the_domain_of_its_file(self, chunks):
        for c in chunks:
            assert c.id.startswith(c.doc_id + ".") and c.doc_id[:2].upper() == c.domain
            assert c.mcd_id is None and not c.state_codes and c.timeframe is None

    def test_the_corpus_has_the_size_the_plan_expected(self, all_chunks):
        domains = {d: len(of_domain(all_chunks, d)) for d in ("D1", "D2", *PART8)}
        assert 120 <= len(all_chunks) <= 160, domains
        assert domains["D3"] >= 20 and domains["D4"] >= 15 and domains["D5"] >= 10, domains


# ---------------------------------------------------------------------------
# chunk bounds
# ---------------------------------------------------------------------------


class TestChunkBounds:
    def test_every_chunk_is_between_200_and_450_tokens_and_under_4000_characters(self, chunks, counter: TokenCounter):
        assert [(c.id, c.tokens) for c in chunks if not MIN_TOKENS <= c.tokens <= MAX_TOKENS] == []
        assert [c.id for c in chunks if c.chars >= MAX_CHARS] == []
        for c in chunks:
            assert c.tokens == counter.count(c.text), c.id

    def test_each_section_is_exactly_one_chunk_nothing_is_merged_or_split(self, texts, chunks):
        for rel, text in texts.items():
            sections = re.findall(r"^#{2,3} .+$", text, flags=re.MULTILINE)
            made = [c for c in chunks if c.path == rel]
            assert len(made) == len(sections), f"{rel}: {len(sections)} sections but {len(made)} chunks"
            assert [c.heading for c in made] == [s.lstrip("# ").strip() for s in sections], rel

    def test_the_whole_corpus_builds_with_nothing_to_warn_about(self, all_chunks, index_config: IndexConfig, counter: TokenCounter):
        problems, warnings = check_chunks(all_chunks, index_config, counter.window)
        assert problems == [] and warnings == []

    def test_the_real_index_builds_clean(self, real_corpus_build):
        assert real_corpus_build.warnings == []
        assert real_corpus_build.corpus_kind == "REAL"
        assert re.fullmatch(r"kb-[0-9a-f]{32}", real_corpus_build.index_build_id)
        domains = real_corpus_build.metadata["domains"]
        assert all(domains[d] > 0 for d in ("D1", "D2", *PART8)), domains
        assert real_corpus_build.chunk_count == sum(domains.values())

    def test_chunk_ids_are_short_and_unique(self, all_chunks):
        ids = [c.id for c in all_chunks]
        assert len(ids) == len(set(ids))
        assert max(len(i) for i in ids) <= 80


# ---------------------------------------------------------------------------
# D3: every rule of draft-1 is explained
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def draft1():
    return read_yaml(RULES_FILE)


class TestD3CoversEveryRuleOfDraft1:
    def test_draft_1_is_the_only_rules_version_the_corpus_was_written_from(self, draft1, texts):
        """A new rules file (draft-2) changes the table: this fails until D3 is read against it and approved again."""
        assert sorted(p.name for p in RULES_FILE.parent.iterdir()) == ["draft-1.yaml"]
        assert draft1["rules_version"] == "draft-1" and draft1["schema"] == "synthesis-rules/1"
        assert "draft-1" in texts["D3/synthesis-rules.md"]

    def test_the_table_has_the_rows_of_the_order(self, draft1):
        ids = [r["id"] for r in draft1["rules"]]
        assert ids == [
            "R0_DATA_CHECK", "R1_MACRO_COUNTER_TREND_RALLY", "R2_EXHAUSTION_SNAPBACK", "R3_TREND_CONTINUATION",
            "R3S_TREND_CONTINUATION_M5", "R4_RANGE", "R5_UNRESOLVED_CONFLICT",
        ]
        assert [m["id"] for m in draft1["modifiers"]] == [
            "M3_CONFLICT_EXPECTED_UNDER_R1", "M3_TREND_CONFLICT", "M3_OVERFLOW", "M3_ESCAPE",
            "M3_CONFIRMS_UP", "M3_CONFIRMS_DOWN", "M3_AGAINST_UP", "M3_AGAINST_DOWN",
        ]

    def test_every_rule_id_is_named_in_the_heading_of_its_own_section(self, draft1, chunks):
        d3 = of_domain(chunks, "D3")
        for rule in draft1["rules"]:
            owners = [c for c in d3 if re.search(rf"(?<![A-Za-z0-9_]){rule['id']}(?![A-Za-z0-9_])", c.heading or "")]
            assert len(owners) == 1, f"{rule['id']} is in the heading of {len(owners)} sections"

    def test_every_rule_id_is_listed_in_the_table_of_rows(self, draft1, chunks):
        rows = next(c for c in chunks if c.id == "d3-synthesis-rules.the-rows-of-the-draft-1-rules-table")
        for rule in draft1["rules"]:
            assert rule["id"] in rows.text, rule["id"]
        assert "NO_MATCH" in rows.text and "(row 3s)" in rows.text

    def test_the_no_match_result_is_explained(self, draft1, chunks):
        owner = next(c for c in chunks if c.id == "d3-synthesis-rules.when-no-rule-matches")
        assert "NO_MATCH" in owner.text and "NEUTRAL" in owner.text
        for reason in draft1["no_match"]["reasons"]:
            assert squash(reason) in squash(owner.text)
        assert squash(draft1["no_match"]["summary"]) in squash(owner.text)
        assert draft1["no_match"]["bias"] == "NEUTRAL"

    def test_every_branch_is_explained_in_the_section_of_its_rule(self, draft1, chunks):
        d3 = of_domain(chunks, "D3")
        for rule in draft1["rules"]:
            for branch in rule["branches"]:
                owners = [c for c in with_token(d3, branch["id"]) if with_token([c], rule["id"])]
                assert len(owners) == 1, f"{rule['id']}/{branch['id']} is explained by {len(owners)} sections"
                text = owners[0].text
                result = branch["result"]
                # the bias, the archetype, the trend relation, the reasons and the summary line are the branch's own
                assert result["bias"] in text, (branch["id"], result["bias"])
                if result.get("archetype"):
                    assert f"Archetype {result['archetype']}" in text, (branch["id"], result["archetype"])
                if result.get("trend_relation"):
                    assert result["trend_relation"] in text, (branch["id"], result["trend_relation"])
                for reason in result["reasons"]:
                    assert squash(reason) in squash(text), (branch["id"], reason)
                assert squash(result["summary"]) in squash(text), (branch["id"], result["summary"])

    def test_every_sensor_word_the_conditions_use_is_in_d3(self, draft1, chunks):
        d3_text = "\n".join(c.text for c in of_domain(chunks, "D3"))
        words = set()
        for rule in draft1["rules"]:
            for branch in rule["branches"]:
                for cond in branch["when"]:
                    if cond["fact"] in ("regime_status", "state_code"):
                        words.update(cond["in"])
        for modifier in draft1["modifiers"]:
            for cond in modifier["when"]:
                if cond["fact"] == "state_code":
                    words.update(cond["in"])
        assert len(words) >= 15
        for word in sorted(words):
            assert re.search(rf"(?<![A-Za-z0-9_]){word}(?![A-Za-z0-9_])", d3_text), word

    def test_the_trader_types_and_their_primary_sensors_are_stated(self, draft1, chunks):
        owner = next(c for c in chunks if c.id == "d3-synthesis-rules.row-0-the-data-check-r0-data-check")
        for profile, spec in draft1["profiles"].items():
            assert spec["primary_sensor"] in owner.text, profile
        assert "MCD1 for a Day Trader and MCD2 for a Scalper" in owner.text
        branch = draft1["rules"][0]["branches"][0]
        assert branch["id"] in owner.text and branch["result"]["data_stand_aside"] is True and "data_stand_aside" in owner.text
        assert branch["when"][0]["in"] == ["INVALID", "STALE", "ABSENT"]
        for status in branch["when"][0]["in"]:
            assert status in owner.text, status

    def test_primary_first_is_said_of_the_rows_that_have_it_and_only_those(self, draft1, chunks):
        conflicts = next(c for c in chunks if c.id == "d3-sensor-conflicts.when-the-m15-and-m5-sensors-disagree")
        flagged = [r["id"] for r in draft1["rules"] if r.get("primary_first")]
        assert flagged == ["R2_EXHAUSTION_SNAPBACK", "R4_RANGE"]
        assert "exhaustion row R2 and the range row R4" in conflicts.text

    def test_each_rule_is_said_to_apply_to_the_trader_types_the_file_names(self, draft1, chunks):
        order = next(c for c in chunks if c.id == "d3-archetypes.in-which-order-the-archetypes-are-tested")
        by_profile = {p: [r["id"] for r in draft1["rules"] if p in r["profiles"]] for p in ("DAY_TRADER", "SCALPER")}
        assert [i.split("_")[0] for i in by_profile["DAY_TRADER"]] == ["R0", "R1", "R2", "R3", "R4", "R5"]
        assert [i.split("_")[0] for i in by_profile["SCALPER"]] == ["R0", "R2", "R3S", "R4", "R5"]
        assert "A Day Trader is tested on R0, R1, R2, R3, R4, R5" in order.text
        assert "A Scalper is tested on R0, R2, R3S, R4, R5" in order.text

    def test_the_four_archetype_letters_map_to_the_rules_as_the_file_says(self, draft1, chunks):
        letters = {}
        for rule in draft1["rules"]:
            for branch in rule["branches"]:
                letter = branch["result"].get("archetype")
                if letter:
                    letters.setdefault(letter, set()).add(rule["id"])
        assert letters == {
            "A": {"R3_TREND_CONTINUATION", "R3S_TREND_CONTINUATION_M5"},
            "B": {"R2_EXHAUSTION_SNAPBACK"},
            "C": {"R1_MACRO_COUNTER_TREND_RALLY"},
            "D": {"R4_RANGE"},
        }
        overview = next(c for c in chunks if c.id == "d3-archetypes.the-four-archetypes-a-b-c-and-d")
        assert "A is R3_TREND_CONTINUATION for a Day Trader and R3S_TREND_CONTINUATION_M5 for a Scalper" in overview.text
        assert "B is R2_EXHAUSTION_SNAPBACK. C is R1_MACRO_COUNTER_TREND_RALLY. D is R4_RANGE." in overview.text


class TestD3ExplainsTheModifiers:
    def test_every_modifier_id_is_named_by_a_section_that_gives_its_effect_and_its_text(self, draft1, chunks):
        d3 = of_domain(chunks, "D3")
        effect_word = {"confirm": "confirm", "note": "note", "caution": "caution"}
        for modifier in draft1["modifiers"]:
            owners = with_token(d3, modifier["id"])
            assert owners, modifier["id"]
            assert any(squash(modifier["text"]) in squash(c.text) for c in owners), (modifier["id"], modifier["text"])
            assert any(effect_word[modifier["effect"]] in c.text.lower() for c in owners), modifier["id"]
            for cond in modifier["when"]:
                if cond["fact"] == "state_code":
                    assert any(all(code in c.text for code in cond["in"]) for c in owners), modifier["id"]

    def test_the_modifier_that_depends_on_a_rule_names_that_rule(self, draft1, chunks):
        d3 = of_domain(chunks, "D3")
        for modifier in draft1["modifiers"]:
            for rule in modifier.get("rules", []):
                assert any(rule in c.text and modifier["id"] in c.text for c in d3), (modifier["id"], rule)

    def test_the_effects_are_the_ones_the_file_gives(self, draft1, chunks):
        effects = {m["id"]: m["effect"] for m in draft1["modifiers"]}
        assert effects == {
            "M3_CONFLICT_EXPECTED_UNDER_R1": "note", "M3_TREND_CONFLICT": "caution", "M3_OVERFLOW": "caution",
            "M3_ESCAPE": "caution", "M3_CONFIRMS_UP": "confirm", "M3_CONFIRMS_DOWN": "confirm",
            "M3_AGAINST_UP": "note", "M3_AGAINST_DOWN": "note",
        }
        modifiers = next(c for c in chunks if c.id == "d3-sensor-conflicts.mcd3-modifies-a-direction-and-never-votes-for-one")
        assert "A flat consolidation, MCD3_SIDEWAYS_EQUILIBRIUM, has no modifier entry" in modifiers.text
        assert "MCD3_BULL_TOP and MCD3_BEAR_BOTTOM confirm" in modifiers.text

    def test_the_modifier_caution_reason_code_is_a_real_code(self, chunks):
        path = ENGINE / "mcd_common" / "reason_codes.py"
        source = read_text(path)
        d3_text = "\n".join(c.text for c in of_domain(chunks, "D3"))
        for code in ("MCD0_DEFECT_M5", "MCD0_DEFECT_M15", "RETUNING", "DETECTION_MISMATCH"):
            assert code in source, code
            assert code in d3_text, code
        assert "MODIFIER_CAUTION" in d3_text and "MODIFIER_CAUTION" in read_text(SYNTHESIS / "synthesis.md")


class TestD3Figures:
    """The zone figures D3 quotes are `zone_params.yaml`'s, the five-percent filter and the half-height range are ADR-034's."""

    @pytest.fixture(scope="class")
    def params(self):
        return {k: v["value"] for k, v in read_yaml(ZONE_PARAMS)["parameters"].items()}

    @pytest.fixture(scope="class")
    def zones(self, chunks):
        return {c.id.split(".", 1)[1]: c.text for c in chunks if c.doc_id == "d3-zones-and-runway"}

    def test_the_half_width_is_the_fraction_of_the_channel_width(self, params, zones):
        assert params["half_width_fraction"] == 0.10
        assert "half-width of 10% of the width of its own channel" in zones["how-a-zone-is-drawn"]

    def test_the_invalidation_buffer_and_the_minimum_stop(self, params, zones):
        text = zones["structural-invalidation-why-the-stop-sits-behind-structur"]
        assert params["invalidation_buffer"] == 0.50 and params["min_stop_distance"] == 13
        assert "$0.50 beyond the nearest structure level" in text
        assert "never less than $13" in text and "exactly $13 from the reference price" in text
        assert all(label in text for label in ("LEVEL", "MINIMUM_STOP", "NO_LEVEL"))

    def test_at_most_five_zones_and_two_decimals(self, params, zones):
        assert params["max_zones"] == 5 and params["ratio_decimals"] == 2 and params["price_decimals"] == 2
        assert "At most five zones are kept" in zones["how-zones-are-ranked-and-become-price-pills"]
        assert "ids Z1 to Z5" in zones["how-zones-are-ranked-and-become-price-pills"]
        assert "rounded to two decimals" in zones["runway-the-room-to-the-next-opposing-level"]

    def test_the_custom_entry_bound_is_adr_034s(self, zones):
        adr = read_text(REPO_ROOT / "docs" / "adr" / "034-custom-entry-bound.md")
        assert "1-day range widened by half its height" in adr and "±5%" in adr
        text = zones["how-zones-are-ranked-and-become-price-pills"]
        assert "range of the last day widened by half its height" in text and "plus or minus 5% of the live price" in text

    def test_the_reference_price_is_the_close_of_the_last_closed_m5_bar(self, zones):
        adr = read_text(REPO_ROOT / "docs" / "adr" / "086-the-reference-price-is-the-last-closed-m5-close.md")
        assert "last closed M5" in adr
        assert "the close of the last closed M5 bar" in zones["what-an-entry-zone-is"]

    def test_the_counter_trend_cap_is_the_profiles(self, chunks):
        profile = read_text(ENGINE4 / "profile.ts")
        assert re.search(r"counterTrendRrrCap:\s*'2\.5'", profile)
        trend = next(c for c in chunks if c.id == "d3-archetypes.trend-relation-with-the-trend-or-against-it")
        assert "capped at 2.50x" in trend.text


# ---------------------------------------------------------------------------
# D4: every figure is the engine's
# ---------------------------------------------------------------------------


class Sources:
    """The numbers D4 may quote, read from the files they live in. Nothing here is typed twice."""

    def __init__(self) -> None:
        for example in ("01-doc-6-7-table", "05-500-dollar-account", "07-cautionary-half-risk"):
            approval = read_json(EXAMPLES / example / "approval.json")
            assert approval["status"] == "APPROVED", f"worked example {example} is not approved: D4 may quote only approved figures"
        self.e1 = (read_json(EXAMPLES / "01-doc-6-7-table" / "scenario.json")["setup"], read_json(EXAMPLES / "01-doc-6-7-table" / "expected.json")["result"])
        self.e5 = (read_json(EXAMPLES / "05-500-dollar-account" / "scenario.json")["setup"], read_json(EXAMPLES / "05-500-dollar-account" / "expected.json")["result"])
        self.e7 = (read_json(EXAMPLES / "07-cautionary-half-risk" / "scenario.json")["setup"], read_json(EXAMPLES / "07-cautionary-half-risk" / "expected.json")["result"])
        profile = read_text(ENGINE4 / "profile.ts")
        block = re.search(r"PROFILE_DEFAULTS[^{]*\{(.*?)\}\);", profile, re.DOTALL)
        assert block
        self.defaults = dict(re.findall(r"(\w+):\s*'([^']*)'", block.group(1)))
        self.bounds = {
            "risk": re.search(r"maxRiskPct:\s*\{\s*min:\s*'([\d.]+)',\s*max:\s*'([\d.]+)'", profile).groups(),
            "rrr": re.search(r"targetRrr:\s*\{\s*min:\s*'([\d.]+)',\s*max:\s*'([\d.]+)'", profile).groups(),
            "ceiling": re.search(r"maxLeverageCeiling:\s*'([\d.]+)'", profile).group(1),
            "cap": re.search(r"counterTrendRrrCap:\s*'([\d.]+)'", profile).group(1),
        }
        self.risk_step = re.search(r"RISK_PCT_STEP\s*=\s*'([\d.]+)'", profile).group(1)
        self.notch = re.search(r"RRR_NOTCH\s*=\s*'([\d.]+)'", read_text(ENGINE4 / "scenarios.ts")).group(1)
        rounding = re.search(r"RISK_ROUNDING_STEP\s*=\s*Rational\.fromFraction\((\d+)n,\s*(\d+)n\)", read_text(ENGINE4 / "underflow.ts"))
        self.risk_rounding = D(rounding.group(1)) / D(rounding.group(2))
        arch = read_text(ARCHITECTURE)
        leverage = re.search(r"\| 4\s+\| Maximum leverage\s+\| 1:([\d.]+) – 1:([\d.]+) presets or custom, \*\*ceiling 1:([\d.]+)\*\*", arch)
        assert leverage, "architecture 6.2 row 4 changed"
        self.presets = leverage.groups()
        zone = {k: v["value"] for k, v in read_yaml(ZONE_PARAMS)["parameters"].items()}
        self.buffer, self.min_stop = D(str(zone["invalidation_buffer"])), D(str(zone["min_stop_distance"]))
        adr062 = read_text(REPO_ROOT / "docs" / "adr" / "062-structural-stop-options.md")
        self.old_pills = re.search(r"Fixed \$(\d+)–(\d+) pills", adr062).groups()

    def required(self) -> dict[str, str]:
        """Figure as the corpus writes it -> where it comes from. Every one of these must be in D4."""
        s1, r1 = self.e1
        sz1, sc1 = r1["sizing"], r1["scenarios"]["scenarios"]
        s5, r5 = self.e5
        sz5, u5 = r5["sizing"], r5["underflow"]
        s7, r7 = self.e7
        out: dict[str, str] = {}

        def add(figure: str, origin: str) -> None:
            out[figure] = origin

        contract = D(s1["spec"]["contract_size"])
        lot = D(sz1["lot"])
        fill = D(sz1["fill_price"])
        add(usd(s1["equity"]), "example 01 equity")
        add(pct(s1["risk_pct"]), "example 01 risk")
        add(usd(sz1["declared_risk"]), "example 01 declared risk")
        add(num(s1["entry"]), "example 01 entry")
        add(usd(s1["stop_distance"]), "example 01 stop distance")
        add(f"${D(s1['commission']):f}", "example 01 commission")
        add(usd(sz1["loss_per_lot"], 0), "example 01 loss per lot")
        add(num(frac(sz1["lot_at_stop"]), 4, commas=False), "example 01 lot at the stop")
        add(num(sz1["stop_price"]), "example 01 stop price")
        add(sz1["lot"], "example 01 lot")
        add(usd(sz1["actual_risk"]), "example 01 actual risk")
        add(pct(sz1["actual_risk_pct_2dp"]), "example 01 actual risk percent")
        add(usd(lot * contract * fill), "example 01 exposure = lot x contract x fill price")
        add(sz1["leverage_used_3dp"], "example 01 leverage used")
        add(f"1:{s1['max_leverage']}", "example 01 max leverage")
        add(usd(D(s1["max_leverage"]) * D(s1["equity"])), "example 01 max leverage x equity")
        add(usd(fill * contract), "example 01 fill price x contract")
        add(num(frac(sz1["max_lot_by_leverage"]), 3, commas=False), "example 01 max lot by leverage")
        for sc in sc1:
            tag = f"example 01 {sc['name'].lower()}"
            add(ratio(sc["rrr"]), tag + " ratio")
            add(usd(sc["target_distance_2dp"]), tag + " target distance")
            add(num(sc["target_price_2dp"]), tag + " target price")
            add(usd(sc["net_profit_2dp"]), tag + " net profit")
        add(usd(s5["equity"]), "example 05 equity")
        add(pct(s5["risk_pct"]), "example 05 risk")
        add(usd(sz5["declared_risk"]), "example 05 declared risk")
        add(num(frac(sz5["lot_at_stop"]), 4, commas=False), "example 05 lot at the stop")
        add(usd(u5["min_lot_loss"]), "example 05 loss of one minimum lot")
        add(pct(frac(u5["min_lot_risk_pct"])), "example 05 risk one minimum lot needs")
        add(pct(s5["max_risk_pct"]), "example 05 Max RPT")
        for fact in u5["facts"]:
            add(usd(fact["equity_at_least_2dp"]), f"example 05 {fact['kind']}")
        add(pct(s7["risk_pct"]), "example 07 pre-set risk")
        add(pct(s7["max_risk_pct"]), "example 07 Max RPT")
        add(usd(r7["sizing"]["declared_risk"]), "example 07 declared risk")
        add(usd(D(s7["equity"]) * D(s7["max_risk_pct"]) / 100), "example 07 declared risk at full Max RPT")
        return out

    def profile_figures(self) -> dict[str, str]:
        d, b = self.defaults, self.bounds
        return {
            pct(d["maxRiskPct"]): "default Max RPT",
            f"{D(b['risk'][0]):.1f}%": "Max RPT minimum",
            f"{D(b['risk'][1]):.1f}%": "Max RPT maximum",
            self.risk_step: "step of the risk percentage",
            f"1:{d['maxLeverage']}": "default Max leverage",
            f"1:{D(self.presets[0]):.1f}": "leverage preset minimum",
            f"1:{D(self.presets[1]):.1f}": "leverage preset maximum",
            f"1:{D(b['ceiling']):.1f}": "leverage ceiling",
            ratio(d["targetRrr"]): "default target RRR",
            ratio(b["rrr"][0]): "target RRR minimum",
            ratio(b["rrr"][1]): "target RRR maximum",
            ratio(b["cap"]): "counter-trend cap",
            usd(d["equity"], 0): "default equity",
            usd(d["minSld"]): "default Min SLD",
            usd(d["commission"]): "default commission",
            self.notch: "scenario notch",
            f"{self.risk_rounding:.2f}%": "risk rounding step of the underflow help",
            usd(self.buffer): "stop buffer",
            f"${self.min_stop:f}": "minimum stop distance of the zones",
            f"${self.old_pills[1]}": "upper end of the removed fixed pills",
            "5%": "typing filter on the entry",
        }

    def basics(self) -> set[str]:
        """The contract basics of the plain-English guide: arithmetic on 100 ounces a lot."""
        out = set()
        for lot in ("1.00", "0.10", "0.01"):
            out.add(lot)
        for move in ("0.01", "0.10", "1.00"):
            out.add(f"${move}")
            out.add(usd(D(move) * 100))
        out.add(usd(D("0.10") * 100 * D("5.00")))
        out.add("$5.00")
        return out


@pytest.fixture(scope="module")
def sources() -> Sources:
    return Sources()


FIGURE = re.compile(
    r"\$\s?\d[\d,]*(?:\.\d+)?|\d[\d,]*\.\d+(?:%|x)?|\d+(?:\.\d+)?%|\d+(?:\.\d+)?x\b|1:\d(?:\.\d)?|\d{1,3}(?:,\d{3})+"
)


def figures_in(text: str) -> set[str]:
    return {m.group(0).rstrip(",").replace("$ ", "$") for m in FIGURE.finditer(text)}


class TestD4Figures:
    @pytest.fixture(scope="class")
    def d4(self, bodies):
        return "\n".join(b for rel, b in bodies.items() if rel.startswith("D4/"))

    def test_the_worked_examples_d4_quotes_are_approved(self, sources):
        assert sources.e1 and sources.e5 and sources.e7

    def test_every_figure_of_the_worked_examples_is_in_d4(self, sources, d4):
        found = figures_in(d4)
        missing = {fig: origin for fig, origin in sources.required().items() if fig not in found}
        assert missing == {}

    def test_the_profile_defaults_bounds_and_steps_are_the_engines(self, sources, d4):
        found = figures_in(d4) | set(re.findall(r"\b0\.25\b", d4))
        missing = {fig: origin for fig, origin in sources.profile_figures().items() if fig not in found}
        assert missing == {}

    def test_the_eight_metrics_have_the_defaults_of_the_engine(self, sources, bodies):
        text = bodies["D4/profile-and-underflow.md"]
        d = sources.defaults
        assert d["traderType"] == "DAY_TRADER" and "The default is Day Trader." in text
        assert d["style"] == "TREND_FOLLOWING" and "The default is Trend Following." in text
        assert f"The default is {pct(d['maxRiskPct'])}." in text
        assert f"The default is 1:{d['maxLeverage']}." in text
        assert f"The default is {ratio(d['targetRrr'])}." in text
        assert f"The default is {usd(d['equity'], 0)}." in text
        assert f"The default is {usd(d['minSld'])}." in text
        assert f"The default is {usd(d['commission'])}." in text

    def test_there_are_exactly_eight_numbered_metrics(self, bodies):
        text = bodies["D4/profile-and-underflow.md"]
        numbered = re.findall(r"^(\d)\. ", text, flags=re.MULTILINE)
        assert numbered == [str(i) for i in range(1, 9)]
        assert "exactly eight metrics" in text

    def test_the_holding_windows_of_the_two_trader_types(self, bodies):
        blackout = read_text(ENGINE4 / "blackout.ts")
        assert re.search(r"SCALPER:\s*2n \* HOUR_SECONDS", blackout) and re.search(r"DAY_TRADER:\s*12n \* HOUR_SECONDS", blackout)
        text = bodies["D4/profile-and-underflow.md"]
        assert "less than 2 hours" in text and "less than 12 hours" in text

    def test_no_figure_in_d4_is_unaccounted_for(self, sources, d4):
        allowed = set(sources.required()) | set(sources.profile_figures()) | sources.basics()
        stray = sorted(figures_in(d4) - allowed)
        assert stray == [], f"D4 quotes {stray}, which no source accounts for"

    def test_the_contract_basics_are_the_guides(self, sources, bodies):
        guide = read_text(REPO_ROOT / "davintrade-stack-d-and-e" / "STACK-D-CALCULATION-FORMULAR.md")
        assert "1 Standard Lot = 100 Troy Ounces" in guide and "a 1-cent move on 1 lot is ALWAYS worth exactly $1.00" in guide
        text = bodies["D4/position-sizing.md"]
        for move, worth in (("0.01", "1.00"), ("0.10", "10.00"), ("1.00", "100.00")):
            assert D(move) * 100 == D(worth), move
        assert "a move of $0.01 on one lot is worth $1.00, a move of $0.10 is worth $10.00, and a move of $1.00 is worth $100.00" in text
        assert "one standard lot is 100 ounces" in text and sources.e1[0]["spec"]["contract_size"] == "100"
        assert "0.10 lot and a $5.00 move is 0.10 x 100 x $5.00 = $50.00" in text
        assert D("0.10") * 100 * D("5.00") == D("50")

    def test_the_formula_of_the_text_reproduces_the_worked_example(self, sources):
        """The text says: risk amount / (stop x 100 + commission), rounded down; the example's numbers follow from that."""
        s, r = sources.e1
        risk = D(s["equity"]) * D(s["risk_pct"]) / 100
        loss_per_lot = D(s["stop_distance"]) * 100 + D(s["commission"])
        raw = risk / loss_per_lot
        assert rounded(raw, 4) == D("0.0665") and loss_per_lot == D("1504") and risk == D("100")
        lot = (raw // D("0.01")) * D("0.01")
        assert lot == D(r["sizing"]["lot"]) == D("0.06")
        assert lot * loss_per_lot == D(r["sizing"]["actual_risk"]) == D("90.24")
        assert D(s["entry"]) - D(s["stop_distance"]) == D(r["sizing"]["stop_price"])
        # the target distance formula of the text: R x SLD + commission x (R + 1) / 100
        for sc in r["scenarios"]["scenarios"]:
            rrr = D(sc["rrr"])
            distance = rrr * D(s["stop_distance"]) + D(s["commission"]) * (rrr + 1) / 100
            assert rounded(distance, 2) == D(sc["target_distance_2dp"])
            assert lot * 100 * distance - D(s["commission"]) * lot == rrr * lot * loss_per_lot == D(sc["net_profit"])

    def test_the_underflow_example_is_the_oracles(self, sources):
        s, r = sources.e5
        assert r["sizing"]["status"] == "UNDERFLOW" and r["sizing"]["causes"] == ["RISK", "LEVERAGE"]
        assert [o["kind"] for o in r["underflow"]["options"]] == ["DECLINE"]
        assert D(s["max_risk_pct"]) < rounded(frac(r["underflow"]["min_lot_risk_pct"]), 2), "raising the risk is above Max RPT, so not offered"
        assert [f["kind"] for f in r["underflow"]["facts"]] == ["EQUITY_NEEDED_FOR_RISK", "EQUITY_NEEDED_FOR_LEVERAGE"]

    def test_the_half_risk_example_is_half_of_max_rpt(self, sources):
        s, r = sources.e7
        assert D(s["risk_pct"]) * 2 == D(s["max_risk_pct"])
        assert D(r["sizing"]["declared_risk"]) == D(s["equity"]) * D(s["risk_pct"]) / 100


class TestD4StatesWhatTheEngineDoes:
    def test_the_stop_buffer_and_minimum_are_the_zone_parameters(self, sources, bodies):
        text = bodies["D4/structural-stops.md"]
        assert "$0.50 beyond the level" in text and sources.buffer == D("0.50")
        assert f"which is {usd(sources.defaults['minSld'])} by default" in text
        assert "fixed stop pills of $13 to $21" in text and (sources.old_pills == ("13", "21"))

    def test_the_stop_options_follow_the_engine_module(self, bodies):
        source = read_text(ENGINE4 / "stops.ts")
        text = bodies["D4/structural-stops.md"]
        assert "$0.50 beyond the level" in source and "the nearest three" in source
        assert "nearest three options" in text

    def test_half_risk_is_a_preset_that_the_trader_may_override_up_to_max_rpt(self, bodies):
        engine = read_text(ENGINE4 / "modal-definition.ts")
        assert "const HALF = Rational.fromFraction(1n, 2n);" in engine
        validate = read_text(ENGINE4 / "validate.ts")
        assert "the trader chose more than the half-risk pre-set (up to Max RPT)" in validate
        text = bodies["D4/caution-sizing.md"]
        assert "The half risk is a pre-set and not a hard cap." in text and "A value above Max RPT is always refused." in text

    def test_the_badge_table_is_the_engines(self, bodies):
        badge = read_text(ENGINE4 / "badge.ts")
        text = bodies["D4/profile-and-underflow.md"]
        for row in ("No scenario fits before the next level", "Counter-trend or conflict", "With the trend; room >= Normal RRR"):
            assert row in badge
        assert "A counter-trend setup, or one with a conflict between the timeframes, can reach Conservative." in text
        assert "A badge goes only to a scenario whose target lies strictly before the next opposing level." in text

    def test_the_underflow_help_is_the_engines(self, bodies):
        source = read_text(ENGINE4 / "underflow.ts")
        for option in ("RAISE_RISK", "NEARER_STRUCTURAL_STOP", "DECLINE"):
            assert option in source
        text = bodies["D4/profile-and-underflow.md"]
        assert "Raising the risk is offered only if the risk that one minimum lot needs is at or under Max RPT." in text
        assert "Decline is always offered." in text
        assert "rounded up to the next 0.01%" in text and "RISK_ROUNDING_STEP = Rational.fromFraction(1n, 100n)" in source

    def test_the_validator_has_eight_checks_numbered_zero_to_seven(self, bodies):
        arch = read_text(ARCHITECTURE)
        section = arch.split("### 6.10 One validator, one template", 1)[1].split("###", 1)[0]
        rows = re.findall(r"^\| (\d)\s+\| (.+?)\s+\|$", section, flags=re.MULTILINE)
        assert [int(i) for i, _ in rows] == list(range(8))
        text = bodies["D4/profile-and-underflow.md"]
        assert "It runs eight checks." in text
        for i in range(8):
            assert f"Check {i}:" in text, i


# ---------------------------------------------------------------------------
# D5: the blackout windows are blackout.ts's
# ---------------------------------------------------------------------------


class TestD5Blackout:
    @pytest.fixture(scope="class")
    def constants(self):
        blackout = read_text(ENGINE4 / "blackout.ts")
        clock = read_text(ENGINE4 / "time.ts")
        minute = int(re.search(r"export const MINUTE_SECONDS = (\d+)n;", clock).group(1))
        hour = int(re.search(r"export const HOUR_SECONDS = ([\d_]+)n;", clock).group(1).replace("_", ""))
        assert (minute, hour) == (60, 3600)

        def window(name: str, unit: int, unit_name: str) -> int:
            found = re.search(rf"export const {name} = (\d+)n \* {unit_name};", blackout)
            assert found, name
            return int(found.group(1)) * unit // 60  # in minutes

        return {
            "exact": window("BLACKOUT_EXACT_SECONDS", minute, "MINUTE_SECONDS"),
            "approximate": window("BLACKOUT_APPROXIMATE_SECONDS", minute, "MINUTE_SECONDS"),
            "calendar_late": window("CALENDAR_LATE_SECONDS", minute, "MINUTE_SECONDS"),
            "scalper_hours": int(re.search(r"SCALPER:\s*(\d+)n \* HOUR_SECONDS", blackout).group(1)),
            "day_trader_hours": int(re.search(r"DAY_TRADER:\s*(\d+)n \* HOUR_SECONDS", blackout).group(1)),
            "kinds": re.search(r"TIER1_KINDS = \[(.*?)\] as const", blackout, re.DOTALL).group(1),
        }

    def test_the_constants_are_the_ones_of_the_order(self, constants):
        assert constants["exact"] == 15 and constants["approximate"] == 60 and constants["calendar_late"] == 45
        assert constants["scalper_hours"] == 2 and constants["day_trader_hours"] == 12

    def test_the_exact_window_is_15_minutes_either_side(self, constants, bodies):
        text = bodies["D5/news-blackouts.md"]
        assert f"from {constants['exact']} minutes before the release to {constants['exact']} minutes after it" in text

    def test_the_approximate_window_is_60_minutes_either_side(self, constants, bodies):
        text = bodies["D5/news-blackouts.md"]
        assert f"from {constants['approximate']} minutes before to {constants['approximate']} minutes after the stated time" in text
        assert f"at exactly {constants['approximate']} minutes the blackout holds" in text

    def test_the_holding_windows_are_2_hours_for_a_scalper_and_12_for_a_day_trader(self, constants, bodies):
        text = bodies["D5/news-blackouts.md"]
        assert f"{constants['scalper_hours']} hours for a Scalper and {constants['day_trader_hours']} hours for a Day Trader" in text

    def test_a_late_calendar_is_45_minutes(self, constants, bodies):
        assert f"has not been exported for {constants['calendar_late']} minutes" in bodies["D5/news-blackouts.md"]

    def test_the_four_tier_1_releases_are_the_engines(self, constants, bodies):
        for kind in ("CPI", "CORE_PCE", "FOMC_RATE_DECISION", "NFP"):
            assert f"'{kind}'" in constants["kinds"]
        text = bodies["D5/news-blackouts.md"]
        assert "US CPI, Core PCE, the FOMC rate decision and non-farm payrolls (NFP)" in text

    def test_the_edges_are_inclusive_as_the_worked_example_shows(self, bodies):
        example = EXAMPLES / "08-blackout-window-edge"
        assert read_json(example / "approval.json")["status"] == "APPROVED"
        probes = {p["label"]: p["status"] for p in read_json(example / "expected.json")["result"]["probes"]}
        assert probes["CPI -15:00 (window opens)"] == "BLOCKED" and probes["CPI -15:01"] == "CLEAR"
        assert probes["CPI +15:00 (window closes)"] == "BLOCKED" and probes["CPI +15:01"] == "CLEAR"
        assert probes["NFP approximate -60:00"] == "BLOCKED" and probes["NFP approximate -60:01"] == "CLEAR"
        assert probes["NFP approximate +60:00"] == "BLOCKED" and probes["NFP approximate +60:01"] == "CLEAR"
        text = bodies["D5/news-blackouts.md"]
        assert "at exactly 15 minutes before or after, the blackout still holds, and one second further away it no longer does" in text
        assert "A release at 16 minutes away leaves the setup allowed, one at 14 minutes blocks it" in text

    def test_the_architecture_says_the_same_windows(self):
        section = read_text(ARCHITECTURE).split("### 6.6 News blackout (D2) and defect flag (D4)", 1)[1].split("###", 1)[0]
        assert "15 minutes before to 15 minutes after" in section and "±60 minutes" in section
        assert "2 h Scalper, 12 h Day Trader" in section and "45 minutes" in section

    def test_the_whole_of_d5_quotes_no_other_duration_than_the_engines_and_the_retention(self, bodies, constants):
        allowed = {15, 60, 45, 2, 12, 16, 14}
        for rel, body in bodies.items():
            if not rel.startswith("D5/news"):
                continue
            used = {int(n) for n in re.findall(r"\b(\d+) (?:minutes?|hours?)\b", body)}
            assert used <= allowed, (rel, sorted(used - allowed))

    def test_the_single_order_notice_is_the_templates(self, bodies):
        text = read_text(ENGINE4 / "templates" / "text.ts")
        assert "This report covers a single order only. It does not manage your account or your open positions." in text
        d5 = bodies["D5/single-order-scope.md"]
        assert "covers a single order only and does not manage the account or any open positions" in d5
        assert "You place the order with your broker. DavinTrade places no orders." in text
        assert "DavinTrade places no orders" in bodies["D5/decision-support-role.md"]


# ---------------------------------------------------------------------------
# wording, numbers, stance
# ---------------------------------------------------------------------------

# Stricter than the build's backstop (ADR-035): no probability, odds, confidence, conviction or accuracy word at all. The word
# "grade" is allowed only when it says that something is NOT one.
ADR_035 = re.compile(r"\b(?:probabilit\w*|win[- ]?rates?|confiden\w+|conviction|odds|chances?|likelihood|accura\w+)\b", re.IGNORECASE)
GRADE = re.compile(r"\bgrades?\b", re.IGNORECASE)
GRADE_DENIED = re.compile(r"(?:not an?|no|letter) grades?\b", re.IGNORECASE)
IMPERATIVE = re.compile(r"(?:^|(?<=[.!?]\s))(?:Buy|Sell|Enter|Exit|Go long|Go short|Open a|Place a|Take profit|Close the position)\b", re.MULTILINE)
LIVE_NUMBER_PATTERNS = {
    "an ISO date": re.compile(r"\b\d{4}-\d{2}-\d{2}\b"),
    "a clock time": re.compile(r"(?<![\w:])\d{1,2}:\d{2}(?::\d{2})?(?![\w:])"),
    "a month and a day": re.compile(r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2}\b"),
    "an instrument": re.compile(r"\bXAU\w*\b", re.IGNORECASE),
}
PRICE_PATTERNS = {
    "a number with a thousands separator": re.compile(r"\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b"),
    "an integer of four or more digits": re.compile(r"(?<![\w.])\d{4,}(?![\w])"),
    "a dollar amount": re.compile(r"\$\s?\d"),
}


class TestWording:
    def test_the_wording_backstop_finds_nothing_in_any_chunk_or_file(self, chunks, texts):
        for c in chunks:
            assert scan(c.text) == [], (c.id, scan(c.text))
        for rel, text in texts.items():
            assert scan(text) == [], (rel, scan(text))

    def test_no_probability_odds_or_confidence_word_appears_at_all(self, texts):
        for rel, text in texts.items():
            assert [m.group(0) for m in ADR_035.finditer(text)] == [], rel

    def test_grade_appears_only_to_say_that_nothing_is_one(self, texts):
        for rel, text in texts.items():
            for match in GRADE.finditer(text):
                window = text[max(0, match.start() - 12) : match.end()]
                assert GRADE_DENIED.search(window), (rel, window)

    def test_no_sentence_opens_with_a_trading_instruction(self, texts):
        for rel, text in texts.items():
            assert [m.group(0) for m in IMPERATIVE.finditer(text)] == [], rel

    def test_no_second_person_instruction(self, texts):
        for rel, text in texts.items():
            assert not re.search(r"\byou (?:should|must|need to|have to)\b", text, re.IGNORECASE), rel

    def test_it_is_english_prose_in_plain_ascii(self, texts):
        for rel, text in texts.items():
            assert text.isascii(), (rel, sorted({ch for ch in text if not ch.isascii()}))

    def test_nothing_of_a_test_corpus_or_a_draft_marker_is_left(self, texts):
        for rel, text in texts.items():
            assert not re.search(r"TEST ONLY|TODO|FIXME|XXX|lorem ipsum|\bTBD\b", text, re.IGNORECASE), rel

    def test_every_file_has_front_matter_then_a_title_then_sections(self, texts):
        for rel, text in texts.items():
            assert text.startswith("---\n"), rel
            body = text.split("\n---\n", 1)[1]
            assert re.match(r"\n# [^\n]+\n\n## ", body), f"{rel}: a title, then the first section"

    def test_no_trailing_white_space_no_tab_one_final_newline(self, texts):
        for rel, text in texts.items():
            assert not re.search(r"[ \t]+$", text, re.MULTILINE) and "\t" not in text, rel
            assert text.endswith("\n") and not text.endswith("\n\n"), rel

    def test_the_decision_support_stance_is_said_plainly(self, bodies):
        text = bodies["D5/decision-support-role.md"]
        assert "decision-support tool and a risk copilot" in text
        assert "It is not an autonomous agent." in text and "places no orders" in text
        assert "The trader owns the decision to place a trade" in text


class TestNoLiveNumbers:
    """D3 and D5 name no price, level, date, time or instrument of any day. D4 quotes figures, and the test above accounts for each."""

    @pytest.mark.parametrize("kind", sorted(LIVE_NUMBER_PATTERNS))
    def test_no_date_time_or_instrument_anywhere(self, bodies, kind: str):
        for rel, body in bodies.items():
            assert LIVE_NUMBER_PATTERNS[kind].findall(body) == [], (rel, kind)

    @pytest.mark.parametrize("kind", sorted(PRICE_PATTERNS))
    def test_no_price_or_amount_in_d3_and_d5_except_the_zone_parameters(self, bodies, kind: str):
        for rel, body in bodies.items():
            if rel.startswith("D4/"):
                continue
            if kind == "a dollar amount":
                amounts = {m.group(0) for m in re.finditer(r"\$\s?\d(?:[\d,]*\d)?(?:\.\d+)?", body)}
                assert amounts <= {"$0.50", "$13"}, (rel, sorted(amounts))
            else:
                assert PRICE_PATTERNS[kind].findall(body) == [], (rel, kind)

    def test_d3_and_d5_quote_only_the_figures_the_sources_account_for(self, bodies):
        allowed_d3 = {"10%", "$0.50", "$13", "5%", "2.50x"}
        for rel, body in bodies.items():
            if rel.startswith("D3/"):
                stray = figures_in(body) - allowed_d3
                assert stray == set(), (rel, sorted(stray))
            if rel.startswith("D5/"):
                assert figures_in(body) == set(), (rel, sorted(figures_in(body)))

    def test_the_corpus_names_no_level_of_any_cycle_only_the_lines(self, bodies):
        joined = "\n".join(b for rel, b in bodies.items() if rel.startswith("D3/"))
        for line in ("UOEDT", "LOEDT", "baseline", "P_ref", "sr_1 to sr_16"):
            assert line in joined, line


# ---------------------------------------------------------------------------
# sources, review, approvals
# ---------------------------------------------------------------------------


class TestSources:
    def test_every_new_chunk_has_sources_that_exist(self, chunks):
        sources = json.loads((CORPUS / SOURCE_MAP_FILE).read_text(encoding="utf-8"))["sources"]
        for c in chunks:
            assert c.id in sources, c.id
            for entry in sources[c.id]:
                assert (REPO_ROOT / entry["file"]).is_file(), f"{c.id}: {entry['file']}"
                assert entry["section"].strip()

    def test_a_chunk_that_quotes_a_worked_example_cites_its_files(self, chunks):
        sources = json.loads((CORPUS / SOURCE_MAP_FILE).read_text(encoding="utf-8"))["sources"]
        for c in of_domain(chunks, "D4"):
            files = {e["file"] for e in sources[c.id]}
            if "$90.24" in c.text:
                assert any("01-doc-6-7-table" in f for f in files), c.id
            if "$3,008.00" in c.text:
                assert any("05-500-dollar-account" in f for f in files), c.id
            if "$75.00" in c.text:
                assert any("07-cautionary-half-risk" in f for f in files), c.id

    def test_d3_chunks_cite_the_rules_file_or_the_synthesis_documents(self, chunks):
        sources = json.loads((CORPUS / SOURCE_MAP_FILE).read_text(encoding="utf-8"))["sources"]
        for c in of_domain(chunks, "D3"):
            files = {e["file"] for e in sources[c.id]}
            assert any(
                f.endswith(("draft-1.yaml", "synthesis.md", "zone_params.yaml", "STACK-D-ARCHITECTURE.md")) or "/adr/" in f for f in files
            ), c.id


class TestReviewAndApprovals:
    def test_the_five_part_7_areas_are_signed_by_davin_on_2026_10_13(self):
        approvals, problems = load_approvals(CORPUS)
        assert problems == []
        for area in sorted(PART7_AREAS):
            approval = approvals[area]
            assert (approval.status, approval.approved_by, approval.approved_at) == (APPROVED, "Davin", "2026-10-13"), area

    def test_d3_d4_and_d5_have_their_own_approval_each(self, all_chunks):
        approvals, problems = load_approvals(CORPUS)
        assert problems == []
        assert set(area_files(all_chunks)) == PART7_AREAS | set(PART8)
        for area in PART8:
            assert area in approvals
            assert approvals[area].status in (PENDING, APPROVED)
            if approvals[area].status == APPROVED:
                assert approvals[area].approved_by and approvals[area].approved_at, area

    def test_every_approval_matches_the_files_it_covers(self, all_chunks):
        approvals, _ = load_approvals(CORPUS)
        current = area_hashes(all_chunks, CORPUS)
        for area, approval in approvals.items():
            assert approval.content_sha256 == current[area], f"{area}: the files changed after the approval was recorded"

    def test_each_area_has_a_review_table_that_lists_every_chunk(self, chunks, all_chunks):
        for area in PART8:
            table = (CORPUS / REVIEW_DIR / f"_{area}.md").read_text(encoding="utf-8")
            for chunk in of_domain(chunks, area):
                assert f"| `{chunk.id}` | {chunk.heading} | {chunk.tokens} | {chunk.chars} |" in table
            assert "PENDING" not in table and "APPROVED" not in table, "a table holds content only, never a status"

    def test_the_review_tables_and_approvals_are_current(self, tags: Tags, index_config, counter):
        result = run_review(CORPUS, tags=tags, config=index_config, count=counter.count, window=counter.window, write=False)
        assert result.problems == [], [str(p) for p in result.problems]

    def test_the_review_command_agrees(self, capsys, model_dir: Path):
        code = main(["review", "--corpus", str(CORPUS), "--check", "--model-dir", str(model_dir)])
        out = capsys.readouterr()
        assert code == 0, out.err
        report = json.loads(out.out)
        assert report["written"] == [] and set(report["areas"]) == PART7_AREAS | set(PART8)


def copy_with(tmp_path: Path, tags: Tags, index_config, counter, statuses: dict[str, str]) -> Path:
    """A copy of the corpus whose approval files carry the hashes of the files as they are and the given status per area."""
    target = tmp_path / "corpus"
    shutil.copytree(CORPUS, target)
    made, problems = read_corpus(target, tags, index_config, counter.count)
    assert problems == []
    for area, digest in area_hashes(made, target).items():
        status = statuses.get(area, APPROVED)
        data = {
            "schema": "corpus-approval/1", "area": area, "status": status, "content_sha256": digest,
            "approved_by": "Davin" if status == APPROVED else None, "approved_at": "2026-10-14" if status == APPROVED else None,
        }
        (target / APPROVAL_DIR / f"{area}.json").write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return target


class TestTheGateWithEightAreas:
    def run(self, capsys, *argv: str):
        code = main(list(argv))
        out = capsys.readouterr()
        return code, (json.loads(out.out) if out.out.strip() else None), out.err

    def test_the_image_build_refuses_while_d3_d4_and_d5_are_pending(self, capsys, tmp_path, tags, index_config, counter, model_dir):
        corpus = copy_with(tmp_path, tags, index_config, counter, {a: PENDING for a in PART8})
        code, report, err = self.run(
            capsys, "build", "--corpus", str(corpus), "--output", str(tmp_path / "index"), "--require-real", "--require-approved",
            "--model-dir", str(model_dir),
        )
        assert code == 1 and report is None
        assert err.count("APPROVAL_PENDING") == 3
        for area in PART8:
            assert f"{area}.json" in err
        assert "D1.json" not in err and "D2-MCD" not in err
        assert not (tmp_path / "index").exists()

    def test_a_word_changed_in_d4_after_its_approval_refuses_d4_only(self, capsys, tmp_path, tags, index_config, counter, model_dir):
        corpus = copy_with(tmp_path, tags, index_config, counter, {})
        path = corpus / "D4" / "position-sizing.md"
        text = path.read_bytes().decode("utf-8")
        assert "Gold is quoted in dollars per troy ounce" in text.replace("\r\n", "\n")
        path.write_bytes(text.replace("Gold is quoted in dollars per troy ounce", "Gold is quoted in US dollars per troy ounce", 1).encode("utf-8"))
        code, _, err = self.run(
            capsys, "build", "--corpus", str(corpus), "--output", str(tmp_path / "index"), "--require-real", "--require-approved",
            "--model-dir", str(model_dir),
        )
        assert code == 1 and err.count("APPROVAL_STALE") == 1 and "D4.json" in err and "APPROVAL_PENDING" not in err

    def test_the_image_build_succeeds_when_all_eight_areas_are_approved(self, capsys, tmp_path, tags, index_config, counter, model_dir, real_corpus_build):
        corpus = copy_with(tmp_path, tags, index_config, counter, {})
        out = tmp_path / "index"
        code, report, err = self.run(
            capsys, "build", "--corpus", str(corpus), "--output", str(out), "--require-real", "--require-approved", "--model-dir", str(model_dir)
        )
        assert code == 0 and "Traceback" not in err
        assert set(report["approvals"]) == PART7_AREAS | set(PART8) and set(report["approvals"].values()) == {APPROVED}
        assert report["warnings"] == [] and report["chunks"] == real_corpus_build.chunk_count
        assert report["index_build_id"] == real_corpus_build.index_build_id, "a signature changes nothing about what the index answers"
        code, checked, err = self.run(capsys, "check", "--index", str(out), "--require-approved", "--model-dir", str(model_dir))
        assert code == 0 and checked["index_build_id"] == report["index_build_id"], err

    def test_the_development_index_is_refused_by_the_production_check_until_every_area_is_signed(self, capsys, real_corpus_build, model_dir):
        states = {entry["status"] for entry in real_corpus_build.approvals.values()}
        code, report, err = self.run(capsys, "check", "--index", str(real_corpus_build.output_dir), "--require-approved", "--model-dir", str(model_dir))
        if states == {APPROVED}:
            assert code == 0, err
        else:
            assert code == 1 and report is None and ("APPROVAL_PENDING" in err or "APPROVAL_STALE" in err)


# ---------------------------------------------------------------------------
# the index finds what it holds
# ---------------------------------------------------------------------------

# (intent, question, the id prefix of the chunk expected in the first four)
SMOKE = [
    # D3, synthesis
    ("DIRECTION", "Why does the system say stand aside?", "d3-synthesis-rules.stand-aside-neutral"),
    ("DIRECTION", "What is the difference between stand aside and neutral?", "d3-synthesis-rules.stand-aside-neutral"),
    ("DIRECTION", "What does R0_DATA_CHECK do?", "d3-synthesis-rules.row-0"),
    ("DIRECTION", "What is archetype C?", "d3-archetypes.archetype-c"),
    ("DIRECTION", "What does Counter-trend rally, LONG mean?", "d3-archetypes.archetype-c"),
    ("DIRECTION", "What is a range edge?", "d3-archetypes.archetype-d"),
    ("DIRECTION", "What is the exhaustion and snapback rule?", "d3-archetypes.archetype-b"),
    ("DIRECTION", "Which rule is row 3s of the rules table?", "d3-archetypes.archetype-a-for-a-scalper"),
    ("DIRECTION", "What does the trend relation mean?", "d3-archetypes.trend-relation"),
    ("DIRECTION", "How does MCD3 modify the result?", "d3-sensor-conflicts.mcd3-modifies"),
    ("DIRECTION", "What happens when MCD1 and MCD2 disagree?", "d3-sensor-conflicts.when-the-m15"),
    ("DIRECTION", "What is an unresolved conflict?", "d3-sensor-conflicts.unresolved"),
    # D3, zones
    ("ENTRY_TIMING", "What is an entry zone?", "d3-zones-and-runway.what-an-entry-zone-is"),
    ("ENTRY_TIMING", "How is the entry zone built?", "d3-zones-and-runway"),
    ("ENTRY_TIMING", "How wide is an entry zone?", "d3-zones-and-runway.how-a-zone-is-drawn"),
    ("ENTRY_TIMING", "What is confluence?", "d3-zones-and-runway.how-a-zone-is-drawn"),
    ("ENTRY_TIMING", "Where does the invalidation price sit?", "d3-zones-and-runway.structural-invalidation"),
    ("ENTRY_TIMING", "What is runway?", "d3-zones-and-runway.runway"),
    ("ENTRY_TIMING", "How are the entry zones ranked?", "d3-zones-and-runway.how-zones-are-ranked"),
    ("ENTRY_TIMING", "Which levels are zone sources?", "d3-zones-and-runway.where-the-zone-levels"),
    ("ENTRY_TIMING", "Why is there no entry zone?", "d3-zones-and-runway.where-the-zone-levels"),
    ("INSTANT_M5_INSPECT", "Which rule decided the current reading?", "d3-"),
    ("INSTANT_M5_INSPECT", "How are the entry zones built from the M5 channel?", "d3-zones-and-runway"),
    ("INSTANT_M15_INSPECT", "Why is the reading a stand aside?", "d3-"),
    # D4, risk
    ("EXIT_TARGETS", "How is the lot size calculated?", "d4-position-sizing.the-lot-size"),
    ("EXIT_TARGETS", "How are the targets calculated?", "d4-position-sizing.targets"),
    ("EXIT_TARGETS", "What are the three scenarios?", "d4-position-sizing.targets"),
    ("EXIT_TARGETS", "Where is the stop placed?", "d4-structural-stops.stops-sit"),
    ("EXIT_TARGETS", "What stop distance options are there?", "d4-structural-stops"),
    ("EXIT_TARGETS", "What is the next opposing level?", "d4-structural-stops.room"),
    ("EXIT_TARGETS", "Why does the target stop before the next level?", "d4-structural-stops.room"),
    ("RISK_SIZING", "What is a standard lot of gold in ounces?", "d4-position-sizing.the-gold-contract"),
    ("RISK_SIZING", "How much is a one dollar move worth on one lot?", "d4-position-sizing.the-gold-contract"),
    ("RISK_SIZING", "What is declared risk and actual risk?", "d4-position-sizing.rounding"),
    ("RISK_SIZING", "How is leverage calculated?", "d4-position-sizing.exposure"),
    ("RISK_SIZING", "What if the lot is below the broker minimum?", "d4-profile-and-underflow.when-the-lot"),
    ("RISK_SIZING", "Why is the risk halved?", "d4-caution-sizing.half-the-risk"),
    ("RISK_SIZING", "What happens to my risk when the sensors are cautious?", "d4-caution-sizing"),
    ("RISK_SIZING", "Can I raise my risk above the pre-set?", "d4-caution-sizing.the-trader-keeps"),
    ("RISK_SIZING", "What are the eight profile metrics?", "d4-profile-and-underflow.the-eight"),
    ("RISK_SIZING", "What does the badge mean?", "d4-profile-and-underflow.the-badge"),
    ("RISK_SIZING", "What is the minimum stop distance?", "d4-structural-stops.the-minimum"),
    ("RISK_SIZING", "What does the validator check?", "d4-profile-and-underflow.what-the-validator"),
    # D5, governance
    ("NEWS", "How long is the news blackout?", "d5-news-blackouts.tier-1"),
    ("NEWS", "What if the release time is approximate?", "d5-news-blackouts.when-the-release"),
    ("NEWS", "Which news does the warning cover for a Scalper?", "d5-news-blackouts.releases-inside"),
    ("NEWS", "Why is the trade setup withheld near CPI?", "d5-news-blackouts.why-entry"),
    ("NEWS", "What if the calendar is late?", "d5-news-blackouts.when-the-calendar"),
    ("DIRECTION", "Does the assistant place orders?", "d5-decision-support-role.decision-support"),
    ("DIRECTION", "Why is there no direction when data is stale?", "d5-decision-support-role.data-status"),
    ("DIRECTION", "Can the model change the direction?", "d5-decision-support-role.stand-aside"),
    ("DIRECTION", "Is the direction chosen by the language model?", "d5-system-invariants.rules-decide"),
    ("DIRECTION", "Does the system fail closed when data is missing?", "d5-system-invariants.fail-closed"),
    ("RISK_SIZING", "Who owns the trade decision and the risk?", "d5-decision-support-role.the-trader-owns"),
    ("DIRECTION", "What does NO_MATCH mean?", "d3-synthesis-rules.when-no-rule-matches"),
    ("DIRECTION", "Why is the reading CAUTIONARY?", "d3-synthesis-rules.why-a-reading-is-cautionary"),
    ("DIRECTION", "Does the direction use only closed bars?", "d5-system-invariants.closed-bars"),
    ("DIRECTION", "Does the assistant cover other symbols or timeframes?", "d5-single-order-scope.gold-on"),
    ("DIRECTION", "Who decides whether to place the trade?", "d5-decision-support-role.the-trader-owns"),
    ("DIRECTION", "Is the assistant a trading adviser?", "d5-decision-support-role.decision-support"),
    ("RISK_SIZING", "Does the assistant place trades for me?", "d5-decision-support-role"),
    ("RISK_SIZING", "Which symbol and timeframes can a setup be made for?", "d5-single-order-scope.gold-on"),
    ("RISK_SIZING", "Does the assistant manage several orders at once?", "d5-single-order-scope"),
    ("RISK_SIZING", "Can I use a martingale or add to a position?", "d5-single-order-scope.what-the-system-does-not"),
]

# Natural questions that the first four still miss (measured in part 8, see the hand-off). They are kept here as an executable
# ledger for part 9's labelled evaluation: xfail, not strict, so a retrieval change that fixes one shows as XPASS and never as a failure.
# With the five-to-eight-word intent templates of part 6 eleven questions missed and so did sixteen state-code searches of part 7;
# the one-word templates of part 8 fixed eight of the eleven.
GAPS = [
    ("DIRECTION", "In which order does the synthesis check the rules?", "d3-synthesis-rules.ordered-rules"),
    ("DIRECTION", "What does the R3S rule mean?", "d3-archetypes.archetype-a-for-a-scalper"),
    ("RISK_SIZING", "What is recorded for each answer?", "d5-system-invariants.what-the-trace-records"),
]


def top_ids(retriever: Retriever, matrix: Matrix, intent: str, question: str) -> list[str]:
    request = SearchRequest(intent, question, MCDS, (), matrix.version)
    return [c["id"] for c in retriever.search(request).chunks]


def owner_of(chunks: list[Chunk], prefix: str) -> list[str]:
    return [c.id for c in chunks if c.id.startswith(prefix)]


class TestSmokeRetrieval:
    """A search for a question about D3, D4 or D5 returns the expected chunk in the first four (not yet the labelled set)."""

    def test_the_table_covers_every_file_and_every_intent_that_reads_these_domains(self, matrix: Matrix):
        prefixes = " ".join(p for _, _, p in SMOKE)
        for doc_id in FILES:
            assert doc_id in prefixes, f"no smoke question for {doc_id}"
        readers = {i for i, rule in matrix.intents.items() if set(PART8) & set(rule.domains)}
        assert {i for i, _, _ in SMOKE} >= readers
        assert readers == {"DIRECTION", "ENTRY_TIMING", "EXIT_TARGETS", "RISK_SIZING", "NEWS", "INSTANT_M5_INSPECT", "INSTANT_M15_INSPECT"}

    @pytest.mark.parametrize("intent, question, prefix", SMOKE)
    def test_the_question_finds_its_chunk_in_the_top_four(self, retriever: Retriever, matrix: Matrix, all_chunks, intent: str, question: str, prefix: str):
        expected = owner_of(all_chunks, prefix)
        assert expected, f"{prefix} is not the start of any chunk id"
        top = top_ids(retriever, matrix, intent, question)
        assert 1 <= len(top) <= 4
        assert set(top) & set(expected), f"{intent}: {question!r} returned {top}"

    @pytest.mark.parametrize("intent, question, prefix", GAPS)
    @pytest.mark.xfail(strict=False, reason="a known gap of the retrieval (part 8 hand-off); part 9 evaluates it")
    def test_known_gaps_of_the_retrieval(self, retriever: Retriever, matrix: Matrix, all_chunks, intent: str, question: str, prefix: str):
        expected = owner_of(all_chunks, prefix)
        assert expected, prefix
        assert set(top_ids(retriever, matrix, intent, question)) & set(expected)

    @pytest.mark.parametrize("intent, question, prefix", SMOKE[::4])
    def test_what_comes_back_is_in_the_domains_of_the_intent(self, retriever: Retriever, matrix: Matrix, intent: str, question: str, prefix: str):
        rule = matrix.intents[intent]
        allowed = set(rule.domains) | ({"D2"} if rule.playbooks == PLAYBOOKS_M_STAR else set())
        request = SearchRequest(intent, question, MCDS, (), matrix.version)
        result = retriever.search(request)
        for chunk in result.chunks + result.expansions:
            assert chunk["domain"] in allowed, (intent, chunk["id"])

    def test_an_intent_template_is_a_hint_and_not_a_query(self, index_config: IndexConfig):
        """Part 8 measured it: templates of five to eight words picked the chunks instead of the question (16 of 320 state-code searches
        missed, 10 of 32 codes found alone). Lengthen one only with a labelled set that shows it helps (part 9)."""
        assert all(len(text.split()) <= 2 for text in index_config.intent_templates.values()), dict(index_config.intent_templates)

    def test_explain_reads_d1_only_so_d3_to_d5_are_out_of_its_reach(self, retriever: Retriever, matrix: Matrix):
        """Routing v1: an Explain question never gets D3, D4 or D5 (the same limit as part 7's reading 2 for the playbooks)."""
        assert matrix.intents["EXPLAIN"].domains == ("D1",)
        for question in ("What is the half-risk rule?", "How long is the news blackout?", "What is runway?"):
            result = retriever.search(SearchRequest("EXPLAIN", question, MCDS, (), matrix.version))
            assert all(c["domain"] == "D1" for c in result.chunks + result.expansions), question

    def test_every_chunk_is_found_by_its_own_heading_under_some_intent_that_reads_its_domain(self, retriever: Retriever, matrix: Matrix, chunks):
        lost = []
        for c in chunks:
            intents = [i for i, rule in matrix.intents.items() if c.domain in rule.domains]
            assert intents, c.domain
            if not any(c.id in top_ids(retriever, matrix, intent, c.heading or "") for intent in intents):
                lost.append(c.id)
        assert lost == [], f"{len(lost)} chunks cannot be found by their own heading: {lost}"

    def test_related_chunks_come_as_expansions_when_the_scope_allows(self, retriever: Retriever, matrix: Matrix, counter: TokenCounter):
        result = retriever.search(SearchRequest("ENTRY_TIMING", "What is runway?", MCDS, (), matrix.version))
        assert result.expansions, "a D3 chunk carries related chunks"
        assert all(e["domain"] == "D3" for e in result.expansions), "ENTRY_TIMING reads D3 only"
        assert sum(counter.count(c["text"]) for c in result.chunks + result.expansions) <= 2000


# ---------------------------------------------------------------------------
# the candidate window (part 6 reading 9, D11 (c))
# ---------------------------------------------------------------------------


def unfiltered_rank(retriever: Retriever, matrix: Matrix, tags: Tags, config: IndexConfig, request: SearchRequest, expected_ids: set[str]) -> int:
    """The best 1-based rank of any expected chunk in the WHOLE corpus, before the SQL scope filters anything."""
    plan = plan_search(request, matrix=matrix, tags=tags, config=config)
    size = len(retriever.loaded.chunks)
    rows = retriever.loaded.embeddings.search(
        f"SELECT id, score FROM txtai WHERE similar(:q, {size}) LIMIT {size}",
        limit=size,
        weights=config.weights,
        parameters={"q": plan.query_text},
    )
    ids = [r["id"] for r in rows]
    ranks = [ids.index(e) + 1 for e in expected_ids if e in ids]
    assert ranks, f"{expected_ids} not in the ranking at all"
    return min(ranks)


class TestTheCandidateWindow:
    """txtai takes the best `candidates` of the WHOLE corpus and the SQL filters afterwards, so what matters is the rank an
    expected chunk has before any filter. Part 7 measured it on 69 chunks (worst 9). With D3 to D5 the corpus has doubled."""

    @pytest.fixture(scope="class")
    def measured(self, retriever: Retriever, matrix: Matrix, tags: Tags, index_config: IndexConfig, all_chunks):
        ranks: dict[str, list[int]] = {"D2 state codes": [], "D1 foundations": [], "D3 D4 D5 smoke": []}
        by_code = {}
        for c in all_chunks:
            for code in re.findall(r"\*\*State code:\*\* `([A-Z0-9_]+)`", c.text):
                by_code[code] = c.id
        playbook_intents = sorted(i for i, rule in matrix.intents.items() if rule.playbooks == PLAYBOOKS_M_STAR)
        forms = (lambda code: code, lambda code: f"What does {code} mean?")
        for code, chunk_id in sorted(by_code.items()):
            for intent in playbook_intents:
                for form in forms:
                    request = SearchRequest(intent, form(code), (tags.mcd_of(code),), (code,), matrix.version)
                    ranks["D2 state codes"].append(unfiltered_rank(retriever, matrix, tags, index_config, request, {chunk_id}))
        d1 = {
            "What is UOEDT?": "terms-the-sensors-use", "What is SSA?": "terms-the-sensors-use", "What is a channel?": "what-a-channel-is",
            "What is the trend band?": "the-slope-and-the-five-degree-trend-band", "What does closed bar mean?": "what-a-closed-bar-is",
            "What is P_ref?": "the-reference-price-p-ref", "What does DELAYED mean?": "data-statuses-of-a-cycle",
            "What does CAUTIONARY mean?": "what-makes-a-reading-cautionary", "What is MCD0?": "mcd0-the-fit-gate",
            "What is a sustained break?": "inside-outside-and-a-sustained-break",
        }
        for question, slug in d1.items():
            expected = {c.id for c in all_chunks if c.id.endswith("." + slug)}
            request = SearchRequest("EXPLAIN", question, MCDS, (), matrix.version)
            ranks["D1 foundations"].append(unfiltered_rank(retriever, matrix, tags, index_config, request, expected))
        for intent, question, prefix in SMOKE:
            expected = set(owner_of(all_chunks, prefix))
            request = SearchRequest(intent, question, MCDS, (), matrix.version)
            ranks["D3 D4 D5 smoke"].append(unfiltered_rank(retriever, matrix, tags, index_config, request, expected))
        return ranks

    def test_the_expected_chunks_rank_well_inside_the_window(self, measured, index_config: IndexConfig, all_chunks, capsys):
        window = index_config.candidates
        lines = [f"corpus {len(all_chunks)} chunks, window {window}"]
        worst = 0
        for name, ranks in measured.items():
            worst = max(worst, max(ranks))
            lines.append(
                f"{name}: {len(ranks)} searches, worst rank {max(ranks)}, median {statistics.median(ranks)}, "
                f"within 10: {sum(r <= 10 for r in ranks)}, within {window}: {sum(r <= window for r in ranks)}"
            )
        with capsys.disabled():
            print("\n[candidate window] " + " | ".join(lines))
        assert worst <= window, f"an expected chunk ranks {worst} before the filter, outside the window of {window}: raise `candidates`"
        assert worst <= 0.75 * window, f"the worst rank {worst} approaches the window of {window}: raise `candidates` (D11 (c))"

    def test_the_window_is_not_larger_than_the_corpus_needs(self, index_config: IndexConfig, all_chunks):
        assert index_config.candidates <= len(all_chunks), "a window larger than the corpus filters nothing"
