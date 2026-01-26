# Complete Non-TSX Files Inventory - Monolith Architecture

**Generated:** 2026-01-26
**Total Files:** 302 non-TSX files
**Architecture:** Next.js 14 App Router (Monolith)
**Scope:** `app/`, `components/`, `hooks/`, `lib/`, `prisma/`, `types/`, `oauth/`, `middleware/`, `emails/`, `__tests__/`

---

## Summary

| Directory | .ts | .tsx (tests) | .css | .sql | .prisma | .d.ts | .md | Total |
|-----------|-----|--------------|------|------|---------|-------|-----|-------|
| `app/` | 100 | - | 1 | - | - | - | - | 101 |
| `components/` | 2 | - | - | - | - | - | - | 2 |
| `hooks/` | 8 | - | - | - | - | - | - | 8 |
| `lib/` | 87 | - | - | - | - | - | - | 87 |
| `prisma/` | 1 | - | - | 1 | 1 | - | - | 3 |
| `types/` | 10 | - | - | - | - | 2 | - | 12 |
| `oauth/` | - | - | - | - | - | - | 3 | 3 |
| `middleware/` | 1 | - | - | - | - | - | - | 1 |
| `emails/` | 1 | - | - | - | - | - | - | 1 |
| `__tests__/` | 84 | - | - | - | - | - | - | 84 |
| **Total** | **294** | **-** | **1** | **1** | **1** | **2** | **3** | **302** |

> Note: 22 `.tsx` test files in `__tests__/` are excluded (component tests use JSX)

---

## 1. App Directory (101 files)

### API Routes - Admin (`app/api/admin/`) - 18 files

#### Affiliates Management (9 files)
| # | File Path |
|---|-----------|
| 1 | `app/api/admin/affiliates/[id]/distribute-codes/route.ts` |
| 2 | `app/api/admin/affiliates/[id]/reactivate/route.ts` |
| 3 | `app/api/admin/affiliates/[id]/route.ts` |
| 4 | `app/api/admin/affiliates/[id]/suspend/route.ts` |
| 5 | `app/api/admin/affiliates/reports/code-inventory/route.ts` |
| 6 | `app/api/admin/affiliates/reports/commission-owings/route.ts` |
| 7 | `app/api/admin/affiliates/reports/profit-loss/route.ts` |
| 8 | `app/api/admin/affiliates/reports/sales-performance/route.ts` |
| 9 | `app/api/admin/affiliates/route.ts` |

#### Other Admin Routes (9 files)
| # | File Path |
|---|-----------|
| 10 | `app/api/admin/analytics/route.ts` |
| 11 | `app/api/admin/api-usage/route.ts` |
| 12 | `app/api/admin/codes/[code]/cancel/route.ts` |
| 13 | `app/api/admin/commissions/pay/route.ts` |
| 14 | `app/api/admin/error-logs/route.ts` |
| 15 | `app/api/admin/fraud-alerts/[id]/route.ts` |
| 16 | `app/api/admin/fraud-alerts/route.ts` |
| 17 | `app/api/admin/settings/affiliate/route.ts` |
| 18 | `app/api/admin/users/route.ts` |

### API Routes - Affiliate (`app/api/affiliate/`) - 8 files
| # | File Path |
|---|-----------|
| 19 | `app/api/affiliate/auth/register/route.ts` |
| 20 | `app/api/affiliate/auth/verify-email/route.ts` |
| 21 | `app/api/affiliate/dashboard/code-inventory/route.ts` |
| 22 | `app/api/affiliate/dashboard/codes/route.ts` |
| 23 | `app/api/affiliate/dashboard/commission-report/route.ts` |
| 24 | `app/api/affiliate/dashboard/stats/route.ts` |
| 25 | `app/api/affiliate/profile/payment/route.ts` |
| 26 | `app/api/affiliate/profile/route.ts` |

### API Routes - Alerts (`app/api/alerts/`) - 2 files
| # | File Path |
|---|-----------|
| 27 | `app/api/alerts/[id]/route.ts` |
| 28 | `app/api/alerts/route.ts` |

### API Routes - Auth (`app/api/auth/`) - 7 files
| # | File Path |
|---|-----------|
| 29 | `app/api/auth/[...nextauth]/route.ts` |
| 30 | `app/api/auth/forgot-password/route.ts` |
| 31 | `app/api/auth/register/route.ts` |
| 32 | `app/api/auth/resend-verification/route.ts` |
| 33 | `app/api/auth/reset-password/route.ts` |
| 34 | `app/api/auth/track-login/route.ts` |
| 35 | `app/api/auth/verify-email/route.ts` |

### API Routes - Other Core (6 files)
| # | File Path |
|---|-----------|
| 36 | `app/api/candles/[symbol]/route.ts` |
| 37 | `app/api/checkout/route.ts` |
| 38 | `app/api/checkout/validate-code/route.ts` |
| 39 | `app/api/config/affiliate/route.ts` |
| 40 | `app/api/invoices/route.ts` |
| 41 | `app/api/test/seed/route.ts` |

### API Routes - Cron Jobs (`app/api/cron/`) - 8 files
| # | File Path |
|---|-----------|
| 42 | `app/api/cron/check-expiring-subscriptions/route.ts` |
| 43 | `app/api/cron/daily-maintenance/route.ts` |
| 44 | `app/api/cron/distribute-codes/route.ts` |
| 45 | `app/api/cron/downgrade-expired-subscriptions/route.ts` |
| 46 | `app/api/cron/expire-codes/route.ts` |
| 47 | `app/api/cron/process-pending-disbursements/route.ts` |
| 48 | `app/api/cron/send-monthly-reports/route.ts` |
| 49 | `app/api/cron/sync-riseworks-accounts/route.ts` |

### API Routes - Disbursement (`app/api/disbursement/`) - 16 files
| # | File Path |
|---|-----------|
| 50 | `app/api/disbursement/affiliates/[affiliateId]/commissions/route.ts` |
| 51 | `app/api/disbursement/affiliates/[affiliateId]/route.ts` |
| 52 | `app/api/disbursement/affiliates/payable/route.ts` |
| 53 | `app/api/disbursement/audit-logs/route.ts` |
| 54 | `app/api/disbursement/batches/[batchId]/execute/route.ts` |
| 55 | `app/api/disbursement/batches/[batchId]/route.ts` |
| 56 | `app/api/disbursement/batches/preview/route.ts` |
| 57 | `app/api/disbursement/batches/route.ts` |
| 58 | `app/api/disbursement/config/route.ts` |
| 59 | `app/api/disbursement/health/route.ts` |
| 60 | `app/api/disbursement/pay/route.ts` |
| 61 | `app/api/disbursement/reports/affiliate/[affiliateId]/route.ts` |
| 62 | `app/api/disbursement/reports/summary/route.ts` |
| 63 | `app/api/disbursement/riseworks/accounts/route.ts` |
| 64 | `app/api/disbursement/riseworks/sync/route.ts` |
| 65 | `app/api/disbursement/transactions/route.ts` |

### API Routes - Notifications (`app/api/notifications/`) - 3 files
| # | File Path |
|---|-----------|
| 66 | `app/api/notifications/[id]/read/route.ts` |
| 67 | `app/api/notifications/[id]/route.ts` |
| 68 | `app/api/notifications/route.ts` |

### API Routes - Payments DLocal (`app/api/payments/dlocal/`) - 7 files
| # | File Path |
|---|-----------|
| 69 | `app/api/payments/dlocal/[paymentId]/route.ts` |
| 70 | `app/api/payments/dlocal/check-three-day-eligibility/route.ts` |
| 71 | `app/api/payments/dlocal/convert/route.ts` |
| 72 | `app/api/payments/dlocal/create/route.ts` |
| 73 | `app/api/payments/dlocal/exchange-rate/route.ts` |
| 74 | `app/api/payments/dlocal/methods/route.ts` |
| 75 | `app/api/payments/dlocal/validate-discount/route.ts` |

### API Routes - Subscription (`app/api/subscription/`) - 2 files
| # | File Path |
|---|-----------|
| 76 | `app/api/subscription/cancel/route.ts` |
| 77 | `app/api/subscription/route.ts` |

### API Routes - Tier (`app/api/tier/`) - 3 files
| # | File Path |
|---|-----------|
| 78 | `app/api/tier/check/[symbol]/route.ts` |
| 79 | `app/api/tier/combinations/route.ts` |
| 80 | `app/api/tier/symbols/route.ts` |

### API Routes - User (`app/api/user/`) - 14 files

#### 2FA (5 files)
| # | File Path |
|---|-----------|
| 81 | `app/api/user/2fa/backup-codes/route.ts` |
| 82 | `app/api/user/2fa/disable/route.ts` |
| 83 | `app/api/user/2fa/setup/route.ts` |
| 84 | `app/api/user/2fa/verify/route.ts` |
| 85 | `app/api/user/2fa/verify-setup/route.ts` |

#### Account Deletion (3 files)
| # | File Path |
|---|-----------|
| 86 | `app/api/user/account/deletion-cancel/route.ts` |
| 87 | `app/api/user/account/deletion-confirm/route.ts` |
| 88 | `app/api/user/account/deletion-request/route.ts` |

#### Other User Routes (6 files)
| # | File Path |
|---|-----------|
| 89 | `app/api/user/login-history/route.ts` |
| 90 | `app/api/user/password/route.ts` |
| 91 | `app/api/user/preferences/route.ts` |
| 92 | `app/api/user/profile/route.ts` |
| 93 | `app/api/user/sessions/[id]/route.ts` |
| 94 | `app/api/user/sessions/route.ts` |

### API Routes - Watchlist (`app/api/watchlist/`) - 3 files
| # | File Path |
|---|-----------|
| 95 | `app/api/watchlist/[id]/route.ts` |
| 96 | `app/api/watchlist/reorder/route.ts` |
| 97 | `app/api/watchlist/route.ts` |

### API Routes - Webhooks (`app/api/webhooks/`) - 3 files
| # | File Path |
|---|-----------|
| 98 | `app/api/webhooks/dlocal/route.ts` |
| 99 | `app/api/webhooks/riseworks/route.ts` |
| 100 | `app/api/webhooks/stripe/route.ts` |

### App Root Files - 1 file
| # | File Path | Type |
|---|-----------|------|
| 101 | `app/globals.css` | CSS |

---

## 2. Components Directory (2 files)

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `components/affiliate/index.ts` | Barrel export for affiliate components |
| 2 | `components/payments/index.ts` | Barrel export for payment components |

---

## 3. Hooks Directory (8 files)

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `hooks/use-alerts.ts` | Alert management hook |
| 2 | `hooks/use-auth.ts` | Authentication state hook |
| 3 | `hooks/use-indicators.ts` | Chart indicators hook |
| 4 | `hooks/use-login-tracking.ts` | Login tracking hook |
| 5 | `hooks/use-optimistic-mutation.ts` | Optimistic UI updates hook |
| 6 | `hooks/use-toast.ts` | Toast notifications hook |
| 7 | `hooks/use-watchlist.ts` | Watchlist management hook |
| 8 | `hooks/use-websocket.ts` | WebSocket connection hook |

---

## 4. Lib Directory (87 files)

### Admin (`lib/admin/`) - 3 files
| # | File Path |
|---|-----------|
| 1 | `lib/admin/affiliate-management.ts` |
| 2 | `lib/admin/code-distribution.ts` |
| 3 | `lib/admin/pnl-calculator.ts` |

### Affiliate (`lib/affiliate/`) - 7 files
| # | File Path |
|---|-----------|
| 4 | `lib/affiliate/code-generator.ts` |
| 5 | `lib/affiliate/commission-calculator.ts` |
| 6 | `lib/affiliate/constants.ts` |
| 7 | `lib/affiliate/registration.ts` |
| 8 | `lib/affiliate/report-builder.ts` |
| 9 | `lib/affiliate/types.ts` |
| 10 | `lib/affiliate/validators.ts` |

### API (`lib/api/`) - 3 files
| # | File Path |
|---|-----------|
| 11 | `lib/api/index.ts` |
| 12 | `lib/api/mt5-client.ts` |
| 13 | `lib/api/mt5-transform.ts` |

### Auth (`lib/auth/`) - 6 files
| # | File Path |
|---|-----------|
| 14 | `lib/auth/auth-options.ts` |
| 15 | `lib/auth/errors.ts` |
| 16 | `lib/auth/permissions.ts` |
| 17 | `lib/auth/session-tracker.ts` |
| 18 | `lib/auth/session.ts` |
| 19 | `lib/auth/two-factor.ts` |

### Cache (`lib/cache/`) - 1 file
| # | File Path |
|---|-----------|
| 20 | `lib/cache/cache-manager.ts` |

### Constants (`lib/constants/`) - 1 file
| # | File Path |
|---|-----------|
| 21 | `lib/constants/business-rules.ts` |

### Cron (`lib/cron/`) - 3 files
| # | File Path |
|---|-----------|
| 22 | `lib/cron/check-expiring-subscriptions.ts` |
| 23 | `lib/cron/downgrade-expired-subscriptions.ts` |
| 24 | `lib/cron/monthly-distribution.ts` |

### Database (`lib/db/`) - 2 files
| # | File Path |
|---|-----------|
| 25 | `lib/db/prisma.ts` |
| 26 | `lib/db/seed.ts` |

### Disbursement (`lib/disbursement/`) - 17 files

#### Constants (1 file)
| # | File Path |
|---|-----------|
| 27 | `lib/disbursement/constants.ts` |

#### Cron (1 file)
| # | File Path |
|---|-----------|
| 28 | `lib/disbursement/cron/disbursement-processor.ts` |

#### Providers (7 files)
| # | File Path |
|---|-----------|
| 29 | `lib/disbursement/providers/base-provider.ts` |
| 30 | `lib/disbursement/providers/mock-provider.ts` |
| 31 | `lib/disbursement/providers/provider-factory.ts` |
| 32 | `lib/disbursement/providers/rise/amount-converter.ts` |
| 33 | `lib/disbursement/providers/rise/rise-provider.ts` |
| 34 | `lib/disbursement/providers/rise/siwe-auth.ts` |
| 35 | `lib/disbursement/providers/rise/webhook-verifier.ts` |

#### Services (7 files)
| # | File Path |
|---|-----------|
| 36 | `lib/disbursement/services/batch-manager.ts` |
| 37 | `lib/disbursement/services/commission-aggregator.ts` |
| 38 | `lib/disbursement/services/payment-orchestrator.ts` |
| 39 | `lib/disbursement/services/payout-calculator.ts` |
| 40 | `lib/disbursement/services/retry-handler.ts` |
| 41 | `lib/disbursement/services/transaction-logger.ts` |
| 42 | `lib/disbursement/services/transaction-service.ts` |

#### Webhook (1 file)
| # | File Path |
|---|-----------|
| 43 | `lib/disbursement/webhook/event-processor.ts` |

### DLocal (`lib/dlocal/`) - 5 files
| # | File Path |
|---|-----------|
| 44 | `lib/dlocal/constants.ts` |
| 45 | `lib/dlocal/currency-converter.service.ts` |
| 46 | `lib/dlocal/dlocal-payment.service.ts` |
| 47 | `lib/dlocal/payment-methods.service.ts` |
| 48 | `lib/dlocal/three-day-validator.service.ts` |

### Email (`lib/email/`) - 2 files
| # | File Path |
|---|-----------|
| 49 | `lib/email/email.ts` |
| 50 | `lib/email/subscription-emails.ts` |

### Errors (`lib/errors/`) - 3 files
| # | File Path |
|---|-----------|
| 51 | `lib/errors/api-error.ts` |
| 52 | `lib/errors/error-handler.ts` |
| 53 | `lib/errors/error-logger.ts` |

### Fraud (`lib/fraud/`) - 1 file
| # | File Path |
|---|-----------|
| 54 | `lib/fraud/fraud-detection.service.ts` |

### Geo (`lib/geo/`) - 1 file
| # | File Path |
|---|-----------|
| 55 | `lib/geo/detect-country.ts` |

### Hooks (`lib/hooks/`) - 1 file
| # | File Path |
|---|-----------|
| 56 | `lib/hooks/useAffiliateConfig.ts` |

### Jobs (`lib/jobs/`) - 2 files
| # | File Path |
|---|-----------|
| 57 | `lib/jobs/alert-checker.ts` |
| 58 | `lib/jobs/queue.ts` |

### Monitoring (`lib/monitoring/`) - 1 file
| # | File Path |
|---|-----------|
| 59 | `lib/monitoring/system-monitor.ts` |

### Preferences (`lib/preferences/`) - 1 file
| # | File Path |
|---|-----------|
| 60 | `lib/preferences/defaults.ts` |

### Redis (`lib/redis/`) - 1 file
| # | File Path |
|---|-----------|
| 61 | `lib/redis/client.ts` |

### Security (`lib/security/`) - 1 file
| # | File Path |
|---|-----------|
| 62 | `lib/security/device-detection.ts` |

### Stripe (`lib/stripe/`) - 2 files
| # | File Path |
|---|-----------|
| 63 | `lib/stripe/stripe.ts` |
| 64 | `lib/stripe/webhook-handlers.ts` |

### Tier (`lib/tier/`) - 5 files
| # | File Path |
|---|-----------|
| 65 | `lib/tier/__tests__/constants.test.ts` |
| 66 | `lib/tier/__tests__/validator.test.ts` |
| 67 | `lib/tier/constants.ts` |
| 68 | `lib/tier/index.ts` |
| 69 | `lib/tier/validator.ts` |

### Utils (`lib/utils/`) - 3 files
| # | File Path |
|---|-----------|
| 70 | `lib/utils/constants.ts` |
| 71 | `lib/utils/formatters.ts` |
| 72 | `lib/utils/helpers.ts` |

### Validations (`lib/validations/`) - 4 files
| # | File Path |
|---|-----------|
| 73 | `lib/validations/alert.ts` |
| 74 | `lib/validations/auth.ts` |
| 75 | `lib/validations/user.ts` |
| 76 | `lib/validations/watchlist.ts` |

### WebSocket (`lib/websocket/`) - 2 files
| # | File Path |
|---|-----------|
| 77 | `lib/websocket/server.ts` |
| 78 | `lib/websocket/use-mt5-websocket.ts` |

### Root Lib Files - 9 files
| # | File Path |
|---|-----------|
| 79 | `lib/candle-data-helpers.ts` |
| 80 | `lib/csrf.ts` |
| 81 | `lib/logger.ts` |
| 82 | `lib/rate-limit.ts` |
| 83 | `lib/tier-config.ts` |
| 84 | `lib/tier-helpers.ts` |
| 85 | `lib/tier-validation.ts` |
| 86 | `lib/tokens.ts` |
| 87 | `lib/utils.ts` |

---

## 5. Prisma Directory (3 files)

| # | File Path | Type | Description |
|---|-----------|------|-------------|
| 1 | `prisma/migrations/20251227000000_init/migration.sql` | SQL | Initial database migration |
| 2 | `prisma/schema.prisma` | Prisma | Database schema definition |
| 3 | `prisma/seed.ts` | TypeScript | Database seeding script |

---

## 6. Types Directory (12 files)

| # | File Path | Type | Description |
|---|-----------|------|-------------|
| 1 | `types/alert.ts` | TS | Alert type definitions |
| 2 | `types/api.ts` | TS | API type definitions |
| 3 | `types/disbursement.ts` | TS | Disbursement type definitions |
| 4 | `types/dlocal.ts` | TS | DLocal payment types |
| 5 | `types/index.ts` | TS | Main type exports |
| 6 | `types/indicator.ts` | TS | Chart indicator types |
| 7 | `types/next-auth.d.ts` | d.ts | NextAuth type augmentation |
| 8 | `types/payment.ts` | TS | Payment type definitions |
| 9 | `types/prisma-stubs.d.ts` | d.ts | Prisma type stubs |
| 10 | `types/tier.ts` | TS | Tier type definitions |
| 11 | `types/user.ts` | TS | User type definitions |
| 12 | `types/watchlist.ts` | TS | Watchlist type definitions |

---

## 7. OAuth Directory (3 files)

| # | File Path | Type | Description |
|---|-----------|------|-------------|
| 1 | `oauth/claude-code-oauth-integration-task.md` | MD | Claude Code OAuth task |
| 2 | `oauth/google-oauth-implementation-guide.md` | MD | Google OAuth guide |
| 3 | `oauth/oauth-decision-request.md` | MD | OAuth decision document |

---

## 8. Middleware Directory (1 file)

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `middleware/tier-check.ts` | Tier validation middleware |

---

## 9. Emails Directory (1 file)

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `emails/index.ts` | Email templates barrel export |

> Note: 4 `.tsx` email template files excluded (payment-confirmation, payment-failure, renewal-reminder, subscription-expired)

---

## 10. Tests Directory (84 files)

### API Tests (`__tests__/api/`) - 22 files

#### Admin & Affiliate (6 files)
| # | File Path |
|---|-----------|
| 1 | `__tests__/api/admin-affiliates.test.ts` |
| 2 | `__tests__/api/admin-reports.test.ts` |
| 3 | `__tests__/api/admin.test.ts` |
| 4 | `__tests__/api/affiliate-conversion.test.ts` |
| 5 | `__tests__/api/affiliate-dashboard.test.ts` |
| 6 | `__tests__/api/affiliate-registration.test.ts` |

#### Core API (6 files)
| # | File Path |
|---|-----------|
| 7 | `__tests__/api/alerts.test.ts` |
| 8 | `__tests__/api/notifications.test.ts` |
| 9 | `__tests__/api/tier.test.ts` |
| 10 | `__tests__/api/user.test.ts` |
| 11 | `__tests__/api/watchlist.test.ts` |
| 12 | `__tests__/api/cron-jobs.test.ts` |

#### Cron (1 file)
| # | File Path |
|---|-----------|
| 13 | `__tests__/api/cron/process-pending.test.ts` |

#### Disbursement (7 files)
| # | File Path |
|---|-----------|
| 14 | `__tests__/api/disbursement/affiliates.test.ts` |
| 15 | `__tests__/api/disbursement/audit.test.ts` |
| 16 | `__tests__/api/disbursement/batches.test.ts` |
| 17 | `__tests__/api/disbursement/execute.test.ts` |
| 18 | `__tests__/api/disbursement/health.test.ts` |
| 19 | `__tests__/api/disbursement/pay.test.ts` |
| 20 | `__tests__/api/disbursement/reports.test.ts` |

#### Webhooks (2 files)
| # | File Path |
|---|-----------|
| 21 | `__tests__/api/webhooks/dlocal/route.test.ts` |
| 22 | `__tests__/api/webhooks/riseworks.test.ts` |

### E2E Tests (`__tests__/e2e/`) - 1 file
| # | File Path |
|---|-----------|
| 23 | `__tests__/e2e/dlocal-payment-flow.test.ts` |

### Helper Files (`__tests__/helpers/`) - 1 file
| # | File Path |
|---|-----------|
| 24 | `__tests__/helpers/supertest-setup.ts` |

### Hook Tests (`__tests__/hooks/`) - 2 files
| # | File Path |
|---|-----------|
| 25 | `__tests__/hooks/use-toast.test.ts` |
| 26 | `__tests__/hooks/use-websocket.test.ts` |

### Integration Tests (`__tests__/integration/`) - 7 files
| # | File Path |
|---|-----------|
| 27 | `__tests__/integration/api-client-workflow.test.ts` |
| 28 | `__tests__/integration/auth-email-flow.test.ts` |
| 29 | `__tests__/integration/payment-creation.test.ts` |
| 30 | `__tests__/integration/tier1-workflows.test.ts` |
| 31 | `__tests__/integration/tier2-workflows.test.ts` |
| 32 | `__tests__/integration/user-registration-flow.test.ts` |
| 33 | `__tests__/integration/watchlist-management-flow.test.ts` |

### Library Tests (`__tests__/lib/`) - 47 files

#### Admin (3 files)
| # | File Path |
|---|-----------|
| 34 | `__tests__/lib/admin/affiliate-management.test.ts` |
| 35 | `__tests__/lib/admin/code-distribution.test.ts` |
| 36 | `__tests__/lib/admin/pnl-calculator.test.ts` |

#### Affiliate (3 files)
| # | File Path |
|---|-----------|
| 37 | `__tests__/lib/affiliate/code-generator.test.ts` |
| 38 | `__tests__/lib/affiliate/commission-calculator.test.ts` |
| 39 | `__tests__/lib/affiliate/registration.test.ts` |

#### API (2 files)
| # | File Path |
|---|-----------|
| 40 | `__tests__/lib/api/stack-a-client.test.ts` |
| 41 | `__tests__/lib/api/stack-b-client.test.ts` |

#### Auth (3 files)
| # | File Path |
|---|-----------|
| 42 | `__tests__/lib/auth/errors.test.ts` |
| 43 | `__tests__/lib/auth/permissions.test.ts` |
| 44 | `__tests__/lib/auth/session.test.ts` |

#### Cron (3 files)
| # | File Path |
|---|-----------|
| 45 | `__tests__/lib/cron/check-expiring-subscriptions.test.ts` |
| 46 | `__tests__/lib/cron/downgrade-expired-subscriptions.test.ts` |
| 47 | `__tests__/lib/cron/monthly-distribution.test.ts` |

#### Database (2 files)
| # | File Path |
|---|-----------|
| 48 | `__tests__/lib/db/prisma.test.ts` |
| 49 | `__tests__/lib/db/seed.test.ts` |

#### Disbursement (7 files)
| # | File Path |
|---|-----------|
| 50 | `__tests__/lib/disbursement/constants.test.ts` |
| 51 | `__tests__/lib/disbursement/providers/factory.test.ts` |
| 52 | `__tests__/lib/disbursement/providers/mock.test.ts` |
| 53 | `__tests__/lib/disbursement/providers/rise/webhook.test.ts` |
| 54 | `__tests__/lib/disbursement/services/aggregator.test.ts` |
| 55 | `__tests__/lib/disbursement/services/batch.test.ts` |
| 56 | `__tests__/lib/disbursement/services/orchestrator.test.ts` |

#### DLocal (5 files)
| # | File Path |
|---|-----------|
| 57 | `__tests__/lib/dlocal/constants.test.ts` |
| 58 | `__tests__/lib/dlocal/currency-converter.test.ts` |
| 59 | `__tests__/lib/dlocal/dlocal-payment.test.ts` |
| 60 | `__tests__/lib/dlocal/payment-methods.test.ts` |
| 61 | `__tests__/lib/dlocal/three-day-validator.test.ts` |

#### Email (1 file)
| # | File Path |
|---|-----------|
| 62 | `__tests__/lib/email/email.test.ts` |

#### Errors (2 files)
| # | File Path |
|---|-----------|
| 63 | `__tests__/lib/errors/api-error.test.ts` |
| 64 | `__tests__/lib/errors/error-handler.test.ts` |

#### Geo (1 file)
| # | File Path |
|---|-----------|
| 65 | `__tests__/lib/geo/detect-country.test.ts` |

#### Jobs (1 file)
| # | File Path |
|---|-----------|
| 66 | `__tests__/lib/jobs/alert-checker.test.ts` |

#### Rate Limit (1 file)
| # | File Path |
|---|-----------|
| 67 | `__tests__/lib/rate-limit.test.ts` |

#### Stripe (2 files)
| # | File Path |
|---|-----------|
| 68 | `__tests__/lib/stripe/stripe.test.ts` |
| 69 | `__tests__/lib/stripe/webhook-handlers.test.ts` |

#### Tier (3 files)
| # | File Path |
|---|-----------|
| 70 | `__tests__/lib/tier-config.test.ts` |
| 71 | `__tests__/lib/tier-helpers.test.ts` |
| 72 | `__tests__/lib/tier-validation.test.ts` |

#### Tokens (1 file)
| # | File Path |
|---|-----------|
| 73 | `__tests__/lib/tokens.test.ts` |

#### Utils (4 files)
| # | File Path |
|---|-----------|
| 74 | `__tests__/lib/utils/constants.test.ts` |
| 75 | `__tests__/lib/utils/formatters.test.ts` |
| 76 | `__tests__/lib/utils/helpers.test.ts` |
| 77 | `__tests__/lib/utils.test.ts` |

#### Validations (2 files)
| # | File Path |
|---|-----------|
| 78 | `__tests__/lib/validations/alert.test.ts` |
| 79 | `__tests__/lib/validations/auth.test.ts` |

### Type Tests (`__tests__/types/`) - 3 files
| # | File Path |
|---|-----------|
| 80 | `__tests__/types/disbursement.test.ts` |
| 81 | `__tests__/types/dlocal.test.ts` |
| 82 | `__tests__/types/types.test.ts` |

### Root Test Files - 2 files
| # | File Path |
|---|-----------|
| 83 | `__tests__/example.test.ts` |
| 84 | `__tests__/setup.ts` |

---

## Directory Structure Overview

```
├── app/                          # 101 non-TSX files
│   ├── api/                      # 100 .ts API route files
│   │   ├── admin/                # 18 files
│   │   ├── affiliate/            # 8 files
│   │   ├── alerts/               # 2 files
│   │   ├── auth/                 # 7 files
│   │   ├── cron/                 # 8 files
│   │   ├── disbursement/         # 16 files
│   │   ├── notifications/        # 3 files
│   │   ├── payments/dlocal/      # 7 files
│   │   ├── subscription/         # 2 files
│   │   ├── tier/                 # 3 files
│   │   ├── user/                 # 14 files
│   │   ├── watchlist/            # 3 files
│   │   └── webhooks/             # 3 files
│   └── globals.css               # 1 CSS file
├── components/                   # 2 non-TSX files (index.ts)
├── hooks/                        # 8 .ts files
├── lib/                          # 87 .ts files
│   ├── admin/                    # 3 files
│   ├── affiliate/                # 7 files
│   ├── api/                      # 3 files
│   ├── auth/                     # 6 files
│   ├── cache/                    # 1 file
│   ├── constants/                # 1 file
│   ├── cron/                     # 3 files
│   ├── db/                       # 2 files
│   ├── disbursement/             # 17 files
│   ├── dlocal/                   # 5 files
│   ├── email/                    # 2 files
│   ├── errors/                   # 3 files
│   ├── fraud/                    # 1 file
│   ├── geo/                      # 1 file
│   ├── hooks/                    # 1 file
│   ├── jobs/                     # 2 files
│   ├── monitoring/               # 1 file
│   ├── preferences/              # 1 file
│   ├── redis/                    # 1 file
│   ├── security/                 # 1 file
│   ├── stripe/                   # 2 files
│   ├── tier/                     # 5 files
│   ├── utils/                    # 3 files
│   ├── validations/              # 4 files
│   ├── websocket/                # 2 files
│   └── [root files]              # 9 files
├── prisma/                       # 3 files (.prisma, .sql, .ts)
├── types/                        # 12 files (.ts, .d.ts)
├── oauth/                        # 3 .md files
├── middleware/                   # 1 .ts file
├── emails/                       # 1 .ts file
└── __tests__/                    # 84 .ts test files
    ├── api/                      # 22 files
    ├── e2e/                      # 1 file
    ├── helpers/                  # 1 file
    ├── hooks/                    # 2 files
    ├── integration/              # 7 files
    ├── lib/                      # 47 files
    ├── types/                    # 3 files
    └── [root files]              # 2 files
```

---

## Summary by File Type

| File Type | Count | Percentage |
|-----------|-------|------------|
| `.ts` (TypeScript) | 294 | 97.4% |
| `.md` (Markdown) | 3 | 1.0% |
| `.d.ts` (Type Declarations) | 2 | 0.7% |
| `.css` (Stylesheet) | 1 | 0.3% |
| `.sql` (SQL) | 1 | 0.3% |
| `.prisma` (Prisma Schema) | 1 | 0.3% |
| **Total** | **302** | **100%** |

---

## Summary by Directory

| Directory | Files | Percentage |
|-----------|-------|------------|
| `app/` | 101 | 33.4% |
| `lib/` | 87 | 28.8% |
| `__tests__/` | 84 | 27.8% |
| `types/` | 12 | 4.0% |
| `hooks/` | 8 | 2.6% |
| `prisma/` | 3 | 1.0% |
| `oauth/` | 3 | 1.0% |
| `components/` | 2 | 0.7% |
| `middleware/` | 1 | 0.3% |
| `emails/` | 1 | 0.3% |
| **Total** | **302** | **100%** |

---

## Comparison: TSX vs Non-TSX Files

| Directory | TSX Files | Non-TSX Files | Total |
|-----------|-----------|---------------|-------|
| `app/` | 74 | 101 | 175 |
| `components/` | 77 | 2 | 79 |
| `lib/` | 5 | 87 | 92 |
| `hooks/` | 0 | 8 | 8 |
| `prisma/` | 0 | 3 | 3 |
| `types/` | 0 | 12 | 12 |
| `oauth/` | 0 | 3 | 3 |
| `middleware/` | 0 | 1 | 1 |
| `emails/` | 4 | 1 | 5 |
| `__tests__/` | 22 | 84 | 106 |
| **Total** | **182** | **302** | **484** |

---

*This inventory was generated by examining the actual filesystem on 2026-01-26*
