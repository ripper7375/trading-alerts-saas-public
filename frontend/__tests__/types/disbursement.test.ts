/**
 * Tests for Disbursement Types (Part 19A)
 */

import type {
  DisbursementProvider,
  PaymentBatchStatus,
  DisbursementTransactionStatus,
  RiseWorksKycStatus,
  AuditLogStatus,
  PaymentRequest,
  BatchPaymentRequest,
  PaymentResult,
  BatchPaymentResult,
  AuthToken,
  PayeeInfo,
  CommissionAggregate,
  DisbursementConfig,
  PayableAffiliate,
} from '@/types/disbursement';

describe('Disbursement Types', () => {
  describe('Provider Types', () => {
    it('should have correct provider types', () => {
      const providers: DisbursementProvider[] = ['RISE', 'MOCK'];
      expect(providers).toHaveLength(2);
      expect(providers).toContain('RISE');
      expect(providers).toContain('MOCK');
    });
  });

  describe('Status Types', () => {
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

    it('should have correct KYC status types', () => {
      const statuses: RiseWorksKycStatus[] = [
        'PENDING',
        'SUBMITTED',
        'APPROVED',
        'REJECTED',
        'EXPIRED',
      ];
      expect(statuses).toHaveLength(5);
    });

    it('should have correct audit log status types', () => {
      const statuses: AuditLogStatus[] = [
        'SUCCESS',
        'FAILURE',
        'WARNING',
        'INFO',
      ];
      expect(statuses).toHaveLength(4);
    });
  });

  describe('PaymentRequest', () => {
    it('should create valid payment request', () => {
      const request: PaymentRequest = {
        affiliateId: 'aff-123',
        riseId: '0xA35b2F326F07a7C92BedB0D318C237F30948E425',
        amount: 50.0,
        currency: 'USD',
        commissionId: 'comm-123',
      };

      expect(request.affiliateId).toBe('aff-123');
      expect(request.riseId).toBe('0xA35b2F326F07a7C92BedB0D318C237F30948E425');
      expect(request.amount).toBe(50.0);
      expect(request.currency).toBe('USD');
      expect(request.commissionId).toBe('comm-123');
    });

    it('should allow optional metadata', () => {
      const request: PaymentRequest = {
        affiliateId: 'aff-123',
        riseId: '0xA35b...',
        amount: 50.0,
        currency: 'USD',
        commissionId: 'comm-123',
        metadata: { source: 'monthly-payout' },
      };

      expect(request.metadata).toEqual({ source: 'monthly-payout' });
    });
  });

  describe('BatchPaymentRequest', () => {
    it('should create valid batch payment request', () => {
      const batchRequest: BatchPaymentRequest = {
        batchId: 'batch-123',
        payments: [
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
        ],
      };

      expect(batchRequest.batchId).toBe('batch-123');
      expect(batchRequest.payments).toHaveLength(2);
    });

    it('should allow optional scheduledAt', () => {
      const scheduledDate = new Date('2025-01-15T10:00:00Z');
      const batchRequest: BatchPaymentRequest = {
        batchId: 'batch-123',
        payments: [],
        scheduledAt: scheduledDate,
      };

      expect(batchRequest.scheduledAt).toEqual(scheduledDate);
    });
  });

  describe('PaymentResult', () => {
    it('should create successful payment result', () => {
      const result: PaymentResult = {
        success: true,
        transactionId: 'TXN-123',
        providerTxId: 'rise-tx-abc',
        status: 'COMPLETED',
        amount: 50.0,
      };

      expect(result.success).toBe(true);
      expect(result.status).toBe('COMPLETED');
      expect(result.error).toBeUndefined();
    });

    it('should create failed payment result with error', () => {
      const result: PaymentResult = {
        success: false,
        transactionId: 'TXN-123',
        status: 'FAILED',
        amount: 50.0,
        error: 'Insufficient funds',
      };

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.error).toBe('Insufficient funds');
    });
  });

  describe('BatchPaymentResult', () => {
    it('should create batch payment result', () => {
      const result: BatchPaymentResult = {
        success: true,
        batchId: 'batch-123',
        totalAmount: 125.0,
        successCount: 2,
        failedCount: 0,
        results: [
          {
            success: true,
            transactionId: 'TXN-1',
            status: 'COMPLETED',
            amount: 50.0,
          },
          {
            success: true,
            transactionId: 'TXN-2',
            status: 'COMPLETED',
            amount: 75.0,
          },
        ],
      };

      expect(result.success).toBe(true);
      expect(result.totalAmount).toBe(125.0);
      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(result.results).toHaveLength(2);
    });
  });

  describe('AuthToken', () => {
    it('should create valid auth token', () => {
      const expiresAt = new Date(Date.now() + 3600000);
      const token: AuthToken = {
        token: 'jwt-token-xyz',
        expiresAt,
      };

      expect(token.token).toBe('jwt-token-xyz');
      expect(token.expiresAt).toEqual(expiresAt);
    });
  });

  describe('PayeeInfo', () => {
    it('should create payee info', () => {
      const payee: PayeeInfo = {
        riseId: '0xA35b...',
        email: 'affiliate@example.com',
        kycStatus: 'APPROVED',
        canReceivePayments: true,
      };

      expect(payee.riseId).toBe('0xA35b...');
      expect(payee.kycStatus).toBe('APPROVED');
      expect(payee.canReceivePayments).toBe(true);
    });

    it('should indicate KYC pending payee cannot receive payments', () => {
      const payee: PayeeInfo = {
        riseId: '0xB46c...',
        email: 'new-affiliate@example.com',
        kycStatus: 'PENDING',
        canReceivePayments: false,
      };

      expect(payee.kycStatus).toBe('PENDING');
      expect(payee.canReceivePayments).toBe(false);
    });
  });

  describe('CommissionAggregate', () => {
    it('should create commission aggregate ready for payout', () => {
      const aggregate: CommissionAggregate = {
        affiliateId: 'aff-123',
        commissionIds: ['comm-1', 'comm-2', 'comm-3'],
        totalAmount: 150.0,
        commissionCount: 3,
        oldestDate: new Date('2025-01-01'),
        canPayout: true,
      };

      expect(aggregate.affiliateId).toBe('aff-123');
      expect(aggregate.totalAmount).toBe(150.0);
      expect(aggregate.commissionCount).toBe(3);
      expect(aggregate.canPayout).toBe(true);
      expect(aggregate.reason).toBeUndefined();
    });

    it('should create aggregate not ready for payout with reason', () => {
      const aggregate: CommissionAggregate = {
        affiliateId: 'aff-456',
        commissionIds: ['comm-4'],
        totalAmount: 25.0,
        commissionCount: 1,
        oldestDate: new Date('2025-01-10'),
        canPayout: false,
        reason: 'Below minimum payout of $50',
      };

      expect(aggregate.canPayout).toBe(false);
      expect(aggregate.reason).toBe('Below minimum payout of $50');
    });
  });

  describe('DisbursementConfig', () => {
    it('should create valid disbursement config', () => {
      const config: DisbursementConfig = {
        provider: 'MOCK',
        enabled: true,
        minimumPayout: 50.0,
        batchSize: 100,
        retryPolicy: {
          maxAttempts: 3,
          initialDelay: 1000,
          maxDelay: 30000,
          backoffMultiplier: 2,
        },
      };

      expect(config.provider).toBe('MOCK');
      expect(config.enabled).toBe(true);
      expect(config.minimumPayout).toBe(50.0);
      expect(config.retryPolicy.maxAttempts).toBe(3);
    });
  });

  describe('PayableAffiliate', () => {
    it('should create payable affiliate with RiseWorks account', () => {
      const affiliate: PayableAffiliate = {
        id: 'aff-123',
        fullName: 'John Doe',
        email: 'john@example.com',
        country: 'US',
        pendingAmount: 150.0,
        paidAmount: 500.0,
        pendingCommissionCount: 3,
        oldestPendingDate: new Date('2025-01-01'),
        readyForPayout: true,
        riseAccount: {
          hasAccount: true,
          riseId: '0xA35b...',
          kycStatus: 'APPROVED',
          canReceivePayments: true,
        },
      };

      expect(affiliate.readyForPayout).toBe(true);
      expect(affiliate.riseAccount.hasAccount).toBe(true);
      expect(affiliate.riseAccount.canReceivePayments).toBe(true);
    });

    it('should create affiliate without RiseWorks account', () => {
      const affiliate: PayableAffiliate = {
        id: 'aff-456',
        fullName: 'Jane Smith',
        email: 'jane@example.com',
        country: 'UK',
        pendingAmount: 75.0,
        paidAmount: 0,
        pendingCommissionCount: 2,
        oldestPendingDate: new Date('2025-01-05'),
        readyForPayout: false,
        riseAccount: {
          hasAccount: false,
          kycStatus: 'none',
          canReceivePayments: false,
        },
      };

      expect(affiliate.readyForPayout).toBe(false);
      expect(affiliate.riseAccount.hasAccount).toBe(false);
      expect(affiliate.riseAccount.kycStatus).toBe('none');
    });
  });
});
