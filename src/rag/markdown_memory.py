"""Markdown Memory Manager — per-user MemSearch instances over trader profiles.

This is the READ side of the dual-memory system.  It wraps memsearch's
``MemSearch`` class and provides:

  - Per-user collection isolation in Milvus
  - Automatic indexing / re-indexing of the 9 standard markdown profile files
  - Hybrid semantic+BM25 search scoped to a single trader
  - Memory compaction: compress JSONL insights → updated markdown profile files
  - Live file watching so PatternMiner updates are picked up within 1.5 s

Directory structure expected (created automatically):
    ~/workspace/users/{user_id}/markdown/
    ├── TRADER_PROFILE.md
    ├── BEHAVIORAL_LOW_VOLATILITY.md
    ├── BEHAVIORAL_HIGH_VOLATILITY.md
    ├── BEHAVIORAL_TRENDING.md
    ├── BEHAVIORAL_RANGING.md
    ├── RISK_WARNINGS.md
    ├── ACTIVE_POSITIONS.md
    ├── PERFORMANCE_SUMMARY.md
    └── LEARNING_NOTES.md

memsearch dependency: seed-code/memsearch (installed as 'memsearch' package).
"""

from __future__ import annotations

import asyncio
import logging
import shutil
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Standard profile files every trader has (populated from templates on first use)
PROFILE_FILES: list[str] = [
    "TRADER_PROFILE.md",
    "BEHAVIORAL_LOW_VOLATILITY.md",
    "BEHAVIORAL_HIGH_VOLATILITY.md",
    "BEHAVIORAL_TRENDING.md",
    "BEHAVIORAL_RANGING.md",
    "RISK_WARNINGS.md",
    "ACTIVE_POSITIONS.md",
    "PERFORMANCE_SUMMARY.md",
    "LEARNING_NOTES.md",
]

# Template directory ships alongside this module
_TEMPLATES_DIR = Path(__file__).parent / "templates"


class MarkdownMemoryManager:
    """Manages per-user semantic memory built on top of memsearch.

    Parameters
    ----------
    user_id:
        Unique identifier for the trader (UUID string).
    base_dir:
        Root workspace directory.  Defaults to ``~/workspace``.
    milvus_uri:
        Milvus connection URI.  Defaults to ``~/.memsearch/milvus.db``
        (Milvus Lite — zero config, single file).
    embedding_provider:
        Embedding backend: ``"openai"``, ``"google"``, ``"voyage"``,
        ``"ollama"``, or ``"local"``.
    embedding_model:
        Override the default model for the chosen provider.
    llm_provider:
        LLM backend used by ``compact()``: ``"openai"``, ``"anthropic"``,
        or ``"gemini"``.
    """

    def __init__(
        self,
        user_id: str,
        *,
        base_dir: str | Path | None = None,
        milvus_uri: str = "~/.memsearch/milvus.db",
        embedding_provider: str = "openai",
        embedding_model: str | None = None,
        llm_provider: str = "openai",
    ) -> None:
        self.user_id = user_id
        self._llm_provider = llm_provider
        self._base = Path(base_dir).expanduser() if base_dir else Path.home() / "workspace"
        self._markdown_dir = self._base / "users" / user_id / "markdown"
        self._markdown_dir.mkdir(parents=True, exist_ok=True)

        # Each user gets an isolated Milvus collection: trader_{user_id[:8]}
        collection = f"trader_{user_id.replace('-', '')[:12]}"

        # Lazy import so the module can be imported even without memsearch installed
        try:
            from memsearch import MemSearch  # type: ignore[import]
            self._ms = MemSearch(
                paths=[str(self._markdown_dir)],
                embedding_provider=embedding_provider,
                embedding_model=embedding_model,
                milvus_uri=milvus_uri,
                collection=collection,
            )
            self._memsearch_available = True
        except ImportError:
            logger.warning(
                "memsearch package not installed — markdown memory search disabled. "
                "Install with: pip install memsearch"
            )
            self._ms = None
            self._memsearch_available = False

        self._watcher = None

    # ------------------------------------------------------------------
    # Initialisation
    # ------------------------------------------------------------------

    def ensure_profile_files(self) -> list[Path]:
        """Copy missing profile markdown templates into the user's directory.

        Returns the list of files that were newly created.
        """
        created: list[Path] = []
        for filename in PROFILE_FILES:
            dest = self._markdown_dir / filename
            if dest.exists():
                continue
            src = _TEMPLATES_DIR / filename
            if src.exists():
                shutil.copy2(src, dest)
            else:
                # Create a minimal stub so the directory is valid
                dest.write_text(
                    f"# {filename.replace('.md', '').replace('_', ' ').title()}\n\n"
                    "_No data yet._\n",
                    encoding="utf-8",
                )
            created.append(dest)
            logger.info("Created profile file: %s", dest)
        return created

    async def index(self, *, force: bool = False) -> int:
        """Scan and index all markdown files for this user.

        Returns the number of new chunks indexed.  Re-running on unchanged
        files costs zero embedding API calls (content-addressable dedup).
        """
        if not self._memsearch_available:
            return 0
        self.ensure_profile_files()
        n = await self._ms.index(force=force)
        logger.info("User %s: indexed %d chunks", self.user_id, n)
        return n

    def start_watcher(self) -> None:
        """Start a background file watcher that auto-re-indexes on changes.

        Call this once per process.  PatternMiner can then write updated
        RISK_WARNINGS.md / BEHAVIORAL_*.md files and the index updates
        automatically within ~1.5 s.
        """
        if not self._memsearch_available or self._watcher is not None:
            return
        self._watcher = self._ms.watch()
        logger.info("User %s: markdown watcher started", self.user_id)

    def stop_watcher(self) -> None:
        if self._watcher is not None:
            self._watcher.stop()
            self._watcher = None

    # ------------------------------------------------------------------
    # Search
    # ------------------------------------------------------------------

    async def search(
        self,
        query: str,
        *,
        top_k: int = 5,
    ) -> list[dict[str, Any]]:
        """Retrieve the most relevant profile chunks for a trader query.

        Returns a list of dicts with keys:
            content, source, heading, score, start_line, end_line
        """
        if not self._memsearch_available:
            return []
        results = await self._ms.search(query, top_k=top_k)
        # Add user_id context to each result
        for r in results:
            r["user_id"] = self.user_id
        return results

    async def search_with_files(
        self,
        query: str,
        *,
        top_k: int = 5,
    ) -> tuple[list[dict[str, Any]], list[str]]:
        """Search and return (results, list_of_loaded_file_names).

        The second element can be stored directly in a JSONLEntry's
        ``markdown_files_loaded`` field.
        """
        results = await self.search(query, top_k=top_k)
        loaded_files = list({
            Path(r["source"]).name
            for r in results
            if "source" in r
        })
        return results, loaded_files

    # ------------------------------------------------------------------
    # Profile file helpers
    # ------------------------------------------------------------------

    def read_profile_file(self, filename: str) -> str:
        """Read the raw markdown content of a profile file."""
        path = self._markdown_dir / filename
        if not path.exists():
            return ""
        return path.read_text(encoding="utf-8")

    def write_profile_file(self, filename: str, content: str) -> Path:
        """Overwrite a profile file.  The watcher will re-index it automatically."""
        path = self._markdown_dir / filename
        path.write_text(content, encoding="utf-8")
        logger.info("User %s: updated %s", self.user_id, filename)
        return path

    def append_to_profile_file(self, filename: str, section: str) -> Path:
        """Append a markdown section to a profile file."""
        path = self._markdown_dir / filename
        with open(path, "a", encoding="utf-8") as f:
            f.write("\n\n" + section.strip() + "\n")
        logger.info("User %s: appended to %s", self.user_id, filename)
        return path

    # ------------------------------------------------------------------
    # Memory compaction
    # ------------------------------------------------------------------

    async def compact_profile(
        self,
        source_filename: str,
        *,
        prompt_template: str | None = None,
    ) -> str:
        """Compress a profile file's indexed chunks into an LLM summary.

        The summary is appended to the file's daily compact log and the
        watcher re-indexes it automatically.

        Returns the generated summary markdown string.
        """
        if not self._memsearch_available:
            return ""
        source = str(self._markdown_dir / source_filename)
        summary = await self._ms.compact(
            source=source,
            llm_provider=self._llm_provider,
            output_dir=self._markdown_dir,
            prompt_template=prompt_template,
        )
        logger.info("User %s: compacted %s (%d chars)", self.user_id, source_filename, len(summary))
        return summary

    # ------------------------------------------------------------------
    # Utility
    # ------------------------------------------------------------------

    @property
    def markdown_dir(self) -> Path:
        return self._markdown_dir

    def profile_files(self) -> list[Path]:
        """Return existing profile markdown files for this user."""
        return [self._markdown_dir / f for f in PROFILE_FILES if (self._markdown_dir / f).exists()]

    def close(self) -> None:
        self.stop_watcher()
        if self._ms is not None:
            self._ms.close()

    def __enter__(self) -> MarkdownMemoryManager:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()


# ---------------------------------------------------------------------------
# Registry: cache one MarkdownMemoryManager per user_id
# ---------------------------------------------------------------------------

_registry: dict[str, MarkdownMemoryManager] = {}
_registry_lock = asyncio.Lock() if asyncio.get_event_loop().is_running() else None


def get_memory_manager(
    user_id: str,
    **kwargs: Any,
) -> MarkdownMemoryManager:
    """Return (or create) a MarkdownMemoryManager for the given user.

    Keyword arguments are forwarded to the constructor only on first call.
    """
    if user_id not in _registry:
        _registry[user_id] = MarkdownMemoryManager(user_id, **kwargs)
    return _registry[user_id]
