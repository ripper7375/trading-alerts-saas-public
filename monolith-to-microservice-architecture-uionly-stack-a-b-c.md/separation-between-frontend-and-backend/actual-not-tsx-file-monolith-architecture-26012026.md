# Actual Non-TSX Files Inventory - Monolith Architecture

**Generated:** 2026-01-26
**Total Files:** 103 non-TSX files
**Architecture:** Next.js 14 App Router (Monolith)

---

## Summary

| Directory     | File Type | Count   |
| ------------- | --------- | ------- |
| `app/`        | `.ts`     | 100     |
| `app/`        | `.css`    | 1       |
| `components/` | `.ts`     | 2       |
| **Total**     |           | **103** |

---

## App Directory - TypeScript Files (98 files)

### Admin API Routes (`app/api/admin/`)

#### Affiliates Management (`app/api/admin/affiliates/`)

| #   | File Path                                                     |
| --- | ------------------------------------------------------------- |
| 1   | `app/api/admin/affiliates/[id]/distribute-codes/route.ts`     |
| 2   | `app/api/admin/affiliates/[id]/reactivate/route.ts`           |
| 3   | `app/api/admin/affiliates/[id]/route.ts`                      |
| 4   | `app/api/admin/affiliates/[id]/suspend/route.ts`              |
| 5   | `app/api/admin/affiliates/reports/code-inventory/route.ts`    |
| 6   | `app/api/admin/affiliates/reports/commission-owings/route.ts` |
| 7   | `app/api/admin/affiliates/reports/profit-loss/route.ts`       |
| 8   | `app/api/admin/affiliates/reports/sales-performance/route.ts` |
| 9   | `app/api/admin/affiliates/route.ts`                           |

#### Other Admin Routes

| #   | File Path                                    |
| --- | -------------------------------------------- |
| 10  | `app/api/admin/analytics/route.ts`           |
| 11  | `app/api/admin/api-usage/route.ts`           |
| 12  | `app/api/admin/codes/[code]/cancel/route.ts` |
| 13  | `app/api/admin/commissions/pay/route.ts`     |
| 14  | `app/api/admin/error-logs/route.ts`          |
| 15  | `app/api/admin/fraud-alerts/[id]/route.ts`   |
| 16  | `app/api/admin/fraud-alerts/route.ts`        |
| 17  | `app/api/admin/settings/affiliate/route.ts`  |
| 18  | `app/api/admin/users/route.ts`               |

### Affiliate API Routes (`app/api/affiliate/`)

| #   | File Path                                                |
| --- | -------------------------------------------------------- |
| 19  | `app/api/affiliate/auth/register/route.ts`               |
| 20  | `app/api/affiliate/auth/verify-email/route.ts`           |
| 21  | `app/api/affiliate/dashboard/code-inventory/route.ts`    |
| 22  | `app/api/affiliate/dashboard/codes/route.ts`             |
| 23  | `app/api/affiliate/dashboard/commission-report/route.ts` |
| 24  | `app/api/affiliate/dashboard/stats/route.ts`             |
| 25  | `app/api/affiliate/profile/payment/route.ts`             |
| 26  | `app/api/affiliate/profile/route.ts`                     |

### Alerts API Routes (`app/api/alerts/`)

| #   | File Path                      |
| --- | ------------------------------ |
| 27  | `app/api/alerts/[id]/route.ts` |
| 28  | `app/api/alerts/route.ts`      |

### Auth API Routes (`app/api/auth/`)

| #   | File Path                                   |
| --- | ------------------------------------------- |
| 29  | `app/api/auth/[...nextauth]/route.ts`       |
| 30  | `app/api/auth/forgot-password/route.ts`     |
| 31  | `app/api/auth/register/route.ts`            |
| 32  | `app/api/auth/resend-verification/route.ts` |
| 33  | `app/api/auth/reset-password/route.ts`      |
| 34  | `app/api/auth/track-login/route.ts`         |
| 35  | `app/api/auth/verify-email/route.ts`        |

### Candles API Routes (`app/api/candles/`)

| #   | File Path                           |
| --- | ----------------------------------- |
| 36  | `app/api/candles/[symbol]/route.ts` |

### Checkout API Routes (`app/api/checkout/`)

| #   | File Path                                 |
| --- | ----------------------------------------- |
| 37  | `app/api/checkout/route.ts`               |
| 38  | `app/api/checkout/validate-code/route.ts` |

### Config API Routes (`app/api/config/`)

| #   | File Path                           |
| --- | ----------------------------------- |
| 39  | `app/api/config/affiliate/route.ts` |

### Cron Job Routes (`app/api/cron/`)

| #   | File Path                                               |
| --- | ------------------------------------------------------- |
| 40  | `app/api/cron/check-expiring-subscriptions/route.ts`    |
| 41  | `app/api/cron/daily-maintenance/route.ts`               |
| 42  | `app/api/cron/distribute-codes/route.ts`                |
| 43  | `app/api/cron/downgrade-expired-subscriptions/route.ts` |
| 44  | `app/api/cron/expire-codes/route.ts`                    |
| 45  | `app/api/cron/process-pending-disbursements/route.ts`   |
| 46  | `app/api/cron/send-monthly-reports/route.ts`            |
| 47  | `app/api/cron/sync-riseworks-accounts/route.ts`         |

### Disbursement API Routes (`app/api/disbursement/`)

| #   | File Path                                                            |
| --- | -------------------------------------------------------------------- |
| 48  | `app/api/disbursement/affiliates/[affiliateId]/commissions/route.ts` |
| 49  | `app/api/disbursement/affiliates/[affiliateId]/route.ts`             |
| 50  | `app/api/disbursement/affiliates/payable/route.ts`                   |
| 51  | `app/api/disbursement/audit-logs/route.ts`                           |
| 52  | `app/api/disbursement/batches/[batchId]/execute/route.ts`            |
| 53  | `app/api/disbursement/batches/[batchId]/route.ts`                    |
| 54  | `app/api/disbursement/batches/preview/route.ts`                      |
| 55  | `app/api/disbursement/batches/route.ts`                              |
| 56  | `app/api/disbursement/config/route.ts`                               |
| 57  | `app/api/disbursement/health/route.ts`                               |
| 58  | `app/api/disbursement/pay/route.ts`                                  |
| 59  | `app/api/disbursement/reports/affiliate/[affiliateId]/route.ts`      |
| 60  | `app/api/disbursement/reports/summary/route.ts`                      |
| 61  | `app/api/disbursement/riseworks/accounts/route.ts`                   |
| 62  | `app/api/disbursement/riseworks/sync/route.ts`                       |
| 63  | `app/api/disbursement/transactions/route.ts`                         |

### Invoices API Routes (`app/api/invoices/`)

| #   | File Path                   |
| --- | --------------------------- |
| 64  | `app/api/invoices/route.ts` |

### Notifications API Routes (`app/api/notifications/`)

| #   | File Path                                  |
| --- | ------------------------------------------ |
| 65  | `app/api/notifications/[id]/read/route.ts` |
| 66  | `app/api/notifications/[id]/route.ts`      |
| 67  | `app/api/notifications/route.ts`           |

### Payments API Routes (`app/api/payments/`)

#### DLocal Integration (`app/api/payments/dlocal/`)

| #   | File Path                                                      |
| --- | -------------------------------------------------------------- |
| 68  | `app/api/payments/dlocal/[paymentId]/route.ts`                 |
| 69  | `app/api/payments/dlocal/check-three-day-eligibility/route.ts` |
| 70  | `app/api/payments/dlocal/convert/route.ts`                     |
| 71  | `app/api/payments/dlocal/create/route.ts`                      |
| 72  | `app/api/payments/dlocal/exchange-rate/route.ts`               |
| 73  | `app/api/payments/dlocal/methods/route.ts`                     |
| 74  | `app/api/payments/dlocal/validate-discount/route.ts`           |

### Subscription API Routes (`app/api/subscription/`)

| #   | File Path                              |
| --- | -------------------------------------- |
| 75  | `app/api/subscription/cancel/route.ts` |
| 76  | `app/api/subscription/route.ts`        |

### Test API Routes (`app/api/test/`)

| #   | File Path                    |
| --- | ---------------------------- |
| 77  | `app/api/test/seed/route.ts` |

### Tier API Routes (`app/api/tier/`)

| #   | File Path                              |
| --- | -------------------------------------- |
| 78  | `app/api/tier/check/[symbol]/route.ts` |
| 79  | `app/api/tier/combinations/route.ts`   |
| 80  | `app/api/tier/symbols/route.ts`        |

### User API Routes (`app/api/user/`)

#### 2FA Routes (`app/api/user/2fa/`)

| #   | File Path                                |
| --- | ---------------------------------------- |
| 81  | `app/api/user/2fa/backup-codes/route.ts` |
| 82  | `app/api/user/2fa/disable/route.ts`      |
| 83  | `app/api/user/2fa/setup/route.ts`        |
| 84  | `app/api/user/2fa/verify/route.ts`       |
| 85  | `app/api/user/2fa/verify-setup/route.ts` |

#### Account Management (`app/api/user/account/`)

| #   | File Path                                        |
| --- | ------------------------------------------------ |
| 86  | `app/api/user/account/deletion-cancel/route.ts`  |
| 87  | `app/api/user/account/deletion-confirm/route.ts` |
| 88  | `app/api/user/account/deletion-request/route.ts` |

#### Other User Routes

| #   | File Path                             |
| --- | ------------------------------------- |
| 89  | `app/api/user/login-history/route.ts` |
| 90  | `app/api/user/password/route.ts`      |
| 91  | `app/api/user/preferences/route.ts`   |
| 92  | `app/api/user/profile/route.ts`       |
| 93  | `app/api/user/sessions/[id]/route.ts` |
| 94  | `app/api/user/sessions/route.ts`      |

### Watchlist API Routes (`app/api/watchlist/`)

| #   | File Path                            |
| --- | ------------------------------------ |
| 95  | `app/api/watchlist/[id]/route.ts`    |
| 96  | `app/api/watchlist/reorder/route.ts` |
| 97  | `app/api/watchlist/route.ts`         |

### Webhooks API Routes (`app/api/webhooks/`)

| #   | File Path                             |
| --- | ------------------------------------- |
| 98  | `app/api/webhooks/dlocal/route.ts`    |
| 99  | `app/api/webhooks/riseworks/route.ts` |
| 100 | `app/api/webhooks/stripe/route.ts`    |

---

## App Directory - CSS Files (1 file)

| #   | File Path         |
| --- | ----------------- |
| 1   | `app/globals.css` |

---

## Components Directory - TypeScript Files (2 files)

| #   | File Path                       | Description                            |
| --- | ------------------------------- | -------------------------------------- |
| 1   | `components/affiliate/index.ts` | Barrel export for affiliate components |
| 2   | `components/payments/index.ts`  | Barrel export for payment components   |

---

## Directory Structure Overview

```
app/
├── api/                           # 98 .ts files - API Routes
│   ├── admin/                     # 18 files - Admin endpoints
│   │   ├── affiliates/            # 9 files - Affiliate management
│   │   │   ├── [id]/              # 4 files - Single affiliate ops
│   │   │   └── reports/           # 4 files - Reporting
│   │   ├── analytics/             # 1 file
│   │   ├── api-usage/             # 1 file
│   │   ├── codes/                 # 1 file
│   │   ├── commissions/           # 1 file
│   │   ├── error-logs/            # 1 file
│   │   ├── fraud-alerts/          # 2 files
│   │   ├── settings/              # 1 file
│   │   └── users/                 # 1 file
│   ├── affiliate/                 # 8 files - Affiliate portal API
│   │   ├── auth/                  # 2 files
│   │   ├── dashboard/             # 4 files
│   │   └── profile/               # 2 files
│   ├── alerts/                    # 2 files - Alert CRUD
│   ├── auth/                      # 7 files - Authentication
│   ├── candles/                   # 1 file - Market data
│   ├── checkout/                  # 2 files - Payment checkout
│   ├── config/                    # 1 file - Configuration
│   ├── cron/                      # 8 files - Scheduled jobs
│   ├── disbursement/              # 16 files - Payment disbursement
│   │   ├── affiliates/            # 3 files
│   │   ├── batches/               # 4 files
│   │   ├── reports/               # 2 files
│   │   └── riseworks/             # 2 files
│   ├── invoices/                  # 1 file
│   ├── notifications/             # 3 files
│   ├── payments/                  # 7 files - DLocal integration
│   │   └── dlocal/                # 7 files
│   ├── subscription/              # 2 files
│   ├── test/                      # 1 file - Testing utilities
│   ├── tier/                      # 3 files - Tier management
│   ├── user/                      # 14 files - User management
│   │   ├── 2fa/                   # 5 files - Two-factor auth
│   │   ├── account/               # 3 files - Account deletion
│   │   └── sessions/              # 2 files
│   ├── watchlist/                 # 3 files
│   └── webhooks/                  # 3 files - External webhooks
└── globals.css                    # 1 file - Global styles

components/
├── affiliate/
│   └── index.ts                   # Barrel export
└── payments/
    └── index.ts                   # Barrel export
```

---

## File Count by API Category

### Admin API (18 files)

| Category     | Files |
| ------------ | ----- |
| Affiliates   | 9     |
| Analytics    | 1     |
| API Usage    | 1     |
| Codes        | 1     |
| Commissions  | 1     |
| Error Logs   | 1     |
| Fraud Alerts | 2     |
| Settings     | 1     |
| Users        | 1     |

### Affiliate API (8 files)

| Category  | Files |
| --------- | ----- |
| Auth      | 2     |
| Dashboard | 4     |
| Profile   | 2     |

### Disbursement API (16 files)

| Category     | Files |
| ------------ | ----- |
| Affiliates   | 3     |
| Audit Logs   | 1     |
| Batches      | 4     |
| Config       | 1     |
| Health       | 1     |
| Pay          | 1     |
| Reports      | 2     |
| Riseworks    | 2     |
| Transactions | 1     |

### User API (14 files)

| Category      | Files |
| ------------- | ----- |
| 2FA           | 5     |
| Account       | 3     |
| Login History | 1     |
| Password      | 1     |
| Preferences   | 1     |
| Profile       | 1     |
| Sessions      | 2     |

### Other APIs

| Category          | Files |
| ----------------- | ----- |
| Alerts            | 2     |
| Auth              | 7     |
| Candles           | 1     |
| Checkout          | 2     |
| Config            | 1     |
| Cron Jobs         | 8     |
| Invoices          | 1     |
| Notifications     | 3     |
| Payments (DLocal) | 7     |
| Subscription      | 2     |
| Test              | 1     |
| Tier              | 3     |
| Watchlist         | 3     |
| Webhooks          | 3     |

---

## Summary Statistics

### By File Type

| Type                | Count   | Percentage |
| ------------------- | ------- | ---------- |
| `.ts` (TypeScript)  | 102     | 99.0%      |
| `.css` (Stylesheet) | 1       | 1.0%       |
| **Total**           | **103** | **100%**   |

### By Directory

| Directory     | Count   | Percentage |
| ------------- | ------- | ---------- |
| `app/api/`    | 100     | 97.1%      |
| `app/` (root) | 1       | 1.0%       |
| `components/` | 2       | 1.9%       |
| **Total**     | **103** | **100%**   |

### By API Domain

| Domain            | Files |
| ----------------- | ----- |
| Admin             | 18    |
| Disbursement      | 16    |
| User              | 14    |
| Cron              | 8     |
| Affiliate         | 8     |
| Auth              | 7     |
| Payments (DLocal) | 7     |
| Tier              | 3     |
| Watchlist         | 3     |
| Webhooks          | 3     |
| Notifications     | 3     |
| Alerts            | 2     |
| Checkout          | 2     |
| Subscription      | 2     |
| Candles           | 1     |
| Config            | 1     |
| Invoices          | 1     |
| Test              | 1     |

---

## Notes

1. **API Routes**: All `.ts` files in `app/api/` are Next.js 14 API route handlers
2. **Route Handlers**: Each `route.ts` exports HTTP method handlers (GET, POST, PUT, DELETE, PATCH)
3. **Dynamic Routes**: Files in `[param]` folders handle dynamic URL segments
4. **Catch-all Route**: `[...nextauth]` is a catch-all route for NextAuth.js
5. **Barrel Exports**: `index.ts` files in components provide clean import paths
6. **Global Styles**: `globals.css` contains Tailwind CSS directives and custom styles
7. **Cron Jobs**: Files in `app/api/cron/` are scheduled task handlers
8. **Webhooks**: External service callbacks (Stripe, DLocal, Riseworks)

---

## Comparison with TSX Files

| Category      | TSX Files | Non-TSX Files | Total   |
| ------------- | --------- | ------------- | ------- |
| `app/`        | 74        | 101           | 175     |
| `components/` | 77        | 2             | 79      |
| **Total**     | **151**   | **103**       | **254** |

---

_This inventory was generated by examining the actual filesystem on 2026-01-26_
