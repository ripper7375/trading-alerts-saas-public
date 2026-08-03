# Migration Order — PORT / UI-BUILD hybrid (CUTOVER)

> Completes the auth cutover 4B-20 built and prototyped. **NOT fast-path eligible under any
> circumstance** — this is the single highest-blast-radius session in the whole migration (auth
> semantics: credentials, 2FA, registration, sessions, and the client-side session read every
> other page depends on). Needs a full Advisor DRAFT and Davin APPROVED before CONFIRM, per
> `EXECUTOR-PROTOCOL.md` §7. Read `00-SKELETON-AND-RULES.md` first — §4's dial: **near-zero** for
> the actual flag flip/retirement steps, but real UI-BUILD work remains for the ~17 files 4B-20
> deliberately left unswapped, so this is not a pure VERIFY-RETIRE session either.

**Session:** 4B-21 (Auth CUTOVER) · **Variant:** PORT / UI-BUILD hybrid · **Status:** PRE-DRAFT
**Generated:** 2026-08-03 (Executor PRE-DRAFT at 4B-20 close) · **Estimated time:** genuinely
unclear — likely multi-session, same caveat 4B-20's own PRE-DRAFT carried
**Target service:** monolith (remaining UI consumers) + `operation-service` (none — its `/auth/*`
surface has been frozen and live since Sessions 3-1 through 3-5)

## What 4B-20 already did (re-verify, don't assume — same L27 discipline as every prior order)

- `NEXT_PUBLIC_AUTH_BRIDGE_ENABLED` flag built (`lib/auth/auth-bridge-flag.ts`), default
  unset/`false` everywhere. `app/api/auth/token-register/route.ts` built (the one genuinely
  missing bridge route) — all 14 `token-*` routes now exist.
- `components/auth/login-form.tsx` and `register-form.tsx` are both flag-gated: bridge path calls
  `token-login`/`token-register` when the flag is `true`, otherwise unchanged
  `next-auth/react`/monolith-register behavior. Both covered by new component tests.
- `operation-service/src/auth/auth.service.ts`'s `register()` now genuinely sends the
  verification email (a real gap closed this session, open since Session 3-2 — see 4B-20's own
  Deviations #2).
- `DECISION-LOG.md` **F56**: Option B for OAuth — `lib/auth/auth-options.ts` /
  `[...nextauth]` stay alive **indefinitely**, scoped to OAuth (Google/Twitter/LinkedIn) only,
  once `CredentialsProvider` is removed from it (this session's own job, not 4B-20's).
- **Not yet done, carried forward as this session's own real work:** the other ~17 files from
  4B-20's own Finding 6 (`app/(dashboard)/settings/*`, `app/(marketing)/pricing/page.tsx`,
  `app/checkout/page.tsx`, `app/(auth)/verify-2fa/page.tsx`, `app/providers.tsx`,
  `app/admin/login/page.tsx`, `components/notifications/{notification-bell,notification-list}
.tsx`, `components/charts/{trading-chart,drawing/DrawingLayer}.tsx`, `components/layout/
header.tsx`, plus at least one test file (`__tests__/components/layout/header.test.tsx`)) still
  import `next-auth/react` directly and are untouched.

## Entry criteria — do not proceed past Step 0 without these

- [ ] Re-run 4B-20's own greps fresh — confirm the ~17-file list above hasn't drifted (new files
      added/removed, `next-auth/react` usage changed) since 2026-08-03.
- [ ] **Resolve 4B-20's own Deviation 4 (client-side session-cache staleness) before touching any
      of the ~13 files that call `useSession()`/`getSession()` directly** (not just the 2 already
      flag-gated, which route through server-side `getServerSession()` and were unaffected by
      this gap). Concretely: does `app/providers.tsx`'s `<SessionProvider>` get replaced by a
      thin custom auth-context reading a "who am I" endpoint, or does the bridge login/logout
      path force a `next-auth/react` `getSession()`/`update()` call so the existing
      `SessionProvider`'s client cache stays correct? This is a real architecture decision, not
      assumed here — same class of "don't guess, ask" as 4B-20's own Entry Criterion 0.
- [ ] Confirm `DECISION-LOG.md` F56's Option B is still what Davin wants before removing
      `CredentialsProvider` from `auth-options.ts` — a second live confirmation immediately before
      an irreversible-feeling deletion, matching this migration's own standing caution on auth/
      money decisions that sat for more than one session before being acted on.
- [ ] Davin present/available for the live flag flip and the live per-surface smoke test — no
      flip without his explicit go, per every prior cutover in this migration.

## Checklist

1. **Finish the UI swap** (PORT/UI-BUILD, not VERIFY-RETIRE dial) for the remaining ~17 files:
   swap `useSession()`/`getSession()`/`signOut()` calls to whatever mechanism Entry Criterion 0
   above resolves; wire the 12 already-built-but-unused `token-*` routes (2FA setup/verify/
   disable/backup-codes, forgot/reset-password, verify-email/resend, logout) into their real UI
   consumers, gated behind the SAME `NEXT_PUBLIC_AUTH_BRIDGE_ENABLED` flag 4B-20 established —
   don't invent a second flag or a per-file flag.
2. **Live smoke test every swapped surface with the flag ON in a non-production check first**
   (local/dev against real `operation-service`, mirroring 4B-20's own established local-testing
   precedent, L31/L32): credentials login (+2FA required branch), registration
   (+email verification actually arriving), 2FA setup/verify/disable/backup-codes, password
   forgot/reset, email verification/resend, logout. Any red result = stop, do not proceed to
   production flip.
3. **Davin approves the flip.** (His question ritual: "what's the rollback?" — answer:
   `NEXT_PUBLIC_AUTH_BRIDGE_ENABLED=false` + redeploy, same as every other flag in this
   migration; OAuth is entirely unaffected either way.)
4. **Flip `NEXT_PUBLIC_AUTH_BRIDGE_ENABLED=true`** in Vercel production, redeploy
   (`vercel --prod --archive=tgz --yes`, L36).
5. **Davin runs the real smoke test in production** (his own browser, matching every prior
   Phase 4B live-verification method): sign out, sign back in via credentials, confirm 2FA still
   works if enabled on his account, confirm the dashboard/session-dependent UI (header, real-time
   notification bell) shows him as logged in correctly (this is exactly what Deviation 4/Entry
   Criterion above must have already gotten right, or this step fails).
6. **Retire `CredentialsProvider` from `lib/auth/auth-options.ts`** (Option B, F56) — OAuth
   providers (Google/Twitter/LinkedIn) and the rest of the NextAuth config stay. Full test suite
   - `tsc --noEmit` + `eslint` after.
7. **Retire the monolith's now-dead credentials-path code**: `app/api/auth/register/route.ts`
   (superseded by `token-register`), and confirm nothing else still depends on the removed
   `CredentialsProvider` branch. Do not touch `app/api/auth/[...nextauth]/route.ts` itself (still
   live for OAuth) or `middleware.ts` (unaffected either way, per 4B-20's own confirmation).
8. Monitor for a real window post-flip (error rate on `/api/auth/*` and `/api/user/2fa/*` routes,
   login success rate) before calling this stable — same discipline as every prior Phase 4B
   cutover's own open monitoring caveat.
9. Record: `migration-cutover-table.md` (first row this whole Phase 4B track has needed — auth
   was never flag-gated at the traffic level before this), `CLAUDE.md`, `DECISION-LOG.md` (F56
   closed out with the live production evidence).

- **Rollback:** `NEXT_PUBLIC_AUTH_BRIDGE_ENABLED=false` + redeploy — pre-verified as the correct
  reverse action by 4B-20's own design (every consumer's flag-off branch is untouched, existing
  code). If `CredentialsProvider` has already been removed from `auth-options.ts` by the time a
  rollback is needed, that removal must be reverted too (`git revert`) — the flag alone cannot
  restore it.

## Rules specific to this session

- Do not remove `CredentialsProvider` (Step 6) before Steps 1-5 are fully green in production —
  there must be no window where credentials login has neither a working bridge NOR a working
  NextAuth path.
- OAuth (Google/Twitter/LinkedIn) must be smoke-tested as unaffected at Step 5, even though this
  session doesn't touch it — regression, not just non-regression by assumption.
- Any red result at Step 2 or Step 5 = abort, revert the flag, do not proceed to Step 6.

## Deviations

_(empty — filled during execution once this order reaches DRAFT → APPROVED → CONFIRMED)_

## Next-session handoff

- Once 4B-21 closes: **4B-22 (Phase 4 exit review)** — the last session in Phase 4B, walking the
  phase-exit criteria from the plan one by one. This is the literal final domain session before
  that review; no further PRE-DRAFT beyond 4B-22 is implied by this order.
