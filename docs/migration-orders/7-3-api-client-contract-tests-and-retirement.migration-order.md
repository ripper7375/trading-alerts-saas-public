# Migration Order — Session 7-3 — API Client Contract Tests, Documentation & stackA/stackB Retirement (Phase 7 Exit Review)

> Third and final session of Phase 7 (API Client Rewrite). Per the session playbook's own Session
> 7-3 entry ("Contract tests + docs (phase exit)") and Session 7-1/7-2's own Next-session handoffs:
> rewrite the 2 existing client test files as contract tests against recorded real responses,
> update or retire the 3 stale api-client design docs, and decide the fate of `stackA`/`stackB` in
> `lib/api/index.ts` (frozen and `@deprecated` since Session 7-1, explicitly out of scope for both
> 7-1 and 7-2).
> Adapted loosely from `TEMPLATE-PORT.md` — this PRE-DRAFT deliberately does not enumerate Ordered
> Steps yet (this repo's own established discipline since the Phase 6 pre-guessed-step-text
> drift pattern, `LESSONS-LEARNED.md` L22/L27) — a real Step 0 discovery/decision pass belongs to
> the Advisor DRAFT or CONFIRM, not this PRE-DRAFT.

**Session:** 7-3 · **Phase:** Phase 7 (API Client Rewrite) · **Variant:** PORT/CONTRACT hybrid, exit-review flavor · **Status:** PRE-DRAFT · **Generated:** 2026-08-20 (Executor, at Session 7-2's close) · **Flags touched:** none expected · **Estimated time:** unclear until Step 0 runs — likely 2-4h

**Surface:** `__tests__/lib/api/generated-clients.test.ts` and any other operation-service/money-service client test file (rewrite as contract tests against recorded real responses, per the playbook's own "Done when: contract tests green against live staging services"); the 3 stale api-client design docs (not yet identified by file name in this PRE-DRAFT — Step 0's job); `stackA`/`stackB` exports in `lib/api/index.ts` (decide: retire, or keep with a real justification).

**Feeds on:** `7-2-api-client-migrate-consumers.migration-order.md` (CLOSED SUCCESSFUL 2026-08-20); `lib/api/generated/{operation-api,money-api}/{schema.ts,client.ts}` (Session 7-1); all consumer routes migrated at Session 7-2.

---

## Context

Session 7-1 built the generated typed clients. Session 7-2 migrated every real consumer (8 auth
bridge routes, the admin cron-trigger route, all 18 `lib/money-service/routes.ts` wrapper
functions) onto them, added an ESLint rule banning direct microservice `fetch()`, and retired the
6 dead `token-2fa-*` routes. `stackA`/`stackB` in `lib/api/index.ts` remain untouched, frozen, and
`@deprecated` since Session 7-1 — this session decides their fate.

### Known open items carried forward (not yet scoped into Ordered Steps):

- **`stackA`/`stackB` retirement decision.** Session 7-1's own header comment on `lib/api/index.ts`
  documents them as dead weight; Session 7-2's Decision 1 explicitly kept them out of scope again.
  Grep for real consumers before deciding retire-vs-keep (same zero-consumer discipline as the
  `token-2fa-*` retirement at Session 7-2).
- **Generated-spec gaps, now confirmed WIDER than originally disclosed.** Session 7-1's own
  documentation said request/response bodies are generic; Session 7-2's CONFIRM and execution
  (Deviation 5) found money-service's spec has **no typed query parameters at all** on any
  operation (`parameters.query?: never`), not just generic bodies — and operation-service's
  "generic" bodies are actually `Record<string, never>` (unusable directly), not a permissive
  `object`. A scoped Zod-to-OpenAPI conversion (or targeted `@ApiBody()`/`@ApiQuery()` decorators
  on high-value routes) may belong here or in a dedicated follow-up before Session 12-0 needs a
  clean spec for Stack D's own OpenAPI freeze (`MASTER-ROADMAP-PHASES-7-15.md` §5 residuals).
- **`LESSONS-LEARNED.md` L31/L32** (Session 7-2): any new client test written this session should
  use real `Response`/`Request` mocks from the start, and check `parameters.query` in the raw
  schema before assuming a generated client's query-typing is usable.
- **Two orphaned money-service test-mocking patterns from Session 7-2** worth checking during
  contract-test rewrite: `__tests__/api/admin-system-operations.test.ts` now mocks
  `@/lib/api/generated/money-api/client`'s `createMoneyApi`/`unwrapMoneyApi` directly (real
  `unwrapMoneyApi` via `jest.requireActual`, only `createMoneyApi`'s returned client mocked) — a
  possible pattern to generalize into a shared test helper if more routes need the same treatment.

**Step 0 of this session must do real, exhaustive discovery** (which 3 docs are actually stale,
what real consumers if any remain of `stackA`/`stackB`, what "contract tests against recorded real
responses" concretely means for this repo's own test conventions) before any Ordered Step is
trusted — per this migration's own repeated experience that pre-guessed file lists and step text
drift from ground truth by CONFIRM.

---

## Entry criteria

- [ ] Session 7-2 CONFIRMED, executed, CLOSED SUCCESSFUL (confirmed 2026-08-20).
- [ ] `lib/api/index.ts`'s `stackA`/`stackB` re-read at CONFIRM — re-confirm zero real consumers before proposing retirement.
- [ ] Monolith baseline re-measured at CONFIRM (`tsc --noEmit` clean, `eslint` clean [0 errors, 5 pre-existing warnings], `test:ci` green — last known: 163/163 suites, 2412/2412 tests).
- [ ] Advisor DRAFT reviewed and Davin APPROVED before execution.

---

## Next-session handoff

Phase 7 (API Client Rewrite) closes with this session. `MASTER-ROADMAP-PHASES-7-15.md`'s Gate 2
is Phase 4X (carry-forward money cutovers: 4A-13, 4A-14, 4A-15) — none of which touch the frontend
or this session's own files. PRE-DRAFT for 4A-13 (Stripe webhook cutover) already exists from
2026-08-04; re-verify it against live code at that session's own CONFIRM rather than trusting its
age.
