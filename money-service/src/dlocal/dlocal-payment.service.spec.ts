/**
 * dLocal Payment Service Tests
 *
 * Ported from __tests__/lib/dlocal/dlocal-payment.test.ts (Session 4A-4,
 * File 4/4). Assertions unchanged (parity oracle) — only the import path
 * changed (free functions, no DI, so no NestJS testing module needed).
 */
import crypto from 'crypto';

import {
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
});
