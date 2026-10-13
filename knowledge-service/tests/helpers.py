"""Helpers shared by the test modules: small corpora written on the fly, and the packet contract."""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

import pytest

SERVICE_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = SERVICE_ROOT.parent
PACKET_SCHEMA = REPO_ROOT / "config" / "intake" / "intake-packet-1.schema.json"
PACKET_TS = REPO_ROOT / "lib" / "intake" / "packet.ts"

# The TEST ONLY corpus under the real chunk limit (450 tokens, part 7): its long reference splits into five parts.
FIXTURE_CHUNKS = 18
FIXTURE_DOMAINS = {"D1": 8, "D2": 5, "D3": 2, "D4": 2, "D5": 1}

# a body long enough to stand alone as a chunk of its own (over the 200-token merge threshold of the real settings)
FILLER = (
    "TEST ONLY. This sentence is plain filler for a fixture, written only so that a section has enough words to stay "
    "a chunk of its own after the merge rule. It says nothing about any market and repeats a few ordinary words "
    "about channels, corridors, bands, bars and readings so that the text looks like the real thing to a tokenizer. "
    "A second sentence continues in the same plain way, adding more ordinary words about sensors, cycles, states "
    "and the people who read them, because the merge threshold counts word pieces and not sentences. A third "
    "sentence closes the paragraph with a few more words about closed bars and the order in which they are read."
)


def front_matter(**fields: Any) -> str:
    """A front-matter block with the given fields. A value of the string `__skip__` leaves the field out."""
    values = {"id": "t.doc", "domain": "D1", "version": "1.0.0", **fields}
    lines = ["---"]
    for key, value in values.items():
        if value == "__skip__":
            continue
        if isinstance(value, list):
            lines.append(f"{key}:")
            lines += [f"  - {item}" for item in value]
        elif value is None:
            lines.append(f"{key}: null")
        else:
            lines.append(f"{key}: {value}")
    lines.append("---")
    return "\n".join(lines) + "\n"


def doc(body: str | None = None, **fields: Any) -> str:
    body = body if body is not None else f"# TEST ONLY: a document\n\n## A section\n\n{FILLER}\n"
    return front_matter(**fields) + "\n" + body


def write_corpus(root: Path, files: dict[str, str], *, test_only: bool = True) -> Path:
    """Write `files` (relative path -> text) under `root` and return it. LF line endings."""
    root.mkdir(parents=True, exist_ok=True)
    if test_only:
        (root / "TEST_ONLY").write_text("TEST ONLY\n", encoding="utf-8")
    for rel, text in files.items():
        path = root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(text.encode("utf-8"))
    return root


def copy_corpus(source: Path, target: Path, *, crlf: bool = False) -> Path:
    shutil.copytree(source, target)
    if crlf:
        for path in target.rglob("*.md"):
            path.write_bytes(path.read_bytes().replace(b"\r\n", b"\n").replace(b"\n", b"\r\n"))
    return target


# ---------------------------------------------------------------------------
# the packet's knowledge contract (lib/intake/packet.ts validateKnowledge)
# ---------------------------------------------------------------------------


def knowledge_schema() -> dict[str, Any]:
    """The `knowledge` definition of the monolith's packet schema, with its `$defs`, as a schema of its own."""
    if not PACKET_SCHEMA.is_file():
        pytest.skip("config/intake/intake-packet-1.schema.json is not beside the service")
    schema = json.loads(PACKET_SCHEMA.read_text(encoding="utf-8"))
    return {"$schema": schema["$schema"], "$ref": "#/$defs/knowledge", "$defs": schema["$defs"]}


def assert_knowledge_contract(body: Any, *, status: str | None = None) -> None:
    """What `validateKnowledge` accepts: the shared JSON Schema, plus the couplings a schema cannot say."""
    from jsonschema import Draft202012Validator

    validator = Draft202012Validator(knowledge_schema())
    errors = sorted(validator.iter_errors(body), key=lambda e: list(e.path))
    assert not errors, "; ".join(f"{list(e.path)}: {e.message}" for e in errors)
    assert isinstance(body, dict)
    if status is not None:
        assert body["status"] == status
    chunks, expansions = body["chunks"], body["expansions"]
    ids = [c["id"] for c in chunks + expansions]
    assert len(ids) == len(set(ids)), "a chunk id twice in one pack"
    if body["status"] == "OK":
        assert body["index_build_id"] is not None, "OK names the build"
        assert len(chunks) >= 1, "OK means at least one chunk"
    elif body["status"] == "EMPTY":
        assert body["index_build_id"] is not None, "EMPTY still names the build"
        assert chunks == [] and expansions == [], "EMPTY carries no chunk"
    else:
        assert body["index_build_id"] is None, "UNAVAILABLE names no build"
        assert chunks == [] and expansions == [], "UNAVAILABLE carries no chunk"
