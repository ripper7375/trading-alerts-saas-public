# NestJS Production Readiness Remediation Plan (Revision 2 — Consensus Edition)

> **Reference Standard:** [`davintrade-nest-js-checklists/nestjs-production-checklist.md`](./nestjs-production-checklist.md)  
> **Review Incorporated:** [`davintrade-nest-js-checklists/nestjs-production-remediation-plan-claude-code-recommendation.md`](./nestjs-production-remediation-plan-claude-code-recommendation.md) (Claude Code Executor Review, 2026-10-16)  
> **Handoff for Tier 0–2 Execution:** [`davintrade-nest-js-checklists/nestjs-tier0-tier1-tier2-handoff-for-claude-code.md`](./nestjs-tier0-tier1-tier2-handoff-for-claude-code.md)  
> **Target Codebases:** `operation-service`, `money-service`, `railway-gateway` (plus lockstep auth/webhook mirrors in the Next.js monolith)  
> **Status:** P0 COMPLETED & VERIFIED · TIER 0, TIER 1 AND TIER 2 **EXECUTED AND VERIFIED BY CLAUDE CODE (2026-10-16); NOT COMMITTED, PUSHED, APPLIED OR DEPLOYED** — see the [execution report](./../docs/handoffs/2026-10-16-nestjs-tier0-tier2-execution.md)  
> **Date:** 2026-10-16

### Execution record (Claude Code, 2026-10-16) — corrections for the next revision

All 18 units (0.1, 1.1–1.8, 2.1–2.9) are written and verified; the working tree holds them. Where this plan and the live code disagreed, the live code won. The plan should be corrected as follows:

- **§4.1 / Check 17:** `railway-gateway`'s `npm run lint` matches no files (no ESLint config of its own; the root config ignores the package), so the CI job omits it. `operation-service` builds `packages/types` before `tsc`.
- **§5.4:** `money-service/src/redis/redis.service.ts` is **not** the reference: it has the same `if (times > 10) return null` give-up. Only `operation-service` was fixed (finding open).
- **§5.7:** the four gateway ingestion controllers have no `limit`/`offset`; `notifications.controller` was already Zod-validated. The unguarded sites were `operation-service/src/users/users.controller.ts` (`login-history`, `security-alerts`) and `railway-gateway/src/gateway/active-indicator.controller.ts`.
- **§6.2:** the reason string is `'ALREADY_USED'`, not `'Code already used'`. `reserveAffiliateCode` has the same race (the Stripe path) and is not yet fixed.
- **§6.6:** `OutboxEvent` has **no `updatedAt`**; the claim time is stored in `processedAt`.
- **§6.9:** `AlertCronScheduler` uses `@Interval`, not `@Cron`.
- **New migration:** `prisma/migrations/20261016000000_add_processed_webhook_events_and_commission_uniqueness` (file only; pre-flight queries in its header must return zero rows before it is applied).
- **New runtime requirement:** money-service now refuses to start a checkout without `NEXTAUTH_URL` and a dLocal payment without `DLOCAL_API_KEY` (§6.5).

---

## 1. Executive Summary & Revised Phasing Architecture

Following Claude Code's line-by-line verification of Draft 1 against commit `0386e5dc`, the migration cutover table (`docs/migration-orders/migration-cutover-table.md`), and the published `@nestjs/core@11.2.3` runtime, this Revision 2 establishes the canonical, evidence-verified remediation roadmap across all 17 checks.

### Key Corrections Incorporated from Claude Code's Review

1. **P0 Elevated & Expanded Across Both Codebases (§3 — COMPLETED):** `FIXED_TEST_ACCOUNTS` was active in both `operation-service/src/auth/auth.service.ts` and the Next.js monolith's `lib/auth/auth-options.ts`, bypassed 2FA, and was exposed on the public login page via the `"Quick Test Credentials"` autofill panel in `components/auth/login-form.tsx`. Resolved and verified on 2026-10-16.
2. **Tier 0 Added First — CI Workflows & Railway Runtime Inventory (§4):** None of the 14 GitHub Actions workflows currently executes tests or type-checking for `operation-service`, `money-service`, or `railway-gateway`. CI enablement and a Railway runtime settings inventory precede Tier 1–3 service changes.
3. **Tier 2 Reframes `money-service` as Live Money-Path Defects (§6):** Slices 1, 2, 2W, 3, 4, and 5 are already cut over in production, and the Stripe webhook has been dual-delivered to both the monolith and `money-service` since Session `4A-13`. Tier 2 is ordered strictly by live blast radius.
4. **Inaccurate Draft 1 Claims Removed or Corrected:**
   - _Dropped:_ `approveMaturedCommissions` (already a single atomic `updateMany` in `disbursement-processor.service.ts:80`).
   - _Corrected:_ `ConversionProcessorService.processAffiliateConversion` (`conversion-processor.service.ts:170–207`) is already wrapped in `prisma.$transaction`; the true defect is the `status === 'USED'` check at L145 running outside the transaction before an unconditional `tx.affiliateCode.update` at L172.
   - _Corrected:_ `dlocal-payment.service.ts:127,256` mock fallback returns `PENDING` (causes silent checkout failure with a mock redirect URL, not free `PAID` access).
   - _Corrected:_ `pino-instance.ts` in both services has no `redact` configuration at all today; adding `redact` is pulled forward into **Tier 1**, alongside the one-line `operation-service` Redis `retryStrategy` fix.
   - _Corrected:_ NestJS 11.2.3 runs `onModuleDestroy()` **before** closing the HTTP server (`dispose()`) and before `onApplicationShutdown()`. Calling `prisma.$disconnect()` inside `onModuleDestroy()` severs database connections while in-flight HTTP requests are still running. Moving `$disconnect()` to `onApplicationShutdown()` and passing `{ useProcessExit: true }` to `enableShutdownHooks()` is now part of **Tier 1**.
   - _Moved to Stack D Track:_ The Bull v4 duplicate `jobId` / failed-job replay contract (§7) is owned by the Stack D pipeline track rather than generic Tier 1 hardening, because `cycle-manifest` and `symbol-specs` intentionally rely on Bull's duplicate-`jobId` behavior and `railway-gateway` Watch Paths are currently unset.

---

## 2. Master 17-Check Cross-Reference Matrix (Revision 2)

| Check # | Checklist Topic                                          | `operation-service` | `money-service` | `railway-gateway` | Assigned Phase & Section                                                                              |
| :-----: | :------------------------------------------------------- | :-----------------: | :-------------: | :---------------: | :---------------------------------------------------------------------------------------------------- |
| **01**  | Validate Config at Boot & Keep Secrets Out of Image      |       ❌ Fail       |     ❌ Fail     |      ❌ Fail      | **P0** (§3 ✅) · **Tier 1** (§5.1, §5.2) · **Tier 2** (§6.5) · **Stack D** (§7.2) · **Tier 3** (§8.1) |
| **02**  | Handle `SIGTERM` & Get Container Right (PID 1, Heap)     |     ⚠️ Partial      |   ⚠️ Partial    |      ❌ Fail      | **Tier 0** (§4.2) · **Tier 1** (§5.5, §5.6) · **Tier 3** (§8.2)                                       |
| **03**  | Drain Before You Close (Railway Drain & Lifecycle Order) |       ❌ Fail       |     ❌ Fail     |      ❌ Fail      | **Tier 1** (§5.5) · **Tier 3** (§8.3)                                                                 |
| **04**  | Scheduled Jobs (`@Cron`) & Queue Retention/Locks         |       ❌ Fail       |     ❌ Fail     |      ❌ Fail      | **Tier 2** (§6.6, §6.9) · **Stack D** (§7.1) · **Tier 3** (§8.4)                                      |
| **05**  | Make Authentication Deny-by-Default (`APP_GUARD`)        |       ❌ Fail       |     ❌ Fail     |      ❌ Fail      | **Tier 3** (§8.5)                                                                                     |
| **06**  | Security Headers, CORS, Rate Limits & `trust proxy`      |     ⚠️ Partial      |   ⚠️ Partial    |      ❌ Fail      | **Tier 1** (§5.6) · **Tier 3** (§8.6)                                                                 |
| **07**  | Validate Every Input & Bound List Endpoints              |       ❌ Fail       |     ❌ Fail     |      ❌ Fail      | **Tier 1** (§5.7) · **Tier 3** (§8.7)                                                                 |
| **08**  | Control What Goes Out (DTOs, `select`, Error Leaks)      |     ⚠️ Partial      |     ❌ Fail     |    ⚠️ Partial     | **Tier 3** (§8.8)                                                                                     |
| **09**  | Make Writes Safe to Repeat (Idempotency)                 |       ❌ Fail       |     ❌ Fail     |    ⚠️ Partial     | **Tier 2** (§6.1–§6.4, §6.7, §6.8) · **Stack D** (§7.1)                                               |
| **10**  | Run Current Supported Versions, Dependencies & CI        |     ⚠️ Partial      |   ⚠️ Partial    |      ❌ Fail      | **Tier 0** (§4.1) · **Tier 1** (§5.8) · **Tier 3** (§8.9)                                             |
| **11**  | Time Out Every Outbound Call & DB Statement Timeout      |       ❌ Fail       |     ❌ Fail     |      ❌ Fail      | **Tier 3** (§8.10)                                                                                    |
| **12**  | Plan for Dependencies That Are Down (Resilience)         |       ❌ Fail       |   ⚠️ Partial    |    ⚠️ Partial     | **Tier 1** (§5.4) · **Tier 3** (§8.11)                                                                |
| **13**  | Run Migrations as a Deploy Step                          |       ✅ Pass       |     ✅ Pass     |      ✅ Pass      | **Tier 3** (§8.12 — CI schema drift check)                                                            |
| **14**  | Check Database & Redis Connection Pool Math              |       ❌ Fail       |     ❌ Fail     |      ❌ Fail      | **Tier 0** (§4.2) · **Tier 3** (§8.13)                                                                |
| **15**  | Watch for Request-Scoped Chains (`Scope.DEFAULT`)        |       ✅ Pass       |     ✅ Pass     |      ✅ Pass      | **Compliant** (§8.14)                                                                                 |
| **16**  | Errors: Statuses, Structured Logging & Source Maps       |     ⚠️ Partial      |   ⚠️ Partial    |      ❌ Fail      | **Tier 1** (§5.1, §5.3) · **Tier 3** (§8.15)                                                          |
| **17**  | Logs, Health Checks (Railway Deploy Gate) & Telemetry    |       ❌ Fail       |     ❌ Fail     |      ❌ Fail      | **Stack D** (§7.3) · **Tier 3** (§8.16)                                                               |

---

## 3. P0 — Immediate Production Auth & Login UI Hotfix (✅ COMPLETED & VERIFIED 2026-10-16)

> **Governance Gate:** `⚠ NEEDS EXPLICIT SIGN-OFF` — **AUTHORIZED by Davin & COMPLETED on 2026-10-16.**  
> **Scope:** One verifiable unit across `operation-service`, Next.js monolith `lib/auth/auth-options.ts`, and `components/auth/login-form.tsx`.

### Decisions Taken & Implemented (P0)

1. **Remove Fixed Admin Accounts Altogether:** Deleted `admin@tradingalerts.com` and `admin-test@trading-alerts.test` from `FIXED_TEST_ACCOUNTS` in both `operation-service/src/auth/auth.service.ts` and `lib/auth/auth-options.ts`. Admin authentication in production now always goes through the real database `User` record, bcrypt password verification, `isActive` check, and 2FA check.
2. **Strict Allow-List Environment Gate for Remaining Test Accounts:** Follows the established repository pattern in `app/api/test/seed/route.ts:15,67`. Fixed non-admin test accounts (`free-test@trading-alerts.test`, `pro-test@trading-alerts.test`, `affiliate-test@trading-alerts.test`, `affiliate-pro-test@trading-alerts.test`) are enabled **only** when:
   - In `operation-service`: `process.env['NODE_ENV'] === 'development' || process.env['NODE_ENV'] === 'test'`. (Never when `NODE_ENV` is `'production'` or unset.)
   - In Next.js monolith (`lib/auth/auth-options.ts`): `(runtimeNodeEnv === 'development' || runtimeNodeEnv === 'test' || process.env['VERCEL_ENV'] === 'preview') && process.env['VERCEL_ENV'] !== 'production'`.
3. **Hide `"Quick Test Credentials"` UI Panel in Production:** In `components/auth/login-form.tsx`, removed the `"Admin Test"` and `"Admin (Fixed)"` autofill buttons completely, and gated the `"Quick Test Credentials"` helper panel so it only renders in `development` or `test`.
4. **Production Verification Accounts:** For manual production click-through checks (`waiting-on.md`), use real database-seeded accounts whose passwords are stored only in Davin's password manager and verified through the standard bcrypt + `isActive` + 2FA path.

### Target Files & Changes (P0 — Completed)

1. `operation-service/src/auth/auth.service.ts`:
   - Removed `'admin-test@trading-alerts.test'` and `'admin@tradingalerts.com'` from `FIXED_TEST_ACCOUNTS`.
   - Gated `FIXED_TEST_ACCOUNTS` lookup behind `const isTestAccountsAllowed = process.env['NODE_ENV'] === 'development' || process.env['NODE_ENV'] === 'test';`.
2. `lib/auth/auth-options.ts`:
   - Removed `'admin-test@trading-alerts.test'` and `'admin@tradingalerts.com'` from `FIXED_TEST_ACCOUNTS`.
   - Gated `FIXED_TEST_ACCOUNTS` lookup behind `const isTestAccountsAllowed = (runtimeNodeEnv === 'development' || runtimeNodeEnv === 'test' || process.env['VERCEL_ENV'] === 'preview') && process.env['VERCEL_ENV'] !== 'production';`.
   - Updated the stale comment at `lib/auth/auth-options.ts:144–152` to accurately state how `CredentialsProvider` remains the fallback path when `NEXT_PUBLIC_AUTH_BRIDGE_ENABLED` is off.
3. `components/auth/login-form.tsx`:
   - Gated the `"Quick Test Credentials"` block to `development` / `test` and removed the two Admin buttons (`admin-test@trading-alerts.test` and `admin@tradingalerts.com`).
4. **Tests Verified:**
   - `operation-service/src/auth/auth.service.spec.ts`: `npx tsc --noEmit` (exit 0) + Jest 18/18 passed.
   - `__tests__/components/auth/login-form.test.tsx`: `npx tsc --noEmit` (exit 0) + Jest 13/13 passed.

---

## 4. Tier 0 — Enablers: Service CI Workflows & Railway Runtime Inventory

> **Goal:** Establish automated CI regression gates for all three NestJS services before executing Tier 1–3 refactors, and record the live Railway dashboard configuration that code files cannot see.

### 4.1 [Check 10 & Check 17] GitHub Actions CI for `operation-service`, `money-service`, and `railway-gateway`

- **Current Gap:** None of the 14 workflows in `.github/workflows/` runs `operation-service` (43 suites / 401 tests), `money-service` (66 suites / 650 tests), or `railway-gateway` (unit + e2e + `check:sensor-kit`).
- **Implementation:**
  - Add `.github/workflows/nestjs-services-ci.yml` triggered on pushes/PRs touching `operation-service/**`, `money-service/**`, `railway-gateway/**`, or `packages/types/**`.
  - Run on **Node 22 LTS** (since Node 20 reached EOL on 2026-04-30):
    - `operation-service`: `npm ci`, `npx tsc --noEmit`, `npm test`, `npm run build`
    - `money-service`: `npm ci`, `npx tsc --noEmit`, `npm test`, `npm run build`
    - `railway-gateway`: `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run test:e2e`, `npm run check:sensor-kit`, `npm run build`

### 4.2 Railway & Stripe Runtime Inventory (Davin + Read-Only CLI Inspection)

Before modifying start commands, healthcheck paths, cron locks, or pool limits, record:

1. Per Railway service (`operation-service`, `operation-service-worker`, `money-service`, `railway-gateway`): effective start command, `healthcheckPath`, replica count, memory limit, draining/overlap seconds, Watch Paths, and active Node major version in build logs.
2. Environment flags currently active in production: `CRON_ENABLED`, `WORKER_MODE`, `OUTBOX_PUBLISHER_ENABLED`, `NEXT_PUBLIC_AUTH_BRIDGE_ENABLED`.
3. PostgreSQL `max_connections` and whether PgBouncer fronts `DATABASE_URL`.
4. Whether the monolith Stripe webhook endpoint (`/api/webhooks/stripe`) is still active alongside `money-service` (`/v1/stripe/webhook`) in the Stripe Dashboard.

---

## 5. Tier 1 — Isolated High-Value Fixes (One Verifiable Unit per Session)

> **Goal:** Self-contained reliability, logging, and security-hygiene fixes with zero Stack D contract impact.  
> **Governance Gate:** Both Tier 1 `⚠` items (§5.1 and §5.6) were **EXPLICITLY APPROVED by Davin on 2026-10-16**.

### Decisions Taken & Approved by Davin (Tier 1)

- **`PinoLoggerService` Stack Handling:** Only promote a trailing string parameter to `{ stack }` inside `error()` and `fatal()` (never in `log()`, `warn()`, `debug()`, or `verbose()`).
- **NestJS 11 Shutdown Order (`PrismaService`):** Move `await this.$disconnect()` from `onModuleDestroy()` to `onApplicationShutdown()` in all three services so in-flight HTTP requests and Bull workers finish draining before the database pool closes, and pass `{ useProcessExit: true }` to `app.enableShutdownHooks()`.
- **Account-Deletion Confirmation Email (`⚠ APPROVED BY DAVIN 2026-10-16`):** When removing `confirmationUrl`, `cancelUrl`, and raw `email` from stdout logs in `UsersService.requestDeletion` (`operation-service/src/users/users.service.ts:715–730`), wire the Resend confirmation email in the same commit (`L728`) so users can complete account deletion.
- **`railway-gateway` Throttling (`⚠ APPROVED BY DAVIN 2026-10-16`):** Because the Push Worker, Relay, and Exporters run on the same Vultr VPS IP, enabling `app.set('trust proxy', 1)` is approved to be paired with `@SkipThrottle()` on the API-key-guarded ingestion controllers (`MarketDataController`, `IndicatorStatisticsController`, `EconomicEventsController`, `CurrencyGoldIndicesController`, `SymbolSpecsController`, `CycleManifestController`) so legitimate VPS ingestion bursts (3,000 bars/cycle) are not throttled at 100 req/min.

### Tier 1 Items

1. **§5.1 [Check 1 & Check 16] Account-Deletion Token Log Removal & Resend Email Wiring (`operation-service/src/users/users.service.ts:715–730` — `⚠ APPROVED`):**
   - Remove `confirmationUrl`, `cancelUrl` (which contain the raw 32-byte deletion `token`), and the user's plaintext `email` from stdout logs; log only `{ userId, requestId: deletionRequest.id, expiresAt }` via `this.logger.log`.
   - Wire the Resend account-deletion confirmation email at `L728` (non-fatal on send error, matching `AuthService.register` email handling in `operation-service/src/email/email.util.ts`) so users receive the `confirmationUrl` and `cancelUrl` via email.
2. **§5.2 [Check 1] `.railwayignore` Hygiene Across All 3 Services:**
   - Add `.env`, `.env.*`, `!.env.example` to `operation-service/.railwayignore`, and create matching `.railwayignore` files in `money-service/` and `railway-gateway/` to protect manual `railway up` deployments.
3. **§5.3 [Check 16] Fix `PinoLoggerService` Error Serialization & Add Pino Redaction (`operation-service` & `money-service`):**
   - In `operation-service/src/common/logging/logging.service.ts:62–83` and `money-service/src/common/logging/logging.service.ts:62–83`, extract `Error` instances into Pino's top-level `err` key and map single string stack parameters to `stack` only on `error()` / `fatal()`. Add unit tests covering `Error` as message, `Error` in params, and stack string in params.
   - In `operation-service/src/common/logging/pino-instance.ts` and `money-service/src/common/logging/pino-instance.ts`, add `redact: { paths: ['password', 'token', 'secret', 'authorization', 'cookie', 'apiKey', '*.password', '*.token', '*.secret', '*.paymentDetails', '*.accountNumber', '*.iban', 'req.headers.authorization', 'req.headers.cookie'], censor: '[REDACTED]' }`.
4. **§5.4 [Check 12] Fix `operation-service` Permanent Redis Disconnect After 10 Retries (`operation-service/src/redis/redis.service.ts:16–19`):**
   - Replace `if (times > 10) return null;` with bounded exponential backoff `return Math.min(times * 500, 30_000);` (matching `money-service/src/redis/redis.service.ts:19–25`) so `operation-service` and `RealtimeGateway` never permanently give up reconnecting after a >27.5s Redis restart.
5. **§5.5 [Check 2 & Check 3] Move `PrismaService.$disconnect()` to `onApplicationShutdown()` in All 3 Services:**
   - Update `operation-service/src/prisma/prisma.service.ts`, `money-service/src/prisma/prisma.service.ts`, and `railway-gateway/src/prisma/prisma.service.ts` to implement `OnApplicationShutdown` (`async onApplicationShutdown() { await this.$disconnect(); }`) instead of disconnecting in `onModuleDestroy()` while the HTTP server is still open.
6. **§5.6 [Check 2 & Check 6] Gateway `enableShutdownHooks`, `trust proxy`, and Ingestion `@SkipThrottle()` (`railway-gateway` — `⚠ APPROVED`):**
   - In `railway-gateway/src/main.ts`, type `NestFactory.create<NestExpressApplication>(AppModule)`, add `app.set('trust proxy', 1)`, and call `app.enableShutdownHooks(undefined, { useProcessExit: true })` (and update `operation-service/src/main.ts` and `money-service/src/main.ts` to also pass `{ useProcessExit: true }`). Also add `@SkipThrottle()` to the 6 API-key-guarded ingestion controllers in `railway-gateway`.
   - Add `@SkipThrottle()` to API-key-protected ingestion controllers in `railway-gateway/src/gateway/` (`⚠ NEEDS EXPLICIT SIGN-OFF`).
   - _Deploy Note:_ Because `railway-gateway` Watch Paths are unset, coordinate pushing `main` so it does not interrupt an active Stack D live measurement window.
7. **§5.7 [Check 7] Shared Pagination Query Validation for `limit` / `offset` (`railway-gateway` & `operation-service`):**
   - Prevent `NaN` / negative query parameters from reaching Prisma `take`/`skip` in `railway-gateway/src/gateway/active-indicator.controller.ts:46–49` and `operation-service/src/users/users.controller.ts:181–198` via a shared query validation schema/pipe returning `400 Bad Request`.
8. **§5.8 [Check 10] NestJS 11.x Patch Alignment (`11.2.3` → `11.2.7`):**
   - Bump `@nestjs/*` from `11.2.3` to the latest 11.x patch (`11.2.7`) and pin exact versions across all three services.

---

## 6. Tier 2 — Live Money-Path Defects (`money-service` & Outbox)

> **Governance Gate:** `⚠ NEEDS EXPLICIT SIGN-OFF` on **every** item (Non-Negotiable #5).  
> **Sequencing:** Ordered strictly by live production blast radius, executed as one verifiable single-concern session per item.

1. **§6.1 [Check 9 & Check 11] Stripe Dual-Delivery Deduplication & `Commission` Uniqueness (`money-service` + Monolith):**
   - _Context:_ Session `4A-13` left both the monolith (`/api/webhooks/stripe`) and `money-service` (`/v1/stripe/webhook`) active. Furthermore, `creditAffiliateCommission` checks for an existing commission and inserts one without a lock, and `Commission.stripeInvoiceId` is not `@unique` (`money-service/prisma/schema.prisma:446,482`).
   - _Fix:_
     - First, check in the Stripe Dashboard whether the monolith webhook endpoint can now be retired per `4A-13` step 4.
     - Add a shared PostgreSQL deduplication table `ProcessedWebhookEvent(provider, eventId)` (claimed inside the handler's `$transaction`) and a unique constraint/index preventing duplicate non-clawback `Commission` rows per `(affiliateCodeId, stripeInvoiceId)` and duplicate `REFUND-CLAWBACK` rows on `charge.refunded`.
2. **§6.2 [Check 9 & Check 11] Atomic Conditional Update in `ConversionProcessorService.processAffiliateConversion` (`money-service/src/affiliate/conversion-processor.service.ts:145–208`):**
   - _Defect:_ `if (affiliateCode.status === 'USED')` (`L145`) runs outside `this.prisma.$transaction(...)` (`L170`), while `tx.affiliateCode.update` (`L172`) runs unconditionally inside the transaction. Two concurrent webhook deliveries for the same code can both pass L145 and double-credit commissions.
   - _Fix:_ Inside `this.prisma.$transaction`, replace `tx.affiliateCode.update` with `const claimed = await tx.affiliateCode.updateMany({ where: { id: affiliateCode.id, status: 'ACTIVE' }, data: { status: 'USED', usedAt: new Date(), usedBy: input.userId, subscriptionId: input.subscriptionId ?? null } }); if (claimed.count === 0) return { processed: false, reason: 'ALREADY_USED' };`.
3. **§6.3 [Check 9 & Check 11] Atomic Completion Guard Inside `$transaction` for dLocal (and RiseWorks) Webhooks:**
   - In `money-service/src/dlocal/dlocal-webhook.controller.ts:187–206` (live) and `money-service/src/disbursement/webhook-event-processor.service.ts:111–153` (RiseWorks), move the `status !== 'COMPLETED'` guard inside `this.prisma.$transaction` using `updateMany({ where: { id, status: { not: 'COMPLETED' } } })` and abort if `count === 0` (matching `WiseTransferStateReducer` at `src/wise/services/wise-transfer-state.reducer.ts:197–205`).
4. **§6.4 [Check 9 & Check 11] Close Session `4A-13` Audit Items (b) and (c) in `StripeWebhookService` (`money-service/src/stripe/stripe-webhook.service.ts`):**
   - Wrap `handleSubscriptionUpdated` database writes in `this.prisma.$transaction`.
   - Ensure `invoice.payment_succeeded` propagates handler errors as HTTP 5xx (rather than returning `200 OK` on internal failure) so Stripe retries failed invoice processing.
5. **§6.5 [Check 1] Fail Closed on Missing `DLOCAL_API_KEY` & `NEXTAUTH_URL` (`money-service`):**
   - In `money-service/src/dlocal/dlocal-payment.service.ts:111, 127, 256`, remove `!DLOCAL_API_KEY` from the test-mode mock condition (restrict mock mode strictly to `process.env['NODE_ENV'] === 'test'`) and require `NEXTAUTH_URL` without falling back to `'http://localhost:3000'` in `stripe-checkout.controller.ts:121–122`.
6. **§6.6 [Check 4] Outbox Publisher Overlap Guard (`isRunning`) & Stuck `'PROCESSING'` Row Recovery (`money-service/src/outbox/outbox-publisher.cron.ts:130–190`):**
   - Add an in-memory `isRunning` guard to `@Interval(5000)` so slow downstream responses cannot pile up concurrent ticks.
   - Add a recovery query resetting `OutboxEvent` rows stuck in `status: 'PROCESSING'` with `updatedAt < now - 5 minutes` back to `status: 'PENDING'`.
7. **§6.7 [Check 9] Outbox Consumer & Alert Dispatcher Idempotency (`operation-service`):**
   - In `operation-service/src/outbox/outbox-consumer.service.ts:54–92`, deduplicate incoming `POST /outbox/events` by `event.id` in Redis/PostgreSQL so at-least-once retries do not send duplicate transactional emails.
   - In `operation-service/src/alert-engine/dispatcher.service.ts:23–60`, decouple post-commit Redis pub/sub errors from BullMQ job retries (or deduplicate `Notification` creation by `fireId`) so transient Redis pub/sub errors do not insert up to 5 duplicate `Notification` rows.
8. **§6.8 [Check 9] `IdempotencyInterceptor` User Scoping, Body Hash & Short Claim Lease (`money-service/src/common/idempotency/idempotency.interceptor.ts`):**
   - _Decision Gate:_ Decide whether browser/BFF clients will send `Idempotency-Key` headers on write routes.
   - Scope `cacheKey` by `userId` (`${userId}:${request.method}:${request.originalUrl ?? request.url}:${idempotencyKey}`), store and verify a SHA-256 `bodyHash` via `this.store.save()`, and use a 60s lease TTL for `IN_PROGRESS` claims instead of 24h.
9. **§6.9 [Check 4] Cron Exclusivity & BullMQ Retention (`money-service` & `operation-service`):**
   - Verify via the Tier 0 runtime inventory that `CRON_ENABLED=true` is set on at most one single-replica instance; add a Redis `SET NX PX` distributed lock around `@Cron()` methods in `CronsScheduler` (`money-service`) and `AlertCronScheduler` (`operation-service`) to protect against rolling-deploy overlap.
   - Add `defaultJobOptions: { removeOnComplete: 1000, removeOnFail: 5000 }` to `BullModule.forRoot` in `money-service/src/app.module.ts:52–55`.

---

## 7. Stack D Track — Gateway Ingestion & Phase B Alignment (`railway-gateway`)

> **Owner:** Stack D Builder / Advisor + Davin (scheduled alongside Stack D Phase B live certification).

1. **§7.1 [Check 4 & Check 9] Bull v4 Re-Send & Failed-Job Replay Contract (`railway-gateway/src/gateway/validation.service.ts`):**
   - Explicitly define and test against a real Bull + Redis instance:
     - How bars re-pushed across subsequent 3,000-bar cycles interact with `removeOnComplete: 100`.
     - How jobs that exhaust all 3 retry attempts (`state === 'failed'`, retained up to `removeOnFail: 500`) are alerted and replayed since the Push Worker marks `synced_at` upon receiving the initial HTTP `200 OK`.
2. **§7.2 [Check 1] Python Subprocess Environment Allow-List (`railway-gateway/src/sensors/python-runner.ts:78–82`):**
   - Pass an explicit allow-listed environment (`PATH`, `SYSTEMROOT`, `PYTHONPATH`, `TEMP`, `TMP`, `PYTHONDONTWRITEBYTECODE: '1'`) to `spawn(config.pythonBin, ...)` instead of spreading `...process.env` (which leaks `DATABASE_URL` and `API_KEYS`).
3. **§7.3 [Check 17] Gateway Health Path & Runbook Alignment (`railway-gateway/src/health/health.controller.ts` & `docs/runbooks/deploy-stack-d-step2.md:161`):**
   - Correct `docs/runbooks/deploy-stack-d-step2.md:161` from `GET /health` to `GET /api/v1/health`.
   - Keep `GET /api/v1/health` stable through Stack D Phase B certification; decide whether degraded DB/Redis status should return HTTP `503` to act as a Railway deployment gate.

---

## 8. Tier 3 — Post-Feature-Freeze Production Hardening (One Service & One Concern per Session)

> **Governance Gate:** Items touching auth (`§8.5`), CORS/throttling (`§8.6`), or secrets (`§8.1`) carry `⚠ NEEDS EXPLICIT SIGN-OFF`.

- **§8.1 [Check 1] Boot-Time Zod `ConfigModule` Validation & `getOrThrow()`:** Attach a Zod `validate` schema to `ConfigModule.forRoot()` in each service once environment variables stabilize, and add explicit `zod` to `operation-service/package.json` and `railway-gateway/package.json`.
- **§8.2 [Check 2] Direct `node --enable-source-maps` Start Command, V8 Heap Limit & OTel Shutdown:**
  - After confirming live Railway settings in Tier 0, add `railway.json` to `money-service` and `railway-gateway`, switch start commands from `npm run ...` to `node --enable-source-maps dist/main.js` (paired with `useProcessExit: true`), set `--max-old-space-size` to ~75% of each service's measured Railway container RAM limit, and move `otel.ts` `sdk.shutdown()` into `onApplicationShutdown()`.
  - Ensure all standalone `ioredis` clients (`ThrottlerModule`, `dlocal` lock client) are closed on shutdown and guarded in `WiseWebhookProcessor.onModuleDestroy()`.
- **§8.3 [Check 3] Railway-Adapted Graceful Drain:** Configure Railway's deploy draining/overlap settings to exceed in-flight request/worker duration and stop `AlertCronScheduler` in `onModuleDestroy()` before `PrismaService.onApplicationShutdown()` disconnects.
- **§8.4 [Check 4] Atomic Alert Worker State Claims & Queue Option Sharing:** Use atomic Redis `SET NX EX` for cooldown/fired state in `operation-service/src/alert-engine/state.ts`, guard `AlertCheckerService.triggerAlert` with `where: { id: alert.id, isActive: true }`, and share `DEFAULT_QUEUE_OPTIONS` across all `BullModule.registerQueue` calls in `railway-gateway`.
- **§8.5 [Check 5] `⚠` Deny-by-Default Auth (`APP_GUARD` + `@Public()`) & Constant-Time Secret Comparison:**
  - Register `JwtAuthGuard` (`operation-service`, `money-service`) and `ApiKeyGuard` (`railway-gateway`) via `APP_GUARD` with explicit `@Public()` opt-outs verified by a route-inventory test; protect `GET /api/v1/queue/stats` in `railway-gateway`.
  - Replace string `!==` / `.includes()` with SHA-256 + `crypto.timingSafeEqual` in `SvcTokenGuard`, `CronSecretGuard`, and `ApiKeyGuard`.
  - Decide with Davin (`⚠`) whether `TwoFactorService.verify()` (`operation-service/src/auth/two-factor.service.ts:226`) should enforce `decoded.purpose === '2fa_verification'`.
- **§8.6 [Check 6] `⚠` CORS Normalization, Per-Route Brute-Force Throttling & `request.ip`:**
  - Trim/filter `ALLOWED_ORIGINS` in all three services.
  - Add strict `@Throttle()` limits (e.g., 5–10 req/min) on `/auth/login`, `/auth/2fa/verify`, `/user/2fa/verify`, `/auth/forgot-password`, `/user/password` (`operation-service`) and checkout creation (`money-service`), and `@SkipThrottle()` on `/health` and `/outbox/events`.
  - Replace spoofable `request.headers['x-forwarded-for']?.split(',')[0]` with `request.ip` in `UsersController.resolveClientIp()` (`operation-service/src/users/users.controller.ts:339–345`).
- **§8.7 [Check 7] Bound List Queries (`take`), SQL Aggregations & Batch `addBulk`:**
  - Replace unbounded `commission.findMany` in `AdminAffiliateReportsController.profitLoss` (`money-service`) with Prisma `groupBy`/`aggregate`, and validate `StripeCheckoutController.createCheckout` `@Body()` with Zod.
  - Add upper `take` bounds to `GET /alerts`, `GET /alerts/line`, `GET /drawings`, and `GET /user/sessions` (`operation-service`), tighten `StyleZ`, and add `@MaxLength(72)` on password DTOs.
  - Bound array length on the 4 batch controllers in `railway-gateway` and replace sequential `for (...) await this.queue.add()` loops with `this.queue.addBulk()`.
- **§8.8 [Check 8] Explicit Prisma `select` Projections & Error Response Sanitization:**
  - Exclude raw `paymentDetails` JSON from `AdminAffiliateManagementService.listAffiliates`, map `WiseRecipientsController.list` through `toSummaryDto()`, add explicit `select` clauses in `LineAlertsService`, `DrawingsService`, and `SymbolSpecsService`, and strip raw `err.message` strings from 500 responses and public `/health` responses.
- **§8.9 [Check 10] Node 22/24 LTS Pinning, Dependency Cleanup & Off-Thread Password Hashing:**
  - Pin active Node LTS (`>=22.0.0`) in `engines`, `nixpacks.toml`, and GitHub Actions workflows (replacing EOL Node 20).
  - Move `@nestjs/cli` and `@nestjs/swagger` to `devDependencies`.
  - Evaluate a dedicated `⚠` decision on upgrading to NestJS 12 once stable.
  - Move sequential `bcryptjs` backup-code hashing (`operation-service/src/two-factor/two-factor.util.ts:73–111`) off the main event loop.
- **§8.10 [Check 11] Outbound `AbortSignal.timeout()` & Database Timeouts:**
  - Add `AbortSignal.timeout(...)` to all 6 unguarded `fetch()` call sites across `operation-service` (`AlertCheckerService`, `getGeoLocation`) and `money-service` (`DlocalPaymentService`, `siwe-auth.ts`, `WiseReconciliationService`), plus `timeout` / `maxNetworkRetries` on the Stripe SDK.
  - Configure `connectionTimeoutMillis` and (after verifying whether PgBouncer is in transaction mode) `statement_timeout` on `PrismaPg`, and review `ssl: { rejectUnauthorized: false }` in `operation-service/src/prisma/prisma.service.ts`.
- **§8.11 [Check 12] Fail-Open Throttler Redis Wrapper & dLocal Error Cleanup:**
  - Wrap `ThrottlerStorageRedisService` so transient Redis outages fail open rather than returning HTTP 500 on all routes.
  - In `DlocalPaymentController.createPayment` (`money-service`), mark the preliminary `PENDING` payment row `FAILED` and release the 30s Redis lock if the upstream dLocal API call throws.
- **§8.12 [Check 13] Automated Prisma Schema Drift Check in CI:** Run schema-sync assertions across `operation-service`, `money-service`, and `railway-gateway` against the canonical root schemas in CI.
- **§8.13 [Check 14] Explicit `PrismaPg` Pool `max` Sizing:** Set explicit `max` on `PrismaPg` in all three services based on the Tier 0 connection math inventory.
- **§8.14 [Check 15] Singleton DI Scope:** Verified compliant (`Scope.DEFAULT` + `AsyncLocalStorage`).
- **§8.15 [Check 16] Sanitize 5xx `HttpException`s & Port Structured Logging to `railway-gateway`:** Ensure `AllExceptionsFilter` masks 5xx messages and injects `correlationId` on all errors; port `LoggingModule` (`PinoLoggerService`) and `AllExceptionsFilter` to `railway-gateway`.
- **§8.16 [Check 17] Railway Deploy-Gate Health Check & Correlation Propagation:** Configure readiness health endpoints to return HTTP `503` when DB/Redis are unreachable so broken builds fail Railway's deployment gate, validate incoming `x-correlation-id` format, and propagate `correlationId` into background crons/workers and outbound `fetch()` headers.

---

## 9. Verification Baselines & Commands

Every session executing an item from this plan must verify and report exit codes and test counts against the repository baselines (`.claude/protocols/verification-checklist.md`):

- **Next.js Monolith (when touched, e.g., P0):**
  - `npx tsc --noEmit` (exit 0)
  - Targeted Jest suites (`npx jest <path>`)
- **`operation-service` (baseline: 43 suites / 401 tests):**
  - `npx tsc --noEmit`
  - `npm test`
  - `npm run build`
- **`money-service` (baseline: 66 suites / 650 tests):**
  - `npx tsc --noEmit`
  - `npm test`
  - `npm run build`
- **`railway-gateway`:**
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm test` (unit suites)
  - `npm run test:e2e` (`test/market-data.e2e-spec.ts` and e2e specs)
  - `npm run check:sensor-kit`
  - `npm run build`
