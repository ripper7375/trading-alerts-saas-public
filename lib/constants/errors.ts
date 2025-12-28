/**
 * Centralized Error Message Constants
 *
 * Single source of truth for all error messages across the application.
 * Both implementation code and tests should import from this module
 * to ensure consistency and prevent test/implementation drift.
 */

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// API ERROR MESSAGES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const ERROR_MESSAGES = {
  // Authentication errors
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
  SESSION_EXPIRED: 'Session expired',

  // MT5 Service errors
  MT5_SERVICE: 'MT5 service error',
  MT5_SERVICE_UNAVAILABLE: 'MT5 service unavailable',
  MT5_CONNECTION_FAILED: 'Failed to connect to MT5 service',

  // Validation errors
  VALIDATION_ERROR: 'Validation error',
  INVALID_SYMBOL: 'Invalid symbol',
  INVALID_TIMEFRAME: 'Invalid timeframe',
  INVALID_REQUEST: 'Invalid request',

  // Tier restriction errors
  TIER_RESTRICTION: 'Tier restriction',
  TIER_UPGRADE_REQUIRED: 'Upgrade required',
  PRO_TIER_REQUIRED: 'PRO tier required',

  // Rate limiting errors
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',

  // Generic errors
  INTERNAL_SERVER: 'Internal server error',
  NOT_FOUND: 'Not found',
  BAD_REQUEST: 'Bad request',
} as const;

export type ErrorMessage = (typeof ERROR_MESSAGES)[keyof typeof ERROR_MESSAGES];

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DETAILED ERROR MESSAGES (for user-facing responses)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const ERROR_DETAILS = {
  MT5_SERVICE_FAILURE:
    'Failed to fetch indicator data from MT5 service. Please try again later.',
  UNEXPECTED_ERROR: 'An unexpected error occurred. Please try again later.',
  TIER_SYMBOL_DENIED: 'Symbol requires PRO tier. Upgrade to access all symbols.',
  TIER_TIMEFRAME_DENIED:
    'Timeframe requires PRO tier. Upgrade to access all timeframes.',
  RATE_LIMIT_MESSAGE: 'Too many requests. Please wait before trying again.',
} as const;

export type ErrorDetail = (typeof ERROR_DETAILS)[keyof typeof ERROR_DETAILS];

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ERROR DETECTION UTILITIES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Type guard for MT5ServiceError that works with both runtime and Jest mocks.
 *
 * Jest mocks create different class instances, causing instanceof checks to fail.
 * This utility checks multiple indicators to reliably detect MT5ServiceError.
 */
export function isMT5ServiceError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  // Check 1: Direct instanceof (works in production)
  // Note: We check constructor.name since the actual class might not be importable here
  const constructorName = (error as Error).constructor?.name;
  if (constructorName === 'MT5ServiceError') return true;

  // Check 2: Property-based detection (works with Jest mocks)
  if (error instanceof Error) {
    const hasStatusCode =
      'statusCode' in error &&
      typeof (error as { statusCode?: unknown }).statusCode === 'number';
    const hasResponseBody = 'responseBody' in error;

    // MT5ServiceError has statusCode; if it also has responseBody, it's very likely
    if (hasStatusCode) return true;
    if (hasStatusCode && hasResponseBody) return true;
  }

  return false;
}

/**
 * Type guard for MT5AccessDeniedError that works with both runtime and Jest mocks.
 */
export function isMT5AccessDeniedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  // Check 1: Constructor name
  const constructorName = (error as Error).constructor?.name;
  if (constructorName === 'MT5AccessDeniedError') return true;

  // Check 2: Property-based detection
  if (error instanceof Error) {
    const hasTier =
      'tier' in error &&
      typeof (error as { tier?: unknown }).tier === 'string';
    const hasAccessibleSymbols = 'accessibleSymbols' in error;
    const hasAccessibleTimeframes = 'accessibleTimeframes' in error;

    // MT5AccessDeniedError has tier and accessible* properties
    if (hasTier && (hasAccessibleSymbols || hasAccessibleTimeframes)) {
      return true;
    }
  }

  return false;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HTTP STATUS CODES (for consistency)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type HttpStatus = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];
