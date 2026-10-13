"""The review tables and the PENDING approvals of a corpus (plan part 7, ADR-042).

    python -m knowledge.gate review --corpus corpus            writes corpus/review/_<area>.md and corpus/approval/<area>.json
    python -m knowledge.gate review --corpus corpus --check    writes nothing; exit 1 when either is stale

Davin approves the corpus one area at a time (D1; each MCD's playbook; later D3, D4, D5). For each area the tool writes:

  review/_<area>.md   the documents and every chunk with its id, heading, tokens, characters, the state codes it declares
                      and the source it was written from, and (for a playbook) which chunk covers each state code of the
                      registry. It holds CONTENT ONLY, never a status, so signing an approval makes no table stale. The
                      leading `_` keeps it out of the corpus (a review table is not a knowledge chunk).
  approval/<area>.json  the sign-off. Written PENDING and NEVER APPROVED: a person edits `status`, `approved_by` and
                      `approved_at`. It holds the hash of the files as they were reviewed; when a file changes the hash no
                      longer matches, and this tool puts the approval back to PENDING with the new hash.

The sources come from `corpus/source-map.json` (`corpus-source-map/1`): for every chunk id, the specification files and
sections it was written from. A chunk without a source is a review problem: there would be nothing to check it against.

Chunk bounds, tags and the wording backstop are the build's (`build.check_chunks`); this tool refuses to write a table for a
corpus the build would refuse.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping

from .approval import (
    APPROVAL_DIR,
    PENDING,
    REVIEW_DIR,
    Approval,
    approval_text,
    area_files,
    area_hash,
    load_approvals,
)
from .build import check_chunks, read_corpus
from .canonical import normalize_text
from .chunker import Chunk, TokenCount
from .config import IndexConfig
from .errors import Problem
from .tags import Tags

SOURCE_MAP_FILE = "source-map.json"
SOURCE_MAP_SCHEMA = "corpus-source-map/1"

# A playbook section opens with the state code it covers: **State code:** `MCD1_UP_IN_CORRIDOR`
_DECLARED = re.compile(r"^\*\*State code:\*\*[ \t]+`(MCD(?:[0-9]|1[0-5])_[A-Z0-9_]+)`", re.MULTILINE)


def declared_state_codes(text: str) -> tuple[str, ...]:
    """The state codes a chunk says it covers, in the order it says them."""
    return tuple(dict.fromkeys(_DECLARED.findall(text)))


@dataclass
class ReviewResult:
    problems: list[Problem] = field(default_factory=list)
    written: list[str] = field(default_factory=list)  # paths relative to the corpus folder, in the order written
    stale: list[str] = field(default_factory=list)  # --check: what differs
    areas: dict[str, dict[str, Any]] = field(default_factory=dict)  # area -> chunks, tokens, status


# ---------------------------------------------------------------------------
# the source map
# ---------------------------------------------------------------------------


def load_source_map(corpus_dir: Path) -> tuple[dict[str, list[tuple[str, str]]], list[Problem]]:
    """chunk id -> [(file, section), ...]. A missing file is an empty map; a malformed one is a problem."""
    path = corpus_dir / SOURCE_MAP_FILE
    if not path.is_file():
        return {}, []
    where = SOURCE_MAP_FILE
    try:
        raw = json.loads(normalize_text(path.read_bytes().decode("utf-8")))
    except (UnicodeDecodeError, ValueError) as error:
        return {}, [Problem(where, "SOURCE_MAP_INVALID", f"not readable JSON: {error}")]
    if not isinstance(raw, dict) or raw.get("schema") != SOURCE_MAP_SCHEMA or not isinstance(raw.get("sources"), dict):
        return {}, [Problem(where, "SOURCE_MAP_INVALID", f"must be {{schema: {SOURCE_MAP_SCHEMA}, sources: {{...}}}}")]
    problems: list[Problem] = []
    sources: dict[str, list[tuple[str, str]]] = {}
    for chunk_id, entries in raw["sources"].items():
        good = (
            isinstance(entries, list)
            and entries
            and all(
                isinstance(e, dict)
                and set(e) == {"file", "section"}
                and all(isinstance(e[k], str) and e[k].strip() for k in ("file", "section"))
                for e in entries
            )
        )
        if not good:
            problems.append(Problem(chunk_id, "SOURCE_MAP_INVALID", "a non-empty list of {file, section} strings"))
            continue
        sources[chunk_id] = [(e["file"], e["section"]) for e in entries]
    return sources, problems


# ---------------------------------------------------------------------------
# the tables
# ---------------------------------------------------------------------------


def _cell(text: str) -> str:
    return text.replace("|", "\\|").replace("\n", " ")


def source_cell(entries: list[tuple[str, str]] | None) -> str:
    """`MISSING`, or the sources grouped by file: `mcd1/mcd1.md` 1 Question; 6 Calculation. The folder and the name only."""
    if not entries:
        return "MISSING"
    grouped: dict[str, list[str]] = {}
    for file, section in entries:
        grouped.setdefault(file, []).append(section)
    return " ".join(
        f"`{'/'.join(file.split('/')[-2:])}`: {'; '.join(dict.fromkeys(sections))}." for file, sections in grouped.items()
    )


def _row(*cells: object) -> str:
    return "| " + " | ".join(_cell(str(c)) for c in cells) + " |"


def _table(header: tuple[str, ...], rows: list[tuple[object, ...]]) -> list[str]:
    lines = [_row(*header), "| " + " | ".join("---" for _ in header) + " |"]
    lines += [_row(*r) for r in rows]
    return lines


def review_text(
    area: str,
    chunks: list[Chunk],
    *,
    digest: str,
    config: IndexConfig,
    tags: Tags,
    sources: Mapping[str, list[tuple[str, str]]],
    warnings: list[Problem],
) -> str:
    """The review table of one area. Content only: nothing here changes when an approval is signed."""
    chunker = config.chunker
    docs: dict[str, list[Chunk]] = {}
    for chunk in chunks:
        docs.setdefault(chunk.doc_id, []).append(chunk)

    lines = [
        f"# Review table: {area}",
        "",
        f"Generated by `python -m knowledge.gate review --corpus corpus`. Do not edit: the tool compares this file with a fresh run.",
        f"It lists content only, never a status. The sign-off is `{APPROVAL_DIR}/{area}.json`.",
        "",
        f"- Area: `{area}`",
        f"- Content hash (`content_sha256` of the approval): `{digest}`",
        f"- Bounds: {chunker.min_tokens} to {chunker.max_tokens} tokens and at most {chunker.max_chars:,} characters per chunk",
        f"- Tokens are counted with the embedding model's own tokenizer: `{config.model_repo}` at `{config.model_revision}`",
        f"- Chunks: {len(chunks)}; tokens {min(c.tokens for c in chunks)} to {max(c.tokens for c in chunks)}; "
        f"most characters in one chunk: {max(c.chars for c in chunks):,}",
        f"- Sources come from `{SOURCE_MAP_FILE}` (paths are relative to the repository root; here the folder and the file name are shown)",
        "",
        "## Documents",
        "",
    ]
    lines += _table(
        ("Document id", "File", "MCD", "Timeframe", "Version", "Chunks", "Tags: state codes", "Related"),
        [
            (
                doc_id,
                f"`{group[0].path}`",
                group[0].mcd_id or "none",
                group[0].timeframe or "none",
                group[0].version,
                len(group),
                len(group[0].state_codes),
                ", ".join(group[0].related) or "none",
            )
            for doc_id, group in docs.items()
        ],
    )
    lines += ["", "## Chunks", ""]
    rows: list[tuple[object, ...]] = []
    for number, chunk in enumerate(chunks, start=1):
        declared = declared_state_codes(chunk.text)
        rows.append(
            (
                number,
                f"`{chunk.id}`",
                chunk.heading or "(no heading)",
                chunk.tokens,
                chunk.chars,
                ", ".join(f"`{c}`" for c in declared) or "none",
                source_cell(sources.get(chunk.id)),
            )
        )
    lines += _table(("#", "Chunk id", "Heading", "Tokens", "Characters", "State codes declared", "Source"), rows)

    mcd_ids = {c.mcd_id for c in chunks if c.mcd_id}
    if len(mcd_ids) == 1:
        (mcd_id,) = mcd_ids
        covering: dict[str, list[str]] = {}
        for chunk in chunks:
            for code in declared_state_codes(chunk.text):
                covering.setdefault(code, []).append(chunk.id)
        lines += ["", f"## State coverage: {mcd_id}", ""]
        lines += _table(
            ("State code", "Chunk"),
            [
                (f"`{code}`", ", ".join(f"`{i}`" for i in covering.get(code, [])) or "NOT COVERED")
                for code in tags.state_codes[mcd_id]
            ],
        )

    lines += ["", "## Warnings", ""]
    lines += [f"- {w}" for w in warnings] or ["None."]
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# the run
# ---------------------------------------------------------------------------


def run_review(
    corpus_dir: Path,
    *,
    tags: Tags,
    config: IndexConfig,
    count: TokenCount,
    window: int | None = None,
    write: bool,
    require_sources: bool = True,
) -> ReviewResult:
    """Write (or, with `write=False`, check) the review tables and the approval files of every area of `corpus_dir`."""
    corpus_dir = Path(corpus_dir)
    result = ReviewResult()
    if not corpus_dir.is_dir():
        result.problems.append(Problem(str(corpus_dir), "NO_CORPUS", "the corpus folder does not exist"))
        return result

    chunks, problems = read_corpus(corpus_dir, tags, config, count)
    more, warnings = check_chunks(chunks, config, window)
    problems += more
    sources, source_problems = load_source_map(corpus_dir)
    problems += source_problems
    approvals, approval_problems = load_approvals(corpus_dir)
    problems += approval_problems
    if not problems and not chunks:
        problems.append(Problem(str(corpus_dir), "NO_DOCUMENTS", "the corpus holds no Markdown file with text"))
    known = {c.id for c in chunks}
    for chunk_id in sorted(set(sources) - known):
        problems.append(Problem(chunk_id, "SOURCE_MAP_UNKNOWN_CHUNK", "the source map names a chunk the corpus does not have"))
    if require_sources:
        for chunk in chunks:
            if chunk.id not in sources:
                problems.append(Problem(chunk.id, "SOURCE_MISSING", "no entry in source-map.json: say what it was written from"))
    if problems:
        result.problems = sorted(problems)
        return result

    by_area = area_files(chunks)
    for area, files in by_area.items():
        area_chunks = [c for c in chunks if c.doc_id in files]
        digest = area_hash(area, files, corpus_dir)
        text = review_text(
            area,
            area_chunks,
            digest=digest,
            config=config,
            tags=tags,
            sources=sources,
            warnings=[w for w in warnings if w.where in {c.id for c in area_chunks}],
        )

        previous = approvals.get(area)
        if previous is not None and previous.content_sha256 == digest:
            approval = previous  # unchanged since it was recorded: keep PENDING or APPROVED exactly as signed
        else:
            approval = Approval(area=area, status=PENDING, content_sha256=digest, approved_by=None, approved_at=None)

        # the table is compared as text; the approval by what it says, so a person's own formatting of the JSON is left alone
        table_rel, approval_rel = f"{REVIEW_DIR}/_{area}.md", f"{APPROVAL_DIR}/{area}.json"
        table_path = corpus_dir / table_rel
        table_now = normalize_text(table_path.read_bytes().decode("utf-8")) if table_path.is_file() else None
        approval_now = approvals.get(area)
        for rel, same, content, now in (
            (table_rel, table_now == text, text, table_now),
            (approval_rel, approval_now == approval, approval_text(approval), approval_now),
        ):
            if same:
                continue
            if write:
                path = corpus_dir / rel
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(content.encode("utf-8"))
                result.written.append(rel)
            else:
                result.stale.append(rel)
                code = "REVIEW_STALE" if rel == table_rel else "APPROVAL_STALE"
                what = "missing" if now is None else "differs from a fresh run"
                result.problems.append(Problem(rel, code, f"{what}: run `gate review --corpus {corpus_dir.name}`"))
        result.areas[area] = {
            "chunks": len(area_chunks),
            "status": approval.status,
            "reset_to_pending": previous is not None and previous.content_sha256 != digest and previous.status != PENDING,
        }

    for area in sorted(set(approvals) - set(by_area)):
        result.problems.append(
            Problem(f"{APPROVAL_DIR}/{area}.json", "APPROVAL_WITHOUT_CONTENT", f"{area} has an approval file and no corpus file")
        )
    result.problems = sorted(result.problems)
    return result
