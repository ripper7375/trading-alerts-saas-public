import * as fs from 'fs';
import * as path from 'path';
import { Prisma } from '@prisma/client';
import {
  DROPPED_STATISTICS_FIELDS,
  LAST_PRICE_STATISTICS_FIELDS,
  LIVE_BAR_STATISTICS_FIELDS,
  STORAGE_STATISTICS_FIELDS,
  bundleStatisticsRow,
  jsonValue,
} from '../src/sensors/inputs/statistics-fields';
import {
  ENGINE_DIR,
  FIXTURE_SLOTS,
  readFixtureBundle,
} from './helpers/cycle-fixtures';

/**
 * The statistics fields that never reach a bundle (rules 2 and 3), pinned three ways:
 * to the kit's own list (`mcd_common/excel_fixture_provider.py`), to the model (a column
 * added to `indicator_statistics` must be classified by a person, because a column that
 * describes the forming bar would otherwise flow into every bundle), and to the three
 * stored bundles (their statistics rows hold exactly the other fields).
 */

const KIT_SOURCE = fs.readFileSync(
  path.join(ENGINE_DIR, 'mcd_common', 'excel_fixture_provider.py'),
  'utf8'
);

/** The quoted names of `NAME = ( ... )` in the kit's source (comments excluded). */
function kitTuple(name: string): string[] {
  const start = KIT_SOURCE.search(new RegExp(`^${name} = \\(`, 'm'));
  expect(start).toBeGreaterThanOrEqual(0);
  const open = KIT_SOURCE.indexOf('(', start);
  const close = KIT_SOURCE.indexOf(')', open);
  return [...KIT_SOURCE.slice(open, close).matchAll(/"([A-Za-z_0-9]+)"/g)].map(
    (m) => m[1]
  );
}

describe('the dropped fields are the kit’s', () => {
  it('LIVE_BAR_STATISTICS_FIELDS (the forming bar)', () => {
    const kit = kitTuple('LIVE_BAR_STATISTICS_FIELDS');
    expect(kit).toHaveLength(9);
    expect([...LIVE_BAR_STATISTICS_FIELDS]).toEqual(kit);
  });

  it('LAST_PRICE_STATISTICS_FIELDS (measured from the last price)', () => {
    const kit = kitTuple('LAST_PRICE_STATISTICS_FIELDS');
    expect(kit).toHaveLength(4);
    expect([...LAST_PRICE_STATISTICS_FIELDS]).toEqual(kit);
  });

  it('DROPPED_STATISTICS_FIELDS: both blocks, then the storage columns', () => {
    const line = KIT_SOURCE.match(
      /^DROPPED_STATISTICS_FIELDS = \(([\s\S]*?)\)$/m
    );
    expect(line).not.toBeNull();
    expect(line![1]).toContain('*LIVE_BAR_STATISTICS_FIELDS');
    expect(line![1]).toContain('*LAST_PRICE_STATISTICS_FIELDS');
    const storage = [...line![1].matchAll(/"([A-Za-z_0-9]+)"/g)].map(
      (m) => m[1]
    );
    expect([...STORAGE_STATISTICS_FIELDS]).toEqual(storage);
    expect([...DROPPED_STATISTICS_FIELDS]).toEqual([
      ...kitTuple('LIVE_BAR_STATISTICS_FIELDS'),
      ...kitTuple('LAST_PRICE_STATISTICS_FIELDS'),
      ...storage,
    ]);
    expect(DROPPED_STATISTICS_FIELDS).toHaveLength(17);
  });
});

describe('against the model and the stored bundles', () => {
  const model = Object.keys(Prisma.IndicatorStatisticScalarFieldEnum);

  it('every dropped field is a column of indicator_statistics (a name that matches nothing drops nothing)', () => {
    for (const field of DROPPED_STATISTICS_FIELDS) {
      expect(model).toContain(field);
    }
  });

  it('the model has 88 columns; a bundle row keeps the 71 that are not dropped', () => {
    expect(model).toHaveLength(88);
    expect(
      model.filter((f) => !DROPPED_STATISTICS_FIELDS.includes(f))
    ).toHaveLength(71);
  });

  it.each(FIXTURE_SLOTS.map((f) => [f.name, f] as const))(
    '%s: every statistics row of the stored bundle holds exactly the model’s other columns',
    (_name, fixture) => {
      const expected = model
        .filter((f) => !DROPPED_STATISTICS_FIELDS.includes(f))
        .sort();
      const bundle = readFixtureBundle(fixture);
      let rows = 0;
      for (const sources of Object.values(bundle.statistics)) {
        for (const row of Object.values(sources ?? {})) {
          rows += 1;
          expect(Object.keys(row).sort()).toEqual(expected);
        }
      }
      expect(rows).toBeGreaterThanOrEqual(6);
    }
  );

  it('a full row of the model comes out without any dropped field, whatever its values', () => {
    const poison = 987654.321;
    const row = Object.fromEntries(
      model.map((field) => [
        field,
        field === 'createdAt' ? new Date(0) : poison,
      ])
    );
    const out = bundleStatisticsRow(row);
    for (const field of DROPPED_STATISTICS_FIELDS) {
      expect(out).not.toHaveProperty(field);
    }
    expect(Object.keys(out)).toHaveLength(71);
    expect(Object.values(out).every((v) => v === poison)).toBe(true);
  });
});

describe('bundleStatisticsRow', () => {
  const row = {
    id: 'cm1',
    terminal_id: 'MT5-A',
    symbol: 'XAUUSD',
    timeframe: 'M5',
    source: 'best_fit_a',
    captured_at: 1789764900,
    live_bar_ts: 1789764900,
    cycle_id: 7,
    regression_angle: -2.5,
    containment_rate: 83.5,
    containment_n: 755,
    solution_found: null,
    live_close: 4390.1,
    channel_position: 1.4,
    sr_nearest_resistance: 4400,
    sr_dist_support_pts: 120,
    config_hash: 'abc',
    createdAt: new Date('2026-09-18T20:55:05Z'),
  };

  it('keeps captured_at (tier 4 compares it with the slot) and every undropped value as it is', () => {
    const out = bundleStatisticsRow(row);
    expect(out).toEqual({
      symbol: 'XAUUSD',
      timeframe: 'M5',
      source: 'best_fit_a',
      captured_at: 1789764900,
      regression_angle: -2.5,
      containment_rate: 83.5,
      containment_n: 755,
      solution_found: null,
      config_hash: 'abc',
    });
  });

  it('does not change the row it was given', () => {
    const copy = { ...row };
    bundleStatisticsRow(row);
    expect(row).toEqual(copy);
  });

  it('a Date in an undropped column is a new column nobody classified: it throws instead of becoming text', () => {
    expect(() =>
      bundleStatisticsRow({ ...row, brand_new: new Date(0) })
    ).toThrow(/brand_new holds a Date/);
  });
});

describe('jsonValue', () => {
  it.each([
    [1.5, 1.5],
    [0, 0],
    [-0.25, -0.25],
    ['text', 'text'],
    [true, true],
    [false, false],
    [null, null],
    [undefined, null],
  ])('%p stays %p', (value, expected) => {
    expect(jsonValue(value, 'x')).toBe(expected);
  });

  it.each([NaN, Infinity, -Infinity])(
    '%p becomes null: JSON has no such number and would write null without saying so',
    (value) => {
      expect(jsonValue(value, 'x')).toBeNull();
    }
  );

  it.each([[10n], [{ a: 1 }], [[1]], [Symbol('s')]])(
    '%p is refused: a bundle carries numbers, strings, booleans and null',
    (value) => {
      expect(() => jsonValue(value, 'field x')).toThrow(/field x holds a/);
    }
  );
});
