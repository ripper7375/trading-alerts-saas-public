"""RAG Engine — main orchestrator tying together all dual-memory components.

This is the single entry-point that a chat handler calls for every
user interaction.  It implements the full query flow from the architecture:

    User Query
      → 1. Log to JSONL (write-first)
      → 2. Load Markdown context via MemSearch hybrid search
      → 3. Log context loaded
      → 4. Detect behavioral flags (late-night, emotional language, etc.)
      → 5. Return (context_chunks, behavioral_flags, files_loaded)
         for the LLM to synthesize a response
      → 6. Log assistant response + risk level
      → 7. (async background) PatternMiner.mine_session()

The RAG Engine does NOT call the LLM itself — it prepares the context
and logs the outcome.  The calling code is responsible for invoking the LLM
and passing the response back to ``log_response()``.

Usage example::

    engine = RAGEngine(user_id="abc123")
    ctx = await engine.prepare_context(query, session_id=session_id)
    # ... call LLM with ctx.chunks ...
    await engine.log_response(
        session_id=session_id,
        content=llm_response,
        risk_level="high",
        risk_factors=["oversized position", "late night"],
    )
"""

from __future__ import annotations

import asyncio
import logging
import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .jsonl_logger import (
    JSONLLogger,
    JSONLEntry,
    EntryType,
    BehavioralFlags,
    RiskAssessment,
    MarketConditions,
)
from .markdown_memory import MarkdownMemoryManager

logger = logging.getLogger(__name__)

# Simple emotion detection (for behavioral flags)
_EMOTIONAL_WORDS = re.compile(
    r"\b(desperate|panic|scared|terrified|angry|frustrated|furious|stupid|"
    r"idiot|hate|fear|revenge|hope|pray|please|must|have to)\b",
    re.IGNORECASE,
)
_LATE_NIGHT_HOURS = {22, 23, 0, 1, 2}


# ---------------------------------------------------------------------------
# Context result returned to the chat handler
# ---------------------------------------------------------------------------


@dataclass
class QueryContext:
    """Everything the LLM needs to generate a response, plus audit metadata."""

    query: str
    session_id: str
    user_id: str
    entry_id: str                          # JSONL entry ID of the logged query

    # Retrieved markdown chunks (from memsearch hybrid search)
    chunks: list[dict[str, Any]] = field(default_factory=list)

    # File names loaded (for JSONL logging)
    markdown_files_loaded: list[str] = field(default_factory=list)

    # Number of vector results returned
    vector_search_results: int = 0

    # Detected behavioral flags
    behavioral_flags: BehavioralFlags = field(default_factory=BehavioralFlags)

    # Detected market conditions (caller-supplied)
    market_conditions: MarketConditions | None = None


# ---------------------------------------------------------------------------
# RAGEngine
# ---------------------------------------------------------------------------


class RAGEngine:
    """Main orchestrator for the dual-memory trading advisory RAG system.

    Parameters
    ----------
    user_id:
        UUID of the trader.
    log_base_dir:
        Root for JSONL files.  Defaults to ``~/logs``.
    workspace_base_dir:
        Root for markdown profiles.  Defaults to ``~/workspace``.
    milvus_uri:
        Milvus connection URI for MemSearch.
    embedding_provider:
        Embedding backend (``"openai"``, ``"local"``, etc.).
    run_pattern_mining:
        Whether to run PatternMiner on each session in the background.
    flush_every:
        JSONLLogger buffer size (1 = write-first guarantee).
    """

    def __init__(
        self,
        user_id: str,
        *,
        log_base_dir: str | Path | None = None,
        workspace_base_dir: str | Path | None = None,
        milvus_uri: str = "~/.memsearch/milvus.db",
        embedding_provider: str = "openai",
        embedding_model: str | None = None,
        llm_provider: str = "openai",
        run_pattern_mining: bool = True,
        flush_every: int = 1,
    ) -> None:
        self.user_id = user_id

        self._jsonl = JSONLLogger(base_dir=log_base_dir, flush_every=flush_every)

        self._memory = MarkdownMemoryManager(
            user_id=user_id,
            base_dir=workspace_base_dir,
            milvus_uri=milvus_uri,
            embedding_provider=embedding_provider,
            embedding_model=embedding_model,
            llm_provider=llm_provider,
        )
        self._run_pattern_mining = run_pattern_mining
        self._initialised = False

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def initialise(self) -> None:
        """One-time async setup: create profile files and index markdown."""
        if self._initialised:
            return
        self._memory.ensure_profile_files()
        await self._memory.index()
        self._memory.start_watcher()
        self._initialised = True
        logger.info("RAGEngine initialised for user %s", self.user_id)

    # ------------------------------------------------------------------
    # Core query flow
    # ------------------------------------------------------------------

    async def prepare_context(
        self,
        query: str,
        *,
        session_id: str | None = None,
        mt5_account_id: str | None = None,
        market_conditions: MarketConditions | None = None,
        top_k: int = 5,
    ) -> QueryContext:
        """Step 1–4 of the chat query flow.

        1. Log user query to JSONL (write-first)
        2. Detect behavioral flags
        3. Hybrid search markdown memory for relevant context
        4. Log context loaded

        Returns QueryContext with chunks ready for the LLM.
        """
        if not self._initialised:
            await self.initialise()

        sid = session_id or f"sess_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()

        # Detect behavioral flags from the query text
        flags = self._detect_flags(query, now)

        # Step 1 — log user query (WRITE FIRST)
        query_entry = JSONLEntry(
            type=EntryType.USER_QUERY.value,
            session_id=sid,
            user_id=self.user_id,
            mt5_account_id=mt5_account_id,
            content=query,
            market_conditions=market_conditions,
            behavioral_flags=flags,
        )
        self._jsonl.log(query_entry)

        # Step 2 — hybrid semantic search over markdown profiles
        chunks, files_loaded = await self._memory.search_with_files(query, top_k=top_k)

        # Step 3 — log context loaded
        context_entry = JSONLEntry(
            type=EntryType.SYSTEM_EVENT.value,
            session_id=sid,
            user_id=self.user_id,
            content=f"Loaded {len(files_loaded)} markdown files, {len(chunks)} chunks",
            markdown_files_loaded=files_loaded,
            vector_search_results=len(chunks),
        )
        self._jsonl.log(context_entry)

        return QueryContext(
            query=query,
            session_id=sid,
            user_id=self.user_id,
            entry_id=query_entry.entry_id,
            chunks=chunks,
            markdown_files_loaded=files_loaded,
            vector_search_results=len(chunks),
            behavioral_flags=flags,
            market_conditions=market_conditions,
        )

    async def log_response(
        self,
        session_id: str,
        content: str,
        *,
        risk_level: str = "low",
        risk_factors: list[str] | None = None,
        risk_score: int = 0,
        market_conditions: MarketConditions | None = None,
        markdown_files_loaded: list[str] | None = None,
        vector_search_results: int | None = None,
    ) -> JSONLEntry:
        """Step 5 — log the LLM's response and risk assessment.

        Call this after the LLM has generated its response.
        """
        risk = RiskAssessment(
            level=risk_level,
            factors=risk_factors or [],
            score=risk_score,
        )
        response_entry = JSONLEntry(
            type=EntryType.ASSISTANT_RESPONSE.value,
            session_id=session_id,
            user_id=self.user_id,
            content=content,
            risk_assessment=risk,
            market_conditions=market_conditions,
            markdown_files_loaded=markdown_files_loaded,
            vector_search_results=vector_search_results,
        )
        self._jsonl.log(response_entry)

        # Step 6 — background pattern mining
        if self._run_pattern_mining:
            asyncio.create_task(self._background_mine(session_id))

        return response_entry

    async def log_tool_call(
        self,
        session_id: str,
        tool_name: str,
        params: dict[str, Any],
        result: dict[str, Any] | None = None,
    ) -> None:
        """Log a tool invocation (and optional result) to JSONL."""
        call_entry = JSONLEntry(
            type=EntryType.TOOL_CALL.value,
            session_id=session_id,
            user_id=self.user_id,
            tool=tool_name,
            params=params,
        )
        self._jsonl.log(call_entry)

        if result is not None:
            result_entry = JSONLEntry(
                type=EntryType.TOOL_RESULT.value,
                session_id=session_id,
                user_id=self.user_id,
                tool=tool_name,
                result=result,
            )
            self._jsonl.log(result_entry)

    # ------------------------------------------------------------------
    # Background analytics
    # ------------------------------------------------------------------

    async def _background_mine(self, session_id: str) -> None:
        """Run PatternMiner in background after each session."""
        try:
            from .pattern_miner import PatternMiner

            miner = PatternMiner(
                jsonl_logger=self._jsonl,
                markdown_dir_fn=lambda uid: self._memory.markdown_dir,
            )
            # Run in a thread to avoid blocking the event loop
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None, miner.mine_session, self.user_id, session_id
            )
        except Exception as exc:
            logger.error("Background pattern mining failed for session %s: %s", session_id, exc)

    # ------------------------------------------------------------------
    # Behavioral flag detection
    # ------------------------------------------------------------------

    def _detect_flags(self, query: str, timestamp: str) -> BehavioralFlags:
        try:
            hour = datetime.fromisoformat(timestamp.replace("Z", "+00:00")).hour
        except ValueError:
            hour = datetime.now(timezone.utc).hour

        return BehavioralFlags(
            late_night_query=hour in _LATE_NIGHT_HOURS,
            emotional_language=bool(_EMOTIONAL_WORDS.search(query)),
        )

    # ------------------------------------------------------------------
    # Convenience: memory search
    # ------------------------------------------------------------------

    async def search_memory(
        self,
        query: str,
        top_k: int = 5,
    ) -> list[dict[str, Any]]:
        """Direct search of the trader's markdown memory (no logging)."""
        if not self._initialised:
            await self.initialise()
        return await self._memory.search(query, top_k=top_k)

    async def update_profile_from_insights(
        self,
        filename: str,
        new_section: str,
    ) -> None:
        """Append new content to a profile markdown file.

        The MemSearch file watcher will re-index within ~1.5 s automatically.
        """
        self._memory.append_to_profile_file(filename, new_section)

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def close(self) -> None:
        self._jsonl.flush()
        self._memory.close()

    def __enter__(self) -> RAGEngine:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()
