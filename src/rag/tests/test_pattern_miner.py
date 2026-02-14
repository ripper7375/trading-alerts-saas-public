"""Tests for PatternMiner — behavioral sequence detection."""

import tempfile
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest

from src.rag.jsonl_logger import JSONLLogger, JSONLEntry, EntryType, RiskAssessment
from src.rag.pattern_miner import PatternMiner


def ts(offset_minutes: int = 0) -> str:
    """Return ISO timestamp offset_minutes from now."""
    dt = datetime.now(timezone.utc) + timedelta(minutes=offset_minutes)
    return dt.isoformat()


def _make_logger(tmp_path: Path) -> JSONLLogger:
    return JSONLLogger(base_dir=tmp_path / "logs", flush_every=1)


def _write_entry(log: JSONLLogger, **kwargs) -> JSONLEntry:
    entry = JSONLEntry(**kwargs)
    log.log(entry)
    return entry


# ------------------------------------------------------------------
# Revenge trading
# ------------------------------------------------------------------


def test_revenge_trading_detected(tmp_path):
    log = _make_logger(tmp_path)
    user_id = "user-revenge"
    session_id = "sess_revenge_001"

    # Loss entry
    _write_entry(
        log,
        type=EntryType.USER_QUERY.value,
        session_id=session_id,
        user_id=user_id,
        content="I just lost 200 pips on EURUSD, stop loss hit",
        timestamp=ts(0),
    )
    # Revenge entry 15 minutes later
    _write_entry(
        log,
        type=EntryType.USER_QUERY.value,
        session_id=session_id,
        user_id=user_id,
        content="Should I go all-in on EURUSD to get it back?",
        timestamp=ts(15),
    )

    detected = []
    miner = PatternMiner(
        jsonl_logger=log,
        on_pattern_detected=detected.append,
    )
    matches = miner.mine_session(user_id, session_id)

    revenge_matches = [m for m in matches if m.pattern_type == "revenge_trading"]
    assert len(revenge_matches) >= 1
    assert revenge_matches[0].severity in ("high", "critical")


def test_revenge_trading_not_triggered_for_normal_query(tmp_path):
    log = _make_logger(tmp_path)
    user_id = "user-normal"
    session_id = "sess_normal_001"

    _write_entry(
        log,
        type=EntryType.USER_QUERY.value,
        session_id=session_id,
        user_id=user_id,
        content="What is the current XAUUSD trend?",
        timestamp=ts(0),
    )
    _write_entry(
        log,
        type=EntryType.USER_QUERY.value,
        session_id=session_id,
        user_id=user_id,
        content="How should I set my stop loss?",
        timestamp=ts(10),
    )

    miner = PatternMiner(jsonl_logger=log)
    matches = miner.mine_session(user_id, session_id)
    revenge_matches = [m for m in matches if m.pattern_type == "revenge_trading"]
    assert len(revenge_matches) == 0


# ------------------------------------------------------------------
# Analysis paralysis
# ------------------------------------------------------------------


def test_analysis_paralysis_detected(tmp_path):
    log = _make_logger(tmp_path)
    user_id = "user-paralysis"
    session_id = "sess_para_001"

    doubt_questions = [
        "Should I enter XAUUSD or is it too risky?",
        "I'm not sure if I should go long, what do you think?",
        "Is this the right entry point? I'm uncertain.",
        "What if the price reverses after I enter?",
        "Should I wait for another candle? I'm scared.",
    ]
    for i, q in enumerate(doubt_questions):
        _write_entry(
            log,
            type=EntryType.USER_QUERY.value,
            session_id=session_id,
            user_id=user_id,
            content=q,
            timestamp=ts(i * 8),  # Every 8 minutes — 5 queries in 32 minutes
        )

    miner = PatternMiner(jsonl_logger=log)
    matches = miner.mine_session(user_id, session_id)
    para_matches = [m for m in matches if m.pattern_type == "analysis_paralysis"]
    assert len(para_matches) >= 1


# ------------------------------------------------------------------
# Ignored critical warnings
# ------------------------------------------------------------------


def test_ignored_warning_detected(tmp_path):
    log = _make_logger(tmp_path)
    user_id = "user-ignored"
    session_id = "sess_ignore_001"

    # AI issued a critical warning
    _write_entry(
        log,
        type=EntryType.ASSISTANT_RESPONSE.value,
        session_id=session_id,
        user_id=user_id,
        content="CRITICAL: Your account is over-leveraged. Do not open new positions.",
        risk_assessment=RiskAssessment(level="critical", factors=["over-leveraged"], score=95),
        timestamp=ts(0),
    )
    # No acknowledgment — user continues asking about entering trades (5 minutes later)
    _write_entry(
        log,
        type=EntryType.USER_QUERY.value,
        session_id=session_id,
        user_id=user_id,
        content="What's the best entry for EURUSD right now?",
        timestamp=ts(5),
    )

    miner = PatternMiner(jsonl_logger=log)
    matches = miner.mine_session(user_id, session_id)
    ignored = [m for m in matches if m.pattern_type == "ignored_critical_warning"]
    assert len(ignored) >= 1


def test_warning_acknowledged_no_pattern(tmp_path):
    log = _make_logger(tmp_path)
    user_id = "user-acked"
    session_id = "sess_ack_001"

    _write_entry(
        log,
        type=EntryType.ASSISTANT_RESPONSE.value,
        session_id=session_id,
        user_id=user_id,
        content="CRITICAL: Revenge trading detected.",
        risk_assessment=RiskAssessment(level="critical", factors=["revenge"], score=90),
        timestamp=ts(0),
    )
    # User acknowledges the warning
    _write_entry(
        log,
        type=EntryType.USER_QUERY.value,
        session_id=session_id,
        user_id=user_id,
        content="Okay, I understand. I will avoid trading for now.",
        timestamp=ts(3),
    )

    miner = PatternMiner(jsonl_logger=log)
    matches = miner.mine_session(user_id, session_id)
    ignored = [m for m in matches if m.pattern_type == "ignored_critical_warning"]
    assert len(ignored) == 0


# ------------------------------------------------------------------
# RISK_WARNINGS.md update
# ------------------------------------------------------------------


def test_risk_warnings_updated(tmp_path):
    log = _make_logger(tmp_path)
    md_dir = tmp_path / "markdown"
    md_dir.mkdir()

    user_id = "user-md"
    session_id = "sess_md_001"

    _write_entry(
        log,
        type=EntryType.USER_QUERY.value,
        session_id=session_id,
        user_id=user_id,
        content="I lost big and want to get it back double down",
        timestamp=ts(0),
    )
    _write_entry(
        log,
        type=EntryType.USER_QUERY.value,
        session_id=session_id,
        user_id=user_id,
        content="Should I go all-in now?",
        timestamp=ts(5),
    )

    miner = PatternMiner(
        jsonl_logger=log,
        markdown_dir_fn=lambda uid: md_dir,
    )
    miner.mine_session(user_id, session_id)

    risk_file = md_dir / "RISK_WARNINGS.md"
    assert risk_file.exists()
    content = risk_file.read_text()
    assert "revenge_trading" in content.lower() or "Revenge" in content
