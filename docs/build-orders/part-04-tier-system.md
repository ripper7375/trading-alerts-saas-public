# Part 4: Tier System & Constants - Build Order

**From:** `docs/v5-structure-division.md` Part 4
**Total Files:** 4 files
**Estimated Time:** 2 hours
**Priority:** ⭐⭐⭐ High
**Complexity:** Medium

---

## Overview

**Scope:** Core tier management system for access control, symbol/timeframe validation, and tier-based feature gating.

**Implementation Guide References:**

- `docs/implementation-guides/v5_part_d.md` - Utilities & Helpers including tier validation logic and helper functions
- `docs/policies/00-tier-specifications.md` - Complete tier system rules, constants, and feature limits

**Key Changes from V4:**

- ✅ NEW folder: `lib/tier/` (complete tier management system)
- ✅ Timeframes: M5, H12 added; FREE tier limited to 3 timeframes (H1, H4, D1)
- ✅ Symbol lists per tier: FREE (5 symbols), PRO (15 symbols)
- ✅ Access validation functions for BOTH symbols AND timeframes
- ✅ PRO-only timeframes: M5, M15, M30, H2, H8, H12
- ✅ 5 new symbols added: AUDJPY, GBPJPY, NZDUSD, USDCAD, USDCHF

**Dependencies:**

- Requires Part 3 complete (Type definitions with Tier, Symbol, Timeframe types)

**Integration Points:**

- Used by ALL parts that check symbol/timeframe access (Charts, Alerts, Watchlists, Indicators)
- Middleware for tier-based route protection
- Validator for API request validation

---

## File Build Order

Build these files **in sequence**:

---

### File 1/4: `lib/tier/constants.ts`

**Purpose:** Centralized tier constants for symbols, timeframes, and feature limits

**From v5-structure-division.md:**

> NEW - TIER_SYMBOLS, TIMEFRAMES constants

**Implementation Details:**

- **Reference Guide:** `docs/policies/00-tier-specifications.md`
- **Pattern:** Constants file with readonly arrays and maps
- **Seed Code Reference:** None (new file)

**Dependencies:**

- Part 3 complete (types/tier.ts for Tier, Symbol, Timeframe types)

**Build Steps:**

1. **Read Requirements**

   ```
   - 00-tier-specifications.md (complete tier specs)
   - types/tier.ts (Tier types)
   - FREE: 5 symbols × 3 timeframes
   - PRO: 15 symbols × 9 timeframes
   ```

2. **Key Implementation Points**
   - Define FREE_TIER_SYMBOLS (5 symbols: BTCUSD, EURUSD, USDJPY, US30, XAUUSD)
   - Define PRO_TIER_EXCLUSIVE_SYMBOLS (10 additional symbols)
   - Define FREE_TIER_TIMEFRAMES (3 timeframes: H1, H4, D1)
   - Define PRO_TIER_TIMEFRAMES (9 timeframes: all)
   - Create TIER_LIMITS configuration object
   - Add symbol/timeframe display names
   - Include pricing constants

3. **Validation**
   - FREE tier: exactly 5 symbols, 3 timeframes
   - PRO tier: exactly 15 symbols, 9 timeframes
   - All symbols have display names
   - All timeframes have labels and minute values
   - No ENTERPRISE tier references

4. **Commit**
   ```
   git add lib/tier/constants.ts
   git commit -m "feat(tier): add tier system constants for 2-tier system"
   ```

---

### File 2/4: `lib/tier/validator.ts`

**Purpose:** Symbol and timeframe access validation functions

**From v5-structure-division.md:**

> NEW - Symbol access validation

**Implementation Details:**

- **Reference Guide:** `docs/policies/00-tier-specifications.md`
- **Pattern:** Validation functions with detailed error messages
- **OpenAPI Reference:** N/A (internal utility)

**Dependencies:**

- File 1/4 complete (constants.ts)
- Part 3 complete (types)

**Build Steps:**

1. **Read Requirements**

   ```
   - Validate symbol access for tier
   - Validate timeframe access for tier
   - Validate symbol+timeframe combination
   - Return detailed error messages for UI display
   ```

2. **Key Implementation Points**
   - validateSymbolAccess(symbol, tier) function
   - validateTimeframeAccess(timeframe, tier) function
   - validateChartAccess(symbol, timeframe, tier) function
   - validateFeatureAccess(feature, tier) function
   - validateAlertLimit(count, tier) function
   - validateWatchlistLimit(count, tier) function
   - Helper functions: getAllowedSymbols, getAllowedTimeframes, getAllowedCombinations

3. **Validation**
   - Validation functions return detailed error messages
   - FREE tier restrictions enforced
   - PRO tier has full access
   - Helper functions provide combination counts

4. **Commit**
   ```
   git add lib/tier/validator.ts
   git commit -m "feat(tier): add symbol and timeframe validation functions"
   ```

---

### File 3/4: `lib/tier/middleware.ts`

**Purpose:** Next.js middleware for tier-based route protection

**From v5-structure-division.md:**

> NEW - Tier access control middleware

**Implementation Details:**

- **Pattern:** Next.js middleware with session checking
- **Reference Guide:** `docs/policies/03-architecture-rules.md`

**Dependencies:**

- File 1/4, File 2/4 complete (constants, validator)
- Part 3 complete (types)

**Build Steps:**

1. **Key Implementation Points**
   - requireTier(tier) function for route protection
   - getUserTier() helper function
   - isProUser(), isFreeUser() helper functions
   - Return TierCheckResult with error details

2. **Validation**
   - Middleware checks session authentication
   - Tier validation works correctly
   - Error messages are user-friendly

3. **Commit**
   ```
   git add lib/tier/middleware.ts
   git commit -m "feat(tier): add tier-based route protection middleware"
   ```

---

### File 4/4: `lib/config/plans.ts`

**Purpose:** Subscription plan configuration for 2-tier system

**From v5-structure-division.md:**

> Updated for 2 tiers

**Implementation Details:**

- **Reference Guide:** `docs/policies/00-tier-specifications.md`
- **OpenAPI Reference:** `docs/trading_alerts_openapi.yaml` → Plan schemas

**Dependencies:**

- File 1/4 complete (constants.ts for tier limits)

**Build Steps:**

1. **Key Implementation Points**
   - FREE_PLAN configuration (price: $0, 5 symbols, 3 timeframes, 5 alerts)
   - PRO_PLAN configuration (price: $29, 15 symbols, 9 timeframes, 20 alerts)
   - PLANS array with both plans
   - getPlanByTier(tier) helper
   - getUpgradeBenefits() for upgrade UI

2. **Validation**
   - 2 plans only (FREE, PRO)
   - Prices correct ($0, $29)
   - Features align with tier specifications
   - Limits match constants

3. **Commit**
   ```
   git add lib/config/plans.ts
   git commit -m "feat(tier): add subscription plan configuration for 2-tier system"
   ```

---

## Testing After Part Complete

Once all 4 files are built:

1. **Test Validation Functions**

   ```bash
   # Create test file
   cat > test-tier.ts << 'EOF'
   import { validateSymbolAccess, validateTimeframeAccess, getCombinationCount } from '@/lib/tier/validator';

   // Test FREE tier
   console.log(validateSymbolAccess('XAUUSD', 'FREE')); // allowed
   console.log(validateSymbolAccess('GBPUSD', 'FREE')); // denied
   console.log(validateTimeframeAccess('H1', 'FREE')); // allowed
   console.log(validateTimeframeAccess('M5', 'FREE')); // denied

   // Test combinations
   console.log('FREE combinations:', getCombinationCount('FREE')); // 15
   console.log('PRO combinations:', getCombinationCount('PRO')); // 135
   EOF

   npx tsx test-tier.ts
   rm test-tier.ts
   ```

2. **Verify Constants**

   ```bash
   node -e "
   const { TIER_LIMITS } = require('./lib/tier/constants');
   console.log('FREE symbols:', TIER_LIMITS.FREE.allowedSymbols.length);
   console.log('PRO symbols:', TIER_LIMITS.PRO.allowedSymbols.length);
   console.log('FREE timeframes:', TIER_LIMITS.FREE.allowedTimeframes.length);
   console.log('PRO timeframes:', TIER_LIMITS.PRO.allowedTimeframes.length);
   "
   ```

3. **Test Plan Configuration**
   ```bash
   node -e "
   const { PLANS, getUpgradeBenefits } = require('./lib/config/plans');
   console.log('Plans:', PLANS.length); // 2
   console.log('Upgrade benefits:', getUpgradeBenefits());
   "
   ```

---

## Success Criteria

- ✅ All 4 files built and committed
- ✅ Tier constants match specifications (5 symbols FREE, 15 PRO, etc.)
- ✅ Validation functions work correctly
- ✅ Middleware enforces tier restrictions
- ✅ Plan configuration complete for 2 tiers
- ✅ No ENTERPRISE tier references
- ✅ All exports work without errors
- ✅ PROGRESS.md updated

---

## Next Steps

- Ready for Part 5: Authentication (uses tier types and validation)
- Ready for Part 7: Indicators API (uses tier validation)
- Ready for Part 9: Charts (uses chart combination validation)
- Unblocks: All tier-gated features

---

## Escalation Scenarios

**Scenario 1: Tier limits need adjustment**

- Issue: Product team wants to change tier limits
- Solution: Update TIER_LIMITS in constants.ts
- Impact: All validation automatically updates

**Scenario 2: New tier needed**

- Issue: Business wants to add ENTERPRISE tier back
- Escalate to: Product team for tier specification
- Files to update: constants.ts, validator.ts, plans.ts, types/tier.ts

---

**Last Updated:** 2025-11-18
**Alignment:** (E) Phase 3 → (B) Part 4 → (C) This file
