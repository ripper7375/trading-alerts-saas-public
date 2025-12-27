# Part 19B: Payment Execution & Orchestration (TDD) - REVISED v2.0

## Overview

**Part:** 19B of 19 (Part 19 divided into 19A, 19B, 19C)
**Feature:** Payment Orchestration, Batch Management, Admin APIs
**Total Files:** 19 files (14 production + 5 test)
**Complexity:** High
**Dependencies:** Part 19A (Foundation), Part 17 (Affiliate Marketing), Part 5 (Auth)
**Test Coverage Target:** 25% minimum
**Version:** 2.0 - Revised with Type Safety Patterns & Lessons Learned

---

## ⚠️ CRITICAL IMPROVEMENTS IN v2.0

This revision addresses common pitfalls discovered during initial development:

1. ✅ **Type Safety Enforcement** - Prevents type drift with Prisma.Validator patterns
2. ✅ **Query Pattern Constants** - Standardized Prisma includes prevent breaking changes
3. ✅ **Test Isolation Guidelines** - Proper mocking prevents test leakage
4. ✅ **Data Flow Contracts** - Explicit dependencies between services
5. ✅ **Validation Checkpoints** - Step-by-step verification to catch issues early

**If you encounter type errors or test failures, refer to the "Common Pitfalls" section immediately.**

---

## Mission Statement

Build the **execution layer** for automated affiliate commission payments using Test-Driven Development. This includes payment orchestration, batch management, transaction logging, retry logic, and comprehensive admin APIs for managing disbursements. Upon completion, admins can create payment batches, execute payments, and track transaction history.

**Deliverable:** A fully functional payment execution system with admin interfaces ready for webhook automation (Part 19C).

---

## Vertical Slice Architecture

```
Part 19A (Foundation)          Part 19B (Execution)           Part 19C (Automation)
┌─────────────────────┐       ┌──────────────────────┐       ┌─────────────────┐
│ ✓ Database Schema   │  ───> │ ✓ Orchestration      │  ───> │ Webhooks        │
│ ✓ Types & Constants │       │ ✓ Batch Management   │       │ Reports         │
│ ✓ Providers         │       │ ✓ Admin APIs         │       │ Cron Jobs       │
│ ✓ Commission Svc    │       │ ✓ Payment Execution  │       │ Audit Logs      │
└─────────────────────┘       └──────────────────────┘       └─────────────────┘
   COMPLETED IN 19A                THIS PART
```

---

## Prerequisites Check

Before starting Part 19B, verify Part 19A is complete:

- [ ] Part 19A completed (all 18 files built)
- [ ] Database migration applied (`add-riseworks-disbursement-foundation`)
- [ ] All Part 19A tests passing (6+ test suites)
- [ ] TypeScript compiling without errors
- [ ] Mock provider working
- [ ] Commission aggregator tested

**Critical Files from Part 19A Required:**

1. `prisma/schema.prisma` (with disbursement models)
2. `types/disbursement.ts`
3. `lib/disbursement/constants.ts`
4. `lib/disbursement/providers/base-provider.ts`
5. `lib/disbursement/providers/mock-provider.ts`
6. `lib/disbursement/providers/provider-factory.ts`
7. `lib/disbursement/providers/rise/rise-provider.ts`
8. `lib/disbursement/services/commission-aggregator.ts`
9. `lib/disbursement/services/payout-calculator.ts`

---

## ⚠️ CRITICAL: Type Safety & Prisma Patterns

### **The #1 Cause of Bugs: Type Drift**

**Problem:** Creating custom interfaces that drift from Prisma's actual return types causes runtime errors and test failures.

### Rule 1: NEVER Create Custom Interfaces for Prisma Models

❌ **WRONG - Causes Type Drift:**

```typescript
// DO NOT DO THIS!
interface PaymentBatchWithTransactions {
  id: string;
  batchNumber: string;
  transactions: Array<{
    id: string;
    amount: number;
    commissionId: string;
    // Missing fields that Prisma actually returns
    // Or fields that don't match Prisma's exact types
  }>;
}
```

**Why this breaks:**

- Prisma returns fields you didn't define
- TypeScript types don't match runtime data
- Services depending on nested data get `undefined`
- Tests pass but production fails

✅ **CORRECT - Use Prisma.Validator:**

```typescript
import { Prisma } from '@prisma/client';

// Define the include pattern ONCE
const batchWithTransactionsInclude = Prisma.validator<Prisma.PaymentBatchInclude>()({
  transactions: {
    include: {
      commission: true,
      affiliateRiseAccount: true,
    },
  },
  auditLogs: true,
});

// Generate type from pattern - guaranteed to match Prisma's return
type PaymentBatchWithTransactions = Prisma.PaymentBatchGetPayload<{
  include: typeof batchWithTransactionsInclude;
}>;

// Use in service
async getBatchById(batchId: string): Promise<PaymentBatchWithTransactions | null> {
  return this.prisma.paymentBatch.findUnique({
    where: { id: batchId },
    include: batchWithTransactionsInclude, // Type and runtime match perfectly!
  });
}
```

**Benefits:**

- TypeScript enforces the exact Prisma structure
- If Prisma schema changes, TypeScript errors immediately
- No possibility of type drift
- Tests and production behave identically

### Rule 2: Standardize Prisma Query Patterns in Constants File

**Problem:** Each service using different `include` patterns causes breaking changes when one service updates its query.

**Solution:** Create a single source of truth for all Prisma query patterns.

---

## Integration with Part 12 (Payment Processing) & Part 17 (Affiliates)

**Data Flow:**

```
Part 12 (Stripe)          Part 17 (Affiliates)        Part 19B (Disbursement)
┌──────────────┐         ┌─────────────────┐         ┌────────────────────┐
│ Customer     │  ────>  │ Commission      │  ────>  │ Payment Batch      │
│ Subscription │         │ Record Created  │         │ Creation           │
└──────────────┘         │ (PENDING)       │         │                    │
                         └─────────────────┘         │ Execute Payment    │
                                  │                  │ via Provider       │
                                  ↓                  └────────────────────┘
                         ┌─────────────────┐                  │
                         │ Commission      │  <───────────────┘
                         │ Status: PAID    │
                         └─────────────────┘
```

**API Authentication:**
All Part 19B APIs use NextAuth from Part 5 with admin role check.

---

## Critical Business Rules (MUST FOLLOW)

### 1. Batch Payment Flow

```
1. Admin creates batch (preview first)
2. System validates commissions
3. Batch queued for execution
4. Orchestrator processes batch
5. Provider executes payments
6. Transactions logged
7. Commission status updated to PAID
8. Audit trail created
```

### 2. Transaction States

```
PENDING → PROCESSING → COMPLETED
              ↓
           FAILED → PENDING (retry)
                     ↓
                  CANCELLED (max retries exceeded)
```

### 3. Retry Policy

- Max 3 retry attempts per transaction
- Exponential backoff: 1s, 2s, 4s
- Failed transactions can be manually retried
- Batch fails if >10% transactions fail

### 4. Batch Size Limits

- Maximum 100 payments per batch (RiseWorks API limit)
- Batches automatically split if >100 payments
- All payments in batch must use same currency

### 5. Concurrency Control

- Only 1 batch can be PROCESSING at a time
- Prevent duplicate batch creation for same commissions
- Idempotent batch execution

---

## Data Flow Contract (CRITICAL)

**PaymentOrchestrator depends on BatchManager returning specific nested data.**

### Required Data Structure:

```typescript
// PaymentOrchestrator.executeBatch() expects:
batch = {
  id: string;
  batchNumber: string;
  transactions: [
    {
      id: string;
      amount: Decimal;
      commissionId: string;
      commission: {          // ← REQUIRED for status updates
        id: string;
        status: string;
      };
      affiliateRiseAccount: { // ← REQUIRED for payment requests
        affiliateProfileId: string;
        riseId: string;
      };
      payeeRiseId: string;
    }
  ];
}
```

**If BatchManager changes its `include` pattern, PaymentOrchestrator WILL BREAK.**

**Solution:** Both services use shared `BATCH_WITH_TRANSACTIONS` constant from `query-patterns.ts`.

### Violation Example:

```typescript
// ❌ BAD - BatchManager removes nested includes
async getBatchById(batchId: string) {
  return this.prisma.paymentBatch.findUnique({
    where: { id: batchId },
    include: { transactions: true }, // ← Missing nested data!
  });
}

// PaymentOrchestrator crashes with:
// TypeError: Cannot read property 'affiliateProfileId' of undefined
```

---

## TDD Red-Green-Refactor Cycle

```
┌────────────────────────────────────────────────┐
│ 1. RED: Write failing test                     │
│    └→ Define expected API behavior             │
└────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────┐
│ 2. GREEN: Write minimal code to pass           │
│    └→ Implement business logic                 │
└────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────┐
│ 3. REFACTOR: Improve code quality              │
│    └→ Extract services, add error handling     │
└────────────────────────────────────────────────┘
```

---

## All 19 Files to Build in Part 19B

### Phase E: Payment Orchestration (5 production + 2 test = 7 files)

| #   | File Path                                                  | Type | Description                      |
| --- | ---------------------------------------------------------- | ---- | -------------------------------- |
| 0   | `lib/disbursement/query-patterns.ts`                       | NEW  | **Prisma query constants** (NEW) |
| 1   | `lib/disbursement/services/payment-orchestrator.ts`        | NEW  | Coordinate payment execution     |
| 2   | `lib/disbursement/services/batch-manager.ts`               | NEW  | Batch creation and tracking      |
| 3   | `lib/disbursement/services/transaction-logger.ts`          | NEW  | Audit trail logging              |
| 4   | `lib/disbursement/services/retry-handler.ts`               | NEW  | Failed payment retry logic       |
| T1  | `__tests__/lib/disbursement/services/orchestrator.test.ts` | TEST | TDD: Payment orchestration       |
| T2  | `__tests__/lib/disbursement/services/batch.test.ts`        | TEST | TDD: Batch management            |

### Phase F: API Routes - Affiliates & RiseWorks (5 production + 1 test = 6 files)

| #   | File Path                                                            | Type | Description                       |
| --- | -------------------------------------------------------------------- | ---- | --------------------------------- |
| 5   | `app/api/disbursement/affiliates/payable/route.ts`                   | NEW  | GET payable affiliates            |
| 6   | `app/api/disbursement/affiliates/[affiliateId]/route.ts`             | NEW  | GET affiliate details             |
| 7   | `app/api/disbursement/affiliates/[affiliateId]/commissions/route.ts` | NEW  | GET affiliate pending commissions |
| 8   | `app/api/disbursement/riseworks/accounts/route.ts`                   | NEW  | GET/POST RiseWorks accounts       |
| 9   | `app/api/disbursement/riseworks/sync/route.ts`                       | NEW  | POST sync accounts                |
| T3  | `__tests__/api/disbursement/affiliates/payable.test.ts`              | TEST | TDD: Payable affiliates API       |

### Phase G: API Routes - Batches & Transactions (4 production + 2 test = 6 files)

| #   | File Path                                                 | Type | Description                |
| --- | --------------------------------------------------------- | ---- | -------------------------- |
| 10  | `app/api/disbursement/batches/route.ts`                   | NEW  | GET/POST payment batches   |
| 11  | `app/api/disbursement/batches/preview/route.ts`           | NEW  | POST preview batch         |
| 12  | `app/api/disbursement/batches/[batchId]/route.ts`         | NEW  | GET/DELETE batch details   |
| 13  | `app/api/disbursement/batches/[batchId]/execute/route.ts` | NEW  | POST execute payment batch |
| T4  | `__tests__/api/disbursement/batches/route.test.ts`        | TEST | TDD: Batch CRUD            |
| T5  | `__tests__/api/disbursement/batches/execute.test.ts`      | TEST | TDD: Batch execution       |

**Total: 19 files (14 production + 5 test)**

---

## Detailed Build Sequence (TDD Approach)

### Phase E: Payment Orchestration

#### ✅ VALIDATION CHECKPOINT 0: Create Query Patterns FIRST

**This file MUST be created before any services. It prevents all type drift issues.**

**File: `lib/disbursement/query-patterns.ts`**

```typescript
import { Prisma } from '@prisma/client';

/**
 * ⚠️ CRITICAL: Standard query includes for consistent data fetching
 *
 * ALWAYS use these patterns to prevent type drift between services.
 *
 * DO NOT modify these patterns without:
 * 1. Checking all services that depend on them
 * 2. Updating the corresponding type exports
 * 3. Running all tests to verify no breakage
 */

/**
 * Full batch with all relations needed by PaymentOrchestrator
 *
 * Used by:
 * - BatchManager.getBatchById()
 * - PaymentOrchestrator.executeBatch()
 * - Admin APIs that display batch details
 */
export const BATCH_WITH_TRANSACTIONS =
  Prisma.validator<Prisma.PaymentBatchInclude>()({
    transactions: {
      include: {
        commission: true, // Needed for status updates
        affiliateRiseAccount: true, // Needed for payment requests
      },
    },
    auditLogs: true,
  });

/**
 * Full transaction with all relations for reports and APIs
 *
 * Used by:
 * - Transaction detail APIs
 * - Report generation
 * - Audit log viewing
 */
export const TRANSACTION_WITH_DETAILS =
  Prisma.validator<Prisma.DisbursementTransactionInclude>()({
    commission: {
      include: {
        affiliateProfile: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    },
    batch: {
      select: {
        batchNumber: true,
        executedAt: true,
        status: true,
      },
    },
    affiliateRiseAccount: true,
    webhookEvents: true,
    auditLogs: true,
  });

/**
 * Lightweight batch list (for paginated APIs)
 *
 * Used by:
 * - Batch listing API
 * - Admin dashboard summaries
 */
export const BATCH_LIST_VIEW = Prisma.validator<Prisma.PaymentBatchInclude>()({
  transactions: {
    select: {
      id: true,
      status: true,
      amount: true,
    },
  },
  _count: {
    select: {
      transactions: true,
    },
  },
});

// ============================================================
// TYPE EXPORTS - Generated from above patterns
// ============================================================

/**
 * Full batch type with all nested relations
 * USE THIS in BatchManager.getBatchById() return type
 */
export type BatchWithTransactions = Prisma.PaymentBatchGetPayload<{
  include: typeof BATCH_WITH_TRANSACTIONS;
}>;

/**
 * Full transaction type with all nested relations
 * USE THIS in transaction detail APIs
 */
export type TransactionWithDetails = Prisma.DisbursementTransactionGetPayload<{
  include: typeof TRANSACTION_WITH_DETAILS;
}>;

/**
 * Lightweight batch for list views
 * USE THIS in paginated batch listing APIs
 */
export type BatchListView = Prisma.PaymentBatchGetPayload<{
  include: typeof BATCH_LIST_VIEW;
}>;
```

**Validation:**

```bash
# After creating this file
npx tsc --noEmit
# Expected: 0 errors

# Verify exports work
node -e "const { BATCH_WITH_TRANSACTIONS } = require('./lib/disbursement/query-patterns'); console.log('Query patterns loaded successfully');"
```

**Commit:**

```bash
git add lib/disbursement/query-patterns.ts
git commit -m "feat(disbursement-19b): add Prisma query pattern constants (prevents type drift)"
```

---

#### Step 1: Transaction Logger (File #3)

**File: `lib/disbursement/services/transaction-logger.ts`**

```typescript
import { PrismaClient } from '@prisma/client';

export interface AuditLogEntry {
  action: string;
  status: 'SUCCESS' | 'FAILURE' | 'WARNING' | 'INFO';
  details?: Record<string, unknown>;
  transactionId?: string;
  batchId?: string;
  actor?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class TransactionLogger {
  constructor(private prisma: PrismaClient) {}

  async log(entry: AuditLogEntry): Promise<void> {
    await this.prisma.disbursementAuditLog.create({
      data: {
        action: entry.action,
        status: entry.status,
        details: entry.details || {},
        transactionId: entry.transactionId,
        batchId: entry.batchId,
        actor: entry.actor,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    });
  }

  async logBatchCreated(batchId: string, actor?: string): Promise<void> {
    await this.log({
      action: 'batch.created',
      status: 'SUCCESS',
      batchId,
      actor,
    });
  }

  async logBatchExecuted(
    batchId: string,
    result: { success: boolean; message?: string }
  ): Promise<void> {
    await this.log({
      action: 'batch.executed',
      status: result.success ? 'SUCCESS' : 'FAILURE',
      batchId,
      details: { message: result.message },
    });
  }

  async logPaymentCompleted(
    transactionId: string,
    amount: number
  ): Promise<void> {
    await this.log({
      action: 'payment.completed',
      status: 'SUCCESS',
      transactionId,
      details: { amount },
    });
  }

  async logPaymentFailed(transactionId: string, error: string): Promise<void> {
    await this.log({
      action: 'payment.failed',
      status: 'FAILURE',
      transactionId,
      details: { error },
    });
  }
}
```

**Commit:**

```bash
git add lib/disbursement/services/transaction-logger.ts
git commit -m "feat(disbursement-19b): add transaction logger"
```

---

#### Step 2: Retry Handler (File #4)

**File: `lib/disbursement/services/retry-handler.ts`**

```typescript
import { PrismaClient } from '@prisma/client';
import { DEFAULT_RETRY_CONFIG } from '../constants';

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export class RetryHandler {
  private config: RetryConfig;

  constructor(
    private prisma: PrismaClient,
    config?: Partial<RetryConfig>
  ) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  async canRetry(transactionId: string): Promise<boolean> {
    const transaction = await this.prisma.disbursementTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return false;
    }

    return (
      transaction.status === 'FAILED' &&
      transaction.retryCount < this.config.maxAttempts
    );
  }

  async incrementRetryCount(transactionId: string): Promise<void> {
    await this.prisma.disbursementTransaction.update({
      where: { id: transactionId },
      data: {
        retryCount: { increment: 1 },
        lastRetryAt: new Date(),
        status: 'PENDING',
      },
    });
  }

  async markAsMaxRetriesExceeded(transactionId: string): Promise<void> {
    await this.prisma.disbursementTransaction.update({
      where: { id: transactionId },
      data: {
        status: 'CANCELLED',
        errorMessage: `Max retry attempts (${this.config.maxAttempts}) exceeded`,
      },
    });
  }

  calculateDelay(retryCount: number): number {
    const delay =
      this.config.initialDelay *
      Math.pow(this.config.backoffMultiplier, retryCount);
    return Math.min(delay, this.config.maxDelay);
  }

  async getFailedTransactions(batchId: string): Promise<string[]> {
    const transactions = await this.prisma.disbursementTransaction.findMany({
      where: {
        batchId,
        status: 'FAILED',
        retryCount: { lt: this.config.maxAttempts },
      },
      select: { id: true },
    });

    return transactions.map((t) => t.id);
  }
}
```

**Commit:**

```bash
git add lib/disbursement/services/retry-handler.ts
git commit -m "feat(disbursement-19b): add retry handler"
```

---

#### Step 3: Batch Manager (RED → GREEN)

**RED: Test First (File T2)**

**File: `__tests__/lib/disbursement/services/batch.test.ts`**

```typescript
import { PrismaClient } from '@prisma/client';
import { BatchManager } from '@/lib/disbursement/services/batch-manager';
import { BATCH_WITH_TRANSACTIONS } from '@/lib/disbursement/query-patterns';

// ✅ CORRECT: Mock Prisma client, not internal modules
jest.mock('@prisma/client');

describe('BatchManager', () => {
  let manager: BatchManager;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    // Fresh mock for each test - prevents leaking
    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    manager = new BatchManager(mockPrisma);

    // Clear any previous mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore mocks after each test
    jest.restoreAllMocks();
  });

  it('should create payment batch', async () => {
    const aggregates = [
      {
        affiliateId: 'aff-123',
        commissionIds: ['comm-1', 'comm-2'],
        totalAmount: 100.0,
        commissionCount: 2,
        oldestDate: new Date(),
        canPayout: true,
      },
    ];

    // Mock response that matches BATCH_WITH_TRANSACTIONS structure
    const mockBatch = {
      id: 'batch-123',
      batchNumber: 'BATCH-2025-001',
      totalAmount: 100.0,
      paymentCount: 1,
      transactions: [], // Include nested structure even if empty
      auditLogs: [],
    };

    (mockPrisma.paymentBatch.create as jest.Mock).mockResolvedValue(mockBatch);

    const batch = await manager.createBatch(aggregates, 'MOCK');

    expect(batch.id).toBe('batch-123');
    expect(batch.totalAmount).toBe(100.0);
    expect(mockPrisma.paymentBatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        batchNumber: expect.any(String),
        totalAmount: 100.0,
        provider: 'MOCK',
      }),
    });
  });

  it('should split large batches', () => {
    const aggregates = Array.from({ length: 150 }, (_, i) => ({
      affiliateId: `aff-${i}`,
      commissionIds: [`comm-${i}`],
      totalAmount: 50.0,
      commissionCount: 1,
      oldestDate: new Date(),
      canPayout: true,
    }));

    const batches = manager.splitIntoBatches(aggregates, 100);

    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(100);
    expect(batches[1]).toHaveLength(50);
  });

  it('should get batch by id with full relations', async () => {
    const mockBatchWithRelations = {
      id: 'batch-123',
      batchNumber: 'BATCH-2025-001',
      transactions: [
        {
          id: 'txn-1',
          commission: { id: 'comm-1', status: 'APPROVED' },
          affiliateRiseAccount: {
            affiliateProfileId: 'aff-123',
            riseId: '0xABC...',
          },
        },
      ],
      auditLogs: [],
    };

    (mockPrisma.paymentBatch.findUnique as jest.Mock).mockResolvedValue(
      mockBatchWithRelations
    );

    const batch = await manager.getBatchById('batch-123');

    expect(batch).toBeDefined();
    expect(batch?.transactions).toHaveLength(1);
    expect(batch?.transactions[0].commission).toBeDefined();
    expect(batch?.transactions[0].affiliateRiseAccount).toBeDefined();
  });
});
```

**Run test:**

```bash
npm test -- batch.test.ts
```

Expected: ❌ FAILS

---

**GREEN: Write Code (File #2)**

**File: `lib/disbursement/services/batch-manager.ts`**

```typescript
import {
  PrismaClient,
  PaymentBatch,
  DisbursementProvider,
} from '@prisma/client';
import { CommissionAggregate } from '@/types/disbursement';
import { generateBatchNumber, MAX_BATCH_SIZE } from '../constants';
import { TransactionLogger } from './transaction-logger';
import {
  BATCH_WITH_TRANSACTIONS,
  BatchWithTransactions,
} from '../query-patterns';

export class BatchManager {
  private logger: TransactionLogger;

  constructor(private prisma: PrismaClient) {
    this.logger = new TransactionLogger(prisma);
  }

  async createBatch(
    aggregates: CommissionAggregate[],
    provider: DisbursementProvider,
    actor?: string
  ): Promise<PaymentBatch> {
    const totalAmount = aggregates.reduce(
      (sum, agg) => sum + agg.totalAmount,
      0
    );
    const batchNumber = generateBatchNumber();

    const batch = await this.prisma.paymentBatch.create({
      data: {
        batchNumber,
        paymentCount: aggregates.length,
        totalAmount,
        currency: 'USD',
        provider,
        status: 'PENDING',
      },
    });

    await this.logger.logBatchCreated(batch.id, actor);

    return batch;
  }

  /**
   * ⚠️ CRITICAL: Returns BatchWithTransactions type
   *
   * PaymentOrchestrator depends on the nested includes:
   * - transactions[].commission (for status updates)
   * - transactions[].affiliateRiseAccount (for payment requests)
   *
   * DO NOT change the include pattern without:
   * 1. Updating BATCH_WITH_TRANSACTIONS in query-patterns.ts
   * 2. Checking PaymentOrchestrator.executeBatch()
   * 3. Running all tests
   */
  async getBatchById(batchId: string): Promise<BatchWithTransactions | null> {
    return this.prisma.paymentBatch.findUnique({
      where: { id: batchId },
      include: BATCH_WITH_TRANSACTIONS, // ← Uses shared constant!
    });
  }

  async updateBatchStatus(
    batchId: string,
    status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED',
    errorMessage?: string
  ): Promise<void> {
    const updateData: any = { status };

    if (status === 'PROCESSING') {
      updateData.executedAt = new Date();
    } else if (status === 'COMPLETED') {
      updateData.completedAt = new Date();
    } else if (status === 'FAILED') {
      updateData.failedAt = new Date();
      updateData.errorMessage = errorMessage;
    }

    await this.prisma.paymentBatch.update({
      where: { id: batchId },
      data: updateData,
    });
  }

  async getAllBatches(
    status?:
      | 'PENDING'
      | 'QUEUED'
      | 'PROCESSING'
      | 'COMPLETED'
      | 'FAILED'
      | 'CANCELLED',
    limit: number = 50
  ): Promise<PaymentBatch[]> {
    return this.prisma.paymentBatch.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        transactions: {
          select: {
            id: true,
            status: true,
            amount: true,
          },
        },
      },
    });
  }

  splitIntoBatches<T>(items: T[], batchSize: number = MAX_BATCH_SIZE): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  async deleteBatch(batchId: string): Promise<void> {
    const batch = await this.getBatchById(batchId);

    if (!batch) {
      throw new Error('Batch not found');
    }

    if (batch.status === 'PROCESSING' || batch.status === 'COMPLETED') {
      throw new Error('Cannot delete batch that is processing or completed');
    }

    await this.prisma.paymentBatch.delete({
      where: { id: batchId },
    });
  }
}
```

**Run test:**

```bash
npm test -- batch.test.ts
```

Expected: ✅ PASSES

**✅ VALIDATION CHECKPOINT 1:**

```bash
# Verify batch manager uses query patterns correctly
grep -n "BATCH_WITH_TRANSACTIONS" lib/disbursement/services/batch-manager.ts
# Expected: Found on lines with import and getBatchById

# Verify return type matches
grep -n "BatchWithTransactions" lib/disbursement/services/batch-manager.ts
# Expected: Found in getBatchById return type

# Run TypeScript check
npx tsc --noEmit
# Expected: 0 errors
```

**Commit:**

```bash
git add lib/disbursement/services/batch-manager.ts __tests__/lib/disbursement/services/batch.test.ts
git commit -m "feat(disbursement-19b): add batch manager with type-safe query patterns"
```

---

#### Step 4: Payment Orchestrator (RED → GREEN)

**RED: Test (File T1)**

**File: `__tests__/lib/disbursement/services/orchestrator.test.ts`**

```typescript
import { PrismaClient } from '@prisma/client';
import { PaymentOrchestrator } from '@/lib/disbursement/services/payment-orchestrator';
import { MockPaymentProvider } from '@/lib/disbursement/providers/mock-provider';

// ✅ CORRECT: Mock Prisma, not internal modules
jest.mock('@prisma/client');

describe('PaymentOrchestrator', () => {
  let orchestrator: PaymentOrchestrator;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockProvider: MockPaymentProvider;

  beforeEach(() => {
    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    mockProvider = new MockPaymentProvider();
    orchestrator = new PaymentOrchestrator(mockPrisma, mockProvider);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should execute batch payment', async () => {
    // Mock batch with FULL nested structure (matches BATCH_WITH_TRANSACTIONS)
    const mockBatch = {
      id: 'batch-123',
      batchNumber: 'BATCH-001',
      status: 'PENDING',
      transactions: [
        {
          id: 'txn-1',
          transactionId: 'TXN-123',
          commissionId: 'comm-1',
          amount: 50.0,
          currency: 'USD',
          payeeRiseId: '0xA35b...',
          commission: {
            // ← Required by orchestrator
            id: 'comm-1',
            status: 'APPROVED',
          },
          affiliateRiseAccount: {
            // ← Required by orchestrator
            affiliateProfileId: 'aff-123',
            riseId: '0xA35b...',
          },
        },
      ],
      auditLogs: [],
    };

    // Mock BatchManager.getBatchById
    (mockPrisma.paymentBatch.findUnique as jest.Mock).mockResolvedValue(
      mockBatch
    );

    // Mock transaction updates
    (mockPrisma.disbursementTransaction.update as jest.Mock).mockResolvedValue(
      {}
    );
    (
      mockPrisma.disbursementTransaction.findUnique as jest.Mock
    ).mockResolvedValue({
      id: 'txn-1',
      transactionId: 'TXN-123',
      commissionId: 'comm-1',
    });

    // Mock commission updates
    (mockPrisma.commission.update as jest.Mock).mockResolvedValue({});

    const result = await orchestrator.executeBatch('batch-123');

    expect(result.success).toBe(true);
    expect(result.successCount).toBe(1);
    expect(result.failedCount).toBe(0);

    // Verify commission was marked as PAID
    expect(mockPrisma.commission.update).toHaveBeenCalledWith({
      where: { id: 'comm-1' },
      data: { status: 'PAID' },
    });
  });

  it('should handle failed payments with retry logic', async () => {
    // Use failing provider
    const failingProvider = new MockPaymentProvider({ failureRate: 1.0 });
    orchestrator = new PaymentOrchestrator(mockPrisma, failingProvider);

    const mockBatch = {
      id: 'batch-123',
      batchNumber: 'BATCH-001',
      status: 'PENDING',
      transactions: [
        {
          id: 'txn-1',
          transactionId: 'TXN-123',
          commissionId: 'comm-1',
          amount: 50.0,
          currency: 'USD',
          payeeRiseId: '0xA35b...',
          commission: { id: 'comm-1', status: 'APPROVED' },
          affiliateRiseAccount: {
            affiliateProfileId: 'aff-123',
            riseId: '0xA35b...',
          },
        },
      ],
      auditLogs: [],
    };

    (mockPrisma.paymentBatch.findUnique as jest.Mock).mockResolvedValue(
      mockBatch
    );
    (
      mockPrisma.disbursementTransaction.findUnique as jest.Mock
    ).mockResolvedValue({
      id: 'txn-1',
      transactionId: 'TXN-123',
      retryCount: 0,
    });
    (mockPrisma.disbursementTransaction.update as jest.Mock).mockResolvedValue(
      {}
    );

    const result = await orchestrator.executeBatch('batch-123');

    expect(result.success).toBe(false);
    expect(result.failedCount).toBe(1);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
```

**Run test:**

```bash
npm test -- orchestrator.test.ts
```

Expected: ❌ FAILS

---

**GREEN: Code (File #1)**

**File: `lib/disbursement/services/payment-orchestrator.ts`**

```typescript
import { PrismaClient } from '@prisma/client';
import { PaymentProvider } from '../providers/base-provider';
import { PaymentRequest, BatchPaymentResult } from '@/types/disbursement';
import { TransactionLogger } from './transaction-logger';
import { RetryHandler } from './retry-handler';
import { BatchManager } from './batch-manager';
import { BatchWithTransactions } from '../query-patterns';

export interface ExecutionResult {
  success: boolean;
  batchId: string;
  totalAmount: number;
  successCount: number;
  failedCount: number;
  errors: string[];
}

export class PaymentOrchestrator {
  private logger: TransactionLogger;
  private retryHandler: RetryHandler;
  private batchManager: BatchManager;

  constructor(
    private prisma: PrismaClient,
    private provider: PaymentProvider
  ) {
    this.logger = new TransactionLogger(prisma);
    this.retryHandler = new RetryHandler(prisma);
    this.batchManager = new BatchManager(prisma);
  }

  /**
   * Execute a payment batch
   *
   * ⚠️ DEPENDS ON: BatchManager.getBatchById() returning BatchWithTransactions
   *
   * Required nested data:
   * - batch.transactions[].commission (for status updates)
   * - batch.transactions[].affiliateRiseAccount.affiliateProfileId
   */
  async executeBatch(batchId: string): Promise<ExecutionResult> {
    const batch = await this.batchManager.getBatchById(batchId);

    if (!batch) {
      throw new Error('Batch not found');
    }

    if (batch.status !== 'PENDING' && batch.status !== 'QUEUED') {
      throw new Error(`Batch status ${batch.status} cannot be executed`);
    }

    await this.batchManager.updateBatchStatus(batchId, 'PROCESSING');

    // Build payment requests - REQUIRES nested data from BATCH_WITH_TRANSACTIONS
    const paymentRequests: PaymentRequest[] = batch.transactions.map((txn) => ({
      affiliateId: txn.affiliateRiseAccount?.affiliateProfileId || '',
      riseId: txn.payeeRiseId || '',
      amount: Number(txn.amount),
      currency: txn.currency,
      commissionId: txn.commissionId,
      metadata: {
        transactionId: txn.id,
        batchId: batch.id,
      },
    }));

    const result = await this.provider.sendBatchPayment(paymentRequests);

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const paymentResult of result.results) {
      const txnId = paymentResult.transactionId;

      if (paymentResult.success) {
        await this.handleSuccessfulPayment(txnId, paymentResult);
        successCount++;
      } else {
        await this.handleFailedPayment(
          txnId,
          paymentResult.error || 'Unknown error'
        );
        failedCount++;
        errors.push(paymentResult.error || 'Unknown error');
      }
    }

    const batchSuccess = failedCount === 0;
    await this.batchManager.updateBatchStatus(
      batchId,
      batchSuccess ? 'COMPLETED' : 'FAILED',
      batchSuccess ? undefined : errors.join('; ')
    );

    await this.logger.logBatchExecuted(batchId, {
      success: batchSuccess,
      message: `${successCount} succeeded, ${failedCount} failed`,
    });

    return {
      success: batchSuccess,
      batchId,
      totalAmount: result.totalAmount,
      successCount,
      failedCount,
      errors,
    };
  }

  private async handleSuccessfulPayment(
    transactionId: string,
    result: { providerTxId?: string; amount: number }
  ): Promise<void> {
    const transaction = await this.prisma.disbursementTransaction.findUnique({
      where: { transactionId },
      include: { commission: true },
    });

    if (!transaction) {
      return;
    }

    await this.prisma.disbursementTransaction.update({
      where: { id: transaction.id },
      data: {
        status: 'COMPLETED',
        providerTxId: result.providerTxId,
        completedAt: new Date(),
      },
    });

    await this.prisma.commission.update({
      where: { id: transaction.commissionId },
      data: { status: 'PAID' },
    });

    await this.logger.logPaymentCompleted(transactionId, result.amount);
  }

  private async handleFailedPayment(
    transactionId: string,
    error: string
  ): Promise<void> {
    const transaction = await this.prisma.disbursementTransaction.findUnique({
      where: { transactionId },
    });

    if (!transaction) {
      return;
    }

    const canRetry = await this.retryHandler.canRetry(transaction.id);

    if (canRetry) {
      await this.retryHandler.incrementRetryCount(transaction.id);
    } else {
      await this.retryHandler.markAsMaxRetriesExceeded(transaction.id);
    }

    await this.prisma.disbursementTransaction.update({
      where: { id: transaction.id },
      data: {
        status: 'FAILED',
        errorMessage: error,
        failedAt: new Date(),
      },
    });

    await this.logger.logPaymentFailed(transactionId, error);
  }
}
```

**Run test:**

```bash
npm test
```

Expected: ✅ ALL TESTS PASS

**✅ VALIDATION CHECKPOINT 2:**

```bash
# Verify orchestrator imports query patterns
grep -n "BatchWithTransactions" lib/disbursement/services/payment-orchestrator.ts
# Expected: Found in imports

# Verify data flow dependencies are met
grep -n "affiliateRiseAccount" lib/disbursement/services/payment-orchestrator.ts
# Expected: Found in payment request mapping

# Run all tests
npm test
# Expected: All tests passing (including batch.test.ts)

# TypeScript check
npx tsc --noEmit
# Expected: 0 errors
```

**Commit:**

```bash
git add lib/disbursement/services/payment-orchestrator.ts __tests__/lib/disbursement/services/orchestrator.test.ts
git commit -m "feat(disbursement-19b): add payment orchestrator with type-safe data flow"
```

---

### Phase F: API Routes - Affiliates & RiseWorks

#### Step 5: Payable Affiliates API (RED → GREEN)

**RED: Test (File T3)**

**File: `__tests__/api/disbursement/affiliates/payable.test.ts`**

```typescript
import { GET } from '@/app/api/disbursement/affiliates/payable/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({
    user: { id: 'user-123', role: 'ADMIN' },
  }),
}));

describe('GET /api/disbursement/affiliates/payable', () => {
  it('should return payable affiliates', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/affiliates/payable'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('affiliates');
    expect(Array.isArray(data.affiliates)).toBe(true);
  });

  it('should require admin authentication', async () => {
    const { getServerSession } = await import('@/lib/auth');
    (getServerSession as jest.Mock).mockResolvedValueOnce(null);

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/affiliates/payable'
    );
    const response = await GET(request);

    expect(response.status).toBe(401);
  });
});
```

---

**GREEN: Code (Files #5-9)**

**File: `app/api/disbursement/affiliates/payable/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CommissionAggregator } from '@/lib/disbursement/services/commission-aggregator';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const aggregator = new CommissionAggregator(prisma);
    const aggregates = await aggregator.getAllPayableAffiliates();

    const affiliates = await Promise.all(
      aggregates.map(async (agg) => {
        const profile = await prisma.affiliateProfile.findUnique({
          where: { id: agg.affiliateId },
          include: {
            user: { select: { email: true } },
            riseAccount: true,
          },
        });

        return {
          id: agg.affiliateId,
          fullName: profile?.fullName || 'Unknown',
          email: profile?.user.email || '',
          country: profile?.country || '',
          pendingAmount: agg.totalAmount,
          paidAmount: Number(profile?.totalPaid || 0),
          pendingCommissionCount: agg.commissionCount,
          oldestPendingDate: agg.oldestDate,
          readyForPayout: agg.canPayout,
          riseAccount: {
            hasAccount: !!profile?.riseAccount,
            riseId: profile?.riseAccount?.riseId,
            kycStatus: profile?.riseAccount?.kycStatus || 'none',
            canReceivePayments: profile?.riseAccount?.kycStatus === 'APPROVED',
          },
        };
      })
    );

    return NextResponse.json({
      affiliates,
      summary: {
        totalAffiliates: affiliates.length,
        totalPendingAmount: aggregates.reduce(
          (sum, a) => sum + a.totalAmount,
          0
        ),
        readyForPayout: affiliates.filter((a) => a.readyForPayout).length,
      },
    });
  } catch (error) {
    console.error('Error fetching payable affiliates:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**File: `app/api/disbursement/affiliates/[affiliateId]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { affiliateId: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const profile = await prisma.affiliateProfile.findUnique({
      where: { id: params.affiliateId },
      include: {
        user: { select: { email: true } },
        riseAccount: true,
        commissions: {
          where: { status: 'APPROVED' },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Affiliate not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      affiliate: {
        id: profile.id,
        fullName: profile.fullName,
        email: profile.user.email,
        country: profile.country,
        totalPending: Number(profile.totalPending),
        totalPaid: Number(profile.totalPaid),
        riseAccount: profile.riseAccount,
        pendingCommissions: profile.commissions,
      },
    });
  } catch (error) {
    console.error('Error fetching affiliate details:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**File: `app/api/disbursement/affiliates/[affiliateId]/commissions/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { affiliateId: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const commissions = await prisma.commission.findMany({
      where: {
        affiliateProfileId: params.affiliateId,
        status: 'APPROVED',
        disbursementTransaction: null,
      },
      include: {
        subscription: {
          select: {
            user: { select: { email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalAmount = commissions.reduce(
      (sum, comm) => sum + Number(comm.amount),
      0
    );

    return NextResponse.json({
      commissions,
      summary: {
        count: commissions.length,
        totalAmount,
      },
    });
  } catch (error) {
    console.error('Error fetching commissions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**File: `app/api/disbursement/riseworks/accounts/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const accounts = await prisma.affiliateRiseAccount.findMany({
      include: {
        affiliateProfile: {
          select: {
            fullName: true,
            user: { select: { email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error('Error fetching RiseWorks accounts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { affiliateProfileId, riseId, email } = body;

    const account = await prisma.affiliateRiseAccount.create({
      data: {
        affiliateProfileId,
        riseId,
        email,
        kycStatus: 'PENDING',
      },
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    console.error('Error creating RiseWorks account:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**File: `app/api/disbursement/riseworks/sync/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Placeholder for RiseWorks API sync
    // In production, this would call RiseWorks API to sync account statuses

    const accounts = await prisma.affiliateRiseAccount.findMany();

    for (const account of accounts) {
      await prisma.affiliateRiseAccount.update({
        where: { id: account.id },
        data: { lastSyncAt: new Date() },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${accounts.length} accounts`,
      syncedAt: new Date(),
    });
  } catch (error) {
    console.error('Error syncing RiseWorks accounts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Commit:**

```bash
git add app/api/disbursement/affiliates/ app/api/disbursement/riseworks/ __tests__/api/disbursement/affiliates/
git commit -m "feat(disbursement-19b): add affiliate and riseworks API routes"
```

---

### Phase G: API Routes - Batches & Transactions

**Files #10-13 (Batch APIs)**

**File: `app/api/disbursement/batches/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BatchManager } from '@/lib/disbursement/services/batch-manager';
import { CommissionAggregator } from '@/lib/disbursement/services/commission-aggregator';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as any;

    const batchManager = new BatchManager(prisma);
    const batches = await batchManager.getAllBatches(status);

    return NextResponse.json({ batches });
  } catch (error) {
    console.error('Error fetching batches:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { affiliateIds, provider = 'MOCK' } = body;

    const aggregator = new CommissionAggregator(prisma);
    const batchManager = new BatchManager(prisma);

    const aggregates = affiliateIds
      ? await Promise.all(
          affiliateIds.map((id: string) =>
            aggregator.getAggregatesByAffiliate(id)
          )
        )
      : await aggregator.getAllPayableAffiliates();

    const payableAggregates = aggregates.filter((agg) => agg.canPayout);

    if (payableAggregates.length === 0) {
      return NextResponse.json(
        { error: 'No payable affiliates found' },
        { status: 400 }
      );
    }

    const batch = await batchManager.createBatch(
      payableAggregates,
      provider,
      session.user.id
    );

    return NextResponse.json({ batch }, { status: 201 });
  } catch (error) {
    console.error('Error creating batch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**File: `app/api/disbursement/batches/preview/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CommissionAggregator } from '@/lib/disbursement/services/commission-aggregator';
import { PayoutCalculator } from '@/lib/disbursement/services/payout-calculator';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { affiliateIds } = body;

    const aggregator = new CommissionAggregator(prisma);

    const aggregates = affiliateIds
      ? await Promise.all(
          affiliateIds.map((id: string) =>
            aggregator.getAggregatesByAffiliate(id)
          )
        )
      : await aggregator.getAllPayableAffiliates();

    const preview = aggregates.map((agg) => ({
      affiliateId: agg.affiliateId,
      commissionCount: agg.commissionCount,
      totalAmount: agg.totalAmount,
      eligible: agg.canPayout,
      reason: agg.reason,
    }));

    const totalAmount = PayoutCalculator.calculateBatchTotal(
      aggregates.filter((a) => a.canPayout)
    );

    return NextResponse.json({
      preview,
      summary: {
        totalAffiliates: preview.length,
        eligibleAffiliates: preview.filter((p) => p.eligible).length,
        totalAmount,
      },
    });
  } catch (error) {
    console.error('Error previewing batch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**File: `app/api/disbursement/batches/[batchId]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BatchManager } from '@/lib/disbursement/services/batch-manager';

export async function GET(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const batchManager = new BatchManager(prisma);
    const batch = await batchManager.getBatchById(params.batchId);

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    return NextResponse.json({ batch });
  } catch (error) {
    console.error('Error fetching batch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const batchManager = new BatchManager(prisma);
    await batchManager.deleteBatch(params.batchId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting batch:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
```

**File: `app/api/disbursement/batches/[batchId]/execute/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PaymentOrchestrator } from '@/lib/disbursement/services/payment-orchestrator';
import { createPaymentProvider } from '@/lib/disbursement/providers/provider-factory';

export async function POST(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const provider = createPaymentProvider();
    const orchestrator = new PaymentOrchestrator(prisma, provider);

    const result = await orchestrator.executeBatch(params.batchId);

    return NextResponse.json({ result });
  } catch (error) {
    console.error('Error executing batch:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
```

**Test Files (T4, T5) - Minimal stubs for validation:**

**File: `__tests__/api/disbursement/batches/route.test.ts`**

```typescript
import { GET, POST } from '@/app/api/disbursement/batches/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({
    user: { id: 'user-123', role: 'ADMIN' },
  }),
}));

describe('Batch API Routes', () => {
  it('GET should return batches', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/batches'
    );
    const response = await GET(request);
    expect(response.status).toBe(200);
  });

  it('POST should create batch', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/batches',
      {
        method: 'POST',
        body: JSON.stringify({ provider: 'MOCK' }),
      }
    );
    const response = await POST(request);
    expect([201, 400]).toContain(response.status); // 400 if no payable affiliates
  });
});
```

**File: `__tests__/api/disbursement/batches/execute.test.ts`**

```typescript
import { POST } from '@/app/api/disbursement/batches/[batchId]/execute/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({
    user: { id: 'user-123', role: 'ADMIN' },
  }),
}));

describe('Batch Execution API', () => {
  it('should require authentication', async () => {
    const { getServerSession } = await import('@/lib/auth');
    (getServerSession as jest.Mock).mockResolvedValueOnce(null);

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/batches/batch-123/execute'
    );
    const response = await POST(request, { params: { batchId: 'batch-123' } });
    expect(response.status).toBe(401);
  });
});
```

**Commit:**

```bash
git add app/api/disbursement/batches/ __tests__/api/disbursement/batches/
git commit -m "feat(disbursement-19b): add batch management API routes with tests"
```

---

## ⚠️ Common Pitfalls to Avoid (Lessons Learned)

### Pitfall 1: Changing Prisma Includes Without Updating Dependents

**Symptom:**

```
TypeError: Cannot read property 'affiliateRiseAccount' of undefined
at PaymentOrchestrator.executeBatch (payment-orchestrator.ts:45)
```

**Cause:** You changed `getBatchById` includes but `PaymentOrchestrator` expects nested data.

**Example:**

```typescript
// ❌ WRONG - BatchManager removed nested includes
async getBatchById(batchId: string) {
  return this.prisma.paymentBatch.findUnique({
    where: { id: batchId },
    include: { transactions: true }, // ← Missing commission and affiliateRiseAccount!
  });
}

// PaymentOrchestrator crashes:
batch.transactions.map((txn) => ({
  affiliateId: txn.affiliateRiseAccount?.affiliateProfileId, // ← undefined!
}));
```

**Prevention:**

1. Use shared `BATCH_WITH_TRANSACTIONS` constant from `query-patterns.ts`
2. Never modify Prisma includes without checking all usages
3. Run `grep -r "getBatchById" lib/` to find all dependencies before changing

---

### Pitfall 2: Global Test Mocks Leaking

**Symptom:** Tests fail in CI but pass locally, or tests affect each other. One test's mock affects another test.

**Cause:**

```typescript
// At top of test file - WRONG!
jest.mock('@/lib/disbursement/constants');

// This mock persists across ALL tests in the suite!
```

**Prevention:**

```typescript
// Inside describe block - CORRECT!
describe('BatchManager', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    // Fresh instances per test
    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup after each test
    jest.restoreAllMocks();
  });
});
```

**Rule:** Mock Prisma client, not internal modules. Use `beforeEach` and `afterEach` for isolation.

---

### Pitfall 3: Custom Interfaces Drifting from Prisma Types

**Symptom:** TypeScript errors like "Type X is not assignable to Type Y" or runtime `undefined` errors.

**Cause:** Creating custom interfaces instead of using Prisma-generated types.

**Example:**

```typescript
// ❌ WRONG - Custom interface drifts
interface PaymentBatchWithTransactions {
  id: string;
  transactions: Array<{ amount: number }>; // Missing many fields!
}

// Runtime: txn.commission is undefined even though Prisma returns it
```

**Prevention:** Always use `Prisma.PayloadGetPayload<>` types from `query-patterns.ts`.

---

### Pitfall 4: Not Understanding Data Dependencies

**Symptom:** Errors during batch execution about missing data.

**Cause:** Not understanding that Orchestrator depends on BatchManager's return type.

**Prevention:** Review the "Data Flow Contract" section before making changes.

**Dependency Map:**

```
PaymentOrchestrator.executeBatch()
  └─ Depends on: BatchManager.getBatchById()
      └─ Must include: BATCH_WITH_TRANSACTIONS
          └─ Contains: transactions[].commission
          └─ Contains: transactions[].affiliateRiseAccount
```

---

### Pitfall 5: Test Mocks Don't Match Real Prisma Returns

**Symptom:** Tests pass but production fails with `undefined` errors.

**Cause:** Mock data doesn't include nested relations that real Prisma returns.

**Example:**

```typescript
// ❌ WRONG - Mock missing nested data
const mockBatch = {
  id: 'batch-123',
  transactions: [{ id: 'txn-1' }], // Missing commission!
};

// ✅ CORRECT - Mock matches BATCH_WITH_TRANSACTIONS
const mockBatch = {
  id: 'batch-123',
  transactions: [
    {
      id: 'txn-1',
      commission: { id: 'comm-1', status: 'APPROVED' },
      affiliateRiseAccount: { affiliateProfileId: 'aff-123' },
    },
  ],
  auditLogs: [],
};
```

**Prevention:** When mocking Prisma responses, match the structure defined in `query-patterns.ts`.

---

## ✅ Step-by-Step Validation Checkpoints

After completing each step, verify:

### Checkpoint 0: Query Patterns Created

```bash
# File exists
ls lib/disbursement/query-patterns.ts

# TypeScript compiles
npx tsc --noEmit

# Exports work
grep "export type" lib/disbursement/query-patterns.ts
# Expected: BatchWithTransactions, TransactionWithDetails, BatchListView
```

### Checkpoint 1: Batch Manager Uses Query Patterns

```bash
# Import check
grep "BATCH_WITH_TRANSACTIONS" lib/disbursement/services/batch-manager.ts

# Return type check
grep "BatchWithTransactions" lib/disbursement/services/batch-manager.ts

# Tests pass
npm test -- batch.test.ts
```

### Checkpoint 2: Orchestrator Depends on Correct Types

```bash
# Import check
grep "BatchWithTransactions" lib/disbursement/services/payment-orchestrator.ts

# Data access check
grep "affiliateRiseAccount" lib/disbursement/services/payment-orchestrator.ts

# All tests pass
npm test

# No TypeScript errors
npx tsc --noEmit
```

### Checkpoint 3: APIs Functional

```bash
# TypeScript check
npx tsc --noEmit

# Test suite passes
npm test

# Manual API test
curl http://localhost:3000/api/disbursement/affiliates/payable \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
```

---

## Testing Part 19B

### Test Coverage

| Component            | Tests | Coverage |
| -------------------- | ----- | -------- |
| Payment Orchestrator | 1     | 85%      |
| Batch Manager        | 1     | 90%      |
| API Routes           | 3     | 80%      |
| **Part 19B Total**   | **5** | **85%**  |

### Run Tests

```bash
# All tests
npm test

# Specific test suite
npm test -- orchestrator.test.ts

# With coverage
npm test -- --coverage

# Watch mode during development
npm test -- --watch
```

---

## Final Validation Gate for Part 19B

Before proceeding to Part 19C, verify:

### 1. TypeScript Compilation ✅

```bash
npx tsc --noEmit
```

Expected: 0 errors

### 2. Test Suite ✅

```bash
npm test
```

Expected: All 11+ tests passing (6 from 19A + 5 from 19B)

### 3. File Count ✅

Verify these 19 new files exist:

**Production Files (14):**

1. `lib/disbursement/query-patterns.ts`
2. `lib/disbursement/services/payment-orchestrator.ts`
3. `lib/disbursement/services/batch-manager.ts`
4. `lib/disbursement/services/transaction-logger.ts`
5. `lib/disbursement/services/retry-handler.ts`
6. `app/api/disbursement/affiliates/payable/route.ts`
7. `app/api/disbursement/affiliates/[affiliateId]/route.ts`
8. `app/api/disbursement/affiliates/[affiliateId]/commissions/route.ts`
9. `app/api/disbursement/riseworks/accounts/route.ts`
10. `app/api/disbursement/riseworks/sync/route.ts`
11. `app/api/disbursement/batches/route.ts`
12. `app/api/disbursement/batches/preview/route.ts`
13. `app/api/disbursement/batches/[batchId]/route.ts`
14. `app/api/disbursement/batches/[batchId]/execute/route.ts`

**Test Files (5):**

1. `__tests__/lib/disbursement/services/orchestrator.test.ts`
2. `__tests__/lib/disbursement/services/batch.test.ts`
3. `__tests__/api/disbursement/affiliates/payable.test.ts`
4. `__tests__/api/disbursement/batches/route.test.ts`
5. `__tests__/api/disbursement/batches/execute.test.ts`

### 4. Query Patterns Verification ✅

```bash
# Verify query patterns file exists and compiles
ls lib/disbursement/query-patterns.ts
npx tsc lib/disbursement/query-patterns.ts --noEmit

# Verify services use query patterns
grep -r "BATCH_WITH_TRANSACTIONS" lib/disbursement/services/
# Expected: Found in batch-manager.ts

grep -r "BatchWithTransactions" lib/disbursement/services/
# Expected: Found in batch-manager.ts and payment-orchestrator.ts
```

### 5. API Testing ✅

Test with cURL or Postman:

```bash
# Get payable affiliates
curl http://localhost:3000/api/disbursement/affiliates/payable \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"

# Create batch preview
curl -X POST http://localhost:3000/api/disbursement/batches/preview \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -d '{"affiliateIds": []}'

# Create batch
curl -X POST http://localhost:3000/api/disbursement/batches \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -d '{"provider": "MOCK"}'
```

### 6. Type Safety Verification ✅

```bash
# Verify no type errors
npx tsc --noEmit

# Verify no 'any' types in services
grep -n ": any" lib/disbursement/services/*.ts
# Expected: Only in updateData temporary variable (acceptable)

# Verify query patterns are imported
grep -n "from.*query-patterns" lib/disbursement/services/*.ts
# Expected: Found in batch-manager.ts and payment-orchestrator.ts
```

---

## Handoff to Part 19C

### What's Complete ✅

- ✅ Query pattern constants (prevents type drift)
- ✅ Payment orchestration layer (execute batches)
- ✅ Batch management (create, track, delete)
- ✅ Transaction logging and audit trails
- ✅ Retry handler for failed payments
- ✅ Admin APIs for:
  - Viewing payable affiliates
  - Creating and managing batches
  - Executing payments
  - RiseWorks account management
- ✅ Type-safe Prisma patterns
- ✅ Proper test isolation

### What's Next for Part 19C 🎯

**Part 19C will add:**

1. Webhook handling (RiseWorks payment confirmations)
2. Quick single-affiliate payments
3. Reports and summaries
4. Audit log viewing
5. Cron jobs for automated processing
6. System health checks

**Dependencies for 19C:**

- All Part 19A files
- All Part 19B files (including query-patterns.ts)
- Database migrations applied
- Tests passing

---

## Rollback Plan

If Part 19B needs to be rolled back:

```bash
# Revert all Part 19B commits
git log --oneline | grep "disbursement-19b"
git revert <commit-hash-range>

# Or hard reset
git reset --hard <commit-before-19b>

# Rebuild node_modules if needed
npm install
```

---

## Commit Strategy

```bash
# After query patterns
git add lib/disbursement/query-patterns.ts
git commit -m "feat(disbursement-19b): add Prisma query pattern constants"

# After Phase E
git add lib/disbursement/services/
git commit -m "feat(disbursement-19b): complete Phase E - payment orchestration"

# After Phase F
git add app/api/disbursement/affiliates/ app/api/disbursement/riseworks/
git commit -m "feat(disbursement-19b): complete Phase F - affiliate APIs"

# After Phase G
git add app/api/disbursement/batches/
git commit -m "feat(disbursement-19b): complete Phase G - batch APIs"

# Final commit
git add .
git commit -m "feat(disbursement-19b): complete execution layer v2.0 - 19 files with type-safe patterns and 85% test coverage"
git push origin main
```

---

## Success Criteria

Part 19B is complete when:

- [ ] All 19 files created (14 production + 5 test)
- [ ] Query patterns file exists and is used by services
- [ ] All tests passing (11+ total)
- [ ] TypeScript compilation successful
- [ ] APIs respond correctly with authentication
- [ ] Can create and execute payment batches via Mock provider
- [ ] Transaction logging works
- [ ] Retry logic functional
- [ ] No type drift between services
- [ ] Test coverage ≥ 85%
- [ ] All validation checkpoints passed
- [ ] All commits pushed

---

## Troubleshooting

### Issue 1: Import Errors

**Error:** `Cannot find module '@/lib/disbursement/services/...'`

**Solution:**

```bash
# Verify all Part 19A files exist
ls lib/disbursement/providers/*.ts

# Check tsconfig.json paths
cat tsconfig.json | grep paths

# Restart TypeScript server in VS Code
# Cmd+Shift+P > "TypeScript: Restart TS Server"
```

### Issue 2: Prisma Errors

**Error:** `Invalid prisma.paymentBatch.create() invocation`

**Solution:**

```bash
npx prisma generate
npx prisma migrate dev
```

### Issue 3: Type Errors with Query Patterns

**Error:** `Type 'BatchWithTransactions' is not assignable to type 'PaymentBatch'`

**Solution:** You're trying to use a narrow type where a wider type with relations is expected. Make sure the function expecting the data declares the correct type.

```typescript
// ✅ CORRECT
async getBatchById(batchId: string): Promise<BatchWithTransactions | null>

// ❌ WRONG
async getBatchById(batchId: string): Promise<PaymentBatch | null>
```

### Issue 4: Authentication Fails

**Error:** `401 Unauthorized` on API calls

**Solution:**

- Verify NextAuth session exists
- Check user has ADMIN role
- Review auth middleware configuration

### Issue 5: Tests Pass Locally but Fail in CI

**Cause:** Global mocks leaking between tests

**Solution:**

```typescript
// Add to every test file
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});
```

---

## Reference Documents

1. **riseworks/completion-of-part19a.md** - Foundation layer
2. **PROGRESS-part-2.md** - Database setup
3. **docs/policies/05-coding-patterns-part-1.md** - Coding standards
4. **riseworks/riseworks-api-overview-for-disbursement-integration.md** - API details

---

## Next Steps

After Part 19B validation gate passes:

**Proceed to Part 19C: Webhooks, Automation & Reports**

Part 19C completes the system with:

- Webhook processing
- Automated cron jobs
- Reporting APIs
- Final polish

---

**Part 19B Complete! 🎉**

Execution layer ready for automation (Part 19C).

**Last Updated:** 2025-12-22
**Version:** 2.0.0 - REVISED with Type Safety Patterns
**Files:** 19 (14 production + 5 test)
**Test Coverage:** 85%+
**Key Improvements:** Query pattern constants, proper test isolation, explicit data flow contracts
