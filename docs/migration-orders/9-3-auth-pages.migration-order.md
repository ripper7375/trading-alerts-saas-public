# Migration Order — Session 9-3 — `(auth)` 7 + `welcome`

> For sessions that **build or redesign frontend surfaces**: read `00-SKELETON-AND-RULES.md`
> first — §4 applies with the dial at **High** for page-body content/layout, **Zero** on data
> (every page binds to the endpoint its 9-0 row names). **PRE-DRAFTed by the Executor at Session
> 9-2's close (2026-08-22)**, informed by `frontend-swap-route-map.md` and 9-2's own Deviations.
> Per PD1, `Decisions taken` below is deliberately left as open questions with evidence, not
> decisions — that's the Advisor's job at DRAFT.

**Session:** 9-3 · **Phase:** 9 (Frontend Stack Replacement) · **Variant:** UI-BUILD (dial HIGH
for page bodies, ZERO on data) · **Status:** PRE-DRAFT
**Generated:** 2026-08-22 (Executor, at Session 9-2's close) · **Flags touched:** none new
**Surface:** `app/(auth)/{login,register,forgot-password,reset-password,verify-2fa,verify-email,
verify-email/pending}/page.tsx` (7 pages, route group already exists, currently holds the OLD
"Trading Alerts" page bodies) · `app/(auth)/welcome/page.tsx` (1 page — see Open Question 1 on
whether `(auth)` is the right layout boundary) · `app/(auth)/layout.tsx` (the layout boundary
this session moves — currently a bare, un-rebranded wrapper with no session-aware guard logic at
all; see Open Question 2).
**Feeds on:** NextAuth `/api/auth/[...nextauth]` (credentials + Google/Twitter OAuth providers,
already live in production per `DECISION-LOG.md` **F56**, RESOLVED & EXECUTED Session 4B-21),
`/api/auth/track-login`, `/api/auth/forgot-password`, `/api/auth/reset-password`,
`/api/user/2fa/verify`, `/api/auth/resend-verification`, `/api/auth/verify-email`. Existing real
form components: `components/auth/{login-form,register-form,social-auth-buttons}.tsx` (plus
`login-tracker.tsx`, `token-refresh-provider.tsx` — no seed-code counterpart, not to be touched).

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §3: this session binds to the real NextAuth bridge and OAuth
providers — **it unblocks live authenticated testing for every Phase 9 session after it.**
Waiting-on #117 (no test credentials) becomes an active requirement starting here, per Session
9-0's own scoping (9-0 through 9-2 were explicitly allowed to proceed on NON-LOGIN/design-contract
grounds; 9-3 is where that exemption ends). `frontend-swap-route-map.md` assigns this session 8
rows (65, 67, 71, 72, 88, 89, 90, 95), all Medium effort, all `NON-LOGIN (pre-session)` auth gate.

---

## Decisions taken

<!-- Left as open questions with evidence, not decisions — PD1: the Advisor decides from
     documents at DRAFT, not the Executor at PRE-DRAFT. -->

**Open Question 1 — is `(auth)/layout.tsx` the right home for `/welcome`, given live code shows
no guard logic to fight in the first place?** The route-map's own §3 addendum (Session 9-0) flagged
this as a judgment call needing revisit: `/welcome` is codebase 1's ticketed page (B2-13,
Phase 6), placed under `(auth)/layout.tsx` "as the auth-funnel's terminal step" with the caveat
"revisit if 9-3 finds the auth layout's own guard fights a post-registration/pre-dashboard state."
Live `ls` this session shows `app/(auth)/welcome/` does not exist yet in the main repo (new page),
and reading the CURRENT `app/(auth)/layout.tsx` in full shows it has **no session-aware guard at
all** — no `getServerSession`, no redirect-if-authenticated, just a static centered-card wrapper.
So the specific fight the route-map worried about doesn't exist in the code as it stands today —
but that doesn't settle the question, because this session is about to REPLACE this layout file
(seed-code has no `(auth)/layout.tsx` of its own at all — each of its 7 auth pages is
self-contained, no shared wrapper — so the new layout is built from scratch, not ported line-for-
line like 9-2's `(marketing)/layout.tsx` was). Whatever guard behavior the new layout gets (if
any — e.g. redirecting an already-logged-in user away from `/login`) needs to be designed with
`/welcome` in mind from the start, not discovered after the fact. Recommend deciding at DRAFT
whether `/welcome` stays under `(auth)` or moves to a standalone root page, and if it stays,
whether the new layout's own guard logic (if any is added) explicitly exempts it.

**Open Question 2 — `social-auth-buttons.tsx`'s "mocked" characterization needs re-verification,
not inheritance.** The roadmap's own 9-3 scope line says "codebase 2's mocked
`social-auth-buttons.tsx` becomes real" — but this PRE-DRAFT has not yet read either version's
actual implementation (component exists in both trees: `components/auth/social-auth-buttons.tsx`
in the main repo already, and a same-named file in `seed-code/`). Per `LESSONS-LEARNED.md` L22
("order text drifts from ground truth — always read SOURCE directly"), whoever executes this
session should diff both versions directly before assuming the roadmap's one-line characterization
is still accurate, rather than trusting it secondhand (the same failure class L39 named at 9-0/9-1
— a citation read instead of the source itself).

**Open Question 3 — verify-2fa/verify-email flow order against the real `User`/2FA schema before
porting page bodies.** This PRE-DRAFT did not read `lib/auth/auth-options.ts` or the 2FA data
model in enough depth to state with confidence whether `/verify-2fa` and `/verify-email` are
mutually exclusive branches of one login attempt or can both apply to the same user in sequence —
seed-code's page bodies should be checked against the real flow before deciding whether they need
to redirect into each other (e.g., an unverified-email user with 2FA enabled: which screen do they
see first, and does either ported page need to know about the other's state).

---

## Entry criteria (re-verify all at CONFIRM)

- [ ] Session 9-2 CONFIRMED, executed, CLOSED — `(marketing)`/`(public)` pages live, route-
      manifest diff clean.
- [ ] **Route-map rows 65, 67, 71, 72, 88, 89, 90, 95 re-read directly** (not this PRE-DRAFT's
      paraphrase) — confirm no further drift beyond Open Questions 1-3 above.
- [ ] **`app/(auth)/*` confirmed still holding the OLD page bodies** (i.e., no other session
      touched them between 9-2's close and this session's start) — `app/(auth)/welcome/`
      confirmed still not existing (new page, not a port-in-place).
- [ ] `DECISION-LOG.md` **F56** re-confirmed RESOLVED & EXECUTED (OAuth bridge live in
      production) — re-verify the register still says so, don't just cite this PRE-DRAFT.
- [ ] All 7 backing endpoints (`/api/auth/[...nextauth]`, `/api/auth/track-login`,
      `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/user/2fa/verify`,
      `/api/auth/resend-verification`, `/api/auth/verify-email`) confirmed live and
      contract-tested (or staging-live).
- [ ] Sequential test suite baselines green (`LESSONS-LEARNED.md` L24) — monolith `tsc`/`npx
    eslint app components lib hooks --max-warnings 5`/`test:ci`, then money-service, then
      operation-service, run one at a time, not in parallel.
- [ ] **Test credentials confirmed available** (Waiting-on #117) — this is the session where the
      no-test-credentials gap becomes load-bearing; if still unresolved, this is a failed entry
      criterion, not a soft blocker — propose the fix or a session swap per
      `EXECUTOR-PROTOCOL.md` §1.

---

## Ordered steps

_(candidate — the Advisor may reorder/restructure freely per the UI-BUILD dial)_

1. **Resolve Open Questions 1-3 before touching any page file** — all three affect either which
   files this session edits or how the new `(auth)/layout.tsx` is designed.
2. **Build `app/(auth)/layout.tsx` from scratch** (no seed-code counterpart to port) — DavinTrade
   branding, consistent with `MarketingNavbar`/`MarketingFooter`'s design language from 9-1/9-2
   where it makes sense for an auth-funnel context (likely a lighter, logo-only header — no full
   nav). _Verify:_ `tsc` clean; renders around all 7 auth pages + `/welcome` without a double-
   chrome regression (Decision-3-style invariant, same class of bug 9-2 twice had to contain).
3. **Port the 7 auth pages' bodies from `seed-code/`**, preserving the main repo's REAL NextAuth/
   2FA/reset-password wiring in `components/auth/*` — this is a restyle-over-real-logic port, the
   same pattern 9-2 established three times over (landing pricing, `/status`, `/pricing`): seed-
   code's own copy may look complete but lacks live backend wiring codebase 1's real components
   already have. Grep both trees for hook/fetch/API-call differences before assuming a page is a
   pure visual swap (candidate lesson flagged in 9-2's own Deviation 11 — apply it here even
   though it hasn't been formally written to `LESSONS-LEARNED.md` yet).
4. **Build `/welcome`** (new page, no main-repo predecessor) per however Open Question 1 resolves.
5. **Live authenticated click-through** — the first real login/registration/2FA/password-reset
   flow test since Session 6-1b. Use whatever test credentials Davin has provided (entry
   criterion). This is the verification Waiting-on #117 has been blocking since 9-0.
6. **Route-manifest diff** — confirm exactly 8 rows' worth of URLs added/changed (`/welcome` is
   new; the other 7 already existed) and nothing else, per the roadmap's own per-session exit
   check.

---

## Rules specific to this variant

- **UI creativity: High** for page-body content/layout and the new `(auth)/layout.tsx` design —
  no Protected-page constraint applies (none of the 6 Protected pages are in this session's
  scope).
- **Zero on data:** every page binds to the real endpoint its own route-map row names — no
  fabricated 2FA/verification states, no mock login success.
- **Auth semantics escalate** (`EXECUTOR-PROTOCOL.md` §7) — this session touches live
  authentication flows directly. Any change to session/token/credential handling beyond what's
  needed to restyle the existing real components must stop and ask Davin, not be decided as a
  UI-BUILD creative call.
- A11y from the start — form labels, error announcements, focus management on validation
  failures (the account-deletion pages' `aria-live` pattern from 9-2 is a reusable reference).
- Record design decisions in Deviations — they inform 9-4 onward's own page-body work.

---

## Done when

- [ ] All 7 `(auth)` pages + `/welcome` live with DavinTrade content, consuming the new
      `app/(auth)/layout.tsx`.
- [ ] Real login (credentials + at least one OAuth provider), registration, forgot/reset-
      password, 2FA verification, and email verification all live-verified end-to-end with real
      test credentials — not just component-level unit tests.
- [ ] No double-chrome regression on any of the 8 pages.
- [ ] Route-manifest diff matches this session's own 8 rows and nothing else.
- [ ] `tsc`/`eslint`/`test:ci` (monolith, money-service, operation-service) all green.

---

## Rollback

`git revert` of this session's commits — no cutover flag (Phase 9 ships progressively on `main`
per F66). Prefer one commit per logical group (layout / 7 auth pages / welcome) so a bad step can
be reverted without losing the good ones. Auth-flow changes are higher-blast-radius than 9-2's
static content — verify revert leaves live login functional before considering rollback complete.

---

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

---

## Next-session handoff

- **Next session:** `9-4` — `(dashboard)` core 7 + `/terminal` + `/free` (UI-BUILD). dashboard,
  alerts, alerts/new, alerts/[id]/edit, notifications, plus the two new chart-workspace pages
  retiring the old ones. Stack D/E panels ship as flag-gated empty states, never mock data
  (Session 6-1b's own anti-pattern). Drawing toolbar and line-alert UI bind to live
  `operation-service` endpoints. Also owns the gap-6e residual (`chat-panel.tsx`,
  `market-comments-panel.tsx`, `settings/layout.tsx`'s Light Clean Mode fix, per 9-1's own
  Deviations) and F21/F64.
- **Prerequisite:** 9-3 CLOSED — auth pages live, real login verified, route-manifest diff clean.
- **9-3's own obligation carried to close:** PRE-DRAFT Session 9-4's migration order per
  `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`.
