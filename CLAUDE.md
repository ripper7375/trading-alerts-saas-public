# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.** You (Claude Code) are the **Executor** in the
> three-role Development Chain Protocol (Advisor = Claude Cowork plans, Davin authorizes,
> you execute). Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` —
> **read it at the start of every session before doing anything else.**
> The previous content of this file (Aider validation guide) moved to
> `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

---

## Current state _(update at the end of EVERY session)_

- **Current:** Session 4A-4 CLOSED, executed end-to-end — 2026-07-22. **Phase 4A,
  blueprint §5.5 Slice 2 (RiseWorks + dLocal webhooks) is BUILT and deployed** —
  money-service's own webhook receivers exist in production at unique paths
  (`/v1/webhooks/{dlocal,riseworks}`) not yet wired to either provider's dashboard, so
  zero live traffic. Slice 1 (crons) unchanged from Session 4A-2's close, still
  `CRON_ENABLED=false`, still blocked on 4A-3's own entry criteria. Phase 3/Phase 1/
  Phase 0 all unchanged from Session 4A-1's close.
- **Current order:**
  `docs/migration-orders/4a-4-money-service-webhooks-build.migration-order.md`
  (CONFIRMED and EXECUTED end-to-end — all 4 File Port Order steps done, plus a
  post-CONFIRM schema-relation fix caught by `tsc`; every "done when" item satisfied,
  see below).
- **Order status:** CLOSED, all-green. **What shipped:**
  - **CONFIRM caught 3 untraced transitive dependencies + a path error in the APPROVED
    order before execution**, all fixed in place (order stayed APPROVED → CONFIRMED, no
    DRAFT bounce): (1) File 1/4's schema path (`packages/db/prisma/schema.prisma`
    doesn't exist; real path is `money-service/prisma/schema.prisma`); (2) File 2/4
    named `dlocal-payment.service.ts`/`three-day-validator.service.ts`/
    `conversion-processor.ts` but missed `lib/dlocal/constants.ts` (163 lines),
    `types/dlocal.ts` (150 lines), and `lib/affiliate/commission-calculator.ts` (253
    lines) — all 3 genuinely imported by the named files. Same L37 pattern
    (`LESSONS-LEARNED.md`) as Session 4A-2, third occurrence.
  - **File 1/4 — schema expansion**: added `Payment` and `RiseWorksWebhookEvent`
    models (full copies, no relation objects — neither is traversed via `include` in
    this slice's scope), `hasUsedThreeDayPlan`/`threeDayPlanUsedAt` on the existing
    narrow `User` subset (read/written by `three-day-validator.service.ts`).
    **Execution-phase deviation**: `npm run build` caught a 4th gap `tsc` alone could
    surface — Session 4A-2's schema had deliberately omitted
    `AffiliateCode.affiliateProfile` ("not traversed" in the crons-only scope), but
    `conversion-processor.service.ts` genuinely does `include: { affiliateProfile:
... }`. Added the relation + `AffiliateProfile.affiliateCodes` back-relation,
    `AffiliateCode.commissions` still correctly omitted. `LESSONS-LEARNED.md` L37 got a
    recurrence note; `npx prisma generate` + `npm run build` clean after the fix.
  - **File 2/4 — dLocal webhook logic**: `dlocal-payment.service.ts` ported as plain
    functions (no DI in source — matches `webhook-verifier.ts`'s own treatment).
    `three-day-validator.service.ts` and `conversion-processor.ts` converted to
    `@Injectable()`s (`ThreeDayValidatorService`, `ConversionProcessorService`) with
    `PrismaService`/`AffiliateConfigService` DI, same pattern as Session 4A-2's cron
    services. `DlocalWebhookController` maps the source route 1:1, using `@Res()` +
    Nest's `rawBody: true` option (added to `main.ts`) so HMAC verification sees the
    exact bytes dLocal signed, not a JSON round-trip.
  - **File 3/4 — RiseWorks webhook logic**: `webhook-verifier.ts` ported as a plain
    class (no DI in source). `event-processor.ts` converted to `@Injectable()`
    `WebhookEventProcessorService` with `PrismaService` + the already-ported
    `TransactionLoggerService` DI (same conversion pattern as the rest of Session
    4A-2's disbursement tree); reuses the existing `WebhookEvent` type from
    `disbursement.types.ts` instead of a local redeclaration.
    `RiseworksWebhookController` maps the source route 1:1.
  - **File 4/4 — tests + backfill**: ported 1:1 (assertions unchanged): dlocal-payment,
    three-day-validator, webhook-verifier, commission-calculator specs (the 4 pure
    calculator functions only — its 3 `*WithDynamicConfig` wrappers had no source
    coverage either, confirmed unused anywhere in the monolith via grep). **New
    backfill coverage** (zero existing coverage anywhere, flagged at CONFIRM):
    `WebhookEventProcessorService` (event-processor.ts never had a test file at all),
    `ConversionProcessorService` (the one existing "affiliate-conversion" test covers
    `/api/checkout/validate-code`, a different route — not `processAffiliateConversion`
    itself), and both new controllers' full orchestration (source's own
    `route.test.ts` explicitly scoped itself to signature/status logic only: "Full API
    route integration tests require a database connection"). One test-infra fix
    required: `verifyWebhookSignature` reads a module-level `const` captured from
    `process.env` at import time — a per-test `process.env` assignment runs too late
    to affect it, so the controller spec mocks the function directly instead (new
    `LESSONS-LEARNED.md` L40). **money-service: 15 suites → 202 tests, all green**
    (was 90 at Session 4A-2's close). Monolith's own 10 relevant suites / 182 tests
    re-run green, source untouched.
  - **Deployed to Railway production** (`railway up --path-as-root`, deployment
    `073a0478-dfe4-4226-aa97-9d08d5eee23e`). `railway logs` shows a clean boot:
    `DlocalModule`/`RiseworksModule` initialized, `DlocalWebhookController
{/v1/webhooks/dlocal}` and `RiseworksWebhookController {/v1/webhooks/riseworks}`
    both mapped, `Nest application successfully started`, no errors. `/health`
    confirms `database: up`.
  - **Verification plan step 3, done against the live production URL**: `POST
/v1/webhooks/dlocal` with a bogus `x-signature` → `400 Bad Request`,
    `{"error":"Invalid signature"}`. `POST /v1/webhooks/riseworks` with no
    `x-rise-signature` header → `401 Unauthorized`, `{"error":"Missing signature"}`.
    Both match the order's "done when" criterion exactly — proves the routes are
    registered and protected, without needing `DLOCAL_WEBHOOK_SECRET`/
    `RISE_WEBHOOK_SECRET` to be set (they aren't, see Waiting-on #26 below).
- **Waiting on:** all Session 4A-2 items unchanged except where noted below (renumbered
  continuation). (1)-(6), (11)-(12), (17)-(20), (23), (27)-(28) unchanged — see prior
  closes for full text. (17) CC-A's dedicated staging stack still doesn't exist. **(26,
  narrowed)** Stripe/dLocal/RiseWorks/Resend secrets still not set on money-service —
  now genuinely blocking: this session's webhook receivers are live in production and
  correctly reject unsigned requests, but a REAL signed payload from either provider
  can't be end-to-end verified until `DLOCAL_WEBHOOK_SECRET`/`RISE_WEBHOOK_SECRET` are
  set (confirmed unset via `railway variables --kv` at this session's deploy step) —
  this is now Session 4A-5's own first entry criterion. **(29)** `CRON_SECRET` — per
  4A-3's own PRE-DRAFT, unchanged, not this session's concern. **(30, unresolved, now
  2 sessions running)** `LESSONS-LEARNED.md` is now at 40 active lessons (L1-L40) — AT
  the stated cap; the NEXT session that touches it must flag the Advisor for a
  consolidation pass before adding another (file's own header instructions; CLAUDE.md
  has now flagged this twice, Sessions 4A-2 and 4A-4). **(31, NEW)** Session 4A-5's
  entry criteria need a real signed-payload replay per provider (playbook's own framing
  for this slice: "BUILD (replay tests with recorded signed payloads) then CUTOVER") —
  this session's own deploy verification only proved unsigned/invalid-signature
  rejection (400/401), not a real signed payload's full happy path against the new
  endpoints. Needs waiting-on #26 resolved first (secrets), then a provider dashboard
  "send test webhook" or a Davin-provided recorded real payload.
- **Last session did:** Session 4A-4 ("money-service: webhooks — Slice 2 BUILD") —
  closed 2026-07-22, all-green, executed end-to-end as a PORT session. CONFIRM caught
  3 untraced transitive dependencies + a schema path error in the APPROVED order
  before execution (same L37 pattern as Session 4A-2, third occurrence) — see "What
  shipped" above. Ported all 4 File Port Order steps (schema, dLocal logic, RiseWorks
  logic, tests — 202 tests green, up from 90). Execution-phase `tsc` caught a 4th gap:
  a schema relation Session 4A-2 had correctly omitted for its own narrower scope but
  this session's code genuinely needs (`LESSONS-LEARNED.md` L37 recurrence note).
  Added Nest's `rawBody: true` to preserve exact HMAC verification. Deployed to Railway
  production; verified both new endpoints correctly reject unsigned/invalid-signature
  requests (400/401) against the live URL — proving registration/protection without
  needing the still-unset provider secrets. New `LESSONS-LEARNED.md` L40 (module-level
  `process.env` capture defeats per-test mocking; `jest.mock()` must precede all
  imports). File now at the 40-lesson cap (Waiting-on #30).
- **Next session:** Session 4A-5 ("money-service: webhooks — Slice 2 CUTOVER") per the
  playbook and this order's own Next-session handoff — a small, separate
  TEMPLATE-VERIFY-RETIRE session (never combine BUILD and CUTOVER). **PRE-DRAFTed**
  at this close: `docs/migration-orders/4a-5-money-service-webhooks-cutover.migration-order.md`.
  Its entry criteria will need: (a) `DLOCAL_WEBHOOK_SECRET`/`RISE_WEBHOOK_SECRET` set on
  Railway (waiting-on #26/#31); (b) at least one real signed test event per provider
  verified end-to-end against the new endpoints (waiting-on #31); (c) Davin's live
  approval to update each provider dashboard's webhook URL — a cutover flag-flip per
  EXECUTOR-PROTOCOL §7, always escalated. Unlike Slice 1's crons, this cutover has no
  dual-execution-path risk (a provider only ever calls one configured URL), so no
  `CRON_ENABLED`-style safety gate is needed — rollback is just reverting the
  dashboard URL.
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
