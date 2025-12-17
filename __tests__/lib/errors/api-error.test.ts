/**
 * API Error Tests
 *
 * Tests for custom API error classes.
 */

import {
  APIError,
  ValidationError,
  TierAccessError,
  ResourceLimitError,
  AuthenticationError,
  isAPIError,
} from '@/lib/errors/api-error';

describe('APIError', () => {
  describe('constructor', () => {
    it('should create an error with status code, code, and message', () => {
      const error = new APIError(400, 'BAD_REQUEST', 'Invalid input');

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.message).toBe('Invalid input');
      expect(error.name).toBe('APIError');
    });

    it('should support optional details', () => {
      const error = new APIError(422, 'VALIDATION_ERROR', 'Invalid field', {
        field: 'email',
      });

      expect(error.details).toEqual({ field: 'email' });
    });
  });

  describe('static factory methods', () => {
    it('should create a 400 Bad Request error', () => {
      const error = APIError.badRequest('Invalid input');

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.message).toBe('Invalid input');
    });

    it('should create a 401 Unauthorized error', () => {
      const error = APIError.unauthorized();

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.message).toBe('Unauthorized');
    });

    it('should create a 401 Unauthorized error with custom message', () => {
      const error = APIError.unauthorized('Invalid token');

      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Invalid token');
    });

    it('should create a 403 Forbidden error', () => {
      const error = APIError.forbidden();

      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
    });

    it('should create a 404 Not Found error', () => {
      const error = APIError.notFound();

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should create a 404 Not Found error with custom message', () => {
      const error = APIError.notFound('User not found');

      expect(error.message).toBe('User not found');
    });

    it('should create a 409 Conflict error', () => {
      const error = APIError.conflict('Email already exists');

      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
      expect(error.message).toBe('Email already exists');
    });

    it('should create a 422 Unprocessable Entity error', () => {
      const error = APIError.unprocessable('Invalid data', 'INVALID_DATA', {
        errors: ['field1', 'field2'],
      });

      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('INVALID_DATA');
      expect(error.details).toEqual({ errors: ['field1', 'field2'] });
    });

    it('should create a 429 Too Many Requests error', () => {
      const error = APIError.tooManyRequests('Rate limit exceeded', 'RATE_LIMIT', 60);

      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT');
      expect(error.details).toEqual({ retryAfter: 60 });
    });

    it('should create a 500 Internal Server Error', () => {
      const error = APIError.internal();

      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.message).toBe('Internal server error');
    });

    it('should create a 502 Bad Gateway error', () => {
      const error = APIError.badGateway();

      expect(error.statusCode).toBe(502);
      expect(error.code).toBe('BAD_GATEWAY');
    });

    it('should create a 503 Service Unavailable error', () => {
      const error = APIError.serviceUnavailable();

      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
    });
  });

  describe('toJSON', () => {
    it('should convert error to JSON object', () => {
      const error = new APIError(400, 'BAD_REQUEST', 'Invalid input');
      const json = error.toJSON();

      expect(json).toEqual({
        error: 'Invalid input',
        code: 'BAD_REQUEST',
        statusCode: 400,
      });
    });

    it('should include details in JSON if present', () => {
      const error = new APIError(422, 'VALIDATION_ERROR', 'Invalid', {
        field: 'email',
      });
      const json = error.toJSON();

      expect(json.details).toEqual({ field: 'email' });
    });
  });
});

describe('ValidationError', () => {
  it('should create a 400 validation error', () => {
    const error = new ValidationError('Invalid email format');

    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Invalid email format');
    expect(error.name).toBe('ValidationError');
  });

  it('should support details', () => {
    const error = new ValidationError('Validation failed', {
      errors: [{ field: 'email', message: 'Invalid' }],
    });

    expect(error.details).toEqual({
      errors: [{ field: 'email', message: 'Invalid' }],
    });
  });
});

describe('TierAccessError', () => {
  it('should create a 403 tier restriction error', () => {
    const error = new TierAccessError();

    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('TIER_RESTRICTION');
    expect(error.message).toBe('Feature not available in your tier');
    expect(error.details).toEqual({ requiredTier: 'PRO' });
  });

  it('should support custom message and tier', () => {
    const error = new TierAccessError('Upgrade to access this symbol', 'PRO');

    expect(error.message).toBe('Upgrade to access this symbol');
    expect(error.details).toEqual({ requiredTier: 'PRO' });
  });
});

describe('ResourceLimitError', () => {
  it('should create a 403 resource limit error', () => {
    const error = new ResourceLimitError('Alert limit reached', 5, 5, 'alerts');

    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('RESOURCE_LIMIT_EXCEEDED');
    expect(error.message).toBe('Alert limit reached');
    expect(error.details).toEqual({
      current: 5,
      limit: 5,
      resourceType: 'alerts',
    });
  });
});

describe('AuthenticationError', () => {
  it('should create a 401 auth error', () => {
    const error = new AuthenticationError();

    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('AUTH_FAILED');
    expect(error.message).toBe('Authentication failed');
  });

  it('should support custom code', () => {
    const error = new AuthenticationError('Invalid credentials', 'INVALID_CREDENTIALS');

    expect(error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('isAPIError', () => {
  it('should return true for APIError instances', () => {
    const error = new APIError(400, 'BAD_REQUEST', 'test');

    expect(isAPIError(error)).toBe(true);
  });

  it('should return true for ValidationError instances', () => {
    const error = new ValidationError('test');

    expect(isAPIError(error)).toBe(true);
  });

  it('should return false for regular Error', () => {
    const error = new Error('test');

    expect(isAPIError(error)).toBe(false);
  });

  it('should return false for non-error values', () => {
    expect(isAPIError(null)).toBe(false);
    expect(isAPIError(undefined)).toBe(false);
    expect(isAPIError('error')).toBe(false);
    expect(isAPIError({ message: 'error' })).toBe(false);
  });
});
