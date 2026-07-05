# Backend Files Inventory

**Last Updated:** 2026-07-05
**Total Files:** 652
**Purpose:** Complete inventory of all backend files (non-UI) that handle business logic, data processing, and infrastructure

---

## Definition

**Backend File** is defined as a file that is NOT a frontend UI file. These files handle:

- API endpoints and routes
- Database operations and queries
- Business logic and utilities
- Configuration and infrastructure
- Validation and type definitions
- Security and authentication
- Background jobs and automation

---

## Complete Inventory Table

> **Note on counting (read before relying on the totals).** This table lists files **per Part**,
> so the same file appears on multiple rows when more than one build Part touches it (e.g.
> `lib/tier-config.ts` is listed under Parts 04, 08, 11 and 16). As a result:
>
> - **Row count ≠ file count.** There are **623 numbered rows** but only **~511 unique file paths**
>   (~112 rows are cross-Part duplicates).
> - The **headline totals** (Total Files / Backend / Tests / Grand Total) and the
>   **Distribution by Category / Part** numbers below are **approximate editorial estimates**, not
>   values derived from this table — they over-count duplicates and do not reconcile exactly with
>   the row count or the unique-file count. Treat them as rough guidance; the per-row table is the
>   source of truth. (A fully de-duplicated, derived recount is tracked as possible future cleanup.)

| NO. | Part           | Paths and Filenames                                                     | Categories                  |
| --- | -------------- | ----------------------------------------------------------------------- | --------------------------- |
| 1   | Part 02        | `prisma/schema.prisma`                                                  | Database operations         |
| 2   | Part 02        | `lib/db/prisma.ts`                                                      | Database operations         |
| 3   | Part 02        | `lib/db/seed.ts`                                                        | Database operations         |
| 4   | Part 02        | `prisma/seed.ts`                                                        | Database operations         |
| 5   | Part 02        | `prisma/migrations/20251227000000_init/migration.sql`                   | Database operations         |
| 6   | Part 02        | `__tests__/lib/db/prisma.test.ts`                                       | Other (tests)               |
| 7   | Part 02        | `__tests__/lib/db/seed.test.ts`                                         | Other (tests)               |
| 8   | Part 02        | `docs/open-api-documents/part-02-database-schema-openapi.yaml`          | Other (documentation)       |
| 9   | Part 03        | `types/index.ts`                                                        | Type Definitions            |
| 10  | Part 03        | `types/tier.ts`                                                         | Type Definitions            |
| 11  | Part 03        | `types/user.ts`                                                         | Type Definitions            |
| 12  | Part 03        | `types/alert.ts`                                                        | Type Definitions            |
| 13  | Part 03        | `types/indicator.ts`                                                    | Type Definitions            |
| 14  | Part 03        | `types/api.ts`                                                          | Type Definitions            |
| 15  | Part 03        | `types/payment.ts`                                                      | Type Definitions            |
| 16  | Part 03        | `types/watchlist.ts`                                                    | Type Definitions            |
| 17  | Part 03        | `types/disbursement.ts`                                                 | Type Definitions            |
| 18  | Part 03        | `types/dlocal.ts`                                                       | Type Definitions            |
| 19  | Part 03        | `types/next-auth.d.ts`                                                  | Type Definitions            |
| 20  | Part 03        | `types/prisma-stubs.d.ts`                                               | Type Definitions            |
| 21  | Part 04        | `lib/tier-config.ts`                                                    | Libraries/Utilities         |
| 22  | Part 04        | `lib/tier-validation.ts`                                                | Validation schemas          |
| 23  | Part 04        | `lib/tier-helpers.ts`                                                   | Libraries/Utilities         |
| 24  | Part 04        | `lib/tier/constants.ts`                                                 | Libraries/Utilities         |
| 25  | Part 04        | `lib/tier/validator.ts`                                                 | Validation schemas          |
| 26  | Part 04        | `lib/tier/index.ts`                                                     | Libraries/Utilities         |
| 27  | Part 04        | `app/api/tier/check/[symbol]/route.ts`                                  | API routes                  |
| 28  | Part 04        | `app/api/tier/combinations/route.ts`                                    | API routes                  |
| 29  | Part 04        | `app/api/tier/symbols/route.ts`                                         | API routes                  |
| 30  | Part 04        | `lib/tier/__tests__/constants.test.ts`                                  | Other (tests)               |
| 31  | Part 04        | `lib/tier/__tests__/validator.test.ts`                                  | Other (tests)               |
| 32  | Part 04        | `__tests__/api/tier.test.ts`                                            | Other (tests)               |
| 33  | Part 05        | `lib/auth/errors.ts`                                                    | Security & Fraud Detection  |
| 34  | Part 05        | `lib/auth/auth-options.ts`                                              | Security & Fraud Detection  |
| 35  | Part 05        | `lib/auth/session.ts`                                                   | Security & Fraud Detection  |
| 36  | Part 05        | `lib/auth/permissions.ts`                                               | Security & Fraud Detection  |
| 37  | Part 05        | `app/api/auth/[...nextauth]/route.ts`                                   | API routes                  |
| 38  | Part 05        | `app/api/auth/register/route.ts`                                        | API routes                  |
| 39  | Part 05        | `app/api/auth/verify-email/route.ts`                                    | API routes                  |
| 40  | Part 05        | `app/api/auth/forgot-password/route.ts`                                 | API routes                  |
| 41  | Part 05        | `app/api/auth/reset-password/route.ts`                                  | API routes                  |
| 42  | Part 05        | `app/api/auth/resend-verification/route.ts`                             | API routes                  |
| 43  | Part 06        | `mt5-service/.env.example`                                              | Configuration files         |
| 44  | Part 06        | `mt5-service/Dockerfile`                                                | Configuration files         |
| 45  | Part 06        | `mt5-service/requirements.txt`                                          | Configuration files         |
| 46  | Part 06        | `mt5-service/requirements-dev.txt`                                      | Configuration files         |
| 47  | Part 06        | `mt5-service/run.py`                                                    | Other (Flask app entry)     |
| 48  | Part 06        | `mt5-service/app/__init__.py`                                           | Other (Flask app factory)   |
| 49  | Part 06        | `mt5-service/app/websocket.py`                                          | Other (WebSocket support)   |
| 50  | Part 06        | `mt5-service/app/routes/__init__.py`                                    | Other (routes package)      |
| 51  | Part 06        | `mt5-service/app/routes/admin.py`                                       | API routes                  |
| 52  | Part 06        | `mt5-service/app/routes/indicators.py`                                  | API routes                  |
| 53  | Part 06        | `mt5-service/app/services/__init__.py`                                  | Other (services package)    |
| 54  | Part 06        | `mt5-service/app/services/health_monitor.py`                            | Libraries/Utilities         |
| 55  | Part 06        | `mt5-service/app/services/indicator_reader.py`                          | Libraries/Utilities         |
| 56  | Part 06        | `mt5-service/app/services/mt5_connection_pool.py`                       | Libraries/Utilities         |
| 57  | Part 06        | `mt5-service/app/services/tier_service.py`                              | Libraries/Utilities         |
| 58  | Part 06        | `mt5-service/app/utils/__init__.py`                                     | Other (utils package)       |
| 59  | Part 06        | `mt5-service/app/utils/constants.py`                                    | Libraries/Utilities         |
| 60  | Part 06        | `mt5-service/app/utils/symbol_resolver.py`                              | Libraries/Utilities         |
| 61  | Part 06        | `mt5-service/config/mt5_terminals.json`                                 | Configuration files         |
| 62  | Part 06        | `mt5-service/config/mt5_terminals_test.json`                            | Configuration files         |
| 63  | Part 06        | `mt5-service/indicators/README.md`                                      | Other (documentation)       |
| 64  | Part 06        | `mt5-service/docs/symbol-resolution.md`                                 | Other (documentation)       |
| 65  | Part 06        | `mt5-service/tests/conftest.py`                                         | Other (tests)               |
| 66  | Part 06        | `mt5-service/tests/mock_mt5_server.py`                                  | Other (tests)               |
| 67  | Part 06        | `mt5-service/tests/mt5-mock-server-integration-tests-implementation.md` | Other (tests documentation) |
| 68  | Part 06        | `mt5-service/tests/test_connection_pool.py`                             | Other (tests)               |
| 69  | Part 06        | `mt5-service/tests/test_indicators.py`                                  | Other (tests)               |
| 70  | Part 06        | `mt5-service/tests/test_mt5_integration.py`                             | Other (tests)               |
| 71  | Part 06        | `mt5-service/tests/test_symbol_resolver.py`                             | Other (tests)               |
| 72  | Part 07        | `app/api/tier/symbols/route.ts`                                         | API routes                  |
| 73  | Part 07        | `app/api/tier/check/[symbol]/route.ts`                                  | API routes                  |
| 74  | Part 07        | `app/api/tier/combinations/route.ts`                                    | API routes                  |
| 75  | Part 08        | `lib/tier-config.ts`                                                    | Libraries/Utilities         |
| 76  | Part 08        | `types/tier.ts`                                                         | Type Definitions            |
| 77  | Part 08        | `hooks/use-alerts.ts`                                                   | React hooks                 |
| 78  | Part 08        | `hooks/use-watchlist.ts`                                                | React hooks                 |
| 79  | Part 08        | `hooks/use-auth.ts`                                                     | React hooks                 |
| 80  | Part 08        | `hooks/use-indicators.ts`                                               | React hooks                 |
| 81  | Part 08        | `hooks/use-login-tracking.ts`                                           | React hooks                 |
| 82  | Part 08        | `hooks/use-optimistic-mutation.ts`                                      | React hooks                 |
| 83  | Part 08        | `hooks/use-toast.ts`                                                    | React hooks                 |
| 84  | Part 08        | `hooks/use-websocket.ts`                                                | React hooks                 |
| 85  | Part 08        | `__tests__/components/dashboard/recent-alerts.test.tsx`                 | Other (tests)               |
| 86  | Part 08        | `__tests__/components/dashboard/stats-card.test.tsx`                    | Other (tests)               |
| 87  | Part 08        | `__tests__/components/dashboard/watchlist-widget.test.tsx`              | Other (tests)               |
| 88  | Part 09        | `hooks/use-indicators.ts`                                               | React hooks                 |
| 89  | Part 09        | `hooks/use-ohlcv-socket.ts`                                             | React hooks                 |
| 90  | Part 09        | `hooks/use-auth.ts`                                                     | React hooks                 |
| 91  | Part 10        | `app/api/watchlist/route.ts`                                            | API routes                  |
| 92  | Part 10        | `app/api/watchlist/[id]/route.ts`                                       | API routes                  |
| 93  | Part 10        | `app/api/watchlist/reorder/route.ts`                                    | API routes                  |
| 94  | Part 10        | `hooks/use-watchlist.ts`                                                | React hooks                 |
| 95  | Part 11        | `types/alert.ts`                                                        | Type Definitions            |
| 96  | Part 11        | `lib/validations/alert.ts`                                              | Validation schemas          |
| 97  | Part 11        | `app/api/alerts/route.ts`                                               | API routes                  |
| 98  | Part 11        | `app/api/alerts/[id]/route.ts`                                          | API routes                  |
| 99  | Part 11        | `hooks/use-alerts.ts`                                                   | React hooks                 |
| 100 | Part 11        | `lib/jobs/alert-checker.ts`                                             | Other (background jobs)     |
| 101 | Part 11        | `lib/jobs/queue.ts`                                                     | Other (background jobs)     |
| 102 | Part 11        | `lib/tier-config.ts`                                                    | Libraries/Utilities         |
| 103 | Part 11        | `frontend/types/alert.ts`                                               | Type Definitions            |
| 104 | Part 11        | `frontend/lib/validations/alert.ts`                                     | Validation schemas          |
| 105 | Part 11        | `frontend/lib/jobs/queue.ts`                                            | Other (background jobs)     |
| 106 | Part 12        | `app/api/subscription/route.ts`                                         | API routes                  |
| 107 | Part 12        | `app/api/subscription/cancel/route.ts`                                  | API routes                  |
| 108 | Part 12        | `app/api/checkout/route.ts`                                             | API routes                  |
| 109 | Part 12        | `app/api/checkout/validate-code/route.ts`                               | API routes                  |
| 110 | Part 12        | `app/api/invoices/route.ts`                                             | API routes                  |
| 111 | Part 12        | `app/api/webhooks/stripe/route.ts`                                      | API routes                  |
| 112 | Part 12        | `app/api/webhooks/dlocal/route.ts`                                      | API routes                  |
| 113 | Part 12        | `app/api/payments/dlocal/create/route.ts`                               | API routes                  |
| 114 | Part 12        | `app/api/payments/dlocal/[paymentId]/route.ts`                          | API routes                  |
| 115 | Part 12        | `app/api/payments/dlocal/methods/route.ts`                              | API routes                  |
| 116 | Part 12        | `app/api/payments/dlocal/convert/route.ts`                              | API routes                  |
| 117 | Part 12        | `app/api/payments/dlocal/exchange-rate/route.ts`                        | API routes                  |
| 118 | Part 12        | `app/api/payments/dlocal/check-three-day-eligibility/route.ts`          | API routes                  |
| 119 | Part 12        | `app/api/payments/dlocal/validate-discount/route.ts`                    | API routes                  |
| 120 | Part 12        | `lib/stripe/stripe.ts`                                                  | Libraries/Utilities         |
| 121 | Part 12        | `lib/stripe/webhook-handlers.ts`                                        | Libraries/Utilities         |
| 122 | Part 12        | `lib/dlocal/dlocal-payment.service.ts`                                  | Libraries/Utilities         |
| 123 | Part 12        | `lib/dlocal/payment-methods.service.ts`                                 | Libraries/Utilities         |
| 124 | Part 12        | `lib/dlocal/currency-converter.service.ts`                              | Libraries/Utilities         |
| 125 | Part 12        | `lib/dlocal/three-day-validator.service.ts`                             | Libraries/Utilities         |
| 126 | Part 12        | `lib/dlocal/constants.ts`                                               | Libraries/Utilities         |
| 127 | Part 12        | `lib/email/subscription-emails.ts`                                      | Templates                   |
| 128 | Part 12        | `types/payment.ts`                                                      | Type Definitions            |
| 129 | Part 13        | `app/api/user/profile/route.ts`                                         | API routes                  |
| 130 | Part 13        | `app/api/user/preferences/route.ts`                                     | API routes                  |
| 131 | Part 13        | `app/api/user/password/route.ts`                                        | API routes                  |
| 132 | Part 13        | `app/api/user/sessions/route.ts`                                        | API routes                  |
| 133 | Part 13        | `app/api/user/sessions/[id]/route.ts`                                   | API routes                  |
| 134 | Part 13        | `app/api/user/login-history/route.ts`                                   | API routes                  |
| 135 | Part 13        | `app/api/user/2fa/setup/route.ts`                                       | API routes                  |
| 136 | Part 13        | `app/api/user/2fa/verify-setup/route.ts`                                | API routes                  |
| 137 | Part 13        | `app/api/user/2fa/verify/route.ts`                                      | API routes                  |
| 138 | Part 13        | `app/api/user/2fa/disable/route.ts`                                     | API routes                  |
| 139 | Part 13        | `app/api/user/2fa/backup-codes/route.ts`                                | API routes                  |
| 140 | Part 13        | `app/api/user/account/deletion-request/route.ts`                        | API routes                  |
| 141 | Part 13        | `app/api/user/account/deletion-confirm/route.ts`                        | API routes                  |
| 142 | Part 13        | `app/api/user/account/deletion-cancel/route.ts`                         | API routes                  |
| 143 | Part 13        | `lib/preferences/defaults.ts`                                           | Libraries/Utilities         |
| 144 | Part 13        | `components/providers/theme-provider.tsx`                               | Middleware & Infrastructure |
| 145 | Part 13        | `components/providers/websocket-provider.tsx`                           | Middleware & Infrastructure |
| 146 | Part 14        | `app/api/admin/users/route.ts`                                          | API routes                  |
| 147 | Part 14        | `app/api/admin/analytics/route.ts`                                      | API routes                  |
| 148 | Part 14        | `app/api/admin/api-usage/route.ts`                                      | API routes                  |
| 149 | Part 14        | `app/api/admin/error-logs/route.ts`                                     | API routes                  |
| 150 | Part 14        | `app/api/admin/affiliates/route.ts`                                     | API routes                  |
| 151 | Part 14        | `app/api/admin/affiliates/[id]/route.ts`                                | API routes                  |
| 152 | Part 14        | `app/api/admin/affiliates/[id]/suspend/route.ts`                        | API routes                  |
| 153 | Part 14        | `app/api/admin/affiliates/[id]/reactivate/route.ts`                     | API routes                  |
| 154 | Part 14        | `app/api/admin/affiliates/[id]/distribute-codes/route.ts`               | API routes                  |
| 155 | Part 14        | `app/api/admin/affiliates/reports/code-inventory/route.ts`              | API routes                  |
| 156 | Part 14        | `app/api/admin/affiliates/reports/commission-owings/route.ts`           | API routes                  |
| 157 | Part 14        | `app/api/admin/affiliates/reports/profit-loss/route.ts`                 | API routes                  |
| 158 | Part 14        | `app/api/admin/affiliates/reports/sales-performance/route.ts`           | API routes                  |
| 159 | Part 14        | `app/api/admin/codes/[code]/cancel/route.ts`                            | API routes                  |
| 160 | Part 14        | `app/api/admin/commissions/pay/route.ts`                                | API routes                  |
| 161 | Part 14        | `app/api/admin/settings/affiliate/route.ts`                             | API routes                  |
| 162 | Part 14        | `app/api/admin/fraud-alerts/route.ts`                                   | API routes                  |
| 163 | Part 14        | `app/api/admin/fraud-alerts/[id]/route.ts`                              | API routes                  |
| 164 | Part 14        | `lib/admin/affiliate-management.ts`                                     | Libraries/Utilities         |
| 165 | Part 14        | `lib/admin/code-distribution.ts`                                        | Libraries/Utilities         |
| 166 | Part 14        | `lib/admin/pnl-calculator.ts`                                           | Libraries/Utilities         |
| 167 | Part 15        | `app/api/notifications/route.ts`                                        | API routes                  |
| 168 | Part 15        | `app/api/notifications/[id]/route.ts`                                   | API routes                  |
| 169 | Part 15        | `app/api/notifications/[id]/read/route.ts`                              | API routes                  |
| 170 | Part 15        | `lib/websocket/server.ts`                                               | Middleware & Infrastructure |
| 171 | Part 15        | `hooks/use-websocket.ts`                                                | React hooks                 |
| 172 | Part 15        | `lib/monitoring/system-monitor.ts`                                      | Libraries/Utilities         |
| 173 | Part 15        | `hooks/use-toast.ts`                                                    | React hooks                 |
| 174 | Part 15        | `lib/email/email.ts`                                                    | Templates                   |
| 175 | Part 15        | `lib/email/subscription-emails.ts`                                      | Templates                   |
| 176 | Part 15        | `__tests__/api/notifications.test.ts`                                   | Other (tests)               |
| 177 | Part 16        | `lib/logger.ts`                                                         | Libraries/Utilities         |
| 178 | Part 16        | `lib/utils.ts`                                                          | Libraries/Utilities         |
| 179 | Part 16        | `lib/csrf.ts`                                                           | Security & Fraud Detection  |
| 180 | Part 16        | `lib/rate-limit.ts`                                                     | Security & Fraud Detection  |
| 181 | Part 16        | `lib/tokens.ts`                                                         | Security & Fraud Detection  |
| 182 | Part 16        | `lib/candle-data-helpers.ts`                                            | Libraries/Utilities         |
| 183 | Part 16        | `lib/db/prisma.ts`                                                      | Database operations         |
| 184 | Part 16        | `lib/db/seed.ts`                                                        | Database operations         |
| 185 | Part 16        | `prisma/schema.prisma`                                                  | Database operations         |
| 186 | Part 16        | `prisma/seed.ts`                                                        | Database operations         |
| 187 | Part 16        | `lib/auth/auth-options.ts`                                              | Security & Fraud Detection  |
| 188 | Part 16        | `lib/auth/session.ts`                                                   | Security & Fraud Detection  |
| 189 | Part 16        | `lib/auth/session-tracker.ts`                                           | Security & Fraud Detection  |
| 190 | Part 16        | `lib/auth/permissions.ts`                                               | Security & Fraud Detection  |
| 191 | Part 16        | `lib/auth/errors.ts`                                                    | Security & Fraud Detection  |
| 192 | Part 16        | `lib/auth/two-factor.ts`                                                | Security & Fraud Detection  |
| 193 | Part 16        | `lib/tier-config.ts`                                                    | Libraries/Utilities         |
| 194 | Part 16        | `lib/tier-validation.ts`                                                | Validation schemas          |
| 195 | Part 16        | `lib/tier-helpers.ts`                                                   | Libraries/Utilities         |
| 196 | Part 16        | `lib/tier/constants.ts`                                                 | Libraries/Utilities         |
| 197 | Part 16        | `lib/tier/validator.ts`                                                 | Validation schemas          |
| 198 | Part 16        | `lib/tier/index.ts`                                                     | Libraries/Utilities         |
| 199 | Part 16        | `lib/errors/api-error.ts`                                               | Libraries/Utilities         |
| 200 | Part 16        | `lib/errors/error-handler.ts`                                           | Libraries/Utilities         |
| 201 | Part 16        | `lib/errors/error-logger.ts`                                            | Libraries/Utilities         |
| 202 | Part 16        | `lib/validations/auth.ts`                                               | Validation schemas          |
| 203 | Part 16        | `lib/validations/alert.ts`                                              | Validation schemas          |
| 204 | Part 16        | `lib/validations/watchlist.ts`                                          | Validation schemas          |
| 205 | Part 16        | `lib/validations/user.ts`                                               | Validation schemas          |
| 206 | Part 16        | `lib/redis/client.ts`                                                   | Database operations         |
| 207 | Part 16        | `lib/cache/cache-manager.ts`                                            | Libraries/Utilities         |
| 208 | Part 16        | `lib/email/email.ts`                                                    | Templates                   |
| 209 | Part 16        | `lib/email/subscription-emails.ts`                                      | Templates                   |
| 210 | Part 16        | `lib/email/templates/affiliate/code-distributed.tsx`                    | Templates                   |
| 211 | Part 16        | `lib/email/templates/affiliate/code-used.tsx`                           | Templates                   |
| 212 | Part 16        | `lib/email/templates/affiliate/monthly-report.tsx`                      | Templates                   |
| 213 | Part 16        | `lib/email/templates/affiliate/payment-processed.tsx`                   | Templates                   |
| 214 | Part 16        | `lib/email/templates/affiliate/welcome.tsx`                             | Templates                   |
| 215 | Part 16        | `emails/index.ts`                                                       | Templates                   |
| 216 | Part 16        | `emails/payment-confirmation.tsx`                                       | Templates                   |
| 217 | Part 16        | `emails/payment-failure.tsx`                                            | Templates                   |
| 218 | Part 16        | `emails/renewal-reminder.tsx`                                           | Templates                   |
| 219 | Part 16        | `emails/subscription-expired.tsx`                                       | Templates                   |
| 220 | Part 16        | `lib/utils/helpers.ts`                                                  | Libraries/Utilities         |
| 221 | Part 16        | `lib/utils/formatters.ts`                                               | Libraries/Utilities         |
| 222 | Part 16        | `lib/utils/constants.ts`                                                | Libraries/Utilities         |
| 223 | Part 16        | `lib/api/index.ts`                                                      | Libraries/Utilities         |
| 224 | Part 16        | `lib/api/mt5-client.ts`                                                 | Libraries/Utilities         |
| 225 | Part 16        | `lib/api/mt5-transform.ts`                                              | Libraries/Utilities         |
| 226 | Part 16        | `hooks/use-alerts.ts`                                                   | React hooks                 |
| 227 | Part 16        | `hooks/use-auth.ts`                                                     | React hooks                 |
| 228 | Part 16        | `hooks/use-indicators.ts`                                               | React hooks                 |
| 229 | Part 16        | `hooks/use-login-tracking.ts`                                           | React hooks                 |
| 230 | Part 16        | `hooks/use-optimistic-mutation.ts`                                      | React hooks                 |
| 231 | Part 16        | `hooks/use-toast.ts`                                                    | React hooks                 |
| 232 | Part 16        | `hooks/use-watchlist.ts`                                                | React hooks                 |
| 233 | Part 16        | `hooks/use-websocket.ts`                                                | React hooks                 |
| 234 | Part 16        | `lib/hooks/useAffiliateConfig.ts`                                       | React hooks                 |
| 235 | Part 16        | `types/index.ts`                                                        | Type Definitions            |
| 236 | Part 16        | `types/alert.ts`                                                        | Type Definitions            |
| 237 | Part 16        | `types/api.ts`                                                          | Type Definitions            |
| 238 | Part 16        | `types/disbursement.ts`                                                 | Type Definitions            |
| 239 | Part 16        | `types/dlocal.ts`                                                       | Type Definitions            |
| 240 | Part 16        | `types/indicator.ts`                                                    | Type Definitions            |
| 241 | Part 16        | `types/next-auth.d.ts`                                                  | Type Definitions            |
| 242 | Part 16        | `types/payment.ts`                                                      | Type Definitions            |
| 243 | Part 16        | `types/prisma-stubs.d.ts`                                               | Type Definitions            |
| 244 | Part 16        | `types/tier.ts`                                                         | Type Definitions            |
| 245 | Part 16        | `types/user.ts`                                                         | Type Definitions            |
| 246 | Part 16        | `types/watchlist.ts`                                                    | Type Definitions            |
| 247 | Part 16        | `lib/constants/business-rules.ts`                                       | Libraries/Utilities         |
| 248 | Part 16        | `lib/cron/check-expiring-subscriptions.ts`                              | Other (background jobs)     |
| 249 | Part 16        | `lib/cron/downgrade-expired-subscriptions.ts`                           | Other (background jobs)     |
| 250 | Part 16        | `lib/cron/monthly-distribution.ts`                                      | Other (background jobs)     |
| 251 | Part 16        | `lib/jobs/alert-checker.ts`                                             | Other (background jobs)     |
| 252 | Part 16        | `lib/jobs/queue.ts`                                                     | Other (background jobs)     |
| 253 | Part 16        | `lib/websocket/server.ts`                                               | Middleware & Infrastructure |
| 254 | Part 16        | `lib/websocket/use-mt5-websocket.ts`                                    | React hooks                 |
| 255 | Part 16        | `lib/security/device-detection.ts`                                      | Security & Fraud Detection  |
| 256 | Part 16        | `lib/fraud/fraud-detection.service.ts`                                  | Security & Fraud Detection  |
| 257 | Part 16        | `lib/monitoring/system-monitor.ts`                                      | Libraries/Utilities         |
| 258 | Part 16        | `lib/geo/detect-country.ts`                                             | Libraries/Utilities         |
| 259 | Part 16        | `lib/preferences/defaults.ts`                                           | Libraries/Utilities         |
| 260 | Part 16        | `middleware/tier-check.ts`                                              | Middleware & Infrastructure |
| 261 | Part 16        | `app/error.tsx`                                                         | Other (error handling)      |
| 262 | Part 16        | `app/globals.css`                                                       | Configuration files         |
| 263 | Part 16        | `next.config.js`                                                        | Configuration files         |
| 264 | Part 16        | `tailwind.config.ts`                                                    | Configuration files         |
| 265 | Part 16        | `postcss.config.js`                                                     | Configuration files         |
| 266 | Part 16        | `jest.config.js`                                                        | Configuration files         |
| 267 | Part 16        | `tsconfig.json`                                                         | Configuration files         |
| 268 | Part 16        | `components.json`                                                       | Configuration files         |
| 269 | Part 16        | `.github/workflows/tests.yml`                                           | Configuration files         |
| 270 | Part 16        | `.github/workflows/deploy.yml`                                          | Configuration files         |
| 271 | Part 16        | `.github/workflows/api-tests.yml`                                       | Configuration files         |
| 272 | Part 16        | `.github/workflows/bundle-monitor.yml`                                  | Configuration files         |
| 273 | Part 16        | `.github/workflows/ci-nextjs-progressive.yml`                           | Configuration files         |
| 274 | Part 16        | `.github/workflows/dependencies-security.yml`                           | Configuration files         |
| 275 | Part 16        | `.github/workflows/e2e-tests.yml`                                       | Configuration files         |
| 276 | Part 16        | `.github/workflows/load-test.yml`                                       | Configuration files         |
| 277 | Part 16        | `.github/workflows/mt5-pipeline-tests.yml`                              | Configuration files         |
| 278 | Part 16        | `.github/workflows/openapi-validation.yml`                              | Configuration files         |
| 279 | Part 16        | `.github/workflows/security-checks.yml`                                 | Configuration files         |
| 280 | Part 16        | `docker-compose.yml`                                                    | Configuration files         |
| 281 | Part 16        | `.dockerignore`                                                         | Configuration files         |
| 282 | Part 16        | `public/manifest.json`                                                  | Configuration files         |
| 283 | Part 16        | `scripts/validate-file.js`                                              | Other (scripts)             |
| 284 | Part 16        | `scripts/validate_sqlite.py`                                            | Other (scripts)             |
| 285 | Part 16        | `scripts/health-check-ui.js`                                            | Other (scripts)             |
| 286 | Part 16        | `scripts/health-check-ui.sh`                                            | Other (scripts)             |
| 287 | Part 16        | `scripts/monitor-mt5-pipeline.ts`                                       | Other (scripts)             |
| 288 | Part 16        | `scripts/test-mt5-deployment.ts`                                        | Other (scripts)             |
| 289 | Part 16        | `scripts/test-prisma5-upgrade.ts`                                       | Other (scripts)             |
| 290 | Part 16        | `scripts/run-all-tests.sh`                                              | Other (scripts)             |
| 291 | Part 16        | `scripts/collect-metrics.sh`                                            | Other (scripts)             |
| 292 | Part 16        | `scripts/check-sync-needed.js`                                          | Other (scripts)             |
| 293 | Part 16        | `scripts/check-coverage.js`                                             | Other (scripts)             |
| 294 | Part 16        | `scripts/archive-docs.sh`                                               | Other (scripts)             |
| 295 | Part 16        | `scripts/deploy-part20.sh`                                              | Other (scripts)             |
| 296 | Part 16        | `scripts/sync-frontend.sh`                                              | Other (scripts)             |
| 297 | Part 16        | `scripts/setup-e2e.sh`                                                  | Other (scripts)             |
| 298 | Part 16        | `scripts/rollback-to-part6.sh`                                          | Other (scripts)             |
| 299 | Part 16        | `scripts/verify-alignment.sh`                                           | Other (scripts)             |
| 300 | Part 16        | `scripts/verify-build-orders.sh`                                        | Other (scripts)             |
| 301 | Part 16        | `lib/tier/__tests__/constants.test.ts`                                  | Other (tests)               |
| 302 | Part 16        | `lib/tier/__tests__/validator.test.ts`                                  | Other (tests)               |
| 303 | Part 17A-1     | `__tests__/setup.ts`                                                    | Other (tests)               |
| 304 | Part 17A-1     | `__tests__/helpers/supertest-setup.ts`                                  | Other (tests)               |
| 305 | Part 17A-1     | `lib/affiliate/constants.ts`                                            | Libraries/Utilities         |
| 306 | Part 17A-1     | `lib/affiliate/types.ts`                                                | Type Definitions            |
| 307 | Part 17A-1     | `lib/affiliate/code-generator.ts`                                       | Libraries/Utilities         |
| 308 | Part 17A-1     | `lib/affiliate/commission-calculator.ts`                                | Libraries/Utilities         |
| 309 | Part 17A-1     | `lib/affiliate/report-builder.ts`                                       | Libraries/Utilities         |
| 310 | Part 17A-1     | `lib/affiliate/validators.ts`                                           | Validation schemas          |
| 311 | Part 17A-1     | `lib/affiliate/registration.ts`                                         | Libraries/Utilities         |
| 312 | Part 17A-1     | `lib/email/templates/affiliate/welcome.tsx`                             | Templates                   |
| 313 | Part 17A-1     | `lib/email/templates/affiliate/code-distributed.tsx`                    | Templates                   |
| 314 | Part 17A-1     | `lib/email/templates/affiliate/code-used.tsx`                           | Templates                   |
| 315 | Part 17A-1     | `__tests__/lib/affiliate/code-generator.test.ts`                        | Other (tests)               |
| 316 | Part 17A-1     | `__tests__/lib/affiliate/commission-calculator.test.ts`                 | Other (tests)               |
| 317 | Part 17A-1     | `__tests__/lib/affiliate/registration.test.ts`                          | Other (tests)               |
| 318 | Part 17A-1     | `app/api/affiliate/auth/register/route.ts`                              | API routes                  |
| 319 | Part 17A-1     | `app/api/affiliate/auth/verify-email/route.ts`                          | API routes                  |
| 320 | Part 17A-1     | `app/api/affiliate/dashboard/stats/route.ts`                            | API routes                  |
| 321 | Part 17A-1     | `app/api/affiliate/dashboard/codes/route.ts`                            | API routes                  |
| 322 | Part 17A-1     | `app/api/affiliate/dashboard/code-inventory/route.ts`                   | API routes                  |
| 323 | Part 17A-1     | `app/api/affiliate/dashboard/commission-report/route.ts`                | API routes                  |
| 324 | Part 17A-1     | `app/api/affiliate/profile/route.ts`                                    | API routes                  |
| 325 | Part 17A-1     | `app/api/affiliate/profile/payment/route.ts`                            | API routes                  |
| 326 | Part 17A-1     | `app/api/checkout/validate-code/route.ts`                               | API routes                  |
| 327 | Part 17A-1     | `app/api/checkout/route.ts`                                             | API routes                  |
| 328 | Part 17A-1     | `app/api/config/affiliate/route.ts`                                     | API routes                  |
| 329 | Part 17A-2     | `__tests__/api/affiliate-registration.test.ts`                          | Other (tests)               |
| 330 | Part 17A-2     | `__tests__/api/affiliate-dashboard.test.ts`                             | Other (tests)               |
| 331 | Part 17A-2     | `__tests__/api/affiliate-conversion.test.ts`                            | Other (tests)               |
| 332 | Part 17A-2     | `components/affiliate/index.ts`                                         | Other (exports)             |
| 333 | Part 17A-2     | `__tests__/components/affiliate/stats-card.test.tsx`                    | Other (tests)               |
| 334 | Part 17A-2     | `__tests__/components/affiliate/code-table.test.tsx`                    | Other (tests)               |
| 335 | Part 17A-2     | `__tests__/components/affiliate/commission-table.test.tsx`              | Other (tests)               |
| 336 | Part 17B-1     | `lib/admin/affiliate-management.ts`                                     | Libraries/Utilities         |
| 337 | Part 17B-1     | `app/api/admin/affiliates/route.ts`                                     | API routes                  |
| 338 | Part 17B-1     | `app/api/admin/affiliates/[id]/route.ts`                                | API routes                  |
| 339 | Part 17B-1     | `app/api/admin/affiliates/[id]/distribute-codes/route.ts`               | API routes                  |
| 340 | Part 17B-1     | `app/api/admin/affiliates/[id]/suspend/route.ts`                        | API routes                  |
| 341 | Part 17B-1     | `app/api/admin/affiliates/[id]/reactivate/route.ts`                     | API routes                  |
| 342 | Part 17B-1     | `app/api/admin/affiliates/reports/profit-loss/route.ts`                 | API routes                  |
| 343 | Part 17B-1     | `app/api/admin/affiliates/reports/sales-performance/route.ts`           | API routes                  |
| 344 | Part 17B-1     | `app/api/admin/affiliates/reports/commission-owings/route.ts`           | API routes                  |
| 345 | Part 17B-1     | `app/api/admin/affiliates/reports/code-inventory/route.ts`              | API routes                  |
| 346 | Part 17B-1     | `app/api/admin/settings/affiliate/route.ts`                             | API routes                  |
| 347 | Part 17B-1     | `__tests__/lib/admin/affiliate-management.test.ts`                      | Other (tests)               |
| 348 | Part 17B-2     | `app/api/cron/distribute-codes/route.ts`                                | API routes                  |
| 349 | Part 17B-2     | `app/api/cron/expire-codes/route.ts`                                    | API routes                  |
| 350 | Part 17B-2     | `app/api/cron/send-monthly-reports/route.ts`                            | API routes                  |
| 351 | Part 17B-2     | `__tests__/api/cron-jobs.test.ts`                                       | Other (tests)               |
| 352 | Part 17B-2     | `__tests__/api/admin-affiliates.test.ts`                                | Other (tests)               |
| 353 | Part 17B-2     | `__tests__/api/disbursement/affiliates.test.ts`                         | Other (tests)               |
| 354 | Part 17B-2     | `__tests__/components/admin/affiliate-filters.test.tsx`                 | Other (tests)               |
| 355 | Part 17B-2     | `__tests__/components/admin/affiliate-stats-banner.test.tsx`            | Other (tests)               |
| 356 | Part 17B-2     | `lib/email/templates/affiliate/payment-processed.tsx`                   | Templates                   |
| 357 | Part 17B-2     | `lib/email/templates/affiliate/monthly-report.tsx`                      | Templates                   |
| 358 | Part 17B-2     | `app/api/disbursement/reports/affiliate/[affiliateId]/route.ts`         | API routes                  |
| 359 | Part 18A       | `types/dlocal.ts`                                                       | Type Definitions            |
| 360 | Part 18A       | `lib/dlocal/constants.ts`                                               | Libraries/Utilities         |
| 361 | Part 18A       | `__tests__/types/dlocal.test.ts`                                        | Other (tests)               |
| 362 | Part 18A       | `__tests__/lib/dlocal/constants.test.ts`                                | Other (tests)               |
| 363 | Part 18A       | `lib/dlocal/currency-converter.service.ts`                              | Libraries/Utilities         |
| 364 | Part 18A       | `lib/dlocal/payment-methods.service.ts`                                 | Libraries/Utilities         |
| 365 | Part 18A       | `lib/dlocal/dlocal-payment.service.ts`                                  | Libraries/Utilities         |
| 366 | Part 18A       | `lib/geo/detect-country.ts`                                             | Libraries/Utilities         |
| 367 | Part 18A       | `lib/logger.ts`                                                         | Libraries/Utilities         |
| 368 | Part 18A       | `__tests__/lib/dlocal/currency-converter.test.ts`                       | Other (tests)               |
| 369 | Part 18A       | `__tests__/lib/dlocal/payment-methods.test.ts`                          | Other (tests)               |
| 370 | Part 18A       | `__tests__/lib/dlocal/dlocal-payment.test.ts`                           | Other (tests)               |
| 371 | Part 18A       | `__tests__/lib/geo/detect-country.test.ts`                              | Other (tests)               |
| 372 | Part 18A       | `app/api/payments/dlocal/methods/route.ts`                              | API routes                  |
| 373 | Part 18A       | `app/api/payments/dlocal/exchange-rate/route.ts`                        | API routes                  |
| 374 | Part 18A       | `app/api/payments/dlocal/convert/route.ts`                              | API routes                  |
| 375 | Part 18A       | `app/api/payments/dlocal/create/route.ts`                               | API routes                  |
| 376 | Part 18A       | `app/api/payments/dlocal/[paymentId]/route.ts`                          | API routes                  |
| 377 | Part 18A       | `app/api/webhooks/dlocal/route.ts`                                      | API routes                  |
| 378 | Part 18A       | `__tests__/api/webhooks/dlocal/route.test.ts`                           | Other (tests)               |
| 379 | Part 18A       | `__tests__/integration/payment-creation.test.ts`                        | Other (tests)               |
| 380 | Part 18A       | `frontend/types/dlocal.ts`                                              | Type Definitions            |
| 381 | Part 18A       | `frontend/lib/dlocal/constants.ts`                                      | Libraries/Utilities         |
| 382 | Part 18A       | `frontend/lib/dlocal/currency-converter.service.ts`                     | Libraries/Utilities         |
| 383 | Part 18A       | `frontend/lib/dlocal/payment-methods.service.ts`                        | Libraries/Utilities         |
| 384 | Part 18A       | `frontend/lib/dlocal/dlocal-payment.service.ts`                         | Libraries/Utilities         |
| 385 | Part 18A       | `frontend/lib/dlocal/three-day-validator.service.ts`                    | Libraries/Utilities         |
| 386 | Part 18A       | `frontend/app/api/payments/dlocal/methods/route.ts`                     | API routes                  |
| 387 | Part 18A       | `frontend/app/api/payments/dlocal/exchange-rate/route.ts`               | API routes                  |
| 388 | Part 18A       | `frontend/app/api/payments/dlocal/convert/route.ts`                     | API routes                  |
| 389 | Part 18A       | `frontend/app/api/payments/dlocal/create/route.ts`                      | API routes                  |
| 390 | Part 18A       | `frontend/app/api/payments/dlocal/[paymentId]/route.ts`                 | API routes                  |
| 391 | Part 18A       | `frontend/app/api/payments/dlocal/validate-discount/route.ts`           | API routes                  |
| 392 | Part 18A       | `frontend/app/api/payments/dlocal/check-three-day-eligibility/route.ts` | API routes                  |
| 393 | Part 18B       | `lib/dlocal/three-day-validator.service.ts`                             | Libraries/Utilities         |
| 394 | Part 18B       | `lib/cron/check-expiring-subscriptions.ts`                              | Other (background jobs)     |
| 395 | Part 18B       | `lib/cron/downgrade-expired-subscriptions.ts`                           | Other (background jobs)     |
| 396 | Part 18B       | `__tests__/lib/dlocal/three-day-validator.test.ts`                      | Other (tests)               |
| 397 | Part 18B       | `__tests__/lib/cron/check-expiring-subscriptions.test.ts`               | Other (tests)               |
| 398 | Part 18B       | `__tests__/lib/cron/downgrade-expired-subscriptions.test.ts`            | Other (tests)               |
| 399 | Part 18B       | `app/api/webhooks/dlocal/route.ts`                                      | API routes                  |
| 400 | Part 18B       | `__tests__/api/webhooks/dlocal/route.test.ts`                           | Other (tests)               |
| 401 | Part 18B       | `app/api/cron/check-expiring-subscriptions/route.ts`                    | API routes                  |
| 402 | Part 18B       | `app/api/cron/downgrade-expired-subscriptions/route.ts`                 | API routes                  |
| 403 | Part 18B       | `app/api/payments/dlocal/check-three-day-eligibility/route.ts`          | API routes                  |
| 404 | Part 18B       | `app/api/subscription/route.ts`                                         | API routes                  |
| 405 | Part 18B       | `app/api/invoices/route.ts`                                             | API routes                  |
| 406 | Part 18B       | `lib/stripe/stripe.ts`                                                  | Libraries/Utilities         |
| 407 | Part 18B       | `lib/stripe/webhook-handlers.ts`                                        | Libraries/Utilities         |
| 408 | Part 18B       | `lib/email/subscription-emails.ts`                                      | Templates                   |
| 409 | Part 18B       | `vercel.json`                                                           | Configuration files         |
| 410 | Part 18C       | `components/payments/index.ts`                                          | Other (exports)             |
| 411 | Part 18C       | `__tests__/components/payments/PlanSelector.test.tsx`                   | Other (tests)               |
| 412 | Part 18C       | `__tests__/components/payments/PriceDisplay.test.tsx`                   | Other (tests)               |
| 413 | Part 18C       | `emails/payment-confirmation.tsx`                                       | Templates                   |
| 414 | Part 18C       | `emails/renewal-reminder.tsx`                                           | Templates                   |
| 415 | Part 18C       | `emails/subscription-expired.tsx`                                       | Templates                   |
| 416 | Part 18C       | `emails/payment-failure.tsx`                                            | Templates                   |
| 417 | Part 18C       | `emails/index.ts`                                                       | Templates                   |
| 418 | Part 18C       | `app/api/admin/fraud-alerts/route.ts`                                   | API routes                  |
| 419 | Part 18C       | `app/api/admin/fraud-alerts/[id]/route.ts`                              | API routes                  |
| 420 | Part 18C       | `app/api/payments/dlocal/validate-discount/route.ts`                    | API routes                  |
| 421 | Part 18C       | `__tests__/e2e/dlocal-payment-flow.test.ts`                             | Other (tests)               |
| 422 | Part 18C       | `frontend/components/payments/index.ts`                                 | Other (exports)             |
| 423 | Part 19A       | `types/disbursement.ts`                                                 | Type Definitions            |
| 424 | Part 19A       | `lib/disbursement/constants.ts`                                         | Libraries/Utilities         |
| 425 | Part 19A       | `lib/disbursement/providers/base-provider.ts`                           | Libraries/Utilities         |
| 426 | Part 19A       | `lib/disbursement/providers/mock-provider.ts`                           | Libraries/Utilities         |
| 427 | Part 19A       | `lib/disbursement/providers/provider-factory.ts`                        | Libraries/Utilities         |
| 428 | Part 19A       | `lib/disbursement/providers/rise/rise-provider.ts`                      | Libraries/Utilities         |
| 429 | Part 19A       | `lib/disbursement/providers/rise/siwe-auth.ts`                          | Security & Fraud Detection  |
| 430 | Part 19A       | `lib/disbursement/providers/rise/webhook-verifier.ts`                   | Security & Fraud Detection  |
| 431 | Part 19A       | `lib/disbursement/providers/rise/amount-converter.ts`                   | Libraries/Utilities         |
| 432 | Part 19A       | `lib/disbursement/services/commission-aggregator.ts`                    | Libraries/Utilities         |
| 433 | Part 19A       | `lib/disbursement/services/payout-calculator.ts`                        | Libraries/Utilities         |
| 434 | Part 19A       | `__tests__/types/disbursement.test.ts`                                  | Other (tests)               |
| 435 | Part 19A       | `__tests__/lib/disbursement/constants.test.ts`                          | Other (tests)               |
| 436 | Part 19A       | `__tests__/lib/disbursement/providers/mock.test.ts`                     | Other (tests)               |
| 437 | Part 19A       | `__tests__/lib/disbursement/providers/factory.test.ts`                  | Other (tests)               |
| 438 | Part 19A       | `__tests__/lib/disbursement/providers/rise/webhook.test.ts`             | Other (tests)               |
| 439 | Part 19A       | `__tests__/lib/disbursement/services/aggregator.test.ts`                | Other (tests)               |
| 440 | Part 19B       | `lib/disbursement/services/batch-manager.ts`                            | Libraries/Utilities         |
| 441 | Part 19B       | `lib/disbursement/services/payment-orchestrator.ts`                     | Libraries/Utilities         |
| 442 | Part 19B       | `lib/disbursement/services/retry-handler.ts`                            | Libraries/Utilities         |
| 443 | Part 19B       | `lib/disbursement/services/transaction-logger.ts`                       | Libraries/Utilities         |
| 444 | Part 19B       | `lib/disbursement/services/transaction-service.ts`                      | Libraries/Utilities         |
| 445 | Part 19B       | `app/api/disbursement/affiliates/payable/route.ts`                      | API routes                  |
| 446 | Part 19B       | `app/api/disbursement/affiliates/[affiliateId]/route.ts`                | API routes                  |
| 447 | Part 19B       | `app/api/disbursement/affiliates/[affiliateId]/commissions/route.ts`    | API routes                  |
| 448 | Part 19B       | `app/api/disbursement/riseworks/accounts/route.ts`                      | API routes                  |
| 449 | Part 19B       | `app/api/disbursement/riseworks/sync/route.ts`                          | API routes                  |
| 450 | Part 19B       | `app/api/disbursement/batches/route.ts`                                 | API routes                  |
| 451 | Part 19B       | `app/api/disbursement/batches/preview/route.ts`                         | API routes                  |
| 452 | Part 19B       | `app/api/disbursement/batches/[batchId]/route.ts`                       | API routes                  |
| 453 | Part 19B       | `app/api/disbursement/batches/[batchId]/execute/route.ts`               | API routes                  |
| 454 | Part 19B       | `__tests__/lib/disbursement/services/batch.test.ts`                     | Other (tests)               |
| 455 | Part 19B       | `__tests__/lib/disbursement/services/orchestrator.test.ts`              | Other (tests)               |
| 456 | Part 19B       | `__tests__/api/disbursement/affiliates.test.ts`                         | Other (tests)               |
| 457 | Part 19B       | `__tests__/api/disbursement/batches.test.ts`                            | Other (tests)               |
| 458 | Part 19B       | `__tests__/api/disbursement/execute.test.ts`                            | Other (tests)               |
| 459 | Part 19C       | `lib/disbursement/webhook/event-processor.ts`                           | Libraries/Utilities         |
| 460 | Part 19C       | `app/api/webhooks/riseworks/route.ts`                                   | API routes                  |
| 461 | Part 19C       | `app/api/disbursement/pay/route.ts`                                     | API routes                  |
| 462 | Part 19C       | `app/api/disbursement/reports/summary/route.ts`                         | API routes                  |
| 463 | Part 19C       | `app/api/disbursement/reports/affiliate/[affiliateId]/route.ts`         | API routes                  |
| 464 | Part 19C       | `app/api/disbursement/transactions/route.ts`                            | API routes                  |
| 465 | Part 19C       | `app/api/disbursement/audit-logs/route.ts`                              | API routes                  |
| 466 | Part 19C       | `app/api/disbursement/config/route.ts`                                  | API routes                  |
| 467 | Part 19C       | `app/api/disbursement/health/route.ts`                                  | API routes                  |
| 468 | Part 19C       | `lib/disbursement/cron/disbursement-processor.ts`                       | Other (background jobs)     |
| 469 | Part 19C       | `app/api/cron/process-pending-disbursements/route.ts`                   | API routes                  |
| 470 | Part 19C       | `app/api/cron/sync-riseworks-accounts/route.ts`                         | API routes                  |
| 471 | Part 19C       | `__tests__/api/webhooks/riseworks.test.ts`                              | Other (tests)               |
| 472 | Part 19C       | `__tests__/api/disbursement/pay.test.ts`                                | Other (tests)               |
| 473 | Part 19C       | `__tests__/api/disbursement/reports.test.ts`                            | Other (tests)               |
| 474 | Part 19C       | `__tests__/api/disbursement/audit.test.ts`                              | Other (tests)               |
| 475 | Part 19C       | `__tests__/api/disbursement/health.test.ts`                             | Other (tests)               |
| 476 | Part 19C       | `__tests__/api/cron/process-pending.test.ts`                            | Other (tests)               |
| 477 | Drawing Engine | `components/charts/drawing/geometry/types.ts`                           | Type Definitions            |
| 478 | Drawing Engine | `components/charts/drawing/geometry/trendline.ts`                       | Libraries/Utilities         |
| 479 | Drawing Engine | `components/charts/drawing/geometry/horizontal.ts`                      | Libraries/Utilities         |
| 480 | Drawing Engine | `components/charts/drawing/geometry/channel.ts`                         | Libraries/Utilities         |
| 481 | Drawing Engine | `components/charts/drawing/geometry/fib.ts`                             | Libraries/Utilities         |
| 482 | Drawing Engine | `components/charts/drawing/geometry/levels.ts`                          | Libraries/Utilities         |
| 483 | Drawing Engine | `components/charts/drawing/geometry/index.ts`                           | Libraries/Utilities         |
| 484 | Drawing Engine | `components/charts/drawing/types.ts`                                    | Type Definitions            |
| 485 | Drawing Engine | `components/charts/drawing/engine/coords.ts`                            | Libraries/Utilities         |
| 486 | Drawing Engine | `components/charts/drawing/engine/pixelMath.ts`                         | Libraries/Utilities         |
| 487 | Drawing Engine | `components/charts/drawing/engine/DrawingEngine.ts`                     | Libraries/Utilities         |
| 488 | Drawing Engine | `components/charts/drawing/engine/PointerController.ts`                 | Libraries/Utilities         |
| 489 | Drawing Engine | `components/charts/drawing/marks/BaseMark.ts`                           | Libraries/Utilities         |
| 490 | Drawing Engine | `components/charts/drawing/marks/HorizontalLineMark.ts`                 | Libraries/Utilities         |
| 491 | Drawing Engine | `components/charts/drawing/marks/TrendlineMark.ts`                      | Libraries/Utilities         |
| 492 | Drawing Engine | `components/charts/drawing/marks/ChannelMark.ts`                        | Libraries/Utilities         |
| 493 | Drawing Engine | `components/charts/drawing/marks/FibRetracementMark.ts`                 | Libraries/Utilities         |
| 494 | Drawing Engine | `components/charts/drawing/marks/FibExtensionMark.ts`                   | Libraries/Utilities         |
| 495 | Drawing Engine | `components/charts/drawing/marks/TextMark.ts`                           | Libraries/Utilities         |
| 496 | Drawing Engine | `components/charts/drawing/tools/index.ts`                              | Libraries/Utilities         |
| 497 | Drawing Engine | `__tests__/drawing/geometry/geometry.test.ts`                           | Other (tests)               |
| 498 | Drawing Engine | `__tests__/drawing/engine/pixelMath.test.ts`                            | Other (tests)               |
| 499 | Drawing Engine | `__tests__/drawing/engine/DrawingEngine.test.ts`                        | Other (tests)               |
| 500 | Drawing Engine | `__tests__/drawing/marks/newMarks.test.ts`                              | Other (tests)               |
| 501 | Drawing Engine | `components/charts/drawing/persistence.ts`                              | Libraries/Utilities         |
| 502 | Drawing Engine | `components/charts/drawing/alertsApi.ts`                                | Libraries/Utilities         |
| 503 | Drawing Engine | `components/charts/drawing/tierUsage.ts`                                | Libraries/Utilities         |
| 504 | Drawing Engine | `components/charts/drawing/firedMarkers.ts`                             | Libraries/Utilities         |
| 505 | Drawing Engine | `components/charts/drawing/useFiredAlertMarkers.ts`                     | React hooks                 |
| 506 | Drawing Engine | `lib/drawing/schema.ts`                                                 | Validation schemas          |
| 507 | Drawing Engine | `lib/drawing/invalidate.ts`                                             | Libraries/Utilities         |
| 508 | Drawing Engine | `app/api/drawings/route.ts`                                             | API routes                  |
| 509 | Drawing Engine | `app/api/drawings/[id]/route.ts`                                        | API routes                  |
| 510 | Drawing Engine | `__tests__/drawing/persistence.test.ts`                                 | Other (tests)               |
| 511 | Drawing Engine | `__tests__/drawing/alertsApi.test.ts`                                   | Other (tests)               |
| 512 | Drawing Engine | `__tests__/drawing/tierUsage.test.ts`                                   | Other (tests)               |
| 513 | Drawing Engine | `__tests__/drawing/firedMarkers.test.ts`                                | Other (tests)               |
| 514 | Line Alerts    | `app/api/alerts/line/route.ts`                                          | API routes                  |
| 515 | Line Alerts    | `app/api/alerts/line/[id]/route.ts`                                     | API routes                  |
| 516 | Line Alerts    | `lib/alert-engine/types.ts`                                             | Type Definitions            |
| 517 | Line Alerts    | `lib/alert-engine/detect.ts`                                            | Libraries/Utilities         |
| 518 | Line Alerts    | `lib/alert-engine/state.ts`                                             | Libraries/Utilities         |
| 519 | Line Alerts    | `lib/alert-engine/watches.ts`                                           | Libraries/Utilities         |
| 520 | Line Alerts    | `lib/alert-engine/evaluator.ts`                                         | Libraries/Utilities         |
| 521 | Line Alerts    | `lib/alert-engine/dispatcher.ts`                                        | Libraries/Utilities         |
| 522 | Line Alerts    | `lib/alert-engine/worker.ts`                                            | Other (background jobs)     |
| 523 | Line Alerts    | `lib/alert-engine/notify-bridge.ts`                                     | Libraries/Utilities         |
| 524 | Line Alerts    | `lib/alert-engine/queue.ts`                                             | Other (background jobs)     |
| 525 | Line Alerts    | `scripts/alert-worker.ts`                                               | Other (scripts)             |
| 526 | Line Alerts    | `__tests__/alert-engine/detect.test.ts`                                 | Other (tests)               |
| 527 | Line Alerts    | `__tests__/alert-engine/evaluator.test.ts`                              | Other (tests)               |
| 528 | Line Alerts    | `__tests__/alert-engine/notify-bridge.test.ts`                          | Other (tests)               |
| 529 | Line Alerts    | `__tests__/alert-engine/watches.test.ts`                                | Other (tests)               |
| 530 | Line Alerts    | `mt5-service/REDIS-PUBLISH-SNIPPET.md`                                  | Other (documentation)       |
| 531 | Line Alerts    | `docs/PHASE-5-DELIVERY-AND-REALTIME-SPEC.md`                            | Other (documentation)       |
| 532 | Line Alerts    | `docs/SCALING-BULLMQ-AND-SOCKET-ADAPTER.md`                             | Other (documentation)       |
| 533 | Part 14        | `app/api/admin/affiliates/reports/code-flows/route.ts`                  | API routes                  |
| 534 | Part 17A-1     | `lib/affiliate/conversion-processor.ts`                                 | Libraries/Utilities         |
| 535 | Backend Stack C — Data Pipeline (v2.29) | `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md` | Other (documentation) |
| 536 | Backend Stack C — Data Pipeline (v2.29) | `.../v2_29_data_pipeline_architecture/export_collector_validator_v2.py` | Other (background jobs)     |
| 537 | Backend Stack C — Data Pipeline (v2.29) | `.../v2_29_data_pipeline_architecture/centroid_regression.py`          | Libraries/Utilities         |
| 538 | Backend Stack C — Data Pipeline (v2.29) | `.../v2_29_data_pipeline_architecture/fractal_lines.py`                | Libraries/Utilities         |
| 539 | Backend Stack C — Data Pipeline (v2.29) | `.../v2_29_data_pipeline_architecture/zigzag_metrics.py`               | Libraries/Utilities         |
| 540 | Backend Stack C — Data Pipeline (v2.29) | `.../v2_29_data_pipeline_architecture/zscore_candle.py`                | Libraries/Utilities         |
| 541 | Backend Stack C — Data Pipeline (v2.29) | `.../v2_29_data_pipeline_architecture/sqlite_schema_v6_xauusd.sql`     | Database operations         |
| 542 | Backend Stack C — Data Pipeline (v2.29) | `.../v2_29_data_pipeline_architecture/sqlite_schema_v6_xauusd_preview.txt` | Other (documentation)   |
| 543 | Backend Stack C — Data Pipeline (v2.29) | `.../v2_29_data_pipeline_architecture/backfill_worker_api_gateway_v5.py` | Other (background jobs)    |
| 544 | Backend Stack C — Data Pipeline (v2.29) | `.../v2_29_data_pipeline_architecture/gateway_contract_market_data.schema.json` | Configuration files  |
| 545 | Backend Stack C — Data Pipeline (v2.29) | `.../v2_29_data_pipeline_architecture/replay_quarantine.py`            | Other (scripts)              |
| 546 | Backend Stack C — Data Pipeline (v2.29) | `.../v2_29_data_pipeline_architecture/install_services.bat`            | Configuration files          |
| 547 | Backend Stack C — Data Pipeline (v2.29) | `.../mq5/2EDTCentroidRegressionBestFitNonMostRecent_v2_29.mq5`         | Other (MQL5 indicator source) |
| 548 | Backend Stack C — Data Pipeline (v2.29) | `.../mq5/2EDTCentroidRegressionCherryPickA_v2_29.mq5`                  | Other (MQL5 indicator source) |
| 549 | Backend Stack C — Data Pipeline (v2.29) | `.../mq5/2EDTCentroidRegressionCherryPickB_v2_29.mq5`                  | Other (MQL5 indicator source) |
| 550 | Backend Stack C — Data Pipeline (v2.29) | `.../mq5/2EDTCentroidRegressionMostRecentLineExtension_v2_29.mq5`      | Other (MQL5 indicator source) |
| 551 | Backend Stack C — Data Pipeline (v2.29) | `.../mq5/2EDTCentroidRegressionNonMostRecentLineExtensionA_v2_29.mq5`  | Other (MQL5 indicator source) |
| 552 | Backend Stack C — Data Pipeline (v2.29) | `.../mq5/2EDTCentroidRegressionNonMostRecentLineExtensionB_v2_29.mq5`  | Other (MQL5 indicator source) |
| 553 | Backend Stack C — Data Pipeline (v2.29) | `.../mq5/2EDTFractalBestFitv5_v2_29.mq5`                               | Other (MQL5 indicator source) |
| 554 | Backend Stack C — Data Pipeline (v2.29) | `.../mq5/SingleBestResistanceLinev3_v2_29.mq5`                         | Other (MQL5 indicator source) |
| 555 | Backend Stack C — Data Pipeline (v2.29) | `.../mq5/SingleBestSupportLinev3_v2_29.mq5`                            | Other (MQL5 indicator source) |
| 556 | Backend Stack C — Data Pipeline (v2.29) | `.../mq5/ZigZagExportv43_v2_29.mq5`                                    | Other (MQL5 indicator source) |
| 557 | Backend Stack C — Data Pipeline (v2.29) | `.../mq5/ohlcvexportlightweight_v2_29.mq5`                             | Other (MQL5 indicator source) |
| 558 | Backend Stack C — Data Pipeline (v2.29) | `.../mq5/zscoreohlccandleexport_v2_29.mq5`                             | Other (MQL5 indicator source) |
| 559 | Backend Stack C — Data Pipeline (v2.29) | `.../SimpleDataCollector_v2_29_ASYNC_SOCKET.mq5` (legacy)              | Other (documentation)        |
| 560 | Backend Stack C — Data Pipeline (v2.29) | `.../SimpleDataCollector_v2_29_ASYNC_SOCKET.ex5` (legacy, compiled)    | Other (documentation)        |
| 561 | Backend Stack C — Data Pipeline (v2.29) | `.../mt5_api_relay_for_v2_29.py` (legacy)                              | Other (background jobs)      |
| 562 | Backend Stack C — Data Pipeline (v2.29) | `.../mql5-to-python-transliteration/golden_certification.py`          | Other (tests)                |
| 563 | Backend Stack C — Data Pipeline (v2.29) | `.../mql5-to-python-transliteration/golden_certification_report_M5.txt` | Other (tests)               |
| 564 | Backend Stack C — Data Pipeline (v2.29) | `.../mql5-to-python-transliteration/golden_certification_report_M15.txt` | Other (tests)              |
| 565 | Backend Stack C — Data Pipeline (v2.29) | `.../mql5-to-python-transliteration/test_phase1_golden.py`            | Other (tests)                |
| 566 | Backend Stack C — Data Pipeline (v2.29) | `.../mql5-to-python-transliteration/test_phase2_lines.py`             | Other (tests)                |
| 567 | Backend Stack C — Data Pipeline (v2.29) | `.../mql5-to-python-transliteration/test_phase3_centroid.py`          | Other (tests)                |
| 568 | Backend Stack C — Data Pipeline (v2.29) | `.../mql5-to-python-transliteration/CERTIFICATION.md`                 | Other (documentation)        |
| 569 | Backend Stack C — Data Pipeline (v2.29) | `.../mql5-to-python-transliteration/README.md`                        | Other (documentation)        |
| 570 | Backend Stack C — Data Pipeline (v2.29) | `.../data-split-between-mql5-and-python/Export Data from MQL5 indicators.txt` | Other (documentation) |
| 571 | Backend Stack C — Data Pipeline (v2.29) | `.../data-split-between-mql5-and-python/Python stacks calculation.txt` | Other (documentation)       |
| 572 | Backend Stack C — MTF Visualisation (v2.29) | `.../v2_29_multi-timeframe-visualisation/mtf_render/__init__.py`  | Libraries/Utilities          |
| 573 | Backend Stack C — MTF Visualisation (v2.29) | `.../v2_29_multi-timeframe-visualisation/mtf_render/__main__.py`  | Other (scripts)              |
| 574 | Backend Stack C — MTF Visualisation (v2.29) | `.../v2_29_multi-timeframe-visualisation/mtf_render/data_source.py` | Database operations        |
| 575 | Backend Stack C — MTF Visualisation (v2.29) | `.../v2_29_multi-timeframe-visualisation/mtf_render/fixture.py`   | Libraries/Utilities          |
| 576 | Backend Stack C — MTF Visualisation (v2.29) | `.../v2_29_multi-timeframe-visualisation/mtf_render/renderer.py`  | Libraries/Utilities          |
| 577 | Backend Stack C — MTF Visualisation (v2.29) | `.../v2_29_multi-timeframe-visualisation/test_mtf_render.py`      | Other (tests)                |
| 578 | Backend Stack C — MTF Visualisation (v2.29) | `.../v2_29_multi-timeframe-visualisation/requirements.txt`        | Configuration files          |
| 579 | Backend Stack C — MTF Visualisation (v2.29) | `.../v2_29_multi-timeframe-visualisation/Multi-Timeframe-Visualisation-Architecture-Design.md` | Other (documentation) |
| 580 | Backend Stack C — MTF Visualisation (v2.29) | `.../v2_29_multi-timeframe-visualisation/src/VISUALISATION_TASK_HANDOFF.md` | Other (documentation)  |
| 581 | Backend Stack C — MTF Visualisation (v2.29) | `.../v2_29_multi-timeframe-visualisation/src/cover-prompt.md`     | Other (documentation)        |
| 582 | Backend Stack C — MTF Visualisation (v2.29) | `.../v2_29_multi-timeframe-visualisation/src/mtf_demo.png`        | Other (documentation)        |
| 583 | Backend Stack C — MTF Visualisation (v2.29) | `.../v2_29_multi-timeframe-visualisation/src/multi-timeframe-visualisation.jpg` | Other (documentation) |
| 584 | Railway Gateway (NestJS v6 Ingest) | `railway-gateway/.env.example`                                              | Configuration files          |
| 585 | Railway Gateway (NestJS v6 Ingest) | `railway-gateway/README.md`                                                 | Other (documentation)        |
| 586 | Railway Gateway (NestJS v6 Ingest) | `railway-gateway/docker-compose.yml`                                        | Configuration files          |
| 587 | Railway Gateway (NestJS v6 Ingest) | `railway-gateway/jest.config.js`                                            | Configuration files          |
| 588 | Railway Gateway (NestJS v6 Ingest) | `railway-gateway/nest-cli.json`                                             | Configuration files          |
| 589 | Railway Gateway (NestJS v6 Ingest) | `railway-gateway/package.json`                                              | Configuration files          |
| 590 | Railway Gateway (NestJS v6 Ingest) | `railway-gateway/package-lock.json`                                         | Configuration files          |
| 591 | Railway Gateway (NestJS v6 Ingest) | `railway-gateway/railway.toml`                                              | Configuration files          |
| 592 | Railway Gateway (NestJS v6 Ingest) | `railway-gateway/tsconfig.json`                                             | Configuration files          |
| 593 | Railway Gateway (NestJS v6 Ingest) | `railway-gateway/prisma/schema.prisma`                                      | Database operations          |
| 594 | Railway Gateway (NestJS v6 Ingest) | `railway-gateway/scripts/generate-market-data-dto.js`                       | Other (scripts)              |
| 595 | Railway Gateway (NestJS v6 Ingest) | `railway-gateway/scripts/seed_local_xauusd_db.py`                           | Other (scripts)              |
| 596 | Railway Gateway (NestJS v6 Ingest) | `railway-gateway/src/main.ts`                                               | Other (documentation)        |
| 597 | Railway Gateway (NestJS v6 Ingest) | `railway-gateway/src/app.module.ts`                                         | Middleware & Infrastructure  |
| 598 | Railway Gateway (NestJS v6 Ingest) | `railway-gateway/src/auth/api-key.guard.ts`                                 | Security & Fraud Detection  |
| 599 | Railway Gateway (NestJS v6 Ingest) | `railway-gateway/src/gateway/dto/market-data.dto.ts`                        | Type Definitions             |
| 600 | Railway Gateway (NestJS v6 Ingest) | `railway-gateway/src/gateway/gateway.module.ts`                             | Middleware & Infrastructure  |
| 601 | Railway Gateway (NestJS v6 Ingest) | `railway-gateway/src/gateway/market-data.controller.ts`                     | API routes                   |
| 602 | Railway Gateway (NestJS v6 Ingest) | `railway-gateway/src/gateway/validation.service.ts`                         | Validation schemas            |
| 603 | Railway Gateway (NestJS v6 Ingest) | `railway-gateway/src/health/health.controller.ts`                          | API routes                   |
| 604 | Railway Gateway (NestJS v6 Ingest) | `railway-gateway/src/health/health.module.ts`                              | Middleware & Infrastructure  |
| 605 | Railway Gateway (NestJS v6 Ingest) | `railway-gateway/src/prisma/prisma.module.ts`                              | Database operations           |
| 606 | Railway Gateway (NestJS v6 Ingest) | `railway-gateway/src/prisma/prisma.service.ts`                             | Database operations           |
| 607 | Railway Gateway (NestJS v6 Ingest) | `railway-gateway/src/worker/market-data.processor.ts`                      | Other (background jobs)      |
| 608 | Railway Gateway (NestJS v6 Ingest) | `railway-gateway/src/worker/worker.module.ts`                              | Middleware & Infrastructure  |
| 609 | Railway Gateway (NestJS v6 Ingest) | `railway-gateway/test/dto-contract.spec.ts`                                | Other (tests)                 |
| 610 | Railway Gateway (NestJS v6 Ingest) | `railway-gateway/test/jest-e2e.json`                                       | Configuration files            |
| 611 | Railway Gateway (NestJS v6 Ingest) | `railway-gateway/test/local-e2e-harness.md`                                | Other (documentation)         |
| 612 | Railway Gateway (NestJS v6 Ingest) | `railway-gateway/test/market-data.e2e-spec.ts`                             | Other (tests)                  |
| 613 | Railway Gateway (NestJS v6 Ingest) | `railway-gateway/test/validation.service.spec.ts`                          | Other (tests)                  |
| 614 | Line Alerts    | `railway-worker.json`                                                   | Configuration files          |
| 615 | Line Alerts    | `mt5-service/app/redis_pub.py`                                          | Libraries/Utilities          |
| 616 | Line Alerts    | `mt5-service/tests/test_redis_pub.py`                                   | Other (tests)                |
| 617 | Part 02        | `prisma/migrations/20260705000000_add_market_data_v6/migration.sql`     | Database operations          |
| 618 | Part 02        | `prisma/migrations/20260705010000_drop_market_data/migration.sql`       | Database operations          |
| 619 | Line Alerts    | `davintrade-draw-engine-and-line-alerts-stack/Architecture Design Blueprint/DRAWING-ENGINE-AND-LINE-ALERTS-ARCHITECTURE.md` | Other (documentation) |
| 620 | Line Alerts    | `davintrade-draw-engine-and-line-alerts-stack/implementation-progress/implementation-progress-files-and-folder-directory.txt` | Other (documentation) |
| 621 | Line Alerts    | `davintrade-draw-engine-and-line-alerts-stack/Architecture Design Blueprint/Drawing-Engine-Line-Alerts-Architecture-Overview.pptx` | Other (documentation) |
| 622 | Line Alerts    | `davintrade-draw-engine-and-line-alerts-stack/Architecture Design Blueprint/PHASE-4-SMOKE-TEST-RUNBOOK.md` | Other (documentation) |
| 623 | Backend Stack C — Data Pipeline (v2.29) | `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/architecture-document/old-architecture/README.md` | Other (documentation) |

---

## Summary Statistics

> _Approximate figures — see the counting note above the inventory table. The table has 623
> per-Part rows / ~511 unique files; the numbers below are editorial estimates, not derived counts._

### Total Counts

- **Total Backend Files:** 600 (excluding tests)
- **Test Files:** 127
- **Grand Total:** 652 files

### Distribution by Category

| Category                           | File Count | Percentage |
| ---------------------------------- | ---------- | ---------- |
| API routes                         | 166        | 25.7%      |
| Libraries/Utilities                | 173        | 26.7%      |
| Type Definitions                   | 46         | 7.1%       |
| Configuration files                | 47         | 7.3%       |
| Templates                          | 28         | 4.3%       |
| Other (tests)                      | 127        | 19.6%      |
| Security & Fraud Detection         | 22         | 3.4%       |
| Validation schemas                 | 20         | 3.1%       |
| Database operations                | 17         | 2.6%       |
| React hooks                        | 35         | 5.4%       |
| Middleware & Infrastructure        | 11         | 1.7%       |
| Other (background jobs)            | 22         | 3.4%       |
| Other (scripts)                    | 23         | 3.6%       |
| Other (documentation/exports/etc.) | 45         | 6.9%       |

### Distribution by Part

| Part                                               | File Count | Percentage |
| -------------------------------------------------- | ---------- | ---------- |
| Part 02 (Database)                                 | 10         | 1.5%       |
| Part 03 (Types)                                    | 12         | 2.4%       |
| Part 04 (Tier System)                              | 13         | 2.6%       |
| Part 05 (Authentication)                           | 11         | 2.2%       |
| Part 06 (Flask MT5)                                | 29         | 5.8%       |
| Part 07 (Tier Routes)                              | 3          | 0.6%       |
| Part 08 (Dashboard Backend)                        | 11         | 2.2%       |
| Part 09 (Charts Backend)                           | 3          | 0.6%       |
| Part 10 (Watchlist Backend)                        | 4          | 0.8%       |
| Part 11 (Alerts Backend)                           | 8          | 1.6%       |
| Part 12 (E-commerce Backend)                       | 21         | 4.2%       |
| Part 13 (Settings Backend)                         | 16         | 3.2%       |
| Part 14 (Admin Backend)                            | 22         | 3.9%       |
| Part 15 (Notifications Backend)                    | 8          | 1.6%       |
| Part 16 (Infrastructure)                           | 129        | 25.6%      |
| Part 17A-1 (Affiliate Foundation)                  | 23         | 4.1%       |
| Part 17A-2 (Affiliate UI Tests)                    | 7          | 1.4%       |
| Part 17B-1 (Admin Affiliate)                       | 12         | 2.4%       |
| Part 17B-2 (Admin Automation)                      | 10         | 2.0%       |
| Part 18A (dLocal Payment Creation)                 | 36         | 7.1%       |
| Part 18B (dLocal Subscription)                     | 17         | 3.4%       |
| Part 18C (dLocal UX)                               | 10         | 2.0%       |
| Part 19A (Disbursement Foundation)                 | 18         | 3.6%       |
| Part 19B (Disbursement Execution)                  | 19         | 3.8%       |
| Part 19C (Disbursement Automation)                 | 18         | 3.6%       |
| Drawing Engine (Chart Drawing Tools + Persistence) | 37         | 6.6%       |
| Line Alerts (Alert Engine + Realtime)              | 26         | 4.0%       |
| Backend Stack C — Data Pipeline (v2.29)            | 38         | 5.8%       |
| Backend Stack C — MTF Visualisation (v2.29)        | 12         | 1.9%       |
| Railway Gateway (NestJS v6 Ingest)                  | 30         | 4.6%       |

### Key Backend Components

| Component Type           | Count | Purpose                                                           |
| ------------------------ | ----- | ----------------------------------------------------------------- |
| **API Endpoints**        | 164   | REST API routes handling HTTP requests                            |
| **Database Models**      | 30+   | Prisma schema models                                              |
| **Services & Libraries** | 165   | Business logic, utilities, helpers (incl. drawing + alert-engine) |
| **Type Definitions**     | 44    | TypeScript type safety                                            |
| **Background Jobs**      | 16    | Cron jobs and async processing                                    |
| **React Hooks**          | 35    | State management (also used server-side)                          |
| **Email Templates**      | 28    | Transactional emails                                              |
| **Validation Schemas**   | 18    | Zod schemas for input validation                                  |
| **Security Modules**     | 21    | Auth, 2FA, fraud detection                                        |
| **Configuration**        | 34    | App config, CI/CD, Docker                                         |
| **Test Files**           | 116   | Unit, integration, E2E tests                                      |

---

## Backend Architecture Patterns

### API Routes Architecture

- RESTful API design with Next.js App Router
- Protected routes with NextAuth session validation
- Role-based access control (USER, ADMIN)
- Tier-based feature gating (FREE, PRO)

### Database Architecture

- PostgreSQL with Prisma ORM
- 30+ models with relationships
- 57-column flat MarketData schema
- Indexes optimized for query performance

### Service Layer Pattern

- Business logic separated from API routes
- Reusable service modules
- Provider pattern for payment/disbursement
- Factory pattern for provider instantiation

### Background Jobs

- Cron jobs for scheduled tasks
- Webhook processing for external events
- Queue-based job processing
- Retry logic with exponential backoff

### Security Patterns

- Two-factor authentication (TOTP)
- CSRF protection
- Rate limiting
- Webhook signature verification
- Device fingerprinting
- Fraud detection

---

## Technology Stack

### Backend Technologies

- **Runtime:** Node.js 18+
- **Framework:** Next.js 14+ (App Router)
- **ORM:** Prisma 5.x
- **Database:** PostgreSQL
- **Cache:** Redis (planned)
- **Auth:** NextAuth.js
- **Validation:** Zod
- **Email:** Resend / React Email
- **Testing:** Jest, Supertest
- **Python:** Flask (MT5 Service)

### External Services Integration

- **Stripe:** Payment processing
- **dLocal:** Emerging markets payments
- **RiseWorks:** Crypto disbursements
- **MT5:** Trading data (Python)
- **Exchange Rate API:** Currency conversion

---

## Source Files

This inventory was compiled from the following source documents:

1. `docs/files-completion-list/files-inventory/part-02-files-completion.md`
2. `docs/files-completion-list/files-inventory/part-03-files-completion.md`
3. `docs/files-completion-list/files-inventory/part-04-files-completion.md`
4. `docs/files-completion-list/files-inventory/part-05-files-completion.md`
5. `docs/files-completion-list/files-inventory/part-06-files-completion.md`
6. `docs/files-completion-list/files-inventory/part-07-files-completion.md`
7. `docs/files-completion-list/files-inventory/part-08-files-completion.md`
8. `docs/files-completion-list/files-inventory/part-09-files-completion.md`
9. `docs/files-completion-list/files-inventory/part-10-files-completion.md`
10. `docs/files-completion-list/files-inventory/part-11-files-completion.md`
11. `docs/files-completion-list/files-inventory/part-12-files-completion.md`
12. `docs/files-completion-list/files-inventory/part-13-files-completion.md`
13. `docs/files-completion-list/files-inventory/part-14-files-completion.md`
14. `docs/files-completion-list/files-inventory/part-15-files-completion.md`
15. `docs/files-completion-list/files-inventory/part-16-files-completion.md`
16. `docs/files-completion-list/files-inventory/part17a1-files-completion.md`
17. `docs/files-completion-list/files-inventory/part17a2-files-completion.md`
18. `docs/files-completion-list/files-inventory/part17b1-files-completion.md`
19. `docs/files-completion-list/files-inventory/part17b2-files-completion.md`
20. `docs/files-completion-list/files-inventory/part-18a-files-completion.md`
21. `docs/files-completion-list/files-inventory/part-18b-files-completion.md`
22. `docs/files-completion-list/files-inventory/part-18c-files-completion.md`
23. `docs/files-completion-list/files-inventory/part19a-files-completion.md`
24. `docs/files-completion-list/files-inventory/part19b-files-completion.md`
25. `docs/files-completion-list/files-inventory/part19c-files-completion.md`
26. `docs/files-completion-list/files-inventory/part19d-files-completion.md`
27. `docs/files-completion-list/files-inventory/drawing-engine-line-alerts-files-completion.md`
28. `docs/files-completion-list/files-inventory/v2_29_data_pipeline_architecture-files-completion.md`
29. `docs/files-completion-list/files-inventory/v2_29_multi-timeframe-visualisation-files-completion.md`

---

## Reconciliation Note (2026-06-27)

- **Added `hooks/use-ohlcv-socket.ts`** (Part 09, React hooks) — the Socket.IO OHLCV streaming
  hook introduced with the 2026-03-05 WebSocket migration. It existed in the codebase but
  postdated this inventory; now listed (row 89).
- **`frontend/` backend is transitional, not reconciled into this inventory.** The microservice
  end-state is a **UI-only** `frontend/` stack that reaches backend data via the api-client
  (`backend-stack-a/api-client-between-frontend-and-stack-b/*`). The 16 backend files that differ
  between root and `frontend/` (build config: `next.config.js`, `tsconfig.json`, `vercel.json`;
  DB layer: `prisma/*`, `lib/db/*`, `types/prisma-stubs.d.ts`; backend logic: `lib/api/index.ts`,
  `lib/email/email.ts`, `lib/tier-validation.ts`, `lib/tier/*`, `hooks/use-indicators.ts`,
  `types/indicator.ts`) are **intentional divergences** slated for removal from `frontend/`, not
  for sync. This inventory tracks the **root** monolith backend.

## Reconciliation Note (2026-06-28) — Phase 5 (drawing persistence + line alerts)

Added **32 new backend rows** (501–532) for the Phase 5 work pushed to `main`:

- **Drawing Engine (persistence):** `lib/drawing/schema.ts`, `lib/drawing/invalidate.ts`,
  `app/api/drawings/{route,[id]/route}.ts`, the `.ts` client helpers
  (`components/charts/drawing/{persistence,alertsApi,tierUsage,firedMarkers,useFiredAlertMarkers}.ts`),
  and 4 drawing tests.
- **Line Alerts (alert engine):** `app/api/alerts/line/{route,[id]/route}.ts`,
  `lib/alert-engine/*` (types, detect, state, watches, evaluator, dispatcher, worker,
  notify-bridge, queue), `scripts/alert-worker.ts`, 4 alert-engine tests, and the
  `mt5-service/REDIS-PUBLISH-SNIPPET.md` + `docs/PHASE-5-*` / `docs/SCALING-*` specs.

Modified-not-new (already inventoried): `prisma/schema.prisma`, `types/prisma-stubs.d.ts`,
`lib/websocket/server.ts`, `hooks/use-websocket.ts`. The `package.json` `bullmq` +
`@socket.io/redis-adapter` deps support the alert-engine worker/scaling (backend only).

## Reconciliation Note (2026-07-04) — affiliate code-flows report + conversion processor

Added **2 new backend rows** (533–534) for work pushed to `main`:

- `app/api/admin/affiliates/reports/code-flows/route.ts` (Part 14, API routes)
- `lib/affiliate/conversion-processor.ts` (Part 17A-1, Libraries/Utilities)

**Modified-not-new** (already inventoried, content changed only — no rows added):
`app/api/checkout/{route,validate-code/route}.ts`,
`app/api/cron/{distribute-codes,expire-codes,send-monthly-reports}/route.ts`,
`app/api/payments/dlocal/{create,validate-discount}/route.ts`,
`app/api/webhooks/dlocal/route.ts`, `lib/affiliate/report-builder.ts`,
`lib/disbursement/cron/disbursement-processor.ts`,
`lib/disbursement/webhook/event-processor.ts`, `lib/stripe/{stripe,webhook-handlers}.ts`,
`vercel.json`.

This batch is **backend-only** — no frontend UI files were added or changed, so
`frontend-ui-file-inventory.md` is unchanged and nothing was synced into `frontend/`.

## Reconciliation Note (2026-07-05) — v6 XAUUSD pipeline: gateway + backend-stack-c inventory

Added **84 new backend rows** (535–618) — the largest single reconciliation to date. Two
`backend-stack-c` stacks that existed on disk but had never been inventoried are now tracked, plus
the new Railway ingest service and its supporting DB/worker plumbing:

- **Backend Stack C — Data Pipeline (v2.29)** (rows 535–571, 37 files) — the XAUUSD
  MT5-indicators-to-SQLite-to-gateway pipeline: 12 `mq5/` export indicators, the
  collect/validate/calculate/promote engine (`export_collector_validator_v2.py`) + 4 calc modules,
  the v6 SQLite schema, the push worker, the legacy EA/relay (reference only), and the
  certification/test suite (93/93 passing; M15 50/50 exact, M5 39/50 + accepted tolerance). Full
  detail: `files-inventory/v2_29_data_pipeline_architecture-files-completion.md`.
- **Backend Stack C — MTF Visualisation (v2.29)** (rows 572–583, 12 files) — the `mtf_render`
  Python package: reads `market_data`'s computed channel columns and renders the DavinTrade
  3-panel (M5 + 2×M15) chart as a PNG. Backend rendering only; no UI. Full detail:
  `files-inventory/v2_29_multi-timeframe-visualisation-files-completion.md`.
- **Railway Gateway (NestJS v6 Ingest)** (rows 584–613, 30 files, `railway-gateway/`, excludes
  `node_modules/`/`dist/` build output) — new NestJS microservice that receives the Push Worker's
  POSTs, validates against `gateway_contract_market_data.schema.json`, and idempotently upserts
  into the new `market_data_v6` Postgres table (shared with the root Next.js app). This resolves
  the data-pipeline blueprint's "gateway migration" remaining-work item.
- **Line Alerts** (rows 614–616, 3 files) — `railway-worker.json` (Railway deploy config for
  `npm run worker:alerts`, wiring the already-inventoried `scripts/alert-worker.ts` to a real
  deploy target), `mt5-service/app/redis_pub.py` + `mt5-service/tests/test_redis_pub.py` (Flask
  service now publishes each finalized bar/tick to Redis `prices:{symbol}:{timeframe}` for the
  Node alert-engine worker to consume — best-effort, non-blocking on the Socket.IO feed).
- **Part 02** (rows 617–618, 2 files) — the two new Prisma migrations:
  `20260705000000_add_market_data_v6` (additive `market_data_v6` table, 79 gateway-contract
  fields) and `20260705010000_drop_market_data` (drops the old 63-column `MarketData` model —
  EA v2.27-era indicators; confirmed unused by any live app/api route before dropping).

**Modified-not-new** (already inventoried, content changed only — no rows added):

- `prisma/schema.prisma` — `MarketData` model replaced by `MarketDataV6` (`@@map("market_data_v6")`,
  written by both this app's migration and `railway-gateway`'s own Prisma client).
- `types/prisma-stubs.d.ts` — stub type updated from `MarketData` to `MarketDataV6`.
- `__mocks__/@prisma/client.ts` — added `marketDataV6` mock delegate.
- `lib/jobs/alert-checker.ts` — for XAUUSD only, now tries `market_data_v6` (via
  `fetchXauusdPriceFromGatewayPipeline`) before falling back to the Flask MT5 service; every other
  symbol is unaffected.
- `__tests__/lib/db/prisma.test.ts` — removed the retired `marketData` model test suite.
- `__tests__/lib/db/seed.test.ts`, `lib/db/prisma.ts`, `lib/db/seed.ts` — removed stale doc
  comments referencing the retired 63-column schema (no behavior change).
- `__tests__/lib/jobs/alert-checker.test.ts` — added the XAUUSD gateway-first/Flask-fallback test
  suite.
- `package.json` — added the `worker:alerts` script.
- `docker-compose.yml` — added the `alert-worker` service (runs `npm run worker:alerts`, depends on
  `postgres` + `redis`).
- `tsconfig.json` — excludes `railway-gateway` (separate TS project with its own config).
- `backend-stack-c/.../backfill_worker_api_gateway_v5.py` — `API_GATEWAY_URL` now read from env;
  added a startup schema-contract self-check; dropped custom `X-Terminal-ID`/`X-EA-Version`
  headers (`terminal_id` now travels in the POST body).
- `backend-stack-c/.../install_services.bat` — wires `API_GATEWAY_URL` into the `MT5PushWorker`
  service environment.
- `backend-stack-c/.../sqlite_schema_v6_xauusd.sql` — trivial dedup fix, no semantic change.
- `mt5-service/app/websocket.py`, `mt5-service/requirements.txt`, `mt5-service/.env.example` —
  wired in the new `redis_pub.py` publish call, the `redis` dependency, and `REDIS_URL` config.

This batch is **backend-only** — no frontend UI files were added or changed, so
`frontend-ui-file-inventory.md` is unaffected (see its own 2026-07-05 note).

## Reconciliation Note (2026-07-05, addendum) — drawing-engine/line-alerts docs + legacy decommission note

Follow-up sweep caught **5 more files** (rows 619–623) from the same working-tree snapshot that
the first 2026-07-05 pass missed because they weren't in the original change list supplied:

- **`davintrade-draw-engine-and-line-alerts-stack/Architecture Design Blueprint/
  DRAWING-ENGINE-AND-LINE-ALERTS-ARCHITECTURE.md`** (row 619, modified) — backfilled; this
  Phase 0–5 architecture blueprint existed since 2026-06-18 but had never been given its own
  inventory row. The 2026-07-05 edit adds a source-verified status callout confirming the same
  gap-closing work as the main 2026-07-05 note above: the Node worker
  (`lib/alert-engine/*` + `scripts/alert-worker.ts`) and the Flask publisher (`redis_pub.py`) are
  both built and unit-tested, deployment is wired (`docker-compose.yml`'s `alert-worker` service +
  `railway-worker.json`), but the live cross-process round trip (Flask → Redis → Node, over real
  infra) has not been run — no Docker/root Redis access and the project's Railway Postgres was
  unreachable in that environment. Also documents that Phase 5's tool-set gating by tier and the
  draw→alert→fire Playwright e2e are **not** implemented (quotas/ownership checks are real; tool
  gating and e2e coverage are gaps), and flags that the `sync/` "Price persistence pipeline" row in
  its own tech-stack table imports modules not present in this repo (deployed separately as
  "Part 20" on the Contabo VPS per `sync/claude-code-windows-deployment-guide.md`).
- **`davintrade-draw-engine-and-line-alerts-stack/implementation-progress/
  implementation-progress-files-and-folder-directory.txt`** (row 620, modified) — backfilled;
  already referenced as this stack's "source directory listing" in
  `files-inventory/drawing-engine-line-alerts-files-completion.md` but never given its own
  inventory row. The edit only trims a stale terminal-transcript scratch log (pnpm/git commands
  from installing `bullmq`) off the end of the file — no informational content change.
- **`davintrade-draw-engine-and-line-alerts-stack/Architecture Design Blueprint/
  Drawing-Engine-Line-Alerts-Architecture-Overview.pptx`** (row 621, new) — slide-deck companion
  to the architecture blueprint.
- **`davintrade-draw-engine-and-line-alerts-stack/Architecture Design Blueprint/
  PHASE-4-SMOKE-TEST-RUNBOOK.md`** (row 622, new) — manual runbook for the live cross-process
  verification called out as not-yet-run above (docker compose up → migrate → `npm run
  worker:alerts` → cross a price → confirm `Notification` row + `triggerCount`). Documents the
  same environment blockers and the `fakeredis` TCP-delivery limitation hit while trying anyway.
- **`backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/architecture-document/
  old-architecture/README.md`** (row 623, new) — decommission note for the pre-v6 EA lineage
  (`SimpleDataCollector_v2_25/26/27_API_GATEWAY.mq5/.ex5`, `backfill_worker_api_gateway_v2/v3.py`
  — the tema/hrma/smma/Keltner/Heiken-Ashi/8-level-S-R/zigzag_high-low/pinbar/fractal indicator
  set), superseded by `v2_29_data_pipeline_architecture/`. The other 8 files in that
  `old-architecture/` folder it describes are pre-existing (untouched in this change, not newly
  added) and are **not** individually inventoried here, consistent with this batch's scope being
  limited to what actually changed.

Companion doc updated to match:
`files-inventory/drawing-engine-line-alerts-files-completion.md` (2026-07-05 update section added)
and `files-inventory/v2_29_data_pipeline_architecture-files-completion.md` (legacy note
cross-reference added).

Still **backend-only** — `frontend-ui-file-inventory.md` unaffected.

---

**Compiled:** 2026-07-05
**Status:** Complete ✅
