# Migration Order — CORS + secondary flows (2FA, email verification, password reset)

> **Status: PRE-DRAFT** — raw facts/candidate steps from Session 3-3's close, for the
> Advisor to upgrade to DRAFT per `00-SKELETON-AND-RULES.md` §2/§3.
> **Session:** 3-4 · **Phase:** Phase 3 — Hybrid (Dual) JWT Authentication (Workstream
> 2), plan step 3.4 · **Playbook tasks:** "NestJS CORS (Vercel origins + localhost,
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

- [ ] Session 3-3's endpoints/middleware still healthy in production (`/health` up;
      `/dashboard` still reachable for a real session — regression check, since
      middleware is new and touches every request under its matcher).
- [ ] Decide the CORS question (candidate step 1) before assuming it's in scope.
- [ ] Decide the staging-vs-local-testing question (see "Known blocker" above) —
      likely the same F25-style call, but email-sending is a new wrinkle 3-3 didn't
      have.

## Rollback

Not yet scoped — depends on which of the candidate steps the DRAFT actually picks.
New operation-service endpoints are additive (same low-blast-radius posture as
Session 3-2); re-pointing the Next.js side's actual call sites (if this session goes
that far) needs a real rollback plan, same discipline `middleware.ts` already
required in Session 3-3.

## Deviations

_(filled during execution)_
