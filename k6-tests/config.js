/**
 * k6 Load Tests Configuration
 *
 * Configuration for all k6 load tests.
 * Set environment variables to override defaults.
 *
 * @example Run with custom base URL:
 *   BASE_URL=https://staging.example.com k6 run k6-tests/01-health-check.js
 */

// Base URL for the application (defaults to localhost for local testing)
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test user credentials (create in database before running tests)
export const TEST_USER = {
  email: __ENV.TEST_EMAIL || 'loadtest@example.com',
  password: __ENV.TEST_PASSWORD || 'LoadTest123!',
};

// Common thresholds for all tests
export const THRESHOLDS = {
  // Health check thresholds (fast endpoints)
  health: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],
    http_req_failed: ['rate<0.01'],
  },

  // Standard API thresholds
  standard: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
  },

  // External service thresholds (Stripe, etc.)
  external: {
    http_req_duration: ['p(95)<2000', 'p(99)<3000'],
    http_req_failed: ['rate<0.05'],
  },

  // Spike test thresholds (more lenient)
  spike: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

// Common request headers
export const HEADERS = {
  json: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
};

/**
 * Generate authorization header with bearer token
 * @param {string} token - JWT or session token
 * @returns {Object} Headers object with authorization
 */
export function authHeaders(token) {
  return {
    ...HEADERS.json,
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Log test configuration on startup
 */
export function logConfig() {
  console.log(`
=====================================
k6 Load Test Configuration
=====================================
Base URL: ${BASE_URL}
Test User: ${TEST_USER.email}
=====================================
  `);
}
