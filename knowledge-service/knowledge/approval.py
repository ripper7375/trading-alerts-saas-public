"""Approval of the corpus, one area at a time (plan part 7, ADR-042, decision D13 (b)).

Davin approves the knowledge corpus area by area: D1; each MCD's playbook (D2-MCD0 to D2-MCD3); later D3, D4 and D5. An
area is every corpus file of one domain, and for the playbooks (D2) every file of one sensor. Each area has one file under
`corpus/approval/`:

    {"schema": "corpus-approval/1", "area": "D2-MCD1", "status": "PENDING", "content_sha256": "...",
     "approved_by": null, "approved_at": null}

`content_sha256` is the hash of the area's files as they were reviewed (`area_hash`). The tool that writes the review tables
(`review.py`) writes the approval PENDING and never writes APPROVED: a person edits `status`, `approved_by` and
`approved_at`. A change to any file of the area after that makes the hash differ, and the approval is stale until it is
read again. The production build (`--require-approved`) refuses a corpus with a PENDING or stale area, or an area that has
no approval file at all; a development build only records what it found in the index's metadata.

The hash covers what a reader approves, the text of the files (line endings normalised, as for the build id), keyed by the
document id and not by the file name: moving or renaming a file does not undo an approval, editing a letter does.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping

from .canonical import normalize_text, sha256_hex, sha256_json
from .chunker import Chunk
from .config import PLAYBOOK_DOMAIN
from .errors import Problem

APPROVAL_SCHEMA = "corpus-approval/1"
PENDING = "PENDING"
APPROVED = "APPROVED"
STATUSES = (PENDING, APPROVED)
MISSING = "MISSING"  # in an index's metadata: the area has content and no approval file

APPROVAL_DIR = "approval"
REVIEW_DIR = "review"

FIELDS = ("schema", "area", "status", "content_sha256", "approved_by", "approved_at")
AREA_RE = re.compile(r"^D[1-9](?:-MCD(?:[0-9]|1[0-5]))?$")
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}(?:[T ][0-9:.+Zz-]+)?$")


def area_of(domain: str, mcd_id: str | None) -> str:
    """D1 is the area D1; a playbook (D2) is the area of its sensor, `D2-MCD1`."""
    if domain == PLAYBOOK_DOMAIN and mcd_id:
        return f"{domain}-{mcd_id}"
    return domain


@dataclass(frozen=True)
class Approval:
    area: str
    status: str
    content_sha256: str
    approved_by: str | None
    approved_at: str | None


def area_files(chunks: Iterable[Chunk]) -> dict[str, dict[str, str]]:
    """area -> {document id -> corpus-relative path}, from the chunks the corpus produced."""
    areas: dict[str, dict[str, str]] = {}
    for chunk in chunks:
        areas.setdefault(area_of(chunk.domain, chunk.mcd_id), {})[chunk.doc_id] = chunk.path
    return {area: dict(sorted(docs.items())) for area, docs in sorted(areas.items())}


def file_hash(corpus_dir: Path, rel: str) -> str:
    return sha256_hex(normalize_text((corpus_dir / rel).read_bytes().decode("utf-8")))


def area_hash(area: str, files: Mapping[str, str], corpus_dir: Path) -> str:
    """The `content_sha256` of an area: its documents (id and the hash of the normalised file text), in id order."""
    return sha256_json(
        {
            "schema": APPROVAL_SCHEMA,
            "area": area,
            "documents": [{"id": doc_id, "sha256": file_hash(corpus_dir, rel)} for doc_id, rel in sorted(files.items())],
        }
    )


def area_hashes(chunks: Iterable[Chunk], corpus_dir: Path) -> dict[str, str]:
    return {area: area_hash(area, files, corpus_dir) for area, files in area_files(chunks).items()}


# ---------------------------------------------------------------------------
# reading the approval files
# ---------------------------------------------------------------------------


def parse_approval(raw: object, where: str, stem: str) -> tuple[Approval | None, list[Problem]]:
    problems: list[Problem] = []

    def bad(message: str) -> None:
        problems.append(Problem(where, "APPROVAL_INVALID", message))

    if not isinstance(raw, dict):
        return None, [Problem(where, "APPROVAL_INVALID", "the file must hold a JSON object")]
    for key in raw:
        if key not in FIELDS:
            bad(f"unknown field {key!r}; the fields are {', '.join(FIELDS)}")
    for key in FIELDS:
        if key not in raw:
            bad(f"{key} is missing")
    if problems:
        return None, problems

    if raw["schema"] != APPROVAL_SCHEMA:
        bad(f"schema must be {APPROVAL_SCHEMA}")
    area = raw["area"]
    if not isinstance(area, str) or not AREA_RE.match(area):
        bad("area must look like D1 or D2-MCD1")
    elif area != stem:
        bad(f"area is {area!r} but the file is {stem}.json")
    status = raw["status"]
    if status not in STATUSES:
        bad(f"status must be {PENDING} or {APPROVED}")
    digest = raw["content_sha256"]
    if not isinstance(digest, str) or not SHA256_RE.match(digest):
        bad("content_sha256 must be 64 lower-case hex digits")
    by, at = raw["approved_by"], raw["approved_at"]
    if status == PENDING and (by is not None or at is not None):
        bad("a PENDING approval has approved_by and approved_at null")
    if status == APPROVED:
        if not isinstance(by, str) or not by.strip():
            bad("an APPROVED approval names who approved it (approved_by)")
        if not isinstance(at, str) or not DATE_RE.match(at):
            bad("an APPROVED approval has the date of approval (approved_at, YYYY-MM-DD)")
    if problems:
        return None, problems
    return Approval(area=area, status=status, content_sha256=digest, approved_by=by, approved_at=at), []


def load_approvals(corpus_dir: Path) -> tuple[dict[str, Approval], list[Problem]]:
    """Every approval file under `<corpus>/approval/`. A folder that does not exist holds none."""
    folder = corpus_dir / APPROVAL_DIR
    approvals: dict[str, Approval] = {}
    problems: list[Problem] = []
    if not folder.is_dir():
        return approvals, problems
    for path in sorted(folder.glob("*.json")):
        where = f"{APPROVAL_DIR}/{path.name}"
        try:
            raw = json.loads(normalize_text(path.read_bytes().decode("utf-8")))
        except (UnicodeDecodeError, ValueError) as error:
            problems.append(Problem(where, "APPROVAL_INVALID", f"not readable JSON: {error}"))
            continue
        approval, found = parse_approval(raw, where, path.stem)
        problems += found
        if approval is not None:
            approvals[approval.area] = approval
    return approvals, problems


def approval_text(approval: Approval) -> str:
    """The file as `review.py` writes it: fixed key order, two-space indent, LF, one final newline."""
    payload: dict[str, Any] = {
        "schema": APPROVAL_SCHEMA,
        "area": approval.area,
        "status": approval.status,
        "content_sha256": approval.content_sha256,
        "approved_by": approval.approved_by,
        "approved_at": approval.approved_at,
    }
    return json.dumps(payload, indent=2, ensure_ascii=False) + "\n"


# ---------------------------------------------------------------------------
# the gate
# ---------------------------------------------------------------------------


def check_approvals(
    hashes: Mapping[str, str], approvals: Mapping[str, Approval], parse_problems: Iterable[Problem] = ()
) -> list[Problem]:
    """Every reason the corpus is not approved. Empty when every area is APPROVED and unchanged since."""
    problems = list(parse_problems)
    for area, current in hashes.items():
        approval = approvals.get(area)
        if approval is None:
            problems.append(
                Problem(f"{APPROVAL_DIR}/{area}.json", "APPROVAL_MISSING", f"the area {area} has content and no approval file")
            )
            continue
        if approval.content_sha256 != current:
            problems.append(
                Problem(
                    f"{APPROVAL_DIR}/{area}.json",
                    "APPROVAL_STALE",
                    f"the files of {area} changed after the approval was recorded: run `gate review` and read them again",
                )
            )
        if approval.status != APPROVED:
            problems.append(
                Problem(f"{APPROVAL_DIR}/{area}.json", "APPROVAL_PENDING", f"{area} is {approval.status}, not {APPROVED}")
            )
    for area in approvals:
        if area not in hashes:
            problems.append(
                Problem(
                    f"{APPROVAL_DIR}/{area}.json",
                    "APPROVAL_WITHOUT_CONTENT",
                    f"{area} has an approval file and no corpus file: remove it, or restore the content",
                )
            )
    return problems


def approvals_summary(hashes: Mapping[str, str], approvals: Mapping[str, Approval]) -> dict[str, dict[str, Any]]:
    """What the index's metadata records for each area: its status, its hash, and whether the approval is current."""
    summary: dict[str, dict[str, Any]] = {}
    for area, current in hashes.items():
        approval = approvals.get(area)
        summary[area] = {
            "status": approval.status if approval else MISSING,
            "content_sha256": current,
            "approval_current": bool(approval and approval.content_sha256 == current),
        }
    return summary


def check_recorded_approvals(metadata: Mapping[str, Any], chunks: Mapping[str, Mapping[str, Any]]) -> list[Problem]:
    """`gate check --require-approved`: the index was built with every area APPROVED and unchanged since.

    An index holds no corpus files, so this reads what the build recorded. It also requires the record to cover every
    area the index's own chunks belong to, so a record cannot be made to pass by leaving an area out.
    """
    where = str(metadata.get("index_build_id", "index"))
    recorded = metadata.get("approvals")
    if not isinstance(recorded, dict) or not recorded:
        return [Problem(where, "APPROVAL_NOT_RECORDED", "the index records no approvals: build it from a corpus with approval files")]
    areas = {area_of(str(c["domain"]), c.get("mcd_id")) for c in chunks.values()}
    problems: list[Problem] = []
    for area in sorted(areas):
        entry = recorded.get(area)
        if not isinstance(entry, dict):
            problems.append(Problem(where, "APPROVAL_NOT_RECORDED", f"no approval recorded for the area {area}"))
            continue
        if entry.get("status") != APPROVED:
            problems.append(Problem(where, "APPROVAL_PENDING", f"{area} was {entry.get('status')} when the index was built"))
        if entry.get("approval_current") is not True:
            problems.append(Problem(where, "APPROVAL_STALE", f"the approval of {area} did not match its files when the index was built"))
    return problems
