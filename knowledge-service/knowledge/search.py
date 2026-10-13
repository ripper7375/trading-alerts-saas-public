"""Retrieval (architecture 4.7; decisions D2, D11; ADR-043): one query, filtered in SQL with bound parameters.

txtai's `search()` has no filter argument, so the scoping is SQL beside `similar()`:

    SELECT id, text, mcd_id, domain, score FROM txtai WHERE similar(:q, 40)
      AND ((domain = :pd AND mcd_id IN (:m0, :m1)) OR domain IN (:d0, :d1)) LIMIT 4

Nothing that arrives in a request is ever part of the SQL text. The question and the state codes are inside the one
bound query string `:q`; a sensor id is a bound parameter only if the registry lists it (any other is dropped); the
domains come from the dispatch matrix (`routing-v1`), not from the request, and the D2 playbooks are searched only for
the sensors of M*. Empty lists build no clause, and a request with nothing left to search answers EMPTY without
searching: an empty scope must never turn into an unfiltered query.

The result is the `knowledge` section of the packet (`lib/intake/packet.ts`): at most 4 chunks in the order foundations,
playbook, synthesis, risk, governance, then the chunks their `related` lists name (at most `expansions_max`, only while
the pack stays inside the knowledge budget of section 5.4), each with its id.
"""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass, field
from typing import Any, Mapping

from .config import (
    PLAYBOOK_DOMAIN,
    PLAYBOOKS_M_STAR,
    IndexConfig,
    Matrix,
)
from .errors import RoutingVersionMismatch, UnknownIntent
from .index import LoadedIndex
from .tags import Tags

log = logging.getLogger("knowledge.search")


@dataclass(frozen=True)
class SearchRequest:
    intent: str
    question_en: str
    m_star: tuple[str, ...]
    state_codes: tuple[str, ...]
    routing_version: str


@dataclass(frozen=True)
class SearchPlan:
    """What will be asked: the SQL text, its bound values, and what was dropped on the way."""

    sql: str | None  # None when there is nothing to search
    parameters: Mapping[str, str]
    query_text: str
    domains: tuple[str, ...]  # the general domains searched
    playbook_ids: tuple[str, ...]  # the sensors whose D2 playbooks are searched
    dropped_m_star: tuple[str, ...]
    dropped_state_codes: tuple[str, ...]


@dataclass
class SearchResult:
    status: str  # OK | EMPTY
    index_build_id: str
    chunks: list[dict[str, Any]]
    expansions: list[dict[str, Any]]
    plan: SearchPlan | None = field(default=None, repr=False)

    def to_response(self) -> dict[str, Any]:
        """Exactly the `knowledge` section of intake-packet/1: four fields, nothing else."""
        return {
            "status": self.status,
            "index_build_id": self.index_build_id,
            "chunks": self.chunks,
            "expansions": self.expansions,
        }


def unavailable_response() -> dict[str, Any]:
    """The pack for an index that could not be asked: no chunk, no build id."""
    return {"status": "UNAVAILABLE", "index_build_id": None, "chunks": [], "expansions": []}


# ---------------------------------------------------------------------------
# planning: pure, no txtai
# ---------------------------------------------------------------------------


def build_query_text(template: str, state_codes: list[str] | tuple[str, ...], question_en: str) -> str:
    """ADR-043: the intent template, the state codes and the English question, not the raw message."""
    return f"{template} | {' '.join(state_codes)} | {question_en}"


def _placeholders(prefix: str, count: int) -> str:
    return ", ".join(f":{prefix}{i}" for i in range(count))


def build_sql(
    domains: tuple[str, ...], playbook_ids: tuple[str, ...], *, candidates: int, limit: int
) -> tuple[str | None, dict[str, str]]:
    """The SQL of 4.7 and the values it binds. `(None, {})` when neither a domain nor a playbook is in scope.

    The only values written into the text are the two whole numbers from the configuration and placeholder names
    made of a letter and a counter.
    """
    candidates, limit = int(candidates), int(limit)
    parameters: dict[str, str] = {}
    scopes: list[str] = []
    if playbook_ids:
        parameters["pd"] = PLAYBOOK_DOMAIN
        parameters.update({f"m{i}": mcd for i, mcd in enumerate(playbook_ids)})
        scopes.append(f"(domain = :pd AND mcd_id IN ({_placeholders('m', len(playbook_ids))}))")
    if domains:
        parameters.update({f"d{i}": domain for i, domain in enumerate(domains)})
        scopes.append(f"domain IN ({_placeholders('d', len(domains))})")
    if not scopes:
        return None, {}
    scope = scopes[0] if len(scopes) == 1 else f"({' OR '.join(scopes)})"
    sql = (
        f"SELECT id, text, mcd_id, domain, score FROM txtai WHERE similar(:q, {candidates}) "
        f"AND {scope} LIMIT {limit}"
    )
    return sql, parameters


def plan_search(request: SearchRequest, *, matrix: Matrix, tags: Tags, config: IndexConfig) -> SearchPlan:
    if request.routing_version != matrix.version:
        raise RoutingVersionMismatch(f"{request.routing_version!r} is not {matrix.version!r}")
    rule = matrix.intents.get(request.intent)
    if rule is None:
        raise UnknownIntent(request.intent)

    registered = set(tags.mcd_ids)
    kept_ids = sorted({m for m in request.m_star if m in registered})
    dropped_ids = tuple(m for m in dict.fromkeys(request.m_star) if m not in registered)
    # D2 is searched only when the matrix says so for this intent AND M* names a registered sensor
    playbook_ids = tuple(kept_ids) if rule.playbooks == PLAYBOOKS_M_STAR else ()

    known_codes = tags.all_state_codes
    codes = tuple(dict.fromkeys(c for c in request.state_codes if c in known_codes))
    dropped_codes = tuple(c for c in dict.fromkeys(request.state_codes) if c not in known_codes)

    template = config.intent_templates.get(request.intent, "")
    query_text = build_query_text(template, codes, request.question_en)
    sql, parameters = build_sql(rule.domains, playbook_ids, candidates=config.candidates, limit=config.limit)
    if sql is not None:
        parameters = {"q": query_text, **parameters}
    return SearchPlan(
        sql=sql,
        parameters=parameters,
        query_text=query_text,
        domains=rule.domains,
        playbook_ids=playbook_ids,
        dropped_m_star=dropped_ids,
        dropped_state_codes=dropped_codes,
    )


# ---------------------------------------------------------------------------
# running
# ---------------------------------------------------------------------------


def chunk_payload(record: Mapping[str, Any]) -> dict[str, Any]:
    """A chunk as the packet holds it: seven fields. The service's own (`related`, `tokens`) stay behind."""
    return {
        "id": record["id"],
        "domain": record["domain"],
        "mcd_id": record["mcd_id"],
        "state_codes": list(record["state_codes"]),
        "timeframe": record["timeframe"],
        "version": record["version"],
        "text": record["text"],
    }


class Retriever:
    """Searches one loaded index. One instance is shared by every request; a lock serialises the txtai call."""

    def __init__(self, loaded: LoadedIndex, matrix: Matrix, tags: Tags, config: IndexConfig):
        self.loaded = loaded
        self.matrix = matrix
        self.tags = tags
        self.config = config
        self._lock = threading.Lock()

    @property
    def build_id(self) -> str:
        return self.loaded.build_id

    def _in_scope(self, record: Mapping[str, Any], plan: SearchPlan) -> bool:
        """The SQL's own scope, asked again of what came back (defence in depth, and the rule for expansions)."""
        if record["domain"] in plan.domains:
            return True
        return record["domain"] == PLAYBOOK_DOMAIN and record["mcd_id"] in plan.playbook_ids

    def _rank(self, hits: list[tuple[dict[str, Any], float]]) -> list[dict[str, Any]]:
        """The best `limit` hits by score, then in the order of an answer: foundations, playbook, synthesis, risk,
        governance (D11 (d)); within a domain the better score first."""
        best = sorted(hits, key=lambda h: (-h[1], h[0]["id"]))[: self.config.limit]
        ordered = sorted(best, key=lambda h: (self.tags.domain_rank(h[0]["domain"]), -h[1], h[0]["id"]))
        return [record for record, _ in ordered]

    def _expand(self, chunks: list[dict[str, Any]], plan: SearchPlan) -> list[dict[str, Any]]:
        """Cross-referenced chunks, in the order of the chunks that name them, while the budget and the scope allow."""
        budget = self.config.budget_tokens
        used = sum(int(c["tokens"]) for c in chunks)
        taken = {c["id"] for c in chunks}
        expansions: list[dict[str, Any]] = []
        for chunk in chunks:
            for ref in chunk["related"]:
                if len(expansions) >= self.config.expansions_max:
                    return expansions
                record = self.loaded.chunks.get(ref)
                if record is None or ref in taken or not self._in_scope(record, plan):
                    continue
                if used + int(record["tokens"]) > budget:
                    continue
                expansions.append(record)
                taken.add(ref)
                used += int(record["tokens"])
        return expansions

    def search(self, request: SearchRequest) -> SearchResult:
        plan = plan_search(request, matrix=self.matrix, tags=self.tags, config=self.config)
        if plan.sql is None:
            return SearchResult("EMPTY", self.build_id, [], [], plan)

        with self._lock:
            rows = self.loaded.embeddings.search(
                plan.sql,
                limit=self.config.limit,
                weights=self.config.weights,
                parameters=dict(plan.parameters),
            )

        hits: list[tuple[dict[str, Any], float]] = []
        for row in rows:
            record = self.loaded.chunks.get(row["id"])
            if record is None or not self._in_scope(record, plan):
                log.error("search returned %r, which is not a chunk in scope; dropped", row["id"])
                continue
            hits.append((record, float(row["score"])))
        chunks = self._rank(hits)
        expansions = self._expand(chunks, plan)
        return SearchResult(
            "OK" if chunks else "EMPTY",
            self.build_id,
            [chunk_payload(c) for c in chunks],
            [chunk_payload(c) for c in expansions],
            plan,
        )
