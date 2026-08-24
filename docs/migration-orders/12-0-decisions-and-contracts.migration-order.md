# Migration Order — Session 12-0 — Decisions & Contracts (Stack D)

> For sessions whose output is a **document or decision**, not running code: read
> `00-SKELETON-AND-RULES.md` first — §4 autonomy clause applies. **Creativity dial: Medium**
> (how you investigate is yours; what counts as evidence is not).
> **PRE-DRAFTed by the Executor at Session 11-3's close (2026-08-25)** per
> `MASTER-ROADMAP-PHASES-7-15.md` §"Phase 12" and
> `davintrade-stack-d-and-e/STACK-D-CONVERSATIONAL-AI-CHART-ANALYSIS-ARCHITECTURE.md` §5 (Parts
> 26–30). Not yet upgraded to DRAFT — that is the Advisor's job.

**Session:** 12-0 · **Phase:** 12 (Stack D: Conversational AI Analyst, first of 6 sessions) ·
**Variant:** CONTRACT · **Status:** PRE-DRAFT
**Generated:** 2026-08-25 (Executor, at Session 11-3's close) · **Flags touched:** F69 (⚠ NEEDS
EXPLICIT SIGN-OFF — money-adjacent), F70 · **Estimated time:** ~3h (two flag resolutions, one
live-reachability proof, one OpenAPI freeze — no application code).
**Target artifact:** an OpenAPI spec for `/api/ai/chat*` (path TBD by the Advisor's DRAFT) — no
application code this session.

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §"Phase 12":
"12-0 — Decisions & contracts (CONTRACT, no code). Resolve **F69**, **F70**. Confirm Part 24's
`mtf_render` PNG pipeline actually exists and is reachable from wherever the router runs — the
whole multimodal claim rests on it. Freeze the OpenAPI for `/api/ai/chat*` **before** building, so
Phase 7's generated client picks it up rather than drifting from day one."

Phase 11 (Sessions 11-1 → 11-3) is now **CLOSED SUCCESSFUL** — the tier matrix, guards/JWT claims,
header forwarding, and Redis token metering it built are exactly the plumbing this phase's real AI
routes will gate against (`canAccessAiAnalyst()`, `trackAiTokenUsage()`, both already live). This
session is genuinely greenfield: the repo has zero LLM SDKs, no VANNA, no txtai, and no
`/api/ai/**` route of any kind today (confirmed by a repo-wide grep at this PRE-DRAFT's own
writing — re-verify fresh at CONFIRM, per `LESSONS-LEARNED.md` L22/L37).

---

## Facts verified live at PRE-DRAFT time (not fabricated — re-verify fresh at CONFIRM)

- **Zero LLM SDKs anywhere in the repo** — `package.json` and `operation-service/package.json`
  have no `anthropic`, `openai`, `@google/generative-ai`, `google-genai`, or `langchain`
  dependency (grepped both files directly).
- **No `app/api/ai` route subtree exists** — the only route under `app/api/test/ai-metering` is
  Session 11-3's own throwaway dummy route, which is unrelated and should NOT be confused with
  Phase 12's real routes.
- **`mtf_render` exists as real code, but its reachability from Phase 12's own router is
  unverified** — found at
  `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_multi-timeframe-visualisation/
mtf_render/__main__.py`, with its own test file (`test_mtf_render.py`) and an architecture doc
  (`v2_29_Data_Pipeline_&_Mtf_Visual_Combined_Architecture_Overview.md`) in the same folder. This
  is Python code that appears to live on the Contabo-side EA/backfill-worker stack, not inside
  `operation-service`, `railway-gateway`, or the Next.js monolith. **Whether Phase 12's router (a
  NestJS service? a new Python microservice? Contabo itself over HTTP?) can actually invoke this
  pipeline and receive a PNG artifact back — over what protocol, at what latency, behind what
  auth — has not been checked.** This is exactly the roadmap's own flagged risk ("the whole
  multimodal claim rests on it") and is this session's own Ordered Step 3, not something to
  assume resolved by the file's mere existence. `components/chat-sidebar.tsx` also references
  `mtf_render` by name — not yet read in full; may be relevant UI-side context for what the
  frontend expects back.
- **`@vercel/blob` (`^2.8.0`) is already a monolith dependency** — confirms the roadmap's
  Session 12-1 framing ("reuse the existing Vercel Blob integration, added 2026-08-20") is
  accurate; no new storage backend decision needed for PNG artifact storage.
- **`packages/types/src/tier/constants.ts`'s `aiMonthlyTokenQuota` (500,000 PRO / 0 FREE) and
  `canAccessAiAnalyst()` are live** (Sessions 11-1/11-3) — Phase 12's real routes gate against
  these directly; no new tier plumbing needed.
- **`operation-service`'s own embedded `packages/types` mirror needs checking before Phase 12
  writes any code there** — Session 11-2's own close disclosed this mirror can silently miss
  modules added to the canonical copy (`LESSONS-LEARNED.md` L19 recurrence); not this CONTRACT
  session's job to fix, but worth a live check at whichever Phase 12 session first writes
  `operation-service` code that imports `@trading-alerts/types/tier`.
- **Entry criterion met:** Phase 11 is CLOSED SUCCESSFUL as of this PRE-DRAFT's own writing
  (2026-08-25) — re-verify fresh at this session's own CONFIRM regardless.

---

## Decisions needed (flagged for the Advisor to resolve at DRAFT — not resolved here)

1. **F69 — LLM provider, model, and monthly cost ceiling** (`⚠ NEEDS EXPLICIT SIGN-OFF` —
   money-adjacent, `EXECUTOR-PROTOCOL.md` §7). Per `DECISION-LOG.md`'s own register entry: Gemini
   vs Claude vs both behind a router, plus the fallback behavior when the ceiling is hit. This is
   a real spend decision on a product with paying users — the Advisor should make a clear
   recommendation with cost modeling (tokens/call × expected call volume × Session 11-3's own
   500k/month PRO quota) but mark it `⚠ NEEDS EXPLICIT SIGN-OFF` per this phase's own carve-out,
   not decide it silently.
2. **F70 — VANNA / txtai runtime host, and the `market_data_v6` DB-role/schema question.** Per
   `DECISION-LOG.md`'s F70 entry (new evidence added at Session 8-2, 2026-08-24, still OPEN):
   production's `market_data_v6` table exists but is not reachable through the `public` schema
   the app's own Prisma client resolves against — a `search_path`/role-grant gap, not missing
   data. Both questions the same flag was originally registered for (Contabo VPS vs a new Railway
   service vs in-process; which DB role reads `market_data_v6`) need resolving together, since the
   runtime-host choice determines which role's grants actually matter.
3. **`mtf_render` reachability contract.** Once Ordered Step 3 (below) proves or disproves live
   reachability, decide the actual invocation contract: protocol (HTTP? a queue? a shared
   filesystem?), auth, expected latency budget, and failure/timeout behavior for the multimodal
   chat flow. If genuinely unreachable from any candidate runtime host, this is a scope-changing
   finding for the whole phase, not a detail — escalate rather than silently assuming a fallback.
4. **OpenAPI freeze scope.** Exactly which `/api/ai/chat*` paths/methods get frozen now (before
   any implementation exists) vs. left for Session 12-5 (SSE streaming) to add — the roadmap
   names `/api/ai/chat/stream` specifically as a 12-5 deliverable, so 12-0's freeze should probably
   cover the non-streaming request/response contract and explicitly flag streaming as
   to-be-appended, not invented wholesale here.

---

## Entry criteria (re-verify all at CONFIRM)

- [ ] **Phase 11 (Sessions 11-1, 11-2, 11-3) CLOSED SUCCESSFUL** in `CLAUDE.md`.
- [ ] **Baseline test suites 100% green** (monolith, `operation-service`, `money-service`,
      `railway-gateway` — figures to be re-verified fresh at CONFIRM, not copied from 11-3's
      close).
- [ ] **`STACK-D-CONVERSATIONAL-AI-CHART-ANALYSIS-ARCHITECTURE.md` §5 (Parts 26–30) read in full**
      (not just the roadmap's one-line summaries) — sources F69/F70's real decision criteria and
      the OpenAPI contract's real shape (`LESSONS-LEARNED.md` L39 — a paraphrase of a paraphrase
      can drop a scoping detail).
- [ ] **`mtf_render`'s actual location, invocation contract, and any existing network exposure
      confirmed live** — this PRE-DRAFT found the file exists; CONFIRM must establish whether it
      is reachable at all from a candidate Phase 12 runtime host before Ordered Steps proceed.

---

## Ordered steps (Advisor to complete — sketch only, do not execute from this PRE-DRAFT)

_(each step = investigate → produce → verify; a claim without a source is not a finding)_

1. **Read the Stack D architecture spec's Parts 26–30 in full**, cross-checked against this
   PRE-DRAFT's own live-code facts above, to ground F69/F70's resolution in the real spec text
   rather than the roadmap's own summary of it.
2. **Resolve F69** — LLM provider/model/cost-ceiling decision with real cost modeling, marked
   `⚠ NEEDS EXPLICIT SIGN-OFF`.
3. **Prove or disprove `mtf_render` reachability** — trace exactly where this pipeline is meant to
   run relative to whichever runtime F70 selects; if a live test call is feasible without
   touching production data, make one and record the real result (latency, output format,
   failure modes). If not feasible in this CONTRACT session, document precisely what would be
   needed to test it and treat "unproven" as the honest status, not "assumed working."
4. **Resolve F70** — VANNA/txtai runtime host + `market_data_v6` DB-role/schema question,
   informed by Step 3's reachability finding.
5. **Freeze the `/api/ai/chat*` OpenAPI spec** (non-streaming contract; explicitly flag
   `/api/ai/chat/stream` as a Session 12-5 addition, not invented here) so Phase 7's generated
   client tooling picks it up from day one instead of drifting.
6. **Author the DRAFT's own Next-session handoff** for Session 12-1 (Part 26: dual-RAG
   infrastructure), informed by F69/F70's real resolutions.

---

## Rules specific to this variant

- Ground truth priority: live code (`mtf_render`'s real location/reachability,
  `packages/types/src/tier/*`, `@vercel/blob` in `package.json`) and the Stack D spec's own Parts
  26–30 text > the roadmap's one-line summary of them (`LESSONS-LEARNED.md` L39).
- F69 and F70 are both **⚠ NEEDS EXPLICIT SIGN-OFF carve-outs** per
  `HANDOVER-PROMPT-phase-11.md`'s own precedent framing for this phase family — the Advisor
  recommends, Davin decides, neither gets silently resolved.
- This is a CONTRACT session: no application code, no dependency installs, no schema changes.
  Anything Ordered Step 3's reachability test needs beyond read-only investigation (e.g.
  installing a Python client, standing up a test call path) is itself a decision to surface, not
  to just do.

---

## Done when

- [ ] F69 resolved in `DECISION-LOG.md`, Davin's explicit sign-off quoted (money-adjacent).
- [ ] F70 resolved in `DECISION-LOG.md`.
- [ ] `mtf_render`'s real reachability status (proven working, proven unreachable, or explicitly
      unproven-with-a-documented-test-plan) recorded — not assumed.
- [ ] `/api/ai/chat*` OpenAPI spec frozen and committed at its target path.
- [ ] Session 12-1 (Part 26: dual-RAG infrastructure) PRE-DRAFTed.

---

## Rollback

Read-only/document session — no application code, no schema, no deploys. If any live investigative
call is made against `mtf_render` or any other external system during Ordered Step 3, document
here whether it left any side effect and how to undo it.

---

## Deviations

_(filled during execution)_

---

## Next-session handoff

- **Next:** Session 12-1 — Part 26: dual-RAG infrastructure (INFRA). VANNA schema vectors over
  `market_data_v6`, txtai trading-knowledge index, PNG artifact storage (reusing the confirmed-live
  `@vercel/blob` integration). Depends directly on this session's F70 resolution (runtime host) and
  Ordered Step 3's `mtf_render` reachability finding.
- **Prerequisite:** Session 12-0 CLOSED SUCCESSFUL; F69/F70 both resolved with Davin's sign-off
  where required.
