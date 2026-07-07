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

## CATEGORY 4: Tier System (3 Files, was 6)

| #   | File Path                | Status | Description                        |
| --- | ------------------------ | ------ | ---------------------------------- |
| 17  | `lib/tier-config.ts`     | ✅     | Tier definitions and configuration |
| 18  | `lib/tier-validation.ts` | ✅     | Tier validation logic              |
| 19  | `lib/tier-helpers.ts`    | ✅     | Tier helper functions              |
| 20  | ~~`lib/tier/constants.ts`~~ | ❌ **DELETED 2026-07-08** | Dead code — only consumed by the deleted indicator-toggles/pro-indicator-overlay components |
| 21  | ~~`lib/tier/validator.ts`~~ | ❌ **DELETED 2026-07-08** | Dead code — same reason |
| 22  | ~~`lib/tier/index.ts`~~  | ❌ **DELETED 2026-07-08** | Barrel re-export with zero external consumers once 20-21 were removed |

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
| 27  | `lib/validations/alert.ts`     | ✅     | Alert input validation (V8: XAUUSD/M5/M15 only — see 2026-07-07 update) |
| 28  | ~~`lib/validations/watchlist.ts`~~ | ❌ **DELETED 2026-07-07** | Watchlist feature removed (V8) |
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

## CATEGORY 10: API Utilities (1 File, was 3)

| #   | File Path                  | Status | Description             |
| --- | -------------------------- | ------ | ----------------------- |
| 47  | `lib/api/index.ts`         | ✅     | API utilities index     |
| 48  | ~~`lib/api/mt5-client.ts`~~    | ❌ **DELETED 2026-07-08** | Dead code — never imported anywhere; Part 07's doc had already flagged it as superseded |
| 49  | ~~`lib/api/mt5-transform.ts`~~ | ❌ **DELETED 2026-07-08** | Dead code — never imported anywhere |

---

## CATEGORY 11: React Hooks (7 Files, was 9)

| #   | File Path                          | Status | Description                  |
| --- | ---------------------------------- | ------ | ---------------------------- |
| 50  | `hooks/use-alerts.ts`              | ✅     | Alerts state management hook |
| 51  | `hooks/use-auth.ts`                | ✅     | Authentication state hook    |
| 52  | ~~`hooks/use-indicators.ts`~~      | ❌ **DELETED 2026-07-08** | Dead code — exported `useIndicators()` was never called anywhere |
| 53  | `hooks/use-login-tracking.ts`      | ✅     | Login tracking hook          |
| 54  | `hooks/use-optimistic-mutation.ts` | ✅     | Optimistic update mutations  |
| 55  | `hooks/use-toast.ts`               | ✅     | Toast notification hook      |
| 56  | ~~`hooks/use-watchlist.ts`~~       | ❌ **DELETED 2026-07-07** | Watchlist feature removed (V8) |
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
| 69  | `types/user.ts`           | ✅     | User type definitions (V8: dropped `Watchlist` interface, `totalWatchlists` stat) |
| 70  | ~~`types/watchlist.ts`~~  | ❌ **DELETED 2026-07-07** | Watchlist feature removed (V8) |

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

## CATEGORY 15: WebSocket (1 File, was 2)

| #   | File Path                            | Status | Description                     |
| --- | ------------------------------------ | ------ | ------------------------------- |
| 77  | `lib/websocket/server.ts`            | ✅     | WebSocket server implementation |
| 78  | ~~`lib/websocket/use-mt5-websocket.ts`~~ | ❌ **DELETED 2026-07-08** | Dead code — exported `useMT5WebSocket()` was never called anywhere |

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

## CATEGORY 25: Tier Tests (0 Files, was 2) — category retired 2026-07-08

| #   | File Path                              | Status | Description          |
| --- | -------------------------------------- | ------ | -------------------- |
| 128 | ~~`lib/tier/__tests__/constants.test.ts`~~ | ❌ **DELETED 2026-07-07** | Stale pre-V8 test — asserted a FREE/PRO indicator split that no longer exists |
| 129 | ~~`lib/tier/__tests__/validator.test.ts`~~ | ❌ **DELETED 2026-07-08** | Tested the deleted `lib/tier/validator.ts` — nothing left to test |

---

## Status Summary

| Category                    | Files   | Completed | Status      |
| --------------------------- | ------- | --------- | ----------- |
| Core Utilities              | 6       | 6         | ✅ 100%     |
| Database Utilities          | 4       | 4         | ✅ 100%     |
| Authentication Utilities    | 6       | 6         | ✅ 100%     |
| Tier System                 | 3       | 3         | ✅ 100% (was 6; `lib/tier/{constants,validator,index}.ts` deleted 2026-07-08 as dead code) |
| Error Handling              | 3       | 3         | ✅ 100%     |
| Validation Schemas          | 3       | 3         | ✅ 100% (was 4; `watchlist.ts` deleted 2026-07-07) |
| Cache & Redis               | 2       | 2         | ✅ 100%     |
| Email Services              | 11      | 11        | ✅ 100%     |
| Utility Functions           | 3       | 3         | ✅ 100%     |
| API Utilities               | 1       | 1         | ✅ 100% (was 3; `mt5-{client,transform}.ts` deleted 2026-07-08 as dead code) |
| React Hooks                 | 7       | 7         | ✅ 100% (was 9 → 8 → 7; `use-watchlist.ts` deleted 2026-07-07, `use-indicators.ts` deleted 2026-07-08) |
| Type Definitions            | 11      | 11        | ✅ 100% (was 12; `types/watchlist.ts` deleted 2026-07-07) |
| Constants & Business Rules  | 1       | 1         | ✅ 100%     |
| Cron Jobs & Background Jobs | 5       | 5         | ✅ 100%     |
| WebSocket                   | 1       | 1         | ✅ 100% (was 2; `use-mt5-websocket.ts` deleted 2026-07-08 as dead code) |
| Security & Fraud            | 2       | 2         | ✅ 100%     |
| Monitoring & Geo            | 2       | 2         | ✅ 100%     |
| User Preferences            | 1       | 1         | ✅ 100%     |
| Middleware                  | 1       | 1         | ✅ 100%     |
| App Infrastructure          | 5       | 5         | ✅ 100%     |
| Configuration Files         | 6       | 6         | ✅ 100%     |
| CI/CD & GitHub Workflows    | 11      | 11        | ✅ 100%     |
| Docker & Deployment         | 3       | 3         | ✅ 100%     |
| Scripts                     | 18      | 18        | ✅ 100%     |
| Tier Tests                  | 0       | 0         | ✅ 100% (was 2; both files deleted — `constants.test.ts` 2026-07-07, `validator.test.ts` 2026-07-08) |
| **TOTAL**                   | **117** | **117**   | **✅ 100%** |

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

## Update 2026-07-07 — V8 single-symbol architecture + Windows/Jest infra fixes

Commit `f213bd12` touched a large slice of Part 16 for the V8 redesign
(`change-to-new-design.md`) plus unrelated build-tooling fixes. **3 files deleted, 0 added:**

**Deleted (Watchlist feature + stale test):**

- `lib/validations/watchlist.ts` (row 28), `hooks/use-watchlist.ts` (row 56),
  `types/watchlist.ts` (row 70) — the watchlist feature was removed from the product for all
  tiers; the corresponding `Watchlist`/`WatchlistItem` Prisma models were dropped via
  `prisma/migrations/20260706000000_drop_watchlists/migration.sql`.
- `lib/tier/__tests__/constants.test.ts` (row 128) — stale pre-V8 test asserting a FREE/PRO
  indicator split that no longer exists; the FREE/PRO indicator gating itself was removed (see
  below), making this suite obsolete rather than fixable.

**Modified (tier system rewritten for V8 — XAUUSD only, M5/M15 only, both tiers identical):**

- `lib/tier-config.ts` (17), `lib/tier-validation.ts` (18), `lib/tier/constants.ts` (20),
  `lib/tier/validator.ts` (21) — symbol/timeframe lists collapsed to `['XAUUSD']`/`['M5','M15']`
  for both tiers; `canAccessIndicator()` now always returns `true` (no more column/indicator
  gating — both tiers get all `market_data_v6` columns); all watchlist-limit functions
  (`getWatchlistLimit`, `getMaxWatchlists`, `canCreateWatchlist`, `canAddWatchlistItem`) removed
  from `lib/tier-validation.ts`. **Note:** `lib/tier/constants.ts`'s `INDICATOR_METADATA` still
  lists the old 63-column indicator set (tema/heiken-ashi/keltner/etc.) re-tagged `tier: 'FREE'`
  for all — it was not migrated to the `market_data_v6` column set that `types/indicator.ts` (Part
  16 row 64) moved to in this same commit. Both are "ungated," so nothing is functionally broken,
  but the two files now describe different column sets for what should be the same data layer.
- `lib/auth/permissions.ts` (14) — `view_watchlist` and FREE-tier `create_alerts` removed;
  `multi_timeframe_visualization`/`drawing_line_alerts` added as PRO-only permissions. See
  `part-05-files-completion.md`'s own 2026-07-07 note.
- `lib/constants/business-rules.ts` (71) — same symbol/timeframe/indicator collapse as
  `lib/tier-config.ts`; `INDICATORS_BY_TIER.FREE` now equals `ALL_INDICATORS` (was
  `BASIC_INDICATORS`).
- `types/{index,tier,indicator,api,prisma-stubs.d,user}.ts` (59, 64, 61, 67, 68) — `types/index.ts`
  dropped its `watchlist` re-export; `types/tier.ts` rewritten for the V8 `TierLimits` shape
  (see `part-08-files-completion.md`); `types/indicator.ts` fully migrated to the
  `MarketDataV6`/`CentroidVariantColumns` shape (79 fields), replacing the old per-tier
  `FreeMarketData`/`CompleteMarketData` interfaces; `types/user.ts` dropped the `Watchlist`
  interface and `UserStats.totalWatchlists`.
- `lib/validations/user.ts` (29) — `defaultTimeframe` enum narrowed to `'M5'|'M15'`;
  `exportUserDataSchema` dropped `includeWatchlists`.
- `lib/db/seed.ts` (8), `prisma/seed.ts` — stale doc comments referencing the retired
  63-column `MarketData` schema removed (no behavior change; that model was already dropped
  2026-07-05).
- `lib/websocket/server.ts` (77) — added `subscribe_market`/`broadcastMarketData` for the v6
  pipeline; see `part-15-files-completion.md`'s 2026-07-07 note.
- `lib/jobs/alert-checker.ts` (75), `lib/api/index.ts` (47),
  `lib/email/{email,subscription-emails}.ts` (32-33), `lib/errors/api-error.ts` (23) — minor V8
  copy/logic updates (PRO price from `PRO_MONTHLY_PRICE`, XAUUSD gateway-first price lookup);
  no structural change.

**Modified (build tooling — unrelated to V8, same commit):**

- `jest.config.js` (93) — added `next-auth/react` → `__mocks__/next-auth-react.js` (a separate
  mock file, new/untracked — see Category 25 note below) and `lightweight-charts` →
  `__mocks__/lightweight-charts.js` (also new) module mappings; excludes
  `frontend-and-backend-python-stack/` (prototype sub-project) from `testPathIgnorePatterns`.
- `tsconfig.json` (94) — same `frontend-and-backend-python-stack/` exclusion.
- `package.json` — `prebuild` script switched from `rm -rf ... || true` to `rimraf` (new devDependency)
  for cross-platform (Windows) compatibility; added `worker:alerts` script (see
  `backend-file-inventory.md`'s Line Alerts rows).

**New untracked mock files** (not yet given their own Part 16 row — `__mocks__/` isn't
consistently inventoried elsewhere either): `__mocks__/next-auth-react.js`,
`__mocks__/lightweight-charts.js`. `__mocks__/next-auth.js` (existing) was also modified.

## Update 2026-07-08 — dead-code removal: legacy indicator/MT5 cluster

The 2026-07-07 note above flagged an inconsistency: `lib/tier/constants.ts`'s `INDICATOR_METADATA`
still described the old 63-column indicator set rather than the `market_data_v6` columns
`types/indicator.ts` migrated to. Investigation traced every consumer transitively and found the
whole chain was dead — unreachable from any live page, API route, or called hook. **8 files
deleted** across 5 categories (Tier System, API Utilities, React Hooks, WebSocket, Tier Tests),
verified safe with a clean `tsc --noEmit` (0 errors) and full Jest run (111 suites, 2046 tests,
all passing):

- **Tier System** (was 6, now 3): `lib/tier/constants.ts`, `lib/tier/validator.ts`,
  `lib/tier/index.ts` deleted. Only consumed by the two dead chart components below; the barrel
  (`index.ts`) had zero external consumers.
- **API Utilities** (was 3, now 1): `lib/api/mt5-client.ts`, `lib/api/mt5-transform.ts` deleted.
  Never imported anywhere; Part 07's own doc had already flagged `mt5-client.ts` as superseded.
- **React Hooks** (was 9 → 8 → 7): `hooks/use-indicators.ts` deleted. Exported `useIndicators()`
  was never called anywhere.
- **WebSocket** (was 2, now 1): `lib/websocket/use-mt5-websocket.ts` deleted. Exported
  `useMT5WebSocket()` was never called anywhere.
- **Tier Tests** (was 2, now 0 — category retired): `lib/tier/__tests__/validator.test.ts`
  deleted (tested the now-deleted `validator.ts`).

The two orphaned chart components that anchored this whole dead subtree —
`components/charts/pro-indicator-overlay.tsx` and `components/charts/indicator-toggles.tsx` —
are tracked in `part-09-files-completion.md`, not here (they're Part 09). Their test files
(`__tests__/components/charts/{indicator-toggles,pro-indicator-overlay}.test.tsx`) were also
deleted; those were never given their own Part 16 rows.

`types/indicator.ts` was trimmed to just the V8 `MarketDataV6`/`CentroidVariantColumns`/
`CENTROID_VARIANTS`/`CentroidVariant` exports (row 64) — the removed legacy interfaces had no
consumer left outside the deleted cluster. `lib/tier-validation.ts` (row 18) got a stale
doc-comment fix (it referenced the now-deleted `lib/tier/constants` module; no logic change).
`tsconfig.json` (row 94) added `Archive` to its exclude list — an archived copy of
`mt5-transform.ts` under `Archive/part6-flask-mt5/` was not previously excluded and broke
`tsc --noEmit` once the legacy types it imported were removed.

Full detail in `backend-file-inventory.md`'s and `frontend-ui-file-inventory.md`'s own
2026-07-08 reconciliation notes.

---

**Part 16 Status: COMPLETE** ✅ (117/117, updated 2026-07-08)
