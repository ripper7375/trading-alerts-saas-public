// Ported verbatim from lib/auth/errors.ts (Session 3-2, File 1/6) — pure
// port, framework-agnostic, no NextAuth/Next.js imports. Error `code`/
// `statusCode`/message shapes must match exactly (order invariant): anything
// consuming these error codes downstream (existing app/api/auth/* routes,
// future Next.js side in Session 3-3) depends on them. Kept as a full,
// verbatim copy rather than a curated subset — a partial port that silently
// diverges from its source is the exact hazard L4 warns about, and later
// sessions (tier/affiliate/admin guards) will need the rest of this
// hierarchy anyway.

/**
 * Base authentication error class
 */
export class AuthError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(
    message: string,
    code: string = 'AUTH_ERROR',
    statusCode: number = 401
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor(message: string = 'Invalid email or password') {
    super(message, 'INVALID_CREDENTIALS', 401);
  }
}

export class EmailNotVerifiedError extends AuthError {
  constructor(
    message: string = 'Please verify your email address before signing in'
  ) {
    super(message, 'EMAIL_NOT_VERIFIED', 403);
  }
}

export class AccountExistsError extends AuthError {
  constructor(message: string = 'An account with this email already exists') {
    super(message, 'ACCOUNT_EXISTS', 409);
  }
}

export class OAuthError extends AuthError {
  public readonly provider: string;

  constructor(message: string, provider: string, code: string = 'OAUTH_ERROR') {
    super(message, code, 401);
    this.provider = provider;
  }
}

export class OAuthProviderError extends OAuthError {
  constructor(
    provider: string,
    message: string = `OAuth authentication failed`
  ) {
    super(message, provider, 'OAUTH_PROVIDER_ERROR');
  }
}

export class OAuthCallbackError extends OAuthError {
  constructor(provider: string, message: string = `OAuth callback failed`) {
    super(message, provider, 'OAUTH_CALLBACK_ERROR');
  }
}

export class OAuthAccountLinkingError extends OAuthError {
  constructor(
    provider: string,
    message: string = `Cannot link ${provider} account`
  ) {
    super(message, provider, 'OAUTH_ACCOUNT_LINKING_ERROR');
  }
}

export class TokenError extends AuthError {
  constructor(message: string, code: string = 'TOKEN_ERROR') {
    super(message, code, 401);
  }
}

export class InvalidTokenError extends TokenError {
  constructor(message: string = 'Invalid or malformed token') {
    super(message, 'INVALID_TOKEN');
  }
}

export class ExpiredTokenError extends TokenError {
  constructor(message: string = 'Token has expired') {
    super(message, 'EXPIRED_TOKEN');
  }
}

export class MissingTokenError extends TokenError {
  constructor(message: string = 'Authentication token is required') {
    super(message, 'MISSING_TOKEN');
  }
}

export class PasswordError extends AuthError {
  constructor(message: string, code: string = 'PASSWORD_ERROR') {
    super(message, code, 400);
  }
}

export class WeakPasswordError extends PasswordError {
  constructor(
    message: string = 'Password must be at least 8 characters with uppercase, lowercase, and number'
  ) {
    super(message, 'WEAK_PASSWORD');
  }
}

export class PasswordMismatchError extends PasswordError {
  constructor(message: string = 'Password and confirmation do not match') {
    super(message, 'PASSWORD_MISMATCH');
  }
}

export class SessionError extends AuthError {
  constructor(message: string, code: string = 'SESSION_ERROR') {
    super(message, code, 401);
  }
}

export class SessionExpiredError extends SessionError {
  constructor(
    message: string = 'Your session has expired. Please sign in again'
  ) {
    super(message, 'SESSION_EXPIRED');
  }
}

export class SessionInvalidError extends SessionError {
  constructor(message: string = 'Invalid session. Please sign in again') {
    super(message, 'SESSION_INVALID');
  }
}

export class TierAccessError extends AuthError {
  public readonly requiredTier: 'FREE' | 'PRO';
  public readonly currentTier: 'FREE' | 'PRO';

  constructor(
    message: string,
    requiredTier: 'FREE' | 'PRO',
    currentTier: 'FREE' | 'PRO'
  ) {
    super(message, 'TIER_ACCESS_DENIED', 403);
    this.requiredTier = requiredTier;
    this.currentTier = currentTier;
  }
}

export class InsufficientTierError extends TierAccessError {
  constructor(
    feature: string,
    requiredTier: 'FREE' | 'PRO',
    currentTier: 'FREE' | 'PRO'
  ) {
    super(
      `${feature} requires ${requiredTier} tier. Current tier: ${currentTier}`,
      requiredTier,
      currentTier
    );
  }
}

export class AffiliateError extends AuthError {
  constructor(message: string, code: string = 'AFFILIATE_ERROR') {
    super(message, code, 403);
  }
}

export class NotAffiliateError extends AffiliateError {
  constructor(message: string = 'Affiliate access required') {
    super(message, 'NOT_AFFILIATE');
  }
}

export class AffiliateSuspendedError extends AffiliateError {
  constructor(message: string = 'Affiliate account is suspended') {
    super(message, 'AFFILIATE_SUSPENDED');
  }
}

export class AffiliateNotVerifiedError extends AffiliateError {
  constructor(message: string = 'Affiliate email verification required') {
    super(message, 'AFFILIATE_NOT_VERIFIED');
  }
}

export class AdminError extends AuthError {
  constructor(message: string, code: string = 'ADMIN_ERROR') {
    super(message, code, 403);
  }
}

export class NotAdminError extends AdminError {
  constructor(message: string = 'Administrator access required') {
    super(message, 'NOT_ADMIN');
  }
}

export class RateLimitError extends AuthError {
  public readonly retryAfter?: number;

  constructor(
    message: string = 'Too many authentication attempts. Please try again later',
    retryAfter?: number
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
    this.retryAfter = retryAfter;
  }
}

export class AccountError extends AuthError {
  constructor(message: string, code: string = 'ACCOUNT_ERROR') {
    super(message, code, 403);
  }
}

export class AccountInactiveError extends AccountError {
  constructor(message: string = 'Account is inactive. Please contact support') {
    super(message, 'ACCOUNT_INACTIVE');
  }
}

export class AccountBlockedError extends AccountError {
  constructor(
    message: string = 'Account has been blocked. Please contact support'
  ) {
    super(message, 'ACCOUNT_BLOCKED');
  }
}

export class AuthConfigurationError extends AuthError {
  constructor(message: string = 'Authentication configuration error') {
    super(message, 'AUTH_CONFIG_ERROR', 500);
  }
}

/**
 * Two-factor authentication is required to complete this login.
 *
 * NEW this session — not part of the lib/auth/errors.ts port. NextAuth's
 * authorize() communicated this same case via a raw `Error` with a colon-
 * encoded message (`TWO_FACTOR_REQUIRED:<token>`), a mechanism specific to
 * how NextAuth surfaces thrown errors through signIn()'s redirect. operation-
 * service is a plain REST API with an AuthError -> HTTP mapping already
 * established (AuthExceptionFilter) — modeling this the same way (statusCode
 * 200, since needing a second step isn't a failure) keeps one exception-
 * handling path instead of two.
 */
export class TwoFactorRequiredError extends AuthError {
  public readonly twoFactorToken: string;

  constructor(twoFactorToken: string) {
    super(
      'Two-factor authentication code required',
      'TWO_FACTOR_REQUIRED',
      200
    );
    this.twoFactorToken = twoFactorToken;
  }
}

/**
 * Error code to HTTP status mapping
 */
export const ERROR_CODE_TO_STATUS: Record<string, number> = {
  AUTH_ERROR: 401,
  INVALID_CREDENTIALS: 401,
  EMAIL_NOT_VERIFIED: 403,
  ACCOUNT_EXISTS: 409,

  OAUTH_ERROR: 401,
  OAUTH_PROVIDER_ERROR: 401,
  OAUTH_CALLBACK_ERROR: 401,
  OAUTH_ACCOUNT_LINKING_ERROR: 401,

  TOKEN_ERROR: 401,
  INVALID_TOKEN: 401,
  EXPIRED_TOKEN: 401,
  MISSING_TOKEN: 401,

  PASSWORD_ERROR: 400,
  WEAK_PASSWORD: 400,
  PASSWORD_MISMATCH: 400,

  SESSION_ERROR: 401,
  SESSION_EXPIRED: 401,
  SESSION_INVALID: 401,

  TIER_ACCESS_DENIED: 403,
  INSUFFICIENT_TIER: 403,

  AFFILIATE_ERROR: 403,
  NOT_AFFILIATE: 403,
  AFFILIATE_SUSPENDED: 403,
  AFFILIATE_NOT_VERIFIED: 403,

  ADMIN_ERROR: 403,
  NOT_ADMIN: 403,

  RATE_LIMIT_EXCEEDED: 429,

  ACCOUNT_ERROR: 403,
  ACCOUNT_INACTIVE: 403,
  ACCOUNT_BLOCKED: 403,

  AUTH_CONFIG_ERROR: 500,

  TWO_FACTOR_REQUIRED: 200,
};

/**
 * Get HTTP status code from error
 */
export function getErrorStatusCode(error: Error): number {
  if (error instanceof AuthError) {
    return error.statusCode;
  }

  const statusCode = ERROR_CODE_TO_STATUS[error.message];
  if (statusCode) {
    return statusCode;
  }

  return 500;
}

/**
 * Check if error is operational (expected) vs programming error
 */
export function isOperationalError(error: Error): boolean {
  return error instanceof AuthError;
}
