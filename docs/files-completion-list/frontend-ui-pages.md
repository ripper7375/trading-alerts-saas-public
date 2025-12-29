# Frontend UI Pages - Complete List

This document lists all frontend UI pages (page.tsx and layout.tsx files) in the Trading Alerts SaaS system.

**Total Pages:** 54 files (41 page.tsx + 13 layout.tsx)

---

## Root Application

| # | File Path | Description | Source |
|---|-----------|-------------|--------|
| 1 | `app/layout.tsx` | Root application layout | Part 16 |
| 2 | `app/error.tsx` | Global error page | Part 16 |

---

## Marketing Section

| # | File Path | Description | Source |
|---|-----------|-------------|--------|
| 3 | `app/(marketing)/layout.tsx` | Marketing pages layout | Part 16 |
| 4 | `app/(marketing)/page.tsx` | Landing/Home page | Part 16 |
| 5 | `app/(marketing)/pricing/page.tsx` | Pricing page (Stripe + dLocal) | Part 12, Part 18C |

---

## Authentication Section

| # | File Path | Description | Source |
|---|-----------|-------------|--------|
| 6 | `app/(auth)/layout.tsx` | Auth pages layout | Part 5 |
| 7 | `app/(auth)/login/page.tsx` | User login page | Part 5 |
| 8 | `app/(auth)/register/page.tsx` | User registration page | Part 5 |
| 9 | `app/(auth)/verify-email/page.tsx` | Email verification page | Part 5 |
| 10 | `app/(auth)/verify-email/pending/page.tsx` | Email verification pending page | Part 5 |
| 11 | `app/(auth)/forgot-password/page.tsx` | Forgot password page | Part 5 |
| 12 | `app/(auth)/reset-password/page.tsx` | Reset password page | Part 5 |

---

## Dashboard Section

| # | File Path | Description | Source |
|---|-----------|-------------|--------|
| 13 | `app/(dashboard)/layout.tsx` | Dashboard layout | Part 8 |
| 14 | `app/(dashboard)/dashboard/page.tsx` | Main dashboard page | Part 8 |

### Charts & Visualization

| # | File Path | Description | Source |
|---|-----------|-------------|--------|
| 15 | `app/(dashboard)/charts/page.tsx` | Charts overview page | Part 9 |
| 16 | `app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx` | Chart detail page (dynamic route) | Part 9 |

### Watchlist

| # | File Path | Description | Source |
|---|-----------|-------------|--------|
| 17 | `app/(dashboard)/watchlist/page.tsx` | Watchlist management page | Part 10 |

### Alerts

| # | File Path | Description | Source |
|---|-----------|-------------|--------|
| 18 | `app/(dashboard)/alerts/page.tsx` | Alerts list page | Part 11 |
| 19 | `app/(dashboard)/alerts/new/page.tsx` | Create new alert page | Part 11 |

### Settings

| # | File Path | Description | Source |
|---|-----------|-------------|--------|
| 20 | `app/(dashboard)/settings/layout.tsx` | Settings layout | Part 13 |
| 21 | `app/(dashboard)/settings/profile/page.tsx` | Profile settings page | Part 13 |
| 22 | `app/(dashboard)/settings/appearance/page.tsx` | Appearance settings page | Part 13 |
| 23 | `app/(dashboard)/settings/account/page.tsx` | Account settings page | Part 13 |
| 24 | `app/(dashboard)/settings/privacy/page.tsx` | Privacy settings page | Part 13 |
| 25 | `app/(dashboard)/settings/billing/page.tsx` | Billing settings page | Part 13 |
| 26 | `app/(dashboard)/settings/language/page.tsx` | Language settings page | Part 13 |
| 27 | `app/(dashboard)/settings/help/page.tsx` | Help settings page | Part 13 |

---

## Admin Section (Dashboard)

| # | File Path | Description | Source |
|---|-----------|-------------|--------|
| 28 | `app/(dashboard)/admin/layout.tsx` | Admin dashboard layout | Part 14 |
| 29 | `app/(dashboard)/admin/page.tsx` | Admin dashboard home | Part 14 |
| 30 | `app/(dashboard)/admin/users/page.tsx` | User management page | Part 14 |
| 31 | `app/(dashboard)/admin/api-usage/page.tsx` | API usage monitoring page | Part 14 |
| 32 | `app/(dashboard)/admin/errors/page.tsx` | Error logs page | Part 14 |

### Admin - Fraud Alerts

| # | File Path | Description | Source |
|---|-----------|-------------|--------|
| 33 | `app/(dashboard)/admin/fraud-alerts/page.tsx` | Fraud alerts list page | Part 18C |
| 34 | `app/(dashboard)/admin/fraud-alerts/[id]/page.tsx` | Fraud alert detail page | Part 18C |

### Admin - Disbursement

| # | File Path | Description | Source |
|---|-----------|-------------|--------|
| 35 | `app/(dashboard)/admin/disbursement/layout.tsx` | Disbursement admin layout | Part 19D |
| 36 | `app/(dashboard)/admin/disbursement/page.tsx` | Disbursement overview dashboard | Part 19D |
| 37 | `app/(dashboard)/admin/disbursement/affiliates/page.tsx` | Payable affiliates page | Part 19D |
| 38 | `app/(dashboard)/admin/disbursement/batches/page.tsx` | Payment batches list page | Part 19D |
| 39 | `app/(dashboard)/admin/disbursement/batches/[batchId]/page.tsx` | Batch details page | Part 19D |
| 40 | `app/(dashboard)/admin/disbursement/transactions/page.tsx` | Transactions list page | Part 19D |
| 41 | `app/(dashboard)/admin/disbursement/audit/page.tsx` | Audit logs page | Part 19D |
| 42 | `app/(dashboard)/admin/disbursement/config/page.tsx` | Disbursement config page | Part 19D |
| 43 | `app/(dashboard)/admin/disbursement/accounts/page.tsx` | RiseWorks accounts page | Part 19D |

---

## Admin Section (Standalone)

| # | File Path | Description | Source |
|---|-----------|-------------|--------|
| 44 | `app/admin/login/page.tsx` | Admin login page | Part 5 |
| 45 | `app/admin/affiliates/page.tsx` | Affiliate management page | Part 17B-1 |
| 46 | `app/admin/affiliates/[id]/page.tsx` | Affiliate detail page | Part 17B-1 |
| 47 | `app/admin/affiliates/reports/profit-loss/page.tsx` | Profit & loss report page | Part 17B-1 |
| 48 | `app/admin/affiliates/reports/sales-performance/page.tsx` | Sales performance report page | Part 17B-1 |
| 49 | `app/admin/affiliates/reports/commission-owings/page.tsx` | Commission owings report page | Part 17B-1 |
| 50 | `app/admin/affiliates/reports/code-inventory/page.tsx` | Code inventory report page | Part 17B-1 |

---

## Affiliate Section

| # | File Path | Description | Source |
|---|-----------|-------------|--------|
| 51 | `app/affiliate/layout.tsx` | Affiliate portal layout | Part 17A-2 |
| 52 | `app/affiliate/register/page.tsx` | Affiliate registration page | Part 17A-2 |
| 53 | `app/affiliate/verify/page.tsx` | Affiliate email verification page | Part 17A-2 |
| 54 | `app/affiliate/dashboard/page.tsx` | Affiliate dashboard page | Part 17A-2 |
| 55 | `app/affiliate/dashboard/codes/page.tsx` | Affiliate codes page | Part 17A-2 |
| 56 | `app/affiliate/dashboard/commissions/page.tsx` | Affiliate commissions page | Part 17A-2 |
| 57 | `app/affiliate/dashboard/profile/page.tsx` | Affiliate profile page | Part 17A-2 |
| 58 | `app/affiliate/dashboard/profile/payment/page.tsx` | Affiliate payment settings page | Part 17A-2 |

---

## Checkout Section

| # | File Path | Description | Source |
|---|-----------|-------------|--------|
| 59 | `app/checkout/page.tsx` | Unified checkout page (Stripe + dLocal) | Part 18C |

---

## Summary by Section

| Section | Pages | Layouts | Total |
|---------|-------|---------|-------|
| Root Application | 1 | 1 | 2 |
| Marketing | 2 | 1 | 3 |
| Authentication | 6 | 1 | 7 |
| Dashboard (Main) | 1 | 1 | 2 |
| Dashboard - Charts | 2 | 0 | 2 |
| Dashboard - Watchlist | 1 | 0 | 1 |
| Dashboard - Alerts | 2 | 0 | 2 |
| Dashboard - Settings | 7 | 1 | 8 |
| Admin (Dashboard) | 4 | 1 | 5 |
| Admin - Fraud Alerts | 2 | 0 | 2 |
| Admin - Disbursement | 8 | 1 | 9 |
| Admin (Standalone) | 7 | 0 | 7 |
| Affiliate Portal | 7 | 1 | 8 |
| Checkout | 1 | 0 | 1 |
| **TOTAL** | **51** | **8** | **59** |

---

## Notes

1. **Route Groups**: Files in `(auth)`, `(dashboard)`, and `(marketing)` directories use Next.js route groups for layout organization without affecting URL paths.

2. **Dynamic Routes**: Files with `[param]` in the path (e.g., `[symbol]`, `[id]`, `[batchId]`) are dynamic routes that accept URL parameters.

3. **Layout Hierarchy**: Layouts are nested - child routes inherit parent layouts.

4. **Page Types**:
   - `page.tsx` - Renders at that route
   - `layout.tsx` - Wraps child routes
   - `error.tsx` - Error boundary for the route

---

*Last Updated: 2025-12-29*
*Generated from: docs/files-completion-list/*
