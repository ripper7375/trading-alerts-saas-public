# Migration Order: Read APIs (Slice 3) → money-service

> For sessions that **move existing code between stacks** (Next.js lib/routes → NestJS; monolith rewiring). Read `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at **Low**: behavioral parity is absolute.

**Session:** 4A-6 (BUILD) · **Variant:** PORT · **Status:** CONFIRMED
**Generated:** 2026-07-22 · **Estimated time:** ~4h
**Phase / plan section:** Phase 4A — money-service, blueprint §5.5 Slice 3 (of 5)
**Target service:** money-service
**Contract:** Read APIs (dashboards, reports, admin lists) + Prisma schema subset.

> **CONFIRM note (2026-07-22):** this file arrived as an untracked, uncommitted document
> whose header claimed `Status: APPROVED` while its own Entry Criteria list below still had
> `[ ] Davin approves this DRAFT` unchecked — a direct self-contradiction, with no git
> history (no PRE-DRAFT → DRAFT → APPROVED commits) unlike every prior order in this repo.
> Session 4A-5 (webhooks CUTOVER) was CLAUDE.md's own recorded "next session" and was still
> sitting at DRAFT, unresolved — per `00-SKELETON-AND-RULES.md` §1.5 ("chain length is
> exactly one"), this order should not have existed yet. Flagged to Davin directly in-session
> before touching any code; Davin confirmed live, in chat, that approval was genuine despite
> the paperwork gap and instructed the Executor to correct the file list and execute — an
> explicit real-time instruction, which `EXECUTOR-PROTOCOL.md` §6 ("Instruction precedence")
> makes authoritative over the document trail. Entry criteria checkbox below corrected to
> reflect that. The SOURCE file list itself also failed re-verification (see Deviations) —
> the order's `lib/affiliate/stats.ts`/`lib/admin/commission-queries.ts` names do not exist
> anywhere in the repo; the real files were traced fresh at CONFIRM.

## Why this session, why now

Slice 2 (Webhooks) is currently BUILT and shadow-running in production. To continue the strangler migration without blocking, we are moving to Slice 3: Read APIs. `money-service` needs to natively serve data for the frontend dashboards (affiliate stats, admin commission lists, analytics).

## Entry criteria

- [x] Session 4A-1 (infrastructure) is complete and money-service is deployable.
- [x] Phase 4A blueprint is approved.
- [x] Davin approves this DRAFT. (Confirmed live in-session, 2026-07-22 — see CONFIRM note
      above; the document trail alone did not establish this.)

## Context & Boundaries

- **In scope:** `GET` routes in `app/api/affiliate/dashboard/*`, `app/api/admin/affiliates/*`, `app/api/admin/commissions/*`, `app/api/admin/analytics/*`, and any other `GET` routes strictly related to reading money/subscription/affiliate data.
- **Out of scope:** Any routes that mutate data (`POST`, `PUT`, `DELETE`, etc.), such as checkout, subscription cancellation, or batch execution. These are explicitly mapped to Slice 4 (Write APIs).
- **Safety Gate:** The new Read API endpoints in NestJS will have unique base paths. They will not receive live production traffic until Session 4A-7 (when we swap the base URL in the frontend).

## File port order

**File 1/3: Schema subset expansion**

- Check `packages/db/prisma/schema.prisma` inside `money-service`.
- Ensure all models required by the Read APIs are present. This likely requires bringing in the rest of the Affiliate and Analytics related models if not already present from previous slices.
- Do not migrate the entire schema, only what the compiler demands for these specific files.

**File 2/3: Controllers & Services**

- Port the business logic (e.g. `lib/affiliate/stats.ts`, `lib/admin/commission-queries.ts`) into NestJS services.
- Map the NextJS `GET` routes to NestJS controllers (e.g. `AffiliateDashboardController`, `AdminCommissionsController`).
- Ensure all response shapes match the original NextJS API responses EXACTLY so the frontend does not break.

**File 3/3: Tests**

- Re-wire all existing test suites for the above logic to run within the NestJS testing module.
- Keep all assertions exactly the same. No behavioral changes.

## Verification plan

### 1. Build & Typecheck

- `money-service` compiles without errors.

### 2. Test Parity

- The ported test suites must all pass locally within `money-service`.

### 3. Deploy

- Deploy `money-service` to Railway.
- Verify the new Read endpoints return a `401 Unauthorized` when hit manually without valid user auth tokens (proving the routes are registered and protected).

### Results (2026-07-22)

- Build & typecheck: `npm run build` clean (`nest build`, `tsc` no errors).
- Test parity: `npm test` → 24 suites / 256 tests, all green (was 202 tests at Session
  4A-4's close; +54 new/backfilled this session).
- Deploy: `railway up ./money-service --path-as-root --service money-service` →
  `{"status":"success"}`, deployment logs show `AffiliateModule`/`AdminModule`
  initialized and all 12 new routes mapped, `Nest application successfully started`.
  `/health` → `{"status":"healthy","services":{"database":{"status":"up"}}}`.
- All 12 new routes hit unauthenticated (`curl`, no `Authorization` header) → `401`,
  `{"message":"Missing bearer token","error":"Unauthorized","statusCode":401}` — matches
  this step's "done when" criterion exactly.

## Rollback

Read-only session, no live traffic (Safety Gate above) — nothing to roll back on the
public-facing side. If the Railway deploy itself needs reverting: `railway rollback` to
the previous deployment (`073a0478-...`, Session 4A-4's), or a plain `git revert` of this
session's 4 commits followed by a fresh `railway up`. The schema relation added in File
1/3 (`Commission.affiliateCode`) was never applied to the live database (see Deviations'
"Schema note") — nothing to reverse there either.

## Retire (after cutover proves stable)

_(Not this session. After 4A-7 cutover proves stable, we will delete the NextJS routes.)_

## Deviations

**CONFIRM-phase corrections (all fixed in place before execution):**

1. **SOURCE file list was wrong, not just imprecise.** The order named
   `lib/affiliate/stats.ts` and `lib/admin/commission-queries.ts` as the service-logic
   files to port — neither exists anywhere in the repo. Traced the real files fresh from
   the 12 GET routes' actual imports: `lib/affiliate/report-builder.ts` (440 lines, the
   file `app/api/affiliate/dashboard/stats/route.ts` genuinely imports as
   `buildDashboardStats`) and `lib/admin/affiliate-management.ts` (198 lines). Full
   transitive dependency trace (all 12 routes, recursively) found 5 files needing a fresh
   port (`report-builder.ts`, `lib/affiliate/validators.ts` — read-relevant subset only,
   `lib/admin/pnl-calculator.ts`, `lib/admin/affiliate-management.ts`, plus new
   `AdminGuard`/`AffiliateGuard`) and 3 already ported in Session 4A-2 and reused as-is
   (`affiliate.constants.ts`, `affiliate.types.ts`, `affiliate-config.service.ts`).
2. **Scope tightened to the 12 routes actually confirmed GET-only.** The order's own
   in-scope list (`app/api/admin/commissions/*`) turned out to contain only one file,
   `pay/route.ts`, and it's POST-only (pays out commissions — a mutation, correctly
   belonging to the order's own "Out of scope" Slice 4 bucket, not Slice 3). Similarly, 3
   of the files under `app/api/admin/affiliates/*` (`suspend`, `reactivate`,
   `distribute-codes`) are POST-only and excluded. The concrete 12-route list actually
   ported: `affiliate/dashboard/{stats,codes,code-inventory,commission-report}`,
   `admin/affiliates` (list), `admin/affiliates/[id]` (detail),
   `admin/affiliates/reports/{code-flows,code-inventory,commission-owings,profit-loss,
sales-performance}`, `admin/analytics`.
3. **Schema gap found beyond the order's own framing.** `commission-report/route.ts`'s
   port does `include: { affiliateCode: { code, usedAt } }` on `Commission`, which needs
   the `Commission.affiliateCode` relation object — Session 4A-4 had explicitly and
   correctly omitted it ("nothing in scope traverses it") for its own narrower scope.
   Added the relation + `AffiliateCode.commissions` back-relation. Same recurring pattern
   as `LESSONS-LEARNED.md` L37 (4th occurrence — see that entry's own recurrence note,
   appended this session).
4. **Zero test coverage confirmed for `report-builder.ts`** (never had a dedicated test
   file anywhere in the monolith, including the out-of-scope `frontend/` mirror) and for
   `pnl-calculator.ts`'s `calculateStandardSale`/`getReportingPeriod` (the monolith's own
   test file only ever covered `calculatePnL`) — both backfilled with new coverage, same
   precedent as Session 4A-4.
5. **`zod` was not a money-service dependency at all** — added as a direct dependency
   (`^3.22.4`, matching the monolith's own range) rather than relying on any transitive
   resolution (`LESSONS-LEARNED.md` L7's "direct `require()`/`import` needs a direct
   dependency" principle, generalized from `require()` to ES `import`).

**Execution-phase finding (not a source bug I introduced — found reading the source
carefully at CONFIRM, before writing any code):** the 4 `app/api/affiliate/dashboard/*`
routes' own catch blocks check `error.message.includes('AFFILIATE_REQUIRED')` /
`error.message.includes('UNAUTHORIZED')` to decide between 403/401/500 — but
`requireAuth()`/`requireAffiliate()` in `lib/auth/session.ts` only ever set that
distinguishing marker on the thrown `AuthError`'s `.code` field, never its `.message`
(e.g. the message is literally "You must be logged in to access this resource", which
contains neither substring). Both conditions are therefore dead code: every auth failure
on these 4 routes silently falls through to a generic 500, in production today, with zero
test coverage protecting either branch. The NestJS port (`AffiliateGuard`) implements the
CORRECT/documented 401-then-403 contract each route's own JSDoc promises
(`@returns 401 - Unauthorized`, `@returns 403 - Forbidden`) rather than replicating the
unreachable dead code — per `00-SKELETON-AND-RULES.md` §4, this is a "materially better
approach" on an unambiguous, zero-coverage bug, recorded here rather than silently made.
Not fixed on the monolith side (out of this order's scope — Slice 3 only touches the
money-service port, not the still-live Next.js routes).

**Schema note (carried forward, not this session's to resolve):** consistent with Session
4A-2/4A-4 precedent, this session did NOT run `prisma db push`/`migrate deploy` against
money-service's production database — only `npx prisma generate` (client codegen from the
schema file, no DB connection needed) was run, matching every prior BUILD session's own
pattern. money-service's live Postgres schema may not yet match `schema.prisma` for any of
the models/relations added across Sessions 4A-2/4A-4/4A-6. This is safe today only because
none of these routes receive live traffic yet (Safety Gate). Whoever plans the Slice 3
CUTOVER (or any earlier cutover) needs a real `prisma db push`/`migrate deploy` against
production as an explicit entry criterion — not yet true for ANY of the 3 slices built so
far, and not previously called out this plainly in an order's own text.
