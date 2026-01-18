/**
 * Base API Client
 *
 * Shared base class for all API clients with common functionality:
 * - HTTP methods (GET, POST, PUT, PATCH, DELETE)
 * - Error handling
 * - Authentication (JWT token injection)
 * - Request/response interceptors
 * - Retry logic
 *
 * Multi-Backend Architecture - Simplified (2 backends)
 */

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Base API Error
 */
export class ApiError extends Error {
  statusCode: number;
  responseBody?: unknown;

  constructor(message: string, statusCode: number, responseBody?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;

    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Authentication Error (401)
 */
export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication required') {
    super(message, 401);
    this.name = 'AuthenticationError';

    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Authorization Error (403)
 */
export class AuthorizationError extends ApiError {
  constructor(message: string = 'Access forbidden') {
    super(message, 403);
    this.name = 'AuthorizationError';

    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

/**
 * Not Found Error (404)
 */
export class NotFoundError extends ApiError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
    this.name = 'NotFoundError';

    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Validation Error (400)
 */
export class ValidationError extends ApiError {
  errors?: Record<string, string[]>;

  constructor(
    message: string = 'Validation failed',
    errors?: Record<string, string[]>
  ) {
    super(message, 400);
    this.name = 'ValidationError';
    this.errors = errors;

    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Server Error (5xx)
 */
export class ServerError extends ApiError {
  constructor(message: string = 'Server error', statusCode: number = 500) {
    super(message, statusCode);
    this.name = 'ServerError';

    Object.setPrototypeOf(this, ServerError.prototype);
  }
}

// ============================================================================
// Types
// ============================================================================

export interface RequestConfig {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================================
// Base API Client Class
// ============================================================================

export abstract class BaseApiClient {
  protected baseURL: string;
  protected defaultTimeout: number;
  protected defaultRetries: number;

  constructor(
    baseURL: string,
    timeout: number = DEFAULT_TIMEOUT,
    retries: number = MAX_RETRIES
  ) {
    this.baseURL = baseURL;
    this.defaultTimeout = timeout;
    this.defaultRetries = retries;
  }

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------

  /**
   * Get authentication token from storage
   */
  protected async getAuthToken(): Promise<string | null> {
    if (typeof window === 'undefined') {
      // Server-side: token should be passed via headers
      return null;
    }

    // Client-side: get from localStorage or sessionStorage
    return localStorage.getItem('auth_token');
  }

  /**
   * Build full URL with query parameters
   */
  protected buildURL(endpoint: string, params?: Record<string, unknown>): string {
    const url = new URL(endpoint, this.baseURL);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  /**
   * Build request headers
   */
  protected async buildHeaders(
    customHeaders?: Record<string, string>
  ): Promise<HeadersInit> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    // Add authentication token if available
    const token = await this.getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Check if error is retryable (5xx server errors)
   */
  protected isRetryableError(status: number): boolean {
    return status >= 500 && status < 600;
  }

  /**
   * Sleep for specified milliseconds
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Fetch with timeout
   */
  protected async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Handle API response
   */
  protected async handleResponse<T>(response: Response): Promise<T> {
    // Try to parse response body
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = {};
    }

    // Handle error responses
    if (!response.ok) {
      const errorMessage =
        (body as { error?: string; message?: string })?.error ||
        (body as { error?: string; message?: string })?.message ||
        `Request failed with status ${response.status}`;

      switch (response.status) {
        case 401:
          throw new AuthenticationError(errorMessage);
        case 403:
          throw new AuthorizationError(errorMessage);
        case 404:
          throw new NotFoundError(errorMessage);
        case 400:
          throw new ValidationError(
            errorMessage,
            (body as { errors?: Record<string, string[]> })?.errors
          );
        default:
          if (response.status >= 500) {
            throw new ServerError(errorMessage, response.status);
          }
          throw new ApiError(errorMessage, response.status, body);
      }
    }

    return body as T;
  }

  // --------------------------------------------------------------------------
  // HTTP Methods
  // --------------------------------------------------------------------------

  /**
   * GET request
   */
  async get<T>(
    endpoint: string,
    params?: Record<string, unknown>,
    config?: RequestConfig
  ): Promise<T> {
    const url = this.buildURL(endpoint, params);
    const headers = await this.buildHeaders(config?.headers);
    const timeout = config?.timeout || this.defaultTimeout;
    const retries = config?.retries || this.defaultRetries;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(
          url,
          { method: 'GET', headers },
          timeout
        );

        // Don't retry client errors (4xx)
        if (!response.ok && !this.isRetryableError(response.status)) {
          return this.handleResponse<T>(response);
        }

        // Retry server errors (5xx)
        if (!response.ok && this.isRetryableError(response.status)) {
          if (attempt < retries - 1) {
            await this.sleep(RETRY_DELAY * (attempt + 1));
            continue;
          }
        }

        return this.handleResponse<T>(response);
      } catch (error) {
        lastError = error as Error;

        if (attempt < retries - 1) {
          await this.sleep(RETRY_DELAY * (attempt + 1));
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  /**
   * POST request
   */
  async post<T>(
    endpoint: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<T> {
    const url = this.buildURL(endpoint);
    const headers = await this.buildHeaders(config?.headers);
    const timeout = config?.timeout || this.defaultTimeout;

    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      },
      timeout
    );

    return this.handleResponse<T>(response);
  }

  /**
   * PUT request
   */
  async put<T>(
    endpoint: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<T> {
    const url = this.buildURL(endpoint);
    const headers = await this.buildHeaders(config?.headers);
    const timeout = config?.timeout || this.defaultTimeout;

    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      },
      timeout
    );

    return this.handleResponse<T>(response);
  }

  /**
   * PATCH request
   */
  async patch<T>(
    endpoint: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<T> {
    const url = this.buildURL(endpoint);
    const headers = await this.buildHeaders(config?.headers);
    const timeout = config?.timeout || this.defaultTimeout;

    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      },
      timeout
    );

    return this.handleResponse<T>(response);
  }

  /**
   * DELETE request
   */
  async delete<T>(
    endpoint: string,
    config?: RequestConfig
  ): Promise<T> {
    const url = this.buildURL(endpoint);
    const headers = await this.buildHeaders(config?.headers);
    const timeout = config?.timeout || this.defaultTimeout;

    const response = await this.fetchWithTimeout(
      url,
      {
        method: 'DELETE',
        headers,
      },
      timeout
    );

    return this.handleResponse<T>(response);
  }
}
