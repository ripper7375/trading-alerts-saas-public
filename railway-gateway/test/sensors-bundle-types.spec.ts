import {
  BAR_COLUMNS,
  CENTROID_INDICATORS,
  CycleInputsBundle,
  KIT_CANDIDATES,
  REFUSED_DATA_STATUS,
  barsNotClosed,
  bundleProblems,
  channelColumns,
  kitIndicatorOf,
  statisticsSourceOf,
  windowBarColumns,
} from '../src/sensors/inputs/bundle-types';
import { FIXTURE_SLOTS, readFixtureBundle } from './helpers/cycle-fixtures';
import { pythonAvailable, pythonJson } from './helpers/kit-runner';

/**
 * The bundle’s shape and the channel catalogue, held to the kit (`CycleInputs`,
 * `cycle_inputs.py`) and to the three stored bundles.
 */

const v1 = () => readFixtureBundle(FIXTURE_SLOTS[0]);
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe('bundleProblems', () => {
  it.each(FIXTURE_SLOTS.map((f) => [f.name, f] as const))(
    '%s: the stored bundle is a bundle',
    (_name, fixture) => {
      expect(bundleProblems(readFixtureBundle(fixture))).toEqual([]);
    }
  );

  it('a bundle of too few bars or with no statistics is still a bundle: bad data is a reading, not a malformed request', () => {
    const bundle = clone(v1());
    bundle.bars.M5 = bundle.bars.M5.slice(-3);
    bundle.bars.M15 = [];
    bundle.statistics = {};
    bundle.active_indicator = {};
    bundle.config_hash = {};
    expect(bundleProblems(bundle)).toEqual([]);
  });

  it('a refused bundle has a data_status the kit does not know and is otherwise whole', () => {
    const bundle = clone(v1());
    bundle.data_status = REFUSED_DATA_STATUS;
    expect(bundleProblems(bundle)).toEqual([]);
    expect(['FRESH', 'DELAYED', 'STALE', 'MARKET_CLOSED']).not.toContain(
      REFUSED_DATA_STATUS
    );
  });

  const defects: Array<[string, (b: Record<string, unknown>) => void, RegExp]> =
    [
      [
        'a missing key',
        (b) => delete b['config_hash'],
        /missing key: config_hash/,
      ],
      ['an unknown key', (b) => (b['extra'] = 1), /unknown keys: extra/],
      ['an empty symbol', (b) => (b['symbol'] = ''), /symbol/],
      [
        'a slot off the grid',
        (b) => (b['cycle_slot'] = '2026-09-18T20:56Z'),
        /cycle_slot/,
      ],
      [
        'a slot as a number',
        (b) => (b['cycle_slot'] = 1789764900),
        /cycle_slot/,
      ],
      ['retuning as text', (b) => (b['retuning'] = 'false'), /retuning/],
      ['data_status as null', (b) => (b['data_status'] = null), /data_status/],
      ['bars as an object', (b) => (b['bars'] = {}), /bars.M5 must be a list/],
      [
        'a bar with no timestamp',
        (b) => ((b['bars'] as any).M5[3] = { close: 1 }),
        /bars.M5\[3\] has no numeric timestamp/,
      ],
      [
        'a bar with a text timestamp',
        (b) => ((b['bars'] as any).M5[3].timestamp = '1789531800'),
        /bars.M5\[3\]/,
      ],
      [
        'bars out of order',
        (b) => {
          const m5 = (b['bars'] as any).M5;
          [m5[10], m5[11]] = [m5[11], m5[10]];
        },
        /bars.M5\[11\] is not ascending/,
      ],
      [
        'a repeated bar',
        (b) =>
          ((b['bars'] as any).M15[5].timestamp = (
            b['bars'] as any
          ).M15[4].timestamp),
        /bars.M15\[5\] is not ascending/,
      ],
      [
        'statistics as a list',
        (b) => (b['statistics'] = []),
        /statistics must be an object/,
      ],
      [
        'statistics for a timeframe that does not exist',
        (b) => ((b['statistics'] as any).H1 = {}),
        /unknown timeframe: H1/,
      ],
      [
        'a statistics source holding a number',
        (b) => ((b['statistics'] as any).M5 = { best_fit_a: 5 }),
        /statistics.M5 must map source to row/,
      ],
      [
        'a stats_slot that is not a slot',
        (b) => ((b['stats_slot'] as any).M15 = 'now'),
        /stats_slot.M15/,
      ],
      [
        'an active indicator that is not text',
        (b) => ((b['active_indicator'] as any).M5 = 7),
        /active_indicator/,
      ],
      [
        'a config_hash holding a number',
        (b) => ((b['config_hash'] as any).best_fit_a = 7),
        /config_hash/,
      ],
    ];

  it.each(defects)('names %s', (_label, break_, expected) => {
    const bundle = clone(v1()) as unknown as Record<string, unknown>;
    break_(bundle);
    const problems = bundleProblems(bundle);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join('\n')).toMatch(expected);
  });

  describe('context_levels (optional, decision D8)', () => {
    const levelsOf = (b: Record<string, unknown>) => b['context_levels'] as any;

    it.each(FIXTURE_SLOTS.map((f) => [f.name, f] as const))(
      '%s: the stored bundle carries the sr_* columns of the last closed bar of each timeframe',
      (_name, fixture) => {
        const bundle = readFixtureBundle(fixture) as unknown as Record<
          string,
          unknown
        >;
        expect(Object.keys(levelsOf(bundle)).sort()).toEqual(['M15', 'M5']);
        for (const columns of Object.values<Record<string, unknown>>(
          levelsOf(bundle)
        )) {
          expect(Object.keys(columns).length).toBeGreaterThan(0);
          for (const [name, price] of Object.entries(columns)) {
            expect(name).toMatch(/^sr_([1-9]|1[0-6])$/);
            expect(price === null || typeof price === 'number').toBe(true);
          }
        }
      }
    );

    it('a bundle without the key is a bundle (the kit leaves an empty section out)', () => {
      const bundle = clone(v1()) as unknown as Record<string, unknown>;
      delete bundle['context_levels'];
      expect(bundleProblems(bundle)).toEqual([]);
    });

    it('an empty section, one timeframe, and null for an empty cell are all fine', () => {
      const bundle = clone(v1()) as unknown as Record<string, unknown>;
      bundle['context_levels'] = {};
      expect(bundleProblems(bundle)).toEqual([]);
      bundle['context_levels'] = { M15: { sr_1: 4369.57, sr_16: null } };
      expect(bundleProblems(bundle)).toEqual([]);
    });

    const bad: Array<[string, unknown, RegExp]> = [
      ['a list', [], /context_levels must be an object/],
      ['null', null, /context_levels must be an object/],
      ['text', 'sr_1', /context_levels must be an object/],
      ['a timeframe that does not exist', { H1: {} }, /unknown timeframe: H1/],
      ['a timeframe holding a list', { M5: [] }, /context_levels.M5 must map/],
      [
        'a level that does not exist',
        { M5: { sr_17: 1 } },
        /context_levels.M5 has an unknown level: sr_17/,
      ],
      ['a level named sr_0', { M5: { sr_0: 1 } }, /unknown level: sr_0/],
      [
        'a level that is not an sr_ column',
        { M15: { close: 1 } },
        /unknown level: close/,
      ],
      [
        'a price as text',
        { M15: { sr_1: '4369.57' } },
        /context_levels.M15.sr_1 must be a number or null/,
      ],
      [
        'a price that is not finite',
        { M15: { sr_1: null, sr_2: Infinity } },
        /context_levels.M15.sr_2 must be a number or null/,
      ],
    ];

    it.each(bad)('names %s', (_label, value, expected) => {
      const bundle = clone(v1()) as unknown as Record<string, unknown>;
      bundle['context_levels'] = value;
      const problems = bundleProblems(bundle);
      expect(problems.length).toBeGreaterThan(0);
      expect(problems.join('\n')).toMatch(expected);
    });
  });

  it.each([[null], [[]], ['text'], [5], [undefined]])(
    '%p is not a bundle',
    (value) => {
      expect(bundleProblems(value)).toEqual(['the bundle is not an object']);
    }
  );
});

describe('barsNotClosed (rule 2)', () => {
  it('the stored bundles hold no bar that is open at their slot', () => {
    for (const fixture of FIXTURE_SLOTS) {
      expect(barsNotClosed(readFixtureBundle(fixture))).toEqual([]);
    }
  });

  it('flags the forming bar of each timeframe and anything later', () => {
    const bundle = clone(v1());
    const slot = FIXTURE_SLOTS[0].slot;
    bundle.bars.M5.push({ timestamp: slot, close: 1 }); // the M5 bar forming at the slot
    bundle.bars.M15.push({ timestamp: slot - 600, close: 1 }); // the M15 bar forming at 20:55 opened 20:45
    bundle.bars.M5.push({ timestamp: slot + 300, close: 1 });
    expect(barsNotClosed(bundle)).toEqual([
      { timeframe: 'M5', timestamp: slot },
      { timeframe: 'M5', timestamp: slot + 300 },
      { timeframe: 'M15', timestamp: slot - 600 },
    ]);
  });

  it('a bar that closes exactly at the slot is closed (open time plus period equals the slot)', () => {
    const bundle = clone(v1());
    const slot = FIXTURE_SLOTS[0].slot;
    bundle.bars.M5.push({ timestamp: slot - 300, close: 1 });
    bundle.bars.M15.push({ timestamp: slot - 900 - 300, close: 1 });
    expect(barsNotClosed(bundle)).toEqual([]);
  });

  it('says nothing about a bundle whose slot cannot be read (bundleProblems does)', () => {
    const bundle = clone(v1());
    bundle.cycle_slot = 'soon';
    expect(barsNotClosed(bundle)).toEqual([]);
  });
});

describe('the channel catalogue is the kit’s', () => {
  it('names the indicators the way the kit does: fractal in the bundle, fractal_edt in the statistics', () => {
    expect(kitIndicatorOf('fractal_edt')).toBe('fractal');
    expect(kitIndicatorOf('non_b')).toBe('non_b');
    expect(statisticsSourceOf('fractal')).toBe('fractal_edt');
    expect(statisticsSourceOf('best_fit_a')).toBe('best_fit_a');
  });

  it('candidates: seven centroid variants on M15, the same plus the fractal EDT on M5', () => {
    expect(KIT_CANDIDATES.M15).toEqual(CENTROID_INDICATORS);
    expect(KIT_CANDIDATES.M5).toEqual([...CENTROID_INDICATORS, 'fractal']);
  });

  it('channel columns', () => {
    expect(channelColumns('non_b')).toEqual({
      upper: 'non_b_uoedt',
      lower: 'non_b_loedt',
      baseline: 'non_b_base_fl',
      fit: 'non_b_ssa',
    });
    expect(channelColumns('fractal')).toEqual({
      upper: 'fractal_uoedt',
      lower: 'fractal_loedt',
      baseline: 'fractal_best_fl',
      fit: 'fractal_best_fl',
    });
  });

  it('BAR_COLUMNS: the open time, the close and the channel columns of all eight candidates, 33 in all', () => {
    expect(BAR_COLUMNS).toHaveLength(7 * 4 + 3 + 2);
    expect([...BAR_COLUMNS]).toEqual([...BAR_COLUMNS].sort());
    expect(new Set(BAR_COLUMNS).size).toBe(BAR_COLUMNS.length);
    expect(BAR_COLUMNS).toEqual(
      expect.arrayContaining(['timestamp', 'close', 'fractal_best_fl'])
    );
    for (const forbidden of ['open', 'high', 'low', 'volume']) {
      expect(BAR_COLUMNS).not.toContain(forbidden);
    }
  });

  it('BAR_COLUMNS are the columns of a bar of the stored bundle whose export carried every candidate (v1 and v4)', () => {
    for (const fixture of [FIXTURE_SLOTS[0], FIXTURE_SLOTS[2]]) {
      const bundle: CycleInputsBundle = readFixtureBundle(fixture);
      for (const timeframe of ['M5', 'M15'] as const) {
        const last = bundle.bars[timeframe][bundle.bars[timeframe].length - 1];
        expect(Object.keys(last).sort()).toEqual([...BAR_COLUMNS]);
      }
    }
  });

  it('the columns of every stored bar are within BAR_COLUMNS (v3 carries 17 of the 33)', () => {
    for (const fixture of FIXTURE_SLOTS) {
      const bundle = readFixtureBundle(fixture);
      for (const timeframe of ['M5', 'M15'] as const) {
        for (const bar of bundle.bars[timeframe]) {
          for (const column of Object.keys(bar)) {
            expect(BAR_COLUMNS).toContain(column);
          }
        }
      }
    }
  });

  describe('windowBarColumns: what a bar inside a window carries', () => {
    it.each([
      [
        'best_fit_a',
        [
          'best_fit_a_base_fl',
          'best_fit_a_loedt',
          'best_fit_a_ssa',
          'best_fit_a_uoedt',
          'close',
          'timestamp',
        ],
      ],
      [
        'non_b',
        [
          'close',
          'non_b_base_fl',
          'non_b_loedt',
          'non_b_ssa',
          'non_b_uoedt',
          'timestamp',
        ],
      ],
      // the fractal EDT’s baseline is its fit: three channel columns, not four
      [
        'fractal',
        [
          'close',
          'fractal_best_fl',
          'fractal_loedt',
          'fractal_uoedt',
          'timestamp',
        ],
      ],
      [undefined, ['close', 'timestamp']],
    ])('%p carries %j', (indicator, expected) => {
      expect([...windowBarColumns(indicator)]).toEqual(expected);
    });

    it('is always a subset of BAR_COLUMNS, so what is selected covers what is carried', () => {
      for (const indicator of [...KIT_CANDIDATES.M5, undefined]) {
        for (const column of windowBarColumns(indicator))
          expect(BAR_COLUMNS).toContain(column);
      }
    });
  });

  const maybe = pythonAvailable() ? it : it.skip;
  maybe(
    'channel_columns, CANDIDATES and statistics_source agree with cycle_inputs.py (needs Python)',
    () => {
      const kit = pythonJson<{
        candidates: Record<string, string[]>;
        columns: Record<string, Record<string, string>>;
        sources: Record<string, string>;
      }>(
        [
          'import json',
          'from mcd_common.cycle_inputs import CANDIDATES, channel_columns, statistics_source',
          'names = sorted({c for v in CANDIDATES.values() for c in v})',
          'print(json.dumps({"candidates": {k: list(v) for k, v in CANDIDATES.items()},',
          '  "columns": {n: dict(channel_columns(n)) for n in names},',
          '  "sources": {n: statistics_source(n) for n in names}}))',
        ].join('\n')
      );
      expect(KIT_CANDIDATES.M5).toEqual(kit.candidates['M5']);
      expect(KIT_CANDIDATES.M15).toEqual(kit.candidates['M15']);
      for (const [name, columns] of Object.entries(kit.columns)) {
        expect(channelColumns(name)).toEqual(columns);
        expect(statisticsSourceOf(name)).toBe(kit.sources[name]);
      }
      const kitColumns = new Set(
        Object.values(kit.columns).flatMap((c) => Object.values(c))
      );
      expect(new Set(BAR_COLUMNS)).toEqual(
        new Set([...kitColumns, 'timestamp', 'close'])
      );
    }
  );
});
