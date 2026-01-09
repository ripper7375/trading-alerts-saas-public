# Step 5: Next.js to Nest.js Backend Conversion - Claude Code Prompt

## Overview

This prompt guides Claude Code (web) through **Step 5** of the Modular Monolith Migration: Converting the Next.js backend logic to Nest.js with CORS enabled, then dockerizing as a single application.

**Key migrations included:**
- **Code**: Next.js API routes → Nest.js modules
- **Database**: Railway PostgreSQL → Timescale Cloud (PostgreSQL + TimescaleDB)
- **Cache**: Railway Redis → Upstash Redis
- **Deployment**: Vercel serverless → Railway Docker container
- **Archive**: Old Next.js backend files → `archive/` folder for reference

---

## Context for Claude Code

### Project Background

We are migrating a Trading Alerts SaaS application from a **Monolithic Architecture** (Next.js full-stack on Vercel) to a **Modular Monolith Architecture**:

| Component | Monolith (Current) | Modular Monolith (Target) |
|-----------|-------------------|---------------------------|
| Frontend | Next.js on Vercel | Next.js on Vercel (UI only) |
| Backend | Next.js API routes on Vercel | Nest.js on Railway (Dockerized) |
| Database | Railway PostgreSQL | Timescale Cloud (PostgreSQL + TimescaleDB) |
| Cache | Railway Redis | Upstash Redis |
| Cost | ~$35-90/month | ~$75-155/month |

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
- Connected to Timescale Cloud and Upstash Redis

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

## Infrastructure Migrations

### Database Migration: Railway PostgreSQL → Timescale Cloud

**Current (Monolith):**
- Provider: Railway PostgreSQL
- Type: Standard PostgreSQL 15
- Connection: Direct connection string
- Cost: ~$5-20/month

**Target (Modular Monolith):**
- Provider: Timescale Cloud
- Type: PostgreSQL 15 + TimescaleDB extension
- Features: Hypertables for time-series data
- Cost: ~$25-50/month

**Migration Tasks:**
1. Create Timescale Cloud account and service
2. Export data from Railway PostgreSQL using pg_dump
3. Import data to Timescale Cloud
4. Enable TimescaleDB extension
5. Convert time-series tables to hypertables:
   - market_data → hypertable (chunk: 1 day)
   - indicator_fractals → hypertable (chunk: 1 day)
   - indicator_lines → hypertable (chunk: 1 day)
   - indicator_pro → hypertable (chunk: 1 day)
   - user_activity_logs → hypertable (chunk: 7 days)
6. Add compression policies for old data
7. Add retention policies for log data
8. Create continuous aggregates for analytics
9. Update DATABASE_URL in environment variables

**Timescale Cloud Connection String Format:**
```
postgresql://[user]:[password]@[host].tsdb.cloud.timescale.com:[port]/[database]?sslmode=require
```

**SQL for Hypertable Conversion:**
```sql
-- Enable TimescaleDB
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Convert market_data to hypertable
SELECT create_hypertable('market_data', 'timestamp',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- Add compression policy (compress data older than 7 days)
SELECT add_compression_policy('market_data', INTERVAL '7 days');

-- Add retention policy (delete data older than 90 days for logs)
SELECT add_retention_policy('user_activity_logs', INTERVAL '90 days');

-- Create continuous aggregate for hourly market data
CREATE MATERIALIZED VIEW market_data_hourly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', timestamp) AS hour,
  symbol,
  timeframe,
  first(open, timestamp) AS open,
  max(high) AS high,
  min(low) AS low,
  last(close, timestamp) AS close,
  sum(volume) AS volume
FROM market_data
GROUP BY hour, symbol, timeframe;
```

### Cache Migration: Railway Redis → Upstash Redis

**Current (Monolith):**
- Provider: Railway Redis
- Type: Self-managed Redis instance
- Connection: Standard Redis URL
- Cost: ~$5-10/month

**Target (Modular Monolith):**
- Provider: Upstash Redis
- Type: Serverless Redis
- Features: REST API, Global replication, Pay-per-request
- Cost: ~$5-10/month (pay-per-use)

**Migration Tasks:**
1. Create Upstash account and Redis database
2. Choose region (closest to Railway deployment)
3. Enable TLS for secure connections
4. Export existing cache keys from Railway (if needed)
5. Update REDIS_URL in environment variables
6. Update Redis client configuration for TLS

**Upstash Connection String Format:**
```
redis://default:[password]@[endpoint].upstash.io:[port]
```

**Or with TLS:**
```
rediss://default:[password]@[endpoint].upstash.io:[port]
```

**Upstash-specific Configuration:**
```typescript
// backend/src/redis/redis.module.ts
import { Module, Global } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-ioredis-yet';
import { ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        store: await redisStore({
          url: config.get('REDIS_URL'),
          // Upstash requires TLS
          tls: config.get('REDIS_URL')?.startsWith('rediss://')
            ? {}
            : undefined,
          // Connection settings optimized for Upstash
          maxRetriesPerRequest: 3,
          retryDelayOnFailover: 100,
          enableReadyCheck: false,
          connectTimeout: 10000,
        }),
        ttl: 300, // Default 5 minutes
      }),
    }),
  ],
  exports: [CacheModule],
})
export class RedisModule {}
```

**Bull Queue Configuration for Upstash:**
```typescript
// backend/src/app.module.ts
BullModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const redisUrl = new URL(config.get('REDIS_URL'));
    return {
      redis: {
        host: redisUrl.hostname,
        port: parseInt(redisUrl.port),
        password: redisUrl.password,
        tls: redisUrl.protocol === 'rediss:' ? {} : undefined,
      },
    };
  },
}),
```

### Archiving Old Next.js Backend Files

Before converting to Nest.js, archive all old Next.js backend files for reference and rollback capability.

**Repository Structure Context (After Step 4):**
```
trading-alerts-saas-public/
├── app/                    # EXISTING - DO NOT MODIFY (monolith)
│   ├── api/                # ← BACKEND LOGIC (to be archived & converted)
│   ├── (auth)/             # Frontend pages (stays in monolith until cleanup)
│   ├── (dashboard)/        # Frontend pages
│   └── ...
├── components/             # EXISTING - DO NOT MODIFY (monolith)
├── lib/                    # EXISTING - DO NOT MODIFY (monolith)
│   ├── auth/               # ← BACKEND LOGIC (to be archived & converted)
│   ├── db/                 # ← BACKEND LOGIC
│   ├── cache/              # ← BACKEND LOGIC
│   ├── stripe/             # ← BACKEND LOGIC
│   ├── dlocal/             # ← BACKEND LOGIC
│   ├── affiliate/          # ← BACKEND LOGIC
│   ├── disbursement/       # ← BACKEND LOGIC
│   ├── utils.ts            # Shared (may be used by both)
│   └── ...
├── __tests__/              # Test files
│   ├── api/                # ← BACKEND TESTS (to be archived)
│   ├── lib/                # ← BACKEND TESTS (to be archived)
│   ├── integration/        # ← BACKEND TESTS (to be archived)
│   └── components/         # Frontend tests (stay)
│
├── frontend/               # NEW (Step 4) - Fresh Vercel deployment
│   ├── app/                # Copied + refactored Server Components
│   ├── components/
│   │   ├── readable/       # Server Components (0 KB JS)
│   │   └── interactive/    # Client Components (minimal JS)
│   ├── lib/                # Frontend-only utilities
│   ├── next.config.js      # Frontend-specific config
│   └── vercel.json         # Vercel deployment config
│
├── backend/                # NEW (Step 5) - Nest.js on Railway
│   └── (to be created)
│
└── archive/                # Archive folder for old files
    └── step5-nextjs-backend/   # ← OLD BACKEND LOGIC GOES HERE
```

**Archive Folder Structure:**
```
archive/
├── step5-nextjs-backend/           # Archived on: YYYY-MM-DD
│   ├── README.md                   # Archive metadata and reason
│   ├── app/
│   │   └── api/                    # All 100 API route files
│   │       ├── auth/
│   │       ├── user/
│   │       ├── indicators/
│   │       ├── watchlist/
│   │       ├── alerts/
│   │       ├── checkout/
│   │       ├── payments/
│   │       ├── affiliate/
│   │       ├── admin/
│   │       ├── disbursement/
│   │       ├── webhooks/
│   │       ├── cron/
│   │       ├── notifications/
│   │       └── cache/
│   ├── lib/                        # All 96 backend library files
│   │   ├── auth/
│   │   ├── db/
│   │   ├── cache/
│   │   ├── stripe/
│   │   ├── dlocal/
│   │   ├── affiliate/
│   │   ├── disbursement/
│   │   ├── tier/
│   │   ├── email/
│   │   ├── jobs/
│   │   ├── cron/
│   │   └── ...
│   └── __tests__/                  # All 93 backend test files
│       ├── api/
│       ├── lib/
│       └── integration/
```

**Archive README Template:**
```markdown
# Archive: Next.js Backend Files

**Archived Date:** YYYY-MM-DD
**Archived By:** [Developer Name]
**Migration Step:** Step 5 - Next.js to Nest.js Conversion

## Reason for Archive

These files were archived as part of the Modular Monolith migration.
The Next.js backend (API routes + library files) has been converted to
a Nest.js backend deployed on Railway.

## Repository Structure After Step 5

After this migration, the repository structure will be:

```
trading-alerts-saas-public/
├── frontend/               # Vercel (Next.js UI only)
├── backend/                # Railway (Nest.js API + business logic)
├── archive/
│   └── step5-nextjs-backend/   # This archive
└── (old monolith files to be cleaned up in Step 11)
```

## Contents

- `app/api/` - 100 Next.js API route files
- `lib/` - 96 library/service files (backend-specific)
- `__tests__/` - 93 backend test files

## Restoration

If rollback is needed:

1. Copy files back to their original locations
2. Update package.json dependencies
3. Revert environment variables
4. Redeploy to Vercel

## Related Documentation

- Migration Plan: `monolith-to-modular-monolith-migration/`
- New Frontend: `frontend/` (Next.js on Vercel)
- New Backend: `backend/` (Nest.js on Railway)
- Step 5 Prompt: `step5-nextjs-to-nestjs-conversion-prompt.md`
```

**Archive Commands:**
```bash
# Create archive directory structure
mkdir -p archive/step5-nextjs-backend/app
mkdir -p archive/step5-nextjs-backend/__tests__

# Archive API routes (preserve directory structure)
cp -r app/api archive/step5-nextjs-backend/app/

# Archive backend library files (all of lib/ contains backend logic)
cp -r lib archive/step5-nextjs-backend/

# Archive backend tests only (not component tests)
cp -r __tests__/api archive/step5-nextjs-backend/__tests__/
cp -r __tests__/lib archive/step5-nextjs-backend/__tests__/
cp -r __tests__/integration archive/step5-nextjs-backend/__tests__/

# Create archive README
cat > archive/step5-nextjs-backend/README.md << 'EOF'
# Archive: Next.js Backend Files
... (content from template above)
EOF

# Commit archive
git add archive/step5-nextjs-backend/
git commit -m "archive: preserve Next.js backend files before Nest.js migration"
```

**Files to Archive (Summary):**

| Category | File Count | Source Path | Archive Path |
|----------|------------|-------------|--------------|
| API Routes | 100 | `app/api/**/*.ts` | `archive/step5-nextjs-backend/app/api/` |
| Library Files | 96 | `lib/**/*.ts` | `archive/step5-nextjs-backend/lib/` |
| Backend Tests | 93 | `__tests__/{api,lib,integration}/**` | `archive/step5-nextjs-backend/__tests__/` |
| **Total** | **289** | | |

**What Gets Archived vs What Stays:**

| Location | Content | Action |
|----------|---------|--------|
| `app/api/**` | API routes | Archive → Convert to `backend/` |
| `app/(pages)/**` | Frontend pages | Stay in monolith → Already in `frontend/` |
| `lib/**` | Backend services | Archive → Convert to `backend/` |
| `components/**` | UI components | Stay in monolith → Already in `frontend/` |
| `__tests__/api/**` | API tests | Archive → Convert to `backend/test/` |
| `__tests__/lib/**` | Library tests | Archive → Convert to `backend/test/` |
| `__tests__/components/**` | Component tests | Stay → Already in `frontend/` |

**Important Notes:**
- Archive BEFORE deleting any files from the main codebase
- Keep archive for at least 6 months after migration completion
- Archive is for reference only - do not modify archived files
- Archive can be used for rollback if migration fails
- The `frontend/` folder (Step 4) is separate and NOT archived here

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
│   ├── prisma/                     # Database (Timescale Cloud)
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── redis/                      # Caching (Upstash)
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
│   ├── schema.prisma
│   └── migrations/
│       └── YYYYMMDD_create_hypertables/
│           └── migration.sql       # TimescaleDB hypertables
├── test/                           # Tests (93 files to convert)
├── Dockerfile
├── docker-compose.yml
├── railway.toml                    # Railway deployment config
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

### 4. Database Layer (Timescale Cloud)

- Prisma for ORM with TimescaleDB
- Connection pooling with PgBouncer
- Hypertables for time-series data
- Continuous aggregates for analytics

### 5. Caching Layer (Upstash Redis)

- Redis with @nestjs/cache-manager
- TLS connection for Upstash
- Cache indicators and confluence scores
- Rate limiting with Redis
- Bull Queue for background jobs

### 6. Background Jobs

- Bull Queue for async jobs (uses Upstash Redis)
- Scheduled tasks with @nestjs/schedule

### 7. Docker Configuration

```dockerfile
# backend/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Start application
CMD ["node", "dist/main"]
```

### 8. Railway Deployment Configuration

```toml
# backend/railway.toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "node dist/main"
healthcheckPath = "/api/health"
healthcheckTimeout = 30
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3

[environments]
  [environments.production]
    PORT = "5000"
```

**Railway Environment Variables:**
```bash
# Database (Timescale Cloud)
DATABASE_URL=postgresql://user:password@host.tsdb.cloud.timescale.com:port/db?sslmode=require

# Cache (Upstash Redis)
REDIS_URL=rediss://default:password@endpoint.upstash.io:port

# Authentication
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=7d

# External Services
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SENDGRID_API_KEY=SG...
DLOCAL_API_KEY=...
DLOCAL_SECRET_KEY=...
RISEWORKS_API_KEY=...

# CORS
FRONTEND_URL=https://yourdomain.com
VERCEL_PREVIEW_URL=https://*.vercel.app

# Server
PORT=5000
NODE_ENV=production
```

### 9. Docker Compose for Local Development

```yaml
# backend/docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - '5000:5000'
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/trading_alerts?sslmode=disable
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=local-dev-secret-key-min-32-characters
      - JWT_EXPIRES_IN=7d
      - NODE_ENV=development
      - PORT=5000
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - ./src:/app/src:ro
    command: npm run start:dev

  postgres:
    image: timescale/timescaledb:latest-pg15
    ports:
      - '5432:5432'
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=trading_alerts
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## Deliverables

Please provide a step-by-step guide that covers:

1. **Phase 1: Project Setup**
   - Initialize Nest.js project
   - Install dependencies (including Timescale/Upstash clients)
   - Configure TypeScript
   - Set up folder structure

2. **Phase 2: Archive Old Next.js Files**
   - Create archive directory structure
   - Archive all 100 API route files (`app/api/**`)
   - Archive all 96 library files (`lib/**`)
   - Archive all 93 backend test files (`__tests__/{api,lib,integration}/**`)
   - Create archive README with metadata
   - Commit archive to repository
   - Verify archive completeness (289 files total)

3. **Phase 3: Database Migration (Railway → Timescale Cloud)**
   - Create Timescale Cloud service
   - Export data from Railway PostgreSQL
   - Import data to Timescale Cloud
   - Enable TimescaleDB extension
   - Convert tables to hypertables
   - Set up compression and retention policies
   - Create continuous aggregates
   - Update Prisma schema for TimescaleDB

4. **Phase 4: Cache Migration (Railway Redis → Upstash)**
   - Create Upstash Redis database
   - Configure TLS connection
   - Update Redis client for Upstash
   - Configure Bull Queue for Upstash
   - Test connection and performance

5. **Phase 5: Core Infrastructure**
   - Prisma module setup (Timescale Cloud)
   - Redis module setup (Upstash)
   - Configuration module
   - Common utilities (guards, interceptors, filters)

6. **Phase 6: Authentication Module**
   - JWT strategy
   - Local strategy
   - Auth guards
   - Session management
   - 2FA support

7. **Phase 7: Domain Modules**
   For each module, specify:
   - File mapping (Next.js → Nest.js)
   - Controller structure
   - Service methods
   - DTOs
   - Dependencies

8. **Phase 8: Background Jobs**
   - Bull Queue setup (with Upstash Redis)
   - Scheduled tasks
   - Cron job migration

9. **Phase 9: Testing**
   - Test file migration strategy
   - Jest configuration for Nest.js
   - E2E test setup

10. **Phase 10: Docker & Railway Deployment**
    - Dockerfile (multi-stage build)
    - docker-compose.yml for local dev
    - railway.toml configuration
    - Environment variables setup
    - Health check endpoints
    - Deployment checklist

11. **Phase 11: Cleanup & Verification**
    - Remove old Next.js backend files from main codebase
    - Update package.json (remove unused dependencies)
    - Verify archive is intact
    - Final testing against archive reference

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

## Railway Deployment Checklist

Before deploying to Railway:

1. **Pre-deployment:**
   - [ ] Timescale Cloud database created and configured
   - [ ] Upstash Redis database created
   - [ ] All environment variables documented
   - [ ] Dockerfile tested locally
   - [ ] Health check endpoint working

2. **Railway Setup:**
   - [ ] Create new Railway project
   - [ ] Connect GitHub repository
   - [ ] Configure build settings (Dockerfile)
   - [ ] Add all environment variables
   - [ ] Configure custom domain (optional)
   - [ ] Set up deployment triggers

3. **Post-deployment:**
   - [ ] Verify health check passes
   - [ ] Test CORS with frontend (localhost:3000)
   - [ ] Verify database connectivity
   - [ ] Verify Redis connectivity
   - [ ] Test all API endpoints
   - [ ] Monitor logs for errors

## Success Criteria

**Archive:**
- [ ] All 289 Next.js backend files archived to `archive/step5-nextjs-backend/`
- [ ] Archive README created with metadata
- [ ] Archive committed to repository

**Code Conversion:**
- [ ] All 100 API routes converted to Nest.js controllers
- [ ] All 96 library files converted to Nest.js services
- [ ] All 93 backend tests migrated to Nest.js test structure

**Infrastructure Migration:**
- [ ] Database migrated to Timescale Cloud with hypertables
- [ ] Cache migrated to Upstash Redis with TLS
- [ ] TimescaleDB compression policies configured
- [ ] Continuous aggregates created for analytics

**Deployment:**
- [ ] CORS working between localhost:3000 and localhost:5000
- [ ] Docker image builds successfully
- [ ] Railway deployment successful
- [ ] Health check endpoint responding

**Verification:**
- [ ] All tests passing
- [ ] Redis caching functional
- [ ] Background jobs running
- [ ] Old Next.js backend files removed from main codebase
- [ ] Archive intact and accessible for rollback

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

1. **Archive setup guide** for old Next.js backend files (289 files)
2. **Complete project structure** with all directories and files
3. **Database migration guide** (Railway PostgreSQL → Timescale Cloud)
4. **Cache migration guide** (Railway Redis → Upstash)
5. **Detailed conversion guide** for each module
6. **Code examples** for controllers, services, DTOs
7. **Docker configuration** for containerization
8. **Railway deployment configuration** and checklist
9. **Test migration strategy** for the 93 backend tests
10. **Cleanup guide** for removing old files after migration

## Additional Context Files

Reference these files for complete backend file lists:
- `docs/files-completion-list/backend-logic-pages.md` - 196 backend files
- `docs/files-completion-list/test-files.md` - 129 test files
- `monolith-to-modular-monolith-migration/monolith-to-modular-monolith-migration.md` - Full migration plan

---

## Quick Reference: Infrastructure URLs

| Service | Monolith | Modular Monolith |
|---------|----------|------------------|
| Database Console | Railway Dashboard | https://console.cloud.timescale.com |
| Redis Console | Railway Dashboard | https://console.upstash.com |
| Backend Deploy | Vercel | https://railway.app |
| Frontend Deploy | Vercel | Vercel (unchanged) |

---

*Generated: 2026-01-09*
*Migration Step: 5 of 8*
*Target: Next.js → Nest.js Backend Conversion + Infrastructure Migration*
