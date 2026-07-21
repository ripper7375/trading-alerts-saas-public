# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.** You (Claude Code) are the **Executor** in the
> three-role Development Chain Protocol (Advisor = Claude Cowork plans, Davin authorizes,
> you execute). Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` —
> **read it at the start of every session before doing anything else.**
> The previous content of this file (Aider validation guide) moved to
> `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

---

## Current state _(update at the end of EVERY session)_

- **Current:** Session 3-1 IN PROGRESS, paused on two Davin-only actions —
  2026-07-21. Phase 2 (Session 2-4 + F22) **confirmed deployed and live in
  production** by Davin this session (closes out the last Phase 2 gap). Phase 3
  underway: F6/F7 resolved, `operation-service` scaffolded and deployed to Railway
  (`trading-alerts`/`production` — no CC-A staging stack exists yet, see below),
  `JwtAuthGuard` live and correctly fail-closed (401 on every request — by design,
  pending the secret grant below). Phase 1 still formally NOT exit-clean (F18 the
  sole blocker, unchanged, dashboard-only). Phase 0 still formally open (CC-A gap
  unchanged, and now concretely blocking Session 3-1's literal "staging" done-when
  target — see below).
- **Current order:** `docs/migration-orders/3-1-auth-decisions-operation-service-skeleton.migration-order.md`
  (CONFIRMED and executing — 3 of 4 "done when" items done, 1 partially done, blocked
  on Davin; NOT yet EXECUTED end-to-end)
- **Order status:** IN PROGRESS. CONFIRM corrected the order live (Davin's
  resolutions): Phase 2 deploy status confirmed; `NEXTAUTH_SECRET`'s entry criterion
  re-sequenced to a post-scaffold action (can't grant a service that doesn't exist
  yet); the 3 "missing" F6 reference docs actually exist (`backend-stack-a/`, predate
  this migration) but Davin explicitly disregards them as superseded OpenAuth seed
  material; a new gap found — Step 5/6's "staging" deploy target assumes CC-A's
  dedicated stack, which doesn't exist (Phase 0, only required before Phase 4) —
  Davin resolved it live: deploy into `production` as a new additive-only service.
  **What shipped:**
  - F6 (bridge-first) and F7 (Path B — `JwtAuthGuard` decrypts NextAuth's JWE
    directly) resolved in `DECISION-LOG.md`, with a real round-trip proof (next-auth's
    own `encode()` → standalone `jose`+`@panva/hkdf` decrypt, no `next-auth`
    dependency) recorded BEFORE the guard was built.
  - `operation-service/` scaffolded from scratch: NestJS 11.1.28 (not
    railway-gateway's 10.4.15, F2), PrismaModule (Prisma 7 + adapter-pg, zero models
    this session — deferred, Session 3-2 adds `User`/`RefreshToken` when it needs
    them), Redis-backed `ThrottlerGuard`, health module (`/health`, `/health-auth`).
  - `JwtAuthGuard`: 7/7 unit tests green (valid token, missing/non-Bearer header,
    malformed/wrong-secret/expired token, missing-required-claims — all 6 negative
    cases → 401, never a silent pass or 500).
  - Verified locally end-to-end first (real Postgres+Redis via
    `docker-compose.dev.yml`), then deployed to Railway
    (`https://operation-service-production.up.railway.app`). A real Railway build
    failure was found and fixed live (`postinstall: prisma generate` was missing —
    see `LESSONS-LEARNED.md` L29). Live `curl` against the deployed service: 401 with
    no token, 401 with a garbage token — both correct. The 200-with-a-real-token case
    is NOT yet verified (needs the two Davin actions below, then Davin's own
    independent check — a live session token is a bearer credential Claude does not
    handle, same reasoning as the raw secret).
  - `migration-stack-analysis.md`, `docs/secret-matrix.md`, `operation-service/.env.example`
    all updated to match reality.
  - Nine commits: `0ffe3296` (CONFIRM), `da142c7c` (F7 evidence), `d73825ae`
    (scaffold + guard), `efb0400e` (Steps 3-4 evidence), `22bda5b2` (postinstall fix),
    `a72e3a89` (railway.toml naming), `1a41443f` (deploy-outcome docs).
  - **Blocked, exactly two remaining actions, both Davin-only** (Claude does not
    handle either — standing constraint, not order-specific): (1) grant
    `NEXTAUTH_SECRET` to the `operation-service` Railway service (`docs/secret-matrix.md`);
    (2) fix `DATABASE_URL` on the same service — found live, not anticipated:
    `pgbouncer` has no native `DATABASE_URL` to reference (bespoke deploy, Session
    1-3b, not a Railway template); the `Postgres` service's own `CORE_APP_DB_PASSWORD`
    (paired with `MONEY_SVC_DB_PASSWORD` for money-service) is the intended scoped
    credential, combined with `pgbouncer.railway.internal`. `/health`'s DB sub-check
    correctly reports `degraded` in the meantime — fails closed/visibly, not silently.
- **Waiting on:** (1, non-blocking, unchanged) `deploy.yml` still fails on every push
  to `main` at the GitHub workflow-file level (0s runtime) — known NOT to block real
  Vercel deploys (Session 2-1 confirmed Vercel's own mechanism works independently),
  just dead/broken CI hygiene, not urgent. (2, RESOLVED Session 2-3, unchanged)
  Production's Prisma migration history is baselined — F20 closed. (3, non-blocking,
  unchanged) F18's RPO gap — Railway automated-backup cadence still unverified via
  CLI (dashboard-only). (4, unchanged, carried over) Davin to grant Vercel
  dashboard/preview-branch access. (5, unchanged, carried over) A human with delete
  permission to remove 5 remote stale branches (`HTTP 403` on `git push --delete`
  from this environment's credential). (6, unchanged, carried over) `railway`'s
  `tcp-proxy`/`private-network` CLI commands still not verified — low priority.
  (7, RESOLVED Session 2-4) The "which of the consumers touch MarketDataV6" question
  — answered for real: exactly 2 files, both now on `lib/db/market-prisma.ts`; every
  other consumer is on the non-market client. (9)/(10) RESOLVED Session 2-3,
  superseded by this session's execution. (11, unchanged, carried over as F21) The
  24h Account-Deletion GDPR gap — requires Davin's product decision, scheduled for a
  future session. (12, unchanged, carried over) The two split schema files still
  share ONE migration history and ONE Postgres database — deliberate, Davin-approved
  (F20, L24) — the plan document should still be updated before any future session
  assumes the two-history model is real. (13, RESOLVED Session 2-4) F22 — see
  `DECISION-LOG.md` F22 for detail. (14, RESOLVED this session) Production deploy of
  Session 2-4 + F22 — Davin confirmed live in production. **(15, NEW, blocking
  Session 3-1's completion) `NEXTAUTH_SECRET` grant to `operation-service` on
  Railway** — Davin sets directly, never through an agent (`docs/secret-matrix.md`).
  **(16, NEW, blocking) `DATABASE_URL` correction on `operation-service`** — current
  value (`${{pgbouncer.DATABASE_URL}}`) resolves to nothing, pgbouncer has no such
  key; needs `CORE_APP_DB_PASSWORD` (on the `Postgres` service) combined with
  `pgbouncer.railway.internal` into a real connection string, set directly by Davin
  (`docs/secret-matrix.md`). **(17, NEW, non-blocking)** CC-A's dedicated staging
  stack still doesn't exist (Phase 0 gap, unchanged) — `operation-service` deployed
  into `production` instead this session (Davin's call), additive-only; worth
  raising with the Advisor whether Session 3-1's playbook entry should be corrected
  to not assume a staging environment exists, or whether CC-A should be pulled
  forward.
- **Last session did:** Session 3-1 — closed 2026-07-21 per Davin's explicit
  instruction to wrap up, **with the two blocking actions below still outstanding**
  (not a normal all-green close; see the order's final Deviations entry for the
  explicit reasoning on why this is a safe state to pause in, not a broken one).
  F6/F7 resolved with round-trip proof; `operation-service` scaffolded, `JwtAuthGuard`
  implemented (7/7 unit tests), deployed to Railway production with a real build bug
  found and fixed live (missing `postinstall: prisma generate`, `LESSONS-LEARNED.md`
  L29). See "Current" above for the full breakdown. New `LESSONS-LEARNED.md` entries
  L28 (piping a command whose exit code you check, e.g. `npm install | tail`, hides
  real failures without `pipefail`) and L29 (a leftover manually-generated Prisma
  client masks a missing `postinstall` wiring until a genuinely clean build exposes
  it).
- **Next session:** Session 3-2 ("Token endpoints") per the playbook — **PRE-DRAFTed**
  at this close: `docs/migration-orders/3-2-token-endpoints.migration-order.md` (PORT
  variant, low creativity dial) — needs the Advisor to produce the DRAFT, then Davin's
  APPROVAL. Its own entry criteria lead with re-verifying Session 3-1's two blocking
  actions are actually done before CONFIRM — this session's refresh-token persistence
  needs a working DB connection, not just a deployed-but-degraded service. It also
  flags two things found while drafting: (1) the `RefreshToken` Prisma model is
  currently just a bare stub (`id`/`token`/`userId`/`expiresAt`, no revocation, stores
  the raw token) — not sufficient for "hashed, revocable" per the plan, needs real
  schema work before endpoint code; (2) whether `/auth/login` should issue the same
  NextAuth-JWE format `JwtAuthGuard` already verifies, or a new NestJS-native token
  format (the plan's Pattern 1 end-state implies the latter eventually) — flagged for
  Davin/Advisor, not decided.
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
  directly), proven via a real round-trip before the guard was built · F8–F16 OPEN
  (register: plan §11 · resolutions: `docs/migration-orders/DECISION-LOG.md`)

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
