# Handoff Report for Claude Code: Execute Tier 0, Tier 1, and Tier 2 of the NestJS Production Remediation Plan

- **Date:** 2026-10-16, Asia/Bangkok
- **From:** Antigravity (Advisor)
- **To:** Claude Code (Executor & Shared-State Writer)
- **Authorized By:** Davin (Owner) — Direct instruction on 2026-10-16 to hand off **Tier 0, Tier 1, and Tier 2** implementation to Claude Code (due to Antigravity weekly usage limit approaching), with explicit owner approval granted for the Tier 1 `⚠` items below.
- **Canonical Plan Reference:** [`davintrade-nest-js-checklists/nestjs-production-remediation-plan.md`](./nestjs-production-remediation-plan.md) (Revision 2 — Consensus Edition)
- **Claude Code Review Reference:** [`davintrade-nest-js-checklists/nestjs-production-remediation-plan-claude-code-recommendation.md`](./nestjs-production-remediation-plan-claude-code-recommendation.md)

---

## 1. What Antigravity Completed & Pushed Before This Handoff

1. **Plan Revision 2 (`davintrade-nest-js-checklists/nestjs-production-remediation-plan.md`):**
   - Updated the remediation plan to Revision 2, incorporating 100% of Claude Code's line-by-line review corrections, sequencing (`P0 -> Tier 0 -> Tier 1 -> Tier 2 -> Stack D Track -> Tier 3`), and blast-radius ordering.
2. **P0 Hotfix Implemented, Verified & Committed:**
   - [`operation-service/src/auth/auth.service.ts`](../operation-service/src/auth/auth.service.ts): Removed `'admin-test@trading-alerts.test'` and `'admin@tradingalerts.com'` from `FIXED_TEST_ACCOUNTS`. Gated remaining non-admin test accounts behind `process.env['NODE_ENV'] === 'development' || process.env['NODE_ENV'] === 'test'`.
   - [`lib/auth/auth-options.ts`](../lib/auth/auth-options.ts): Removed `'admin-test@trading-alerts.test'` and `'admin@tradingalerts.com'` from `FIXED_TEST_ACCOUNTS`. Gated remaining non-admin test accounts behind `(runtimeNodeEnv === 'development' || runtimeNodeEnv === 'test' || process.env['VERCEL_ENV'] === 'preview') && process.env['VERCEL_ENV'] !== 'production'`. Updated the stale header comment at lines 144–152.
   - [`components/auth/login-form.tsx`](../components/auth/login-form.tsx): Removed the `"Admin Test"` and `"Admin (Fixed)"` buttons from the `"Quick Test Credentials"` autofill helper and gated the entire panel to render only in `development` or `test`.
   - **Verification Evidence:**
     - `operation-service`: `npx tsc --noEmit` (exit 0) + `npx jest src/auth/auth.service.spec.ts` (18/18 passed).
     - Root monolith: `npx tsc --noEmit` (exit 0) + `npx jest __tests__/components/auth/login-form.test.tsx --coverage=false` (13/13 passed).
   - **Technical Note for Claude Code (`SWC` + `process.env` in Jest):**
     - `next/jest` SWC statically replaces both `process.env.NODE_ENV` and `process.env['NODE_ENV']` with `"test"` at compile time, and Node's C++ `EnvSetter` on `process.env` ignores `Object.defineProperty`. Accordingly, `login-form.tsx` and `auth-options.ts` read `Reflect.get(process.env, 'NODE_ENV') ?? process.env.NODE_ENV` and `login-form.test.tsx` mutates `NODE_ENV` via `Reflect.set(process.env, 'NODE_ENV', 'production')`.

---

## 2. Explicit Owner Approvals Recorded from Davin (`⚠` Gates)

Davin explicitly approved the following two Tier 1 `⚠` decisions in chat on 2026-10-16 so Claude Code can execute them without stopping for another sign-off gate:

1. **Tier 1 §5.1 — Account-Deletion Token Log Removal + Resend Confirmation Email (`⚠ APPROVED BY DAVIN`):**
   - **Target:** `operation-service/src/users/users.service.ts:715–730` and `operation-service/src/email/email.util.ts`.
   - **Decision:** Remove `confirmationUrl`, `cancelUrl` (which contain the raw 32-byte deletion `token`), and the user's plaintext `email` from stdout logs (`console.log` -> `this.logger.log({ userId, requestId: deletionRequest.id, expiresAt })`), **AND wire the Resend account-deletion confirmation email at `L728` in the same commit** so users can actually receive and click the confirmation/cancellation links once the raw token is removed from stdout logs. Use non-fatal error handling matching `AuthService.register` (log email send failures via `this.logger.error` without throwing 500 after the DB deletion request record is created).
2. **Tier 1 §5.6 — `railway-gateway` `trust proxy` + `@SkipThrottle()` on Ingestion Controllers (`⚠ APPROVED BY DAVIN`):**
   - **Target:** `railway-gateway/src/main.ts` and the 6 API-key-guarded ingestion controllers in `railway-gateway/src/gateway/`.
   - **Decision:** Enable `app.set('trust proxy', 1)` on `NestExpressApplication` **paired in the same commit with `@SkipThrottle()`** on the 6 API-key-authenticated ingestion controllers (`MarketDataController`, `IndicatorStatisticsController`, `EconomicEventsController`, `CurrencyGoldIndicesController`, `SymbolSpecsController`, `CycleManifestController`). This ensures legitimate Vultr VPS ingestion bursts (3,000 bars/cycle from a single VPS IP) are not throttled at 100 req/min while public/read endpoints remain rate-limited by real client IP.

---

## 3. Execution Specification for Claude Code (Tier 0 -> Tier 1 -> Tier 2)

Execute each item below as a focused, independently verified unit (`tsc --noEmit` + targeted Jest tests + build check), following `.claude/rules/non-negotiables.md`.

### Phase A: Tier 0 — Enablers (§4 of Remediation Plan)

#### Unit 0.1 — GitHub Actions CI for `operation-service`, `money-service`, and `railway-gateway` (§4.1)

- **Files:** Create `.github/workflows/nestjs-services-ci.yml`.
- **Details:**
  - Trigger on `push` and `pull_request` affecting `operation-service/**`, `money-service/**`, `railway-gateway/**`, `packages/types/**`, or `.github/workflows/nestjs-services-ci.yml`.
  - Use **Node 22 LTS** (`node-version: '22'`).
  - Jobs:
    - `operation-service`: `npm ci`, `npx tsc --noEmit`, `npm test`, `npm run build`.
    - `money-service`: `npm ci`, `npx tsc --noEmit`, `npm test`, `npm run build`.
    - `railway-gateway`: `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run test:e2e`, `npm run check:sensor-kit`, `npm run build`.

---

### Phase B: Tier 1 — Isolated High-Value Fixes (§5 of Remediation Plan)

#### Unit 1.1 — Account-Deletion Token Log Removal & Resend Email Wiring (§5.1 — `⚠ Approved`)

- **Files:**
  - `operation-service/src/email/email.util.ts`
  - `operation-service/src/users/users.service.ts` (lines 715–730)
  - `operation-service/src/users/users.service.spec.ts` (or dedicated spec)
- **Details:**
  - Add `sendAccountDeletionEmail(email: string, name: string | null, confirmationUrl: string, cancelUrl: string, expiresAt: Date)` to `operation-service/src/email/email.util.ts` using the existing Resend helper pattern.
  - In `UsersService.requestDeletion` (`operation-service/src/users/users.service.ts:715–730`), replace the `console.log` that prints `email`, `confirmationUrl`, and `cancelUrl` with `this.logger.log({ userId, requestId: deletionRequest.id, expiresAt }, 'Account deletion requested')` and invoke `sendAccountDeletionEmail(...)` (logging any email error via `this.logger.error` without failing the request).
  - Add unit tests verifying that neither `token`, `confirmationUrl`, `cancelUrl`, nor plaintext `email` is logged, and that `sendAccountDeletionEmail` is called with the expected URLs.

#### Unit 1.2 — `.railwayignore` Secret Hygiene Across All 3 Services (§5.2)

- **Files:**
  - `operation-service/.railwayignore`
  - `money-service/.railwayignore` (new)
  - `railway-gateway/.railwayignore` (new)
- **Details:**
  - Ensure all three `.railwayignore` files exclude `.env`, `.env.*` (with `!.env.example`), `coverage/`, `*.log`, `.git/`, `src/**/*.spec.ts`, and `test/`.

#### Unit 1.3 — `PinoLoggerService` Error Serialization & Pino Redaction (§5.3)

- **Files:**
  - `operation-service/src/common/logging/logging.service.ts` (lines 62–83)
  - `operation-service/src/common/logging/pino-instance.ts`
  - `money-service/src/common/logging/logging.service.ts` (lines 62–83)
  - `money-service/src/common/logging/pino-instance.ts`
  - Unit tests in `operation-service` and `money-service`
- **Details:**
  - In `logging.service.ts` (`operation-service` and `money-service`), update `write()`:
    - If `message instanceof Error`, log `this.pino[level]({ err: message, ...(context ? { context } : {}) }, message.message)`.
    - Extract any `Error` instance from `optionalParams` into `err` so Pino serializes `err.type`, `err.message`, and `err.stack`.
    - Only promote a single trailing string parameter to `{ stack }` when `level === 'error' || level === 'fatal'` (never on `log`, `warn`, `debug`, `verbose`).
  - In `pino-instance.ts` (`operation-service` and `money-service`), add `redact`:
    ```ts
    redact: {
      paths: [
        'password',
        'token',
        'secret',
        'authorization',
        'cookie',
        'apiKey',
        '*.password',
        '*.token',
        '*.secret',
        '*.paymentDetails',
        '*.accountNumber',
        '*.iban',
        'req.headers.authorization',
        'req.headers.cookie',
      ],
      censor: '[REDACTED]',
    },
    ```
  - Add unit tests in both services verifying `Error` serialization and that `stack` promotion only happens on `error`/`fatal`.

#### Unit 1.4 — Fix `operation-service` Permanent Redis Disconnect After 10 Retries (§5.4)

- **Files:**
  - `operation-service/src/redis/redis.service.ts` (lines 16–19)
- **Details:**
  - Replace `if (times > 10) return null; return Math.min(times * 500, 5000);` with bounded exponential backoff `return Math.min(times * 500, 30_000);` (matching `money-service/src/redis/redis.service.ts:19–25`) so `operation-service` never permanently gives up reconnecting after a >27.5s Redis restart.

#### Unit 1.5 — Move `PrismaService.$disconnect()` to `onApplicationShutdown()` in All 3 Services (§5.5)

- **Files:**
  - `operation-service/src/prisma/prisma.service.ts`
  - `money-service/src/prisma/prisma.service.ts`
  - `railway-gateway/src/prisma/prisma.service.ts`
- **Details:**
  - In `@nestjs/core@11.2.3`, `callModuleDestroyHook()` runs **before** `dispose()` (which closes the HTTP listener), whereas `callBeforeShutdownHook()` and `callShutdownHook()` (`onApplicationShutdown`) run **after** `dispose()`.
  - Replace `OnModuleDestroy` / `onModuleDestroy()` in all three `PrismaService` classes with `OnApplicationShutdown` / `async onApplicationShutdown(): Promise<void> { await this.$disconnect(); }`.
  - Update any existing `PrismaService` unit tests accordingly.

#### Unit 1.6 — Gateway `enableShutdownHooks`, `trust proxy`, and Ingestion `@SkipThrottle()` (§5.6 — `⚠ Approved`)

- **Files:**
  - `railway-gateway/src/main.ts`
  - `operation-service/src/main.ts`
  - `money-service/src/main.ts`
  - Ingestion controllers in `railway-gateway/src/gateway/`:
    - `market-data.controller.ts`
    - `indicator-statistics.controller.ts`
    - `economic-events.controller.ts`
    - `currency-gold-indices.controller.ts`
    - `symbol-specs.controller.ts`
    - `cycle-manifest.controller.ts`
- **Details:**
  - In `railway-gateway/src/main.ts`:
    - Type `await NestFactory.create<NestExpressApplication>(AppModule)`.
    - Call `app.set('trust proxy', 1)`.
    - Call `app.enableShutdownHooks(undefined, { useProcessExit: true })`.
  - In `operation-service/src/main.ts` and `money-service/src/main.ts`:
    - Update `app.enableShutdownHooks()` to `app.enableShutdownHooks(undefined, { useProcessExit: true })`.
  - Decorate the 6 API-key-guarded ingestion controllers (or their write endpoints) in `railway-gateway/src/gateway/` with `@SkipThrottle()` from `@nestjs/throttler`.
  - _Deploy Note:_ Remember `railway-gateway` Watch Paths are currently unset on Railway (`waiting-on.md`), so any push to `main` redeploys `railway-gateway`. Coordinate pushes around active Stack D live certification windows.

#### Unit 1.7 — Shared Pagination Query Validation for `limit` / `offset` (§5.7)

- **Files:**
  - `railway-gateway/src/gateway/market-data.controller.ts` (`L165–176`)
  - `railway-gateway/src/gateway/indicator-statistics.controller.ts` (`L75–81`)
  - `railway-gateway/src/gateway/economic-events.controller.ts` (`L71–85`)
  - `railway-gateway/src/gateway/currency-gold-indices.controller.ts` (`L86–92`)
  - `operation-service/src/notifications/notifications.controller.ts` (`L74–90`)
- **Details:**
  - Guard `parseInt(limit, 10)` and `parseInt(offset, 10)` against `NaN` and negative numbers (`Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), maxLimit) : defaultLimit`, and `Math.max(parsedOffset, 0)` for `offset`) so `?limit=abc` or `?offset=-5` never passes `take: NaN` or negative `skip` to Prisma.

#### Unit 1.8 — Align `class-validator` to `0.15.1` in `railway-gateway` (§5.8)

- **Files:**
  - `railway-gateway/package.json`
  - `railway-gateway/package-lock.json`
- **Details:**
  - Upgrade `class-validator` in `railway-gateway/package.json` from `^0.14.1` to `0.15.1` (matching `operation-service` and `money-service`) and run `npm test` + `npm run test:e2e` in `railway-gateway`.

---

### Phase C: Tier 2 — Money-Path, Webhook & Queue Idempotency (§6 of Remediation Plan)

> **Execution Order:** Strictly ordered by live production blast radius (`§6.1 -> §6.9`), one single-concern verifiable session per item.

1. **Unit 2.1 (§6.1) — Stripe Dual-Delivery Deduplication & `Commission` Uniqueness (`money-service` + Monolith):**
   - Check with Davin whether the monolith `/api/webhooks/stripe` endpoint in Stripe Dashboard is still active alongside `money-service` `/v1/stripe/webhook` (`4A-13` step 4).
   - Add a PostgreSQL deduplication model `ProcessedWebhookEvent(provider, eventId, createdAt)` with `@@id([provider, eventId])` claimed inside the webhook `$transaction`, and add a unique constraint/index preventing duplicate non-clawback `Commission` rows per `(affiliateCodeId, stripeInvoiceId)` and duplicate `REFUND-CLAWBACK` rows on `charge.refunded` (`money-service/src/stripe/stripe-webhook.service.ts:446–564`, `lib/stripe/webhook-handlers.ts`).
2. **Unit 2.2 (§6.2) — Atomic Conditional Update in `ConversionProcessorService.processAffiliateConversion` (`money-service/src/affiliate/conversion-processor.service.ts:145–208`):**
   - Inside `this.prisma.$transaction` (`L170`), replace the unconditional `tx.affiliateCode.update` (`L172`) with:
     ```ts
     const claimed = await tx.affiliateCode.updateMany({
       where: { id: affiliateCode.id, status: 'ACTIVE' },
       data: {
         status: 'USED',
         usedAt: new Date(),
         usedBy: input.userId,
         subscriptionId: input.subscriptionId ?? null,
       },
     });
     if (claimed.count === 0) {
       return { processed: false, reason: 'Code already used' };
     }
     ```
     so two concurrent webhook deliveries cannot both pass L145 and double-credit commissions.
3. **Unit 2.3 (§6.3) — Atomic Completion Guard Inside `$transaction` for dLocal (and RiseWorks) Webhooks:**
   - In `money-service/src/dlocal/dlocal-webhook.controller.ts:187–206` (live) and `money-service/src/disbursement/webhook-event-processor.service.ts:111–153` (RiseWorks), move the `status !== 'COMPLETED'` guard inside `this.prisma.$transaction` using `updateMany({ where: { id, status: { not: 'COMPLETED' } } })` and abort if `count === 0` (matching `WiseTransferStateReducer` at `src/wise/services/wise-transfer-state.reducer.ts:197–205`).
4. **Unit 2.4 (§6.4) — Close Session `4A-13` Audit Items (b) and (c) in `StripeWebhookService` (`money-service/src/stripe/stripe-webhook.service.ts`):**
   - Wrap `handleSubscriptionUpdated` database writes in `this.prisma.$transaction`.
   - Ensure `invoice.payment_succeeded` propagates handler errors as HTTP 5xx (rather than returning `200 OK` on internal failure) so Stripe retries failed invoice processing.
5. **Unit 2.5 (§6.5) — Fail Closed on Missing `DLOCAL_API_KEY` & `NEXTAUTH_URL` (`money-service`):**
   - In `money-service/src/dlocal/dlocal-payment.service.ts:111, 127, 256`, remove `!DLOCAL_API_KEY` from the mock-mode condition (restrict mock mode strictly to `process.env['NODE_ENV'] === 'test'`) and require `NEXTAUTH_URL` without falling back to `'http://localhost:3000'` in `money-service/src/stripe/stripe-checkout.controller.ts:121–122`.
6. **Unit 2.6 (§6.6) — Outbox Publisher Overlap Guard (`isRunning`) & Stuck `'PROCESSING'` Row Recovery (`money-service/src/outbox/outbox-publisher.cron.ts:130–190`):**
   - Add an in-memory `isRunning` guard to `@Interval(5000)` and recover `OutboxEvent` rows stuck in `status: 'PROCESSING'` with `updatedAt < now - 5 minutes` back to `status: 'PENDING'`.
7. **Unit 2.7 (§6.7) — Outbox Consumer & Alert Dispatcher Idempotency (`operation-service`):**
   - Deduplicate incoming `POST /outbox/events` by `event.id` in `operation-service/src/outbox/outbox-consumer.service.ts:54–92`.
   - In `operation-service/src/alert-engine/dispatcher.service.ts:23–60`, decouple post-commit Redis pub/sub errors from BullMQ job retries (or deduplicate `Notification` creation by `fireId`) so transient Redis pub/sub errors do not insert up to 5 duplicate `Notification` rows.
8. **Unit 2.8 (§6.8) — `IdempotencyInterceptor` User Scoping, Body Hash & Short Claim Lease (`money-service/src/common/idempotency/idempotency.interceptor.ts`):**
   - Scope `cacheKey` by `userId` (`${userId}:${request.method}:${request.originalUrl ?? request.url}:${idempotencyKey}`), store and verify a SHA-256 `bodyHash` via `this.store.save()`, and use a 60s lease TTL for `IN_PROGRESS` claims instead of 24h.
9. **Unit 2.9 (§6.9) — Cron Exclusivity & BullMQ Retention (`money-service` & `operation-service`):**
   - Add a Redis `SET NX PX` distributed lock around `@Cron()` methods in `CronsScheduler` (`money-service`) and `AlertCronScheduler` (`operation-service`).
   - Add `defaultJobOptions: { removeOnComplete: 1000, removeOnFail: 5000 }` to `BullModule.forRoot` in `money-service/src/app.module.ts:52–55`.
