/**
 * Test 4: Stripe Checkout Load
 *
 * Tests the payment/checkout flow under load.
 * Uses Stripe test mode for safe load testing.
 *
 * Target: p95 < 2s (external Stripe calls), 10 concurrent checkouts, <5% errors
 *
 * Note: This test creates Stripe checkout sessions but doesn't complete payments.
 * Stripe test mode handles this gracefully.
 *
 * @example Run locally:
 *   k6 run k6-tests/04-checkout-load.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import {
  BASE_URL,
  TEST_USER,
  THRESHOLDS,
  HEADERS,
  logConfig,
} from './config.js';

// Custom metrics
const checkoutCreated = new Counter('checkout_created');
const checkoutFailed = new Counter('checkout_failed');
const checkoutDuration = new Trend('checkout_duration');

export const options = {
  // Conservative load for checkout (Stripe rate limits)
  stages: [
    { duration: '30s', target: 5 }, // Ramp up to 5 users
    { duration: '1m', target: 10 }, // Stay at 10 users
    { duration: '30s', target: 0 }, // Ramp down
  ],

  // More lenient thresholds for external Stripe calls
  thresholds: {
    ...THRESHOLDS.external,
    checkout_duration: ['p(95)<2000'],
  },

  // Tags
  tags: {
    testName: 'checkout-load',
    testType: 'payment',
  },
};

/**
 * Setup - authenticate user
 */
export function setup() {
  logConfig();

  // Get CSRF token
  const csrfRes = http.get(`${BASE_URL}/api/auth/csrf`);
  let csrfToken = '';
  try {
    csrfToken = JSON.parse(csrfRes.body).csrfToken || '';
  } catch {
    console.warn('Could not get CSRF token');
  }

  // Login to get session
  const loginRes = http.post(
    `${BASE_URL}/api/auth/callback/credentials`,
    {
      email: TEST_USER.email,
      password: TEST_USER.password,
      csrfToken: csrfToken,
      json: 'true',
    },
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirects: 0,
    }
  );

  // Extract session cookie
  const cookies = loginRes.cookies;

  console.log('Setup complete, starting checkout load test...');
  console.log('NOTE: Using Stripe TEST mode - no real charges will occur.');

  return {
    startTime: new Date().toISOString(),
    cookies: cookies,
  };
}

/**
 * Main test function
 */
export default function (data) {
  // Build cookies from session
  const jar = http.cookieJar();

  if (data.cookies) {
    Object.entries(data.cookies).forEach(([name, values]) => {
      if (values && values.length > 0) {
        jar.set(BASE_URL, name, values[0].value);
      }
    });
  }

  group('Create Checkout Session', function () {
    const startTime = new Date();

    // POST /api/checkout - create Stripe checkout session
    const res = http.post(
      `${BASE_URL}/api/checkout`,
      JSON.stringify({}), // Empty body - uses default tier upgrade
      {
        headers: HEADERS.json,
        tags: { name: 'POST /api/checkout' },
        timeout: '30s', // Longer timeout for Stripe
      }
    );

    const duration = new Date() - startTime;
    checkoutDuration.add(duration);

    // Check response
    const checkResults = check(res, {
      'checkout status valid': (r) => [200, 400, 401].includes(r.status),
      'response time < 2000ms': (r) => r.timings.duration < 2000,
      'has session or error': (r) => {
        try {
          const body = JSON.parse(r.body);
          // Either has sessionId (success) or error (expected failures)
          return body.sessionId !== undefined || body.error !== undefined;
        } catch {
          return false;
        }
      },
    });

    if (res.status === 200) {
      checkoutCreated.add(1);

      // Verify response structure
      try {
        const body = JSON.parse(res.body);
        check(body, {
          'has sessionId': (b) => b.sessionId !== undefined,
          'has Stripe URL': (b) => b.url && b.url.includes('stripe.com'),
        });
      } catch {
        // Parse error handled above
      }
    } else {
      checkoutFailed.add(1);

      // Log failure reason for debugging
      if (res.status === 401) {
        // Expected if session not valid
        console.log('Checkout unauthorized (expected if no valid session)');
      } else if (res.status === 400) {
        // Already PRO or other validation error
        try {
          const body = JSON.parse(res.body);
          console.log(`Checkout validation error: ${body.code}`);
        } catch {
          console.log(`Checkout failed: ${res.status}`);
        }
      } else if (res.status >= 500) {
        console.log(`Checkout server error: ${res.status}, ${res.body}`);
      }
    }
  });

  // Wait between checkout attempts (users take time to decide)
  sleep(Math.random() * 3 + 5); // 5-8 seconds
}

/**
 * Teardown
 */
export function teardown(data) {
  console.log(`
=====================================
Checkout Load Test Complete
=====================================
Started: ${data.startTime}
Ended: ${new Date().toISOString()}

NOTE: All checkout sessions were created in Stripe TEST mode.
No real charges occurred.
=====================================
  `);
}
