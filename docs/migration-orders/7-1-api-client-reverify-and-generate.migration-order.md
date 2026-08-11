# Migration Order — Session 7-1 — API Client Re-verify + Generate (Phase 7 Open)

> First session of Phase 7 (API Client Rewrite — deliberately last, per the plan's own §9
> framing: `lib/api/index.ts` was left broken-by-design until every service it wraps was
> stable, which is now true). Per the session playbook's own Session 7-1 entry ("Re-verify +
> generate"): re-read the `lib/api/` flag's mismatch list against the **new** NestJS routes
> (several mismatches may have dissolved since the flag was first raised), then regenerate the
> unified client from the OpenAPI specs. Adapted from `TEMPLATE-CONTRACT.md`, dial **MEDIUM**
> (how the mismatch audit is conducted is the Executor's judgment; what counts as evidence is
> not — every claim needs a live file:line or a live route citation, not a guess).

**Session:** 7-1 · **Phase:** Phase 7 (API Client Rewrite) · **Variant:** CONTRACT/PORT hybrid ·
**Status:** PRE-DRAFT · **Generated:** 2026-08-11 (at Session 6-12 close) · **Flags touched:**
none expected · **Estimated time:** ~4-6h (re-verification scope depends on what the audit
finds — re-verify every citation in this PRE-DRAFT at CONFIRM per `LESSONS-LEARNED.md` L27,
same discipline every recent session has needed)

**Surface:** `lib/api/index.ts` (the known-broken-by-design Stack A/Stack B unified client,
`EXECUTOR-PROTOCOL.md` §5's own standing do-not-touch entry — this is the session that finally
touches it), plus whatever new client module(s) replace it; `docs/open-api-documents/*` (read,
not modified) as the source of truth.

**Feeds on:** `migration-stack-analysis.md`'s own `lib/api/` appendix flag (the original
mismatch list: PUT vs PATCH on alerts, wrong notification read path, PATCH vs PUT on
preferences, phantom market-data path shape) and the plan's own §9 framing.

---

## Context

`lib/api/index.ts` has been the single standing "known-broken by design, nobody else touches
it" item since early in this migration (`EXECUTOR-PROTOCOL.md` §5) — deliberately left broken
because every backend surface it wraps (alerts, notifications, preferences, market-data) was
itself mid-migration and would have made any client fix immediately stale. Phase 6 just closed
(Session 6-12) with every domain slice cut over and the frontend gap matrix fully triaged — the
precondition for finally touching this file.

**This session's own real scope is an open question, not assumed here.** The original mismatch
list was written against the MONOLITH's `app/api/*` routes; those routes may now forward to
`operation-service`/`money-service` (per whichever Phase 4 flags are live), or the underlying
NestJS controllers may have their own, different verb/path conventions than what the mismatch
list describes. Per the playbook's own Session 7-1 framing, this session must **re-verify each
mismatch against the live NestJS routes**, not assume the original list is still accurate — the
same discipline that caught real drift in nearly every Phase 6 PRE-DRAFT (`LESSONS-LEARNED.md`
L27, recurring).

## Entry criteria

- [ ] Session 6-12 CONFIRMED, executed, closed (2026-08-11 — see `CLAUDE.md` Current entry).
      Phase 6 exit criteria genuinely met: gap matrix fully triaged (F11 RESOLVED), F61/F62/F63
      all RESOLVED, `app/test-api/page.tsx` deleted, zero pages render fabricated data.
- [ ] `migration-stack-analysis.md`'s `lib/api/` appendix flag re-read in full at CONFIRM —
      confirm its own cited mismatches (PUT vs PATCH on alerts, notification read path, PATCH
      vs PUT on preferences, market-data path shape) against the CURRENT live route/controller
      code, not trusted from the flag's own original wording.
- [ ] All relevant OpenAPI specs (`docs/open-api-documents/*`) confirmed present and, per
      `DECISION-LOG.md` F1, generated from live route handlers (not hand-drifted) — spot-check
      at least 5 entries against their real route handlers side-by-side.
- [ ] Monolith baseline re-measured at CONFIRM (`tsc --noEmit`, `eslint app components lib
hooks --max-warnings 0` clean [4 pre-existing warnings — confirm this count is still
      accurate], `test:ci` — last known at 6-12's close: 149/149 suites, 2322/2322 tests).
- [ ] Advisor DRAFT review + Davin APPROVED before CONFIRM — not fast-path eligible (first
      session of a new phase, touching a file every prior session in this migration was
      explicitly told never to touch).

## Integration points

- **In:** every live NestJS route this migration has cut over (Phase 4A/4B's full domain-slice
  set), the OpenAPI specs describing them, and every current `lib/api/index.ts` consumer
  (enumerate at DRAFT/CONFIRM — a real count, not assumed from the appendix flag's own stale
  figure).
- **Out:** consumer migration onto the new client is explicitly Session 7-2's scope, not this
  session's (per the playbook's own step split) — this session generates the client, it does
  not yet rewire callers.
- **Owns:** `lib/api/index.ts` (or its replacement module(s)) and this session's own generated
  client code; does not touch backend route/controller code.

## Ordered steps

_(to be finalized at DRAFT/CONFIRM from a real re-verification pass — this PRE-DRAFT
intentionally leaves step-level detail open, same discipline the last several Phase 6
PRE-DRAFTs used before their own DRAFT passes, after multiple sessions found pre-guessed
Ordered Steps had drifted from live ground truth by CONFIRM)_

1. Re-verify the `lib/api/` appendix flag's mismatch list against live NestJS route/controller
   code (not the monolith's own forwarding shims alone — the real destination once a flag is
   cut over).
2. Confirm which mismatches still hold, which have dissolved, and whether any NEW mismatches
   exist that the original flag never anticipated.
3. Generate the unified client from the OpenAPI specs (typed methods per service —
   `operationApi`, `moneyApi`, optionally a gateway client), with JWT bearer injection from the
   Phase 3 token layer and base URLs from env (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_MONEY_API_URL`
   — confirm the real env var names at DRAFT, don't assume these).
4. Confirm the generated client compiles clean (`tsc --noEmit`) and every re-verified mismatch
   from Step 2 is accounted for in the new client's behavior.
5. Unit tests for the new client (contract-style — real recorded response shapes per the
   `TEMPLATE-CONTRACT.md` Rules below, not blanket `fetch` mocks; the old
   `stack-a-client.test.ts`/`stack-b-client.test.ts` pair's own 36/36 pass was flagged
   meaningless per the plan's own §9.4 finding, and is Session 7-2's own retirement to handle
   once consumers move).

## Rules specific to this variant

- Ground truth priority: live NestJS route/controller code > live OpenAPI specs > recent
  migration-order/decision-log text > the original stale appendix flag wording.
- Distinguish verified facts from assumptions in whatever audit output this session produces;
  mark assumptions explicitly.
- The new client does not go live for any real page in this session — Session 7-2 owns
  migrating consumers. `lib/api/index.ts`'s own existing (broken) behavior is not the concern
  here; this session's job is a correct replacement to exist, not yet be adopted.
- If the OpenAPI specs themselves are found stale against live routes, that's a finding — record
  it, don't silently regenerate around it without flagging.

## Done when

- [ ] Every cited mismatch re-verified against live code, not assumed from the original flag.
- [ ] Generated client compiles clean; old mismatches all accounted for (fixed, or explicitly
      found to have already dissolved).
- [ ] `tsc --noEmit` clean; `eslint --max-warnings 0` introduces 0 new warnings; `test:ci` green.

## Rollback

New/replacement code only, zero consumers wired to it yet (Session 7-2's scope) — rollback is
`git revert`, zero production behavior change either way.

## Retire

Nothing retired this session — `lib/api/index.ts`'s own retirement (once consumers move off it)
is Session 7-2/7-3's scope.

## Deviations

_(filled during execution)_

## Known wrinkles / do-not-touch

- Consumer migration is explicitly NOT this session's scope (Session 7-2).
- `app/api-test/page.tsx` deletion/gating is explicitly Session 7-2's scope per the plan's own
  §9 step 7.3 (a different debug page than the just-retired `app/test-api/page.tsx` — confirm
  this distinction at DRAFT, don't conflate the two).
- `DECISION-LOG.md` **F49** (dLocal `payment_method_flow`), **F60** (Stripe webhook cutover),
  and **F64** (subscription-card Undo flow) stay open, non-blocking — none are Phase 7 concerns.

## Next-session handoff

`7-2-api-client-migrate-consumers.migration-order.md` (migrate Phase 6's interim per-domain
fetch wrappers onto the new unified client; delete/gate `app/api-test/page.tsx`) per the
playbook's own Session 7-2 entry.
