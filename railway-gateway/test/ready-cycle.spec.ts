import {
  CycleRow,
  checkReasonOf,
  invalidCycleRow,
  statisticsShortfallFor,
  toReaderCycle,
} from '../src/cycle/read/ready-cycle';
import {
  M5_ONLY_SLOT,
  REFRESH_SLOT,
  buildReader,
  putCycle,
  silenceLogs,
} from './helpers/reader-world';

/**
 * The READY-only cycle accessors and the helpers behind them. A market_cycles row
 * reaches a reader only through a query that filters state READY (the cycle
 * specs check the queries); this is the second wall, and the "which slot is
 * current" answer that Section 5 and the status endpoint build on.
 */

beforeEach(silenceLogs);
afterEach(() => jest.restoreAllMocks());

const row = (overrides: Partial<CycleRow> = {}): CycleRow => ({
  slot: REFRESH_SLOT,
  data_status: 'FRESH',
  ready_at: REFRESH_SLOT + 63,
  attempts: 1,
  retuning: false,
  closed_bars_digest: 'abc',
  check_detail: null,
  m5_export_at: REFRESH_SLOT - 1,
  m15_export_at: REFRESH_SLOT - 1,
  m5_collection_cycle_id: 2,
  manifest_received_at: REFRESH_SLOT + 61,
  collector_started_at: REFRESH_SLOT + 5,
  collector_validated_at: REFRESH_SLOT + 20,
  ...overrides,
});

describe('which READY rows can be trusted', () => {
  it('a well-formed row is usable', () => {
    expect(invalidCycleRow(row())).toBeNull();
  });

  it.each([
    ['no ready time', { ready_at: null }],
    ['a fractional ready time', { ready_at: REFRESH_SLOT + 0.5 }],
    ['ready before the slot', { ready_at: REFRESH_SLOT - 1 }],
    ['no status', { data_status: null }],
    ['STALE', { data_status: 'STALE' }],
    ['MARKET_CLOSED', { data_status: 'MARKET_CLOSED' }],
    ['a lower-case status', { data_status: 'fresh' }],
    ['zero attempts', { attempts: 0 }],
    ['fractional attempts', { attempts: 1.5 }],
  ])('refuses %s', (_label, bad) => {
    expect(invalidCycleRow(row(bad as Partial<CycleRow>))).not.toBeNull();
    expect(toReaderCycle(row(bad as Partial<CycleRow>))).toBeNull();
  });

  it('ready exactly at the slot is fine (a gateway clock a little behind), and DELAYED is a cycle status', () => {
    expect(toReaderCycle(row({ ready_at: REFRESH_SLOT }))).not.toBeNull();
    expect(toReaderCycle(row({ data_status: 'DELAYED' }))!.dataStatus).toBe(
      'DELAYED'
    );
  });

  it('maps a row to the reader’s view', () => {
    expect(
      toReaderCycle(
        row({
          retuning: true,
          attempts: 2,
          check_detail: { reason: 'STATISTICS_SHORTFALL' },
        })
      )
    ).toEqual({
      slot: REFRESH_SLOT,
      dataStatus: 'FRESH',
      readyAt: REFRESH_SLOT + 63,
      attempts: 2,
      retuning: true,
      closedBarsDigest: 'abc',
      checkReason: 'STATISTICS_SHORTFALL',
      m5ExportAt: REFRESH_SLOT - 1,
      m15ExportAt: REFRESH_SLOT - 1,
      m5CollectionCycleId: 2,
      manifestReceivedAt: REFRESH_SLOT + 61,
      collectorStartedAt: REFRESH_SLOT + 5,
      collectorValidatedAt: REFRESH_SLOT + 20,
    });
  });
});

describe('reading check_detail, a free JSON column', () => {
  it('the reason, when it is a string in an object', () => {
    expect(checkReasonOf({ reason: 'STATISTICS_SHORTFALL' })).toBe(
      'STATISTICS_SHORTFALL'
    );
    for (const v of [null, undefined, 'x', 7, [], { reason: 5 }, {}]) {
      expect(checkReasonOf(v)).toBeNull();
    }
  });

  const detail = (timeframes: unknown, reason = 'STATISTICS_SHORTFALL') => ({
    reason,
    timeframes,
  });
  const counts = (expected: number, landed: number) => ({
    statistics: { expected, landed },
  });

  it('short exactly when fewer landed than expected for the timeframe', () => {
    expect(statisticsShortfallFor(detail({ M5: counts(3, 2) }), 'M5')).toBe(
      true
    );
    expect(statisticsShortfallFor(detail({ M5: counts(3, 0) }), 'M5')).toBe(
      true
    );
    expect(statisticsShortfallFor(detail({ M5: counts(3, 3) }), 'M5')).toBe(
      false
    );
    expect(statisticsShortfallFor(detail({ M5: counts(3, 4) }), 'M5')).toBe(
      false
    );
  });

  it('each timeframe on its own counts', () => {
    const d = detail({ M5: counts(3, 3), M15: counts(3, 1) });
    expect(statisticsShortfallFor(d, 'M5')).toBe(false);
    expect(statisticsShortfallFor(d, 'M15')).toBe(true);
  });

  it('a timeframe the map does not list had nothing short', () => {
    expect(statisticsShortfallFor(detail({ M15: counts(3, 0) }), 'M5')).toBe(
      false
    );
  });

  it('only the STATISTICS_SHORTFALL reason counts', () => {
    for (const reason of [
      'LANDED_ROWS_MISSING',
      'NEWEST_ROW_NOT_CURRENT',
      'STALE_MANIFEST',
      'x',
    ]) {
      expect(
        statisticsShortfallFor(detail({ M5: counts(3, 0) }, reason), 'M5')
      ).toBe(false);
    }
    expect(statisticsShortfallFor(null, 'M5')).toBe(false);
    expect(statisticsShortfallFor('STATISTICS_SHORTFALL', 'M5')).toBe(false);
    expect(statisticsShortfallFor([], 'M5')).toBe(false);
  });

  it('a record that says shortfall but cannot say where counts for every timeframe', () => {
    expect(
      statisticsShortfallFor({ reason: 'STATISTICS_SHORTFALL' }, 'M5')
    ).toBe(true);
    expect(statisticsShortfallFor(detail('nonsense'), 'M15')).toBe(true);
    expect(statisticsShortfallFor(detail({ M5: {} }), 'M5')).toBe(true);
    expect(
      statisticsShortfallFor(
        detail({ M5: { statistics: { expected: 'a', landed: 1 } } }),
        'M5'
      )
    ).toBe(true);
  });
});

describe('getReadyCycle(slot)', () => {
  it('the READY cycle at the slot', async () => {
    const { prisma, reader } = buildReader();
    putCycle(prisma, REFRESH_SLOT);
    expect(await reader.getReadyCycle(REFRESH_SLOT)).toMatchObject({
      slot: REFRESH_SLOT,
      dataStatus: 'FRESH',
    });
  });

  it.each(['PENDING', 'INCOMPLETE'])('null for a %s cycle', async (state) => {
    const { prisma, reader } = buildReader();
    putCycle(prisma, REFRESH_SLOT, {
      state,
      data_status: null,
      ready_at: null,
    });
    expect(await reader.getReadyCycle(REFRESH_SLOT)).toBeNull();
  });

  it('null for no cycle, and for an unusable READY row', async () => {
    const { prisma, reader } = buildReader();
    expect(await reader.getReadyCycle(REFRESH_SLOT)).toBeNull();
    putCycle(prisma, REFRESH_SLOT, { ready_at: null });
    expect(await reader.getReadyCycle(REFRESH_SLOT)).toBeNull();
  });

  it('a slot that is not a slot throws, without a query', async () => {
    const { prisma, reader } = buildReader();
    await expect(reader.getReadyCycle(REFRESH_SLOT + 1)).rejects.toThrow(
      RangeError
    );
    expect(prisma.queryLog).toHaveLength(0);
  });
});

describe('getNewestReadyCycle()', () => {
  it('the newest READY cycle by slot', async () => {
    const { prisma, reader } = buildReader();
    putCycle(prisma, REFRESH_SLOT - 300);
    putCycle(prisma, REFRESH_SLOT);
    putCycle(prisma, REFRESH_SLOT - 600);
    expect((await reader.getNewestReadyCycle())!.slot).toBe(REFRESH_SLOT);
  });

  it('a newer PENDING or INCOMPLETE cycle never hides it', async () => {
    const { prisma, reader } = buildReader();
    putCycle(prisma, REFRESH_SLOT);
    putCycle(prisma, M5_ONLY_SLOT, {
      state: 'PENDING',
      data_status: null,
      ready_at: null,
    });
    putCycle(prisma, M5_ONLY_SLOT + 300, {
      state: 'INCOMPLETE',
      data_status: null,
      ready_at: null,
    });
    expect((await reader.getNewestReadyCycle())!.slot).toBe(REFRESH_SLOT);
  });

  it('null when nothing is READY', async () => {
    const { prisma, reader } = buildReader();
    expect(await reader.getNewestReadyCycle()).toBeNull();
    putCycle(prisma, REFRESH_SLOT, {
      state: 'PENDING',
      data_status: null,
      ready_at: null,
    });
    expect(await reader.getNewestReadyCycle()).toBeNull();
  });

  it('an unusable newest READY row is null, never the cycle before it (fail closed)', async () => {
    const { prisma, reader } = buildReader();
    putCycle(prisma, REFRESH_SLOT - 300);
    putCycle(prisma, REFRESH_SLOT, { data_status: null });
    expect(await reader.getNewestReadyCycle()).toBeNull();
  });

  it('asks only for READY rows, newest slot first', async () => {
    const { prisma, reader } = buildReader();
    putCycle(prisma, REFRESH_SLOT);
    await reader.getNewestReadyCycle();
    const [query] = prisma.queries('marketCycle', 'findFirst');
    expect(query.args.where).toEqual({ symbol: 'XAUUSD', state: 'READY' });
    expect(query.args.orderBy).toEqual({ slot: 'desc' });
  });

  it('selects only the columns it reports', async () => {
    const { prisma, reader } = buildReader();
    putCycle(prisma, REFRESH_SLOT);
    await reader.getNewestReadyCycle();
    const select = prisma.queries('marketCycle')[0].args.select;
    expect(Object.keys(select).sort()).toEqual(
      [
        'attempts',
        'check_detail',
        'closed_bars_digest',
        'collector_started_at',
        'collector_validated_at',
        'data_status',
        'm15_export_at',
        'manifest_received_at',
        'm5_collection_cycle_id',
        'm5_export_at',
        'ready_at',
        'retuning',
        'slot',
      ].sort()
    );
  });
});
