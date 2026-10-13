"""The knowledge service (build step 6, part 6; architecture chapter 4, sections 4.6 and 4.7).

A separate Python process: txtai needs torch, so it cannot live in the Vercel monolith. It builds a hybrid
(dense plus BM25) index of the knowledge corpus and answers `POST /search` for the intake path
(`lib/intake/knowledge-client.ts`, contract `knowledge-search/1`).
"""

SERVICE_VERSION = "1.0.0"
