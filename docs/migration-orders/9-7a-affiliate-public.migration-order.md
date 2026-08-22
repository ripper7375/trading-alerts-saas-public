# Migration Order — Session 9-7a — `app/affiliate/*` public onboarding

> For sessions that **build or redesign frontend surfaces**: read `00-SKELETON-AND-RULES.md`
> first — §4 applies with the dial at **High** for page-body content/layout, **Zero** on data
> (every page binds to the endpoint its 9-0 row names).
> Corrected & upgraded to full **DRAFT** by Antigravity (Advisor & Architect), 2026-08-22.
> Grounded in `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`.

**Session:** 9-7a · **Phase:** 9 (Frontend Stack Replacement) · **Variant:** UI-BUILD · **Status:** CLOSED SUCCESSFUL
**Generated:** 2026-08-22 (Executor PRE-DRAFT) · **Upgraded & Corrected:** 2026-08-22 (Advisor DRAFT) · **Approved:** 2026-08-22 (Davin) · **Confirmed & Executed:** 2026-08-22 (Executor)
**Flags touched:** none new (Affiliate program configuration active via F65/F66).
**Surface:** `app/affiliate/*` public/pre-affiliate cluster — 3 active pages: `app/affiliate/page.tsx` [Row 48, program landing], `app/affiliate/join/page.tsx` [Row 43, partner onboarding highlights], `app/affiliate/register/page.tsx` [Row 44, partner registration application] + retirement of legacy `app/affiliate/verify` [Row 47]. (Rows 45 & 46 are authenticated partner portal pages cleanly scoped to **Session 9-7b**).
**Feeds on:** `POST /api/affiliate/auth/register` (Row 44); Rows 43 and 48 are presentation surfaces with client-side interactive commission calculator and dynamic country/currency localization via `useLocale()`.
**Estimated time:** ~2.5h (3 public affiliate onboarding pages with DavinTrade design tokens + live registration API verification).

---

## Decisions taken

1. **Clean Scope Allocation: 9-7a Owns Rows 43, 44, 47 (Retired), 48 (Resolution of Open Question 1)**
   - **Decision:** Session 9-7a owns the 4 public onboarding rows (Row 48 `/affiliate`, Row 43 `/affiliate/join`, Row 44 `/affiliate/register`, and Row 47 retired `/affiliate/verify`). Rows 45 (`/affiliate/resources`) and 46 (`/affiliate/settings/payout`) require active affiliate authentication and are cleanly assigned to **Session 9-7b** alongside `app/affiliate/dashboard/*`.
   - **What was rejected:** Smearing authenticated portal pages across 9-7a or overloading a single 14-page session.
   - **Rationale:** Keeps Session 9-7a tightly focused on public discovery and partner application, comfortably within the ~2.5h-3h envelope.
   - **Undo Cost:** Low.

2. **Retirement of Legacy Row 47 (`/affiliate/verify`) (Resolution of Open Question 2)**
   - **Decision:** Delete the legacy `app/affiliate/verify` directory. In DavinTrade, `POST /api/affiliate/auth/register` activates the affiliate partner profile immediately and generates initial codes; no separate verification page exists in Codebase 2.
   - **What was rejected:** Retaining an orphaned directory.
   - **Rationale:** Matches Codebase 2's approved architecture.
   - **Undo Cost:** Low.

3. **Replace Legacy Redirect with Full Onboarding Page on `/affiliate/join` (Resolution of Open Question 3)**
   - **Decision:** Replace the legacy 1-line redirect (`redirect('/affiliate/register')`) on `/affiliate/join` (Row 43) with the full, rich DavinTrade partner onboarding highlights page from Codebase 2, featuring program highlights, commission tiers, and direct CTA button to `/affiliate/register`.
   - **What was rejected:** Leaving `/affiliate/join` as a bare redirect.
   - **Rationale:** Restores full marketing value and conversion funnel for prospective partners.
   - **Undo Cost:** Low.

4. **Interactive Commission Calculator & Localization on `/affiliate`**
   - **Decision:** In `app/affiliate/page.tsx` (Row 48), port the dynamic commission calculator (referral count slider, 30% recurring calculation) wired to `useLocale()` for live currency symbol formatting.
   - **What was rejected:** Static hardcoded USD text without interactive slider.
   - **Rationale:** High dial on presentation fidelity with theme-tokenized glassmorphism cards.
   - **Undo Cost:** Low.

5. **Real Registration API & Schema Mapping on `/affiliate/register`**
   - **Decision:** Wire `app/affiliate/register/page.tsx` (Row 44) to `POST /api/affiliate/auth/register`. Map the form fields directly to `affiliateRegistrationSchema` (`lib/affiliate/validators.ts`):
     - `fullName`: string (Partner / Channel name)
     - `country`: string (Country code or selection)
     - `paymentMethod`: `'WISE'`
     - `paymentDetails`: `{ email: wiseEmail }`
     - `socials`: `{ website, twitter, youtube, instagram, tiktok }`
     - `terms`: `true`
       _(Note: Unauthenticated visitors to `/affiliate/register` who submit will be prompted to log in / redirected to `/login?callbackUrl=/affiliate/register` so `requireAuth()` passes smoothly)._
   - **What was rejected:** Fake `setTimeout` local-only transitions or submitting unmapped fields.
   - **Rationale:** Strict Phase 9 zero-mock-data non-negotiable.
   - **Undo Cost:** Low.

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §3: `app/affiliate/*` spans 14 routes and 5 nested layouts. Splitting into 9-7a (public onboarding: `/affiliate`, `/affiliate/join`, `/affiliate/register`) and 9-7b (`affiliate/dashboard/*`) isolates the public partner discovery and registration funnel from the authenticated partner portal.

`frontend-swap-route-map.md` assigns this session rows 43 (`/affiliate/join`), 44 (`/affiliate/register`), 47 (retired `/affiliate/verify`), and 48 (`/affiliate` landing).

---

## Entry criteria (re-verify all at CONFIRM)

- [x] **Session 9-6 CONFIRMED, executed, CLOSED** — payments flow live on `main`, route-manifest diff clean.
- [x] **Route-map rows 43, 44, 47, 48 re-verified directly** against `frontend-swap-route-map.md`.
- [x] **`app/affiliate/page.tsx`, `app/affiliate/join/page.tsx`, `app/affiliate/register/page.tsx` confirmed existing** and read in full.
- [x] **`app/affiliate/verify` confirmed ready for retirement/deletion** with zero incoming links.
- [x] **`POST /api/affiliate/auth/register` confirmed live and contract-verified**.
- [x] **Sequential test suite baselines green** (`LESSONS-LEARNED.md` L24):

  ```powershell
  # 1. Monolith
  npx tsc --noEmit
  npx eslint app components lib hooks --max-warnings 5
  npm run test:ci

  # 2. Money service
  cd money-service; npm test -- --maxWorkers=1; cd ..

  # 3. Operation service
  cd operation-service; npm test; cd ..
  ```

---

## Ordered steps

1. **Port Affiliate Landing Page (`app/affiliate/page.tsx`, Row 48)**
   - Mount `<MarketingNavbar />` and `<MarketingFooter />`.
   - Port DavinTrade affiliate hero, value props, 30% recurring commission badges, and interactive earnings calculator with `Slider` and `useLocale()`.
   - _Verify:_ `npx tsc --noEmit` clean; slider updates estimated earnings in real-time.

2. **Port Partner Onboarding Highlights (`app/affiliate/join/page.tsx`, Row 43)**
   - Mount `<MarketingNavbar />` and `<MarketingFooter />`.
   - Replace legacy redirect with full Codebase 2 onboarding page: program highlights, payout methods overview (Wise/crypto), and primary CTA linking to `/affiliate/register`.
   - _Verify:_ `npx tsc --noEmit` clean; CTA links route cleanly.

3. **Port Partner Registration Form (`app/affiliate/register/page.tsx`, Row 44)**
   - Port DavinTrade partner registration card with form fields mapped to `affiliateRegistrationSchema` (fullName, country, Wise email, socials, terms).
   - Wire form submission to `POST /api/affiliate/auth/register`. If unauthenticated, redirect to `/login?callbackUrl=/affiliate/register`. On success (200/201), redirect to `/affiliate/dashboard`.
   - Ensure proper `<Label htmlFor="...">` accessibility on all inputs.
   - _Verify:_ `npx tsc --noEmit` clean; form validates required fields and dispatches real payload.

4. **Retire Legacy `/affiliate/verify` (Row 47)**
   - Remove legacy `app/affiliate/verify` directory.
   - Audit codebase to verify zero remaining references point to `/affiliate/verify`.
   - _Verify:_ No dead links remain; `git status` shows clean removal.

5. **Live Verification & Click-Through**
   - Public view: Visit `/affiliate` $\rightarrow$ interact with earnings calculator $\rightarrow$ click "Join Partner Program" $\rightarrow$ opens `/affiliate/join`.
   - Click "Apply Now" $\rightarrow$ opens `/affiliate/register`.
   - Logged-in user: Complete registration form $\rightarrow$ verify `POST /api/affiliate/auth/register` creates affiliate record in DB and redirects to `/affiliate/dashboard`.
   - Verify Light Clean Mode and Dark Mode token rendering.

6. **Route-Manifest Diff & Test Suites Verification**
   - Verify route-manifest diff: exactly 3 active public affiliate routes updated + 1 retired route removed.
   - Run sequential test baselines:
     ```powershell
     npx tsc --noEmit
     npx eslint app components lib hooks --max-warnings 5
     npm run test:ci
     ```

---

## Rules specific to this variant

- **UI Creativity:** High for affiliate hero graphics, benefit cards, and earnings calculator layout.
- **Zero Mock Data:** Registration form must submit to real `POST /api/affiliate/auth/register`.
- **Accessibility:** Form fields must have associated labels and validation error announcements.
- **Record Design Decisions:** Document all UI token adaptations in Deviations at close.

---

## Done when

- [x] `/affiliate`, `/affiliate/join`, and `/affiliate/register` live with DavinTrade branding and semantic tokens.
- [x] Interactive commission calculator on `/affiliate` functions cleanly.
- [x] Real partner registration submits to `POST /api/affiliate/auth/register` and successfully creates affiliate profile.
- [x] Legacy `/affiliate/verify` retired with zero dangling links.
- [x] Route-manifest diff matches this session's scope and nothing else.
- [x] `npx tsc --noEmit`, `npx eslint app components lib hooks --max-warnings 5`, and `npm run test:ci` all pass clean.

---

## Rollback

`git revert` of this session's commits. Prefer one commit per page/step so changes can be isolated cleanly.

---

## Deviations

1. **Social-field mapping corrected to the real schema, not Decision 5's literal shorthand.**
   Decision 5 listed the mapping as `socials: { website, twitter, youtube, instagram, tiktok }`,
   but the live `affiliateRegistrationSchema` (`lib/affiliate/validators.ts`) has no `website`
   field — it has `facebookUrl` instead, exactly matching the current (pre-restyle) live page.
   Ported seed-code's 5-social-input layout but swapped its "website" input for Facebook, so the
   form submits only fields the real API accepts. Low-impact, mechanical, no re-ask needed per
   PD1 (live schema wins over a chat shorthand).
2. **`/affiliate/verify`'s deletion landed in the Step-1 commit, not its own Step-4 commit.** It
   was `git rm`'d before Step 1's `git add`, and a broad staged deletion rides along with the next
   commit regardless of what else is explicitly added. No functional effect — the deletion is
   correct and complete either way — but the Rollback section's "one commit per page/step"
   preference isn't quite met for this one file.
3. **`DECISION-LOG.md` F79 registered, not fixed (out of scope).** Required Step 5 live
   verification (real logged-in test user, real `POST /api/affiliate/auth/register`, real 201,
   real DB `profileId`) surfaced a redirect loop: `app/affiliate/dashboard/layout.tsx` reads
   `session.user.isAffiliate` from the JWT and bounces the newly-registered affiliate straight
   back to `/affiliate/register`, because the JWT still carries the pre-registration value — same
   staleness class as F78, different (and more disruptive) surface. `dashboard/layout.tsx` is
   Session 9-7b's file, not this session's; disclosed and registered rather than silently patched.
   A working fix already exists elsewhere in the codebase (`requireAffiliate()` in
   `lib/auth/session.ts` re-checks the DB directly) for 9-7b to reuse. Useful side effect: the
   real test account `free-test@trading-alerts.test` is now a real, DB-registered affiliate —
   exactly the authenticated-affiliate fixture 9-7b needs and previously had none of.
4. **`jest.setup.js` gained a `ResizeObserver` polyfill.** jsdom doesn't implement it, and Radix's
   `Slider` (new this session) calls it on mount; any test rendering the new earnings calculator
   would hit this regardless of which test file, so fixed globally rather than per-file.
5. **Two pre-existing tests updated for content this session intentionally changed, per
   `LESSONS-LEARNED.md` L3.** `__tests__/pages/marketing/public-pages.test.tsx`'s "Public affiliate
   landing page (B2-10)" asserted the retired "Become a Trading Alerts Affiliate"/"Become an
   Affiliate" copy (Decision 4's rebrand); its "/affiliate/join redirect (B2-11)" asserted the
   retired `redirect()` behavior itself (Decision 3). Both re-derived from the real ported content,
   not patched to merely pass — `test:ci` re-verified net-neutral at 160/160 suites, 2400/2400
   tests.
6. **Earnings calculator and copy wired to live `useAffiliateConfig()` values, not Codebase 2's
   hardcoded 30%/$49.** The pre-existing live pages already used this hook for real,
   admin-configurable commission/price data; keeping that binding (rather than regressing to
   Codebase 2's static marketing numbers) was necessary to satisfy the order's own Zero-Mock-Data
   rule. Not a Decision 4 conflict — the decision only specified porting the calculator's
   interaction model (slider), not its data source.
7. **One `eslint` warning fixed in passing on the landing page:** the pre-existing admin-redirect
   effect used `window.location.assign('/admin')`, flagged by
   `@next/next/no-location-assign-relative-destination`. Swapped for `useRouter().push()`, matching
   the pattern already used elsewhere on the same page and on the register page's own admin
   redirect — a one-line, same-behavior fix needed to keep this session's own `eslint --max-warnings 5`
   entry criterion clean, not a drive-by unrelated to this session's files.
8. **Two Jest worker-OOM/SIGTERM false negatives hit running `operation-service`'s suite once**
   (`LESSONS-LEARNED.md` L24's exact documented pattern, from resource contention with the other
   two suites just run plus a concurrently-running dev server) — resolved cleanly on an isolated
   re-run (`--maxWorkers=1`): 42/42 suites, 393/393 tests.
9. **`LESSONS-LEARNED.md` L43 harvested at close, not the two other candidates.** Live
   verification (Step 5) surfaced two other real findings — the route-map/Decision-1 scope
   conflict and the F79 stale-JWT redirect loop — but both are one-off narratives already fully
   captured in `DECISION-LOG.md`/CLAUDE.md, not generalizable executor reflexes, so neither became
   a new lesson. The browser-automation `form_input`-on-checkbox gotcha found mid-verification
   (DOM `checked` flips without React's controlled state updating, silently leaving submit
   disabled) _is_ a reusable reflex for any future session's own live click-through, so that one
   became L43. File now at the 40-lesson cap; nothing else was ready to consolidate.

---

## Next-session handoff

- **Next session:** `9-7b` — `app/affiliate/dashboard/*` + `/affiliate/settings/payout` + `/affiliate/resources` (UI-BUILD).
  - Scope: Rows 35–42 (code-inventory, referral codes, commissions, payouts, payment setup, partner profile, monthly statements, dashboard root) + Rows 45 (`/affiliate/resources`) & 46 (`/affiliate/settings/payout`).
  - Known backend dependencies: verify self-service endpoints for payouts and statements.
- **Prerequisite:** Session 9-7a CLOSED — public onboarding live on `main`.
- **9-7a obligation carried to close:** PRE-DRAFT Session 9-7b's migration order per `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`.
