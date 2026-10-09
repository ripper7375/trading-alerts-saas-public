import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import { lastClosedBarOpen } from '../src/cycle/slot';
import {
  BAR_COLUMNS,
  REFUSED_DATA_STATUS,
  SR_COLUMNS,
  barsNotClosed,
  bundleProblems,
} from '../src/sensors/inputs/bundle-types';
import { DatabaseInputsSource } from '../src/sensors/inputs/database-inputs.source';
import type { LoadedInputs } from '../src/sensors/inputs/inputs-source';
import { DROPPED_STATISTICS_FIELDS } from '../src/sensors/inputs/statistics-fields';
import { slotToIso } from '../src/sensors/inputs/stats-slot';
import {
  FIXTURE_SLOTS,
  FixtureSlot,
  readFixtureBundle,
} from './helpers/cycle-fixtures';
import {
  FakeIndicators,
  FakeInputsPrisma,
  POISON,
  SeedOptions,
  SeedPlan,
  ambiguousUnusedSources,
  buildSeedPlan,
  bundleDifferences,
  loaderForm,
} from './helpers/inputs-world';
import { blankComments } from './helpers/latest-statistics-scan';

/**
 * The database source against an in-memory stand-in for Prisma (the gated Postgres
 * spec, test/sensors-inputs.pg.spec.ts, asks the same questions of a real database).
 * The world is a STORED cycle (v1, v3 or v4) laid out as rows, plus what the loader must
 * not read: the bar forming at the slot, bars after it, statistics of the slots either
 * side, and the statistics fields that describe the forming bar, all with values that
 * would show if they leaked.
 */

interface World {
  fixture: FixtureSlot;
  plan: SeedPlan;
  prisma: FakeInputsPrisma;
  indicators: FakeIndicators;
  source: DatabaseInputsSource;
}

function world(fixture: FixtureSlot, options?: SeedOptions): World {
  const plan = buildSeedPlan(readFixtureBundle(fixture), options);
  const prisma = new FakeInputsPrisma().apply(plan);
  const indicators = FakeIndicators.fromPlan(plan);
  return {
    fixture,
    plan,
    prisma,
    indicators,
    source: new DatabaseInputsSource(prisma.asPrisma(), indicators.asService()),
  };
}

const V1 = FIXTURE_SLOTS[0];

async function loaded(
  w: World
): Promise<Extract<LoadedInputs, { status: 'OK' }>> {
  const result = await w.source.loadCycleInputs('XAUUSD', w.plan.slot);
  if (result.status !== 'OK')
    throw new Error(`expected OK, got ${JSON.stringify(result)}`);
  return result;
}

/** The cycle row (of the plan) at a slot, for a test to spoil. */
const cycleAt = (w: World, slot: number) =>
  w.prisma.cycles.find((c) => c['slot'] === slot) as Record<string, unknown>;

let warn: jest.SpyInstance;
beforeEach(() => {
  warn = jest
    .spyOn(Logger.prototype, 'warn')
    .mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe.each(FIXTURE_SLOTS.map((f) => [f.name, f] as const))(
  'the stored cycle %s, laid out as rows and loaded back',
  (name, fixture) => {
    it('gives the stored bundle in the loader’s form: same bars (carrying what the evaluators read), statistics, setting, hashes and modes', async () => {
      const w = world(fixture);
      const { bundle, provenance } = await loaded(w);
      const stored = readFixtureBundle(fixture);
      const ambiguous = ambiguousUnusedSources(stored);
      expect(ambiguous).toEqual(name === 'v1' ? [] : ['sr_levels']);
      expect(bundleDifferences(bundle, loaderForm(stored))).toEqual([]);
      expect(
        provenance.notes.filter((n) => n.startsWith('config_hash of'))
      ).toEqual(
        ambiguous.map(
          (source) =>
            `config_hash of ${source} left out: M5 and M15 recorded different values and no timeframe uses it`
        )
      );
    });

    it('is a bundle the runner can read, with no bar that is open at the slot', async () => {
      const { bundle } = await loaded(world(fixture));
      expect(bundleProblems(bundle)).toEqual([]);
      expect(barsNotClosed(bundle)).toEqual([]);
    });

    it('nothing of what the table held for the forming bar, the bars after it, the neighbouring slots’ statistics or the live-bar columns got in', async () => {
      const w = world(fixture);
      expect(w.plan.bars.some((b) => b['close'] === POISON)).toBe(true); // the traps are really in the table
      expect(
        w.plan.statistics.some((s) => s['containment_rate'] === 1.25)
      ).toBe(true);
      const { bundle } = await loaded(w);
      const text = JSON.stringify(bundle);
      expect(text).not.toContain('424242');
      expect(text).not.toContain('1.25,');
      for (const sources of Object.values(bundle.statistics)) {
        for (const row of Object.values(sources ?? {})) {
          for (const field of DROPPED_STATISTICS_FIELDS)
            expect(row).not.toHaveProperty(field);
        }
      }
    });

    it('reports what it did: the cycle’s own status, RETUNING, the statistics slots, how many bars it asked for and got', async () => {
      const w = world(fixture);
      const { provenance, bundle } = await loaded(w);
      expect(provenance).toMatchObject({
        origin: 'database',
        slot: w.plan.slot,
        dataStatus: 'FRESH',
        retuning: false,
        collected: { M5: true, M15: true },
        refusals: [],
      });
      expect(provenance.barCounts).toEqual({
        M5: bundle.bars.M5.length,
        M15: bundle.bars.M15.length,
      });
      expect(provenance.statsSlot.M5).toBe(w.plan.slot);
      expect(slotToIso(provenance.statsSlot.M15)).toBe(bundle.stats_slot.M15);
    });
  }
);

describe('a cycle that is not ready', () => {
  it('has no READY row at the slot: NOT_READY / CYCLE_NOT_READY, so the worker can wait for the commit (the job is announced just before it)', async () => {
    const w = world(V1);
    w.prisma.cycles = [];
    expect(await w.source.loadCycleInputs('XAUUSD', w.plan.slot)).toEqual({
      status: 'NOT_READY',
      reason: 'CYCLE_NOT_READY',
      slot: w.plan.slot,
      detail: `no READY market_cycles row at slot ${w.plan.slot}`,
    });
  });

  it.each(['PENDING', 'INCOMPLETE'])(
    'a %s row is never consulted, however complete the bars and statistics look',
    async (state) => {
      const w = world(V1);
      cycleAt(w, w.plan.slot)['state'] = state;
      const result = await w.source.loadCycleInputs('XAUUSD', w.plan.slot);
      expect(result).toMatchObject({
        status: 'NOT_READY',
        reason: 'CYCLE_NOT_READY',
      });
      expect(w.prisma.queries('marketCycle')[0].args.where.state).toBe('READY');
      // nothing else was read for a cycle that is not ready
      expect(w.prisma.queries('marketDataV6')).toHaveLength(0);
      expect(w.prisma.queries('indicatorStatistic')).toHaveLength(0);
    }
  );

  it.each([
    ['no ready time', { ready_at: null }, /ready_at is null/],
    ['a ready time before the slot', { ready_at: 5 }, /before the slot/],
    [
      'a data status that is not FRESH or DELAYED',
      { data_status: 'STALE' },
      /data_status is STALE/,
    ],
    ['no data status', { data_status: null }, /data_status is null/],
    ['an impossible attempts count', { attempts: 0 }, /attempts is 0/],
    [
      'unreadable hashes',
      { config_hashes: [] },
      /unreadable tuning: config_hashes is not an object/,
    ],
    [
      'an unknown mode',
      { source_modes: { M5: { best_fit_a: 'MAYBE' } } },
      /source_modes.M5.best_fit_a/,
    ],
  ])(
    'a READY row with %s cannot be trusted: NOT_READY / INVALID_CYCLE_ROW',
    async (_label, spoil, expected) => {
      const w = world(V1);
      Object.assign(cycleAt(w, w.plan.slot), spoil);
      const result = await w.source.loadCycleInputs('XAUUSD', w.plan.slot);
      expect(result).toMatchObject({
        status: 'NOT_READY',
        reason: 'INVALID_CYCLE_ROW',
      });
      expect((result as { detail: string }).detail).toMatch(expected);
    }
  );
});

describe('what a caller may ask for', () => {
  it.each([['EURUSD'], [''], ['xauusd']])(
    'refuses the symbol %p: this pipeline carries XAUUSD only',
    async (symbol) => {
      const w = world(V1);
      await expect(
        w.source.loadCycleInputs(symbol, w.plan.slot)
      ).rejects.toThrow(RangeError);
    }
  );

  it.each([[1789764901], [1.5], [NaN], [-300], [Number.POSITIVE_INFINITY]])(
    'refuses %p as a slot (a caller bug, not a data condition)',
    async (slot) => {
      const w = world(V1);
      await expect(w.source.loadCycleInputs('XAUUSD', slot)).rejects.toThrow(
        RangeError
      );
      expect(w.prisma.queryLog).toHaveLength(0);
    }
  );
});

describe('rule 2: closed bars only', () => {
  it('selects at or before the open time of the last bar that is closed at the slot, newest first, with the bundle’s columns and no OHLC', async () => {
    const w = world(V1);
    await loaded(w);
    const queries = w.prisma.queries('marketDataV6');
    expect(queries).toHaveLength(2);
    for (const q of queries) {
      const timeframe = q.args.where.timeframe as 'M5' | 'M15';
      expect(q.args.where).toEqual({
        symbol: 'XAUUSD',
        timeframe,
        timestamp: { lte: lastClosedBarOpen(timeframe, w.plan.slot) },
      });
      expect(q.args.orderBy).toEqual({ timestamp: 'desc' });
      expect(Object.keys(q.args.select).sort()).toEqual([...BAR_COLUMNS]);
      for (const column of ['open', 'high', 'low', 'volume'])
        expect(q.args.select).not.toHaveProperty(column);
    }
  });

  it('the newest bars are the last closed ones, oldest first, whatever order the table answers in', async () => {
    const w = world(V1);
    const { bundle } = await loaded(w);
    expect(bundle.bars.M5[bundle.bars.M5.length - 1].timestamp).toBe(
      w.plan.slot - 300
    );
    expect(bundle.bars.M15[bundle.bars.M15.length - 1].timestamp).toBe(
      lastClosedBarOpen('M15', w.plan.slot)
    );
    for (const timeframe of ['M5', 'M15'] as const) {
      const stamps = bundle.bars[timeframe].map((b) => b.timestamp);
      expect(stamps).toEqual([...stamps].sort((a, b) => a - b));
    }
  });

  it('a still-open bar that gets out of the query anyway is a bug and stops the load', async () => {
    const w = world(V1);
    const real = w.prisma.marketDataV6.findMany;
    w.prisma.marketDataV6.findMany = async (args) => [
      ...(await real(args)),
      { timestamp: w.plan.slot, close: 1 }, // the M5 bar forming at the slot
    ];
    await expect(
      w.source.loadCycleInputs('XAUUSD', w.plan.slot)
    ).rejects.toThrow(/still-open M5 bar/);
  });

  it('a NaN in a channel column becomes null (JSON has none), so the evaluators see a missing value', async () => {
    const w = world(V1);
    const last = w.prisma.bars.find(
      (b) => b['timeframe'] === 'M5' && b['timestamp'] === w.plan.slot - 300
    )!;
    last['best_fit_a_ssa'] = NaN;
    const { bundle } = await loaded(w);
    expect(
      bundle.bars.M5[bundle.bars.M5.length - 1]['best_fit_a_ssa']
    ).toBeNull();
  });
});

describe('the columns a bar carries are the ones the evaluators read', () => {
  const sorted = (bar: object) => Object.keys(bar).sort();

  it('every bar but the last carries the open time, the close and the ACTIVE indicator’s four channel columns', async () => {
    const { bundle } = await loaded(world(V1));
    for (const [timeframe, indicator] of [
      ['M5', 'best_fit_a'],
      ['M15', 'non_b'],
    ] as const) {
      const bars = bundle.bars[timeframe];
      const expected = [
        'timestamp',
        'close',
        `${indicator}_base_fl`,
        `${indicator}_loedt`,
        `${indicator}_ssa`,
        `${indicator}_uoedt`,
      ].sort();
      expect(bars.length).toBeGreaterThan(100);
      for (const bar of bars.slice(0, -1))
        expect(sorted(bar)).toEqual(expected);
    }
  });

  it('the last closed bar of each timeframe carries all 33 columns: the tier-1 cross-check asks every candidate about it', async () => {
    const { bundle } = await loaded(world(V1));
    for (const timeframe of ['M5', 'M15'] as const) {
      const bars = bundle.bars[timeframe];
      expect(sorted(bars[bars.length - 1])).toEqual([...BAR_COLUMNS]);
    }
    expect(BAR_COLUMNS).toHaveLength(33);
  });

  it('the fractal EDT as the active M5 indicator has three channel columns (its baseline is its fit)', async () => {
    const w = world(V1);
    w.indicators.settings = { M5: 'fractal_edt', M15: 'non_b' };
    const { bundle } = await loaded(w);
    expect(sorted(bundle.bars.M5[0])).toEqual([
      'close',
      'fractal_best_fl',
      'fractal_loedt',
      'fractal_uoedt',
      'timestamp',
    ]);
  });

  it('with no setting for a timeframe the older bars carry the open time and the close only, the last bar still every candidate', async () => {
    const w = world(V1);
    w.indicators.settings = { M15: 'non_b' };
    const { bundle } = await loaded(w);
    const m5 = bundle.bars.M5;
    expect(sorted(m5[0])).toEqual(['close', 'timestamp']);
    expect(sorted(m5[m5.length - 1])).toEqual([...BAR_COLUMNS]);
  });

  it('a timeframe with a single bar has only a last bar: all 33 columns', async () => {
    const w = world(V1, { keepBars: { M5: 1 } });
    const { bundle } = await loaded(w);
    expect(bundle.bars.M5).toHaveLength(1);
    expect(sorted(bundle.bars.M5[0])).toEqual([...BAR_COLUMNS]);
  });

  it('the query still selects every column (the trimming is done on what came back, so the last bar and its window are one read)', async () => {
    const w = world(V1);
    await loaded(w);
    for (const q of w.prisma.queries('marketDataV6')) {
      expect(Object.keys(q.args.select).sort()).toEqual([...BAR_COLUMNS]);
    }
  });
});

describe('ADR-083: the whole closed channel, no window arithmetic', () => {
  it('asks for the channel’s length (755 for v1’s M5), not the length less the open bar row; the table holds 754 and 754 come back, unpadded', async () => {
    const w = world(V1);
    const { provenance, bundle } = await loaded(w);
    expect(provenance.barsRequested.M5).toBe(755);
    expect(bundle.bars.M5).toHaveLength(754);
    expect(provenance.barCounts.M5).toBe(754);
    expect(w.prisma.queries('marketDataV6')[0].args.take).toBe(755);
  });

  it('with more bars in the table than the channel is long it sends the newest ones only', async () => {
    const w = world(V1);
    for (const field of [
      'containment_n',
      'visual_window_bars',
      'window_bars',
    ]) {
      for (const row of w.prisma.statistics) {
        if (row['timeframe'] === 'M5' && row['source'] === 'best_fit_a')
          row[field] = 300;
      }
    }
    const { bundle, provenance } = await loaded(w);
    expect(provenance.barsRequested.M5).toBe(300);
    expect(bundle.bars.M5).toHaveLength(300);
    // the 300 newest of the table’s closed bars (not 300 slots back: the table skips market-closed gaps)
    expect(bundle.bars.M5).toEqual(
      loaderForm(readFixtureBundle(V1)).bars.M5.slice(-300)
    );
    expect(bundle.bars.M5[299].timestamp).toBe(w.plan.slot - 300);
  });

  it('fewer bars in the table than asked for are handed over as they are: never padded', async () => {
    const w = world(V1, { keepBars: { M5: 50 } });
    const { bundle } = await loaded(w);
    expect(bundle.bars.M5).toHaveLength(50);
    expect(w.prisma.queries('marketDataV6')[0].args.take).toBe(755);
  });

  it('a short M15 channel beside a long M5 one still gets enough M15 bars to cover the M5 channel in time (MCD3)', async () => {
    const w = world(V1);
    for (const row of w.prisma.statistics) {
      if (row['timeframe'] === 'M15' && row['source'] === 'non_b') {
        row['containment_n'] = 100;
        row['visual_window_bars'] = 100;
        row['window_bars'] = 100;
      }
    }
    const { provenance } = await loaded(w);
    expect(provenance.barsRequested.M15).toBe(Math.ceil(755 / 3) + 2);
  });

  it('with no statistics row for a timeframe it sends one day (288 M5, 96 M15) and the evaluators answer STALE', async () => {
    const w = world(V1);
    w.prisma.statistics = [];
    const { provenance, bundle } = await loaded(w);
    expect(provenance.barsRequested).toEqual({ M5: 288, M15: 96 });
    expect(bundle.statistics).toEqual({});
  });
});

describe('rule 5: statistics at the slot', () => {
  it('reads each timeframe at ONE captured_at: the slot it was last collected at (M15 at 20:55 is 20:45), never ordered by time', async () => {
    const w = world(V1);
    await loaded(w);
    const queries = w.prisma.queries('indicatorStatistic');
    expect(
      queries.map((q) => [q.args.where.timeframe, q.args.where.captured_at])
    ).toEqual([
      ['M5', w.plan.slot],
      ['M15', w.plan.slot - 600],
    ]);
    for (const q of queries) {
      expect(q.args.orderBy).toEqual({ source: 'asc' });
      expect(q.args).not.toHaveProperty('take');
      expect(q.args).not.toHaveProperty('distinct');
    }
  });

  it('on a refresh slot both timeframes are read at the slot itself', async () => {
    const w = world(FIXTURE_SLOTS[1]); // 14:15, a quarter hour
    await loaded(w);
    expect(
      w.prisma
        .queries('indicatorStatistic')
        .map((q) => q.args.where.captured_at)
    ).toEqual([w.plan.slot, w.plan.slot]);
  });

  it('a source with no row at the slot is a missing key, whatever the slots either side hold (a missing row is STALE, never the latest available)', async () => {
    const w = world(V1);
    w.prisma.statistics = w.prisma.statistics.filter(
      (r) =>
        !(
          r['timeframe'] === 'M15' &&
          r['source'] === 'non_b' &&
          r['captured_at'] === w.plan.slot - 600
        )
    );
    expect(
      w.prisma.statistics.some(
        (r) => r['source'] === 'non_b' && r['timeframe'] === 'M15'
      )
    ).toBe(true); // the decoys are still there
    const { bundle } = await loaded(w);
    expect(Object.keys(bundle.statistics.M15 ?? {})).toEqual(['sr_levels']);
    expect(bundle.statistics.M5).toBeDefined();
  });

  it('a timeframe with no row at all is absent from the bundle, not an empty object (the kit’s own to_dict() leaves it out)', async () => {
    const w = world(V1);
    w.prisma.statistics = w.prisma.statistics.filter(
      (r) => r['timeframe'] !== 'M15'
    );
    const { bundle } = await loaded(w);
    expect(Object.keys(bundle.statistics)).toEqual(['M5']);
  });

  it('a row of another slot handed back by a changed query is caught, not used', async () => {
    const w = world(V1);
    const real = w.prisma.indicatorStatistic.findMany;
    w.prisma.indicatorStatistic.findMany = async (args) =>
      (await real(args)).map((r) => ({
        ...r,
        captured_at: args.where.captured_at - 300,
      }));
    await expect(
      w.source.loadCycleInputs('XAUUSD', w.plan.slot)
    ).rejects.toThrow(/statistics row captured at/);
  });

  it('carries captured_at in the row, so tier 4 can compare it with stats_slot', async () => {
    const { bundle } = await loaded(world(V1));
    expect(bundle.statistics.M15!['non_b']['captured_at']).toBe(V1.slot - 600);
    expect(bundle.statistics.M5!['best_fit_a']['captured_at']).toBe(V1.slot);
  });
});

describe('rule 6: the setting', () => {
  it('is resolved once, for the cycle’s slot, so the sensors switch with the chart and the UI', async () => {
    const w = world(V1);
    await loaded(w);
    expect(w.indicators.asked).toEqual([w.plan.slot]);
  });

  it('is passed in the kit’s names: fractal_edt is "fractal"', async () => {
    const w = world(V1);
    w.indicators.settings = { M5: 'fractal_edt', M15: 'non_b' };
    expect((await loaded(w)).bundle.active_indicator).toEqual({
      M5: 'fractal',
      M15: 'non_b',
    });
  });

  it('a timeframe with no setting is absent (the evaluators answer INVALID + NO_SETTING), never guessed from the data', async () => {
    const w = world(V1);
    w.indicators.settings = { M5: 'best_fit_a', M15: null };
    expect((await loaded(w)).bundle.active_indicator).toEqual({
      M5: 'best_fit_a',
    });
    w.indicators.settings = {};
    expect((await loaded(w)).bundle.active_indicator).toEqual({});
  });

  it('a setting that changes the active indicator changes the rows the channel length is read from', async () => {
    const w = world(V1);
    w.indicators.settings = { M5: 'fractal_edt', M15: 'non_b' };
    const { provenance } = await loaded(w);
    expect(provenance.barsRequested.M5).toBe(336); // v1’s fractal EDT channel
  });
});

describe('rule 9 and the tuning: from the READY row of the cycle that collected each timeframe', () => {
  it('RETUNING is read from the row at the slot, and a DELAYED cycle says so', async () => {
    const w = world(V1);
    Object.assign(cycleAt(w, w.plan.slot), {
      retuning: true,
      data_status: 'DELAYED',
    });
    const { bundle, provenance } = await loaded(w);
    expect(bundle.retuning).toBe(true);
    expect(bundle.data_status).toBe('DELAYED');
    expect(provenance).toMatchObject({ retuning: true, dataStatus: 'DELAYED' });
  });

  it('the M15 hashes and modes come from the cycle that collected M15 (20:45 for the 20:55 slot), the M5 ones from the cycle at the slot', async () => {
    const w = world(V1);
    const m15Cycle = cycleAt(w, w.plan.slot - 600);
    const atSlot = cycleAt(w, w.plan.slot);
    expect(Object.keys(atSlot['config_hashes'] as object)).toEqual(['M5']);
    expect(Object.keys(m15Cycle['config_hashes'] as object)).toEqual(['M15']);
    m15Cycle['config_hashes'] = {
      M15: { non_b: 'tuned-at-2045', sr_levels: 'c6f0' },
    };
    const { bundle } = await loaded(w);
    expect(bundle.config_hash['non_b']).toBe('tuned-at-2045');
  });

  it('M15’s RETUNING is not the slot’s: only the row at the slot decides', async () => {
    const w = world(V1);
    cycleAt(w, w.plan.slot - 600)['retuning'] = true;
    expect((await loaded(w)).bundle.retuning).toBe(false);
  });

  it('a row with no tuning recorded (NULL columns) gives empty maps, not an error', async () => {
    const w = world(FIXTURE_SLOTS[1]);
    Object.assign(cycleAt(w, w.plan.slot), {
      config_hashes: null,
      source_modes: null,
    });
    const { bundle } = await loaded(w);
    expect(bundle.config_hash).toEqual({});
    expect(bundle.channel_mode).toEqual({});
  });
});

describe('a timeframe whose collecting cycle is not usable is left out, and its readers answer STALE', () => {
  const m15Slot = V1.slot - 600;

  it.each([
    [
      'is missing',
      (w: World) =>
        (w.prisma.cycles = w.prisma.cycles.filter(
          (c) => c['slot'] !== m15Slot
        )),
      /no READY market_cycles row/,
    ],
    [
      'is PENDING',
      (w: World) => (cycleAt(w, m15Slot)['state'] = 'PENDING'),
      /no READY market_cycles row/,
    ],
    [
      'has no ready time',
      (w: World) => (cycleAt(w, m15Slot)['ready_at'] = null),
      /cannot be trusted/,
    ],
    [
      'has unreadable tuning',
      (w: World) => (cycleAt(w, m15Slot)['source_modes'] = 'x'),
      /unreadable tuning/,
    ],
  ])('when the cycle that collected M15 %s', async (_label, spoil, why) => {
    const w = world(V1);
    spoil(w);
    const { bundle, provenance } = await loaded(w);
    expect(bundle.bars.M15).toEqual([]);
    expect(bundle.statistics.M15).toBeUndefined();
    expect(bundle.bars.M5.length).toBeGreaterThan(0);
    expect(bundle.statistics.M5).toBeDefined();
    expect(provenance.collected).toEqual({ M5: true, M15: false });
    expect(provenance.barsRequested.M15).toBe(0);
    expect(provenance.notes.join('\n')).toMatch(why);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('M15 left out'));
    // nothing of M15 was read at all
    expect(
      w.prisma.queries('marketDataV6').map((q) => q.args.where.timeframe)
    ).toEqual(['M5']);
    expect(
      w.prisma.queries('indicatorStatistic').map((q) => q.args.where.timeframe)
    ).toEqual(['M5']);
    // and the bundle still has its stats_slot for M15, so tier 4 can name the slot it found no row at
    expect(bundle.stats_slot.M15).toBe(slotToIso(m15Slot));
  });
});

describe('Q13: the same source used by both timeframes under two tunings', () => {
  function collision(w: World) {
    w.indicators.settings = { M5: 'non_b', M15: 'non_b' };
    const atSlot = cycleAt(w, w.plan.slot);
    atSlot['config_hashes'] = { M5: { non_b: 'tuned-on-m5' } };
    atSlot['source_modes'] = { M5: { non_b: 'DYNAMIC' } };
    const m15 = cycleAt(w, w.plan.slot - 600);
    m15['config_hashes'] = { M15: { non_b: 'tuned-on-m15' } };
    m15['source_modes'] = { M15: { non_b: 'DYNAMIC' } };
  }

  it('is refused: the bundle carries a data status the kit does not know, the cycle’s own status is kept in the provenance, and it is logged', async () => {
    const w = world(V1);
    collision(w);
    const { bundle, provenance } = await loaded(w);
    expect(bundle.data_status).toBe(REFUSED_DATA_STATUS);
    expect(provenance.dataStatus).toBe('FRESH');
    expect(provenance.refusals).toEqual([
      expect.objectContaining({
        code: 'SOURCE_COLLISION',
        source: 'non_b',
        field: 'config_hash',
        values: { M5: 'tuned-on-m5', M15: 'tuned-on-m15' },
      }),
    ]);
    expect(bundle.config_hash).not.toHaveProperty('non_b');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('refused'));
    expect(bundleProblems(bundle)).toEqual([]);
  });

  it('keeps everything else in the bundle, so the stored copy still shows what the cycle held', async () => {
    const w = world(V1);
    const clean = (await loaded(w)).bundle;
    collision(w);
    const refused = (await loaded(w)).bundle;
    // (the M5 setting changed, so M5’s channel length is read from another row and its bars carry another
    // indicator’s columns: fewer bars, the same newest ones, the same closes)
    expect(refused.bars.M15).toEqual(clean.bars.M15);
    expect(refused.bars.M5.length).toBeGreaterThan(0);
    const closes = (bars: typeof clean.bars.M5) =>
      bars.map((b) => [b.timestamp, b.close]);
    expect(closes(refused.bars.M5)).toEqual(
      closes(clean.bars.M5.slice(-refused.bars.M5.length))
    );
    expect(refused.statistics).toEqual(clean.statistics);
    expect(refused.retuning).toBe(clean.retuning);
  });

  it('is not triggered by two charts that merely run the same indicators under different tunings (every centroid runs on both)', async () => {
    const w = world(V1);
    const atSlot = cycleAt(w, w.plan.slot);
    atSlot['config_hashes'] = { M5: { best_fit_a: 'a5', non_b: 'n5' } };
    cycleAt(w, w.plan.slot - 600)['config_hashes'] = {
      M15: { best_fit_a: 'a15', non_b: 'n15' },
    };
    const { bundle, provenance } = await loaded(w);
    expect(provenance.refusals).toEqual([]);
    expect(bundle.data_status).toBe('FRESH');
    expect(bundle.config_hash).toMatchObject({
      best_fit_a: 'a5',
      non_b: 'n15',
    });
  });
});

describe('it only reads', () => {
  it('twice gives the same bundle, and a caller that edits one result changes nothing for the next', async () => {
    const w = world(V1);
    const first = await loaded(w);
    const second = await loaded(w);
    expect(JSON.stringify(first.bundle)).toBe(JSON.stringify(second.bundle));
    first.bundle.bars.M5.length = 0;
    first.bundle.statistics.M5!['best_fit_a']['containment_rate'] = -1;
    const third = await loaded(w);
    expect(JSON.stringify(third.bundle)).toBe(JSON.stringify(second.bundle));
  });

  it('does not change a row of the tables it read', async () => {
    const w = world(V1);
    const before = JSON.stringify([
      w.prisma.cycles,
      w.prisma.bars,
      w.prisma.statistics,
    ]);
    await loaded(w);
    expect(
      JSON.stringify([w.prisma.cycles, w.prisma.bars, w.prisma.statistics])
    ).toBe(before);
  });
});

describe('the source text keeps the rules (a guard that finds no file passes forever, so it checks it found them)', () => {
  const dir = path.join(__dirname, '..', 'src', 'sensors', 'inputs');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
  const code = new Map(
    files.map((f) => [
      f,
      blankComments(fs.readFileSync(path.join(dir, f), 'utf8'), 'ts'),
    ])
  );
  const all = [...code.values()].join('\n');

  it('finds the files', () => {
    expect(files).toEqual(
      expect.arrayContaining([
        'bundle-types.ts',
        'channel-bars-query.ts',
        'closed-channel.ts',
        'context-levels-query.ts',
        'database-inputs.source.ts',
        'fixture-inputs.source.ts',
        'inputs-source.ts',
        'statistics-fields.ts',
        'stats-slot.ts',
        'tuning.ts',
      ])
    );
  });

  it('writes nothing: no create, update, upsert or delete, no raw SQL', () => {
    expect(all).not.toMatch(
      /\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/
    );
    expect(all).not.toMatch(
      /\$(executeRaw|queryRaw|executeRawUnsafe|queryRawUnsafe)/
    );
  });

  it('reads market_cycles only with state READY, and only findMany', () => {
    const calls = [...all.matchAll(/\bmarketCycle\s*\.\s*(\w+)\s*\(/g)];
    expect(calls.map((m) => m[1])).toEqual(['findMany']);
    const text = code.get('database-inputs.source.ts')!;
    const at = text.search(/\bmarketCycle\s*\.\s*findMany\s*\(/);
    expect(text.slice(at, at + 400)).toMatch(/\bstate\s*:\s*'READY'/);
  });

  it('reads statistics only with findMany pinned to one captured_at, never newest-first, distinct or limited', () => {
    const calls = [...all.matchAll(/\bindicatorStatistic\s*\.\s*(\w+)\s*\(/g)];
    expect(calls.map((m) => m[1])).toEqual(['findMany']);
    const text = code.get('database-inputs.source.ts')!;
    const at = text.search(/\bindicatorStatistic\s*\.\s*findMany\s*\(/);
    const around = text.slice(at, at + 400);
    expect(around).toMatch(/\bcaptured_at\s*:\s*collectedAt\[timeframe\]/);
    expect(around).not.toMatch(/\b(distinct|take)\s*:/);
    expect(around).not.toMatch(/['"]desc['"]/);
  });

  it('reads bars only through the one query beside closed-bars-query.ts, which is closed-bar-bounded', () => {
    const readsOf = (text: string) =>
      [...text.matchAll(/\bmarketDataV6\s*\.\s*(\w+)\s*\(/g)].map((m) => m[1]);
    // the bars come through one query, and the one bar whose sr_* levels the bundle carries through another
    expect(readsOf(all).sort()).toEqual(['findFirst', 'findMany']);
    expect(readsOf(code.get('channel-bars-query.ts')!)).toEqual(['findMany']);
    expect(readsOf(code.get('context-levels-query.ts')!)).toEqual([
      'findFirst',
    ]);
    const text = code.get('channel-bars-query.ts')!;
    expect(text).toMatch(/timestamp\s*:\s*\{\s*lte\s*:\s*maxOpenTime\s*\}/);
    expect(text).toMatch(/orderBy\s*:\s*\{\s*timestamp\s*:\s*'desc'\s*\}/);
  });

  it('reads the support and resistance levels of ONE bar, named by its open time, with no range and no ordering (so it cannot reach a bar that is still open)', () => {
    const text = code.get('context-levels-query.ts')!;
    expect(text).toMatch(/timestamp\s*:\s*openTime\b/);
    expect(text).not.toMatch(/\b(lte|lt|gte|gt|orderBy|take)\b/);
    expect(text).toMatch(/SR_COLUMNS/);
  });

  it('does not touch the digest’s query (closed-bars-query.ts keeps selecting the OHLC spine only)', () => {
    const digest = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'cycle', 'closed-bars-query.ts'),
      'utf8'
    );
    expect(digest).not.toMatch(/uoedt|ssa|base_fl/);
  });
});

describe('context_levels: the sr_* levels of the last closed bar (kit standard 1.0.6)', () => {
  const sr = (name: string) => name.startsWith('sr_');

  it('are the stored bundle’s, padded to all sixteen columns: null where the table row holds none', async () => {
    const w = world(V1);
    const { bundle } = await loaded(w);
    expect(bundle.context_levels).toEqual(
      loaderForm(readFixtureBundle(V1)).context_levels
    );
    for (const timeframe of ['M5', 'M15'] as const) {
      const levels = bundle.context_levels![timeframe]!;
      expect(Object.keys(levels)).toEqual(SR_COLUMNS);
    }
    // v1’s M15 holds five levels (sr_1 to sr_3 supports, sr_5 and sr_6 resistances), its M5 none, and sr_9 to sr_16 none
    const m15 = bundle.context_levels!.M15!;
    expect(Object.entries(m15).filter(([, v]) => v !== null)).toHaveLength(5);
    expect(m15['sr_1']).toBe(4369.57);
    expect(m15['sr_4']).toBeNull();
    expect(
      Object.values(bundle.context_levels!.M5!).every((v) => v === null)
    ).toBe(true);
  });

  it('are read by the open time of the bundle’s own last bar, one row per timeframe, and nothing else', async () => {
    const w = world(V1);
    const { bundle } = await loaded(w);
    const queries = w.prisma.queries('marketDataV6ContextLevels');
    expect(queries).toHaveLength(2);
    for (const q of queries) {
      const timeframe = q.args.where.timeframe as 'M5' | 'M15';
      const bars = bundle.bars[timeframe];
      expect(q.op).toBe('findFirst');
      expect(q.args.where).toEqual({
        symbol: 'XAUUSD',
        timeframe,
        timestamp: bars[bars.length - 1].timestamp,
      });
      expect(Object.keys(q.args.select)).toEqual(SR_COLUMNS);
    }
  });

  it('leave the bars as they were: no bar carries an sr_* column', async () => {
    const w = world(V1);
    const { bundle } = await loaded(w);
    for (const timeframe of ['M5', 'M15'] as const)
      for (const bar of bundle.bars[timeframe])
        expect(Object.keys(bar).filter(sr)).toEqual([]);
  });

  it('never take a level from the bar still forming or the bars after it (their sr_* hold the poison value)', async () => {
    const w = world(V1);
    const { bundle } = await loaded(w);
    for (const timeframe of ['M5', 'M15'] as const)
      for (const value of Object.values(bundle.context_levels![timeframe]!))
        expect(value).not.toBe(424242.5);
  });

  it('a non-finite level is made null, like every other number of a bundle', async () => {
    const w = world(V1);
    const last = w.prisma.bars
      .filter((b) => b['timeframe'] === 'M15' && b['sr_1'] === 4369.57)
      .pop()!;
    last['sr_1'] = Number.NaN;
    last['sr_2'] = Number.POSITIVE_INFINITY;
    const { bundle } = await loaded(w);
    expect(bundle.context_levels!.M15!['sr_1']).toBeNull();
    expect(bundle.context_levels!.M15!['sr_2']).toBeNull();
  });

  it('a column of another type is a new kind of column nobody classified: it throws, it does not reach the runner as text', async () => {
    const w = world(V1);
    const last = w.prisma.bars
      .filter((b) => b['timeframe'] === 'M15' && b['sr_1'] === 4369.57)
      .pop()!;
    last['sr_1'] = '4369.57';
    await expect(
      w.source.loadCycleInputs('XAUUSD', w.plan.slot)
    ).rejects.toThrow(/sr_1 holds a string, not a price/);
  });

  it('a timeframe whose last bar has no row at read time has no entry, and the key is left out when no timeframe has one', async () => {
    const w = world(V1);
    const real = w.prisma.marketDataV6.findFirst;
    w.prisma.marketDataV6.findFirst = (async (args: never) => {
      const answer = await real(args);
      return (args as { where: { timeframe: string } }).where.timeframe === 'M5'
        ? null
        : answer;
    }) as typeof real;
    const { bundle } = await loaded(w);
    expect(Object.keys(bundle.context_levels!)).toEqual(['M15']);

    w.prisma.marketDataV6.findFirst = (async () => null) as typeof real;
    const none = await loaded(w);
    expect(none.bundle).not.toHaveProperty('context_levels');
  });

  describe('a failing sr_* read never stops the cycle (an optional input; session B check F1 and F8)', () => {
    // what Prisma throws when sr_9 to sr_16 are not migrated yet: the production check (b) of waiting-on.md
    const missingColumn = Object.assign(
      new Error('The column `market_data_v6.sr_9` does not exist'),
      { code: 'P2022' }
    );
    const contextWarnings = () =>
      warn.mock.calls
        .map((call) => String(call[0]))
        .filter((text) => text.includes('context_levels left out'));

    it.each([
      ['an Error from the driver', missingColumn, /sr_9` does not exist/],
      [
        'a rejection that is not an Error',
        'connection reset',
        /connection reset/,
      ],
    ])(
      'loads OK without context_levels, warns once, and changes nothing else (%s)',
      async (_name, failure, message) => {
        const normal = await loaded(world(V1));
        const w = world(V1);
        w.prisma.marketDataV6.findFirst = (async () => {
          throw failure;
        }) as typeof w.prisma.marketDataV6.findFirst;
        warn.mockClear();

        const { bundle, provenance } = await loaded(w);

        expect(Object.keys(bundle)).not.toContain('context_levels');
        const { context_levels: stored, ...rest } = normal.bundle;
        expect(stored).toBeDefined();
        expect(bundle).toEqual(rest);
        expect(bundleProblems(bundle)).toEqual([]);
        expect(provenance.refusals).toEqual([]);
        expect(contextWarnings()).toHaveLength(1);
        expect(contextWarnings()[0]).toMatch(message);
        expect(contextWarnings()[0]).toContain(`Slot ${w.plan.slot}`);
      }
    );

    it('one timeframe failing leaves the whole key out: the levels are all or nothing', async () => {
      const w = world(V1);
      const real = w.prisma.marketDataV6.findFirst;
      w.prisma.marketDataV6.findFirst = (async (args: never) => {
        if (
          (args as { where: { timeframe: string } }).where.timeframe === 'M15'
        )
          throw missingColumn;
        return real(args);
      }) as typeof real;

      const { bundle } = await loaded(w);

      expect(Object.keys(bundle)).not.toContain('context_levels');
      expect(contextWarnings()).toHaveLength(1);
    });

    it('does not hide a value of another type: that still throws (a new kind of column nobody classified)', async () => {
      const w = world(V1);
      const last = w.prisma.bars
        .filter((b) => b['timeframe'] === 'M15' && b['sr_1'] === 4369.57)
        .pop()!;
      last['sr_1'] = '4369.57';
      await expect(
        w.source.loadCycleInputs('XAUUSD', w.plan.slot)
      ).rejects.toThrow(/sr_1 holds a string, not a price/);
      expect(contextWarnings()).toEqual([]);
    });
  });

  it('a timeframe left out of the bundle (its cycle was not READY) has no bars and so no levels', async () => {
    const w = world(V1);
    // M15 was collected by the cycle at 20:45 (not the slot): without that READY row M15 is left out
    w.prisma.cycles = w.prisma.cycles.filter((c) => c['slot'] === w.plan.slot);
    const { bundle } = await loaded(w);
    expect(bundle.bars.M15).toEqual([]);
    expect(Object.keys(bundle.context_levels ?? {})).toEqual(['M5']);
    expect(w.prisma.queries('marketDataV6ContextLevels')).toHaveLength(1);
  });

  it.each([['v3'], ['v4']] as const)(
    '%s: the loader’s bundle has the stored levels (a replica that exported sr_1 to sr_16 on both timeframes)',
    async (name) => {
      const fixture = FIXTURE_SLOTS.find((f) => f.name === name)!;
      const w = world(fixture);
      const { bundle } = await loaded(w);
      expect(bundle.context_levels).toEqual(
        loaderForm(readFixtureBundle(fixture)).context_levels
      );
      expect(
        bundleDifferences(bundle, loaderForm(readFixtureBundle(fixture)))
      ).toEqual([]);
    }
  );
});
