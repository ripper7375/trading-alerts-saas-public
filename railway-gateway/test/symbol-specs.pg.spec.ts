/**
 * The symbol-specs processor and reader against a REAL Postgres.
 *
 * The other specs use an in-memory stand-in for Prisma, which proves the logic
 * but not what the real thing does at the edges the logic leans on: that a
 * unique violation reaches the processor as code P2002 through the driver
 * adapter, that two writers racing for a version really lose one of them, that
 * a Float column returns the number that went in, and that an Int column really
 * is 32 bits (the contract's `maximum` rests on it).
 *
 * SKIPPED unless BOTH are set (the same gate as cycle-readers.pg.spec.ts):
 *   CYCLE_PG_URL         a postgres URL on localhost or 127.0.0.1 (anything else is refused)
 *   CYCLE_PG_ALLOW_WIPE  "yes": it DELETES every row of symbol_specs in that database
 *
 * To run it without Docker, on a throwaway database, see the header of
 * cycle-readers.pg.spec.ts and database-traps.md: an embedded Postgres from
 * `npx prisma dev --detach`, the tables created from the gateway's own schema.
 */
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { PrismaService } from '../src/prisma/prisma.service';
import { SymbolSpecDto } from '../src/gateway/dto/symbol-spec.dto';
import { SymbolSpecsProcessor } from '../src/worker/symbol-specs.processor';
import { SymbolSpecsService } from '../src/symbol-specs/symbol-specs.service';

const URL = process.env['CYCLE_PG_URL'] ?? '';
const enabled = URL !== '' && process.env['CYCLE_PG_ALLOW_WIPE'] === 'yes';
if (
  enabled &&
  !/^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1):\d+\//.test(URL)
) {
  throw new Error('CYCLE_PG_URL must point at localhost or 127.0.0.1');
}
const suite = enabled ? describe : describe.skip;

const T0 = 1789000000;
const DAY = 86400;

function spec(overrides: Partial<SymbolSpecDto> = {}): SymbolSpecDto {
  return {
    terminal_id: 'MT5-A',
    symbol: 'XAUUSD',
    captured_at: T0,
    contract_size: 100,
    volume_min: 0.01,
    volume_step: 0.01,
    volume_max: 100,
    tick_size: 0.01,
    typical_spread: 17.5,
    swap_long: -25.3,
    swap_short: 0,
    point: 0.01,
    digits: 2,
    swap_mode: 1,
    ...overrides,
  };
}

const jobOf = (data: SymbolSpecDto) =>
  ({
    name: 'process',
    id: `${data.symbol}_${data.captured_at}`,
    data,
  }) as unknown as Job<SymbolSpecDto>;

suite('symbol specs on a real Postgres', () => {
  let prisma: PrismaService;
  let processor: SymbolSpecsProcessor;
  let reader: SymbolSpecsService;

  beforeAll(async () => {
    process.env['DATABASE_URL'] = URL;
    prisma = new PrismaService();
    await prisma.$connect();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    await prisma.$executeRawUnsafe('DELETE FROM symbol_specs');
    processor = new SymbolSpecsProcessor(prisma);
    reader = new SymbolSpecsService(prisma);
  });
  afterEach(() => jest.restoreAllMocks());

  const rows = () =>
    prisma.symbolSpec.findMany({
      orderBy: { version: 'asc' },
      select: { symbol: true, version: true, captured_at: true },
    });

  it('numbers observations 1, 2, 3 and the reader returns the newest', async () => {
    for (let i = 0; i < 3; i++) {
      await expect(
        processor.process(jobOf(spec({ captured_at: T0 + i * DAY })))
      ).resolves.toEqual({ outcome: 'RECORDED', version: i + 1 });
    }
    expect(await rows()).toEqual([
      { symbol: 'XAUUSD', version: 1, captured_at: T0 },
      { symbol: 'XAUUSD', version: 2, captured_at: T0 + DAY },
      { symbol: 'XAUUSD', version: 3, captured_at: T0 + 2 * DAY },
    ]);
    await expect(reader.getLatestSymbolSpec('XAUUSD')).resolves.toMatchObject({
      version: 3,
      captured_at: T0 + 2 * DAY,
    });
  });

  it('numbers each symbol on its own', async () => {
    await processor.process(jobOf(spec({ captured_at: T0 })));
    await processor.process(jobOf(spec({ captured_at: T0 + 1 })));
    const other = await processor.process(
      jobOf(spec({ symbol: 'XAUUSD.i', captured_at: T0 }))
    );
    expect(other).toEqual({ outcome: 'RECORDED', version: 1 });
  });

  it('absorbs a replay, with its version, and writes nothing', async () => {
    await processor.process(jobOf(spec()));
    await expect(processor.process(jobOf(spec()))).resolves.toEqual({
      outcome: 'DUPLICATE',
      version: 1,
    });
    expect(await rows()).toHaveLength(1);
  });

  it('a late older observation takes the next version but is not the latest', async () => {
    await processor.process(jobOf(spec({ captured_at: T0 + DAY })));
    await expect(
      processor.process(jobOf(spec({ captured_at: T0 })))
    ).resolves.toEqual({ outcome: 'RECORDED', version: 2 });
    await expect(reader.getLatestSymbolSpec('XAUUSD')).resolves.toMatchObject({
      version: 1,
      captured_at: T0 + DAY,
    });
  });

  it('returns every figure exactly as it went in (Float is double precision)', async () => {
    const sent = spec({
      contract_size: 100,
      volume_min: 0.01,
      volume_step: 0.001,
      volume_max: 250.5,
      tick_size: 0.001,
      typical_spread: 17.5,
      swap_long: -25.3,
      swap_short: 8.1,
      point: 0.001,
      digits: 3,
      swap_mode: 6,
    });
    await processor.process(jobOf(sent));
    const stored = await reader.getLatestSymbolSpec('XAUUSD');
    expect(stored).toMatchObject(sent);
  });

  it('keeps a real zero a zero', async () => {
    await processor.process(
      jobOf(spec({ swap_long: 0, swap_short: 0, typical_spread: 0 }))
    );
    await expect(reader.getLatestSymbolSpec('XAUUSD')).resolves.toMatchObject({
      swap_long: 0,
      swap_short: 0,
      typical_spread: 0,
    });
  });

  it('an INTEGER column holds 2147483647 and refuses 2147483648: the contract bound is the real one', async () => {
    await expect(
      processor.process(jobOf(spec({ captured_at: 2147483647 })))
    ).resolves.toMatchObject({ outcome: 'RECORDED' });
    await expect(
      processor.process(jobOf(spec({ captured_at: 2147483648 })))
    ).rejects.toBeDefined();
    expect(await rows()).toHaveLength(1);
  });

  describe('the unique constraints, as the driver reports them', () => {
    it('a second row for the same (symbol, version) is refused with P2002', async () => {
      await processor.process(jobOf(spec({ captured_at: T0 })));
      const clash = prisma.symbolSpec.create({
        data: { ...spec({ captured_at: T0 + 1 }), version: 1 },
      });
      await expect(clash).rejects.toMatchObject({ code: 'P2002' });
    });

    it('a second row for the same (symbol, captured_at) is refused with P2002', async () => {
      await processor.process(jobOf(spec({ captured_at: T0 })));
      const clash = prisma.symbolSpec.create({
        data: { ...spec({ captured_at: T0 }), version: 2 },
      });
      await expect(clash).rejects.toMatchObject({ code: 'P2002' });
    });
  });

  // Two gateway instances are what a race means here (the real gateway runs one
  // job at a time on one instance). The embedded Postgres behind `prisma dev`
  // closes connections (P1017) under many parallel writers, which is that
  // engine and not this code, so the races below use two.
  describe('two writers that race', () => {
    it('the same observation at once: one is recorded, the other is a duplicate, neither fails', async () => {
      for (let round = 1; round <= 5; round++) {
        const job = jobOf(spec({ captured_at: T0 + round * DAY }));
        const results = await Promise.all([
          processor.process(job),
          processor.process(job),
        ]);
        expect(results.map((r) => r.outcome).sort()).toEqual([
          'DUPLICATE',
          'RECORDED',
        ]);
        expect(results.every((r) => r.version === round)).toBe(true);
      }
      expect(await rows()).toHaveLength(5);
    });

    it('different observations at once: a loser throws P2002 and its retry succeeds; versions end up 1..n with no repeat', async () => {
      // One instance: its jobs one after another, each retried as Bull would
      // when it fails. The only failure a race may produce is the unique
      // violation, and it must reach the caller in that shape.
      const instance = async (jobs: Job<SymbolSpecDto>[]) => {
        for (const job of jobs) {
          for (let attempt = 1; ; attempt++) {
            try {
              await processor.process(job);
              break;
            } catch (error) {
              expect(error).toMatchObject({ code: 'P2002' });
              if (attempt === 8) throw error;
            }
          }
        }
      };
      const n = 8;
      const jobs = Array.from({ length: n }, (_, i) =>
        jobOf(spec({ captured_at: T0 + i * 300 }))
      );
      await Promise.all([
        instance(jobs.filter((_, i) => i % 2 === 0)),
        instance(jobs.filter((_, i) => i % 2 === 1)),
      ]);

      const stored = await rows();
      expect(stored.map((r) => r.version)).toEqual(
        Array.from({ length: n }, (_, i) => i + 1)
      );
      expect(new Set(stored.map((r) => r.captured_at)).size).toBe(n);
    });
  });
});
