import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis, { type RedisOptions } from 'ioredis';

// Session 4B-2: shared Redis provider for the alert-engine module (dispatcher
// publish, state-store ops connections). Same connection options as the
// monolith's lib/redis/client.ts singleton (getRedisClient) — retry/backoff,
// lazy connect — so operation-service's Redis behavior matches the ported
// code's original assumptions. This is distinct from AlertWorkerService's
// own two DEDICATED connections (subscriber + ops, File 12) — pub/sub mode
// can't run normal commands on the same connection, matching the source's
// own `worker.ts` topology exactly; this shared client is for the
// non-pub/sub uses (dispatcher publish, alert-queue's BullMQ connections
// build their own from REDIS_URL directly, matching source).
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
