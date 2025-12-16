# Part 8: Dashboard & Layout Components - Build Order

**From:** `docs/v5-structure-division.md` Part 8
**Total Files:** 9 files
**Estimated Time:** 3 hours
**Priority:** ⭐⭐ Medium
**Complexity:** Medium

---

## Overview

**Scope:** Main dashboard layout and dashboard overview page with tier-based stats.

**Implementation Guide References:**

- `docs/implementation-guides/v5_part_h.md` - Dashboard layout and component specifications

**Key Changes from V4:**

- ✅ Show user tier in header
- ✅ Tier-based navigation items
- ✅ Dashboard stats per tier

**Dependencies:**

- Part 5 complete (Authentication)
- Part 4 complete (Tier system)

**Integration Points:**

- Layout wraps all dashboard pages
- Header shows tier badge
- Navigation adapts to tier

---

## File Build Order

**File 1/9:** `app/(dashboard)/layout.tsx`

- Dashboard layout with sidebar
- Show tier badge in header
- Tier-based menu items (hide PRO features for FREE users)
- Commit: `feat(dashboard): add layout with tier badge`

**File 2/9:** `app/(dashboard)/dashboard/page.tsx`

- Dashboard overview page
- Stats cards: alerts count, watchlists, tier info
- Recent alerts widget
- Watchlist widget
- Seed: `seed-code/v0-components/dashboard-home-component/app/page.tsx`
- Custom Component: `seed-code/v0-components/dashboard-home-component/components/dashboard-home.tsx`
- Commit: `feat(dashboard): add overview page`

**File 3/9:** `components/layout/header.tsx`

- Top header with logo
- User menu (tier badge, settings, logout)
- Notification bell
- Commit: `feat(layout): add header with tier display`

**File 4/9:** `components/layout/sidebar.tsx`

- Navigation menu
- Hide PRO features for FREE tier
- Active link highlighting
- Commit: `feat(layout): add sidebar with tier-based menu`

**File 5/9:** `components/layout/mobile-nav.tsx`

- Mobile navigation drawer
- Same tier-based logic
- Commit: `feat(layout): add mobile navigation`

**File 6/9:** `components/layout/footer.tsx`

- Dashboard footer
- Links, copyright
- Seed: `seed-code/v0-components/footer-component/app/page.tsx`
- Custom Component: `seed-code/v0-components/footer-component/components/marketing-footer.tsx`
- Commit: `feat(layout): add footer`

**File 7/9:** `components/dashboard/stats-card.tsx`

- Reusable stats card
- Icon, title, value, change
- Commit: `feat(dashboard): add stats card component`

**File 8/9:** `components/dashboard/recent-alerts.tsx`

- Recent alerts widget
- Shows last 5 alerts
- Link to alerts page
- Commit: `feat(dashboard): add recent alerts widget`

**File 9/9:** `components/dashboard/watchlist-widget.tsx`

- Watchlist preview widget
- Shows symbols + timeframes
- Link to watchlist page
- Commit: `feat(dashboard): add watchlist widget`

---

## Success Criteria

- ✅ All 9 files created
- ✅ Dashboard layout renders
- ✅ Tier badge shows in header
- ✅ Navigation adapts to tier
- ✅ Stats display correctly
- ✅ Mobile navigation works

---

**Last Updated:** 2025-11-18
