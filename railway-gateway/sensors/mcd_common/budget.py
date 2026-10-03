"""Token and time budgets (test T12, rule R15; standard section 5 and 11.2).

An envelope should stay within **600 tokens** and one evaluation within **1 second** (starting
values, to measure). Tokens are counted with ``o200k_base`` through ``tiktoken`` (walkthrough
Part B2, decision E2, 2026-09-30). The encoding file (about 3.6 MB, hash-verified by tiktoken) is
downloaded once, by ``python -m mcd_common.budget --fetch``, into ``mcd_common/.tiktoken_cache/``
(git-ignored). Normal calls never touch the network: if the cached file is missing or damaged,
``count_tokens`` falls back to a documented character estimate and says so, and T12 is reported as
"pending" instead of failing the build.

Character estimate (fallback only): ``ceil(characters / 3)``. JSON with many numbers and short keys
tokenises at roughly 3 characters per token, so this leans high on purpose for a size limit.
"""

from __future__ import annotations

import hashlib
import math
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

TOKEN_BUDGET = 600
TIME_BUDGET_SECONDS = 1.0
ENCODING_NAME = "o200k_base"
ENCODING_URL = "https://openaipublic.blob.core.windows.net/encodings/o200k_base.tiktoken"
ENCODING_SHA256 = "446a9538cb6c348e3516120d7c08b09f57c36495e2acfffe59a5bf8b0cfb1a2d"  # from tiktoken_ext
CHARS_PER_TOKEN_ESTIMATE = 3
CACHE_DIR = Path(__file__).resolve().parent / ".tiktoken_cache"


@dataclass(frozen=True)
class TokenCount:
    tokens: int
    method: str  # "o200k_base" or "estimate:ceil(chars/3)"
    exact: bool

    @property
    def pending(self) -> bool:
        """True when only the character estimate was available (T12 is then "pending")."""
        return not self.exact


def _cache_dir() -> Path:
    """The kit's cache folder, unless the caller already set ``TIKTOKEN_CACHE_DIR``."""
    return Path(os.environ.get("TIKTOKEN_CACHE_DIR") or CACHE_DIR)


def _cache_file() -> Path:
    return _cache_dir() / hashlib.sha1(ENCODING_URL.encode()).hexdigest()


def encoding_available() -> bool:
    """The encoding file is in the cache and matches the expected hash (no network involved)."""
    path = _cache_file()
    try:
        return path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest() == ENCODING_SHA256
    except OSError:
        return False


def _load_encoding() -> Any:
    os.environ.setdefault("TIKTOKEN_CACHE_DIR", str(CACHE_DIR))
    import tiktoken

    return tiktoken.get_encoding(ENCODING_NAME)


def fetch_encoding() -> Path:
    """Download ``o200k_base`` once into the cache (the only place the network is used)."""
    os.environ.setdefault("TIKTOKEN_CACHE_DIR", str(CACHE_DIR))
    _cache_dir().mkdir(parents=True, exist_ok=True)
    _load_encoding()
    if not encoding_available():
        raise RuntimeError(f"encoding fetched but not found or not matching its hash at {_cache_file()}")
    return _cache_file()


def estimate_tokens(text: str) -> int:
    return math.ceil(len(text) / CHARS_PER_TOKEN_ESTIMATE)


def count_tokens(text: str) -> TokenCount:
    """Tokens of ``text`` with ``o200k_base``, or the documented estimate when it is not cached."""
    if encoding_available():
        try:
            return TokenCount(len(_load_encoding().encode(text)), ENCODING_NAME, True)
        except Exception:  # noqa: BLE001 - a broken tiktoken install must not fail the build
            pass
    return TokenCount(estimate_tokens(text), f"estimate:ceil(chars/{CHARS_PER_TOKEN_ESTIMATE})", False)


def count_envelope_tokens(envelope: Any) -> TokenCount:
    """Tokens of the compact canonical JSON of an envelope (the form the worker stores)."""
    from .envelope import canonical_json

    return count_tokens(canonical_json(envelope))


def time_evaluation(call: Callable[[], Any], *, runs: int = 5) -> float:
    """Slowest of ``runs`` calls, in seconds (``time.perf_counter``; the evaluator itself never reads a clock)."""
    slowest = 0.0
    for _ in range(max(1, runs)):
        started = time.perf_counter()
        call()
        slowest = max(slowest, time.perf_counter() - started)
    return slowest


def _main(argv: list[str]) -> int:
    if argv == ["--fetch"]:
        path = fetch_encoding()
        print(f"o200k_base cached at {path}")
        return 0
    if argv == ["--status"]:
        print("cached" if encoding_available() else "not cached")
        return 0
    print("usage: python -m mcd_common.budget --fetch | --status")
    return 2


if __name__ == "__main__":
    import sys

    raise SystemExit(_main(sys.argv[1:]))
