# Migration Order — Three-path verification (Phase 3 exit)

> **Status: PRE-DRAFT** — needs the Advisor to produce the DRAFT, then Davin's
> APPROVAL. **Session:** 3-5 · **Phase:** Phase 3 — Hybrid (Dual) JWT Authentication,
> plan step 3.5 · **Variant:** flagged VERIFY-RETIRE below, but the Advisor should
> re-check — see the flag section.
> **Playbook tasks:** "Automated e2e proving a protected endpoint works via (a) SSR,
> (b) browser, (c) service-to-service `SVC_TOKEN`; token expiry/refresh/revocation e2e;
> confirm NextAuth production regression-free. Check Phase 3 exit criteria." ·
> **Playbook done-when:** "all e2e green; Decision Log updated; dual-auth running."

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

- [ ] The Advisor has resolved the SVC_TOKEN variant question above (build-first vs.
      descope-with-sign-off vs. it exists somewhere not yet grepped for).
- [ ] operation-service's `/health` still green in production (regression check).
- [ ] Confirm whether "NextAuth production regression-free" can be checked at all in
      this environment, or needs Davin's own manual check (Vercel access gap,
      unchanged).

## Rollback

Not yet scoped — depends on whether the DRAFT ends up pure VERIFY-RETIRE (rollback =
none needed, it's read-only verification) or picks up a small SVC_TOKEN build sub-step
(would need its own rollback, additive-only same as every prior 3-x session).

## Deviations

_(filled during execution)_
