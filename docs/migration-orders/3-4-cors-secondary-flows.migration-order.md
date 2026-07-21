# Migration Order — CORS + secondary flows (2FA, email verification, password reset)

> **Status: CLOSED** — CONFIRMed and executed end-to-end, 2026-07-21. F28/F29/F30
> resolved by Davin; all 4 candidate steps done; deployed to production. See Deviations
> for the 2 unplanned findings (operation-service's narrow Prisma schema gap; `railway
up`'s archive-scope deploy footgun).
> **Session:** 3-4 · **Phase:** Phase 3 — Hybrid (Dual) JWT Authentication (Workstream
> 2), plan step 3.4 · **Variant:** PORT
> **Flags touched:** F28 (Staging for Email Flows), F29 (Email Logic Porting), F30 (CORS Necessity).
> **Playbook tasks:** "NestJS CORS (Vercel origins + localhost,
> credentials). Re-point 2FA, email verification, and password reset flows to NestJS
> endpoints in the staging build." · **Playbook done-when:** "all three flows pass
> manual + automated tests on staging."

## Variant — flag for the Advisor, not settled here

Playbook wording mixes two different kinds of work: CORS config (INFRA-flavored) and
"re-point... flows" (sounds PORT, low creativity). But per the finding below, this
isn't a re-point of EXISTING NestJS endpoints — operation-service has no 2FA/
email-verification/password-reset endpoints at all yet (only
`/auth/{register,login,refresh,logout,me}` exist, Session 3-2). This session likely
needs to PORT `lib/auth/two-factor.ts` (deferred out of Session 3-2's scope, see that
order's Deviations #3) and the forgot-password/reset-password/verify-email route
handlers' logic into new operation-service endpoints FIRST, then wire the Next.js
side to call them — closer to `TEMPLATE-PORT.md`'s low-creativity dial (behavior
preservation) than the playbook's framing suggests. The CORS piece
(`operation-service/src/main.ts`'s `ALLOWED_ORIGINS`) is real but small by
comparison — worth checking whether it's even needed given Session 3-3's routes call
operation-service server-side only (no browser-to-operation-service CORS exposure
introduced so far; see `lib/operation-service/client.ts`'s own comment).

## Known blocker, carried over unresolved — same shape as 3-3's

The playbook's literal "done when" says "staging," and Phase 0's CC-A gap (dedicated
staging stack) is still open. Session 3-3 navigated this via F25 (test locally against
`docker-compose.dev.yml` + a locally-run `operation-service`, deploy directly to
production) — and Session 3-3's own execution found and worked around two real
frictions in that recipe (`LESSONS-LEARNED.md` L31/L32: `prisma.config.ts`'s
`.env.local` override silently defeating local-DB env-var overrides, and needing SSL
enabled on the local Postgres to satisfy the codebase's Railway-shaped adapter
config). The recipe is now proven and repeatable, not a fresh unknown — but the
underlying CC-A gap itself is unchanged, and this session's flows (password reset,
email verification) send real emails via `lib/email/email.ts` — a channel local
testing can't fully exercise without also standing up email-sending verification
(Resend has a sandbox/test mode; not yet checked whether this repo's integration
supports it). Flagging for the Advisor/Davin rather than assuming either way.

## Context carried over from Session 3-3's close

- `operation-service`'s `/auth/{register,login,refresh,logout,me}` are additive-only,
  code-complete, **not yet called by anything live** — Session 3-3 built the Next.js
  side (`app/api/auth/token-{login,refresh,logout}`, `middleware.ts`, a silent-refresh
  loop) as a parallel path, verified end-to-end locally, but deliberately did NOT
  rewire `components/auth/login-form.tsx`/`register-form.tsx` (still call
  `next-auth/react`'s `signIn()`). NextAuth remains the only thing real users go
  through — the actual cutover is a dedicated future session, not this one either.
- `middleware.ts` (this repo's first-ever) now gates `/dashboard`, `/alerts`,
  `/charts`, `/settings` — deliberately excludes `/admin` (a separate,
  non-route-group tree with its own bespoke login page, found at Session 3-3's
  build time; see that order's Deviations #2). Any session touching admin routes
  should re-check this before assuming middleware coverage.
- `lib/operation-service/client.ts` + `cookies.ts` are the established pattern for
  any future Next.js↔operation-service wiring — reuse rather than re-invent.
- **F27 still open, not this session's job unless explicitly pulled forward:**
  `/auth/register`'s missing verification-email send (`lib/email/email.ts`'s Resend
  integration never ported). Worth noting since THIS session's own scope (email
  verification flow) sits right next to that gap — same underlying
  `lib/email/email.ts` dependency either way.

## Candidate steps (starting hypothesis, not settled)

1. Check whether operation-service actually needs `ALLOWED_ORIGINS` CORS changes at
   all, given Session 3-3's server-only calling pattern — if nothing calls it from a
   browser context, this may be a non-step.
2. Port `lib/auth/two-factor.ts` (setup/verify/backup-codes/disable — deferred out of
   Session 3-2, see that order's Deviations #3 for why it wasn't needed then) into new
   operation-service endpoints.
3. Port forgot-password/reset-password/verify-email/resend-verification logic
   (`app/api/auth/{forgot-password,reset-password,verify-email,resend-verification}/
route.ts`) into new operation-service endpoints — these all depend on
   `lib/email/email.ts` for actually sending mail; check whether that's ported,
   stubbed, or still Next.js-side-only (calling back into the monolith would be an
   unusual cross-service dependency, worth flagging if the Advisor's research finds it
   necessary).
4. Wire the Next.js side (new routes under `app/api/auth/token-*` or similar) to call
   the new endpoints, following Session 3-3's established pattern.

## Entry criteria (candidate — re-verify at CONFIRM)

- [x] Session 3-3's endpoints/middleware still healthy in production (`/health` up,
      confirmed 200 `healthy` at CONFIRM; `/dashboard` regression re-checked at CLOSE
      via the local dev server instead of production directly — no Vercel
      dashboard/CLI access exists in this environment, CLAUDE.md Waiting-on #4,
      unchanged — `/login` 200, NextAuth's `/api/auth/session` `{}`, `/dashboard`
      307-redirects a logged-out request, all as expected).
- [x] F28: Davin's decision on the staging-vs-local-testing question for email flows.
- [x] F29: Davin's decision on porting the email logic into `operation-service`.
- [x] F30: Decide the CORS question (skip if unnecessary due to proxying).

## Rollback

Not yet scoped — depends on which of the candidate steps the DRAFT actually picks.
New operation-service endpoints are additive (same low-blast-radius posture as
Session 3-2); re-pointing the Next.js side's actual call sites (if this session goes
that far) needs a real rollback plan, same discipline `middleware.ts` already
required in Session 3-3.

## Deviations

**Status: CLOSED, all-green.** Executed all 4 candidate steps as scoped, plus one
unplanned deploy-infrastructure fix and one unplanned schema-completeness fix (both
described below, both in-bounds).

1. **F30 (CORS) confirmed a non-step.** `operation-service/src/main.ts`'s
   `ALLOWED_ORIGINS`/`app.enableCors()` was left completely unchanged — every new
   Next.js route this session calls operation-service server-side only (same pattern
   Session 3-3 established for token-login/refresh/logout), so no browser-to-
   operation-service exposure exists to configure CORS for.

2. **2FA scope interpreted as all 5 real endpoints, not a narrower "verify" reading.**
   The order's candidate step 2 text ("setup/verify/backup-codes/disable") maps to 5
   actual Next.js routes (`setup`, `verify-setup`, `verify`, `backup-codes`, `disable`) —
   ported all 5 into a new `TwoFactorController`/`TwoFactorService`, since
   `lib/auth/two-factor.ts`'s real behavior surface is exactly those 5, and a narrower
   reading would have left `verify-setup` (the actual 2FA-enable flow) unported.

3. **`lib/email/email.ts` ported in full, not just the 4 templates this session's
   flows call.** F29's decision text ("keeps the service self-contained") was read as
   authorizing the whole file, matching how `errors.ts` was ported wholesale in Session
   3-2 (L4's logic: a curated subset that silently drops behavior is the real hazard,
   not the extra code). Unused templates (alert-triggered, subscription-confirmation,
   trial-reminder, upgrade-prompt, new-device-login, password-changed) are dead code in
   this service until a future session's flows call them.

4. **`lib/security/device-detection.ts` ported as a narrow 2-function subset**
   (`getGeoLocation`/`formatLocation` only, as `security/geo-location.util.ts`), not the
   whole file — unlike email.ts, the 2FA enable/disable emails only ever need
   `ipAddress` + a formatted location string, never device/browser/OS. The rest of that
   file (device fingerprinting, new-device-login alerts, login-history recording)
   belongs to the login flow's separate new-device-alert feature, out of this session's
   "2FA, email verification, password reset" scope — porting it would have been scope
   creep (CLAUDE.md non-negotiable #4).

5. **Real gap found and fixed: `operation-service/prisma/schema.prisma` (the
   hand-maintained, generate-only narrow mirror — see its own header comment) was
   missing `resetToken`/`resetTokenExpiry`/`twoFactorSecret`/`twoFactorBackupCodes`/
   `twoFactorVerifiedAt` on `User`, and had no `SecurityAlert` model at all.** This
   would have been a hard compile/runtime failure the moment any of this session's new
   code touched those fields — not discovered until `npx prisma generate` (called
   during a routine `npm install`) silently succeeded against the STALE narrow schema,
   and only surfaced once `npm run build`/tests actually exercised the new field
   references. Fixed by extending the schema (narrow subset, mirroring only the fields
   this session's code actually reads/writes — same convention the existing `User`/
   `RefreshToken` mirror already uses), including `SecurityAlert`'s `@@map
("security_alerts")` (load-bearing — the real table isn't PascalCase-named). Not
   scope creep: this file existing at all is Session 3-2's established pattern for
   keeping operation-service's typed client independent of the monolith's full schema,
   and every session that adds a new field/model reference must pay down this same
   "must be mirrored here by hand" maintenance cost the file's own comment already
   documents.

6. **2FA endpoint errors use plain NestJS built-in exceptions
   (`BadRequestException`/`UnauthorizedException`/`NotFoundException`/
   `InternalServerErrorException`), not the ported `AuthError` hierarchy.** The 5
   source Next.js 2FA routes never had a shared error-code taxonomy either — each just
   returns an ad-hoc `{ error: string }` with its own status code — so there was no
   existing code-based contract to preserve, and inventing 8+ new `AuthError` subclasses
   for conditions the source never modeled as classes would have been speculative
   architecture, not a port. The 4 email-flow endpoints DO reuse the existing `AuthError`
   hierarchy (`InvalidTokenError`/`ExpiredTokenError`/`RateLimitError`), since those
   already existed and fit exactly.

7. **`RateLimitError`'s JSON body extended to carry `retryAfter`** (`auth-error.filter.ts`,
   not `errors.ts` itself — the `errors.ts` "ported verbatim" comment's promise is
   unaffected). The source routes for `verify-email` (5s Gmail-preview guard) and
   `resend-verification` (60s per-user limit) always included `retryAfter` in their 429
   body; without this, that field would have silently disappeared for the two new
   endpoints that need it.

8. **New Next.js proxy routes forward operation-service's raw `{error, message}` shape
   as-is** (plus `retryAfter` when present), rather than translating it back into each
   source route's own historical response shape. This matches Session 3-3's own
   established precedent exactly (`token-login`/`token-refresh`/`token-logout` do the
   same) — these are new, additive endpoints with their own contract, not yet a literal
   replacement for the routes they parallel, so there is no existing frontend consumer
   whose exact response-shape expectations must be preserved today.

9. **No CSRF check on any of the 5 new `token-2fa-*` proxy routes or
   `token-verify-email`** — matches the source routes exactly: none of
   `app/api/user/2fa/{setup,verify-setup,verify,backup-codes,disable}/route.ts` or
   `app/api/auth/verify-email/route.ts` call `validateOrigin()` either (only the 3
   POST email-flow routes — forgot-password, reset-password, resend-verification — do,
   and their proxies match that too). Preserved as-is, not "fixed" — an existing
   asymmetry in the source, out of this session's scope to correct.

10. **Local testing (F28) used the real Resend API key from `.env.local`** (never
    printed) and a real recipient — `ripper7375@gmail.com` (the account owner, the only
    address Resend's sandbox mode accepts without a verified domain) — rather than a
    synthetic `*.test` address, specifically to prove genuine end-to-end delivery, not
    just that the Resend API was reached. Confirmed both cases: a `*.test` recipient
    correctly gets Resend's real `403 validation_error` (proving the integration reaches
    Resend for real and the failure path logs-but-doesn't-throw, matching the source
    routes' exact behavior), and the real-owner recipient gets genuine successful
    delivery (verified via absence of any "Failed to send" log line — welcome email
    after `verify-email`, both 2FA enable/disable alert emails). A throwaway test user
    (registered via `/auth/register` with that real email) was deleted from the local DB
    afterward, along with its `RefreshToken`/`security_alerts` rows.

11. **Local Postgres port-conflict (L32) recurred and was handled the same way**: this
    dev machine's native `postgres.exe` still squats on 5432, so a scratch
    `docker-compose.override.yml` remapped the container to 5433 for this session,
    deleted after. SSL was already enabled on the container from Session 3-3's own setup
    (persisted in the Docker volume) — no need to redo that part of L32's dance this time.

12. **`.env.local` rename-restore dance (L31) reused for the Next.js dev-server portion
    of the walkthrough**, not just Prisma CLI calls — `next dev`'s own env-loading could
    plausibly have been affected by the same file, even though L31's specific mechanism
    (prisma.config.ts's `override: true`) doesn't apply to `next dev` itself. Moved
    `.env.local` to `.env.local.bak`, ran the dev server with inline env vars pointing at
    the local stack, verified the log line said `Environments: .env` (not `.env.local`),
    then restored it — sha256 checksum identical before and after
    (`58880deb...790408a`).

13. **New deploy-infrastructure finding, cost real time to diagnose (~30+ min, 4 failed
    attempts): `railway up`'s default archive scope was NOT limited to the invoked
    subdirectory.** Running `railway up` from inside `operation-service/` repeatedly
    failed with `UPLOAD_FAILED: File too large (433MB)` — the byte count stayed
    byte-for-byte identical (down to single-digit deltas matching only the size of a
    just-added file) across 4 attempts: (a) default invocation, (b) after adding
    `operation-service/.railwayignore` (node_modules/dist/coverage), (c) after physically
    deleting `operation-service/node_modules` and `dist` entirely from disk. None of
    these changed the uploaded size at all, proving the 433MB was never coming from
    `operation-service/`'s own local directory contents in the first place — almost
    certainly the whole monorepo (this is a large repo with `seed-code/`,
    `backend-stack-a/`, `backend-stack-b/`, extensive `docs/`, etc.), uploaded from
    whatever root `railway up` actually defaults to when given no path argument. The fix:
    `railway up ./operation-service --path-as-root --service operation-service
--environment production --ci --json`, run from the repo root — explicitly scoping the
    archive root to the service's own directory. Deploy then succeeded in ~25s (141KB
    archive, confirming the fix's diagnosis). New `LESSONS-LEARNED.md` entry recorded.

14. **Production env-var gap found, Davin's explicit call: deploy now, fix later.**
    `RESEND_API_KEY` was set directly via `railway variable set --stdin` (known value,
    same shared account already used locally — matches the `NEXTAUTH_SECRET` precedent
    from Session 3-1). `NEXTAUTH_URL` (controls links embedded in emails this service
    sends — verify-email, reset-password, dashboard, settings/security) and
    `TWO_FACTOR_ENCRYPTION_KEY` (must byte-for-byte match the monolith's existing
    production value, or a 2FA secret written by one side becomes undecryptable by the
    other) are still **not set** on Railway for `operation-service` — asked Davin
    directly rather than guessing either value; he chose "deploy now, fix later" for
    both, given nothing routes real user traffic through these new endpoints yet
    (bridge-first, additive-only, same as everything else this session). Until set: the
    2FA `setup`/`verify-setup`/`disable` endpoints will 500 with a clear
    "not configured" error (safe failure, not silent corruption), and any email this
    service sends will embed `http://localhost:3000` links (broken, but nothing sends
    real emails through this path yet either). **Carried forward as a new CLAUDE.md
    Waiting-on item.**

15. **Full local walkthrough, zero production writes**, run entirely against a local
    Postgres (port 5433) + locally-run `operation-service` + real Resend API:
    register → (immediate, then delayed) `verify-email` → welcome email delivered for
    real → `forgot-password` → `reset-password` (captured token via direct read-only DB
    query, not email — register() doesn't send a verification email either, F27's
    still-deferred gap, unchanged) → login with the new password → full 2FA lifecycle
    (`setup` → `verify-setup`, real TOTP code via `otplib`, backup codes issued,
    "2FA enabled" email delivered → re-login gated by `twoFactorRequired` →
    `/auth/2fa/verify` with the temp token → login completion via the
    `__2fa_verified__` sentinel → `backup-codes` status → `disable`, "2FA disabled"
    email delivered) → both `security_alerts` rows confirmed correct. Also verified via
    the real Next.js dev server (not just operation-service directly): `token-login`
    sets cookies correctly, `token-2fa-status` forwards the cookie as a Bearer token and
    returns the real status, an absent cookie correctly 401s. Regression-checked
    unaffected: `/login` (200), NextAuth's own `/api/auth/session` (`{}`), `/dashboard`
    redirect (307) for a logged-out request.

16. **Test counts:** operation-service 7/7 suites, 56/56 tests (2 new suites:
    `auth.service.email-flows.spec.ts`, `two-factor.service.spec.ts`). Root
    117/117 suites, 2082/2082 tests (2 new suites, 18 new tests:
    `token-email-flows.test.ts`, `token-2fa-flows.test.ts`) — up from Session 3-3's
    115/115, 2064/2064 baseline, exact parity plus new coverage. Root `type-check`,
    `next lint --max-warnings 0`, and `npm run build` all clean.
