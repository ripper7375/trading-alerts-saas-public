import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis, { type RedisOptions } from 'ioredis';

// Session 4B-4 (F15): shared Redis provider for money-service's own general
// use (CacheService, IdempotencyStore) — matches operation-service's
// redis.service.ts connection options exactly (retry/backoff, lazy connect).
// Distinct from app.module.ts's own ThrottlerStorageRedisService client and
// BullModule's own connection block, both of which need their own
// library-specific Redis client and stay untouched (Step 2's own scope).
const REDIS_OPTIONS: RedisOptions = {
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number): number | null => {
    if (times > 10) return null;
    return Math.min(times * 500, 30000);
  },
  enableReadyCheck: true,
  lazyConnect: true,
};

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor() {
    this.client = new Redis(
      process.env['REDIS_URL'] ?? 'redis://localhost:6379',
      REDIS_OPTIONS
    );
    this.client.on('error', (error: Error) => {
      console.error('[RedisService] client error:', error.message);
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
