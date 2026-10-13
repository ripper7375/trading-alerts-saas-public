"""The gate: `python -m knowledge.gate build | check | fetch-model`. Exit 1 on any failure, so a deploy stops."""

from __future__ import annotations

import json
import shutil
import sqlite3
import subprocess
import sys
from pathlib import Path

import pytest

from helpers import SERVICE_ROOT, copy_corpus, doc, write_corpus
from knowledge.build import BuildResult
from knowledge.gate import main
from knowledge.index import CHUNKS_FILE


@pytest.fixture
def run(capsys):
    def go(*argv: str) -> tuple[int, dict | None, str]:
        code = main(list(argv))
        captured = capsys.readouterr()
        return code, (json.loads(captured.out) if captured.out.strip() else None), captured.err

    return go


class TestBuild:
    def test_it_builds_and_reports(self, run, fixture_corpus: Path, tmp_path: Path, model_dir: Path, built: BuildResult):
        out = tmp_path / "index"
        code, report, err = run("build", "--corpus", str(fixture_corpus), "--output", str(out), "--model-dir", str(model_dir))
        assert code == 0 and "Traceback" not in err
        assert report["ok"] is True
        assert report["index_build_id"] == built.index_build_id
        assert report["corpus_kind"] == "TEST_ONLY" and report["chunks"] == 15
        assert report["domains"] == {"D1": 5, "D2": 5, "D3": 2, "D4": 2, "D5": 1}
        assert any("OVER_DENSE_WINDOW" in w for w in report["warnings"])
        assert (out / "build_metadata.json").is_file()

    def test_check_accepts_what_build_made(self, run, built: BuildResult, model_dir: Path):
        code, report, err = run("check", "--index", str(built.output_dir), "--model-dir", str(model_dir))
        assert code == 0 and "Traceback" not in err
        assert report["ok"] is True and report["index_build_id"] == built.index_build_id and report["chunks"] == 15
        assert 0 < report["load_seconds"] < 30


class TestADamagedCorpusExitsOne:
    def damaged(self, tmp_path: Path, fixture_corpus: Path, edit) -> Path:
        corpus = copy_corpus(fixture_corpus, tmp_path / "corpus")
        edit(corpus)
        return corpus

    def build(self, run, corpus: Path, tmp_path: Path, model_dir: Path, *extra: str):
        return run("build", "--corpus", str(corpus), "--output", str(tmp_path / "out"), "--model-dir", str(model_dir), *extra)

    def test_an_unknown_tag(self, run, fixture_corpus, tmp_path, model_dir):
        def edit(corpus: Path):
            path = corpus / "d2" / "mcd1.md"
            path.write_bytes(path.read_bytes().replace(b"MCD1_UP_UPPER_BREAKOUT", b"MCD1_UP_UPPER_BREAKOUTT"))

        code, report, err = self.build(run, self.damaged(tmp_path, fixture_corpus, edit), tmp_path, model_dir)
        assert code == 1 and report is None
        assert "UNKNOWN_STATE_CODE" in err and "d2/mcd1.md" in err
        assert not (tmp_path / "out").exists()

    def test_a_forbidden_phrase(self, run, fixture_corpus, tmp_path, model_dir):
        def edit(corpus: Path):
            path = corpus / "d4" / "risk.md"
            path.write_bytes(path.read_bytes().replace(b"Nothing here describes", b"A risk-free result is described. Nothing here describes"))

        code, _, err = self.build(run, self.damaged(tmp_path, fixture_corpus, edit), tmp_path, model_dir)
        assert code == 1 and "WORDING" in err and "risk-free" in err

    def test_a_dangling_reference(self, run, fixture_corpus, tmp_path, model_dir):
        def edit(corpus: Path):
            path = corpus / "d3" / "synthesis.md"
            path.write_bytes(path.read_bytes().replace(b"t.d1.channel.what-a-channel-is", b"t.d1.channel.deleted-section"))

        code, _, err = self.build(run, self.damaged(tmp_path, fixture_corpus, edit), tmp_path, model_dir)
        assert code == 1 and "DANGLING_RELATED" in err

    def test_a_file_that_lost_its_front_matter(self, run, fixture_corpus, tmp_path, model_dir):
        def edit(corpus: Path):
            path = corpus / "d5" / "governance.md"
            text = path.read_bytes().decode("utf-8")
            path.write_bytes(text.split("---\n", 2)[2].encode("utf-8"))

        code, _, err = self.build(run, self.damaged(tmp_path, fixture_corpus, edit), tmp_path, model_dir)
        assert code == 1 and "FRONT_MATTER_MISSING" in err

    def test_an_empty_corpus(self, run, tmp_path, model_dir):
        corpus = write_corpus(tmp_path / "empty", {})
        code, _, err = self.build(run, corpus, tmp_path, model_dir)
        assert code == 1 and "NO_DOCUMENTS" in err

    def test_a_corpus_that_does_not_exist(self, run, tmp_path, model_dir):
        code, _, err = self.build(run, tmp_path / "missing", tmp_path, model_dir)
        assert code == 1 and "NO_CORPUS" in err

    def test_the_test_corpus_is_refused_for_production(self, run, fixture_corpus, tmp_path, model_dir):
        code, _, err = self.build(run, fixture_corpus, tmp_path, model_dir, "--require-real")
        assert code == 1 and "TEST_ONLY_CORPUS" in err

    def test_every_problem_is_printed_not_just_the_first(self, run, tmp_path, model_dir):
        corpus = write_corpus(tmp_path / "c", {"a.md": doc(id="t.a", domain="D9"), "b.md": doc(id="t.b", timeframe="H1")})
        code, _, err = self.build(run, corpus, tmp_path, model_dir)
        assert code == 1 and "UNKNOWN_DOMAIN" in err and "UNKNOWN_TIMEFRAME" in err


class TestADamagedIndexExitsOne:
    @pytest.fixture
    def copy_of_index(self, built: BuildResult, tmp_path: Path) -> Path:
        target = tmp_path / "index"
        shutil.copytree(built.output_dir, target)
        return target

    def check(self, run, index: Path, model_dir: Path):
        return run("check", "--index", str(index), "--model-dir", str(model_dir))

    def test_no_index(self, run, tmp_path, model_dir):
        code, _, err = self.check(run, tmp_path / "missing", model_dir)
        assert code == 1 and "INDEX_MISSING" in err

    def test_a_changed_chunks_file(self, run, copy_of_index, model_dir):
        path = copy_of_index / CHUNKS_FILE
        path.write_bytes(path.read_bytes().replace(b"channel", b"chanel", 1))
        code, _, err = self.check(run, copy_of_index, model_dir)
        assert code == 1 and "CHUNKS_HASH" in err

    def test_a_missing_vector_file(self, run, copy_of_index, model_dir):
        (copy_of_index / "embeddings").unlink()
        code, _, err = self.check(run, copy_of_index, model_dir)
        assert code == 1 and "INDEX_CORRUPT" in err

    def test_vectors_that_no_longer_belong_to_their_chunks(self, run, copy_of_index, model_dir):
        """Everything loads and every count is right, but two chunks' content swapped ids: the self-retrieval sees it."""
        connection = sqlite3.connect(copy_of_index / "documents")
        try:
            rows = connection.execute("SELECT indexid, id FROM sections ORDER BY indexid LIMIT 2").fetchall()
            (i1, id1), (i2, id2) = rows
            connection.execute("UPDATE sections SET id = ? WHERE indexid = ?", (id2, i1))
            connection.execute("UPDATE sections SET id = ? WHERE indexid = ?", (id1, i2))
            connection.commit()
        finally:
            connection.close()
        code, _, err = self.check(run, copy_of_index, model_dir)
        assert code == 1 and "SELF_RETRIEVAL" in err

    def test_an_index_whose_scoring_is_not_normalised(self, run, copy_of_index, model_dir):
        saved = json.loads((copy_of_index / "config.json").read_text(encoding="utf-8"))
        saved["scoring"]["normalize"] = False
        (copy_of_index / "config.json").write_text(json.dumps(saved), encoding="utf-8")
        code, _, err = self.check(run, copy_of_index, model_dir)
        assert code == 1 and "SCORING_CONFIG" in err

    def test_a_missing_model(self, run, built, tmp_path):
        code, _, err = self.check(run, built.output_dir, tmp_path / "no-model")
        assert code == 1 and "MODEL_NOT_PINNED" in err


class TestTheCommandLine:
    def test_no_command_is_a_usage_error(self):
        with pytest.raises(SystemExit) as caught:
            main([])
        assert caught.value.code == 2

    def test_an_unknown_command_is_a_usage_error(self):
        with pytest.raises(SystemExit) as caught:
            main(["serve"])
        assert caught.value.code == 2

    def test_fetch_model_is_a_no_op_when_the_model_is_there(self, run, model_dir: Path):
        code, report, _ = run("fetch-model", "--model-dir", str(model_dir))
        assert code == 0 and report["ok"] is True and report["revision"] == "1110a243fdf4706b3f48f1d95db1a4f5529b4d41"
        assert report["seconds"] < 5

    def test_as_a_real_process(self, fixture_corpus: Path, built: BuildResult, tmp_path: Path, model_dir: Path):
        """`python -m knowledge.gate` as a Dockerfile step runs it: the exit code is what stops the image build."""
        env_dir = ["--model-dir", str(model_dir)]
        ok = subprocess.run(
            [sys.executable, "-m", "knowledge.gate", "check", "--index", str(built.output_dir), *env_dir],
            cwd=SERVICE_ROOT, capture_output=True, text=True, encoding="utf-8",
        )
        assert ok.returncode == 0, ok.stderr
        assert json.loads(ok.stdout)["ok"] is True

        bad_corpus = write_corpus(tmp_path / "bad", {"a.md": doc(domain="D9")})
        bad = subprocess.run(
            [sys.executable, "-m", "knowledge.gate", "build", "--corpus", str(bad_corpus), "--output", str(tmp_path / "o"), *env_dir],
            cwd=SERVICE_ROOT, capture_output=True, text=True, encoding="utf-8",
        )
        assert bad.returncode == 1
        assert "UNKNOWN_DOMAIN" in bad.stderr and "Traceback" not in bad.stderr
        assert bad.stdout.strip() == ""
