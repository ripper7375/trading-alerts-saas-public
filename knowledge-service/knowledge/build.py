"""The build: a folder of Markdown becomes an index with a reproducible build id (architecture 4.6).

    corpus/*.md  ->  front matter + tags + chunk bounds + wording backstop  ->  txtai content + hybrid index

Every problem found is reported together, and nothing is written unless there is none. The build id is a hash of
everything that decides what the index answers: the chunks (ids, tags, text), the tag whitelist, the glossary version,
the model revision, the txtai version, the index configuration and the wording rules. The same inputs give the same id
on any machine; a Windows checkout (CRLF) and a Linux image (LF) agree because all text is normalised first.

A corpus folder holding a file named `TEST_ONLY` is a test corpus: its index says so in its metadata, and the production
build (`require_real=True`) refuses it. A test corpus is never mixed with the real `corpus/` folder.
"""

from __future__ import annotations

import json
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .canonical import normalize_text, sha256_hex, sha256_json
from .chunker import Chunk, TokenCount, chunk_document
from .config import IndexConfig
from .errors import BuildFailed, Problem
from .frontmatter import parse_document
from .index import (
    CHUNKS_FILE,
    METADATA_FILE,
    METADATA_SCHEMA,
    chunks_text,
    create_embeddings,
    load_index,
    txtai_version,
)
from .model import TokenCounter, require_model
from .tags import Tags
from .wording import WORDING_VERSION, check_chunk

TEST_ONLY_MARKER = "TEST_ONLY"
BUILD_SCHEMA = "index-build/1"
BUILD_ID_PREFIX = "kb-"
BUILD_ID_HEX = 32  # "kb-" + 32 hex digits = 35 characters; the packet accepts at most 40


@dataclass
class BuildResult:
    index_build_id: str
    chunk_count: int
    corpus_kind: str  # "REAL" or "TEST_ONLY"
    metadata: dict[str, Any]
    warnings: list[Problem] = field(default_factory=list)
    output_dir: Path | None = None


def corpus_files(corpus_dir: Path) -> list[Path]:
    """The Markdown files of a corpus, in a fixed order. `README.md` and files starting with `_` are not corpus."""
    files = [
        p
        for p in corpus_dir.rglob("*.md")
        if p.is_file() and p.name.lower() != "readme.md" and not p.name.startswith("_")
    ]
    return sorted(files, key=lambda p: p.relative_to(corpus_dir).as_posix())


def read_corpus(
    corpus_dir: Path, tags: Tags, config: IndexConfig, count: TokenCount
) -> tuple[list[Chunk], list[Problem]]:
    """Parse and chunk every file. Returns the chunks of the documents that parsed and every problem found."""
    chunks: list[Chunk] = []
    problems: list[Problem] = []
    doc_files: dict[str, str] = {}
    for path in corpus_files(corpus_dir):
        rel = path.relative_to(corpus_dir).as_posix()
        try:
            text = path.read_bytes().decode("utf-8")
        except UnicodeDecodeError as error:
            problems.append(Problem(rel, "NOT_UTF8", str(error)))
            continue
        document, found = parse_document(text, rel, tags)
        problems += found
        if document is None:
            continue
        if document.front_matter.id in doc_files:
            problems.append(
                Problem(rel, "DUPLICATE_ID", f"id {document.front_matter.id} is also the id of {doc_files[document.front_matter.id]}")
            )
            continue
        doc_files[document.front_matter.id] = rel
        made, found = chunk_document(document, config.chunker, count)
        chunks += made
        problems += found
    return chunks, problems


def check_chunks(chunks: list[Chunk], config: IndexConfig, window: int | None) -> tuple[list[Problem], list[Problem]]:
    """Checks across the whole corpus. Returns (problems, warnings)."""
    problems: list[Problem] = []
    warnings: list[Problem] = []
    ids = {c.id for c in chunks}
    per_document: dict[str, int] = {}
    for chunk in chunks:
        per_document[chunk.doc_id] = per_document.get(chunk.doc_id, 0) + 1
    seen: set[str] = set()
    dangling: set[tuple[str, str]] = set()
    for chunk in chunks:
        if chunk.id in seen:
            problems.append(Problem(chunk.id, "DUPLICATE_CHUNK_ID", f"made twice (from {chunk.path})"))
        seen.add(chunk.id)
        problems += check_chunk(chunk.id, chunk.text)
        for ref in chunk.related:
            # `related` is a list for the whole file: it is written once, so it is reported once
            if ref not in ids and (chunk.path, ref) not in dangling:
                dangling.add((chunk.path, ref))
                problems.append(Problem(chunk.path, "DANGLING_RELATED", f"{ref} is not a chunk of this corpus"))
        if per_document[chunk.doc_id] > 1 and chunk.tokens < config.chunker.min_tokens:
            warnings.append(
                Problem(chunk.id, "UNDERSIZED_CHUNK", f"{chunk.tokens} tokens, under {config.chunker.min_tokens}")
            )
        if window is not None and chunk.tokens > window:
            warnings.append(
                Problem(
                    chunk.id,
                    "OVER_DENSE_WINDOW",
                    f"{chunk.tokens} tokens: only the first {window} reach the dense vector, the keyword index sees all",
                )
            )
    return problems, warnings


def chunk_record(chunk: Chunk) -> dict[str, Any]:
    """The chunk as the sidecar (and the packet) holds it, plus what only the service needs."""
    return {
        "id": chunk.id,
        "domain": chunk.domain,
        "mcd_id": chunk.mcd_id,
        "state_codes": list(chunk.state_codes),
        "timeframe": chunk.timeframe,
        "version": chunk.version,
        "related": list(chunk.related),
        "text": chunk.text,
        "tokens": chunk.tokens,
    }


def build_id_payload(
    records: list[dict[str, Any]],
    *,
    tags: Tags,
    config: IndexConfig,
    glossary_version: str,
    txtai: str,
) -> dict[str, Any]:
    """Everything the build id is a hash of. Token counts are derived from the text and are left out."""
    return {
        "schema": BUILD_SCHEMA,
        "chunks": [{k: v for k, v in r.items() if k != "tokens"} for r in sorted(records, key=lambda r: r["id"])],
        "tags_sha256": tags.sha256,
        "glossary_version": glossary_version,
        "model": {"repo": config.model_repo, "revision": config.model_revision},
        "txtai_version": txtai,
        "index_config_sha256": config.sha256,
        "wording_version": WORDING_VERSION,
    }


def build_id_from_payload(payload: dict[str, Any]) -> tuple[str, str]:
    """(the id the packet carries, the full SHA-256 it is cut from)."""
    full = sha256_json(payload)
    return f"{BUILD_ID_PREFIX}{full[:BUILD_ID_HEX]}", full


def _is_index_dir(path: Path) -> bool:
    return (path / METADATA_FILE).is_file()


def build_index(
    corpus_dir: Path,
    output_dir: Path,
    *,
    tags: Tags,
    config: IndexConfig,
    glossary_version: str,
    model_dir: Path,
    counter: TokenCounter | None = None,
    require_real: bool = False,
) -> BuildResult:
    """Build the index of a corpus into `output_dir`. Raises BuildFailed (nothing written) on any problem."""
    corpus_dir, output_dir = Path(corpus_dir), Path(output_dir)
    if not corpus_dir.is_dir():
        raise BuildFailed([Problem(str(corpus_dir), "NO_CORPUS", "the corpus folder does not exist")])
    test_only = (corpus_dir / TEST_ONLY_MARKER).exists()
    if require_real and test_only:
        raise BuildFailed(
            [Problem(str(corpus_dir), "TEST_ONLY_CORPUS", f"holds a {TEST_ONLY_MARKER} marker: a test corpus is never built for production")]
        )
    # never empty a folder that is not an index of ours (`--output .` must not delete a checkout)
    if output_dir.exists() and any(output_dir.iterdir()) and not _is_index_dir(output_dir):
        raise BuildFailed([Problem(str(output_dir), "OUTPUT_NOT_AN_INDEX", "not empty and not an index: refusing to replace it")])

    require_model(config, model_dir)
    counter = counter or TokenCounter(model_dir)

    chunks, problems = read_corpus(corpus_dir, tags, config, counter.count)
    if not problems and not chunks:
        problems.append(Problem(str(corpus_dir), "NO_DOCUMENTS", "the corpus holds no Markdown file with text"))
    more, warnings = check_chunks(chunks, config, counter.window)
    problems += more
    if problems:
        raise BuildFailed(problems)

    chunks = sorted(chunks, key=lambda c: c.id)
    records = [chunk_record(c) for c in chunks]
    txtai = txtai_version()
    payload = build_id_payload(records, tags=tags, config=config, glossary_version=glossary_version, txtai=txtai)
    build_id, build_sha = build_id_from_payload(payload)

    staging = output_dir.with_name(output_dir.name + ".building")
    shutil.rmtree(staging, ignore_errors=True)
    staging.mkdir(parents=True)
    try:
        embeddings = create_embeddings(config, model_dir)
        embeddings.index(
            [
                (
                    c.id,
                    {
                        "text": c.text,
                        "domain": c.domain,
                        "mcd_id": c.mcd_id,
                        "timeframe": c.timeframe,
                        "version": c.version,
                    },
                    None,
                )
                for c in chunks
            ]
        )
        embeddings.save(str(staging))
        embeddings.close()

        sidecar = chunks_text(records)
        (staging / CHUNKS_FILE).write_bytes(sidecar.encode("utf-8"))
        domain_counts = {d: sum(1 for c in chunks if c.domain == d) for d in tags.domains}
        metadata = {
            "schema": METADATA_SCHEMA,
            "index_build_id": build_id,
            "index_build_sha256": build_sha,
            "corpus_kind": "TEST_ONLY" if test_only else "REAL",
            "chunk_count": len(chunks),
            "domains": domain_counts,
            "chunks_sha256": sha256_hex(normalize_text(sidecar)),
            "inputs": {
                "tags_sha256": tags.sha256,
                "glossary_version": glossary_version,
                "model": {"repo": config.model_repo, "revision": config.model_revision},
                "txtai_version": txtai,
                "index_config_sha256": config.sha256,
                "wording_version": WORDING_VERSION,
            },
            "settings": {
                "weights": config.weights,
                "candidates": config.candidates,
                "limit": config.limit,
                "normalize": True,
            },
            "embedding_window_tokens": counter.window,
            "warnings": [{"where": w.where, "code": w.code, "message": w.message} for w in sorted(warnings)],
        }
        (staging / METADATA_FILE).write_bytes((json.dumps(metadata, indent=2, sort_keys=True) + "\n").encode("utf-8"))

        # prove it before it replaces anything: it must load under the pins the service will check
        loaded = load_index(staging, config, model_dir)
        loaded.embeddings.close()
    except BaseException:
        shutil.rmtree(staging, ignore_errors=True)
        raise
    shutil.rmtree(output_dir, ignore_errors=True)
    staging.rename(output_dir)
    return BuildResult(
        index_build_id=build_id,
        chunk_count=len(chunks),
        corpus_kind=metadata["corpus_kind"],
        metadata=metadata,
        warnings=sorted(warnings),
        output_dir=output_dir,
    )
