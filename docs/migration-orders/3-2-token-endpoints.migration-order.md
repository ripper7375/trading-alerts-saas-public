# Migration Order — Token endpoints (`/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/logout`, `/auth/me`)

> `TEMPLATE-PORT.md` — this session moves existing `lib/auth/*` logic into new NestJS
> endpoints inside `operation-service`. Read `00-SKELETON-AND-RULES.md` §2 and §4 first.
> **Creativity dial: Low** (PORT default) — behavior preservation IS the deliverable
> (password rules, lockout thresholds, 2FA flow, error shapes must match what
> `lib/auth/*` already does); how the NestJS module/DTO/controller code is organized is
> this session's call.
> **Status: PRE-DRAFT** — raw facts and candidate steps only, gathered at Session 3-1's
> close. Needs the Advisor to produce the DRAFT, then Davin's APPROVAL, before any of
> this is CONFIRMed or executed.

**Session:** 3-2 · **Phase:** Phase 3 — Hybrid (Dual) JWT Authentication (Workstream 2),
plan step 3.2 · **Variant:** PORT · **Generated:** 2026-07-21 (PRE-DRAFT, at Session
3-1's close) · **Flags touched:** none identified yet (re-verify at DRAFT/CONFIRM — plan
§11's registry doesn't name one specific to token endpoints, but the `RefreshToken`
schema gap below may deserve one; Advisor's call) · **Estimated time:** unestimated
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
  (found in `auth-options.ts`'s `authorize()` — re-verify exact thresholds at
  CONFIRM/DRAFT, not read in full this session), same rejection behavior for
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

- [ ] Session 3-1's two Davin-only actions actually done (`NEXTAUTH_SECRET` granted,
      `DATABASE_URL` corrected on `operation-service`) — this session's refresh-token
      persistence needs a working DB connection, not just a deployed-but-degraded service.
- [ ] `/health-auth`'s real-token 200 case independently verified by Davin (Session
      3-1's last open item) — if still open, decide whether this session can proceed
      in parallel or should wait; the Advisor/Davin's call, not a unilateral one.
- [ ] `lib/auth/auth-options.ts`'s `authorize()` function re-read in full at CONFIRM
      (this PRE-DRAFT only grepped it) — exact lockout thresholds, error cases, and
      claim shape need to be confirmed against live code, not this document's summary.
- [ ] `RefreshToken` schema decision made BEFORE writing endpoint code (hashed storage +
      revocation fields) — this is new schema surface, not a port; get it right first,
      rather than assuming the existing minimal stub (`id`/`token`/`userId`/`expiresAt`,
      no revocation, unhashed) is production-ready as-is.
- [ ] Whether `/auth/login` issues a NextAuth-compatible JWE (reusing 3-1's exact
      derivation) or a new NestJS-native token format — flagged above, needs Davin's
      explicit call, not assumed either way (security/auth-semantics, Non-negotiable 5).

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

- [ ] Ported auth unit tests green (parity with `lib/auth/*`'s existing test coverage
      where it exists — re-verify what's actually tested today at CONFIRM).
- [ ] Refresh-token issuance, use, and revocation proven by test (not just
      implemented) — this is the playbook's literal exit bar.
- [ ] `/auth/me` returns the same claim shape `JwtAuthGuard` already attaches
      (`id`, `email`, `tier`, `role`, `isAffiliate`) for consistency with Session 3-1's
      guard.

## Rollback

New endpoints only, in an already-deployed, additive-only service — same low-blast-
radius posture as Session 3-1. If the `RefreshToken` schema needs a real migration,
that migration's own rollback (down-migration or manual revert) becomes part of this
session's actual Rollback section once DRAFTed — PRE-DRAFT flags this as needing one,
doesn't write it yet (no migration exists to roll back from).

## Deviations

_(filled during execution)_

## Known wrinkles / do-not-touch

- `lib/auth/auth-options.ts` and `app/api/auth/[...nextauth]/route.ts` — do not modify,
  per plan §3.2 (replaced only at final cutover).
- `lib/api/index.ts` — standing do-not-touch, unrelated to this session but repo-wide.

## Next-session handoff

_Per the playbook, Session 3-3 ("Next.js side") builds the cookie-set API route,
middleware guard on protected matchers, silent-refresh loop, and SSR fetch helpers that
actually start sending real traffic at these new endpoints — depends directly on this
session's token endpoints existing and being genuinely correct (not just deployed)._
