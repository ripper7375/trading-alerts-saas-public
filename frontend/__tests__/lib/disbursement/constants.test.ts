/**
 * Tests for Disbursement Constants (Part 19A)
 */

import {
  MINIMUM_PAYOUT_USD,
  MAX_BATCH_SIZE,
  RISE_AMOUNT_FACTOR,
  DEFAULT_CURRENCY,
  SUPPORTED_PROVIDERS,
  RISE_API_URLS,
  WEBHOOK_EVENT_TYPES,
  DEFAULT_RETRY_CONFIG,
  FINAL_TRANSACTION_STATUSES,
  RETRYABLE_TRANSACTION_STATUSES,
  usdToRiseUnits,
  riseUnitsToUsd,
  isValidProvider,
  generateBatchNumber,
  generateTransactionId,
  meetsMinimumPayout,
  calculateBackoffDelay,
  isTransactionFinal,
  canRetryTransaction,
  getDefaultProvider,
} from '@/lib/disbursement/constants';

describe('Disbursement Constants', () => {
  describe('Configuration Constants', () => {
    it('should have correct minimum payout threshold', () => {
      expect(MINIMUM_PAYOUT_USD).toBe(50.0);
    });

    it('should have correct max batch size', () => {
      expect(MAX_BATCH_SIZE).toBe(100);
    });

    it('should have correct Rise amount factor for USDC decimals', () => {
      expect(RISE_AMOUNT_FACTOR).toBe(1_000_000);
    });

    it('should have USD as default currency', () => {
      expect(DEFAULT_CURRENCY).toBe('USD');
    });

    it('should have RISE and MOCK as supported providers', () => {
      expect(SUPPORTED_PROVIDERS).toEqual(['RISE', 'MOCK']);
    });
  });

  describe('API URLs', () => {
    it('should have production and staging URLs', () => {
      expect(RISE_API_URLS.production).toBe('https://b2b-api.riseworks.io/v1');
      expect(RISE_API_URLS.staging).toBe(
        'https://b2b-api.staging-riseworks.io/v1'
      );
    });
  });

  describe('Webhook Event Types', () => {
    it('should have all required webhook event types', () => {
      expect(WEBHOOK_EVENT_TYPES.INVITE_ACCEPTED).toBe('invite.accepted');
      expect(WEBHOOK_EVENT_TYPES.FUND_RECEIVED).toBe('fund.received');
      expect(WEBHOOK_EVENT_TYPES.PAYMENT_INITIATED).toBe('payment.initiated');
      expect(WEBHOOK_EVENT_TYPES.PAYMENT_COMPLETED).toBe('payment.completed');
      expect(WEBHOOK_EVENT_TYPES.PAYMENT_FAILED).toBe('payment.failed');
      expect(WEBHOOK_EVENT_TYPES.ACCOUNT_DUPLICATION).toBe(
        'account.duplication_detected'
      );
    });
  });

  describe('Retry Configuration', () => {
    it('should have correct default retry config', () => {
      expect(DEFAULT_RETRY_CONFIG.maxAttempts).toBe(3);
      expect(DEFAULT_RETRY_CONFIG.initialDelay).toBe(1000);
      expect(DEFAULT_RETRY_CONFIG.maxDelay).toBe(30000);
      expect(DEFAULT_RETRY_CONFIG.backoffMultiplier).toBe(2);
    });
  });

  describe('Status Constants', () => {
    it('should have correct final transaction statuses', () => {
      expect(FINAL_TRANSACTION_STATUSES).toEqual([
        'COMPLETED',
        'FAILED',
        'CANCELLED',
      ]);
    });

    it('should have correct retryable transaction statuses', () => {
      expect(RETRYABLE_TRANSACTION_STATUSES).toEqual(['FAILED']);
    });
  });

  describe('usdToRiseUnits', () => {
    it('should convert $50.00 to 50,000,000 units', () => {
      expect(usdToRiseUnits(50.0)).toBe(50_000_000n);
    });

    it('should convert $100.50 to 100,500,000 units', () => {
      expect(usdToRiseUnits(100.5)).toBe(100_500_000n);
    });

    it('should convert $0.01 to 10,000 units', () => {
      expect(usdToRiseUnits(0.01)).toBe(10_000n);
    });

    it('should handle zero amount', () => {
      expect(usdToRiseUnits(0)).toBe(0n);
    });

    it('should handle large amounts', () => {
      expect(usdToRiseUnits(1000000)).toBe(1_000_000_000_000n);
    });
  });

  describe('riseUnitsToUsd', () => {
    it('should convert 50,000,000 units to $50.00', () => {
      expect(riseUnitsToUsd(50_000_000n)).toBe(50.0);
    });

    it('should convert 100,500,000 units to $100.50', () => {
      expect(riseUnitsToUsd(100_500_000n)).toBe(100.5);
    });

    it('should convert 10,000 units to $0.01', () => {
      expect(riseUnitsToUsd(10_000n)).toBe(0.01);
    });

    it('should handle zero units', () => {
      expect(riseUnitsToUsd(0n)).toBe(0);
    });
  });

  describe('isValidProvider', () => {
    it('should return true for RISE provider', () => {
      expect(isValidProvider('RISE')).toBe(true);
    });

    it('should return true for MOCK provider', () => {
      expect(isValidProvider('MOCK')).toBe(true);
    });

    it('should return false for invalid provider', () => {
      expect(isValidProvider('INVALID')).toBe(false);
      expect(isValidProvider('stripe')).toBe(false);
      expect(isValidProvider('')).toBe(false);
    });
  });

  describe('generateBatchNumber', () => {
    it('should generate batch number with correct format', () => {
      const batchNumber = generateBatchNumber();
      const year = new Date().getFullYear();
      expect(batchNumber).toMatch(new RegExp(`^BATCH-${year}-[A-Z0-9]+$`));
    });

    it('should generate unique batch numbers', () => {
      const batch1 = generateBatchNumber();
      const batch2 = generateBatchNumber();
      expect(batch1).not.toBe(batch2);
    });
  });

  describe('generateTransactionId', () => {
    it('should generate transaction ID with correct format', () => {
      const txnId = generateTransactionId();
      expect(txnId).toMatch(/^TXN-\d+-[A-Z0-9]+$/);
    });

    it('should generate unique transaction IDs', () => {
      const txn1 = generateTransactionId();
      const txn2 = generateTransactionId();
      expect(txn1).not.toBe(txn2);
    });
  });

  describe('meetsMinimumPayout', () => {
    it('should return true for amount at minimum threshold', () => {
      expect(meetsMinimumPayout(50.0)).toBe(true);
    });

    it('should return true for amount above minimum threshold', () => {
      expect(meetsMinimumPayout(100.0)).toBe(true);
    });

    it('should return false for amount below minimum threshold', () => {
      expect(meetsMinimumPayout(49.99)).toBe(false);
      expect(meetsMinimumPayout(0)).toBe(false);
    });
  });

  describe('calculateBackoffDelay', () => {
    it('should calculate correct delay for first attempt', () => {
      expect(calculateBackoffDelay(1)).toBe(1000);
    });

    it('should calculate correct delay for second attempt', () => {
      expect(calculateBackoffDelay(2)).toBe(2000);
    });

    it('should calculate correct delay for third attempt', () => {
      expect(calculateBackoffDelay(3)).toBe(4000);
    });

    it('should not exceed max delay', () => {
      expect(calculateBackoffDelay(10)).toBe(30000);
      expect(calculateBackoffDelay(20)).toBe(30000);
    });

    it('should use custom config', () => {
      const customConfig = {
        maxAttempts: 5,
        initialDelay: 500,
        maxDelay: 10000,
        backoffMultiplier: 3,
      };
      expect(calculateBackoffDelay(1, customConfig)).toBe(500);
      expect(calculateBackoffDelay(2, customConfig)).toBe(1500);
      expect(calculateBackoffDelay(3, customConfig)).toBe(4500);
      expect(calculateBackoffDelay(4, customConfig)).toBe(10000); // capped at maxDelay
    });
  });

  describe('isTransactionFinal', () => {
    it('should return true for COMPLETED status', () => {
      expect(isTransactionFinal('COMPLETED')).toBe(true);
    });

    it('should return true for FAILED status', () => {
      expect(isTransactionFinal('FAILED')).toBe(true);
    });

    it('should return true for CANCELLED status', () => {
      expect(isTransactionFinal('CANCELLED')).toBe(true);
    });

    it('should return false for PENDING status', () => {
      expect(isTransactionFinal('PENDING')).toBe(false);
    });

    it('should return false for PROCESSING status', () => {
      expect(isTransactionFinal('PROCESSING')).toBe(false);
    });
  });

  describe('canRetryTransaction', () => {
    it('should return true for FAILED status with retries remaining', () => {
      expect(canRetryTransaction('FAILED', 0)).toBe(true);
      expect(canRetryTransaction('FAILED', 1)).toBe(true);
      expect(canRetryTransaction('FAILED', 2)).toBe(true);
    });

    it('should return false for FAILED status with max retries reached', () => {
      expect(canRetryTransaction('FAILED', 3)).toBe(false);
      expect(canRetryTransaction('FAILED', 5)).toBe(false);
    });

    it('should return false for COMPLETED status', () => {
      expect(canRetryTransaction('COMPLETED', 0)).toBe(false);
    });

    it('should return false for CANCELLED status', () => {
      expect(canRetryTransaction('CANCELLED', 0)).toBe(false);
    });

    it('should return false for PENDING status', () => {
      expect(canRetryTransaction('PENDING', 0)).toBe(false);
    });

    it('should use custom max attempts', () => {
      expect(canRetryTransaction('FAILED', 4, 5)).toBe(true);
      expect(canRetryTransaction('FAILED', 5, 5)).toBe(false);
    });
  });

  describe('getDefaultProvider', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should return MOCK when DISBURSEMENT_PROVIDER is not set', () => {
      delete process.env['DISBURSEMENT_PROVIDER'];
      expect(getDefaultProvider()).toBe('MOCK');
    });

    it('should return MOCK when DISBURSEMENT_PROVIDER is MOCK', () => {
      process.env['DISBURSEMENT_PROVIDER'] = 'MOCK';
      expect(getDefaultProvider()).toBe('MOCK');
    });

    it('should return RISE when DISBURSEMENT_PROVIDER is RISE', () => {
      process.env['DISBURSEMENT_PROVIDER'] = 'RISE';
      expect(getDefaultProvider()).toBe('RISE');
    });
  });
});
