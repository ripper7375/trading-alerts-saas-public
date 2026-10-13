# Knowledge service

The Python service behind chapter 4's knowledge pack (build step 6, part 6). It builds a hybrid
[txtai](https://github.com/neuml/txtai) index of the knowledge corpus and answers one question for the intake path: _which
chunks should the model read for this request?_ It is separate from the Vercel monolith because txtai needs torch
(decision D3 (A)); the monolith's client is `lib/intake/knowledge-client.ts`.

```
corpus/*.md ──► front matter + tags + chunk bounds + wording backstop ──► txtai (content + dense + BM25) ──► index/
                                                                                                              │
POST /search  ◄── x-knowledge-service-key ◄── lib/intake/knowledge-client.ts                                  ▼
  {intent, question_en, m_star, state_codes}  ──►  SQL with bound ids, weights 0.7  ──►  4 chunks + expansions
```

## The contract: `knowledge-search/1`

`POST /search`, header `x-knowledge-service-key: $KNOWLEDGE_SERVICE_KEY`, JSON body (every field required, nothing else):

```json
{
  "schema": "knowledge-search/1",
  "intent": "DIRECTION",
  "question_en": "What does a breakout above the upper band mean?",
  "m_star": ["MCD1", "MCD3"],
  "state_codes": ["MCD1_UP_UPPER_BREAKOUT"],
  "routing_version": "routing-v1"
}
```

| Answer | When                                                                                         | Body                                                                        |
| ------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 200    | at least one chunk                                                                           | `{status: "OK", index_build_id, chunks, expansions}`                        |
| 200    | no chunk in scope, or an intent with no scope (`REPORT_2`, `OUT_OF_SCOPE`)                   | `{status: "EMPTY", index_build_id, chunks: [], expansions: []}`             |
| 503    | the index is not loaded, or the search failed                                                | `{status: "UNAVAILABLE", index_build_id: null, chunks: [], expansions: []}` |
| 401    | no key, a wrong key, or the service has no key configured                                    | `{"detail": "unauthorized"}`                                                |
| 409    | `routing_version` is not the matrix this service holds                                       | `{"detail": "routing version not held", "held": "routing-v1"}`              |
| 422    | the body is not the contract (unknown field, wrong schema, unknown intent, a bound exceeded) | `{"detail": "invalid request", "fields": [...]}` (never the values)         |

A 200 body is exactly the `knowledge` section of `intake-packet/1`; `lib/intake/packet.ts` `validateKnowledge` is its judge, and
`tests/test_contract.py` reads that file to keep the two in step. A chunk is `{id, domain, mcd_id, state_codes, timeframe, version, text}`.
`GET /healthz` is unauthenticated: `{"status": "ok", "index_build_id": "kb-…" | null}`.

## How a request is answered (architecture 4.7)

1. The query is `"{intent template} | {state codes} | {question_en}"` (ADR-043; templates in `config/index.yaml`).
2. The **domains** of the intent and whether its **D2 playbooks** are scoped to M\* come from `config/intake/dispatch-matrix.v1.json`
   (`routing-v1`), never from the request. D2 is searched only for sensors that are in M\* **and** in the registry.
3. SQL, with every variable part bound, never written into the text:

   ```sql
   SELECT id, text, mcd_id, domain, score FROM txtai WHERE similar(:q, 40)
     AND ((domain = :pd AND mcd_id IN (:m0, :m1)) OR domain IN (:d0, :d1)) LIMIT 4
   ```

   An empty list builds no clause; a request with nothing left in scope answers `EMPTY` without searching (an empty scope must
   never become an unfiltered query). A sensor id the registry does not list is **dropped**, not rejected.

4. `embeddings.search(sql, weights=0.7, parameters=…)` on a hybrid index whose keyword scores are **normalised** — the one
   combination for which `0.7` means 70% dense _score_ and 30% keyword _score_. Anything else makes txtai fuse by rank.
5. The best 4 are ordered foundations, playbook, synthesis, risk, governance (D11 (d)); then the chunks their `related` lists name
   follow as `expansions` (at most 6, in the same scope, only while the pack stays inside 2,000 tokens).

## The corpus

One Markdown file per topic under `corpus/` (real) — see `corpus/README.md`. **The tests have their own corpus**, `tests/fixtures/corpus/`,
marked by a `TEST_ONLY` file; the production build refuses such a folder. Both are kept away from Prettier (a reformatted file is a new
build id).

```markdown
---
id: d2.mcd1.playbook # a-z 0-9 _ . -, starts with a letter or digit, at most 64
domain: D2 # D1 … D5 (tags.yaml)
mcd_id: MCD1 # required for D2; must be in the registries
state_codes: [MCD1_UP_IN_CORRIDOR] # at most 16, all in the registries, all of mcd_id when it is set
timeframe: M15 # M5 | M15, optional
version: 1.0.0 # x.y.z, a string
related: [d1.channel.what-a-channel-is] # chunk ids that must exist, optional
---

# Title (stays with the first section)

## First section
```

- **Chunks** are whole sections: split at `##` and `###`; a run of sections under 200 tokens is merged; a section over the limit is split at
  paragraphs, then sentences, then words, the heading repeated on every part. Tokens are counted with the embedding model's own tokenizer.
- The limit is two limits: 1,500 tokens **and** 4,000 characters (the packet's `KNOWLEDGE_CHUNK_MAX_CHARS`). For English prose the
  characters bind first (about 900 tokens). The dense vector sees only the first 512 tokens (txtai's pooling window), so the build warns
  `OVER_DENSE_WINDOW` for a chunk beyond it; the keyword index always sees all of it.
- **Chunk id** = `{file id}.{slug of the chunk's first heading}`, with `-2`, `-3` when a heading repeats; stable when the body changes.
- **Tags are a whitelist**: `config/tags.yaml` (domains, timeframes) and `config/registry-codes.json` (MCD ids and state codes, generated
  from the four MCD registries by `scripts/intake/build_roster.py`, never typed twice). An unknown value fails the build, with every problem listed.
- **Wording backstop** (`knowledge/wording.py`, architecture 5.9): guarantees, claims of perfect accuracy, advice, probabilities and grades,
  urgency. It is context-free — a negated "not a guarantee" fails too; say "outcomes are never certain".
- `README.md` and files starting with `_` are not corpus.

## The index and the build id

`index/` holds txtai's files plus `chunks.json` (every chunk with its tags and `related`) and `build_metadata.json` (no time stamp).
`index_build_id` is `kb-` + the first 32 hex digits of the SHA-256 of: every chunk (ids, tags, text), the tag whitelist, the glossary
version, the model revision, the txtai version, `config/index.yaml` and the wording version. The same inputs give the same id on any
machine (line endings are normalised first). The service refuses an index built under other settings, another txtai, or without
normalised keyword scores, and answers 503 instead.

## Running it

```bash
python -m venv .venv && .venv/bin/pip install -r requirements.txt           # Windows: .venv\Scripts\python
python -m knowledge.gate fetch-model                                        # the pinned model, once (needs the network)
python -m pytest                                                            # the tests, on the real txtai and model
python -m knowledge.gate build --corpus tests/fixtures/corpus --output index   # a TEST ONLY index, for development
python -m knowledge.gate check --index index
KNOWLEDGE_SERVICE_KEY=dev-key uvicorn knowledge.api:app --port 8000
```

| Variable                                      | Meaning                                                             |
| --------------------------------------------- | ------------------------------------------------------------------- |
| `KNOWLEDGE_SERVICE_KEY`                       | the shared secret; unset means every `/search` is refused           |
| `KNOWLEDGE_INDEX_DIR` / `KNOWLEDGE_MODEL_DIR` | defaults `./index` and `./models/all-MiniLM-L6-v2`                  |
| `KNOWLEDGE_MATRIX_PATH`                       | the dispatch matrix; default is the synced copy in `config/intake/` |
| `PORT`                                        | the Docker `CMD` listens on `${PORT:-8000}`                         |
| `KNOWLEDGE_TEST_NO_DOWNLOAD=1`                | tests only: a missing model is an error, not a download             |

The monolith side needs `KNOWLEDGE_SERVICE_URL` (https, or localhost) and the same key.

## Files copied from the monolith

The service is built alone on Railway, so it holds copies of `config/intake/dispatch-matrix.v1.json` and the version of
`config/intake/glossary.v1.json`. After a change to either, run `python scripts/intake/sync_knowledge_config.py` from the repository
root (`--check` is a test). `registry-codes.json` is regenerated by `scripts/intake/build_roster.py`.

## Docker and Railway (D3 (A), D12)

`Dockerfile` (base `python:3.11-slim`): installs the pinned requirements (CPU torch), fetches the model at the revision in `config/index.yaml`
**at image build**, builds the index from `corpus/` with `--require-real`, runs `gate check`, and starts one `uvicorn` process. Nothing
is downloaded or computed at start (`HF_HUB_OFFLINE=1`). A failed gate is a failed build. Until the real corpus exists (parts 7 and 8)
the build stops at `NO_DOCUMENTS`, on purpose. Railway: root directory `knowledge-service`, watch paths `knowledge-service/**`, a
service variable `KNOWLEDGE_SERVICE_KEY`, health check path `/healthz`. One replica per index: the index is in the image.

## Not here yet

The labelled question set and the recall gate (part 9), the corpus (parts 7 and 8), the `--require-approved` build (part 7), and a rule-id
tag (part 8 adds it to `tags.yaml` when the D3 chunks need it).
