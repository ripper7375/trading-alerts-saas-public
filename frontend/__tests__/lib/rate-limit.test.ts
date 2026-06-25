import {
  checkRateLimit,
  checkAuthRateLimit,
  checkTierRateLimit,
  getRateLimitHeaders,
  AUTH_RATE_LIMIT_CONFIG,
  TIER_RATE_LIMIT_CONFIGS,
} from '@/lib/rate-limit';

// Mock the Redis client
jest.mock('@/lib/redis/client', () => {
  // Create a store to track rate limit counts
  const store: Record<string, number[]> = {};

  const mockPipeline = () => {
    const operations: Array<{ op: string; args: unknown[] }> = [];

    return {
      zremrangebyscore: (key: string, min: number, max: number) => {
        operations.push({ op: 'zremrangebyscore', args: [key, min, max] });
        return mockPipeline();
      },
      zcard: (key: string) => {
        operations.push({ op: 'zcard', args: [key] });
        return mockPipeline();
      },
      zadd: (key: string, score: string, member: string) => {
        operations.push({ op: 'zadd', args: [key, score, member] });
        return mockPipeline();
      },
      expire: (key: string, seconds: number) => {
        operations.push({ op: 'expire', args: [key, seconds] });
        return mockPipeline();
      },
      exec: async () => {
        const results: Array<[Error | null, unknown]> = [];

        for (const { op, args } of operations) {
          if (op === 'zremrangebyscore') {
            const [key, , max] = args as [string, number, number];
            if (store[key]) {
              store[key] = store[key].filter((ts) => ts > max);
            }
            results.push([null, 0]);
          } else if (op === 'zcard') {
            const [key] = args as [string];
            const count = store[key]?.length || 0;
            results.push([null, count]);
          } else if (op === 'zadd') {
            const [key, score] = args as [string, string, string];
            if (!store[key]) {
              store[key] = [];
            }
            store[key].push(parseInt(score, 10));
            results.push([null, 1]);
          } else if (op === 'expire') {
            results.push([null, 1]);
          }
        }

        return results;
      },
    };
  };

  return {
    getRedisClient: () => ({
      pipeline: mockPipeline,
      zrem: async (key: string, member: string) => {
        const ts = parseInt(member, 10);
        if (store[key]) {
          const idx = store[key].indexOf(ts);
          if (idx !== -1) {
            store[key].splice(idx, 1);
          }
        }
        return 1;
      },
      del: async (key: string) => {
        delete store[key];
        return 1;
      },
    }),
    redis: {
      pipeline: mockPipeline,
      zrem: async (key: string, member: string) => {
        const ts = parseInt(member, 10);
        if (store[key]) {
          const idx = store[key].indexOf(ts);
          if (idx !== -1) {
            store[key].splice(idx, 1);
          }
        }
        return 1;
      },
      del: async (key: string) => {
        delete store[key];
        return 1;
      },
    },
  };
});

describe('Rate Limit Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Configuration', () => {
    it('AUTH_RATE_LIMIT_CONFIG has correct values', () => {
      expect(AUTH_RATE_LIMIT_CONFIG.limit).toBe(5);
      expect(AUTH_RATE_LIMIT_CONFIG.windowSeconds).toBe(15 * 60); // 15 minutes
      expect(AUTH_RATE_LIMIT_CONFIG.prefix).toBe('ratelimit:auth');
    });

    it('FREE tier rate limit config has correct values', () => {
      expect(TIER_RATE_LIMIT_CONFIGS.FREE.limit).toBe(60);
      expect(TIER_RATE_LIMIT_CONFIGS.FREE.windowSeconds).toBe(60 * 60); // 1 hour
      expect(TIER_RATE_LIMIT_CONFIGS.FREE.prefix).toBe('ratelimit:free');
    });

    it('PRO tier rate limit config has correct values', () => {
      expect(TIER_RATE_LIMIT_CONFIGS.PRO.limit).toBe(300);
      expect(TIER_RATE_LIMIT_CONFIGS.PRO.windowSeconds).toBe(60 * 60); // 1 hour
      expect(TIER_RATE_LIMIT_CONFIGS.PRO.prefix).toBe('ratelimit:pro');
    });
  });

  describe('checkRateLimit', () => {
    it('allows first request', async () => {
      const result = await checkRateLimit('test-user-1', {
        limit: 5,
        windowSeconds: 60,
        prefix: 'test',
      });

      expect(result.success).toBe(true);
      expect(result.limit).toBe(5);
      expect(result.remaining).toBeLessThanOrEqual(4);
      expect(result.reset).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('returns correct remaining count', async () => {
      const config = {
        limit: 5,
        windowSeconds: 60,
        prefix: 'test-remaining',
      };

      const result = await checkRateLimit('test-user-remaining', config);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(4); // 5 - 1 = 4
    });
  });

  describe('checkAuthRateLimit', () => {
    it('uses auth rate limit config', async () => {
      const result = await checkAuthRateLimit('auth-test-user');

      expect(result.limit).toBe(5); // Auth limit is 5
      expect(result.success).toBe(true);
    });
  });

  describe('checkTierRateLimit', () => {
    it('uses FREE tier rate limit', async () => {
      const result = await checkTierRateLimit('free-user', 'FREE');

      expect(result.limit).toBe(60); // FREE limit is 60/hour
      expect(result.success).toBe(true);
    });

    it('uses PRO tier rate limit', async () => {
      const result = await checkTierRateLimit('pro-user', 'PRO');

      expect(result.limit).toBe(300); // PRO limit is 300/hour
      expect(result.success).toBe(true);
    });
  });

  describe('getRateLimitHeaders', () => {
    it('returns correct headers', () => {
      const result = {
        success: true,
        limit: 60,
        remaining: 55,
        reset: 1704067200,
      };

      const headers = getRateLimitHeaders(result);

      expect(headers['X-RateLimit-Limit']).toBe('60');
      expect(headers['X-RateLimit-Remaining']).toBe('55');
      expect(headers['X-RateLimit-Reset']).toBe('1704067200');
    });

    it('handles zero remaining', () => {
      const result = {
        success: false,
        limit: 5,
        remaining: 0,
        reset: 1704067200,
      };

      const headers = getRateLimitHeaders(result);

      expect(headers['X-RateLimit-Remaining']).toBe('0');
    });
  });
});
