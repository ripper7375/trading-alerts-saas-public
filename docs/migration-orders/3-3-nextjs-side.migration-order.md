# Migration Order — Next.js side (cookie-set route, middleware guard, silent refresh, SSR fetch)

> `TEMPLATE-UI-BUILD.md` per `00-SKELETON-AND-RULES.md` §2's table (Session 3-3 is
> explicitly listed under UI-BUILD's playbook examples, not PORT) — this session builds
> NEW frontend-side surfaces that consume Session 3-2's endpoints, not a port of
> existing code. **Creativity dial: High** — the contract (Session 3-2's 5 endpoints)
> constrains the data, not the design.
> **Status: CONFIRMED** — 2026-07-21. F25/F26/F27 resolved by Davin (DECISION-LOG.md).
> CONFIRM re-verification this session:
>
> - `operation-service` production health: `/health` → `{"status":"healthy","services":{"database":{"status":"up"}}}`
>   (live `curl` against `operation-service-production.up.railway.app`, domain
>   confirmed via `railway status --json` to belong to the `operation-service`
>   instance, not a sibling service).
> - **Finding (cookie name):** F26's Decision Log text says "reuse
>   `next-auth.session-token`" — but `lib/auth/auth-options.ts`'s live `cookies` block
>   shows that name is the **non-production** value; production actually uses
>   `__Secure-next-auth.session-token` (`secure: true`, same `httpOnly`/`sameSite:
'lax'`/`path: '/'`). The Decision Log's literal string is dev-mode shorthand, not
>   a deliberate departure — F26's own stated rationale ("perfectly aligns with
>   bridge-first... zero changes to frontend client components") only holds if the
>   _actual_ per-environment name/attributes are matched. Implementing this session's
>   cookie-set route against the same `NODE_ENV`-conditional the existing code already
>   uses, not the literal string — logged here per protocol rather than silently
>   assumed.
> - **Finding (local-testing scope, F25):** `docker-compose.dev.yml`'s own header
>   comment says NestJS services "join this file in later phases" — `operation-service`
>   is not in it today. Separately, `operation-service/.env.example`'s `DATABASE_URL`
>   is documented as "the SAME production Postgres as the root Next.js app" — it has
>   no non-production connection string at all. Taken together, F25's "test locally"
>   would, if operation-service is called at its deployed Railway URL, still write
>   real `RefreshToken` rows (and require a real user) against **production** Postgres
>   even though the Next.js dev server itself runs locally. Resolution (small, in-bounds,
>   recorded as a Deviation rather than escalated): run `operation-service` locally too,
>   pointed at `docker-compose.dev.yml`'s local Postgres — `prisma.config.ts`'s default
>   schema (`prisma/non-market-data/schema.prisma`, pushed via the `web` service's own
>   `db:push`) already declares the exact same hardened `User`/`RefreshToken` shape
>   operation-service's own hand-synced schema expects, and `prisma/seed.ts` already
>   creates 5 known-password synthetic e2e users (F17) — so the full walkthrough can run
>   entirely against local synthetic data, zero production writes, until the final
>   deploy step.
> - Entry criteria re-checked below.

**Session:** 3-3 · **Phase:** Phase 3 — Hybrid (Dual) JWT Authentication (Workstream 2),
plan step 3.3 · **Variant:** UI-BUILD · **Generated:** 2026-07-21 (DRAFT).
**Flags touched:** F25 (Staging Blocker), F26 (Cookie Compatibility), F27 (Email Registration Gap).
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

- [x] Session 3-2's endpoints still healthy in production (`/health` up,
      confirmed 2026-07-21 via live `curl`). `/auth/me` reachability confirmed via
      this session's local walkthrough instead (Deviations #6) — real login → real
      access token → real `/auth/me` 200 — rather than against production, avoiding
      any account/RefreshToken row in production Postgres purely to satisfy this
      check.
- [x] F25: Davin's decision on the staging-blocker question (local testing vs building CC-A).
- [x] F26: Davin's decision on cookie-compatibility (reuse NextAuth's exact cookie vs. a new one).
- [x] F27: Decide whether the `/auth/register` email-sending gap must close before or alongside this session.

## Rollback

Not yet scoped — depends on which staging-blocker path is chosen. If this session ends
up modifying `middleware.ts` (a file every request passes through), its rollback needs
to be a fast, clean revert — write this section for real once the Advisor's DRAFT fixes
the actual approach.

## Deviations

1. **Cookie name (F26 correction):** implemented against `lib/auth/auth-options.ts`'s
   real `NODE_ENV`-conditional cookie name/attributes, not the Decision Log's literal
   `next-auth.session-token` string (that's the non-production value only) — see the
   CONFIRM note at the top of this order. `lib/operation-service/cookies.ts` centralizes
   this so both `middleware.ts` and every route agree.
2. **`/admin` excluded from the middleware matcher.** Found at build time: a SEPARATE,
   non-route-group tree (`app/admin/login`, `app/admin/affiliates`,
   `app/admin/settings`) shares the `/admin` URL prefix with
   `app/(dashboard)/admin/*` but has its own bespoke, logged-out-reachable login page
   (`app/admin/login/page.tsx`, still `next-auth/react`'s `signIn()`, no page-level
   guard above it). Matching `/admin/:path*` would have redirected logged-out admins
   away from their own login page before they could reach it. Excluded rather than
   special-cased — `(dashboard)/admin/*` already has its own working
   `getServerSession` guard via `app/(dashboard)/layout.tsx` regardless of whether
   middleware also covers it, so nothing loses protection.
3. **Refresh token never reaches client JS.** The order's candidate step 3 assumed
   client-visible storage ("client-side timer... store/replace the rotated raw token
   client-side"); implemented instead as an httpOnly cookie rotated entirely
   server-side (`app/api/auth/token-refresh/route.ts`), with the client-side loop
   (`components/auth/token-refresh-provider.tsx`) firing blind and ignoring every
   outcome. Stricter than specified, not a downgrade — not escalated per the
   Autonomy & Deviation clause's "materially better approach" allowance.
4. **Login/register forms not rewired.** `components/auth/login-form.tsx` and
   `register-form.tsx` still call `next-auth/react`'s `signIn()`/NextAuth directly —
   deliberately not switched to the new `token-login` route this session. The
   "Known blocker" section's own framing ("NextAuth still untouched in production")
   and `EXECUTOR-PROTOCOL.md` §7's cutover-approval requirement both point the same
   way: this session builds and proves the new path, a dedicated cutover session
   (Davin's live approval on the specific flip) switches real traffic onto it.
5. **`/auth/register` not wired at all**, per F27 (deferred — email-sending gap).
6. **Local walkthrough infra (F25), and a real footgun found along the way:**
   `operation-service` isn't in `docker-compose.dev.yml` and its `.env.example`
   documents only the production `DATABASE_URL` — running it locally required manual
   setup (see LESSONS-LEARNED.md L31 for the `.env.local`/`prisma.config.ts` near-miss
   this surfaced, and the new lesson about the native Windows `postgres.exe` port
   conflict). Full walkthrough executed entirely against a local Postgres (SSL
   enabled via a locally-generated self-signed cert, to match `PrismaService`'s/
   `prisma/seed.ts`'s hardcoded `ssl: {rejectUnauthorized: false}` adapter config) +
   a locally-run `operation-service`, using a hand-inserted synthetic test user (not
   `prisma/seed.ts` — its adapter's SSL requirement is the same one this walkthrough
   worked around, orthogonal to this session's scope to fix). Zero production writes.
   Result: login → cookie-set (both cookies) → `/dashboard` 200 (proves F26 cookie
   compatibility against BOTH `middleware.ts`'s `getToken()` and
   `(dashboard)/layout.tsx`'s `getServerSession()`) → SSR bearer-forward to
   operation-service's `/auth/me` 200 → silent-refresh rotates both cookies (old
   refresh token independently confirmed revoked) → logout clears both cookies +
   revokes the current refresh token → `/dashboard` 307→ `/login` again. Also
   confirmed unaffected: `/login` (200), NextAuth's own `/api/auth/session` ({}),
   and `/admin/login` (200, not redirected — confirms deviation #2 above).
   Entry-criterion checkbox above updated from "deferred" to this evidence.
