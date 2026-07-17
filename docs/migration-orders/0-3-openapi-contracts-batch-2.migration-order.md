# Migration Order — OpenAPI Contracts, Batch 2 (Money Domain)

> `TEMPLATE-CONTRACT.md` variant. **Status: PRE-DRAFT** — written by the Executor at
> Session 0-2's close, informed by that session's findings. Needs an Advisor DRAFT pass
> and Davin's APPROVED before the next Executor session can CONFIRM and run it.

**Session:** 0-3 · **Phase:** Phase 0 (Foundation) · **Variant:** CONTRACT · **Status:** PRE-DRAFT
**Generated:** 2026-07-17 · **Flags touched:** F1 (closes) · **Estimated time:** ~4-5h (larger
domain than 0-2: 9 route groups vs. 7, plus 3 external webhook providers to cross-reference)

## Context carried over from Session 0-2

- **Playbook scope for this session** (`monolith-to-microservices-migration-session-playbook.md`,
  Session 0-3): checkout, subscription, invoices, payments/dlocal, admin/affiliates, affiliate,
  disbursement, webhooks (stripe/dlocal/riseworks), cron. Playbook's own "Done when" for this
  session: _"all 99 `app/api/**` routes are covered by a spec or explicitly marked internal-only;
  F1 closed in the Decision Log."_
- **Route-count drift to re-verify at CONFIRM time:** the playbook says 99 total routes; Session
  0-2 measured **103** via `find app/api -name route.ts | wc -l` (exact match to the 0-2 order's
  own estimate). The gap (4 routes) is unaccounted for — re-run the count fresh and reconcile
  before trusting either number. It may just mean 4 routes were added since the playbook was
  written, or that the playbook's 99 already excluded something (e.g. `test`/`config` domains).
- **"Reconcile with the 5 existing part-XX specs"** (playbook's wording) — Session 0-2 confirms
  18 spec files exist total, of which 4 were already claimed by batch 1
  (`part-04`, `part-05`, `part-11`, `part-15`). The likely batch-2 candidates by name are
  `part-12-ecommerce-billing`, `part-17-affiliate`, `part-18-dlocal-payment`,
  `part19-disbursement`, and possibly `part-14-admin-dashboard` or `part-16-utilities-infrastructure`
  (for cron/webhooks) — **do not assume which 5**; triage against live routes first, the same way
  0-2 did, since the filename doesn't guarantee the content matches.
- **Two hard lessons from 0-2, both apply directly here:**
  1. **An existing spec matching by filename can describe a fully superseded product
     architecture, not just be "a bit stale."** `part-04` and `part-11` both turned out to
     document a pre-V8 multi-symbol/multi-tier model that no longer exists at all. Before
     trusting any of the money-domain specs, check for a similar full-rewrite risk — e.g. if
     pricing, plan tiers, or the affiliate commission model changed after these specs were
     written. Treat "CURRENT" as a verdict you have to earn per file, not assume from a filename
     match.
  2. **Request/response field names can be individually wrong even when the endpoint is
     otherwise well-documented** (found: `ResetPasswordRequest.newPassword` vs. live `password`
     in `part-05`). Diff field-by-field against the live zod schema or handler destructuring,
     not just path/method presence.
- **This domain touches real payment providers (dLocal, Stripe references, Riseworks) and
  webhooks.** Per `CLAUDE.md` non-negotiable #5 and `EXECUTOR-PROTOCOL.md` §7: this is a
  **read-only documentation session** (same CONTRACT/Medium-creativity variant as 0-2) — no
  payment code, webhook secrets, or CORS config get touched. If anything in this domain's live
  handlers looks like it needs an actual behavior change (not just documentation), that is
  **out of scope** — stop and flag it as a finding, do not fix it inline.

## Entry criteria

- [ ] Session 0-2 artifacts committed and pushed: 3 new specs (`part-21-drawings`,
      `part-22-user-account`, `part-23-market-data-channel`), 2 regenerated specs (`part-04`,
      `part-11`), 1 patched spec (`part-05`), `DECISION-LOG.md` (F1 batch-1 + naming decision),
      updated `CLAUDE.md`.
- [ ] F1 batch-1 resolution (`DECISION-LOG.md`) still holds — re-verify none of the 7 batch-1
      domains' routes changed since 0-2 (quick `git log` / route-count check).

## Ordered steps

1. **Re-verify the route-count drift (99 vs. 103) and enumerate the money-domain routes**
   - Fresh `find app/api -name route.ts` count; list every route under
     `app/api/{checkout,subscription,invoices,payments,admin,affiliate,disbursement,webhooks,cron}/`
     (and any others the batch-1 scan didn't cover — `candles`, `config`, `test` remain
     unaccounted-for domains from the 0-2 top-level listing and should be explicitly triaged
     in or out here, not left silently uncovered).
   - Output: authoritative route list for this batch, with a reconciliation note on the 99 vs.
     103 discrepancy.
   - _Verify:_ cross-check against `migration-stack-analysis.md`'s BACKEND/BUSINESS-FUNCTION
     appendix for any internal-only markers.

2. **Resolve F1 for this batch — PUBLIC-only scope (closes F1 overall)**
   - Same method as 0-2: read every handler, classify PUBLIC vs. internal-only using the
     session/CSRF-guard test, not assumption. Webhook routes (`webhooks/dlocal`,
     `webhooks/riseworks`, any Stripe route) are the one category where "internal-only"
     is plausible — externally-triggered but not frontend-facing — decide explicitly rather
     than defaulting to PUBLIC by habit from 0-2.
   - Output: `DECISION-LOG.md` F1 entry marked fully RESOLVED (batch 1 + batch 2 combined).

3. **Triage the likely-covering existing specs vs. live routes**
   - Don't assume which specs are "the 5" — check file names against the domain list, then
     triage each the way 0-2 triaged `part-04`/`part-05`/`part-11`/`part-15`: verdict
     CURRENT/STALE/PARTIAL per file, spot-checking every endpoint, not a sample.
   - Output: verdict table (same format as 0-2's order).

4. **Generate/update specs for gaps**
   - Ground truth is live handlers, same rule as 0-2 (`00-SKELETON-AND-RULES.md §5`).
   - Output: new/updated files in `docs/open-api-documents/`, continuing the `part-XX` numbering
     from wherever 0-2 left off (`part-21`/`22`/`23` used; next free number per
     `DECISION-LOG.md`'s naming entry — check the archive folder too).
   - _Verify:_ spot-check 5 routes minimum across the batch, handler-side-by-side.

5. **Close F1**
   - With batches 1 and 2 both done, every one of the (however-many, per step 1) `app/api/**`
     routes should be accounted for — spec'd or explicitly marked internal-only.
   - Output: `DECISION-LOG.md` F1 flag flipped from "RESOLVED (batch 1)" to fully RESOLVED,
     citing both sessions' evidence.

## Rules specific to this variant

- Ground truth priority: live route handlers > `migration-stack-analysis.md` > existing
  `part-XX` specs > old `docs/build-orders/`.
- Do not touch webhook signature-verification code, payment provider secrets, or CORS —
  documentation only. Anything that looks wrong in the live payment/webhook code is a finding
  to report, not a fix to make.
- Creativity dial: Medium.

## Done when

- [ ] Route-count drift (99 vs. 103) reconciled with a stated reason.
- [ ] F1 fully RESOLVED in `DECISION-LOG.md` (both batches).
- [ ] Every money-domain route (per step 1's authoritative list) has a spec matching its real
      handler, or is explicitly logged as internal-only — verified by spot-check (5+ routes).
- [ ] Any `candles`/`config`/`test` domains left uncovered by both 0-2 and 0-3 are explicitly
      noted as deferred (with a reason) rather than silently dropped.

## Rollback

None required — read-only/document session, no live system touched.

## Deviations

_(filled during execution)_

## Next-session handoff

_(PRE-DRAFT for Session 0-4 — secret matrix + test baseline — written at this session's close)_
