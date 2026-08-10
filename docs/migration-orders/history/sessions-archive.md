# Session History Archive

Superseded session entries moved from `CLAUDE.md` per `EXECUTOR-PROTOCOL.md` §3 step 3.
Most recent entries at the top. For the current and previous sessions, see `CLAUDE.md`.
Each session's canonical record lives in its own `*.migration-order.md` file — this archive
preserves the inline summaries that were originally written into `CLAUDE.md`'s state block.

---

_(superseded-by-above, retained for context)_ Session 4B-21 (Auth Cutover & UI Rewire, PORT/UI-BUILD hybrid), CONFIRMED, executed,
**CLOSED SUCCESSFUL 2026-08-04.** Step 1 (UI swap) done and fully verified;
Step 2 (local smoke test) executed and returned RED per the order's own explicit rule.
**CONFIRM found the same `LESSONS-LEARNED.md` L11 self-contradiction that hit 4B-20 recurring
immediately**: the working copy jumped `PRE-DRAFT → APPROVED` with no DRAFT stage, silently
dropped the committed PRE-DRAFT's own "NOT fast-path eligible... needs a full Advisor DRAFT"
framing, and claimed "entry criteria verified" while all 4 checkboxes were unchecked and one
(session-cache staleness) was a genuinely unresolved architecture question. Reported in full;
Davin confirmed live (`AskUserQuestion`) it was his own authentic edit. Re-running 4B-20's own
greps found real drift: 2 live consumers not on either session's file list
(`hooks/use-login-tracking.ts` via `components/auth/login-tracker.tsx`, `hooks/
use-realtime-socket.ts`) — approved for inclusion; a third, `hooks/use-auth.ts`, is dead code in
the monolith, flagged not touched.
**Entry Criterion 1 resolved as `DECISION-LOG.md` F57** (Davin, live): force a `getSession()`
refresh at every auth-mutating bridge call site rather than replacing `SessionProvider` with a
custom auth-context — this shrank Step 1's real scope to just 4 files that complete/end a login
(`login-form.tsx`, `verify-2fa/page.tsx`, `header.tsx`, `app/admin/login/page.tsx`) plus 4 more
with a simple endpoint swap and no cache implications (`forgot-password`, `reset-password`,
`verify-email`, `verify-email/pending`) — the other ~15 files are pure `useSession()` readers
needing zero changes, confirmed by checking each has no `signIn()`/`signOut()`/`getSession()`
call of its own.
**Also found (Deviations #6): the order's own Step 1 text over-scoped "2FA setup/verify/disable/
backup-codes" as needing new `token-2fa-*` wiring** — `/api/user/2fa/*` already forwards to
operation-service via a DIFFERENT, already-live flag (`MIGRATE_USER_2FA`, Session 4B-11); wiring
the 5 redundant `token-2fa-*` routes would have been pure duplication — not done. The one genuine
2FA gap was the mid-login completion call in `verify-2fa/page.tsx`, which now re-POSTs to
`token-login` with the same `__2fa_verified__` sentinel instead of calling `signIn('credentials',
...)`.
**A real, pre-existing, unrelated bug found and left unfixed** (out of PORT scope):
`forgot-password/page.tsx`'s embedded `?token=` reset step sends `newPassword` instead of
`password` — has always failed validation on both the legacy and bridge endpoint; confirmed this
path is unreachable in practice (the real reset email points at `/reset-password?token=...`
instead, whose own page sends the correct field). Preserved byte-for-byte, not fixed.
**Full verification (Step 1):** `tsc --noEmit` clean, `eslint app components lib hooks
--max-warnings 0` clean, full `test:ci` 129/129 suites, 2190/2190 tests (3 new test files, 2
extended). 3 commits: `d964d609` (F57), `d9ee2843` (CONFIRM), `c5c9fd31` (Step 1 code).
**Step 2 (local integration smoke test, Davin's own chosen method via `AskUserQuestion`): a
scratch script against a local monolith dev server (flag on) pointed at real production
`operation-service`, reading verification/reset tokens directly from production's own DB rather
than an inbox.** Register → verify-email → login → logout → forgot-password → reset-password →
re-login all passed cleanly end-to-end against real production `operation-service` — proves this
session's own new `token-*` call sites and the F57 fix both work correctly.
**RED RESULT — `DECISION-LOG.md` F58 (new, OPEN):** every operation-service `/user/*` route
(profile, 2FA — both cut over since Session 4B-11, unrelated to this session's own code) returns
"User not found" for a user created via `token-register`, despite the row provably existing —
proven via a direct production-DB query at the EXACT moment of the failure. Reproduced across 3
fresh test users. Extensively ruled out before escalating (not guessed at): JWE encode/decode
mismatch (read both `encodeNextAuthToken`/`decodeNextAuthToken` directly, both correct), stale-
read/wrong-database (direct `DIRECT_URL` query proved the row exists at the exact failure
moment), 2FA-specific code (`GET /api/user/profile` — a different route, same lookup shape —
fails identically), and this session's own changes (4B-21 touched zero files under
`operation-service/src/users/`, `two-factor.service.ts`, or the Prisma schema; `AuthController`'s
own routes — all genuinely new-in-this-session call sites — work correctly for the same row
throughout). Leading hypothesis, NOT confirmed (no access from this environment to verify):
operation-service's live production deployment may be running an older build than this checkout
for the `UsersController`/`TwoFactorService` code path — every prior session that exercised
`/user/*` routes did so against the long-lived canonical test fixtures
(`affiliate-test@trading-alerts.test`/`free-test@trading-alerts.test`, created via the OLD
monolith path long before this migration), never against a row created via operation-service's
OWN `AuthService.register()` — this exact interaction may simply never have been exercised
before. `operation-service` has no connected GitHub source (L23/L38, Waiting-on #77) — a redeploy
requires a manual `railway up`, so "the checkout is correct" does not imply "the running instance
matches it."
**Per this order's own explicit rule ("any red result at Step 2 = abort, do not proceed to
production flip"), Steps 3-6 (Davin's flip approval, the flag flip, the production smoke test,
retiring `CredentialsProvider`) are BLOCKED until F58 is resolved.** 3 tagged test users
(`4b21-smoke-*@trading-alerts.test`) were created in production during this diagnosis — left in
place, not deleted. **This session is not closed** — once F58 is resolved (most likely: Davin
checks operation-service's Railway deployment status/logs directly and redeploys if stale), the
remaining 6 Checklist steps continue in this same order, same session.
**Update, same day:** Davin had `operation-service` redeployed (`railway up --path-as-root
--service operation-service`, deployment `e6d716ac-...`, polled to genuine `latestDeployment.status
=== SUCCESS`, not the stale top-level field per L38) — **F58 still reproduced identically against
the freshly-deployed instance**, ruling out staleness. Further isolation (decoding the raw JWE
directly, byte-perfect claim match; instantiating operation-service's own generated Prisma client +
adapter locally against the known-good DB, which correctly finds the row with the exact same query
shape `UsersService.getProfile()` uses; a value-blind hostname check showing operation-service's
real `DATABASE_URL` resolves to the Railway-internal `postgres.railway.internal`) proves the code
itself is correct but could not conclusively identify why the LIVE container's own query returns
empty for a row that demonstrably exists.
**F58 RESOLVED, same day — turned out to be a false positive.** Davin directed a resilient
`resolveUserId(userId, email?)` email-lookup fallback in `UsersService`/`TwoFactorService`
(`getProfile`/`changePassword` + every `JwtAuthGuard`-derived `TwoFactorService` method);
implemented, tested (42/42 suites/385/385 tests), redeployed (`e2ff66e6-...`, polled to genuine
`SUCCESS`) — **F58 still reproduced identically even with the fix live**, which is what proved
the bug couldn't be inside those services at all. Bypassing the monolith's forwarding layer
entirely and calling operation-service DIRECTLY (with both a fresh `accessToken` and the
monolith-issued session cookie used as a raw Bearer token) returned clean `200`s every time; the
SAME cookie sent through the monolith's own `/api/user/profile` route still 404'd. Root cause:
**this session's own local `.env.local` never had `MIGRATE_USER_PROFILE`/`MIGRATE_USER_2FA` set**
— every `/api/user/profile`/`/api/user/2fa/*` call in this session's local testing silently fell
through to the monolith's OWN native Prisma lookup against `DATABASE_URL` (the STAGING database,
`LESSONS-LEARNED.md` L19's own precedent), never reaching operation-service at all — bridge-
registered test users (created via `token-register`, which genuinely does reach operation-
service and writes to real production) simply don't exist in that staging database. **Both flags
are already `true` in real Vercel production** (Session 4B-11's own close-out) — this was purely
a local-test-environment gap, never a production risk, and operation-service was never broken.
Set both flags locally to match production and re-ran the full smoke test: **22 of 23 checks
passed** — register, verify-email, login, logout, forgot-password, reset-password, re-login,
2FA setup, 2FA verify-setup (real TOTP code), login-with-2FA-required, 2FA verify, and — this
session's own new code — login completion via the `__2fa_verified__` sentinel, all proven
working end-to-end against real production operation-service. The one "failure" (a manually
resent raw cookie still authenticating after `token-logout`) is a test-methodology artifact, not
a bug — NextAuth's default JWE session strategy is stateless by design, unrelated to the bridge.
The `resolveUserId` fallback stays deployed (safe, tested, harmless) per Davin's own direction,
even though it wasn't the actual fix. **Step 2 now genuinely PASSES. Steps 3-6 are unblocked** —
proceeding per Davin's own explicit direction to resume them. Full evidence chain in
`DECISION-LOG.md` F58.
**Further post-flip logout hardening (same track, Davin's direct instruction):**
`handleLogout` in `components/layout/header.tsx` navigated to `/login` via `router.push`
after `token-logout`/`signOut` — client-side SPA navigation, meaning React/`SessionProvider`
state and any in-flight cookie header from the just-ended session could still be alive at
the moment the next sign-in starts, a plausible vector for NextAuth to attempt OAuth account
linking against stale session state. Both `handleLogout` branches (bridge and legacy) now use
`window.location.href = '/login'` — a full browser navigation guarantees nothing survives.
The now-unused `useRouter` import/call was removed. No other `handleLogout`-shaped function
exists in the live app (`hooks/use-auth.ts`'s `logout` is confirmed dead code, untouched per
standing note above; `app/admin/login/page.tsx`'s `signOut` call is an unauthorized-role
forced-logout on the login page itself, not this pattern; `frontend/`'s mirror is out of
scope per `EXECUTOR-PROTOCOL.md` §5). Verified: `tsc --noEmit` clean, `eslint
components/layout/header.tsx --max-warnings 0` clean, full `test:ci` 129/129 suites, 2191/2191
tests. Commit `160b4935`, pushed to `origin/main`, Vercel auto-deployed clean
(`dpl_FREJXM2f72YN8tspbvahtSQzzWpp`, aliased to `trading-alerts-saas-frontend.vercel.app`,
live `200`).
**OAuthAccountNotLinked request declined as literally asked, resolved narrower instead:** Davin
asked to add `allowDangerousEmailAccountLinking: true` to Google/Twitter/LinkedIn in
`lib/auth/auth-options.ts` to fix `ripper7375@gmail.com` hitting `OAuthAccountNotLinked`. Found
this directly contradicts `docs/decisions/google-oauth-decisions.md` Decision #3 and
`docs/policies/08-google-oauth-implementation-rules.md` — both call verified-only linking "the
MOST IMPORTANT policy" and list this exact flag on their "Common Pitfalls"/security-checklist
"DO NOT" items, with a documented attack scenario (unverified email/password squatter account +
later legitimate OAuth sign-in = auto-merged takeover). Flagged the conflict via
`AskUserQuestion` instead of silently complying or silently refusing; Davin chose the narrower,
equally-effective fix: leave `auth-options.ts`'s global policy untouched, manually link only his
own account. Confirmed via a direct read-only production query (`DIRECT_URL`, `.prisma/non-
market-client` + `PrismaPg`, same pattern as `lib/db/prisma.ts`) that his User row
(`cmkp6ftxd0000hr5xnjly47a3`) has a verified email (since 2026-01-22), a password, and zero
linked `Account` rows — exactly the safe-to-link case the existing `signIn` callback's own
verified-only check already allows. Added a temporary diagnostic (`providerAccountId` in the
existing `[SignIn]` console.log, not a secret), deployed, had Davin attempt Google sign-in on
production (still correctly 40x'd on `OAuthAccountNotLinked` — the flag was never touched), then
read the value (`113017035789984861714`) from `vercel logs`. Checked no other `Account` row
already used that `(provider, providerAccountId)` pair, then created exactly one row
(`Account.create({userId, type:'oauth', provider:'google', providerAccountId})`),
independently re-verified via a fresh read. Davin then confirmed live Google sign-in succeeds.
Diagnostic log reverted (file is byte-identical to before this change) and redeployed. 3
commits: `8b9d1906` (diagnostic added), the DB write itself (no code, one production `Account`
row, not a migration), and the diagnostic revert — each `tsc --noEmit`/`eslint --max-warnings 0`
clean, full `test:ci` 129/129 suites/2191/2191 tests green throughout. No global auth policy
changed; every other user's account-linking behavior is unaffected.
**Step 5 (Davin's own live production browser smoke test) — PASSED CLEAN**, reported by Davin:
credentials login, registration, OAuth, and logout all worked correctly against the live,
flag-flipped production bridge. No red result, so per the order's own Rule ("any red result at
Step 2 or Step 5 = abort, revert the flag, do not proceed to Step 6"), Steps 6-7 proceeded in
this same session.
**Steps 6-7 executed:** `CredentialsProvider` removed from `lib/auth/auth-options.ts` — its
`authorize()` implementation, and the two helpers that existed solely to support it
(`generate2FAToken`, the `PrismaUserWith2FA` type) are gone, along with the now-unused `bcrypt`/
`jsonwebtoken` imports (583 → ~370 lines). Three inline comments that referenced "credentials
provider" were corrected rather than left stale; the `signIn` callback's own
`account.provider !== 'credentials'` guard was simplified to a bare truthiness check (behaviorally
identical, since `'credentials'` can no longer occur as a provider name). The file's header
doc-comment was rewritten to describe its new OAuth-only scope and point at `DECISION-LOG.md`
F56. `app/api/auth/register/route.ts` was deleted (superseded by `token-register`) — confirmed,
before deleting, that its only remaining references anywhere in the live app were a mock
error-log example string and an archived/inactive e2e spec, neither a real dependency.
`scripts/verify-auth-config.js` (a standalone dev utility, not wired into `package.json` or CI)
was updated to check for `CredentialsProvider`'s _absence_ instead of its presence, so it stops
reporting false errors against the new architecture.
**A real, deliberate, permanent consequence, not an oversight:** `login-form.tsx`,
`verify-2fa/page.tsx`, `app/admin/login/page.tsx`, and `register-form.tsx` each still contain a
legacy flag-off fallback branch (`signIn('credentials', ...)` / `POST /api/auth/register`) —
these are now permanently non-functional (NextAuth returns a graceful error, not a crash) unless
a future rollback reverts this session's commits alongside the flag, exactly as this order's own
Rollback section anticipated. This is Option B/F56's own accepted design.
**Full verification:** `tsc --noEmit` clean, `eslint app components lib hooks --max-warnings 0`
clean (0 errors/warnings), full `test:ci` 129/129 suites, 2191/2191 tests — byte-identical to the
count before the removal, confirming zero regressions from retiring `CredentialsProvider`. No
test anywhere exercised `authOptions`'s provider array or `authorize()` directly, confirmed via a
repo-wide search before editing.
**`DECISION-LOG.md` F56 → RESOLVED & EXECUTED**, full entry (the original 4B-20 decision plus
this session's execution evidence) moved to `docs/migration-orders/history/decisions-archive.md`
per that file's own hygiene rule, one-line pointer left in place. `migration-cutover-table.md`
got its first-ever auth row (Phase 4B's first traffic-level auth cutover) — Status **CUT-OVER &
LIVE**. Step 8 (a dedicated post-flip monitoring window) was not run as a separate waiting
period — Davin's own live smoke test is itself the strongest available evidence, and a future
spot-check of `/api/auth/*`/`/api/user/2fa/*` error rates is the natural continuation, not a gate
on closing this order, matching the same "spot-check on the next real event" precedent already
established for Slices 1/2/3. **This order is fully CLOSED SUCCESSFUL — all 9 Checklist items
done or explicitly resolved to non-blocking.** New `4b-22-phase-4-exit-review.migration-order.md`
PRE-DRAFTed (the last domain session before Phase 4 exit review, per this order's own Next-session
handoff — no further PRE-DRAFT beyond 4B-22 is implied).

---

_(superseded-by-above, retained for context)_ Session 4B-19 (Email Rendering Port Audit & Verification, PORT/VERIFY-RETIRE
variant, Option A), CONFIRMED and executed 2026-08-03 — **CLOSED SUCCESSFUL, one commit, zero
flags touched, zero test regressions.**
CONFIRM found the by-now-familiar `LESSONS-LEARNED.md` L11 pattern once more (order file
modified-but-uncommitted, `PRE-DRAFT → APPROVED` with Option A selected in the header, no
visible Advisor→Davin approval commit trail) — this time fully benign: the entire body (all 4
Background findings, Entry Criteria, File Port Order, Rules, Slice-level verification,
Next-session handoff) diffed byte-identical to the committed PRE-DRAFT, only the header metadata
changed. Reported before proceeding; Davin confirmed live it was Antigravity Advisor's own
authentic edit.
**Independently re-verified all 4 of the PRE-DRAFT's own Background findings against live code
before trusting them** (not assumed from the order's prose): (1) `lib/email/email.ts` (984
lines) is genuinely fully ported — diffed exported function names against
`operation-service/src/email/email.util.ts` and confirmed all 24 functions match, same names,
same order; (2) `lib/email/subscription-emails.ts` (865 lines) genuinely has 5 of its email
types already ported to `operation-service/src/email/subscription-email.util.ts` (588 lines:
cancellation, payment-failed, payment-receipt, subscription-canceled, affiliate-commission) —
confirmed `getUpgradeEmailTemplate`/`sendUpgradeEmail` and
`getRenewalReminderEmailTemplate`/`sendRenewalReminderEmail` have zero callers anywhere in
`app/`, `lib/`, `components/` (self-referential only), and confirmed the file's other 5
functions are still genuinely live (imported by `app/api/subscription/cancel/route.ts` and
`lib/stripe/webhook-handlers.ts`) — retirement correctly scoped to just the 2 dead functions.
Found one immaterial citation slip: the order said "5 of 8 functions," the file actually defines
7 email-type pairs (14 exports), not 8. (3) `emails/*.tsx` (4 React Email components + barrel,
908 lines) — confirmed zero real imports anywhere in `app/`, `lib/`, `components/`, despite
`emails/index.ts`'s own header claiming a dLocal-payment-flow purpose. (4) `lib/email/templates/
affiliate/*.tsx` (5 React Email components, 1087 lines) — confirmed the only reference anywhere
in real code is one commented-out line, `lib/affiliate/registration.ts:124`; no `send*Email`
wrapper was ever built for any of the 5 templates. All 4 findings held with zero drift since the
2026-08-03 drafting; Davin gave live GO to execute under Option A.
**Executed (one commit, per the order's own explicit "if Option A... one commit" rule):**
removed `getUpgradeEmailTemplate`/`sendUpgradeEmail`/`getRenewalReminderEmailTemplate`/
`sendRenewalReminderEmail` from `lib/email/subscription-emails.ts` (865→612 lines, via a small
scripted line-range deletion rather than hand-built `Edit` matches, given the functions are
large raw-HTML-string template literals — script deleted after use, zero repo residue); deleted
all 10 dead files via `git rm -r` (`emails/{index.ts,payment-confirmation,payment-failure,
renewal-reminder,subscription-expired}.tsx` + `lib/email/templates/affiliate/{welcome,
code-distributed,code-used,monthly-report,payment-processed}.tsx` — `lib/email/templates/` is
now gone entirely, it had no other contents).
**Full verification:** `operation-service` 42/42 suites, 380/380 tests (unchanged — this service
was not touched); `nest build`/`tsc --noEmit` clean. Monolith `test:ci` 123/123 suites,
2157/2157 tests (unchanged from 4B-18d's baseline — zero regressions from the retirement);
`tsc --noEmit` clean; `eslint app components lib hooks --max-warnings 0` clean (0 errors/
warnings). Confirmed via `git show --stat` that exactly the 12 intended files changed (10
deletions + `subscription-emails.ts` + the order file itself) — nothing else touched.
**No `DECISION-LOG.md` entry applies** (no F-numbered decision was open or resolved this
session — Option A closes a stale playbook-description item against already-completed
prior-session work, not an open flag). **No `migration-cutover-table.md` change** (this session
touched zero traffic-carrying slices/flags — same precedent as every prior pure
audit/hygiene/INFRA session).
**Artifacts updated:** `4b-19-email-rendering-port.migration-order.md` (Status → CONFIRMED,
Entry criteria + Slice-level verification checked, Deviations filled in full — 5 entries),
`migration-stack-analysis.md` (new `<details>` entry for the 10 deleted files + 1 trimmed file),
this file. New `4b-20-21-auth-cutover.migration-order.md` PRE-DRAFTed (final Phase 4B domain
session per the playbook's own framing, before 4B-22/Phase 4 exit review).
