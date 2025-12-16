# Part 17: Affiliate Marketing Platform - Build Order

**From:** `docs/v5-structure-division.md` Part 17
**Total Files:** 67 files
**Estimated Time:** 47 hours (6 days)
**Priority:** ⭐⭐ Medium (Post-MVP)
**Complexity:** High

---

## Overview

**Scope:** Complete 2-sided marketplace for affiliate marketing with self-service portal, automated code distribution, accounting reports, and admin BI dashboard.

**Implementation Guide References:**

- `docs/implementation-guides/v5_part_q.md` - Affiliate marketing business logic, commission structure, and system workflows
- `docs/policies/06-aider-instructions.md` Section 12 - Affiliate-specific patterns and validation rules
- `docs/v5-structure-division.md` Part 17 - Complete file list and structural organization

**Key Features:**

- Self-service affiliate registration
- Monthly code distribution (15 codes/affiliate)
- Commission tracking ($5 per PRO upgrade)
- Accounting-style reports
- Admin BI dashboard

**Dependencies:**

- Part 2 complete (Prisma schema updates for Affiliate, AffiliateCode, Commission models)
- Part 12 complete (Stripe integration for commission tracking)

---

## File Build Order

### Phase A: Foundation (10 files, ~6 hours)

**File 1/67:** `prisma/schema.prisma` (UPDATE EXISTING)

- Add Affiliate model (email, password, fullName, country, paymentMethod, status, etc.)
- Add AffiliateCode model (code, affiliateId, status, distributedAt, expiresAt, usedAt, etc.)
- Add Commission model (affiliateId, affiliateCodeId, userId, amount, status, earnedAt, paidAt, etc.)
- Add enums: AffiliateStatus, CodeStatus, DistributionReason, PaymentMethod, CommissionStatus
- Update Subscription model: add affiliateCodeId field
- Pattern: See v5_part_q.md Section 13 (Database Schema)
- Commit: `feat(affiliate): add database models for affiliate system`

**File 2/67:** `prisma/migrations/YYYYMMDD_add_affiliate_models.sql`

- Migration for affiliate tables
- Dependencies: File 1
- Run: `npx prisma migrate dev --name add_affiliate_models`
- Commit: (included in File 1 commit)

**File 3/67:** `lib/auth/affiliate-auth.ts`

- Create affiliate JWT functions (separate from user auth)
- Use AFFILIATE_JWT_SECRET environment variable
- Functions: createAffiliateToken(), verifyAffiliateToken(), getAffiliateFromToken()
- JWT payload includes type: 'AFFILIATE' discriminator
- Pattern: Pattern 7 from 06-aider-instructions.md Section 12.2
- Dependencies: File 1-2
- Commit: `feat(affiliate): add separate authentication system`

**File 4/67:** `lib/affiliate/code-generator.ts`

- Generate crypto-secure affiliate codes
- Function: generateUniqueCode() using crypto.randomBytes()
- Function: distributeCodes(affiliateId, count, reason)
- Code format: 8 characters, alphanumeric uppercase
- Pattern: Pattern 8 from 06-aider-instructions.md Section 12.2
- Dependencies: File 1-2
- Commit: `feat(affiliate): add crypto-secure code generator`

**File 5/67:** `lib/affiliate/commission-calculator.ts`

- Calculate commission amounts
- Fixed $5 per PRO upgrade
- Functions: calculateCommission(netRevenue, discount)
- Pattern: Pattern 9 from 06-aider-instructions.md Section 12.2
- Dependencies: File 1-2
- Commit: `feat(affiliate): add commission calculator`

**File 6/67:** `lib/affiliate/report-builder.ts`

- Build accounting-style reports
- Functions: buildCodeInventoryReport(affiliateId, period)
- Functions: buildCommissionReport(affiliateId, period)
- Reconciliation logic (opening + additions - reductions = closing)
- Pattern: Pattern 10 from 06-aider-instructions.md Section 12.2
- Dependencies: File 1-2
- Commit: `feat(affiliate): add report builder for accounting reports`

**File 7/67:** `lib/affiliate/validators.ts`

- Validate affiliate codes
- Functions: validateCode(code), isCodeActive(code), isCodeExpired(code)
- Dependencies: File 1-2
- Commit: `feat(affiliate): add code validation helpers`

**File 8/67:** `lib/email/templates/affiliate/welcome.tsx`

- Welcome email template (React Email)
- Sent after email verification
- Includes: 15 initial codes, dashboard link, getting started tips
- Dependencies: None (standalone)
- Commit: `feat(affiliate): add welcome email template`

**File 9/67:** `lib/email/templates/affiliate/code-distributed.tsx`

- Monthly code distribution email template
- Includes: code count, expiry date, current balance
- Dependencies: None (standalone)
- Commit: `feat(affiliate): add code distribution email template`

**File 10/67:** `lib/email/templates/affiliate/code-used.tsx`

- Code used notification email template
- Includes: code, commission earned, new balance
- Dependencies: None (standalone)
- Commit: `feat(affiliate): add code used email template`

---

### Phase B: Affiliate Portal Backend (11 files, ~8 hours)

**File 11/67:** `app/api/affiliate/auth/register/route.ts`

- POST: Create new affiliate account
- Body: { email, password, fullName, country, paymentMethod, paymentDetails, terms }
- Validation: email unique, password strength, required fields
- Action: Create affiliate with PENDING_VERIFICATION status, send verification email
- Pattern: Pattern 1 (Next.js 15 App Router) from 05-coding-patterns.md
- Dependencies: Files 1-4
- Commit: `feat(api): add affiliate registration endpoint`

**File 12/67:** `app/api/affiliate/auth/verify-email/route.ts`

- POST: Verify email and activate affiliate
- Body: { token }
- Action: Mark affiliate as ACTIVE, distribute 15 initial codes, send welcome email
- Dependencies: Files 1-4, 8
- Commit: `feat(api): add affiliate email verification endpoint`

**File 13/67:** `app/api/affiliate/auth/login/route.ts`

- POST: Affiliate login
- Body: { email, password }
- Return: JWT token (using AFFILIATE_JWT_SECRET)
- Pattern: Pattern 7 from 06-aider-instructions.md
- Dependencies: File 3
- Commit: `feat(api): add affiliate login endpoint`

**File 14/67:** `app/api/affiliate/auth/logout/route.ts`

- POST: Affiliate logout (invalidate token client-side)
- Return: success message
- Dependencies: File 3
- Commit: `feat(api): add affiliate logout endpoint`

**File 15/67:** `app/api/affiliate/dashboard/stats/route.ts`

- GET: Dashboard quick stats
- Auth: Require affiliate JWT
- Return: { totalCodesDistributed, activeCodesCount, usedCodesCount, totalEarnings, pendingCommissions, paidCommissions, currentMonthEarnings, conversionRate }
- Dependencies: Files 1-3
- Commit: `feat(api): add affiliate dashboard stats endpoint`

**File 16/67:** `app/api/affiliate/dashboard/codes/route.ts`

- GET: List affiliate codes (paginated)
- Auth: Require affiliate JWT
- Query params: status, page, limit
- Return: codes array with status, distributed date, expiry, usage
- Dependencies: Files 1-3
- Commit: `feat(api): add affiliate codes list endpoint`

**File 17/67:** `app/api/affiliate/dashboard/code-inventory/route.ts`

- GET: Code inventory report (accounting-style)
- Auth: Require affiliate JWT
- Query params: period (month/year)
- Return: { openingBalance, additions, reductions, closingBalance }
- Dependencies: Files 1-3, 6
- Commit: `feat(api): add code inventory report endpoint`

**File 18/67:** `app/api/affiliate/dashboard/commission-report/route.ts`

- GET: Commission report (accounting-style)
- Auth: Require affiliate JWT
- Query params: period (month/year)
- Return: { openingBalance, earned, payments, closingBalance }
- Dependencies: Files 1-3, 6
- Commit: `feat(api): add commission report endpoint`

**File 19/67:** `app/api/affiliate/profile/route.ts`

- GET: Get affiliate profile
- PATCH: Update affiliate profile (name, country)
- Auth: Require affiliate JWT
- Dependencies: Files 1-3
- Commit: `feat(api): add affiliate profile endpoints`

**File 20/67:** `app/api/affiliate/profile/payment/route.ts`

- PUT: Update payment method and details
- Auth: Require affiliate JWT
- Body: { paymentMethod, paymentDetails }
- Dependencies: Files 1-3
- Commit: `feat(api): add affiliate payment method update endpoint`

**File 21/67:** `app/api/checkout/validate-code/route.ts` (NEW)

- POST: Validate affiliate code before checkout
- Body: { code }
- Return: { valid: boolean, affiliateCode?: object, error?: string }
- Validation: code exists, status ACTIVE, not expired
- Dependencies: Files 1, 7
- Commit: `feat(api): add affiliate code validation for checkout`

---

### Phase C: Integration with Stripe (2 files, ~3 hours)

**File 22/67:** `app/api/checkout/create-session/route.ts` (UPDATE EXISTING)

- Add: affiliateCode parameter (optional)
- Validate code if provided (call validateCode)
- Include affiliateCodeId and affiliateId in Stripe metadata
- Apply discount when code valid (10% off: $29 → $26.10)
- Dependencies: Files 1, 7, 21
- Commit: `feat(checkout): integrate affiliate code discount`

**File 23/67:** `app/api/webhooks/stripe/route.ts` (UPDATE EXISTING)

- Update: checkout.session.completed handler
- Check if session.metadata includes affiliateCodeId and affiliateId
- Create Commission record ($5 fixed)
- Mark AffiliateCode as USED
- Update affiliate totalEarnings and codesUsed
- Send code-used email notification
- Pattern: Pattern 9 from 06-aider-instructions.md (Commission creation ONLY via webhook)
- Dependencies: Files 1, 5, 10
- Commit: `feat(webhook): add commission creation for affiliate codes`

---

### Phase D: Affiliate Portal Frontend (8 files, ~7 hours)

**File 24/67:** `app/affiliate/layout.tsx`

- Affiliate-specific layout (separate from user dashboard)
- Sidebar navigation: Dashboard, Codes, Commissions, Profile
- Header with affiliate name and logout button
- Seed: `seed-code/v0-components/part-17a-affiliate-dashboard/app/affiliate/dashboard/page.tsx`
- Dependencies: Files 3, 13
- Commit: `feat(affiliate): add affiliate portal layout`

**File 25/67:** `app/affiliate/register/page.tsx`

- Registration page
- Form: email, password, fullName, country, paymentMethod, paymentDetails, terms checkbox
- Submit to POST /api/affiliate/auth/register
- Seed: `seed-code/v0-components/part-17a-affiliate-registration/app/affiliate/register/page.tsx`
- Dependencies: File 11
- Commit: `feat(affiliate): add registration page`

**File 26/67:** `app/affiliate/verify/page.tsx`

- Email verification page
- Extracts token from URL query (?token=xxx)
- Calls POST /api/affiliate/auth/verify-email
- Shows success/error message
- Dependencies: File 12
- Commit: `feat(affiliate): add email verification page`

**File 27/67:** `app/affiliate/login/page.tsx`

- Login page
- Form: email, password
- Submit to POST /api/affiliate/auth/login
- Store JWT in localStorage/cookie
- Redirect to /affiliate/dashboard
- Seed: `seed-code/saas-starter/app/(login)/page.tsx` (adapt for affiliate)
- Dependencies: File 13
- Commit: `feat(affiliate): add login page`

**File 28/67:** `app/affiliate/dashboard/page.tsx`

- Main affiliate dashboard
- Quick stats cards (using /api/affiliate/dashboard/stats)
- Recent activity table (last 10 code uses)
- Action buttons (View Reports, Update Payment)
- Dependencies: Files 15, 24
- Commit: `feat(affiliate): add dashboard page`

**File 29/67:** `app/affiliate/dashboard/codes/page.tsx`

- Code inventory report page
- Fetch data from GET /api/affiliate/dashboard/code-inventory
- Display: opening balance, additions (monthly, bonus), reductions (used, expired), closing balance
- Drill-down: click numbers to see details
- Chart: Bar chart showing monthly trends
- Dependencies: Files 17, 24
- Commit: `feat(affiliate): add code inventory report page`

**File 30/67:** `app/affiliate/dashboard/commissions/page.tsx`

- Commission report page
- Fetch data from GET /api/affiliate/dashboard/commission-report
- Display: opening balance, earned (with code details), payments, closing balance
- Period selector (month/year)
- Dependencies: Files 18, 24
- Commit: `feat(affiliate): add commission report page`

**File 31/67:** `app/affiliate/dashboard/profile/page.tsx`

- Profile overview page
- Display: name, email, country, status, registration date
- Edit button → navigate to /affiliate/dashboard/profile/payment
- Dependencies: Files 19, 24
- Commit: `feat(affiliate): add profile page`

**File 32/67:** `app/affiliate/dashboard/profile/payment/page.tsx`

- Payment preferences page
- Form: paymentMethod dropdown, paymentDetails (conditional fields based on method)
- Submit to PUT /api/affiliate/profile/payment
- Dependencies: Files 20, 24
- Commit: `feat(affiliate): add payment preferences page`

---

### Phase E: Admin Portal Backend (14 files, ~10 hours)

**File 33/67:** `app/api/admin/affiliates/route.ts`

- GET: List all affiliates (paginated, filtered)
- Query params: status, country, paymentMethod, page, limit, search
- POST: Manually create affiliate (admin only)
- Auth: Require admin role
- Dependencies: Files 1
- Commit: `feat(api): add admin affiliate list and create endpoints`

**File 34/67:** `app/api/admin/affiliates/[id]/route.ts`

- GET: Get affiliate details by ID
- PATCH: Update affiliate (name, country, paymentMethod, etc.)
- DELETE: Delete affiliate (marks as DELETED, suspends codes)
- Auth: Require admin role
- Dependencies: Files 1
- Commit: `feat(api): add admin affiliate detail endpoints`

**File 35/67:** `app/api/admin/affiliates/[id]/distribute-codes/route.ts`

- POST: Manually distribute bonus codes to affiliate
- Body: { count, reason, expiresAt }
- Action: Distribute codes using distributeCodes() with BONUS reason
- Auth: Require admin role
- Dependencies: Files 1, 4
- Commit: `feat(api): add admin manual code distribution endpoint`

**File 36/67:** `app/api/admin/affiliates/[id]/suspend/route.ts`

- POST: Suspend affiliate account
- Body: { reason }
- Action: Update status to SUSPENDED, suspend all ACTIVE codes
- Auth: Require admin role
- Dependencies: Files 1
- Commit: `feat(api): add admin affiliate suspension endpoint`

**File 37/67:** `app/api/admin/affiliates/reports/profit-loss/route.ts`

- GET: P&L report (3 months default)
- Query params: startDate, endDate
- Return: { revenue: {gross, discounts, net}, costs: {paid, pending, total}, profit: {beforeCommissions, afterCommissions, margin} }
- Auth: Require admin role
- Dependencies: Files 1
- Commit: `feat(api): add admin P&L report endpoint`

**File 38/67:** `app/api/admin/affiliates/reports/sales-performance/route.ts`

- GET: Sales performance by affiliate (ranked)
- Query params: period (month/year), country, minCodesUsed
- Return: Array of { rank, affiliateName, codesUsed, commissionsEarned, conversionRate, avgOrderValue }
- Auth: Require admin role
- Dependencies: Files 1
- Commit: `feat(api): add admin sales performance report endpoint`

**File 39/67:** `app/api/admin/affiliates/reports/commission-owings/route.ts`

- GET: Commission owings (unpaid commissions)
- Query params: paymentEligible (boolean), paymentMethod, country
- Return: Array of { affiliateId, name, paymentMethod, paymentDetails, pendingCommissions, oldestUnpaidDate, paymentEligible }
- Auth: Require admin role
- Dependencies: Files 1
- Commit: `feat(api): add admin commission owings report endpoint`

**File 40/67:** `app/api/admin/affiliates/reports/code-inventory/route.ts`

- GET: System-wide code inventory
- Return: { totalAffiliates, activeAffiliates, currentMonth: {...}, allTime: {...} }
- Auth: Require admin role
- Dependencies: Files 1
- Commit: `feat(api): add admin aggregate code inventory endpoint`

**File 41/67:** `app/api/admin/codes/[id]/cancel/route.ts`

- POST: Cancel specific affiliate code
- Body: { reason }
- Action: Update code status to CANCELLED
- Auth: Require admin role
- Dependencies: Files 1
- Commit: `feat(api): add admin code cancellation endpoint`

**File 42/67:** `app/api/admin/commissions/pay/route.ts`

- POST: Mark individual commission as paid
- Body: { commissionId, paymentReference }
- Action: Update status to PAID, set paidAt, update affiliate paidCommissions
- Auth: Require admin role
- Dependencies: Files 1
- Commit: `feat(api): add admin commission payment endpoint`

**File 43/67:** `app/api/admin/commissions/bulk-pay/route.ts`

- POST: Mark multiple commissions as paid (batch payment)
- Body: { affiliateIds: string[], paymentReferences: { [affiliateId]: string } }
- Action: Mark all PENDING commissions for selected affiliates as PAID
- Auth: Require admin role
- Dependencies: Files 1, 42
- Commit: `feat(api): add admin bulk commission payment endpoint`

---

### Phase F: Admin Portal Frontend (5 files, ~5 hours)

**File 44/67:** `app/admin/affiliates/page.tsx`

- Affiliate list page
- Table: Name | Email | Country | Codes (Active/Total) | Earnings (Pending/Total) | Status | Actions
- Filters: status, country, paymentMethod, search
- Pagination
- Actions: View details, Distribute codes, Suspend
- Dependencies: File 33
- Commit: `feat(admin): add affiliates list page`

**File 45/67:** `app/admin/affiliates/[id]/page.tsx`

- Affiliate details page
- Overview card: name, email, country, payment method, status, dates
- Performance metrics: codes distributed/used, conversion rate, earnings
- Recent activity tables: code uses, payments, distributions
- Action buttons: Distribute codes, Suspend, Process payment
- Dependencies: File 34
- Commit: `feat(admin): add affiliate details page`

**File 46/67:** `app/admin/affiliates/reports/profit-loss/page.tsx`

- P&L report page
- Date range selector (last 3 months default)
- Cards: Gross revenue, Discounts, Net revenue, Commissions, Profit, Margin
- Line chart: Monthly profit trend
- Dependencies: File 37
- Commit: `feat(admin): add P&L report page`

**File 47/67:** `app/admin/affiliates/reports/sales-performance/page.tsx`

- Sales performance report page
- Period selector (current month default)
- Table: Rank | Affiliate | Codes Used | Commissions | Conversion Rate | Avg Order Value
- Filters: country, payment method, min codes used
- Sorted by codes used (descending)
- Dependencies: File 38
- Commit: `feat(admin): add sales performance report page`

**File 48/67:** `app/admin/affiliates/reports/commission-owings/page.tsx`

- Commission owings report page
- Table: Affiliate | Payment Method | Payment Details | Pending | Oldest Unpaid | Eligible
- Filters: payment eligible only, payment method, country
- Bulk actions: Select affiliates, Mark as paid (modal)
- Dependencies: Files 39, 43
- Commit: `feat(admin): add commission owings report page`

**File 49/67:** `app/admin/affiliates/reports/code-inventory/page.tsx`

- System code inventory page
- Aggregate stats cards: Total affiliates, Active affiliates
- Current month: Distributed, Active, Used, Expired, Conversion rate
- All-time: Distributed, Used, Conversion rate
- Stacked bar chart: Monthly distribution, usage, expiry
- Dependencies: File 40
- Commit: `feat(admin): add aggregate code inventory page`

---

### Phase G: Cron Jobs (3 files, ~3 hours)

**File 50/67:** `app/api/cron/distribute-codes/route.ts`

- POST: Monthly code distribution (1st of month, 00:00 UTC)
- Process: Get all ACTIVE affiliates, distribute 15 codes each, send email notifications
- Dependencies: Files 1, 4, 9
- Commit: `feat(cron): add monthly code distribution job`

**File 51/67:** `app/api/cron/expire-codes/route.ts`

- POST: Monthly code expiry (last day of month, 23:59 UTC)
- Process: Update all ACTIVE codes with expiresAt <= today to EXPIRED status
- Dependencies: Files 1
- Commit: `feat(cron): add monthly code expiry job`

**File 52/67:** `app/api/cron/send-monthly-reports/route.ts`

- POST: Send monthly report emails (1st of month, 06:00 UTC)
- Process: For each ACTIVE affiliate, generate last month report, send email
- Dependencies: Files 1, 6
- Commit: `feat(cron): add monthly report email job`

**File 53/67:** `vercel.json` (UPDATE EXISTING)

- Add cron job configurations
- Add: distribute-codes (0 0 1 \* _), expire-codes (59 23 28-31 _ _), send-monthly-reports (0 6 1 _ \*)
- Dependencies: Files 50-52
- Commit: `feat(cron): add Vercel cron job configurations`

---

### Phase H: Components (15 files, ~5 hours)

**File 54/67:** `components/affiliate/dashboard/stats-card.tsx`

- Quick stats display card
- Props: { title, value, icon, trend }
- Note: Build from scratch (no seed component available)
- Dependencies: None
- Commit: `feat(components): add affiliate stats card`

**File 55/67:** `components/affiliate/dashboard/code-inventory-table.tsx`

- Code inventory report table
- Props: { report: CodeInventoryReport }
- Displays: opening, additions, reductions, closing with drill-down
- Dependencies: None
- Commit: `feat(components): add code inventory table`

**File 56/67:** `components/affiliate/dashboard/commission-table.tsx`

- Commission report table
- Props: { commissions: CodeCommission[] }
- Columns: Date | Code | User | Amount | Status
- Dependencies: None
- Commit: `feat(components): add commission table`

**File 57/67:** `components/affiliate/forms/register-form.tsx`

- Affiliate registration form
- Fields: email, password, fullName, country, paymentMethod, paymentDetails, terms
- Client-side validation
- Dependencies: None
- Commit: `feat(components): add affiliate registration form`

**File 58/67:** `components/affiliate/forms/payment-preferences-form.tsx`

- Payment method update form
- Fields: paymentMethod dropdown, conditional paymentDetails fields
- Dependencies: None
- Commit: `feat(components): add payment preferences form`

**File 59/67:** `components/affiliate/reports/code-inventory-report.tsx`

- Full code inventory report component
- Includes table, reconciliation summary, drill-down modals
- Dependencies: File 55
- Commit: `feat(components): add code inventory report component`

**File 60/67:** `components/affiliate/reports/commission-report.tsx`

- Full commission report component
- Includes table, reconciliation summary, payment history
- Dependencies: File 56
- Commit: `feat(components): add commission report component`

**File 61/67:** `components/admin/affiliate/affiliate-list.tsx`

- Admin affiliate list table
- Props: { affiliates, filters, onFilterChange }
- Pagination, sorting, actions (view, suspend, delete)
- Dependencies: None
- Commit: `feat(components): add admin affiliate list table`

**File 62/67:** `components/admin/affiliate/affiliate-details-card.tsx`

- Affiliate overview card for admin
- Props: { affiliate }
- Displays: name, email, country, status, metrics
- Dependencies: None
- Commit: `feat(components): add admin affiliate details card`

**File 63/67:** `components/admin/affiliate/distribute-codes-modal.tsx`

- Modal for manual code distribution
- Fields: count (1-50), reason (textarea), expiresAt (date picker)
- Submit to POST /api/admin/affiliates/[id]/distribute-codes
- Dependencies: None
- Commit: `feat(components): add admin code distribution modal`

**File 64/67:** `components/admin/affiliate/suspend-account-modal.tsx`

- Modal for affiliate suspension
- Fields: reason (textarea), confirm checkbox
- Submit to POST /api/admin/affiliates/[id]/suspend
- Dependencies: None
- Commit: `feat(components): add admin account suspension modal`

**File 65/67:** `components/admin/affiliate/reports/profit-loss-report.tsx`

- P&L report component
- Props: { report }
- Cards for revenue, costs, profit with chart
- Dependencies: None
- Commit: `feat(components): add P&L report component`

**File 66/67:** `components/admin/affiliate/reports/sales-performance-report.tsx`

- Sales performance report table
- Props: { data }
- Sortable columns, filters
- Dependencies: None
- Commit: `feat(components): add sales performance report component`

**File 67/67:** `components/admin/affiliate/reports/commission-owings-table.tsx`

- Commission owings table with bulk actions
- Props: { affiliates, onBulkPay }
- Checkboxes for selection, bulk pay button
- Dependencies: None
- Commit: `feat(components): add commission owings table`

---

## Additional Email Templates

These files were counted in Phase A but listed here for completeness:

**File 68 (bonus):** `lib/email/templates/affiliate/payment-processed.tsx`

- Payment confirmation email
- Includes: amount, method, reference, new balance
- Commit: `feat(affiliate): add payment processed email template`

**File 69 (bonus):** `lib/email/templates/affiliate/monthly-report.tsx`

- Monthly performance report email
- Includes: last month stats, codes distributed/used, commissions earned
- Commit: `feat(affiliate): add monthly report email template`

**File 70 (bonus):** `lib/email/templates/affiliate/payment-eligible.tsx`

- Payment eligibility notification (balance ≥ $50)
- Includes: current balance, payment request instructions
- Commit: `feat(affiliate): add payment eligible email template`

**File 71 (bonus):** `lib/email/templates/affiliate/account-suspended.tsx`

- Account suspension notification
- Includes: reason, contact for appeal
- Commit: `feat(affiliate): add account suspended email template`

**File 72 (bonus):** `lib/email/templates/affiliate/account-reactivated.tsx`

- Account reactivation notification
- Includes: welcome back message, new codes distributed
- Commit: `feat(affiliate): add account reactivated email template`

---

## Environment Variables

Add to `.env.example` and `.env.local`:

```bash
# Affiliate System
AFFILIATE_JWT_SECRET=your_affiliate_jwt_secret_here_different_from_user_jwt
AFFILIATE_COMMISSION_AMOUNT=5.00
AFFILIATE_MINIMUM_PAYOUT=50.00
AFFILIATE_CODES_PER_MONTH=15
```

---

## Success Criteria

- ✅ All 67 core files created
- ✅ Affiliate registration and email verification works
- ✅ Separate authentication system works (AFFILIATE_JWT_SECRET)
- ✅ Code generation is crypto-secure (crypto.randomBytes)
- ✅ Commission creation works ONLY via Stripe webhook
- ✅ Accounting reports reconcile correctly (opening + earned - paid = closing)
- ✅ Admin portal displays all 4 BI reports correctly
- ✅ All 3 cron jobs run successfully (distribution, expiry, reports)
- ✅ All 8 email notifications sent correctly
- ✅ User checkout flow accepts affiliate codes and applies discount

---

## Testing Checklist

**Affiliate Portal:**

- [ ] Registration creates affiliate with PENDING_VERIFICATION
- [ ] Email verification activates and distributes 15 codes
- [ ] Login returns correct JWT
- [ ] Dashboard stats display correctly
- [ ] Code inventory report reconciles
- [ ] Commission report reconciles
- [ ] Payment method update works

**Code Usage Flow:**

- [ ] User can apply code at checkout
- [ ] Invalid/expired/used code rejected
- [ ] Webhook creates commission correctly
- [ ] Code marked as USED
- [ ] Affiliate earnings updated
- [ ] Notification emails sent

**Admin Portal:**

- [ ] Affiliate list filters work
- [ ] Affiliate details accurate
- [ ] Manual code distribution works
- [ ] Suspension works (can't login, codes suspended)
- [ ] All 4 BI reports display correct data
- [ ] Bulk payment works

**Cron Jobs:**

- [ ] Monthly distribution (1st of month)
- [ ] Code expiry (last day of month)
- [ ] Monthly reports sent

---

**Last Updated:** 2025-11-21
