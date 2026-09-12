import { CurrencyIndexCorridorAggregatorService } from '../src/worker/currency-index-corridor-aggregator.service';

// A new session opens for every FX index at the same instant (00:00
// server time) -- USDX's own transition is used throughout as the
// representative trigger, matching how the real engine pushes all 8
// simultaneously.
const DAY1_OPEN = 1_800_000_000; // day that will be finalized
const DAY2_OPEN = 1_800_086_400; // "today" -- the day whose corridor gets computed (+24h)

function makePrismaMock() {
  return {
    currencyGoldIndex: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    dailyVolatilityCorridor: {
      findUnique: jest.fn(),
      upsert: jest.fn().mockResolvedValue({}),
    },
    dailyCurrencyIndexMetrics: {
      findMany: jest.fn(),
      upsert: jest.fn().mockResolvedValue({}),
    },
  };
}

type PrismaMock = ReturnType<typeof makePrismaMock>;

describe('CurrencyIndexCorridorAggregatorService', () => {
  let prisma: PrismaMock;
  let service: CurrencyIndexCorridorAggregatorService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new CurrencyIndexCorridorAggregatorService(prisma as any);
  });

  it('no-ops when Lane 4 has never pushed any data', async () => {
    prisma.currencyGoldIndex.findFirst.mockResolvedValue(null);

    await service.run();

    expect(prisma.dailyVolatilityCorridor.findUnique).not.toHaveBeenCalled();
    expect(prisma.dailyCurrencyIndexMetrics.upsert).not.toHaveBeenCalled();
  });

  it('is idempotent: no-ops when a corridor for today already exists', async () => {
    prisma.currencyGoldIndex.findFirst.mockResolvedValue({
      session_open_bar_time: DAY2_OPEN,
    });
    prisma.dailyVolatilityCorridor.findUnique.mockResolvedValue({
      id: 'already-done',
    });

    await service.run();

    // Must not re-derive the previous session or touch metrics/corridor
    // writes on a tick that already finalized today.
    expect(prisma.currencyGoldIndex.findMany).not.toHaveBeenCalled();
    expect(prisma.dailyCurrencyIndexMetrics.upsert).not.toHaveBeenCalled();
    expect(prisma.dailyVolatilityCorridor.upsert).not.toHaveBeenCalled();
  });

  it("skips finalization and corridor computation on Lane 4's very first day (bootstrap, no prior session)", async () => {
    prisma.currencyGoldIndex.findFirst
      .mockResolvedValueOnce({ session_open_bar_time: DAY1_OPEN }) // latest
      .mockResolvedValueOnce(null); // no previous session exists yet
    prisma.dailyVolatilityCorridor.findUnique.mockResolvedValue(null);
    prisma.dailyCurrencyIndexMetrics.findMany.mockResolvedValue([]); // no prior days finalized yet either

    await service.run();

    expect(prisma.currencyGoldIndex.findMany).not.toHaveBeenCalled();
    expect(prisma.dailyCurrencyIndexMetrics.upsert).not.toHaveBeenCalled();
    // computeAndStoreCorridor still runs, but with zero prior closed days
    // it must find nothing to pool and stop without writing.
    expect(prisma.dailyCurrencyIndexMetrics.findMany).toHaveBeenCalled();
  });

  it('finalizes the just-closed day for each of the 8 FX indices, then computes the new corridor', async () => {
    prisma.currencyGoldIndex.findFirst
      .mockResolvedValueOnce({ session_open_bar_time: DAY2_OPEN }) // latest
      .mockResolvedValueOnce({ session_open_bar_time: DAY1_OPEN }); // previous
    prisma.dailyVolatilityCorridor.findUnique.mockResolvedValue(null);

    // Every index has the same simple bar sequence for day 1.
    prisma.currencyGoldIndex.findMany.mockResolvedValue([
      { bar_time: DAY1_OPEN, value: 100.0, change_pct: 0.0 },
      { bar_time: DAY1_OPEN + 300, value: 100.5, change_pct: 0.5 },
    ]);

    // One prior closed day available for the corridor lookback.
    prisma.dailyCurrencyIndexMetrics.findMany
      .mockResolvedValueOnce([{ date: DAY1_OPEN }]) // distinct dates query
      .mockResolvedValueOnce([
        { peak_high_pct: 0.5, peak_low_pct: 0.0 },
        { peak_high_pct: 0.3, peak_low_pct: 0.1 },
      ]); // pooled metrics for the corridor

    await service.run();

    // One upsert per FX index (8), not per all 9 CurrencyGoldIndex names.
    expect(prisma.dailyCurrencyIndexMetrics.upsert).toHaveBeenCalledTimes(8);
    expect(prisma.dailyCurrencyIndexMetrics.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          date_index_name: { date: DAY1_OPEN, index_name: 'USDX' },
        },
        create: expect.objectContaining({
          date: DAY1_OPEN,
          index_name: 'USDX',
          open_value: 100.0,
          peak_high_pct: 0.5,
          peak_low_pct: 0,
          close_pct: 0.5,
        }),
      })
    );

    expect(prisma.dailyVolatilityCorridor.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.dailyVolatilityCorridor.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { date: DAY2_OPEN },
        create: expect.objectContaining({
          date: DAY2_OPEN,
          lookback_days: 1,
        }),
      })
    );
  });

  it('skips an FX index with zero bars that day rather than fabricating a row', async () => {
    prisma.currencyGoldIndex.findFirst
      .mockResolvedValueOnce({ session_open_bar_time: DAY2_OPEN })
      .mockResolvedValueOnce({ session_open_bar_time: DAY1_OPEN });
    prisma.dailyVolatilityCorridor.findUnique.mockResolvedValue(null);
    prisma.currencyGoldIndex.findMany.mockResolvedValue([]); // no data for any index that day
    prisma.dailyCurrencyIndexMetrics.findMany.mockResolvedValue([]); // and no prior days for the corridor either

    await service.run();

    expect(prisma.dailyCurrencyIndexMetrics.upsert).not.toHaveBeenCalled();
    expect(prisma.dailyVolatilityCorridor.upsert).not.toHaveBeenCalled();
  });
});
