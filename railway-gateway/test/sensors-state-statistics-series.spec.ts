import * as fs from 'fs';
import * as path from 'path';
import {
  HORIZON_HOURS,
  KEY_FIELDS,
  MEASURED_FIELDS,
  MIN_SAMPLE,
  ROW_FIELDS,
  SERIES_NOTES,
  configHashKeyOf,
  evaluatorSeriesOf,
  keyProblems,
  rowProblems,
  seriesKeyOf,
} from '../src/sensors/state-statistics.series';
import { ENGINE_DIR } from './helpers/cycle-fixtures';
import {
  CONFIG_KEY,
  FIGURES,
  provisionalRow,
  readGolden,
  row,
} from './helpers/state-statistics-world';

/**
 * The names and the gate of `state_statistics` (build step 3 part 6): the series key, the row check,
 * and the places that must agree on "30" and on the column list.
 */

const REPO = path.join(__dirname, '..', '..');
const read = (...parts: string[]) =>
  fs.readFileSync(path.join(REPO, ...parts), 'utf8');

describe('the minimum sample is 30 in every place that holds it', () => {
  it('the gateway says 30', () => {
    expect(MIN_SAMPLE).toBe(30);
  });

  it('the Python engine says 30', () => {
    const source = read(
      'davintrade-stack-d-and-e',
      'engine-1-5-new',
      'mcd_worker',
      'statistics',
      'aggregate.py'
    );
    expect(/^MIN_SAMPLE = (\d+)/m.exec(source)?.[1]).toBe('30');
  });

  it('the database CHECK says 30', () => {
    const sql = read(
      'prisma',
      'migrations',
      '20261003000000_add_sensor_tables',
      'migration.sql'
    );
    const check =
      /ADD CONSTRAINT "state_statistics_n_gate" CHECK \(\s*"n" >= (\d+)/.exec(
        sql
      );
    expect(check?.[1]).toBe('30');
  });

  it('the horizons are 2 and 12 here and in the engine', () => {
    expect([...HORIZON_HOURS]).toEqual([2, 12]);
    const source = read(
      'davintrade-stack-d-and-e',
      'engine-1-5-new',
      'mcd_worker',
      'statistics',
      'outcomes.py'
    );
    expect(source).toContain('MappingProxyType({2: 24, 12: 144})');
  });
});

describe('the columns the gateway and the model agree on', () => {
  const model = read('railway-gateway', 'prisma', 'schema.prisma');
  const block = /model StateStatistic \{([\s\S]*?)\n\}/.exec(model)?.[1] ?? '';
  const nullableFloats = [...block.matchAll(/^\s*(\w+)\s+Float\?/gm)].map(
    (m) => m[1]
  );

  it("the five measured figures and the opposing-level rate are the model's nullable Float columns", () => {
    expect([...nullableFloats].sort()).toEqual(
      [...MEASURED_FIELDS, 'opposing_level_rate'].sort()
    );
  });

  it("the key fields are the model's unique key, in order", () => {
    expect(block).toContain(
      `@@unique([${KEY_FIELDS.join(', ')}], map: "state_statistics_series_key")`
    );
  });

  it('a row is the key, n and the six figures, in the order the engine returns them', () => {
    expect([...ROW_FIELDS]).toEqual([
      ...KEY_FIELDS,
      'n',
      'forward_move_median',
      'forward_move_q1',
      'forward_move_q3',
      'opposing_level_rate',
      'adverse_excursion_median',
      'adverse_excursion_q3',
    ]);
  });

  it("the engine's own rows have exactly these keys", () => {
    const golden = readGolden();
    expect(golden.result.rows.length).toBeGreaterThan(10);
    for (const r of golden.result.rows) {
      expect(Object.keys(r)).toEqual([...ROW_FIELDS]);
      expect(rowProblems(r)).toEqual([]);
    }
  });

  it("the series note is the plan's sentence", () => {
    expect(SERIES_NOTES).toBe('FORMING_BAR_FIT: UNVERIFIED');
  });

  it('the engine folder this spec reads exists', () => {
    expect(fs.existsSync(ENGINE_DIR)).toBe(true);
  });
});

describe('evaluatorSeriesOf: a PATCH continues a series, a MINOR or MAJOR change starts one', () => {
  it.each([
    ['2.0.0', '2.0'],
    ['2.0.1', '2.0'],
    ['2.0.17', '2.0'],
    ['2.1.0', '2.1'],
    ['3.0.0', '3.0'],
    ['10.12.3', '10.12'],
  ])('%s is series %s', (version, series) => {
    expect(evaluatorSeriesOf(version)).toBe(series);
  });

  it('a patch release and the release before it share a series; a minor release does not', () => {
    expect(evaluatorSeriesOf('2.0.1')).toBe(evaluatorSeriesOf('2.0.0'));
    expect(evaluatorSeriesOf('2.1.0')).not.toBe(evaluatorSeriesOf('2.0.9'));
    expect(evaluatorSeriesOf('3.0.0')).not.toBe(evaluatorSeriesOf('2.0.9'));
  });

  it.each(['2.0', '2', '2.0.1.1', 'v2.0.1', '2.0.x', '', ' 2.0.1', '2.0.1\n'])(
    'refuses %j',
    (bad) => {
      expect(() => evaluatorSeriesOf(bad)).toThrow(TypeError);
    }
  );

  it('refuses what is not a string', () => {
    expect(() => evaluatorSeriesOf(undefined as unknown as string)).toThrow(
      TypeError
    );
    expect(() => evaluatorSeriesOf(2 as unknown as string)).toThrow(TypeError);
  });
});

describe("configHashKeyOf: the sources' config_hash as one canonical text", () => {
  it('sorts the keys and writes no spaces', () => {
    expect(configHashKeyOf({ non_b: 'h9', best_fit_a: 'h1' })).toBe(
      '{"best_fit_a":"h1","non_b":"h9"}'
    );
    expect(configHashKeyOf({ best_fit_a: 'h1' })).toBe(CONFIG_KEY);
    expect(configHashKeyOf({})).toBe('{}');
  });

  it('does not depend on the order the object was written in', () => {
    expect(configHashKeyOf({ a: '1', b: '2', c: '3' })).toBe(
      configHashKeyOf({ c: '3', a: '1', b: '2' })
    );
  });

  it("keys that look like integers are sorted as text, not left in the object's own order", () => {
    expect(configHashKeyOf({ b: 'x', '10': 'y', '2': 'z' })).toBe(
      '{"10":"y","2":"z","b":"x"}'
    );
  });

  it('a changed hash, an added source or a removed one is another key', () => {
    const base = { best_fit_a: 'h1', non_b: 'h9' };
    const key = configHashKeyOf(base);
    expect(configHashKeyOf({ ...base, best_fit_a: 'h2' })).not.toBe(key);
    expect(configHashKeyOf({ ...base, cherry_a: 'h3' })).not.toBe(key);
    expect(configHashKeyOf({ best_fit_a: 'h1' })).not.toBe(key);
    expect(configHashKeyOf({ best_fit_a: 'h9', non_b: 'h1' })).not.toBe(key);
  });

  it('quotes and escapes like JSON', () => {
    expect(configHashKeyOf({ 'a"b': 'c\\d' })).toBe('{"a\\"b":"c\\\\d"}');
  });

  it.each([[null], [[]], ['text'], [5], [undefined]])(
    'refuses %p (not an object)',
    (bad) => {
      expect(() => configHashKeyOf(bad)).toThrow(TypeError);
    }
  );

  it('refuses a value that is not a string', () => {
    expect(() => configHashKeyOf({ a: 1 })).toThrow(TypeError);
    expect(() => configHashKeyOf({ a: null })).toThrow(TypeError);
    expect(() => configHashKeyOf({ a: { b: 'c' } })).toThrow(TypeError);
  });
});

describe('seriesKeyOf: which row a reading belongs to', () => {
  const base = {
    mcdId: 'MCD2',
    evaluatorVersion: '2.0.1',
    configHash: { best_fit_a: 'h1' },
    stateCode: 'MCD2_CHANNEL_UP',
    horizonHours: 2,
  };

  it('names the five columns of the unique key', () => {
    expect(seriesKeyOf(base)).toEqual({
      mcd_id: 'MCD2',
      evaluator_version_series: '2.0',
      config_hash_key: CONFIG_KEY,
      state_code: 'MCD2_CHANNEL_UP',
      horizon_hours: 2,
    });
  });

  it('a patch release is the same series', () => {
    expect(seriesKeyOf({ ...base, evaluatorVersion: '2.0.9' })).toEqual(
      seriesKeyOf(base)
    );
  });

  it('a minor release is a new series', () => {
    expect(
      seriesKeyOf({ ...base, evaluatorVersion: '2.1.0' })
        .evaluator_version_series
    ).toBe('2.1');
    expect(seriesKeyOf({ ...base, evaluatorVersion: '2.1.0' })).not.toEqual(
      seriesKeyOf(base)
    );
  });

  it('a changed config_hash is a new series', () => {
    expect(
      seriesKeyOf({ ...base, configHash: { best_fit_a: 'h2' } })
    ).not.toEqual(seriesKeyOf(base));
  });

  it('another state, MCD or horizon is another row', () => {
    for (const change of [
      { stateCode: 'MCD2_CHANNEL_DOWN' },
      { mcdId: 'MCD1', stateCode: 'MCD1_X' },
      { horizonHours: 12 },
    ]) {
      expect(seriesKeyOf({ ...base, ...change })).not.toEqual(
        seriesKeyOf(base)
      );
    }
  });

  it("throws for a reading that is not shaped like an envelope's", () => {
    expect(() => seriesKeyOf({ ...base, evaluatorVersion: 'x' })).toThrow(
      TypeError
    );
    expect(() =>
      seriesKeyOf({
        ...base,
        configHash: null as unknown as Record<string, string>,
      })
    ).toThrow(TypeError);
  });
});

describe('keyProblems', () => {
  const good = {
    mcd_id: 'MCD2',
    evaluator_version_series: '2.0',
    config_hash_key: CONFIG_KEY,
    state_code: 'MCD2_CHANNEL_UP',
    horizon_hours: 2,
  };

  it('accepts every MCD from MCD0 to MCD15 and refuses the ones after', () => {
    for (let n = 0; n <= 15; n += 1) {
      expect(
        keyProblems({ ...good, mcd_id: `MCD${n}`, state_code: `MCD${n}_X` })
      ).toEqual([]);
    }
    for (const n of [16, 20, 99, 100]) {
      expect(
        keyProblems({ ...good, mcd_id: `MCD${n}`, state_code: `MCD${n}_X` })
          .length
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it('says a config_hash_key that is not text is not text', () => {
    for (const bad of [null, 5, undefined, {}, ['{}']]) {
      expect(keyProblems({ ...good, config_hash_key: bad })).toEqual([
        'config_hash_key must be a string',
      ]);
    }
  });

  it('a good key has no problem', () => {
    expect(keyProblems(good)).toEqual([]);
    expect(keyProblems({ ...good, horizon_hours: 12 })).toEqual([]);
    expect(keyProblems({ ...good, config_hash_key: '{}' })).toEqual([]);
    expect(
      keyProblems({ ...good, mcd_id: 'MCD15', state_code: 'MCD15_A1' })
    ).toEqual([]);
  });

  it('is not an object', () => {
    for (const bad of [null, 'x', 4, []])
      expect(keyProblems(bad)).toHaveLength(1);
  });

  it.each([
    ['mcd_id', 'MCD16'],
    ['mcd_id', 'mcd2'],
    ['mcd_id', ''],
    ['mcd_id', 2],
    ['evaluator_version_series', '2'],
    ['evaluator_version_series', '2.0.1'],
    ['evaluator_version_series', 'x.y'],
    ['evaluator_version_series', null],
    ['config_hash_key', 'not json'],
    ['config_hash_key', '[]'],
    ['config_hash_key', '5'],
    ['config_hash_key', 'null'],
    ['config_hash_key', '{"a": "b"}'],
    ['config_hash_key', '{"b":"x","a":"y"}'],
    ['config_hash_key', '{"a":1}'],
    ['config_hash_key', null],
    ['state_code', 'MCD2_lower'],
    ['state_code', 'CHANNEL_UP'],
    ['state_code', ''],
    ['state_code', `MCD2_${'A'.repeat(44)}`],
    ['state_code', 'MCD1_CHANNEL_UP'],
    ['state_code', 7],
    ['horizon_hours', 1],
    ['horizon_hours', 3],
    ['horizon_hours', '2'],
    ['horizon_hours', null],
  ])('refuses %s = %j', (field, value) => {
    const problems = keyProblems({ ...good, [field]: value });
    expect(problems.length).toBeGreaterThanOrEqual(1);
    expect(problems.join(' ')).toContain(
      field === 'state_code' ? 'state_code' : field
    );
  });

  it('accepts a state code of exactly 48 characters and refuses 49', () => {
    const forty8 = `MCD2_${'A'.repeat(43)}`;
    expect(forty8).toHaveLength(48);
    expect(keyProblems({ ...good, state_code: forty8 })).toEqual([]);
    expect(keyProblems({ ...good, state_code: `${forty8}A` })).not.toEqual([]);
  });

  it('a state code of another MCD is named as such', () => {
    expect(
      keyProblems({ ...good, state_code: 'MCD1_CHANNEL_UP' }).join()
    ).toContain('does not belong to MCD2');
  });
});

describe('rowProblems: the gate', () => {
  it('n = 30 with every figure is fine', () => {
    expect(rowProblems(row())).toEqual([]);
  });

  it('n = 29 with every figure null is fine: a count and no number', () => {
    expect(rowProblems(provisionalRow(29))).toEqual([]);
    expect(rowProblems(provisionalRow(0))).toEqual([]);
    expect(rowProblems(provisionalRow(1))).toEqual([]);
  });

  it('n = 29 with all five figures is refused, and so is n = 29 with any one of them', () => {
    expect(rowProblems(row({ n: 29 })).join()).toContain('below 30');
    for (const field of FIGURES) {
      const problems = rowProblems(provisionalRow(29, { [field]: 1 }));
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain(field);
      expect(problems[0]).toContain('n = 29 is below 30');
    }
  });

  it('n = 30 with a figure missing is refused, whichever one', () => {
    for (const field of FIGURES) {
      const problems = rowProblems(row({ [field]: null }));
      expect(problems.length).toBeGreaterThanOrEqual(1);
      expect(problems.join()).toContain(field);
    }
  });

  it('n = 31 and n = 100000 with figures are fine', () => {
    expect(rowProblems(row({ n: 31 }))).toEqual([]);
    expect(rowProblems(row({ n: 100000 }))).toEqual([]);
  });

  it('n must be a whole number, zero or more', () => {
    for (const n of [-1, 1.5, NaN, Infinity, '30', null, undefined]) {
      const problems = rowProblems({ ...row(), n });
      expect(problems.length).toBeGreaterThanOrEqual(1);
      expect(problems.join()).toContain('n must be');
    }
  });

  it('a figure must be a finite number', () => {
    for (const field of FIGURES) {
      for (const bad of [NaN, Infinity, -Infinity, '1.5', true, [], {}]) {
        expect(rowProblems({ ...row(), [field]: bad }).join()).toContain(field);
      }
    }
  });

  it('a negative figure is fine for a move and not for an excursion', () => {
    expect(
      rowProblems(
        row({
          forward_move_q1: -9,
          forward_move_median: -5,
          forward_move_q3: -1,
        })
      )
    ).toEqual([]);
    expect(
      rowProblems(
        row({ adverse_excursion_median: -0.5, adverse_excursion_q3: 1 })
      ).join()
    ).toContain('must not be negative');
  });

  it('a zero excursion is a real excursion: price never went against the bias', () => {
    expect(
      rowProblems(row({ adverse_excursion_median: 0, adverse_excursion_q3: 0 }))
    ).toEqual([]);
    expect(
      rowProblems(row({ adverse_excursion_median: 0, adverse_excursion_q3: 2 }))
    ).toEqual([]);
  });

  it('the quartiles must be in order', () => {
    expect(
      rowProblems(row({ forward_move_q1: 2, forward_move_median: 1 })).join()
    ).toContain('out of order');
    expect(
      rowProblems(row({ forward_move_median: 4, forward_move_q3: 3 })).join()
    ).toContain('out of order');
    expect(
      rowProblems(
        row({ adverse_excursion_median: 5, adverse_excursion_q3: 4 })
      ).join()
    ).toContain('above its third quartile');
    // equal values are in order
    expect(
      rowProblems(
        row({
          forward_move_q1: 1,
          forward_move_median: 1,
          forward_move_q3: 1,
          adverse_excursion_median: 2,
          adverse_excursion_q3: 2,
        })
      )
    ).toEqual([]);
  });

  it('the opposing-level rate must be null: step 4 defines it', () => {
    expect(rowProblems(row({ opposing_level_rate: 0.4 })).join()).toContain(
      'opposing_level_rate must be null'
    );
    expect(
      rowProblems(provisionalRow(5, { opposing_level_rate: 0.4 })).join()
    ).toContain('opposing_level_rate must be null');
    expect(rowProblems(row({ opposing_level_rate: 0 })).join()).toContain(
      'opposing_level_rate must be null'
    );
  });

  it('a row with a missing or an unknown field is refused', () => {
    const missing: Record<string, unknown> = { ...row() };
    delete missing['forward_move_q1'];
    expect(rowProblems(missing).join()).toContain(
      'missing fields: forward_move_q1'
    );
    expect(rowProblems({ ...row(), series_notes: 'x' }).join()).toContain(
      'unknown fields: series_notes'
    );
    expect(rowProblems({ ...row(), extra: 1, other: 2 }).join()).toContain(
      'unknown fields: extra, other'
    );
  });

  it('is not an object', () => {
    for (const bad of [null, undefined, 'x', 3, [], true])
      expect(rowProblems(bad)).toEqual(['the row is not an object']);
  });

  it('a bad key is reported with the gate still checked', () => {
    const problems = rowProblems(row({ mcd_id: 'MCD99', n: 29 }));
    expect(problems.join()).toContain('mcd_id');
    expect(problems.join()).toContain('below 30');
  });
});
