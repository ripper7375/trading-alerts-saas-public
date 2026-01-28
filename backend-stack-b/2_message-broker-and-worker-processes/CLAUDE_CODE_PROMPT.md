# Claude Code Implementation Prompt: Trading Alerts SaaS Backend Services

## Context

I'm building a **real-time trading data collection and analysis system** that collects market data from MT5 terminals, processes it through a message queue architecture, and stores it for trade setup recommendations.

I have already created:

1. ✅ **MT5 EA v2.24** - Data collection from 15 symbols × 9 timeframes
2. ✅ **Python Backfill Worker** - Recovery mechanism for Redis failures
3. ✅ **Architecture Design Document** - Complete system specification

**I need you to implement** the production-grade **NestJS backend services** (components 2, 4, and 6) that handle:

- Message broker management (Upstash Redis + Bull Queue)
- Worker processing (consume queue → batch insert to database)
- REST API (query market data + confluence scores)

---

## Attached Files

I'm uploading these files for your reference:

1. **`SimpleDataCollector_Modified_v2_24_PRODUCTION.mq5`** - MT5 EA that publishes data to Redis
2. **`backfill_worker.py`** - Python script that recovers from SQLite to Redis
3. **`ARCHITECTURE_DESIGN_DOCUMENT.md`** - Complete technical specification (READ THIS FIRST!)

---

## What You Need to Build

Please implement a **production-ready NestJS monorepo** with **3 main services**:

### Service 1: API Gateway (`apps/api-gateway`)

- REST API for querying market data
- Health checks and monitoring endpoints
- Bull Board UI for queue visualization
- JWT authentication
- Rate limiting

### Service 2: Worker Service (`apps/worker`)

- Bull Queue consumer
- Batch processing (50 bars per insert)
- Data validation and transformation
- Error handling and retry logic
- Metrics collection

### Service 3: Database Service (`apps/database`)

- TypeORM / Prisma entities
- Repository pattern
- Connection pooling
- Query optimization
- Migration scripts

---

## Technical Requirements

### Technology Stack

```json
{
  "framework": "NestJS v10+",
  "language": "TypeScript",
  "queue": "Bull v4+ (@nestjs/bull)",
  "database": "PostgreSQL with TypeORM or Prisma",
  "redis": "Upstash Redis (ioredis client)",
  "validation": "class-validator, class-transformer",
  "testing": "Jest",
  "linting": "ESLint + Prettier",
  "documentation": "Swagger/OpenAPI"
}
```

### Architecture Pattern

- **Monorepo structure** using NestJS CLI workspace
- **Shared libraries** for common utilities
- **Environment-based configuration** (staging, production)
- **Dependency injection** throughout
- **SOLID principles**

---

## Project Structure

Please create this structure:

```
trading-alerts-backend/
├── apps/
│   ├── api-gateway/                 # REST API service
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── health/              # Health check module
│   │   │   ├── market-data/         # Market data endpoints
│   │   │   ├── confluence/          # Confluence score endpoints
│   │   │   ├── queue/               # Queue management endpoints
│   │   │   └── auth/                # Authentication module
│   │   └── test/
│   │
│   ├── worker/                      # Queue worker service
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── processors/          # Job processors
│   │   │   │   └── market-data.processor.ts
│   │   │   ├── services/
│   │   │   │   ├── batch.service.ts
│   │   │   │   ├── validation.service.ts
│   │   │   │   └── metrics.service.ts
│   │   │   └── guards/
│   │   └── test/
│   │
│   └── database/                    # Database service (optional)
│       └── src/
│           ├── entities/
│           ├── repositories/
│           └── migrations/
│
├── libs/                            # Shared libraries
│   ├── common/
│   │   ├── src/
│   │   │   ├── decorators/
│   │   │   ├── filters/
│   │   │   ├── interceptors/
│   │   │   ├── pipes/
│   │   │   └── utils/
│   │   └── index.ts
│   │
│   ├── database/
│   │   ├── src/
│   │   │   ├── entities/            # TypeORM entities
│   │   │   │   ├── market-data.entity.ts
│   │   │   │   ├── confluence-score.entity.ts
│   │   │   │   └── job-metadata.entity.ts
│   │   │   ├── repositories/
│   │   │   └── database.module.ts
│   │   └── index.ts
│   │
│   ├── queue/
│   │   ├── src/
│   │   │   ├── queue.module.ts
│   │   │   ├── queue.service.ts
│   │   │   └── interfaces/
│   │   └── index.ts
│   │
│   └── config/
│       ├── src/
│       │   ├── configuration.ts
│       │   └── validation.ts
│       └── index.ts
│
├── docker/
│   ├── Dockerfile.api
│   ├── Dockerfile.worker
│   └── docker-compose.yml
│
├── .env.example
├── .eslintrc.js
├── .prettierrc
├── nest-cli.json
├── package.json
├── tsconfig.json
└── README.md
```

---

## Detailed Implementation Requirements

### 1. Shared Database Library (`libs/database`)

#### Market Data Entity

Based on the architecture document (Section 6.1), create entities for all 15 symbols. Each symbol has its own table with 57 columns.

**Entity Example:**

```typescript
// libs/database/src/entities/market-data.entity.ts

import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('btcusd') // Dynamic table name based on symbol
export class MarketDataEntity {
  @PrimaryColumn({ type: 'integer' })
  timestamp: number;

  @PrimaryColumn({ type: 'text' })
  timeframe: string;

  // OHLCV
  @Column({ type: 'real' })
  open: number;

  @Column({ type: 'real' })
  high: number;

  @Column({ type: 'real' })
  low: number;

  @Column({ type: 'real' })
  close: number;

  @Column({ type: 'integer' })
  volume: number;

  // TEMA/HRMA/SMMA (3 columns)
  @Column({ type: 'real', nullable: true })
  tema: number;

  @Column({ type: 'real', nullable: true })
  hrma: number;

  @Column({ type: 'real', nullable: true })
  smma: number;

  // Body Momentum (2 columns)
  @Column({ type: 'real', nullable: true, name: 'Z-Score of body size' })
  zscore: number;

  @Column({ type: 'integer', nullable: true, name: 'Candle classification' })
  classification: number;

  // Fractal Diagonal (8 columns)
  @Column({ type: 'real', nullable: true })
  diag_asc_line_1: number;

  @Column({ type: 'real', nullable: true })
  diag_asc_line_2: number;

  @Column({ type: 'real', nullable: true })
  diag_asc_line_3: number;

  @Column({ type: 'real', nullable: true })
  diag_desc_line_1: number;

  @Column({ type: 'real', nullable: true })
  diag_desc_line_2: number;

  @Column({ type: 'real', nullable: true })
  diag_desc_line_3: number;

  @Column({ type: 'real', nullable: true })
  diag_high_map: number;

  @Column({ type: 'real', nullable: true })
  diag_low_map: number;

  // ... Continue for all 57 columns (see architecture doc Section 6.1)

  @Column({ type: 'integer', nullable: true })
  collected_at: number;
}
```

**Important:** Create a **dynamic entity factory** that generates entities for all 15 symbols:

```typescript
export function createMarketDataEntity(symbol: string) {
  @Entity(symbol)
  class DynamicMarketDataEntity extends MarketDataEntity {}

  return DynamicMarketDataEntity;
}

// Usage
const BtcusdEntity = createMarketDataEntity('btcusd');
const EthusdEntity = createMarketDataEntity('ethusd');
// ... for all 15 symbols
```

#### Repository Pattern

```typescript
// libs/database/src/repositories/market-data.repository.ts

@Injectable()
export class MarketDataRepository {
  constructor(@InjectConnection() private connection: Connection) {}

  async batchInsert(symbol: string, bars: MarketDataDto[]): Promise<void> {
    const repository = this.connection.getRepository(symbol);

    await repository
      .createQueryBuilder()
      .insert()
      .into(symbol)
      .values(bars)
      .orUpdate({
        conflict_target: ['timestamp', 'timeframe'],
        overwrite: ['open', 'high', 'low', 'close', 'volume' /* all columns */],
      })
      .execute();
  }

  async findLatest(
    symbol: string,
    timeframe: string,
    limit: number
  ): Promise<MarketDataEntity[]> {
    const repository = this.connection.getRepository(symbol);

    return repository
      .createQueryBuilder('bar')
      .where('bar.timeframe = :timeframe', { timeframe })
      .orderBy('bar.timestamp', 'DESC')
      .limit(limit)
      .getMany();
  }

  async findByDateRange(
    symbol: string,
    timeframe: string,
    from: number,
    to: number
  ): Promise<MarketDataEntity[]> {
    const repository = this.connection.getRepository(symbol);

    return repository
      .createQueryBuilder('bar')
      .where('bar.timeframe = :timeframe', { timeframe })
      .andWhere('bar.timestamp BETWEEN :from AND :to', { from, to })
      .orderBy('bar.timestamp', 'ASC')
      .getMany();
  }
}
```

---

### 2. Queue Library (`libs/queue`)

#### Queue Module

```typescript
// libs/queue/src/queue.module.ts

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get('REDIS_HOST'),
          port: config.get('REDIS_PORT'),
          password: config.get('REDIS_PASSWORD'),
          tls: {}, // Required for Upstash
        },
      }),
    }),
    BullModule.registerQueue({
      name: 'market-data-sync',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
```

#### Queue Service

```typescript
// libs/queue/src/queue.service.ts

import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';

@Injectable()
export class QueueService {
  constructor(@InjectQueue('market-data-sync') private queue: Queue) {}

  async getStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }

  async getFailedJobs(limit = 100): Promise<Job[]> {
    return this.queue.getFailed(0, limit);
  }

  async retryJob(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (job) {
      await job.retry();
    }
  }

  async pauseQueue(): Promise<void> {
    await this.queue.pause();
  }

  async resumeQueue(): Promise<void> {
    await this.queue.resume();
  }
}
```

---

### 3. Worker Service (`apps/worker`)

#### Market Data Processor

This is the **core component** that processes jobs from the queue.

```typescript
// apps/worker/src/processors/market-data.processor.ts

import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { BatchService } from '../services/batch.service';
import { ValidationService } from '../services/validation.service';
import { MetricsService } from '../services/metrics.service';

interface MarketDataJob {
  symbol: string;
  timeframe: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  // ... all 57 columns
}

@Processor('market-data-sync')
export class MarketDataProcessor {
  private readonly logger = new Logger(MarketDataProcessor.name);
  private batchBuffer: MarketDataJob[] = [];
  private readonly BATCH_SIZE = 50;
  private readonly BATCH_TIMEOUT = 1000; // 1 second

  constructor(
    private readonly batchService: BatchService,
    private readonly validationService: ValidationService,
    private readonly metricsService: MetricsService
  ) {
    // Flush buffer every second
    setInterval(() => this.flushIfNeeded(), this.BATCH_TIMEOUT);
  }

  @Process()
  async processMarketData(job: Job<MarketDataJob>) {
    const startTime = Date.now();

    try {
      // 1. Validate job data
      const validated = await this.validationService.validate(job.data);

      // 2. Add to batch buffer
      this.batchBuffer.push(validated);

      // 3. Flush if threshold met
      if (this.batchBuffer.length >= this.BATCH_SIZE) {
        await this.flushBatch();
      }

      // Record metrics
      const duration = Date.now() - startTime;
      this.metricsService.recordJobProcessing(job.data.symbol, duration);

      return { success: true };
    } catch (error) {
      this.logger.error(`Job ${job.id} failed:`, error);
      this.metricsService.recordJobFailure(job.data.symbol, error);
      throw error; // Let Bull handle retry
    }
  }

  @OnQueueFailed()
  async handleFailedJob(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed after all retries:`, error);

    // Send to dead letter queue or alert
    if (job.attemptsMade >= job.opts.attempts) {
      await this.sendToDeadLetterQueue(job, error);
    }
  }

  private async flushBatch() {
    if (this.batchBuffer.length === 0) return;

    const batch = [...this.batchBuffer];
    this.batchBuffer = [];

    const startTime = Date.now();

    try {
      await this.batchService.insertBatch(batch);

      const duration = Date.now() - startTime;
      this.metricsService.recordBatchInsert(batch.length, duration);

      this.logger.log(`Batch inserted: ${batch.length} bars in ${duration}ms`);
    } catch (error) {
      this.logger.error('Batch insert failed:', error);
      // Re-add to buffer for retry
      this.batchBuffer.push(...batch);
      throw error;
    }
  }

  private async flushIfNeeded() {
    if (this.batchBuffer.length > 0) {
      await this.flushBatch();
    }
  }

  private async sendToDeadLetterQueue(job: Job, error: Error) {
    // Implementation for dead letter queue
    // Could store in separate database table or alert system
  }
}
```

#### Batch Service

```typescript
// apps/worker/src/services/batch.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { MarketDataRepository } from '@app/database';
import { MarketDataJob } from '../processors/market-data.processor';

@Injectable()
export class BatchService {
  private readonly logger = new Logger(BatchService.name);

  constructor(private readonly marketDataRepository: MarketDataRepository) {}

  async insertBatch(batch: MarketDataJob[]): Promise<void> {
    // Group by symbol
    const grouped = this.groupBySymbol(batch);

    // Insert each symbol's batch
    const promises = Object.entries(grouped).map(([symbol, bars]) =>
      this.marketDataRepository.batchInsert(symbol, bars)
    );

    await Promise.all(promises);
  }

  private groupBySymbol(
    batch: MarketDataJob[]
  ): Record<string, MarketDataJob[]> {
    return batch.reduce(
      (acc, bar) => {
        if (!acc[bar.symbol]) {
          acc[bar.symbol] = [];
        }
        acc[bar.symbol].push(bar);
        return acc;
      },
      {} as Record<string, MarketDataJob[]>
    );
  }
}
```

#### Validation Service

```typescript
// apps/worker/src/services/validation.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { MarketDataDto } from '@app/common/dtos';

@Injectable()
export class ValidationService {
  async validate(data: any): Promise<MarketDataDto> {
    // Transform to DTO
    const dto = plainToClass(MarketDataDto, data);

    // Validate
    const errors = await validate(dto);

    if (errors.length > 0) {
      const messages = errors.map((e) => Object.values(e.constraints)).flat();
      throw new BadRequestException(messages);
    }

    return dto;
  }
}
```

#### Metrics Service

```typescript
// apps/worker/src/services/metrics.service.ts

import { Injectable } from '@nestjs/common';
import { Counter, Histogram, register } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly jobsProcessed: Counter;
  private readonly jobsFailed: Counter;
  private readonly jobDuration: Histogram;
  private readonly batchInserts: Counter;
  private readonly batchSize: Histogram;

  constructor() {
    this.jobsProcessed = new Counter({
      name: 'jobs_processed_total',
      help: 'Total jobs processed',
      labelNames: ['symbol'],
    });

    this.jobsFailed = new Counter({
      name: 'jobs_failed_total',
      help: 'Total jobs failed',
      labelNames: ['symbol'],
    });

    this.jobDuration = new Histogram({
      name: 'job_duration_seconds',
      help: 'Job processing duration',
      buckets: [0.01, 0.05, 0.1, 0.5, 1],
    });

    this.batchInserts = new Counter({
      name: 'batch_inserts_total',
      help: 'Total batch inserts',
    });

    this.batchSize = new Histogram({
      name: 'batch_size',
      help: 'Number of bars per batch',
      buckets: [10, 25, 50, 100],
    });
  }

  recordJobProcessing(symbol: string, duration: number) {
    this.jobsProcessed.inc({ symbol });
    this.jobDuration.observe(duration / 1000);
  }

  recordJobFailure(symbol: string, error: Error) {
    this.jobsFailed.inc({ symbol });
  }

  recordBatchInsert(count: number, duration: number) {
    this.batchInserts.inc();
    this.batchSize.observe(count);
  }

  getMetrics() {
    return register.metrics();
  }
}
```

---

### 4. API Gateway (`apps/api-gateway`)

#### Market Data Controller

```typescript
// apps/api-gateway/src/market-data/market-data.controller.ts

import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MarketDataService } from './market-data.service';

@ApiTags('Market Data')
@Controller('api/v1/market-data')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

  @Get(':symbol/:timeframe/latest')
  @ApiOperation({ summary: 'Get latest bars' })
  async getLatest(
    @Param('symbol') symbol: string,
    @Param('timeframe') timeframe: string,
    @Query('limit') limit: number = 100
  ) {
    return this.marketDataService.getLatest(symbol, timeframe, limit);
  }

  @Get(':symbol/:timeframe')
  @ApiOperation({ summary: 'Get bars by date range' })
  async getByDateRange(
    @Param('symbol') symbol: string,
    @Param('timeframe') timeframe: string,
    @Query('from') from: number,
    @Query('to') to: number
  ) {
    return this.marketDataService.getByDateRange(symbol, timeframe, from, to);
  }
}
```

#### Queue Controller (Bull Board)

```typescript
// apps/api-gateway/src/queue/queue.controller.ts

import { Controller, Get, Post, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { QueueService } from '@app/queue';

@ApiTags('Queue Management')
@Controller('api/v1/queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get('stats')
  async getStats() {
    return this.queueService.getStats();
  }

  @Get('failed')
  async getFailedJobs() {
    return this.queueService.getFailedJobs();
  }

  @Post('retry/:jobId')
  async retryJob(@Param('jobId') jobId: string) {
    await this.queueService.retryJob(jobId);
    return { success: true, message: 'Job retried' };
  }
}
```

#### Health Controller

```typescript
// apps/api-gateway/src/health/health.controller.ts

import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { QueueService } from '@app/queue';

@Controller('api/v1/health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private queueService: QueueService
  ) {}

  @Get()
  @HealthCheck()
  async check() {
    const queueStats = await this.queueService.getStats();

    return this.health.check([
      () => this.db.pingCheck('database'),
      async () => ({
        queue: {
          status: queueStats.active > 0 ? 'up' : 'down',
          ...queueStats,
        },
      }),
    ]);
  }
}
```

---

### 5. Configuration (`libs/config`)

```typescript
// libs/config/src/configuration.ts

export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,

  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD,
  },

  database: {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV === 'development',
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
});
```

---

### 6. Docker Setup

#### Dockerfile for Worker

```dockerfile
# docker/Dockerfile.worker

FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build worker

FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

CMD ["node", "dist/apps/worker/main"]
```

#### Docker Compose

```yaml
# docker/docker-compose.yml

version: '3.8'

services:
  api-gateway:
    build:
      context: ..
      dockerfile: docker/Dockerfile.api
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
      - REDIS_HOST=${REDIS_HOST}
      - REDIS_PASSWORD=${REDIS_PASSWORD}
      - DB_HOST=${DB_HOST}
      - DB_PASSWORD=${DB_PASSWORD}
    depends_on:
      - postgres

  worker:
    build:
      context: ..
      dockerfile: docker/Dockerfile.worker
    environment:
      - NODE_ENV=production
      - REDIS_HOST=${REDIS_HOST}
      - REDIS_PASSWORD=${REDIS_PASSWORD}
      - DB_HOST=${DB_HOST}
      - DB_PASSWORD=${DB_PASSWORD}
    depends_on:
      - postgres
    deploy:
      replicas: 3

  postgres:
    image: timescale/timescaledb:latest-pg15
    ports:
      - '5432:5432'
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=trading_alerts
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

---

### 7. Testing Requirements

#### Unit Tests

```typescript
// apps/worker/src/processors/market-data.processor.spec.ts

describe('MarketDataProcessor', () => {
  let processor: MarketDataProcessor;
  let batchService: BatchService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MarketDataProcessor,
        {
          provide: BatchService,
          useValue: { insertBatch: jest.fn() },
        },
        // ... other mocks
      ],
    }).compile();

    processor = module.get(MarketDataProcessor);
    batchService = module.get(BatchService);
  });

  it('should validate job data', async () => {
    const job = createMockJob({ symbol: 'invalid!' });
    await expect(processor.processMarketData(job)).rejects.toThrow();
  });

  it('should batch 50 jobs correctly', async () => {
    const jobs = Array.from({ length: 50 }, (_, i) =>
      createMockJob({ timestamp: 1705324800 + i })
    );

    for (const job of jobs) {
      await processor.processMarketData(job);
    }

    expect(batchService.insertBatch).toHaveBeenCalledTimes(1);
  });
});
```

#### Integration Tests

```typescript
describe('End-to-End Flow', () => {
  it('should process job from queue to database', async () => {
    const queue = app.get(getQueueToken('market-data-sync'));

    await queue.add(mockBarData);

    // Wait for processing
    await waitFor(() => queue.getActiveCount() === 0, 5000);

    // Verify in database
    const repository = app.get(MarketDataRepository);
    const bar = await repository.findOne({
      where: {
        symbol: mockBarData.symbol,
        timestamp: mockBarData.timestamp,
      },
    });

    expect(bar).toBeDefined();
    expect(bar.close).toBe(mockBarData.close);
  });
});
```

---

## Environment Variables

Create `.env.example`:

```bash
# Server
NODE_ENV=development
PORT=3000

# Redis (Upstash)
REDIS_HOST=your-redis.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your_token_here

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=trading_alerts

# JWT
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=24h

# Bull Board
BULL_BOARD_USERNAME=admin
BULL_BOARD_PASSWORD=admin

# Monitoring (optional)
SENTRY_DSN=
NEW_RELIC_KEY=
```

---

## Deliverables Checklist

Please ensure the implementation includes:

- [ ] **Monorepo structure** with 3 apps + shared libs
- [ ] **Worker service** with Bull Queue processor
- [ ] **API Gateway** with REST endpoints
- [ ] **Database entities** for all 57 columns
- [ ] **Batch insert** logic (50 bars per batch)
- [ ] **Validation** using class-validator
- [ ] **Error handling** and retry logic
- [ ] **Metrics collection** using Prometheus client
- [ ] **Health checks** for all services
- [ ] **Bull Board** integration for monitoring
- [ ] **JWT authentication** for API
- [ ] **Docker** configuration
- [ ] **Unit tests** (>70% coverage)
- [ ] **Integration tests** for critical paths
- [ ] **Swagger/OpenAPI** documentation
- [ ] **README.md** with setup instructions
- [ ] **TypeScript** strict mode enabled
- [ ] **ESLint + Prettier** configured

---

## Important Notes

1. **Read the Architecture Document First!** - It contains all the technical specifications, database schema, API endpoints, and error handling strategies.

2. **All 57 Columns** - Make sure to include ALL columns from the architecture doc Section 6.1 in the entity and DTOs.

3. **Batch Processing** - This is critical for performance. The worker should accumulate jobs and insert in batches of 50 or every 1 second.

4. **Dynamic Table Names** - Each symbol has its own table (btcusd, ethusd, etc.). Use dynamic entity generation.

5. **Upstash Redis** - Remember to enable TLS in the connection config.

6. **Error Handling** - Implement comprehensive error handling with retry logic and dead letter queue.

7. **Production Ready** - This code will go to production, so ensure proper logging, monitoring, and error handling.

---

## Questions to Clarify

Before you start implementing, please confirm:

1. **TypeORM vs Prisma** - Which ORM do you prefer? (I recommend TypeORM for dynamic table names)
2. **Monorepo tool** - NestJS CLI workspace or Nx? (I recommend NestJS CLI)
3. **Symbols list** - Should this be configurable or hardcoded? (I suggest env variable: `SYMBOLS=btcusd,ethusd,...`)

---

## Start Here

1. ✅ Read `ARCHITECTURE_DESIGN_DOCUMENT.md` thoroughly
2. ✅ Review `SimpleDataCollector_Modified_v2_24_PRODUCTION.mq5` to understand the data structure
3. ✅ Set up the monorepo structure
4. ✅ Implement shared libraries (database, queue, config)
5. ✅ Implement worker service (most critical)
6. ✅ Implement API gateway
7. ✅ Add tests
8. ✅ Add Docker configuration
9. ✅ Write README

Let's build this! 🚀
