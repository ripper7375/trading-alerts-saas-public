# Part 4: Tier System & Constants - List of files completion

## Core Tier Configuration (lib/)

**File 1/13:** ✅ `lib/tier-config.ts` - Centralized tier configuration (symbols, timeframes, pricing)
**File 2/13:** ✅ `lib/tier-validation.ts` - User access validation based on subscription tier
**File 3/13:** ✅ `lib/tier-helpers.ts` - Helper functions for tier operations

## Indicator Tier System (lib/tier/)

**File 4/13:** ✅ `lib/tier/constants.ts` - Indicator tier constants, metadata, colors (57-column schema)
**File 5/13:** ✅ `lib/tier/validator.ts` - Access control functions for tier-gated indicators and columns
**File 6/13:** ✅ `lib/tier/index.ts` - Module re-exports

## API Routes (app/api/tier/)

**File 7/13:** ✅ `app/api/tier/check/[symbol]/route.ts` - Check symbol access for user's tier
**File 8/13:** ✅ `app/api/tier/combinations/route.ts` - Get all symbol+timeframe combinations
**File 9/13:** ✅ `app/api/tier/symbols/route.ts` - Get accessible symbols with metadata

## Tests

**File 10/13:** ✅ `lib/tier/__tests__/constants.test.ts` - Tests for indicator tier constants
**File 11/13:** ✅ `lib/tier/__tests__/validator.test.ts` - Tests for indicator tier validator
**File 12/13:** ✅ `__tests__/api/tier.test.ts` - Tests for tier API endpoints

## Documentation

**File 13/13:** ✅ `docs/open-api-documents/part-04-tier-system-openapi.yaml` - OpenAPI specification

## Status Summary
- **Completed:** 13/13 files (100%)
- **Missing:** None
- **Library Files:** 6
- **API Routes:** 3
- **Tests:** 3
- **Documentation:** 1

## Tier System Features

### Two-Tier Subscription Model

**FREE Tier:**
- 5 symbols (BTCUSD, EURUSD, USDJPY, US30, XAUUSD)
- 3 timeframes (H1, H4, D1)
- 15 chart combinations (5 × 3)
- 5 max alerts
- 1 max watchlist
- 5 max watchlist items
- 2 indicators (fractal_diagonal, fractal_horizontal)
- 24 total columns (8 system + 16 indicator)
- 60 requests/hour
- $0/month

**PRO Tier:**
- 15 symbols (all FREE + 10 additional)
- 9 timeframes (M5, M15, M30, H1, H2, H4, H8, H12, D1)
- 135 chart combinations (15 × 9)
- 20 max alerts
- 5 max watchlists
- 50 max watchlist items
- 8 indicators (all FREE + 6 PRO-only)
- 57 total columns (8 system + 49 indicator)
- 300 requests/hour
- $29/month
- 7-day free trial

### 57-Column Database Schema

**System Columns (8):** timestamp, open, high, low, close, volume, timeframe, collected_at

**FREE Indicators (16 columns):**
- fractal_diagonal (8): diag_asc_line_1-3, diag_desc_line_1-3, diag_high/low_map
- fractal_horizontal (8): horiz_peak_line_1-3, horiz_bottom_line_1-3, horiz_high/low_map

**PRO-Only Indicators (33 columns):**
- moving_averages (3): tema, hrma, smma
- body_momentum (2): z_score_of_body_size, candle_classification
- heiken_ashi (7): ha_open, ha_high, ha_low, ha_close, ha_classification, ha_body_size, ha_body_zscore
- keltner_channels (10): kc_ultra_extreme_upper → kc_ultra_extreme_lower
- support_resistance (8): sr_support_1-4, sr_resistance_1-4
- zigzag (3): zigzag_peak, zigzag_bottom, ema_26

## API Endpoints

1. **GET /api/tier/check/[symbol]** - Check if user's tier can access a specific symbol
2. **GET /api/tier/combinations** - Get all symbol+timeframe combinations for user's tier
3. **GET /api/tier/symbols** - Get accessible symbols with metadata (name, category, proOnly flag)

## Access Control Functions

**Symbol & Timeframe Validation:**
- `canAccessSymbol(tier, symbol)` - Check symbol access
- `canAccessTimeframe(timeframe, tier)` - Check timeframe access
- `validateChartAccess(tier, symbol, timeframe)` - Validate chart combination

**Alert & Watchlist Validation:**
- `canCreateAlert(tier, currentAlerts)` - Check alert limit
- `canCreateWatchlist(currentCount, tier)` - Check watchlist limit
- `canAddWatchlistItem(tier, currentItems)` - Check watchlist item limit

**Indicator Validation:**
- `canAccessIndicator(indicator, tier)` - Check indicator access
- `canAccessColumn(tier, columnName)` - Check database column access
- `filterDataByTier(tier, data)` - Filter API response data by tier

**Comprehensive Validation:**
- `validateFullTierAccess(params)` - Validate all tier restrictions in one call

## Notes

**Files removed from original list (functionality already exists):**

- ~~`lib/tier/middleware.ts`~~ - Validation logic covered by `lib/tier-validation.ts`
- ~~`lib/config/plans.ts`~~ - Tier/pricing config covered by `lib/tier-config.ts`

**Recent Updates:**

- Added 57-column database schema support (2025-01-24)
- Added column-level access control for indicators (2025-01-24)
- Added comprehensive OpenAPI specification (2025-01-24)
- Added tier system API endpoints (2025-01-24)
- Added test coverage for all tier functions (2025-01-24)
