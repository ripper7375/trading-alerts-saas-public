# Part 4: Tier System & Constants - List of files completion

## Core Tier Configuration (lib/)

**File 1/9:** ✅ `lib/tier-config.ts` - Centralized tier configuration (V8: XAUUSD/M5/M15 for both tiers — see Update 2026-07-08)
**File 2/9:** ✅ `lib/tier-validation.ts` - User access validation based on subscription tier (V8: indicator/column access always allowed)
**File 3/9:** ✅ `lib/tier-helpers.ts` - Helper functions for tier operations

## Indicator Tier System (lib/tier/) — ❌ REMOVED 2026-07-08 (dead code)

~~**File 4/9:** `lib/tier/constants.ts`~~ - **DELETED** — indicator tier constants/metadata/colors
for the decommissioned 63-column schema; only consumed by the two dead chart components below
~~**File 5/9:** `lib/tier/validator.ts`~~ - **DELETED** — access-control functions for
tier-gated indicators/columns; V8 made all of this ungated, and its only real caller was
`components/charts/indicator-toggles.tsx`
~~**File 6/9:** `lib/tier/index.ts`~~ - **DELETED** — barrel re-export with zero external
consumers once the two files above were confirmed dead

See the Update 2026-07-08 section below for the full investigation (traced transitively: nothing
live imported any of `lib/tier/*` outside `components/charts/{indicator-toggles,pro-indicator-overlay}.tsx`,
which were also deleted the same day — see `part-09-files-completion.md`).

## API Routes (app/api/tier/)

**File 4/9:** ✅ `app/api/tier/check/[symbol]/route.ts` - V8: `allowed=true` only for XAUUSD, any tier
**File 5/9:** ✅ `app/api/tier/combinations/route.ts` - V8: returns the 2 XAUUSD×{M5,M15} combinations, identical for both tiers
**File 6/9:** ✅ `app/api/tier/symbols/route.ts` - V8: returns the single-symbol list, no `proOnly` flag

## Tests

~~`lib/tier/__tests__/constants.test.ts`~~ - **DELETED 2026-07-07** as a stale pre-V8 test
(asserted a FREE/PRO indicator split that no longer exists)
~~`lib/tier/__tests__/validator.test.ts`~~ - **DELETED 2026-07-08** — tested the deleted `validator.ts`
**File 7/9:** ✅ `__tests__/api/tier.test.ts` - Tests for tier API endpoints (updated 2026-07-07 for V8 limits)

## Documentation

**File 8/9:** ✅ `docs/open-api-documents/part-04-tier-system-openapi.yaml` - OpenAPI specification (pre-V8; not yet updated to reflect the single-symbol contract — see Update note)
**File 9/9:** ✅ `types/tier.ts` - Canonical `Tier`/`TierLimits` types, tracked here since Part 04 owns the tier system (also listed under Part 03/08/16)

## Status Summary

- **Completed:** 9/9 current files (100%) — down from the original 13 (3 `lib/tier/*` files + 2
  test files deleted as dead code across 2026-07-07/08; see Update note)
- **Missing:** None (of what's meant to exist today)
- **Library Files:** 3 (was 6)
- **API Routes:** 3
- **Tests:** 1 (was 3)
- **Documentation:** 1

## Tier System Features — V8 (current, since 2026-07-07)

**Both tiers, identical:** XAUUSD only, M5 + M15 only, full access to all 79 `market_data_v6`
columns (no indicator/column gating — `canAccessIndicator`/`canAccessColumn` always return
`true`). See `change-to-new-design.md` and `lib/tier-config.ts`'s own doc comment.

**FREE Tier:** 0 alerts (Alerts are PRO-only), 60 req/hour, $0/month
**PRO Tier:** 100 alerts, multi-timeframe visualization, drawing-engine line alerts, 300
req/hour, configurable price/month (`NEXT_PUBLIC_PRO_PRICE_MONTHLY`, default $29), 7-day trial

Watchlists were removed from the product entirely (see `part-10-files-completion.md`) — there is
nothing left to size a "watchlist limit" against with a single symbol.

## Tier System Features — pre-V8 (historical, superseded 2026-07-07)

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
- 60 requests/hour (HTTP API; chart OHLCV uses WebSocket, does not count)
- **Chart OHLCV update: real-time via WebSocket** (push on price change, ≤0.25s detection)
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
- 300 requests/hour (HTTP API; chart OHLCV uses WebSocket, does not count)
- **Chart OHLCV update: real-time via WebSocket** (push on price change, ≤0.25s detection)
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

1. **GET /api/tier/check/[symbol]** - V8: `allowed=true` only for XAUUSD, for any tier; no
   `upgradeRequired` field anymore (no tier unlocks additional symbols)
2. **GET /api/tier/combinations** - V8: returns the 2 XAUUSD×{M5,M15} combinations, identical
   for both tiers, no tier gating
3. **GET /api/tier/symbols** - V8: returns the single-symbol list; no `proOnly` flag (nothing is
   PRO-exclusive at the symbol level anymore)

_(Pre-V8 versions of these three descriptions — tier-filtered symbol/timeframe lists — are
superseded; see each route's own file for the current implementation.)_

## Access Control Functions (current, in `lib/tier-config.ts` / `lib/tier-validation.ts`)

**Symbol & Timeframe (tier-independent in V8 — kept for API compatibility):**

- `canAccessSymbol(symbol, tier)` - Always `XAUUSD`-only check, `tier` ignored
- `canAccessTimeframe(timeframe, tier)` - Always `M5`/`M15`-only check, `tier` ignored

**Alerts (the one real gate left):**

- `canCreateAlert(tier, currentAlerts)` - FREE: always denied (403, "Alerts are a PRO feature");
  PRO: allowed up to 100

**Indicator/Column (V8: no gating — kept as always-`true`/always-empty stubs for compatibility):**

- `canAccessIndicator(indicator, tier)` - Always `true`
- `getAccessibleIndicators(tier)` / `getLockedIndicators(tier)` - Always `[]` (no metadata
  source left to enumerate — see the `lib/tier/*` deletion above)

**Removed (were tier-gated, no longer applicable — feature deleted, not just ungated):**

- ~~`canCreateWatchlist(currentCount, tier)`~~, ~~`canAddWatchlistItem(tier, currentItems)`~~ —
  watchlists removed from the product (2026-07-07)
- ~~`canAccessColumn(tier, columnName)`~~, ~~`filterDataByTier(tier, data)`~~,
  ~~`validateChartAccess(tier, symbol, timeframe)`~~ — lived in the deleted `lib/tier/validator.ts`

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
- Updated tier feature table to reflect real-time WebSocket chart updates (2026-03-05):
  both FREE and PRO chart OHLCV now delivered via Socket.IO push (no polling interval
  difference between tiers); HTTP request rate limits apply only to REST API calls

## Update 2026-07-08 — V8 single-symbol architecture + dead-code removal (this doc was stale on both)

This Part doc had not been touched during either the 2026-07-07 V8 reconciliation pass or the
2026-07-08 dead-code cleanup, despite Part 04 owning both the tier system that was rewritten and
two of the files that were deleted. Backfilling both now:

- **V8 rewrite (2026-07-07, `change-to-new-design.md`):** `lib/tier-config.ts`,
  `lib/tier-validation.ts`, `app/api/tier/{check/[symbol],combinations,symbols}/route.ts`,
  `__tests__/api/tier.test.ts`, and `types/tier.ts` were all rewritten for the single-symbol
  (XAUUSD, M5/M15) architecture — see the "V8 (current)" features section and the current
  Access Control Functions list above. Watchlist limits and PRO-exclusive
  symbol/timeframe/indicator gating no longer exist as concepts, not just as ungated stubs.
- **Dead-code removal (2026-07-08):** `lib/tier/constants.ts`, `lib/tier/validator.ts`, and
  `lib/tier/index.ts` were deleted — traced transitively and confirmed their only real consumers
  were `components/charts/indicator-toggles.tsx` and `components/charts/pro-indicator-overlay.tsx`
  (also deleted the same day; see `part-09-files-completion.md`), both of which modeled the
  already-decommissioned 63-column `MarketData` schema and were never rendered by any page.
  `lib/tier/__tests__/validator.test.ts` was deleted alongside (its own
  `lib/tier/__tests__/constants.test.ts` had already been deleted 2026-07-07 as a stale pre-V8
  test). Verified with a clean `tsc --noEmit` and full Jest run (111 suites, 2046 tests) after
  removal.
- **Not yet updated:** `docs/open-api-documents/part-04-tier-system-openapi.yaml` still describes
  the pre-V8 multi-symbol contract (5→15 symbols, 3→9 timeframes, watchlist limits). This spec
  file itself wasn't touched by this reconciliation pass — flagging it as known-stale rather than
  rewriting an OpenAPI contract as a side effect of a files-inventory audit.

Full detail in `backend-file-inventory.md`'s and `part-16-files-completion.md`'s own 2026-07-08
reconciliation notes.

---

**Last Updated:** 2026-07-08
