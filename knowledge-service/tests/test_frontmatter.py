"""Front matter: what a corpus file may say about itself, and what is refused (architecture 4.6 item 1)."""

from __future__ import annotations

import pytest

from helpers import doc, front_matter
from knowledge.frontmatter import ID_RE, VERSION_RE, parse_document, split_front_matter
from knowledge.tags import Tags

FULL = front_matter(
    id="t.d2.mcd1",
    domain="D2",
    mcd_id="MCD1",
    state_codes=["MCD1_UP_IN_CORRIDOR", "MCD1_UP_UPPER_BREAKOUT"],
    timeframe="M15",
    version="2.1.0",
    related=["t.d1.channel.what-a-channel-is"],
)


def parse(text: str, tags: Tags):
    return parse_document(text, "x/y.md", tags)


def codes(problems) -> list[str]:
    return sorted(p.code for p in problems)


class TestAValidFile:
    def test_every_field_is_read(self, tags: Tags):
        document, problems = parse(FULL + "\n## A\n\ntext\n", tags)
        assert problems == []
        front = document.front_matter
        assert front.id == "t.d2.mcd1"
        assert front.domain == "D2"
        assert front.mcd_id == "MCD1"
        assert front.state_codes == ("MCD1_UP_IN_CORRIDOR", "MCD1_UP_UPPER_BREAKOUT")
        assert front.timeframe == "M15"
        assert front.version == "2.1.0"
        assert front.related == ("t.d1.channel.what-a-channel-is",)
        assert document.path == "x/y.md"
        assert document.body.lstrip("\n") == "## A\n\ntext\n"

    def test_only_id_domain_and_version_are_required(self, tags: Tags):
        document, problems = parse(front_matter() + "body\n", tags)
        assert problems == []
        front = document.front_matter
        assert (front.mcd_id, front.state_codes, front.timeframe, front.related) == (None, (), None, ())

    def test_crlf_and_a_byte_order_mark_read_the_same(self, tags: Tags):
        plain, _ = parse(FULL + "\nbody\n", tags)
        crlf, problems = parse("﻿" + (FULL + "\nbody\n").replace("\n", "\r\n"), tags)
        assert problems == []
        assert crlf == plain

    def test_an_explicit_null_mcd_id_is_none(self, tags: Tags):
        document, problems = parse(front_matter(mcd_id=None) + "body\n", tags)
        assert problems == [] and document.front_matter.mcd_id is None

    def test_a_dashes_line_inside_the_body_is_not_the_end(self, tags: Tags):
        document, problems = parse(front_matter() + "\nabove\n\n---\n\nbelow\n", tags)
        assert problems == []
        assert "---" in document.body and "below" in document.body


class TestTheShapeOfTheFile:
    def test_no_front_matter(self, tags: Tags):
        document, problems = parse("## Just a heading\n\ntext\n", tags)
        assert document is None
        assert codes(problems) == ["FRONT_MATTER_MISSING"]

    def test_a_front_matter_that_never_closes(self, tags: Tags):
        _, problems = parse("---\nid: a\ndomain: D1\nversion: 1.0.0\n", tags)
        assert codes(problems) == ["FRONT_MATTER_UNCLOSED"]

    def test_broken_yaml(self, tags: Tags):
        _, problems = parse("---\nid: [unclosed\n---\nbody\n", tags)
        assert codes(problems) == ["FRONT_MATTER_YAML"]

    def test_a_front_matter_that_is_not_a_mapping(self, tags: Tags):
        _, problems = parse("---\n- a\n- b\n---\nbody\n", tags)
        assert codes(problems) == ["FRONT_MATTER_NOT_A_MAPPING"]

    def test_an_empty_front_matter(self, tags: Tags):
        _, problems = parse("---\n---\nbody\n", tags)
        assert codes(problems) == ["FRONT_MATTER_NOT_A_MAPPING"]

    def test_a_key_written_twice(self, tags: Tags):
        _, problems = parse("---\nid: a\nid: b\ndomain: D1\nversion: 1.0.0\n---\nbody\n", tags)
        assert codes(problems) == ["FRONT_MATTER_YAML"]
        assert "duplicate key" in problems[0].message

    def test_split_returns_the_mapping_and_the_body(self):
        raw, body, problems = split_front_matter("---\nid: a\n---\nhello\n", "f.md")
        assert raw == {"id": "a"} and body == "hello\n" and problems == []


class TestTheFields:
    def test_an_unknown_field_is_refused_so_a_typo_cannot_hide(self, tags: Tags):
        document, problems = parse(doc(state_code="x"), tags)
        assert document is None
        assert "UNKNOWN_FIELD" in codes(problems)

    @pytest.mark.parametrize("missing", ["id", "domain", "version"])
    def test_a_missing_required_field(self, tags: Tags, missing):
        document, problems = parse(doc(**{missing: "__skip__"}), tags)
        assert document is None
        assert codes(problems) == ["MISSING_FIELD"]

    @pytest.mark.parametrize(
        "bad",
        ["Upper", "-leading", "_leading", ".leading", "has space", "a" * 65, "d1/x", "ü", "123 ", "UPPER.case"],
    )
    def test_a_bad_id(self, tags: Tags, bad):
        document, problems = parse(doc(id=f'"{bad}"'), tags)
        assert document is None
        assert codes(problems) == ["BAD_ID"]

    def test_an_id_of_sixty_four_characters_is_the_longest(self, tags: Tags):
        document, problems = parse(doc(id="a" * 64), tags)
        assert problems == [] and len(document.front_matter.id) == 64

    def test_an_id_that_yaml_reads_as_a_number(self, tags: Tags):
        _, problems = parse(doc(id="123"), tags)
        assert codes(problems) == ["BAD_ID"]

    @pytest.mark.parametrize("version", ["1.0", "1", "v1.0.0", "1.0.0.0", "1.0.0-draft", "1.a.0", "latest"])
    def test_a_bad_version(self, tags: Tags, version):
        # "1.0" is read by YAML as a number; the rest are strings the pattern refuses
        _, problems = parse(doc(version=version), tags)
        assert codes(problems) == ["BAD_VERSION"]

    def test_the_patterns_are_the_ones_of_the_order_and_the_packet(self):
        assert ID_RE.match("a.b-c_d9") and not ID_RE.match("A")
        assert VERSION_RE.match("10.20.30") and not VERSION_RE.match("1.0")

    def test_an_unknown_domain(self, tags: Tags):
        _, problems = parse(doc(domain="D6"), tags)
        assert codes(problems) == ["UNKNOWN_DOMAIN"]

    def test_an_unknown_mcd_id(self, tags: Tags):
        _, problems = parse(doc(mcd_id="MCD9"), tags)
        assert codes(problems) == ["UNKNOWN_MCD_ID"]

    def test_an_unknown_state_code(self, tags: Tags):
        _, problems = parse(doc(state_codes=["MCD1_MADE_UP"]), tags)
        assert codes(problems) == ["UNKNOWN_STATE_CODE"]

    def test_a_state_code_of_another_sensor(self, tags: Tags):
        _, problems = parse(doc(mcd_id="MCD1", state_codes=["MCD3_BULL_VALUE"]), tags)
        assert codes(problems) == ["STATE_CODE_NOT_OF_MCD"]

    def test_an_unknown_timeframe(self, tags: Tags):
        _, problems = parse(doc(timeframe="H1"), tags)
        assert codes(problems) == ["UNKNOWN_TIMEFRAME"]

    def test_at_most_sixteen_state_codes(self, tags: Tags):
        many = sorted(tags.state_codes["MCD1"] + tags.state_codes["MCD2"])[:17]
        _, problems = parse(doc(state_codes=many), tags)
        assert codes(problems) == ["TOO_MANY"]
        document, problems = parse(doc(state_codes=many[:16]), tags)
        assert problems == [] and len(document.front_matter.state_codes) == 16

    def test_state_codes_must_be_a_list_of_strings(self, tags: Tags):
        _, problems = parse(doc(state_codes="MCD1_UP_IN_CORRIDOR"), tags)
        assert codes(problems) == ["BAD_TYPE"]

    def test_related_must_be_a_list_of_chunk_ids(self, tags: Tags):
        _, problems = parse(doc(related="t.other"), tags)
        assert codes(problems) == ["BAD_TYPE"]
        _, problems = parse(doc(related=['"Not An Id"']), tags)
        assert codes(problems) == ["BAD_RELATED"]
        _, problems = parse(doc(related=["t.a", "t.a"]), tags)
        assert codes(problems) == ["DUPLICATE_RELATED"]

    def test_a_playbook_needs_the_sensor_it_is_about(self, tags: Tags):
        _, problems = parse(doc(domain="D2"), tags)
        assert codes(problems) == ["D2_NEEDS_MCD_ID"]
        document, problems = parse(doc(domain="D2", mcd_id="MCD2"), tags)
        assert problems == [] and document.front_matter.mcd_id == "MCD2"

    def test_the_other_domains_may_name_a_sensor_or_none(self, tags: Tags):
        for domain in ("D1", "D3", "D4", "D5"):
            assert parse(doc(domain=domain), tags)[1] == []
            assert parse(doc(domain=domain, mcd_id="MCD3"), tags)[1] == []

    def test_every_problem_of_a_file_is_reported_together(self, tags: Tags):
        text = doc(domain="D9", mcd_id="MCD9", timeframe="H1", version='"x"', state_codes=["NOPE"])
        document, problems = parse(text, tags)
        assert document is None
        assert codes(problems) == [
            "BAD_VERSION",
            "UNKNOWN_DOMAIN",
            "UNKNOWN_MCD_ID",
            "UNKNOWN_STATE_CODE",
            "UNKNOWN_TIMEFRAME",
        ]
        assert all(p.where == "x/y.md" for p in problems)

    def test_values_that_yaml_turns_into_other_types_are_refused(self, tags: Tags):
        # `NO` is False in YAML 1.1; an unquoted date is a date
        _, problems = parse(doc(timeframe="NO"), tags)
        assert codes(problems) == ["UNKNOWN_TIMEFRAME"]
        _, problems = parse(doc(version="2026-10-13"), tags)
        assert codes(problems) == ["BAD_VERSION"]
