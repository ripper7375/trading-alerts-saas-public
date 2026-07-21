# Migration Order — Next.js side (cookie-set route, middleware guard, silent refresh, SSR fetch)

> `TEMPLATE-UI-BUILD.md` per `00-SKELETON-AND-RULES.md` §2's table (Session 3-3 is
> explicitly listed under UI-BUILD's playbook examples, not PORT) — this session builds
> NEW frontend-side surfaces that consume Session 3-2's endpoints, not a port of
> existing code. **Creativity dial: High** — the contract (Session 3-2's 5 endpoints)
> constrains the data, not the design.
> **Status: PRE-DRAFT** — raw facts and candidate steps only; the Advisor upgrades this
> to DRAFT.

**Session:** 3-3 · **Phase:** Phase 3 — Hybrid (Dual) JWT Authentication (Workstream 2),
plan step 3.3 · **Generated:** 2026-07-21 (Session 3-2 close).
**Playbook tasks:** cookie-set API route, middleware guard on protected matchers, ~14-min
silent-refresh loop, SSR fetch helpers forwarding the bearer token.
**Playbook done-when:** "staging walkthrough: login → dashboard SSR → browser call →
logout, all via the new token path (NextAuth still untouched in production)."

## Known blocker, flag before DRAFTing — not resolved here

The playbook's literal "done when" requires a **staging walkthrough**. Phase 0's CC-A
gap (dedicated staging stack) is still open — same problem Session 3-1 hit at its own
CONFIRM, which Davin resolved live by deploying additively into `production` instead.
Session 3-3 is materially higher-risk to do the same way: 3-1 only added a
not-yet-called guard; 3-3 is the session that would start **actually sending real
production traffic** (cookies, middleware routing real requests) through the new path.
Whether that's acceptable to test directly against production, or whether this is the
session that finally pulls CC-A forward, is a decision for Davin/the Advisor — flagged
here rather than assumed either way.

## Context carried over from Session 3-2's close

- `operation-service` now has `/auth/{register,login,refresh,logout,me}` — code-complete,
  tested (32/32 unit tests), deployed to Railway production, but **not yet called by
  anything live**. `app/api/auth/[...nextauth]/route.ts` and NextAuth on Vercel are
  completely unchanged and still the only thing real users go through.
- `/auth/login` issues a NextAuth-compatible JWE (F24) — same format
  `JwtAuthGuard` already verifies, using the same `NEXTAUTH_SECRET`-derived key
  (`operation-service/src/auth/next-auth-jwt-encode.util.ts`). This session's cookie-set
  route needs to decide: reuse NextAuth's exact cookie name/settings
  (`__Secure-next-auth.session-token` in production, `httpOnly`/`sameSite: 'lax'`/
  `secure` per `lib/auth/auth-options.ts`'s `cookies` block) so existing
  session-reading code paths keep working unmodified, or introduce a distinct cookie —
  security/auth-semantics territory (`CLAUDE.md` Non-negotiable 5), flag for Davin
  rather than deciding unilaterally.
- Refresh tokens are opaque random strings (SHA-256-hashed at rest, `RefreshToken`
  table, F23) with **rotation** on every `/auth/refresh` call (old token revoked, new
  one issued) — the ~14-minute silent-refresh loop needs to store/replace the rotated
  raw token client-side each time, not reuse a static one.
- **Known gap, not yet closed:** `/auth/register` creates the user and verification
  token but does not send the verification email (`lib/email/email.ts`'s Resend
  integration was never ported — out of Session 3-2's scope). If this session (or a
  dedicated follow-up first) points real registration traffic at `operation-service`,
  this gap needs closing first, or new users get no verification email at all.
- `RefreshDto`/`LoginDto`/`RegisterDto` (class-validator) define the exact request
  shapes; `AuthErrorFilter` maps `AuthError` subclasses to `{error, message}` + the
  original `statusCode`, except `TwoFactorRequiredError` which returns
  `{twoFactorRequired: true, token}` at 200 — the frontend's login flow needs to handle
  this branch (call the existing `app/api/user/2fa/verify` route, then re-POST
  `/auth/login` with `email: '__2fa_verified__'`, `password: <token>` — same two-step
  shape the current NextAuth-based flow already uses, unchanged).

## Candidate steps (starting hypothesis, not settled)

1. Cookie-set API route (`app/api/auth/token-login` or similar) — calls
   `operation-service`'s `/auth/login`, sets the resulting access token as an httpOnly
   cookie (name/settings decision above), stores the refresh token similarly.
2. Middleware guard (`middleware.ts` or extending it) — reads the cookie, calls
   `JwtAuthGuard`'s same decode logic (or a thin HTTP call to `/auth/me`) to gate
   protected routes.
3. Silent-refresh loop — client-side timer calling `/auth/refresh` before the ~30-day
   token would expire (matches `NextAuth`'s `session.maxAge`), rotating the stored
   refresh token each time.
4. SSR fetch helpers — server components/route handlers that need to call
   `operation-service` forward the bearer token from the cookie.
5. Logout wiring — calls `/auth/logout`, clears cookies.

## Entry criteria (candidate — re-verify at CONFIRM)

- [ ] Session 3-2's endpoints still healthy in production (`/health` up,
      `/auth/me` reachable with a freshly-minted token).
- [ ] Davin/Advisor's decision on the staging-blocker question above, made BEFORE
      writing ordered steps that assume either path.
- [ ] Davin/Advisor's decision on cookie-compatibility (reuse NextAuth's exact cookie
      vs. a new one) — security-adjacent, needs explicit sign-off.
- [ ] Decide whether the `/auth/register` email-sending gap must close before or
      alongside this session, given it's the session that would start sending real
      traffic.

## Rollback

Not yet scoped — depends on which staging-blocker path is chosen. If this session ends
up modifying `middleware.ts` (a file every request passes through), its rollback needs
to be a fast, clean revert — write this section for real once the Advisor's DRAFT fixes
the actual approach.

## Deviations

_(filled during execution)_
