# Phase 5: Load & Performance Testing (MVP - Option A)

## Context & Mission

You are tasked with implementing **minimal but effective load and performance testing** for the Trading Alerts SaaS V7 platform before production launch. This is the **final validation phase** before going live.

**Your mission:** Ensure the application can handle expected MVP traffic loads without degrading performance or crashing, using k6 for load testing and Apache Bench for quick sanity checks.

---

## Prerequisites

✅ **Phase 1 completed:** Parts 1-15 tested (Unit + Integration + Supertest)
✅ **Phase 2 completed:** Part 16 (Utilities) tested
✅ **Phase 3 completed:** Parts 17A, 17B, 18 built with TDD
✅ **Phase 4 completed:** E2E tests passing with Playwright

**Repository:** https://github.com/ripper7375/trading-alerts-saas-v7

---

## Why Load & Performance Testing?

### **What Load Tests Validate (That Other Tests Don't)**

Functional tests verify features work, but **don't catch:**

- ❌ API becomes slow under 50 concurrent users
- ❌ Database connections exhausted at 100 requests/second
- ❌ Memory leak causes crash after 1 hour
- ❌ Stripe webhook queue backs up under load
- ❌ WebSocket connections drop after 100 clients
- ❌ Response times degrade from 100ms to 5s under load

**Load tests simulate real traffic** and catch these scalability issues before users do.

---

## Option A: Minimal Phase 5 (2 Days)

**Focus:** Test critical paths only, set baseline metrics, skip deep profiling.

**Tools:**

- ✅ **k6** (primary load testing tool)
- ✅ **Apache Bench** (quick HTTP benchmarks)
- ⏸️ **Clinic.js / 0x** (skip for MVP, use later if issues found)

**Philosophy:** Ship faster, optimize based on real user feedback.

---

## MVP Load Targets

Set realistic targets for early-stage SaaS:

| Metric                    | Target  | Reasoning                                    |
| ------------------------- | ------- | -------------------------------------------- |
| **Concurrent Users**      | 50-100  | MVP unlikely to have 1000s of users on day 1 |
| **Requests/Second**       | 100-200 | Adequate for small user base                 |
| **Response Time (p95)**   | <500ms  | Good UX for web apps                         |
| **Response Time (p99)**   | <1000ms | Acceptable for 99% of requests               |
| **Error Rate**            | <1%     | 99% success rate is acceptable               |
| **WebSocket Connections** | 100     | Enough for real-time notifications           |

---

## k6 Setup & Installation

### **Install k6**

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
choco install k6

# Or use Docker
docker pull grafana/k6
```

### **Verify Installation**

```bash
k6 version
# k6 v0.48.0 (or similar)
```

---

## Critical Load Tests (6 Tests)

Create `k6-tests/` directory with the following tests:

### **Test 1: Health Check (Baseline)**

Verify app responds under minimal load.

```javascript
// k6-tests/01-health-check.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10, // 10 virtual users
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95% under 200ms
    http_req_failed: ['rate<0.01'], // <1% errors
  },
};

export default function () {
  const res = http.get('https://your-app-url.com/api/health');

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
    'has status field': (r) => r.json('status') === 'healthy',
  });

  sleep(1);
}
```

**Run:**

```bash
k6 run k6-tests/01-health-check.js
```

**Success criteria:**

- ✅ p95 response time < 200ms
- ✅ 0% error rate
- ✅ All checks pass

---

### **Test 2: Authentication Load**

Test login endpoint under realistic load.

```javascript
// k6-tests/02-auth-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Ramp up to 20 users
    { duration: '1m', target: 50 }, // Stay at 50 users
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const payload = JSON.stringify({
    email: 'loadtest@example.com',
    password: 'LoadTest123!',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(
    'https://your-app-url.com/api/auth/signin',
    payload,
    params
  );

  check(res, {
    'login successful': (r) => r.status === 200,
    'has token': (r) => r.json('token') !== undefined,
    'response time OK': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

**Preparation:**
Create test user in database:

```sql
INSERT INTO users (email, password_hash, tier)
VALUES ('loadtest@example.com', 'hashed_password', 'FREE');
```

**Success criteria:**

- ✅ Handles 50 concurrent logins
- ✅ p95 < 500ms
- ✅ <1% error rate

---

### **Test 3: API Endpoint Load (Alerts)**

Test core API under sustained load.

```javascript
// k6-tests/03-alerts-api-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

// Test user credentials
const TEST_EMAIL = 'loadtest@example.com';
const TEST_PASSWORD = 'LoadTest123!';

let authToken = '';

export function setup() {
  // Login once to get token
  const loginRes = http.post(
    'https://your-app-url.com/api/auth/signin',
    JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  return { token: loginRes.json('token') };
}

export const options = {
  stages: [
    { duration: '1m', target: 30 },
    { duration: '2m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function (data) {
  const params = {
    headers: {
      Authorization: `Bearer ${data.token}`,
      'Content-Type': 'application/json',
    },
  };

  // GET alerts
  const getRes = http.get('https://your-app-url.com/api/alerts', params);

  check(getRes, {
    'GET alerts success': (r) => r.status === 200,
    'has alerts array': (r) => Array.isArray(r.json('alerts')),
    'response time OK': (r) => r.timings.duration < 500,
  });

  sleep(2);

  // POST new alert (10% of requests)
  if (Math.random() < 0.1) {
    const createRes = http.post(
      'https://your-app-url.com/api/alerts',
      JSON.stringify({
        symbol: 'EURUSD',
        condition: 'above',
        price: 1.1,
        message: 'Load test alert',
      }),
      params
    );

    check(createRes, {
      'POST alert success': (r) => r.status === 201,
      'has alert ID': (r) => r.json('alert.id') !== undefined,
    });
  }

  sleep(3);
}
```

**Success criteria:**

- ✅ Handles 50 concurrent users
- ✅ p95 < 500ms for GET
- ✅ p99 < 1000ms for POST
- ✅ <1% error rate

---

### **Test 4: Stripe Checkout Load**

Test payment flow under load.

```javascript
// k6-tests/04-checkout-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export function setup() {
  const loginRes = http.post(
    'https://your-app-url.com/api/auth/signin',
    JSON.stringify({
      email: 'loadtest@example.com',
      password: 'LoadTest123!',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  return { token: loginRes.json('token') };
}

export const options = {
  stages: [
    { duration: '1m', target: 10 }, // Only 10 concurrent checkouts
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // Stripe can be slower
    http_req_failed: ['rate<0.05'], // 5% error tolerance
  },
};

export default function (data) {
  const params = {
    headers: {
      Authorization: `Bearer ${data.token}`,
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(
    'https://your-app-url.com/api/checkout',
    JSON.stringify({ tier: 'PRO' }),
    params
  );

  check(res, {
    'checkout created': (r) => r.status === 200,
    'has sessionId': (r) => r.json('sessionId') !== undefined,
    'has Stripe URL': (r) => r.json('url').includes('stripe.com'),
  });

  sleep(5); // Users take time to complete checkout
}
```

**Success criteria:**

- ✅ Handles 10 concurrent checkouts
- ✅ p95 < 2s (external Stripe call)
- ✅ <5% error rate

---

### **Test 5: WebSocket Connections**

Test real-time notification system.

```javascript
// k6-tests/05-websocket-load.js
import ws from 'k6/ws';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 }, // 50 concurrent connections
    { duration: '1m', target: 100 }, // Increase to 100
    { duration: '30s', target: 0 }, // Ramp down
  ],
};

export default function () {
  const url = 'wss://your-app-url.com/ws';
  const params = { tags: { name: 'WebSocketTest' } };

  const res = ws.connect(url, params, function (socket) {
    socket.on('open', () => {
      console.log('Connected');

      // Subscribe to notifications
      socket.send(
        JSON.stringify({
          type: 'subscribe',
          channel: 'notifications',
        })
      );
    });

    socket.on('message', (data) => {
      const msg = JSON.parse(data);
      check(msg, {
        'message received': (m) => m !== undefined,
        'has type field': (m) => m.type !== undefined,
      });
    });

    socket.on('close', () => {
      console.log('Disconnected');
    });

    socket.on('error', (e) => {
      console.log('WebSocket error:', e.error());
    });

    // Keep connection open for 30 seconds
    socket.setTimeout(() => {
      socket.close();
    }, 30000);
  });

  check(res, {
    'WebSocket connected': (r) => r && r.status === 101,
  });
}
```

**Success criteria:**

- ✅ Handles 100 concurrent WebSocket connections
- ✅ Messages delivered reliably
- ✅ No connection drops

---

### **Test 6: Spike Test (Burst Traffic)**

Test how system handles sudden traffic spikes.

```javascript
// k6-tests/06-spike-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 10 }, // Normal load
    { duration: '30s', target: 100 }, // Sudden spike
    { duration: '10s', target: 10 }, // Back to normal
    { duration: '10s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // More lenient during spike
    http_req_failed: ['rate<0.05'], // 5% error tolerance
  },
};

export default function () {
  const res = http.get('https://your-app-url.com/api/watchlist');

  check(res, {
    'status is 200 or 429': (r) => [200, 429].includes(r.status),
    'response received': (r) => r.body.length > 0,
  });

  sleep(1);
}
```

**Success criteria:**

- ✅ System doesn't crash during spike
- ✅ Rate limiting kicks in (429 responses acceptable)
- ✅ Recovers to normal after spike

---

## Apache Bench Quick Checks

Use Apache Bench for rapid sanity checks during development.

### **Install Apache Bench**

```bash
# Usually pre-installed on macOS/Linux
ab -V

# Ubuntu/Debian
sudo apt-get install apache2-utils

# CentOS/RHEL
sudo yum install httpd-tools
```

### **Quick Test Examples**

**Test 1: API Health Check**

```bash
ab -n 1000 -c 10 https://your-app-url.com/api/health
```

**Test 2: Login Endpoint**

```bash
ab -n 500 -c 5 -p login-payload.json -T application/json \
   https://your-app-url.com/api/auth/signin
```

Create `login-payload.json`:

```json
{
  "email": "loadtest@example.com",
  "password": "LoadTest123!"
}
```

**Test 3: Authenticated Endpoint**

```bash
ab -n 1000 -c 20 -H "Authorization: Bearer YOUR_TOKEN" \
   https://your-app-url.com/api/alerts
```

**Interpreting Results:**

```
Requests per second:    150.23 [#/sec] (mean)
Time per request:       66.564 [ms] (mean)
Time per request:       6.656 [ms] (mean, across all concurrent requests)
```

**Good for MVP:**

- ✅ Requests/sec: >100
- ✅ Time per request: <100ms
- ✅ Failed requests: 0%

---

## Performance Baselines (Document These)

Create `performance-baseline.md` to track metrics:

```markdown
# Performance Baseline (MVP)

**Date:** YYYY-MM-DD
**Environment:** Production
**Load Testing Tool:** k6 v0.48.0

## Test Results

### Health Check

- Concurrent Users: 10
- Duration: 30s
- p95 Response Time: 85ms ✅
- p99 Response Time: 120ms ✅
- Error Rate: 0% ✅

### Authentication Load

- Concurrent Users: 50
- Duration: 2min
- p95 Response Time: 320ms ✅
- p99 Response Time: 480ms ✅
- Error Rate: 0% ✅

### Alerts API Load

- Concurrent Users: 50
- Duration: 3.5min
- GET p95: 280ms ✅
- POST p95: 450ms ✅
- Error Rate: 0% ✅

### Checkout Load

- Concurrent Users: 10
- Duration: 1min
- p95 Response Time: 1.2s ✅
- Error Rate: 2% ⚠️ (Stripe test mode)

### WebSocket Connections

- Concurrent Connections: 100
- Duration: 2min
- Connection Success: 100% ✅
- Message Delivery: 100% ✅

### Spike Test

- Normal Load: 10 users
- Spike Load: 100 users
- p95 During Spike: 850ms ✅
- Error Rate During Spike: 3% ✅
- Recovery Time: <10s ✅

## Bottlenecks Identified

- None (MVP targets met)

## Recommendations

- Monitor production metrics after launch
- Set up alerts for p95 > 500ms
- Plan Phase 5B (deep profiling) if issues arise
```

---

## CI/CD Integration (Basic)

Add smoke load test to GitHub Actions:

```yaml
# .github/workflows/load-test.yml
name: Load Test (Smoke)

on:
  push:
    branches: [main, staging]
  schedule:
    - cron: '0 0 * * 0' # Weekly on Sunday

jobs:
  smoke-load-test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Install k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6

      - name: Run smoke test
        run: k6 run k6-tests/01-health-check.js
        env:
          BASE_URL: ${{ secrets.STAGING_URL }}

      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: k6-results
          path: results.json
```

---

## Execution Checklist

### **Day 1: Setup & Core Tests**

- [ ] **Setup (1-2 hours)**
  - [ ] Install k6
  - [ ] Install Apache Bench
  - [ ] Create `k6-tests/` directory
  - [ ] Create test user in database

- [ ] **Write & Run Tests (4-5 hours)**
  - [ ] Test 1: Health Check
  - [ ] Test 2: Authentication Load
  - [ ] Test 3: Alerts API Load
  - [ ] Run all tests, document results

- [ ] **Apache Bench Checks (1 hour)**
  - [ ] Quick health check
  - [ ] Quick auth check
  - [ ] Quick API check

### **Day 2: Critical Paths & CI/CD**

- [ ] **Critical Path Tests (3-4 hours)**
  - [ ] Test 4: Checkout Load
  - [ ] Test 5: WebSocket Connections
  - [ ] Test 6: Spike Test

- [ ] **Documentation (2 hours)**
  - [ ] Create `performance-baseline.md`
  - [ ] Document all metrics
  - [ ] Note any bottlenecks (if found)
  - [ ] Create optimization plan (if needed)

- [ ] **CI/CD Integration (1-2 hours)**
  - [ ] Add GitHub Actions workflow
  - [ ] Configure staging environment tests
  - [ ] Set up performance alerts

---

## Interpreting k6 Results

### **Good Result Example:**

```
✓ status is 200
✓ response time < 500ms

checks.........................: 100.00% ✓ 2000  ✗ 0
data_received..................: 1.2 MB  20 kB/s
data_sent......................: 180 kB  3.0 kB/s
http_req_blocked...............: avg=1.2ms    min=0s      med=0s     max=12ms
http_req_connecting............: avg=0.8ms    min=0s      med=0s     max=8ms
http_req_duration..............: avg=250ms    min=50ms    med=220ms  max=480ms  p(95)=380ms  p(99)=450ms
http_req_failed................: 0.00%   ✓ 0     ✗ 2000
http_reqs......................: 2000    33.33/s
iteration_duration.............: avg=1.25s    min=1.05s   med=1.22s  max=1.48s
iterations.....................: 2000    33.33/s
vus............................: 50      min=20  max=50
```

**Key Metrics:**

- ✅ **p95 < 500ms:** Good performance
- ✅ **http_req_failed: 0%:** No errors
- ✅ **checks: 100%:** All assertions passed

### **Problem Result Example:**

```
✗ response time < 500ms (85% pass)

http_req_duration..............: avg=650ms    p(95)=1200ms  p(99)=2500ms
http_req_failed................: 3.50%   ✓ 70    ✗ 1930
```

**Issues:**

- ❌ **p95 > 1s:** Too slow
- ❌ **3.5% errors:** Above threshold
- ⚠️ **Action needed:** Profile with Clinic.js (Phase 5B)

---

## When to Move to Phase 5B (Deep Profiling)

Skip deep profiling for MVP **UNLESS** you see:

❌ **p95 > 1000ms** on critical endpoints
❌ **Error rate > 5%** under normal load
❌ **Memory increasing** over time (leak)
❌ **CPU spiking** to 100% regularly
❌ **WebSocket connections** dropping

**If any of these occur, create Phase 5B ticket:**

```
Phase 5B: Performance Profiling & Optimization
- Use Clinic.js to identify bottlenecks
- Generate flame graphs with 0x
- Optimize slow database queries
- Fix memory leaks
- Timeline: 2-3 days
```

---

## Common Performance Issues & Quick Fixes

### **Issue 1: Slow Database Queries**

**Symptom:** p95 > 500ms on GET endpoints
**Quick Fix:**

```javascript
// Add database indexes
await prisma.$executeRaw`CREATE INDEX idx_alerts_user_id ON alerts(user_id)`;
await prisma.$executeRaw`CREATE INDEX idx_alerts_symbol ON alerts(symbol)`;
```

### **Issue 2: Missing Connection Pooling**

**Symptom:** Errors under load, "too many connections"
**Quick Fix:**

```javascript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  connection_limit = 10 // Add this
}
```

### **Issue 3: No Response Caching**

**Symptom:** Same data fetched repeatedly
**Quick Fix:**

```javascript
// Add simple in-memory cache
const cache = new Map();
const CACHE_TTL = 60000; // 1 minute

export async function getCachedData(key, fetchFn) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const data = await fetchFn();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}
```

### **Issue 4: Unoptimized Stripe Calls**

**Symptom:** Checkout endpoint slow (>2s)
**Quick Fix:**

```javascript
// Use Promise.all for parallel calls
const [customer, prices] = await Promise.all([
  stripe.customers.retrieve(customerId),
  stripe.prices.list({ product: productId }),
]);
```

---

## Success Criteria

✅ **Phase 5 Complete When:**

- All 6 k6 tests passing
- Performance baseline documented
- No critical bottlenecks found
- Apache Bench sanity checks passing
- CI/CD running smoke load tests
- **OR** Phase 5B ticket created (if issues found)

**Targets Met:**

- ✅ Health check: p95 < 200ms
- ✅ Auth load: p95 < 500ms, 50 users
- ✅ API load: p95 < 500ms, 50 users
- ✅ Checkout: p95 < 2s, 10 users
- ✅ WebSocket: 100 connections
- ✅ Spike test: survives 10x traffic

---

## Deliverables

1. **6 k6 test files** in `k6-tests/` directory
2. **Apache Bench commands** documented
3. **Performance baseline report** (`performance-baseline.md`)
4. **CI/CD workflow** for smoke tests
5. **Quick fix guide** for common issues
6. **Phase 5B ticket** (if deep profiling needed)

---

## Timeline: 2 Days

| Day       | Tasks                          | Hours     |
| --------- | ------------------------------ | --------- |
| **Day 1** | Setup, Tests 1-3, Apache Bench | 6-8 hours |
| **Day 2** | Tests 4-6, Docs, CI/CD         | 6-8 hours |

**Total: 12-16 hours** across 2 days

---

## Notes for Claude Code

- **Focus on critical paths:** Auth, Checkout, Alerts, WebSocket
- **Set realistic targets:** Don't over-optimize for MVP
- **Document baselines:** You'll need these post-launch
- **Skip deep profiling:** Unless clear issues found
- **Ship fast:** Optimize based on real usage data

---

**Ready to begin? Start with Day 1: Setup and core load tests.**
