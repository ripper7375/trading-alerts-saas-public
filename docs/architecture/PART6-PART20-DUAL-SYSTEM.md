# Part 6 + Part 20 Dual-System Architecture

**Last Updated:** 2026-01-14
**Status:** Active (Both systems working in parallel)

---

## Overview

This document describes how **Part 6 (Flask MT5 Service)** and **Part 20 (SQLite-Sync to PostgreSQL)** work together in parallel in the Trading Alerts SaaS system.

### Why Both Systems?

After initial migration from Part 6 to Part 20, we discovered that both systems serve different purposes:

- **Part 6 (Flask MT5 Service)**: Real-time indicator access directly from MT5 terminals
- **Part 20 (SQLite-Sync)**: Historical data sync to PostgreSQL for scalable querying

**Result**: Both systems were restored to work in parallel, giving users flexibility in how they access MT5 data.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Trading Alerts SaaS System                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              Part 6: Flask MT5 Service                  │  │
│  │              (Real-time Indicator Access)               │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │                                                         │  │
│  │  MT5 Terminals (15x)                                    │  │
│  │    ↓                                                    │  │
│  │  Flask Python Service (Port 5001)                       │  │
│  │    ↓                                                    │  │
│  │  HTTP API Endpoints                                     │  │
│  │    - GET /api/indicators/{symbol}/{timeframe}          │  │
│  │    - GET /api/system/health                            │  │
│  │    - GET /api/mt5/price?symbol={symbol}                │  │
│  │                                                         │  │
│  └─────────────────────────────────────────────────────────┘  │
│                            ↑                                   │
│                            │                                   │
│                  (Feature Flag: USE_FLASK_MT5=true)            │
│                            │                                   │
│  ┌─────────────────────────┴───────────────────────────────┐  │
│  │              Next.js Application Layer                  │  │
│  │              (Hybrid Mode Support)                      │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │                                                         │  │
│  │  • lib/jobs/alert-checker.ts                            │  │
│  │    - Checks USE_FLASK_MT5 flag                          │  │
│  │    - Routes to Flask OR PostgreSQL                      │  │
│  │                                                         │  │
│  │  • lib/monitoring/system-monitor.ts                     │  │
│  │    - Health checks for both systems                     │  │
│  │                                                         │  │
│  │  • lib/api/mt5-client.ts                                │  │
│  │    - Calls Flask service endpoints                      │  │
│  │                                                         │  │
│  └─────────────────────────┬───────────────────────────────┘  │
│                            │                                   │
│                  (Feature Flag: USE_FLASK_MT5=false)           │
│                            │                                   │
│                            ↓                                   │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │          Part 20: SQLite-Sync to PostgreSQL             │  │
│  │          (Synced Historical Data)                       │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │                                                         │  │
│  │  MT5 Terminals (15x)                                    │  │
│  │    ↓                                                    │  │
│  │  MQL5 Scripts (Write to SQLite)                         │  │
│  │    ↓                                                    │  │
│  │  SQLite Database (Local on MT5 VPS)                     │  │
│  │    ↓                                                    │  │
│  │  Sync Script (Every 30-60s)                             │  │
│  │    ↓                                                    │  │
│  │  PostgreSQL (Railway)                                   │  │
│  │    - Tables: eurusd_m5, xauusd_h1, etc.                │  │
│  │    - Queried by Prisma ORM                              │  │
│  │                                                         │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Feature Flag: USE_FLASK_MT5

The system uses a feature flag to switch between Part 6 and Part 20:

### Environment Variable

```bash
# Use Flask MT5 Service (Part 6) - Real-time data
USE_FLASK_MT5=true

# Use PostgreSQL (Part 20) - Synced data (default)
USE_FLASK_MT5=false
```

### Where It's Used

#### 1. Alert Checker (`lib/jobs/alert-checker.ts`)

```typescript
const USE_FLASK_MT5 = process.env['USE_FLASK_MT5'] === 'true';

async function fetchCurrentPrice(symbol: string, timeframe: string): Promise<number> {
  if (USE_FLASK_MT5) {
    // Part 6: Query Flask MT5 service
    const response = await fetch(`${MT5_API_URL}/api/mt5/price?symbol=${symbol}`);
    const data = await response.json();
    return data?.price ?? 0;
  } else {
    // Part 20: Query PostgreSQL
    const result = await query(`SELECT close FROM ${symbol.toLowerCase()}_m5 ORDER BY timestamp DESC LIMIT 1`);
    return result[0]?.close ?? 0;
  }
}
```

#### 2. System Monitor (`lib/monitoring/system-monitor.ts`)

```typescript
const USE_FLASK_MT5 = process.env['USE_FLASK_MT5'] === 'true';

async function checkDataService(): Promise<HealthCheck> {
  if (USE_FLASK_MT5) {
    // Part 6: Check Flask service health
    const response = await fetch(`${MT5_SERVICE_URL}/api/system/health`);
    return { status: response.ok ? 'healthy' : 'down' };
  } else {
    // Part 20: Check PostgreSQL sync freshness
    const syncStatus = await query(`SELECT MAX(timestamp) FROM eurusd_m5`);
    const isStale = Date.now() - new Date(syncStatus[0].last_sync).getTime() > 60000;
    return { status: isStale ? 'degraded' : 'healthy' };
  }
}
```

---

## Comparison: Part 6 vs Part 20

| Feature | Part 6 (Flask) | Part 20 (PostgreSQL) |
|---------|----------------|----------------------|
| **Data Source** | Direct from MT5 terminals | Synced from SQLite |
| **Latency** | Real-time (<100ms) | Delayed (30-60s sync) |
| **Scalability** | Limited (15 terminals) | High (PostgreSQL) |
| **Availability** | Depends on MT5 terminals | High (Railway PostgreSQL) |
| **Use Case** | Real-time alerts, live charts | Historical analysis, reporting |
| **API** | Flask HTTP endpoints | Prisma ORM queries |
| **Deployment** | Docker container (mt5-service) | Sync script on Contabo VPS |

---

## When to Use Each System

### Use Part 6 (Flask) When:

✅ You need **real-time price data** (< 1 second delay)
✅ You need **live indicator values** directly from MT5
✅ You're running **price alerts** that require immediate detection
✅ You have **direct access** to MT5 terminals

### Use Part 20 (PostgreSQL) When:

✅ You need **historical data** for analysis
✅ You want **scalable querying** for multiple users
✅ You don't mind **30-60 second data delay**
✅ You want **reliable data** even if MT5 terminals restart
✅ You're building **reports or dashboards**

---

## Configuration Guide

### 1. Set Up Part 6 (Flask MT5 Service)

#### Step 1: Add Environment Variables

```bash
# .env.local
USE_FLASK_MT5=true
MT5_SERVICE_URL=http://localhost:5001
MT5_API_URL=http://localhost:5000
MT5_API_KEY=your-api-key-here
MT5_LOGIN=your_mt5_login
MT5_PASSWORD=your_mt5_password
MT5_SERVER=your_mt5_server
```

#### Step 2: Start Flask Service

```bash
# Using Docker Compose
docker-compose up -d mt5-service

# Verify Flask is running
curl http://localhost:5001/api/system/health
# Expected: {"status": "ok", "terminals": 15}
```

#### Step 3: Test Indicator Fetch

```bash
curl http://localhost:5001/api/indicators/EURUSD/M5
# Expected: JSON with OHLC, horizontal lines, fractals, etc.
```

---

### 2. Set Up Part 20 (PostgreSQL Sync)

#### Step 1: Add Environment Variables

```bash
# .env.local
USE_FLASK_MT5=false  # Default
POSTGRESQL_URI=postgresql://user:password@host:5432/database
REDIS_URL=redis://default:password@host:6379
ADMIN_API_KEY=your-admin-key-here
```

#### Step 2: Deploy Sync Script (Contabo VPS)

```bash
# On Contabo VPS where MT5 terminals run
cd /opt/trading-alerts/sync
./start-sync.sh
```

#### Step 3: Verify PostgreSQL Data

```bash
# Check latest synced data
psql $POSTGRESQL_URI -c "SELECT MAX(timestamp) FROM eurusd_m5"
# Expected: Recent timestamp (< 60s ago)
```

---

## Switching Between Systems

### Quick Switch

Simply change the `USE_FLASK_MT5` environment variable and restart your application:

```bash
# Switch to Flask (Part 6)
export USE_FLASK_MT5=true
pnpm dev

# Switch to PostgreSQL (Part 20)
export USE_FLASK_MT5=false
pnpm dev
```

### Production Deployment

Update environment variables in your deployment platform:

**Railway:**
1. Go to your project settings
2. Navigate to Variables
3. Set `USE_FLASK_MT5=true` or `USE_FLASK_MT5=false`
4. Redeploy

**Vercel:**
1. Go to Project Settings → Environment Variables
2. Add/update `USE_FLASK_MT5`
3. Redeploy

---

## Health Monitoring

### Check System Health

```bash
# Check overall system health
curl http://localhost:3000/api/system/health

# Response includes both systems:
{
  "status": "healthy",
  "checks": {
    "database": { "status": "healthy" },
    "redis": { "status": "healthy" },
    "dataService": {
      "status": "healthy",
      // Flask health if USE_FLASK_MT5=true
      // OR PostgreSQL sync status if USE_FLASK_MT5=false
    },
    "websocket": { "status": "healthy" }
  }
}
```

### Monitor Data Freshness

**Part 6 (Flask):**
```bash
# Flask should respond within 100ms
curl -w "@curl-format.txt" http://localhost:5001/api/system/health
```

**Part 20 (PostgreSQL):**
```bash
# Check data age (should be < 60s)
psql $POSTGRESQL_URI -c "
  SELECT
    'eurusd_m5' as table_name,
    MAX(timestamp) as last_update,
    EXTRACT(EPOCH FROM (NOW() - MAX(timestamp)))::INTEGER as age_seconds
  FROM eurusd_m5
"
```

---

## Troubleshooting

### Part 6 Issues

**Problem:** Flask service not responding

```bash
# Check if container is running
docker ps | grep mt5-service

# Check Flask logs
docker logs mt5-service

# Restart Flask service
docker-compose restart mt5-service
```

**Problem:** MT5 terminals not connected

```bash
# Check terminal connections
curl http://localhost:5001/api/system/health | jq '.terminals'
# Should show count of connected terminals (15)
```

### Part 20 Issues

**Problem:** Data is stale (> 60s old)

```bash
# Check sync script status on Contabo VPS
ssh contabo "systemctl status mt5-sync"

# Check sync logs
ssh contabo "tail -f /opt/trading-alerts/sync/logs/sync.log"
```

**Problem:** PostgreSQL connection failed

```bash
# Test PostgreSQL connection
psql $POSTGRESQL_URI -c "SELECT 1"

# Check Railway PostgreSQL status
railway status
```

---

## Migration History

### 2026-01-07: Part 6 → Part 20 Migration
- Migrated from Flask MT5 service to PostgreSQL sync
- Archived Part 6 code in `archive/part6-flask-mt5/`
- Updated alert-checker and system-monitor to use PostgreSQL

### 2026-01-14: Part 6 Restoration
- Realized both systems serve different purposes
- Restored Part 6 from archive
- Added `USE_FLASK_MT5` feature flag for dual-system support
- Updated alert-checker and system-monitor to support both systems

---

## Files Changed

### Restored Files
- `mt5-service/` - Flask MT5 service (entire directory)

### Modified Files
- `lib/jobs/alert-checker.ts` - Added hybrid mode support
- `lib/monitoring/system-monitor.ts` - Added hybrid mode support
- `.env.example` - Added Part 6 environment variables and USE_FLASK_MT5 flag
- `docs/architecture/PART6-PART20-DUAL-SYSTEM.md` - This document

### Unchanged Files
- `lib/api/mt5-client.ts` - Still calls Flask service (compatible with Part 6)
- `lib/api/mt5-transform.ts` - Still transforms Flask responses
- `docker-compose.yml` - Already had mt5-service configuration

---

## Future Enhancements

### Potential Improvements

1. **Automatic Fallback**: If Flask is down, automatically fall back to PostgreSQL
2. **Load Balancing**: Distribute requests across Flask and PostgreSQL based on load
3. **Hybrid Queries**: Combine real-time Flask data with historical PostgreSQL data
4. **Smart Caching**: Cache PostgreSQL results with Redis, refresh from Flask on demand

### Considerations

- Monitor resource usage of running both systems
- Evaluate cost-benefit of maintaining both infrastructures
- Consider user-specific preferences (some users prefer real-time, others prefer historical)

---

## References

- [Part 6 Build Order](../build-orders/part-06-flask-mt5.md)
- [Part 20 Architecture](../sqlite-and-mt5service/part-20-architecture-design.md)
- [Part 6 to Part 20 Migration Analysis](../migration/part6-to-part20-analysis.md)
- [Rollback to Part 6 Guide](../migration/rollback-to-part6.md)

---

**Document Status:** ✅ Active
**Maintained By:** Development Team
**Last Review:** 2026-01-14
