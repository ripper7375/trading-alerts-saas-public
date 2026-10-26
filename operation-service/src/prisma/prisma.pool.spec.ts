import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaService } from './prisma.service';

// The adapter is replaced by a spy constructor: this spec reads the options PrismaService hands to it
// and nothing else. Whether those options bound the wait is proved against a real server by
// prisma.pool.pg.spec.ts (gated), never by this mock.
jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn().mockImplementation(() => ({
    provider: 'postgres',
    adapterName: 'pool-options-spy',
    connect: jest.fn(),
  })),
}));

jest.setTimeout(30_000);

const PrismaPgSpy = PrismaPg as unknown as jest.Mock;

describe('PrismaService pool options', () => {
  const originalUrl = process.env['DATABASE_URL'];

  beforeEach(() => {
    PrismaPgSpy.mockClear();
    process.env['DATABASE_URL'] =
      'postgresql://user:secret@db.example:5432/app';
  });

  afterEach(() => {
    if (originalUrl === undefined) delete process.env['DATABASE_URL'];
    else process.env['DATABASE_URL'] = originalUrl;
  });

  it('hands the adapter exactly the URL, the forced TLS setting and a 2,000 ms connection timeout', () => {
    new PrismaService();

    expect(PrismaPgSpy).toHaveBeenCalledTimes(1);
    expect(PrismaPgSpy.mock.calls[0]).toEqual([
      {
        connectionString: 'postgresql://user:secret@db.example:5432/app',
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 2000,
      },
    ]);
  });

  it('leaves the pool size, idle eviction and lifetime at the driver defaults (max 10, idle 10 s)', () => {
    new PrismaService();

    const options = PrismaPgSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(options).sort()).toEqual([
      'connectionString',
      'connectionTimeoutMillis',
      'ssl',
    ]);
    for (const absent of [
      'max',
      'min',
      'idleTimeoutMillis',
      'maxLifetimeSeconds',
      'query_timeout',
      'statement_timeout',
      'idle_in_transaction_session_timeout',
    ]) {
      expect(options).not.toHaveProperty(absent);
    }
  });

  it('reads DATABASE_URL when the service is constructed', () => {
    process.env['DATABASE_URL'] = 'postgresql://other@db.example:5432/other';

    new PrismaService();

    expect(PrismaPgSpy.mock.calls[0][0]).toMatchObject({
      connectionString: 'postgresql://other@db.example:5432/other',
    });
  });
});
