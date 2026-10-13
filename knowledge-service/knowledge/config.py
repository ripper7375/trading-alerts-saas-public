"""The configuration the service runs on: index settings, the dispatch matrix, and where things live.

`index.yaml` is read once into an immutable `IndexConfig`; the loader refuses a scoring setup that would change what
`weights=0.7` means (4.7). The dispatch matrix is the monolith's `config/intake/dispatch-matrix.v1.json` (a synced copy
sits beside the service, see `scripts/intake/sync_knowledge_config.py`); this service reads which domains each intent
searches from it and never types them again.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from types import MappingProxyType
from typing import Any, Mapping

import yaml

from .canonical import normalize_text, sha256_json
from .errors import ConfigError, Problem
from .tags import Tags

SERVICE_ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = SERVICE_ROOT / "config"

INDEX_CONFIG_SCHEMA = "index-config/1"
MATRIX_SCHEMA = "dispatch-matrix/1"
GLOSSARY_VERSION_SCHEMA = "glossary-version/1"

REVISION_RE = re.compile(r"^[0-9a-f]{40}$")
ROUTING_VERSION_RE = re.compile(r"^routing-v[0-9]+$")
# the packet's own pattern for a version string (lib/intake/packet.ts VERSION)
VERSION_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$")

# D2 is the playbook domain: its chunks are searched only for the sensors of M* (4.5, 4.7, D11 (a))
PLAYBOOK_DOMAIN = "D2"
PLAYBOOKS_M_STAR = "M_STAR"
PLAYBOOKS_NONE = "NONE"

# the scoring set-up 4.7 depends on: keyword scores normalised, so a single weight w means w * dense + (1 - w) * keyword
REQUIRED_SCORING = MappingProxyType({"method": "bm25", "terms": True, "normalize": True})


def _read_text(path: Path) -> str:
    try:
        return normalize_text(path.read_bytes().decode("utf-8"))
    except (OSError, UnicodeDecodeError) as error:
        raise ConfigError(f"{path.name}: {error}") from error


# ---------------------------------------------------------------------------
# index.yaml
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ChunkerConfig:
    min_tokens: int
    max_tokens: int
    max_chars: int


@dataclass(frozen=True)
class IndexConfig:
    raw: dict[str, Any]  # the parsed file, for the build id; read it, do not change it
    model_repo: str
    model_revision: str
    embeddings: dict[str, Any]  # what txtai is given, minus the model path; read it, do not change it
    weights: float
    candidates: int
    limit: int
    expansions_max: int
    budget_tokens: int
    intent_templates: Mapping[str, str]
    chunker: ChunkerConfig

    @property
    def sha256(self) -> str:
        return sha256_json(self.raw)

    def embeddings_config(self, model_path: str | Path) -> dict[str, Any]:
        """The configuration dictionary handed to `txtai.Embeddings`, with the local model path filled in."""
        config = json.loads(json.dumps(self.embeddings))  # a deep, mutable copy
        config["path"] = str(model_path)
        return config


def parse_index_config(raw: object) -> IndexConfig:
    """Validate an `index.yaml` document. Raises ConfigError listing every problem found."""
    problems: list[Problem] = []

    def bad(where: str, message: str) -> None:
        problems.append(Problem(f"index.yaml:{where}", "BAD_INDEX_CONFIG", message))

    if not isinstance(raw, dict) or raw.get("schema") != INDEX_CONFIG_SCHEMA:
        raise ConfigError(f"index.yaml: schema must be {INDEX_CONFIG_SCHEMA}")

    model = raw.get("model")
    repo = revision = ""
    if not isinstance(model, dict):
        bad("model", "a mapping")
    else:
        repo = model.get("repo") if isinstance(model.get("repo"), str) else ""
        revision = model.get("revision") if isinstance(model.get("revision"), str) else ""
        if not repo:
            bad("model.repo", "the model's repository id")
        if not REVISION_RE.match(revision):
            bad("model.revision", "a full 40-character commit hash: a branch name is not a pin (D12)")

    embeddings = raw.get("embeddings")
    if not isinstance(embeddings, dict):
        bad("embeddings", "a mapping")
        embeddings = {}
    else:
        if embeddings.get("content") is not True:
            bad("embeddings.content", "must be true: the SQL of 4.7 reads the content store")
        if "path" in embeddings:
            bad("embeddings.path", "the model path comes from model.repo and the local directory, not from here")
        scoring = embeddings.get("scoring")
        if scoring != dict(REQUIRED_SCORING):
            bad(
                "embeddings.scoring",
                f"must be exactly {dict(REQUIRED_SCORING)}: with keyword scores not normalised txtai fuses by "
                "rank and weights=0.7 would weight rank positions, not scores (4.7)",
            )

    search = raw.get("search")
    weights = 0.0
    candidates = limit = expansions_max = budget = 0
    templates: dict[str, str] = {}
    if not isinstance(search, dict):
        bad("search", "a mapping")
    else:
        w = search.get("weights")
        if isinstance(w, bool) or not isinstance(w, (int, float)) or not 0 < float(w) < 1:
            bad("search.weights", "a number above 0 and below 1: both the dense and the keyword score must count")
        else:
            weights = float(w)

        def whole(key: str, minimum: int) -> int:
            value = search.get(key)
            if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
                bad(f"search.{key}", f"a whole number of at least {minimum}")
                return 0
            return value

        candidates = whole("candidates", 1)
        limit = whole("limit", 1)
        expansions_max = whole("expansions_max", 0)
        budget = whole("budget_tokens", 1)
        if candidates and limit and candidates < limit:
            bad("search.candidates", "must be at least search.limit")
        raw_templates = search.get("intent_templates")
        if not isinstance(raw_templates, dict) or not all(
            isinstance(k, str) and isinstance(v, str) for k, v in raw_templates.items()
        ):
            bad("search.intent_templates", "a mapping of intent label to template text")
        else:
            templates = dict(raw_templates)

    chunker = raw.get("chunker")
    chunker_config = ChunkerConfig(0, 0, 0)
    if not isinstance(chunker, dict):
        bad("chunker", "a mapping")
    else:
        values = {}
        for key in ("min_tokens", "max_tokens", "max_chars"):
            value = chunker.get(key)
            if isinstance(value, bool) or not isinstance(value, int) or value < 1:
                bad(f"chunker.{key}", "a positive whole number")
            values[key] = value if isinstance(value, int) and not isinstance(value, bool) else 0
        if values["min_tokens"] and values["max_tokens"] and values["min_tokens"] >= values["max_tokens"]:
            bad("chunker.min_tokens", "must be below chunker.max_tokens")
        chunker_config = ChunkerConfig(values["min_tokens"], values["max_tokens"], values["max_chars"])

    if problems:
        raise ConfigError(problems)
    return IndexConfig(
        raw=json.loads(json.dumps(raw)),
        model_repo=repo,
        model_revision=revision,
        embeddings=json.loads(json.dumps(embeddings)),
        weights=weights,
        candidates=candidates,
        limit=limit,
        expansions_max=expansions_max,
        budget_tokens=budget,
        intent_templates=MappingProxyType(templates),
        chunker=chunker_config,
    )


def load_index_config(path: Path | None = None) -> IndexConfig:
    path = path or CONFIG_DIR / "index.yaml"
    try:
        raw = yaml.safe_load(_read_text(path))
    except yaml.YAMLError as error:
        raise ConfigError(f"{path.name}: {error}") from error
    return parse_index_config(raw)


# ---------------------------------------------------------------------------
# the dispatch matrix
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class IntentRule:
    domains: tuple[str, ...]  # the general domains the intent searches, in rank order
    playbooks: str  # PLAYBOOKS_M_STAR: D2 chunks of the sensors in M* too; PLAYBOOKS_NONE: no D2 at all


@dataclass(frozen=True)
class Matrix:
    version: str  # "routing-v1"
    intents: Mapping[str, IntentRule]
    sha256: str


def parse_matrix(raw: object, tags: Tags) -> Matrix:
    problems: list[Problem] = []

    def bad(where: str, message: str) -> None:
        problems.append(Problem(f"dispatch-matrix:{where}", "BAD_MATRIX", message))

    if not isinstance(raw, dict) or raw.get("schema") != MATRIX_SCHEMA:
        raise ConfigError(f"dispatch matrix: schema must be {MATRIX_SCHEMA}")
    version = raw.get("version")
    if not isinstance(version, str) or not ROUTING_VERSION_RE.match(version):
        bad("version", "a routing version such as routing-v1")
        version = ""
    intents_raw = raw.get("intents")
    intents: dict[str, IntentRule] = {}
    if not isinstance(intents_raw, dict) or not intents_raw:
        bad("intents", "a non-empty mapping")
    else:
        for label, rule in intents_raw.items():
            if not isinstance(rule, dict):
                bad(label, "a mapping")
                continue
            domains = rule.get("domains")
            playbooks = rule.get("playbooks")
            if not isinstance(domains, list) or not all(isinstance(d, str) for d in domains):
                bad(f"{label}.domains", "a list of domain ids")
                continue
            unknown = [d for d in domains if d not in tags.domains]
            if unknown:
                bad(f"{label}.domains", f"not in tags.yaml: {unknown}")
            if len(set(domains)) != len(domains):
                bad(f"{label}.domains", "a domain twice")
            if PLAYBOOK_DOMAIN in domains:
                bad(
                    f"{label}.domains",
                    f"{PLAYBOOK_DOMAIN} (the playbooks) enters through `playbooks` so that it is always scoped to M*",
                )
            if playbooks not in (PLAYBOOKS_M_STAR, PLAYBOOKS_NONE):
                bad(f"{label}.playbooks", f"{PLAYBOOKS_M_STAR} or {PLAYBOOKS_NONE}")
                continue
            ordered = tuple(sorted((d for d in domains if d in tags.domains), key=tags.domain_rank))
            intents[label] = IntentRule(domains=ordered, playbooks=playbooks)
    if problems:
        raise ConfigError(problems)
    return Matrix(version=version, intents=MappingProxyType(intents), sha256=sha256_json(raw))


def default_matrix_path() -> Path:
    """The service's own copy first (it is all a Railway build has), the monolith's file when run from the repo."""
    own = CONFIG_DIR / "intake" / "dispatch-matrix.v1.json"
    if own.is_file():
        return own
    return SERVICE_ROOT.parent / "config" / "intake" / "dispatch-matrix.v1.json"


def load_matrix(tags: Tags, path: Path | None = None) -> Matrix:
    path = path or default_matrix_path()
    try:
        raw = json.loads(_read_text(path))
    except ValueError as error:
        raise ConfigError(f"{path.name}: {error}") from error
    return parse_matrix(raw, tags)


def check_templates(index_config: IndexConfig, matrix: Matrix) -> None:
    """Every intent of the matrix has a retrieval template and the templates name no other intent (ADR-043)."""
    have, want = set(index_config.intent_templates), set(matrix.intents)
    if have != want:
        raise ConfigError(
            [
                Problem(
                    "index.yaml:search.intent_templates",
                    "TEMPLATES_DISAGREE",
                    f"missing {sorted(want - have)}, not in the matrix {sorted(have - want)}",
                )
            ]
        )


def load_glossary_version(path: Path | None = None) -> str:
    path = path or CONFIG_DIR / "intake" / "glossary-version.json"
    try:
        raw = json.loads(_read_text(path))
    except ValueError as error:
        raise ConfigError(f"{path.name}: {error}") from error
    version = raw.get("version") if isinstance(raw, dict) else None
    if (
        not isinstance(raw, dict)
        or raw.get("schema") != GLOSSARY_VERSION_SCHEMA
        or not isinstance(version, str)
        or version == ""
    ):
        raise ConfigError(f"{path.name}: not a {GLOSSARY_VERSION_SCHEMA} file with a version")
    return version


# ---------------------------------------------------------------------------
# the process environment
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Settings:
    service_key: str | None
    index_dir: Path
    model_dir: Path
    matrix_path: Path | None

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> "Settings":
        env = os.environ if env is None else env
        key = env.get("KNOWLEDGE_SERVICE_KEY")
        matrix = env.get("KNOWLEDGE_MATRIX_PATH")
        return cls(
            service_key=key if key else None,
            index_dir=Path(env.get("KNOWLEDGE_INDEX_DIR") or SERVICE_ROOT / "index"),
            model_dir=Path(env.get("KNOWLEDGE_MODEL_DIR") or default_model_dir()),
            matrix_path=Path(matrix) if matrix else None,
        )


def default_model_dir() -> Path:
    return SERVICE_ROOT / "models" / "all-MiniLM-L6-v2"
