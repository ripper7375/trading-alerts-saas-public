# Part 10: Watchlist System - Build Order

**From:** `docs/v5-structure-division.md` Part 10
**Total Files:** 8 files
**Estimated Time:** 3 hours
**Priority:** ⭐⭐ Medium
**Complexity:** Medium

---

## Overview

**Scope:** Watchlist management with symbol+timeframe combinations, tier-based limits.

**Implementation Guide References:**

- `docs/implementation-guides/v5_part_j.md` - Watchlist system business logic and requirements

**Key Changes from V4:**

- ✅ Complete rewrite: Symbol+timeframe combinations (not just symbols)
- ✅ Tier-based symbol filtering
- ✅ WatchlistItem model usage
- ✅ Reordering support

**Dependencies:**

- Part 2 complete (WatchlistItem model)
- Part 4 complete (Tier validation)

---

## File Build Order

**File 1/8:** `app/(dashboard)/watchlist/page.tsx`

- Watchlist page
- Create watchlist button
- List of watchlist items (symbol + timeframe)
- Tier-based add limits
- Seed: `seed-code/v0-components/watchlist-page-component/app/watchlist/page.tsx`
- Commit: `feat(watchlist): add watchlist page`

**File 2/8:** `app/api/watchlist/route.ts`

- GET: List user watchlists
- POST: Create watchlist with symbol+timeframe
- Validate tier limits
- Validate symbol+timeframe access
- Commit: `feat(api): add watchlist CRUD endpoints`

**File 3/8:** `app/api/watchlist/[id]/route.ts`

- GET: Get watchlist by ID
- PATCH: Update watchlist
- DELETE: Delete watchlist
- Commit: `feat(api): add watchlist detail endpoints`

**File 4/8:** `app/api/watchlist/reorder/route.ts`

- POST: Reorder watchlist items
- Update order field
- Commit: `feat(api): add watchlist reorder endpoint`

**File 5/8:** `components/watchlist/symbol-selector.tsx`

- Symbol dropdown
- Tier-filtered symbols only
- Search functionality
- Commit: `feat(watchlist): add tier-filtered symbol selector`

**File 6/8:** `components/watchlist/timeframe-grid.tsx`

- Timeframe selection grid
- Disable PRO timeframes for FREE users
- Visual tier gates
- Commit: `feat(watchlist): add timeframe grid with tier gates`

**File 7/8:** `components/watchlist/watchlist-item.tsx`

- Display symbol + timeframe combination
- Remove button
- Click to view chart
- Commit: `feat(watchlist): add watchlist item component`

**File 8/8:** `hooks/use-watchlist.ts`

- React hook for watchlist operations
- CRUD operations
- Tier limit checking
- Commit: `feat(watchlist): add watchlist data hook`

---

## Success Criteria

- ✅ All 8 files created
- ✅ Watchlists show symbol+timeframe combinations
- ✅ Tier limits enforced (FREE: 1 watchlist, PRO: 5 watchlists)
- ✅ Symbol filtering works
- ✅ Timeframe filtering works
- ✅ Reordering works

---

**Last Updated:** 2025-11-18
