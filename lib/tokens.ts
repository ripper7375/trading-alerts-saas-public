/**
 * Token Generation Utilities
 *
 * Generate and hash secure tokens for email verification,
 * password reset, and other authentication flows.
 */

import crypto from 'crypto';

/**
 * Generate a cryptographically secure random token
 *
 * @param length - Number of random bytes (default: 32, produces 64 char hex string)
 * @returns Hex-encoded random token
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a verification token for email verification
 *
 * @returns 64-character hex token
 */
export function generateVerificationToken(): string {
  return generateToken(32);
}

/**
 * Generate a password reset token
 *
 * @returns 64-character hex token
 */
export function generatePasswordResetToken(): string {
  return generateToken(32);
}

/**
 * Hash a token for secure storage
 *
 * Tokens should be hashed before storing in the database
 * to prevent token theft if the database is compromised.
 *
 * @param token - Plain text token to hash
 * @returns SHA-256 hash of the token
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Verify a token against its hash
 *
 * @param token - Plain text token to verify
 * @param hash - Stored hash to compare against
 * @returns true if token matches hash, false otherwise
 */
export function verifyToken(token: string, hash: string): boolean {
  const tokenHash = hashToken(token);
  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(tokenHash, 'hex'),
      Buffer.from(hash, 'hex')
    );
  } catch {
    // If buffers have different lengths, tokens don't match
    return false;
  }
}

/**
 * Generate a short numeric code (for SMS/2FA)
 *
 * @param length - Number of digits (default: 6)
 * @returns Numeric string code
 */
export function generateNumericCode(length: number = 6): string {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  const randomNumber = crypto.randomInt(min, max + 1);
  return randomNumber.toString();
}

/**
 * Generate a session token
 *
 * @returns 128-character hex token for session identification
 */
export function generateSessionToken(): string {
  return generateToken(64);
}

/**
 * Generate an API key
 *
 * @param prefix - Optional prefix for the key (e.g., 'sk_live_')
 * @returns Prefixed API key
 */
export function generateApiKey(prefix: string = 'ta_'): string {
  const key = generateToken(24);
  return `${prefix}${key}`;
}

/**
 * Check if a token has expired
 *
 * @param expiresAt - Expiration date
 * @returns true if token is expired, false otherwise
 */
export function isTokenExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/**
 * Calculate token expiration date
 *
 * @param hours - Hours until expiration (default: 24)
 * @returns Date object representing expiration time
 */
export function getTokenExpiration(hours: number = 24): Date {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + hours);
  return expiresAt;
}
