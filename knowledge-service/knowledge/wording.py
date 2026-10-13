"""The wording backstop (architecture 5.9, plan part 6): English phrases a knowledge chunk must never contain.

Section 5.9 says the service is decision support and lists what it never says: advice, unmeasured probabilities or
grades, guarantees and claims of perfect accuracy, urgency. The corpus is the text the model quotes from, so the same
list runs over every chunk at build and a match fails the build, naming the chunk, the rule and the phrase.

The check is deliberately context-free. A chunk may not say "this is not a guarantee" either: say "outcomes are never
certain". A list that tried to read negations would be a second, weaker reviewer; this one is a backstop and stays
simple enough to read in one sitting. It is English only; the 19-language phrase lists belong to the replies (5.9) and
are versioned with the glossary.

`WORDING_VERSION` is a part of the index build id: an edit to a rule is a new build.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from .errors import Problem

WORDING_VERSION = "wording-1"

# (rule id, pattern). Matched case-insensitively against text whose typographic apostrophes are plain.
_RULES: tuple[tuple[str, str], ...] = (
    (
        "GUARANTEE",
        r"\bguarantee(?:s|d|ing)?\b"
        r"|\bsure[- ]?(?:thing|fire)\b"
        r"|\b(?:can'?t|cannot) lose\b"
        r"|\bfoolproof\b"
        r"|\brisk[- ]free\b"
        r"|\b(?:no|zero)[- ]risk\b"
        r"|\bcertain(?:ly)? (?:win|profit)s?\b",
    ),
    (
        "ABSOLUTE_ACCURACY",
        r"\b100\s*%\s*(?:accura\w+|correct|reliable|certain|safe|sure|win\w*|success\w*)"
        r"|\bhallucination[- ]free\b"
        r"|\berror[- ]free\b"
        r"|\bnever (?:wrong|fails?|loses?)\b"
        r"|\balways (?:wins?|profit\w*|right|correct)\b"
        r"|\bperfect(?:ly)? accura\w+",
    ),
    (
        "ADVICE",
        r"\badvice\b"
        r"|\b(?:we|i) (?:recommend|advise)\b"
        r"|\byou should (?:buy|sell|enter|exit|go long|go short|trade|take)\b"
        r"|\b(?:buy|sell) (?:now|immediately)\b",
    ),
    (
        "PROBABILITY",
        r"\b\d+(?:\.\d+)?\s*%\s*(?:chance|probability|likelihood|likely|win\s*rate|success|accura\w+|confiden\w+|certain\w*|sure)"
        r"|\b(?:probability|chance|odds|likelihood)\s+(?:of\s+)?(?:about\s+|around\s+|roughly\s+)?\d",
    ),
    (
        "GRADE",
        r"\bgrade\s+(?-i:[A-Z])\b"  # the letter is case-sensitive: "GRADE S", "Grade A", not "grade a"
        r"|\b(?:high|low|medium|strong|weak)[- ]conviction\b"
        r"|\bconviction (?:score|level|grade)\b",
    ),
    (
        "URGENCY",
        r"\bact now\b"
        r"|\b(?:don'?t|do not) (?:miss|wait|hesitate)\b"
        r"|\blast chance\b"
        r"|\bhurry\b"
        r"|\bbefore it'?s too late\b"
        r"|\bnow or never\b",
    ),
)

_COMPILED = tuple((rule, re.compile(pattern, re.IGNORECASE)) for rule, pattern in _RULES)

RULE_IDS = tuple(rule for rule, _ in _RULES)


@dataclass(frozen=True)
class Hit:
    rule: str
    phrase: str
    offset: int


def scan(text: str) -> list[Hit]:
    """Every forbidden phrase in `text`, in the order they occur."""
    text = text.replace("\u2019", "'").replace("\u2018", "'")
    hits = [
        Hit(rule=rule, phrase=match.group(0), offset=match.start())
        for rule, pattern in _COMPILED
        for match in pattern.finditer(text)
    ]
    return sorted(hits, key=lambda h: (h.offset, h.rule))


def check_chunk(chunk_id: str, text: str) -> list[Problem]:
    return [
        Problem(chunk_id, "WORDING", f"{hit.rule}: {hit.phrase!r} at character {hit.offset}")
        for hit in scan(text)
    ]
