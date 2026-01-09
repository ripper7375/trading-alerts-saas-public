# Step 5: Next.js to Nest.js Backend Conversion - Claude Code Prompt

## Overview

This prompt guides Claude Code (web) through **Step 5** of the Modular Monolith Migration: Converting the Next.js backend logic to Nest.js with CORS enabled, then dockerizing as a single application.

---

## Context for Claude Code

### Project Background

We are migrating a Trading Alerts SaaS application from a **Monolithic Architecture** (Next.js full-stack on Vercel) to a **Modular Monolith Architecture**:
- **Frontend**: Next.js on Vercel (UI only)
- **Backend**: Nest.js on Railway (API + business logic, dockerized)
- **Database**: PostgreSQL + TimescaleDB (Timescale Cloud)
- **Cache**: Redis (Upstash)

### Current State (Next.js Backend)

The Next.js backend consists of:
- **100 API Route files** in `app/api/**/route.ts`
- **96 Library/Service files** in `lib/**/*`
- **93 Backend Test files** in `__tests__/**/*`

### Target State (Nest.js Backend)

Convert to Nest.js modular structure:
- Organized into **domain modules** (Auth, Users, Billing, Indicators, etc.)
- CORS enabled for cross-origin requests from Vercel frontend
- Dockerized as a single container for Railway deployment

---

## Prompt for Claude Code (Web)

```
I need your help converting our Next.js backend to Nest.js as part of our Modular Monolith migration. This is Step 5 of our migration plan.

## Current Architecture

Our Next.js backend has 196 files organized as:

### API Routes (100 files in app/api/**/route.ts):

**Authentication & User Management (20 files):**
- app/api/auth/[...nextauth]/route.ts - NextAuth.js handler
- app/api/auth/register/route.ts - User registration
- app/api/auth/forgot-password/route.ts - Password reset request
- app/api/auth/reset-password/route.ts - Password reset confirm
- app/api/auth/resend-verification/route.ts - Email verification resend
- app/api/auth/track-login/route.ts - Login tracking
- app/api/user/profile/route.ts - Profile CRUD
- app/api/user/password/route.ts - Password update
- app/api/user/preferences/route.ts - User preferences
- app/api/user/login-history/route.ts - Login history
- app/api/user/sessions/route.ts - Active sessions
- app/api/user/sessions/[id]/route.ts - Revoke session
- app/api/user/account/deletion-request/route.ts - Request deletion
- app/api/user/account/deletion-cancel/route.ts - Cancel deletion
- app/api/user/account/deletion-confirm/route.ts - Confirm deletion
- app/api/user/2fa/setup/route.ts - 2FA setup
- app/api/user/2fa/verify-setup/route.ts - 2FA verification
- app/api/user/2fa/verify/route.ts - 2FA code verify
- app/api/user/2fa/disable/route.ts - 2FA disable
- app/api/user/2fa/backup-codes/route.ts - Backup codes

**Indicators & Trading Data (5 files):**
- app/api/indicators/route.ts - List indicators
- app/api/indicators/[symbol]/[timeframe]/route.ts - Get indicator data
- app/api/indicators/health/route.ts - Health check
- app/api/timeframes/route.ts - Get timeframes
- app/api/confluence/[symbol]/route.ts - Confluence score (PRO)

**Watchlist & Alerts (5 files):**
- app/api/watchlist/route.ts - CRUD watchlists
- app/api/watchlist/[id]/route.ts - Single watchlist
- app/api/watchlist/reorder/route.ts - Reorder items
- app/api/alerts/route.ts - CRUD alerts
- app/api/alerts/[id]/route.ts - Single alert

**Payments & Billing (11 files):**
- app/api/checkout/route.ts - Unified checkout
- app/api/checkout/validate-code/route.ts - Validate discount/affiliate code
- app/api/payments/dlocal/methods/route.ts - dLocal payment methods
- app/api/payments/dlocal/create/route.ts - Create dLocal payment
- app/api/payments/dlocal/[paymentId]/route.ts - Payment status
- app/api/payments/dlocal/exchange-rate/route.ts - Exchange rate
- app/api/payments/dlocal/convert/route.ts - Currency conversion
- app/api/payments/dlocal/validate-discount/route.ts - Validate discount
- app/api/payments/dlocal/check-three-day-eligibility/route.ts - Trial check
- app/api/invoices/route.ts - User invoices
- app/api/subscription/route.ts - Subscription status

**Affiliate System (9 files):**
- app/api/config/affiliate/route.ts - Affiliate config
- app/api/affiliate/auth/register/route.ts - Affiliate registration
- app/api/affiliate/auth/verify-email/route.ts - Email verification
- app/api/affiliate/dashboard/stats/route.ts - Dashboard stats
- app/api/affiliate/dashboard/codes/route.ts - Codes list
- app/api/affiliate/dashboard/code-inventory/route.ts - Code inventory
- app/api/affiliate/dashboard/commission-report/route.ts - Commission report
- app/api/affiliate/profile/route.ts - Profile management
- app/api/affiliate/profile/payment/route.ts - Payment settings

**Admin (20 files):**
- app/api/admin/users/route.ts - User management
- app/api/admin/api-usage/route.ts - API usage
- app/api/admin/error-logs/route.ts - Error logs
- app/api/admin/analytics/route.ts - Analytics dashboard
- app/api/admin/cache/clear/route.ts - Clear cache
- app/api/admin/settings/affiliate/route.ts - Affiliate settings
- app/api/admin/fraud-alerts/route.ts - Fraud alerts
- app/api/admin/fraud-alerts/[id]/route.ts - Fraud alert detail
- app/api/admin/affiliates/route.ts - Affiliate management
- app/api/admin/affiliates/[id]/route.ts - Single affiliate
- app/api/admin/affiliates/[id]/suspend/route.ts - Suspend affiliate
- app/api/admin/affiliates/[id]/reactivate/route.ts - Reactivate affiliate
- app/api/admin/affiliates/[id]/distribute-codes/route.ts - Distribute codes
- app/api/admin/affiliates/reports/sales-performance/route.ts - Sales report
- app/api/admin/affiliates/reports/profit-loss/route.ts - P&L report
- app/api/admin/affiliates/reports/commission-owings/route.ts - Commission report
- app/api/admin/affiliates/reports/code-inventory/route.ts - Inventory report
- app/api/admin/codes/[code]/cancel/route.ts - Cancel code
- app/api/admin/commissions/pay/route.ts - Pay commission

**Disbursement System (16 files):**
- app/api/disbursement/affiliates/payable/route.ts - Payable affiliates
- app/api/disbursement/affiliates/[affiliateId]/route.ts - Affiliate details
- app/api/disbursement/affiliates/[affiliateId]/commissions/route.ts - Commission history
- app/api/disbursement/batches/route.ts - Payment batches
- app/api/disbursement/batches/preview/route.ts - Batch preview
- app/api/disbursement/batches/[batchId]/route.ts - Batch details
- app/api/disbursement/batches/[batchId]/execute/route.ts - Execute batch
- app/api/disbursement/transactions/route.ts - Transactions list
- app/api/disbursement/pay/route.ts - Manual payment
- app/api/disbursement/audit-logs/route.ts - Audit logs
- app/api/disbursement/config/route.ts - Config
- app/api/disbursement/health/route.ts - Health check
- app/api/disbursement/reports/summary/route.ts - Summary report
- app/api/disbursement/reports/affiliate/[affiliateId]/route.ts - Affiliate report
- app/api/disbursement/riseworks/accounts/route.ts - RiseWorks accounts
- app/api/disbursement/riseworks/sync/route.ts - RiseWorks sync

**Webhooks (3 files):**
- app/api/webhooks/stripe/route.ts - Stripe webhook
- app/api/webhooks/dlocal/route.ts - dLocal webhook
- app/api/webhooks/riseworks/route.ts - RiseWorks webhook

**Cron Jobs (8 files):**
- app/api/cron/check-expiring-subscriptions/route.ts
- app/api/cron/downgrade-expired-subscriptions/route.ts
- app/api/cron/daily-maintenance/route.ts
- app/api/cron/distribute-codes/route.ts
- app/api/cron/expire-codes/route.ts
- app/api/cron/send-monthly-reports/route.ts
- app/api/cron/process-pending-disbursements/route.ts
- app/api/cron/sync-riseworks-accounts/route.ts

**Other (3 files):**
- app/api/notifications/route.ts - Notifications
- app/api/notifications/[id]/route.ts - Single notification
- app/api/cache/stats/route.ts - Cache stats

### Library/Service Files (96 files in lib/**/*):

**Database Layer:**
- lib/db/prisma.ts - Prisma client
- lib/db/postgresql.ts - PostgreSQL client
- lib/db/queries.ts - Query functions
- lib/db/multi-timeframe-query.ts - Multi-TF queries

**Authentication & Security:**
- lib/auth/auth-options.ts - NextAuth config
- lib/auth/session.ts - Session management
- lib/auth/session-tracker.ts - Session tracking
- lib/auth/permissions.ts - Permission checking
- lib/auth/two-factor.ts - 2FA utilities
- lib/security/device-detection.ts - Device fingerprint
- lib/csrf.ts - CSRF protection
- lib/rate-limit.ts - Rate limiting
- lib/tokens.ts - Token utilities

**Tier System:**
- lib/tier-validation.ts - Tier validation
- lib/tier-helpers.ts - Tier helpers
- lib/tier-config.ts - Tier configuration
- lib/tier/validation.ts, constants.ts, validator.ts, index.ts

**Payment Processing:**
- lib/stripe/stripe.ts - Stripe client
- lib/stripe/webhook-handlers.ts - Stripe webhooks
- lib/dlocal/dlocal-payment.service.ts - dLocal payments
- lib/dlocal/payment-methods.service.ts - Payment methods
- lib/dlocal/currency-converter.service.ts - Currency conversion
- lib/dlocal/three-day-validator.service.ts - Trial validation

**Affiliate System:**
- lib/affiliate/registration.ts - Registration logic
- lib/affiliate/code-generator.ts - Code generation
- lib/affiliate/commission-calculator.ts - Commission calc
- lib/affiliate/validators.ts - Validation
- lib/affiliate/report-builder.ts - Reports

**Disbursement System:**
- lib/disbursement/services/batch-manager.ts
- lib/disbursement/services/commission-aggregator.ts
- lib/disbursement/services/payout-calculator.ts
- lib/disbursement/services/transaction-service.ts
- lib/disbursement/services/payment-orchestrator.ts
- lib/disbursement/providers/rise/rise-provider.ts
- lib/disbursement/providers/rise/siwe-auth.ts
- lib/disbursement/providers/rise/webhook-verifier.ts

**Caching Layer:**
- lib/cache/redis.ts - Redis client
- lib/cache/indicator-cache.ts - Indicator caching
- lib/cache/confluence-cache.ts - Confluence caching
- lib/cache/cache-manager.ts - Cache management

**Email Services:**
- lib/email/email.ts - SendGrid client
- lib/email/subscription-emails.ts - Subscription emails

**Background Jobs:**
- lib/jobs/queue.ts - Job queue
- lib/jobs/alert-checker.ts - Alert checker
- lib/cron/monthly-distribution.ts - Code distribution

**Utilities:**
- lib/utils.ts, lib/logger.ts, lib/errors/*, lib/validations/*

## Target Nest.js Architecture

Create this module structure:

```
backend/
├── src/
│   ├── main.ts                     # Entry point with CORS
│   ├── app.module.ts               # Root module
│   ├── common/                     # Shared utilities
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── pipes/
│   │   └── utils/
│   ├── config/                     # Configuration
│   │   └── config.module.ts
│   ├── prisma/                     # Database
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── redis/                      # Caching
│   │   ├── redis.module.ts
│   │   └── redis.service.ts
│   ├── modules/
│   │   ├── auth/                   # Authentication (20 endpoints)
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/
│   │   │   ├── guards/
│   │   │   └── dto/
│   │   ├── users/                  # User management
│   │   │   ├── users.module.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   └── dto/
│   │   ├── indicators/             # Trading indicators (5 endpoints)
│   │   │   ├── indicators.module.ts
│   │   │   ├── indicators.controller.ts
│   │   │   ├── indicators.service.ts
│   │   │   └── dto/
│   │   ├── watchlist/              # Watchlist (3 endpoints)
│   │   ├── alerts/                 # Price alerts (2 endpoints)
│   │   ├── billing/                # Payments & Subscriptions (11 endpoints)
│   │   │   ├── billing.module.ts
│   │   │   ├── payments/
│   │   │   ├── subscriptions/
│   │   │   └── dlocal/
│   │   ├── affiliate/              # Affiliate portal (9 endpoints)
│   │   ├── admin/                  # Admin dashboard (20 endpoints)
│   │   ├── disbursement/           # Disbursement system (16 endpoints)
│   │   ├── webhooks/               # Webhook handlers (3 endpoints)
│   │   ├── notifications/          # Notifications (3 endpoints)
│   │   └── cron/                   # Background jobs (8 jobs)
├── prisma/
│   └── schema.prisma
├── test/                           # Tests (93 files to convert)
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Requirements

### 1. CORS Configuration (main.ts)

```typescript
app.enableCors({
  origin: [
    'http://localhost:3000',           // Local dev
    'https://*.vercel.app',            // Vercel previews
    'https://yourdomain.com',          // Production
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

### 2. Module Organization

Group by domain, not by technical layer:
- Each module encapsulates its own controllers, services, DTOs
- Use dependency injection
- Keep cross-module dependencies minimal

### 3. Authentication Strategy

Replace NextAuth.js with:
- JWT-based authentication
- Passport.js strategies (JWT, Local)
- Guards for protected routes
- 2FA support

### 4. Database Layer

- Prisma for ORM
- TimescaleDB hypertables for time-series data
- Connection pooling

### 5. Caching Layer

- Redis with @nestjs/cache-manager
- Cache indicators and confluence scores
- Rate limiting with Redis

### 6. Background Jobs

- Bull Queue for async jobs
- Scheduled tasks with @nestjs/schedule

### 7. Docker Configuration

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json prisma ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 5000
CMD ["node", "dist/main"]
```

## Deliverables

Please provide a step-by-step guide that covers:

1. **Phase 1: Project Setup**
   - Initialize Nest.js project
   - Install dependencies
   - Configure TypeScript
   - Set up folder structure

2. **Phase 2: Core Infrastructure**
   - Prisma module setup
   - Redis module setup
   - Configuration module
   - Common utilities (guards, interceptors, filters)

3. **Phase 3: Authentication Module**
   - JWT strategy
   - Local strategy
   - Auth guards
   - Session management
   - 2FA support

4. **Phase 4: Domain Modules**
   For each module, specify:
   - File mapping (Next.js → Nest.js)
   - Controller structure
   - Service methods
   - DTOs
   - Dependencies

5. **Phase 5: Background Jobs**
   - Bull Queue setup
   - Scheduled tasks
   - Cron job migration

6. **Phase 6: Testing**
   - Test file migration strategy
   - Jest configuration for Nest.js
   - E2E test setup

7. **Phase 7: Docker & Deployment**
   - Dockerfile
   - docker-compose.yml for local dev
   - Environment variables
   - Railway deployment configuration

## Conversion Pattern

For each Next.js API route, show the conversion pattern:

**Next.js (app/api/auth/register/route.ts):**
```typescript
export async function POST(req: NextRequest) {
  const body = await req.json();
  // validation
  // business logic
  return NextResponse.json({ ... });
}
```

**Nest.js (modules/auth/auth.controller.ts):**
```typescript
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }
}
```

## File Mapping Reference

Provide explicit mappings for all 196 backend files showing:
- Source: Next.js file path
- Target: Nest.js file path
- Module: Which Nest.js module it belongs to
- Dependencies: Related services/modules

## Testing Migration

For each test file in __tests__/**, specify:
- Original test file
- New location in backend/test/
- Required mocking changes
- Dependency updates

## Success Criteria

- [ ] All 100 API routes converted to Nest.js controllers
- [ ] All 96 library files converted to Nest.js services
- [ ] CORS working between localhost:3000 and localhost:5000
- [ ] Docker image builds successfully
- [ ] All tests passing
- [ ] Redis caching functional
- [ ] Background jobs running

Please start with Phase 1 and proceed through each phase systematically. For each phase, provide:
1. Exact commands to run
2. Complete file contents (not snippets)
3. Explanation of key decisions
4. Common pitfalls to avoid
```

---

## How to Use This Prompt

1. **Copy the prompt** from the code block above
2. **Open Claude Code (web)** at https://claude.ai
3. **Paste the prompt** and submit
4. **Follow the step-by-step guide** that Claude Code generates
5. **Iterate as needed** - ask follow-up questions for specific modules

## Expected Output

Claude Code should generate:

1. **Complete project structure** with all directories and files
2. **Detailed conversion guide** for each module
3. **Code examples** for controllers, services, DTOs
4. **Docker configuration** for containerization
5. **Test migration strategy** for the 93 backend tests
6. **Deployment instructions** for Railway

## Additional Context Files

Reference these files for complete backend file lists:
- `docs/files-completion-list/backend-logic-pages.md` - 196 backend files
- `docs/files-completion-list/test-files.md` - 129 test files
- `monolith-to-modular-monolith-migration/monolith-to-modular-monolith-migration.md` - Full migration plan

---

*Generated: 2026-01-09*
*Migration Step: 5 of 8*
*Target: Next.js → Nest.js Backend Conversion*
