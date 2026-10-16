/**
 * dLocal Payment Service Tests
 *
 * Ported from __tests__/lib/dlocal/dlocal-payment.test.ts (Session 4A-4,
 * File 4/4). Assertions unchanged (parity oracle) — only the import path
 * changed (free functions, no DI, so no NestJS testing module needed).
 */
import crypto from 'crypto';

const mockRedisSet = jest.fn();
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    set: mockRedisSet,
  }));
});

import {
  acquireCreatePaymentLock,
  createPayment,
  verifyWebhookSignature,
  getPaymentStatus,
  mapDLocalStatus,
  extractUserIdFromOrderId,
} from './dlocal-payment.service';
import type { PaymentStatus } from './dlocal.types';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('dLocal Payment Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPayment', () => {
    it('should create payment request with correct structure', async () => {
      const payment = await createPayment({
        userId: 'user-123',
        amount: 29.0,
        currency: 'INR',
        country: 'IN',
        paymentMethod: 'UPI',
        planType: 'MONTHLY',
      });

      expect(payment.paymentId).toBeDefined();
      expect(payment.orderId).toBeDefined();
      expect(payment.orderId).toContain('order-user-123-');
      expect(payment.paymentUrl).toBeDefined();
      expect(payment.status).toBe('PENDING');
    });

    it('should include amount and currency in response', async () => {
      const payment = await createPayment({
        userId: 'user-456',
        amount: 1.99,
        currency: 'THB',
        country: 'TH',
        paymentMethod: 'TrueMoney',
        planType: 'THREE_DAY',
      });

      expect(payment.amount).toBe(1.99);
      expect(payment.currency).toBe('THB');
    });

    it('should generate unique order IDs', async () => {
      const payment1 = await createPayment({
        userId: 'user-123',
        amount: 29.0,
        currency: 'INR',
        country: 'IN',
        paymentMethod: 'UPI',
        planType: 'MONTHLY',
      });

      // Add small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      const payment2 = await createPayment({
        userId: 'user-123',
        amount: 29.0,
        currency: 'INR',
        country: 'IN',
        paymentMethod: 'UPI',
        planType: 'MONTHLY',
      });

      expect(payment1.orderId).not.toBe(payment2.orderId);
    });

    it('should handle optional name and email', async () => {
      const payment = await createPayment({
        userId: 'user-123',
        amount: 29.0,
        currency: 'INR',
        country: 'IN',
        paymentMethod: 'UPI',
        planType: 'MONTHLY',
        name: 'John Doe',
        email: 'john@example.com',
      });

      expect(payment.paymentId).toBeDefined();
    });
  });

  describe('fails closed outside test mode (Remediation Tier 2 §6.5)', () => {
    const ORIGINAL_ENV = process.env;
    const loadFresh = () => {
      jest.resetModules();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('./dlocal-payment.service') as typeof import('./dlocal-payment.service');
    };
    const request = {
      userId: 'user-1',
      amount: 29,
      currency: 'INR' as const,
      country: 'IN' as const,
      paymentMethod: 'UPI',
      planType: 'MONTHLY' as const,
    };

    afterEach(() => {
      process.env = ORIGINAL_ENV;
      jest.resetModules();
    });

    it('createPayment refuses, instead of returning a mock PENDING payment, when DLOCAL_API_KEY is missing', async () => {
      const env = {
        ...ORIGINAL_ENV,
        NODE_ENV: 'production',
        NEXTAUTH_URL: 'https://app.example.test',
      } as Record<string, string | undefined>;
      delete env['DLOCAL_API_KEY'];
      process.env = env as NodeJS.ProcessEnv;
      const fresh = loadFresh();

      await expect(fresh.createPayment(request)).rejects.toMatchObject({
        name: 'DLocalNotConfiguredError',
        missing: ['DLOCAL_API_KEY'],
      });
    });

    it('createPayment refuses when NEXTAUTH_URL is missing (it would build "undefined/api/webhooks/dlocal")', async () => {
      const env = {
        ...ORIGINAL_ENV,
        NODE_ENV: 'production',
        DLOCAL_API_KEY: 'key',
      } as Record<string, string | undefined>;
      delete env['NEXTAUTH_URL'];
      process.env = env as NodeJS.ProcessEnv;
      const fresh = loadFresh();

      await expect(fresh.createPayment(request)).rejects.toMatchObject({
        missing: ['NEXTAUTH_URL'],
      });
    });

    it('names every missing variable at once', async () => {
      const env = { ...ORIGINAL_ENV, NODE_ENV: 'production' } as Record<
        string,
        string | undefined
      >;
      delete env['DLOCAL_API_KEY'];
      delete env['NEXTAUTH_URL'];
      process.env = env as NodeJS.ProcessEnv;
      const fresh = loadFresh();

      expect(fresh.getMissingDLocalConfig()).toEqual([
        'DLOCAL_API_KEY',
        'NEXTAUTH_URL',
      ]);
      expect(() => fresh.assertDLocalConfigured()).toThrow(
        /DLOCAL_API_KEY, NEXTAUTH_URL/
      );
    });

    it('never calls dLocal when it refuses', async () => {
      const env = { ...ORIGINAL_ENV, NODE_ENV: 'production' } as Record<
        string,
        string | undefined
      >;
      delete env['DLOCAL_API_KEY'];
      process.env = env as NodeJS.ProcessEnv;
      const fresh = loadFresh();
      const freshFetch = jest.spyOn(global, 'fetch');

      await expect(fresh.createPayment(request)).rejects.toBeDefined();

      expect(freshFetch).not.toHaveBeenCalled();
      freshFetch.mockRestore();
    });

    it('getPaymentStatus throws instead of reporting a mock PENDING when the key is missing', async () => {
      const env = { ...ORIGINAL_ENV, NODE_ENV: 'production' } as Record<
        string,
        string | undefined
      >;
      delete env['DLOCAL_API_KEY'];
      process.env = env as NodeJS.ProcessEnv;
      const fresh = loadFresh();

      await expect(fresh.getPaymentStatus('pay-1')).rejects.toMatchObject({
        name: 'DLocalNotConfiguredError',
      });
    });

    it('mock mode still works under NODE_ENV=test, with no key and no NEXTAUTH_URL', async () => {
      const env = { ...ORIGINAL_ENV, NODE_ENV: 'test' } as Record<
        string,
        string | undefined
      >;
      delete env['DLOCAL_API_KEY'];
      delete env['NEXTAUTH_URL'];
      process.env = env as NodeJS.ProcessEnv;
      const fresh = loadFresh();

      expect(fresh.getMissingDLocalConfig()).toEqual([]);
      await expect(fresh.createPayment(request)).resolves.toMatchObject({
        status: 'PENDING',
        paymentId: expect.stringContaining('mock-payment-'),
      });
      await expect(fresh.getPaymentStatus('pay-1')).resolves.toMatchObject({
        status: 'PENDING',
      });
    });

    it('takes a real payment when both are set outside test', async () => {
      process.env = {
        ...ORIGINAL_ENV,
        NODE_ENV: 'production',
        DLOCAL_API_KEY: 'key',
        NEXTAUTH_URL: 'https://app.example.test',
      } as NodeJS.ProcessEnv;
      const fresh = loadFresh();

      expect(fresh.getMissingDLocalConfig()).toEqual([]);
    });
  });

  describe('createPayment outbound request body (F49)', () => {
    const ORIGINAL_ENV = process.env;

    afterEach(() => {
      process.env = ORIGINAL_ENV;
      jest.resetModules();
    });

    it('includes payment_method_flow: REDIRECT in the request sent to dLocal', async () => {
      jest.resetModules();
      process.env = {
        ...ORIGINAL_ENV,
        NODE_ENV: 'production',
        NEXTAUTH_URL: 'https://app.example.test',
        DLOCAL_API_KEY: 'test-api-key',
        DLOCAL_LOGIN: 'test-login',
        DLOCAL_SECRET_KEY: 'test-secret',
      };

      const freshFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'dlocal-payment-1',
          redirect_url: 'https://sandbox.dlocal.com/pay/1',
        }),
      });
      global.fetch = freshFetch as unknown as typeof fetch;

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const {
        createPayment: createPaymentFresh,
      } = require('./dlocal-payment.service');

      await createPaymentFresh({
        userId: 'user-789',
        amount: 29.0,
        currency: 'THB',
        country: 'TH',
        paymentMethod: 'TrueMoney',
        planType: 'MONTHLY',
      });

      expect(freshFetch).toHaveBeenCalledTimes(1);
      const [, requestInit] = freshFetch.mock.calls[0];
      const sentBody = JSON.parse(requestInit.body as string);
      expect(sentBody.payment_method_flow).toBe('REDIRECT');
    });

    it("sends the mapped dLocal code ('TM'), not the display name ('TrueMoney'), as payment_method_id (F76)", async () => {
      jest.resetModules();
      process.env = {
        ...ORIGINAL_ENV,
        NODE_ENV: 'production',
        NEXTAUTH_URL: 'https://app.example.test',
        DLOCAL_API_KEY: 'test-api-key',
        DLOCAL_LOGIN: 'test-login',
        DLOCAL_SECRET_KEY: 'test-secret',
      };

      const freshFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'dlocal-payment-2',
          redirect_url: 'https://sandbox.dlocal.com/pay/2',
        }),
      });
      global.fetch = freshFetch as unknown as typeof fetch;

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const {
        createPayment: createPaymentFresh,
      } = require('./dlocal-payment.service');

      await createPaymentFresh({
        userId: 'user-790',
        amount: 29.0,
        currency: 'THB',
        country: 'TH',
        paymentMethod: 'TrueMoney',
        planType: 'MONTHLY',
      });

      expect(freshFetch).toHaveBeenCalledTimes(1);
      const [, requestInit] = freshFetch.mock.calls[0];
      const sentBody = JSON.parse(requestInit.body as string);
      expect(sentBody.payment_method_id).toBe('TM');
      expect(sentBody.payment_method_id).not.toBe('TrueMoney');
    });

    it('throws before ever calling fetch when the payment method has no mapped dLocal code', async () => {
      jest.resetModules();
      process.env = {
        ...ORIGINAL_ENV,
        NODE_ENV: 'production',
        NEXTAUTH_URL: 'https://app.example.test',
        DLOCAL_API_KEY: 'test-api-key',
        DLOCAL_LOGIN: 'test-login',
        DLOCAL_SECRET_KEY: 'test-secret',
      };

      const freshFetch = jest.fn();
      global.fetch = freshFetch as unknown as typeof fetch;

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const {
        createPayment: createPaymentFresh,
      } = require('./dlocal-payment.service');

      await expect(
        createPaymentFresh({
          userId: 'user-791',
          amount: 29.0,
          currency: 'INR',
          country: 'IN',
          paymentMethod: 'Bitcoin',
          planType: 'MONTHLY',
        })
      ).rejects.toThrow(/No dLocal method code mapped/);

      expect(freshFetch).not.toHaveBeenCalled();
    });
  });

  describe('verifyWebhookSignature', () => {
    const testSecret = 'test-webhook-secret';
    const testXDate = '2026-07-24T09:23:38.899Z';
    const testXLogin = 'test-merchant-login';

    function sign(
      payload: string,
      xLogin = testXLogin,
      xDate = testXDate,
      secret = testSecret
    ): string {
      return crypto
        .createHmac('sha256', secret)
        .update(`${xLogin}${xDate}${payload}`)
        .digest('hex');
    }

    it('should verify valid webhook signature', () => {
      const payload = JSON.stringify({ id: 'payment-123', status: 'PAID' });
      const signature = sign(payload);

      const isValid = verifyWebhookSignature(
        payload,
        signature,
        testXDate,
        testXLogin,
        testSecret
      );
      expect(isValid).toBe(true);
    });

    it('should reject invalid webhook signature', () => {
      const payload = JSON.stringify({ id: 'payment-123', status: 'PAID' });
      const invalidSignature = 'invalid-signature-12345';

      const isValid = verifyWebhookSignature(
        payload,
        invalidSignature,
        testXDate,
        testXLogin,
        testSecret
      );
      expect(isValid).toBe(false);
    });

    it('should reject tampered payload', () => {
      const originalPayload = JSON.stringify({
        id: 'payment-123',
        status: 'PAID',
      });
      const signature = sign(originalPayload);

      const tamperedPayload = JSON.stringify({
        id: 'payment-123',
        status: 'REJECTED',
      });
      const isValid = verifyWebhookSignature(
        tamperedPayload,
        signature,
        testXDate,
        testXLogin,
        testSecret
      );
      expect(isValid).toBe(false);
    });

    it('should reject when X-Date or X-Login does not match what was signed', () => {
      const payload = JSON.stringify({ id: 'payment-123', status: 'PAID' });
      const signature = sign(payload);

      const isValid = verifyWebhookSignature(
        payload,
        signature,
        'wrong-date',
        testXLogin,
        testSecret
      );
      expect(isValid).toBe(false);
    });

    it('should handle empty payload', () => {
      const signature = sign('');
      const isValid = verifyWebhookSignature(
        '',
        signature,
        testXDate,
        testXLogin,
        testSecret
      );
      expect(isValid).toBe(true);
    });

    it('should return false for missing secret', () => {
      const payload = JSON.stringify({ id: 'payment-123' });
      const isValid = verifyWebhookSignature(
        payload,
        'any-signature',
        testXDate,
        testXLogin,
        ''
      );
      expect(isValid).toBe(false);
    });

    it('should return false for missing signature', () => {
      const payload = JSON.stringify({ id: 'payment-123' });
      const isValid = verifyWebhookSignature(
        payload,
        '',
        testXDate,
        testXLogin,
        testSecret
      );
      expect(isValid).toBe(false);
    });
  });

  describe('getPaymentStatus', () => {
    it('should return payment status in test mode', async () => {
      const status = await getPaymentStatus('mock-payment-123');

      expect(status.id).toBe('mock-payment-123');
      expect(status.status).toBeDefined();
    });
  });

  describe('mapDLocalStatus', () => {
    it('should map PAID to COMPLETED', () => {
      expect(mapDLocalStatus('PAID')).toBe('COMPLETED');
    });

    it('should map PENDING to PENDING', () => {
      expect(mapDLocalStatus('PENDING')).toBe('PENDING');
    });

    it('should map REJECTED to FAILED', () => {
      expect(mapDLocalStatus('REJECTED')).toBe('FAILED');
    });

    it('should map CANCELLED to CANCELLED', () => {
      expect(mapDLocalStatus('CANCELLED')).toBe('CANCELLED');
    });

    it('should map REFUNDED to REFUNDED', () => {
      expect(mapDLocalStatus('REFUNDED')).toBe('REFUNDED');
    });

    it('should map EXPIRED to FAILED', () => {
      expect(mapDLocalStatus('EXPIRED')).toBe('FAILED');
    });

    it('should map unknown status to PENDING', () => {
      expect(mapDLocalStatus('UNKNOWN_STATUS')).toBe('PENDING');
    });

    it('should handle all documented dLocal statuses', () => {
      const statusMappings: [string, PaymentStatus][] = [
        ['PENDING', 'PENDING'],
        ['PAID', 'COMPLETED'],
        ['AUTHORIZED', 'PENDING'],
        ['VERIFIED', 'PENDING'],
        ['COMPLETED', 'COMPLETED'],
        ['REJECTED', 'FAILED'],
        ['CANCELLED', 'CANCELLED'],
        ['REFUNDED', 'REFUNDED'],
        ['EXPIRED', 'FAILED'],
      ];

      statusMappings.forEach(([dLocalStatus, expectedStatus]) => {
        expect(mapDLocalStatus(dLocalStatus)).toBe(expectedStatus);
      });
    });
  });

  describe('extractUserIdFromOrderId', () => {
    it('should extract user ID from valid order ID', () => {
      const userId = extractUserIdFromOrderId('order-user123-1234567890');
      expect(userId).toBe('user123');
    });

    it('should handle complex user IDs', () => {
      const userId = extractUserIdFromOrderId('order-abc-xyz-123-9999999999');
      expect(userId).toBe('abc');
    });

    it('should return null for invalid order ID format', () => {
      expect(extractUserIdFromOrderId('invalid-format')).toBeNull();
      expect(extractUserIdFromOrderId('payment-123')).toBeNull();
      expect(extractUserIdFromOrderId('')).toBeNull();
    });

    it('should return null for order ID with missing parts', () => {
      expect(extractUserIdFromOrderId('order')).toBeNull();
      expect(extractUserIdFromOrderId('order-user')).toBeNull();
    });
  });

  describe('acquireCreatePaymentLock (Session 4A-9, File 5/10)', () => {
    beforeEach(() => {
      mockRedisSet.mockReset();
    });

    it('returns true (proceed) on the first attempt for a given key', async () => {
      mockRedisSet.mockResolvedValue('OK');

      const acquired = await acquireCreatePaymentLock(
        'user-1',
        'MONTHLY',
        'USD'
      );

      expect(acquired).toBe(true);
      expect(mockRedisSet).toHaveBeenCalledWith(
        'dlocal-create:user-1:MONTHLY:USD',
        '1',
        'EX',
        30,
        'NX'
      );
    });

    it('returns false (duplicate) when the key is already held', async () => {
      mockRedisSet.mockResolvedValue(null);

      const acquired = await acquireCreatePaymentLock(
        'user-1',
        'MONTHLY',
        'USD'
      );

      expect(acquired).toBe(false);
    });

    it('fails open (returns true) on a Redis error', async () => {
      mockRedisSet.mockRejectedValue(new Error('ECONNREFUSED'));

      const acquired = await acquireCreatePaymentLock(
        'user-1',
        'MONTHLY',
        'USD'
      );

      expect(acquired).toBe(true);
    });
  });
});
