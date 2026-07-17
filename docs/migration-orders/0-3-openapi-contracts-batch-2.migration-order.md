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

- [x] Session 0-2 artifacts committed and pushed: 3 new specs (`part-21-drawings`, `part-22-user-account`, `part-23-market-data-channel`), 2 regenerated specs (`part-04`, `part-11`), 1 patched spec (`part-05`), `DECISION-LOG.md` (F1 batch-1 + naming decision), updated `CLAUDE.md`. Confirmed via `git log` (commit `2b1d5db3`) and branch-up-to-date-with-origin at session open.
- [x] F1 batch-1 resolution (`DECISION-LOG.md`) still holds — re-verified: fresh per-domain route counts (auth 7, alerts 4, drawings 2, notifications 3, tier 3, user 14, market-data 1 = 34) exactly match the batch-1 DECISION-LOG entry.

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

- [x] Route-count drift (99 vs. 103) reconciled: 103 is authoritative (verified twice, Session 0-2 and 0-3); the playbook's 99 is stale. Full breakdown in `DECISION-LOG.md`.
- [x] F1 fully RESOLVED in `DECISION-LOG.md` (both batches) — see the batch-2 entry.
- [x] Every money-domain route has a spec matching its real handler, or is explicitly logged as internal-only — 5 domain agents each did a full (not sampled) field-by-field pass against every handler in their file; Executor independently spot-checked 5 routes across 4 different files against source directly.
- [x] Every `app/api/**` route across the entire system is now covered or marked internal-only — 34 (batch 1) + 57 (batch 2 PUBLIC) + 11 (batch 2 internal-only, documented) + 1 (`test/seed`, excluded with logged reason) = 103.
- [x] `candles`/`config`/`test` domains explicitly triaged: `config/affiliate` → spec'd in `part-17`; `candles` → spec'd in `part-23` (new); `test/seed` → excluded, reason logged in `DECISION-LOG.md`.

## Rollback

None required — read-only/document session, no live system touched.

## Deviations

1. **Scope extended from `admin/affiliates` (playbook wording, 10 routes) to the full
   `admin` domain (19 routes).** The other 9 (`analytics`, `api-usage`, `error-logs`,
   `users`, `fraud-alerts`×2, `codes/{code}/cancel`, `commissions/pay`,
   `settings/affiliate`) would otherwise be left uncovered by any session, and this
   order's own "Done when" requires every `app/api/**` route accounted for. Small,
   in-bounds, no live code touched, not escalated. See `DECISION-LOG.md` F1 entry.

2. **Stopped mid-session to ask Davin about cross-file spec overlap** (a
   materially-better-approach / boundary-touching decision per the Autonomy &
   Deviation clause, not a keystroke-level call). Step 3's triage found 5 of the 6
   candidate spec files overlapped inconsistently — same routes documented in
   multiple files, one file (`part-17`) with every path missing the `/api` prefix.
   Presented 3 options; Davin chose full consolidation into non-overlapping,
   sole-owner files. See `DECISION-LOG.md` "Spec consolidation" entry for the full
   before/after ownership map.

3. **Delegated the bulk per-domain spec regeneration to 5 parallel agents**, one per
   consolidated file (part-12, part-14, part-17, part-18, part19), each given an
   explicit, non-overlapping route list and told to verify every field against the
   live handler (not trust the old spec) — the classification/ownership decisions
   above were made by the Executor first, so no agent had to make a judgment call
   about file boundaries. All 5 outputs were spot-checked against source by the
   Executor afterward (5+ routes, per the order's verify requirement) before being
   trusted.

4. **`candles/[symbol]` and `config/affiliate`** (leftover domains per step 1) were
   folded into existing files rather than given new `part-XX` numbers:
   `config/affiliate` into `part-17-affiliate` (topically affiliate-adjacent, already
   the consolidation's job), `candles` into `part-23-market-data-channel` (written
   Session 0-2, topically the same market-data area) — avoids a proliferation of
   single-route files. `test/seed` was excluded entirely (test harness, not part of
   the product API surface) and logged with reason per `DECISION-LOG.md`, not given a
   spec.

5. **Two live-code findings surfaced, documented, not fixed** (read-only session,
   per the order's own rule): (a) `vercel.json` schedules `cron/daily-maintenance`
   independently alongside the 3 jobs its own docstring claims to have consolidated
   — possible duplicate execution against subscriptions/codes daily; (b)
   `candles/[symbol]/route.ts` interpolates a dynamic table name directly into a raw
   SQL string rather than using a parameterized identifier — input is constrained
   upstream but worth a dedicated security-review look. Both flagged to Davin in
   `DECISION-LOG.md`'s F1 batch-2 entry; neither touched.

## Next-session handoff

PRE-DRAFT written: `docs/migration-orders/0-4-secret-matrix-test-baseline.migration-order.md`
— flags one open question for Davin (secret matrix: names-only vs. actual values; names-only
recommended) that needs resolving before/at APPROVED.
