# Claude Code Implementation Prompt

## Nest.js Real-Time Trading Data API (Component B)

---

## 📋 Project Overview

You are building **Component B** of a Trading Alerts SaaS platform - a Nest.js API that serves as the central data distribution hub for real-time trading data. This API receives data from two sources and distributes it to a Next.js frontend:

1. **OHLCV Data (Green Arrow):** Real-time candlestick data every 30 seconds from MT5 Flask Service via WebSocket
2. **Indicator Data (Magenta Arrows):** All 49 technical indicators every 5 minutes from TimescaleDB + Redis cache

The API must handle **subscription-based access control** (FREE vs PRO plans) and use **WebSocket** for efficient real-time communication.

---

## 🎯 Implementation Goals

### Primary Objectives:

1. Build Nest.js WebSocket gateway for real-time data distribution
2. Connect to MT5 Flask Service to receive OHLCV updates (30s)
3. Query TimescaleDB + Redis for indicator data (5m intervals)
4. Apply access control (FREE plan: 24 columns, PRO plan: 57 columns)
5. Format data for TradingView Lightweight Charts
6. Deploy to Railway with proper monitoring

### Technical Requirements:

- **Framework:** Nest.js v10+ with TypeScript
- **WebSocket:** Socket.io v4+
- **Database:** Prisma with TimescaleDB (PostgreSQL)
- **Cache:** Redis (Upstash)
- **Authentication:** JWT tokens
- **Testing:** Jest (80%+ coverage)
- **Deployment:** Railway (Docker)

---

## 📁 Project Structure

```
nest-api/
├── src/
│   ├── app.module.ts                      # Main application module
│   ├── main.ts                            # Bootstrap application
│   │
│   ├── websocket/
│   │   ├── websocket.module.ts            # WebSocket module
│   │   ├── websocket.gateway.ts           # Socket.io gateway
│   │   └── dto/
│   │       ├── subscribe.dto.ts           # Subscription DTO
│   │       └── unsubscribe.dto.ts         # Unsubscription DTO
│   │
│   ├── data/
│   │   ├── data.module.ts                 # Data service module
│   │   ├── data.service.ts                # Query & format data
│   │   └── types/
│   │       ├── ohlcv.types.ts             # OHLCV interfaces
│   │       ├── indicator.types.ts         # Indicator interfaces
│   │       └── chart.types.ts             # Combined types
│   │
│   ├── cache/
│   │   ├── cache.module.ts                # Redis cache module
│   │   ├── cache.service.ts               # Cache operations
│   │   └── cache.config.ts                # Cache configuration
│   │
│   ├── mt5-listener/
│   │   ├── mt5-listener.module.ts         # MT5 listener module
│   │   └── mt5-listener.service.ts        # Listen to Flask WebSocket
│   │
│   ├── indicator-fetcher/
│   │   ├── indicator-fetcher.module.ts    # Indicator fetcher module
│   │   └── indicator-fetcher.service.ts   # Fetch indicators every 5m
│   │
│   ├── auth/
│   │   ├── auth.module.ts                 # Authentication module
│   │   ├── auth.service.ts                # JWT validation
│   │   ├── auth.guard.ts                  # WebSocket auth guard
│   │   └── decorators/
│   │       └── user-plan.decorator.ts     # Extract user plan
│   │
│   ├── prisma/
│   │   ├── prisma.module.ts               # Prisma module
│   │   ├── prisma.service.ts              # Database service
│   │   └── schema.prisma                  # Database schema (57 columns)
│   │
│   ├── config/
│   │   ├── database.config.ts             # Database configuration
│   │   ├── redis.config.ts                # Redis configuration
│   │   └── websocket.config.ts            # WebSocket configuration
│   │
│   └── common/
│       ├── constants/
│       │   ├── access-control.ts          # FREE vs PRO column access
│       │   └── symbols.ts                 # Supported symbols/timeframes
│       ├── filters/
│       │   └── ws-exception.filter.ts     # WebSocket error handling
│       └── guards/
│           └── ws-auth.guard.ts           # WebSocket authentication
│
├── test/
│   ├── unit/
│   │   ├── data.service.spec.ts
│   │   ├── cache.service.spec.ts
│   │   └── websocket.gateway.spec.ts
│   └── e2e/
│       └── websocket.e2e-spec.ts
│
├── prisma/
│   └── schema.prisma                      # Complete 57-column schema
│
├── .env.example                           # Environment variables template
├── docker-compose.yml                     # Local development
├── Dockerfile                             # Production deployment
├── railway.json                           # Railway configuration
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🔧 Step-by-Step Implementation Guide

### Step 1: Project Initialization

**Create new Nest.js project:**

```bash
nest new nest-api
cd nest-api

# Install core dependencies
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
npm install @prisma/client @nestjs/schedule @nestjs/jwt
npm install redis ioredis socket.io-client
npm install class-validator class-transformer

# Install dev dependencies
npm install -D @types/socket.io prisma
```

**Initialize Prisma:**

```bash
npx prisma init
```

---

### Step 2: Database Schema (Prisma)

**File:** `prisma/schema.prisma`

**Requirements:**

- Use the 57-column schema from the architecture document
- Set up composite primary key (timestamp, timeframe)
- Add indexes for query optimization
- Use DECIMAL(10,5) for all price/indicator columns
- Map to table name (e.g., "eurusd")

**Example structure:**

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model TradingData {
  timestamp  BigInt
  timeframe  String   @db.VarChar(10)

  // System columns (8) - FREE + PRO
  open       Decimal  @db.Decimal(10, 5)
  high       Decimal  @db.Decimal(10, 5)
  low        Decimal  @db.Decimal(10, 5)
  close      Decimal  @db.Decimal(10, 5)
  volume     Int?
  collected_at BigInt?

  // Moving Averages (3) - PRO ONLY
  tema       Decimal? @db.Decimal(10, 5)
  hrma       Decimal? @db.Decimal(10, 5)
  smma       Decimal? @db.Decimal(10, 5)
  ema_26     Decimal? @db.Decimal(10, 5)

  // ... (all 57 columns)

  @@id([timestamp, timeframe])
  @@index([timeframe, timestamp(sort: Desc)])
  @@map("eurusd")
}
```

**Generate Prisma client:**

```bash
npx prisma generate
```

---

### Step 3: Access Control Constants

**File:** `src/common/constants/access-control.ts`

**Requirements:**

- Define which columns are accessible for FREE plan (24 columns)
- Define which columns are accessible for PRO plan (57 columns)
- Export as constants for use in data filtering

**FREE Plan Columns (24):**

```typescript
export const FREE_PLAN_COLUMNS = [
  // System (8)
  'timestamp',
  'open',
  'high',
  'low',
  'close',
  'volume',
  'timeframe',
  'collected_at',

  // Fractal Diagonal Lines (8)
  'diag_asc_line_1',
  'diag_asc_line_2',
  'diag_asc_line_3',
  'diag_desc_line_1',
  'diag_desc_line_2',
  'diag_desc_line_3',
  'diag_high_map',
  'diag_low_map',

  // Fractal Horizontal Lines (8)
  'horiz_peak_line_1',
  'horiz_peak_line_2',
  'horiz_peak_line_3',
  'horiz_bottom_line_1',
  'horiz_bottom_line_2',
  'horiz_bottom_line_3',
  'horiz_high_map',
  'horiz_low_map',
];
```

**PRO Plan Columns (57):**

```typescript
export const PRO_PLAN_COLUMNS = [
  ...FREE_PLAN_COLUMNS,

  // Additional PRO-only columns (33)
  'tema',
  'hrma',
  'smma',
  'ema_26',
  'ha_open',
  'ha_high',
  'ha_low',
  'ha_close',
  'ha_classification',
  'ha_body_size',
  'ha_body_zscore',
  'kc_ultra_extreme_upper',
  'kc_extreme_upper',
  'kc_uppermost',
  'kc_upper',
  'kc_upper_middle',
  'kc_lower_middle',
  'kc_lower',
  'kc_lowermost',
  'kc_extreme_lower',
  'kc_ultra_extreme_lower',
  'sr_support_4',
  'sr_support_3',
  'sr_support_2',
  'sr_support_1',
  'sr_resistance_1',
  'sr_resistance_2',
  'sr_resistance_3',
  'sr_resistance_4',
  'zigzag_peak',
  'zigzag_bottom',
  'body_zscore',
  'candle_classification',
];
```

---

### Step 4: WebSocket Gateway

**File:** `src/websocket/websocket.gateway.ts`

**Requirements:**

- Use Socket.io for WebSocket connections
- Implement authentication middleware (JWT)
- Create rooms per symbol/timeframe (e.g., "EURUSD:H1")
- Handle subscribe/unsubscribe events
- Broadcast OHLCV updates to subscribers
- Broadcast indicator updates to subscribers
- Handle client disconnections
- Add error handling

**Key features:**

```typescript
@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL }
})
export class ChartGateway {
  @WebSocketServer()
  server: Server;

  // Authenticate on connection
  async handleConnection(client: Socket) {
    const token = client.handshake.auth.token;
    // Validate JWT and attach user data
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SubscribeDto
  ) {
    // Join room: symbol:timeframe
    client.join(`${dto.symbol}:${dto.timeframe}`);

    // Send initial data (500 bars from cache)
    const ohlcv = await this.dataService.getOHLCV(...);
    const indicators = await this.dataService.getIndicators(...);

    client.emit('initial:data', { ohlcv, indicators });
  }

  // Broadcast OHLCV to specific room
  broadcastOHLCV(symbol: string, timeframe: string, data: OHLCVUpdate) {
    this.server.to(`${symbol}:${timeframe}`).emit('candle:update', data);
  }

  // Broadcast indicators to specific room
  broadcastIndicators(symbol: string, timeframe: string, data: IndicatorUpdate) {
    this.server.to(`${symbol}:${timeframe}`).emit('indicators:update', data);
  }
}
```

---

### Step 5: MT5 Listener Service

**File:** `src/mt5-listener/mt5-listener.service.ts`

**Requirements:**

- Connect to MT5 Flask WebSocket server
- Listen for OHLCV updates (every 30 seconds)
- Validate incoming data
- Forward to WebSocket Gateway for broadcasting
- Reconnect on disconnection

**Implementation:**

```typescript
@Injectable()
export class MT5ListenerService implements OnModuleInit {
  private socket: SocketIOClient.Socket;

  constructor(private chartGateway: ChartGateway) {}

  onModuleInit() {
    this.connectToMT5Flask();
  }

  private connectToMT5Flask() {
    this.socket = io(process.env.MT5_FLASK_WS_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Connected to MT5 Flask Service');
    });

    this.socket.on('ohlcv:update', (data: OHLCVUpdate) => {
      // Validate data
      if (this.validateOHLCV(data)) {
        // Broadcast to all subscribers
        this.chartGateway.broadcastOHLCV(data.symbol, data.timeframe, data);
      }
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from MT5 Flask Service');
    });
  }

  private validateOHLCV(data: any): boolean {
    // Validate structure and values
    return (
      data.symbol &&
      data.timeframe &&
      typeof data.open === 'number' &&
      typeof data.close === 'number'
      // ... more validations
    );
  }
}
```

---

### Step 6: Indicator Fetcher Service

**File:** `src/indicator-fetcher/indicator-fetcher.service.ts`

**Requirements:**

- Use `@nestjs/schedule` for cron jobs
- Query indicators every 5 minutes
- Try Redis cache first, fallback to TimescaleDB
- Apply access control (FREE vs PRO)
- Filter NULL values for sparse indicators
- Transform to TradingView format
- Broadcast to WebSocket Gateway

**Implementation:**

```typescript
@Injectable()
export class IndicatorFetcherService {
  constructor(
    private dataService: DataService,
    private chartGateway: ChartGateway,
    private cacheService: CacheService
  ) {}

  @Cron('*/5 * * * *') // Every 5 minutes
  async fetchAndBroadcastIndicators() {
    const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD'];
    const timeframes = [
      'M5',
      'M15',
      'M30',
      'H1',
      'H2',
      'H4',
      'H8',
      'H12',
      'D1',
    ];

    for (const symbol of symbols) {
      for (const timeframe of timeframes) {
        try {
          // Try cache first
          let data = await this.cacheService.get(
            `indicators:${symbol}:${timeframe}`
          );

          if (!data) {
            // Fallback to database
            data = await this.dataService.queryIndicators(
              symbol,
              timeframe,
              500
            );

            // Cache for 6 minutes
            await this.cacheService.set(
              `indicators:${symbol}:${timeframe}`,
              data,
              360
            );
          }

          // Transform for chart
          const transformed = this.transformForChart(data);

          // Broadcast to all subscribers in this room
          this.chartGateway.broadcastIndicators(symbol, timeframe, transformed);
        } catch (error) {
          console.error(
            `Error fetching indicators for ${symbol}:${timeframe}`,
            error
          );
        }
      }
    }
  }

  private transformForChart(data: any[]): IndicatorUpdate {
    // Transform raw database rows to LineData[] format
    // Filter NULL values
    // Return in TradingView format
  }
}
```

---

### Step 7: Data Service

**File:** `src/data/data.service.ts`

**Requirements:**

- Query OHLCV data from cache/database
- Query indicator data with access control
- Filter columns based on user plan (FREE vs PRO)
- Transform data for TradingView format
- Handle NULL values properly

**Implementation:**

```typescript
@Injectable()
export class DataService {
  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService
  ) {}

  async getOHLCV(
    symbol: string,
    timeframe: string,
    limit: number = 500
  ): Promise<OHLCVData[]> {
    // Try cache first
    const cacheKey = `ohlcv:${symbol}:${timeframe}`;
    let data = await this.cacheService.get(cacheKey);

    if (!data) {
      // Query database
      data = await this.prisma.tradingData.findMany({
        where: { timeframe },
        select: {
          timestamp: true,
          open: true,
          high: true,
          low: true,
          close: true,
          volume: true,
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });

      // Cache for 1 hour
      await this.cacheService.set(cacheKey, data, 3600);
    }

    return data.map((d) => ({
      time: Number(d.timestamp),
      open: Number(d.open),
      high: Number(d.high),
      low: Number(d.low),
      close: Number(d.close),
    }));
  }

  async getIndicators(
    symbol: string,
    timeframe: string,
    userPlan: 'FREE' | 'PRO',
    limit: number = 500
  ): Promise<IndicatorData> {
    // Determine which columns to select based on plan
    const columns = userPlan === 'PRO' ? PRO_PLAN_COLUMNS : FREE_PLAN_COLUMNS;

    // Build select object dynamically
    const select = columns.reduce((acc, col) => {
      acc[col] = true;
      return acc;
    }, {});

    // Query database
    const data = await this.prisma.tradingData.findMany({
      where: { timeframe },
      select,
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    // Transform to TradingView format
    return this.transformIndicators(data, userPlan);
  }

  private transformIndicators(data: any[], plan: string): IndicatorData {
    // Convert database rows to indicator series
    // Filter NULL values for sparse indicators
    // Return in TradingView LineData[] format
  }
}
```

---

### Step 8: Cache Service

**File:** `src/cache/cache.service.ts`

**Requirements:**

- Connect to Upstash Redis
- Implement get/set/delete operations
- Handle connection errors gracefully
- Support TTL (time-to-live)

**Implementation:**

```typescript
@Injectable()
export class CacheService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
  }

  async get(key: string): Promise<any> {
    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttl: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error('Redis delete error:', error);
    }
  }
}
```

---

### Step 9: Authentication

**File:** `src/auth/auth.service.ts`

**Requirements:**

- Validate JWT tokens
- Extract user information (userId, plan)
- Handle token expiration
- Create WebSocket authentication guard

**Implementation:**

```typescript
@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async validateToken(token: string): Promise<JWTPayload> {
    try {
      const decoded = await this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });

      return {
        userId: decoded.userId,
        email: decoded.email,
        plan: decoded.plan,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async getUserPlan(userId: string): Promise<'FREE' | 'PRO'> {
    // Query user database for plan
    // Return 'FREE' or 'PRO'
  }
}
```

**File:** `src/common/guards/ws-auth.guard.ts`

```typescript
@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();
    const token = client.handshake.auth.token;

    if (!token) {
      throw new WsException('Authentication required');
    }

    try {
      const user = await this.authService.validateToken(token);
      client.data.user = user;
      return true;
    } catch (error) {
      throw new WsException('Invalid token');
    }
  }
}
```

---

### Step 10: Environment Configuration

**File:** `.env.example`

```bash
# Database
DATABASE_URL=postgresql://user:password@timescale.cloud:5432/trading_db

# Redis Cache
REDIS_URL=redis://default:password@upstash.io:6379

# MT5 Flask Service
MT5_FLASK_WS_URL=ws://contabo-vps-ip:5000

# Authentication
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRATION=7d

# Frontend URL
FRONTEND_URL=https://tradingalerts.vercel.app

# Application
PORT=3001
NODE_ENV=production

# Caching
CACHE_TTL_OHLCV=3600
CACHE_TTL_INDICATORS=360

# Features
ENABLE_COMPRESSION=true
ENABLE_CORS=true
```

---

### Step 11: Docker Configuration

**File:** `Dockerfile`

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npm run build
RUN npx prisma generate

FROM node:18-alpine AS runner

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

EXPOSE 3001

CMD ["npm", "run", "start:prod"]
```

**File:** `docker-compose.yml` (for local development)

```yaml
version: '3.8'

services:
  postgres:
    image: timescale/timescaledb:latest-pg14
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: trading_db
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'

  api:
    build: .
    ports:
      - '3001:3001'
    depends_on:
      - postgres
      - redis
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/trading_db
      REDIS_URL: redis://redis:6379

volumes:
  postgres_data:
```

---

### Step 12: Testing

**Unit Test Example:** `test/unit/data.service.spec.ts`

```typescript
describe('DataService', () => {
  let service: DataService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DataService, PrismaService, CacheService],
    }).compile();

    service = module.get<DataService>(DataService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getIndicators', () => {
    it('should filter indicators for FREE plan', async () => {
      const result = await service.getIndicators('EURUSD', 'H1', 'FREE', 500);

      // FREE plan should not have PRO-only indicators
      expect(result).not.toHaveProperty('tema');
      expect(result).not.toHaveProperty('kc_upper');

      // FREE plan should have fractal lines
      expect(result).toHaveProperty('diag_asc_line_1');
      expect(result).toHaveProperty('horiz_peak_line_1');
    });

    it('should include all indicators for PRO plan', async () => {
      const result = await service.getIndicators('EURUSD', 'H1', 'PRO', 500);

      // PRO plan should have all indicators
      expect(result).toHaveProperty('tema');
      expect(result).toHaveProperty('kc_upper');
      expect(result).toHaveProperty('zigzag_peak');
    });
  });
});
```

**E2E Test Example:** `test/e2e/websocket.e2e-spec.ts`

```typescript
describe('WebSocket Gateway (e2e)', () => {
  let app: INestApplication;
  let client: SocketIOClient.Socket;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(3001);

    client = io('http://localhost:3001', {
      auth: { token: validJwtToken },
    });
  });

  afterAll(async () => {
    client.close();
    await app.close();
  });

  it('should connect and subscribe to symbol/timeframe', (done) => {
    client.on('connect', () => {
      client.emit('subscribe', {
        symbol: 'EURUSD',
        timeframe: 'H1',
      });

      client.on('initial:data', (data) => {
        expect(data).toHaveProperty('ohlcv');
        expect(data).toHaveProperty('indicators');
        done();
      });
    });
  });

  it('should receive OHLCV updates', (done) => {
    client.on('candle:update', (data) => {
      expect(data).toHaveProperty('open');
      expect(data).toHaveProperty('close');
      expect(data.symbol).toBe('EURUSD');
      done();
    });
  });
});
```

---

## 🎯 Implementation Priorities

### Phase 1: Core Infrastructure (Week 1)

1. Set up Nest.js project structure
2. Configure Prisma with 57-column schema
3. Set up Redis connection
4. Create basic DTOs and types
5. Implement access control constants

### Phase 2: WebSocket Foundation (Week 1-2)

1. Implement WebSocket Gateway
2. Add JWT authentication
3. Create room management
4. Add subscribe/unsubscribe handlers
5. Test with mock data

### Phase 3: Data Layer (Week 2)

1. Implement Data Service
2. Implement Cache Service
3. Add data transformation functions
4. Test with real database

### Phase 4: Real-Time Integration (Week 3)

1. Implement MT5 Listener Service
2. Connect to Flask WebSocket
3. Implement Indicator Fetcher Service
4. Add cron job for 5-minute updates
5. Test end-to-end data flow

### Phase 5: Testing & Optimization (Week 3-4)

1. Write unit tests (80% coverage)
2. Write integration tests
3. Performance testing
4. Load testing
5. Security audit

### Phase 6: Deployment (Week 4)

1. Configure Railway deployment
2. Set up environment variables
3. Configure health checks
4. Deploy to staging
5. Deploy to production

---

## ✅ Definition of Done

A task is complete when:

- [ ] Code is written and follows Nest.js best practices
- [ ] Unit tests pass with 80%+ coverage
- [ ] Integration tests pass
- [ ] Code is documented with JSDoc comments
- [ ] TypeScript types are properly defined
- [ ] Error handling is implemented
- [ ] Performance is optimized
- [ ] Security is verified
- [ ] Code is reviewed
- [ ] Deployed to staging successfully

---

## 🚨 Common Pitfalls to Avoid

1. **Not filtering NULL values for sparse indicators** → Large payloads
2. **Not using Redis cache** → Slow database queries
3. **Not implementing room-based broadcasting** → Broadcasting to all clients
4. **Not handling WebSocket reconnection** → Lost connections
5. **Not validating JWT on every WebSocket connection** → Security risk
6. **Not implementing proper error handling** → Crashes
7. **Not using TypeScript strictly** → Runtime errors
8. **Not testing with real data** → Production issues

---

## 📚 Key References

1. **Architecture Document:** Attached separately (NESTJS_API_ARCHITECTURE.md)
2. **Nest.js Documentation:** https://docs.nestjs.com
3. **Socket.io Documentation:** https://socket.io/docs
4. **Prisma Documentation:** https://www.prisma.io/docs
5. **TimescaleDB Documentation:** https://docs.timescale.com
6. **TradingView Charts API:** https://tradingview.github.io/lightweight-charts

---

## 🎯 Success Criteria

**Technical Metrics:**

- WebSocket latency: <100ms ✅
- Database query time: <200ms ✅
- Cache hit ratio: >95% ✅
- Test coverage: >80% ✅
- Uptime: 99.9% ✅

**Functional Requirements:**

- OHLCV updates broadcast every 30 seconds ✅
- Indicator updates broadcast every 5 minutes ✅
- FREE plan receives 24 columns ✅
- PRO plan receives 57 columns ✅
- WebSocket reconnection works ✅
- Authentication is secure ✅

---

## 💡 Additional Notes

- Use **TypeScript strict mode** for type safety
- Follow **Nest.js conventions** (modules, services, controllers)
- Use **dependency injection** for all services
- Implement **proper logging** with Winston or similar
- Add **health check endpoints** for monitoring
- Use **environment variables** for all configuration
- Implement **graceful shutdown** for WebSocket connections
- Add **rate limiting** to prevent abuse
- Use **compression** for WebSocket messages
- Implement **message queue** if scaling beyond single instance

---

## 📋 Checklist Before Starting

Before you begin implementation, ensure you have:

- [ ] Read the complete architecture document
- [ ] Understood the data flow (Green + Magenta arrows)
- [ ] Understood FREE vs PRO access control (24 vs 57 columns)
- [ ] Set up development environment (Node.js, PostgreSQL, Redis)
- [ ] Created TimescaleDB database with 57-column schema
- [ ] Have access to MT5 Flask WebSocket URL
- [ ] Have valid JWT secret for authentication
- [ ] Understood TradingView Lightweight Charts data format

---

## 🚀 Ready to Start!

You now have everything you need to implement this Nest.js API. Follow the step-by-step guide, refer to the architecture document for details, and don't hesitate to ask questions.

**Start with Phase 1 (Core Infrastructure) and work your way through each phase systematically.**

Good luck! 🎉

---

**Prompt Version:** 1.0  
**Last Updated:** January 15, 2026  
**Status:** Ready for Claude Code Implementation ✅
