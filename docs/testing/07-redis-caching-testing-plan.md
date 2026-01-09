# Redis Caching Testing Plan

**Part 20 - MT5 to PostgreSQL Data Flow**
**Last Updated:** 2026-01-08

---

## Table of Contents

1. [Overview](#overview)
2. [Redis Architecture](#redis-architecture)
3. [Prerequisites](#prerequisites)
4. [Connection Testing](#connection-testing)
5. [Cache Read/Write Testing](#cache-readwrite-testing)
6. [API Caching Tests](#api-caching-tests)
7. [Cache Invalidation Tests](#cache-invalidation-tests)
8. [Failover Testing](#failover-testing)
9. [Performance Benchmarks](#performance-benchmarks)
10. [Test Checklist](#test-checklist)

---

## Overview

Redis provides caching for API responses, reducing PostgreSQL load and improving response times.

**Caching Architecture:**
```
User Request
    ↓
Vercel API Route
    ↓
┌─────────────────────────────────────┐
│ Cache Check (Redis)                 │
├─────────────────────────────────────┤
│ IF cache HIT:                       │
│   → Return cached data (fast)       │
│                                     │
│ IF cache MISS:                      │
│   → Query PostgreSQL                │
│   → Store in Redis (30s TTL)        │
│   → Return fresh data               │
└─────────────────────────────────────┘
```

**Cache TTL Strategy:**
| Data Type | TTL | Reason |
|-----------|-----|--------|
| Indicator data | 30 seconds | Matches sync interval |
| Symbol metadata | 5 minutes | Rarely changes |
| User preferences | 1 hour | Low change frequency |

---

## Redis Architecture

### Railway Redis Instance

**Connection Details:**
```
Host: switchyard.proxy.rlwy.net
Port: 47725
Password: [From Railway Dashboard]
URL: redis://default:PASSWORD@switchyard.proxy.rlwy.net:47725
```

### Cache Key Structure

```
trading:indicators:{symbol}:{timeframe}     → Latest indicator data
trading:ohlc:{symbol}:{timeframe}           → OHLC data
trading:metadata:{symbol}                    → Symbol metadata
trading:user:{userId}:preferences           → User preferences
```

### Expected Cache Behavior

| Scenario | Expected Result |
|----------|-----------------|
| First request | Cache MISS → Query PostgreSQL → Cache result |
| Second request (<30s) | Cache HIT → Return cached data |
| After 30s | Cache MISS → Fresh PostgreSQL query |
| After data sync | Cache invalidated → Fresh data on next request |

---

## Prerequisites

### From Contabo VPS

```powershell
# Redis CLI (if not installed)
# Download from: https://github.com/microsoftarchive/redis/releases

# Or use Python redis library
pip install redis
```

### Connection String

```powershell
# Set environment variable
$env:REDIS_URL = "redis://default:YOUR_PASSWORD@switchyard.proxy.rlwy.net:47725"
```

---

## Connection Testing

### Test 1: Basic Connectivity

```powershell
# Using Python
python -c @"
import redis
import os

url = os.environ.get('REDIS_URL')
r = redis.from_url(url)

# Test PING
result = r.ping()
print(f'PING: {result}')  # Should print: PING: True
"@
```

**Expected Output:**
```
PING: True
```

### Test 2: Redis Info

```powershell
python -c @"
import redis
import os

url = os.environ.get('REDIS_URL')
r = redis.from_url(url)

info = r.info()
print(f'Redis Version: {info[\"redis_version\"]}')
print(f'Connected Clients: {info[\"connected_clients\"]}')
print(f'Used Memory: {info[\"used_memory_human\"]}')
print(f'Total Keys: {r.dbsize()}')
"@
```

### Test 3: Network Latency

```powershell
python -c @"
import redis
import os
import time

url = os.environ.get('REDIS_URL')
r = redis.from_url(url)

# Measure latency
times = []
for i in range(10):
    start = time.time()
    r.ping()
    end = time.time()
    times.append((end - start) * 1000)

avg = sum(times) / len(times)
print(f'Average latency: {avg:.2f}ms')
print(f'Min: {min(times):.2f}ms, Max: {max(times):.2f}ms')
"@
```

**Expected:** Average latency < 50ms from Contabo to Railway

---

## Cache Read/Write Testing

### Test 4: Basic Set/Get

```powershell
python -c @"
import redis
import os
import json

url = os.environ.get('REDIS_URL')
r = redis.from_url(url)

# Test key
key = 'test:trading:eurusd'
data = {'open': 1.0850, 'high': 1.0875, 'low': 1.0825, 'close': 1.0860}

# SET with 30s TTL
r.setex(key, 30, json.dumps(data))
print(f'SET {key} OK')

# GET
result = r.get(key)
print(f'GET {key}: {result}')

# TTL
ttl = r.ttl(key)
print(f'TTL: {ttl} seconds')

# Cleanup
r.delete(key)
print('Cleaned up test key')
"@
```

### Test 5: JSON Data Handling

```powershell
python -c @"
import redis
import os
import json

url = os.environ.get('REDIS_URL')
r = redis.from_url(url)

# Complex trading data
key = 'test:trading:indicators:eurusd:h1'
data = {
    'timestamp': '2026-01-08T12:00:00Z',
    'ohlc': {'open': 1.0850, 'high': 1.0875, 'low': 1.0825, 'close': 1.0860},
    'indicators': {
        'tema': 1.0855,
        'hrma': 1.0852,
        'smma': 1.0848,
        'fractals': [
            {'type': 'high', 'price': 1.0900, 'time': '2026-01-08T10:00:00Z'},
            {'type': 'low', 'price': 1.0800, 'time': '2026-01-08T08:00:00Z'}
        ],
        'keltner_channels': {
            'upper': [1.0900, 1.0920, 1.0940],
            'middle': 1.0860,
            'lower': [1.0820, 1.0800, 1.0780]
        }
    },
    'metadata': {
        'data_source': 'postgresql',
        'cached_at': '2026-01-08T12:00:05Z'
    }
}

# Store
r.setex(key, 30, json.dumps(data))
print('Stored complex JSON data')

# Retrieve and parse
result = json.loads(r.get(key))
print(f'Retrieved TEMA: {result[\"indicators\"][\"tema\"]}')
print(f'Retrieved Fractals: {len(result[\"indicators\"][\"fractals\"])} points')

# Verify structure integrity
assert result['ohlc']['close'] == 1.0860
assert len(result['indicators']['keltner_channels']['upper']) == 3
print('[PASS] JSON structure preserved correctly')

# Cleanup
r.delete(key)
"@
```

### Test 6: Multiple Keys (Batch Operations)

```powershell
python -c @"
import redis
import os
import json

url = os.environ.get('REDIS_URL')
r = redis.from_url(url)

symbols = ['eurusd', 'btcusd', 'xauusd']
timeframes = ['m5', 'h1', 'd1']

# MSET multiple keys
pipe = r.pipeline()
for symbol in symbols:
    for tf in timeframes:
        key = f'test:trading:{symbol}:{tf}'
        data = {'symbol': symbol, 'timeframe': tf, 'close': 1.0}
        pipe.setex(key, 30, json.dumps(data))

pipe.execute()
print(f'Stored {len(symbols) * len(timeframes)} keys')

# MGET multiple keys
keys = [f'test:trading:{s}:{tf}' for s in symbols for tf in timeframes]
results = r.mget(keys)
valid_count = sum(1 for r in results if r is not None)
print(f'Retrieved {valid_count} keys')

# Cleanup
for key in keys:
    r.delete(key)
print('Cleaned up test keys')
"@
```

---

## API Caching Tests

### Test 7: Cache Miss → PostgreSQL Query

**Purpose:** Verify first request queries PostgreSQL and caches result

```powershell
# Clear any existing cache first
python -c @"
import redis
import os

url = os.environ.get('REDIS_URL')
r = redis.from_url(url)

# Clear trading cache keys
keys = r.keys('trading:*')
if keys:
    r.delete(*keys)
    print(f'Cleared {len(keys)} cache keys')
else:
    print('Cache already empty')
"@
```

**Test API Call (from Vercel app):**
```powershell
# First request (cache miss)
$startTime = Get-Date
$response = Invoke-RestMethod "https://your-app.vercel.app/api/indicators/EURUSD/H1"
$duration = ((Get-Date) - $startTime).TotalMilliseconds

Write-Host "First Request (Cache MISS):"
Write-Host "  Duration: $duration ms"
Write-Host "  Data Source: $($response.metadata.data_source)"
# Expected: data_source = "postgresql"
```

### Test 8: Cache Hit → Fast Response

```powershell
# Second request (cache hit - within 30s)
$startTime = Get-Date
$response = Invoke-RestMethod "https://your-app.vercel.app/api/indicators/EURUSD/H1"
$duration = ((Get-Date) - $startTime).TotalMilliseconds

Write-Host "Second Request (Cache HIT):"
Write-Host "  Duration: $duration ms"
Write-Host "  Data Source: $($response.metadata.data_source)"
# Expected: data_source = "cache", duration < first request
```

### Test 9: Compare Response Times

```powershell
# Performance comparison script
$results = @{
    'CacheMiss' = @()
    'CacheHit' = @()
}

# Test 5 cache miss scenarios
for ($i = 0; $i -lt 5; $i++) {
    # Clear cache
    python -c "import redis, os; r = redis.from_url(os.environ.get('REDIS_URL')); r.flushdb()"

    $start = Get-Date
    $response = Invoke-RestMethod "https://your-app.vercel.app/api/indicators/EURUSD/H1"
    $duration = ((Get-Date) - $start).TotalMilliseconds
    $results['CacheMiss'] += $duration

    # Immediate second request (cache hit)
    $start = Get-Date
    $response = Invoke-RestMethod "https://your-app.vercel.app/api/indicators/EURUSD/H1"
    $duration = ((Get-Date) - $start).TotalMilliseconds
    $results['CacheHit'] += $duration

    Start-Sleep -Seconds 1
}

$avgMiss = ($results['CacheMiss'] | Measure-Object -Average).Average
$avgHit = ($results['CacheHit'] | Measure-Object -Average).Average
$improvement = (($avgMiss - $avgHit) / $avgMiss) * 100

Write-Host "`nResults:"
Write-Host "  Avg Cache MISS: $([math]::Round($avgMiss, 2)) ms"
Write-Host "  Avg Cache HIT:  $([math]::Round($avgHit, 2)) ms"
Write-Host "  Improvement:    $([math]::Round($improvement, 1))%"
```

**Expected:** Cache HIT should be 50-80% faster than MISS

---

## Cache Invalidation Tests

### Test 10: TTL Expiration

```powershell
python -c @"
import redis
import os
import time

url = os.environ.get('REDIS_URL')
r = redis.from_url(url)

key = 'test:ttl:eurusd'

# Set with 5 second TTL for testing
r.setex(key, 5, 'test_data')
print(f'Set key with 5s TTL')

# Verify exists
print(f'Immediately: {r.exists(key)} (1 = exists)')

# Wait and check TTL
time.sleep(3)
ttl = r.ttl(key)
print(f'After 3s: TTL = {ttl}s')

# Wait for expiration
time.sleep(3)
print(f'After 6s: {r.exists(key)} (0 = expired)')
"@
```

### Test 11: Manual Invalidation (After Sync)

**Purpose:** Verify cache invalidates when new data arrives

```powershell
python -c @"
import redis
import os
import json
import time

url = os.environ.get('REDIS_URL')
r = redis.from_url(url)

# Simulate cached data
key = 'trading:indicators:eurusd:h1'
old_data = {'close': 1.0800, 'cached_at': '2026-01-08T11:00:00Z'}
r.setex(key, 30, json.dumps(old_data))
print(f'Cached old data: close = {old_data[\"close\"]}')

# Simulate sync completing with new data
# In real scenario, sync script would invalidate relevant keys
time.sleep(2)

# Invalidate cache (sync script does this)
r.delete(key)
print('Cache invalidated after sync')

# Next request would get fresh data from PostgreSQL
cached = r.get(key)
print(f'After invalidation: {cached}')  # Should be None
"@
```

### Test 12: Pattern-Based Invalidation

```powershell
python -c @"
import redis
import os

url = os.environ.get('REDIS_URL')
r = redis.from_url(url)

# Create multiple cache entries for EURUSD
timeframes = ['m5', 'm15', 'm30', 'h1', 'h2', 'h4', 'h8', 'h12', 'd1']
for tf in timeframes:
    key = f'trading:indicators:eurusd:{tf}'
    r.setex(key, 30, f'data_{tf}')

print(f'Created {len(timeframes)} cache entries')

# Invalidate all EURUSD entries (after sync)
pattern = 'trading:indicators:eurusd:*'
keys = r.keys(pattern)
print(f'Found {len(keys)} keys matching pattern')

if keys:
    r.delete(*keys)
    print('Deleted all EURUSD cache entries')

# Verify
remaining = r.keys(pattern)
print(f'Remaining keys: {len(remaining)}')
"@
```

---

## Failover Testing

### Test 13: Redis Unavailable → PostgreSQL Fallback

**Purpose:** Verify app works when Redis is down

```powershell
# Note: This test requires temporarily blocking Redis

# 1. Block Redis port
New-NetFirewallRule -DisplayName "Block Redis Test" -Direction Outbound -RemotePort 47725 -Action Block

# 2. Make API request
$response = Invoke-RestMethod "https://your-app.vercel.app/api/indicators/EURUSD/H1"

# 3. Verify response (should come from PostgreSQL)
Write-Host "Response received: $($response.success)"
Write-Host "Data source: $($response.metadata.data_source)"
# Expected: data_source = "postgresql" (fallback)

# 4. Remove block
Remove-NetFirewallRule -DisplayName "Block Redis Test"
```

### Test 14: Redis Recovery

```powershell
# After removing block, verify caching resumes

# Wait for next request cycle
Start-Sleep -Seconds 5

# First request (cache miss - Redis just recovered)
$response1 = Invoke-RestMethod "https://your-app.vercel.app/api/indicators/EURUSD/H1"
Write-Host "First request after recovery: $($response1.metadata.data_source)"

# Second request (should be cache hit)
$response2 = Invoke-RestMethod "https://your-app.vercel.app/api/indicators/EURUSD/H1"
Write-Host "Second request: $($response2.metadata.data_source)"
# Expected: "cache"
```

### Test 15: Connection Pool Exhaustion

```powershell
python -c @"
import redis
import os
import concurrent.futures
import time

url = os.environ.get('REDIS_URL')

def make_request(i):
    r = redis.from_url(url)
    try:
        r.ping()
        r.get(f'test:key:{i}')
        return True
    except Exception as e:
        return str(e)
    finally:
        r.close()

# Simulate 50 concurrent connections
with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
    futures = [executor.submit(make_request, i) for i in range(50)]
    results = [f.result() for f in futures]

success = sum(1 for r in results if r == True)
print(f'Successful connections: {success}/50')

if success < 50:
    errors = [r for r in results if r != True]
    print(f'Errors: {errors[:5]}')  # Show first 5 errors
"@
```

---

## Performance Benchmarks

### Benchmark 1: Read Latency

```powershell
python -c @"
import redis
import os
import time
import statistics

url = os.environ.get('REDIS_URL')
r = redis.from_url(url)

# Prepare test data
key = 'benchmark:read'
data = 'x' * 1024  # 1KB payload
r.set(key, data)

# Run benchmark
times = []
iterations = 100

for i in range(iterations):
    start = time.perf_counter()
    r.get(key)
    end = time.perf_counter()
    times.append((end - start) * 1000)

r.delete(key)

print(f'Read Latency ({iterations} iterations):')
print(f'  Mean:   {statistics.mean(times):.3f} ms')
print(f'  Median: {statistics.median(times):.3f} ms')
print(f'  Stdev:  {statistics.stdev(times):.3f} ms')
print(f'  Min:    {min(times):.3f} ms')
print(f'  Max:    {max(times):.3f} ms')
"@
```

### Benchmark 2: Write Latency

```powershell
python -c @"
import redis
import os
import time
import statistics

url = os.environ.get('REDIS_URL')
r = redis.from_url(url)

times = []
iterations = 100
data = 'x' * 1024  # 1KB payload

for i in range(iterations):
    key = f'benchmark:write:{i}'
    start = time.perf_counter()
    r.setex(key, 30, data)
    end = time.perf_counter()
    times.append((end - start) * 1000)
    r.delete(key)

print(f'Write Latency ({iterations} iterations):')
print(f'  Mean:   {statistics.mean(times):.3f} ms')
print(f'  Median: {statistics.median(times):.3f} ms')
print(f'  Stdev:  {statistics.stdev(times):.3f} ms')
print(f'  Min:    {min(times):.3f} ms')
print(f'  Max:    {max(times):.3f} ms')
"@
```

### Benchmark 3: Throughput

```powershell
python -c @"
import redis
import os
import time

url = os.environ.get('REDIS_URL')
r = redis.from_url(url)

# Prepare
key = 'benchmark:throughput'
data = 'x' * 1024
r.set(key, data)

# Measure throughput
duration = 10  # seconds
start = time.time()
operations = 0

while (time.time() - start) < duration:
    r.get(key)
    operations += 1

r.delete(key)

ops_per_sec = operations / duration
print(f'Throughput: {ops_per_sec:.0f} ops/sec')
print(f'Total operations in {duration}s: {operations}')
"@
```

---

## Test Checklist

### Redis Caching Test Results

```
Redis Caching Testing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Connection Testing:
[ ] Test 1: Basic connectivity (PING)
[ ] Test 2: Redis info retrieval
[ ] Test 3: Network latency < 50ms

Cache Read/Write:
[ ] Test 4: Basic SET/GET
[ ] Test 5: JSON data handling
[ ] Test 6: Batch operations (MSET/MGET)

API Caching:
[ ] Test 7: Cache MISS → PostgreSQL query
[ ] Test 8: Cache HIT → Fast response
[ ] Test 9: Response time improvement > 50%

Cache Invalidation:
[ ] Test 10: TTL expiration works
[ ] Test 11: Manual invalidation after sync
[ ] Test 12: Pattern-based invalidation

Failover:
[ ] Test 13: PostgreSQL fallback when Redis down
[ ] Test 14: Caching resumes after Redis recovery
[ ] Test 15: Connection pool handles load

Performance Benchmarks:
[ ] Benchmark 1: Read latency < 10ms
[ ] Benchmark 2: Write latency < 15ms
[ ] Benchmark 3: Throughput > 1000 ops/sec

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Overall Result: [ ] PASS  [ ] FAIL
```

---

## Success Criteria Summary

| Test Area | Criteria | Target |
|-----------|----------|--------|
| Connectivity | PING succeeds | Required |
| Latency | Network RTT | < 50ms |
| Cache HIT | Response time improvement | > 50% |
| TTL | Automatic expiration | Works correctly |
| Failover | App continues without Redis | Required |
| Read Latency | Average | < 10ms |
| Write Latency | Average | < 15ms |
| Throughput | Operations/second | > 1000 |

---

## Next Steps

After Redis testing passes:

1. ➡️ **[Performance Testing Plan](./08-performance-testing-plan.md)** - Load testing

---

**Document Version:** 1.0.0
**Created:** 2026-01-08
**Author:** Claude Code (Trading Alerts SaaS Part 20)
