"""Compliance Manager — audit trail, integrity verification, and dispute resolution.

Provides:
  1. generate_report()       — compliance report for a date range
  2. verify_integrity()      — SHA-256 tamper detection on JSONL files
  3. reconstruct_context()   — rebuild full advice context from JSONL for disputes
  4. export_legal_evidence() — export timestamped proof package for regulators

Designed for 7-year financial services retention requirements.
Every interaction can be proven with exact timestamps, checksummed files,
and entry-level line numbers.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

from .jsonl_logger import JSONLLogger

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Report types
# ---------------------------------------------------------------------------


@dataclass
class ComplianceEvent:
    event_type: str         # warning_issued | advice_given | risk_assessment |
                            # upload_processed | behavioral_drift_detected
    timestamp: str
    user_id: str
    session_id: str
    risk_level: str
    summary: str
    jsonl_file_path: str
    jsonl_entry_index: int
    entry_id: str


@dataclass
class ComplianceReport:
    user_id: str
    start_date: str
    end_date: str
    generated_at: str
    events: list[ComplianceEvent]
    integrity_verified: bool
    tampered_files: list[str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "user_id": self.user_id,
            "start_date": self.start_date,
            "end_date": self.end_date,
            "generated_at": self.generated_at,
            "total_events": len(self.events),
            "events": [
                {
                    "event_type": e.event_type,
                    "timestamp": e.timestamp,
                    "session_id": e.session_id,
                    "risk_level": e.risk_level,
                    "summary": e.summary,
                    "jsonl_file_path": e.jsonl_file_path,
                    "jsonl_entry_index": e.jsonl_entry_index,
                    "entry_id": e.entry_id,
                }
                for e in self.events
            ],
            "integrity_verified": self.integrity_verified,
            "tampered_files": self.tampered_files,
        }


# ---------------------------------------------------------------------------
# ComplianceManager
# ---------------------------------------------------------------------------


class ComplianceManager:
    """Audit trail management and compliance reporting.

    Parameters
    ----------
    jsonl_logger:
        JSONLLogger instance providing read/write access to JSONL files.
    checksum_store_path:
        Path to a JSON file that stores known-good SHA-256 checksums for
        JSONL files.  Used to detect tampering.
    """

    def __init__(
        self,
        jsonl_logger: JSONLLogger,
        checksum_store_path: str | Path | None = None,
    ) -> None:
        self._log = jsonl_logger
        self._checksum_path = (
            Path(checksum_store_path).expanduser()
            if checksum_store_path
            else Path.home() / ".rag_compliance" / "checksums.json"
        )
        self._checksum_path.parent.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Report generation
    # ------------------------------------------------------------------

    def generate_report(
        self,
        user_id: str,
        start_date: str,
        end_date: str,
    ) -> ComplianceReport:
        """Generate a compliance report for all events in a date range.

        Parameters
        ----------
        start_date / end_date:
            Inclusive date range in YYYY-MM-DD format.
        """
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()

        events: list[ComplianceEvent] = []
        tampered: list[str] = []
        checked_files: set[str] = set()

        current = start
        while current <= end:
            day_str = current.strftime("%Y-%m-%d")
            entries = self._log.read_session(user_id, day_str)
            session_file = self._log.session_file(user_id, day_str)

            # Integrity check (once per file)
            if str(session_file) not in checked_files and session_file.exists():
                checked_files.add(str(session_file))
                if not self._verify_file(session_file):
                    tampered.append(str(session_file))
                    logger.warning("TAMPERED: %s", session_file)

            for i, entry in enumerate(entries):
                event = self._entry_to_compliance_event(entry, str(session_file), i)
                if event is not None:
                    events.append(event)

            current += timedelta(days=1)

        return ComplianceReport(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
            generated_at=datetime.now(timezone.utc).isoformat(),
            events=events,
            integrity_verified=len(tampered) == 0,
            tampered_files=tampered,
        )

    # ------------------------------------------------------------------
    # Dispute resolution
    # ------------------------------------------------------------------

    def reconstruct_context(
        self,
        user_id: str,
        session_id: str,
    ) -> dict[str, Any]:
        """Rebuild the complete advice context for a session.

        Returns a structured dict suitable for legal evidence:
        - user_query
        - markdown_files_loaded
        - market_data
        - ai_response
        - risk_assessment
        - behavioral_flags
        - full sequence of all entries (with line numbers)
        """
        entries = self._log.read_session_by_id(user_id, session_id)
        if not entries:
            return {"error": f"No entries found for session {session_id}"}

        user_queries = [e for e in entries if e.get("type") == "user_query"]
        assistant_responses = [e for e in entries if e.get("type") == "assistant_response"]
        system_events = [e for e in entries if e.get("type") == "system_event"]

        return {
            "session_id": session_id,
            "user_id": user_id,
            "reconstructed_at": datetime.now(timezone.utc).isoformat(),
            "user_queries": [
                {
                    "timestamp": e.get("timestamp"),
                    "content": e.get("content"),
                    "behavioral_flags": e.get("behavioral_flags"),
                    "line_index": e.get("_line_index"),
                }
                for e in user_queries
            ],
            "ai_responses": [
                {
                    "timestamp": e.get("timestamp"),
                    "content": e.get("content"),
                    "risk_assessment": e.get("risk_assessment"),
                    "market_conditions": e.get("market_conditions"),
                    "markdown_files_loaded": e.get("markdown_files_loaded"),
                    "vector_search_results": e.get("vector_search_results"),
                    "line_index": e.get("_line_index"),
                }
                for e in assistant_responses
            ],
            "system_events": system_events,
            "full_entry_count": len(entries),
        }

    def export_legal_evidence(
        self,
        user_id: str,
        session_id: str,
        output_path: str | Path,
    ) -> Path:
        """Export a self-contained legal evidence package as a JSON file.

        The package includes the full reconstructed context plus the
        checksums of the source JSONL files.
        """
        context = self.reconstruct_context(user_id, session_id)
        entries = self._log.read_session_by_id(user_id, session_id)

        # Collect source files used and their checksums
        source_checksums: dict[str, str] = {}
        for entry in entries:
            src = str(self._log.session_file(
                user_id,
                entry.get("timestamp", datetime.now(timezone.utc).isoformat()),
            ))
            if src not in source_checksums:
                source_checksums[src] = self._log.compute_file_checksum(Path(src))

        package = {
            "evidence_type": "ai_trading_advisory_audit",
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "user_id": user_id,
            "session_id": session_id,
            "context": context,
            "source_file_checksums": source_checksums,
        }

        out = Path(output_path).expanduser()
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(package, indent=2, ensure_ascii=False), encoding="utf-8")
        logger.info("Legal evidence exported to %s", out)
        return out

    # ------------------------------------------------------------------
    # Integrity verification
    # ------------------------------------------------------------------

    def store_checksums(self, user_id: str, date_str: str) -> dict[str, str]:
        """Compute and store checksums for the given day's JSONL file."""
        path = self._log.session_file(user_id, date_str)
        checksum = self._log.compute_file_checksum(path)
        stored = self._load_checksums()
        stored[str(path)] = checksum
        self._save_checksums(stored)
        return {str(path): checksum}

    def verify_integrity(self, user_id: str, start_date: str, end_date: str) -> dict[str, Any]:
        """Verify SHA-256 checksums for all session files in a date range.

        Returns a dict with:
          - verified_files: list of paths that match stored checksum
          - tampered_files: list of paths whose checksum changed
          - missing_checksums: files with no stored checksum
        """
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
        stored = self._load_checksums()

        verified: list[str] = []
        tampered: list[str] = []
        missing: list[str] = []

        current = start
        while current <= end:
            day_str = current.strftime("%Y-%m-%d")
            path = self._log.session_file(user_id, day_str)
            path_key = str(path)

            if not path.exists():
                current += timedelta(days=1)
                continue

            current_checksum = self._log.compute_file_checksum(path)
            if path_key not in stored:
                missing.append(path_key)
            elif stored[path_key] == current_checksum:
                verified.append(path_key)
            else:
                tampered.append(path_key)
                logger.error(
                    "INTEGRITY VIOLATION: %s — checksum mismatch!", path_key
                )

            current += timedelta(days=1)

        return {
            "verified_files": verified,
            "tampered_files": tampered,
            "missing_checksums": missing,
            "integrity_ok": len(tampered) == 0,
        }

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _verify_file(self, path: Path) -> bool:
        stored = self._load_checksums()
        path_key = str(path)
        if path_key not in stored:
            return True  # No baseline stored yet — cannot say it's tampered
        current = self._log.compute_file_checksum(path)
        return stored[path_key] == current

    def _load_checksums(self) -> dict[str, str]:
        if not self._checksum_path.exists():
            return {}
        try:
            return json.loads(self._checksum_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {}

    def _save_checksums(self, data: dict[str, str]) -> None:
        self._checksum_path.write_text(
            json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
        )

    @staticmethod
    def _entry_to_compliance_event(
        entry: dict[str, Any],
        file_path: str,
        line_index: int,
    ) -> ComplianceEvent | None:
        """Convert a JSONL entry into a ComplianceEvent if it qualifies."""
        entry_type = entry.get("type", "")
        risk = entry.get("risk_assessment") or {}
        risk_level = risk.get("level", "low") if isinstance(risk, dict) else "low"

        # Only log events with meaningful compliance implications
        if entry_type == "assistant_response" and risk_level in ("high", "critical"):
            event_type = "warning_issued" if risk_level == "critical" else "advice_given"
        elif entry_type == "compliance_event":
            event_type = "compliance_event"
        elif entry_type == "behavioral_flag":
            event_type = "behavioral_drift_detected"
        else:
            return None

        return ComplianceEvent(
            event_type=event_type,
            timestamp=entry.get("timestamp", ""),
            user_id=entry.get("user_id", ""),
            session_id=entry.get("session_id", ""),
            risk_level=risk_level,
            summary=str(entry.get("content", ""))[:200],
            jsonl_file_path=file_path,
            jsonl_entry_index=line_index,
            entry_id=entry.get("entry_id", ""),
        )
