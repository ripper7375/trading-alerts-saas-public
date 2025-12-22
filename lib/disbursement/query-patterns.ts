/**
 * Prisma Query Patterns for Disbursement System (Part 19B)
 *
 * CRITICAL: Standard query includes for consistent data fetching.
 * ALWAYS use these patterns to prevent type drift between services.
 *
 * DO NOT modify these patterns without:
 * 1. Checking all services that depend on them
 * 2. Updating the corresponding type exports
 * 3. Running all tests to verify no breakage
 */

import { Prisma } from '@prisma/client';

// ============================================================
// QUERY PATTERN CONSTANTS
// ============================================================

/**
 * Full batch with all relations needed by PaymentOrchestrator
 *
 * Used by:
 * - BatchManager.getBatchById()
 * - PaymentOrchestrator.executeBatch()
 * - Admin APIs that display batch details
 */
export const BATCH_WITH_TRANSACTIONS = Prisma.validator<Prisma.PaymentBatchInclude>()({
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
export const TRANSACTION_WITH_DETAILS = Prisma.validator<Prisma.DisbursementTransactionInclude>()({
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

/**
 * Affiliate with Rise account for disbursement eligibility
 *
 * Used by:
 * - Payable affiliates API
 * - Commission aggregation
 */
export const AFFILIATE_WITH_RISE_ACCOUNT = Prisma.validator<Prisma.AffiliateProfileInclude>()({
  user: {
    select: {
      email: true,
    },
  },
  riseAccount: true,
  commissions: {
    where: {
      status: 'APPROVED',
      disbursementTransaction: null,
    },
    orderBy: {
      createdAt: 'asc',
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

/**
 * Affiliate with Rise account for disbursement
 */
export type AffiliateWithRiseAccount = Prisma.AffiliateProfileGetPayload<{
  include: typeof AFFILIATE_WITH_RISE_ACCOUNT;
}>;

// ============================================================
// TRANSACTION TYPES (for individual transactions in a batch)
// ============================================================

/**
 * Transaction type as it appears in BatchWithTransactions
 */
export type BatchTransaction = BatchWithTransactions['transactions'][number];
