# Migration Order — Session 9-3 — `(auth)` 7 + `welcome`

> For sessions that **build or redesign frontend surfaces**: read `00-SKELETON-AND-RULES.md`
> first — §4 applies with the dial at **High** for page-body content/layout, **Zero** on data
> (every page binds to the endpoint its 9-0 row names).
> Upgraded to full **DRAFT** by Antigravity (Advisor & Architect), 2026-08-22.
> Grounded in `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`. Exactly one
> `layout.tsx` moves this session: `app/(auth)/layout.tsx`.

**Session:** 9-3 · **Phase:** 9 (Frontend Stack Replacement) · **Variant:** UI-BUILD · **Status:** CLOSED SUCCESSFUL
**Generated:** 2026-08-22 (Executor PRE-DRAFT) · **Upgraded:** 2026-08-22 (Advisor DRAFT) · **Approved:** 2026-08-22 (Davin) · **Confirmed:** 2026-08-22 (Executor — L3 authenticity re-verified live with Davin; full entry-criteria + sequential test baselines re-verified live: monolith tsc/eslint/test:ci 160/160-2400/2400, money-service 62/62-526/526, operation-service 42/42-393/393, all green)
**Flags touched:** none new (`NEXT_PUBLIC_AUTH_BRIDGE_ENABLED` already live per `DECISION-LOG.md` **F56**)
**Surface:** Exactly one layout boundary moves this session: `app/(auth)/layout.tsx` + 7 auth page bodies (`login`, `register`, `forgot-password`, `reset-password`, `verify-2fa`, `verify-email`, `verify-email/pending`) + 1 post-registration onboarding page (`welcome`).
**Feeds on:** NextAuth `/api/auth/[...nextauth]` (credentials + Google/Twitter OAuth providers, live in production per F56), `POST /api/auth/token-login`, `POST /api/auth/track-login`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `POST /api/user/2fa/verify`, `POST /api/auth/resend-verification`, `GET /api/auth/verify-email`, `components/auth/{login-form,register-form,social-auth-buttons}.tsx`, `components/providers/appearance-provider.tsx`.
**Estimated time:** ~3h - 3.5h (8 Medium-sized auth pages, standard UI-BUILD scope).

---

## Decisions taken

1. **`/welcome` Layout Boundary & Onboarding Architecture (Resolution of Open Question 1)**
   - **Decision:** Place `/welcome` at `app/(auth)/welcome/page.tsx` (URL: `/welcome`). Build `app/(auth)/layout.tsx` as a focused, elegant auth wrapper (DavinTrade top logo, radial ambient backdrop, responsive card container) with NO aggressive server-side session redirect that would obstruct post-registration onboarding.
   - **What was rejected:** Creating a separate root-level layout or splitting `/welcome` into a separate route group.
   - **Rationale:** Aligns directly with `frontend-swap-route-map.md` row 95. Keeping `/welcome` under `(auth)` unifies the onboarding funnel while sharing the styled auth shell.
   - **Undo Cost:** Low.

2. **Preserve Real NextAuth & OAuth Bridge Semantics (Resolution of Open Question 2)**
   - **Decision:** Port codebase 2's modern visual card design, gold/amber badge accents, and `useLocale()` translations into `components/auth/*` while strictly preserving the monolith's real NextAuth `signIn('credentials', ...)`, `signIn('google', ...)`, `signIn('twitter', ...)`, and `isAuthBridgeEnabled()` / `/api/auth/token-login` logic.
   - **What was rejected:** Porting codebase 2's mock `setTimeout(...)` simulation logic from `seed-code/`.
   - **Rationale:** Codebase 2's auth components were mock prototypes. The monolith already contains fully hardened, production-tested NextAuth and Auth-bridge handlers. Zero mock data is maintained.
   - **Undo Cost:** High if regressed; zero with clean restyling.

3. **Sequential Auth Flow & 2FA State Integrity (Resolution of Open Question 3)**
   - **Decision:** Preserve the exact sequential auth state machine across all 7 auth routes:
     - Invalid credentials $\rightarrow$ `invalid` error alert with inline retry.
     - Unverified email $\rightarrow$ `unverified` status with link to `/verify-email/pending` + resend verification button.
     - 2FA required $\rightarrow$ redirect to `/verify-2fa?token=...` $\rightarrow$ 6-digit TOTP verification $\rightarrow$ session established $\rightarrow$ redirect to `/dashboard`.
     - New registration $\rightarrow$ `/register` $\rightarrow$ `/welcome` onboarding (or `/verify-email/pending` if email verification required).
   - **What was rejected:** Modifying the backend auth contract or changing parameter query names.
   - **Rationale:** Maintains 100% compatibility with `operation-service` and existing session cookies.
   - **Undo Cost:** Low.

4. **Quick-Fill Test Credentials Helper Preservation**
   - **Decision:** Retain the quick-fill test credential helper in `components/auth/login-form.tsx` (PRO, FREE, ADMIN preset buttons) with updated DavinTrade styling.
   - **What was rejected:** Removing the test credential helper buttons.
   - **Rationale:** Unblocks instant interactive verification across all roles (PRO, FREE, ADMIN) in local dev and staging environments without impacting production authentication security.
   - **Undo Cost:** Low.

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §3: this session replaces all legacy "Trading Alerts" authentication pages with DavinTrade branding, binding directly to the real NextAuth bridge and OAuth providers.

**Shipping this session unblocks live authenticated testing for every subsequent Phase 9 session** (Dashboard core, alerts, settings, checkout, and admin panel).

`frontend-swap-route-map.md` assigns this session 8 rows (65, 67, 71, 72, 88, 89, 90, 95), covering all pre-session and post-registration flows.

---

## Entry criteria (re-verify all at CONFIRM)

- [x] **Session 9-2 CONFIRMED, executed, CLOSED** — `(marketing)` and `(public)` pages live on `main`, route-manifest diff clean.
- [x] **Route-map rows 65, 67, 71, 72, 88, 89, 90, 95 re-verified directly** against `frontend-swap-route-map.md`.
- [x] **`app/(auth)/*` confirmed existing** and holding legacy page bodies; `app/(auth)/welcome/` confirmed ready for creation.
- [x] **`DECISION-LOG.md` F56 re-confirmed RESOLVED & EXECUTED** (OAuth bridge and NextAuth endpoints live).
- [x] **Backing endpoints live and functional**:
  - `POST /api/auth/[...nextauth]`
  - `POST /api/auth/token-login`
  - `POST /api/auth/track-login`
  - `POST /api/auth/forgot-password`
  - `POST /api/auth/reset-password`
  - `POST /api/user/2fa/verify`
  - `POST /api/auth/resend-verification`
  - `GET /api/auth/verify-email`
- [x] **Sequential test suite baselines green** (`LESSONS-LEARNED.md` L24):

  ```powershell
  # 1. Monolith
  npx tsc --noEmit
  npx eslint app components lib hooks --max-warnings 5
  npm run test:ci

  # 2. Money service
  cd money-service; npm test; cd ..

  # 3. Operation service
  cd operation-service; npm test; cd ..
  ```

---

## Ordered steps

1. **Build `app/(auth)/layout.tsx`**
   - Replace legacy `Trading Alerts` centered layout with DavinTrade auth layout shell.
   - Render DavinTrade logo header, ambient radial gradient backdrop, and responsive container.
   - _Verify:_ `npx tsc --noEmit` clean; renders cleanly around existing auth pages without double chrome.

2. **Restyle Real Auth Form Components (`components/auth/*`)**
   - Update `components/auth/login-form.tsx`: Apply DavinTrade styling and `useLocale()` translations while preserving real NextAuth `signIn('credentials', ...)`, Auth-bridge, 2FA token redirection, and quick-fill test credentials.
   - Update `components/auth/register-form.tsx`: Apply DavinTrade styling, password strength indicator, and real `POST /api/auth/register` binding.
   - Update `components/auth/social-auth-buttons.tsx`: Apply modern social button styling while keeping real `signIn('google', ...)` and `signIn('twitter', ...)`.
   - _Verify:_ `npx tsc --noEmit` clean; all validation and submission handlers intact.

3. **Port and Restyle Auth Pages (Rows 65, 67, 71, 72, 88, 89, 90)**
   - `app/(auth)/login/page.tsx` (Row 65): Mount restyled `LoginForm`.
   - `app/(auth)/register/page.tsx` (Row 67): Mount restyled `RegisterForm`.
   - `app/(auth)/forgot-password/page.tsx` (Row 71): Port DavinTrade forgot-password UI, bound to `POST /api/auth/forgot-password`.
   - `app/(auth)/reset-password/page.tsx` (Row 72): Port DavinTrade reset-password UI with token parameter handling, bound to `POST /api/auth/reset-password`.
   - `app/(auth)/verify-2fa/page.tsx` (Row 88): Port DavinTrade 2FA verification UI with 6-digit TOTP input, bound to `POST /api/user/2fa/verify`.
   - `app/(auth)/verify-email/page.tsx` (Row 89): Port DavinTrade email verification confirmation UI, bound to `GET /api/auth/verify-email`.
   - `app/(auth)/verify-email/pending/page.tsx` (Row 90): Port DavinTrade pending email verification UI with resend button bound to `POST /api/auth/resend-verification`.
   - _Verify:_ `npx tsc --noEmit` clean; all 7 auth pages compile with zero type errors.

4. **Port `/welcome` Onboarding Page (Row 95)**
   - Create `app/(auth)/welcome/page.tsx` from codebase 2.
   - Implement the 3-step onboarding flow: (1) Feature intro, (2) Theme accent selection via `useAppearance()`, (3) Workspace launcher linking to `/terminal`, `/free`, or `/dashboard`.
   - _Verify:_ `/welcome` renders all 3 steps interactively, correctly mutates theme accents, and navigates to workspaces.

5. **Live Authenticated Click-Through & Verification**
   - Test live authentication flow using quick-fill test credentials (PRO, FREE, ADMIN).
   - Verify successful login redirects to `/dashboard` (or `/free` / `/admin`).
   - Test password reset, 2FA verification, and registration transitions.
   - _Verify:_ No console errors, sessions persist across reloads.

6. **Route-Manifest Diff & Test Suites Verification**
   - Verify route-manifest diff: exactly 8 rows in scope (`/welcome` added; 7 auth pages updated; zero stray routes).
   - Run sequential test baselines:
     ```powershell
     npx tsc --noEmit
     npx eslint app components lib hooks --max-warnings 5
     npm run test:ci
     ```

---

## Rules specific to this variant

- **UI Creativity:** High for form presentation, feedback animations, accent highlights, and onboarding steps.
- **Zero Mock Data:** Real NextAuth, 2FA, token verification, and profile endpoints must be used — no mock `setTimeout` logins.
- **Auth Semantics Escalate:** Any changes to cookies, JWT handling, session lifetimes, or security headers escalate to Davin.
- **Accessibility:** Form input labels (`aria-label`, `<Label htmlFor>`), `aria-live` error announcements, focus trap on validation failure.
- **Record Design Decisions:** Document all restyled component decisions in the Deviations section at close.

---

## Done when

- [x] All 7 `(auth)` pages and `/welcome` live with DavinTrade branding, consuming `app/(auth)/layout.tsx`.
- [x] Real login (credentials + OAuth), registration, password reset, 2FA verification, and email verification working end-to-end.
- [x] `/welcome` 3-step onboarding page fully interactive and updating theme settings via `useAppearance()`.
- [x] No double-chrome or duplicate header regressions on any auth page.
- [x] Route-manifest diff matches this session's 8 rows and nothing else.
- [x] `npx tsc --noEmit`, `npx eslint app components lib hooks --max-warnings 5`, and `npm run test:ci` all pass clean.

---

## Rollback

`git revert` of this session's commits. Prefer one commit per logical step (layout update, form components restyle, auth pages, welcome page) so individual changes can be isolated. Verify auth flows remain operational after rollback.

---

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

1. **L3 pattern recurred again at CONFIRM (22nd+ recurrence).** Committed `HEAD` held only the
   bare Executor PRE-DRAFT; the working copy carried the full Advisor DRAFT → Davin APPROVED
   upgrade. Davin confirmed live it was his authentic edit before execution began. All three of
   the PRE-DRAFT's own Open Questions were independently re-verified against live code at CONFIRM
   (`/welcome` placement, `social-auth-buttons.tsx`'s real-vs-mock split, the 2FA/email-verification
   branch order) — all matched the DRAFT's resolutions.

2. **`verify-2fa` and `forgot-password`: seed-code's own page bodies were mock prototypes, not
   restyle-ready UI — not ported as-is.** `seed-code`'s `verify-2fa/page.tsx` never calls
   `POST /api/user/2fa/verify` at all (a bare `setTimeout` → `/dashboard`, no backup-code support,
   no bridge branching); its `forgot-password/page.tsx` never calls any endpoint (`handleSubmit`
   just flips local state). Same "restyle-looks-complete-but-is-mock" pattern 9-2 hit three times
   over. Both pages instead restyle the monolith's own real implementations (bridge-aware fetch
   branching, backup codes, per-digit auto-advance inputs, rate-limit countdown, the 4-step
   forgot-password state machine) with DavinTrade visuals borrowed from seed-code's design
   language. Zero mock data shipped.

3. **`verify-email`'s success CTA does not link to `/welcome`, despite seed-code's own version
   doing exactly that.** Email verification runs before any session exists (confirmed by reading
   `lib/auth/auth-options.ts` and the endpoint's own code comments); `/welcome` is `SESSION
REQUIRED` per its own route-map row. Routing a freshly-verified, still-unauthenticated visitor
   there would strand them. Kept the real, correct target: `/login` ("Continue to Sign In").

4. **`/welcome` step 1 feature copy replaced, not ported verbatim.** Seed-code's copy names a
   "Davin AI Quantitative Chat Copilot ... instant market context via floating widget" —
   `components/chat-widget/*` was explicitly deferred to Phase 14 at Session 9-1 and is not
   mounted anywhere in the tree. Swapped for two capabilities that are actually live today:
   real-time XAUUSD price alerts and the drawing-tools/line-alert engine (migrated Sessions
   4B-2/3/5/6/7/8).

5. **`/welcome`'s accent picker is wired to the real `AccentScheme` type and the real appearance
   backend**, not a local-only `updateSettings()` call like seed-code's version. Confirmed
   `lib/appearance/types.ts`'s `AccentScheme` ('amber'|'emerald'|'blue'|'purple') matches
   seed-code's four hardcoded options exactly, so no invented values were needed. Added a
   `saveSettings()` call alongside `updateSettings()` so the onboarding choice actually persists
   past the session (live-verified: `POST /welcome` 200, real `UserAppearance` Prisma write in
   the dev server log) — seed-code's version only ever mutated local React state.

6. **`/welcome` gates on session client-side (`useSession()` + soft redirect), not server-side.**
   Matches Decision 1's explicit instruction ("NO aggressive server-side session redirect that
   would obstruct post-registration onboarding"). Live-verified: an authenticated PRO test user
   sees the real 3-step flow end-to-end; `useSession()` status is checked before rendering the
   step content.

7. **`/welcome`'s workspace launcher links to `/terminal` and `/free` — neither exists until
   Session 9-4 (immediately next).** The order's own step 4 names these as the required targets.
   Live-verified the interim state is a clean landing on the real `not-found.tsx` (built 9-1), not
   a crash — a disclosed, one-session gap rather than a broken link, and not something 9-3 can
   close on its own since building those pages is 9-4's own scope.

8. **A real, pre-existing a11y gap found and fixed while restyling `reset-password/page.tsx`:**
   both password `<label>` elements (ported from seed-code's own markup) had no `htmlFor`/`id`
   association to their inputs at all — same defect class 9-2's `/docs` fix addressed. Added
   `id="password"` / `id="confirmPassword"` and matching `htmlFor`. Directly required by this
   order's own "Rules specific to this variant" accessibility line.

9. **A genuine test regression found and fixed at Step 6, not just discovered and left:** adding
   `useLocale()` to `login-form.tsx`, `register-form.tsx`, and 5 of the 7 auth pages broke 4
   pre-existing suites (`login-form.test.tsx`, `register-form.test.tsx`, `auth-verify-2fa.test.tsx`,
   `auth-bridge-endpoint-swaps.test.tsx` — 21 tests), all on the identical `useLocale must be used
within a LocaleProvider` error. This is `LESSONS-LEARNED.md` L40's exact failure class, now
   recurring a 3rd time (9-1, 9-2, 9-3) — L40 amended with a recurrence note rather than a new
   entry (file is at its 40-entry cap). Fixed forward per `test:ci` must-never-go-backwards: wrapped
   every render in a real `LocaleProvider`, pre-seeded `localStorage` with `defaultPreferences` so
   `LocaleProvider`'s own geo-IP `fetch()` never fires (safer than L40's reject-mock recipe for
   these specific files, since several of their own tests assert exact `global.fetch` call
   counts/args), and added the sibling `usePathname: () => '/'` stub `LocaleProvider` itself needs.
   Two assertions genuinely needed updating, not reverting, to match this session's own intentional
   design changes: `reset-password`'s submit button reads "Update Password" now (was "Reset
   Password" pre-session — seed-code's own copy), and its query switched from
   `getByPlaceholderText` to `getByLabelText` now that Deviation 8's fix gives it a real accessible
   label. All 21 tests pass again; full monolith `test:ci` re-verified at 160/160 suites, 2400/2400
   tests, exact match to entry-criterion baseline.

10. **`social-auth-buttons.tsx`'s "mocked" characterization (Decision 2) verified, not inherited.**
    Read both trees directly: the main repo's own copy already calls real `signIn()`/
    `getProviders()` from `next-auth/react` — only `seed-code`'s copy is a prototype. Restyled the
    real component; nothing to "make real" that wasn't already real.

11. **Waiting-on #117 (test credentials) confirmed de facto resolved, not still-open as the
    PRE-DRAFT's own entry criterion implied.** `components/auth/login-form.tsx` already ships real
    quick-fill buttons wired to seeded accounts (`app/api/test/seed/route.ts`), and Session 9-1's
    own CONFIRM already used them live for 3 Protected-page logins. Live-verified again this
    session: PRO test user login → real `/dashboard` render with genuine Prisma-backed alert/
    appearance data. Never formally closed in `DECISION-LOG.md`'s own register — flagged as a
    housekeeping gap for Davin, not a blocker this session hit.

---

## Next-session handoff

- **Next session:** `9-4` — `(dashboard)` core 7 + `/terminal` + `/free` (UI-BUILD).
  - Scope: Port the dashboard layout boundary (`app/(dashboard)/layout.tsx`), dashboard home, alerts list, alert creation/edit, notifications, plus the two new chart workspaces (`/terminal` and `/free`).
  - Integrates real chart data, live alerts API, and drawing toolbar.
  - Owns gap-6e residual (`chat-panel.tsx`, `market-comments-panel.tsx`, `settings/layout.tsx` Light Clean Mode token fixes).
- **Prerequisite:** Session 9-3 CLOSED — auth pages live, live login verified, route-manifest diff clean.
- **9-3 obligation carried to close:** PRE-DRAFT Session 9-4's migration order per `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`.
