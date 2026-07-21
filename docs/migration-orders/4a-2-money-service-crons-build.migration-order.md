# Migration Order: Crons (Slice 1) → money-service

> For sessions that **move existing code between stacks** (Next.js lib/routes → NestJS;
> monolith rewiring). Read `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at **Low**:
> behavior preservation IS the deliverable; treat every "improvement" instinct as suspect.
> The current code is ground truth. Worked example: `4B-2-alert-engine.migration-order.md`.

**Session:** 4A-2 (BUILD) · **Variant:** PORT · **Status:** CONFIRMED
**Generated:** 2026-07-21 · **Flags touched:** none new (F15/F16 resolved) · **Estimated time:** ~4h
**Phase / plan section:** Phase 4A — money-service, blueprint §5.5 Slice 1 (of 5)
**Target service:** money-service
**Contract:** Internal cron schedules + Prisma schema subset.

## Entry criteria

- [ ] 4A-1 complete: `money-service` skeleton deployed on Railway, `/health` live.
- [ ] File inventory below re-verified against live codebase (paths + line counts).

## Integration points

- **In:** NextJS Vercel Crons triggered via `vercel.json` (being replaced by `@nestjs/schedule`).
- **Out:** Prisma writes (Subscription, AffiliateCode, Commission, PaymentBatch, etc.).
- **Owns:** Crons execution inside `money-service` node process.

## File Port Order

_(dependency order: pure/leaf modules → stateful adapters → orchestration → entrypoints → tests)_

### File 1/6 (Schema subset)

- **SOURCE:** `prisma/non-market-data/schema.prisma`
- **TARGET:** `money-service/prisma/schema.prisma`
- **Kind:** port + adapt (subset)
- **Port steps:** Copy ONLY the models required by these 8 crons (`Subscription`, `AffiliateCode`, `Commission`, `PaymentBatch`, `DisbursementTransaction`, `AffiliateRiseAccount`, `SystemConfig`, `User`, `Notification`, `AffiliateProfile`). Byte-for-byte hand-sync on the fields used.
- **Invariants:** Field names and types must match the monolith exactly.
- **Parity proof:** `npx prisma generate` succeeds in `money-service`.
- **Commit:** `migrate(money-crons): sync prisma schema subset`

### File 2/6 (Cron Business Logic & Dependencies)

- **SOURCE:**
  - `lib/logger.ts` (43 lines)
  - `lib/affiliate/types.ts` (128 lines)
  - `lib/affiliate/constants.ts` (178 lines)
  - `lib/affiliate/db.ts` (156 lines)
  - `lib/affiliate/code-generator.ts` (140 lines)
  - `lib/cron/check-expiring-subscriptions.ts` (168 lines)
  - `lib/cron/downgrade-expired-subscriptions.ts` (170 lines)
  - `lib/cron/monthly-distribution.ts` (148 lines)
- **TARGET:** `money-service/src/crons/subscription.service.ts`, `money-service/src/crons/affiliate.service.ts`, plus shared utils as needed.
- **Kind:** port + adapt
- **Port steps:** Port the dependency tree leaf-first (logger, types, constants → db → code generator → cron logic). Convert to `@Injectable()` NestJS services where stateful (e.g., db access) and inject `PrismaService`.
- **Invariants:** The query logic and status mutation logic must remain byte-identical.
- **Parity proof:** Ported test suites run green against the logic.
- **Commit:** `migrate(money-crons): port cron business logic and dependencies`

### File 3/6 (Disbursement Processor & Dependencies)

- **SOURCE:**
  - `lib/disbursement/constants.ts` (161 lines)
  - `lib/disbursement/providers/base-provider.ts` (172 lines)
  - `lib/disbursement/providers/mock-provider.ts` (297 lines)
  - `lib/disbursement/providers/provider-factory.ts` (101 lines)
  - `lib/disbursement/services/transaction-logger.ts` (229 lines)
  - `lib/disbursement/services/transaction-service.ts` (300 lines)
  - `lib/disbursement/services/retry-handler.ts` (184 lines)
  - `lib/disbursement/services/batch-manager.ts` (369 lines)
  - `lib/disbursement/services/payment-orchestrator.ts` (316 lines)
  - `lib/disbursement/services/commission-aggregator.ts` (286 lines)
  - `lib/disbursement/cron/disbursement-processor.ts` (387 lines)
- **TARGET:** `money-service/src/disbursement/*`
- **Kind:** port + adapt
- **Port steps:** Port the full dependency tree leaf-first (constants → providers → base services → orchestrators → processor). Convert the `DisbursementProcessor` and stateful services to `@Injectable()`s and inject `PrismaService` via constructor instead of instantiating it locally.
- **Invariants:** Transaction flow, error capturing, and log actions must remain unchanged. Mock provider must remain the default path per current codebase behavior.
- **Parity proof:** Ported tests for disbursement processor and its underlying services remain green.
- **Commit:** `migrate(money-crons): port disbursement processor and dependency tree`

### File 4/6 (Cron Handlers & Schedule)

- **SOURCE:** `app/api/cron/*/route.ts` & `vercel.json`
- **TARGET:** `money-service/src/crons/crons.module.ts` + `money-service/src/crons/crons.scheduler.ts`
- **Kind:** port + adapt
- **Port steps:** Replace Next.js API routes with NestJS `@Cron()` decorators inside a scheduler class. Include `daily-maintenance` (which calls expiring/downgrade logic inline), `expire-codes`, and `send-monthly-reports` directly in the scheduler methods (invoking the injected Prisma client or services).
- **Invariants:** **CRITICAL:** Use the exact UTC expressions from `vercel.json` (e.g., `0 0 1 * *`). Do NOT change the timing.
- **Parity proof:** NestJS startup logs show crons registered with correct schedules.
- **Commit:** `migrate(money-crons): map Vercel crons to @nestjs/schedule`

### File 5/6 (Manual Trigger Guard)

- **TARGET:** `money-service/src/crons/cron-trigger.controller.ts`
- **Kind:** new glue
- **Port steps:** Create a set of manual HTTP trigger endpoints for these crons (useful for testing/admin), protected by a simple auth guard checking the `CRON_SECRET` header, mirroring the old protection.
- **Invariants:** Public internet cannot trigger crons.
- **Parity proof:** Attempting to `POST` without `CRON_SECRET` returns 401.
- **Commit:** `migrate(money-crons): add manual trigger endpoints`

### File 6/6 (Tests)

- **SOURCE:** `__tests__/lib/cron/*.test.ts`, `__tests__/api/cron-jobs.test.ts`, `__tests__/api/cron/process-pending.test.ts`
- **TARGET:** `money-service/test/crons/*`
- **Kind:** pure port + new coverage
- **Port steps:** Move tests and update import paths. Use NestJS testing module to mock `PrismaService`. Since `daily-maintenance` and `sync-riseworks-accounts` have zero existing test coverage, write basic integration tests for them to verify they call the correct underlying services (don't leave them entirely uncovered).
- **Invariants:** Existing assertions unchanged (they are the parity oracle).
- **Parity proof:** All suites green in `money-service` Jest config.
- **Commit:** `migrate(money-crons): port test suites and backfill coverage`

## Rules specific to this variant

- Changing a ported test's assertion requires a written justification in Deviations.
- Wrong Prisma client = boundary violation (market vs non-market; role grants will bite).
- SOURCE files become **change-frozen (CC-F)** the moment shadow-run starts.
- This session ends with shadow-run/mirror-run STARTED — cutover is the NEXT session.
- **CRITICAL INVARIANT:** Crons keep the identical UTC expressions from `vercel.json`.

## Slice-level verification (done when)

- [ ] Ported suites green in target; monolith suites still green (source untouched).
- [ ] Contract tests pass byte-for-byte; staging end-to-end path observed once.
- [ ] Shadow/mirror-run started (mechanism: both Vercel and NestJS execute crons in staging); CC-F freeze recorded.

## Cutover & rollback (next session's order — reference only)

- **Mechanism:** Empty `vercel.json`'s `crons` array.
- **Precondition:** clean shadow run diff for one full cycle.
- **Rollback:** Re-add the `vercel.json` crons entries.

## Retire (after cutover proves stable)

- [ ] Delete SOURCE files; update cutover table; CLAUDE.md; update `migration-stack-analysis.md`.

## Deviations

_(filled during execution — what/why/impact)_

### File 3/6 — found a 12th SOURCE file (`types/disbursement.ts`) missed by every prior dependency trace

- **What:** `money-service/src/disbursement/disbursement.types.ts` ports
  `types/disbursement.ts` (162 lines) — not in the CONFIRMed 11-file list.
- **Why:** it's imported via the `@/types/disbursement` alias by 7 of the 11
  CONFIRMed files (constants, base-provider, mock-provider, provider-factory,
  batch-manager, commission-aggregator, payment-orchestrator). Every prior
  dependency trace (CONFIRM's, and this order's own pre-CONFIRM File-3
  closure check) grepped only relative `./`/`../` imports and never the `@/`
  alias form, so this file was invisible to all of them until actually
  reading each file's full import list during the port itself.
- **Impact:** none negative — pure types, zero further imports of its own,
  closure terminates immediately. `npm run build` verified clean with it
  included.

### File 3/6 — `PaymentOrchestrator`'s `provider` moved from constructor to a method parameter; internally-`new`-ed collaborators became constructor-injected

- **What:** `PaymentOrchestratorService.executeBatch(batchId, provider)` now
  takes the `PaymentProvider` as a method argument instead of a constructor
  argument. Separately, `TransactionLoggerService`/`RetryHandlerService`/
  `BatchManagerService`/`TransactionService` (inside `PaymentOrchestratorService`)
  and `CommissionAggregatorService`/`BatchManagerService`/
  `PaymentOrchestratorService`/`TransactionLoggerService` (inside
  `DisbursementProcessorService`) are constructor-injected rather than
  `new`-ed inline from a raw `PrismaClient`, matching `BatchManagerService`'s
  own already-noted pattern.
- **Why:** a Nest `@Injectable()` is resolved once as a singleton by the DI
  container: it cannot take a runtime-varying constructor argument the way
  source's plain `new PaymentOrchestrator(prisma, paymentProvider)`
  (re-constructed per call in `disbursement-processor.ts`) did. Moving
  `provider` to a method parameter keeps the exact same call-site intent —
  a provider is still chosen immediately before executing a batch — while
  making the class a normal, DI-resolvable singleton. The other
  collaborators have no such runtime-varying argument, so converting their
  local `new X(prisma)` into injected singletons is the direct, unavoidable
  consequence of "convert ... to @Injectable()s," not a behavior change.
- **Impact:** none on business logic — every method's query/mutation/log
  sequence is unchanged. Two call sites updated to match: `executeBatch`
  now receives `paymentProvider` as its second argument, and
  `retryFailedTransactions()` no longer constructs a fresh orchestrator per
  batch (that method never touched `this.provider` in source either).

### File 3/6 — two `Decimal`-vs-`number` cast fixes required for `npm run build` to pass

- **What:** in `batch-manager.service.ts` (`getBatchStatistics`) and
  `commission-aggregator.service.ts` (`getTotalPendingAmount`), the source's
  `as { totalAmount?: number }` / `as { commissionAmount?: number }` casts on
  Prisma `.aggregate()`'s `_sum` result now need `as unknown as {...}` —
  TypeScript's structural-overlap check rejects the direct cast because
  Prisma's generated `Decimal` type doesn't sufficiently overlap with
  `number` under money-service's client. Root cause not chased further
  (likely a Prisma client typings difference between this generation and the
  monolith's `non-market-client` one) since the fix the compiler itself
  suggests is purely a type-level annotation — zero runtime behavior change,
  same `Number(...)` coercion immediately after.
- **Impact:** none — `npm run build` clean, money-service's existing 7/7
  suite still green.

### File 1/6 — added `DisbursementAuditLog` as an 11th model (not in the CONFIRMed list)

- **What:** `money-service/prisma/schema.prisma` includes `DisbursementAuditLog` in
  addition to the 10 CONFIRMed models.
- **Why:** `lib/disbursement/services/transaction-logger.ts` (already in File 3/6's
  dependency list) calls `prisma.disbursementAuditLog.create/findMany` directly, and
  `lib/disbursement/services/batch-manager.ts` calls `.deleteMany` on it too. Missed at
  CONFIRM because that pass traced `disbursement-processor.ts`'s own direct `prisma.*`
  calls but not its dependencies' calls one level deeper — the same class of gap as the
  two dependency-tree misses already found and fixed pre-CONFIRM, just one file further
  down the chain.
- **Impact:** none negative — without it, `TransactionLogger`/`BatchManager` (both
  required by `disbursement-processor.ts`) wouldn't compile. `npx prisma generate`
  verified green with it included.

### File 1/6 — `User` ported as a narrow field subset, not the full model

- **What:** `User` in money-service's schema has only `id, email, name, tier,
createdAt, updatedAt` — not the full ~30-field model.
- **Why:** read every `prisma.user.*` call site across File 2/6 + File 3/6 (6 call
  sites total); none ever read or write anything beyond those 4 business fields.
  Mirrors operation-service's own established precedent (its `schema.prisma` header:
  "only the fields operation-service's auth endpoints actually read or write... no
  business logic for any of them yet") — money-service's crons have zero business need
  for password hashes, 2FA secrets, trial/fraud fields, so declaring them here would be
  unnecessary auth-adjacent surface area in a money service with no reason to touch it
  (CLAUDE.md non-negotiable #5). The other 10 models are copied in full since they're
  money-service's own domain tables (blueprint §5.1 grant list), not auth data.
- **Impact:** none — no ported code touches any dropped field.

### File 2/6 — file layout and class naming

- **What:** Ported into `money-service/src/common/logger.util.ts` (logger),
  `money-service/src/affiliate/{affiliate.types.ts, affiliate.constants.ts,
affiliate-config.service.ts, code-generator.service.ts}` (the 4 affiliate
  dependencies), and `money-service/src/crons/{subscription.service.ts,
affiliate.service.ts}` (the 3 cron files, split as the order's own TARGET
  named them: subscription.service.ts holds both
  check-expiring-subscriptions.ts and downgrade-expired-subscriptions.ts;
  affiliate.service.ts holds monthly-distribution.ts). Classes named
  `SubscriptionCronService`/`AffiliateCronService` (not bare
  `SubscriptionService`/`AffiliateService`) to leave room for genuine
  business-domain services of those names in later slices (billing/payments,
  4A-4+) without a collision.
- **Why:** "plus shared utils as needed" in the order's own TARGET line;
  logger and the affiliate config/code-generator pieces are cross-cutting,
  not crons-specific, so they got their own directories rather than being
  inlined into the two cron service files.
- **Impact:** none — purely a file-organization choice, no behavior change.
  `monthly-distribution.ts`'s `distributeCodes` override-via-options
  parameter is preserved exactly (now defaults to the injected
  `CodeGeneratorService.distributeCodes` instead of a module-level function
  import) specifically so File 6/6's ported test can still inject a mock the
  same way the original test does.

### File 1/6 — relation objects kept only where actually traversed, verified by grep not assumption

- **What:** Of the source schema's relations among these 11 models, kept:
  `AffiliateProfile<->Commission`, `AffiliateProfile<->AffiliateRiseAccount`,
  `Commission<->DisbursementTransaction`, `PaymentBatch<->DisbursementTransaction`,
  `PaymentBatch<->DisbursementAuditLog`, `AffiliateRiseAccount<->DisbursementTransaction`.
  Dropped (scalar FK only): `Commission<->AffiliateCode`, `AffiliateCode<->AffiliateProfile`,
  `DisbursementTransaction<->DisbursementAuditLog` (kept `DisbursementAuditLog.batch`
  instead, per what's actually queried).
- **Why:** grepped every `include:` and relation-shaped `where` filter (e.g.
  `disbursementTransaction: null`) across the full dependency tree rather than assuming
  the source schema's relation shape carries over unchanged. `commission-aggregator.ts`,
  `transaction-service.ts`, and `batch-manager.ts` genuinely traverse the 6 kept
  relations (confirmed via `include:` blocks read directly); nothing anywhere traverses
  `AffiliateCode`'s relations or `DisbursementTransaction.auditLogs` specifically (only
  `PaymentBatch.auditLogs` is ever included).
- **Impact:** none negative — `npx prisma generate` succeeded first try with this exact
  shape, meaning the relation pairing is internally consistent, and every `include:` call
  site in the ported dependency tree has a matching schema relation to compile against.

## Known wrinkles / do-not-touch

- `daily-maintenance` (job #2) calls expiring logic directly in the monolith. The new scheduler should simply invoke those injected services instead of duplicating logic.
- `lib/api/index.ts` is known broken, deferred to Phase 7.

## Next-session handoff

_(DRAFT order for 4A-3 — money-service: Slice 1 CUTOVER)_
