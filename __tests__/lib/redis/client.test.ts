/**
 * @jest-environment node
 *
 * The Redis singleton (Next.js remediation T1-d): time limits, and a client
 * that survives a dev hot reload instead of leaking a socket.
 *
 * `ioredis` is replaced by a factory that records its constructor arguments.
 */

const mockConstructions: Array<{ url: string; options: Record<string, any> }> =
  [];
const mockQuit = jest.fn().mockResolvedValue('OK');

jest.mock('ioredis', () => ({
  __esModule: true,
  default: function MockRedis(url: string, options: Record<string, any>) {
    mockConstructions.push({ url, options });
    return {
      status: 'wait',
      on: jest.fn(),
      quit: mockQuit,
      ping: jest.fn().mockResolvedValue('PONG'),
    };
  },
}));

const globals = globalThis as unknown as { redisClient?: unknown };
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  mockConstructions.length = 0;
  mockQuit.mockClear();
  delete globals.redisClient;
  jest.resetModules();
  process.env['REDIS_URL'] = 'redis://cache.example:6379';
  jest.spyOn(console, 'info').mockImplementation(() => undefined);
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete globals.redisClient;
  jest.restoreAllMocks();
});

const load = () => import('@/lib/redis/client');

describe('connection options', () => {
  it('gives the connection 5 s and a command 3 s', async () => {
    const { getRedisClient } = await load();

    getRedisClient();

    expect(mockConstructions).toHaveLength(1);
    expect(mockConstructions[0]?.url).toBe('redis://cache.example:6379');
    expect(mockConstructions[0]?.options).toMatchObject({
      connectTimeout: 5_000,
      commandTimeout: 3_000,
    });
  });

  it('keeps the offline queue on, and the lazy connect and retries it had', async () => {
    const { getRedisClient } = await load();

    getRedisClient();

    const options = mockConstructions[0]?.options ?? {};
    // enableOfflineQueue: false rejects commands while the client is still connecting
    expect(options['enableOfflineQueue']).not.toBe(false);
    expect(options).toMatchObject({
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });
    expect(options['retryStrategy'](11)).toBeNull();
    expect(options['retryStrategy'](2)).toBe(1000);
  });

  it('still throws when REDIS_URL is not set', async () => {
    delete process.env['REDIS_URL'];
    const { getRedisClient } = await load();

    expect(() => getRedisClient()).toThrow('REDIS_URL');
  });
});

describe('the singleton', () => {
  it('is made once', async () => {
    const { getRedisClient } = await load();

    expect(getRedisClient()).toBe(getRedisClient());
    expect(mockConstructions).toHaveLength(1);
  });

  it('survives a dev hot reload: the re-evaluated module finds the client on globalThis', async () => {
    const first = (await load()).getRedisClient();

    jest.resetModules();
    const second = (await load()).getRedisClient();

    expect(second).toBe(first);
    expect(mockConstructions).toHaveLength(1);
  });

  it('reports the surviving client after a hot reload, not "not_initialized"', async () => {
    (await load()).getRedisClient();

    jest.resetModules();
    const { getRedisStatus } = await load();

    expect(getRedisStatus()).toEqual({ connected: false, status: 'wait' });
  });

  it('is not cached on globalThis in production: a fresh module makes a fresh client', async () => {
    process.env['NODE_ENV'] = 'production';
    const first = (await load()).getRedisClient();
    expect(globals.redisClient).toBeUndefined();

    jest.resetModules();
    const second = (await load()).getRedisClient();

    expect(second).not.toBe(first);
    expect(mockConstructions).toHaveLength(2);
  });

  it('disconnectRedis quits the client and forgets it everywhere, so the next call makes a new one', async () => {
    const { getRedisClient, disconnectRedis, getRedisStatus } = await load();
    const first = getRedisClient();

    await disconnectRedis();

    expect(mockQuit).toHaveBeenCalledTimes(1);
    expect(globals.redisClient).toBeUndefined();
    expect(getRedisStatus()).toEqual({
      connected: false,
      status: 'not_initialized',
    });
    expect(getRedisClient()).not.toBe(first);
    expect(mockConstructions).toHaveLength(2);
  });

  it('disconnectRedis after a hot reload quits the surviving client', async () => {
    (await load()).getRedisClient();

    jest.resetModules();
    await (await load()).disconnectRedis();

    expect(mockQuit).toHaveBeenCalledTimes(1);
  });

  it('disconnectRedis with no client does nothing', async () => {
    const { disconnectRedis } = await load();

    await disconnectRedis();

    expect(mockQuit).not.toHaveBeenCalled();
  });

  it('the lazy redis export builds the client only on first use', async () => {
    const { redis } = await load();
    expect(mockConstructions).toHaveLength(0);

    await redis.ping();

    expect(mockConstructions).toHaveLength(1);
  });

  it('isRedisConnected is true on PONG and false when REDIS_URL is missing', async () => {
    const { isRedisConnected } = await load();
    expect(await isRedisConnected()).toBe(true);

    delete process.env['REDIS_URL'];
    jest.resetModules();
    delete globals.redisClient;
    const fresh = await load();
    expect(await fresh.isRedisConnected()).toBe(false);
  });
});
