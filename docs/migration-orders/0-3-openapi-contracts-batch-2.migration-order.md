# Migration Order — OpenAPI Contracts, Batch 2 (Money Domain)

> `TEMPLATE-CONTRACT.md` variant. **Status: CONFIRMED** — re-verified against codebase and
> runtime state at session open 2026-07-17 (entry criteria hold; see CLAUDE.md handoff).

**Session:** 0-3 · **Phase:** Phase 0 (Foundation) · **Variant:** CONTRACT · **Status:** CONFIRMED
**Generated:** 2026-07-17 · **Flags touched:** F1 (closes) · **Estimated time:** ~4-5h

## Context carried over from Session 0-2

- **Playbook scope for this session** (`monolith-to-microservices-migration-session-playbook.md`,
  Session 0-3): checkout, subscription, invoices, payments/dlocal, admin/affiliates, affiliate,
  disbursement, webhooks (stripe/dlocal/riseworks), cron.
- **Route-count drift to re-verify at CONFIRM time:** the playbook says 99 total routes; Session
  0-2 measured **103** via `find app/api -name route.ts | wc -l`. The gap (4 routes) is unaccounted for. This must be reconciled.
- **"Reconcile with the 5 existing part-XX specs"** — Session 0-2 confirms 18 spec files exist total, of which 4 were already claimed by batch 1. Triage the remaining against live routes first, since the filename doesn't guarantee the content matches.
- **Hard lessons from 0-2:**
  1. **Architectural obsolescence:** Specs may describe a superseded architecture rather than just being "stale". Treat "CURRENT" as a verdict to earn, not assume.
  2. **Field-level accuracy:** Request/response field names can be individually wrong. Diff field-by-field against the live zod schema or handler destructuring.
- **Read-only documentation session:** This domain touches real payment providers and webhooks. No payment code, webhook secrets, or CORS config get touched. Fixes to live code are out of scope.

## Entry criteria

- [ ] Session 0-2 artifacts committed and pushed: 3 new specs (`part-21-drawings`, `part-22-user-account`, `part-23-market-data-channel`), 2 regenerated specs (`part-04`, `part-11`), 1 patched spec (`part-05`), `DECISION-LOG.md` (F1 batch-1 + naming decision), updated `CLAUDE.md`.
- [ ] F1 batch-1 resolution (`DECISION-LOG.md`) still holds — re-verify none of the 7 batch-1 domains' routes changed since 0-2 (quick `git log` / route-count check).

## Ordered steps

1. **Re-verify the route-count drift (99 vs. 103) and enumerate the money-domain routes**
   - Run a fresh `find app/api -name route.ts` count; list every route under `app/api/{checkout,subscription,invoices,payments,admin,affiliate,disbursement,webhooks,cron}/`.
   - Explicitly triage any remaining unaccounted-for domains (e.g., `candles`, `config`, `test`) in or out.
   - Output: Authoritative route list for this batch, with a reconciliation note on the 99 vs. 103 discrepancy.
   - _Verify:_ Cross-check against `migration-stack-analysis.md`'s BACKEND/BUSINESS-FUNCTION appendix for any internal-only markers.

2. **Resolve F1 for this batch — PUBLIC-only scope (closes F1 overall)**
   - Read every handler, classify PUBLIC vs. internal-only using the session/CSRF-guard test.
   - Webhook routes are likely internal-only (externally-triggered but not frontend-facing) — decide explicitly.
   - Output: `DECISION-LOG.md` F1 entry updated for batch 2.

3. **Triage the likely-covering existing specs vs. live routes**
   - Check file names against the domain list, then triage each (CURRENT / STALE / PARTIAL) by spot-checking every endpoint.
   - Output: Verdict table in the session notes.

4. **Generate/update specs for gaps**
   - Ground truth is live handlers (`00-SKELETON-AND-RULES.md §5`).
   - Output: New/updated files in `docs/open-api-documents/`, continuing the `part-XX` numbering from wherever 0-2 left off.
   - _Verify:_ Spot-check 5 routes minimum across the batch, handler-side-by-side.

5. **Close F1**
   - Ensure every single `app/api/**` route is accounted for across batch 1 and 2 — either spec'd or explicitly marked internal-only.
   - Output: `DECISION-LOG.md` F1 flag flipped to fully RESOLVED, citing both sessions' evidence.

## Rules specific to this variant

- Ground truth priority: live route handlers > `migration-stack-analysis.md` > existing `part-XX` specs > old `docs/build-orders/`.
- Do not touch webhook signature-verification code, payment provider secrets, or CORS. Anything that looks wrong in the live payment/webhook code is a finding to report, not a fix to make.
- Creativity dial: Medium.

## Done when

- [ ] Route-count drift (99 vs. 103) reconciled with a stated reason.
- [ ] F1 fully RESOLVED in `DECISION-LOG.md` (both batches).
- [ ] Every money-domain route has a spec matching its real handler, or is explicitly logged as internal-only — verified by spot-check (5+ routes).
- [ ] Every `app/api/**` route across the entire system is now covered or marked internal-only.
- [ ] Any `candles`/`config`/`test` domains left uncovered are explicitly noted as deferred (with a reason) rather than silently dropped.

## Rollback

None required — read-only/document session, no live system touched.

## Deviations

_(filled during execution)_

## Next-session handoff

_(PRE-DRAFT for Session 0-4 — secret matrix + test baseline — written at this session's close)_
