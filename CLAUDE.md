# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.** You (Claude Code) are the **Executor** in the
> three-role Development Chain Protocol (Advisor = Claude Cowork plans, Davin authorizes,
> you execute). Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` —
> **read it at the start of every session before doing anything else.**
> The previous content of this file (Aider validation guide) moved to
> `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

---

## Current state _(update at the end of EVERY session)_

> **STANDING INSTRUCTION (Davin, 2026-07-22, still in force until Davin lifts it):
> chain-length-one invoked — NO further BUILD sessions.** Davin is manually running
> Session 4A-5's (webhooks) shadow-run verification himself; webhooks cut over FIRST,
> before 4A-7 or any Slice 4 work. The next session that opens should check with Davin
> before starting anything beyond what he explicitly asks for — see Waiting-on #33.

- **Current:** Session 4A-6 CLOSED, executed end-to-end — 2026-07-22. **Phase 4A,
  blueprint §5.5 Slice 3 (Read APIs) is BUILT and deployed** — money-service's own read
  API controllers exist in production at unique paths (`/v1/affiliate/dashboard/*`,
  `/v1/admin/*`) not yet called by the frontend, so zero live traffic. Slice 2
  (webhooks) unchanged from Session 4A-4's close — still not wired to either provider's
  dashboard, still blocked on Session 4A-5's own unresolved entry criteria (see Waiting
  on). Slice 1 (crons) unchanged from Session 4A-2's close, still `CRON_ENABLED=false`.
  Phase 3/Phase 1/Phase 0 all unchanged from Session 4A-1's close.
- **Current order:**
  `docs/migration-orders/4a-6-money-service-read-apis-build.migration-order.md`
  (arrived with a self-contradictory status — header said APPROVED, its own Entry
  Criteria checkbox still said `[ ] Davin approves this DRAFT`, no git history at all —
  see the order's own CONFIRM note. Davin confirmed approval live in-session; CONFIRMED
  and EXECUTED end-to-end after that, all 3 File Port Order steps done plus a
  CONFIRM-phase file-list correction and a schema-relation fix; every "done when" item
  satisfied, see below).
- **Order status:** CLOSED, all-green. **What shipped:**
  - **CONFIRM found the order's SOURCE file list was simply wrong, not just imprecise**
    (`lib/affiliate/stats.ts`/`lib/admin/commission-queries.ts` don't exist anywhere in
    the repo) — traced the real files fresh from all 12 GET routes' actual imports
    before writing any code. Also found 3 of the order's own in-scope files
    (`admin/affiliates/{suspend,reactivate,distribute-codes}`) and the entirety of
    `admin/commissions/*` (just `pay/route.ts`) are POST-only mutations, correctly
    excluded per the order's own Slice-4 boundary. See the order's own Deviations
    section for the full corrected file list and reasoning.
  - **File 1/3 — schema expansion**: added `Commission.affiliateCode` relation +
    `AffiliateCode.commissions` back-relation — `commission-report/route.ts`'s port
    needs `include: { affiliateCode: { code, usedAt } }` on `Commission`, which Session
    4A-4 had correctly omitted for its own narrower scope. 4th occurrence of this
    schema-relation-gap pattern (`LESSONS-LEARNED.md` L37 recurrence note, 2nd
    recurrence of this specific variant). `npx prisma generate` clean; per Session
    4A-2/4A-4 precedent, no `db push`/`migrate deploy` was run against production this
    session either — see Waiting-on, this gap now spans all 3 built slices.
  - **File 2/3 — controllers & services**: `lib/affiliate/report-builder.ts` (440
    lines) ported as `ReportBuilderService` (`@Injectable`, `PrismaService` DI, same
    conversion pattern as `ConversionProcessorService`). Read-relevant subset of
    `lib/affiliate/validators.ts` ported (pagination/codes-list/commission-report
    schemas only — registration/payment-detail schemas are Slice 4). `lib/admin/
pnl-calculator.ts` and `lib/admin/affiliate-management.ts` ported (the latter as
    `AdminAffiliateManagementService`). 3 files already ported in Session 4A-2
    (`affiliate.constants.ts`, `affiliate.types.ts`, `affiliate-config.service.ts`)
    reused as-is, not re-ported. New `AdminGuard`/`AffiliateGuard` replicate
    `requireAdmin()`/`requireAffiliate()`'s 403 shapes; `JwtAuthGuard` (already built,
    Session 3-1/3-2's F6/F7 bridge) supplies 401. `AffiliateDashboardController` (4
    routes), `AdminAffiliatesController` (list+detail), `AdminAffiliateReportsController`
    (5 report routes), and `AdminAnalyticsController` (its own bespoke inline
    admin-check, NOT the shared `AdminGuard` — confirmed at CONFIRM that its source
    never calls `requireAdmin()`/`session.ts` at all) map their source routes 1:1,
    response shapes matching exactly. Added `zod` as a direct money-service dependency
    (wasn't one at all before this session).
  - **Found a real bug in the source, not fixed there (out of scope), documented in the
    port instead**: the 4 `app/api/affiliate/dashboard/*` routes' own catch blocks
    check `error.message.includes('AFFILIATE_REQUIRED'/'UNAUTHORIZED')`, but
    `lib/auth/session.ts` only ever sets that marker on the error's `.code`, never its
    `.message` — both branches are dead code, every real auth failure on these 4 routes
    falls through to a generic 500 in production today, zero test coverage either way.
    The NestJS port implements the CORRECT/documented contract (`AffiliateGuard`) each
    route's own JSDoc promises, not the unreachable bug.
  - **File 3/3 — tests**: ported `affiliate-management.test.ts` assertions unchanged
    (DI adaptation only). New backfill coverage (zero existing coverage anywhere,
    confirmed at CONFIRM) for `report-builder.ts` (never had a test file) and
    `pnl-calculator.ts`'s `calculateStandardSale`/`getReportingPeriod` (source test
    only covered `calculatePnL`) — same precedent as Session 4A-4. New guard specs +
    controller specs for all 4 new controllers (success/validation/not-found/forbidden
    paths). **money-service: 24 suites → 24 suites, 202 → 256 tests, all green.**
  - **Deployed to Railway production** (`railway up --path-as-root`, `{"status":
"success"}`). `railway logs` shows a clean boot: `AffiliateModule`/`AdminModule`
    initialized, all 12 new routes mapped, `Nest application successfully started`, no
    errors. `/health` confirms `database: up`.
  - **Verification plan step 3, done against the live production URL**: all 12 new
    routes hit with no `Authorization` header → `401`, `{"message":"Missing bearer
token","error":"Unauthorized","statusCode":401}`. Matches the order's "done when"
    criterion exactly.
- **Waiting on:** all Session 4A-4 items unchanged except where noted below (renumbered
  continuation). (1)-(6), (11)-(12), (17)-(20), (23), (27)-(29) unchanged — see prior
  closes for full text. (26) Stripe/dLocal/RiseWorks/Resend secrets still not set —
  unchanged, Session 4A-5's own first entry criterion. (31) Session 4A-5's real
  signed-payload replay requirement — unchanged, still needed. **(30, unresolved, now 3
  sessions running)** `LESSONS-LEARNED.md` still at 40 active lessons (L1-L40) — AT the
  stated cap; this session found 2 more genuinely new lessons (recorded in the 4A-6
  order's own Deviations + LESSONS-LEARNED.md's header note instead of as new numbered
  entries, per the file's own "pause before adding another" instruction) without a
  consolidation pass happening. Flagged in Sessions 4A-2, 4A-4, and now 4A-6 — this is
  no longer a one-off, it needs the Advisor's attention before the next order that
  touches this file. **RESOLVED same-day by Davin**: the Advisor ran the consolidation
  pass 2026-07-22 — old lessons moved to `LESSONS-ARCHIVE.md`, active file is now clean
  (L1-L10), and L1 codifies item #32 below. **(32, CORRECTED — was wrongly framed as
  CRITICAL/actionable by this session, corrected same-day by Davin):** money-service does
  **NOT** have its own database — per blueprint §5.1 ("Phase 1: one instance, two
  roles/schemas"), it shares the MONOLITH's single Postgres instance via the `money_svc`
  role (L36) and only ever defines a schema SUBSET. Sessions 4A-2/4A-4/4A-6 running only
  `prisma generate` (never `db push`/`migrate deploy`) from money-service was therefore
  the CORRECT and ONLY safe behavior, not a gap — running either from money-service would
  risk dropping the monolith's own tables that aren't in money-service's subset. The
  monolith remains the sole owner of all schema migrations; money-service's schema.prisma
  subset just needs to keep matching whatever the monolith's migration history already
  established. New `LESSONS-LEARNED.md` L1 (Session 4A-6, Advisor review) makes this a
  hard rule — read it before ever considering a Prisma migration command from
  money-service again. **(33, RESOLVED same-day by Davin — chain-length-one invoked)**
  Session 4A-6's own predecessor order arrived APPROVED with an internally contradicted,
  untracked, no-git-history file while Session 4A-5 was still unresolved at DRAFT, so two
  cutover orders (4A-5, 4A-7) ended up pending simultaneously. Davin's ruling: invoke
  "chain-length-one" — **stop all BUILD work**; Davin is manually running 4A-5's
  shadow-run verification himself and webhooks (Slice 2) will cut over FIRST, before
  anything else (including 4A-7) proceeds. No further Slice 3/4 work until Davin says so.
  **(34, RESOLVED same-day by Davin)** 4A-7's browser-auth design question: blueprint
  §4.2 — "No cookie sharing across domains — the frontend sends `Authorization: Bearer`."
  The Next.js frontend will manually extract its JWT and attach it as a Bearer header
  when calling money-service's Read APIs. `JwtAuthGuard`/`AdminGuard`/`AffiliateGuard`
  (already built, Session 4A-6) need no changes — confirmed correct as-is by Davin. 4A-7's
  order updated to reflect this; still blocked on chain-length-one (#33) regardless.
  **(35, NEW)**
  `migration-stack-analysis.md`'s money-service section was never updated after Session
  4A-1 — Sessions 4A-2 and 4A-4's new files (crons/dlocal/riseworks/disbursement/
  affiliate-support modules) were never recorded there, a standing gap this session
  found and flagged but did not backfill (out of scope, full regen is an 8.6-only task
  per `00-SKELETON-AND-RULES.md` §5) — only this session's own additions were appended.
- **Last session did:** Session 4A-6 ("money-service: read APIs — Slice 3 BUILD") —
  closed 2026-07-22, all-green, executed end-to-end as a PORT session after a CONFIRM
  that found the order's own SOURCE file list was simply wrong (fabricated file names,
  not just imprecise ones) and its approval-chain paperwork self-contradictory (Davin
  confirmed live that approval was genuine). Ported all 3 File Port Order steps
  (schema relation, 5 new service/controller files + 2 reused, tests — 256 tests green,
  up from 202). Found and documented (not fixed — out of scope) a real dead-code bug in
  4 monolith routes' own auth-error handling. Deployed to Railway production; verified
  all 12 new endpoints correctly return 401 without a valid token. New
  `LESSONS-LEARNED.md` L37 recurrence note (2nd recurrence of the schema-relation-gap
  variant); 2 more new lessons found but deliberately NOT added as L41/L42 (cap
  discipline, Waiting-on #30) — recorded in this order's Deviations instead.
  PRE-DRAFTed Session 4A-7 (read APIs CUTOVER) with an explicit open design question
  flagged rather than guessed at.
- **Next session:** **Ambiguous — Davin must choose.** Two cutover orders are now
  pending: Session 4A-5 ("webhooks — Slice 2 CUTOVER", already at DRAFT, blocked on
  secrets + signed-payload replay, Waiting-on #26/#31) and Session 4A-7 ("read APIs —
  Slice 3 CUTOVER", **PRE-DRAFTed this close** at
  `docs/migration-orders/4a-7-money-service-read-apis-cutover.migration-order.md`,
  blocked on an unresolved browser-auth design question, Waiting-on #34). They're
  independent — either can go first — but per `00-SKELETON-AND-RULES.md` §1.5 ("chain
  length is exactly one"), do NOT start a 3rd Slice-4 BUILD session before at least one
  of these two resolves (Waiting-on #33). Both also share Waiting-on #32 (production DB
  schema never synced) as a blocker regardless of which goes first.
- **Open flags:** F1 fully RESOLVED (Session 0-3) · F2 RESOLVED (Session 0-1) · F3
  RESOLVED (Session 1-1: on Railway, different instance than `railway-gateway`) · F17
  RESOLVED (Session 0-5: synthetic seed only) · F18 RESOLVED (Session 1-1: RPO ≤ 24h,
  RTO ≤ 1h, with an unverified-backup-cadence gap — re-confirmed unchanged Session 1-4;
  this is the reason Phase 1 isn't marked exit-clean) · **F19 fully RESOLVED (Session
  2-1)** — audit + bump + codemods + production deploy, all verified · **F20 fully
  RESOLVED (Session 2-3)** — migration history baselined, `drop_watchlists`
  strip-and-orphaned per Davin, FK audit applied to production · **F4 fully
  RESOLVED (Session 2-2)** — model census, 1 market + 26 non-market + `RefreshToken`
  stub · **F5 fully RESOLVED (Session 2-4)** — split clients live in production code,
  every consumer repointed, old schema retired · **F21 OPEN** (24h Account-Deletion
  GDPR gap — requires Davin's product decision on hard-delete vs anonymize, scheduled
  for a future session) · **F22 fully RESOLVED (Session 2-4)** · **F6 fully
  RESOLVED (Session 3-1)** — bridge-first confirmed, the 3 "missing" reference docs
  found but explicitly disregarded (superseded OpenAuth seed material) · **F7 fully
  RESOLVED (Session 3-1)** — Path B (`JwtAuthGuard` decrypts NextAuth's JWE
  directly), proven via a real round-trip before the guard was built · **F23 fully
  RESOLVED (Session 3-2)** — `RefreshToken` hardened (hashed-at-rest via SHA-256,
  revocable, `userAgent`/`ipAddress`), applied to production as a pure `CREATE
TABLE` (the table never actually existed before) · **F24 fully RESOLVED (Session
  3-2)** — `/auth/login` issues NextAuth-compatible JWEs, same format `JwtAuthGuard`
  already verifies · **F25 fully RESOLVED (Session 3-3)** — test locally + deploy
  directly to production, Davin's call; a repeatable local-testing recipe now exists
  (L31/L32) · **F26 fully RESOLVED (Session 3-3)** — reuse NextAuth's exact cookie
  (corrected to the real per-environment name/attributes at CONFIRM, not the
  Decision Log's dev-mode shorthand) · **F27 fully RESOLVED (Session 3-3)** — defer
  `/auth/register` routing until email-sending is ported, unchanged from Davin's
  call · **F28 fully RESOLVED (Session 3-4)** — continue the F25 local-testing
  precedent, using real Resend API keys · **F29 fully RESOLVED (Session 3-4)** —
  port `lib/email/email.ts` in full into operation-service · **F30 fully RESOLVED
  (Session 3-4)** — CORS confirmed unnecessary, server-side proxying continues ·
  **F31 fully RESOLVED (Session 3-5)** — SVC_TOKEN leg descoped, pure VERIFY-RETIRE
  for SSR + browser legs · **F32 fully RESOLVED (Session 3-5)** — Davin set both
  missing Railway env vars, confirmed live at CONFIRM · **F33 fully RESOLVED
  (Session 3-5)** — production check completed same-session against the live
  Vercel URL, NextAuth confirmed unregressed, no outstanding items · **F15 fully
  RESOLVED (Session 4A-1, Davin)** — money-service reuses the existing shared
  Railway Redis instance, `op.*`/`money.*` namespaces, not a dedicated instance ·
  **F16 fully RESOLVED (Session 4A-1, Davin)** — public URL scheme
  `<api.domain/v1 + money.domain/v1>` · **F34 fully RESOLVED (Session 3-5, Davin)** —
  reuse the existing "postgre for staging" Railway project whenever CC-A's staging
  gap is actually addressed (base Postgres/Redis already provisioned there; nothing
  else built yet) · **F35 fully RESOLVED (Session 4A-2, Davin)** — money-service
  crons Slice 1's shadow-run mechanism given F34/CC-A isn't ready: `CRON_ENABLED` gate
  - manual-trigger verification, not a literal parallel staging run — see "What
    shipped" above ·
    F8–F14 OPEN (register: plan §11 · resolutions: `docs/migration-orders/DECISION-LOG.md`)

## Key documents

| What                                 | Where                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| Operating manual (YOUR rules)        | `docs/migration-orders/EXECUTOR-PROTOCOL.md`                                              |
| Migration plan (phases, flags)       | `docs/migration-orders/monolith-to-microservices-migration-implementation-plan.md` (v1.2) |
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
5. **Money and auth changes escalate.** Anything touching payments, grants, secrets, CORS,
   or auth semantics beyond the order's explicit steps → stop and ask Davin.
6. **Verification is never skipped, only strengthened.**

## Security Override Policy (retained from legacy guide — still binding)

Do **NOT** modify `overrides`/`pnpm.overrides` in `package.json` on feature branches, even
if `pnpm audit` complains. Security overrides are managed centrally on `main` via dedicated
PRs (`check-overrides.yml` enforces this; 7+ documented merge-conflict incidents caused the
rule — see `errors/continuous-pr-errors/`).
