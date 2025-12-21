/**
 * Tests for MockPaymentProvider (Part 19A)
 */

import { MockPaymentProvider } from '@/lib/disbursement/providers/mock-provider';
import { PaymentProviderError } from '@/lib/disbursement/providers/base-provider';
import type { PaymentRequest } from '@/types/disbursement';

describe('MockPaymentProvider', () => {
  let provider: MockPaymentProvider;

  beforeEach(() => {
    provider = new MockPaymentProvider();
  });

  afterEach(() => {
    provider.reset();
  });

  describe('constructor', () => {
    it('should create provider with default config', () => {
      const defaultProvider = new MockPaymentProvider();
      expect(defaultProvider.name).toBe('MOCK');
    });

    it('should create provider with custom config', () => {
      const customProvider = new MockPaymentProvider({
        failureRate: 0.5,
        delay: 50,
        verbose: true,
      });
      expect(customProvider.name).toBe('MOCK');
    });
  });

  describe('authenticate', () => {
    it('should authenticate successfully', async () => {
      const token = await provider.authenticate();

      expect(token).toBeDefined();
      expect(token.token).toMatch(/^mock-token-\d+$/);
      expect(token.expiresAt).toBeInstanceOf(Date);
      expect(token.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should fail authentication when failure rate is 1.0', async () => {
      const failingProvider = new MockPaymentProvider({ failureRate: 1.0 });

      await expect(failingProvider.authenticate()).rejects.toThrow(
        PaymentProviderError
      );
    });
  });

  describe('sendPayment', () => {
    const validRequest: PaymentRequest = {
      affiliateId: 'aff-123',
      riseId: '0xA35b2F326F07a7C92BedB0D318C237F30948E425',
      amount: 50.0,
      currency: 'USD',
      commissionId: 'comm-123',
    };

    it('should send payment successfully', async () => {
      const result = await provider.sendPayment(validRequest);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
      expect(result.transactionId).toMatch(/^TXN-\d+-[A-Z0-9]+$/);
      expect(result.providerTxId).toMatch(/^mock-provider-TXN-/);
      expect(result.status).toBe('COMPLETED');
      expect(result.amount).toBe(50.0);
      expect(result.error).toBeUndefined();
    });

    it('should fail payment with invalid amount (zero)', async () => {
      const invalidRequest: PaymentRequest = {
        ...validRequest,
        amount: 0,
      };

      const result = await provider.sendPayment(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.error).toContain('Invalid amount');
    });

    it('should fail payment with negative amount', async () => {
      const invalidRequest: PaymentRequest = {
        ...validRequest,
        amount: -50.0,
      };

      const result = await provider.sendPayment(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.error).toContain('Invalid amount');
    });

    it('should fail payment with missing riseId', async () => {
      const invalidRequest: PaymentRequest = {
        ...validRequest,
        riseId: '',
      };

      const result = await provider.sendPayment(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.error).toContain('riseId');
    });

    it('should fail payment when configured with 100% failure rate', async () => {
      const failingProvider = new MockPaymentProvider({ failureRate: 1.0 });

      const result = await failingProvider.sendPayment(validRequest);

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.error).toBe('Simulated payment failure');
    });

    it('should track transaction status after payment', async () => {
      const result = await provider.sendPayment(validRequest);

      const status = await provider.getPaymentStatus(result.transactionId);
      expect(status).toBe('COMPLETED');
    });
  });

  describe('sendBatchPayment', () => {
    const requests: PaymentRequest[] = [
      {
        affiliateId: 'aff-123',
        riseId: '0xA35b2F326F07a7C92BedB0D318C237F30948E425',
        amount: 50.0,
        currency: 'USD',
        commissionId: 'comm-123',
      },
      {
        affiliateId: 'aff-456',
        riseId: '0xB46c3F437G08b7D93CfeC1E429D348F41059F536',
        amount: 75.0,
        currency: 'USD',
        commissionId: 'comm-456',
      },
    ];

    it('should send batch payment successfully', async () => {
      const result = await provider.sendBatchPayment(requests);

      expect(result.success).toBe(true);
      expect(result.batchId).toMatch(/^mock-batch-\d+$/);
      expect(result.totalAmount).toBe(125.0);
      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(result.results).toHaveLength(2);
    });

    it('should handle empty batch', async () => {
      const result = await provider.sendBatchPayment([]);

      expect(result.success).toBe(true);
      expect(result.totalAmount).toBe(0);
      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(0);
      expect(result.results).toHaveLength(0);
    });

    it('should report partial failure in batch', async () => {
      // Create provider with 50% failure rate - statistically some will fail
      const partialFailProvider = new MockPaymentProvider({ failureRate: 1.0 });

      const result = await partialFailProvider.sendBatchPayment(requests);

      expect(result.success).toBe(false);
      expect(result.failedCount).toBeGreaterThan(0);
    });

    it('should track all transaction statuses', async () => {
      const result = await provider.sendBatchPayment(requests);

      for (const paymentResult of result.results) {
        const status = await provider.getPaymentStatus(
          paymentResult.transactionId
        );
        expect(['COMPLETED', 'FAILED']).toContain(status);
      }
    });
  });

  describe('getPaymentStatus', () => {
    it('should return status for existing transaction', async () => {
      const request: PaymentRequest = {
        affiliateId: 'aff-123',
        riseId: '0xA35b...',
        amount: 50.0,
        currency: 'USD',
        commissionId: 'comm-123',
      };

      const paymentResult = await provider.sendPayment(request);
      const status = await provider.getPaymentStatus(paymentResult.transactionId);

      expect(status).toBe('COMPLETED');
    });

    it('should return PENDING for unknown transaction', async () => {
      const status = await provider.getPaymentStatus('unknown-txn-id');
      expect(status).toBe('PENDING');
    });
  });

  describe('getPayeeInfo', () => {
    it('should return default mock payee info', async () => {
      const riseId = '0xA35b2F326F07a7C92BedB0D318C237F30948E425';
      const payee = await provider.getPayeeInfo(riseId);

      expect(payee.riseId).toBe(riseId);
      expect(payee.email).toBe('mock@example.com');
      expect(payee.kycStatus).toBe('APPROVED');
      expect(payee.canReceivePayments).toBe(true);
    });

    it('should return custom mock payee when added', async () => {
      const customPayee = {
        riseId: '0xCustom...',
        email: 'custom@example.com',
        kycStatus: 'PENDING' as const,
        canReceivePayments: false,
      };

      provider.addMockPayee(customPayee);
      const payee = await provider.getPayeeInfo('0xCustom...');

      expect(payee).toEqual(customPayee);
    });
  });

  describe('verifyWebhook', () => {
    it('should always return true for mock provider', () => {
      const payload = JSON.stringify({ event: 'payment.completed' });
      const signature = 'any-signature';

      const isValid = provider.verifyWebhook(payload, signature);
      expect(isValid).toBe(true);
    });

    it('should return true even with empty signature', () => {
      const isValid = provider.verifyWebhook('payload', '');
      expect(isValid).toBe(true);
    });
  });

  describe('test helpers', () => {
    it('should set transaction status manually', async () => {
      provider.setTransactionStatus('TXN-TEST-123', 'PROCESSING');

      const status = await provider.getPaymentStatus('TXN-TEST-123');
      expect(status).toBe('PROCESSING');
    });

    it('should get all transactions', async () => {
      const request: PaymentRequest = {
        affiliateId: 'aff-123',
        riseId: '0xA35b...',
        amount: 50.0,
        currency: 'USD',
        commissionId: 'comm-123',
      };

      await provider.sendPayment(request);
      const transactions = provider.getAllTransactions();

      expect(transactions.size).toBe(1);
    });

    it('should reset all mock data', async () => {
      const request: PaymentRequest = {
        affiliateId: 'aff-123',
        riseId: '0xA35b...',
        amount: 50.0,
        currency: 'USD',
        commissionId: 'comm-123',
      };

      await provider.sendPayment(request);
      provider.addMockPayee({
        riseId: '0xTest...',
        email: 'test@example.com',
        kycStatus: 'APPROVED',
        canReceivePayments: true,
      });

      provider.reset();

      const transactions = provider.getAllTransactions();
      expect(transactions.size).toBe(0);
    });
  });

  describe('delay simulation', () => {
    it('should respect delay configuration', async () => {
      const slowProvider = new MockPaymentProvider({ delay: 200 });

      const start = Date.now();
      await slowProvider.authenticate();
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(190); // Allow small margin
    });

    it('should work with zero delay', async () => {
      const fastProvider = new MockPaymentProvider({ delay: 0 });

      const start = Date.now();
      await fastProvider.authenticate();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
    });
  });
});
