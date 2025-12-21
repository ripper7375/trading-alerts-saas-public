# Rise Payment Integration Stack - Architecture Design Document

**Project**: Trading Alerts SaaS V7  
**Component**: Automated Affiliate Commission Payment System  
**Integration**: Rise.works Payment API  
**Version**: 1.0.0  
**Date**: November 2025  
**Document Type**: Architecture Design (What Is)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Dependencies (Required Parts)](#dependencies-required-parts)
3. [System Context](#system-context)
4. [Architecture Overview](#architecture-overview)
5. [Component Architecture](#component-architecture)
6. [Data Architecture](#data-architecture)
   - [Entity Relationship Diagram](#entity-relationship-diagram)
   - [Table Specifications (SQL)](#table-specifications)
   - [Prisma Schema (Part 19)](#prisma-schema-part-19---add-to-schemaprisma)
7. [Integration Architecture](#integration-architecture)
8. [Security Architecture](#security-architecture)
9. [Configuration Architecture](#configuration-architecture)
10. [Testing Architecture](#testing-architecture)
11. [Deployment Architecture](#deployment-architecture)
12. [Monitoring & Observability](#monitoring--observability)
13. [Future Considerations](#future-considerations)

---

## Executive Summary

### Purpose

This document defines the architecture for integrating Rise.works payment infrastructure into Trading Alerts SaaS V7 to enable automated global affiliate commission payments. The architecture supports phased deployment: mock mode during MVP stage, seamless transition to live payments post-approval.

### Key Architectural Principles

1. **Abstraction**: Payment provider agnostic design enabling multiple payment backends
2. **Modularity**: Loosely coupled components with clear interfaces
3. **Configuration-Driven**: Environment-based provider switching without code changes
4. **Fail-Safe**: Graceful degradation when payment services unavailable
5. **Auditability**: Complete transaction trail for compliance and debugging
6. **Testability**: Mock implementations for comprehensive testing without external dependencies

### Design Goals

- Zero downtime transition from mock to live payments
- Support for 190+ countries and multiple currencies
- Automated commission calculation and disbursement
- Comprehensive audit trail for financial compliance
- Extensible to support multiple payment providers
- Integration with existing V7 authentication and authorization

---

## Dependencies (Required Parts)

Part 19 (RiseWorks Disbursement) depends on the following parts that must be implemented first:

### Direct Dependencies

| Part | Name | What Part 19 Needs |
|------|------|-------------------|
| **Part 2** | Database | PostgreSQL + Prisma ORM infrastructure |
| **Part 5** | Authentication | `requireAdmin()` for API authorization, JWT tokens |
| **Part 17** | Affiliate Marketing | `AffiliateProfile`, `Commission` models with pending amounts |

### Indirect Dependencies (Connected via Part 17)

| Part | Name | Connection |
|------|------|-----------|
| **Part 1** | User | `User.email` via `AffiliateProfile.userId` for affiliate contact info |
| **Part 3** | Subscriptions | `Subscription.affiliateCodeId` triggers commission creation |
| **Part 18** | Payments (Stripe/dLocal) | `Payment.discountCode` creates commission records |

### Dependency Diagram

```
                         ┌─────────────────┐
                         │    PART 19      │
                         │   RiseWorks     │
                         │  Disbursement   │
                         └────────┬────────┘
                                  │
           ┌──────────────────────┼──────────────────────┐
           │                      │                      │
           ▼                      ▼                      ▼
   ┌───────────────┐     ┌───────────────┐     ┌───────────────┐
   │    PART 2     │     │    PART 5     │     │    PART 17    │
   │   Database    │     │Authentication │     │   Affiliate   │
   │    (Prisma)   │     │   (Admin)     │     │   Marketing   │
   └───────────────┘     └───────────────┘     └───────┬───────┘
                                                       │
                                  ┌────────────────────┼────────────────────┐
                                  │                    │                    │
                                  ▼                    ▼                    ▼
                          ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
                          │    PART 3     │   │   PART 18     │   │    PART 1     │
                          │ Subscriptions │   │   Payments    │   │     User      │
                          │               │   │ Stripe/dLocal │   │   (email)     │
                          └───────────────┘   └───────────────┘   └───────────────┘
```

### Existing Models Used (from Part 17)

Part 19 reads from these existing Prisma models (DO NOT recreate):

- `AffiliateProfile` - Affiliate info, pending/paid commissions
- `Commission` - Individual commission records with status
- `User` - Email addresses for affiliates

### New Models Added (Part 19 only)

Part 19 adds these NEW models to the Prisma schema:

- `AffiliateRiseAccount` - RiseID mapping for each affiliate
- `PaymentBatch` - Batch payment tracking
- `DisbursementTransaction` - Individual payment transactions
- `RiseWorksWebhookEvent` - Webhook event storage
- `DisbursementAuditLog` - Compliance audit trail

---

## System Context

### Existing V7 Architecture Components

```
Trading Alerts SaaS V7
├── Frontend: Next.js 15 (TypeScript)
├── Backend: Flask (Python)
├── Database: PostgreSQL (Railway)
├── MT5 Service: Flask + MetaTrader 5
├── Authentication: JWT-based
└── Deployment: Docker + Railway + GitHub Actions
```

### Rise Payment Integration Position

The Rise payment stack integrates at the **backend service layer**, sitting between the core application logic and external payment infrastructure.

```mermaid
graph TB
    subgraph "Frontend Layer"
        A[Next.js Dashboard]
        B[Admin Panel]
    end

    subgraph "Backend Layer"
        C[Flask API Server]
        D[Commission Service]
        E[Payment Service]
        F[Webhook Handler]
    end

    subgraph "Data Layer"
        G[(PostgreSQL)]
    end

    subgraph "External Services"
        H[Rise API]
        I[Mock Payment Service]
    end

    A --> C
    B --> C
    C --> D
    D --> E
    E --> G
    E --> H
    E --> I
    H --> F
    F --> G

    style E fill:#f9f,stroke:#333
    style H fill:#bbf,stroke:#333
    style I fill:#bfb,stroke:#333
```

### Integration Boundaries

**Internal Dependencies:**

- User authentication system
- Subscription management
- Affiliate tracking system
- Admin dashboard

**External Dependencies:**

- Rise.works REST API
- Ethereum wallet (for API authentication)
- Webhook endpoints (for payment status)

---

## Architecture Overview

### High-Level Architecture

```mermaid
graph LR
    subgraph "Application Core"
        A[User Management]
        B[Subscription Service]
        C[Affiliate Tracking]
    end

    subgraph "Payment Stack"
        D[Commission Calculator]
        E[Payment Orchestrator]
        F[Provider Abstraction]
        G[Rise Client]
        H[Mock Client]
    end

    subgraph "Data Persistence"
        I[(Commissions DB)]
        J[(Payment History)]
        K[(Audit Logs)]
    end

    subgraph "External"
        L[Rise API]
        M[Webhooks]
    end

    A --> C
    B --> D
    C --> D
    D --> E
    E --> F
    F --> G
    F --> H
    G --> L
    L --> M
    M --> E
    E --> I
    E --> J
    E --> K

    style F fill:#f9f,stroke:#333
```

### Architectural Layers

#### 1. **Presentation Layer** (Existing V7)

- Admin dashboard for commission management
- Affiliate portal for payment history
- Payment status monitoring interfaces

#### 2. **Application Layer** (New Payment Stack)

- Commission calculation engine
- Payment orchestration service
- Batch payment scheduler
- Webhook event processor

#### 3. **Integration Layer** (Provider Abstraction)

- Abstract payment interface
- Rise API client implementation
- Mock payment provider
- Provider factory and configuration

#### 4. **Data Layer** (Extended V7 Schema)

- Affiliate management tables
- Commission tracking tables
- Payment history tables
- Audit and reconciliation tables

---

## Component Architecture

### Component Diagram

```mermaid
graph TB
    subgraph "Commission Service"
        A[Commission Calculator]
        B[Commission Aggregator]
        C[Commission Validator]
    end

    subgraph "Payment Service"
        D[Payment Orchestrator]
        E[Batch Payment Manager]
        F[Payment Scheduler]
        G[Transaction Logger]
    end

    subgraph "Provider Layer"
        H[Payment Provider Interface]
        I[Rise Payment Client]
        J[Mock Payment Client]
        K[Provider Factory]
    end

    subgraph "Webhook Service"
        L[Webhook Receiver]
        M[Event Validator]
        N[Event Processor]
    end

    subgraph "Notification Service"
        O[Email Notifier]
        P[Admin Alerter]
    end

    A --> B
    B --> C
    C --> D
    D --> E
    D --> F
    D --> K
    K --> I
    K --> J
    I --> L
    L --> M
    M --> N
    N --> D
    D --> G
    D --> O
    D --> P

    style H fill:#f9f,stroke:#333
    style K fill:#f9f,stroke:#333
```

### Core Components

#### 1. **Commission Calculator**

**Purpose**: Calculate affiliate commissions based on subscription events

**Responsibilities:**

- Apply commission rates based on affiliate tier
- Handle different subscription types (FREE → PRO conversions)
- Calculate recurring vs one-time commissions
- Apply minimum payout thresholds
- Handle commission adjustments (refunds, chargebacks)

**Inputs:**

- Subscription events (new, upgrade, renewal, cancellation)
- Affiliate configuration (rates, tiers)
- Payment history (for recurring calculations)

**Outputs:**

- Commission records with amounts
- Aggregated commission totals
- Commission eligibility status

**State:**

- Stateless service
- All state in database

#### 2. **Payment Orchestrator**

**Purpose**: Coordinate payment execution across providers

**Responsibilities:**

- Determine when to execute payments
- Select appropriate payment provider
- Handle payment lifecycle (initiate → confirm → complete)
- Manage payment retries on failure
- Coordinate with notification service
- Maintain transaction audit trail

**Inputs:**

- Approved commission records
- Payment schedule configuration
- Provider availability status

**Outputs:**

- Payment execution results
- Transaction records
- Status notifications

**State:**

- Tracks in-flight payments
- Maintains retry counters
- Stores provider selection logic

#### 3. **Payment Provider Interface**

**Purpose**: Abstract payment provider implementations

**Contract:**

```python
class PaymentProvider(ABC):
    @abstractmethod
    async def authenticate() -> AuthToken

    @abstractmethod
    async def send_payment(
        payee_id: str,
        amount: Decimal,
        currency: str,
        metadata: dict
    ) -> PaymentResult

    @abstractmethod
    async def send_batch_payment(
        payments: List[Payment]
    ) -> BatchPaymentResult

    @abstractmethod
    async def get_payment_status(
        transaction_id: str
    ) -> PaymentStatus

    @abstractmethod
    async def get_payee_info(
        payee_id: str
    ) -> PayeeInfo

    @abstractmethod
    async def handle_webhook(
        event: WebhookEvent
    ) -> WebhookResponse
```

**Implementations:**

- `RisePaymentClient`: Production Rise.works integration
- `MockPaymentClient`: Testing and development
- `Future`: Stripe, PayPal, Wise (extensibility)

#### 4. **Rise Payment Client**

**Purpose**: Implement Rise.works API integration

**Responsibilities:**

- Authenticate with Rise API using wallet signatures
- Execute individual payments via `/payments/pay` endpoint
- Execute batch payments via `/payments/batch-pay` endpoint
- Handle Rise-specific payment flow (typedData signing)
- Process Rise webhook events
- Manage Rise API rate limiting
- Handle Rise-specific error codes

**Configuration:**

- API base URL (staging/production)
- Wallet private key (for signing)
- RiseID (company account identifier)
- API timeout settings
- Retry policies

**Dependencies:**

- Ethereum wallet library (ethers.js/web3.py)
- HTTP client with retry logic
- Signature generation utilities

#### 5. **Mock Payment Client**

**Purpose**: Simulate payment operations for testing

**Responsibilities:**

- Simulate successful payments
- Simulate various failure scenarios
- Generate realistic transaction IDs
- Simulate network latency
- Provide controllable test scenarios

**Features:**

- Configurable success/failure rates
- Delayed payment confirmations
- Webhook simulation
- No external dependencies

#### 6. **Batch Payment Manager**

**Purpose**: Optimize payment execution through batching

**Responsibilities:**

- Aggregate payments by schedule (daily/weekly/monthly)
- Group payments by currency
- Apply batch size limits (Rise API constraints)
- Split large batches into multiple transactions
- Track batch execution status

**Logic:**

```
Batching Rules:
- Maximum batch size: 100 payments (Rise limit)
- Group by: currency, payment date
- Execute: scheduled time windows
- Retry: failed batches with exponential backoff
```

#### 7. **Payment Scheduler**

**Purpose**: Manage payment execution timing

**Responsibilities:**

- Maintain payment schedule configuration
- Queue payments for execution
- Trigger batch payment execution
- Handle time zone considerations
- Manage payment windows (business hours)

**Schedules:**

- Daily: Execute at configured time
- Weekly: Execute on specific day/time
- Monthly: Execute on specific date
- On-demand: Admin-triggered payments

**Implementation:**

- Background task queue (Celery/APScheduler)
- Cron-style scheduling
- Job persistence for reliability

#### 8. **Webhook Receiver**

**Purpose**: Process payment status updates from Rise

**Responsibilities:**

- Receive POST requests from Rise API
- Validate webhook signatures (x-rise-signature header)
- Verify webhook hash (x-rise-hash header)
- Parse webhook payload
- Route events to event processor
- Respond to Rise with acknowledgment

**Security:**

- Signature verification using Rise public key
- Hash validation of payload
- Replay attack prevention (timestamp checks)
- IP whitelist (optional)

**Event Types:**

```
- deposit.deposit_received: Funds received in Rise account
- payment.initiated: Payment started
- payment.completed: Payment successful
- payment.failed: Payment failed
- batch.completed: Batch payment finished
```

#### 9. **Transaction Logger**

**Purpose**: Maintain comprehensive audit trail

**Responsibilities:**

- Log all payment operations
- Record API requests/responses
- Track state transitions
- Capture error conditions
- Support compliance reporting

**Log Levels:**

- DEBUG: API calls, internal state
- INFO: Payment lifecycle events
- WARNING: Retry attempts, degraded service
- ERROR: Payment failures, API errors
- CRITICAL: System failures, security issues

---

## Data Architecture

### Entity Relationship Diagram

> **Note**: Models marked with `[Part 17]` already exist in `prisma/schema.prisma`.
> Part 19 only adds the models marked with `[Part 19 - NEW]`.

```mermaid
erDiagram
    %% EXISTING MODELS (Part 17 - DO NOT RECREATE)
    User ||--o| AffiliateProfile : "can be"
    AffiliateProfile ||--o{ Commission : "earns"
    AffiliateProfile ||--o{ AffiliateCode : "owns"
    User ||--o| Subscription : "has"
    AffiliateCode ||--o{ Commission : "generates"

    %% NEW MODELS (Part 19)
    AffiliateProfile ||--o| AffiliateRiseAccount : "has"
    Commission ||--o| DisbursementTransaction : "paid via"
    PaymentBatch ||--o{ DisbursementTransaction : "contains"
    AffiliateRiseAccount ||--o{ DisbursementTransaction : "receives"
    DisbursementTransaction ||--o{ RiseWorksWebhookEvent : "triggers"
    DisbursementTransaction ||--o{ DisbursementAuditLog : "logged in"
    PaymentBatch ||--o{ DisbursementAuditLog : "logged in"

    %% Part 17 - EXISTING (shown for reference)
    User {
        string id PK
        string email
        string name
        boolean isAffiliate
    }

    AffiliateProfile {
        string id PK
        string userId FK
        string fullName
        string country
        string paymentMethod
        json paymentDetails
        decimal pendingCommissions
        decimal paidCommissions
        enum status
    }

    AffiliateCode {
        string id PK
        string affiliateProfileId FK
        string code
        int discountPercent
        int commissionPercent
        enum status
    }

    Commission {
        string id PK
        string affiliateProfileId FK
        string affiliateCodeId FK
        string userId FK
        decimal grossRevenue
        decimal netRevenue
        decimal commissionAmount
        enum status
        datetime earnedAt
        datetime paidAt
    }

    Subscription {
        string id PK
        string userId FK
        string affiliateCodeId FK
        decimal amountUsd
        enum status
    }

    %% Part 19 - NEW MODELS
    AffiliateRiseAccount {
        string id PK
        string affiliateProfileId FK
        string riseId UK
        string email
        enum kycStatus
        datetime invitationSentAt
        datetime invitationAcceptedAt
    }

    PaymentBatch {
        string id PK
        string batchNumber UK
        int paymentCount
        decimal totalAmount
        string currency
        enum provider
        enum status
        datetime scheduledAt
        datetime executedAt
    }

    DisbursementTransaction {
        string id PK
        string batchId FK
        string commissionId FK
        string affiliateRiseAccountId FK
        string transactionId UK
        string providerTxId
        decimal amount
        enum status
        datetime createdAt
        datetime completedAt
    }

    RiseWorksWebhookEvent {
        string id PK
        string transactionId FK
        string eventType
        json payload
        string signature
        boolean verified
        boolean processed
    }

    DisbursementAuditLog {
        string id PK
        string transactionId FK
        string batchId FK
        string action
        string actor
        enum status
        json details
    }
```

### Table Specifications

> **⚠️ IMPORTANT**: The following SQL tables are shown for **reference only**.
> This project uses **Prisma ORM**. See the [Prisma Schema section](#prisma-schema-part-19---add-to-schemaprisma) below for the actual implementation.

#### Existing Tables (Part 17 - DO NOT CREATE)

The following tables **already exist** in Part 17. Part 19 only reads from them:

| Table Name | Prisma Model | Part 19 Usage |
|------------|--------------|---------------|
| `AffiliateProfile` | `AffiliateProfile` | Read affiliate info, pending commissions |
| `Commission` | `Commission` | Read pending commissions, update status to PAID |
| `User` | `User` | Read email addresses |

#### New Tables (Part 19 - CREATE THESE)

##### **affiliate_rise_accounts** (Maps affiliates to RiseWorks)

```sql
-- References existing AffiliateProfile from Part 17
CREATE TABLE affiliate_rise_accounts (
    id TEXT PRIMARY KEY,
    affiliate_profile_id TEXT UNIQUE NOT NULL REFERENCES "AffiliateProfile"(id) ON DELETE CASCADE,
    rise_id TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    kyc_status TEXT NOT NULL DEFAULT 'PENDING',
    kyc_completed_at TIMESTAMP,
    invitation_sent_at TIMESTAMP,
    invitation_accepted_at TIMESTAMP,
    last_sync_at TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_kyc_status CHECK (kyc_status IN ('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'EXPIRED'))
);

CREATE INDEX idx_rise_accounts_affiliate ON affiliate_rise_accounts(affiliate_profile_id);
CREATE INDEX idx_rise_accounts_rise_id ON affiliate_rise_accounts(rise_id);
CREATE INDEX idx_rise_accounts_kyc_status ON affiliate_rise_accounts(kyc_status);
```

##### **payment_batches**

```sql
CREATE TABLE payment_batches (
    id TEXT PRIMARY KEY,
    batch_number TEXT UNIQUE NOT NULL,
    payment_count INTEGER NOT NULL DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'USD',
    provider TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    scheduled_at TIMESTAMP,
    executed_at TIMESTAMP,
    completed_at TIMESTAMP,
    failed_at TIMESTAMP,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_provider CHECK (provider IN ('RISE', 'MOCK')),
    CONSTRAINT valid_status CHECK (status IN ('PENDING', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'))
);

CREATE INDEX idx_batches_status ON payment_batches(status);
CREATE INDEX idx_batches_scheduled ON payment_batches(scheduled_at);
CREATE INDEX idx_batches_provider ON payment_batches(provider);
```

##### **disbursement_transactions**

```sql
-- References existing Commission from Part 17
CREATE TABLE disbursement_transactions (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES payment_batches(id),
    commission_id TEXT NOT NULL REFERENCES "Commission"(id),
    affiliate_rise_account_id TEXT REFERENCES affiliate_rise_accounts(id),
    transaction_id TEXT UNIQUE NOT NULL,
    provider_tx_id TEXT,
    provider TEXT NOT NULL,
    payee_rise_id TEXT,
    amount DECIMAL(10,2) NOT NULL,
    amount_rise_units BIGINT,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'PENDING',
    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMP,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    failed_at TIMESTAMP,
    CONSTRAINT valid_provider CHECK (provider IN ('RISE', 'MOCK')),
    CONSTRAINT valid_status CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'))
);

CREATE INDEX idx_transactions_batch ON disbursement_transactions(batch_id);
CREATE INDEX idx_transactions_commission ON disbursement_transactions(commission_id);
CREATE INDEX idx_transactions_status ON disbursement_transactions(status);
CREATE INDEX idx_transactions_provider_tx ON disbursement_transactions(provider_tx_id);
```

##### **riseworks_webhook_events**

```sql
CREATE TABLE riseworks_webhook_events (
    id TEXT PRIMARY KEY,
    transaction_id TEXT REFERENCES disbursement_transactions(id),
    event_type TEXT NOT NULL,
    provider TEXT NOT NULL,
    payload JSONB NOT NULL,
    signature TEXT,
    hash TEXT,
    verified BOOLEAN DEFAULT FALSE,
    processed BOOLEAN DEFAULT FALSE,
    received_at TIMESTAMP NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP,
    error_message TEXT,
    CONSTRAINT valid_provider CHECK (provider IN ('RISE', 'MOCK'))
);

CREATE INDEX idx_webhooks_transaction ON riseworks_webhook_events(transaction_id);
CREATE INDEX idx_webhooks_type ON riseworks_webhook_events(event_type);
CREATE INDEX idx_webhooks_processed ON riseworks_webhook_events(processed);
```

##### **disbursement_audit_logs**

```sql
CREATE TABLE disbursement_audit_logs (
    id TEXT PRIMARY KEY,
    transaction_id TEXT REFERENCES disbursement_transactions(id),
    batch_id TEXT REFERENCES payment_batches(id),
    action TEXT NOT NULL,
    actor TEXT,
    status TEXT NOT NULL,
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_status CHECK (status IN ('SUCCESS', 'FAILURE', 'WARNING', 'INFO'))
);

CREATE INDEX idx_audit_transaction ON disbursement_audit_logs(transaction_id);
CREATE INDEX idx_audit_batch ON disbursement_audit_logs(batch_id);
CREATE INDEX idx_audit_action ON disbursement_audit_logs(action);
CREATE INDEX idx_audit_created ON disbursement_audit_logs(created_at);
```

---

### Prisma Schema (Part 19 - Add to schema.prisma)

> **IMPORTANT**: The tables above are shown in SQL format for reference.
> This project uses **Prisma ORM**. Add the following models to `prisma/schema.prisma`.
>
> **DO NOT recreate** `AffiliateProfile`, `Commission`, or `User` - they already exist in Part 17.

#### New Enums for Part 19

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
```

#### AffiliateRiseAccount (RiseID Mapping)

```prisma
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
```

#### PaymentBatch (Batch Tracking)

```prisma
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
```

#### DisbursementTransaction (Individual Payments)

```prisma
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
```

#### RiseWorksWebhookEvent (Webhook Storage)

```prisma
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
```

#### DisbursementAuditLog (Compliance Trail)

```prisma
model DisbursementAuditLog {
  id              String   @id @default(cuid())

  // References (optional)
  transactionId   String?
  transaction     DisbursementTransaction? @relation(fields: [transactionId], references: [id])

  batchId         String?
  batch           PaymentBatch? @relation(fields: [batchId], references: [id])

  // Action Details
  action          String   // e.g., "batch.created", "payment.executed", "webhook.received"
  actor           String?  // User ID or "system"
  status          AuditLogStatus

  // Context
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

#### Update Existing Models (Part 17)

Add these relations to existing Part 17 models:

```prisma
// Add to AffiliateProfile model in Part 17:
model AffiliateProfile {
  // ... existing fields ...

  // Part 19: RiseWorks Integration
  riseAccount       AffiliateRiseAccount?
}

// Add to Commission model in Part 17:
model Commission {
  // ... existing fields ...

  // Part 19: Disbursement Tracking
  disbursementTransaction DisbursementTransaction?
}
```

---

### Data Flow Diagrams

#### Commission Calculation Flow

```mermaid
sequenceDiagram
    participant S as Subscription Event
    participant CC as Commission Calculator
    participant DB as Database
    participant N as Notifier

    S->>CC: New subscription event
    CC->>DB: Query affiliate info
    DB-->>CC: Affiliate data
    CC->>CC: Calculate commission
    CC->>DB: Insert commission record
    CC->>N: Notify affiliate
    N-->>S: Confirmation
```

#### Payment Execution Flow

```mermaid
sequenceDiagram
    participant SCH as Scheduler
    participant PO as Payment Orchestrator
    participant BPM as Batch Manager
    participant PC as Provider Client
    participant DB as Database
    participant RISE as Rise API

    SCH->>PO: Trigger payment cycle
    PO->>DB: Query pending commissions
    DB-->>PO: Commission list
    PO->>BPM: Create payment batch
    BPM->>DB: Insert batch record
    BPM->>PC: Execute batch payment
    PC->>RISE: POST /payments/batch-pay
    RISE-->>PC: Transaction result
    PC->>DB: Update transaction status
    DB-->>PO: Confirmation
```

#### Webhook Processing Flow

```mermaid
sequenceDiagram
    participant RISE as Rise API
    participant WH as Webhook Receiver
    participant V as Validator
    participant EP as Event Processor
    participant DB as Database
    participant N as Notifier

    RISE->>WH: POST webhook event
    WH->>V: Validate signature
    V->>V: Verify hash
    V-->>WH: Valid
    WH->>EP: Process event
    EP->>DB: Update transaction
    EP->>N: Send notification
    WH-->>RISE: 200 OK
```

---

## Integration Architecture

### Rise API Integration Points

#### Authentication Flow

```mermaid
sequenceDiagram
    participant APP as Application
    participant RC as Rise Client
    participant W as Wallet
    participant API as Rise API

    APP->>RC: Initialize payment
    RC->>API: GET /auth/api/siwe?wallet=0x...
    API-->>RC: Message to sign
    RC->>W: Sign message
    W-->>RC: Signature
    RC->>API: POST /auth/api/siwe {signature}
    API-->>RC: Bearer token
    RC->>APP: Authenticated
```

#### Payment Flow

```mermaid
sequenceDiagram
    participant APP as Application
    participant RC as Rise Client
    participant W as Wallet
    participant API as Rise API
    participant BC as Blockchain

    APP->>RC: send_payment(payee, amount)
    RC->>API: PUT /payments/pay {payment_intent}
    API-->>RC: TypedData for signing
    RC->>W: Sign TypedData
    W-->>RC: Signature
    RC->>API: POST /payments/pay {signature, intent}
    API->>BC: Execute smart contract
    BC-->>API: Transaction hash
    API-->>RC: Payment result
    RC->>APP: Payment confirmed
```

### API Endpoint Mapping

#### **Authentication Endpoints**

```
GET  /auth/api/siwe
POST /auth/api/siwe
```

#### **Payment Endpoints**

```
PUT  /payments/pay              # Request payment intent
POST /payments/pay              # Execute payment
PUT  /payments/batch-pay        # Request batch intent
POST /payments/batch-pay        # Execute batch
GET  /payments/{tx_id}          # Get payment status
```

#### **RiseID Endpoints**

```
GET  /riseid/{rise_id}/balance  # Get account balance
GET  /riseid/{rise_id}          # Get RiseID info
POST /riseid/invite             # Invite new payee
```

#### **Webhook Endpoints** (Our Implementation)

```
POST /webhooks/rise             # Receive Rise events
```

### Provider Configuration Schema

```yaml
payment_providers:
  rise:
    enabled: false # Toggle for production
    base_url: 'https://b2b-api.riseworks.io/v1'
    staging_url: 'https://b2b-api.staging-riseworks.io/v1'
    environment: 'staging' # staging | production
    wallet:
      address: '${RISE_WALLET_ADDRESS}'
      private_key: '${RISE_WALLET_PRIVATE_KEY}'
    company:
      rise_id: '${RISE_COMPANY_ID}'
      manager_email: '${RISE_MANAGER_EMAIL}'
    api:
      timeout: 30
      retry_attempts: 3
      retry_delay: 5
      max_batch_size: 100
    webhooks:
      enabled: true
      endpoint: '/webhooks/rise'
      signer_address: '${RISE_SIGNER_ADDRESS}'
    features:
      batch_payments: true
      auto_invite: true
      webhook_verification: true

  mock:
    enabled: true # Default for development
    simulated_delay: 2 # seconds
    failure_rate: 0.0 # 0.0 - 1.0
    features:
      simulate_webhooks: true
      generate_realistic_ids: true
```

### Environment Variables

```bash
# Payment Provider Selection
PAYMENT_PROVIDER=mock  # mock | rise

# Rise Configuration
RISE_ENABLED=false
RISE_ENVIRONMENT=staging  # staging | production
RISE_API_BASE_URL=https://b2b-api.staging-riseworks.io/v1
RISE_WALLET_ADDRESS=0x...
RISE_WALLET_PRIVATE_KEY=0x...
RISE_COMPANY_ID=0x...
RISE_MANAGER_EMAIL=admin@tradingalerts.example
RISE_SIGNER_ADDRESS=0x...

# Payment Scheduling
PAYMENT_SCHEDULE_ENABLED=true
PAYMENT_SCHEDULE_DAILY_TIME=00:00
PAYMENT_SCHEDULE_TIMEZONE=UTC
PAYMENT_MINIMUM_THRESHOLD=50.00
PAYMENT_BATCH_SIZE=100

# Webhook Configuration
WEBHOOK_VERIFICATION_ENABLED=true
WEBHOOK_SIGNATURE_REQUIRED=true

# Feature Flags
FEATURE_BATCH_PAYMENTS=true
FEATURE_AUTO_AFFILIATE_INVITE=true
FEATURE_WEBHOOK_PROCESSING=true
```

---

## Security Architecture

### Authentication & Authorization

#### API Authentication

```mermaid
graph TB
    A[Client Request] --> B{Has JWT?}
    B -->|No| C[401 Unauthorized]
    B -->|Yes| D{Valid JWT?}
    D -->|No| C
    D -->|Yes| E{Has Permission?}
    E -->|No| F[403 Forbidden]
    E -->|Yes| G[Process Request]

    G --> H{Payment Operation?}
    H -->|Yes| I[Verify Payment Auth]
    I --> J{Authorized?}
    J -->|No| F
    J -->|Yes| K[Execute Payment]
    H -->|No| K
```

#### Rise API Authentication

- **Method**: Ethereum wallet signature (SIWE - Sign-In with Ethereum)
- **Token**: JWT bearer token with 24-hour expiry
- **Refresh**: Automatic re-authentication on token expiry
- **Wallet Security**: Private key stored in secure environment variables

#### Payment Authorization Levels

```
Admin:
  - Create payment batches
  - Execute payments
  - Cancel payments
  - View all transactions
  - Configure payment settings

Manager:
  - View payment batches
  - View transactions
  - Export reports

Affiliate:
  - View own commissions
  - View payment history
  - Update payment preferences
```

### Data Security

#### Sensitive Data Handling

```yaml
encryption_at_rest:
  - wallet_private_keys: AES-256
  - api_tokens: Encrypted in memory
  - transaction_details: Database encryption

encryption_in_transit:
  - all_api_calls: TLS 1.3
  - webhook_endpoints: HTTPS only
  - internal_services: mTLS (future)

secrets_management:
  provider: Environment variables + Railway secrets
  rotation: Manual (quarterly recommended)
  access: Restricted to deployment pipeline
```

#### PII (Personally Identifiable Information)

```
Data Classification:
- High Sensitivity: Wallet keys, API keys
- Medium Sensitivity: Email, Rise IDs, transaction amounts
- Low Sensitivity: Commission rates, payment schedules

Compliance Requirements:
- GDPR: Right to deletion, data export
- PCI: Not applicable (no card data)
- Financial Records: 7-year retention
```

### Webhook Security

#### Verification Process

```python
def verify_webhook(request):
    # Extract headers
    payload_hash = request.headers.get('x-rise-hash')
    signature = request.headers.get('x-rise-signature')

    # Verify hash
    calculated_hash = keccak256(request.body)
    if calculated_hash != payload_hash:
        return False

    # Verify signature
    recovered_address = recover_address(payload_hash, signature)
    if recovered_address != RISE_SIGNER_ADDRESS:
        return False

    return True
```

#### Replay Attack Prevention

- Timestamp validation (reject events > 5 minutes old)
- Event ID tracking (reject duplicate events)
- Signature verification on every request

### Error Handling Security

#### Information Disclosure Prevention

```yaml
error_responses:
  production:
    - Generic error messages
    - No stack traces
    - Logged internally only

  development:
    - Detailed error messages
    - Stack traces enabled
    - Debug information visible

rate_limiting:
  api_endpoints: 100 requests/minute/IP
  webhook_endpoint: 1000 requests/minute
  payment_operations: 10 concurrent/user
```

---

## Configuration Architecture

### Configuration Hierarchy

```
Default Config (code)
    ↓
Environment Config (.env)
    ↓
Railway Secrets (production)
    ↓
Runtime Overrides (admin panel)
```

### Configuration Schema

```python
@dataclass
class PaymentConfig:
    provider: str  # 'mock' | 'rise'
    enabled: bool
    min_payout: Decimal
    batch_size: int
    schedule: PaymentSchedule
    retry_policy: RetryPolicy
    notification_settings: NotificationConfig

@dataclass
class RiseConfig:
    base_url: str
    wallet_address: str
    wallet_private_key: str  # Encrypted
    company_rise_id: str
    timeout: int
    retry_attempts: int
    webhook_enabled: bool
    webhook_signer: str

@dataclass
class PaymentSchedule:
    enabled: bool
    frequency: str  # 'daily' | 'weekly' | 'monthly'
    day_of_week: Optional[int]  # 0-6 for weekly
    day_of_month: Optional[int]  # 1-31 for monthly
    time: str  # HH:MM format
    timezone: str

@dataclass
class RetryPolicy:
    max_attempts: int
    initial_delay: int  # seconds
    max_delay: int
    backoff_multiplier: float  # Exponential backoff
```

### Feature Flags

```python
class PaymentFeatures:
    BATCH_PAYMENTS = "batch_payments"
    AUTO_INVITE = "auto_affiliate_invite"
    WEBHOOK_PROCESSING = "webhook_processing"
    EMAIL_NOTIFICATIONS = "email_notifications"
    ADMIN_NOTIFICATIONS = "admin_notifications"
    PAYMENT_SCHEDULING = "payment_scheduling"

    # Future features
    MULTI_CURRENCY = "multi_currency_support"
    CRYPTO_PAYMENTS = "crypto_payments"
    INSTANT_PAYOUTS = "instant_payouts"
```

---

## Testing Architecture

### Testing Strategy

```mermaid
graph TB
    A[Testing Strategy] --> B[Unit Tests]
    A --> C[Integration Tests]
    A --> D[Contract Tests]
    A --> E[E2E Tests]

    B --> B1[Commission Calculator]
    B --> B2[Payment Orchestrator]
    B --> B3[Provider Clients]

    C --> C1[Database Operations]
    C --> C2[Mock Provider]
    C --> C3[Webhook Processing]

    D --> D1[Rise API Contract]
    D --> D2[Provider Interface]

    E --> E1[Full Payment Flow]
    E --> E2[Error Scenarios]
    E --> E3[Webhook Events]
```

### Test Environments

#### Local Development

```yaml
database: PostgreSQL (Docker)
payment_provider: mock
webhooks: ngrok tunnel
features: all enabled
data: seed test data
```

#### CI/CD Pipeline

```yaml
database: PostgreSQL (ephemeral)
payment_provider: mock
webhooks: disabled
features: all enabled
data: automated fixtures
```

#### Staging (Railway)

```yaml
database: PostgreSQL (Railway)
payment_provider: rise (staging API)
webhooks: enabled
features: all enabled
data: synthetic test data
```

#### Production (Railway)

```yaml
database: PostgreSQL (Railway)
payment_provider: rise (production API)
webhooks: enabled
features: configured per environment
data: live data
```

### Test Coverage Targets

```yaml
unit_tests:
  coverage: 90%
  components:
    - Commission calculator: 95%
    - Payment orchestrator: 90%
    - Provider clients: 95%
    - Webhook handlers: 90%

integration_tests:
  coverage: 80%
  scenarios:
    - Payment lifecycle
    - Batch processing
    - Error handling
    - Webhook processing

e2e_tests:
  coverage: Critical paths
  scenarios:
    - Complete commission flow
    - Provider switching
    - Failure recovery
```

### Mock Provider Capabilities

```python
class MockPaymentClient:
    def configure_scenario(self, scenario: str):
        """
        Scenarios:
        - 'success': All payments succeed
        - 'partial_failure': 20% fail randomly
        - 'timeout': Simulate network timeout
        - 'rate_limit': Simulate API rate limiting
        - 'invalid_payee': Payee not found
        - 'insufficient_funds': Balance too low
        """
        pass

    def set_delay(self, min_seconds: int, max_seconds: int):
        """Simulate realistic network latency"""
        pass

    def trigger_webhook(self, event_type: str, transaction_id: str):
        """Manually trigger webhook events"""
        pass
```

---

## Deployment Architecture

### Deployment Topology

```mermaid
graph TB
    subgraph "GitHub"
        A[Source Code]
        B[GitHub Actions]
    end

    subgraph "Railway Platform"
        C[Flask API Service]
        D[Background Worker]
        E[PostgreSQL Database]
        F[Redis Cache]
    end

    subgraph "External Services"
        G[Rise API]
        H[Email Service]
    end

    A --> B
    B --> C
    B --> D
    C --> E
    C --> F
    D --> E
    C --> G
    C --> H

    style C fill:#f9f,stroke:#333
    style D fill:#f9f,stroke:#333
```

### Service Components

#### Flask API Service

```yaml
runtime: Python 3.11
framework: Flask
ports: 5000
instances: 2 (production)
resources:
  memory: 512MB
  cpu: 0.5 vCPU
environment: Railway
```

#### Background Worker (Future)

```yaml
runtime: Python 3.11
framework: Celery/APScheduler
workers: 2
tasks:
  - commission_calculation
  - payment_scheduling
  - batch_execution
  - webhook_processing
```

### Deployment Pipeline

```mermaid
graph LR
    A[Git Push] --> B[GitHub Actions]
    B --> C{Tests Pass?}
    C -->|No| D[Fail Build]
    C -->|Yes| E[Build Docker]
    E --> F[Push to Registry]
    F --> G{Branch?}
    G -->|main| H[Deploy Staging]
    G -->|production| I[Deploy Production]
    H --> J[Run Smoke Tests]
    J --> K{Tests Pass?}
    K -->|No| L[Rollback]
    K -->|Yes| M[Complete]
```

### Environment Configuration

#### Development

```yaml
environment: development
payment_provider: mock
database: local PostgreSQL
logging: DEBUG
features: all enabled
webhooks: ngrok
```

#### Staging

```yaml
environment: staging
payment_provider: rise (staging)
database: Railway PostgreSQL
logging: INFO
features: all enabled
webhooks: Railway URL
```

#### Production

```yaml
environment: production
payment_provider: rise (production)
database: Railway PostgreSQL
logging: WARNING
features: configured
webhooks: Railway URL
monitoring: enabled
```

### Container Configuration

```dockerfile
# Dockerfile excerpt for payment service
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Environment
ENV FLASK_APP=app.py
ENV PAYMENT_PROVIDER=mock

# Expose ports
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:5000/health || exit 1

# Run application
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "app:app"]
```

### Database Migration Strategy

```yaml
migration_tool: Alembic
strategy: Blue-Green deployment
process: 1. Create migration scripts
  2. Test in staging
  3. Apply to production (backward compatible)
  4. Deploy new code
  5. Remove deprecated columns (next release)

rollback_plan:
  - All migrations reversible
  - Data backups before migration
  - Previous version compatible with new schema
```

---

## Monitoring & Observability

### Metrics to Track

#### Payment Metrics

```yaml
business_metrics:
  - total_commissions_calculated
  - total_commissions_paid
  - average_commission_amount
  - commission_payout_rate
  - affiliate_participation_rate
  - payment_success_rate
  - payment_failure_rate
  - average_payment_time

technical_metrics:
  - api_request_count
  - api_response_time
  - api_error_rate
  - batch_size_distribution
  - webhook_processing_time
  - database_query_time
  - cache_hit_rate

financial_metrics:
  - total_payout_volume
  - payment_fees
  - currency_distribution
  - payout_by_country
```

### Logging Strategy

```python
# Structured logging format
{
    "timestamp": "2025-11-27T23:50:00Z",
    "level": "INFO",
    "service": "payment-service",
    "component": "payment_orchestrator",
    "action": "execute_batch_payment",
    "batch_id": "batch_123",
    "payment_count": 25,
    "total_amount": 1250.00,
    "provider": "rise",
    "status": "success",
    "duration_ms": 3450,
    "metadata": {
        "user_id": "admin_001",
        "ip_address": "10.0.0.1"
    }
}
```

### Alert Configuration

```yaml
critical_alerts:
  - name: 'Payment Failure Rate High'
    condition: failure_rate > 5%
    duration: 15 minutes
    action: Page on-call engineer

  - name: 'Rise API Down'
    condition: api_availability < 99%
    duration: 5 minutes
    action: Email + Slack

  - name: 'Batch Execution Failed'
    condition: batch_status = failed
    duration: immediate
    action: Email admin

warning_alerts:
  - name: 'Payment Processing Slow'
    condition: avg_processing_time > 10s
    duration: 30 minutes
    action: Slack notification

  - name: 'High Commission Volume'
    condition: pending_commissions > 1000
    duration: 1 hour
    action: Email admin
```

### Health Checks

```python
# Health check endpoint
@app.route('/health')
def health_check():
    checks = {
        "database": check_database_connection(),
        "payment_provider": check_payment_provider(),
        "cache": check_cache_connection(),
        "webhook_receiver": check_webhook_endpoint()
    }

    status = "healthy" if all(checks.values()) else "degraded"

    return {
        "status": status,
        "checks": checks,
        "timestamp": datetime.utcnow().isoformat()
    }
```

---

## Future Considerations

### Phase 2 Enhancements

#### Multi-Currency Support

- Support multiple currencies (USD, EUR, GBP, THB)
- Automatic currency conversion
- Regional payment preferences
- Currency-specific minimum thresholds

#### Cryptocurrency Payments

- USDC/USDT stablecoin payouts
- Crypto wallet integration
- Automatic fiat ↔ crypto conversion
- Tax implications handling

#### Advanced Scheduling

- Dynamic payment schedules per affiliate
- Payment windows based on time zones
- Holiday awareness (skip payment dates)
- Instant payout option (premium feature)

### Scalability Considerations

```yaml
current_capacity:
  affiliates: 1000
  payments_per_month: 10000
  batch_size: 100

scale_targets:
  year_1:
    affiliates: 10000
    payments_per_month: 100000

  year_2:
    affiliates: 50000
    payments_per_month: 500000

scaling_strategy:
  - Horizontal scaling: Multiple worker instances
  - Database: Read replicas for reporting
  - Caching: Redis for frequently accessed data
  - Queue: Message queue for async processing
```

### Alternative Providers

```yaml
provider_comparison:
  rise:
    pros: [Global coverage, Crypto support, AOR model]
    cons: [Setup complexity, API learning curve]
    fit: Excellent for current needs

  stripe_connect:
    pros: [Easy integration, Well documented]
    cons: [Limited global coverage, Higher fees]
    fit: Alternative for US/EU focused

  paypal_payouts:
    pros: [Widely adopted, Simple API]
    cons: [High fees, Limited currencies]
    fit: Backup option

  wise_api:
    pros: [Low fees, Many currencies]
    cons: [Business account required]
    fit: Future consideration
```

### Integration Opportunities

- **Accounting Systems**: QuickBooks, Xero integration
- **Tax Reporting**: Automatic 1099/W8BEN generation
- **Analytics**: Enhanced reporting dashboard
- **CRM**: Affiliate relationship management
- **Marketing**: Automated affiliate onboarding campaigns

---

## Appendix

### Glossary

**AOR (Agent of Record)**: Legal model where Rise acts as intermediary between company and contractors

**KYC (Know Your Customer)**: Identity verification process required by Rise

**RiseID**: Unique blockchain address identifying a Rise account (smart contract)

**TypedData**: Ethereum standard for structured data signing (EIP-712)

**Webhook**: HTTP callback for asynchronous event notification

**Batch Payment**: Group of multiple payments executed in single transaction

**Commission**: Affiliate earnings from referred subscriptions

**Payee**: Person receiving payment (affiliate)

**Payer**: Entity sending payment (your SaaS company)

**Salt**: Unique value preventing transaction replay attacks

**SIWE**: Sign-In with Ethereum, authentication method using wallet signatures

### Reference Documents

- Rise API Documentation: https://docs.riseworks.io/
- Trading Alerts SaaS V7 Architecture: [Link to main architecture doc]
- Database Schema Specification: [Link to schema doc]
- Security Policy: [Link to security doc]

### Version History

| Version | Date       | Author            | Changes                     |
| ------- | ---------- | ----------------- | --------------------------- |
| 1.0.0   | 2025-11-27 | Architecture Team | Initial architecture design |

---

## Document Purpose & Usage

**Target Audience**: Claude Code (web) for implementation planning

**Next Steps**:

1. Claude Code reads this architecture design
2. Claude Code generates detailed implementation plan (How To)
3. Implementation plan guides Aider for code generation
4. Implementation validates against this architecture

**Success Criteria**:

- All components described are implementable
- Database schema supports all use cases
- Security requirements are clear
- Testing strategy is comprehensive
- Deployment approach is practical

---

_This architecture design document defines WHAT the Rise payment integration stack is and HOW it fits into Trading Alerts SaaS V7. The implementation plan (generated by Claude Code) will define HOW TO build it, and Aider will execute the actual code implementation._
