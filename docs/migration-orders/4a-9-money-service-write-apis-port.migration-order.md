# Migration Order — PORT variant

> For sessions that **move existing code between stacks** (Next.js lib/routes → NestJS). Read
> `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at **Low**: behavior preservation
> IS the deliverable. The current monolith code is ground truth, the OpenAPI contract is the law.

**Session:** 4A-9 (BUILD) · **Variant:** PORT · **Status:** CONFIRMED
**Generated:** 2026-07-27 (Advisor) · **Revised:** 2026-07-27 (Advisor/Davin Ground-Truth Re-alignment) · **Confirmed:** 2026-07-27 (Executor — status-edit authenticity confirmed live by Davin; AdminGuard path citation re-verified and corrected, all other Ground-Truth Re-alignment items re-verified live and hold) · **Flags touched:** `MIGRATE_WRITE_APIS_MONEY_STRIPE`, `MIGRATE_WRITE_APIS_MONEY_DLOCAL`, `MIGRATE_WRITE_APIS_MONEY_ADMIN`, `MIGRATE_WRITE_APIS_MONEY_DISBURSEMENT` (new flags, defined for 4A-10 cutover) · **Estimated time:** ~3–4h
**Target service:** money-service
**Contract:** OpenAPI specs for money domain (`docs/trading_alerts_openapi.yaml` / NestJS controllers under `/v1/*`).
**Contract Rule:** ⚠️ **REAL MONEY.** Per `04-rise-to-wise-migration-plan.md`'s roadmap, Slice 4 does NOT get the VERIFY-RETIRE fast-path — requires full Advisor DRAFT → Davin APPROVED cycle before CONFIRM. **Every write endpoint MUST explicitly specify its idempotency key mechanism in this order — a write endpoint without one is a blocker, not a TODO.**

---

## Why this session, why now

Session 4A-8 (Slice 4 Hardening Gate) hardened the monolith write paths and built reusable NestJS `IdempotencyInterceptor` + `OutboxEvent` transactional outbox infrastructure in `money-service`.

Session 4A-9 is the actual **Slice 4 PORT**: bringing all Slice 4 write endpoints (Stripe checkout, Stripe subscription cancellation, Stripe webhooks, dLocal payment creation, admin code distribution, and disbursement batch execution) into `money-service` as NestJS controllers and services, attaching 4A-8's `IdempotencyInterceptor` and `OutboxService`.

This session is **BUILD ONLY** — zero production traffic cut over. Cutover (flipping feature flags) occurs in Session 4A-10.

---

## Entry criteria

- [x] Session 4A-8 CONFIRMED and closed (`money-service` test suite green 49/49 suites, 400/400 tests, `OutboxEvent` live, `IdempotencyInterceptor` ready).
- [x] Monolith test suites green (`__tests__/lib/stripe/stripe.test.ts`, `__tests__/lib/dlocal/dlocal-payment.test.ts`, `__tests__/lib/admin/code-distribution.test.ts`, `__tests__/api/disbursement/*`). Note: HTTP controller tests for `checkout`, `subscription/cancel`, and `stripe webhook` do not exist in monolith; new NestJS controller specs will be authored as part of porting.
- [x] File inventory below verified against live codebase (paths + line counts re-verified on 2026-07-27).
- [x] Davin present for session authorization (confirmed live, this exchange).

---

## Integration points

- **In:** Next.js client / Admin UI (via future 4A-10 cutover routing).
- **Out:** Stripe API (via Stripe Node SDK), dLocal API (via HTTP client), `operation-service` (via `OutboxPublisherCron` built in 4A-8).
- **Owns:** NestJS write controllers (`/v1/stripe/*`, `/v1/payments/dlocal/*`, `/v1/admin/affiliates/*`, `/v1/disbursement/*`) and services in `money-service`. Zero live traffic in 4A-9.

---

## File Port Order

_(Dependency order: dependencies/leaf services → stateful adapters → NestJS controllers → module glue → test suites last)_

### Step 0 — Package Dependency

- Add `stripe` dependency to `money-service/package.json` (`cd money-service && npm install stripe`).

---

### File 1/10

- **SOURCE:** `lib/stripe/stripe.ts` (335 lines) → **TARGET:** `money-service/src/stripe/stripe.service.ts`
- **Kind:** port + adapt
- **Port steps:**
  - Wrap Stripe Node SDK in NestJS `@Injectable()`.
  - Inject `ConfigService` for `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
  - Port helper methods: `createCheckoutSession`, `cancelSubscription`, `constructEvent`, `buildCheckoutIdempotencyKey`.
- **Invariants:**
  - Must preserve `apiVersion: '2024-11-20.acacia'`.
  - Must preserve price ID mapping logic (`PRO_MONTHLY` / `PRO_ANNUAL`).
- **Idempotency Key Mechanism:** `createCheckoutSession` passes `idempotencyKey` option directly to Stripe SDK's `stripe.checkout.sessions.create({ ... }, { idempotencyKey: key })`.
- **Parity proof:** `stripe.service.spec.ts` unit tests verifying session creation, cancellation API calls, and idempotency key propagation.
- **Commit:** `migrate(money-write-apis): port StripeService to money-service`

---

### File 2/10

- **SOURCE:** `app/api/checkout/route.ts` (179 lines) → **TARGET:** `money-service/src/stripe/stripe-checkout.controller.ts`
- **Kind:** port + adapt
- **Port steps:**
  - Build NestJS `@Controller('v1/stripe/checkout')`.
  - Add `@POST()`, `@UseGuards(JwtAuthGuard)`, `@UseInterceptors(IdempotencyInterceptor)`.
  - Delegate session creation to `StripeService`.
- **Invariants:**
  - Return `{ sessionId: string, url: string }` on 200 success.
  - Return 400 `ALREADY_PRO` if user already holds active `PRO` tier.
  - Return 401 on unauthenticated caller.
- **Idempotency Key Mechanism:** `Idempotency-Key` HTTP header intercepted by `IdempotencyInterceptor` (24h TTL in Redis cache), and passed downstream to `StripeService.createCheckoutSession({ idempotencyKey })`.
- **Parity proof:** Write `stripe-checkout.controller.spec.ts` unit tests asserting 200 URL return, 400 ALREADY_PRO check, and duplicate header cache hit.
- **Commit:** `migrate(money-write-apis): port StripeCheckoutController to money-service`

---

### File 3/10

- **SOURCE:** `app/api/subscription/cancel/route.ts` (154 lines) → **TARGET:** `money-service/src/stripe/stripe-subscription.controller.ts`
- **Kind:** port + adapt
- **Port steps:**
  - Build NestJS `@Controller('v1/stripe/subscriptions')`.
  - Add `@POST('cancel')`, `@UseGuards(JwtAuthGuard)`.
  - Call `StripeService.cancelSubscription` and downgrade user tier in Prisma transaction (creating `OutboxEvent` for `operation-service`).
- **Invariants:**
  - Immediately set user tier to `FREE`.
  - Call `sendCancellationEmail` (via `OutboxEvent` / email queue).
  - Return `{ success: true, message: 'Subscription cancelled successfully', tier: 'FREE' }`.
- **Idempotency Key Mechanism:** **Idempotent by construction** (audited in 4A-W4: re-running sets `tier: 'FREE'` / `status: 'CANCELED'` again; repeat Stripe cancel calls catch 400 "already canceled" gracefully). Optional `Idempotency-Key` header accepted if sent by client.
- **Parity proof:** Write `stripe-subscription.controller.spec.ts` unit tests asserting tier downgrade, outbox event creation, and repeat cancellation safety.
- **Commit:** `migrate(money-write-apis): port StripeSubscriptionController to money-service`

---

### File 4/10

- **SOURCE:** `app/api/webhooks/stripe/route.ts` (149 lines) → **TARGET:** `money-service/src/stripe/stripe-webhook.controller.ts`
- **Kind:** port + adapt
- **Port steps:**
  - Build NestJS `@Controller('v1/webhooks/stripe')`.
  - Add `@POST()`, `@Throttle({ default: { ttl: 60000, limit: 300 } })`, raw body parser for signature verification.
  - Delegate event processing (`checkout.session.completed`, `customer.subscription.deleted`, `invoice.payment_failed`) to handler methods.
- **Invariants:**
  - Raw body signature verification via `stripe.webhooks.constructEvent(body, signature, secret)`.
  - Deduplicate side effects via downstream business-state checks (`Subscription.upsert` by `userId`, affiliate code status check before commission credit).
- **Idempotency Key Mechanism:** `Stripe-Signature` header verification + event ID deduplication on business state (`affiliateCode.status !== 'ACTIVE'`).
- **Parity proof:** Write `stripe-webhook.controller.spec.ts` unit tests with RSA/HMAC-signed payload fixtures.
- **Commit:** `migrate(money-write-apis): port StripeWebhookController to money-service`

---

### File 5/10

- **SOURCE:** `lib/dlocal/dlocal-payment.service.ts` (260 lines) → **TARGET:** `money-service/src/dlocal/dlocal-payment.service.ts` (additive extension to existing 4A-4 file)
- **Kind:** port + adapt (additive)
- **Port steps:**
  - `createPayment()` and `generateSignature()` were already ported in 4A-4 (`money-service/src/dlocal/dlocal-payment.service.ts`). **Do NOT clobber or re-write existing methods.**
  - Add ONLY missing `acquireCreatePaymentLock` (the 30s Redis lock added in 4A-8) and payment creation helper methods.
  - Inject `ConfigService` for `DLOCAL_API_KEY`, `DLOCAL_SECRET_KEY`, `DLOCAL_API_URL`.
- **Invariants:**
  - HMAC-SHA256 signature generation with `DLOCAL_SECRET_KEY`.
  - Order ID format: `order-${userId}-${Date.now()}`.
  - Lock TTL: `CREATE_PAYMENT_IDEMPOTENCY_TTL_SECONDS = 30`.
- **Idempotency Key Mechanism:** 30s `acquireCreatePaymentLock` in Redis using `(userId, planType, currency)` hash, rejecting duplicate submits within 30s.
- **Parity proof:** `dlocal-payment.service.spec.ts` unit tests asserting HMAC generation, payment creation payload, and 30s lock behavior.
- **Commit:** `migrate(money-write-apis): extend DlocalPaymentService with acquireCreatePaymentLock`

---

### File 6/10

- **SOURCE:** `app/api/payments/dlocal/create/route.ts` (285 lines) → **TARGET:** `money-service/src/dlocal/dlocal-payment.controller.ts`
- **Kind:** port + adapt
- **Port steps:**
  - Build NestJS `@Controller('v1/payments/dlocal')`.
  - Add `@POST('create')`, `@UseGuards(JwtAuthGuard)`, `@UseInterceptors(IdempotencyInterceptor)`.
  - Validate body with Zod schema (`createPaymentSchema`).
  - Check lock via `DlocalPaymentService.acquireCreatePaymentLock`, create `Payment` row, call dLocal API.
- **Invariants:**
  - Country enum: `['IN', 'NG', 'PK', 'VN', 'ID', 'TH', 'ZA', 'TR']`.
  - Currency enum: `['INR', 'NGN', 'PKR', 'VND', 'IDR', 'THB', 'ZAR', 'TRY']`.
  - Plan types: `'THREE_DAY'` | `'MONTHLY'`.
  - Return 403 if user already holds active subscription.
- **Idempotency Key Mechanism:** `Idempotency-Key` HTTP header handled by `IdempotencyInterceptor` (24h TTL in Redis) + 30s `acquireCreatePaymentLock` in Redis.
- **Parity proof:** `dlocal-payment.controller.spec.ts` unit tests asserting validation, lock check, Payment row creation, and duplicate header cache hit.
- **Commit:** `migrate(money-write-apis): port DlocalPaymentController to money-service`

---

### File 7/10

- **SOURCE:** `lib/admin/code-distribution.ts` (193 lines) + `app/api/admin/affiliates/[id]/distribute-codes/route.ts` (127 lines) → **TARGET:** `money-service/src/admin/admin-affiliates.controller.ts` & `admin-code-distribution.service.ts`
- **Kind:** port + adapt
- **Port steps:**
  - Build `AdminCodeDistributionService` wrapping bonus code generation & distribution logic.
  - Add `@POST(':id/distribute-codes')` to `AdminAffiliatesController` with `@UseGuards(JwtAuthGuard, AdminGuard)`, `@UseInterceptors(IdempotencyInterceptor)`. (Note: Uses `AdminGuard` from `money-service/src/admin/admin.guard.ts` — re-verified live 2026-07-27, not `auth/guards/`.)
- **Invariants:**
  - `count` bounded strictly between 1 and 50.
  - Requires Admin role (`@UseGuards(JwtAuthGuard, AdminGuard)`).
  - Creates `AffiliateBonusCode` batch and enqueues notification via Outbox.
- **Idempotency Key Mechanism:** `Idempotency-Key` HTTP header handled by `IdempotencyInterceptor` (24h TTL in Redis cache), preventing duplicate code generation on admin retries.
- **Parity proof:** `admin-affiliates.controller.spec.ts` unit tests asserting Admin guard check, count bounds, code generation, and idempotency key caching.
- **Commit:** `migrate(money-write-apis): port Admin Code Distribution to money-service`

---

### File 8/10

- **SOURCE:** `app/api/disbursement/batches/[batchId]/execute/route.ts` (148 lines) → **TARGET:** `money-service/src/disbursement/controllers/disbursement-batches.controller.ts`
- **Kind:** port + adapt
- **Port steps:**
  - Build NestJS `@Controller('v1/disbursement/batches')`.
  - Add `@POST(':batchId/execute')`, `@UseGuards(JwtAuthGuard, AdminGuard)`, `@UseInterceptors(IdempotencyInterceptor)`. (Note: Uses `AdminGuard` from `money-service/src/admin/admin.guard.ts` via relative cross-module import — re-verified live 2026-07-27, not `auth/guards/`.)
  - Delegate execution to `PaymentOrchestrator.executeBatch`.
- **Invariants:**
  - Batch status check: reject with 400 if `batch.status` is not `PENDING` or `QUEUED`.
  - Preserves 4A-W6's `isFundable` and provider availability checks (`WisePaymentProvider` vs `MockPaymentProvider`).
- **Idempotency Key Mechanism:** Triple-layered guard:
  1. DB state machine: `batch.status` transitions out of `PENDING`/`QUEUED` on start (rejects subsequent calls with 400).
  2. DB unique constraint: `DisbursementTransaction.commissionId` is `@unique` (prevents double transaction per commission).
  3. HTTP header: `Idempotency-Key` header handled by `IdempotencyInterceptor` (24h TTL in Redis).
- **Parity proof:** `disbursement-batches.controller.spec.ts` unit tests asserting status check, orchestrator execution, and state-machine idempotency.
- **Commit:** `migrate(money-write-apis): port DisbursementBatchesController to money-service`

---

### File 9/10

- **SOURCE:** Monolith test suites (`__tests__/lib/stripe/stripe.test.ts`, `__tests__/lib/dlocal/dlocal-payment.test.ts`, `__tests__/lib/admin/code-distribution.test.ts`, `__tests__/api/disbursement/*`) → **TARGET:** `money-service/src/**/*.spec.ts`
- **Kind:** pure port + new controller specs
- **Port steps:**
  - Port existing service test suites to Jest spec files in `money-service`, updating imports to NestJS services while preserving all behavioral assertions unchanged.
  - Author new controller spec files (`stripe-checkout.controller.spec.ts`, `stripe-subscription.controller.spec.ts`, `stripe-webhook.controller.spec.ts`) for the HTTP endpoints that lacked route-level coverage in monolith.
- **Invariants:** Test assertions MUST NOT be relaxed or modified without written justification in Deviations.
- **Parity proof:** `npm test` inside `money-service` passes 100% green.
- **Commit:** `migrate(money-write-apis): port Slice 4 test suites to money-service`

---

### File 10/10

- **SOURCE:** New module registrations → **TARGET:** `money-service/src/stripe/stripe.module.ts`, `money-service/src/dlocal/dlocal.module.ts`, `money-service/src/admin/admin.module.ts`, `money-service/src/disbursement/disbursement.module.ts`, `money-service/src/app.module.ts`
- **Kind:** new glue
- **Port steps:**
  - Create NestJS feature modules registering new controllers and providers.
  - Import feature modules into `AppModule`.
- **Invariants:** Clean NestJS dependency injection graph; zero missing provider errors at boot.
- **Parity proof:** `nest build` clean; `npm run test` clean; application boots cleanly with `enableShutdownHooks()`.
- **Commit:** `migrate(money-write-apis): register Slice 4 feature modules in AppModule`

---

## Rules specific to this variant

- **Low Creativity Dial:** Behavior preservation IS the deliverable. Monolith code is ground truth.
- **Mandatory Idempotency Keys:** Every single write route ported in this session explicitly defines its idempotency key mechanism above. A write endpoint without one is a blocker, not a TODO.
- **Change Freeze (CC-F):** SOURCE files in monolith (`app/api/checkout/route.ts`, `app/api/payments/dlocal/create/route.ts`, `app/api/subscription/cancel/route.ts`, `app/api/admin/affiliates/[id]/distribute-codes/route.ts`, `app/api/disbursement/batches/[batchId]/execute/route.ts`) become change-frozen (CC-F) upon completion of this session.
- **Zero Traffic Cutover:** This session ends with new controllers BUILT and TESTED inside `money-service`, but ZERO production traffic directed to them (no URL change, no flag flip). Cutover is Session 4A-10.

---

## Slice-level verification (done when)

- [ ] All 10 ported files/modules exist in `money-service`, unit tested, `nest build` clean.
- [ ] `money-service` full test suite 100% green; monolith test suites still green (source untouched).
- [ ] Every write endpoint verified to have its idempotency key mechanism active and tested.
- [ ] Zero production traffic reaches any of these new `money-service` routes (no feature flags flipped ON).

---

## Cutover & rollback (Session 4A-10 — reference only)

- **Mechanism:** Independent feature flags:
  - `MIGRATE_WRITE_APIS_MONEY_STRIPE`
  - `MIGRATE_WRITE_APIS_MONEY_DLOCAL`
  - `MIGRATE_WRITE_APIS_MONEY_ADMIN`
  - `MIGRATE_WRITE_APIS_MONEY_DISBURSEMENT`
- **Precondition:** Davin's explicit live approval per endpoint group before flipping flag ON.
- **Rollback:** Flip flag back to `MONOLITH` (0ms traffic revert).

---

## Known wrinkles / do-not-touch

- `lib/api/index.ts` — standing do-not-touch (Phase 7).
- `POST /v1/stripe/subscriptions/cancel` — idempotent by construction (4A-W4 audit); optional header accepted, no mandatory lock required.
- `payment-orchestrator.service.ts` — re-read 4A-W6 Deviations before editing `executeBatch` integration.
- `AdminGuard` — use `money-service/src/admin/admin.guard.ts` (built 4A-6, exported as `AdminGuard`, imported by `admin-affiliates.controller.ts` today as `./admin.guard`); do not introduce `@Roles()` / `RolesGuard`.

---

## Deviations

_(filled during execution — what / why / impact)_

---

## Next-session handoff

DRAFT order for Session 4A-10 (Slice 4 Write APIs Cutover, TEMPLATE-VERIFY-RETIRE) — flags flip ON, one route group at a time, with Davin present for each live approval.
