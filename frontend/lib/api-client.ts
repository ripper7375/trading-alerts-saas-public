/**
 * API Client for Trading Alerts SaaS
 *
 * Purpose: Centralized API communication layer that works with both:
 * - Step 4: Next.js API routes (/api/*)
 * - Step 5+: Nest.js API on Railway (external URL)
 *
 * Usage:
 * ```typescript
 * import { apiClient } from '@/lib/api-client';
 *
 * // GET request
 * const alerts = await apiClient.get('/alerts');
 *
 * // POST request
 * const newAlert = await apiClient.post('/alerts', { symbol: 'XAUUSD' });
 *
 * // PUT request
 * const updated = await apiClient.put('/alerts/123', { active: false });
 *
 * // DELETE request
 * await apiClient.delete('/alerts/123');
 * ```
 *
 * Configuration:
 * - NEXT_PUBLIC_API_URL not set → uses "/api" (Next.js routes)
 * - NEXT_PUBLIC_API_URL="/api" → uses "/api" (Next.js routes)
 * - NEXT_PUBLIC_API_URL="http://localhost:3001" → uses local Nest.js
 * - NEXT_PUBLIC_API_URL="https://api.railway.app" → uses production Nest.js
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClientConfig {
  baseURL?: string;
  headers?: HeadersInit;
  credentials?: RequestCredentials;
}

export class ApiClient {
  private baseURL: string;
  private defaultHeaders: HeadersInit;
  private credentials: RequestCredentials;

  constructor(config?: ApiClientConfig) {
    // Use NEXT_PUBLIC_API_URL if set, otherwise default to Next.js API routes
    this.baseURL = config?.baseURL || process.env['NEXT_PUBLIC_API_URL'] || '/api';

    // Remove trailing slash if present
    if (this.baseURL.endsWith('/')) {
      this.baseURL = this.baseURL.slice(0, -1);
    }

    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...config?.headers,
    };

    // Include credentials for authentication cookies
    this.credentials = config?.credentials || 'include';

    // Log configuration in development
    if (process.env['NODE_ENV'] === 'development') {
      console.log('[ApiClient] Configured with baseURL:', this.baseURL);
    }
  }

  /**
   * GET request
   */
  async get<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'GET',
    });
  }

  /**
   * POST request
   */
  async post<T = any>(
    endpoint: string,
    data?: any,
    options?: RequestInit
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T = any>(
    endpoint: string,
    data?: any,
    options?: RequestInit
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PATCH request
   */
  async patch<T = any>(
    endpoint: string,
    data?: any,
    options?: RequestInit
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'DELETE',
    });
  }

  /**
   * Core request method
   */
  private async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Ensure endpoint starts with /
    const normalizedEndpoint = endpoint.startsWith('/')
      ? endpoint
      : `/${endpoint}`;

    // Construct full URL
    const url = `${this.baseURL}${normalizedEndpoint}`;

    // Merge headers
    const headers = {
      ...this.defaultHeaders,
      ...options.headers,
    };

    // Log request in development
    if (process.env['NODE_ENV'] === 'development') {
      console.log(
        `[ApiClient] ${options.method || 'GET'} ${url}`,
        options.body ? JSON.parse(options.body as string) : ''
      );
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: this.credentials,
      });

      // Parse response
      const contentType = response.headers.get('content-type');
      const isJson = contentType?.includes('application/json');

      let data: any;
      if (isJson) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      // Handle errors
      if (!response.ok) {
        const errorMessage =
          typeof data === 'object' && data?.error
            ? data.error
            : typeof data === 'object' && data?.message
            ? data.message
            : typeof data === 'string'
            ? data
            : `HTTP ${response.status}: ${response.statusText}`;

        throw new ApiError(errorMessage, response.status, data);
      }

      // Log response in development
      if (process.env['NODE_ENV'] === 'development') {
        console.log(`[ApiClient] Response:`, data);
      }

      return data as T;
    } catch (error) {
      // Re-throw ApiError as-is
      if (error instanceof ApiError) {
        throw error;
      }

      // Wrap network errors
      if (error instanceof Error) {
        console.error('[ApiClient] Network error:', error.message);
        throw new ApiError(
          `Network error: ${error.message}`,
          0,
          { originalError: error }
        );
      }

      // Unknown error
      throw new ApiError('An unknown error occurred', 0);
    }
  }

  /**
   * Get current base URL (useful for debugging)
   */
  getBaseURL(): string {
    return this.baseURL;
  }

  /**
   * Check if using external API (Nest.js) vs Next.js routes
   */
  isExternalAPI(): boolean {
    return !this.baseURL.startsWith('/');
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export class for custom instances
export default ApiClient;
