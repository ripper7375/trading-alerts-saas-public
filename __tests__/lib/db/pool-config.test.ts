/**
 * @jest-environment node
 *
 * The pg pool bounds of both Prisma singletons (Next.js remediation T1-d).
 *
 * `@prisma/adapter-pg` and both generated clients are replaced by factories:
 * what is tested is what this code asks of them. The adapter is built only
 * when no client is cached on globalThis, so a dev hot reload does not make a
 * new one.
 */

const mockAdapterConfigs: Array<Record<string, unknown>> = [];
const mockClientOptions: Array<Record<string, unknown>> = [];

jest.mock('@prisma/adapter-pg', () => ({
  __esModule: true,
  PrismaPg: function MockPrismaPg(config: Record<string, unknown>) {
    mockAdapterConfigs.push(config);
    return { kind: 'adapter', config };
  },
}));
jest.mock('.prisma/non-market-client', () => ({
  __esModule: true,
  PrismaClient: function MockPrismaClient(options: Record<string, unknown>) {
    mockClientOptions.push(options);
    return { kind: 'client' };
  },
}));
jest.mock('.prisma/market-client', () => ({
  __esModule: true,
  PrismaClient: function MockMarketClient(options: Record<string, unknown>) {
    mockClientOptions.push(options);
    return { kind: 'market-client' };
  },
}));

const globals = globalThis as unknown as {
  prisma?: unknown;
  marketPrisma?: unknown;
};
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  mockAdapterConfigs.length = 0;
  mockClientOptions.length = 0;
  delete globals.prisma;
  delete globals.marketPrisma;
  jest.resetModules();
  process.env['DATABASE_URL'] = 'postgresql://u:p@pooler.example:6543/db';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete globals.prisma;
  delete globals.marketPrisma;
});

const POOL = {
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
  max: 5,
};

describe.each([
  ['lib/db/prisma', () => import('@/lib/db/prisma'), 'prisma'],
  [
    'lib/db/market-prisma',
    () => import('@/lib/db/market-prisma'),
    'marketPrisma',
  ],
] as const)('%s', (_name, load, exportName) => {
  it('bounds the pool: 5 s to get a connection, 30 s idle, at most 5', async () => {
    await load();

    expect(mockAdapterConfigs).toHaveLength(1);
    expect(mockAdapterConfigs[0]).toMatchObject(POOL);
  });

  it('keeps the connection string and the TLS setting it had', async () => {
    await load();

    expect(mockAdapterConfigs[0]).toMatchObject({
      connectionString: 'postgresql://u:p@pooler.example:6543/db',
      ssl: { rejectUnauthorized: false },
    });
  });

  it('hands that adapter to the client, with the logging it had', async () => {
    await load();

    expect(mockClientOptions).toHaveLength(1);
    expect(mockClientOptions[0]).toMatchObject({
      adapter: { kind: 'adapter' },
      log: expect.any(Array),
    });
  });

  it('builds the client at import time, as before (no lazy Proxy)', async () => {
    const loaded = (await load()) as Record<string, unknown>;

    expect(loaded[exportName]).toBeDefined();
    expect(mockClientOptions).toHaveLength(1);
  });

  it('builds no new adapter when a client is already cached on globalThis (dev hot reload)', async () => {
    process.env['NODE_ENV'] = 'development';
    const first = (await load()) as Record<string, unknown>;
    expect(mockAdapterConfigs).toHaveLength(1);

    jest.resetModules();
    const second = (await load()) as Record<string, unknown>;

    expect(second[exportName]).toBe(first[exportName]);
    expect(mockAdapterConfigs).toHaveLength(1);
    expect(mockClientOptions).toHaveLength(1);
  });

  it('caches nothing on globalThis in production', async () => {
    process.env['NODE_ENV'] = 'production';
    await load();

    expect(globals[exportName]).toBeUndefined();
  });
});
