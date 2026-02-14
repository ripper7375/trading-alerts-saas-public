"""Advice Attributor — link AI advice to actual trading outcomes.

After the AI gives advice in a session, subsequent trades are linked back
to that advice to calculate:
  - Whether the advice was followed
  - The trade P&L resulting from following / ignoring the advice
  - An effectiveness score (0–100) for quality feedback loops

Effectiveness scoring model (from the architecture doc):
  critical + followed + won  = 100
  critical + followed + lost =  60  (market is random; advice was sound)
  critical + ignored  + lost =  90  (advice proved right)
  critical + ignored  + won  =  20  (trader got lucky)
  high     + followed + won  =  85
  high     + followed + lost =  50
  medium   + followed + won  =  70
  medium   + ignored  + lost =  75
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from .jsonl_logger import JSONLLogger

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Outcome types
# ---------------------------------------------------------------------------

_ACKNOWLEDGMENT = {"ok", "okay", "understood", "got it", "i see", "will do", "noted",
                   "fair enough"}


@dataclass
class AdviceOutcome:
    session_id: str
    user_id: str
    advice_entry_id: str
    advice_risk_level: str       # low | medium | high | critical
    advice_summary: str

    trader_response: str         # followed | ignored | partially_followed | unclear
    trade_id: str | None         # linked trade if exists
    trade_pnl: float | None      # actual P&L of subsequent trade

    effectiveness_score: int     # 0–100
    attributed_at: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "user_id": self.user_id,
            "advice_entry_id": self.advice_entry_id,
            "advice_risk_level": self.advice_risk_level,
            "advice_summary": self.advice_summary,
            "trader_response": self.trader_response,
            "trade_id": self.trade_id,
            "trade_pnl": self.trade_pnl,
            "effectiveness_score": self.effectiveness_score,
            "attributed_at": self.attributed_at,
        }


# ---------------------------------------------------------------------------
# AdviceAttributor
# ---------------------------------------------------------------------------


class AdviceAttributor:
    """Link AI advice sessions to subsequent trade outcomes.

    Parameters
    ----------
    jsonl_logger:
        JSONLLogger instance for reading session entries and writing outcomes.
    get_trade_fn:
        Optional async callable ``(trade_id) -> dict | None`` that fetches a
        trade record from PostgreSQL.  Supply this for full P&L attribution.
    """

    def __init__(
        self,
        jsonl_logger: JSONLLogger,
        get_trade_fn: Any = None,
    ) -> None:
        self._log = jsonl_logger
        self._get_trade = get_trade_fn

    # ------------------------------------------------------------------
    # Attribute outcomes for a session
    # ------------------------------------------------------------------

    def attribute_session(
        self,
        user_id: str,
        session_id: str,
        trade_id: str | None = None,
        trade_pnl: float | None = None,
    ) -> list[AdviceOutcome]:
        """Compute advice outcomes for all assistant responses in a session.

        Parameters
        ----------
        trade_id:
            The trade taken after this session (if known).
        trade_pnl:
            The P&L of that trade (positive = profit, negative = loss).
        """
        entries = self._log.read_session_by_id(user_id, session_id)
        if not entries:
            return []

        outcomes: list[AdviceOutcome] = []
        advice_entries = [
            e for e in entries
            if e.get("type") == "assistant_response"
            and e.get("risk_assessment")
        ]
        user_messages = [
            e for e in entries if e.get("type") == "user_query" and e.get("content")
        ]

        for advice_entry in advice_entries:
            risk = advice_entry.get("risk_assessment") or {}
            risk_level = risk.get("level", "low") if isinstance(risk, dict) else "low"

            # Determine trader response from subsequent user messages
            trader_response = self._infer_response(
                advice_entry, user_messages, trade_id, trade_pnl
            )

            score = self._score(risk_level, trader_response, trade_pnl)

            outcome = AdviceOutcome(
                session_id=session_id,
                user_id=user_id,
                advice_entry_id=advice_entry.get("entry_id", ""),
                advice_risk_level=risk_level,
                advice_summary=str(advice_entry.get("content", ""))[:300],
                trader_response=trader_response,
                trade_id=trade_id,
                trade_pnl=trade_pnl,
                effectiveness_score=score,
                attributed_at=datetime.now(timezone.utc).isoformat(),
            )
            outcomes.append(outcome)

            # Persist to analytics
            self._log.log_analytics(user_id, "advice_outcomes", outcome.to_dict())

        return outcomes

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _infer_response(
        self,
        advice_entry: dict[str, Any],
        user_messages: list[dict[str, Any]],
        trade_id: str | None,
        trade_pnl: float | None,
    ) -> str:
        """Infer whether the trader followed, ignored, or partially followed advice."""
        advice_ts_str = advice_entry.get("timestamp", "")
        advice_ts = _parse_ts(advice_ts_str)
        if advice_ts is None:
            return "unclear"

        # Look for explicit acknowledgment in the next 10 minutes
        for msg in user_messages:
            msg_ts = _parse_ts(msg.get("timestamp", ""))
            if msg_ts is None or msg_ts <= advice_ts:
                continue
            if (msg_ts - advice_ts).total_seconds() > 600:
                break
            text = msg.get("content", "").lower()
            if any(ack in text for ack in _ACKNOWLEDGMENT):
                # Followed — if there's a subsequent trade in the opposite direction
                # of a "avoid trading" recommendation that counts as ignored
                return "followed"
            if any(w in text for w in ("ignore", "disagree", "no", "but", "however")):
                return "ignored"

        # If a trade happened after the advice, compare sizing vs. recommendation
        if trade_id is not None:
            # Without DB access we can only say "partially_followed" as a default
            return "partially_followed"

        return "unclear"

    @staticmethod
    def _score(
        risk_level: str,
        trader_response: str,
        trade_pnl: float | None,
    ) -> int:
        """Calculate advice effectiveness score 0–100."""
        won = trade_pnl is not None and trade_pnl > 0
        lost = trade_pnl is not None and trade_pnl <= 0
        followed = trader_response == "followed"
        ignored = trader_response == "ignored"

        matrix: dict[tuple[str, bool, bool], int] = {
            ("critical", True, True):   100,   # critical + followed + won
            ("critical", True, False):   60,   # critical + followed + lost
            ("critical", False, False):  90,   # critical + ignored  + lost
            ("critical", False, True):   20,   # critical + ignored  + won
            ("high",     True, True):    85,
            ("high",     True, False):   50,
            ("high",     False, False):  75,
            ("high",     False, True):   25,
            ("medium",   True, True):    70,
            ("medium",   True, False):   45,
            ("medium",   False, False):  65,
            ("medium",   False, True):   30,
            ("low",      True, True):    60,
            ("low",      True, False):   40,
            ("low",      False, False):  55,
            ("low",      False, True):   35,
        }
        key = (risk_level, followed, won if (won or lost) else True)
        return matrix.get(key, 50)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _parse_ts(ts_str: str) -> datetime | None:
    if not ts_str:
        return None
    try:
        dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
    except ValueError:
        return None
