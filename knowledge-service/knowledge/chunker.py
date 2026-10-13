"""Whole sections, merged and split by size (architecture 4.6 item 3, decision D11 (f)).

A document is cut at every `##` and `###` heading (not inside a code fence). Then:

  * a section over the limit is split at paragraph, then sentence, then word boundaries, the heading repeated on
    every part so a part still says what it is about;
  * a run of sections under `min_tokens` (200) is merged with its neighbours while the result stays inside the limit.

The limit is two limits: `max_tokens` (1,500, counted with the embedding model's own tokenizer) and `max_chars`
(4,000, the packet's own limit on one chunk: `KNOWLEDGE_CHUNK_MAX_CHARS`). For English prose 4,000 characters is
about 900 tokens, so the character limit is the one that binds; both are enforced so that neither can be exceeded.

Chunks never cross a document, so a chunk's tags are always its file's tags.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable

from .canonical import utf16_length
from .config import ChunkerConfig
from .errors import Problem
from .frontmatter import CHUNK_ID_RE, Document

TokenCount = Callable[[str], int]

_HEADING = re.compile(r"^(#{2,3})[ \t]+(.+?)[ \t]*#*[ \t]*$")
_FENCE = re.compile(r"^[ \t]*(```|~~~)")
_SENTENCE_END = re.compile(r"(?<=[.!?])\s+")
_SLUG_JUNK = re.compile(r"[^a-z0-9]+")

CHUNK_ID_MAX = 80  # the packet's limit on a chunk id
SUFFIX_RESERVE = 3  # room for "-NN" when two chunks of a document share a heading


@dataclass(frozen=True)
class Section:
    heading: str | None  # the heading text; None for text before the first heading
    text: str  # the heading line (if any) and the body, trimmed


@dataclass(frozen=True)
class Chunk:
    id: str
    doc_id: str
    path: str
    heading: str | None
    domain: str
    mcd_id: str | None
    state_codes: tuple[str, ...]
    timeframe: str | None
    version: str
    related: tuple[str, ...]
    text: str
    tokens: int
    chars: int


def split_sections(body: str) -> list[Section]:
    """Cut a Markdown body at its `##` and `###` headings. Empty text produces no section."""
    sections: list[Section] = []
    heading: str | None = None
    lines: list[str] = []
    in_fence = False

    def flush() -> None:
        text = "\n".join(lines).strip("\n")
        if text.strip():
            sections.append(Section(heading=heading, text=text))

    for line in body.split("\n"):
        line = line.rstrip()
        if _FENCE.match(line):
            in_fence = not in_fence
        match = None if in_fence else _HEADING.match(line)
        if match:
            flush()
            heading = match.group(2).strip()
            lines = [line]
        else:
            lines.append(line)
    flush()

    # A title line (`# ...`) before the first heading is not a section of its own: it travels with the first
    # section, so that section keeps its heading as the source of its chunk id.
    if len(sections) > 1 and sections[0].heading is None and _is_title_only(sections[0].text):
        first, second = sections[0], sections[1]
        sections[:2] = [Section(heading=second.heading, text=f"{first.text}\n\n{second.text}")]
    return sections


def _is_title_only(text: str) -> bool:
    lines = [ln for ln in text.split("\n") if ln.strip()]
    return len(lines) == 1 and lines[0].startswith("#")


def slugify(heading: str | None, budget: int) -> str:
    slug = _SLUG_JUNK.sub("-", (heading or "").lower()).strip("-")
    slug = slug[:budget].strip("-")
    return slug or ("intro" if heading is None else "section")


class _Limits:
    def __init__(self, config: ChunkerConfig, count: TokenCount):
        self.config = config
        self.count = count

    def fits(self, text: str) -> bool:
        return self.count(text) <= self.config.max_tokens and utf16_length(text) <= self.config.max_chars


def _pack(units: list[str], separator: str, prefix: str | None, limits: _Limits, next_level) -> list[str]:
    """Greedy packing of `units` into parts that fit, each part starting with `prefix` (the heading) when given."""
    parts: list[str] = []
    current: str | None = None  # text of the part being built, including the prefix

    def start(unit: str) -> str:
        return unit if not prefix else f"{prefix}\n\n{unit}"

    for unit in units:
        if current is not None:
            candidate = f"{current}{separator}{unit}"
            if limits.fits(candidate):
                current = candidate
                continue
            parts.append(current)
            current = None
        text = start(unit)
        if limits.fits(text):
            current = text
        else:
            # one unit alone is too big: break it at the next finer boundary
            finer = next_level(unit)
            if finer is None:
                raise ValueError("a unit cannot be split further")  # pragma: no cover - words always split
            parts.extend(finer)
    if current is not None:
        parts.append(current)
    return parts


def _split_text(text: str, prefix: str | None, limits: _Limits) -> list[str]:
    """Split one section's body so that every part, prefix included, fits."""
    if prefix is not None and not limits.fits(prefix):
        prefix = None  # a heading that is itself over the limit is not repeated

    def by_words(unit: str) -> list[str]:
        words = unit.split()
        out: list[str] = []
        current = ""
        for word in words:
            candidate = word if not current else f"{current} {word}"
            if not current or limits.fits(candidate if not prefix else f"{prefix}\n\n{candidate}"):
                current = candidate
            else:
                out.append(current if not prefix else f"{prefix}\n\n{current}")
                current = word
        if current:
            out.append(current if not prefix else f"{prefix}\n\n{current}")
        # a single word longer than the limit is cut by characters (nothing real has one)
        final: list[str] = []
        for part in out:
            while not limits.fits(part):
                cut = max(1, limits.config.max_chars // 2)
                final.append(part[:cut])
                part = part[cut:]
            final.append(part)
        return final

    def by_sentences(unit: str) -> list[str]:
        sentences = [s for s in _SENTENCE_END.split(unit) if s.strip()]
        if len(sentences) <= 1:
            return by_words(unit)
        return _pack(sentences, " ", prefix, limits, by_words)

    paragraphs = _paragraphs(text)
    return _pack(paragraphs, "\n\n", prefix, limits, by_sentences)


def _paragraphs(text: str) -> list[str]:
    """Blocks separated by blank lines; a fenced block is one block even if it holds blank lines."""
    blocks: list[str] = []
    current: list[str] = []
    in_fence = False
    for line in text.split("\n"):
        if _FENCE.match(line):
            in_fence = not in_fence
        if not line.strip() and not in_fence:
            if current:
                blocks.append("\n".join(current))
                current = []
        else:
            current.append(line)
    if current:
        blocks.append("\n".join(current))
    return blocks


def _split_section(section: Section, limits: _Limits) -> list[Section]:
    if limits.fits(section.text):
        return [section]
    lines = section.text.split("\n")
    heading_at = next((i for i, line in enumerate(lines) if _HEADING.match(line)), None)
    if section.heading is not None and heading_at is not None:
        # everything up to and including the heading line (a document title travels with it) opens every part
        prefix = "\n".join(lines[: heading_at + 1])
        body = "\n".join(lines[heading_at + 1 :]).strip("\n")
    else:
        prefix, body = None, section.text
    return [Section(heading=section.heading, text=part) for part in _split_text(body, prefix, limits)]


def _merge(sections: list[Section], limits: _Limits) -> list[Section]:
    """Merge neighbours while the chunk under construction is under `min_tokens` and the result still fits."""
    minimum = limits.config.min_tokens
    merged: list[Section] = []
    for section in sections:
        if merged and limits.count(merged[-1].text) < minimum:
            joined = f"{merged[-1].text}\n\n{section.text}"
            if limits.fits(joined):
                merged[-1] = Section(heading=merged[-1].heading or section.heading, text=joined)
                continue
        merged.append(section)
    # a small last chunk joins the one before it, if they fit together
    if len(merged) > 1 and limits.count(merged[-1].text) < minimum:
        joined = f"{merged[-2].text}\n\n{merged[-1].text}"
        if limits.fits(joined):
            merged[-2:] = [Section(heading=merged[-2].heading or merged[-1].heading, text=joined)]
    return merged


def chunk_document(document: Document, config: ChunkerConfig, count: TokenCount) -> tuple[list[Chunk], list[Problem]]:
    """The chunks of one document, in order, with ids `{doc id}.{slug of the first heading}`."""
    limits = _Limits(config, count)
    front = document.front_matter
    problems: list[Problem] = []

    sections: list[Section] = []
    for section in split_sections(document.body):
        sections.extend(_split_section(section, limits))
    sections = _merge(sections, limits)
    if not sections:
        return [], [Problem(document.path, "NO_TEXT", "the file has front matter but no text")]

    budget = CHUNK_ID_MAX - len(front.id) - 1 - SUFFIX_RESERVE
    used: dict[str, int] = {}
    chunks: list[Chunk] = []
    for section in sections:
        slug = slugify(section.heading, budget)
        used[slug] = used.get(slug, 0) + 1
        chunk_slug = slug if used[slug] == 1 else f"{slug}-{used[slug]}"
        chunk_id = f"{front.id}.{chunk_slug}"
        text = section.text
        tokens, chars = count(text), utf16_length(text)
        if not CHUNK_ID_RE.match(chunk_id):  # pragma: no cover - slugs are [a-z0-9-] and the budget is checked
            problems.append(Problem(document.path, "BAD_CHUNK_ID", chunk_id))
        if chars > config.max_chars or tokens > config.max_tokens:  # pragma: no cover - the splitter guarantees it
            problems.append(Problem(chunk_id, "CHUNK_TOO_LONG", f"{tokens} tokens, {chars} characters"))
        chunks.append(
            Chunk(
                id=chunk_id,
                doc_id=front.id,
                path=document.path,
                heading=section.heading,
                domain=front.domain,
                mcd_id=front.mcd_id,
                state_codes=front.state_codes,
                timeframe=front.timeframe,
                version=front.version,
                related=front.related,
                text=text,
                tokens=tokens,
                chars=chars,
            )
        )
    return chunks, problems
