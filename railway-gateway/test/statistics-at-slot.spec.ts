import { STATISTIC_SOURCES } from '../src/cycle/read/read-types';
import {
  M5_ONLY_SLOT,
  REFRESH_SLOT,
  buildReader,
  putCycle,
  putStatistic,
  silenceLogs,
} from './helpers/reader-world';

/**
 * getStatisticsAtSlot(source, timeframe, slot): rule 5.
 *
 * "A sensor uses the indicator_statistics row captured at the slot where its
 * timeframe was last collected, for the active source. No match means STALE,
 * never 'latest available'." The tests plant rows of OTHER slots around the one
 * asked for, older and newer, so any fallback shows up as a returned row.
 */

beforeEach(silenceLogs);
afterEach(() => jest.restoreAllMocks());

const SHORTFALL = (
  timeframe: 'M5' | 'M15',
  expected: number,
  landed: number
) => ({
  reason: 'STATISTICS_SHORTFALL',
  ageSec: 31,
  slotAgeSec: 94,
  timeframes: {
    [timeframe]: {
      bars: { expected: 289, landed: 289 },
      statistics: { expected, landed },
      newest: { minCycleId: 2, cycleId: 2 },
    },
  },
});

describe('the row captured at the slot', () => {
  it('M5: the row at the slot itself', async () => {
    const { prisma, reader } = buildReader();
    putCycle(prisma, REFRESH_SLOT);
    putStatistic(prisma, 'best_fit_a', 'M5', REFRESH_SLOT, {
      containment_rate: 73.25,
    });

    const result = await reader.getStatisticsAtSlot(
      'best_fit_a',
      'M5',
      REFRESH_SLOT
    );

    if (result.status !== 'OK') throw new Error('expected OK');
    expect(result.row.captured_at).toBe(REFRESH_SLOT);
    expect(result.row.source).toBe('best_fit_a');
    expect(result.row.timeframe).toBe('M5');
    expect(result.row.containment_rate).toBe(73.25);
    expect(result.collectedSlot).toBe(REFRESH_SLOT);
    expect(result.cycle.slot).toBe(REFRESH_SLOT);
  });

  it('M15 at an M5-only slot: the row captured at the quarter hour it was last collected', async () => {
    const { prisma, reader } = buildReader();
    putCycle(prisma, REFRESH_SLOT); // 21:00 collected M15; nothing at 21:05
    putStatistic(prisma, 'non_b', 'M15', REFRESH_SLOT, {
      containment_rate: 55.5,
    });

    const result = await reader.getStatisticsAtSlot(
      'non_b',
      'M15',
      M5_ONLY_SLOT
    );

    if (result.status !== 'OK') throw new Error('expected OK');
    expect(result.slot).toBe(M5_ONLY_SLOT);
    expect(result.collectedSlot).toBe(REFRESH_SLOT);
    expect(result.row.captured_at).toBe(REFRESH_SLOT);
    expect(result.row.containment_rate).toBe(55.5);
  });

  it('each lookup is ONE read by the full unique key: symbol, timeframe, source, captured_at', async () => {
    const { prisma, reader } = buildReader();
    putCycle(prisma, REFRESH_SLOT);
    putStatistic(prisma, 'best_fit_a', 'M5', REFRESH_SLOT);
    await reader.getStatisticsAtSlot('best_fit_a', 'M5', REFRESH_SLOT);
    const queries = prisma.queries('indicatorStatistic');
    expect(queries).toHaveLength(1);
    expect(queries[0].op).toBe('findUnique');
    expect(queries[0].args.where).toEqual({
      symbol_timeframe_source_captured_at: {
        symbol: 'XAUUSD',
        timeframe: 'M5',
        source: 'best_fit_a',
        captured_at: REFRESH_SLOT,
      },
    });
    expect(queries[0].args).not.toHaveProperty('orderBy');
  });

  it('every source the gateway accepts can be looked up', async () => {
    const { prisma, reader } = buildReader();
    putCycle(prisma, REFRESH_SLOT);
    for (const source of STATISTIC_SOURCES)
      putStatistic(prisma, source, 'M5', REFRESH_SLOT);
    for (const source of STATISTIC_SOURCES) {
      const result = await reader.getStatisticsAtSlot(
        source,
        'M5',
        REFRESH_SLOT
      );
      expect(result.status).toBe('OK');
      if (result.status === 'OK') expect(result.row.source).toBe(source);
    }
  });
});

describe('never "latest available" (rule 5)', () => {
  it('no row at the slot is STALE even though OLDER rows of the source exist', async () => {
    const { prisma, reader } = buildReader();
    putCycle(prisma, REFRESH_SLOT);
    for (let i = 1; i <= 12; i += 1)
      putStatistic(prisma, 'best_fit_a', 'M5', REFRESH_SLOT - i * 300);

    const result = await reader.getStatisticsAtSlot(
      'best_fit_a',
      'M5',
      REFRESH_SLOT
    );

    expect(result).toMatchObject({
      status: 'STALE',
      reason: 'NO_STATISTICS_AT_SLOT',
      slot: REFRESH_SLOT,
      timeframe: 'M5',
      collectedSlot: REFRESH_SLOT,
    });
    expect(result).not.toHaveProperty('row');
  });

  it('...and NEWER rows do not stand in either (a replay of an old slot)', async () => {
    const { prisma, reader } = buildReader();
    putCycle(prisma, REFRESH_SLOT);
    for (let i = 1; i <= 12; i += 1)
      putStatistic(prisma, 'best_fit_a', 'M5', REFRESH_SLOT + i * 300);
    expect(
      await reader.getStatisticsAtSlot('best_fit_a', 'M5', REFRESH_SLOT)
    ).toMatchObject({
      status: 'STALE',
      reason: 'NO_STATISTICS_AT_SLOT',
    });
  });

  it('M15 at an M5-only slot does not take the 21:05 M5-cadence row or any other slot', async () => {
    const { prisma, reader } = buildReader();
    putCycle(prisma, REFRESH_SLOT);
    putStatistic(prisma, 'non_b', 'M15', REFRESH_SLOT - 900); // the quarter hour before
    putStatistic(prisma, 'non_b', 'M15', M5_ONLY_SLOT); // an impossible 21:05 M15 row
    putStatistic(prisma, 'non_b', 'M5', REFRESH_SLOT); // the right slot, the wrong timeframe
    expect(
      await reader.getStatisticsAtSlot('non_b', 'M15', M5_ONLY_SLOT)
    ).toMatchObject({
      status: 'STALE',
      reason: 'NO_STATISTICS_AT_SLOT',
      collectedSlot: REFRESH_SLOT,
    });
  });

  it('another source at the same slot is not this source', async () => {
    const { prisma, reader } = buildReader();
    putCycle(prisma, REFRESH_SLOT);
    putStatistic(prisma, 'non_b', 'M5', REFRESH_SLOT);
    expect(
      (await reader.getStatisticsAtSlot('best_fit_a', 'M5', REFRESH_SLOT))
        .status
    ).toBe('STALE');
  });

  it('a row exists at the slot but its cycle is not READY: STALE (a half-landed cycle is never read)', async () => {
    const { prisma, reader } = buildReader();
    putCycle(prisma, REFRESH_SLOT, {
      state: 'INCOMPLETE',
      data_status: null,
      ready_at: null,
    });
    putStatistic(prisma, 'best_fit_a', 'M5', REFRESH_SLOT);
    expect(
      await reader.getStatisticsAtSlot('best_fit_a', 'M5', REFRESH_SLOT)
    ).toMatchObject({
      status: 'STALE',
      reason: 'CYCLE_NOT_READY',
    });
    // and the statistics table was not even asked
    expect(prisma.queries('indicatorStatistic')).toHaveLength(0);
  });
});

describe('the cycle that collected the timeframe must be READY', () => {
  it.each(['PENDING', 'INCOMPLETE'])(
    '%s is STALE with CYCLE_NOT_READY',
    async (state) => {
      const { prisma, reader } = buildReader();
      putCycle(prisma, REFRESH_SLOT, {
        state,
        data_status: null,
        ready_at: null,
      });
      expect(
        await reader.getStatisticsAtSlot('best_fit_a', 'M5', REFRESH_SLOT)
      ).toMatchObject({
        status: 'STALE',
        reason: 'CYCLE_NOT_READY',
      });
    }
  );

  it('no cycle at all is STALE', async () => {
    const { reader } = buildReader();
    expect(
      await reader.getStatisticsAtSlot('best_fit_a', 'M5', REFRESH_SLOT)
    ).toMatchObject({
      status: 'STALE',
      reason: 'CYCLE_NOT_READY',
    });
  });

  it('M15 at 21:05 asks about the 21:00 cycle, not the 21:05 one', async () => {
    const { prisma, reader } = buildReader();
    putCycle(prisma, M5_ONLY_SLOT); // 21:05 READY
    putCycle(prisma, REFRESH_SLOT, {
      state: 'PENDING',
      data_status: null,
      ready_at: null,
    });
    putStatistic(prisma, 'non_b', 'M15', REFRESH_SLOT);
    expect(
      await reader.getStatisticsAtSlot('non_b', 'M15', M5_ONLY_SLOT)
    ).toMatchObject({
      status: 'STALE',
      reason: 'CYCLE_NOT_READY',
      collectedSlot: REFRESH_SLOT,
    });
  });

  it('a READY row that cannot be trusted is refused', async () => {
    const { prisma, reader } = buildReader();
    putCycle(prisma, REFRESH_SLOT, { data_status: 'MARKET_CLOSED' });
    putStatistic(prisma, 'best_fit_a', 'M5', REFRESH_SLOT);
    expect(
      await reader.getStatisticsAtSlot('best_fit_a', 'M5', REFRESH_SLOT)
    ).toMatchObject({
      status: 'STALE',
      reason: 'INVALID_CYCLE_ROW',
    });
  });

  it('every market_cycles query filters on state READY', async () => {
    const { prisma, reader } = buildReader();
    putCycle(prisma, REFRESH_SLOT);
    putStatistic(prisma, 'best_fit_a', 'M5', REFRESH_SLOT);
    await reader.getStatisticsAtSlot('best_fit_a', 'M5', REFRESH_SLOT);
    await reader.getStatisticsAtSlot('non_b', 'M15', M5_ONLY_SLOT);
    const queries = prisma.queries('marketCycle');
    expect(queries.length).toBeGreaterThan(0);
    for (const q of queries) expect(q.args.where.state).toBe('READY');
  });
});

describe('a cycle that went READY with statistics short (STATISTICS_SHORTFALL)', () => {
  it('the missing row is STALE with the shortfall as the reason', async () => {
    const { prisma, reader } = buildReader();
    putCycle(prisma, REFRESH_SLOT, { check_detail: SHORTFALL('M5', 3, 0) });
    expect(
      await reader.getStatisticsAtSlot('best_fit_a', 'M5', REFRESH_SLOT)
    ).toMatchObject({
      status: 'STALE',
      reason: 'STATISTICS_SHORTFALL',
      slot: REFRESH_SLOT,
    });
  });

  it('older rows do not rescue it', async () => {
    const { prisma, reader } = buildReader();
    putCycle(prisma, REFRESH_SLOT, { check_detail: SHORTFALL('M5', 3, 1) });
    for (let i = 1; i <= 6; i += 1)
      putStatistic(prisma, 'best_fit_a', 'M5', REFRESH_SLOT - i * 300);
    expect(
      await reader.getStatisticsAtSlot('best_fit_a', 'M5', REFRESH_SLOT)
    ).toMatchObject({
      status: 'STALE',
      reason: 'STATISTICS_SHORTFALL',
    });
  });

  it('the row that DID land is still returned: the shortfall is another source’s, and the reading says so', async () => {
    const { prisma, reader } = buildReader();
    putCycle(prisma, REFRESH_SLOT, { check_detail: SHORTFALL('M5', 3, 2) });
    putStatistic(prisma, 'best_fit_a', 'M5', REFRESH_SLOT);
    const result = await reader.getStatisticsAtSlot(
      'best_fit_a',
      'M5',
      REFRESH_SLOT
    );
    if (result.status !== 'OK') throw new Error('expected OK');
    expect(result.row.captured_at).toBe(REFRESH_SLOT);
    expect(result.cycle.checkReason).toBe('STATISTICS_SHORTFALL');
  });

  it('a shortfall recorded for the OTHER timeframe is just a missing row here', async () => {
    const { prisma, reader } = buildReader();
    putCycle(prisma, REFRESH_SLOT, { check_detail: SHORTFALL('M15', 3, 0) });
    expect(
      await reader.getStatisticsAtSlot('best_fit_a', 'M5', REFRESH_SLOT)
    ).toMatchObject({
      status: 'STALE',
      reason: 'NO_STATISTICS_AT_SLOT',
    });
    expect(
      await reader.getStatisticsAtSlot('non_b', 'M15', REFRESH_SLOT)
    ).toMatchObject({
      status: 'STALE',
      reason: 'STATISTICS_SHORTFALL',
    });
  });

  it('a shortfall whose counts show nothing short is a missing row, not a shortfall', async () => {
    const { prisma, reader } = buildReader();
    putCycle(prisma, REFRESH_SLOT, { check_detail: SHORTFALL('M5', 3, 3) });
    expect(
      await reader.getStatisticsAtSlot('best_fit_a', 'M5', REFRESH_SLOT)
    ).toMatchObject({
      status: 'STALE',
      reason: 'NO_STATISTICS_AT_SLOT',
    });
  });

  it('check_detail that is not what the gateway writes never turns into a shortfall', async () => {
    for (const checkDetail of [
      null,
      'STATISTICS_SHORTFALL',
      7,
      [],
      { reason: 5 },
    ]) {
      const { prisma, reader } = buildReader();
      putCycle(prisma, REFRESH_SLOT, { check_detail: checkDetail });
      expect(
        await reader.getStatisticsAtSlot('best_fit_a', 'M5', REFRESH_SLOT)
      ).toMatchObject({
        status: 'STALE',
        reason: 'NO_STATISTICS_AT_SLOT',
      });
    }
  });
});

describe('a caller bug throws; nothing is read', () => {
  it.each([
    ['a source nobody sends (a typo)', 'bestfit_a', 'M5', REFRESH_SLOT],
    ['no source', '', 'M5', REFRESH_SLOT],
    ['an unknown timeframe', 'best_fit_a', 'H1', REFRESH_SLOT],
    ['a slot that is "now"', 'best_fit_a', 'M5', REFRESH_SLOT + 1],
    ['a negative slot', 'best_fit_a', 'M5', -300],
  ])('%s', async (_label, source, timeframe, slot) => {
    const { prisma, reader } = buildReader();
    putCycle(prisma, REFRESH_SLOT);
    putStatistic(prisma, 'best_fit_a', 'M5', REFRESH_SLOT);
    await expect(
      reader.getStatisticsAtSlot(
        source as 'best_fit_a',
        timeframe as 'M5',
        slot
      )
    ).rejects.toThrow(RangeError);
    expect(prisma.queryLog).toHaveLength(0);
  });

  it('refuses a row from another slot even if the lookup returned one', async () => {
    const { prisma, reader } = buildReader();
    putCycle(prisma, REFRESH_SLOT);
    prisma.indicatorStatistic.findUnique = (async () => ({
      symbol: 'XAUUSD',
      timeframe: 'M5',
      source: 'best_fit_a',
      captured_at: REFRESH_SLOT - 300,
    })) as never;
    await expect(
      reader.getStatisticsAtSlot('best_fit_a', 'M5', REFRESH_SLOT)
    ).rejects.toThrow(/statistics row captured at/);
  });
});
