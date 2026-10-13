"""The index on disk: writing the files around txtai's own, and loading them back with every pin checked.

An index directory holds txtai's files (`config.json`, `embeddings`, `documents`, `scoring`, `scoring.terms`) and two of
ours:

  chunks.json          every chunk with its tags, `related` list and token count (txtai's SQL returns a list field as
                       a JSON string, and the expansions need to look chunks up by id, so the full record is kept here)
  build_metadata.json  the build id, the pins the index was built under, counts and warnings; no time stamp, so the
                       same inputs write the same bytes

`load_index` is what the service starts from. It refuses, with a short code, an index that is not exactly what its
metadata says, was built under other settings than the service runs on, or does not have normalised keyword scores
(without which `weights=0.7` means something else, architecture 4.7).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from importlib import metadata as importlib_metadata
from pathlib import Path
from typing import Any, Mapping

from .canonical import normalize_text, sha256_hex
from .config import REQUIRED_SCORING, VERSION_RE, IndexConfig
from .errors import IndexUnavailable

METADATA_FILE = "build_metadata.json"
CHUNKS_FILE = "chunks.json"
METADATA_SCHEMA = "index-build-metadata/1"
CHUNKS_SCHEMA = "index-chunks/1"


def txtai_version() -> str:
    return importlib_metadata.version("txtai")


def create_embeddings(config: IndexConfig, model_dir: Path):
    """A new, empty `txtai.Embeddings` for this configuration."""
    from txtai import Embeddings  # imported here: loading torch takes seconds and a config check does not need it

    return Embeddings(config.embeddings_config(model_dir))


def chunks_text(records: list[dict[str, Any]]) -> str:
    """The sidecar's text. Written and hashed as one string, so the hash in the metadata is of the file itself."""
    return json.dumps({"schema": CHUNKS_SCHEMA, "chunks": records}, indent=1, sort_keys=True, ensure_ascii=False) + "\n"


@dataclass
class LoadedIndex:
    embeddings: Any  # txtai.Embeddings
    chunks: Mapping[str, dict[str, Any]]  # chunk id -> record, as in chunks.json
    metadata: dict[str, Any]

    @property
    def build_id(self) -> str:
        return self.metadata["index_build_id"]


def _read_json(path: Path, code: str) -> Any:
    try:
        return json.loads(normalize_text(path.read_bytes().decode("utf-8")))
    except (OSError, UnicodeDecodeError, ValueError) as error:
        raise IndexUnavailable(code, f"{path.name}: {error}") from error


def load_index(index_dir: Path, config: IndexConfig, model_dir: Path) -> LoadedIndex:
    """Load and verify an index. Raises IndexUnavailable(code) for anything that is not as it must be."""
    index_dir = Path(index_dir)
    if not (index_dir / METADATA_FILE).is_file():
        raise IndexUnavailable("INDEX_MISSING", f"{index_dir} has no {METADATA_FILE}")
    meta = _read_json(index_dir / METADATA_FILE, "METADATA_UNREADABLE")
    if not isinstance(meta, dict) or meta.get("schema") != METADATA_SCHEMA:
        raise IndexUnavailable("METADATA_SCHEMA", f"{METADATA_FILE} is not {METADATA_SCHEMA}")
    build_id = meta.get("index_build_id")
    if not isinstance(build_id, str) or not VERSION_RE.match(build_id):
        raise IndexUnavailable("METADATA_BUILD_ID", "the build id is missing or is not one the packet accepts")

    # the sidecar must be the file the build wrote
    try:
        sidecar_bytes = (index_dir / CHUNKS_FILE).read_bytes()
    except OSError as error:
        raise IndexUnavailable("CHUNKS_MISSING", str(error)) from error
    if sha256_hex(normalize_text(sidecar_bytes.decode("utf-8", errors="replace"))) != meta.get("chunks_sha256"):
        raise IndexUnavailable("CHUNKS_HASH", f"{CHUNKS_FILE} is not the file the build wrote")
    sidecar = _read_json(index_dir / CHUNKS_FILE, "CHUNKS_UNREADABLE")
    records = sidecar.get("chunks") if isinstance(sidecar, dict) and sidecar.get("schema") == CHUNKS_SCHEMA else None
    if not isinstance(records, list) or len(records) != meta.get("chunk_count"):
        raise IndexUnavailable("CHUNKS_COUNT", f"{CHUNKS_FILE} does not hold the {meta.get('chunk_count')} chunks built")
    chunks = {r["id"]: r for r in records}
    if len(chunks) != len(records):
        raise IndexUnavailable("CHUNKS_DUPLICATE", "a chunk id twice")

    # built under the settings this service runs on, with the library it runs on
    inputs = meta.get("inputs") or {}
    if inputs.get("index_config_sha256") != config.sha256:
        raise IndexUnavailable("CONFIG_CHANGED", "index.yaml is not what the index was built with: rebuild")
    if (inputs.get("model") or {}).get("revision") != config.model_revision:
        raise IndexUnavailable("MODEL_CHANGED", "the model revision is not the one the index was built with")
    if inputs.get("txtai_version") != txtai_version():
        raise IndexUnavailable(
            "TXTAI_CHANGED", f"built with txtai {inputs.get('txtai_version')}, running {txtai_version()}: rebuild"
        )

    try:
        from txtai import Embeddings

        embeddings = Embeddings()
        # the saved configuration holds the model path of the machine that built it; this machine's directory wins
        embeddings.load(str(index_dir), config={"path": str(model_dir)})
    except Exception as error:  # txtai raises many kinds of error for a damaged file
        raise IndexUnavailable("INDEX_CORRUPT", f"{type(error).__name__}: {error}") from error

    if embeddings.config.get("scoring") != dict(REQUIRED_SCORING):
        raise IndexUnavailable("SCORING_CONFIG", "the saved scoring configuration is not bm25 with normalised scores")
    if not (embeddings.isdense() and embeddings.issparse()):
        raise IndexUnavailable("NOT_HYBRID", "the index lacks its dense or its keyword part")
    if embeddings.scoring.isnormalized() is not True:
        raise IndexUnavailable("NOT_NORMALIZED", "keyword scores are not normalised: weights=0.7 would weight ranks")
    if embeddings.count() != len(chunks):
        raise IndexUnavailable("INDEX_COUNT", f"txtai holds {embeddings.count()} documents, chunks.json {len(chunks)}")
    return LoadedIndex(embeddings=embeddings, chunks=chunks, metadata=meta)
