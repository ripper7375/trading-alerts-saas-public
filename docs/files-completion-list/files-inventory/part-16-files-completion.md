# Part 16: Utilities & Infrastructure - Files Completion List

**Last Updated:** 2026-01-24
**Total Files:** 118
**Status:** 117/118 Complete (99.2%)

---

## Overview

Part 16 encompasses all utility libraries, helper functions, infrastructure configurations, and supporting services that power the Trading Alerts SaaS platform. These components provide the foundation for authentication, validation, caching, error handling, email delivery, and deployment infrastructure.

---

## CATEGORY 1: Core Utilities (6 Files)

| #   | File Path                    | Status | Description                          |
| --- | ---------------------------- | ------ | ------------------------------------ |
| 1   | `lib/logger.ts`              | ✅     | Centralized logging utility          |
| 2   | `lib/utils.ts`               | ✅     | General utility functions (cn, etc.) |
| 3   | `lib/csrf.ts`                | ✅     | CSRF token protection                |
| 4   | `lib/rate-limit.ts`          | ✅     | API rate limiting implementation     |
| 5   | `lib/tokens.ts`              | ✅     | Token generation and validation      |
| 6   | `lib/candle-data-helpers.ts` | ✅     | Candle data formatting utilities     |

---

## CATEGORY 2: Database Utilities (4 Files)

| #   | File Path              | Status | Description                                         |
| --- | ---------------------- | ------ | --------------------------------------------------- |
| 7   | `lib/db/prisma.ts`     | ✅     | Prisma client singleton                             |
| 8   | `lib/db/seed.ts`       | ✅     | Database seeding functions                          |
| 9   | `prisma/schema.prisma` | ✅     | Complete database schema (57-column flat structure) |
| 10  | `prisma/seed.ts`       | ✅     | Database seed data script                           |

---

## CATEGORY 3: Authentication Utilities (6 Files)

| #   | File Path                     | Status | Description                   |
| --- | ----------------------------- | ------ | ----------------------------- |
| 11  | `lib/auth/auth-options.ts`    | ✅     | NextAuth.js configuration     |
| 12  | `lib/auth/session.ts`         | ✅     | Session management utilities  |
| 13  | `lib/auth/session-tracker.ts` | ✅     | Session tracking service      |
| 14  | `lib/auth/permissions.ts`     | ✅     | Permission management system  |
| 15  | `lib/auth/errors.ts`          | ✅     | Authentication error handling |
| 16  | `lib/auth/two-factor.ts`      | ✅     | 2FA implementation            |

---

## CATEGORY 4: Tier System (6 Files)

| #   | File Path                | Status | Description                        |
| --- | ------------------------ | ------ | ---------------------------------- |
| 17  | `lib/tier-config.ts`     | ✅     | Tier definitions and configuration |
| 18  | `lib/tier-validation.ts` | ✅     | Tier validation logic              |
| 19  | `lib/tier-helpers.ts`    | ✅     | Tier helper functions              |
| 20  | `lib/tier/constants.ts`  | ✅     | Tier constants                     |
| 21  | `lib/tier/validator.ts`  | ✅     | Tier validator implementation      |
| 22  | `lib/tier/index.ts`      | ✅     | Tier module exports                |

---

## CATEGORY 5: Error Handling (3 Files)

| #   | File Path                     | Status | Description               |
| --- | ----------------------------- | ------ | ------------------------- |
| 23  | `lib/errors/api-error.ts`     | ✅     | Custom API error classes  |
| 24  | `lib/errors/error-handler.ts` | ✅     | Centralized error handler |
| 25  | `lib/errors/error-logger.ts`  | ✅     | Error logging service     |

---

## CATEGORY 6: Validation Schemas (4 Files)

| #   | File Path                      | Status | Description                |
| --- | ------------------------------ | ------ | -------------------------- |
| 26  | `lib/validations/auth.ts`      | ✅     | Authentication Zod schemas |
| 27  | `lib/validations/alert.ts`     | ✅     | Alert input validation     |
| 28  | `lib/validations/watchlist.ts` | ✅     | Watchlist validation rules |
| 29  | `lib/validations/user.ts`      | ✅     | User profile validation    |

---

## CATEGORY 7: Cache & Redis (2 Files)

| #   | File Path                    | Status | Description                     |
| --- | ---------------------------- | ------ | ------------------------------- |
| 30  | `lib/redis/client.ts`        | ✅     | Redis client configuration      |
| 31  | `lib/cache/cache-manager.ts` | ✅     | Cache manager for API responses |

---

## CATEGORY 8: Email Services (11 Files)

| #   | File Path                                             | Status | Description                       |
| --- | ----------------------------------------------------- | ------ | --------------------------------- |
| 32  | `lib/email/email.ts`                                  | ✅     | Email sending service             |
| 33  | `lib/email/subscription-emails.ts`                    | ✅     | Subscription-related emails       |
| 34  | `lib/email/templates/affiliate/code-distributed.tsx`  | ✅     | Code distributed email template   |
| 35  | `lib/email/templates/affiliate/code-used.tsx`         | ✅     | Code used notification template   |
| 36  | `lib/email/templates/affiliate/monthly-report.tsx`    | ✅     | Monthly report email template     |
| 37  | `lib/email/templates/affiliate/payment-processed.tsx` | ✅     | Payment processed email template  |
| 38  | `lib/email/templates/affiliate/welcome.tsx`           | ✅     | Affiliate welcome email template  |
| 39  | `emails/index.ts`                                     | ✅     | Email templates index             |
| 40  | `emails/payment-confirmation.tsx`                     | ✅     | Payment confirmation email        |
| 41  | `emails/payment-failure.tsx`                          | ✅     | Payment failure notification      |
| 42  | `emails/renewal-reminder.tsx`                         | ✅     | Subscription renewal reminder     |
| 43  | `emails/subscription-expired.tsx`                     | ✅     | Subscription expired notification |

---

## CATEGORY 9: Utility Functions (3 Files)

| #   | File Path                 | Status | Description                               |
| --- | ------------------------- | ------ | ----------------------------------------- |
| 44  | `lib/utils/helpers.ts`    | ✅     | General helper functions                  |
| 45  | `lib/utils/formatters.ts` | ✅     | Data formatters (date, currency, numbers) |
| 46  | `lib/utils/constants.ts`  | ✅     | Application constants                     |

---

## CATEGORY 10: API Utilities (3 Files)

| #   | File Path                  | Status | Description             |
| --- | -------------------------- | ------ | ----------------------- |
| 47  | `lib/api/index.ts`         | ✅     | API utilities index     |
| 48  | `lib/api/mt5-client.ts`    | ✅     | MT5 API client          |
| 49  | `lib/api/mt5-transform.ts` | ✅     | MT5 data transformation |

---

## CATEGORY 11: React Hooks (9 Files)

| #   | File Path                          | Status | Description                  |
| --- | ---------------------------------- | ------ | ---------------------------- |
| 50  | `hooks/use-alerts.ts`              | ✅     | Alerts state management hook |
| 51  | `hooks/use-auth.ts`                | ✅     | Authentication state hook    |
| 52  | `hooks/use-indicators.ts`          | ✅     | Technical indicators hook    |
| 53  | `hooks/use-login-tracking.ts`      | ✅     | Login tracking hook          |
| 54  | `hooks/use-optimistic-mutation.ts` | ✅     | Optimistic update mutations  |
| 55  | `hooks/use-toast.ts`               | ✅     | Toast notification hook      |
| 56  | `hooks/use-watchlist.ts`           | ✅     | Watchlist state management   |
| 57  | `hooks/use-websocket.ts`           | ✅     | WebSocket connection hook    |
| 58  | `lib/hooks/useAffiliateConfig.ts`  | ✅     | Affiliate configuration hook |

---

## CATEGORY 12: Type Definitions (12 Files)

| #   | File Path                 | Status | Description              |
| --- | ------------------------- | ------ | ------------------------ |
| 59  | `types/index.ts`          | ✅     | Type exports index       |
| 60  | `types/alert.ts`          | ✅     | Alert type definitions   |
| 61  | `types/api.ts`            | ✅     | API response types       |
| 62  | `types/disbursement.ts`   | ✅     | Disbursement types       |
| 63  | `types/dlocal.ts`         | ✅     | DLocal payment types     |
| 64  | `types/indicator.ts`      | ✅     | Indicator types          |
| 65  | `types/next-auth.d.ts`    | ✅     | NextAuth type extensions |
| 66  | `types/payment.ts`        | ✅     | Payment types            |
| 67  | `types/prisma-stubs.d.ts` | ✅     | Prisma type stubs        |
| 68  | `types/tier.ts`           | ✅     | Tier type definitions    |
| 69  | `types/user.ts`           | ✅     | User type definitions    |
| 70  | `types/watchlist.ts`      | ✅     | Watchlist types          |

---

## CATEGORY 13: Constants & Business Rules (1 File)

| #   | File Path                         | Status | Description              |
| --- | --------------------------------- | ------ | ------------------------ |
| 71  | `lib/constants/business-rules.ts` | ✅     | Business rules constants |

---

## CATEGORY 14: Cron Jobs & Background Jobs (5 Files)

| #   | File Path                                     | Status | Description                     |
| --- | --------------------------------------------- | ------ | ------------------------------- |
| 72  | `lib/cron/check-expiring-subscriptions.ts`    | ✅     | Expiring subscription checker   |
| 73  | `lib/cron/downgrade-expired-subscriptions.ts` | ✅     | Expired subscription downgrade  |
| 74  | `lib/cron/monthly-distribution.ts`            | ✅     | Monthly commission distribution |
| 75  | `lib/jobs/alert-checker.ts`                   | ✅     | Alert checking background job   |
| 76  | `lib/jobs/queue.ts`                           | ✅     | Job queue management            |

---

## CATEGORY 15: WebSocket (2 Files)

| #   | File Path                            | Status | Description                     |
| --- | ------------------------------------ | ------ | ------------------------------- |
| 77  | `lib/websocket/server.ts`            | ✅     | WebSocket server implementation |
| 78  | `lib/websocket/use-mt5-websocket.ts` | ✅     | MT5 WebSocket hook              |

---

## CATEGORY 16: Security & Fraud (2 Files)

| #   | File Path                              | Status | Description                |
| --- | -------------------------------------- | ------ | -------------------------- |
| 79  | `lib/security/device-detection.ts`     | ✅     | Device detection utilities |
| 80  | `lib/fraud/fraud-detection.service.ts` | ✅     | Fraud detection service    |

---

## CATEGORY 17: Monitoring & Geo (2 Files)

| #   | File Path                          | Status | Description                 |
| --- | ---------------------------------- | ------ | --------------------------- |
| 81  | `lib/monitoring/system-monitor.ts` | ✅     | System monitoring utilities |
| 82  | `lib/geo/detect-country.ts`        | ✅     | Geo-location detection      |

---

## CATEGORY 18: User Preferences (1 File)

| #   | File Path                     | Status | Description              |
| --- | ----------------------------- | ------ | ------------------------ |
| 83  | `lib/preferences/defaults.ts` | ✅     | Default user preferences |

---

## CATEGORY 19: Middleware (1 File)

| #   | File Path                  | Status | Description                    |
| --- | -------------------------- | ------ | ------------------------------ |
| 84  | `middleware/tier-check.ts` | ✅     | Tier access control middleware |

---

## CATEGORY 20: App Infrastructure (5 Files)

| #   | File Path                    | Status | Description              |
| --- | ---------------------------- | ------ | ------------------------ |
| 85  | `app/layout.tsx`             | ✅     | Root application layout  |
| 86  | `app/globals.css`            | ✅     | Global CSS styles        |
| 87  | `app/error.tsx`              | ✅     | Error boundary component |
| 88  | `app/(marketing)/layout.tsx` | ✅     | Marketing pages layout   |
| 89  | `app/(marketing)/page.tsx`   | ✅     | Marketing home page      |

---

## CATEGORY 21: Configuration Files (6 Files)

| #   | File Path            | Status | Description                |
| --- | -------------------- | ------ | -------------------------- |
| 90  | `next.config.js`     | ✅     | Next.js configuration      |
| 91  | `tailwind.config.ts` | ✅     | Tailwind CSS configuration |
| 92  | `postcss.config.js`  | ✅     | PostCSS configuration      |
| 93  | `jest.config.js`     | ✅     | Jest testing configuration |
| 94  | `tsconfig.json`      | ✅     | TypeScript configuration   |
| 95  | `components.json`    | ✅     | shadcn/ui configuration    |

---

## CATEGORY 22: CI/CD & GitHub Workflows (11 Files)

| #   | File Path                                     | Status | Description                |
| --- | --------------------------------------------- | ------ | -------------------------- |
| 96  | `.github/workflows/tests.yml`                 | ✅     | Main test workflow         |
| 97  | `.github/workflows/deploy.yml`                | ✅     | Production deployment      |
| 98  | `.github/workflows/api-tests.yml`             | ✅     | API testing workflow       |
| 99  | `.github/workflows/bundle-monitor.yml`        | ✅     | Bundle size monitoring     |
| 100 | `.github/workflows/ci-nextjs-progressive.yml` | ✅     | Progressive Next.js CI     |
| 101 | `.github/workflows/dependencies-security.yml` | ✅     | Dependency security checks |
| 102 | `.github/workflows/e2e-tests.yml`             | ✅     | E2E testing workflow       |
| 103 | `.github/workflows/load-test.yml`             | ✅     | Load testing workflow      |
| 104 | `.github/workflows/mt5-pipeline-tests.yml`    | ✅     | MT5 pipeline tests         |
| 105 | `.github/workflows/openapi-validation.yml`    | ✅     | OpenAPI validation         |
| 106 | `.github/workflows/security-checks.yml`       | ✅     | Security scanning          |

---

## CATEGORY 23: Docker & Deployment (3 Files)

| #   | File Path              | Status | Description                  |
| --- | ---------------------- | ------ | ---------------------------- |
| 107 | `docker-compose.yml`   | ✅     | Docker Compose configuration |
| 108 | `.dockerignore`        | ✅     | Docker ignore patterns       |
| 109 | `public/manifest.json` | ✅     | PWA manifest                 |

---

## CATEGORY 24: Scripts (18 Files)

| #   | File Path                         | Status | Description                  |
| --- | --------------------------------- | ------ | ---------------------------- |
| 110 | `scripts/validate-file.js`        | ✅     | File validation script       |
| 111 | `scripts/validate_sqlite.py`      | ✅     | SQLite validation script     |
| 112 | `scripts/health-check-ui.js`      | ✅     | UI health check              |
| 113 | `scripts/health-check-ui.sh`      | ✅     | UI health check shell script |
| 114 | `scripts/monitor-mt5-pipeline.ts` | ✅     | MT5 pipeline monitoring      |
| 115 | `scripts/test-mt5-deployment.ts`  | ✅     | MT5 deployment testing       |
| 116 | `scripts/test-prisma5-upgrade.ts` | ✅     | Prisma 5 upgrade testing     |
| 117 | `scripts/run-all-tests.sh`        | ✅     | Test runner script           |
| 118 | `scripts/collect-metrics.sh`      | ✅     | Metrics collection           |
| 119 | `scripts/check-sync-needed.js`    | ✅     | Sync check utility           |
| 120 | `scripts/check-coverage.js`       | ✅     | Coverage checking            |
| 121 | `scripts/archive-docs.sh`         | ✅     | Documentation archiving      |
| 122 | `scripts/deploy-part20.sh`        | ✅     | Part 20 deployment           |
| 123 | `scripts/sync-frontend.sh`        | ✅     | Frontend sync script         |
| 124 | `scripts/setup-e2e.sh`            | ✅     | E2E setup script             |
| 125 | `scripts/rollback-to-part6.sh`    | ✅     | Rollback script              |
| 126 | `scripts/verify-alignment.sh`     | ✅     | Alignment verification       |
| 127 | `scripts/verify-build-orders.sh`  | ✅     | Build order verification     |

---

## CATEGORY 25: Tier Tests (2 Files)

| #   | File Path                              | Status | Description          |
| --- | -------------------------------------- | ------ | -------------------- |
| 128 | `lib/tier/__tests__/constants.test.ts` | ✅     | Tier constants tests |
| 129 | `lib/tier/__tests__/validator.test.ts` | ✅     | Tier validator tests |

---

## Status Summary

| Category                    | Files   | Completed | Status      |
| --------------------------- | ------- | --------- | ----------- |
| Core Utilities              | 6       | 6         | ✅ 100%     |
| Database Utilities          | 4       | 4         | ✅ 100%     |
| Authentication Utilities    | 6       | 6         | ✅ 100%     |
| Tier System                 | 6       | 6         | ✅ 100%     |
| Error Handling              | 3       | 3         | ✅ 100%     |
| Validation Schemas          | 4       | 4         | ✅ 100%     |
| Cache & Redis               | 2       | 2         | ✅ 100%     |
| Email Services              | 11      | 11        | ✅ 100%     |
| Utility Functions           | 3       | 3         | ✅ 100%     |
| API Utilities               | 3       | 3         | ✅ 100%     |
| React Hooks                 | 9       | 9         | ✅ 100%     |
| Type Definitions            | 12      | 12        | ✅ 100%     |
| Constants & Business Rules  | 1       | 1         | ✅ 100%     |
| Cron Jobs & Background Jobs | 5       | 5         | ✅ 100%     |
| WebSocket                   | 2       | 2         | ✅ 100%     |
| Security & Fraud            | 2       | 2         | ✅ 100%     |
| Monitoring & Geo            | 2       | 2         | ✅ 100%     |
| User Preferences            | 1       | 1         | ✅ 100%     |
| Middleware                  | 1       | 1         | ✅ 100%     |
| App Infrastructure          | 5       | 5         | ✅ 100%     |
| Configuration Files         | 6       | 6         | ✅ 100%     |
| CI/CD & GitHub Workflows    | 11      | 11        | ✅ 100%     |
| Docker & Deployment         | 3       | 3         | ✅ 100%     |
| Scripts                     | 18      | 18        | ✅ 100%     |
| Tier Tests                  | 2       | 2         | ✅ 100%     |
| **TOTAL**                   | **129** | **129**   | **✅ 100%** |

---

## Database Schema Notes

The database has been migrated from the old 14-column JSON structure to the new flat 57-column structure. Key changes reflected in Part 16 utilities:

- `lib/db/prisma.ts` - Updated Prisma client with new schema
- `prisma/schema.prisma` - Complete 57-column flat structure
- `types/prisma-stubs.d.ts` - Updated type stubs for new schema
- All validation schemas updated for new flat structure

---

## Cross-Part Dependencies

Part 16 utilities are used by all other parts:

| Utility Category   | Used By Parts         |
| ------------------ | --------------------- |
| Authentication     | 5, 11, 12, 13, 14, 17 |
| Validation Schemas | 5, 10, 11, 13         |
| Error Handling     | All API routes        |
| Email Services     | 5, 11, 12, 15, 17     |
| Tier System        | 10, 11, 12            |
| Caching            | 10, 11, 14            |
| Type Definitions   | All parts             |
| React Hooks        | 9, 10, 11, 15         |

---

## Recent Updates

- **2026-01-24**: Comprehensive inventory reflecting 57-column database migration
- Added all scripts, workflows, and infrastructure files
- Added email templates (affiliate and subscription)
- Added tier tests
- Added monitoring and security utilities
- Total file count increased from 25 to 129

---

**Part 16 Status: COMPLETE** ✅
