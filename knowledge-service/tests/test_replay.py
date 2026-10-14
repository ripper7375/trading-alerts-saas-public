"""The labelled question set and the retrieval half of the release gate (build step 6 part 9).

What is shown here (architecture 4.11, plan part 9):

  * item 3, "routing and recall per language within 5 points of English, all 19": the gate passes on the real corpus and the
    recorded run, and recall@4 is measured on the REAL index with the retrieval request the TypeScript replay stored;
  * item 7, "a corpus change that drops recall below 0.8 stops the deploy": the gate FAILS on a corpus with a chunk removed
    (end to end, through `gate build` and `gate replay`), on a stale fingerprint (a changed base, a changed translation, a
    changed glossary, a tampered manifest, a missing recording), on a locale 6 points under English and on a recall of 0.77.

The set's own integrity, the approval of the English base and the generated review are tested here too. Nothing is mocked: the
index is the real corpus built by the real tools, searched by the real txtai and the real model.
"""

from __future__ import annotations

import copy
import json
import re
import shutil
from pathlib import Path

import pytest

from helpers import SERVICE_ROOT
from knowledge import labelled as L
from knowledge.canonical import normalize_text
from knowledge.gate import main
from knowledge.labelled_review import run_labelled_review, show
from knowledge.search import Retriever

LABELLED = SERVICE_ROOT / "labelled"
REPO = SERVICE_ROOT.parent
CORPUS = SERVICE_ROOT / "corpus"
GOLDEN = REPO / "davintrade-stack-d-and-e" / "engine-1-5-new" / "mcd_worker" / "golden"


# ---------------------------------------------------------------------------
# fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def chunk_ids(real_corpus_retriever: Retriever) -> set[str]:
    return set(real_corpus_retriever.loaded.chunks)


@pytest.fixture(scope="module")
def the_set() -> L.LabelledSet:
    return L.load_set(LABELLED)


@pytest.fixture(scope="module")
def the_run() -> L.Run:
    return L.load_run(LABELLED)


@pytest.fixture(scope="module")
def replay_it(real_corpus_retriever: Retriever, chunk_ids: set[str], glossary_version: str, matrix):
    def go(directory: Path = LABELLED, **options) -> L.ReplayReport:
        return L.replay(
            directory,
            retriever=real_corpus_retriever,
            known_chunk_ids=chunk_ids,
            glossary_version=options.pop("glossary_version", glossary_version),
            routing_version=matrix.version,
            **options,
        )

    return go


@pytest.fixture(scope="module")
def clean(replay_it) -> L.ReplayReport:
    return replay_it()


@pytest.fixture
def copy_of_labelled(tmp_path: Path) -> Path:
    target = tmp_path / "labelled"
    shutil.copytree(LABELLED, target)
    return target


def review(directory: Path, *, write: bool):
    """The review of a folder; a copy in a temporary directory is shown the golden cycles of the repository."""
    return run_labelled_review(directory, write=write, golden=GOLDEN if GOLDEN.is_dir() else None)


def edit_json(path: Path, change) -> None:
    value = json.loads(normalize_text(path.read_bytes().decode("utf-8")))
    change(value)
    path.write_bytes((json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))


def codes(problems) -> set[str]:
    return {p.code for p in problems}


def recall(hits: int, total: int, locale: str = "de") -> L.LocaleRecall:
    return L.LocaleRecall(locale=locale, hits=hits, total=total, mean_share=1.0, by_intent={}, misses=[])


# ---------------------------------------------------------------------------
# the set
# ---------------------------------------------------------------------------


class TestTheSet:
    def test_it_passes_its_own_checks_against_the_chunks_of_the_real_corpus(self, the_set, chunk_ids):
        assert L.check_set(the_set, chunk_ids) == []

    def test_forty_questions_five_per_intent_and_eight_noisy(self, the_set):
        questions = the_set.questions
        assert [q["id"] for q in questions] == [f"q-{i:02d}" for i in range(1, 41)]
        for intent in L.INTENTS:
            assert sum(q["expected_intent"] == intent for q in questions) == 5, intent
        assert sum(q["slice"] == "noisy" for q in questions) == 8
        # one noisy question for each intent: the noise is spread, not piled on one kind of question
        assert {q["expected_intent"] for q in questions if q["slice"] == "noisy"} == set(L.INTENTS)

    def test_the_nineteen_locales_are_those_of_the_app(self):
        source = (REPO / "lib" / "i18n" / "languages.ts").read_text(encoding="utf-8")
        in_app = tuple(re.findall(r"code:\s*'([A-Za-z-]+)'", source))
        assert in_app == L.LOCALES, "the labelled set covers exactly the locales of lib/i18n/languages.ts, in its order"
        assert len(L.LOCALES) == 19 and L.ENGLISH == L.LOCALES[0]
        assert len(L.TRANSLATED) == 18

    def test_every_locale_has_a_file_with_the_same_forty_ids_and_no_labels_of_its_own(self, the_set):
        assert set(the_set.locales) == set(L.TRANSLATED)
        ids = [q["id"] for q in the_set.questions]
        for locale, file in the_set.locales.items():
            assert [q["id"] for q in file["questions"]] == ids, locale
            assert all(set(q) == {"id", "question"} for q in file["questions"]), locale
            assert file["translation_status"] == "DRAFT", locale

    def test_a_translation_is_a_translation(self, the_set):
        english = {q["id"]: q["question"] for q in the_set.questions}
        for locale, file in the_set.locales.items():
            same = [q["id"] for q in file["questions"] if q["question"] == english[q["id"]]]
            # a British spelling of an English question may equal it; any other locale must change nearly every sentence
            assert len(same) <= (36 if locale == "en-GB" else 2), (locale, same)

    def test_noisy_questions_stay_noisy_in_every_locale(self, the_set):
        # the noisy ones are written so a tidy sentence would be a defect: none ends in a plain capital-and-full-stop sentence
        noisy = [q["id"] for q in the_set.questions if q["slice"] == "noisy"]
        assert noisy == ["q-05", "q-09", "q-14", "q-18", "q-24", "q-29", "q-34", "q-37"]
        for locale, file in the_set.locales.items():
            by_id = {q["id"]: q["question"] for q in file["questions"]}
            for qid in noisy:
                assert by_id[qid] == by_id[qid].strip() and by_id[qid], (locale, qid)

    def test_retrieving_intents_need_one_to_four_chunks_and_the_others_none(self, the_set):
        for q in the_set.questions:
            n = len(q["expected_chunk_ids"])
            if q["expected_intent"] in L.RETRIEVING:
                assert 1 <= n <= 4, q["id"]
                assert q["expected_m_star"], q["id"]
            else:
                assert n == 0 and q["expected_m_star"] == [] and q["expected_warnings"] == [], q["id"]

    def test_a_warning_is_always_in_m_star(self, the_set):
        for q in the_set.questions:
            assert set(q["expected_warnings"]) <= set(q["expected_m_star"]), q["id"]

    def test_every_golden_cycle_named_exists_and_the_set_uses_a_spread_of_them(self, the_set):
        golden = REPO / "davintrade-stack-d-and-e" / "engine-1-5-new" / "mcd_worker" / "golden"
        if not golden.is_dir():
            pytest.skip("the golden cycles are not next to the service")
        existing = {f"golden-{p.name[:2]}" for p in golden.iterdir() if re.match(r"^\d\d-", p.name)}
        used = {q["scenario_id"] for q in the_set.questions}
        assert used <= existing
        assert len(used) >= 10, "the questions should not all lean on a couple of cycles"

    def test_the_adversarial_slice_is_about_a_dozen_cases(self, the_set):
        adversarial = the_set.base["adversarial"]
        assert 10 <= len(adversarial) <= 15
        kinds = {a["kind"] for a in adversarial}
        for needed in ("PROMPT_INJECTION", "SQL_INJECTION", "TOO_LONG", "EMPTY", "WHITE_SPACE_ONLY", "AMBIGUOUS"):
            assert needed in kinds, needed
        assert any(len(a["question"]) > 500 for a in adversarial), "one case is over the 500-character door"


class TestTheSetRefusesWhatIsWrong:
    """Each defect of the set is found by `check_set`, on a copy made in memory."""

    def damaged(self, the_set: L.LabelledSet, change) -> L.LabelledSet:
        copy_ = L.LabelledSet(base=copy.deepcopy(the_set.base), locales=copy.deepcopy(the_set.locales), problems=[])
        change(copy_)
        return copy_

    @pytest.mark.parametrize(
        "name, code, change",
        [
            ("a duplicate id", "QUESTION_ID", lambda s: s.base["questions"][1].update(id="q-01")),
            ("a sixth question of one intent", "INTENT_COUNT", lambda s: s.base["questions"][0].update(expected_intent="NEWS")),
            ("a ninth noisy question", "NOISY_COUNT", lambda s: s.base["questions"][0].update(slice="noisy")),
            ("an unknown chunk", "CHUNK_UNKNOWN", lambda s: s.base["questions"][0]["expected_chunk_ids"].append("d9-nothing.here")),
            ("no expected chunk", "CHUNKS_COUNT", lambda s: s.base["questions"][0].update(expected_chunk_ids=[])),
            ("five expected chunks", "CHUNKS_COUNT", lambda s: s.base["questions"][0]["expected_chunk_ids"].extend(["a", "b", "c", "d", "e"])),
            ("a chunk for Report 2", "QUESTION_INVALID", lambda s: s.base["questions"][30].update(expected_chunk_ids=["d1-closed-bar-rule.what-a-closed-bar-is"])),
            ("an unknown scenario", "QUESTION_INVALID", lambda s: s.base["questions"][0].update(scenario_id="golden-17")),
            ("an unknown trader", "QUESTION_INVALID", lambda s: s.base["questions"][0].update(trader_type="SWING")),
            ("a warning outside M*", "QUESTION_INVALID", lambda s: s.base["questions"][0].update(expected_warnings=["MCD3"])),
            ("a missing label", "QUESTION_INVALID", lambda s: s.base["questions"][0].pop("expected_m_star")),
            ("a missing locale file", "LOCALE_MISSING", lambda s: s.locales.pop("de")),
            ("a short locale file", "LOCALE_COVERAGE", lambda s: s.locales["de"]["questions"].pop()),
            ("a label in a translation", "LABELS_INHERITED", lambda s: s.locales["de"]["questions"][0].update(expected_intent="NEWS")),
            ("an empty translation", "LOCALE_INVALID", lambda s: s.locales["de"]["questions"][0].update(question="  ")),
            ("one adversarial case", "ADVERSARIAL", lambda s: s.base.update(adversarial=s.base["adversarial"][:3])),
            ("a neutralised case with no clean question", "ADVERSARIAL", lambda s: s.base["adversarial"][1].update(same_as="q-99")),
        ],
    )
    def test_it_is_found(self, the_set, chunk_ids, name, code, change):
        # the loader's own problems are not part of the copy: only the defect is
        problems = L.check_set(self.damaged(the_set, change), chunk_ids)
        assert code in codes(problems), f"{name}: {sorted(codes(problems))}"


# ---------------------------------------------------------------------------
# the recorded run
# ---------------------------------------------------------------------------


class TestTheRecordedRun:
    def test_it_is_current_for_this_set_and_this_glossary(self, the_set, the_run, glossary_version, matrix):
        assert L.check_run(the_run, the_set, glossary_version=glossary_version, routing_version=matrix.version) == []

    def test_it_covers_the_nineteen_locales_and_says_what_kind_of_run_it_is(self, the_run):
        assert the_run.manifest["locales"] == list(L.LOCALES)
        assert set(the_run.locales) == set(L.LOCALES)
        assert the_run.provenance in L.PROVENANCES
        assert the_run.manifest["model_id"] and the_run.manifest["prompt_version"]
        assert "cost_usd" in the_run.manifest and the_run.manifest["cost_note"]

    def test_python_hashes_the_base_as_typescript_did(self, the_set, the_run):
        # the manifest was written by the TypeScript side: the same canonical JSON, the same SHA-256
        assert the_run.manifest["base_set_sha256"] == L.canonical_sha(the_set.base)
        for locale, file in the_set.locales.items():
            assert the_run.manifest["locale_sha256"][locale] == L.canonical_sha(file), locale

    def test_the_fingerprint_is_the_formula_of_the_plan(self, the_run):
        m = the_run.manifest
        text = f"{m['model_id']}:{m['prompt_version']}:{m['glossary_version']}:{m['base_set_sha256']}"
        import hashlib

        assert m["fingerprint"] == hashlib.sha256(text.encode()).hexdigest()[:32]
        assert the_run.pointer["fingerprint"] == m["fingerprint"]

    def test_every_recorded_question_is_the_text_of_the_set(self, the_set, the_run):
        for locale in L.LOCALES:
            by_id = {r["id"]: r for r in the_run.locales[locale]["questions"]}
            assert len(by_id) == 40
            for q in the_set.questions:
                assert by_id[q["id"]]["question"] == the_set.text(locale, q["id"]), (locale, q["id"])

    def test_the_retrieval_requests_are_in_the_run_file_for_every_retrieving_question(self, the_set, the_run, matrix):
        for locale in L.LOCALES:
            rows = {r["id"]: r for r in the_run.locales[locale]["questions"]}
            for q in the_set.questions:
                retrieval = rows[q["id"]]["replay"]["retrieval"]
                if q["expected_intent"] in L.RETRIEVING:
                    assert retrieval is not None, (locale, q["id"])
                    assert retrieval["routing_version"] == matrix.version
                    assert retrieval["intent"] == rows[q["id"]]["intent"]
                else:
                    assert retrieval is None, (locale, q["id"])


class TestAStaleOrDamagedRunIsRefused:
    """Plan part 9 and 4.11 item 7: a recording that is not exactly the one for these inputs stops the gate."""

    def check(self, directory: Path, glossary_version: str, matrix) -> set[str]:
        labelled, run = L.load_set(directory), L.load_run(directory)
        return codes(L.check_run(run, labelled, glossary_version=glossary_version, routing_version=matrix.version))

    def test_a_different_glossary(self, copy_of_labelled, glossary_version, matrix):
        labelled, run = L.load_set(copy_of_labelled), L.load_run(copy_of_labelled)
        got = codes(L.check_run(run, labelled, glossary_version=glossary_version + "-next", routing_version=matrix.version))
        assert got == {"STALE_GLOSSARY"}

    def test_a_changed_word_in_the_english_base(self, copy_of_labelled, glossary_version, matrix):
        edit_json(copy_of_labelled / L.BASE_FILE, lambda b: b["questions"][0].update(question="Should I buy or sell gold today?"))
        got = self.check(copy_of_labelled, glossary_version, matrix)
        assert "STALE_BASE_SET" in got and "STALE_QUESTION" in got

    def test_a_changed_label_in_the_english_base(self, copy_of_labelled, glossary_version, matrix):
        edit_json(copy_of_labelled / L.BASE_FILE, lambda b: b["questions"][0].update(expected_m_star=["MCD1", "MCD2"]))
        assert "STALE_BASE_SET" in self.check(copy_of_labelled, glossary_version, matrix)

    def test_a_changed_translation(self, copy_of_labelled, glossary_version, matrix):
        edit_json(copy_of_labelled / L.LOCALES_DIR / "de.json", lambda f: f["questions"][3].update(question="Wohin geht Gold jetzt?"))
        got = self.check(copy_of_labelled, glossary_version, matrix)
        assert "STALE_LOCALE" in got and "STALE_QUESTION" in got

    def test_a_manifest_that_does_not_hash_to_its_fingerprint(self, copy_of_labelled, glossary_version, matrix):
        fingerprint = L.load_run(copy_of_labelled).manifest["fingerprint"]
        path = copy_of_labelled / L.RUNS_DIR / fingerprint / L.MANIFEST_FILE
        edit_json(path, lambda m: m.update(model_id="another-model"))
        assert "FINGERPRINT_MISMATCH" in self.check(copy_of_labelled, glossary_version, matrix)

    def test_a_pointer_that_names_another_run(self, copy_of_labelled, glossary_version, matrix):
        fingerprint = L.load_run(copy_of_labelled).manifest["fingerprint"]
        other = "0" * 32
        shutil.copytree(copy_of_labelled / L.RUNS_DIR / fingerprint, copy_of_labelled / L.RUNS_DIR / other)
        edit_json(copy_of_labelled / L.POINTER_FILE, lambda p: p.update(fingerprint=other))
        assert {"POINTER_MISMATCH"} <= self.check(copy_of_labelled, glossary_version, matrix)

    def test_no_recording_at_all(self, copy_of_labelled, glossary_version, matrix):
        (copy_of_labelled / L.POINTER_FILE).unlink()
        assert self.check(copy_of_labelled, glossary_version, matrix) == {"RUN_MISSING"}

    def test_a_missing_locale_recording(self, copy_of_labelled, glossary_version, matrix):
        fingerprint = L.load_run(copy_of_labelled).manifest["fingerprint"]
        (copy_of_labelled / L.RUNS_DIR / fingerprint / "th.json").unlink()
        assert "MISSING_LOCALE_RUN" in self.check(copy_of_labelled, glossary_version, matrix)

    def test_a_locale_file_of_another_run(self, copy_of_labelled, glossary_version, matrix):
        fingerprint = L.load_run(copy_of_labelled).manifest["fingerprint"]
        edit_json(copy_of_labelled / L.RUNS_DIR / fingerprint / "fr.json", lambda f: f.update(fingerprint="f" * 32))
        assert "FILE_FINGERPRINT" in self.check(copy_of_labelled, glossary_version, matrix)

    def test_a_recording_made_under_another_routing(self, copy_of_labelled, glossary_version, matrix):
        labelled, run = L.load_set(copy_of_labelled), L.load_run(copy_of_labelled)
        got = codes(L.check_run(run, labelled, glossary_version=glossary_version, routing_version="routing-v2"))
        assert got == {"STALE_ROUTING"}

    def test_the_replay_does_not_search_a_stale_recording(self, replay_it, copy_of_labelled):
        edit_json(copy_of_labelled / L.BASE_FILE, lambda b: b["questions"][0].update(question="Should I buy or sell gold today?"))
        report = replay_it(copy_of_labelled)
        assert "STALE_BASE_SET" in codes(report.problems)
        assert report.locales == [], "a stale recording is not searched: its numbers would be about something else"


# ---------------------------------------------------------------------------
# the replay on the clean corpus
# ---------------------------------------------------------------------------


class TestTheGatePassesOnTheCleanCorpusAndTheRecordedRun:
    def test_no_problem(self, clean):
        assert clean.problems == [], [str(p) for p in clean.problems]

    def test_recall_at_4_is_measured_in_every_locale_on_the_thirty_retrieving_questions(self, clean):
        assert [r.locale for r in clean.locales] == list(L.LOCALES)
        assert all(r.total == 30 for r in clean.locales)

    def test_recall_is_at_least_the_bar_in_every_locale(self, clean):
        for r in clean.locales:
            assert r.recall >= L.RECALL_BAR - L.EPSILON, (r.locale, r.hits, r.total)

    def test_every_locale_is_within_five_points_of_english(self, clean):
        english = next(r for r in clean.locales if r.locale == L.ENGLISH)
        for r in clean.locales:
            assert english.recall - r.recall <= L.WITHIN_ENGLISH + L.EPSILON, r.locale

    def test_a_stand_in_run_says_so_and_all_its_locales_are_equal(self, clean):
        # the stand-in gives every locale the same English pivot, so equal scores prove nothing about translation
        if clean.provenance == "STAND_IN":
            assert len({(r.hits, r.total) for r in clean.locales}) == 1
        else:
            assert clean.provenance == "LIVE"

    def test_the_report_names_the_index_and_the_run(self, clean, real_corpus_retriever, the_run):
        assert clean.index_build_id == real_corpus_retriever.build_id
        assert clean.fingerprint == the_run.manifest["fingerprint"]
        document = clean.as_dict()
        assert document["provenance"] == the_run.provenance
        assert set(document["recall_at_4"]) == set(L.LOCALES)

    def test_hostile_text_that_reaches_retrieval_changes_nothing_but_the_query_string(self, clean):
        assert clean.adversarial, "at least one adversarial case reaches retrieval"
        assert all(ok for _, ok, _ in clean.adversarial), clean.adversarial

    def test_hostile_text_that_would_widen_the_search_is_caught(self, replay_it, copy_of_labelled, the_run):
        """The adversarial check can fail: a hostile question whose request names more sensors than its clean twin searches other SQL."""
        fingerprint = the_run.manifest["fingerprint"]
        path = copy_of_labelled / L.RUNS_DIR / fingerprint / f"{L.ENGLISH}.json"

        def widen(file):
            for row in file["adversarial"]:
                if row["id"] == "adv-02":
                    row["replay"]["retrieval"]["m_star"] = ["MCD1", "MCD2", "MCD3"]

        edit_json(path, widen)
        report = replay_it(copy_of_labelled)
        assert "ADVERSARIAL_RETRIEVAL" in codes(report.problems)
        assert [i for i, ok, _ in report.adversarial if not ok] == ["adv-02"]

    def test_the_misses_are_listed_so_a_person_can_read_them(self, the_set, the_run, real_corpus_retriever):
        found = L.recall_of_locale(L.ENGLISH, the_set, the_run.locales[L.ENGLISH], L.retriever_search(real_corpus_retriever))
        assert found.hits + len(found.misses) == found.total
        assert all(re.match(r"^q-\d\d \([A-Z_0-9]+\): none of the expected chunks", m) for m in found.misses)

    def test_the_first_four_hits_are_what_counts_not_the_expansions(self, real_corpus_retriever):
        request = L.to_request(
            {
                "intent": "EXPLAIN",
                "question_en": "What is UOEDT?",
                "m_star": ["MCD1"],
                "state_codes": [],
                "routing_version": "routing-v1",
            }
        )
        ids = L.retriever_search(real_corpus_retriever)(request)
        assert len(ids) <= 4


# ---------------------------------------------------------------------------
# 4.11 item 7: the gate FAILS
# ---------------------------------------------------------------------------


class TestTheGateFails:
    def test_on_a_corpus_with_a_chunk_removed_end_to_end(self, tmp_path: Path, model_dir: Path, capsys):
        """The deploy chain: build the damaged corpus, then replay. The image build stops at the second step."""
        damaged = tmp_path / "corpus"
        shutil.copytree(CORPUS, damaged)
        zones = damaged / "D3" / "zones-and-runway.md"
        text = normalize_text(zones.read_bytes().decode("utf-8"))
        start = text.index("## What an entry zone is")
        end = text.index("## Where the zone levels come from")
        assert start < end
        zones.write_bytes((text[:start] + text[end:]).encode("utf-8"))

        out = tmp_path / "index"
        assert main(["build", "--corpus", str(damaged), "--output", str(out), "--require-real", "--model-dir", str(model_dir)]) == 0
        capsys.readouterr()
        code = main(["replay", "--index", str(out), "--labelled", str(LABELLED), "--model-dir", str(model_dir)])
        captured = capsys.readouterr()
        assert code == 1
        assert "CHUNK_UNKNOWN" in captured.err and "d3-zones-and-runway.what-an-entry-zone-is" in captured.err
        assert "Traceback" not in captured.err

    def test_on_a_stale_fingerprint_end_to_end(self, copy_of_labelled: Path, real_corpus_build, model_dir: Path, capsys):
        edit_json(copy_of_labelled / L.BASE_FILE, lambda b: b["questions"][5].update(question="Where is a good place to enter a long on gold now?"))
        code = main(["replay", "--index", str(real_corpus_build.output_dir), "--labelled", str(copy_of_labelled), "--model-dir", str(model_dir)])
        captured = capsys.readouterr()
        assert code == 1
        assert "STALE_BASE_SET" in captured.err and "Traceback" not in captured.err

    def test_on_a_locale_six_points_under_english(self):
        # 29 of 30 in English, 27 of 30 (6.7 points under) in German: above the 0.80 bar, so only the comparison can fail it
        problems = L.judge_recall([recall(29, 30, L.ENGLISH), recall(27, 30, "de")])
        assert codes(problems) == {"BELOW_ENGLISH"}
        assert "6.7 points" in str(problems[0])

    def test_a_locale_at_exactly_five_points_is_still_inside(self):
        assert L.judge_recall([recall(20, 20, L.ENGLISH), recall(19, 20, "de")]) == []
        assert codes(L.judge_recall([recall(20, 20, L.ENGLISH), recall(18, 20, "de")])) == {"BELOW_ENGLISH"}

    def test_on_a_recall_of_0_77(self):
        problems = L.judge_recall([recall(23, 30, L.ENGLISH), recall(23, 30, "de")])
        assert codes(problems) == {"RECALL_LOW"} and len(problems) == 2

    def test_a_recall_of_exactly_0_80_passes_and_one_question_fewer_does_not(self):
        assert L.judge_recall([recall(24, 30, L.ENGLISH)]) == []
        assert codes(L.judge_recall([recall(23, 30, L.ENGLISH)])) == {"RECALL_LOW"}

    def test_when_the_search_stops_finding_what_it_found(self, the_set, the_run):
        """The real recall function over a search that has gone wrong: every answer is the same wrong chunk."""
        broken = L.recall_of_locale(L.ENGLISH, the_set, the_run.locales[L.ENGLISH], lambda request: ["d5-system-invariants.fail-closed"])
        assert broken.recall < 0.5
        assert "RECALL_LOW" in codes(L.judge_recall([broken]))

    def test_when_one_locale_loses_questions_while_english_does_not(self, the_set, the_run, real_corpus_retriever):
        search = L.retriever_search(real_corpus_retriever)
        english = L.recall_of_locale(L.ENGLISH, the_set, the_run.locales[L.ENGLISH], search)
        mutated = copy.deepcopy(the_run.locales["de"])
        wanted = {q["id"] for q in the_set.questions if q["expected_intent"] in L.RETRIEVING}
        lost = 0
        for row in mutated["questions"]:
            retrieval = row["replay"].get("retrieval")
            if row["id"] in wanted and retrieval and lost < 3:
                retrieval["question_en"] = "weather in London"  # the pivot of this question no longer asks for its answer
                retrieval["state_codes"] = []
                lost += 1
        german = L.recall_of_locale("de", the_set, mutated, search)
        assert german.recall < english.recall
        assert {"BELOW_ENGLISH"} <= codes(L.judge_recall([english, german]))

    def test_a_missing_retrieval_is_a_miss_not_a_crash(self, the_set, the_run):
        mutated = copy.deepcopy(the_run.locales[L.ENGLISH])
        for row in mutated["questions"]:
            row["replay"]["retrieval"] = None
        found = L.recall_of_locale(L.ENGLISH, the_set, mutated, lambda request: [])
        assert found.hits == 0 and found.recall == 0.0 and len(found.misses) == 30

    def test_a_run_no_model_answered_is_refused_when_a_live_run_is_required(self, replay_it, the_run):
        report = replay_it(require_live_run=True)
        if the_run.provenance == "STAND_IN":
            assert "RUN_NOT_LIVE" in codes(report.problems)
        else:
            assert "RUN_NOT_LIVE" not in codes(report.problems)

    def test_the_command_refuses_a_base_set_nobody_has_approved_when_asked_to(self, real_corpus_build, model_dir: Path, capsys, copy_of_labelled: Path):
        index = str(real_corpus_build.output_dir)
        edit_json(copy_of_labelled / L.APPROVAL_FILE, lambda a: a.update(status="PENDING", approved_by=None, approved_at=None))
        args = ["replay", "--index", index, "--labelled", str(copy_of_labelled), "--model-dir", str(model_dir)]
        assert main(args) == 0, "without the flag a development replay does not need the approval"
        capsys.readouterr()
        assert main([*args, "--require-approved"]) == 1
        assert "APPROVAL_PENDING" in capsys.readouterr().err
        sign(copy_of_labelled)
        assert main([*args, "--require-approved"]) == 0

    def test_the_exit_code_of_the_command_is_zero_when_it_passes_and_one_when_it_does_not(
        self, real_corpus_build, model_dir: Path, capsys, copy_of_labelled: Path
    ):
        index = str(real_corpus_build.output_dir)
        assert main(["replay", "--index", index, "--labelled", str(LABELLED), "--model-dir", str(model_dir)]) == 0
        passed = json.loads(capsys.readouterr().out)
        assert passed["ok"] is True and passed["problems"] == [] and passed["recall_at_4"]["en-US"]["total"] == 30
        (copy_of_labelled / L.POINTER_FILE).unlink()
        assert main(["replay", "--index", index, "--labelled", str(copy_of_labelled), "--model-dir", str(model_dir)]) == 1
        captured = capsys.readouterr()
        assert "RUN_MISSING" in captured.err


# ---------------------------------------------------------------------------
# the approval of the English base
# ---------------------------------------------------------------------------


def sign(directory: Path, by: str = "Davin", at: str = "2026-10-14") -> None:
    edit_json(directory / L.APPROVAL_FILE, lambda a: a.update(status="APPROVED", approved_by=by, approved_at=at))


class TestApproval:
    def test_the_recorded_hash_is_the_hash_of_the_base_as_it_is_now(self, the_set):
        document = json.loads(normalize_text((LABELLED / L.APPROVAL_FILE).read_bytes().decode("utf-8")))
        assert document["schema"] == L.APPROVAL_SCHEMA and document["area"] == "labelled"
        assert document["content_sha256"] == L.approval_hash(the_set)
        assert document["status"] in L.STATUSES

    def test_a_pending_set_is_refused_when_approval_is_required(self, replay_it, copy_of_labelled):
        pending = copy_of_labelled / L.APPROVAL_FILE
        edit_json(pending, lambda a: a.update(status="PENDING", approved_by=None, approved_at=None))
        report = replay_it(copy_of_labelled, require_approved=True)
        assert "APPROVAL_PENDING" in codes(report.problems)
        assert codes(replay_it(copy_of_labelled).problems) == set(), "a development replay does not need the approval"

    def test_a_signed_set_passes(self, replay_it, copy_of_labelled):
        sign(copy_of_labelled)
        assert replay_it(copy_of_labelled, require_approved=True).problems == []

    def test_a_base_changed_after_the_signature_is_stale(self, copy_of_labelled, the_set):
        sign(copy_of_labelled)
        edit_json(copy_of_labelled / L.BASE_FILE, lambda b: b["questions"][0].update(label_note="reworded"))
        problems = L.check_approval(copy_of_labelled, L.load_set(copy_of_labelled))
        assert codes(problems) == {"APPROVAL_STALE"}

    def test_a_translation_changed_after_the_signature_does_not_undo_it(self, copy_of_labelled):
        # what Davin signs is the English base; the drafts wait for native readers and a new recorded run
        sign(copy_of_labelled)
        edit_json(copy_of_labelled / L.LOCALES_DIR / "de.json", lambda f: f["questions"][0].update(question="Soll ich Gold kaufen?"))
        assert L.check_approval(copy_of_labelled, L.load_set(copy_of_labelled)) == []

    @pytest.mark.parametrize(
        "change, code",
        [
            (lambda a: a.update(status="MAYBE"), "APPROVAL_INVALID"),
            # approved by nobody (explicit: the repository's own approval is signed, so the status alone changes nothing)
            (lambda a: a.update(status="APPROVED", approved_by=None, approved_at=None), "APPROVAL_INVALID"),
            (lambda a: a.update(status="PENDING", approved_by="Davin"), "APPROVAL_INVALID"),
            (lambda a: a.update(content_sha256="abc"), "APPROVAL_INVALID"),
            (lambda a: a.update(extra=1), "APPROVAL_INVALID"),
            (lambda a: a.update(status="APPROVED", approved_by="Davin", approved_at="yesterday"), "APPROVAL_INVALID"),
        ],
    )
    def test_a_malformed_approval_is_refused(self, copy_of_labelled, change, code):
        edit_json(copy_of_labelled / L.APPROVAL_FILE, change)
        assert code in codes(L.check_approval(copy_of_labelled, L.load_set(copy_of_labelled)))

    def test_no_approval_file(self, copy_of_labelled):
        (copy_of_labelled / L.APPROVAL_FILE).unlink()
        assert codes(L.check_approval(copy_of_labelled, L.load_set(copy_of_labelled))) == {"APPROVAL_MISSING"}


# ---------------------------------------------------------------------------
# the generated review
# ---------------------------------------------------------------------------


class TestTheReview:
    def test_the_table_and_the_approval_are_current(self):
        result = review(LABELLED, write=False)
        assert result.problems == [], [str(p) for p in result.problems]

    def test_it_writes_pending_and_never_approved(self, copy_of_labelled):
        (copy_of_labelled / L.APPROVAL_FILE).unlink()
        (copy_of_labelled / L.REVIEW_FILE).unlink()
        result = review(copy_of_labelled, write=True)
        assert sorted(result.written) == [L.APPROVAL_FILE, L.REVIEW_FILE]
        document = json.loads((copy_of_labelled / L.APPROVAL_FILE).read_text(encoding="utf-8"))
        assert document["status"] == "PENDING" and document["approved_by"] is None and document["approved_at"] is None

    def test_a_signature_is_left_exactly_as_signed_while_the_base_is_unchanged(self, copy_of_labelled):
        sign(copy_of_labelled)
        before = (copy_of_labelled / L.APPROVAL_FILE).read_bytes()
        result = review(copy_of_labelled, write=True)
        assert result.written == [] and result.status == "APPROVED"
        assert (copy_of_labelled / L.APPROVAL_FILE).read_bytes() == before

    def test_signing_does_not_make_the_table_stale(self, copy_of_labelled):
        sign(copy_of_labelled)
        assert review(copy_of_labelled, write=False).problems == []

    def test_a_changed_base_puts_the_approval_back_to_pending(self, copy_of_labelled):
        sign(copy_of_labelled)
        edit_json(copy_of_labelled / L.BASE_FILE, lambda b: b["questions"][0].update(label_note="reworded"))
        assert codes(review(copy_of_labelled, write=False).problems) == {"REVIEW_STALE", "APPROVAL_STALE"}
        result = review(copy_of_labelled, write=True)
        assert result.status == "PENDING"
        document = json.loads((copy_of_labelled / L.APPROVAL_FILE).read_text(encoding="utf-8"))
        assert document["status"] == "PENDING" and document["content_sha256"] == L.approval_hash(L.load_set(copy_of_labelled))

    def test_it_refuses_to_write_for_a_set_that_fails_its_own_checks(self, copy_of_labelled):
        edit_json(copy_of_labelled / L.BASE_FILE, lambda b: b["questions"].pop())
        result = review(copy_of_labelled, write=True)
        assert result.problems and result.written == []

    def test_the_table_lists_every_question_every_case_and_every_locale(self, the_set):
        text = normalize_text((LABELLED / L.REVIEW_FILE).read_bytes().decode("utf-8"))
        for q in the_set.questions:
            assert f"| {q['id']} |" in text
        for adv in the_set.base["adversarial"]:
            assert f"| {adv['id']} |" in text
        for locale in L.TRANSLATED:
            assert f"| {locale} | DRAFT |" in text
        assert L.approval_hash(the_set) in text

    def test_invisible_characters_and_pipes_are_made_visible(self):
        assert show("​‍") == "<U+200B><U+200D>"
        assert show("a|b") == "a\\|b"
        assert show("a\nb") == "a⏎b"
        assert show("x" * 200, 10).startswith("xxxxxxxxxx…") and "200 characters" in show("x" * 200, 10)


# ---------------------------------------------------------------------------
# the deploy
# ---------------------------------------------------------------------------


class TestTheDockerfile:
    def text(self) -> str:
        return normalize_text((SERVICE_ROOT / "Dockerfile").read_bytes().decode("utf-8"))

    def test_the_last_build_step_is_the_replay_and_it_needs_the_approvals(self):
        text = self.text()
        assert "COPY labelled ./labelled" in text
        assert "python -m knowledge.gate replay --index index --labelled labelled --require-approved" in text
        assert text.index("gate check --index index --require-approved") < text.index("gate replay")
        assert text.index("gate replay") < text.index("HF_HUB_OFFLINE=1"), "the replay is part of the build, before the offline switch"
