/**
 * Test 6: Spike Test (Burst Traffic)
 *
 * Tests how the system handles sudden traffic spikes.
 * Simulates a scenario where traffic increases 10x suddenly.
 *
 * Target: System doesn't crash, recovers after spike, rate limiting works
 *
 * @example Run locally:
 *   k6 run k6-tests/06-spike-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { BASE_URL, THRESHOLDS, HEADERS, logConfig } from './config.js';

// Custom metrics
const requestsSuccess = new Counter('requests_success');
const requestsRateLimited = new Counter('requests_rate_limited');
const requestsFailed = new Counter('requests_failed');
const responseTime = new Trend('response_time');
const successRate = new Rate('success_rate');

export const options = {
  // Spike pattern: normal -> spike -> normal -> ramp down
  stages: [
    { duration: '10s', target: 10 }, // Normal load baseline
    { duration: '5s', target: 100 }, // SPIKE: Rapid increase to 100 users
    { duration: '30s', target: 100 }, // Stay at spike level
    { duration: '5s', target: 10 }, // Rapid decrease back to normal
    { duration: '20s', target: 10 }, // Recovery period at normal load
    { duration: '10s', target: 0 }, // Ramp down
  ],

  // More lenient thresholds for spike test
  thresholds: {
    ...THRESHOLDS.spike,
    success_rate: ['rate>0.80'], // Allow 20% degradation during spike
  },

  // Tags
  tags: {
    testName: 'spike-test',
    testType: 'stress',
  },
};

/**
 * Setup
 */
export function setup() {
  logConfig();

  // Verify endpoints are accessible before spike
  const endpoints = [
    '/api/disbursement/health',
    '/api/watchlist',
    '/api/tier/symbols',
  ];

  endpoints.forEach((endpoint) => {
    const res = http.get(`${BASE_URL}${endpoint}`, {
      headers: HEADERS.json,
      timeout: '5s',
    });
    console.log(`Pre-test ${endpoint}: ${res.status}`);
  });

  console.log('Starting spike test...');
  console.log('WARNING: This test will generate high load. Monitor your system!');

  return {
    startTime: new Date().toISOString(),
    phase: 'setup',
  };
}

/**
 * Main test function
 */
export default function () {
  // Determine current phase based on iteration timing
  // This helps in analyzing results by phase
  const currentVUs = __VU;
  const isSpike = currentVUs > 50;

  // Mix of endpoints to test system holistically
  const endpoints = [
    { path: '/api/disbursement/health', weight: 0.3, name: 'health' },
    { path: '/api/watchlist', weight: 0.3, name: 'watchlist' },
    { path: '/api/tier/symbols', weight: 0.2, name: 'symbols' },
    { path: '/api/alerts', weight: 0.2, name: 'alerts' },
  ];

  // Select endpoint based on weight
  const rand = Math.random();
  let cumWeight = 0;
  let selectedEndpoint = endpoints[0];

  for (const ep of endpoints) {
    cumWeight += ep.weight;
    if (rand <= cumWeight) {
      selectedEndpoint = ep;
      break;
    }
  }

  group(`Request: ${selectedEndpoint.name}`, function () {
    const startTime = new Date();

    const res = http.get(`${BASE_URL}${selectedEndpoint.path}`, {
      headers: HEADERS.json,
      tags: {
        name: `GET ${selectedEndpoint.path}`,
        endpoint: selectedEndpoint.name,
        phase: isSpike ? 'spike' : 'normal',
      },
      timeout: '10s',
    });

    const duration = new Date() - startTime;
    responseTime.add(duration);

    // Categorize response
    if (res.status === 200) {
      requestsSuccess.add(1);
      successRate.add(true);
    } else if (res.status === 429) {
      // Rate limited - this is expected during spike
      requestsRateLimited.add(1);
      successRate.add(true); // Rate limiting is correct behavior
    } else if (res.status === 401) {
      // Unauthorized - expected for protected endpoints
      requestsSuccess.add(1);
      successRate.add(true);
    } else {
      requestsFailed.add(1);
      successRate.add(false);
    }

    // Checks
    check(res, {
      'status is 200, 401, or 429': (r) => [200, 401, 429].includes(r.status),
      'response received': (r) => r.body && r.body.length > 0,
      'response time < 1000ms': (r) => r.timings.duration < 1000,
    });

    // Log concerning responses
    if (res.status >= 500) {
      console.log(
        `Server error: ${selectedEndpoint.path} returned ${res.status}`
      );
    }
  });

  // Shorter sleep during spike to increase load
  const sleepTime = Math.random() * 0.5 + 0.5; // 0.5-1 second
  sleep(sleepTime);
}

/**
 * Teardown
 */
export function teardown(data) {
  console.log(`
=====================================
Spike Test Complete
=====================================
Started: ${data.startTime}
Ended: ${new Date().toISOString()}

Test Phases:
1. Normal (10s): 10 users baseline
2. Spike (35s): 100 users (10x increase)
3. Recovery (20s): Back to 10 users
4. Ramp down (10s): Graceful shutdown

Key Observations:
- Check if p95 response time stayed under 1000ms
- Check if error rate stayed under 5%
- Check if rate limiting (429) was triggered during spike
- Verify system recovered after spike
=====================================
  `);
}
