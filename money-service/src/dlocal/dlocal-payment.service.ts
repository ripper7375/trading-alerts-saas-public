/**
 * dLocal Payment Service
 *
 * Ported byte-for-byte from lib/dlocal/dlocal-payment.service.ts (Session
 * 4A-4, File 2/4). Kept as plain exported functions (not an `@Injectable`)
 * — no PrismaService/DI dependency in the source, only `crypto`/`fetch`/
 * `process.env`, same as `webhook-verifier.ts`'s own treatment.
 *
 * Handles payment creation, webhook verification, and status retrieval
 * for dLocal payment processing.
 */

import crypto from 'crypto';

import Redis from 'ioredis';

import { logger } from '../common/logger.util';
import { MONEY_KEY_PREFIX } from '../queue/queue.constants';

import type {
  DLocalPaymentRequest,
  DLocalPaymentResponse,
  PaymentStatus,
} from './dlocal.types';

const DLOCAL_API_URL =
  process.env['DLOCAL_API_URL'] || 'https://sandbox.dlocal.com';
const DLOCAL_LOGIN =
  process.env['DLOCAL_LOGIN'] || process.env['DLOCAL_API_KEY'] || '';
const DLOCAL_API_KEY = process.env['DLOCAL_API_KEY'] || '';
const DLOCAL_SECRET_KEY = process.env['DLOCAL_SECRET_KEY'] || '';
const DLOCAL_WEBHOOK_SECRET = process.env['DLOCAL_WEBHOOK_SECRET'] || '';

/** 30s: absorbs a double-click/client retry without blocking a deliberate later attempt. */
const CREATE_PAYMENT_IDEMPOTENCY_TTL_SECONDS = 30;

let lockRedisClient: Redis | null = null;

function getLockRedisClient(): Redis {
  if (!lockRedisClient) {
    lockRedisClient = new Redis(
      process.env['REDIS_URL'] ?? 'redis://localhost:6379',
      { keyPrefix: `${MONEY_KEY_PREFIX}idempotency:` }
    );
  }
  return lockRedisClient;
}

/**
 * Idempotency guard for payment creation (Session 4A-9, File 5/10 --
 * ported from lib/dlocal/dlocal-payment.service.ts's own 4A-8 addition,
 * lib/idempotency/idempotency-guard.ts's Redis SET-NX-EX + fail-open
 * logic inlined here since money-service has no equivalent shared
 * helper). Returns `true` the first time this exact
 * (userId, planType, currency) combination is seen within the window --
 * the caller should proceed. Returns `false` on every duplicate within
 * the window -- the caller must NOT create a second Payment row or call
 * dLocal again. Fails open (returns `true`) on a Redis error -- a dedupe
 * guard must never be the reason a legitimate payment can't go through.
 */
export async function acquireCreatePaymentLock(
  userId: string,
  planType: string,
  currency: string
): Promise<boolean> {
  const key = `dlocal-create:${userId}:${planType}:${currency}`;
  try {
    const result = await getLockRedisClient().set(
      key,
      '1',
      'EX',
      CREATE_PAYMENT_IDEMPOTENCY_TTL_SECONDS,
      'NX'
    );
    return result === 'OK';
  } catch (error) {
    logger.error('[Idempotency] Redis lock check failed, failing open', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return true;
  }
}

/**
 * Generates a unique order ID
 */
function generateOrderId(userId: string): string {
  return `order-${userId}-${Date.now()}`;
}

/**
 * Creates a payment with dLocal
 */
export async function createPayment(
  request: DLocalPaymentRequest
): Promise<DLocalPaymentResponse> {
  const orderId = generateOrderId(request.userId);

  try {
    const requestBody = {
      amount: request.amount,
      currency: request.currency,
      country: request.country,
      payment_method_id: request.paymentMethod,
      order_id: orderId,
      notification_url: `${process.env['NEXTAUTH_URL']}/api/webhooks/dlocal`,
      payer: {
        name: request.name || 'User',
        email: request.email || 'user@example.com',
      },
    };

    const body = JSON.stringify(requestBody);

    logger.info('Creating dLocal payment', {
      orderId,
      country: request.country,
    });

    // In production, this would call the dLocal API
    // For development/testing, we simulate a response
    if (process.env['NODE_ENV'] === 'test' || !DLOCAL_API_KEY) {
      logger.info('Using mock dLocal response (test mode)', { orderId });
      return {
        paymentId: `mock-payment-${Date.now()}`,
        orderId,
        paymentUrl: `https://sandbox.dlocal.com/pay/mock-${Date.now()}`,
        status: 'PENDING' as PaymentStatus,
        amount: request.amount,
        currency: request.currency,
      };
    }

    const dateStr = new Date().toISOString();
    const signatureInput = `${DLOCAL_LOGIN}${dateStr}${body}`;
    const requestSignature = crypto
      .createHmac('sha256', DLOCAL_SECRET_KEY)
      .update(signatureInput)
      .digest('hex');

    const response = await fetch(`${DLOCAL_API_URL}/payments`, {
      method: 'POST',
      headers: {
        'X-Date': dateStr,
        'X-Login': DLOCAL_LOGIN,
        'X-Trans-Key': DLOCAL_API_KEY,
        'Content-Type': 'application/json',
        Authorization: `V2-HMAC-SHA256, Signature: ${requestSignature}`,
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('dLocal API error', {
        status: response.status,
        error: errorText,
      });
      throw new Error('Failed to create payment');
    }

    const data = await response.json();

    logger.info('dLocal payment created', { paymentId: data.id, orderId });

    return {
      paymentId: data.id || `dlocal-${Date.now()}`,
      orderId,
      paymentUrl:
        data.redirect_url || `https://sandbox.dlocal.com/payment/${data.id}`,
      status: 'PENDING' as PaymentStatus,
      amount: request.amount,
      currency: request.currency,
    };
  } catch (error) {
    logger.error('Failed to create dLocal payment', {
      error: error instanceof Error ? error.message : 'Unknown error',
      orderId,
    });
    throw error;
  }
}

/**
 * Verifies webhook signature from dLocal.
 *
 * dLocal signs notification requests the same way it signs outbound API
 * requests: HMAC-SHA256 over the concatenation of X-Login + X-Date + raw
 * body, using the merchant secret key. The signature arrives in the
 * Authorization header as "V2-HMAC-SHA256, Signature: <hex>" — the caller
 * is expected to have already parsed out just the hex digest.
 *
 * Secret precedence: DLOCAL_SECRET_KEY (the same key used for outbound
 * signing, per dLocal's docs — there is no separate webhook secret),
 * falling back to DLOCAL_WEBHOOK_SECRET if a caller-supplied `secret` and
 * DLOCAL_SECRET_KEY are both unset. Confirmed with Davin 2026-07-24.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  xDate?: string,
  xLogin?: string,
  secret?: string
): boolean {
  const webhookSecret = secret || DLOCAL_SECRET_KEY || DLOCAL_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.warn('No webhook secret configured');
    return false;
  }

  if (!signature) {
    logger.warn('No signature provided on webhook request');
    return false;
  }

  const signedString = `${xLogin ?? ''}${xDate ?? ''}${payload}`;

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(signedString)
    .digest('hex');

  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  const receivedBuffer = Buffer.from(signature, 'hex');
  const isValid =
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

  if (!isValid) {
    logger.warn('Webhook signature mismatch', {
      expectedPrefix: expectedSignature.substring(0, 10),
      receivedPrefix: signature.substring(0, 10),
    });
  }

  return isValid;
}

/**
 * Gets payment status from dLocal
 */
export async function getPaymentStatus(paymentId: string): Promise<{
  id: string;
  status: string;
  amount?: number;
  currency?: string;
}> {
  try {
    // In test mode, return mock status
    if (process.env['NODE_ENV'] === 'test' || !DLOCAL_API_KEY) {
      return {
        id: paymentId,
        status: 'PENDING',
        amount: 29.0,
        currency: 'USD',
      };
    }

    const response = await fetch(`${DLOCAL_API_URL}/payments/${paymentId}`, {
      headers: {
        'X-Date': new Date().toISOString(),
        'X-Login': DLOCAL_API_KEY,
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DLOCAL_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get payment status: ${response.status}`);
    }

    const data = await response.json();

    return {
      id: data.id,
      status: data.status,
      amount: data.amount,
      currency: data.currency,
    };
  } catch (error) {
    logger.error('Failed to get payment status', {
      paymentId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Maps dLocal status to our internal payment status
 */
export function mapDLocalStatus(dLocalStatus: string): PaymentStatus {
  const statusMap: Record<string, PaymentStatus> = {
    PENDING: 'PENDING',
    PAID: 'COMPLETED',
    AUTHORIZED: 'PENDING',
    VERIFIED: 'PENDING',
    COMPLETED: 'COMPLETED',
    REJECTED: 'FAILED',
    CANCELLED: 'CANCELLED',
    REFUNDED: 'REFUNDED',
    EXPIRED: 'FAILED',
  };

  return statusMap[dLocalStatus] || 'PENDING';
}

/**
 * Extracts user ID from order ID
 * Order ID format: order-{userId}-{timestamp}
 */
export function extractUserIdFromOrderId(orderId: string): string | null {
  const parts = orderId.split('-');
  if (parts.length >= 3 && parts[0] === 'order') {
    return parts[1] ?? null;
  }
  return null;
}
