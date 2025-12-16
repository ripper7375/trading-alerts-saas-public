# Part 11: Alerts System - Build Order

**From:** `docs/v5-structure-division.md` Part 11
**Total Files:** 10 files
**Estimated Time:** 4 hours
**Priority:** ⭐⭐ Medium
**Complexity:** Medium

---

## Overview

**Scope:** Alert management with tier-based limits, price alerts, and notifications.

**Implementation Guide References:**

- `docs/implementation-guides/v5_part_k.md` - Alerts system business logic, tier-based limits, and notification workflows

**Key Changes from V4:**

- ✅ Alert form shows only tier-allowed symbols
- ✅ API validates symbol access before creating alert
- ✅ Tier limits enforced (FREE: 5 alerts, PRO: 20 alerts)

**Dependencies:**

- Part 2 complete (Alert model)
- Part 4 complete (Tier validation)

---

## File Build Order

**File 1/10:** `app/(dashboard)/alerts/page.tsx`

- Alerts list page
- Create alert button
- Filter by status
- Seed: `seed-code/v0-components/alerts-management-page/app/page.tsx`
- Commit: `feat(alerts): add alerts list page`

**File 2/10:** `app/(dashboard)/alerts/new/page.tsx`

- Create alert page
- Alert form
- Tier-filtered symbols
- Commit: `feat(alerts): add create alert page`

**File 3/10:** `app/api/alerts/route.ts`

- GET: List user alerts
- POST: Create alert
- Validate tier limits (FREE: 5, PRO: 20)
- Validate symbol access
- Pattern: `docs/policies/05-coding-patterns.md` Pattern 1
- Commit: `feat(api): add alerts CRUD endpoints`

**File 4/10:** `app/api/alerts/[id]/route.ts`

- GET: Get alert by ID
- PATCH: Update alert
- DELETE: Delete alert
- Commit: `feat(api): add alert detail endpoints`

**File 5/10:** `components/alerts/alert-list.tsx`

- Alert list component
- Status badges
- Trigger info
- Commit: `feat(alerts): add alert list component`

**File 6/10:** `components/alerts/alert-form.tsx`

- Create/edit alert form
- Symbol selector (tier-filtered)
- Timeframe selector
- Condition type selector
- Target value input
- Seed: `seed-code/v0-components/create-price-alert-modal/app/page.tsx`
- Custom Component: `seed-code/v0-components/create-price-alert-modal/components/create-alert-modal.tsx`
- Commit: `feat(alerts): add alert form component`

**File 7/10:** `components/alerts/alert-card.tsx`

- Individual alert display
- Status, symbol, condition
- Edit/delete buttons
- Seed: `seed-code/v0-components/alert-card-component/app/page.tsx`
- Custom Component: `seed-code/v0-components/alert-card-component/components/alert-card.tsx`
- Commit: `feat(alerts): add alert card component`

**File 8/10:** `lib/jobs/alert-checker.ts`

- Background job to check alerts
- Compare current price to target
- Trigger alerts
- Send notifications
- Commit: `feat(alerts): add alert checking job`

**File 9/10:** `lib/jobs/queue.ts`

- Job queue setup (BullMQ or similar)
- Schedule alert checker
- Commit: `feat(alerts): add job queue`

**File 10/10:** `hooks/use-alerts.ts`

- React hook for alerts
- CRUD operations
- Tier limit checking
- Commit: `feat(alerts): add alerts data hook`

---

## Success Criteria

- ✅ All 10 files created
- ✅ Alerts list displays
- ✅ Create alert works
- ✅ Tier limits enforced
- ✅ Symbol filtering works
- ✅ Alert checking job runs

---

**Last Updated:** 2025-11-18
