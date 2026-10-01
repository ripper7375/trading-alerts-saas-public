"""Wording checks for test T11 (standard section 7.4, R9, R11).

Codes and templates must not contain the banned words or their listed inflections
(``BANNED_INFLECTIONS``), no summary or commentary may contain ``%``,
and a summary line stays within 80 characters and carries no prices (they are in ``levels``).
A second, separate list catches advice words (buy, sell, take profit, hold): standard 7.4 says
describe what the market is doing and never tell the trader what to do, and walkthrough Part E2
forbids them. That check is a heuristic word list, so an MCD may allow a word by name and must then
say why in its spec.

Every function returns a list of problems (empty = clean). None of them raises on odd input.
"""

from __future__ import annotations

import re
from types import MappingProxyType
from typing import Iterable, Mapping, Sequence

# Standard section 7.4. Market terms that describe location (PREMIUM, VALUE, OVEREXTENSION) are fine.
BANNED_WORDS = (
    "CONVICTION",
    "PROBABILITY",
    "CONFIDENCE",
    "GRADE",
    "GUARANTEED",
    "SAFE",
    "SURE",
    "STRONG_BUY",
    "STRONG_SELL",
    "HIGH_CONVICTION",
)

# Inflections of the ten banned words (Davin, 2026-10-01, finding F5 of the P6 check): plural, -ED,
# -ING, -LY, -IES, comparatives, and the adjective CONFIDENT. The match stays whole-word, so
# MEASURE, UPGRADE, PRESSURE, GRADIENT, GRADUAL and SAFEGUARD stay clean; only the forms listed
# here are added. A hit is reported under the banned word, so BANNED_WORDS stays equal to standard
# 7.4 and every key below must be one of its words. Add a form here, with a test, when one slips through.
# Derived words (PROBABLE, PROBABLY, LIKELY, LIKELIHOOD, SAFETY) stay allowed (Davin, 2026-10-01); a
# new banned word needs standard 7.4 changed first, then this kit.
BANNED_INFLECTIONS: Mapping[str, tuple[str, ...]] = MappingProxyType(
    {
        "CONVICTION": ("CONVICTIONS",),
        "PROBABILITY": ("PROBABILITIES",),
        "CONFIDENCE": ("CONFIDENCES", "CONFIDENT", "CONFIDENTLY"),
        "GRADE": ("GRADES", "GRADED", "GRADING"),
        "GUARANTEED": ("GUARANTEE", "GUARANTEES", "GUARANTEEING"),
        "SAFE": ("SAFELY", "SAFER", "SAFEST"),
        "SURE": ("SURELY", "SURER", "SUREST"),
        "STRONG_BUY": ("STRONG_BUYS",),
        "STRONG_SELL": ("STRONG_SELLS",),
        "HIGH_CONVICTION": ("HIGH_CONVICTIONS",),
    }
)

# Walkthrough Part E2 and standard 7.4 ("never tell the trader what to do"); OPPORTUNITY per
# walkthrough Part 0.2 item 4 (MCD2's ..._BUY_OPPORTUNITY regime words).
ADVICE_WORDS = ("BUY", "SELL", "TAKE_PROFIT", "HOLD", "OPPORTUNITY")

SUMMARY_MAX_CHARS = 80

_STATE_CODE_RE = re.compile(r"^MCD([0-9]|1[0-5])_[A-Z0-9_]+$")
_PRICE_LIKE_RE = re.compile(r"(?<![\w.])\d{3,}(?:[.,]\d+)?(?![\w])")


def _word_regex(*forms: str) -> re.Pattern[str]:
    parts = "|".join(form.replace("_", r"[\s_-]") for form in forms)
    return re.compile(r"\b(?:" + parts + r")\b", re.IGNORECASE)


def _banned_forms(word: str) -> tuple[str, ...]:
    return (word, *BANNED_INFLECTIONS.get(word, ()))


_BANNED_TEXT_RES = {word: _word_regex(*_banned_forms(word)) for word in BANNED_WORDS}


def banned_in_code(code: str) -> list[str]:
    """Banned words, or a listed inflection of one, appearing as whole ``_``-separated parts of an
    upper-case code. A hit is reported under the banned word."""
    padded = f"_{str(code).upper()}_"
    return [w for w in BANNED_WORDS if any(f"_{form}_" in padded for form in _banned_forms(w))]


def advice_in_code(code: str, allow: Iterable[str] = ()) -> list[str]:
    padded = f"_{str(code).upper()}_"
    allowed = {a.upper() for a in allow}
    return [w for w in ADVICE_WORDS if w not in allowed and f"_{w}_" in padded]


def banned_in_text(text: str) -> list[str]:
    """Banned words, or a listed inflection of one, in a text, reported under the banned word."""
    return [w for w in BANNED_WORDS if _BANNED_TEXT_RES[w].search(str(text))]


def advice_in_text(text: str, allow: Iterable[str] = ()) -> list[str]:
    allowed = {a.upper() for a in allow}
    return [w for w in ADVICE_WORDS if w not in allowed and _word_regex(w).search(str(text))]


def check_code(code: str, *, mcd_id: str | None = None, include_advice: bool = True, allow_advice: Iterable[str] = ()) -> list[str]:
    """A state code or regime word: format (section 7.1) and wording."""
    problems: list[str] = []
    text = str(code)
    if mcd_id is not None:
        if not (_STATE_CODE_RE.match(text) and text.startswith(f"{mcd_id}_")):
            problems.append(f"{text!r}: not a state code of {mcd_id} (MCD<n>_<PARTS>, upper case, ASCII, _ separators)")
        elif len(text) > 48:
            problems.append(f"{text!r}: longer than 48 characters")
    problems += [f"{text!r}: banned word {w}" for w in banned_in_code(text)]
    if include_advice:
        problems += [f"{text!r}: advice word {w}" for w in advice_in_code(text, allow_advice)]
    return problems


def check_text(label: str, text: str, *, include_advice: bool = True, allow_advice: Iterable[str] = ()) -> list[str]:
    """Any summary or commentary text (template or rendered): banned words, ``%``, advice words."""
    problems = [f"{label}: banned word {w}" for w in banned_in_text(text)]
    if "%" in str(text):
        problems.append(f"{label}: contains '%'")
    if include_advice:
        problems += [f"{label}: advice word {w}" for w in advice_in_text(text, allow_advice)]
    return problems


def check_summary_line(
    summary: str,
    levels: Sequence[Mapping[str, object]] = (),
    *,
    include_advice: bool = True,
    allow_advice: Iterable[str] = (),
) -> list[str]:
    """A rendered ``summary_line``: at most 80 characters, no prices, plus ``check_text``."""
    text = str(summary)
    problems = check_text("summary_line", text, include_advice=include_advice, allow_advice=allow_advice)
    if len(text) > SUMMARY_MAX_CHARS:
        problems.append(f"summary_line: {len(text)} characters, limit {SUMMARY_MAX_CHARS}")
    for level in levels:
        price = level.get("price")
        if isinstance(price, (int, float)) and not isinstance(price, bool):
            for shown in {f"{price:.2f}", f"{price:.1f}"}:
                if re.search(rf"(?<![\d.]){re.escape(shown)}(?!\d)", text):
                    problems.append(f"summary_line: shows level price {shown}")
                    break
    if _PRICE_LIKE_RE.search(text):
        problems.append("summary_line: contains a number of three or more digits (looks like a price)")
    return problems


def check_wording(
    *,
    mcd_id: str,
    state_codes: Iterable[str] = (),
    regime_words: Iterable[str] = (),
    templates: Mapping[str, str] | None = None,
    summaries: Iterable[tuple[str, Sequence[Mapping[str, object]]]] = (),
    include_advice: bool = True,
    allow_advice: Iterable[str] = (),
) -> list[str]:
    """Everything T11 looks at for one MCD: codes, regime words, templates, rendered summaries.

    ``templates`` maps a template id to its text (summary and commentary templates of the
    registry); ``summaries`` are rendered ``(summary_line, levels)`` pairs.
    """
    problems: list[str] = []
    for code in state_codes:
        problems += check_code(code, mcd_id=mcd_id, include_advice=include_advice, allow_advice=allow_advice)
    for word in regime_words:
        problems += check_code(word, include_advice=include_advice, allow_advice=allow_advice)
    for template_id, text in (templates or {}).items():
        problems += check_text(f"template {template_id}", text, include_advice=include_advice, allow_advice=allow_advice)
    for summary, levels in summaries:
        problems += check_summary_line(summary, levels, include_advice=include_advice, allow_advice=allow_advice)
    return problems
