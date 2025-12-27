/**
 * Tests for RiseWorks Webhook Verifier (Part 19A)
 */

import crypto from 'crypto';
import {
  WebhookVerifier,
  parseWebhookPayload,
  extractSignatureFromHeaders,
} from '@/lib/disbursement/providers/rise/webhook-verifier';

describe('WebhookVerifier', () => {
  const testSecret = 'test-webhook-secret-12345';
  let verifier: WebhookVerifier;

  beforeEach(() => {
    verifier = new WebhookVerifier(testSecret);
  });

  describe('constructor', () => {
    it('should create verifier with secret', () => {
      expect(() => new WebhookVerifier('valid-secret')).not.toThrow();
    });

    it('should throw error for empty secret', () => {
      expect(() => new WebhookVerifier('')).toThrow(
        'Webhook secret is required'
      );
    });
  });

  describe('verify', () => {
    it('should verify valid signature', () => {
      const payload = JSON.stringify({
        event: 'payment.completed',
        teamId: 'team-123',
        timestamp: new Date().toISOString(),
        data: { transactionId: 'txn-456' },
      });

      const signature = crypto
        .createHmac('sha256', testSecret)
        .update(payload, 'utf8')
        .digest('hex');

      expect(verifier.verify(payload, signature)).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = JSON.stringify({ event: 'payment.completed' });
      const invalidSignature = 'invalid-signature-that-does-not-match';

      expect(verifier.verify(payload, invalidSignature)).toBe(false);
    });

    it('should reject tampered payload', () => {
      const originalPayload = JSON.stringify({ event: 'payment.completed' });
      const signature = crypto
        .createHmac('sha256', testSecret)
        .update(originalPayload, 'utf8')
        .digest('hex');

      const tamperedPayload = JSON.stringify({ event: 'payment.failed' });

      expect(verifier.verify(tamperedPayload, signature)).toBe(false);
    });

    it('should reject empty payload', () => {
      expect(verifier.verify('', 'some-signature')).toBe(false);
    });

    it('should reject empty signature', () => {
      expect(verifier.verify('some-payload', '')).toBe(false);
    });

    it('should reject null/undefined values', () => {
      // @ts-expect-error Testing null input
      expect(verifier.verify(null, 'signature')).toBe(false);
      // @ts-expect-error Testing undefined input
      expect(verifier.verify('payload', undefined)).toBe(false);
    });

    it('should handle special characters in payload', () => {
      const payload = JSON.stringify({
        event: 'payment.completed',
        data: {
          memo: 'Payment for services: $100.00 @ 5% discount',
          emoji: '💰',
          unicode: 'Test Ünïcödé',
        },
      });

      const signature = crypto
        .createHmac('sha256', testSecret)
        .update(payload, 'utf8')
        .digest('hex');

      expect(verifier.verify(payload, signature)).toBe(true);
    });

    it('should be case-sensitive for signatures', () => {
      const payload = 'test-payload';
      const signature = crypto
        .createHmac('sha256', testSecret)
        .update(payload, 'utf8')
        .digest('hex');

      const uppercaseSignature = signature.toUpperCase();

      // Original should work
      expect(verifier.verify(payload, signature)).toBe(true);

      // Uppercase should fail (signatures are lowercase hex)
      expect(verifier.verify(payload, uppercaseSignature)).toBe(false);
    });
  });

  describe('sign', () => {
    it('should create valid signature that can be verified', () => {
      const payload = JSON.stringify({ event: 'test.event' });
      const signature = verifier.sign(payload);

      expect(verifier.verify(payload, signature)).toBe(true);
    });

    it('should create consistent signatures for same payload', () => {
      const payload = 'consistent-payload';
      const sig1 = verifier.sign(payload);
      const sig2 = verifier.sign(payload);

      expect(sig1).toBe(sig2);
    });

    it('should create different signatures for different payloads', () => {
      const sig1 = verifier.sign('payload-1');
      const sig2 = verifier.sign('payload-2');

      expect(sig1).not.toBe(sig2);
    });
  });

  describe('timing safety', () => {
    it('should use timing-safe comparison', () => {
      // This test verifies the implementation uses crypto.timingSafeEqual
      // We can't directly test timing, but we verify it handles edge cases
      const payload = 'test-payload';
      const signature = verifier.sign(payload);

      // Should work with exact match
      expect(verifier.verify(payload, signature)).toBe(true);

      // Should fail with different length strings
      expect(verifier.verify(payload, signature + 'extra')).toBe(false);
      expect(verifier.verify(payload, signature.substring(0, 10))).toBe(false);
    });
  });
});

describe('parseWebhookPayload', () => {
  it('should parse valid webhook payload', () => {
    const payload = JSON.stringify({
      event: 'payment.completed',
      teamId: 'team-123',
      timestamp: '2025-01-15T10:30:00Z',
      data: { transactionId: 'txn-456', amount: 50000000 },
    });

    const parsed = parseWebhookPayload(payload);

    expect(parsed.isValid).toBe(true);
    expect(parsed.eventType).toBe('payment.completed');
    expect(parsed.teamId).toBe('team-123');
    expect(parsed.timestamp).toEqual(new Date('2025-01-15T10:30:00Z'));
    expect(parsed.data).toEqual({ transactionId: 'txn-456', amount: 50000000 });
  });

  it('should handle missing event', () => {
    const payload = JSON.stringify({
      teamId: 'team-123',
      data: {},
    });

    const parsed = parseWebhookPayload(payload);

    expect(parsed.isValid).toBe(false);
    expect(parsed.eventType).toBe('unknown');
  });

  it('should handle missing teamId', () => {
    const payload = JSON.stringify({
      event: 'payment.completed',
      data: {},
    });

    const parsed = parseWebhookPayload(payload);

    expect(parsed.isValid).toBe(false);
    expect(parsed.teamId).toBe('');
  });

  it('should handle invalid JSON', () => {
    const payload = 'not-valid-json{{{';

    const parsed = parseWebhookPayload(payload);

    expect(parsed.isValid).toBe(false);
    expect(parsed.eventType).toBe('unknown');
  });

  it('should handle empty payload', () => {
    const parsed = parseWebhookPayload('');

    expect(parsed.isValid).toBe(false);
  });

  it('should use current date when timestamp is missing', () => {
    const before = Date.now();
    const payload = JSON.stringify({
      event: 'payment.completed',
      teamId: 'team-123',
    });

    const parsed = parseWebhookPayload(payload);
    const after = Date.now();

    expect(parsed.timestamp.getTime()).toBeGreaterThanOrEqual(before);
    expect(parsed.timestamp.getTime()).toBeLessThanOrEqual(after);
  });

  it('should default data to empty object', () => {
    const payload = JSON.stringify({
      event: 'payment.completed',
      teamId: 'team-123',
    });

    const parsed = parseWebhookPayload(payload);

    expect(parsed.data).toEqual({});
  });
});

describe('extractSignatureFromHeaders', () => {
  it('should extract signature from plain object headers', () => {
    const headers = {
      'x-rise-signature': 'abc123signature',
      'content-type': 'application/json',
    };

    const signature = extractSignatureFromHeaders(headers);
    expect(signature).toBe('abc123signature');
  });

  it('should extract signature from array header value', () => {
    const headers = {
      'x-rise-signature': ['abc123signature', 'extra-value'],
    };

    const signature = extractSignatureFromHeaders(headers);
    expect(signature).toBe('abc123signature');
  });

  it('should return null when signature header is missing', () => {
    const headers = {
      'content-type': 'application/json',
    };

    const signature = extractSignatureFromHeaders(headers);
    expect(signature).toBeNull();
  });

  it('should return null for undefined header value', () => {
    const headers = {
      'x-rise-signature': undefined,
    };

    const signature = extractSignatureFromHeaders(headers);
    expect(signature).toBeNull();
  });

  it('should return null for empty array header', () => {
    const headers = {
      'x-rise-signature': [],
    };

    const signature = extractSignatureFromHeaders(headers);
    expect(signature).toBeNull();
  });

  it('should extract signature from Headers object', () => {
    const headers = new Headers();
    headers.set('x-rise-signature', 'abc123signature');

    const signature = extractSignatureFromHeaders(headers);
    expect(signature).toBe('abc123signature');
  });

  it('should return null when Headers object has no signature', () => {
    const headers = new Headers();
    headers.set('content-type', 'application/json');

    const signature = extractSignatureFromHeaders(headers);
    expect(signature).toBeNull();
  });
});
