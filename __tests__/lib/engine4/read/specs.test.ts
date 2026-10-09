/**
 * @jest-environment node
 */

/**
 * The reader of `symbol_specs` (build step 5, part 3). The row is a TEST ROW,
 * not a claim about any broker's contract.
 */

import { Engine4InputError } from '@/lib/engine4';
import type { SymbolSpecRow } from '@/lib/engine4';
import { readNewestBrokerFigures } from '@/lib/engine4/read/specs';
import type { SpecsClient } from '@/lib/engine4/read/specs';

// The reader imports the database client at load time; no test here touches it.
jest.mock('@/lib/db/market-prisma', () => ({ marketPrisma: {} }));

const NOW = 1_790_000_000;
const DAY = 86_400;

const ROW: SymbolSpecRow = {
  symbol: 'XAUUSD',
  version: 4,
  captured_at: NOW - DAY,
  contract_size: 100,
  volume_min: 0.01,
  volume_step: 0.01,
  volume_max: 100,
  tick_size: 0.01,
  typical_spread: 25,
  swap_long: -66.5,
  swap_short: 34.2,
  point: 0.01,
  digits: 2,
  swap_mode: 1,
};

function client(answer: () => Promise<SymbolSpecRow | null>) {
  const calls: unknown[] = [];
  const fake: SpecsClient = {
    symbolSpec: {
      findFirst: async (args) => {
        calls.push(args);
        return answer();
      },
    },
  };
  return { fake, calls };
}

describe('readNewestBrokerFigures', () => {
  test('asks for the newest row of the symbol, by capture time then version', async () => {
    const { fake, calls } = client(async () => ROW);
    await readNewestBrokerFigures({ nowSeconds: NOW }, fake);
    expect(calls).toEqual([
      {
        where: { symbol: 'XAUUSD' },
        orderBy: [{ captured_at: 'desc' }, { version: 'desc' }],
        select: {
          symbol: true,
          version: true,
          captured_at: true,
          contract_size: true,
          volume_min: true,
          volume_step: true,
          volume_max: true,
          tick_size: true,
          typical_spread: true,
          swap_long: true,
          swap_short: true,
          point: true,
          digits: true,
          swap_mode: true,
        },
      },
    ]);
  });

  test('asks for another symbol when told to', async () => {
    const { fake, calls } = client(async () => null);
    await readNewestBrokerFigures({ nowSeconds: NOW, symbol: 'EURUSD' }, fake);
    expect((calls[0] as { where: unknown }).where).toEqual({
      symbol: 'EURUSD',
    });
  });

  test('a current row gives its figures and version', async () => {
    const { fake } = client(async () => ROW);
    const result = await readNewestBrokerFigures({ nowSeconds: NOW }, fake);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.figures.version).toBe(4n);
      expect(result.figures.spec.contractSize).toBe('100');
    }
  });

  test('a row older than 7 days is stale', async () => {
    const { fake } = client(async () => ({
      ...ROW,
      captured_at: NOW - 8 * DAY,
    }));
    const result = await readNewestBrokerFigures({ nowSeconds: NOW }, fake);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('SPECS_STALE');
  });

  test('no row is NO_SPECS', async () => {
    const { fake } = client(async () => null);
    const result = await readNewestBrokerFigures({ nowSeconds: NOW }, fake);
    expect(result).toMatchObject({ ok: false, code: 'NO_SPECS' });
  });

  test('a database error is reported, not thrown', async () => {
    const { fake } = client(async () => {
      throw new Error('connection refused');
    });
    const result = await readNewestBrokerFigures({ nowSeconds: NOW }, fake);
    expect(result).toEqual({
      ok: false,
      code: 'DATABASE_ERROR',
      detail: 'the symbol_specs row could not be read: connection refused',
      version: null,
      capturedAt: null,
      ageSeconds: null,
    });
  });

  test('a rejection that is not an Error is still reported', async () => {
    const { fake } = client(() => Promise.reject('down'));
    const result = await readNewestBrokerFigures({ nowSeconds: NOW }, fake);
    expect(result).toMatchObject({ ok: false, code: 'DATABASE_ERROR' });
    if (!result.ok) expect(result.detail).toContain('unknown error');
  });

  test('a bad clock is refused before any query', async () => {
    const { fake, calls } = client(async () => ROW);
    await expect(
      readNewestBrokerFigures({ nowSeconds: 0 }, fake)
    ).rejects.toBeInstanceOf(Engine4InputError);
    expect(calls).toEqual([]);
  });
});
