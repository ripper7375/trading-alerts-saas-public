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

**Total Backend Files:** 203 files

**Note:** Part 6 files (Flask MT5 Service) are excluded as they have been archived and superseded by Part 20.

---

## Table of Contents

1. [API Routes - Authentication & User Management](#api-routes---authentication--user-management)
2. [API Routes - Two-Factor Authentication (2FA)](#api-routes---two-factor-authentication-2fa)
3. [API Routes - Tier System](#api-routes---tier-system)
4. [API Routes - Watchlist & Alerts](#api-routes---watchlist--alerts)
5. [API Routes - Payments & Billing](#api-routes---payments--billing)
6. [API Routes - Affiliate System](#api-routes---affiliate-system)
7. [API Routes - Admin](#api-routes---admin)
8. [API Routes - Disbursement](#api-routes---disbursement)
9. [API Routes - Webhooks](#api-routes---webhooks)
10. [API Routes - Cron Jobs](#api-routes---cron-jobs)
11. [API Routes - Notifications](#api-routes---notifications)
12. [Library - Database Layer](#library---database-layer)
13. [Library - Authentication & Security](#library---authentication--security)
14. [Library - Tier Validation](#library---tier-validation)
15. [Library - Payment Processing](#library---payment-processing)
16. [Library - Affiliate System](#library---affiliate-system)
17. [Library - Disbursement System](#library---disbursement-system)
18. [Library - Caching Layer](#library---caching-layer)
19. [Library - Email Services](#library---email-services)
20. [Library - Background Jobs](#library---background-jobs)
21. [Library - Utilities & Helpers](#library---utilities--helpers)
22. [Type Definitions](#type-definitions)
23. [Validation Schemas](#validation-schemas)

---

## API Routes - Authentication & User Management

**Total:** 16 files

| #   | File Path                                        | Description                              | Source  |
| --- | ------------------------------------------------ | ---------------------------------------- | ------- |
| 1   | `app/api/auth/[...nextauth]/route.ts`            | NextAuth.js authentication handler       | Part 5  |
| 2   | `app/api/auth/register/route.ts`                 | User registration endpoint               | Part 5  |
| 3   | `app/api/auth/verify-email/route.ts`             | Email verification endpoint              | Part 5  |
| 4   | `app/api/auth/forgot-password/route.ts`          | Password reset request endpoint          | Part 5  |
| 5   | `app/api/auth/reset-password/route.ts`           | Password reset confirmation endpoint     | Part 5  |
| 6   | `app/api/auth/resend-verification/route.ts`      | Resend email verification endpoint       | Part 5  |
| 7   | `app/api/auth/track-login/route.ts`              | Track user login history                 | Part 16 |
| 8   | `app/api/user/profile/route.ts`                  | User profile CRUD operations             | Part 13 |
| 9   | `app/api/user/password/route.ts`                 | Update user password                     | Part 13 |
| 10  | `app/api/user/preferences/route.ts`              | User preferences (language, theme, etc.) | Part 13 |
| 11  | `app/api/user/login-history/route.ts`            | User login history retrieval             | Part 16 |
| 12  | `app/api/user/sessions/route.ts`                 | Active sessions management               | Part 16 |
| 13  | `app/api/user/sessions/[id]/route.ts`            | Revoke specific session                  | Part 16 |
| 14  | `app/api/user/account/deletion-request/route.ts` | Request account deletion                 | Part 13 |
| 15  | `app/api/user/account/deletion-cancel/route.ts`  | Cancel account deletion                  | Part 13 |
| 16  | `app/api/user/account/deletion-confirm/route.ts` | Confirm account deletion                 | Part 13 |

---

## API Routes - Two-Factor Authentication (2FA)

**Total:** 5 files

| #   | File Path                                | Description                            | Source  |
| --- | ---------------------------------------- | -------------------------------------- | ------- |
| 17  | `app/api/user/2fa/setup/route.ts`        | Initialize 2FA setup (generate secret) | Part 13 |
| 18  | `app/api/user/2fa/verify-setup/route.ts` | Verify and enable 2FA                  | Part 13 |
| 19  | `app/api/user/2fa/verify/route.ts`       | Verify 2FA code during login           | Part 13 |
| 20  | `app/api/user/2fa/disable/route.ts`      | Disable 2FA                            | Part 13 |
| 21  | `app/api/user/2fa/backup-codes/route.ts` | Regenerate 2FA backup codes            | Part 13 |

---

## API Routes - Tier System

**Total:** 3 files

| #   | File Path                              | Description                           | Source |
| --- | -------------------------------------- | ------------------------------------- | ------ |
| 22  | `app/api/tier/symbols/route.ts`        | Get accessible symbols with metadata  | Part 4 |
| 23  | `app/api/tier/check/[symbol]/route.ts` | Check symbol access for user's tier   | Part 4 |
| 24  | `app/api/tier/combinations/route.ts`   | Get all symbol+timeframe combinations | Part 4 |

---

## API Routes - Watchlist & Alerts

**Total:** 5 files

| #   | File Path                            | Description                      | Source  |
| --- | ------------------------------------ | -------------------------------- | ------- |
| 25  | `app/api/watchlist/route.ts`         | CRUD operations for watchlists   | Part 10 |
| 26  | `app/api/watchlist/[id]/route.ts`    | Single watchlist operations      | Part 10 |
| 27  | `app/api/watchlist/reorder/route.ts` | Reorder watchlist items          | Part 10 |
| 28  | `app/api/alerts/route.ts`            | CRUD operations for price alerts | Part 11 |
| 29  | `app/api/alerts/[id]/route.ts`       | Single alert operations          | Part 11 |

---

## API Routes - Payments & Billing

**Total:** 13 files

| #   | File Path                                                      | Description                            | Source   |
| --- | -------------------------------------------------------------- | -------------------------------------- | -------- |
| 30  | `app/api/checkout/route.ts`                                    | Unified checkout (Stripe + dLocal)     | Part 17A |
| 31  | `app/api/checkout/validate-code/route.ts`                      | Validate affiliate/discount code       | Part 17A |
| 32  | `app/api/subscription/route.ts`                                | Get current subscription               | Part 12  |
| 33  | `app/api/subscription/cancel/route.ts`                         | Cancel subscription                    | Part 12  |
| 34  | `app/api/payments/dlocal/methods/route.ts`                     | Get available dLocal payment methods   | Part 18A |
| 35  | `app/api/payments/dlocal/create/route.ts`                      | Create dLocal payment                  | Part 18A |
| 36  | `app/api/payments/dlocal/[paymentId]/route.ts`                 | Get dLocal payment status              | Part 18A |
| 37  | `app/api/payments/dlocal/exchange-rate/route.ts`               | Get USD → Local currency exchange rate | Part 18A |
| 38  | `app/api/payments/dlocal/convert/route.ts`                     | Convert USD to local currency          | Part 18A |
| 39  | `app/api/payments/dlocal/validate-discount/route.ts`           | Validate discount code                 | Part 18C |
| 40  | `app/api/payments/dlocal/check-three-day-eligibility/route.ts` | Check 3-day trial eligibility          | Part 18B |
| 41  | `app/api/invoices/route.ts`                                    | Get user invoices                      | Part 12  |
| 42  | `app/api/config/affiliate/route.ts`                            | Get affiliate configuration            | Part 17A |

---

## API Routes - Affiliate System

**Total:** 8 files

| #   | File Path                                                | Description                            | Source     |
| --- | -------------------------------------------------------- | -------------------------------------- | ---------- |
| 43  | `app/api/affiliate/auth/register/route.ts`               | Affiliate registration                 | Part 17A-1 |
| 44  | `app/api/affiliate/auth/verify-email/route.ts`           | Verify affiliate email                 | Part 17A-1 |
| 45  | `app/api/affiliate/dashboard/stats/route.ts`             | Affiliate dashboard statistics         | Part 17A-1 |
| 46  | `app/api/affiliate/dashboard/codes/route.ts`             | Affiliate codes list                   | Part 17A-1 |
| 47  | `app/api/affiliate/dashboard/code-inventory/route.ts`    | Affiliate code inventory               | Part 17A-1 |
| 48  | `app/api/affiliate/dashboard/commission-report/route.ts` | Affiliate commission report            | Part 17A-1 |
| 49  | `app/api/affiliate/profile/route.ts`                     | Affiliate profile management           | Part 17A-1 |
| 50  | `app/api/affiliate/profile/payment/route.ts`             | Affiliate payment settings (RiseWorks) | Part 17A-1 |

---

## API Routes - Admin

**Total:** 18 files

| #   | File Path                                                     | Description                            | Source     |
| --- | ------------------------------------------------------------- | -------------------------------------- | ---------- |
| 51  | `app/api/admin/users/route.ts`                                | User management (list, update, delete) | Part 14    |
| 52  | `app/api/admin/api-usage/route.ts`                            | API usage monitoring                   | Part 14    |
| 53  | `app/api/admin/error-logs/route.ts`                           | Error logs retrieval                   | Part 14    |
| 54  | `app/api/admin/analytics/route.ts`                            | Admin analytics dashboard              | Part 14    |
| 55  | `app/api/admin/settings/affiliate/route.ts`                   | Affiliate system settings              | Part 17B-1 |
| 56  | `app/api/admin/fraud-alerts/route.ts`                         | Fraud alerts list                      | Part 18C   |
| 57  | `app/api/admin/fraud-alerts/[id]/route.ts`                    | Fraud alert details                    | Part 18C   |
| 58  | `app/api/admin/affiliates/route.ts`                           | Affiliate management                   | Part 17B-1 |
| 59  | `app/api/admin/affiliates/[id]/route.ts`                      | Single affiliate operations            | Part 17B-1 |
| 60  | `app/api/admin/affiliates/[id]/suspend/route.ts`              | Suspend affiliate                      | Part 17B-1 |
| 61  | `app/api/admin/affiliates/[id]/reactivate/route.ts`           | Reactivate affiliate                   | Part 17B-1 |
| 62  | `app/api/admin/affiliates/[id]/distribute-codes/route.ts`     | Distribute codes to affiliate          | Part 17B-1 |
| 63  | `app/api/admin/affiliates/reports/sales-performance/route.ts` | Sales performance report               | Part 17B-1 |
| 64  | `app/api/admin/affiliates/reports/profit-loss/route.ts`       | Profit & loss report                   | Part 17B-1 |
| 65  | `app/api/admin/affiliates/reports/commission-owings/route.ts` | Commission owings report               | Part 17B-1 |
| 66  | `app/api/admin/affiliates/reports/code-inventory/route.ts`    | Code inventory report                  | Part 17B-1 |
| 67  | `app/api/admin/codes/[code]/cancel/route.ts`                  | Cancel affiliate code                  | Part 17B-1 |
| 68  | `app/api/admin/commissions/pay/route.ts`                      | Mark commission as paid                | Part 17B-1 |

---

## API Routes - Disbursement

**Total:** 16 files

| #   | File Path                                                            | Description                         | Source   |
| --- | -------------------------------------------------------------------- | ----------------------------------- | -------- |
| 69  | `app/api/disbursement/affiliates/payable/route.ts`                   | Get affiliates eligible for payment | Part 19B |
| 70  | `app/api/disbursement/affiliates/[affiliateId]/route.ts`             | Get affiliate disbursement details  | Part 19B |
| 71  | `app/api/disbursement/affiliates/[affiliateId]/commissions/route.ts` | Get affiliate commission history    | Part 19B |
| 72  | `app/api/disbursement/batches/route.ts`                              | List payment batches                | Part 19B |
| 73  | `app/api/disbursement/batches/preview/route.ts`                      | Preview batch before creation       | Part 19B |
| 74  | `app/api/disbursement/batches/[batchId]/route.ts`                    | Get batch details                   | Part 19B |
| 75  | `app/api/disbursement/batches/[batchId]/execute/route.ts`            | Execute payment batch               | Part 19B |
| 76  | `app/api/disbursement/transactions/route.ts`                         | List disbursement transactions      | Part 19C |
| 77  | `app/api/disbursement/pay/route.ts`                                  | Initiate manual payment             | Part 19C |
| 78  | `app/api/disbursement/audit-logs/route.ts`                           | Disbursement audit logs             | Part 19C |
| 79  | `app/api/disbursement/config/route.ts`                               | Disbursement configuration          | Part 19C |
| 80  | `app/api/disbursement/health/route.ts`                               | Disbursement system health          | Part 19C |
| 81  | `app/api/disbursement/reports/summary/route.ts`                      | Disbursement summary report         | Part 19C |
| 82  | `app/api/disbursement/reports/affiliate/[affiliateId]/route.ts`      | Affiliate-specific report           | Part 17B |
| 83  | `app/api/disbursement/riseworks/accounts/route.ts`                   | RiseWorks accounts management       | Part 19B |
| 84  | `app/api/disbursement/riseworks/sync/route.ts`                       | Sync RiseWorks accounts             | Part 19B |

---

## API Routes - Webhooks

**Total:** 3 files

| #   | File Path                             | Description               | Source   |
| --- | ------------------------------------- | ------------------------- | -------- |
| 85  | `app/api/webhooks/stripe/route.ts`    | Stripe webhook handler    | Part 12  |
| 86  | `app/api/webhooks/dlocal/route.ts`    | dLocal webhook handler    | Part 18B |
| 87  | `app/api/webhooks/riseworks/route.ts` | RiseWorks webhook handler | Part 19C |

---

## API Routes - Cron Jobs

**Total:** 8 files

| #   | File Path                                               | Description                             | Source     |
| --- | ------------------------------------------------------- | --------------------------------------- | ---------- |
| 88  | `app/api/cron/check-expiring-subscriptions/route.ts`    | Check and alert expiring subscriptions  | Part 18B   |
| 89  | `app/api/cron/downgrade-expired-subscriptions/route.ts` | Downgrade expired PRO users to FREE     | Part 18B   |
| 90  | `app/api/cron/daily-maintenance/route.ts`               | Daily maintenance tasks                 | Part 14    |
| 91  | `app/api/cron/distribute-codes/route.ts`                | Monthly code distribution to affiliates | Part 17B-2 |
| 92  | `app/api/cron/expire-codes/route.ts`                    | Expire old affiliate codes              | Part 17B-2 |
| 93  | `app/api/cron/send-monthly-reports/route.ts`            | Send monthly reports to affiliates      | Part 17B-2 |
| 94  | `app/api/cron/process-pending-disbursements/route.ts`   | Process pending disbursements           | Part 19C   |
| 95  | `app/api/cron/sync-riseworks-accounts/route.ts`         | Sync RiseWorks account balances         | Part 19C   |

---

## API Routes - Notifications

**Total:** 3 files

| #   | File Path                                  | Description                    | Source  |
| --- | ------------------------------------------ | ------------------------------ | ------- |
| 96  | `app/api/notifications/route.ts`           | Get user notifications         | Part 15 |
| 97  | `app/api/notifications/[id]/route.ts`      | Single notification operations | Part 15 |
| 98  | `app/api/notifications/[id]/read/route.ts` | Mark notification as read      | Part 15 |

---

## Library - Database Layer

**Total:** 4 files

| #   | File Path              | Description                    | Source  |
| --- | ---------------------- | ------------------------------ | ------- |
| 99  | `lib/db/prisma.ts`     | Prisma client singleton        | Part 16 |
| 100 | `lib/db/seed.ts`       | Database seeding utilities     | Part 16 |
| 101 | `prisma/schema.prisma` | Database schema (30+ models)   | Part 16 |
| 102 | `prisma/seed.ts`       | Prisma seed script entry point | Part 16 |

---

## Library - Authentication & Security

**Total:** 10 files

| #   | File Path                              | Description                        | Source  |
| --- | -------------------------------------- | ---------------------------------- | ------- |
| 103 | `lib/auth/auth-options.ts`             | NextAuth configuration             | Part 16 |
| 104 | `lib/auth/session.ts`                  | Session management utilities       | Part 16 |
| 105 | `lib/auth/session-tracker.ts`          | Track active user sessions         | Part 16 |
| 106 | `lib/auth/permissions.ts`              | Permission checking utilities      | Part 16 |
| 107 | `lib/auth/errors.ts`                   | Authentication error classes       | Part 16 |
| 108 | `lib/auth/two-factor.ts`               | 2FA utilities (TOTP, backup codes) | Part 16 |
| 109 | `lib/security/device-detection.ts`     | Device fingerprinting              | Part 16 |
| 110 | `lib/csrf.ts`                          | CSRF protection utilities          | Part 16 |
| 111 | `lib/rate-limit.ts`                    | Rate limiting middleware           | Part 16 |
| 112 | `lib/tokens.ts`                        | Token generation and validation    | Part 16 |

---

## Library - Tier Validation

**Total:** 6 files

| #   | File Path                | Description                  | Source  |
| --- | ------------------------ | ---------------------------- | ------- |
| 113 | `lib/tier-config.ts`     | Tier configuration constants | Part 16 |
| 114 | `lib/tier-validation.ts` | Tier validation logic        | Part 16 |
| 115 | `lib/tier-helpers.ts`    | Tier helper functions        | Part 16 |
| 116 | `lib/tier/constants.ts`  | Tier constants               | Part 16 |
| 117 | `lib/tier/validator.ts`  | Tier validator utilities     | Part 16 |
| 118 | `lib/tier/index.ts`      | Tier module exports          | Part 16 |

---

## Library - Payment Processing

**Total:** 9 files

| #   | File Path                                   | Description                   | Source   |
| --- | ------------------------------------------- | ----------------------------- | -------- |
| 119 | `lib/stripe/stripe.ts`                      | Stripe client configuration   | Part 12  |
| 120 | `lib/stripe/webhook-handlers.ts`            | Stripe webhook event handlers | Part 12  |
| 121 | `lib/dlocal/dlocal-payment.service.ts`      | dLocal payment processing     | Part 18A |
| 122 | `lib/dlocal/payment-methods.service.ts`     | dLocal payment methods        | Part 18A |
| 123 | `lib/dlocal/currency-converter.service.ts`  | Currency conversion utilities | Part 18A |
| 124 | `lib/dlocal/three-day-validator.service.ts` | 3-day trial eligibility       | Part 18B |
| 125 | `lib/dlocal/constants.ts`                   | dLocal constants              | Part 18A |
| 126 | `lib/fraud/fraud-detection.service.ts`      | Fraud detection service       | Part 16  |
| 127 | `lib/geo/detect-country.ts`                 | Country detection from IP     | Part 16  |

---

## Library - Affiliate System

**Total:** 7 files

| #   | File Path                                | Description                    | Source     |
| --- | ---------------------------------------- | ------------------------------ | ---------- |
| 128 | `lib/affiliate/registration.ts`          | Affiliate registration logic   | Part 17A-1 |
| 129 | `lib/affiliate/code-generator.ts`        | Affiliate code generation      | Part 17A-1 |
| 130 | `lib/affiliate/commission-calculator.ts` | Commission calculation         | Part 17A-1 |
| 131 | `lib/affiliate/validators.ts`            | Affiliate validation utilities | Part 17A-1 |
| 132 | `lib/affiliate/report-builder.ts`        | Affiliate report generation    | Part 17A-1 |
| 133 | `lib/affiliate/types.ts`                 | Affiliate type definitions     | Part 17A-1 |
| 134 | `lib/affiliate/constants.ts`             | Affiliate constants            | Part 17A-1 |

---

## Library - Disbursement System

**Total:** 17 files

| #   | File Path                                             | Description                       | Source   |
| --- | ----------------------------------------------------- | --------------------------------- | -------- |
| 135 | `lib/disbursement/constants.ts`                       | Disbursement constants            | Part 19A |
| 136 | `lib/disbursement/services/batch-manager.ts`          | Payment batch management          | Part 19B |
| 137 | `lib/disbursement/services/commission-aggregator.ts`  | Aggregate commissions for payout  | Part 19A |
| 138 | `lib/disbursement/services/payout-calculator.ts`      | Calculate payout amounts          | Part 19A |
| 139 | `lib/disbursement/services/transaction-service.ts`    | Transaction CRUD operations       | Part 19B |
| 140 | `lib/disbursement/services/transaction-logger.ts`     | Transaction logging               | Part 19B |
| 141 | `lib/disbursement/services/payment-orchestrator.ts`   | Payment orchestration logic       | Part 19B |
| 142 | `lib/disbursement/services/retry-handler.ts`          | Payment retry logic               | Part 19B |
| 143 | `lib/disbursement/providers/base-provider.ts`         | Base payment provider interface   | Part 19A |
| 144 | `lib/disbursement/providers/provider-factory.ts`      | Payment provider factory          | Part 19A |
| 145 | `lib/disbursement/providers/mock-provider.ts`         | Mock provider for testing         | Part 19A |
| 146 | `lib/disbursement/providers/rise/rise-provider.ts`    | RiseWorks provider implementation | Part 19A |
| 147 | `lib/disbursement/providers/rise/siwe-auth.ts`        | Sign-In with Ethereum (SIWE)      | Part 19A |
| 148 | `lib/disbursement/providers/rise/webhook-verifier.ts` | RiseWorks webhook verification    | Part 19A |
| 149 | `lib/disbursement/providers/rise/amount-converter.ts` | USD to USDC conversion            | Part 19A |
| 150 | `lib/disbursement/webhook/event-processor.ts`         | Webhook event processing          | Part 19C |
| 151 | `lib/disbursement/cron/disbursement-processor.ts`     | Cron job for disbursements        | Part 19C |

---

## Library - Caching Layer

**Total:** 2 files

| #   | File Path                    | Description                | Source  |
| --- | ---------------------------- | -------------------------- | ------- |
| 152 | `lib/redis/client.ts`        | Redis client configuration | Part 16 |
| 153 | `lib/cache/cache-manager.ts` | Cache management utilities | Part 16 |

---

## Library - Email Services

**Total:** 12 files

| #   | File Path                                             | Description                       | Source     |
| --- | ----------------------------------------------------- | --------------------------------- | ---------- |
| 154 | `lib/email/email.ts`                                  | Email sending utilities (Resend)  | Part 16    |
| 155 | `lib/email/subscription-emails.ts`                    | Subscription-related emails       | Part 16    |
| 156 | `lib/email/templates/affiliate/welcome.tsx`           | Affiliate welcome email template  | Part 17A-1 |
| 157 | `lib/email/templates/affiliate/code-distributed.tsx`  | Code distributed email template   | Part 17A-1 |
| 158 | `lib/email/templates/affiliate/code-used.tsx`         | Code used notification template   | Part 17A-1 |
| 159 | `lib/email/templates/affiliate/payment-processed.tsx` | Payment processed email template  | Part 17B-2 |
| 160 | `lib/email/templates/affiliate/monthly-report.tsx`    | Monthly report email template     | Part 17B-2 |
| 161 | `emails/payment-confirmation.tsx`                     | Payment confirmation email        | Part 18C   |
| 162 | `emails/payment-failure.tsx`                          | Payment failure notification      | Part 18C   |
| 163 | `emails/renewal-reminder.tsx`                         | Subscription renewal reminder     | Part 18C   |
| 164 | `emails/subscription-expired.tsx`                     | Subscription expired notification | Part 18C   |
| 165 | `emails/index.ts`                                     | Email templates index             | Part 18C   |

---

## Library - Background Jobs

**Total:** 5 files

| #   | File Path                                     | Description                  | Source     |
| --- | --------------------------------------------- | ---------------------------- | ---------- |
| 166 | `lib/jobs/queue.ts`                           | Job queue management         | Part 16    |
| 167 | `lib/jobs/alert-checker.ts`                   | Price alert checking job     | Part 16    |
| 168 | `lib/cron/check-expiring-subscriptions.ts`    | Check expiring subscriptions | Part 16    |
| 169 | `lib/cron/downgrade-expired-subscriptions.ts` | Downgrade expired users      | Part 16    |
| 170 | `lib/cron/monthly-distribution.ts`            | Monthly code distribution    | Part 17B-2 |

---

## Library - Utilities & Helpers

**Total:** 15 files

| #   | File Path                            | Description                 | Source  |
| --- | ------------------------------------ | --------------------------- | ------- |
| 171 | `lib/utils.ts`                       | General utility functions   | Part 16 |
| 172 | `lib/utils/helpers.ts`               | Helper functions            | Part 16 |
| 173 | `lib/utils/formatters.ts`            | Data formatting utilities   | Part 16 |
| 174 | `lib/utils/constants.ts`             | General constants           | Part 16 |
| 175 | `lib/logger.ts`                      | Logging utilities           | Part 16 |
| 176 | `lib/errors/api-error.ts`            | API error classes           | Part 16 |
| 177 | `lib/errors/error-handler.ts`        | Error handling middleware   | Part 16 |
| 178 | `lib/errors/error-logger.ts`         | Error logging utilities     | Part 16 |
| 179 | `lib/monitoring/system-monitor.ts`   | System health monitoring    | Part 15 |
| 180 | `lib/constants/business-rules.ts`    | Business rule constants     | Part 16 |
| 181 | `lib/preferences/defaults.ts`        | User preference defaults    | Part 16 |
| 182 | `lib/candle-data-helpers.ts`         | Candle data formatting      | Part 16 |
| 183 | `lib/websocket/server.ts`            | WebSocket server            | Part 15 |
| 184 | `lib/websocket/use-mt5-websocket.ts` | MT5 WebSocket hook          | Part 16 |
| 185 | `lib/hooks/useAffiliateConfig.ts`    | Affiliate config hook       | Part 16 |

---

## Library - Admin Utilities

**Total:** 1 file

| #   | File Path                           | Description                    | Source     |
| --- | ----------------------------------- | ------------------------------ | ---------- |
| 186 | `lib/admin/affiliate-management.ts` | Affiliate management utilities | Part 17B-1 |

---

## Type Definitions

**Total:** 12 files

| #   | File Path                 | Description                | Source   |
| --- | ------------------------- | -------------------------- | -------- |
| 187 | `types/index.ts`          | Type exports index         | Part 16  |
| 188 | `types/tier.ts`           | Tier type definitions      | Part 16  |
| 189 | `types/user.ts`           | User type definitions      | Part 16  |
| 190 | `types/alert.ts`          | Alert type definitions     | Part 16  |
| 191 | `types/indicator.ts`      | Indicator type definitions | Part 16  |
| 192 | `types/api.ts`            | API response types         | Part 16  |
| 193 | `types/payment.ts`        | Payment type definitions   | Part 16  |
| 194 | `types/watchlist.ts`      | Watchlist type definitions | Part 16  |
| 195 | `types/disbursement.ts`   | Disbursement types         | Part 19A |
| 196 | `types/dlocal.ts`         | dLocal payment types       | Part 18A |
| 197 | `types/next-auth.d.ts`    | NextAuth type extensions   | Part 16  |
| 198 | `types/prisma-stubs.d.ts` | Prisma type stubs          | Part 16  |

---

## Validation Schemas

**Total:** 4 files

| #   | File Path                      | Description                | Source  |
| --- | ------------------------------ | -------------------------- | ------- |
| 199 | `lib/validations/auth.ts`      | Authentication Zod schemas | Part 16 |
| 200 | `lib/validations/user.ts`      | User profile validation    | Part 16 |
| 201 | `lib/validations/alert.ts`     | Alert validation schemas   | Part 16 |
| 202 | `lib/validations/watchlist.ts` | Watchlist validation rules | Part 16 |

---

## Middleware

**Total:** 1 file

| #   | File Path                  | Description                    | Source  |
| --- | -------------------------- | ------------------------------ | ------- |
| 203 | `middleware/tier-check.ts` | Tier access control middleware | Part 16 |

---

## Summary by Category

| Category                                | File Count | Percentage |
| --------------------------------------- | ---------- | ---------- |
| **API Routes**                          | 98         | 48%        |
| **Library - Services & Business Logic** | 105        | 52%        |
| **Total Backend Files**                 | 203        | 100%       |

---

## Summary by Part

| Part     | Description                        | Backend Files |
| -------- | ---------------------------------- | ------------- |
| Part 4   | Tier System                        | 3             |
| Part 5   | Authentication                     | 6             |
| Part 10  | Watchlist                          | 3             |
| Part 11  | Alerts                             | 2             |
| Part 12  | Payments & Stripe                  | 6             |
| Part 13  | User Settings                      | 10            |
| Part 14  | Admin Dashboard                    | 5             |
| Part 15  | Notifications & WebSocket          | 5             |
| Part 16  | Utilities & Infrastructure         | 72            |
| Part 17A | Affiliate Registration & Portal    | 16            |
| Part 17B | Admin Affiliate Management         | 14            |
| Part 18A | dLocal Payment Creation            | 7             |
| Part 18B | dLocal Subscription Lifecycle      | 3             |
| Part 18C | dLocal UI & Fraud Detection        | 9             |
| Part 19A | RiseWorks Foundation               | 12            |
| Part 19B | RiseWorks Execution                | 14            |
| Part 19C | RiseWorks Automation               | 12            |
| Part 19D | RiseWorks Admin UI                 | 0             |
| **Total** |                                   | **203**       |

---

## Part 6 Exclusion Note

**Part 6 (Flask MT5 Service)** files are **NOT included** in this list because:

1. Part 6 has been **superseded by Part 20** (SQLite + Sync to PostgreSQL)
2. Part 6 code has been **archived** to `archive/part6-flask-mt5/`
3. Part 6 files will be **removed** during Part 20 Phase 09 (Migration & Cutover)

**Excluded Part 6 files:**

- `lib/api/mt5-client.ts` (replaced by Part 20)
- `lib/api/mt5-transform.ts` (no longer needed)
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
│ (Prisma ORM)     │  │ (Upstash)                  │
└──────────────────┘  └────────────────────────────┘
```

---

_Last Updated: 2026-01-25_
_Generated from: docs/files-completion-list/files-inventory/_
_Architecture: Modular Monolith_
