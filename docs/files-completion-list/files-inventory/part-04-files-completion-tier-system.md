# Part 4: Tier System & Constants - List of Files Completion

**Last Updated:** 2026-08-04
**Status:** ✅ Complete (100%)

---

## 📋 Files Built in Part 04

### Core Tier Configuration & Validation (`lib/`)

**File 1/12:** ✅ `lib/tier-config.ts`

- **Status:** Complete
- **Description:** Centralized single source of truth for tier configuration and constants (V8 architecture)
- **Key Features:**
  - Single symbol (`SYMBOLS = ['XAUUSD']`) and timeframes (`TIMEFRAMES = ['M5', 'M15']`) for BOTH tiers
  - Identical data access (all 79 `market_data_v6` columns) for both tiers
  - FREE Tier: 0 alerts, 60 req/hour, $0/month
  - PRO Tier: 100 alerts, multi-timeframe visualization & drawing-engine line alerts enabled, 300 req/hour, $29/month (`NEXT_PUBLIC_PRO_PRICE_MONTHLY`), 7-day free trial
  - Functions: `getTierConfig()`, `getAccessibleSymbols()`, `getAccessibleTimeframes()`, `canAccessSymbol()`, `canAccessTimeframe()`, `getChartCombinations()`

**File 2/12:** ✅ `lib/tier-validation.ts`

- **Status:** Complete
- **Description:** User access validation logic based on subscription tier
- **Key Features:**
  - Alert limit gating (`canCreateAlert()` — FREE: always denied with PRO upgrade message; PRO: allowed up to 100)
  - Ungated symbol & timeframe validation for XAUUSD / M5 & M15
  - Ungated indicator & column access stubs (`canAccessIndicator()` always returns `true`)
  - Hourly rate limit helpers (`getRateLimit()`)
  - Comprehensive access validation helper (`validateFullTierAccess()`)

**File 3/12:** ✅ `lib/tier-helpers.ts`

- **Status:** Complete
- **Description:** Helper functions for tier operations and display logic
- **Functions:**
  - `hasChartAccess()`, `getAvailableSymbols()`, `getAvailableTimeframes()`, `getChartCombinations()`
  - `allowsCombination()`, `getTierDisplayName()`, `canUpgradeTier()`, `getUpgradePath()`

---

### API Routes (`app/api/tier/`)

**File 4/12:** ✅ `app/api/tier/check/[symbol]/route.ts`

- **Status:** Complete
- **Description:** Symbol access check API endpoint (`GET /api/tier/check/[symbol]`)
- **Behavior:** V8 architecture — returns `allowed: true` for XAUUSD for any tier. Unknown symbols return `allowed: false` without upgrade prompts. Supports `operation-service` delegation when feature flag is active.

**File 5/12:** ✅ `app/api/tier/combinations/route.ts`

- **Status:** Complete
- **Description:** Chart combinations API endpoint (`GET /api/tier/combinations`)
- **Behavior:** V8 architecture — returns the 2 supported combinations (XAUUSD × M5/M15), identical for both tiers. Supports `operation-service` delegation when feature flag is active.

**File 6/12:** ✅ `app/api/tier/symbols/route.ts`

- **Status:** Complete
- **Description:** Accessible symbols API endpoint (`GET /api/tier/symbols`)
- **Behavior:** V8 architecture — returns the platform symbol list (`XAUUSD`), with `proOnly: false` (no PRO-exclusive symbols). Supports `operation-service` delegation when feature flag is active.

---

### Test Files

**File 7/12:** ✅ `__tests__/api/tier.test.ts`

- **Status:** Complete
- **Description:** Integration tests for tier API endpoints (`/api/tier/check/[symbol]`, `/api/tier/combinations`, `/api/tier/symbols`)

**File 8/12:** ✅ `__tests__/lib/tier-config.test.ts`

- **Status:** Complete
- **Description:** Unit tests for `lib/tier-config.ts` constants and helper functions

**File 9/12:** ✅ `__tests__/lib/tier-helpers.test.ts`

- **Status:** Complete
- **Description:** Unit tests for `lib/tier-helpers.ts` tier display, upgrade path, and chart access functions

**File 10/12:** ✅ `__tests__/lib/tier-validation.test.ts`

- **Status:** Complete
- **Description:** Unit tests for `lib/tier-validation.ts` validation functions and tier limits

---

### Documentation & Type Definitions

**File 11/12:** ✅ `docs/open-api-documents/part-04-tier-system-openapi.yaml`

- **Status:** Complete
- **Description:** OpenAPI 3.1.0 specification for Tier System API (regenerated in Session 0-2 for V8 single-symbol architecture)

**File 12/12:** ✅ `types/tier.ts`

- **Status:** Complete
- **Description:** Type definitions for tier system (`Tier`, `TierLimits`, `TrialStatus`, `Timeframe`, `Symbol`, `TIER_CONFIG`)

---

## 🗑️ Decommissioned & Deleted Files (Dead Code Cleanup)

The following 5 files were deleted during previous cleanup passes:

1. ~~`lib/tier/constants.ts`~~ — **Deleted 2026-07-08** (stale 63-column indicator metadata)
2. ~~`lib/tier/validator.ts`~~ — **Deleted 2026-07-08** (stale column-gating logic)
3. ~~`lib/tier/index.ts`~~ — **Deleted 2026-07-08** (barrel re-export)
4. ~~`lib/tier/__tests__/constants.test.ts`~~ — **Deleted 2026-07-07** (stale pre-V8 test)
5. ~~`lib/tier/__tests__/validator.test.ts`~~ — **Deleted 2026-07-08** (stale pre-V8 validator test)

---

## 📊 Status Summary

- **Total Production Files:** 12/12 (100%)
- **Library Files (`lib/`):** 3 files (`tier-config.ts`, `tier-validation.ts`, `tier-helpers.ts`)
- **API Routes (`app/api/tier/`):** 3 files (`check/[symbol]`, `combinations`, `symbols`)
- **Tests (`__tests__/`):** 4 files (`api/tier.test.ts`, `lib/tier-config.test.ts`, `lib/tier-helpers.test.ts`, `lib/tier-validation.test.ts`)
- **Documentation & Types:** 2 files (`part-04-tier-system-openapi.yaml`, `types/tier.ts`)

---

## 🎯 Tier System Features — V8 Architecture

### Current V8 Contract (Both Tiers)

- **Supported Symbol:** `XAUUSD` (Gold / US Dollar) only
- **Supported Timeframes:** `M5` (5 Minutes) and `M15` (15 Minutes)
- **Market Data Access:** Both tiers get full, ungated access to all 79 `market_data_v6` columns
- **Watchlists:** Removed from the product entirely for all tiers

### Tier Differentiation Breakdown

| Feature                       | FREE Tier           | PRO Tier                         |
| ----------------------------- | ------------------- | -------------------------------- |
| Symbols                       | 1 (`XAUUSD`)        | 1 (`XAUUSD`)                     |
| Timeframes                    | 2 (`M5`, `M15`)     | 2 (`M5`, `M15`)                  |
| Chart Combinations            | 2                   | 2                                |
| Market Data Columns           | All 79              | All 79                           |
| Max Price Alerts              | 0 (Alerts disabled) | 100                              |
| Drawing Line Alerts           | No                  | Yes                              |
| Multi-Timeframe Visualization | No                  | Yes                              |
| API Rate Limit                | 60 req/hour         | 300 req/hour                     |
| Price                         | $0/month            | Configurable (default $29/month) |
| Free Trial                    | N/A                 | 7-day free PRO trial             |

---

## 🔗 Related Documentation

- **Tier Configuration Source:** `lib/tier-config.ts`
- **Tier Access Validation:** `lib/tier-validation.ts`
- **Type Definitions:** `types/tier.ts`
- **OpenAPI Specification:** `docs/open-api-documents/part-04-tier-system-openapi.yaml`

---

**Part 04 Status:** ✅ Complete and production-ready
