import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { SymbolSpecsService } from '../src/symbol-specs/symbol-specs.service';
import { SymbolSpecsModule } from '../src/symbol-specs/symbol-specs.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * SymbolSpecsService.getLatestSymbolSpec (ADR-066, section 6.9): what Engine 4
 * will read, and the version it will put in the consent record.
 *
 * The store orders and filters the way the query asks, so a wrong query (the
 * wrong sort key, no symbol filter) returns the wrong row here rather than
 * passing on a mock that returns whatever it was told.
 */

interface Row {
  symbol: string;
  version: number;
  captured_at: number;
  contract_size: number;
}

type OrderBy = Array<{
  captured_at?: 'asc' | 'desc';
  version?: 'asc' | 'desc';
}>;

function store(rows: Row[]) {
  const findFirst = jest.fn(
    async (args: { where: { symbol: string }; orderBy: OrderBy }) => {
      const matching = rows.filter((r) => r.symbol === args.where.symbol);
      const sorted = [...matching].sort((a, b) => {
        for (const key of args.orderBy) {
          for (const field of ['captured_at', 'version'] as const) {
            const dir = key[field];
            if (!dir) continue;
            const delta = a[field] - b[field];
            if (delta !== 0) return dir === 'asc' ? delta : -delta;
          }
        }
        return 0;
      });
      return sorted[0] ?? null;
    }
  );
  return { findFirst };
}

function serviceOver(rows: Row[]) {
  const symbolSpec = store(rows);
  const service = new SymbolSpecsService({
    symbolSpec,
  } as unknown as PrismaService);
  return { service, symbolSpec };
}

const row = (symbol: string, version: number, captured_at: number): Row => ({
  symbol,
  version,
  captured_at,
  contract_size: 100 + version,
});

describe('getLatestSymbolSpec', () => {
  it('returns null when nothing was ever recorded for the symbol', async () => {
    const { service } = serviceOver([]);
    await expect(service.getLatestSymbolSpec('XAUUSD')).resolves.toBeNull();
  });

  it('returns the only row there is', async () => {
    const { service } = serviceOver([row('XAUUSD', 1, 1000)]);
    await expect(service.getLatestSymbolSpec('XAUUSD')).resolves.toMatchObject({
      version: 1,
    });
  });

  it('returns the newest observation, which is also the highest version in the usual order', async () => {
    const { service } = serviceOver([
      row('XAUUSD', 1, 1000),
      row('XAUUSD', 2, 2000),
      row('XAUUSD', 3, 3000),
    ]);
    await expect(service.getLatestSymbolSpec('XAUUSD')).resolves.toMatchObject({
      version: 3,
      captured_at: 3000,
    });
  });

  it('decides by captured_at, NOT by version: a late older observation is not the latest', async () => {
    const { service } = serviceOver([
      row('XAUUSD', 1, 3000),
      row('XAUUSD', 2, 1000), // recorded later, observed earlier
    ]);
    await expect(service.getLatestSymbolSpec('XAUUSD')).resolves.toMatchObject({
      version: 1,
      captured_at: 3000,
    });
  });

  it('breaks a tie on captured_at by the higher version', async () => {
    const { service } = serviceOver([
      row('XAUUSD', 4, 5000),
      row('XAUUSD', 5, 5000),
      row('XAUUSD', 3, 5000),
    ]);
    await expect(service.getLatestSymbolSpec('XAUUSD')).resolves.toMatchObject({
      version: 5,
    });
  });

  it('only looks at the symbol asked for', async () => {
    const { service, symbolSpec } = serviceOver([
      row('XAUUSD', 1, 1000),
      row('XAGUSD', 1, 9000),
    ]);
    await expect(service.getLatestSymbolSpec('XAUUSD')).resolves.toMatchObject({
      symbol: 'XAUUSD',
      captured_at: 1000,
    });
    await expect(service.getLatestSymbolSpec('EURUSD')).resolves.toBeNull();
    expect(symbolSpec.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { symbol: 'XAUUSD' } })
    );
  });

  it('asks for the newest capture first, then the highest version', async () => {
    const { service, symbolSpec } = serviceOver([]);
    await service.getLatestSymbolSpec('XAUUSD');
    expect(symbolSpec.findFirst).toHaveBeenCalledWith({
      where: { symbol: 'XAUUSD' },
      orderBy: [{ captured_at: 'desc' }, { version: 'desc' }],
    });
  });

  it('does not judge staleness: a year-old row is returned as it is', async () => {
    const { service } = serviceOver([row('XAUUSD', 1, 1)]);
    await expect(service.getLatestSymbolSpec('XAUUSD')).resolves.toMatchObject({
      captured_at: 1,
    });
  });

  it('passes a database error on to the caller', async () => {
    const symbolSpec = {
      findFirst: jest.fn().mockRejectedValue(new Error('db down')),
    };
    const service = new SymbolSpecsService({
      symbolSpec,
    } as unknown as PrismaService);
    await expect(service.getLatestSymbolSpec('XAUUSD')).rejects.toThrow(
      'db down'
    );
  });
});

describe('SymbolSpecsModule', () => {
  it('provides and exports the service', async () => {
    const symbolSpec = store([row('XAUUSD', 1, 1000)]);
    // PrismaModule is global in the app, which is how the module finds its
    // database; here its service is replaced so nothing connects.
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, SymbolSpecsModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ symbolSpec })
      .compile();
    const service = moduleRef.get(SymbolSpecsService);
    await expect(service.getLatestSymbolSpec('XAUUSD')).resolves.toMatchObject({
      version: 1,
    });
    const exported: unknown[] =
      Reflect.getMetadata('exports', SymbolSpecsModule) ?? [];
    expect(exported).toContain(SymbolSpecsService);
  });
});
