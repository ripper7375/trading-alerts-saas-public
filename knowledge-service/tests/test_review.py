"""The review tables and the PENDING approvals (plan part 7): `python -m knowledge.gate review`.

Small corpora written on the fly. What the tool must never do is the point of most of these: write APPROVED, leave a
signature on content that changed, or put a status into a table.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from helpers import FILLER, doc, write_corpus
from knowledge.approval import APPROVAL_DIR, APPROVED, PENDING, REVIEW_DIR, Approval, approval_text, load_approvals
from knowledge.chunker import Chunk
from knowledge.gate import main
from knowledge.review import (
    SOURCE_MAP_FILE,
    SOURCE_MAP_SCHEMA,
    declared_state_codes,
    load_source_map,
    run_review,
    source_cell,
)

D1_ID, D2_ID = "t.d1.one", "t.d2.mcd1"


def playbook_body(*codes: str) -> str:
    # two paragraphs of filler, so that every section stays a chunk of its own after the merge rule (200 tokens)
    sections = "\n\n".join(f"## Section for {c.lower()}\n\n**State code:** `{c}`\n\n{FILLER}\n\n{FILLER}" for c in codes)
    return f"# TEST ONLY: a playbook\n\n{sections}\n"


def corpus_with_sources(root: Path, *, codes=("MCD1_UP_IN_CORRIDOR", "MCD1_UP_UPPER_BREAKOUT")) -> Path:
    write_corpus(
        root,
        {
            "d1/one.md": doc(id=D1_ID, domain="D1"),
            "d2/mcd1.md": doc(playbook_body(*codes), id=D2_ID, domain="D2", mcd_id="MCD1", state_codes=list(codes), timeframe="M15"),
        },
    )
    sources = {
        f"{D1_ID}.a-section": [{"file": "docs/a.md", "section": "1 A"}],
        **{f"{D2_ID}.section-for-{c.lower().replace('_', '-')}": [{"file": "specs/mcd1.md", "section": f"7 row {c}"}] for c in codes},
    }
    (root / SOURCE_MAP_FILE).write_text(json.dumps({"schema": SOURCE_MAP_SCHEMA, "sources": sources}), encoding="utf-8")
    return root


@pytest.fixture
def review(tags, index_config, counter):
    def go(corpus: Path, *, write: bool, **kwargs):
        return run_review(corpus, tags=tags, config=index_config, count=counter.count, window=counter.window, write=write, **kwargs)

    return go


def codes(problems) -> list[str]:
    return sorted(p.code for p in problems)


class TestDeclaredStateCodes:
    def test_a_code_after_the_marker_is_declared(self):
        assert declared_state_codes("## H\n\n**State code:** `MCD1_UP_IN_CORRIDOR`. Regime word X.") == ("MCD1_UP_IN_CORRIDOR",)

    def test_the_marker_must_open_a_line(self):
        assert declared_state_codes("See the **State code:** `MCD1_UP_IN_CORRIDOR` in the text") == ()

    def test_a_code_only_mentioned_in_prose_is_not_declared(self):
        assert declared_state_codes("MCD3 stands aside when MCD1_UP_IN_CORRIDOR and `MCD2_UP_IN_CORRIDOR` differ") == ()

    def test_two_declarations_in_order_without_repeats(self):
        text = "**State code:** `MCD1_UP_IN_CORRIDOR`\n\n**State code:** `MCD1_DOWN_IN_CORRIDOR`\n\n**State code:** `MCD1_UP_IN_CORRIDOR`"
        assert declared_state_codes(text) == ("MCD1_UP_IN_CORRIDOR", "MCD1_DOWN_IN_CORRIDOR")

    def test_a_lower_case_or_unticked_code_is_not_declared(self):
        assert declared_state_codes("**State code:** mcd1_up_in_corridor\n**State code:** MCD1_UP_IN_CORRIDOR") == ()


class TestTheSourceMap:
    def test_no_file_is_an_empty_map(self, tmp_path: Path):
        assert load_source_map(tmp_path) == ({}, [])

    def test_a_good_map(self, tmp_path: Path):
        corpus = corpus_with_sources(tmp_path / "c")
        sources, problems = load_source_map(corpus)
        assert problems == [] and sources[f"{D1_ID}.a-section"] == [("docs/a.md", "1 A")]

    @pytest.mark.parametrize(
        "content",
        [
            "{broken",
            "[]",
            json.dumps({"schema": "other/1", "sources": {}}),
            json.dumps({"schema": SOURCE_MAP_SCHEMA}),
            json.dumps({"schema": SOURCE_MAP_SCHEMA, "sources": []}),
        ],
    )
    def test_a_map_that_is_not_a_map(self, tmp_path: Path, content: str):
        (tmp_path / SOURCE_MAP_FILE).write_text(content, encoding="utf-8")
        sources, problems = load_source_map(tmp_path)
        assert sources == {} and codes(problems) == ["SOURCE_MAP_INVALID"]

    @pytest.mark.parametrize(
        "entry",
        [[], "docs/a.md", [{"file": "a"}], [{"file": "a", "section": ""}], [{"file": 1, "section": "x"}], [{"file": "a", "section": "x", "more": 1}]],
    )
    def test_an_entry_that_is_not_a_list_of_file_and_section(self, tmp_path: Path, entry):
        (tmp_path / SOURCE_MAP_FILE).write_text(json.dumps({"schema": SOURCE_MAP_SCHEMA, "sources": {"c.id": entry}}), encoding="utf-8")
        sources, problems = load_source_map(tmp_path)
        assert sources == {} and codes(problems) == ["SOURCE_MAP_INVALID"]

    def test_the_cell_groups_sections_by_file_and_shows_folder_and_name(self):
        cell = source_cell([("a/b/spec.md", "1 One"), ("a/b/reg.yaml", "rows"), ("a/b/spec.md", "6 Six"), ("a/b/spec.md", "1 One")])
        assert cell == "`b/spec.md`: 1 One; 6 Six. `b/reg.yaml`: rows."

    def test_the_cell_for_nothing_says_missing(self):
        assert source_cell(None) == "MISSING" and source_cell([]) == "MISSING"


class TestRecording:
    def test_it_writes_a_table_and_a_pending_approval_for_every_area(self, review, tmp_path: Path):
        corpus = corpus_with_sources(tmp_path / "c")
        result = review(corpus, write=True)
        assert result.problems == []
        assert sorted(result.written) == sorted(
            [f"{REVIEW_DIR}/_D1.md", f"{REVIEW_DIR}/_D2-MCD1.md", f"{APPROVAL_DIR}/D1.json", f"{APPROVAL_DIR}/D2-MCD1.json"]
        )
        approvals, problems = load_approvals(corpus)
        assert problems == [] and {a.status for a in approvals.values()} == {PENDING}
        assert all(a.approved_by is None and a.approved_at is None for a in approvals.values())

    def test_a_second_run_changes_nothing(self, review, tmp_path: Path):
        corpus = corpus_with_sources(tmp_path / "c")
        review(corpus, write=True)
        before = {p: p.read_bytes() for p in corpus.rglob("*") if p.is_file()}
        again = review(corpus, write=True)
        assert again.written == [] and again.problems == []
        assert {p: p.read_bytes() for p in corpus.rglob("*") if p.is_file()} == before

    def test_the_table_lists_every_chunk_with_its_source_and_codes(self, review, tmp_path: Path):
        corpus = corpus_with_sources(tmp_path / "c")
        review(corpus, write=True)
        table = (corpus / REVIEW_DIR / "_D2-MCD1.md").read_text(encoding="utf-8")
        assert "# Review table: D2-MCD1" in table
        for code in ("MCD1_UP_IN_CORRIDOR", "MCD1_UP_UPPER_BREAKOUT"):
            assert f"| `{code}` | `{D2_ID}.section-for-{code.lower().replace('_', '-')}` |" in table  # the coverage table
            assert f"`specs/mcd1.md`: 7 row {code}." in table
        assert "200 to 450 tokens" in table and "4,000 characters" in table
        assert "| MCD1 | M15 | 1.0.0 | 2 |" in table
        assert table.count("NOT COVERED") == 7, "MCD1 has nine codes and this corpus declares two"
        assert "MISSING" not in table

    def test_the_numbers_in_the_table_are_the_real_counts(self, review, tmp_path: Path, tags, index_config, counter):
        from knowledge.build import read_corpus

        corpus = corpus_with_sources(tmp_path / "c")
        review(corpus, write=True)
        table = (corpus / REVIEW_DIR / "_D2-MCD1.md").read_text(encoding="utf-8")
        chunks, _ = read_corpus(corpus, tags, index_config, counter.count)
        for chunk in (c for c in chunks if c.doc_id == D2_ID):
            assert f"| `{chunk.id}` | {chunk.heading} | {chunk.tokens} | {chunk.chars} |" in table

    def test_a_state_code_no_section_declares_is_shown_as_not_covered(self, review, tmp_path: Path):
        corpus = write_corpus(
            tmp_path / "c",
            {"d2/mcd1.md": doc(playbook_body("MCD1_UP_IN_CORRIDOR"), id=D2_ID, domain="D2", mcd_id="MCD1", state_codes=["MCD1_UP_IN_CORRIDOR"])},
        )
        (corpus / SOURCE_MAP_FILE).write_text(
            json.dumps({"schema": SOURCE_MAP_SCHEMA, "sources": {f"{D2_ID}.section-for-mcd1-up-in-corridor": [{"file": "a", "section": "b"}]}}),
            encoding="utf-8",
        )
        review(corpus, write=True)
        table = (corpus / REVIEW_DIR / "_D2-MCD1.md").read_text(encoding="utf-8")
        assert table.count("NOT COVERED") == 8  # MCD1 has nine state codes and one is declared

    def test_the_table_holds_content_only_never_a_status(self, review, tmp_path: Path):
        corpus = corpus_with_sources(tmp_path / "c")
        review(corpus, write=True)
        for path in (corpus / REVIEW_DIR).glob("*.md"):
            text = path.read_text(encoding="utf-8")
            assert "PENDING" not in text and "APPROVED" not in text, path.name

    def test_the_tool_never_writes_approved(self, review, tmp_path: Path):
        corpus = corpus_with_sources(tmp_path / "c")
        review(corpus, write=True)
        statuses = {json.loads(p.read_text(encoding="utf-8"))["status"] for p in (corpus / APPROVAL_DIR).glob("*.json")}
        assert statuses == {PENDING}

    def test_a_signed_approval_is_left_exactly_as_signed_while_the_content_is_unchanged(self, review, tmp_path: Path):
        corpus = corpus_with_sources(tmp_path / "c")
        review(corpus, write=True)
        path = corpus / APPROVAL_DIR / "D1.json"
        signed = json.loads(path.read_text(encoding="utf-8"))
        signed.update(status=APPROVED, approved_by="Davin", approved_at="2026-10-14")
        path.write_text(json.dumps(signed, indent=4), encoding="utf-8")  # the person's own formatting
        written = path.read_bytes()
        result = review(corpus, write=True)
        assert result.problems == [] and path.read_bytes() == written
        assert result.areas["D1"]["status"] == APPROVED and result.areas["D1"]["reset_to_pending"] is False

    def test_a_file_changed_after_the_signature_puts_the_area_back_to_pending(self, review, tmp_path: Path):
        corpus = corpus_with_sources(tmp_path / "c")
        review(corpus, write=True)
        path = corpus / APPROVAL_DIR / "D1.json"
        signed = json.loads(path.read_text(encoding="utf-8"))
        old_hash = signed["content_sha256"]
        signed.update(status=APPROVED, approved_by="Davin", approved_at="2026-10-14")
        path.write_text(json.dumps(signed), encoding="utf-8")

        source = corpus / "d1" / "one.md"
        source.write_bytes(source.read_bytes().replace(b"plain filler", b"plain filler indeed", 1))
        result = review(corpus, write=True)
        now = json.loads(path.read_text(encoding="utf-8"))
        assert now["status"] == PENDING and now["approved_by"] is None and now["approved_at"] is None
        assert now["content_sha256"] != old_hash
        assert result.areas["D1"]["reset_to_pending"] is True
        # the other area was not touched by the edit
        assert json.loads((corpus / APPROVAL_DIR / "D2-MCD1.json").read_text(encoding="utf-8"))["status"] == PENDING

    def test_a_changed_file_updates_the_table_too(self, review, tmp_path: Path):
        corpus = corpus_with_sources(tmp_path / "c")
        review(corpus, write=True)
        before = (corpus / REVIEW_DIR / "_D1.md").read_text(encoding="utf-8")
        source = corpus / "d1" / "one.md"
        source.write_bytes(source.read_bytes().replace(b"plain filler", b"plain filler indeed", 1))
        review(corpus, write=True)
        assert (corpus / REVIEW_DIR / "_D1.md").read_text(encoding="utf-8") != before


class TestChecking:
    def test_a_fresh_record_checks_clean_and_writes_nothing(self, review, tmp_path: Path):
        corpus = corpus_with_sources(tmp_path / "c")
        review(corpus, write=True)
        before = {p: p.read_bytes() for p in corpus.rglob("*") if p.is_file()}
        result = review(corpus, write=False)
        assert result.problems == [] and result.written == [] and result.stale == []
        assert {p: p.read_bytes() for p in corpus.rglob("*") if p.is_file()} == before

    def test_nothing_recorded_yet_is_stale(self, review, tmp_path: Path):
        corpus = corpus_with_sources(tmp_path / "c")
        result = review(corpus, write=False)
        assert set(codes(result.problems)) == {"REVIEW_STALE", "APPROVAL_STALE"} and len(result.problems) == 4
        assert not (corpus / REVIEW_DIR).exists() and not (corpus / APPROVAL_DIR).exists()

    def test_an_edited_file_makes_both_the_table_and_the_approval_stale(self, review, tmp_path: Path):
        corpus = corpus_with_sources(tmp_path / "c")
        review(corpus, write=True)
        source = corpus / "d1" / "one.md"
        source.write_bytes(source.read_bytes().replace(b"plain filler", b"plain filler indeed", 1))
        result = review(corpus, write=False)
        assert set(result.stale) == {f"{REVIEW_DIR}/_D1.md", f"{APPROVAL_DIR}/D1.json"}
        assert codes(result.problems) == ["APPROVAL_STALE", "REVIEW_STALE"]

    def test_a_hand_edited_table_is_stale(self, review, tmp_path: Path):
        corpus = corpus_with_sources(tmp_path / "c")
        review(corpus, write=True)
        table = corpus / REVIEW_DIR / "_D1.md"
        table.write_text(table.read_text(encoding="utf-8") + "\nA reviewer's note.\n", encoding="utf-8")
        assert codes(review(corpus, write=False).problems) == ["REVIEW_STALE"]

    def test_signing_does_not_make_anything_stale(self, review, tmp_path: Path):
        corpus = corpus_with_sources(tmp_path / "c")
        review(corpus, write=True)
        for path in (corpus / APPROVAL_DIR).glob("*.json"):
            data = json.loads(path.read_text(encoding="utf-8"))
            data.update(status=APPROVED, approved_by="Davin", approved_at="2026-10-14")
            path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        assert review(corpus, write=False).problems == []

    def test_an_approval_with_no_content_is_reported(self, review, tmp_path: Path):
        corpus = corpus_with_sources(tmp_path / "c")
        review(corpus, write=True)
        (corpus / APPROVAL_DIR / "D3.json").write_text(approval_text(Approval("D3", PENDING, "c" * 64, None, None)), encoding="utf-8")
        assert codes(review(corpus, write=False).problems) == ["APPROVAL_WITHOUT_CONTENT"]


class TestWhatItRefuses:
    def test_a_missing_corpus_folder(self, review, tmp_path: Path):
        assert codes(review(tmp_path / "missing", write=True).problems) == ["NO_CORPUS"]

    def test_a_corpus_the_build_would_refuse_gets_no_table(self, review, tmp_path: Path):
        corpus = corpus_with_sources(tmp_path / "c")
        bad = doc(id="t.d1.bad", domain="D1", state_codes=["MCD9_NOPE"])
        (corpus / "d1" / "bad.md").write_text(bad, encoding="utf-8")
        result = review(corpus, write=True)
        assert "UNKNOWN_STATE_CODE" in codes(result.problems)
        assert not (corpus / REVIEW_DIR).exists() and not (corpus / APPROVAL_DIR).exists()

    def test_a_chunk_with_a_forbidden_phrase_gets_no_table(self, review, tmp_path: Path):
        corpus = corpus_with_sources(tmp_path / "c")
        path = corpus / "d1" / "one.md"
        path.write_bytes(path.read_bytes().replace(b"plain filler", b"a guaranteed result", 1))
        assert "WORDING" in codes(review(corpus, write=True).problems)

    def test_a_chunk_without_a_source(self, review, tmp_path: Path):
        corpus = corpus_with_sources(tmp_path / "c")
        sources = json.loads((corpus / SOURCE_MAP_FILE).read_text(encoding="utf-8"))
        del sources["sources"][f"{D1_ID}.a-section"]
        (corpus / SOURCE_MAP_FILE).write_text(json.dumps(sources), encoding="utf-8")
        result = review(corpus, write=True)
        assert codes(result.problems) == ["SOURCE_MISSING"] and result.problems[0].where == f"{D1_ID}.a-section"
        assert not (corpus / REVIEW_DIR).exists()

    def test_a_source_for_a_chunk_that_does_not_exist(self, review, tmp_path: Path):
        corpus = corpus_with_sources(tmp_path / "c")
        sources = json.loads((corpus / SOURCE_MAP_FILE).read_text(encoding="utf-8"))
        sources["sources"]["t.d1.gone.a-section"] = [{"file": "a", "section": "b"}]
        (corpus / SOURCE_MAP_FILE).write_text(json.dumps(sources), encoding="utf-8")
        assert codes(review(corpus, write=True).problems) == ["SOURCE_MAP_UNKNOWN_CHUNK"]

    def test_sources_can_be_made_optional_for_a_draft(self, review, tmp_path: Path):
        corpus = corpus_with_sources(tmp_path / "c")
        (corpus / SOURCE_MAP_FILE).unlink()
        result = review(corpus, write=True, require_sources=False)
        assert result.problems == []
        assert "MISSING" in (corpus / REVIEW_DIR / "_D1.md").read_text(encoding="utf-8")

    def test_a_broken_approval_file_stops_the_review(self, review, tmp_path: Path):
        corpus = corpus_with_sources(tmp_path / "c")
        (corpus / APPROVAL_DIR).mkdir()
        (corpus / APPROVAL_DIR / "D1.json").write_text("{broken", encoding="utf-8")
        assert codes(review(corpus, write=True).problems) == ["APPROVAL_INVALID"]


class TestTheCommand:
    def run(self, capsys, *argv: str):
        code = main(list(argv))
        captured = capsys.readouterr()
        return code, (json.loads(captured.out) if captured.out.strip() else None), captured.err

    def test_record_then_check_then_an_edit(self, capsys, tmp_path: Path, model_dir):
        corpus = corpus_with_sources(tmp_path / "c")
        code, report, err = self.run(capsys, "review", "--corpus", str(corpus), "--model-dir", str(model_dir))
        assert code == 0 and "Traceback" not in err
        assert report["mode"] == "record" and set(report["areas"]) == {"D1", "D2-MCD1"} and len(report["written"]) == 4

        code, report, _ = self.run(capsys, "review", "--corpus", str(corpus), "--check", "--model-dir", str(model_dir))
        assert code == 0 and report["mode"] == "check" and report["written"] == []

        path = corpus / "d1" / "one.md"
        path.write_bytes(path.read_bytes().replace(b"plain filler", b"plain filler indeed", 1))
        code, report, err = self.run(capsys, "review", "--corpus", str(corpus), "--check", "--model-dir", str(model_dir))
        assert code == 1 and report is None and "REVIEW_STALE" in err and "APPROVAL_STALE" in err

    def test_a_corpus_with_a_problem_exits_1(self, capsys, tmp_path: Path, model_dir):
        corpus = corpus_with_sources(tmp_path / "c")
        (corpus / SOURCE_MAP_FILE).unlink()
        code, _, err = self.run(capsys, "review", "--corpus", str(corpus), "--model-dir", str(model_dir))
        assert code == 1 and "SOURCE_MISSING" in err
