# Part 19: RiseWorks Disbursement Integration with Test-Driven Development (TDD)

## Overview

**Part:** 19 of 19
**Feature:** RiseWorks Automated Affiliate Commission Disbursement
**Total Files:** 38 production files + 16 test files = **54 files total**
**Complexity:** High
**Dependencies:** Part 2 (Database), Part 5 (Auth), Part 17 (Affiliate Marketing)
**Test Coverage Target:** 25% minimum

---

## Mission Statement

Build Part 19 (RiseWorks Disbursement) using **Test-Driven Development (TDD)** methodology to create an automated affiliate commission payment system with 25% test coverage from day 1. This system integrates with RiseWorks.io for blockchain-based global payments while maintaining a mock provider for testing.

---

## Why Test-Driven Development for Payment Disbursement?

### Traditional Approach (Build → Test) - DANGEROUS for Money

```
Code → Deploy → Wrong payment → Revenue loss → Manual fixes
```

### TDD Approach (Test → Build) - SAFE for Money

```
Write test → Code fails → Write code → Test passes → Refactor → Safe deployment
```

**Benefits for Payment Disbursement:**

- ✅ **Catch payment bugs before production** (prevent sending wrong amounts)
- ✅ **Verify commission calculations** (ensure affiliates get correct amounts)
- ✅ **Test webhook signature verification** (security-critical)
- ✅ **Validate batch processing** (complex multi-record operations)
- ✅ **Confidence in money flows** (every transaction tested)

---

## TDD Red-Green-Refactor Cycle

```
┌────────────────────────────────────────────────┐
│ 1. RED: Write failing test                     │
│    └→ Define expected behavior                 │
└────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────┐
│ 2. GREEN: Write minimal code to pass           │
│    └→ Make test pass (don't optimize yet)      │
└────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────┐
│ 3. REFACTOR: Improve code quality              │
│    └→ Clean up while keeping tests green       │
└────────────────────────────────────────────────┘
                    ↓
         Repeat for next feature
```

---

## Prerequisites Check

Before starting, verify:

- [ ] Part 2 complete (Database & Prisma setup)
- [ ] Part 5 complete (Authentication with NextAuth)
- [ ] Part 17 complete (Affiliate Marketing with AffiliateProfile, Commission, AffiliateCode models)
- [ ] Node.js and npm working
- [ ] Git repository initialized
- [ ] Testing framework installed (Jest)

---

## ⚠️ CRITICAL: Dependencies from Part 17

**Part 19 READS from these existing Part 17 models (DO NOT recreate):**

- `AffiliateProfile` - Affiliate info, pending/paid commissions
- `Commission` - Individual commission records with status
- `AffiliateCode` - Referral codes
- `User` - Email addresses for affiliates

**Part 19 ADDS these NEW models:**

- `AffiliateRiseAccount` - RiseID mapping for each affiliate
- `PaymentBatch` - Batch payment tracking
- `DisbursementTransaction` - Individual payment transactions
- `RiseWorksWebhookEvent` - Webhook event storage
- `DisbursementAuditLog` - Compliance audit trail

---

## Integration Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                    DISBURSEMENT FLOW                                   │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Part 17 (Affiliate) → Commission earned → Status: PENDING           │
│                              ↓                                        │
│  Part 19 (Disbursement) → Admin reviews → Status: APPROVED            │
│                              ↓                                        │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │              PAYMENT PROVIDER SELECTION                         │ │
│  │  ┌────────────────────┐    ┌───────────────────────────────────┐│ │
│  │  │  MOCK Provider     │ OR │  RISE Provider                    ││ │
│  │  │  - Development     │    │  - Production                     ││ │
│  │  │  - Testing         │    │  - Blockchain-based (USDC)        ││ │
│  │  │  - No external API │    │  - 190+ countries                 ││ │
│  │  └────────────────────┘    └───────────────────────────────────┘│ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                              ↓                                        │
│  Payment Executed → Commission Status: PAID                           │
│                              ↓                                        │
│  Webhook confirms → Transaction logged → Audit trail created          │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Critical Business Rules (MUST FOLLOW)

### 1. Provider Abstraction Pattern

```typescript
interface PaymentProvider {
  authenticate(): Promise<AuthToken>;
  sendPayment(payment: PaymentRequest): Promise<PaymentResult>;
  sendBatchPayment(payments: PaymentRequest[]): Promise<BatchPaymentResult>;
  getPaymentStatus(txId: string): Promise<PaymentStatus>;
  verifyWebhook(payload: string, signature: string): boolean;
}
```

- **MockPaymentProvider**: For testing (default in development)
- **RisePaymentProvider**: For production (uses RiseWorks API)

### 2. RiseWorks API Integration

- **Authentication**: SIWE (Sign-In with Ethereum) - wallet signature
- **Payments**: All amounts in 1e6 units (USDC decimals)
  - $50.00 USD = 50,000,000 units
- **Webhooks**: Signature verification with x-rise-signature header

### 3. Minimum Payout Threshold

- Default: $50.00 USD minimum before eligible for payout
- Configurable via environment variable

### 4. Batch Payment Limits

- Maximum 100 payments per batch (RiseWorks API limit)
- Batches grouped by currency (USD only initially)

### 5. Commission Status Flow

```
PENDING → APPROVED → PAID
    ↓         ↓
CANCELLED  FAILED (can retry)
```

---

## All 54 Files to Build (38 Production + 16 Test)

### Phase A: Database Schema & Types (3 production + 2 test = 5 files)

| #   | File Path                                      | Type   | Description                                   |
| --- | ---------------------------------------------- | ------ | --------------------------------------------- |
| 1   | `prisma/schema.prisma`                         | UPDATE | Add Part 19 models (5 new models, 5 enums)    |
| 2   | `types/disbursement.ts`                        | NEW    | Disbursement type definitions                 |
| 3   | `lib/disbursement/constants.ts`                | NEW    | Provider constants, status values, thresholds |
| T1  | `__tests__/types/disbursement.test.ts`         | TEST   | Test type definitions and constants           |
| T2  | `__tests__/lib/disbursement/constants.test.ts` | TEST   | Test constant values and helpers              |

### Phase B: Provider Abstraction (3 production + 2 test = 5 files)

| #   | File Path                                              | Type | Description                         |
| --- | ------------------------------------------------------ | ---- | ----------------------------------- |
| 4   | `lib/disbursement/providers/base-provider.ts`          | NEW  | Abstract payment provider interface |
| 5   | `lib/disbursement/providers/mock-provider.ts`          | NEW  | Mock provider for testing           |
| 6   | `lib/disbursement/providers/provider-factory.ts`       | NEW  | Factory for provider instantiation  |
| T3  | `__tests__/lib/disbursement/providers/mock.test.ts`    | TEST | TDD: Mock provider behavior         |
| T4  | `__tests__/lib/disbursement/providers/factory.test.ts` | TEST | TDD: Factory pattern                |

### Phase C: RiseWorks Integration (4 production + 2 test = 6 files)

| #   | File Path                                                   | Type | Description                                 |
| --- | ----------------------------------------------------------- | ---- | ------------------------------------------- |
| 7   | `lib/disbursement/providers/rise/rise-provider.ts`          | NEW  | RiseWorks API client                        |
| 8   | `lib/disbursement/providers/rise/siwe-auth.ts`              | NEW  | SIWE (Sign-In with Ethereum) authentication |
| 9   | `lib/disbursement/providers/rise/webhook-verifier.ts`       | NEW  | Webhook signature verification              |
| 10  | `lib/disbursement/providers/rise/amount-converter.ts`       | NEW  | USD to RiseWorks 1e6 units conversion       |
| T5  | `__tests__/lib/disbursement/providers/rise/auth.test.ts`    | TEST | TDD: SIWE authentication                    |
| T6  | `__tests__/lib/disbursement/providers/rise/webhook.test.ts` | TEST | TDD: Webhook verification                   |

### Phase D: Commission Service (3 production + 2 test = 5 files)

| #   | File Path                                                | Type | Description                                |
| --- | -------------------------------------------------------- | ---- | ------------------------------------------ |
| 11  | `lib/disbursement/services/commission-aggregator.ts`     | NEW  | Aggregate pending commissions by affiliate |
| 12  | `lib/disbursement/services/commission-validator.ts`      | NEW  | Pre-payment validation                     |
| 13  | `lib/disbursement/services/payout-calculator.ts`         | NEW  | Calculate amounts, apply thresholds        |
| T7  | `__tests__/lib/disbursement/services/aggregator.test.ts` | TEST | TDD: Commission aggregation                |
| T8  | `__tests__/lib/disbursement/services/validator.test.ts`  | TEST | TDD: Validation logic                      |

### Phase E: Payment Orchestration (4 production + 2 test = 6 files)

| #   | File Path                                                  | Type | Description                  |
| --- | ---------------------------------------------------------- | ---- | ---------------------------- |
| 14  | `lib/disbursement/services/payment-orchestrator.ts`        | NEW  | Coordinate payment execution |
| 15  | `lib/disbursement/services/batch-manager.ts`               | NEW  | Batch creation and tracking  |
| 16  | `lib/disbursement/services/transaction-logger.ts`          | NEW  | Audit trail logging          |
| 17  | `lib/disbursement/services/retry-handler.ts`               | NEW  | Failed payment retry logic   |
| T9  | `__tests__/lib/disbursement/services/orchestrator.test.ts` | TEST | TDD: Payment orchestration   |
| T10 | `__tests__/lib/disbursement/services/batch.test.ts`        | TEST | TDD: Batch management        |

### Phase F: API Routes - Affiliates & RiseWorks Accounts (5 production + 1 test = 6 files)

| #   | File Path                                                            | Type | Description                             |
| --- | -------------------------------------------------------------------- | ---- | --------------------------------------- |
| 18  | `app/api/disbursement/affiliates/payable/route.ts`                   | NEW  | GET payable affiliates with commissions |
| 19  | `app/api/disbursement/affiliates/[affiliateId]/route.ts`             | NEW  | GET affiliate disbursement details      |
| 20  | `app/api/disbursement/affiliates/[affiliateId]/commissions/route.ts` | NEW  | GET affiliate pending commissions       |
| 21  | `app/api/disbursement/riseworks/accounts/route.ts`                   | NEW  | GET/POST RiseWorks accounts             |
| 22  | `app/api/disbursement/riseworks/sync/route.ts`                       | NEW  | POST sync accounts from RiseWorks       |
| T11 | `__tests__/api/disbursement/affiliates/payable.test.ts`              | TEST | TDD: Payable affiliates API             |

### Phase G: API Routes - Batches & Transactions (5 production + 1 test = 6 files)

| #   | File Path                                                 | Type | Description                        |
| --- | --------------------------------------------------------- | ---- | ---------------------------------- |
| 23  | `app/api/disbursement/batches/route.ts`                   | NEW  | GET/POST payment batches           |
| 24  | `app/api/disbursement/batches/preview/route.ts`           | NEW  | POST preview batch before creation |
| 25  | `app/api/disbursement/batches/[batchId]/route.ts`         | NEW  | GET/DELETE batch details           |
| 26  | `app/api/disbursement/batches/[batchId]/execute/route.ts` | NEW  | POST execute payment batch         |
| 27  | `app/api/disbursement/transactions/route.ts`              | NEW  | GET transactions list              |
| T12 | `__tests__/api/disbursement/batches/route.test.ts`        | TEST | TDD: Batch CRUD and execution      |

### Phase H: Webhooks & Quick Payments (3 production + 1 test = 4 files)

| #   | File Path                                        | Type | Description                             |
| --- | ------------------------------------------------ | ---- | --------------------------------------- |
| 28  | `app/api/webhooks/riseworks/route.ts`            | NEW  | POST RiseWorks webhook handler          |
| 29  | `app/api/disbursement/pay/route.ts`              | NEW  | POST single affiliate immediate payment |
| 30  | `lib/disbursement/webhook/event-processor.ts`    | NEW  | Process webhook events                  |
| T13 | `__tests__/api/webhooks/riseworks/route.test.ts` | TEST | TDD: Webhook handling                   |

### Phase I: Reports & Audit (4 production + 1 test = 5 files)

| #   | File Path                                                       | Type | Description                          |
| --- | --------------------------------------------------------------- | ---- | ------------------------------------ |
| 31  | `app/api/disbursement/reports/summary/route.ts`                 | NEW  | GET disbursement summary             |
| 32  | `app/api/disbursement/reports/affiliate/[affiliateId]/route.ts` | NEW  | GET affiliate disbursement history   |
| 33  | `app/api/disbursement/audit-logs/route.ts`                      | NEW  | GET audit logs                       |
| 34  | `app/api/disbursement/config/route.ts`                          | NEW  | GET/PATCH disbursement configuration |
| T14 | `__tests__/api/disbursement/reports/summary.test.ts`            | TEST | TDD: Reports API                     |

### Phase J: Configuration & Health (2 production + 1 test = 3 files)

| #   | File Path                                         | Type | Description              |
| --- | ------------------------------------------------- | ---- | ------------------------ |
| 35  | `app/api/disbursement/health/route.ts`            | NEW  | GET system health check  |
| 36  | `lib/disbursement/config.ts`                      | NEW  | Configuration management |
| T15 | `__tests__/api/disbursement/health/route.test.ts` | TEST | TDD: Health check        |

### Phase K: Cron Jobs (2 production + 1 test = 3 files)

| #   | File Path                                                  | Type | Description                               |
| --- | ---------------------------------------------------------- | ---- | ----------------------------------------- |
| 37  | `app/api/cron/process-pending-disbursements/route.ts`      | NEW  | Cron: Auto-process eligible disbursements |
| 38  | `app/api/cron/sync-riseworks-accounts/route.ts`            | NEW  | Cron: Sync RiseWorks account status       |
| T16 | `__tests__/api/cron/process-pending-disbursements.test.ts` | TEST | TDD: Cron job logic                       |

---

## TDD Build Sequence with Red-Green-Refactor

### Phase A: Database Schema & Types (TDD)

#### Step 1: Update Database Schema (RED)

**File: `prisma/schema.prisma`** (ADD these models - DO NOT remove existing)

```prisma
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RISEWORKS DISBURSEMENT SYSTEM (Part 19)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

enum RiseWorksKycStatus {
  PENDING
  SUBMITTED
  APPROVED
  REJECTED
  EXPIRED
}

enum PaymentBatchStatus {
  PENDING
  QUEUED
  PROCESSING
  COMPLETED
  FAILED
  CANCELLED
}

enum DisbursementTransactionStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  CANCELLED
}

enum DisbursementProvider {
  RISE
  MOCK
}

enum AuditLogStatus {
  SUCCESS
  FAILURE
  WARNING
  INFO
}

model AffiliateRiseAccount {
  id                   String   @id @default(cuid())

  // Link to existing Part 17 AffiliateProfile
  affiliateProfileId   String   @unique
  affiliateProfile     AffiliateProfile @relation(fields: [affiliateProfileId], references: [id], onDelete: Cascade)

  // RiseWorks Account Info
  riseId               String   @unique  // Blockchain address (e.g., 0xA35b2F326F07...)
  email                String             // Email used for RiseWorks invite

  // KYC Status
  kycStatus            RiseWorksKycStatus @default(PENDING)
  kycCompletedAt       DateTime?

  // Invitation Tracking
  invitationSentAt     DateTime?
  invitationAcceptedAt DateTime?

  // Sync Status
  lastSyncAt           DateTime?
  metadata             Json?

  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  // Relationships
  disbursementTransactions DisbursementTransaction[]

  @@index([affiliateProfileId])
  @@index([riseId])
  @@index([kycStatus])
}

model PaymentBatch {
  id              String   @id @default(cuid())

  // Batch Identification
  batchNumber     String   @unique  // Human-readable (e.g., BATCH-2025-001)

  // Batch Summary
  paymentCount    Int      @default(0)
  totalAmount     Decimal  @default(0)
  currency        String   @default("USD")

  // Provider
  provider        DisbursementProvider

  // Status
  status          PaymentBatchStatus @default(PENDING)

  // Timestamps
  scheduledAt     DateTime?
  executedAt      DateTime?
  completedAt     DateTime?
  failedAt        DateTime?

  // Error Handling
  errorMessage    String?
  metadata        Json?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relationships
  transactions    DisbursementTransaction[]
  auditLogs       DisbursementAuditLog[]

  @@index([status])
  @@index([scheduledAt])
  @@index([provider])
  @@index([batchNumber])
}

model DisbursementTransaction {
  id                String   @id @default(cuid())

  // Batch Reference
  batchId           String
  batch             PaymentBatch @relation(fields: [batchId], references: [id])

  // Commission Reference (from Part 17)
  commissionId      String
  commission        Commission @relation(fields: [commissionId], references: [id])

  // Transaction IDs
  transactionId     String   @unique  // Internal ID
  providerTxId      String?           // RiseWorks transaction ID

  // Provider
  provider          DisbursementProvider

  // Payee Info
  affiliateRiseAccountId String?
  affiliateRiseAccount   AffiliateRiseAccount? @relation(fields: [affiliateRiseAccountId], references: [id])
  payeeRiseId       String?           // RiseID of recipient

  // Amount
  amount            Decimal
  amountRiseUnits   BigInt?           // Amount in 1e6 units for RiseWorks
  currency          String   @default("USD")

  // Status
  status            DisbursementTransactionStatus @default(PENDING)

  // Retry Logic
  retryCount        Int      @default(0)
  lastRetryAt       DateTime?

  // Error Handling
  errorMessage      String?
  metadata          Json?

  // Timestamps
  createdAt         DateTime @default(now())
  completedAt       DateTime?
  failedAt          DateTime?

  // Relationships
  webhookEvents     RiseWorksWebhookEvent[]
  auditLogs         DisbursementAuditLog[]

  @@index([batchId])
  @@index([commissionId])
  @@index([status])
  @@index([providerTxId])
  @@index([createdAt])
}

model RiseWorksWebhookEvent {
  id              String   @id @default(cuid())

  // Transaction Reference (optional - some webhooks aren't transaction-specific)
  transactionId   String?
  transaction     DisbursementTransaction? @relation(fields: [transactionId], references: [id])

  // Event Info
  eventType       String   // e.g., "payment.completed", "invite.accepted"
  provider        DisbursementProvider

  // Payload
  payload         Json

  // Verification
  signature       String?  // x-rise-signature header
  hash            String?  // x-rise-hash header
  verified        Boolean  @default(false)

  // Processing Status
  processed       Boolean  @default(false)
  processedAt     DateTime?
  errorMessage    String?

  receivedAt      DateTime @default(now())

  @@index([transactionId])
  @@index([eventType])
  @@index([processed])
  @@index([receivedAt])
}

model DisbursementAuditLog {
  id              String   @id @default(cuid())

  // References
  transactionId   String?
  transaction     DisbursementTransaction? @relation(fields: [transactionId], references: [id])
  batchId         String?
  batch           PaymentBatch? @relation(fields: [batchId], references: [id])

  // Action Info
  action          String   // e.g., "batch.created", "payment.executed"
  actor           String?  // User ID who performed action

  // Status
  status          AuditLogStatus

  // Details
  details         Json?
  ipAddress       String?
  userAgent       String?

  createdAt       DateTime @default(now())

  @@index([transactionId])
  @@index([batchId])
  @@index([action])
  @@index([createdAt])
}
```

**IMPORTANT: Add relation to existing Part 17 models:**

In `AffiliateProfile` model, add:

```prisma
  // Add to existing AffiliateProfile model (Part 17)
  riseAccount          AffiliateRiseAccount?
```

In `Commission` model, add:

```prisma
  // Add to existing Commission model (Part 17)
  disbursementTransaction DisbursementTransaction?
```

**Run migration:**

```bash
npx prisma migrate dev --name add-riseworks-disbursement
```

#### Step 2: Types & Constants (RED → GREEN → REFACTOR)

**RED: Write Test First**

**File: `__tests__/types/disbursement.test.ts`**

```typescript
import {
  DisbursementProvider,
  PaymentBatchStatus,
  DisbursementTransactionStatus,
  PaymentRequest,
  BatchPaymentRequest,
} from '@/types/disbursement';

describe('Disbursement Types', () => {
  it('should have correct provider types', () => {
    const providers: DisbursementProvider[] = ['RISE', 'MOCK'];
    expect(providers).toHaveLength(2);
  });

  it('should have correct batch status types', () => {
    const statuses: PaymentBatchStatus[] = [
      'PENDING',
      'QUEUED',
      'PROCESSING',
      'COMPLETED',
      'FAILED',
      'CANCELLED',
    ];
    expect(statuses).toHaveLength(6);
  });

  it('should have correct transaction status types', () => {
    const statuses: DisbursementTransactionStatus[] = [
      'PENDING',
      'PROCESSING',
      'COMPLETED',
      'FAILED',
      'CANCELLED',
    ];
    expect(statuses).toHaveLength(5);
  });

  it('should create valid payment request', () => {
    const request: PaymentRequest = {
      affiliateId: 'aff-123',
      riseId: '0xA35b2F326F07a7C92BedB0D318C237F30948E425',
      amount: 50.0,
      currency: 'USD',
      commissionId: 'comm-123',
    };
    expect(request.amount).toBe(50.0);
    expect(request.currency).toBe('USD');
  });
});
```

**Run test:** `npm test -- disbursement.test.ts` → ❌ FAILS (types don't exist)

**GREEN: Write Minimal Code**

**File: `types/disbursement.ts`**

```typescript
// Provider Types
export type DisbursementProvider = 'RISE' | 'MOCK';

// Status Types
export type PaymentBatchStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type DisbursementTransactionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type RiseWorksKycStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED';

export type AuditLogStatus = 'SUCCESS' | 'FAILURE' | 'WARNING' | 'INFO';

// Request/Response Types
export interface PaymentRequest {
  affiliateId: string;
  riseId: string;
  amount: number; // USD amount
  currency: string;
  commissionId: string;
  metadata?: Record<string, unknown>;
}

export interface BatchPaymentRequest {
  batchId: string;
  payments: PaymentRequest[];
  scheduledAt?: Date;
}

export interface PaymentResult {
  success: boolean;
  transactionId: string;
  providerTxId?: string;
  status: DisbursementTransactionStatus;
  amount: number;
  error?: string;
}

export interface BatchPaymentResult {
  success: boolean;
  batchId: string;
  totalAmount: number;
  successCount: number;
  failedCount: number;
  results: PaymentResult[];
}

export interface AuthToken {
  token: string;
  expiresAt: Date;
}

export interface PayeeInfo {
  riseId: string;
  email: string;
  kycStatus: RiseWorksKycStatus;
  canReceivePayments: boolean;
}

export interface WebhookEvent {
  event: string;
  data: Record<string, unknown>;
  timestamp: Date;
}

export interface PayableAffiliate {
  id: string;
  fullName: string;
  email: string;
  country: string;
  pendingAmount: number;
  paidAmount: number;
  pendingCommissionCount: number;
  oldestPendingDate: Date | null;
  readyForPayout: boolean;
  riseAccount: {
    hasAccount: boolean;
    riseId?: string;
    kycStatus: RiseWorksKycStatus | 'none';
    canReceivePayments: boolean;
  };
}

export interface DisbursementConfig {
  provider: DisbursementProvider;
  enabled: boolean;
  minimumPayout: number;
  batchSize: number;
  schedule: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    time: string;
    timezone: string;
  };
  retryPolicy: {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
  };
}
```

**Run test:** `npm test` → ✅ PASSES

**REFACTOR: Add Constants**

**File: `lib/disbursement/constants.ts`**

```typescript
import { DisbursementProvider } from '@/types/disbursement';

// Minimum payout threshold in USD
export const MINIMUM_PAYOUT_USD = 50.0;

// Maximum payments per batch (RiseWorks API limit)
export const MAX_BATCH_SIZE = 100;

// RiseWorks amount conversion factor (1e6 for USDC)
export const RISE_AMOUNT_FACTOR = 1_000_000;

// Default currency
export const DEFAULT_CURRENCY = 'USD';

// Supported providers
export const SUPPORTED_PROVIDERS: DisbursementProvider[] = ['RISE', 'MOCK'];

// Default provider (based on environment)
export function getDefaultProvider(): DisbursementProvider {
  return process.env.DISBURSEMENT_PROVIDER === 'RISE' ? 'RISE' : 'MOCK';
}

// RiseWorks API URLs
export const RISE_API_URLS = {
  production: 'https://b2b-api.riseworks.io/v1',
  staging: 'https://b2b-api.staging-riseworks.io/v1',
} as const;

// Webhook event types
export const WEBHOOK_EVENT_TYPES = {
  INVITE_ACCEPTED: 'invite.accepted',
  FUND_RECEIVED: 'fund.received',
  PAYMENT_INITIATED: 'payment.initiated',
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
  ACCOUNT_DUPLICATION: 'account.duplication_detected',
} as const;

// Retry configuration
export const DEFAULT_RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
} as const;

// Helper functions
export function usdToRiseUnits(usdAmount: number): bigint {
  return BigInt(Math.round(usdAmount * RISE_AMOUNT_FACTOR));
}

export function riseUnitsToUsd(riseUnits: bigint): number {
  return Number(riseUnits) / RISE_AMOUNT_FACTOR;
}

export function isValidProvider(
  provider: string
): provider is DisbursementProvider {
  return SUPPORTED_PROVIDERS.includes(provider as DisbursementProvider);
}

export function generateBatchNumber(): string {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString(36).toUpperCase();
  return `BATCH-${year}-${timestamp}`;
}

export function generateTransactionId(): string {
  return `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}
```

**Test Constants:**

**File: `__tests__/lib/disbursement/constants.test.ts`**

```typescript
import {
  MINIMUM_PAYOUT_USD,
  MAX_BATCH_SIZE,
  RISE_AMOUNT_FACTOR,
  usdToRiseUnits,
  riseUnitsToUsd,
  isValidProvider,
  generateBatchNumber,
  generateTransactionId,
} from '@/lib/disbursement/constants';

describe('Disbursement Constants', () => {
  it('should have correct minimum payout', () => {
    expect(MINIMUM_PAYOUT_USD).toBe(50.0);
  });

  it('should have correct max batch size', () => {
    expect(MAX_BATCH_SIZE).toBe(100);
  });

  it('should convert USD to Rise units correctly', () => {
    expect(usdToRiseUnits(50.0)).toBe(50_000_000n);
    expect(usdToRiseUnits(100.5)).toBe(100_500_000n);
    expect(usdToRiseUnits(0.01)).toBe(10_000n);
  });

  it('should convert Rise units to USD correctly', () => {
    expect(riseUnitsToUsd(50_000_000n)).toBe(50.0);
    expect(riseUnitsToUsd(100_500_000n)).toBe(100.5);
  });

  it('should validate providers', () => {
    expect(isValidProvider('RISE')).toBe(true);
    expect(isValidProvider('MOCK')).toBe(true);
    expect(isValidProvider('INVALID')).toBe(false);
  });

  it('should generate unique batch numbers', () => {
    const batch1 = generateBatchNumber();
    const batch2 = generateBatchNumber();
    expect(batch1).toMatch(/^BATCH-\d{4}-[A-Z0-9]+$/);
    expect(batch1).not.toBe(batch2);
  });

  it('should generate unique transaction IDs', () => {
    const txn1 = generateTransactionId();
    const txn2 = generateTransactionId();
    expect(txn1).toMatch(/^TXN-\d+-[A-Z0-9]+$/);
    expect(txn1).not.toBe(txn2);
  });
});
```

**Run test:** `npm test` → ✅ PASSES

**Commit:**

```bash
git add prisma/schema.prisma types/disbursement.ts lib/disbursement/constants.ts __tests__
git commit -m "feat(disbursement): add database schema, types, and constants with tests"
```

---

### Phase B: Provider Abstraction (TDD)

#### Provider Interface (RED → GREEN → REFACTOR)

**RED: Write Test First**

**File: `__tests__/lib/disbursement/providers/mock.test.ts`**

```typescript
import { MockPaymentProvider } from '@/lib/disbursement/providers/mock-provider';
import { PaymentRequest } from '@/types/disbursement';

describe('MockPaymentProvider', () => {
  let provider: MockPaymentProvider;

  beforeEach(() => {
    provider = new MockPaymentProvider();
  });

  it('should authenticate successfully', async () => {
    const token = await provider.authenticate();
    expect(token.token).toBeDefined();
    expect(token.expiresAt).toBeInstanceOf(Date);
  });

  it('should send single payment successfully', async () => {
    const request: PaymentRequest = {
      affiliateId: 'aff-123',
      riseId: '0xA35b2F326F07a7C92BedB0D318C237F30948E425',
      amount: 50.0,
      currency: 'USD',
      commissionId: 'comm-123',
    };

    const result = await provider.sendPayment(request);

    expect(result.success).toBe(true);
    expect(result.transactionId).toBeDefined();
    expect(result.amount).toBe(50.0);
    expect(result.status).toBe('COMPLETED');
  });

  it('should send batch payment successfully', async () => {
    const requests: PaymentRequest[] = [
      {
        affiliateId: 'aff-123',
        riseId: '0xA35b...',
        amount: 50.0,
        currency: 'USD',
        commissionId: 'comm-123',
      },
      {
        affiliateId: 'aff-456',
        riseId: '0xB46c...',
        amount: 75.0,
        currency: 'USD',
        commissionId: 'comm-456',
      },
    ];

    const result = await provider.sendBatchPayment(requests);

    expect(result.success).toBe(true);
    expect(result.totalAmount).toBe(125.0);
    expect(result.successCount).toBe(2);
    expect(result.failedCount).toBe(0);
    expect(result.results).toHaveLength(2);
  });

  it('should get payment status', async () => {
    // First send a payment
    const request: PaymentRequest = {
      affiliateId: 'aff-123',
      riseId: '0xA35b...',
      amount: 50.0,
      currency: 'USD',
      commissionId: 'comm-123',
    };
    const paymentResult = await provider.sendPayment(request);

    // Then check status
    const status = await provider.getPaymentStatus(paymentResult.transactionId);
    expect(status).toBe('COMPLETED');
  });

  it('should verify webhook signature', () => {
    const payload = JSON.stringify({ event: 'payment.completed' });
    const signature = 'mock-signature';

    // Mock provider always returns true for verification
    const isValid = provider.verifyWebhook(payload, signature);
    expect(isValid).toBe(true);
  });

  it('should simulate failure when configured', async () => {
    const failingProvider = new MockPaymentProvider({ failureRate: 1.0 });

    const request: PaymentRequest = {
      affiliateId: 'aff-123',
      riseId: '0xA35b...',
      amount: 50.0,
      currency: 'USD',
      commissionId: 'comm-123',
    };

    const result = await failingProvider.sendPayment(request);
    expect(result.success).toBe(false);
    expect(result.status).toBe('FAILED');
    expect(result.error).toBeDefined();
  });
});
```

**Run test:** `npm test -- mock.test.ts` → ❌ FAILS

**GREEN: Write Minimal Code**

**File: `lib/disbursement/providers/base-provider.ts`**

```typescript
import {
  AuthToken,
  PaymentRequest,
  PaymentResult,
  BatchPaymentResult,
  DisbursementTransactionStatus,
  PayeeInfo,
} from '@/types/disbursement';

export abstract class PaymentProvider {
  abstract readonly name: string;

  abstract authenticate(): Promise<AuthToken>;

  abstract sendPayment(request: PaymentRequest): Promise<PaymentResult>;

  abstract sendBatchPayment(
    requests: PaymentRequest[]
  ): Promise<BatchPaymentResult>;

  abstract getPaymentStatus(
    transactionId: string
  ): Promise<DisbursementTransactionStatus>;

  abstract getPayeeInfo(riseId: string): Promise<PayeeInfo>;

  abstract verifyWebhook(payload: string, signature: string): boolean;
}

export class PaymentProviderError extends Error {
  constructor(
    message: string,
    public code: string,
    public provider: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'PaymentProviderError';
  }
}
```

**File: `lib/disbursement/providers/mock-provider.ts`**

```typescript
import { PaymentProvider, PaymentProviderError } from './base-provider';
import {
  AuthToken,
  PaymentRequest,
  PaymentResult,
  BatchPaymentResult,
  DisbursementTransactionStatus,
  PayeeInfo,
  RiseWorksKycStatus,
} from '@/types/disbursement';
import { generateTransactionId } from '../constants';

export interface MockProviderConfig {
  failureRate?: number; // 0.0 to 1.0
  delay?: number; // milliseconds
}

export class MockPaymentProvider extends PaymentProvider {
  readonly name = 'MOCK';
  private config: MockProviderConfig;
  private transactions: Map<string, DisbursementTransactionStatus>;

  constructor(config: MockProviderConfig = {}) {
    super();
    this.config = {
      failureRate: config.failureRate ?? 0.0,
      delay: config.delay ?? 100,
    };
    this.transactions = new Map();
  }

  private async simulateDelay(): Promise<void> {
    if (this.config.delay && this.config.delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.config.delay));
    }
  }

  private shouldFail(): boolean {
    return Math.random() < (this.config.failureRate ?? 0);
  }

  async authenticate(): Promise<AuthToken> {
    await this.simulateDelay();
    return {
      token: `mock-token-${Date.now()}`,
      expiresAt: new Date(Date.now() + 3600000), // 1 hour
    };
  }

  async sendPayment(request: PaymentRequest): Promise<PaymentResult> {
    await this.simulateDelay();

    const transactionId = generateTransactionId();

    if (this.shouldFail()) {
      this.transactions.set(transactionId, 'FAILED');
      return {
        success: false,
        transactionId,
        status: 'FAILED',
        amount: request.amount,
        error: 'Simulated payment failure',
      };
    }

    this.transactions.set(transactionId, 'COMPLETED');

    return {
      success: true,
      transactionId,
      providerTxId: `mock-provider-${transactionId}`,
      status: 'COMPLETED',
      amount: request.amount,
    };
  }

  async sendBatchPayment(
    requests: PaymentRequest[]
  ): Promise<BatchPaymentResult> {
    await this.simulateDelay();

    const results: PaymentResult[] = [];
    let totalAmount = 0;
    let successCount = 0;
    let failedCount = 0;

    for (const request of requests) {
      const result = await this.sendPayment(request);
      results.push(result);
      totalAmount += request.amount;

      if (result.success) {
        successCount++;
      } else {
        failedCount++;
      }
    }

    return {
      success: failedCount === 0,
      batchId: `mock-batch-${Date.now()}`,
      totalAmount,
      successCount,
      failedCount,
      results,
    };
  }

  async getPaymentStatus(
    transactionId: string
  ): Promise<DisbursementTransactionStatus> {
    await this.simulateDelay();
    return this.transactions.get(transactionId) ?? 'PENDING';
  }

  async getPayeeInfo(riseId: string): Promise<PayeeInfo> {
    await this.simulateDelay();
    return {
      riseId,
      email: 'mock@example.com',
      kycStatus: 'APPROVED' as RiseWorksKycStatus,
      canReceivePayments: true,
    };
  }

  verifyWebhook(payload: string, signature: string): boolean {
    // Mock provider always accepts webhooks
    return true;
  }
}
```

**Run test:** `npm test` → ✅ PASSES

**Commit:**

```bash
git add lib/disbursement/providers/
git commit -m "feat(disbursement): add provider abstraction with mock implementation"
```

---

## Environment Variables

Add these to `.env.local`:

```env
# Disbursement Provider ('MOCK' for development, 'RISE' for production)
DISBURSEMENT_PROVIDER=MOCK

# RiseWorks Configuration (only needed for RISE provider)
RISE_ENVIRONMENT=staging
RISE_API_BASE_URL=https://b2b-api.staging-riseworks.io/v1
RISE_WALLET_ADDRESS=0x...
RISE_WALLET_PRIVATE_KEY=0x...
RISE_TEAM_ID=your-team-id
RISE_WEBHOOK_SECRET=your-webhook-secret

# Disbursement Settings
MINIMUM_PAYOUT_USD=50
MAX_BATCH_SIZE=100
```

---

## Reference Documents

This prompt was created using:

1. **PROGRESS-part-2.md** - Foundation setup and database configuration
2. **ARCHITECTURE-compress.md** - Overall system architecture
3. **docs/policies/05-coding-patterns-part-1.md** - Coding standards and patterns
4. **docs/policies/05-coding-patterns-part-2.md** - Additional patterns including crypto code generation
5. **riseworks/riseworks-disbursement-architecture-design.md** - Complete architecture for Part 19 (use as reference design only)
6. **riseworks/riseworks-implementation-plan.md** - Detailed implementation phases (use as reference patterns only)
7. **riseworks/riseworks-api-overview-for-disbursement-integration.md** - RiseWorks API details
8. **riseworks/riseworks-openapi-endpoints.yaml** - OpenAPI specification
9. **riseworks/IMPLEMENTATION-SUMMARY.md** - Implementation progress summary

---

## Testing Strategy

### Test Coverage Targets

| Component             | Target Coverage |
| --------------------- | --------------- |
| Commission Aggregator | 95%             |
| Payment Providers     | 95%             |
| Payment Orchestrator  | 90%             |
| Webhook Handlers      | 90%             |
| API Routes            | 85%             |
| **Overall Target**    | **25%**         |

### Test Types

#### Unit Tests

- Commission calculation logic
- Provider implementations
- Amount conversion
- Validation logic

#### Integration Tests

- Payment flow end-to-end
- Webhook processing
- Database operations
- Provider switching

---

## Success Metrics

### Technical Metrics

- ✅ 25%+ test coverage
- ✅ Type hints on all functions
- ✅ No 'any' types
- ✅ Comprehensive logging
- ✅ Zero hardcoded credentials
- ✅ Provider abstraction working

### Business Metrics (Post-Deployment)

- Payment success rate > 99%
- Average payment time < 30 seconds
- Batch processing capacity: 100 payments
- Commission calculation accuracy: 100%

---

## Commit Strategy

After each phase, commit with descriptive message:

```bash
git add .
git commit -m "feat(disbursement): [phase] - [description]"
```

Examples:

- `feat(disbursement): phase-a - add database schema and types`
- `feat(disbursement): phase-b - add provider abstraction`
- `feat(disbursement): phase-c - add riseworks integration`
- `test(disbursement): add unit tests for commission aggregator`

---

**🎉 Part 19 Implementation Ready!**

Follow the TDD pattern: RED (failing test) → GREEN (minimal code) → REFACTOR (clean up)

Trust the process. Test first. Build confidence in payment operations.

---

**Last Updated:** 2025-12-21
**Version:** 1.0.0
**Framework:** Next.js 15 + TypeScript + Prisma
**Test Framework:** Jest
