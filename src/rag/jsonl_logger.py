"""JSONL Logger — write-first, immutable audit trail for every AI interaction.

Architecture principle: Log BEFORE processing.
Every chat query, tool call, tool result, assistant response, and system event
is appended to a daily JSONL file immediately. The file is the source of truth
for compliance, dispute resolution, and behavioral pattern mining.

File layout:
    ~/logs/users/{user_id}/sessions/{YYYY-MM}/{YYYY-MM-DD}.jsonl
    ~/logs/users/{user_id}/analytics/behavioral_patterns.jsonl
    ~/logs/users/{user_id}/analytics/advice_outcomes.jsonl
    ~/logs/users/{user_id}/analytics/compliance_events.jsonl
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import threading
import uuid
from collections import deque
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Entry schema
# ---------------------------------------------------------------------------


class EntryType(str, Enum):
    USER_QUERY = "user_query"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    ASSISTANT_RESPONSE = "assistant_response"
    SYSTEM_EVENT = "system_event"
    BEHAVIORAL_FLAG = "behavioral_flag"
    COMPLIANCE_EVENT = "compliance_event"


class MarketRegime(str, Enum):
    LOW_VOLATILITY = "LOW_VOLATILITY"
    MEDIUM_VOLATILITY = "MEDIUM_VOLATILITY"
    HIGH_VOLATILITY = "HIGH_VOLATILITY"


class MarketTrend(str, Enum):
    BULLISH = "BULLISH"
    BEARISH = "BEARISH"
    RANGING = "RANGING"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class MarketConditions:
    symbol: str
    atr_percentile: float
    regime: str  # MarketRegime value
    trend: str   # MarketTrend value
    price: float


@dataclass
class RiskAssessment:
    level: str   # RiskLevel value
    factors: list[str]
    score: int   # 0–100


@dataclass
class BehavioralFlags:
    late_night_query: bool = False
    repeated_question: bool = False
    ignored_previous_warning: bool = False
    analysis_paralysis: bool = False
    emotional_language: bool = False
    revenge_trading_indicator: bool = False


@dataclass
class JSONLEntry:
    """Single entry in the JSONL audit log.

    Mirrors the TypeScript ``JSONLEntry`` interface from the architecture doc.
    """

    type: str                               # EntryType value
    session_id: str
    user_id: str

    # Populated by logger — callers should not set these
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    entry_id: str = field(default_factory=lambda: str(uuid.uuid4()))

    # Optional fields
    mt5_account_id: str | None = None
    content: str | None = None
    tool: str | None = None                 # tool name when type=tool_call
    params: dict[str, Any] | None = None
    result: dict[str, Any] | None = None

    market_conditions: MarketConditions | None = None
    risk_assessment: RiskAssessment | None = None
    behavioral_flags: BehavioralFlags | None = None

    markdown_files_loaded: list[str] | None = None
    vector_search_results: int | None = None
    advice_followed: bool | None = None
    next_trade_id: str | None = None
    next_trade_result: float | None = None
    compliance_category: str | None = None  # warning | advice | disclosure | assessment

    def to_dict(self) -> dict[str, Any]:
        """Serialize to JSON-serializable dict, omitting None values."""
        raw = asdict(self)
        return {k: v for k, v in raw.items() if v is not None}


# ---------------------------------------------------------------------------
# Logger
# ---------------------------------------------------------------------------


class JSONLLogger:
    """Write-first, append-only JSONL logger.

    Entries are buffered in memory and flushed to disk either:
    - immediately (flush_every=1, the default),
    - or in batches (flush_every=N for higher throughput).

    Thread-safe: a single lock guards the buffer and file handles.

    Parameters
    ----------
    base_dir:
        Root directory for all log files.  Defaults to ``~/logs``.
    flush_every:
        Flush buffer to disk after this many pending entries.
        Set to 1 for write-first guarantee.
    """

    def __init__(
        self,
        base_dir: str | Path | None = None,
        flush_every: int = 1,
    ) -> None:
        self._base = Path(base_dir).expanduser() if base_dir else Path.home() / "logs"
        self._flush_every = max(1, flush_every)
        self._buffer: deque[tuple[Path, str]] = deque()
        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def log(self, entry: JSONLEntry) -> Path:
        """Append *entry* to the appropriate JSONL file.

        Returns the path of the file written to.
        """
        file_path = self._session_path(entry.user_id, entry.timestamp)
        line = json.dumps(entry.to_dict(), ensure_ascii=False)

        with self._lock:
            self._buffer.append((file_path, line))
            if len(self._buffer) >= self._flush_every:
                self._flush_locked()

        return file_path

    def log_analytics(
        self,
        user_id: str,
        category: str,
        data: dict[str, Any],
    ) -> Path:
        """Append an analytics entry to a named analytics JSONL file.

        Parameters
        ----------
        category:
            One of ``behavioral_patterns``, ``advice_outcomes``,
            ``compliance_events``.
        """
        file_path = self._analytics_path(user_id, category)
        record = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "entry_id": str(uuid.uuid4()),
            **data,
        }
        line = json.dumps(record, ensure_ascii=False)

        with self._lock:
            self._buffer.append((file_path, line))
            if len(self._buffer) >= self._flush_every:
                self._flush_locked()

        return file_path

    def flush(self) -> None:
        """Force-flush any pending buffered entries to disk."""
        with self._lock:
            self._flush_locked()

    def session_file(self, user_id: str, date_str: str | None = None) -> Path:
        """Return the session JSONL file path for a user on a given date."""
        ts = date_str or datetime.now(timezone.utc).isoformat()
        return self._session_path(user_id, ts)

    def read_session(self, user_id: str, date_str: str) -> list[dict[str, Any]]:
        """Read all entries from a session file for the given date (YYYY-MM-DD)."""
        # Accept YYYY-MM-DD or full ISO timestamps
        day = date_str[:10]
        month = day[:7]
        path = self._base / "users" / user_id / "sessions" / month / f"{day}.jsonl"
        return self._read_jsonl(path)

    def read_session_by_id(self, user_id: str, session_id: str) -> list[dict[str, Any]]:
        """Read all entries belonging to a specific session_id."""
        # Walk all session files for the user and filter by session_id
        user_dir = self._base / "users" / user_id / "sessions"
        if not user_dir.exists():
            return []
        entries: list[dict[str, Any]] = []
        for jsonl_file in sorted(user_dir.rglob("*.jsonl")):
            for entry in self._read_jsonl(jsonl_file):
                if entry.get("session_id") == session_id:
                    entries.append(entry)
        return entries

    def compute_file_checksum(self, path: Path) -> str:
        """Compute SHA-256 checksum of a JSONL file for tamper detection."""
        if not path.exists():
            return ""
        sha = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                sha.update(chunk)
        return sha.hexdigest()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _session_path(self, user_id: str, timestamp: str) -> Path:
        day = timestamp[:10]          # YYYY-MM-DD
        month = day[:7]               # YYYY-MM
        path = self._base / "users" / user_id / "sessions" / month / f"{day}.jsonl"
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    def _analytics_path(self, user_id: str, category: str) -> Path:
        path = self._base / "users" / user_id / "analytics" / f"{category}.jsonl"
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    def _flush_locked(self) -> None:
        """Write all buffered entries to their respective files (caller holds lock)."""
        while self._buffer:
            file_path, line = self._buffer.popleft()
            try:
                with open(file_path, "a", encoding="utf-8") as f:
                    f.write(line + "\n")
            except OSError as exc:
                logger.error("JSONL write failed for %s: %s", file_path, exc)

    @staticmethod
    def _read_jsonl(path: Path) -> list[dict[str, Any]]:
        if not path.exists():
            return []
        entries: list[dict[str, Any]] = []
        with open(path, encoding="utf-8") as f:
            for i, line in enumerate(f):
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                    obj["_line_index"] = i
                    entries.append(obj)
                except json.JSONDecodeError:
                    logger.warning("Skipping malformed JSONL line %d in %s", i, path)
        return entries

    def __enter__(self) -> JSONLLogger:
        return self

    def __exit__(self, *exc: object) -> None:
        self.flush()
