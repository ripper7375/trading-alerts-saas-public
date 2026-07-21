# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.** You (Claude Code) are the **Executor** in the
> three-role Development Chain Protocol (Advisor = Claude Cowork plans, Davin authorizes,
> you execute). Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` —
> **read it at the start of every session before doing anything else.**
> The previous content of this file (Aider validation guide) moved to
> `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

---

## Current state _(update at the end of EVERY session)_

- **Current:** Session 3-2 CLOSED, executed end-to-end — 2026-07-21. Phase 3
  underway: F6/F7 (Session 3-1) and now F23/F24 (this session) all resolved.
  `operation-service` has `JwtAuthGuard` (verify) AND `/auth/{register,login,
refresh,logout,me}` (issue) — code-complete, tested, deployed to Railway
  production, but **not yet called by anything live** (bridge-first; NextAuth on
  Vercel is the only thing real users go through until Session 3-3). Phase 1 still
  formally NOT exit-clean (F18 the sole blocker, unchanged, dashboard-only). Phase 0
  still formally open (CC-A gap unchanged — now also concretely relevant to Session
  3-3's stated "done when," see below).
- **Current order:** `docs/migration-orders/3-2-token-endpoints.migration-order.md`
  (CONFIRMED and EXECUTED end-to-end — all entry criteria and "done when" items
  checked off).
- **Order status:** CLOSED, all-green. CONFIRM caught a real, live entry-criterion
  failure before any code was written (see below) — this was not a rubber-stamp
  CONFIRM. **What shipped:**
  - **CONFIRM found Session 3-1's two Davin-only blockers were still NOT done**,
    despite Davin's initial message saying to proceed: `/health` was still
    `degraded`/DB `down`, and `NEXTAUTH_SECRET` was absent from `operation-service`'s
    Railway variable names (checked names-only). Stopped, reported the exact
    evidence, asked how to proceed. Davin fixed both directly in the dashboard;
    re-verified independently (`/health` → `healthy`/`up`, `NEXTAUTH_SECRET` present)
    before marking CONFIRMED. Exactly the "do not start" path `EXECUTOR-PROTOCOL.md`
    §1 describes, not a formality.
  - **F23 (RefreshToken hardening) and F24 (JWE issuance format)** resolved by Davin
    live, `DECISION-LOG.md`. Execution found the `RefreshToken` table **never
    actually existed in production** (declared in `schema.prisma` since Session 2-2,
    but zero migration ever created it, confirmed via a live `pg_tables` query) — so
    F23's migration was a pure additive `CREATE TABLE`
    (`hashedToken`/`userId`/`userAgent`/`ipAddress`/`expiresAt`/`revokedAt`/
    `createdAt`, SHA-256 hashing not bcrypt — see the order's Deviations #8 for why),
    not a risky `ALTER` on live data. Applied to production with Davin's explicit
    live approval (the auto-mode classifier also independently blocked the first
    attempt — a production deploy, correctly gated per `EXECUTOR-PROTOCOL.md` §7).
  - Of the order's 6 candidate SOURCE files, only 2 were actually needed after
    tracing the real call path: `errors.ts` (full 371-line port, kept verbatim per
    `LESSONS-LEARNED.md` L4 rather than curated) and `auth-options.ts`'s
    `authorize()` logic (copied into `auth.service.ts` — bcrypt check,
    `EMAIL_NOT_VERIFIED`, the `TWO_FACTOR_REQUIRED`/`__2fa_verified__` two-step
    sentinel). `two-factor.ts`/`session-tracker.ts`/`permissions.ts`/`session.ts`
    all traced to being outside this session's actual call path (full reasoning per
    file in the order's Deviations #3) — a large, well-justified correction to the
    PRE-DRAFT's grep-based file inventory, not scope creep.
  - `app/api/auth/register/route.ts` treated as an implicit additional SOURCE (the
    order's file inventory only listed `lib/auth/*`, a gap in its own scope) —
    ported validation/duplicate-check/hash/`autoVerify` logic exactly. **Not
    ported: actual email sending** (`lib/email/email.ts`, Resend/Next.js-only,
    never in scope) — documented gap, must close before `/auth/register` is ever
    pointed at real traffic.
  - No lockout mechanism exists anywhere in the live codebase (grepped, zero
    matches) — the order's "lockout thresholds must match" invariant was a mistaken
    premise; nothing was invented to preserve it.
  - `operation-service/prisma/schema.prisma` now has a narrow-subset `User` (only
    fields the 5 endpoints touch, no relations) + the hardened `RefreshToken`,
    hand-copied from the root schema (same "byte-for-byte, no automated check"
    burden `MarketDataV6` already carries).
  - 32/32 unit tests green (5 suites), verified on a genuinely clean `npm ci` (L29)
    — not just a warm local build. `nest build` clean (caught one real error this
    way — `NestFactory.create(AppModule)`'s default type has no `.set()`; fixed by
    typing it `<NestExpressApplication>`). Root `npm run type-check` clean (L30, no
    tsconfig leakage).
  - Three commits: `ebfa525d` (F23 migration), `6b4f2659` (auth module), `92f64a4e`
    (docs).
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
  Session 2-4 + F22 — Davin confirmed live in production. **(15, RESOLVED Session
  3-2)** `NEXTAUTH_SECRET` grant to `operation-service` — Davin set it directly;
  independently re-verified (present in the Railway variable-name list). **(16,
  RESOLVED Session 3-2)** `DATABASE_URL` correction on `operation-service` — Davin
  fixed it directly; independently re-verified (`/health` → `healthy`/`database:
up`). **(17, NEW, blocking Session 3-3's stated "done when")** CC-A's dedicated
  staging stack still doesn't exist (Phase 0 gap, unchanged) — Session 3-1 worked
  around it by deploying additively into `production` (low-risk, nothing live called
  the new code). Session 3-3's playbook wording literally requires a "staging
  walkthrough," but that session is the one that starts routing REAL traffic
  (cookies, middleware) through the new path — materially higher-risk to test
  directly against production than 3-1 was. Flagged explicitly in 3-3's PRE-DRAFT
  for Davin/Advisor to resolve before DRAFTing ordered steps, not assumed either
  way. **(18, NEW, non-blocking until real traffic is pointed at `/auth/register`)**
  `operation-service`'s `/auth/register` does not send verification emails
  (`lib/email/email.ts`'s Resend integration was never ported, out of Session 3-2's
  scope) — must close before this endpoint is ever live.
- **Last session did:** Session 3-2 ("Token endpoints") — closed 2026-07-21,
  all-green, executed end-to-end (not a partial/blocked close like 3-1). CONFIRM
  caught a real entry-criterion failure first (see "Current" above), then F23's
  migration (RefreshToken never actually existed in production — pure `CREATE
TABLE`, Davin-approved) applied to production, then `operation-service` gained
  `/auth/{register,login,refresh,logout,me}` (32/32 tests, clean `npm ci` + build,
  clean root type-check). No new `LESSONS-LEARNED.md` entries this session — the one
  build error found (`NestExpressApplication` typing) cost minutes, not the
  > 30-minute bar; noted in the order's Deviations #11 instead.
- **Next session:** Session 3-3 ("Next.js side") per the playbook — **PRE-DRAFTed**
  at this close: `docs/migration-orders/3-3-nextjs-side.migration-order.md`
  (**UI-BUILD variant**, high creativity dial — per `00-SKELETON-AND-RULES.md` §2's
  table, 3-3 is explicitly a UI-BUILD example, NOT a PORT session like 3-1/3-2) —
  needs the Advisor to produce the DRAFT, then Davin's APPROVAL. Flags one blocker
  needing resolution before DRAFTing ordered steps: the playbook's literal "done
  when" requires a staging walkthrough, but Phase 0's CC-A gap is still open and this
  is the session that starts routing real traffic through the new path (see Waiting
  on #17) — higher-risk to route around the same way 3-1 did. Also flags a
  security-adjacent open question for Davin: whether the cookie-set route should
  reuse NextAuth's exact cookie name/settings (`__Secure-next-auth.session-token`,
  etc.) for compatibility, or introduce a new one.
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
  already verifies · F8–F16 OPEN (register: plan §11 · resolutions:
  `docs/migration-orders/DECISION-LOG.md`)

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
