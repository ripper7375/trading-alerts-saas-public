"""Canonical text and hashes: what makes a build reproducible across machines.

A checkout on Windows has CRLF line endings and the Docker build has LF; a hash taken of the raw bytes would
give two index build ids for one corpus. Everything that is hashed goes through these helpers first.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any


def normalize_text(text: str) -> str:
    """LF line endings, no byte-order mark. Nothing else is touched: a letter is never changed."""
    if text.startswith("﻿"):
        text = text[1:]
    return text.replace("\r\n", "\n").replace("\r", "\n")


def canonical_json(value: Any) -> str:
    """Sorted keys, no white space, non-ASCII kept: the same value always gives the same text."""
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def sha256_json(value: Any) -> str:
    return sha256_hex(canonical_json(value))


def utf16_length(text: str) -> int:
    """Length as JavaScript counts it. The packet validator measures a chunk's text with `String.length`,
    so a character outside the basic plane counts 2 there and must count 2 here."""
    return len(text.encode("utf-16-le")) // 2
