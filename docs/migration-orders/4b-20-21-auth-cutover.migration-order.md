# Migration Order — PORT / UI-BUILD variant (hybrid)

> For sessions that **move existing code between stacks** AND **build/rewire frontend
> surfaces**. Read `00-SKELETON-AND-RULES.md` first — §4's dial is mixed here: **Low** for the
> one missing backend endpoint (behavior preservation), **Medium** for the UI rewiring (the
> contract — which cookie, which JWE format, which guard — is fixed; only the client-side
> plumbing connecting to it is open). This is the **LAST** domain session in Phase 4B and the
> highest-remaining-risk one (auth semantics) — **not fast-path eligible under any
> circumstance.** Needs a full Advisor DRAFT and Davin APPROVED before CONFIRM, per
> `EXECUTOR-PROTOCOL.md` §7 ("anything that would touch... auth semantics" escalates
> immediately, always).

**Session:** 4B-20 (this order) / 4B-21 (CUTOVER, drafted separately once 4B-20 closes) ·
**Variant:** PORT / UI-BUILD hybrid · **Status:** PRE-DRAFT
**Generated:** 2026-08-03 (Executor PRE-DRAFT at 4B-19 close) · **Flags touched:** none yet — see
Entry criteria (a client-side rollout flag is proposed, not decided)
**Estimated time:** genuinely unclear until Davin resolves the OAuth question below — likely
multi-session regardless of variant boundaries
**Target service:** monolith (Next.js routes + ~19 UI consumers) · **Contract:** operation-service's
already-frozen `/auth/*` + `/2fa/*` surface (built Sessions 3-1 through 3-5, F6/F7/F24-F27)

## Background — this session's own audit found far more already built than the playbook's

one-line description ("retire `[...nextauth]`, swap login/register forms... delete
`auth-options.ts`") suggests. Read this in full before drafting Ordered Steps — several of the
"BUILD" items the playbook implies are already done.

**1. `operation-service` already has a complete credentials-based auth API**
(`operation-service/src/auth/auth.controller.ts`): `POST /auth/register`, `/login`, `/refresh`,
`/logout`, `/forgot-password`, `/reset-password`, `/resend-verification`, plus a full 2FA surface
in `two-factor.controller.ts`. All issue/verify NextAuth-compatible JWEs (F24) via
`next-auth-jwt.util.ts`/`next-auth-jwt-encode.util.ts` — the same format `getServerSession`/
`next-auth/jwt`'s `getToken()` already read.

**2. The monolith already has a full set of dormant, parallel "bridge" routes** under
`app/api/auth/token-*` — built in a prior session (F24-F27's resolution), confirmed by reading
`app/api/auth/token-login/route.ts` directly: it calls `operation-service`'s `/auth/login` and
stores the result under **NextAuth's own cookie name** (F26,
`lib/operation-service/cookies.ts`'s `SESSION_COOKIE_NAME`/`REFRESH_COOKIE_NAME`), so existing
session-reading code accepts it unmodified. Its own header comment states explicitly: _"Not wired
into `components/auth/login-form.tsx` — that stays on `next-auth/react`'s `signIn()` until a
dedicated cutover session flips it."_ **This session is that dedicated cutover session.**
Confirmed present: `token-login`, `token-refresh`, `token-logout`, `token-verify-email`,
`token-resend-verification`, `token-2fa-status`, `token-2fa-setup`, `token-2fa-verify-setup`,
`token-2fa-verify`, `token-2fa-backup-codes`, `token-2fa-disable`, `token-forgot-password`,
`token-reset-password` (13 routes).

**3. `middleware.ts` (66 lines, Session 3-3's "first middleware.ts this repo has ever had") is
already bridge-safe by design** — it reads the SAME cookie name/format regardless of which login
path issued it, per its own header comment. It deliberately excludes `/admin/:path*` (a separate,
non-route-group login page with its own guard). Nothing here should need to change for the
cutover itself; re-verify this holds at DRAFT/CONFIRM time, don't assume from this note.

**4. A genuine, un-built gap found this session: no `token-register` route exists.** The monolith
has `app/api/auth/register/route.ts` (the OLD, monolith-native Prisma-backed register handler)
but no `token-register` bridge equivalent — despite `operation-service`'s `POST /auth/register`
already existing (`auth.controller.ts:44-46`, `AuthService.register()`). This matches the
recorded reason: `DECISION-LOG.md`/this file's own Open-flags summary notes **F27** deferred
`/auth/register` routing "until email-sending is ported." **Email-sending is now fully ported**
(Session 3-4/F29 for `email.ts`, Session 4A-11 for `subscription-emails.ts`'s live types,
confirmed again this session, 4B-19) — F27's stated blocking condition appears satisfied. Building
`token-register` (mirroring `token-login`'s own shape) looks like real, in-scope, low-risk PORT
work for this session — re-verify F27's exact resolution text in `DECISION-LOG.md` before treating
this as settled; it's this PRE-DRAFT's own reading of "email-sending ported," not a re-confirmed
Davin decision.

**5. A NEW, more significant gap found this session — needs Davin's decision before Ordered Steps
can be written: `lib/auth/auth-options.ts` (583 lines) configures THREE conditional OAuth
providers** (`GoogleProvider`, `TwitterProvider`, `LinkedInProvider`, each gated on its own
`isXConfigured` env-var check) **on top of the `CredentialsProvider`**.
`components/auth/social-auth-buttons.tsx` renders all three as real sign-in buttons via
`next-auth/react`'s `signIn('google'|'twitter'|'linkedin', ...)`. **`operation-service`'s
`AuthController` has zero OAuth support of any kind — credentials only.** The playbook's own
framing ("retire `[...nextauth]`... delete `auth-options.ts`") would silently break OAuth login
for any real user who signed up via Google/Twitter/LinkedIn, with no equivalent path to fall back
to. Three real options, not this PRE-DRAFT's call to make:

- **Option A:** build OAuth support into `operation-service` (a genuinely new capability —
  NextAuth's OAuth dance, provider token exchange, account-linking semantics — not a port of
  existing behavior, since `operation-service` has never done this).
- **Option B:** keep a narrow `[...nextauth]` route alive indefinitely, scoped to OAuth
  providers only (remove `CredentialsProvider` from it once credentials fully cut over) — "retire
  NextAuth" becomes "retire NextAuth's credentials path," not a full deletion.
- **Option C:** confirm real OAuth usage is negligible (needs a live user-count check — how many
  `User` rows have a non-null OAuth `Account` relation, if the schema tracks it) and deprecate the
  feature outright, removing the buttons and the providers together.
  No file should be touched under any option until Davin picks one — this is the session's own
  Entry Criterion 0.

**6. The real UI swap surface is 19 files** (`next-auth/react` imports, `grep`-confirmed):
`app/(dashboard)/settings/{page,billing/page,security/page,account/page,profile/page}.tsx`,
`app/(marketing)/pricing/page.tsx`, `app/checkout/page.tsx`, `app/(auth)/verify-2fa/page.tsx`,
`app/providers.tsx` (almost certainly wraps the app in NextAuth's `<SessionProvider>` — removing
it changes what every `useSession()` call below it can see; this is the highest-leverage single
file in the whole swap), `app/admin/login/page.tsx` (separate bespoke login page,
`middleware.ts` deliberately doesn't guard it), `components/notifications/{notification-bell,
notification-list}.tsx`, `components/charts/{trading-chart,drawing/DrawingLayer}.tsx`,
`components/layout/header.tsx`, `components/auth/{login-form,social-auth-buttons}.tsx`. Most
likely only need `useSession()`→ a replacement session read and `signOut()`→ a call to
`token-logout`; `login-form.tsx` and `social-auth-buttons.tsx` are the two doing real
authentication actions. **Not yet determined: what replaces `next-auth/react`'s client-side
`useSession()`/`SessionProvider` once `auth-options.ts` is gone** — a thin custom auth-context
hook backed by a "who am I" read (an existing or new lightweight endpoint), or keeping a minimal
`SessionProvider` shim purely for its client ergonomics while the actual sign-in/sign-up/sign-out
ACTIONS move to the token-\* routes. This is a real architecture decision for the Advisor's DRAFT,
not something to guess at here.

## Entry criteria — this session cannot proceed past Step 0 without Davin's decisions

- [ ] **Entry Criterion 0 (blocking, per Finding 5):** Davin picks Option A/B/C for OAuth handling
      before any code is touched.
- [ ] Re-verify Findings 1-4 and 6 above are still accurate at DRAFT/CONFIRM time — this
      PRE-DRAFT's own audit is dated 2026-08-03; re-run the same greps, don't assume no drift
      (per this repo's own standing L27 discipline — order text has drifted from its own cited
      ground truth before, more than once).
- [ ] `DECISION-LOG.md`'s F27 entry re-read in full to confirm "email-sending ported" is
      genuinely the condition that was deferred on, before building `token-register`.
- [ ] A rollout mechanism decided: gate the UI swap behind a flag (e.g. a client-readable
      `NEXT_PUBLIC_AUTH_BRIDGE_ENABLED`, allowing a staged rollout / instant rollback the same
      way every server-side `MIGRATE_*` flag in this migration has worked) vs. a single atomic
      swap with `git revert` as rollback (matching how some UI-only changes in this repo have
      shipped). Recommend the flag approach for consistency with this migration's own established
      pattern and because auth is the single highest-blast-radius surface in the whole app — but
      this is the Advisor's/Davin's call, not decided here.

## Rules specific to this session

- **Zero traffic cutover in 4B-20** — `auth-options.ts`/`[...nextauth]` keep serving 100% of real
  login/register/OAuth/2FA/password-reset traffic throughout. 4B-20 builds and verifies; 4B-21
  (a separate order, drafted once 4B-20 closes) executes the actual swap, matching every prior
  BUILD-then-CUTOVER pair in this migration (4B-5/6/7, 4A-9/10a/10b, etc.).
- **Do not touch `middleware.ts` or cookie name/format/TTL semantics** without explicit escalation
  — per `EXECUTOR-PROTOCOL.md` §7, this is auth semantics, always escalate immediately regardless
  of how minor the change looks.
- **Do not silently drop OAuth support** by building the credentials-path swap and leaving OAuth
  buttons dangling with no backing route — Entry Criterion 0 must be resolved first.
- Whatever session builds `token-register`: mirror `token-login`'s own established shape exactly
  (CSRF/origin validation, `forwardedRequestContext()`, `OperationServiceError` handling,
  cookie-setting via `lib/operation-service/cookies.ts`'s helpers) — don't invent a new pattern
  for one more route in the same family.

## Done when (4B-20 BUILD scope — 4B-21's own Done-when is drafted separately)

- [ ] Entry Criterion 0 resolved and recorded in `DECISION-LOG.md` (new F-number if it's a genuine
      open architecture question, which OAuth handling is)
- [ ] `token-register` built, tested, zero traffic (dormant/parallel, matching every other
      `token-*` route's current state)
- [ ] The UI-swap approach (session mechanism, `SessionProvider` replacement) decided and at least
      prototyped against one real consumer (recommend `login-form.tsx`, the highest-value/
      highest-risk single file) before committing to the full 19-file swap
- [ ] `operation-service` test suite green, monolith `test:ci` green, `tsc --noEmit` clean both
      sides, `eslint --max-warnings 0` clean

## Deviations

_(empty — filled during execution once this order reaches DRAFT → APPROVED → CONFIRMED)_

## Known wrinkles / do-not-touch

- `app/admin/login/page.tsx` is a separate, bespoke login page outside `middleware.ts`'s own
  guard scope (by deliberate prior-session design, documented in `middleware.ts:48-58`) — decide
  explicitly whether it's in this session's swap scope or stays on `next-auth/react` longer;
  don't let it get swept up implicitly by a blanket "replace all `next-auth/react` imports" pass.
- `market_data_v6`/`flask-api` (carried forward from 4B-18d) and the CLAUDE.md session-history
  hygiene backlog (carried forward from 4B-19, Waiting-on #102) are both unrelated to this
  session — do not scope-creep into either here.

## Next-session handoff

- Once 4B-20 (this order, once DRAFTed/APPROVED/executed) closes: PRE-DRAFT **4B-21 (Auth
  CUTOVER)** — flip whatever rollout mechanism 4B-20 built, verify end-to-end on every swapped
  surface (credentials login, register, 2FA setup/verify/disable/backup-codes, password
  forgot/reset, email verification/resend, logout, and whichever OAuth outcome Entry Criterion 0
  produced), then retire `[...nextauth]`/`auth-options.ts` (in full or in part, per that same
  decision). This is the literal final domain session before **4B-22 (Phase 4 exit review)**.
