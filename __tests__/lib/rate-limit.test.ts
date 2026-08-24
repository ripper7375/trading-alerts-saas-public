import {
  checkRateLimit,
  checkAuthRateLimit,
  checkTierRateLimit,
  getRateLimitHeaders,
  trackAiTokenUsage,
  AUTH_RATE_LIMIT_CONFIG,
  TIER_RATE_LIMIT_CONFIGS,
} from '@/lib/rate-limit';

// Mock the Redis client
jest.mock('@/lib/redis/client', () => {
  // Create a store to track rate limit counts
  const store: Record<string, number[]> = {};
  // Separate namespace for trackAiTokenUsage's incrby/ttl/expire counters
  const counters: Record<string, number> = {};
  const expiries: Record<string, number> = {};

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

  const incrby = async (key: string, amount: number) => {
    counters[key] = (counters[key] || 0) + amount;
    return counters[key];
  };
  const ttl = async (key: string) => expiries[key] ?? -1;
  const expire = async (key: string, seconds: number) => {
    expiries[key] = seconds;
    return 1;
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
      incrby,
      ttl,
      expire,
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
      incrby,
      ttl,
      expire,
    },
    __aiTokenExpiries: expiries,
  };
});

const { __aiTokenExpiries } = jest.requireMock('@/lib/redis/client') as {
  __aiTokenExpiries: Record<string, number>;
};

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

  describe('trackAiTokenUsage', () => {
    it('allows usage under quota and returns correct remaining balance', async () => {
      const result = await trackAiTokenUsage(
        'ai-token-user-under',
        100_000,
        500_000
      );

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(500_000);
      expect(result.currentUsage).toBe(100_000);
      expect(result.remaining).toBe(400_000);
    });

    it('accumulates usage across multiple calls for the same user/month', async () => {
      const userId = 'ai-token-user-cumulative';
      await trackAiTokenUsage(userId, 200_000, 500_000);
      const result = await trackAiTokenUsage(userId, 150_000, 500_000);

      expect(result.currentUsage).toBe(350_000);
      expect(result.remaining).toBe(150_000);
      expect(result.allowed).toBe(true);
    });

    it('blocks usage once cumulative tokens reach the quota (>= quota -> 429 territory)', async () => {
      const result = await trackAiTokenUsage(
        'ai-token-user-at-quota',
        500_000,
        500_000
      );

      expect(result.allowed).toBe(false);
      expect(result.currentUsage).toBe(500_000);
      expect(result.remaining).toBe(0);
    });

    it('blocks usage that overshoots the quota in a single call', async () => {
      const result = await trackAiTokenUsage(
        'ai-token-user-over',
        600_000,
        500_000
      );

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('always blocks a 0 monthly quota (FREE tier)', async () => {
      const result = await trackAiTokenUsage('ai-token-user-free', 1, 0);

      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(0);
    });

    it('sets a 35-day TTL on the key on first write', async () => {
      const userId = 'ai-token-user-ttl';
      const yearMonth = new Date().toISOString().slice(0, 7);
      const key = `ratelimit:ai_tokens:${userId}:${yearMonth}`;

      await trackAiTokenUsage(userId, 1_000, 500_000);

      expect(__aiTokenExpiries[key]).toBe(35 * 24 * 60 * 60);
    });

    it('does not reset the TTL on a subsequent write to the same key', async () => {
      const userId = 'ai-token-user-ttl-stable';
      const yearMonth = new Date().toISOString().slice(0, 7);
      const key = `ratelimit:ai_tokens:${userId}:${yearMonth}`;

      await trackAiTokenUsage(userId, 1_000, 500_000);
      __aiTokenExpiries[key] = 42; // simulate time having passed since first write
      await trackAiTokenUsage(userId, 1_000, 500_000);

      // A real TTL only counts down in Redis itself (this mock can't simulate
      // that) -- what matters is trackAiTokenUsage's own ttl()===-1 check
      // does not fire again once a TTL is already set, so it must not
      // overwrite the mock's stand-in value back to the full 35 days.
      expect(__aiTokenExpiries[key]).toBe(42);
    });

    it('keys usage per user, not globally', async () => {
      await trackAiTokenUsage('ai-token-user-a', 300_000, 500_000);
      const resultB = await trackAiTokenUsage(
        'ai-token-user-b',
        50_000,
        500_000
      );

      expect(resultB.currentUsage).toBe(50_000);
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
