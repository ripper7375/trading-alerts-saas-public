/**
 * Enhanced API Client for Trading Alerts SaaS
 *
 * Purpose: Centralized API communication layer that works with:
 * - Next.js API routes (/api/*)
 * - Stack A (Nest.js on Railway) - Parts 2-19
 * - Stack B (Nest.js on Railway) - Parts 20-26
 *
 * Features:
 * - REST API calls (GET, POST, PUT, PATCH, DELETE)
 * - WebSocket support for real-time notifications
 * - Server-Sent Events (SSE) for live updates
 * - Multi-stack routing (Stack A & Stack B)
 * - Automatic retry with exponential backoff
 * - Request timeout and cancellation
 * - Rate limiting handling (429 responses)
 *
 * Usage:
 * ```typescript
 * import { api } from '@/lib/api-client';
 *
 * // Stack A - Main CRUD operations
 * const alerts = await api.stackA.get('/alerts');
 * const newAlert = await api.stackA.post('/alerts', { symbol: 'XAUUSD' });
 *
 * // Stack B - Analytics & Real-time
 * const leaderboard = await api.stackB.get('/leaderboard/H4');
 *
 * // Real-time notifications (WebSocket)
 * api.stackB.subscribe('/notifications', (data) => {
 *   console.log('New notification:', data);
 * });
 *
 * // Server-Sent Events (SSE)
 * const eventSource = api.stackB.createEventSource('/notifications/stream');
 * eventSource.onmessage = (event) => {
 *   console.log('SSE event:', event.data);
 * };
 *
 * // Parallel requests to multiple stacks
 * const [alerts, leaderboard] = await Promise.all([
 *   api.stackA.get('/alerts'),
 *   api.stackB.get('/leaderboard/H4')
 * ]);
 *
 * // Request with timeout
 * const data = await api.stackA.get('/slow-endpoint', { timeout: 10000 });
 *
 * // Cancellable request
 * const controller = new AbortController();
 * api.stackA.get('/endpoint', { signal: controller.signal });
 * controller.abort(); // Cancel request
 * ```
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

export interface RetryConfig {
  maxRetries?: number;
  retryDelay?: number;
  retryOn?: number[];
  backoff?: 'exponential' | 'linear';
}

export interface ApiClientConfig {
  baseURL?: string;
  headers?: HeadersInit;
  credentials?: RequestCredentials;
  timeout?: number;
  retry?: RetryConfig;
}

export interface RequestOptions extends RequestInit {
  timeout?: number;
  retry?: RetryConfig;
}

export type WebSocketMessageHandler = (data: any) => void;
export type WebSocketErrorHandler = (error: Event) => void;
export type WebSocketCloseHandler = (event: CloseEvent) => void;

export class ApiClient {
  private baseURL: string;
  private defaultHeaders: HeadersInit;
  private credentials: RequestCredentials;
  private defaultTimeout: number;
  private retryConfig: RetryConfig;
  private webSockets: Map<string, WebSocket>;

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

    // Default timeout: 30 seconds
    this.defaultTimeout = config?.timeout || 30000;

    // Default retry configuration
    this.retryConfig = {
      maxRetries: 3,
      retryDelay: 1000,
      retryOn: [429, 503, 504],
      backoff: 'exponential',
      ...config?.retry,
    };

    // WebSocket connection pool
    this.webSockets = new Map();

    // Log configuration in development
    if (process.env['NODE_ENV'] === 'development') {
      console.log('[ApiClient] Configured with baseURL:', this.baseURL);
      console.log('[ApiClient] Retry config:', this.retryConfig);
    }
  }

  /**
   * GET request
   */
  async get<T = any>(endpoint: string, options?: RequestOptions): Promise<T> {
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
    options?: RequestOptions
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
    options?: RequestOptions
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
    options?: RequestOptions
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
  async delete<T = any>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'DELETE',
    });
  }

  /**
   * Core request method with retry logic and timeout
   */
  private async request<T = any>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const retryConfig = { ...this.retryConfig, ...options.retry };
    const timeout = options.timeout || this.defaultTimeout;

    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= (retryConfig.maxRetries || 0)) {
      try {
        const result = await this.executeRequest<T>(endpoint, options, timeout);
        return result;
      } catch (error) {
        lastError = error as Error;

        // Check if we should retry
        if (error instanceof ApiError) {
          const shouldRetry =
            retryConfig.retryOn?.includes(error.status) &&
            attempt < (retryConfig.maxRetries || 0);

          if (shouldRetry) {
            // Calculate delay with backoff
            const delay = this.calculateRetryDelay(
              attempt,
              retryConfig.retryDelay || 1000,
              retryConfig.backoff || 'exponential'
            );

            // Check for Retry-After header (rate limiting)
            if (error.status === 429 && error.data?.retryAfter) {
              const retryAfter = parseInt(error.data.retryAfter, 10);
              await this.sleep(retryAfter * 1000);
            } else {
              await this.sleep(delay);
            }

            attempt++;
            continue;
          }
        }

        // Don't retry, throw error
        throw error;
      }
    }

    throw lastError || new ApiError('Request failed after retries', 0);
  }

  /**
   * Execute single request with timeout
   */
  private async executeRequest<T = any>(
    endpoint: string,
    options: RequestOptions,
    timeout: number
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

    // Create AbortController for timeout (if not provided)
    const controller = options.signal
      ? undefined
      : new AbortController();
    const signal = options.signal || controller?.signal;

    // Set timeout
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), timeout)
      : undefined;

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
        signal,
      });

      // Clear timeout
      if (timeoutId) clearTimeout(timeoutId);

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
      // Clear timeout
      if (timeoutId) clearTimeout(timeoutId);

      // Re-throw ApiError as-is
      if (error instanceof ApiError) {
        throw error;
      }

      // Handle abort (timeout or manual cancellation)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError('Request timeout or cancelled', 0, {
          originalError: error,
        });
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
   * WebSocket connection for real-time communication
   */
  subscribe(
    endpoint: string,
    onMessage: WebSocketMessageHandler,
    options?: {
      onError?: WebSocketErrorHandler;
      onClose?: WebSocketCloseHandler;
      reconnect?: boolean;
    }
  ): () => void {
    // Construct WebSocket URL
    const wsURL = this.getWebSocketURL(endpoint);

    // Check if already connected
    if (this.webSockets.has(endpoint)) {
      console.warn(`[ApiClient] Already subscribed to ${endpoint}`);
      return () => this.unsubscribe(endpoint);
    }

    // Create WebSocket connection
    const ws = new WebSocket(wsURL);

    // Handle connection open
    ws.onopen = () => {
      if (process.env['NODE_ENV'] === 'development') {
        console.log(`[ApiClient] WebSocket connected: ${endpoint}`);
      }
    };

    // Handle incoming messages
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console.error('[ApiClient] Failed to parse WebSocket message:', error);
        onMessage(event.data);
      }
    };

    // Handle errors
    ws.onerror = (error) => {
      console.error(`[ApiClient] WebSocket error on ${endpoint}:`, error);
      if (options?.onError) {
        options.onError(error);
      }
    };

    // Handle close
    ws.onclose = (event) => {
      if (process.env['NODE_ENV'] === 'development') {
        console.log(`[ApiClient] WebSocket closed: ${endpoint}`, event.code, event.reason);
      }

      // Remove from pool
      this.webSockets.delete(endpoint);

      // Call onClose handler
      if (options?.onClose) {
        options.onClose(event);
      }

      // Auto-reconnect if enabled
      if (options?.reconnect && !event.wasClean) {
        setTimeout(() => {
          console.log(`[ApiClient] Reconnecting to ${endpoint}...`);
          this.subscribe(endpoint, onMessage, options);
        }, 3000);
      }
    };

    // Store in pool
    this.webSockets.set(endpoint, ws);

    // Return unsubscribe function
    return () => this.unsubscribe(endpoint);
  }

  /**
   * Unsubscribe from WebSocket
   */
  unsubscribe(endpoint: string): void {
    const ws = this.webSockets.get(endpoint);
    if (ws) {
      ws.close();
      this.webSockets.delete(endpoint);
      if (process.env['NODE_ENV'] === 'development') {
        console.log(`[ApiClient] Unsubscribed from ${endpoint}`);
      }
    }
  }

  /**
   * Send message via WebSocket
   */
  send(endpoint: string, data: any): void {
    const ws = this.webSockets.get(endpoint);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    } else {
      console.error(`[ApiClient] WebSocket not connected: ${endpoint}`);
    }
  }

  /**
   * Create Server-Sent Events (SSE) connection
   */
  createEventSource(endpoint: string): EventSource {
    const normalizedEndpoint = endpoint.startsWith('/')
      ? endpoint
      : `/${endpoint}`;
    const url = `${this.baseURL}${normalizedEndpoint}`;

    if (process.env['NODE_ENV'] === 'development') {
      console.log(`[ApiClient] Creating EventSource: ${url}`);
    }

    return new EventSource(url, { withCredentials: true });
  }

  /**
   * Get WebSocket URL from HTTP URL
   */
  private getWebSocketURL(endpoint: string): string {
    const normalizedEndpoint = endpoint.startsWith('/')
      ? endpoint
      : `/${endpoint}`;

    // If baseURL is relative (/api), use current origin
    if (this.baseURL.startsWith('/')) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}${this.baseURL}${normalizedEndpoint}`;
    }

    // If baseURL is absolute, replace http(s) with ws(s)
    const wsBaseURL = this.baseURL
      .replace('http://', 'ws://')
      .replace('https://', 'wss://');

    return `${wsBaseURL}${normalizedEndpoint}`;
  }

  /**
   * Calculate retry delay with backoff
   */
  private calculateRetryDelay(
    attempt: number,
    baseDelay: number,
    backoff: 'exponential' | 'linear'
  ): number {
    if (backoff === 'exponential') {
      return baseDelay * Math.pow(2, attempt);
    }
    return baseDelay * (attempt + 1);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

  /**
   * Close all WebSocket connections
   */
  disconnectAll(): void {
    this.webSockets.forEach((ws, endpoint) => {
      ws.close();
      if (process.env['NODE_ENV'] === 'development') {
        console.log(`[ApiClient] Disconnected from ${endpoint}`);
      }
    });
    this.webSockets.clear();
  }
}

// Export singleton instance (for backward compatibility)
export const apiClient = new ApiClient();

// Export class for custom instances
export default ApiClient;
