# Migration Order — OpenAPI Contracts, Batch 1 (Operation Domain)

> `TEMPLATE-CONTRACT.md` variant. **Status: APPROVED** — formulated by the Advisor from the
> Executor's Session 0-1 PRE-DRAFT notes.

**Session:** 0-2 · **Phase:** Phase 0 (Foundation) · **Variant:** CONTRACT · **Status:** APPROVED
**Generated:** 2026-07-17 · **Flags touched:** F1 · **Estimated time:** ~3-4h

## Context & Surprise from PRE-DRAFT

The original playbook framed Session 0-2 as generating fresh OpenAPI specs. However, Session 0-1 discovered that `docs/open-api-documents/` already contains 18 spec files (`part-02` through `part-19`), some of which appear to cover this session's exact domains (auth, alerts, notifications, tier).

Total `app/api/**/route.ts` count is ~103 (re-verify at CONFIRM time since F1 scope will subtract from this).

This session's real work is likely reconciliation and gap-filling against live handlers, not from-scratch generation. The steps below reflect this adjusted reality.

## Entry criteria

- [ ] Session 0-1 artifacts committed: `docs/railway-gateway-reference-notes.md`, updated `DECISION-LOG.md` (F2, F19), updated `CLAUDE.md`.
- [ ] F1 scope decision available (PUBLIC vs internal-only) — if not yet decided, step 1 below decides it as part of this session.

## Ordered steps

1. **Resolve F1 — PUBLIC-only scope**
   - Decide, using the existing NextAuth/session-based auth boundary and any internal-only markers in the route handlers, which of the routes across these 7 domains (auth, alerts, drawings, notifications, tier, user, market-data channel) are frontend/inter-service-facing (belongs in the system-wide OpenAPI doc) vs. internal-only (excluded).
   - Output: Decision Log F1 entry with the include/exclude list.
   - _Verify:_ cross-check against `migration-stack-analysis.md`'s FRONTEND appendix if it marks any of these routes internal-only already.

2. **Triage existing specs vs. live routes**
   - For each of the 4 possibly-covering part files (`part-05-authentication`, `part-11-alerts`, `part-15-notifications`, `part-04-tier-system`), diff their documented paths/methods against the actual `route.ts` files in `app/api/{auth,alerts,notifications,tier}/` filtering by the F1 PUBLIC scope.
   - Output: a currency verdict per file (CURRENT / STALE / PARTIAL) in the session notes.
   - _Verify:_ spot-check every endpoint in each part file against its handler, not a sample.

3. **Generate/update specs for gaps**
   - For STALE or missing coverage (drawings, user, market-data channel, plus any PARTIAL verdicts from step 2), write/refresh OpenAPI specs from the live route handlers directly.
   - Do NOT use old build-order docs to generate specs; ground truth is live handlers (`00-SKELETON-AND-RULES.md §5`).
   - Output: new/updated files in `docs/open-api-documents/`.
   - _Verify:_ spot-check 5 routes across the full batch by reading spec and handler side-by-side.

4. **Reconcile naming**
   - Decide whether reconciled specs stay in the existing `part-XX-*.yaml` numbering or move to a new per-domain naming scheme now that generation is live-handler-driven.
   - Output: a naming decision recorded in `DECISION-LOG.md` (affects Session 0-3's batch-2 file naming).
   - _Verify:_ Authorizer (Davin) sign-off if changing the existing numbering convention.

## Rules specific to this variant

- Ground truth priority: live route handlers > `migration-stack-analysis.md` > existing `part-XX` specs > old `docs/build-orders/`. The existing specs are a **starting point to verify**, not an assumed-correct source.
- Mark every spec entry as verified-against-live-code vs. carried-over-unverified if step 2 triage doesn't reach full coverage in the session's time budget.
- Creativity dial is Medium: Contracts constrain data, not the design. Propose freely but preserve behavioral invariants.

## Done when

- [ ] F1 scope resolved in `DECISION-LOG.md`.
- [ ] Triage verdicts (CURRENT/STALE/PARTIAL) recorded for the 4 possibly-existing specs.
- [ ] Every one of the 7 domains (auth, alerts, drawings, notifications, tier, user, market-data channel) has a spec in `docs/open-api-documents/` that matches its real handler — verified by spot-check (5 routes minimum).
- [ ] Spec naming convention decided.

## Rollback

None required — read-only/document session, no live system touched.

## Deviations

_(filled during execution)_

## Next-session handoff

_(PRE-DRAFT for Session 0-3 — OpenAPI contracts batch 2, money domain — written at this session's close)_
