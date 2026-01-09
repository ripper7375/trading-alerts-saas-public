# Performance Testing Plan

**Part 20 - MT5 to PostgreSQL Data Flow**
**Last Updated:** 2026-01-08

---

## Table of Contents

1. [Overview](#overview)
2. [Performance Targets](#performance-targets)
3. [Test Environment](#test-environment)
4. [Data Collection Performance](#data-collection-performance)
5. [Sync Performance](#sync-performance)
6. [API Performance](#api-performance)
7. [Load Testing](#load-testing)
8. [Resource Monitoring](#resource-monitoring)
9. [Bottleneck Analysis](#bottleneck-analysis)
10. [Results Template](#results-template)

---

## Overview

This document outlines performance testing for the complete data pipeline from MT5 to user-facing charts.

**Performance Test Areas:**
```
┌──────────────────────────────────────────────────────────────┐
│ 1. DATA COLLECTION (MT5 → SQLite)                            │
│    Metrics: Collection time, CPU usage, memory usage         │
├──────────────────────────────────────────────────────────────┤
│ 2. SYNC PERFORMANCE (SQLite → PostgreSQL)                    │
│    Metrics: Sync time, rows/second, network bandwidth        │
├──────────────────────────────────────────────────────────────┤
│ 3. API PERFORMANCE (PostgreSQL/Redis → User)                 │
│    Metrics: Response time, cache hit rate, throughput        │
├──────────────────────────────────────────────────────────────┤
│ 4. LOAD TESTING (Concurrent Users)                           │
│    Metrics: Response time under load, error rate             │
└──────────────────────────────────────────────────────────────┘
```

---

## Performance Targets

### Target Metrics

| Component | Metric | Target | Critical Threshold |
|-----------|--------|--------|-------------------|
| **DataCollector** | Collection cycle time | < 5 seconds | < 10 seconds |
| **DataCollector** | Memory per MT5 instance | < 1 GB | < 1.5 GB |
| **DataCollector** | CPU per MT5 instance | < 10% | < 20% |
| **Sync Script** | Full sync time (15 symbols) | < 5 seconds | < 10 seconds |
| **Sync Script** | Rows per second | > 100 rows/sec | > 50 rows/sec |
| **API** | Response time (cached) | < 50ms | < 100ms |
| **API** | Response time (uncached) | < 300ms | < 500ms |
| **API** | Cache hit rate | > 80% | > 60% |
| **Load** | 100 concurrent users | < 500ms avg | < 1000ms avg |
| **Load** | Error rate under load | < 1% | < 5% |

### SLA Requirements

```
Service Level Objectives (SLOs):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Data Freshness:
  - Data delay: < 60 seconds from MT5 to user
  - Sync frequency: Every 30 seconds

Availability:
  - Data collection uptime: > 99%
  - API availability: > 99.5%

Performance:
  - P95 response time: < 500ms
  - P99 response time: < 1000ms
```

---

## Test Environment

### Contabo VPS Specs

```
VPS Type:     VPS M (recommended)
vCPU:         6 cores
RAM:          16 GB
Storage:      100 GB SSD
OS:           Windows Server 2022
Location:     Germany (EU)
```

### Railway Resources

```
PostgreSQL:
  Plan:       Pro (recommended)
  vCPU:       Shared
  RAM:        Variable (auto-scaling)
  Storage:    20 GB (expandable)

Redis:
  Plan:       Pro (recommended)
  RAM:        Variable (auto-scaling)
```

### Monitoring Tools

```powershell
# Windows Performance Monitor
perfmon

# Resource Monitor
resmon

# Python monitoring
pip install psutil
```

---

## Data Collection Performance

### Test 1: Single Collection Cycle Time

**Purpose:** Measure time for DataCollector to complete one cycle

```powershell
# Monitor MT5 Expert tab timestamps
# Or add timing logs to DataCollector.mq5

# External measurement:
$startTime = Get-Date
# Wait for one collection cycle (observe in MT5 Experts tab)
# Note the "Inserted row" log message
$endTime = Get-Date

$cycleTime = ($endTime - $startTime).TotalSeconds
Write-Host "Collection cycle time: $cycleTime seconds"
```

### Test 2: SQLite Write Performance

```powershell
python -c @"
import sqlite3
import time
import json

db_path = r'C:\MT5Data\trading_data.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Measure row insert time
data = {
    'timestamp': int(time.time()),
    'open': 1.0850,
    'high': 1.0875,
    'low': 1.0825,
    'close': 1.0860,
    'fractals': json.dumps([]),
    'horizontal_trendlines': json.dumps([]),
    'diagonal_trendlines': json.dumps([]),
    'momentum_candles': json.dumps([]),
    'keltner_channels': json.dumps([]),
    'tema': 1.0855,
    'hrma': 1.0852,
    'smma': 1.0848,
    'zigzag': json.dumps([])
}

iterations = 100
times = []

for i in range(iterations):
    data['timestamp'] = int(time.time()) + i  # Unique timestamp

    start = time.perf_counter()
    cursor.execute('''
        INSERT OR REPLACE INTO eurusd
        (timestamp, open, high, low, close, fractals, horizontal_trendlines,
         diagonal_trendlines, momentum_candles, keltner_channels, tema, hrma, smma, zigzag)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', tuple(data.values()))
    conn.commit()
    end = time.perf_counter()

    times.append((end - start) * 1000)

conn.close()

print(f'SQLite Write Performance ({iterations} iterations):')
print(f'  Mean: {sum(times)/len(times):.3f} ms')
print(f'  Min:  {min(times):.3f} ms')
print(f'  Max:  {max(times):.3f} ms')
"@
```

### Test 3: MT5 Resource Usage

```powershell
# Monitor MT5 processes
$mt5Processes = Get-Process | Where-Object {$_.ProcessName -eq "terminal64"}

foreach ($proc in $mt5Processes) {
    $cpu = $proc.CPU
    $mem = [math]::Round($proc.WorkingSet64 / 1MB, 2)
    Write-Host "PID $($proc.Id): CPU=$cpu, Memory=${mem}MB"
}

# Total resource usage
$totalMem = ($mt5Processes | Measure-Object WorkingSet64 -Sum).Sum / 1GB
$totalCpu = ($mt5Processes | Measure-Object CPU -Sum).Sum
Write-Host "`nTotal: ${totalMem}GB memory, $totalCpu CPU seconds"
```

### Test 4: Continuous Monitoring (15 min)

```powershell
# File: C:\Scripts\monitor_datacollector.ps1

$duration = 15  # minutes
$interval = 30  # seconds
$iterations = ($duration * 60) / $interval

$results = @()

for ($i = 0; $i -lt $iterations; $i++) {
    $timestamp = Get-Date -Format "HH:mm:ss"

    # MT5 memory
    $mt5Procs = Get-Process | Where-Object {$_.ProcessName -eq "terminal64"}
    $mt5Memory = ($mt5Procs | Measure-Object WorkingSet64 -Sum).Sum / 1GB

    # SQLite size
    $dbSize = (Get-Item "C:\MT5Data\trading_data.db").Length / 1MB

    # Row count (sample)
    $rowCount = & sqlite3 C:\MT5Data\trading_data.db "SELECT COUNT(*) FROM eurusd;"

    $results += [PSCustomObject]@{
        Time = $timestamp
        MT5_Memory_GB = [math]::Round($mt5Memory, 2)
        DB_Size_MB = [math]::Round($dbSize, 2)
        Rows = $rowCount
    }

    Write-Host "[$timestamp] MT5: ${mt5Memory}GB, DB: ${dbSize}MB, Rows: $rowCount"
    Start-Sleep -Seconds $interval
}

$results | Export-Csv "C:\Logs\datacollector_perf.csv" -NoTypeInformation
Write-Host "`nResults saved to datacollector_perf.csv"
```

---

## Sync Performance

### Test 5: Full Sync Time

```powershell
# Measure complete sync execution time
$startTime = Get-Date

cd C:\Scripts\sync_package
python sync_to_postgresql.py

$endTime = Get-Date
$syncTime = ($endTime - $startTime).TotalSeconds

Write-Host "Full sync time: $syncTime seconds"
```

### Test 6: Per-Symbol Sync Time

```powershell
python -c @"
import time
import sys
sys.path.append(r'C:\Scripts\sync_package')

from config import SYMBOLS
from sync_to_postgresql import DataSyncer

syncer = DataSyncer()
results = {}

for symbol in SYMBOLS:
    start = time.perf_counter()
    syncer.sync_symbol(symbol)
    end = time.perf_counter()
    results[symbol] = (end - start) * 1000

print('Per-Symbol Sync Times:')
for symbol, ms in sorted(results.items(), key=lambda x: x[1], reverse=True):
    print(f'  {symbol}: {ms:.1f} ms')

avg = sum(results.values()) / len(results)
print(f'\nAverage: {avg:.1f} ms per symbol')
"@
```

### Test 7: Rows Per Second

```powershell
python -c @"
import time
import sys
sys.path.append(r'C:\Scripts\sync_package')

from sync_to_postgresql import DataSyncer

syncer = DataSyncer()

# Reset sync state to sync all data
syncer.last_sync_timestamps = {s: 0 for s in syncer.last_sync_timestamps}

start = time.perf_counter()
result = syncer.run()
end = time.perf_counter()

duration = end - start
rows = result['rows_synced']
rows_per_sec = rows / duration if duration > 0 else 0

print(f'Sync Performance:')
print(f'  Duration: {duration:.2f} seconds')
print(f'  Rows synced: {rows}')
print(f'  Rows/second: {rows_per_sec:.1f}')
"@
```

### Test 8: Network Bandwidth

```powershell
# Monitor network during sync
$beforeBytes = (Get-NetAdapterStatistics).SentBytes

# Run sync
cd C:\Scripts\sync_package
python sync_to_postgresql.py

$afterBytes = (Get-NetAdapterStatistics).SentBytes
$bytesSent = $afterBytes - $beforeBytes
$kbSent = $bytesSent / 1KB

Write-Host "Data sent during sync: ${kbSent} KB"
```

---

## API Performance

### Test 9: Response Time (Uncached)

```powershell
# Clear cache first
python -c "import redis, os; r = redis.from_url(os.environ.get('REDIS_URL')); r.flushdb()"

# Measure uncached response time
$times = @()
$symbols = @("EURUSD", "BTCUSD", "XAUUSD")
$timeframes = @("M5", "H1", "D1")

foreach ($symbol in $symbols) {
    foreach ($tf in $timeframes) {
        # Clear cache for this key
        python -c "import redis, os; r = redis.from_url(os.environ.get('REDIS_URL')); r.delete('trading:indicators:$($symbol.ToLower()):$($tf.ToLower())')"

        $start = Get-Date
        $response = Invoke-RestMethod "https://your-app.vercel.app/api/indicators/$symbol/$tf"
        $duration = ((Get-Date) - $start).TotalMilliseconds

        $times += $duration
        Write-Host "$symbol/$tf (uncached): $duration ms"
    }
}

$avg = ($times | Measure-Object -Average).Average
$max = ($times | Measure-Object -Maximum).Maximum
Write-Host "`nUncached Response Times:"
Write-Host "  Average: $([math]::Round($avg, 2)) ms"
Write-Host "  Maximum: $([math]::Round($max, 2)) ms"
```

### Test 10: Response Time (Cached)

```powershell
# Measure cached response time (immediate second request)
$times = @()
$symbols = @("EURUSD", "BTCUSD", "XAUUSD")
$timeframes = @("M5", "H1", "D1")

foreach ($symbol in $symbols) {
    foreach ($tf in $timeframes) {
        # First request (populates cache)
        Invoke-RestMethod "https://your-app.vercel.app/api/indicators/$symbol/$tf" | Out-Null

        # Second request (cached)
        $start = Get-Date
        $response = Invoke-RestMethod "https://your-app.vercel.app/api/indicators/$symbol/$tf"
        $duration = ((Get-Date) - $start).TotalMilliseconds

        $times += $duration
        Write-Host "$symbol/$tf (cached): $duration ms"
    }
}

$avg = ($times | Measure-Object -Average).Average
$max = ($times | Measure-Object -Maximum).Maximum
Write-Host "`nCached Response Times:"
Write-Host "  Average: $([math]::Round($avg, 2)) ms"
Write-Host "  Maximum: $([math]::Round($max, 2)) ms"
```

### Test 11: Cache Hit Rate

```powershell
# Simulate realistic usage pattern (repeated requests)
$totalRequests = 100
$cacheHits = 0
$endpoints = @(
    "/api/indicators/EURUSD/H1",
    "/api/indicators/BTCUSD/H1",
    "/api/indicators/XAUUSD/H1"
)

for ($i = 0; $i -lt $totalRequests; $i++) {
    $endpoint = $endpoints[$i % $endpoints.Length]
    $response = Invoke-RestMethod "https://your-app.vercel.app$endpoint"

    if ($response.metadata.data_source -eq "cache") {
        $cacheHits++
    }

    Start-Sleep -Milliseconds 100  # 10 requests/second
}

$hitRate = ($cacheHits / $totalRequests) * 100
Write-Host "Cache Hit Rate: $hitRate% ($cacheHits/$totalRequests)"
```

---

## Load Testing

### Test 12: Concurrent Users (Light Load)

**10 concurrent users:**

```powershell
# Using PowerShell jobs for concurrency
$jobs = @()
$userCount = 10
$requestsPerUser = 20

$scriptBlock = {
    param($userId)
    $times = @()
    $errors = 0

    for ($i = 0; $i -lt $using:requestsPerUser; $i++) {
        try {
            $start = Get-Date
            $response = Invoke-RestMethod "https://your-app.vercel.app/api/indicators/EURUSD/H1"
            $duration = ((Get-Date) - $start).TotalMilliseconds
            $times += $duration
        } catch {
            $errors++
        }
        Start-Sleep -Milliseconds 500
    }

    return @{
        UserId = $userId
        AvgTime = ($times | Measure-Object -Average).Average
        MaxTime = ($times | Measure-Object -Maximum).Maximum
        Errors = $errors
    }
}

for ($i = 0; $i -lt $userCount; $i++) {
    $jobs += Start-Job -ScriptBlock $scriptBlock -ArgumentList $i
}

$results = $jobs | Wait-Job | Receive-Job
$jobs | Remove-Job

$avgAll = ($results.AvgTime | Measure-Object -Average).Average
$totalErrors = ($results.Errors | Measure-Object -Sum).Sum

Write-Host "Light Load Test (10 users):"
Write-Host "  Average Response: $([math]::Round($avgAll, 2)) ms"
Write-Host "  Total Errors: $totalErrors"
```

### Test 13: Concurrent Users (Heavy Load)

**50 concurrent users:**

```powershell
# Note: For heavy load testing, consider using dedicated tools
# This is a simplified PowerShell version

$userCount = 50
$testDuration = 60  # seconds

# Or use curl/wrk for more realistic load testing:
# wrk -t4 -c50 -d60s https://your-app.vercel.app/api/indicators/EURUSD/H1
```

### Test 14: Sustained Load (10 minutes)

```powershell
$duration = 10  # minutes
$interval = 1   # second between requests
$iterations = $duration * 60

$results = @()

for ($i = 0; $i -lt $iterations; $i++) {
    $start = Get-Date
    try {
        $response = Invoke-RestMethod "https://your-app.vercel.app/api/indicators/EURUSD/H1" -TimeoutSec 10
        $duration = ((Get-Date) - $start).TotalMilliseconds
        $status = "OK"
    } catch {
        $duration = -1
        $status = "ERROR"
    }

    $results += [PSCustomObject]@{
        Iteration = $i
        Duration_ms = $duration
        Status = $status
    }

    if ($i % 60 -eq 0) {
        $avgLast60 = ($results | Select-Object -Last 60 | Where-Object {$_.Duration_ms -gt 0}).Duration_ms | Measure-Object -Average
        Write-Host "Minute $($i/60): Avg ${avgLast60.Average}ms"
    }

    Start-Sleep -Seconds $interval
}

$successful = ($results | Where-Object {$_.Status -eq "OK"}).Count
$failed = $iterations - $successful
Write-Host "`nSustained Load Results:"
Write-Host "  Successful: $successful"
Write-Host "  Failed: $failed"
Write-Host "  Error Rate: $([math]::Round($failed/$iterations*100, 2))%"
```

---

## Resource Monitoring

### Test 15: VPS Resource Usage During Load

```powershell
# File: C:\Scripts\monitor_resources.ps1

$duration = 10  # minutes
$interval = 5   # seconds

Write-Host "Resource Monitoring Started (${duration} minutes)"
Write-Host "Timestamp,CPU%,Memory%,DiskRead,DiskWrite" | Out-File "C:\Logs\resource_log.csv"

$endTime = (Get-Date).AddMinutes($duration)

while ((Get-Date) -lt $endTime) {
    $cpu = (Get-Counter '\Processor(_Total)\% Processor Time').CounterSamples.CookedValue
    $mem = (Get-Counter '\Memory\% Committed Bytes In Use').CounterSamples.CookedValue
    $diskRead = (Get-Counter '\PhysicalDisk(_Total)\Disk Read Bytes/sec').CounterSamples.CookedValue
    $diskWrite = (Get-Counter '\PhysicalDisk(_Total)\Disk Write Bytes/sec').CounterSamples.CookedValue

    $timestamp = Get-Date -Format "HH:mm:ss"
    "$timestamp,$([math]::Round($cpu,1)),$([math]::Round($mem,1)),$([math]::Round($diskRead/1KB,1)),$([math]::Round($diskWrite/1KB,1))" | Out-File "C:\Logs\resource_log.csv" -Append

    Write-Host "[$timestamp] CPU: $([math]::Round($cpu,1))%, MEM: $([math]::Round($mem,1))%"

    Start-Sleep -Seconds $interval
}

Write-Host "Monitoring complete. Results in C:\Logs\resource_log.csv"
```

### Test 16: PostgreSQL Connection Pool

```powershell
# Monitor PostgreSQL connections during load
python -c @"
import psycopg2
import os
import time

uri = os.environ.get('POSTGRESQL_URI')
conn = psycopg2.connect(uri)
cursor = conn.cursor()

for i in range(10):
    cursor.execute('''
        SELECT count(*) FROM pg_stat_activity
        WHERE datname = 'railway'
    ''')
    connections = cursor.fetchone()[0]
    print(f'Active connections: {connections}')
    time.sleep(5)

conn.close()
"@
```

---

## Bottleneck Analysis

### Identifying Bottlenecks

| Symptom | Likely Bottleneck | Solution |
|---------|-------------------|----------|
| Slow sync, low CPU | Network latency | Batch inserts, connection pooling |
| High CPU during sync | SQLite reads | Index optimization |
| High memory (MT5) | Too many indicators | Reduce buffer size |
| Slow API (uncached) | PostgreSQL queries | Add indexes, optimize queries |
| Slow API (cached) | Redis latency | Check network, Redis memory |
| High error rate | Connection limits | Increase pool size |

### Performance Optimization Checklist

```
Optimizations Applied:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Data Collection:
[ ] DataCollector buffer size optimized
[ ] SQLite WAL mode enabled
[ ] MT5 max bars reduced

Sync Script:
[ ] Batch inserts (execute_batch)
[ ] Connection pooling configured
[ ] Retry logic implemented

PostgreSQL:
[ ] Indexes on timestamp columns
[ ] Connection pool sized correctly
[ ] Query optimization complete

Redis:
[ ] Appropriate TTL values
[ ] Key naming optimized
[ ] Memory limits configured

API:
[ ] Response compression enabled
[ ] Error handling optimized
[ ] Caching strategy implemented
```

---

## Results Template

### Performance Test Results

```
Performance Test Results
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Test Date: YYYY-MM-DD
Environment: Contabo VPS M / Railway Pro

DATA COLLECTION
---------------
Collection cycle time:    _____ seconds (target: <5s)
MT5 memory per instance:  _____ GB (target: <1GB)
MT5 CPU per instance:     _____ % (target: <10%)
SQLite write latency:     _____ ms (target: <10ms)

SYNC PERFORMANCE
----------------
Full sync time:           _____ seconds (target: <5s)
Rows per second:          _____ rows/s (target: >100)
Per-symbol avg time:      _____ ms
Network bandwidth:        _____ KB per sync

API PERFORMANCE
---------------
Uncached response time:   _____ ms (target: <300ms)
Cached response time:     _____ ms (target: <50ms)
Cache hit rate:           _____ % (target: >80%)

LOAD TESTING
------------
10 concurrent users:      _____ ms avg (target: <200ms)
50 concurrent users:      _____ ms avg (target: <500ms)
100 concurrent users:     _____ ms avg (target: <500ms)
Error rate under load:    _____ % (target: <1%)
Sustained load (10min):   _____ % error rate

RESOURCE USAGE
--------------
Peak CPU (VPS):           _____ %
Peak Memory (VPS):        _____ %
PostgreSQL connections:   _____ (max)
Redis memory:             _____ MB

OVERALL RESULT: [ ] PASS  [ ] FAIL

Notes:
_____________________________________________
_____________________________________________

Recommendations:
_____________________________________________
_____________________________________________
```

---

## Next Steps

After performance testing:

1. ➡️ **[Monitoring Setup Guide](./09-monitoring-setup-guide.md)** - Set up monitoring

---

**Document Version:** 1.0.0
**Created:** 2026-01-08
**Author:** Claude Code (Trading Alerts SaaS Part 20)
