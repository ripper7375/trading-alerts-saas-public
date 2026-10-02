import { SpineBar, digestClosedSpine } from '../src/cycle/closed-bars-digest';
import { lastClosedBarOpen } from '../src/cycle/slot';
import {
  FORMING,
  M15_CYCLE_ID,
  M5_CYCLE_ID,
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
 * getOneDayOhlc(slot): what the prompt gets (rules 3 and 4): the newest 288 closed
 * M5 bars and 96 closed M15 bars, and the forming M5 bar's close exposed ONCE as a
 * labelled last price.
 */

beforeEach(silenceLogs);
afterEach(() => jest.restoreAllMocks());

/** The window worked out from the world's layout, not through the reader. */
function expectedBars(
  timeframe: 'M5' | 'M15',
  slot: number,
  count: number
): SpineBar[] {
  const step = timeframe === 'M5' ? 300 : 900;
  const last = lastClosedBarOpen(timeframe, slot);
  return Array.from({ length: count }, (_, i) => {
    const timestamp = last - (count - 1 - i) * step;
    return { timestamp, ...barValues(timestamp, timeframe) };
  });
}
const expectedDigest = (slot: number) =>
  digestClosedSpine({
    M5: expectedBars('M5', slot, 288),
    M15: expectedBars('M15', slot, 96),
  });

describe('one day of closed bars (rule 4)', () => {
  it('288 M5 and 96 M15 closed bars, oldest first, exactly the window the layout says', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT);
    putCycle(prisma, REFRESH_SLOT);

    const result = await reader.getOneDayOhlc(REFRESH_SLOT);

    if (result.status !== 'OK') throw new Error('expected OK');
    expect(result.bars.M5).toHaveLength(288);
    expect(result.bars.M15).toHaveLength(96);
    expect(result.bars.M5).toEqual(expectedBars('M5', REFRESH_SLOT, 288));
    expect(result.bars.M15).toEqual(expectedBars('M15', REFRESH_SLOT, 96));
    expect(result.bars.M5.at(-1)!.timestamp).toBe(REFRESH_SLOT - 300);
    expect(result.bars.M15.at(-1)!.timestamp).toBe(REFRESH_SLOT - 900);
  });

  it('on an M5-only slot M15 is the window as of the quarter hour it was collected at', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, M5_ONLY_SLOT);
    putCycle(prisma, M5_ONLY_SLOT);
    putCycle(prisma, REFRESH_SLOT); // the cycle that collected M15

    const result = await reader.getOneDayOhlc(M5_ONLY_SLOT);

    if (result.status !== 'OK') throw new Error('expected OK');
    expect(result.bars.M5.at(-1)!.timestamp).toBe(REFRESH_SLOT); // closed at 21:05
    expect(result.bars.M15.at(-1)!.timestamp).toBe(REFRESH_SLOT - 900);
    expect(result.cycle.slot).toBe(M5_ONLY_SLOT);
    expect(result.m15Cycle.slot).toBe(REFRESH_SLOT);
  });

  it('a refresh slot needs one cycle, an M5-only slot two', async () => {
    const a = buildReader();
    putWorld(a.prisma, REFRESH_SLOT);
    putCycle(a.prisma, REFRESH_SLOT);
    await a.reader.getOneDayOhlc(REFRESH_SLOT);
    expect(a.prisma.queries('marketCycle')).toHaveLength(1);

    const b = buildReader();
    putWorld(b.prisma, M5_ONLY_SLOT);
    putCycle(b.prisma, M5_ONLY_SLOT);
    putCycle(b.prisma, REFRESH_SLOT);
    await b.reader.getOneDayOhlc(M5_ONLY_SLOT);
    expect(b.prisma.queries('marketCycle')).toHaveLength(2);
  });

  it('reports both cycles it relied on', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, M5_ONLY_SLOT);
    putCycle(prisma, M5_ONLY_SLOT, { data_status: 'DELAYED', attempts: 2 });
    putCycle(prisma, REFRESH_SLOT);
    const result = await reader.getOneDayOhlc(M5_ONLY_SLOT);
    if (result.status !== 'OK') throw new Error('expected OK');
    expect(result.cycle).toMatchObject({
      slot: M5_ONLY_SLOT,
      dataStatus: 'DELAYED',
      attempts: 2,
    });
    expect(result.m15Cycle).toMatchObject({
      slot: REFRESH_SLOT,
      dataStatus: 'FRESH',
    });
  });
});

describe('the forming bar is exposed once, as a labelled last price (rule 3)', () => {
  it('its close is the price; its open, high, low and volume appear nowhere in the result', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT);
    putCycle(prisma, REFRESH_SLOT);

    const result = await reader.getOneDayOhlc(REFRESH_SLOT);

    if (result.status !== 'OK') throw new Error('expected OK');
    expect(result.lastPrice).toEqual({
      status: 'OK',
      price: FORMING.close,
      barOpenTime: REFRESH_SLOT, // the bar that opened at the slot
      asOf: REFRESH_SLOT - 1, // the export file's modification time, from market_cycles
    });
    const json = JSON.stringify(result);
    for (const leaked of [
      FORMING.open,
      FORMING.high,
      FORMING.low,
      FORMING.volume,
    ]) {
      expect(json).not.toContain(String(leaked));
    }
    // the close is there once, as the price
    expect(json.split(String(FORMING.close))).toHaveLength(2);
  });

  it('neither forming bar (M5 at the slot, M15 at 21:00) is in the windows', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT);
    putCycle(prisma, REFRESH_SLOT);
    const result = await reader.getOneDayOhlc(REFRESH_SLOT);
    if (result.status !== 'OK') throw new Error('expected OK');
    for (const bars of [result.bars.M5, result.bars.M15]) {
      expect(bars.some((b) => b.close === FORMING.close)).toBe(false);
      expect(bars.some((b) => b.timestamp === REFRESH_SLOT)).toBe(false);
    }
  });

  it('the price query reads the close and the row identity, never the bar’s other columns', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT);
    putCycle(prisma, REFRESH_SLOT);
    await reader.getOneDayOhlc(REFRESH_SLOT);
    const [query] = prisma.queries('marketDataV6', 'findUnique');
    expect(query.args.select).toEqual({
      timestamp: true,
      close: true,
      cycle_id: true,
    });
    expect(query.args.where.symbol_timeframe_timestamp).toEqual({
      symbol: 'XAUUSD',
      timeframe: 'M5',
      timestamp: REFRESH_SLOT,
    });
  });

  it('when the export ended before the new bar opened there is no price, and none is borrowed from the last closed bar', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT, { formingM5: false });
    putCycle(prisma, REFRESH_SLOT);
    const result = await reader.getOneDayOhlc(REFRESH_SLOT);
    if (result.status !== 'OK') throw new Error('expected OK');
    expect(result.lastPrice).toEqual({
      status: 'UNAVAILABLE',
      reason: 'FORMING_BAR_NOT_IN_TABLE',
    });
    expect(result.bars.M5).toHaveLength(288); // the closed window is unaffected
  });

  it('once a later cycle has rewritten the row it is no longer this cycle’s price', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT);
    putCycle(prisma, REFRESH_SLOT);
    putBar(prisma, 'M5', REFRESH_SLOT, {
      close: 2611.25,
      cycle_id: M5_CYCLE_ID + 1,
    });
    const result = await reader.getOneDayOhlc(REFRESH_SLOT);
    if (result.status !== 'OK') throw new Error('expected OK');
    expect(result.lastPrice).toEqual({
      status: 'UNAVAILABLE',
      reason: 'NOT_THIS_CYCLES_PRICE',
    });
  });

  it('a cycle that does not say which collection cycle wrote its M5 rows cannot vouch for the price', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT);
    putCycle(prisma, REFRESH_SLOT, { m5_collection_cycle_id: null });
    const result = await reader.getOneDayOhlc(REFRESH_SLOT);
    if (result.status !== 'OK') throw new Error('expected OK');
    expect(result.lastPrice).toMatchObject({
      status: 'UNAVAILABLE',
      reason: 'NOT_THIS_CYCLES_PRICE',
    });
  });

  it('asOf is null when the cycle carries no export time', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT);
    putCycle(prisma, REFRESH_SLOT, { m5_export_at: null });
    const result = await reader.getOneDayOhlc(REFRESH_SLOT);
    if (result.status !== 'OK') throw new Error('expected OK');
    expect(result.lastPrice).toMatchObject({ status: 'OK', asOf: null });
  });
});

describe('replaying a slot returns the same closed bars (§1.8)', () => {
  it('the digest of what is read equals the independently computed one, and the stored one', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT);
    putCycle(prisma, REFRESH_SLOT, {
      closed_bars_digest: expectedDigest(REFRESH_SLOT),
    });
    const result = await reader.getOneDayOhlc(REFRESH_SLOT);
    if (result.status !== 'OK') throw new Error('expected OK');
    expect(result.replay.digest).toBe(expectedDigest(REFRESH_SLOT));
    expect(result.replay.cycleDigest).toBe(expectedDigest(REFRESH_SLOT));
    expect(result.replay.matches).toBe(true);
  });

  it('after later cycles have upserted, the same slot returns the same bars and the same digest', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT);
    putCycle(prisma, REFRESH_SLOT, {
      closed_bars_digest: expectedDigest(REFRESH_SLOT),
    });
    const first = await reader.getOneDayOhlc(REFRESH_SLOT);

    // six hours of later cycles: newer closed bars, and the bar that was forming at
    // the slot is rewritten with its final values by a later collection cycle
    for (let i = 1; i <= 72; i += 1)
      putBar(prisma, 'M5', REFRESH_SLOT + i * 300, {
        cycle_id: M5_CYCLE_ID + i,
      });
    for (let i = 1; i <= 24; i += 1)
      putBar(prisma, 'M15', REFRESH_SLOT + i * 900, {
        cycle_id: M15_CYCLE_ID + i,
      });
    putBar(prisma, 'M5', REFRESH_SLOT, {
      ...barValues(REFRESH_SLOT, 'M5'),
      cycle_id: M5_CYCLE_ID + 1,
    });
    const replay = await reader.getOneDayOhlc(REFRESH_SLOT);

    if (first.status !== 'OK' || replay.status !== 'OK')
      throw new Error('expected OK');
    expect(replay.bars).toEqual(first.bars);
    expect(replay.replay).toEqual(first.replay);
    expect(replay.replay.matches).toBe(true);
    // what does NOT replay is the live price: it is a last price only while it is the cycle's own
    expect(first.lastPrice.status).toBe('OK');
    expect(replay.lastPrice).toEqual({
      status: 'UNAVAILABLE',
      reason: 'NOT_THIS_CYCLES_PRICE',
    });
  });

  it('a closed bar rewritten after the cycle was declared ready is reported, not hidden', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT);
    putCycle(prisma, REFRESH_SLOT, {
      closed_bars_digest: expectedDigest(REFRESH_SLOT),
    });
    // the newest closed bar was exported a second before it closed; a later cycle upserts its final close
    putBar(prisma, 'M5', REFRESH_SLOT - 300, {
      ...barValues(REFRESH_SLOT - 300, 'M5'),
      close: 2999.99,
    });
    const result = await reader.getOneDayOhlc(REFRESH_SLOT);
    if (result.status !== 'OK') throw new Error('expected OK');
    expect(result.replay.matches).toBe(false);
    expect(result.replay.digest).not.toBe(result.replay.cycleDigest);
    // the reader still returns what is stored now, and says so
    expect(result.bars.M5.at(-1)!.close).toBe(2999.99);
  });

  it('a cycle that stored no digest is reported as unverifiable, not as a match', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT);
    putCycle(prisma, REFRESH_SLOT, { closed_bars_digest: null });
    const result = await reader.getOneDayOhlc(REFRESH_SLOT);
    if (result.status !== 'OK') throw new Error('expected OK');
    expect(result.replay.matches).toBeNull();
    expect(result.replay.cycleDigest).toBeNull();
  });
});

describe('only READY cycles vouch for the window', () => {
  it.each(['PENDING', 'INCOMPLETE'])(
    'a %s cycle at the slot is STALE (M5)',
    async (state) => {
      const { prisma, reader } = buildReader();
      putWorld(prisma, REFRESH_SLOT);
      putCycle(prisma, REFRESH_SLOT, {
        state,
        data_status: null,
        ready_at: null,
      });
      expect(await reader.getOneDayOhlc(REFRESH_SLOT)).toMatchObject({
        status: 'STALE',
        reason: 'CYCLE_NOT_READY',
        timeframe: 'M5',
        collectedSlot: REFRESH_SLOT,
      });
    }
  );

  it('a READY slot whose M15 was collected by a cycle that is not READY is STALE (M15)', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, M5_ONLY_SLOT);
    putCycle(prisma, M5_ONLY_SLOT);
    putCycle(prisma, REFRESH_SLOT, {
      state: 'INCOMPLETE',
      data_status: null,
      ready_at: null,
    });
    expect(await reader.getOneDayOhlc(M5_ONLY_SLOT)).toMatchObject({
      status: 'STALE',
      reason: 'CYCLE_NOT_READY',
      timeframe: 'M15',
      collectedSlot: REFRESH_SLOT,
    });
  });

  it('no bars are read for a slot that is not READY', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT);
    await reader.getOneDayOhlc(REFRESH_SLOT);
    expect(prisma.queries('marketDataV6')).toHaveLength(0);
  });

  it('an unusable READY row is refused', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT);
    putCycle(prisma, REFRESH_SLOT, { ready_at: null });
    expect(await reader.getOneDayOhlc(REFRESH_SLOT)).toMatchObject({
      status: 'STALE',
      reason: 'INVALID_CYCLE_ROW',
    });
  });

  it('every market_cycles query filters on state READY', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, M5_ONLY_SLOT);
    putCycle(prisma, M5_ONLY_SLOT);
    putCycle(prisma, REFRESH_SLOT);
    await reader.getOneDayOhlc(M5_ONLY_SLOT);
    for (const q of prisma.queries('marketCycle'))
      expect(q.args.where.state).toBe('READY');
  });
});

describe('not a full day of closed bars', () => {
  it('288 is a day of M5: 287 is STALE, not padded and not shortened', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT, { closedM5: 287 });
    putCycle(prisma, REFRESH_SLOT);
    const result = await reader.getOneDayOhlc(REFRESH_SLOT);
    expect(result).toMatchObject({
      status: 'STALE',
      reason: 'INSUFFICIENT_CLOSED_BARS',
      timeframe: 'M5',
    });
    if (result.status === 'STALE') expect(result.detail).toContain('287');
  });

  it('96 is a day of M15: 95 is STALE', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT, { closedM15: 95 });
    putCycle(prisma, REFRESH_SLOT);
    expect(await reader.getOneDayOhlc(REFRESH_SLOT)).toMatchObject({
      status: 'STALE',
      reason: 'INSUFFICIENT_CLOSED_BARS',
      timeframe: 'M15',
    });
  });

  it('exactly a day is enough', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT, { closedM5: 288, closedM15: 96 });
    putCycle(prisma, REFRESH_SLOT);
    expect((await reader.getOneDayOhlc(REFRESH_SLOT)).status).toBe('OK');
  });

  it('refuses to hand out a still-open bar even if the query returned one', async () => {
    const { prisma, reader } = buildReader();
    putWorld(prisma, REFRESH_SLOT);
    putCycle(prisma, REFRESH_SLOT);
    const real = prisma.marketDataV6.findMany;
    prisma.marketDataV6.findMany = (async (
      args: Parameters<typeof real>[0]
    ) => {
      const rows = await real(args);
      return args.where.timeframe === 'M5'
        ? [...rows.slice(1), { timestamp: REFRESH_SLOT, ...FORMING }]
        : rows;
    }) as never;
    await expect(reader.getOneDayOhlc(REFRESH_SLOT)).rejects.toThrow(
      /still-open M5 bar/
    );
  });
});

describe('a caller bug throws; nothing is read', () => {
  it.each([[REFRESH_SLOT + 1], [REFRESH_SLOT + 0.5], [-300], [Number.NaN]])(
    'slot %p',
    async (slot) => {
      const { prisma, reader } = buildReader();
      putWorld(prisma, REFRESH_SLOT);
      putCycle(prisma, REFRESH_SLOT);
      await expect(reader.getOneDayOhlc(slot)).rejects.toThrow(RangeError);
      expect(prisma.queryLog).toHaveLength(0);
    }
  );
});
