import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import {
  BULL_MODULE_QUEUE,
  BULL_MODULE_QUEUE_PROCESS,
} from '@nestjs/bull/dist/bull.constants';
import { SymbolSpecsProcessor } from '../src/worker/symbol-specs.processor';
import { PrismaService } from '../src/prisma/prisma.service';
import { SymbolSpecDto } from '../src/gateway/dto/symbol-spec.dto';
import {
  SYMBOL_SPECS_JOB,
  SYMBOL_SPECS_QUEUE,
} from '../src/symbol-specs/symbol-specs.keys';

/**
 * SymbolSpecsProcessor (ADR-066): the per-symbol version, idempotency on
 * (symbol, captured_at), and what happens when something goes wrong.
 *
 * The store below behaves like the table where it matters: unique on
 * (symbol, captured_at) and on (symbol, version), refusing with Prisma's P2002.
 * It has no update, upsert or delete, so a processor that tried to edit history
 * would not run at all.
 */

interface Row {
  id: string;
  terminal_id: string;
  symbol: string;
  version: number;
  captured_at: number;
  contract_size: number;
  volume_min: number;
  volume_step: number;
  volume_max: number;
  tick_size: number;
  typical_spread: number;
  swap_long: number;
  swap_short: number;
  point: number;
  digits: number;
  swap_mode: number;
}

class UniqueViolation extends Error {
  readonly code = 'P2002';
  constructor(target: string) {
    super(`Unique constraint failed on the fields: (${target})`);
  }
}

function fakeStore() {
  const rows: Row[] = [];
  let beforeCreate: (() => void) | null = null;
  const calls = { findUnique: 0, aggregate: 0, create: 0 };

  const symbolSpec = {
    findUnique: jest.fn(
      async (args: {
        where: { symbol_captured_at: { symbol: string; captured_at: number } };
        select?: { version: true };
      }) => {
        calls.findUnique++;
        const { symbol, captured_at } = args.where.symbol_captured_at;
        const row = rows.find(
          (r) => r.symbol === symbol && r.captured_at === captured_at
        );
        return row ? { version: row.version } : null;
      }
    ),
    // Answers under the aggregate that was ASKED for, as Prisma does: a query
    // for `_min` has no `_max` in its result.
    aggregate: jest.fn(
      async (args: {
        where: { symbol: string };
        _max?: { version: true };
        _min?: { version: true };
      }) => {
        calls.aggregate++;
        const versions = rows
          .filter((r) => r.symbol === args.where.symbol)
          .map((r) => r.version);
        const result: {
          _max?: { version: number | null };
          _min?: { version: number | null };
        } = {};
        if (args._max) {
          result._max = {
            version: versions.length ? Math.max(...versions) : null,
          };
        }
        if (args._min) {
          result._min = {
            version: versions.length ? Math.min(...versions) : null,
          };
        }
        return result;
      }
    ),
    create: jest.fn(async (args: { data: Omit<Row, 'id'> }) => {
      calls.create++;
      if (beforeCreate) {
        const hook = beforeCreate;
        beforeCreate = null;
        hook();
      }
      const d = args.data;
      if (
        rows.some(
          (r) => r.symbol === d.symbol && r.captured_at === d.captured_at
        )
      ) {
        throw new UniqueViolation('symbol, captured_at');
      }
      if (rows.some((r) => r.symbol === d.symbol && r.version === d.version)) {
        throw new UniqueViolation('symbol, version');
      }
      const row = { id: `id${rows.length + 1}`, ...d };
      rows.push(row);
      return row;
    }),
  };

  return {
    rows,
    calls,
    prisma: { symbolSpec },
    /** Run `fn` once, just before the next create reaches the table (a second writer). */
    beforeNextCreate(fn: () => void) {
      beforeCreate = fn;
    },
  };
}

function spec(overrides: Partial<SymbolSpecDto> = {}): SymbolSpecDto {
  return {
    terminal_id: 'MT5-A',
    symbol: 'XAUUSD',
    captured_at: 1789000000,
    contract_size: 100,
    volume_min: 0.01,
    volume_step: 0.01,
    volume_max: 100,
    tick_size: 0.01,
    typical_spread: 18,
    swap_long: -25.3,
    swap_short: 0,
    point: 0.01,
    digits: 2,
    swap_mode: 1,
    ...overrides,
  };
}

function jobOf(data: SymbolSpecDto): Job<SymbolSpecDto> {
  return {
    name: SYMBOL_SPECS_JOB,
    id: `${data.symbol}_${data.captured_at}`,
    data,
  } as unknown as Job<SymbolSpecDto>;
}

function build() {
  const store = fakeStore();
  const processor = new SymbolSpecsProcessor(
    store.prisma as unknown as PrismaService
  );
  return { ...store, processor };
}

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('versions', () => {
  it('numbers the first observation of a symbol 1', async () => {
    const { processor, rows } = build();
    await expect(processor.process(jobOf(spec()))).resolves.toEqual({
      outcome: 'RECORDED',
      version: 1,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].version).toBe(1);
  });

  it('numbers each later observation one higher', async () => {
    const { processor, rows } = build();
    for (let i = 0; i < 5; i++) {
      const result = await processor.process(
        jobOf(spec({ captured_at: 1789000000 + i * 86400 }))
      );
      expect(result).toEqual({ outcome: 'RECORDED', version: i + 1 });
    }
    expect(rows.map((r) => r.version)).toEqual([1, 2, 3, 4, 5]);
  });

  it('numbers each symbol on its own', async () => {
    const { processor, rows } = build();
    await processor.process(
      jobOf(spec({ symbol: 'XAUUSD', captured_at: 100 }))
    );
    await processor.process(
      jobOf(spec({ symbol: 'XAUUSD', captured_at: 200 }))
    );
    const other = await processor.process(
      jobOf(spec({ symbol: 'XAUUSD.i', captured_at: 150 }))
    );
    expect(other).toEqual({ outcome: 'RECORDED', version: 1 });
    await processor.process(
      jobOf(spec({ symbol: 'XAUUSD', captured_at: 300 }))
    );
    expect(rows.map((r) => `${r.symbol}:${r.version}`)).toEqual([
      'XAUUSD:1',
      'XAUUSD:2',
      'XAUUSD.i:1',
      'XAUUSD:3',
    ]);
  });

  it('numbers by the highest version held, not by a count (a gap does not repeat a number)', async () => {
    const { processor, rows } = build();
    rows.push({ id: 'old', ...spec({ captured_at: 5 }), version: 7 });
    const result = await processor.process(jobOf(spec({ captured_at: 6 })));
    expect(result).toEqual({ outcome: 'RECORDED', version: 8 });
  });

  it('numbers in the order observations are RECORDED: a late, older one takes the next number', async () => {
    const { processor, rows } = build();
    await processor.process(jobOf(spec({ captured_at: 2000 })));
    const late = await processor.process(jobOf(spec({ captured_at: 1000 })));
    expect(late).toEqual({ outcome: 'RECORDED', version: 2 });
    expect(rows.map((r) => [r.captured_at, r.version])).toEqual([
      [2000, 1],
      [1000, 2],
    ]);
  });
});

describe('what is written', () => {
  it('writes every contract figure unchanged, plus the version', async () => {
    const { processor, prisma } = build();
    const data = spec({
      swap_long: -25.3,
      swap_short: 0,
      typical_spread: 17.5,
    });
    await processor.process(jobOf(data));
    expect(prisma.symbolSpec.create).toHaveBeenCalledTimes(1);
    expect(prisma.symbolSpec.create).toHaveBeenCalledWith({
      data: { ...data, version: 1 },
    });
  });

  it('keeps a real zero a zero', async () => {
    const { processor, rows } = build();
    await processor.process(
      jobOf(spec({ swap_long: 0, swap_short: 0, typical_spread: 0 }))
    );
    expect(rows[0].swap_long).toBe(0);
    expect(rows[0].swap_short).toBe(0);
    expect(rows[0].typical_spread).toBe(0);
  });

  it('writes nothing but the contract fields, whatever else the job carries', async () => {
    const { processor, prisma } = build();
    const polluted = {
      ...spec(),
      version: 99,
      id: 'hijack',
      createdAt: new Date(0),
      extra: 'x',
    } as unknown as SymbolSpecDto;
    await processor.process(jobOf(polluted));
    const written = (
      prisma.symbolSpec.create.mock.calls[0][0] as { data: object }
    ).data;
    expect(Object.keys(written).sort()).toEqual(
      [
        'terminal_id',
        'symbol',
        'version',
        'captured_at',
        'contract_size',
        'volume_min',
        'volume_step',
        'volume_max',
        'tick_size',
        'typical_spread',
        'swap_long',
        'swap_short',
        'point',
        'digits',
        'swap_mode',
      ].sort()
    );
    expect((written as { version: number }).version).toBe(1);
  });
});

describe('replay is idempotent', () => {
  it('absorbs a repeat of an observation, with its version, and writes nothing', async () => {
    const { processor, rows, calls } = build();
    await processor.process(jobOf(spec()));
    for (let i = 0; i < 5; i++) {
      await expect(processor.process(jobOf(spec()))).resolves.toEqual({
        outcome: 'DUPLICATE',
        version: 1,
      });
    }
    expect(rows).toHaveLength(1);
    expect(calls.create).toBe(1);
  });

  it('a repeat does not use up a version number', async () => {
    const { processor, rows } = build();
    await processor.process(jobOf(spec({ captured_at: 100 })));
    await processor.process(jobOf(spec({ captured_at: 100 })));
    await processor.process(jobOf(spec({ captured_at: 100 })));
    const next = await processor.process(jobOf(spec({ captured_at: 200 })));
    expect(next).toEqual({ outcome: 'RECORDED', version: 2 });
    expect(rows.map((r) => r.version)).toEqual([1, 2]);
  });

  it('a repeat is never an update: the first write of an observation wins', async () => {
    const { processor, rows } = build();
    await processor.process(jobOf(spec({ contract_size: 100 })));
    const result = await processor.process(
      jobOf(spec({ contract_size: 1000 }))
    );
    expect(result).toEqual({ outcome: 'DUPLICATE', version: 1 });
    expect(rows).toHaveLength(1);
    expect(rows[0].contract_size).toBe(100);
  });

  it('the same capture time on another symbol is a different observation', async () => {
    const { processor, rows } = build();
    await processor.process(jobOf(spec({ symbol: 'XAUUSD' })));
    const other = await processor.process(jobOf(spec({ symbol: 'XAGUSD' })));
    expect(other).toEqual({ outcome: 'RECORDED', version: 1 });
    expect(rows).toHaveLength(2);
  });

  it('a repeat on another terminal is still the same observation', async () => {
    const { processor, rows } = build();
    await processor.process(jobOf(spec({ terminal_id: 'MT5-A' })));
    const again = await processor.process(
      jobOf(spec({ terminal_id: 'MT5-B' }))
    );
    expect(again).toEqual({ outcome: 'DUPLICATE', version: 1 });
    expect(rows[0].terminal_id).toBe('MT5-A');
  });

  it('a replay that races the first write is a duplicate, not a failure', async () => {
    // Another job records the very observation after this one has decided it is
    // new and before it writes: the table refuses the row, and the answer is the
    // version the other job gave it.
    const { processor, rows, beforeNextCreate } = build();
    beforeNextCreate(() => {
      rows.push({ id: 'raced', ...spec(), version: 1 });
    });
    await expect(processor.process(jobOf(spec()))).resolves.toEqual({
      outcome: 'DUPLICATE',
      version: 1,
    });
    expect(rows).toHaveLength(1);
  });
});

describe('errors', () => {
  it('fails the job when another writer took the version, so Bull retries; the retry succeeds', async () => {
    const { processor, rows, beforeNextCreate } = build();
    // A different observation takes version 1 between the read and the write.
    beforeNextCreate(() => {
      rows.push({ id: 'other', ...spec({ captured_at: 5 }), version: 1 });
    });
    await expect(
      processor.process(jobOf(spec({ captured_at: 6 })))
    ).rejects.toMatchObject({ code: 'P2002' });
    // Bull's next attempt reads the new maximum.
    await expect(
      processor.process(jobOf(spec({ captured_at: 6 })))
    ).resolves.toEqual({
      outcome: 'RECORDED',
      version: 2,
    });
    expect(rows.map((r) => [r.captured_at, r.version])).toEqual([
      [5, 1],
      [6, 2],
    ]);
  });

  it('fails the job on any other database error, and records nothing', async () => {
    const { processor, rows, prisma } = build();
    prisma.symbolSpec.create.mockRejectedValueOnce(new Error('db down'));
    await expect(processor.process(jobOf(spec()))).rejects.toThrow('db down');
    expect(rows).toHaveLength(0);
  });

  it('fails the job when the lookups fail, before anything is written', async () => {
    for (const method of ['findUnique', 'aggregate'] as const) {
      const { processor, prisma } = build();
      prisma.symbolSpec[method].mockRejectedValueOnce(new Error('db down'));
      await expect(processor.process(jobOf(spec()))).rejects.toThrow('db down');
      expect(prisma.symbolSpec.create).not.toHaveBeenCalled();
    }
  });

  it('does not mistake an error without the unique-violation code for one', async () => {
    const { processor, prisma } = build();
    const error = Object.assign(new Error('boom'), { code: 'P2025' });
    prisma.symbolSpec.create.mockRejectedValueOnce(error);
    await expect(processor.process(jobOf(spec()))).rejects.toBe(error);
    // and a thrown non-object is rethrown as it is, not swallowed
    prisma.symbolSpec.create.mockRejectedValueOnce('a string');
    await expect(
      processor.process(jobOf(spec({ captured_at: 9 })))
    ).rejects.toBe('a string');
  });

  it('rethrows the unique violation itself when the observation is still absent', async () => {
    const { processor, prisma } = build();
    const violation = new UniqueViolation('symbol, version');
    prisma.symbolSpec.create.mockRejectedValueOnce(violation);
    await expect(processor.process(jobOf(spec()))).rejects.toBe(violation);
  });

  it('logs a failed job with its id and attempts', () => {
    const { processor } = build();
    const error = new Error('db down');
    processor.onFailed(
      { id: 'XAUUSD_1789000000', attemptsMade: 3 } as unknown as Job,
      error
    );
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      'Failed: XAUUSD_1789000000 after 3 attempts',
      error
    );
  });
});

describe('registration with the queue', () => {
  const proto = SymbolSpecsProcessor.prototype as unknown as Record<
    string,
    unknown
  >;

  it('handles the queue the controller enqueues on', () => {
    expect(
      Reflect.getMetadata(BULL_MODULE_QUEUE, SymbolSpecsProcessor)
    ).toEqual({ name: SYMBOL_SPECS_QUEUE });
  });

  it('registers ONE handler, named like the job the controller enqueues, with concurrency 1', () => {
    const registered = Object.getOwnPropertyNames(proto).flatMap((method) => {
      const options = Reflect.getMetadata(
        BULL_MODULE_QUEUE_PROCESS,
        proto[method] as object
      );
      return options ? [{ method, options }] : [];
    });
    expect(registered).toEqual([
      { method: 'process', options: { name: 'process', concurrency: 1 } },
    ]);
    expect(registered[0].options.name).toBe(SYMBOL_SPECS_JOB);
  });
});
