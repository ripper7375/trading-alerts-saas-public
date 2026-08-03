# Migration Order — PORT / UI-BUILD hybrid (CUTOVER)

> Completes the auth cutover 4B-20 built and prototyped. Read `00-SKELETON-AND-RULES.md` first — §4's dial: **near-zero** for the actual flag flip/retirement steps. Approved by Antigravity Advisor with Option B selected (OAuth shim retained).

**Session:** 4B-21 (Auth CUTOVER) · **Variant:** PORT / UI-BUILD hybrid · **Status:** CONFIRMED
**Generated:** 2026-08-03 (Executor PRE-DRAFT at 4B-20 close; Approved by Antigravity Advisor
2026-08-03; CONFIRMED by Executor 2026-08-03 after CONFIRM found the working copy's own
APPROVED/"entry criteria verified" claim self-contradicting — the committed PRE-DRAFT's "NOT
fast-path eligible... needs a full Advisor DRAFT" framing had been silently dropped, Status jumped
PRE-DRAFT→APPROVED with no DRAFT stage, and all 4 Entry Criteria checkboxes were unchecked with one
(session-cache staleness) genuinely unresolved — reported in full, Davin confirmed live via
`AskUserQuestion` that the edit was his own authentic action, `LESSONS-LEARNED.md` L11 recurrence)
**Estimated time:** genuinely unclear — likely multi-session (restored from the committed PRE-DRAFT;
the working copy's "1-2h" was part of the same self-contradiction above)
**Target service:** monolith (remaining UI consumers) + `operation-service` (auth endpoints)

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

- [x] Re-run 4B-20's own greps fresh — confirm the ~17-file list above hasn't drifted (new files
      added/removed, `next-auth/react` usage changed) since 2026-08-03. **DRIFT FOUND, resolved:**
      2 additional live, mounted `next-auth/react` consumers not in 4B-20's own Finding 6 list or
      this order's own file list — `hooks/use-login-tracking.ts` (mounted via `components/auth/
login-tracker.tsx` in `app/(dashboard)/layout.tsx`, runs on every dashboard page) and `hooks/
use-realtime-socket.ts` (its own `useSession()` status gate, feeding `notification-bell.tsx` and
      `useFiredAlertMarkers.ts`→`trading-chart.tsx`, both already-named). Davin approved including
      both (`AskUserQuestion`) — both are pure readers, confirmed to need zero code changes under
      F57's chosen fix (see Deviations). A third file, `hooks/use-auth.ts`, also imports
      `next-auth/react` but is dead code in the monolith (its only consumer, `hooks/use-alerts.ts`,
      is itself unimported anywhere) — flagged, not touched.
- [x] **Resolve 4B-20's own Deviation 4 (client-side session-cache staleness)** — RESOLVED as
      `DECISION-LOG.md` **F57** (Davin, live): force a `getSession()` refresh at every
      auth-state-changing bridge call site, not a `SessionProvider` replacement. See F57 for full
      rationale and the resulting (much narrower) real file-change scope.
- [x] Confirm `DECISION-LOG.md` F56's Option B is still what Davin wants — confirmed live
      (`AskUserQuestion`) before any further execution; unchanged from 4B-20's own resolution.
- [ ] Davin present/available for the live flag flip and the live per-surface smoke test — not yet
      reached (Checklist Steps 3-5); this criterion gates the production flip specifically, not
      Step 1's local UI swap.

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

1. **Order self-contradiction at CONFIRM (`LESSONS-LEARNED.md` L11 recurrence, immediately after
   4B-20's own "most consequential" instance).** Full detail in the header's own CONFIRMED note
   above. Resolved by asking Davin directly (`AskUserQuestion`) rather than trusting or silently
   correcting; confirmed live as his authentic edit.
2. **Real file-list drift found re-running 4B-20's own greps** (Entry Criterion 1): 2 additional
   live consumers (`hooks/use-login-tracking.ts` via `components/auth/login-tracker.tsx`, `hooks/
use-realtime-socket.ts`) not named in either session's file list; 1 dead-code false-positive
   (`hooks/use-auth.ts`, unused in the monolith). Davin approved including the 2 real files.
3. **Entry Criterion 1 (session-cache staleness) resolved as `DECISION-LOG.md` F57**: force
   `getSession()` at every auth-mutating bridge call site rather than replacing `SessionProvider`.
   This turned out to shrink Step 1's real scope dramatically — of the ~19 files that read
   `useSession()`/`getSession()`, only 4 needed actual code changes (the ones that MUTATE auth
   state): `login-form.tsx` (add `getSession()` after bridge login), `verify-2fa/page.tsx` (swap
   the mid-login completion call from `signIn('credentials', {email:'__2fa_verified__',...})` to a
   `token-login` re-POST with the same sentinel, then `getSession()`), `header.tsx` (swap logout to
   `token-logout` + `getSession()`), and `app/admin/login/page.tsx` (swap to `token-login`, read
   `user.role` from its response body directly instead of a `getSession()` role-check, then still
   force `getSession()` for other consumers). The other ~15 files (settings/\*, pricing, checkout,
   `providers.tsx`, notification-bell/list, trading-chart, DrawingLayer, the 2 newly-found hooks)
   are pure readers — verified each has no `signIn()`/`signOut()`/`getSession()` call of its own —
   and needed zero changes, since `getSession()`'s cross-consumer broadcast (next-auth/react's own
   documented mechanism) refreshes all of them automatically.
4. **4 more files flag-gated with NO session-cache implications** (never complete a login):
   `forgot-password/page.tsx` (both its request step → `token-forgot-password`, and its embedded
   `?token=` reset step → `token-reset-password`), `reset-password/page.tsx` (→
   `token-reset-password`), `verify-email/page.tsx` (→ `token-verify-email`),
   `verify-email/pending/page.tsx` (→ `token-resend-verification`).
5. **A real, pre-existing, unrelated bug found, NOT fixed (out of this PORT-variant session's
   scope):** `forgot-password/page.tsx`'s embedded reset step sends `{ token, newPassword: ... }`
   to `/api/auth/reset-password`, but that route's Zod schema (and the bridge's `token-reset-
password`) both require `password`, not `newPassword` — every submission through this specific
   path has always failed with a validation error, on both the legacy and (now) bridge endpoint.
   Confirmed this path is unreachable in practice (nothing links to `/forgot-password?token=...`;
   the real reset email points at `/reset-password?token=...`, whose own page sends the correct
   `password` field). Preserved byte-for-byte (same wrong field name) when flag-gating, per PORT
   discipline — not fixed as a drive-by.
6. **The order's Checklist Step 1 text over-scoped "2FA setup/verify/disable/backup-codes" as
   needing new `token-2fa-*` wiring** (`LESSONS-LEARNED.md` L27 class — order text drifted from
   ground truth). Reading `app/api/user/2fa/verify/route.ts` found it's ALREADY flag-gated behind
   `shouldUseOperationServiceForUser2FA()` (`MIGRATE_USER_2FA`, cut over live in Session 4B-11,
   unrelated to `NEXT_PUBLIC_AUTH_BRIDGE_ENABLED`) — `settings/security/page.tsx`'s 2FA setup/
   disable/backup-codes UI already reaches operation-service's `TwoFactorService` today, via a
   different, already-live flag. The 5 `token-2fa-setup/-disable/-backup-codes/-status/
-verify-setup` bridge routes would be pure duplication with zero behavior change if wired in —
   NOT wired, to avoid needless duplicate call paths. The ONE genuine 2FA gap for this session was
   the mid-login completion call in `verify-2fa/page.tsx` (item 3 above) — the code-verification
   step itself (`/api/user/2fa/verify`) was correctly left untouched, already bridge-equivalent.
7. **Full verification (Step 1 only):** `tsc --noEmit` clean, `eslint app components lib hooks
--max-warnings 0` clean (0 errors/warnings), full `test:ci` 129/129 suites, 2190/2190 tests (new:
   `__tests__/app/auth-verify-2fa.test.tsx`, `__tests__/app/admin-login.test.tsx`,
   `__tests__/app/auth-bridge-endpoint-swaps.test.tsx`; extended: `login-form.test.tsx` (added
   `getSession` mock + 2 new assertions), `header.test.tsx` (added `getSession`/flag mocks)).
8. **Checklist Step 2 (local integration smoke test) — initially RED, then fully resolved to
   GREEN same session.** Davin chose (`AskUserQuestion`) a scratch-script method against a local
   monolith dev server (flag on) pointed at real production `operation-service`, reading
   verification/reset tokens directly from production's own DB rather than checking an inbox.
   First pass found `DECISION-LOG.md` F58 (every operation-service `/user/*` route returning
   "User not found" for a bridge-registered user) — extensively investigated (JWE decode,
   direct-Prisma-client replica test, a redeploy, a temporary diagnostic marker) before the real
   cause surfaced: **this session's own local `.env.local` never had `MIGRATE_USER_PROFILE`/
   `MIGRATE_USER_2FA` set**, so `/api/user/profile`/`/api/user/2fa/*` were silently falling
   through to the monolith's own native lookup against the STAGING database instead of forwarding
   to operation-service at all — operation-service itself was never broken, and both flags are
   already `true` in real Vercel production. Once the local flags were set to match production,
   the full smoke test (register → verify-email → login → logout → forgot-password → reset-
   password → re-login → 2FA setup → 2FA verify-setup with a real TOTP code → login-with-2FA-
   required → 2FA verify → login completion via the `__2fa_verified__` sentinel → session reflects
   the user) passed **22 of 23 checks** — the one exception is a test-methodology artifact (a
   manually-resent raw cookie outliving `token-logout`, which a real browser never does), not a
   bug. Davin's own `resolveUserId` email-lookup fallback (`UsersService`/`TwoFactorService`)
   stays deployed as harmless defense-in-depth even though it wasn't the actual fix. Several
   tagged test users were created in production as part of this diagnosis
   (`4b21-smoke-*@trading-alerts.test`, `4b21-f58fix-*@trading-alerts.test`,
   `4b21-direct-*@trading-alerts.test`, `4b21-isolate-*@trading-alerts.test`) — left in place, not
   deleted (does not permanently delete production data). **Step 2 now genuinely PASSES.**
9. Session-cache staleness fix (F57) is independently proven correct by this same smoke test: the
   monolith's own `GET /api/auth/session` correctly reflected the logged-in user immediately after
   each bridge login and after the 2FA-completion login, with no separate confirmation call needed
   beyond the `getSession()` this session's own code already added.

10. **Steps 3-4 executed.** Davin's own explicit direction to "resume Steps 3-6" (given after F58
    was found and being investigated) constituted Step 3's approval — reconfirmed as still valid
    once F58 resolved to a false positive and Step 2 genuinely passed. `NEXT_PUBLIC_AUTH_BRIDGE_
ENABLED` added to Vercel production (`vercel env add`, value-blind re-verified present via
    `vercel env ls production`'s name-only listing, L17), then `vercel --prod --archive=tgz --yes`
    (L36) redeployed clean — `dpl_7TigfKa65wsyJhLfS84iGGm8Y4n3`, `readyState: READY`, aliased to
    the real production URL. Live-verified: `/login` → 200, `/dashboard` (unauthenticated) → 307
    redirect (unchanged, auth gate still correct), homepage → 200.
11. **Step 5 (Davin's own live browser smoke test) — handed off, awaiting his report.** Per the
    order's own Rule, any red result here means abort and revert
    (`NEXT_PUBLIC_AUTH_BRIDGE_ENABLED=false` + redeploy) — do not proceed to Step 6 until this
    passes clean.

## Next-session handoff

- Step 6 (retire `CredentialsProvider` from `auth-options.ts`) and Step 7 (retire the monolith's
  dead credentials-path code) proceed once Davin's Step 5 live smoke test reports clean — in THIS
  same order, same session, not deferred.
- Once 4B-21 fully closes (all 6 remaining steps done): **4B-22 (Phase 4 exit review)** — the last
  session in Phase 4B, walking the phase-exit criteria from the plan one by one. This is the literal
  final domain session before that review; no further PRE-DRAFT beyond 4B-22 is implied by this
  order.
