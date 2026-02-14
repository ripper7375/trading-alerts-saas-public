"""Tests for JSONLLogger — write-first audit trail."""

import json
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import pytest

from src.rag.jsonl_logger import (
    JSONLLogger,
    JSONLEntry,
    EntryType,
    BehavioralFlags,
    RiskAssessment,
    MarketConditions,
)


@pytest.fixture
def tmp_logger(tmp_path):
    return JSONLLogger(base_dir=tmp_path / "logs", flush_every=1)


def make_entry(session_id="sess_test001", user_id="user-abc") -> JSONLEntry:
    return JSONLEntry(
        type=EntryType.USER_QUERY.value,
        session_id=session_id,
        user_id=user_id,
        content="Should I enter XAUUSD long now?",
    )


# ------------------------------------------------------------------
# Schema validation
# ------------------------------------------------------------------


def test_entry_has_required_fields():
    entry = make_entry()
    d = entry.to_dict()
    assert "timestamp" in d
    assert "entry_id" in d
    assert "type" in d
    assert "session_id" in d
    assert "user_id" in d


def test_entry_omits_none_fields():
    entry = make_entry()
    d = entry.to_dict()
    assert "mt5_account_id" not in d
    assert "market_conditions" not in d
    assert "risk_assessment" not in d


def test_entry_with_nested_objects():
    entry = JSONLEntry(
        type=EntryType.ASSISTANT_RESPONSE.value,
        session_id="sess_001",
        user_id="user-001",
        content="XAUUSD is showing bullish divergence.",
        risk_assessment=RiskAssessment(level="medium", factors=["high ATR"], score=45),
        behavioral_flags=BehavioralFlags(late_night_query=True),
        markdown_files_loaded=["RISK_WARNINGS.md", "BEHAVIORAL_HIGH_VOLATILITY.md"],
        vector_search_results=3,
    )
    d = entry.to_dict()
    assert d["risk_assessment"]["level"] == "medium"
    assert d["behavioral_flags"]["late_night_query"] is True
    assert d["vector_search_results"] == 3
    assert len(d["markdown_files_loaded"]) == 2


# ------------------------------------------------------------------
# Write and read
# ------------------------------------------------------------------


def test_log_writes_to_disk(tmp_logger, tmp_path):
    entry = make_entry()
    path = tmp_logger.log(entry)
    assert path.exists()
    lines = path.read_text().strip().splitlines()
    assert len(lines) == 1
    obj = json.loads(lines[0])
    assert obj["type"] == EntryType.USER_QUERY.value
    assert obj["content"] == "Should I enter XAUUSD long now?"


def test_multiple_entries_append(tmp_logger):
    for i in range(5):
        entry = JSONLEntry(
            type=EntryType.USER_QUERY.value,
            session_id="sess_multi",
            user_id="user-xyz",
            content=f"Query number {i}",
        )
        tmp_logger.log(entry)
    entries = tmp_logger.read_session("user-xyz", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    assert len(entries) == 5


def test_read_session_by_id(tmp_logger):
    for _ in range(3):
        entry = JSONLEntry(
            type=EntryType.SYSTEM_EVENT.value,
            session_id="sess_specific",
            user_id="user-filter",
            content="event",
        )
        tmp_logger.log(entry)
    # Log some entries with a different session_id
    for _ in range(2):
        entry = JSONLEntry(
            type=EntryType.USER_QUERY.value,
            session_id="sess_other",
            user_id="user-filter",
            content="other",
        )
        tmp_logger.log(entry)

    specific = tmp_logger.read_session_by_id("user-filter", "sess_specific")
    assert len(specific) == 3
    assert all(e["session_id"] == "sess_specific" for e in specific)


def test_checksum_computation(tmp_logger):
    entry = make_entry()
    path = tmp_logger.log(entry)
    checksum = tmp_logger.compute_file_checksum(path)
    assert len(checksum) == 64  # SHA-256 hex
    # Recomputing gives same result
    assert tmp_logger.compute_file_checksum(path) == checksum


def test_analytics_log(tmp_logger):
    path = tmp_logger.log_analytics(
        user_id="user-analytics",
        category="behavioral_patterns",
        data={"pattern_type": "revenge_trading", "severity": "high"},
    )
    assert path.exists()
    assert "behavioral_patterns.jsonl" in str(path)
    lines = path.read_text().strip().splitlines()
    obj = json.loads(lines[0])
    assert obj["pattern_type"] == "revenge_trading"


def test_flush_on_context_exit(tmp_path):
    with JSONLLogger(base_dir=tmp_path / "logs2", flush_every=100) as log:
        for i in range(5):
            log.log(JSONLEntry(
                type=EntryType.TOOL_CALL.value,
                session_id="sess_flush",
                user_id="user-flush",
                tool="Bash",
                params={"command": f"ls {i}"},
            ))
    # After exit, all entries should be flushed
    entries = log.read_session("user-flush", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    assert len(entries) == 5
