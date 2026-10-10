/**
 * @jest-environment node
 */

/**
 * The reader of the closed M5 bars of the last 24 hours (build step 5, part 6;
 * architecture 3.6 and 6.10 check 0, plan assumption A3). `timestamp` is the bar's OPEN
 * time; the reader asks for the bars that opened from 24 hours ago up to five minutes
 * ago, and `dayRange` applies the same edges again.
 */

import { Engine4InputError, checkEntryBound, dayRange } from '@/lib/engine4';
import { readClosedM5Bars } from '@/lib/engine4/read/bars';
import type { BarsClient } from '@/lib/engine4/read/bars';

// The reader imports the database client at load time; no test here touches it.
jest.mock('@/lib/db/market-prisma', () => ({ marketPrisma: {} }));

const NOW = 1_789_764_900 + 150;
const DAY = 86_400;
const M5 = 300;

type Row = { timestamp: number; high: number; low: number };

function client(answer: () => Promise<Row[]>) {
  const calls: unknown[] = [];
  const fake: BarsClient = {
    marketDataV6: {
      findMany: async (args) => {
        calls.push(args);
        return answer();
      },
    },
  };
  return { fake, calls };
}

describe('readClosedM5Bars', () => {
  test('asks for the M5 bars of the symbol that opened in the window, oldest first, three columns only', async () => {
    const { fake, calls } = client(async () => []);
    await readClosedM5Bars({ nowSeconds: NOW }, fake);
    expect(calls).toEqual([
      {
        where: {
          symbol: 'XAUUSD',
          timeframe: 'M5',
          timestamp: { gte: NOW - DAY, lte: NOW - M5 },
        },
        orderBy: { timestamp: 'asc' },
        select: { timestamp: true, high: true, low: true },
      },
    ]);
  });

  test('the window ends where a bar is exactly closed: a bar that opened five minutes ago is in, one that opened four minutes ago is not asked for', async () => {
    const { fake, calls } = client(async () => []);
    await readClosedM5Bars({ nowSeconds: NOW }, fake);
    const where = (
      calls[0] as { where: { timestamp: { gte: number; lte: number } } }
    ).where.timestamp;
    expect(where.lte).toBe(NOW - 300);
    expect(where.lte + 300).toBeLessThanOrEqual(NOW);
    expect(where.lte + 301).toBeGreaterThan(NOW);
    expect(where.gte).toBe(NOW - DAY);
  });

  test('asks for another symbol when told to', async () => {
    const { fake, calls } = client(async () => []);
    await readClosedM5Bars({ nowSeconds: NOW, symbol: 'EURUSD' }, fake);
    expect((calls[0] as { where: { symbol: string } }).where.symbol).toBe(
      'EURUSD'
    );
  });

  test('hands back each row as an open time, a high and a low', async () => {
    const { fake } = client(async () => [
      { timestamp: NOW - 600, high: 4380.5, low: 4375.25 },
      { timestamp: NOW - 300, high: 4381, low: 4376 },
    ]);
    expect(await readClosedM5Bars({ nowSeconds: NOW }, fake)).toEqual({
      ok: true,
      bars: [
        { openTime: NOW - 600, high: 4380.5, low: 4375.25 },
        { openTime: NOW - 300, high: 4381, low: 4376 },
      ],
    });
  });

  test('what it hands back is what `dayRange` makes a one-day range of', async () => {
    const { fake } = client(async () => [
      { timestamp: NOW - 7200, high: 4391.2, low: 4330 },
      { timestamp: NOW - 3600, high: 4350, low: 4318.75 },
      { timestamp: NOW - 300, high: 4380, low: 4370 },
    ]);
    const read = await readClosedM5Bars({ nowSeconds: NOW }, fake);
    if (!read.ok) throw new Error('the read failed');
    const range = dayRange(read.bars, NOW);
    expect(range.ok).toBe(true);
    if (!range.ok) return;
    expect(range.high.toString()).toBe('4391.2');
    expect(range.low.toString()).toBe('4318.75');
    expect(range.barCount).toBe(3);
    expect(checkEntryBound('4360', range, '4378.31').ok).toBe(true);
  });

  test('an empty day is an empty list, which `dayRange` turns into an UNKNOWN range', async () => {
    const { fake } = client(async () => []);
    const read = await readClosedM5Bars({ nowSeconds: NOW }, fake);
    expect(read).toEqual({ ok: true, bars: [] });
    if (!read.ok) return;
    expect(dayRange(read.bars, NOW)).toMatchObject({
      ok: false,
      code: 'NO_CLOSED_BARS',
    });
  });

  test('a bar that is not well formed makes the whole range unknown, it is not skipped', async () => {
    const { fake } = client(async () => [
      { timestamp: NOW - 600, high: 4380, low: 4370 },
      { timestamp: NOW - 300, high: Number.NaN, low: 4370 },
    ]);
    const read = await readClosedM5Bars({ nowSeconds: NOW }, fake);
    if (!read.ok) throw new Error('the read failed');
    expect(dayRange(read.bars, NOW)).toMatchObject({
      ok: false,
      code: 'BAD_BAR',
    });
  });

  test('a database error is an answer, not a throw, and says what failed', async () => {
    const { fake } = client(async () => {
      throw new Error('connection reset');
    });
    expect(await readClosedM5Bars({ nowSeconds: NOW }, fake)).toEqual({
      ok: false,
      code: 'DATABASE_ERROR',
      detail: 'the M5 bars could not be read: connection reset',
    });
  });

  test('a thrown value that is not an Error is still an answer', async () => {
    const { fake } = client(async () => {
      throw 'boom';
    });
    expect(await readClosedM5Bars({ nowSeconds: NOW }, fake)).toMatchObject({
      ok: false,
      detail: 'the M5 bars could not be read: unknown error',
    });
  });

  test.each([[0], [-1], [1.5], ['x'], [null], [undefined]])(
    'a clock of %p is refused before the database is asked',
    async (nowSeconds) => {
      const { fake, calls } = client(async () => []);
      await expect(
        readClosedM5Bars({ nowSeconds: nowSeconds as never }, fake)
      ).rejects.toBeInstanceOf(Engine4InputError);
      expect(calls).toEqual([]);
    }
  );

  test('a clock that does not fit a database integer is refused', async () => {
    const { fake, calls } = client(async () => []);
    await expect(
      readClosedM5Bars({ nowSeconds: 4_000_000_000 }, fake)
    ).rejects.toBeInstanceOf(Engine4InputError);
    expect(calls).toEqual([]);
  });

  test('says which time did not fit when the clock is too large for a database integer', async () => {
    const { fake } = client(async () => []);
    // 24 hours earlier than the clock does not fit
    await expect(
      readClosedM5Bars({ nowSeconds: 4_000_000_000 }, fake)
    ).rejects.toThrow('window start does not fit a database integer');
    // the start fits, the end of the window (five minutes before the clock) does not
    await expect(
      readClosedM5Bars({ nowSeconds: 2_147_484_647 }, fake)
    ).rejects.toThrow('window end does not fit a database integer');
    await expect(readClosedM5Bars({ nowSeconds: 0 }, fake)).rejects.toThrow(
      'nowSeconds must be greater than zero'
    );
  });

  test('accepts the clock as text and as a bigint', async () => {
    const { fake, calls } = client(async () => []);
    await readClosedM5Bars({ nowSeconds: String(NOW) }, fake);
    await readClosedM5Bars({ nowSeconds: BigInt(NOW) }, fake);
    expect(calls[0]).toEqual(calls[1]);
  });
});
