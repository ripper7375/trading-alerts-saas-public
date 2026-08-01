import { Injectable } from '@nestjs/common';
import type Redis from 'ioredis';

import { RedisService } from '../redis/redis.service';

const CACHE_KEY_PREFIX = 'money:cache:';
/** Batch size for SCAN, not a hard limit — flushPattern iterates every batch until the cursor returns to '0'. */
const SCAN_BATCH_SIZE = 100;

@Injectable()
export class CacheService {
  constructor(private readonly redisService: RedisService) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client().get(this.prefixed(key));
    if (raw === null) {
      return null;
    }
    return JSON.parse(raw) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds !== undefined) {
      await this.client().set(this.prefixed(key), serialized, 'EX', ttlSeconds);
    } else {
      await this.client().set(this.prefixed(key), serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.client().del(this.prefixed(key));
  }

  /** Seconds remaining, -1 if the key has no TTL, -2 if it doesn't exist (ioredis/Redis TTL semantics). */
  async ttl(key: string): Promise<number> {
    return this.client().ttl(this.prefixed(key));
  }

  /**
   * Deletes every key matching `pattern` (relative to this service's own
   * cache namespace — the prefix is applied automatically, do not include
   * it in `pattern`). Uses SCAN rather than KEYS: KEYS is O(N) and blocks
   * the Redis event loop for the whole keyspace, unsafe on a shared
   * production instance (F15) other services/features also depend on.
   * Returns the number of keys deleted.
   */
  async flushPattern(pattern: string): Promise<number> {
    const client = this.client();
    const keys = await this.scanKeys(client, this.prefixed(pattern));
    if (keys.length === 0) {
      return 0;
    }
    return client.del(...keys);
  }

  private prefixed(key: string): string {
    return `${CACHE_KEY_PREFIX}${key}`;
  }

  private client(): Redis {
    return this.redisService.getClient();
  }

  private async scanKeys(client: Redis, pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, batch] = await client.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        SCAN_BATCH_SIZE
      );
      keys.push(...batch);
      cursor = nextCursor;
    } while (cursor !== '0');
    return keys;
  }
}
