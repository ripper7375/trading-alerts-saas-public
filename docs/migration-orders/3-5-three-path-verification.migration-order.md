# Migration Order — Three-path verification (Phase 3 exit)

> **Status: CONFIRMED, EXECUTED** — F31/F32/F33 decisions resolved by Davin
> (DECISION-LOG.md); re-verified against live code + Railway runtime state
> 2026-07-21. Executed as a pure VERIFY-RETIRE session covering the SSR and
> browser legs only (SVC_TOKEN leg descoped per F31).
> **Session:** 3-5 · **Phase:** Phase 3 — Hybrid (Dual) JWT Authentication,
> plan step 3.5 · **Variant:** VERIFY-RETIRE
> **Flags touched:** F31 (SVC_TOKEN Verification), F32 (Missing Environment Variables), F33 (Vercel Production Check).
> **Playbook tasks:** "Automated e2e proving a protected endpoint works via (a) SSR,
> (b) browser, (c) service-to-service `SVC_TOKEN`; token expiry/refresh/revocation e2e;
> confirm NextAuth production regression-free. Check Phase 3 exit criteria." ·
> **Playbook done-when:** "all e2e green; Decision Log updated; dual-auth running."

## CONFIRM note (2026-07-21, before execution)

- **Codebase state:** `operation-service/src/auth/{jwt-auth.guard,auth.controller,
two-factor.controller,refresh-token.service,auth.service,next-auth-jwt.util,
next-auth-jwt-encode.util}.ts` all read directly, match Session 3-4's close
  description exactly, no unexpected changes. Repo-wide grep for `SVC_TOKEN` across
  every `.ts`/`.tsx` file: zero matches (planning docs only) — confirms the order's
  own flagged premise and F31's descope decision are consistent with reality.
- **Runtime state:** `railway variables --service operation-service --environment
  production --json` confirms both previously-missing vars are now set:
  `TWO_FACTOR_ENCRYPTION_KEY` (44 chars) and `NEXTAUTH_URL=
https://trading-alerts-saas-frontend.vercel.app`. Byte-for-byte match of
  `TWO_FACTOR_ENCRYPTION_KEY` against Vercel's own value can't be independently
  verified from this environment (Waiting-on #4, same Vercel-access gap as always) —
  trusting Davin's F32 action as reported.
- **Flag state:** F31/F32/F33 all read directly in `DECISION-LOG.md`, all RESOLVED,
  all "Approved by: Davin."
- **New finding, flagged not fixed (VERIFY-RETIRE scope — no auth-semantics changes
  this session):** `AuthService.issueSession()`/`.refresh()` both call
  `encodeNextAuthToken(...)` with no `maxAgeSeconds` argument, so every access token
  defaults to the full `SESSION_MAX_AGE_SECONDS` (30 days) — not the plan §5
  Architecture-decisions "~15 min access token" design. This is an unstated
  side-effect of F24's compatibility decision (matching NextAuth's own 30-day
  `session.maxAge` for "perfect compatibility"), never previously called out as a
  divergence from the plan's own short-lived-access-token intent. Since there is no
  naturally-occurring short expiry to observe in the live login path, this session's
  expiry proof uses a synthetically-minted expired token (same `encodeNextAuthToken`
  helper, negative `maxAgeSeconds`) to prove the guard's expiry check itself works,
  separately from what TTL production actually issues today. Flagging for Davin/the
  Advisor to decide whether a real short-lived access token is still wanted for a
  future session — not decided or changed here.
- Entry criteria: all 3 (F31/F32/F33) re-verified true. No FAILED criteria — clear to
  execute.

## Variant — flag for the Advisor, not settled here

The playbook's own next-session slot (session-playbook.md line 232) reads like a
VERIFY-RETIRE ("check exit criteria," "confirm regression-free") — but one leg of its
own task list may not actually be verifiable as-is: a repo-wide grep for `SVC_TOKEN`
(Session 3-4's own CONFIRM) found **zero implementation** — it only appears in planning
docs (`monolith-to-microservices-migration-session-playbook.md`,
`-implementation-plan.md`, `money-service-migration-blueprint.md`), never in any actual
`.ts` file. If the "service-to-service" e2e leg has no real `SVC_TOKEN` mechanism to
call, this session either (a) needs a small BUILD sub-step first (closer to
TEMPLATE-CONTRACT/INFRA, low-to-medium creativity) before it can verify anything on
that leg, or (b) that leg gets deferred/descoped with Davin's explicit sign-off and the
session stays pure VERIFY-RETIRE for the other two legs (SSR, browser). Recommend the
Advisor check money-service-migration-blueprint.md's own SVC_TOKEN section before
drafting, and pick (a) vs (b) explicitly rather than assuming either way.

## Known blocker, carried over unchanged from 3-3 and 3-4

No Vercel dashboard/CLI access exists in this environment (CLAUDE.md Waiting-on #4,
unchanged since Session 1-1). Both Session 3-3's and this session's own CONFIRM/CLOSE
"regression check unaffected in production" claims were verified via the **local** dev
server (`/login` 200, NextAuth's own `/api/auth/session` `{}`, `/dashboard` 307-redirect
for a logged-out request), never against the actual deployed Vercel app directly. If
Session 3-5's "confirm NextAuth production regression-free" done-when item means
literally checking production (not local), this same access gap blocks it identically —
flagging now rather than discovering it again at CONFIRM.

## Context carried over from Session 3-4's close

- operation-service now additionally exposes (all additive, all bridge-first, none
  wired into any live frontend form): `/auth/{forgot-password,reset-password,
verify-email,resend-verification}` and `/auth/2fa/{status,setup,verify-setup,verify,
backup-codes,disable}` — see `migration-stack-analysis.md`'s Session 3-4 entry for the
  full file list.
- A parallel `token-*` Next.js proxy route now exists for every one of the above (9
  files under `app/api/auth/token-*`), following the exact pattern Session 3-3
  established (`token-login`/`token-refresh`/`token-logout`).
- `operation-service/prisma/schema.prisma` (the hand-maintained, generate-only narrow
  mirror — NOT the migration source of truth, that's still
  `prisma/non-market-data/schema.prisma`) now also declares `User.resetToken` /
  `resetTokenExpiry` / `twoFactorSecret` / `twoFactorBackupCodes` /
  `twoFactorVerifiedAt`, plus a narrow `SecurityAlert` mirror. Any future session
  adding operation-service code that touches a field/model not yet in this file will
  hit the same silent-mismatch class of bug Session 3-4 found and fixed — check this
  file first, don't assume the full schema's fields are automatically available.
- **`NEXTAUTH_URL` and `TWO_FACTOR_ENCRYPTION_KEY` are still not set on Railway for
  operation-service** (Davin's explicit "deploy now, fix later" call, Session 3-4). The
  2FA `setup`/`verify-setup`/`disable` endpoints will 500 with a clear "not configured"
  error until `TWO_FACTOR_ENCRYPTION_KEY` is set to the exact same value Vercel's
  production env already uses (must byte-for-byte match — it's the same encrypted
  `twoFactorSecret` column). Any email this service sends embeds `http://localhost:3000`
  links until `NEXTAUTH_URL` is set to the real production domain. If Session 3-5's e2e
  needs either endpoint class working for real, these need to be set first — Davin,
  not the Executor (secrets/unknown domain, per `EXECUTOR-PROTOCOL.md` §7).
- `railway up`'s default archive scope is NOT limited to the subdirectory it's invoked
  from in this monorepo — any future operation-service deploy must use
  `railway up ./operation-service --path-as-root --service operation-service
--environment production --ci --json` from the repo root (`LESSONS-LEARNED.md` L33).

## Entry criteria (candidate — re-verify at CONFIRM)

- [x] F31: Davin's decision on descoping the SVC_TOKEN verification leg.
- [x] F32: Davin's confirmation on setting Railway environment variables before testing.
- [x] F33: Davin's decision on handling the Vercel production regression check.

## Done when

- [x] Protected endpoint returns 200 with a valid token, 401 otherwise, proven via
      SSR path (real HTTP against the live local servers).
- [x] Same proven via a real browser session (not a script) — genuinely new this
      session.
- [ ] Same proven via service-to-service `SVC_TOKEN` — **explicitly descoped**
      (F31, Davin), not a failure.
- [x] Token refresh (rotation) proven.
- [x] Token revocation proven.
- [x] Token expiry rejection proven (via a synthetically-minted expired token —
      see the CONFIRM note's flagged finding on the live access-token TTL).
- [x] All auth flags (F6, F7, F23–F30, F31–F33) resolved in `DECISION-LOG.md`.
- [ ] NextAuth confirmed regression-free **on production Vercel** — Davin's own
      manual check (F33), not yet reported back as of this session's close. Local
      regression checks (real browser this session) all pass.
- [x] Full regression suite green: root 117/117 suites/2082/2082 tests,
      type-check/lint/build clean; operation-service 7/7 suites/56/56 tests,
      build clean.

## Rollback

None needed — this was a pure read-only verification session. No code, schema,
routes, or infrastructure changed. All scratch artifacts (docker-compose override,
operation-service `.env`, verification scripts) were created outside git tracking
and deleted before session close; `.env.local` was moved aside and restored with a
verified matching sha256 checksum.

## Deviations

1. **SVC_TOKEN leg formally descoped, not built** (F31, Davin's live decision): this
   session proves the SSR and browser paths only. No `SVC_TOKEN` mechanism was
   designed or implemented — a repo-wide `.ts`/`.tsx` grep at CONFIRM re-confirmed
   zero real implementation exists anywhere, matching the order's own flag.

2. **Local stack setup followed the L31/L32/L33 recipe exactly, zero new incidents.**
   `docker-compose.dev.yml`'s Postgres container (persisted from Session 3-3/3-4,
   SSL already enabled on the volume) was reused via a scratch
   `docker-compose.override.yml` remapping it to host port 5433 (native
   `postgres.exe` still squats 5432, L32) — deleted after. `.env.local` moved to
   `.env.local.bak` and restored via the rename-restore dance (L31), checksum
   `435d4f9b...790408a1` (sha256) identical before and after. `operation-service`
   ran locally against the same Postgres (own scratch `.env`, deleted after,
   `NEXTAUTH_SECRET` set to the same dev-only value as the Next.js side — chosen
   deliberately over the real production secret, since both local processes are
   fully under this session's control and proving the mechanism doesn't require
   touching the real secret at all). Both dev servers' actual listening PIDs were
   confirmed via `netstat`/`taskkill` after stopping (L14 — the harness's own
   "stopped" confirmation is not sufficient), and the local Postgres/Redis
   containers were fully stopped before running the regression suite (L11 — a
   running local stack on the default ports can silently corrupt `test:ci`).

3. **SSR-path proof, real HTTP against the live local servers (not mocked route
   handlers):** login via `POST /api/auth/token-login` (real user
   `free-test@trading-alerts.test`) → `GET /api/auth/token-2fa-status` (Next.js
   server-side route handler forwarding the session cookie as `Authorization:
Bearer` to operation-service's `JwtAuthGuard`-protected `/auth/2fa/status`) → 200
   valid / 401 missing cookie / 401 garbage cookie. Cross-checked directly against
   operation-service's own `/auth/me` (bypassing the Next.js proxy entirely): 200
   with a valid Bearer token, 401 "Missing bearer token" with none. Scratch script,
   not committed (matches the F24/L22 precedent) — full transcript captured below.

4. **Browser-path proof, a real browser session (genuinely new — no prior session
   used an actual browser for this bridge, only curl/Node fetch):** the Claude
   Browser tool drove `http://localhost:3000` and ran `fetch()` calls from inside
   the real page context. `document.cookie` after login showed only the
   HMR-refresh cookie — confirms the session/refresh cookies really are `httpOnly`
   (invisible to page JS), a browser security property no Node script can observe.
   A same-origin `fetch('/api/auth/token-2fa-status')` with no manually-attached
   header succeeded (200) purely because the real browser's own cookie jar
   auto-attached the httpOnly cookie — the mechanism a Node script has to fake by
   hand. After `POST /api/auth/token-logout`, the same call 401'd. Also
   regression-spot-checked via the same real browser: `/login` 200, NextAuth's own
   `/api/auth/session` → `{}`, `/dashboard` → redirect (opaque, logged-out) —
   unaffected.

5. **Refresh + revocation + expiry, all proven:**
   - Refresh rotation: `POST /api/auth/token-refresh` issued a new access+refresh
     token pair, both provably different from the pre-refresh pair.
   - Old-token rejection after rotation: presenting the pre-rotation raw refresh
     token to operation-service's `/auth/refresh` directly → 401
     `INVALID_TOKEN`/"invalid or revoked" — rotation's revoke-old-on-issue
     behavior confirmed, not just assumed from reading `RefreshTokenService`.
   - Chain integrity: a second rotation of the newly-issued token still succeeded
     (200) — rotation doesn't break subsequent refreshes.
   - Revocation via logout: `POST /api/auth/token-logout` (200), then presenting
     that same now-revoked refresh token to `/auth/refresh` → 401 `INVALID_TOKEN`.
   - Expiry: since `AuthService.issueSession()`/`.refresh()` mint every access
     token with the full 30-day `SESSION_MAX_AGE_SECONDS` (see the CONFIRM note's
     flagged finding — no naturally-occurring short expiry exists in the live
     login path), a synthetic expired token was minted via the same
     `encodeNextAuthToken` helper with `maxAgeSeconds: -60` (expired 60s in the
     past) — rejected 401 "Invalid or expired token" both directly against
     operation-service's `/auth/me` and via the Next.js SSR proxy
     (`token-2fa-status`) with the expired value set as the cookie. Proves the
     `JwtAuthGuard`/`decodeNextAuthToken` expiry check itself works correctly,
     independent of what TTL production actually issues today.

6. **Full regression suite, zero drift:** root `npm run test:ci` — 117/117 suites,
   2082/2082 tests (exact parity with Session 3-4's baseline — this session added
   no new committed test files, being pure verification). Root `type-check`,
   `next lint`, and `npm run build` all clean. `operation-service`: `npm test` —
   7/7 suites, 56/56 tests; `npm run build` clean.

7. **F33 (Vercel production regression check) still outstanding from Davin's
   side** — Davin's own decision was to perform this manually and confirm back
   (DECISION-LOG.md); this session's own regression evidence (item 4 above) is
   local-only, same Vercel-access gap as every prior 3-x session
   (CLAUDE.md Waiting-on #4). Phase 3's "NextAuth still functional on Vercel"
   exit criterion is NOT marked closed by this session — it's marked closed once
   Davin reports back. See CLAUDE.md's Waiting-on for the carried-forward item.

## Next-session handoff

Phase 3 is done (pending Davin's F33 confirmation only — a reporting gap, not a
blocking one). Per the playbook, Phase 4A begins next:
`docs/migration-orders/4a-1-money-service-skeleton-deploy.migration-order.md`
(PRE-DRAFT, this close) — an INFRA-variant session (money-service NestJS
skeleton + Railway deploy + `money_svc`/PgBouncer wiring), **not** VERIFY-RETIRE,
so it needs the full chain: Advisor DRAFT → Davin APPROVED → Executor CONFIRMED
(no fast-path). Flags F15 (Redis topology) and F16 (URL scheme/versioning) need
Davin's decisions before that session can be APPROVED.
