/**
 * API Error Classes
 *
 * Custom error classes for consistent API error responses.
 * Includes static factory methods for common HTTP error statuses.
 */

/**
 * Custom API Error class with status code and error code
 */
export class APIError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, APIError);
    }
  }

  /**
   * Create a 400 Bad Request error
   */
  static badRequest(
    message: string = 'Bad request',
    code: string = 'BAD_REQUEST',
    details?: Record<string, unknown>
  ): APIError {
    return new APIError(400, code, message, details);
  }

  /**
   * Create a 401 Unauthorized error
   */
  static unauthorized(
    message: string = 'Unauthorized',
    code: string = 'UNAUTHORIZED'
  ): APIError {
    return new APIError(401, code, message);
  }

  /**
   * Create a 403 Forbidden error
   */
  static forbidden(
    message: string = 'Forbidden',
    code: string = 'FORBIDDEN'
  ): APIError {
    return new APIError(403, code, message);
  }

  /**
   * Create a 404 Not Found error
   */
  static notFound(
    message: string = 'Not found',
    code: string = 'NOT_FOUND'
  ): APIError {
    return new APIError(404, code, message);
  }

  /**
   * Create a 409 Conflict error
   */
  static conflict(
    message: string = 'Resource already exists',
    code: string = 'CONFLICT'
  ): APIError {
    return new APIError(409, code, message);
  }

  /**
   * Create a 422 Unprocessable Entity error
   */
  static unprocessable(
    message: string = 'Unprocessable entity',
    code: string = 'UNPROCESSABLE_ENTITY',
    details?: Record<string, unknown>
  ): APIError {
    return new APIError(422, code, message, details);
  }

  /**
   * Create a 429 Too Many Requests error
   */
  static tooManyRequests(
    message: string = 'Too many requests',
    code: string = 'RATE_LIMIT_EXCEEDED',
    retryAfter?: number
  ): APIError {
    return new APIError(
      429,
      code,
      message,
      retryAfter ? { retryAfter } : undefined
    );
  }

  /**
   * Create a 500 Internal Server Error
   */
  static internal(
    message: string = 'Internal server error',
    code: string = 'INTERNAL_ERROR'
  ): APIError {
    return new APIError(500, code, message);
  }

  /**
   * Create a 502 Bad Gateway error
   */
  static badGateway(
    message: string = 'Bad gateway',
    code: string = 'BAD_GATEWAY'
  ): APIError {
    return new APIError(502, code, message);
  }

  /**
   * Create a 503 Service Unavailable error
   */
  static serviceUnavailable(
    message: string = 'Service unavailable',
    code: string = 'SERVICE_UNAVAILABLE'
  ): APIError {
    return new APIError(503, code, message);
  }

  /**
   * Convert error to JSON-serializable object
   */
  toJSON(): {
    error: string;
    code: string;
    statusCode: number;
    details?: Record<string, unknown>;
  } {
    return {
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
      ...(this.details && { details: this.details }),
    };
  }
}

/**
 * Validation Error - for Zod and other validation failures
 */
export class ValidationError extends APIError {
  constructor(
    message: string = 'Validation failed',
    details?: Record<string, unknown>
  ) {
    super(400, 'VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

/**
 * Tier Access Error - for tier-restricted resource access
 */
export class TierAccessError extends APIError {
  constructor(
    message: string = 'Feature not available in your tier',
    requiredTier: string = 'PRO'
  ) {
    super(403, 'TIER_RESTRICTION', message, { requiredTier });
    this.name = 'TierAccessError';
  }
}

/**
 * Resource Limit Error - for exceeded limits (alerts, watchlist items)
 */
export class ResourceLimitError extends APIError {
  constructor(
    message: string = 'Resource limit exceeded',
    current: number,
    limit: number,
    resourceType: string
  ) {
    super(403, 'RESOURCE_LIMIT_EXCEEDED', message, {
      current,
      limit,
      resourceType,
    });
    this.name = 'ResourceLimitError';
  }
}

/**
 * Authentication Error - for auth-specific failures
 */
export class AuthenticationError extends APIError {
  constructor(
    message: string = 'Authentication failed',
    code: string = 'AUTH_FAILED'
  ) {
    super(401, code, message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Check if an error is an APIError
 */
export function isAPIError(error: unknown): error is APIError {
  return error instanceof APIError;
}
