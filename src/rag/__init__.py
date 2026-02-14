"""RAG (Retrieval-Augmented Generation) system for Trading Alerts SaaS.

Implements the dual-memory architecture from:
  RAG_SYSTEM_MODIFICATION_ARCHITECTURE_markdown-memory-and-jsonl-transcript_V2

Two memory layers:
  1. Markdown Memory  — distilled, token-efficient trader profiles (synthesized)
  2. JSONL Transcripts — immutable, append-only audit log of every interaction

memsearch (seed-code/memsearch) provides the vector search backbone for the
Markdown Memory layer via Milvus Lite (local) or Milvus Server / Zilliz Cloud.
"""

from .rag_engine import RAGEngine
from .markdown_memory import MarkdownMemoryManager
from .jsonl_logger import JSONLLogger, JSONLEntry, EntryType
from .pattern_miner import PatternMiner
from .advice_attributor import AdviceAttributor
from .compliance_manager import ComplianceManager

__all__ = [
    "RAGEngine",
    "MarkdownMemoryManager",
    "JSONLLogger",
    "JSONLEntry",
    "EntryType",
    "PatternMiner",
    "AdviceAttributor",
    "ComplianceManager",
]
