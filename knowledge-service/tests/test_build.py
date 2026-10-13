"""The build: reproducible ids, refusals, and an index that loads only under its pins (architecture 4.6)."""

from __future__ import annotations

import copy
import json
import re
import shutil
from pathlib import Path

import pytest
import yaml

from helpers import FILLER, FIXTURE_CHUNKS, FIXTURE_DOMAINS, copy_corpus, doc, write_corpus
from knowledge.build import (
    BUILD_ID_HEX,
    TEST_ONLY_MARKER,
    BuildResult,
    build_id_from_payload,
    build_id_payload,
    build_index,
    chunk_record,
    corpus_files,
    read_corpus,
)
from knowledge.canonical import sha256_hex
from knowledge.config import CONFIG_DIR, IndexConfig, parse_index_config
from knowledge.errors import BuildFailed, IndexUnavailable
from knowledge.index import CHUNKS_FILE, METADATA_FILE, LoadedIndex, load_index, txtai_version
from knowledge.model import TokenCounter
from knowledge.tags import Tags

CORPUS_FIXTURE = Path(__file__).resolve().parent / "fixtures" / "corpus"

# the packet's own pattern for a version string, which the build id must satisfy (lib/intake/packet.ts VERSION)
PACKET_VERSION = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$")


def codes(error: BuildFailed) -> list[str]:
    return sorted(p.code for p in error.problems)


@pytest.fixture
def build_with(tags: Tags, index_config: IndexConfig, glossary_version: str, model_dir: Path, counter: TokenCounter):
    def run(corpus: Path, output: Path, **overrides) -> BuildResult:
        arguments = dict(
            tags=tags,
            config=index_config,
            glossary_version=glossary_version,
            model_dir=model_dir,
            counter=counter,
        )
        arguments.update(overrides)
        return build_index(corpus, output, **arguments)

    return run


def good(**fields) -> str:
    return doc(**fields)


class TestTheFixtureIndex:
    def test_it_is_built_with_an_id_the_packet_accepts(self, built: BuildResult):
        assert re.fullmatch(r"kb-[0-9a-f]{32}", built.index_build_id)
        assert len(built.index_build_id) == len("kb-") + BUILD_ID_HEX
        assert PACKET_VERSION.match(built.index_build_id)

    def test_the_metadata_says_what_was_built(self, built: BuildResult, index_config: IndexConfig, tags: Tags):
        meta = json.loads((built.output_dir / METADATA_FILE).read_text(encoding="utf-8"))
        assert meta["index_build_id"] == built.index_build_id
        assert meta["index_build_sha256"].startswith(built.index_build_id[3:])
        assert meta["corpus_kind"] == "TEST_ONLY" and built.corpus_kind == "TEST_ONLY"
        assert meta["chunk_count"] == built.chunk_count == FIXTURE_CHUNKS
        assert meta["domains"] == FIXTURE_DOMAINS
        assert meta["inputs"]["txtai_version"] == "9.5.0"
        assert meta["inputs"]["model"] == {"repo": index_config.model_repo, "revision": index_config.model_revision}
        assert meta["inputs"]["tags_sha256"] == tags.sha256
        assert meta["inputs"]["index_config_sha256"] == index_config.sha256
        assert meta["inputs"]["glossary_version"] == "1.0.0-draft"
        assert meta["settings"] == {"weights": 0.7, "candidates": 40, "limit": 4, "normalize": True}
        assert meta["embedding_window_tokens"] == 512
        assert "built_at" not in json.dumps(meta), "no time stamp: the same inputs write the same bytes"

    def test_every_chunk_fits_the_embedding_window_under_the_real_limit(self, built: BuildResult):
        """Part 7, reading 1: 450 tokens, so the whole of every chunk reaches the dense vector. No OVER_DENSE_WINDOW."""
        assert [w for w in built.warnings if w.code == "OVER_DENSE_WINDOW"] == []
        assert built.metadata["embedding_window_tokens"] == 512
        sidecar = json.loads((built.output_dir / CHUNKS_FILE).read_text(encoding="utf-8"))
        assert max(r["tokens"] for r in sidecar["chunks"]) <= 450 < 512

    def test_chunks_longer_than_the_embedding_window_are_a_warning_not_an_error(
        self, build_with, index_config: IndexConfig, tmp_path: Path
    ):
        """The warning still works when the limit is raised again (the 1,500 tokens of architecture 4.6 item 3)."""
        raw = copy.deepcopy(index_config.raw)
        raw["chunker"]["max_tokens"] = 1500
        wide = parse_index_config(raw)
        result = build_with(CORPUS_FIXTURE, tmp_path / "wide-index", config=wide)
        warned = {w.where for w in result.warnings if w.code == "OVER_DENSE_WINDOW"}
        assert warned == {"t.d1.long.the-long-reference-list", "t.d1.long.the-long-reference-list-2"}

    def test_the_files_are_there(self, built: BuildResult):
        names = {p.name for p in built.output_dir.iterdir()}
        assert {"config.json", "embeddings", "documents", "scoring", "scoring.terms", CHUNKS_FILE, METADATA_FILE} <= names
        assert not built.output_dir.with_name(built.output_dir.name + ".building").exists()

    def test_the_sidecar_holds_every_chunk_with_the_packets_fields(self, built: BuildResult):
        sidecar = json.loads((built.output_dir / CHUNKS_FILE).read_text(encoding="utf-8"))
        records = sidecar["chunks"]
        assert [r["id"] for r in records] == sorted(r["id"] for r in records)
        assert len(records) == FIXTURE_CHUNKS
        for r in records:
            assert {"id", "domain", "mcd_id", "state_codes", "timeframe", "version", "text", "related", "tokens"} == set(r)
            assert len(r["text"]) <= 4000 and r["tokens"] <= 450
        meta = json.loads((built.output_dir / METADATA_FILE).read_text(encoding="utf-8"))
        assert meta["chunks_sha256"] == sha256_hex((built.output_dir / CHUNKS_FILE).read_bytes().decode("utf-8"))

    def test_it_loads_under_every_pin(self, loaded: LoadedIndex, built: BuildResult):
        assert loaded.build_id == built.index_build_id
        assert loaded.embeddings.count() == FIXTURE_CHUNKS == len(loaded.chunks)
        assert loaded.embeddings.isdense() and loaded.embeddings.issparse()
        assert loaded.embeddings.scoring.isnormalized() is True


class TestReproducibility:
    def test_the_same_corpus_gives_the_same_id_and_the_same_files(self, build_with, built: BuildResult, fixture_corpus: Path, tmp_path: Path):
        again = build_with(fixture_corpus, tmp_path / "again")
        assert again.index_build_id == built.index_build_id
        assert (again.output_dir / CHUNKS_FILE).read_bytes() == (built.output_dir / CHUNKS_FILE).read_bytes()
        assert (again.output_dir / METADATA_FILE).read_bytes() == (built.output_dir / METADATA_FILE).read_bytes()

    def test_a_windows_checkout_with_crlf_gives_the_same_id(self, build_with, built: BuildResult, fixture_corpus: Path, tmp_path: Path):
        crlf = copy_corpus(fixture_corpus, tmp_path / "crlf-corpus", crlf=True)
        assert b"\r\n" in (crlf / "d1" / "channel.md").read_bytes()
        result = build_with(crlf, tmp_path / "crlf-index")
        assert result.index_build_id == built.index_build_id
        assert (result.output_dir / CHUNKS_FILE).read_bytes() == (built.output_dir / CHUNKS_FILE).read_bytes()

    def test_the_folder_and_the_file_names_do_not_matter(self, build_with, built: BuildResult, fixture_corpus: Path, tmp_path: Path):
        moved = copy_corpus(fixture_corpus, tmp_path / "moved")
        shutil.move(str(moved / "d1" / "channel.md"), str(moved / "d1" / "renamed-file.md"))
        assert build_with(moved, tmp_path / "moved-index").index_build_id == built.index_build_id

    def test_chunk_ids_are_stable(self, built: BuildResult, loaded: LoadedIndex):
        assert sorted(loaded.chunks) == [
            "t.d1.channel.the-closed-bar-rule",
            "t.d1.channel.what-a-channel-is",
            "t.d1.long.the-long-reference-list",
            "t.d1.long.the-long-reference-list-2",
            "t.d1.long.the-long-reference-list-3",
            "t.d1.long.the-long-reference-list-4",
            "t.d1.long.the-long-reference-list-5",
            "t.d1.tiny.first-tiny-section",
            "t.d2.mcd1.downtrend-inside-the-corridor",
            "t.d2.mcd1.sustained-breach-above-the-upper-band",
            "t.d2.mcd2.five-minute-breakout-above-the-upper-band",
            "t.d2.mcd3.bullish-value-position",
            "t.d2.mcd3.trend-conflict-between-the-two-timeframes",
            "t.d3.synthesis.counter-trend-rally",
            "t.d3.synthesis.when-the-synthesis-stands-aside",
            "t.d4.risk.half-risk-sizing-in-a-cautionary-reading",
            "t.d4.risk.the-stop-sits-behind-structure",
            "t.d5.governance.news-blackout-window",
        ]

    def test_one_changed_word_is_a_new_id(self, build_with, built: BuildResult, fixture_corpus: Path, tmp_path: Path):
        edited = copy_corpus(fixture_corpus, tmp_path / "edited")
        path = edited / "d4" / "risk.md"
        path.write_bytes(path.read_bytes().replace(b"half of the risk", b"a half of the risk", 1))
        assert build_with(edited, tmp_path / "edited-index").index_build_id != built.index_build_id

    def test_a_changed_tag_is_a_new_id(self, build_with, built: BuildResult, fixture_corpus: Path, tmp_path: Path):
        edited = copy_corpus(fixture_corpus, tmp_path / "retag")
        path = edited / "d4" / "risk.md"
        path.write_bytes(path.read_bytes().replace(b"timeframe: M15", b"timeframe: M5", 1))
        assert build_with(edited, tmp_path / "retag-index").index_build_id != built.index_build_id


class TestWhatTheBuildIdIsAHashOf:
    """Every input the order names changes the id; no build is needed to show it."""

    @pytest.fixture
    def parts(self, tags: Tags, index_config: IndexConfig, glossary_version: str, fixture_corpus: Path, counter: TokenCounter):
        chunks, problems = read_corpus(fixture_corpus, tags, index_config, counter.count)
        assert problems == []
        records = [chunk_record(c) for c in sorted(chunks, key=lambda c: c.id)]
        return dict(records=records, tags=tags, config=index_config, glossary_version=glossary_version, txtai=txtai_version())

    def id_of(self, parts) -> str:
        return build_id_from_payload(build_id_payload(**parts))[0]

    def test_it_is_the_same_for_the_same_inputs_in_any_order(self, parts):
        shuffled = dict(parts, records=list(reversed(parts["records"])))
        assert self.id_of(parts) == self.id_of(shuffled)

    def test_the_chunk_text(self, parts):
        records = copy.deepcopy(parts["records"])
        records[0]["text"] += " x"
        assert self.id_of(dict(parts, records=records)) != self.id_of(parts)

    def test_the_chunk_ids(self, parts):
        records = copy.deepcopy(parts["records"])
        records[0]["id"] += "-x"
        assert self.id_of(dict(parts, records=records)) != self.id_of(parts)

    def test_the_tag_whitelist(self, parts, tmp_path: Path):
        from knowledge.tags import load_tags

        registry = json.loads((CONFIG_DIR / "registry-codes.json").read_text(encoding="utf-8"))
        registry["state_codes"]["MCD1"].append("MCD1_ANOTHER")
        (tmp_path / "registry-codes.json").write_text(json.dumps(registry), encoding="utf-8")
        other = load_tags(CONFIG_DIR / "tags.yaml", tmp_path / "registry-codes.json")
        assert self.id_of(dict(parts, tags=other)) != self.id_of(parts)

    def test_the_glossary_version(self, parts):
        assert self.id_of(dict(parts, glossary_version="1.0.1")) != self.id_of(parts)

    def test_the_txtai_version(self, parts):
        assert self.id_of(dict(parts, txtai="9.4.0")) != self.id_of(parts)

    @pytest.mark.parametrize(
        "edit",
        [
            lambda raw: raw["model"].update(revision="0" * 40),
            lambda raw: raw["search"].update(weights=0.6),
            lambda raw: raw["search"].update(candidates=50),
            lambda raw: raw["chunker"].update(max_chars=3900),
            lambda raw: raw["search"]["intent_templates"].update(NEWS="other words"),
        ],
    )
    def test_the_model_revision_and_the_index_configuration(self, parts, edit):
        raw = yaml.safe_load((CONFIG_DIR / "index.yaml").read_text(encoding="utf-8"))
        edit(raw)
        assert self.id_of(dict(parts, config=parse_index_config(raw))) != self.id_of(parts)

    def test_the_wording_rules_version(self, parts, monkeypatch):
        before = self.id_of(parts)
        monkeypatch.setattr("knowledge.build.WORDING_VERSION", "wording-2")
        assert self.id_of(parts) != before

    def test_the_token_counts_are_derived_and_do_not_count(self, parts):
        records = copy.deepcopy(parts["records"])
        records[0]["tokens"] += 1
        assert self.id_of(dict(parts, records=records)) == self.id_of(parts)

    def test_the_id_is_the_front_of_the_full_hash(self, parts):
        build_id, full = build_id_from_payload(build_id_payload(**parts))
        assert build_id == "kb-" + full[:32] and len(full) == 64


class TestTheBuildRefuses:
    def test_an_unknown_state_code(self, build_with, tmp_path: Path):
        corpus = write_corpus(tmp_path / "c", {"a.md": good(state_codes=["MCD1_MADE_UP"])})
        with pytest.raises(BuildFailed) as caught:
            build_with(corpus, tmp_path / "out")
        assert codes(caught.value) == ["UNKNOWN_STATE_CODE"]
        assert not (tmp_path / "out").exists()

    def test_an_unknown_domain_mcd_id_and_timeframe_and_all_are_reported_together(self, build_with, tmp_path: Path):
        corpus = write_corpus(
            tmp_path / "c",
            {
                "a.md": good(id="t.a", domain="D9"),
                "b.md": good(id="t.b", mcd_id="MCD9"),
                "c.md": good(id="t.c", timeframe="H1"),
                "d.md": good(id="t.d", state_codes=["NOPE"]),
            },
        )
        with pytest.raises(BuildFailed) as caught:
            build_with(corpus, tmp_path / "out")
        assert codes(caught.value) == ["UNKNOWN_DOMAIN", "UNKNOWN_MCD_ID", "UNKNOWN_STATE_CODE", "UNKNOWN_TIMEFRAME"]
        assert {p.where for p in caught.value.problems} == {"a.md", "b.md", "c.md", "d.md"}

    def test_a_wording_backstop_match(self, build_with, tmp_path: Path):
        body = f"# TEST ONLY\n\n## A section\n\n{FILLER} This setup is guaranteed to win.\n"
        corpus = write_corpus(tmp_path / "c", {"a.md": doc(body=body)})
        with pytest.raises(BuildFailed) as caught:
            build_with(corpus, tmp_path / "out")
        assert codes(caught.value) == ["WORDING"]
        assert caught.value.problems[0].where == "t.doc.a-section"
        assert "guaranteed" in caught.value.problems[0].message

    def test_a_related_id_that_is_not_a_chunk(self, build_with, tmp_path: Path):
        corpus = write_corpus(tmp_path / "c", {"a.md": doc(related=["t.nowhere.at-all"])})
        with pytest.raises(BuildFailed) as caught:
            build_with(corpus, tmp_path / "out")
        assert codes(caught.value) == ["DANGLING_RELATED"]

    def test_a_related_id_that_exists_is_fine(self, build_with, tmp_path: Path):
        corpus = write_corpus(
            tmp_path / "c",
            {"a.md": doc(id="t.a", related=["t.b.a-section"]), "b.md": doc(id="t.b")},
        )
        assert build_with(corpus, tmp_path / "out").chunk_count == 2

    def test_two_files_with_the_same_id(self, build_with, tmp_path: Path):
        corpus = write_corpus(tmp_path / "c", {"a.md": doc(id="t.same"), "b.md": doc(id="t.same")})
        with pytest.raises(BuildFailed) as caught:
            build_with(corpus, tmp_path / "out")
        assert codes(caught.value) == ["DUPLICATE_ID"]

    def test_a_file_without_front_matter(self, build_with, tmp_path: Path):
        corpus = write_corpus(tmp_path / "c", {"a.md": "## No front matter\n\ntext\n"})
        with pytest.raises(BuildFailed) as caught:
            build_with(corpus, tmp_path / "out")
        assert codes(caught.value) == ["FRONT_MATTER_MISSING"]

    def test_a_file_that_is_not_utf8(self, build_with, tmp_path: Path):
        corpus = write_corpus(tmp_path / "c", {})
        (corpus / "a.md").write_bytes(b"---\nid: t.a\n---\n\xff\xfe broken\n")
        with pytest.raises(BuildFailed) as caught:
            build_with(corpus, tmp_path / "out")
        assert codes(caught.value) == ["NOT_UTF8"]

    def test_an_empty_corpus(self, build_with, tmp_path: Path):
        corpus = write_corpus(tmp_path / "c", {})
        with pytest.raises(BuildFailed) as caught:
            build_with(corpus, tmp_path / "out")
        assert codes(caught.value) == ["NO_DOCUMENTS"]

    def test_a_corpus_folder_that_does_not_exist(self, build_with, tmp_path: Path):
        with pytest.raises(BuildFailed) as caught:
            build_with(tmp_path / "missing", tmp_path / "out")
        assert codes(caught.value) == ["NO_CORPUS"]

    def test_readme_files_and_underscore_files_are_not_corpus(self, build_with, tmp_path: Path):
        corpus = write_corpus(tmp_path / "c", {"a.md": doc(id="t.a"), "README.md": "no front matter\n", "_notes.md": "none\n"})
        assert [p.name for p in corpus_files(corpus)] == ["a.md"]
        assert build_with(corpus, tmp_path / "out").chunk_count == 1

    def test_a_test_corpus_is_refused_for_production(self, build_with, fixture_corpus: Path, tmp_path: Path):
        with pytest.raises(BuildFailed) as caught:
            build_with(fixture_corpus, tmp_path / "out", require_real=True)
        assert codes(caught.value) == ["TEST_ONLY_CORPUS"]
        assert (fixture_corpus / TEST_ONLY_MARKER).is_file()

    def test_a_real_corpus_builds_for_production_and_says_so(self, build_with, tmp_path: Path):
        corpus = write_corpus(tmp_path / "real", {"a.md": doc(id="t.a")}, test_only=False)
        result = build_with(corpus, tmp_path / "out", require_real=True)
        assert result.corpus_kind == "REAL"
        assert json.loads((result.output_dir / METADATA_FILE).read_text(encoding="utf-8"))["corpus_kind"] == "REAL"

    def test_it_will_not_empty_a_folder_that_is_not_an_index(self, build_with, tmp_path: Path):
        corpus = write_corpus(tmp_path / "c", {"a.md": doc()})
        precious = tmp_path / "precious"
        precious.mkdir()
        (precious / "keep.txt").write_text("do not delete", encoding="utf-8")
        with pytest.raises(BuildFailed) as caught:
            build_with(corpus, precious)
        assert codes(caught.value) == ["OUTPUT_NOT_AN_INDEX"]
        assert (precious / "keep.txt").read_text(encoding="utf-8") == "do not delete"

    def test_a_failed_build_leaves_the_index_that_was_there(self, build_with, tmp_path: Path):
        good_corpus = write_corpus(tmp_path / "good", {"a.md": doc(id="t.a")})
        first = build_with(good_corpus, tmp_path / "out")
        bad_corpus = write_corpus(tmp_path / "bad", {"a.md": doc(id="t.a", domain="D9")})
        with pytest.raises(BuildFailed):
            build_with(bad_corpus, tmp_path / "out")
        meta = json.loads((tmp_path / "out" / METADATA_FILE).read_text(encoding="utf-8"))
        assert meta["index_build_id"] == first.index_build_id

    def test_a_good_rebuild_replaces_the_index(self, build_with, tmp_path: Path):
        corpus = write_corpus(tmp_path / "c", {"a.md": doc(id="t.a")})
        first = build_with(corpus, tmp_path / "out")
        write_corpus(tmp_path / "c", {"b.md": doc(id="t.b")}, test_only=False)
        second = build_with(corpus, tmp_path / "out")
        assert second.chunk_count == 2 and second.index_build_id != first.index_build_id

    def test_a_missing_model_is_not_downloaded_at_build(self, tags, index_config, glossary_version, tmp_path: Path):
        corpus = write_corpus(tmp_path / "c", {"a.md": doc()})
        with pytest.raises(IndexUnavailable) as caught:
            build_index(corpus, tmp_path / "out", tags=tags, config=index_config, glossary_version=glossary_version, model_dir=tmp_path / "no-model")
        assert caught.value.code == "MODEL_NOT_PINNED"


class TestAnIndexIsLoadedOnlyUnderItsPins:
    @pytest.fixture
    def copy_of_index(self, built: BuildResult, tmp_path: Path) -> Path:
        target = tmp_path / "index-copy"
        shutil.copytree(built.output_dir, target)
        return target

    def load(self, path: Path, index_config: IndexConfig, model_dir: Path) -> LoadedIndex:
        return load_index(path, index_config, model_dir)

    def test_a_good_copy_loads(self, copy_of_index, index_config, model_dir):
        loaded = self.load(copy_of_index, index_config, model_dir)
        assert loaded.embeddings.count() == FIXTURE_CHUNKS
        loaded.embeddings.close()

    def test_no_index_at_all(self, tmp_path: Path, index_config, model_dir):
        with pytest.raises(IndexUnavailable) as caught:
            self.load(tmp_path / "missing", index_config, model_dir)
        assert caught.value.code == "INDEX_MISSING"

    def test_a_chunks_file_that_is_not_the_one_built(self, copy_of_index, index_config, model_dir):
        path = copy_of_index / CHUNKS_FILE
        path.write_bytes(path.read_bytes().replace(b"channel", b"CHANNEL", 1))
        with pytest.raises(IndexUnavailable) as caught:
            self.load(copy_of_index, index_config, model_dir)
        assert caught.value.code == "CHUNKS_HASH"

    def test_a_missing_chunks_file(self, copy_of_index, index_config, model_dir):
        (copy_of_index / CHUNKS_FILE).unlink()
        with pytest.raises(IndexUnavailable) as caught:
            self.load(copy_of_index, index_config, model_dir)
        assert caught.value.code == "CHUNKS_MISSING"

    def test_a_damaged_txtai_file(self, copy_of_index, index_config, model_dir):
        (copy_of_index / "documents").write_bytes(b"not a database")
        with pytest.raises(IndexUnavailable) as caught:
            self.load(copy_of_index, index_config, model_dir)
        assert caught.value.code == "INDEX_CORRUPT"

    def test_a_missing_txtai_file(self, copy_of_index, index_config, model_dir):
        (copy_of_index / "embeddings").unlink()
        with pytest.raises(IndexUnavailable) as caught:
            self.load(copy_of_index, index_config, model_dir)
        assert caught.value.code == "INDEX_CORRUPT"

    def test_a_sidecar_with_a_chunk_the_index_does_not_hold(self, copy_of_index, index_config, model_dir):
        """Everything is consistent on paper (the count and the hash are re-written to match) but txtai holds one fewer."""
        from knowledge.index import chunks_text

        sidecar = json.loads((copy_of_index / CHUNKS_FILE).read_text(encoding="utf-8"))
        extra = dict(sidecar["chunks"][0], id="t.extra.chunk")
        records = sidecar["chunks"] + [extra]
        text = chunks_text(records)
        (copy_of_index / CHUNKS_FILE).write_bytes(text.encode("utf-8"))
        meta_path = copy_of_index / METADATA_FILE
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        meta["chunk_count"], meta["chunks_sha256"] = len(records), sha256_hex(text)
        meta_path.write_text(json.dumps(meta), encoding="utf-8")
        with pytest.raises(IndexUnavailable) as caught:
            self.load(copy_of_index, index_config, model_dir)
        assert caught.value.code == "INDEX_COUNT"

    def test_metadata_that_is_not_json(self, copy_of_index, index_config, model_dir):
        (copy_of_index / METADATA_FILE).write_text("{", encoding="utf-8")
        with pytest.raises(IndexUnavailable) as caught:
            self.load(copy_of_index, index_config, model_dir)
        assert caught.value.code == "METADATA_UNREADABLE"

    def test_a_build_id_the_packet_would_refuse(self, copy_of_index, index_config, model_dir):
        path = copy_of_index / METADATA_FILE
        meta = json.loads(path.read_text(encoding="utf-8"))
        meta["index_build_id"] = "x" * 80
        path.write_text(json.dumps(meta), encoding="utf-8")
        with pytest.raises(IndexUnavailable) as caught:
            self.load(copy_of_index, index_config, model_dir)
        assert caught.value.code == "METADATA_BUILD_ID"

    def test_settings_that_are_not_the_ones_it_was_built_with(self, copy_of_index, model_dir):
        raw = yaml.safe_load((CONFIG_DIR / "index.yaml").read_text(encoding="utf-8"))
        raw["search"]["weights"] = 0.6
        with pytest.raises(IndexUnavailable) as caught:
            self.load(copy_of_index, parse_index_config(raw), model_dir)
        assert caught.value.code == "CONFIG_CHANGED"

    def test_another_txtai_version(self, copy_of_index, index_config, model_dir):
        path = copy_of_index / METADATA_FILE
        meta = json.loads(path.read_text(encoding="utf-8"))
        meta["inputs"]["txtai_version"] = "9.4.0"
        path.write_text(json.dumps(meta), encoding="utf-8")
        with pytest.raises(IndexUnavailable) as caught:
            self.load(copy_of_index, index_config, model_dir)
        assert caught.value.code == "TXTAI_CHANGED"

    def test_an_index_whose_saved_scoring_is_not_normalised(self, copy_of_index, index_config, model_dir):
        path = copy_of_index / "config.json"
        saved = json.loads(path.read_text(encoding="utf-8"))
        assert saved["scoring"]["normalize"] is True
        saved["scoring"]["normalize"] = False
        path.write_text(json.dumps(saved), encoding="utf-8")
        with pytest.raises(IndexUnavailable) as caught:
            self.load(copy_of_index, index_config, model_dir)
        assert caught.value.code == "SCORING_CONFIG"

    def test_the_model_directory_of_the_build_machine_does_not_matter(self, copy_of_index, index_config, model_dir):
        saved = json.loads((copy_of_index / "config.json").read_text(encoding="utf-8"))
        saved["path"] = "C:/a/directory/that/does/not/exist/here"
        (copy_of_index / "config.json").write_text(json.dumps(saved), encoding="utf-8")
        loaded = self.load(copy_of_index, index_config, model_dir)  # this machine's directory wins
        assert loaded.embeddings.count() == FIXTURE_CHUNKS
        loaded.embeddings.close()
