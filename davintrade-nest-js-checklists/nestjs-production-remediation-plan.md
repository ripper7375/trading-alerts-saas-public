# NestJS Production Readiness Remediation Plan (17-Point Checklist)

> **Reference Standard:** [`davintrade-nest-js-checklists/nestjs-production-checklist.md`](./nestjs-production-checklist.md)  
> **Target Codebases:** `operation-service`, `money-service`, `railway-gateway` (NestJS 11.2.3)  
> **Status:** DRAFT — Prepared by Antigravity for Davin & Claude Code Review  
> **Date:** 2026-10-16

---

## 1. Executive Summary & Strategic Phasing Rationale

This document provides the complete engineering implementation plan to bring all three NestJS microservices in this repository (`operation-service`, `money-service`, and `railway-gateway`) into full compliance with the 17 checks defined in [`nestjs-production-checklist.md`](./nestjs-production-checklist.md).

Because the repository is under active feature development — specifically **Stack D** across `railway-gateway` (Build Steps 2–4 awaiting live shadow verification) and the Next.js monolith / `knowledge-service` (Build Steps 5–7), plus pending cutover sessions for `money-service` — executing all 17 checks simultaneously would create severe merge conflicts, invalidate existing deployment runbooks (`deploy-stack-d-step2.md`, `deploy-stack-d-step3.md`), and require repeated rework as new environment variables and routes are added.

Instead, this plan partitions all findings across the 17 checks into **Three Execution Tiers**:

| Tier       | Execution Timing                                            | Scope & Objective                                                                                                                                                                                                                                                                                                                                                       | Conflict Risk with Active Work                                                                       |
| :--------- | :---------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------- |
| **Tier 1** | **Immediate (Execute First)**                               | Surgical, isolated fixes (5–6 files) that close active production security holes in `operation-service`, fix swallowed error stack traces in `PinoLoggerService`, and fix `railway-gateway` issues (`trust proxy`, `enableShutdownHooks`, Bull v4 `jobId` re-delivery) that could silently distort Stack D Step 2/3 live verification.                                  | **Near-Zero** — touches no Stack D sensor/synthesis logic and preserves all existing test contracts. |
| **Tier 2** | **Pre-Cutover Gate (`money-service` & Multi-Replica Gate)** | Financial data integrity, atomic `$transaction` boundaries, webhook deduplication, user-scoped `IdempotencyInterceptor`, removal of mock payment fallbacks, and Redis distributed locks for `@Cron()` jobs before `money-service` Slice 4 cutover (`4A-10`) or multi-replica scaling.                                                                                   | **Low** — isolated to `money-service` and `operation-service` outbox consumer.                       |
| **Tier 3** | **Post-Feature-Freeze Hardening Sprint**                    | Cross-cutting structural & infrastructure refactoring once Stack D and service routes stabilize: boot-time Zod `ConfigModule` schemas, global `APP_GUARD` + `@Public()` inversion, `/health/live` vs `/health/ready` split + `railway.toml` updates, pagination caps (`take`) & SQL aggregation, outbound `AbortSignal.timeout()`, and DB/Redis connection pool sizing. | **Deferred by design** until feature freeze so schemas, routes, and runbooks are finalized once.     |

---

## 2. Master 17-Check Cross-Reference Matrix

Every check from `nestjs-production-checklist.md` is accounted for below and mapped to the exact Tier and section of this plan:

| Check # | Checklist Topic                                      | `operation-service` | `money-service` | `railway-gateway` | Assigned Tier(s) & Plan Section                                 |
| :-----: | :--------------------------------------------------- | :-----------------: | :-------------: | :---------------: | :-------------------------------------------------------------- |
| **01**  | Validate Config at Boot & Keep Secrets Out of Image  |       ❌ Fail       |     ❌ Fail     |      ❌ Fail      | **Tier 1** (§3.1, §3.2) · **Tier 2** (§4.2) · **Tier 3** (§5.1) |
| **02**  | Handle `SIGTERM` & Get Container Right (PID 1, Heap) |     ⚠️ Partial      |   ⚠️ Partial    |      ❌ Fail      | **Tier 1** (§3.4) · **Tier 3** (§5.2)                           |
| **03**  | Drain Before You Close (`preStop`, 503 on close)     |       ❌ Fail       |     ❌ Fail     |      ❌ Fail      | **Tier 3** (§5.3)                                               |
| **04**  | Scheduled Jobs (`@Cron`) & Queue Retention/Locks     |       ❌ Fail       |     ❌ Fail     |      ❌ Fail      | **Tier 1** (§3.5) · **Tier 2** (§4.4) · **Tier 3** (§5.4)       |
| **05**  | Make Authentication Deny-by-Default (`APP_GUARD`)    |       ❌ Fail       |     ❌ Fail     |      ❌ Fail      | **Tier 3** (§5.5)                                               |
| **06**  | Security Headers, CORS, Rate Limits & `trust proxy`  |     ⚠️ Partial      |   ⚠️ Partial    |      ❌ Fail      | **Tier 1** (§3.4) · **Tier 3** (§5.6)                           |
| **07**  | Validate Every Input & Bound List Endpoints          |       ❌ Fail       |     ❌ Fail     |      ❌ Fail      | **Tier 1** (§3.6) · **Tier 3** (§5.7)                           |
| **08**  | Control What Goes Out (DTOs, `select`, Error Leaks)  |     ⚠️ Partial      |     ❌ Fail     |    ⚠️ Partial     | **Tier 3** (§5.8)                                               |
| **09**  | Make Writes Safe to Repeat (Idempotency)             |       ❌ Fail       |     ❌ Fail     |      ❌ Fail      | **Tier 1** (§3.5) · **Tier 2** (§4.1, §4.3, §4.5)               |
| **10**  | Run Current Supported Versions & Dependencies        |     ⚠️ Partial      |   ⚠️ Partial    |      ❌ Fail      | **Tier 3** (§5.9)                                               |
| **11**  | Time Out Every Outbound Call & DB Statement Timeout  |       ❌ Fail       |     ❌ Fail     |      ❌ Fail      | **Tier 3** (§5.10)                                              |
| **12**  | Plan for Dependencies That Are Down (Resilience)     |       ❌ Fail       |   ⚠️ Partial    |    ⚠️ Partial     | **Tier 3** (§5.11)                                              |
| **13**  | Run Migrations as a Deploy Step                      |       ✅ Pass       |     ✅ Pass     |      ✅ Pass      | **Tier 3** (§5.12 — CI schema drift check only)                 |
| **14**  | Check Database & Redis Connection Pool Math          |       ❌ Fail       |     ❌ Fail     |      ❌ Fail      | **Tier 3** (§5.13)                                              |
| **15**  | Watch for Request-Scoped Chains (`Scope.DEFAULT`)    |       ✅ Pass       |     ✅ Pass     |      ✅ Pass      | **Compliant** (§5.14 — verification only)                       |
| **16**  | Errors: Statuses, Structured Logging & Source Maps   |     ⚠️ Partial      |   ⚠️ Partial    |      ❌ Fail      | **Tier 1** (§3.3) · **Tier 3** (§5.15)                          |
| **17**  | Logs, Health Checks (Live vs Ready) & Telemetry      |       ❌ Fail       |     ❌ Fail     |      ❌ Fail      | **Tier 3** (§5.16)                                              |

---

## 3. Tier 1 — Immediate Quick Wins (Execute First)

> **Goal:** Eliminate active production security vulnerabilities, restore error stack traces in Pino logs during development, and prevent silent Bull v4 job drops / reverse-proxy rate-limit throttling in `railway-gateway` ahead of Stack D live deployment.

### 3.1 [Check 1] Gate `FIXED_TEST_ACCOUNTS` Behind Non-Production Environment (`operation-service`)

- **File:** `operation-service/src/auth/auth.service.ts` (Lines 161–292)
- **Current Defect:**
  `AuthService.verifyPassword()` evaluates `FIXED_TEST_ACCOUNTS` unconditionally in all environments. In particular, `admin@tradingalerts.com` (`L192–202`) accepts `passwords: [process.env['ADMIN_PASSWORD'] || 'ChangeMe123!', 'AdminPassword123!', 'ChangeMe123!']` and `admin-test@trading-alerts.test` (`L185–191`) accepts `'AdminPassword123!'` / `'TestPassword123!'`. Even when `ADMIN_PASSWORD` is configured in production, the hardcoded fallback strings remain in the array and upsert an authenticated `ADMIN` + `PRO` user in PostgreSQL.
- **Proposed Fix:**
  Gate the entire `FIXED_TEST_ACCOUNTS` lookup so that it only executes when `process.env['NODE_ENV'] !== 'production'` (or when an explicit opt-in flag such as `process.env['ALLOW_TEST_ACCOUNTS'] === 'true'` is set in non-production staging):

  ```typescript
  const allowFixedTestAccounts =
    process.env['NODE_ENV'] === 'test' ||
    process.env['NODE_ENV'] === 'development' ||
    process.env['ALLOW_FIXED_TEST_ACCOUNTS'] === 'true';

  const fixed = allowFixedTestAccounts
    ? FIXED_TEST_ACCOUNTS[normalizedEmail]
    : undefined;
  ```

- **Note on Monolith Parity:** Check whether `app/api/auth/[...nextauth]/route.ts` or `lib/auth/` in the Next.js monolith contains the same `FIXED_TEST_ACCOUNTS` block so both can be gated consistently if Davin approves (per Non-Negotiable #5).

---

### 3.2 [Check 1 & Check 16] Remove Plaintext Account-Deletion Token Logging & Exclude `.env*` in `.railwayignore` (`operation-service`)

- **Files:**
  1. `operation-service/src/users/users.service.ts` (Lines 715–730)
  2. `operation-service/.railwayignore` (Lines 1–9)
- **Current Defect:**
  1. `UsersService.requestDeletion()` calls `console.log('[AccountDeletion] Request created:', { userId, requestId, confirmationUrl, cancelUrl })`, writing the raw 32-byte hex `token` inside `confirmationUrl` and `cancelUrl` directly to container stdout logs. Anyone with log viewer access can confirm or cancel any user's pending account deletion without authentication (`POST /user/confirm-deletion` is token-only by design).
  2. `operation-service/.railwayignore` omits `.env` and `.env.*`. Because `.railwayignore` overrides `.gitignore` during `railway up`, a local `operation-service/.env` file can be uploaded into the build context.
- **Proposed Fix:**
  1. In `operation-service/src/users/users.service.ts:717–730`, replace the two `console.log` statements with Nest `Logger` (`this.logger.log(...)`) logging only `{ userId, requestId: deletionRequest.id, expiresAt }` (omitting `confirmationUrl`, `cancelUrl`, `token`, and raw `email`).
  2. In `operation-service/.railwayignore`, append:
     ```gitignore
     .env
     .env.*
     !.env.example
     ```

---

### 3.3 [Check 16] Fix `PinoLoggerService` Swallowing `Error` Stack Traces (`operation-service` & `money-service`)

- **Files:**
  1. `operation-service/src/common/logging/logging.service.ts` (Lines 62–83)
  2. `money-service/src/common/logging/logging.service.ts` (Lines 62–83)
- **Current Defect:**
  When application code calls `this.logger.error('Alert check failed:', error)` (passing an `Error` instance) or Nest's standard `this.logger.error('Failed to x', error.stack, 'MyService')`, `PinoLoggerService.write()` places non-context arguments into `{ params: extra }`. Because `Error.prototype.message` and `Error.prototype.stack` are non-enumerable properties in V8 and Pino only invokes its built-in error serializer on the top-level `err` key, `Error` instances inside `params` serialize as `"params":[{}]`, discarding both the error message and stack trace.
- **Proposed Fix:**
  Update `PinoLoggerService.write()` in both services to detect `Error` instances (either as `message` or in `extra`) and attach them under Pino's standard `err` key, and preserve string stack traces under `stack`:

  ```typescript
  private write(
    pinoCall: (mergingObject: object, msg: string) => void,
    message: unknown,
    optionalParams: unknown[]
  ): void {
    const last = optionalParams[optionalParams.length - 1];
    const context = typeof last === 'string' ? last : undefined;
    const extra = context ? optionalParams.slice(0, -1) : optionalParams;

    if (message instanceof Error) {
      pinoCall(
        {
          err: message,
          ...(context ? { context } : {}),
          ...(extra.length ? { params: extra } : {}),
        },
        message.message
      );
      return;
    }

    const errParam = extra.find((item): item is Error => item instanceof Error);
    const remaining = extra.filter((item) => !(item instanceof Error));
    // If Nest's Logger.error(msg, stackString, context) pattern is used:
    const stackParam =
      !errParam && remaining.length === 1 && typeof remaining[0] === 'string'
        ? (remaining.pop() as string)
        : undefined;

    const msg = typeof message === 'string' ? message : JSON.stringify(message);
    pinoCall(
      {
        ...(context ? { context } : {}),
        ...(errParam ? { err: errParam } : {}),
        ...(stackParam ? { stack: stackParam } : {}),
        ...(remaining.length ? { params: remaining } : {}),
      },
      msg
    );
  }
  ```

---

### 3.4 [Check 2 & Check 6] Enable `trust proxy` and `enableShutdownHooks()` in `railway-gateway`

- **File:** `railway-gateway/src/main.ts` (Lines 8–30)
- **Current Defect:**
  1. `railway-gateway/src/main.ts` does not call `app.set('trust proxy', 1)`. Because `ThrottlerGuard` is registered globally via `APP_GUARD` in `railway-gateway/src/app.module.ts:55` (default 100 requests/min), Express sees Railway's reverse proxy IP as `req.ip` for all incoming requests. All legitimate senders (Push Worker, MT5 Relay, Symbol Specs Exporter, Monolith) share a single IP rate-limit bucket.
  2. `railway-gateway/src/main.ts` does not call `app.enableShutdownHooks()`. On Railway deploy or restart (`SIGTERM`), `PrismaService.onModuleDestroy()` (`src/prisma/prisma.service.ts:29`) and Bull queue workers never run their shutdown hooks, severing active database writes and leaving stalled locks in Redis.
- **Proposed Fix:**
  Update `railway-gateway/src/main.ts`:

  ```typescript
  import { NestExpressApplication } from '@nestjs/platform-express';
  // ...
  async function bootstrap(): Promise<void> {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    const logger = new Logger('Bootstrap');

    app.set('trust proxy', 1);
    app.enableShutdownHooks();
    // ...
  ```

---

### 3.5 [Check 4 & Check 9] Fix Bull v4 Retained `jobId` Silently Dropping Subsequent Bar Refits & Retries (`railway-gateway`)

- **Files:**
  1. `railway-gateway/src/gateway/validation.service.ts` (Lines 149–175)
  2. `railway-gateway/src/gateway/indicator-statistics.controller.ts` (Lines 61–67)
  3. `railway-gateway/src/gateway/currency-gold-indices.controller.ts` (Lines 64–71)
- **Current Defect:**
  - `GatewayModule` (`src/gateway/gateway.module.ts:24–25`) configures `removeOnComplete: 100, removeOnFail: 500`.
  - In Bull v4 (`bull`), `queue.add(name, data, { jobId })` checks Redis for `bull:<queue>:<jobId>`. If that job key still exists in Redis (because it is one of the 100 retained completed jobs or 500 retained failed jobs), **Bull v4 does not enqueue a new job or update the payload** — it silently returns the old completed/failed job!
  - Look at `ValidationService.checkDuplicates()` (`src/gateway/validation.service.ts:149–167`):
    ```typescript
    if (state === 'completed') {
      const finishedAt = existingJob.finishedOn;
      const now = Date.now();
      if (finishedAt && now - finishedAt < 60_000) {
        throw new ConflictException(
          `Job recently completed: ${jobId} (${Math.floor((now - finishedAt) / 1000)}s ago)`
        );
      }
    }
    ```
    The code explicitly intends to allow a re-send once a completed job is $\ge 60\text{s}$ old (tested in `test/validation.service.spec.ts:160–167`), and also when a previously failed job (`state === 'failed'`) is retried by the Push Worker. **However**, because `existingJob.remove()` is not called before `this.queue.add('process', data, { jobId })`, Bull v4 sees the old job key still in the `completed` (100) or `failed` (500) set and silently skips processing the new bar data!
- **Proposed Fix:**
  In `ValidationService.checkDuplicates()` (`src/gateway/validation.service.ts:153–167`), if `existingJob` is in `completed` state (and $\ge 60\text{s}$ old) or `failed` state, remove the old job record (`await existingJob.remove?.()`) so that `this.queue.add('process', data, { jobId })` actually enqueues and processes the updated payload while keeping the deterministic `jobId`:
  ```typescript
  if (state === 'completed') {
    const finishedAt = existingJob.finishedOn;
    const now = Date.now();
    if (finishedAt && now - finishedAt < 60_000) {
      throw new ConflictException(
        `Job recently completed: ${jobId} (${Math.floor((now - finishedAt) / 1000)}s ago)`
      );
    }
    await existingJob.remove?.();
  } else if (state === 'failed') {
    await existingJob.remove?.();
  }
  ```
  _(Using optional chaining `existingJob.remove?.()` ensures 100% backward compatibility with existing unit test mocks in `test/validation.service.spec.ts` that only mock `{ getState, finishedOn }`.)_

---

### 3.6 [Check 7] Fix `NaN` Pagination Parameter Triggering Unhandled HTTP 500 (`railway-gateway` & `operation-service`)

- **Files:**
  1. `railway-gateway/src/gateway/active-indicator.controller.ts` (Lines 41–50) & `railway-gateway/src/cycle/active-indicator/active-indicator.service.ts` (Line 252)
  2. `operation-service/src/users/users.controller.ts` (Lines 176–200)
- **Current Defect:**
  - In `ActiveIndicatorService.listSettings` (`active-indicator.service.ts:252`), `const limit = Math.min(Math.max(options.limit ?? 100, 1), 500)` evaluates to `NaN` when `options.limit` is `NaN` (e.g., `?limit=abc`), causing `this.prisma.activeIndicatorSetting.findMany({ take: NaN })` to throw an unhandled `PrismaClientValidationError` (HTTP 500).
  - In `UsersController.getLoginHistory` (`L181–182`) and `getSecurityAlerts` (`L197–198`), `parseInt(limitParam || '20', 10)` and `parseInt(offsetParam || '0', 10)` pass `NaN` or negative integers to Prisma `take`/`skip` on malformed query strings, also causing HTTP 500.
- **Proposed Fix:**
  - In `railway-gateway/src/gateway/active-indicator.controller.ts:46–49`, validate that if `limit !== undefined`, `Number.isFinite(parsedLimit) && Number.isInteger(parsedLimit) && parsedLimit >= 1` (throwing `BadRequestException` otherwise), and guard `Number.isFinite(options.limit)` in `active-indicator.service.ts:252`.
  - In `operation-service/src/users/users.controller.ts:181–182, 197–198`, clamp `limit` and `offset` safely (`const parsedLimit = parseInt(limitParam || '20', 10); const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 20;` and `const parsedOffset = parseInt(offsetParam || '0', 10); const offset = Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0;`).

---

## 4. Tier 2 — Pre-Cutover Financial & Scaling Gates (`money-service` & Outbox)

> **Goal:** Close all financial race conditions, cross-user idempotency collisions, non-atomic commission mutations, and multi-replica cron duplication **before** `money-service` Slice 4 write cutover (Session `4A-10`) or scaling beyond 1 replica.
>
> ⚠️ **Governance Note (Non-Negotiable #5):** Because these changes touch `money-service` payment/webhook/commission paths, each item in Tier 2 requires Davin's explicit sign-off and lockstep verification with any mirrored monolith handlers.

### 4.1 [Check 9] Scope `IdempotencyInterceptor` by User Identity & Request Payload Hash (`money-service`)

- **File:** `money-service/src/common/idempotency/idempotency.interceptor.ts` (Lines 38–115)
- **Current Defect:**
  1. **Cross-user cache collision (`L51`):** `const cacheKey = `${request.method}:${request.originalUrl ?? request.url}:${idempotencyKey}``omits the authenticated user's ID. Two users sending the same`Idempotency-Key`header to`POST /v1/stripe/checkout`or`POST /v1/payments/dlocal/create` share the same Redis key, returning User A's checkout session to User B.
  2. **No request body fingerprint check:** Reusing the same `Idempotency-Key` with a different request payload (e.g., changing `planType` or `currency`) silently replays the cached response from the first payload instead of returning `422 Unprocessable Entity`.
  3. **24-hour lock on crash (`L77`):** `this.store.claim(cacheKey, IDEMPOTENCY_TTL_SECONDS)` sets the `IN_PROGRESS` lock TTL to 86,400s (24 hours). If the container restarts mid-flight, the key stays locked in `409 Conflict` for 24 hours.
- **Proposed Fix:**
  1. Include the authenticated principal (`(request as { user?: { id?: string } }).user?.id ?? 'anon'`) in `cacheKey`:
     ```typescript
     const userId = (request as { user?: { id?: string } }).user?.id ?? 'anon';
     const cacheKey = `${userId}:${request.method}:${request.originalUrl ?? request.url}:${idempotencyKey}`;
     ```
  2. Compute a SHA-256 digest of `request.body` (`bodyHash`), store it alongside `{ statusCode, body, bodyHash }` in `IdempotencyStore`, and throw `UnprocessableEntityException('Idempotency-Key cannot be reused with a different request payload')` if a completed record has a mismatched `bodyHash`.
  3. Use a short lease TTL (e.g., `60` seconds) for `store.claim()` (`IN_PROGRESS`) and the full `86,400` seconds TTL only when `store.set()` records the completed response, adding `Retry-After: 5` on `409 Conflict` and `Idempotent-Replayed: true` on cached replays.

---

### 4.2 [Check 1] Remove Silent Mock Payment Fallback When `DLOCAL_API_KEY` Is Unset (`money-service`)

- **File:** `money-service/src/dlocal/dlocal-payment.service.ts` (Lines 110–137, 256–263)
- **Current Defect:**
  - `createPayment()` (`L127`) and `getPaymentStatus()` (`L256`) check `if (process.env['NODE_ENV'] === 'test' || !DLOCAL_API_KEY)`. If `DLOCAL_API_KEY` is accidentally omitted in production, `money-service` logs `'Using mock dLocal response (test mode)'` and returns a fake payment URL and `status: 'PAID'`.
  - Additionally, `L111` interpolates `notification_url: `${process.env['NEXTAUTH_URL']}/api/webhooks/dlocal``without verifying that`NEXTAUTH_URL`is defined, and`money-service/src/stripe/stripe-checkout.controller.ts:120–122`falls back to`'http://localhost:3000'`when`NEXTAUTH_URL` is unset in production.
- **Proposed Fix:**
  - Restrict the mock response strictly to `process.env['NODE_ENV'] === 'test'` (or an explicit `DLOCAL_MOCK_MODE === 'true'` in non-production). When `NODE_ENV !== 'test'` and `!DLOCAL_API_KEY || !DLOCAL_SECRET_KEY || !DLOCAL_LOGIN`, throw an explicit configuration error.
  - Require `NEXTAUTH_URL` in production without falling back to `'http://localhost:3000'`.

---

### 4.3 [Check 9 & Check 11] Atomic Transactions & Webhook Deduplication for Commissions and Payouts (`money-service`)

- **Files:**
  1. `money-service/src/affiliate/conversion-processor.service.ts` (Lines 99–165)
  2. `money-service/src/crons/subscription.service.ts` (Lines 363–387)
  3. `money-service/src/stripe/stripe-webhook.service.ts` (Lines 265–285, 428–446, 568–586, 663–700)
  4. `money-service/src/disbursement/webhook-event-processor.service.ts` (Lines 112–153)
  5. `money-service/src/dlocal/dlocal-webhook.controller.ts` (Lines 187–303)
- **Current Defects & Proposed Fixes:**
  1. **Wrap `ConversionProcessorService.processConversion` in `prisma.$transaction()` (`conversion-processor.service.ts:127–159`):**
     Currently `commission.create` (`L127`), `affiliateCode.update` (`L145`), and `affiliateProfile.update` (`L159`) execute as three separate non-transactional queries. Wrap all three inside `await this.prisma.$transaction(async (tx) => { ... })` with an atomic conditional update on `affiliateCode` (`updateMany({ where: { id, currentUses: { lt: maxUses } } })`) so concurrent checkouts cannot over-redeem a code or desynchronize `AffiliateProfile` balances.
  2. **Wrap `SubscriptionCronService.approveMaturedCommissions` in `prisma.$transaction()` (`subscription.service.ts:363–387`):**
     Currently `commission.update({ data: { status: 'APPROVED' } })` and `affiliateProfile.update({ data: { pendingCommissions: { increment } } })` run as two separate calls in a loop. Wrap the pair in `this.prisma.$transaction` using `updateMany({ where: { id: commission.id, status: 'PENDING' } })` so a commission is never marked `APPROVED` without incrementing `pendingCommissions` exactly once.
  3. **Move `status !== 'COMPLETED'` guards inside `$transaction` for RiseWorks & dLocal webhooks:**
     - In `WebhookEventProcessorService.handlePaymentCompleted` (`webhook-event-processor.service.ts:112–153`), move the `transaction.status === 'COMPLETED'` guard inside `this.prisma.$transaction` using `const updated = await tx.disbursementTransaction.updateMany({ where: { id: transaction.id, status: { not: 'COMPLETED' } }, data: { status: 'COMPLETED', completedAt: new Date() } }); if (updated.count === 0) return;` before decrementing `pendingCommissions` and incrementing `paidCommissions` (matching the pattern already used in `WiseTransferStateReducer` at `src/wise/services/wise-transfer-state.reducer.ts:197–205`).
     - Apply the same atomic `updateMany({ where: { id: payment.id, status: { not: 'COMPLETED' } } })` guard inside `DlocalWebhookController.handlePaymentCompleted` (`dlocal-webhook.controller.ts:206`).
  4. **Deduplicate Stripe Webhook Events (`stripe-webhook.service.ts`):**
     - Claim `event.id` in Redis (`SET money:stripe:evt:${event.id} 1 NX EX 604800`) or in a database deduplication table before processing, and in `handleChargeRefunded` (`L663–700`), verify that no `REFUND-CLAWBACK` commission already exists for `commission.id` before inserting a negative clawback row and decrementing `AffiliateProfile` balances.

---

### 4.4 [Check 4] Guard All `@Cron()` and `@Interval()` Jobs with Distributed Locks & Stale Recovery (`money-service` & `operation-service`)

- **Files:**
  1. `money-service/src/crons/crons.scheduler.ts` (Lines 176–231, 439–545)
  2. `money-service/src/outbox/outbox-publisher.cron.ts` (Lines 130–190)
  3. `operation-service/src/alert-engine/alert-cron.scheduler.ts` (Lines 28–78)
- **Current Defects:**
  - All 10 `@Cron()` methods in `money-service/src/crons/crons.scheduler.ts` execute in-process without distributed locking. Under multi-replica deployment (or rolling deploy container overlap), every replica distributes monthly affiliate codes, creates duplicate payout batches, and inserts duplicate downgrade/expiry notifications concurrently.
  - `scheduledDailyMaintenance` (`0 4 * * *`, `crons.scheduler.ts:176–231, 449–455`) re-executes `expireCodes`, `checkExpiringSubscriptions`, and `downgradeExpiredSubscriptions`, which already run on their own standalone daily cron schedules at `00:00` and `01:00`.
  - `OutboxPublisherCron` (`outbox-publisher.cron.ts:183–189`) has no in-memory overlap guard (`isRunning`) on its 5-second `@Interval(5000)` tick and no recovery query to reset rows stuck in `'PROCESSING'` if a container crashes mid-publish.
  - `AlertCronScheduler` (`operation-service/src/alert-engine/alert-cron.scheduler.ts:30–31`) uses only an in-memory `isRunning` flag without a Redis lock, and `AlertCheckerService.triggerAlert` (`alert-checker.service.ts:192–199`) updates `triggerCount: { increment: 1 }` without `where: { id: alert.id, isActive: true }`.
- **Proposed Fix:**
  1. Implement a lightweight Redis distributed lock helper (`withDistributedLock(key, ttlMs, fn)` using `SET key token NX PX ttlMs` and a Lua compare-and-delete release script) in `money-service` and `operation-service`.
  2. Wrap all `@Cron()` handlers in `money-service/src/crons/crons.scheduler.ts` and `AlertCronScheduler.tick()` in `operation-service` with `withDistributedLock`.
  3. Remove the redundant re-execution of `expireCodes`, `checkExpiringSubscriptions`, and `downgradeExpiredSubscriptions` from `scheduledDailyMaintenance` (or consolidate them).
  4. In `OutboxPublisherCron`, add an in-memory `this.isRunning` guard and a periodic recovery query resetting `status: 'PROCESSING'` rows older than 5 minutes back to `status: 'PENDING'`.
  5. Configure `defaultJobOptions: { removeOnComplete: 1000, removeOnFail: 5000 }` on `BullModule.forRoot` in `money-service/src/app.module.ts:52–55` so completed Wise webhook jobs do not accumulate in Redis indefinitely.

---

### 4.5 [Check 9] Deduplicate Outbox Event Consumption & Alert Notification Dispatch (`operation-service`)

- **Files:**
  1. `operation-service/src/outbox/outbox-consumer.service.ts` (Lines 54–92)
  2. `operation-service/src/alert-engine/dispatcher.service.ts` (Lines 23–60)
- **Current Defects:**
  1. `OutboxConsumerService.processEvent()` (`POST /outbox/events`) receives events from `money-service` with at-least-once delivery (`event.id`), but never tracks processed `event.id`s. If `money-service` times out waiting for a response after `operation-service` has already sent the email via Resend, the retry sends a duplicate email.
  2. `DispatcherService.dispatch()` creates a `Notification` row and increments `Alert.triggerCount` inside `prisma.$transaction`, then publishes to Redis (`this.notifyBridge.publish`). If the Redis publish throws, BullMQ retries `dispatch()` up to 5 times (`attempts: 5`), inserting up to 5 duplicate `Notification` rows in PostgreSQL.
- **Proposed Fix:**
  1. In `OutboxConsumerService.processEvent()`, atomically claim `outbox:processed:${event.id}` in Redis (e.g., 7-day TTL) after successful email dispatch and return `{ status: 'already_processed' }` on duplicate delivery.
  2. In `DispatcherService.dispatch()`, make `Notification` creation idempotent per BullMQ `job.id` / `fireId` (or catch `notifyBridge.publish` errors as degraded realtime delivery after the DB transaction commits so BullMQ does not re-insert the database notification).

---

## 5. Tier 3 — Post-Feature-Freeze Production Hardening (All 3 Services)

> **Goal:** Complete all remaining structural, security-boundary, observability, and resource-sizing items across the 17-point checklist once Stack D and service endpoints reach feature freeze.

### 5.1 [Check 1] Boot-Time Environment Schema Validation (`ConfigModule.forRoot`) & Secret Hygiene

- **Target Files:**
  - `operation-service/src/app.module.ts:33` & `operation-service/package.json` (add explicit `zod` dependency)
  - `money-service/src/app.module.ts:37`
  - `railway-gateway/src/app.module.ts:15` & `railway-gateway/package.json` (add `zod` dependency)
  - `railway-gateway/src/sensors/python-runner.ts:78–82`
- **Implementation Blueprint:**
  1. Define a service-specific `envSchema` using `zod` in each service (`src/config/env.validation.ts`) validating all required variables (`NODE_ENV`, `PORT`, `DATABASE_URL`, `REDIS_URL`, service-specific secrets such as `NEXTAUTH_SECRET`, `SVC_TOKEN`, `API_KEYS`, `STRIPE_SECRET_KEY`, etc.) and wire `ConfigModule.forRoot({ isGlobal: true, validate: (config) => envSchema.parse(config) })`.
  2. Replace lazy runtime `process.env[...]` reads and silent `'redis://localhost:6379'` / `'http://localhost:3000'` fallbacks with injected `ConfigService.getOrThrow()`.
  3. In `railway-gateway/src/sensors/python-runner.ts:78–82`, pass a minimal allowlisted environment (`PATH`, `SYSTEMROOT`, `PYTHONPATH`, `TEMP`, `TMP`, `PYTHONDONTWRITEBYTECODE: '1'`) to the `mcd_worker.cli` subprocess instead of spreading `...process.env` (which leaks `DATABASE_URL` and `API_KEYS`).
  4. Add `.dockerignore` and `.env*` ignore entries to `money-service/.gitignore` and `railway-gateway/.dockerignore`.

---

### 5.2 [Check 2] Direct `node` PID 1 Execution, Shutdown Hook Order & V8 Heap Budgets

- **Target Files:**
  - `operation-service/railway.toml:25,33`, `operation-service/railway.json:7`, `operation-service/package.json:13–16`
  - `money-service/railway.toml:17`, `money-service/package.json:12,14`
  - `railway-gateway/railway.toml:15`, `railway-gateway/package.json:13,15,16`
  - `operation-service/src/otel.ts:63–67`, `money-service/src/otel.ts:63–67`
  - `operation-service/src/app.module.ts:38–45`, `money-service/src/app.module.ts:42–51`, `money-service/src/dlocal/dlocal-payment.service.ts:38–48`
  - `money-service/src/wise/queue/wise-webhook.processor.ts:118–120`
- **Implementation Blueprint:**
  1. **Eliminate `npm` PID 1 wrapper:** Change `railway.toml` / `railway.json` start commands across all three services from `npm run start:prod` / `npm run start:worker` to direct Node execution:
     `node --enable-source-maps dist/main.js` (and `node --enable-source-maps dist/main-worker.js`).
  2. **V8 Memory Ceiling & Build Pruning:** Configure `NODE_OPTIONS="--max-old-space-size=768 --enable-source-maps"` (adjusted proportionally to each Railway service's container memory limit) and update `nixpacks.toml` in `operation-service` and `railway-gateway` to use `npm ci --include=dev` followed by `npm prune --omit=dev` after build.
  3. **Close all Redis clients & coordinate OTel shutdown:**
     - Reuse the managed `RedisService` connection (or register an `OnModuleDestroy` provider) for `ThrottlerStorageRedisService` and `dlocal` payment locks so no orphaned `ioredis` sockets remain open during shutdown.
     - Guard `await this.worker?.close()` with `await this.worker.waitUntilReady()` in `WiseWebhookProcessor.onModuleDestroy()` (`money-service/src/wise/queue/wise-webhook.processor.ts:118–120`).
     - Trigger `otelSdk.shutdown()` inside Nest's `onApplicationShutdown` lifecycle hook (after HTTP and worker queues have finished draining) instead of a competing `process.on('SIGTERM')` listener in `otel.ts`.
     - Track active Python child processes in `railway-gateway/src/sensors/python-runner.ts` and await/terminate them on shutdown.

---

### 5.3 [Check 3] Traffic Drain Before Connection Closure (`return503OnClosing` & Drain Delay)

- **Target Files:**
  - `operation-service/src/main.ts`, `operation-service/src/alert-engine/alert-cron.scheduler.ts`
  - `money-service/src/main.ts`
  - `railway-gateway/src/main.ts`
- **Implementation Blueprint:**
  1. Introduce a `ShutdownStateService` implementing `BeforeApplicationShutdown`: when `SIGTERM` arrives, immediately mark the readiness probe as `503 Service Unavailable` and wait a configurable drain window (`SHUTDOWN_DRAIN_MS`, default `5000` ms in production, `0` in test) inside `beforeApplicationShutdown()` so Railway's edge proxy stops routing new requests before Express and Prisma close.
  2. In `AlertCronScheduler` (`operation-service`), implement `beforeApplicationShutdown()` to set `this.active = false` and await any in-flight `AlertCheckerService.checkAlerts()` promise before `PrismaService` disconnects.

---

### 5.4 [Check 4] Remaining Queue & Scheduled Job Hardening (`operation-service` & `railway-gateway`)

- **Target Files:**
  - `operation-service/src/alert-engine/state.ts:30–54`, `operation-service/src/alert-engine/alert-checker.service.ts:192–199`
  - `railway-gateway/src/worker/currency-index-corridor-aggregator.service.ts:44–51`
  - `railway-gateway/src/worker/worker.module.ts:15–40`, `railway-gateway/src/sensors/sensors.module.ts:48`
- **Implementation Blueprint:**
  1. In `operation-service/src/alert-engine/state.ts`, make cooldown and one-shot firing claims atomic via Redis `SET key 1 NX EX ttl` so overlapping worker instances during rolling deploys cannot double-fire an alert, and add `where: { id: alert.id, isActive: true }` in `AlertCheckerService.triggerAlert()`.
  2. In `railway-gateway/src/worker/currency-index-corridor-aggregator.service.ts:44–51`, add an in-process overlap guard and a Redis `SET NX EX` lock around `@Cron(CronExpression.EVERY_5_MINUTES)`.
  3. Share a single `DEFAULT_QUEUE_OPTIONS` constant across `GatewayModule`, `WorkerModule`, `HealthModule`, and `SensorsModule` in `railway-gateway`.

---

### 5.5 [Check 5] Invert Authentication to Deny-by-Default (`APP_GUARD` + `@Public()`) & Constant-Time Secret Comparison

- **Target Files:**
  - `operation-service/src/app.module.ts`, `operation-service/src/auth/jwt-auth.guard.ts`, `operation-service/src/outbox/svc-token.guard.ts:31`, `operation-service/src/auth/two-factor.service.ts:226`
  - `money-service/src/app.module.ts`, `money-service/src/auth/jwt-auth.guard.ts`, `money-service/src/crons/cron-secret.guard.ts:30`, `money-service/src/admin/admin-analytics.controller.ts:59`
  - `railway-gateway/src/app.module.ts`, `railway-gateway/src/auth/api-key.guard.ts:39`, `railway-gateway/src/health/health.controller.ts:36`
- **Implementation Blueprint:**
  1. Create a `@Public()` metadata decorator (`IS_PUBLIC_KEY = 'isPublic'`) in all three services and register the primary authentication guard (`JwtAuthGuard` in `operation-service` and `money-service`; `ApiKeyGuard` in `railway-gateway`) globally via `{ provide: APP_GUARD, useClass: ... }`.
  2. Explicitly decorate only intentionally public endpoints with `@Public()` (e.g., `/health/live`, `/health/ready`, `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`, and provider-signed webhook routes `/v1/webhooks/*`).
  3. Protect `GET /api/v1/queue/stats` in `railway-gateway/src/health/health.controller.ts:36` with `ApiKeyGuard` (do not mark it `@Public()`).
  4. Replace string `!==` / `.includes()` comparisons in `SvcTokenGuard` (`operation-service`), `CronSecretGuard` (`money-service`), and `ApiKeyGuard` (`railway-gateway`) with SHA-256 + `crypto.timingSafeEqual`.
  5. In `operation-service/src/auth/two-factor.service.ts:226`, verify `decoded.purpose === '2fa_verification'` on the 2FA challenge JWT (matching `AuthService.completeTwoFactorLogin` at `src/auth/auth.service.ts:338`).

---

### 5.6 [Check 6] Strict CORS Origin Allowlist, Per-Route Brute-Force Throttling & Client IP Resolution

- **Target Files:**
  - `operation-service/src/main.ts:34–35`, `operation-service/src/realtime/realtime.gateway.ts:34–37`, `operation-service/src/users/users.controller.ts:339–345`
  - `operation-service/src/auth/auth.controller.ts`, `operation-service/src/auth/two-factor.controller.ts`, `operation-service/src/outbox/outbox-consumer.controller.ts`
  - `money-service/src/main.ts:40–41`, `money-service/src/stripe/stripe-checkout.controller.ts`, `money-service/src/dlocal/dlocal-payment.controller.ts`
  - `railway-gateway/src/main.ts:13–15`
- **Implementation Blueprint:**
  1. **CORS Normalization:** Parse `ALLOWED_ORIGINS` as `(process.env['ALLOWED_ORIGINS'] ?? '').split(',').map((s) => s.trim()).filter(Boolean)` and reject wildcard `'*'` when `credentials: true` is active in production.
  2. **Per-Route `@Throttle()` & `@SkipThrottle()`:**
     - Apply strict rate limits (`@Throttle({ default: { ttl: 60_000, limit: 5 } })` or `limit: 10`) on `/auth/login`, `/auth/2fa/verify`, `/user/2fa/verify`, `/auth/forgot-password`, `/user/password` in `operation-service`, and on `/v1/stripe/checkout` and `/v1/payments/dlocal/create` in `money-service`.
     - Apply `@SkipThrottle()` on internal machine-to-machine and probe routes (`/health/*`, `/outbox/events`).
  3. **Client IP Resolution (`operation-service`):** In `UsersController.resolveClientIp()` (`src/users/users.controller.ts:339–345`), use Express's proxy-aware `request.ip` instead of `request.headers['x-forwarded-for']?.split(',')[0]` so clients cannot spoof `UserSession.ipAddress`.

---

### 5.7 [Check 7] Bound All List Endpoints, SQL Aggregations & Batch Array Limits

- **Target Files:**
  - `money-service/src/admin/admin-affiliate-reports.controller.ts:257–261, 360–369, 466–469`
  - `money-service/src/admin/affiliate-management.service.ts:169–182`, `money-service/src/admin/admin-mrr.ts:58–65`
  - `money-service/src/stripe/stripe-checkout.controller.ts:33–68`
  - `operation-service/src/alerts/alerts.service.ts:78–82`, `operation-service/src/alerts/line-alerts.service.ts:55–65`, `operation-service/src/drawings/drawings.service.ts:58–66`, `operation-service/src/users/users.service.ts:312–315`
  - `operation-service/src/drawings/drawings.schemas.ts:37–43`, `operation-service/src/auth/dto/*.dto.ts`
  - `railway-gateway/src/gateway/indicator-statistics.controller.ts`, `economic-events.controller.ts`, `currency-gold-indices.controller.ts`, `symbol-specs.controller.ts`
- **Implementation Blueprint:**
  1. **`money-service` SQL Aggregation & Validation:**
     - Replace the unbounded `this.prisma.commission.findMany` in `AdminAffiliateReportsController.profitLoss` (`L360–369`) with database-level `this.prisma.commission.groupBy` / `aggregate`.
     - Add pagination / `take` caps on nested `commissions` and `affiliateCodes` queries in `AdminAffiliateReportsController` and `AdminAffiliateManagementService`.
     - Validate `@Body()` in `StripeCheckoutController.createCheckout` (`L53`) with a Zod schema (`z.object({ affiliateCode: z.string().trim().max(64).optional(), planType: z.enum(['MONTHLY', 'YEARLY']).optional() }).strict()`).
  2. **`operation-service` List Bounds & Schema Constraints:**
     - Enforce a hard upper `take` cap (e.g., `take: 200`) on `GET /alerts`, `GET /alerts/line`, `GET /drawings`, and `GET /user/sessions` (plus `expiresAt: { gt: new Date() }` on active sessions).
     - Replace `.passthrough()` on `StyleZ` (`drawings.schemas.ts:37–43`) with explicit allowed keys or a bounded key count, and add `@MaxLength(72)` on bcrypt password DTO fields.
  3. **`railway-gateway` Batch Array Caps & `addBulk`:**
     - Enforce a maximum array length (e.g., `maxItems: 1000`) on the 4 batch ingestion controllers (`indicator-statistics`, `economic-events`, `currency-gold-indices`, `symbol-specs`) and replace sequential `for (const data of items) { await this.queue.add(...); }` loops with `await this.queue.addBulk(...)`.

---

### 5.8 [Check 8] Output Control, Explicit Prisma `select` Projections & Error Sanitization

- **Target Files:**
  - `money-service/src/admin/affiliate-management.service.ts:112–144`
  - `money-service/src/wise/wise-recipients.controller.ts:190–199`
  - `money-service/src/dlocal/dlocal-payment.controller.ts:269–272`, `money-service/src/disbursement/controllers/disbursement-batches.controller.ts:144–149, 250–255`
  - `operation-service/src/alerts/line-alerts.service.ts:63,149,216`, `operation-service/src/drawings/drawings.service.ts:64,111,132`
  - `railway-gateway/src/symbol-specs/symbol-specs.service.ts:31–36`
- **Implementation Blueprint:**
  1. Add explicit Prisma `select` projections to `AdminAffiliateManagementService.listAffiliates` (omitting raw `paymentDetails` JSON from the list view), map `WiseRecipientsController.list` through `toSummaryDto()`, and add explicit `select` maps to `LineAlertsService`, `DrawingsService`, and `SymbolSpecsService`.
  2. Sanitize `catch` blocks in `DlocalPaymentController`, `DisbursementBatchesController`, and `WiseBatchesController` so unhandled 500 errors log the raw error internally and return a generic client-safe message.

---

### 5.9 [Check 10] Dependency Alignment, Native/Async Crypto & CI Coverage

- **Target Files:**
  - `operation-service/package.json`, `money-service/package.json`, `railway-gateway/package.json`
  - `operation-service/src/two-factor/two-factor.util.ts:73–111`
  - `.github/workflows/tests.yml`, `.github/workflows/dependencies-security.yml`
- **Implementation Blueprint:**
  1. Add explicit `zod` to `operation-service/package.json` `dependencies`; move `@nestjs/cli` (all 3 services) and `@nestjs/swagger` (where only used by offline spec scripts) to `devDependencies`.
  2. Align `class-validator` in `railway-gateway/package.json` to `^0.15.1` and evaluate migrating `railway-gateway` from legacy `@nestjs/bull` (`bull` v4) to `@nestjs/bullmq` (`bullmq` v5) to match `operation-service` and `money-service`.
  3. Parallelize or offload `bcrypt.hash` / `bcrypt.compare` in `operation-service/src/two-factor/two-factor.util.ts:73–111` so generating/verifying 10 backup codes does not block the main event loop sequentially.
  4. Add `operation-service`, `money-service`, and `railway-gateway` test, typecheck (`tsc --noEmit`), and `npm audit --omit=dev` steps to GitHub Actions CI workflows.

---

### 5.10 [Check 11] Outbound HTTP Timeouts (`AbortSignal.timeout`) & Database Statement Timeouts

- **Target Files:**
  - `operation-service/src/alert-engine/alert-checker.service.ts:148–157`
  - `operation-service/src/security/geo-location.util.ts:45–47`
  - `money-service/src/dlocal/dlocal-payment.service.ts:146–156, 266–273`
  - `money-service/src/disbursement/providers/rise/siwe-auth.ts:103–114, 134–146`
  - `money-service/src/crons/wise-reconciliation.service.ts:212–225`
  - `money-service/src/stripe/stripe.service.ts:52`
  - `operation-service/src/prisma/prisma.service.ts`, `money-service/src/prisma/prisma.service.ts`, `railway-gateway/src/prisma/prisma.service.ts`
- **Implementation Blueprint:**
  1. Attach `signal: AbortSignal.timeout(...)` to every outbound `fetch()` call:
     - `AlertCheckerService.fetchCurrentPrice`: `AbortSignal.timeout(5_000)`
     - `getGeoLocation`: `AbortSignal.timeout(2_000)` (and fire non-blocking so a slow GeoIP lookup never delays user password/2FA requests)
     - `DlocalPaymentService.createPayment` & `getPaymentStatus`: `AbortSignal.timeout(10_000)`
     - `siwe-auth.ts` (`getChallenge`, `submitSignature`): `AbortSignal.timeout(10_000)`
     - `WiseReconciliationService` Resend call: `AbortSignal.timeout(10_000)`
  2. Configure explicit `timeout: 15_000` and `maxNetworkRetries: 2` on `new Stripe(secretKey, { ... })` in `money-service/src/stripe/stripe.service.ts:52`.
  3. Configure `connectionTimeoutMillis: 5_000`, `idleTimeoutMillis: 30_000`, and `statement_timeout: 15_000` on `PrismaPg` in all three services' `PrismaService`.

---

### 5.11 [Check 12] Downstream Resilience: Never-Ending Redis Reconnection & Fail-Open Throttler Storage

- **Target Files:**
  - `operation-service/src/redis/redis.service.ts:16–19`
  - `operation-service/src/app.module.ts:38–45`, `money-service/src/app.module.ts:42–51`
  - `money-service/src/dlocal/dlocal-payment.controller.ts:190–272`
- **Implementation Blueprint:**
  1. **Fix `operation-service` Redis permanent disconnect bug (`src/redis/redis.service.ts:16–19`):** Remove `if (times > 10) return null;` from `retryStrategy` and use bounded exponential backoff with jitter (`Math.min(times * 500, 30_000)`), matching `money-service/src/redis/redis.service.ts:19–25` so `operation-service` and `RealtimeGateway` automatically recover after a Redis restart lasting >27.5s.
  2. **Fail-Open Rate Limiting on Redis Outage:** Configure the Redis client backing `ThrottlerStorageRedisService` with `maxRetriesPerRequest: 1, enableOfflineQueue: false` and wrap `ThrottlerStorageRedisService.increment()` in a try/catch fallback so a transient Redis outage does not cause `ThrottlerGuard` to throw HTTP 500 on every route across `operation-service` and `money-service`.
  3. **Release dLocal lock & mark orphaned payment row on upstream error (`money-service/src/dlocal/dlocal-payment.controller.ts:190–272`):** In the `catch` block of `createPayment`, mark the preliminary `PENDING` payment record as `FAILED` and release the 30-second Redis lock so the user can retry immediately.

---

### 5.12 [Check 13] Automated Prisma Schema Sync Verification in CI

- **Target Files:**
  - `operation-service/prisma/schema.prisma`
  - `railway-gateway/test/schema-sync.spec.ts`
  - `.github/workflows/tests.yml`
- **Implementation Blueprint:**
  Add a CI check verifying that shared models in `operation-service/prisma/schema.prisma`, `money-service/prisma/schema.prisma`, and `railway-gateway/prisma/schema.prisma` stay in sync with the canonical root Prisma schemas (`prisma/non-market-data/schema.prisma` and `prisma/market-data/schema.prisma`).

---

### 5.13 [Check 14] Database Pool Sizing & Redis Connection Multiplexing

- **Target Files:**
  - `operation-service/src/prisma/prisma.service.ts`, `money-service/src/prisma/prisma.service.ts`, `railway-gateway/src/prisma/prisma.service.ts`
  - `railway-gateway/src/app.module.ts:31–33`
  - `operation-service/src/main-worker.ts:27`
- **Implementation Blueprint:**
  1. **Explicit PostgreSQL Pool Math:** Configure `max: parseInt(process.env['DB_POOL_MAX'] ?? '5', 10)` on `PrismaPg` in each service so that:
     $$\text{Total Connections} = (\text{Active Replicas} + \text{Rolling Surge}) \times \text{DB\_POOL\_MAX}$$
     stays safely within the Railway PostgreSQL / PgBouncer connection ceiling across `operation-service` (HTTP + Worker), `money-service`, `railway-gateway`, and the Next.js monolith.
  2. **Multiplex Bull Redis Connections in `railway-gateway`:** Configure a shared `createClient(type, redisOpts)` callback on `BullModule.forRoot` in `railway-gateway/src/app.module.ts:31–33` to reuse `client` and `eclient` instances across all 6 queues, reducing Redis connections per gateway container from $6 \times 3 = 18$ down to $2 + 6 = 8$.
  3. **Decouple Worker Module in `operation-service`:** Create a dedicated `WorkerAppModule` for `operation-service/src/main-worker.ts` (importing only `ConfigModule`, `LoggingModule`, `PrismaModule`, `RedisModule`, and `AlertEngineModule`) so worker replicas do not open unused `ThrottlerModule` and `RealtimeGateway` Redis connections.

---

### 5.14 [Check 15] Request-Scoped Provider Audit (Already Compliant)

- **Status:** **PASS** across all three services.
- **Verification:** Keep a lightweight static test / lint rule ensuring `@Injectable({ scope: Scope.REQUEST })` and `@Inject(REQUEST)` are never introduced; continue using `AsyncLocalStorage` (`logContext` / `correlationContextStorage`) for request-scoped metadata.

---

### 5.15 [Check 16] Global Exception Handling, Structured Logging in `railway-gateway` & Source Maps

- **Target Files:**
  - `operation-service/src/common/filters/all-exceptions.filter.ts:78–97`, `operation-service/src/auth/auth-error.filter.ts:13–40`
  - `money-service/src/common/filters/all-exceptions.filter.ts:36–46`
  - `money-service/src/common/logging/pino-instance.ts:15–25`, `operation-service/src/common/logging/pino-instance.ts`
  - `railway-gateway/src/main.ts`, `railway-gateway/src/common/`
- **Implementation Blueprint:**
  1. **Sanitize 5xx `HttpException` responses:** In `AllExceptionsFilter` (`operation-service` and `money-service`), ensure any `status >= 500` logs the full exception details internally but returns an opaque `'Internal server error'` message to the client, and inject `correlationId` into all error responses (including 4xx `HttpException`s and `AuthErrorFilter`).
  2. **Expand Pino Redaction Paths:** Add wildcard nested paths (`*.password`, `*.token`, `*.secret`, `*.paymentDetails`, `*.accountNumber`, `*.iban`, `req.headers["x-api-key"]`, `req.headers["x-signature-sha256"]`) to `REDACT_PATHS` in `pino-instance.ts`.
  3. **Port `LoggingModule` (`PinoLoggerService`) & `AllExceptionsFilter` to `railway-gateway`:** Upgrade `railway-gateway` from Nest's plaintext console logger to the same structured JSON `PinoLoggerService` + `AllExceptionsFilter` pattern used in `operation-service` and `money-service`.

---

### 5.16 [Check 17] Split Liveness (`/health/live`) vs. Readiness (`/health/ready`) Probes & Correlation Propagation

- **Target Files:**
  - `operation-service/src/health/health.controller.ts`, `operation-service/railway.toml`, `operation-service/railway.json`
  - `money-service/src/health/health.controller.ts`, `money-service/railway.toml`
  - `railway-gateway/src/health/health.controller.ts`, `railway-gateway/railway.toml`
- **Implementation Blueprint:**
  1. **Liveness Probe (`GET /health/live` / `GET /api/v1/health/live`):**
     - Returns `{ status: 'ok', service, uptime: process.uptime() }` with HTTP `200 OK` immediately.
     - **Never** queries PostgreSQL or Redis (preventing simultaneous container restart storms during transient DB/Redis blips).
  2. **Readiness Probe (`GET /health/ready` / `GET /api/v1/health/ready`):**
     - Verifies PostgreSQL (`SELECT 1` with a 2s timeout) and Redis (`PING` with a 2s timeout) and checks `ShutdownStateService.isShuttingDown()`.
     - Returns HTTP `200 OK` when healthy, and **HTTP `503 Service Unavailable`** when degraded or draining (without leaking raw `error.message` strings in the public JSON response).
  3. **Backward Compatibility for Existing Runbooks:** Keep `GET /health` (and `GET /api/v1/health` in `railway-gateway`) mounted and update `healthcheckPath` in `railway.toml` alongside the Stack D / service deployment runbooks.
  4. **Correlation ID Validation & Background Propagation:** Validate incoming `x-correlation-id` headers (`/^[\w-]{1,128}$/`), wrap `@Cron()` and Bull/BullMQ worker job execution in `logContext.run({ correlationId })`, and forward `x-correlation-id` on outbound `fetch()` calls (such as `OutboxPublisherCron`).

---

## 6. Verification & Testing Protocol (Per Tier)

Every tier execution must satisfy the repository's verification gates before completion:

1. **`operation-service`:**
   - `npm test` (Jest unit & integration suites)
   - `npx tsc --noEmit` (zero TypeScript errors)
   - `npm run build` (`nest build` clean)
2. **`money-service`:**
   - `npm test` (Jest suites)
   - `npx tsc --noEmit`
   - `npm run build`
3. **`railway-gateway`:**
   - `npm test` (all unit & e2e suites, including `test/validation.service.spec.ts` and `test/market-data.e2e-spec.ts`)
   - `npm run check:sensor-kit`
   - `npx tsc --noEmit`
   - `npm run build`

---

## 7. Review Questions for Claude Code

When reviewing this plan against the live codebase and migration history, please provide your feedback on the following points:

1. **Tier 1 (§3.1) — `FIXED_TEST_ACCOUNTS` in `operation-service/src/auth/auth.service.ts`:**
   - Are any deployed Railway staging/production smoke tests or Playwright E2E suites currently relying on `FIXED_TEST_ACCOUNTS` against a live `NODE_ENV=production` container, or is gating `FIXED_TEST_ACCOUNTS` behind `NODE_ENV !== 'production' || process.env['ALLOW_FIXED_TEST_ACCOUNTS'] === 'true'` completely safe for all existing workflows?
   - Does the Next.js monolith still hold a copy of `FIXED_TEST_ACCOUNTS` that should be gated in lockstep?
2. **Tier 1 (§3.5) — Bull v4 `existingJob.remove?.()` in `railway-gateway/src/gateway/validation.service.ts`:**
   - In `ValidationService.checkDuplicates()`, removing `existingJob` when `state === 'completed'` (and `now - finishedAt >= 60_000`) or `state === 'failed'` allows subsequent M5/M15 cycle refits and failed-bar retries with the same `${symbol}_${timeframe}_${timestamp}` `jobId` to be re-queued and processed by Bull v4. Do you see any interaction between this and the `cycle-manifest` landed-row verification in Build Step 2 (`CycleManifestService`), or is `MarketDataV6` upsert + `existingJob.remove?.()` the cleanest fix?
3. **Tier 1 (§3.3) — `PinoLoggerService` error serialization in `operation-service` and `money-service`:**
   - Are there any unit tests in `operation-service` or `money-service` that assert on the exact `{ params: [...] }` call shape of `rootPinoLogger.error` that we should update alongside `logging.service.ts`?
4. **Tier 2 (§4.1–§4.4) — `money-service` Sequencing vs. Session `4A-10`:**
   - Do you agree with holding Tier 2 items (`IdempotencyInterceptor` user scoping, `$transaction` wrappers in `ConversionProcessorService` / `approveMaturedCommissions`, webhook atomic guards, and `@Cron` distributed locks) as a pre-cutover gate prior to Session `4A-10`, or would you prefer pulling any specific Tier 2 item into Tier 1?
5. **Tier 3 (§5.16) — `railway-gateway` Health Endpoint & Stack D Runbooks:**
   - Confirm that keeping `GET /api/v1/health` intact until Stack D Steps 2–4 complete their live shadow certification avoids any friction with `docs/runbooks/deploy-stack-d-step2.md` and `deploy-stack-d-step3.md`.
