# Part 9: Charts & Visualization - Build Order

**From:** `docs/v5-structure-division.md` Part 9
**Total Files:** 8 files
**Estimated Time:** 4 hours
**Priority:** ⭐⭐⭐ High
**Complexity:** High

---

## Overview

**Scope:** Trading charts with TradingView Lightweight Charts and tier-based filtering.

**Implementation Guide References:**

- `docs/implementation-guides/v5_part_i.md` - Charts and visualization business requirements

**Key Changes from V4:**

- ✅ Timeframe selector: M5, H12 added; FREE tier limited to H1, H4, D1
- ✅ Symbol selector shows tier-allowed symbols only
- ✅ Chart validates BOTH symbol AND timeframe access
- ✅ PRO-only timeframes: M5, M15, M30, H2, H8, H12

**Dependencies:**

- Part 4 complete (Tier validation)
- Part 7 complete (Indicators API)

**Integration Points:**

- Uses /api/indicators for data
- Uses tier validation for access control

---

## File Build Order

**File 1/8:** `app/(dashboard)/charts/page.tsx`

- Charts page with symbol/timeframe selectors
- Tier-filtered symbol list
- Tier-filtered timeframe list
- Redirect to default chart
- Commit: `feat(charts): add charts page with tier filtering`

**File 2/8:** `app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx`

- Individual chart page
- Validate tier access to combination
- Load trading-chart component
- Commit: `feat(charts): add dynamic chart page with tier validation`

**File 3/8:** `components/charts/trading-chart.tsx`

- TradingView Lightweight Charts integration
- Load candlestick data
- Overlay indicators (fractal horizontal/diagonal)
- Real-time updates
- Seed: `seed-code/v0-components/trading-chart-component/app/page.tsx`
- Custom Component: `seed-code/v0-components/trading-chart-component/components/trading-chart.tsx`
- Commit: `feat(charts): add TradingView chart component`

**File 4/8:** `components/charts/indicator-overlay.tsx`

- Render indicators on chart
- Support/resistance lines
- Commit: `feat(charts): add indicator overlay component`

**File 5/8:** `components/charts/chart-controls.tsx`

- Symbol selector (tier-filtered)
- Timeframe selector (tier-filtered)
- Zoom controls
- Export button (PRO only)
- Seed: `seed-code/v0-components/chart-controls-component/app/page.tsx`
- Custom Components:
  - `seed-code/v0-components/chart-controls-component/components/chart-controls.tsx`
  - `seed-code/v0-components/chart-controls-component/components/symbol-selector.tsx`
  - `seed-code/v0-components/chart-controls-component/components/timeframe-selector.tsx`
  - `seed-code/v0-components/chart-controls-component/components/upgrade-modal.tsx`
- Commit: `feat(charts): add chart controls with tier filtering`

**File 6/8:** `components/charts/timeframe-selector.tsx`

- Timeframe buttons
- Disable PRO timeframes for FREE users
- Show upgrade prompt
- Commit: `feat(charts): add timeframe selector with tier gates`

**File 7/8:** `hooks/use-indicators.ts`

- React hook for fetching indicator data
- Call /api/indicators/[symbol]/[timeframe]
- Handle loading/error states
- Tier validation
- Commit: `feat(charts): add indicators data hook`

**File 8/8:** `hooks/use-auth.ts`

- React hook for auth session
- Get user tier
- Check if authenticated
- Commit: `feat(auth): add auth session hook`

---

## Success Criteria

- ✅ All 8 files created
- ✅ Charts render with TradingView
- ✅ Symbol/timeframe selectors work
- ✅ Tier filtering enforced
- ✅ Indicators overlay correctly
- ✅ PRO features gated for FREE users

---

**Last Updated:** 2025-11-18
