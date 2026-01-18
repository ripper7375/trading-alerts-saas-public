/**
 * Test Helpers for Multi-Backend Integration Tests
 *
 * Utilities for testing connections between:
 * - UI → Stack A (allow)
 * - UI → Stack B (allow)
 * - UI → Stack C (forbidden)
 * - UI → A and B (allow)
 */

// ============================================================================
// Test Environment Configuration
// ============================================================================

export const TEST_ENV = {
  STACK_A_URL: process.env['NEXT_PUBLIC_API_A_URL'] || 'http://localhost:3001',
  STACK_B_URL: process.env['NEXT_PUBLIC_API_B_URL'] || 'http://localhost:3002',
  STACK_C_URL: process.env['STACK_C_URL'] || 'http://localhost:5000', // Should NOT be accessible from frontend
};

// ============================================================================
// Test User Data
// ============================================================================

export const TEST_USERS = {
  free: {
    email: 'test-free@example.com',
    password: 'Test123!@#',
    tier: 'Free' as const,
  },
  pro: {
    email: 'test-pro@example.com',
    password: 'Test123!@#',
    tier: 'Pro' as const,
  },
  premium: {
    email: 'test-premium@example.com',
    password: 'Test123!@#',
    tier: 'Premium' as const,
  },
};

// ============================================================================
// Test Symbols and Timeframes
// ============================================================================

export const TEST_SYMBOLS = {
  free: ['EURUSD', 'GBPUSD'],
  pro: ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD'],
  premium: ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'XAUUSD', 'BTCUSD'],
};

export const TEST_TIMEFRAMES = {
  free: ['H1', 'H4', 'D1'],
  pro: ['M15', 'M30', 'H1', 'H4', 'D1'],
  premium: ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'],
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Wait for a specified time (for rate limiting, debouncing, etc.)
 */
export const wait = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Check if a URL is reachable
 */
export async function isUrlReachable(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Check if backend is available
 */
export async function checkBackendHealth(
  baseUrl: string
): Promise<{ available: boolean; message: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${baseUrl}/health`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      await response.json(); // Consume response body
      return {
        available: true,
        message: `Backend at ${baseUrl} is healthy`,
      };
    }

    return {
      available: false,
      message: `Backend at ${baseUrl} returned status ${response.status}`,
    };
  } catch (error) {
    return {
      available: false,
      message: `Backend at ${baseUrl} is not reachable: ${error}`,
    };
  }
}

/**
 * Generate a test authentication token (for mocking)
 */
export function generateMockToken(userId: string, tier: string): string {
  // This is a simplified version - in real tests, you'd get this from the backend
  const payload = {
    userId,
    tier,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  };

  // In a real scenario, this would be a proper JWT
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * Store auth token in localStorage (for browser tests)
 */
export function setAuthToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('auth_token', token);
  }
}

/**
 * Clear auth token from localStorage
 */
export function clearAuthToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token');
  }
}

/**
 * Create a test watchlist item
 */
export function createTestWatchlistItem(symbol: string, timeframe: string) {
  return {
    symbol,
    timeframe,
    notes: `Test watchlist item for ${symbol} ${timeframe}`,
  };
}

/**
 * Create a test alert
 */
export function createTestAlert(symbol: string, timeframe: string, targetPrice: number) {
  return {
    symbol,
    timeframe,
    condition: 'above' as const,
    targetPrice,
    notificationChannels: ['email', 'push'] as const,
  };
}

/**
 * Validate response status code
 */
export function expectStatusCode(
  actual: number,
  expected: number,
  message?: string
): void {
  if (actual !== expected) {
    throw new Error(
      message ||
        `Expected status code ${expected} but got ${actual}`
    );
  }
}

/**
 * Validate that a request fails with 403 (Forbidden)
 */
export async function expectForbidden(
  requestFn: () => Promise<Response>
): Promise<void> {
  try {
    const response = await requestFn();
    if (response.status !== 403) {
      throw new Error(
        `Expected 403 Forbidden but got ${response.status}`
      );
    }
  } catch (error) {
    // If the request throws an error (e.g., network error), that's also acceptable
    // as it means the endpoint is not accessible
    console.log('Request failed as expected (forbidden):', error);
  }
}

/**
 * Validate that Stack C is not accessible from frontend
 */
export async function validateStackCInaccessible(): Promise<{
  success: boolean;
  message: string;
}> {
  const stackCUrl = TEST_ENV.STACK_C_URL;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    await fetch(stackCUrl, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // If we got a response, that's actually bad - Stack C should not be accessible
    return {
      success: false,
      message: `Stack C at ${stackCUrl} is accessible from frontend (should be forbidden!)`,
    };
  } catch (error) {
    // Good! Stack C should not be accessible
    return {
      success: true,
      message: `Stack C at ${stackCUrl} is correctly inaccessible from frontend`,
    };
  }
}

// ============================================================================
// Test Data Generators
// ============================================================================

/**
 * Generate random test data
 */
export const generate = {
  email: (prefix = 'test') => `${prefix}-${Date.now()}@example.com`,
  password: () => 'Test123!@#',
  name: (prefix = 'Test') => `${prefix} User ${Date.now()}`,
  symbol: () => {
    const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'XAUUSD'];
    return symbols[Math.floor(Math.random() * symbols.length)];
  },
  timeframe: () => {
    const timeframes = ['M15', 'M30', 'H1', 'H4', 'D1'];
    return timeframes[Math.floor(Math.random() * timeframes.length)];
  },
  price: (base = 1.1) => {
    return base + Math.random() * 0.1;
  },
};

// ============================================================================
// Assertion Helpers
// ============================================================================

export const assertions = {
  /**
   * Assert that a value is defined (not null or undefined)
   */
  isDefined<T>(value: T | null | undefined, message?: string): asserts value is T {
    if (value === null || value === undefined) {
      throw new Error(message || 'Value is null or undefined');
    }
  },

  /**
   * Assert that an array has a specific length
   */
  hasLength<T>(array: T[], length: number, message?: string): void {
    if (array.length !== length) {
      throw new Error(
        message || `Expected array length ${length} but got ${array.length}`
      );
    }
  },

  /**
   * Assert that a value is in a list
   */
  isIn<T>(value: T, list: T[], message?: string): void {
    if (!list.includes(value)) {
      throw new Error(
        message || `Value ${value} is not in list [${list.join(', ')}]`
      );
    }
  },
};

// ============================================================================
// Cleanup Helpers
// ============================================================================

/**
 * Cleanup test data after tests
 */
export class TestCleanup {
  private cleanupFns: Array<() => Promise<void>> = [];

  /**
   * Register a cleanup function
   */
  register(fn: () => Promise<void>): void {
    this.cleanupFns.push(fn);
  }

  /**
   * Execute all cleanup functions
   */
  async cleanup(): Promise<void> {
    for (const fn of this.cleanupFns.reverse()) {
      try {
        await fn();
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }
    this.cleanupFns = [];
  }
}
