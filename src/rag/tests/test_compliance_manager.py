"""Tests for ComplianceManager — audit trail and dispute resolution."""

import json
import tempfile
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest

from src.rag.jsonl_logger import JSONLLogger, JSONLEntry, EntryType, RiskAssessment
from src.rag.compliance_manager import ComplianceManager


def ts_today(offset_minutes: int = 0) -> str:
    dt = datetime.now(timezone.utc) + timedelta(minutes=offset_minutes)
    return dt.isoformat()


def _setup(tmp_path: Path):
    log = JSONLLogger(base_dir=tmp_path / "logs", flush_every=1)
    mgr = ComplianceManager(
        jsonl_logger=log,
        checksum_store_path=tmp_path / "checksums.json",
    )
    return log, mgr


def _write_session(log: JSONLLogger, user_id: str, session_id: str):
    """Write a typical session with a critical warning."""
    log.log(JSONLEntry(
        type=EntryType.USER_QUERY.value,
        session_id=session_id,
        user_id=user_id,
        content="Should I double my position size on XAUUSD?",
        timestamp=ts_today(0),
    ))
    log.log(JSONLEntry(
        type=EntryType.ASSISTANT_RESPONSE.value,
        session_id=session_id,
        user_id=user_id,
        content="CRITICAL: This would exceed safe leverage limits.",
        risk_assessment=RiskAssessment(
            level="critical",
            factors=["over-leverage", "oversized position"],
            score=92,
        ),
        timestamp=ts_today(1),
    ))
    log.log(JSONLEntry(
        type=EntryType.USER_QUERY.value,
        session_id=session_id,
        user_id=user_id,
        content="I'll do it anyway.",
        timestamp=ts_today(3),
    ))


# ------------------------------------------------------------------
# Report generation
# ------------------------------------------------------------------


def test_generate_report_finds_critical_warnings(tmp_path):
    log, mgr = _setup(tmp_path)
    user_id = "user-compliance"
    _write_session(log, user_id, "sess_comp_001")

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    report = mgr.generate_report(user_id, today, today)

    assert report.user_id == user_id
    critical_events = [
        e for e in report.events
        if e.risk_level == "critical" or e.event_type == "warning_issued"
    ]
    assert len(critical_events) >= 1


def test_report_includes_integrity_status(tmp_path):
    log, mgr = _setup(tmp_path)
    user_id = "user-integrity"
    _write_session(log, user_id, "sess_int_001")

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    report = mgr.generate_report(user_id, today, today)

    # No checksums stored yet → integrity_verified=True (no tamper evidence)
    assert isinstance(report.integrity_verified, bool)
    assert report.tampered_files == []


# ------------------------------------------------------------------
# Dispute resolution
# ------------------------------------------------------------------


def test_reconstruct_context_returns_full_session(tmp_path):
    log, mgr = _setup(tmp_path)
    user_id = "user-dispute"
    session_id = "sess_dispute_001"
    _write_session(log, user_id, session_id)

    context = mgr.reconstruct_context(user_id, session_id)

    assert context["session_id"] == session_id
    assert len(context["user_queries"]) == 2
    assert len(context["ai_responses"]) == 1
    assert context["ai_responses"][0]["risk_assessment"]["level"] == "critical"


def test_reconstruct_context_missing_session(tmp_path):
    log, mgr = _setup(tmp_path)
    result = mgr.reconstruct_context("user-ghost", "sess_nonexistent")
    assert "error" in result


# ------------------------------------------------------------------
# Legal evidence export
# ------------------------------------------------------------------


def test_export_legal_evidence_writes_json(tmp_path):
    log, mgr = _setup(tmp_path)
    user_id = "user-legal"
    session_id = "sess_legal_001"
    _write_session(log, user_id, session_id)

    output_path = tmp_path / "evidence" / "package.json"
    result = mgr.export_legal_evidence(user_id, session_id, output_path)

    assert result.exists()
    package = json.loads(result.read_text())
    assert package["evidence_type"] == "ai_trading_advisory_audit"
    assert package["session_id"] == session_id
    assert "source_file_checksums" in package
    assert len(package["context"]["ai_responses"]) == 1


# ------------------------------------------------------------------
# Integrity verification
# ------------------------------------------------------------------


def test_tamper_detection(tmp_path):
    log, mgr = _setup(tmp_path)
    user_id = "user-tamper"
    session_id = "sess_tamper_001"
    _write_session(log, user_id, session_id)

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Store checksum of the current file
    mgr.store_checksums(user_id, today)

    # Tamper with the file
    session_file = log.session_file(user_id, today)
    with open(session_file, "a") as f:
        f.write('{"tampered": true}\n')

    # Now verification should detect the change
    result = mgr.verify_integrity(user_id, today, today)
    assert len(result["tampered_files"]) == 1
    assert result["integrity_ok"] is False


def test_no_tamper_on_clean_file(tmp_path):
    log, mgr = _setup(tmp_path)
    user_id = "user-clean"
    _write_session(log, user_id, "sess_clean_001")

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    mgr.store_checksums(user_id, today)

    result = mgr.verify_integrity(user_id, today, today)
    assert len(result["verified_files"]) == 1
    assert result["integrity_ok"] is True
