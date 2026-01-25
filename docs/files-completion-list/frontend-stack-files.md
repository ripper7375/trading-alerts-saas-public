# Frontend UI Pages - Complete List

This document lists all frontend UI pages (page.tsx and layout.tsx files) in the Trading Alerts SaaS system.

**Total Pages:** 62 files (54 page.tsx + 8 layout.tsx)

## Modular Monolith Architecture Classification

According to the Modular Monolith Migration (Step 4 in architecture diagram), frontend UI files are categorized into:

- **📖 Readable Elements (Server Components)**: Static content, non-interactive displays (default Next.js App Router behavior)
- **🔘 Interactive Elements (Client Components)**: Forms, buttons, interactive widgets (with "use client" directive)

**Categorization Summary:**

- **Readable Elements (Server Components):** 23 files (37%)
- **Interactive Elements (Client Components):** 39 files (63%)

---

## Root Application

| #   | File Path        | Type                    | Description                           | Source  |
| --- | ---------------- | ----------------------- | ------------------------------------- | ------- |
| 1   | `app/layout.tsx` | 📖 Readable (Server)    | Root application layout               | Part 16 |
| 2   | `app/error.tsx`  | 🔘 Interactive (Client) | Global error page with error boundary | Part 16 |

---

## Marketing Section

| #   | File Path                          | Type                    | Description                         | Source            |
| --- | ---------------------------------- | ----------------------- | ----------------------------------- | ----------------- |
| 3   | `app/(marketing)/layout.tsx`       | 📖 Readable (Server)    | Marketing pages layout              | Part 16           |
| 4   | `app/(marketing)/page.tsx`         | 🔘 Interactive (Client) | Landing/Home page with animations   | Part 16           |
| 5   | `app/(marketing)/pricing/page.tsx` | 🔘 Interactive (Client) | Pricing page with payment selection | Part 12, Part 18C |

---

## Authentication Section

| #   | File Path                                  | Type                    | Description                      | Source |
| --- | ------------------------------------------ | ----------------------- | -------------------------------- | ------ |
| 6   | `app/(auth)/layout.tsx`                    | 📖 Readable (Server)    | Auth pages layout                | Part 5 |
| 7   | `app/(auth)/login/page.tsx`                | 🔘 Interactive (Client) | User login page with form        | Part 5 |
| 8   | `app/(auth)/register/page.tsx`             | 🔘 Interactive (Client) | User registration page with form | Part 5 |
| 9   | `app/(auth)/verify-email/page.tsx`         | 📖 Readable (Server)    | Email verification page          | Part 5 |
| 10  | `app/(auth)/verify-email/pending/page.tsx` | 📖 Readable (Server)    | Email verification pending page  | Part 5 |
| 11  | `app/(auth)/forgot-password/page.tsx`      | 🔘 Interactive (Client) | Forgot password page with form   | Part 5 |
| 12  | `app/(auth)/reset-password/page.tsx`       | 🔘 Interactive (Client) | Reset password page with form    | Part 5 |

---

## Dashboard Section

| #   | File Path                            | Type                    | Description                      | Source |
| --- | ------------------------------------ | ----------------------- | -------------------------------- | ------ |
| 13  | `app/(dashboard)/layout.tsx`         | 📖 Readable (Server)    | Dashboard layout                 | Part 8 |
| 14  | `app/(dashboard)/dashboard/page.tsx` | 🔘 Interactive (Client) | Main dashboard page with widgets | Part 8 |

### Charts & Visualization

| #   | File Path                                              | Type                    | Description                                           | Source |
| --- | ------------------------------------------------------ | ----------------------- | ----------------------------------------------------- | ------ |
| 15  | `app/(dashboard)/charts/page.tsx`                      | 🔘 Interactive (Client) | Charts overview page with selectors                   | Part 9 |
| 16  | `app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx` | 🔘 Interactive (Client) | Chart detail page with interactive TradingView charts | Part 9 |

### Watchlist

| #   | File Path                            | Type                    | Description                              | Source  |
| --- | ------------------------------------ | ----------------------- | ---------------------------------------- | ------- |
| 17  | `app/(dashboard)/watchlist/page.tsx` | 🔘 Interactive (Client) | Watchlist management page with drag-drop | Part 10 |

### Alerts

| #   | File Path                             | Type                    | Description                     | Source  |
| --- | ------------------------------------- | ----------------------- | ------------------------------- | ------- |
| 18  | `app/(dashboard)/alerts/page.tsx`     | 🔘 Interactive (Client) | Alerts list page with actions   | Part 11 |
| 19  | `app/(dashboard)/alerts/new/page.tsx` | 🔘 Interactive (Client) | Create new alert page with form | Part 11 |

### Settings

| #   | File Path                                      | Type                    | Description                                | Source  |
| --- | ---------------------------------------------- | ----------------------- | ------------------------------------------ | ------- |
| 20  | `app/(dashboard)/settings/layout.tsx`          | 📖 Readable (Server)    | Settings layout with navigation            | Part 13 |
| 21  | `app/(dashboard)/settings/profile/page.tsx`    | 🔘 Interactive (Client) | Profile settings page with form            | Part 13 |
| 22  | `app/(dashboard)/settings/appearance/page.tsx` | 🔘 Interactive (Client) | Appearance settings page with theme toggle | Part 13 |
| 23  | `app/(dashboard)/settings/account/page.tsx`    | 🔘 Interactive (Client) | Account settings page with forms           | Part 13 |
| 24  | `app/(dashboard)/settings/privacy/page.tsx`    | 🔘 Interactive (Client) | Privacy settings page with toggles         | Part 13 |
| 25  | `app/(dashboard)/settings/billing/page.tsx`    | 🔘 Interactive (Client) | Billing settings page with payment methods | Part 13 |
| 26  | `app/(dashboard)/settings/language/page.tsx`   | 🔘 Interactive (Client) | Language settings page with selector       | Part 13 |
| 27  | `app/(dashboard)/settings/help/page.tsx`       | 📖 Readable (Server)    | Help settings page with FAQ                | Part 13 |

### Security

| #   | File Path                                                  | Type                    | Description                                 | Source      |
| --- | ---------------------------------------------------------- | ----------------------- | ------------------------------------------- | ----------- |
| 28  | `app/(dashboard)/settings/security/page.tsx`               | 🔘 Interactive (Client) | Two-Factor Authentication with setup wizard | 2FA Feature |
| 29  | `app/(dashboard)/settings/security/login-history/page.tsx` | 📖 Readable (Server)    | Login History display                       | 2FA Feature |
| 30  | `app/(dashboard)/settings/security/alerts/page.tsx`        | 🔘 Interactive (Client) | Security Alerts with toggles                | 2FA Feature |

---

## Admin Section (Dashboard)

| #   | File Path                                  | Type                    | Description                       | Source  |
| --- | ------------------------------------------ | ----------------------- | --------------------------------- | ------- |
| 31  | `app/(dashboard)/admin/layout.tsx`         | 📖 Readable (Server)    | Admin dashboard layout            | Part 14 |
| 32  | `app/(dashboard)/admin/page.tsx`           | 🔘 Interactive (Client) | Admin dashboard home with charts  | Part 14 |
| 33  | `app/(dashboard)/admin/users/page.tsx`     | 🔘 Interactive (Client) | User management page with actions | Part 14 |
| 34  | `app/(dashboard)/admin/api-usage/page.tsx` | 📖 Readable (Server)    | API usage monitoring page         | Part 14 |
| 35  | `app/(dashboard)/admin/errors/page.tsx`    | 📖 Readable (Server)    | Error logs page                   | Part 14 |

### Admin - Fraud Alerts

| #   | File Path                                          | Type                    | Description                                  | Source   |
| --- | -------------------------------------------------- | ----------------------- | -------------------------------------------- | -------- |
| 36  | `app/(dashboard)/admin/fraud-alerts/page.tsx`      | 🔘 Interactive (Client) | Fraud alerts list page with actions          | Part 18C |
| 37  | `app/(dashboard)/admin/fraud-alerts/[id]/page.tsx` | 🔘 Interactive (Client) | Fraud alert detail page with resolution form | Part 18C |

### Admin - Disbursement

| #   | File Path                                                       | Type                    | Description                                 | Source   |
| --- | --------------------------------------------------------------- | ----------------------- | ------------------------------------------- | -------- |
| 38  | `app/(dashboard)/admin/disbursement/layout.tsx`                 | 📖 Readable (Server)    | Disbursement admin layout                   | Part 19D |
| 39  | `app/(dashboard)/admin/disbursement/page.tsx`                   | 🔘 Interactive (Client) | Disbursement overview dashboard with charts | Part 19D |
| 40  | `app/(dashboard)/admin/disbursement/affiliates/page.tsx`        | 🔘 Interactive (Client) | Payable affiliates page with actions        | Part 19D |
| 41  | `app/(dashboard)/admin/disbursement/batches/page.tsx`           | 🔘 Interactive (Client) | Payment batches list page with actions      | Part 19D |
| 42  | `app/(dashboard)/admin/disbursement/batches/[batchId]/page.tsx` | 📖 Readable (Server)    | Batch details page                          | Part 19D |
| 43  | `app/(dashboard)/admin/disbursement/transactions/page.tsx`      | 📖 Readable (Server)    | Transactions list page                      | Part 19D |
| 44  | `app/(dashboard)/admin/disbursement/audit/page.tsx`             | 📖 Readable (Server)    | Audit logs page                             | Part 19D |
| 45  | `app/(dashboard)/admin/disbursement/config/page.tsx`            | 🔘 Interactive (Client) | Disbursement config page with forms         | Part 19D |
| 46  | `app/(dashboard)/admin/disbursement/accounts/page.tsx`          | 🔘 Interactive (Client) | RiseWorks accounts page with sync actions   | Part 19D |

---

## Admin Section (Standalone)

| #   | File Path                                                 | Type                    | Description                            | Source     |
| --- | --------------------------------------------------------- | ----------------------- | -------------------------------------- | ---------- |
| 47  | `app/admin/login/page.tsx`                                | 🔘 Interactive (Client) | Admin login page with form             | Part 5     |
| 48  | `app/admin/affiliates/page.tsx`                           | 🔘 Interactive (Client) | Affiliate management page with actions | Part 17B-1 |
| 49  | `app/admin/affiliates/[id]/page.tsx`                      | 🔘 Interactive (Client) | Affiliate detail page with actions     | Part 17B-1 |
| 50  | `app/admin/affiliates/reports/profit-loss/page.tsx`       | 📖 Readable (Server)    | Profit & loss report page              | Part 17B-1 |
| 51  | `app/admin/affiliates/reports/sales-performance/page.tsx` | 📖 Readable (Server)    | Sales performance report page          | Part 17B-1 |
| 52  | `app/admin/affiliates/reports/commission-owings/page.tsx` | 📖 Readable (Server)    | Commission owings report page          | Part 17B-1 |
| 53  | `app/admin/affiliates/reports/code-inventory/page.tsx`    | 📖 Readable (Server)    | Code inventory report page             | Part 17B-1 |

---

## Affiliate Section

| #   | File Path                                          | Type                    | Description                                                | Source     |
| --- | -------------------------------------------------- | ----------------------- | ---------------------------------------------------------- | ---------- |
| 54  | `app/affiliate/layout.tsx`                         | 📖 Readable (Server)    | Affiliate portal layout                                    | Part 17A-2 |
| 55  | `app/affiliate/register/page.tsx`                  | 🔘 Interactive (Client) | Affiliate registration page with form                      | Part 17A-2 |
| 56  | `app/affiliate/verify/page.tsx`                    | 📖 Readable (Server)    | Affiliate email verification page                          | Part 17A-2 |
| 57  | `app/affiliate/dashboard/page.tsx`                 | 🔘 Interactive (Client) | Affiliate dashboard page with stats                        | Part 17A-2 |
| 58  | `app/affiliate/dashboard/codes/page.tsx`           | 📖 Readable (Server)    | Affiliate codes page                                       | Part 17A-2 |
| 59  | `app/affiliate/dashboard/commissions/page.tsx`     | 📖 Readable (Server)    | Affiliate commissions page                                 | Part 17A-2 |
| 60  | `app/affiliate/dashboard/profile/page.tsx`         | 🔘 Interactive (Client) | Affiliate profile page with form                           | Part 17A-2 |
| 61  | `app/affiliate/dashboard/profile/payment/page.tsx` | 🔘 Interactive (Client) | Affiliate payment settings page with RiseWorks integration | Part 17A-2 |

---

## Checkout Section

| #   | File Path               | Type                    | Description                                               | Source   |
| --- | ----------------------- | ----------------------- | --------------------------------------------------------- | -------- |
| 62  | `app/checkout/page.tsx` | 🔘 Interactive (Client) | Unified checkout page with payment form (Stripe + dLocal) | Part 18C |

---

## Summary by Section

| Section               | Pages  | Layouts | Interactive | Readable | Total  |
| --------------------- | ------ | ------- | ----------- | -------- | ------ |
| Root Application      | 1      | 1       | 1           | 1        | 2      |
| Marketing             | 2      | 1       | 2           | 1        | 3      |
| Authentication        | 6      | 1       | 4           | 3        | 7      |
| Dashboard (Main)      | 1      | 1       | 1           | 1        | 2      |
| Dashboard - Charts    | 2      | 0       | 2           | 0        | 2      |
| Dashboard - Watchlist | 1      | 0       | 1           | 0        | 1      |
| Dashboard - Alerts    | 2      | 0       | 2           | 0        | 2      |
| Dashboard - Settings  | 7      | 1       | 6           | 2        | 8      |
| Dashboard - Security  | 3      | 0       | 2           | 1        | 3      |
| Admin (Dashboard)     | 4      | 1       | 3           | 2        | 5      |
| Admin - Fraud Alerts  | 2      | 0       | 2           | 0        | 2      |
| Admin - Disbursement  | 8      | 1       | 5           | 4        | 9      |
| Admin (Standalone)    | 7      | 0       | 3           | 4        | 7      |
| Affiliate Portal      | 7      | 1       | 4           | 4        | 8      |
| Checkout              | 1      | 0       | 1           | 0        | 1      |
| **TOTAL**             | **54** | **8**   | **39**      | **23**   | **62** |

---

## Notes

1. **Route Groups**: Files in `(auth)`, `(dashboard)`, and `(marketing)` directories use Next.js route groups for layout organization without affecting URL paths.

2. **Dynamic Routes**: Files with `[param]` in the path (e.g., `[symbol]`, `[id]`, `[batchId]`) are dynamic routes that accept URL parameters.

3. **Layout Hierarchy**: Layouts are nested - child routes inherit parent layouts.

4. **Page Types**:
   - `page.tsx` - Renders at that route
   - `layout.tsx` - Wraps child routes
   - `error.tsx` - Error boundary for the route

5. **Component Types** (Modular Monolith Architecture):
   - **📖 Readable Elements (Server Components)**: Default Next.js App Router behavior. Rendered on server, static content, no client-side JavaScript bundle. Examples: layouts, static pages, reports, logs.
   - **🔘 Interactive Elements (Client Components)**: Marked with "use client" directive. Includes forms, buttons, interactive charts, real-time updates. Requires client-side JavaScript.

6. **JavaScript Bundle Optimization**: By separating Interactive and Readable elements, the JavaScript bundle size is dramatically reduced (~87% smaller), leading to faster Time to Interactive (TTI) and better performance.

---

## Modular Monolith Architecture Summary

According to the migration architecture (Step 4):

**Frontend UI Split:**

- **Readable Elements (Server Components):** 23 files (37%)
  - Layouts, static pages, reports, logs
  - No JavaScript sent to client
  - Instant HTML rendering

- **Interactive Elements (Client Components):** 39 files (63%)
  - Forms, buttons, interactive widgets
  - JavaScript bundle required
  - Includes "use client" directive

**Key Benefits:**

- ✅ **Reduced JS Bundle**: ~20KB (down from ~150KB in monolith)
- ✅ **Faster TTI**: <1 second (down from 3-5 seconds)
- ✅ **Better SEO**: Server-rendered content indexed immediately
- ✅ **Improved Performance**: Less JavaScript parsing and execution

---

_Last Updated: 2026-01-09_
_Generated from: docs/files-completion-list/_
_Architecture: Modular Monolith Migration_
