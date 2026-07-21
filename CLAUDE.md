# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.** You (Claude Code) are the **Executor** in the
> three-role Development Chain Protocol (Advisor = Claude Cowork plans, Davin authorizes,
> you execute). Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` —
> **read it at the start of every session before doing anything else.**
> The previous content of this file (Aider validation guide) moved to
> `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

---

## Current state _(update at the end of EVERY session)_

- **Current:** Session 3-5 CLOSED, executed end-to-end — 2026-07-21. **Phase 3 is
  functionally done**: the hybrid-auth bridge is proven end-to-end via SSR path
  and browser path (SVC_TOKEN/service-to-service leg formally descoped, F31,
  Davin), refresh rotation, revocation, and expiry-rejection all proven, and
  every auth flag (F6, F7, F23–F30, F31–F33) is RESOLVED in the Decision Log.
  **One item keeps Phase 3 from being marked fully exit-clean:** F33's Vercel
  production regression check is Davin's own manual action, per his decision —
  not yet reported back as of this close (this session's own regression evidence
  is local-only, real-browser-verified, same Waiting-on #4 gap as always). Phase
  1 still formally NOT exit-clean (F18 the sole blocker, unchanged). Phase 0
  still formally open (CC-A gap unchanged, same local-testing workaround as
  before, `LESSONS-LEARNED.md` L31/L32/L33).
- **Current order:**
  `docs/migration-orders/3-5-three-path-verification.migration-order.md`
  (CONFIRMED and EXECUTED end-to-end — all entry criteria and "done when" items
  checked off, one item explicitly left unchecked and explained: the
  SVC_TOKEN leg, by design per F31).
- **Order status:** CLOSED, all-green. **What shipped (pure verification — zero
  code/schema/route/infra changes, matching the VERIFY-RETIRE variant):**
  - **SSR path proven** via real HTTP against live local servers (not mocked
    route handlers): `POST /api/auth/token-login` → `GET
/api/auth/token-2fa-status` (Next.js route handler forwarding the session
    cookie as `Authorization: Bearer` to operation-service's
    `JwtAuthGuard`-protected `/auth/2fa/status`) — 200 valid / 401 missing / 401
    garbage / 401 expired. Cross-checked directly against operation-service's
    own `/auth/me`, bypassing the Next.js proxy.
  - **Browser path proven via a real browser session — genuinely new this
    session** (every prior session only used curl/Node fetch for this bridge).
    The Claude Browser tool drove the live local dev server and ran `fetch()`
    from inside the real page: `document.cookie` after login showed only the
    HMR-refresh cookie (confirms the session/refresh cookies really are
    `httpOnly`, invisible to page JS — a property no Node script can observe),
    a same-origin `fetch()` with no manually-attached header succeeded purely
    because the real browser's own cookie jar auto-attached the httpOnly
    cookie, and 401'd correctly after logout. Also regression-spot-checked via
    the same real browser: `/login` 200, NextAuth's own `/api/auth/session` →
    `{}`, `/dashboard` → redirect — all unaffected, this time via a genuine
    browser rather than curl.
  - **Refresh + revocation + expiry all proven:** rotation issues a genuinely
    new access+refresh pair; the pre-rotation refresh token is rejected
    (401) if reused; a second rotation of the new token still works (chain
    integrity); logout revokes the refresh token, confirmed via a subsequent
    401'd refresh attempt. Expiry: since the live access token's actual TTL
    turned out to be 30 days (see finding below), a synthetically-minted
    expired token (same encode helper, `maxAgeSeconds: -60`) was rejected 401
    both directly against operation-service and via the Next.js SSR proxy.
  - **SVC_TOKEN leg: formally and deliberately not verified** (F31, Davin) — a
    repo-wide grep re-confirmed zero real implementation exists anywhere in the
    codebase, consistent with the descope.
  - **New finding, flagged not fixed (VERIFY-RETIRE scope — no auth-semantics
    changes made):** `AuthService.issueSession()`/`.refresh()` mint every
    access token via `encodeNextAuthToken(...)` with no `maxAgeSeconds`
    override, so it defaults to the full 30-day `SESSION_MAX_AGE_SECONDS` —
    not the plan's originally-intended "~15 min short-lived access token." An
    unstated side-effect of F24's "match NextAuth's cookie for compatibility"
    decision, never previously called out as a divergence. Flagged for
    Davin/the Advisor to decide on in a future session — not changed here.
  - **Local walkthrough followed the L31/L32/L33 recipe exactly, zero new
    incidents** — reused the SSL-enabled Postgres volume persisted from
    Session 3-3/3-4 (remapped to port 5433 via a scratch
    `docker-compose.override.yml`, deleted after), the `.env.local`
    rename-restore dance (checksum-verified identical before/after), and
    confirmed both dev servers' actual listening PIDs via `netstat`/`taskkill`
    before stopping the local Postgres/Redis containers (L11/L14). All scratch
    files (override YAML, operation-service `.env`, verification scripts)
    were deleted before close — nothing new committed.
  - **Full regression suite, zero drift:** root `npm run test:ci` — 117/117
    suites, 2082/2082 tests, exact parity with Session 3-4's baseline (this
    was pure verification — no new committed tests). `type-check`, `next
lint`, `npm run build` all clean. `operation-service`: 7/7 suites, 56/56
    tests; build clean.
- **Waiting on:** (1, non-blocking, unchanged) `deploy.yml` still fails on every push
  to `main` at the GitHub workflow-file level (0s runtime) — known NOT to block real
  Vercel deploys, just dead/broken CI hygiene, not urgent. (2, RESOLVED Session 2-3,
  unchanged) Production's Prisma migration history is baselined — F20 closed. (3,
  non-blocking, unchanged) F18's RPO gap — Railway automated-backup cadence still
  unverified via CLI (dashboard-only). (4, unchanged, carried over) Davin to grant
  Vercel dashboard/preview-branch access — still the reason "confirm production
  regression-free" claims in every 3-x session (now also 3-5's real-browser check)
  have only ever been checked via the local dev server, never the real deployed
  Vercel app. (5, unchanged, carried over) A human with delete permission to
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
  production --ci --json` from the repo root (L33). **(24, NEW, non-blocking,
  Davin's own action item)** F33's Vercel production regression check is still
  outstanding — Davin's explicit choice to do this manually and confirm back to
  Claude Code (DECISION-LOG.md); Phase 3's "NextAuth still functional on
  Vercel" exit criterion stays open until he reports back. **(25, NEW,
  non-blocking, Davin decision needed before Session 4A-1 can be APPROVED)**
  F15 (Redis topology for money-service) and F16 (public URL scheme + `/v1`
  versioning) both need Davin's decision — flagged in the 4A-1 PRE-DRAFT, a
  shared Railway Redis instance already exists and matches F15's plan-recommended
  default if Davin confirms reusing it.
- **Last session did:** Session 3-5 ("Three-path verification / Phase 3 exit") —
  closed 2026-07-21, all-green, executed end-to-end as a pure VERIFY-RETIRE
  session (zero code changes). Proved the SSR and browser auth-bridge paths
  end-to-end (SVC_TOKEN leg formally descoped per F31), proved refresh rotation/
  revocation/expiry-rejection, found and flagged (not fixed) that the live
  access token is actually 30 days not the plan's intended ~15 minutes,
  confirmed Davin's F32 Railway env-var fixes are live, and closed out every
  remaining Phase 3 flag in the Decision Log. Full regression suite green, zero
  drift from Session 3-4's baseline.
- **Next session:** Session 4A-1 ("money-service: skeleton + deploy") per the
  playbook — the start of Phase 4A. **PRE-DRAFTed** at this close:
  `docs/migration-orders/4a-1-money-service-skeleton-deploy.migration-order.md`
  — an INFRA-variant session (no VERIFY-RETIRE fast-path), needs the Advisor to
  produce the DRAFT, then Davin's APPROVAL. Flags for the Advisor: (a) F15/F16
  both need Davin's decision before APPROVAL — see Waiting-on #25; (b) the
  `money_svc`/`core_app` Postgres roles and PgBouncer already exist and are
  credentialed (Session 1-3/1-3b) — this is a head start, not a from-scratch
  step, re-verify rather than rebuild; (c) a shared Railway Redis instance
  already exists (used today by operation-service) and matches F15's own
  plan-recommended default; (d) `SVC_TOKEN` may finally need to be built for
  real in this session if core↔money internal calls are in scope — Session 3-5
  confirmed zero implementation exists anywhere yet.
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
  missing Railway env vars, confirmed live at CONFIRM · **F33 RESOLVED-as-decided
  (Session 3-5)** — Davin's own manual Vercel check, decision made but the check
  itself still outstanding (Waiting-on #24) ·
  F8–F16 OPEN (F15/F16 due next session, 4A-1 · register: plan §11 · resolutions:
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
