/**
 * Disbursement Constants for RiseWorks Payment System (Part 19)
 *
 * Contains all configuration constants, helper functions, and
 * default values for the disbursement system.
 */

import { DisbursementProvider } from '@/types/disbursement';

// Minimum payout threshold in USD
export const MINIMUM_PAYOUT_USD = 50.0;

// Maximum payments per batch
export const MAX_BATCH_SIZE = 100;

// RiseWorks amount conversion factor (USDC has 6 decimals)
export const RISE_AMOUNT_FACTOR = 1_000_000;

// Default currency
export const DEFAULT_CURRENCY = 'USD';

// Supported providers
export const SUPPORTED_PROVIDERS: DisbursementProvider[] = ['RISE', 'MOCK'];

/**
 * Get the default payment provider from environment
 */
export function getDefaultProvider(): DisbursementProvider {
  const envProvider = process.env['DISBURSEMENT_PROVIDER'];
  if (envProvider === 'RISE') {
    return 'RISE';
  }
  return 'MOCK';
}

// RiseWorks API URLs
export const RISE_API_URLS = {
  production: 'https://b2b-api.riseworks.io/v1',
  staging: 'https://b2b-api.staging-riseworks.io/v1',
} as const;

// Webhook event types
export const WEBHOOK_EVENT_TYPES = {
  INVITE_ACCEPTED: 'invite.accepted',
  FUND_RECEIVED: 'fund.received',
  PAYMENT_INITIATED: 'payment.initiated',
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
  ACCOUNT_DUPLICATION: 'account.duplication_detected',
} as const;

// Retry configuration
export const DEFAULT_RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
} as const;

// Transaction status that are considered final
export const FINAL_TRANSACTION_STATUSES = [
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;

// Transaction status that can be retried
export const RETRYABLE_TRANSACTION_STATUSES = ['FAILED'] as const;

/**
 * Convert USD amount to RiseWorks units (1e6)
 * @param usdAmount Amount in USD (e.g., 50.00)
 * @returns Amount in RiseWorks units (e.g., 50000000n)
 */
export function usdToRiseUnits(usdAmount: number): bigint {
  return BigInt(Math.round(usdAmount * RISE_AMOUNT_FACTOR));
}

/**
 * Convert RiseWorks units to USD
 * @param riseUnits Amount in RiseWorks units (e.g., 50000000n)
 * @returns Amount in USD (e.g., 50.00)
 */
export function riseUnitsToUsd(riseUnits: bigint): number {
  return Number(riseUnits) / RISE_AMOUNT_FACTOR;
}

/**
 * Validate if a provider string is a valid DisbursementProvider
 */
export function isValidProvider(
  provider: string
): provider is DisbursementProvider {
  return SUPPORTED_PROVIDERS.includes(provider as DisbursementProvider);
}

/**
 * Generate a unique batch number
 * Format: BATCH-YYYY-XXXXXXXX
 */
export function generateBatchNumber(): string {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString(36).toUpperCase();
  return `BATCH-${year}-${timestamp}`;
}

/**
 * Generate a unique transaction ID
 * Format: TXN-TIMESTAMP-RANDOM
 */
export function generateTransactionId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TXN-${timestamp}-${random}`;
}

/**
 * Check if an amount meets the minimum payout threshold
 */
export function meetsMinimumPayout(amount: number): boolean {
  return amount >= MINIMUM_PAYOUT_USD;
}

/**
 * Calculate delay for exponential backoff
 */
export function calculateBackoffDelay(
  attempt: number,
  config = DEFAULT_RETRY_CONFIG
): number {
  const delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(delay, config.maxDelay);
}

/**
 * Check if a transaction status is final (no more updates expected)
 */
export function isTransactionFinal(status: string): boolean {
  return FINAL_TRANSACTION_STATUSES.includes(
    status as (typeof FINAL_TRANSACTION_STATUSES)[number]
  );
}

/**
 * Check if a failed transaction can be retried
 */
export function canRetryTransaction(
  status: string,
  retryCount: number,
  maxAttempts = DEFAULT_RETRY_CONFIG.maxAttempts
): boolean {
  return (
    RETRYABLE_TRANSACTION_STATUSES.includes(
      status as (typeof RETRYABLE_TRANSACTION_STATUSES)[number]
    ) && retryCount < maxAttempts
  );
}
