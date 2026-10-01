"""Reason codes (standard Appendix D). Nothing outside this list may be emitted.

Codes are stable identifiers; the trader-facing text for each is kept per language elsewhere
(standard section 10). A new code is added here, to standard Appendix D, to the 16-language reason
texts and to ``tags.yaml`` in the same change.
"""

from __future__ import annotations

import re

VALID = "VALID"
CAUTIONARY = "CAUTIONARY"
INVALID = "INVALID"
STALE = "STALE"
STATUSES = (VALID, CAUTIONARY, INVALID, STALE)

DATA_STALE = "DATA_STALE"
RETUNING = "RETUNING"
NO_SETTING = "NO_SETTING"
DETECTION_MISMATCH = "DETECTION_MISMATCH"
NO_STATS_AT_SLOT = "NO_STATS_AT_SLOT"
CONTAINMENT_LOW = "CONTAINMENT_LOW"
INSUFFICIENT_BARS = "INSUFFICIENT_BARS"
DISCONTINUITY = "DISCONTINUITY"
SANITY_FAILED = "SANITY_FAILED"
MCD0_DEFECT_M5 = "MCD0_DEFECT_M5"
MCD0_DEFECT_M15 = "MCD0_DEFECT_M15"
EVALUATOR_ERROR = "EVALUATOR_ERROR"

# Fixed codes and the status each one produces.
_FIXED_STATUS = {
    DATA_STALE: STALE,
    RETUNING: CAUTIONARY,
    NO_SETTING: INVALID,
    DETECTION_MISMATCH: CAUTIONARY,
    NO_STATS_AT_SLOT: STALE,
    CONTAINMENT_LOW: INVALID,
    INSUFFICIENT_BARS: INVALID,
    DISCONTINUITY: INVALID,
    SANITY_FAILED: INVALID,
    MCD0_DEFECT_M5: CAUTIONARY,
    MCD0_DEFECT_M15: CAUTIONARY,
    EVALUATOR_ERROR: INVALID,
}

# Parameterised codes: ``<PREFIX>:<mcd id>``.
_UPSTREAM_STATUS = {
    "UPSTREAM_CAUTIONARY": CAUTIONARY,
    "UPSTREAM_UNAVAILABLE": INVALID,
    "UPSTREAM_STALE": STALE,
}

_MCD_ID = re.compile(r"^MCD([0-9]|1[0-5])$")
_UPSTREAM_RE = re.compile(r"^(UPSTREAM_[A-Z]+):(MCD(?:[0-9]|1[0-5]))$")

FIXED_CODES = tuple(_FIXED_STATUS)


def upstream_cautionary(mcd_id: str) -> str:
    return _upstream("UPSTREAM_CAUTIONARY", mcd_id)


def upstream_unavailable(mcd_id: str) -> str:
    return _upstream("UPSTREAM_UNAVAILABLE", mcd_id)


def upstream_stale(mcd_id: str) -> str:
    return _upstream("UPSTREAM_STALE", mcd_id)


def _upstream(prefix: str, mcd_id: str) -> str:
    if not _MCD_ID.match(str(mcd_id)):
        raise ValueError(f"not an MCD id: {mcd_id!r}")
    return f"{prefix}:{mcd_id}"


def mcd0_defect(timeframe: str) -> str:
    code = f"MCD0_DEFECT_{timeframe}"
    if code not in _FIXED_STATUS:
        raise ValueError(f"no MCD0 defect code for timeframe {timeframe!r}")
    return code


def status_for(code: str) -> str:
    """The status a code produces. Raises ``ValueError`` for a code that is not in Appendix D."""
    if code in _FIXED_STATUS:
        return _FIXED_STATUS[code]
    m = _UPSTREAM_RE.match(code) if isinstance(code, str) else None
    if m and m.group(1) in _UPSTREAM_STATUS:
        return _UPSTREAM_STATUS[m.group(1)]
    raise ValueError(f"unknown reason code: {code!r} (allowed: standard Appendix D)")


def is_known(code: object) -> bool:
    try:
        status_for(code)  # type: ignore[arg-type]
    except ValueError:
        return False
    return True
