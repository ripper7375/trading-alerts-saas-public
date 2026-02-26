# Nest.js API Architecture Document (Component B)

## Real-Time Trading Data Distribution System

**Project:** Trading Alerts SaaS Platform  
**Component:** B - Nest.js API (Data Distribution Layer)  
**Version:** 2.0  
**Date:** January 15, 2026  
**Deployment:** Railway (Staging) + Timescale Cloud (Production)

---

## 🎯 Executive Summary

The Nest.js API serves as the **central data distribution hub** that orchestrates two distinct data flows:

1. **Green Arrow Flow (30-second updates):** Real-time OHLCV candlestick data directly from MT5 Flask Service via WebSocket
2. **Magenta Arrow Flows (5-minute updates):** All 49 indicator values from TimescaleDB (warm data) + Redis (hot cache - 500 bars)

The API applies **subscription-based access control** (Free vs Pro plans) and delivers data to Next.js frontend using **WebSocket** for efficient real-time communication with TradingView Lightweight Charts.

---

## 📊 System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CONTABO VPS                              │
│                                                                 │
│  ┌────────────────┐         ┌─────────────────┐                │
│  │ MT5 Terminals  │────────▶│ MT5 Flask API   │                │
│  │ (15 terminals) │  IPC    │ (Python)        │                │
│  └────────────────┘         └─────────────────┘                │
│                                      │                           │
│                                      │ WebSocket                │
│                                      │ (Green Arrow)            │
└──────────────────────────────────────┼───────────────────────────┘
                                       │
                                       │ OHLCV only
                                       │ Every 30 seconds
                                       │
                    ┌──────────────────▼───────────────────┐
                    │     Upstash Redis (Message Broker)   │
                    │     - Topic: ohlcv:updates           │
                    └──────────────────┬───────────────────┘
                                       │
                    ┌──────────────────▼───────────────────┐
                    │     Railway Workers (Nest.js)        │
                    │                                      │
                    │  Saves to:                           │
                    │  ┌─────────────────────────────────┐ │
                    │  │ TimescaleDB (PostgreSQL)        │ │
                    │  │ - 57 columns (all data)         │ │
                    │  │ - Production (warm data)        │ │
                    │  │ - Hypertables enabled           │ │
                    │  └─────────────────────────────────┘ │
                    │  ┌─────────────────────────────────┐ │
                    │  │ Upstash Redis (Cache)           │ │
                    │  │ - Hot data (500 bars)           │ │
                    │  │ - Fast queries                  │ │
                    │  └─────────────────────────────────┘ │
                    └──────────────────┬───────────────────┘
                                       │
                                       │ Magenta Arrows
                                       │ Indicators only
                                       │ Every 5 minutes
                                       │
              ┌────────────────────────▼────────────────────────┐
              │          COMPONENT B: Nest.js API               │
              │              (Railway Deployment)               │
              │                                                 │
              │  ┌──────────────────────────────────────────┐  │
              │  │  WebSocket Gateway                       │  │
              │  │  - Socket.io server                      │  │
              │  │  - Rooms per symbol/timeframe           │  │
              │  │  - JWT authentication                    │  │
              │  └──────────────────────────────────────────┘  │
              │                                                 │
              │  ┌──────────────────────────────────────────┐  │
              │  │  Data Aggregation Service               │  │
              │  │  - Merges OHLCV (30s) + Indicators (5m) │  │
              │  │  - Access control (Free/Pro)            │  │
              │  │  - Data validation                       │  │
              │  └──────────────────────────────────────────┘  │
              │                                                 │
              │  ┌──────────────────────────────────────────┐  │
              │  │  Caching Layer (Redis)                  │  │
              │  │  - 500 bars per symbol/timeframe        │  │
              │  │  - Sub-second queries                    │  │
              │  └──────────────────────────────────────────┘  │
              │                                                 │
              │  ┌──────────────────────────────────────────┐  │
              │  │  Database Service (TimescaleDB)         │  │
              │  │  - Historical data                       │  │
              │  │  - Time-series optimized                 │  │
              │  └──────────────────────────────────────────┘  │
              └─────────────────────┬───────────────────────────┘
                                    │
                                    │ WebSocket (bidirectional)
                                    │
              ┌─────────────────────▼───────────────────────────┐
              │      Next.js Frontend (Vercel)                  │
              │                                                 │
              │  ┌──────────────────────────────────────────┐  │
              │  │  TradingView Lightweight Charts          │  │
              │  │  - Candlestick series (OHLCV)           │  │
              │  │  - Indicator overlays (49 indicators)    │  │
              │  │  - Real-time updates                     │  │
              │  └──────────────────────────────────────────┘  │
              └─────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Details

### Green Arrow Flow: OHLCV Data (Every 30 Seconds)

**Source:** MT5 Flask Service (Contabo VPS)  
**Method:** WebSocket (direct connection, no database)  
**Frequency:** Every 30 seconds  
**Access:** FREE + PRO plans

```
MT5 Flask Service (Python)
    │
    │ WebSocket emit: 'ohlcv:update'
    ▼
Nest.js API (Component B)
    │
    │ 1. Receive OHLCV data
    │ 2. Validate data structure
    │ 3. Check user subscription (FREE or PRO)
    │ 4. Broadcast to connected clients
    ▼
Next.js Frontend (Socket.io client)
    │
    │ Event: 'candle:update'
    ▼
TradingView Lightweight Charts
    │
    └─▶ Update candlestick series (live)
```

**OHLCV Data Structure:**

```typescript
interface OHLCVUpdate {
  symbol: string; // e.g., "EURUSD"
  timeframe: string; // e.g., "H1"
  timestamp: number; // Unix timestamp
  open: number; // 1.09500
  high: number; // 1.09750
  low: number; // 1.09200
  close: number; // 1.09650
  volume: number; // 1234
  collected_at: number; // Unix timestamp
}
```

---

### Magenta Arrow Flows: Indicator Data (Every 5 Minutes)

**Source:** TimescaleDB (PostgreSQL) + Upstash Redis (Cache)  
**Method:** Query database every 5 minutes  
**Frequency:** Every 5 minutes  
**Access:** Depends on subscription (FREE vs PRO)

```
TimescaleDB (PostgreSQL) + Redis Cache
    │
    │ Query every 5 minutes
    │ SELECT * FROM eurusd WHERE timeframe='H1' ORDER BY timestamp DESC LIMIT 500
    ▼
Nest.js API (Component B)
    │
    │ 1. Query indicator data (500 bars)
    │ 2. Apply access control:
    │    - FREE: 24 columns (OHLCV + Fractal lines)
    │    - PRO: 57 columns (all indicators)
    │ 3. Filter NULL values for sparse indicators
    │ 4. Format for TradingView
    │ 5. Broadcast to connected clients
    ▼
Next.js Frontend (Socket.io client)
    │
    │ Event: 'indicators:update'
    ▼
TradingView Lightweight Charts
    │
    └─▶ Update indicator overlays (line series)
```

**Indicator Data Structure (PRO Plan):**

```typescript
interface IndicatorUpdate {
  symbol: string;
  timeframe: string;

  // Moving Averages (PRO only) - Continuous
  tema: LineData[]; // Buffer 3
  hrma: LineData[]; // Buffer 2
  smma: LineData[]; // Buffer 1
  ema_26: LineData[]; // Buffer 4

  // Fractal Diagonal Lines (FREE + PRO) - Sparse
  diag_asc_line_1: LineData[];
  diag_asc_line_2: LineData[];
  diag_asc_line_3: LineData[];
  diag_desc_line_1: LineData[];
  diag_desc_line_2: LineData[];
  diag_desc_line_3: LineData[];
  diag_high_map: LineData[];
  diag_low_map: LineData[];

  // Fractal Horizontal Lines (FREE + PRO) - Sparse
  horiz_peak_line_1: LineData[];
  horiz_peak_line_2: LineData[];
  horiz_peak_line_3: LineData[];
  horiz_bottom_line_1: LineData[];
  horiz_bottom_line_2: LineData[];
  horiz_bottom_line_3: LineData[];
  horiz_high_map: LineData[];
  horiz_low_map: LineData[];

  // Heiken Ashi (PRO only) - Continuous
  ha_open: LineData[];
  ha_high: LineData[];
  ha_low: LineData[];
  ha_close: LineData[];
  ha_classification: LineData[];
  ha_body_size: LineData[];
  ha_body_zscore: LineData[];

  // Keltner Channel (PRO only) - Continuous
  kc_ultra_extreme_upper: LineData[];
  kc_extreme_upper: LineData[];
  kc_uppermost: LineData[];
  kc_upper: LineData[];
  kc_upper_middle: LineData[];
  kc_lower_middle: LineData[];
  kc_lower: LineData[];
  kc_lowermost: LineData[];
  kc_extreme_lower: LineData[];
  kc_ultra_extreme_lower: LineData[];

  // Support/Resistance (PRO only) - Sparse
  sr_support_4: LineData[];
  sr_support_3: LineData[];
  sr_support_2: LineData[];
  sr_support_1: LineData[];
  sr_resistance_1: LineData[];
  sr_resistance_2: LineData[];
  sr_resistance_3: LineData[];
  sr_resistance_4: LineData[];

  // ZigZag (PRO only) - Sparse
  zigzag_peak: LineData[];
  zigzag_bottom: LineData[];

  // Body Size Momentum (PRO only) - Continuous
  body_zscore: LineData[];
  candle_classification: LineData[];
}

interface LineData {
  time: number; // Unix timestamp
  value: number; // Indicator value
}
```

---

## 🔐 Access Control Matrix

### FREE Plan (24 Columns)

**Included Indicators:**

- ✅ System columns (8): timestamp, open, high, low, close, volume, timeframe, collected_at
- ✅ Fractal Diagonal Lines (8): All diagonal trendlines
- ✅ Fractal Horizontal Lines (8): All horizontal S/R lines

**Total Columns:** 24  
**Monthly Cost:** $0

### PRO Plan (57 Columns - ALL)

**Includes all FREE indicators PLUS:**

- ✅ TEMA/HRMA/SMMA Moving Averages (3)
- ✅ Body Size Momentum (2)
- ✅ Heiken Ashi (7)
- ✅ Keltner Channel (10)
- ✅ Support/Resistance (8)
- ✅ ZigZag + EMA (3)

**Total Columns:** 57  
**Monthly Cost:** $49

---

## 🏗️ Module Architecture

### 1. WebSocket Gateway Module

**File:** `src/websocket/websocket.gateway.ts`

**Responsibilities:**

- Establish WebSocket connections with clients
- Manage Socket.io rooms per symbol/timeframe
- Handle authentication via JWT tokens
- Broadcast OHLCV updates (every 30s)
- Broadcast indicator updates (every 5m)
- Handle client disconnections

**Key Methods:**

```typescript
@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL }
})
export class ChartGateway {
  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, payload: SubscribeDto)

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(client: Socket, payload: UnsubscribeDto)

  broadcastOHLCV(symbol: string, timeframe: string, data: OHLCVUpdate)

  broadcastIndicators(symbol: string, timeframe: string, data: IndicatorUpdate)
}
```

---

### 2. Data Service Module

**File:** `src/data/data.service.ts`

**Responsibilities:**

- Query TimescaleDB for indicator data
- Query Redis cache for hot data (500 bars)
- Apply access control based on user plan
- Format data for TradingView Lightweight Charts
- Handle NULL values for sparse indicators

**Key Methods:**

```typescript
@Injectable()
export class DataService {
  async getOHLCV(
    symbol: string,
    timeframe: string,
    limit: number = 500
  ): Promise<OHLCVData[]>;

  async getIndicators(
    symbol: string,
    timeframe: string,
    userPlan: 'FREE' | 'PRO',
    limit: number = 500
  ): Promise<IndicatorData>;

  async getHistoricalData(
    symbol: string,
    timeframe: string,
    startTime: number,
    endTime: number,
    userPlan: 'FREE' | 'PRO'
  ): Promise<ChartData>;

  filterByPlan(data: any[], plan: 'FREE' | 'PRO'): any[];
}
```

---

### 3. Cache Service Module

**File:** `src/cache/cache.service.ts`

**Responsibilities:**

- Manage Redis cache (500 bars per symbol/timeframe)
- Cache invalidation strategy
- Fast queries (sub-second)
- Fallback to TimescaleDB

**Key Methods:**

```typescript
@Injectable()
export class CacheService {
  async get(key: string): Promise<any>;

  async set(key: string, value: any, ttl: number): Promise<void>;

  async getCachedBars(
    symbol: string,
    timeframe: string,
    limit: number = 500
  ): Promise<any[]>;

  async invalidateCache(symbol: string, timeframe: string): Promise<void>;
}
```

---

### 4. MT5 Listener Module

**File:** `src/mt5-listener/mt5-listener.service.ts`

**Responsibilities:**

- Listen to MT5 Flask Service WebSocket
- Receive OHLCV updates every 30 seconds
- Validate incoming data
- Broadcast to connected clients via WebSocket Gateway

**Key Methods:**

```typescript
@Injectable()
export class MT5ListenerService {
  onModuleInit() {
    this.connectToMT5Flask();
  }

  connectToMT5Flask(): void;

  handleOHLCVUpdate(data: OHLCVUpdate): void;

  validateOHLCVData(data: any): boolean;
}
```

---

### 5. Indicator Fetcher Module

**File:** `src/indicator-fetcher/indicator-fetcher.service.ts`

**Responsibilities:**

- Query indicators every 5 minutes
- Fetch from Redis cache first
- Fallback to TimescaleDB if cache miss
- Apply access control (FREE vs PRO)
- Broadcast to clients

**Key Methods:**

```typescript
@Injectable()
export class IndicatorFetcherService {
  @Cron('*/5 * * * *') // Every 5 minutes
  async fetchIndicators(): Promise<void>

  async queryDatabase(
    symbol: string,
    timeframe: string,
    limit: number
  ): Promise<RawIndicatorData[]>

  transformForChart(data: RawIndicatorData[]): IndicatorUpdate

  filterNullValues(data: LineData[]): LineData[]
}
```

---

### 6. Authentication Module

**File:** `src/auth/auth.service.ts`

**Responsibilities:**

- Validate JWT tokens
- Check user subscription plan (FREE or PRO)
- Handle token refresh
- Middleware for WebSocket connections

**Key Methods:**

```typescript
@Injectable()
export class AuthService {
  async validateToken(token: string): Promise<User>;

  async getUserPlan(userId: string): Promise<'FREE' | 'PRO'>;

  async checkAccess(user: User, indicator: string): Promise<boolean>;
}
```

---

### 7. Database Module (Prisma)

**File:** `src/prisma/prisma.service.ts`

**Responsibilities:**

- Prisma ORM for TimescaleDB
- Type-safe database queries
- Connection pooling
- Transaction management

**Prisma Schema:**

```prisma
model TradingData {
  timestamp  BigInt
  timeframe  String   @db.VarChar(10)

  // System columns (FREE + PRO)
  open       Decimal  @db.Decimal(10, 5)
  high       Decimal  @db.Decimal(10, 5)
  low        Decimal  @db.Decimal(10, 5)
  close      Decimal  @db.Decimal(10, 5)
  volume     Int?
  collected_at BigInt?

  // Moving Averages (PRO only)
  tema       Decimal? @db.Decimal(10, 5)
  hrma       Decimal? @db.Decimal(10, 5)
  smma       Decimal? @db.Decimal(10, 5)
  ema_26     Decimal? @db.Decimal(10, 5)

  // Fractal Diagonal Lines (FREE + PRO)
  diag_asc_line_1  Decimal? @db.Decimal(10, 5)
  diag_asc_line_2  Decimal? @db.Decimal(10, 5)
  diag_asc_line_3  Decimal? @db.Decimal(10, 5)
  diag_desc_line_1 Decimal? @db.Decimal(10, 5)
  diag_desc_line_2 Decimal? @db.Decimal(10, 5)
  diag_desc_line_3 Decimal? @db.Decimal(10, 5)
  diag_high_map    Decimal? @db.Decimal(10, 5)
  diag_low_map     Decimal? @db.Decimal(10, 5)

  // ... (all 57 columns)

  @@id([timestamp, timeframe])
  @@index([timeframe, timestamp(sort: Desc)])
  @@map("eurusd")
}
```

---

## 📡 API Endpoints

### WebSocket Events

**Client → Server:**

```typescript
// Subscribe to symbol/timeframe
socket.emit('subscribe', {
  symbol: 'EURUSD',
  timeframe: 'H1',
  token: 'jwt_token_here',
});

// Unsubscribe
socket.emit('unsubscribe', {
  symbol: 'EURUSD',
  timeframe: 'H1',
});
```

**Server → Client:**

```typescript
// OHLCV update (every 30 seconds)
socket.on('candle:update', (data: OHLCVUpdate) => {
  // Update candlestick chart
});

// Indicator update (every 5 minutes)
socket.on('indicators:update', (data: IndicatorUpdate) => {
  // Update indicator overlays
});

// Error handling
socket.on('error', (error: { message: string }) => {
  // Handle error
});
```

---

### REST API Endpoints (Fallback)

**GET /api/chart/ohlcv**

```typescript
Query: ?symbol=EURUSD&timeframe=H1&limit=500
Response: OHLCVData[]
```

**GET /api/chart/indicators**

```typescript
Query: ?symbol=EURUSD&timeframe=H1&limit=500
Headers: Authorization: Bearer {jwt_token}
Response: IndicatorData (filtered by plan)
```

**GET /api/chart/historical**

```typescript
Query: ?symbol=EURUSD&timeframe=H1&start=1234567890&end=1234599999
Headers: Authorization: Bearer {jwt_token}
Response: ChartData (OHLCV + Indicators)
```

**GET /api/user/plan**

```typescript
Headers: Authorization: Bearer {jwt_token}
Response: { plan: 'FREE' | 'PRO', features: string[] }
```

---

## ⚡ Performance Optimizations

### 1. Redis Caching Strategy

**Hot Data (500 bars per symbol/timeframe):**

```typescript
// Cache structure
Key: `chart:${symbol}:${timeframe}:ohlcv`
Value: JSON array of 500 OHLCV bars
TTL: 1 hour

Key: `chart:${symbol}:${timeframe}:indicators`
Value: JSON object with all indicators
TTL: 6 minutes (slightly longer than 5-minute update)
```

**Cache Hit Ratio Target:** 95%+

**Fallback to TimescaleDB:**

```typescript
async getCachedOrFetch(symbol: string, timeframe: string) {
  // Try Redis first
  const cached = await redis.get(`chart:${symbol}:${timeframe}`);
  if (cached) return JSON.parse(cached);

  // Fallback to database
  const data = await db.query(`
    SELECT * FROM ${symbol}
    WHERE timeframe = $1
    ORDER BY timestamp DESC
    LIMIT 500
  `, [timeframe]);

  // Cache for next time
  await redis.set(
    `chart:${symbol}:${timeframe}`,
    JSON.stringify(data),
    'EX', 3600
  );

  return data;
}
```

---

### 2. WebSocket Room Management

**Rooms per Symbol/Timeframe:**

```typescript
// Join room
socket.join(`${symbol}:${timeframe}`);

// Broadcast to room only
io.to(`EURUSD:H1`).emit('candle:update', data);

// Leave room
socket.leave(`${symbol}:${timeframe}`);
```

**Benefits:**

- Clients only receive data they subscribed to
- Reduced bandwidth usage
- Scalable to multiple symbols/timeframes

---

### 3. Database Query Optimization

**TimescaleDB Hypertables:**

```sql
-- Create hypertable for time-series data
SELECT create_hypertable('eurusd', 'timestamp');

-- Optimized index
CREATE INDEX idx_eurusd_timeframe_timestamp
ON eurusd(timeframe, timestamp DESC);

-- Compression (for historical data)
ALTER TABLE eurusd SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'timeframe'
);

-- Retention policy (keep 1 year)
SELECT add_retention_policy('eurusd', INTERVAL '1 year');
```

**Query Performance:**

- 500 bars: <50ms (from cache)
- 500 bars: <200ms (from TimescaleDB)
- Historical range: <500ms

---

### 4. Data Transformation Pipeline

**Efficient NULL Filtering:**

```typescript
// Only send non-NULL indicator values to reduce payload size
function filterNullValues(data: LineData[]): LineData[] {
  return data.filter((d) => d.value !== null && d.value !== undefined);
}

// For sparse indicators (ZigZag, S/R levels)
const zigzagPeaks = filterNullValues(
  rawData.map((d) => ({
    time: d.timestamp,
    value: d.zigzag_peak,
  }))
);

// Result: Only ~2-5% of bars sent (95% reduction)
```

---

## 🔒 Security Measures

### 1. JWT Authentication

**Token Structure:**

```typescript
interface JWTPayload {
  userId: string;
  email: string;
  plan: 'FREE' | 'PRO';
  iat: number;
  exp: number;
}
```

**WebSocket Authentication:**

```typescript
// Client sends token on connection
socket.auth = { token: 'jwt_token_here' };

// Server validates
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  try {
    const decoded = await authService.validateToken(token);
    socket.data.user = decoded;
    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
});
```

---

### 2. Rate Limiting

**Per User Limits:**

```typescript
// Max 10 subscriptions per user
const MAX_SUBSCRIPTIONS = 10;

// Max 100 requests per minute
@Throttle(100, 60)
@Get('/api/chart/ohlcv')
```

---

### 3. Input Validation

**DTO (Data Transfer Objects):**

```typescript
class SubscribeDto {
  @IsString()
  @IsIn(['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD'])
  symbol: string;

  @IsString()
  @IsIn(['M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'H12', 'D1'])
  timeframe: string;

  @IsString()
  @IsNotEmpty()
  token: string;
}
```

---

## 📊 Monitoring & Observability

### 1. Metrics to Track

**Real-Time Metrics:**

- Active WebSocket connections
- Messages per second (OHLCV vs Indicators)
- Cache hit ratio
- Database query latency
- API response times

**Business Metrics:**

- FREE vs PRO users connected
- Most popular symbols/timeframes
- Average session duration
- Data transfer volume

---

### 2. Logging Strategy

**Log Levels:**

```typescript
// Info: Normal operations
logger.info('Client subscribed', {
  userId,
  symbol,
  timeframe,
});

// Warn: Potential issues
logger.warn('Cache miss', {
  symbol,
  timeframe,
  latency,
});

// Error: Failures
logger.error('Database query failed', {
  error,
  symbol,
  timeframe,
});
```

---

### 3. Health Checks

**Endpoints:**

```typescript
// Basic health
GET /health
Response: { status: 'ok', uptime: 12345 }

// Detailed health
GET /health/detailed
Response: {
  status: 'ok',
  database: 'connected',
  redis: 'connected',
  mt5Connection: 'connected',
  activeConnections: 42
}
```

---

## 🚀 Deployment Configuration

### Railway Deployment

**Environment Variables:**

```bash
# Database
DATABASE_URL=postgresql://user:pass@timescale.cloud:5432/trading
REDIS_URL=redis://default:pass@upstash.io:6379

# MT5 Flask Service
MT5_FLASK_WS_URL=ws://contabo-vps-ip:5000

# Authentication
JWT_SECRET=your_secret_here
JWT_EXPIRATION=7d

# Frontend
FRONTEND_URL=https://tradingalerts.vercel.app

# Feature Flags
ENABLE_COMPRESSION=true
ENABLE_CACHING=true
CACHE_TTL_SECONDS=3600
```

**Docker Configuration:**

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3001

CMD ["npm", "run", "start:prod"]
```

**Railway Config (`railway.json`):**

```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "npm run start:prod",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

---

## 🧪 Testing Strategy

### Unit Tests

```typescript
describe('DataService', () => {
  it('should filter indicators by FREE plan', async () => {
    const data = await dataService.getIndicators('EURUSD', 'H1', 'FREE', 500);

    // FREE plan should only have 24 columns
    expect(data).not.toHaveProperty('tema');
    expect(data).not.toHaveProperty('kc_upper');
    expect(data).toHaveProperty('diag_asc_line_1');
  });
});
```

### Integration Tests

```typescript
describe('WebSocket Gateway', () => {
  it('should broadcast OHLCV updates to subscribers', async () => {
    const client = io('http://localhost:3001');

    client.emit('subscribe', {
      symbol: 'EURUSD',
      timeframe: 'H1',
      token: validToken,
    });

    const data = await new Promise((resolve) => {
      client.on('candle:update', resolve);
    });

    expect(data).toHaveProperty('open');
    expect(data).toHaveProperty('close');
  });
});
```

---

## 📋 Error Handling

### Error Types

**1. Authentication Errors:**

```typescript
throw new UnauthorizedException('Invalid token');
```

**2. Validation Errors:**

```typescript
throw new BadRequestException('Invalid symbol');
```

**3. Database Errors:**

```typescript
catch (error) {
  logger.error('Database query failed', error);
  throw new InternalServerErrorException('Data fetch failed');
}
```

**4. WebSocket Errors:**

```typescript
socket.emit('error', {
  message: 'Subscription limit reached',
  code: 'MAX_SUBSCRIPTIONS',
});
```

---

## 📈 Scalability Considerations

### Horizontal Scaling

**Load Balancer Configuration:**

```
Railway Load Balancer
    │
    ├─▶ Nest.js Instance 1 (Pod 1)
    ├─▶ Nest.js Instance 2 (Pod 2)
    └─▶ Nest.js Instance 3 (Pod 3)
```

**Sticky Sessions:**

```typescript
// Use Redis adapter for Socket.io
const redisAdapter = createAdapter(redisClient);
io.adapter(redisAdapter);
```

**Benefits:**

- WebSocket connections distributed across instances
- Shared state via Redis
- Auto-scaling based on CPU/memory

---

### Database Scaling

**Read Replicas:**

```typescript
// Write to primary
await prisma.tradingData.create({ data });

// Read from replica
const data = await prisma.tradingData.findMany({
  where: { timeframe: 'H1' },
});
```

---

## ✅ Implementation Checklist

### Phase 1: Core Infrastructure

- [ ] Set up Nest.js project structure
- [ ] Configure Prisma with TimescaleDB
- [ ] Set up Redis connection
- [ ] Implement JWT authentication
- [ ] Create base DTOs and types

### Phase 2: WebSocket Gateway

- [ ] Implement Socket.io gateway
- [ ] Add room management
- [ ] Add authentication middleware
- [ ] Implement subscribe/unsubscribe handlers
- [ ] Add error handling

### Phase 3: Data Services

- [ ] Implement Data Service (query layer)
- [ ] Implement Cache Service (Redis)
- [ ] Add access control (FREE vs PRO)
- [ ] Implement NULL filtering
- [ ] Add data transformation

### Phase 4: MT5 Integration

- [ ] Connect to MT5 Flask WebSocket
- [ ] Handle OHLCV updates
- [ ] Validate incoming data
- [ ] Broadcast to clients

### Phase 5: Indicator Fetching

- [ ] Implement 5-minute cron job
- [ ] Query TimescaleDB/Redis
- [ ] Transform for TradingView
- [ ] Broadcast to clients

### Phase 6: Testing & Optimization

- [ ] Write unit tests (80% coverage)
- [ ] Write integration tests
- [ ] Performance testing
- [ ] Load testing
- [ ] Security audit

### Phase 7: Deployment

- [ ] Configure Railway deployment
- [ ] Set up environment variables
- [ ] Configure health checks
- [ ] Set up monitoring
- [ ] Deploy to production

---

## 🎯 Success Metrics

**Technical KPIs:**

- WebSocket latency: <100ms
- Database query time: <200ms
- Cache hit ratio: >95%
- Uptime: 99.9%
- Error rate: <0.1%

**Business KPIs:**

- Active users: Track growth
- FREE → PRO conversion: Target 10%
- Average session duration: Track engagement
- Data accuracy: 100%

---

## 📚 References

- Nest.js Documentation: https://docs.nestjs.com
- Socket.io Documentation: https://socket.io/docs
- Prisma Documentation: https://www.prisma.io/docs
- TimescaleDB Documentation: https://docs.timescale.com
- TradingView Lightweight Charts: https://tradingview.github.io/lightweight-charts

---

**Document Version:** 2.0  
**Last Updated:** January 15, 2026  
**Status:** Ready for Implementation ✅

---

**End of Architecture Document**
