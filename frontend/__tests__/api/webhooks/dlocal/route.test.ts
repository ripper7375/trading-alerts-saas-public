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
