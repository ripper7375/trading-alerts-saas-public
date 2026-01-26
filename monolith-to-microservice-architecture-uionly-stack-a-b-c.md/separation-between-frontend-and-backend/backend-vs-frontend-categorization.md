# Backend vs Frontend File Categorization

**Generated:** 2026-01-26
**Purpose:** Separate monolith files into Backend (Nest.js/Railway) and Frontend (Next.js/Vercel)
**Total Files:** 458 files (302 non-TSX + 156 TSX)

---

## Quick Reference

| Category | Deploy To | Framework | File Count |
|----------|-----------|-----------|------------|
| **Backend** | Railway | Nest.js | ~215 files |
| **Frontend** | Vercel | Next.js | ~159 files |
| **Shared** | Both (npm package) | TypeScript | ~12 files |
| **Tests** | CI/CD only | Jest | ~84 files |

---

## BACKEND FILES (Nest.js → Railway)

These files contain server-side logic that runs on the backend. They need to be **refactored from Next.js API routes to Nest.js controllers/services**.

### 1. API Routes → Nest.js Controllers (100 files)

All `app/api/**/*.ts` files become Nest.js controllers and services.

#### Admin Module (18 files → 1 Nest.js module)

| Original Path | Nest.js Equivalent |
|---------------|-------------------|
| `app/api/admin/affiliates/[id]/distribute-codes/route.ts` | `admin/affiliates.controller.ts` |
| `app/api/admin/affiliates/[id]/reactivate/route.ts` | `admin/affiliates.controller.ts` |
| `app/api/admin/affiliates/[id]/route.ts` | `admin/affiliates.controller.ts` |
| `app/api/admin/affiliates/[id]/suspend/route.ts` | `admin/affiliates.controller.ts` |
| `app/api/admin/affiliates/reports/code-inventory/route.ts` | `admin/reports.controller.ts` |
| `app/api/admin/affiliates/reports/commission-owings/route.ts` | `admin/reports.controller.ts` |
| `app/api/admin/affiliates/reports/profit-loss/route.ts` | `admin/reports.controller.ts` |
| `app/api/admin/affiliates/reports/sales-performance/route.ts` | `admin/reports.controller.ts` |
| `app/api/admin/affiliates/route.ts` | `admin/affiliates.controller.ts` |
| `app/api/admin/analytics/route.ts` | `admin/analytics.controller.ts` |
| `app/api/admin/api-usage/route.ts` | `admin/api-usage.controller.ts` |
| `app/api/admin/codes/[code]/cancel/route.ts` | `admin/codes.controller.ts` |
| `app/api/admin/commissions/pay/route.ts` | `admin/commissions.controller.ts` |
| `app/api/admin/error-logs/route.ts` | `admin/error-logs.controller.ts` |
| `app/api/admin/fraud-alerts/[id]/route.ts` | `admin/fraud-alerts.controller.ts` |
| `app/api/admin/fraud-alerts/route.ts` | `admin/fraud-alerts.controller.ts` |
| `app/api/admin/settings/affiliate/route.ts` | `admin/settings.controller.ts` |
| `app/api/admin/users/route.ts` | `admin/users.controller.ts` |

#### Affiliate Module (8 files → 1 Nest.js module)

| Original Path | Nest.js Equivalent |
|---------------|-------------------|
| `app/api/affiliate/auth/register/route.ts` | `affiliate/auth.controller.ts` |
| `app/api/affiliate/auth/verify-email/route.ts` | `affiliate/auth.controller.ts` |
| `app/api/affiliate/dashboard/code-inventory/route.ts` | `affiliate/dashboard.controller.ts` |
| `app/api/affiliate/dashboard/codes/route.ts` | `affiliate/dashboard.controller.ts` |
| `app/api/affiliate/dashboard/commission-report/route.ts` | `affiliate/dashboard.controller.ts` |
| `app/api/affiliate/dashboard/stats/route.ts` | `affiliate/dashboard.controller.ts` |
| `app/api/affiliate/profile/payment/route.ts` | `affiliate/profile.controller.ts` |
| `app/api/affiliate/profile/route.ts` | `affiliate/profile.controller.ts` |

#### Alerts Module (2 files → 1 Nest.js module)

| Original Path | Nest.js Equivalent |
|---------------|-------------------|
| `app/api/alerts/[id]/route.ts` | `alerts/alerts.controller.ts` |
| `app/api/alerts/route.ts` | `alerts/alerts.controller.ts` |

#### Auth Module (7 files → 1 Nest.js module)

| Original Path | Nest.js Equivalent |
|---------------|-------------------|
| `app/api/auth/[...nextauth]/route.ts` | `auth/auth.controller.ts` (Passport.js) |
| `app/api/auth/forgot-password/route.ts` | `auth/password.controller.ts` |
| `app/api/auth/register/route.ts` | `auth/auth.controller.ts` |
| `app/api/auth/resend-verification/route.ts` | `auth/verification.controller.ts` |
| `app/api/auth/reset-password/route.ts` | `auth/password.controller.ts` |
| `app/api/auth/track-login/route.ts` | `auth/tracking.controller.ts` |
| `app/api/auth/verify-email/route.ts` | `auth/verification.controller.ts` |

#### Cron Jobs Module (8 files → 1 Nest.js module with @nestjs/schedule)

| Original Path | Nest.js Equivalent |
|---------------|-------------------|
| `app/api/cron/check-expiring-subscriptions/route.ts` | `cron/subscription.cron.ts` |
| `app/api/cron/daily-maintenance/route.ts` | `cron/maintenance.cron.ts` |
| `app/api/cron/distribute-codes/route.ts` | `cron/affiliate.cron.ts` |
| `app/api/cron/downgrade-expired-subscriptions/route.ts` | `cron/subscription.cron.ts` |
| `app/api/cron/expire-codes/route.ts` | `cron/affiliate.cron.ts` |
| `app/api/cron/process-pending-disbursements/route.ts` | `cron/disbursement.cron.ts` |
| `app/api/cron/send-monthly-reports/route.ts` | `cron/reports.cron.ts` |
| `app/api/cron/sync-riseworks-accounts/route.ts` | `cron/riseworks.cron.ts` |

#### Disbursement Module (16 files → 1 Nest.js module)

| Original Path | Nest.js Equivalent |
|---------------|-------------------|
| `app/api/disbursement/affiliates/[affiliateId]/commissions/route.ts` | `disbursement/affiliates.controller.ts` |
| `app/api/disbursement/affiliates/[affiliateId]/route.ts` | `disbursement/affiliates.controller.ts` |
| `app/api/disbursement/affiliates/payable/route.ts` | `disbursement/affiliates.controller.ts` |
| `app/api/disbursement/audit-logs/route.ts` | `disbursement/audit.controller.ts` |
| `app/api/disbursement/batches/[batchId]/execute/route.ts` | `disbursement/batches.controller.ts` |
| `app/api/disbursement/batches/[batchId]/route.ts` | `disbursement/batches.controller.ts` |
| `app/api/disbursement/batches/preview/route.ts` | `disbursement/batches.controller.ts` |
| `app/api/disbursement/batches/route.ts` | `disbursement/batches.controller.ts` |
| `app/api/disbursement/config/route.ts` | `disbursement/config.controller.ts` |
| `app/api/disbursement/health/route.ts` | `disbursement/health.controller.ts` |
| `app/api/disbursement/pay/route.ts` | `disbursement/pay.controller.ts` |
| `app/api/disbursement/reports/affiliate/[affiliateId]/route.ts` | `disbursement/reports.controller.ts` |
| `app/api/disbursement/reports/summary/route.ts` | `disbursement/reports.controller.ts` |
| `app/api/disbursement/riseworks/accounts/route.ts` | `disbursement/riseworks.controller.ts` |
| `app/api/disbursement/riseworks/sync/route.ts` | `disbursement/riseworks.controller.ts` |
| `app/api/disbursement/transactions/route.ts` | `disbursement/transactions.controller.ts` |

#### Other Core Modules (35 files)

**Candles Module (1 file)**
- `app/api/candles/[symbol]/route.ts` → `candles/candles.controller.ts`

**Checkout Module (2 files)**
- `app/api/checkout/route.ts` → `checkout/checkout.controller.ts`
- `app/api/checkout/validate-code/route.ts` → `checkout/checkout.controller.ts`

**Config Module (1 file)**
- `app/api/config/affiliate/route.ts` → `config/config.controller.ts`

**Invoices Module (1 file)**
- `app/api/invoices/route.ts` → `invoices/invoices.controller.ts`

**Notifications Module (3 files)**
- `app/api/notifications/[id]/read/route.ts` → `notifications/notifications.controller.ts`
- `app/api/notifications/[id]/route.ts` → `notifications/notifications.controller.ts`
- `app/api/notifications/route.ts` → `notifications/notifications.controller.ts`

**Payments/DLocal Module (7 files)**
- `app/api/payments/dlocal/[paymentId]/route.ts` → `payments/dlocal.controller.ts`
- `app/api/payments/dlocal/check-three-day-eligibility/route.ts` → `payments/dlocal.controller.ts`
- `app/api/payments/dlocal/convert/route.ts` → `payments/dlocal.controller.ts`
- `app/api/payments/dlocal/create/route.ts` → `payments/dlocal.controller.ts`
- `app/api/payments/dlocal/exchange-rate/route.ts` → `payments/dlocal.controller.ts`
- `app/api/payments/dlocal/methods/route.ts` → `payments/dlocal.controller.ts`
- `app/api/payments/dlocal/validate-discount/route.ts` → `payments/dlocal.controller.ts`

**Subscription Module (2 files)**
- `app/api/subscription/cancel/route.ts` → `subscription/subscription.controller.ts`
- `app/api/subscription/route.ts` → `subscription/subscription.controller.ts`

**Tier Module (3 files)**
- `app/api/tier/check/[symbol]/route.ts` → `tier/tier.controller.ts`
- `app/api/tier/combinations/route.ts` → `tier/tier.controller.ts`
- `app/api/tier/symbols/route.ts` → `tier/tier.controller.ts`

**User Module (14 files)**
- `app/api/user/2fa/backup-codes/route.ts` → `user/two-factor.controller.ts`
- `app/api/user/2fa/disable/route.ts` → `user/two-factor.controller.ts`
- `app/api/user/2fa/setup/route.ts` → `user/two-factor.controller.ts`
- `app/api/user/2fa/verify/route.ts` → `user/two-factor.controller.ts`
- `app/api/user/2fa/verify-setup/route.ts` → `user/two-factor.controller.ts`
- `app/api/user/account/deletion-cancel/route.ts` → `user/account.controller.ts`
- `app/api/user/account/deletion-confirm/route.ts` → `user/account.controller.ts`
- `app/api/user/account/deletion-request/route.ts` → `user/account.controller.ts`
- `app/api/user/login-history/route.ts` → `user/user.controller.ts`
- `app/api/user/password/route.ts` → `user/user.controller.ts`
- `app/api/user/preferences/route.ts` → `user/user.controller.ts`
- `app/api/user/profile/route.ts` → `user/user.controller.ts`
- `app/api/user/sessions/[id]/route.ts` → `user/sessions.controller.ts`
- `app/api/user/sessions/route.ts` → `user/sessions.controller.ts`

**Watchlist Module (3 files)**
- `app/api/watchlist/[id]/route.ts` → `watchlist/watchlist.controller.ts`
- `app/api/watchlist/reorder/route.ts` → `watchlist/watchlist.controller.ts`
- `app/api/watchlist/route.ts` → `watchlist/watchlist.controller.ts`

**Webhooks Module (3 files)**
- `app/api/webhooks/dlocal/route.ts` → `webhooks/dlocal.controller.ts`
- `app/api/webhooks/riseworks/route.ts` → `webhooks/riseworks.controller.ts`
- `app/api/webhooks/stripe/route.ts` → `webhooks/stripe.controller.ts`

---

### 2. Business Logic → Nest.js Services (87 files)

All `lib/**/*.ts` files become Nest.js services.

#### lib/admin/ → AdminModule Services (3 files)
| File | Nest.js Service |
|------|-----------------|
| `lib/admin/affiliate-management.ts` | `admin/affiliate-management.service.ts` |
| `lib/admin/code-distribution.ts` | `admin/code-distribution.service.ts` |
| `lib/admin/pnl-calculator.ts` | `admin/pnl-calculator.service.ts` |

#### lib/affiliate/ → AffiliateModule Services (7 files)
| File | Nest.js Service |
|------|-----------------|
| `lib/affiliate/code-generator.ts` | `affiliate/code-generator.service.ts` |
| `lib/affiliate/commission-calculator.ts` | `affiliate/commission-calculator.service.ts` |
| `lib/affiliate/constants.ts` | `affiliate/affiliate.constants.ts` |
| `lib/affiliate/registration.ts` | `affiliate/registration.service.ts` |
| `lib/affiliate/report-builder.ts` | `affiliate/report-builder.service.ts` |
| `lib/affiliate/types.ts` | `affiliate/affiliate.types.ts` |
| `lib/affiliate/validators.ts` | `affiliate/affiliate.validators.ts` |

#### lib/api/ → ApiModule (3 files)
| File | Nest.js Service |
|------|-----------------|
| `lib/api/index.ts` | `api/api.module.ts` |
| `lib/api/mt5-client.ts` | `api/mt5-client.service.ts` |
| `lib/api/mt5-transform.ts` | `api/mt5-transform.service.ts` |

#### lib/auth/ → AuthModule Services (6 files)
| File | Nest.js Service |
|------|-----------------|
| `lib/auth/auth-options.ts` | `auth/auth.config.ts` (Passport.js) |
| `lib/auth/errors.ts` | `auth/auth.errors.ts` |
| `lib/auth/permissions.ts` | `auth/permissions.guard.ts` |
| `lib/auth/session-tracker.ts` | `auth/session-tracker.service.ts` |
| `lib/auth/session.ts` | `auth/session.service.ts` |
| `lib/auth/two-factor.ts` | `auth/two-factor.service.ts` |

#### lib/cache/ → CacheModule (1 file)
| File | Nest.js Service |
|------|-----------------|
| `lib/cache/cache-manager.ts` | `cache/cache-manager.service.ts` |

#### lib/constants/ → Shared Constants (1 file)
| File | Nest.js Location |
|------|------------------|
| `lib/constants/business-rules.ts` | `shared/constants/business-rules.ts` |

#### lib/cron/ → CronModule Services (3 files)
| File | Nest.js Service |
|------|-----------------|
| `lib/cron/check-expiring-subscriptions.ts` | `cron/check-expiring-subscriptions.service.ts` |
| `lib/cron/downgrade-expired-subscriptions.ts` | `cron/downgrade-expired-subscriptions.service.ts` |
| `lib/cron/monthly-distribution.ts` | `cron/monthly-distribution.service.ts` |

#### lib/db/ → DatabaseModule (2 files)
| File | Nest.js Service |
|------|-----------------|
| `lib/db/prisma.ts` | `database/prisma.service.ts` |
| `lib/db/seed.ts` | `database/seed.service.ts` |

#### lib/disbursement/ → DisbursementModule (17 files)
All files in this directory → `disbursement/*.service.ts`

#### lib/dlocal/ → DLocalModule (5 files)
| File | Nest.js Service |
|------|-----------------|
| `lib/dlocal/constants.ts` | `dlocal/dlocal.constants.ts` |
| `lib/dlocal/currency-converter.service.ts` | `dlocal/currency-converter.service.ts` |
| `lib/dlocal/dlocal-payment.service.ts` | `dlocal/dlocal-payment.service.ts` |
| `lib/dlocal/payment-methods.service.ts` | `dlocal/payment-methods.service.ts` |
| `lib/dlocal/three-day-validator.service.ts` | `dlocal/three-day-validator.service.ts` |

#### lib/email/ → EmailModule (2 files)
| File | Nest.js Service |
|------|-----------------|
| `lib/email/email.ts` | `email/email.service.ts` |
| `lib/email/subscription-emails.ts` | `email/subscription-emails.service.ts` |

#### lib/errors/ → Shared Errors (3 files)
| File | Nest.js Location |
|------|------------------|
| `lib/errors/api-error.ts` | `shared/exceptions/api.exception.ts` |
| `lib/errors/error-handler.ts` | `shared/filters/error.filter.ts` |
| `lib/errors/error-logger.ts` | `shared/services/error-logger.service.ts` |

#### lib/fraud/ → FraudModule (1 file)
| File | Nest.js Service |
|------|-----------------|
| `lib/fraud/fraud-detection.service.ts` | `fraud/fraud-detection.service.ts` |

#### lib/geo/ → GeoModule (1 file)
| File | Nest.js Service |
|------|-----------------|
| `lib/geo/detect-country.ts` | `geo/detect-country.service.ts` |

#### lib/jobs/ → JobsModule (2 files)
| File | Nest.js Service |
|------|-----------------|
| `lib/jobs/alert-checker.ts` | `jobs/alert-checker.service.ts` |
| `lib/jobs/queue.ts` | `jobs/queue.service.ts` (BullMQ) |

#### lib/monitoring/ → MonitoringModule (1 file)
| File | Nest.js Service |
|------|-----------------|
| `lib/monitoring/system-monitor.ts` | `monitoring/system-monitor.service.ts` |

#### lib/redis/ → RedisModule (1 file)
| File | Nest.js Service |
|------|-----------------|
| `lib/redis/client.ts` | `redis/redis.service.ts` |

#### lib/security/ → SecurityModule (1 file)
| File | Nest.js Service |
|------|-----------------|
| `lib/security/device-detection.ts` | `security/device-detection.service.ts` |

#### lib/stripe/ → StripeModule (2 files)
| File | Nest.js Service |
|------|-----------------|
| `lib/stripe/stripe.ts` | `stripe/stripe.service.ts` |
| `lib/stripe/webhook-handlers.ts` | `stripe/webhook-handlers.service.ts` |

#### lib/tier/ → TierModule (5 files)
| File | Nest.js Service |
|------|-----------------|
| `lib/tier/constants.ts` | `tier/tier.constants.ts` |
| `lib/tier/index.ts` | `tier/tier.module.ts` |
| `lib/tier/validator.ts` | `tier/tier-validator.service.ts` |

#### lib/validations/ → Shared Validators (4 files)
| File | Nest.js Location |
|------|------------------|
| `lib/validations/alert.ts` | `shared/validators/alert.validator.ts` |
| `lib/validations/auth.ts` | `shared/validators/auth.validator.ts` |
| `lib/validations/user.ts` | `shared/validators/user.validator.ts` |
| `lib/validations/watchlist.ts` | `shared/validators/watchlist.validator.ts` |

#### lib/websocket/ → WebSocketModule (2 files)
| File | Nest.js Service |
|------|-----------------|
| `lib/websocket/server.ts` | `websocket/websocket.gateway.ts` |
| `lib/websocket/use-mt5-websocket.ts` | **FRONTEND** (React hook) |

#### lib/ Root Files (9 files)
| File | Nest.js Location |
|------|------------------|
| `lib/candle-data-helpers.ts` | `candles/candle-data-helpers.service.ts` |
| `lib/csrf.ts` | `shared/middleware/csrf.middleware.ts` |
| `lib/logger.ts` | `shared/services/logger.service.ts` |
| `lib/rate-limit.ts` | `shared/guards/rate-limit.guard.ts` |
| `lib/tier-config.ts` | `tier/tier-config.ts` |
| `lib/tier-helpers.ts` | `tier/tier-helpers.service.ts` |
| `lib/tier-validation.ts` | `tier/tier-validation.service.ts` |
| `lib/tokens.ts` | `auth/tokens.service.ts` |
| `lib/utils.ts` | **SHARED** (both frontend and backend) |

---

### 3. Database Files → Nest.js Prisma Module (3 files)

| File | Nest.js Location |
|------|------------------|
| `prisma/schema.prisma` | `prisma/schema.prisma` |
| `prisma/migrations/**` | `prisma/migrations/**` |
| `prisma/seed.ts` | `prisma/seed.ts` |

---

### 4. Middleware → Nest.js Guards/Middleware (1 file)

| File | Nest.js Location |
|------|------------------|
| `middleware/tier-check.ts` | `shared/guards/tier-check.guard.ts` |

---

### 5. Email Templates → Nest.js Email Module (1 + 5 TSX files)

| File | Nest.js Location |
|------|------------------|
| `emails/index.ts` | `email/email.module.ts` |
| `lib/email/templates/affiliate/*.tsx` | `email/templates/*.tsx` (React Email) |

---

## FRONTEND FILES (Next.js → Vercel)

These files run in the browser or handle UI rendering. They stay in Next.js.

### 1. Pages/Layouts (74 TSX files)

All `app/**/*.tsx` files remain in Next.js:

#### Authentication Pages (8 files)
- `app/(auth)/forgot-password/page.tsx`
- `app/(auth)/layout.tsx`
- `app/(auth)/login/page.tsx`
- `app/(auth)/register/page.tsx`
- `app/(auth)/reset-password/page.tsx`
- `app/(auth)/verify-2fa/page.tsx`
- `app/(auth)/verify-email/page.tsx`
- `app/(auth)/verify-email/pending/page.tsx`

#### Dashboard Pages (38 files)
- All `app/(dashboard)/**/*.tsx` files

#### Marketing Pages (4 files)
- `app/(marketing)/landing-content.tsx`
- `app/(marketing)/layout.tsx`
- `app/(marketing)/page.tsx`
- `app/(marketing)/pricing/page.tsx`

#### Admin Portal Pages (8 files)
- All `app/admin/**/*.tsx` files

#### Affiliate Portal Pages (11 files)
- All `app/affiliate/**/*.tsx` files

#### Root App Files (5 files)
- `app/checkout/page.tsx`
- `app/error.tsx`
- `app/layout.tsx`
- `app/providers.tsx`
- `app/test-api/page.tsx`

---

### 2. React Components (77 TSX files)

All `components/**/*.tsx` files remain in Next.js:

- `components/admin/` (14 files)
- `components/affiliate/` (3 files)
- `components/alerts/` (3 files)
- `components/auth/` (4 files)
- `components/billing/` (2 files)
- `components/charts/` (5 files)
- `components/dashboard/` (4 files)
- `components/indicators/` (1 file)
- `components/layout/` (4 files)
- `components/notifications/` (2 files)
- `components/payments/` (6 files)
- `components/pricing/` (1 file)
- `components/providers/` (2 files)
- `components/ui/` (22 files)
- `components/watchlist/` (3 files)
- `components/theme-toggle.tsx` (1 file)

---

### 3. React Hooks (8 files)

All `hooks/*.ts` files remain in Next.js (they use React hooks):

| File | Reason |
|------|--------|
| `hooks/use-alerts.ts` | Uses useState, useEffect |
| `hooks/use-auth.ts` | Uses useSession (NextAuth) |
| `hooks/use-indicators.ts` | Uses useState, useEffect, useCallback |
| `hooks/use-login-tracking.ts` | Uses useEffect |
| `hooks/use-optimistic-mutation.ts` | Uses useState |
| `hooks/use-toast.ts` | Uses useState |
| `hooks/use-watchlist.ts` | Uses useState, useEffect |
| `hooks/use-websocket.ts` | Uses useState, useEffect |

Also:
- `lib/hooks/useAffiliateConfig.ts` → Frontend
- `lib/websocket/use-mt5-websocket.ts` → Frontend

---

### 4. Barrel Exports (2 files)

| File | Location |
|------|----------|
| `components/affiliate/index.ts` | Frontend |
| `components/payments/index.ts` | Frontend |

---

### 5. Styles (1 file)

| File | Location |
|------|----------|
| `app/globals.css` | Frontend |

---

## SHARED FILES (npm package or copied)

These files need to be available in both frontend and backend.

### Types (12 files)

| File | Description |
|------|-------------|
| `types/alert.ts` | Alert type definitions |
| `types/api.ts` | API request/response types |
| `types/disbursement.ts` | Disbursement types |
| `types/dlocal.ts` | DLocal payment types |
| `types/index.ts` | Main type exports |
| `types/indicator.ts` | Chart indicator types |
| `types/next-auth.d.ts` | NextAuth augmentation (Frontend only) |
| `types/payment.ts` | Payment types |
| `types/prisma-stubs.d.ts` | Prisma type stubs |
| `types/tier.ts` | Tier type definitions |
| `types/user.ts` | User type definitions |
| `types/watchlist.ts` | Watchlist types |

**Recommendation:** Create a shared `@trading-alerts/types` npm package.

---

## TEST FILES (CI/CD only)

All `__tests__/**/*.ts` files (84 files) run in CI/CD pipelines.

### Backend Tests → Move to Nest.js
- `__tests__/api/**/*.ts` (22 files)
- `__tests__/lib/**/*.ts` (47 files)
- `__tests__/integration/**/*.ts` (7 files)
- `__tests__/e2e/**/*.ts` (1 file)

### Frontend Tests → Keep in Next.js
- `__tests__/components/**/*.tsx` (22 files)
- `__tests__/hooks/**/*.ts` (2 files)

---

## Summary Table

| Category | Files | Deploy To | Framework |
|----------|-------|-----------|-----------|
| API Routes | 100 | Railway | Nest.js Controllers |
| Business Logic (lib/) | 87 | Railway | Nest.js Services |
| Database (prisma/) | 3 | Railway | Nest.js + Prisma |
| Middleware | 1 | Railway | Nest.js Guards |
| Email Templates | 6 | Railway | Nest.js + React Email |
| **Backend Total** | **197** | **Railway** | **Nest.js** |
| Pages/Layouts | 74 | Vercel | Next.js |
| Components | 77 | Vercel | Next.js |
| React Hooks | 10 | Vercel | Next.js |
| Styles | 1 | Vercel | Next.js |
| **Frontend Total** | **162** | **Vercel** | **Next.js** |
| Shared Types | 12 | npm package | TypeScript |
| Backend Tests | 77 | CI/CD | Jest |
| Frontend Tests | 24 | CI/CD | Jest + RTL |
| **Total** | **472** | - | - |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    VERCEL (Frontend)                         │
│                      Next.js 14                              │
├─────────────────────────────────────────────────────────────┤
│  app/                    │  components/                      │
│  ├── (auth)/            │  ├── admin/                       │
│  ├── (dashboard)/       │  ├── affiliate/                   │
│  ├── (marketing)/       │  ├── auth/                        │
│  ├── admin/             │  ├── charts/                      │
│  ├── affiliate/         │  ├── ui/                          │
│  └── checkout/          │  └── ...                          │
│                         │                                    │
│  hooks/                 │  styles/                           │
│  ├── use-indicators.ts  │  └── globals.css                  │
│  ├── use-alerts.ts      │                                    │
│  └── ...                │                                    │
└────────────────────────────┬────────────────────────────────┘
                             │
                    HTTP/REST API calls
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    RAILWAY (Backend)                         │
│                      Nest.js                                 │
├─────────────────────────────────────────────────────────────┤
│  src/                                                        │
│  ├── admin/            (AdminModule)                        │
│  ├── affiliate/        (AffiliateModule)                    │
│  ├── alerts/           (AlertsModule)                       │
│  ├── auth/             (AuthModule + Passport.js)           │
│  ├── cron/             (CronModule + @nestjs/schedule)      │
│  ├── disbursement/     (DisbursementModule)                 │
│  ├── dlocal/           (DLocalModule)                       │
│  ├── email/            (EmailModule + React Email)          │
│  ├── payments/         (PaymentsModule)                     │
│  ├── stripe/           (StripeModule)                       │
│  ├── tier/             (TierModule)                         │
│  ├── user/             (UserModule)                         │
│  ├── watchlist/        (WatchlistModule)                    │
│  ├── webhooks/         (WebhooksModule)                     │
│  ├── websocket/        (WebSocketGateway)                   │
│  ├── database/         (PrismaModule)                       │
│  └── shared/           (Guards, Filters, Pipes)             │
│                                                              │
│  prisma/                                                     │
│  ├── schema.prisma                                          │
│  └── migrations/                                            │
└─────────────────────────────────────────────────────────────┘
```

---

_Generated: 2026-01-26_
