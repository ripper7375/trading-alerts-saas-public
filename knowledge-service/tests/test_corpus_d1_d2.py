"""The real corpus, domains D1 and D2 (build step 6 part 7): coverage, size, wording, truthfulness, retrieval, the gate.

These tests read `corpus/` (never the TEST ONLY fixtures) on the real tokenizer and the real txtai index. Part 8 added
D3 to D5 to the same folder (their tests are in `test_corpus_d3_d4_d5.py`); every check here is "for each area / each domain".

What is NOT tested here, on purpose: whether the prose is right. That is Davin's approval (ADR-042). What is tested is
everything a machine can show about it: that every state has its section, that the figures it quotes are the specs',
that no chunk is out of its bounds, that no forbidden phrase and no live number is in it, and that the index finds it.
"""

from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

import pytest
import yaml

from helpers import REPO_ROOT, SERVICE_ROOT
from knowledge.approval import APPROVAL_DIR, APPROVED, PENDING, REVIEW_DIR, area_files, area_hashes, area_of, load_approvals
from knowledge.build import build_index, check_chunks, corpus_files, read_corpus
from knowledge.chunker import Chunk
from knowledge.config import PLAYBOOKS_M_STAR, IndexConfig, Matrix
from knowledge.frontmatter import parse_document
from knowledge.gate import main
from knowledge.index import LoadedIndex, load_index
from knowledge.model import TokenCounter
from knowledge.review import SOURCE_MAP_FILE, declared_state_codes, run_review
from knowledge.search import Retriever, SearchRequest
from knowledge.tags import Tags
from knowledge.wording import scan

CORPUS = SERVICE_ROOT / "corpus"
ENGINE = REPO_ROOT / "davintrade-stack-d-and-e" / "engine-1-5-new"

D1_IDS = {"d1-channels-and-corridors", "d1-closed-bar-rule", "d1-data-statuses", "d1-mcd-architecture"}
# the id, the timeframe tag and the number of state codes the order names for each playbook
D2_PLAYBOOKS = {
    "MCD0": ("d2-mcd0-playbook", None, 4),
    "MCD1": ("d2-mcd1-playbook", "M15", 9),
    "MCD2": ("d2-mcd2-playbook", "M5", 9),
    "MCD3": ("d2-mcd3-playbook", None, 10),
}
AREAS = {"D1", "D2-MCD0", "D2-MCD1", "D2-MCD2", "D2-MCD3"}
MIN_TOKENS, MAX_TOKENS, MAX_CHARS = 200, 450, 4000
SECTION_LABELS = ("**What it says.**", "**What it does not say.**", "**With the other sensors.**", "**What to watch next.**")


# ---------------------------------------------------------------------------
# fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def documents(tags: Tags):
    """document id -> Document, for every corpus file; the build's own parser, so a bad file fails here with its problems."""
    found = {}
    for path in corpus_files(CORPUS):
        rel = path.relative_to(CORPUS).as_posix()
        document, problems = parse_document(path.read_bytes().decode("utf-8"), rel, tags)
        assert problems == [], f"{rel}: {problems}"
        found[document.front_matter.id] = document
    return found


@pytest.fixture(scope="module")
def texts():
    """relative path -> the file's text with LF endings (the form the build reads)."""
    return {
        p.relative_to(CORPUS).as_posix(): p.read_bytes().decode("utf-8").replace("\r\n", "\n") for p in corpus_files(CORPUS)
    }


@pytest.fixture(scope="module")
def foundation_texts(texts):
    """The files of D1 and D2 only: the content rules below (no figures from a cycle, no probability word, plain ASCII) are theirs."""
    return {rel: text for rel, text in texts.items() if rel.startswith(("D1/", "D2/"))}


@pytest.fixture(scope="module")
def chunks(tags: Tags, index_config: IndexConfig, counter: TokenCounter) -> list[Chunk]:
    made, problems = read_corpus(CORPUS, tags, index_config, counter.count)
    assert problems == [], problems
    return made


@pytest.fixture(scope="module")
def real_build(real_corpus_build):
    """The real corpus built the way the Dockerfile builds it, minus the approval gate (a development build); one per session."""
    return real_corpus_build


@pytest.fixture(scope="module")
def retriever(real_corpus_retriever) -> Retriever:
    return real_corpus_retriever


def state_chunk(chunks: list[Chunk], code: str) -> Chunk:
    owners = [c for c in chunks if code in declared_state_codes(c.text)]
    assert len(owners) == 1, f"{code} is declared by {len(owners)} chunks"
    return owners[0]


def registry(mcd: str) -> dict:
    path = ENGINE / mcd.lower() / f"{mcd.lower()}_registry.yaml"
    if not path.is_file():
        pytest.skip(f"{path} is not beside the service")
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def params(mcd: str) -> dict[str, float]:
    path = ENGINE / mcd.lower() / f"{mcd.lower()}_params.yaml"
    if not path.is_file():
        pytest.skip(f"{path} is not beside the service")
    return {k: v["value"] for k, v in yaml.safe_load(path.read_text(encoding="utf-8"))["parameters"].items()}


# ---------------------------------------------------------------------------
# what is in the folder
# ---------------------------------------------------------------------------


class TestWhatIsInTheFolder:
    def test_d1_has_its_four_documents_and_d2_one_playbook_per_sensor(self, documents):
        assert D1_IDS <= set(documents)
        assert {i for i, _, _ in D2_PLAYBOOKS.values()} <= set(documents)

    def test_a_d1_document_is_tagged_as_the_order_says(self, documents):
        for doc_id in D1_IDS:
            fm = documents[doc_id].front_matter
            assert (fm.domain, fm.mcd_id, fm.state_codes, fm.timeframe, fm.version) == ("D1", None, (), None, "1.0.0"), doc_id
            assert len(fm.related) >= 1, f"{doc_id} points to nothing"

    @pytest.mark.parametrize("mcd", sorted(D2_PLAYBOOKS))
    def test_a_playbook_is_tagged_as_the_order_says(self, documents, tags: Tags, mcd: str):
        doc_id, timeframe, count = D2_PLAYBOOKS[mcd]
        fm = documents[doc_id].front_matter
        assert (fm.domain, fm.mcd_id, fm.timeframe, fm.version) == ("D2", mcd, timeframe, "1.0.0")
        assert len(fm.state_codes) == count
        assert list(fm.state_codes) == list(tags.state_codes[mcd]), "all of its sensor's state codes, in the registry's order"

    def test_the_files_sit_where_the_order_puts_them(self, documents):
        paths = {i: d.path for i, d in documents.items()}
        for doc_id in D1_IDS:
            assert paths[doc_id].startswith("D1/") and paths[doc_id].endswith(".md")
        for mcd, (doc_id, _, _) in D2_PLAYBOOKS.items():
            assert paths[doc_id] == f"D2/{mcd.lower()}.md"

    def test_related_names_chunks_that_exist_and_playbooks_point_at_foundations(self, documents, chunks):
        ids = {c.id for c in chunks}
        for doc_id, document in documents.items():
            for ref in document.front_matter.related:
                assert ref in ids, f"{doc_id} relates to {ref}, which is not a chunk"
        for mcd, (doc_id, _, _) in D2_PLAYBOOKS.items():
            assert all(r.startswith("d1-") for r in documents[doc_id].front_matter.related), mcd

    def test_every_chunk_id_is_the_file_id_and_a_slug_of_its_heading(self, chunks):
        for c in chunks:
            assert re.fullmatch(re.escape(c.doc_id) + r"\.[a-z0-9]+(?:-[a-z0-9]+)*(?:-\d+)?", c.id), c.id
            assert len(c.id) <= 80

    def test_the_folder_has_its_domains_its_review_files_and_its_source_map(self):
        names = {p.relative_to(CORPUS).parts[0] for p in CORPUS.iterdir()}
        assert names >= {"D1", "D2", "approval", "review", "source-map.json", "README.md"}


# ---------------------------------------------------------------------------
# coverage: every state code of every registry
# ---------------------------------------------------------------------------


class TestEveryStateCodeHasItsSection:
    def test_the_registry_has_the_32_codes_of_the_order(self, tags: Tags):
        assert {m: len(c) for m, c in tags.state_codes.items()} == {"MCD0": 4, "MCD1": 9, "MCD2": 9, "MCD3": 10}
        assert len(tags.all_state_codes) == 32

    def test_every_one_of_the_32_codes_is_declared_by_exactly_one_chunk_of_its_own_sensor(self, tags: Tags, chunks):
        for code in sorted(tags.all_state_codes):
            owner = state_chunk(chunks, code)
            assert owner.domain == "D2" and owner.mcd_id == tags.mcd_of(code), code
            assert code in owner.state_codes, f"{code} is declared in the text but not tagged in the front matter"

    def test_no_chunk_declares_a_code_that_is_not_in_the_registries(self, tags: Tags, chunks):
        for c in chunks:
            assert set(declared_state_codes(c.text)) <= tags.all_state_codes, c.id

    def test_a_state_section_declares_one_code_and_nothing_else_is_a_state_section(self, chunks):
        for c in chunks:
            declared = declared_state_codes(c.text)
            assert len(declared) <= 1, c.id
            if c.domain == "D1":
                assert declared == (), c.id

    def test_each_state_has_a_section_of_its_own_with_the_code_right_under_the_heading(self, tags: Tags, chunks):
        for code in sorted(tags.all_state_codes):
            owner = state_chunk(chunks, code)
            assert f"## {owner.heading}\n\n**State code:** `{code}`." in owner.text, code

    def test_a_state_section_covers_the_four_things_the_order_names_in_order(self, tags: Tags, chunks):
        for code in sorted(tags.all_state_codes):
            text = state_chunk(chunks, code).text
            positions = [text.find(label) for label in SECTION_LABELS]
            assert all(p >= 0 for p in positions), f"{code} lacks one of {SECTION_LABELS}"
            assert positions == sorted(positions), f"{code}: the four parts are out of order"

    def test_a_state_section_names_its_own_sensor_and_no_other_sensors_code(self, tags: Tags, chunks):
        for code in sorted(tags.all_state_codes):
            text = state_chunk(chunks, code).text
            others = {c for c in tags.all_state_codes if c != code and re.search(rf"\b{c}\b", text)}
            assert others == set(), f"{code} names {sorted(others)}"

    def test_the_headings_of_one_playbook_are_all_different(self, chunks):
        for doc_id in {c.doc_id for c in chunks}:
            headings = [c.heading for c in chunks if c.doc_id == doc_id]
            assert len(headings) == len(set(headings)), doc_id


class TestTheStatesSaySWhatTheRegistriesSay:
    """The prose is not checked, but the facts it states about each state are: bias and regime word, from the registries."""

    @pytest.mark.parametrize("mcd", sorted(D2_PLAYBOOKS))
    def test_bias_and_regime_word_are_the_registrys(self, chunks, mcd: str):
        entry = registry(mcd)
        assert entry["mcd_id"] == mcd
        for state in entry["states"]:
            text = state_chunk(chunks, state["code"]).text
            assert f"The sensor's own bias is {state['bias']}." in text, state["code"]
            if state["regime_status"] is None:
                assert "No regime word." in text, state["code"]
            else:
                assert f"Regime word {state['regime_status']}." in text, state["code"]
                assert "No regime word" not in text, state["code"]

    @pytest.mark.parametrize("mcd", sorted(D2_PLAYBOOKS))
    def test_the_registry_and_the_whitelist_list_the_same_codes(self, tags: Tags, mcd: str):
        assert [s["code"] for s in registry(mcd)["states"]] == list(tags.state_codes[mcd])

    def test_the_bias_words_in_the_corpus_are_the_four_the_envelope_allows(self, texts):
        for rel, text in texts.items():
            for word in re.findall(r"bias is ([A-Z_]+)", text):
                assert word in {"LONG", "SHORT", "NEUTRAL", "STAND_ASIDE"}, (rel, word)


class TestFiguresAreTheSpecs:
    """A number the corpus quotes from a parameter file is the number in that file (never typed twice, only checked twice)."""

    @staticmethod
    def f2(v: float) -> str:
        return f"{v:.2f}"

    def check(self, texts, rel: str, needle: str) -> None:
        assert needle in texts[rel], f"{rel} should say {needle!r}"

    def test_mcd0(self, texts):
        p = params("MCD0")
        self.check(texts, "D2/mcd0.md", f"at least {p['min_coverage_bars']:g} closed bars")
        self.check(texts, "D2/mcd0.md", f"Model A must reach at least {self.f2(p['min_r2_model_a'])} and Model B at least {self.f2(p['min_r2_model_b'])}")
        self.check(texts, "D2/mcd0.md", f"It must lie from {self.f2(p['min_fit_ratio'])} to {self.f2(p['max_fit_ratio'])}.")
        self.check(texts, "D2/mcd0.md", f"It must lie from {self.f2(p['min_geo_ratio'])} to {self.f2(p['max_geo_ratio'])}")
        self.check(texts, "D2/mcd0.md", f"must be at most {self.f2(p['max_abs_skew'])}")
        assert p["flat_angle_deg"] == 5.0 and "within five degrees of flat" in texts["D2/mcd0.md"]
        # five hours of M5 and fifteen hours of M15 are 60 bars of each
        assert p["min_coverage_bars"] * 5 / 60 == 5 and p["min_coverage_bars"] * 15 / 60 == 15
        assert "five hours of M5 and fifteen hours of M15" in texts["D2/mcd0.md"]

    def test_mcd1(self, texts):
        p = params("MCD1")
        assert p["sideways_angle_deg"] == 5.0
        self.check(texts, "D2/mcd1.md", "plus and minus five degree band")
        self.check(texts, "D2/mcd1.md", f"larger of {p['min_micro_window_bars']:g} bars and {p['micro_window_pct']:g}% of the channel length")
        self.check(texts, "D2/mcd1.md", f"at least {p['sustained_breach_pct']:g}% of the window")
        self.check(texts, "D2/mcd1.md", f"fewer than {p['min_containment_rate']:g}% of the bars closed inside the corridor")
        # the worked threshold: 80% of a 96-bar window is 77 bars, and 76 is not enough
        need = -(-p["sustained_breach_pct"] * p["min_micro_window_bars"] // 100)
        assert need == 77 and "that is 77 bars, and 76 bars is not enough" in texts["D2/mcd1.md"]
        assert p["min_micro_window_bars"] * 15 / 60 == 24 and "one full trading day" in texts["D2/mcd1.md"]

    def test_mcd2(self, texts):
        p = params("MCD2")
        assert p["sideways_angle_deg"] == 5.0
        self.check(texts, "D2/mcd2.md", f"at least {p['min_window_bars']:g} closed bars")
        self.check(texts, "D2/mcd2.md", f"fewer than {p['min_window_bars']:g} closed M5 bars")
        assert p["max_window_bars"] * 5 / 60 == 24 and "up to 24 hours of closed M5 bars" in texts["D2/mcd2.md"]
        self.check(texts, "D2/mcd2.md", f"fewer than {p['min_containment_rate']:g}% of the bars")

    def test_mcd3(self, texts):
        p = params("MCD3")
        self.check(texts, "D2/mcd3.md", f"at least {p['nesting_min_share']:g}% of those bars")
        self.check(texts, "D2/mcd3.md", f"The lower zone is {p['lower_zone_max_position']:g} or less. The upper zone is {p['upper_zone_min_position']:g} or more.")
        self.check(texts, "D2/mcd3.md", f"fewer than {p['min_containment_rate']:g}% of its bars")
        assert p["nesting_min_share"] == 75.0 and "three quarters" in texts["D2/mcd3.md"]

    def test_the_channels_file_quotes_the_same_bands(self, texts):
        p1 = params("MCD1")
        d1 = texts["D1/channels-and-corridors.md"]
        assert f"+{p1['sideways_angle_deg']:g} degrees" in d1 and f"-{p1['sideways_angle_deg']:g} degrees" in d1
        assert f"at least {p1['sustained_breach_pct']:g}% of the bars in the micro window" in d1
        assert f"larger of {p1['min_micro_window_bars']:g} closed M15 bars and {p1['micro_window_pct']:g}% of the channel length" in d1
        assert f"containment below {p1['min_containment_rate']:g}%" in d1
        assert f"at least {p1['min_micro_window_bars']:g} bars" in d1

    def test_the_freshness_deadlines_are_the_gateways(self, texts):
        path = REPO_ROOT / "railway-gateway" / "src" / "cycle" / "thresholds.ts"
        if not path.is_file():
            pytest.skip("the gateway is not beside the service")
        found = {
            name: int(a) * int(b)
            for name, a, b in re.findall(r"(readyDeadlineSec|readyDeadlineWithRetriesSec|staleAfterSec):\s*(\d+)\s*\*\s*(\d+)", path.read_text(encoding="utf-8"))
        }
        assert found == {"readyDeadlineSec": 120, "readyDeadlineWithRetriesSec": 240, "staleAfterSec": 600}
        d1 = texts["D1/data-statuses.md"]
        words = {2: "two minutes", 4: "four minutes", 10: "ten minutes"}
        for seconds in found.values():
            assert words[seconds // 60] in d1, seconds

    def test_the_sustained_and_nesting_figures_agree_with_the_architecture(self):
        arch = (REPO_ROOT / "docs" / "STACK-D-ARCHITECTURE.md")
        if not arch.is_file():
            pytest.skip("the architecture is not beside the service")
        text = arch.read_text(encoding="utf-8")
        assert "breach on ≥ 80% of N_micro" in text and "nesting ≥ 75%" in text and "stochastic 20 / 80" in text


# ---------------------------------------------------------------------------
# chunk bounds
# ---------------------------------------------------------------------------


class TestChunkBounds:
    def test_every_chunk_is_between_200_and_450_tokens_and_under_4000_characters(self, chunks, counter: TokenCounter):
        outside = [(c.id, c.tokens) for c in chunks if not MIN_TOKENS <= c.tokens <= MAX_TOKENS]
        assert outside == []
        assert [c.id for c in chunks if c.chars >= MAX_CHARS] == []
        for c in chunks:
            assert c.tokens == counter.count(c.text), c.id

    def test_the_configured_bounds_are_the_ones_of_the_order(self, index_config: IndexConfig):
        assert (index_config.chunker.min_tokens, index_config.chunker.max_tokens, index_config.chunker.max_chars) == (200, 450, 4000)

    def test_450_tokens_fit_the_embedding_window_whole(self, chunks, counter: TokenCounter):
        assert counter.window == 512
        assert max(c.tokens for c in chunks) <= MAX_TOKENS < counter.window

    def test_the_build_finds_nothing_to_warn_about(self, chunks, index_config: IndexConfig, counter: TokenCounter):
        problems, warnings = check_chunks(chunks, index_config, counter.window)
        assert problems == [] and warnings == []

    def test_each_section_is_exactly_one_chunk_nothing_is_merged_or_split(self, texts, chunks):
        for rel, text in texts.items():
            sections = re.findall(r"^#{2,3} .+$", text, flags=re.MULTILINE)
            made = [c for c in chunks if c.path == rel]
            assert len(made) == len(sections), f"{rel}: {len(sections)} sections but {len(made)} chunks"
            assert [c.heading for c in made] == [s.lstrip("# ").strip() for s in sections], rel

    def test_a_chunk_opens_with_its_heading(self, chunks):
        for c in chunks:
            assert re.match(r"(?:# .+\n\n)?## " + re.escape(c.heading or "") + r"\n", c.text), c.id

    def test_the_index_is_built_with_nothing_to_report(self, real_build):
        assert real_build.warnings == []
        assert real_build.corpus_kind == "REAL"
        assert re.fullmatch(r"kb-[0-9a-f]{32}", real_build.index_build_id)
        assert real_build.chunk_count == sum(real_build.metadata["domains"].values())
        assert real_build.metadata["domains"]["D1"] >= 4 and real_build.metadata["domains"]["D2"] >= 32
        assert real_build.metadata["embedding_window_tokens"] == 512


# ---------------------------------------------------------------------------
# wording, numbers, stance
# ---------------------------------------------------------------------------

# Stricter than the build's backstop, for these two domains: ADR-035 (no probabilities, grades or confidence words at all).
ADR_035 = re.compile(r"\b(?:probabilit\w*|win[- ]?rates?|confiden\w+|conviction|odds|chances?|likelihood|accura\w+|grades?)\b", re.IGNORECASE)
# Sentences that open with a trading instruction (§5.9: the service describes, it does not instruct).
IMPERATIVE = re.compile(r"(?:^|(?<=[.!?]\s))(?:Buy|Sell|Enter|Exit|Go long|Go short|Open a|Place a|Take profit|Close the position)\b", re.MULTILINE)
# A price, a date, a clock time, a cycle: nothing from any one cycle belongs in a foundation or a playbook.
LIVE_NUMBER_PATTERNS = {
    "a number with a thousands separator": re.compile(r"\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b"),
    "an integer of four or more digits": re.compile(r"(?<![\w.])\d{4,}(?![\w])"),
    "an ISO date": re.compile(r"\b\d{4}-\d{2}-\d{2}\b"),
    "a clock time": re.compile(r"(?<![\w:])\d{1,2}:\d{2}(?::\d{2})?(?![\w:])"),
    "a dollar amount": re.compile(r"\$\s?\d"),
    "a month and a day": re.compile(r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2}\b"),
    "an instrument": re.compile(r"\bXAU\w*\b", re.IGNORECASE),
}


class TestWording:
    def test_the_wording_backstop_finds_nothing_in_any_chunk_or_file(self, chunks, texts):
        for c in chunks:
            assert scan(c.text) == [], (c.id, scan(c.text))
        for rel, text in texts.items():
            assert scan(text) == [], (rel, scan(text))

    def test_no_probability_grade_odds_or_confidence_word_appears_at_all(self, foundation_texts):
        for rel, text in foundation_texts.items():
            hits = [m.group(0) for m in ADR_035.finditer(text)]
            assert hits == [], (rel, hits)

    def test_no_sentence_opens_with_a_trading_instruction(self, foundation_texts):
        for rel, text in foundation_texts.items():
            assert [m.group(0) for m in IMPERATIVE.finditer(text)] == [], rel

    def test_no_second_person_instruction(self, foundation_texts):
        for rel, text in foundation_texts.items():
            assert not re.search(r"\byou (?:should|must|need to|have to)\b", text, re.IGNORECASE), rel

    def test_it_is_english_prose_in_plain_ascii(self, foundation_texts):
        for rel, text in foundation_texts.items():
            assert text.isascii(), (rel, sorted({ch for ch in text if not ch.isascii()}))

    def test_nothing_of_a_test_corpus_or_a_draft_marker_is_left(self, texts):
        for rel, text in texts.items():
            assert not re.search(r"TEST ONLY|TODO|FIXME|XXX|lorem ipsum|\bTBD\b", text, re.IGNORECASE), rel


class TestNoLiveNumbers:
    @pytest.mark.parametrize("kind", sorted(LIVE_NUMBER_PATTERNS))
    def test_no_price_date_time_or_instrument(self, foundation_texts, kind: str):
        for rel, text in foundation_texts.items():
            body = text.split("\n---\n", 2)[-1]
            assert LIVE_NUMBER_PATTERNS[kind].findall(body) == [], (rel, kind)

    def test_every_decimal_is_a_threshold_of_a_parameter_file(self, foundation_texts):
        allowed = set()
        for mcd in ("MCD0", "MCD1", "MCD2", "MCD3"):
            for value in params(mcd).values():
                if isinstance(value, float):
                    allowed.add(f"{value:.2f}")
        allowed.add("0.70")
        for rel, text in foundation_texts.items():
            found = set(re.findall(r"(?<![\w.])\d+\.\d+(?![\w.])", text.split("\n---\n", 2)[-1]))
            assert found <= allowed, (rel, sorted(found - allowed))

    def test_the_corpus_names_no_price_level_of_any_cycle_only_the_lines(self, foundation_texts):
        joined = "\n".join(foundation_texts.values())
        for line in ("UOEDT", "LOEDT", "baseline", "P_ref"):
            assert line in joined, line


class TestEnglishOnlyAndWholeFiles:
    def test_every_file_has_front_matter_then_a_title_then_sections(self, texts):
        for rel, text in texts.items():
            assert text.startswith("---\n"), rel
            body = text.split("\n---\n", 1)[1]
            assert re.match(r"\n# [^\n]+\n\n## ", body), f"{rel}: a title, then the first section"

    def test_no_line_has_trailing_white_space_or_a_tab(self, texts):
        for rel, text in texts.items():
            assert not re.search(r"[ \t]+$", text, re.MULTILINE), rel
            assert "\t" not in text, rel

    def test_a_file_ends_with_one_newline(self, texts):
        for rel, text in texts.items():
            assert text.endswith("\n") and not text.endswith("\n\n"), rel


# ---------------------------------------------------------------------------
# sources
# ---------------------------------------------------------------------------


class TestSources:
    def test_every_chunk_names_where_it_was_written_from_and_every_file_exists(self, chunks):
        path = CORPUS / SOURCE_MAP_FILE
        sources = json.loads(path.read_text(encoding="utf-8"))["sources"]
        assert set(sources) == {c.id for c in chunks}, "the map and the chunks list the same ids"
        for chunk_id, entries in sources.items():
            assert entries, chunk_id
            for entry in entries:
                assert (REPO_ROOT / entry["file"]).is_file(), f"{chunk_id}: {entry['file']} is not in the repository"
                assert entry["section"].strip()

    def test_a_state_section_cites_its_sensors_spec_and_registry(self, tags: Tags, chunks):
        sources = json.loads((CORPUS / SOURCE_MAP_FILE).read_text(encoding="utf-8"))["sources"]
        for code in sorted(tags.all_state_codes):
            mcd = tags.mcd_of(code).lower()
            files = {e["file"] for e in sources[state_chunk(chunks, code).id]}
            assert f"davintrade-stack-d-and-e/engine-1-5-new/{mcd}/{mcd}.md" in files, code
            assert f"davintrade-stack-d-and-e/engine-1-5-new/{mcd}/{mcd}_registry.yaml" in files, code


# ---------------------------------------------------------------------------
# the index finds what it holds
# ---------------------------------------------------------------------------


def playbook_intents(matrix: Matrix) -> list[str]:
    return sorted(i for i, rule in matrix.intents.items() if rule.playbooks == PLAYBOOKS_M_STAR)


class TestSmokeRetrieval:
    """A search for a state code's own name returns that state's section in the first four hits (not yet the labelled set)."""

    FORMS = {
        "its name": lambda code: code,
        "a question about it": lambda code: f"What does {code} mean?",
    }

    def test_there_are_intents_that_search_the_playbooks(self, matrix: Matrix):
        assert {"DIRECTION", "ENTRY_TIMING"} <= set(playbook_intents(matrix))

    @pytest.mark.parametrize("form", sorted(FORMS))
    @pytest.mark.parametrize("intent", ["DIRECTION", "ENTRY_TIMING", "EXIT_TARGETS", "INSTANT_M5_INSPECT", "INSTANT_M15_INSPECT"])
    def test_each_state_code_returns_its_own_section_in_the_top_four(self, retriever: Retriever, matrix: Matrix, tags: Tags, chunks, intent: str, form: str):
        assert intent in playbook_intents(matrix)
        misses = []
        for code in sorted(tags.all_state_codes):
            owner = state_chunk(chunks, code)
            request = SearchRequest(intent, self.FORMS[form](code), (tags.mcd_of(code),), (code,), matrix.version)
            result = retriever.search(request)
            top = [c["id"] for c in result.chunks]
            assert len(top) <= 4
            if owner.id not in top:
                misses.append((code, [i.split(".", 1)[1][:36] for i in top]))
        assert misses == [], f"{len(misses)} of 32 state codes missed the top four"

    def test_a_search_for_the_name_alone_still_finds_the_section_without_the_board_codes(self, retriever: Retriever, matrix: Matrix, tags: Tags, chunks):
        """The state code in the question text is enough: most do not need the board's codes to be passed as well."""
        hits = 0
        for code in sorted(tags.all_state_codes):
            request = SearchRequest("DIRECTION", code, (tags.mcd_of(code),), (), matrix.version)
            hits += state_chunk(chunks, code).id in [c["id"] for c in retriever.search(request).chunks]
        assert hits >= 28, f"only {hits} of 32 found without the board's codes"

    def test_a_sensor_outside_m_star_never_returns_its_playbook(self, retriever: Retriever, matrix: Matrix, tags: Tags):
        for code in sorted(tags.state_codes["MCD2"]):
            request = SearchRequest("DIRECTION", code, ("MCD1",), (code,), matrix.version)
            result = retriever.search(request)
            for chunk in result.chunks + result.expansions:
                assert chunk["domain"] != "D2" or chunk["mcd_id"] == "MCD1", (code, chunk["id"])

    def test_an_intent_with_no_playbooks_never_returns_one(self, retriever: Retriever, matrix: Matrix, tags: Tags):
        silent = sorted(i for i, rule in matrix.intents.items() if rule.playbooks != PLAYBOOKS_M_STAR)
        assert "EXPLAIN" in silent
        for intent in silent:
            result = retriever.search(SearchRequest(intent, "What does MCD1_UP_IN_CORRIDOR mean?", ("MCD1",), ("MCD1_UP_IN_CORRIDOR",), matrix.version))
            assert all(c["domain"] != "D2" for c in result.chunks + result.expansions), intent

    D1_QUESTIONS = [
        ("What is UOEDT?", "terms-the-sensors-use"),
        ("What is SSA?", "terms-the-sensors-use"),
        ("What is channel position?", "terms-the-sensors-use"),
        ("What is a channel?", "what-a-channel-is"),
        ("What is LOEDT?", "terms-the-sensors-use"),
        ("What is the trend band?", "the-slope-and-the-five-degree-trend-band"),
        ("What does closed bar mean?", "what-a-closed-bar-is"),
        ("What is P_ref?", "the-reference-price-p-ref"),
        ("What does DELAYED mean?", "data-statuses-of-a-cycle"),
        ("What does CAUTIONARY mean?", "what-makes-a-reading-cautionary"),
        ("What does INVALID mean for a sensor?", "sensor-statuses-on-the-board"),
        ("What does UNKNOWN data status mean?", "when-the-status-is-unknown-or-retuning"),
        ("Why is there no direction when data is stale?", "why-a-stale-status-withholds-direction"),
        ("What is MCD0?", "mcd0-the-fit-gate"),
        ("What does MCD3 measure?", "mcd3-agreement-and-nesting-of-m15-and-m5"),
        ("What is a sustained break?", "inside-outside-and-a-sustained-break"),
        ("What does containment mean?", "width-containment-and-refits"),
        ("What does the sensor bias mean?", "how-the-sensors-run-and-what-a-bias-is"),
    ]

    @pytest.mark.parametrize("question, slug", D1_QUESTIONS)
    def test_a_foundation_question_finds_its_foundation_chunk(self, retriever: Retriever, matrix: Matrix, question: str, slug: str):
        result = retriever.search(SearchRequest("EXPLAIN", question, ("MCD0", "MCD1", "MCD2", "MCD3"), (), matrix.version))
        top = [c["id"].split(".", 1)[1] for c in result.chunks]
        assert slug in top, top
        assert all(c["domain"] == "D1" for c in result.chunks)

    def test_the_related_foundations_come_with_a_playbook_when_the_intent_reads_d1(self, retriever: Retriever, matrix: Matrix, documents, counter: TokenCounter):
        request = SearchRequest("INSTANT_M15_INSPECT", "MCD1_UP_IN_CORRIDOR", ("MCD1",), ("MCD1_UP_IN_CORRIDOR",), matrix.version)
        result = retriever.search(request)
        related = set(documents["d2-mcd1-playbook"].front_matter.related) | {r for d in documents.values() for r in d.front_matter.related}
        assert result.expansions, "a playbook chunk carries its related foundations as expansions"
        assert all(e["id"] in related and e["domain"] == "D1" for e in result.expansions)
        assert len(result.expansions) <= 6
        assert sum(counter.count(c["text"]) for c in result.chunks + result.expansions) <= 2000, "inside the 2,000-token knowledge budget"


# ---------------------------------------------------------------------------
# the review files and the approval gate on the real corpus
# ---------------------------------------------------------------------------


def approved_copy(tmp_path: Path, tags: Tags, index_config, counter, *, status: str = APPROVED) -> Path:
    """A copy of the corpus whose five approval files are `status` and carry the hashes of the files as they are."""
    target = tmp_path / "corpus"
    shutil.copytree(CORPUS, target)
    made, problems = read_corpus(target, tags, index_config, counter.count)
    assert problems == []
    for area, digest in area_hashes(made, target).items():
        data = {
            "schema": "corpus-approval/1", "area": area, "status": status, "content_sha256": digest,
            "approved_by": "Davin" if status == APPROVED else None, "approved_at": "2026-10-14" if status == APPROVED else None,
        }
        (target / APPROVAL_DIR / f"{area}.json").write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return target


class TestReviewAndApproval:
    def test_there_is_one_approval_per_area_and_nothing_else(self, chunks):
        files = {p.stem for p in (CORPUS / APPROVAL_DIR).glob("*.json")}
        assert files == set(area_files(chunks)) and AREAS <= files

    def test_every_approval_is_well_formed_and_matches_the_files_it_covers(self, chunks):
        approvals, problems = load_approvals(CORPUS)
        assert problems == []
        current = area_hashes(chunks, CORPUS)
        for area, approval in approvals.items():
            assert approval.content_sha256 == current[area], f"{area}: the files changed after the approval was recorded"
            assert approval.status in (PENDING, APPROVED)

    def test_a_signed_area_names_who_signed_it_and_when(self):
        """It only forbids a signature without a name or a date; whether an area is signed is Davin's edit of its file."""
        approvals, _ = load_approvals(CORPUS)
        for area, approval in approvals.items():
            if area in AREAS and approval.status == APPROVED:
                assert approval.approved_by and approval.approved_at, area

    def test_the_review_tables_and_approvals_are_current(self, tags: Tags, index_config, counter):
        result = run_review(CORPUS, tags=tags, config=index_config, count=counter.count, window=counter.window, write=False)
        assert result.problems == [], [str(p) for p in result.problems]

    def test_there_is_a_review_table_per_area_and_it_lists_every_chunk_and_state_code(self, chunks, tags: Tags):
        for area, files in area_files(chunks).items():
            table = (CORPUS / REVIEW_DIR / f"_{area}.md").read_text(encoding="utf-8")
            for chunk in (c for c in chunks if c.doc_id in files):
                assert f"| `{chunk.id}` | {chunk.heading} | {chunk.tokens} | {chunk.chars} |" in table
            if area.startswith("D2-"):
                mcd = area.split("-", 1)[1]
                assert "NOT COVERED" not in table
                for code in tags.state_codes[mcd]:
                    assert f"| `{code}` |" in table
            assert "PENDING" not in table and "APPROVED" not in table, "a table holds content only, never a status"

    def test_the_review_files_are_not_corpus(self, chunks):
        assert not any(c.path.startswith((f"{REVIEW_DIR}/", f"{APPROVAL_DIR}/")) for c in chunks)

    def test_the_review_command_agrees_on_the_real_corpus(self, capsys, model_dir: Path):
        code = main(["review", "--corpus", str(CORPUS), "--check", "--model-dir", str(model_dir)])
        out = capsys.readouterr()
        assert code == 0, out.err
        report = json.loads(out.out)
        assert report["written"] == [] and AREAS <= set(report["areas"])


class TestTheProductionGateOnTheRealCorpus:
    def run(self, capsys, *argv: str):
        code = main(list(argv))
        out = capsys.readouterr()
        return code, (json.loads(out.out) if out.out.strip() else None), out.err

    def test_the_production_build_refuses_while_the_areas_are_pending(self, capsys, tmp_path, tags, index_config, counter, model_dir, chunks):
        corpus = approved_copy(tmp_path, tags, index_config, counter, status=PENDING)
        code, report, err = self.run(
            capsys, "build", "--corpus", str(corpus), "--output", str(tmp_path / "index"), "--require-real", "--require-approved",
            "--model-dir", str(model_dir),
        )
        assert code == 1 and report is None
        every_area = set(area_files(chunks))
        assert AREAS <= every_area
        assert err.count("APPROVAL_PENDING") == len(every_area)
        for area in every_area:
            assert f"{area}.json" in err
        assert not (tmp_path / "index").exists()

    def test_one_area_pending_is_enough_to_refuse(self, capsys, tmp_path, tags, index_config, counter, model_dir):
        corpus = approved_copy(tmp_path, tags, index_config, counter)
        path = corpus / APPROVAL_DIR / "D2-MCD3.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        data.update(status=PENDING, approved_by=None, approved_at=None)
        path.write_text(json.dumps(data), encoding="utf-8")
        code, _, err = self.run(
            capsys, "build", "--corpus", str(corpus), "--output", str(tmp_path / "index"), "--require-real", "--require-approved",
            "--model-dir", str(model_dir),
        )
        assert code == 1 and err.count("APPROVAL_PENDING") == 1 and "D2-MCD3.json" in err

    def test_a_word_changed_after_the_approval_is_refused_for_that_area_only(self, capsys, tmp_path, tags, index_config, counter, model_dir):
        corpus = approved_copy(tmp_path, tags, index_config, counter)
        path = corpus / "D2" / "mcd2.md"
        text = path.read_bytes().decode("utf-8")
        assert "MCD2 describes position and deviation." in text.replace("\r\n", "\n")
        path.write_bytes(text.replace("MCD2 describes position and deviation.", "MCD2 describes position and the deviation.", 1).encode("utf-8"))
        code, _, err = self.run(
            capsys, "build", "--corpus", str(corpus), "--output", str(tmp_path / "index"), "--require-real", "--require-approved",
            "--model-dir", str(model_dir),
        )
        assert code == 1 and err.count("APPROVAL_STALE") == 1 and "D2-MCD2.json" in err and "APPROVAL_PENDING" not in err

    def test_a_missing_approval_file_is_refused(self, capsys, tmp_path, tags, index_config, counter, model_dir):
        corpus = approved_copy(tmp_path, tags, index_config, counter)
        (corpus / APPROVAL_DIR / "D2-MCD0.json").unlink()
        code, _, err = self.run(
            capsys, "build", "--corpus", str(corpus), "--output", str(tmp_path / "index"), "--require-real", "--require-approved",
            "--model-dir", str(model_dir),
        )
        assert code == 1 and err.count("APPROVAL_MISSING") == 1 and "D2-MCD0.json" in err

    def test_the_development_build_of_the_real_command_succeeds_while_pending(self, capsys, tmp_path, tags, index_config, counter, model_dir, real_build):
        corpus = approved_copy(tmp_path, tags, index_config, counter, status=PENDING)
        code, report, err = self.run(
            capsys, "build", "--corpus", str(corpus), "--output", str(tmp_path / "index"), "--require-real", "--model-dir", str(model_dir)
        )
        assert code == 0 and "Traceback" not in err
        assert report["corpus_kind"] == "REAL" and report["index_build_id"] == real_build.index_build_id
        assert set(report["approvals"].values()) == {PENDING} and AREAS <= set(report["approvals"])
        assert report["warnings"] == []

    def test_the_production_build_succeeds_when_every_area_is_approved_and_check_agrees(self, capsys, tmp_path, tags, index_config, counter, model_dir, real_build):
        corpus = approved_copy(tmp_path, tags, index_config, counter)
        out = tmp_path / "index"
        code, report, err = self.run(
            capsys, "build", "--corpus", str(corpus), "--output", str(out), "--require-real", "--require-approved", "--model-dir", str(model_dir)
        )
        assert code == 0 and "Traceback" not in err
        assert set(report["approvals"].values()) == {APPROVED}
        assert report["index_build_id"] == real_build.index_build_id, "a signature changes nothing about what the index answers"

        code, checked, err = self.run(capsys, "check", "--index", str(out), "--require-approved", "--model-dir", str(model_dir))
        assert code == 0 and checked["index_build_id"] == report["index_build_id"], err
        assert set(checked["approvals"].values()) == {APPROVED}

    def test_check_refuses_the_development_index_of_the_pending_corpus(self, capsys, real_build, model_dir):
        states = {entry["status"] for entry in real_build.approvals.values()}
        code, report, err = self.run(capsys, "check", "--index", str(real_build.output_dir), "--require-approved", "--model-dir", str(model_dir))
        if states == {APPROVED}:
            assert code == 0, err
        else:
            assert code == 1 and report is None and ("APPROVAL_PENDING" in err or "APPROVAL_STALE" in err)
        # and without the flag the same index is accepted
        assert self.run(capsys, "check", "--index", str(real_build.output_dir), "--model-dir", str(model_dir))[0] == 0

    def test_the_image_build_uses_the_gate(self):
        dockerfile = (SERVICE_ROOT / "Dockerfile").read_text(encoding="utf-8")
        assert "gate build --corpus corpus --output index --require-real --require-approved" in dockerfile
        assert "gate check --index index --require-approved" in dockerfile
