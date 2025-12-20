/**
 * dLocal Payment Service
 *
 * Handles payment creation, webhook verification, and status retrieval
 * for dLocal payment processing.
 */

import crypto from 'crypto';
import type { DLocalPaymentRequest, DLocalPaymentResponse, PaymentStatus } from '@/types/dlocal';
import { logger } from '@/lib/logger';

const DLOCAL_API_URL = process.env['DLOCAL_API_URL'] || 'https://sandbox.dlocal.com';
const DLOCAL_API_KEY = process.env['DLOCAL_API_KEY'] || '';
const DLOCAL_SECRET_KEY = process.env['DLOCAL_SECRET_KEY'] || '';
const DLOCAL_WEBHOOK_SECRET = process.env['DLOCAL_WEBHOOK_SECRET'] || '';

/**
 * Generates HMAC signature for dLocal API requests
 */
function generateSignature(body: string): string {
  return crypto.createHmac('sha256', DLOCAL_SECRET_KEY).update(body).digest('hex');
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
    const signature = generateSignature(body);

    logger.info('Creating dLocal payment', { orderId, country: request.country });

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

    const response = await fetch(`${DLOCAL_API_URL}/payments`, {
      method: 'POST',
      headers: {
        'X-Date': new Date().toISOString(),
        'X-Login': DLOCAL_API_KEY,
        'X-Trans-Key': signature,
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DLOCAL_API_KEY}`,
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('dLocal API error', { status: response.status, error: errorText });
      throw new Error('Failed to create payment');
    }

    const data = await response.json();

    logger.info('dLocal payment created', { paymentId: data.id, orderId });

    return {
      paymentId: data.id || `dlocal-${Date.now()}`,
      orderId,
      paymentUrl: data.redirect_url || `https://sandbox.dlocal.com/payment/${data.id}`,
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
 * Verifies webhook signature from dLocal
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret?: string
): boolean {
  const webhookSecret = secret || DLOCAL_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.warn('No webhook secret configured');
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');

  const isValid = signature === expectedSignature;

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
