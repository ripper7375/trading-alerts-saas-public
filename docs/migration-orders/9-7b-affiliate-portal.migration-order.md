# Migration Order — Session 9-7b — `app/affiliate/dashboard/*` authenticated partner portal

> For sessions that **build or redesign frontend surfaces**: read `00-SKELETON-AND-RULES.md`
> first — §4 applies with the dial at **High** for page-body content/layout, **Zero** on data
> (every page binds to the endpoint its 9-0 row names).
> Corrected & upgraded to full **DRAFT** by Antigravity (Advisor & Architect), 2026-08-22.
> Grounded in `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`.

**Session:** 9-7b · **Phase:** 9 (Frontend Stack Replacement) · **Variant:** UI-BUILD · **Status:** CLOSED SUCCESSFUL
**Generated:** 2026-08-22 (Executor PRE-DRAFT) · **Upgraded & Corrected:** 2026-08-22 (Advisor DRAFT) · **Approved:** 2026-08-22 (Davin) · **Confirmed:** 2026-08-23 (Executor, live re-verification against codebase + runtime — DB fixture, `tsc`, all 10 rows' bindings) · **Closed:** 2026-08-23 (Executor — all Done-when boxes verified, F79 RESOLVED, F80 registered)
**Flags touched:** **F79** (`app/affiliate/dashboard/layout.tsx` DB check for fresh affiliates) $\rightarrow$ RESOLVED.
**Surface:** `app/affiliate/dashboard/*` + `app/affiliate/settings/payout` — the complete 10-row authenticated partner portal cluster:

- Row 42: `app/affiliate/dashboard/page.tsx` (Portal Overview & Quick Stats)
- Row 36: `app/affiliate/dashboard/codes/page.tsx` (Active Referral Codes)
- Row 35: `app/affiliate/dashboard/code-inventory/page.tsx` (Code Inventory Allocation)
- Row 37: `app/affiliate/dashboard/commissions/page.tsx` (Commission History)
- Row 38: `app/affiliate/dashboard/payouts/page.tsx` (Disbursement Payout Batches)
- Row 41: `app/affiliate/dashboard/statements/page.tsx` (Monthly Statements & CSV Export)
- Row 40: `app/affiliate/dashboard/profile/page.tsx` (Partner Profile)
- Row 39: `app/affiliate/dashboard/profile/payment/page.tsx` (Retired redirect to `/affiliate/settings/payout`)
- Row 45: `app/affiliate/dashboard/resources/page.tsx` (Marketing Media Kit & Assets)
- Row 46: `app/affiliate/settings/payout/page.tsx` (Wise Payout Settings)
  **Feeds on:**
- `GET /api/affiliate/dashboard/stats` (Row 42)
- `GET /api/affiliate/dashboard/codes` (Row 36)
- `GET /api/affiliate/dashboard/code-inventory` (Row 35)
- `GET /api/affiliate/dashboard/commission-report` (Row 37 & aggregated in Row 41)
- Direct Prisma read `prisma.disbursementTransaction` (Row 38 Server Component)
- `GET/PATCH /api/affiliate/profile` (Row 40)
- `GET /api/wise/recipients/me` & `POST /api/wise/recipients/[id]/revalidate` via `<WiseRecipientForm />` (Row 46)
- `GET /api/affiliate/dashboard/resources` (+ `/[id]/copy`, `/[id]/download`) (Row 45)
  **Estimated time:** ~3h (Authenticated affiliate portal pages with DavinTrade design tokens, `AffiliateNav`, and live test fixture verification).

---

## Decisions taken

1. **Resolution of F79 in `app/affiliate/dashboard/layout.tsx` (Resolution of Open Question 1)**
   - **Decision:** Formally close **F79** (RESOLVED) by updating `app/affiliate/dashboard/layout.tsx` to verify affiliate status via `requireAffiliate()` (or a direct `prisma.user.findUnique` check if `!session.user.isAffiliate`). This permanently eliminates the JWT stale-session race condition upon initial registration, allowing newly registered affiliates to immediately access the dashboard without an extra re-login cycle.
   - **What was rejected:** Leaving F79 unresolved and forcing artificial sign-out/sign-in steps during testing.
   - **Rationale:** `requireAffiliate()` already implements this exact DB fallback in `lib/auth/session.ts:129-136`.
   - **Undo Cost:** Low.

2. **Formally Confirm Rows 45 & 46 in Session 9-7b (Resolution of Open Question 2)**
   - **Decision:** Confirm that Rows 45 (`app/affiliate/dashboard/resources/page.tsx`) and 46 (`app/affiliate/settings/payout/page.tsx`) belong to Session 9-7b, as approved in Session 9-7a's Decision 1.
   - **What was rejected:** Splitting resources/payouts into a disjoint session or targeting the orphaned public marketing splash `app/affiliate/resources/page.tsx`.
   - **Rationale:** Preserves domain coherence; all authenticated affiliate portal surfaces mount under the unified affiliate navigation.
   - **Undo Cost:** Low.

3. **Complete 10-Row Scope in Single Session without Sub-Split (Resolution of Open Question 3)**
   - **Decision:** Execute all 10 authenticated affiliate portal pages in Session 9-7b as a single session.
   - **What was rejected:** Splitting into 9-7b1 and 9-7b2.
   - **Rationale:** Codebase verification proves no missing backend endpoints exist: Row 38 (`/payouts`) is already an operational Server Component querying real `disbursementTransaction` records, Row 41 (`/statements`) aggregates real `commission-report` data client-side, and Row 39 is a transparent redirect. The session is pure UI restyling to DavinTrade tokens with existing, tested data bindings.
   - **Undo Cost:** Low.

4. **Binding Row 37 to Verified Commission Report Endpoint & Row 46 to Wise API (Resolution of Open Question 4)**
   - **Decision:** Explicitly bind `app/affiliate/dashboard/commissions/page.tsx` (Row 37) to `GET /api/affiliate/dashboard/commission-report`, and bind `app/affiliate/settings/payout/page.tsx` (Row 46) to `GET /api/wise/recipients/me` and `POST /api/wise/recipients/[id]/revalidate` via `<WiseRecipientForm />`. Confirm Row 39 as a transparent redirect.
   - **What was rejected:** Citing raw schema files or superseded endpoints.
   - **Rationale:** Aligns with live codebase implementation verified in Phase 4A/Session 6-7.
   - **Undo Cost:** Low.

5. **DavinTrade Token Alignment & `AffiliateNav` Chrome**
   - **Decision:** Mount `<AffiliateNav />` across all dashboard, resources, and settings pages, styled with DavinTrade semantic tokens (`bg-card`, `border-border`, amber active states, dark mode support).
   - **What was rejected:** Hardcoded legacy blue/gray navigation headers.
   - **Rationale:** 100% visual consistency with DavinTrade design system.
   - **Undo Cost:** Low.

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §3: `app/affiliate/*` encompasses 14 routes. Session 9-7a closed the public onboarding routes (Rows 43, 44, 47 [retired], 48). Session 9-7b completes the frontend stack for the entire authenticated affiliate portal (Rows 35–42, 45, 46).

Using the authenticated affiliate test account (`free-test@trading-alerts.test`, registered in Session 9-7a), this session validates all partner surfaces with real database records and zero mock data.

---

## Entry criteria (re-verify all at CONFIRM)

- [x] **Session 9-7a CONFIRMED, executed, CLOSED** — public onboarding live on `main`, route-manifest diff clean. Verified via `git log` (commits `530b03e5`…`5d986cd3`).
- [x] **Authenticated affiliate test fixture confirmed active** (`free-test@trading-alerts.test` with active DB affiliate profile). Live query 2026-08-23: `isAffiliate: true`, `AffiliateProfile cmt4hxzk30005asv2vdq8bpws`, `status: ACTIVE`.
- [x] **All target page files confirmed existing** and read in full.
- [x] **All backing API routes + Prisma Server Component read and contract-verified**. Row 46 corrected to real `/api/wise/recipients/*` endpoints; Row 39 confirmed as retired redirect; Row 45 confirmed at `dashboard/resources/page.tsx`.
- [x] **Sequential test suite baselines green** (`LESSONS-LEARNED.md` L24): `npx tsc --noEmit` re-verified clean 2026-08-23 at CONFIRM; full suite re-run in Step 6 at close.

  ```powershell
  # 1. Monolith
  npx tsc --noEmit
  npx eslint app components lib hooks --max-warnings 5
  npm run test:ci

  # 2. Money service
  cd money-service; npm test -- --maxWorkers=1; cd ..

  # 3. Operation service
  cd operation-service; npm test -- --maxWorkers=1; cd ..
  ```

---

## Ordered steps

1. **Resolve F79 in `app/affiliate/dashboard/layout.tsx`**
   - Update `app/affiliate/dashboard/layout.tsx` to verify affiliate status via `requireAffiliate()` / direct Prisma check when `session.user.isAffiliate` is not in JWT.
   - Mount DavinTrade header and `<AffiliateNav />` component with active route highlighting.
   - _Verify:_ `free-test@trading-alerts.test` navigates to `/affiliate/dashboard` without redirect loop.

2. **Restyle Dashboard Overview & Codes Pages (Rows 42, 36, 35)**
   - `app/affiliate/dashboard/page.tsx` (Row 42): Restyle stats cards (Total Earnings, Unpaid Commission, Conversion Rate, Active Codes) bound to `GET /api/affiliate/dashboard/stats`.
   - `app/affiliate/dashboard/codes/page.tsx` (Row 36): Restyle promo codes table, discount percentage badges, and copy-link triggers bound to `GET /api/affiliate/dashboard/codes`.
   - `app/affiliate/dashboard/code-inventory/page.tsx` (Row 35): Restyle code tier allocation and quota cards bound to `GET /api/affiliate/dashboard/code-inventory`.
   - _Verify:_ `npx tsc --noEmit` clean; data tables and cards render with DavinTrade semantic tokens.

3. **Restyle Commissions, Payouts & Statements Pages (Rows 37, 38, 41)**
   - `app/affiliate/dashboard/commissions/page.tsx` (Row 37): Restyle commission history table with status badges (`PENDING`, `APPROVED`, `PAID`, `CANCELLED`) bound to `GET /api/affiliate/dashboard/commission-report`.
   - `app/affiliate/dashboard/payouts/page.tsx` (Row 38): Restyle Server Component payout batch table with real `PaymentBatchStatus` badges querying `prisma.disbursementTransaction`.
   - `app/affiliate/dashboard/statements/page.tsx` (Row 41): Restyle 12-month statement breakdown and CSV export trigger.
   - _Verify:_ `npx tsc --noEmit` clean; CSV export functions and payout history reflects real DB state.

4. **Restyle Partner Profile, Resources, Payout Settings & Confirm Redirect (Rows 40, 45, 46, 39)**
   - `app/affiliate/dashboard/profile/page.tsx` (Row 40): Restyle partner channel name, email, country, and social handles bound to `GET/PATCH /api/affiliate/profile`.
   - `app/affiliate/dashboard/resources/page.tsx` (Row 45): Restyle media kit banner downloads, brand assets, and embed code copy buttons bound to `GET /api/affiliate/dashboard/resources`.
   - `app/affiliate/settings/payout/page.tsx` (Row 46): Restyle Wise payment recipient configuration bound to `GET /api/wise/recipients/me` & `POST /api/wise/recipients/[id]/revalidate` via `<WiseRecipientForm />`.
   - `app/affiliate/dashboard/profile/payment/page.tsx` (Row 39): Confirm transparent redirect to `/affiliate/settings/payout`.
   - _Verify:_ `npx tsc --noEmit` clean; profile and Wise settings save successfully.

5. **Live Verification & Click-Through**
   - Log in as `free-test@trading-alerts.test`.
   - Navigate through all pages via `<AffiliateNav />`:
     `/affiliate/dashboard` $\rightarrow$ `/codes` $\rightarrow$ `/code-inventory` $\rightarrow$ `/commissions` $\rightarrow$ `/payouts` $\rightarrow$ `/statements` $\rightarrow$ `/dashboard/resources` $\rightarrow$ `/profile` $\rightarrow$ `/settings/payout`.
   - Verify zero layout shift, theme reactivity (Light Clean Mode & Dark Mode), and real API responses.

6. **Route-Manifest Diff & Test Suites Verification**
   - Verify route-manifest diff: exactly the target authenticated affiliate portal pages restyled.
   - Run sequential test baselines:
     ```powershell
     npx tsc --noEmit
     npx eslint app components lib hooks --max-warnings 5
     npm run test:ci
     ```

---

## Rules specific to this variant

- **Zero Mock Data:** Every page binds to its live API route or Prisma query. No synthetic fallback arrays.
- **100%-Fidelity Invariant:** Preserve all existing query params, pagination, and CSV download logic.
- **Scope Discipline:** Do not touch public affiliate pages (`/affiliate`, `/join`, `/register`, closed in 9-7a) or `/admin/*` routes.
- **Record Design Decisions:** Document all UI token alignments in Deviations at close.

---

## Done when

- [x] `DECISION-LOG.md` F79 resolved and closed.
- [x] All authenticated partner portal pages live with DavinTrade branding, `<AffiliateNav />`, and semantic tokens.
- [x] Live test user traverses all pages with real API/DB data bindings and zero redirect loops.
- [x] Route-manifest diff matches this session's scope and nothing else.
- [x] `npx tsc --noEmit`, `npx eslint app components lib hooks --max-warnings 5`, and `npm run test:ci` all pass clean.

---

## Rollback

`git revert` of this session's commits. Prefer one commit per logical page group so changes can be isolated cleanly.

---

## Deviations

1. **Row 39 was a no-op, not a restyle.** `app/affiliate/dashboard/profile/payment/page.tsx` was
   already a transparent redirect to `/affiliate/settings/payout` (Session 6-7). Confirmed and
   left untouched rather than restyled, per Decision 4.
2. **Two hung local dev servers, unrelated to this session's own code.** Port 3000 was held by an
   unresponsive `node` process (started ~6h earlier, pre-dating this session) that accepted TCP
   connections but never responded — killed and restarted via the project's own `nextdev` launch
   config. Separately, `GET /api/wise/recipients/me` 500'd because `money-service` (port 3002)
   wasn't running locally — started via the existing `moneyservice` launch config (Session 9-6
   precedent, `LESSONS-LEARNED.md` L42). Neither is an app defect.
3. **A real, live bug found during this session's own required Step 5 click-through, registered as
   `DECISION-LOG.md` F80 (OPEN), not silently patched or worked around in place:**
   `lib/auth/auth-options.ts`'s `FIXED_TEST_ACCOUNTS` credentials-authorize path unconditionally
   `upsert`s a hardcoded `isAffiliate` value on every login — this silently reset
   `free-test@trading-alerts.test`'s real, Session-9-7a-earned `isAffiliate: true` back to `false`
   the moment it was used to sign in for this session's own verification. Restored the DB value
   directly (a disclosed workaround, not a fix) to complete verification without re-triggering the
   reset. A second, related gap surfaced downstream of the same staleness: money-service's own
   `AffiliateGuard` (backing Row 46's Wise endpoints) trusts the JWT's `isAffiliate` claim directly
   with no DB-fallback equivalent to F79's fix — confirmed the page/`WiseRecipientForm` render
   correctly once verified against a fresh, non-stale JWT (`affiliate-test@trading-alerts.test`).
   Neither is a 9-7b file; both left for Davin/Antigravity to scope as their own session — see F80.
4. **Two Jest assertions in `components/affiliate/{commission-table,code-table}` tests needed
   re-deriving, not reverting, per `LESSONS-LEARNED.md` L3/L18:** they checked for legacy hardcoded
   color-class names (`yellow`/`blue`/`gray`) this session's own Decision 5 intentionally replaced
   with semantic DavinTrade tokens (amber/muted) — updated to match the real, intentional new
   classes. A third, pre-existing unused-param lint error in `code-table.test.tsx`'s `date-fns`
   mock (surfaced only once this file was re-staged) was fixed alongside (underscore-prefix,
   matching `commission-table.test.tsx`'s own existing convention).
5. **A lint-staged hook failure left a transient, self-corrected git-index/working-tree mismatch**
   on the two test files above (`LESSONS-LEARNED.md` L36's exact pattern, one level worse — the
   hook's own revert-on-failure step also failed, on an unrelated already-modified binary file).
   No data was lost: the correct fix survived in the git index; `git checkout -- <file>` resynced
   the working tree before re-committing. Not this session's own file, not touched further.
6. **All test baselines verified live, all green, exact match to the entry-criterion baseline:**
   monolith `tsc` clean, `eslint` 0 errors/4 warnings (pre-existing, none in touched files),
   `test:ci` 160/160 suites/2400/2400 tests; money-service 62/62 suites/526/526 tests;
   operation-service 42/42 suites/393/393 tests.

---

## Next-session handoff

- **Next session:** `9-8a` — `app/(dashboard)/admin/*` core cluster 1 (overview, users, system,
  api-usage, errors, notifications/broadcast preview), per `MASTER-ROADMAP-PHASES-7-15.md` §3.
- **Prerequisite:** Session 9-7b CLOSED — authenticated partner portal live on `main`.
- **9-7b obligation carried to close:** PRE-DRAFTed as
  `9-8a-admin-core.migration-order.md` (done).
