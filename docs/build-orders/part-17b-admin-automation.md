# Part 17B: Affiliate Marketing Platform - Admin Portal & Automation - Build Order

**From:** `docs/v5-structure-division.md` Part 17 (Phases E-H)
**Total Files:** 35 files (+ 5 bonus email templates)
**Estimated Time:** 23 hours (3 days)
**Priority:** ⭐⭐ Medium (Post-MVP)
**Complexity:** High

---

## Overview

**Scope:** Admin portal for affiliate management, BI reports, automated cron jobs for code distribution/expiry, and reusable UI components.

**Implementation Guide References:**

- `docs/implementation-guides/v5_part_q.md` - Affiliate marketing business logic, commission structure, and system workflows
- `docs/policies/06-aider-instructions.md` Section 12 - Affiliate-specific patterns and validation rules
- `docs/v5-structure-division.md` Part 17 - Complete file list and structural organization

**Key Features:**

- Admin portal for affiliate management
- 4 BI reports (P&L, Sales Performance, Commission Owings, Code Inventory)
- Automated monthly code distribution
- Automated code expiry
- Monthly report emails
- Reusable components for affiliate/admin portals

**Dependencies:**

- Part 17A complete (Affiliate Portal - Phases A-D)
- Part 14 complete (Admin dashboard foundation)

**Previous Part:** Part 17A (Affiliate Portal) - Phases A-D

---

## File Build Order

### Phase E: Admin Portal Backend (11 files, ~10 hours)

**File 1/35:** `app/api/admin/affiliates/route.ts`

- GET: List all affiliates (paginated, filtered)
- Query params: status, country, paymentMethod, page, limit, search
- POST: Manually create affiliate (admin only)
- Auth: Require admin role
- Dependencies: Part 17A File 1 (Prisma schema)
- Commit: `feat(api): add admin affiliate list and create endpoints`

**File 2/35:** `app/api/admin/affiliates/[id]/route.ts`

- GET: Get affiliate details by ID
- PATCH: Update affiliate (name, country, paymentMethod, etc.)
- DELETE: Delete affiliate (marks as DELETED, suspends codes)
- Auth: Require admin role
- Dependencies: Part 17A File 1
- Commit: `feat(api): add admin affiliate detail endpoints`

**File 3/35:** `app/api/admin/affiliates/[id]/distribute-codes/route.ts`

- POST: Manually distribute bonus codes to affiliate
- Body: { count, reason, expiresAt }
- Action: Distribute codes using distributeCodes() with BONUS reason
- Auth: Require admin role
- Dependencies: Part 17A Files 1, 4
- Commit: `feat(api): add admin manual code distribution endpoint`

**File 4/35:** `app/api/admin/affiliates/[id]/suspend/route.ts`

- POST: Suspend affiliate account
- Body: { reason }
- Action: Update status to SUSPENDED, suspend all ACTIVE codes
- Auth: Require admin role
- Dependencies: Part 17A File 1
- Commit: `feat(api): add admin affiliate suspension endpoint`

**File 5/35:** `app/api/admin/affiliates/reports/profit-loss/route.ts`

- GET: P&L report (3 months default)
- Query params: startDate, endDate
- Return: { revenue: {gross, discounts, net}, costs: {paid, pending, total}, profit: {beforeCommissions, afterCommissions, margin} }
- Auth: Require admin role
- Dependencies: Part 17A File 1
- Commit: `feat(api): add admin P&L report endpoint`

**File 6/35:** `app/api/admin/affiliates/reports/sales-performance/route.ts`

- GET: Sales performance by affiliate (ranked)
- Query params: period (month/year), country, minCodesUsed
- Return: Array of { rank, affiliateName, codesUsed, commissionsEarned, conversionRate, avgOrderValue }
- Auth: Require admin role
- Dependencies: Part 17A File 1
- Commit: `feat(api): add admin sales performance report endpoint`

**File 7/35:** `app/api/admin/affiliates/reports/commission-owings/route.ts`

- GET: Commission owings (unpaid commissions)
- Query params: paymentEligible (boolean), paymentMethod, country
- Return: Array of { affiliateId, name, paymentMethod, paymentDetails, pendingCommissions, oldestUnpaidDate, paymentEligible }
- Auth: Require admin role
- Dependencies: Part 17A File 1
- Commit: `feat(api): add admin commission owings report endpoint`

**File 8/35:** `app/api/admin/affiliates/reports/code-inventory/route.ts`

- GET: System-wide code inventory
- Return: { totalAffiliates, activeAffiliates, currentMonth: {...}, allTime: {...} }
- Auth: Require admin role
- Dependencies: Part 17A File 1
- Commit: `feat(api): add admin aggregate code inventory endpoint`

**File 9/35:** `app/api/admin/codes/[id]/cancel/route.ts`

- POST: Cancel specific affiliate code
- Body: { reason }
- Action: Update code status to CANCELLED
- Auth: Require admin role
- Dependencies: Part 17A File 1
- Commit: `feat(api): add admin code cancellation endpoint`

**File 10/35:** `app/api/admin/commissions/pay/route.ts`

- POST: Mark individual commission as paid
- Body: { commissionId, paymentReference }
- Action: Update status to PAID, set paidAt, update affiliate paidCommissions
- Auth: Require admin role
- Dependencies: Part 17A File 1
- Commit: `feat(api): add admin commission payment endpoint`

**File 11/35:** `app/api/admin/commissions/bulk-pay/route.ts`

- POST: Mark multiple commissions as paid (batch payment)
- Body: { affiliateIds: string[], paymentReferences: { [affiliateId]: string } }
- Action: Mark all PENDING commissions for selected affiliates as PAID
- Auth: Require admin role
- Dependencies: Part 17A File 1, File 10 (this part)
- Commit: `feat(api): add admin bulk commission payment endpoint`

---

### Phase F: Admin Portal Frontend (6 files, ~5 hours)

**File 12/35:** `app/admin/affiliates/page.tsx`

- Affiliate list page
- Table: Name | Email | Country | Codes (Active/Total) | Earnings (Pending/Total) | Status | Actions
- Filters: status, country, paymentMethod, search
- Pagination
- Actions: View details, Distribute codes, Suspend
- Dependencies: File 1 (this part)
- Commit: `feat(admin): add affiliates list page`

**File 13/35:** `app/admin/affiliates/[id]/page.tsx`

- Affiliate details page
- Overview card: name, email, country, payment method, status, dates
- Performance metrics: codes distributed/used, conversion rate, earnings
- Recent activity tables: code uses, payments, distributions
- Action buttons: Distribute codes, Suspend, Process payment
- Dependencies: File 2 (this part)
- Commit: `feat(admin): add affiliate details page`

**File 14/35:** `app/admin/affiliates/reports/profit-loss/page.tsx`

- P&L report page
- Date range selector (last 3 months default)
- Cards: Gross revenue, Discounts, Net revenue, Commissions, Profit, Margin
- Line chart: Monthly profit trend
- Dependencies: File 5 (this part)
- Commit: `feat(admin): add P&L report page`

**File 15/35:** `app/admin/affiliates/reports/sales-performance/page.tsx`

- Sales performance report page
- Period selector (current month default)
- Table: Rank | Affiliate | Codes Used | Commissions | Conversion Rate | Avg Order Value
- Filters: country, payment method, min codes used
- Sorted by codes used (descending)
- Dependencies: File 6 (this part)
- Commit: `feat(admin): add sales performance report page`

**File 16/35:** `app/admin/affiliates/reports/commission-owings/page.tsx`

- Commission owings report page
- Table: Affiliate | Payment Method | Payment Details | Pending | Oldest Unpaid | Eligible
- Filters: payment eligible only, payment method, country
- Bulk actions: Select affiliates, Mark as paid (modal)
- Dependencies: Files 7, 11 (this part)
- Commit: `feat(admin): add commission owings report page`

**File 17/35:** `app/admin/affiliates/reports/code-inventory/page.tsx`

- System code inventory page
- Aggregate stats cards: Total affiliates, Active affiliates
- Current month: Distributed, Active, Used, Expired, Conversion rate
- All-time: Distributed, Used, Conversion rate
- Stacked bar chart: Monthly distribution, usage, expiry
- Dependencies: File 8 (this part)
- Commit: `feat(admin): add aggregate code inventory page`

---

### Phase G: Cron Jobs (4 files, ~3 hours)

**File 18/35:** `app/api/cron/distribute-codes/route.ts`

- POST: Monthly code distribution (1st of month, 00:00 UTC)
- Process: Get all ACTIVE affiliates, distribute 15 codes each, send email notifications
- Dependencies: Part 17A Files 1, 4, 9
- Commit: `feat(cron): add monthly code distribution job`

**File 19/35:** `app/api/cron/expire-codes/route.ts`

- POST: Monthly code expiry (last day of month, 23:59 UTC)
- Process: Update all ACTIVE codes with expiresAt <= today to EXPIRED status
- Dependencies: Part 17A File 1
- Commit: `feat(cron): add monthly code expiry job`

**File 20/35:** `app/api/cron/send-monthly-reports/route.ts`

- POST: Send monthly report emails (1st of month, 06:00 UTC)
- Process: For each ACTIVE affiliate, generate last month report, send email
- Dependencies: Part 17A Files 1, 6
- Commit: `feat(cron): add monthly report email job`

**File 21/35:** `vercel.json` (UPDATE EXISTING)

- Add cron job configurations
- Add: distribute-codes (0 0 1 \* _), expire-codes (59 23 28-31 _ _), send-monthly-reports (0 6 1 _ \*)
- Dependencies: Files 18-20 (this part)
- Commit: `feat(cron): add Vercel cron job configurations`

---

### Phase H: Components (14 files, ~5 hours)

**File 22/35:** `components/affiliate/dashboard/stats-card.tsx`

- Quick stats display card
- Props: { title, value, icon, trend }
- Seed: `seed-code/v0-components/part-17b-admin-affiliate-management/app/admin/affiliates/page.tsx`
- Seed: `seed-code/v0-components/part-17b-admin-pnl-report/app/admin/affiliates/pnl-report/page.tsx`
- Dependencies: None
- Commit: `feat(components): add affiliate stats card`

**File 23/35:** `components/affiliate/dashboard/code-inventory-table.tsx`

- Code inventory report table
- Props: { report: CodeInventoryReport }
- Displays: opening, additions, reductions, closing with drill-down
- Dependencies: None
- Commit: `feat(components): add code inventory table`

**File 24/35:** `components/affiliate/dashboard/commission-table.tsx`

- Commission report table
- Props: { commissions: CodeCommission[] }
- Columns: Date | Code | User | Amount | Status
- Dependencies: None
- Commit: `feat(components): add commission table`

**File 25/35:** `components/affiliate/forms/register-form.tsx`

- Affiliate registration form
- Fields: email, password, fullName, country, paymentMethod, paymentDetails, terms
- Client-side validation
- Dependencies: None
- Commit: `feat(components): add affiliate registration form`

**File 26/35:** `components/affiliate/forms/payment-preferences-form.tsx`

- Payment method update form
- Fields: paymentMethod dropdown, conditional paymentDetails fields
- Dependencies: None
- Commit: `feat(components): add payment preferences form`

**File 27/35:** `components/affiliate/reports/code-inventory-report.tsx`

- Full code inventory report component
- Includes table, reconciliation summary, drill-down modals
- Dependencies: File 23 (this part)
- Commit: `feat(components): add code inventory report component`

**File 28/35:** `components/affiliate/reports/commission-report.tsx`

- Full commission report component
- Includes table, reconciliation summary, payment history
- Dependencies: File 24 (this part)
- Commit: `feat(components): add commission report component`

**File 29/35:** `components/admin/affiliate/affiliate-list.tsx`

- Admin affiliate list table
- Props: { affiliates, filters, onFilterChange }
- Pagination, sorting, actions (view, suspend, delete)
- Dependencies: None
- Commit: `feat(components): add admin affiliate list table`

**File 30/35:** `components/admin/affiliate/affiliate-details-card.tsx`

- Affiliate overview card for admin
- Props: { affiliate }
- Displays: name, email, country, status, metrics
- Dependencies: None
- Commit: `feat(components): add admin affiliate details card`

**File 31/35:** `components/admin/affiliate/distribute-codes-modal.tsx`

- Modal for manual code distribution
- Fields: count (1-50), reason (textarea), expiresAt (date picker)
- Submit to POST /api/admin/affiliates/[id]/distribute-codes
- Dependencies: None
- Commit: `feat(components): add admin code distribution modal`

**File 32/35:** `components/admin/affiliate/suspend-account-modal.tsx`

- Modal for affiliate suspension
- Fields: reason (textarea), confirm checkbox
- Submit to POST /api/admin/affiliates/[id]/suspend
- Dependencies: None
- Commit: `feat(components): add admin account suspension modal`

**File 33/35:** `components/admin/affiliate/reports/profit-loss-report.tsx`

- P&L report component
- Props: { report }
- Cards for revenue, costs, profit with chart
- Dependencies: None
- Commit: `feat(components): add P&L report component`

**File 34/35:** `components/admin/affiliate/reports/sales-performance-report.tsx`

- Sales performance report table
- Props: { data }
- Sortable columns, filters
- Dependencies: None
- Commit: `feat(components): add sales performance report component`

**File 35/35:** `components/admin/affiliate/reports/commission-owings-table.tsx`

- Commission owings table with bulk actions
- Props: { affiliates, onBulkPay }
- Checkboxes for selection, bulk pay button
- Dependencies: None
- Commit: `feat(components): add commission owings table`

---

## Additional Email Templates (Bonus)

These 5 bonus email templates enhance the affiliate experience:

**Bonus File 1:** `lib/email/templates/affiliate/payment-processed.tsx`

- Payment confirmation email
- Includes: amount, method, reference, new balance
- Commit: `feat(affiliate): add payment processed email template`

**Bonus File 2:** `lib/email/templates/affiliate/monthly-report.tsx`

- Monthly performance report email
- Includes: last month stats, codes distributed/used, commissions earned
- Commit: `feat(affiliate): add monthly report email template`

**Bonus File 3:** `lib/email/templates/affiliate/payment-eligible.tsx`

- Payment eligibility notification (balance ≥ $50)
- Includes: current balance, payment request instructions
- Commit: `feat(affiliate): add payment eligible email template`

**Bonus File 4:** `lib/email/templates/affiliate/account-suspended.tsx`

- Account suspension notification
- Includes: reason, contact for appeal
- Commit: `feat(affiliate): add account suspended email template`

**Bonus File 5:** `lib/email/templates/affiliate/account-reactivated.tsx`

- Account reactivation notification
- Includes: welcome back message, new codes distributed
- Commit: `feat(affiliate): add account reactivated email template`

---

## Success Criteria

- ✅ All 35 core files created
- ✅ Admin can list, view, edit, delete affiliates
- ✅ Admin can manually distribute bonus codes
- ✅ Admin can suspend/reactivate affiliates
- ✅ All 4 BI reports display correctly (P&L, Sales Performance, Commission Owings, Code Inventory)
- ✅ Bulk commission payment works
- ✅ All 3 cron jobs run successfully (distribution, expiry, reports)
- ✅ All bonus email templates sent correctly

---

## Testing Checklist

**Admin Portal:**

- [ ] Affiliate list filters work (status, country, payment method, search)
- [ ] Affiliate details display accurate data
- [ ] Manual code distribution works (bonus codes)
- [ ] Affiliate suspension works (can't login, codes suspended)
- [ ] Affiliate reactivation works
- [ ] All 4 BI reports display correct data
- [ ] Bulk payment marks multiple commissions as PAID

**Cron Jobs:**

- [ ] Monthly distribution runs (1st of month, 00:00 UTC)
- [ ] Code expiry runs (last day of month, 23:59 UTC)
- [ ] Monthly reports sent (1st of month, 06:00 UTC)
- [ ] Vercel cron configuration correct

**Components:**

- [ ] All components render without errors
- [ ] Forms validate input correctly
- [ ] Tables display data correctly
- [ ] Modals open/close properly
- [ ] Reports reconcile correctly

---

**Last Updated:** 2025-11-26
**Previous Part:** Part 17A (Affiliate Portal)
**Full Affiliate System:** Part 17A + Part 17B = 67 files total
