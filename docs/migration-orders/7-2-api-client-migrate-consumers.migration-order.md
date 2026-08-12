# Migration Order — Session 7-2 — API Client Migrate Consumers (Phase 7 continues)

> Second session of Phase 7 (API Client Rewrite). Per Session 7-1's own Next-session handoff and
> Rules ("Consumer rewiring is explicitly deferred to Session 7-2"): rewire existing monolith
> route handlers that call `operation-service`/`money-service` directly onto the new typed
> `operationApi`/`moneyApi` clients (`lib/api/generated/`, built Session 7-1), and clean up two
> small leftover items Session 7-1 found but correctly left out of its own scope.
> Adapted loosely from `TEMPLATE-PORT.md` — the shadow-run/cutover machinery in that template
> doesn't apply here (this is a same-behavior internal refactor, not a cross-service traffic
> migration; no new flag, no cutover). Read `00-SKELETON-AND-RULES.md` first — dial **LOW**:
> behavior preservation is the deliverable, not a chance to also fix `stackA`/`stackB`'s known
> bugs or add new operation-service/money-service functionality.

**Session:** 7-2 · **Phase:** Phase 7 (API Client Rewrite) · **Variant:** PORT (internal
refactor, no cross-stack move) · **Status:** PRE-DRAFT · **Generated:** 2026-08-12 (Executor, at
Session 7-1's close) · **Flags touched:** none expected (no traffic-routing change) ·
**Estimated time:** unclear until Step 0's own discovery pass runs — likely 3-5h given the
number of call sites found so far (see Context)

**Surface:** every `app/api/**/route.ts` handler that currently calls `operation-service`/
`money-service` — either the raw transport (`callOperationServiceWithToken`/
`callMoneyServiceWithToken`) or an existing per-route wrapper in `lib/operation-service/
routes.ts`/`lib/money-service/routes.ts`. `lib/api/index.ts`'s own `stackA`/`stackB` are
explicitly OUT of this session's surface (Session 7-3's job, see Known wrinkles).

**Feeds on:** `7-1-api-client-reverify-and-generate.migration-order.md`'s own Next-session
handoff and Deviations (the token-\* bridge audit, the empty `app/api/auth/register/` leftover);
`lib/api/generated/` (this session's actual consumer target).

## Context

Session 7-1 built `operationApi`/`moneyApi` — typed, generated clients wrapping
`callOperationServiceWithToken`/`callMoneyServiceWithToken` — but deliberately rewired zero
existing call sites (its own Rules: "No existing UI page or route handler call site should be
rewired in this session"). A shallow grep at 7-1's close found real, if partial, scope: **6**
`app/api/**/route.ts` files call `callOperationServiceWithToken`/`callOperationService()`
directly, and **1** calls `callMoneyServiceWithToken`/`callMoneyService()` directly — this is
almost certainly an UNDERCOUNT of the session's real scope, since many more route handlers likely
go through named per-route wrapper functions in `lib/operation-service/routes.ts`/
`lib/money-service/routes.ts` (e.g. `revalidateWiseRecipient`) rather than the raw transport
functions this grep matched. **Step 0 of this session must do a real, exhaustive discovery pass**
before any Ordered Step is trusted — this PRE-DRAFT deliberately does not enumerate the full file
list, per this migration's own repeated experience that pre-guessed file lists drift from ground
truth by CONFIRM (`LESSONS-LEARNED.md` L27).

Two small, already-diagnosed items from Session 7-1 also belong here: the empty leftover
directory `app/api/auth/register/` (no `route.ts` inside, safe to `rmdir`), and a decision on the
6 confirmed-dead `token-2fa-*` monolith route files (documented in `lib/api/index.ts`'s own
header at Session 7-1, not yet retired).

## Entry criteria

- [ ] Session 7-1 CONFIRMED, executed, CLOSED (see `CLAUDE.md` Current entry, 2026-08-12).
- [ ] `lib/api/generated/operation-api/client.ts` and `.../money-api/client.ts` re-read in full —
      confirm `createOperationApi`/`createMoneyApi`/`unwrapOperationApi`/`unwrapMoneyApi`'s exact
      signatures still match what this order assumes (re-verify at CONFIRM, don't trust this
      PRE-DRAFT's own citation).
- [ ] A real discovery pass (grep for `callOperationService`, `callMoneyService`, every named
      export of `lib/operation-service/routes.ts`/`lib/money-service/routes.ts`, across
      `app/api/**/route.ts`) run fresh at CONFIRM — the file list below is Step 0's own output,
      not assumed from this PRE-DRAFT.
- [ ] Monolith baseline re-measured (`tsc --noEmit` clean, eslint clean [4 pre-existing warnings],
      `test:ci` green — last known baseline: 154/154 suites, 2356/2356 tests).
- [ ] Advisor DRAFT reviewed and Davin APPROVED before execution.

## Integration points

- **In:** `lib/api/generated/{operation-api,money-api}/client.ts` (Session 7-1).
- **Out:** none new — this session doesn't add new endpoints, just changes which internal helper
  a route handler calls to reach an endpoint that already exists.
- **Owns:** the migrated `app/api/**/route.ts` files' own internal implementation only — their
  external HTTP contract (status codes, response shapes, error bodies) must NOT change.

## Ordered steps

### Step 0: Real Discovery Pass (do this before writing any migration code)

- **Intent:** Build the real, exhaustive list of call sites this session must migrate — this
  PRE-DRAFT's own Context section numbers (6 + 1) are a floor, not the real count.
- **Action:** Grep every `app/api/**/route.ts` for `callOperationService`, `callMoneyService`,
  and every named function `lib/operation-service/routes.ts`/`lib/money-service/routes.ts`
  export; cross-check against `lib/operation-service/write-routes.ts`'s
  `forwardRequestToOperationService()`/`forwardRequestToOperationServiceOptionalAuth()` callers
  too (Session 4B-6/4B-11 — these are a DIFFERENT, already-typed forwarding pattern for pure
  passthrough routes and may be legitimately OUT of this session's scope; a judgment call for
  CONFIRM, not decided here). Record the real file list, one row per file, SOURCE line count,
  and which specific call(s) need migrating.
- **Verification:** the resulting list is what Steps 1+ actually execute against — no code
  changes in this step.

### Step 1+: Migrate Call Sites (one commit per logical group, exact grouping TBD by Step 0's

output — likely one commit per domain, matching this migration's own established per-slice
commit convention)

- **Intent:** Replace each direct `callOperationServiceWithToken(path, token, init)`/
  `callMoneyServiceWithToken(path, token, init)` call with the equivalent
  `unwrapOperationApi(await operationApi(token).METHOD(path, {...}))`/money-service twin, byte-
  for-byte preserving the existing response shape, status code, and error mapping — this is a
  PORT-dial-LOW session, not a chance to also fix any of `stackA`/`stackB`'s known bugs.
- **Invariants:** every migrated route's own existing test file (if one exists) must pass
  UNMODIFIED — a test needing its assertion changed is a finding, not a fix (`LESSONS-LEARNED.md`
  L3). If a route has NO existing test, note that as an L28-class gap, not a blocker.
- **Verification:** `tsc --noEmit` clean after each group; the migrated route's own existing test
  suite (or a new one, if none existed) green.
- **Commit:** `refactor(api): migrate <domain> route handlers onto operationApi/moneyApi`

### Step N: Cleanup (small, do last)

- **Intent:** Close the two small items Session 7-1 flagged but correctly left out of its own
  scope.
- **Action:** `rmdir app/api/auth/register` (confirmed empty, no `route.ts`, safe — re-verify
  at CONFIRM before deleting anything). Decide and act on the 6 dead `token-2fa-*` monolith
  files (`app/api/auth/token-2fa-{setup,verify-setup,verify,status,disable,backup-codes}/
route.ts`) — either retire them for real (delete + remove from any spec/doc that lists them) or
  explicitly re-confirm they must stay for some reason this PRE-DRAFT doesn't know about; this is
  a real decision, not to be silently assumed either way.
- **Verification:** `tsc --noEmit`/`test:ci` clean; a fresh grep confirms zero remaining
  references to either the deleted directory or (if retired) the 6 dead files.
- **Commit:** `chore(api): remove empty app/api/auth/register/ leftover and retire dead token-2fa-* routes` (or a corrected message if the token-2fa-\* decision goes the other way)

## Rules specific to this variant

- Behavior preservation is the ENTIRE deliverable — a migrated route's external HTTP contract
  (status codes, response body shape, error format) must be byte-for-byte identical before and
  after. If `operationApi`/`moneyApi`'s generic (`unknown`) body typing makes a call site's
  existing explicit type annotation awkward, keep the explicit type at the call site (matching
  how the pre-7-1 `callOperationServiceWithToken<T>(...)` calls already worked) — don't fight the
  generated types by loosening the route handler's own contract.
- `stackA`/`stackB` in `lib/api/index.ts` are explicitly OUT of this session's scope (Session
  7-3's own retirement job, per Session 7-1's Deviations) — do not fix their known bugs as a
  drive-by while touching this file for other reasons.
- Every claim in Step 0's discovery output must cite a live file:line, not a guess.

## Done when

- [ ] Step 0's discovery output is the real, exhaustive file list (recorded in Deviations).
- [ ] Every discovered call site migrated (or explicitly deferred with a stated reason).
- [ ] `app/api/auth/register/` leftover directory removed.
- [ ] The 6 dead `token-2fa-*` files' fate decided and acted on.
- [ ] `tsc --noEmit` clean; `eslint app components lib hooks --max-warnings 0` clean (0 errors,
      max 4 pre-existing warnings); `test:ci` green with a net-neutral-or-positive test count
      (no test coverage lost during the migration).

## Rollback

- Each migrated route handler's `git revert` restores its own direct `callOperationServiceWithToken`/
  `callMoneyServiceWithToken` call — zero cross-file coupling, safe to revert one route at a time
  if a specific migration turns out wrong. Zero runtime impact either way (same services, same
  endpoints, same auth — only which internal helper constructs the request changes).

## Retire

- The empty `app/api/auth/register/` directory and (pending Step N's decision) the 6 dead
  `token-2fa-*` route files.

## Deviations

_(to be filled by Executor during execution)_

## Known wrinkles / do-not-touch

- `stackA`/`stackB` and their known bugs (`lib/api/index.ts`) — Session 7-3's scope, not this
  session's.
- Request/response body-schema fidelity in the generated OpenAPI specs (`CLAUDE.md` Waiting-on
  #136) — a separate, larger follow-up (Zod-to-OpenAPI or targeted `@ApiBody()`), not blocking
  this session's own call-site migration (the generic `unknown` typing is sufficient for a
  behavior-preserving port where the call site already knows its own expected shape).
- `lib/operation-service/write-routes.ts`'s forwarding helpers (Session 4B-6/4B-11) may or may
  not be in scope — a judgment call for CONFIRM/Step 0, not decided here.

## Next-session handoff

Likely Session 7-3 (retire `stackA`/`stackB` for real — fix or delete, Davin's call) — PRE-DRAFT
at this session's own close, informed by what Step 0's discovery pass actually finds.
