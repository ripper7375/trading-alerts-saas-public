"""The chunker: sections, merging, splitting and the two size limits (architecture 4.6 item 3, D11 (f))."""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from helpers import FILLER, doc
from knowledge.canonical import utf16_length
from knowledge.chunker import (
    CHUNK_ID_MAX,
    Section,
    chunk_document,
    slugify,
    split_sections,
)
from knowledge.config import ChunkerConfig
from knowledge.frontmatter import CHUNK_ID_RE, parse_document
from knowledge.model import TokenCounter
from knowledge.tags import Tags


def words(text: str) -> int:
    """A counter that counts words: it keeps the arithmetic of a test visible. The real one is tested below."""
    return len(text.split())


def sentence(n: int, count: int = 10) -> str:
    return f"S{n} " + " ".join(f"w{n}x{i}" for i in range(count - 1)) + "."


def paragraph(n: int, sentences: int, per_sentence: int = 10) -> str:
    return " ".join(sentence(n * 100 + i, per_sentence) for i in range(sentences))


def chunk(text: str, tags: Tags, *, config: ChunkerConfig, count=words, **front):
    document, problems = parse_document(doc(body=text, **front), "d.md", tags)
    assert problems == [], problems
    return chunk_document(document, config, count)


SMALL = ChunkerConfig(min_tokens=20, max_tokens=60, max_chars=4000)


class TestSections:
    def test_split_on_two_and_three_hashes_only(self):
        body = "preamble\n\n# Title\n\n## One\nuno\n### Sub\nsub\n#### Deeper\nstays\n## Two\ndos\n"
        sections = split_sections(body)
        assert [s.heading for s in sections] == [None, "One", "Sub", "Two"]
        assert "#### Deeper\nstays" in sections[2].text
        assert sections[1].text.startswith("## One")

    def test_a_heading_inside_a_code_fence_is_text(self):
        body = "## Real\nbefore\n```\n## not a heading\n```\nafter\n## Next\nx\n"
        sections = split_sections(body)
        assert [s.heading for s in sections] == ["Real", "Next"]
        assert "## not a heading" in sections[0].text

    def test_a_title_line_travels_with_the_first_section(self):
        sections = split_sections("# Title\n\n## One\nuno\n\n## Two\ndos\n")
        assert [s.heading for s in sections] == ["One", "Two"]
        assert sections[0].text.startswith("# Title\n\n## One")

    def test_text_before_the_first_heading_is_a_section_of_its_own(self):
        sections = split_sections("A real introduction paragraph.\n\n## One\nuno\n")
        assert [s.heading for s in sections] == [None, "One"]

    def test_empty_and_blank_bodies_make_no_section(self):
        assert split_sections("") == []
        assert split_sections("\n\n   \n") == []

    def test_trailing_white_space_is_removed_line_by_line(self):
        (section,) = split_sections("## One   \nline   \n")
        assert section.text == "## One\nline"


class TestSlugs:
    @pytest.mark.parametrize(
        ("heading", "slug"),
        [
            ("What a channel is", "what-a-channel-is"),
            ("  Five-minute breakout (above the band)!  ", "five-minute-breakout-above-the-band"),
            ("UOEDT / LOEDT", "uoedt-loedt"),
            ("Ünïcode héading", "n-code-h-ading"),
            ("通道", "section"),
            (None, "intro"),
        ],
    )
    def test_slugify(self, heading, slug):
        assert slugify(heading, 40) == slug

    def test_a_slug_is_cut_to_the_budget_without_a_trailing_dash(self):
        assert slugify("alpha beta gamma delta", 11) == "alpha-beta"
        assert len(slugify("x" * 100, 12)) == 12


class TestMerging:
    def test_small_sections_become_one_chunk_named_after_the_first_heading(self, tags: Tags):
        body = "## A\none two three\n\n## B\nfour five six\n\n### C\nseven eight\n"
        chunks, problems = chunk(body, tags, config=SMALL)
        assert problems == []
        assert [c.id for c in chunks] == ["t.doc.a"]
        assert all(h in chunks[0].text for h in ("## A", "## B", "### C"))

    def test_sections_over_the_minimum_stay_separate(self, tags: Tags):
        body = f"## A\n{paragraph(1, 3)}\n\n## B\n{paragraph(2, 3)}\n\n## C\n{paragraph(3, 3)}\n"
        chunks, _ = chunk(body, tags, config=SMALL)
        assert [c.id for c in chunks] == ["t.doc.a", "t.doc.b", "t.doc.c"]
        assert all(c.tokens >= SMALL.min_tokens for c in chunks)

    def test_a_small_section_joins_the_next_one(self, tags: Tags):
        body = f"## Small\nfew words here\n\n## Big\n{paragraph(1, 3)}\n"
        chunks, _ = chunk(body, tags, config=SMALL)
        assert [c.id for c in chunks] == ["t.doc.small"]
        assert "## Big" in chunks[0].text

    def test_a_small_last_section_joins_the_one_before(self, tags: Tags):
        body = f"## Big\n{paragraph(1, 3)}\n\n## Small\nfew words here\n"
        chunks, _ = chunk(body, tags, config=SMALL)
        assert [c.id for c in chunks] == ["t.doc.big"]
        assert chunks[0].text.endswith("few words here")

    def test_a_small_section_is_left_alone_when_the_join_would_not_fit(self, tags: Tags):
        # 55 + 5 words is over the 60 limit once the join and the heading are counted
        body = f"## Big\n{paragraph(1, 5, 11)}\n\n## Small\nfew words here\n"
        chunks, _ = chunk(body, tags, config=ChunkerConfig(min_tokens=20, max_tokens=58, max_chars=4000))
        assert [c.id for c in chunks] == ["t.doc.big", "t.doc.small"]

    def test_a_single_small_section_stays_as_it_is(self, tags: Tags):
        chunks, _ = chunk("## Only\nfew words\n", tags, config=SMALL)
        assert len(chunks) == 1 and chunks[0].tokens < SMALL.min_tokens

    def test_chunks_never_cross_a_document(self, tags: Tags):
        a, _ = chunk("## A\nshort\n", tags, config=SMALL, id="t.a")
        b, _ = chunk("## B\nshort\n", tags, config=SMALL, id="t.b")
        assert a[0].id == "t.a.a" and b[0].id == "t.b.b"


class TestSplitting:
    def test_a_section_over_the_token_limit_is_split_at_paragraphs(self, tags: Tags):
        body = "## Long\n\n" + "\n\n".join(paragraph(n, 3) for n in range(1, 7)) + "\n"
        chunks, problems = chunk(body, tags, config=SMALL)
        assert problems == []
        assert len(chunks) > 1
        assert all(c.tokens <= SMALL.max_tokens for c in chunks)
        # the heading opens every part, and the ids say which part it is
        assert all(c.text.startswith("# TEST ONLY") or c.text.startswith("## Long") for c in chunks)
        assert [c.id for c in chunks][:2] == ["t.doc.long", "t.doc.long-2"]

    def test_nothing_is_lost_and_the_order_is_kept(self, tags: Tags):
        paragraphs = [paragraph(n, 3) for n in range(1, 9)]
        chunks, _ = chunk("## Long\n\n" + "\n\n".join(paragraphs) + "\n", tags, config=SMALL)
        joined = "\n".join(c.text for c in chunks)
        positions = [joined.index(p) for p in paragraphs]
        assert positions == sorted(positions)
        assert all(p in joined for p in paragraphs)

    def test_a_paragraph_over_the_limit_is_split_at_sentences(self, tags: Tags):
        one = paragraph(1, 12)  # 120 words in one paragraph
        chunks, problems = chunk(f"## Long\n\n{one}\n", tags, config=SMALL)
        assert problems == [] and len(chunks) > 1
        assert all(c.tokens <= SMALL.max_tokens for c in chunks)
        assert all(sentence(100 + i) in "\n".join(c.text for c in chunks) for i in range(12))

    def test_a_sentence_over_the_limit_is_split_at_words(self, tags: Tags):
        one = "alpha " * 150
        chunks, problems = chunk(f"## Long\n\n{one}\n", tags, config=SMALL)
        assert problems == [] and len(chunks) > 1
        assert all(c.tokens <= SMALL.max_tokens for c in chunks)
        assert sum(c.text.count("alpha") for c in chunks) == 150

    def test_the_character_limit_binds_before_the_token_limit(self, tags: Tags):
        # 40 words of 12 letters: well under 60 tokens, over 400 characters
        text = " ".join(["abcdefghijkl"] * 40)
        chunks, _ = chunk(f"## Wide\n\n{text}\n", tags, config=ChunkerConfig(min_tokens=5, max_tokens=60, max_chars=300))
        assert len(chunks) > 1
        assert all(c.tokens <= 60 and c.chars <= 300 for c in chunks)

    def test_a_character_is_counted_as_javascript_counts_it(self, tags: Tags):
        # 3 emoji are 3 code points and 6 UTF-16 units; the packet measures with String.length
        assert utf16_length("\U0001f600" * 3) == 6
        text = "\U0001f600 " * 100
        chunks, _ = chunk(f"## Emoji\n\n{text}\n", tags, config=ChunkerConfig(min_tokens=5, max_tokens=1000, max_chars=120))
        assert len(chunks) > 1
        assert all(utf16_length(c.text) <= 120 for c in chunks)

    def test_a_fenced_block_is_not_cut_at_its_blank_lines_when_it_fits(self, tags: Tags):
        code = "```\nline one\n\nline two\n```"
        body = f"## Code\n\n{paragraph(1, 3)}\n\n{code}\n\n{paragraph(2, 3)}\n"
        chunks, _ = chunk(body, tags, config=SMALL)
        assert any(code in c.text for c in chunks)

    def test_the_chunk_records_its_tags_and_its_size(self, tags: Tags):
        chunks, _ = chunk(f"## A\n{paragraph(1, 3)}\n", tags, config=SMALL, domain="D3", timeframe="M5", version="3.2.1")
        (c,) = chunks
        assert (c.domain, c.timeframe, c.version, c.doc_id, c.path) == ("D3", "M5", "3.2.1", "t.doc", "d.md")
        assert c.tokens == words(c.text) and c.chars == len(c.text)


class TestChunkIds:
    def test_two_sections_with_the_same_heading_get_a_numbered_id(self, tags: Tags):
        body = f"## Same\n{paragraph(1, 3)}\n\n## Same\n{paragraph(2, 3)}\n\n## Same\n{paragraph(3, 3)}\n"
        chunks, _ = chunk(body, tags, config=SMALL)
        assert [c.id for c in chunks] == ["t.doc.same", "t.doc.same-2", "t.doc.same-3"]

    def test_text_with_no_heading_is_the_intro(self, tags: Tags):
        chunks, _ = chunk("Only a paragraph, no heading at all.\n", tags, config=SMALL)
        assert [c.id for c in chunks] == ["t.doc.intro"]

    def test_the_longest_document_id_still_gives_an_id_the_packet_accepts(self, tags: Tags):
        long_id = "d" * 64
        body = "\n\n".join(f"## {'very long heading ' * 5}{n}\n{paragraph(n, 3)}" for n in range(1, 5))
        chunks, _ = chunk(body + "\n", tags, config=SMALL, id=long_id)
        assert len(chunks) == 4
        for c in chunks:
            assert len(c.id) <= CHUNK_ID_MAX and CHUNK_ID_RE.match(c.id)
        assert len({c.id for c in chunks}) == 4

    def test_ids_match_the_packets_own_pattern(self, tags: Tags):
        packet_id = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$")
        body = "\n\n".join(f"## Heading number {n}!?\n{paragraph(n, 3)}" for n in range(1, 6))
        chunks, _ = chunk(body + "\n", tags, config=SMALL, id="a.b-c_d")
        assert all(packet_id.match(c.id) for c in chunks)

    def test_a_file_with_front_matter_but_no_text(self, tags: Tags):
        document, _ = parse_document(doc(body="\n\n"), "empty.md", tags)
        chunks, problems = chunk_document(document, SMALL, words)
        assert chunks == [] and [p.code for p in problems] == ["NO_TEXT"]


class TestTheRealTokenizer:
    def test_it_counts_word_pieces_without_truncating(self, counter: TokenCounter):
        long_text = " ".join(["channel"] * 700)
        assert counter.count(long_text) >= 700  # not cut at 128 or 512
        assert counter.window == 512

    def test_it_agrees_with_the_transformers_tokenizer(self, counter: TokenCounter, model_dir: Path):
        from transformers import AutoTokenizer

        reference = AutoTokenizer.from_pretrained(str(model_dir))
        for text in ["", "closed bars", FILLER, "UOEDT and LOEDT: 4,377.99 at 20:55 UTC", "naïve café — dash"]:
            assert counter.count(text) == len(reference.encode(text, add_special_tokens=False))

    def test_the_fixture_documents_chunk_as_designed(self, counter: TokenCounter, fixture_corpus: Path, tags: Tags, index_config):
        def chunks_of(rel: str):
            text = (fixture_corpus / rel).read_text(encoding="utf-8")
            document, problems = parse_document(text, rel, tags)
            assert problems == []
            made, problems = chunk_document(document, index_config.chunker, counter.count)
            assert problems == []
            return made

        long = chunks_of("d1/long-reference.md")
        assert [c.id for c in long] == ["t.d1.long.the-long-reference-list", "t.d1.long.the-long-reference-list-2"]
        assert all(c.chars <= 4000 and c.tokens <= 1500 for c in long)
        # the character limit is the one that binds: these parts are far under 1,500 tokens
        assert all(c.tokens < 1000 for c in long)
        assert all(c.text.startswith("# TEST ONLY") and "## The long reference list" in c.text for c in long)

        (tiny,) = chunks_of("d1/tiny.md")
        assert tiny.id == "t.d1.tiny.first-tiny-section"
        assert all(w in tiny.text for w in ("bar is one interval", "cycle is one pass", "reading is what a sensor"))

        two = chunks_of("d1/channel.md")
        assert [c.id for c in two] == ["t.d1.channel.what-a-channel-is", "t.d1.channel.the-closed-bar-rule"]
        assert all(c.tokens >= index_config.chunker.min_tokens for c in two)


def test_section_is_a_plain_value():
    assert Section("H", "## H\nx") == Section("H", "## H\nx")
