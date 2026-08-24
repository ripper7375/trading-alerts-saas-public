# Migration Order — Session 11-1 — Tier Matrix Decision + Types/Config

> Read `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at **Medium** (CONTRACT + PORT
> variant: the 6 Core Areas and their order are fixed by the spec; the exact tier-line values and
> currency-wiring approach are this session's own judgment calls, subject to the sign-off carve-out
> below).
> **PRE-DRAFTed by the Executor at Session 8-2's close (2026-08-24)**, upgraded to **authoritative
> DRAFT by the Advisor / Antigravity (2026-08-24)** per `MASTER-ROADMAP-PHASES-7-15.md` §"Phase 11"
> and `davintrade-stack-d-and-e/PREPARATORY-TIER-ACCESS-AND-CORE-REFACTORING-SPECIFICATION.md`.

**Session:** 11-1 · **Phase:** 11 (Preparatory Tier-Access & Core Refactoring, first of 3 sessions) · **Variant:** CONTRACT + PORT · **Status:** CONFIRMED  
**Generated:** 2026-08-24 (Executor, PRE-DRAFT) · **Upgraded to DRAFT:** 2026-08-24 (Advisor / Antigravity) · **Approved:** 2026-08-24 (Davin — explicit sign-offs on F68 & F74) · **Confirmed:** 2026-08-24 (Executor — CONFIRM found the order's own committed HEAD still at `PRE-DRAFT` with F68/F74 still OPEN in `DECISION-LOG.md`, the DRAFT→APPROVED text present only as an uncommitted working-copy edit, same `LESSONS-LEARNED.md` L3 status-integrity gap as 8-1/8-2/4A-16's own CONFIRMs; surfaced directly, Davin explicitly confirmed live in chat 2026-08-24 that both sign-offs are authentic. All other entry criteria — baselines, live Stripe cross-check — independently re-verified fresh and green; see Deviations)  
**Flags touched:** **F68** (Master Tier Matrix Specification — `⚠ NEEDS EXPLICIT SIGN-OFF` → SIGNED OFF), **F74** (Payment Currency Wiring Architecture — `⚠ NEEDS EXPLICIT SIGN-OFF` → SIGNED OFF).  
**Estimated time:** ~3–4h (catalog verification, types hoisting to `@trading-alerts/types`, `lib/tier-config.ts` reconciliation, drawing tool-set gating, full test suite pass).  
**Target components:** `packages/types/` (`@trading-alerts/types/tier`), `lib/tier-config.ts`, `lib/stripe/stripe.ts`, `types/`.

---

## Decisions taken

> Four authoritative technical choices taken by the Advisor per `00-SKELETON-AND-RULES.md` §1.0 & `DECISION-LOG.md` PD1.
> **F68 and F74 both carry `⚠ NEEDS EXPLICIT SIGN-OFF`** because they govern customer-facing entitlements and checkout billing semantics.

1. **F68 Resolution: Master Tier Access Rights Matrix (Parts 02–33) `⚠ NEEDS EXPLICIT SIGN-OFF`**
   - **Chosen:** Formally adopt the unified 2-Tier Master Matrix (`FREE` vs `PRO`) defined in the Preparatory Refactoring Specification §2.
     - **Data Access:** Both `FREE` and `PRO` retain identical market data column access (all 79 numerical columns of `market_data_v6` for `XAUUSD` across `M5` and `M15`).
     - **Alerts:** `FREE` = `0` alerts (creation disabled). `PRO` = `100` active alerts (price threshold alerts + drawing line-touch alerts).
     - **Rate Limiting:** `FREE` = 60 requests/hour. `PRO` = 300 requests/hour.
     - **MTF Overlay:** `FREE` = Locked (teaser/upgrade prompt). `PRO` = Unlocked (`GET /api/market-data/channel` returns M5 `uoedt`, `base_fl`, `loedt` on M15 charts).
     - **Stack D (Conversational AI Analyst):** `FREE` = 🔒 100% Locked (`403 Forbidden`, `reason: "TIER_PRO_REQUIRED"`, 0 tokens). `PRO` = ⚡ Unlocked with a **500,000 monthly token quota** (tracked via Redis sliding-window + `token_usage_log`).
     - **Stack E (Live Comments & Metrics):** `FREE` = 🔒 Locked (preview overlay with upgrade prompt, comments socket stream suppressed). `PRO` = ⚡ Unlocked (real-time Socket.IO comments stream + 4 statistical quality metrics: Bar Coverage, Regression $R^2$, EDT Fitness, Baseline Symmetry).
     - **Pricing & Trial:** `FREE` = $0/month. `PRO` = $29/month (`NEXT_PUBLIC_PRO_PRICE_MONTHLY` / `STRIPE_PRO_PRICE_ID`), 7-day free trial with full PRO access.
   - **Cross-Check against Live Code & Stripe:**
     - `lib/tier-config.ts` already specifies `maxAlerts: 0` for FREE and `maxAlerts: 100` for PRO, $29/mo price, and 7-day trial.
     - Adding the Stack D/E flags (`aiAnalystAllowed`, `aiMonthlyTokenQuota: 500_000`, `marketCommentsFeedAllowed`, `marketQualityMetricsAllowed`, `drawingAlertsAllowed`) to `PRO` **expands** PRO functionality with zero regressions/downgrades on existing paying users.
   - **Rejected:** Creating intermediate tiers (e.g., "Basic" or "Plus") or restricting historical data columns for FREE users (maintains high conversion funnel engagement).
   - **How hard to undo:** Plain type/config modification in `packages/types`.

2. **F74 Resolution: Payment Currency Wiring & Catalog Architecture `⚠ NEEDS EXPLICIT SIGN-OFF`**
   - **Chosen:** Establish USD ($29.00/month, `STRIPE_PRO_PRICE_ID`) as the authoritative base billing currency for all subscriptions.
     - **Stripe Checkout:** Reads `userPreference.currency` for localized currency formatting/display in the UI, while passing the single USD recurring Price ID to Stripe Checkout (which uses Stripe's built-in Adaptive Pricing / dynamic currency conversion for international payment methods).
     - **dLocal Local APMs:** Resolves local currencies (THB, BRL, MXN, COP, CLP, PEN, ARS, NGN, ZAR) dynamically via `lib/dlocal/constants.ts` and real-time exchange rates (`lib/dlocal/`), billing local amounts equivalent to the $29 USD monthly price.
   - **Rejected:** Creating dozens of discrete per-currency Stripe recurring Price objects in Stripe Dashboard (adds catalog fragmentation, webhook complexity, and multi-currency subscription migration friction).
   - **Why:** Delivers seamless localized payment experiences across all countries while keeping Stripe product catalog management and revenue accounting single-currency and robust.
   - **How hard to undo:** Straightforward configuration adjustment in checkout session factory.

3. **Drawing Tool-Set Entitlement Architecture (Phase 10 Deferred Scope)**
   - **Chosen:** Explicitly differentiate client-side chart annotation tools from server-evaluated line-touch alerts:
     - **Client-Side Drawing Tools (Canvas):** Both `FREE` and `PRO` users can draw trendlines, horizontal rays, rectangles, and Fibonacci retracements locally on their charts for visual analysis.
     - **Drawing Line Alerts (Server Engine):** Only `PRO` subscribers can attach active, server-monitored price-touch alerts to drawn lines (`drawingAlertsAllowed: true`, bounded by `maxAlerts: 100`). FREE users attempting to attach an alert to a drawn line receive an upgrade modal (`drawingAlertsAllowed: false`).
   - **Rejected:** Disabling drawing tools entirely for FREE users (worsens charting UX and drops user retention).
   - **Why:** Aligns with standard SaaS charting conventions (e.g. TradingView) where visual tools are open, but persistent server notification engines are gated to paying tiers.
   - **How hard to undo:** Property toggle in `TierConfig`.

4. **Hoisting Tier Types & Config to `@trading-alerts/types`**
   - **Chosen:** Create `@trading-alerts/types/tier` (`packages/types/src/tier/index.ts` and `types.ts`) containing the canonical `Tier`, `TierConfig`, `TIER_CONFIGS`, `FREE_TIER_CONFIG`, `PRO_TIER_CONFIG`, `TRIAL_CONFIG`, and helper assertion functions (`canAccessAiAnalyst`, `canAccessMarketComments`, `canAccessDrawingAlerts`, etc.). Update `lib/tier-config.ts` in the monolith to re-export and consume from `@trading-alerts/types`.
   - **Rejected:** Keeping `TierConfig` duplicated in separate files across monolith, `operation-service`, and `money-service`.
   - **Why:** Enforces a single source of truth across both the Next.js frontend/BFF and the downstream NestJS microservices (Session 11-2, Phase 12, Phase 13).
   - **How hard to undo:** Trivial package export refactoring.

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §"Phase 11":
"11-1 — Tier matrix decision + types/config (CONTRACT + PORT, Core Area 1). Resolve F68 ... and F74 ... Then update `@trading-alerts/types` and `lib/tier-config.ts`, including the drawing tool-set entitlements deferred from Phase 10."

This is Phase 11's foundational session. Stack D (Phase 12: Conversational AI Analyst) and Stack E (Phase 13: Live Market Comments & Quality Metrics) directly gate their endpoints, Socket.IO streams, and AI token quotas on the types and configuration established in this session.

---

## Reconciliation Table: Live Code & Stripe vs Proposed Master Matrix

| Feature / Entitlement         | Live `lib/tier-config.ts`   | Live Stripe Catalog (`STRIPE_PRO_PRICE_ID`) | Proposed Master Matrix (Session 11-1)       | Customer Impact / Downgrade Risk       |
| ----------------------------- | --------------------------- | ------------------------------------------- | ------------------------------------------- | -------------------------------------- |
| **Symbol Access**             | `XAUUSD` (FREE & PRO)       | N/A                                         | `XAUUSD` (FREE & PRO)                       | **None** (identical)                   |
| **Timeframe Access**          | `M5`, `M15` (FREE & PRO)    | N/A                                         | `M5`, `M15` (FREE & PRO)                    | **None** (identical)                   |
| **Market Data Columns**       | All 79 columns (FREE & PRO) | N/A                                         | All 79 columns (FREE & PRO)                 | **None** (identical)                   |
| **Max Alerts**                | FREE: 0, PRO: 100           | Pro Tier = 100 Alerts                       | FREE: 0, PRO: 100                           | **None** (identical)                   |
| **API Rate Limit**            | FREE: 60/hr, PRO: 300/hr    | N/A                                         | FREE: 60/hr, PRO: 300/hr                    | **None** (identical)                   |
| **PRO Monthly Price**         | $29 (via env)               | $29.00 USD / month                          | $29 (configurable via env)                  | **None** (identical)                   |
| **Free Trial Duration**       | 7 Days (Full PRO)           | 7 Days Free Trial                           | 7 Days (Full PRO)                           | **None** (identical)                   |
| **Drawing Tools (Canvas)**    | Client-side enabled         | N/A                                         | FREE: Visual only, PRO: Visual only         | **None** (identical)                   |
| **Drawing Line Alerts**       | Mentioned in comments       | N/A                                         | FREE: 🔒 0, PRO: ⚡ up to 100 alerts        | **Zero downgrade** (PRO gains feature) |
| **AI Analyst Chat (Stack D)** | Not defined yet             | N/A                                         | FREE: 🔒 Locked, PRO: ⚡ 500k tokens/mo     | **Zero downgrade** (PRO gains feature) |
| **Market Comments (Stack E)** | Not defined yet             | N/A                                         | FREE: 🔒 Locked, PRO: ⚡ Live Socket Stream | **Zero downgrade** (PRO gains feature) |
| **Quality Metrics (Stack E)** | Not defined yet             | N/A                                         | FREE: 🔒 Locked, PRO: ⚡ 4 Live Metrics     | **Zero downgrade** (PRO gains feature) |

---

## Blast-Radius Analysis & Customer Impact

- **Existing Paying PRO Users:**
  - **Risk:** Zero downgrade. All existing PRO capabilities (100 alerts, rate limits, data access, $29/mo billing, 7-day trial) remain 100% intact.
  - **Enhancement:** PRO subscribers gain formal entitlements for Stack D (AI Analyst Chat with 500k monthly tokens), Stack E (real-time comments & 4 quality metrics), and Phase 10 line-touch alerts.
- **FREE Users:**
  - **Risk:** Zero disruption. Full numerical market data access for `XAUUSD` (`M5`/`M15`) remains unrestricted. Gated features display clean upgrade prompts.
- **Billing Integrity:**
  - `STRIPE_PRO_PRICE_ID` and checkout session creation remain strictly pegged to $29 USD, preventing any disruption to Stripe or dLocal recurring billing cycles.

---

## Entry criteria (re-verify all at CONFIRM)

- [ ] **Phase 8A (Sessions 8-1, 8-2) CLOSED SUCCESSFUL** in `CLAUDE.md`.
- [ ] **Baseline test suites 100% green**:
  - Monolith `test:ci`: 150/150 suites, 2176/2176 tests.
  - `operation-service`: 42/42 suites, 395/395 tests.
  - `money-service`: 62/62 suites, 532/532 tests.
  - `railway-gateway`: 3/3 suites, 23/23 tests.
- [ ] **Live Stripe & config cross-check verified**: `STRIPE_PRO_PRICE_ID` matches $29/mo, `lib/tier-config.ts` confirms 100 max alerts for PRO and 0 for FREE.
- [ ] **Davin present for F68 and F74 explicit sign-offs (`⚠ NEEDS EXPLICIT SIGN-OFF`)**.

---

## Ordered Steps

_(each step = change → immediate verification → rollback note)_

### Step 1: Verify Live Stripe Catalog & Monolith Tier References

- **Action:**
  - Inspect `lib/stripe/stripe.ts` and `lib/tier-config.ts` to confirm existing price constants (`PRO_TIER_PRICE = 29`, `STRIPE_PRO_PRICE_ID`, `TRIAL_CONFIG.DURATION_DAYS = 7`).
  - Confirm that no files in the monolith or microservices have hardcoded conflicting tier values.
- **Safety Guarantee:** Read-only inspection; zero production impact.
- **Verify:** Logged verification of price and limit alignments.
- **Rollback:** None.

### Step 2: Hoist Tier Interfaces, Constants & Helper Functions to `@trading-alerts/types`

- **Action:**
  1. In `packages/types/src/tier/`:
     - Create `types.ts` defining:

       ```typescript
       export type Tier = 'FREE' | 'PRO';

       export interface TierConfig {
         name: string;
         price: number;
         symbols: number;
         timeframes: number;
         chartCombinations: number;
         maxAlerts: number;
         rateLimit: number; // requests per hour

         // Drawing tool-set entitlements (Phase 10)
         drawingAlertsAllowed: boolean;

         // Stack D (AI Analyst) entitlements
         aiAnalystAllowed: boolean;
         aiMonthlyTokenQuota: number; // 0 for FREE, 500_000 for PRO

         // Stack E (Market Comments & Quality Metrics) entitlements
         marketCommentsFeedAllowed: boolean;
         marketQualityMetricsAllowed: boolean;
       }
       ```

     - Create `constants.ts` defining canonical `FREE_TIER_CONFIG`, `PRO_TIER_CONFIG`, `TIER_CONFIGS`, `SYMBOLS`, `TIMEFRAMES`, `TRIAL_CONFIG`.
     - Create `helpers.ts` defining validation and access helper functions (`getTierConfig`, `canAccessAiAnalyst`, `canAccessMarketComments`, `canAccessDrawingAlerts`, `canAccessSymbol`, `canAccessTimeframe`).
     - Create `index.ts` exporting all tier definitions.

  2. In `packages/types/src/index.ts`: export `* from './tier'`.
  3. In `packages/types/`: run `pnpm build` (or `npm run build`) to compile type declarations.

- **Safety Guarantee:** Shared types package update; purely additive TypeScript interfaces.
- **Verify:** `packages/types` builds cleanly with zero errors.
- **Rollback:** `git checkout -- packages/types/`.

### Step 3: Reconcile `lib/tier-config.ts` in Monolith

- **Action:**
  - Update `lib/tier-config.ts` to re-export and integrate with `@trading-alerts/types`:
    - Ensure backwards-compatible exports (`Tier`, `TierConfig`, `TIER_CONFIGS`, `FREE_TIER_CONFIG`, `PRO_TIER_CONFIG`, `TRIAL_CONFIG`, `PRO_MONTHLY_PRICE`, etc.).
    - Maintain existing helper functions (`getTierConfig`, `getAccessibleSymbols`, `getAccessibleTimeframes`, `canAccessSymbol`, `canAccessTimeframe`, `getChartCombinations`).
    - Add re-exports for the new Stack D/E and Drawing alert helper functions.
- **Safety Guarantee:** Local file update; maintains 100% backwards compatibility for existing imports.
- **Verify:** Run monolith `npx tsc --noEmit` and verify clean compilation.
- **Rollback:** `git checkout -- lib/tier-config.ts`.

### Step 4: Add Comprehensive Tier Matrix Unit Tests

- **Action:**
  - In `packages/types/test/tier.spec.ts` (and/or `__tests__/lib/tier-config.test.ts`):
    - Test `FREE_TIER_CONFIG` fields: 0 alerts, 60 rate limit, `aiAnalystAllowed === false`, `aiMonthlyTokenQuota === 0`, `marketCommentsFeedAllowed === false`, `drawingAlertsAllowed === false`.
    - Test `PRO_TIER_CONFIG` fields: 100 alerts, 300 rate limit, `aiAnalystAllowed === true`, `aiMonthlyTokenQuota === 500_000`, `marketCommentsFeedAllowed === true`, `marketQualityMetricsAllowed === true`, `drawingAlertsAllowed === true`.
    - Test validation helpers (`canAccessAiAnalyst`, `canAccessMarketComments`, `canAccessDrawingAlerts`).
- **Safety Guarantee:** Test files only; zero production impact.
- **Verify:** Run `pnpm test` in `packages/types` and monolith test runner; all tier tests pass 100%.
- **Rollback:** `git checkout -- packages/types/test/ __tests__/`.

### Step 5: Full Monorepo Build, Typecheck, and Test Suites

- **Action:**
  - Run `npx tsc --noEmit` across monolith, `operation-service`, `money-service`, and `railway-gateway`.
  - Run full test suites:
    - Monolith `npm run test:ci` (expect $\ge 150$ suites, $\ge 2176$ tests).
    - `operation-service` `npm test` (42/42 suites, 395/395 tests).
    - `money-service` `npm test` (62/62 suites, 532/532 tests).
    - `railway-gateway` `npm test` (3/3 suites, 23/23 tests).
- **Safety Guarantee:** Read-only test execution.
- **Verify:** All 4 test suites pass 100% green with zero regressions.
- **Rollback:** None.

### Step 6: Session Close-Out & Flag Resolutions (F68, F74)

- **Action:**
  - Mark **F68** and **F74** as **RESOLVED** in `DECISION-LOG.md` (quoting Davin's sign-offs).
  - Update `CLAUDE.md`: Current entry Session 11-1 CLOSED SUCCESSFUL.
  - Update `migration-stack-analysis.md`: Add Session 11-1 entry.
  - PRE-DRAFT Session 11-2 (`11-2-guards-jwt-claims-header-forwarding.migration-order.md`).
- **Safety Guarantee:** Documentation updates only.
- **Verify:** Git working tree clean.
- **Rollback:** None.

---

## Rules specific to this variant

- **Ground truth priority:** Live code (`lib/tier-config.ts` & `lib/stripe/stripe.ts`) > Live Stripe configuration > Preparatory Specification > Older documents.
- **Zero Customer Downgrade:** Under no circumstances may any existing entitlement for paying PRO users be reduced or removed.
- **Nothing fragmented:** Single source of truth for all tier definitions must live in `@trading-alerts/types` and be shared across the entire monorepo.

---

## Done when

- [ ] F68 and F74 resolved in `DECISION-LOG.md` with Davin's explicit sign-offs recorded.
- [ ] `@trading-alerts/types` updated with canonical `TierConfig` and helper functions.
- [ ] `lib/tier-config.ts` reconciled and cleanly re-exporting from `@trading-alerts/types`.
- [ ] Phase 10 deferred drawing tool-set entitlements (`drawingAlertsAllowed`) fully defined and tested.
- [ ] All 4 monorepo test suites pass 100% green with zero regressions.
- [ ] Session 11-2 PRE-DRAFTed.

---

## Rollback

- Code changes: `git checkout` / `git revert` on `packages/types/` and `lib/tier-config.ts`.
- Stripe: No Stripe dashboard changes are performed (read-only verification of existing $29 Price ID).

---

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

- **CONFIRM-time (2026-08-24, Davin-directed):** Step 1's live Stripe cross-check and the CONFIRM
  entry-criteria pass surfaced that `packages/types/package.json`'s `exports` map lists only `.`,
  `./geometry`, `./alert-engine`, `./validations` — no `./tier` subpath — while this order's own
  Decision 4 and Target Components line name `@trading-alerts/types/tier` as the import path.
  Step 2's action list as originally written only edited `src/index.ts`, which would have made the
  subpath import fail at runtime under Node's `exports`-map enforcement even though the root import
  would work. Flagged to Davin at CONFIRM; Davin directed adding the `./tier` subpath export to
  `package.json` alongside the `src/index.ts` root re-export, so both import styles resolve. Step 2
  executed with this addition folded in — not a scope change, a correctness fix to the step as
  literally written.
- **Step 2 (2026-08-24):** `packages/types/src/index.ts`'s existing wildcard re-export from
  `./validations/alert` already exports `SYMBOLS`/`TIMEFRAMES` (identical values: `['XAUUSD']`,
  `['M5','M15']`) at the package's root barrel — a pre-existing duplication the order's Decision 4
  ("Rejected: Keeping TierConfig duplicated...") did not know about, discovered only when `tsc`
  failed on the ambiguous re-export (`TS2308`) after adding `export * from './tier'`. Resolved by
  explicitly re-exporting `./tier`'s other members from the root barrel while omitting its
  `SYMBOLS`/`TIMEFRAMES` (root barrel keeps the `validations/alert` copies it already had); the
  `@trading-alerts/types/tier` subpath still exports its own `SYMBOLS`/`TIMEFRAMES` unaffected.
  `validations/alert.ts` itself left untouched — out of this session's scope, a build-tooling
  collision fix, not a payments/auth/entitlement decision, resolved under this order's own "Ground
  truth priority: live code" rule rather than escalated.

---

## Next-session handoff

- **Next session:** `11-2` — Guards, JWT Claims & Header Forwarding (Phase 11, second of 3 sessions).
- **Prerequisite:** Session 11-1 CLOSED SUCCESSFUL (canonical tier matrix and types in `@trading-alerts/types`).
- **Focus:** `lib/tier-validation.ts`, NestJS `TierGuard`, JWT payload claims in `operation-service/src/auth/`, and fixing header forwarding in `forwardedRequestContext()`.
