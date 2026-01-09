/**
 * Disbursement Types for RiseWorks Payment System (Part 19)
 *
 * These types define the structure for affiliate commission payouts
 * using the RiseWorks blockchain payment infrastructure.
 */

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
  amount: number;
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
  retryPolicy: {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
  };
}

export interface CommissionAggregate {
  affiliateId: string;
  commissionIds: string[];
  totalAmount: number;
  commissionCount: number;
  oldestDate: Date;
  canPayout: boolean;
  reason?: string;
}

// RiseWorks-specific types
export interface RiseWorksApiConfig {
  apiBaseUrl: string;
  walletAddress: string;
  privateKey: string;
  teamId: string;
  webhookSecret: string;
}

export interface RiseWorksPayee {
  riseId: string;
  email: string;
  status: 'active' | 'pending' | 'suspended';
  kycStatus: RiseWorksKycStatus;
}

export interface RiseWorksPayment {
  payeeRiseId: string;
  amount: bigint; // Amount in 1e6 units
  memo?: string;
}

export interface RiseWorksBatchPaymentRequest {
  payments: RiseWorksPayment[];
  idempotencyKey?: string;
}

export interface RiseWorksWebhookPayload {
  event: string;
  teamId: string;
  timestamp: string;
  data: Record<string, unknown>;
}
