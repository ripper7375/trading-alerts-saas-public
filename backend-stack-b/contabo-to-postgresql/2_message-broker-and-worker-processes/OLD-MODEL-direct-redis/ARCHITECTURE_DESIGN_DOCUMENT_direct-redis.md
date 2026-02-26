# Trading Alerts SaaS - Complete Architecture Design Document

## Executive Summary

This document defines the production architecture for a real-time trading data collection, processing, and analysis system. The system collects market data from 15 symbols across 9 timeframes (135 data streams), processes it through a message queue architecture, stores it in a time-series database, and provides real-time confluence score calculations for trade setup recommendations.

**Technology Stack:**

- Data Collection: MT5 + MQL5 EA v2.24
- Message Broker: Upstash Redis (HTTP REST API)
- Backend Services: NestJS (Node.js)
- Queue Processing: Bull Queue
- Database: Railway PostgreSQL (staging) / Timescale Cloud (production)
- Frontend: Next.js + TradingView Lightweight Charts
- Deployment: Railway (staging), Distributed services (production)

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Component Architecture](#component-architecture)
3. [Communication Layer (1, 3, 5)](#communication-layer)
4. [Backend Services (2, 4, 6)](#backend-services)
5. [Data Flow & Processing](#data-flow--processing)
6. [Database Schema](#database-schema)
7. [API Specifications](#api-specifications)
8. [Error Handling & Recovery](#error-handling--recovery)
9. [Monitoring & Observability](#monitoring--observability)
10. [Security & Authentication](#security--authentication)
11. [Scaling Strategy](#scaling-strategy)
12. [Deployment Architecture](#deployment-architecture)

---

## 1. System Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ DATA COLLECTION LAYER (Contabo VPS)                             │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 5 MT5 Terminals × v2.24 EA (3 symbols each = 15 total)     │ │
│ │ - Collects 57 columns per bar                               │ │
│ │ - 9 timeframes per symbol                                   │ │
│ │ - Redis primary + SQLite fallback                           │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                          ↓ (1) HTTP POST                         │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ MESSAGE BROKER LAYER                                             │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ (2) Upstash Redis (Global Edge Network)                    │ │
│ │ - Bull Queue: "market-data-sync"                            │ │
│ │ - Receives 99.9% real-time + 0.1% backfill                  │ │
│ │ - Rate limiting, persistence, monitoring                    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                          ↓ (3) Bull Queue Consumer               │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ PROCESSING LAYER (Railway Workers)                               │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ (4) NestJS Bull Queue Workers (5-10 instances)              │ │
│ │ - Consume market data jobs                                  │ │
│ │ - Validate & transform data                                 │ │
│ │ - Batch insert to database (50-100 rows)                    │ │
│ │ - Error handling & retry logic                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                          ↓ (5) SQL INSERT                        │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ DATA LAYER (Railway PostgreSQL / Timescale)                     │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ (6) PostgreSQL / TimescaleDB                                │ │
│ │ - 15 hypertables (1 per symbol)                             │ │
│ │ - Time-series optimization                                  │ │
│ │ - 90,000 rows max per table (10k × 9 timeframes)            │ │
│ │ - Confluence score pre-computation                          │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                          ↓ Query                                 │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ APPLICATION LAYER                                                │
│ ┌──────────────────────┐  ┌──────────────────────────────────┐ │
│ │ Next.js Frontend     │  │ Confluence Calculation Engine    │ │
│ │ - TradingView Charts │  │ - Python Pandas (deep calc)      │ │
│ │ - Real-time updates  │  │ - Pre-computation jobs           │ │
│ └──────────────────────┘  └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow Summary

```
Bar closes → MT5 EA → Redis Publish → Bull Queue → Worker → PostgreSQL → Frontend
             (1)      (2)           (3)          (4)        (5)        (6)
```

### 1.3 System Characteristics

| Metric              | Value                                      |
| ------------------- | ------------------------------------------ |
| Data Sources        | 15 symbols × 9 timeframes = 135 streams    |
| Data Points         | 57 columns per bar                         |
| Ingestion Rate      | ~500 bars/hour (~8-10/minute)              |
| Peak Rate           | ~20 bars/minute (when timeframes align)    |
| Data Volume         | ~1.35M rows (15 symbols × 10k bars × 9 TF) |
| Latency Target      | <1 second (bar close → database)           |
| Availability Target | 99.9% uptime                               |
| Recovery Time       | <5 minutes (via SQLite backfill)           |

---

## 2. Component Architecture

### 2.1 System Components Map

| #       | Component        | Type          | Technology                 | Purpose                |
| ------- | ---------------- | ------------- | -------------------------- | ---------------------- |
| **(1)** | MT5 → Redis      | Communication | HTTP REST                  | Data ingestion         |
| **(2)** | Redis Service    | Backend       | Upstash Redis + NestJS API | Message broker         |
| **(3)** | Redis → Workers  | Communication | Bull Queue                 | Job distribution       |
| **(4)** | Worker Service   | Backend       | NestJS + Bull              | Data processing        |
| **(5)** | Worker → DB      | Communication | TypeORM / Prisma           | Data persistence       |
| **(6)** | Database Service | Backend       | PostgreSQL + NestJS API    | Data storage & queries |

---

## 3. Communication Layer

### 3.1 Component (1): MT5 EA → Upstash Redis

**Protocol:** HTTP REST API  
**Method:** POST  
**Endpoint:** `https://{redis-host}.upstash.io/lpush/{queue-name}`  
**Authentication:** Bearer token in header

#### Request Specification

**Headers:**

```http
POST /lpush/market-data-sync HTTP/1.1
Host: your-redis.upstash.io
Authorization: Bearer {UPSTASH_TOKEN}
Content-Type: application/json
```

**Payload Structure:**

```json
{
  "symbol": "btcusd",
  "timeframe": "PERIOD_M5",
  "timestamp": 1705324800,
  "open": 43250.5,
  "high": 43280.0,
  "low": 43240.0,
  "close": 43265.75,
  "volume": 1250,
  "tema": 43260.25,
  "hrma": 43258.5,
  "smma": 43262.1,
  "zscore": 1.25,
  "classification": 1,
  "diag_asc_line_1": 43200.0,
  "diag_asc_line_2": 43210.0,
  "diag_asc_line_3": null,
  "diag_desc_line_1": null,
  "diag_desc_line_2": null,
  "diag_desc_line_3": null,
  "diag_high_map": 43300.0,
  "diag_low_map": 43180.0,
  "horiz_peak_line_1": 43320.0,
  "horiz_peak_line_2": null,
  "horiz_peak_line_3": null,
  "horiz_bottom_line_1": 43150.0,
  "horiz_bottom_line_2": null,
  "horiz_bottom_line_3": null,
  "horiz_high_map": 43330.0,
  "horiz_low_map": 43140.0,
  "ha_open": 43248.5,
  "ha_high": 43282.0,
  "ha_low": 43238.0,
  "ha_close": 43267.25,
  "ha_classification": 1,
  "ha_body_size": 18.75,
  "ha_body_zscore": 0.85,
  "kc_ultra_extreme_upper": 43450.0,
  "kc_extreme_upper": 43400.0,
  "kc_uppermost": 43350.0,
  "kc_upper": 43300.0,
  "kc_upper_middle": 43275.0,
  "kc_lower_middle": 43250.0,
  "kc_lower": 43225.0,
  "kc_lowermost": 43175.0,
  "kc_extreme_lower": 43125.0,
  "kc_ultra_extreme_lower": 43075.0,
  "sr_support_4": 43100.0,
  "sr_support_3": 43150.0,
  "sr_support_2": 43200.0,
  "sr_support_1": 43225.0,
  "sr_resistance_1": 43300.0,
  "sr_resistance_2": 43350.0,
  "sr_resistance_3": 43400.0,
  "sr_resistance_4": 43450.0,
  "zigzag_peak": 43320.0,
  "zigzag_bottom": 43140.0,
  "ema_26": 43255.8,
  "collected_at": 1705324805
}
```

**Response:**

```json
{
  "result": 1
}
```

#### Error Handling

| Error Code | Scenario      | MT5 Action               |
| ---------- | ------------- | ------------------------ |
| 200        | Success       | Continue                 |
| 401        | Auth failed   | Log + SQLite backup      |
| 429        | Rate limit    | SQLite backup + backfill |
| 500        | Server error  | SQLite backup + backfill |
| Timeout    | Network issue | SQLite backup + backfill |

**Retry Logic:** None (fail fast, fallback to SQLite)

---

### 3.2 Component (3): Upstash Redis → NestJS Workers

**Protocol:** Bull Queue Consumer  
**Library:** `@nestjs/bull`, `bull`  
**Connection:** TCP (redis://) for workers (not HTTP)

#### Queue Configuration

**Queue Name:** `market-data-sync`

**Job Structure:**

```typescript
interface MarketDataJob {
  data: {
    symbol: string;
    timeframe: string;
    timestamp: number;
    // ... all 57 columns
  };
  opts: {
    jobId: string; // `${symbol}_${timeframe}_${timestamp}`
    removeOnComplete: 1000; // Keep last 1000 completed
    removeOnFail: 5000; // Keep last 5000 failed
    attempts: 3;
    backoff: {
      type: 'exponential';
      delay: 2000; // 2s, 4s, 8s
    };
  };
}
```

**Worker Configuration:**

```typescript
{
  concurrency: 5, // Process 5 jobs simultaneously
  limiter: {
    max: 100, // Max 100 jobs
    duration: 1000, // Per second
  },
  settings: {
    stalledInterval: 30000, // 30s
    maxStalledCount: 2,
  }
}
```

---

### 3.3 Component (5): NestJS Workers → PostgreSQL

**Protocol:** SQL over TCP  
**Library:** TypeORM or Prisma  
**Connection Pool:** 10-20 connections

#### Batch Insert Strategy

**Approach:** Accumulate jobs, batch insert every 1 second or 50 jobs

```typescript
// Pseudo-code
const batchBuffer: MarketDataJob[] = [];
const BATCH_SIZE = 50;
const BATCH_TIMEOUT = 1000; // 1 second

// On job received
batchBuffer.push(job);

if (batchBuffer.length >= BATCH_SIZE) {
  await flushBatch();
}

// Also flush on timer
setInterval(() => {
  if (batchBuffer.length > 0) {
    await flushBatch();
  }
}, BATCH_TIMEOUT);
```

**SQL Operation:**

```sql
INSERT INTO btcusd (
  timestamp, timeframe, open, high, low, close, volume,
  tema, hrma, smma, -- ... all 57 columns
) VALUES
  ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, ...),
  ($11, $12, $13, $14, $15, $16, $17, $18, $19, $20, ...),
  -- ... up to 50 rows
ON CONFLICT (timestamp, timeframe)
DO UPDATE SET
  open = EXCLUDED.open,
  high = EXCLUDED.high,
  -- ... update all columns
```

**Transaction:** Yes (all-or-nothing)

---

## 4. Backend Services

### 4.1 Component (2): Upstash Redis + NestJS Gateway

**Purpose:** Provide monitoring, health checks, and management API for Redis

#### Service Responsibilities

1. **Health Check Endpoint**
   - Monitor Redis connection
   - Check queue lengths
   - Report worker status

2. **Queue Management API**
   - Get queue statistics
   - Pause/resume queue
   - Clear failed jobs
   - Retry failed jobs

3. **Monitoring Dashboard**
   - Bull Board integration
   - Real-time metrics

#### API Endpoints

```typescript
// Health check
GET /health
Response: {
  redis: "connected" | "disconnected",
  queueLength: number,
  workerCount: number,
  timestamp: string
}

// Queue statistics
GET /queue/stats
Response: {
  waiting: number,
  active: number,
  completed: number,
  failed: number,
  delayed: number
}

// Get failed jobs
GET /queue/failed?limit=100
Response: {
  jobs: FailedJob[]
}

// Retry failed job
POST /queue/retry/:jobId
Response: {
  success: boolean,
  message: string
}
```

#### NestJS Module Structure

```typescript
@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT),
        password: process.env.REDIS_PASSWORD,
        tls: {}, // Upstash requires TLS
      },
    }),
    BullModule.registerQueue({
      name: 'market-data-sync',
    }),
  ],
  controllers: [QueueController, HealthController],
  providers: [QueueService, MetricsService],
})
export class AppModule {}
```

---

### 4.2 Component (4): NestJS Worker Service

**Purpose:** Process market data jobs from queue and insert into database

#### Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Worker Service (NestJS)                                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Queue Processor (@Processor('market-data-sync'))     │  │
│  │                                                        │  │
│  │  @Process('market-data')                              │  │
│  │  async processMarketData(job: Job) {                  │  │
│  │    1. Validate job data                               │  │
│  │    2. Transform data (if needed)                      │  │
│  │    3. Add to batch buffer                             │  │
│  │    4. Flush batch (if threshold met)                  │  │
│  │  }                                                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Batch Service                                         │  │
│  │                                                        │  │
│  │  - Buffer management                                  │  │
│  │  - Batch flush logic                                  │  │
│  │  - Transaction handling                               │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Database Service (TypeORM / Prisma)                   │  │
│  │                                                        │  │
│  │  - Batch INSERT with ON CONFLICT                      │  │
│  │  - Connection pooling                                 │  │
│  │  - Query optimization                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Job Processing Flow

```typescript
@Processor('market-data-sync')
export class MarketDataProcessor {
  private batchBuffer: MarketDataJob[] = [];
  private readonly BATCH_SIZE = 50;

  constructor(
    private readonly batchService: BatchService,
    private readonly metricsService: MetricsService
  ) {
    // Flush buffer every second
    setInterval(() => this.flushIfNeeded(), 1000);
  }

  @Process()
  async processMarketData(job: Job<MarketDataPayload>) {
    const startTime = Date.now();

    try {
      // 1. Validate
      const validated = await this.validate(job.data);

      // 2. Transform
      const transformed = await this.transform(validated);

      // 3. Add to buffer
      this.batchBuffer.push(transformed);

      // 4. Flush if threshold met
      if (this.batchBuffer.length >= this.BATCH_SIZE) {
        await this.flushBatch();
      }

      // Metrics
      const duration = Date.now() - startTime;
      this.metricsService.recordJobProcessing(duration);

      return { success: true };
    } catch (error) {
      this.metricsService.recordJobFailure(error);
      throw error; // Let Bull handle retry
    }
  }

  private async flushBatch() {
    if (this.batchBuffer.length === 0) return;

    const batch = [...this.batchBuffer];
    this.batchBuffer = [];

    await this.batchService.insertBatch(batch);
    this.metricsService.recordBatchInsert(batch.length);
  }

  private async flushIfNeeded() {
    if (this.batchBuffer.length > 0) {
      await this.flushBatch();
    }
  }
}
```

#### Validation Rules

```typescript
interface ValidationRules {
  symbol: {
    type: 'string',
    pattern: /^[a-z]+$/,
    required: true
  },
  timeframe: {
    type: 'string',
    enum: ['PERIOD_M5', 'PERIOD_M15', 'PERIOD_M30', 'PERIOD_H1',
           'PERIOD_H2', 'PERIOD_H4', 'PERIOD_H8', 'PERIOD_H12', 'PERIOD_D1'],
    required: true
  },
  timestamp: {
    type: 'number',
    min: 1000000000, // After year 2001
    max: 2147483647, // 2038-01-19 (Unix timestamp limit)
    required: true
  },
  open: { type: 'number', min: 0, required: true },
  high: { type: 'number', min: 0, required: true },
  low: { type: 'number', min: 0, required: true },
  close: { type: 'number', min: 0, required: true },
  volume: { type: 'number', min: 0, required: true },
  // Indicators can be null
  tema: { type: 'number', nullable: true },
  // ... all other columns
}
```

#### Error Handling Strategy

| Error Type                    | Action                  | Retry?   |
| ----------------------------- | ----------------------- | -------- |
| Validation failed             | Log + Dead letter queue | No       |
| Database connection lost      | Retry                   | Yes (3x) |
| Database constraint violation | Log + Skip              | No       |
| Unknown error                 | Log + Retry             | Yes (3x) |

---

### 4.3 Component (6): PostgreSQL + NestJS API Service

**Purpose:** Provide REST API for querying market data and confluence scores

#### Service Responsibilities

1. **Market Data API**
   - Query bars by symbol, timeframe, date range
   - Get latest bars
   - Historical data retrieval

2. **Confluence Score API**
   - Get pre-computed confluence scores
   - Real-time score calculation (if needed)
   - Trade setup recommendations

3. **Health & Metrics**
   - Database health check
   - Table statistics
   - Query performance metrics

#### API Endpoints

**Market Data Endpoints:**

```typescript
// Get latest bars
GET /api/market-data/:symbol/:timeframe/latest?limit=100
Response: {
  symbol: "btcusd",
  timeframe: "PERIOD_H1",
  bars: Bar[]
}

// Get bars by date range
GET /api/market-data/:symbol/:timeframe?from=1705324800&to=1705411200
Response: {
  symbol: "btcusd",
  timeframe: "PERIOD_H1",
  bars: Bar[],
  count: number
}

// Get multiple timeframes
POST /api/market-data/multi
Body: {
  symbols: ["btcusd", "ethusd"],
  timeframes: ["PERIOD_M5", "PERIOD_H1"],
  limit: 100
}
Response: {
  btcusd: {
    PERIOD_M5: Bar[],
    PERIOD_H1: Bar[]
  },
  ethusd: {
    PERIOD_M5: Bar[],
    PERIOD_H1: Bar[]
  }
}
```

**Confluence Score Endpoints:**

```typescript
// Get confluence scores
GET /api/confluence/:symbol?timeframe=PERIOD_H1&limit=100
Response: {
  symbol: "btcusd",
  timeframe: "PERIOD_H1",
  scores: ConfluenceScore[]
}

// Get trade setups
GET /api/trade-setups?minConfidence=70
Response: {
  setups: TradeSetup[]
}
```

#### Database Query Optimization

**Indexes:**

```sql
-- Primary key (already indexed)
PRIMARY KEY (timestamp, timeframe)

-- Additional indexes
CREATE INDEX idx_symbol_timeframe_timestamp
ON market_data (symbol, timeframe, timestamp DESC);

CREATE INDEX idx_timestamp_desc
ON market_data (timestamp DESC);

-- Partial index for recent data (hot path)
CREATE INDEX idx_recent_bars
ON market_data (timestamp DESC)
WHERE timestamp > (EXTRACT(EPOCH FROM NOW()) - 86400);
```

**Query Patterns:**

```typescript
// Optimized query for latest bars
const latestBars = await repository
  .createQueryBuilder('bar')
  .where('bar.timeframe = :timeframe', { timeframe })
  .orderBy('bar.timestamp', 'DESC')
  .limit(limit)
  .getMany();

// Optimized query with date range
const rangeQuery = await repository
  .createQueryBuilder('bar')
  .where('bar.timeframe = :timeframe', { timeframe })
  .andWhere('bar.timestamp BETWEEN :from AND :to', { from, to })
  .orderBy('bar.timestamp', 'ASC')
  .getMany();
```

---

## 5. Data Flow & Processing

### 5.1 Normal Operation Flow

```
Step 1: Bar Closes
├─ Time: 17:05:00 (M5 bar)
├─ MT5: Collects 57 indicator columns
└─ Duration: <100ms

Step 2: Publish to Redis
├─ MT5: HTTP POST to Upstash
├─ Payload: JSON (57 columns)
├─ Duration: ~10ms
└─ Success Rate: 99.9%

Step 3: Queue Job
├─ Upstash: Adds to Bull Queue
├─ Job ID: btcusd_PERIOD_M5_1705324800
├─ Persistence: Yes
└─ Duration: <1ms

Step 4: Worker Consumes
├─ Worker: Picks up job
├─ Validation: Check data integrity
├─ Buffer: Add to batch
└─ Duration: ~5ms

Step 5: Batch Insert
├─ Condition: 50 jobs OR 1 second
├─ Database: INSERT ON CONFLICT
├─ Transaction: Yes
└─ Duration: ~50ms (50 rows)

Step 6: Available to API
├─ Total Latency: ~165ms
├─ Data: Queryable via API
└─ Frontend: Can fetch latest
```

**Total End-to-End Latency:** <200ms (bar close → queryable)

### 5.2 Failure & Recovery Flow

```
Scenario: Redis Publish Fails

Step 1: Bar Closes
├─ MT5: Collects data
└─ Try Redis publish

Step 2: Redis Failure
├─ Error: Network timeout / 500
├─ Fallback: Write to SQLite
├─ Mark: backfill_queue.csv
└─ Duration: ~5ms (local write)

Step 3: Python Backfill Worker (runs every 5 min)
├─ Check: SQLite databases
├─ Found: 1 bar in btcusd.db
├─ Publish: To Redis via REST API
└─ Delete: From SQLite after success

Step 4: Normal Flow Resumes
├─ Queue: Job added (recovered data)
├─ Worker: Processes normally
└─ Database: Inserted

Recovery Time: <5 minutes
Data Loss: Zero
```

### 5.3 Peak Load Handling

```
Scenario: Multiple Timeframes Align

17:00:00 Event:
├─ M5 bars: 15 symbols
├─ M15 bars: 15 symbols
├─ M30 bars: 15 symbols
├─ H1 bars: 15 symbols
└─ Total: 60 bars simultaneously

System Response:
├─ MT5: Publishes 60 jobs in <1 second
├─ Redis: Queues all 60 jobs
├─ Workers: Process 5 concurrently
├─ Batch: Accumulates 50, inserts
├─ Batch: Remaining 10 inserted next batch
└─ Total Processing: <3 seconds

Queue Backlog:
├─ Normal: 0-5 jobs waiting
├─ Peak: 20-50 jobs waiting
└─ Recovery: <1 minute
```

---

## 6. Database Schema

### 6.1 Market Data Table (Per Symbol)

**Table Naming:** One table per symbol (e.g., `btcusd`, `ethusd`, `xauusd`)

**Schema:**

```sql
CREATE TABLE btcusd (
  -- Primary Key
  timestamp INTEGER NOT NULL,
  timeframe TEXT NOT NULL,

  -- OHLCV
  open REAL NOT NULL,
  high REAL NOT NULL,
  low REAL NOT NULL,
  close REAL NOT NULL,
  volume INTEGER NOT NULL,

  -- TEMA/HRMA/SMMA (3 columns)
  tema REAL,
  hrma REAL,
  smma REAL,

  -- Body Momentum (2 columns)
  zscore REAL,
  classification INTEGER,

  -- Fractal Diagonal (8 columns)
  diag_asc_line_1 REAL,
  diag_asc_line_2 REAL,
  diag_asc_line_3 REAL,
  diag_desc_line_1 REAL,
  diag_desc_line_2 REAL,
  diag_desc_line_3 REAL,
  diag_high_map REAL,
  diag_low_map REAL,

  -- Fractal Horizontal (8 columns)
  horiz_peak_line_1 REAL,
  horiz_peak_line_2 REAL,
  horiz_peak_line_3 REAL,
  horiz_bottom_line_1 REAL,
  horiz_bottom_line_2 REAL,
  horiz_bottom_line_3 REAL,
  horiz_high_map REAL,
  horiz_low_map REAL,

  -- Heiken Ashi (7 columns)
  ha_open REAL,
  ha_high REAL,
  ha_low REAL,
  ha_close REAL,
  ha_classification INTEGER,
  ha_body_size REAL,
  ha_body_zscore REAL,

  -- Keltner Channels (10 columns)
  kc_ultra_extreme_upper REAL,
  kc_extreme_upper REAL,
  kc_uppermost REAL,
  kc_upper REAL,
  kc_upper_middle REAL,
  kc_lower_middle REAL,
  kc_lower REAL,
  kc_lowermost REAL,
  kc_extreme_lower REAL,
  kc_ultra_extreme_lower REAL,

  -- Support/Resistance (8 columns)
  sr_support_4 REAL,
  sr_support_3 REAL,
  sr_support_2 REAL,
  sr_support_1 REAL,
  sr_resistance_1 REAL,
  sr_resistance_2 REAL,
  sr_resistance_3 REAL,
  sr_resistance_4 REAL,

  -- ZigZag (3 columns)
  zigzag_peak REAL,
  zigzag_bottom REAL,
  ema_26 REAL,

  -- Metadata
  collected_at INTEGER,

  -- Constraints
  PRIMARY KEY (timestamp, timeframe)
);

-- Indexes
CREATE INDEX idx_btcusd_timeframe_timestamp
ON btcusd (timeframe, timestamp DESC);

CREATE INDEX idx_btcusd_recent
ON btcusd (timestamp DESC)
WHERE timestamp > (EXTRACT(EPOCH FROM NOW()) - 86400);
```

**Total Columns:** 57  
**Storage per row:** ~1 KB  
**Max rows per table:** 90,000 (10k bars × 9 timeframes)  
**Total database size:** ~1.35 GB (15 symbols × 90k rows × 1 KB)

### 6.2 Confluence Scores Table

**Purpose:** Pre-computed confluence scores for trade setups

```sql
CREATE TABLE confluence_scores (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  timestamp INTEGER NOT NULL,

  -- Confluence indicators
  trend_alignment REAL, -- 0-100
  support_resistance_confluence REAL, -- 0-100
  indicator_agreement REAL, -- 0-100
  volatility_score REAL, -- 0-100

  -- Overall score
  confluence_score REAL NOT NULL, -- 0-100
  confidence_level TEXT, -- 'low', 'medium', 'high'

  -- Trade recommendation
  signal TEXT, -- 'buy', 'sell', 'neutral'
  entry_price REAL,
  stop_loss REAL,
  take_profit REAL,
  risk_reward_ratio REAL,

  -- Metadata
  calculated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (symbol, timeframe, timestamp)
);

-- Indexes
CREATE INDEX idx_confluence_symbol_timeframe
ON confluence_scores (symbol, timeframe, timestamp DESC);

CREATE INDEX idx_confluence_score
ON confluence_scores (confluence_score DESC);

CREATE INDEX idx_confluence_signal
ON confluence_scores (signal, confluence_score DESC);
```

### 6.3 Job Metadata Table

**Purpose:** Track job processing for monitoring

```sql
CREATE TABLE job_metadata (
  id SERIAL PRIMARY KEY,
  job_id TEXT NOT NULL UNIQUE,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  timestamp INTEGER NOT NULL,

  -- Processing
  status TEXT NOT NULL, -- 'pending', 'processing', 'completed', 'failed'
  attempts INTEGER DEFAULT 0,

  -- Timing
  queued_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER,

  -- Error tracking
  error_message TEXT,
  error_stack TEXT,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_job_status ON job_metadata (status);
CREATE INDEX idx_job_created ON job_metadata (created_at DESC);
```

---

## 7. API Specifications

### 7.1 REST API Endpoints

**Base URL:** `https://api.trading-alerts.com` (production)

#### Authentication

```http
Authorization: Bearer {JWT_TOKEN}
```

#### Market Data API

**1. Get Latest Bars**

```http
GET /api/v1/market-data/{symbol}/{timeframe}/latest?limit=100

Response 200:
{
  "symbol": "btcusd",
  "timeframe": "PERIOD_H1",
  "count": 100,
  "bars": [
    {
      "timestamp": 1705324800,
      "open": 43250.50,
      "high": 43280.00,
      "low": 43240.00,
      "close": 43265.75,
      "volume": 1250,
      "tema": 43260.25,
      // ... all 57 columns
    }
  ]
}
```

**2. Get Bars by Date Range**

```http
GET /api/v1/market-data/{symbol}/{timeframe}?from=1705324800&to=1705411200

Response 200:
{
  "symbol": "btcusd",
  "timeframe": "PERIOD_H1",
  "from": 1705324800,
  "to": 1705411200,
  "count": 24,
  "bars": Bar[]
}
```

**3. Bulk Query (Multiple Symbols/Timeframes)**

```http
POST /api/v1/market-data/bulk

Body:
{
  "queries": [
    { "symbol": "btcusd", "timeframe": "PERIOD_H1", "limit": 100 },
    { "symbol": "ethusd", "timeframe": "PERIOD_M15", "limit": 50 }
  ]
}

Response 200:
{
  "results": [
    {
      "symbol": "btcusd",
      "timeframe": "PERIOD_H1",
      "bars": Bar[]
    },
    {
      "symbol": "ethusd",
      "timeframe": "PERIOD_M15",
      "bars": Bar[]
    }
  ]
}
```

#### Confluence Score API

**4. Get Confluence Scores**

```http
GET /api/v1/confluence/{symbol}?timeframe=PERIOD_H1&limit=100

Response 200:
{
  "symbol": "btcusd",
  "timeframe": "PERIOD_H1",
  "scores": [
    {
      "timestamp": 1705324800,
      "confluence_score": 78.5,
      "confidence_level": "high",
      "signal": "buy",
      "entry_price": 43265.75,
      "stop_loss": 43150.00,
      "take_profit": 43450.00,
      "risk_reward_ratio": 2.5
    }
  ]
}
```

**5. Get Trade Setups**

```http
GET /api/v1/trade-setups?minConfidence=70&signal=buy

Response 200:
{
  "setups": [
    {
      "symbol": "btcusd",
      "timeframe": "PERIOD_H1",
      "timestamp": 1705324800,
      "confluence_score": 85.2,
      "signal": "buy",
      "entry_price": 43265.75,
      "stop_loss": 43150.00,
      "take_profit": 43450.00,
      "risk_reward_ratio": 2.8,
      "confidence_level": "high"
    }
  ]
}
```

#### Health & Monitoring API

**6. Health Check**

```http
GET /api/v1/health

Response 200:
{
  "status": "healthy",
  "timestamp": "2026-01-15T14:30:00Z",
  "services": {
    "database": "connected",
    "redis": "connected",
    "workers": "running"
  },
  "metrics": {
    "queueLength": 5,
    "activeWorkers": 5,
    "lastJobProcessed": "2026-01-15T14:29:58Z"
  }
}
```

**7. Queue Statistics**

```http
GET /api/v1/queue/stats

Response 200:
{
  "queue": "market-data-sync",
  "waiting": 3,
  "active": 5,
  "completed": 8543,
  "failed": 12,
  "delayed": 0,
  "paused": false,
  "timestamp": "2026-01-15T14:30:00Z"
}
```

### 7.2 WebSocket API (Real-time Updates)

**Purpose:** Stream real-time bar updates to frontend

**Endpoint:** `wss://api.trading-alerts.com/ws`

**Protocol:**

```typescript
// Client connects
ws.send(JSON.stringify({
  type: 'subscribe',
  channels: [
    { symbol: 'btcusd', timeframe: 'PERIOD_H1' },
    { symbol: 'ethusd', timeframe: 'PERIOD_M15' }
  ]
}));

// Server sends updates
{
  type: 'bar_update',
  data: {
    symbol: 'btcusd',
    timeframe: 'PERIOD_H1',
    bar: {
      timestamp: 1705324800,
      open: 43250.50,
      // ... all columns
    }
  }
}
```

---

## 8. Error Handling & Recovery

### 8.1 Error Classification

| Category      | Examples                            | Strategy                    |
| ------------- | ----------------------------------- | --------------------------- |
| **Transient** | Network timeout, DB connection lost | Retry with backoff          |
| **Permanent** | Validation failed, invalid data     | Dead letter queue           |
| **Systemic**  | Redis down, DB full                 | Alert + manual intervention |

### 8.2 Retry Strategy

**Bull Queue Retry Configuration:**

```typescript
{
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000, // 2s → 4s → 8s
  },
}
```

**Custom Retry Logic:**

```typescript
async processWithRetry(job: Job, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await this.process(job);
    } catch (error) {
      if (attempt === maxRetries) {
        // Final attempt failed
        await this.sendToDeadLetterQueue(job, error);
        throw error;
      }

      // Transient error, retry
      const delay = Math.pow(2, attempt) * 1000;
      await sleep(delay);
    }
  }
}
```

### 8.3 Dead Letter Queue

**Purpose:** Store permanently failed jobs for manual review

```typescript
@OnQueueFailed()
async handleFailedJob(job: Job, error: Error) {
  // After all retries exhausted
  if (job.attemptsMade >= job.opts.attempts) {
    await this.deadLetterService.store({
      jobId: job.id,
      data: job.data,
      error: error.message,
      stack: error.stack,
      failedAt: new Date(),
    });

    await this.alertService.notify({
      severity: 'high',
      message: `Job ${job.id} moved to dead letter queue`,
      jobData: job.data,
    });
  }
}
```

### 8.4 Circuit Breaker Pattern

**Purpose:** Prevent cascading failures

```typescript
class CircuitBreaker {
  private failureCount = 0;
  private readonly threshold = 5;
  private readonly timeout = 60000; // 1 minute
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      throw new Error('Circuit breaker is OPEN');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    if (this.state === 'half-open') {
      this.state = 'closed';
    }
  }

  private onFailure() {
    this.failureCount++;

    if (this.failureCount >= this.threshold) {
      this.state = 'open';
      setTimeout(() => {
        this.state = 'half-open';
        this.failureCount = 0;
      }, this.timeout);
    }
  }
}
```

---

## 9. Monitoring & Observability

### 9.1 Metrics Collection

**Key Metrics:**

```typescript
interface SystemMetrics {
  // Ingestion
  barsReceived: Counter;
  barsProcessed: Counter;
  barsFailed: Counter;
  ingestionLatency: Histogram; // ms

  // Queue
  queueLength: Gauge;
  jobsWaiting: Gauge;
  jobsActive: Gauge;
  jobsCompleted: Counter;
  jobsFailed: Counter;
  jobDuration: Histogram; // ms

  // Database
  batchInserts: Counter;
  batchSize: Histogram;
  queryDuration: Histogram; // ms
  connectionPoolUsage: Gauge;

  // Workers
  activeWorkers: Gauge;
  workerCPU: Gauge; // %
  workerMemory: Gauge; // MB
}
```

**Implementation (Prometheus):**

```typescript
import { Counter, Gauge, Histogram, register } from 'prom-client';

export class MetricsService {
  private readonly barsReceived = new Counter({
    name: 'bars_received_total',
    help: 'Total bars received from MT5',
    labelNames: ['symbol', 'timeframe'],
  });

  private readonly jobDuration = new Histogram({
    name: 'job_duration_seconds',
    help: 'Job processing duration',
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  });

  recordBarReceived(symbol: string, timeframe: string) {
    this.barsReceived.inc({ symbol, timeframe });
  }

  recordJobDuration(duration: number) {
    this.jobDuration.observe(duration / 1000);
  }

  getMetrics() {
    return register.metrics();
  }
}
```

### 9.2 Logging Strategy

**Log Levels:**

```typescript
enum LogLevel {
  ERROR = 'error', // Failures requiring attention
  WARN = 'warn', // Potential issues
  INFO = 'info', // Normal operations
  DEBUG = 'debug', // Detailed debugging
}
```

**Log Format (JSON):**

```json
{
  "timestamp": "2026-01-15T14:30:00.123Z",
  "level": "info",
  "service": "worker",
  "message": "Batch inserted successfully",
  "context": {
    "batchSize": 50,
    "symbols": ["btcusd", "ethusd"],
    "duration": 45
  },
  "trace_id": "abc123def456"
}
```

**Implementation:**

```typescript
import { Logger } from '@nestjs/common';

export class JobLogger {
  private readonly logger = new Logger('JobProcessor');

  logJobStart(job: Job) {
    this.logger.log({
      message: 'Job started',
      jobId: job.id,
      data: job.data,
    });
  }

  logJobComplete(job: Job, duration: number) {
    this.logger.log({
      message: 'Job completed',
      jobId: job.id,
      duration,
    });
  }

  logJobFailed(job: Job, error: Error) {
    this.logger.error({
      message: 'Job failed',
      jobId: job.id,
      error: error.message,
      stack: error.stack,
    });
  }
}
```

### 9.3 Alert Configuration

**Alert Rules:**

```yaml
alerts:
  - name: HighQueueLength
    condition: queue_length > 1000
    duration: 5m
    severity: warning
    message: 'Queue backing up: {{ $value }} jobs'

  - name: HighFailureRate
    condition: rate(jobs_failed_total[5m]) > 10
    duration: 2m
    severity: critical
    message: 'High job failure rate: {{ $value }}/min'

  - name: WorkerDown
    condition: active_workers == 0
    duration: 1m
    severity: critical
    message: 'No active workers detected'

  - name: DatabaseConnectionLost
    condition: database_connected == 0
    duration: 30s
    severity: critical
    message: 'Database connection lost'
```

### 9.4 Dashboard (Grafana)

**Key Panels:**

1. **Ingestion Rate**
   - Bars received per minute
   - Breakdown by symbol/timeframe

2. **Queue Health**
   - Queue length over time
   - Job processing rate
   - Success vs failure rate

3. **Worker Performance**
   - Active workers
   - CPU and memory usage
   - Job duration percentiles (p50, p95, p99)

4. **Database Metrics**
   - Connection pool usage
   - Query duration
   - Batch insert size

5. **Error Rate**
   - Failed jobs per minute
   - Error breakdown by type

---

## 10. Security & Authentication

### 10.1 API Authentication

**Method:** JWT (JSON Web Tokens)

**Token Structure:**

```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "role": "premium",
  "iat": 1705324800,
  "exp": 1705411200
}
```

**Implementation:**

```typescript
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}

// Usage
@Controller('api/v1/market-data')
@UseGuards(JwtAuthGuard)
export class MarketDataController {
  // Protected endpoints
}
```

### 10.2 Rate Limiting

**Strategy:** Token bucket algorithm

```typescript
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly limits = {
    free: 100, // 100 requests per minute
    premium: 1000, // 1000 requests per minute
    enterprise: Infinity,
  };

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const limit = this.limits[user.role];
    const consumed = await this.redisService.incr(
      `rate_limit:${user.id}:${Date.now() / 60000}`
    );

    if (consumed > limit) {
      throw new HttpException('Rate limit exceeded', 429);
    }

    return true;
  }
}
```

### 10.3 Data Encryption

**At Rest:** Database encryption enabled

```sql
-- PostgreSQL
ALTER DATABASE trading_alerts SET encryption = 'on';
```

**In Transit:** TLS/SSL for all connections

```typescript
// Redis connection with TLS
{
  host: process.env.REDIS_HOST,
  port: 6379,
  password: process.env.REDIS_PASSWORD,
  tls: {
    rejectUnauthorized: true,
  },
}

// PostgreSQL connection with SSL
{
  host: process.env.DB_HOST,
  port: 5432,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('./ca-certificate.crt'),
  },
}
```

### 10.4 Environment Variables

**Required Secrets:**

```bash
# Redis
REDIS_HOST=your-redis.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=secret_token

# Database
DB_HOST=db.railway.app
DB_PORT=5432
DB_NAME=trading_alerts
DB_USER=postgres
DB_PASSWORD=secret_password

# JWT
JWT_SECRET=secret_key
JWT_EXPIRES_IN=24h

# API
API_KEY=secret_api_key
```

**Storage:** Use environment variable management (Railway Secrets, AWS Secrets Manager, etc.)

---

## 11. Scaling Strategy

### 11.1 Horizontal Scaling

**Worker Scaling:**

```yaml
# Railway deployment
services:
  worker:
    build: .
    command: npm run start:worker
    scale: 5 # Start with 5 instances
    autoscaling:
      min: 5
      max: 20
      targetCPU: 70% # Scale up at 70% CPU
      targetQueue: 100 # Scale up if queue > 100
```

**Scaling Triggers:**

| Metric       | Threshold | Action                |
| ------------ | --------- | --------------------- |
| Queue Length | >100      | Add 1 worker          |
| Queue Length | >500      | Add 3 workers         |
| CPU Usage    | >70%      | Add 1 worker          |
| Worker Count | >15       | Alert (review system) |

### 11.2 Database Scaling

**Vertical Scaling (Initial):**

```
Staging: 2 GB RAM, 1 CPU
├─ Handles: 15 symbols, 1.35M rows
└─ Cost: ~$15/month

Production: 8 GB RAM, 4 CPU
├─ Handles: 75 symbols, 6.75M rows
└─ Cost: ~$100/month
```

**Horizontal Scaling (Future):**

1. **Read Replicas**
   - Route queries to read replicas
   - Write to primary only

2. **Sharding by Symbol**
   - Database 1: BTCUSD, ETHUSD, XAUUSD, etc.
   - Database 2: EURUSD, GBPUSD, USDJPY, etc.

### 11.3 Caching Strategy

**Redis Cache (separate from queue):**

```typescript
@Injectable()
export class CacheService {
  private readonly ttl = {
    latestBars: 60, // 1 minute
    historicalBars: 3600, // 1 hour
    confluenceScores: 300, // 5 minutes
  };

  async getLatestBars(symbol: string, timeframe: string, limit: number) {
    const key = `latest:${symbol}:${timeframe}:${limit}`;

    // Try cache first
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }

    // Cache miss, query database
    const bars = await this.database.getLatestBars(symbol, timeframe, limit);

    // Store in cache
    await this.redis.setex(key, this.ttl.latestBars, JSON.stringify(bars));

    return bars;
  }
}
```

**Cache Invalidation:**

```typescript
// Invalidate on new bar inserted
async onBarInserted(symbol: string, timeframe: string) {
  const pattern = `latest:${symbol}:${timeframe}:*`;
  const keys = await this.redis.keys(pattern);

  if (keys.length > 0) {
    await this.redis.del(...keys);
  }
}
```

---

## 12. Deployment Architecture

### 12.1 Staging Environment

```
┌─────────────────────────────────────────────────────────┐
│ STAGING (Railway)                                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Service 1: API Gateway                                  │
│  ├─ Port: 3000                                          │
│  ├─ Instances: 1                                        │
│  └─ URL: https://api-staging.railway.app               │
│                                                          │
│  Service 2: Worker                                       │
│  ├─ Instances: 2                                        │
│  └─ Connects to: Upstash Redis (staging)               │
│                                                          │
│  Service 3: PostgreSQL                                   │
│  ├─ 2 GB RAM                                            │
│  └─ Volume: 10 GB                                       │
│                                                          │
│  Service 4: Bull Board (Monitoring)                      │
│  ├─ Port: 3001                                          │
│  └─ URL: https://monitoring-staging.railway.app        │
│                                                          │
└─────────────────────────────────────────────────────────┘

External Services:
├─ Upstash Redis (Staging): Free tier
└─ Contabo VPS: MT5 Terminals
```

### 12.2 Production Environment

```
┌─────────────────────────────────────────────────────────┐
│ PRODUCTION (Distributed)                                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Railway: Worker Services                                │
│  ├─ Workers: 5-10 instances                             │
│  ├─ Auto-scaling: Enabled                               │
│  └─ Connects to: Upstash Redis (production)            │
│                                                          │
│  Vercel: Next.js Frontend + API Routes                   │
│  ├─ Serverless functions                                │
│  ├─ Edge network                                        │
│  └─ Domain: https://app.trading-alerts.com             │
│                                                          │
│  Timescale Cloud: PostgreSQL                             │
│  ├─ 8 GB RAM, 4 CPU                                     │
│  ├─ Automatic backups                                   │
│  └─ Connection pooling                                  │
│                                                          │
│  Upstash Redis (Production): Paid tier                   │
│  ├─ Global replication                                  │
│  └─ High availability                                   │
│                                                          │
└─────────────────────────────────────────────────────────┘

Monitoring:
├─ Sentry: Error tracking
├─ Datadog / New Relic: APM
└─ PagerDuty: On-call alerts
```

### 12.3 CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main, staging]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npm test
      - run: npm run lint

  deploy-staging:
    needs: test
    if: github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to Railway (Staging)
        run: |
          railway up --service api-gateway --environment staging
          railway up --service worker --environment staging

  deploy-production:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to Railway (Production)
        run: |
          railway up --service worker --environment production
```

---

## 13. Testing Strategy

### 13.1 Unit Tests

**Coverage Target:** 80%

```typescript
describe('MarketDataProcessor', () => {
  it('should validate job data', async () => {
    const job = createMockJob({ symbol: 'invalid!' });
    await expect(processor.process(job)).rejects.toThrow();
  });

  it('should batch jobs correctly', async () => {
    const jobs = createMockJobs(50);
    await processor.processBatch(jobs);
    expect(batchService.insert).toHaveBeenCalledTimes(1);
  });
});
```

### 13.2 Integration Tests

```typescript
describe('End-to-End Flow', () => {
  it('should process bar from queue to database', async () => {
    // Add job to queue
    await queue.add('market-data', mockBarData);

    // Wait for processing
    await waitFor(() => queue.getActiveCount() === 0);

    // Verify in database
    const bar = await database.findBar(
      mockBarData.symbol,
      mockBarData.timestamp
    );
    expect(bar).toBeDefined();
  });
});
```

### 13.3 Load Tests

```javascript
// k6 load test script
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 100 }, // Ramp up
    { duration: '5m', target: 100 }, // Sustain
    { duration: '1m', target: 0 }, // Ramp down
  ],
};

export default function () {
  const response = http.post(
    'https://your-redis.upstash.io/lpush/market-data-sync',
    JSON.stringify(mockBarData),
    { headers: { Authorization: `Bearer ${__ENV.REDIS_TOKEN}` } }
  );

  check(response, {
    'status is 200': (r) => r.status === 200,
  });
}
```

---

## Appendix A: Glossary

| Term                 | Definition                                        |
| -------------------- | ------------------------------------------------- |
| **Bar**              | A single candlestick with OHLCV + indicator data  |
| **Timeframe**        | Period of bar (M5 = 5 minutes, H1 = 1 hour)       |
| **Bull Queue**       | Job queue library for Node.js backed by Redis     |
| **Confluence Score** | Combined signal strength from multiple indicators |
| **Circular Buffer**  | Fixed-size buffer that overwrites oldest data     |
| **Hypertable**       | TimescaleDB's time-series optimized table         |

---

## Appendix B: References

- [NestJS Documentation](https://docs.nestjs.com/)
- [Bull Queue](https://github.com/OptimalBits/bull)
- [Upstash Redis](https://upstash.com/docs/redis)
- [TimescaleDB](https://docs.timescale.com/)
- [Railway Deployment](https://docs.railway.app/)

---

## Document Version

- **Version:** 1.0
- **Date:** 2026-01-15
- **Author:** Trading Alerts SaaS Architecture Team
- **Status:** Production Ready

---

**END OF ARCHITECTURE DESIGN DOCUMENT**
