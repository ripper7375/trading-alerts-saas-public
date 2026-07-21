# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.** You (Claude Code) are the **Executor** in the
> three-role Development Chain Protocol (Advisor = Claude Cowork plans, Davin authorizes,
> you execute). Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` —
> **read it at the start of every session before doing anything else.**
> The previous content of this file (Aider validation guide) moved to
> `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

---

## Current state _(update at the end of EVERY session)_

- **Current:** Session 3-4 CLOSED, executed end-to-end — 2026-07-21. Phase 3
  underway: F28/F29/F30 (this session) all resolved. operation-service now also
  exposes the 2FA lifecycle (`setup`/`verify-setup`/`verify`/`backup-codes`/
  `disable`) and the secondary email flows (`forgot-password`/`reset-password`/
  `verify-email`/`resend-verification`), ported from `lib/auth/two-factor.ts` and
  `lib/email/email.ts` (both ported in full). 9 new parallel Next.js `token-*` proxy
  routes call them, following Session 3-3's established pattern exactly — all
  additive, all verified via a real local walkthrough (real Resend delivery to the
  account owner's own inbox, not simulated), deployed to production. **Still
  bridge-first**: none of the live frontend forms/pages call any of this session's
  new routes yet — same posture as every 3-x session so far. Phase 1 still formally
  NOT exit-clean (F18 the sole blocker, unchanged). Phase 0 still formally open
  (CC-A gap unchanged, same local-testing workaround as before, `LESSONS-LEARNED.md`
  L31/L32).
- **Current order:** `docs/migration-orders/3-4-cors-secondary-flows.migration-order.md`
  (CONFIRMED and EXECUTED end-to-end — all entry criteria and "done when" items
  checked off).
- **Order status:** CLOSED, all-green. **What shipped:**
  - **Real schema gap found and fixed:** `operation-service/prisma/schema.prisma`
    (the hand-maintained, generate-only narrow mirror of
    `prisma/non-market-data/schema.prisma` — NOT the migration source of truth)
    was missing `resetToken`/`resetTokenExpiry`/`twoFactorSecret`/
    `twoFactorBackupCodes`/`twoFactorVerifiedAt` on `User`, and had no
    `SecurityAlert` model at all — would have been a hard compile/runtime failure
    the moment this session's code touched those fields. Extended it (narrow
    subset, same convention as the existing `User`/`RefreshToken` mirror),
    including `SecurityAlert`'s load-bearing `@@map("security_alerts")`.
  - **`lib/email/email.ts` and `lib/auth/two-factor.ts` both ported in full**
    (not curated subsets) into `operation-service/src/email/email.util.ts` and
    `.../two-factor/two-factor.util.ts` — matches F29's "self-contained" rationale
    and the same full-port discipline `errors.ts` used in Session 3-2.
    `lib/security/device-detection.ts` ported as a narrow 2-function subset
    (`getGeoLocation`/`formatLocation` only — the rest is a different, out-of-
    scope feature).
  - **2FA endpoint errors use plain NestJS built-in exceptions**, not the ported
    `AuthError` hierarchy — the 5 source Next.js 2FA routes never had a shared
    error-code taxonomy either, so there was no existing contract to preserve.
    The 4 email-flow endpoints DO reuse `AuthError`/`InvalidTokenError`/
    `ExpiredTokenError`/`RateLimitError` (extended to carry `retryAfter` in its
    JSON body, in the filter only — `errors.ts` itself untouched).
  - **F30 (CORS) confirmed a genuine non-step** — `main.ts` untouched, every new
    route calls operation-service server-side only, same as Session 3-3.
  - **New deploy-infrastructure finding, cost real time (~30+ min, 4 attempts):**
    `railway up` invoked from inside `operation-service/` uploaded an identical
    ~433MB archive regardless of `.gitignore`, a new `.railwayignore`, or
    physically deleting local `node_modules`/`dist` — the upload was never scoped
    to that directory in the first place (almost certainly the whole monorepo).
    Fixed with `railway up ./operation-service --path-as-root --service
operation-service --environment production --ci --json` from the repo root.
    New `LESSONS-LEARNED.md` L33.
  - **Production env-var gap, Davin's explicit "deploy now, fix later" call:**
    `RESEND_API_KEY` set on Railway (known value, same shared account already
    used locally). `NEXTAUTH_URL` and `TWO_FACTOR_ENCRYPTION_KEY` still NOT set —
    asked Davin directly rather than guessing; safe to defer since nothing routes
    real traffic through these new endpoints yet (see Waiting-on #21/#22 below).
  - **Full local walkthrough, zero production writes:** register → verify-email
    (real welcome email delivered) → forgot-password → reset-password → login →
    full 2FA lifecycle (setup → verify-setup with a real TOTP code → re-login
    gated by `twoFactorRequired` → `/auth/2fa/verify` with the temp token →
    sentinel-completed login → backup-codes status → disable), both 2FA
    security-alert emails delivered for real. Verified through the real Next.js
    dev server too (not just operation-service directly): `token-login` sets
    cookies, `token-2fa-status` forwards the cookie as a Bearer token correctly,
    an absent cookie 401s. Regression-checked unaffected: `/login` (200),
    NextAuth's own `/api/auth/session` (`{}`), `/dashboard` 307-redirect.
  - 18 new tests (2 new suites: `token-email-flows`/`token-2fa-flows` on the
    Next.js side; 2 more on operation-service's own side), full suite 117/117
    suites green (2082/2082 tests, up from 115/2064 — exact parity plus new
    coverage). Root `npm run type-check`, `next lint --max-warnings 0`, and
    `npm run build` all clean.
  - **Post-deploy local-only hiccup, resolved, new lesson recorded:** restoring
    `operation-service/node_modules` locally after the deploy hit 3 different-
    looking failures in a row, all from the same root cause — Git Bash's
    `rm -rf` silently leaving partial directories behind on this Windows
    machine, corrupting the next `npm ci`. Fixed (killed the actual lingering
    process via `tasklist`, not just the harness's stop confirmation, then
    `npm rebuild`); re-confirmed via a genuinely clean `npm test`
    (7/7, 56/56) and `npm run build`. **Never affected production** — deployed
    and independently verified healthy throughout. New `LESSONS-LEARNED.md` L34.
- **Waiting on:** (1, non-blocking, unchanged) `deploy.yml` still fails on every push
  to `main` at the GitHub workflow-file level (0s runtime) — known NOT to block real
  Vercel deploys, just dead/broken CI hygiene, not urgent. (2, RESOLVED Session 2-3,
  unchanged) Production's Prisma migration history is baselined — F20 closed. (3,
  non-blocking, unchanged) F18's RPO gap — Railway automated-backup cadence still
  unverified via CLI (dashboard-only). (4, unchanged, carried over) Davin to grant
  Vercel dashboard/preview-branch access — still the reason "confirm production
  regression-free" claims in every 3-x session have only ever been checked via the
  local dev server, never the real deployed Vercel app. (5, unchanged, carried over)
  A human with delete permission to remove 5 remote stale branches (`HTTP 403` on
  `git push --delete` from this environment's credential). (6, unchanged, carried
  over) `railway`'s `tcp-proxy`/`private-network` CLI commands still not verified —
  low priority. (11, unchanged, carried over as F21) The 24h Account-Deletion GDPR
  gap — requires Davin's product decision, scheduled for a future session. (12,
  unchanged, carried over) The two split schema files still share ONE migration
  history and ONE Postgres database — deliberate, Davin-approved (F20, L24). (17,
  unchanged, non-blocking) CC-A's dedicated staging stack still doesn't exist
  (Phase 0 gap) — repeatable local-testing workaround exists (L31/L32/L33), so not
  blocking individual sessions; the underlying gap is still open. (18, unchanged,
  non-blocking until real traffic is pointed at `/auth/register`)
  `operation-service`'s `/auth/register` does not send verification emails (F27,
  still deferred, unchanged). (19, unchanged, non-blocking) `docker-compose.dev.yml`
  doesn't include `operation-service` — every session needing it locally must set it
  up by hand per L31/L32. (20, unchanged, non-blocking, environment-specific) this
  dev machine's native `postgres.exe` still shadows Docker's 5432 mapping — needs a
  remapped host port for local Postgres work (L32). **(21, NEW, non-blocking until a
  real user hits these paths)** `operation-service`'s `TWO_FACTOR_ENCRYPTION_KEY` is
  not set on Railway — the new 2FA `setup`/`verify-setup`/`disable` endpoints 500
  with a clear "not configured" error until it's set to the EXACT SAME value
  Vercel's production env already uses (must byte-for-byte match — same encrypted
  `twoFactorSecret` column both sides read/write). Davin's call to defer, Session
  3-4. **(22, NEW, non-blocking until this service sends a real production email)**
  `operation-service`'s `NEXTAUTH_URL` is not set on Railway — any email it sends
  embeds `http://localhost:3000` links until set to the real production domain.
  Davin's call to defer, Session 3-4. **(23, NEW, low priority)** any future
  operation-service Railway deploy must use `railway up ./operation-service
--path-as-root --service operation-service --environment production --ci --json`
  from the repo root — `railway up` invoked from inside the subdirectory silently
  uploads far more than that directory regardless of `.gitignore`/`.railwayignore`
  (L33).
- **Last session did:** Session 3-4 ("CORS + secondary flows") — closed 2026-07-21,
  all-green, executed end-to-end. Ported the full 2FA lifecycle and the 4 secondary
  email flows into operation-service (both `lib/email/email.ts` and
  `lib/auth/two-factor.ts` in full), found and fixed a real gap in
  operation-service's own hand-maintained Prisma schema mirror, wired 9 new parallel
  Next.js proxy routes, proved the whole thing end-to-end via a local walkthrough
  with genuine Resend email delivery (not simulated), deployed to production after
  working through a genuinely new `railway up` archive-scope footgun (L33), and
  asked Davin directly about 2 missing production secrets rather than guessing
  either value (he chose to defer both). 18 new tests, full suite + type-check +
  lint + build all green.
- **Next session:** Session 3-5 ("Three-path verification / Phase 3 exit") per the
  playbook — **PRE-DRAFTed** at this close:
  `docs/migration-orders/3-5-three-path-verification.migration-order.md` — needs the
  Advisor to produce the DRAFT, then Davin's APPROVAL. Flags for the Advisor: (a) a
  repo-wide grep found `SVC_TOKEN` (the playbook's "service-to-service" e2e leg)
  only in planning docs, never actually implemented in any `.ts` file — this session
  may need a small BUILD sub-step before it can verify anything on that leg, or that
  leg needs explicit descoping with Davin's sign-off; (b) the "confirm NextAuth
  production regression-free" done-when item hits the same Vercel-access gap
  (Waiting-on #4) every prior 3-x session has hit — only ever checkable locally in
  this environment unless that access gap closes first; (c) if the e2e needs the 2FA
  or email-flow endpoints working for real, Waiting-on #21/#22's missing secrets
  need to be set first.
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
  F8–F16 OPEN (register: plan §11 · resolutions:
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
