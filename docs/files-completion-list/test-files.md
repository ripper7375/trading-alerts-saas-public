# Test Files - Complete List

This document lists all test files in the Trading Alerts SaaS system.

**Total Test Files:** 126 files

## Important Clarification

**Test files are NOT "Readable Elements" or "Interactive Elements".**

Those categories apply only to **user-facing UI components** (pages and components that users see and interact with). Test files are part of the **development/testing infrastructure**, not the UI layer.

Test files are categorized by **what they test**:
- **Frontend UI Component Tests** - Test React components, hooks, and UI logic
- **Backend Logic Tests** - Test API routes, services, business logic, database queries
- **E2E Tests** - Test full-stack integration (both frontend and backend together)

---

## Test Files by Category

### A. Frontend UI Component Tests (23 files)

These test React components and client-side UI logic.

**Component Tests (21 files):**

| # | File Path | Tests | Source |
|---|-----------|-------|--------|
| 1 | `__tests__/components/affiliate/commission-table.test.tsx` | Commission table component | Part 17A-2 |
| 2 | `__tests__/components/affiliate/code-table.test.tsx` | Code table component | Part 17A-2 |
| 3 | `__tests__/components/affiliate/stats-card.test.tsx` | Affiliate stats card | Part 17A-2 |
| 4 | `__tests__/components/charts/trading-chart.test.tsx` | TradingView chart component | Part 9 |
| 5 | `__tests__/components/charts/pro-indicator-overlay.test.tsx` | PRO indicator overlay | Part 9 |
| 6 | `__tests__/components/charts/indicator-toggles.test.tsx` | Indicator toggle controls | Part 9 |
| 7 | `__tests__/components/dashboard/recent-alerts.test.tsx` | Recent alerts widget | Part 8 |
| 8 | `__tests__/components/dashboard/watchlist-widget.test.tsx` | Watchlist widget | Part 8 |
| 9 | `__tests__/components/dashboard/stats-card.test.tsx` | Dashboard stats card | Part 8 |
| 10 | `__tests__/components/layout/header.test.tsx` | Header component | Part 16 |
| 11 | `__tests__/components/payments/PriceDisplay.test.tsx` | Price display component | Part 12 |
| 12 | `__tests__/components/payments/PlanSelector.test.tsx` | Plan selector component | Part 12 |
| 13 | `__tests__/components/admin/affiliate-stats-banner.test.tsx` | Admin affiliate stats banner | Part 17B-1 |
| 14 | `__tests__/components/admin/fraud-pattern-badge.test.tsx` | Fraud pattern badge | Part 18C |
| 15 | `__tests__/components/admin/sales-performance-table.test.tsx` | Sales performance table | Part 17B-1 |
| 16 | `__tests__/components/admin/pnl-summary-cards.test.tsx` | P&L summary cards | Part 17B-1 |
| 17 | `__tests__/components/admin/pnl-breakdown-table.test.tsx` | P&L breakdown table | Part 17B-1 |
| 18 | `__tests__/components/admin/code-inventory-chart.test.tsx` | Code inventory chart | Part 17B-1 |
| 19 | `__tests__/components/admin/affiliate-filters.test.tsx` | Affiliate filters | Part 17B-1 |
| 20 | `__tests__/components/admin/fraud-alert-card.test.tsx` | Fraud alert card | Part 18C |
| 21 | `__tests__/components/ui/button.test.tsx` | Button UI component | Part 16 |
| 22 | `__tests__/components/ui/card.test.tsx` | Card UI component | Part 16 |

**Hook Tests (2 files):**

| # | File Path | Tests | Source |
|---|-----------|-------|--------|
| 23 | `__tests__/hooks/use-toast.test.ts` | Toast notification hook | Part 16 |
| 24 | `__tests__/hooks/use-websocket.test.ts` | WebSocket connection hook | Part 15 |

---

### B. Backend Logic Tests (93 files)

These test API routes, business logic, services, and database operations.

#### B1. API Route Tests (27 files)

| # | File Path | Tests | Source |
|---|-----------|-------|--------|
| 25 | `__tests__/api/indicators.test.ts` | Indicator API endpoints | Part 7 |
| 26 | `__tests__/api/alerts.test.ts` | Alerts CRUD API | Part 11 |
| 27 | `__tests__/api/watchlist.test.ts` | Watchlist API | Part 10 |
| 28 | `__tests__/api/user.test.ts` | User profile API | Part 13 |
| 29 | `__tests__/api/admin.test.ts` | Admin API endpoints | Part 14 |
| 30 | `__tests__/api/notifications.test.ts` | Notifications API | Part 15 |
| 31 | `__tests__/api/tier.test.ts` | Tier validation API | Part 7 |
| 32 | `__tests__/api/cron-jobs.test.ts` | Cron job endpoints | Part 12 |
| 33 | `__tests__/api/affiliate-registration.test.ts` | Affiliate registration API | Part 17A-2 |
| 34 | `__tests__/api/affiliate-dashboard.test.ts` | Affiliate dashboard API | Part 17A-2 |
| 35 | `__tests__/api/affiliate-conversion.test.ts` | Affiliate conversion tracking | Part 17A-1 |
| 36 | `__tests__/api/admin-affiliates.test.ts` | Admin affiliate management API | Part 17B-1 |
| 37 | `__tests__/api/admin-reports.test.ts` | Admin reports API | Part 17B-1 |
| 38 | `__tests__/api/cache/stats.test.ts` | Cache stats API | Part 20 (Phase 05) |
| 39 | `__tests__/api/webhooks/dlocal/route.test.ts` | dLocal webhook handler | Part 18C |
| 40 | `__tests__/api/webhooks/riseworks.test.ts` | RiseWorks webhook handler | Part 19D |
| 41 | `__tests__/api/cron/process-pending.test.ts` | Process pending disbursements cron | Part 19D |
| 42 | `__tests__/api/disbursement/pay.test.ts` | Disbursement payment API | Part 19D |
| 43 | `__tests__/api/disbursement/reports.test.ts` | Disbursement reports API | Part 19D |
| 44 | `__tests__/api/disbursement/audit.test.ts` | Disbursement audit logs API | Part 19D |
| 45 | `__tests__/api/disbursement/batches.test.ts` | Payment batches API | Part 19D |
| 46 | `__tests__/api/disbursement/execute.test.ts` | Execute payment batch API | Part 19D |
| 47 | `__tests__/api/disbursement/health.test.ts` | Disbursement health check | Part 19D |
| 48 | `__tests__/api/disbursement/affiliates.test.ts` | Disbursement affiliates API | Part 19D |

#### B2. Part 20 Tests (6 files)

| # | File Path | Tests | Source |
|---|-----------|-------|--------|
| 49 | `__tests__/part20/api/indicators.test.ts` | Part 20 indicators API | Part 20 (Phase 07) |
| 50 | `__tests__/part20/api/confluence.test.ts` | Confluence score API | Part 20 (Phase 07) |
| 51 | `__tests__/part20/integration/cache-integration.test.ts` | Redis cache integration | Part 20 (Phase 07) |
| 52 | `__tests__/part20/integration/db-queries.test.ts` | PostgreSQL query integration | Part 20 (Phase 07) |
| 53 | `__tests__/part20/setup.ts` | Part 20 test setup | Part 20 (Phase 07) |

#### B3. Unit Tests (4 files)

| # | File Path | Tests | Source |
|---|-----------|-------|--------|
| 54 | `__tests__/unit/symbol-utils.test.ts` | Symbol normalization utils | Part 20 (Phase 07) |
| 55 | `__tests__/unit/timeframe-filter.test.ts` | Timeframe filtering logic | Part 20 (Phase 07) |
| 56 | `__tests__/unit/tier-validation.test.ts` | Tier validation logic | Part 20 (Phase 07) |
| 57 | `__tests__/unit/confluence-calculator.test.ts` | Confluence score calculation | Part 20 (Phase 07) |

#### B4. Library Tests - Authentication (4 files)

| # | File Path | Tests | Source |
|---|-----------|-------|--------|
| 58 | `__tests__/lib/auth/session.test.ts` | Session management | Part 5 |
| 59 | `__tests__/lib/auth/permissions.test.ts` | Permission checking | Part 14 |
| 60 | `__tests__/lib/auth/errors.test.ts` | Auth error handling | Part 5 |
| 61 | `__tests__/lib/tokens.test.ts` | Token generation/validation | Part 5 |

#### B5. Library Tests - Database (2 files)

| # | File Path | Tests | Source |
|---|-----------|-------|--------|
| 62 | `__tests__/lib/db/prisma.test.ts` | Prisma client | Part 2 |
| 63 | `__tests__/lib/db/seed.test.ts` | Database seeding | Part 2 |

#### B6. Library Tests - Caching (2 files)

| # | File Path | Tests | Source |
|---|-----------|-------|--------|
| 64 | `__tests__/lib/cache/cache-manager.test.ts` | Cache manager | Part 20 (Phase 05) |
| 65 | `__tests__/lib/cache/indicator-cache.test.ts` | Indicator caching | Part 20 (Phase 05) |

#### B7. Library Tests - Payments (10 files)

| # | File Path | Tests | Source |
|---|-----------|-------|--------|
| 66 | `__tests__/lib/stripe/stripe.test.ts` | Stripe client | Part 12 |
| 67 | `__tests__/lib/stripe/webhook-handlers.test.ts` | Stripe webhook handlers | Part 12 |
| 68 | `__tests__/lib/dlocal/dlocal-payment.test.ts` | dLocal payment service | Part 18C |
| 69 | `__tests__/lib/dlocal/payment-methods.test.ts` | dLocal payment methods | Part 18C |
| 70 | `__tests__/lib/dlocal/currency-converter.test.ts` | Currency converter | Part 18C |
| 71 | `__tests__/lib/dlocal/three-day-validator.test.ts` | 3-day trial validator | Part 18C |
| 72 | `__tests__/lib/dlocal/constants.test.ts` | dLocal constants | Part 18C |

#### B8. Library Tests - Affiliate System (3 files)

| # | File Path | Tests | Source |
|---|-----------|-------|--------|
| 73 | `__tests__/lib/affiliate/code-generator.test.ts` | Code generation | Part 17A-1 |
| 74 | `__tests__/lib/affiliate/registration.test.ts` | Affiliate registration | Part 17A-1 |
| 75 | `__tests__/lib/affiliate/commission-calculator.test.ts` | Commission calculation | Part 17A-1 |

#### B9. Library Tests - Disbursement System (7 files)

| # | File Path | Tests | Source |
|---|-----------|-------|--------|
| 76 | `__tests__/lib/disbursement/constants.test.ts` | Disbursement constants | Part 19D |
| 77 | `__tests__/lib/disbursement/services/batch.test.ts` | Batch manager | Part 19D |
| 78 | `__tests__/lib/disbursement/services/orchestrator.test.ts` | Payment orchestrator | Part 19D |
| 79 | `__tests__/lib/disbursement/services/aggregator.test.ts` | Commission aggregator | Part 19D |
| 80 | `__tests__/lib/disbursement/providers/factory.test.ts` | Provider factory | Part 19D |
| 81 | `__tests__/lib/disbursement/providers/mock.test.ts` | Mock provider | Part 19D |
| 82 | `__tests__/lib/disbursement/providers/rise/webhook.test.ts` | RiseWorks webhook | Part 19D |

#### B10. Library Tests - Admin (3 files)

| # | File Path | Tests | Source |
|---|-----------|-------|--------|
| 83 | `__tests__/lib/admin/affiliate-management.test.ts` | Affiliate management | Part 17B-1 |
| 84 | `__tests__/lib/admin/code-distribution.test.ts` | Code distribution | Part 17B-2 |
| 85 | `__tests__/lib/admin/pnl-calculator.test.ts` | P&L calculator | Part 17B-1 |

#### B11. Library Tests - Cron Jobs (3 files)

| # | File Path | Tests | Source |
|---|-----------|-------|--------|
| 86 | `__tests__/lib/cron/downgrade-expired-subscriptions.test.ts` | Downgrade expired subs | Part 12 |
| 87 | `__tests__/lib/cron/check-expiring-subscriptions.test.ts` | Check expiring subs | Part 12 |
| 88 | `__tests__/lib/cron/monthly-distribution.test.ts` | Monthly code distribution | Part 17B-2 |

#### B12. Library Tests - Validations (3 files)

| # | File Path | Tests | Source |
|---|-----------|-------|--------|
| 89 | `__tests__/lib/validations/auth.test.ts` | Auth validation schemas | Part 5 |
| 90 | `__tests__/lib/validations/alert.test.ts` | Alert validation schemas | Part 11 |
| 91 | `__tests__/lib/validations/indicators.test.ts` | Indicator validation schemas | Part 7 |

#### B13. Library Tests - Tier System (4 files)

| # | File Path | Tests | Source |
|---|-----------|-------|--------|
| 92 | `__tests__/lib/tier-validation.test.ts` | Tier validation (legacy) | Part 7 |
| 93 | `__tests__/lib/tier-helpers.test.ts` | Tier helper functions | Part 7 |
| 94 | `__tests__/lib/tier-config.test.ts` | Tier configuration | Part 7 |
| 95 | `__tests__/lib/tier/constants.test.ts` | Tier constants (Part 20) | Part 20 (Phase 04c) |
| 96 | `__tests__/lib/tier/validator.test.ts` | Tier validator (Part 20) | Part 20 (Phase 04c) |

#### B14. Library Tests - Utilities (7 files)

| # | File Path | Tests | Source |
|---|-----------|-------|--------|
| 97 | `__tests__/lib/utils.test.ts` | General utilities | Part 1 |
| 98 | `__tests__/lib/utils/formatters.test.ts` | Data formatters | Part 1 |
| 99 | `__tests__/lib/utils/constants.test.ts` | Constants | Part 1 |
| 100 | `__tests__/lib/utils/helpers.test.ts` | Helper functions | Part 1 |
| 101 | `__tests__/lib/errors/api-error.test.ts` | API error classes | Part 14 |
| 102 | `__tests__/lib/errors/error-handler.test.ts` | Error handler | Part 14 |
| 103 | `__tests__/lib/rate-limit.test.ts` | Rate limiting | Part 14 |

#### B15. Library Tests - Other (5 files)

| # | File Path | Tests | Source |
|---|-----------|-------|--------|
| 104 | `__tests__/lib/email/email.test.ts` | Email service | Part 5 |
| 105 | `__tests__/lib/geo/detect-country.test.ts` | Country detection | Part 18C |
| 106 | `__tests__/lib/jobs/alert-checker.test.ts` | Alert checker job | Part 11 |
| 107 | `__tests__/lib/api/mt5-client.test.ts` | MT5 client (Part 6 - archived) | Part 6 |
| 108 | `__tests__/lib/api/mt5-transform.test.ts` | MT5 transform (Part 6 - archived) | Part 6 |

#### B16. Integration Tests (6 files)

| # | File Path | Tests | Source |
|---|-----------|-------|--------|
| 109 | `__tests__/integration/user-registration-flow.test.ts` | User registration flow | Part 5 |
| 110 | `__tests__/integration/auth-email-flow.test.ts` | Auth email flow | Part 5 |
| 111 | `__tests__/integration/tier1-workflows.test.ts` | Tier 1 workflows | Part 7 |
| 112 | `__tests__/integration/tier2-workflows.test.ts` | Tier 2 workflows | Part 7 |
| 113 | `__tests__/integration/watchlist-management-flow.test.ts` | Watchlist management | Part 10 |
| 114 | `__tests__/integration/payment-creation.test.ts` | Payment creation | Part 12 |
| 115 | `__tests__/e2e/dlocal-payment-flow.test.ts` | dLocal payment flow | Part 18C |

#### B17. Type Tests (3 files)

| # | File Path | Tests | Source |
|---|-----------|-------|--------|
| 116 | `__tests__/types/types.test.ts` | Type definitions | Various |
| 117 | `__tests__/types/dlocal.test.ts` | dLocal types | Part 18C |
| 118 | `__tests__/types/disbursement.test.ts` | Disbursement types | Part 19D |

---

### C. E2E Tests (9 files)

These test the **entire application stack** (frontend + backend together).

| # | File Path | Tests | Source |
|---|-----------|-------|--------|
| 119 | `e2e/tests/critical-path.spec.ts` | Critical path (DB → API → UI) | Part 20 (Phase 08) |
| 120 | `e2e/tests/chart-rendering.spec.ts` | Chart rendering with indicators | Part 20 (Phase 08) |
| 121 | `e2e/tests/path1-authentication.spec.ts` | Authentication flow | Part 5 |
| 122 | `e2e/tests/path2-subscription-upgrade.spec.ts` | Subscription upgrade | Part 12 |
| 123 | `e2e/tests/path3-subscription-cancel.spec.ts` | Subscription cancellation | Part 12 |
| 124 | `e2e/tests/path4-discount-redemption.spec.ts` | Discount code redemption | Part 12 |
| 125 | `e2e/tests/path5-affiliate-commissions.spec.ts` | Affiliate commissions | Part 17A-2 |
| 126 | `e2e/tests/path6-mt5-charts.spec.ts` | MT5 charts integration | Part 9 |
| 127 | `e2e/tests/path7-alert-notifications.spec.ts` | Alert notifications | Part 11 |

**E2E Supporting Files:**

| # | File Path | Purpose | Source |
|---|-----------|---------|--------|
| - | `e2e/playwright.config.ts` | Playwright configuration | Part 20 (Phase 08) |
| - | `e2e/global.setup.ts` | Global test setup | Testing |
| - | `e2e/global.teardown.ts` | Global test teardown | Testing |
| - | `e2e/pages/*.ts` | Page object models (8 files) | Testing |
| - | `e2e/utils/*.ts` | Test utilities (3 files) | Testing |
| - | `e2e/fixtures/*.ts` | Test fixtures (2 files) | Testing |

---

### D. Test Setup & Helpers (3 files)

| # | File Path | Purpose | Source |
|---|-----------|---------|--------|
| 128 | `__tests__/setup.ts` | Jest test setup | Testing |
| 129 | `__tests__/part20/setup.ts` | Part 20 test setup | Part 20 (Phase 07) |
| 130 | `__tests__/helpers/supertest-setup.ts` | Supertest HTTP testing setup | Testing |
| 131 | `__tests__/example.test.ts` | Example test template | Testing |

---

## Summary by Category

| Category | Test Files | Percentage |
|----------|-----------|------------|
| **Frontend UI Component Tests** | 23 | 18% |
| **Backend Logic Tests** | 93 | 74% |
| **E2E Tests** | 9 | 7% |
| **Setup & Helpers** | 4 | 3% |
| **Total** | **129** | **100%** |

---

## Summary by Type

| Type | Count | Description |
|------|-------|-------------|
| **Unit Tests** | 85 | Test individual functions/modules in isolation |
| **Integration Tests** | 34 | Test multiple modules working together |
| **E2E Tests** | 9 | Test entire application flow (UI → API → DB) |
| **Component Tests** | 21 | Test React components |
| **Setup Files** | 4 | Test configuration and helpers |
| **Total** | **153** | Including setup and helper files |

---

## Test Coverage by Feature

| Feature | Frontend Tests | Backend Tests | E2E Tests | Total |
|---------|----------------|---------------|-----------|-------|
| Authentication | 0 | 4 | 1 | 5 |
| Charts & Indicators | 3 | 4 | 2 | 9 |
| Alerts & Watchlist | 1 | 4 | 1 | 6 |
| Payments (Stripe + dLocal) | 2 | 13 | 3 | 18 |
| Affiliate System | 3 | 13 | 1 | 17 |
| Disbursement System | 0 | 19 | 0 | 19 |
| Admin Management | 9 | 8 | 0 | 17 |
| Tier Validation | 0 | 7 | 0 | 7 |
| Part 20 (SQLite + PostgreSQL) | 0 | 10 | 2 | 12 |
| UI Components | 21 | 0 | 0 | 21 |
| Utilities & Helpers | 0 | 11 | 0 | 11 |
| **Total** | **39** | **93** | **9** | **141** |

---

## Modular Monolith Architecture Impact

In the Modular Monolith architecture:

**Frontend Tests (Vercel Deployment):**
- Component tests (23 files) - Run in Vercel CI/CD
- E2E tests (9 files) - Run against staging/production URLs

**Backend Tests (Railway Deployment):**
- API tests (27 files) - Run in Railway CI/CD
- Unit tests (85 files) - Run in Railway CI/CD
- Integration tests (34 files) - Require PostgreSQL + Redis

**Test Execution Strategy:**
```
┌─────────────────────────────────────────┐
│ Vercel CI/CD (Frontend)                 │
│ - Component tests (Jest + RTL)          │
│ - E2E tests (Playwright - staging only) │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Railway CI/CD (Backend)                 │
│ - API tests (Supertest)                 │
│ - Unit tests (Jest)                     │
│ - Integration tests (with test DB)      │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ GitHub Actions (Full Stack)             │
│ - All tests run in parallel             │
│ - E2E tests run against staging         │
└─────────────────────────────────────────┘
```

---

## Notes

1. **Test files are NOT UI elements** - They are development/testing infrastructure
2. **Component tests** (`*.test.tsx`) test React components and UI logic
3. **Backend tests** (`*.test.ts` in lib/, api/) test business logic and APIs
4. **E2E tests** (`*.spec.ts` in e2e/) test the full application stack
5. **Part 6 tests** (mt5-client, mt5-transform) will be removed during Part 20 migration
6. **Test separation** aligns with the Modular Monolith architecture (frontend vs backend)

---

*Last Updated: 2026-01-09*
*Architecture: Modular Monolith Migration*
*Testing Framework: Jest + React Testing Library + Playwright*
