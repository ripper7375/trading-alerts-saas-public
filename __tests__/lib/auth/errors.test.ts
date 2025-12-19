/**
 * Unit Tests: Authentication Error Classes
 * Tests all error classes in lib/auth/errors.ts
 */

import { describe, it, expect } from '@jest/globals';

import {
  AuthError,
  InvalidCredentialsError,
  EmailNotVerifiedError,
  AccountExistsError,
  OAuthError,
  OAuthProviderError,
  OAuthCallbackError,
  OAuthAccountLinkingError,
  TokenError,
  InvalidTokenError,
  ExpiredTokenError,
  MissingTokenError,
  PasswordError,
  WeakPasswordError,
  PasswordMismatchError,
  SessionError,
  SessionExpiredError,
  SessionInvalidError,
  TierAccessError,
  InsufficientTierError,
  AffiliateError,
  NotAffiliateError,
  AffiliateSuspendedError,
  AffiliateNotVerifiedError,
  AdminError,
  NotAdminError,
  RateLimitError,
  AccountError,
  AccountInactiveError,
  AccountBlockedError,
  AuthConfigurationError,
  ERROR_CODE_TO_STATUS,
  getErrorStatusCode,
  isOperationalError,
} from '@/lib/auth/errors';

describe('Authentication Error Classes', () => {
  describe('AuthError (Base Class)', () => {
    it('should create error with default values', () => {
      const error = new AuthError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('AUTH_ERROR');
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe('AuthError');
    });

    it('should create error with custom code and status', () => {
      const error = new AuthError('Custom error', 'CUSTOM_CODE', 403);

      expect(error.message).toBe('Custom error');
      expect(error.code).toBe('CUSTOM_CODE');
      expect(error.statusCode).toBe(403);
    });

    it('should be an instance of Error', () => {
      const error = new AuthError('Test');
      expect(error).toBeInstanceOf(Error);
    });

    it('should have a stack trace', () => {
      const error = new AuthError('Test');
      expect(error.stack).toBeDefined();
    });
  });

  describe('Credential Errors', () => {
    it('InvalidCredentialsError should have correct defaults', () => {
      const error = new InvalidCredentialsError();

      expect(error.message).toBe('Invalid email or password');
      expect(error.code).toBe('INVALID_CREDENTIALS');
      expect(error.statusCode).toBe(401);
    });

    it('InvalidCredentialsError should accept custom message', () => {
      const error = new InvalidCredentialsError('Wrong password');
      expect(error.message).toBe('Wrong password');
    });

    it('EmailNotVerifiedError should have correct defaults', () => {
      const error = new EmailNotVerifiedError();

      expect(error.message).toBe(
        'Please verify your email address before signing in'
      );
      expect(error.code).toBe('EMAIL_NOT_VERIFIED');
      expect(error.statusCode).toBe(403);
    });

    it('AccountExistsError should have correct defaults', () => {
      const error = new AccountExistsError();

      expect(error.message).toBe('An account with this email already exists');
      expect(error.code).toBe('ACCOUNT_EXISTS');
      expect(error.statusCode).toBe(409);
    });
  });

  describe('OAuth Errors', () => {
    it('OAuthError should store provider', () => {
      const error = new OAuthError('OAuth failed', 'google');

      expect(error.message).toBe('OAuth failed');
      expect(error.provider).toBe('google');
      expect(error.code).toBe('OAUTH_ERROR');
      expect(error.statusCode).toBe(401);
    });

    it('OAuthProviderError should have correct defaults', () => {
      const error = new OAuthProviderError('github');

      expect(error.message).toBe('OAuth authentication failed');
      expect(error.provider).toBe('github');
      expect(error.code).toBe('OAUTH_PROVIDER_ERROR');
    });

    it('OAuthCallbackError should have correct defaults', () => {
      const error = new OAuthCallbackError('google');

      expect(error.message).toBe('OAuth callback failed');
      expect(error.provider).toBe('google');
      expect(error.code).toBe('OAUTH_CALLBACK_ERROR');
    });

    it('OAuthAccountLinkingError should have correct defaults', () => {
      const error = new OAuthAccountLinkingError('discord');

      expect(error.message).toBe('Cannot link discord account');
      expect(error.provider).toBe('discord');
      expect(error.code).toBe('OAUTH_ACCOUNT_LINKING_ERROR');
    });
  });

  describe('Token Errors', () => {
    it('TokenError should have correct defaults', () => {
      const error = new TokenError('Token issue');

      expect(error.message).toBe('Token issue');
      expect(error.code).toBe('TOKEN_ERROR');
      expect(error.statusCode).toBe(401);
    });

    it('InvalidTokenError should have correct defaults', () => {
      const error = new InvalidTokenError();

      expect(error.message).toBe('Invalid or malformed token');
      expect(error.code).toBe('INVALID_TOKEN');
    });

    it('ExpiredTokenError should have correct defaults', () => {
      const error = new ExpiredTokenError();

      expect(error.message).toBe('Token has expired');
      expect(error.code).toBe('EXPIRED_TOKEN');
    });

    it('MissingTokenError should have correct defaults', () => {
      const error = new MissingTokenError();

      expect(error.message).toBe('Authentication token is required');
      expect(error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('Password Errors', () => {
    it('PasswordError should have correct defaults', () => {
      const error = new PasswordError('Password issue');

      expect(error.message).toBe('Password issue');
      expect(error.code).toBe('PASSWORD_ERROR');
      expect(error.statusCode).toBe(400);
    });

    it('WeakPasswordError should have correct defaults', () => {
      const error = new WeakPasswordError();

      expect(error.message).toBe(
        'Password must be at least 8 characters with uppercase, lowercase, and number'
      );
      expect(error.code).toBe('WEAK_PASSWORD');
    });

    it('PasswordMismatchError should have correct defaults', () => {
      const error = new PasswordMismatchError();

      expect(error.message).toBe('Password and confirmation do not match');
      expect(error.code).toBe('PASSWORD_MISMATCH');
    });
  });

  describe('Session Errors', () => {
    it('SessionError should have correct defaults', () => {
      const error = new SessionError('Session issue');

      expect(error.message).toBe('Session issue');
      expect(error.code).toBe('SESSION_ERROR');
      expect(error.statusCode).toBe(401);
    });

    it('SessionExpiredError should have correct defaults', () => {
      const error = new SessionExpiredError();

      expect(error.message).toBe(
        'Your session has expired. Please sign in again'
      );
      expect(error.code).toBe('SESSION_EXPIRED');
    });

    it('SessionInvalidError should have correct defaults', () => {
      const error = new SessionInvalidError();

      expect(error.message).toBe('Invalid session. Please sign in again');
      expect(error.code).toBe('SESSION_INVALID');
    });
  });

  describe('Tier Access Errors', () => {
    it('TierAccessError should store tier information', () => {
      const error = new TierAccessError('Access denied', 'PRO', 'FREE');

      expect(error.message).toBe('Access denied');
      expect(error.requiredTier).toBe('PRO');
      expect(error.currentTier).toBe('FREE');
      expect(error.code).toBe('TIER_ACCESS_DENIED');
      expect(error.statusCode).toBe(403);
    });

    it('InsufficientTierError should format message correctly', () => {
      const error = new InsufficientTierError('Advanced Charts', 'PRO', 'FREE');

      expect(error.message).toBe(
        'Advanced Charts requires PRO tier. Current tier: FREE'
      );
      expect(error.requiredTier).toBe('PRO');
      expect(error.currentTier).toBe('FREE');
    });
  });

  describe('Affiliate Errors', () => {
    it('AffiliateError should have correct defaults', () => {
      const error = new AffiliateError('Affiliate issue');

      expect(error.message).toBe('Affiliate issue');
      expect(error.code).toBe('AFFILIATE_ERROR');
      expect(error.statusCode).toBe(403);
    });

    it('NotAffiliateError should have correct defaults', () => {
      const error = new NotAffiliateError();

      expect(error.message).toBe('Affiliate access required');
      expect(error.code).toBe('NOT_AFFILIATE');
    });

    it('AffiliateSuspendedError should have correct defaults', () => {
      const error = new AffiliateSuspendedError();

      expect(error.message).toBe('Affiliate account is suspended');
      expect(error.code).toBe('AFFILIATE_SUSPENDED');
    });

    it('AffiliateNotVerifiedError should have correct defaults', () => {
      const error = new AffiliateNotVerifiedError();

      expect(error.message).toBe('Affiliate email verification required');
      expect(error.code).toBe('AFFILIATE_NOT_VERIFIED');
    });
  });

  describe('Admin Errors', () => {
    it('AdminError should have correct defaults', () => {
      const error = new AdminError('Admin issue');

      expect(error.message).toBe('Admin issue');
      expect(error.code).toBe('ADMIN_ERROR');
      expect(error.statusCode).toBe(403);
    });

    it('NotAdminError should have correct defaults', () => {
      const error = new NotAdminError();

      expect(error.message).toBe('Administrator access required');
      expect(error.code).toBe('NOT_ADMIN');
    });
  });

  describe('Rate Limit Errors', () => {
    it('RateLimitError should have correct defaults', () => {
      const error = new RateLimitError();

      expect(error.message).toBe(
        'Too many authentication attempts. Please try again later'
      );
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBeUndefined();
    });

    it('RateLimitError should store retryAfter', () => {
      const error = new RateLimitError('Rate limited', 60);

      expect(error.retryAfter).toBe(60);
    });
  });

  describe('Account Errors', () => {
    it('AccountError should have correct defaults', () => {
      const error = new AccountError('Account issue');

      expect(error.message).toBe('Account issue');
      expect(error.code).toBe('ACCOUNT_ERROR');
      expect(error.statusCode).toBe(403);
    });

    it('AccountInactiveError should have correct defaults', () => {
      const error = new AccountInactiveError();

      expect(error.message).toBe('Account is inactive. Please contact support');
      expect(error.code).toBe('ACCOUNT_INACTIVE');
    });

    it('AccountBlockedError should have correct defaults', () => {
      const error = new AccountBlockedError();

      expect(error.message).toBe(
        'Account has been blocked. Please contact support'
      );
      expect(error.code).toBe('ACCOUNT_BLOCKED');
    });
  });

  describe('Configuration Errors', () => {
    it('AuthConfigurationError should have correct defaults', () => {
      const error = new AuthConfigurationError();

      expect(error.message).toBe('Authentication configuration error');
      expect(error.code).toBe('AUTH_CONFIG_ERROR');
      expect(error.statusCode).toBe(500);
    });
  });

  describe('ERROR_CODE_TO_STATUS mapping', () => {
    it('should map authentication errors to 401', () => {
      expect(ERROR_CODE_TO_STATUS['AUTH_ERROR']).toBe(401);
      expect(ERROR_CODE_TO_STATUS['INVALID_CREDENTIALS']).toBe(401);
      expect(ERROR_CODE_TO_STATUS['TOKEN_ERROR']).toBe(401);
      expect(ERROR_CODE_TO_STATUS['SESSION_ERROR']).toBe(401);
    });

    it('should map authorization errors to 403', () => {
      expect(ERROR_CODE_TO_STATUS['EMAIL_NOT_VERIFIED']).toBe(403);
      expect(ERROR_CODE_TO_STATUS['TIER_ACCESS_DENIED']).toBe(403);
      expect(ERROR_CODE_TO_STATUS['NOT_AFFILIATE']).toBe(403);
      expect(ERROR_CODE_TO_STATUS['NOT_ADMIN']).toBe(403);
    });

    it('should map validation errors to 400', () => {
      expect(ERROR_CODE_TO_STATUS['PASSWORD_ERROR']).toBe(400);
      expect(ERROR_CODE_TO_STATUS['WEAK_PASSWORD']).toBe(400);
      expect(ERROR_CODE_TO_STATUS['PASSWORD_MISMATCH']).toBe(400);
    });

    it('should map conflict errors to 409', () => {
      expect(ERROR_CODE_TO_STATUS['ACCOUNT_EXISTS']).toBe(409);
    });

    it('should map rate limit errors to 429', () => {
      expect(ERROR_CODE_TO_STATUS['RATE_LIMIT_EXCEEDED']).toBe(429);
    });

    it('should map server errors to 500', () => {
      expect(ERROR_CODE_TO_STATUS['AUTH_CONFIG_ERROR']).toBe(500);
    });
  });

  describe('getErrorStatusCode', () => {
    it('should return statusCode from AuthError', () => {
      const error = new InvalidCredentialsError();
      expect(getErrorStatusCode(error)).toBe(401);
    });

    it('should return statusCode from TierAccessError', () => {
      const error = new TierAccessError('Denied', 'PRO', 'FREE');
      expect(getErrorStatusCode(error)).toBe(403);
    });

    it('should return 500 for unknown errors', () => {
      const error = new Error('Unknown error');
      expect(getErrorStatusCode(error)).toBe(500);
    });
  });

  describe('isOperationalError', () => {
    it('should return true for AuthError instances', () => {
      expect(isOperationalError(new AuthError('Test'))).toBe(true);
      expect(isOperationalError(new InvalidCredentialsError())).toBe(true);
      expect(
        isOperationalError(new TierAccessError('Test', 'PRO', 'FREE'))
      ).toBe(true);
    });

    it('should return false for regular errors', () => {
      expect(isOperationalError(new Error('Regular error'))).toBe(false);
      expect(isOperationalError(new TypeError('Type error'))).toBe(false);
    });
  });
});
