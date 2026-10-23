/**
 * Disbursement Constants for RiseWorks Payment System (Part 19)
 *
 * Ported byte-for-byte from lib/disbursement/constants.ts (Session 4A-2,
 * File 3/6). Contains all configuration constants, helper functions, and
 * default values for the disbursement system.
 */

import crypto from 'crypto';

import { DisbursementProvider } from './disbursement.types';

// Minimum payout threshold in USD — default; runtime value comes from
// SystemConfig `disbursement_minimum_payout_usd` via settings
// (disbursement-settings.constants.ts, DECISION-LOG F83)
export const MINIMUM_PAYOUT_USD = 50.0;

// Maximum payments per batch — default; runtime value comes from
// SystemConfig `disbursement_max_batch_size` via settings
// (disbursement-settings.constants.ts, DECISION-LOG F83)
export const MAX_BATCH_SIZE = 100;

// RiseWorks amount conversion factor (USDC has 6 decimals)
export const RISE_AMOUNT_FACTOR = 1_000_000;

// Default currency
export const DEFAULT_CURRENCY = 'USD';

// Supported providers
export const SUPPORTED_PROVIDERS: DisbursementProvider[] = [
  'RISE',
  'MOCK',
  'WISE',
];

/**
 * Thrown when the payout provider is not configured for the environment.
 * Refusing happens at use, never at boot: a service that refuses to start would
 * also stop checkout and webhooks (CODE-03, D-9).
 */
export class DisbursementConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DisbursementConfigError';
  }
}

/**
 * Body of the 503 that a money-moving route answers with when the payout
 * provider is not configured. Fixed text: the cause stays in the server log.
 */
export const DISBURSEMENT_NOT_CONFIGURED_BODY = {
  error: 'Disbursement is not configured',
} as const;

/**
 * The mock provider exists only in development and test. Only NODE_ENV decides:
 * on Vercel Preview NODE_ENV is "production", so Preview is refused too.
 */
export function isMockProviderAllowed(): boolean {
  const env = process.env['NODE_ENV'];
  return env === 'development' || env === 'test';
}

/**
 * Get the default payment provider from environment.
 *
 * Fails closed: outside development and test an unset, MOCK or unknown
 * DISBURSEMENT_PROVIDER throws a DisbursementConfigError instead of silently
 * falling back to the mock provider.
 */
export function getDefaultProvider(): DisbursementProvider {
  const envProvider = (process.env['DISBURSEMENT_PROVIDER'] ?? '')
    .trim()
    .toUpperCase();
  if (envProvider === 'RISE') {
    return 'RISE';
  }
  if (envProvider === 'WISE') {
    return 'WISE';
  }
  if (isMockProviderAllowed()) {
    return 'MOCK';
  }
  throw new DisbursementConfigError(
    'DISBURSEMENT_PROVIDER must be set to a real provider outside development and test'
  );
}

/**
 * The configured provider for displays (health, settings, admin header).
 * Never throws: an unconfigured provider is reported as 'UNCONFIGURED'.
 */
export function getConfiguredProviderName():
  | DisbursementProvider
  | 'UNCONFIGURED' {
  try {
    return getDefaultProvider();
  } catch {
    return 'UNCONFIGURED';
  }
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

// Retry configuration (engineering setting, not admin-editable — F83 scope)
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
 * Generate a unique batch number using cryptographically secure random
 * Format: BATCH-YYYY-TIMESTAMPRANDOM
 */
export function generateBatchNumber(): string {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `BATCH-${year}-${timestamp}${random}`;
}

/**
 * Generate a unique transaction ID using cryptographically secure random
 * Format: TXN-TIMESTAMP-RANDOM
 */
export function generateTransactionId(): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
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
  const delay =
    config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
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
