# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.**
> **Role Distinction:**
>
> - **In Antigravity Chat UI:** You act as **Antigravity (Advisor & Architect)** — planning, drafting migration orders, reviewing codebase decisions, guiding Davin.
> - **In Terminal CLI:** You act as **Claude Code (Executor)** in the three-role Development Chain Protocol — running shell commands, executing code edits, running unit tests, git commits.
>   Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` — **read it at the start of every session before doing anything else.**
>   The previous content of this file (Aider validation guide) moved to
>   `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

---

## Current state _(update at the end of EVERY session)_

> **STANDING INSTRUCTION (Davin, 2026-07-22, NARROWED 2026-07-24 — still in force
> until Davin lifts it further):** chain-length-one originally read as "webhooks cut
> over FIRST (both providers), before 4A-7 or any Slice 4 work." **Davin confirmed
> live, 2026-07-24, that this narrows to dLocal-cutover-first**: with dLocal now
> CUT-OVER (Session 4A-5, see Current below), 4A-7/Slice 4 work is unblocked — it does
> NOT need to wait for RiseWorks. RiseWorks's own cutover (`4A-5-RW`) trails
> independently, gated on RiseWorks replying with webhook/API settings (see Waiting on).
> **Session 4A-3 (below) was an explicit, scoped exception Davin asked for directly in
> chat — Slice 1 (crons) cutover, independent of this question — not itself a lifting
> of the standing instruction.** With dLocal cut over too, Slice 3/4 BUILD work (4A-7
> onward) may now proceed; RiseWorks-specific work stays gated on `4A-5-RW`'s own entry
> criteria.

- **Current:** Session 7-2 (API Client Migrate Consumers, PORT variant, dial LOW), CONFIRMED,
  executed, CLOSED SUCCESSFUL 2026-08-20. Second session of Phase 7 — the consumer rewiring
  Session 7-1 deliberately deferred. Also the session that landed `MASTER-ROADMAP-PHASES-7-15.md`
  (registers F65–F74, resequences the whole remaining migration).
  **CONFIRM found the by-now-familiar `LESSONS-LEARNED.md` L3/L11 pattern, this time as one large
  batch spanning 8 files**: this order, `MASTER-ROADMAP-PHASES-7-15.md` (untracked, new), `CLAUDE.md`,
  `DECISION-LOG.md`, `EXECUTOR-PROTOCOL.md`, the implementation plan, session playbook, and
  `SESSION-PROMPT-SCRIPT.md` were all modified-but-uncommitted — the order itself had grown a new
  `Decisions taken` section and expanded scope (an ESLint rule + dead-2FA retirement) beyond its
  own committed PRE-DRAFT, and the roadmap's own header read "pending Davin's approval." Reported
  in full before proceeding; Davin confirmed live the whole batch is his authentic edit and the
  roadmap is approved.
  **Two real gaps found at CONFIRM beyond the order's own text, both resolved by Davin's live
  direction:** (1) the admin cron-trigger route (`app/api/admin/system/jobs/[jobId]/trigger/
route.ts`) was calling money-service without the `/v1` prefix its global route prefix actually
  requires — almost certainly a live 404 bug since Session 6-11 built the button; folded the fix
  into Step 1 and updated the one test asserting the old path. (2) Step 3's planned ESLint-rule
  allowlist omitted `lib/status/check-system-status.ts`'s legitimate direct `/health` fetch —
  added it to the allowlist.
  **Built all 4 Ordered Steps, one commit each, plus a Step 0 housekeeping commit for the
  governance batch:** Step 0 — committed the confirmed 8-file batch above. Step 1 — migrated the
  trigger route and all 18 `lib/money-service/routes.ts` wrapper functions onto
  `createMoneyApi`/`unwrapMoneyApi` (17 downstream consumer routes needed zero changes — they call
  the wrapper, not the transport). **Found a second, more severe generated-spec gap than Session
  7-1 disclosed while doing this:** money-service's OpenAPI spec has `parameters.query?: never` on
  every single operation (not just generic bodies) — `@nestjs/swagger` captured path/method/
  path-param shape but zero query-parameter metadata for Zod-validated routes. Worked around with
  one narrowly-scoped `pathWithQuery()` cast per query-bearing call, preserving byte-for-byte
  identical request URLs via the same `buildQuery()` helper as before. Step 2 — migrated all 8
  live `app/api/auth/token-*` routes onto `createOperationApi`/`unwrapOperationApi`. **Found that
  `openapi-fetch` needs a real `Response`/`Request` object, not the old `{ok, status, json}` mock
  shape** — broke all 5 affected test files uniformly with 500s until fixed (real `new Response()`
  mocks, real `Request` reads for outbound-body/URL assertions); no assertion's expected value
  changed, only the mock mechanics. Step 3 — `no-restricted-syntax` ESLint rule banning direct
  `fetch()` against `OPERATION_SERVICE_URL`/`MONEY_SERVICE_URL`/bare microservice ports outside
  `lib/api/generated/`, `lib/*-service/client.ts`, and the allowlisted health-check file; proven
  via a planted violation (caught, then removed, clean rerun confirmed). Step 4 — removed the
  empty `app/api/auth/register/` directory and retired all 6 dead `token-2fa-*` routes +
  `__tests__/api/auth/token-2fa-flows.test.ts` (zero UI consumers, re-confirmed; superseded by
  `/api/user/2fa/*` at Session 4B-21).
  **Full verification:** `tsc --noEmit` clean throughout, re-checked after every step; `eslint app
components lib hooks --max-warnings 0` — same 5 pre-existing warnings, 0 introduced; `test:ci`
  **163/163 suites, 2412/2412 tests** (was 164/164, 2422/2422 — -1 suite/-10 tests, exactly the
  deleted 2FA test file, zero regressions elsewhere; the order's own predicted "2415" was a
  citation-drift guess — the file genuinely had 10 tests, not 7).
  **No flag flipped, no cutover-table row** — pure internal client refactor, `migration-cutover-
table.md` unchanged. `migration-stack-analysis.md` updated (Appendix note on the 6 retired
  `token-2fa-*` files + their test, annotated not silently deleted from the historical record).
  Two new `LESSONS-LEARNED.md` entries: **L31** (`openapi-fetch` needs real `Response`/`Request`
  mocks, not the old bare-fetch shape) and **L32** (check a generated spec's `parameters.query`
  for `never`, not just `requestBody` — a Zod-validated service can lose query-param metadata
  entirely, worse than the disclosed generic-body gap).
  **Artifacts updated:** `7-2-api-client-migrate-consumers.migration-order.md` (Status → CONFIRMED
  → CLOSED SUCCESSFUL; entry criteria all checked with CONFIRM-time findings; Done-when all
  checked; Deviations filled — 6 entries), `DECISION-LOG.md`/`MASTER-ROADMAP-PHASES-7-15.md`/
  governance docs (committed as the confirmed batch, no new flag resolution — none was open for
  this session), `migration-stack-analysis.md`, `LESSONS-LEARNED.md` (L31, L32), this file
  (Current/Previous rotation — Session 6-12 and the 3 ad-hoc sessions between it and 7-1 moved to
  `history/sessions-archive.md`, closing that piece of the long-standing Waiting-on #102/#129
  backlog). **`7-3-api-client-contract-tests-and-retirement.migration-order.md` PRE-DRAFTed** —
  contract-test rewrite, stale-doc retirement, `stackA`/`stackB`'s fate, and the widened
  generated-spec query-param gap (L32) — deliberately leaves Ordered Steps open pending a real
  Step 0 discovery pass, same discipline as every recent PRE-DRAFT since the Phase 6 drift
  pattern.
- **Previous:** Session 7-1 (API Client Re-verify + Generate, CONTRACT/PORT hybrid, dial MEDIUM),
  CONFIRMED, executed, CLOSED SUCCESSFUL 2026-08-12. First session of Phase 7 (API Client
  Rewrite) — `lib/api/index.ts` finally touched after being on `EXECUTOR-PROTOCOL.md` §5's
  standing do-not-touch list for the entire migration.
  **PD1 (the decision model, `DECISION-LOG.md`) went into effect this session for the first
  time** — the order arrived with a `Decisions taken` section (Advisor picked Option (b) —
  `@nestjs/swagger` spec emission + generated typed clients — over hand-authoring 107 service
  routes or a monolith-only client) instead of an open question. CONFIRM found the order and 3
  other governance docs (`EXECUTOR-PROTOCOL.md`, `00-SKELETON-AND-RULES.md`, `DECISION-LOG.md`)
  all modified-but-uncommitted — the by-now-familiar `LESSONS-LEARNED.md` L11 pattern, but this
  time as one large, internally consistent batch (the PD1 entry cites real, independently-
  checkable incidents — F52's missing table, F48/F49's dLocal bugs, gap-matrix row A2-12's false
  `BUILT` claim) rather than a lone status flip. Reported in full before proceeding; Davin
  explicitly confirmed the PD1 batch and this order's `APPROVED` status as authentic before
  execution began — recorded as `DECISION-LOG.md`'s own PD1 entry note, not silently trusted.
  **Independently re-verified every claim before executing, not just the ones in the order's own
  checklist:** re-derived all 7 headline counts in `OPENAPI-DRIFT-REPORT-pre-phase-7.md` from live
  code (112 unique spec paths / 129 monolith route files / 42 undocumented / 27 spec'd-but-absent
  / 62 operation-service operations / 45 money-service operations / 107 total) — all correct in
  aggregate, but found 4 real errors in the report's own internal breakdown (§2a's "18 token-_
  routes" header vs. a real count of 15 — 14 route files + `[...nextauth]`; §2d's header says "3"
  but lists 5; 3 wrong rows in the operation-service per-controller table that net-wash to the
  right 62 total; `/api/webhooks/riseworks` undocumented but never once mentioned in the report's
  own §2 breakdown despite being needed to make "42" add up) — see this order's own Deviation 0.
  Re-verified all 4 historical `lib/api/` mismatches (alerts PUT-vs-PATCH, notification read
  path, preferences PATCH-vs-PUT, market-data phantom path) against BOTH the live operation-
  service controllers AND the real monolith `route.ts` handlers `lib/api/index.ts` actually calls
  — all 4 still live and broken today, zero drift.
  **Built all 5 Ordered Steps, one commit each, plus a housekeeping commit for the PD1 batch:**
  Step 0 (housekeeping, not an Ordered Step) — committed `EXECUTOR-PROTOCOL.md`/`00-SKELETON-
AND-RULES.md`'s own PD1 edits, which had been sitting uncommitted since 2026-08-11. Step 1 —
  fixed the 4 genuinely-wrong monolith spec paths (`/api/auth/register` removed; both `/api/
  admin/disbursement/batches_`paths lost the`admin`segment AND gained the real`batchId`param
  name, not just a segment removal;`/api/wise/recipients/{id}`replaced with the real`POST
  .../revalidate`operation since the GET/DELETE it previously described were never built, not
  just renamed;`part-08`'s `/dashboard/watchlist`removed + a category-error notice added).
  Step 2 —`@nestjs/swagger@^11.4.6`added to both services;`scripts/generate-openapi-spec.ts`  boots the real`AppModule`DI graph and lets`SwaggerModule`introspect the live controllers —
  emits 47 unique paths/62 operations (operation-service) and 43 paths/45 operations (money-
  service, correctly under`/v1`except`/health`/`/health-auth`, replicating `main.ts`'s own
  `setGlobalPrefix()`call before`createDocument()`). **Request/response body schemas are
  deliberately generic (`type: object`), not fabricated** — both services validate via Zod
  through a custom `ZodValidationPipe`, not class-validator DTOs, so `@nestjs/swagger`has no
  decorator metadata to read for bodies; documented explicitly in both scripts' own headers and
  each spec's`info.description`, with a concrete follow-up plan (Zod-to-OpenAPI conversion, or
  targeted `@ApiBody()`on high-value routes) left for a future session rather than attempted here
  (100+ routes' worth of schema work is disproportionate to a MEDIUM-dial session). Found and
  worked around a real, pre-existing, unrelated bug while testing: money-service's
 `WiseWebhookProcessor.onModuleDestroy()`throws if`app.close()`runs before its BullMQ Worker
  finishes async-initializing — both generator scripts skip`app.close()`entirely (a one-shot
  script has nothing to gracefully drain) rather than touch that already-tested production file.
  Step 3 —`openapi-typescript`/`openapi-fetch` added to the monolith root via **pnpm**, not npm
  (`npm install`fails outright —`@trading-alerts/types`is referenced with a`workspace:_`   specifier the plain npm CLI can't parse, per F9's pnpm-workspace setup from Session 4B-1);
  `lib/api/generated/{operation-api,money-api}/{schema.ts,client.ts}`—`createOperationApi(token)`/
  `createMoneyApi(token)`wrap`openapi-fetch`'s real, path/method/param-typed client (typed
  against the Step-2-emitted specs, so a typo'd path or wrong method fails `tsc`, not just at
  runtime) for the network mechanics, with `unwrapOperationApi()`/`unwrapMoneyApi()`converting
  openapi-fetch's`{data,error,response}`result into the EXISTING`OperationServiceError`/
  `MoneyServiceError`throw-on-non-2xx convention every other caller of`lib/operation-service/
  client.ts`/`lib/money-service/client.ts` already expects — deliberately chosen over hand-writing
  ~107 named client methods (would itself become a second hand-maintained, driftable surface,
  directly contradicting Decision 1's own rationale) or a from-scratch fetch wrapper (`openapi-
  fetch`already solves path-param substitution and method-keyed typing correctly). Added
 `generate:api-client`to the root`package.json`, chaining both services' `openapi:generate`  with the two`openapi-typescript`invocations — verified idempotent (ran twice, identical 47/43
  path output both times). Step 4 —`lib/api/index.ts`rewritten: exports`operationApi`/
  `moneyApi`+`getOperationServiceToken`/`getMoneyServiceToken`; its own header now states
  explicitly that the WHOLE FILE is server-only (`LESSONS-LEARNED.md`L6 — re-exporting
  operationApi/moneyApi transitively pulls in`next/headers`via the error classes' home modules),
  verified safe today via a zero-current-importers grep across`app/`/`components/`/`hooks/`  before making the change (this file's only-ever real consumer,`app/test-api/page.tsx`, was
  deleted at Session 6-12). `stackA`/`stackB`kept exactly as-is and marked`@deprecated` rather
  than fixed or removed (Session 7-2/7-3's scope, per this order's own Retire section) — their
  previously module-private type interfaces are now exported (harmless, nothing imported them
  before). \*\*The token-_ bridge audit (Decision 3) resolved differently than its own literal
  framing implied**: `operationApi` wraps operation-service's OWN routes directly (e.g. `/auth/
2fa/setup`), which have no naming relationship to the monolith's separate `app/api/auth/token-*`
  bridge route FILES (Next.js handlers, never seen by `@nestjs/swagger`, never candidates for
  `operationApi`'s surface to begin with) — so there was nothing to literally "exclude" for this
  reason, the exclusion was already structurally true. Re-confirmed the 6 `token-2fa-*` monolith
  files are still dead (Session 4B-22's own finding, re-verified via a fresh zero-consumer grep)
  and documented this directly in `lib/api/index.ts`'s own header for a future retirement session
  — not deleted here. Step 5 — `__tests__/lib/api/generated-clients.test.ts`, 12 contract-style
  tests (root-prefix + path-param substitution, `/v1` prefix + the `health`/`health-auth`
  exclusion, Bearer-header attach/omit, `unwrap*` returning data on 2xx and throwing a REAL
  `OperationServiceError`/`MoneyServiceError` — not a mock double — with the right `.status`/
  `.body` on non-2xx including a 500, not just 4xx) — mocks `global.fetch` and asserts on the
  real `Request` object `openapi-fetch` constructs, exercising the actual generated client code
  (URL/path-param substitution, header merging, this session's own error mapping), not a vacuous
  mock; no live service process in this test run, matching this repo's own established `lib/api/`
  test convention and the order's own "contract-style unit tests" framing for Step 5.
  **Full verification:** `tsc --noEmit` clean throughout, re-checked after every step; `eslint app
components lib hooks --max-warnings 0` — same 4 pre-existing warnings, 0 introduced; monolith
  `test:ci` **154/154 suites, 2356/2356 tests** (was 153/153, 2344/2344 — +1 suite/+12 tests,
  exactly this session's own new file, zero regressions elsewhere); `operation-service` 42/42
  suites, 393/393 tests unchanged; `money-service` 62/62 suites, 522/522 tests on a clean run —
  first full run showed 1 flaky failure (`prisma.shutdown.spec.ts`, a SIGTERM-timing test already
  flagged sensitive to parallel-test load by `LESSONS-LEARNED.md` L25), independently confirmed
  unrelated to this session by passing in isolation and on two subsequent full-suite retries;
  money-service's own source was never touched this session (only `package.json` + a new
  `scripts/` file, nowhere near the Prisma shutdown code path).
  **No flag flipped, no cutover-table row** — pure client-SDK/tooling work, zero consumer
  rewiring (explicitly deferred to Session 7-2 per this order's own Rules), zero traffic-routing
  flag exists to touch; `migration-cutover-table.md` unchanged. The order's own header line
  "Flags touched: `MIGRATE_API_CLIENT`" was corrected before execution — that name is never
  referenced anywhere in code or docs, this session builds no traffic-routing flag at all.
  **Found, not fixed (out of scope):** a stale, contradictory CORS comment in `money-service/
src/main.ts` claiming the browser calls money-service directly via a `NEXT_PUBLIC_MONEY_API_URL`
  that doesn't exist anywhere else in the repo — leftover pre-F45 design documentation, directly
  contradicted by this session's own re-verification that `lib/money-service/client.ts` is
  genuinely server-only with zero client-side importers. Flagged in Waiting-on for whichever
  session next touches that file.
  **Artifacts updated:\*_ `7-1-api-client-reverify-and-generate.migration-order.md` (Status →
  CONFIRMED, executed; entry criteria all checked with CONFIRM-time findings recorded; Done-when
  all checked; Deviations filled in full — 9 entries), `DECISION-LOG.md` (PD1's own note on this
  session's confirmation), this file (Current/Previous rotation, Waiting-on, flag notes). New
  `7-2-api-client-migrate-consumers.migration-order.md` PRE-DRAFTed (migrate Phase 6 per-domain
  fetch wrappers onto `operationApi`/`moneyApi`; delete the already-empty leftover `app/api/auth/
register/` directory; audit which of the 6 dead `token-2fa-_` monolith files are safe to retire).

## Key documents

| What                                 | Where                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| **Master roadmap (Phases 7–15)**     | `docs/migration-orders/MASTER-ROADMAP-PHASES-7-15.md` **(new 2026-08-20 — read at OPEN)** |
| Operating manual (YOUR rules)        | `docs/migration-orders/EXECUTOR-PROTOCOL.md`                                              |
| Migration plan (phases, flags)       | `docs/migration-orders/monolith-to-microservices-migration-implementation-plan.md` (v1.3) |
| Session playbook                     | `docs/migration-orders/monolith-to-microservices-migration-session-playbook.md`           |
| Order rules + templates              | `docs/migration-orders/00-SKELETON-AND-RULES.md` + `TEMPLATE-*.md`                        |
| Decision Log                         | `docs/migration-orders/DECISION-LOG.md`                                                   |
| Lessons learned (read at every OPEN) | `docs/migration-orders/LESSONS-LEARNED.md`                                                |
| Cutover table                        | `docs/migration-orders/migration-cutover-table.md`                                        |
| File inventory                       | `docs/migration-orders/migration-stack-analysis.md`                                       |

## Non-negotiables (short form — manual has details)

1. **Never execute an order that is not CONFIRMED.** Lifecycle: PRE-DRAFT → DRAFT →
   APPROVED (Davin) → CONFIRMED (you, after re-verifying code AND runtime state).
2. **One session = one verifiable unit of work.** Never end mid-cutover or half-deployed.
   Blocked? Document the blocker and stop — don't push into a broken state.
3. **Artifacts are the only channel.** Your session transcript dies with the session; the
   Deviations section, CLAUDE.md, Decision Log, cutover table, and file inventory are how
   the Advisor and Davin know what happened. Empty Deviations = starved next plan.
4. **Scope discipline.** No drive-by fixes to change-frozen (CC-F) or out-of-scope code.
   `lib/api/index.ts` is known-broken BY DESIGN — do not fix until Phase 7.
   _(2026-08-20: Phase 7 is open — `lib/api/index.ts` was rewritten at Session 7-1 and is no
   longer on the do-not-touch list; `stackA`/`stackB` inside it remain Session 7-3's scope.)_
5. **Money and auth changes escalate.** Anything touching payments, grants, secrets, CORS,
   or auth semantics beyond the order's explicit steps → stop and ask Davin.
6. **Verification is never skipped, only strengthened.**
7. **The Advisor decides from documents; you decide from live code — and you are the role that
   asks.** (Binding from 2026-08-11; full rule `00-SKELETON-AND-RULES.md` §1.0,
   `EXECUTOR-PROTOCOL.md` §0; recorded as `DECISION-LOG.md` **PD1**.) Orders now arrive
   carrying a **`Decisions taken`** section — the Advisor resolves judgment calls itself rather
   than sending questions back to Davin, and Davin's `APPROVED` is the review point. Read that
   section first at CONFIRM. **Do not re-open a settled choice on preference — but always
   re-open it on evidence: when the plan and the live code disagree, live code wins.** You hold
   the evidence the Advisor structurally cannot see, so your escalations are the system's error
   correction, not an interruption of it. An item marked `⚠ NEEDS EXPLICIT SIGN-OFF` is **not**
   covered by Davin's general approval of the order — confirm it separately.

## Security Override Policy (retained from legacy guide — still binding)

Do **NOT** modify `overrides`/`pnpm.overrides` in `package.json` on feature branches, even
if `pnpm audit` complains. Security overrides are managed centrally on `main` via dedicated
PRs (`check-overrides.yml` enforces this; 7+ documented merge-conflict incidents caused the
rule — see `errors/continuous-pr-errors/`).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
