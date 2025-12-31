/**
 * Test 1: Health Check (Baseline)
 *
 * Verifies the application responds under minimal load.
 * This is the simplest test to ensure the app is running.
 *
 * Target: p95 < 200ms, 0% errors
 *
 * @example Run locally:
 *   k6 run k6-tests/01-health-check.js
 *
 * @example Run against staging:
 *   BASE_URL=https://staging.example.com k6 run k6-tests/01-health-check.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, THRESHOLDS, HEADERS, logConfig } from './config.js';

export const options = {
  // Test configuration
  vus: 10, // 10 virtual users
  duration: '30s', // 30 second test

  // Performance thresholds
  thresholds: THRESHOLDS.health,

  // Tags for result filtering
  tags: {
    testName: 'health-check',
    testType: 'baseline',
  },
};

/**
 * Setup function - runs once before all VUs start
 */
export function setup() {
  logConfig();

  // Verify the endpoint is accessible
  const res = http.get(`${BASE_URL}/api/disbursement/health`, {
    headers: HEADERS.json,
    timeout: '10s',
  });

  if (res.status !== 200 && res.status !== 503) {
    throw new Error(
      `Health endpoint not accessible. Status: ${res.status}, Body: ${res.body}`
    );
  }

  console.log('Health endpoint verified, starting load test...');
  return { startTime: new Date().toISOString() };
}

/**
 * Main test function - runs for each VU iteration
 */
export default function () {
  // GET /api/disbursement/health
  const res = http.get(`${BASE_URL}/api/disbursement/health`, {
    headers: HEADERS.json,
    tags: { name: 'GET /api/disbursement/health' },
  });

  // Verify response
  const checkResults = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
    'has healthy field': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.healthy !== undefined;
      } catch {
        return false;
      }
    },
    'has timestamp': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.timestamp !== undefined;
      } catch {
        return false;
      }
    },
  });

  // Log failures for debugging
  if (!checkResults) {
    console.log(`Check failed: status=${res.status}, body=${res.body}`);
  }

  // Wait between requests (simulates real user behavior)
  sleep(1);
}

/**
 * Teardown function - runs once after all VUs complete
 */
export function teardown(data) {
  console.log(`
=====================================
Health Check Test Complete
=====================================
Started: ${data.startTime}
Ended: ${new Date().toISOString()}
=====================================
  `);
}
