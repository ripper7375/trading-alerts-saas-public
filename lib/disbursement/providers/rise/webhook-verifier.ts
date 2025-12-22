/**
 * RiseWorks Webhook Verifier (Part 19A)
 *
 * Verifies webhook signatures from RiseWorks using HMAC-SHA256.
 * The signature is provided in the x-rise-signature header.
 */

import crypto from 'crypto';

/**
 * Webhook verifier for RiseWorks webhooks
 */
export class WebhookVerifier {
  private readonly secret: string;

  /**
   * Create a new webhook verifier
   *
   * @param webhookSecret The shared secret for HMAC verification
   */
  constructor(webhookSecret: string) {
    if (!webhookSecret) {
      throw new Error('Webhook secret is required');
    }
    this.secret = webhookSecret;
  }

  /**
   * Verify a webhook signature
   *
   * @param payload Raw webhook payload string
   * @param signature Signature from x-rise-signature header
   * @returns true if signature is valid
   */
  verify(payload: string, signature: string): boolean {
    if (!signature || !payload) {
      return false;
    }

    try {
      const expectedSignature = this.computeSignature(payload);

      // Use timing-safe comparison to prevent timing attacks
      return this.timingSafeEqual(signature, expectedSignature);
    } catch {
      return false;
    }
  }

  /**
   * Compute the expected HMAC-SHA256 signature for a payload
   *
   * @param payload The payload to sign
   * @returns Hex-encoded HMAC signature
   */
  private computeSignature(payload: string): string {
    return crypto
      .createHmac('sha256', this.secret)
      .update(payload, 'utf8')
      .digest('hex');
  }

  /**
   * Timing-safe string comparison
   *
   * @param a First string
   * @param b Second string
   * @returns true if strings are equal
   */
  private timingSafeEqual(a: string, b: string): boolean {
    // Ensure both strings have the same length for timing-safe comparison
    if (a.length !== b.length) {
      return false;
    }

    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }

  /**
   * Create a signature for a payload (useful for testing)
   *
   * @param payload The payload to sign
   * @returns Hex-encoded HMAC signature
   */
  sign(payload: string): string {
    return this.computeSignature(payload);
  }
}

/**
 * Parse and validate webhook event data
 */
export interface ParsedWebhookEvent {
  eventType: string;
  teamId: string;
  timestamp: Date;
  data: Record<string, unknown>;
  isValid: boolean;
}

/**
 * Parse a webhook payload
 *
 * @param payload Raw webhook payload string
 * @returns Parsed webhook event
 */
export function parseWebhookPayload(payload: string): ParsedWebhookEvent {
  try {
    const parsed = JSON.parse(payload) as {
      event?: string;
      teamId?: string;
      timestamp?: string;
      data?: Record<string, unknown>;
    };

    return {
      eventType: parsed.event ?? 'unknown',
      teamId: parsed.teamId ?? '',
      timestamp: parsed.timestamp ? new Date(parsed.timestamp) : new Date(),
      data: parsed.data ?? {},
      isValid: !!parsed.event && !!parsed.teamId,
    };
  } catch {
    return {
      eventType: 'unknown',
      teamId: '',
      timestamp: new Date(),
      data: {},
      isValid: false,
    };
  }
}

/**
 * Extract signature from webhook headers
 *
 * @param headers Request headers (could be Headers, Record, or similar)
 * @returns Signature string or null if not found
 */
export function extractSignatureFromHeaders(
  headers: Record<string, string | string[] | undefined> | Headers
): string | null {
  // Handle Headers object (from fetch API)
  if (headers instanceof Headers) {
    return headers.get('x-rise-signature');
  }

  // Handle plain object
  const signature = headers['x-rise-signature'];

  if (typeof signature === 'string') {
    return signature;
  }

  if (Array.isArray(signature) && signature.length > 0) {
    return signature[0] ?? null;
  }

  return null;
}
