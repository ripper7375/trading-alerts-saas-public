"""Pattern Miner — behavioral sequence detection from JSONL transcripts.

Reads JSONL session files (produced by JSONLLogger) and identifies:

  1. RevengeTradingPattern  — loss mention → position sizing query < 30 min
  2. AnalysisParalysis      — 5+ questions in 1 hour before a trade
  3. IgnoredWarnings        — critical warning → no acknowledgment → trade anyway
  4. LateNightRisking       — high-risk queries between 22:00–02:00 local time
  5. RepeatedQuestions      — same question asked 3+ times in a session

When a pattern is detected the miner:
  - Appends a record to analytics/behavioral_patterns.jsonl
  - Updates the trader's RISK_WARNINGS.md markdown file so the next RAG
    retrieval surfaces the warning automatically
  - (Optionally) writes to the ``behavioral_drift`` PostgreSQL table via a
    provided callback

memsearch integration:  PatternMiner writes updated markdown → MemSearch
FileWatcher re-indexes within 1.5 s → subsequent search() calls include the
new risk context.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Callable

from .jsonl_logger import JSONLLogger

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Emotion / intent keywords
# ---------------------------------------------------------------------------

_LOSS_KEYWORDS = re.compile(
    r"\b(lost|loss|losing|down|blown|blew|bust|wiped|sto[p]? ?loss hit|sl hit|"
    r"liquidat|margin call|drawdown)\b",
    re.IGNORECASE,
)

_REVENGE_KEYWORDS = re.compile(
    r"\b(get it back|recover|make it back|revenge|double down|all.?in|go big|"
    r"increase size|bigger position|max out)\b",
    re.IGNORECASE,
)

_DOUBT_KEYWORDS = re.compile(
    r"\b(should I|is this right|not sure|uncertain|what if|risky|scared|afraid|"
    r"too risky|hesitant|second.?guess)\b",
    re.IGNORECASE,
)

_ACKNOWLEDGMENT_KEYWORDS = re.compile(
    r"\b(ok|okay|understood|got it|i see|will do|noted|thanks|fair enough|"
    r"i(\'ll| will) (avoid|skip|wait|not|reduce|be careful))\b",
    re.IGNORECASE,
)

_LATE_NIGHT_HOURS = {22, 23, 0, 1, 2}


# ---------------------------------------------------------------------------
# Pattern result types
# ---------------------------------------------------------------------------


@dataclass
class PatternMatch:
    pattern_type: str
    user_id: str
    severity: str          # "medium" | "high" | "critical"
    summary: str           # human-readable description
    evidence_session_ids: list[str]
    evidence_entries: list[dict[str, Any]]
    detected_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def to_dict(self) -> dict[str, Any]:
        return {
            "pattern_type": self.pattern_type,
            "user_id": self.user_id,
            "severity": self.severity,
            "summary": self.summary,
            "evidence_session_ids": self.evidence_session_ids,
            "evidence_entries": self.evidence_entries,
            "detected_at": self.detected_at,
        }


# ---------------------------------------------------------------------------
# PatternMiner
# ---------------------------------------------------------------------------


class PatternMiner:
    """Detect behavioral patterns in JSONL session transcripts.

    Parameters
    ----------
    jsonl_logger:
        JSONLLogger instance used to write analytics output and read sessions.
    markdown_dir_fn:
        Callable that takes user_id and returns the Path to that user's
        markdown directory (for updating RISK_WARNINGS.md).
    on_pattern_detected:
        Optional callback invoked with a PatternMatch every time a pattern
        is found.  Use this to write to PostgreSQL behavioral_drift table.
    """

    def __init__(
        self,
        jsonl_logger: JSONLLogger,
        markdown_dir_fn: Callable[[str], Path] | None = None,
        on_pattern_detected: Callable[[PatternMatch], None] | None = None,
    ) -> None:
        self._log = jsonl_logger
        self._markdown_dir_fn = markdown_dir_fn
        self._on_detected = on_pattern_detected

    # ------------------------------------------------------------------
    # Main entry point
    # ------------------------------------------------------------------

    def mine_session(
        self,
        user_id: str,
        session_id: str,
    ) -> list[PatternMatch]:
        """Analyse a single session for all known behavioral patterns.

        Returns list of detected PatternMatch objects.
        """
        entries = self._log.read_session_by_id(user_id, session_id)
        if not entries:
            logger.debug("No entries for session %s / user %s", session_id, user_id)
            return []

        patterns: list[PatternMatch] = []
        patterns += self._detect_revenge_trading(user_id, entries)
        patterns += self._detect_analysis_paralysis(user_id, entries)
        patterns += self._detect_ignored_warnings(user_id, entries)
        patterns += self._detect_late_night_risking(user_id, entries)
        patterns += self._detect_repeated_questions(user_id, entries)

        for p in patterns:
            self._handle_match(user_id, p)

        return patterns

    def mine_date_range(
        self,
        user_id: str,
        start_date: str,
        end_date: str,
    ) -> list[PatternMatch]:
        """Mine all sessions for user between start_date and end_date (YYYY-MM-DD)."""
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()

        all_patterns: list[PatternMatch] = []
        current = start
        while current <= end:
            day_str = current.strftime("%Y-%m-%d")
            entries = self._log.read_session(user_id, day_str)
            if entries:
                # Group by session_id
                sessions: dict[str, list[dict]] = {}
                for e in entries:
                    sid = e.get("session_id", "unknown")
                    sessions.setdefault(sid, []).append(e)
                for sid, sess_entries in sessions.items():
                    all_patterns += self._mine_entries(user_id, sess_entries)
            current += timedelta(days=1)

        return all_patterns

    # ------------------------------------------------------------------
    # Pattern detectors
    # ------------------------------------------------------------------

    def _mine_entries(
        self,
        user_id: str,
        entries: list[dict[str, Any]],
    ) -> list[PatternMatch]:
        patterns: list[PatternMatch] = []
        patterns += self._detect_revenge_trading(user_id, entries)
        patterns += self._detect_analysis_paralysis(user_id, entries)
        patterns += self._detect_ignored_warnings(user_id, entries)
        patterns += self._detect_late_night_risking(user_id, entries)
        patterns += self._detect_repeated_questions(user_id, entries)
        for p in patterns:
            self._handle_match(user_id, p)
        return patterns

    def _detect_revenge_trading(
        self,
        user_id: str,
        entries: list[dict[str, Any]],
    ) -> list[PatternMatch]:
        """Loss mentioned → position sizing / all-in query within 30 minutes."""
        matches: list[PatternMatch] = []
        user_queries = [
            e for e in entries if e.get("type") == "user_query" and e.get("content")
        ]

        for i, loss_entry in enumerate(user_queries):
            if not _LOSS_KEYWORDS.search(loss_entry["content"]):
                continue

            loss_time = _parse_ts(loss_entry.get("timestamp", ""))
            if loss_time is None:
                continue

            # Look for revenge signal in next 30 minutes
            for follow_entry in user_queries[i + 1:]:
                follow_time = _parse_ts(follow_entry.get("timestamp", ""))
                if follow_time is None:
                    continue
                if (follow_time - loss_time).total_seconds() > 1800:
                    break
                if _REVENGE_KEYWORDS.search(follow_entry["content"]):
                    # Check for late-night escalation
                    hour = loss_time.hour
                    severity = "critical" if hour in _LATE_NIGHT_HOURS else "high"
                    matches.append(
                        PatternMatch(
                            pattern_type="revenge_trading",
                            user_id=user_id,
                            severity=severity,
                            summary=(
                                f"Possible revenge trading detected: loss acknowledged at "
                                f"{loss_time.strftime('%H:%M')}, followed by "
                                f"aggressive re-entry query at "
                                f"{follow_time.strftime('%H:%M')} "
                                f"({int((follow_time - loss_time).total_seconds() / 60)} min later)."
                            ),
                            evidence_session_ids=[
                                loss_entry.get("session_id", ""),
                                follow_entry.get("session_id", ""),
                            ],
                            evidence_entries=[loss_entry, follow_entry],
                        )
                    )
        return matches

    def _detect_analysis_paralysis(
        self,
        user_id: str,
        entries: list[dict[str, Any]],
    ) -> list[PatternMatch]:
        """5+ distinct queries within 1 hour window = analysis paralysis."""
        matches: list[PatternMatch] = []
        user_queries = [
            e for e in entries if e.get("type") == "user_query" and e.get("content")
        ]

        # Sliding 1-hour window
        for i, anchor in enumerate(user_queries):
            anchor_time = _parse_ts(anchor.get("timestamp", ""))
            if anchor_time is None:
                continue
            window: list[dict] = [anchor]
            for later in user_queries[i + 1:]:
                later_time = _parse_ts(later.get("timestamp", ""))
                if later_time is None:
                    continue
                if (later_time - anchor_time).total_seconds() <= 3600:
                    window.append(later)
                else:
                    break
            if len(window) >= 5 and any(_DOUBT_KEYWORDS.search(e["content"]) for e in window):
                matches.append(
                    PatternMatch(
                        pattern_type="analysis_paralysis",
                        user_id=user_id,
                        severity="medium",
                        summary=(
                            f"Analysis paralysis detected: {len(window)} queries in 1 hour "
                            f"starting at {anchor_time.strftime('%H:%M')}."
                        ),
                        evidence_session_ids=list({e.get("session_id", "") for e in window}),
                        evidence_entries=window,
                    )
                )
                # Skip ahead to avoid duplicate windows
                break
        return matches

    def _detect_ignored_warnings(
        self,
        user_id: str,
        entries: list[dict[str, Any]],
    ) -> list[PatternMatch]:
        """Critical AI warning with no acknowledgment in subsequent user messages."""
        matches: list[PatternMatch] = []
        assistant_responses = [
            e for e in entries if e.get("type") == "assistant_response"
        ]
        user_queries = [
            e for e in entries if e.get("type") == "user_query" and e.get("content")
        ]

        for resp in assistant_responses:
            risk = resp.get("risk_assessment") or {}
            if isinstance(risk, dict) and risk.get("level") == "critical":
                resp_time = _parse_ts(resp.get("timestamp", ""))
                if resp_time is None:
                    continue
                # Look for acknowledgment in next 10 minutes
                acknowledged = False
                for user_msg in user_queries:
                    user_time = _parse_ts(user_msg.get("timestamp", ""))
                    if user_time is None or user_time <= resp_time:
                        continue
                    if (user_time - resp_time).total_seconds() > 600:
                        break
                    if _ACKNOWLEDGMENT_KEYWORDS.search(user_msg["content"]):
                        acknowledged = True
                        break
                if not acknowledged:
                    matches.append(
                        PatternMatch(
                            pattern_type="ignored_critical_warning",
                            user_id=user_id,
                            severity="high",
                            summary=(
                                f"Critical warning issued at {resp_time.strftime('%H:%M')} "
                                f"was not acknowledged by the trader."
                            ),
                            evidence_session_ids=[resp.get("session_id", "")],
                            evidence_entries=[resp],
                        )
                    )
        return matches

    def _detect_late_night_risking(
        self,
        user_id: str,
        entries: list[dict[str, Any]],
    ) -> list[PatternMatch]:
        """High-risk trading queries during 22:00–02:00 local time."""
        matches: list[PatternMatch] = []
        for entry in entries:
            if entry.get("type") != "user_query":
                continue
            ts = _parse_ts(entry.get("timestamp", ""))
            if ts is None or ts.hour not in _LATE_NIGHT_HOURS:
                continue
            risk = entry.get("risk_assessment") or {}
            if isinstance(risk, dict) and risk.get("level") in ("high", "critical"):
                matches.append(
                    PatternMatch(
                        pattern_type="late_night_high_risk",
                        user_id=user_id,
                        severity="high",
                        summary=(
                            f"High-risk query at {ts.strftime('%H:%M')} "
                            f"(late-night trading hours)."
                        ),
                        evidence_session_ids=[entry.get("session_id", "")],
                        evidence_entries=[entry],
                    )
                )
        return matches

    def _detect_repeated_questions(
        self,
        user_id: str,
        entries: list[dict[str, Any]],
    ) -> list[PatternMatch]:
        """Same question asked 3+ times — indicates doubt or fear."""
        matches: list[PatternMatch] = []
        user_queries = [
            e for e in entries if e.get("type") == "user_query" and e.get("content")
        ]

        # Normalise query text for similarity
        def _normalise(text: str) -> str:
            return re.sub(r"\s+", " ", text.lower().strip())[:120]

        seen: dict[str, list[dict]] = {}
        for entry in user_queries:
            key = _normalise(entry["content"])
            seen.setdefault(key, []).append(entry)

        for key, group in seen.items():
            if len(group) >= 3:
                matches.append(
                    PatternMatch(
                        pattern_type="repeated_questions",
                        user_id=user_id,
                        severity="medium",
                        summary=(
                            f"Question asked {len(group)}x in same session: \"{key[:80]}...\""
                        ),
                        evidence_session_ids=list({e.get("session_id", "") for e in group}),
                        evidence_entries=group,
                    )
                )
        return matches

    # ------------------------------------------------------------------
    # Handle match: log + update markdown + callback
    # ------------------------------------------------------------------

    def _handle_match(self, user_id: str, match: PatternMatch) -> None:
        # 1. Log to analytics JSONL
        self._log.log_analytics(
            user_id,
            "behavioral_patterns",
            match.to_dict(),
        )

        # 2. Update RISK_WARNINGS.md if we have a markdown directory
        if self._markdown_dir_fn is not None:
            md_dir = self._markdown_dir_fn(user_id)
            self._update_risk_warnings(md_dir, match)

        # 3. Optional callback (e.g. write to PostgreSQL)
        if self._on_detected is not None:
            try:
                self._on_detected(match)
            except Exception as exc:
                logger.error("on_pattern_detected callback raised: %s", exc)

    def _update_risk_warnings(self, md_dir: Path, match: PatternMatch) -> None:
        """Append a warning section to RISK_WARNINGS.md."""
        path = md_dir / "RISK_WARNINGS.md"
        if not path.exists():
            path.write_text("# Risk Warnings\n\n", encoding="utf-8")

        ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        severity_emoji = {"critical": "🔴", "high": "🟠", "medium": "🟡"}.get(
            match.severity, "🟢"
        )
        section = (
            f"\n## {severity_emoji} {match.pattern_type.replace('_', ' ').title()} "
            f"— {ts}\n\n"
            f"{match.summary}\n\n"
            f"**Detected at:** {match.detected_at}  \n"
            f"**Severity:** {match.severity.upper()}\n"
        )
        with open(path, "a", encoding="utf-8") as f:
            f.write(section)
        logger.info(
            "User %s: appended %s to RISK_WARNINGS.md", match.user_id, match.pattern_type
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _parse_ts(ts_str: str) -> datetime | None:
    if not ts_str:
        return None
    try:
        dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return None
