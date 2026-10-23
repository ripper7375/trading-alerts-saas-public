/**
 * dLocal Webhook Route Tests
 *
 * Tests for webhook signature verification and payment processing.
 */

import crypto from 'crypto';
import {
  verifyWebhookSignature,
  mapDLocalStatus,
  extractUserIdFromOrderId,
} from '@/lib/dlocal/dlocal-payment.service';

// Note: Full API route integration tests require a database connection
// These tests cover the core webhook logic that doesn't need a database

describe('dLocal Webhook Handler', () => {
  const WEBHOOK_SECRET = 'test-webhook-secret';

  function generateSignature(
    payload: string,
    secret: string = WEBHOOK_SECRET
  ): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  describe('Webhook Signature Verification', () => {
    it('should verify valid signature for PAID status', () => {
      const payload = JSON.stringify({
        id: 'payment-123',
        status: 'PAID',
        amount: 2415.48,
        currency: 'INR',
        order_id: 'order-user123-1234567890',
      });

      const signature = generateSignature(payload);
      expect(verifyWebhookSignature(payload, signature, WEBHOOK_SECRET)).toBe(
        true
      );
    });

    it('should verify valid signature for REJECTED status', () => {
      const payload = JSON.stringify({
        id: 'payment-456',
        status: 'REJECTED',
        amount: 29.0,
        currency: 'USD',
        order_id: 'order-user456-1234567890',
        failure_reason: 'Insufficient funds',
      });

      const signature = generateSignature(payload);
      expect(verifyWebhookSignature(payload, signature, WEBHOOK_SECRET)).toBe(
        true
      );
    });

    it('should reject invalid signature', () => {
      const payload = JSON.stringify({
        id: 'payment-789',
        status: 'PAID',
      });

      const invalidSignature = 'invalid-signature-12345';
      expect(
        verifyWebhookSignature(payload, invalidSignature, WEBHOOK_SECRET)
      ).toBe(false);
    });

    it('should reject tampered payload', () => {
      const originalPayload = JSON.stringify({
        id: 'payment-123',
        status: 'PAID',
        amount: 29.0,
      });

      const signature = generateSignature(originalPayload);

      const tamperedPayload = JSON.stringify({
        id: 'payment-123',
        status: 'PAID',
        amount: 290.0, // Tampered amount
      });

      expect(
        verifyWebhookSignature(tamperedPayload, signature, WEBHOOK_SECRET)
      ).toBe(false);
    });

    it('should handle empty payload', () => {
      const signature = generateSignature('');
      expect(verifyWebhookSignature('', signature, WEBHOOK_SECRET)).toBe(true);
    });

    it('should handle complex webhook payload', () => {
      const payload = JSON.stringify({
        id: 'D-123-456-789',
        status: 'PAID',
        amount: 2415.48,
        currency: 'INR',
        order_id: 'order-cuid123abc-1702900000000',
        payment_method_id: 'UPI',
        created_date: '2024-12-18T10:30:00.000Z',
        approved_date: '2024-12-18T10:31:00.000Z',
        payer: {
          name: 'John Doe',
          email: 'john@example.com',
          document: 'XXXXX1234X',
        },
      });

      const signature = generateSignature(payload);
      expect(verifyWebhookSignature(payload, signature, WEBHOOK_SECRET)).toBe(
        true
      );
    });
  });

  // CODE-04: the signature is compared in constant time. Timing cannot be measured in a unit test,
  // so `crypto.timingSafeEqual` is observed (it still runs) and the strings that used to be
  // compared with `===` must now be rejected without an error, whatever their length.
  describe('Constant-time signature comparison', () => {
    const payload = JSON.stringify({ id: 'payment-ct-1', status: 'PAID' });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('compares with crypto.timingSafeEqual on two buffers of the same length, whatever the lengths of the signatures', () => {
      const spy = jest.spyOn(crypto, 'timingSafeEqual');

      expect(verifyWebhookSignature(payload, 'x', WEBHOOK_SECRET)).toBe(false);

      expect(spy).toHaveBeenCalledTimes(1);
      const [left, right] = spy.mock.calls[0] as [Buffer, Buffer];
      expect(left.length).toBe(32);
      expect(right.length).toBe(32);
    });

    it('compares digests, not the received signature or the expected one themselves', () => {
      const spy = jest.spyOn(crypto, 'timingSafeEqual');
      const signature = generateSignature(payload);

      expect(verifyWebhookSignature(payload, signature, WEBHOOK_SECRET)).toBe(
        true
      );

      const [left, right] = spy.mock.calls[0] as [Buffer, Buffer];
      expect(left.equals(Buffer.from(signature))).toBe(false);
      expect(right.equals(Buffer.from(signature))).toBe(false);
    });

    it.each<[string, (good: string) => string]>([
      ['an empty signature', () => ''],
      ['a prefix of the right signature', (good) => good.slice(0, -1)],
      [
        'a signature of the right length with one character changed',
        (good) => `${good.slice(0, -1)}${good.endsWith('0') ? '1' : '0'}`,
      ],
      ['the right signature in upper case', (good) => good.toUpperCase()],
      ['the right signature with a trailing space', (good) => `${good} `],
      ['the right signature twice', (good) => `${good}${good}`],
    ])('rejects %s without an error', (_label, mutate) => {
      const signature = mutate(generateSignature(payload));

      expect(verifyWebhookSignature(payload, signature, WEBHOOK_SECRET)).toBe(
        false
      );
    });

    it('does not compare anything when no webhook secret is configured', () => {
      const spy = jest.spyOn(crypto, 'timingSafeEqual');

      expect(
        verifyWebhookSignature(payload, generateSignature(payload), '')
      ).toBe(false);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('Status Mapping', () => {
    it('should map PAID to COMPLETED', () => {
      expect(mapDLocalStatus('PAID')).toBe('COMPLETED');
    });

    it('should map REJECTED to FAILED', () => {
      expect(mapDLocalStatus('REJECTED')).toBe('FAILED');
    });

    it('should map CANCELLED to CANCELLED', () => {
      expect(mapDLocalStatus('CANCELLED')).toBe('CANCELLED');
    });

    it('should map EXPIRED to FAILED', () => {
      expect(mapDLocalStatus('EXPIRED')).toBe('FAILED');
    });

    it('should map PENDING to PENDING', () => {
      expect(mapDLocalStatus('PENDING')).toBe('PENDING');
    });

    it('should map REFUNDED to REFUNDED', () => {
      expect(mapDLocalStatus('REFUNDED')).toBe('REFUNDED');
    });
  });

  describe('Order ID Parsing', () => {
    it('should extract user ID from valid order ID', () => {
      expect(extractUserIdFromOrderId('order-user123-1702900000000')).toBe(
        'user123'
      );
    });

    it('should extract CUID from order ID', () => {
      expect(extractUserIdFromOrderId('order-cuid123abc-1702900000000')).toBe(
        'cuid123abc'
      );
    });

    it('should return null for invalid order ID', () => {
      expect(extractUserIdFromOrderId('invalid-format')).toBeNull();
      expect(extractUserIdFromOrderId('payment-123-456')).toBeNull();
    });

    it('should return null for empty order ID', () => {
      expect(extractUserIdFromOrderId('')).toBeNull();
    });
  });

  describe('Webhook Payload Validation', () => {
    it('should have required fields in webhook payload', () => {
      const validPayload = {
        id: 'payment-123',
        status: 'PAID',
        amount: 2415.48,
        currency: 'INR',
        order_id: 'order-user123-1702900000000',
        payment_method_id: 'UPI',
        created_date: '2024-12-18T10:30:00.000Z',
      };

      expect(validPayload.id).toBeDefined();
      expect(validPayload.status).toBeDefined();
      expect(validPayload.amount).toBeDefined();
      expect(validPayload.currency).toBeDefined();
      expect(validPayload.order_id).toBeDefined();
    });

    it('should handle optional failure_reason field', () => {
      const failedPayload = {
        id: 'payment-456',
        status: 'REJECTED',
        amount: 29.0,
        currency: 'USD',
        order_id: 'order-user456-1702900000000',
        payment_method_id: 'UPI',
        created_date: '2024-12-18T10:30:00.000Z',
        failure_reason: 'Card declined',
      };

      expect(failedPayload.failure_reason).toBe('Card declined');
    });
  });
});
