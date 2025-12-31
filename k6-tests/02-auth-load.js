/**
 * Test 2: Authentication Load
 *
 * Tests the login/authentication flow under realistic load.
 * Uses NextAuth credentials provider.
 *
 * Target: p95 < 500ms, 50 concurrent users, <1% errors
 *
 * Prerequisites:
 *   Create test user in database:
 *   INSERT INTO users (email, password, tier) VALUES ('loadtest@example.com', '<hashed>', 'FREE');
 *
 * @example Run locally:
 *   k6 run k6-tests/02-auth-load.js
 *
 * @example Run with custom credentials:
 *   TEST_EMAIL=user@test.com TEST_PASSWORD=secret123 k6 run k6-tests/02-auth-load.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { BASE_URL, TEST_USER, THRESHOLDS, HEADERS, logConfig } from './config.js';

// Custom metrics
const loginSuccess = new Counter('login_success');
const loginFailure = new Counter('login_failure');
const loginRate = new Rate('login_success_rate');
const loginDuration = new Trend('login_duration');

export const options = {
  // Staged load test
  stages: [
    { duration: '30s', target: 20 }, // Ramp up to 20 users
    { duration: '1m', target: 50 }, // Stay at 50 users
    { duration: '30s', target: 0 }, // Ramp down
  ],

  // Performance thresholds
  thresholds: {
    ...THRESHOLDS.standard,
    login_success_rate: ['rate>0.95'], // 95% success rate
    login_duration: ['p(95)<500'], // 95% under 500ms
  },

  // Tags
  tags: {
    testName: 'auth-load',
    testType: 'authentication',
  },
};

/**
 * Setup - verify auth endpoint is accessible
 */
export function setup() {
  logConfig();

  // Check CSRF token endpoint (NextAuth uses this)
  const csrfRes = http.get(`${BASE_URL}/api/auth/csrf`, {
    headers: HEADERS.json,
  });

  if (csrfRes.status !== 200) {
    console.warn(
      `CSRF endpoint returned ${csrfRes.status}. Auth tests may fail.`
    );
  }

  console.log('Auth endpoints verified, starting load test...');
  return {
    startTime: new Date().toISOString(),
    csrfAvailable: csrfRes.status === 200,
  };
}

/**
 * Main test function
 */
export default function (data) {
  const startTime = new Date();

  // Step 1: Get CSRF token (required by NextAuth)
  const csrfRes = http.get(`${BASE_URL}/api/auth/csrf`, {
    headers: HEADERS.json,
    tags: { name: 'GET /api/auth/csrf' },
  });

  let csrfToken = '';
  try {
    const csrfBody = JSON.parse(csrfRes.body);
    csrfToken = csrfBody.csrfToken || '';
  } catch {
    console.log('Failed to parse CSRF response');
  }

  // Step 2: Attempt login via NextAuth credentials provider
  const loginPayload = {
    email: TEST_USER.email,
    password: TEST_USER.password,
    csrfToken: csrfToken,
    callbackUrl: `${BASE_URL}/dashboard`,
    json: 'true',
  };

  const loginRes = http.post(
    `${BASE_URL}/api/auth/callback/credentials`,
    loginPayload,
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      tags: { name: 'POST /api/auth/callback/credentials' },
      redirects: 0, // Don't follow redirects
    }
  );

  // Check login result
  // NextAuth returns 302 redirect on success, 401 on failure
  const isSuccess = loginRes.status === 200 || loginRes.status === 302;

  const checkResults = check(loginRes, {
    'login successful (200 or 302)': () => isSuccess,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'no server error': (r) => r.status < 500,
  });

  // Update metrics
  const duration = new Date() - startTime;
  loginDuration.add(duration);

  if (isSuccess) {
    loginSuccess.add(1);
    loginRate.add(true);
  } else {
    loginFailure.add(1);
    loginRate.add(false);
    console.log(
      `Login failed: status=${loginRes.status}, body=${loginRes.body.substring(0, 200)}`
    );
  }

  // Wait between attempts (simulates real user behavior)
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

/**
 * Teardown
 */
export function teardown(data) {
  console.log(`
=====================================
Auth Load Test Complete
=====================================
Started: ${data.startTime}
Ended: ${new Date().toISOString()}
=====================================
  `);
}
