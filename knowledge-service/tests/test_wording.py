"""The wording backstop (architecture 5.9): phrases no chunk may contain."""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from helpers import REPO_ROOT
from knowledge.wording import RULE_IDS, WORDING_VERSION, check_chunk, scan


def rules(text: str) -> list[str]:
    return [hit.rule for hit in scan(text)]


# One example for each cell of the "Never" column of section 5.9, and the order's own three.
FORBIDDEN = [
    ("guaranteed win", "GUARANTEE"),
    ("This setup is guaranteed.", "GUARANTEE"),
    ("We guarantee the result.", "GUARANTEE"),
    ("a sure thing", "GUARANTEE"),
    ("a sure-fire entry", "GUARANTEE"),
    ("You cannot lose with this.", "GUARANTEE"),
    ("risk-free", "GUARANTEE"),
    ("a risk free trade", "GUARANTEE"),
    ("zero risk", "GUARANTEE"),
    ("100% accurate", "ABSOLUTE_ACCURACY"),
    ("100 % correct", "ABSOLUTE_ACCURACY"),
    ("hallucination-free answers", "ABSOLUTE_ACCURACY"),
    ("error-free", "ABSOLUTE_ACCURACY"),
    ("The sensor is never wrong.", "ABSOLUTE_ACCURACY"),
    ("It always wins.", "ABSOLUTE_ACCURACY"),
    ("This is not financial advice.", "ADVICE"),
    ("Advice for traders", "ADVICE"),
    ("We recommend you buy now.", "ADVICE"),
    ("I recommend waiting.", "ADVICE"),
    ("You should buy here.", "ADVICE"),
    ("Sell now before it drops", "ADVICE"),
    ("an 82% chance of a rally", "PROBABILITY"),
    ("a 70% probability", "PROBABILITY"),
    ("There is a probability of 0.7.", "PROBABILITY"),
    ("odds of 3 to 1", "PROBABILITY"),
    ("GRADE S setup", "GRADE"),
    ("Grade A reading", "GRADE"),
    ("a high-conviction call", "GRADE"),
    ("Low conviction signal", "GRADE"),
    ("conviction score of the reading", "GRADE"),
    ("Act now!", "URGENCY"),
    ("don't miss this entry", "URGENCY"),
    ("Don’t miss the move", "URGENCY"),
    ("do not wait", "URGENCY"),
    ("This is the last chance.", "URGENCY"),
    ("Hurry, price is moving.", "URGENCY"),
    ("before it's too late", "URGENCY"),
]

ALLOWED = [
    "Half of the risk per trade applies in a cautionary reading.",
    "The maximum risk per trade is set in the profile.",
    "Max RPT may be raised up to 50% of equity in a fixture sentence.",  # a percentage is not a probability
    "A grade of a bit more than nothing.",  # the letter of a grade is case-sensitive
    "Sort the odds table by name.",  # odds with no number after it
    "The sensor reports the corridor as measured, never as expected.",
    "A bar that is still forming is not used.",
    "Outcomes are never certain.",
    "Decision support: the trader decides.",
    "The recommendation of the synthesis is a bias, not an order.",  # the noun is not "we recommend"
    "The conviction of a reader is their own.",
    "Stand aside is a complete reading.",
]


class TestForbiddenPhrases:
    @pytest.mark.parametrize(("text", "rule"), FORBIDDEN)
    def test_each_forbidden_phrase_is_found(self, text, rule):
        assert rule in rules(text), f"{rule} not found in {text!r}: {rules(text)}"

    @pytest.mark.parametrize("text", ALLOWED)
    def test_ordinary_trading_prose_is_not_flagged(self, text):
        assert scan(text) == []

    @pytest.mark.parametrize("text", ["GUARANTEED WIN", "Risk-Free", "100% ACCURATE", "ACT NOW"])
    def test_case_does_not_matter(self, text):
        assert scan(text)

    def test_a_negated_phrase_is_still_a_match(self):
        # deliberately context-free: "not a guarantee" is also refused, so the rule stays readable
        assert rules("This is not a guarantee.") == ["GUARANTEE"]

    def test_a_word_boundary_protects_longer_words(self):
        assert scan("the guarantor of the lease") == []
        assert scan("a hurricane of ideas") == []

    def test_every_hit_has_a_position_and_the_phrase_as_written(self):
        (hit,) = scan("It is a Risk-Free idea.")
        assert (hit.rule, hit.phrase, hit.offset) == ("GUARANTEE", "Risk-Free", 8)

    def test_several_hits_come_back_in_text_order(self):
        text = "Act now: this is a guaranteed, risk-free trade."
        found = scan(text)
        assert [h.phrase.lower() for h in found] == ["act now", "guaranteed", "risk-free"]
        assert [h.offset for h in found] == sorted(h.offset for h in found)

    def test_a_chunk_is_reported_with_its_id_and_the_rule(self):
        problems = check_chunk("t.d1.example", "Totally guaranteed.")
        assert [(p.where, p.code) for p in problems] == [("t.d1.example", "WORDING")]
        assert "GUARANTEE" in problems[0].message and "guaranteed" in problems[0].message

    def test_a_clean_chunk_has_no_problem(self):
        assert check_chunk("t.x", "A channel is a pair of lines fitted to closed bars.") == []

    def test_the_rules_cover_every_cell_of_the_never_column(self):
        assert set(RULE_IDS) == {"GUARANTEE", "ABSOLUTE_ACCURACY", "ADVICE", "PROBABILITY", "GRADE", "URGENCY"}

    def test_the_version_is_a_part_of_the_build(self):
        assert WORDING_VERSION == "wording-1"


@pytest.mark.skipif(not (REPO_ROOT / "docs" / "STACK-D-ARCHITECTURE.md").is_file(), reason="the architecture is not beside the service")
def test_the_never_column_of_5_9_is_what_the_rules_were_written_from():
    """If section 5.9 gains a phrase the rules do not catch, this names it."""
    text = (REPO_ROOT / "docs" / "STACK-D-ARCHITECTURE.md").read_text(encoding="utf-8")
    section = text.split("### 5.9 Wording guide", 1)[1].split("### 5.10", 1)[0]
    rows = [line for line in section.splitlines() if line.startswith("|") and "Never" not in line and "---" not in line]
    never_cells = [line.split("|")[2] for line in rows]
    quoted = [phrase for cell in never_cells for phrase in re.findall(r'"([^"]+)"', cell)]
    assert quoted, "could not read the Never column"
    # A bare percentage ("82%") is the example of an unmeasured probability. The corpus may state configured
    # percentages (half risk is 50% of the risk per trade, the typo filter is 5%), so the rule catches a percentage only
    # when a probability word goes with it ("an 82% chance"); the bare example is therefore not matched on purpose.
    quoted = [p for p in quoted if not re.fullmatch(r"\d+%", p)]
    missed = [p for p in quoted if not scan(p)]
    # "News that isn't in the events feed" is a rule about sources, not a phrase; it is not in quotes in the table
    assert missed == [], f"section 5.9 forbids {missed} but no rule matches them"
