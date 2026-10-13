"""Front matter of a corpus file (architecture 4.6 item 1).

A corpus file is Markdown that starts with a YAML block between two `---` lines:

    ---
    id: d2.mcd1.playbook
    domain: D2
    mcd_id: MCD1
    state_codes: [MCD1_UP_IN_CORRIDOR, MCD1_UP_UPPER_BREAKOUT]
    timeframe: M15
    version: 1.0.0
    related: [d1.channel.what-is-a-channel]
    ---

The block describes the whole file; every chunk made from it inherits the tags. Nothing is guessed: an unknown key,
a value of the wrong type or one that the whitelist does not list is a problem, and all problems of a file are
reported together.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

import yaml

from .canonical import normalize_text
from .errors import Problem
from .tags import Tags, check_tag_values

# A document id starts with a letter or digit: the chunk ids built from it must pass the packet's own pattern
# (lib/intake/packet.ts ID: `^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$`), or the whole pack would be refused at the monolith.
ID_RE = re.compile(r"^[a-z0-9][a-z0-9_.-]{0,63}$")
CHUNK_ID_RE = re.compile(r"^[a-z0-9][a-z0-9_.-]{0,79}$")
VERSION_RE = re.compile(r"^[0-9]+\.[0-9]+\.[0-9]+$")

STATE_CODES_MAX = 16  # the packet's limit on one chunk
RELATED_MAX = 16

REQUIRED = ("id", "domain", "version")
OPTIONAL = ("mcd_id", "state_codes", "timeframe", "related")
KNOWN = REQUIRED + OPTIONAL


@dataclass(frozen=True)
class FrontMatter:
    id: str
    domain: str
    mcd_id: str | None
    state_codes: tuple[str, ...]
    timeframe: str | None
    version: str
    related: tuple[str, ...]


@dataclass(frozen=True)
class Document:
    path: str  # relative to the corpus folder, with forward slashes
    front_matter: FrontMatter
    body: str  # Markdown after the front matter, LF line endings


class _StrictLoader(yaml.SafeLoader):
    """SafeLoader that refuses a mapping with the same key twice (PyYAML keeps the last one without a word)."""


def _construct_mapping(loader: _StrictLoader, node: yaml.MappingNode, deep: bool = False) -> dict[Any, Any]:
    seen: set[Any] = set()
    for key_node, _ in node.value:
        key = loader.construct_object(key_node, deep=deep)
        try:
            duplicate = key in seen
        except TypeError as error:  # an unhashable key
            raise yaml.constructor.ConstructorError(None, None, f"unhashable key {key!r}", key_node.start_mark) from error
        if duplicate:
            raise yaml.constructor.ConstructorError(None, None, f"duplicate key {key!r}", key_node.start_mark)
        seen.add(key)
    return yaml.SafeLoader.construct_mapping(loader, node, deep)


_StrictLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, _construct_mapping)

_FENCE = re.compile(r"^---[ \t]*$")


def split_front_matter(text: str, where: str) -> tuple[dict[str, Any] | None, str, list[Problem]]:
    """The parsed front-matter mapping, the body, and the problems found splitting and parsing."""
    text = normalize_text(text)
    lines = text.split("\n")
    if not lines or not _FENCE.match(lines[0]):
        return None, text, [Problem(where, "FRONT_MATTER_MISSING", "the file must start with a --- line")]
    end = next((i for i in range(1, len(lines)) if _FENCE.match(lines[i])), None)
    if end is None:
        return None, text, [Problem(where, "FRONT_MATTER_UNCLOSED", "no closing --- line")]
    block = "\n".join(lines[1:end])
    body = "\n".join(lines[end + 1 :])
    try:
        parsed = yaml.load(block, Loader=_StrictLoader)  # noqa: S506 - the loader is a SafeLoader
    except yaml.YAMLError as error:
        return None, body, [Problem(where, "FRONT_MATTER_YAML", str(error).replace("\n", " "))]
    if not isinstance(parsed, dict):
        return None, body, [Problem(where, "FRONT_MATTER_NOT_A_MAPPING", "the block must be a mapping")]
    return parsed, body, []


def _string_list(value: object, key: str, where: str, maximum: int, problems: list[Problem]) -> tuple[str, ...]:
    if value is None:
        return ()
    if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
        problems.append(Problem(where, "BAD_TYPE", f"{key} must be a list of strings"))
        return ()
    if len(value) > maximum:
        problems.append(Problem(where, "TOO_MANY", f"{key} has {len(value)} entries, at most {maximum}"))
    return tuple(value)


def parse_front_matter(raw: dict[str, Any], tags: Tags, where: str) -> tuple[FrontMatter | None, list[Problem]]:
    """Validate a parsed block. Returns the front matter (None when it is unusable) and every problem found."""
    problems: list[Problem] = []

    for key in raw:
        if key not in KNOWN:
            problems.append(Problem(where, "UNKNOWN_FIELD", f"{key!r}; the fields are {', '.join(KNOWN)}"))
    for key in REQUIRED:
        if key not in raw or raw[key] is None:
            problems.append(Problem(where, "MISSING_FIELD", f"{key} is required"))

    doc_id = raw.get("id")
    if doc_id is not None and (not isinstance(doc_id, str) or not ID_RE.match(doc_id)):
        problems.append(Problem(where, "BAD_ID", "id must match ^[a-z0-9][a-z0-9_.-]{0,63}$"))
        doc_id = None
    version = raw.get("version")
    if version is not None and (not isinstance(version, str) or not VERSION_RE.match(version)):
        problems.append(Problem(where, "BAD_VERSION", "version must be a string like 1.0.0 (quote it in YAML)"))
        version = None

    mcd_id = raw.get("mcd_id")
    timeframe = raw.get("timeframe")
    state_codes = _string_list(raw.get("state_codes"), "state_codes", where, STATE_CODES_MAX, problems)
    related = _string_list(raw.get("related"), "related", where, RELATED_MAX, problems)

    problems += check_tag_values(
        tags,
        where=where,
        # a missing domain is already MISSING_FIELD above; do not report it a second time as an unknown value
        domain=raw["domain"] if raw.get("domain") is not None else tags.domains[0],
        mcd_id=mcd_id,
        state_codes=list(state_codes),
        timeframe=timeframe,
    )

    domain = raw.get("domain")
    if domain == "D2" and mcd_id is None:
        problems.append(
            Problem(where, "D2_NEEDS_MCD_ID", "a playbook chunk without mcd_id could never be found: D2 is scoped by mcd_id")
        )

    seen_related: set[str] = set()
    for ref in related:
        if not CHUNK_ID_RE.match(ref):
            problems.append(Problem(where, "BAD_RELATED", f"{ref!r} is not a chunk id"))
        elif ref in seen_related:
            problems.append(Problem(where, "DUPLICATE_RELATED", f"{ref} is listed twice"))
        seen_related.add(ref)

    if problems or not isinstance(domain, str) or doc_id is None or version is None:
        return None, problems
    return (
        FrontMatter(
            id=doc_id,
            domain=domain,
            mcd_id=mcd_id,
            state_codes=state_codes,
            timeframe=timeframe,
            version=version,
            related=related,
        ),
        problems,
    )


def parse_document(text: str, path: str, tags: Tags) -> tuple[Document | None, list[Problem]]:
    """A whole corpus file: split, parse, validate."""
    raw, body, problems = split_front_matter(text, path)
    if raw is None:
        return None, problems
    front_matter, more = parse_front_matter(raw, tags, path)
    problems = problems + more
    if front_matter is None:
        return None, problems
    return Document(path=path, front_matter=front_matter, body=body), problems
