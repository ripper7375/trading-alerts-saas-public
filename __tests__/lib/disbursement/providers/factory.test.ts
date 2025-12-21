/**
 * Tests for Provider Factory (Part 19A)
 */

import {
  createPaymentProvider,
  getDefaultProviderName,
  isProviderAvailable,
  getAvailableProviders,
} from '@/lib/disbursement/providers/provider-factory';
import { MockPaymentProvider } from '@/lib/disbursement/providers/mock-provider';

describe('Provider Factory', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('createPaymentProvider', () => {
    it('should create MOCK provider', () => {
      const provider = createPaymentProvider('MOCK');

      expect(provider).toBeInstanceOf(MockPaymentProvider);
      expect(provider.name).toBe('MOCK');
    });

    it('should create MOCK provider with custom config', () => {
      const provider = createPaymentProvider('MOCK', {
        mockConfig: {
          failureRate: 0.5,
          delay: 50,
        },
      });

      expect(provider).toBeInstanceOf(MockPaymentProvider);
      expect(provider.name).toBe('MOCK');
    });

    it('should create provider from environment variable when type not specified', () => {
      process.env['DISBURSEMENT_PROVIDER'] = 'MOCK';
      const provider = createPaymentProvider();

      expect(provider).toBeInstanceOf(MockPaymentProvider);
    });

    it('should default to MOCK when environment variable not set', () => {
      delete process.env['DISBURSEMENT_PROVIDER'];
      const provider = createPaymentProvider();

      expect(provider).toBeInstanceOf(MockPaymentProvider);
    });

    it('should throw error for RISE provider (not yet implemented)', () => {
      expect(() => {
        createPaymentProvider('RISE');
      }).toThrow('RISE provider is not yet implemented');
    });

    it('should throw error for invalid provider', () => {
      expect(() => {
        // @ts-expect-error Testing invalid provider
        createPaymentProvider('INVALID');
      }).toThrow('Unsupported payment provider');
    });

    it('should throw error for empty string provider', () => {
      expect(() => {
        // @ts-expect-error Testing invalid provider
        createPaymentProvider('');
      }).toThrow('Unsupported payment provider');
    });
  });

  describe('getDefaultProviderName', () => {
    it('should return MOCK when DISBURSEMENT_PROVIDER not set', () => {
      delete process.env['DISBURSEMENT_PROVIDER'];
      expect(getDefaultProviderName()).toBe('MOCK');
    });

    it('should return MOCK when DISBURSEMENT_PROVIDER is MOCK', () => {
      process.env['DISBURSEMENT_PROVIDER'] = 'MOCK';
      expect(getDefaultProviderName()).toBe('MOCK');
    });

    it('should return RISE when DISBURSEMENT_PROVIDER is RISE', () => {
      process.env['DISBURSEMENT_PROVIDER'] = 'RISE';
      expect(getDefaultProviderName()).toBe('RISE');
    });
  });

  describe('isProviderAvailable', () => {
    it('should return true for MOCK provider', () => {
      expect(isProviderAvailable('MOCK')).toBe(true);
    });

    it('should return false for RISE provider (not yet implemented)', () => {
      expect(isProviderAvailable('RISE')).toBe(false);
    });
  });

  describe('getAvailableProviders', () => {
    it('should return only MOCK provider', () => {
      const providers = getAvailableProviders();

      expect(providers).toContain('MOCK');
      expect(providers).not.toContain('RISE');
    });

    it('should return array of provider names', () => {
      const providers = getAvailableProviders();

      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
    });
  });

  describe('provider interface compliance', () => {
    it('should create provider with required methods', () => {
      const provider = createPaymentProvider('MOCK');

      expect(typeof provider.authenticate).toBe('function');
      expect(typeof provider.sendPayment).toBe('function');
      expect(typeof provider.sendBatchPayment).toBe('function');
      expect(typeof provider.getPaymentStatus).toBe('function');
      expect(typeof provider.getPayeeInfo).toBe('function');
      expect(typeof provider.verifyWebhook).toBe('function');
    });

    it('should create provider that can authenticate', async () => {
      const provider = createPaymentProvider('MOCK');
      const token = await provider.authenticate();

      expect(token).toBeDefined();
      expect(token.token).toBeDefined();
      expect(token.expiresAt).toBeInstanceOf(Date);
    });

    it('should create provider that can send payments', async () => {
      const provider = createPaymentProvider('MOCK');
      const result = await provider.sendPayment({
        affiliateId: 'aff-123',
        riseId: '0xA35b...',
        amount: 50.0,
        currency: 'USD',
        commissionId: 'comm-123',
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
    });
  });
});
