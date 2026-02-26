# Prompt 3: NestJS Workers Implementation

## Context

I have uploaded two architecture documents:

1. `ARCHITECTURE_DESIGN_DOCUMENT_ENHANCED.md` - Complete API Gateway architecture
2. `API_GATEWAY_OBSERVABILITY_GUIDE.md` - Observability implementation guide

I need you to build **production-ready NestJS Workers** that:

- Process jobs from Bull Queue (`market-data-sync`)
- Batch insert to Railway PostgreSQL/TimescaleDB
- Handle 12,000 bars/day (~139 bars/hour, ~2-3 bars/minute)
- Implement retry logic with exponential backoff
- Include structured logging and error handling
- Track processing metrics

## Requirements

### 1. Project Structure

Create a complete NestJS worker application:

```
workers/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── workers/
│   │   ├── workers.module.ts
│   │   ├── market-data.processor.ts
│   │   └── batch.service.ts
│   ├── database/
│   │   ├── database.module.ts
│   │   ├── database.service.ts
│   │   └── entities/
│   │       └── market-data.entity.ts
│   ├── monitoring/
│   │   ├── monitoring.module.ts
│   │   └── metrics.service.ts
│   └── config/
│       ├── database.config.ts
│       └── queue.config.ts
├── test/
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

### 2. Database Schema (TimescaleDB)

Create TypeORM entity for market data with **57 columns**:

```typescript
@Entity('market_data')
@Index(['symbol', 'timeframe', 'timestamp'], { unique: true })
export class MarketData {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Basic OHLCV (7 fields)
  @Column()
  symbol: string;

  @Column()
  timeframe: string;

  @Column({ type: 'bigint' })
  timestamp: number;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  open: number;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  high: number;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  low: number;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  close: number;

  @Column({ type: 'bigint' })
  volume: number;

  // Moving Averages (4 fields)
  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  tema: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  hrma: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  smma: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  ema_26: number;

  // Z-Score (2 fields)
  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  zscore: number;

  @Column({ type: 'int', nullable: true })
  classification: number;

  // Fractal Diagonal (8 fields)
  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  diag_asc_line_1: number;

  // ... (continue for all 57 columns as per DTO)

  // Metadata
  @CreateDateColumn()
  created_at: Date;

  @Column({ nullable: true })
  terminal_id: string;
}
```

**Note:** Include TimescaleDB hypertable setup for time-series optimization.

### 3. Bull Queue Processor

Implement the queue processor with concurrency control:

```typescript
@Processor('market-data-sync')
export class MarketDataProcessor {
  constructor(
    private readonly batchService: BatchService,
    private readonly metricsService: MetricsService
  ) {}

  @Process({
    name: 'process',
    concurrency: 5, // Process 5 jobs concurrently
  })
  async processMarketData(job: Job<MarketDataDto>) {
    const startTime = Date.now();

    try {
      // Add to batch
      await this.batchService.addToBatch(job.data);

      // Update metrics
      this.metricsService.jobSuccessCounter.inc();
      this.metricsService.jobDuration.observe((Date.now() - startTime) / 1000);

      return { status: 'success', jobId: job.id };
    } catch (error) {
      // Log error
      logger.error('Job processing failed', {
        jobId: job.id,
        symbol: job.data.symbol,
        timeframe: job.data.timeframe,
        error: error.message,
      });

      // Update metrics
      this.metricsService.jobFailureCounter.inc();

      throw error; // Will trigger retry
    }
  }
}
```

### 4. Batch Insert Service

Implement efficient batch insertion:

**Strategy:**

- Accumulate jobs into batches
- Flush every 100 records OR every 30 seconds (whichever comes first)
- Use TypeORM's `createQueryBuilder` for bulk insert
- Handle conflicts with UPSERT

```typescript
@Injectable()
export class BatchService {
  private batch: MarketDataDto[] = [];
  private batchSize = 100;
  private flushInterval = 30000; // 30 seconds
  private flushTimer: NodeJS.Timeout;

  constructor(
    @InjectRepository(MarketData)
    private readonly marketDataRepo: Repository<MarketData>
  ) {
    this.startFlushTimer();
  }

  async addToBatch(data: MarketDataDto): Promise<void> {
    this.batch.push(data);

    if (this.batch.length >= this.batchSize) {
      await this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.batch.length === 0) return;

    const batchToInsert = [...this.batch];
    this.batch = [];

    try {
      await this.marketDataRepo
        .createQueryBuilder()
        .insert()
        .into(MarketData)
        .values(batchToInsert)
        .orUpdate(
          ['open', 'high', 'low', 'close', 'volume' /* all 57 columns */],
          ['symbol', 'timeframe', 'timestamp']
        )
        .execute();

      logger.info('Batch inserted', {
        count: batchToInsert.length,
      });
    } catch (error) {
      logger.error('Batch insert failed', {
        count: batchToInsert.length,
        error: error.message,
      });

      // Re-add to batch for retry
      this.batch.unshift(...batchToInsert);
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.flushTimer);
    await this.flush(); // Final flush on shutdown
  }
}
```

### 5. Database Configuration

**TypeORM Configuration:**

```typescript
// config/database.config.ts
export const databaseConfig = {
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: [MarketData],
  synchronize: false, // Use migrations in production
  logging: process.env.NODE_ENV === 'development',
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
  extra: {
    max: 20, // Max pool connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
};
```

**TimescaleDB Setup:**

```sql
-- Migration: Create hypertable
CREATE TABLE IF NOT EXISTS market_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(20) NOT NULL,
  timeframe VARCHAR(20) NOT NULL,
  timestamp BIGINT NOT NULL,
  -- ... all 57 columns
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, timeframe, timestamp)
);

-- Convert to hypertable (TimescaleDB)
SELECT create_hypertable('market_data', 'timestamp',
  chunk_time_interval => 86400, -- 1 day chunks
  if_not_exists => TRUE
);

-- Create indexes
CREATE INDEX idx_market_data_symbol_time ON market_data (symbol, timestamp DESC);
CREATE INDEX idx_market_data_timeframe ON market_data (timeframe);
CREATE INDEX idx_market_data_created_at ON market_data (created_at);
```

### 6. Retry Logic & Error Handling

Configure Bull Queue retry behavior:

```typescript
// In processor
@Process({
  name: 'process',
  concurrency: 5,
})
async processMarketData(job: Job<MarketDataDto>) {
  try {
    // Processing logic
  } catch (error) {
    if (job.attemptsMade < job.opts.attempts) {
      // Will retry automatically
      logger.warn('Job failed, will retry', {
        jobId: job.id,
        attempt: job.attemptsMade,
        maxAttempts: job.opts.attempts,
      });
    } else {
      // Final failure
      logger.error('Job permanently failed', {
        jobId: job.id,
        attempts: job.attemptsMade,
        error: error.message,
      });

      // Store in dead letter queue or alert
      await this.handlePermanentFailure(job);
    }

    throw error;
  }
}
```

### 7. Monitoring & Metrics

Implement Prometheus metrics:

```typescript
@Injectable()
export class MetricsService {
  public readonly jobSuccessCounter = new Counter({
    name: 'worker_jobs_success_total',
    help: 'Total successful jobs',
  });

  public readonly jobFailureCounter = new Counter({
    name: 'worker_jobs_failed_total',
    help: 'Total failed jobs',
  });

  public readonly jobDuration = new Histogram({
    name: 'worker_job_duration_seconds',
    help: 'Job processing duration',
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
  });

  public readonly batchSize = new Gauge({
    name: 'worker_batch_size',
    help: 'Current batch size',
  });

  public readonly dbConnectionPool = new Gauge({
    name: 'worker_db_connections',
    help: 'Active database connections',
  });
}
```

### 8. Structured Logging

Implement structured logging for workers:

```typescript
// Successful processing
logger.info('Job processed successfully', {
  jobId: job.id,
  symbol: job.data.symbol,
  timeframe: job.data.timeframe,
  timestamp: job.data.timestamp,
  duration: processingTime,
  batchSize: this.batch.length,
});

// Failed processing
logger.error('Job processing failed', {
  jobId: job.id,
  symbol: job.data.symbol,
  timeframe: job.data.timeframe,
  attempt: job.attemptsMade,
  maxAttempts: job.opts.attempts,
  error: error.message,
  stack: error.stack,
});

// Batch flush
logger.info('Batch flushed to database', {
  count: batchCount,
  duration: flushDuration,
  success: true,
});
```

### 9. Health Check

Implement health check endpoint:

```typescript
@Get('/health')
async checkHealth() {
  const queueHealth = await this.queue.isReady();
  const dbHealth = await this.checkDatabase();

  return {
    status: queueHealth && dbHealth ? 'healthy' : 'unhealthy',
    services: {
      queue: queueHealth,
      database: dbHealth,
      batch: {
        currentSize: this.batchService.getCurrentBatchSize(),
        lastFlush: this.batchService.getLastFlushTime(),
      },
    },
    timestamp: new Date().toISOString(),
  };
}

private async checkDatabase(): Promise<boolean> {
  try {
    await this.dataSource.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
```

### 10. Environment Configuration

Create `.env.example`:

```bash
# Server
PORT=3001
NODE_ENV=production

# Redis (Bull Queue)
REDIS_HOST=your-redis.railway.internal
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# PostgreSQL/TimescaleDB (Railway)
DATABASE_HOST=your-postgres.railway.internal
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=your_db_password
DATABASE_NAME=trading_alerts
DATABASE_SSL=true

# Worker Configuration
WORKER_CONCURRENCY=5
BATCH_SIZE=100
BATCH_FLUSH_INTERVAL=30000

# Monitoring
METRICS_ENABLED=true
LOG_LEVEL=info
```

### 11. Railway Deployment

Include:

- `railway.json` configuration
- Start script: `"start:worker": "node dist/main"`
- Health check endpoint
- Graceful shutdown handling

**Graceful Shutdown:**

```typescript
async function gracefulShutdown() {
  logger.info('Shutting down gracefully...');

  // Stop accepting new jobs
  await queue.pause();

  // Wait for active jobs to complete (max 30 seconds)
  await queue.close();

  // Flush remaining batch
  await batchService.flush();

  // Close database connections
  await dataSource.destroy();

  logger.info('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
```

### 12. Testing

Provide unit tests for:

```typescript
describe('BatchService', () => {
  it('should accumulate jobs and flush at batch size', async () => {
    // Test batch accumulation
  });

  it('should flush on timer even if batch not full', async () => {
    // Test timer-based flush
  });

  it('should retry failed batch inserts', async () => {
    // Test retry logic
  });
});

describe('MarketDataProcessor', () => {
  it('should process valid market data', async () => {
    // Test successful processing
  });

  it('should retry on transient failures', async () => {
    // Test retry behavior
  });
});
```

## Deliverables

Please provide:

1. ✅ Complete NestJS worker application
2. ✅ TypeORM entity with all 57 columns
3. ✅ Bull Queue processor with concurrency
4. ✅ Batch insertion service
5. ✅ Database configuration & migrations
6. ✅ TimescaleDB setup SQL
7. ✅ Retry logic & error handling
8. ✅ Structured logging implementation
9. ✅ Prometheus metrics
10. ✅ Health check endpoint
11. ✅ Environment configuration
12. ✅ Unit tests
13. ✅ Railway deployment guide
14. ✅ README with setup instructions

## Success Criteria

The workers should:

- ✅ Process 12,000+ jobs/day reliably
- ✅ Batch insert efficiently (100 records or 30s)
- ✅ Retry failed jobs with exponential backoff
- ✅ Handle database connection issues gracefully
- ✅ Log structured JSON for all operations
- ✅ Expose Prometheus metrics
- ✅ Shutdown gracefully (no data loss)
- ✅ Deploy to Railway successfully

## Notes

- Reference architecture document for complete schema
- Use observability guide for logging patterns
- Focus on production reliability (retries, batching, monitoring)
- Implement proper error handling and recovery
- Follow NestJS best practices

Please implement production-ready workers with comprehensive error handling.
