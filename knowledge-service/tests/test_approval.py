"""Approval of the corpus (plan part 7, ADR-042): the sign-off files, the hash, and `--require-approved`.

These tests use small corpora written on the fly, so the rules are shown without the real corpus; the real corpus has its
own checks in `test_corpus_d1_d2.py`.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest

from helpers import doc, write_corpus
from knowledge.approval import (
    APPROVAL_DIR,
    APPROVED,
    MISSING,
    PENDING,
    Approval,
    approval_text,
    approvals_summary,
    area_files,
    area_hash,
    area_hashes,
    area_of,
    check_approvals,
    check_recorded_approvals,
    load_approvals,
    parse_approval,
)
from knowledge.build import build_index, corpus_files, read_corpus
from knowledge.config import IndexConfig
from knowledge.errors import BuildFailed
from knowledge.gate import main
from knowledge.index import METADATA_FILE
from knowledge.model import TokenCounter
from knowledge.tags import Tags

DIGEST = "a" * 64
OTHER = "b" * 64


def codes(problems) -> list[str]:
    return sorted(p.code for p in problems)


def small_corpus(root: Path, **overrides: str) -> Path:
    files = {
        "d1/one.md": doc(id="t.d1.one", domain="D1"),
        "d2/mcd1.md": doc(id="t.d2.mcd1", domain="D2", mcd_id="MCD1", state_codes=["MCD1_UP_IN_CORRIDOR"], timeframe="M15"),
    }
    files.update(overrides)
    return write_corpus(root, files)


def hashes_of(corpus: Path, tags: Tags, index_config: IndexConfig, counter: TokenCounter) -> dict[str, str]:
    chunks, problems = read_corpus(corpus, tags, index_config, counter.count)
    assert problems == []
    return area_hashes(chunks, corpus)


def sign(corpus: Path, area: str, digest: str, *, status: str = APPROVED) -> None:
    by, at = ("Davin", "2026-10-14") if status == APPROVED else (None, None)
    folder = corpus / APPROVAL_DIR
    folder.mkdir(exist_ok=True)
    (folder / f"{area}.json").write_text(
        approval_text(Approval(area=area, status=status, content_sha256=digest, approved_by=by, approved_at=at)), encoding="utf-8"
    )


class TestTheAreaOfADocument:
    def test_a_playbook_is_the_area_of_its_sensor(self):
        assert area_of("D2", "MCD1") == "D2-MCD1"
        assert area_of("D2", "MCD0") == "D2-MCD0"

    def test_every_other_domain_is_its_own_area(self):
        assert [area_of(d, None) for d in ("D1", "D3", "D4", "D5")] == ["D1", "D3", "D4", "D5"]

    def test_the_sensor_of_a_non_playbook_does_not_split_its_area(self):
        assert area_of("D3", "MCD1") == "D3"


class TestParsingAnApprovalFile:
    GOOD_PENDING = {
        "schema": "corpus-approval/1", "area": "D1", "status": "PENDING", "content_sha256": DIGEST,
        "approved_by": None, "approved_at": None,
    }
    GOOD_APPROVED = dict(GOOD_PENDING, status="APPROVED", approved_by="Davin", approved_at="2026-10-14")

    def parse(self, raw, stem="D1"):
        return parse_approval(raw, "approval/D1.json", stem)

    def test_pending_and_approved_files_are_read(self):
        pending, problems = self.parse(self.GOOD_PENDING)
        assert problems == [] and pending == Approval("D1", PENDING, DIGEST, None, None)
        approved, problems = self.parse(self.GOOD_APPROVED)
        assert problems == [] and approved.status == APPROVED and approved.approved_by == "Davin"

    def test_a_date_with_a_time_is_accepted(self):
        _, problems = self.parse(dict(self.GOOD_APPROVED, approved_at="2026-10-14T09:30:00Z"))
        assert problems == []

    @pytest.mark.parametrize(
        "edit, what",
        [
            (lambda r: r.pop("status"), "a missing field"),
            (lambda r: r.update(extra=1), "an unknown field"),
            (lambda r: r.update(schema="corpus-approval/2"), "another schema"),
            (lambda r: r.update(area="D9x"), "an area that is not an area"),
            (lambda r: r.update(area="D2"), "an area that is not the file name"),
            (lambda r: r.update(status="DONE"), "an unknown status"),
            (lambda r: r.update(content_sha256="XYZ"), "a hash that is not a hash"),
            (lambda r: r.update(content_sha256=DIGEST.upper()), "an upper-case hash"),
            (lambda r: r.update(approved_by="Davin"), "a PENDING file that names an approver"),
            (lambda r: r.update(approved_at="2026-10-14"), "a PENDING file that has a date"),
        ],
    )
    def test_a_pending_file_that_is_wrong(self, edit, what):
        raw = copy.deepcopy(self.GOOD_PENDING)
        edit(raw)
        approval, problems = self.parse(raw)
        assert approval is None and problems, what
        assert set(codes(problems)) == {"APPROVAL_INVALID"}

    @pytest.mark.parametrize(
        "edit",
        [
            lambda r: r.update(approved_by=None),
            lambda r: r.update(approved_by="  "),
            lambda r: r.update(approved_at=None),
            lambda r: r.update(approved_at="yesterday"),
            lambda r: r.update(approved_at="14/10/2026"),
        ],
    )
    def test_an_approved_file_must_say_who_and_when(self, edit):
        raw = copy.deepcopy(self.GOOD_APPROVED)
        edit(raw)
        approval, problems = self.parse(raw)
        assert approval is None and codes(problems) == ["APPROVAL_INVALID"]

    @pytest.mark.parametrize("raw", [[], "text", 3, None])
    def test_a_file_that_is_not_an_object(self, raw):
        approval, problems = self.parse(raw)
        assert approval is None and codes(problems) == ["APPROVAL_INVALID"]


class TestLoadingTheApprovalFolder:
    def test_no_folder_holds_no_approval(self, tmp_path: Path):
        assert load_approvals(tmp_path) == ({}, [])

    def test_the_files_are_read_by_area(self, tmp_path: Path):
        sign(tmp_path, "D1", DIGEST, status=PENDING)
        sign(tmp_path, "D2-MCD1", OTHER)
        approvals, problems = load_approvals(tmp_path)
        assert problems == [] and sorted(approvals) == ["D1", "D2-MCD1"]
        assert approvals["D2-MCD1"].status == APPROVED

    def test_a_file_that_is_not_json_is_a_problem_not_a_crash(self, tmp_path: Path):
        folder = tmp_path / APPROVAL_DIR
        folder.mkdir()
        (folder / "D1.json").write_text("{not json", encoding="utf-8")
        approvals, problems = load_approvals(tmp_path)
        assert approvals == {} and codes(problems) == ["APPROVAL_INVALID"]

    def test_a_file_whose_name_is_not_its_area(self, tmp_path: Path):
        folder = tmp_path / APPROVAL_DIR
        folder.mkdir()
        (folder / "D1.json").write_text(approval_text(Approval("D3", PENDING, DIGEST, None, None)), encoding="utf-8")
        approvals, problems = load_approvals(tmp_path)
        assert approvals == {} and codes(problems) == ["APPROVAL_INVALID"]

    def test_crlf_in_the_file_is_read_like_lf(self, tmp_path: Path):
        sign(tmp_path, "D1", DIGEST, status=PENDING)
        path = tmp_path / APPROVAL_DIR / "D1.json"
        path.write_bytes(path.read_bytes().replace(b"\n", b"\r\n"))
        approvals, problems = load_approvals(tmp_path)
        assert problems == [] and "D1" in approvals


class TestTheHashOfAnArea:
    def build(self, root: Path, tags: Tags, index_config: IndexConfig, counter: TokenCounter, **overrides) -> dict[str, str]:
        return hashes_of(small_corpus(root, **overrides), tags, index_config, counter)

    def test_each_area_has_a_hash_and_the_areas_differ(self, tmp_path, tags, index_config, counter):
        hashes = self.build(tmp_path / "c", tags, index_config, counter)
        assert sorted(hashes) == ["D1", "D2-MCD1"]
        assert hashes["D1"] != hashes["D2-MCD1"] and all(len(h) == 64 for h in hashes.values())

    def test_the_same_files_give_the_same_hash_with_crlf(self, tmp_path, tags, index_config, counter):
        a = self.build(tmp_path / "a", tags, index_config, counter)
        crlf = small_corpus(tmp_path / "b")
        for path in crlf.rglob("*.md"):
            path.write_bytes(path.read_bytes().replace(b"\n", b"\r\n"))
        assert hashes_of(crlf, tags, index_config, counter) == a

    def test_one_changed_word_changes_only_its_area(self, tmp_path, tags, index_config, counter):
        a = self.build(tmp_path / "a", tags, index_config, counter)
        edited = doc(id="t.d1.one", domain="D1").replace("plain filler", "plain filler indeed")
        b = self.build(tmp_path / "b", tags, index_config, counter, **{"d1/one.md": edited})
        assert b["D1"] != a["D1"] and b["D2-MCD1"] == a["D2-MCD1"]

    def test_renaming_a_file_does_not_change_the_hash(self, tmp_path, tags, index_config, counter):
        a = self.build(tmp_path / "a", tags, index_config, counter)
        corpus = small_corpus(tmp_path / "b")
        (corpus / "d1" / "one.md").rename(corpus / "d1" / "renamed.md")
        assert hashes_of(corpus, tags, index_config, counter) == a

    def test_a_new_document_in_an_area_changes_its_hash(self, tmp_path, tags, index_config, counter):
        a = self.build(tmp_path / "a", tags, index_config, counter)
        extra = doc(id="t.d1.two", domain="D1")
        b = self.build(tmp_path / "b", tags, index_config, counter, **{"d1/two.md": extra})
        assert b["D1"] != a["D1"]

    def test_the_hash_names_its_area(self, tmp_path, tags, index_config, counter):
        corpus = small_corpus(tmp_path / "c")
        chunks, _ = read_corpus(corpus, tags, index_config, counter.count)
        files = area_files(chunks)["D1"]
        assert area_hash("D1", files, corpus) != area_hash("D3", files, corpus)


class TestCheckingApprovals:
    def test_every_area_approved_and_current_passes(self):
        approvals = {"D1": Approval("D1", APPROVED, DIGEST, "Davin", "2026-10-14")}
        assert check_approvals({"D1": DIGEST}, approvals) == []

    def test_a_missing_file(self):
        assert codes(check_approvals({"D1": DIGEST}, {})) == ["APPROVAL_MISSING"]

    def test_a_pending_area(self):
        approvals = {"D1": Approval("D1", PENDING, DIGEST, None, None)}
        assert codes(check_approvals({"D1": DIGEST}, approvals)) == ["APPROVAL_PENDING"]

    def test_an_approval_of_other_content_is_stale(self):
        approvals = {"D1": Approval("D1", APPROVED, OTHER, "Davin", "2026-10-14")}
        assert codes(check_approvals({"D1": DIGEST}, approvals)) == ["APPROVAL_STALE"]

    def test_pending_and_stale_are_both_reported(self):
        approvals = {"D1": Approval("D1", PENDING, OTHER, None, None)}
        assert codes(check_approvals({"D1": DIGEST}, approvals)) == ["APPROVAL_PENDING", "APPROVAL_STALE"]

    def test_an_approval_with_no_content(self):
        approvals = {"D3": Approval("D3", APPROVED, DIGEST, "Davin", "2026-10-14")}
        assert codes(check_approvals({}, approvals)) == ["APPROVAL_WITHOUT_CONTENT"]

    def test_one_unapproved_area_fails_the_whole_corpus(self):
        approvals = {
            "D1": Approval("D1", APPROVED, DIGEST, "Davin", "2026-10-14"),
            "D2-MCD1": Approval("D2-MCD1", PENDING, OTHER, None, None),
        }
        problems = check_approvals({"D1": DIGEST, "D2-MCD1": OTHER}, approvals)
        assert codes(problems) == ["APPROVAL_PENDING"] and problems[0].where.endswith("D2-MCD1.json")

    def test_problems_found_reading_the_files_are_kept(self):
        from knowledge.errors import Problem

        kept = Problem("approval/D1.json", "APPROVAL_INVALID", "x")
        assert kept in check_approvals({"D1": DIGEST}, {"D1": Approval("D1", APPROVED, DIGEST, "D", "2026-10-14")}, [kept])


class TestWhatTheIndexRecords:
    def test_the_summary_says_status_hash_and_whether_the_approval_is_current(self):
        approvals = {
            "D1": Approval("D1", APPROVED, DIGEST, "Davin", "2026-10-14"),
            "D2-MCD1": Approval("D2-MCD1", PENDING, OTHER, None, None),
        }
        summary = approvals_summary({"D1": DIGEST, "D2-MCD1": DIGEST, "D2-MCD2": DIGEST}, approvals)
        assert summary["D1"] == {"status": APPROVED, "content_sha256": DIGEST, "approval_current": True}
        assert summary["D2-MCD1"] == {"status": PENDING, "content_sha256": DIGEST, "approval_current": False}
        assert summary["D2-MCD2"] == {"status": MISSING, "content_sha256": DIGEST, "approval_current": False}

    CHUNKS = {"a": {"domain": "D1", "mcd_id": None}, "b": {"domain": "D2", "mcd_id": "MCD1"}}

    def good(self) -> dict:
        entry = {"status": APPROVED, "content_sha256": DIGEST, "approval_current": True}
        return {"index_build_id": "kb-x", "approvals": {"D1": dict(entry), "D2-MCD1": dict(entry)}}

    def test_an_index_built_with_everything_approved_passes(self):
        assert check_recorded_approvals(self.good(), self.CHUNKS) == []

    def test_an_index_with_no_record(self):
        assert codes(check_recorded_approvals({"index_build_id": "kb-x"}, self.CHUNKS)) == ["APPROVAL_NOT_RECORDED"]
        assert codes(check_recorded_approvals({"index_build_id": "kb-x", "approvals": {}}, self.CHUNKS)) == ["APPROVAL_NOT_RECORDED"]

    def test_an_area_left_out_of_the_record_cannot_pass(self):
        meta = self.good()
        del meta["approvals"]["D2-MCD1"]
        assert codes(check_recorded_approvals(meta, self.CHUNKS)) == ["APPROVAL_NOT_RECORDED"]

    def test_a_pending_area(self):
        meta = self.good()
        meta["approvals"]["D1"]["status"] = PENDING
        assert codes(check_recorded_approvals(meta, self.CHUNKS)) == ["APPROVAL_PENDING"]

    def test_a_stale_area(self):
        meta = self.good()
        meta["approvals"]["D2-MCD1"]["approval_current"] = False
        assert codes(check_recorded_approvals(meta, self.CHUNKS)) == ["APPROVAL_STALE"]

    def test_a_missing_area_is_both_not_approved_and_not_current(self):
        meta = self.good()
        meta["approvals"]["D1"].update(status=MISSING, approval_current=False)
        assert codes(check_recorded_approvals(meta, self.CHUNKS)) == ["APPROVAL_PENDING", "APPROVAL_STALE"]

    def test_a_non_boolean_current_flag_does_not_pass(self):
        meta = self.good()
        meta["approvals"]["D1"]["approval_current"] = "yes"
        assert codes(check_recorded_approvals(meta, self.CHUNKS)) == ["APPROVAL_STALE"]


class TestReviewAndApprovalFoldersAreNotCorpus:
    def test_markdown_under_review_and_approval_is_not_read(self, tmp_path: Path):
        corpus = small_corpus(tmp_path / "c")
        (corpus / "review").mkdir()
        (corpus / "review" / "table.md").write_text(doc(id="t.review.table", domain="D1"), encoding="utf-8")
        (corpus / "approval").mkdir()
        (corpus / "approval" / "note.md").write_text(doc(id="t.approval.note", domain="D1"), encoding="utf-8")
        names = [p.relative_to(corpus).as_posix() for p in corpus_files(corpus)]
        assert names == ["d1/one.md", "d2/mcd1.md"]

    def test_a_folder_of_the_same_name_deeper_down_is_still_corpus(self, tmp_path: Path):
        corpus = small_corpus(tmp_path / "c", **{"d1/review/inner.md": doc(id="t.d1.inner", domain="D1")})
        assert "d1/review/inner.md" in [p.relative_to(corpus).as_posix() for p in corpus_files(corpus)]


class TestTheBuildGate:
    """`build_index(require_approved=...)` on a two-document corpus (a few seconds each)."""

    @pytest.fixture
    def run_build(self, tags, index_config, glossary_version, model_dir, counter):
        def go(corpus: Path, out: Path, **kwargs):
            return build_index(
                corpus, out, tags=tags, config=index_config, glossary_version=glossary_version, model_dir=model_dir,
                counter=counter, **kwargs
            )

        return go

    @pytest.fixture
    def corpus(self, tmp_path, tags, index_config, counter):
        root = small_corpus(tmp_path / "corpus")
        return root, hashes_of(root, tags, index_config, counter)

    def approve_all(self, root: Path, hashes: dict[str, str]) -> None:
        for area, digest in hashes.items():
            sign(root, area, digest)

    def test_a_development_build_succeeds_while_everything_is_pending(self, run_build, corpus, tmp_path):
        root, hashes = corpus
        for area, digest in hashes.items():
            sign(root, area, digest, status=PENDING)
        result = run_build(root, tmp_path / "index")
        assert {a: e["status"] for a, e in result.approvals.items()} == {"D1": PENDING, "D2-MCD1": PENDING}
        assert all(e["approval_current"] and e["content_sha256"] == hashes[a] for a, e in result.approvals.items())

    def test_a_development_build_succeeds_with_no_approval_files_at_all(self, run_build, corpus, tmp_path):
        root, _ = corpus
        result = run_build(root, tmp_path / "index")
        assert {e["status"] for e in result.approvals.values()} == {MISSING}

    def test_a_development_build_does_not_fail_on_a_broken_approval_file(self, run_build, corpus, tmp_path):
        root, _ = corpus
        (root / APPROVAL_DIR).mkdir()
        (root / APPROVAL_DIR / "D1.json").write_text("{broken", encoding="utf-8")
        assert run_build(root, tmp_path / "index").chunk_count == 2

    def test_the_production_build_refuses_a_pending_corpus_and_writes_nothing(self, run_build, corpus, tmp_path):
        root, hashes = corpus
        for area, digest in hashes.items():
            sign(root, area, digest, status=PENDING)
        with pytest.raises(BuildFailed) as caught:
            run_build(root, tmp_path / "index", require_approved=True)
        assert codes(caught.value.problems) == ["APPROVAL_PENDING", "APPROVAL_PENDING"]
        assert not (tmp_path / "index").exists() and not (tmp_path / "index.building").exists()

    def test_the_production_build_refuses_a_corpus_without_approval_files(self, run_build, corpus, tmp_path):
        root, _ = corpus
        with pytest.raises(BuildFailed) as caught:
            run_build(root, tmp_path / "index", require_approved=True)
        assert codes(caught.value.problems) == ["APPROVAL_MISSING", "APPROVAL_MISSING"]

    def test_the_production_build_refuses_one_area_that_is_not_approved(self, run_build, corpus, tmp_path):
        root, hashes = corpus
        sign(root, "D1", hashes["D1"])
        sign(root, "D2-MCD1", hashes["D2-MCD1"], status=PENDING)
        with pytest.raises(BuildFailed) as caught:
            run_build(root, tmp_path / "index", require_approved=True)
        assert codes(caught.value.problems) == ["APPROVAL_PENDING"]
        assert caught.value.problems[0].where.endswith("D2-MCD1.json")

    def test_a_file_changed_after_the_approval_makes_the_approval_stale(self, run_build, corpus, tmp_path):
        root, hashes = corpus
        self.approve_all(root, hashes)
        path = root / "d1" / "one.md"
        path.write_bytes(path.read_bytes().replace(b"plain filler", b"plain filler indeed", 1))
        with pytest.raises(BuildFailed) as caught:
            run_build(root, tmp_path / "index", require_approved=True)
        assert codes(caught.value.problems) == ["APPROVAL_STALE"]
        assert caught.value.problems[0].where.endswith("D1.json")

    def test_an_approval_for_an_area_with_no_files_fails_the_production_build(self, run_build, corpus, tmp_path):
        root, hashes = corpus
        self.approve_all(root, hashes)
        sign(root, "D3", DIGEST)
        with pytest.raises(BuildFailed) as caught:
            run_build(root, tmp_path / "index", require_approved=True)
        assert codes(caught.value.problems) == ["APPROVAL_WITHOUT_CONTENT"]

    def test_a_broken_approval_file_fails_the_production_build(self, run_build, corpus, tmp_path):
        root, hashes = corpus
        self.approve_all(root, hashes)
        (root / APPROVAL_DIR / "D1.json").write_text("{broken", encoding="utf-8")
        with pytest.raises(BuildFailed) as caught:
            run_build(root, tmp_path / "index", require_approved=True)
        assert "APPROVAL_INVALID" in codes(caught.value.problems)

    def test_everything_approved_and_current_builds(self, run_build, corpus, tmp_path):
        root, hashes = corpus
        self.approve_all(root, hashes)
        result = run_build(root, tmp_path / "index", require_approved=True)
        assert {e["status"] for e in result.approvals.values()} == {APPROVED}
        meta = json.loads((result.output_dir / METADATA_FILE).read_text(encoding="utf-8"))
        assert meta["approvals"] == result.approvals

    def test_approving_does_not_change_the_build_id(self, run_build, corpus, tmp_path):
        """The id says what the index answers; a signature changes nothing about that."""
        root, hashes = corpus
        pending = run_build(root, tmp_path / "pending")
        self.approve_all(root, hashes)
        approved = run_build(root, tmp_path / "approved", require_approved=True)
        assert pending.index_build_id == approved.index_build_id

    def test_the_review_and_approval_folders_do_not_change_the_build_id(self, run_build, corpus, tmp_path):
        root, hashes = corpus
        before = run_build(root, tmp_path / "before").index_build_id
        (root / "review").mkdir()
        (root / "review" / "_D1.md").write_text("# a table", encoding="utf-8")
        self.approve_all(root, hashes)
        assert run_build(root, tmp_path / "after").index_build_id == before


class TestTheGateCommands:
    @pytest.fixture
    def prepared(self, tmp_path, tags, index_config, counter):
        root = small_corpus(tmp_path / "corpus")
        return root, hashes_of(root, tags, index_config, counter)

    def run(self, capsys, *argv: str):
        code = main(list(argv))
        captured = capsys.readouterr()
        return code, (json.loads(captured.out) if captured.out.strip() else None), captured.err

    def test_build_without_the_flag_succeeds_while_pending_and_says_so(self, capsys, prepared, tmp_path, model_dir):
        root, hashes = prepared
        for area, digest in hashes.items():
            sign(root, area, digest, status=PENDING)
        code, report, err = self.run(capsys, "build", "--corpus", str(root), "--output", str(tmp_path / "dev"), "--model-dir", str(model_dir))
        assert code == 0 and "Traceback" not in err
        assert report["approvals"] == {"D1": PENDING, "D2-MCD1": PENDING}

    def test_build_with_the_flag_exits_1_and_names_every_pending_area(self, capsys, prepared, tmp_path, model_dir):
        root, hashes = prepared
        for area, digest in hashes.items():
            sign(root, area, digest, status=PENDING)
        code, report, err = self.run(
            capsys, "build", "--corpus", str(root), "--output", str(tmp_path / "prod"), "--model-dir", str(model_dir), "--require-approved"
        )
        assert code == 1 and report is None
        assert err.count("APPROVAL_PENDING") == 2 and "D1.json" in err and "D2-MCD1.json" in err
        assert not (tmp_path / "prod").exists()

    def test_build_with_the_flag_exits_1_on_a_stale_hash(self, capsys, prepared, tmp_path, model_dir):
        root, hashes = prepared
        sign(root, "D1", OTHER)
        sign(root, "D2-MCD1", hashes["D2-MCD1"])
        code, _, err = self.run(
            capsys, "build", "--corpus", str(root), "--output", str(tmp_path / "prod"), "--model-dir", str(model_dir), "--require-approved"
        )
        assert code == 1 and "APPROVAL_STALE" in err and "D1.json" in err

    def test_check_with_the_flag_fails_an_index_built_while_pending_and_passes_an_approved_one(self, capsys, prepared, tmp_path, model_dir):
        root, hashes = prepared
        for area, digest in hashes.items():
            sign(root, area, digest, status=PENDING)
        dev = tmp_path / "dev"
        assert self.run(capsys, "build", "--corpus", str(root), "--output", str(dev), "--model-dir", str(model_dir))[0] == 0

        # without the flag the same index is fine; with it, it is not
        assert self.run(capsys, "check", "--index", str(dev), "--model-dir", str(model_dir))[0] == 0
        code, report, err = self.run(capsys, "check", "--index", str(dev), "--model-dir", str(model_dir), "--require-approved")
        assert code == 1 and report is None and "APPROVAL_PENDING" in err

        for area, digest in hashes.items():
            sign(root, area, digest)
        prod = tmp_path / "prod"
        code, _, err = self.run(
            capsys, "build", "--corpus", str(root), "--output", str(prod), "--model-dir", str(model_dir), "--require-approved"
        )
        assert code == 0 and "Traceback" not in err
        code, report, err = self.run(capsys, "check", "--index", str(prod), "--model-dir", str(model_dir), "--require-approved")
        assert code == 0 and report["approvals"] == {"D1": APPROVED, "D2-MCD1": APPROVED}

    def test_check_with_the_flag_fails_an_index_with_no_approval_record(self, capsys, prepared, tmp_path, model_dir):
        root, _ = prepared
        index = tmp_path / "idx"
        assert self.run(capsys, "build", "--corpus", str(root), "--output", str(index), "--model-dir", str(model_dir))[0] == 0
        meta_path = index / METADATA_FILE
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        del meta["approvals"]
        meta_path.write_text(json.dumps(meta, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        code, _, err = self.run(capsys, "check", "--index", str(index), "--model-dir", str(model_dir), "--require-approved")
        assert code == 1 and "APPROVAL_NOT_RECORDED" in err
