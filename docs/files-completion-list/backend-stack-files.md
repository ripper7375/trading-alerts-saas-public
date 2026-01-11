# Backend Logic Files - Complete List

This document lists all backend logic files in the Trading Alerts SaaS system.
Backend logic includes:

- Next.js API Routes (app/api/\*\*/route.ts)
- Database access layers (lib/db/\*)
- Business logic services (lib/\*\*)
- Background jobs (lib/jobs/_, lib/cron/_)
- Authentication & authorization
- Payment processing
- Email services

**Total Backend Files:** 177 files

**Note:** Part 6 files (Flask MT5 Service) are excluded as they have been archived and superseded by Part 20.

---

## Table of Contents

1. [API Routes - Authentication & User Management](#api-routes---authentication--user-management)
2. [API Routes - Indicators & Trading Data](#api-routes---indicators--trading-data)
3. [API Routes - Watchlist & Alerts](#api-routes---watchlist--alerts)
4. [API Routes - Payments & Billing](#api-routes---payments--billing)
5. [API Routes - Affiliate System](#api-routes---affiliate-system)
6. [API Routes - Admin](#api-routes---admin)
7. [API Routes - Disbursement](#api-routes---disbursement)
8. [API Routes - Webhooks](#api-routes---webhooks)
9. [API Routes - Cron Jobs](#api-routes---cron-jobs)
10. [API Routes - Notifications](#api-routes---notifications)
11. [API Routes - Confluence](#api-routes---confluence)
12. [API Routes - Cache & Health](#api-routes---cache--health)
13. [Library - Database Layer](#library---database-layer)
14. [Library - Authentication & Security](#library---authentication--security)
15. [Library - Tier Validation](#library---tier-validation)
16. [Library - Payment Processing](#library---payment-processing)
17. [Library - Affiliate System](#library---affiliate-system)
18. [Library - Disbursement System](#library---disbursement-system)
19. [Library - Indicators & Market Data](#library---indicators--market-data)
20. [Library - Caching Layer](#library---caching-layer)
21. [Library - Email Services](#library---email-services)
22. [Library - Background Jobs](#library---background-jobs)
23. [Library - Utilities & Helpers](#library---utilities--helpers)

---

## API Routes - Authentication & User Management

**Total:** 13 files

| #   | File Path                                        | Description                              | Source  |
| --- | ------------------------------------------------ | ---------------------------------------- | ------- |
| 1   | `app/api/auth/[...nextauth]/route.ts`            | NextAuth.js authentication handler       | Part 5  |
| 2   | `app/api/auth/register/route.ts`                 | User registration endpoint               | Part 5  |
| 3   | `app/api/auth/forgot-password/route.ts`          | Password reset request endpoint          | Part 5  |
| 4   | `app/api/auth/reset-password/route.ts`           | Password reset confirmation endpoint     | Part 5  |
| 5   | `app/api/auth/resend-verification/route.ts`      | Resend email verification endpoint       | Part 5  |
| 6   | `app/api/auth/track-login/route.ts`              | Track user login history                 | Part 16 |
| 7   | `app/api/user/profile/route.ts`                  | User profile CRUD operations             | Part 13 |
| 8   | `app/api/user/password/route.ts`                 | Update user password                     | Part 13 |
| 9   | `app/api/user/preferences/route.ts`              | User preferences (language, theme, etc.) | Part 13 |
| 10  | `app/api/user/login-history/route.ts`            | User login history retrieval             | Part 16 |
| 11  | `app/api/user/sessions/route.ts`                 | Active sessions management               | Part 16 |
| 12  | `app/api/user/sessions/[id]/route.ts`            | Revoke specific session                  | Part 16 |
| 13  | `app/api/user/account/deletion-request/route.ts` | Request account deletion                 | Part 13 |
| 14  | `app/api/user/account/deletion-cancel/route.ts`  | Cancel account deletion                  | Part 13 |
| 15  | `app/api/user/account/deletion-confirm/route.ts` | Confirm account deletion                 | Part 13 |

---

## API Routes - Two-Factor Authentication (2FA)

**Total:** 5 files

| #   | File Path                                | Description                            | Source      |
| --- | ---------------------------------------- | -------------------------------------- | ----------- |
| 16  | `app/api/user/2fa/setup/route.ts`        | Initialize 2FA setup (generate secret) | 2FA Feature |
| 17  | `app/api/user/2fa/verify-setup/route.ts` | Verify and enable 2FA                  | 2FA Feature |
| 18  | `app/api/user/2fa/verify/route.ts`       | Verify 2FA code during login           | 2FA Feature |
| 19  | `app/api/user/2fa/disable/route.ts`      | Disable 2FA                            | 2FA Feature |
| 20  | `app/api/user/2fa/backup-codes/route.ts` | Regenerate 2FA backup codes            | 2FA Feature |

---

## API Routes - Indicators & Trading Data

**Total:** 4 files

| #   | File Path                                          | Description                              | Source              |
| --- | -------------------------------------------------- | ---------------------------------------- | ------------------- |
| 21  | `app/api/indicators/route.ts`                      | List available indicators                | Part 7              |
| 22  | `app/api/indicators/[symbol]/[timeframe]/route.ts` | Get indicator data for symbol+timeframe  | Part 20 (Phase 04e) |
| 23  | `app/api/indicators/health/route.ts`               | Indicator service health check           | Part 20 (Phase 04e) |
| 24  | `app/api/timeframes/route.ts`                      | Get available timeframes (tier-filtered) | Part 20 (Phase 04e) |

---

## API Routes - Watchlist & Alerts

**Total:** 6 files

| #   | File Path                            | Description                      | Source  |
| --- | ------------------------------------ | -------------------------------- | ------- |
| 25  | `app/api/watchlist/route.ts`         | CRUD operations for watchlists   | Part 10 |
| 26  | `app/api/watchlist/[id]/route.ts`    | Single watchlist operations      | Part 10 |
| 27  | `app/api/watchlist/reorder/route.ts` | Reorder watchlist items          | Part 10 |
| 28  | `app/api/alerts/route.ts`            | CRUD operations for price alerts | Part 11 |
| 29  | `app/api/alerts/[id]/route.ts`       | Single alert operations          | Part 11 |

---

## API Routes - Payments & Billing

**Total:** 11 files

| #   | File Path                                                      | Description                            | Source   |
| --- | -------------------------------------------------------------- | -------------------------------------- | -------- |
| 30  | `app/api/checkout/route.ts`                                    | Unified checkout (Stripe + dLocal)     | Part 18C |
| 31  | `app/api/checkout/validate-code/route.ts`                      | Validate affiliate/discount code       | Part 18C |
| 32  | `app/api/payments/dlocal/methods/route.ts`                     | Get available dLocal payment methods   | Part 18C |
| 33  | `app/api/payments/dlocal/create/route.ts`                      | Create dLocal payment                  | Part 18C |
| 34  | `app/api/payments/dlocal/[paymentId]/route.ts`                 | Get dLocal payment status              | Part 18C |
| 35  | `app/api/payments/dlocal/exchange-rate/route.ts`               | Get USD → Local currency exchange rate | Part 18C |
| 36  | `app/api/payments/dlocal/convert/route.ts`                     | Convert USD to local currency          | Part 18C |
| 37  | `app/api/payments/dlocal/validate-discount/route.ts`           | Validate discount code                 | Part 18C |
| 38  | `app/api/payments/dlocal/check-three-day-eligibility/route.ts` | Check 3-day trial eligibility          | Part 18C |
| 39  | `app/api/invoices/route.ts`                                    | Get user invoices                      | Part 12  |

---

## API Routes - Affiliate System

**Total:** 9 files

| #   | File Path                                                | Description                            | Source     |
| --- | -------------------------------------------------------- | -------------------------------------- | ---------- |
| 40  | `app/api/config/affiliate/route.ts`                      | Get affiliate configuration            | Part 17A-1 |
| 41  | `app/api/affiliate/auth/register/route.ts`               | Affiliate registration                 | Part 17A-2 |
| 42  | `app/api/affiliate/auth/verify-email/route.ts`           | Verify affiliate email                 | Part 17A-2 |
| 43  | `app/api/affiliate/dashboard/stats/route.ts`             | Affiliate dashboard statistics         | Part 17A-2 |
| 44  | `app/api/affiliate/dashboard/codes/route.ts`             | Affiliate codes list                   | Part 17A-2 |
| 45  | `app/api/affiliate/dashboard/code-inventory/route.ts`    | Affiliate code inventory               | Part 17A-2 |
| 46  | `app/api/affiliate/dashboard/commission-report/route.ts` | Affiliate commission report            | Part 17A-2 |
| 47  | `app/api/affiliate/profile/route.ts`                     | Affiliate profile management           | Part 17A-2 |
| 48  | `app/api/affiliate/profile/payment/route.ts`             | Affiliate payment settings (RiseWorks) | Part 17A-2 |

---

## API Routes - Admin

**Total:** 20 files

| #   | File Path                                                     | Description                            | Source             |
| --- | ------------------------------------------------------------- | -------------------------------------- | ------------------ |
| 49  | `app/api/admin/users/route.ts`                                | User management (list, update, delete) | Part 14            |
| 50  | `app/api/admin/api-usage/route.ts`                            | API usage monitoring                   | Part 14            |
| 51  | `app/api/admin/error-logs/route.ts`                           | Error logs retrieval                   | Part 14            |
| 52  | `app/api/admin/analytics/route.ts`                            | Admin analytics dashboard              | Part 14            |
| 53  | `app/api/admin/cache/clear/route.ts`                          | Clear Redis cache                      | Part 20 (Phase 05) |
| 54  | `app/api/admin/settings/affiliate/route.ts`                   | Affiliate system settings              | Part 17A-1         |
| 55  | `app/api/admin/fraud-alerts/route.ts`                         | Fraud alerts list                      | Part 18C           |
| 56  | `app/api/admin/fraud-alerts/[id]/route.ts`                    | Fraud alert details                    | Part 18C           |
| 57  | `app/api/admin/affiliates/route.ts`                           | Affiliate management                   | Part 17B-1         |
| 58  | `app/api/admin/affiliates/[id]/route.ts`                      | Single affiliate operations            | Part 17B-1         |
| 59  | `app/api/admin/affiliates/[id]/suspend/route.ts`              | Suspend affiliate                      | Part 17B-1         |
| 60  | `app/api/admin/affiliates/[id]/reactivate/route.ts`           | Reactivate affiliate                   | Part 17B-1         |
| 61  | `app/api/admin/affiliates/[id]/distribute-codes/route.ts`     | Distribute codes to affiliate          | Part 17B-1         |
| 62  | `app/api/admin/affiliates/reports/sales-performance/route.ts` | Sales performance report               | Part 17B-1         |
| 63  | `app/api/admin/affiliates/reports/profit-loss/route.ts`       | Profit & loss report                   | Part 17B-1         |
| 64  | `app/api/admin/affiliates/reports/commission-owings/route.ts` | Commission owings report               | Part 17B-1         |
| 65  | `app/api/admin/affiliates/reports/code-inventory/route.ts`    | Code inventory report                  | Part 17B-1         |
| 66  | `app/api/admin/codes/[code]/cancel/route.ts`                  | Cancel affiliate code                  | Part 17B-1         |
| 67  | `app/api/admin/commissions/pay/route.ts`                      | Mark commission as paid                | Part 17B-1         |

---

## API Routes - Disbursement System

**Total:** 16 files

| #   | File Path                                                            | Description                         | Source   |
| --- | -------------------------------------------------------------------- | ----------------------------------- | -------- |
| 68  | `app/api/disbursement/affiliates/payable/route.ts`                   | Get affiliates eligible for payment | Part 19D |
| 69  | `app/api/disbursement/affiliates/[affiliateId]/route.ts`             | Get affiliate disbursement details  | Part 19D |
| 70  | `app/api/disbursement/affiliates/[affiliateId]/commissions/route.ts` | Get affiliate commission history    | Part 19D |
| 71  | `app/api/disbursement/batches/route.ts`                              | List payment batches                | Part 19D |
| 72  | `app/api/disbursement/batches/preview/route.ts`                      | Preview batch before creation       | Part 19D |
| 73  | `app/api/disbursement/batches/[batchId]/route.ts`                    | Get batch details                   | Part 19D |
| 74  | `app/api/disbursement/batches/[batchId]/execute/route.ts`            | Execute payment batch               | Part 19D |
| 75  | `app/api/disbursement/transactions/route.ts`                         | List disbursement transactions      | Part 19D |
| 76  | `app/api/disbursement/pay/route.ts`                                  | Initiate manual payment             | Part 19D |
| 77  | `app/api/disbursement/audit-logs/route.ts`                           | Disbursement audit logs             | Part 19D |
| 78  | `app/api/disbursement/config/route.ts`                               | Disbursement configuration          | Part 19D |
| 79  | `app/api/disbursement/health/route.ts`                               | Disbursement system health          | Part 19D |
| 80  | `app/api/disbursement/reports/summary/route.ts`                      | Disbursement summary report         | Part 19D |
| 81  | `app/api/disbursement/reports/affiliate/[affiliateId]/route.ts`      | Affiliate-specific report           | Part 19D |
| 82  | `app/api/disbursement/riseworks/accounts/route.ts`                   | RiseWorks accounts management       | Part 19D |
| 83  | `app/api/disbursement/riseworks/sync/route.ts`                       | Sync RiseWorks accounts             | Part 19D |

---

## API Routes - Webhooks

**Total:** 3 files

| #   | File Path                             | Description               | Source   |
| --- | ------------------------------------- | ------------------------- | -------- |
| 84  | `app/api/webhooks/stripe/route.ts`    | Stripe webhook handler    | Part 12  |
| 85  | `app/api/webhooks/dlocal/route.ts`    | dLocal webhook handler    | Part 18C |
| 86  | `app/api/webhooks/riseworks/route.ts` | RiseWorks webhook handler | Part 19D |

---

## API Routes - Cron Jobs

**Total:** 8 files

| #   | File Path                                               | Description                             | Source     |
| --- | ------------------------------------------------------- | --------------------------------------- | ---------- |
| 87  | `app/api/cron/check-expiring-subscriptions/route.ts`    | Check and alert expiring subscriptions  | Part 12    |
| 88  | `app/api/cron/downgrade-expired-subscriptions/route.ts` | Downgrade expired PRO users to FREE     | Part 12    |
| 89  | `app/api/cron/daily-maintenance/route.ts`               | Daily maintenance tasks                 | Part 14    |
| 90  | `app/api/cron/distribute-codes/route.ts`                | Monthly code distribution to affiliates | Part 17B-2 |
| 91  | `app/api/cron/expire-codes/route.ts`                    | Expire old affiliate codes              | Part 17B-2 |
| 92  | `app/api/cron/send-monthly-reports/route.ts`            | Send monthly reports to affiliates      | Part 17B-2 |
| 93  | `app/api/cron/process-pending-disbursements/route.ts`   | Process pending disbursements           | Part 19D   |
| 94  | `app/api/cron/sync-riseworks-accounts/route.ts`         | Sync RiseWorks account balances         | Part 19D   |

---

## API Routes - Notifications

**Total:** 3 files

| #   | File Path                                  | Description                    | Source  |
| --- | ------------------------------------------ | ------------------------------ | ------- |
| 95  | `app/api/notifications/route.ts`           | Get user notifications         | Part 15 |
| 96  | `app/api/notifications/[id]/route.ts`      | Single notification operations | Part 15 |
| 97  | `app/api/notifications/[id]/read/route.ts` | Mark notification as read      | Part 15 |

---

## API Routes - Confluence

**Total:** 1 file

| #   | File Path                              | Description                                 | Source             |
| --- | -------------------------------------- | ------------------------------------------- | ------------------ |
| 98  | `app/api/confluence/[symbol]/route.ts` | Multi-timeframe confluence score (PRO only) | Part 20 (Phase 06) |

---

## API Routes - Cache & Health

**Total:** 1 file

| #   | File Path                      | Description            | Source             |
| --- | ------------------------------ | ---------------------- | ------------------ |
| 99  | `app/api/cache/stats/route.ts` | Redis cache statistics | Part 20 (Phase 05) |

---

## API Routes - Testing

**Total:** 1 file

| #   | File Path                    | Description               | Source  |
| --- | ---------------------------- | ------------------------- | ------- |
| 100 | `app/api/test/seed/route.ts` | Seed test data (dev only) | Testing |

---

## Library - Database Layer

**Total:** 6 files

| #   | File Path                         | Description                               | Source              |
| --- | --------------------------------- | ----------------------------------------- | ------------------- |
| 101 | `lib/db/prisma.ts`                | Prisma client singleton                   | Part 2              |
| 102 | `lib/db/seed.ts`                  | Database seeding utilities                | Part 2              |
| 103 | `lib/db/postgresql.ts`            | PostgreSQL client with connection pooling | Part 20 (Phase 04b) |
| 104 | `lib/db/queries.ts`               | Database query functions                  | Part 20 (Phase 04b) |
| 105 | `lib/db/multi-timeframe-query.ts` | Multi-timeframe data queries              | Part 20 (Phase 06)  |

---

## Library - Authentication & Security

**Total:** 11 files

| #   | File Path                          | Description                        | Source      |
| --- | ---------------------------------- | ---------------------------------- | ----------- |
| 106 | `lib/auth/auth-options.ts`         | NextAuth configuration             | Part 5      |
| 107 | `lib/auth/session.ts`              | Session management utilities       | Part 5      |
| 108 | `lib/auth/session-tracker.ts`      | Track active user sessions         | Part 16     |
| 109 | `lib/auth/permissions.ts`          | Permission checking utilities      | Part 14     |
| 110 | `lib/auth/errors.ts`               | Authentication error classes       | Part 5      |
| 111 | `lib/auth/two-factor.ts`           | 2FA utilities (TOTP, backup codes) | 2FA Feature |
| 112 | `lib/security/device-detection.ts` | Device fingerprinting              | Part 16     |
| 113 | `lib/csrf.ts`                      | CSRF protection utilities          | Part 5      |
| 114 | `lib/rate-limit.ts`                | Rate limiting middleware           | Part 14     |
| 115 | `lib/tokens.ts`                    | Token generation and validation    | Part 5      |

---

## Library - Tier Validation

**Total:** 6 files

| #   | File Path                | Description                  | Source              |
| --- | ------------------------ | ---------------------------- | ------------------- |
| 116 | `lib/tier-validation.ts` | Tier validation (legacy)     | Part 7              |
| 117 | `lib/tier-helpers.ts`    | Tier helper functions        | Part 7              |
| 118 | `lib/tier-config.ts`     | Tier configuration constants | Part 7              |
| 119 | `lib/tier/validation.ts` | Tier validation (Part 20)    | Part 20 (Phase 04c) |
| 120 | `lib/tier/constants.ts`  | Tier constants               | Part 20 (Phase 04c) |
| 121 | `lib/tier/validator.ts`  | Tier validator utilities     | Part 20 (Phase 04c) |
| 122 | `lib/tier/index.ts`      | Tier module exports          | Part 20 (Phase 04c) |

---

## Library - Payment Processing

**Total:** 9 files

| #   | File Path                                   | Description                   | Source   |
| --- | ------------------------------------------- | ----------------------------- | -------- |
| 123 | `lib/stripe/stripe.ts`                      | Stripe client configuration   | Part 12  |
| 124 | `lib/stripe/webhook-handlers.ts`            | Stripe webhook event handlers | Part 12  |
| 125 | `lib/dlocal/dlocal-payment.service.ts`      | dLocal payment processing     | Part 18C |
| 126 | `lib/dlocal/payment-methods.service.ts`     | dLocal payment methods        | Part 18C |
| 127 | `lib/dlocal/currency-converter.service.ts`  | Currency conversion utilities | Part 18C |
| 128 | `lib/dlocal/three-day-validator.service.ts` | 3-day trial eligibility       | Part 18C |
| 129 | `lib/dlocal/constants.ts`                   | dLocal constants              | Part 18C |
| 130 | `lib/fraud/fraud-detection.service.ts`      | Fraud detection service       | Part 18C |
| 131 | `lib/geo/detect-country.ts`                 | Country detection from IP     | Part 18C |

---

## Library - Affiliate System

**Total:** 7 files

| #   | File Path                                | Description                    | Source     |
| --- | ---------------------------------------- | ------------------------------ | ---------- |
| 132 | `lib/affiliate/registration.ts`          | Affiliate registration logic   | Part 17A-1 |
| 133 | `lib/affiliate/code-generator.ts`        | Affiliate code generation      | Part 17A-1 |
| 134 | `lib/affiliate/commission-calculator.ts` | Commission calculation         | Part 17A-1 |
| 135 | `lib/affiliate/validators.ts`            | Affiliate validation utilities | Part 17A-1 |
| 136 | `lib/affiliate/report-builder.ts`        | Affiliate report generation    | Part 17B-1 |
| 137 | `lib/affiliate/types.ts`                 | Affiliate type definitions     | Part 17A-1 |
| 138 | `lib/affiliate/constants.ts`             | Affiliate constants            | Part 17A-1 |

---

## Library - Disbursement System

**Total:** 17 files

| #   | File Path                                             | Description                       | Source   |
| --- | ----------------------------------------------------- | --------------------------------- | -------- |
| 139 | `lib/disbursement/constants.ts`                       | Disbursement constants            | Part 19D |
| 140 | `lib/disbursement/services/batch-manager.ts`          | Payment batch management          | Part 19D |
| 141 | `lib/disbursement/services/commission-aggregator.ts`  | Aggregate commissions for payout  | Part 19D |
| 142 | `lib/disbursement/services/payout-calculator.ts`      | Calculate payout amounts          | Part 19D |
| 143 | `lib/disbursement/services/transaction-service.ts`    | Transaction CRUD operations       | Part 19D |
| 144 | `lib/disbursement/services/transaction-logger.ts`     | Transaction logging               | Part 19D |
| 145 | `lib/disbursement/services/payment-orchestrator.ts`   | Payment orchestration logic       | Part 19D |
| 146 | `lib/disbursement/services/retry-handler.ts`          | Payment retry logic               | Part 19D |
| 147 | `lib/disbursement/providers/base-provider.ts`         | Base payment provider interface   | Part 19D |
| 148 | `lib/disbursement/providers/provider-factory.ts`      | Payment provider factory          | Part 19D |
| 149 | `lib/disbursement/providers/mock-provider.ts`         | Mock provider for testing         | Part 19D |
| 150 | `lib/disbursement/providers/rise/rise-provider.ts`    | RiseWorks provider implementation | Part 19D |
| 151 | `lib/disbursement/providers/rise/siwe-auth.ts`        | Sign-In with Ethereum (SIWE)      | Part 19D |
| 152 | `lib/disbursement/providers/rise/webhook-verifier.ts` | RiseWorks webhook verification    | Part 19D |
| 153 | `lib/disbursement/providers/rise/amount-converter.ts` | USD to USDC conversion            | Part 19D |
| 154 | `lib/disbursement/webhook/event-processor.ts`         | Webhook event processing          | Part 19D |
| 155 | `lib/disbursement/cron/disbursement-processor.ts`     | Cron job for disbursements        | Part 19D |

---

## Library - Indicators & Market Data

**Total:** 4 files

| #   | File Path                              | Description                 | Source              |
| --- | -------------------------------------- | --------------------------- | ------------------- |
| 156 | `lib/indicators/types.ts`              | Indicator type definitions  | Part 20 (Phase 04a) |
| 157 | `lib/indicators/timeframe-filter.ts`   | Timeframe filtering logic   | Part 20 (Phase 03)  |
| 158 | `lib/market-hours/trading-sessions.ts` | Trading hours configuration | Part 20 (Phase 04d) |
| 159 | `lib/market-hours/validator.ts`        | Market hours validation     | Part 20 (Phase 04d) |

**Note:** Part 6 files (`lib/api/mt5-client.ts`, `lib/api/mt5-transform.ts`) are excluded as they are being replaced by Part 20.

---

## Library - Confluence System

**Total:** 4 files

| #   | File Path                      | Description                  | Source             |
| --- | ------------------------------ | ---------------------------- | ------------------ |
| 160 | `lib/confluence/types.ts`      | Confluence type definitions  | Part 20 (Phase 06) |
| 161 | `lib/confluence/signals.ts`    | Signal detection functions   | Part 20 (Phase 06) |
| 162 | `lib/confluence/calculator.ts` | Confluence score calculation | Part 20 (Phase 06) |

---

## Library - Caching Layer

**Total:** 6 files

| #   | File Path                         | Description                  | Source             |
| --- | --------------------------------- | ---------------------------- | ------------------ |
| 163 | `lib/redis/client.ts`             | Redis client (legacy)        | Part 15            |
| 164 | `lib/cache/redis.ts`              | Redis client (Part 20)       | Part 20 (Phase 05) |
| 165 | `lib/cache/indicator-cache.ts`    | Indicator data caching       | Part 20 (Phase 05) |
| 166 | `lib/cache/confluence-cache.ts`   | Confluence score caching     | Part 20 (Phase 06) |
| 167 | `lib/cache/cache-invalidation.ts` | Cache invalidation utilities | Part 20 (Phase 05) |
| 168 | `lib/cache/cache-manager.ts`      | Cache management utilities   | Part 20 (Phase 05) |

---

## Library - Email Services

**Total:** 2 files

| #   | File Path                          | Description                        | Source  |
| --- | ---------------------------------- | ---------------------------------- | ------- |
| 169 | `lib/email/email.ts`               | Email sending utilities (SendGrid) | Part 5  |
| 170 | `lib/email/subscription-emails.ts` | Subscription-related emails        | Part 12 |

---

## Library - Background Jobs

**Total:** 5 files

| #   | File Path                                     | Description                  | Source     |
| --- | --------------------------------------------- | ---------------------------- | ---------- |
| 171 | `lib/jobs/queue.ts`                           | Job queue management         | Part 15    |
| 172 | `lib/jobs/alert-checker.ts`                   | Price alert checking job     | Part 11    |
| 173 | `lib/cron/check-expiring-subscriptions.ts`    | Check expiring subscriptions | Part 12    |
| 174 | `lib/cron/downgrade-expired-subscriptions.ts` | Downgrade expired users      | Part 12    |
| 175 | `lib/cron/monthly-distribution.ts`            | Monthly code distribution    | Part 17B-2 |

---

## Library - Utilities & Helpers

**Total:** 11 files

| #   | File Path                          | Description               | Source  |
| --- | ---------------------------------- | ------------------------- | ------- |
| 176 | `lib/utils.ts`                     | General utility functions | Part 1  |
| 177 | `lib/utils/helpers.ts`             | Helper functions          | Part 1  |
| 178 | `lib/utils/formatters.ts`          | Data formatting utilities | Part 1  |
| 179 | `lib/utils/constants.ts`           | General constants         | Part 1  |
| 180 | `lib/logger.ts`                    | Logging utilities         | Part 1  |
| 181 | `lib/errors/api-error.ts`          | API error classes         | Part 14 |
| 182 | `lib/errors/error-handler.ts`      | Error handling middleware | Part 14 |
| 183 | `lib/errors/error-logger.ts`       | Error logging utilities   | Part 14 |
| 184 | `lib/monitoring/system-monitor.ts` | System health monitoring  | Part 14 |
| 185 | `lib/constants/business-rules.ts`  | Business rule constants   | Part 1  |
| 186 | `lib/preferences/defaults.ts`      | User preference defaults  | Part 13 |

---

## Library - Admin Utilities

**Total:** 3 files

| #   | File Path                           | Description                    | Source     |
| --- | ----------------------------------- | ------------------------------ | ---------- |
| 187 | `lib/admin/affiliate-management.ts` | Affiliate management utilities | Part 17B-1 |
| 188 | `lib/admin/code-distribution.ts`    | Code distribution logic        | Part 17B-2 |
| 189 | `lib/admin/pnl-calculator.ts`       | Profit & loss calculation      | Part 17B-1 |

---

## Library - Validations

**Total:** 5 files

| #   | File Path                       | Description                       | Source  |
| --- | ------------------------------- | --------------------------------- | ------- |
| 190 | `lib/validations/auth.ts`       | Authentication validation schemas | Part 5  |
| 191 | `lib/validations/user.ts`       | User validation schemas           | Part 13 |
| 192 | `lib/validations/alert.ts`      | Alert validation schemas          | Part 11 |
| 193 | `lib/validations/watchlist.ts`  | Watchlist validation schemas      | Part 10 |
| 194 | `lib/validations/indicators.ts` | Indicator validation schemas      | Part 7  |

---

## Library - Other

**Total:** 2 files

| #   | File Path                         | Description                            | Source     |
| --- | --------------------------------- | -------------------------------------- | ---------- |
| 195 | `lib/websocket/server.ts`         | WebSocket server for real-time updates | Part 15    |
| 196 | `lib/hooks/useAffiliateConfig.ts` | Affiliate config hook (server-side)    | Part 17A-1 |

---

## Summary by Category

| Category                                | File Count | Percentage |
| --------------------------------------- | ---------- | ---------- |
| **API Routes**                          | 100        | 51%        |
| **Library - Services & Business Logic** | 96         | 49%        |
| **Total Backend Files**                 | 196        | 100%       |

---

## Summary by Part

| Part        | Description                        | Backend Files |
| ----------- | ---------------------------------- | ------------- |
| Part 1      | Foundation & Configuration         | 5             |
| Part 2      | Database Setup                     | 2             |
| Part 5      | Authentication                     | 12            |
| Part 7      | Indicators (Legacy)                | 7             |
| Part 10     | Watchlist                          | 6             |
| Part 11     | Alerts                             | 5             |
| Part 12     | Payments & Stripe                  | 10            |
| Part 13     | User Settings                      | 8             |
| Part 14     | Admin Dashboard                    | 12            |
| Part 15     | Notifications                      | 5             |
| Part 16     | Security (Login History, Sessions) | 4             |
| Part 17A    | Affiliate Registration & Portal    | 16            |
| Part 17B    | Admin Affiliate Management         | 16            |
| Part 18C    | dLocal & Fraud Detection           | 16            |
| Part 19D    | Disbursement System                | 24            |
| Part 20     | SQLite + Sync to PostgreSQL        | 28            |
| 2FA Feature | Two-Factor Authentication          | 6             |
| Testing     | Test utilities                     | 1             |
| **Total**   |                                    | **196**       |

---

## Part 6 Exclusion Note

**Part 6 (Flask MT5 Service)** files are **NOT included** in this list because:

1. Part 6 has been **superseded by Part 20** (SQLite + Sync to PostgreSQL)
2. Part 6 code has been **archived** to `archive/part6-flask-mt5/`
3. Part 6 files will be **removed** during Part 20 Phase 09 (Migration & Cutover)

**Excluded Part 6 files:**

- `lib/api/mt5-client.ts` (replaced by `lib/cache/indicator-cache.ts` in Part 20)
- `lib/api/mt5-transform.ts` (no longer needed, data comes from PostgreSQL)
- All files in `mt5-service/` directory (Flask service, archived)

---

## Modular Monolith Architecture

This backend logic represents the **Backend Stack** in the Modular Monolith architecture:

```
┌───────────────────────────────────────────────────┐
│ Frontend (Vercel)                                  │
│ - Next.js pages, components, client-side logic    │
└────────────────────┬──────────────────────────────┘
                     │ HTTPS (API calls)
                     ▼
┌───────────────────────────────────────────────────┐
│ Backend Logic (Next.js API Routes + Libraries)    │  ◄── THIS DOCUMENT
│ - API Routes (app/api/**/route.ts)               │
│ - Business Logic (lib/**/*)                       │
│ - Database Access (lib/db/*)                      │
│ - Authentication (lib/auth/*)                     │
│ - Payment Processing (lib/stripe/*, lib/dlocal/*) │
│ - Background Jobs (lib/jobs/*, lib/cron/*)        │
└────────────────────┬──────────────────────────────┘
                     │
              ┌──────┴──────┐
              ▼             ▼
┌──────────────────┐  ┌────────────────────────────┐
│ PostgreSQL       │  │ Redis Cache                │
│ (TimescaleDB)    │  │ (Upstash)                  │
└──────────────────┘  └────────────────────────────┘
```

---

_Last Updated: 2026-01-09_
_Generated from: app/api/** and lib/** directories_
_Architecture: Modular Monolith Migration_
