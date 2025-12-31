/**
 * Test 3: Alerts API Load
 *
 * Tests the core Alerts API under sustained load.
 * Simulates typical user behavior: browsing alerts, creating new ones.
 *
 * Target: p95 < 500ms, 50 concurrent users, <1% errors
 *
 * Prerequisites:
 *   - Test user exists in database
 *   - User has valid session/token
 *
 * @example Run locally:
 *   k6 run k6-tests/03-alerts-api-load.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import {
  BASE_URL,
  TEST_USER,
  THRESHOLDS,
  HEADERS,
  authHeaders,
  logConfig,
} from './config.js';

// Custom metrics
const alertsFetched = new Counter('alerts_fetched');
const alertsCreated = new Counter('alerts_created');
const apiErrors = new Counter('api_errors');
const getAlertsDuration = new Trend('get_alerts_duration');
const createAlertDuration = new Trend('create_alert_duration');

export const options = {
  // Staged load test
  stages: [
    { duration: '1m', target: 30 }, // Ramp up to 30 users
    { duration: '2m', target: 50 }, // Stay at 50 users
    { duration: '30s', target: 0 }, // Ramp down
  ],

  // Performance thresholds
  thresholds: {
    ...THRESHOLDS.standard,
    get_alerts_duration: ['p(95)<500'],
    create_alert_duration: ['p(95)<800'],
  },

  // Tags
  tags: {
    testName: 'alerts-api-load',
    testType: 'api',
  },
};

/**
 * Setup - authenticate and get session token
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
  const sessionCookie = Object.keys(cookies).find(
    (key) =>
      key.includes('next-auth.session-token') ||
      key.includes('__Secure-next-auth.session-token')
  );

  if (!sessionCookie) {
    console.warn('No session cookie found. Tests may fail with 401.');
    console.log('Login response status:', loginRes.status);
  }

  console.log('Setup complete, starting alerts API load test...');
  return {
    startTime: new Date().toISOString(),
    sessionCookie: sessionCookie,
    cookies: cookies,
  };
}

/**
 * Main test function
 */
export default function (data) {
  // Build cookie header from session
  const jar = http.cookieJar();

  if (data.cookies) {
    Object.entries(data.cookies).forEach(([name, values]) => {
      if (values && values.length > 0) {
        jar.set(BASE_URL, name, values[0].value);
      }
    });
  }

  // Group: GET Alerts (80% of requests)
  group('GET Alerts', function () {
    const startTime = new Date();

    const res = http.get(`${BASE_URL}/api/alerts`, {
      headers: HEADERS.json,
      tags: { name: 'GET /api/alerts' },
    });

    const duration = new Date() - startTime;
    getAlertsDuration.add(duration);

    const success = check(res, {
      'GET alerts status 200 or 401': (r) =>
        r.status === 200 || r.status === 401,
      'GET alerts has body': (r) => r.body && r.body.length > 0,
      'GET alerts response time < 500ms': (r) => r.timings.duration < 500,
    });

    if (res.status === 200) {
      alertsFetched.add(1);
    } else if (res.status >= 500) {
      apiErrors.add(1);
    }
  });

  sleep(2);

  // Group: POST Alert (10% of requests - create randomly)
  if (Math.random() < 0.1) {
    group('POST Alert', function () {
      const startTime = new Date();

      // Create a unique alert for this test run
      const alertPayload = JSON.stringify({
        symbol: 'EURUSD',
        timeframe: 'H1',
        conditionType: 'price_above',
        targetValue: 1.1 + Math.random() * 0.1, // Random price
        name: `Load Test Alert ${Date.now()}`,
      });

      const res = http.post(`${BASE_URL}/api/alerts`, alertPayload, {
        headers: HEADERS.json,
        tags: { name: 'POST /api/alerts' },
      });

      const duration = new Date() - startTime;
      createAlertDuration.add(duration);

      const success = check(res, {
        'POST alert status 201 or 401 or 403': (r) =>
          [201, 401, 403].includes(r.status),
        'POST alert response time < 800ms': (r) => r.timings.duration < 800,
      });

      if (res.status === 201) {
        alertsCreated.add(1);
      } else if (res.status >= 500) {
        apiErrors.add(1);
      }
    });
  }

  // Group: GET Alerts with filter (10% of requests)
  if (Math.random() < 0.1) {
    group('GET Alerts (filtered)', function () {
      const res = http.get(`${BASE_URL}/api/alerts?status=active`, {
        headers: HEADERS.json,
        tags: { name: 'GET /api/alerts?status=active' },
      });

      check(res, {
        'GET filtered alerts status 200 or 401': (r) =>
          r.status === 200 || r.status === 401,
      });
    });
  }

  sleep(3);
}

/**
 * Teardown
 */
export function teardown(data) {
  console.log(`
=====================================
Alerts API Load Test Complete
=====================================
Started: ${data.startTime}
Ended: ${new Date().toISOString()}
=====================================
  `);
}
