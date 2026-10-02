import { lastClosedBarOpen } from '../src/cycle/slot';
import { MAX_CLOSED_BARS_PER_READ } from '../src/cycle/read/read-types';
import {
  FORMING,
  M5_ONLY_SLOT,
  REFRESH_SLOT,
  barValues,
  buildReader,
  putBar,
  putCycle,
  putWorld,
  silenceLogs,
} from './helpers/reader-world';

/**
 * getClosedBars(timeframe, slot, n): the closed-bar view (rule 2).
 *
 * "Closed" is arithmetic (open time plus the period is at or before the slot) and
 * it is the READER'S job to apply it: the table holds the forming bar too, because
 * every export ends with it. These tests lay the forming bar next to the closed
 * bars with values no closed bar has, so a leak is visible by value.
 */

beforeEach(silenceLogs);
afterEach(() => jest.restoreAllMocks());

describe('the closed bars at a slot', () => {
  it('M5: the newest 288, oldest first, ending at the bar that closed at the slot', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT);
    putCycle(prisma, REFRESH_SLOT);

    const result = await reader.getClosedBars('M5', REFRESH_SLOT, 288);

    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    expect(result.bars).toHaveLength(288);
    expect(result.newestOpenTime).toBe(REFRESH_SLOT - 300); // 20:55: opened 20:55, closed 21:00
    expect(result.newestOpenTime).toBe(lastClosedBarOpen('M5', REFRESH_SLOT));
    expect(result.bars[0].timestamp).toBe(REFRESH_SLOT - 300 * 288);
    const times = result.bars.map((b) => b.timestamp);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(new Set(times).size).toBe(288);
    expect(result.collectedSlot).toBe(REFRESH_SLOT);
  });

  it('M15: the newest 96, ending at the bar that closed at the slot', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT);
    putCycle(prisma, REFRESH_SLOT);

    const result = await reader.getClosedBars('M15', REFRESH_SLOT, 96);

    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    expect(result.bars).toHaveLength(96);
    expect(result.newestOpenTime).toBe(REFRESH_SLOT - 900); // 20:45
  });

  it('returns the values stored for each bar, and only the OHLC spine', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT);
    putCycle(prisma, REFRESH_SLOT);
    const result = await reader.getClosedBars('M5', REFRESH_SLOT, 3);
    if (result.status !== 'OK') throw new Error('expected OK');
    const ts = REFRESH_SLOT - 300;
    expect(result.bars[2]).toEqual({
      timestamp: ts,
      ...barValues(ts, 'M5'),
    });
    expect(Object.keys(result.bars[2]).sort()).toEqual([
      'close',
      'high',
      'low',
      'open',
      'timestamp',
      'volume',
    ]);
  });

  it('n smaller than what exists gives the NEWEST n, not the oldest', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT);
    putCycle(prisma, REFRESH_SLOT);
    const result = await reader.getClosedBars('M5', REFRESH_SLOT, 5);
    if (result.status !== 'OK') throw new Error('expected OK');
    expect(result.bars.map((b) => b.timestamp)).toEqual([
      REFRESH_SLOT - 1500,
      REFRESH_SLOT - 1200,
      REFRESH_SLOT - 900,
      REFRESH_SLOT - 600,
      REFRESH_SLOT - 300,
    ]);
  });

  it('counts trading bars across a market-closed gap (rule 4): n bars, not n slots', async () => {
    const { prisma, reader } = buildReader();
    // five bars before a two-day gap, five after (the gap is the weekend)
    const afterGap = REFRESH_SLOT - 300;
    for (let i = 0; i < 5; i += 1) putBar(prisma, 'M5', afterGap - i * 300);
    const beforeGap = afterGap - 5 * 300 - 2 * 86400;
    for (let i = 0; i < 5; i += 1) putBar(prisma, 'M5', beforeGap - i * 300);
    putCycle(prisma, REFRESH_SLOT);

    const result = await reader.getClosedBars('M5', REFRESH_SLOT, 7);

    if (result.status !== 'OK') throw new Error('expected OK');
    expect(result.bars).toHaveLength(7);
    const times = result.bars.map((b) => b.timestamp);
    expect(times.slice(2)).toEqual(
      [...Array(5).keys()].map((i) => afterGap - (4 - i) * 300)
    );
    expect(times[1] - times[0]).toBe(300);
    expect(times[2] - times[1]).toBeGreaterThan(2 * 86400); // the gap is skipped, not filled
  });
});

describe('no still-open bar (rule 2)', () => {
  it('the bar opened AT the slot is the forming bar: in the table, never in the result', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT);
    putCycle(prisma, REFRESH_SLOT);
    expect(
      prisma.bars.some(
        (b) => b.timeframe === 'M5' && b.timestamp === REFRESH_SLOT
      )
    ).toBe(true);

    const result = await reader.getClosedBars('M5', REFRESH_SLOT, 300);

    if (result.status !== 'OK') throw new Error('expected OK');
    expect(result.bars.some((b) => b.timestamp === REFRESH_SLOT)).toBe(false);
    expect(result.bars.some((b) => b.close === FORMING.close)).toBe(false);
    expect(JSON.stringify(result.bars)).not.toContain(String(FORMING.high));
  });

  it('M15: the bar that opened at 21:00 is forming at 21:00 and at 21:05; the 20:45 bar closed at 21:00', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT);
    putCycle(prisma, REFRESH_SLOT);
    const at2100 = await reader.getClosedBars('M15', REFRESH_SLOT, 96);
    const at2105 = await reader.getClosedBars('M15', M5_ONLY_SLOT, 96);
    if (at2100.status !== 'OK' || at2105.status !== 'OK')
      throw new Error('expected OK');
    expect(at2100.newestOpenTime).toBe(REFRESH_SLOT - 900);
    expect(at2105.newestOpenTime).toBe(REFRESH_SLOT - 900); // the 21:00 M15 bar is still open at 21:05
    expect(at2105.bars).toEqual(at2100.bars);
  });

  it('bars newer than the slot (later cycles) are not read: a replay of an old slot sees the old window', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT);
    putCycle(prisma, REFRESH_SLOT);
    const before = await reader.getClosedBars('M5', REFRESH_SLOT, 288);

    for (let i = 1; i <= 20; i += 1)
      putBar(prisma, 'M5', REFRESH_SLOT + i * 300);
    const after = await reader.getClosedBars('M5', REFRESH_SLOT, 288);

    expect(after).toEqual(before);
  });

  it('refuses to hand out a still-open bar even if the query returned one', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT);
    putCycle(prisma, REFRESH_SLOT);
    // a broken query: ignores the closed-bar bound and returns the forming bar
    prisma.marketDataV6.findMany = (async () => [
      { timestamp: REFRESH_SLOT, ...FORMING },
    ]) as never;
    await expect(reader.getClosedBars('M5', REFRESH_SLOT, 1)).rejects.toThrow(
      /still-open M5 bar/
    );
  });

  it('asks the database for bars at or before the last closed bar, newest first, the OHLC spine only', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT);
    putCycle(prisma, REFRESH_SLOT);
    await reader.getClosedBars('M5', REFRESH_SLOT, 288);
    const [query] = prisma.queries('marketDataV6', 'findMany');
    expect(query.args).toEqual({
      where: {
        symbol: 'XAUUSD',
        timeframe: 'M5',
        timestamp: { lte: REFRESH_SLOT - 300 },
      },
      orderBy: { timestamp: 'desc' },
      take: 288,
      select: {
        timestamp: true,
        open: true,
        high: true,
        low: true,
        close: true,
        volume: true,
      },
    });
  });
});

describe('only READY cycles vouch for bars', () => {
  it.each(['PENDING', 'INCOMPLETE'])(
    'a %s cycle at the slot is STALE even though its bars are in the table',
    async (state) => {
      const { prisma, reader } = buildReader();
      putWorld(prisma, REFRESH_SLOT);
      putCycle(prisma, REFRESH_SLOT, {
        state,
        data_status: null,
        ready_at: null,
      });
      const result = await reader.getClosedBars('M5', REFRESH_SLOT, 288);
      expect(result).toMatchObject({
        status: 'STALE',
        reason: 'CYCLE_NOT_READY',
        slot: REFRESH_SLOT,
        timeframe: 'M5',
        collectedSlot: REFRESH_SLOT,
      });
    }
  );

  it('no cycle row at all is STALE', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT);
    expect(await reader.getClosedBars('M5', REFRESH_SLOT, 288)).toMatchObject({
      status: 'STALE',
      reason: 'CYCLE_NOT_READY',
    });
  });

  it('an older READY cycle does not stand in for the slot asked about', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT);
    putCycle(prisma, REFRESH_SLOT - 300); // READY, but the slot is 21:00
    putCycle(prisma, REFRESH_SLOT, {
      state: 'PENDING',
      data_status: null,
      ready_at: null,
    });
    expect(await reader.getClosedBars('M5', REFRESH_SLOT, 288)).toMatchObject({
      status: 'STALE',
      reason: 'CYCLE_NOT_READY',
    });
  });

  it('M15 on an M5-only slot is vouched for by the cycle that COLLECTED it (21:00), not by the slot asked about', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT);
    putCycle(prisma, REFRESH_SLOT); // READY at 21:00; nothing at 21:05
    const result = await reader.getClosedBars('M15', M5_ONLY_SLOT, 96);
    if (result.status !== 'OK') throw new Error('expected OK');
    expect(result.collectedSlot).toBe(REFRESH_SLOT);
    expect(result.cycle.slot).toBe(REFRESH_SLOT);
  });

  it('...and it is STALE when that cycle is not READY, whatever the 21:05 cycle says', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT);
    putCycle(prisma, REFRESH_SLOT, {
      state: 'INCOMPLETE',
      data_status: null,
      ready_at: null,
    });
    putCycle(prisma, M5_ONLY_SLOT);
    expect(await reader.getClosedBars('M15', M5_ONLY_SLOT, 96)).toMatchObject({
      status: 'STALE',
      reason: 'CYCLE_NOT_READY',
      timeframe: 'M15',
      collectedSlot: REFRESH_SLOT,
    });
    // while M5 at 21:05 is fine: its own cycle is READY
    expect((await reader.getClosedBars('M5', M5_ONLY_SLOT, 10)).status).toBe(
      'OK'
    );
  });

  it('every market_cycles query filters on state READY', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT);
    putCycle(prisma, REFRESH_SLOT);
    await reader.getClosedBars('M5', REFRESH_SLOT, 10);
    await reader.getClosedBars('M15', M5_ONLY_SLOT, 10);
    const queries = prisma.queries('marketCycle');
    expect(queries.length).toBeGreaterThan(0);
    for (const q of queries) expect(q.args.where.state).toBe('READY');
  });

  it.each([
    ['no ready time', { ready_at: null }],
    ['a ready time before the slot', { ready_at: REFRESH_SLOT - 1 }],
    ['no status', { data_status: null }],
    ['a status a cycle can never have (STALE)', { data_status: 'STALE' }],
    ['zero attempts', { attempts: 0 }],
  ])('a READY row with %s is refused, not half-used', async (_label, bad) => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT);
    putCycle(prisma, REFRESH_SLOT, bad);
    expect(await reader.getClosedBars('M5', REFRESH_SLOT, 10)).toMatchObject({
      status: 'STALE',
      reason: 'INVALID_CYCLE_ROW',
    });
  });

  it('reports the cycle it relied on', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT);
    putCycle(prisma, REFRESH_SLOT, {
      data_status: 'DELAYED',
      attempts: 2,
      retuning: true,
    });
    const result = await reader.getClosedBars('M5', REFRESH_SLOT, 10);
    if (result.status !== 'OK') throw new Error('expected OK');
    expect(result.cycle).toMatchObject({
      slot: REFRESH_SLOT,
      dataStatus: 'DELAYED',
      attempts: 2,
      retuning: true,
      readyAt: REFRESH_SLOT + 63,
    });
  });
});

describe('fewer bars than asked for', () => {
  it('is STALE with the count, never padded and never silently shortened', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT, { closedM5: 290 });
    putCycle(prisma, REFRESH_SLOT);
    const result = await reader.getClosedBars('M5', REFRESH_SLOT, 300);
    expect(result).toMatchObject({
      status: 'STALE',
      reason: 'INSUFFICIENT_CLOSED_BARS',
      timeframe: 'M5',
    });
    if (result.status === 'STALE') expect(result.detail).toContain('290');
  });

  it('exactly as many as asked for is enough', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT, { closedM5: 290 });
    putCycle(prisma, REFRESH_SLOT);
    expect((await reader.getClosedBars('M5', REFRESH_SLOT, 290)).status).toBe(
      'OK'
    );
  });
});

describe('a caller bug throws; nothing is read', () => {
  it.each([
    ['a slot that is "now", not a boundary', 'M5', REFRESH_SLOT + 1, 10],
    ['a slot that is a float', 'M5', REFRESH_SLOT + 0.5, 10],
    ['a negative slot', 'M5', -300, 10],
    ['an unknown timeframe', 'H1', REFRESH_SLOT, 10],
    ['n of zero', 'M5', REFRESH_SLOT, 0],
    ['a negative n', 'M5', REFRESH_SLOT, -1],
    ['a fractional n', 'M5', REFRESH_SLOT, 1.5],
    [
      'n beyond the export window',
      'M5',
      REFRESH_SLOT,
      MAX_CLOSED_BARS_PER_READ + 1,
    ],
    ['n that is NaN', 'M5', REFRESH_SLOT, Number.NaN],
  ])('%s', async (_label, timeframe, slot, n) => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT);
    putCycle(prisma, REFRESH_SLOT);
    await expect(
      reader.getClosedBars(timeframe as 'M5', slot, n)
    ).rejects.toThrow(RangeError);
    expect(prisma.queryLog).toHaveLength(0);
  });

  it('the limit is the length of the export window: each export carries 3,000 bars per timeframe (section 1.2)', () => {
    expect(MAX_CLOSED_BARS_PER_READ).toBe(3000);
  });

  it('n at the limit of the export window is allowed', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT, { closedM5: MAX_CLOSED_BARS_PER_READ });
    putCycle(prisma, REFRESH_SLOT);
    const result = await reader.getClosedBars(
      'M5',
      REFRESH_SLOT,
      MAX_CLOSED_BARS_PER_READ
    );
    expect(result.status).toBe('OK');
  });
});
