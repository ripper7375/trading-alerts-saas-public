"""Checks run on a loaded index: the behaviours of architecture 4.7 that must be re-shown after any upgrade.

Section 4.7 rests on two facts about txtai 9.5.0, and says to re-check them after any upgrade:

  1. A single `weights` value w gives w to the dense score and 1 - w to the keyword score.
  2. The two scores are added only when the keyword scores are normalised; otherwise txtai fuses by rank.

`fusion_mismatches` shows both on the index itself, not on its configuration. For a query it asks the same index for the
dense-only result (weights 1.0), the keyword-only result (weights 0.0) and the fused result at the service's weight, and
requires:

  * fused = w * dense + (1 - w) * keyword for every chunk (fact 1); and
  * the dense-only score of a chunk is the model's own cosine similarity of the query and the chunk (fact 2).

The second line is the one that tells normalised scores from ranks. Under rank fusion txtai's dense-only result is
1, 1/2, 1/3 ..., and the fused result is still the same linear mix of the two lists, so the first line alone holds for
an index built with `normalize: false`; only the second one fails there. An index whose keyword scores are not
normalised, a txtai that fuses differently, or a damaged index fails here.

`verify_self_retrieval` asks for every chunk by its own text: it must come back in the first few. It is the cheap
detector for an index whose vectors or content no longer belong to the chunks beside them.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

from .config import IndexConfig
from .errors import Problem
from .index import LoadedIndex

FUSION_TOLERANCE = 1e-4
SELF_RETRIEVAL_RANK = 3
COSINE_SAMPLE = 5


@dataclass(frozen=True)
class FusionMismatch:
    kind: str  # FUSED: the mix is not w * dense + (1 - w) * keyword; DENSE_NOT_COSINE: the dense part is a rank, not a score
    chunk_id: str
    got: float
    want: float


def _scores(embeddings: Any, count: int, query: str, weights: float) -> dict[str, float]:
    rows = embeddings.search(
        f"SELECT id, score FROM txtai WHERE similar(:q, {count}) LIMIT {count}",
        limit=count,
        weights=weights,
        parameters={"q": query},
    )
    return {row["id"]: float(row["score"]) for row in rows}


def fusion_mismatches(
    embeddings: Any, count: int, query: str, weights: float, texts: Mapping[str, str] | None = None
) -> list[FusionMismatch]:
    """Every place where the index does not fuse as 4.7 says. Empty when it does.

    `count` is the number of documents in the index: asking for that many candidates puts every document in play, so
    a document the dense search or the keyword search did not return is a true 0 in that part and not a cut-off.
    `texts` (chunk id to text) turns on the second check; without it only the mix is checked. An empty fused result is
    itself reported (as the id `<empty>`).
    """
    dense = _scores(embeddings, count, query, 1.0)
    keyword = _scores(embeddings, count, query, 0.0)
    fused = _scores(embeddings, count, query, weights)
    if not fused:
        return [FusionMismatch("FUSED", "<empty>", 0.0, 0.0)]
    wrong: list[FusionMismatch] = []
    for chunk_id, got in fused.items():
        want = weights * dense.get(chunk_id, 0.0) + (1.0 - weights) * keyword.get(chunk_id, 0.0)
        if abs(got - want) > FUSION_TOLERANCE:
            wrong.append(FusionMismatch("FUSED", chunk_id, got, want))
    if texts is not None and dense:
        # the best few are enough to tell a score from a rank, and the model has to read every text it is given
        ids = [i for i in sorted(dense, key=lambda k: -dense[k]) if i in texts][:COSINE_SAMPLE]
        cosine = {ids[position]: score for position, score in embeddings.similarity(query, [texts[i] for i in ids])}
        for chunk_id in ids:
            if abs(dense[chunk_id] - float(cosine[chunk_id])) > FUSION_TOLERANCE:
                wrong.append(FusionMismatch("DENSE_NOT_COSINE", chunk_id, dense[chunk_id], float(cosine[chunk_id])))
    return wrong


def canary_queries(loaded: LoadedIndex, how_many: int = 3) -> list[str]:
    """A few queries made from the corpus itself: the opening words of chunks spread across it."""
    records = [loaded.chunks[i] for i in sorted(loaded.chunks)]
    if not records:
        return []
    step = max(1, len(records) // how_many)
    picked = records[::step][:how_many]
    return [" ".join(r["text"].replace("#", " ").split()[:14]) for r in picked]


def verify_fusion(loaded: LoadedIndex, config: IndexConfig) -> list[Problem]:
    if loaded.embeddings.scoring.isnormalized() is not True:
        return [Problem(loaded.build_id, "NOT_NORMALIZED", "keyword scores are not normalised")]
    w = config.weights
    texts = {chunk_id: record["text"] for chunk_id, record in loaded.chunks.items()}
    problems: list[Problem] = []
    for query in canary_queries(loaded):
        for m in fusion_mismatches(loaded.embeddings, len(loaded.chunks), query, w, texts):
            problems.append(
                Problem(
                    m.chunk_id,
                    m.kind,
                    f"score {m.got:.6f}, expected {m.want:.6f} (weights {w}: {w}*dense + {1 - w:.1f}*keyword)",
                )
            )
    return problems


def verify_self_retrieval(loaded: LoadedIndex) -> list[Problem]:
    problems: list[Problem] = []
    count = len(loaded.chunks)
    for chunk_id in sorted(loaded.chunks):
        text = loaded.chunks[chunk_id]["text"]
        rows = loaded.embeddings.search(
            f"SELECT id, score FROM txtai WHERE similar(:q, {count}) LIMIT {SELF_RETRIEVAL_RANK}",
            limit=SELF_RETRIEVAL_RANK,
            weights=0.5,
            parameters={"q": text},
        )
        if chunk_id not in [row["id"] for row in rows]:
            problems.append(
                Problem(chunk_id, "SELF_RETRIEVAL", f"asked for by its own text, it is not in the first {SELF_RETRIEVAL_RANK}")
            )
    return problems


def verify_index(loaded: LoadedIndex, config: IndexConfig) -> list[Problem]:
    return verify_fusion(loaded, config) + verify_self_retrieval(loaded)
