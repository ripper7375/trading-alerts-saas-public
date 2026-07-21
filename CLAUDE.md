# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.** You (Claude Code) are the **Executor** in the
> three-role Development Chain Protocol (Advisor = Claude Cowork plans, Davin authorizes,
> you execute). Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` —
> **read it at the start of every session before doing anything else.**
> The previous content of this file (Aider validation guide) moved to
> `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

---

## Current state _(update at the end of EVERY session)_

- **Current:** Session 3-3 CLOSED, executed end-to-end — 2026-07-21. Phase 3
  underway: F25/F26/F27 (this session) all resolved. The Next.js side of the token
  bridge now exists — cookie-set login (`app/api/auth/token-login`), silent-refresh
  (`token-refresh`), logout (`token-logout`), an SSR fetch helper
  (`lib/operation-service/client.ts`), and this repo's first-ever `middleware.ts`
  guarding `/dashboard`, `/alerts`, `/charts`, `/settings` — all additive, verified
  end-to-end via a local walkthrough, deployed to production, but **still bridge-
  first**: `components/auth/login-form.tsx`/`register-form.tsx` were deliberately
  NOT rewired, so NextAuth on Vercel remains the only thing real users go through
  until a dedicated cutover session. Phase 1 still formally NOT exit-clean (F18 the
  sole blocker, unchanged). Phase 0 still formally open (CC-A gap unchanged — but
  now has a proven, repeatable local-testing workaround, see `LESSONS-LEARNED.md`
  L31/L32).
- **Current order:** `docs/migration-orders/3-3-nextjs-side.migration-order.md`
  (CONFIRMED and EXECUTED end-to-end — all entry criteria and "done when" items
  checked off).
- **Order status:** CLOSED, all-green. **What shipped:**
  - **F26 correction found at CONFIRM:** the Decision Log's literal cookie-name
    string (`next-auth.session-token`) is `lib/auth/auth-options.ts`'s
    **non-production** value only — production actually uses
    `__Secure-next-auth.session-token`. Implemented against the live
    `NODE_ENV`-conditional (`lib/operation-service/cookies.ts`), not the shorthand —
    matches F26's own stated rationale (zero frontend changes) exactly, which only
    holds if the real per-environment name is used.
  - **`/admin` excluded from `middleware.ts`'s matcher**, found at build time: a
    SEPARATE, non-route-group tree (`app/admin/login`, `app/admin/affiliates`,
    `app/admin/settings`) shares the `/admin` URL prefix with
    `app/(dashboard)/admin/*` but has its own bespoke, logged-out-reachable login
    page. Matching `/admin/:path*` would have redirected logged-out admins away
    from their own login page before they could reach it — excluded rather than
    special-cased; `(dashboard)/admin/*` keeps its existing `getServerSession`
    guard either way.
  - **Refresh token never reaches client JS** — stricter than the order's literal
    "client-side... replace" wording (which assumed client-visible storage);
    rotated entirely server-side via an httpOnly cookie, with the client-side
    ~14-min loop firing blind and ignoring every outcome (a no-op for any session
    that only carries a NextAuth cookie).
  - **A real near-miss, found and contained:** `operation-service` isn't in
    `docker-compose.dev.yml`, so "test locally" (F25) required running it locally
    for the first time. Doing so surfaced `prisma.config.ts`'s `.env.local`
    `override: true` silently defeating inline shell env vars for ANY Prisma CLI
    command run from repo root — a `db push` meant for a local Postgres briefly
    targeted production (verified harmless afterward: `migrate status` showed zero
    drift, since the schema hadn't changed). New `LESSONS-LEARNED.md` L31 — a
    standing hazard for every future session pointing Prisma CLI at a
    non-production database. L32 covers the SSL-enablement + native-Postgres-port-
    conflict setup needed to run operation-service locally at all.
  - **Full local walkthrough, zero production writes:** login → both cookies set →
    `/dashboard` 200 (proves the cookie is accepted by BOTH `middleware.ts`'s
    `getToken()` and `(dashboard)/layout.tsx`'s existing `getServerSession()`) → SSR
    bearer-forward to operation-service's `/auth/me` 200 → silent-refresh rotates
    both cookies (old refresh token independently confirmed revoked) → logout
    clears both cookies + revokes the current refresh token → `/dashboard` 307
    again. Also confirmed unaffected: `/login` (200), NextAuth's own
    `/api/auth/session` (`{}`), and the separate `/admin/login` (200, not
    redirected).
  - 18 new unit tests (4 new suites: `token-login`/`token-refresh`/`token-logout`/
    `middleware`), full suite 115/115 suites green (2064/2064 tests, up from
    111/2046 — exact parity plus the new coverage). Root `npm run type-check`,
    `next lint --max-warnings 0`, and `npm run build` all clean (L27 — the build was
    actually run, not just type-check/jest).
- **Waiting on:** (1, non-blocking, unchanged) `deploy.yml` still fails on every push
  to `main` at the GitHub workflow-file level (0s runtime) — known NOT to block real
  Vercel deploys, just dead/broken CI hygiene, not urgent. (2, RESOLVED Session 2-3,
  unchanged) Production's Prisma migration history is baselined — F20 closed. (3,
  non-blocking, unchanged) F18's RPO gap — Railway automated-backup cadence still
  unverified via CLI (dashboard-only). (4, unchanged, carried over) Davin to grant
  Vercel dashboard/preview-branch access. (5, unchanged, carried over) A human with
  delete permission to remove 5 remote stale branches (`HTTP 403` on
  `git push --delete` from this environment's credential). (6, unchanged, carried
  over) `railway`'s `tcp-proxy`/`private-network` CLI commands still not verified —
  low priority. (11, unchanged, carried over as F21) The 24h Account-Deletion GDPR
  gap — requires Davin's product decision, scheduled for a future session. (12,
  unchanged, carried over) The two split schema files still share ONE migration
  history and ONE Postgres database — deliberate, Davin-approved (F20, L24). **(17,
  unchanged, non-blocking now)** CC-A's dedicated staging stack still doesn't exist
  (Phase 0 gap) — Session 3-3 proved a repeatable local-testing workaround exists
  (`LESSONS-LEARNED.md` L31/L32), so this is no longer blocking individual sessions'
  execution the way it threatened to; the underlying gap itself is still open and
  worth closing eventually. **(18, unchanged, non-blocking until real traffic is
  pointed at `/auth/register`)** `operation-service`'s `/auth/register` does not send
  verification emails (F27, deferred again this session — Davin's explicit call).
  **(19, NEW, non-blocking)** `docker-compose.dev.yml` doesn't include
  `operation-service` — every session needing it locally must set it up by hand
  (env vars, SSL cert) per L31/L32 until a future session adds it properly. **(20,
  NEW, non-blocking, environment-specific)** this dev machine has a native Windows
  `postgres.exe` service already bound to port 5432, shadowing Docker's own port
  mapping for `docker-compose.dev.yml`'s postgres container — not this migration's
  service to stop; future local-Postgres work on this machine needs a remapped host
  port (see L32).
- **Last session did:** Session 3-3 ("Next.js side") — closed 2026-07-21, all-green,
  executed end-to-end. CONFIRM found and corrected F26's cookie-name shorthand, then
  built the 5 candidate pieces (cookie-set login, middleware guard, silent-refresh,
  SSR fetch helper, logout) as additive parallel infrastructure, found and excluded
  a real `/admin`-matcher conflict, then proved the whole path end-to-end via a
  from-scratch local walkthrough (operation-service run locally for the first time,
  surfacing and working around two real environment footguns — now
  `LESSONS-LEARNED.md` L31/L32). 18 new tests, full suite + type-check + lint +
  build all green. Two new lessons recorded (both cost real time to diagnose and are
  standing hazards for future sessions, not one-off typos).
- **Next session:** Session 3-4 ("CORS + secondary flows") per the playbook —
  **PRE-DRAFTed** at this close:
  `docs/migration-orders/3-4-cors-secondary-flows.migration-order.md` — needs the
  Advisor to produce the DRAFT, then Davin's APPROVAL. Flags for the Advisor: (a)
  the playbook's "re-point 2FA/email-verification/password-reset flows" framing
  assumes NestJS endpoints for these already exist — they don't (only
  `/auth/{register,login,refresh,logout,me}` exist, Session 3-2), so this is
  actually closer to a PORT session (low creativity dial) than the playbook's INFRA-
  flavored wording suggests; (b) whether operation-service's CORS config
  (`ALLOWED_ORIGINS`) is even needed, given Session 3-3's server-only calling
  pattern introduced no browser-to-operation-service exposure; (c) the same
  staging-vs-local-testing question as 3-3, complicated by email-sending
  (`lib/email/email.ts`) being a new wrinkle local testing hasn't had to handle yet.
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
  call · F8–F16 OPEN (register: plan §11 · resolutions:
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
