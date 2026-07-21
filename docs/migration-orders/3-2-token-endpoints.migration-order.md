# Migration Order — Token endpoints (`/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/logout`, `/auth/me`)

> `TEMPLATE-PORT.md` — this session moves existing `lib/auth/*` logic into new NestJS
> endpoints inside `operation-service`. Read `00-SKELETON-AND-RULES.md` §2 and §4 first.
> **Creativity dial: Low** (PORT default) — behavior preservation IS the deliverable
> (password rules, lockout thresholds, 2FA flow, error shapes must match what
> `lib/auth/*` already does); how the NestJS module/DTO/controller code is organized is
> this session's call.
> **Status: CONFIRMED** — F23/F24 decisions resolved by Davin. CONFIRM re-verified 2026-07-21:
> both Session 3-1 Railway blockers (`NEXTAUTH_SECRET` grant, `DATABASE_URL` fix) confirmed
> live-fixed by Davin (`/health` → `healthy`/`up`, `NEXTAUTH_SECRET` present in Railway
> variable names); all 6 SOURCE file line counts match; `auth-options.ts` re-read in full;
> `RefreshToken` stub confirmed still bare (4 fields, no revocation). Executing.

**Session:** 3-2 · **Phase:** Phase 3 — Hybrid (Dual) JWT Authentication (Workstream 2),
plan step 3.2 · **Variant:** PORT · **Generated:** 2026-07-21 (DRAFT) · **Flags touched:** F23 (RefreshToken schema), F24 (Token Issuance format) · **Estimated time:** unestimated
(F12 open).
**Target service:** `operation-service` (already scaffolded, deployed, Session 3-1 —
`JwtAuthGuard` and the `PrismaModule`/health skeleton exist; this session adds the
token-issuing endpoints alongside them, same service, no new infra).
**Contract:** new — this session defines `operation-service`'s
`/auth/{login,register,refresh,logout,me}` request/response shapes. No existing
contract is being replaced; `app/api/auth/[...nextauth]/route.ts` and NextAuth on
Vercel keep running completely unchanged (bridge-first, dual-running, per F6 — these
new endpoints are additive and **not yet called by anything live**; Session 3-3 wires
the Next.js side to actually use them).

## Context carried over from Session 3-1's close

- **`operation-service` exists and is (mostly) live:** NestJS 11.1.28, `PrismaModule`
  (Prisma 7 + `adapter-pg`, currently **zero models** — see the schema gap below),
  Redis-backed `ThrottlerGuard`, `JwtAuthGuard` (decrypts NextAuth's JWE via `jose` +
  `@panva/hkdf`, no `next-auth` dependency — F7), health module (`/health`,
  `/health-auth`). Deployed to Railway (`trading-alerts`/`production` — no CC-A staging
  stack exists yet, still Phase 0 open). **As of Session 3-1's close, two Davin-only
  actions were still outstanding** (`NEXTAUTH_SECRET` grant, a `DATABASE_URL`
  correction) — **re-verify at CONFIRM whether they're done**; if not, this session's
  own DB-backed work (refresh-token persistence) is blocked on the same `DATABASE_URL`
  fix, not just 3-1's leftover items.
- **F6/F7 resolved** (bridge-first; `JwtAuthGuard` decrypts NextAuth's JWE directly).
  This session's new endpoints (`/auth/login` etc.) **issue** tokens — worth
  double-checking at CONFIRM whether they should issue the SAME NextAuth-JWE format
  (so the one `JwtAuthGuard` verifies everything) or a distinct NestJS-native token
  format now that NestJS is doing the issuing. The plan's Pattern 1 (§5, `JWT-BASED-
FOR-HYBRID-AUTHENTICATION-ARCHITECTURE.md`) describes the eventual end-state as NestJS
  issuing JWTs directly (not JWE) — this session may be the first place that tension
  becomes concrete. Flag it for Davin/Advisor rather than deciding unilaterally; it's
  security/auth-semantics territory (CLAUDE.md Non-negotiable 5).

## File Port Order — candidate inventory (line counts as of 2026-07-21, re-verify at DRAFT/CONFIRM)

SOURCE files, dependency order (leaf → orchestration), with a first-pass pure/adapt/new
call — **the Advisor and CONFIRM should treat this as a starting hypothesis, not settled**:

### File 1/6 — `lib/auth/errors.ts` (371 lines)

- **SOURCE:** `lib/auth/errors.ts` → **TARGET:** `operation-service/src/auth/errors.ts`
  (or a NestJS exception-filter equivalent)
- **Kind:** likely pure port — `AuthError` class hierarchy, framework-agnostic
  (confirmed via read: no NextAuth/Next.js imports at the top of the file).
- **Invariants:** error `code`/`statusCode`/message shapes must match exactly — anything
  consuming these error codes downstream (existing `app/api/auth/*` routes, future
  Next.js side in Session 3-3) depends on them.

### File 2/6 — `lib/auth/two-factor.ts` (189 lines)

- **SOURCE:** `lib/auth/two-factor.ts` → **TARGET:** `operation-service/src/auth/two-factor.ts`
- **Kind:** likely pure or near-pure port (TOTP logic is typically crypto/library-based,
  not framework-tied) — **re-verify imports at CONFIRM**, not confirmed this session.
- **Invariants:** TOTP window/backup-code generation and verification behavior must be
  byte-identical — this touches live users' existing enrolled 2FA secrets.

### File 3/6 — `lib/auth/session-tracker.ts` (423 lines)

- **SOURCE:** `lib/auth/session-tracker.ts` → **TARGET:**
  `operation-service/src/auth/session-tracker.ts` (or folded into the new
  `RefreshToken`/session persistence layer — Advisor's call, may not need a 1:1 file)
- **Kind:** port + adapt — Prisma-backed already (`import { prisma } from
'@/lib/db/prisma'`), needs repointing at `operation-service`'s own Prisma client/schema
  once that has models (see schema gap below).
- **Invariants:** device/browser/location tracking shape, session-revocation semantics.

### File 4/6 — `lib/auth/permissions.ts` (433 lines)

- **SOURCE:** `lib/auth/permissions.ts` → **TARGET:**
  `operation-service/src/auth/permissions.ts` (or a `RolesGuard`/decorator — plan §5
  names `RolesGuard` as a "later session's concern" at 3-1, but this may be where it
  actually needs to start existing, since `/auth/me` needs permission-shaped output)
- **Kind:** port + adapt — currently depends on `getSession()` from `lib/auth/session.ts`
  (Next.js-specific, `getServerSession`); NestJS version should read from
  `JwtAuthGuard`'s attached `request.user` instead. Not a mechanical port — the
  session-retrieval seam changes, the permission LOGIC on top of it should not.
- **Invariants:** which tier/role combinations grant which permissions — this is
  security-relevant, changing it needs explicit Davin sign-off if anything looks like
  it doesn't map cleanly (CLAUDE.md Non-negotiable 5).

### File 5/6 — `lib/auth/session.ts` (296 lines)

- **SOURCE:** `lib/auth/session.ts` → **TARGET:** likely **not** a 1:1 port — this file
  IS the Next.js/NextAuth `getServerSession()` wrapper layer; `operation-service` has no
  equivalent (it has `JwtAuthGuard` instead). **Kind: absorbed/replaced**, not ported —
  re-verify this call at DRAFT/CONFIRM rather than assuming; some of its non-NextAuth-
  specific helper logic may still be worth extracting.
- **Invariants:** N/A if absorbed — but confirm nothing here is silently load-bearing
  for a caller this session doesn't know about yet.

### File 6/6 — `lib/auth/auth-options.ts` (583 lines) — **credentials-provider logic only, NOT the file itself**

- **SOURCE:** `lib/auth/auth-options.ts` lines ~193-260+ (`CredentialsProvider`'s
  `authorize()`, `bcrypt.compare` password check, confirmed via grep this session) →
  **TARGET:** `operation-service/src/auth/login.service.ts` (or similar) — a NEW file,
  since the SOURCE file itself is explicitly **not touched** this phase.
- **Kind:** new glue, logic COPIED not moved — per plan §3.2, `auth-options.ts` is
  "replaced only at the final cutover, not in this phase." `operation-service`'s
  `/auth/login` reimplements the same bcrypt-based password check against the same
  `User` table; `auth-options.ts` keeps running unchanged on Vercel throughout
  (dual-running is the whole point, same as Session 3-1's guard).
- **Invariants:** password hashing scheme (bcrypt, same cost factor), lockout rules
  must match exactly, 2FA flows and semantics are strict invariants, same rejection behavior for
  wrong-password/locked-account/unverified-email cases.

## Known schema gap, found at Session 3-1's close — not yet acted on

`operation-service/prisma/schema.prisma` currently has **zero models** (Session 3-1
deliberately deferred this — the only Prisma need at 3-1 was a `SELECT 1` health probe).
This session is the first that actually needs typed Prisma queries, so it needs at
least:

- **`User`** (hand-copied from `prisma/non-market-data/schema.prisma`, generate-only —
  same "must byte-match by hand, no automated check" caveat `railway-gateway/prisma/
schema.prisma` already carries for `MarketDataV6`; decide at DRAFT/CONFIRM whether to
  copy the FULL model (with its `Account[]`/`Alert[]`/`Drawing[]`/etc. relations) or a
  narrower subset `operation-service` actually queries — Session 3-1's own Deviations
  section has this same open question, resolved there as "defer," now due).
- **`RefreshToken`** — **the current stub is not sufficient for this session's stated
  requirement.** Live schema today (`prisma/non-market-data/schema.prisma:1005-1010`):
  ```prisma
  model RefreshToken {
    id        String   @id @default(cuid())
    token     String   @unique
    userId    String
    expiresAt DateTime
  }
  ```
  The playbook's own "done when" for this session says "refresh + revocation proven by
  test" and the plan says "hashed, revocable" — the current stub has no `revoked`/
  `revokedAt` field and stores `token` directly (not hashed). This session likely needs
  a **migration** adding revocation support and switching to a hashed-token-at-rest
  pattern (never store the raw refresh token) — this is new schema work, not a pure
  port, and needs its own entry criterion / explicit step, not an assumption that the
  stub is ready to use as-is.

## Entry criteria (candidate — re-verify all at CONFIRM)

- [x] Session 3-1's two Davin-only actions actually done (`NEXTAUTH_SECRET` granted,
      `DATABASE_URL` corrected on `operation-service`) — FAILED at first CONFIRM check
      (`/health` degraded, `NEXTAUTH_SECRET` absent), reported to Davin, fixed live,
      re-verified independently before proceeding (see Deviations #1).
- [ ] `/health-auth`'s real-token 200 case independently verified by Davin (Session
      3-1's last open item) — still Davin's own open item; agreed to run in parallel
      rather than block this session, since operation-service's `/health` and
      `NEXTAUTH_SECRET` presence were independently re-verified another way.
- [x] `lib/auth/auth-options.ts`'s `authorize()` function re-read in full at CONFIRM —
      confirmed bcrypt check, `EMAIL_NOT_VERIFIED`/`TWO_FACTOR_REQUIRED` cases, exact
      claim shape; no lockout logic exists anywhere in the live codebase (Deviations #6).
- [x] F23: `RefreshToken` schema decision made BEFORE writing endpoint code (hashed storage +
      revocation fields) — this is new schema surface, not a port.
- [x] F24: Whether `/auth/login` issues a NextAuth-compatible JWE (reusing 3-1's exact
      derivation) or a new NestJS-native token format.

## Rules specific to this variant

- `lib/auth/auth-options.ts` is **not touched** this session (plan §3.2: replaced only
  at final cutover) — every "port" from it is a COPY of specific logic into new
  `operation-service` code, verified against the live source, not a file move.
- Changing a ported test's assertion requires a written justification in Deviations
  (00-SKELETON-AND-RULES.md §4 / TEMPLATE-PORT.md).
- This session ends with the new endpoints **existing and tested, not yet consumed by
  anything live** — Session 3-3 ("Next.js side") is what actually points real traffic
  at them. Whether that counts as "shadow-run started" in TEMPLATE-PORT.md's literal
  sense is unclear (the playbook's own "done when" for 3-2 is test-level: "ported auth
  unit tests green; refresh + revocation proven by test," not a live-traffic diff) —
  Advisor should reconcile the template's default shape against the playbook's actual
  wording rather than force-fitting one onto the other.

## Slice-level verification (done when) — per the playbook

- [x] Ported auth unit tests green — 32/32 tests, 5/5 suites
      (`auth.service.spec.ts`, `refresh-token.service.spec.ts`,
      `auth-error.filter.spec.ts`, `auth.controller.spec.ts`, plus the pre-existing
      `jwt-auth.guard.spec.ts`), verified on a genuinely clean `npm ci` (L29 check).
      `npm run build` (`nest build`) and the root repo's `npm run type-check` both
      clean (exit 0) — L30 check, no root tsconfig leakage.
- [x] Refresh-token issuance, use, and revocation proven by test — `refresh-token.
    service.spec.ts` covers issue (hash-not-raw stored), validate (accept/reject:
      missing, revoked, expired), revoke (idempotent), and rotate (validate+revoke+
      reissue, rejects without issuing on an invalid token).
- [x] `/auth/me` returns the same claim shape `JwtAuthGuard` already attaches
      (`id`, `email`, `tier`, `role`, `isAffiliate`) — `auth.controller.spec.ts`
      asserts the exact key set.

## Rollback

- **Code (endpoints):** new controller/service/DTOs only, in an already-deployed,
  additive-only service, not yet called by anything live — revert the commit(s) and
  redeploy; zero blast radius to any real traffic (same posture as Session 3-1).
- **Migration (`20260721000000_add_refresh_token_table`):** pure additive `CREATE TABLE`
  with zero prior data (confirmed the table never existed before this session — see
  Deviations #2). Rollback is `DROP TABLE "RefreshToken";` plus
  `prisma migrate resolve --rolled-back 20260721000000_add_refresh_token_table` — safe
  at any point up until real refresh tokens are actually issued to real users (Session
  3-3+), since nothing currently reads or depends on this table.

## Deviations

1. **CONFIRM found a genuine entry-criterion failure, not just a re-verification
   formality.** Live check (2026-07-21): `/health` returned `"database":"down"` (Prisma
   query failure) and `NEXTAUTH_SECRET` was absent entirely from `operation-service`'s
   Railway variable names (checked names-only, never values). Per `EXECUTOR-PROTOCOL.md`
   §1, this meant "do not start" — stopped and reported to Davin rather than proceeding.
   Davin fixed both directly in the Railway dashboard; re-verified independently
   afterward (`/health` → `healthy`/`up`, `NEXTAUTH_SECRET` present in the variable
   list) before marking the order CONFIRMED.

2. **The `RefreshToken` table never actually existed in production.** The order assumed
   the Session 2-2 stub (4 fields) existed live and needed an `ALTER TABLE`. A live
   `pg_tables` query found zero such table, and `grep RefreshToken prisma/migrations/`
   found no migration ever created it — the model was declared in `schema.prisma` since
   Session 2-2 but never migrated. This made F23 a pure additive `CREATE TABLE`
   (`prisma/migrations/20260721000000_add_refresh_token_table/`), not a data-risk
   `ALTER`. Applied to production after Davin's explicit live approval (a production
   deploy, escalated per `EXECUTOR-PROTOCOL.md` §7 — the auto-mode classifier also
   independently blocked the first attempt, consistent with that rule).

3. **Only 2 of the order's 6 candidate SOURCE files were actually needed** — traced each
   through the real call path rather than trusting the PRE-DRAFT's grep-based inventory
   (which explicitly flagged itself as "a starting hypothesis, not settled"):
   - `errors.ts` (File 1/6): ported in full (see #4 below).
   - `auth-options.ts`'s `authorize()` (File 6/6): the actual behavior needed — bcrypt
     check, `EMAIL_NOT_VERIFIED`, the `TWO_FACTOR_REQUIRED`/`__2fa_verified__` two-step
     sentinel mechanism (`generate2FAToken` + `jwt.verify`, both local to
     `auth-options.ts`, not `two-factor.ts`).
   - `two-factor.ts` (File 2/6): **not ported.** Read the full live 2FA flow: TOTP/
     backup-code verification happens in `app/api/user/2fa/verify/route.ts` — a
     separate, existing endpoint that stays on Vercel/Next.js, out of this session's
     scope. `auth-options.ts`'s `authorize()` never calls `verifyTOTP`/`verifyBackupCode`
     directly. Porting it here would be dead code for these 5 endpoints.
   - `session-tracker.ts` (File 3/6): **not ported.** `trackSession()` is called only
     from `app/api/user/sessions/route.ts` (grepped repo-wide) — never from the
     credentials-login path. Unrelated to this session's endpoints.
   - `permissions.ts` (File 4/6): **not ported.** The order's own "done when" for
     `/auth/me` only requires the claim shape `JwtAuthGuard` already attaches
     (`id`/`email`/`tier`/`role`/`isAffiliate`), not a permissions array — building a
     `RolesGuard` stays "a later session's concern" per the plan, as the order itself
     already flagged as possible.
   - `session.ts` (File 5/6): **not ported**, per the order's own prediction —
     `operation-service` already has its replacement (`JwtAuthGuard`); nothing here is
     load-bearing for a NestJS REST API.

4. **`errors.ts` ported in full (371 lines), not curated to only what's used this
   session.** Considered trimming to only the classes actually thrown (`AuthError`,
   `InvalidCredentialsError`, `EmailNotVerifiedError`, `AccountExistsError`,
   `InvalidTokenError`, `ExpiredTokenError`); rejected that in favor of a verbatim copy —
   a partial port that silently diverges from its source is the exact hazard
   `LESSONS-LEARNED.md` L4 warns about, and later sessions (tier/affiliate/admin guards)
   will need the rest of the hierarchy anyway. Added one new class,
   `TwoFactorRequiredError` (not in the original file — NextAuth's `authorize()`
   communicated this case via a colon-encoded raw `Error.message`, NextAuth-specific
   plumbing that doesn't apply to a plain REST API; modeled as an `AuthError` subclass
   instead so one exception filter handles every case).

5. **`app/api/auth/register/route.ts` treated as an implicit additional SOURCE file for
   `/auth/register`'s behavior.** The order's File Port Order section only enumerated
   `lib/auth/*` files, even though the order's own header names `/auth/register` as a
   target endpoint — a gap in the PRE-DRAFT's inventory. Ported the validation (zod
   schema regex, hand-copied into class-validator DTO decorators), duplicate-email check,
   bcrypt cost-10 hash, and `autoVerify` logic exactly. **Not ported: actual email
   sending** (`lib/email/email.ts`, a Resend/Next.js-only integration, never in this
   order's file inventory and out of scope to add). `operation-service`'s `/auth/register`
   creates the user and verification token identically but sends no email — a documented
   gap, not a silent skip. Acceptable because this endpoint is additive/not-yet-live this
   session (Session 3-3 wires it up) — but this gap must be closed (either scoped into
   Session 3-3 or a dedicated follow-up) before `/auth/register` is ever pointed at real
   traffic, since production parity requires the email to actually send.

6. **No lockout mechanism exists anywhere in the live codebase.** The order's File 6/6
   section lists "lockout thresholds must match exactly" as an invariant; grepped
   `lib/**` and `app/api/auth/**` for `lockout`/`failedAttempts`/`loginAttempts` — zero
   matches. This was a mistaken premise in the PRE-DRAFT, not a real behavior to
   preserve. No lockout logic was invented for `operation-service`'s `/auth/login`,
   matching current live behavior (none).

7. **`operation-service/prisma/schema.prisma`'s `User` model is a narrow subset, not the
   full model** (the order's own flagged open question). Only fields the 5 endpoints
   actually read/write: `id`, `email`, `name`, `password`, `image`, `emailVerified`,
   `tier`, `role`, `isActive`, `isAffiliate`, `verificationToken`, `twoFactorEnabled`,
   `createdAt`/`updatedAt`. No relations (`Account[]`/`Alert[]`/`Drawing[]`/etc.)
   declared — this service has no business logic for any of them yet, and the narrower
   surface means less to hand-sync (the same "byte-for-byte, no automated check" burden
   `railway-gateway/prisma/schema.prisma` already carries for `MarketDataV6`).

8. **Refresh-token hashing uses SHA-256, not bcrypt.** F23 says "hashed" without
   specifying the algorithm. Chose SHA-256 (`createHash`) over bcrypt deliberately: the
   value being hashed is already a high-entropy random secret (32 random bytes), not a
   low-entropy user password — bcrypt's per-hash salt would make unique-index lookup by
   hash impossible (O(n) comparison against every stored token instead of O(1)), and its
   slow-hashing property defends against a brute-force threat model that doesn't apply
   here. Standard practice for opaque bearer secrets.

9. **Refresh-token rotation (revoke-old-issue-new on every `/auth/refresh` call), not
   reuse.** Not a port — the old `RefreshToken` stub was never wired into any real flow
   (F4 census: "not yet wired to any auth flow"), so there was no prior "refresh"
   behavior to preserve. Rotation is standard practice for limiting a leaked token's
   blast radius to one use; within F23's "revocable" requirement, not a security
   downgrade from any existing behavior.

10. **Unit tests only this session, no live-DB integration test.** `docker-compose.dev.yml`
    was not running at session start (checked, per `LESSONS-LEARNED.md` L11) and wasn't
    started — all 29 tests (`refresh-token.service.spec.ts`, `auth.service.spec.ts`,
    plus the pre-existing `jwt-auth.guard.spec.ts`) mock `PrismaService` and use the real
    `bcryptjs`/`jsonwebtoken`/`jose` libraries (matching this repo's existing testing
    philosophy — `jwt-auth.guard.spec.ts` does the same — and avoiding
    `LESSONS-LEARNED.md` L1's "mocked-the-entire-boundary" trap for the crypto/token
    logic that actually matters). The F23 migration itself was verified directly against
    production (schema shape + indexes read back after `migrate deploy`), which is the
    real database these endpoints will eventually run against — there is no staging
    environment (Phase 0 gap, unchanged) to integration-test against instead.

11. **Added `app.set('trust proxy', 1)` to `main.ts`.** Small, directly-related fix, not
    scope creep: Railway sits in front of `operation-service` as a reverse proxy, so
    Express's `request.ip` would report the proxy's address rather than the real client's
    — this session is the first to actually read `request.ip` (the new
    `RefreshToken.ipAddress` field, F23). Audit-trail accuracy only, not a
    security-critical decision. `NestFactory.create(AppModule)`'s default return type
    (`INestApplication`) has no `.set()` — the clean `npm run build` (L29 check) caught
    this immediately (`TS2339`); fixed by typing the factory call
    `NestFactory.create<NestExpressApplication>(AppModule)` (`@nestjs/platform-express`).
    Cost minutes, not the >30-minute bar for a new `LESSONS-LEARNED.md` entry — noted here
    instead.

## Known wrinkles / do-not-touch

- `lib/auth/auth-options.ts` and `app/api/auth/[...nextauth]/route.ts` — do not modify,
  per plan §3.2 (replaced only at final cutover).
- `lib/api/index.ts` — standing do-not-touch, unrelated to this session but repo-wide.

## Next-session handoff

_Per the playbook, Session 3-3 ("Next.js side") builds the cookie-set API route,
middleware guard on protected matchers, silent-refresh loop, and SSR fetch helpers that
actually start sending real traffic at these new endpoints — depends directly on this
session's token endpoints existing and being genuinely correct (not just deployed)._
