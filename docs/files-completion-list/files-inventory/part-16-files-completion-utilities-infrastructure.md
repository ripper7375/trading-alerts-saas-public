# Part 16: Utilities & Infrastructure - List of Files Completion

**Last Updated:** 2026-08-04
**Status:** ✅ Complete (100%)

---

## 📊 Overview

Part 16 encompasses all core utility libraries, database singletons, authentication helpers, operational feature flags, validation schemas, caching services, email delivery templates, configuration files, scripts, and deployment infrastructure powering the Trading Alerts SaaS platform.

---

## 📋 Comprehensive File Inventory By Category

### Category 1: Core Utilities (6 Files)

| #   | File Path                       | Status   | Description                                                    |
| --- | ------------------------------- | -------- | -------------------------------------------------------------- |
| 1   | ✅ `lib/logger.ts`              | Complete | Centralized logging utility                                    |
| 2   | ✅ `lib/utils.ts`               | Complete | General UI utility functions (`cn` helper, class name mergers) |
| 3   | ✅ `lib/csrf.ts`                | Complete | CSRF token protection utilities                                |
| 4   | ✅ `lib/rate-limit.ts`          | Complete | API rate limiting helper                                       |
| 5   | ✅ `lib/tokens.ts`              | Complete | Random token generation and verification utilities             |
| 6   | ✅ `lib/candle-data-helpers.ts` | Complete | OHLCV candle formatting helpers                                |

---

### Category 2: Database Utilities & Dual Schemas (5 Files)

| #   | File Path                                 | Status   | Description                                                                                |
| --- | ----------------------------------------- | -------- | ------------------------------------------------------------------------------------------ |
| 7   | ✅ `lib/db/prisma.ts`                     | Complete | Primary Prisma client singleton (`prisma` targeting `non-market-data/schema.prisma`)       |
| 8   | ✅ `lib/db/market-prisma.ts`              | Complete | Market data Prisma client singleton (`marketPrisma` targeting `market-data/schema.prisma`) |
| 9   | ✅ `lib/db/seed.ts`                       | Complete | Seed script for system configurations and initial admin user                               |
| 10  | ✅ `prisma/non-market-data/schema.prisma` | Complete | Core relational database schema (User, Session, Alert, Subscription, Affiliate, etc.)      |
| 11  | ✅ `prisma/market-data/schema.prisma`     | Complete | Market data schema (`market_data_v6` 79-column table)                                      |

---

### Category 3: Authentication & Auth Bridge Utilities (7 Files)

| #   | File Path                         | Status   | Description                                                                |
| --- | --------------------------------- | -------- | -------------------------------------------------------------------------- |
| 12  | ✅ `lib/auth/auth-options.ts`     | Complete | NextAuth.js configuration (Credentials, OAuth, callbacks, 2FA enforcement) |
| 13  | ✅ `lib/auth/session.ts`          | Complete | Server session retrieval and token verification helpers                    |
| 14  | ✅ `lib/auth/session-tracker.ts`  | Complete | Session and device tracking service (`user_sessions`, `login_history`)     |
| 15  | ✅ `lib/auth/permissions.ts`      | Complete | Role and tier permissions matrix (PRO-exclusive alerts, MTF, line alerts)  |
| 16  | ✅ `lib/auth/errors.ts`           | Complete | Authentication error handling and custom error classes                     |
| 17  | ✅ `lib/auth/two-factor.ts`       | Complete | 2FA TOTP secret generation, QR code SVG rendering, and backup codes        |
| 18  | ✅ `lib/auth/auth-bridge-flag.ts` | Complete | Feature flag helper for operation-service auth bridge delegation           |

---

### Category 4: Operation Service Decoupling Bridge (3 Files)

| #   | File Path                                  | Status   | Description                                                                                                  |
| --- | ------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------ |
| 19  | ✅ `lib/operation-service/client.ts`       | Complete | Operation service client & session Bearer token retriever (`getOperationServiceToken`)                       |
| 20  | ✅ `lib/operation-service/flags.ts`        | Complete | Feature flags for operation service route delegation (`shouldUseOperationServiceForMarketDataChannel`, etc.) |
| 21  | ✅ `lib/operation-service/write-routes.ts` | Complete | HTTP request forwarder (`forwardRequestToOperationService`) for write-route migration                        |

---

### Category 5: Tier System Utilities (3 Files)

| #   | File Path                   | Status   | Description                                                                      |
| --- | --------------------------- | -------- | -------------------------------------------------------------------------------- |
| 22  | ✅ `lib/tier-config.ts`     | Complete | Canonical tier definitions (V8: `XAUUSD`, `M5`/`M15` for both tiers)             |
| 23  | ✅ `lib/tier-validation.ts` | Complete | Tier validation logic (`canAccessSymbol`, `canAccessTimeframe`, `getTierLimits`) |
| 24  | ✅ `lib/tier-helpers.ts`    | Complete | Tier helper utility functions                                                    |

_(Note: `lib/tier/constants.ts`, `lib/tier/validator.ts`, and `lib/tier/index.ts` were deleted 2026-07-08 as dead code)_

---

### Category 6: Error Handling (3 Files)

| #   | File Path                        | Status   | Description                                                                 |
| --- | -------------------------------- | -------- | --------------------------------------------------------------------------- |
| 25  | ✅ `lib/errors/api-error.ts`     | Complete | Custom API error classes (`ApiError`, `NotFoundError`, `UnauthorizedError`) |
| 26  | ✅ `lib/errors/error-handler.ts` | Complete | Centralized API error response handler                                      |
| 27  | ✅ `lib/errors/error-logger.ts`  | Complete | Error logging and tracking service                                          |

---

### Category 7: Validation Schemas (`lib/validations/`, 3 Files)

| #   | File Path                     | Status   | Description                                                                     |
| --- | ----------------------------- | -------- | ------------------------------------------------------------------------------- |
| 28  | ✅ `lib/validations/auth.ts`  | Complete | Authentication Zod schemas (Login, Register, Password Reset)                    |
| 29  | ✅ `lib/validations/alert.ts` | Complete | Alert Zod schemas (`createAlertSchema`, `updateAlertSchema`, `lineAlertSchema`) |
| 30  | ✅ `lib/validations/user.ts`  | Complete | User profile and preferences Zod schemas                                        |

_(Note: `lib/validations/watchlist.ts` was deleted 2026-07-07 when Watchlist was decommissioned)_

---

### Category 8: Cache & Redis (2 Files)

| #   | File Path                       | Status   | Description                                         |
| --- | ------------------------------- | -------- | --------------------------------------------------- |
| 31  | ✅ `lib/redis/client.ts`        | Complete | Redis client configuration and connection singleton |
| 32  | ✅ `lib/cache/cache-manager.ts` | Complete | Response caching manager for API endpoints          |

---

### Category 9: Email Services & Templates (11 Files)

| #   | File Path                                                | Status   | Description                                                     |
| --- | -------------------------------------------------------- | -------- | --------------------------------------------------------------- |
| 33  | ✅ `lib/email/email.ts`                                  | Complete | Resend SDK email delivery service                               |
| 34  | ✅ `lib/email/subscription-emails.ts`                    | Complete | Subscription welcome, renewal, and cancellation email templates |
| 35  | ✅ `lib/email/templates/affiliate/code-distributed.tsx`  | Complete | Code distribution email template                                |
| 36  | ✅ `lib/email/templates/affiliate/code-used.tsx`         | Complete | Code redemption notification template                           |
| 37  | ✅ `lib/email/templates/affiliate/monthly-report.tsx`    | Complete | Monthly affiliate report template                               |
| 38  | ✅ `lib/email/templates/affiliate/payment-processed.tsx` | Complete | Payout confirmation template                                    |
| 39  | ✅ `lib/email/templates/affiliate/welcome.tsx`           | Complete | Affiliate onboarding welcome template                           |
| 40  | ✅ `emails/index.ts`                                     | Complete | Email templates index exporter                                  |
| 41  | ✅ `emails/payment-confirmation.tsx`                     | Complete | Payment confirmation email                                      |
| 42  | ✅ `emails/payment-failure.tsx`                          | Complete | Payment failure alert email                                     |
| 43  | ✅ `emails/renewal-reminder.tsx`                         | Complete | Subscription renewal reminder email                             |

---

### Category 10: Utility Functions (3 Files)

| #   | File Path                    | Status   | Description                                     |
| --- | ---------------------------- | -------- | ----------------------------------------------- |
| 44  | ✅ `lib/utils/helpers.ts`    | Complete | General helper functions                        |
| 45  | ✅ `lib/utils/formatters.ts` | Complete | Currency, date, time, and percentage formatters |
| 46  | ✅ `lib/utils/constants.ts`  | Complete | Application-wide constants                      |

---

### Category 11: API Utilities (1 File)

| #   | File Path             | Status   | Description              |
| --- | --------------------- | -------- | ------------------------ |
| 47  | ✅ `lib/api/index.ts` | Complete | Main API utility exports |

_(Note: `lib/api/mt5-client.ts` and `lib/api/mt5-transform.ts` were deleted 2026-07-08 as dead code)_

---

### Category 12: React Hooks (7 Files)

| #   | File Path                             | Status   | Description                         |
| --- | ------------------------------------- | -------- | ----------------------------------- |
| 48  | ✅ `hooks/use-alerts.ts`              | Complete | Alert state and CRUD hook           |
| 49  | ✅ `hooks/use-auth.ts`                | Complete | Session authentication hook         |
| 50  | ✅ `hooks/use-login-tracking.ts`      | Complete | Device and session tracking hook    |
| 51  | ✅ `hooks/use-optimistic-mutation.ts` | Complete | Optimistic UI mutation helper hook  |
| 52  | ✅ `hooks/use-toast.ts`               | Complete | Toast notification dispatcher hook  |
| 53  | ✅ `hooks/use-websocket.ts`           | Complete | Socket.IO real-time connection hook |
| 54  | ✅ `lib/hooks/useAffiliateConfig.ts`  | Complete | Affiliate configuration hook        |

_(Note: `hooks/use-watchlist.ts` and `hooks/use-indicators.ts` were deleted as dead code)_

---

### Category 13: Type Definitions (11 Files)

| #   | File Path                    | Status   | Description                                     |
| --- | ---------------------------- | -------- | ----------------------------------------------- |
| 55  | ✅ `types/index.ts`          | Complete | Type exports index                              |
| 56  | ✅ `types/alert.ts`          | Complete | Alert TypeScript interfaces                     |
| 57  | ✅ `types/api.ts`            | Complete | Standard API response types                     |
| 58  | ✅ `types/disbursement.ts`   | Complete | Disbursement and payout types                   |
| 59  | ✅ `types/dlocal.ts`         | Complete | dLocal payment types                            |
| 60  | ✅ `types/indicator.ts`      | Complete | Indicator and `MarketDataV6` types (79 columns) |
| 61  | ✅ `types/next-auth.d.ts`    | Complete | NextAuth module augmentations                   |
| 62  | ✅ `types/payment.ts`        | Complete | Stripe & general payment types                  |
| 63  | ✅ `types/prisma-stubs.d.ts` | Complete | Prisma model type stubs                         |
| 64  | ✅ `types/tier.ts`           | Complete | Tier system type definitions                    |
| 65  | ✅ `types/user.ts`           | Complete | User profile & session types                    |

_(Note: `types/watchlist.ts` was deleted 2026-07-07 when Watchlist was decommissioned)_

---

### Category 14: Constants & Business Rules (1 File)

| #   | File Path                            | Status   | Description                                       |
| --- | ------------------------------------ | -------- | ------------------------------------------------- |
| 66  | ✅ `lib/constants/business-rules.ts` | Complete | Business rules constants (tier boundaries, rates) |

---

### Category 15: Cron Jobs & Background Jobs (5 Files)

| #   | File Path                                        | Status   | Description                                                                           |
| --- | ------------------------------------------------ | -------- | ------------------------------------------------------------------------------------- |
| 67  | ✅ `lib/cron/check-expiring-subscriptions.ts`    | Complete | Subscription expiration warning checker                                               |
| 68  | ✅ `lib/cron/downgrade-expired-subscriptions.ts` | Complete | Expired subscription downgrade processor                                              |
| 69  | ✅ `lib/cron/monthly-distribution.ts`            | Complete | Monthly affiliate commission distribution job                                         |
| 70  | ✅ `lib/jobs/alert-checker.ts`                   | Complete | Background price alert checking job (reads `market_data_v6` first, with MT5 fallback) |
| 71  | ✅ `lib/jobs/queue.ts`                           | Complete | Job queue execution manager                                                           |

---

### Category 16: Real-Time WebSocket Infrastructure (1 File)

| #   | File Path                    | Status   | Description                                                       |
| --- | ---------------------------- | -------- | ----------------------------------------------------------------- |
| 72  | ✅ `lib/websocket/server.ts` | Complete | Next.js Socket.IO server setup, room management, and broadcasting |

_(Note: `lib/websocket/use-mt5-websocket.ts` was deleted 2026-07-08 as dead code)_

---

### Category 17: Security, Fraud & Geo (4 Files)

| #   | File Path                                 | Status   | Description                               |
| --- | ----------------------------------------- | -------- | ----------------------------------------- |
| 73  | ✅ `lib/security/device-detection.ts`     | Complete | Device and browser fingerprinting service |
| 74  | ✅ `lib/fraud/fraud-detection.service.ts` | Complete | Fraud pattern detection service           |
| 75  | ✅ `lib/monitoring/system-monitor.ts`     | Complete | System health monitoring service          |
| 76  | ✅ `lib/geo/detect-country.ts`            | Complete | Geolocation country detection service     |

---

### Category 18: User Preferences (1 File)

| #   | File Path                        | Status   | Description                               |
| --- | -------------------------------- | -------- | ----------------------------------------- |
| 77  | ✅ `lib/preferences/defaults.ts` | Complete | Default user preferences and sanitization |

---

### Category 19: Middleware & Infrastructure (6 Files)

| #   | File Path                       | Status   | Description                                 |
| --- | ------------------------------- | -------- | ------------------------------------------- |
| 78  | ✅ `middleware/tier-check.ts`   | Complete | Tier access control middleware              |
| 79  | ✅ `app/layout.tsx`             | Complete | Application root layout wrapper             |
| 80  | ✅ `app/globals.css`            | Complete | Global CSS styles and Tailwind utilities    |
| 81  | ✅ `app/error.tsx`              | Complete | Global application error boundary component |
| 82  | ✅ `app/(marketing)/layout.tsx` | Complete | Marketing pages layout                      |
| 83  | ✅ `app/(marketing)/page.tsx`   | Complete | Marketing landing page                      |

---

### Category 20: Build & Config Files (6 Files)

| #   | File Path               | Status   | Description                              |
| --- | ----------------------- | -------- | ---------------------------------------- |
| 84  | ✅ `next.config.js`     | Complete | Next.js build configuration              |
| 85  | ✅ `tailwind.config.ts` | Complete | Tailwind CSS design system configuration |
| 86  | ✅ `postcss.config.js`  | Complete | PostCSS plugin configuration             |
| 87  | ✅ `jest.config.js`     | Complete | Jest test runner configuration           |
| 88  | ✅ `tsconfig.json`      | Complete | TypeScript compiler configuration        |
| 89  | ✅ `components.json`    | Complete | shadcn/ui component configuration        |

---

### Category 21: CI/CD Workflows, Docker & Scripts (32 Files)

- **GitHub Workflows (11 files):** `.github/workflows/*.yml` (tests, deploy, api-tests, bundle-monitor, ci-nextjs-progressive, dependencies-security, e2e-tests, load-test, mt5-pipeline-tests, openapi-validation, security-checks)
- **Docker & Deployment (3 files):** `docker-compose.yml`, `.dockerignore`, `public/manifest.json`
- **Scripts (18 files):** `scripts/*` (validate-file.js, validate_sqlite.py, health-check-ui.js, monitor-mt5-pipeline.ts, test-mt5-deployment.ts, test-prisma5-upgrade.ts, run-all-tests.sh, collect-metrics.sh, check-sync-needed.js, check-coverage.js, archive-docs.sh, deploy-part20.sh, sync-frontend.sh, setup-e2e.sh, rollback-to-part6.sh, verify-alignment.sh, verify-build-orders.sh)

---

## 📊 Status Summary

- **Total Production Files:** 121/121 (100%)
- **Core, DB, Auth & Operation Service Libs:** 21 files
- **Tier, Error, Validations & Cache:** 11 files
- **Email, Utils, Hooks & Types:** 22 files
- **Cron Jobs, Security, Monitoring & WebSocket:** 13 files
- **App Infrastructure, Config & Build Files:** 22 files
- **Workflows, Docker & Scripts:** 32 files

---

## 🔗 Related Documentation

- **Database Schemas:** `docs/files-completion-list/files-inventory/part-02-files-completion-database-schema.md`
- **Authentication System:** `docs/files-completion-list/files-inventory/part-05-files-completion-authentication.md`
- **MarketDataV6 Data Pipeline:** `docs/files-completion-list/files-inventory/part-23-files-completion-v2_29_data_pipeline_architecture.md`

---

**Part 16 Status:** ✅ Complete and production-ready
