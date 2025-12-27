/**
 * CSRF Protection
 *
 * Implements CSRF protection using origin validation and token verification.
 * Protects sensitive endpoints from cross-site request forgery attacks.
 */

import crypto from 'crypto';

import { getRedisClient } from '@/lib/redis/client';

/**
 * CSRF token configuration
 */
const CSRF_CONFIG = {
  /** Token expiry in seconds (1 hour) */
  TOKEN_EXPIRY: 3600,
  /** Token length in bytes */
  TOKEN_LENGTH: 32,
  /** Redis key prefix */
  KEY_PREFIX: 'csrf:',
} as const;

/**
 * Allowed origins for CSRF validation
 * Includes production and development URLs
 */
function getAllowedOrigins(): string[] {
  const origins: string[] = [];

  // Add NEXTAUTH_URL if set
  const nextAuthUrl = process.env['NEXTAUTH_URL'];
  if (nextAuthUrl) {
    origins.push(new URL(nextAuthUrl).origin);
  }

  // Add development origins
  if (process.env['NODE_ENV'] !== 'production') {
    origins.push('http://localhost:3000');
    origins.push('http://127.0.0.1:3000');
  }

  return origins;
}

/**
 * Validate request origin
 *
 * Checks if the request origin matches allowed origins.
 * Used as first line of defense against CSRF attacks.
 *
 * @param request - Incoming request
 * @returns Whether the origin is valid
 */
export function validateOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // If no origin/referer, might be same-origin request
  if (!origin && !referer) {
    return true;
  }

  const allowedOrigins = getAllowedOrigins();

  // Check origin header
  if (origin && allowedOrigins.includes(origin)) {
    return true;
  }

  // Check referer header as fallback
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (allowedOrigins.includes(refererOrigin)) {
        return true;
      }
    } catch {
      // Invalid referer URL
      return false;
    }
  }

  return false;
}

/**
 * Generate a CSRF token for a session
 *
 * @param sessionId - User session ID
 * @returns Generated CSRF token
 */
export async function generateCsrfToken(sessionId: string): Promise<string> {
  const token = crypto.randomBytes(CSRF_CONFIG.TOKEN_LENGTH).toString('hex');

  try {
    const redis = getRedisClient();
    const key = `${CSRF_CONFIG.KEY_PREFIX}${sessionId}`;

    // Store token with expiry
    await redis.setex(key, CSRF_CONFIG.TOKEN_EXPIRY, token);

    return token;
  } catch (error) {
    console.error('Failed to store CSRF token:', error);
    // Return token anyway - validation will fail but won't crash
    return token;
  }
}

/**
 * Validate a CSRF token
 *
 * @param sessionId - User session ID
 * @param token - Token to validate
 * @returns Whether the token is valid
 */
export async function validateCsrfToken(
  sessionId: string,
  token: string
): Promise<boolean> {
  if (!token || !sessionId) {
    return false;
  }

  try {
    const redis = getRedisClient();
    const key = `${CSRF_CONFIG.KEY_PREFIX}${sessionId}`;

    const storedToken = await redis.get(key);

    // Use timing-safe comparison to prevent timing attacks
    if (!storedToken) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(storedToken)
    );
  } catch (error) {
    console.error('CSRF validation error:', error);
    return false;
  }
}

/**
 * CSRF validation result
 */
export interface CsrfValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Full CSRF validation for a request
 *
 * Performs origin validation and optionally token validation.
 *
 * @param request - Incoming request
 * @param options - Validation options
 * @returns Validation result
 */
export async function validateCsrf(
  request: Request,
  options: {
    /** Require token validation (in addition to origin) */
    requireToken?: boolean;
    /** Session ID for token validation */
    sessionId?: string;
  } = {}
): Promise<CsrfValidationResult> {
  // Skip CSRF for safe methods
  const method = request.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return { valid: true };
  }

  // Validate origin
  if (!validateOrigin(request)) {
    return { valid: false, error: 'Invalid request origin' };
  }

  // If token validation is required
  if (options.requireToken && options.sessionId) {
    const token = request.headers.get('x-csrf-token');
    if (!token) {
      return { valid: false, error: 'CSRF token missing' };
    }

    const isValid = await validateCsrfToken(options.sessionId, token);
    if (!isValid) {
      return { valid: false, error: 'Invalid CSRF token' };
    }
  }

  return { valid: true };
}

/**
 * Revoke a CSRF token
 *
 * @param sessionId - User session ID
 */
export async function revokeCsrfToken(sessionId: string): Promise<void> {
  try {
    const redis = getRedisClient();
    const key = `${CSRF_CONFIG.KEY_PREFIX}${sessionId}`;
    await redis.del(key);
  } catch (error) {
    console.error('Failed to revoke CSRF token:', error);
  }
}
