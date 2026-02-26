# Prompt 2: Railway Redis Setup & Configuration

## Context

I have uploaded two architecture documents:

1. `ARCHITECTURE_DESIGN_DOCUMENT_ENHANCED.md` - Complete API Gateway architecture
2. `API_GATEWAY_OBSERVABILITY_GUIDE.md` - Observability implementation guide

I need you to provide a **complete Railway Redis setup guide** for a Trading Alerts SaaS platform that uses Redis for:

- Bull Queue (market data processing)
- Sessions (user authentication)
- Rate limiting (API Gateway protection)
- Leaderboard (sorted sets)
- Notifications (pub/sub)
- General caching

## Requirements

### 1. Railway Redis Provisioning Guide

Provide step-by-step instructions:

1. How to add Redis to Railway project
2. How to configure Redis for production
3. How to set environment variables
4. How to verify connection

### 2. Redis Database Allocation Strategy

Create a configuration document for using multiple Redis databases:

```
Database 0: General Cache
Database 1: Bull Queue (market-data-sync)
Database 2: Leaderboard (sorted sets)
Database 3: Sessions (user auth)
Database 4: Rate Limiting (counters)
Database 5: Notifications (pub/sub)
```

### 3. Bull Queue Configuration

Create a complete Bull Queue configuration file for:

**Queue Name:** `market-data-sync`

**Job Structure:**

```typescript
interface MarketDataJob {
  symbol: string;
  timeframe: string;
  timestamp: number;
  // ... 54 more fields (OHLCV + indicators)
}
```

**Job Options:**

```typescript
{
  jobId: '{symbol}_{timeframe}_{timestamp}',
  removeOnComplete: 1000,  // Keep last 1000 completed
  removeOnFail: 5000,      // Keep last 5000 failed for debugging
  attempts: 3,             // Retry failed jobs 3 times
  backoff: {
    type: 'exponential',
    delay: 2000,           // Start with 2 seconds
  },
  timeout: 30000,          // 30 second timeout per job
}
```

**Queue Settings:**

```typescript
{
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
  },
  settings: {
    stalledInterval: 30000,   // Check for stalled jobs every 30s
    maxStalledCount: 2,       // Max 2 stalls before job fails
    guardInterval: 5000,      // Check for delayed jobs every 5s
    retryProcessDelay: 5000,  // Wait 5s before retrying processor
  },
}
```

### 4. Redis Configuration for Production

Provide recommended Redis configuration:

**Memory Management:**

```
maxmemory: 512mb (Railway default)
maxmemory-policy: allkeys-lru (evict least recently used)
```

**Persistence:**

```
save: 900 1       (save if 1 key changed in 15 minutes)
save: 300 10      (save if 10 keys changed in 5 minutes)
save: 60 10000    (save if 10000 keys changed in 1 minute)
```

**Connection Settings:**

```
timeout: 0                    (never close idle connections)
tcp-keepalive: 300           (send TCP keepalive every 300 seconds)
maxclients: 10000            (max concurrent connections)
```

### 5. Connection Configuration Files

Create connection configuration for each service:

**API Gateway → Redis:**

```typescript
// config/redis.config.ts
import { RedisOptions } from 'ioredis';

export const redisConfig: RedisOptions = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: 1, // Bull Queue database
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true,
};
```

**Worker → Redis:**

```typescript
// Same config, db: 1 for Bull Queue
```

**Rate Limiter → Redis:**

```typescript
// Same config, db: 4 for rate limiting
```

### 6. Rate Limiting Configuration

Implement rate limiting using Redis:

**Strategy:**

- Window: 1 minute (sliding window)
- Limit per terminal: 200 requests/minute
- Limit per IP: 500 requests/minute (if no terminal ID)

**Implementation pattern:**

```typescript
// Pseudo-code for rate limit check
const key = `rate_limit:${terminalId}:${minute}`;
const count = await redis.incr(key);
if (count === 1) {
  await redis.expire(key, 60);
}
if (count > 200) {
  throw new TooManyRequestsException();
}
```

### 7. Bull Queue Monitoring Setup

Provide configuration for Bull Queue monitoring:

**Bull Board (UI):**

```typescript
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullAdapter(marketDataQueue)],
  serverAdapter,
});
```

**Access:** `https://api-gateway.railway.app/admin/queues`

### 8. Redis Backup Strategy

Provide backup recommendations:

- Railway Redis automatic daily backups
- Retention: 7 days
- Manual backup command
- Restore procedure

### 9. Environment Variables

Create complete `.env` template for Redis:

```bash
# Redis Configuration (Railway)
REDIS_HOST=your-redis.railway.internal
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password_here
REDIS_URL=redis://:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}

# Bull Queue
QUEUE_NAME=market-data-sync
QUEUE_CONCURRENCY=5
QUEUE_REMOVE_ON_COMPLETE=1000
QUEUE_REMOVE_ON_FAIL=5000

# Rate Limiting
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=200
RATE_LIMIT_ENABLED=true
```

### 10. Health Check & Monitoring

Provide health check implementation:

```typescript
// Health check endpoint
@Get('/health')
async checkHealth() {
  const redis = await this.redis.ping();
  const queueHealth = await this.queue.isReady();

  return {
    status: redis === 'PONG' && queueHealth ? 'healthy' : 'unhealthy',
    services: {
      redis: redis === 'PONG',
      queue: queueHealth,
    },
    timestamp: new Date().toISOString(),
  };
}
```

### 11. Troubleshooting Guide

Provide common issues and solutions:

**Issue 1: Connection refused**

- Check Railway Redis is running
- Verify REDIS_HOST points to internal URL
- Check firewall rules

**Issue 2: Queue jobs stuck**

- Check for stalled jobs: `await queue.getStalled()`
- Clean stalled jobs: `await queue.clean(0, 'failed')`
- Restart workers

**Issue 3: Memory full**

- Check memory usage: `INFO memory`
- Adjust maxmemory-policy
- Clear old completed jobs

**Issue 4: Authentication failed**

- Verify REDIS_PASSWORD is correct
- Check Railway environment variables
- Ensure TLS is enabled for production

### 12. Performance Benchmarks

Provide expected performance metrics:

```
Throughput: 500+ jobs/second
Latency: <5ms per job add
Memory per job: ~2KB
Max queue size: 10,000 jobs (graceful degradation after)
Worker processing: 15-30ms per job
```

## Deliverables

Please provide:

1. ✅ Complete Railway Redis setup guide (step-by-step)
2. ✅ Redis configuration files
3. ✅ Bull Queue configuration code
4. ✅ Connection configuration for all services
5. ✅ Rate limiting implementation
6. ✅ Health check implementation
7. ✅ Environment variable template
8. ✅ Monitoring setup (Bull Board)
9. ✅ Troubleshooting guide
10. ✅ Performance tuning recommendations

## Success Criteria

The Redis setup should:

- ✅ Connect successfully from Railway services
- ✅ Handle 12,000+ jobs/day reliably
- ✅ Provide queue monitoring UI
- ✅ Implement rate limiting correctly
- ✅ Have automatic backups enabled
- ✅ Include health checks
- ✅ Be production-ready with proper configuration

## Notes

- Focus on Railway-specific setup (internal networking, environment variables)
- Reference architecture document for queue structure
- Include monitoring from observability guide
- Provide both configuration and implementation code
- Keep setup simple but production-ready

Please provide a complete Redis setup guide for Railway deployment.
