# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.** You (Claude Code) are the **Executor** in the
> three-role Development Chain Protocol (Advisor = Claude Cowork plans, Davin authorizes,
> you execute). Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` —
> **read it at the start of every session before doing anything else.**
> The previous content of this file (Aider validation guide) moved to
> `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

---

## Current state _(update at the end of EVERY session)_

- **Current:** Session 4A-1 CLOSED, executed end-to-end — 2026-07-21. **Phase 4A has
  begun**: `money-service` exists, is deployed to Railway, and its skeleton
  (health/auth/Prisma) is proven live — see below. Phase 3 unchanged (still fully
  exit-clean, no outstanding items). Phase 1 still formally NOT exit-clean (F18 the sole
  blocker, unchanged). Phase 0 still formally open (CC-A gap unchanged, same
  local-testing workaround as before, `LESSONS-LEARNED.md` L31/L32/L33).
- **Current order:**
  `docs/migration-orders/4a-1-money-service-skeleton-deploy.migration-order.md`
  (CONFIRMED and EXECUTED end-to-end — every entry criterion and "done when" item
  checked off; F15/F16 were the two entry criteria this order gated on).
- **Order status:** CLOSED, all-green. **What shipped:**
  - **`money-service/` NestJS skeleton scaffolded and deployed** — NestJS 11.1.28 /
    Prisma 7.8.0 (same pins as operation-service, F2/F19), `/health` + `/health-auth`,
    the same NextAuth-JWE `JwtAuthGuard`/`next-auth-jwt.util.ts` bridge ported from
    operation-service (F6/F7), global `v1` route prefix per F16 (excluding
    `/health`/`/health-auth`). Added to root `tsconfig.json`'s `exclude` in the same
    commit (L30). No domain business logic yet (affiliate/billing/payments/disbursement
    modules are later BUILD sessions, 4A-4 onward) — deliberately didn't pre-stub their
    folders either (order's Deviations).
  - **Redis wired per F15** — reuses the SAME shared Railway Redis instance
    operation-service already uses (not a second dedicated one), namespaced apart via an
    ioredis `keyPrefix: 'money:'` on the Throttler storage client and a `BullModule.forRoot`
    `prefix: 'money'` for future queue registration (`src/queue/queue.constants.ts`).
    Verified locally against a throwaway `docker-compose.dev.yml` Redis container (SET/GET
    round-trip through the prefix, BullMQ `Queue.waitUntilReady()`), then torn down.
  - **Deployed to Railway** (`money-service-production.up.railway.app`) via `railway add
--service money-service` + `railway up ./money-service --path-as-root --service
money-service --environment production --ci --json` (L33 form). `DATABASE_URL`/
    `REDIS_URL`/`NEXTAUTH_SECRET` all set as `${{Service.VAR}}` Railway references —
    no raw secret value was ever typed, printed, or committed. `ALLOWED_ORIGINS` set to
    the known production Vercel origin only (money-service is called directly from the
    browser per blueprint §5.4, unlike operation-service's server-proxied posture, F30).
  - **First deploy's `/health` reported `database: down`** — PgBouncer's listener
    rejects a TLS handshake outright, but the `PrismaService` code (copied from
    operation-service's own, which works) unconditionally requested TLS. Removed the
    `ssl` option, redeployed: `/health` → `{"status":"healthy","services":{"database":
{"status":"up"}}}`. **This is the first-ever live proof the `money_svc` Postgres role
    actually authenticates through PgBouncer** — nothing had exercised that role before
    this session (unlike `core_app`, implicitly proven live the whole time via
    operation-service being Online). New `LESSONS-LEARNED.md` L36 generalizes the
    "don't copy a working service's Prisma `ssl` config without checking what it
    actually connects to" trap so it isn't rediscovered.
  - **Davin's guidance followed on 3 items flagged at CONFIRM:** SVC_TOKEN deferred (no
    core↔money call exists yet in a skeleton-only session); Stripe/dLocal/RiseWorks/Resend
    secrets NOT set (nothing in this session's code reads them yet — deploy succeeded
    without them, confirming Davin's own prediction); `money_svc` authentication proven
    live as part of this session's own deploy (see above), resolving the gap flagged at
    CONFIRM.
  - **Local test suites green:** money-service's own 7/7 (`JwtAuthGuard` spec, ported from
    operation-service). Root `type-check` and `npm run build` both stay clean with
    `money-service` excluded (L30's own detect-early check, re-run this session).
  - **F15/F16 resolution — a CONFIRM-time process gap, caught and fixed:** the order
    arrived at this session already marked `APPROVED` with F15/F16 checked off, but
    `DECISION-LOG.md`'s flag register still read both as OPEN and carried no resolution
    entries — the Advisor's DRAFT had omitted backfilling them. Flagged to Davin before
    executing; Davin confirmed the decisions were genuine and added the proper `## F15`/
    `## F16` entries himself before authorizing CONFIRMED. Executed only after that.
- **Waiting on:** (1, non-blocking, unchanged) `deploy.yml` still fails on every push
  to `main` at the GitHub workflow-file level (0s runtime) — known NOT to block real
  Vercel deploys, just dead/broken CI hygiene, not urgent. (2, RESOLVED Session 2-3,
  unchanged) Production's Prisma migration history is baselined — F20 closed. (3,
  non-blocking, unchanged) F18's RPO gap — Railway automated-backup cadence still
  unverified via CLI (dashboard-only). (4, unchanged, narrowed by L35) Davin to
  grant Vercel dashboard/preview-branch access — still blocks anything needing
  deployment logs, env-var inspection, or build status. Does NOT block
  read-only regression checks against the live public site, which Session 3-5
  proved work fine with just the known production URL (no dashboard access
  needed) — see L35. (5, unchanged, carried over) A human with delete permission to
  remove 5 remote stale branches (`HTTP 403` on `git push --delete` from this
  environment's credential). (6, unchanged, carried over) `railway`'s
  `tcp-proxy`/`private-network` CLI commands still not verified — low priority.
  (11, unchanged, carried over as F21) The 24h Account-Deletion GDPR gap —
  requires Davin's product decision, scheduled for a future session. (12,
  unchanged, carried over) The two split schema files still share ONE migration
  history and ONE Postgres database — deliberate, Davin-approved (F20, L24). (17,
  unchanged, non-blocking) CC-A's dedicated staging stack still doesn't exist
  (Phase 0 gap) — repeatable local-testing workaround exists (L31/L32/L33), now
  exercised for a 3rd time (Session 3-5) with zero new incidents; the underlying
  gap is still open. (18, unchanged, non-blocking until real traffic is pointed
  at `/auth/register`) `operation-service`'s `/auth/register` does not send
  verification emails (F27, still deferred, unchanged). (19, unchanged,
  non-blocking) `docker-compose.dev.yml` doesn't include `operation-service` —
  every session needing it locally must set it up by hand per L31/L32. (20,
  unchanged, non-blocking, environment-specific) this dev machine's native
  `postgres.exe` still shadows Docker's 5432 mapping — needs a remapped host
  port for local Postgres work (L32). **(21, RESOLVED Session 3-5)**
  `operation-service`'s `TWO_FACTOR_ENCRYPTION_KEY` is now set on Railway
  (Davin's action, confirmed via `railway variables` at this session's CONFIRM —
  44 chars; byte-for-byte match against Vercel's own value not independently
  verifiable from this environment, trusted as reported). **(22, RESOLVED
  Session 3-5)** `operation-service`'s `NEXTAUTH_URL` is now set on Railway to
  the real production Vercel domain (same confirmation). (23, unchanged, low
  priority) any future operation-service Railway deploy must use `railway up
./operation-service --path-as-root --service operation-service --environment
  production --ci --json` from the repo root (L33). **(24, RESOLVED Session
  3-5)** F33's Vercel production regression check — Davin asked for it to be
  run same-session rather than waiting for his own separate manual pass; a
  real browser hit the live production URL directly and confirmed NextAuth
  fully intact (see this session's "What shipped" above and
  `LESSONS-LEARNED.md` L35: the Vercel-access gap only blocks dashboard/CLI
  access, not the public site). **(25, RESOLVED Session 4A-1)** F15/F16 both
  decided by Davin (reuse the existing shared Redis; `<api.domain/v1 +
money.domain/v1>` URL scheme) — see Open flags. **(26, NEW, non-blocking until
  Slice 3+ of blueprint §5.5)** Stripe/dLocal/RiseWorks/Resend secrets are NOT
  yet set on money-service's Railway service — this session's skeleton has no
  code that reads them, so it wasn't needed yet, but each will need setting
  (Davin, directly on Railway) before the domain-module BUILD session that
  first depends on it. dLocal specifically has no live values anywhere yet
  (secret-matrix.md Gaps section, unchanged). **(27, NEW, non-blocking)**
  money-service has no custom domain bound (`money.<domain>` per F16) — reachable
  only at `money-service-production.up.railway.app`. Needs Davin's DNS action,
  same unresolved gap operation-service has always had (Waiting-on #4). **(28,
  NEW, non-blocking, carried from F31)** `SVC_TOKEN` still has zero real
  implementation anywhere — deferred again this session (Davin's explicit call,
  no core↔money call exists yet); will need building for real whenever a
  future slice actually establishes one.
- **Last session did:** Session 4A-1 ("money-service: skeleton + deploy") — closed
  2026-07-21, all-green, executed end-to-end as an INFRA session. CONFIRMed only after
  catching and resolving a Decision Log backfill gap (F15/F16 — see "What shipped"
  above). Scaffolded and deployed `money-service`'s skeleton (health/auth/Prisma, no
  domain logic yet), wired the shared Redis under a `money.*` namespace (F15), and
  proved — for the first time ever — that the `money_svc` Postgres role authenticates
  live through PgBouncer, after fixing a PgBouncer-doesn't-support-TLS mismatch found
  during the deploy itself (L36). Deferred SVC_TOKEN and the Stripe/dLocal/RiseWorks
  secrets per Davin's explicit guidance (nothing in this session's code needs them yet).
- **Next session:** Session 4A-2 ("money-service: crons — Slice 1 BUILD") per the
  playbook — blueprint §5.5 Slice 1's BUILD half only (CUTOVER is a separate 4A-3
  session; the playbook explicitly says never to combine BUILD and CUTOVER work).
  **PRE-DRAFTed** at this close:
  `docs/migration-orders/4a-2-money-service-crons-build.migration-order.md` — a
  PORT-variant session (Low creativity dial), needs the Advisor to produce the DRAFT,
  then Davin's APPROVAL. Flags for the Advisor: (a) the 8 cron jobs and their real
  `lib/cron/*`/`lib/disbursement/cron/disbursement-processor.ts` dependencies are
  already enumerated with line counts in the PRE-DRAFT — re-verify rather than
  re-discover; (b) `daily-maintenance` and `expire-codes`/`send-monthly-reports` don't
  have their own `lib/cron/*` file (logic is inline in the route or composed from other
  jobs') — read them before assuming they're thin wrappers; (c) money-service's Prisma
  schema is still model-less — this session must add the specific money-domain models
  these 8 jobs actually touch, narrow subset only, same hand-sync convention
  operation-service's schema.prisma already established (L24); (d) money-service's
  `PrismaService` deliberately has no `ssl` option (L36) — don't reintroduce it.
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
  `<api.domain/v1 + money.domain/v1>` ·
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
