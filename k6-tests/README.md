# k6 Load Tests

Load and performance testing suite for Trading Alerts SaaS using [k6](https://k6.io/).

## Quick Start

### Prerequisites

1. **Install k6:**

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 \
  --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | \
  sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Windows
choco install k6

# Docker
docker pull grafana/k6
```

2. **Create test user in database:**

```sql
INSERT INTO users (email, password, tier)
VALUES ('loadtest@example.com', '<bcrypt_hashed_password>', 'FREE');
```

### Run Tests

```bash
# Run individual tests
npm run test:load:health
npm run test:load:auth
npm run test:load:alerts
npm run test:load:checkout
npm run test:load:websocket
npm run test:load:spike

# Run all load tests
npm run test:load:all

# Run against staging/production
BASE_URL=https://staging.example.com npm run test:load:health
```

## Test Suite

| Test | File | Description | Target |
|------|------|-------------|--------|
| Health Check | `01-health-check.js` | Baseline connectivity test | p95 < 200ms |
| Auth Load | `02-auth-load.js` | Login flow under load | p95 < 500ms, 50 users |
| Alerts API | `03-alerts-api-load.js` | Core API endpoints | p95 < 500ms, 50 users |
| Checkout | `04-checkout-load.js` | Stripe checkout flow | p95 < 2s, 10 users |
| WebSocket | `05-websocket-load.js` | Real-time connections | 100 connections |
| Spike Test | `06-spike-test.js` | Traffic spike simulation | 10x traffic survival |

## Configuration

Set environment variables to customize tests:

```bash
# Base URL (defaults to localhost:3000)
export BASE_URL=https://staging.example.com

# Test user credentials
export TEST_EMAIL=loadtest@example.com
export TEST_PASSWORD=LoadTest123!
```

Or pass inline:

```bash
BASE_URL=https://staging.example.com TEST_EMAIL=user@test.com k6 run k6-tests/02-auth-load.js
```

## Understanding Results

### Success Metrics

```
✓ status is 200
✓ response time < 500ms

checks.........................: 100.00% ✓ 2000  ✗ 0
http_req_duration..............: avg=250ms p(95)=380ms p(99)=450ms
http_req_failed................: 0.00%   ✓ 0     ✗ 2000
```

**Good indicators:**
- ✅ p95 < target threshold
- ✅ 0% failed requests
- ✅ 100% checks passed

### Warning Signs

```
✗ response time < 500ms (85% pass)
http_req_duration..............: p(95)=1200ms
http_req_failed................: 3.50%
```

**Issues to investigate:**
- ❌ p95 > 1000ms
- ❌ Error rate > 1%
- ❌ Checks failing

## CI/CD Integration

Load tests run automatically via GitHub Actions:

- **Weekly:** Smoke test runs every Sunday
- **Manual:** Trigger full suite or spike test via workflow_dispatch

See `.github/workflows/load-test.yml` for configuration.

### Required Secrets

| Secret | Description |
|--------|-------------|
| `STAGING_URL` | Staging environment URL |
| `LOAD_TEST_EMAIL` | Test user email |
| `LOAD_TEST_PASSWORD` | Test user password |

## Performance Baseline

Document your baseline metrics in `PERFORMANCE-BASELINE.md` after running tests.

## Troubleshooting

### Test fails with 401 Unauthorized

The test user doesn't exist or credentials are wrong:

```sql
-- Check if user exists
SELECT * FROM users WHERE email = 'loadtest@example.com';

-- Create test user (hash password appropriately)
INSERT INTO users (email, password, tier)
VALUES ('loadtest@example.com', '<bcrypt_hash>', 'FREE');
```

### WebSocket test fails

Ensure Socket.IO server is running and accessible:

```bash
# Check if WebSocket endpoint responds
curl -I http://localhost:3000/socket.io/
```

### High error rate during tests

1. Check application logs for errors
2. Verify database connections aren't exhausted
3. Check if rate limiting is too aggressive
4. Monitor memory/CPU during tests

### Tests timeout

Increase timeout in the test file:

```javascript
const res = http.get(url, {
  timeout: '30s',  // Increase from default
});
```

## Files

```
k6-tests/
├── README.md                    # This file
├── PERFORMANCE-BASELINE.md      # Template for documenting results
├── config.js                    # Shared configuration
├── 01-health-check.js           # Health check test
├── 02-auth-load.js              # Authentication load test
├── 03-alerts-api-load.js        # Alerts API load test
├── 04-checkout-load.js          # Checkout load test
├── 05-websocket-load.js         # WebSocket load test
└── 06-spike-test.js             # Spike/stress test
```

## Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 Metrics Reference](https://k6.io/docs/using-k6/metrics/)
- [k6 Thresholds](https://k6.io/docs/using-k6/thresholds/)
- [Socket.IO Testing](https://k6.io/docs/javascript-api/k6-ws/)
