# Part 6 + Part 20 Dual-System Architecture

**Last Updated:** 2026-01-14
**Status:** ✅ **CURRENT** (Both systems working in parallel)
**Communication:** WebSocket (Part 6) + HTTP/REST (Part 20)
**Deployment:** Windows Native (Part 6) + Railway (Part 20)

---

## Overview

This document describes how **Part 6 (Flask MT5 Service)** and **Part 20 (SQLite-Sync to PostgreSQL)** work together in parallel in the Trading Alerts SaaS system.

### Why Both Systems?

After initial migration from Part 6 to Part 20, we discovered that both systems serve different purposes:

- **Part 6 (Flask MT5 Service)**: Real-time indicator access via **WebSocket** from MT5 terminals
- **Part 20 (SQLite-Sync)**: Historical data sync to PostgreSQL for scalable querying

**Result**: Both systems were restored to work in parallel, giving users flexibility in how they access MT5 data.

### Key Features

- ✅ **Real-time WebSocket streaming** for live charts (Part 6)
- ✅ **Historical PostgreSQL queries** for analysis (Part 20)
- ✅ **Native Windows deployment** for MT5 integration (Part 6)
- ✅ **Feature flag switching** between systems
- ✅ **Bi-directional communication** with TradingView charts

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
│  │  • Native Windows Deployment (no Docker)               │  │
│  │  • WebSocket Server (Socket.IO)                        │  │
│  │    ↓                                                    │  │
│  │  Communication Endpoints:                               │  │
│  │    - WebSocket: ws://host:5001/socket.io               │  │
│  │    - HTTP API: GET /api/indicators/{symbol}/{tf}       │  │
│  │    - Health: GET /api/system/health                    │  │
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

## WebSocket Communication (Part 6)

### Why WebSocket?

Part 6 now uses **WebSocket (Socket.IO)** instead of HTTP polling for real-time data streaming:

| Feature | HTTP Polling (Old) | WebSocket (New) |
|---------|-------------------|-----------------|
| **Communication** | Request/Response | Bi-directional push |
| **Latency** | High (1-5s polling) | Low (<100ms) |
| **Efficiency** | Wasteful | Efficient |
| **Real-time** | ❌ Simulated | ✅ True real-time |
| **TradingView Charts** | ⚠️ Laggy | ✅ Smooth |
| **Bandwidth** | High (headers) | Low (persistent) |

### WebSocket Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              WebSocket Real-Time Data Flow                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Next.js Frontend (Vercel)                                  │
│  └── TradingView Chart Component                            │
│      └── useMT5WebSocket('EURUSD', 'M5') hook              │
│          ↓↑ (WebSocket connection)                          │
│          │                                                   │
│  ws://contabo-ip:5001/socket.io                             │
│          │                                                   │
│          ↓↑                                                  │
│  Flask MT5 Service (Contabo Windows)                        │
│  └── WebSocket Server (Socket.IO)                           │
│      ├── Event: 'subscribe' → Join room                     │
│      ├── Event: 'unsubscribe' → Leave room                  │
│      └── Background thread: Push updates every 1s           │
│          ↓                                                   │
│  MT5 Terminals (15x)                                         │
│  └── Read indicator buffers via MetaTrader5 Python API      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Using WebSocket in Next.js

**Step 1: Install Socket.IO Client**

```bash
npm install socket.io-client
```

**Step 2: Use WebSocket Hook**

```typescript
// app/charts/page.tsx
import { useMT5WebSocket } from '@/lib/websocket/use-mt5-websocket';

export default function ChartPage() {
  const { data, connected, error } = useMT5WebSocket('EURUSD', 'M5');

  if (!connected) {
    return <div>Connecting to real-time data...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <TradingViewChart
      symbol="EURUSD"
      timeframe="M5"
      data={data}  // Real-time updates!
    />
  );
}
```

**Step 3: Configure WebSocket URL**

```env
# .env.local
NEXT_PUBLIC_MT5_WS_URL=http://localhost:5001  # Local dev
# or
NEXT_PUBLIC_MT5_WS_URL=ws://your-contabo-ip:5001  # Production
# or
NEXT_PUBLIC_MT5_WS_URL=wss://your-domain.com  # With SSL
```

### WebSocket Events

**Client → Server:**

| Event | Data | Description |
|-------|------|-------------|
| `connect` | - | Client connected |
| `subscribe` | `{ symbol, timeframe }` | Subscribe to symbol/tf |
| `unsubscribe` | `{ symbol, timeframe }` | Unsubscribe from symbol/tf |
| `ping` | - | Keep-alive heartbeat |

**Server → Client:**

| Event | Data | Description |
|-------|------|-------------|
| `connected` | `{ message, timestamp }` | Connection established |
| `subscribed` | `{ symbol, timeframe }` | Subscription confirmed |
| `initial_data` | `{ data, timestamp }` | Initial data on subscribe |
| `indicator_update` | `{ data, timestamp }` | Real-time data update |
| `error` | `{ message }` | Error occurred |
| `pong` | `{ timestamp }` | Heartbeat response |

### WebSocket Testing

**Test from Browser Console:**

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5001');

socket.on('connect', () => {
  console.log('Connected!');

  // Subscribe to EURUSD M5
  socket.emit('subscribe', {
    symbol: 'EURUSD',
    timeframe: 'M5'
  });
});

socket.on('indicator_update', (data) => {
  console.log('Update:', data);
});
```

**Test from Command Line (wscat):**

```bash
# Install wscat
npm install -g wscat

# Connect
wscat -c "ws://localhost:5001/socket.io/?EIO=4&transport=websocket"

# Send subscribe event (after connection)
42["subscribe",{"symbol":"EURUSD","timeframe":"M5"}]
```

---

## Deployment Models

### Part 6 Deployment (Contabo Windows VPS)

**❌ NOT Docker** - Must run natively on Windows:

```
Contabo Windows VPS
├── Windows Server 2019/2022
├── Python 3.9+ (native)
├── MT5 Terminals (15x native)
└── Flask MT5 Service
    ├── Running as Windows Service (NSSM)
    ├── Port: 5001
    ├── WebSocket: Enabled
    └── Auto-start on boot
```

**Why Windows Native?**
- ✅ MetaTrader5 Python package requires Windows
- ✅ Direct MT5 terminal process access (COM API)
- ✅ No Docker virtualization overhead
- ✅ Better performance

**Deployment Guide:** See [Contabo Windows Setup](../deployment/contabo-windows-setup.md)

### Part 20 Deployment (Railway + Contabo)

**✅ Uses Docker** - PostgreSQL/Redis on Railway:

```
Railway (Cloud)
├── PostgreSQL (TimescaleDB)
├── Redis
└── Next.js App (Vercel)

Contabo Windows VPS
├── MT5 Terminals (15x)
├── MQL5 Scripts → SQLite
└── Sync Script → Railway PostgreSQL
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
