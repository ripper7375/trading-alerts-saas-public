# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.** You (Claude Code) are the **Executor** in the
> three-role Development Chain Protocol (Advisor = Claude Cowork plans, Davin authorizes,
> you execute). Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` —
> **read it at the start of every session before doing anything else.**
> The previous content of this file (Aider validation guide) moved to
> `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

---

## Current state _(update at the end of EVERY session)_

- **Current:** Session 4A-2 CLOSED, executed end-to-end — 2026-07-21. **Phase 4A,
  blueprint §5.5 Slice 1 (8 cron jobs) is BUILT and deployed** — money-service's own
  NestJS scheduler exists in production, gated fully inert via `CRON_ENABLED=false`
  (F35). Phase 3/Phase 1/Phase 0 all unchanged from Session 4A-1's close (Phase 1 F18
  RPO gap unchanged; Phase 0 CC-A gap unchanged, see Waiting-on #17).
- **Current order:**
  `docs/migration-orders/4a-2-money-service-crons-build.migration-order.md`
  (CONFIRMED and EXECUTED end-to-end — all 6 File Port Order steps done, plus a
  post-CONFIRM `CRON_ENABLED` safety-gate addition; every "done when" item satisfied
  or explicitly resolved via F35, see below).
- **Order status:** CLOSED, all-green. **What shipped:**
  - **CONFIRM caught 2 material gaps in the APPROVED order before execution**, both
    fixed by the Advisor in place (order stayed APPROVED, no DRAFT bounce): (1) File
    1/6's Prisma model list was missing `User`/`Notification`/`AffiliateProfile` — all
    3 genuinely read/written by the 8 crons; (2) File 3/6's disbursement-processor
    dependency list was missing its entire transitive tree (10 more files, 2,415
    lines — `constants.ts`, `providers/{base,mock,factory}.ts`, 6 `services/*.ts`
    files) and File 2/6 similarly needed 5 more (`logger.ts`,
    `affiliate/{types,constants,db,code-generator}.ts`). See
    `LESSONS-LEARNED.md` L37 for the generalized rule this exposed (relative-import-only
    greps miss `@/`-alias imports).
  - **File 1/6 — Prisma schema subset**: 11 models (10 CONFIRMed + `DisbursementAuditLog`,
    found mid-port — a 12th dependency, `types/disbursement.ts`, was also found and
    ported). `User` is a NARROW subset (id/email/name/tier only — no
    password/2FA/trial fields, matching operation-service's own precedent); the other
    10 are full-model copies (money-service's own domain tables). Relations kept only
    where a real `include`/relation-filter is actually used (verified by reading every
    call site, not assumed from the source schema). `npx prisma generate` clean.
  - **File 2/6 — cron business logic**: `SubscriptionCronService`
    (check-expiring-subscriptions + downgrade-expired-subscriptions) and
    `AffiliateCronService` (monthly-distribution), plus their full leaf-first
    dependency tree, all converted to `@Injectable()`s with `PrismaService`
    constructor-injected. Query/mutation logic byte-identical to source.
  - **File 3/6 — disbursement processor + its full dependency tree** (11 files, 2,802
    lines): `DisbursementProcessorService`,
    `{Commission,BatchManager,PaymentOrchestrator}Service`,
    `{TransactionLogger,Transaction,RetryHandler}Service`, the 3 provider files, and
    `disbursement.{types,constants}.ts`. All converted to real `@Injectable()`s wired
    through Nest's DI container (previously manually `new`-ed from a raw
    `PrismaClient`). `PaymentOrchestratorService.executeBatch()`'s `provider` argument
    moved from constructor to method parameter — a Nest singleton can't take a
    runtime-varying constructor value the way source's per-call `new
PaymentOrchestrator(prisma, provider)` did.
  - **File 4/6 — `@nestjs/schedule` mapping**: added the dependency (wasn't installed).
    All 8 `vercel.json` cron expressions copied verbatim into `crons.scheduler.ts`,
    verified byte-for-byte against `vercel.json` directly (not just visual read).
    `daily-maintenance` composes the same 3-task sequence as source via the injected
    `SubscriptionCronService` (per the order's Known Wrinkles). Caught and fixed a
    self-inflicted bug: a doc comment quoting `` `app/api/cron/*/route.ts` `` — the
    literal `*/` prematurely closed the file's own JSDoc block, producing ~190
    cascading parse errors (`LESSONS-LEARNED.md` L38).
  - **File 5/6 — manual trigger endpoints**: `CronTriggerController`, 8
    `POST /v1/cron-trigger/<job>` routes, each calling the exact method the schedule
    itself invokes. `CronSecretGuard` mirrors the source routes' `Bearer <CRON_SECRET>`
    check.
  - **File 6/6 — tests + backfill**: added `jest-mock-extended` (mirrors the
    monolith's own convention). Ported 1:1 (assertions unchanged): both subscription
    cron test files (22 tests), monthly-distribution (6 tests), and the business-logic
    half of `cron-jobs.test.ts`/`process-pending.test.ts` (the 401 assertions in those
    are now `CronSecretGuard`'s own tests instead). **New backfill coverage** (zero
    existing coverage anywhere, flagged at CONFIRM): `daily-maintenance`'s 3-task
    composition, `syncRiseWorksAccounts`, `approveMaturedCommissions` — plus new tests
    for File 5/6's own guard and controller. Tests live colocated under
    `src/*.spec.ts` (money-service's existing `jwt-auth.guard.spec.ts` convention),
    not `money-service/test/` as the order's TARGET literally said — that path isn't
    in `jest.config.js`'s `testRegex`. **money-service: 7 suites → 90 tests, all
    green** (66 + 24 for the CRON_ENABLED gate, below). Monolith's own 19 suites / 225
    tests re-run green, source untouched.
  - **`CRON_ENABLED` safety gate added post-CONFIRM, before deploy (F35, Davin's
    explicit direction):** at slice-level verification, deploying with `vercel.json`'s
    crons still active would mean both Vercel and money-service executing the same
    jobs at the same scheduled minute against the same production database — a real
    double-disbursement risk. Fix: the 8 `@Cron()` decorators moved off the
    `handleX()` business-logic methods onto new `scheduledX()` wrappers that no-op
    unless `process.env.CRON_ENABLED === 'true'`. The `handleX()` methods stay
    ungated — `CronTriggerController`'s manual triggers call them directly. 24 new
    tests cover all 3 gate states per wrapper.
  - **Deployed to Railway production** with `CRON_ENABLED=false` (set via `railway
variables --set`, confirmed via `--kv`). `railway logs` shows a clean boot:
    `CronsModule`/`ScheduleModule` initialized, all 8 `/v1/cron-trigger/*` routes
    mapped, `Nest application successfully started`, no errors — this is File 4/6's
    own "Parity proof" (NestJS startup logs show crons registered), now verified
    against the real production log rather than an abandoned local Jest attempt (see
    `LESSONS-LEARNED.md` L39 for why that attempt was abandoned, not fixed). `/health`
    confirms `database: up`.
  - **This slice's actual shadow-run mechanism (F35, replaces the order's original
    "staging" assumption):** fire each `POST /v1/cron-trigger/<job>` by hand, once,
    after Vercel's own cron completes each day, and confirm idempotent behavior (a
    second run against already-processed data does nothing further). Chosen because
    F34 (Session 3-5) only reserves which Railway project ("postgre for staging")
    a future staging environment should use — it doesn't mean one is deployed and
    ready; actually standing money-service up there is a real, separate work item, out
    of scope for finishing this BUILD session.
- **Waiting on:** all Session 4A-1 items unchanged except where noted below (renumbered
  continuation). (1)-(6), (11)-(12), (17)-(20), (23) unchanged from Session 4A-1 — see
  prior close for full text; the load-bearing ones: (17) CC-A's dedicated staging stack
  still doesn't exist (now narrowed by F34/F35 — the Railway project to eventually use
  is already decided, but nothing is deployed into it yet). (26) Stripe/dLocal/
  RiseWorks/Resend secrets still not set on money-service — narrowed: this session's
  disbursement code defaults to the MOCK provider (`DISBURSEMENT_PROVIDER` env var
  unset), so real Rise secrets still aren't needed yet, consistent with Davin's
  original 4A-1 prediction. (27) money-service still has no custom domain bound. (28)
  `SVC_TOKEN` still unimplemented. **(29, NEW, blocks this slice's own shadow-run
  verification)** `CRON_SECRET` is NOT set on money-service's Railway environment at
  all (confirmed via `railway variables --kv`) — every `POST /v1/cron-trigger/<job>`
  call currently 401s with "Server configuration error" regardless of what secret is
  presented. Davin to set it directly on Railway (this environment's policy: secrets
  are Davin's action, never generated/typed by the Executor) before the manual-trigger
  verification plan (F35) can actually be exercised. **(30, NEW, non-blocking,
  informational)** `LESSONS-LEARNED.md` is now at 39 active lessons (L1-L39, cap
  ~40) — next session that touches it should flag the Advisor for a consolidation
  pass per the file's own header instructions.
- **Last session did:** Session 4A-2 ("money-service: crons — Slice 1 BUILD") — closed
  2026-07-21, all-green, executed end-to-end as a PORT session. CONFIRM caught and the
  Advisor fixed 2 rounds of file-inventory gaps in the APPROVED order before execution
  (schema models; two files' full transitive dependency trees, missing ~15 files/2,500+
  lines total between them) — see "What shipped" above and `LESSONS-LEARNED.md` L37.
  Ported all 6 File Port Order steps (schema, cron logic, disbursement processor +
  tree, `@nestjs/schedule` mapping, manual triggers, tests — 90 tests green). At
  slice-level verification, identified a real double-disbursement risk from deploying
  with `vercel.json`'s crons still active and no staging environment to shadow-run
  against instead (CC-A/F34 gap) — Davin's call (F35): add a `CRON_ENABLED` safety
  gate, deploy inert, verify via the manual-trigger endpoints instead of a literal
  parallel staging run. Deployed to Railway production with `CRON_ENABLED=false`,
  verified via clean startup logs. Blocked on Davin setting `CRON_SECRET` before the
  manual-trigger verification can actually run (waiting-on #29).
- **Next session:** Session 4A-3 ("money-service: crons — Slice 1 CUTOVER") per the
  playbook and this order's own Next-session handoff — a small, separate
  TEMPLATE-VERIFY-RETIRE session (never combine BUILD and CUTOVER). **PRE-DRAFTed**
  at this close: `docs/migration-orders/4a-3-money-service-crons-cutover.migration-order.md`.
  Its entry criteria will need: (a) `CRON_SECRET` set on Railway (waiting-on #29); (b)
  at least one full manual-trigger verification cycle per job showing idempotent
  behavior, logged somewhere durable (this order's Deviations or a fresh note) so
  4A-3's own CONFIRM has real evidence to point at, not just "it was built"; (c) Davin's
  live approval to flip `CRON_ENABLED=true` and empty `vercel.json`'s `crons` array —
  both are cutover-flag-flips per EXECUTOR-PROTOCOL §7, always escalated.
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
