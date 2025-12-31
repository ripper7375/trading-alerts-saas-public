/**
 * Test 5: WebSocket Connections
 *
 * Tests the real-time notification system via WebSocket.
 * Simulates multiple clients connecting and receiving messages.
 *
 * Target: 100 concurrent WebSocket connections, reliable message delivery
 *
 * Note: Requires Socket.IO server to be running.
 * The app uses socket.io for real-time features.
 *
 * @example Run locally:
 *   k6 run k6-tests/05-websocket-load.js
 */

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';
import { BASE_URL, logConfig } from './config.js';

// Custom metrics
const wsConnected = new Counter('ws_connected');
const wsFailed = new Counter('ws_failed');
const wsMessages = new Counter('ws_messages_received');
const wsConnectionDuration = new Trend('ws_connection_duration');
const wsConnectionRate = new Rate('ws_connection_success');

// Convert HTTP URL to WebSocket URL
function getWsUrl(baseUrl) {
  return baseUrl.replace('http://', 'ws://').replace('https://', 'wss://');
}

export const options = {
  // Staged WebSocket connection test
  stages: [
    { duration: '30s', target: 50 }, // Ramp up to 50 connections
    { duration: '1m', target: 100 }, // Stay at 100 connections
    { duration: '30s', target: 0 }, // Ramp down
  ],

  // WebSocket specific thresholds
  thresholds: {
    ws_connection_success: ['rate>0.9'], // 90% connection success
    ws_connection_duration: ['p(95)<5000'], // Connect within 5s
  },

  // Tags
  tags: {
    testName: 'websocket-load',
    testType: 'realtime',
  },
};

/**
 * Setup
 */
export function setup() {
  logConfig();

  const wsUrl = getWsUrl(BASE_URL);
  console.log(`WebSocket URL: ${wsUrl}`);
  console.log('Starting WebSocket load test...');

  return {
    startTime: new Date().toISOString(),
    wsUrl: wsUrl,
  };
}

/**
 * Main test function
 */
export default function (data) {
  // Socket.IO uses HTTP upgrade at /socket.io/ endpoint
  // k6's ws module connects to raw WebSocket, so we test the upgrade endpoint
  const wsUrl = `${data.wsUrl}/socket.io/?EIO=4&transport=websocket`;

  const connectionStart = new Date();

  const res = ws.connect(wsUrl, { tags: { name: 'WebSocket Connection' } }, function (socket) {
    let connected = false;

    socket.on('open', () => {
      const connectionTime = new Date() - connectionStart;
      wsConnectionDuration.add(connectionTime);
      wsConnected.add(1);
      wsConnectionRate.add(true);
      connected = true;

      console.log(`WebSocket connected in ${connectionTime}ms`);

      // Socket.IO handshake
      // Send probe packet (Socket.IO protocol)
      socket.send('40'); // Socket.IO connect packet
    });

    socket.on('message', (msg) => {
      wsMessages.add(1);

      // Log first few messages for debugging
      if (__ITER < 5) {
        console.log(`Message received: ${msg.substring(0, 100)}`);
      }

      // Check for Socket.IO connection acknowledgment
      if (msg.startsWith('40')) {
        check(msg, {
          'Socket.IO connected': (m) => m.includes('40'),
        });
      }
    });

    socket.on('close', () => {
      console.log('WebSocket closed');
    });

    socket.on('error', (e) => {
      console.log('WebSocket error:', e.error ? e.error() : e);
      if (!connected) {
        wsFailed.add(1);
        wsConnectionRate.add(false);
      }
    });

    // Keep connection open for test duration
    // Each VU keeps one connection for ~30 seconds
    socket.setTimeout(function () {
      // Send ping to keep alive
      socket.send('2'); // Socket.IO ping
    }, 10000);

    socket.setTimeout(function () {
      socket.close();
    }, 30000);
  });

  // Check WebSocket upgrade result
  check(res, {
    'WebSocket upgrade successful': (r) => r && r.status === 101,
  });

  // If connection failed immediately
  if (!res || res.status !== 101) {
    wsFailed.add(1);
    wsConnectionRate.add(false);
    console.log(`WebSocket connection failed: ${res ? res.status : 'no response'}`);
  }

  // Small sleep between connection attempts
  sleep(1);
}

/**
 * Teardown
 */
export function teardown(data) {
  console.log(`
=====================================
WebSocket Load Test Complete
=====================================
Started: ${data.startTime}
Ended: ${new Date().toISOString()}
=====================================
  `);
}
