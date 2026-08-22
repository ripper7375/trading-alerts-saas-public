# Migration Order — Session 9-6 — Payments flow (cross-boundary)

> For sessions that **build or redesign frontend surfaces**: read `00-SKELETON-AND-RULES.md`
> first — §4 applies with the dial at **High** for page-body content/layout, **Zero** on data
> (every page binds to the endpoint its 9-0 row names). Money code additionally escalates per
> `EXECUTOR-PROTOCOL.md` §7 — any change beyond this order's own explicit steps stops and asks
> Davin. **Test mode only.**
> Corrected & upgraded to full **DRAFT** by Antigravity (Advisor & Architect), 2026-08-22.
> Grounded in `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`.

**Session:** 9-6 · **Phase:** 9 (Frontend Stack Replacement) · **Variant:** UI-BUILD + PORT (deliberately cross-boundary — payment is an end-to-end journey, not a single layout) · **Status:** CONFIRMED
**Generated:** 2026-08-22 (Executor PRE-DRAFT) · **Upgraded & Corrected:** 2026-08-22 (Advisor DRAFT) · **Approved:** 2026-08-22 (Davin) · **Confirmed:** 2026-08-22 (Executor)

**CONFIRM note:** all entry criteria re-verified live. Corrected row numbers (60/61) and status
vocabulary (5 states) checked directly against `frontend-swap-route-map.md` and
`app/checkout/return/page.tsx`'s own live `PaymentStatus` type — both hold. `.env.local` was
found with `MIGRATE_WRITE_APIS_MONEY_DLOCAL=true`, contradicting the F76 rollback this order's own
entry criterion requires — corrected to `false` before opening (Deviation 0). Step 0's named
archive target (`decision-log-archive.md`) doesn't match the file the rest of the protocol/history
already uses (`decisions-archive.md`) — used the existing file instead of forking a second archive
(Deviation 0). Test baselines (tsc/eslint/test:ci, money-service, operation-service) all
re-verified green on isolated re-runs at CONFIRM.
**Flags touched:** **F64** (subscription cancel/re-subscribe full lifecycle verification) $\rightarrow$ RESOLVED; **F74** (currency wiring) $\rightarrow$ OPEN/UNTOUCHED (owned by Session 11-1); **F76** (dLocal write flag in `.env.local` kept `false`).
**Surface:** No new layout boundary (root commerce routes) — 3 active commerce pages: `app/checkout/page.tsx` [Row 61], `app/checkout/return/page.tsx` [Row 60], `app/upgrade/success/page.tsx` [Row 87] + **re-verification pass** of `/pricing` [Row 69, Session 9-2] and `/settings/billing` [Row 75, Session 9-5] as a single unified commerce journey.
**Feeds on:** `POST /api/checkout`, `POST /api/checkout/validate-code`, `GET /api/checkout` (return/status polling), `GET /api/subscription`, `POST /api/subscription/cancel`, `GET /api/invoices`, `POST /api/payments/dlocal/check-three-day-eligibility`, `POST /api/webhooks/stripe`.
**Estimated time:** ~3h (Styling 3 checkout pages with DavinTrade tokens + live Stripe/dLocal test-mode verification cycle).

---

## Decisions taken

1. **Resolution of F64 & Lifecycle Re-Subscription (Resolution of Open Question 1)**
   - **Decision:** Formally close **F64** (RESOLVED) by verifying the full subscription lifecycle in Test Mode: Active PRO $\rightarrow$ User cancels in `/settings/billing` $\rightarrow$ Account drops to FREE $\rightarrow$ User navigates to `/pricing` $\rightarrow$ `/checkout` $\rightarrow$ Completes Stripe Test Mode checkout $\rightarrow$ Webhook activates subscription $\rightarrow$ `/upgrade/success` confirms PRO tier $\rightarrow$ `/settings/billing` reflects active PRO status.
   - **What was rejected:** Building a phantom in-place "undo" endpoint without a payment method or ignoring the re-subscribe loop.
   - **Rationale:** Standard SaaS payment architectures require re-checkout when an immediate cancellation takes effect. Verifying this complete round-trip satisfies F64's business requirement.
   - **Undo Cost:** Low.

2. **DavinTrade Token Alignment for Checkout Surfaces (Resolution of Open Question 2)**
   - **Decision:** Restyle `app/checkout/page.tsx`, `app/checkout/return/page.tsx`, and `app/upgrade/success/page.tsx` with DavinTrade semantic tokens (`bg-card`, `border-border`, `text-foreground`, amber accent highlights), while strictly preserving 100% of the underlying Stripe and dLocal integration logic, country detection, 3-day trial checks, and coupon code validation.
   - **What was rejected:** Rewriting the payment state machines or altering payment provider parameters.
   - **Rationale:** High dial on presentation, zero dial on data/money logic.
   - **Undo Cost:** Low.

3. **dLocal Term Renewal Handling (Resolution of Open Question 3)**
   - **Decision:** dLocal fixed-term non-recurring plans renew by directing the user through standard `/pricing` $\rightarrow$ `/checkout` flow. No standalone recurring debit mechanism is required for dLocal.
   - **What was rejected:** Fabricating automatic recurring debits for non-card local payment methods.
   - **Rationale:** Matches dLocal's architecture as verified in Phase 4A.
   - **Undo Cost:** Low.

4. **F74 Multi-Currency Scope Isolation (Resolution of Open Question 4)**
   - **Decision:** `/checkout` continues utilizing its established `getCurrency()` and `DLOCAL_SUPPORTED_COUNTRIES` utilities (`lib/dlocal/constants.ts`). F74 (dynamic multi-currency pricing display tables) remains OPEN and change-frozen until Session 11-1.
   - **What was rejected:** Prematurely refactoring currency conversion logic in a frontend UI-BUILD session.
   - **Rationale:** Strict scope discipline per Rule 4.
   - **Undo Cost:** Low.

5. **Webhook Re-Verification Scope (Resolution of Open Question 5)**
   - **Decision:** Live-verify the webhook processing path in Stripe Test Mode (`checkout.session.completed` $\rightarrow$ `POST /api/webhooks/stripe` $\rightarrow$ DB updates user tier to `PRO`), ensuring that `/upgrade/success` polling and `/settings/billing` reload immediately reflect the tier upgrade without manual database interventions.
   - **What was rejected:** Relying only on static code inspections without live test-mode payment verification.
   - **Rationale:** Proves the commerce stack end-to-end with real test events.
   - **Undo Cost:** Low.

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §3: `/checkout` (Row 61), `/checkout/return` (Row 60), and `/upgrade/success` (Row 87) are the commerce surfaces that bridge public discovery (`/pricing`, Row 69) and post-purchase management (`/settings/billing`, Row 75).

Payment is an end-to-end journey rather than an isolated layout. This session styles all checkout views with DavinTrade's design system and validates the complete payment lifecycle in Test Mode.

`frontend-swap-route-map.md` assigns this session rows 60 (`/checkout/return`), 61 (`/checkout`), 87 (`/upgrade/success`), and cross-verifies rows 69 (`/pricing`) and 75 (`/settings/billing`).

---

## Entry criteria (re-verify all at CONFIRM)

- [x] **Session 9-5 CONFIRMED, executed, CLOSED** — `settings/` 11 live on `main`, route-manifest diff clean.
- [x] **`DECISION-LOG.md` size gate resolved at Step 0** — archived to `docs/migration-orders/history/decisions-archive.md` (the existing archive file — see Deviation 0), 169KB → 20.4KB.
- [x] **Route-map rows 60, 61, 69, 75, 87 re-verified directly** against `frontend-swap-route-map.md`.
- [x] **`app/checkout/page.tsx`, `app/checkout/return/page.tsx`, `app/upgrade/success/page.tsx` confirmed existing** and read in full.
- [x] **Stripe Test Mode credentials confirmed active** (no real credit cards or live mode API keys).
- [x] **`.env.local` confirmed with `MIGRATE_WRITE_APIS_MONEY_DLOCAL=false`** (per F76 rollback) — found `true`, corrected (Deviation 0).
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

1. **Step 0: Protocol Size Gate Cleanup**
   - Archive closed Phase 1–6 entries from `docs/migration-orders/DECISION-LOG.md` to `docs/migration-orders/history/decision-log-archive.md` to restore target file size (~50KB).

2. **Restyle Unified Checkout (`app/checkout/page.tsx`, Row 61)**
   - Apply DavinTrade semantic tokens and glassmorphism styling to plan selection cards, country selector dropdown, discount code input, and payment method selector.
   - Preserve all existing state handlers: Stripe hosted checkout redirection, dLocal checkout launch, 3-day trial eligibility checks, and discount code validation.
   - _Verify:_ `npx tsc --noEmit` clean; Stripe and dLocal payment buttons respond in Test Mode.

3. **Restyle Checkout Return & Upgrade Success Pages (Rows 60, 87)**
   - `app/checkout/return/page.tsx` (Row 60): Restyle all 5 dLocal payment status cards (`PENDING`, `COMPLETED`, `FAILED`, `CANCELLED`, `REFUNDED`) with DavinTrade status badges and action buttons ("Go to Terminal", "Try Again").
   - `app/upgrade/success/page.tsx` (Row 87): Restyle Stripe post-checkout celebration card, feature list checklist, and "Launch PRO Terminal" button (`/terminal`).
   - _Verify:_ `npx tsc --noEmit` clean; status cards render cleanly with theme token reactivity across all 5 status states.

4. **Live Test-Mode End-to-End Payment Verification**
   - **Step A (Discovery):** Start at `/pricing` (logged in as FREE test user). Click "Upgrade to PRO" $\rightarrow$ navigates to `/checkout`.
   - **Step B (Checkout):** Select Stripe Test Card. Submit $\rightarrow$ redirected to Stripe Test Checkout. Complete test payment using `4242...`.
   - **Step C (Webhook & Success):** Stripe redirects to `/upgrade/success`. Verify polling resolves and confirms PRO status. Click "Launch PRO Terminal" $\rightarrow$ `/terminal` opens with PRO features enabled.
   - **Step D (Billing Management):** Navigate to `/settings/billing`. Verify active subscription card displays PRO tier with real invoice history.
   - **Step E (Cancellation & Re-subscription):** Click "Cancel Subscription" $\rightarrow$ confirm in dialog. Verify account downgrades to FREE. Click "Upgrade to PRO" $\rightarrow$ completes the cycle back to `/checkout`.

5. **Route-Manifest Diff & Test Suites Verification**
   - Verify route-manifest diff: exactly the 3 commerce pages restyled, zero route additions or removals.
   - Run sequential test baselines:
     ```powershell
     npx tsc --noEmit
     npx eslint app components lib hooks --max-warnings 5
     npm run test:ci
     ```

---

## Rules specific to this variant

- **Money Code Escalation:** Any modification to backend Stripe/dLocal API calls, signature checks, or webhook dispatch must stop and escalate per `EXECUTOR-PROTOCOL.md` §7.
- **Strict Test Mode:** Absolutely NO live payment credentials, live webhooks, or real credit card numbers.
- **Zero Mock Data:** Webhook notifications and subscription queries must hit real Prisma DB records and Stripe test mode.
- **Re-Verification Non-Regression:** `/pricing` and `/settings/billing` are re-verified as consumers, not refactored or rewritten.
- **Record Design Decisions:** Document all checkout token styling and test transaction IDs in Deviations at close.

---

## Done when

- [ ] `DECISION-LOG.md` size gate resolved at Step 0.
- [ ] `/checkout`, `/checkout/return`, and `/upgrade/success` live with DavinTrade branding and semantic tokens.
- [ ] Complete payment lifecycle (Pricing $\rightarrow$ Checkout $\rightarrow$ Test Payment $\rightarrow$ Webhook $\rightarrow$ Success $\rightarrow$ Billing $\rightarrow$ Cancel $\rightarrow$ Re-subscribe) live-verified end-to-end in Test Mode.
- [ ] F64 formally closed in `DECISION-LOG.md` upon successful lifecycle verification.
- [ ] `/pricing` and `/settings/billing` confirmed working smoothly with zero regressions.
- [ ] Route-manifest diff matches this session's scope and nothing else.
- [ ] `npx tsc --noEmit`, `npx eslint app components lib hooks --max-warnings 5`, and `npm run test:ci` all pass clean.

---

## Rollback

`git revert` of this session's commits. Prefer one commit per logical step (checkout page restyle, return/success restyle, test verification) so changes can be isolated cleanly.

---

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

**Deviation 0 (CONFIRM, before Step 0):** Two corrections made to the order's own Step 0/entry
criteria before opening, both evidence-based per PD1:

1. `.env.local` had `MIGRATE_WRITE_APIS_MONEY_DLOCAL=true`, contradicting the F76 rollback this
   order's own entry criterion requires. Corrected to `false`. Money-adjacent — disclosed here
   rather than silently fixed.
2. Step 0 named a new archive file, `docs/migration-orders/history/decision-log-archive.md`. The
   file every other session (4A-13/14/15, 9-0, 9-1) actually uses is
   `docs/migration-orders/history/decisions-archive.md`. Used the existing file to avoid forking
   the archive history in two.
3. `DECISION-LOG.md`'s ~169KB was not, on inspection, "Phase 1–6 decisions" bloat as Step 0's
   text assumed — nearly every flag through F66 already had a full write-up in
   `decisions-archive.md`; the size was almost entirely markdown-table column-padding driven by
   three still-OPEN flags (F21, F64, F77) whose in-table narrative had grown far past a register
   row's intended size (F77 alone: ~2100 combined characters, forcing every other row in the
   table to pad out to match it). Archived those three flags' full narrative (nothing lost),
   trimmed ~25 other rows' redundant prose down to a pointer where an archive entry already
   existed. Result: 169015 → 20420 bytes.

---

## Next-session handoff

- **Next session:** `9-7` — `app/affiliate/*` 14 (UI-BUILD), per `MASTER-ROADMAP-PHASES-7-15.md` §3.
  - Scope: Affiliate portal pages (public join/register, dashboard, earnings, links, payouts, settings).
  - Expects a clean split into 9-7a (public onboarding/join) and 9-7b (affiliate portal dashboard).
- **Prerequisite:** Session 9-6 CLOSED — payments flow live and verified on `main`.
- **9-6 obligation carried to close:** PRE-DRAFT Session 9-7's migration order per `MASTER-ROADMAP-PHASES-7-15.md` §3 and `frontend-swap-route-map.md`.
