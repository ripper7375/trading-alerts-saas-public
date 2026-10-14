/**
 * @jest-environment node
 */

import { secondsOfSlot } from '@/lib/reply/contracts/intake';
import { readDayBars } from '@/lib/reply/read/day-bars';
import type { BarRow, DayBarsClient } from '@/lib/reply/read/day-bars';

import {
  M15_SECONDS,
  M5_SECONDS,
  fakeClient,
  makeWorld,
  worldFor,
} from './helpers/context-fixtures';
import type { StoredBar } from './helpers/context-fixtures';

const SLOT = '2026-09-18T20:55Z'; // a Friday
const SLOT_S = secondsOfSlot(SLOT) as number;
const at = (iso: string): number => Date.parse(iso) / 1000;

const read = (slot: string, bars: readonly StoredBar[], symbol?: string) =>
  readDayBars(
    symbol === undefined ? { slot } : { slot, symbol },
    fakeClient(bars)
  );

describe('readDayBars: the day of closed bars of a cycle', () => {
  it('returns 288 M5 and 96 M15 bars with open, high, low and close, oldest first', async () => {
    const result = await read(SLOT, worldFor(SLOT));
    if (!result.ok) throw new Error(result.detail);
    const { m5, m15 } = result.bars;
    expect(m5).toHaveLength(288);
    expect(m15).toHaveLength(96);
    for (const list of [m5, m15]) {
      for (const bar of list) {
        expect(Object.keys(bar).sort()).toEqual([
          'close',
          'high',
          'low',
          'open',
          'openTime',
        ]);
      }
    }
    expect(m5.map((b) => b.openTime)).toEqual(
      [...m5.map((b) => b.openTime)].sort((a, b) => a - b)
    );
  });

  it('ends at the last closed bar of each timeframe and starts 24 hours before its close', async () => {
    const result = await read(SLOT, worldFor(SLOT));
    if (!result.ok) throw new Error(result.detail);
    const { m5, m15 } = result.bars;
    // the M5 bar that opened at 20:50 closed at 20:55; the M15 bar that opened at 20:30 closed at 20:45
    expect(m5[m5.length - 1]?.openTime).toBe(SLOT_S - M5_SECONDS);
    expect(m5[0]?.openTime).toBe(SLOT_S - M5_SECONDS - 287 * M5_SECONDS);
    expect(m15[m15.length - 1]?.openTime).toBe(at('2026-09-18T20:30:00Z'));
    expect(m15[0]?.openTime).toBe(
      at('2026-09-18T20:30:00Z') - 95 * M15_SECONDS
    );
  });

  it('carries the values of the stored rows unchanged', async () => {
    const world = worldFor(SLOT);
    const result = await read(SLOT, world);
    if (!result.ok) throw new Error(result.detail);
    const stored = new Map(
      world.filter((b) => b.timeframe === 'M5').map((b) => [b.timestamp, b])
    );
    for (const bar of result.bars.m5) {
      const row = stored.get(bar.openTime) as StoredBar;
      expect([bar.open, bar.high, bar.low, bar.close]).toEqual([
        row.open,
        row.high,
        row.low,
        row.close,
      ]);
    }
  });

  it('says which symbol and which cycle it read', async () => {
    const result = await read(SLOT, worldFor(SLOT));
    if (!result.ok) throw new Error(result.detail);
    expect(result.bars.symbol).toBe('XAUUSD');
    expect(result.bars.slotSeconds).toBe(SLOT_S);
  });

  describe('closed bars only, and nothing later than the cycle (point in time)', () => {
    it('leaves out the bar that is forming at the slot and every bar after it', async () => {
      const world = worldFor(SLOT);
      // the world holds bars that opened at and after the slot: they exist, and are not read
      expect(
        world.some((b) => b.timeframe === 'M5' && b.timestamp === SLOT_S)
      ).toBe(true);
      expect(
        world.some((b) => b.timeframe === 'M5' && b.timestamp > SLOT_S)
      ).toBe(true);
      expect(
        world.some(
          (b) =>
            b.timeframe === 'M15' && b.timestamp === at('2026-09-18T20:45:00Z')
        )
      ).toBe(true);
      const result = await read(SLOT, world);
      if (!result.ok) throw new Error(result.detail);
      for (const bar of result.bars.m5)
        expect(bar.openTime + M5_SECONDS).toBeLessThanOrEqual(SLOT_S);
      for (const bar of result.bars.m15)
        expect(bar.openTime + M15_SECONDS).toBeLessThanOrEqual(SLOT_S);
    });

    it('reads the same bars whether or not later bars exist', async () => {
      const full = worldFor(SLOT);
      const cut = full.filter((b) => b.timestamp < SLOT_S);
      expect(cut.length).toBeLessThan(full.length);
      const a = await read(SLOT, full);
      const b = await read(SLOT, cut);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    it('reads an earlier cycle as it was then: five minutes earlier ends five minutes earlier', async () => {
      const world = worldFor(SLOT);
      const now = await read(SLOT, world);
      const before = await read('2026-09-18T20:50Z', world);
      if (!now.ok || !before.ok) throw new Error('read failed');
      expect(before.bars.m5[before.bars.m5.length - 1]?.openTime).toBe(
        SLOT_S - 2 * M5_SECONDS
      );
      expect(before.bars.m5).toHaveLength(288);
      expect(before.bars.m5.slice(-1)[0]).toEqual(
        now.bars.m5[now.bars.m5.length - 2]
      );
    });

    it('a bar closes exactly at its close time: at slot 21:00 the 20:45 M15 bar is read, at 20:55 it is not', async () => {
      const world = worldFor('2026-09-18T21:00Z');
      const early = await read('2026-09-18T20:55Z', world);
      const onTime = await read('2026-09-18T21:00Z', world);
      if (!early.ok || !onTime.ok) throw new Error('read failed');
      expect(early.bars.m15.slice(-1)[0]?.openTime).toBe(
        at('2026-09-18T20:30:00Z')
      );
      expect(onTime.bars.m15.slice(-1)[0]?.openTime).toBe(
        at('2026-09-18T20:45:00Z')
      );
    });
  });

  describe('gaps', () => {
    it('shows the real count when the window has a market break: nothing is padded', async () => {
      const breakStart = at('2026-09-17T21:00:00Z');
      const world = worldFor(SLOT, { skip: [[breakStart, breakStart + 3600]] });
      const result = await read(SLOT, world);
      if (!result.ok) throw new Error(result.detail);
      expect(result.bars.m5).toHaveLength(288 - 12);
      expect(result.bars.m15).toHaveLength(96 - 4);
      // the window is still 24 hours long: it starts where it would have started
      expect(result.bars.m5[0]?.openTime).toBe(
        SLOT_S - M5_SECONDS - 287 * M5_SECONDS
      );
    });

    it("on a weekend reads the last day that traded: Friday's last bars", async () => {
      const friday = at('2026-09-18T21:00:00Z');
      const sundayOpen = at('2026-09-20T22:00:00Z');
      const world = worldFor('2026-09-19T10:00Z', {
        skip: [[friday, sundayOpen]],
      });
      const result = await read('2026-09-19T10:00Z', world);
      if (!result.ok) throw new Error(result.detail);
      const { m5, m15 } = result.bars;
      expect(m5[m5.length - 1]?.openTime).toBe(at('2026-09-18T20:55:00Z'));
      expect(m15[m15.length - 1]?.openTime).toBe(at('2026-09-18T20:45:00Z'));
      expect(m5).toHaveLength(288);
      expect(m15).toHaveLength(96);
      expect(result.bars.slotSeconds).toBe(at('2026-09-19T10:00:00Z'));
    });

    it('returns empty lists, not an error, when a timeframe has no closed bar yet', async () => {
      const onlyLater = makeWorld({ from: SLOT_S, to: SLOT_S + 3600 });
      const result = await read(SLOT, onlyLater);
      if (!result.ok) throw new Error(result.detail);
      expect(result.bars.m5).toEqual([]);
      expect(result.bars.m15).toEqual([]);
    });

    it('reads one timeframe when the other has nothing', async () => {
      const world = worldFor(SLOT).filter((b) => b.timeframe === 'M5');
      const result = await read(SLOT, world);
      if (!result.ok) throw new Error(result.detail);
      expect(result.bars.m5).toHaveLength(288);
      expect(result.bars.m15).toEqual([]);
    });

    it("ignores another symbol's bars", async () => {
      const world = [
        ...worldFor(SLOT),
        ...worldFor(SLOT, { symbol: 'EURUSD', start: 1.08 }),
      ];
      const gold = await read(SLOT, world);
      const euro = await read(SLOT, world, 'EURUSD');
      if (!gold.ok || !euro.ok) throw new Error('read failed');
      expect(gold.bars.symbol).toBe('XAUUSD');
      expect(gold.bars.m5[0]?.open).toBeGreaterThan(1000);
      expect(euro.bars.symbol).toBe('EURUSD');
      expect(euro.bars.m5[0]?.open).toBeLessThan(10);
    });
  });

  describe('what it asks the database', () => {
    it('asks for the newest closable bar, then for the window up to it, per timeframe', async () => {
      const client = fakeClient(worldFor(SLOT));
      await readDayBars({ slot: SLOT }, client);
      const firsts = client.log.findFirst as {
        where: Record<string, unknown>;
        orderBy: unknown;
        select: unknown;
      }[];
      expect(firsts).toHaveLength(2);
      expect(firsts).toContainEqual({
        where: {
          symbol: 'XAUUSD',
          timeframe: 'M5',
          timestamp: { lte: SLOT_S - 300 },
        },
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true },
      });
      expect(firsts).toContainEqual({
        where: {
          symbol: 'XAUUSD',
          timeframe: 'M15',
          timestamp: { lte: SLOT_S - 900 },
        },
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true },
      });
      const manys = client.log.findMany as {
        where: { timeframe: string; timestamp: { gte: number; lte: number } };
      }[];
      expect(manys).toHaveLength(2);
      const m5 = manys.find((q) => q.where.timeframe === 'M5');
      const m15 = manys.find((q) => q.where.timeframe === 'M15');
      expect(m5?.where.timestamp).toEqual({
        gte: SLOT_S - 300 - 287 * 300,
        lte: SLOT_S - 300,
      });
      expect(m15?.where.timestamp).toEqual({
        gte: at('2026-09-18T20:30:00Z') - 95 * 900,
        lte: at('2026-09-18T20:30:00Z'),
      });
      expect(manys[0]).toMatchObject({
        orderBy: { timestamp: 'asc' },
        select: {
          timestamp: true,
          open: true,
          high: true,
          low: true,
          close: true,
        },
      });
    });

    it('does not ask for the window when there is no closable bar', async () => {
      const client = fakeClient([]);
      await readDayBars({ slot: SLOT }, client);
      expect(client.log.findFirst).toHaveLength(2);
      expect(client.log.findMany).toHaveLength(0);
    });
  });

  describe('it fails closed', () => {
    it.each([
      'nope',
      '',
      '2026-09-18T20:57Z',
      '2026-02-30T20:55Z',
      '2026-09-18 20:55',
      '2026-09-18T20:55:00Z',
    ])('refuses the slot %p without asking the database', async (slot) => {
      const client = fakeClient(worldFor(SLOT));
      const result = await readDayBars({ slot }, client);
      expect(result).toEqual({
        ok: false,
        code: 'BAD_SLOT',
        detail:
          'the cycle slot is not a slot (a UTC time on the five-minute grid)',
      });
      expect(client.log.findFirst).toHaveLength(0);
    });

    it('turns a database error into a result, with the reason', async () => {
      const client: DayBarsClient = {
        marketDataV6: {
          findFirst: () => Promise.reject(new Error('connection refused')),
          findMany: () => Promise.resolve([]),
        },
      };
      expect(await readDayBars({ slot: SLOT }, client)).toEqual({
        ok: false,
        code: 'DATABASE_ERROR',
        detail: "the day's bars could not be read: connection refused",
      });
    });

    it('turns an error in the second query into a result too, and a thrown non-Error', async () => {
      const world = worldFor(SLOT);
      const base = fakeClient(world);
      const failing: DayBarsClient = {
        marketDataV6: {
          findFirst: base.marketDataV6.findFirst,
          findMany: () => Promise.reject(new Error('timeout')),
        },
      };
      expect(await readDayBars({ slot: SLOT }, failing)).toMatchObject({
        ok: false,
        code: 'DATABASE_ERROR',
        detail: "the day's bars could not be read: timeout",
      });
      const odd: DayBarsClient = {
        marketDataV6: {
          findFirst: () => {
            throw 'plain string';
          },
          findMany: () => Promise.resolve([]),
        },
      };
      expect(await readDayBars({ slot: SLOT }, odd)).toEqual({
        ok: false,
        code: 'DATABASE_ERROR',
        detail: "the day's bars could not be read: unknown error",
      });
    });

    /** A client that answers the way a broken database or a wrong query might. */
    const rogue = (anchor: number | null, rows: unknown[]): DayBarsClient => ({
      marketDataV6: {
        findFirst: (args) =>
          Promise.resolve(
            args.where.timeframe === 'M5' && anchor !== null
              ? { timestamp: anchor }
              : null
          ),
        findMany: () => Promise.resolve(rows as BarRow[]),
      },
    });
    const good = (t: number, price = 4300): BarRow => ({
      timestamp: t,
      open: price,
      high: price + 1,
      low: price - 1,
      close: price + 0.5,
    });
    const LAST_OPEN = SLOT_S - 300;

    it('accepts a clean answer', async () => {
      const result = await readDayBars(
        { slot: SLOT },
        rogue(LAST_OPEN, [good(LAST_OPEN - 300), good(LAST_OPEN)])
      );
      expect(result.ok).toBe(true);
    });

    it.each([
      [
        'a price that is not a number',
        { ...good(LAST_OPEN), high: Number.NaN },
      ],
      [
        'an infinite price',
        { ...good(LAST_OPEN), low: Number.NEGATIVE_INFINITY },
      ],
      ['a price that is a string', { ...good(LAST_OPEN), close: '4300' }],
      [
        'a time that is not a whole number',
        { ...good(LAST_OPEN), timestamp: LAST_OPEN + 0.5 },
      ],
      [
        'a high under the low',
        { ...good(LAST_OPEN), high: 4290, low: 4300, open: 4295, close: 4295 },
      ],
      ['an open above the high', { ...good(LAST_OPEN), open: 4302 }],
      ['an open under the low', { ...good(LAST_OPEN), open: 4298 }],
      ['a close above the high', { ...good(LAST_OPEN), close: 4302 }],
      ['a close under the low', { ...good(LAST_OPEN), close: 4298 }],
    ])('refuses a row with %s', async (_name, row) => {
      const result = await readDayBars({ slot: SLOT }, rogue(LAST_OPEN, [row]));
      expect(result).toMatchObject({ ok: false, code: 'BAD_ROW' });
    });

    it('accepts a flat bar: open, high, low and close all the same price', async () => {
      const flat: BarRow = {
        timestamp: LAST_OPEN,
        open: 4300,
        high: 4300,
        low: 4300,
        close: 4300,
      };
      expect(
        (await readDayBars({ slot: SLOT }, rogue(LAST_OPEN, [flat]))).ok
      ).toBe(true);
    });

    it('accepts an open or close that sits exactly on the high or the low', async () => {
      const edge: BarRow = {
        timestamp: LAST_OPEN,
        open: 4299,
        high: 4301,
        low: 4299,
        close: 4301,
      };
      expect(
        (await readDayBars({ slot: SLOT }, rogue(LAST_OPEN, [edge]))).ok
      ).toBe(true);
    });

    it('refuses a row newer than the last closed bar, or older than the window', async () => {
      const newer = await readDayBars(
        { slot: SLOT },
        rogue(LAST_OPEN, [good(LAST_OPEN + 300)])
      );
      expect(newer).toMatchObject({
        ok: false,
        code: 'BAD_ROW',
        detail: `the M5 bar at ${LAST_OPEN + 300} is outside the window of the cycle`,
      });
      const older = await readDayBars(
        { slot: SLOT },
        rogue(LAST_OPEN, [good(LAST_OPEN - 288 * 300)])
      );
      expect(older).toMatchObject({ ok: false, code: 'BAD_ROW' });
      const edge = await readDayBars(
        { slot: SLOT },
        rogue(LAST_OPEN, [good(LAST_OPEN - 287 * 300), good(LAST_OPEN)])
      );
      expect(edge.ok).toBe(true);
    });

    it('refuses rows out of order or repeated', async () => {
      const unsorted = await readDayBars(
        { slot: SLOT },
        rogue(LAST_OPEN, [good(LAST_OPEN), good(LAST_OPEN - 300)])
      );
      expect(unsorted).toMatchObject({ ok: false, code: 'BAD_ROW' });
      const repeated = await readDayBars(
        { slot: SLOT },
        rogue(LAST_OPEN, [good(LAST_OPEN - 300), good(LAST_OPEN - 300)])
      );
      expect(repeated).toMatchObject({
        ok: false,
        code: 'BAD_ROW',
        detail: `the M5 bar at ${LAST_OPEN - 300} is not after the bar before it`,
      });
    });

    it('refuses a "newest closed bar" that is not closed at the slot', async () => {
      const result = await readDayBars({ slot: SLOT }, rogue(SLOT_S, []));
      expect(result).toEqual({
        ok: false,
        code: 'BAD_ROW',
        detail: `the newest M5 bar, ${SLOT_S}, is not a closed bar of the cycle`,
      });
      const fraction = await readDayBars(
        { slot: SLOT },
        rogue(LAST_OPEN + 0.5, [])
      );
      expect(fraction).toMatchObject({ ok: false, code: 'BAD_ROW' });
    });

    it('names the timeframe of the bad row', async () => {
      const client: DayBarsClient = {
        marketDataV6: {
          findFirst: (args) =>
            Promise.resolve({
              timestamp:
                args.where.timeframe === 'M15' ? SLOT_S - 900 : SLOT_S - 300,
            }),
          findMany: (args) =>
            Promise.resolve(
              args.where.timeframe === 'M15'
                ? [{ ...good(SLOT_S - 900), high: Number.NaN }]
                : [good(SLOT_S - 300)]
            ),
        },
      };
      const result = await readDayBars({ slot: SLOT }, client);
      expect(result).toMatchObject({ ok: false, code: 'BAD_ROW' });
      expect((result as { detail: string }).detail).toMatch(/^the M15 bar at /);
    });
  });
});
